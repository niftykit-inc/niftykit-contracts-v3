// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

interface INiftyKitDiamond {
    function installApp(bytes32 name) external;

    function installApp(bytes32 name, bytes memory data) external;

    function removeApp(bytes32 name) external;

    function removeApp(bytes32 name, bytes memory data) external;
}
