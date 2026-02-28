# TrenchBot Execution Upgrade — Implementation Spec

> **Status:** Draft for Codex review
> **Author:** Claude (CTO) — February 2026
> **Scope:** Regime-gated live execution for Solana meme token bot

---

## 1. Overview

Upgrade the Freedom TrenchBot from a monitoring/alerting system to a live-execution meme token trading bot. Three workstreams:

1. **Regime Gate** — Weekly bias filter (COT + sentiment) + Solana on-chain volume health check
2. **Execution Engine** — Wallet management, Jupiter V6 swaps, Jito MEV protection
3. **Limni Dashboard Upgrade** — Real P&L, wallet balance, deposit/withdraw UI

### Go-Forward Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Limni Platform (Next.js)                                   │
│  ├── /api/trenchbot/regime   → Weekly bias + volume gate    │
│  ├── /api/trenchbot/wallet   → Wallet balance / deposit UI  │
│  ├── /automation/solana-meme-bot (dashboard)                │
│  └── PostgreSQL (regime, wallet metadata, trade log)        │
└───────────────────────┬─────────────────────────────────────┘
                        │ HTTP (regime check, trade logging)
                        │
┌───────────────────────▼─────────────────────────────────────┐
│  TrenchBot (Python — Render worker)                         │
│  ├── Scanner (existing) — DexScreener discovery + filters   │
│  ├── Regime Client (new) — Checks Limni API before arming   │
│  ├── Wallet Manager (new) — Keypair gen, encrypt, balance   │
│  ├── Executor (new) — Jupiter V6 + Jito bundle submission   │
│  ├── Trade Logger (new) — Writes to Limni PostgreSQL        │
│  └── SQLite (existing) — Token state, pair pool, metrics    │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Workstream A — Regime Gate

### 2.1 Decision Chain

The bot must pass ALL three gates to be armed for new entries:

```
Gate 1: Weekly Bias (COT + Sentiment)
  └── BTC or ETH bias = LONG → PASS
  └── Both NEUTRAL or SHORT → BLOCK

Gate 2: Market Regime (existing market-regime.ts)
  └── Regime = "hot" or "neutral" → PASS
  └── Regime = "cold" → BLOCK

Gate 3: Solana DEX Volume Health
  └── 24h Solana DEX volume ≥ $1.5B → PASS
  └── 24h Solana DEX volume < $1.5B → BLOCK

All three PASS → Bot ARMED (accepts new entries)
Any BLOCK → Bot DORMANT (no new entries, existing positions still managed)
```

### 2.2 Weekly Bias Source

Reuse the existing COT + sentiment bias already computed for Katarakti crypto:
- Limni exposes `/api/trenchbot/regime` endpoint
- Returns `{ armed: boolean, bias: "LONG"|"SHORT"|"NEUTRAL", regime: "hot"|"neutral"|"cold", solDexVolume24h: number }`
- TrenchBot polls this endpoint every scan cycle (20s) — cached for 5 minutes

### 2.3 Solana Volume Source

Two options (in preference order):
1. **DeFiLlama API** — `GET https://api.llama.fi/overview/dexs/solana` → 24h volume
2. **Birdeye API** — Aggregated Solana DEX volume (requires API key)

Threshold: **$1.5B** daily DEX volume. Configurable via `SOLANA_VOLUME_FLOOR_USD` env var.

### 2.4 Limni API Endpoint

```
GET /api/trenchbot/regime

Response:
{
  "armed": true,
  "gates": {
    "weekly_bias": { "pass": true, "direction": "LONG", "source": "cot+sentiment" },
    "market_regime": { "pass": true, "label": "hot", "score": 3 },
    "solana_volume": { "pass": true, "volume_24h_usd": 2_800_000_000, "floor_usd": 1_500_000_000 }
  },
  "checked_at": "2026-02-27T14:30:00Z"
}
```

### 2.5 TrenchBot Integration

New module: `freedom_trench_bot/regime.py`

```python
class RegimeClient:
    """Polls Limni regime API. Caches for 5 minutes."""

    def __init__(self, api_url: str, api_token: str):
        self.api_url = api_url
        self.api_token = api_token
        self._cache: dict | None = None
        self._cache_at: float = 0

    async def is_armed(self) -> bool:
        """Returns True if all regime gates pass."""
        ...

    async def get_regime(self) -> dict:
        """Returns full regime state for logging/display."""
        ...
```

