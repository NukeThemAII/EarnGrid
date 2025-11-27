// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "forge-std/Script.sol";
import {IEulerEarnFactory} from "euler-earn/interfaces/IEulerEarnFactory.sol";
import {IEulerEarn} from "euler-earn/interfaces/IEulerEarn.sol";

/// @notice Deployment harness that connects to the canonical EulerEarn factory and deploys an EarnGrid USDC vault.
/// @dev Addresses are pulled from env vars so this script can be safely re-run across networks.
contract EarnGridDeployment is Script {
    /// @notice Canonical Base USDC.
    address public constant BASE_USDC = 0x833589Fcd6eDb6E08f4C7c32D4F71b54B2F73cF0;

    struct VaultConfig {
        string name;
        string symbol;
        address owner;
        uint256 initialTimelock;
        address usdc;
        address factory;
        bytes32 salt;
    }

    /// @dev Idempotent-ish wrapper that deploys via EulerEarn factory. If the vault already exists, logs and exits.
    function run() external {
        VaultConfig memory cfg = defaultConfig();

        vm.startBroadcast();

        IEulerEarnFactory factory = IEulerEarnFactory(cfg.factory);

        console2.log("Using EulerEarnFactory", address(factory));
        console2.log("USDC", cfg.usdc);
        console2.log("Owner", cfg.owner);
        console2.log("Timelock (secs)", cfg.initialTimelock);
        console2.logBytes32(cfg.salt);

        IEulerEarn vault = factory.createEulerEarn(cfg.owner, cfg.initialTimelock, cfg.usdc, cfg.name, cfg.symbol, cfg.salt);
        console2.log("EarnGrid vault deployed:", address(vault));

        vm.stopBroadcast();
    }

    function defaultConfig() public view returns (VaultConfig memory cfg) {
        cfg.name = vm.envOr("EARNGRID_NAME", string("EarnGrid USDC"));
        cfg.symbol = vm.envOr("EARNGRID_SYMBOL", string("egUSDC"));
        cfg.owner = vm.envOr("EARNGRID_OWNER", msg.sender);
        cfg.initialTimelock = vm.envOr("EARNGRID_TIMELOCK", uint256(2 days));
        cfg.usdc = vm.envOr("EARNGRID_USDC", BASE_USDC);
        cfg.factory = vm.envAddress("EULER_EARN_FACTORY");
        cfg.salt = vm.envOr("EARNGRID_SALT", bytes32("earngrid-usdc"));
    }
}
