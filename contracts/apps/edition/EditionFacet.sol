// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {AddressUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import {SafeMathUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import {MerkleProofUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/cryptography/MerkleProofUpgradeable.sol";
import {ECDSAUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/cryptography/ECDSAUpgradeable.sol";
import {ERC721AStorage} from "erc721a-upgradeable/contracts/ERC721AStorage.sol";
import {InternalERC721AUpgradeable} from "../../internals/InternalERC721AUpgradeable.sol";
import {InternalOwnableRoles} from "../../internals/InternalOwnableRoles.sol";
import {INiftyKitV3} from "../../interfaces/INiftyKitV3.sol";
import {BaseStorage} from "../../diamond/BaseStorage.sol";
import {EditionStorage} from "./EditionStorage.sol";

contract EditionFacet is InternalOwnableRoles, InternalERC721AUpgradeable {
    event EditionCreated(uint256 indexed editionId);
    event EditionMinted(
        address indexed to,
        uint256 indexed editionId,
        uint256 quantity,
        uint256 value
    );

    using AddressUpgradeable for address;
    using SafeMathUpgradeable for uint256;
    using ECDSAUpgradeable for bytes32;

    function createEdition(
        string memory tokenURI,
        uint256 price,
        uint256 maxQuantity,
        uint256 maxPerWallet,
        uint256 maxPerMint
    ) external onlyRolesOrOwner(BaseStorage.MANAGER_ROLE) {
        EditionStorage.Layout storage layout = EditionStorage.layout();

        uint256 editionId = layout._count;
        layout._editions[editionId] = EditionStorage.Edition({
            tokenURI: tokenURI,
            merkleRoot: "",
            price: price,
            quantity: 0,
            maxQuantity: maxQuantity,
            maxPerWallet: maxPerWallet,
            maxPerMint: maxPerMint,
            nonce: 0,
            signer: msg.sender,
            active: false
        });

        unchecked {
            layout._count = editionId.add(1);
        }

        emit EditionCreated(editionId);
    }

    function updateEdition(
        uint256 editionId,
        uint256 price,
        uint256 maxQuantity,
        uint256 maxPerWallet,
        uint256 maxPerMint
    ) external onlyRolesOrOwner(BaseStorage.MANAGER_ROLE) {
        EditionStorage.Layout storage layout = EditionStorage.layout();
        require(layout._count > editionId, "Does not exist");

        layout._editions[editionId].price = price;
        layout._editions[editionId].maxQuantity = maxQuantity;
        layout._editions[editionId].maxPerWallet = maxPerWallet;
        layout._editions[editionId].maxPerMint = maxPerMint;
    }

    function setEditionTokenURI(
        uint256 editionId,
        string memory tokenURI
    ) external onlyRolesOrOwner(BaseStorage.MANAGER_ROLE) {
        EditionStorage.Layout storage layout = EditionStorage.layout();
        require(layout._count > editionId, "Does not exist");

        layout._editions[editionId].tokenURI = tokenURI;
    }

    function setEditionMerkleRoot(
        uint256 editionId,
        bytes32 merkleRoot
    ) external onlyRolesOrOwner(BaseStorage.MANAGER_ROLE) {
        EditionStorage.Layout storage layout = EditionStorage.layout();
        require(layout._count > editionId, "Does not exist");

        layout._editions[editionId].merkleRoot = merkleRoot;
    }

    function setEditionActive(
        uint256 editionId,
        bool active
    ) external onlyRolesOrOwner(BaseStorage.MANAGER_ROLE) {
        EditionStorage.Layout storage layout = EditionStorage.layout();
        require(layout._count > editionId, "Does not exist");

        layout._editions[editionId].active = active;
    }

    function setEditionSigner(
        uint256 editionId,
        address signer
    ) external onlyRolesOrOwner(BaseStorage.MANAGER_ROLE) {
        EditionStorage.Layout storage layout = EditionStorage.layout();
        require(layout._count > editionId, "Does not exist");

        layout._editions[editionId].signer = signer;
    }

    function invalidateSignature(
        uint256 editionId
    ) external onlyRolesOrOwner(BaseStorage.MANAGER_ROLE) {
        EditionStorage.Layout storage layout = EditionStorage.layout();
        require(layout._count > editionId, "Does not exist");

        EditionStorage.Edition storage edition = layout._editions[editionId];
        edition.nonce = edition.nonce.add(1);
    }

    function mintEdition(
        address recipient,
        uint256 editionId,
        uint256 quantity,
        bytes calldata signature,
        bytes32[] calldata proof
    ) external payable {
        INiftyKitV3 niftyKit = BaseStorage.layout()._niftyKit;
        EditionStorage.Layout storage layout = EditionStorage.layout();
        require(layout._count > editionId, "Does not exist");

        EditionStorage.Edition storage edition = layout._editions[editionId];
        require(edition.active, "Not active");
        require(edition.price.mul(quantity) <= msg.value, "Value incorrect");
        require(quantity <= edition.maxPerMint, "Exceeded max per mint");
        require(
            edition.maxQuantity == 0 ||
                edition.quantity.add(quantity) <= edition.maxQuantity,
            "Exceeded max amount"
        );
        require(
            layout._mintCount[editionId][recipient].add(quantity) <=
                edition.maxPerWallet,
            "Exceeded max per wallet"
        );
        if (edition.merkleRoot != "") {
            require(
                MerkleProofUpgradeable.verify(
                    proof,
                    edition.merkleRoot,
                    keccak256(abi.encodePacked(recipient))
                ),
                "Invalid proof"
            );
        }
        require(
            keccak256(abi.encodePacked(editionId.add(edition.nonce)))
                .toEthSignedMessageHash()
                .recover(signature) == edition.signer,
            "Invalid signature"
        );

        unchecked {
            layout._editionRevenue = layout._editionRevenue.add(msg.value);
            edition.quantity = edition.quantity.add(quantity);
            layout._mintCount[editionId][recipient] = layout
            ._mintCount[editionId][recipient].add(quantity);
        }

        AddressUpgradeable.sendValue(
            payable(address(niftyKit)),
            niftyKit.getFees(msg.value)
        );

        uint256 startTokenId = ERC721AStorage.layout()._currentIndex;
        for (
            uint256 tokenId = startTokenId;
            tokenId < quantity + startTokenId;

        ) {
            BaseStorage.layout()._tokenURIs[tokenId] = BaseStorage.URIEntry(
                true,
                edition.tokenURI
            );
            unchecked {
                tokenId++;
            }
        }

        _mint(recipient, quantity);

        emit EditionMinted(recipient, editionId, quantity, msg.value);
    }

    function getEdition(
        uint256 editionId
    ) external view returns (EditionStorage.Edition memory) {
        return EditionStorage.layout()._editions[editionId];
    }

    function editionRevenue() external view returns (uint256) {
        return EditionStorage.layout()._editionRevenue;
    }

    function editionsCount() external view returns (uint256) {
        return EditionStorage.layout()._count;
    }
}
