# CODEX: Weighted Commercial Tiebreak Research

**Date:** 2026-04-06
**Goal:** Research weighted tiebreak variants where strength and commercial have unequal influence when breaking sentiment-vs-dealer conflicts. Find the variant that preserves baseline's correct strength-driven calls while adding commercial's DD-reducing input where strength has no opinion.

**Context:**
- Baseline selector: `strength_tiebreak` — +91.96%, 4.01% DD, 54.2% WR, 1 losing week
- Clean commercial tiebreak (equal votes): +88.49%, 1.91% DD, 58.9% WR, 2 losing weeks, 75 changed decisions
- Clean tiebreak proves commercial adds value in the conflict branch, but equal voting lets commercial override some correct strength-driven calls → return bleeds 3.47%
- Prior research: `docs/SELECTOR_COMMERCIAL_RESEARCH_2026-04-05.md`

**Key insight:** In the clean tiebreak, when strength supports dealer but commercial supports sentiment, it's a 1v1 tie → sentiment wins. This undoes the baseline's correct dealer call. Weighted scoring (St > C) fixes this: strength always wins when they disagree, commercial only changes outcomes when strength is neutral.

---

## Architecture

Follow the same architecture as `scripts/research-selector-commercial.ts`:
- Load all backtestable weeks from `listDataSectionWeeks()`, filter to weeks before current week, take last 10
- For each week: load pair contexts via `buildContextForWeek()`, load baseline audit via `resolveSelectorStrengthTiebreakAudit()`
- For each pair-week: compute baseline direction from audit, test each variant
- ADR-normalize all returns
- Track changed decisions and changed return vs baseline

**CRITICAL:** Use the exact same data loading as `research-selector-commercial.ts`. Import from `selectorEngine.ts`.

---

## Script: `scripts/research-selector-weighted-tiebreak.ts`

Create a NEW script file. Do NOT modify any existing scripts.

Output file: `docs/SELECTOR_WEIGHTED_TIEBREAK_RESEARCH_2026-04-06.md`

---

## Imports

Copy the exact same imports as `research-selector-commercial.ts`:

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
  policySentimentContextOverride,
  resolveSelectorStrengthTiebreakAudit,
  type Direction,
  type PairContext,
  type PairDefWithAsset,
  type SelectorDirectionalState,
  type SelectorStrengthRelation,
  type SourceMetrics,
} from "../src/lib/performance/selectorEngine";
import type { AssetClass } from "../src/lib/cotMarkets";
import { normalizeWeekOpenUtc, getDisplayWeekOpenUtc } from "../src/lib/weekAnchor";
```

---

## How The Baseline Tiebreak Works (for reference)

The selector's `policySentimentContextOverride()` produces a base direction (usually sentiment). Then `strength_tiebreak` kicks in **only when sentiment and dealer disagree**:

1. If strength supports sentiment → sentiment wins
2. If strength supports dealer → dealer wins
3. If strength neutral or ambiguous → base policy decision (usually sentiment)

Commercial is NOT consulted. This is the baseline we're testing against.

---

## How Weighted Tiebreak Works

Same trigger: only fires when `sentimentDirection !== dealerDirection` (both non-NEUTRAL).

For each supporter source (strength, commercial), compute a weighted support score:

```typescript
type WeightPack = {
  id: string;
  label: string;
  strengthWeight: number;
  commercialWeight: number;
};

