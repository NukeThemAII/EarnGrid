# EarnGrid – AGENTS.md

This file briefs AI coding agents (Codex CLI, Cursor, etc.) on how to work on the **EarnGrid** codebase.

EarnGrid is a DeFi dapp that lets users deposit **USDC** into an **ERC‑4626 meta‑vault** which allocates across multiple underlying ERC‑4626 strategies (e.g. Euler EVK vaults, Morpho / MetaMorpho vaults like Gauntlet USDC Core). The goal is to deliver a **set‑and‑forget, risk‑curated, blended APY**, similar in spirit to Superlend’s SuperFunds, but under the EarnGrid brand and with our own UI and automation.

The user will run Codex CLI agents against this repository, so keep instructions explicit, deterministic, and safe.

---

## 1. High‑level architecture

EarnGrid is structured as a monorepo with three main layers:

1. **On‑chain layer (contracts)**

   * Uses **Euler Earn** as the core ERC‑4626 meta‑vault implementation instead of reinventing it.
   * EarnGrid either:

     * (A) **Deploys an EulerEarn vault via the official EulerEarn factory** and brands it as "EarnGrid USDC"; or
     * (B) Forks euler‑earn as a dependency and configures it minimally for EarnGrid.
   * Underlying **strategies** are ERC‑4626 vaults such as:

     * Euler EVK / lending vaults.
     * Morpho Vaults (e.g. Gauntlet USDC Core) which already implement ERC‑4626.
   * Roles (owner/curator/allocator/guardian) are used to curate risk, set caps, and rebalance allocations.

2. **Frontend dapp (Next.js)**

   * A modern **Next.js (App Router)** + **TypeScript** app that behaves similarly to Superfunds UI:

     * Users connect a wallet on **Base**.
     * See EarnGrid vault stats (APY, TVL, strategies, risk tiers).
     * Deposit/withdraw USDC into/from the EarnGrid USDC vault.
     * See how their deposit is spread across underlying strategies.

3. **Off‑chain services (bots + indexers)**

   * A **Rebalancer bot** that periodically computes target allocations and calls allocator functions on the EarnGrid vault (e.g. adjust allocation points, rebalance).
   * A lightweight **indexer / data fetcher** to aggregate information from:

     * The EarnGrid vault (total assets, share price, caps, queues).
     * Underlying strategies (per‑strategy TVL, yield, risk flags).
   * These off‑chain services do **not** custody funds; they only read data and submit curated allocator transactions with a key controlled by governance.

For v1, focus on **Base mainnet** and **USDC** as the sole underlying asset.

---

## 2. Repository layout

Treat this as the canonical layout when (re)structuring the repo:

```text
/AGENTS.md              # This file
/README.md              # Human‑oriented overview & quickstart
/package.json           # Root scripts + pnpm workspace config
/pnpm-workspace.yaml    # Monorepo setup

/contracts/             # Foundry‑based Solidity project
  foundry.toml
  /lib/                 # External deps (euler‑earn, OZ, etc.)
  /src/
    /earngrid/
      EarnGridDeployment.s.sol   # Deployment & config scripts
      EarnGridPeriphery.sol      # Optional helper contract(s)
      EarnGridTypes.sol          # Shared structs/enums if needed
    /interfaces/
      IEarnGridVault.sol         # Thin interface to EulerEarn vault instance
    /mocks/                      # Test‑only contracts
  /test/
    EarnGrid.t.sol              # Core invariants/tests for the meta‑vault wiring

/apps/
  /web/                  # Next.js dapp (App Router)
    app/
    components/
    lib/
    public/
    package.json

/offchain/
  /rebalancer/           # TS bot that computes allocations & triggers rebalances
    src/
    package.json
  /indexer/              # TS indexer / data fetcher for onchain state
    src/
    package.json

/scripts/                # Optional: deployment & maintenance scripts (TS)
```

If a directory is missing, agents may create it following this structure.

---

## 3. Tooling & versions

**Languages / frameworks**

* Solidity: `^0.8.20` or higher, matching Euler‑Earn’s Solidity range.
* Contracts framework: **Foundry** (no Hardhat unless explicitly requested).
* Frontend: **Next.js 15+ (App Router)**, **TypeScript**, **React Server Components**.
* Frontend stack: **wagmi v2**, **viem**, **RainbowKit** for wallet connections, **Tailwind CSS** + **shadcn/ui**.
* Off‑chain services: **Node.js 20+**, **TypeScript**, **pnpm** for package management.

**Dependencies (contracts)**

* `euler-xyz/euler-earn` via `forge install` or as git submodule.
* `OpenZeppelin/contracts` for ERC‑20, utils, and interfaces.
* Optionally: `OpenZeppelin/contracts-upgradeable` only if a separate upgradeable helper is ever needed (core vaults should remain immutable).

