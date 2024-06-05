import { ethers } from "ethers";
import { BaseFacet__factory } from "../typechain-types";

async function main() {
  const baseInterface = BaseFacet__factory.createInterface();
  let interfaceId: ethers.BigNumber = ethers.constants.Zero;

  const functions = [
    "facetAddress(bytes4)",
    "facetAddresses()",
    "facetFunctionSelectors(address)",
    "facets()",
  ];

  functions.forEach((fn) => {
    interfaceId = interfaceId.xor(baseInterface.getSighash(fn));
  });

  console.log(interfaceId.toHexString());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
