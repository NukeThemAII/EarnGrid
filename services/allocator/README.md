# Allocator Keeper Bot

Stateless Node.js keeper bot that periodically:

1. **Fetches APY data** from the Morpho Blue GraphQL API for MetaMorpho vault
   strategies configured in the BlendedVault.
2. **Evaluates allocation** — compares current onchain strategy allocations
   vs target allocation (weighted by APY, constrained by caps and tier limits).
3. **Rebalances** — if any strategy's allocation change exceeds
   `MIN_APY_IMPROVEMENT_BPS`, calls `rebalance()` on the vault.
4. **Harvests** — calls `harvest()` every `HARVEST_INTERVAL_MS`.

## Usage

```bash
# Install
pnpm install

# Copy and fill in env vars
cp .env.example .env

# Run in dev mode (hot-reload)
pnpm dev

# Build and run
pnpm build
pnpm start
```

## Configuration

All configuration is via environment variables (see `.env.example`):

| Variable | Default | Description |
|---|---|---|
| `RPC_URL` | (required) | Base RPC endpoint |
| `PRIVATE_KEY` | (required) | Private key with ALLOCATOR_ROLE |
| `VAULT_ADDRESS` | (required) | BlendedVault contract address |
| `MORPHO_API_URL` | `https://blue-api.morpho.org/graphql` | Morpho GraphQL endpoint |
| `POLL_INTERVAL_MS` | `43200000` (12h) | Time between ticks |
| `HARVEST_INTERVAL_MS` | `21600000` (6h) | Time between harvest() calls |
| `MIN_APY_IMPROVEMENT_BPS` | `50` (0.5%) | Min APY improvement to trigger rebalance |
| `GAS_LIMIT_BUMP` | `1.2` | Gas limit multiplier |
| `DRY_RUN` | `false` | If true, logs actions without sending txns |
| `CHAIN_ID` | `8453` | Chain ID (Base) |

## Dry Run

Set `DRY_RUN=true` to simulate all decisions without executing transactions.
All actions (rebalance, harvest) are logged as JSON lines to stdout.

## Logging

All output is JSON lines (NDJSON) for easy aggregation into log systems.

```json
{"level":"info","event":"strategy_apy","strategy":"0x...","apyPercent":"4.50","netApy":0.045}
{"level":"info","event":"rebalancing","withdrawCount":1,"depositCount":1}
```
