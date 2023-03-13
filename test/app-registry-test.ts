import { expect } from "chai";
import { Signer } from "ethers";
import { ethers } from "hardhat";
import { NiftyKitAppRegistry } from "../typechain-types";
import {
  createNiftyKitAppRegistry,
  createDropFacet,
  getInterfaceId,
  getSelectors,
} from "./utils/niftykit";

describe("NiftyKitAppRegistry", function () {
  let accounts: Signer[];
  let appRegistry: NiftyKitAppRegistry;

  beforeEach(async function () {
    accounts = await ethers.getSigners();
    appRegistry = await createNiftyKitAppRegistry(accounts[0]);
  });

  it("should be able to register an app", async function () {
    const dropFacet = await createDropFacet(accounts[0]);

    // register app
    await appRegistry.registerApp(
      ethers.utils.id("drop"),
      dropFacet.address,
      getInterfaceId(dropFacet.interface),
      getSelectors(dropFacet.interface),
      1
    );

    const app = await appRegistry.getApp(ethers.utils.id("drop"));
    expect(app.implementation).to.eq(dropFacet.address);
  });

  it("should be not able to register an app with invalid version", async function () {
    const dropFacet = await createDropFacet(accounts[0]);

    // register app
    await expect(
      appRegistry.registerApp(
        ethers.utils.id("drop"),
        dropFacet.address,
        getInterfaceId(dropFacet.interface),
        getSelectors(dropFacet.interface),
        0
      )
    ).to.be.revertedWith(
      "NiftyKitAppRegistry: Version must be greater than previous"
    );
  });

  it("should be not able to register an app with previous version", async function () {
    const dropFacet = await createDropFacet(accounts[0]);

    // register app
    await appRegistry.registerApp(
      ethers.utils.id("drop"),
      dropFacet.address,
      getInterfaceId(dropFacet.interface),
      getSelectors(dropFacet.interface),
      1
    );

    // register app
    await expect(
      appRegistry.registerApp(
        ethers.utils.id("drop"),
        dropFacet.address,
        getInterfaceId(dropFacet.interface),
        getSelectors(dropFacet.interface),
        1
      )
    ).to.be.revertedWith(
      "NiftyKitAppRegistry: Version must be greater than previous"
    );
  });
});
