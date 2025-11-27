// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import {IERC4626} from "openzeppelin-contracts/interfaces/IERC4626.sol";

/// @notice Thin interface to the EulerEarn-backed EarnGrid vault surface.
interface IEarnGridVault is IERC4626 {
    struct StrategyData {
        uint256 cap;
        uint256 allocPoint;
        uint256 totalManagedAssets;
        bool enabled;
    }

    function totalAllocationPoints() external view returns (uint256);
    function supplyQueue(uint256 index) external view returns (address);
    function withdrawalQueue(uint256 index) external view returns (address);
    function getStrategy(address strategy) external view returns (StrategyData memory);
}
