import { expect } from "chai";
import { Signer, Wallet } from "ethers";
import { ethers, network } from "hardhat";
import { DiamondCreatedEvent } from "typechain-types/contracts/NiftyKitV3";
import {
  BaseFacet,
  BaseFacet__factory,
  NiftyKitAppRegistry,
  NiftyKitV3,
  NiftyKitForwarder,
  OnboardingFacet,
  OnboardingFacet__factory,
} from "../typechain-types";
import {
  createBaseFacet,
  createNiftyKitAppRegistry,
  createNiftyKitForwarder,
  createNiftyKitV3,
  createOnboardingFacet,
  generateSigner,
  getInterfaceId,
  getSelectors,
} from "./utils/niftykit";

// maxAmount, maxPerWallet, maxPerMint
const salesParams = [[100, 10, 5], [200, 10, 5], [300, 10, 5] as const];
const linkIds = ["1", "2", "3"];

describe("OnboardingFacet", function () {
  let accounts: Signer[];
  let appRegistry: NiftyKitAppRegistry;
  let niftyKitV3: NiftyKitV3;
  let niftyKitForwarder: NiftyKitForwarder;
  let onboardingFacet: OnboardingFacet;
  let baseFacet: BaseFacet;
  let signer: Wallet;
  let owner: string;
  let minters: Signer[];
  let signatures: { [data: string]: string } = {};
  let diamondAddress: string;
  const mintUrls = [
    "https://nftkt.io/1",
    "https://nftkt.io/2",
    "https://nftkt.io/3",
  ];

  const expiration = Math.floor(
    new Date(Date.now() + 24 * 60 * 60 * 1000).getTime() / 1000
  ); // tomorrow
  const feeRate = 500;

  before(async function () {
    accounts = await ethers.getSigners();
    appRegistry = await createNiftyKitAppRegistry(accounts[0]);
    onboardingFacet = await createOnboardingFacet(accounts[0]);
    baseFacet = await createBaseFacet(accounts[0]);
    niftyKitForwarder = await createNiftyKitForwarder(accounts[0]);
    signer = generateSigner();
    minters = [accounts[1], accounts[2], accounts[3]];

    owner = await accounts[0].getAddress();
    const recipient = await accounts[1].getAddress();

    for (let i = 0; i < mintUrls.length; i++) {
      const signature = await accounts[0].signMessage(
        ethers.utils.arrayify(
          ethers.utils.solidityKeccak256(
            ["address", "uint256", "uint256", "uint256", "uint256", "string"],
            [recipient, ...salesParams[i], expiration, linkIds[i]]
          )
        )
      );

      signatures[mintUrls[i]] = signature;
    }

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
      ethers.utils.id("onboarding"),
      onboardingFacet.address,
      getInterfaceId(onboardingFacet.interface),
      getSelectors(onboardingFacet.interface),
      1
    );

    niftyKitV3 = await createNiftyKitV3(
      accounts[0],
      appRegistry.address,
      signer.address,
      niftyKitForwarder.address
    );
  });

  beforeEach(async function () {
    niftyKitV3 = await createNiftyKitV3(
      accounts[0],
      appRegistry.address,
      signer.address,
      niftyKitForwarder.address
    );

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
      owner,
      owner,
      500,
      "NAME",
      "SYMBOL",
      [ethers.utils.id("onboarding")]
    );
    const createDiamondReceipt = await createDiamondTx.wait();
    const createdEvent = createDiamondReceipt.events?.find(
      (event) => event.event === "DiamondCreated"
    ) as DiamondCreatedEvent;
    diamondAddress = createdEvent.args[0];

    const base = BaseFacet__factory.connect(diamondAddress, accounts[0]);
    expect(await base.owner()).to.eq(owner);

    await base.setMintSigner(owner);

    expect(await base.getMintSigner()).to.eq(owner);
  });

  it("should be able to signature mint one", async function () {
    const onboarding = OnboardingFacet__factory.connect(
      diamondAddress,
      accounts[0]
    );

    const txMint = await onboarding
      .connect(accounts[1])
      .linkMintTo(
        await minters[0].getAddress(),
        1,
        salesParams[0][0],
        salesParams[0][1],
        salesParams[0][2],
        expiration,
        linkIds[0],
        signatures[mintUrls[0]],
        {
          value: 0,
        }
      );

    const txMintReceipt = await txMint.wait();
    const transferEvent = txMintReceipt.events?.find(
      (event) => event.event === "Transfer"
    );

    expect(transferEvent).to.be.a("object");

    const base = BaseFacet__factory.connect(diamondAddress, accounts[0]);

    expect(await base.balanceOf(await minters[0].getAddress())).to.eq(1);
  });

  it("should not be able to signature mint if signature has expired", async function () {
    const onboarding = OnboardingFacet__factory.connect(
      diamondAddress,
      accounts[0]
    );

    // 2 days ago
    const expiration = Math.floor(
      new Date(Date.now() - 48 * 60 * 60 * 1000).getTime() / 1000
    );

    await expect(
      onboarding
        .connect(accounts[1])
        .linkMintTo(
          await minters[0].getAddress(),
          1,
          salesParams[0][0],
          salesParams[0][1],
          salesParams[0][2],
          expiration,
          linkIds[0],
          signatures[mintUrls[0]],
          {
            value: 0,
          }
        )
    ).to.be.revertedWith("Signature expired");
  });

  it("should not be able to signature mint using the same signature", async function () {
    const onboarding = OnboardingFacet__factory.connect(
      diamondAddress,
      accounts[0]
    );

    const txMint = await onboarding
      .connect(accounts[1])
      .linkMintTo(
        await minters[0].getAddress(),
        1,
        salesParams[0][0],
        salesParams[0][1],
        salesParams[0][2],
        expiration,
        linkIds[0],
        signatures[mintUrls[0]],
        {
          value: 0,
        }
      );

    const txMintReceipt = await txMint.wait();
    const transferEvent = txMintReceipt.events?.find(
      (event) => event.event === "Transfer"
    );

    expect(transferEvent).to.be.a("object");

    const base = BaseFacet__factory.connect(diamondAddress, accounts[0]);

    expect(await base.balanceOf(await minters[0].getAddress())).to.eq(1);

    await expect(
      onboarding
        .connect(accounts[1])
        .linkMintTo(
          await minters[0].getAddress(),
          1,
          salesParams[0][0],
          salesParams[0][1],
          salesParams[0][2],
          expiration,
          linkIds[0],
          signatures[mintUrls[0]],
          {
            value: 0,
          }
        )
    ).to.be.revertedWith("Signature already verified");
  });

  it("should be able to signature mint multiple mint URL", async function () {
    const onboarding = OnboardingFacet__factory.connect(
      diamondAddress,
      accounts[0]
    );

    const txMint = await onboarding
      .connect(accounts[1])
      .linkMintTo(
        await minters[0].getAddress(),
        1,
        salesParams[0][0],
        salesParams[0][1],
        salesParams[0][2],
        expiration,
        linkIds[0],
        signatures[mintUrls[0]],
        {
          value: 0,
        }
      );

    const txMintReceipt = await txMint.wait();
    const transferEvent = txMintReceipt.events?.find(
      (event) => event.event === "Transfer"
    );

    expect(transferEvent).to.be.a("object");

    const txMint2 = await onboarding
      .connect(accounts[1])
      .linkMintTo(
        await minters[0].getAddress(),
        1,
        salesParams[1][0],
        salesParams[1][1],
        salesParams[1][2],
        expiration,
        linkIds[1],
        signatures[mintUrls[1]],
        {
          value: 0,
        }
      );

    const txMintReceipt2 = await txMint2.wait();
    const transferEvent2 = txMintReceipt2.events?.find(
      (event) => event.event === "Transfer"
    );

    expect(transferEvent2).to.be.a("object");

    const base = BaseFacet__factory.connect(diamondAddress, accounts[0]);

    expect(await base.balanceOf(await minters[0].getAddress())).to.eq(2);
  });

  it("should not be able to signature mint if mint signer is not set", async function () {
    const onboarding = OnboardingFacet__factory.connect(
      diamondAddress,
      accounts[0]
    );

    const base = BaseFacet__factory.connect(diamondAddress, accounts[0]);
    await base.setMintSigner(ethers.constants.AddressZero); // Unset mint signer

    await expect(
      onboarding
        .connect(accounts[1])
        .linkMintTo(
          await minters[0].getAddress(),
          1,
          salesParams[0][0],
          salesParams[0][1],
          salesParams[0][2],
          expiration,
          linkIds[0],
          signatures[mintUrls[0]],
          {
            value: 0,
          }
        )
    ).to.be.revertedWith("Mint signer not set");
  });

  it("should not be able to mint if quantity is more than max per mint", async function () {
    const onboarding = OnboardingFacet__factory.connect(
      diamondAddress,
      accounts[0]
    );

    await expect(
      onboarding.connect(accounts[1]).linkMintTo(
        await minters[0].getAddress(),
        salesParams[0][2] + 1, // quantity greater than max per mint
        salesParams[0][0],
        salesParams[0][1],
        salesParams[0][2],
        expiration,
        linkIds[0],
        signatures[mintUrls[0]],
        {
          value: 0,
        }
      )
    ).to.be.revertedWith("Exceeded max per mint");
  });

  it("should not be able to mint more than max per wallet", async function () {
    const onboarding = OnboardingFacet__factory.connect(
      diamondAddress,
      accounts[0]
    );

    // Mint max per mint
    await onboarding
      .connect(accounts[1])
      .linkMintTo(
        await minters[0].getAddress(),
        salesParams[0][2],
        salesParams[0][0],
        salesParams[0][1],
        salesParams[0][2],
        expiration,
        linkIds[0],
        signatures[mintUrls[0]],
        {
          value: 0,
        }
      );

    // Mint max per mint again
    let newExpiration = Math.floor(
      new Date(Date.now() + 5 * 60 * 1000).getTime() / 1000
    );

    let newSignature = await accounts[0].signMessage(
      ethers.utils.arrayify(
        ethers.utils.solidityKeccak256(
          ["address", "uint256", "uint256", "uint256", "uint256", "string"],
          [
            await accounts[1].getAddress(),
            ...salesParams[0],
            newExpiration,
            linkIds[0],
          ]
        )
      )
    );

    await onboarding
      .connect(accounts[1])
      .linkMintTo(
        await minters[0].getAddress(),
        salesParams[0][2],
        salesParams[0][0],
        salesParams[0][1],
        salesParams[0][2],
        newExpiration,
        linkIds[0],
        newSignature,
        {
          value: 0,
        }
      );

    // attempt to mint again (should fail)

    newExpiration = Math.floor(
      new Date(Date.now() + 8 * 60 * 1000).getTime() / 1000
    );

    newSignature = await accounts[0].signMessage(
      ethers.utils.arrayify(
        ethers.utils.solidityKeccak256(
          ["address", "uint256", "uint256", "uint256", "uint256", "string"],
          [
            await accounts[1].getAddress(),
            ...salesParams[0],
            newExpiration,
            linkIds[0],
          ]
        )
      )
    );

    await expect(
      onboarding
        .connect(accounts[1])
        .linkMintTo(
          await minters[0].getAddress(),
          1,
          salesParams[0][0],
          salesParams[0][1],
          salesParams[0][2],
          newExpiration,
          linkIds[0],
          newSignature,
          {
            value: 0,
          }
        )
    ).to.be.revertedWith("Exceeded max per wallet");
  });

  it("should not be able to mint more than max amount", async function () {
    const onboarding = OnboardingFacet__factory.connect(
      diamondAddress,
      accounts[0]
    );

    let expiration = Math.floor(
      new Date(Date.now() + 5 * 60 * 1000).getTime() / 1000
    );

    let signature = await accounts[0].signMessage(
      ethers.utils.arrayify(
        ethers.utils.solidityKeccak256(
          ["address", "uint256", "uint256", "uint256", "uint256", "string"],
          [await minters[1].getAddress(), 10, 10, 10, expiration, linkIds[0]]
        )
      )
    );

    // mint 10
    await onboarding
      .connect(accounts[1])
      .linkMintTo(
        await minters[1].getAddress(),
        10,
        10,
        10,
        10,
        expiration,
        linkIds[0],
        signature,
        {
          value: 0,
        }
      );

    expiration = Math.floor(
      new Date(Date.now() + 10 * 60 * 1000).getTime() / 1000
    );

    signature = await accounts[0].signMessage(
      ethers.utils.arrayify(
        ethers.utils.solidityKeccak256(
          ["address", "uint256", "uint256", "uint256", "uint256", "string"],
          [await minters[0].getAddress(), 10, 10, 10, expiration, linkIds[0]]
        )
      )
    );

    await expect(
      onboarding
        .connect(accounts[1])
        .linkMintTo(
          await minters[0].getAddress(),
          1,
          10,
          10,
          10,
          expiration,
          linkIds[0],
          signature,
          {
            value: 0,
          }
        )
    ).to.be.revertedWith("Exceeded max supply");
  });

  it("should be able to forward a transfer", async function () {
    const onboarding = OnboardingFacet__factory.connect(
      diamondAddress,
      accounts[0]
    );

    // use to mint and to transfer with gasless tx
    const signer = ethers.Wallet.createRandom();
    const user = await signer.getAddress();
    const mintSignature = await accounts[0].signMessage(
      ethers.utils.arrayify(
        ethers.utils.solidityKeccak256(
          ["address", "uint256", "uint256", "uint256", "uint256", "string"],
          [user, 10, 10, 10, expiration, linkIds[0]]
        )
      )
    );

    const txMint = await onboarding.linkMintTo(
      user,
      1,
      10,
      10,
      10,
      expiration,
      linkIds[0],
      mintSignature,
      {
        value: 0,
      }
    );

    const txMintReceipt = await txMint.wait();
    let transferEvent = txMintReceipt.events?.find(
      (event) => event.event === "Transfer"
    );

    expect(transferEvent).to.be.a("object");

    const base = BaseFacet__factory.connect(diamondAddress, accounts[0]);

    expect(await base.balanceOf(user)).to.eq(1);

    const relayer = minters[1];
    const recipient = await relayer.getAddress();

    expect(await base.balanceOf(recipient)).to.eq(0);

    const nonce = await niftyKitForwarder.getNonce(user);

    const functionData = base.interface.encodeFunctionData("transferFrom", [
      user,
      recipient,
      1,
    ]);

    const request = {
      from: user,
      to: base.address,
      value: 0,
      gas: 1e6,
      nonce,
      data: functionData,
    };

    const network = await relayer?.provider?.getNetwork();
    const chainId = network?.chainId || 1;

    const signature = await signer._signTypedData(
      // Domain
      {
        name: "MinimalForwarder",
        version: "0.0.1",
        chainId,
        verifyingContract: niftyKitForwarder.address,
      },
      // Types
      {
        ForwardRequest: [
          { name: "from", type: "address" },
          { name: "to", type: "address" },
          { name: "value", type: "uint256" },
          { name: "gas", type: "uint256" },
          { name: "nonce", type: "uint256" },
          { name: "data", type: "bytes" },
        ],
      },
      // Value
      request
    );

    const tx = await niftyKitForwarder.execute(request, signature);
    await tx.wait();

    const transferFilter = base.filters.Transfer(user, recipient, 1);
    transferEvent = (await base.queryFilter(transferFilter))[0];
    expect(transferEvent).to.be.a("object");
    expect(await base.balanceOf(user)).to.eq(0);
    expect(await base.balanceOf(recipient)).to.eq(1);
  });
});