Scanner integration point — in `scan_once()`, before evaluating new tokens:

```python
# After discovery, before filter evaluation
if not await self.regime_client.is_armed():
    logger.info("Regime gate: DORMANT — skipping new entries")
    # Still update prices, manage existing positions
    return
```

### 2.6 New Env Vars (TrenchBot)

```bash
# Regime gate
LIMNI_REGIME_API_URL=https://limni.app/api/trenchbot/regime
LIMNI_API_TOKEN=<shared secret>
REGIME_CACHE_TTL_SEC=300
SOLANA_VOLUME_FLOOR_USD=1500000000
```

---

## 3. Workstream B — Execution Engine

### 3.1 Wallet Manager

New module: `freedom_trench_bot/wallet.py`

**Keypair Management:**
- Generate Ed25519 keypair using `solders` library
- Encrypt private key at rest with AES-256-GCM
- Master encryption key from env var `WALLET_ENCRYPTION_KEY`
- Store encrypted keypair in SQLite `wallets` table
- One wallet per user (Telegram user ID = wallet owner)

**Wallet Lifecycle:**
```
User sends /start or /wallet → Bot checks if wallet exists
  ├── No wallet → Generate keypair, encrypt, store, return deposit address
  └── Has wallet → Show balance, deposit address

User deposits SOL → Bot detects via RPC polling (every 30s)
  └── Balance updated in local state

User sends /withdraw <amount> <address> → Bot signs + submits transfer
  └── Confirmation sent via Telegram
```

**Database Schema (SQLite):**

```sql
CREATE TABLE IF NOT EXISTS wallets (
  user_id       TEXT PRIMARY KEY,          -- Telegram user ID
  pubkey        TEXT NOT NULL UNIQUE,      -- Solana public key (base58)
  encrypted_key BLOB NOT NULL,            -- AES-256-GCM encrypted secret key
  created_at    REAL NOT NULL,
  label         TEXT
);

CREATE TABLE IF NOT EXISTS live_trades (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       TEXT NOT NULL,
  token_address TEXT NOT NULL,
  pair_address  TEXT,
  direction     TEXT NOT NULL DEFAULT 'BUY',    -- BUY or SELL
  amount_sol    REAL,
  amount_tokens REAL,
  price_usd     REAL,
  tx_signature  TEXT,                           -- Solana transaction signature
  tx_status     TEXT DEFAULT 'pending',         -- pending, confirmed, failed
  tx_slot       INTEGER,
  slippage_pct  REAL,
  priority_fee  REAL,
  jito_tip      REAL,
  created_at    REAL NOT NULL,
  confirmed_at  REAL,
  FOREIGN KEY (user_id) REFERENCES wallets(user_id)
);

CREATE TABLE IF NOT EXISTS positions (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       TEXT NOT NULL,
  token_address TEXT NOT NULL,
  entry_price   REAL NOT NULL,
  entry_amount  REAL NOT NULL,                  -- tokens bought
  entry_cost    REAL NOT NULL,                  -- SOL spent
  entry_tx      TEXT,
  current_price REAL,
  status        TEXT DEFAULT 'open',            -- open, recouped, stopped, moonbag, closed
  recoup_tx     TEXT,
  stop_tx       TEXT,
  moonbag_tokens REAL,
  pnl_sol       REAL,
  created_at    REAL NOT NULL,
  closed_at     REAL,
  UNIQUE(user_id, token_address, created_at)
);
```

### 3.2 Jupiter V6 Swap Engine

New module: `freedom_trench_bot/jupiter.py`

**Swap Flow:**

```
1. Quote:  GET https://lite-api.jup.ag/swap/v1/quote
   ├── inputMint: SOL (So11111111111111111111111111111111111111112)
   ├── outputMint: <token_address>
   ├── amount: <lamports>
   ├── slippageBps: 150 (1.5% default, configurable)
   ├── restrictIntermediateTokens: true (reduce attack surface)
   └── maxAccounts: 54 (Jito bundle limit)

2. Build: POST https://lite-api.jup.ag/swap/v1/swap
   ├── quoteResponse: <from step 1>
   ├── userPublicKey: <wallet pubkey>
   ├── dynamicComputeUnitLimit: true
   ├── dynamicSlippage: true
   └── prioritizationFeeLamports: { jitoTipLamports: <tip> }

3. Sign:  Deserialize transaction, sign with wallet keypair

4. Submit: Via Jito bundle endpoint (see 3.3)
```