**Dependencies (frontend & bots)**

* `next`, `react`, `react-dom`, `typescript`, `eslint`, `prettier`.
* `wagmi`, `viem`, `@rainbow-me/rainbowkit`.
* `zod` for runtime validation.
* `dotenv` for env parsing.
* `cross-env` for cross‑platform scripts.
* `ts-node` or `tsx` for running TS scripts.

Do **not** introduce exotic or unmaintained libraries without a clear reason; prefer well‑known, audited dependencies.

---

## 4. Setup & commands

### 4.1 Root setup

Assume a fresh clone of the EarnGrid repo.

```bash
# Install pnpm globally if missing
npm install -g pnpm

# Install all workspace dependencies
pnpm install
```

Useful root scripts (to be maintained in `package.json`):

* `pnpm lint` – run linters across workspace.
* `pnpm test` – run all tests (contracts + frontend + bots where applicable).
* `pnpm build` – build contracts (via Foundry) and frontend.

Agents should keep these scripts up‑to‑date when adding new packages.

### 4.2 Contracts

```bash
cd contracts

# Install external libs (if not already in /lib)
forge install euler-xyz/euler-earn
forge install OpenZeppelin/openzeppelin-contracts

# Compile
forge build

# Run tests
forge test

# Example: fork test against Base mainnet (env var URL required)
BASE_RPC_URL=... forge test --fork-url $BASE_RPC_URL
```

Guidelines for contracts:

* Place new contracts under `contracts/src/earngrid/` or `contracts/src/interfaces/` as appropriate.
* Keep `foundry.toml` clean and minimal; document networks and RPC URLs via env variables, **not** hardcoded in config.

### 4.3 Frontend (apps/web)

```bash
cd apps/web

# Dev server
pnpm dev

# Production build
pnpm build

# Lint & tests (once added)
pnpm lint
pnpm test
```

The web app is a standard Next.js app using the App Router (`app/` directory). Use TypeScript strictly (`"strict": true` in `tsconfig.json`).

### 4.4 Off‑chain services

Each service lives under `/offchain/<name>` and has its own `package.json`.

Example for `rebalancer`:

```bash
cd offchain/rebalancer

# Run in dev mode
pnpm dev

# Or run one‑shot rebalancing
pnpm start
```

**Never** commit real private keys. Use `.env` + `.env.example` and instruct users to set their own environment variables.

---

## 5. Smart‑contract design (EarnGrid meta‑vault)

### 5.1 Core philosophy

* Do **not** re‑implement the core meta‑vault logic from scratch.
* Instead, rely on the **audited EulerEarn implementation** and treat it as an external dependency.
* EarnGrid’s on‑chain contracts should focus on:

  * Deploying / configuring an EulerEarn vault for USDC on Base.
  * Managing roles and strategy lists.
  * Providing periphery helpers for deposits, withdrawals, and delegation.
  * Exposing clean ABIs for the frontend and off‑chain bots.

### 5.2 Target vault topology

* **Underlying asset**: canonical **USDC** on Base.
* **Meta‑vault**: one **EulerEarn** vault per underlying asset (start with a single USDC vault).
* **Strategies**: up to ~10–15 ERC‑4626 strategies per vault in v1, e.g.:

  * Euler EVK USDC lending vault(s).
  * Morpho / MetaMorpho USDC vaults such as Gauntlet USDC Core.
  * Optionally other trusted ERC‑4626 stablecoin vaults.
* **Queues**:

  * `supplyQueue`: order in which deposits are allocated, within per‑strategy caps.
  * `withdrawQueue`: order in which strategies are tapped for withdrawals.
* **Caps & risk control**:

  * Per‑strategy caps (`cap` / `supply cap`) define maximum exposure.
  * Caps can be reduced immediately; increases should be treated as risk‑increasing and handled carefully.

### 5.3 Roles & permissions

Follow EulerEarn’s role model and terminology:

* **Owner** – highest‑privilege governance identity for a specific EarnGrid vault.
* **Curator** – manages strategy set and caps (add/remove strategies, adjust caps, update queues).
* **Allocator(s)** – executes reallocations and interacts with `rebalance` / `reallocate`‑style functions.
* **Guardian** – safety role, allowed to cancel risk‑increasing actions while timelocked.

In EarnGrid:

* On mainnet, these roles should be **multisigs or governance contracts**, not EOAs.
* In tests and local dev, they can be EOAs for simplicity.

### 5.4 Contracts to implement

Within `contracts/src/earngrid/`:

