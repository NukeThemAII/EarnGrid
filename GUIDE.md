# EarnGrid Mainnet Deployment Guide (Base)

This guide shows step-by-step commands to deploy the EarnGrid vault to Base mainnet and bring up the indexer + web UI on Ubuntu.

Assumptions:
- You have a Base mainnet RPC URL.
- You control a funded EOA for deployment and ops.
- Foundry is installed and working.

## 1) Install dependencies

```bash
corepack enable
pnpm install
git submodule update --init --recursive
```

Optional sanity check:

```bash
cd packages/contracts && forge test
```

## 2) Update environment file for deployment

Template files are already created:
- `.env.mainnet`
- `services/indexer/.env`
- `apps/web/.env.local`

Note: these files are gitignored and will not be committed. Create/update them locally.

Edit them with your real values before deploying.

Open `.env.mainnet` and replace the placeholders:

```bash
cat <<'EOF' > .env.mainnet
# RPC
BASE_RPC_URL=https://mainnet.base.org

# Deployer key (hex, 0x prefix ok)
DEPLOYER_KEY=0xYOUR_PRIVATE_KEY

# Role addresses (can be the same EOA for prototype)
VAULT_OWNER=0xYOUR_EOA
VAULT_CURATOR=0xYOUR_EOA
VAULT_ALLOCATOR=0xYOUR_EOA
VAULT_GUARDIAN=0xYOUR_EOA
FEE_RECIPIENT=0xYOUR_EOA

# Optional tuning (defaults in script if omitted)
TIER0_MAX_BPS=8000
TIER1_MAX_BPS=5000
TIER2_MAX_BPS=2000
IDLE_LIQUIDITY_BPS=200
MIN_INITIAL_DEPOSIT=1000000
MAX_DAILY_INCREASE_BPS=200
MIN_HARVEST_INTERVAL=3600
TIMELOCK_DELAY=86400
EOF
```

Load the env:

```bash
set -a
source .env.mainnet
set +a
```

## 3) Deploy the vault on Base mainnet

```bash
forge script packages/contracts/script/DeployBaseMainnet.s.sol:DeployBaseMainnet \
  --rpc-url "$BASE_RPC_URL" \
  --broadcast
```

Record the deployed vault address from the output:

```bash
export VAULT_ADDRESS=0xYOUR_DEPLOYED_VAULT
```

## 4) Allowlist strategies (timelocked)

Pick ERC-4626 strategy addresses on Base mainnet and decide tier + cap.
Caps are in USDC units (6 decimals). Example: 1,000,000 USDC = 1000000000000.

Create a salt:

```bash
export STRATEGY_A=0xSTRATEGY_ADDRESS
export STRATEGY_A_TIER=0
export STRATEGY_A_CAP=1000000000000
export SALT_A=$(cast keccak "STRAT_A")
```

Schedule add:

```bash
cast send --rpc-url "$BASE_RPC_URL" --private-key "$DEPLOYER_KEY" \
  "$VAULT_ADDRESS" \
  "scheduleAddStrategy(address,uint8,uint256,bool,bytes32)" \
  "$STRATEGY_A" "$STRATEGY_A_TIER" "$STRATEGY_A_CAP" true "$SALT_A"
```

Wait the timelock:

```bash
cast call --rpc-url "$BASE_RPC_URL" "$VAULT_ADDRESS" "timelockDelay()(uint256)"
# Wait at least this many seconds before executing.
```

Execute add:

```bash
cast send --rpc-url "$BASE_RPC_URL" --private-key "$DEPLOYER_KEY" \
  "$VAULT_ADDRESS" \
  "executeAddStrategy(address,uint8,uint256,bool,bytes32)" \
  "$STRATEGY_A" "$STRATEGY_A_TIER" "$STRATEGY_A_CAP" true "$SALT_A"
```

Repeat for additional strategies.

## 5) Set deposit and withdraw queues

```bash
cast send --rpc-url "$BASE_RPC_URL" --private-key "$DEPLOYER_KEY" \
  "$VAULT_ADDRESS" \
  "setDepositQueue(address[])" \
  "[0xSTRATEGY_A,0xSTRATEGY_B]"

cast send --rpc-url "$BASE_RPC_URL" --private-key "$DEPLOYER_KEY" \
  "$VAULT_ADDRESS" \
  "setWithdrawQueue(address[])" \
  "[0xSTRATEGY_A,0xSTRATEGY_B]"
```

## 6) Start the indexer (optional but recommended)

Open `services/indexer/.env` and replace the placeholders:

```bash
cat <<'EOF' > services/indexer/.env
INDEXER_RPC_URL=https://mainnet.base.org
VAULT_ADDRESS=0xYOUR_DEPLOYED_VAULT
DATABASE_URL=sqlite:./indexer.db
START_BLOCK=0
POLL_INTERVAL_MS=10000
SAMPLE_INTERVAL_SEC=3600
FINALITY_BLOCKS=2
MAX_BLOCK_RANGE=2000
RATE_LIMIT_WINDOW_SEC=60
RATE_LIMIT_MAX=120
PORT=3001
EOF
```

Run the indexer:

```bash
pnpm -C services/indexer dev
```

## 7) Start the web app

Open `apps/web/.env.local` and replace the placeholders:

```bash
cat <<'EOF' > apps/web/.env.local
NEXT_PUBLIC_CHAIN_ID=8453
NEXT_PUBLIC_RPC_URL=https://mainnet.base.org
NEXT_PUBLIC_INDEXER_URL=http://localhost:3001
NEXT_PUBLIC_VAULT_ADDRESS=0xYOUR_DEPLOYED_VAULT
NEXT_PUBLIC_USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
NEXT_PUBLIC_USDC_DECIMALS=6
EOF
```

Run the app:

```bash
pnpm -C apps/web dev
```

## 8) Quick sanity checks

```bash
cast call --rpc-url "$BASE_RPC_URL" "$VAULT_ADDRESS" "totalAssets()(uint256)"
cast call --rpc-url "$BASE_RPC_URL" "$VAULT_ADDRESS" "getStrategies()(address[])"
cast call --rpc-url "$BASE_RPC_URL" "$VAULT_ADDRESS" "getDepositQueue()(address[])"
cast call --rpc-url "$BASE_RPC_URL" "$VAULT_ADDRESS" "pausedDeposits()(bool)"
```

Notes:
- First deposit must be >= MIN_INITIAL_DEPOSIT (default 1 USDC).
- Withdrawals revert if strategies do not have liquidity.

## 9) Timelock delay changes (optional)

Increasing the timelock delay can be done directly. Decreasing the delay must be scheduled and executed after the current delay:

```bash
export NEW_TIMELOCK_DELAY=43200
export TIMELOCK_SALT=$(cast keccak "TIMELOCK_DELAY")

cast send --rpc-url "$BASE_RPC_URL" --private-key "$DEPLOYER_KEY" \
  "$VAULT_ADDRESS" \
  "scheduleTimelockDelay(uint256,bytes32)" \
  "$NEW_TIMELOCK_DELAY" "$TIMELOCK_SALT"

# Wait at least the current timelock delay, then:
cast send --rpc-url "$BASE_RPC_URL" --private-key "$DEPLOYER_KEY" \
  "$VAULT_ADDRESS" \
  "executeTimelockDelay(uint256,bytes32)" \
  "$NEW_TIMELOCK_DELAY" "$TIMELOCK_SALT"
```
