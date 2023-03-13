// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {INiftyKitAppRegistry} from "./interfaces/INiftyKitAppRegistry.sol";

contract NiftyKitAppRegistry is OwnableUpgradeable, INiftyKitAppRegistry {
    Base internal _base;
    mapping(bytes32 => App) internal _apps;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize() public initializer {
        __Ownable_init();
    }

    function setBase(
        address implementation,
        bytes4[] calldata interfaceIds,
        bytes4[] calldata selectors,
        uint8 version
    ) external onlyOwner {
        _base = Base({
            implementation: implementation,
            interfaceIds: interfaceIds,
            selectors: selectors,
            version: version
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

    function getBase() external view returns (Base memory) {
        return _base;
    }
}
