# CODEX: Sentiment Full Resolver — 360/360 Coverage

**Date:** 2026-04-05
**Goal:** Research and validate a sentiment neutral resolver stack that guarantees 360/360 coverage (36 pairs × 10 weeks) while preserving or improving the canonical S1 baseline.

**CRITICAL: Use the canonical app/engine data loader — `getAggregatesForWeekStartWithBackfill`, NOT `getAggregatesAsOf`.** A prior research pass used the wrong loader and produced incorrect baselines. This prompt uses the correct one.

## Context

**Canonical baseline (correct loader, ADR-normalized):**
- S1 baseline: 265/360 trades, +92.40%, 19.56% DD, 60.8% WR, 5 losing weeks
- Data availability: 360/360 via backfill (0 no-data pair-weeks)
- Neutrals with data: 95 pair-weeks (have sentiment aggregate but S1 returns null)

**Prior research findings (on canonical path):**
- Tier A (prior-week S1 carry): 30 fills, +7.54%, 70.0% WR — strong
- Tier B (persistence 55/45): 48 fills, -6.31%, 54.2% WR — **negative on canonical path**
- Tier D (mild crowding 60/40): marginal
- PB (Tier A only): 295 trades, +99.94%, 19.60% DD, 61.7% WR, 5 losing weeks
- PD (A+B+D): 321 trades, +88.79%, 15.90% DD, 59.8% WR, 3 losing weeks

**Problem:** No prior stack reaches 360. We need a closer tier that resolves ALL remaining neutrals.

**Approach:** Two-tier closer system:
1. **Tier R (relative extremity fade)** — fade ANY measurable lean from 50%. This is a serious canonical candidate, not just a gap filler. It will fire on almost every neutral-with-data row, so stacks containing Tier R are testing whether "any measurable lean" is a legitimate sentiment signal. The extremity bucket diagnostic will show whether tiny leans (50.1/49.9) carry real edge or are noise.
2. **Tier F (forced lean)** — diagnostic emergency closer for the rare `agg_long_pct === 50.000` case. This is NOT expected to ship as canonical. It exists to guarantee 360/360 in testing and to measure how many rows actually need it. If Tier F fires on more than a handful of rows, something is wrong.

---

## Script: `scripts/research-sentiment-full-resolver.ts`

Create a NEW script file. Do NOT modify any existing scripts.

Output file: `docs/SENTIMENT_FULL_RESOLVER_RESEARCH_2026-04-05.md`

---

## Architecture

Follow the EXACT same architecture as `scripts/research-sentiment-persistence.ts`:
- Load all backtestable weeks from `listDataSectionWeeks()`, filter to weeks before current week
- For each week: load weekly pair returns, ADR map, sentiment via `getAggregatesForWeekStartWithBackfill`
- Build a flat `Row[]` array with one entry per pair-week
- ADR-normalize all returns: `returnPct * (targetAdr / pairAdr)` where `targetAdr = getTargetAdrPct()`
- Compute S1 baseline direction using `sentimentS1()` — same function
- Compute tier results for neutrals only
- Compute stacks by trying tiers in order
- Render markdown tables to output file

**Copy these utility functions from `research-sentiment-persistence.ts` exactly:**
- `weekLabel`, `round`, `signedPct`, `directionalReturn`, `computeMaxDd`
- `sentimentS1` (the S1 baseline function)
- All stats computation and rendering patterns

**Imports needed:**
```typescript
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { writeFileSync } from "node:fs";
import { DateTime } from "luxon";
import { listDataSectionWeeks } from "../src/lib/dataSectionWeeks";
import { getWeeklyPairReturns } from "../src/lib/pairReturns";
import { getAdrPct, getTargetAdrPct, loadWeeklyAdrMap } from "../src/lib/performance/adrLookup";
import { getAggregatesForWeekStartWithBackfill } from "../src/lib/sentiment/store";
import type { SentimentAggregate } from "../src/lib/sentiment/types";
import { PAIRS_BY_ASSET_CLASS } from "../src/lib/cotPairs";
import type { AssetClass } from "../src/lib/cotMarkets";
import { getDisplayWeekOpenUtc, normalizeWeekOpenUtc } from "../src/lib/weekAnchor";
```

---

## Sentiment Data Loading

**CRITICAL: Use the canonical app path for ALL sentiment loading.**

For the current week:
```typescript
const open = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
const close = open.plus({ days: 7 });
const currentSentiment = await getAggregatesForWeekStartWithBackfill(
  open.toUTC().toISO()!,
  close.toUTC().toISO()!,
);
```

