# CODEX: Sentiment + Strength Research — Neutral Bucket Enrichment

**Date:** 2026-04-04
**Goal:** Test neutral-handling variants for sentiment and strength sources across all 4 asset classes (FX, indices, crypto, commodities). Both sources run in tandem — one script, one output file. **Research only — no production code changes.**

**Context:**
- Dealer and commercial are shipped for FX (36/36 coverage, +96.51% / +38.78%). Non-FX base-only is confirmed best.
- Sentiment uses Myfxbook data with 65/35 crowding thresholds and flip detection. Many pairs are NEUTRAL (between thresholds). Direction logic: `sentimentDirection()` in `performanceLab.ts` — flip first, then crowding fade, else null (no trade).
- Strength uses OANDA H1 candles → 3 windows (1h/4h/24h) → spread threshold of 5 → composite score. **DEAD CODE:** `performanceLab.ts:339-341` returns `{}` for model === "strength". Strength has never been backtested.
- 10 backtestable weeks: Jan 19 → Mar 22 (from `pair_period_returns` table).
- 36 total pairs: 28 FX + 3 indices + 2 crypto + 3 commodities.
- ADR normalization always on (targetAdr = 1.0%).

**Key constraint from Freedom:** Preserve current non-neutral logic. Only test better handling of the neutral bucket. No continuous signals — that's too broad and too easy to overfit on 10 weeks. No engine changes in this phase.

---

## Phase 1: Research Script

**Script:** `scripts/research-sentiment-strength.ts`
**Output:** `docs/SENTIMENT_STRENGTH_RESEARCH_2026-04-04.md`

### Data Loading

Use `listDataSectionWeeks()` to get backtestable weeks (should be 10: Jan 19 → Mar 22).

For each week, load:

1. **Returns:** `getWeeklyPairReturns(weekOpenUtc)` → all pairs for that week. Each returns `{ symbol, assetClass, returnPct, ... }`.
2. **ADR:** `loadWeeklyAdrMap(weekOpenUtc)` → for each pair, `adrMultiplier = getTargetAdrPct() / getAdrPct(adrMap, pair)`. If ADR unavailable for a pair, use multiplier = 1.
3. **Sentiment:** `getAggregatesAsOf(weekOpenUtc)` from `src/lib/sentiment/store.ts` → latest aggregate per symbol as of week open. For persistence variant (S4), also load `getAggregatesAsOf(priorWeekOpenUtc)` where `priorWeekOpenUtc = DateTime.fromISO(weekOpenUtc, { zone: "utc" }).minus({ weeks: 1 }).toISO()`.
4. **Strength:** `readWeeklyPairStrengths(weekOpenUtc)` from `src/lib/strength/weeklyStrength.ts` → per-pair window readings with composite scores. For persistence variant (T6), also load `readWeeklyPairStrengths(priorWeekOpenUtc)`.

**Imports:**

```typescript
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { writeFileSync } from "node:fs";
import { DateTime } from "luxon";
import { listDataSectionWeeks } from "../src/lib/dataSectionWeeks";
import { getWeeklyPairReturns } from "../src/lib/pairReturns";
import { getAdrPct, getTargetAdrPct, loadWeeklyAdrMap } from "../src/lib/performance/adrLookup";
import { getAggregatesAsOf } from "../src/lib/sentiment/store";
import { readWeeklyPairStrengths, type WeeklyPairStrength } from "../src/lib/strength/weeklyStrength";
import { PAIRS_BY_ASSET_CLASS } from "../src/lib/cotPairs";
import type { AssetClass } from "../src/lib/cotMarkets";
import type { SentimentAggregate } from "../src/lib/sentiment/types";
```

**IMPORTANT:** `loadEnvConfig(process.cwd())` MUST be the first call, before any DB-dependent imports execute.

### Row Structure

