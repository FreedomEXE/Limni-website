# CODEX: Commercial Context Tagging Research

**Date:** 2026-04-06
**Goal:** Determine whether commercial positioning can reliably identify fragile/high-quality selector trades through state tagging — WITHOUT changing any selector directions. Pure diagnostic.

**Context:**
Multiple research passes confirmed commercial is NOT a directional signal inside selector:
- Not a voter, not a tiebreak, not a gate, not a weighted tiebreak
- Every variant that gave commercial directional influence degraded results
- Commercial's information content is institutional regime context, not direction

**New hypothesis:** Commercial answers "is this move mature / crowded / trustworthy?" not "which direction?" If it can reliably identify fragile trades, it becomes an excellent veto/confidence/sizing input.

**CRITICAL: The previous selector research script had a lookback mismatch with the production engine. This script MUST run all tagging through the real engine audit path to get correct baselines.**

---

## Architecture

This is a DIAGNOSTIC script. It:
1. Runs the canonical selector baseline (`strength_tiebreak`) through the real engine
2. For each trade, tags it with 4 commercial context dimensions
3. Buckets trades by each tag
4. Measures forward return, win rate, and drawdown per bucket
5. Outputs a diagnostic report — no direction changes

**Data loading:** Use `resolveSelectorStrengthTiebreakAudit()` to get the canonical baseline audit entries. These entries already contain `commercialScore`, `commercialDirection`, `commercialExtremity`, and `commercialCaution`. For prior-week commercial context, build contexts for the previous week using `buildContextForWeek()`.

---

## Script: `scripts/research-commercial-context.ts`

Create a NEW script file. Do NOT modify any existing scripts.

Output file: `docs/COMMERCIAL_CONTEXT_RESEARCH_2026-04-06.md`

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

```typescript
async function main() {
  const currentWeek = normalizeWeekOpenUtc(getDisplayWeekOpenUtc());
  const allWeeks = (await listDataSectionWeeks())
    .filter((week) => normalizeWeekOpenUtc(week) < currentWeek);
  const weeks = allWeeks.slice(-10);

  // Load baseline audits through the REAL engine path
  const baselineAudits = await Promise.all(
    weeks.map((week) => resolveSelectorStrengthTiebreakAudit(week)),
  );
  const baselineByWeek = new Map(baselineAudits.map((audit) => [audit.weekOpenUtc, audit]));

  // Load contexts for current + previous weeks (needed for delta-persistence)
  const [cotHistory, sentimentBySymbol] = await Promise.all([
    loadCotHistory(),
    loadSentimentHistory(),
  ]);
  const universe = buildPairUniverse();

  const contextsByWeek = new Map<string, Map<string, PairContext>>();
  // Also load the week before the first test week for prior-week context
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

  // ... tagging loop below
}
```

---

## Tagged Trade Row

```typescript
type TaggedTrade = {
  weekOpenUtc: string;
  pair: string;
  assetClass: AssetClass;
  selectorDirection: Direction;
  returnPct: number;  // ADR-normalized, directed

  // Tag 1: Divergence
  commercialDirection: SelectorDirectionalState;
  commercialDiverges: boolean;  // commercial opposes selector direction

  // Tag 2: Alignment
  alignmentBucket: "aligned" | "neutral" | "opposed";

  // Tag 3: Extremity
  commercialExtremity: number;
  extremityBucket: "low" | "medium" | "high";

  // Tag 4: Delta-Persistence
  commercialScoreCurrent: number;
  commercialScorePrior: number | null;
  deltaDirection: "building_with" | "building_against" | "stable" | "no_prior";
};
```

---

## Tagging Logic

For each trade (pair-week where selector produced a non-NEUTRAL direction):

