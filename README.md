# NiftyKitV3

[Request for Audit Doc](https://niftykit.notion.site/NiftyKit-V7-Request-for-Audit-0c4ed3eea24a4a1cbab2b767b9c3fe22)


## Architecture


- **core**
    - NiftyKitV3.sol
        - Initializable.sol (OpenZeppelin)
        - OwnableUpgradeable.sol (OpenZeppelin)
    - NiftyKitAppRegistry.sol
        - OwnableUpgradeable.sol (OpenZeppelin)
- **diamond**
    - DiamondCollection.sol
        - NiftyKitERC721A.sol
            - ERC721AUpgradeable.sol (Azuki ERC721A)
            - ERC721AQueryableUpgradeable.sol (Azuki ERC721A)
            - OwnableRoles.sol (Solady)
            - OperatorFilterer.sol (Solady)
        - NiftyKitDiamond.sol
            - DiamondLoupeFacet.sol (Nick Mudge / EIP-2535)
        - BaseStorage.sol
- **apps**
    - **drop**
        - DropFacet.sol
            - InternalOwnableRoles.sol (Solady)
            - InternalERC721AUpgradeable.sol (Azuki ERC721A)
        - DropStorage.sol
    - **edition**
        - EditionFacet.sol
            - InternalOwnableRoles.sol (Solady)
            - InternalERC721AUpgradeable.sol (Azuki ERC721A)
        - EditionStorage.sol
    - **ape**
        - ApeDropFacet.sol
            - InternalOwnableRoles.sol (Solady)
            - InternalERC721AUpgradeable.sol (Azuki ERC721A)
        - ApeDropStorage.sol
    - **example**
        - ExampleFacet.sol
            - InternalOwnableRoles.sol (Solady)
            - InternalERC721AUpgradeable.sol (Azuki ERC721A)
        - ExampleStorage.sol