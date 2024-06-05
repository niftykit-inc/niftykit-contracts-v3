import { getImplementationAddress } from "@openzeppelin/upgrades-core";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import {
  NiftyKitForwarder__factory,
  NiftyKitV3__factory,
} from "../typechain-types";

const deployFn = async function (hre: HardhatRuntimeEnvironment) {
  await hre.run("compile");

  const [deployer] = await hre.ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  console.log("Deploying the contracts with the account: ", deployerAddress);
  console.log("Account balance: ", (await deployer.getBalance()).toString());

  // Deploy NiftyKitForwarder
  console.log("Deploying NiftyKitForwarder...");
  const Forwarder = new NiftyKitForwarder__factory(deployer);
  const proxy = await hre.upgrades.deployProxy(Forwarder, []);
  console.log("TX: ", proxy.deployTransaction.hash);
  await proxy.deployed();
  const forwarderResults = await hre.ethers.provider.waitForTransaction(
    proxy.deployTransaction.hash
  );
  console.log("NiftyKitForwarder address: ", forwarderResults.contractAddress);
  console.log("Waiting for verification...");
  const implementation = await getImplementationAddress(
    hre.ethers.provider,
    forwarderResults.contractAddress
  );
  await proxy.deployTransaction.wait(5);
  try {
    console.log("verifying NiftyKitForwarder...");
    await hre.run("verify:verify", {
      address: implementation,
      constructorArguments: [],
    });
  } catch (err) {
    console.log("error while verifying", err);
  }

  // assigns forwarder to the NiftyKit contract
  const niftyKit = NiftyKitV3__factory.connect(
    process.env.NIFTYKIT_ADDRESS!,
    deployer
  );

  await niftyKit.setTrustedForwarder(forwarderResults.contractAddress);

  console.log("Done!");
};

export default deployFn;

deployFn.tags = ["NiftyKitForwarder"];