```typescript
type Direction = "LONG" | "SHORT";
type SentimentMethod = "s1_baseline" | "s2_60_40" | "s3_neutral_tiebreak" | "s4_persistence" | "s5_flip_only" | "s6_crowding_only";
type StrengthMethod = "t1_baseline" | "t2_threshold4" | "t3_threshold3" | "t4_weighted" | "t5_neutral_resolver" | "t6_persistence";

type Row = {
  weekOpenUtc: string;
  assetClass: AssetClass;
  pair: string;
  rawReturnPct: number;
  adrMultiplier: number;
  sentiment: Record<SentimentMethod, Direction | null>;
  strength: Record<StrengthMethod, Direction | null>;
};
```

Build one Row per pair per week. `rawReturnPct` and `adrMultiplier` are shared across all methods. Only include rows where return data exists (skip pairs with no return for that week).

### ADR-Normalized Directional Return

```typescript
function directionalReturn(row: Row, direction: Direction): number {
  return (direction === "SHORT" ? -row.rawReturnPct : row.rawReturnPct) * row.adrMultiplier;
}
```

---

### Sentiment Variant Implementations (S1–S6)

For each variant, derive a `Direction | null` per pair from the aggregate. Null = no trade (pair skipped).

**S1: Baseline (current 65/35 + flips)**

This mirrors `sentimentDirection()` in `performanceLab.ts:98-124` exactly.

```typescript
function sentimentS1(agg: SentimentAggregate | undefined): Direction | null {
  if (!agg) return null;
  const flip = String(agg.flip_state ?? "").trim().toUpperCase();
  const crowding = String(agg.crowding_state ?? "").trim().toUpperCase();
  if (flip === "FLIPPED_UP") return "LONG";
  if (flip === "FLIPPED_DOWN") return "SHORT";
  if (flip === "FLIPPED_NEUTRAL") return null;
  if (crowding === "CROWDED_LONG" || crowding === "EXTREME_LONG") return "SHORT";   // fade
  if (crowding === "CROWDED_SHORT" || crowding === "EXTREME_SHORT") return "LONG";   // fade
  return null;
}
```

Handle EXTREME_LONG / EXTREME_SHORT same as CROWDED — matches `sentimentDirectionFromAggregate()` in `src/lib/sentiment/daily.ts:117-128`.

**S2: 60/40 threshold**

Re-derive crowding from raw `agg_long_pct` with wider thresholds. Flips still apply first.

```typescript
function sentimentS2(agg: SentimentAggregate | undefined): Direction | null {
  if (!agg) return null;
  const flip = String(agg.flip_state ?? "").trim().toUpperCase();
  if (flip === "FLIPPED_UP") return "LONG";
  if (flip === "FLIPPED_DOWN") return "SHORT";
  if (flip === "FLIPPED_NEUTRAL") return null;
  // Re-derive crowding from raw pct with 60/40 thresholds (ignoring pre-computed crowding_state)
  if (agg.agg_long_pct >= 60) return "SHORT";   // fade crowded long
  if (agg.agg_long_pct <= 40) return "LONG";     // fade crowded short
  return null;
}
```

Note: `agg_long_pct <= 40` is equivalent to `agg_short_pct >= 60` since they sum to ~100.

**S3: Neutral-only tiebreak from raw >50**

Keep S1 logic for non-neutral pairs. For pairs that S1 returns null, use the raw majority to fade.

```typescript
function sentimentS3(agg: SentimentAggregate | undefined): Direction | null {
  if (!agg) return null;
  // First try S1 logic
  const s1 = sentimentS1(agg);
  if (s1 !== null) return s1;
  // S1 returned null → neutral bucket. Use raw majority fade.
  if (agg.agg_long_pct > 50) return "SHORT";   // retail majority long → fade to SHORT
  if (agg.agg_long_pct < 50) return "LONG";     // retail majority short → fade to LONG
  return null;  // 50/50 exact split → no trade
}
```

This is the "full coverage" variant — every pair with data gets a direction.

**S4: 2+ week crowding persistence**

Flips still work normally. Crowding only fires if the same crowding state was present in the prior week's aggregate.

