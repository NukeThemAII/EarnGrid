// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "forge-std/Test.sol";

import {BlendedVault} from "../src/BlendedVault.sol";
import {BlendedVaultBaseTest} from "./BlendedVaultBase.t.sol";

contract BlendedVaultFuzzTest is BlendedVaultBaseTest {
    function setUp() public override {
        super.setUp();
        _deposit(user, 1_000 * USDC);
    }

    function testFuzz_convertToSharesMonotonic(uint256 a, uint256 b) public {
        uint256 assetsA = bound(a, 1, 1_000_000 * USDC);
        uint256 assetsB = bound(b, assetsA, 1_000_000 * USDC);

        uint256 sharesA = vault.convertToShares(assetsA);
        uint256 sharesB = vault.convertToShares(assetsB);

        assertLe(sharesA, sharesB);
    }

    function testFuzz_convertToAssetsMonotonic(uint256 a, uint256 b) public {
        uint256 sharesA = bound(a, 1, 1_000_000 * USDC);
        uint256 sharesB = bound(b, sharesA, 1_000_000 * USDC);

        uint256 assetsA = vault.convertToAssets(sharesA);
        uint256 assetsB = vault.convertToAssets(sharesB);

        assertLe(assetsA, assetsB);
    }

    function testNoShareInflationOnFirstDeposit() public {
        uint256[3] memory tierMaxBps = [uint256(10_000), uint256(10_000), uint256(10_000)];
        BlendedVault freshVault = new BlendedVault(
            usdc,
            "Blended Vault USDC",
            "bvUSDC",
            owner,
            curator,
            allocator,
            guardian,
            feeRecipient,
            tierMaxBps,
            0,
            10 * USDC,
            30 minutes,
            1 days
        );

        usdc.mint(userTwo, 10 * USDC);
        vm.startPrank(userTwo);
        usdc.approve(address(freshVault), 10 * USDC);
        uint256 shares = freshVault.deposit(10 * USDC, userTwo);
        vm.stopPrank();

        assertEq(shares, 10 * USDC);
        assertEq(freshVault.assetsPerShare(), 1e18);
    }

    function testFirstDepositBelowMinimumReverts() public {
        uint256[3] memory tierMaxBps = [uint256(10_000), uint256(10_000), uint256(10_000)];
        BlendedVault freshVault = new BlendedVault(
            usdc,
            "Blended Vault USDC",
            "bvUSDC",
            owner,
            curator,
            allocator,
            guardian,
            feeRecipient,
            tierMaxBps,
            0,
            10 * USDC,
            30 minutes,
            1 days
        );

        usdc.mint(userTwo, 5 * USDC);
        vm.startPrank(userTwo);
        usdc.approve(address(freshVault), 5 * USDC);
        vm.expectRevert(BlendedVault.MinInitialDeposit.selector);
        freshVault.deposit(5 * USDC, userTwo);
        vm.stopPrank();
    }
}
