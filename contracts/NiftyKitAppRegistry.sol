// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {INiftyKitAppRegistry} from "./interfaces/INiftyKitAppRegistry.sol";

contract NiftyKitAppRegistry is OwnableUpgradeable, INiftyKitAppRegistry {
    Core internal _core;

    mapping(bytes32 => App) internal _apps;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() public initializer {
        __Ownable_init();
    }

    function setCore(
        address implementation,
        bytes4[] calldata interfaceIds,
        bytes4[] calldata selectors
    ) external onlyOwner {
        _core = Core({
            implementation: implementation,
            interfaceIds: interfaceIds,
            selectors: selectors
        });
    }

    function registerApp(
        bytes32 name,
        address implementation,
        bytes4 interfaceId,
        bytes4[] calldata selectors,
        uint8 version
    ) external onlyOwner {
        require(
            version > _apps[name].version,
            "NiftyKitAppRegistry: Version must be greater than previous"
        );

        _apps[name] = App({
            implementation: implementation,
            interfaceId: interfaceId,
            selectors: selectors,
            version: version
        });
    }

    function getApp(bytes32 name) external view returns (App memory) {
        return _apps[name];
    }

    function getCore() external view returns (Core memory) {
        return _core;
    }
}
