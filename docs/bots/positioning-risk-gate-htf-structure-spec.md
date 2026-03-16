# Positioning Risk Gate + HTF Structure Overlay (Re-Evaluation Spec)

> Owner: Freedom_EXE
> Status: Draft Spec (reviewed, amendments applied)
> Last updated: 2026-03-16
> Reviewed by: Claude (CTO) — 2026-03-16
> Review status: Approved with amendments (all incorporated below)

---

## 0. Scope Lock (Important)

This workstream is for **Universal v1 test track only**.

- Target strategy: Universal v1 (basic weekly entry/hold framework).
- Purpose: add cross-asset price-action risk controls to the simplest entry model first.
- Explicitly out of scope: modifying Katarakti logic in this phase.

Katarakti remains unchanged while this layer is validated independently on Universal.

---

## 1. Why This Exists

The current Limni signal stack (COT bias + sentiment + sweep logic) can produce valid directional calls but still enter at structurally dangerous locations. The recent crypto move exposed a gap:

- Liquidation intelligence already computes `fuel_risk_ratio`, `skip_suggested`, and cluster hints.
- The bot stores this as advisory metadata only.
- Execution logic does not yet enforce a hard gate when liquidation structure is hostile.

This spec defines how to turn that advisory into an enforced pre-flight risk gate and adds a higher-timeframe (HTF) structure layer so we avoid trading directly into extremes.

---

## 2. Core Design Principle

Do not execute a signal only because bias is correct in theory.
Execute only when:

1. Positioning structure is not loaded against the trade.
2. Entry is not too close to opposing forced-order clusters.
3. HTF structure does not indicate extreme location against the intended direction.

---

## 3. Unified Entry Flow

`Signal Engine -> Positioning Risk Gate -> HTF Structure Gate -> Execution Decision`

Execution outcomes:

- `PASS`: normal size allowed.
- `REDUCE`: reduced risk (for example 25-50% of baseline).
- `SKIP`: no trade.

---

## 4. Crypto Positioning Risk Gate (All Timeframes)

### 4.1 Required Inputs (already mostly available)

For `BTC` and `ETH`, consume all stored liquidation snapshot intervals:

- `6h`
- `1d`
- `7d`
- `30d`

Metrics per timeframe:

- directional fuel (in-trade-direction liquidation density)
- opposing risk (against-trade-direction density)
- `fuel_risk_ratio`
- near-field opposing density (`0-2%`)
- nearest opposing cluster distance (%)
- nearest opposing cluster notional (USD)
- `cluster_notional_vs_oi` — cluster notional as % of current open interest for the symbol
- `cluster_notional_percentile` — cluster notional ranked against 30-day rolling distribution for symbol/interval
- `data_freshness_hours` — hours since snapshot was captured; used to degrade gate confidence when stale

#### 4.1.1 Data Freshness Rules

| Data source | Max acceptable age | Degradation behavior |
| --- | --- | --- |
| Crypto liquidation heatmap | 4 hours | >4h: widen thresholds by 25%. >8h: gate outputs `PASS` with `stale_data` warning |
| Crypto funding/OI | 2 hours | >2h: flag `stale_funding` but no threshold change |
| COT (FX/Commodities) | 96 hours (report lag) | >96h: widen thresholds by 50%. >168h: gate outputs `PASS` with `stale_data` warning |
| Retail sentiment | 24 hours | >24h: reduce weight in composite score by 50% |

Freshness is checked at gate evaluation time, not at collection time.

### 4.2 Multi-Timeframe Cluster Model

Build a consolidated opposing-cluster score from all intervals:

- keep top opposing clusters per interval
- normalize notional by interval baseline
- weight by distance (closer = higher risk)
- sum weighted scores into `opposing_cluster_score`

This prevents overfitting to one interval and forces full context.

### 4.3 Decision Logic (v1 thresholds, tunable)

> **Amendment (Claude + Freedom review):** Proximity is the PRIMARY gate. Fuel/risk ratio is SECONDARY context. Cluster size uses relative sizing, not hardcoded absolute notional.

#### Priority 1 — Proximity Gate (primary blocker)

`SKIP` if:

- nearest opposing cluster distance `<= 2.0%` AND `cluster_notional_percentile >= 80th` for that symbol/interval
- confirmed on at least 2 intervals

`REDUCE` if:

