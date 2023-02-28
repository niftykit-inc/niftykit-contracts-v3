# NiftyKitV3

## Architecture

![niftykitv7-arch.png](https://s3-us-west-2.amazonaws.com/secure.notion-static.com/ecce53c9-04b9-4547-afbb-a1bb9aed2393/niftykitv7-arch.png)

Underlined - written by us

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