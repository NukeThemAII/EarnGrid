# TODO (EarnGrid v0.1)

## Completed

### Contracts
- [x] Rebalance safety constraints: cooldown (default 6h), max amount per call (default 50%)
- [x] Invariant tests for totalAssets accounting (1024 runs x 100 depth, 0 failures)
- [x] All 28 tests passing (26 unit/integration/fuzz + 2 invariants)

### DevOps
- [x] Foundry 1.7.1 installed and configured
- [x] pnpm-workspace.yaml migrated from deprecated `allowBuilds` to `onlyBuiltDependencies`
- [x] .env.example files for contracts, indexer, web app, allocator bot
- [x] Simplified deploy scripts — single admin (all roles = deployer EOA by default)

### Indexer
- [x] `/api/allocations/history` endpoint for historical allocation breakdowns

### Allocator Bot
- [x] Stateless Node.js keeper bot — monitors Morpho Blue USDC APYs
- [x] Rebalance decision engine — scores by APY, respects caps/tiers
- [x] viem-based executor for rebalance() and harvest()
- [x] Dry-run mode, JSON-line logging
- [x] Imports existing TS SDK

### Infrastructure
- [x] PostCSS config verified correct

## Protocol
- [ ] Confirm and validate Base Sepolia USDC address for deployment scripts.
- [ ] Integrate 1–2 live strategies (MetaMorpho vaults) with caps and queues on Sepolia.
- [ ] Add strategy adapters only if ERC-4626 compatibility gaps are confirmed.
- [ ] Build an allocator bot with target-weight scoring (yield, liquidity, risk penalties) and guardrails.
- [ ] Add rebalance safety constraints: max move per rebalance, min drift threshold, cooldowns. **(done)**
- [ ] Define strategy health checks (maxWithdraw, pause flags, share price jump, TVL drop) and fail-safe actions.
- [ ] Add optional dynamic cap tuning via timelocked changes.

## Indexer
- [x] Fix N+1 query in getAllocationHistory (batch fetch with 2 queries instead of N+1)
- [x] Add database indexes on timestamp columns for snapshots and allocation_snapshots
- [x] Fix rate limiter memory leak (add periodic cleanup of expired entries)
- [ ] Add reorg safety (confirmations + rollback if needed).
- [x] Add historical allocation snapshots endpoint for UI charts.
- [ ] Persist indexer health metrics (lag, last block, error count).
- [ ] Track strategy health metrics (utilization, maxWithdraw, share price change) for allocator input.

## Frontend
- [x] Fix QueryClient SSR data leakage (moved to useState inside component)
- [x] Fix zero-value display bug in onchain-metrics (0n shares displayed as "--")
- [x] Extract shared contract utilities (unwrapResult, erc20MetadataAbi, accessControlAbi, ALLOCATION_COLORS → lib/contracts.ts)
- [x] Centralize safe address helpers (safeVaultAddress, safeUsdcAddress → lib/chain.ts)
- [x] Add loading skeletons for all server-rendered routes
- [x] Add page metadata/SEO for /vault, /strategies, /admin
- [x] Add custom 404 page (not-found.tsx)
- [x] Fix admin queue input to use textarea (audit L-02)
- [x] Add toast auto-dismiss for success/error notifications
- [x] Add sparkline SVG accessibility (role="img", aria-label)
- [ ] Add role-gated execute timelock actions and deeper queue management UX.
- [ ] Add richer charts for share price history and historical allocation breakdown.

## Docs
- [ ] Expand `docs/STRATEGY_UNIVERSE.md` with full due diligence notes.
- [ ] Keep `docs/RUNBOOK.md` current as deployment process evolves.
- [ ] Document allocator scoring model and safety checks (see `EarnGrid.md`).

## QA
- [ ] Add fork tests against Base strategies (optional).
- [x] Add invariant test for totalAssets accounting across rebalances.
