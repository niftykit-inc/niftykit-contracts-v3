// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import {OperatorFilterer} from "closedsea/src/OperatorFilterer.sol";
import {AppFacet} from "../../internals/AppFacet.sol";
import {BaseStorage} from "../../diamond/BaseStorage.sol";

contract OperatorControlsFacet is OperatorFilterer, AppFacet {
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

    function isAllowedOperator(address operator) external view returns (bool) {
        return BaseStorage.layout()._allowedOperators[operator];
    }

    function operatorFilteringEnabled() external view returns (bool) {
        return BaseStorage.layout()._operatorFilteringEnabled;
    }
}
