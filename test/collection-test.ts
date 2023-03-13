import { expect } from "chai";
import { Signer, Wallet } from "ethers";
import { ethers, network } from "hardhat";
import { DiamondCreatedEvent } from "typechain-types/contracts/NiftyKitV3";
import {
  BlockTokensFacet,
  BlockTokensFacet__factory,
  BaseFacet,
  BaseFacet__factory,
  DropFacet,
  DropFacet__factory,
  NiftyKitAppRegistry,
  NiftyKitV3,
  OperatorControlsFacet,
  OperatorControlsFacet__factory,
} from "../typechain-types";
import {
  createNiftyKitV3,
  createNiftyKitAppRegistry,
  createDropFacet,
  getInterfaceId,
  getSelectors,
  createExampleFacet,
  generateSigner,
  createMockOperator,
  createBaseFacet,
  createOperatorControlsFacet,
  createBlockTokensFacet,
} from "./utils/niftykit";

const salesParam = [200, 150, 100, ethers.utils.parseEther("0.01")] as const;

describe("DiamondCollection", function () {
  let accounts: Signer[];
  let appRegistry: NiftyKitAppRegistry;
  let niftyKitV3: NiftyKitV3;
  let dropFacet: DropFacet;
  let baseFacet: BaseFacet;
  let operatorControlsFacet: OperatorControlsFacet;
  let blockTokensFacet: BlockTokensFacet;
  let signer: Wallet;
  const feeRate = 500;

  before(async function () {
    accounts = await ethers.getSigners();
    appRegistry = await createNiftyKitAppRegistry(accounts[0]);
    dropFacet = await createDropFacet(accounts[0]);
    baseFacet = await createBaseFacet(accounts[0]);
    operatorControlsFacet = await createOperatorControlsFacet(accounts[0]);
    blockTokensFacet = await createBlockTokensFacet(accounts[0]);
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
      getSelectors(baseFacet.interface)
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
      ethers.utils.id("operatorControls"),
      operatorControlsFacet.address,
      getInterfaceId(operatorControlsFacet.interface),
      getSelectors(operatorControlsFacet.interface),
      1
    );

    await appRegistry.registerApp(
      ethers.utils.id("blockTokens"),
      blockTokensFacet.address,
      getInterfaceId(blockTokensFacet.interface),
      getSelectors(blockTokensFacet.interface),
      1
    );

    niftyKitV3 = await createNiftyKitV3(
      accounts[0],
      appRegistry.address,
      signer.address
    );
  });

  beforeEach(async function () {
    niftyKitV3 = await createNiftyKitV3(
      accounts[0],
      appRegistry.address,
      signer.address
    );
  });

  it("should be set treasury", async function () {
    const collectionId = "COLLECTION_ID_treasury_test";
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

    expect(await base.treasury()).to.equal(await accounts[0].getAddress());

    await base.setTreasury(accounts[1].getAddress());

    expect(await base.treasury()).to.equal(await accounts[1].getAddress());
  });

  it("should be able to withdraw after sale", async function () {
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
      [ethers.utils.id("drop")]
    );
    const createDiamondReceipt = await createDiamondTx.wait();
    const createdEvent = createDiamondReceipt.events?.find(
      (event) => event.event === "DiamondCreated"
    ) as DiamondCreatedEvent;
    const diamondAddress = createdEvent.args[0];
    const dropCollection = DropFacet__factory.connect(
      diamondAddress,
      accounts[0]
    );
    const base = BaseFacet__factory.connect(diamondAddress, accounts[0]);
    expect(await dropCollection.saleActive()).to.be.false;

    await dropCollection.startSale(...salesParam, false);

    expect(await dropCollection.saleActive()).to.be.true;

    await expect(base.withdraw()).to.be.revertedWith("0 balance");

    const txMint = await dropCollection
      .connect(accounts[1])
      .mintTo(await accounts[1].getAddress(), 2, {
        value: salesParam[3].mul(2),
      });
    const txMintReceipt = await txMint.wait();
    const transferEvent = txMintReceipt.events?.find(
      (event) => event.event === "Transfer"
    );

    expect(transferEvent).to.be.a("object");

    expect(await dropCollection.dropRevenue()).to.equal(salesParam[3].mul(2));

    await base.withdraw();
  });

  it("should be override tokenURI", async function () {
    const collectionId = "COLLECTION_ID_override_tokenURI";
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
    const dropCollection = DropFacet__factory.connect(
      diamondAddress,
      accounts[0]
    );
    const base = BaseFacet__factory.connect(diamondAddress, accounts[0]);

    expect(await dropCollection.saleActive()).to.be.false;

    await dropCollection.startSale(...salesParam, false);

    expect(await dropCollection.saleActive()).to.be.true;

    const txMint = await dropCollection
      .connect(accounts[1])
      .mintTo(await accounts[1].getAddress(), 2, {
        value: salesParam[3].mul(2),
      });
    const txMintReceipt = await txMint.wait();
    const transferEvent = txMintReceipt.events?.find(
      (event) => event.event === "Transfer"
    );

    expect(transferEvent).to.be.a("object");

    expect(await dropCollection.dropRevenue()).to.equal(salesParam[3].mul(2));

    expect(await base.tokenURI(1)).to.equal("");

    await base.setBaseURI("foo");
    expect(await base.tokenURI(1)).to.equal("foo1");

    expect(await base.tokenURI(2)).to.equal("foo2");

    await expect(base.tokenURI(3)).to.be.revertedWith(
      "URIQueryForNonexistentToken()"
    );
  });

  it("should be set operator filter", async function () {
    const collectionId = "COLLECTION_ID_operator_filter";
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
      [ethers.utils.id("drop"), ethers.utils.id("operatorControls")]
    );
    const createDiamondReceipt = await createDiamondTx.wait();
    const createdEvent = createDiamondReceipt.events?.find(
      (event) => event.event === "DiamondCreated"
    ) as DiamondCreatedEvent;
    const diamondAddress = createdEvent.args[0];
    const operatorControls = OperatorControlsFacet__factory.connect(
      diamondAddress,
      accounts[0]
    );

    expect(await operatorControls.operatorFilteringEnabled()).to.be.false;
    await operatorControls.setOperatorFilteringEnabled(true);
    expect(await operatorControls.operatorFilteringEnabled()).to.be.true;
    await operatorControls.setOperatorFilteringEnabled(false);
    expect(await operatorControls.operatorFilteringEnabled()).to.be.false;
  });

  it("should be set transfer status: block all", async function () {
    const collectionId = "COLLECTION_ID_transfer_status_block_all";
    const mockOperator = await createMockOperator(accounts[0]);
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
      [ethers.utils.id("drop"), ethers.utils.id("operatorControls")]
    );
    const createDiamondReceipt = await createDiamondTx.wait();
    const createdEvent = createDiamondReceipt.events?.find(
      (event) => event.event === "DiamondCreated"
    ) as DiamondCreatedEvent;
    const diamondAddress = createdEvent.args[0];
    const dropCollection = DropFacet__factory.connect(
      diamondAddress,
      accounts[0]
    );
    const base = BaseFacet__factory.connect(diamondAddress, accounts[0]);

    expect(await dropCollection.saleActive()).to.be.false;

    await dropCollection.startSale(...salesParam, false);

    expect(await dropCollection.saleActive()).to.be.true;

    const txMint = await dropCollection
      .connect(accounts[1])
      .mintTo(await accounts[1].getAddress(), 3, {
        value: salesParam[3].mul(3),
      });
    const txMintReceipt = await txMint.wait();
    const transferEvent = txMintReceipt.events?.find(
      (event) => event.event === "Transfer"
    );
    expect(transferEvent).to.be.a("object");

    // Transfer tokenId 1
    await base
      .connect(accounts[1])
      ["safeTransferFrom(address,address,uint256)"](
        await accounts[1].getAddress(),
        await accounts[2].getAddress(),
        1
      );

    expect(
      await base
        .connect(accounts[1])
        .isApprovedForAll(await accounts[1].getAddress(), mockOperator.address)
    ).to.be.false;

    // approve the operator
    base.connect(accounts[1]).setApprovalForAll(mockOperator.address, true);

    mockOperator
      .connect(accounts[1])
      .mockTransfer(
        dropCollection.address,
        await accounts[1].getAddress(),
        await accounts[2].getAddress(),
        2
      );

    const operatorControls = OperatorControlsFacet__factory.connect(
      diamondAddress,
      accounts[0]
    );

    // Block all
    await operatorControls.setTransferStatus(2);

    await expect(
      base
        .connect(accounts[1])
        ["safeTransferFrom(address,address,uint256)"](
          await accounts[1].getAddress(),
          await accounts[2].getAddress(),
          3
        )
    ).to.be.revertedWith("Transfers not allowed");

    await expect(
      mockOperator
        .connect(accounts[1])
        .mockTransfer(
          dropCollection.address,
          await accounts[1].getAddress(),
          await accounts[2].getAddress(),
          3
        )
    ).to.be.revertedWith("Transfers not allowed");

    // Allow all
    await operatorControls.setTransferStatus(0);

    await base
      .connect(accounts[1])
      ["safeTransferFrom(address,address,uint256)"](
        await accounts[1].getAddress(),
        await accounts[2].getAddress(),
        3
      );
  });

  it("should be set transfer status: allowed operators only", async function () {
    const collectionId = "COLLECTION_ID_allowed_operators";
    const mockOperator = await createMockOperator(accounts[0]);
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
      [ethers.utils.id("drop"), ethers.utils.id("operatorControls")]
    );
    const createDiamondReceipt = await createDiamondTx.wait();
    const createdEvent = createDiamondReceipt.events?.find(
      (event) => event.event === "DiamondCreated"
    ) as DiamondCreatedEvent;
    const diamondAddress = createdEvent.args[0];
    const dropCollection = DropFacet__factory.connect(
      diamondAddress,
      accounts[0]
    );
    const base = BaseFacet__factory.connect(diamondAddress, accounts[0]);

    expect(await dropCollection.saleActive()).to.be.false;

    await dropCollection.startSale(...salesParam, false);

    expect(await dropCollection.saleActive()).to.be.true;

    const txMint = await dropCollection
      .connect(accounts[1])
      .mintTo(await accounts[1].getAddress(), 4, {
        value: salesParam[3].mul(4),
      });
    const txMintReceipt = await txMint.wait();
    const transferEvent = txMintReceipt.events?.find(
      (event) => event.event === "Transfer"
    );
    expect(transferEvent).to.be.a("object");

    // Transfer tokenId 1
    await base
      .connect(accounts[1])
      ["safeTransferFrom(address,address,uint256)"](
        await accounts[1].getAddress(),
        await accounts[2].getAddress(),
        1
      );

    const operatorControls = OperatorControlsFacet__factory.connect(
      diamondAddress,
      accounts[0]
    );

    // Allowed Operators only, but transfers should be allowed
    await operatorControls.setTransferStatus(1);

    await base
      .connect(accounts[1])
      ["safeTransferFrom(address,address,uint256)"](
        await accounts[1].getAddress(),
        await accounts[2].getAddress(),
        2
      );

    expect(
      await operatorControls
        .connect(accounts[1])
        .isAllowedOperator(mockOperator.address)
    ).to.be.false;

    expect(
      await base
        .connect(accounts[1])
        .isApprovedForAll(await accounts[1].getAddress(), mockOperator.address)
    ).to.be.false;

    // should fail from approving
    await expect(
      base.connect(accounts[1]).setApprovalForAll(mockOperator.address, true)
    ).to.be.revertedWith("Transfers not allowed");

    await expect(
      base.connect(accounts[1]).approve(mockOperator.address, 3)
    ).to.be.revertedWith("Transfers not allowed");

    await expect(
      mockOperator
        .connect(accounts[1])
        .mockTransfer(
          dropCollection.address,
          await accounts[1].getAddress(),
          await accounts[2].getAddress(),
          3
        )
    ).to.be.revertedWith("Transfers not allowed");

    // should allow
    await operatorControls.setAllowedOperator(mockOperator.address, true);

    expect(
      await operatorControls
        .connect(accounts[1])
        .isAllowedOperator(mockOperator.address)
    ).to.be.true;

    expect(
      await base
        .connect(accounts[1])
        .isApprovedForAll(await accounts[1].getAddress(), mockOperator.address)
    ).to.be.true;

    // shouldn't revert, and allow priority
    mockOperator
      .connect(accounts[1])
      .mockTransfer(
        dropCollection.address,
        await accounts[1].getAddress(),
        await accounts[2].getAddress(),
        3
      );
  });

  it("should be able to block specific tokens", async function () {
    const collectionId = "COLLECTION_ID_transfer_status_block_specific";
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
      [
        ethers.utils.id("drop"),
        ethers.utils.id("operatorControls"),
        ethers.utils.id("blockTokens"),
      ]
    );
    const createDiamondReceipt = await createDiamondTx.wait();
    const createdEvent = createDiamondReceipt.events?.find(
      (event) => event.event === "DiamondCreated"
    ) as DiamondCreatedEvent;
    const diamondAddress = createdEvent.args[0];
    const dropCollection = DropFacet__factory.connect(
      diamondAddress,
      accounts[0]
    );
    const base = BaseFacet__factory.connect(diamondAddress, accounts[0]);

    expect(await dropCollection.saleActive()).to.be.false;

    await dropCollection.startSale(...salesParam, false);

    expect(await dropCollection.saleActive()).to.be.true;

    const txMint = await dropCollection
      .connect(accounts[1])
      .mintTo(await accounts[1].getAddress(), 5, {
        value: salesParam[3].mul(5),
      });
    const txMintReceipt = await txMint.wait();
    const transferEvent = txMintReceipt.events?.find(
      (event) => event.event === "Transfer"
    );
    expect(transferEvent).to.be.a("object");

    // Transfer tokenId 1
    await base
      .connect(accounts[1])
      ["safeTransferFrom(address,address,uint256)"](
        await accounts[1].getAddress(),
        await accounts[2].getAddress(),
        1
      );

    // should work
    await base
      .connect(accounts[1])
      ["safeTransferFrom(address,address,uint256)"](
        await accounts[1].getAddress(),
        await accounts[2].getAddress(),
        2
      );

    const blockTokens = BlockTokensFacet__factory.connect(
      diamondAddress,
      accounts[0]
    );
    // block 3
    expect(await blockTokens.isBlockedTokenId(3)).to.be.false;
    await blockTokens.setBlockedTokenId(3, true);
    expect(await blockTokens.isBlockedTokenId(3)).to.be.true;

    await expect(
      base
        .connect(accounts[1])
        ["safeTransferFrom(address,address,uint256)"](
          await accounts[1].getAddress(),
          await accounts[2].getAddress(),
          3
        )
    ).to.be.revertedWith("Transfers not allowed");
  });
});
