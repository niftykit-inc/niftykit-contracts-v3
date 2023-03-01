// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {INiftyKitDiamond} from "./INiftyKitDiamond.sol";

interface IDiamondCollection is INiftyKitDiamond {
    function initialize(
        address owner,
        address treasury,
        address royalty,
        uint96 royaltyFee,
        string memory name,
        string memory symbol,
        bytes32[] calldata apps
    ) external;
}