function applyWeightedTiebreak(
  context: PairContext,
  baselineDirection: Direction,
  weights: WeightPack,
): VariantOutcome {
  const sentimentDirection = sourceDirection(context.sentiment);
  const dealerDirection = sourceDirection(context.dealer);
  const commercialDirection = sourceDirection(context.commercial);
  const strengthDirection = context.strength.compositeDirection;

  // Only fires on sentiment-vs-dealer conflict
  if (
    sentimentDirection === "NEUTRAL" ||
    dealerDirection === "NEUTRAL" ||
    sentimentDirection === dealerDirection
  ) {
    return {
      direction: baselineDirection,
      score: baselineDirection === "LONG" ? 0.0001 : -0.0001,
      changedFromBaseline: false,
      branch: "no_conflict",
      scenario: "no_conflict",
    };
  }

  // Compute weighted support for each side
  let sentimentSupport = 0;
  let dealerSupport = 0;

  if (sameDirection(strengthDirection, sentimentDirection)) sentimentSupport += weights.strengthWeight;
  else if (sameDirection(strengthDirection, dealerDirection)) dealerSupport += weights.strengthWeight;
  // strength neutral → contributes 0 to both sides

  if (sameDirection(commercialDirection, sentimentDirection)) sentimentSupport += weights.commercialWeight;
  else if (sameDirection(commercialDirection, dealerDirection)) dealerSupport += weights.commercialWeight;
  // commercial neutral → contributes 0 to both sides

  // Resolve: dealer side must STRICTLY beat sentiment side to flip
  // When equal (including 0 vs 0), sentiment wins (sentiment-first bias)
  if (dealerSupport > sentimentSupport) {
    return {
      direction: dealerDirection,
      score: context.dealer.score,
      changedFromBaseline: dealerDirection !== baselineDirection,
      branch: "dealer_wins_weighted",
      scenario: classifyScenario(strengthDirection, commercialDirection, sentimentDirection, dealerDirection),
    };
  }

  if (sentimentSupport > dealerSupport) {
    return {
      direction: sentimentDirection,
      score: context.sentiment.score,
      changedFromBaseline: sentimentDirection !== baselineDirection,
      branch: "sentiment_wins_weighted",
      scenario: classifyScenario(strengthDirection, commercialDirection, sentimentDirection, dealerDirection),
    };
  }

  // Tie (both 0, or theoretically equal) → sentiment wins
  return {
    direction: sentimentDirection,
    score: context.sentiment.score,
    changedFromBaseline: sentimentDirection !== baselineDirection,
    branch: "tie_sentiment_wins",
    scenario: classifyScenario(strengthDirection, commercialDirection, sentimentDirection, dealerDirection),
  };
}
```

---

## Scenario Classification

For the diagnostic, classify each conflict pair-week into one of these scenarios based on which side strength and commercial support:

```typescript
type ConflictScenario =
  | "no_conflict"           // sentiment === dealer or one is neutral
  | "St_sent_C_sent"        // both support sentiment
  | "St_sent_C_dealer"      // strength supports sentiment, commercial supports dealer
  | "St_sent_C_neutral"     // strength supports sentiment, commercial neutral
  | "St_dealer_C_sent"      // strength supports dealer, commercial supports sentiment
  | "St_dealer_C_dealer"    // both support dealer
  | "St_dealer_C_neutral"   // strength supports dealer, commercial neutral
  | "St_neutral_C_sent"     // strength neutral, commercial supports sentiment
  | "St_neutral_C_dealer"   // strength neutral, commercial supports dealer
  | "St_neutral_C_neutral"; // both neutral

