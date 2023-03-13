// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

library ExampleStorage {
    bytes32 private constant STORAGE_SLOT =
        keccak256("niftykit.apps.example.storage");

    struct Layout {
        string _isFoo;
        bool _initialized;
    }

    function layout() internal pure returns (Layout storage ds) {
        bytes32 position = STORAGE_SLOT;
        // solhint-disable-next-line no-inline-assembly
        assembly {
            ds.slot := position
        }
    }
}
