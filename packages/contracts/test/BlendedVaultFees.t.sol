// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "forge-std/Test.sol";

import {BlendedVault} from "../src/BlendedVault.sol";
import {BlendedVaultBaseTest} from "./BlendedVaultBase.t.sol";

contract BlendedVaultFeesTest is BlendedVaultBaseTest {
    function testHarvestMintsFeeShares() public {
        _deposit(user, 1_000 * USDC);
        stratA.simulateYield(100 * USDC);

        uint256 supply = vault.totalSupply();
        uint256 total = vault.totalAssets();
        uint256 currentAssetsPerShare = vault.assetsPerShare();
        uint256 profitAssets = (currentAssetsPerShare - vault.highWatermarkAssetsPerShare()) * supply / 1e18;
        uint256 feeAssets = (profitAssets * 300) / 10_000;
        uint256 expectedFeeShares = (feeAssets * supply) / (total - feeAssets);
        uint256 feeBalanceBefore = vault.balanceOf(feeRecipient);

        vm.prank(allocator);
        vault.harvest();

        assertEq(vault.balanceOf(feeRecipient), expectedFeeShares);
        assertEq(vault.highWatermarkAssetsPerShare(), currentAssetsPerShare);
    }

    function testHarvestSameBlockReverts() public {
        _deposit(user, 10 * USDC);

        vm.prank(allocator);
        vault.harvest();

        vm.prank(allocator);
        vm.expectRevert(BlendedVault.SameBlockHarvest.selector);
        vault.harvest();
    }

    function testHarvestIntervalRevertsWhenTooSoon() public {
        _deposit(user, 10 * USDC);

        vm.prank(allocator);
        vault.harvest();

        vm.warp(block.timestamp + 10 minutes);
        vm.roll(block.number + 1);

        vm.prank(allocator);
        vm.expectRevert(BlendedVault.HarvestTooSoon.selector);
        vault.harvest();
    }

    function testMultipleDepositorsFeeAccrual() public {
        _deposit(user, 1_000 * USDC);
        stratA.simulateYield(100 * USDC);

        vm.prank(allocator);
        vault.harvest();

        vm.warp(block.timestamp + 31 minutes);
        vm.roll(block.number + 1);

        _deposit(userTwo, 1_000 * USDC);
        stratA.simulateYield(100 * USDC);

        uint256 supply = vault.totalSupply();
        uint256 total = vault.totalAssets();
        uint256 currentAssetsPerShare = vault.assetsPerShare();
        uint256 profitAssets = (currentAssetsPerShare - vault.highWatermarkAssetsPerShare()) * supply / 1e18;
        uint256 feeAssets = (profitAssets * 300) / 10_000;
        uint256 expectedFeeShares = (feeAssets * supply) / (total - feeAssets);

        vm.prank(allocator);
        vault.harvest();

        assertEq(vault.balanceOf(feeRecipient), feeBalanceBefore + expectedFeeShares);
    }

    function testHarvestNoFeeOnLoss() public {
        _deposit(user, 1_000 * USDC);
        uint256 hwmBefore = vault.highWatermarkAssetsPerShare();

        stratA.simulateLoss(100 * USDC);

        vm.prank(allocator);
        vault.harvest();

        assertEq(vault.balanceOf(feeRecipient), 0);
        assertEq(vault.highWatermarkAssetsPerShare(), hwmBefore);
    }
}
