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
- [x] Fix N+1 query in getAllocationHistory
- [x] Add database indexes on timestamp columns
- [x] Fix rate limiter memory leak
- [x] Add historical allocation snapshots endpoint for UI charts
- [x] Fix multicall: added chain config to viem client (was missing, caused silent failures)

### Allocator Bot
- [x] Stateless Node.js keeper bot — monitors Morpho Blue USDC APYs
- [x] Rebalance decision engine — scores by APY, respects caps/tiers
- [x] viem-based executor for rebalance() and harvest()
- [x] Dry-run mode, JSON-line logging
- [x] Imports existing TS SDK

### Frontend
- [x] Fix QueryClient SSR data leakage
- [x] Fix zero-value display bug in onchain-metrics
- [x] Extract shared contract utilities
- [x] Centralize safe address helpers
- [x] Add loading skeletons for all server-rendered routes
- [x] Add page metadata/SEO
- [x] Add custom 404 page
- [x] Fix admin queue input to use textarea
- [x] Add toast auto-dismiss
- [x] Add sparkline SVG accessibility
- [x] Blended APY card with Morpho Blue strategy APYs
- [x] Single-button deposit flow (Approve & Deposit)
- [x] HTTPS proxy via existing Let's Encrypt cert (port 3442)

### Protocol
- [x] Deploy BlendedVault to Base mainnet (0x047e35f...)
- [x] Onchain-verified 3 MetaMorpho strategies on Base mainnet
- [x] Add strategies via timelock (schedule + execute)
- [x] Set deposit/withdraw queues
- [x] Full deposit+withdraw round-trip verified on mainnet

---

## Up Next

### Protocol
- [ ] **Redeploy with fresh private key** — current deployer EOA is EIP-7702 delegated (0x3530902b...), blocks ETH receives, can't fund gas. Deploy from a clean EOA.
- [ ] Integrate 2 additional Tier 2 strategies (Gauntlet Frontier 0x236919F1..., Steakhouse High Yield 0xCBeeF0...)
- [ ] Run allocator bot against live vault (needs funded allocator key)

### Indexer
- [ ] Add reorg safety (confirmations + rollback if needed)
- [ ] Persist indexer health metrics (lag, last block, error count)
- [ ] Track strategy health metrics (utilization, maxWithdraw, share price change)

### Frontend
- [ ] Add role-gated execute timelock actions
- [ ] Add richer charts for share price history and historical allocation breakdown
- [ ] Add admin UX for executing scheduled timelock actions

### Docs
- [ ] Expand `docs/STRATEGY_UNIVERSE.md` with full due diligence notes
- [ ] Keep `docs/RUNBOOK.md` current as deployment process evolves
- [ ] Document allocator scoring model and safety checks

### QA
- [ ] Add fork tests against Base strategies (optional)