**Sell Flow (Recoup / Stop-Loss / Moonbag Sell):**
- Same as above but inputMint = token, outputMint = SOL
- For recoup: sell enough tokens to recover entry cost + fees
- Remaining tokens = moonbag

**Configuration:**

```bash
# Jupiter
JUPITER_API_URL=https://lite-api.jup.ag
SWAP_SLIPPAGE_BPS=150              # 1.5% default
SWAP_MAX_RETRIES=2
SWAP_TIMEOUT_SEC=15

# Position sizing
POSITION_SIZE_SOL=0.05             # SOL per trade (≈$7-10 at current prices)
MAX_OPEN_POSITIONS=10
MAX_POSITION_PCT=5                 # Max % of wallet balance per position
```

### 3.3 Jito MEV Protection

New module: `freedom_trench_bot/jito.py`

**Why Jito:**
- Jito validators process ~80% of Solana blocks
- Bundle submission = atomic execution, no sandwich attacks
- Tip = priority inclusion without public mempool exposure

**Bundle Submission:**

```python
JITO_BUNDLE_URL = "https://mainnet.block-engine.jito.wtf/api/v1/bundles"
JITO_TIP_ACCOUNTS = [
    "96gYZGLnJYVFmbjzopPSU6QiEV5fGqZNyN9nmNhvrZU5",
    "HFqU5x63VTqvQss8hp11i4bPosci3Aq2G9XrZGDj2YFT",
    "Cw8CFyM9FkoMi7K7Crf6HNQqf4uEMzpKw6QNghXLvLkY",
    "ADaUMid9yfUytqMBgopwjb2DTLSokTSzL1zt6iGPaS49",
    "DfXygSm4jCyNCybVYYK6DwvWqjKee8pbDmJGcLWNDXjh",
    "ADuUkR4vqLUMWXxW9gh6D6L8pMSGA58dqn7NbQHia7to",
    "DttWaMuVvTiduZRnguLF7jNxTgiMBZ1hyAumKUiL2KRL",
    "3AVi9Tg9Uo68tJfuvoKvqKNWKkC5wPdSSdeBnizKZ6jT",
]

async def submit_bundle(signed_tx: bytes, tip_lamports: int = 10_000) -> str:
    """
    1. Create tip instruction to random Jito tip account
    2. Bundle user tx + tip tx
    3. Submit to Jito block engine
    4. Poll for confirmation (3 attempts, 2s interval)
    """
```

**Tip Strategy:**
- Default tip: 10,000 lamports (0.00001 SOL ≈ $0.0015)
- Urgent (time-sensitive exits): 50,000-100,000 lamports
- Configurable via `JITO_TIP_LAMPORTS` env var

**Fallback:**
If Jito submission fails twice, fall back to standard RPC `sendTransaction` with priority fee via Helius private endpoint. Never use public RPC for trade transactions.

### 3.4 Trade Execution Flow

```
Token becomes eligible + regime armed + position limits OK
  │
  ├── 1. Check wallet SOL balance ≥ position size + fees
  │
  ├── 2. Jupiter quote (inputMint=SOL, outputMint=token)
  │     └── Validate: slippage within bounds, price impact < 5%
  │
  ├── 3. Jupiter swap instruction
  │     └── Sign with wallet keypair
  │
  ├── 4. Submit via Jito bundle (tip = 10k lamports)
  │     └── Fallback: Helius private RPC
  │
  ├── 5. Confirm transaction (poll getSignatureStatuses)
  │     └── Timeout after 30s → mark as "pending" for retry
  │
  ├── 6. Record in positions table + live_trades table
  │
  └── 7. Send Telegram alert with tx link
        └── "🟢 BOUGHT 1,234,567 $MEME @ $0.00042 | TX: solscan.io/tx/..."

Exit triggers (same as sim, but real execution):
  ├── Recoup (1.3x): Sell entry_cost worth of tokens → remainder = moonbag
  ├── Stop-loss (0.5x): Sell all tokens
  └── Moonbag expiry (4h): Sell moonbag tokens
```

### 3.5 Error Handling & Safety

