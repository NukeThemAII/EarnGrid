// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "forge-std/Script.sol";

import {BlendedVault} from "../src/BlendedVault.sol";
import {IERC20Metadata} from "openzeppelin-contracts/token/ERC20/extensions/IERC20Metadata.sol";

/// @notice Base Sepolia deploy script.
/// Sets all 4 roles (owner, curator, allocator, guardian) to the same EOA for dev.
/// Requires BASE_SEPOLIA_USDC env var — use Bridged USDC on Sepolia (0x...).
contract DeployBaseSepolia is Script {
    function run() external returns (BlendedVault vault) {
        uint256 deployerKey = vm.envUint("DEPLOYER_KEY");
        address deployer = vm.addr(deployerKey);

        address baseSepoliaUSDC = vm.envAddress("BASE_SEPOLIA_USDC");

        // Dev mode: all roles = deployer EOA.
        // Prod override: set individual role env vars.
        address owner       = vm.envOr("VAULT_OWNER", deployer);
        address curator     = vm.envOr("VAULT_CURATOR", owner);
        address allocator   = vm.envOr("VAULT_ALLOCATOR", owner);
        address guardian    = vm.envOr("VAULT_GUARDIAN", owner);
        address feeRecipient = vm.envOr("FEE_RECIPIENT", owner);

        uint256[3] memory tierMaxBps = [
            vm.envOr("TIER0_MAX_BPS", uint256(8_000)),
            vm.envOr("TIER1_MAX_BPS", uint256(5_000)),
            vm.envOr("TIER2_MAX_BPS", uint256(2_000))
        ];
        uint256 idleLiquidityBps   = vm.envOr("IDLE_LIQUIDITY_BPS", uint256(200));
        uint256 minInitialDeposit  = vm.envOr("MIN_INITIAL_DEPOSIT", uint256(1_000_000));
        uint256 maxDailyIncreaseBps = vm.envOr("MAX_DAILY_INCREASE_BPS", uint256(200));
        uint256 minHarvestInterval = vm.envOr("MIN_HARVEST_INTERVAL", uint256(1 hours));
        uint256 timelockDelay      = vm.envOr("TIMELOCK_DELAY", uint256(1 days));

        vm.startBroadcast(deployerKey);
        vault = new BlendedVault(
            IERC20Metadata(baseSepoliaUSDC),
            "Blended Vault USDC",
            "bvUSDC",
            owner,
            curator,
            allocator,
            guardian,
            feeRecipient,
            tierMaxBps,
            idleLiquidityBps,
            minInitialDeposit,
            maxDailyIncreaseBps,
            minHarvestInterval,
            timelockDelay
        );
        vm.stopBroadcast();

        console.log("BlendedVault deployed at:", address(vault));
        console.log("Owner (admin):", owner);
        console.log("Curator:", curator);
        console.log("Allocator:", allocator);
        console.log("Guardian:", guardian);
        console.log("Fee recipient:", feeRecipient);
    }
}
