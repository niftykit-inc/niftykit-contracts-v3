import { Signer, ethers } from "ethers";
import { upgrades } from "hardhat";
import {
  DropFacet__factory,
  EditionFacet__factory,
  NiftyKitAppRegistry,
  NiftyKitAppRegistry__factory,
  DiamondCollection__factory,
  NiftyKitV3,
  NiftyKitV3__factory,
  ExampleFacet__factory,
  MockERC20__factory,
  ApeDropFacet__factory,
  MockOperator__factory,
} from "../../typechain-types";

export async function createNiftyKitV3(
  signer: Signer,
  appRegistryAddress: string,
  implementationAddress: string,
  signerAddress?: string
) {
  const factory = new NiftyKitV3__factory(signer);
  const niftyKitV3 = await upgrades.deployProxy(factory, [
    appRegistryAddress,
    implementationAddress,
  ]);
  const res = (await niftyKitV3.deployed()) as NiftyKitV3;
  if (signerAddress) {
    await res.setSigner(signerAddress);
  }
  return res;
}

export async function createNiftyKitAppRegistry(signer: Signer) {
  const factory = new NiftyKitAppRegistry__factory(signer);
  const niftyKitAppRegistry = await upgrades.deployProxy(factory, []);
  const res = (await niftyKitAppRegistry.deployed()) as NiftyKitAppRegistry;
  return res;
}

export async function createImplementation(signer: Signer) {
  const factory = new DiamondCollection__factory(signer);
  const facet = await factory.deploy();
  const res = await facet.deployed();
  return res;
}

export async function createDropFacet(signer: Signer) {
  const factory = new DropFacet__factory(signer);
  const facet = await factory.deploy();
  const res = await facet.deployed();
  return res;
}

export async function createEditionFacet(signer: Signer) {
  const factory = new EditionFacet__factory(signer);
  const facet = await factory.deploy();
  const res = await facet.deployed();
  return res;
}

export async function createExampleFacet(signer: Signer) {
  const factory = new ExampleFacet__factory(signer);
  const facet = await factory.deploy();
  const res = await facet.deployed();
  return res;
}

export async function createMockERC20(signer: Signer) {
  const factory = new MockERC20__factory(signer);
  const mockERC20 = await factory.deploy();
  const res = await mockERC20.deployed();
  return res;
}

export async function createApeCoinFacet(signer: Signer) {
  const factory = new ApeDropFacet__factory(signer);
  const facet = await factory.deploy();
  const res = await facet.deployed();
  return res;
}

export async function createMockOperator(signer: Signer) {
  const factory = new MockOperator__factory(signer);
  const operator = await factory.deploy();
  const res = await operator.deployed();
  return res;
}

export function generateSigner() {
  return ethers.Wallet.createRandom();
}

export function getSelectors(contractInterface: ethers.utils.Interface) {
  return Object.keys(contractInterface.functions).map((fn) =>
    contractInterface.getSighash(fn)
  );
}

export function getInterfaceId(contractInterface: ethers.utils.Interface) {
  let interfaceId: ethers.BigNumber = ethers.constants.Zero;

  Object.keys(contractInterface.functions).forEach((fn) => {
    interfaceId = interfaceId.xor(contractInterface.getSighash(fn));
  });

  return interfaceId.toHexString();
}
