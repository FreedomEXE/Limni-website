# CODEX: Veto Disagreement Threshold Research

**Date:** 2026-04-06
**Goal:** Test different veto disagreement thresholds on dealer standalone and selector (with fragility-3 skip). Find the optimal threshold — where the selectivity/quality tradeoff is best.

**Context:**
- All 4 sources at 36/36 (360 pair-weeks per source per 10 weeks)
- With 36/36, each pair-week has exactly 4 binary votes (LONG/SHORT), so for any source there are exactly 4 disagreement states: 0, 1, 2, or 3 of the other 3 disagree
- Prior research: 2/4 veto (skip if 2+ disagree) on dealer = 168 trades, +100.47%, 1.48% DD, 67.3% WR, 1 losing week
- Dealer raw: 360 trades, +96.51%, 0.00% DD, 57.8% WR, 0 losing weeks
- Selector baseline: 360 trades, +91.96%, 4.01% DD, 54.2% WR, 1 losing week

**Structural note:** At 36/36 with binary votes:
- 0 disagree = all 4 sources agree (unanimous) → this is 4-of-4 agreement
- 1 disagree = 3 agree, 1 opposes → this is 3-of-4 agreement where the source is in majority
- 2 disagree = 2 agree, 2 oppose → 2-2 tie, source is on one side
- 3 disagree = source alone against 3 → source is the lone dissenter

---

## Architecture

This script:
1. Loads all 4 source directions via `getCanonicalBasketWeek()`
2. For dealer: computes disagreement count per pair-week, tests each threshold
3. For selector: loads baseline directions via `resolveSelectorStrengthTiebreakAudit()`, applies source-disagreement veto at each threshold
4. Also tests the exact-bucket breakdown (performance of each disagreement level independently)
5. Outputs comparison report

**CRITICAL:**
- Use `getCanonicalBasketWeek()` for source directions
- Use `resolveSelectorStrengthTiebreakAudit()` for selector baseline (real engine path)
- ADR-normalize all returns

---

## Script: `scripts/research-veto-threshold.ts`

Create a NEW script file. Do NOT modify any existing scripts.

Output file: `docs/VETO_THRESHOLD_RESEARCH_2026-04-06.md`

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
import {
  resolveSelectorStrengthTiebreakAudit,
  buildContextForWeek,
  buildPairUniverse,
  loadCotHistory,
  loadSentimentHistory,
  type Direction,
  type PairContext,
  type PairDefWithAsset,
  type SourceMetrics,
} from "../src/lib/performance/selectorEngine";
import { PAIRS_BY_ASSET_CLASS } from "../src/lib/cotPairs";
import type { AssetClass } from "../src/lib/cotMarkets";
import { getDisplayWeekOpenUtc, normalizeWeekOpenUtc } from "../src/lib/weekAnchor";
```

---

## Data Loading

### Part A: Base source directions (for dealer veto)

Same as `research-veto-base-source.ts`:

```typescript
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

Load via `getCanonicalBasketWeek()` for each week.

### Part B: Selector directions (for selector veto)

Load selector baseline via `resolveSelectorStrengthTiebreakAudit()` for each week. This gives the canonical selector direction per pair.

Also load commercial context for fragility score computation (same pattern as `research-selector-fragility.ts`):
- Load contexts via `buildContextForWeek()` for current + prior week
- Compute fragility score per trade
- Apply fragility-3 skip first, THEN apply disagreement veto on top

---

## Disagreement Count

For a given trade direction, count how many of the 4 base sources disagree:

```typescript
function countDisagreements(
  tradeDirection: Direction,
  dealer: Direction | null,
  commercial: Direction | null,
  sentiment: Direction | null,
  strength: Direction | null,
): number {
  let disagree = 0;
  if (dealer !== null && dealer !== tradeDirection) disagree += 1;
  if (commercial !== null && commercial !== tradeDirection) disagree += 1;
  if (sentiment !== null && sentiment !== tradeDirection) disagree += 1;
  if (strength !== null && strength !== tradeDirection) disagree += 1;
  return disagree;
}
```

**For dealer standalone:** The trade direction IS dealer's direction. Count disagreements from the other 3 (commercial, sentiment, strength). Range: 0-3.

**For selector:** The trade direction is the selector's final direction (which may differ from any individual source). Count disagreements from ALL 4 sources (dealer, commercial, sentiment, strength). Range: 0-4.

---

## Strategies: Dealer

