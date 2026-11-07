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

  it("enforces all four brochure package ranges and rates", async function () {
    const { vantex } = await fixture();
    expect((await vantex.planTerms(usdt(100), 0))[0]).to.equal(100);
    expect((await vantex.planTerms(usdt(101), 1))[0]).to.equal(110);
    expect((await vantex.planTerms(usdt(500), 1))[0]).to.equal(110);
    expect((await vantex.planTerms(usdt(501), 2))[0]).to.equal(120);
    expect((await vantex.planTerms(usdt(1000), 2))[0]).to.equal(120);
    expect((await vantex.planTerms(usdt(1001), 3))[0]).to.equal(130);
    expect((await vantex.planTerms(usdt(2500), 3))[0]).to.equal(130);
    await expect(vantex.planTerms(usdt(101), 0)).to.be.revertedWithCustomError(vantex, "InvalidAmount");
    await expect(vantex.planTerms(usdt(500), 2)).to.be.revertedWithCustomError(vantex, "InvalidAmount");
  });

  it("accrues and claims package ROI", async function () {
    const { owner, token, vantex } = await fixture();
    await vantex.invest(usdt(1000), 2); // package 3: 0.60% daily
    await time.increase(10 * 24 * 60 * 60);
    expect(await vantex.pendingRoi(owner.address)).to.equal(usdt(120));
    const before = await token.balanceOf(owner.address);
    await expect(vantex.claimRoi()).to.emit(vantex, "RoiClaimed");
    expect(await token.balanceOf(owner.address)).to.be.closeTo(before + usdt(120), 1_000n);
  });

  it("caps accrual at the plan duration", async function () {
    const { owner, vantex } = await fixture();
    await vantex.invest(usdt(100), 0);
    await time.increase(300 * 24 * 60 * 60);
    expect(await vantex.pendingRoi(owner.address)).to.equal(usdt(200)); // 100 × 1% × 200
  });

  it("compounds claimable ROI into a new selected-plan position", async function () {
    const { owner, vantex } = await fixture();
    await vantex.invest(usdt(1000), 2);
    await time.increase(10 * 24 * 60 * 60);
    await expect(vantex.compoundRoi(1)).to.emit(vantex, "RoiCompounded");
    const positions = await vantex.positionsOf(owner.address);
    expect(positions).to.have.length(2);
    expect(positions[1].principal).to.be.closeTo(usdt(120), 1_000n);
    expect(positions[1].dailyRateBps).to.equal(110);
    expect(await vantex.totalCompounded()).to.be.closeTo(usdt(120), 1_000n);
  });

  it("normalizes 60/40 business and unlocks salary cycles", async function () {
    const { owner, alice, bob, token, vantex } = await fixture();
    await vantex.connect(alice).register(owner.address, 0, 0);
    await vantex.connect(bob).register(owner.address, 1, 0);
    await vantex.connect(alice).invest(usdt(600), 2);
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
    await vantex.connect(alice).invest(usdt(600), 2);
    await vantex.connect(bob).invest(usdt(400), 1);
    await time.increase(10 * 24 * 60 * 60);
    const before = await token.balanceOf(owner.address);
    await expect(vantex.connect(alice).claimRoi()).to.emit(vantex, "ReferralPaid");
    // Alice receives $72 total ($36 profit + $36 capital); sponsor gets 10% of profit = $3.60.
    expect(await token.balanceOf(owner.address)).to.be.closeTo(before + usdt(3.6), 100n);
  });

  it("stores the exact 15 ROI-on-ROI percentages", async function () {
    const { vantex } = await fixture();
    const expected = [1000n, 500n, 400n, 300n, 300n, 300n, 200n, 200n, 100n, 100n, 200n, 200n, 300n, 400n, 500n];
    for (let level = 0; level < expected.length; level += 1) {
      expect(await vantex.referralRateBps(level)).to.equal(expected[level]);
    }
  });

  it("unlocks levels 3, 7, 11, and 15 at the brochure business thresholds", async function () {
    const { owner, alice, bob, vantex } = await fixture();
    await vantex.connect(alice).register(owner.address, 0, 0);
    await vantex.connect(bob).register(owner.address, 1, 0);

    await vantex.connect(alice).invest(usdt(60), 0);
    await vantex.connect(bob).invest(usdt(40), 0);
    expect(await vantex.qualifiedLevel(owner.address)).to.equal(3);

    await vantex.connect(alice).invest(usdt(120), 1);
    await vantex.connect(bob).invest(usdt(80), 0);
    expect(await vantex.qualifiedLevel(owner.address)).to.equal(7);

    await vantex.connect(alice).invest(usdt(300), 1);
    await vantex.connect(bob).invest(usdt(200), 1);
    expect(await vantex.qualifiedLevel(owner.address)).to.equal(11);

    await vantex.connect(alice).invest(usdt(420), 1);
    await vantex.connect(bob).invest(usdt(280), 1);
    expect(await vantex.qualifiedLevel(owner.address)).to.equal(15);
  });

  it("enforces deposit limits and pause controls", async function () {
    const { owner, vantex } = await fixture();
    await expect(vantex.invest(999_999, 0)).to.be.revertedWithCustomError(vantex, "InvalidAmount");
    await vantex.setPaused(true);
    await expect(vantex.invest(usdt(100), 0)).to.be.revertedWithCustomError(vantex, "Paused");
    await expect(vantex.connect(owner).setPaused(false)).to.emit(vantex, "PauseSet").withArgs(false);
  });
});
