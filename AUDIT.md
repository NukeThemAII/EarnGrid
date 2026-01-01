# EarnGrid Security Audit Report

**Version:** 1.0  
**Date:** January 1, 2026  
**Auditor:** Antigravity (AI Security Analyst)  
**Scope:** BlendedVault.sol, Indexer, Frontend, SDK

---

## Executive Summary

EarnGrid is a USDC savings dApp on Base implementing an ERC-4626 vault-of-vaults architecture. This audit covers the complete codebase including smart contracts, indexer service, and frontend application.

### Risk Assessment

| Severity | Count | Status |
|----------|-------|--------|
| Critical | 0 | ✅ None found |
| High | 0 | ✅ Fixed |
| Medium | 0 | ✅ Fixed |
| Low | 2 | ⚠️ Accepted |
| Informational | 3 | 📝 Noted |

**Overall Assessment:** Production-ready for mainnet with professional audit recommended.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────┐
│                     BlendedVault (ERC-4626)                  │
├─────────────────────────────────────────────────────────────┤
│  • Vault-of-vaults aggregating synchronous strategies       │
│  • Role-based access (Owner, Curator, Allocator, Guardian)  │
│  • Timelock for risk-increasing changes (≥24h)              │
│  • 3% performance fee on profits (HWM-based)                │
└─────────────────────────────────────────────────────────────┘
         │                    │                    │
         ▼                    ▼                    ▼
   ┌──────────┐        ┌──────────┐        ┌──────────┐
   │Strategy A│        │Strategy B│        │Strategy C│
   │ (Tier 0) │        │ (Tier 1) │        │ (Tier 2) │
   └──────────┘        └──────────┘        └──────────┘
```

---

## Security Features Implemented

### Smart Contract Protections

| Protection | Implementation | Status |
|------------|----------------|--------|
| Reentrancy Guard | OpenZeppelin `ReentrancyGuard` on all state-changing functions | ✅ |
| Safe Strategy Calls | `_safePreviewRedeem()` with try/catch prevents reverting strategies from DOS | ✅ |
| Liquidity-Aware Withdrawals | `maxWithdraw`/`maxRedeem` return actual available liquidity | ✅ |
| Timelock | ≥24h delay for risk-increasing changes | ✅ |
| Pause Controls | Guardian can halt deposits/withdrawals | ✅ |
| Harvest Guard | `maxDailyIncreaseBps` prevents manipulation | ✅ |
| Min Initial Deposit | Prevents first-depositor share inflation attack | ✅ |
| Role Separation | 4-role system with principle of least privilege | ✅ |

### Key Security Functions

```solidity
/// @notice Safely call previewRedeem, returning 0 if strategy reverts
function _safePreviewRedeem(address strategy, uint256 shares) internal view returns (uint256) {
    try IERC4626(strategy).previewRedeem(shares) returns (uint256 assets) {
        return assets;
    } catch {
        return 0; // Bricked strategy treated as 0 value
    }
}

