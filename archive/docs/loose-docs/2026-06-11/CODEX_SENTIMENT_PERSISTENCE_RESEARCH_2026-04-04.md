# CODEX: Sentiment Persistence-First Resolver Research

**Date:** 2026-04-04
**Goal:** Research persistence-first neutral resolver stacks for sentiment. Previous research proved that threshold-based resolvers (60/40, 53/47, 51/49) hurt quality, while persistence (55/45 two-week avg) was the ONLY positive resolver tier (+1.78%, 56.8% WR, 44 fills). This pass builds on that finding.

**Prior research showed:**
- S1 baseline: 229/360, +28.49%, 19.56% DD, 56.8% WR, 5 losing weeks
- 87 neutral-with-data pair-weeks, 44 no-data pair-weeks
- Data ceiling: 316/360 (87.8%)
- Only positive resolver tier: Tier 2 persistence (55/45 avg), +1.78%, 56.8% WR, 44 fills
- All threshold-based tiers hurt: 60/40 (-0.27%), soft fade (-15.00%), forced lean (-14.48%)

**Key question:** Can persistence fill MORE of the 87 neutral-with-data gaps, and can carry-forward fill the 44 no-data gaps, without destroying quality?

**What this script tests:**
1. Individual tier quality for 6 persistence-flavored tiers
2. 7 stacks that combine tiers in different orders
3. Breakdown by asset class
4. Comparison table for easy decision-making

---

## Script: `scripts/research-sentiment-persistence.ts`

Create a NEW script file. Do NOT modify `research-neutral-resolvers.ts` — that stays as-is.

Output file: `docs/SENTIMENT_PERSISTENCE_RESEARCH_2026-04-04.md`

---

## Architecture

Follow the EXACT same architecture as `scripts/research-neutral-resolvers.ts`:
- Load all backtestable weeks from `listDataSectionWeeks()`, filter to weeks before current week
- For each week: load weekly pair returns, ADR map, current sentiment (via `getAggregatesAsOf`), and strength data is NOT needed
- Build a flat `Row[]` array with one entry per pair-week
- ADR-normalize all returns: `returnPct * (targetAdr / pairAdr)` where `targetAdr = getTargetAdrPct()`
- Compute S1 baseline direction using `sentimentS1()` — same function as in the prior script
- Compute tier results for neutrals only
- Compute stacks by trying tiers in order
- Render markdown tables to output file

**Copy these utility functions from `research-neutral-resolvers.ts` exactly:**
- `weekLabel`, `round`, `signedPct`, `computeMedian`, `directionalReturn`, `computeMaxDd`
- `sentimentS1` (the S1 baseline function)
- `computeSimpleMethodStats`, `computeTierQualityStats`
- The `StackStats` computation pattern and rendering functions
- The `Row` type (simplified — no strength fields needed)

**Imports needed:**
```typescript
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { writeFileSync } from "node:fs";
import { DateTime } from "luxon";
import { listDataSectionWeeks } from "../src/lib/dataSectionWeeks";
import { getWeeklyPairReturns } from "../src/lib/pairReturns";
import { getAdrPct, getTargetAdrPct, loadWeeklyAdrMap } from "../src/lib/performance/adrLookup";
import { getAggregatesAsOf } from "../src/lib/sentiment/store";
import type { SentimentAggregate } from "../src/lib/sentiment/types";
import { PAIRS_BY_ASSET_CLASS } from "../src/lib/cotPairs";
import type { AssetClass } from "../src/lib/cotMarkets";
import { getDisplayWeekOpenUtc, normalizeWeekOpenUtc } from "../src/lib/weekAnchor";
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
  priorAgg: SentimentAggregate | null;
  priorS1: Direction | null;
  priorLongPct: number | null;

  // 2-week-back data
  prior2Agg: SentimentAggregate | null;
  prior2S1: Direction | null;
  prior2LongPct: number | null;

  // Tier results (computed for neutrals only)
  tiers: PersistenceTiers | null;
};

type PersistenceTiers = {
  tierA: Direction | null;  // Prior-week S1 direction carry
  tierB: Direction | null;  // Same-side persistence (55/45 avg) — existing Tier 2
  tierC: Direction | null;  // Same-side persistence (any agreement, no threshold)
  tierD: Direction | null;  // Mild crowding 60/40 — existing Tier 1
  tierE: Direction | null;  // No-data carry (1 week back, for no-data pairs)
  tierF: Direction | null;  // No-data carry (2 weeks back, for no-data pairs)
};
```

