# MT5 Forex Basket EA — Website Page Spec

> Status: PLANNED
> Author: Freedom + Claude (CTO)
> Date: 2026-02-27

---

## Overview

New page at `/automation/bots/mt5-forex` to monitor the MT5 Forex Basket EA (Katarakti + Universal/Tiered systems). Mirrors the structure of the existing Bitget crypto perp bot page at `/automation/bots/bitget`, reusing the same component patterns and tab system.

---

## Route

```
/automation/bots/mt5-forex
```

### Navigation

Add to the bots landing page (`/automation/bots`) as a new card alongside the existing Bitget bot card.

| Card | Route | Status |
|------|-------|--------|
| Crypto Perp Bot (Bitget) | `/automation/bots/bitget` | Existing |
| **MT5 Forex Basket EA** | `/automation/bots/mt5-forex` | **New** |

---

## Page Structure

Reuse `BitgetBotTabs.tsx` pattern — URL-driven tab system with `?tab=` params.

### Tabs

| Tab | Key | Description | Reuses From |
|-----|-----|-------------|-------------|
| **Live State** | `state` | Current week's bias directions, active positions, session ranges | `LiveStateTab.tsx` pattern |
| **Trade History** | `trades` | Past trades with filters (symbol, direction, exit reason, system) | `TradeHistoryTab.tsx` pattern |
| **Signal Log** | `signals` | Sweep signals detected, which triggered entries, which were filtered | `SignalLogTab.tsx` pattern |
| **Correlation** | `correlation` | Correlation heatmap for all 36 pairs | `CorrelationHeatmap.tsx` (new) |
| **Performance** | `performance` | Weekly/monthly PnL, comparison vs basket baseline | New — but chart patterns from `MarketDataTab.tsx` |

---

## Tab Details

### 1. Live State Tab

**Header card**: System status (running/idle/error), current week dates, account equity

**Bias grid** (36 pairs):
- Symbol name
- Direction: LONG / SHORT / NEUTRAL (color-coded)
- Bias source: which system determined direction (Universal V1, Tiered V1, etc.)
- Tier level (T1/T2/T3 for Tiered systems)
- Sweep status: NO_SIGNAL / SIGNAL_DETECTED / POSITION_OPEN / CLOSED

**Active positions** (if Katarakti is live):
- Symbol, direction, entry price, current price, unrealized PnL
- SL level, trail status (inactive/active/triggered)
- Entry time, session window that triggered

**Session ranges** (current day):
- Asia range high/low
- NY range high/low
- Active entry window indicator

**Components to reuse**:
- Status badges from `bitget-bot/types.ts` (`resolveLifecycleTone`)
- Grid/card layout from `LiveStateTab.tsx`
- Color coding from `PairHeatmap.tsx` (LONG=green, SHORT=red, NEUTRAL=gray)

### 2. Trade History Tab

Same pattern as `TradeHistoryTab.tsx`:
- Table with columns: Symbol, Direction, Entry Price, Exit Price, PnL, Entry Time, Exit Time, Exit Reason, System
- Filters: symbol dropdown, direction, exit reason (SL/trail/week-close), system (Universal/Tiered/Katarakti)
- Expandable rows showing: ATR at entry, sweep candle details, session reference range, handshake group (Phase 2)
- Export to CSV

### 3. Signal Log Tab

Same pattern as `SignalLogTab.tsx`:
- Table of all sweep signals detected during each week
- Columns: Timestamp, Symbol, Direction, Sweep %, Displacement %, Entry Window, Triggered Entry (Y/N), Reason if Filtered
- Filter reasons: direction mismatch, position cap reached, handshake not met (Phase 2)

### 4. Correlation Tab

Embeds the `CorrelationHeatmap.tsx` component (from `CORRELATION_HEATMAP_IMPLEMENTATION.md`):
- Full 36x36 matrix
- Filter by symbol group (FX majors, crosses, indices, commodities)
- Cluster view showing correlation groups for Katarakti handshake
- Toggle lookback period (1 week, 2 weeks, 4 weeks)

### 5. Performance Tab

Weekly and monthly performance tracking:
- **Weekly summary table**: Week, Trades, Win Rate, PnL ($), PnL (%), Max DD
- **Cumulative equity curve**: Line chart (reuse TimeSeriesChart SVG pattern from MarketDataTab)
- **Comparison overlay**: Katarakti PnL line vs Universal V1 basket line vs Tiered V1 basket line over same period
- **Per-system breakdown**: If running multiple bias systems, show each independently

---

## Data Sources

### Existing (already in DB)
- `performance_snapshots` — weekly bias directions per pair per model
- `mt5_accounts` — account equity, lot map
- `mt5_weekly_plans` — frozen lot sizing
- 1h candle data for all 36 pairs
- `correlation_matrix` (new, from correlation cron)

