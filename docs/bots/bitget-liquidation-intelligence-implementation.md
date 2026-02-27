# Bitget Bot v2 - Liquidation Intelligence Implementation Plan

> Owner: Freedom_EXE  
> Status: Design Spec (not active in live logic)  
> Last updated: 2026-02-27

---

## 1. Goal

Design a production-safe path to use liquidation structure for:

1. Better entry filtering (skip/wait when liquidation risk is against trade direction).
2. Better scaling triggers (replace fixed % milestones with cluster-based milestones).
3. Better exit/trailing behavior (tighten or relax based on nearby opposing liquidation density).

This is a research-first project. No live entry gating should be enabled until backtest + paper validation is complete.

---

## 2. Current State vs Target State

### Current State (as of 2026-02-27)

- `market_liquidation_snapshots` stores hourly summary fields from recent liquidation orders.
- Data is useful for intraday context, but not enough for forward swing path modeling.
- Existing summary is mostly "what was liquidated recently" (short horizon).
- Bot scaling logic is fixed at static milestones (1/2/3/4%).

### Target State

- Persist full forward-looking liquidation map snapshots (price ladder + estimated density).
- Store multi-interval and multi-exchange aggregate structure for BTC/ETH.
- Build derived features for backtest:
  - Directional fuel in trade direction.
  - Opposing squeeze risk near entry.
  - Cluster-driven milestone candidates.
- Compare against current fixed-milestone baseline before activating anything in live logic.

---

## 3. Data We Need to Persist

### 3.1 Snapshot Coverage

For each symbol (`BTC`, `ETH`):

- Intervals: `6h`, `1d`, `7d`, `30d` (or closest supported values).
- Exchange groups:
  - `binance_bybit` (default aggregate)
  - optional single-exchange snapshots for diagnostics.

### 3.2 Snapshot Payload

Each snapshot should include:

1. Raw price ladder nodes:
   - `price_level`
   - `estimated_liquidations_usd`
   - `distance_pct_from_current`
2. Derived directional bands:
   - `±2%`, `±5%`, `±10%`, `±15%`, `±25%`
   - cumulative + incremental values per band
3. Aggregate side density:
   - long liquidation density below current price
   - short liquidation density above current price
4. Top key levels (ranked nodes) per side.

Store both raw and derived values. Derived values can change with formulas; raw values let us reprocess later.

---

## 4. Proposed Storage Model

Add a dedicated table for heatmap snapshots (separate from current summary table):

`market_liquidation_heatmap_snapshots`

Suggested columns:

- `id BIGSERIAL PRIMARY KEY`
- `symbol TEXT NOT NULL`
- `interval TEXT NOT NULL`
- `exchange_group TEXT NOT NULL`
- `current_price NUMERIC NOT NULL`
- `as_of_utc TIMESTAMPTZ NOT NULL`
- `nodes_json JSONB NOT NULL` (full ladder points)
- `bands_json JSONB NOT NULL` (2/5/10/15/25 bands)
- `key_levels_json JSONB NOT NULL` (top levels)
- `aggregate_json JSONB NOT NULL` (totals/ratios)
- `source TEXT NOT NULL DEFAULT 'coinank'`
- `created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`

Indexes:

- `(symbol, as_of_utc DESC)`
- `(symbol, interval, exchange_group, as_of_utc DESC)`
- optional uniqueness guard at hourly granularity if desired.

Keep existing `market_liquidation_snapshots` unchanged for backward compatibility with dashboards/tools.

---

## 5. Collection Cadence and Cost Control

Goal is strong history without excessive API use.

Recommended cadence:

1. `1d` interval: every 15 minutes.
2. `6h` interval: every 15 minutes.
3. `7d` interval: hourly.
4. `30d` interval: every 4 hours.

Add cache + dedupe:

- Skip insert if node-hash unchanged from previous snapshot for same `(symbol, interval, exchange_group)`.
- Keep in-memory short TTL cache for repeated same-request calls.

This gives rich signal history while limiting redundant API hits.

---

## 6. Feature Engineering for Strategy Decisions

For each candidate trade, compute features at entry time:

1. **Directional Fuel**
   - LONG trade fuel: short liquidation density above entry (upside squeeze fuel).
   - SHORT trade fuel: long liquidation density below entry (downside squeeze fuel).

2. **Opposing Risk**
   - LONG opposing risk: long liquidation density below entry (downside flush risk).
   - SHORT opposing risk: short liquidation density above entry (upside squeeze risk).

3. **Fuel/Risk Ratio**
   - `fuel_risk_ratio = directional_fuel / max(opposing_risk, 1)`.

4. **Near-Field Risk (0-2%)**
   - Opposing side density close to entry.
   - Used for skip/wait filter.

