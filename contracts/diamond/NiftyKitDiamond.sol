// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

import {LibDiamond} from "../libraries/LibDiamond.sol";
import {IDiamondCut} from "../interfaces/IDiamondCut.sol";
import {INiftyKitAppRegistry} from "../interfaces/INiftyKitAppRegistry.sol";
import {INiftyKitV3} from "../interfaces/INiftyKitV3.sol";
import {BaseStorage} from "./BaseStorage.sol";

abstract contract NiftyKitDiamond {
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
}
