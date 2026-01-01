# Test Suite

## Contract Tests (Foundry)

```bash
pnpm -C packages/contracts test
```

```bash
forge test
```

### Latest run

- Date: 2026-01-01
- Command: `cd packages/contracts && forge test`
- Result: 26 passed, 0 failed, 0 skipped

### What is tested

- `BlendedVault.t.sol`: deposit/withdraw flows, caps/tiers, queue order, pauses, role checks, sweep protection.
- `BlendedVaultFees.t.sol`: harvest HWM accounting, fee minting, harvest cadence guards, loss handling.
- `BlendedVaultFuzz.t.sol`: monotonic share/asset conversions, first-deposit protections.
- `BlendedVaultTimelock.t.sol`: timelock required for risk-increasing changes, including timelock delay reductions.
- `BlendedVaultReentrancy.t.sol`: reentrancy guard against malicious strategy callbacks.

### Test Files

| File | Tests | Coverage |
|------|-------|----------|
| `BlendedVault.t.sol` | 10 | Core flows |
| `BlendedVaultFees.t.sol` | 6 | Fee logic |
| `BlendedVaultFuzz.t.sol` | 4 | Fuzz/invariants |
| `BlendedVaultTimelock.t.sol` | 5 | Timelock |
| `BlendedVaultReentrancy.t.sol` | 1 | Reentrancy |
| **Total** | **26** | |

### Run with verbosity

```bash
pnpm -C packages/contracts test -vvv
```

### Run specific test

```bash
pnpm -C packages/contracts test --match-test testHarvestMintsFeeShares
```

## Indexer Smoke Test

```bash
pnpm -C services/indexer dev
# Visit http://localhost:3001/api/health
```

## Frontend Dev

```bash
pnpm -C apps/web dev
# Visit http://localhost:3000
```
