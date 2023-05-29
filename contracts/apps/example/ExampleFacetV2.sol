// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {InternalERC721AUpgradeable} from "../../internals/InternalERC721AUpgradeable.sol";
import {InternalOwnableRoles} from "../../internals/InternalOwnableRoles.sol";
import {BaseStorage} from "../../diamond/BaseStorage.sol";
import {ExampleStorageV2} from "./ExampleStorageV2.sol";

contract ExampleFacetV2 is InternalOwnableRoles, InternalERC721AUpgradeable {
    function initializeExampleFacet(
        string memory foo_
    ) public onlyRolesOrOwner(BaseStorage.ADMIN_ROLE) {
        require(!ExampleStorageV2.layout()._initialized, "already initialized");

        ExampleStorageV2.layout()._isFoo = foo_;
        ExampleStorageV2.layout()._initialized = true;
        ExampleStorageV2.layout()._newField = 1; // This field remains 0 if upgraded from V1, since it is not initialized
    }

    function finalizeExampleFacet()
        public
        onlyRolesOrOwner(BaseStorage.ADMIN_ROLE)
    {
        require(ExampleStorageV2.layout()._initialized, "not initialized");

        ExampleStorageV2.layout()._initialized = false;
        ExampleStorageV2.layout()._isFoo = "";
        ExampleStorageV2.layout()._newField = 0;
    }

    // Updated
    function getFoo() external view returns (string memory) {
        return string.concat(ExampleStorageV2.layout()._isFoo, " V2");
    }

    // New
    function getNewField() external view returns (uint256) {
        return ExampleStorageV2.layout()._newField;
    }

    function setFoo(
        string memory foo_
    ) external onlyRolesOrOwner(BaseStorage.MANAGER_ROLE) {
        ExampleStorageV2.layout()._isFoo = foo_;
    }
}
