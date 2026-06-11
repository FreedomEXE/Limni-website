# CODEX: Selector Commercial Fragility Formula Research

**Date:** 2026-04-06
**Goal:** Test concrete selector formulas that use commercial as a fragility/confidence layer. Find a shippable selector formula that integrates all 4 sources — where commercial's role is identifying fragile trades, not choosing direction.

**Prior research:** `docs/COMMERCIAL_CONTEXT_RESEARCH_2026-04-06.md`

**Key findings from context research:**
- Commercial fragility score (0-3) predicts trade quality with clean monotonic decline:
  - Score 0: 58 trades, +0.57% avg, 63.8% WR, 1.43% DD
  - Score 1: 143 trades, +0.29% avg, 55.9% WR
  - Score 2: 144 trades, +0.18% avg, 50.0% WR
  - Score 3: 15 trades, -0.56% avg, 40.0% WR
- Delta-persistence is the strongest individual tag: "building_against" has 5 losing weeks, 48.1% WR
- Opposition alone is too blunt (218 trades, still net positive)
- Baseline: 360 trades, +91.96%, 4.01% DD, 54.2% WR, 1 losing week

**Fragility score components:**
- Commercial opposed to selector direction: +1
- Commercial extremity high (≥0.7): +1
- Commercial flow building against selector direction (score delta > 0.05 in opposing direction): +1

---

## Architecture

This script:
1. Runs the canonical selector baseline through the REAL engine audit path
2. For each trade, computes the commercial fragility score (same logic as context research)
3. Applies each variant formula to decide: trade or skip
4. Computes full stats per variant
5. Outputs comparison report

**CRITICAL:** Use `resolveSelectorStrengthTiebreakAudit()` for baseline. Use `buildContextForWeek()` for commercial context (current + prior week). This is the same data loading as `research-commercial-context.ts` — copy that pattern exactly.

---

## Script: `scripts/research-selector-fragility.ts`

Create a NEW script file. Do NOT modify any existing scripts.

Output file: `docs/SELECTOR_FRAGILITY_RESEARCH_2026-04-06.md`

---

## Imports

Same as `research-commercial-context.ts`:

```typescript
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { writeFileSync } from "node:fs";
import { DateTime } from "luxon";

import { listDataSectionWeeks } from "../src/lib/dataSectionWeeks";
import { getWeeklyPairReturns } from "../src/lib/pairReturns";
import { getAdrPct, getTargetAdrPct, loadWeeklyAdrMap } from "../src/lib/performance/adrLookup";
import {
  buildContextForWeek,
  buildPairUniverse,
  loadCotHistory,
  loadSentimentHistory,
  resolveSelectorStrengthTiebreakAudit,
  type Direction,
  type PairContext,
  type PairDefWithAsset,
  type SelectorDirectionalState,
  type SourceMetrics,
} from "../src/lib/performance/selectorEngine";
import type { AssetClass } from "../src/lib/cotMarkets";
import { normalizeWeekOpenUtc, getDisplayWeekOpenUtc } from "../src/lib/weekAnchor";
```

---

## Data Loading

Identical to `research-commercial-context.ts`:

```typescript
async function main() {
  const currentWeek = normalizeWeekOpenUtc(getDisplayWeekOpenUtc());
  const allWeeks = (await listDataSectionWeeks())
    .filter((week) => normalizeWeekOpenUtc(week) < currentWeek);
  const weeks = allWeeks.slice(-10);

  const baselineAudits = await Promise.all(
    weeks.map((week) => resolveSelectorStrengthTiebreakAudit(week)),
  );
  const baselineByWeek = new Map(baselineAudits.map((audit) => [audit.weekOpenUtc, audit]));

  const [cotHistory, sentimentBySymbol] = await Promise.all([
    loadCotHistory(),
    loadSentimentHistory(),
  ]);
  const universe = buildPairUniverse();

  const contextsByWeek = new Map<string, Map<string, PairContext>>();
  const weeksToLoad = [...weeks];
  const firstWeekIndex = allWeeks.indexOf(weeks[0]!);
  if (firstWeekIndex > 0) {
    weeksToLoad.unshift(allWeeks[firstWeekIndex - 1]!);
  }

  for (const weekOpenUtc of weeksToLoad) {
    const contexts = await buildContextForWeek(
      weekOpenUtc,
      universe as PairDefWithAsset[],
      cotHistory,
      sentimentBySymbol,
      allWeeks,
      { requireStrength: true },
    );
    contextsByWeek.set(weekOpenUtc, contexts);
  }

  // ... variant testing below
}
```