```typescript
function sentimentS4(
  agg: SentimentAggregate | undefined,
  priorAgg: SentimentAggregate | undefined,
): Direction | null {
  if (!agg) return null;
  const flip = String(agg.flip_state ?? "").trim().toUpperCase();
  if (flip === "FLIPPED_UP") return "LONG";
  if (flip === "FLIPPED_DOWN") return "SHORT";
  if (flip === "FLIPPED_NEUTRAL") return null;
  const crowding = String(agg.crowding_state ?? "").trim().toUpperCase();
  const priorCrowding = priorAgg ? String(priorAgg.crowding_state ?? "").trim().toUpperCase() : "";
  // Crowding only if same state persisted from prior week
  if ((crowding === "CROWDED_LONG" || crowding === "EXTREME_LONG")
    && (priorCrowding === "CROWDED_LONG" || priorCrowding === "EXTREME_LONG")) return "SHORT";
  if ((crowding === "CROWDED_SHORT" || crowding === "EXTREME_SHORT")
    && (priorCrowding === "CROWDED_SHORT" || priorCrowding === "EXTREME_SHORT")) return "LONG";
  return null;
}
```

If prior week data is unavailable (`priorAgg` is undefined), crowding signals are suppressed — only flips fire.

**S5: Flip-only (no crowding direction)**

```typescript
function sentimentS5(agg: SentimentAggregate | undefined): Direction | null {
  if (!agg) return null;
  const flip = String(agg.flip_state ?? "").trim().toUpperCase();
  if (flip === "FLIPPED_UP") return "LONG";
  if (flip === "FLIPPED_DOWN") return "SHORT";
  return null;
}
```

**S6: Crowding-only (no flips)**

```typescript
function sentimentS6(agg: SentimentAggregate | undefined): Direction | null {
  if (!agg) return null;
  const crowding = String(agg.crowding_state ?? "").trim().toUpperCase();
  if (crowding === "CROWDED_LONG" || crowding === "EXTREME_LONG") return "SHORT";
  if (crowding === "CROWDED_SHORT" || crowding === "EXTREME_SHORT") return "LONG";
  return null;
}
```

---

### Strength Variant Implementations (T1–T6)

For each variant, derive a `Direction | null` per pair from the `WeeklyPairStrength` object. The strength system provides 3 window readings per pair, each with a `signedSpread`.

**Helpers:**

```typescript
function classifySpreadCustom(spread: number | null, threshold: number): "LONG" | "SHORT" | "NEUTRAL" {
  if (spread === null || !Number.isFinite(spread)) return "NEUTRAL";
  if (spread > threshold) return "LONG";
  if (spread < -threshold) return "SHORT";
  return "NEUTRAL";
}

function compositeToDirection(score: number): Direction | null {
  if (score > 0) return "LONG";
  if (score < 0) return "SHORT";
  return null;
}

const DIR_SCORE: Record<"LONG" | "SHORT" | "NEUTRAL", number> = { LONG: 1, NEUTRAL: 0, SHORT: -1 };
```

**Understanding signedSpread:**
- For FX pairs: `signedSpread = normalizedBase - normalizedQuote` (computed in `buildFxWindowReading` in weeklyStrength.ts)
- For non-FX pairs: `signedSpread = normalizedBase - 50` (computed in `buildNonFxWindowReading` — asset strength relative to neutral 50)

The `WeeklyPairStrength` object already has this computed in each window's `signedSpread` field.

**T1: Baseline (threshold=5)**

Uses the pre-computed `compositeDirection` from `WeeklyPairStrength`, which already applies threshold=5 per window and sums direction scores.

```typescript
function strengthT1(ps: WeeklyPairStrength | undefined): Direction | null {
  if (!ps || ps.availableWindows === 0) return null;
  // compositeDirection is pre-computed: classifySpread(compositeScore, 0)
  // where compositeScore = sum of DIRECTION_SCORE per window (each classified at threshold=5)
  if (ps.compositeDirection === "NEUTRAL") return null;
  return ps.compositeDirection as Direction;
}
```

**T2: Threshold=4**

Re-classify each window with threshold=4, then compute composite.

