/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: docs/MT5_PRICE_FEED_INTEGRATION.md
 *
 * Description:
 * Plan for integrating Bitget TradFi (MT5) as a second canonical
 * price source alongside Oanda, enabling dual-source verification
 * across the full 36-pair universe.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

# MT5 Price Feed Integration — Bitget TradFi

## Purpose

Add Bitget TradFi (MT5) as a second independent price source for the canonical price layer.

This enables:

- dual-source verification for all 36 pairs (FX, indices, commodities, crypto)
- tick-level data for future intraday research
- independent audit trail separate from Oanda
- cross-provider delta analysis (detect feed discrepancies)

## Why MT5, Not Bitget REST API

Bitget's TradFi product (FX, indices, commodities, equity CFDs) runs entirely through MetaTrader 5. There is no public REST API for TradFi candle data. The Bitget REST API (`/api/v2/mix/market/*`) only covers crypto futures/spot.

Bitget REST API does have limited non-crypto coverage:

| Asset | REST Symbol | Available |
|-------|-------------|-----------|
| Gold | XAUUSDT | Yes |
| Silver | XAGUSDT | Yes |
| Copper | COPPERUSDT | Yes |
| S&P 500 | SPXUSDT | Yes |
| BTC/ETH | Already using | Yes |
| 15 equities | AAPL, TSLA, NVDA, etc. | Yes |
| FX pairs | None | No |
| NAS100, Nikkei | None | No |
| WTI Oil | None | No |

For the full 36-pair universe, MT5 is the only path.

## Timing — Bundle With VPS Migration

This work should execute **during or after the MT5 bot refactor + VPS deployment**, not before.

Reasons:

- MT5 terminal must run 24/7 to maintain live price feeds
- VPS instances (Contabo, 3x planned) will already run MT5 for EA execution
- Adding a price ingestion daemon to the same VPS is trivial once the infrastructure exists
- No point running MT5 locally just for price data when VPS migration is already planned

**Add this as a step in the VPS deployment checklist** (see `docs/ea-refactor-progress.md`).

## Architecture

```text
┌─────────────────────────────────────┐
│  Contabo VPS (MT5 running 24/7)     │
│                                     │
│  LimniBasketEA.mq5  (trading)      │
│  price-ingest.py     (price feed)   │
│                                     │
│  MetaTrader5 Python package         │
│  ↓                                  │
│  Pull OHLCV bars for 36 pairs       │
│  ↓                                  │
│  POST to website API or direct DB   │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│  PostgreSQL (Render)                │
│                                     │
│  raw_price_bars                     │
│    provider = 'bitget-mt5'          │
│    provider_symbol = 'EURUSD'       │
│                                     │
│  canonical_price_bars               │
│    source_provider = 'bitget-mt5'   │
│    OR merged with oanda bars        │
└─────────────────────────────────────┘
```

## Integration Method — Python MetaTrader5 Package

MetaQuotes ships an official `MetaTrader5` Python package that connects to a running MT5 terminal on the same Windows machine.

```python
import MetaTrader5 as mt5

mt5.initialize()
mt5.login(account, password="...", server="Bitget-Server")

# Daily bars — last 100 days
rates = mt5.copy_rates_from_pos("EURUSD", mt5.TIMEFRAME_D1, 0, 100)
# Returns: numpy array [time, open, high, low, close, tick_volume, spread, real_volume]

# 5-minute bars — last 1000
rates_5m = mt5.copy_rates_from_pos("EURUSD", mt5.TIMEFRAME_M5, 0, 1000)

# Tick data
ticks = mt5.copy_ticks_from("EURUSD", from_date, 1000, mt5.COPY_TICKS_ALL)
# Returns: time, bid, ask, last, volume, flags
```

### Key Capabilities

- All timeframes: M1, M5, M15, M30, H1, H4, D1, W1, MN1
- Tick-level data with bid/ask spread
- Historical depth depends on Bitget MT5 server retention
- Runs on Windows only (Python + MT5 terminal required)
- Connection to running MT5 instance (same machine)

### Limitations

- MT5 terminal must be running — cannot pull bars headlessly
- Python only (no Node.js SDK)
- Single MT5 terminal can connect to one broker server at a time
- Connection drops require reconnect logic

## What This Unlocks

### Immediate (daily bars)

- Second-source weekly/daily returns for all 36 pairs
- Cross-provider delta report: `|oanda_return - mt5_return|` per pair per week
- Provider-level quality_status flagging in canonical_price_bars

### Future (5m bars + ticks)

- Intraday bar backfill from MT5 for Katarakti research
- Tick-level data for spread analysis, execution modeling, slippage estimation
- True bid/ask data (Oanda mid-price only)

## Existing MT5 Infrastructure to Leverage

