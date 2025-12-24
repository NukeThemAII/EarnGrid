// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "forge-std/Test.sol";

import {BlendedVault} from "../src/BlendedVault.sol";
import {MaliciousReentrantStrategy} from "../src/mocks/MaliciousReentrantStrategy.sol";
import {BlendedVaultBaseTest} from "./BlendedVaultBase.t.sol";

contract BlendedVaultReentrancyTest is BlendedVaultBaseTest {
    function testReentrancyGuardOnRebalance() public {
        MaliciousReentrantStrategy evil = new MaliciousReentrantStrategy(usdc, "Evil", "EVL");
        bytes32 salt = keccak256("EVIL");

        vm.prank(curator);
        vault.scheduleAddStrategy(address(evil), 0, 1_000 * USDC, true, salt);
        vm.warp(block.timestamp + 1 days);
        vm.prank(curator);
        vault.executeAddStrategy(address(evil), 0, 1_000 * USDC, true, salt);

        bytes32 allocatorRole = vault.ALLOCATOR_ROLE();
        vm.prank(owner);
        vault.grantRole(allocatorRole, address(evil));

        vm.prank(curator);
        vault.setIdleLiquidityBps(10_000);

        _deposit(user, 100 * USDC);

        bytes memory data = abi.encodeWithSelector(BlendedVault.harvest.selector);
        evil.configureReentry(address(vault), data, true, false);

        address[] memory depositStrategies = new address[](1);
        uint256[] memory depositAmounts = new uint256[](1);
        depositStrategies[0] = address(evil);
        depositAmounts[0] = 50 * USDC;

        vm.prank(allocator);
        vm.expectRevert(MaliciousReentrantStrategy.ReentrancyAttempted.selector);
        vault.rebalance(new address[](0), new uint256[](0), depositStrategies, depositAmounts);
    }
}
