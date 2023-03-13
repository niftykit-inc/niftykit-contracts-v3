// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {OperatorFilterer} from "closedsea/src/OperatorFilterer.sol";
import {InternalOwnableRoles} from "../../internals/InternalOwnableRoles.sol";
import {BaseStorage} from "../../diamond/BaseStorage.sol";
import {CoreStorage} from "../../core/CoreStorage.sol";

contract OperatorControlsFacet is OperatorFilterer, InternalOwnableRoles {
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

    function isAllowedOperator(address operator) external view returns (bool) {
        return CoreStorage.layout()._allowedOperators[operator];
    }

    function operatorFilteringEnabled() external view returns (bool) {
        return CoreStorage.layout()._operatorFilteringEnabled;
    }
}