- nearest opposing cluster distance `<= 3.5%` AND `cluster_notional_percentile >= 60th`
- or near-field opposing density in `0-2%` band exceeds 30-day median for the symbol

#### Priority 2 — Fuel/Risk Ratio (secondary context)

`SKIP` if:

- `fuel_risk_ratio < 0.80` on both `1d` and `7d` (confirms proximity gate or triggers independently)
- `skip_suggested = true` on at least 2 intervals

`REDUCE` if:

- `fuel_risk_ratio` in `[0.80, 1.20)` — structure is unfavorable but not extreme

Otherwise `PASS`.

#### Fallback Constants (bootstrap only)

Until 30-day distribution stats are populated, use these initial fallback constants:

- BTC: cluster notional `>= $3B` at `<= 2%` distance triggers `SKIP`
- ETH: cluster notional `>= $1B` at `<= 2%` distance triggers `SKIP`

These fallbacks are retired once rolling percentile data is available (minimum 30 days of snapshots).

#### Distance Normalization (cross-asset)

All `%` distance thresholds in this section are crypto-specific defaults. When porting to other asset classes (Phase 2+), replace fixed `%` with ATR-relative distances:

- `proximity_threshold = N * ATR(14, entry_timeframe)`
- Crypto default: `N = 0.5` (approximately 2% for BTC at typical volatility)
- FX default: `N = 1.0` (to be calibrated per pair)
- Indices/Commodities default: `N = 0.75` (to be calibrated per symbol)

### 4.4 Failure Mode Protections

#### 4.4.1 Overfiltering / Consecutive Skip Counter

In trending markets, opposing liquidation clusters will persistently stack above/below price. The gate could skip every signal for weeks.

Rules:

- Track `consecutive_skip_count` per symbol per direction.
- If `consecutive_skip_count > 3`: escalate to manual review instead of auto-skipping. Log as `gate_escalation: overfilter_review`.
- On escalation, the operator (Freedom) decides PASS/REDUCE/SKIP manually. The manual decision is logged with `override_reason`.
- Counter resets on any `PASS` or `REDUCE` decision, or on direction change.

#### 4.4.2 Regime Confidence

During ambiguous HTF regime transitions (e.g., weekly range-bound but daily breaking out), the gate should not pretend certainty.

Rules:

- Compute `regime_confidence` as a float `[0.0, 1.0]`.
  - `>= 0.7`: high confidence — gate operates normally.
  - `[0.4, 0.7)`: medium confidence — bias toward `REDUCE` over `PASS`; bias toward `REDUCE` over `SKIP`.
  - `< 0.4`: low confidence — gate outputs `REDUCE` with `regime_uncertain` flag. No `SKIP` or `PASS` allowed.
- Confidence factors: HTF trend alignment across W1/D1/H4, recent regime duration, distance from regime boundaries.

#### 4.4.3 Portfolio Correlation Guard

Assets move together. Gating one asset independently while allowing a correlated asset defeats the purpose.

Rules:

- Maintain rolling 7-day correlation matrix for active symbols (BTC, ETH, and any future additions).
- If the gate `SKIP`s symbol A in direction X, and symbol B has correlation > 0.85 with A:
  - Minimum `REDUCE` on symbol B in the same direction, even if B's own gate would `PASS`.
  - Log as `correlated_downgrade: [symbol_A]`.
- Correlation threshold is configurable (default: `0.85`).

---

## 5. HTF Structure Overlay (New Layer)

### 5.1 Goal

Add a structural location check so the system does not short into downside exhaustion or long into upside exhaustion just because lower-timeframe triggers fired.

### 5.2 Timeframes

- `W1` (primary structure and extreme zones)
- `D1` (trend state and swing location)
- `H4` (execution context)

### 5.3 HTF Context Fields

At entry, calculate/store:

- `regime`: `trend_up | trend_down | range`
- `regime_confidence`: float `[0.0, 1.0]` (see 4.4.2)
- `distance_to_weekly_high_pct`: signed distance from current price to W1 high
- `distance_to_weekly_low_pct`: signed distance from current price to W1 low
- `weekly_range_location`: float `[0.0, 1.0]` where 0.0 = at weekly low, 1.0 = at weekly high
- `displacement_exhaustion`: boolean — true when current impulse exceeds exhaustion threshold
- `nearest_structural_invalidation`: price level where the current HTF thesis breaks