| Scenario | Action |
|----------|--------|
| Jupiter quote fails | Skip token, retry next scan cycle |
| Transaction simulation fails | Skip, log error, alert admin |
| Jito bundle rejected | Retry once via Helius, then skip |
| Transaction lands but price moved | Accept slippage up to configured max |
| Wallet balance insufficient | Skip new entries, alert user |
| RPC node down | Switch to backup RPC, pause if all down |
| Duplicate buy attempt | Check positions table before executing |
| Bot crash mid-transaction | On restart, reconcile wallet balance vs positions |

**Reconciliation on startup:**
```python
async def reconcile_positions():
    """
    On startup, check wallet token balances against positions table.
    If wallet has tokens not in positions → unknown position (warn admin).
    If positions table has tokens not in wallet → mark as closed.
    """
```

---

## 4. Workstream C — Limni Dashboard Upgrade

### 4.1 Existing Dashboard Sections (Keep)

The current 1045-line dashboard at `/automation/solana-meme-bot` already has:
- Solana pulse (SOL price, meme metrics)
- Run readiness (regime classification)
- Signal funnel, moonbag vault, live feed
- Recoup speed percentiles
- Signals by hour distribution

All of these sections stay — they work with both sim and live data.

### 4.2 New/Modified Sections

#### A. Wallet Card (New — top of dashboard)

```
┌─────────────────────────────────────────────────────────┐
│  WALLET                                                  │
│                                                          │
│  Address: 7xKp...3mWq     [Copy] [View on Solscan]      │
│                                                          │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐               │
│  │ Balance  │  │ In Pos.  │  │ Avail.   │               │
│  │ 2.45 SOL │  │ 0.80 SOL │  │ 1.65 SOL │               │
│  │ $367.50  │  │ $120.00  │  │ $247.50  │               │
│  └──────────┘  └──────────┘  └──────────┘               │
│                                                          │
│  Mode: [● LIVE] / [○ SIM]         Regime: [🟢 ARMED]    │
│                                                          │
│  Deposit: Send SOL to 7xKp...3mWq                       │
│  Withdraw: /withdraw <amount> <address>                  │
└─────────────────────────────────────────────────────────┘
```

#### B. Regime Gate Status (New — replace current "Run Readiness")

```
┌─────────────────────────────────────────────────────────┐
│  REGIME GATES                          Status: ARMED     │
│                                                          │
│  ┌─────────────────────┐ ┌──────────────────────┐       │
│  │ Weekly Bias         │ │ Market Regime         │       │
│  │ 🟢 LONG (BTC+ETH)  │ │ 🟢 HOT (score: +3)   │       │
│  │ Source: COT+Sent.   │ │ SOL +4.2% 24h         │       │
│  └─────────────────────┘ └──────────────────────┘       │
│                                                          │
│  ┌─────────────────────┐ ┌──────────────────────┐       │
│  │ SOL DEX Volume      │ │ Flow Score            │       │
│  │ 🟢 $3.2B / $1.5B   │ │ ── (per-token)        │       │
│  │ 213% of floor       │ │ Applied at entry      │       │
│  └─────────────────────┘ └──────────────────────┘       │
└─────────────────────────────────────────────────────────┘
```

#### C. Live Positions Table (New — replaces sim "Open" section)

```
┌─────────────────────────────────────────────────────────────────────┐
│  LIVE POSITIONS (4 open)                                             │
│                                                                      │
│  Token      Entry     Current   Mult    Status    Age     Action     │
│  ─────────  ────────  ────────  ─────   ────────  ──────  ────────   │
│  $MEME      $0.0004   $0.0006   1.5x   ▲ +50%    12m     [Sell]     │
│  $DOGE2     $0.0120   $0.0095   0.8x   ▼ -20%    45m     [Sell]     │
│  $PUMP      $0.0001   $0.0002   2.0x   ▲ +100%   2h      [Recoup]  │
│  $YOLO      $0.0050   $0.0045   0.9x   ▼ -10%    5m      [Sell]     │
│                                                                      │
│  Total Exposure: 0.80 SOL ($120.00)                                  │
│  Unrealized PnL: +0.12 SOL (+$18.00)                                │
└─────────────────────────────────────────────────────────────────────┘
```

#### D. Trade History (Modified — add real tx data)