For the prior week (1 week back):
```typescript
const prior1Open = open.minus({ weeks: 1 });
const prior1Close = prior1Open.plus({ days: 7 });
const prior1Sentiment = await getAggregatesForWeekStartWithBackfill(
  prior1Open.toUTC().toISO()!,
  prior1Close.toUTC().toISO()!,
);
```

For 2-weeks back:
```typescript
const prior2Open = open.minus({ weeks: 2 });
const prior2Close = prior2Open.plus({ days: 7 });
const prior2Sentiment = await getAggregatesForWeekStartWithBackfill(
  prior2Open.toUTC().toISO()!,
  prior2Close.toUTC().toISO()!,
);
```

Build symbol maps from each result:
```typescript
const sentMap = new Map(currentSentiment.map(a => [a.symbol.toUpperCase(), a]));
const prior1Map = new Map(prior1Sentiment.map(a => [a.symbol.toUpperCase(), a]));
const prior2Map = new Map(prior2Sentiment.map(a => [a.symbol.toUpperCase(), a]));
```

---

## Row Type

```typescript
type Direction = "LONG" | "SHORT";

type Row = {
  weekOpenUtc: string;
  assetClass: AssetClass;
  pair: string;
  rawReturnPct: number;
  adrMultiplier: number;

  // S1 baseline
  sentS1: Direction | null;
  sentHasData: boolean;
  sentIsNeutral: boolean;    // has data but S1 returns null

  // Raw data
  aggLongPct: number | null;

  // Prior week data (1 week back)
  priorS1: Direction | null;
  priorLongPct: number | null;

  // 2-week-back data
  prior2S1: Direction | null;
  prior2LongPct: number | null;

  // Tier results (computed for neutrals only)
  tiers: ResolverTiers | null;
};

type ResolverTiers = {
  tierA: Direction | null;   // Prior-week S1 carry
  tierR: Direction | null;   // Relative extremity fade (any lean from 50) — serious canonical candidate
  tierF: Direction | null;   // Forced lean (diagnostic emergency closer — not expected to ship)
  tierFSubStep: "prior_s1" | "prior_lean" | "two_week_lean" | "hardcoded" | null;  // Which sub-step of Tier F resolved this row
};
```

---

## Tier Definitions

### Tier A: Prior-week S1 carry (PROVEN — 30 fills, +7.54%, 70% WR)

If this week is neutral-with-data, and the prior week had an S1-level direction for this pair, carry it.

```typescript
function tierA_priorS1Carry(row: Row): Direction | null {
  if (!row.sentIsNeutral) return null;
  return row.priorS1;
}
```

### Tier R: Relative extremity fade (THE CLOSER)

For neutral-with-data pairs: fade the crowd's lean direction. If `agg_long_pct > 50`, crowd leans long → SHORT. If `agg_long_pct < 50`, crowd leans short → LONG. If exactly 50.0, return null (let Tier F handle).

This is NOT threshold-gated. Any lean away from 50, no matter how small, produces a direction.

```typescript
function tierR_relativeExtremityFade(row: Row): Direction | null {
  if (!row.sentIsNeutral || row.aggLongPct === null) return null;
  if (row.aggLongPct > 50) return "SHORT";
  if (row.aggLongPct < 50) return "LONG";
  return null; // exactly 50.0
}
```

### Tier F: Forced lean (DIAGNOSTIC — emergency closer, not expected to ship)

For any pair still without a direction after Tier A and Tier R. This should almost never fire — it only triggers when `agg_long_pct` is exactly 50.000 AND no prior-week S1 exists.

Cascade order:
1. Prior-week S1 direction (if available)
2. Prior-week raw `agg_long_pct` lean (faded)
3. 2-week average lean (faded)
4. Hardcoded SHORT fallback (clearly labeled as synthetic — NOT a real signal)

```typescript
function tierF_forcedLean(row: Row): { direction: Direction; subStep: ResolverTiers["tierFSubStep"] } {
  // 1. Prior-week S1 direction
  if (row.priorS1) return { direction: row.priorS1, subStep: "prior_s1" };
  // 2. Prior-week raw lean (faded)
  if (row.priorLongPct !== null) {
    if (row.priorLongPct > 50) return { direction: "SHORT", subStep: "prior_lean" };
    if (row.priorLongPct < 50) return { direction: "LONG", subStep: "prior_lean" };
  }
  // 3. 2-week average lean (faded)
  if (row.prior2LongPct !== null) {
    if (row.prior2LongPct > 50) return { direction: "SHORT", subStep: "two_week_lean" };
    if (row.prior2LongPct < 50) return { direction: "LONG", subStep: "two_week_lean" };
  }
  // 4. Hardcoded fallback (synthetic — flag in output)
  return { direction: "SHORT", subStep: "hardcoded" };
}
```