---

## Data Loading

For each week, load sentiment for the current week AND for the 2 prior weeks:

```typescript
for (const rawWeekOpenUtc of weeks) {
  const weekOpenUtc = normalizeWeekOpenUtc(rawWeekOpenUtc) ?? rawWeekOpenUtc;
  const prior1WeekUtc = DateTime.fromISO(weekOpenUtc, { zone: "utc" })
    .minus({ weeks: 1 }).toUTC().toISO() ?? weekOpenUtc;
  const prior2WeekUtc = DateTime.fromISO(weekOpenUtc, { zone: "utc" })
    .minus({ weeks: 2 }).toUTC().toISO() ?? weekOpenUtc;

  const [weeklyReturns, adrMap, currentSentiment, prior1Sentiment, prior2Sentiment] = await Promise.all([
    getWeeklyPairReturns(weekOpenUtc),
    loadWeeklyAdrMap(weekOpenUtc),
    getAggregatesAsOf(weekOpenUtc),
    getAggregatesAsOf(prior1WeekUtc),
    getAggregatesAsOf(prior2WeekUtc),
  ]);

  // Build maps...
  // For each pair in each asset class, build Row
}
```

---

## Tier Definitions

### Tier A: Prior-week S1 direction carry

For neutral-with-data pairs: if the PRIOR week's sentiment had an S1-level direction (crowded or flipped → LONG/SHORT), carry that direction to this week.

**Rationale:** If the crowd was crowded enough to trigger S1 last week, that regime likely persists into the next week even if the raw percentage has moved slightly toward neutral.

```typescript
function tierA_priorS1Carry(row: Row): Direction | null {
  // Only for neutrals WITH data
  if (!row.sentIsNeutral) return null;
  // If prior week had an S1 direction, carry it
  return row.priorS1;
}
```

### Tier B: Same-side persistence (55/45 avg) — existing resolver Tier 2

For neutral-with-data: current AND prior week both lean the same side (both >50 or both <50), AND their 2-week average hits 55/45.

```typescript
function tierB_persistence55(row: Row): Direction | null {
  if (!row.sentIsNeutral || row.aggLongPct === null || row.priorLongPct === null) return null;
  const currentSide = row.aggLongPct > 50 ? "long" : row.aggLongPct < 50 ? "short" : null;
  const priorSide = row.priorLongPct > 50 ? "long" : row.priorLongPct < 50 ? "short" : null;
  if (!currentSide || !priorSide || currentSide !== priorSide) return null;
  const avg = (row.aggLongPct + row.priorLongPct) / 2;
  if (avg >= 55) return "SHORT"; // crowd leans long → fade
  if (avg <= 45) return "LONG";  // crowd leans short → fade
  return null;
}
```

### Tier C: Same-side persistence (any agreement, no threshold)

For neutral-with-data: current AND prior week both lean same side (>50 or <50). Fade the lean. No threshold on the average.

**Rationale:** Tests whether directional agreement alone is enough, without requiring 55/45 extremity.

```typescript
function tierC_persistenceAny(row: Row): Direction | null {
  if (!row.sentIsNeutral || row.aggLongPct === null || row.priorLongPct === null) return null;
  const currentSide = row.aggLongPct > 50 ? "long" : row.aggLongPct < 50 ? "short" : null;
  const priorSide = row.priorLongPct > 50 ? "long" : row.priorLongPct < 50 ? "short" : null;
  if (!currentSide || !priorSide || currentSide !== priorSide) return null;
  // Both lean same side — fade
  return row.aggLongPct > 50 ? "SHORT" : "LONG";
}
```

### Tier D: Mild crowding (60/40) — existing resolver Tier 1