### New Tables Needed

```sql
-- Katarakti trade log (similar structure to bitget_bot_trades)
CREATE TABLE IF NOT EXISTS katarakti_trades (
  id              SERIAL PRIMARY KEY,
  week_anchor     DATE NOT NULL,
  symbol          VARCHAR(20) NOT NULL,
  direction       VARCHAR(10) NOT NULL,  -- LONG/SHORT
  bias_system     VARCHAR(20) NOT NULL,  -- universal_v1, tiered_v1, etc.
  bias_tier       VARCHAR(10),           -- T1/T2/T3/NEUTRAL
  entry_price     DECIMAL(20,8) NOT NULL,
  exit_price      DECIMAL(20,8),
  entry_time      TIMESTAMPTZ NOT NULL,
  exit_time       TIMESTAMPTZ,
  exit_reason     VARCHAR(20),           -- sl/trail/week_close
  pnl_usd        DECIMAL(12,2),
  pnl_pct        DECIMAL(8,4),
  atr_at_entry   DECIMAL(20,8),
  sl_price       DECIMAL(20,8),
  trail_active   BOOLEAN DEFAULT FALSE,
  session_window VARCHAR(20),            -- asia_to_ny / ny_to_asia
  sweep_pct      DECIMAL(8,4),
  handshake_group_id INTEGER,            -- Phase 2
  metadata       JSONB DEFAULT '{}',
  created_at     TIMESTAMPTZ DEFAULT NOW()
);

-- Katarakti signal log (similar to bitget_bot_signals)
CREATE TABLE IF NOT EXISTS katarakti_signals (
  id              SERIAL PRIMARY KEY,
  week_anchor     DATE NOT NULL,
  symbol          VARCHAR(20) NOT NULL,
  direction       VARCHAR(10) NOT NULL,
  signal_time     TIMESTAMPTZ NOT NULL,
  session_window  VARCHAR(20),
  ref_high        DECIMAL(20,8),
  ref_low         DECIMAL(20,8),
  sweep_price     DECIMAL(20,8),
  sweep_pct       DECIMAL(8,4),
  displacement_pct DECIMAL(8,4),
  triggered_entry BOOLEAN DEFAULT FALSE,
  filter_reason   VARCHAR(50),           -- null if entered, otherwise: direction_mismatch, cap_reached, etc.
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### New API Routes

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/katarakti/status` | GET | Live state: active positions, today's session ranges, bias grid |
| `/api/katarakti/trades` | GET | Trade history with filters |
| `/api/katarakti/signals` | GET | Signal log with filters |
| `/api/correlation/matrix` | GET | Correlation matrix (shared with crypto) |

---

## File Structure

```
src/app/automation/bots/mt5-forex/
  page.tsx                  — Main page (server component, data fetching)
  loading.tsx               — Loading skeleton

src/components/mt5-forex/
  Mt5ForexTabs.tsx          — Tab switcher (reuse BitgetBotTabs pattern)
  LiveStateTab.tsx          — Bias grid + active positions + session ranges
  TradeHistoryTab.tsx       — Trade table with filters
  SignalLogTab.tsx          — Signal table with filters
  CorrelationTab.tsx        — Wrapper around CorrelationHeatmap
  PerformanceTab.tsx        — Equity curve + comparison charts
  types.ts                  — TypeScript types + formatters

src/components/
  CorrelationHeatmap.tsx    — Shared correlation matrix component (used by both crypto + FX)

src/lib/
  kataraktiDashboard.ts     — Dashboard data aggregator (like bitgetBotDashboard.ts)
  correlation.ts            — Pearson correlation computation

src/app/api/katarakti/
  status/route.ts
  trades/route.ts
  signals/route.ts

src/app/api/correlation/
  matrix/route.ts

src/app/api/cron/
  correlation-refresh/route.ts
```

---

## Implementation Order

1. **Database**: Migration for `katarakti_trades`, `katarakti_signals`, `correlation_matrix` tables
2. **Lib**: `correlation.ts` (Pearson computation) + `kataraktiDashboard.ts` (data aggregator)
3. **Cron**: Correlation refresh cron
4. **API**: Status, trades, signals, correlation matrix endpoints
5. **Components**: Shared `CorrelationHeatmap.tsx`, then MT5-specific tabs
6. **Page**: Wire up `/automation/bots/mt5-forex` with tab system
7. **Bots landing**: Add MT5 Forex card to `/automation/bots`
8. **Crypto integration**: Add correlation tab to Bitget bot dashboard

---

## Notes

- Page is **read-only monitoring** — no trade execution controls (same as Bitget bot page)
- Initially will show backtest data. Once Katarakti goes live, switches to live data seamlessly
- The bots landing page at `/automation/bots` should show both bot cards with status indicators (online/offline/dry-run)
