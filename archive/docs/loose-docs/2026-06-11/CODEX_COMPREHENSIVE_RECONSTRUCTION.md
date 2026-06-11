/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: docs/CODEX_COMPREHENSIVE_RECONSTRUCTION.md
 *
 * Description:
 * Codex prompt for the comprehensive weekly system reconstruction.
 * Adds: simple-sum canonical return, per-model standalone runs,
 * gated variants (reduce-as-skip), no -100% floor, full report.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

# Codex Task: Comprehensive Weekly System Reconstruction

## Overview

Modify `scripts/reconstruct-weekly-systems.ts` to produce a comprehensive reconstruction report with these changes:

1. **Simple sum as canonical headline return** (not compounded)
2. **Remove the -100% floor** — show full history regardless of drawdown magnitude
3. **Add 7 standalone model runs** (each model treated as its own system)
4. **Add gated variants** for all 6 composite systems AND all 7 standalone models
5. **Generate a comprehensive JSON report** with all breakdowns

## Critical Rules

### Return Computation
- **Canonical headline return = simple sum**: `totalReturnPct = Σ(weeklyReturnPct)` for all weeks
- **Compounded return is a SECONDARY metric**: keep `compoundedReturnPct` in the report but it is NOT the headline
- Add a new field `simpleReturnPct` to `ReconstructedSystemReport` — this is the PRIMARY metric
- `compoundedReturnPct` stays as-is for reference
- When logging to console, show `simpleReturnPct` as the primary number

