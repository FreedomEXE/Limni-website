# Flagship Manual Trading System — Implementation Reference

## Overview
The Flagship page is a dedicated manual trading decision board that surfaces actionable setups for discretionary execution. It aggregates multiple data pipelines into a single view, providing multi-timeframe strength analysis, sentiment positioning, and options market structure.

## Signal Chain Architecture
```
BIAS (Weekly COT tiered)
  → SESSION FILTER (Asia / London / New York)
    → OVERLAYS (asset-specific)
      → Crypto: liquidation gate (CoinAnk) + strength
      → FX: currency strength + sentiment
      → Commodities: strength + sentiment
      → Missing overlay data → explicit NO_DATA state (not silent PASS)
```

## Data Pipeline Phases

### Phase 1: FX Currency Strength (COMPLETE)
- **Module:** `src/lib/currencyStrength.ts`
- **Migration:** `migrations/017_currency_strength_snapshots.sql`
- **Cron:** `src/app/api/cron/currency-strength/route.ts` (hourly)
- **Read API:** `src/app/api/flagship/currency-strength/route.ts`
- **Panel:** Currency Strength in `FlagshipBoard.tsx`

**What it does:**
Computes strength for 8 major currencies (EUR, USD, GBP, JPY, AUD, NZD, CAD, CHF) by averaging each currency's signed percentage change across all 7 cross-pairs it appears in (28 total FX pairs). Normalized to 0-100 within the group.

**Data source:** OANDA H1 candles via `fetchOandaCandleSeries`
**Windows:** 1h, 4h, 24h
**Cache:** 5-minute in-memory TTL

### Phase 2: Daily Sentiment Lock (COMPLETE)
- **Module:** `src/lib/sentiment/daily.ts`
- **Migration:** `migrations/018_sentiment_daily_snapshots.sql`
- **Cron:** `src/app/api/cron/sentiment-daily-lock/route.ts` (hourly or every 4h)
- **Read API:** `src/app/api/flagship/sentiment-daily/route.ts`
- **Panel:** Daily Sentiment Lock in `FlagshipBoard.tsx`

**What it does:**
Locks a daily sentiment snapshot from the aggregated sentiment system. Captures long/short percentages, net positioning, confidence score, crowding state, flip state, and sentiment direction per symbol.

**Data source:** Internal sentiment aggregation engine
**Frequency:** Configurable (recommended hourly or every 4h lock snapshots)

### Phase 3: Crypto & Commodity Strength Meters (SHIPPED)
- **Codex prompt:** `docs/bots/codex-prompt-asset-strength-pipeline.md`
- **Module:** `src/lib/assetStrength.ts`
- **Migration:** `migrations/020_asset_strength_snapshots.sql`
- **Cron:** `src/app/api/cron/asset-strength/route.ts` (hourly)
- **Read API:** `src/app/api/flagship/asset-strength/route.ts`
- **Panels:** Crypto Strength + Commodity Strength in `FlagshipBoard.tsx`

**What it does:**
Computes strength for crypto assets (BTC, ETH) and commodities (XAU/Gold, XAG/Silver, WTI/Oil) as separate meters. Each asset's strength = percentage change vs USD over the window, normalized to 0-100 within its asset class.

**Data source:** OANDA H1 candles (same as FX strength)
**Windows:** 1h, 4h, 24h
**Methodology:** Unlike FX (which averages across 7 cross-pairs), crypto/commodity assets only have one USD pair each, so the USD return IS the strength. Normalization makes assets within a class comparable.

### Phase 4: MenthorQ Overlay DB-First Runtime (SHIPPED, PENDING MIGRATION)
- **Codex prompt:** `docs/bots/codex-prompt-menthorq-overlay-pipeline.md`
- **Module:** `src/lib/menthorqOverlay.ts`
- **Migration:** `migrations/021_menthorq_overlay_snapshots.sql` (run required)
- **Cron:** `src/app/api/cron/menthorq-overlay-import/route.ts` (recommended hourly or every 4h)
- **Read API:** `src/app/api/flagship/menthorq-overlay/route.ts`
- **Runtime integration:** `src/app/api/performance/gated-setups/route.ts` now resolves MenthorQ context DB -> CSV -> NO_DATA
- **Panel:** MenthorQ Overlay Coverage in `FlagshipBoard.tsx`

**What it does:**
Imports browser-captured MenthorQ rows into DB, then uses DB as primary overlay source at runtime. CSV remains fallback. Missing/stale coverage now resolves to explicit `NO_DATA` instead of silent pass-through.

## Infrastructure

### Database Tables
| Table | Migration | Purpose |
|-------|-----------|---------|
| `currency_strength_snapshots` | 017 | FX strength (8 currencies × 3 windows) |
| `sentiment_daily_snapshots` | 018 | Daily sentiment locks per symbol |
| `asset_strength_snapshots` | 020 | Crypto + commodity strength |
| `menthorq_overlay_snapshots` | 021 | MenthorQ daily overlay snapshots |

