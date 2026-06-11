# CODEX: Source-Level Coverage Canonicalization

**Date:** 2026-04-04
**Goal:** Determine whether each of the 4 base sources can be upgraded to near-full-coverage canonical voters with acceptable standalone damage, and whether that makes composite systems cleaner.

**This is NOT about maximizing standalone returns.** It's about making the source layer structurally consistent so composite systems (agreement, tiered, selector) can work with comparable inputs.

---

## The Problem

Our 4 sources have wildly different pair coverage per week:

| Source | ~Trades/Week | Coverage | Why Gaps Exist |
|--------|-------------|----------|----------------|
| Dealer | ~23 | ~64% | Bias-label matching: both currencies same bias or neutral → no signal |
| Sentiment | ~26.5 | ~74% | Neutral band (35-65%): pairs in the band get no direction |
| Strength | ~33.5 | ~93% | compositeScore === 0 for some pairs |
| Commercial | ~36 | ~100% | **Already fixed** — forced-raw gives nearly all pairs a direction |

When a composite system asks "do 2 of 3 sources agree on EURUSD?" but one source has no opinion on EURUSD, that's not really a 2-of-3 vote — it's a 2-of-2 vote. This structural inconsistency is why composite results are noisy and filter mode preferences diverge across families.

**Commercial was already fixed** by switching to forced-raw (`base_net - quote_net`). The question now: can we apply the same principle to dealer, sentiment, and strength?

---

## What To Test

### Phase 1: Source-Level Canonical Comparison

For each source, compare two versions:
- **[A] Current canonical** — standard neutral handling (as it exists in the app today)
- **[B] Full-coverage candidate** — tiebreaker-forced neutrals become canonical directions

#### Dealer [A] vs [B]

**[A] Current:** `filterByModel(basketWeek, "dealer")` → `nonNeutralSignals()`. Uses bias-label matching. ~230 trades over 10 weeks.

**[B] Candidate:** For pairs where dealer is NEUTRAL, apply tiebreaker:
- Both currencies same bias (both BULLISH or both BEARISH): compare `normalizeLean(net, long, short)` = `net / (long + short)`. The currency with stronger lean toward the "more bullish" side gives the pair direction.
  - Both BULLISH: stronger lean (higher normalized lean) = base more bullish → LONG. Lower = SHORT.
  - Both BEARISH: weaker lean (closer to 0) = base less bearish → LONG. More negative = SHORT.
- One currency NEUTRAL, other has bias: non-neutral side determines direction.
  - Base BULLISH or Quote BEARISH → LONG
  - Base BEARISH or Quote BULLISH → SHORT
- Both NEUTRAL: compare raw `net / (long + short)` values. Higher base lean → LONG, higher quote lean → SHORT.
  - **If both currencies have identical normalized lean (true tie), remain NEUTRAL.** Do not force noise.

**IMPORTANT:** For dealer, the net calculation is `dealer_short - dealer_long` (inverted from commercial). The `resolveMarketBias()` function in `cotCompute.ts` already handles this correctly — use the `.net` field it returns, don't recalculate.

**For non-FX pairs:** Base-only direction. If base is NEUTRAL, use normalized lean. If lean is exactly 0, remain NEUTRAL.

#### Sentiment [B] Candidate

**[A] Current:** `filterByModel(basketWeek, "sentiment")` → `nonNeutralSignals()`. Uses the sentiment neutral band (35-65%). ~265 trades.

**[B] Candidate:** For pairs where sentiment is NEUTRAL (in the 35-65% band), apply tiebreaker:
- Use `agg_long_pct` contrarian logic: `agg_long_pct > 50 → SHORT`, `agg_long_pct < 50 → LONG`
- **If `agg_long_pct === 50.0` exactly (true tie), remain NEUTRAL.**
- For FX pairs: derive pair direction from base vs quote sentiment directions (same cross-currency logic as standard sentiment)
- For non-FX: base-only direction

#### Strength [B] Candidate

**[A] Current:** `readWeeklyPairStrengths()` → filter `compositeScore !== 0`. ~335 trades.

**[B] Candidate:** For pairs where `compositeScore === 0`, apply tiebreaker:
- Sum `signedSpread` across all windows: `windows.reduce((sum, w) => sum + (w.signedSpread ?? 0), 0)`
- Positive sum → LONG, negative → SHORT
- **If sum === 0 exactly (true tie), remain NEUTRAL.**
- **CRITICAL: The field is `signedSpread`, NOT `spread`.** Using `spread` will silently produce zeros.