1. **`EarnGridDeployment.s.sol` (Foundry script)**

   * Responsibilities:

     * Connect to the canonical `EulerEarnFactory` on Base.
     * Deploy a new USDC‑denominated EulerEarn vault if one does not already exist.
     * Configure initial params (name, symbol, initial cash allocation points, smearing period, owner).
     * Optionally, add a basic set of strategies and caps if the factory allows this in a single transaction.
   * This script should be idempotent or at least clearly log the deployed vault address.

2. **`EarnGridPeriphery.sol` (optional helper contract)**

   * Thin convenience layer around the vault to simplify UX:

     * `depositUSDC(uint256 assets, address receiver)` which handles allowances and calls the EulerEarn vault.
     * `withdrawUSDC(uint256 assets, address receiver)` wrapper.
     * Optional helper to combine deposit + vote delegation, or deposit + referral tracking.
   * This contract must **never custody funds long‑term**; it should pass assets straight into the vault.

3. **`IEarnGridVault.sol` (interface)**

   * Minimal interface describing the subset of the EulerEarn vault that the frontend and bots care about:

     * ERC‑4626 methods (`deposit`, `withdraw`, `totalAssets`, `convertToAssets`, etc.).
     * Strategy inspection (`totalAllocationPoints`, `getStrategy(address)`, `withdrawalQueue()`, etc.).

### 5.5 Strategy onboarding guidelines

When adding a new ERC‑4626 strategy (EVK, Morpho, Gauntlet, etc.):

1. **Verify ERC‑4626 compliance** – the vault must implement `deposit`, `withdraw`, `mint`, `redeem`, `totalAssets`, etc.
2. **Inflation‑attack protection** – ensure the strategy vault has a proper "dead deposit" / first‑depositor protection (common in Morpho vaults and MetaMorpho design).
3. **Liquidity & slippage** – confirm the vault has sufficient liquidity so that deposits/withdrawals do not cause extreme slippage.
4. **Risk classification** – label each strategy internally as conservative / moderate / aggressive, and set caps accordingly.
5. **Caps & queues** – update supply/withdraw queues so that:

   * Conservative, most liquid strategies receive base allocations.
   * Yield‑chasing strategies have capped exposure and are lower in the withdraw queue.

For testnets and local forks, you can use mocked ERC‑4626 vaults to simulate various yield profiles and losses.

---

## 6. Off‑chain rebalancer design

### 6.1 Purpose

The rebalancer is an off‑chain bot that:

* Observes the EarnGrid vault and all enabled strategies.
* Pulls yield and risk data (on‑chain + external APIs, where available).
* Computes a **target allocation vector** (how much % of TVL each strategy should have, within caps).
* Submits on‑chain transactions (using the `Allocator` role) to:

  * Update allocation points and/or queues.
  * Call a `rebalance`‑style function to move liquidity.

### 6.2 Implementation sketch

* Location: `/offchain/rebalancer`.
* Language: TypeScript, Node.js 20+.

**Key modules:**

* `src/config.ts` – per‑network config (vault address, RPC URLs, strategy addresses, caps, risk classes).
* `src/providers.ts` – viem/ethers clients for Base mainnet and testnets.
* `src/onchain.ts` – helpers to read:

  * Vault TVL and share price.
  * Strategy allocation points, caps, allocated assets, and status.
* `src/apy.ts` – helpers to estimate per‑strategy APYs, pulling from:

  * Direct on‑chain rates where available (e.g. EVK, Morpho rate models).
  * Fallback external APIs or pre‑computed values.
* `src/optimizer.ts` – implements the allocation logic:

  * Subject to caps and risk class constraints, allocate more to higher APY strategies.
  * Maintain a minimum cash / idle buffer for withdrawals.
  * Apply hysteresis (don’t rebalance on tiny differences) to avoid churn.
* `src/executor.ts` – builds and sends transactions to the EarnGrid vault:

  * Calls allocator functions such as `adjustAllocationPoints` and `rebalance` with the computed targets.

### 6.3 Safety rules for agents

* Never commit real private keys to the repository. Read them from `.env` in runtime only.
* For tests or local sims, use ephemeral keys or impersonation (e.g. Foundry fork).
* Ensure gas limits and slippage thresholds are configurable and conservative.
* Before mainnet deployment, provide a human‑readable explanation of the rebalancing policy in `README.md`.

---

## 7. Frontend dapp design (apps/web)

### 7.1 Goals

The EarnGrid UI should:

* Let users connect a wallet on Base and see their **USDC** and **EarnGrid share** balances.
* Show **vault‑level metrics**: TVL, APY (current & historic if available), share price, last rebalance timestamp.
* Show **strategy breakdown**: list all underlying ERC‑4626 strategies with allocation %, caps, and basic risk labels.
* Provide a clean flow for **depositing** and **withdrawing** with clear UX around expected slippage and limits.

