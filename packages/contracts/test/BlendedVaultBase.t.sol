// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "forge-std/Test.sol";

import {BlendedVault} from "../src/BlendedVault.sol";
import {MockERC20USDC} from "../src/mocks/MockERC20USDC.sol";
import {MockERC4626Strategy} from "../src/mocks/MockERC4626Strategy.sol";

abstract contract BlendedVaultBaseTest is Test {
    uint256 internal constant USDC = 1e6;

    address internal owner;
    address internal curator;
    address internal allocator;
    address internal guardian;
    address internal feeRecipient;
    address internal user;
    address internal userTwo;

    MockERC20USDC internal usdc;
    BlendedVault internal vault;
    MockERC4626Strategy internal stratA;
    MockERC4626Strategy internal stratB;

    function setUp() public virtual {
        owner = makeAddr("owner");
        curator = makeAddr("curator");
        allocator = makeAddr("allocator");
        guardian = makeAddr("guardian");
        feeRecipient = makeAddr("feeRecipient");
        user = makeAddr("user");
        userTwo = makeAddr("userTwo");

        usdc = new MockERC20USDC();

        uint256[3] memory tierMaxBps = [uint256(10_000), uint256(10_000), uint256(10_000)];
        vault = new BlendedVault(
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
            1 * USDC,
            30 minutes,
            1 days
        );

        stratA = new MockERC4626Strategy(usdc, "Strategy A", "sA");
        stratB = new MockERC4626Strategy(usdc, "Strategy B", "sB");

        bytes32 saltA = keccak256("STRAT_A");
        bytes32 saltB = keccak256("STRAT_B");

        vm.startPrank(curator);
        vault.scheduleAddStrategy(address(stratA), 0, 1_000_000 * USDC, true, saltA);
        vault.scheduleAddStrategy(address(stratB), 1, 1_000_000 * USDC, true, saltB);
        vm.stopPrank();

        vm.warp(block.timestamp + 1 days);

        vm.startPrank(curator);
        vault.executeAddStrategy(address(stratA), 0, 1_000_000 * USDC, true, saltA);
        vault.executeAddStrategy(address(stratB), 1, 1_000_000 * USDC, true, saltB);
        vm.stopPrank();

        address[] memory depositQ = new address[](2);
        depositQ[0] = address(stratA);
        depositQ[1] = address(stratB);
        address[] memory withdrawQ = new address[](2);
        withdrawQ[0] = address(stratA);
        withdrawQ[1] = address(stratB);

        vm.prank(allocator);
        vault.setDepositQueue(depositQ);
        vm.prank(allocator);
        vault.setWithdrawQueue(withdrawQ);
    }

    function _deposit(address depositor, uint256 amount) internal {
        usdc.mint(depositor, amount);
        vm.startPrank(depositor);
        usdc.approve(address(vault), amount);
        vault.deposit(amount, depositor);
        vm.stopPrank();
    }
}