```typescript
function tierD_mildCrowding(row: Row): Direction | null {
  if (!row.sentIsNeutral || row.aggLongPct === null) return null;
  if (row.aggLongPct >= 60) return "SHORT";
  if (row.aggLongPct <= 40) return "LONG";
  return null;
}
```

### Tier E: No-data carry (1 week back)

For pair-weeks with NO sentiment data: if the prior week had an S1 direction for this pair, carry it.

**IMPORTANT:** This tier fires on `!sentHasData`, not `sentIsNeutral`. The existing tiers A-D only fire on neutrals (has data, but S1 = null). Tier E fires on missing data.

```typescript
function tierE_noDataCarry1(row: Row): Direction | null {
  // Only for pairs with NO data this week
  if (row.sentHasData) return null;
  return row.priorS1;
}
```

### Tier F: No-data carry (2 weeks back)

For pair-weeks with NO sentiment data and no prior-week S1: use 2-week-ago S1 direction.

```typescript
function tierF_noDataCarry2(row: Row): Direction | null {
  if (row.sentHasData) return null;
  // Don't fire if priorS1 exists — let Tier E handle that
  if (row.priorS1) return null;
  return row.prior2S1;
}
```

---

## Additional Standalone Tiers to Measure

Also compute quality stats for these standalone measurements (not used in stacks, just for diagnostics):

### Tier G: 2-week-back S1 carry (for neutrals with data)

If current week is neutral with data, AND prior week also didn't have S1 direction, but 2 weeks back DID — carry that.

```typescript
function tierG_deep2WeekCarry(row: Row): Direction | null {
  if (!row.sentIsNeutral) return null;
  if (row.priorS1) return null; // Tier A handles this
  return row.prior2S1;
}
```

### Tier H: Same-side persistence (52/48 avg)

Relaxed threshold variant between 55/45 (Tier B) and any (Tier C).

```typescript
function tierH_persistence52(row: Row): Direction | null {
  if (!row.sentIsNeutral || row.aggLongPct === null || row.priorLongPct === null) return null;
  const currentSide = row.aggLongPct > 50 ? "long" : row.aggLongPct < 50 ? "short" : null;
  const priorSide = row.priorLongPct > 50 ? "long" : row.priorLongPct < 50 ? "short" : null;
  if (!currentSide || !priorSide || currentSide !== priorSide) return null;
  const avg = (row.aggLongPct + row.priorLongPct) / 2;
  if (avg >= 52) return "SHORT";
  if (avg <= 48) return "LONG";
  return null;
}
```

---

## Stack Definitions

These stacks combine tiers in order (first hit wins):

| Stack | Description | Tiers |
|-------|-------------|-------|
| PA | Persistence-only (55/45) | B |
| PB | Prior-S1-carry only | A |
| PC | Persistence-first → 60/40 | B → D |
| PD | Direction-carry → persistence → 60/40 | A → B → D |
| PE | All persistence (no threshold tiers) | A → B → C |
| PF | Full + no-data carry | A → B → D → E → F |
| PG | Max coverage | A → B → C → D → E → F |

**Stack resolution logic** — same pattern as `research-neutral-resolvers.ts`:

```typescript
const STACK_TIERS: Record<StackName, TierName[]> = {
  pa: ["tierB"],
  pb: ["tierA"],
  pc: ["tierB", "tierD"],
  pd: ["tierA", "tierB", "tierD"],
  pe: ["tierA", "tierB", "tierC"],
  pf: ["tierA", "tierB", "tierD", "tierE", "tierF"],
  pg: ["tierA", "tierB", "tierC", "tierD", "tierE", "tierF"],
};
```

**CRITICAL:** For stacks that include Tier E and Tier F (no-data carry-forward), the resolution logic needs to handle BOTH neutral-with-data pairs AND no-data pairs:

```typescript
function resolveStack(row: Row, stack: StackName): { direction: Direction | null; tier: string | null } {
  // If S1 already has a direction, use it (baseline)
  if (row.sentS1) return { direction: row.sentS1, tier: null };

  // For neutrals with data OR no-data pairs, try tiers in order
  const tiers = STACK_TIERS[stack];
  for (const tier of tiers) {
    const direction = row.tiers?.[tier] ?? null;
    if (direction) return { direction, tier };
  }
  return { direction: null, tier: null };
}
```

