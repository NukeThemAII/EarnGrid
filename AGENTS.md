# USDC Blended Vault dApp — AGENTS.md (Final)

> Repo goal: a **decentralized USDC “savings” dApp** on Base where users deposit USDC and receive ERC‑4626 vault shares; the vault allocates across a **whitelisted set of yield sources** to target **~7–10% net APY** (market‑dependent) with explicit risk controls and transparent allocation.

---

## 0) Product summary

### What we’re building (v0.1)

* **One onchain vault** (ERC‑4626) that accepts **USDC** and issues **share tokens** (ERC‑20 receipt via ERC‑4626). No separate token required.
* Funds are deployed into a **set of Strategy Vaults** (preferably ERC‑4626) with:

  * **caps** per strategy
  * **deposit/supply queue** (priority order for new capital)
  * **withdraw queue** (priority order for redemptions)
  * **allocator-controlled rebalances**
  * **emergency controls**
* **Performance fee:** 3% of profit (high‑water mark), paid to `feeRecipient` via fee share minting.
* **UI:** deposit/withdraw, show TVL, share price, realized APY, current allocations, strategy list with risk tier & caps.

### Implementation approach (recommended)

**Track A: “Vault‑of‑Vaults” (EulerEarn‑style)**

* Implement an ERC‑4626 vault that can allocate into multiple underlying strategies.
* **Offchain risk scoring & strategy selection**, onchain enforcement of caps/queues/tier limits.
* Start with **2 strategies** if feasible; otherwise ship v0.1 with **1 strategy** (Gauntlet/Morpho) but keep the multi‑strategy architecture.

**Track B (v2 optional): Wrapper around async / queued strategies**

* Support strategies that require asynchronous entry/exit or provisioning (withdraw queue/claims).

---

## 1) Non‑goals (v0.1)

* No leverage/looping.
* No cross‑chain bridging inside the vault.
* No permissionless strategy additions.
* No onchain risk oracle / onchain auto‑rating; risk constraints are governance-configured.

---

## 2) Architecture

### 2.1 Onchain components

1. **BlendedVault (ERC‑4626)**

* **Asset:** USDC
* **Shares:** ERC‑4626 share token (e.g., `bvUSDC`)
* Holds an allowlist of strategies and enforces:

  * per‑strategy caps
  * tier exposure limits
  * deposit/withdraw queues
  * max idle liquidity target
  * performance fee (3% HWM)

2. **Roles & safety policy**

* `owner` (multisig) — governance and role management
* `curator` — proposes strategy allowlist + caps + tier config
* `allocator` (bot/keeper) — executes rebalances and queue updates (within curator policy)
* `guardian` — emergency pause, emergency strategy revocation

**Timelock policy**

* **Risk‑increasing changes** (cap increases, adding a strategy, raising tier exposure) must be **timelocked (min 24h)**.
* **Risk‑reducing changes** (cap decreases, pausing, removing strategy) can be immediate.

3. **Strategy adapters** (if needed)

Preferred: underlying strategies are ERC‑4626 and can be integrated directly.

If an adapter is required, standardize:

* `deposit(uint256 assets)`
* `withdraw(uint256 assets)`
* `totalAssets()` (USDC‑denominated)
* `maxDeposit()` / `maxWithdraw()`
* `underlying()`

> NOTE: v0.1 should prioritize **synchronous liquidity** strategies (instant `withdraw/redeem`).

### 2.2 Offchain components

4. **Allocator bot (keeper)**

* Pull rates + liquidity + risk metadata
* Compute target weights respecting:

  * per‑strategy caps
  * per‑tier max exposure
  * min idle liquidity
* Execute:

  * `rebalance()` (move funds between strategies)
  * `harvest()` (accrue performance fee when warranted)

5. **Indexer / API**

* Index share price (assets/share) over time → realized APY
* Track allocations, rebalances, deposits/withdrawals, fees
* Expose:

  * `/api/apy` (7d/30d realized)
  * `/api/tvl`
  * `/api/allocations`

6. **Frontend (Next.js)**

* Deposit/withdraw
* Dashboard metrics
* Strategy table with transparency
* Admin panel for role‑gated actions

---

## 3) Repo layout (monorepo)