```
┌───────────────────────────────────────────────────────────────────────┐
│  TRADE HISTORY                                        [Live] [Sim]    │
│                                                                       │
│  Time       Token    Side   Amount    Price     PnL      TX           │
│  ─────────  ───────  ────   ────────  ────────  ───────  ──────────   │
│  14:32:01   $MEME    BUY    0.05 SOL  $0.0004   —       [Solscan]    │
│  14:28:15   $PUMP    SELL   rec.      $0.0002   +0.03   [Solscan]    │
│  14:15:22   $PUMP    BUY    0.05 SOL  $0.0001   —       [Solscan]    │
│  13:50:10   $OLD     SELL   stop      $0.0010   -0.02   [Solscan]    │
│                                                                       │
│  Today: 8 trades | +0.15 SOL ($22.50) | Win Rate: 62.5%              │
└───────────────────────────────────────────────────────────────────────┘
```

#### E. Execution Metrics (New — below trade history)

```
┌─────────────────────────────────────────────────────────┐
│  EXECUTION QUALITY                                       │
│                                                          │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐           │
│  │ Avg Slip  │  │ Avg Fee   │  │ Jito Rate │           │
│  │ 0.8%      │  │ 0.003 SOL │  │ 94%       │           │
│  │ (target   │  │ per trade │  │ bundle    │           │
│  │  <1.5%)   │  │           │  │ success   │           │
│  └───────────┘  └───────────┘  └───────────┘           │
│                                                          │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐           │
│  │ Tx Speed  │  │ Failed Tx │  │ MEV Saved │           │
│  │ P50: 1.2s │  │ 3/120     │  │ est.      │           │
│  │ P90: 3.8s │  │ (2.5%)    │  │ ~0.1 SOL  │           │
│  └───────────┘  └───────────┘  └───────────┘           │
└─────────────────────────────────────────────────────────┘
```

### 4.3 Data Flow Changes

Currently: Limni reads directly from TrenchBot's SQLite file.

**New approach:**
- TrenchBot writes trade events to Limni PostgreSQL via API
- Wallet balance read from Solana RPC (cached)
- Regime data already in PostgreSQL

**New Limni API Endpoints:**

```
POST /api/trenchbot/trades      — TrenchBot logs trade events
GET  /api/trenchbot/trades      — Dashboard reads trade history
GET  /api/trenchbot/positions   — Dashboard reads open positions
GET  /api/trenchbot/wallet      — Wallet balance + address
GET  /api/trenchbot/regime      — Regime gate status (existing concept)
GET  /api/trenchbot/execution   — Execution quality metrics
```

### 4.4 Database Migration (Limni PostgreSQL)

```sql
-- Migration: trenchbot live execution tables

CREATE TABLE IF NOT EXISTS trenchbot_wallets (
  user_id       TEXT PRIMARY KEY,
  pubkey        TEXT NOT NULL UNIQUE,
  label         TEXT,
  mode          VARCHAR(10) NOT NULL DEFAULT 'sim',  -- 'sim' or 'live'
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS trenchbot_trades (
  id            BIGSERIAL PRIMARY KEY,
  user_id       TEXT NOT NULL,
  token_address TEXT NOT NULL,
  token_name    TEXT,
  token_symbol  TEXT,
  side          VARCHAR(4) NOT NULL,                -- BUY / SELL
  amount_sol    NUMERIC,
  amount_tokens NUMERIC,
  price_usd     NUMERIC,
  tx_signature  TEXT,
  tx_status     VARCHAR(12) DEFAULT 'confirmed',
  slippage_pct  NUMERIC,
  jito_tip_sol  NUMERIC,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_trenchbot_trades_user ON trenchbot_trades (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_trenchbot_trades_token ON trenchbot_trades (token_address);

CREATE TABLE IF NOT EXISTS trenchbot_positions (
  id            BIGSERIAL PRIMARY KEY,
  user_id       TEXT NOT NULL,
  token_address TEXT NOT NULL,
  token_name    TEXT,
  token_symbol  TEXT,
  entry_price   NUMERIC NOT NULL,
  entry_amount  NUMERIC NOT NULL,
  entry_cost_sol NUMERIC NOT NULL,
  entry_tx      TEXT,
  current_price NUMERIC,
  status        VARCHAR(12) DEFAULT 'open',        -- open, recouped, stopped, moonbag, closed
  recoup_tx     TEXT,
  stop_tx       TEXT,
  moonbag_tokens NUMERIC,
  pnl_sol       NUMERIC,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_trenchbot_positions_user ON trenchbot_positions (user_id, status);
CREATE INDEX IF NOT EXISTS idx_trenchbot_positions_open ON trenchbot_positions (status) WHERE status = 'open';
```

