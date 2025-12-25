```
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║   ███╗   ███╗███████╗████████╗ █████╗ ██╗   ██╗██╗███████╗██╗     ██████╗    ║
║   ████╗ ████║██╔════╝╚══██╔══╝██╔══██╗╚██╗ ██╔╝██║██╔════╝██║     ██╔══██╗   ║
║   ██╔████╔██║█████╗     ██║   ███████║ ╚████╔╝ ██║█████╗  ██║     ██║  ██║   ║
║   ██║╚██╔╝██║██╔══╝     ██║   ██╔══██║  ╚██╔╝  ██║██╔══╝  ██║     ██║  ██║   ║
║   ██║ ╚═╝ ██║███████╗   ██║   ██║  ██║   ██║   ██║███████╗███████╗██████╔╝   ║
║   ╚═╝     ╚═╝╚══════╝   ╚═╝   ╚═╝  ╚═╝   ╚═╝   ╚═╝╚══════╝╚══════╝╚═════╝    ║
║                                                                              ║
║                    🏦 Smart USDC Savings on Base 🏦                          ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

<div align="center">

[![Base](https://img.shields.io/badge/Chain-Base-0052FF?style=for-the-badge&logo=coinbase)](https://base.org)
[![Solidity](https://img.shields.io/badge/Solidity-0.8.24-363636?style=for-the-badge&logo=solidity)](https://soliditylang.org)
[![License](https://img.shields.io/badge/License-MIT-green?style=for-the-badge)](LICENSE)
[![Tests](https://img.shields.io/badge/Tests-24%20Passing-brightgreen?style=for-the-badge)](TESTS.md)

**Earn yield on your USDC. Simple. Secure. Transparent.**

[📖 Docs](#-documentation) • [🚀 Quick Start](#-quick-start) • [🏗️ Architecture](#️-architecture) • [🔒 Security](#-security)

</div>

---

## 🎯 What is MetaYield?

### For Everyone (No Crypto Knowledge Needed)

Think of MetaYield as a **smart savings account** for your digital dollars (USDC):

```
┌─────────────────────────────────────────────────────────────────────┐
│                                                                     │
│   💵 You deposit USDC    ──►    🏦 MetaYield Vault                  │
│                                        │                            │
│   🎫 You get a receipt                 │                            │
│      (vault shares)                    ▼                            │
│                              ┌─────────────────┐                    │
│                              │  Yield Sources  │                    │
│                              │ ┌─────┐ ┌─────┐ │                    │
│                              │ │ 📈  │ │ 📈  │ │                    │
│                              │ └─────┘ └─────┘ │                    │
│                              └────────┬────────┘                    │
│                                       │                             │
│   💰 Your shares grow                 │                             │
│      in value over time    ◄──────────┘                             │
│                                                                     │
│   🏧 Withdraw anytime      ──►    💵 Get more USDC back!            │
│                                                                     │
└─────────────────────────────────────────────────────────────────────┘
```

**Simple breakdown:**
- 📥 **Deposit** → Put in your USDC
- 🎫 **Receive** → Get vault shares (your receipt)
- 📈 **Earn** → Vault invests in safe yield sources
- 💰 **Profit** → Your shares become worth more USDC
- 📤 **Withdraw** → Cash out anytime (when liquidity available)

**The fees:**
- ✅ No deposit fees
- ✅ No withdrawal fees  
- 💡 3% performance fee (only on profits, never your principal)

---

### For DeFi Users

MetaYield is an **ERC-4626 Vault-of-Vaults** that:

| Feature | Description |
|---------|-------------|
| 🔄 **Auto-compounds** | Yield automatically reinvested |
| 📊 **Diversifies** | Spreads across multiple strategies |
| 🛡️ **Risk-managed** | Caps, tiers, and exposure limits |
| ⚡ **Synchronous** | Instant deposits & withdrawals |
| 🔐 **Non-custodial** | Your keys, your coins |

**Target APY:** 7-10% (market-dependent)

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- pnpm

### Installation

```bash
# Clone the repo
git clone https://github.com/NukeThemAII/MetaYield.git
cd MetaYield

# Install dependencies
pnpm install

# Initialize submodules (OpenZeppelin, Forge)
git submodule update --init --recursive
```

### Run Everything

```bash
# 🧪 Run contract tests
pnpm -C packages/contracts test

# 📡 Start the indexer (data API)
pnpm -C services/indexer dev