### No -100% Floor
- The `compoundReturns()` function currently returns `-100` when `multiplier <= 0`. For `simpleReturnPct` this is irrelevant (it's just a sum). For `compoundedReturnPct`, keep computing but do NOT stop the system — continue processing all weeks regardless.
- `computeMaxDrawdownFromPercentReturns()` in `src/lib/performance/drawdown.ts` currently returns `100` (capped) when `multiplier <= 0`. **Change this**: when equity goes to 0 or negative, record 100% drawdown for that point but continue tracking — if equity recovers later, track the new peak. The max DD can exceed 100% in the simple-sum world. Add a **separate** `maxDrawdownSimplePct` that tracks drawdown on cumulative simple-sum equity: `equity(n) = 100 + Σ(weeklyReturn[0..n])`, peak-to-trough on this curve.

### Max Drawdown — Two Metrics
- `maxDrawdownPct`: existing compounded equity drawdown (keep as-is but remove the early-return at 100%)
- `maxDrawdownSimplePct`: new, computed from simple-sum equity curve `[100, 100+w1, 100+w1+w2, ...]`

## Standalone Model Runs

Run each of these 7 models as if it were a standalone system:

| Model | Type | How signals are sourced |
|-------|------|------------------------|
| `antikythera` | standalone | From `performance_snapshots` where `model = 'antikythera'` |
| `antikythera_v2` | derived | Derived from dealer + sentiment alignment (use existing `deriveAntikytheraV2Rows()`) |
| `antikythera_v3` | standalone | From `performance_snapshots` where `model = 'antikythera_v3'` |
| `blended` | standalone | From `performance_snapshots` where `model = 'blended'` |
| `dealer` | standalone | From `performance_snapshots` where `model = 'dealer'` |
| `commercial` | standalone | From `performance_snapshots` where `model = 'commercial'` |
| `sentiment` | standalone | From `performance_snapshots` where `model = 'sentiment'` |

For each standalone model:
- Each model produces signals for ALL pairs across ALL asset classes where it has snapshot data
- A standalone model has NO netting (every non-NEUTRAL signal is a trade, since there's only 1 model)
- Direction adjustment: `returnPct = direction === "SHORT" ? -canonicalReturnPct : canonicalReturnPct`
- Weekly return = sum of all pair returns for that model that week
- System ID format: `model_{modelName}` (e.g., `model_dealer`, `model_antikythera_v2`)
- Use `weighting: "equal"` (each pair contributes 1x its return)

Add these 7 to `SYSTEM_CONFIGS` as new entries with `family: "model"`.

## Gated Variants

For EVERY system (6 composite + 7 standalone = 13 total), produce a gated variant.

### Gate Logic (reduce-as-skip v1)

The gate evaluation must work at the **pair × week × direction** level:

**Crypto pairs (BTCUSD, ETHUSD)**:
- Read `reports/bias-gate/btc-latest.json` and `reports/bias-gate/eth-latest.json`
- These files have a `signals` array with `{ weekStartUtc, gateDecision }` per week
- Map `weekStartUtc` to canonical week using `normalizeWeekOpenUtc()`
- The `gateDecision` field is the verdict: `"PASS"`, `"REDUCE"`, `"SKIP"`, or `"NO_DATA"`

**FX / indices / commodities pairs**:
- Use COT percentile gate logic
- Read COT snapshot history via `readSnapshotHistory(assetClass, 260)` from `src/lib/cotStore`
- For each pair × week × direction, compute the directional percentile of the COT net positioning
- Thresholds: `reduce_percentile: 75`, `skip_percentile: 90`
- If base OR quote percentile > 90 → SKIP
- If base OR quote percentile > 75 → REDUCE
- Otherwise → PASS
- If insufficient history (< 10 weeks) → NO_DATA

**Reduce-as-skip behavior**:
- `PASS` → keep trade (multiplier 1.0)
- `NO_DATA` → keep trade (multiplier 1.0)
- `REDUCE` → remove trade (multiplier 0.0) — this is "reduce-as-skip"
- `SKIP` → remove trade (multiplier 0.0)

### Implementation Approach

The gate logic already exists in `scripts/backtest-strategy-gate-comparison.ts`. You have two options:

**Option A (recommended)**: Extract the reusable gate functions into a shared module `src/lib/performance/gateEvaluation.ts`:
- `buildGateMapForSymbol()` — reads BTC/ETH gate reports
- `buildCotGateContext()` — loads COT history
- `evaluateCotPercentileGate()` — computes COT percentile gate per pair
- `evaluatePairWithGate()` — unified gate evaluation (crypto → COT fallback)
- `gateMultiplier()` — decision → multiplier
- Also extract `directionalPercentile()`, `resolveCotMarketId()`, `resolveCotMarketNet()`, `normalizeCotPairAlias()`, and the COT pair alias map

**Option B**: Copy the relevant functions inline into the reconstruction script. Less clean but simpler.

For each system, produce a paired gated variant with system ID suffix `_gated` (e.g., `universal_v1_gated`, `model_dealer_gated`).

### Gated Weekly Return Computation

For each week:
1. Build signals as normal (same as baseline)
2. For each pair signal, evaluate the gate: `evaluatePairWithGate({ pair, weekOpenUtc, direction, assetClass, reduceAsSkip: true })`
3. Multiply the pair's return contribution by the gate multiplier (0 or 1)
4. Sum the gated returns for the weekly total
5. Track: `gatedTrades`, `skippedTrades`, `passedTrades`

The gated variant report should include:
- All the same fields as the baseline report
- Additional `gateActivity: { skippedTrades, passedOrNoDataTrades }` per week and total
- `gateDecisionBreakdown: Record<string, number>` (count of PASS/REDUCE/SKIP/NO_DATA across all pair×week evaluations)

## Report Structure

The output file should be `reports/comprehensive-reconstruction.json` with this structure:

```typescript
{
  generated_utc: string;
  canonical_weeks: string[];
  return_methodology: "simple_sum";
  compounded_also_included: true;

  // 6 composite systems (baseline)
  composite_systems: ReconstructedSystemReport[];

  // 6 composite systems (gated)
  composite_systems_gated: ReconstructedSystemReport[];

  // 7 standalone model runs (baseline)
  standalone_models: ReconstructedSystemReport[];

  // 7 standalone model runs (gated)
  standalone_models_gated: ReconstructedSystemReport[];

  // Summary table for quick comparison
  summary: Array<{
    system: string;
    family: string;
    simpleReturnPct: number;
    compoundedReturnPct: number;
    maxDrawdownSimplePct: number;
    maxDrawdownPct: number;
    trades: number;
    winRatePct: number;
    weeks: number;
    isGated: boolean;
    gateSkippedTrades?: number;
  }>;
}
```

## `ReconstructedSystemReport` Changes

Add these fields:
```typescript
simpleReturnPct: number;          // Σ(weeklyReturnPct) — PRIMARY headline metric
maxDrawdownSimplePct: number;     // peak-to-trough on simple equity curve
// Keep existing:
compoundedReturnPct: number;      // (1+r1)(1+r2)...(1+rn) - 1 — SECONDARY
maxDrawdownPct: number;           // peak-to-trough on compounded equity curve
```

For gated reports, also add:
```typescript
gateActivity: {
  totalSkipped: number;
  totalPassedOrNoData: number;
  decisionBreakdown: Record<string, number>;
};
```

## Console Output

When logging results, format as a summary table:

```
=== Comprehensive Reconstruction Report ===
Return methodology: Simple Sum (compounded also shown)

COMPOSITE SYSTEMS (BASELINE)
  universal_v1:  simple=+XX.XX%  compound=+XX.XX%  simpleDD=XX.XX%  compDD=XX.XX%  trades=XXX  winRate=XX.X%
  universal_v2:  simple=+XX.XX%  compound=+XX.XX%  simpleDD=XX.XX%  compDD=XX.XX%  trades=XXX  winRate=XX.X%
  ...

COMPOSITE SYSTEMS (GATED)
  universal_v1_gated:  simple=+XX.XX%  ...  skipped=XXX
  ...

STANDALONE MODELS (BASELINE)
  model_dealer:  simple=+XX.XX%  ...
  ...

STANDALONE MODELS (GATED)
  model_dealer_gated:  simple=+XX.XX%  ...  skipped=XXX
  ...
```

## Max Drawdown Simple Implementation

Add this function (or add to `src/lib/performance/drawdown.ts`):

```typescript
export function computeMaxDrawdownSimple(weeklyReturns: number[]): number {
  if (weeklyReturns.length === 0) return 0;
  let cumulative = 0;  // starts at 0, not 100
  let peak = 0;
  let maxDD = 0;
  for (const r of weeklyReturns) {
    cumulative += r;
    if (cumulative > peak) peak = cumulative;
    const dd = peak - cumulative;  // in percentage points
    if (dd > maxDD) maxDD = dd;
  }
  return maxDD;
}
```

This measures drawdown in percentage-point terms on the simple-sum equity curve.

## Files to Modify

1. **`scripts/reconstruct-weekly-systems.ts`** — Main changes:
   - Add `simpleReturnPct` and `maxDrawdownSimplePct` to report
   - Add 7 standalone model system configs
   - Add gated variant runs for all 13 systems
   - Output comprehensive report JSON
   - Update console logging

2. **`src/lib/performance/drawdown.ts`** — Add `computeMaxDrawdownSimple()`

3. **`src/lib/performance/gateEvaluation.ts`** (new, if using Option A) — Extracted gate logic

## Existing Code to Reference

- `scripts/backtest-strategy-gate-comparison.ts` — Gate logic source (lines 818-1285)
- `src/lib/cotStore.ts` — `readSnapshotHistory()`
- `src/lib/cotPairs.ts` — `PAIRS_BY_ASSET_CLASS`
- `src/lib/cotMarkets.ts` — COT market resolution
- `src/lib/weekAnchor.ts` — `normalizeWeekOpenUtc()`
- `src/lib/pairReturns.ts` — `getWeeklyPairReturns()`
- `src/lib/performance/modelConfig.ts` — Model compositions

## Constraints

- Do NOT change the existing 6 composite system baselines — they must produce identical results to current
- The canonical weekly returns come from `pair_period_returns` via `getWeeklyPairReturns()` — do NOT change this
- Keep all existing fields on `ReconstructedSystemReport` — only ADD new fields
- The `CANONICAL_WEEKS` array stays the same (9 weeks)
- Do NOT persist gated results to the database — report JSON output only
- Do NOT modify `backtest-strategy-gate-comparison.ts` — only read/extract from it
- Header standard: every new file gets the Freedom_EXE header

## Verification

After running, verify:
1. The 6 composite baseline `simpleReturnPct` values should be the simple sum of each system's weekly returns (which you can cross-check from the `weeklyReturns` array)
2. The 6 composite baseline `compoundedReturnPct` should match the current values (within rounding): Universal V1 -100%, V2 +352.71%, V3 +37.40%, Tiered V1 +291.02%, V2 +324.63%, V3 +315.79%
3. Every gated variant should have fewer or equal trades vs its baseline
4. No system should have 0 weeks — all 9 canonical weeks must appear
5. `maxDrawdownSimplePct` should be a non-negative number for all systems

## Execution

```bash
cd limni-website
npx tsx scripts/reconstruct-weekly-systems.ts
```

This should produce `reports/comprehensive-reconstruction.json` and log the summary table to stdout.
