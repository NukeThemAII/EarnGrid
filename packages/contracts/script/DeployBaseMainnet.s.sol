// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "forge-std/Script.sol";

import {BlendedVault} from "../src/BlendedVault.sol";
import {IERC20Metadata} from "openzeppelin-contracts/token/ERC20/extensions/IERC20Metadata.sol";

/// @notice Base Mainnet deploy script.
/// Sets all 4 roles (owner, curator, allocator, guardian) to the same EOA for dev.
/// For prod multisig: set VAULT_OWNER/VAULT_CURATOR/VAULT_ALLOCATOR/VAULT_GUARDIAN to
/// the multisig address and allocator bot EOA separately.
contract DeployBaseMainnet is Script {
    address internal constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    function run() external returns (BlendedVault vault) {
        uint256 deployerKey = vm.envUint("DEPLOYER_KEY");
        address deployer = vm.addr(deployerKey);

        // Dev mode: all roles = deployer EOA.
        // Prod override: set individual role env vars to override.
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
        uint256 idleLiquidityBps   = vm.envOr("IDLE_LIQUIDITY_BPS", uint256(200));   // 2%
        uint256 minInitialDeposit  = vm.envOr("MIN_INITIAL_DEPOSIT", uint256(1_000_000)); // 1 USDC
        uint256 maxDailyIncreaseBps = vm.envOr("MAX_DAILY_INCREASE_BPS", uint256(200)); // 2%
        uint256 minHarvestInterval = vm.envOr("MIN_HARVEST_INTERVAL", uint256(1 hours));
        uint256 timelockDelay      = vm.envOr("TIMELOCK_DELAY", uint256(1 days));

        vm.startBroadcast(deployerKey);
        vault = new BlendedVault(
            IERC20Metadata(BASE_USDC),
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

        // Log deployed address for verification
        console.log("BlendedVault deployed at:", address(vault));
        console.log("Owner (admin):", owner);
        console.log("Curator:", curator);
        console.log("Allocator:", allocator);
        console.log("Guardian:", guardian);
        console.log("Fee recipient:", feeRecipient);
    }
}
