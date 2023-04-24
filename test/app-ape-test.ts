import { expect } from "chai";
import { Signer, Wallet } from "ethers";
import { ethers, network } from "hardhat";
import { DiamondCreatedEvent } from "typechain-types/contracts/NiftyKitV3";
import {
  ApeDropFacet,
  ApeDropFacet__factory,
  BaseFacet,
  BaseFacet__factory,
  DropFacet,
  DropFacet__factory,
  MockERC20,
  NiftyKitAppRegistry,
  NiftyKitV3,
} from "../typechain-types";
import { getMerkleTree } from "./utils/merkle-tree";
import {
  createNiftyKitV3,
  createNiftyKitAppRegistry,
  createDropFacet,
  getInterfaceId,
  getSelectors,
  createApeCoinFacet,
  createMockERC20,
  generateSigner,
  createBaseFacet,
} from "./utils/niftykit";

const salesParam = [200, 150, 100, ethers.utils.parseEther("0.01")] as const;

describe("ApeDropFacet", function () {
  let accounts: Signer[];
  let appRegistry: NiftyKitAppRegistry;
  let niftyKitV3: NiftyKitV3;
  let dropFacet: DropFacet;
  let apeDropFacet: ApeDropFacet;
  let baseFacet: BaseFacet;
  let apeCoin: MockERC20;
  let signer: Wallet;
  const feeRate = 500;

  before(async function () {
    accounts = await ethers.getSigners();
    appRegistry = await createNiftyKitAppRegistry(accounts[0]);
    dropFacet = await createDropFacet(accounts[0]);
    apeDropFacet = await createApeCoinFacet(accounts[0]);
    baseFacet = await createBaseFacet(accounts[0]);
    apeCoin = await createMockERC20(accounts[0]);
    signer = generateSigner();

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
      ethers.utils.id("ape"),
      apeDropFacet.address,
      getInterfaceId(apeDropFacet.interface),
      getSelectors(apeDropFacet.interface),
      1
    );

    niftyKitV3 = await createNiftyKitV3(
      accounts[0],
      appRegistry.address,
      signer.address
    );
  });

  it("should be able to create a Diamond with Drop and ApeDrop apps", async function () {
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
      [ethers.utils.id("drop")]
    );
    const createDiamondReceipt = await createDiamondTx.wait();
    const createdEvent = createDiamondReceipt.events?.find(
      (event) => event.event === "DiamondCreated"
    ) as DiamondCreatedEvent;
    const diamondAddress = createdEvent!.args[0];

    const base = BaseFacet__factory.connect(diamondAddress, accounts[0]);
    const apeDropCollection = ApeDropFacet__factory.connect(
      diamondAddress,
      accounts[0]
    );
    expect(await base.owner()).to.eq(await accounts[0].getAddress());

    await base["installApp(bytes32,bytes)"](
      ethers.utils.id("ape"),
      apeDropCollection.interface.encodeFunctionData("initializeApeDrop", [
        apeCoin.address,
      ])
    );

    expect(await apeDropCollection.apePrice()).to.equals(
      ethers.utils.parseEther("0")
    );
  });

  it("should be able to start the sale with ape coin", async function () {
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
      [ethers.utils.id("drop")]
    );
    const createDiamondReceipt = await createDiamondTx.wait();
    const createdEvent = createDiamondReceipt.events?.find(
      (event) => event.event === "DiamondCreated"
    ) as DiamondCreatedEvent;
    const diamondAddress = createdEvent!.args[0];
    const base = BaseFacet__factory.connect(diamondAddress, accounts[0]);

    const apeDropCollection = ApeDropFacet__factory.connect(
      diamondAddress,
      accounts[0]
    );

    await base["installApp(bytes32,bytes)"](
      ethers.utils.id("ape"),
      apeDropFacet.interface.encodeFunctionData("initializeApeDrop", [
        apeCoin.address,
      ])
    );

    expect(await apeDropCollection.apeSaleActive()).to.be.false;
    await apeDropCollection.apeStartSale(...salesParam, false);
    expect(await apeDropCollection.apeSaleActive()).to.be.true;
  });

  it("should be able to mint with ape coin", async function () {
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
    const diamondAddress = createdEvent!.args[0];
    const base = BaseFacet__factory.connect(diamondAddress, accounts[0]);
    const apeDropCollection = ApeDropFacet__factory.connect(
      diamondAddress,
      accounts[0]
    );

    await base["installApp(bytes32,bytes)"](
      ethers.utils.id("ape"),
      apeDropFacet.interface.encodeFunctionData("initializeApeDrop", [
        apeCoin.address,
      ])
    );

    expect(await apeDropCollection.apeSaleActive()).to.be.false;

    await apeDropCollection.apeStartSale(...salesParam, false);

    expect(await apeDropCollection.apeSaleActive()).to.be.true;

    // send erc20 funds to accounts[1]
    await apeCoin.mint(
      await accounts[1].getAddress(),
      ethers.utils.parseEther("10")
    );

    // approve apeDropCollection to spend erc20 funds
    await apeCoin
      .connect(accounts[1])
      .increaseAllowance(apeDropCollection.address, salesParam[3].mul(2));

    // mint
    const txMint = await apeDropCollection
      .connect(accounts[1])
      .apeMintTo(await accounts[1].getAddress(), 2, {
        value: salesParam[3].mul(2),
      });
    const txMintReceipt = await txMint.wait();
    const transferEvent = txMintReceipt.events?.find(
      (event) => event.event === "Transfer"
    );

    expect(transferEvent).to.be.a("object");
  });

  it("should be able to presale mint with ape coin", async function () {
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
    const diamondAddress = createdEvent!.args[0];
    const dropCollection = DropFacet__factory.connect(
      diamondAddress,
      accounts[0]
    );
    const base = BaseFacet__factory.connect(diamondAddress, accounts[0]);
    const apeDropCollection = ApeDropFacet__factory.connect(
      diamondAddress,
      accounts[0]
    );

    await base["installApp(bytes32,bytes)"](
      ethers.utils.id("ape"),
      apeDropFacet.interface.encodeFunctionData("initializeApeDrop", [
        apeCoin.address,
      ])
    );

    expect(await apeDropCollection.apeSaleActive()).to.be.false;

    expect(await apeDropCollection.apePresaleActive()).to.be.false;

    await apeDropCollection.apeStartSale(...salesParam, true);

    expect(await apeDropCollection.apeSaleActive()).to.be.true;

    expect(await apeDropCollection.apePresaleActive()).to.be.true;

    const presaleList = [];
    for (const account of accounts) {
      presaleList.push([await account.getAddress(), 1]);
    }

    const [merkleRoot, hexProof] = getMerkleTree(
      presaleList,
      presaleList[1][0] as string,
      1
    );

    const txRoot = await dropCollection.setMerkleRoot(merkleRoot);
    await txRoot.wait();

    // send erc20 funds to accounts[1]
    await apeCoin.mint(
      await accounts[1].getAddress(),
      ethers.utils.parseEther("10")
    );

    // approve apeDropCollection to spend erc20 funds
    await apeCoin
      .connect(accounts[1])
      .increaseAllowance(apeDropCollection.address, salesParam[3].mul(2));

    const txMint = await apeDropCollection
      .connect(accounts[1])
      .apePresaleMintTo(await accounts[1].getAddress(), 1, 1, hexProof, {
        value: salesParam[3].mul(2),
      });
    const txMintReceipt = await txMint.wait();
    const transferEvent = txMintReceipt.events?.find(
      (event) => event.event === "Transfer"
    );

    expect(transferEvent).to.be.a("object");
  });

  it("should be able to presale mint with ape coin for a given wallet with allowed greater than max", async function () {
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
      [ethers.utils.id("drop")]
    );
    const createDiamondReceipt = await createDiamondTx.wait();
    const createdEvent = createDiamondReceipt.events?.find(
      (event) => event.event === "DiamondCreated"
    ) as DiamondCreatedEvent;
    const diamondAddress = createdEvent!.args[0];
    const dropCollection = DropFacet__factory.connect(
      diamondAddress,
      accounts[0]
    );

    const base = BaseFacet__factory.connect(diamondAddress, accounts[0]);
    const apeDropCollection = ApeDropFacet__factory.connect(
      diamondAddress,
      accounts[0]
    );

    await base["installApp(bytes32,bytes)"](
      ethers.utils.id("ape"),
      apeDropFacet.interface.encodeFunctionData("initializeApeDrop", [
        apeCoin.address,
      ])
    );

    expect(await apeDropCollection.apeSaleActive()).to.be.false;

    expect(await apeDropCollection.apePresaleActive()).to.be.false;

    await apeDropCollection.apeStartSale(...salesParam, true);

    expect(await apeDropCollection.apeSaleActive()).to.be.true;

    expect(await apeDropCollection.apePresaleActive()).to.be.true;

    const presaleList = [];
    for (const account of accounts) {
      // max per each wallet is 101
      presaleList.push([await account.getAddress(), 101]);
    }

    const [merkleRoot, hexProof] = getMerkleTree(
      presaleList,
      presaleList[1][0] as string,
      101
    );
    const txRoot = await dropCollection.setMerkleRoot(merkleRoot);
    await txRoot.wait();

    // send erc20 funds to accounts[1]
    await apeCoin.mint(
      await accounts[1].getAddress(),
      ethers.utils.parseEther("10")
    );

    // approve apeDropCollection to spend erc20 funds
    await apeCoin
      .connect(accounts[1])
      .increaseAllowance(apeDropCollection.address, salesParam[3].mul(2));

    // mint 1 NFT (should succeed)
    const txMint = await apeDropCollection
      .connect(accounts[1])
      .apePresaleMintTo(await accounts[1].getAddress(), 1, 101, hexProof, {
        value: salesParam[3].mul(2),
      });
    const txMintReceipt = await txMint.wait();
    const transferEvent = txMintReceipt.events?.find(
      (event) => event.event === "Transfer"
    );

    expect(transferEvent).to.be.a("object");
  });

  it("should not be able to presale mint with ape coin for a given wallet with allowed greater than max", async function () {
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
      [ethers.utils.id("drop")]
    );
    const createDiamondReceipt = await createDiamondTx.wait();
    const createdEvent = createDiamondReceipt.events?.find(
      (event) => event.event === "DiamondCreated"
    ) as DiamondCreatedEvent;
    const diamondAddress = createdEvent!.args[0];
    const dropCollection = DropFacet__factory.connect(
      diamondAddress,
      accounts[0]
    );

    const base = BaseFacet__factory.connect(diamondAddress, accounts[0]);
    const apeDropCollection = ApeDropFacet__factory.connect(
      diamondAddress,
      accounts[0]
    );

    await base["installApp(bytes32,bytes)"](
      ethers.utils.id("ape"),
      apeDropFacet.interface.encodeFunctionData("initializeApeDrop", [
        apeCoin.address,
      ])
    );

    expect(await apeDropCollection.apeSaleActive()).to.be.false;

    expect(await apeDropCollection.apePresaleActive()).to.be.false;

    await apeDropCollection.apeStartSale(...salesParam, true);

    expect(await apeDropCollection.apeSaleActive()).to.be.true;

    expect(await apeDropCollection.apePresaleActive()).to.be.true;

    const presaleList = [];
    for (const account of accounts) {
      // max per each wallet is 101
      presaleList.push([await account.getAddress(), 101]);
    }

    const [merkleRoot, hexProof] = getMerkleTree(
      presaleList,
      presaleList[1][0] as string,
      101
    );

    const txRoot = await dropCollection.setMerkleRoot(merkleRoot);
    await txRoot.wait();

    // mint 101 NFT (should fail)

    // send erc20 funds to accounts[1]
    await apeCoin.mint(
      await accounts[1].getAddress(),
      ethers.utils.parseEther("10")
    );

    // approve apeDropCollection to spend erc20 funds
    await apeCoin
      .connect(accounts[1])
      .increaseAllowance(apeDropCollection.address, salesParam[3].mul(2));

    await expect(
      apeDropCollection
        .connect(accounts[1])
        .apePresaleMintTo(await accounts[1].getAddress(), 101, 101, hexProof, {
          value: salesParam[3].mul(2),
        })
    ).to.be.revertedWith("Exceeded max per wallet");
  });

  it("should not be able to presale mint with ape coin for a given wallet with zero allowed", async function () {
    const collectionId = "COLLECTION_ID_7";
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
    const diamondAddress = createdEvent!.args[0];
    const dropCollection = DropFacet__factory.connect(
      diamondAddress,
      accounts[0]
    );

    const base = BaseFacet__factory.connect(diamondAddress, accounts[0]);
    const apeDropCollection = ApeDropFacet__factory.connect(
      diamondAddress,
      accounts[0]
    );

    await base["installApp(bytes32,bytes)"](
      ethers.utils.id("ape"),
      apeDropFacet.interface.encodeFunctionData("initializeApeDrop", [
        apeCoin.address,
      ])
    );

    expect(await apeDropCollection.apeSaleActive()).to.be.false;

    expect(await apeDropCollection.apePresaleActive()).to.be.false;

    await apeDropCollection.apeStartSale(...salesParam, true);

    expect(await apeDropCollection.apeSaleActive()).to.be.true;

    expect(await apeDropCollection.apePresaleActive()).to.be.true;

    const presaleList = [];
    for (const account of accounts) {
      // max per each wallet is 0
      presaleList.push([await account.getAddress(), 0]);
    }

    const [merkleRoot, hexProof] = getMerkleTree(
      presaleList,
      presaleList[1][0] as string,
      101
    );

    const txRoot = await dropCollection.setMerkleRoot(merkleRoot);
    await txRoot.wait();

    // mint erc20 funds to accounts[1]
    await apeCoin.mint(
      await accounts[1].getAddress(),
      ethers.utils.parseEther("10")
    );

    // approve apeDropCollection to spend erc20 funds
    await apeCoin
      .connect(accounts[1])
      .increaseAllowance(apeDropCollection.address, salesParam[3].mul(2));

    // mint 1 NFT (should fail)
    await expect(
      apeDropCollection
        .connect(accounts[1])
        .apePresaleMintTo(await accounts[1].getAddress(), 1, 0, hexProof, {
          value: salesParam[3].mul(2),
        })
    ).to.be.revertedWith("Exceeded max per wallet");
  });

  it("should not be able to presale mint with ape coin for a given wallet and one mint attempt", async function () {
    const collectionId = "COLLECTION_ID_8";
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
    const diamondAddress = createdEvent!.args[0];
    const dropCollection = DropFacet__factory.connect(
      diamondAddress,
      accounts[0]
    );

    const base = BaseFacet__factory.connect(diamondAddress, accounts[0]);
    const apeDropCollection = ApeDropFacet__factory.connect(
      diamondAddress,
      accounts[0]
    );

    await base["installApp(bytes32,bytes)"](
      ethers.utils.id("ape"),
      apeDropFacet.interface.encodeFunctionData("initializeApeDrop", [
        apeCoin.address,
      ])
    );

    expect(await apeDropCollection.apeSaleActive()).to.be.false;

    expect(await apeDropCollection.apePresaleActive()).to.be.false;

    await apeDropCollection.apeStartSale(...salesParam, true);

    expect(await apeDropCollection.apeSaleActive()).to.be.true;

    expect(await apeDropCollection.apePresaleActive()).to.be.true;

    const presaleList = [];
    for (const account of accounts) {
      // max per each wallet is 1
      presaleList.push([await account.getAddress(), 1]);
    }

    const [merkleRoot, hexProof] = getMerkleTree(
      presaleList,
      presaleList[1][0] as string,
      101
    );

    const txRoot = await dropCollection.setMerkleRoot(merkleRoot);
    await txRoot.wait();

    // mint erc20 funds to accounts[1]
    await apeCoin.mint(
      await accounts[1].getAddress(),
      ethers.utils.parseEther("10")
    );

    // approve apeDropCollection to spend erc20 funds
    await apeCoin
      .connect(accounts[1])
      .increaseAllowance(apeDropCollection.address, salesParam[3].mul(2));

    // mint 2 NFT (should fail)
    await expect(
      apeDropCollection
        .connect(accounts[1])
        .apePresaleMintTo(await accounts[1].getAddress(), 2, 1, hexProof, {
          value: salesParam[3].mul(2),
        })
    ).to.be.revertedWith("Exceeded max per wallet");
  });

  it("should not be able to presale mint with ape coin for a given wallet and two mint attempts", async function () {
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
      [ethers.utils.id("drop")]
    );
    const createDiamondReceipt = await createDiamondTx.wait();
    const createdEvent = createDiamondReceipt.events?.find(
      (event) => event.event === "DiamondCreated"
    ) as DiamondCreatedEvent;
    const diamondAddress = createdEvent!.args[0];
    const dropCollection = DropFacet__factory.connect(
      diamondAddress,
      accounts[0]
    );

    const base = BaseFacet__factory.connect(diamondAddress, accounts[0]);
    const apeDropCollection = ApeDropFacet__factory.connect(
      diamondAddress,
      accounts[0]
    );

    await base["installApp(bytes32,bytes)"](
      ethers.utils.id("ape"),
      apeDropFacet.interface.encodeFunctionData("initializeApeDrop", [
        apeCoin.address,
      ])
    );

    expect(await apeDropCollection.apeSaleActive()).to.be.false;

    expect(await apeDropCollection.apePresaleActive()).to.be.false;

    await apeDropCollection.apeStartSale(...salesParam, true);

    expect(await apeDropCollection.apeSaleActive()).to.be.true;

    expect(await apeDropCollection.apePresaleActive()).to.be.true;

    const presaleList = [];
    for (const account of accounts) {
      // max per each wallet is 1
      presaleList.push([await account.getAddress(), 1]);
    }

    const [merkleRoot, hexProof] = getMerkleTree(
      presaleList,
      presaleList[1][0] as string,
      1
    );

    const txRoot = await dropCollection.setMerkleRoot(merkleRoot);
    await txRoot.wait();

    // mint erc20 funds to accounts[1]
    await apeCoin.mint(
      await accounts[1].getAddress(),
      ethers.utils.parseEther("10")
    );

    // approve apeDropCollection to spend erc20 funds
    await apeCoin
      .connect(accounts[1])
      .increaseAllowance(apeDropCollection.address, salesParam[3].mul(2));

    // mint the first NFT (should be successful)
    let txMint = await apeDropCollection
      .connect(accounts[1])
      .apePresaleMintTo(await accounts[1].getAddress(), 1, 1, hexProof, {
        value: salesParam[3].mul(2),
      });
    let txMintReceipt = await txMint.wait();
    let transferEvent = txMintReceipt.events?.find(
      (event) => event.event === "Transfer"
    );

    expect(transferEvent).to.be.a("object");

    // approve apeDropCollection to spend erc20 funds
    await apeCoin
      .connect(accounts[1])
      .increaseAllowance(apeDropCollection.address, salesParam[3].mul(2));

    // mint the second NFT (should fail)
    await expect(
      apeDropCollection
        .connect(accounts[1])
        .apePresaleMintTo(await accounts[1].getAddress(), 1, 1, hexProof, {
          value: salesParam[3].mul(2),
        })
    ).to.be.revertedWith("Exceeded max per wallet");
  });

  it("should be able to withdraw ape coin", async function () {
    const collectionId = "COLLECTION_ID_10";
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
    const diamondAddress = createdEvent!.args[0];

    const base = BaseFacet__factory.connect(diamondAddress, accounts[0]);
    const apeDropCollection = ApeDropFacet__factory.connect(
      diamondAddress,
      accounts[0]
    );

    await base["installApp(bytes32,bytes)"](
      ethers.utils.id("ape"),
      apeDropFacet.interface.encodeFunctionData("initializeApeDrop", [
        apeCoin.address,
      ])
    );

    expect(await apeDropCollection.apeSaleActive()).to.be.false;

    await apeDropCollection.apeStartSale(...salesParam, false);

    expect(await apeDropCollection.apeSaleActive()).to.be.true;

    // send erc20 funds to accounts[1]
    await apeCoin.mint(
      await accounts[1].getAddress(),
      ethers.utils.parseEther("10")
    );

    // approve apeDropCollection to spend erc20 funds
    await apeCoin
      .connect(accounts[1])
      .increaseAllowance(apeDropCollection.address, salesParam[3]);

    const txMint = await apeDropCollection
      .connect(accounts[1])
      .apeMintTo(await accounts[1].getAddress(), 1, {
        value: salesParam[3],
      });
    const txMintReceipt = await txMint.wait();
    const transferEvent = txMintReceipt.events?.find(
      (event) => event.event === "Transfer"
    );

    expect(transferEvent).to.be.a("object");
    expect(await apeCoin.balanceOf(apeDropCollection.address)).to.be.eq(
      salesParam[3]
    );

    expect(await apeDropCollection.apeRevenue()).to.be.eq(salesParam[3]);

    await apeDropCollection.apeWithdraw();

    expect(await apeCoin.balanceOf(apeDropCollection.address)).to.be.eq(0);

    expect(await apeDropCollection.apeRevenue()).to.be.eq(salesParam[3]);

    expect(await apeCoin.balanceOf(await accounts[0].getAddress())).to.be.eq(
      salesParam[3]
    );
  });

  it("should be able to install then uninstall and then install", async function () {
    const collectionId = "COLLECTION_ID_11";
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
    const diamondAddress = createdEvent!.args[0];

    const base = BaseFacet__factory.connect(diamondAddress, accounts[0]);
    const apeDropCollection = ApeDropFacet__factory.connect(
      diamondAddress,
      accounts[0]
    );
    expect(await base.owner()).to.eq(await accounts[0].getAddress());

    // install apeDrop
    await base["installApp(bytes32,bytes)"](
      ethers.utils.id("ape"),
      apeDropCollection.interface.encodeFunctionData("initializeApeDrop", [
        apeCoin.address,
      ])
    );

    // uninstall apeDrop
    await base["removeApp(bytes32,bytes)"](
      ethers.utils.id("ape"),
      apeDropCollection.interface.encodeFunctionData("finalizeApeDrop")
    );

    // install apeDrop again
    await base["installApp(bytes32,bytes)"](
      ethers.utils.id("ape"),
      apeDropCollection.interface.encodeFunctionData("initializeApeDrop", [
        apeCoin.address,
      ])
    );
  });
});
