# Correlation Heatmap — Implementation Spec

> Status: PLANNED
> Author: Freedom + Claude (CTO)
> Date: 2026-02-27

---

## Overview

Add a correlation heatmap to Limni showing pairwise correlation between all traded instruments. Two contexts:

1. **Crypto** — BTC, ETH, and alt pairs (used by Bitget bot for handshake decisions). Lives in the crypto bot section.
2. **FX / Indices / Commodities** — All 36 pairs from the Universal/Tiered/Katarakti systems. Lives alongside the MT5 Forex Basket EA page.

Both use the same underlying component, just with different data sources and symbol sets.

---

## Data Source

### Option A: Myfxbook API (FX only)

We have myfxbook auth integrated (`src/lib/sentiment/providers/myfxbook.ts`). Their correlation page shows FX pair correlations at multiple timeframes. However:
- No known public API endpoint for correlation data (only community outlook/sentiment)
- Would need to scrape the web page or find an undocumented endpoint
- FX only — no crypto, indices, or commodities

### Option B: Self-Computed (Recommended)

Calculate correlation from our own 1h candle data already in the DB.

**Method**: Rolling Pearson correlation on 1h log-returns over a configurable lookback window.

**Advantages**:
- Covers ALL 36 pairs + crypto (any symbol with candle data)
- No external dependency
- Fresh every week (or even daily)
- Lookback window is tunable (1 week, 2 weeks, 4 weeks)
- Serves double duty: website display AND Katarakti handshake engine

**Computation**:
```
For each pair of symbols (A, B):
  1. Align 1h candles by timestamp (inner join)
  2. Compute log returns: r = ln(close_t / close_t-1)
  3. Pearson correlation: corr(r_A, r_B) over lookback window
  4. Store as correlation_matrix row: (symbol_a, symbol_b, timeframe, lookback, correlation, computed_at)
```

**Refresh schedule**: Weekly (Sunday pre-market) via cron job. Optionally daily for more responsive data.

---

## Database

### New table: `correlation_matrix`

```sql
CREATE TABLE IF NOT EXISTS correlation_matrix (
  id              SERIAL PRIMARY KEY,
  symbol_a        VARCHAR(20) NOT NULL,
  symbol_b        VARCHAR(20) NOT NULL,
  lookback_hours  INTEGER NOT NULL,         -- e.g. 672 = 4 weeks of 1h bars
  correlation     DECIMAL(6,4) NOT NULL,    -- -1.0000 to +1.0000
  sample_size     INTEGER NOT NULL,         -- number of aligned candles used
  computed_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (symbol_a, symbol_b, lookback_hours, computed_at)
);

CREATE INDEX idx_corr_matrix_computed ON correlation_matrix (computed_at DESC);
CREATE INDEX idx_corr_matrix_symbols ON correlation_matrix (symbol_a, symbol_b);
```

### API route: `GET /api/correlation/matrix`

**Query params:**
- `symbols` — comma-separated list (or `all` for full matrix)
- `lookback` — hours (default: 672 = 4 weeks)
- `context` — `crypto` | `fx` | `all` (filters symbol set)

**Response:**
```json
{
  "computedAt": "2026-02-23T00:00:00Z",
  "lookbackHours": 672,
  "symbols": ["EURUSD", "GBPUSD", "AUDUSD", ...],
  "matrix": [
    { "a": "EURUSD", "b": "GBPUSD", "correlation": 0.8234 },
    { "a": "EURUSD", "b": "USDCHF", "correlation": -0.9112 },
    ...
  ]
}
```

### Cron route: `POST /api/cron/correlation-refresh`

Triggered weekly (or daily). Computes fresh correlation matrix and inserts into DB.

---

## Frontend Component

### `CorrelationHeatmap.tsx`

**Reuses the same pattern as existing heatmaps** (PairHeatmap, SentimentHeatmap, BiasHeatmap) but with a matrix layout instead of a list.

**Layout**: NxN grid where:
- Rows and columns = symbols
- Cell color = correlation strength
  - Deep green: +0.80 to +1.00 (strong positive)
  - Light green: +0.50 to +0.80
  - Gray: -0.50 to +0.50 (uncorrelated)
  - Light red: -0.80 to -0.50
  - Deep red: -1.00 to -0.80 (strong negative)
- Diagonal = 1.00 (self-correlation, grayed out)

**Interactions**:
- Hover: show exact correlation value + symbol pair
- Click: open detail modal showing correlation over time (if we store historical snapshots)
- Filter: toggle symbol groups (FX majors, FX crosses, indices, commodities, crypto)
- Sort: cluster by correlation strength (put highly correlated pairs adjacent)

**Two instances of the same component:**

1. **Crypto context** (`/automation/bots/bitget` or a new subtab):
   - Symbols: BTC, ETH, + alt pairs from alt screener
   - Lookback: 7 days (168 hours) — crypto moves fast
   - Purpose: Visualize handshake correlation for the Bitget bot

2. **FX/Multi-asset context** (`/automation/bots/mt5-forex` or research section):
   - Symbols: All 36 pairs
   - Lookback: 4 weeks (672 hours)
   - Purpose: Visualize Katarakti handshake clusters + general market structure

### Reusable Pieces from Existing Components

| Existing Component | What to Reuse |
|-------------------|---------------|
| `PairSignalSurface.tsx` | Filter bar, view toggle, responsive grid pattern |
| `PairHeatmap.tsx` | Color scale logic, cell rendering pattern |
| `SentimentHeatmap.tsx` | Modal drill-down pattern (show detail on click) |
| `bitget-bot/MarketDataTab.tsx` | TimeSeriesChart for correlation-over-time in modal |
| `bitget-bot/types.ts` | Formatter utilities (toNumber, formatCompactUsd) |

---

## Implementation Order

1. **Lib**: `src/lib/correlation.ts` — Pearson computation from 1h candles
2. **Migration**: Create `correlation_matrix` table
3. **Cron**: `/api/cron/correlation-refresh` — weekly computation
4. **API**: `/api/correlation/matrix` — serve latest matrix
5. **Component**: `CorrelationHeatmap.tsx` — matrix grid with color scale
6. **Crypto page**: Add as tab in Bitget bot dashboard (AltScreenerTab replacement or addition)
7. **FX page**: Add to new MT5 Forex Basket EA page (see separate doc)

---

## Myfxbook Heatmap Display (Optional Enhancement)

Even though we compute our own correlations, we can still display myfxbook's correlation view as a reference/comparison:
- Embed or link to myfxbook's correlation page for FX pairs
- Show our computed values alongside for comparison
- Useful for validation: if our numbers differ significantly from myfxbook, investigate data quality