```typescript
const TARGET_ADR = getTargetAdrPct();

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
    if (!priceRow) continue;

    const context = contexts.get(pair);
    if (!context) continue;

    const pairAdr = getAdrPct(adrMap, pair, entry.assetClass);
    const rawReturn = entry.finalDirection === "SHORT" ? -priceRow.returnPct : priceRow.returnPct;
    const adrReturn = rawReturn * (TARGET_ADR / pairAdr);

    // Commercial metrics from the CONTEXT (not the audit entry, to ensure consistency)
    const commScore = context.commercial.score;
    const commExtremity = context.commercial.extremity;
    const commDir = scoreToDirectionalState(commScore);

    // Prior week commercial
    const prevContext = prevContexts?.get(pair) ?? null;
    const prevCommScore = prevContext?.commercial.score ?? null;

    // Tag 1: Divergence
    const commercialDiverges =
      commDir !== "NEUTRAL"
      && commDir !== entry.finalDirection;

    // Tag 2: Alignment
    const alignmentBucket: TaggedTrade["alignmentBucket"] =
      commDir === entry.finalDirection ? "aligned"
      : commDir === "NEUTRAL" || Math.abs(commScore) < 0.1 ? "neutral"
      : "opposed";

    // Tag 3: Extremity
    const extremityBucket: TaggedTrade["extremityBucket"] =
      commExtremity >= 0.7 ? "high"
      : commExtremity >= 0.4 ? "medium"
      : "low";

    // Tag 4: Delta-Persistence
    let deltaDirection: TaggedTrade["deltaDirection"] = "no_prior";
    if (prevCommScore !== null) {
      const scoreDelta = commScore - prevCommScore;
      const selectorIsLong = entry.finalDirection === "LONG";
      // "building with" = commercial score moving toward selector direction
      // For LONG: positive delta = building with. For SHORT: negative delta = building with.
      const movingWith = selectorIsLong ? scoreDelta > 0.05 : scoreDelta < -0.05;
      const movingAgainst = selectorIsLong ? scoreDelta < -0.05 : scoreDelta > 0.05;
      deltaDirection = movingWith ? "building_with"
        : movingAgainst ? "building_against"
        : "stable";
    }

    taggedTrades.push({
      weekOpenUtc: week,
      pair,
      assetClass: entry.assetClass,
      selectorDirection: entry.finalDirection,
      returnPct: adrReturn,
      commercialDirection: commDir,
      commercialDiverges,
      alignmentBucket,
      commercialExtremity: commExtremity,
      extremityBucket,
      commercialScoreCurrent: commScore,
      commercialScorePrior: prevCommScore,
      deltaDirection,
    });
  }
}
```

