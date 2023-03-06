// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {OwnableRoles} from "solady/src/auth/OwnableRoles.sol";
import {ERC721AUpgradeable, IERC721AUpgradeable} from "erc721a-upgradeable/contracts/ERC721AUpgradeable.sol";
import {ERC721AQueryableUpgradeable} from "erc721a-upgradeable/contracts/extensions/ERC721AQueryableUpgradeable.sol";
import {ERC2981Upgradeable} from "@openzeppelin/contracts-upgradeable/token/common/ERC2981Upgradeable.sol";
import {OperatorFilterer} from "closedsea/src/OperatorFilterer.sol";
import {BaseStorage} from "./BaseStorage.sol";

contract NiftyKitERC721A is
    ERC721AUpgradeable,
    ERC721AQueryableUpgradeable,
    ERC2981Upgradeable,
    OwnableRoles,
    OperatorFilterer
{
    modifier preventTransfers(address from, uint256 tokenId) virtual {
        BaseStorage.Layout storage layout = BaseStorage.layout();
        BaseStorage.Transfer status = layout._transferStatus;

        if (
            status == BaseStorage.Transfer.BlockAll ||
            (status == BaseStorage.Transfer.AllowedOperatorsOnly &&
                !layout._allowedOperators[from] &&
                from != msg.sender) ||
            (status == BaseStorage.Transfer.BlockTokens &&
                layout._blockedTokenIds[tokenId])
        ) {
            revert("Transfers not allowed");
        }
        _;
    }

    function _initializeERC721A(
        string calldata name,
        string calldata symbol,
        address royalty,
        uint96 royaltyFee
    ) internal initializerERC721A {
        __ERC721A_init(name, symbol);
        __ERC721AQueryable_init();
        __ERC2981_init();
        _setDefaultRoyalty(royalty, royaltyFee);
    }

    function setBaseURI(
        string memory newBaseURI
    ) external onlyRolesOrOwner(BaseStorage.MANAGER_ROLE) {
        BaseStorage.layout()._baseURI = newBaseURI;
    }

    function setTokenURI(
        uint256 tokenId,
        bool isValue,
        string memory newBaseURI
    ) external onlyRolesOrOwner(BaseStorage.MANAGER_ROLE) {
        BaseStorage.layout()._tokenURIs[tokenId] = BaseStorage.URIEntry(
            isValue,
            newBaseURI
        );
    }

    function setTransferStatus(
        BaseStorage.Transfer status
    ) external onlyRolesOrOwner(BaseStorage.MANAGER_ROLE) {
        BaseStorage.layout()._transferStatus = status;
    }

    function setOperatorFilteringEnabled(
        bool isEnabled
    ) external onlyRolesOrOwner(BaseStorage.MANAGER_ROLE) {
        if (isEnabled) _registerForOperatorFiltering();
        BaseStorage.layout()._operatorFilteringEnabled = isEnabled;
    }

    function setAllowedOperator(
        address operator,
        bool isAllowed
    ) external onlyRolesOrOwner(BaseStorage.MANAGER_ROLE) {
        BaseStorage.layout()._allowedOperators[operator] = isAllowed;
    }

    function setBlockedTokenId(
        uint256 tokenId,
        bool isBlocked
    ) external onlyRolesOrOwner(BaseStorage.MANAGER_ROLE) {
        BaseStorage.layout()._blockedTokenIds[tokenId] = isBlocked;
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

    function isAllowedOperator(address operator) external view returns (bool) {
        return BaseStorage.layout()._allowedOperators[operator];
    }

    function isBlockedTokenId(uint256 tokenId) external view returns (bool) {
        return BaseStorage.layout()._blockedTokenIds[tokenId];
    }

    function operatorFilteringEnabled() external view returns (bool) {
        return BaseStorage.layout()._operatorFilteringEnabled;
    }

    function isApprovedForAll(
        address owner,
        address operator
    )
        public
        view
        override(ERC721AUpgradeable, IERC721AUpgradeable)
        returns (bool)
    {
        BaseStorage.Layout storage layout = BaseStorage.layout();
        if (
            layout._transferStatus == BaseStorage.Transfer.AllowedOperatorsOnly
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
        override(IERC721AUpgradeable, ERC721AUpgradeable)
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
        override(IERC721AUpgradeable, ERC721AUpgradeable)
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
        override(IERC721AUpgradeable, ERC721AUpgradeable)
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
        override(IERC721AUpgradeable, ERC721AUpgradeable)
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
        override(IERC721AUpgradeable, ERC721AUpgradeable)
        preventTransfers(from, tokenId)
        onlyAllowedOperator(from)
    {
        super.safeTransferFrom(from, to, tokenId, data);
    }

    function tokenURI(
        uint256 tokenId
    )
        public
        view
        virtual
        override(IERC721AUpgradeable, ERC721AUpgradeable)
        returns (string memory)
    {
        if (!_exists(tokenId)) revert URIQueryForNonexistentToken();
        BaseStorage.URIEntry memory uri = BaseStorage.layout()._tokenURIs[
            tokenId
        ];
        if (uri.isValue) return uri.tokenURI;

        string memory baseURI = _baseURI();
        return
            bytes(baseURI).length != 0
                ? string(abi.encodePacked(baseURI, _toString(tokenId)))
                : "";
    }

    function _baseURI() internal view virtual override returns (string memory) {
        return BaseStorage.layout()._baseURI;
    }

    function _isPriorityOperator(
        address operator
    ) internal view override returns (bool) {
        return BaseStorage.layout()._allowedOperators[operator];
    }

    function _operatorFilteringEnabled() internal view override returns (bool) {
        return BaseStorage.layout()._operatorFilteringEnabled;
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
        override(ERC721AUpgradeable, IERC721AUpgradeable, ERC2981Upgradeable)
        returns (bool)
    {
        return
            ERC721AUpgradeable.supportsInterface(interfaceId) ||
            ERC2981Upgradeable.supportsInterface(interfaceId);
    }
}