```typescript
function strengthT2(ps: WeeklyPairStrength | undefined): Direction | null {
  if (!ps || ps.availableWindows === 0) return null;
  let score = 0;
  for (const w of ps.windows) {
    if (!w.available) continue;
    score += DIR_SCORE[classifySpreadCustom(w.signedSpread, 4)];
  }
  return compositeToDirection(score);
}
```

**T3: Threshold=3**

Same as T2 but with threshold=3.

```typescript
function strengthT3(ps: WeeklyPairStrength | undefined): Direction | null {
  if (!ps || ps.availableWindows === 0) return null;
  let score = 0;
  for (const w of ps.windows) {
    if (!w.available) continue;
    score += DIR_SCORE[classifySpreadCustom(w.signedSpread, 3)];
  }
  return compositeToDirection(score);
}
```

**T4: Weighted windows (24h=2, 4h=1, 1h=1)**

Weight the 24h window double. Per-window threshold stays at 5 (baseline). Only the weighting changes.

```typescript
function strengthT4(ps: WeeklyPairStrength | undefined): Direction | null {
  if (!ps || ps.availableWindows === 0) return null;
  let score = 0;
  for (const w of ps.windows) {
    if (!w.available) continue;
    const weight = w.window === "24h" ? 2 : 1;
    score += weight * DIR_SCORE[classifySpreadCustom(w.signedSpread, 5)];
  }
  return compositeToDirection(score);
}
```

Max composite = 2+1+1 = 4. Min = -4. Any non-zero → directional.

**T5: Neutral-only resolver from raw spread sum**

Keep T1 logic for non-neutral pairs. For pairs that T1 returns null (NEUTRAL composite), use the raw signed spread sum across all windows as tiebreaker.

```typescript
function strengthT5(ps: WeeklyPairStrength | undefined): Direction | null {
  if (!ps || ps.availableWindows === 0) return null;
  // First try T1 logic
  const t1 = strengthT1(ps);
  if (t1 !== null) return t1;
  // T1 returned null → neutral composite. Sum raw signed spreads.
  let rawSum = 0;
  let hasData = false;
  for (const w of ps.windows) {
    if (w.available && w.signedSpread !== null && Number.isFinite(w.signedSpread)) {
      rawSum += w.signedSpread;
      hasData = true;
    }
  }
  if (!hasData) return null;
  if (rawSum > 0) return "LONG";
  if (rawSum < 0) return "SHORT";
  return null;  // exact zero sum
}
```

This is the "full coverage" variant for strength — every pair with data gets a direction.

**T6: 2+ week persistence**

Only assign direction if the same composite direction (from T1 logic) was present in the prior week.

```typescript
function strengthT6(
  ps: WeeklyPairStrength | undefined,
  priorPs: WeeklyPairStrength | undefined,
): Direction | null {
  if (!ps || ps.availableWindows === 0) return null;
  const current = strengthT1(ps);
  if (current === null) return null;
  const prior = priorPs ? strengthT1(priorPs) : null;
  if (prior === current) return current;
  return null;  // direction changed or no prior data → no trade
}
```

If prior week strength data is unavailable, persistence cannot be confirmed → null.

---

### Building Rows

For each backtestable week:

```
1. Load returns, ADR, sentiment aggregates (current + prior), strength readings (current + prior)
2. Build sentiment lookup: Map<symbol, SentimentAggregate> for current and prior
3. Build strength lookup: Map<pair, WeeklyPairStrength> for current and prior
4. For each asset class, for each pair in PAIRS_BY_ASSET_CLASS[assetClass]:
   a. Find return row by matching symbol (pair name, uppercase)
   b. If no return → skip this pair-week entirely
   c. Compute ADR multiplier
   d. Look up sentiment aggregate by pair name (e.g., "EURUSD")
   e. Look up strength reading by pair name
   f. Look up prior sentiment and prior strength for persistence variants
   g. Compute all 6 sentiment directions + all 6 strength directions
   h. Push Row
```

The strength data from `readWeeklyPairStrengths` returns all 36 pairs (across all asset classes). Match by `ps.pair` (uppercase) === pair name.