Note: Use the `scoreToDirectionalState` helper from selectorEngine (it's exported). If not exported, replicate: `Math.abs(score) <= 0.000001 ? "NEUTRAL" : score >= 0 ? "LONG" : "SHORT"`.

---

## Analysis Functions

### Bucket Statistics

For any subset of tagged trades, compute:

```typescript
type BucketStats = {
  trades: number;
  totalReturnPct: number;
  avgReturnPct: number;
  winRatePct: number;
  losingWeeks: number;
  maxDrawdownPct: number;
};
```

Use the same `computeMaxDd` logic as other research scripts (weekly cumulative, peak-to-trough).

### Statistical Significance Indicator

For each bucket comparison, include the trade count ratio so we can see if buckets have enough data to be meaningful. If a bucket has fewer than 20 trades, mark it with `(*)` as low-sample.

---

## Output Format

Write to `docs/COMMERCIAL_CONTEXT_RESEARCH_2026-04-06.md`.

### Section 1: Header

```markdown
# Commercial Context Tagging Research

Weeks analyzed: {N} ({first week label} -> {last week label}).
Baseline: canonical selector strength_tiebreak.
All returns ADR-normalized.
Total baseline trades: {N}

This is a diagnostic pass. No selector directions were changed.
Commercial is evaluated as a state/context descriptor, not a directional signal.
```

### Section 2: Baseline Summary

```markdown
## Baseline Summary

| Metric | Value |
| --- | ---: |
| Trades | ... |
| Total Return | ... |
| Max Drawdown | ... |
| Win Rate | ... |
| Losing Weeks | ... |
```

### Section 3: Tag 1 — Commercial Divergence

```markdown
## Tag 1: Commercial Divergence

Does commercial opposing the selector direction predict worse outcomes?

| Bucket | Trades | Total% | Avg% | Win% | MaxDD% | Losing Wks |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| Commercial agrees | ... |
| Commercial neutral | ... |
| Commercial opposes | ... |
```

If "opposes" has significantly worse metrics than "agrees", commercial divergence is a useful fragility signal.

### Section 4: Tag 2 — Alignment Confidence

```markdown
## Tag 2: Alignment Confidence

Three-tier alignment bucketing.

| Bucket | Trades | Total% | Avg% | Win% | MaxDD% | Losing Wks |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| aligned | ... |
| neutral | ... |
| opposed | ... |
```

### Section 5: Tag 3 — Extremity State

```markdown
## Tag 3: Commercial Extremity State

Does commercial extremity level change outcome quality?

### All Trades by Extremity

| Extremity | Trades | Total% | Avg% | Win% | MaxDD% | Losing Wks |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| low (<0.4) | ... |
| medium (0.4-0.7) | ... |
| high (≥0.7) | ... |

### Extremity × Alignment Cross-Tab

This is the key diagnostic. Does high extremity + opposition predict fragile trades?

| Extremity | Alignment | Trades | Total% | Avg% | Win% |
| --- | --- | ---: | ---: | ---: | ---: |
| high | aligned | ... |
| high | neutral | ... |
| high | opposed | ... |
| medium | aligned | ... |
| medium | neutral | ... |
| medium | opposed | ... |
| low | aligned | ... |
| low | neutral | ... |
| low | opposed | ... |
```

### Section 6: Tag 4 — Delta-Persistence

```markdown
## Tag 4: Commercial Delta-Persistence

Is commercial flow building with or against the selector direction?

| Flow Direction | Trades | Total% | Avg% | Win% | MaxDD% | Losing Wks |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| building_with | ... |
| stable | ... |
| building_against | ... |
| no_prior | ... |

### Delta-Persistence × Alignment Cross-Tab

| Flow | Alignment | Trades | Total% | Avg% | Win% |
| --- | --- | ---: | ---: | ---: | ---: |
| building_with | aligned | ... |
| building_with | opposed | ... |
| building_against | aligned | ... |
| building_against | opposed | ... |
| stable | aligned | ... |
| stable | opposed | ... |
```

### Section 7: Combined Fragility Score

Build a simple combined fragility indicator:

```markdown
## Combined Fragility Score

Score = sum of:
- commercial opposed: +1
- commercial extremity high: +1
- commercial flow building against: +1

| Fragility Score | Trades | Total% | Avg% | Win% | MaxDD% |
| --- | ---: | ---: | ---: | ---: | ---: |
| 0 (no flags) | ... |
| 1 (one flag) | ... |
| 2 (two flags) | ... |
| 3 (all flags) | ... |
```

If high-fragility trades (score 2-3) are significantly worse than low-fragility (score 0), this becomes a natural veto/sizing input.

### Section 8: Per-Asset-Class Breakdown

For the divergence tag only (keeps output manageable):

```markdown
## Divergence by Asset Class

### fx

| Bucket | Trades | Total% | Win% |
| --- | ---: | ---: | ---: |
| agrees | ... |
| neutral | ... |
| opposes | ... |

### crypto
...
### indices
...
### commodities
...
```

---

## Validation

Run:
```bash
npx tsx scripts/research-commercial-context.ts
```

Verify:
1. **Baseline MUST match production selector**: 360 trades, +91.96%, 4.01% DD, 54.2% WR, 1 losing week
2. **All bucket trade counts must sum to baseline total** for each tag dimension
3. **All returns are ADR-normalized**
4. **No selector directions are changed** — this is purely diagnostic

If baseline doesn't match, STOP and investigate. The prior research had a lookback mismatch that produced wrong numbers. This must not happen again.

---

## Important Warnings

1. **Use `resolveSelectorStrengthTiebreakAudit()` for baseline audit entries.** This goes through the REAL engine path, not a research approximation.

2. **Commercial metrics come from `buildContextForWeek()` contexts.** The audit entries contain `commercialScore` and `commercialExtremity`, but for delta-persistence we need prior-week context too. Load contexts for the week before the first test week.

3. **The `scoreToDirectionalState` function** treats scores within ±0.000001 as NEUTRAL. Use the same threshold.

4. **Delta-persistence threshold (0.05)** is a starting point. If most trades fall into "stable", the threshold is too high. If almost none are "stable", it's too low. Report the raw distribution.

5. **The alignment "neutral" bucket** uses `Math.abs(commScore) < 0.1` as the threshold. This captures pairs where commercial has a very weak lean. Adjust if the neutral bucket is too large or too small.

6. **File header standard applies.** Use the Freedom_EXE header format.

7. **Do NOT modify any files in `src/`.** This is a research script only.

8. **Do NOT modify any existing research scripts.**

---

## What We're Looking For

The research is successful if ANY of these hold:
- "Opposed" trades have materially worse WR or higher DD than "aligned" trades
- High-extremity opposed trades are clearly worse than the rest
- The combined fragility score shows a clean gradient (score 0 best → score 3 worst)
- Delta-persistence "building against" trades underperform

If commercial reliably identifies fragile trades, it becomes:
- A **veto input** (skip fragility score ≥ 2)
- A **confidence tier** (size down fragile trades)
- A **regime filter** (avoid certain commercial states)

If none of these hold, commercial has no informational value inside selector and should be excluded entirely.

---

## Files

| File | Action |
|------|--------|
| `scripts/research-commercial-context.ts` | CREATE — new research script |
| `docs/COMMERCIAL_CONTEXT_RESEARCH_2026-04-06.md` | CREATE — output (generated by script) |

**One new file created. No existing files modified.**
