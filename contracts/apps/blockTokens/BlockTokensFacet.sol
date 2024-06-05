// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {AppFacet} from "../../internals/AppFacet.sol";
import {BaseStorage} from "../../diamond/BaseStorage.sol";

contract BlockTokensFacet is AppFacet {
    function setBlockedTokenId(
        uint256 tokenId,
        bool isBlocked
    ) external onlyRolesOrOwner(BaseStorage.MANAGER_ROLE) {
        BaseStorage.layout()._blockedTokenIds[tokenId] = isBlocked;
    }

    function isBlockedTokenId(uint256 tokenId) external view returns (bool) {
        return BaseStorage.layout()._blockedTokenIds[tokenId];
    }
}
