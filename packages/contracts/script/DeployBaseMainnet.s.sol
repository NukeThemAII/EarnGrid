// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "forge-std/Script.sol";

import {BlendedVault} from "../src/BlendedVault.sol";
import {IERC20Metadata} from "openzeppelin-contracts/token/ERC20/extensions/IERC20Metadata.sol";

contract DeployBaseMainnet is Script {
    address internal constant BASE_USDC = 0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913;

    function run() external returns (BlendedVault vault) {
        uint256 deployerKey = vm.envUint("DEPLOYER_KEY");
        address owner = vm.envAddress("VAULT_OWNER");
        address curator = vm.envAddress("VAULT_CURATOR");
        address allocator = vm.envAddress("VAULT_ALLOCATOR");
        address guardian = vm.envAddress("VAULT_GUARDIAN");
        address feeRecipient = vm.envAddress("FEE_RECIPIENT");

        uint256[3] memory tierMaxBps = [
            vm.envOr("TIER0_MAX_BPS", uint256(8_000)),
            vm.envOr("TIER1_MAX_BPS", uint256(5_000)),
            vm.envOr("TIER2_MAX_BPS", uint256(2_000))
        ];
        uint256 idleLiquidityBps = vm.envOr("IDLE_LIQUIDITY_BPS", uint256(200));
        uint256 minInitialDeposit = vm.envOr("MIN_INITIAL_DEPOSIT", uint256(1_000_000));
        uint256 minHarvestInterval = vm.envOr("MIN_HARVEST_INTERVAL", uint256(1 hours));
        uint256 timelockDelay = vm.envOr("TIMELOCK_DELAY", uint256(1 days));

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
            minHarvestInterval,
            timelockDelay
        );
        vm.stopBroadcast();
    }
}