### 5.4 Displacement Exhaustion Formula

```
impulse_distance = abs(current_price - impulse_origin) / impulse_origin
atr_baseline = ATR(14, D1)
atr_pct = atr_baseline / current_price

exhaustion_ratio = impulse_distance / atr_pct
displacement_exhaustion = exhaustion_ratio > 2.0
```

- `impulse_origin`: the swing low (for up-moves) or swing high (for down-moves) that initiated the current directional leg on D1.
- Threshold `2.0` means the current impulse has traveled more than 2x the normal daily range. Tunable.

### 5.5 Supply/Demand Zone Detection

Automated detection from OHLC data:

- **Demand zone**: lowest candle body in a swing low cluster where price reversed upward with above-average volume (or above-average range as volume proxy for crypto).
- **Supply zone**: highest candle body in a swing high cluster where price reversed downward with above-average volume/range.
- Zone width: defined by the high-low range of the signal candle(s).
- Lookback: 52 weeks for W1, 90 days for D1.
- Zones are invalidated (removed) when price closes through them.

### 5.6 Weekly Extreme Detection

- `near_weekly_extreme = true` when price is within `5%` of the lookback high or low.
- Lookback default: 52 weeks (configurable).
- This is a simple first-pass. Does not require zone detection to function.

### 5.7 HTF Gate Output

Produce `htf_structure_score` (float, `-1.0` to `+1.0`) and decision impact:

| Condition | Score Impact | Gate Output |
| --- | --- | --- |
| Short signal + price within demand zone + `displacement_exhaustion = true` | -0.8 to -1.0 | `SKIP` |
| Short signal + `weekly_range_location < 0.15` | -0.5 to -0.7 | `REDUCE` |
| Long signal + price within supply zone + `displacement_exhaustion = true` | -0.8 to -1.0 | `SKIP` |
| Long signal + `weekly_range_location > 0.85` | -0.5 to -0.7 | `REDUCE` |
| Direction aligned with regime + room to opposing structure | +0.3 to +1.0 | `PASS` |
| Regime uncertain (`regime_confidence < 0.4`) | 0.0 | `REDUCE` (override) |

---

## 6. Cross-Asset Equivalent (Same Principle, Different Data)

Use one abstraction: `Positioning Risk Gate`, with asset-specific inputs.

| Asset class | Primary positioning/extreme inputs | Distance normalization | Data freshness ceiling | Status |
| --- | --- | --- | --- | --- |
| Crypto | Liquidation heatmap, funding, OI | ATR-relative (N=0.5 default) | 4 hours | Available now |
| FX | COT percentile extremes + retail sentiment extremes | ATR-relative (N=1.0 default) | 96 hours (COT lag) | Data available, gate not enforced |
| Commodities | COT percentile extremes | ATR-relative (N=0.75 default) | 96 hours (COT lag) | Data available, gate not enforced |
| Indices | GEX/gamma profile + volatility structure | ATR-relative (N=0.75 default) | TBD | Not yet integrated |

Output stays identical: `PASS / REDUCE / SKIP`.

### 6.1 COT Percentile Mapping (FX/Commodities)

For non-crypto assets, map COT positioning to equivalent gate logic:

- `SKIP`: net speculative positioning > 90th percentile in the direction you're trading WITH (i.e., crowded trade). Equivalent to "shorting into a wall of short liqs."
- `REDUCE`: net speculative positioning > 75th percentile in same direction.
- `PASS`: positioning < 75th percentile or positioning favors your direction.

Percentile computed against 3-year rolling history per symbol.

---

## 7. Implementation Phases

### Phase 1 (Immediate)

- Universal-only pilot: keep Katarakti untouched.
- Promote crypto liquidation advisory from passive metadata to enforceable gate (**log-only mode first** on Universal).
- Require all available liquidation intervals in decision payload.
- Add explicit reason codes for `SKIP` and `REDUCE`.
- Compute and store `cluster_notional_vs_oi` and `data_freshness_hours` on every gate evaluation.
- Begin accumulating 30-day distribution stats for `cluster_notional_percentile` (use fallback constants until populated).
- Implement `consecutive_skip_counter` from day one (logs only, no escalation until paper validation).

### Phase 2 (Near Term)

