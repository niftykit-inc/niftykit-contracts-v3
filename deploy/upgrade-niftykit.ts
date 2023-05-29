import { getImplementationAddress } from "@openzeppelin/upgrades-core";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import { NiftyKitV3__factory } from "../typechain-types";

const upgradeNiftyKitFn = async function (hre: HardhatRuntimeEnvironment) {
  if (!process.env.NIFTYKIT_ADDRESS) {
    throw new Error("NIFTYKIT_ADDRESS not set");
  }
  await hre.run("compile");

  const [deployer] = await hre.ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  console.log("Upgrading NiftyKit with the account: ", deployerAddress);
  console.log("Account balance: ", (await deployer.getBalance()).toString());

  console.log("Upgrading NiftyKit...");
  const factory = new NiftyKitV3__factory(deployer);
  const niftyKit = await hre.upgrades.upgradeProxy(
    process.env.NIFTYKIT_ADDRESS!,
    factory
  );
  console.log("TX: ", niftyKit.deployTransaction.hash);
  await niftyKit.deployed();

  const implementation = await getImplementationAddress(
    hre.ethers.provider,
    process.env.NIFTYKIT_ADDRESS!
  );
  await niftyKit.deployTransaction.wait(5);
  try {
    console.log("verifying NiftyKit...");
    await hre.run("verify:verify", {
      address: implementation,
      constructorArguments: [],
    });
  } catch (err) {
    console.log("error while verifying", err);
  }
};

export default upgradeNiftyKitFn;

upgradeNiftyKitFn.tags = ["NiftyKitUpgrade"];
