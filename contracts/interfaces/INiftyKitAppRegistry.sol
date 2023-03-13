// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

interface INiftyKitAppRegistry {
    struct App {
        address implementation;
        bytes4 interfaceId;
        bytes4[] selectors;
        uint8 version;
    }

    struct Core {
        address implementation;
        bytes4[] interfaceIds;
        bytes4[] selectors;
    }

    function getApp(bytes32 identifier) external view returns (App memory);

    function getCore() external view returns (Core memory);
}