The sentiment data from `getAggregatesAsOf` returns aggregates keyed by `agg.symbol`. Match by `agg.symbol` === pair name (uppercase).

---

### Stats Computation

For each method × asset class combination:

```typescript
type Stats = {
  trades: number;
  totalPct: number;
  maxDdPct: number;
  winRatePct: number;
  coverage: string;  // "trades/possiblePairWeeks"
};
```

**MaxDD** is portfolio-level: aggregate all pair returns within each week into a single weekly return, then compute cumulative peak-to-trough from the weekly equity curve.

```typescript
function computeStats(
  rows: Row[],
  getDirection: (row: Row) => Direction | null,
  totalPossible: number,
): Stats {
  const trades: { weekOpenUtc: string; returnPct: number }[] = [];
  for (const row of rows) {
    const dir = getDirection(row);
    if (!dir) continue;
    trades.push({ weekOpenUtc: row.weekOpenUtc, returnPct: directionalReturn(row, dir) });
  }

  const totalPct = trades.reduce((sum, t) => sum + t.returnPct, 0);
  const wins = trades.filter((t) => t.returnPct > 0).length;
  const winRate = trades.length > 0 ? (wins / trades.length) * 100 : 0;

  // MaxDD from weekly aggregated returns
  const weeklyReturns = new Map<string, number>();
  for (const t of trades) {
    weeklyReturns.set(t.weekOpenUtc, (weeklyReturns.get(t.weekOpenUtc) ?? 0) + t.returnPct);
  }
  const sortedWeeks = [...weeklyReturns.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  let cumulative = 0;
  let peak = 0;
  let maxDd = 0;
  for (const [, ret] of sortedWeeks) {
    cumulative += ret;
    if (cumulative > peak) peak = cumulative;
    maxDd = Math.max(maxDd, peak - cumulative);
  }

  return {
    trades: trades.length,
    totalPct: round(totalPct),
    maxDdPct: round(maxDd),
    winRatePct: round(winRate, 1),
    coverage: `${trades.length}/${totalPossible}`,
  };
}
```

**Possible pair-weeks by asset class:**
- FX: 28 pairs × 10 weeks = 280
- indices: 3 × 10 = 30
- crypto: 2 × 10 = 20
- commodities: 3 × 10 = 30
- combined: 36 × 10 = 360

---

### Output Format

Write to `docs/SENTIMENT_STRENGTH_RESEARCH_2026-04-04.md`:

```markdown
# Sentiment + Strength Research

Weeks analyzed: 10 (Jan 19 → Mar 22).
Universe: 36 pairs (28 FX + 3 indices + 2 crypto + 3 commodities).
Possible pair-weeks: 360 (FX: 280, indices: 30, crypto: 20, commodities: 30).

## Data Availability

### Sentiment Coverage
| Asset Class | Symbols with Data | Total Pairs | Avg Data per Week |
| --- | ---: | ---: | ---: |
| fx | ??? | 28 | ??? |
| indices | ??? | 3 | ??? |
| crypto | ??? | 2 | ??? |
| commodities | ??? | 3 | ??? |

### Strength Coverage
| Asset Class | Pairs with Data | Total Pairs | Avg Windows per Pair |
| --- | ---: | ---: | ---: |
| fx | ??? | 28 | ??? |
| indices | ??? | 3 | ??? |
| crypto | ??? | 2 | ??? |
| commodities | ??? | 3 | ??? |

## Sentiment Results

### S1: Baseline (65/35 + flips)

| Asset Class | Trades | Total% | MaxDD% | Win% | Coverage |
| --- | ---: | ---: | ---: | ---: | ---: |
| fx | ??? | ??? | ??? | ??? | ???/280 |
| indices | ??? | ??? | ??? | ??? | ???/30 |
| crypto | ??? | ??? | ??? | ??? | ???/20 |
| commodities | ??? | ??? | ??? | ??? | ???/30 |
| combined | ??? | ??? | ??? | ??? | ???/360 |

### S2: 60/40 threshold
(same table format)

### S3: Neutral-only tiebreak (>50 fade)
(same table format)

### S4: 2+ week crowding persistence
(same table format)

### S5: Flip-only (no crowding)
(same table format)

### S6: Crowding-only (no flips)
(same table format)

### Sentiment Comparison

| Method | Trades | Total% | MaxDD% | Win% | Coverage |
| --- | ---: | ---: | ---: | ---: | ---: |
| S1: Baseline (65/35 + flips) | ??? | ??? | ??? | ??? | ???/360 |
| S2: 60/40 threshold | ??? | ??? | ??? | ??? | ???/360 |
| S3: Neutral-only tiebreak | ??? | ??? | ??? | ??? | ???/360 |
| S4: 2+ week persistence | ??? | ??? | ??? | ??? | ???/360 |
| S5: Flip-only | ??? | ??? | ??? | ??? | ???/360 |
| S6: Crowding-only | ??? | ??? | ??? | ??? | ???/360 |

### Sentiment Per-Class Winners

| Asset Class | Best Method | Trades | Total% | Win% |
| --- | --- | ---: | ---: | ---: |
| fx | ??? | ??? | ??? | ??? |
| indices | ??? | ??? | ??? | ??? |
| crypto | ??? | ??? | ??? | ??? |
| commodities | ??? | ??? | ??? | ??? |

## Strength Results

### T1: Baseline (threshold=5)
(same per-asset-class table format)

### T2: Threshold=4
(same table format)

### T3: Threshold=3
(same table format)

### T4: Weighted windows (24h×2, 4h×1, 1h×1)
(same table format)

### T5: Neutral-only resolver (raw spread sum)
(same table format)

### T6: 2+ week persistence
(same table format)

### Strength Comparison

| Method | Trades | Total% | MaxDD% | Win% | Coverage |
| --- | ---: | ---: | ---: | ---: | ---: |
| T1: Baseline (threshold=5) | ??? | ??? | ??? | ??? | ???/360 |
| T2: Threshold=4 | ??? | ??? | ??? | ??? | ???/360 |
| T3: Threshold=3 | ??? | ??? | ??? | ??? | ???/360 |
| T4: Weighted windows | ??? | ??? | ??? | ??? | ???/360 |
| T5: Neutral resolver | ??? | ??? | ??? | ??? | ???/360 |
| T6: 2+ week persistence | ??? | ??? | ??? | ??? | ???/360 |

### Strength Per-Class Winners

| Asset Class | Best Method | Trades | Total% | Win% |
| --- | --- | ---: | ---: | ---: |
| fx | ??? | ??? | ??? | ??? |
| indices | ??? | ??? | ??? | ??? |
| crypto | ??? | ??? | ??? | ??? |
| commodities | ??? | ??? | ??? | ??? |
```

**Best method** for per-class winners = highest Total% among methods with > 0 trades. If all methods have 0 trades for an asset class (no data), report "No data".

---

## Phase 2: Wire Strength Baseline (conditional — do NOT implement unless told to)

**This section documents the fix for when we're ready to ship. Do NOT implement during research.**

In `src/lib/performanceLab.ts:339-341`:

```typescript
// CURRENT (dead code):
if (model === "strength") {
  return {};
}

// FUTURE (after research validates):
if (model === "strength") {
  return buildStrengthPairs(assetClass, strength);
}
```

Where `buildStrengthPairs()` would:
1. Take `strength: WeeklyPairStrength[]` parameter (must be added to `computeModelPairSignals` and `computeModelPerformance` signatures)
2. Filter to the target asset class
3. Apply the winning threshold/variant from research
4. Return `Record<string, PairSnapshot>` for pairs with directional composite scores

**All callers of `computeModelPerformance` and `computeModelPairSignals` would need updating to pass strength data.** This is a significant change — only worth doing if strength produces robust standalone results.

---

## Validation

