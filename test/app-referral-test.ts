import { expect } from "chai";
import { Signer, Wallet } from "ethers";
import { ethers, network } from "hardhat";
import { DiamondCreatedEvent } from "typechain-types/contracts/NiftyKitV3";
import {
  BaseFacet,
  BaseFacet__factory,
  DropFacet,
  DropFacet__factory,
  EditionFacet,
  EditionFacet__factory,
  NiftyKitAppRegistry,
  NiftyKitV3,
  ReferralFacet,
  ReferralFacet__factory,
} from "../typechain-types";
import { ReferralSaleEvent } from "../typechain-types/contracts/apps/referral/ReferralFacet";
import { TransferEvent } from "../typechain-types/contracts/internals/AppFacet";
import { getMerkleTree } from "./utils/merkle-tree";
import {
  createBaseFacet,
  createDropFacet,
  createEditionFacet,
  createNiftyKitAppRegistry,
  createNiftyKitV3,
  createReferralFacet,
  generateSigner,
  getInterfaceId,
  getSelectors,
} from "./utils/niftykit";

const salesParam = [200, 150, 100, ethers.utils.parseEther("100")] as const;

describe("ReferralFacet", function () {
  let accounts: Signer[];
  let appRegistry: NiftyKitAppRegistry;
  let niftyKitV3: NiftyKitV3;
  let dropFacet: DropFacet;
  let editionFacet: EditionFacet;
  let referralFacet: ReferralFacet;
  let baseFacet: BaseFacet;
  let signer: Wallet;
  const feeRate = 500;

  before(async function () {
    accounts = await ethers.getSigners();
    appRegistry = await createNiftyKitAppRegistry(accounts[0]);
    dropFacet = await createDropFacet(accounts[0]);
    baseFacet = await createBaseFacet(accounts[0]);
    editionFacet = await createEditionFacet(accounts[0]);
    referralFacet = await createReferralFacet(accounts[0]);
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
      ethers.utils.id("edition"),
      editionFacet.address,
      getInterfaceId(editionFacet.interface),
      getSelectors(editionFacet.interface),
      1
    );

    await appRegistry.registerApp(
      ethers.utils.id("referral"),
      referralFacet.address,
      getInterfaceId(referralFacet.interface),
      getSelectors(referralFacet.interface),
      1
    );

    niftyKitV3 = await createNiftyKitV3(
      accounts[0],
      appRegistry.address,
      signer.address
    );
  });

  it("should be able to create a Diamond with Drop and Referral apps", async function () {
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
    const referralCollection = ReferralFacet__factory.connect(
      diamondAddress,
      accounts[0]
    );
    expect(await base.owner()).to.eq(await accounts[0].getAddress());

    await base["installApp(bytes32)"](ethers.utils.id("referral"));

    expect(await referralCollection.referralFeeRate()).to.equals(
      ethers.utils.parseEther("0")
    );
  });

  it("should be able to create a Diamond with Edition and Referral apps", async function () {
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
      [ethers.utils.id("edition")]
    );
    const createDiamondReceipt = await createDiamondTx.wait();
    const createdEvent = createDiamondReceipt.events?.find(
      (event) => event.event === "DiamondCreated"
    ) as DiamondCreatedEvent;
    const diamondAddress = createdEvent!.args[0];

    const base = BaseFacet__factory.connect(diamondAddress, accounts[0]);
    const referralCollection = ReferralFacet__factory.connect(
      diamondAddress,
      accounts[0]
    );
    expect(await base.owner()).to.eq(await accounts[0].getAddress());

    await base["installApp(bytes32)"](ethers.utils.id("referral"));

    expect(await referralCollection.referralFeeRate()).to.equals(
      ethers.utils.parseEther("0")
    );
  });

  it("should be able to set referral fee rate", async function () {
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

    const referralCollection = ReferralFacet__factory.connect(
      diamondAddress,
      accounts[0]
    );
    expect(await base.owner()).to.eq(await accounts[0].getAddress());

    await base["installApp(bytes32)"](ethers.utils.id("referral"));

    expect(Number(await referralCollection.referralFeeRate())).to.be.equal(0);

    await referralCollection.referralSetFeeRate(500);

    expect(Number(await referralCollection.referralFeeRate())).to.be.equal(500);
  });

  it("should not be able to set referral fee rate", async function () {
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
    const base = BaseFacet__factory.connect(diamondAddress, accounts[0]);

    const referralCollection = ReferralFacet__factory.connect(
      diamondAddress,
      accounts[0]
    );
    expect(await base.owner()).to.eq(await accounts[0].getAddress());

    await base["installApp(bytes32)"](ethers.utils.id("referral"));

    expect(Number(await referralCollection.referralFeeRate())).to.be.equal(0);

    await expect(
      referralCollection.connect(accounts[1]).referralSetFeeRate(500)
    ).to.be.rejectedWith("Unauthorized()");
  });

  it("should be able to referral mint to", async function () {
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
    const base = BaseFacet__factory.connect(diamondAddress, accounts[0]);

    const referralCollection = ReferralFacet__factory.connect(
      diamondAddress,
      accounts[0]
    );
    const dropCollection = DropFacet__factory.connect(
      diamondAddress,
      accounts[0]
    );
    expect(await base.owner()).to.eq(await accounts[0].getAddress());

    await base["installApp(bytes32)"](ethers.utils.id("referral"));

    expect(Number(await referralCollection.referralFeeRate())).to.be.equal(0);

    await referralCollection.referralSetFeeRate(500);

    expect(Number(await referralCollection.referralFeeRate())).to.be.equal(500);

    await dropCollection.startSale(...salesParam, false);

    const minterAddress = await accounts[1].getAddress();
    const referralAddress = await accounts[0].getAddress();

    const txMint = await referralCollection.referralMintTo(
      minterAddress,
      1,
      referralAddress,
      {
        value: salesParam[3].mul(1),
      }
    );

    const txMintReceipt = await txMint.wait();
    const transferEvent = txMintReceipt.events?.find(
      (event) => event.event === "Transfer"
    ) as TransferEvent;

    const referralEvent = txMintReceipt.events?.find(
      (event) => event.event === "ReferralSale"
    ) as ReferralSaleEvent;

    expect(transferEvent).to.be.a("object");
    expect(referralEvent).to.be.a("object");

    const { from, to, tokenId } = transferEvent.args;
    const { referral, feeRate: eventFeeRate, feeAmount } = referralEvent.args;

    // transfer event tests
    expect(from).to.be.equal(ethers.constants.AddressZero);
    expect(to).to.be.equal(minterAddress);
    expect(Number(tokenId)).to.be.equal(1);

    // referral event tests
    // sale = 100 ETH
    // niftykit fees = 5% = 5 ETH
    // referral fees = 5% remaining = 5% of 95 ETH = 4.75 ETH
    expect(referral).to.be.equal(referralAddress);
    expect(Number(eventFeeRate)).to.be.equal(500);
    expect(feeAmount).to.equals(ethers.utils.parseEther("4.75"));
  });

  it("should be able to referral presale mint to", async function () {
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
    const base = BaseFacet__factory.connect(diamondAddress, accounts[0]);

    const referralCollection = ReferralFacet__factory.connect(
      diamondAddress,
      accounts[0]
    );
    const dropCollection = DropFacet__factory.connect(
      diamondAddress,
      accounts[0]
    );
    expect(await base.owner()).to.eq(await accounts[0].getAddress());

    await base["installApp(bytes32)"](ethers.utils.id("referral"));

    expect(Number(await referralCollection.referralFeeRate())).to.be.equal(0);

    await referralCollection.referralSetFeeRate(500);

    expect(Number(await referralCollection.referralFeeRate())).to.be.equal(500);

    await dropCollection.startSale(...salesParam, true);

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

    const minterAddress = await accounts[1].getAddress();
    const referralAddress = await accounts[0].getAddress();

    const txMint = await referralCollection.referralPresaleMintTo(
      minterAddress,
      1,
      1,
      hexProof,
      referralAddress,
      {
        value: salesParam[3].mul(1),
      }
    );

    const txMintReceipt = await txMint.wait();
    const transferEvent = txMintReceipt.events?.find(
      (event) => event.event === "Transfer"
    ) as TransferEvent;

    const referralEvent = txMintReceipt.events?.find(
      (event) => event.event === "ReferralSale"
    ) as ReferralSaleEvent;

    expect(transferEvent).to.be.a("object");
    expect(referralEvent).to.be.a("object");

    const { from, to, tokenId } = transferEvent.args;
    const { referral, feeRate: eventFeeRate, feeAmount } = referralEvent.args;

    // transfer event tests
    expect(from).to.be.equal(ethers.constants.AddressZero);
    expect(to).to.be.equal(minterAddress);
    expect(Number(tokenId)).to.be.equal(1);

    // referral event tests
    // referral event tests
    // sale = 100 ETH
    // niftykit fees = 5% = 5 ETH
    // referral fees = 5% remaining = 5% of 95 ETH = 4.75 ETH
    expect(referral).to.be.equal(referralAddress);
    expect(Number(eventFeeRate)).to.be.equal(500);
    expect(feeAmount).to.equals(ethers.utils.parseEther("4.75"));
  });

  it("should be able to referral mint edition", async function () {
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
      [ethers.utils.id("edition")]
    );
    const createDiamondReceipt = await createDiamondTx.wait();
    const createdEvent = createDiamondReceipt.events?.find(
      (event) => event.event === "DiamondCreated"
    ) as DiamondCreatedEvent;
    const diamondAddress = createdEvent!.args[0];
    const base = BaseFacet__factory.connect(diamondAddress, accounts[0]);

    const referralCollection = ReferralFacet__factory.connect(
      diamondAddress,
      accounts[0]
    );
    const editionCollection = EditionFacet__factory.connect(
      diamondAddress,
      accounts[0]
    );
    expect(await base.owner()).to.eq(await accounts[0].getAddress());

    await base["installApp(bytes32)"](ethers.utils.id("referral"));

    expect(Number(await referralCollection.referralFeeRate())).to.be.equal(0);

    await referralCollection.referralSetFeeRate(500);

    expect(Number(await referralCollection.referralFeeRate())).to.be.equal(500);

    const editionTx = await editionCollection.createEdition(
      "foo",
      ethers.utils.parseEther("100"),
      3,
      3,
      3
    );

    const editionTxResults = await editionTx.wait();
    const editionId = editionTxResults.events?.[0].args?.[0];

    await editionCollection.setEditionActive(editionId, true);
    const edition = await editionCollection.getEdition(editionId);

    const minterAddress = await accounts[1].getAddress();
    const referralAddress = await accounts[0].getAddress();

    const editionSignature = await accounts[0].signMessage(
      ethers.utils.arrayify(
        ethers.utils.solidityKeccak256(
          ["uint256", "uint256", "uint256"],
          [editionId, edition.nonce, network.config.chainId]
        )
      )
    );

    const txMint = await referralCollection.referralMintEdition(
      minterAddress,
      editionId,
      1,
      editionSignature,
      [],
      referralAddress,
      {
        value: ethers.utils.parseEther("100"),
      }
    );

    const txMintReceipt = await txMint.wait();
    const transferEvent = txMintReceipt.events?.find(
      (event) => event.event === "Transfer"
    ) as TransferEvent;

    const referralEvent = txMintReceipt.events?.find(
      (event) => event.event === "ReferralSale"
    ) as ReferralSaleEvent;

    expect(transferEvent).to.be.a("object");
    expect(referralEvent).to.be.a("object");

    const { from, to, tokenId } = transferEvent.args;
    const { referral, feeRate: eventFeeRate, feeAmount } = referralEvent.args;

    // transfer event tests
    expect(from).to.be.equal(ethers.constants.AddressZero);
    expect(to).to.be.equal(minterAddress);
    expect(Number(tokenId)).to.be.equal(1);

    // referral event tests
    // referral event tests
    // sale = 100 ETH
    // niftykit fees = 5% = 5 ETH
    // referral fees = 5% remaining = 5% of 95 ETH = 4.75 ETH
    expect(referral).to.be.equal(referralAddress);
    expect(Number(eventFeeRate)).to.be.equal(500);
    expect(feeAmount).to.equals(ethers.utils.parseEther("4.75"));
  });
});
