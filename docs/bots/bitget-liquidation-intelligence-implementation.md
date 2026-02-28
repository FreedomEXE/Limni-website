# Bitget Bot v2 - Liquidation Intelligence Implementation Plan

> Owner: Freedom_EXE  
> Status: Design Spec (not active in live logic)  
> Last updated: 2026-02-28

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

### 6.1 Normalization (Required for Robust Thresholds)

Avoid raw USD thresholds as primary decision inputs. Raw values drift with regime and symbol.

Use normalized features at entry:

- `fuel_0_5pct_usd`: directional liquidation fuel between `0%` and `5%` in trade direction.
- `fuel_5_10pct_usd`: directional liquidation fuel between `5%` and `10%` in trade direction.
- `oi_at_entry_usd`: open interest snapshot at entry.
- `fuel_0_5_oi = fuel_0_5pct_usd / max(oi_at_entry_usd, 1)`
- `fuel_5_10_oi = fuel_5_10pct_usd / max(oi_at_entry_usd, 1)`
- `wave_ratio = fuel_5_10_oi / max(fuel_0_5_oi, epsilon)` (second-wave strength vs first-wave strength).

Add context normalization using rolling baseline:

- `fuel_0_5_regime_ratio = fuel_0_5_oi / median(fuel_0_5_oi, lookback=30d)`
- `wave_ratio_regime = wave_ratio / median(wave_ratio, lookback=30d)`

This keeps the logic comparable across BTC/ETH and across volatility/liquidity regimes.

### 6.2 Confidence Scoring (Prefer Over Hard Labels)

Use a confidence score first, then map to mode (`SCALP` / `DAY` / `SWING`), instead of hard if/else from one threshold pair.

Suggested score components:

1. Multi-timeframe agreement score (how many TFs show strong directional fuel).
2. Weekly second-wave score (`wave_ratio` and `fuel_5_10_oi` strength).
3. Near-field opposing-risk penalty (`0-2%` opposing density).
4. Data quality penalty (stale/missing snapshots).

Then map score bands:

- high confidence -> `SWING`
- medium confidence -> `DAY`
- low confidence -> `SCALP`

Keep mapping values configurable; do not hardcode in strategy logic.

### 6.3 Momentum Gate for Extension Legs

Even with strong weekly second-wave structure, do not assume extension to `-10%` without live momentum confirmation.

For extension legs (for example beyond `-5%` target zone), require continuation gate:

- displacement/close confirmation beyond local structure,
- no immediate opposing squeeze dominance in near-field,
- optional short-horizon trend check (for example 15m/1h continuation).

If gate fails, force conservative exit behavior (flatten extension leg, keep core rules intact).

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

Implementation note:

- evaluate skip/wait primarily on normalized features (`*_oi`, regime ratios), not absolute USD alone.

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

Calibration note (as of 2026-02-28):

- Current liquidation summary history is only `2026-02-26` to `2026-02-27`.
- Current heatmap history is only `2026-02-27`.
- Any thresholds used before minimum window is reached must be marked `provisional`.

### 9.4 Provisional Threshold Policy

Before minimum data window is reached:

1. Keep thresholds in config (not code constants embedded in strategy flow).
2. Tag every liquidation-mode decision with threshold version.
3. Store raw feature vector + normalized vector in trade metadata.
4. Refit thresholds only on scheduled cadence (for example weekly), not ad hoc per trade.

### 9.5 Config Schema (v0.1, Provisional)

Define liquidation logic via runtime config so values can be tuned without rewriting core strategy flow.

| Key | Type | Default | Purpose |
|---|---|---|---|
| `LIQ_INTEL_ENABLED` | boolean | `false` | Master switch for liquidation intelligence logic. |
| `LIQ_INTEL_EXECUTION_MODE` | enum(`off`,`paper`,`live`) | `paper` | `paper` logs decisions only; `live` can affect execution. |
| `LIQ_INTEL_PROVISIONAL` | boolean | `true` | Marks thresholds as provisional until minimum history is reached. |
| `LIQ_INTEL_THRESHOLD_VERSION` | string | `liq_v0_1_provisional` | Version tag written to every decision/trade record. |
| `LIQ_INTEL_MIN_HISTORY_WEEKS` | number | `8` | Minimum snapshot history required before non-provisional promotion. |
| `LIQ_INTEL_REFIT_CADENCE_DAYS` | number | `7` | Scheduled threshold recalibration cadence. |
| `LIQ_INTEL_TFS` | csv | `6h,1d,7d,30d` | Timeframes used for classification (must exist in snapshot store). |
| `LIQ_INTEL_NEARFIELD_BAND_PCT` | number | `2` | Near-field opposing-risk band width. |
| `LIQ_INTEL_WAVE1_END_PCT` | number | `5` | End of first directional wave. |
| `LIQ_INTEL_WAVE2_END_PCT` | number | `10` | End of second directional wave. |
| `LIQ_INTEL_SCORE_SWING_MIN` | number | `0.70` | Minimum confidence score for `SWING`. |
| `LIQ_INTEL_SCORE_DAY_MIN` | number | `0.45` | Minimum confidence score for `DAY`; below becomes `SCALP`. |
| `LIQ_INTEL_MOMENTUM_GATE_ENABLED` | boolean | `true` | Requires continuation confirmation before extension-leg hold. |
| `LIQ_INTEL_MOMENTUM_GATE_MIN_DISPLACEMENT_PCT` | number | `0.25` | Minimum close/displacement confirmation for extension. |
| `LIQ_INTEL_SKIPWAIT_RISK_MULT` | number | `1.20` | Skip/wait trigger multiplier when opposing near-field risk dominates. |

Implementation guardrails:

1. Unknown/missing config values should fallback to defaults and emit warnings.
2. Invalid numeric ranges should hard-fail startup in `live` mode and soft-fail in `paper` mode.
3. Changes to any threshold key should auto-bump effective decision fingerprint in logs.

### 9.6 Trade Metadata Fields (Required for Evaluation)

Persist these per entry decision (paper + live) for later calibration:

- `liquidation_mode`: `SCALP` / `DAY` / `SWING`
- `liquidation_confidence_score`: normalized score `[0,1]`
- `liquidation_threshold_version`: config version string
- `liq_fuel_0_5_usd`, `liq_fuel_5_10_usd`
- `liq_fuel_0_5_oi`, `liq_fuel_5_10_oi`
- `liq_wave_ratio`
- `liq_nearfield_opposing_0_2_oi`
- `liq_mtf_agreement_score`
- `liq_momentum_gate_passed` (boolean)
- `liq_decision_reason` (short machine-readable reason code)

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
