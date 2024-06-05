import { ethers } from "ethers";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import {
  ApeDropFacet__factory,
  DropFacet__factory,
  EditionFacet__factory,
  NiftyKitAppRegistry__factory,
  OnboardingFacet__factory,
  ReferralFacet__factory,
  RoyaltyControlsFacet__factory,
  UpgradeFacet__factory,
} from "../typechain-types";
import { getSelectors, getInterfaceId } from "../utils/utils";

type Factory =
  | typeof ApeDropFacet__factory
  | typeof DropFacet__factory
  | typeof EditionFacet__factory
  | typeof ReferralFacet__factory
  | typeof RoyaltyControlsFacet__factory
  | typeof UpgradeFacet__factory
  | typeof OnboardingFacet__factory;

type FacetInstallation = {
  name: string;
  id: string;
  version: number;
  factory: Factory;
  networks?: string[];
};

const facets: FacetInstallation[] = [
  {
    name: "DropFacet",
    id: ethers.utils.id("drop"),
    version: 3,
    factory: DropFacet__factory,
  },
  {
    name: "EditionFacet",
    id: ethers.utils.id("edition"),
    version: 2,
    factory: EditionFacet__factory,
  },
  {
    name: "ApeDropFacet",
    id: ethers.utils.id("ape"),
    version: 3,
    factory: ApeDropFacet__factory,
    networks: ["goerli", "mainnet"],
  },
  {
    name: "RoyaltyControlsFacet",
    id: ethers.utils.id("royaltyControls"),
    version: 2,
    factory: RoyaltyControlsFacet__factory,
  },
  {
    name: "UpgradeFacet",
    id: ethers.utils.id("upgrade"),
    version: 2,
    factory: UpgradeFacet__factory,
  },
  {
    name: "ReferralFacet",
    id: ethers.utils.id("referral"),
    version: 2,
    factory: ReferralFacet__factory,
  },
  {
    name: "OnboardingFacet",
    id: ethers.utils.id("onboarding"),
    version: 1,
    factory: OnboardingFacet__factory,
  },
];

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

  for (const facet of facets) {
    if (facet.networks && !facet.networks.includes(hre.network.name)) {
      continue;
    }
    console.log(`Deploying ${facet.name}...`);
    const factory = new facet.factory(deployer);
    const contract = await factory.deploy();
    await contract.deployed();
    console.log(`${facet.name} address: `, contract.address);
    console.log("Waiting for verification...");

    let attempts = 5;
    while (attempts > 0) {
      try {
        console.log(`verifying ${facet.name}...`);
        await hre.run("verify:verify", {
          address: contract.address,
          constructorArguments: [],
        });
        break;
      } catch (err) {
        console.log("error while verifying", err);
        attempts--;
      }
    }

    // register app
    console.log("Registering app...");

    const registerTx = await appRegistry.registerApp(
      facet.id,
      contract.address,
      getInterfaceId(contract.interface),
      getSelectors(contract.interface),
      facet.version
    );

    await registerTx.wait();
  }

  console.log("Done!");
};

export default deployFn;

deployFn.tags = ["NiftyKitUpgradeApp"];