# 🌐 Start the web app
pnpm -C apps/web dev
```

### Environment Setup

<details>
<summary>📱 Web App (.env)</summary>

```env
NEXT_PUBLIC_CHAIN_ID=8453
NEXT_PUBLIC_RPC_URL=https://mainnet.base.org
NEXT_PUBLIC_INDEXER_URL=http://localhost:3001
NEXT_PUBLIC_VAULT_ADDRESS=0x...
NEXT_PUBLIC_USDC_ADDRESS=0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913
NEXT_PUBLIC_USDC_DECIMALS=6
```
</details>

<details>
<summary>📊 Indexer (.env)</summary>

```env
INDEXER_RPC_URL=https://mainnet.base.org
VAULT_ADDRESS=0x...
DATABASE_URL=sqlite:./indexer.db
START_BLOCK=0
POLL_INTERVAL_MS=10000
SAMPLE_INTERVAL_SEC=3600
FINALITY_BLOCKS=2
MAX_BLOCK_RANGE=2000
RATE_LIMIT_WINDOW_SEC=60
RATE_LIMIT_MAX=120
PORT=3001
```
</details>

---

## 🏗️ Architecture

```
                              ┌──────────────────┐
                              │   👤 User        │
                              │   (Wallet)       │
                              └────────┬─────────┘
                                       │
                    ┌──────────────────┴───────────────────┐
                    │                                       │
                    ▼                                       ▼
         ┌──────────────────┐                    ┌──────────────────┐
         │  🌐 Frontend     │                    │  📡 Indexer      │
         │  (Next.js)       │◄──── REST ────────│  (Node.js)       │
         │  apps/web        │                    │  services/indexer│
         └────────┬─────────┘                    └────────┬─────────┘
                  │                                        │
                  │ wagmi/viem                            │ viem
                  ▼                                        ▼
         ┌─────────────────────────────────────────────────────────┐
         │                      ⛓️ Base Network                     │
         │  ┌─────────────────────────────────────────────────┐    │
         │  │                🏦 BlendedVault                   │    │
         │  │                (ERC-4626)                        │    │
         │  │                                                  │    │
         │  │   ┌─────────┐  ┌─────────┐  ┌─────────┐         │    │
         │  │   │Strategy │  │Strategy │  │Strategy │  ...    │    │
         │  │   │   A     │  │   B     │  │   C     │         │    │
         │  │   │(Tier 0) │  │(Tier 1) │  │(Tier 2) │         │    │
         │  │   └─────────┘  └─────────┘  └─────────┘         │    │
         │  └─────────────────────────────────────────────────┘    │
         └─────────────────────────────────────────────────────────┘
