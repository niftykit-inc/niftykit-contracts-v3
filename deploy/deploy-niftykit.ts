import fs from "fs";
import { ethers } from "ethers";
import { getImplementationAddress } from "@openzeppelin/upgrades-core";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import {
  ApeDropFacet__factory,
  DiamondCollection__factory,
  DropFacet__factory,
  EditionFacet__factory,
  NiftyKitAppRegistry__factory,
  NiftyKitV3__factory,
} from "../typechain-types";
import { getSelectors, getInterfaceId } from "../utils/utils";

function saveArtifacts(
  contractsPath: string,
  contractAddress: string,
  network: string
) {
  if (!fs.existsSync(contractsPath)) {
    fs.mkdirSync(contractsPath);
  }

  fs.writeFileSync(
    `${contractsPath}/NiftyKit-${network}.json`,
    JSON.stringify(
      {
        address: contractAddress,
      },
      undefined,
      2
    )
  );
}

const deployFn = async function (hre: HardhatRuntimeEnvironment) {
  await hre.run("compile");

  const [deployer] = await hre.ethers.getSigners();
  const deployerAddress = await deployer.getAddress();
  console.log("Deploying the contracts with the account: ", deployerAddress);
  console.log("Account balance: ", (await deployer.getBalance()).toString());

  // Deploy AppRegistry
  console.log("Deploying AppRegistry...");
  const AppRegistry = new NiftyKitAppRegistry__factory(deployer);
  const registryProxy = await hre.upgrades.deployProxy(AppRegistry, []);
  console.log("TX: ", registryProxy.deployTransaction.hash);
  await registryProxy.deployed();
  const registryResults = await hre.ethers.provider.waitForTransaction(
    registryProxy.deployTransaction.hash
  );
  console.log("AppRegistry address: ", registryResults.contractAddress);
  console.log("Waiting for verification...");
  const registryImplementation = await getImplementationAddress(
    hre.ethers.provider,
    registryResults.contractAddress
  );
  await registryProxy.deployTransaction.wait(5);
  try {
    console.log("verifying AppRegistry...");
    await hre.run("verify:verify", {
      address: registryImplementation,
      constructorArguments: [],
    });
  } catch (err) {
    console.log("error while verifying", err);
  }

  // Deploy Diamond Implementation
  console.log("Deploying DiamondCollection...");
  const DiamondCollection = new DiamondCollection__factory(deployer);
  const collection = await DiamondCollection.deploy();
  await collection.deployed();
  console.log("DiamondCollection address: ", collection.address);
  console.log("Waiting for verification...");
  await collection.deployTransaction.wait(5);
  try {
    console.log("verifying DiamondCollection...");
    await hre.run("verify:verify", {
      address: collection.address,
      constructorArguments: [],
    });
  } catch (err) {
    console.log("error while verifying", err);
  }

  // Deploy NiftyKit
  console.log("Deploying NiftyKit...");
  const NiftyKit = new NiftyKitV3__factory(deployer);
  const proxy = await hre.upgrades.deployProxy(NiftyKit, [
    registryResults.contractAddress,
    collection.address,
  ]);
  console.log("TX: ", proxy.deployTransaction.hash);
  await proxy.deployed();
  const niftyKitResults = await hre.ethers.provider.waitForTransaction(
    proxy.deployTransaction.hash
  );
  console.log("NiftyKit address: ", niftyKitResults.contractAddress);
  console.log("Waiting for verification...");
  const implementation = await getImplementationAddress(
    hre.ethers.provider,
    niftyKitResults.contractAddress
  );
  await proxy.deployTransaction.wait(5);
  try {
    console.log("verifying NiftyKit...");
    await hre.run("verify:verify", {
      address: implementation,
      constructorArguments: [],
    });
  } catch (err) {
    console.log("error while verifying", err);
  }

  saveArtifacts(
    `${__dirname}/../../../app/contracts/v7`,
    niftyKitResults.contractAddress,
    hre.network.name
  );

  const niftyKit = NiftyKitV3__factory.connect(
    niftyKitResults.contractAddress,
    deployer
  );

  await niftyKit.setSigner("0x7556fcaD2d852bacFE3a7AAc0614018BBe28dEB0");

  // deploy apps and add them to registry
  const appRegistry = NiftyKitAppRegistry__factory.connect(
    registryResults.contractAddress,
    deployer
  );

  // deploy app
  console.log("Deploying DropFacet...");
  const factory = new DropFacet__factory(deployer);
  const facet = await factory.deploy();
  await facet.deployed();
  console.log("DropFacet address: ", facet.address);
  console.log("Waiting for verification...");
  await facet.deployTransaction.wait(5);
  try {
    console.log("verifying DropFacet...");
    await hre.run("verify:verify", {
      address: facet.address,
      constructorArguments: [],
    });
  } catch (err) {
    console.log("error while verifying", err);
  }

  // register app
  console.log("Registering app...");
  const registerAppTx = await appRegistry.registerApp(
    ethers.utils.id("drop"),
    facet.address,
    getInterfaceId(facet.interface),
    getSelectors(facet.interface),
    1
  );

  await registerAppTx.wait();

  console.log("Deploying EditionFacet...");
  const editionFactory = new EditionFacet__factory(deployer);
  const editionFacet = await editionFactory.deploy();
  await editionFacet.deployed();
  console.log("EditionFacet address: ", editionFacet.address);
  console.log("Waiting for verification...");
  await editionFacet.deployTransaction.wait(5);
  try {
    console.log("verifying EditionFacet...");
    await hre.run("verify:verify", {
      address: editionFacet.address,
      constructorArguments: [],
    });
  } catch (err) {
    console.log("error while verifying", err);
  }

  // register app
  console.log("Registering app...");
  const registerEditionAppTx = await appRegistry.registerApp(
    ethers.utils.id("edition"),
    editionFacet.address,
    getInterfaceId(editionFacet.interface),
    getSelectors(editionFacet.interface),
    1
  );

  await registerEditionAppTx.wait();

  console.log("Deploying ApeDropFacet...");
  const apeDropFactory = new ApeDropFacet__factory(deployer);
  const apeDropFacet = await apeDropFactory.deploy();
  await apeDropFacet.deployed();
  console.log("ApeDropFacet address: ", apeDropFacet.address);
  console.log("Waiting for verification...");
  await apeDropFacet.deployTransaction.wait(5);
  try {
    console.log("verifying ApeDropFacet...");
    await hre.run("verify:verify", {
      address: apeDropFacet.address,
      constructorArguments: [],
    });
  } catch (err) {
    console.log("error while verifying", err);
  }

  // register app
  console.log("Registering app...");
  const registerApeAppTx = await appRegistry.registerApp(
    ethers.utils.id("ape"),
    apeDropFacet.address,
    getInterfaceId(apeDropFacet.interface),
    getSelectors(apeDropFacet.interface),
    1
  );

  await registerApeAppTx.wait();

  console.log("Done!");
};

export default deployFn;

deployFn.tags = ["NiftyKit"];
