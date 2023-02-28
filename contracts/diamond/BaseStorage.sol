// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {INiftyKitAppRegistry} from "../interfaces/INiftyKitAppRegistry.sol";
import {INiftyKitV3} from "../interfaces/INiftyKitV3.sol";

library BaseStorage {
    enum Transfer {
        AllowAll,
        AllowedOperatorsOnly,
        BlockTokens,
        BlockAll
    }

    bytes32 private constant STORAGE_SLOT = keccak256("niftykit.base.storage");
    uint256 public constant ADMIN_ROLE = 1 << 0;
    uint256 public constant MANAGER_ROLE = 1 << 1;
    uint256 public constant API_ROLE = 1 << 2;

    struct URIEntry {
        bool isValue;
        string tokenURI;
    }

    struct Layout {
        mapping(bytes32 => INiftyKitAppRegistry.App) _apps;
        mapping(address => bool) _allowedOperators;
        mapping(uint256 => bool) _blockedTokenIds;
        mapping(uint256 => URIEntry) _tokenURIs;
        bool _operatorFilteringEnabled;
        Transfer _transferStatus;
        INiftyKitV3 _niftyKit;
        address _treasury;
        string _baseURI;
    }

    function layout() internal pure returns (Layout storage ds) {
        bytes32 position = STORAGE_SLOT;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            ds.slot := position
        }
    }
}
