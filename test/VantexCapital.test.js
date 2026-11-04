const { expect } = require("chai");
const { ethers } = require("hardhat");
const { time } = require("@nomicfoundation/hardhat-network-helpers");

describe("VantexCapital", function () {
  const usdt = (value) => ethers.parseUnits(String(value), 6);

  async function fixture() {
    const [owner, alice, bob, carol] = await ethers.getSigners();
    const token = await ethers.deployContract("MockUSDT");
    const vantex = await ethers.deployContract("VantexCapital", [await token.getAddress(), 6, owner.address]);
    for (const signer of [owner, alice, bob, carol]) {
      await token.mint(signer.address, usdt(100_000));
      await token.connect(signer).approve(await vantex.getAddress(), ethers.MaxUint256);
    }
    await vantex.fundRewards(usdt(50_000));
    return { owner, alice, bob, carol, token, vantex };
  }

  it("registers both organization legs and prevents slot replacement", async function () {
    const { owner, alice, bob, carol, vantex } = await fixture();
    await expect(vantex.connect(alice).register(owner.address, 0, 0))
      .to.emit(vantex, "Registered").withArgs(alice.address, owner.address, 0, 0);
    await vantex.connect(bob).register(owner.address, 1, 0);
    await expect(vantex.connect(carol).register(owner.address, 0, 1)).to.be.revertedWithCustomError(vantex, "LegOccupied");
  });

  it("applies the four flexible amount tiers", async function () {
    const { vantex } = await fixture();
    expect((await vantex.planTerms(usdt(100), 0))[0]).to.equal(50);
    expect((await vantex.planTerms(usdt(101), 0))[0]).to.equal(55);
    expect((await vantex.planTerms(usdt(501), 0))[0]).to.equal(60);
    expect((await vantex.planTerms(usdt(1001), 0))[0]).to.equal(65);
  });

  it("accrues and claims a fixed-plan ROI", async function () {
    const { owner, token, vantex } = await fixture();
    await vantex.invest(usdt(1000), 1); // starter: 0.60% daily
    await time.increase(10 * 24 * 60 * 60);
    expect(await vantex.pendingRoi(owner.address)).to.equal(usdt(60));
    const before = await token.balanceOf(owner.address);
    await expect(vantex.claimRoi()).to.emit(vantex, "RoiClaimed");
    expect(await token.balanceOf(owner.address)).to.be.closeTo(before + usdt(60), 100n);
  });

  it("caps accrual at the plan duration", async function () {
    const { owner, vantex } = await fixture();
    await vantex.invest(usdt(100), 1);
    await time.increase(180 * 24 * 60 * 60);
    expect(await vantex.pendingRoi(owner.address)).to.equal(usdt(54)); // 100 × .6% × 90
  });

  it("compounds claimable ROI into a new selected-plan position", async function () {
    const { owner, vantex } = await fixture();
    await vantex.invest(usdt(1000), 1);
    await time.increase(10 * 24 * 60 * 60);
    await expect(vantex.compoundRoi(2)).to.emit(vantex, "RoiCompounded");
    const positions = await vantex.positionsOf(owner.address);
    expect(positions).to.have.length(2);
    expect(positions[1].principal).to.be.closeTo(usdt(60), 100n);
    expect(positions[1].dailyRateBps).to.equal(65);
    expect(await vantex.totalCompounded()).to.be.closeTo(usdt(60), 100n);
  });

  it("normalizes 60/40 business and unlocks salary cycles", async function () {
    const { owner, alice, bob, token, vantex } = await fixture();
    await vantex.connect(alice).register(owner.address, 0, 0);
    await vantex.connect(bob).register(owner.address, 1, 0);
    await vantex.connect(alice).invest(usdt(600), 1);
    await vantex.connect(bob).invest(usdt(400), 1);
    expect(await vantex.balancedBusiness(owner.address)).to.equal(usdt(1000));
    expect(await vantex.qualifiedLevel(owner.address)).to.equal(11);
    expect((await vantex.members(owner.address)).salaryRank).to.equal(1);
    await time.increase(15 * 24 * 60 * 60);
    const before = await token.balanceOf(owner.address);
    await vantex.claimSalary();
    expect(await token.balanceOf(owner.address)).to.equal(before + usdt(25));
  });

  it("pays qualified ROI-on-ROI referral rewards", async function () {
    const { owner, alice, bob, token, vantex } = await fixture();
    await vantex.connect(alice).register(owner.address, 0, 0);
    await vantex.connect(bob).register(owner.address, 1, 0);
    await vantex.connect(alice).invest(usdt(600), 1);
    await vantex.connect(bob).invest(usdt(400), 1);
    await time.increase(10 * 24 * 60 * 60);
    const before = await token.balanceOf(owner.address);
    await expect(vantex.connect(alice).claimRoi()).to.emit(vantex, "ReferralPaid");
    // Alice earns $36 ROI; level-one sponsor receives 10% = $3.60.
    expect(await token.balanceOf(owner.address)).to.be.closeTo(before + usdt(3.6), 100n);
  });

  it("enforces deposit limits and pause controls", async function () {
    const { owner, vantex } = await fixture();
    await expect(vantex.invest(999_999, 0)).to.be.revertedWithCustomError(vantex, "InvalidAmount");
    await vantex.setPaused(true);
    await expect(vantex.invest(usdt(100), 0)).to.be.revertedWithCustomError(vantex, "Paused");
    await expect(vantex.connect(owner).setPaused(false)).to.emit(vantex, "PauseSet").withArgs(false);
  });
});