When building `row.tiers`, store both:
```typescript
const tierFResult = tierF_forcedLean(row);
row.tiers = {
  tierA: tierA_priorS1Carry(row),
  tierR: tierR_relativeExtremityFade(row),
  tierF: tierFResult.direction,
  tierFSubStep: tierFResult.subStep,
};
```

**Note:** Tier F ALWAYS returns a direction. It never returns null. This guarantees 360/360. However, if Tier F fires on more than ~5 rows total, that signals a data coverage problem worth investigating. The output should clearly report how many rows hit each sub-step (prior S1 / prior lean / 2-week lean / hardcoded).

---

## Stack Definitions

| Stack | Description | Tiers | Expected Coverage |
|-------|-------------|-------|-------------------|
| S1 | Baseline (no resolver) | — | 265/360 |
| SA | Prior-S1 carry only | A | ~295/360 |
| SB | Prior-S1 carry + relative extremity | A → R | ~360/360 |
| SC | Prior-S1 carry + relative extremity + forced lean | A → R → F | 360/360 (guaranteed) |
| SD | Relative extremity only (no carry) | R | ~360/360 |
| SE | Relative extremity + forced lean (no carry) | R → F | 360/360 (guaranteed) |

```typescript
type StackName = "sa" | "sb" | "sc" | "sd" | "se";
type TierName = "tierA" | "tierR" | "tierF";

const STACK_TIERS: Record<StackName, TierName[]> = {
  sa: ["tierA"],
  sb: ["tierA", "tierR"],
  sc: ["tierA", "tierR", "tierF"],
  sd: ["tierR"],
  se: ["tierR", "tierF"],
};
```

**Stack resolution logic:**
```typescript
function resolveStack(row: Row, stack: StackName): { direction: Direction | null; tier: string | null } {
  if (row.sentS1) return { direction: row.sentS1, tier: null };

  const tiers = STACK_TIERS[stack];
  for (const tier of tiers) {
    const direction = row.tiers?.[tier] ?? null;
    if (direction) return { direction, tier };
  }
  return { direction: null, tier: null };
}
```

---

## Additional Diagnostics: Tier R Extremity Buckets

For all Tier R fills, bucket them by distance from 50% to see if weaker fades hurt:

```typescript
type ExtremityBucket = {
  label: string;
  minDist: number;  // inclusive
  maxDist: number;  // exclusive
  fills: number;
  totalPct: number;
  avgPct: number;
  winRatePct: number;
};

const EXTREMITY_BUCKETS = [
  { label: "0-1% from 50", minDist: 0, maxDist: 1 },
  { label: "1-2% from 50", minDist: 1, maxDist: 2 },
  { label: "2-5% from 50", minDist: 2, maxDist: 5 },
  { label: "5-10% from 50", minDist: 5, maxDist: 10 },
  { label: "10-15% from 50", minDist: 10, maxDist: 15 },
];
```

For each Tier R fill, compute `distance = Math.abs(row.aggLongPct - 50)` and assign to bucket.

---

## Output Format

Write to `docs/SENTIMENT_FULL_RESOLVER_RESEARCH_2026-04-05.md`.

### Section 1: Header

```markdown
# Sentiment Full Resolver Research (Canonical Path)

Weeks analyzed: {N} ({first week label} -> {last week label}).
Universe: 36 pairs × {N} weeks = {total} possible pair-weeks.
Data loader: getAggregatesForWeekStartWithBackfill (canonical app/engine path).
```

### Section 2: Gap Analysis

```markdown
## Gap Analysis

- S1 baseline: {trades}/{total} trades
- Neutrals with data: {count} pair-weeks
- Neutrals without data: {count} pair-weeks
- Data ceiling: {count}/{total} ({pct}%)
```

Include per-week gap breakdown table:
```markdown
### Per-Week Gap Breakdown

| Week | S1 Trades | Neutrals (data) | No Data | Total Gaps |
| --- | ---: | ---: | ---: | ---: |
```

### Section 3: Individual Tier Quality

```markdown
## Individual Tier Quality

| Tier | Fills | Total% | Avg% | Win% |
| --- | ---: | ---: | ---: | ---: |
| A: Prior-week S1 carry | {fills} | {total%} | {avg%} | {win%} |
| R: Relative extremity fade | {fills} | {total%} | {avg%} | {win%} |
| F: Forced lean | {fills} | {total%} | {avg%} | {win%} |
```

### Section 4: Tier R Extremity Buckets

```markdown
## Tier R: Extremity Bucket Breakdown

| Bucket | Fills | Total% | Avg% | Win% |
| --- | ---: | ---: | ---: | ---: |
| 0-1% from 50 | ... |
| 1-2% from 50 | ... |
| 2-5% from 50 | ... |
| 5-10% from 50 | ... |
| 10-15% from 50 | ... |
```

