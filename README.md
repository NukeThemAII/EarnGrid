# EarnGrid

EarnGrid is a DeFi meta-vault that allocates USDC across curated ERC-4626 strategies (Euler Earn, Morpho MetaMorpho, Gauntlet, etc.) to deliver a blended APY on Base. This repository follows the structure described in `AGENTS.md` and is ready for Foundry contracts, a Next.js dapp, and off-chain automation.

## Repository layout

- `contracts/` Foundry project for EarnGrid deployment scripts, periphery helpers, and interfaces.
- `apps/web/` Next.js 15 (App Router) dapp for deposits, withdrawals, and strategy insights.
- `offchain/rebalancer/` Bot skeleton for computing allocations and sending allocator txs.
- `offchain/indexer/` Placeholder for data aggregation and API surfacing.
- `scripts/` Slot for TypeScript maintenance or deployment utilities.

## Quickstart

1) Install pnpm if missing: `npm i -g pnpm`
2) Install workspace deps (will hydrate each package once their manifests are ready): `pnpm install`
3) Build everything: `pnpm build`
4) Run tests: `pnpm test`

## Contracts (Foundry)

- Config lives in `contracts/foundry.toml`.
- External deps: Euler Earn, OpenZeppelin contracts (install with `forge install` as noted in `AGENTS.md`).
- Core scripts and helpers live under `contracts/src/earngrid/`.
- Run `forge build` or `forge test` from `contracts/`.
- Deployment script: `contracts/src/earngrid/EarnGridDeployment.s.sol` expects env vars:
  - `EULER_EARN_FACTORY` (required)
  - `EARNGRID_OWNER` (optional, defaults to msg.sender)
  - `EARNGRID_USDC` (defaults to Base USDC)
  - `EARNGRID_TIMELOCK`, `EARNGRID_NAME`, `EARNGRID_SYMBOL`, `EARNGRID_SALT`
- Periphery wrapper: `EarnGridPeriphery` forwards deposits/withdrawals; withdraws require the caller to approve the periphery to burn their vault shares.

## Web dapp (Next.js)

- Location: `apps/web`.
- App Router with TypeScript, wagmi v2, viem, RainbowKit, Tailwind, shadcn/ui.
- Dev server: `pnpm dev` inside `apps/web`.
- Production build: `pnpm build` inside `apps/web`.
- Env (`apps/web/.env.example`): set `NEXT_PUBLIC_VAULT_ADDRESS`, `NEXT_PUBLIC_ASSET_ADDRESS`, `NEXT_PUBLIC_CHAIN_ID`, `NEXT_PUBLIC_BASE_RPC_URL`, `NEXT_PUBLIC_WALLETCONNECT_ID`.
- Action panel wires to the vault’s `deposit` / `withdraw` functions via wagmi; remember to approve USDC to the vault before depositing.
- **Admin Dashboard**: Located at `/admin`. Provides role-based access (Owner/Curator/Allocator/Guardian) to manage caps, queues, and timelocks.
- **Live Data**: Displays real-time TVL, blended APY, supply/withdraw queues, and vault parameters (fee, timelock).
- **Guardian Flow**: Pending caps (submitted by Curator) are surfaced; Guardians can accept them directly from the dashboard.

## Off-chain services

- Rebalancer bot lives in `offchain/rebalancer` (TypeScript, Node 20+).
- Indexer placeholder lives in `offchain/indexer`.
- Add environment variables via `.env` in each service; never commit real keys.
- Rebalancer reads vault state + live strategy TVLs (ERC-4626 `asset` + `totalAssets`), computes weights, and prints `reallocate` calldata for allocator submission; tests run with `pnpm test` inside `offchain/rebalancer`.
- Indexer reads vault totals and share price via viem; configure `BASE_RPC_URL` and `VAULT_ADDRESS`.
- Strategy addresses in `offchain/rebalancer/src/config.ts` should be set to real ERC-4626 vaults (e.g., EVK, Morpho/MetaMorpho USDC on Base) before running in production.

## Notes

- Follow `AGENTS.md` for architecture, safety, and testing guidance.
- Keep mainnet addresses, caps, and risk config centralized and auditable.
- Prefer small, incremental changes with clear docs and tests.
