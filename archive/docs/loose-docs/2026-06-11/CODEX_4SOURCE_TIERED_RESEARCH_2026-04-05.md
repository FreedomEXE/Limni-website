# CODEX: 4-Source Weighted Tiered Research

**Date:** 2026-04-05
**Goal:** Research weighted scoring tiered systems using all 4 sources with fixed coarse weights. Find a tiered system that is structurally different from agreement (not just vote-counting with labels).

**Context:** With all 4 sources at 36/36, the old 3-source tiered systems collapsed into agreement because every pair has 3 non-null votes, making Tier 3 (single vote) impossible. Weighted scoring solves this: votes are not equal, so 2v2 ties resolve based on combined weight rather than being skipped or coin-flipped.

**Key prior results:**
- agree_3of4 skip-all-ties baseline: 244 trades, +85.36%, 7.61% DD, 60.7% WR, 3 losing weeks
- agree_3of4 selective-ties live benchmark: 268 trades, +98.14%, 17.42% DD, 61.2% WR, 3 losing weeks
- 2v2 ties are 32.2% of pair-weeks (116/360)
- D+C vs Se+St ties: sentiment side won (+12.77%)
- Standalone performance: Dealer +96.51%, Strength +91.35%, Sentiment +73.16%, Commercial +38.78%

---

## Architecture

Follow the same architecture as `research-4source-agreement.ts`:
- Load all backtestable weeks from `listDataSectionWeeks()`, filter to weeks before current week
- For each week: load weekly pair returns, ADR map
- For each week: load all 4 source directions via `getCanonicalBasketWeek()` from `basketSource.ts`
- ADR-normalize all returns: `returnPct * (targetAdr / pairAdr)` where `targetAdr = getTargetAdrPct()`
- Compute weighted scores for each weight pack
- Assign tiers based on score thresholds
- Render markdown tables to output file

**CRITICAL:** Load source directions from `getCanonicalBasketWeek()` — the same canonical path the app uses.

---

## Script: `scripts/research-4source-tiered.ts`

Create a NEW script file. Do NOT modify any existing scripts.

Output file: `docs/4SOURCE_TIERED_RESEARCH_2026-04-05.md`

---

## Imports

```typescript
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { writeFileSync } from "node:fs";
import { DateTime } from "luxon";
import { listDataSectionWeeks } from "../src/lib/dataSectionWeeks";
import { getWeeklyPairReturns } from "../src/lib/pairReturns";
import { getAdrPct, getTargetAdrPct, loadWeeklyAdrMap } from "../src/lib/performance/adrLookup";
import { getCanonicalBasketWeek, filterByModel, nonNeutralSignals } from "../src/lib/performance/basketSource";
import { PAIRS_BY_ASSET_CLASS } from "../src/lib/cotPairs";
import type { AssetClass } from "../src/lib/cotMarkets";
import { getDisplayWeekOpenUtc, normalizeWeekOpenUtc } from "../src/lib/weekAnchor";
```

---

## Data Loading

Identical to the agreement research script. For each backtestable week:

```typescript
const basket = await getCanonicalBasketWeek(weekOpenUtc);

const dealerSignals = nonNeutralSignals(filterByModel(basket, "dealer"));
const commercialSignals = nonNeutralSignals(filterByModel(basket, "commercial"));
const sentimentSignals = nonNeutralSignals(filterByModel(basket, "sentiment"));
const strengthSignals = nonNeutralSignals(filterByModel(basket, "strength"));

const dealerMap = new Map(dealerSignals.map(s => [s.symbol.toUpperCase(), s.direction]));
const commMap = new Map(commercialSignals.map(s => [s.symbol.toUpperCase(), s.direction]));
const sentMap = new Map(sentimentSignals.map(s => [s.symbol.toUpperCase(), s.direction]));
const strMap = new Map(strengthSignals.map(s => [s.symbol.toUpperCase(), s.direction]));
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

  dealer: Direction | null;
  commercial: Direction | null;
  sentiment: Direction | null;
  strength: Direction | null;
};
```

---

## Weighted Scoring System

### How scoring works

Each source gets a fixed weight. For each pair, compute a weighted score:

```typescript
function computeWeightedScore(
  row: Row,
  weights: WeightPack,
): number {
  let score = 0;
  if (row.dealer === "LONG") score += weights.dealer;
  else if (row.dealer === "SHORT") score -= weights.dealer;

  if (row.commercial === "LONG") score += weights.commercial;
  else if (row.commercial === "SHORT") score -= weights.commercial;

  if (row.sentiment === "LONG") score += weights.sentiment;
  else if (row.sentiment === "SHORT") score -= weights.sentiment;

  if (row.strength === "LONG") score += weights.strength;
  else if (row.strength === "SHORT") score -= weights.strength;

  return score;
}
```

Direction = sign of score. Tier = magnitude bucket:

