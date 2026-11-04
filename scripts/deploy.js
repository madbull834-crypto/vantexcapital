const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  const tokenAddress = process.env.PAYMENT_TOKEN;
  let token;
  let mock = false;
  if (tokenAddress) token = await ethers.getContractAt("IERC20", tokenAddress);
  else {
    token = await ethers.deployContract("MockUSDT");
    await token.waitForDeployment();
    mock = true;
  }
  const vantex = await ethers.deployContract("VantexCapital", [await token.getAddress(), 6, deployer.address]);
  await vantex.waitForDeployment();
  if (mock) {
    const seed = ethers.parseUnits("100000", 6);
    const rewardPool = ethers.parseUnits("50000", 6);
    await (await token.mint(deployer.address, seed)).wait();
    await (await token.approve(await vantex.getAddress(), rewardPool)).wait();
    await (await vantex.fundRewards(rewardPool)).wait();
  }
  console.log(JSON.stringify({ deployer: deployer.address, paymentToken: await token.getAddress(), vantex: await vantex.getAddress() }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