---

## 5. Telegram Bot Commands (Updated)

### Existing Commands (Keep)

| Command | Description |
|---------|-------------|
| `/start` | Initialize bot, create wallet if needed |
| `/status` | Bot status, regime state, open positions |
| `/stats` | Performance statistics |
| `/performance` | Detailed P&L breakdown |
| `/filters` | Current filter settings |
| `/pause` / `/resume` | Pause/resume scanning |
| `/mute` / `/unmute` | Mute/unmute alerts |

### New Commands

| Command | Description |
|---------|-------------|
| `/wallet` | Show wallet address, balance, deposit instructions |
| `/withdraw <amount> <address>` | Withdraw SOL to external address |
| `/mode sim` / `/mode live` | Switch between sim and live execution |
| `/positions` | List open positions with current P&L |
| `/sell <token>` | Manual sell of specific position |
| `/limits` | Show position limits and available balance |
| `/regime` | Show current regime gate status |

### Alert Message Format (Live Mode)

**Entry Alert:**
```
🟢 BUY $MEME

Entry: $0.000423
Amount: 1,234,567 tokens
Cost: 0.05 SOL ($7.50)
Target: $0.000550 (1.3x)
Stop: $0.000212 (0.5x)

TX: solscan.io/tx/5Kp...
Wallet: 7xKp...3mWq
```

**Recoup Alert:**
```
✅ RECOUP $MEME — Target Hit!

Entry: $0.000423 → Exit: $0.000550
Recovered: 0.05 SOL + fees
Moonbag: 234,567 tokens (held 4h)
PnL: +0.015 SOL (+$2.25)

TX: solscan.io/tx/8Jm...
```

**Stop-Loss Alert:**
```
🔴 STOP $MEME — Cut Loss

Entry: $0.000423 → Exit: $0.000212
Loss: -0.025 SOL (-$3.75)

TX: solscan.io/tx/2Rq...
```

---

## 6. Security Considerations

### 6.1 Wallet Security

| Measure | Implementation |
|---------|----------------|
| Key encryption at rest | AES-256-GCM, master key in env `WALLET_ENCRYPTION_KEY` |
| No plaintext keys ever | Decrypt only at transaction signing time, then wipe from memory |
| Per-user isolation | Each Telegram user gets own keypair, no shared pool |
| Balance caps | Configurable max via `MAX_WALLET_BALANCE_SOL` (default: 5 SOL) |
| Withdrawal auth | Only wallet owner (Telegram user ID) can withdraw |
| Admin override | Admin can pause all execution via `/pause` |

### 6.2 Execution Safety

| Measure | Implementation |
|---------|----------------|
| Max position size | `MAX_POSITION_PCT` (5% of wallet balance) |
| Max open positions | `MAX_OPEN_POSITIONS` (10) |
| Price impact limit | Reject swaps with >5% price impact |
| Duplicate prevention | Check positions table before every buy |
| Reconciliation | On startup, verify wallet balances match position records |
| Kill switch | `/mode sim` instantly stops all live execution |

### 6.3 Network Safety

| Measure | Implementation |
|---------|----------------|
| Private RPC | Helius dedicated endpoint for all trade transactions |
| No public mempool | All trades via Jito bundles or Helius private submission |
| RPC failover | Primary: Helius → Fallback: Triton → Last resort: public (monitoring only) |
| Rate limiting | Max 5 swaps per minute to avoid detection patterns |

---

## 7. Environment Variables (Complete)

### New TrenchBot Env Vars