/// @notice Liquidity-aware maxWithdraw per ERC-4626
function maxWithdraw(address owner) public view override returns (uint256) {
    if (pausedWithdrawals) return 0;
    uint256 ownerAssets = super.maxWithdraw(owner);
    uint256 liquidity = _availableLiquidity();
    return ownerAssets < liquidity ? ownerAssets : liquidity;
}
```

---

## Findings

### Fixed Issues (Previously Found)

#### [FIXED] Strategy Revert DOS (was High)
- **Issue:** `totalAssets()` called `previewRedeem()` directly; a reverting strategy would DOS the entire vault.
- **Fix:** Added `_safePreviewRedeem()` with try/catch wrapper.
- **Files:** `BlendedVault.sol` L168-180, L882-897

#### [FIXED] maxWithdraw Not Liquidity-Aware (was Medium)
- **Issue:** `maxWithdraw`/`maxRedeem` returned owner's full balance even when liquidity was insufficient.
- **Fix:** Added `_availableLiquidity()` helper; overrides now return `min(ownerAssets, liquidity)`.
- **Files:** `BlendedVault.sol` L160-175

#### [FIXED] Indexer Skips startBlock Events (was Low)
- **Issue:** `lastProcessedBlock = startBlock` meant events at startBlock were skipped.
- **Fix:** Changed to `startBlock - 1`.
- **Files:** `indexer.ts` L40

#### [FIXED] Indexer Multicall Fragility (was Low)
- **Issue:** `allowFailure: false` caused entire snapshot to fail if one strategy reverted.
- **Fix:** Changed to `allowFailure: true` with graceful filtering.
- **Files:** `indexer.ts` L151-197

---

### Accepted Risks (Low Severity)

#### [L-01] Queue Order Changes on Removal
- **Description:** `_removeFromQueue` uses swap-and-pop, which changes priority order.
- **Mitigation:** Allocator can reset queue order after removals.
- **Status:** Accepted for v1.0 - documented behavior.

#### [L-02] strategyList Grows Monotonically
- **Description:** Disabled strategies remain in `strategyList`, potentially causing gas issues with many strategies.
- **Mitigation:** Practical limit of ~20 strategies before gas concerns.
- **Status:** Accepted for v1.0 - permissioned strategy addition.

---

### Informational

#### [I-01] Fee Drag on Deposits
- **Description:** Users depositing when `assetsPerShare > HWM` buy at pre-fee price.
- **Status:** Known trade-off (gas vs exactness).

#### [I-02] Strict Withdrawals
- **Description:** Withdrawals revert if underlying strategies lack liquidity.
- **Status:** By design - "strict ERC-4626" model.

#### [I-03] APY Precision
- **Description:** Indexer APY calculation uses JavaScript Number, losing precision for very large vaults.
- **Status:** Acceptable for typical vault sizes.

---

## Gas Optimization

| Area | Optimization |
|------|--------------|
| Strategy iteration | `strategyList.length` cached before loops |
| Early exits | Zero share/asset checks skip expensive calls |
| Memory vs storage | View functions use memory for temporary arrays |
| Safe calls | try/catch only adds ~100 gas per strategy |

---

## Test Coverage

| Test Suite | Tests | Coverage |
|------------|-------|----------|
| BlendedVault.t.sol | 9 | Core deposit/withdraw/pause |
| BlendedVaultFees.t.sol | 6 | HWM, harvest, fee accrual |
| BlendedVaultFuzz.t.sol | 4 | Fuzz testing, inflation attacks |
| BlendedVaultTimelock.t.sol | 4 | Timelock enforcement |
| BlendedVaultReentrancy.t.sol | 1 | Reentrancy protection |
| **Total** | **24** | **All passing** |

---

## Recommendations for Mainnet

1. **Professional Audit** - Engage Trail of Bits, OpenZeppelin, or similar before significant TVL.
2. **Multisig** - Use Gnosis Safe for Owner and Guardian roles.
3. **Monitoring** - Set alerts for `Paused`, large withdrawals, and `assetsPerShare` deviations.
4. **Strategy Vetting** - Ensure all whitelisted strategies are donation-resistant.
5. **Gradual TVL** - Start with caps and increase as confidence grows.

---

## Files Reviewed

| Component | Files | Lines |
|-----------|-------|-------|
| Contracts | `BlendedVault.sol` | 960 |
| Tests | `*.t.sol` (5 files) | ~800 |
| Indexer | `indexer.ts`, `index.ts`, `queries.ts` | ~400 |
| Frontend | `apps/web/` | ~2000 |
| SDK | `packages/sdk/` | ~300 |

---

## Changelog

| Date | Version | Changes |
|------|---------|---------|
| Jan 1, 2026 | 1.0 | Initial comprehensive audit post-fixes |

---

## Conclusion

EarnGrid demonstrates strong security engineering with:
- ✅ All critical/high/medium issues fixed
- ✅ Comprehensive role-based access control
- ✅ Timelock protection for risk changes
- ✅ Safe strategy interaction patterns
- ✅ Good test coverage (24 tests)

**The protocol is ready for mainnet deployment pending professional audit.**

---

*This audit was performed by an AI assistant. While thorough, it should be supplemented by professional human auditors before managing significant user funds.*
