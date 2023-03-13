// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {InternalOwnableRoles} from "../../internals/InternalOwnableRoles.sol";
import {BaseStorage} from "../../diamond/BaseStorage.sol";
import {CoreStorage} from "../../core/CoreStorage.sol";

contract BlockTokensFacet is InternalOwnableRoles {
    function setBlockedTokenId(
        uint256 tokenId,
        bool isBlocked
    ) external onlyRolesOrOwner(BaseStorage.MANAGER_ROLE) {
        CoreStorage.layout()._blockedTokenIds[tokenId] = isBlocked;
    }

    function isBlockedTokenId(uint256 tokenId) external view returns (bool) {
        return CoreStorage.layout()._blockedTokenIds[tokenId];
    }
}