- Add COT percentile extreme gating for FX and commodities (log-only mode).
- Unify gate score schema across asset classes.
- Implement portfolio correlation guard.
- Retire hardcoded fallback constants once rolling percentile data is available.
- Calibrate ATR-relative distance thresholds per asset class from backtest results.

### Phase 3 (HTF Rollout)

- Implement automated supply/demand zone detection from OHLC data.
- Implement displacement exhaustion formula.
- Implement weekly extreme detection.
- Start with semi-automated scoring: system proposes `htf_structure_score`, operator confirms.
- Move to full automation only after validation stability.
- Add `regime_confidence` computation.

### Phase 4 (Enforcement)

- Graduate from log-only to paper-trade enforcement (gate modifies simulated position sizes).
- After 4-8 weeks of stable paper metrics, graduate to live enforcement.
- Recalibrate all thresholds from distribution stats before enabling live `SKIP`.

---

## 8. Validation Requirements Before Live Enforcement

- Backtest baseline vs gated variants (same period, same symbols).
- Baseline definition for this phase: Universal v1 weekly model (no PA gate).
- Test definition for this phase: Universal v1 + Positioning Risk Gate + HTF overlay.
- Paper-trade audit with reason-code logs for at least 4-8 weeks.
- Measure:
  - avoided adverse excursion
  - win-rate and expectancy delta
  - skipped-trade opportunity cost
  - liquidation-risk alignment accuracy
  - overfilter rate (consecutive skips / total signals)
  - regime confidence accuracy (did uncertain regimes actually produce losses?)
  - correlation guard hit rate (did correlated downgrades prevent real losses?)
- Threshold recalibration from actual distribution data before live activation.

No full live activation until paper metrics are stable.

---

## 9. Data and Telemetry Additions

Store per entry:

- `positioning_gate.decision` (`PASS|REDUCE|SKIP`)
- `positioning_gate.reasons[]`
- `positioning_gate.score`
- `positioning_gate.threshold_version`
- `positioning_gate.primary_blocker` (`proximity|ratio|multi_interval_skip|none`)
- `positioning_gate.cluster_notional_vs_oi`
- `positioning_gate.cluster_notional_percentile`
- `positioning_gate.data_freshness_hours`
- `positioning_gate.data_freshness_degraded` (boolean)
- `positioning_gate.consecutive_skip_count`
- `positioning_gate.correlated_downgrade_from` (symbol or null)
- `htf_structure.context`
- `htf_structure.score`
- `htf_structure.regime`
- `htf_structure.regime_confidence`
- `htf_structure.weekly_range_location`
- `htf_structure.displacement_exhaustion`
- `htf_structure.decision_modifier`
- `strategy_scope` (`universal_v1_pilot`)

This keeps every decision auditable and backtest-replayable.

---

## 10. Immediate Action Items

- Wire gate decision into Universal execution path with **log-only** enforcement toggle.
- Define v1 threshold constants in config (not hardcoded). Include fallback constants with explicit retirement conditions.
- Begin accumulating 30-day rolling distribution stats for cluster notional percentiles.
- Build weekly review report: gate decisions vs realized path.
- Implement `consecutive_skip_counter` and `data_freshness_hours` from day one.
- Draft HTF tagging checklist for manual/semi-auto pilot (Phase 3 prep).

---

## 11. External Review (Claude) — COMPLETED

Review performed 2026-03-16. Findings incorporated into spec above.

### Review Checklist Results

- **Scope isolation**: PASS — Universal only, no Katarakti changes.
- **Threshold assumptions**: AMENDED — proximity promoted to primary gate; ratio demoted to secondary. Hardcoded `$3B` replaced with relative sizing (`cluster_notional_percentile`, `cluster_notional_vs_oi`) per Freedom's directive. `$3B`/`$1B` retained as bootstrap fallback only.
- **Cross-asset portability**: AMENDED — added ATR-relative distance normalization, data freshness degradation rules, COT percentile mapping for FX/commodities.
- **Missing failure modes**: ADDED — overfiltering counter (4.4.1), regime confidence (4.4.2), portfolio correlation guard (4.4.3).
- **HTF layer**: AMENDED — added concrete formulas for displacement exhaustion (5.4), supply/demand zone detection (5.5), weekly extreme detection (5.6), and scoring table (5.7).

### Key Design Decisions

