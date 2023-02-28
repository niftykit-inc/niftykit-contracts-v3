// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {AddressUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import {IDiamondCollection} from "../interfaces/IDiamondCollection.sol";
import {INiftyKitV3} from "../interfaces/INiftyKitV3.sol";
import {LibDiamond} from "../libraries/LibDiamond.sol";
import {DiamondLoupeFacet} from "./DiamondLoupeFacet.sol";
import {NiftyKitERC721A} from "./NiftyKitERC721A.sol";
import {NiftyKitDiamond} from "./NiftyKitDiamond.sol";
import {BaseStorage} from "./BaseStorage.sol";

contract DiamondCollection is
    Initializable,
    NiftyKitERC721A,
    NiftyKitDiamond,
    IDiamondCollection
{
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address owner,
        string calldata name,
        string calldata symbol,
        bytes32[] calldata apps
    ) external initializer {
        BaseStorage.Layout storage layout = BaseStorage.layout();
        layout._niftyKit = INiftyKitV3(msg.sender);
        layout._treasury = owner;
        _initializeERC721A(name, symbol);
        _initializeOwner(owner);
        if (apps.length > 0) {
            _initializeApps(apps);
        }
    }

    function setTreasury(address newTreasury) external onlyOwner {
        BaseStorage.layout()._treasury = newTreasury;
    }

    function withdraw() external onlyOwner {
        BaseStorage.Layout storage layout = BaseStorage.layout();
        uint256 balance = address(this).balance;
        require(balance > 0, "0 balance");

        AddressUpgradeable.sendValue(payable(layout._treasury), balance);
    }

    function treasury() external view returns (address) {
        return BaseStorage.layout()._treasury;
    }

    function installApp(bytes32 name) external onlyOwner {
        _installApp(name, address(0), "");
    }

    function installApp(bytes32 name, bytes memory data) external onlyOwner {
        _installApp(name, address(this), data);
    }

    function removeApp(bytes32 name) external onlyOwner {
        _removeApp(name, address(0), "");
    }

    function removeApp(bytes32 name, bytes memory data) external onlyOwner {
        _removeApp(name, address(this), data);
    }

    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        virtual
        override(DiamondLoupeFacet, NiftyKitERC721A)
        returns (bool)
    {
        return
            NiftyKitERC721A.supportsInterface(interfaceId) ||
            LibDiamond.diamondStorage().supportedInterfaces[interfaceId];
    }
}