```

### 📦 Monorepo Structure

```
MetaYield/
├── 📁 apps/
│   └── web/              # Next.js frontend
├── 📁 packages/
│   ├── contracts/        # Solidity (Foundry)
│   └── sdk/              # TypeScript SDK (viem)
├── 📁 services/
│   └── indexer/          # Data API
├── 📁 docs/              # Architecture, threat model
└── 📁 infra/             # Docker, deployment
```

---

## 🔐 Smart Contract Details

### BlendedVault.sol

The core vault implements ERC-4626 with these features:

| Feature | Description |
|---------|-------------|
| **Strategy Allowlist** | Only whitelisted strategies can receive funds |
| **Caps** | Maximum allocation per strategy |
| **Tiers** | Risk classification (0=safest, 2=riskiest) |
| **Tier Limits** | Max exposure per risk tier |
| **Queues** | Priority ordering for deposits/withdrawals |
| **Timelock** | 24h+ delay for risky changes |

### 👥 Roles

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   👑 Owner  │     │  🎨 Curator │     │  🤖 Allocator│    │  🛡️ Guardian │
├─────────────┤     ├─────────────┤     ├─────────────┤     ├─────────────┤
│ • Set fees  │     │ • Add/remove│     │ • Set queues│     │ • Pause     │
│ • Grant     │     │   strategies│     │ • Rebalance │     │ • Emergency │
│   roles     │     │ • Set caps  │     │ • Harvest   │     │   remove    │
│ • Full      │     │ • Set tiers │     │             │     │             │
│   admin     │     │             │     │             │     │             │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

### 💰 Fee Structure

```
┌────────────────────────────────────────────────────────────────┐
│                    Performance Fee: 3%                          │
├────────────────────────────────────────────────────────────────┤
│                                                                 │
│   High Water Mark System:                                       │
│   ═══════════════════════                                       │
│                                                                 │
│   Share Price: $1.00 ──► $1.10 ──► $1.05 ──► $1.15             │
│                              │           │       │              │
│                              │           │       │              │
│   Fee Charged:           3% on $0.10    None   3% on $0.05     │
│                           profit        (loss)   (new profit)  │
│                                                                 │
│   ✅ Fees only on NEW profits above previous high              │
│   ✅ Never charged on losses or principal                      │
│                                                                 │
└────────────────────────────────────────────────────────────────┘
```

---

## 📡 API Reference

The indexer provides these endpoints:

| Endpoint | Description | Example Response |
|----------|-------------|------------------|
| `GET /api/health` | Health check | `{ "ok": true }` |
| `GET /api/tvl` | Current TVL & share price | `{ "totalAssets": "1000000", "assetsPerShare": "1.05" }` |
| `GET /api/apy` | 7d/30d realized APY | `{ "apy7d": 0.08, "apy30d": 0.07 }` |
| `GET /api/allocations` | Per-strategy breakdown | `[{ "strategy": "0x...", "assets": "500000" }]` |
| `GET /api/price-history` | Historical share prices | `[{ "timestamp": 123, "assetsPerShare": "1.05" }]` |

---

## 🔒 Security

### ✅ Implemented Protections

| Protection | Description |
|------------|-------------|
| 🔒 **Reentrancy Guard** | All external calls protected |
| ⏰ **Timelock** | 24h delay on risky changes |
| 🚨 **Pause Controls** | Guardian can halt operations |
| 📊 **Harvest Guard** | Max daily share price increase |
| 💵 **Min Initial Deposit** | Prevents first-depositor attack |
| 🏷️ **Caps & Tiers** | Limits exposure per strategy |

### 📋 Audits

| Audit | Status | File |
|-------|--------|------|
| Antigravity (AI) | ✅ Complete | [AUDIT.md](AUDIT.md), [AUDITnew.md](AUDITnew.md) |
| Gemini (AI) | ✅ Complete | [AUDITg.md](AUDITg.md) |
| Professional | ⏳ Pending | Required before mainnet |

### ⚠️ Known Risks

- Underlying strategy risks (MetaMorpho vaults)
- Smart contract risk (unaudited by professionals)
- Liquidity risk (withdrawals can revert if strategies illiquid)

---

## 📖 Documentation

| Document | Description |
|----------|-------------|
| [📐 ARCHITECTURE.md](docs/ARCHITECTURE.md) | System design & flows |
| [🛡️ THREAT_MODEL.md](docs/THREAT_MODEL.md) | Security analysis |
| [📊 STRATEGY_UNIVERSE.md](docs/STRATEGY_UNIVERSE.md) | Strategy research |
| [📘 RUNBOOK.md](docs/RUNBOOK.md) | Operations guide |
| [✅ TODO.md](TODO.md) | Development roadmap |
| [🧪 TESTS.md](TESTS.md) | Test instructions |

---

## 🛠️ Development

### Test Commands

```bash
# Run all contract tests
pnpm -C packages/contracts test

# Run with verbosity
pnpm -C packages/contracts test -vvv

# Run specific test
pnpm -C packages/contracts test --match-test testHarvestMintsFeeShares
```

### Build Commands

```bash
# Build contracts
pnpm -C packages/contracts build

# Build SDK
pnpm -C packages/sdk build

# Build web app
pnpm -C apps/web build
```

---

## 🗺️ Roadmap

- [x] **v0.1** - Core vault, tests, UI scaffold
- [ ] **v0.2** - Testnet deployment with real strategies
- [ ] **v0.3** - Professional audit
- [ ] **v1.0** - Mainnet launch with multisig

---

## ⚠️ Disclaimer

```
╔══════════════════════════════════════════════════════════════════════════════╗
║                                                                              ║
║   ⚠️  EXPERIMENTAL SOFTWARE - USE AT YOUR OWN RISK  ⚠️                        ║
║                                                                              ║
║   This code is unaudited by professional security firms.                     ║
║   Do NOT deposit funds you cannot afford to lose.                            ║
║   Not intended for mainnet use until professionally audited.                 ║
║                                                                              ║
╚══════════════════════════════════════════════════════════════════════════════╝
```

---

<div align="center">

**Built with 💙 on Base**

[GitHub](https://github.com/NukeThemAII/MetaYield) • [Report Bug](https://github.com/NukeThemAII/MetaYield/issues)

</div>
