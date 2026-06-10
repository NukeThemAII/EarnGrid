# TODO (EarnGrid v0.1)

## Completed

### Contracts
- [x] Rebalance safety constraints: cooldown (default 6h), max amount per call (default 50%)
- [x] Invariant tests for totalAssets accounting (1024 runs x 100 depth, 0 failures)
- [x] All 28 tests passing (26 unit/integration/fuzz + 2 invariants)

### DevOps
- [x] Foundry 1.7.1 installed and configured
- [x] pnpm-workspace.yaml migrated from deprecated `allowBuilds` to `onlyBuiltDependencies`
- [x] .env.example files for contracts, indexer, web app

### Indexer
- [x] `/api/allocations/history` endpoint for historical allocation breakdowns

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
- [ ] Add reorg safety (confirmations + rollback if needed).
- [ ] Add historical allocation snapshots endpoint for UI charts. **(done)**
- [ ] Persist indexer health metrics (lag, last block, error count).
- [ ] Track strategy health metrics (utilization, maxWithdraw, share price change) for allocator input.

## Frontend
- [ ] Add role-gated execute timelock actions and deeper queue management UX.
- [ ] Add richer charts for share price history and historical allocation breakdown.

## Docs
- [ ] Expand `docs/STRATEGY_UNIVERSE.md` with full due diligence notes.
- [ ] Keep `docs/RUNBOOK.md` current as deployment process evolves.
- [ ] Document allocator scoring model and safety checks (see `EarnGrid.md`).

## QA
- [ ] Add fork tests against Base strategies (optional).
- [x] Add invariant test for totalAssets accounting across rebalances.
