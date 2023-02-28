import { ethers } from "ethers";

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