function classifyScenario(
  strengthDir: SelectorDirectionalState,
  commercialDir: SelectorDirectionalState,
  sentimentDir: Direction,
  dealerDir: Direction,
): ConflictScenario {
  const stSide = sameDirection(strengthDir, sentimentDir) ? "sent"
    : sameDirection(strengthDir, dealerDir) ? "dealer"
    : "neutral";
  const cSide = sameDirection(commercialDir, sentimentDir) ? "sent"
    : sameDirection(commercialDir, dealerDir) ? "dealer"
    : "neutral";
  return `St_${stSide}_C_${cSide}` as ConflictScenario;
}
```

Add `scenario` to the VariantOutcome type.

---

## Strength-First Fallback Variant

In addition to the weighted variants, test a "strength-first, commercial-fallback" approach. This is conceptually the cleanest integration:

```typescript
function applyStrengthFirstFallback(
  context: PairContext,
  baselineDirection: Direction,
): VariantOutcome {
  const sentimentDirection = sourceDirection(context.sentiment);
  const dealerDirection = sourceDirection(context.dealer);
  const commercialDirection = sourceDirection(context.commercial);
  const strengthDirection = context.strength.compositeDirection;

  if (
    sentimentDirection === "NEUTRAL" ||
    dealerDirection === "NEUTRAL" ||
    sentimentDirection === dealerDirection
  ) {
    return {
      direction: baselineDirection,
      score: baselineDirection === "LONG" ? 0.0001 : -0.0001,
      changedFromBaseline: false,
      branch: "no_conflict",
      scenario: "no_conflict",
    };
  }

  // Step 1: If strength has an opinion, use it (same as baseline)
  if (sameDirection(strengthDirection, sentimentDirection)) {
    return {
      direction: sentimentDirection,
      score: context.sentiment.score,
      changedFromBaseline: sentimentDirection !== baselineDirection,
      branch: "strength_sentiment",
      scenario: classifyScenario(strengthDirection, commercialDirection, sentimentDirection, dealerDirection),
    };
  }
  if (sameDirection(strengthDirection, dealerDirection)) {
    return {
      direction: dealerDirection,
      score: context.dealer.score,
      changedFromBaseline: dealerDirection !== baselineDirection,
      branch: "strength_dealer",
      scenario: classifyScenario(strengthDirection, commercialDirection, sentimentDirection, dealerDirection),
    };
  }

  // Step 2: Strength is neutral — let commercial break the tie
  if (sameDirection(commercialDirection, sentimentDirection)) {
    return {
      direction: sentimentDirection,
      score: context.sentiment.score,
      changedFromBaseline: sentimentDirection !== baselineDirection,
      branch: "commercial_fallback_sentiment",
      scenario: classifyScenario(strengthDirection, commercialDirection, sentimentDirection, dealerDirection),
    };
  }
  if (sameDirection(commercialDirection, dealerDirection)) {
    return {
      direction: dealerDirection,
      score: context.dealer.score,
      changedFromBaseline: dealerDirection !== baselineDirection,
      branch: "commercial_fallback_dealer",
      scenario: classifyScenario(strengthDirection, commercialDirection, sentimentDirection, dealerDirection),
    };
  }

  // Step 3: Both neutral — fall back to base policy (sentiment)
  return {
    direction: sentimentDirection,
    score: context.sentiment.score,
    changedFromBaseline: sentimentDirection !== baselineDirection,
    branch: "both_neutral_fallback",
    scenario: classifyScenario(strengthDirection, commercialDirection, sentimentDirection, dealerDirection),
  };
}
```

---

## Variants to Test

```typescript
const WEIGHT_PACKS: WeightPack[] = [
  { id: "W1", label: "St=1.5 C=0.75", strengthWeight: 1.5, commercialWeight: 0.75 },
  { id: "W2", label: "St=2.0 C=0.75", strengthWeight: 2.0, commercialWeight: 0.75 },
  { id: "W3", label: "St=2.0 C=0.5",  strengthWeight: 2.0, commercialWeight: 0.5 },
  { id: "W4", label: "St=1.5 C=0.5",  strengthWeight: 1.5, commercialWeight: 0.5 },
];
```

Full variant list (9 total):

| Variant ID | Label | Logic |
|-----------|-------|-------|
| `baseline` | Baseline strength_tiebreak | Control — no commercial |
| `clean_equal` | Clean equal (St=1 C=1) | Prior research result — equal votes |
| `weighted_W1` | Weighted St=1.5 C=0.75 | Weighted tiebreak |
| `weighted_W2` | Weighted St=2.0 C=0.75 | Weighted tiebreak |
| `weighted_W3` | Weighted St=2.0 C=0.5 | Weighted tiebreak |
| `weighted_W4` | Weighted St=1.5 C=0.5 | Weighted tiebreak |
| `strength_first` | Strength-first fallback | Commercial only when strength neutral |
| `dealer_bias_W1` | Dealer-bias W1 | Same as W1 but ties favor dealer instead of sentiment |
| `sentiment_bias_W1` | Sentiment-bias W1 | Same as W1, ties favor sentiment (should match W1 exactly since ties = 0v0 → sentiment anyway) |

Notes on `dealer_bias_W1`: This tests what happens if we change the tie rule from "sentiment wins ties" to "dealer wins ties". The only tie case with these weights is 0v0 (both neutral), so this changes behavior only when neither strength nor commercial has an opinion.

Actually, remove `sentiment_bias_W1` — it will match W1 exactly since the only tie is 0v0 and the base policy already falls through to sentiment in that case. Replace with:

| `commercial_gate_W1` | Commercial gate W1 | W1 weights but commercial only counted if its extremity < 0.8 (not stretched) |

This tests whether filtering out stretched commercial improves results.

---

## Data Loading

Identical to `research-selector-commercial.ts`. Copy the `main()` function structure:

```typescript
async function main() {
  const currentWeek = normalizeWeekOpenUtc(getDisplayWeekOpenUtc());
  const weeks = (await listDataSectionWeeks())
    .filter((week) => normalizeWeekOpenUtc(week) < currentWeek)
    .slice(-10);

  const [cotHistory, sentimentBySymbol, baselineAudits] = await Promise.all([
    loadCotHistory(),
    loadSentimentHistory(),
    Promise.all(weeks.map((week) => resolveSelectorStrengthTiebreakAudit(week))),
  ]);

  const universe = buildPairUniverse();
  const baselineByWeek = new Map(baselineAudits.map((audit) => [audit.weekOpenUtc, audit]));

  const contextsByWeek = new Map<string, Map<string, PairContext>>();
  const previousWeekReturnByWeek = new Map<string, Map<string, number>>();

  for (let index = 0; index < weeks.length; index += 1) {
    const weekOpenUtc = weeks[index]!;
    const [contexts, pairReturns] = await Promise.all([
      buildContextForWeek(weekOpenUtc, universe as PairDefWithAsset[], cotHistory, sentimentBySymbol, weeks, { requireStrength: true }),
      getWeeklyPairReturns(weekOpenUtc),
    ]);
    contextsByWeek.set(weekOpenUtc, contexts);
    previousWeekReturnByWeek.set(
      weekOpenUtc,
      new Map(pairReturns.map((row) => [row.symbol.toUpperCase(), row.returnPct] as const)),
    );
  }

  // ... variant loop identical to research-selector-commercial.ts
}
```

---

## Variant Resolution

```typescript
type VariantId =
  | "baseline"
  | "clean_equal"
  | "weighted_W1"
  | "weighted_W2"
  | "weighted_W3"
  | "weighted_W4"
  | "strength_first"
  | "dealer_bias_W1"
  | "commercial_gate_W1";

