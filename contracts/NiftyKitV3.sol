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
import {IERC173} from "./interfaces/IERC173.sol";

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
    ) public view override returns (uint256, uint256) {
        Collection memory _collection = _collections[collection];
        require(_collection.exists, "Invalid collection");
        uint256 feeAmount = _collection.feeRate.mul(amount).div(10000);

        if (_collection.feeType == FeeType.Seller) {
            return (feeAmount, 0);
        }

        if (_collection.feeType == FeeType.Buyer) {
            return (0, feeAmount);
        }

        return (feeAmount.div(2), feeAmount.div(2));
    }

    function getFees(
        uint256 amount
    ) external view override returns (uint256, uint256) {
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

    function setFeeType(address collection, FeeType feeType) external {
        Collection storage _collection = _collections[collection];
        require(_collection.exists, "Does not exist");
        require(IERC173(collection).owner() == _msgSender(), "Not the owner");

        _collection.feeType = feeType;
    }

    function createDiamond(
        string memory collectionId_,
        uint96 feeRate_,
        bytes calldata signature_,
        address treasury_,
        address royalty_,
        uint96 royaltyFee_,
        string memory name_,
        string memory symbol_,
        bytes32[] calldata apps_
    ) external {
        require(_signer != address(0), "Signer not set");
        require(!_verifiedCollections[collectionId_], "Already created");
        require(
            keccak256(abi.encodePacked(collectionId_, feeRate_))
                .toEthSignedMessageHash()
                .recover(signature_) == _signer,
            "Invalid signature"
        );
        address deployed = ClonesUpgradeable.clone(_diamondImplementation);
        IDiamondCollection collection = IDiamondCollection(deployed);
        collection.initialize(
            _msgSender(),
            treasury_,
            royalty_,
            royaltyFee_,
            name_,
            symbol_,
            apps_
        );

        _collections[deployed] = Collection(feeRate_, FeeType.Seller, true);
        _verifiedCollections[collectionId_] = true;

        emit DiamondCreated(deployed, collectionId_);
    }

    receive() external payable {}
}