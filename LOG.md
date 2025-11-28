# Change Log

## [Date] Audit Follow-up

### Off-chain Rebalancer
- **Feature**: Wired live strategy data fetching in `src/onchain.ts` using `multicall` to fetch `totalAssets` for each strategy.
- **Test**: Added unit tests for `src/optimizer.ts` covering normal allocation, caps, zero TVL, and cash buffer logic.
- **Fix**: Updated `package.json` test script to use `tsx`.
- **Fix**: Added `.js` extensions to imports in `src/onchain.ts` and `src/optimizer.test.ts` to satisfy module resolution.

### Frontend
- **Feature**: Added `maxWithdraw` validation in `ActionPanel.tsx`.
    - Fetches `maxWithdraw` from the vault.
    - Prevents submission if withdrawal amount exceeds the limit.

## 2025-11-27 Precision & Rebalancer Wiring
- **Rebalancer**: Added ERC4626 ABI, improved vault state to expose 18-decimal share price strings, and replaced placeholder observations with live ERC4626 `asset` + `totalAssets` reads (per-strategy asset decimals fetched). Added fallback to legacy derivation if on-chain reads fail.
- **Allocator math**: Cap checks now use vault TVL in asset units; index script converts TVL via asset decimals for target weights.
- **Frontend/indexer**: Share price computations remain in 18-decimal fixed point to avoid float drift in displays and estimates.
- **Docs**: README updated to note live strategy TVL reads in the rebalancer.
- **Tests**: `forge test` (contracts) passing. Rebalancer TS tests not run in this pass (deps not installed here).

## 2025-11-27 Rebalancer Tests & Clarifications
- **Tests**: Ran `pnpm test` in `offchain/rebalancer` (optimizer unit tests) — all passing.
- **Docs**: README clarifies rebalancer live strategy reads, periphery withdraw approvals, and reminds to set real ERC-4626 strategy addresses in `offchain/rebalancer/src/config.ts`.

### Live Data Integration
- **Off-chain Rebalancer**:
    - **Feature**: Updated `index.ts` to use `fetchObservations` for live strategy TVL.
    - **Fix**: Updated `onchain.ts` to use `BigInt` for `sharePrice` calculation to prevent precision loss.
    - **Fix**: Updated `optimizer.ts` to enforce caps during allocation (previously only detected breaches).
    - **Test**: Verified optimizer fixes with `pnpm test`.
- **Frontend**:
    - **Feature**: Implemented `useStrategies` hook to fetch live strategy data (TVL, Caps) from the vault and strategy contracts.
    - **Feature**: Calculated live "Blended APY" based on current strategy allocations and TVL.
    - **Feature**: Updated `page.tsx` and `StrategyTable` to display live data instead of hardcoded values.