function resolveVariant(
  variant: VariantId,
  context: PairContext,
  baselineDirection: Direction,
): VariantOutcome {
  switch (variant) {
    case "baseline":
      return { direction: baselineDirection, score: baselineDirection === "LONG" ? 0.0001 : -0.0001, changedFromBaseline: false, branch: "baseline", scenario: "no_conflict" };

    case "clean_equal":
      return applyWeightedTiebreak(context, baselineDirection, { id: "equal", label: "St=1 C=1", strengthWeight: 1, commercialWeight: 1 });

    case "weighted_W1":
      return applyWeightedTiebreak(context, baselineDirection, WEIGHT_PACKS[0]!);

    case "weighted_W2":
      return applyWeightedTiebreak(context, baselineDirection, WEIGHT_PACKS[1]!);

    case "weighted_W3":
      return applyWeightedTiebreak(context, baselineDirection, WEIGHT_PACKS[2]!);

    case "weighted_W4":
      return applyWeightedTiebreak(context, baselineDirection, WEIGHT_PACKS[3]!);

    case "strength_first":
      return applyStrengthFirstFallback(context, baselineDirection);

    case "dealer_bias_W1":
      return applyWeightedTiebreakDealerBias(context, baselineDirection, WEIGHT_PACKS[0]!);

    case "commercial_gate_W1":
      return applyCommercialGateW1(context, baselineDirection, WEIGHT_PACKS[0]!);
  }
}
```

### Dealer-bias W1

Same as W1 but when `dealerSupport === sentimentSupport` (tie), dealer wins instead of sentiment:

```typescript
function applyWeightedTiebreakDealerBias(
  context: PairContext,
  baselineDirection: Direction,
  weights: WeightPack,
): VariantOutcome {
  // Same as applyWeightedTiebreak, but the tie-resolution line changes:
  // Instead of: if (dealerSupport > sentimentSupport) → dealer
  // Use: if (dealerSupport >= sentimentSupport && dealerSupport > 0) → dealer
  // The only actual tie is 0v0 (both neutral). So this only fires when
  // dealerSupport === sentimentSupport AND both > 0, which shouldn't happen
  // with asymmetric weights. In practice, the only change is 0v0 → dealer.
  // Actually 0v0 means neither supports either, so dealerSupport >= sentimentSupport
  // AND dealerSupport > 0 is false. We need:
  // if (dealerSupport > sentimentSupport) → dealer
  // else if (sentimentSupport > dealerSupport) → sentiment
  // else → dealer (was sentiment in W1)
  // This means: when both strength and commercial are neutral, go dealer instead of sentiment
}
```

### Commercial Gate W1

Same as W1 but only count commercial's vote if its extremity is below 0.8:

```typescript
function applyCommercialGateW1(
  context: PairContext,
  baselineDirection: Direction,
  weights: WeightPack,
): VariantOutcome {
  // Same as applyWeightedTiebreak, but before computing commercial's support:
  // if (context.commercial.extremity >= 0.8) → treat commercial as neutral (0 weight)
  // This filters out stretched commercial positions which may be about to reverse
}
```

---

## Output Format

Write to `docs/SELECTOR_WEIGHTED_TIEBREAK_RESEARCH_2026-04-06.md`.

### Section 1: Header

```markdown
# Selector Weighted Tiebreak Research

