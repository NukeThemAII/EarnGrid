# EarnGrid Protocol Overview

## What it is
- One onchain ERC-4626 vault (BlendedVault) on Base that accepts USDC and mints shares.
- Allocates USDC across a whitelisted set of ERC-4626 strategy vaults.
- Uses caps, tier exposure limits, and deposit/withdraw queues to enforce risk controls.
- Charges a 3% performance fee on gains only (high-water mark).

## How many vaults?
- 1 vault at the top level (BlendedVault).
- Multiple underlying strategy vaults (ERC-4626) configured by governance.

## What vaults it uses
- Only whitelisted strategies in `docs/STRATEGY_UNIVERSE.md`.
- Strategies are added by curator/owner with timelock for risk-increasing changes.
- There is no onchain discovery or auto-allowlist.

## Does it scan for new vaults?
- No. Strategy sourcing is offchain research + due diligence.
- New strategies require governance approval and timelocked execution.

## Blended APY
- There is no onchain "target APY" knob.
- Realized APY is computed offchain from `assetsPerShare` history (indexer).
- "Target APY" is an offchain objective that informs allocator weights.

## Rebalance model
- The allocator (keeper/bot) calls `rebalance()` and `harvest()`.
- Onchain enforcement includes:
  - Per-strategy caps
  - Tier exposure limits
  - Deposit/withdraw queue ordering
  - Idle liquidity target
  - Harvest guards (min interval, max daily increase)

## Ideas for auto-rebalance (safe)
1) Data collection
   - Strategy APY, TVL, maxWithdraw, utilization, share-price change, pause flags.
2) Health filters
   - Drop strategies that fail health checks (e.g., maxWithdraw=0, paused, large price jump).
3) Scoring model (offchain)
   - score = expectedYield - riskPenalty - liquidityPenalty
4) Target weights
   - Apply caps, tier limits, and min idle liquidity.
5) Execution guards
   - Max move per rebalance, minimum drift threshold, and cooldowns.
6) Automation
   - Run via cron/keeper; keep the key limited to allocator role.
   - Optional AI agent (Gemini) proposes weights, but onchain constraints must still enforce limits.

## Safety and monitoring signals
- Strategy health: share price change, maxWithdraw, utilization, TVL drops.
- Vault health: idle ratio, totalAssets trend, harvest events, fee shares minted.
- If strategy valuation reverts, cached strategy assets are used for accounting.

## Future enhancements (ideas)
- Strategy health endpoints in the indexer.
- Risk scoring config file for allocator (caps, min liquidity, max drift).
- Dry-run and simulation for rebalance proposals before execution.