### Section 4b: Flat / Near-50 Diagnostic

Report the exact count of rows where `agg_long_pct` is effectively flat:

```markdown
## Flat / Near-50 Diagnostic

- Rows with `agg_long_pct === 50.000` (exactly flat): {count}
- Rows with `|agg_long_pct - 50| < 0.5` (near-flat): {count}
- Rows with `|agg_long_pct - 50| < 1.0`: {count}

These are the rows most likely to produce noise rather than signal from Tier R.
```

### Section 4c: Tier F Sub-Step Breakdown

If Tier F fires at all, report which sub-step resolved each row:

```markdown
## Tier F Sub-Step Breakdown

| Sub-Step | Fills |
| --- | ---: |
| Prior-week S1 | {n} |
| Prior-week lean | {n} |
| 2-week average lean | {n} |
| Hardcoded SHORT (synthetic) | {n} |
```

### Section 5: Stack Results

For each stack, show per-asset-class breakdown AND the resolver contribution:

```markdown
### {Stack Label}

| Asset Class | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| fx | ... |
| indices | ... |
| crypto | ... |
| commodities | ... |
| combined | ... |
| *of which resolver* | {resolved_trades} | {resolved_total%} | — | {resolved_wr%} | — | — |

Tier fills: tierA={n}, tierR={n}, tierF={n}
```

### Section 6: Stack Comparison (sorted by Losing Wks ascending, then Total% descending)

**Losing weeks is the primary ranking key.** Total return is secondary.

```markdown
## Stack Comparison

| Stack | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage | Full 36/36? |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- |
```

Sort rows by: Losing Wks ASC, then Total% DESC.

### Resolver-Only Stats

Separate table showing ONLY the trades added by the resolver (not S1 baseline trades):

```markdown
## Resolver-Only Performance

| Stack | Resolver Trades | Resolver Total% | Resolver Avg% | Resolver Win% |
| --- | ---: | ---: | ---: | ---: |
| SA | ... |
| SB | ... |
| SC | ... |
| SD | ... |
| SE | ... |
```

This separates the question "did the resolver help?" from "is the full book good?"

### Section 7: Per-Week Trade Count Verification

Include a table verifying that SC and SE produce exactly 36 trades per week:

```markdown
## Per-Week Coverage Verification

| Week | S1 | SA | SB | SC | SD | SE |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Jan 19 | ... | ... | ... | 36 | ... | 36 |
| Jan 26 | ... | ... | ... | 36 | ... | 36 |
| ... |
```

---

## Validation

Run:
```bash
npx tsx scripts/research-sentiment-full-resolver.ts
```

Verify:
1. **S1 baseline MUST match canonical**: 265/360 trades, +92.40%, 19.56% DD, 60.8% WR, 5 losing weeks
2. **SA MUST match prior PB result**: 295 trades, +99.94%, 19.60% DD, 61.7% WR, 5 losing weeks
3. **SC and SE MUST produce exactly 360 trades** (36 per week × 10 weeks)
4. All returns are ADR-normalized using `getTargetAdrPct()` and `getAdrPct()`
5. Tier A individual quality should match prior: ~30 fills, ~+7.54%, ~70.0% WR

If S1 baseline or SA numbers don't match the expected values above, STOP and investigate. Do NOT proceed with divergent baselines.

---

## Important Warnings

1. **Use `getAggregatesForWeekStartWithBackfill` for ALL sentiment loading.** This is the canonical app/engine path. Do NOT use `getAggregatesAsOf` — that produces incorrect baselines.

2. **`sentimentS1()` is the baseline.** Copy it exactly from `research-sentiment-persistence.ts`. It handles flips → crowding → null.

3. **ADR normalization is mandatory.** Use `getTargetAdrPct()` and `getAdrPct()` exactly as in the prior script.

4. **Tier F ALWAYS returns a direction.** It is the guaranteed closer. Test that SC and SE both produce 360/360.

5. **Tier R fires on `sentIsNeutral` only** (has data, S1 returns null). It does NOT fire on pairs that already have an S1 direction.

6. **File header standard applies.** Use the Freedom_EXE header format.

7. **The output file is `docs/SENTIMENT_FULL_RESOLVER_RESEARCH_2026-04-05.md`.** Overwrite if it exists.

8. **Do NOT modify any files in `src/`.** This is a research script only.

9. **Do NOT modify any existing research scripts.** Create a new file.

---

## Files

| File | Action |
|------|--------|
| `scripts/research-sentiment-full-resolver.ts` | CREATE — new research script |
| `docs/SENTIMENT_FULL_RESOLVER_RESEARCH_2026-04-05.md` | CREATE — output (generated by script) |

**One new file created. No existing files modified.**