```bash
# ── Regime Gate ──────────────────────────────────
LIMNI_REGIME_API_URL=https://limni.app/api/trenchbot/regime
LIMNI_API_TOKEN=<shared secret>
REGIME_CACHE_TTL_SEC=300
SOLANA_VOLUME_FLOOR_USD=1500000000

# ── Wallet ───────────────────────────────────────
WALLET_ENCRYPTION_KEY=<32-byte hex key>
MAX_WALLET_BALANCE_SOL=5
EXECUTION_MODE=sim                # sim or live

# ── Jupiter ──────────────────────────────────────
JUPITER_API_URL=https://lite-api.jup.ag
SWAP_SLIPPAGE_BPS=150
SWAP_MAX_RETRIES=2
SWAP_TIMEOUT_SEC=15
MAX_PRICE_IMPACT_PCT=5

# ── Jito ─────────────────────────────────────────
JITO_BUNDLE_URL=https://mainnet.block-engine.jito.wtf/api/v1/bundles
JITO_TIP_LAMPORTS=10000
JITO_TIP_URGENT_LAMPORTS=50000

# ── Position Sizing ──────────────────────────────
POSITION_SIZE_SOL=0.05
MAX_OPEN_POSITIONS=10
MAX_POSITION_PCT=5

# ── RPC ──────────────────────────────────────────
HELIUS_RPC_URL=https://mainnet.helius-rpc.com/?api-key=<key>
HELIUS_PRIVATE_TX=true
FALLBACK_RPC_URL=https://solana-mainnet.triton.one/<key>

# ── Trade Logging ────────────────────────────────
LIMNI_TRADE_API_URL=https://limni.app/api/trenchbot/trades
```

---

## 8. Implementation Order

### Phase 1: Regime Gate (1-2 days)
- [ ] Build `/api/trenchbot/regime` Limni endpoint
- [ ] Build `regime.py` client in TrenchBot
- [ ] Wire regime check into `scan_once()` loop
- [ ] Add Solana DEX volume fetch (DeFiLlama)
- [ ] Test with sim mode (regime blocks/allows entries)

### Phase 2: Wallet Manager (2-3 days)
- [ ] Build `wallet.py` — keypair generation, encryption, storage
- [ ] Add `wallets` table to SQLite schema
- [ ] Implement `/wallet`, `/withdraw` Telegram commands
- [ ] Add balance polling (Helius RPC, 30s interval)
- [ ] Test on devnet with test SOL

### Phase 3: Execution Engine (3-4 days)
- [ ] Build `jupiter.py` — quote, swap, sign flow
- [ ] Build `jito.py` — bundle submission with tip
- [ ] Integrate into scanner: eligible token → real buy
- [ ] Implement exit logic: recoup, stop-loss, moonbag sell
- [ ] Add `positions` + `live_trades` tables
- [ ] Reconciliation on startup
- [ ] Test on devnet end-to-end

### Phase 4: Limni Dashboard (2-3 days)
- [ ] PostgreSQL migration for trenchbot tables
- [ ] Build API endpoints (trades, positions, wallet, execution metrics)
- [ ] Update dashboard: wallet card, regime gates, live positions
- [ ] Add trade history with tx links
- [ ] Add execution quality metrics

### Phase 5: Production Deploy (1-2 days)
- [ ] Mainnet testing with small balance (0.5 SOL)
- [ ] Monitor execution quality (slippage, tx speed, Jito success rate)
- [ ] Tune parameters (tip amount, slippage, position size)
- [ ] Full deploy

**Total estimated effort: 9-14 days**

---

## 9. Dependencies (Python)

New packages needed in `requirements.txt`:

```
solders>=0.21.0          # Solana keypair, transaction building
solana>=0.34.0           # Solana RPC client
anchorpy>=0.20.0         # Optional: Anchor program interaction
cryptography>=42.0       # AES-256-GCM encryption
base58>=2.1.1            # Solana address encoding
```

---

## 10. Open Questions for Codex Review

1. **Jupiter V6 vs V4**: V6 (lite-api) is newer and faster. Confirm availability and rate limits for our volume.
2. **Jito tip amount**: 10k lamports is conservative. Should we dynamically adjust based on network congestion?
3. **Wallet per user vs single bot wallet**: Spec assumes per-user wallets. If only Freedom is using it initially, a single wallet simplifies Phase 2 significantly. Recommend starting single-wallet, adding multi-user later.
4. **SQLite vs PostgreSQL for positions**: Spec has positions in both SQLite (local speed) and PostgreSQL (dashboard reads). Is dual-write worth the complexity, or should we go PostgreSQL-only?
5. **Token account management**: Buying meme tokens creates Solana token accounts (rent ~0.002 SOL each). Should we auto-close empty token accounts to reclaim rent? This adds complexity but saves SOL over time.
6. **Moonbag stardust tracking**: The sim has a "stardust" concept (10% of moonbag held permanently). Do we want this in live mode, or simplify to just moonbag with expiry?
