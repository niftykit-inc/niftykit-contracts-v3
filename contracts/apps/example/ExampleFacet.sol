// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {InternalERC721AUpgradeable} from "../../internals/InternalERC721AUpgradeable.sol";
import {InternalOwnableRoles} from "../../internals/InternalOwnableRoles.sol";
import {BaseStorage} from "../../diamond/BaseStorage.sol";
import {ExampleStorage} from "./ExampleStorage.sol";

contract ExampleFacet is InternalOwnableRoles, InternalERC721AUpgradeable {
    function initializeExampleFacet(string memory foo_) public onlyOwner {
        require(!ExampleStorage.layout()._initialized, "already initialized");

        ExampleStorage.layout()._isFoo = foo_;
        ExampleStorage.layout()._initialized = true;
    }

    function finalizeExampleFacet() public onlyOwner {
        require(ExampleStorage.layout()._initialized, "not initialized");

        ExampleStorage.layout()._initialized = false;
        ExampleStorage.layout()._isFoo = "";
    }

    function getFoo() external view returns (string memory) {
        return ExampleStorage.layout()._isFoo;
    }

    function setFoo(
        string memory foo_
    ) external onlyRolesOrOwner(BaseStorage.MANAGER_ROLE) {
        ExampleStorage.layout()._isFoo = foo_;
    }
}