Weeks analyzed: {N} ({first week label} -> {last week label}).
Baseline: canonical selector strength_tiebreak.
All returns ADR-normalized.
```

### Section 2: Conflict Scenario Distribution

**This is the most important diagnostic.** Show how many pair-weeks fall into each scenario (only counting conflict cases where sentiment !== dealer):

```markdown
## Conflict Scenario Distribution

Total conflict pair-weeks: {N} / {total pair-weeks}

| Scenario | Count | % of Conflicts | Baseline Return | Notes |
| --- | ---: | ---: | ---: | --- |
| St_sent_C_sent | ... | ... | ... | Both support sentiment |
| St_sent_C_dealer | ... | ... | ... | Strength → sent, Commercial → dealer |
| St_sent_C_neutral | ... | ... | ... | Strength → sent, Commercial abstains |
| St_dealer_C_sent | ... | ... | ... | Strength → dealer, Commercial → sent |
| St_dealer_C_dealer | ... | ... | ... | Both support dealer |
| St_dealer_C_neutral | ... | ... | ... | Strength → dealer, Commercial abstains |
| St_neutral_C_sent | ... | ... | ... | Strength abstains, Commercial → sent |
| St_neutral_C_dealer | ... | ... | ... | Strength abstains, Commercial → dealer |
| St_neutral_C_neutral | ... | ... | ... | Both abstain |
```

For "Baseline Return", sum the ADR-normalized returns of pair-weeks in each scenario when traded with the baseline direction.

### Section 3: Per-Scenario Variant Impact

For each scenario with > 0 count, show what each variant does differently and the return impact:

```markdown
## Scenario Impact: St_neutral_C_dealer

Baseline: sentiment wins (strength neutral, commercial ignored)
Count: {N} pair-weeks