---

## Fragility Score Computation

Copy the exact tagging logic from `research-commercial-context.ts`:

```typescript
function scoreToDir(score: number): SelectorDirectionalState {
  return Math.abs(score) <= 0.000001 ? "NEUTRAL" : score >= 0 ? "LONG" : "SHORT";
}

function computeFragilityScore(
  selectorDirection: Direction,
  commercial: SourceMetrics,
  prevCommercial: SourceMetrics | null,
): { score: number; opposed: boolean; highExtremity: boolean; buildingAgainst: boolean } {
  const commDir = scoreToDir(commercial.score);

  // Flag 1: Commercial opposes selector direction
  const opposed = commDir !== "NEUTRAL" && commDir !== selectorDirection;

  // Flag 2: Commercial extremity high
  const highExtremity = commercial.extremity >= 0.7;

  // Flag 3: Delta-persistence building against
  let buildingAgainst = false;
  if (prevCommercial !== null) {
    const scoreDelta = commercial.score - prevCommercial.score;
    const selectorIsLong = selectorDirection === "LONG";
    buildingAgainst = selectorIsLong ? scoreDelta < -0.05 : scoreDelta > 0.05;
  }

  const score = (opposed ? 1 : 0) + (highExtremity ? 1 : 0) + (buildingAgainst ? 1 : 0);
  return { score, opposed, highExtremity, buildingAgainst };
}
```

---

## Variants to Test

8 variants total:

```typescript
type VariantId =
  | "baseline"
  | "skip_score_3"
  | "skip_score_2_3"
  | "skip_building_against"
  | "skip_building_against_opposed"
  | "skip_high_extremity_opposed"
  | "skip_score_1_2_3"
  | "skip_opposed_and_building_against";
```

### Variant Definitions

**1. `baseline`** — No changes. All 360 trades.

**2. `skip_score_3`** — Skip only when all 3 flags fire (opposed + high extremity + building against). Surgical: removes ~15 trades.

**3. `skip_score_2_3`** — Skip when 2+ flags fire. More aggressive: removes ~159 trades.

**4. `skip_building_against`** — Skip when commercial flow is building against selector direction (regardless of other flags). Removes ~79 trades. Tests delta-persistence as sole filter.

**5. `skip_building_against_opposed`** — Skip when BOTH building_against AND opposed. The strongest cross-tab combination from context research (49 trades, 42.9% WR).

**6. `skip_high_extremity_opposed`** — Skip when BOTH high extremity AND opposed. Tests extremity as the gate (118 trades in context research).

**7. `skip_score_1_2_3`** — Only keep score 0 trades. Very aggressive: keeps only ~58 trades. Tests ceiling of fragility filtering.

**8. `skip_opposed_and_building_against`** — Skip when opposed OR building_against (either flag). Broadest single-tag filter.

### Variant Logic

```typescript
function shouldSkip(
  variant: VariantId,
  fragility: ReturnType<typeof computeFragilityScore>,
): boolean {
  switch (variant) {
    case "baseline":
      return false;
    case "skip_score_3":
      return fragility.score >= 3;
    case "skip_score_2_3":
      return fragility.score >= 2;
    case "skip_building_against":
      return fragility.buildingAgainst;
    case "skip_building_against_opposed":
      return fragility.buildingAgainst && fragility.opposed;
    case "skip_high_extremity_opposed":
      return fragility.highExtremity && fragility.opposed;
    case "skip_score_1_2_3":
      return fragility.score >= 1;
    case "skip_opposed_and_building_against":
      return fragility.opposed || fragility.buildingAgainst;
  }
}
```

---

## Trade Processing Loop

For each week, for each audit entry with non-NEUTRAL direction:

```typescript
const TARGET_ADR = getTargetAdrPct();

type TradeRow = {
  weekOpenUtc: string;
  pair: string;
  assetClass: AssetClass;
  direction: Direction;
  returnPct: number; // ADR-normalized, directed
  fragilityScore: number;
  opposed: boolean;
  highExtremity: boolean;
  buildingAgainst: boolean;
};

const allTrades: TradeRow[] = [];

for (const week of weeks) {
  const audit = baselineByWeek.get(week)!;
  const contexts = contextsByWeek.get(week)!;
  const prevWeekIndex = allWeeks.indexOf(week);
  const prevWeek = prevWeekIndex > 0 ? allWeeks[prevWeekIndex - 1]! : null;
  const prevContexts = prevWeek ? contextsByWeek.get(prevWeek) ?? null : null;
  const pairReturns = await getWeeklyPairReturns(week);
  const returnBySymbol = new Map(pairReturns.map((r) => [r.symbol.toUpperCase(), r]));
  const adrMap = await loadWeeklyAdrMap(week);

  for (const entry of audit.entries) {
    if (entry.finalDirection === "NEUTRAL") continue;
    const pair = entry.pair.toUpperCase();
    const priceRow = returnBySymbol.get(pair);
    const context = contexts.get(pair);
    if (!priceRow || !context) continue;

    const pairAdr = getAdrPct(adrMap, pair, entry.assetClass);
    const rawReturn = entry.finalDirection === "SHORT" ? -priceRow.returnPct : priceRow.returnPct;
    const adrReturn = rawReturn * (TARGET_ADR / pairAdr);

    const prevCommercial = prevContexts?.get(pair)?.commercial ?? null;
    const fragility = computeFragilityScore(
      entry.finalDirection,
      context.commercial,
      prevCommercial,
    );

    allTrades.push({
      weekOpenUtc: week,
      pair,
      assetClass: entry.assetClass,
      direction: entry.finalDirection,
      returnPct: adrReturn,
      fragilityScore: fragility.score,
      opposed: fragility.opposed,
      highExtremity: fragility.highExtremity,
      buildingAgainst: fragility.buildingAgainst,
    });
  }
}
```

Then for each variant, filter trades:

```typescript
for (const variant of variants) {
  const kept = allTrades.filter((t) => {
    const fragility = {
      score: t.fragilityScore,
      opposed: t.opposed,
      highExtremity: t.highExtremity,
      buildingAgainst: t.buildingAgainst,
    };
    return !shouldSkip(variant, fragility);
  });
  // compute stats on `kept`
}
```

---

## Statistics Computation

For each variant:

```typescript
type VariantStats = {
  id: VariantId;
  label: string;
  trades: number;
  totalReturnPct: number;
  maxDrawdownPct: number;
  winRatePct: number;
  losingWeeks: number;
  tradesPerWeek: number;
  skippedTrades: number;
  skippedReturnPct: number; // total return of skipped trades
  skippedWinRatePct: number;
  byAssetClass: Record<string, { trades: number; totalReturnPct: number; winRatePct: number }>;
};
```

Weekly drawdown: sum returns per week for kept trades, compute peak-to-trough.

**Skipped trade stats are critical** — they show whether the filter is removing bad trades (low WR, negative return) or accidentally removing good ones.

---

## Output Format

Write to `docs/SELECTOR_FRAGILITY_RESEARCH_2026-04-06.md`.

### Section 1: Header

```markdown
# Selector Fragility Formula Research

Weeks analyzed: {N} ({first week label} -> {last week label}).
Baseline: canonical selector strength_tiebreak.
All returns ADR-normalized.

Fragility score = commercial opposed (+1) + high extremity (+1) + building against (+1).
```

### Section 2: Master Comparison

```markdown
## Master Comparison

| Variant | Trades | Skipped | Total% | MaxDD% | Win% | Losing Wks | Trades/Wk | Skipped Return | Skipped WR |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
```

Sorted by Losing Wks ASC, then Total% DESC.