#### Commercial [B] = Current Canonical (Already Done)

Commercial was already upgraded to forced-raw in the canonical rebase. Use current canonical as-is. No [B] candidate needed — just include it in coverage tables for completeness.

---

### Phase 2: Coverage Analysis

For each source, produce this table across all 10 weeks:

```
Source | Version | Total Trades | Trades/Week Avg | Coverage % | Newly Forced Pairs | Total % | Max DD | R/DD | Win %
```

Where:
- **Coverage %** = (trades with direction) / (36 pairs × 10 weeks) × 100
- **Newly Forced Pairs** = trades in [B] that were NEUTRAL in [A]
- Return metrics are ADR-normalized (canonical — already built into the engine for [A], manual for [B])

Also produce a per-week breakdown showing how many pairs each source covers:

```
Week | Dealer[A] | Dealer[B] | Sent[A] | Sent[B] | Str[A] | Str[B] | Comm
```

This shows the coverage gap closing (or not) across weeks.

---

### Phase 3: Composite Rebuild on Standardized Sources

Using the [B] full-coverage versions of all 4 sources, rebuild a small clean set of composites:

1. **2-of-4 Agreement** — any 2 of {dealer[B], commercial, sentiment[B], strength[B]} agree → trade
2. **3-of-4 Agreement** — any 3 of 4 agree → trade
3. **Tiered 4-Source** — 4/4 agree = Tier 1, 3/4 = Tier 2, 2/4 = Tier 3 (all tiers trade, majority direction wins)
4. **Existing agree_2of3 via engine** — uses current app sources (includes canonical commercial but standard dealer/sentiment)
5. **Existing tiered_v3 via engine** — same, uses current canonical sources

Compare composites built from [B] sources vs composites built from [A] sources (items 4-5 as baselines).

**No veto. No tiebreaker enrichment of veto voters.** Just raw composites. The question is whether consistent coverage alone improves composite quality.

Also test: if we upgrade all 3 remaining sources to [B] in the app, would the existing `agree_2of3` and `tiered_v3` strategies automatically improve? (They would, because they read from `getCanonicalBasketWeek()` which would reflect the upgraded sources.)

---

## Technical Implementation

### Data Loading (same as all our backtests)

```typescript
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { listDataSectionWeeks, deriveCotReportDate } from "../src/lib/dataSectionWeeks";
import { getCanonicalBasketWeek, filterByModel, nonNeutralSignals } from "../src/lib/performance/basketSource";
import { readWeeklyPairStrengths } from "../src/lib/strength/weeklyStrength";
import { loadWeeklyAdrMap, getAdrPct, getTargetAdrPct } from "../src/lib/performance/adrLookup";
import { getWeeklyPairReturns } from "../src/lib/pairReturns";
import { getDisplayWeekOpenUtc } from "../src/lib/weekAnchor";
import { readSnapshot } from "../src/lib/cotStore";
import { PAIRS_BY_ASSET_CLASS } from "../src/lib/cotPairs";
import { getAggregatesForWeekStartWithBackfill } from "../src/lib/sentiment/store";
import { sentimentDirectionFromAggregate } from "../src/lib/sentiment/daily";
import { computeWeeklyHold } from "../src/lib/performance/weeklyHoldEngine";
import { getStrategy, getEntryStyle } from "../src/lib/performance/strategyConfig";
```

### Building [A] Direction Maps (Current Canonical)

```typescript
// Dealer/Commercial/Sentiment from basket
const basketWeek = await getCanonicalBasketWeek(weekOpenUtc);
const dealerSignals = nonNeutralSignals(filterByModel(basketWeek, "dealer"));
const commSignals = nonNeutralSignals(filterByModel(basketWeek, "commercial"));
const sentSignals = nonNeutralSignals(filterByModel(basketWeek, "sentiment"));

// Build direction maps
const dealerMapA = new Map(dealerSignals.map(s => [s.symbol, s.direction as Direction]));
const commMap = new Map(commSignals.map(s => [s.symbol, s.direction as Direction]));
const sentMapA = new Map(sentSignals.map(s => [s.symbol, s.direction as Direction]));

// Strength from separate store
const strengthRows = await readWeeklyPairStrengths(weekOpenUtc);
const strMapA = new Map<string, Direction>();
for (const row of strengthRows) {
  if (row.compositeScore > 0) strMapA.set(row.pair, "LONG");
  else if (row.compositeScore < 0) strMapA.set(row.pair, "SHORT");
}
```

