import { HardhatRuntimeEnvironment } from "hardhat/types";
import {
  BaseFacet__factory,
  NiftyKitAppRegistry__factory,
} from "../typechain-types";
import { getSelectors } from "../utils/utils";

const deployFn = async function (hre: HardhatRuntimeEnvironment) {
  await hre.run("compile");

  const [deployer] = await hre.ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  console.log("Deploying the contracts with the account: ", deployerAddress);
  console.log("Account balance: ", (await deployer.getBalance()).toString());

  console.log("Connecting to app registry...");
  const appRegistry = NiftyKitAppRegistry__factory.connect(
    process.env.APP_REGISTRY_ADDRESS!,
    deployer
  );

  // deploy base
  console.log("Deploying Base...");
  const baseFactory = new BaseFacet__factory(deployer);
  const base = await baseFactory.deploy();
  await base.deployed();
  console.log("BaseFacet address: ", base.address);
  console.log("Waiting for verification...");
  await base.deployTransaction.wait(5);
  try {
    console.log("verifying BaseFacet...");
    await hre.run("verify:verify", {
      address: base.address,
      constructorArguments: [],
    });
  } catch (err) {
    console.log("error while verifying", err);
  }

  // setting base
  console.log("Setting Base...");
  const setBaseTx = await appRegistry.setBase(
    base.address,
    [
      "0x80ac58cd", // ERC721
      "0x2a55205a", // ERC2981 (royalty)
      "0x7f5828d0", // ERC173 (ownable)
      "0x01ffc9a7", // ERC165 (introspection)
      "0x48e2b093", // DiamondLoupe
    ],
    getSelectors(base.interface),
    2
  );

  await setBaseTx.wait();

  console.log("Done!");
};

export default deployFn;

deployFn.tags = ["NiftyKitUpgradeBase"];