**Include "Skipped Return" and "Skipped WR" columns** — this shows the quality of removed trades. If skipped trades have low WR and low/negative return, the filter is working. If skipped trades have good returns, the filter is destroying value.

### Section 3: Asset Breakdown

For each variant:

```markdown
### {Variant Label}

| Asset Class | Trades | Total% | Win% |
| --- | ---: | ---: | ---: |
| fx | ... |
| crypto | ... |
| indices | ... |
| commodities | ... |
```

### Section 4: Skipped Trade Analysis

For the top 3 most promising variants (best by losing weeks, then DD):

```markdown
## Skipped Trades: {variant}

| Week | Pair | Direction | Return% | Fragility | Opposed | High Ext | Building Against |
| --- | --- | --- | ---: | ---: | --- | --- | --- |
```

Show every skipped trade so we can audit the filter's decisions.

### Section 5: Per-Week Profile

```markdown
## Per-Week Profile

| Week | Baseline Trades | Baseline Return | {variant1} Trades | {variant1} Return | {variant2} Trades | {variant2} Return |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
```

Show for baseline + top 3 variants. This reveals whether the variant smooths weekly returns or creates new losing weeks.

---

## Variant Labels

```typescript
const VARIANT_LABELS: Record<VariantId, string> = {
  baseline: "Baseline strength_tiebreak",
  skip_score_3: "Skip fragility 3",
  skip_score_2_3: "Skip fragility 2-3",
  skip_building_against: "Skip building_against",
  skip_building_against_opposed: "Skip building_against + opposed",
  skip_high_extremity_opposed: "Skip high_extremity + opposed",
  skip_score_1_2_3: "Skip fragility 1-2-3 (score 0 only)",
  skip_opposed_and_building_against: "Skip opposed OR building_against",
};
```

---

## Validation

Run:
```bash
npx tsx scripts/research-selector-fragility.ts
```

Verify:
1. **Baseline MUST match**: 360 trades, +91.96%, 4.01% DD, 54.2% WR, 1 losing week
2. **Fragility score distribution MUST match context research**: score 0 = 58, score 1 = 143, score 2 = 144, score 3 = 15
3. **skip_score_3 should remove exactly 15 trades**
4. **skip_score_2_3 should remove exactly 159 trades** (144 + 15)
5. **All returns are ADR-normalized**
6. **Skipped trade returns must sum correctly**: baseline total = kept total + skipped total

If baseline doesn't match, STOP and investigate.

---

## Important Warnings

1. **Use `resolveSelectorStrengthTiebreakAudit()` for baseline.** Real engine path only.

2. **Commercial context comes from `buildContextForWeek()`.** For delta-persistence, load the week before the first test week.

3. **The fragility score is computed AFTER the selector makes its direction decision.** It does not change direction — it decides whether to trade at all.

4. **Skipped trade analysis is as important as kept trade analysis.** A filter that removes profitable trades is destroying value even if it improves WR.

5. **The `no_prior` delta-persistence case (first week):** Treat `buildingAgainst` as false when no prior week data exists. This means first-week trades can only have fragility score 0-2, never 3.

6. **File header standard applies.** Use the Freedom_EXE header format.

7. **Do NOT modify any files in `src/`.** This is a research script only.

8. **Do NOT modify any existing research scripts.**

---

## What We're Looking For

The ideal variant:
- Removes fewer trades (surgical, not aggressive)
- Removed trades are net-negative or near-zero (filter targets bad trades)
- Improves or maintains losing weeks (≤1)
- Reduces DD while keeping most of the return
- Doesn't create new losing weeks

If `skip_score_3` removes 15 net-negative trades and keeps 1 losing week, that's probably the ship candidate.

If `skip_building_against_opposed` removes ~49 trades with ~42.9% WR and improves DD significantly, that's also strong.

If all skip variants create more losing weeks than baseline, the fragility score is better used as a confidence tag for sizing rather than a skip filter.

---

## Files

| File | Action |
|------|--------|
| `scripts/research-selector-fragility.ts` | CREATE — new research script |
| `docs/SELECTOR_FRAGILITY_RESEARCH_2026-04-06.md` | CREATE — output (generated by script) |

**One new file created. No existing files modified.**
