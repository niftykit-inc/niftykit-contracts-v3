import { expect } from "chai";
import { Signer, Wallet } from "ethers";
import { ethers, network } from "hardhat";
import { DiamondCreatedEvent } from "typechain-types/contracts/NiftyKitV3";
import {
  BaseFacet,
  DropFacet,
  DropFacet__factory,
  ExampleFacet__factory,
  NiftyKitAppRegistry,
  NiftyKitV3,
  BaseFacet__factory,
} from "../typechain-types";
import {
  createNiftyKitV3,
  createNiftyKitAppRegistry,
  createDropFacet,
  getInterfaceId,
  getSelectors,
  createExampleFacet,
  generateSigner,
  createBaseFacet,
} from "./utils/niftykit";

describe("NiftyKitV3", function () {
  let accounts: Signer[];
  let appRegistry: NiftyKitAppRegistry;
  let niftyKitV3: NiftyKitV3;
  let baseFacet: BaseFacet;
  let dropFacet: DropFacet;
  let signer: Wallet;
  const feeRate = 500;

  before(async function () {
    accounts = await ethers.getSigners();
    appRegistry = await createNiftyKitAppRegistry(accounts[0]);
    dropFacet = await createDropFacet(accounts[0]);
    baseFacet = await createBaseFacet(accounts[0]);
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

    niftyKitV3 = await createNiftyKitV3(accounts[0], appRegistry.address);
  });

  it("should be not able to create a diamond without a signer", async function () {
    const collectionId = "COLLECTION_ID_1";
    const signature = await signer.signMessage(
      ethers.utils.arrayify(
        ethers.utils.solidityKeccak256(
          ["string", "uint96", "uint256"],
          [collectionId, feeRate, network.config.chainId]
        )
      )
    );

    await expect(
      niftyKitV3.createDiamond(
        collectionId,
        feeRate,
        signature,
        await accounts[0].getAddress(),
        await accounts[0].getAddress(),
        500,
        "NAME",
        "SYMBOL",
        []
      )
    ).to.be.revertedWith("Signer not set");

    await niftyKitV3.setSigner(signer.address);
  });

  it("should be set treasury", async function () {
    expect(await niftyKitV3.treasury()).to.equal(
      await accounts[0].getAddress()
    );

    await niftyKitV3.setTreasury(accounts[1].getAddress());

    expect(await niftyKitV3.treasury()).to.equal(
      await accounts[1].getAddress()
    );
  });

  it("should not be able to get commission on non-existing collections", async function () {
    const collectionId = "COLLECTION_ID_commission_test";
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
      []
    );
    const createDiamondReceipt = await createDiamondTx.wait();
    const createdEvent = createDiamondReceipt.events?.find(
      (event) => event.event === "DiamondCreated"
    ) as DiamondCreatedEvent;

    expect(createdEvent).to.be.a("object");

    const diamondAddress = createdEvent.args[0];
    const [sellerAmount, buyerAmount] = await niftyKitV3.commission(
      diamondAddress,
      10000
    );
    expect(sellerAmount.add(buyerAmount)).to.equal(feeRate);

    await expect(
      niftyKitV3.commission(await accounts[0].getAddress(), 10000)
    ).to.be.revertedWith("Invalid collection");
  });

  it("should not be able to withdraw when empty", async function () {
    await expect(niftyKitV3.withdraw()).to.be.revertedWith(
      "Not enough to withdraw"
    );
  });

  it("should be able to create a diamond", async function () {
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
      []
    );
    const createDiamondReceipt = await createDiamondTx.wait();
    const createdEvent = createDiamondReceipt.events?.find(
      (event) => event.event === "DiamondCreated"
    ) as DiamondCreatedEvent;

    expect(createdEvent).to.be.a("object");

    const diamondAddress = createdEvent.args[0];
    const eventCollectionId = createdEvent.args[1];

    expect(diamondAddress).to.be.a("string");
    expect(eventCollectionId).to.be.equal(collectionId);
  });

  it("should be able to install an app", async function () {
    const collectionId = "COLLECTION_ID_2";
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
      []
    );
    const createDiamondReceipt = await createDiamondTx.wait();
    const createdEvent = createDiamondReceipt.events?.find(
      (event) => event.event === "DiamondCreated"
    ) as DiamondCreatedEvent;
    const diamondAddress = createdEvent.args[0];

    const base = BaseFacet__factory.connect(diamondAddress, accounts[0]);
    expect(await base.name()).to.equals("NAME");
    expect(await base.symbol()).to.equals("SYMBOL");

    // install apps
    await base["installApp(bytes32)"](ethers.utils.id("drop"));
    await base["installApp(bytes32)"](ethers.utils.id("example"));

    // must use corresponding facets
    const dropFacet = DropFacet__factory.connect(diamondAddress, accounts[0]);
    expect(await base.totalSupply()).to.equals(0);
    await dropFacet.batchAirdrop([1], [await accounts[0].getAddress()]);
    expect(await base.totalSupply()).to.equals(1);

    const exampleFacet = ExampleFacet__factory.connect(
      diamondAddress,
      accounts[0]
    );
    await exampleFacet.setFoo("boo");
    expect(await exampleFacet.getFoo()).to.equals("boo");

    await base.setBaseURI("foo");
    expect(await base.tokenURI(1)).to.equals("foo1");

    expect((await base.getApp(ethers.utils.id("drop"))).version).to.equals(1);
    expect((await base.getApp(ethers.utils.id("example"))).version).to.equals(
      1
    );
    expect(
      (await base.getApp(ethers.utils.id("non-existing"))).version
    ).to.equals(0);
  });

  it("should be able to remove an app", async function () {
    const collectionId = "COLLECTION_ID_3";
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
      []
    );
    const createDiamondReceipt = await createDiamondTx.wait();
    const createdEvent = createDiamondReceipt.events?.find(
      (event) => event.event === "DiamondCreated"
    ) as DiamondCreatedEvent;
    const diamondAddress = createdEvent.args[0];

    const base = BaseFacet__factory.connect(diamondAddress, accounts[0]);
    expect(await base.name()).to.equals("NAME");
    expect(await base.symbol()).to.equals("SYMBOL");

    // install apps
    await base["installApp(bytes32)"](ethers.utils.id("drop"));
    await base["installApp(bytes32)"](ethers.utils.id("example"));

    // must use corresponding facets
    const dropFacet = DropFacet__factory.connect(diamondAddress, accounts[0]);
    expect(await base.totalSupply()).to.equals(0);
    await dropFacet.batchAirdrop([1], [await accounts[0].getAddress()]);
    expect(await base.totalSupply()).to.equals(1);

    const exampleFacet = ExampleFacet__factory.connect(
      diamondAddress,
      accounts[0]
    );
    await exampleFacet.setFoo("boo");
    expect(await exampleFacet.getFoo()).to.equals("boo");

    await base.setBaseURI("foo");
    expect(await base.tokenURI(1)).to.equals("foo1");

    await base["removeApp(bytes32)"](ethers.utils.id("example"));

    await expect(exampleFacet.setFoo("boo")).to.be.revertedWith("");
  });

  it("should be able to install an app during creation", async function () {
    const collectionId = "COLLECTION_ID_4";
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
      [ethers.utils.id("drop")]
    );
    const createDiamondReceipt = await createDiamondTx.wait();
    const createdEvent = createDiamondReceipt.events?.find(
      (event) => event.event === "DiamondCreated"
    ) as DiamondCreatedEvent;
    const diamondAddress = createdEvent.args[0];

    const base = BaseFacet__factory.connect(diamondAddress, accounts[0]);
    expect(await base.name()).to.equals("NAME");
    expect(await base.symbol()).to.equals("SYMBOL");

    // install apps
    await base["installApp(bytes32)"](ethers.utils.id("example"));

    // must use corresponding facets
    const dropFacet = DropFacet__factory.connect(diamondAddress, accounts[0]);
    expect(await base.totalSupply()).to.equals(0);
    await dropFacet.batchAirdrop([1], [await accounts[0].getAddress()]);
    expect(await base.totalSupply()).to.equals(1);

    const exampleFacet = ExampleFacet__factory.connect(
      diamondAddress,
      accounts[0]
    );
    await exampleFacet.setFoo("boo");
    expect(await exampleFacet.getFoo()).to.equals("boo");

    await base.setBaseURI("foo");
    expect(await base.tokenURI(1)).to.equals("foo1");
  });

  it("should be able to install multiple apps during creation", async function () {
    const collectionId = "COLLECTION_ID_5";
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
      [ethers.utils.id("drop"), ethers.utils.id("example")]
    );
    const createDiamondReceipt = await createDiamondTx.wait();
    const createdEvent = createDiamondReceipt.events?.find(
      (event) => event.event === "DiamondCreated"
    ) as DiamondCreatedEvent;
    const diamondAddress = createdEvent.args[0];

    const base = BaseFacet__factory.connect(diamondAddress, accounts[0]);
    expect(await base.name()).to.equals("NAME");
    expect(await base.symbol()).to.equals("SYMBOL");

    // must use corresponding facets
    const dropFacet = DropFacet__factory.connect(diamondAddress, accounts[0]);
    expect(await base.totalSupply()).to.equals(0);
    await dropFacet.batchAirdrop([1], [await accounts[0].getAddress()]);
    expect(await base.totalSupply()).to.equals(1);

    const exampleFacet = ExampleFacet__factory.connect(
      diamondAddress,
      accounts[0]
    );
    await exampleFacet.setFoo("boo");
    expect(await exampleFacet.getFoo()).to.equals("boo");

    await base.setBaseURI("foo");
    expect(await base.tokenURI(1)).to.equals("foo1");
  });

  it("should be able to install an app with initializer", async function () {
    const collectionId = "COLLECTION_ID_6";
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
      []
    );
    const createDiamondReceipt = await createDiamondTx.wait();
    const createdEvent = createDiamondReceipt.events?.find(
      (event) => event.event === "DiamondCreated"
    ) as DiamondCreatedEvent;
    const diamondAddress = createdEvent.args[0];

    const base = BaseFacet__factory.connect(diamondAddress, accounts[0]);
    expect(await base.name()).to.equals("NAME");
    expect(await base.symbol()).to.equals("SYMBOL");

    const exampleFacet = ExampleFacet__factory.connect(
      diamondAddress,
      accounts[0]
    );

    // install apps
    await base["installApp(bytes32)"](ethers.utils.id("drop"));

    // install with initializer
    await base["installApp(bytes32,bytes)"](
      ethers.utils.id("example"),
      exampleFacet.interface.encodeFunctionData("initializeExampleFacet", [
        "coo",
      ])
    );

    expect(await exampleFacet.getFoo()).to.equals("coo");

    // must use corresponding facets
    const dropFacet = DropFacet__factory.connect(diamondAddress, accounts[0]);
    expect(await base.totalSupply()).to.equals(0);
    await dropFacet.batchAirdrop([1], [await accounts[0].getAddress()]);
    expect(await base.totalSupply()).to.equals(1);

    await exampleFacet.setFoo("boo");
    expect(await exampleFacet.getFoo()).to.equals("boo");

    await base.setBaseURI("foo");
    expect(await base.tokenURI(1)).to.equals("foo1");

    // uninstall app
    await base["removeApp(bytes32,bytes)"](
      ethers.utils.id("example"),
      exampleFacet.interface.encodeFunctionData("finalizeExampleFacet")
    );
  });

  it("should not be able to create multiple diamonds for the same collection", async function () {
    const collectionId = "COLLECTION_ID_7";
    const signature = await signer.signMessage(
      ethers.utils.arrayify(
        ethers.utils.solidityKeccak256(
          ["string", "uint96", "uint256"],
          [collectionId, feeRate, network.config.chainId]
        )
      )
    );
    // first attempt should work
    await niftyKitV3.createDiamond(
      collectionId,
      feeRate,
      signature,
      await accounts[0].getAddress(),
      await accounts[0].getAddress(),
      500,
      "NAME",
      "SYMBOL",
      []
    );

    // second attempt should fail

    await expect(
      niftyKitV3.createDiamond(
        collectionId,
        feeRate,
        signature,
        await accounts[0].getAddress(),
        await accounts[0].getAddress(),
        500,
        "NAME",
        "SYMBOL",
        []
      )
    ).to.be.revertedWith("Already created");
  });

  it("should not be able to create diamond with invalid signature", async function () {
    const collectionId = "COLLECTION_ID_8";
    const signature = await accounts[0].signMessage(
      ethers.utils.arrayify(
        ethers.utils.solidityKeccak256(
          ["string", "uint96", "uint256"],
          [collectionId, feeRate, network.config.chainId]
        )
      )
    );

    await expect(
      niftyKitV3.createDiamond(
        collectionId,
        feeRate,
        signature,
        await accounts[0].getAddress(),
        await accounts[0].getAddress(),
        500,
        "NAME",
        "SYMBOL",
        []
      )
    ).to.be.revertedWith("Invalid signature");
  });

  it("should be able to install app with initializer multiple times", async function () {
    const collectionId = "COLLECTION_ID_9";
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
      []
    );
    const createDiamondReceipt = await createDiamondTx.wait();
    const createdEvent = createDiamondReceipt.events?.find(
      (event) => event.event === "DiamondCreated"
    ) as DiamondCreatedEvent;
    const diamondAddress = createdEvent.args[0];

    const base = BaseFacet__factory.connect(diamondAddress, accounts[0]);
    expect(await base.name()).to.equals("NAME");
    expect(await base.symbol()).to.equals("SYMBOL");

    const exampleFacet = ExampleFacet__factory.connect(
      diamondAddress,
      accounts[0]
    );

    // install with initializer
    await base["installApp(bytes32,bytes)"](
      ethers.utils.id("example"),
      exampleFacet.interface.encodeFunctionData("initializeExampleFacet", [
        "coo",
      ])
    );

    expect(await exampleFacet.getFoo()).to.equals("coo");

    // uninstall app
    await base["removeApp(bytes32,bytes)"](
      ethers.utils.id("example"),
      exampleFacet.interface.encodeFunctionData("finalizeExampleFacet")
    );

    await expect(exampleFacet.getFoo()).to.be.revertedWith(
      "Diamond: Function does not exist"
    );

    // install with initializer again
    await base["installApp(bytes32,bytes)"](
      ethers.utils.id("example"),
      exampleFacet.interface.encodeFunctionData("initializeExampleFacet", [
        "coo",
      ])
    );

    expect(await exampleFacet.getFoo()).to.equals("coo");
  });

  it("should be able to set a new signer", async function () {
    const collectionId = "COLLECTION_ID_signer_test";
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
      [ethers.utils.id("drop")]
    );
    const createDiamondReceipt = await createDiamondTx.wait();
    const createdEvent = createDiamondReceipt.events?.find(
      (event) => event.event === "DiamondCreated"
    ) as DiamondCreatedEvent;
    expect(createdEvent).to.be.a("object");

    await niftyKitV3.setSigner(await accounts[2].getAddress());

    const newCollectionId = "COLLECTION_ID_signer_test_2";
    const newSignature = await accounts[2].signMessage(
      ethers.utils.arrayify(
        ethers.utils.solidityKeccak256(
          ["string", "uint96", "uint256"],
          [newCollectionId, feeRate, network.config.chainId]
        )
      )
    );
    const newCreateDiamondTx = await niftyKitV3.createDiamond(
      newCollectionId,
      feeRate,
      newSignature,
      await accounts[0].getAddress(),
      await accounts[0].getAddress(),
      500,
      "NAME",
      "SYMBOL",
      [ethers.utils.id("drop")]
    );
    const newCreateDiamondReceipt = await newCreateDiamondTx.wait();
    const newCreatedEvent = newCreateDiamondReceipt.events?.find(
      (event) => event.event === "DiamondCreated"
    ) as DiamondCreatedEvent;
    expect(newCreatedEvent).to.be.a("object");
  });

  it("should be able to set a custom rate for the collection", async function () {
    const collectionId = "COLLECTION_ID_custom_rate_test";
    const signature = await accounts[2].signMessage(
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
      [ethers.utils.id("drop")]
    );
    const createDiamondReceipt = await createDiamondTx.wait();
    const createdEvent = createDiamondReceipt.events?.find(
      (event) => event.event === "DiamondCreated"
    ) as DiamondCreatedEvent;
    expect(createdEvent).to.be.a("object");
    const diamondAddress = createdEvent.args[0];

    const [sellerAmount, buyerAmount] = await niftyKitV3.commission(
      diamondAddress,
      10000
    );

    expect(sellerAmount.add(buyerAmount)).to.equal(feeRate);

    const newFeeRate = 1000;

    // test for invalid collections
    await expect(
      niftyKitV3.setRate(await accounts[0].getAddress(), newFeeRate)
    ).to.be.revertedWith("Does not exist");

    await niftyKitV3.setRate(diamondAddress, newFeeRate);

    const [newSellerAmount, newBuyerAmount] = await niftyKitV3.commission(
      diamondAddress,
      10000
    );
    expect(newSellerAmount.add(newBuyerAmount)).to.equal(newFeeRate);
  });
});
