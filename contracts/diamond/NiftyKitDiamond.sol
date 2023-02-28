// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {LibDiamond} from "../libraries/LibDiamond.sol";
import {IDiamondCut} from "../interfaces/IDiamondCut.sol";
import {INiftyKitAppRegistry} from "../interfaces/INiftyKitAppRegistry.sol";
import {INiftyKitDiamond} from "../interfaces/INiftyKitDiamond.sol";
import {INiftyKitV3} from "../interfaces/INiftyKitV3.sol";
import {DiamondLoupeFacet} from "./DiamondLoupeFacet.sol";
import {BaseStorage} from "./BaseStorage.sol";

abstract contract NiftyKitDiamond is
    DiamondLoupeFacet,
    INiftyKitDiamond
{
    function getApp(
        bytes32 name
    ) external view returns (INiftyKitAppRegistry.App memory) {
        return BaseStorage.layout()._apps[name];
    }



    function _installApp(
        bytes32 name,
        address init,
        bytes memory data
    ) internal {
        BaseStorage.Layout storage layout = BaseStorage.layout();
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
        INiftyKitAppRegistry registry = INiftyKitAppRegistry(
            layout._niftyKit.appRegistry()
        );
        INiftyKitAppRegistry.App memory app = registry.getApp(name);
        require(app.version > 0, "App does not exist");

        IDiamondCut.FacetCut[] memory facetCuts = new IDiamondCut.FacetCut[](1);
        facetCuts[0] = IDiamondCut.FacetCut({
            facetAddress: app.implementation,
            action: IDiamondCut.FacetCutAction.Add,
            functionSelectors: app.selectors
        });

        ds.supportedInterfaces[app.interfaceId] = true;

        LibDiamond.diamondCut(facetCuts, init, data);
        layout._apps[name] = app;
    }

    function _removeApp(
        bytes32 name,
        address init,
        bytes memory data
    ) internal {
        BaseStorage.Layout storage layout = BaseStorage.layout();
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
        INiftyKitAppRegistry.App memory app = layout._apps[name];
        require(app.version > 0, "App does not exist");

        IDiamondCut.FacetCut[] memory facetCuts = new IDiamondCut.FacetCut[](1);
        facetCuts[0] = IDiamondCut.FacetCut({
            facetAddress: address(0),
            action: IDiamondCut.FacetCutAction.Remove,
            functionSelectors: app.selectors
        });

        ds.supportedInterfaces[app.interfaceId] = false;

        // execute callback function before performing a diamond cut
        LibDiamond.initializeDiamondCut(init, data);
        LibDiamond.diamondCut(facetCuts, address(0), "");
        delete layout._apps[name];
    }

    function _initializeApps(bytes32[] calldata names) internal {
        uint256 length = names.length;
        BaseStorage.Layout storage layout = BaseStorage.layout();
        LibDiamond.DiamondStorage storage ds = LibDiamond.diamondStorage();
        INiftyKitAppRegistry registry = INiftyKitAppRegistry(
            layout._niftyKit.appRegistry()
        );
        IDiamondCut.FacetCut[] memory facetCuts = new IDiamondCut.FacetCut[](
            length
        );
        for (uint256 i = 0; i < length; ) {
            INiftyKitAppRegistry.App memory app = registry.getApp(names[i]);
            if (app.version == 0) revert("App does not exist");

            facetCuts[i] = IDiamondCut.FacetCut({
                facetAddress: app.implementation,
                action: IDiamondCut.FacetCutAction.Add,
                functionSelectors: app.selectors
            });

            ds.supportedInterfaces[app.interfaceId] = true;
            layout._apps[names[i]] = app;

            unchecked {
                i++;
            }
        }

        LibDiamond.diamondCut(facetCuts, address(0), "");
    }

    // Find facet for function that is called and execute the
    // function if a facet is found and return any value.
    fallback() external payable {
        LibDiamond.DiamondStorage storage ds;
        bytes32 position = LibDiamond.DIAMOND_STORAGE_POSITION;
        // get diamond storage
        assembly {
            ds.slot := position
        }
        // get facet from function selector
        address facet = address(bytes20(ds.facets[msg.sig]));
        require(facet != address(0), "Diamond: Function does not exist");
        // Execute external function from facet using delegatecall and return any value.
        assembly {
            // copy function selector and any arguments
            calldatacopy(0, 0, calldatasize())
            // execute function call using the facet
            let result := delegatecall(gas(), facet, 0, calldatasize(), 0, 0)
            // get any return value
            returndatacopy(0, 0, returndatasize())
            // return any return value or error back to the caller
            switch result
            case 0 {
                revert(0, returndatasize())
            }
            default {
                return(0, returndatasize())
            }
        }
    }

    receive() external payable {}
}