```typescript
function resolveWeightedTiered(
  row: Row,
  weights: WeightPack,
  thresholds: TierThresholds,
): { direction: Direction | null; tier: number | null; score: number } {
  const score = computeWeightedScore(row, weights);
  const absScore = Math.abs(score);

  if (absScore >= thresholds.tier1) {
    return { direction: score > 0 ? "LONG" : "SHORT", tier: 1, score };
  }
  if (absScore >= thresholds.tier2) {
    return { direction: score > 0 ? "LONG" : "SHORT", tier: 2, score };
  }
  if (absScore > thresholds.skip) {
    return { direction: score > 0 ? "LONG" : "SHORT", tier: 3, score };
  }
  return { direction: null, tier: null, score }; // skip
}
```

### Weight Packs

```typescript
type WeightPack = {
  id: string;
  label: string;
  dealer: number;
  commercial: number;
  sentiment: number;
  strength: number;
};

const WEIGHT_PACKS: WeightPack[] = [
  { id: "W1", label: "D=2.0 St=1.5 Se=1.25 C=0.75", dealer: 2.0, strength: 1.5, sentiment: 1.25, commercial: 0.75 },
  { id: "W2", label: "D=2.0 St=1.5 Se=1.5 C=0.5",   dealer: 2.0, strength: 1.5, sentiment: 1.5,  commercial: 0.5 },
  { id: "W3", label: "D=1.75 St=1.5 Se=1.5 C=0.75",  dealer: 1.75, strength: 1.5, sentiment: 1.5, commercial: 0.75 },
];
```

### Tier Thresholds

```typescript
type TierThresholds = {
  tier1: number;  // score >= this → Tier 1
  tier2: number;  // score >= this → Tier 2
  skip: number;   // score > this → Tier 3; score <= this → skip
};

const TIER_THRESHOLDS: TierThresholds = {
  tier1: 4.0,
  tier2: 2.0,
  skip: 0,   // score of exactly 0 → skip; any non-zero score → at least Tier 3
};
```

Note: a score of exactly 0 means the weighted votes perfectly cancel. This should be rare with asymmetric weights but can happen. These pairs are skipped (no trade).

---

## Strategy Variants to Test

### A. Weighted Tiered (main candidates)

For each weight pack (W1, W2, W3) × one threshold set = 3 variants:
- `tiered_W1`: W1 weights + standard thresholds
- `tiered_W2`: W2 weights + standard thresholds
- `tiered_W3`: W3 weights + standard thresholds

Each variant trades all pairs where `abs(score) > 0`, with tier labels.

### B. Weighted Tiered with Tier 3 Cutoff

Same weight packs but skip Tier 3 (only trade Tier 1 + Tier 2):
- `tiered_W1_t2`: W1 weights, only trade if `abs(score) >= 2.0`
- `tiered_W2_t2`: W2 weights, only trade if `abs(score) >= 2.0`
- `tiered_W3_t2`: W3 weights, only trade if `abs(score) >= 2.0`

This tests whether the weak-lean Tier 3 trades are adding value or dragging results.

### C. Dealer-Led Confirmation (Option C baseline)

Include as a comparison control:

```typescript
function resolveDealerLed(row: Row): { direction: Direction | null; tier: number | null } {
  if (!row.dealer) return { direction: null, tier: null };

  const others = [row.commercial, row.sentiment, row.strength].filter(Boolean) as Direction[];
  const agreeing = others.filter(d => d === row.dealer).length;

  if (agreeing === 3) return { direction: row.dealer, tier: 1 }; // all 4 agree
  if (agreeing === 2) return { direction: row.dealer, tier: 2 }; // dealer + 2
  if (agreeing === 1) return { direction: row.dealer, tier: 3 }; // dealer + 1
  // agreeing === 0: dealer alone vs all 3 opposing → skip
  return { direction: null, tier: null };
}
```

### D. Reference Baselines

Include for comparison:
- `agree_3of4_skip`: 3+ of 4 agree, skip ties (original 4-source agreement baseline)
- `agree_3of4_selective`: 3+ of 4 agree, plus only D+C vs Se+St ties resolved to the Se+St side (current live agreement benchmark)
- `dealer_standalone`: dealer direction only

---

## Score Distribution Diagnostic

Before computing results, generate a diagnostic showing how scores distribute:

For each weight pack, count how many pair-weeks fall into each score band:

```typescript
type ScoreBand = {
  label: string;
  minAbs: number;  // inclusive
  maxAbs: number;  // exclusive (use Infinity for last)
  count: number;
  pctOfTotal: number;
};

// Bands relative to the tier thresholds
// Tier 1: abs >= 4.0
// Tier 2: 2.0 <= abs < 4.0
// Tier 3: 0 < abs < 2.0
// Skip: abs = 0
```

Report per weight pack:

```
| Weight Pack | Tier 1 (≥4.0) | Tier 2 (2.0-3.99) | Tier 3 (0.01-1.99) | Skip (0) | Total |
```

