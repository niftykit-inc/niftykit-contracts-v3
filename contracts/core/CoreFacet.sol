// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {AddressUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import {ERC2981Upgradeable} from "@openzeppelin/contracts-upgradeable/token/common/ERC2981Upgradeable.sol";
import {ERC721AUpgradeable} from "erc721a-upgradeable/contracts/ERC721AUpgradeable.sol";
import {OperatorFilterer} from "closedsea/src/OperatorFilterer.sol";
import {MinimalOwnableRoles} from "../internals/MinimalOwnableRoles.sol";
import {INiftyKitAppRegistry} from "../interfaces/INiftyKitAppRegistry.sol";
import {DiamondLoupeFacet} from "../diamond/DiamondLoupeFacet.sol";
import {NiftyKitDiamond} from "../diamond/NiftyKitDiamond.sol";
import {BaseStorage} from "../diamond/BaseStorage.sol";
import {CoreStorage} from "./CoreStorage.sol";

contract CoreFacet is
    ERC721AUpgradeable,
    ERC2981Upgradeable,
    MinimalOwnableRoles,
    OperatorFilterer,
    NiftyKitDiamond,
    DiamondLoupeFacet
{
    modifier preventTransfers(address from, uint256 tokenId) virtual {
        CoreStorage.Layout storage layout = CoreStorage.layout();
        CoreStorage.Transfer status = layout._transferStatus;

        if (
            status == CoreStorage.Transfer.BlockAll ||
            (status == CoreStorage.Transfer.AllowedOperatorsOnly &&
                !layout._allowedOperators[from] &&
                from != msg.sender) ||
            (layout._blockedTokenIds[tokenId])
        ) {
            revert("Transfers not allowed");
        }
        _;
    }

    function _initializeCore(
        address owner_,
        string calldata name_,
        string calldata symbol_,
        address royalty_,
        uint96 royaltyFee_
    ) external initializerERC721A {
        __ERC721A_init(name_, symbol_);
        _setDefaultRoyalty(royalty_, royaltyFee_);
        _initializeOwner(owner_);
    }

    function setBaseURI(
        string memory newBaseURI
    ) external onlyRolesOrOwner(BaseStorage.MANAGER_ROLE) {
        CoreStorage.layout()._baseURI = newBaseURI;
    }

    function setTokenURI(
        uint256 tokenId,
        bool isValue,
        string memory newBaseURI
    ) external onlyRolesOrOwner(BaseStorage.MANAGER_ROLE) {
        CoreStorage.layout()._tokenURIs[tokenId] = CoreStorage.URIEntry(
            isValue,
            newBaseURI
        );
    }

    function setTransferStatus(
        CoreStorage.Transfer status
    ) external onlyRolesOrOwner(BaseStorage.MANAGER_ROLE) {
        CoreStorage.layout()._transferStatus = status;
    }

    function setOperatorFilteringEnabled(
        bool isEnabled
    ) external onlyRolesOrOwner(BaseStorage.MANAGER_ROLE) {
        if (isEnabled) _registerForOperatorFiltering();
        CoreStorage.layout()._operatorFilteringEnabled = isEnabled;
    }

    function setAllowedOperator(
        address operator,
        bool isAllowed
    ) external onlyRolesOrOwner(BaseStorage.MANAGER_ROLE) {
        CoreStorage.layout()._allowedOperators[operator] = isAllowed;
    }

    function setBlockedTokenId(
        uint256 tokenId,
        bool isBlocked
    ) external onlyRolesOrOwner(BaseStorage.MANAGER_ROLE) {
        CoreStorage.layout()._blockedTokenIds[tokenId] = isBlocked;
    }

    function setDefaultRoyalty(
        address receiver,
        uint96 feeNumerator
    ) external onlyRolesOrOwner(BaseStorage.MANAGER_ROLE) {
        _setDefaultRoyalty(receiver, feeNumerator);
    }

    function setTokenRoyalty(
        uint256 tokenId,
        address receiver,
        uint96 feeNumerator
    ) external onlyRolesOrOwner(BaseStorage.MANAGER_ROLE) {
        _setTokenRoyalty(tokenId, receiver, feeNumerator);
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

    function isAllowedOperator(address operator) external view returns (bool) {
        return CoreStorage.layout()._allowedOperators[operator];
    }

    function isBlockedTokenId(uint256 tokenId) external view returns (bool) {
        return CoreStorage.layout()._blockedTokenIds[tokenId];
    }

    function operatorFilteringEnabled() external view returns (bool) {
        return CoreStorage.layout()._operatorFilteringEnabled;
    }

    function isApprovedForAll(
        address owner,
        address operator
    ) public view override returns (bool) {
        CoreStorage.Layout storage layout = CoreStorage.layout();
        if (
            layout._transferStatus == CoreStorage.Transfer.AllowedOperatorsOnly
        ) {
            return layout._allowedOperators[operator];
        }

        return super.isApprovedForAll(owner, operator);
    }

    function setApprovalForAll(
        address operator,
        bool approved
    )
        public
        override
        preventTransfers(operator, 0)
        onlyAllowedOperatorApproval(operator)
    {
        super.setApprovalForAll(operator, approved);
    }

    function approve(
        address operator,
        uint256 tokenId
    )
        public
        payable
        override
        preventTransfers(operator, tokenId)
        onlyAllowedOperatorApproval(operator)
    {
        super.approve(operator, tokenId);
    }

    function transferFrom(
        address from,
        address to,
        uint256 tokenId
    )
        public
        payable
        override
        preventTransfers(from, tokenId)
        onlyAllowedOperator(from)
    {
        super.transferFrom(from, to, tokenId);
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId
    )
        public
        payable
        override
        preventTransfers(from, tokenId)
        onlyAllowedOperator(from)
    {
        super.safeTransferFrom(from, to, tokenId);
    }

    function safeTransferFrom(
        address from,
        address to,
        uint256 tokenId,
        bytes memory data
    )
        public
        payable
        override
        preventTransfers(from, tokenId)
        onlyAllowedOperator(from)
    {
        super.safeTransferFrom(from, to, tokenId, data);
    }

    function tokenURI(
        uint256 tokenId
    ) public view virtual override returns (string memory) {
        if (!_exists(tokenId)) revert URIQueryForNonexistentToken();
        CoreStorage.URIEntry memory uri = CoreStorage.layout()._tokenURIs[
            tokenId
        ];
        if (uri.isValue) return uri.tokenURI;

        string memory baseURI = _baseURI();
        return
            bytes(baseURI).length != 0
                ? string(abi.encodePacked(baseURI, _toString(tokenId)))
                : "";
    }

    function treasury() external view returns (address) {
        return BaseStorage.layout()._treasury;
    }

    function getApp(
        bytes32 name
    ) external view returns (INiftyKitAppRegistry.App memory) {
        return BaseStorage.layout()._apps[name];
    }

    function _baseURI() internal view virtual override returns (string memory) {
        return CoreStorage.layout()._baseURI;
    }

    function _isPriorityOperator(
        address operator
    ) internal view override returns (bool) {
        return CoreStorage.layout()._allowedOperators[operator];
    }

    function _operatorFilteringEnabled() internal view override returns (bool) {
        return CoreStorage.layout()._operatorFilteringEnabled;
    }

    function _startTokenId() internal pure override returns (uint256) {
        return 1;
    }

    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        virtual
        override(DiamondLoupeFacet, ERC721AUpgradeable, ERC2981Upgradeable)
        returns (bool)
    {
        return super.supportsInterface(interfaceId);
    }
}
