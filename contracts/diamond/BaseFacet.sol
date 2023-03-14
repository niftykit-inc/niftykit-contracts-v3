// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {AddressUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import {ERC721AUpgradeable} from "erc721a-upgradeable/contracts/ERC721AUpgradeable.sol";
import {ERC721A__InitializableStorage} from "erc721a-upgradeable/contracts/ERC721A__InitializableStorage.sol";
import {ERC2981} from "@solidstate/contracts/token/common/ERC2981/ERC2981.sol";
import {ERC2981Storage} from "@solidstate/contracts/token/common/ERC2981/ERC2981Storage.sol";
import {IERC165} from "@solidstate/contracts/interfaces/IERC165.sol";
import {OperatorFilterer} from "closedsea/src/OperatorFilterer.sol";
import {MinimalOwnableRoles} from "../internals/MinimalOwnableRoles.sol";
import {INiftyKitAppRegistry} from "../interfaces/INiftyKitAppRegistry.sol";
import {IDiamondCut} from "../interfaces/IDiamondCut.sol";
import {DiamondLoupeFacet} from "./DiamondLoupeFacet.sol";
import {LibDiamond} from "../libraries/LibDiamond.sol";
import {BaseStorage} from "./BaseStorage.sol";

contract BaseFacet is
    ERC721AUpgradeable,
    MinimalOwnableRoles,
    ERC2981,
    OperatorFilterer,
    DiamondLoupeFacet
{
    modifier preventTransfers(address from, uint256 tokenId) virtual {
        BaseStorage.Layout storage layout = BaseStorage.layout();
        BaseStorage.Transfer status = layout._transferStatus;

        if (
            status == BaseStorage.Transfer.BlockAll ||
            (status == BaseStorage.Transfer.AllowedOperatorsOnly &&
                !layout._allowedOperators[from] &&
                from != msg.sender) ||
            (layout._blockedTokenIds[tokenId])
        ) {
            revert("Transfers not allowed");
        }
        _;
    }

    constructor() initializerERC721A {}

    function _initialize(
        address owner_,
        string calldata name_,
        string calldata symbol_,
        address royalty_,
        uint16 royaltyBps_
    ) external initializerERC721A {
        __ERC721A_init(name_, symbol_);
        _initializeOwner(owner_);

        ERC2981Storage.Layout storage layout = ERC2981Storage.layout();
        layout.defaultRoyaltyBPS = royaltyBps_;
        layout.defaultRoyaltyReceiver = royalty_;
    }

    function setBaseURI(
        string memory newBaseURI
    ) external onlyRolesOrOwner(BaseStorage.MANAGER_ROLE) {
        BaseStorage.layout()._baseURI = newBaseURI;
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

    function isApprovedForAll(
        address owner,
        address operator
    ) public view override returns (bool) {
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

    function treasury() external view returns (address) {
        return BaseStorage.layout()._treasury;
    }

    function getApp(
        bytes32 name
    ) external view returns (INiftyKitAppRegistry.App memory) {
        return BaseStorage.layout()._apps[name];
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

    function _installApp(
        bytes32 name,
        address init,
        bytes memory data
    ) internal {
        BaseStorage.Layout storage layout = BaseStorage.layout();
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
        INiftyKitAppRegistry registry = INiftyKitAppRegistry(
            layout._niftyKit.appRegistry()
        );
        INiftyKitAppRegistry.App memory app = registry.getApp(name);
        require(app.version > 0, "App does not exist");

        IDiamondCut.FacetCut[] memory facetCuts = new IDiamondCut.FacetCut[](1);
        facetCuts[0] = IDiamondCut.FacetCut({
            facetAddress: app.implementation,
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: app.selectors
        });

        ds.supportedInterfaces[app.interfaceId] = true;

        LibDiamond.diamondCut(facetCuts, init, data);
        layout._apps[name] = app;
    }

    function _removeApp(
        bytes32 name,
        address init,
        bytes memory data
    ) internal {
        BaseStorage.Layout storage layout = BaseStorage.layout();
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
        INiftyKitAppRegistry.App memory app = layout._apps[name];
        require(app.version > 0, "App does not exist");

        IDiamondCut.FacetCut[] memory facetCuts = new IDiamondCut.FacetCut[](1);
        facetCuts[0] = IDiamondCut.FacetCut({
            facetAddress: address(0),
            action: IDiamondCut.FacetCutAction.Remove,
            functionSelectors: app.selectors
        });

        ds.supportedInterfaces[app.interfaceId] = false;

        // execute callback function before performing a diamond cut
        LibDiamond.initializeDiamondCut(init, data);
        LibDiamond.diamondCut(facetCuts, address(0), "");
        delete layout._apps[name];
    }

    function supportsInterface(
        bytes4 interfaceId
    )
        public
        view
        virtual
        override(DiamondLoupeFacet, ERC721AUpgradeable, IERC165)
        returns (bool)
    {
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
        return ds.supportedInterfaces[interfaceId];
    }
}
