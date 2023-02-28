// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {SafeMathUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import {ECDSAUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";
import {AddressUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import {ClonesUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/ClonesUpgradeable.sol";
import {IDiamondCollection} from "./interfaces/IDiamondCollection.sol";
import {IDropKitPass} from "./interfaces/IDropKitPass.sol";
import {INiftyKitV3} from "./interfaces/INiftyKitV3.sol";

contract NiftyKitV3 is INiftyKitV3, Initializable, OwnableUpgradeable {
    using SafeMathUpgradeable for uint256;
    using AddressUpgradeable for address;
    using ECDSAUpgradeable for bytes32;

    address private _signer;
    address private _treasury;
    address private _appRegistry;
    address private _diamondImplementation;
    mapping(string => bool) _verifiedCollections;
    mapping(address => Collection) private _collections;

    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        _disableInitializers();
    }

    function initialize(
        address appRegistry_,
        address diamondImplementation_
    ) public initializer {
        _appRegistry = appRegistry_;
        _diamondImplementation = diamondImplementation_;
        _treasury = _msgSender();
        __Ownable_init();
    }

    function commission(
        address collection,
        uint256 amount
    ) public view override returns (uint256) {
        Collection memory _collection = _collections[collection];
        require(_collection.exists, "Invalid collection");

        return _collection.feeRate.mul(amount).div(10000);
    }

    function getFees(uint256 amount) external view override returns (uint256) {
        return commission(_msgSender(), amount);
    }

    function appRegistry() external view returns (address) {
        return _appRegistry;
    }

    function treasury() external view returns (address) {
        return _treasury;
    }

    function diamondImplementation() external view returns (address) {
        return _diamondImplementation;
    }

    function withdraw() external {
        uint256 balance = address(this).balance;
        require(balance > 0, "Not enough to withdraw");

        AddressUpgradeable.sendValue(payable(_treasury), balance);
    }

    function setTreasury(address newTreasury) external onlyOwner {
        _treasury = newTreasury;
    }

    function setSigner(address signer) external onlyOwner {
        _signer = signer;
    }

    function setDiamondImplementation(
        address implementation
    ) external onlyOwner {
        _diamondImplementation = implementation;
    }

    function setRate(address collection, uint256 rate) external onlyOwner {
        Collection storage _collection = _collections[collection];
        require(_collection.exists, "Does not exist");

        _collection.feeRate = rate;
    }

    function createDiamond(
        string memory collectionId,
        uint96 feeRate,
        bytes calldata signature,
        string memory name,
        string memory symbol,
        bytes32[] calldata apps
    ) external {
        require(_signer != address(0), "Signer not set");
        require(!_verifiedCollections[collectionId], "Already created");
        require(
            keccak256(abi.encodePacked(collectionId, feeRate))
                .toEthSignedMessageHash()
                .recover(signature) == _signer,
            "Invalid signature"
        );
        address deployed = ClonesUpgradeable.clone(_diamondImplementation);
        IDiamondCollection collection = IDiamondCollection(deployed);
        collection.initialize(_msgSender(), name, symbol, apps);

        _collections[deployed] = Collection(feeRate, true);
        _verifiedCollections[collectionId] = true;

        emit DiamondCreated(deployed, collectionId);
    }

    receive() external payable {}
}