### Cron Schedule (Render)
| Endpoint | Frequency | Est. Duration |
|----------|-----------|---------------|
| `/api/cron/currency-strength` | Hourly | ~10s |
| `/api/cron/sentiment-daily-lock` | Hourly or every 4h | ~5s |
| `/api/cron/asset-strength` | Hourly | ~5s |
| `/api/cron/menthorq-overlay-import` | Hourly or every 4h | ~5s |

### API Endpoints
| Route | Method | Returns |
|-------|--------|---------|
| `/api/flagship/currency-strength` | GET | Latest FX strength (all windows) |
| `/api/flagship/currency-strength?currency=USD&window=1h&hoursBack=24` | GET | Historical FX strength |
| `/api/flagship/sentiment-daily` | GET | Latest sentiment locks |
| `/api/flagship/asset-strength` | GET | Latest crypto + commodity strength |
| `/api/flagship/asset-strength?class=crypto` | GET | Latest crypto strength only |
| `/api/flagship/asset-strength?asset=BTC&window=1h&hoursBack=24` | GET | Historical asset strength |
| `/api/flagship/menthorq-overlay` | GET | Latest MenthorQ overlay snapshot |
| `/api/flagship/menthorq-overlay?date=YYYY-MM-DD` | GET | Overlay snapshot by date |
| `/api/flagship/menthorq-overlay?symbol=6E&daysBack=14` | GET | Overlay symbol history |

### Data Sources
| Source | Used For | Auth |
|--------|----------|------|
| OANDA REST API | FX + Crypto + Commodity H1 candles | API key (`OANDA_API_KEY`) |
| Internal Sentiment Engine | Daily sentiment locks | N/A |
| CoinAnk API | Crypto liquidation gate (existing) | API seed |
| MenthorQ account data | FX/metals/index options context (GEX/levels where available) | Account login |

### Flagship Panel Order (top to bottom)
1. Currency Strength (FX — 8 majors)
2. Crypto Strength (BTC, ETH)
3. Commodity Strength (XAU, XAG, WTI)
4. Daily Sentiment Lock
5. MenthorQ Overlay Coverage

### Key Technical Notes

**PostgreSQL reserved word:** The column `window` must always be double-quoted (`"window"`) in all SQL — it's a PostgreSQL reserved word.

**Timezone bug pattern:** When chaining two queries where the first fetches a `snapshot_time_utc` and the second filters by it, always pass the raw Date object from pg to the second query. Converting to ISO string first can introduce timezone offset errors because pg returns `TIMESTAMP WITHOUT TIMEZONE` as a local-offset Date.

**OANDA instrument mappings:** All pairs map automatically via `getOandaInstrument()` in `oandaPrices.ts`:
- FX: `EURUSD → EUR_USD`, etc.
- Crypto: `BTCUSD → BTC_USD`, `ETHUSD → ETH_USD`
- Commodities: `XAUUSD → XAU_USD`, `XAGUSD → XAG_USD`, `WTIUSD → WTICO_USD`

**Polling:** All Flagship panels poll their API every 60 seconds with `cache: "no-store"`.

## Codex Prompts Index
| Phase | Prompt File | Status |
|-------|-------------|--------|
| 1 | `codex-prompt-currency-strength-pipeline.md` | Shipped |
| 2 | `codex-prompt-daily-sentiment-decoupling.md` | Shipped |
| 3 | `codex-prompt-asset-strength-pipeline.md` | Shipped |
| 4 | `codex-prompt-menthorq-overlay-pipeline.md` | Shipped (pending migration 021) |
| UI | `codex-prompt-flagship-ui.md` | Shipped |
| UI Fix | `codex-prompt-flagship-ui-fix.md` | Shipped |

## De-prioritized: Deribit GEX
- **Prompt:** `codex-prompt-deribit-gex-pipeline.md` (written but de-prioritized)
- **Reason:** Deribit GEX is crypto-only and largely overlaps with the existing CoinAnk liquidation gate, which already captures forced-flow risk for BTC/ETH. The real gap is FX/metals/index options structure (true GEX), where MenthorQ coverage is currently more relevant.
- **Current crypto overlay:** CoinAnk liquidation heatmaps (already in production via `src/lib/coinank.ts`)
- **Decision:** Keep crypto on liquidation gate as primary. Deribit GEX remains available as an optional secondary crypto overlay if needed later.

## Future Phases (Not Yet Scoped)
- Real-time 1-minute currency/asset strength trigger
- Index strength meter (SPX, NDX, Nikkei)
- FX/metals/index GEX (requires paid options data source — CME or equivalent)
- Intra-week COT refresh overlay
- Session-level ranking and top-pick selection
- Explicit `NO_GEX` / `NO_DATA` gate state for non-crypto assets (not silent PASS)
