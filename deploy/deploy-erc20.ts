import { HardhatRuntimeEnvironment } from "hardhat/types";
import { MockERC20__factory } from "../typechain-types";

const deployFn = async function (hre: HardhatRuntimeEnvironment) {
  await hre.run("compile");

  const [deployer] = await hre.ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  console.log("Deploying the contracts with the account: ", deployerAddress);
  console.log("Account balance: ", (await deployer.getBalance()).toString());

  // Deploy ERC20
  console.log("Deploying MockERC20...");
  const ERC20 = new MockERC20__factory(deployer);
  const contract = await ERC20.deploy();
  await contract.deployed();
  console.log("MockERC20 address: ", contract.address);
  console.log("Waiting for verification...");
  await contract.deployTransaction.wait(5);
  try {
    console.log("verifying MockERC20...");
    await hre.run("verify:verify", {
      address: contract.address,
      constructorArguments: [],
    });
  } catch (err) {
    console.log("error while verifying", err);
  }

  console.log("Done!");
};

export default deployFn;

deployFn.tags = ["ERC20"];