```text
/blended-vault
  /apps
    /web                 # Next.js App Router UI
  /packages
    /contracts           # Foundry contracts + tests
    /sdk                 # TS SDK (viem) for contract calls & decoding
    /ui                  # shared UI components
  /services
    /indexer             # Node/TS: event indexer + APY calculator
  /infra
    docker-compose.yml
    deployment/          # infra configs (Railway/Fly/Render/etc.)
  /docs
    ARCHITECTURE.md
    STRATEGY_UNIVERSE.md
    THREAT_MODEL.md
    RUNBOOK.md
  AGENTS.md
  README.md
```

---

## 4) Smart‑contract spec (v0.1)

### 4.1 Vault invariants

* `totalAssets()` = idle USDC + USDC‑equivalent value across strategies.
* `convertToShares/convertToAssets` must be **monotonic**.
* Deposits cannot mint **0 shares**.
* Withdraws pull liquidity from strategies in `withdrawQueue` order.

### 4.2 Strategy controls

* **Caps:** each strategy has a max allocation (in assets).
* **Queues:**

  * deposit queue defines where new capital goes first
  * withdraw queue defines what to unwind first
* **Tier exposure constraints:**

  * Tier 0 (blue chip) max X%
  * Tier 1 max Y%
  * Tier 2 max Z%

### 4.3 Performance fee (3%) — high‑water mark

Mechanism: mint fee shares so depositors retain principal + **97% of gains**.

* Maintain `highWatermarkAssetsPerShare` (scaled 1e18):

  * `assetsPerShare = (totalAssets() * 1e18) / totalSupply()` (when `totalSupply>0`)
* On `harvest()` (keeper-triggered):

  * if `assetsPerShare <= HWM`: do nothing
  * else compute profit in assets:

    * `profitAssets = (assetsPerShare - HWM) * totalSupply / 1e18`
  * fee in assets:

    * `feeAssets = profitAssets * feeBps / 10_000` (feeBps=300)
  * mint fee shares to `feeRecipient` sized so they represent `feeAssets` at current price.
  * set `HWM = assetsPerShare`

**Anti-manipulation requirements**

* `harvest()` should be **non-reentrant**.
* Do not allow same-block double-harvest.
* Consider requiring **min time since last harvest** (e.g., 30–60 minutes) to reduce spam.
* Never use external spot pricing oracles for stable strategies in v0.1.

### 4.4 Emergency controls

* `pauseDeposits()` / `pauseWithdrawals()` (guardian)
* `forceRemoveStrategy(strategy)` (risk‑reducing; can be immediate, or timelocked if it affects withdrawals)
* `setCap(strategy, newCap)` (timelock for increases)
* `sweepNonUSDC(token)` (owner; never USDC)

### 4.5 Upgradeability policy

Default for v0.1: **non-upgradeable vault** (safest). If you must upgrade:

* Use a proxy pattern only with:

  * multisig owner
  * timelocked upgrades
  * emergency pause
  * onchain `version()` + public upgrade announcements

---

## 5) Strategy universe (initial allowlist idea)

### 5.1 “Low risk, liquid” starting set (Base)

* Aave USDC (ERC‑4626 wrapper / blue chip)
* Morpho curated USDC vaults (ERC‑4626)
* Euler stable strategies (ERC‑4626)
* Optional idle strategy (keeps liquidity in the vault)

### 5.2 Risk tiers (governance-defined)

* **Tier 0:** Aave / blue chip
* **Tier 1:** Morpho curated “blue chip” vaults
* **Tier 2:** newer/less proven vaults

Constraints example:

* Tier0 ≤ 80%
* Tier1 ≤ 50%
* Tier2 ≤ 20%
* Max single-strategy cap ≤ 40% of vault TVL

---

## 6) UI requirements

### 6.1 Pages

* `/` Dashboard: TVL, net APY, share price chart, allocations pie, last rebalance.
* `/vault` Deposit/Withdraw panel, balances, fee disclosure.
* `/strategies` Table: APY, liquidity, cap, allocation, tier, external links.
* `/admin` Propose/execute: queue updates, caps, guardian actions, harvest.

### 6.2 Design “vibe”

* Theme: **Institutional DeFi** (clean, minimal, high-trust)
* Dark mode by default; avoid flashy gradients.
* Typography: Inter/Geist; mono for numbers.
* Emphasis on transparency: clearly show underlying strategies and the vault’s controls.

### 6.3 Metrics & charts

