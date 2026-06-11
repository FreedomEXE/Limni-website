/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/

# Limni Trade ID System — Design Specification

> **STATUS: PENDING CODEX REVIEW AND IMPLEMENTATION**
> Codex needs to review this design, validate the schema, and implement Phases 2-4 (scanner trade_id column, strategy integration, advanced analytics). The indicator (Phase 1) is already implemented in PineScript.

## Purpose

A universal, human-readable trade identification system that:
- Uniquely identifies every trade across all Limni systems
- Encodes strategy, asset class, direction, pair, date, and sequence in the ID itself
- Works for the PineScript indicator, the scanner/matrix, and future backend systems
- Supports clustering trades into weekly baskets for equity curves and research
- Is modular enough to accommodate new strategies without schema changes

## ID Format

```
{STRATEGY}-{ASSET}-{DIR}-{PAIR}-{DATE}-{SEQ}
```

### Example

```
IADR-FX-S-XAUUSD-260326-001
```

Reads as: "Indicator ADR, Forex, Short, XAUUSD, 2026-03-26, trade #1"

---

## Field Definitions

### 1. Strategy Code (2-6 chars)

| Code | System | Notes |
|------|--------|-------|
| `IADR` | ADR Indicator (PineScript) | Resets weekly with new pairs |
| `SADR` | ADR Scanner (Limni Matrix) | Hourly cron, H1 bars |
| `T3NG` | Tiered V3 Net Gated | Flagship weekly hold |
| `T3NH` | Tiered V3 Net Hedged | Hedged variant |
| `U1N` | Universal V1 Net | Legacy baseline |
| `U1G` | Universal V1 Gated | Gated variant |

**Convention**: First letter = source (I=Indicator, S=Scanner/Server, T=Tiered, U=Universal). Followed by version and variant abbreviation.

### 2. Asset Class (2 chars)

| Code | Class |
|------|-------|
| `FX` | Forex |
| `CM` | Commodities (Gold, Silver, Oil) |
| `IX` | Indices (SPX, NDX, Nikkei) |
| `CR` | Crypto (BTC, ETH) |
| `CA` | Crypto Altcoins |

**Why not single letters**: `C` is ambiguous (Commodities? Crypto?). Two chars is unambiguous and still compact.

### 3. Direction (1 char)

| Code | Direction |
|------|-----------|
| `L` | Long |
| `S` | Short |
| `N` | Neutral (for tracking/observation only) |

### 4. Pair (canonical symbol, variable length)

Use the canonical pair name as-is: `XAUUSD`, `EURUSD`, `SPX500`, `BTCUSD`, `JPN225`.

**Why not abbreviate to 2 chars**: `AU` for AUDUSD is ambiguous (AUDNZD? AUDCAD?). Using the full canonical symbol avoids lookup tables and is self-documenting. The ID is slightly longer but unambiguous.

### 5. Date (6 digits: YYMMDD)

`260326` = 2026-03-26. This is the **trade entry date**, not the week open.

For weekly systems, all trades in a basket share the same week but have different entry dates. The date field ties to the actual entry, not the basket period.

### 6. Sequence (3 digits, zero-padded)

`001`, `002`, etc. Resets per pair per day. Handles Fresh Start re-entries within a week.

---

## Full Examples

```
IADR-FX-S-XAUUSD-260326-001    → Indicator ADR, Forex, Short Gold, Mar 26, trade 1
SADR-CM-S-XAUUSD-260324-001    → Scanner ADR, Commodity, Short Gold, Mar 24, trade 1
SADR-CM-S-XAUUSD-260325-002    → Scanner ADR, re-entry after TP, Mar 25, trade 2
T3NG-FX-L-EURUSD-260324-001    → Tiered V3 Net Gated, Long EURUSD, week of Mar 24
```

---

## Basket / Cluster Grouping

Trades can be grouped by:
- **Week basket**: `SADR-*-*-*-2603*` (all scanner ADR trades for week of March)
- **Strategy**: `T3NG-*` (all Tiered V3 Net Gated)
- **Pair**: `*-*-*-EURUSD-*` (all EURUSD trades across systems)
- **Asset class**: `*-FX-*` (all forex)

The ID structure supports regex/wildcard filtering naturally.

---

## Implementation Phases

### Phase 1: Indicator (NOW — cosmetic only)
- Generate IDs in PineScript for trade labels and tooltips
- Format: `IADR-{ASSET}-{DIR}-{PAIR}-{DATE}-{SEQ}`
- Week resets clear the sequence counter
- No backend storage — purely visual

### Phase 2: Scanner/Matrix (with Codex)
- Add `trade_id` column to `strategy_backtest_trades` table
- Scanner generates IDs matching the indicator format: `SADR-...`
- Matrix UI displays trade IDs
- API returns trade IDs for cross-reference

### Phase 3: All Strategies (with Codex)
- Extend to T3NG, U1N, U1G variants
- Each backtest run generates canonical trade IDs
- Research section queries by ID patterns
- Equity curves filterable by strategy/asset/pair

### Phase 4: Advanced (future)
- Per-ID metadata: exact entry/exit timestamps, MAE, MFE, R-multiple
- Basket clustering for weekly PnL attribution
- Bubble maps powered by ID-grouped data
- Cross-strategy correlation analysis

---

## Backend Schema (Phase 2+)

```sql
ALTER TABLE strategy_backtest_trades
  ADD COLUMN trade_id TEXT UNIQUE;

-- Index for pattern queries
CREATE INDEX idx_trades_trade_id ON strategy_backtest_trades (trade_id);
```

Each trade ID is unique globally. The `metadata` JSONB column already stores per-trade details (entry, TP, DD, anchor). The trade_id becomes the canonical key for lookup and cross-referencing.

---

## Open Questions

1. **Should direction be in the ID?** If a pair flips direction mid-week (unlikely in current system), the direction is baked into the ID. Current answer: yes, include it — direction is a defining characteristic of the trade.

2. **Date = entry date vs week open?** Using entry date is more precise and handles multi-day baskets. Week open can be derived from the date.

3. **Sequence scope**: per-pair-per-day or per-pair-per-week? Per-day is cleaner (never exceeds single digits for ADR Fresh Start). Per-week would need higher numbers for active pairs.

---

*Designed by Freedom_EXE. Formalized by Nyx.*
