import fs from "fs";
import { ethers } from "ethers";
import { getImplementationAddress } from "@openzeppelin/upgrades-core";
import { HardhatRuntimeEnvironment } from "hardhat/types";
import {
  ApeDropFacet__factory,
  BaseFacet__factory,
  BlockTokensFacet__factory,
  DropFacet__factory,
  EditionFacet__factory,
  NiftyKitAppRegistry__factory,
  NiftyKitV3__factory,
  OperatorControlsFacet__factory,
  RoyaltyControlsFacet__factory,
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
  const signer = process.env.SIGNER;
  if (!signer || !hre.ethers.utils.isAddress(signer)) {
    throw new Error("SIGNER env variable is not set or is not a valid address");
  }

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

  // Deploy NiftyKit
  console.log("Deploying NiftyKit...");
  const NiftyKit = new NiftyKitV3__factory(deployer);
  const proxy = await hre.upgrades.deployProxy(NiftyKit, [
    registryResults.contractAddress,
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

  await niftyKit.setSigner(signer);

  // deploy apps and add them to registry
  const appRegistry = NiftyKitAppRegistry__factory.connect(
    registryResults.contractAddress,
    deployer
  );

  // deploy core
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
    1
  );

  await setBaseTx.wait();

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

  const network = hre.network.name;
  const mainnet = ["mainnet", "goerli"];
  if (mainnet.includes(network)) {
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
  }

  console.log("Deploying BlockTokensFacet...");
  const blockTokensFactory = new BlockTokensFacet__factory(deployer);
  const blockTokens = await blockTokensFactory.deploy();
  await blockTokens.deployed();
  console.log("BlockTokensFacet address: ", blockTokens.address);
  console.log("Waiting for verification...");
  await blockTokens.deployTransaction.wait(5);
  try {
    console.log("verifying BlockTokensFacet...");
    await hre.run("verify:verify", {
      address: blockTokens.address,
      constructorArguments: [],
    });
  } catch (err) {
    console.log("error while verifying", err);
  }

  // register app
  console.log("Registering app...");
  const registerBlockTokensApp = await appRegistry.registerApp(
    ethers.utils.id("blockTokens"),
    blockTokens.address,
    getInterfaceId(blockTokens.interface),
    getSelectors(blockTokens.interface),
    1
  );

  await registerBlockTokensApp.wait();

  console.log("Deploying OperatorControlsFacet...");
  const operatorControlsFactory = new OperatorControlsFacet__factory(deployer);
  const operatorControls = await operatorControlsFactory.deploy();
  await operatorControls.deployed();
  console.log("OperatorControlsFacet address: ", operatorControls.address);
  console.log("Waiting for verification...");
  await operatorControls.deployTransaction.wait(5);
  try {
    console.log("verifying OperatorControlsFacet...");
    await hre.run("verify:verify", {
      address: operatorControls.address,
      constructorArguments: [],
    });
  } catch (err) {
    console.log("error while verifying", err);
  }

  // register app
  console.log("Registering app...");
  const registerOperatorControlsApp = await appRegistry.registerApp(
    ethers.utils.id("operatorControls"),
    operatorControls.address,
    getInterfaceId(operatorControls.interface),
    getSelectors(operatorControls.interface),
    1
  );

  await registerOperatorControlsApp.wait();

  console.log("Deploying RoyaltyControlsFacet...");
  const royaltyControlsFactory = new RoyaltyControlsFacet__factory(deployer);
  const royaltyControls = await royaltyControlsFactory.deploy();
  await royaltyControls.deployed();
  console.log("RoyaltyControlsFacet address: ", royaltyControls.address);
  console.log("Waiting for verification...");
  await royaltyControls.deployTransaction.wait(5);
  try {
    console.log("verifying RoyaltyControlsFacet...");
    await hre.run("verify:verify", {
      address: royaltyControls.address,
      constructorArguments: [],
    });
  } catch (err) {
    console.log("error while verifying", err);
  }

  // register app
  console.log("Registering app...");
  const registerRoyaltyControlsTx = await appRegistry.registerApp(
    ethers.utils.id("royaltyControls"),
    royaltyControls.address,
    getInterfaceId(royaltyControls.interface),
    getSelectors(royaltyControls.interface),
    1
  );

  await registerRoyaltyControlsTx.wait();

  console.log("Done!");
};

export default deployFn;

deployFn.tags = ["NiftyKit"];
