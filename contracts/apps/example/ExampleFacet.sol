// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {AppFacet} from "../../internals/AppFacet.sol";
import {BaseStorage} from "../../diamond/BaseStorage.sol";
import {ExampleStorage} from "./ExampleStorage.sol";

contract ExampleFacet is AppFacet {
    function initializeExampleFacet(
        string memory foo_
    ) public onlyRolesOrOwner(BaseStorage.ADMIN_ROLE) {
        require(!ExampleStorage.layout()._initialized, "already initialized");

        ExampleStorage.layout()._isFoo = foo_;
        ExampleStorage.layout()._initialized = true;
    }

    function finalizeExampleFacet()
        public
        onlyRolesOrOwner(BaseStorage.ADMIN_ROLE)
    {
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