**NOTE:** Tiers A-D only fire on `sentIsNeutral` (has data, S1 is null). Tiers E-F only fire on `!sentHasData` (no data at all). The tier functions themselves enforce this — the stack resolver just tries them all in order.

---

## Tier Computation in Row Building

When building each Row:

```typescript
// Compute tiers for BOTH neutrals-with-data AND no-data pairs
const isNeutralWithData = sentHasData && sentS1 === null;
const isNoData = !sentHasData;

const tiers: PersistenceTiers | null = (isNeutralWithData || isNoData) ? {
  tierA: tierA_priorS1Carry(row),
  tierB: tierB_persistence55(row),
  tierC: tierC_persistenceAny(row),
  tierD: tierD_mildCrowding(row),
  tierE: tierE_noDataCarry1(row),
  tierF: tierF_noDataCarry2(row),
} : null;
```

Wait — the Row needs to be constructed first with the raw data before tiers can be computed. Build the row first with `tiers: null`, then compute tiers and assign them. Or compute tiers inline during row construction using the raw data directly.

**Simpler approach:** Compute tier values inline during row construction:

```typescript
const row: Row = {
  weekOpenUtc,
  assetClass,
  pair,
  rawReturnPct: ret.rawReturnPct,
  adrMultiplier: ret.adrMultiplier,
  sentS1,
  sentHasData,
  sentIsNeutral,
  aggLongPct: agg?.agg_long_pct ?? null,
  priorAgg: priorAgg ?? null,
  priorS1: sentimentS1(priorAgg),
  priorLongPct: priorAgg?.agg_long_pct ?? null,
  prior2Agg: prior2Agg ?? null,
  prior2S1: sentimentS1(prior2Agg),
  prior2LongPct: prior2Agg?.agg_long_pct ?? null,
  tiers: null, // computed below
};

if (sentIsNeutral || !sentHasData) {
  row.tiers = {
    tierA: tierA_priorS1Carry(row),
    tierB: tierB_persistence55(row),
    tierC: tierC_persistenceAny(row),
    tierD: tierD_mildCrowding(row),
    tierE: tierE_noDataCarry1(row),
    tierF: tierF_noDataCarry2(row),
  };
}
```

---

## Output Format

Write to `docs/SENTIMENT_PERSISTENCE_RESEARCH_2026-04-04.md`.

### Section 1: Header

```markdown
# Sentiment Persistence-First Resolver Research

Weeks analyzed: {N} ({first week label} -> {last week label}).
Universe: 36 pairs × {N} weeks = {total} possible pair-weeks.
```

### Section 2: Gap Analysis

```markdown
## Gap Analysis

- S1 baseline: {trades}/{total} trades
- Neutrals with data: {count} pair-weeks (have sentiment data but S1 returns null)
- Neutrals without data: {count} pair-weeks (no sentiment aggregate exists)
- Data ceiling: {count}/{total} ({pct}%)
```

Also include a per-week gap breakdown table:

```markdown
### Per-Week Gap Breakdown

| Week | S1 Trades | Neutrals (data) | No Data | Total Gaps |
| --- | ---: | ---: | ---: | ---: |
```

### Section 3: Sentiment Data Availability

Same format as prior research — per asset class.

### Section 4: Individual Tier Quality

```markdown
## Individual Tier Quality

| Tier | Fires On | Fills | Total% | Avg% | Win% |
| --- | --- | ---: | ---: | ---: | ---: |
| A: Prior-week S1 carry | neutral w/data | {fills} | {total%} | {avg%} | {win%} |
| B: Persistence (55/45 avg) | neutral w/data | {fills} | {total%} | {avg%} | {win%} |
| C: Persistence (any lean) | neutral w/data | {fills} | {total%} | {avg%} | {win%} |
| D: Mild crowding (60/40) | neutral w/data | {fills} | {total%} | {avg%} | {win%} |
| E: No-data carry (1 week) | no data | {fills} | {total%} | {avg%} | {win%} |
| F: No-data carry (2 weeks) | no data | {fills} | {total%} | {avg%} | {win%} |
| G: Deep 2-week carry | neutral w/data | {fills} | {total%} | {avg%} | {win%} |
| H: Persistence (52/48 avg) | neutral w/data | {fills} | {total%} | {avg%} | {win%} |
```

