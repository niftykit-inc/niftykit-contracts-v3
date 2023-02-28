import { expect } from "chai";
import { Signer, Wallet } from "ethers";
import { ethers } from "hardhat";
import { DiamondCreatedEvent } from "typechain-types/contracts/NiftyKitV3";
import {
  DiamondCollection,
  DiamondCollection__factory,
  EditionFacet,
  EditionFacet__factory,
  NiftyKitAppRegistry,
  NiftyKitV3,
} from "../typechain-types";
import { getMerkleTreeBasic } from "./utils/merkle-tree";
import {
  createNiftyKitV3,
  createNiftyKitAppRegistry,
  getInterfaceId,
  getSelectors,
  createImplementation,
  createExampleFacet,
  createEditionFacet,
  generateSigner,
} from "./utils/niftykit";

describe("EditionFacet", function () {
  let accounts: Signer[];
  let appRegistry: NiftyKitAppRegistry;
  let niftyKitV3: NiftyKitV3;
  let editionFacet: EditionFacet;
  let implementation: DiamondCollection;
  let signer: Wallet;
  const feeRate = 500;

  before(async function () {
    accounts = await ethers.getSigners();
    appRegistry = await createNiftyKitAppRegistry(accounts[0]);
    implementation = await createImplementation(accounts[0]);
    editionFacet = await createEditionFacet(accounts[0]);
    signer = generateSigner();
    const exampleFacet = await createExampleFacet(accounts[0]);

    // register apps
    await appRegistry.registerApp(
      ethers.utils.id("edition"),
      editionFacet.address,
      getInterfaceId(editionFacet.interface),
      getSelectors(editionFacet.interface),
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
      implementation.address,
      signer.address
    );
  });

  it("should be able to create a Diamond with Edition", async function () {
    const collectionId = "COLLECTION_ID_1";
    const signature = await signer.signMessage(
      ethers.utils.arrayify(
        ethers.utils.solidityKeccak256(
          ["string", "uint96"],
          [collectionId, feeRate]
        )
      )
    );
    const createDiamondTx = await niftyKitV3.createDiamond(
      collectionId,
      feeRate,
      signature,
      "NAME",
      "SYMBOL",
      [ethers.utils.id("edition")]
    );
    const createDiamondReceipt = await createDiamondTx.wait();
    const createdEvent = createDiamondReceipt.events?.find(
      (event) => event.event === "DiamondCreated"
    ) as DiamondCreatedEvent;
    const diamondAddress = createdEvent.args[0];

    const diamond = DiamondCollection__factory.connect(
      diamondAddress,
      accounts[0]
    );
    expect(await diamond.owner()).to.eq(await accounts[0].getAddress());
  });

  it("should be able to create an edition", async function () {
    const collectionId = "COLLECTION_ID_2";
    const signature = await signer.signMessage(
      ethers.utils.arrayify(
        ethers.utils.solidityKeccak256(
          ["string", "uint96"],
          [collectionId, feeRate]
        )
      )
    );
    const createDiamondTx = await niftyKitV3.createDiamond(
      collectionId,
      feeRate,
      signature,
      "NAME",
      "SYMBOL",
      [ethers.utils.id("edition")]
    );
    const createDiamondReceipt = await createDiamondTx.wait();
    const createdEvent = createDiamondReceipt.events?.find(
      (event) => event.event === "DiamondCreated"
    ) as DiamondCreatedEvent;
    const diamondAddress = createdEvent.args[0];
    const editionCollection = EditionFacet__factory.connect(
      diamondAddress,
      accounts[0]
    );

    await editionCollection.createEdition("foo", 0, 1, 1, 1);

    expect((await editionCollection.editionsCount()).toNumber()).to.equals(1);
  });

  it("should be able to update an edition", async function () {
    const collectionId = "COLLECTION_ID_update_collection";
    const signature = await signer.signMessage(
      ethers.utils.arrayify(
        ethers.utils.solidityKeccak256(
          ["string", "uint96"],
          [collectionId, feeRate]
        )
      )
    );
    const createDiamondTx = await niftyKitV3.createDiamond(
      collectionId,
      feeRate,
      signature,
      "NAME",
      "SYMBOL",
      [ethers.utils.id("edition")]
    );
    const createDiamondReceipt = await createDiamondTx.wait();
    const createdEvent = createDiamondReceipt.events?.find(
      (event) => event.event === "DiamondCreated"
    ) as DiamondCreatedEvent;
    const diamondAddress = createdEvent.args[0];
    const editionCollection = EditionFacet__factory.connect(
      diamondAddress,
      accounts[0]
    );

    const editionTx = await editionCollection.createEdition("foo", 0, 1, 1, 1);
    const editionTxResults = await editionTx.wait();
    const editionId = editionTxResults.events?.[0].args?.[0];
    let edition = await editionCollection.getEdition(editionId);

    await expect(
      editionCollection.updateEdition(69, 0, 1, 1, 1)
    ).to.be.revertedWith("Does not exist");
    await expect(
      editionCollection.setEditionTokenURI(69, "foo")
    ).to.be.revertedWith("Does not exist");
    await expect(
      editionCollection.setEditionActive(69, true)
    ).to.be.revertedWith("Does not exist");

    expect(edition.maxQuantity).to.equals(1);

    await editionCollection.updateEdition(editionId, 0, 0, 1, 1);
    await editionCollection.setEditionTokenURI(editionId, "foo2");

    edition = await editionCollection.getEdition(editionId);
    expect(edition.tokenURI).to.equals("foo2");
    expect(edition.maxQuantity).to.equals(0);
  });

  it("should be able to free mint an edition", async function () {
    const collectionId = "COLLECTION_ID_free_mint_test";
    const signature = await signer.signMessage(
      ethers.utils.arrayify(
        ethers.utils.solidityKeccak256(
          ["string", "uint96"],
          [collectionId, feeRate]
        )
      )
    );
    const createDiamondTx = await niftyKitV3.createDiamond(
      collectionId,
      feeRate,
      signature,
      "NAME",
      "SYMBOL",
      [ethers.utils.id("edition")]
    );
    const createDiamondReceipt = await createDiamondTx.wait();
    const createdEvent = createDiamondReceipt.events?.find(
      (event) => event.event === "DiamondCreated"
    ) as DiamondCreatedEvent;
    const diamondAddress = createdEvent.args[0];
    const diamondCollection = DiamondCollection__factory.connect(
      diamondAddress,
      accounts[0]
    );
    const editionCollection = EditionFacet__factory.connect(
      diamondAddress,
      accounts[0]
    );

    const editionTx = await editionCollection.createEdition("foo", 0, 3, 3, 3);
    const editionTxResults = await editionTx.wait();
    const editionId = editionTxResults.events?.[0].args?.[0];
    expect((await editionCollection.editionsCount()).toNumber()).to.equals(1);

    let edition = await editionCollection.getEdition(editionId);
    expect(edition.active).to.equals(false);
    await editionCollection.setEditionActive(editionId, true);
    edition = await editionCollection.getEdition(editionId);
    expect(edition.active).to.equals(true);

    const goodSignature = await accounts[0].signMessage(
      ethers.utils.arrayify(
        ethers.utils.solidityKeccak256(
          ["uint256"],
          [edition.nonce.add(editionId).toString()]
        )
      )
    );

    await expect(
      editionCollection.setEditionSigner(69, await accounts[0].getAddress())
    ).to.be.revertedWith("Does not exist");

    const badSignature = await accounts[0].signMessage(
      ethers.utils.arrayify(
        ethers.utils.solidityKeccak256(
          ["uint256"],
          [edition.nonce.add(420).toString()]
        )
      )
    );

    await expect(
      editionCollection.mintEdition(
        await accounts[0].getAddress(),
        editionId,
        1,
        badSignature,
        []
      )
    ).to.be.revertedWith("Invalid signature");

    await expect(
      editionCollection.mintEdition(
        await accounts[0].getAddress(),
        69,
        1,
        goodSignature,
        []
      )
    ).to.be.revertedWith("Does not exist");

    const mintTx = await editionCollection.mintEdition(
      await accounts[0].getAddress(),
      editionId,
      1,
      goodSignature,
      []
    );

    const mintResults = await mintTx.wait();

    expect(
      mintResults.events!.filter((evt) => evt.event === "Transfer").length
    ).to.equals(1);

    expect(await diamondCollection.tokenURI(1)).to.equals("foo");

    await editionCollection.setEditionActive(editionId, false);

    await expect(
      editionCollection.mintEdition(
        await accounts[0].getAddress(),
        editionId,
        1,
        goodSignature,
        []
      )
    ).to.be.revertedWith("Not active");

    await editionCollection.setEditionActive(editionId, true);

    await editionCollection.setEditionSigner(
      editionId,
      await accounts[1].getAddress()
    );

    const goodUpdatedSignature = await accounts[1].signMessage(
      ethers.utils.arrayify(
        ethers.utils.solidityKeccak256(
          ["uint256"],
          [edition.nonce.add(editionId).toString()]
        )
      )
    );

    const newMintTx = await editionCollection.mintEdition(
      await accounts[0].getAddress(),
      editionId,
      1,
      goodUpdatedSignature,
      []
    );

    const newMintResults = await newMintTx.wait();

    expect(
      newMintResults.events!.filter((evt) => evt.event === "Transfer").length
    ).to.equals(1);

    // invalidate the new signature
    await expect(editionCollection.invalidateSignature(69)).to.be.revertedWith(
      "Does not exist"
    );

    await editionCollection.invalidateSignature(editionId);

    await expect(
      editionCollection.mintEdition(
        await accounts[0].getAddress(),
        editionId,
        1,
        goodUpdatedSignature,
        []
      )
    ).to.be.revertedWith("Invalid signature");
  });

  it("should be able to paid mint an edition", async function () {
    const collectionId = "COLLECTION_ID_paid_mint_test";
    const signature = await signer.signMessage(
      ethers.utils.arrayify(
        ethers.utils.solidityKeccak256(
          ["string", "uint96"],
          [collectionId, feeRate]
        )
      )
    );
    const createDiamondTx = await niftyKitV3.createDiamond(
      collectionId,
      feeRate,
      signature,
      "NAME",
      "SYMBOL",
      [ethers.utils.id("edition")]
    );
    const createDiamondReceipt = await createDiamondTx.wait();
    const createdEvent = createDiamondReceipt.events?.find(
      (event) => event.event === "DiamondCreated"
    ) as DiamondCreatedEvent;
    const diamondAddress = createdEvent.args[0];
    const diamondCollection = DiamondCollection__factory.connect(
      diamondAddress,
      accounts[0]
    );
    const editionCollection = EditionFacet__factory.connect(
      diamondAddress,
      accounts[0]
    );

    const editionTx = await editionCollection.createEdition(
      "foo",
      ethers.utils.parseEther("0.01"),
      3,
      3,
      3
    );
    const editionTxResults = await editionTx.wait();
    const editionId = editionTxResults.events?.[0].args?.[0];
    expect((await editionCollection.editionsCount()).toNumber()).to.equals(1);

    let edition = await editionCollection.getEdition(editionId);
    expect(edition.active).to.equals(false);
    await editionCollection.setEditionActive(editionId, true);
    edition = await editionCollection.getEdition(editionId);
    expect(edition.active).to.equals(true);

    const goodSignature = await accounts[0].signMessage(
      ethers.utils.arrayify(
        ethers.utils.solidityKeccak256(
          ["uint256"],
          [edition.nonce.add(editionId).toString()]
        )
      )
    );

    await expect(
      editionCollection.mintEdition(
        await accounts[0].getAddress(),
        editionId,
        1,
        goodSignature,
        [],
        {
          value: ethers.utils.parseEther("0.005"),
        }
      )
    ).to.be.revertedWith("Value incorrect");

    const mintTx = await editionCollection.mintEdition(
      await accounts[0].getAddress(),
      editionId,
      1,
      goodSignature,
      [],
      {
        value: ethers.utils.parseEther("0.01"),
      }
    );

    const mintResults = await mintTx.wait();

    expect(
      mintResults.events!.filter((evt) => evt.event === "Transfer").length
    ).to.equals(1);

    expect(await diamondCollection.tokenURI(1)).to.equals("foo");
    expect(await editionCollection.editionRevenue()).to.be.equal(
      ethers.utils.parseEther("0.01")
    );
  });

  it("should be able to presale mint an edition", async function () {
    const collectionId = "COLLECTION_ID_4";
    const signature = await signer.signMessage(
      ethers.utils.arrayify(
        ethers.utils.solidityKeccak256(
          ["string", "uint96"],
          [collectionId, feeRate]
        )
      )
    );
    const createDiamondTx = await niftyKitV3.createDiamond(
      collectionId,
      feeRate,
      signature,
      "NAME",
      "SYMBOL",
      [ethers.utils.id("edition")]
    );
    const createDiamondReceipt = await createDiamondTx.wait();
    const createdEvent = createDiamondReceipt.events?.find(
      (event) => event.event === "DiamondCreated"
    ) as DiamondCreatedEvent;
    const diamondAddress = createdEvent.args[0];
    const diamondCollection = DiamondCollection__factory.connect(
      diamondAddress,
      accounts[0]
    );
    const editionCollection = EditionFacet__factory.connect(
      diamondAddress,
      accounts[0]
    );

    const editionTx = await editionCollection.createEdition("foo", 0, 3, 3, 3);
    const editionTxResults = await editionTx.wait();
    const editionId = editionTxResults.events?.[0].args?.[0];
    expect((await editionCollection.editionsCount()).toNumber()).to.equals(1);

    let edition = await editionCollection.getEdition(editionId);
    expect(edition.active).to.equals(false);
    await editionCollection.setEditionActive(editionId, true);
    edition = await editionCollection.getEdition(editionId);
    expect(edition.active).to.equals(true);

    const presaleList = [];
    for (const account of accounts) {
      presaleList.push(await account.getAddress());
    }

    const [merkleRoot, hexProof] = getMerkleTreeBasic(
      presaleList,
      presaleList[1]
    );

    await expect(
      editionCollection.setEditionMerkleRoot(69, merkleRoot)
    ).to.be.revertedWith("Does not exist");

    await editionCollection.setEditionMerkleRoot(editionId, merkleRoot);

    const goodSignature = await accounts[0].signMessage(
      ethers.utils.arrayify(
        ethers.utils.solidityKeccak256(
          ["uint256"],
          [edition.nonce.add(editionId).toString()]
        )
      )
    );

    const mintTx = await editionCollection.mintEdition(
      await accounts[1].getAddress(),
      editionId,
      1,
      goodSignature,
      hexProof
    );

    const mintResults = await mintTx.wait();

    expect(
      mintResults.events!.filter((evt) => evt.event === "Transfer").length
    ).to.equals(1);

    expect(await diamondCollection.tokenURI(1)).to.equals("foo");
  });
});
