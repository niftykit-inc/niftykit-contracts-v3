// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {INiftyKitAppRegistry} from "./interfaces/INiftyKitAppRegistry.sol";

contract NiftyKitAppRegistry is OwnableUpgradeable, INiftyKitAppRegistry {
    mapping(bytes32 => App) internal _apps;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() public initializer {
        __Ownable_init();
    }

    function registerApp(
        bytes32 name,
        address implementation,
        bytes4 interfaceId,
        bytes4[] calldata selectors,
        uint8 version
    ) external onlyOwner {
        require(
            version > 0,
            "NiftyKitAppRegistry: Version must be greater than zero"
        );
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
}
