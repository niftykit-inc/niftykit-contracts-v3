import { expect } from "chai";
import { Signer, Wallet } from "ethers";
import { ethers, network } from "hardhat";
import { DiamondCreatedEvent } from "typechain-types/contracts/NiftyKitV3";
import {
  BaseFacet,
  BaseFacet__factory,
  DropFacet,
  ExampleFacetV2__factory,
  ExampleFacet__factory,
  NiftyKitAppRegistry,
  NiftyKitV3,
  UpgradeFacet,
  UpgradeFacet__factory,
} from "../typechain-types";
import {
  createBaseFacet,
  createDropFacet,
  createExampleFacet,
  createExampleV2Facet,
  createNiftyKitAppRegistry,
  createNiftyKitV3,
  createUpgradeFacet,
  generateSigner,
  getInterfaceId,
  getSelectors,
} from "./utils/niftykit";

describe("UpgradeFacet", function () {
  let accounts: Signer[];
  let appRegistry: NiftyKitAppRegistry;
  let niftyKitV3: NiftyKitV3;
  let dropFacet: DropFacet;
  let baseFacet: BaseFacet;
  let upgradeFacet: UpgradeFacet;
  let signer: Wallet;
  const feeRate = 500;

  before(async function () {
    accounts = await ethers.getSigners();
    appRegistry = await createNiftyKitAppRegistry(accounts[0]);
    dropFacet = await createDropFacet(accounts[0]);
    baseFacet = await createBaseFacet(accounts[0]);
    upgradeFacet = await createUpgradeFacet(accounts[0]);
    signer = generateSigner();
    const exampleFacet = await createExampleFacet(accounts[0]);

    // register base
    await appRegistry.setBase(
      baseFacet.address,
      [
        "0x80ac58cd", // ERC721
        "0x2a55205a", // ERC2981 (royalty)
        "0x7f5828d0", // ERC173 (ownable)
      ],
      getSelectors(baseFacet.interface),
      1
    );

    // register apps
    await appRegistry.registerApp(
      ethers.utils.id("drop"),
      dropFacet.address,
      getInterfaceId(dropFacet.interface),
      getSelectors(dropFacet.interface),
      1
    );

    await appRegistry.registerApp(
      ethers.utils.id("example"),
      exampleFacet.address,
      getInterfaceId(exampleFacet.interface),
      getSelectors(exampleFacet.interface),
      1
    );

    await appRegistry.registerApp(
      ethers.utils.id("upgrade"),
      upgradeFacet.address,
      getInterfaceId(upgradeFacet.interface),
      getSelectors(upgradeFacet.interface),
      1
    );
  });

  beforeEach(async function () {
    niftyKitV3 = await createNiftyKitV3(
      accounts[0],
      appRegistry.address,
      signer.address
    );
  });

  it("should be able to upgrade a Diamond with Drop", async function () {
    const collectionId = "COLLECTION_ID_1";
    const signature = await signer.signMessage(
      ethers.utils.arrayify(
        ethers.utils.solidityKeccak256(
          ["string", "uint96", "uint256"],
          [collectionId, feeRate, network.config.chainId]
        )
      )
    );
    const createDiamondTx = await niftyKitV3.createDiamond(
      collectionId,
      feeRate,
      signature,
      await accounts[0].getAddress(),
      await accounts[0].getAddress(),
      500,
      "NAME",
      "SYMBOL",
      [ethers.utils.id("drop"), ethers.utils.id("upgrade")]
    );
    const createDiamondReceipt = await createDiamondTx.wait();
    const createdEvent = createDiamondReceipt.events?.find(
      (event) => event.event === "DiamondCreated"
    ) as DiamondCreatedEvent;
    const diamondAddress = createdEvent.args[0];

    const upgrade = UpgradeFacet__factory.connect(diamondAddress, accounts[0]);
    const exampleFacet = await createExampleFacet(accounts[0]);
    const exampleV2Facet = await createExampleV2Facet(accounts[0]);
    const base = BaseFacet__factory.connect(diamondAddress, accounts[0]);

    await base["installApp(bytes32,bytes)"](
      ethers.utils.id("example"),
      exampleFacet.interface.encodeFunctionData("initializeExampleFacet", [
        "foo",
      ])
    );

    const example = ExampleFacet__factory.connect(diamondAddress, accounts[0]);

    expect(await example.getFoo()).to.equals("foo");

    // @ts-ignore
    await expect(() => example.getNewField()).to.throw(TypeError);

    // upgrade example
    await appRegistry.registerApp(
      ethers.utils.id("example"),
      exampleV2Facet.address,
      getInterfaceId(exampleV2Facet.interface),
      getSelectors(exampleV2Facet.interface),
      2
    );

    await upgrade.upgradeApps([ethers.utils.id("example")]);

    const exampleV2 = ExampleFacetV2__factory.connect(
      diamondAddress,
      accounts[0]
    );

    expect(await exampleV2.getNewField()).to.equals(0);

    expect(await exampleV2.getFoo()).to.equals("foo V2");
  });
});
