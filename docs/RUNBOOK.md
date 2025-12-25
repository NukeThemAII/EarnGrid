# Runbook - MetaYield v0.1

## Purpose
Operational guide for the USDC Blended Vault (MetaYield) covering deployment, configuration, and incident response.

## Environments
- Base Sepolia (staging)
- Base Mainnet (production)

## Required Secrets / Env
### Contracts (Foundry)
- `DEPLOYER_KEY`
- `VAULT_OWNER`
- `VAULT_CURATOR`
- `VAULT_ALLOCATOR`
- `VAULT_GUARDIAN`
- `FEE_RECIPIENT`
- `BASE_SEPOLIA_USDC` (Sepolia only)
- Optional tuning:
  - `TIER0_MAX_BPS`
  - `TIER1_MAX_BPS`
  - `TIER2_MAX_BPS`
  - `IDLE_LIQUIDITY_BPS`
  - `MIN_INITIAL_DEPOSIT`
  - `MAX_DAILY_INCREASE_BPS`
  - `MIN_HARVEST_INTERVAL`
  - `TIMELOCK_DELAY`

### Indexer
- `INDEXER_RPC_URL`
- `VAULT_ADDRESS`
- `DATABASE_URL`
- `START_BLOCK`
- `POLL_INTERVAL_MS`
- `SAMPLE_INTERVAL_SEC`
- `FINALITY_BLOCKS`
- `MAX_BLOCK_RANGE`
- `RATE_LIMIT_WINDOW_SEC`
- `RATE_LIMIT_MAX`
- `PORT`

### Web
- `NEXT_PUBLIC_CHAIN_ID`
- `NEXT_PUBLIC_RPC_URL`
- `NEXT_PUBLIC_INDEXER_URL`
- `NEXT_PUBLIC_VAULT_ADDRESS`
- `NEXT_PUBLIC_USDC_ADDRESS`
- `NEXT_PUBLIC_USDC_DECIMALS`

## Deployments
### Base Sepolia
1. Deploy vault:
   ```bash
   forge script packages/contracts/script/DeployBaseSepolia.s.sol:DeployBaseSepolia \
     --rpc-url $RPC_URL --broadcast
   ```
2. Record the vault address and configure indexer + web envs.
3. Schedule + execute initial strategy allowlist/caps after timelock.
4. Set deposit/withdraw queues (allocator role).

### Base Mainnet
1. Verify strategy allowlist in `docs/STRATEGY_UNIVERSE.md`.
2. Deploy:
   ```bash
   forge script packages/contracts/script/DeployBaseMainnet.s.sol:DeployBaseMainnet \
     --rpc-url $RPC_URL --broadcast
   ```
3. Configure roles, queues, and caps.

## Roles & Access
- Owner: role management, feeRecipient, timelock config.
- Curator: schedule/execute strategy additions, cap and tier changes.
- Allocator: rebalance and harvest; update queues.
- Guardian: pause deposits/withdrawals, emergency remove strategies.

## Operations
- Harvest cadence: hourly/daily (respect `MIN_HARVEST_INTERVAL`).
- Rebalance cadence: based on allocation drift or APY changes.
- Idle liquidity target set by `IDLE_LIQUIDITY_BPS`.

## Monitoring
- Alerts on:
  - Strategy additions/removals
  - Cap/tier changes
  - Large rebalances
  - Harvest events / fee shares minted
  - assetsPerShare spikes
- Indexer health: `/api/health`

## Incident Response
1. Pause deposits (guardian).
2. Pause withdrawals if needed (guardian) and assess liquidity.
3. Reduce caps or remove strategy (curator/guardian) to unwind risk.
4. Notify users and document incident.

## Post-Mortem Checklist
- Root cause and timeline
- Affected users and amounts
- Mitigations applied
- Follow-up actions and tests