### 7.2 Stack & structure

Within `apps/web`:

* `app/layout.tsx` – shared layout, theming, and providers.
* `app/page.tsx` – main EarnGrid overview page (vault list/summary).
* `app/vault/[chain]/[address]/page.tsx` – per‑vault detail page.
* `components/` – reusable building blocks (cards, tables, forms, charts).
* `lib/` – hooks and utilities for chain interactions (e.g. `useVault`, `useStrategies`).

**Key libraries & patterns:**

* `wagmi` + `viem` for on‑chain reads/writes.
* `@rainbow-me/rainbowkit` for wallet UI (or similar).
* `zod` for form validation.
* `swr` or React Query for caching data from indexer endpoints (if used).

### 7.3 UX guidelines

* Always show **estimated APY** and **risk labels**; never imply principal guarantee.
* Before transactions, show:

  * Amount to deposit/withdraw.
  * Expected shares or assets received (based on `previewDeposit` / `previewWithdraw`).
  * Gas/network fees estimate if possible.
* Provide clear error messages for failed transactions (e.g. insufficient allowance, maxWithdraw exceeded).
* Prefer mobile‑friendly, single‑column layouts on small screens.

### 7.4 Do / Don’t for agents

* **Do:** Reuse Superlend UI ideas (cards, strategy tables), but keep branding, copy, and color scheme **EarnGrid‑specific**.
* **Do:** Keep contract ABIs in a dedicated module (`lib/abi/earngridVault.ts`) and generate types if possible.
* **Don’t:** Hardcode mainnet addresses in multiple places; centralize them in a config file.
* **Don’t:** Depend on any browser‑only global state for critical logic; all protocol math should be easily testable.

---

## 8. Testing, quality, and workflows

### 8.1 Contracts

* Use Foundry’s `forge test` with:

  * Unit tests for:

    * Deposit / withdraw / mint / redeem flows via the EulerEarn vault instance we deploy.
    * Correct mapping between vault TVL and per‑strategy balances.
    * Caps enforcement and queue behavior in simple scenarios.
  * Property/fuzz tests where practical (e.g. random deposit/withdraw sequences).
* Use fork tests against Base to simulate interactions with **real** EVK/Morpho vaults where addresses are known.

### 8.2 Frontend

* At minimum, provide:

  * Smoke tests for core pages (home + vault details) using React Testing Library.
  * Basic snapshot or interaction tests for the deposit/withdraw form (valid input, error states).

### 8.3 Off‑chain services

* Write unit tests for the allocation logic in `optimizer.ts` (given yields and caps, ensure target weights are as expected).
* Use integration tests with a local anvil/Hardhat node or Foundry fork to ensure `executor.ts` builds valid transactions.

### 8.4 Formatting & linting

* Use ESLint + Prettier across TypeScript code.
* Use `solhint` or Foundry’s style + built‑in formatters for Solidity.
* Enforce formatting via `pnpm lint` and/or pre‑commit hooks if configured.

Agents should prefer **small, incremental changes** with clear commit messages rather than huge refactors.

---

## 9. Security & safety constraints

* Do **not** modify the core EulerEarn contracts except for clearly scoped, reviewed changes; treat them as external, audited dependencies.
* Never remove timelocks or other safety mechanisms purely for convenience.
* Never add code paths that allow a privileged role to arbitrarily sweep user funds out of the vault.
* All mainnet‑facing addresses for vaults, strategies, or oracles must come from configuration and be easy to audit.
* Any new external protocol integration should be documented in `README.md` with:

  * A short description of the protocol.
  * The rationale for its inclusion.
  * Known risks.

For local development and tests, it is acceptable to use mocks and simplified flows. For mainnet deployment, always assume adversarial conditions.

---

## 10. How to think when working as an agent

When Codex or any other coding agent works on EarnGrid:

1. **Start by reading `README.md` and this `AGENTS.md`** to understand the intended architecture and patterns.
2. **Respect the separation of concerns**:

   * Solidity work lives under `/contracts`.
   * Frontend work lives under `/apps/web`.
   * Bots and scripts live under `/offchain`.
3. **Prefer integration over reinvention**: use EulerEarn, Morpho Vaults, and other ERC‑4626 implementations instead of rolling your own lending logic.
4. **Keep the project runnable**: after significant changes, ensure `pnpm install`, `forge build`, and `pnpm dev` still work.
5. **Document non‑obvious logic** with comments, especially around allocation algorithms and risk controls.

If a future human or agent opens this repo, they should be able to understand the EarnGrid design and extend it safely by following this file.