5. **Path Density to Target**
   - Density between entry and intended target corridor.
   - Used to select scaling milestones.

---

## 7. Dynamic Milestone Logic (Candidate)

Current ladder is static. Proposed ladder is cluster-driven.

### 7.1 Candidate Selection

For trade direction, select clusters between `entry` and `target`:

- Filter by minimum notional threshold.
- Merge clusters within `0.5%` distance.
- Rank by weighted score:
  - size (USD notional)
  - proximity (closer clusters trigger earlier milestones)
  - local density (node neighborhood strength)

Take top 3 milestones:

- Milestone A -> leverage tier 10x
- Milestone B -> leverage tier 25x
- Milestone C -> leverage tier 50x

### 7.2 Confirmation Rule (anti-fakeout)

Do not scale on touch only.

Require:

- candle close beyond cluster level and
- displacement confirmation (same as existing signal style).

### 7.3 Fallback

If valid clusters are missing or stale:

- revert to fixed 1/2/3/4% milestones.

---

## 8. Entry Skip/Wait Filter (Candidate)

This addresses: "if we are short but aggregate short liquidation risk is heavier, maybe skip/wait."

Example rule:

- SHORT setup:
  - compute `short_squeeze_risk_0_2pct` (short liq density above entry within +2%)
  - compute `downside_fuel_0_2pct` (long liq density below entry within -2%)
  - if `short_squeeze_risk_0_2pct > downside_fuel_0_2pct * threshold`, then:
    - skip trade, or
    - wait for confirmation candle / better entry.

Mirror for LONG setup.

This should start as a paper-only flag, not hard live gate.

---

## 9. Backtest Design

### 9.1 Experiments

Run side-by-side with same historical trade universe:

1. Baseline: fixed milestones (current production logic).
2. Variant A: dynamic milestones only.
3. Variant B: dynamic milestones + entry skip/wait filter.
4. Variant C: dynamic milestones + adaptive trailing based on opposing cluster density.

### 9.2 Evaluation Metrics

- Net return
- Max drawdown
- MAR / Calmar
- Win rate
- Avg R multiple
- Avg adverse excursion (MAE)
- Avg favorable excursion (MFE)
- % trades skipped and resulting opportunity cost

### 9.3 Minimum Data Window

Do not decide based on a 1-2 week sample.

Minimum:

- 8-12 weeks snapshot history for first cut
- 20+ weeks preferred for decision-quality confidence.

---

## 10. Rollout Plan

### Phase 0 - Data Infrastructure

- Add heatmap snapshot table.
- Add collector jobs for intervals/exchange groups.
- Add QA checks for coverage gaps and stale rows.

### Phase 1 - Feature Store

- Build reusable feature extraction at arbitrary timestamp.
- Attach feature vector to each simulated/live trade entry.

### Phase 2 - Research Harness

- Implement backtest variants and reporting for liquidation-driven logic.
- Compare baseline vs variants with identical trade opportunities.

### Phase 3 - Paper Trading

- Run in DRY_RUN shadow mode only.
- Log "would scale/would skip/would tighten" decisions beside live baseline decisions.

### Phase 4 - Controlled Activation

- Enable on small capital with kill switch.
- Start with dynamic milestones only; keep entry skip as alert mode first.

---

## 11. Failure Modes and Safeguards

1. Missing/partial API data:
   - fallback to fixed ladder.
2. Sudden cluster reshaping:
   - freeze milestones after entry unless update rule explicitly allows refresh.
3. Overfitting:
   - keep out-of-sample period and holdout weeks.
4. Latency/staleness:
   - reject stale snapshots beyond max age.
5. Extreme event gaps:
   - hard risk limits still override cluster logic.

---

## 12. Deliverables Checklist

1. Schema migration for heatmap snapshot table.
2. Collector integration in market snapshot cron flow.
3. Feature extraction module for entry-time liquidation intelligence.
4. Backtest script variants for dynamic scaling and skip/wait filters.
5. Research report comparing baseline vs liquidation-aware variants.
6. Paper-mode telemetry fields in bot state/logs.

---

## 13. Immediate Next Step

Before changing live behavior:

1. Finish data capture coverage first.
2. Let history accumulate.
3. Run structured backtest with identical trade set.
4. Only then decide whether liquidation logic should gate entries, scaling, exits, or all three.

This keeps the strategy evolution evidence-driven instead of intuition-driven.

---

## 14. Execution Artifacts

- Migration draft: `migrations/009_liquidation_heatmap_snapshots.sql`
- File-level rollout checklist: `docs/bots/bitget-liquidation-intelligence-checklist.md`
- Backtest scaffold: `scripts/bitget-v2-liquidation-backtest-stub.ts`