Also per weight pack, show the min/max/mean absolute score across all pair-weeks to verify the threshold bands make sense.

---

## Per-Tier Performance Diagnostic

For each weight pack, report the performance of each tier INDEPENDENTLY:

```
## Tier Performance: {Weight Pack}

| Tier | Trades | Total% | Avg% | Win% |
| --- | ---: | ---: | ---: | ---: |
| 1 (score ≥ 4.0) | ... |
| 2 (score 2.0-3.99) | ... |
| 3 (score 0.01-1.99) | ... |
```

This is the most important diagnostic. If Tier 3 is negative, cutting it improves the book. If Tier 1 is massively positive, it validates the scoring hierarchy.

---

## Output Format

Write to `docs/4SOURCE_TIERED_RESEARCH_2026-04-05.md`.

### Section 1: Header

```markdown
# 4-Source Weighted Tiered Research

Weeks analyzed: {N} ({first week label} -> {last week label}).
Universe: 36 pairs × {N} weeks = {total} possible pair-weeks.
Data loader: getCanonicalBasketWeek (canonical app/engine path).
All returns ADR-normalized.
```

### Section 2: Score Distribution

```markdown
## Score Distribution

| Weight Pack | Tier 1 (≥4.0) | Tier 2 (2.0-3.99) | Tier 3 (0.01-1.99) | Skip (0) | Total |
| --- | ---: | ---: | ---: | ---: | ---: |
| W1 | ... |
| W2 | ... |
| W3 | ... |

### Score Statistics

| Weight Pack | Min Abs | Max Abs | Mean Abs |
| --- | ---: | ---: | ---: |
```

### Section 3: Per-Tier Performance

For each weight pack:

```markdown
## Tier Performance: W1

| Tier | Trades | Total% | Avg% | Win% |
| --- | ---: | ---: | ---: | ---: |
| 1 (score ≥ 4.0) | ... |
| 2 (score 2.0-3.99) | ... |
| 3 (score 0.01-1.99) | ... |
```

### Section 4: Full Variant Results

For EACH variant (weighted W1/W2/W3 full + T2-only, dealer-led, both agreement baselines, dealer standalone), show per-asset-class breakdown:

```markdown
### {Variant Label}

| Asset Class | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| fx | ... |
| indices | ... |
| crypto | ... |
| commodities | ... |
| combined | ... |
```

### Section 5: Master Comparison (sorted by Losing Wks ASC, then Total% DESC)

```markdown
## Master Comparison

| Strategy | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage | Trades/Wk |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
```

Include ALL variants plus baselines. Sorted by Losing Wks ASC, then Total% DESC.

### Section 6: Per-Week Coverage

```markdown
## Per-Week Coverage

| Week | W1 Full | W1 T2 | W2 Full | W2 T2 | W3 Full | W3 T2 | Dealer-Led | agree_3of4 skip | agree_3of4 selective |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
```

---

## Validation

Run:
```bash
npx tsx scripts/research-4source-tiered.ts
```

Verify:
1. **agree_3of4 skip baseline MUST match**: 244 trades, +85.36%, 7.61% DD, 60.7% WR, 3 losing weeks
2. **agree_3of4 selective live benchmark MUST match**: 268 trades, +98.14%, 17.42% DD, 61.2% WR, 3 losing weeks
3. **Dealer standalone MUST match**: 360 trades, +96.51%, 0.00% DD, 57.8% WR, 0 losing weeks
4. **Score distribution should sum to 360** for each weight pack
5. **Tier 1 count should roughly match agree_4of4 count** (~77) since 4-0 unanimous scores should produce the highest weights
6. All returns are ADR-normalized
7. Full weighted variants (W1/W2/W3) should have very few or zero skips (score = exactly 0 is rare with asymmetric weights)

If baselines don't match, STOP and investigate.

---

## Important Warnings

1. **Use `getCanonicalBasketWeek()` for ALL source direction loading.** Do NOT re-derive from raw data.

2. **ADR normalization is mandatory.**

3. **The per-tier performance diagnostic is the most important output.** If Tier 1 isn't clearly the best tier, the scoring hierarchy isn't working.

4. **Score = 0 should be very rare.** With asymmetric weights (e.g., D=2.0, C=0.75), exact cancellation requires specific vote combinations. If more than ~5 rows have score=0 for any weight pack, report the exact vote patterns that cause it.

5. **File header standard applies.** Use the Freedom_EXE header format.

6. **Do NOT modify any files in `src/`.** This is a research script only.

7. **Do NOT modify any existing research scripts.**

---

## Files

| File | Action |
|------|--------|
| `scripts/research-4source-tiered.ts` | CREATE — new research script |
| `docs/4SOURCE_TIERED_RESEARCH_2026-04-05.md` | CREATE — output (generated by script) |

**One new file created. No existing files modified.**
