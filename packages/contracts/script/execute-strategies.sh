#!/usr/bin/env bash
# =============================================================================
# EarnGrid — Execute Strategies After Timelock
# =============================================================================
# Run this AFTER the 24h timelock expires (~Jun 12 18:00 UTC).
# Source .env.mainnet first or set VAULT, KEY, RPC manually.
# =============================================================================

set -euo pipefail

RPC=https://mainnet.base.org
VAULT=0x047e35f587CF99423A6cF90c02bbD95d16Feb24B
KEY=0x183e5eb6f37912a6bc41f64d1e70f23939a5e64e610af5555f1944acfbc150fa

# — Strategy Addresses ————————————————————————————————————————————
STEK=0xbeeF010f9cb27031ad51e3333f9aF9C6B1228183
SPRK=0x7BfA7C4f149E7415b73bdeDfe609237e29CBF34A
GNLT=0xeE8F4eC5672F09119b96Ab6fB59C27E1b7e44b61

# — Salts (must match schedule step) ————————————————————————————
S1_SALT=0x$(cast keccak "STEAKHOUSE_USDC_001" | sed 's/^0x//')
S2_SALT=0x$(cast keccak "SPARK_USDC_001" | sed 's/^0x//')
S3_SALT=0x$(cast keccak "GAUNTLET_USDC_001" | sed 's/^0x//')

echo "======================================"
echo " EarnGrid — Post-Timelock Execution"
echo "======================================"
echo "Vault: $VAULT"
echo "Date:  $(date -u)"
echo ""

# — Check if timelock has expired ————————————————————————————————
echo "Checking timelock delay..."
DELAY=$(cast call --rpc-url "$RPC" "$VAULT" "timelockDelay()(uint256)")
echo "  Delay: $DELAY seconds ($((DELAY / 3600))h)"
echo "  Timelock expires ~Jun 12 18:00 UTC"
echo ""

# — STEP 1: Execute strategy additions ——————————————————————————
echo "1/5 — Adding Steakhouse USDC (Tier 1, cap 250k USDC)..."
cast send --rpc-url "$RPC" --private-key "$KEY" "$VAULT" \
  "executeAddStrategy(address,uint8,uint256,bool,bytes32)" \
  "$STEK" 1 250000000000 true "$S1_SALT"
echo "  OK"
echo ""

echo "2/5 — Adding Spark USDC Vault (Tier 1, cap 200k USDC)..."
cast send --rpc-url "$RPC" --private-key "$KEY" "$VAULT" \
  "executeAddStrategy(address,uint8,uint256,bool,bytes32)" \
  "$SPRK" 1 200000000000 true "$S2_SALT"
echo "  OK"
echo ""

echo "3/5 — Adding Gauntlet USDC Prime (Tier 1, cap 250k USDC)..."
cast send --rpc-url "$RPC" --private-key "$KEY" "$VAULT" \
  "executeAddStrategy(address,uint8,uint256,bool,bytes32)" \
  "$GNLT" 1 250000000000 true "$S3_SALT"
echo "  OK"
echo ""

# — STEP 2: Set queues ———————————————————————————————————————————
echo "4/5 — Setting deposit queue..."
cast send --rpc-url "$RPC" --private-key "$KEY" "$VAULT" \
  "setDepositQueue(address[])" \
  "[$STEK,$SPRK,$GNLT]"
echo "  OK"
echo ""

echo "5/5 — Setting withdraw queue..."
cast send --rpc-url "$RPC" --private-key "$KEY" "$VAULT" \
  "setWithdrawQueue(address[])" \
  "[$STEK,$SPRK,$GNLT]"
echo "  OK"
echo ""

# — STEP 3: Verify ————————————————————————————————————————————————
echo "======================================"
echo " Verifying onchain state..."
echo "======================================"
echo "Strategies: $(cast call --rpc-url "$RPC" "$VAULT" "getStrategies()(address[])")"
echo "Deposit queue: $(cast call --rpc-url "$RPC" "$VAULT" "getDepositQueue()(address[])")"
echo "Withdraw queue: $(cast call --rpc-url "$RPC" "$VAULT" "getWithdrawQueue()(address[])")"
echo "totalAssets: $(cast call --rpc-url "$RPC" "$VAULT" "totalAssets()(uint256)")"
echo ""

echo "✅ Done! Vault is ready for deposits."