### Exact Buckets (diagnostic)
- `dealer_bucket_0`: only pairs where 0 of other 3 disagree (all 4 unanimous)
- `dealer_bucket_1`: only pairs where exactly 1 disagrees
- `dealer_bucket_2`: only pairs where exactly 2 disagree
- `dealer_bucket_3`: only pairs where all 3 disagree

### Threshold Variants
- `dealer_raw`: all 360 trades (no veto)
- `dealer_veto_1of3`: skip if 1+ of other 3 disagree → keeps only bucket 0
- `dealer_veto_2of3`: skip if 2+ disagree → keeps buckets 0+1 (current rule)
- `dealer_veto_3of3`: skip if all 3 disagree → keeps buckets 0+1+2

---

## Strategies: Selector

For selector, the trade direction comes from the selector engine (not a single source). Disagreement is counted from ALL 4 base sources against the selector's chosen direction.

### Apply fragility-3 skip first
Before computing disagreement, remove the ~15 trades where fragility score = 3 (commercial opposed + high extremity + building against). This is the `selector_frag3` baseline.

Use the same fragility computation as `research-selector-fragility.ts`:

```typescript
function scoreToDir(score: number): "LONG" | "SHORT" | "NEUTRAL" {
  return Math.abs(score) <= 0.000001 ? "NEUTRAL" : score >= 0 ? "LONG" : "SHORT";
}

function computeFragilityScore(
  selectorDirection: Direction,
  commercial: SourceMetrics,
  prevCommercial: SourceMetrics | null,
): number {
  const commDir = scoreToDir(commercial.score);
  const opposed = commDir !== "NEUTRAL" && commDir !== selectorDirection ? 1 : 0;
  const highExtremity = commercial.extremity >= 0.7 ? 1 : 0;
  let buildingAgainst = 0;
  if (prevCommercial !== null) {
    const scoreDelta = commercial.score - prevCommercial.score;
    const selectorIsLong = selectorDirection === "LONG";
    buildingAgainst = (selectorIsLong ? scoreDelta < -0.05 : scoreDelta > 0.05) ? 1 : 0;
  }
  return opposed + highExtremity + buildingAgainst;
}
```

### Exact Buckets (diagnostic)
After fragility-3 skip, bucket remaining trades by disagreement count (0-4 range since counting all 4 sources):
- `selector_bucket_0`: 0 sources disagree (all 4 agree with selector)
- `selector_bucket_1`: exactly 1 disagrees
- `selector_bucket_2`: exactly 2 disagree
- `selector_bucket_3`: exactly 3 disagree
- `selector_bucket_4`: all 4 disagree (unlikely but check)

### Threshold Variants
- `selector_frag3`: selector with fragility-3 skip, no disagreement veto (~345 trades)
- `selector_frag3_veto_1`: skip if 1+ source disagrees → keeps only unanimous
- `selector_frag3_veto_2`: skip if 2+ disagree
- `selector_frag3_veto_3`: skip if 3+ disagree
- `selector_frag3_veto_4`: skip only if all 4 disagree

---

## Statistics

Same stats structure as prior research:

```typescript
type StrategyStats = {
  id: string;
  label: string;
  trades: number;
  totalReturnPct: number;
  maxDrawdownPct: number;
  winRatePct: number;
  losingWeeks: number;
  tradesPerWeek: number;
  byAssetClass: Record<string, { trades: number; totalReturnPct: number; winRatePct: number }>;
};
```

---

## Output Format

Write to `docs/VETO_THRESHOLD_RESEARCH_2026-04-06.md`.

### Section 1: Header

```markdown
# Veto Disagreement Threshold Research

Weeks analyzed: {N} ({first week label} -> {last week label}).
Data loader: getCanonicalBasketWeek (canonical app/engine path).
All returns ADR-normalized.
```

### Section 2: Dealer Disagreement Distribution

```markdown
## Dealer: Disagreement Distribution

| Disagree Count | Pair-Weeks | Total% | Avg% | Win% | MaxDD% | Losing Wks |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 0 (unanimous) | ... |
| 1 (3-of-4 agree, dealer in majority) | ... |
| 2 (2-2 tie, dealer on one side) | ... |
| 3 (dealer alone) | ... |
```

This is the key diagnostic. Shows the performance gradient by disagreement level.

### Section 3: Dealer Threshold Comparison

```markdown
## Dealer: Threshold Comparison

| Strategy | Trades | Total% | MaxDD% | Win% | Losing Wks | Trades/Wk |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Dealer Raw (no veto) | ... |
| Dealer Veto ≥1 (unanimous only) | ... |
| Dealer Veto ≥2 (current rule) | ... |
| Dealer Veto ≥3 (very permissive) | ... |
```