| Component | Location | Relevance |
|-----------|----------|-----------|
| EA monolith | `mt5/Experts/LimniBasketEA.mq5` | Already connects to Bitget MT5 server |
| MT5 push API | `src/app/api/mt5/push/route.ts` | Can reuse for price ingestion push |
| MT5 store | `src/lib/mt5Store.ts` | DB integration patterns |
| Contract system | `contracts/mt5_event_contract.json` | Schema generation pattern |
| Heartbeat monitor | `src/lib/mt5/heartbeatMonitor.ts` | Liveness monitoring for price daemon |
| VPS deployment plan | `docs/ea-refactor-progress.md` | Contabo VPS L, 3 instances planned |
| Master refactor plan | `docs/plan.md` | Full architecture context |

## Implementation Sketch

### 1. Python Price Daemon (`mt5/scripts/price-ingest.py`)

- Runs as a background service on VPS alongside EA
- Connects to same MT5 terminal the EA uses
- Scheduled pulls: daily bars every hour, 5m bars every 5 minutes (if enabled)
- Pushes to PostgreSQL via:
  - Direct `psycopg2` connection, OR
  - HTTP POST to a new `/api/prices/ingest` endpoint

### 2. Ingestion Endpoint (if HTTP route)

```typescript
// src/app/api/prices/ingest/route.ts
// Accepts batch of raw bars from MT5 Python daemon
// Auth: same x-mt5-token pattern as existing push endpoint
// Upserts into raw_price_bars with provider = 'bitget-mt5'
```

### 3. Canonical Merge Logic

When both Oanda and Bitget MT5 bars exist for the same symbol/timeframe/bar_open:

- Primary source per asset class remains as defined in `instrument_registry`
- Secondary source stored in `raw_price_bars` for audit
- Cross-provider delta computed during verification
- `canonical_price_bars.quality_status` upgraded to 'dual_verified' when both sources agree within tolerance

### 4. Symbol Mapping

MT5 uses different symbol names than our canonical system:

| Canonical | Oanda Instrument | MT5 Symbol (Bitget) |
|-----------|-----------------|---------------------|
| EURUSD | EUR_USD | EURUSD (likely) |
| XAUUSD | XAU_USD | XAUUSD (likely) |
| BTCUSD | BTC_USD | BTCUSD (likely) |
| SPXUSD | SPX500_USD | US500 (TBD) |
| NDXUSD | NAS100_USD | NAS100 (TBD) |
| NIKKEIUSD | JP225_USD | JP225 (TBD) |
| WTIUSD | WTICO_USD | USOIL (TBD) |

Exact MT5 symbol names need to be confirmed after activating Bitget TradFi account and connecting MT5. Add a `mt5_symbol` column to `instrument_registry` when this work begins.

## Execution Prerequisites

1. Bitget TradFi/CFD account activated (links to existing Bitget account)
2. MT5 terminal installed on VPS
3. MT5 connected to Bitget server with valid credentials
4. Python 3.10+ with `MetaTrader5` package installed on VPS
5. VPS has network access to PostgreSQL (Render)
6. Canonical price layer (migration 022) already deployed

## Execution Order (When Ready)

1. Activate Bitget TradFi account
2. Install MT5 on VPS, connect to Bitget server
3. Confirm available symbols and exact naming (`mt5.symbols_get()`)
4. Add `mt5_symbol` column to `instrument_registry`
5. Build `mt5/scripts/price-ingest.py` daemon
6. Build ingestion endpoint or direct DB writer
7. Backfill daily bars for 36 pairs from MT5 history
8. Run cross-provider verification against Oanda canonical bars
9. Add `quality_status = 'dual_verified'` logic to canonical layer
10. Optionally enable 5m bar ingestion for intraday research

## Scope Boundaries

- This doc covers **price data ingestion only**, not trading execution
- EA trading logic, kill-switch, telemetry are separate workstreams
- This does NOT replace Oanda as primary source — it adds a second source
- Tick data ingestion is optional Phase 2 within this workstream

## Quick Prototype (30 minutes, local machine)

If you want to validate before VPS deployment:

1. Activate Bitget TradFi on your account
2. Install MT5, connect to Bitget server
3. Run:

```python
import MetaTrader5 as mt5
import pandas as pd

mt5.initialize()
# Login with your Bitget MT5 credentials
mt5.login(your_account, password="...", server="Bitget-Server")

# Pull daily EURUSD bars
rates = mt5.copy_rates_from_pos("EURUSD", mt5.TIMEFRAME_D1, 0, 60)
df = pd.DataFrame(rates)
df['time'] = pd.to_datetime(df['time'], unit='s')
df.to_csv("bitget_mt5_eurusd_daily.csv", index=False)
print(df.head(10))

mt5.shutdown()
```

4. Compare CSV against Oanda canonical bars for the same period
5. If deltas are within tolerance, proceed with full integration plan