### Building [B] Direction Maps (Full-Coverage Candidates)

For dealer and commercial tiebreakers, you need raw snapshot data:

```typescript
const reportDate = deriveCotReportDate(weekOpenUtc);
for (const ac of ["fx", "indices", "commodities", "crypto"]) {
  const snapshot = await readSnapshot({ assetClass: ac, reportDate });
  // snapshot.currencies[CURRENCY] = MarketSnapshot with dealer_long, dealer_short, dealer_net, etc.
}
```

**Dealer tiebreaker** — resolve neutrals per pair:
```typescript
function normalizeLean(net: number, long: number, short: number): number {
  const total = long + short;
  return total > 0 ? net / total : 0;
}

// For FX: both currencies available
// baseBias and quoteBias come from resolveMarketBias(market, "dealer")
// which returns { long, short, net, bias }
// If baseBias.bias !== quoteBias.bias and neither is NEUTRAL → already has direction (keep [A])
// If neutral → apply tiebreaker using baseBias.net, quoteBias.net
```

**Sentiment tiebreaker** — resolve neutral-band pairs:
```typescript
const aggregates = await getAggregatesForWeekStartWithBackfill(weekOpenUtc);
// aggregates is a map of pair → { agg_long_pct, ... }
// For neutral pairs (35-65%), use: agg_long_pct > 50 → SHORT, < 50 → LONG
// agg_long_pct === 50 → keep NEUTRAL
```

**Strength tiebreaker** — resolve compositeScore === 0:
```typescript
for (const row of strengthRows) {
  if (row.compositeScore !== 0) {
    strMapB.set(row.pair, row.compositeScore > 0 ? "LONG" : "SHORT");
  } else {
    const spreadSum = row.windows.reduce((sum, w) => sum + (w.signedSpread ?? 0), 0);
    if (spreadSum > 0) strMapB.set(row.pair, "LONG");
    else if (spreadSum < 0) strMapB.set(row.pair, "SHORT");
    // spreadSum === 0 → omit (true tie, stays NEUTRAL)
  }
}
```

### ADR Normalization for Non-Engine Paths

For [B] direction maps that don't go through `computeWeeklyHold()`, apply ADR normalization manually:

```typescript
const adrMap = await loadWeeklyAdrMap(weekOpenUtc);
const targetAdr = getTargetAdrPct(); // 1.0

function getNormReturn(pair: string, direction: Direction, weeklyReturns: Map<string, PairReturn>, assetClass: string): number | null {
  const priceData = weeklyReturns.get(pair.toUpperCase());
  if (!priceData) return null;
  const rawReturn = direction === "SHORT" ? -priceData.returnPct : priceData.returnPct;
  const pairAdr = getAdrPct(adrMap, pair, assetClass);
  return rawReturn * (targetAdr / pairAdr);
}
```

### Loading Existing Composites Via Engine (for [A] baselines)

```typescript
async function computeEngineStrategyWeeks(strategyId: string, weeks: string[]) {
  const strategy = getStrategy(strategyId);
  const entry = getEntryStyle("weekly_hold");
  if (!strategy || !entry) throw new Error(`Missing: ${strategyId}`);
  const results = [];
  for (const weekOpenUtc of weeks) {
    results.push(await computeWeeklyHold(strategy, weekOpenUtc, entry));
  }
  return results;
}
```

**NOTE:** `computeWeeklyHold` no longer takes a `strengthGate` parameter. ADR normalization is automatic.

### Week Filtering

```typescript
const currentWeekOpenUtc = getDisplayWeekOpenUtc();
const weeks = allWeeks.filter(w => w < currentWeekOpenUtc); // exclude current incomplete week
```

### Return Data

```typescript
const weeklyReturns = await getWeeklyPairReturns(weekOpenUtc);
// Returns .symbol (NOT .pair!) and .returnPct and .assetClass
```

---

## Output Format

### Section 1: Coverage Table

