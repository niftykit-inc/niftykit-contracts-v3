// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {IERC721} from "@solidstate/contracts/interfaces/IERC721.sol";

contract MockOperator {
    function mockTransfer(
        address collectionAddress,
        address from,
        address to,
        uint256 tokenId
    ) external {
        IERC721 collection = IERC721(collectionAddress);

        collection.safeTransferFrom(from, to, tokenId);
    }
}
