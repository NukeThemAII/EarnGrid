// SPDX-License-Identifier: MIT
pragma solidity ^0.8.23;

import "../interfaces/IEarnGridVault.sol";
import {IERC20} from "openzeppelin-contracts/token/ERC20/IERC20.sol";

/// @notice Thin helper that forwards USDC into an EarnGrid vault.
/// @dev This contract never retains funds; it simply standardizes UX for approvals and forwarding.
contract EarnGridPeriphery {
    IEarnGridVault public immutable vault;
    IERC20 public immutable asset;

    error ZeroAssets();

    constructor(IEarnGridVault _vault) {
        vault = _vault;
        asset = IERC20(_vault.asset());
    }

    /// @notice Deposit USDC into the EarnGrid vault on behalf of the caller.
    /// @param assets Amount of USDC to deposit.
    /// @param receiver Address receiving vault shares.
    /// @return shares Amount of vault shares minted.
    function depositUSDC(uint256 assets, address receiver) external returns (uint256 shares) {
        if (assets == 0) revert ZeroAssets();

        // Pull funds from the caller then forward to the vault.
        asset.transferFrom(msg.sender, address(this), assets);

        // Reset approval to avoid non-compliant tokens failing on non-zero to non-zero approvals.
        asset.approve(address(vault), 0);
        asset.approve(address(vault), assets);

        shares = vault.deposit(assets, receiver);
    }

    /// @notice Withdraw USDC from the vault, burning shares owned by `owner`.
    /// @param assets Amount of underlying to withdraw.
    /// @param receiver Recipient of USDC.
    /// @param owner Address whose shares will be burned.
    /// @return sharesBurned Number of shares burned in the withdrawal.
    function withdrawUSDC(uint256 assets, address receiver, address owner) external returns (uint256 sharesBurned) {
        if (assets == 0) revert ZeroAssets();
        // Caller must hold or be approved to burn `owner`'s shares; this contract just forwards to the vault.
        sharesBurned = vault.withdraw(assets, receiver, owner);
    }
}