```
Source  | Version | Trades | Trades/Wk | Coverage% | Forced Pairs | Total%  | MaxDD%  | R/DD  | Win%
────────┼─────────┼────────┼───────────┼───────────┼──────────────┼─────────┼─────────┼───────┼──────
Dealer  | [A] Std | 230    | 23.0      | 63.9%     | —            | +73.18% | 2.19%   | 33.3x | 56.5%
Dealer  | [B] Tie | ???    | ???       | ???       | ???          | ???     | ???     | ???   | ???
Sent    | [A] Std | 265    | 26.5      | 73.6%     | —            | +92.40% | 19.56%  | 4.7x  | 60.8%
Sent    | [B] Tie | ???    | ???       | ???       | ???          | ???     | ???     | ???   | ???
Str     | [A] Std | 335    | 33.5      | 93.1%     | —            | +80.89% | 14.98%  | 5.4x  | 54.6%
Str     | [B] Tie | ???    | ???       | ???       | ???          | ???     | ???     | ???   | ???
Comm    | Current | ~360   | ~36       | ~100%     | —            | +21.14% | 29.04%  | 0.7x  | 52.5%
```

### Section 2: Per-Week Coverage Grid

```
Week       | D[A] | D[B] | S[A] | S[B] | Str[A] | Str[B] | Comm | Max Possible
───────────┼──────┼──────┼──────┼──────┼────────┼────────┼──────┼─────────────
Jan 19     | 24   | 35   | 28   | 36   | 34     | 36     | 36   | 36
Jan 26     | 22   | 34   | 25   | 35   | 33     | 35     | 36   | 36
...
```

### Section 3: Standalone Damage Assessment

For each source, show:
```
Source | Δ Total% | Δ MaxDD% | Δ Win% | Δ Trades | Verdict
───────┼──────────┼──────────┼────────┼──────────┼────────────────
Dealer | -X.XX%   | +X.XX%   | -X.X%  | +XX      | [acceptable / concerning / unacceptable]
Sent   | ...      | ...      | ...    | ...      | ...
Str    | ...      | ...      | ...    | ...      | ...
```

Verdict criteria:
- **Acceptable:** Total% drops <15%, MaxDD increase <5pp, WR drops <3pp
- **Concerning:** One metric breaches but others hold
- **Unacceptable:** Multiple metrics degrade significantly

### Section 4: Composite Comparison

```
System                    | Sources | Trades | Total%  | MaxDD%  | R/DD  | Win%  | LW
──────────────────────────┼─────────┼────────┼─────────┼─────────┼───────┼───────┼────
agree_2of3 [A] (engine)   | d+c+s   | 227    | +104.68%| 8.41%   | 12.5x | 62.6% | 3
2-of-4 Agree [B]          | all4[B] | ???    | ???     | ???     | ???   | ???   | ???
3-of-4 Agree [B]          | all4[B] | ???    | ???     | ???     | ???   | ???   | ???
tiered_v3 [A] (engine)    | d+c+s   | 257    | +111.51%| 6.22%   | 17.9x | 62.3% | 2
Tiered 4 [B]              | all4[B] | ???    | ???     | ???     | ???   | ???   | ???
```

### Section 5: Decision Summary

```
QUESTION 1: Does full coverage make composites cleaner?
→ [YES / NO / MIXED] — with evidence

QUESTION 2: Which sources should be upgraded?
→ Dealer: [upgrade / keep standard] — reason
→ Sentiment: [upgrade / keep standard] — reason
→ Strength: [upgrade / keep standard] — reason

QUESTION 3: Is 4-source standardized better than current 3-source composites?
→ [YES / NO] — with comparison data
```

---

## Deliverables

1. **Script:** `scripts/backtest-source-canonicalization.ts`
2. **Results:** `docs/SOURCE_CANONICALIZATION_RESULTS_2026-04-04.md`

Run with: `npx tsx scripts/backtest-source-canonicalization.ts`

Handle errors gracefully — if one section fails, log and continue.

---

## Important Warnings

1. **Dealer net = `dealer_short - dealer_long`** (inverted from commercial). Use `resolveMarketBias(market, "dealer")` which handles this correctly.
2. **`signedSpread` not `spread`** for strength tiebreaker.
3. **`getWeeklyPairReturns` returns `.symbol` not `.pair`**.
4. **Sentiment aggregates:** `getAggregatesForWeekStartWithBackfill()` returns aggregates keyed by pair. The `agg_long_pct` field drives the contrarian tiebreaker.
5. **True ties should remain NEUTRAL.** Do not manufacture directions from zero-signal data. This is about near-full coverage, not forced-full coverage.
6. **Commercial is already done.** Don't re-derive commercial. Use current canonical as-is.
7. **Verify baselines FIRST:** Dealer [A] = 230 trades, +73.18%. If this doesn't match, data loading is broken.
8. **`computeWeeklyHold` takes 2-3 args only** (biasSource, weekOpenUtc, entryStyle?). The old `strengthGate` parameter was removed.
