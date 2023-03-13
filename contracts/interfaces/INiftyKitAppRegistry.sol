// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

interface INiftyKitAppRegistry {
    struct App {
        address implementation;
        bytes4 interfaceId;
        bytes4[] selectors;
        uint8 version;
    }

    struct Base {
        address implementation;
        bytes4[] interfaceIds;
        bytes4[] selectors;
    }

    function getApp(bytes32 identifier) external view returns (App memory);

    function getBase() external view returns (Base memory);
}
