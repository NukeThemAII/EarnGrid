# Test Suite

## Contract Tests (Foundry)

```bash
pnpm -C packages/contracts test
```

### Test Files

| File | Tests | Coverage |
|------|-------|----------|
| `BlendedVault.t.sol` | 9 | Core flows |
| `BlendedVaultFees.t.sol` | 6 | Fee logic |
| `BlendedVaultFuzz.t.sol` | 4 | Fuzz/invariants |
| `BlendedVaultTimelock.t.sol` | 4 | Timelock |
| `BlendedVaultReentrancy.t.sol` | 1 | Reentrancy |
| **Total** | **24** | |

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