* Share price (assets/share)
* 7d / 30d realized APY (from share price history)
* Allocation history

---

## 7) Data / indexing plan

* Index events:

  * `Deposit`, `Withdraw` (ERC‑4626)
  * `Rebalanced`, `QueueUpdated`, `CapUpdated`
  * `FeeAccrued`
* Sampling:

  * record `assetsPerShare` hourly
* Storage:

  * Postgres (prod) / SQLite (dev)

---

## 8) Security & testing checklist

### 8.1 Unit + integration tests

* deposit/withdraw paths (including partial liquidity)
* rounding / zero-share protection
* queue/cap enforcement
* fee accrual correctness
* role and pause semantics

### 8.2 Invariants & fuzzing

* totalAssets accounting sanity across rebalances
* `convertToShares/convertToAssets` monotonicity
* no-share-inflation on first deposit

### 8.3 Tooling

* Foundry fuzz + invariant tests
* Slither / static analysis
* Optional fork tests against Base mainnet strategies

---

## 9) Execution plan (agents)

### Agent: Product Owner (PO)

**Deliverables**

* `/docs/ARCHITECTURE.md` and `/docs/THREAT_MODEL.md` baseline
* Initial risk tier definitions and limits
* Fee disclosure + user-facing safety disclaimers

**Tasks**

* Define MVP behaviors:

  * withdraw liquidity rules
  * pause semantics
  * what “idle liquidity target” is
* Define acceptance criteria for “done”.

### Agent: Protocol Researcher

**Deliverables**

* `/docs/STRATEGY_UNIVERSE.md` listing candidate USDC strategies on Base:

  * contract addresses
  * ERC‑4626 compatibility
  * liquidity/withdraw constraints
  * audits/reputation notes

**Tasks**

* Confirm ERC‑4626 compatibility (or adapter requirements)
* Provide v0.1 allowlist (start with 1–2 strategies) + suggested caps/tier

### Agent: Smart Contract Engineer

**Deliverables**

* `packages/contracts`:

  * vault contract
  * strategy integration (direct or adapters)
  * tests
  * deploy scripts

**Tasks**

* Implement ERC‑4626 vault with queues/caps/tier limits
* Implement performance fee (3% HWM) + events
* Implement roles, timelock flow, emergency pause
* Provide Base Sepolia + Base mainnet deployment scripts

### Agent: Backend / Indexer Engineer

**Deliverables**

* `services/indexer`:

  * event ingestion
  * APY calculator
  * API endpoints

**Tasks**

* Hourly sampler for `assetsPerShare`
* Rolling 7d/30d APY
* JSON endpoints for UI

### Agent: Frontend Engineer

**Deliverables**

* `apps/web` Next.js app:

  * dashboard
  * deposit/withdraw
  * strategy table
  * admin panel

**Tasks**

* Integrate wagmi/viem for reads/writes
* Charts: share price + allocations
* Role-gated admin UI

### Agent: DevOps / Release Engineer

**Deliverables**

* CI pipeline + deployment
* `/docs/RUNBOOK.md`

**Tasks**

* Env management, RPC providers, explorer API keys
* Monitoring: uptime + indexer lag + alerting

---

## 10) Definition of Done (MVP)

* Deployable to Base Sepolia with:

  * deposit/withdraw works
  * at least **1 strategy** integrated (2 preferred)
  * caps + queues enforced
  * fee accrual tested + events emitted
  * UI shows TVL, APY, allocations
* Rebalance callable by allocator.
* Emergency pause works.

---

## 11) Local dev quickstart

```bash
pnpm i
pnpm -C packages/contracts test
pnpm -C services/indexer dev
pnpm -C apps/web dev
```

Suggested env vars:

* `NEXT_PUBLIC_CHAIN_ID=8453`
* `NEXT_PUBLIC_RPC_URL=...`
* `INDEXER_RPC_URL=...`
* `DATABASE_URL=...`

---

## 12) v0 constants (verify before deploy)

* Base USDC: `0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913`
* Initial strategy candidates: Gauntlet/Morpho curated USDC vault(s) (addresses to be confirmed in `/docs/STRATEGY_UNIVERSE.md`).

---

## 13) Notes for v2 (optional)

* Support async/queued strategies (withdraw claims).
* Strategy factory + multi-vault product line.
* Onchain risk constraints tied to simple oracles (later).