**"Fires On" column** indicates whether the tier operates on neutral-with-data or no-data pairs.

### Section 5: Stack Results

For each stack (PA through PG):

```markdown
### Stack Results

#### PA: Persistence-only (55/45)

| Asset Class | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| fx | ... |
| indices | ... |
| crypto | ... |
| commodities | ... |
| combined | ... |
| *of which resolver* | {resolved_trades} | {resolved_total%} | — | {resolved_wr%} | — | avg {avg%} |

Tier fills: tierA={n}, tierB={n}, ...
```

### Section 6: Stack Comparison

```markdown
## Stack Comparison

| Stack | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage | Resolver Avg% |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| S1 Baseline (no resolver) | ... | — |
| PA: ... |
| PB: ... |
| ... |
```

### Section 7: No-Data Diagnostic

Include a table showing which asset classes and pairs are most affected by the 44 no-data gaps:

```markdown
## No-Data Diagnostic

| Asset Class | No-Data Pair-Weeks | Total Possible | Gap% |
| --- | ---: | ---: | ---: |
```

And list the specific pairs that most frequently have no data:

```markdown
### Most Frequent No-Data Pairs

| Pair | Weeks Missing | Total Weeks |
| --- | ---: | ---: |
```

---

## Validation

Run:
```bash
npx tsx scripts/research-sentiment-persistence.ts
```

Verify:
1. S1 baseline matches prior research: 229/360, +28.49%, 19.56% DD, 56.8% WR
2. Tier B (persistence 55/45) individual quality matches prior Tier 2: 44 fills, +1.78%, 56.8% WR
3. Tier D (60/40) individual quality matches prior Tier 1: 24 fills, -0.27%, 45.8% WR
4. PA stack output should equal prior SA conservative minus tier1, since PA only uses tierB
5. All returns are ADR-normalized

If baseline numbers don't match, STOP and investigate. Do NOT proceed with divergent baselines.

---

## Important Warnings

1. **Tiers A-D fire ONLY on neutrals-with-data** (`sentIsNeutral === true`). Tiers E-F fire ONLY on no-data pairs (`sentHasData === false`). Never mix these.

2. **`sentimentS1()` is the baseline.** Copy it exactly from `research-neutral-resolvers.ts`. It handles flips → crowding → null.

3. **ADR normalization is mandatory.** Use `getTargetAdrPct()` and `getAdrPct()` exactly as in the prior script.

4. **Use `getAggregatesAsOf(weekOpenUtc)`** for sentiment loading — same as the prior research script. This returns the latest aggregate per symbol before the week open. NOT `getAggregatesForWeekStart` (that's used by the refresh pipeline with different semantics).

5. **2-week lookback:** For prior2 data, use `getAggregatesAsOf(prior2WeekUtc)` where `prior2WeekUtc` is `weekOpenUtc - 2 weeks`. This gives the latest sentiment snapshot as of 2 weeks before the target week open.

6. **File header standard applies.** Use the Freedom_EXE header format.

7. **The output file is `docs/SENTIMENT_PERSISTENCE_RESEARCH_2026-04-04.md`.** Overwrite if it exists.

8. **Do NOT modify any files in `src/`.** This is a research script only.

9. **Do NOT modify `research-neutral-resolvers.ts`.** Create a new file.

10. **Stack PA should reproduce the exact Tier 2 persistence results from the prior research** (44 fills, +1.78%). If it doesn't, something is wrong with the tier function. Debug before continuing.

---

## Files

| File | Action |
|------|--------|
| `scripts/research-sentiment-persistence.ts` | CREATE — new research script |
| `docs/SENTIMENT_PERSISTENCE_RESEARCH_2026-04-04.md` | CREATE — output (generated by script) |

**One new file created. No existing files modified.**
