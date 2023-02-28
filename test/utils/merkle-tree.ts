import { ethers } from "hardhat";
import keccak256 from "keccak256";
import MerkleTree from "merkletreejs";

export const hashAccount = (address: string, allowed: number) => {
  return Buffer.from(
    ethers.utils
      .solidityKeccak256(["address", "uint256"], [address, allowed])
      .slice(2),
    "hex"
  );
};

export const hashSignature = (hash: string) => {
  return Buffer.from(
    ethers.utils.solidityKeccak256(["bytes32"], [hash]).slice(2),
    "hex"
  );
};

export const hashAccountBasic = (address: string) => {
  return Buffer.from(
    ethers.utils.solidityKeccak256(["address"], [address]).slice(2),
    "hex"
  );
};

export function getMerkleTree(
  presaleList: (string | number)[][],
  address: string,
  quantity: number
) {
  const merkleTree = new MerkleTree(
    presaleList.map(([address, allowed]) =>
      hashAccount(address as string, allowed as number)
    ),
    keccak256,
    { sortPairs: true }
  );

  return [
    merkleTree.getHexRoot(),
    merkleTree.getHexProof(hashAccount(address, quantity)),
  ] as [string, string[]];
}

export function getMerkleTreeBasic(presaleList: string[], address: string) {
  const merkleTree = new MerkleTree(
    presaleList.map((address) => hashAccountBasic(address)),
    keccak256,
    { sortPairs: true }
  );

  return [
    merkleTree.getHexRoot(),
    merkleTree.getHexProof(hashAccountBasic(address)),
  ] as [string, string[]];
}

export function getMerkleTreeSignature(presaleList: string[], hash: string) {
  const merkleTree = new MerkleTree(
    presaleList.map((hash) => hashSignature(hash)),
    keccak256,
    { sortPairs: true }
  );

  return [
    merkleTree.getHexRoot(),
    merkleTree.getHexProof(hashSignature(hash)),
  ] as [string, string[]];
}
