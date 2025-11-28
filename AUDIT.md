# EarnGrid Audit

## Introduction
This document contains the audit findings for the EarnGrid dApp, including smart contracts, frontend, and off-chain services. The audit focuses on industry standards, security, code quality, and future development recommendations.

## Executive Summary
The codebase provides a solid foundation for a DeFi meta-vault. The architecture follows a clear separation of concerns. However, there are several critical issues in the off-chain rebalancer logic and potential precision issues in the frontend. The smart contracts are minimal but rely heavily on the trusted `EulerEarn` implementation.

## Findings

### Smart Contracts (`contracts/`)

#### `EarnGridPeriphery.sol`
- **[Info] Trust Assumption**: The `depositUSDC` function requires the user to approve the *Periphery* contract, which then transfers funds to itself before approving and depositing into the Vault. This is a standard pattern but requires the Periphery to be trusted and immutable.
- **[Low] Unnecessary Approval**: `depositUSDC` approves `0` then `assets`. While safe (and necessary for USDT), it adds gas overhead for standard ERC20s.
- **[Low] Withdrawal Wrapper Value**: `withdrawUSDC` simply calls `vault.withdraw`. Since `vault.withdraw` burns shares from `owner`, and the Periphery contract likely doesn't hold shares (unless minted to it, which `depositUSDC` sends to `receiver`), this wrapper is only useful if the caller has approved the Periphery to spend their shares (via `approve` or `setApprovalForAll` on the Vault). If the user calls `withdrawUSDC` directly, `msg.sender` is the Periphery, so it tries to burn Periphery's shares. **CRITICAL**: `vault.withdraw(assets, receiver, owner)` checks `msg.sender` allowance over `owner`'s shares. If User calls Periphery.withdrawUSDC, Periphery calls Vault.withdraw. `msg.sender` is Periphery. User must approve Periphery to spend shares. This adds friction. **Recommendation**: Remove `withdrawUSDC` or clarify its purpose (e.g., for gas abstraction).

#### `EarnGridDeployment.s.sol`
- **[Good]** Uses environment variables for configuration, allowing safe re-runs.
- **[Good]** Idempotent-ish design.

### Frontend (`apps/web/`)

#### Precision & Math
- **[Medium] Precision Loss**: `sharePrice` is calculated as `Number(totalAssets) / Number(totalSupply)`. For high-value assets or large supplies, `Number` (double precision float) may lose precision.
  - *Location*: `page.tsx`, `ActionPanel.tsx`, `indexer/src/index.ts`.
  - *Recommendation*: Use `BigInt` arithmetic or `formatUnits` to a fixed precision string before display.
- **[Low] Estimation**: `sharesEstimate` in `ActionPanel` uses the imprecise `sharePrice`.

#### UX/UI
- **[Low] Hardcoded Data**: `lib/vaults.ts` contains hardcoded placeholder data. Ensure this is replaced with live data or a subgraph query before mainnet.
- **[Low] Withdrawal Input**: `ActionPanel` does not validate withdrawal amount against `maxWithdraw`.

### Off-chain Services (`offchain/`)

#### `rebalancer`
- **[High] Logic Bug in Cap Check**: `optimizer.ts` attempts to check caps using `obs.tvl * plan.targetWeight`. However, `plan.targetWeight` is a percentage of the *Vault's* TVL, while `obs.tvl` (in a real scenario) would be the *Strategy's* total TVL.
  - The optimizer needs the **Vault's Total Assets** to convert the target percentage into an asset amount to compare against the Strategy's Cap (which is in assets).
  - *Fix*: Pass `vaultTotalAssets` to `computeTargets` and use `vaultTotalAssets * plan.targetWeight` to calculate the proposed allocation amount.
- **[Medium] Placeholder Logic**: `deriveObservations` in `onchain.ts` is a placeholder. It must be implemented to fetch real strategy data (TVL, APY) for the optimizer to work.

#### `indexer`
- **[Low]** `sharePrice` calculation uses `Number`, similar to frontend.

## Recommendations

### Immediate Fixes
1.  **Fix Rebalancer Logic**: Update `computeTargets` to accept `vaultTotalAssets` and correctly calculate projected allocation amounts for cap checks.
2.  **Implement Real Strategy Data**: Replace `deriveObservations` placeholder with actual contract reads (e.g., `strategy.totalAssets()`).
3.  **Frontend Math**: Switch to `BigInt` or `decimal.js` for frontend math to ensure precision.

### Code Quality & Improvements
1.  **Periphery Contract**: Re-evaluate the need for `withdrawUSDC`. If kept, document the approval flow clearly.
2.  **Type Safety**: Ensure strict typing for all contract interactions.
3.  **Testing**: Add unit tests for `optimizer.ts` with edge cases (zero TVL, full caps, etc.).

### Future Development
1.  **Subgraph/Indexer**: Replace direct RPC calls in frontend with a Subgraph or a robust indexer for historical data (APY charts).
2.  **Role Management**: Implement a script or CLI to manage Vault roles (Curator, Allocator) easily.
3.  **Safety Module**: Consider a "Guardian" bot that pauses the vault if share price drops unexpectedly.

