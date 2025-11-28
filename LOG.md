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

## 2025-11-28 Rebalancer Fixes & Optimization
- **Fix**: Restored missing `deriveObservations` function in `onchain.ts` to prevent runtime errors in `index.ts`.
- **Improvement**: Optimized `fetchObservations` in `onchain.ts` to use `multicall` for fetching strategy assets, totalAssets, and decimals, reducing RPC calls significantly.
- **Fix**: Added missing `.js` extensions and type casts in `executor.ts` to satisfy `tsc` and module resolution.
- **Verification**: Verified optimizer logic with `pnpm test` and type safety with `tsc`.

## 2025-11-29 Rebalancer Cleanup
- **Off-chain Rebalancer**:
  - Kept `index.ts` consuming `fetchObservations` with fallback to `deriveObservations`.
  - Ensured share price remains 18-decimal fixed point via BigInt in `onchain.ts`.
  - Minor cleanups to imports and type casts; unit tests (`pnpm test` in `offchain/rebalancer`) passing.
- **Note**: Frontend live strategy hooks are not yet implemented; StrategyTable still uses placeholder data.

## 2025-11-29 UI Live Data Pass
- **Frontend**:
  - Added global Connect button in layout header.
  - `useStrategies` now fetches live strategy TVL (ERC4626 `totalAssets`), caps, and queue positions; StrategyTable surfaces rankings.
  - Home page shows live blended APY (tvl-weighted), timelock, and performance fee; StrategyTable uses live data.
  - ABI expanded with queue/timelock/fee getters for frontend reads.
  - Strategy TVL now respects per-strategy decimals (fetches ERC4626 `decimals`, falls back to 6).
- **Admin UI**:
  - Added `/admin` dashboard surfacing owner/curator/guardian/allocator roles and a submit-cap form (6-decimal USDC).
  - **Guardian**: Implemented `pendingCap` fetching and `acceptCap` flow. Guardians can now view and accept pending strategy caps directly from the dashboard.
  - Queue management UI scaffolded (read-only for now).

## 2025-11-28 UI Audit & Enhancements
- **Audit**: Conducted full UI/Contract audit, findings saved in `UI.md`.
- **Feature**: Added Global Connect Button to `layout.tsx` header.
- **Feature**: Visualized Supply/Withdraw Queues in `StrategyTable` (showing "IN #X" / "OUT #X").
- **Feature**: Added `Timelock` and `Performance Fee` metrics to `page.tsx`.
- **Feature**: Implemented **Admin Dashboard** at `/admin` with role-based access control (Owner/Curator/Allocator/Guardian) and Cap Management UI.
- **Tech**: Updated `earngridVaultAbi` and `useStrategies` hook to support new data points.
- **Build**: Verified frontend build (`pnpm build` passed).
