// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

library CoreStorage {
    enum Transfer {
        AllowAll,
        AllowedOperatorsOnly,
        BlockAll
    }

    bytes32 private constant STORAGE_SLOT = keccak256("niftykit.core");

    struct URIEntry {
        bool isValue;
        string tokenURI;
    }

    struct Layout {
        mapping(address => bool) _allowedOperators;
        mapping(uint256 => bool) _blockedTokenIds;
        mapping(uint256 => URIEntry) _tokenURIs;
        bool _operatorFilteringEnabled;
        Transfer _transferStatus;
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