### Section 4: Dealer Asset Breakdown

For each dealer threshold variant:

```markdown
### {Variant Label}

| Asset Class | Trades | Total% | Win% |
| --- | ---: | ---: | ---: |
```

### Section 5: Selector Disagreement Distribution

```markdown
## Selector: Disagreement Distribution (after frag3 skip)

| Disagree Count | Trades | Total% | Avg% | Win% | MaxDD% | Losing Wks |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 0 (all 4 agree with selector) | ... |
| 1 | ... |
| 2 | ... |
| 3 | ... |
| 4 | ... |
```

### Section 6: Selector Threshold Comparison

```markdown
## Selector: Threshold Comparison

| Strategy | Trades | Total% | MaxDD% | Win% | Losing Wks | Trades/Wk |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Selector frag3 (no disagree veto) | ... |
| Selector frag3 + veto ≥1 | ... |
| Selector frag3 + veto ≥2 | ... |
| Selector frag3 + veto ≥3 | ... |
| Selector frag3 + veto ≥4 | ... |
```

### Section 7: Selector Asset Breakdown

For each selector threshold variant.

### Section 8: Master Comparison

All strategies from both dealer and selector in one table:

```markdown
## Master Comparison

| Strategy | Trades | Total% | MaxDD% | Win% | Losing Wks | Trades/Wk |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
```

Sorted by Losing Wks ASC, then Total% DESC.

### Section 9: Per-Week Profile

```markdown
## Per-Week Profile

| Week | Dealer Raw | Dealer V≥1 | Dealer V≥2 | Dealer V≥3 | Sel frag3 | Sel V≥1 | Sel V≥2 | Sel V≥3 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
```

Show weekly return for each variant.

---

## Validation

Run:
```bash
npx tsx scripts/research-veto-threshold.ts
```

Verify:
1. **Dealer raw MUST match**: 360 trades, +96.51%
2. **Dealer veto ≥2 MUST match prior research**: 168 trades, +100.47%, 1.48% DD, 67.3% WR, 1 losing week
3. **Dealer bucket counts MUST sum to 360**
4. **Selector frag3 MUST match**: ~345 trades, ~+100.39%, 4.01% DD
5. **Selector bucket counts MUST sum to selector frag3 trade count**
6. **All returns are ADR-normalized**

If baselines don't match, STOP and investigate.

---

## Important Warnings

1. **Use `getCanonicalBasketWeek()` for base source directions.** Not selectorEngine's context builder.

2. **Use `resolveSelectorStrengthTiebreakAudit()` for selector baseline.** Real engine path.

3. **For selector disagreement: count against ALL 4 sources, not "other 3".** The selector's direction may differ from all sources — it's a policy engine, not a vote counter. So a selector LONG trade could have 0-4 sources disagreeing.

4. **Apply fragility-3 skip BEFORE disagreement veto on selector.** The pipeline is: selector direction → frag3 skip → disagreement threshold.

5. **For fragility score computation**, load prior-week commercial context via `buildContextForWeek()`. First test week has no prior → fragility score maxes at 2 for those trades.

6. **ADR normalization is mandatory.**

7. **File header standard applies.** Use the Freedom_EXE header format.

8. **Do NOT modify any files in `src/`.** This is a research script only.

9. **Do NOT modify any existing research scripts.**

---

## What We're Looking For

### Dealer
- **Is there a clean gradient?** Does performance improve monotonically as disagreement decreases (bucket 0 > bucket 1 > bucket 2 > bucket 3)?
- **Where's the threshold sweet spot?** Is 2-of-3 still the best, or does 1-of-3 or 3-of-3 produce a better risk/return profile?
- **Does unanimity (veto ≥1) produce a viable selective system?** Small trade count but potentially very high quality.

### Selector
- **How often does the selector trade against 2+ sources?** If frequently, disagreement veto has room to help.
- **Is selector + frag3 + disagreement veto better than selector + frag3 alone?**
- **Does the gradient hold for selector?** Selector follows sentiment policy — it may trade against 2+ sources frequently when sentiment is strong, and those trades might be correct (sentiment-led contrarian).

The most interesting outcome would be if dealer and selector have different optimal thresholds — that would mean disagreement veto should be tuned per system, not one-size-fits-all.

---

## Files

| File | Action |
|------|--------|
| `scripts/research-veto-threshold.ts` | CREATE — new research script |
| `docs/VETO_THRESHOLD_RESEARCH_2026-04-06.md` | CREATE — output (generated by script) |

**One new file created. No existing files modified.**
