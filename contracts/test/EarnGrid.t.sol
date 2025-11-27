// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "forge-std/Test.sol";
import "../src/interfaces/IEarnGridVault.sol";
import "../src/earngrid/EarnGridPeriphery.sol";
import "../src/mocks/MockERC20.sol";
import "../src/mocks/MockEarnGridVault.sol";

contract EarnGridPeripheryTest is Test {
    address internal user = address(0xBEEF);
    MockERC20 internal usdc;
    MockEarnGridVault internal vault;
    EarnGridPeriphery internal periphery;

    function setUp() public {
        usdc = new MockERC20("USD Coin", "USDC", 6);
        vault = new MockEarnGridVault(usdc);
        vault.setStrategy(address(0x1), 1_000_000e6, 100, 250_000e6, true);
        periphery = new EarnGridPeriphery(vault);

        usdc.mint(user, 1_000_000e6);
    }

    function testDepositThroughPeripheryMintsShares() public {
        uint256 depositAmount = 500_000e6;

        vm.startPrank(user);
        usdc.approve(address(periphery), depositAmount);
        uint256 receivedShares = periphery.depositUSDC(depositAmount, user);
        vm.stopPrank();

        assertEq(receivedShares, depositAmount, "shares should mirror assets 1:1 in mock");
        assertEq(vault.balanceOf(user), depositAmount, "user should hold shares");
        assertEq(usdc.balanceOf(address(vault)), depositAmount, "vault holds underlying assets");
    }

    function testWithdrawThroughPeripheryBurnsShares() public {
        uint256 depositAmount = 300_000e6;
        vm.startPrank(user);
        usdc.approve(address(periphery), depositAmount);
        periphery.depositUSDC(depositAmount, user);
        vm.stopPrank();

        uint256 withdrawAmount = 120_000e6;
        vm.prank(user);
        vault.approve(address(periphery), withdrawAmount);

        vm.prank(user);
        uint256 burnedShares = periphery.withdrawUSDC(withdrawAmount, user, user);

        assertEq(burnedShares, withdrawAmount, "burned shares mirrors assets in mock");
        assertEq(usdc.balanceOf(user), 1_000_000e6 - depositAmount + withdrawAmount, "user balance updated");
        assertEq(vault.balanceOf(user), depositAmount - withdrawAmount, "shares reduced");
    }

    function testDepositRevertsOnZeroAmount() public {
        vm.startPrank(user);
        usdc.approve(address(periphery), 1);
        vm.expectRevert(EarnGridPeriphery.ZeroAssets.selector);
        periphery.depositUSDC(0, user);
        vm.stopPrank();
    }
}
