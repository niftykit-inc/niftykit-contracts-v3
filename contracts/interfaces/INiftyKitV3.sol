// SPDX-License-Identifier: MIT
pragma solidity ^0.8.18;

interface INiftyKitV3 {
    enum FeeType {
        Seller,
        Buyer,
        Split
    }

    struct Collection {
        uint256 feeRate;
        FeeType feeType;
        bool exists;
    }

    /**
     * @dev Emitted when diamond is created
     */
    event DiamondCreated(address indexed diamondAddress, string collectionId);

    /**
     * @dev Returns app registry address.
     */
    function appRegistry() external returns (address);

    /**
     * @dev Returns the commission amount.
     */
    function commission(
        address collection,
        uint256 amount
    ) external view returns (uint256, uint256);

    /**
     * @dev Get fees by amount (per collection)
     */
    function getFees(uint256 amount) external view returns (uint256, uint256);
}
