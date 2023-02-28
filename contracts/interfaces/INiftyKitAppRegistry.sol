// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

interface INiftyKitAppRegistry {
    struct App {
        address implementation;
        bytes4 interfaceId;
        bytes4[] selectors;
        uint8 version;
    }

    function getApp(bytes32 identifier) external view returns (App memory);
}