1. `npx eslint scripts/research-sentiment-strength.ts --max-warnings=0`
2. Script runs without errors: `npx tsx scripts/research-sentiment-strength.ts`
3. Output file is written to `docs/SENTIMENT_STRENGTH_RESEARCH_2026-04-04.md`
4. All 6 sentiment variants + all 6 strength variants have results
5. No NaN, undefined, or Infinity values in output tables
6. Data availability section clearly reports coverage per asset class
7. Per-class winners are identified for both sentiment and strength

---

## Important Warnings

1. **Sentiment data availability for non-FX is uncertain.** Myfxbook primarily covers FX. IG may cover indices. If non-FX pairs have no sentiment data, report 0 trades — don't skip them silently. The coverage table must show this.

2. **Strength data availability depends on hourly snapshot history.** `readWeeklyPairStrengths()` reads from `strength_weekly_snapshots` (locked) or falls back to `currency_strength_snapshots`/`asset_strength_snapshots` (live). If no data exists for a week, `availableWindows` will be 0 → all strength methods return null for that pair-week.

3. **ADR normalization is ALWAYS on.** `trade.returnPct *= (targetAdr / pairAdr)` where `targetAdr = 1.0%`. If ADR is unavailable for a pair, use multiplier = 1.

4. **Sentiment flip_state values:** `"FLIPPED_UP"`, `"FLIPPED_DOWN"`, `"FLIPPED_NEUTRAL"`, `"NONE"`. Handle all four. `"NONE"` means no flip — fall through to crowding logic. Normalize with `.trim().toUpperCase()` for safety.

5. **Sentiment crowding_state values:** `"CROWDED_LONG"`, `"CROWDED_SHORT"`, `"NEUTRAL"`. Also possible: `"EXTREME_LONG"`, `"EXTREME_SHORT"` — treat EXTREME same as CROWDED (see `sentimentDirectionFromAggregate()` in `daily.ts:125-126`).

6. **Do NOT modify any production code.** No changes to performanceLab.ts, sentiment/store.ts, weeklyStrength.ts, cotCompute.ts, cotStore.ts, or any other existing file. Only create the research script and output markdown.

7. **Strength signedSpread differs by asset class:**
   - FX: `normalizedBase - normalizedQuote` (relative strength between two currencies)
   - Non-FX: `normalizedBase - 50` (asset strength relative to neutral midpoint)
   - This is already computed in the `WeeklyPairStrength.windows[].signedSpread` field — just read it.

8. **MaxDD is portfolio-level per method.** Computed from weekly aggregated returns (sum all pair returns within each week), then track cumulative peak-to-trough across weeks.

9. **Prior week for persistence variants:** `DateTime.fromISO(weekOpenUtc, { zone: "utc" }).minus({ weeks: 1 }).toISO()`. If prior data is unavailable, persistence variants return null for those pair-weeks. Other variants still produce results from current week data.

10. **`getAggregatesAsOf()` loads all aggregates from last 365 days, then filters client-side.** This is cached via `getOrSetRuntimeCache` — the first call loads data, subsequent calls reuse it within the same process. Efficient for our 10-week loop.

11. **Strength `readWeeklyPairStrengths()` returns all 36 pairs across all asset classes in one call.** Build a `Map<string, WeeklyPairStrength>` keyed by `ps.pair.toUpperCase()` for fast lookup.

12. **S2 (60/40) intentionally ignores the pre-computed `crowding_state` field.** It re-derives crowding from `agg_long_pct` using the 60/40 thresholds. The pre-computed field uses 65/35. They will produce different results — that's the point.

13. **S3 and T5 are the "full coverage" variants.** They should produce significantly more trades than baseline because they resolve neutral pairs. If coverage doesn't increase meaningfully, the sentiment/strength data itself may be sparse (missing symbols), which is useful information.

14. **File header standard applies.** Use the Freedom_EXE copyright header on the research script (see existing scripts for pattern).

---

## Files Changed Summary

| File | Change |
|------|--------|
| `scripts/research-sentiment-strength.ts` | **New** — research script |
| `docs/SENTIMENT_STRENGTH_RESEARCH_2026-04-04.md` | **New** — research output (auto-generated) |

**No production code changes. Zero.**