1. Proximity > ratio as primary gate (prevents today's scenario where aggregate ratio looked acceptable but near-field was lethal).
2. Relative sizing over absolute notional (scales across market conditions without manual recalibration).
3. Log-only first, enforce later (build distribution data before activating SKIP).
4. Thresholds are recalibrated from actual data, not guessed upfront.

---

## 12. Backtest Addendum (Codex) — 2026-03-16

This section captures what was implemented and validated in the research backtest scripts after the initial draft/review cycle.

Research-window constraint for this phase:

- All gate-comparison tests are intentionally constrained to the most recent **8 closed weeks**.
- Reason: sentiment coverage in this dataset is currently only reliable for that 8-week window.
- Any suggestions requiring longer windows (for this phase) are treated as out of scope until sentiment history expands.

### 12.1 Verified: Gate Applies to Sentiment Trades

Universal execution gates every model's trade legs, including `sentiment`.

Evidence (8-week run, Universal):

- Sentiment model decisions (standard reduce mode): `PASS=73`, `REDUCE=13`, `SKIP=100`, `NO_DATA=10`
- Sentiment model decisions (skip-only mode): `PASS=73`, `REDUCE=0`, `SKIP=113`, `NO_DATA=10`

So sentiment is not bypassing the gate.

### 12.2 Clarification: Current Backtest Is One-Shot (Week Open)

Current gate behavior in backtests:

- Decision is made once at week open.
- No mid-week re-entry or deferred retry.
- COT data is effectively static intraweek by nature.
- Liquidation/GEX re-evaluation is not yet modeled in the weekly backtest engine.

This means both COT and liquidation gates are currently pre-flight filters, not dynamic execution managers.

### 12.3 COT Gate Implementation Updates

Applied in research script:

- Dealer sign convention aligned with `cotCompute` (`dealer_short - dealer_long`).
- Pair and market alias handling added (indices/commodities naming variants).
- Base-only mode for indices/commodities when quote-side (`USD`) market is unavailable in COT snapshot schema.
- Extended diagnostics added:
  - source counts
  - decision counts by asset
  - reason counts (overall, by asset, by pair)
  - decision counts by model (`gateDiagnostics.byModel`)

### 12.4 8-Week Comparison: Standard `REDUCE` vs Skip-Only

Window: closed weeks from `2026-01-19` through `2026-03-08`.

| Strategy | Standard gated return | Skip-only gated return | Standard gated DD | Skip-only gated DD |
| --- | --- | --- | --- | --- |
| universal_v1 | 97.22% | 101.15% | 1.39% | 1.19% |
| universal_v2 | 101.12% | 105.18% | 2.64% | 2.22% |
| universal_v3 | 87.63% | 89.96% | 3.74% | 3.76% |
| tiered_v1 | 334.59% | 357.81% | 0.00% | 0.00% |
| tiered_v2 | 154.47% | 165.74% | 9.78% | 7.56% |
| tiered_v3 | 144.42% | 153.11% | 16.95% | 9.22% |

Observed in this sample:

- Skip-only increased skipped trades and removed all reduces.
- Skip-only improved average freed margin versus standard reduce across all strategies.

### 12.5 Skip-Only Threshold Sweep (8 Weeks)

Sweep run in skip-only mode (`REDUCE` escalated to `SKIP`) over:

- `skip`: 90, 92.5, 95, 97.5, 99
- `reduce`: 75, 80, 85, 90, 95

Best scored combo in this sample:

- `skip=90`, `reduce=75` (same top score for both universal and tiered ranking function in this run)

However:

- Universal group: strongly positive delta and materially lower DD.
- Tiered group: DD improves materially, but cumulative return remains negative versus baseline across tested combinations.

Conclusion: one global COT threshold set is not yet robust across both Universal and Tiered on this 8-week sample.

### 12.6 Architecture Decision Direction (Next)

Proposed progression:

1. Keep weekly COT as regime/structural gate at week open.
2. Add periodic intraweek re-evaluation gates where data supports it:
   - Crypto: liquidation gate cadence (e.g., 4h/8h)
   - Indices: GEX gate cadence (when integrated)
3. Introduce a `DEFER` execution outcome for intraweek timing (new mode; not in current backtest).

### 12.7 MenthorQ 7-Day Trial Plan (GEX Feasibility)

Objective: determine if GEX can be validated quickly for indices (and any supported non-crypto proxies).

Day-1 checklist:

- confirm historical lookback depth
- confirm symbol coverage (SPX/NDX etc.)
- confirm interval granularity and update cadence
- confirm API/export limits and retention

Probe automation is now prepared:

- Script: `scripts/probe-menthorq-gex.ts`
- Dry-run command: `npx tsx scripts/probe-menthorq-gex.ts --dry-run=true`
- Live probe command: `npx tsx scripts/probe-menthorq-gex.ts --api-key=YOUR_KEY`
- Output artifact: `reports/bias-gate/menthorq-capability-latest.json`

Browser fallback (no API key) is now prepared:

- Script: `scripts/capture-menthorq-gamma-browser.ts`
- Purpose: manual login + page capture to CSV using persistent Playwright session
- Command example:
  - `npx tsx scripts/capture-menthorq-gamma-browser.ts --date=2026-03-16 --symbols=6E,6B,6J,DX,NQ,ES`
- Automation note:
  - The script now persists per-symbol URLs in `reports/bias-gate/menthorq-symbol-url-map.json`.
  - First pass can be manual per symbol; subsequent weekly runs auto-navigate saved URLs (no per-symbol manual clicking).
  - If your persistent session is already valid, pass `--assume-logged-in=true` to skip login pause.
- Data output:
  - `reports/bias-gate/menthorq-gamma-daily.csv`
  - `reports/bias-gate/menthorq-captures/<date>/` (screenshots, raw text/html, manifest)
- Pair mapping template:
  - `reports/bias-gate/menthorq-gamma-symbol-map-template.csv`
  - Supports no-DX mode: either `base_gamma_symbol` or `quote_gamma_symbol` can be blank (one-sided mapping).

If historical is available:

- ingest to `market_gex_snapshots` (or equivalent)
- run comparative backtests: `No gate` vs `COT only` vs `COT + GEX`
- evaluate DD, return, skip rate, and opportunity cost

If historical is not available:

- ingest live trial data anyway to finalize schema + pipeline
- defer statistical validation until paid/historical access is enabled

### 12.8 Artifacts (Research Runs)

- `reports/bias-gate/strategy-comparison-standard-reduce.json`
- `reports/bias-gate/strategy-comparison-reduce-as-skip.json`
- `reports/bias-gate/strategy-comparison-reduce-as-skip-sweep.json`

---

## 13. Performance UI Update (Patrick Brief) — 2026-03-16

This is the production-facing UI update now live in the Limni performance page for review.

### 13.1 What Was Fixed

- **Max drawdown in comparison metrics was corrected** to use cumulative equity-curve drawdown from weekly returns.
- This prevents overcounting from legacy per-row/per-leg drawdown fields when basket legs offset each other.
- Result: comparison panel drawdown is now portfolio-net consistent with weekly return series.

### 13.2 New Comparison Controls

- Universal and Tiered now include a **Standard / Gated** selector in the left strategy panel.
- Selecting `Gated` switches strategy metrics to gate-overlay results (return, win rate, Sharpe, max DD, trade stats, profit factor).
- A gate activity block is shown in gated mode (`SKIP / REDUCE / PASS+NO_DATA` counts).

### 13.3 Center Panel Sync

- The center `Basket performance` section now shows a synced **Strategy Comparison** strip (Standard vs Gated) for the active strategy.
- It includes:
  - return / DD / win rate / Sharpe / profit factor (both modes),
  - delta summary,
  - gate activity counts,
  - active mode trade context.
- Important: this strip is strategy-level overlay data; per-model cards remain the native basket model cards.

### 13.4 Data Source and Scope

- Gate overlay source:
  - default: `reports/bias-gate/strategy-comparison-latest.json`
  - fallback: `reports/bias-gate/strategy-comparison-standard-reduce.json`
  - optional override env: `PERFORMANCE_GATE_COMPARISON_PATH`
- Gated overlay is enabled for **`week=all` only** in the UI to avoid mismatched partial-week comparisons.

### 13.5 Files Changed (UI/API)

- `src/app/api/performance/comparison/route.ts`
- `src/components/performance/PerformanceComparisonPanel.tsx`
- `src/components/performance/PerformanceViewSection.tsx`
- `src/components/performance/PerformanceGrid.tsx`

### 13.6 Validation Completed

- ESLint passed on all modified files.
- Drawdown and strategy registry tests passed.
- Note: full repo `tsc --noEmit` still has pre-existing script-level type errors in unrelated experimental scripts.
