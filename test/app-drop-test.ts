import { expect } from "chai";
import { Signer, Wallet } from "ethers";
import { ethers, network } from "hardhat";
import { DiamondCreatedEvent } from "typechain-types/contracts/NiftyKitV3";
import {
  BaseFacet,
  BaseFacet__factory,
  DropFacet,
  DropFacet__factory,
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
  createExampleFacet,
  generateSigner,
  createBaseFacet,
} from "./utils/niftykit";

const salesParam = [200, 150, 100, ethers.utils.parseEther("0.01")] as const;

describe("DropFacet", function () {
  let accounts: Signer[];
  let appRegistry: NiftyKitAppRegistry;
  let niftyKitV3: NiftyKitV3;
  let dropFacet: DropFacet;
  let baseFacet: BaseFacet;
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

  it("should be able to create a Diamond with Drop", async function () {
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
    const diamondAddress = createdEvent.args[0];

    const base = BaseFacet__factory.connect(diamondAddress, accounts[0]);
    expect(await base.owner()).to.eq(await accounts[0].getAddress());
  });

  it("should be able to start the drop", async function () {
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
    const diamondAddress = createdEvent.args[0];
    const dropCollection = DropFacet__factory.connect(
      diamondAddress,
      accounts[0]
    );
    expect(await dropCollection.saleActive()).to.be.false;

    await dropCollection.startSale(...salesParam, false);

    expect(await dropCollection.maxAmount()).to.equal(salesParam[0]);
    expect(await dropCollection.maxPerMint()).to.equal(salesParam[1]);
    expect(await dropCollection.maxPerWallet()).to.equal(salesParam[2]);
    expect(await dropCollection.price()).to.equal(salesParam[3]);

    expect(await dropCollection.saleActive()).to.be.true;

    await dropCollection.stopSale();

    await expect(
      dropCollection
        .connect(accounts[1])
        .mintTo(await accounts[1].getAddress(), 1, {
          value: salesParam[3].mul(1),
        })
    ).to.be.revertedWith("Sale not active");

    expect(await dropCollection.saleActive()).to.be.false;
  });

  it("should be able to mint", async function () {
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
    expect(await dropCollection.saleActive()).to.be.false;

    await dropCollection.startSale(...salesParam, false);

    expect(await dropCollection.saleActive()).to.be.true;

    await expect(
      dropCollection
        .connect(accounts[1])
        .mintTo(await accounts[1].getAddress(), 0)
    ).to.be.revertedWith("Quantity is 0");

    await expect(
      dropCollection
        .connect(accounts[1])
        .mintTo(await accounts[1].getAddress(), 500, {
          value: salesParam[3].mul(500),
        })
    ).to.be.revertedWith("Exceeded max per mint");

    await expect(
      dropCollection
        .connect(accounts[1])
        .mintTo(await accounts[1].getAddress(), 2, {
          value: salesParam[3].mul(1),
        })
    ).to.be.revertedWith("Value incorrect");

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
  });

  it("should be able to presale mint", async function () {
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
    const dropCollection = DropFacet__factory.connect(
      diamondAddress,
      accounts[0]
    );

    const presaleList = [];
    for (const account of accounts) {
      presaleList.push([await account.getAddress(), 1]);
    }
    const [merkleRoot, hexProof] = getMerkleTree(
      presaleList,
      presaleList[1][0] as string,
      1
    );

    const badPresaleList = [];
    badPresaleList.push([await accounts[0].getAddress(), 1]);
    const [, badHexProof] = getMerkleTree(
      badPresaleList,
      badPresaleList[0][0] as string,
      1
    );

    await dropCollection.startSale(...salesParam, true);

    await expect(
      dropCollection
        .connect(accounts[1])
        .mintTo(await accounts[1].getAddress(), 1, {
          value: salesParam[3].mul(1),
        })
    ).to.be.revertedWith("Presale active");

    await expect(
      dropCollection
        .connect(accounts[1])
        .presaleMintTo(await accounts[1].getAddress(), 1, 1, hexProof, {
          value: salesParam[3].mul(2),
        })
    ).to.be.revertedWith("Presale not set");

    const txRoot = await dropCollection.setMerkleRoot(merkleRoot);
    await txRoot.wait();

    await dropCollection.stopSale();

    expect(await dropCollection.saleActive()).to.be.false;

    expect(await dropCollection.presaleActive()).to.be.false;

    await expect(
      dropCollection
        .connect(accounts[1])
        .presaleMintTo(await accounts[1].getAddress(), 1, 1, hexProof, {
          value: salesParam[3].mul(2),
        })
    ).to.be.revertedWith("Presale not active");

    await dropCollection.startSale(...salesParam, true);

    expect(await dropCollection.saleActive()).to.be.true;

    expect(await dropCollection.presaleActive()).to.be.true;

    await expect(
      dropCollection
        .connect(accounts[1])
        .presaleMintTo(await accounts[1].getAddress(), 1, 1, badHexProof, {
          value: salesParam[3].mul(2),
        })
    ).to.be.revertedWith("Presale invalid");

    const txMint = await dropCollection
      .connect(accounts[1])
      .presaleMintTo(await accounts[1].getAddress(), 1, 1, hexProof, {
        value: salesParam[3].mul(2),
      });
    const txMintReceipt = await txMint.wait();
    const transferEvent = txMintReceipt.events?.find(
      (event) => event.event === "Transfer"
    );

    expect(transferEvent).to.be.a("object");
  });

  it("should be able to presale mint for a given wallet with allowed greater than max", async function () {
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
    const diamondAddress = createdEvent.args[0];
    const dropCollection = DropFacet__factory.connect(
      diamondAddress,
      accounts[0]
    );

    expect(await dropCollection.saleActive()).to.be.false;

    expect(await dropCollection.presaleActive()).to.be.false;

    await dropCollection.startSale(...salesParam, true);

    expect(await dropCollection.saleActive()).to.be.true;

    expect(await dropCollection.presaleActive()).to.be.true;

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

    // mint 1 NFT (should succeed)
    const txMint = await dropCollection
      .connect(accounts[1])
      .presaleMintTo(await accounts[1].getAddress(), 1, 101, hexProof, {
        value: salesParam[3].mul(2),
      });
    const txMintReceipt = await txMint.wait();
    const transferEvent = txMintReceipt.events?.find(
      (event) => event.event === "Transfer"
    );

    expect(transferEvent).to.be.a("object");
  });

  it("should not be able to presale mint for a given wallet with allowed greater than max", async function () {
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
    const diamondAddress = createdEvent.args[0];
    const dropCollection = DropFacet__factory.connect(
      diamondAddress,
      accounts[0]
    );

    expect(await dropCollection.saleActive()).to.be.false;

    expect(await dropCollection.presaleActive()).to.be.false;

    await dropCollection.startSale(...salesParam, true);

    expect(await dropCollection.saleActive()).to.be.true;

    expect(await dropCollection.presaleActive()).to.be.true;

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
    await expect(
      dropCollection
        .connect(accounts[1])
        .presaleMintTo(await accounts[1].getAddress(), 101, 101, hexProof, {
          value: salesParam[3].mul(2),
        })
    ).to.be.revertedWith("Exceeded max per wallet");
  });

  it("should not be able to presale mint for a given wallet with zero allowed", async function () {
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
    const diamondAddress = createdEvent.args[0];
    const dropCollection = DropFacet__factory.connect(
      diamondAddress,
      accounts[0]
    );

    expect(await dropCollection.saleActive()).to.be.false;

    expect(await dropCollection.presaleActive()).to.be.false;

    await dropCollection.startSale(...salesParam, true);

    expect(await dropCollection.saleActive()).to.be.true;

    expect(await dropCollection.presaleActive()).to.be.true;

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

    // mint 1 NFT (should fail)
    await expect(
      dropCollection
        .connect(accounts[1])
        .presaleMintTo(await accounts[1].getAddress(), 1, 0, hexProof, {
          value: salesParam[3].mul(2),
        })
    ).to.be.revertedWith("Exceeded max per wallet");
  });

  it("should not be able to presale mint for a given wallet and one mint attempt", async function () {
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
    const diamondAddress = createdEvent.args[0];
    const dropCollection = DropFacet__factory.connect(
      diamondAddress,
      accounts[0]
    );

    expect(await dropCollection.saleActive()).to.be.false;

    expect(await dropCollection.presaleActive()).to.be.false;

    await dropCollection.startSale(...salesParam, true);

    expect(await dropCollection.saleActive()).to.be.true;

    expect(await dropCollection.presaleActive()).to.be.true;

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

    // mint 2 NFT (should fail)
    await expect(
      dropCollection
        .connect(accounts[1])
        .presaleMintTo(await accounts[1].getAddress(), 2, 1, hexProof, {
          value: salesParam[3].mul(2),
        })
    ).to.be.revertedWith("Exceeded max per wallet");
  });

  it("should not be able to presale mint for a given wallet and two mint attempts", async function () {
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
    const diamondAddress = createdEvent.args[0];
    const dropCollection = DropFacet__factory.connect(
      diamondAddress,
      accounts[0]
    );

    expect(await dropCollection.saleActive()).to.be.false;

    expect(await dropCollection.presaleActive()).to.be.false;

    await dropCollection.startSale(...salesParam, true);

    expect(await dropCollection.saleActive()).to.be.true;

    expect(await dropCollection.presaleActive()).to.be.true;

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

    // mint the first NFT (should be successful)
    let txMint = await dropCollection
      .connect(accounts[1])
      .presaleMintTo(await accounts[1].getAddress(), 1, 1, hexProof, {
        value: salesParam[3].mul(2),
      });
    let txMintReceipt = await txMint.wait();
    let transferEvent = txMintReceipt.events?.find(
      (event) => event.event === "Transfer"
    );

    expect(transferEvent).to.be.a("object");

    // mint the second NFT (should fail)
    await expect(
      dropCollection
        .connect(accounts[1])
        .presaleMintTo(await accounts[1].getAddress(), 1, 1, hexProof, {
          value: salesParam[3].mul(2),
        })
    ).to.be.revertedWith("Exceeded max per wallet");
  });

  it("should be able to airdrop", async function () {
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
    const diamondAddress = createdEvent.args[0];
    const dropCollection = DropFacet__factory.connect(
      diamondAddress,
      accounts[0]
    );
    const txAirdrop = await dropCollection.batchAirdrop(
      [1],
      [await accounts[1].getAddress()]
    );
    const txAirdropReceipt = await txAirdrop.wait();
    const transferEvent = txAirdropReceipt.events?.find(
      (event) => event.event === "Transfer"
    );

    expect(transferEvent).to.be.a("object");
  });

  it("should be able to withdraw", async function () {
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
    const diamondAddress = createdEvent.args[0];
    const dropCollection = DropFacet__factory.connect(
      diamondAddress,
      accounts[0]
    );

    expect(await dropCollection.saleActive()).to.be.false;

    await dropCollection.startSale(...salesParam, false);

    expect(await dropCollection.saleActive()).to.be.true;

    const txMint = await dropCollection
      .connect(accounts[1])
      .mintTo(await accounts[1].getAddress(), 1, {
        value: await dropCollection.price(),
      });
    const txMintReceipt = await txMint.wait();
    const transferEvent = txMintReceipt.events?.find(
      (event) => event.event === "Transfer"
    );

    expect(transferEvent).to.be.a("object");

    const [sellerAmount, buyerAmount] = await niftyKitV3.commission(
      dropCollection.address,
      salesParam[3]
    );

    expect(
      await dropCollection.provider.getBalance(dropCollection.address)
    ).to.be.eq(salesParam[3].sub(sellerAmount.add(buyerAmount)));

    const base = BaseFacet__factory.connect(diamondAddress, accounts[0]);
    await base.withdraw();

    expect(
      await dropCollection.provider.getBalance(dropCollection.address)
    ).to.be.eq(0);

    expect(await niftyKitV3.provider.getBalance(niftyKitV3.address)).to.be.eq(
      sellerAmount.add(buyerAmount)
    );

    await niftyKitV3.withdraw();

    expect(await niftyKitV3.provider.getBalance(niftyKitV3.address)).to.be.eq(
      0
    );
  });

  it("should be able to withdraw with buyer fees", async function () {
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
    const diamondAddress = createdEvent.args[0];
    const dropCollection = DropFacet__factory.connect(
      diamondAddress,
      accounts[0]
    );

    // buyer pays fees
    await niftyKitV3.setFeeType(diamondAddress, 1);

    expect(await dropCollection.saleActive()).to.be.false;

    await dropCollection.startSale(...salesParam, false);

    expect(await dropCollection.saleActive()).to.be.true;

    const txMint = await dropCollection
      .connect(accounts[1])
      .mintTo(await accounts[1].getAddress(), 1, {
        value: await dropCollection.price(),
      });
    const txMintReceipt = await txMint.wait();
    const transferEvent = txMintReceipt.events?.find(
      (event) => event.event === "Transfer"
    );

    expect(transferEvent).to.be.a("object");

    const [sellerAmount, buyerAmount] = await niftyKitV3.commission(
      dropCollection.address,
      salesParam[3]
    );

    expect(sellerAmount.toNumber()).to.equal(0);

    expect(
      await dropCollection.provider.getBalance(dropCollection.address)
    ).to.be.eq(salesParam[3]);

    const base = BaseFacet__factory.connect(diamondAddress, accounts[0]);
    await base.withdraw();

    expect(
      await dropCollection.provider.getBalance(dropCollection.address)
    ).to.be.eq(0);

    expect(await niftyKitV3.provider.getBalance(niftyKitV3.address)).to.be.eq(
      sellerAmount.add(buyerAmount)
    );

    await niftyKitV3.withdraw();

    expect(await niftyKitV3.provider.getBalance(niftyKitV3.address)).to.be.eq(
      0
    );
  });

  it("should be able to withdraw with split fees", async function () {
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
    const diamondAddress = createdEvent.args[0];
    const dropCollection = DropFacet__factory.connect(
      diamondAddress,
      accounts[0]
    );

    // split fees
    await niftyKitV3.setFeeType(diamondAddress, 2);

    expect(await dropCollection.saleActive()).to.be.false;

    await dropCollection.startSale(...salesParam, false);

    expect(await dropCollection.saleActive()).to.be.true;

    const txMint = await dropCollection
      .connect(accounts[1])
      .mintTo(await accounts[1].getAddress(), 1, {
        value: await dropCollection.price(),
      });
    const txMintReceipt = await txMint.wait();
    const transferEvent = txMintReceipt.events?.find(
      (event) => event.event === "Transfer"
    );

    expect(transferEvent).to.be.a("object");

    const [sellerAmount, buyerAmount] = await niftyKitV3.commission(
      dropCollection.address,
      salesParam[3]
    );

    expect(sellerAmount).to.equal(buyerAmount);

    expect(
      await dropCollection.provider.getBalance(dropCollection.address)
    ).to.be.eq(salesParam[3].sub(sellerAmount));

    const base = BaseFacet__factory.connect(diamondAddress, accounts[0]);
    await base.withdraw();

    expect(
      await dropCollection.provider.getBalance(dropCollection.address)
    ).to.be.eq(0);

    expect(await niftyKitV3.provider.getBalance(niftyKitV3.address)).to.be.eq(
      sellerAmount.add(buyerAmount)
    );

    await niftyKitV3.withdraw();

    expect(await niftyKitV3.provider.getBalance(niftyKitV3.address)).to.be.eq(
      0
    );
  });

  it("should tokenId start at 1", async function () {
    const collectionId = "COLLECTION_ID_12";
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

    expect(await dropCollection.saleActive()).to.be.false;

    await dropCollection.startSale(...salesParam, false);

    expect(await dropCollection.saleActive()).to.be.true;

    const txMint = await dropCollection
      .connect(accounts[1])
      .mintTo(await accounts[1].getAddress(), 1, {
        value: salesParam[3],
      });
    const txMintReceipt = await txMint.wait();
    const transferEvent = txMintReceipt.events?.find(
      (event) => event.event === "Transfer"
    );

    expect(transferEvent).to.be.a("object");

    const [sellerAmount, buyerAmount] = await niftyKitV3.commission(
      dropCollection.address,
      salesParam[3]
    );

    expect(
      await dropCollection.provider.getBalance(dropCollection.address)
    ).to.be.eq(salesParam[3].sub(sellerAmount.add(buyerAmount)));

    const tokenId = transferEvent!.args![2].toNumber();

    expect(tokenId).to.be.equal(1);
  });
});