| Variant | Flips to Dealer | Baseline Return | Variant Return | Delta |
| --- | ---: | ---: | ---: | ---: |
| clean_equal | ... | ... | ... | ... |
| weighted_W1 | ... | ... | ... | ... |
| ... |
```

Only include this detailed section for scenarios where at least one variant changes behavior.

### Section 4: Master Comparison

```markdown
## Master Comparison

| Variant | Trades | Total% | MaxDD% | Win% | Losing Wks | Trades/Wk | Changed Decisions | Changed Return |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
```

Sorted by Losing Wks ASC, then Total% DESC.

### Section 5: Asset Breakdown

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

### Section 6: Decision Change Matrix

Show exactly which pair-weeks each weighted variant changes from baseline:

```markdown
## Decision Changes: weighted_W1

| Week | Pair | Baseline Dir | Variant Dir | Scenario | Return Delta |
| --- | --- | --- | --- | --- | ---: |
```

Only show rows where the variant changed the direction. This is the audit trail.

---

## Validation

Run:
```bash
npx tsx scripts/research-selector-weighted-tiebreak.ts
```

Verify:
1. **Baseline MUST match**: 360 trades, +91.96%, 4.01% DD, 54.2% WR, 1 losing week
2. **Clean equal MUST match prior research**: +88.49%, 1.91% DD, 58.9% WR, 2 losing weeks, 75 changed decisions
3. **All weighted variants MUST have 360 trades** (weighted tiebreak never skips, only changes direction)
4. **Strength-first fallback MUST match baseline** on all scenarios where strength is non-neutral (it only differs when strength is neutral)
5. **Scenario counts MUST sum** to total conflict pair-weeks
6. All returns are ADR-normalized

If baselines don't match, STOP and investigate.

---

## Important Warnings

1. **Use the exact same data loading pipeline** as `research-selector-commercial.ts`. Import `buildContextForWeek`, `buildPairUniverse`, `loadCotHistory`, `loadSentimentHistory`, `policySentimentContextOverride`, `resolveSelectorStrengthTiebreakAudit` from `selectorEngine.ts`.

2. **Weighted tiebreak ONLY fires in the conflict branch** (sentiment !== dealer, both non-NEUTRAL). All other pair-weeks pass through unchanged.

3. **Sentiment-first bias**: When weighted scores tie, sentiment wins. This is the same default as the base policy.

4. **Strength direction comes from `context.strength.compositeDirection`** — this is already a SelectorDirectionalState ("LONG" | "SHORT" | "NEUTRAL").

5. **Commercial direction comes from `sourceDirection(context.commercial)`** — derived from `context.commercial.score`.

6. **The sameDirection helper** treats NEUTRAL as not matching anything.

7. **File header standard applies.** Use the Freedom_EXE header format.

8. **Do NOT modify any files in `src/`.** This is a research script only.

9. **Do NOT modify any existing research scripts.**

---

## Expected Behavior

With the weighted approach (St > C), the following should hold:
- **Scenarios where strength has an opinion**: weighted variants should produce IDENTICAL results to baseline (strength overrides commercial in all weight packs since strengthWeight > commercialWeight)
- **Scenarios where strength is neutral**: weighted variants should differ from baseline (commercial gets to break the tie)
- **St_neutral_C_dealer scenarios**: this is where the DD improvement comes from — commercial supporting dealer when strength can't decide
- **Changed decisions should be FEWER than clean_equal's 75** — weighted should be more selective about when to flip

If strength-first fallback produces identical results to all weighted variants, that confirms the weights don't matter as long as St > C, and we should ship the conceptually simpler strength-first approach.

---

## Files

| File | Action |
|------|--------|
| `scripts/research-selector-weighted-tiebreak.ts` | CREATE — new research script |
| `docs/SELECTOR_WEIGHTED_TIEBREAK_RESEARCH_2026-04-06.md` | CREATE — output (generated by script) |

**One new file created. No existing files modified.**
