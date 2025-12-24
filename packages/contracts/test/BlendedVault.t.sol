// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "forge-std/Test.sol";

import {BlendedVault} from "../src/BlendedVault.sol";
import {BlendedVaultBaseTest} from "./BlendedVaultBase.t.sol";

contract BlendedVaultTest is BlendedVaultBaseTest {
    function testDepositAllocatesByCap() public {
        vm.prank(curator);
        vault.setCap(address(stratA), 500 * USDC);

        _deposit(user, 1_000 * USDC);

        assertEq(usdc.balanceOf(address(stratA)), 500 * USDC);
        assertEq(usdc.balanceOf(address(stratB)), 500 * USDC);
        assertEq(usdc.balanceOf(address(vault)), 0);
    }

    function testWithdrawUsesQueueOrder() public {
        vm.prank(curator);
        vault.setCap(address(stratA), 500 * USDC);

        _deposit(user, 1_000 * USDC);

        stratA.setLiquidityLimit(300 * USDC);

        vm.prank(user);
        vault.withdraw(600 * USDC, user, user);

        assertEq(usdc.balanceOf(user), 600 * USDC);
        assertEq(usdc.balanceOf(address(stratA)), 200 * USDC);
        assertEq(usdc.balanceOf(address(stratB)), 200 * USDC);
    }

    function testWithdrawRevertsWhenInsufficientLiquidity() public {
        _deposit(user, 400 * USDC);

        stratA.setLiquidityLimit(100 * USDC);
        stratB.setLiquidityLimit(100 * USDC);

        vm.prank(user);
        vm.expectRevert(BlendedVault.NotEnoughLiquidity.selector);
        vault.withdraw(300 * USDC, user, user);
    }

    function testPauseSemantics() public {
        vm.prank(guardian);
        vault.pauseDeposits();

        usdc.mint(user, 10 * USDC);
        vm.startPrank(user);
        usdc.approve(address(vault), 10 * USDC);
        vm.expectRevert(BlendedVault.DepositsPaused.selector);
        vault.deposit(10 * USDC, user);
        vm.stopPrank();

        vm.prank(guardian);
        vault.unpauseDeposits();

        _deposit(user, 50 * USDC);

        vm.prank(guardian);
        vault.pauseWithdrawals();

        vm.prank(user);
        vm.expectRevert(BlendedVault.WithdrawalsPaused.selector);
        vault.withdraw(10 * USDC, user, user);
    }

    function testDepositZeroAssetsReverts() public {
        vm.prank(user);
        vm.expectRevert(BlendedVault.ZeroAssets.selector);
        vault.deposit(0, user);
    }

    function testAllocatorRoleRequiredForRebalance() public {
        address[] memory withdrawStrategies = new address[](1);
        uint256[] memory withdrawAmounts = new uint256[](1);
        address[] memory depositStrategies = new address[](1);
        uint256[] memory depositAmounts = new uint256[](1);
        withdrawStrategies[0] = address(stratA);
        depositStrategies[0] = address(stratB);

        vm.expectRevert();
        vault.rebalance(withdrawStrategies, withdrawAmounts, depositStrategies, depositAmounts);
    }

    function testGuardianRoleRequiredForPause() public {
        vm.expectRevert();
        vault.pauseDeposits();
    }

    function testRebalanceRespectsCap() public {
        vm.prank(curator);
        vault.setCap(address(stratA), 100 * USDC);

        _deposit(user, 200 * USDC);

        address[] memory withdrawStrategies = new address[](1);
        uint256[] memory withdrawAmounts = new uint256[](1);
        address[] memory depositStrategies = new address[](1);
        uint256[] memory depositAmounts = new uint256[](1);

        withdrawStrategies[0] = address(stratB);
        withdrawAmounts[0] = 50 * USDC;
        depositStrategies[0] = address(stratA);
        depositAmounts[0] = 50 * USDC;

        vm.prank(allocator);
        vm.expectRevert(BlendedVault.InvalidCap.selector);
        vault.rebalance(withdrawStrategies, withdrawAmounts, depositStrategies, depositAmounts);
    }

    function testRebalanceRespectsTierLimit() public {
        uint256[3] memory lower = [uint256(5_000), uint256(10_000), uint256(10_000)];
        vm.prank(curator);
        vault.setTierMaxBps(lower);

        _deposit(user, 200 * USDC);

        address[] memory withdrawStrategies = new address[](1);
        uint256[] memory withdrawAmounts = new uint256[](1);
        address[] memory depositStrategies = new address[](1);
        uint256[] memory depositAmounts = new uint256[](1);

        withdrawStrategies[0] = address(stratB);
        withdrawAmounts[0] = 50 * USDC;
        depositStrategies[0] = address(stratA);
        depositAmounts[0] = 50 * USDC;

        vm.prank(allocator);
        vm.expectRevert(BlendedVault.TierLimitExceeded.selector);
        vault.rebalance(withdrawStrategies, withdrawAmounts, depositStrategies, depositAmounts);
    }
}
