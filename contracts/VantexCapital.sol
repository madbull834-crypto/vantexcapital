// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title VantexCapital
 * @notice Stablecoin investment and referral accounting based on the supplied Vantex plan.
 * @dev Rates use basis points (100 = 1%). Each package releases equal daily profit and capital,
 *      producing the brochure totals of 1.00%–1.30% per day. Positions are capped at 200 days
 *      because the source brochure does not state a duration. This is a pooled-reward contract:
 *      the owner must keep it solvent and no return is guaranteed by the code.
 */
contract VantexCapital is Ownable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    uint16 private constant BPS = 10_000;
    uint16 private constant MAX_POSITIONS = 50;
    uint32 private constant DAY = 1 days;
    uint32 private constant SALARY_CYCLE = 15 days;
    uint8 private constant MAX_REFERRAL_LEVEL = 15;

    enum Plan { Package1, Package2, Package3, Package4 }
    enum Leg { A, B }
    enum Split { A60B40, A40B60 }

    struct Position {
        uint128 principal;
        uint128 claimed;
        uint40 startedAt;
        uint40 endsAt;
        uint16 dailyRateBps;
        Plan plan;
    }

    struct Member {
        address referrer;
        uint128 personalBusiness;
        uint128 legABusiness;
        uint128 legBBusiness;
        uint40 salaryStartedAt;
        uint8 salaryRank;
        uint8 salaryClaims;
        Split split;
        bool registered;
    }

    IERC20 public immutable paymentToken;
    uint8 public immutable tokenDecimals;
    uint256 public immutable unit;
    bool public paused;

    mapping(address => Member) public members;
    mapping(address => Position[]) private _positions;
    mapping(address => mapping(Leg => address)) public directLeg;

    uint16[15] public referralRateBps = [1000, 500, 400, 300, 300, 300, 200, 200, 100, 100, 200, 200, 300, 400, 500];
    uint16[4] public levelBusinessUsd = [100, 300, 800, 1500];
    uint32[5] public salaryBusinessUsd = [1000, 2000, 5000, 10000, 20000];
    uint16[5] public salaryAmountUsd = [25, 50, 125, 250, 500];

    uint256 public totalDeposited;
    uint256 public totalCompounded;
    uint256 public totalRewardsPaid;

    error Paused();
    error InvalidAmount();
    error InvalidReferrer();
    error AlreadyRegistered();
    error LegOccupied();
    error TooManyPositions();
    error NothingToClaim();
    error Insolvent();
    error TransferRestricted();

    event Registered(address indexed member, address indexed referrer, Leg leg, Split split);
    event Invested(address indexed member, uint256 indexed positionId, uint256 amount, Plan plan, uint16 dailyRateBps, uint40 endsAt);
    event RoiClaimed(address indexed member, uint256 amount);
    event RoiCompounded(address indexed member, uint256 indexed positionId, uint256 amount, Plan plan);
    event ReferralPaid(address indexed earner, address indexed source, uint8 level, uint256 amount);
    event SalaryActivated(address indexed member, uint8 rank, uint256 businessVolume);
    event SalaryClaimed(address indexed member, uint8 rank, uint8 cycle, uint256 amount);
    event RewardsFunded(address indexed funder, uint256 amount);
    event PauseSet(bool paused);

    constructor(IERC20 token_, uint8 tokenDecimals_, address owner_) Ownable(owner_) {
        if (address(token_) == address(0) || owner_ == address(0) || tokenDecimals_ > 18) revert InvalidAmount();
        paymentToken = token_;
        tokenDecimals = tokenDecimals_;
        unit = 10 ** tokenDecimals_;
        members[owner_].registered = true;
    }

    modifier whenNotPaused() {
        if (paused) revert Paused();
        _;
    }

    function register(address referrer, Leg leg, Split split) external whenNotPaused {
        if (members[msg.sender].registered) revert AlreadyRegistered();
        if (referrer == address(0) || referrer == msg.sender || !members[referrer].registered) revert InvalidReferrer();
        if (directLeg[referrer][leg] != address(0)) revert LegOccupied();
        members[msg.sender].registered = true;
        members[msg.sender].referrer = referrer;
        members[msg.sender].split = split;
        directLeg[referrer][leg] = msg.sender;
        emit Registered(msg.sender, referrer, leg, split);
    }

    function invest(uint256 amount, Plan plan) external nonReentrant whenNotPaused {
        if (!members[msg.sender].registered) revert InvalidReferrer();
        if (amount < unit || amount > 2_500 * unit) revert InvalidAmount();
        if (_positions[msg.sender].length >= MAX_POSITIONS) revert TooManyPositions();

        (uint16 rate, uint32 duration) = planTerms(amount, plan);
        paymentToken.safeTransferFrom(msg.sender, address(this), amount);
        uint40 started = uint40(block.timestamp);
        uint40 ends = started + duration;
        _positions[msg.sender].push(Position(uint128(amount), 0, started, ends, rate, plan));
        members[msg.sender].personalBusiness += uint128(amount);
        totalDeposited += amount;
        _propagateBusiness(msg.sender, amount);
        emit Invested(msg.sender, _positions[msg.sender].length - 1, amount, plan, rate, ends);
    }

    function claimRoi() external nonReentrant whenNotPaused returns (uint256 amount) {
        Position[] storage positions = _positions[msg.sender];
        uint256 length = positions.length;
        for (uint256 i; i < length; ++i) {
            uint256 earned = _earned(positions[i]);
            uint256 already = positions[i].claimed;
            if (earned > already) {
                uint256 claimable = earned - already;
                positions[i].claimed = uint128(earned);
                amount += claimable;
            }
        }
        if (amount == 0) revert NothingToClaim();
        _requireBalance(amount);
        paymentToken.safeTransfer(msg.sender, amount);
        totalRewardsPaid += amount;
        emit RoiClaimed(msg.sender, amount);
        // Half of the package payout is profit and half is released capital. ROI-on-ROI
        // commission applies only to the profit component.
        _payReferralRoi(msg.sender, amount / 2);
    }

    function compoundRoi(Plan plan) external nonReentrant whenNotPaused returns (uint256 amount) {
        Position[] storage positions = _positions[msg.sender];
        if (positions.length >= MAX_POSITIONS) revert TooManyPositions();
        for (uint256 i; i < positions.length; ++i) {
            uint256 earned = _earned(positions[i]);
            if (earned > positions[i].claimed) {
                amount += earned - positions[i].claimed;
                positions[i].claimed = uint128(earned);
            }
        }
        if (amount < unit || amount > 2_500 * unit) revert InvalidAmount();
        (uint16 rate, uint32 duration) = planTerms(amount, plan);
        uint40 started = uint40(block.timestamp);
        _positions[msg.sender].push(Position(uint128(amount), 0, started, started + duration, rate, plan));
        totalCompounded += amount;
        emit RoiCompounded(msg.sender, _positions[msg.sender].length - 1, amount, plan);
        _payReferralRoi(msg.sender, amount / 2);
    }

    function claimSalary() external nonReentrant whenNotPaused returns (uint256 amount) {
        Member storage member = members[msg.sender];
        _refreshSalary(msg.sender);
        if (member.salaryRank == 0 || member.salaryClaims >= 6) revert NothingToClaim();
        uint256 cyclesElapsed = (block.timestamp - member.salaryStartedAt) / SALARY_CYCLE;
        uint256 available = cyclesElapsed > 6 ? 6 : cyclesElapsed;
        if (available <= member.salaryClaims) revert NothingToClaim();
        uint8 cycles = uint8(available - member.salaryClaims);
        amount = uint256(salaryAmountUsd[member.salaryRank - 1]) * unit * cycles;
        member.salaryClaims += cycles;
        _requireBalance(amount);
        paymentToken.safeTransfer(msg.sender, amount);
        totalRewardsPaid += amount;
        emit SalaryClaimed(msg.sender, member.salaryRank, member.salaryClaims, amount);
    }

    function fundRewards(uint256 amount) external nonReentrant {
        if (amount == 0) revert InvalidAmount();
        paymentToken.safeTransferFrom(msg.sender, address(this), amount);
        emit RewardsFunded(msg.sender, amount);
    }

    function withdrawExcess(address to, uint256 amount) external onlyOwner nonReentrant {
        if (to == address(0)) revert InvalidAmount();
        paymentToken.safeTransfer(to, amount);
    }

    function setPaused(bool value) external onlyOwner {
        paused = value;
        emit PauseSet(value);
    }

    function planTerms(uint256 amount, Plan plan) public view returns (uint16 rate, uint32 duration) {
        if (plan == Plan.Package1 && amount >= unit && amount <= 100 * unit) rate = 100;
        else if (plan == Plan.Package2 && amount >= 101 * unit && amount <= 500 * unit) rate = 110;
        else if (plan == Plan.Package3 && amount >= 501 * unit && amount <= 1_000 * unit) rate = 120;
        else if (plan == Plan.Package4 && amount >= 1_001 * unit && amount <= 2_500 * unit) rate = 130;
        else revert InvalidAmount();
        duration = 200 days;
    }

    function pendingRoi(address account) public view returns (uint256 amount) {
        Position[] storage positions = _positions[account];
        for (uint256 i; i < positions.length; ++i) {
            uint256 earned = _earned(positions[i]);
            if (earned > positions[i].claimed) amount += earned - positions[i].claimed;
        }
    }

    function positionsOf(address account) external view returns (Position[] memory) {
        return _positions[account];
    }

    function qualifiedLevel(address account) public view returns (uint8) {
        Member storage m = members[account];
        uint256 balanced = _balancedBusiness(m);
        if (balanced >= uint256(levelBusinessUsd[3]) * unit) return 15;
        if (balanced >= uint256(levelBusinessUsd[2]) * unit) return 11;
        if (balanced >= uint256(levelBusinessUsd[1]) * unit) return 7;
        if (balanced >= uint256(levelBusinessUsd[0]) * unit) return 3;
        return 0;
    }

    function balancedBusiness(address account) external view returns (uint256) {
        return _balancedBusiness(members[account]);
    }

    function currentSalaryRank(address account) public view returns (uint8 rank) {
        uint256 business = _balancedBusiness(members[account]);
        for (uint8 i; i < 5; ++i) if (business >= uint256(salaryBusinessUsd[i]) * unit) rank = i + 1;
    }

    function _earned(Position storage position) private view returns (uint256) {
        uint256 until = block.timestamp < position.endsAt ? block.timestamp : position.endsAt;
        if (until <= position.startedAt) return 0;
        return uint256(position.principal) * position.dailyRateBps * (until - position.startedAt) / DAY / BPS;
    }

    function _propagateBusiness(address investor, uint256 amount) private {
        address child = investor;
        address upline = members[child].referrer;
        for (uint8 level = 1; level <= MAX_REFERRAL_LEVEL && upline != address(0); ++level) {
            if (directLeg[upline][Leg.A] == child) members[upline].legABusiness += uint128(amount);
            else members[upline].legBBusiness += uint128(amount);
            _refreshSalary(upline);
            child = upline;
            upline = members[child].referrer;
        }
    }

    function _payReferralRoi(address source, uint256 roi) private {
        address upline = members[source].referrer;
        for (uint8 level = 1; level <= MAX_REFERRAL_LEVEL && upline != address(0); ++level) {
            if (qualifiedLevel(upline) >= level) {
                uint256 reward = roi * referralRateBps[level - 1] / BPS;
                if (reward != 0 && paymentToken.balanceOf(address(this)) >= reward) {
                    paymentToken.safeTransfer(upline, reward);
                    totalRewardsPaid += reward;
                    emit ReferralPaid(upline, source, level, reward);
                }
            }
            upline = members[upline].referrer;
        }
    }

    function _balancedBusiness(Member storage member) private view returns (uint256) {
        uint256 a = member.legABusiness;
        uint256 b = member.legBBusiness;
        // Normalize both legs against the selected 60/40 split. The lower normalized leg is
        // the qualified balanced volume; excess on one side cannot unlock ranks by itself.
        uint256 aWeight = member.split == Split.A60B40 ? 60 : 40;
        uint256 bWeight = 100 - aWeight;
        uint256 normalizedA = a * 100 / aWeight;
        uint256 normalizedB = b * 100 / bWeight;
        return normalizedA < normalizedB ? normalizedA : normalizedB;
    }

    function _refreshSalary(address account) private {
        Member storage member = members[account];
        uint8 rank = currentSalaryRank(account);
        if (rank > member.salaryRank) {
            member.salaryRank = rank;
            member.salaryClaims = 0;
            member.salaryStartedAt = uint40(block.timestamp);
            emit SalaryActivated(account, rank, _balancedBusiness(member));
        }
    }

    function _requireBalance(uint256 amount) private view {
        if (paymentToken.balanceOf(address(this)) < amount) revert Insolvent();
    }
}
