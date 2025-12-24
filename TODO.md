# TODO (MetaYield v0.1)

## Protocol
- Confirm and validate Base Sepolia USDC address for deployment scripts.
- Integrate 1–2 live strategies (MetaMorpho vaults) with caps and queues on Sepolia.
- Add strategy adapters only if ERC-4626 compatibility gaps are confirmed.

## Indexer
- Add reorg safety (confirmations + rollback if needed).
- Add historical allocation snapshots endpoint for UI charts.
- Persist indexer health metrics (lag, last block, error count).

## Frontend
- Add role-gated execute timelock actions and deeper queue management UX.
- Add richer charts for share price history and historical allocation breakdown.

## Docs
- Expand `docs/STRATEGY_UNIVERSE.md` with full due diligence notes.
- Keep `docs/RUNBOOK.md` current as deployment process evolves.

## QA
- Add fork tests against Base strategies (optional).
- Add invariant test for totalAssets accounting across rebalances.
