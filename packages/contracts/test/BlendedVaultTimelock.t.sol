// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "forge-std/Test.sol";

import {BlendedVault} from "../src/BlendedVault.sol";
import {MockERC4626Strategy} from "../src/mocks/MockERC4626Strategy.sol";
import {BlendedVaultBaseTest} from "./BlendedVaultBase.t.sol";

contract BlendedVaultTimelockTest is BlendedVaultBaseTest {
    function testAddStrategyRequiresTimelock() public {
        MockERC4626Strategy stratC = new MockERC4626Strategy(usdc, "Strategy C", "sC");
        bytes32 salt = keccak256("STRAT_C");

        vm.prank(curator);
        vault.scheduleAddStrategy(address(stratC), 0, 1_000 * USDC, true, salt);

        vm.prank(curator);
        vm.expectRevert(BlendedVault.TimelockNotReady.selector);
        vault.executeAddStrategy(address(stratC), 0, 1_000 * USDC, true, salt);

        vm.warp(block.timestamp + 1 days);

        vm.prank(curator);
        vault.executeAddStrategy(address(stratC), 0, 1_000 * USDC, true, salt);

        (bool registered, bool enabled, uint8 tier, uint256 capAssets, bool isSync) =
            vault.strategies(address(stratC));
        assertTrue(registered);
        assertTrue(enabled);
        assertEq(tier, 0);
        assertEq(capAssets, 1_000 * USDC);
        assertTrue(isSync);
    }

    function testCapIncreaseRequiresTimelock() public {
        (, , , uint256 oldCap, ) = vault.strategies(address(stratA));
        uint256 newCap = oldCap + 1;

        vm.prank(curator);
        vm.expectRevert(BlendedVault.TimelockRequired.selector);
        vault.setCap(address(stratA), newCap);

        bytes32 salt = keccak256("CAP_INC");
        vm.prank(curator);
        vault.scheduleCapIncrease(address(stratA), newCap, salt);

        vm.warp(block.timestamp + 1 days);
        vm.prank(curator);
        vault.executeCapIncrease(address(stratA), newCap, salt);

        (, , , uint256 updatedCap, ) = vault.strategies(address(stratA));
        assertEq(updatedCap, newCap);
    }

    function testTierIncreaseRequiresTimelock() public {
        uint256[3] memory lower = [uint256(8_000), uint256(8_000), uint256(8_000)];
        vm.prank(curator);
        vault.setTierMaxBps(lower);

        uint256[3] memory higher = [uint256(9_000), uint256(8_000), uint256(8_000)];
        vm.prank(curator);
        vm.expectRevert(BlendedVault.TimelockRequired.selector);
        vault.setTierMaxBps(higher);

        bytes32 salt = keccak256("TIER_INC");
        vm.prank(curator);
        vault.scheduleTierMaxBps(higher, salt);

        vm.warp(block.timestamp + 1 days);
        vm.prank(curator);
        vault.executeTierMaxBps(higher, salt);

        assertEq(vault.tierMaxBps(0), 9_000);
    }
}
