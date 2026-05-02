# CODEX: Ship Commercial Tiebreak Selector — Replace strength_tiebreak as Canonical Variant

**Date:** 2026-04-06
**Goal:** Replace the selector's canonical variant from `strength_tiebreak` (strength-only conflict resolution) to `strength_commercial_tiebreak` (strength + commercial equal-vote conflict resolution). This is the "clean commercial tiebreak" from research.

**Research results:**
- `docs/SELECTOR_COMMERCIAL_RESEARCH_2026-04-05.md` — original commercial research
- `docs/SELECTOR_WEIGHTED_TIEBREAK_RESEARCH_2026-04-06.md` — weighted tiebreak research (confirmed weighted is worse)

**Ship candidate:** Clean commercial tiebreak — 360 trades, +88.49%, 1.91% DD, 58.9% WR, 2 losing weeks.
**Baseline it replaces:** strength_tiebreak — 360 trades, +91.96%, 4.01% DD, 54.2% WR, 1 losing week.
**Justification:** DD cut in half (4.01% → 1.91%), WR improved (54.2% → 58.9%). Return/DD ratio improves from 22.9x to 46.3x.

---

## How The New Tiebreak Works

Same trigger as strength_tiebreak: only fires when sentiment and dealer disagree (both non-NEUTRAL, different directions).

**Old (strength_tiebreak):** Only strength breaks the tie.
- Strength supports sentiment → sentiment
- Strength supports dealer → dealer
- Strength neutral → base policy (usually sentiment)

**New (strength_commercial_tiebreak):** Strength AND commercial both get equal votes.
- Check if strength OR commercial supports sentiment (exclusively) → sentiment
- Check if strength OR commercial supports dealer (exclusively) → dealer
- Both sides have support → count: more supporters wins, sentiment wins ties
- Neither supports either → base policy (usually sentiment)

The key mechanical change: when sentiment and dealer conflict and strength supports dealer but commercial supports sentiment, the old version gives it to dealer (strength alone). The new version counts 1v1 → sentiment wins the tie (sentiment-first bias). This is where the DD improvement comes from.

---

## What Changes

Three files modified, no new files created.

| File | Action |
|------|--------|
| `src/lib/performance/selectorEngine.ts` | Add variant type + branch types + variant function + dispatch + canonical swap |
| `src/lib/performance/strategyConfig.ts` | Update selector strategy description |
| `src/lib/performance/strategyPageData.ts` | Bump engine version v17 → v18 |

---

## File 1: MODIFY `src/lib/performance/selectorEngine.ts`

### 1a. Bump SELECTOR_ENGINE_VERSION

Line 52:

```typescript
// Change from:
export const SELECTOR_ENGINE_VERSION = "selector-engine-v6";

// To:
export const SELECTOR_ENGINE_VERSION = "selector-engine-v7";
```

### 1b. Add new branch types to SelectorStrengthBranch

At line 134, add new branch labels to the union type:

```typescript
export type SelectorStrengthBranch =
  | "strength_confirmed"
  | "strength_neutral"
  | "strength_disagreed_but_not_blocking"
  | "strength_veto_passed"
  | "strength_veto_neutral"
  | "strength_veto_blocked"
  | "strength_tiebreak_sentiment"
  | "strength_tiebreak_dealer"
  | "strength_tiebreak_neutral_fallback"
  | "strength_tiebreak_ambiguous_fallback"
  | "strength_tiebreak_no_conflict_fallback"
  | "strength_commercial_tiebreak_sentiment_supported"
  | "strength_commercial_tiebreak_dealer_supported"
  | "strength_commercial_tiebreak_sentiment_wins_count"
  | "strength_commercial_tiebreak_dealer_wins_count"
  | "strength_commercial_tiebreak_no_conflict";
```

### 1c. Add new variant to SelectorVariant type

At line 153:

```typescript
export type SelectorVariant =
  | "strength_confirmation"
  | "strength_veto"
  | "strength_tiebreak"
  | "strength_commercial_tiebreak"
  | "commercial_audit_only"
  | "commercial_caution_skip"
  | "commercial_strength_disagree_skip";
```

### 1d. Add helper function: directionMatchesCommercial

Place this immediately after the existing `directionMatchesStrength` function (after line 301):

```typescript
function directionMatchesCommercial(
  direction: SelectorDirectionalState,
  commercial: SourceMetrics,
): boolean {
  if (direction === "NEUTRAL") return false;
  const commercialDirection = scoreToDirectionalState(commercial.score);
  if (commercialDirection === "NEUTRAL") return false;
  return direction === commercialDirection;
}
```

### 1e. Add the variant function: applyStrengthCommercialTiebreakVariant

Place this immediately after the existing `applyStrengthTiebreakVariant` function (after line 874):

```typescript
function applyStrengthCommercialTiebreakVariant(
  weekOpenUtc: string,
  context: PairContext,
  baseDecision: SelectorPolicyDecision,
): SelectorAuditEntry {
  const sentimentDirection = scoreToDirectionalState(context.sentiment.score);
  const dealerDirection = scoreToDirectionalState(context.dealer.score);
  const strengthRelationToProposed = classifyStrengthRelation(context.strength, baseDecision.direction);

  let finalDirection: SelectorDirectionalState = baseDecision.direction;
  let finalScore = baseDecision.score;
  let strengthBranch: SelectorStrengthBranch = "strength_commercial_tiebreak_no_conflict";

  const hasConflict =
    sentimentDirection !== "NEUTRAL"
    && dealerDirection !== "NEUTRAL"
    && sentimentDirection !== dealerDirection;

  if (hasConflict) {
    const strengthSupportsSentiment = directionMatchesStrength(sentimentDirection, context.strength);
    const strengthSupportsDealer = directionMatchesStrength(dealerDirection, context.strength);
    const commercialSupportsSentiment = directionMatchesCommercial(sentimentDirection, context.commercial);
    const commercialSupportsDealer = directionMatchesCommercial(dealerDirection, context.commercial);

    const supportsSentiment = strengthSupportsSentiment || commercialSupportsSentiment;
    const supportsDealer = strengthSupportsDealer || commercialSupportsDealer;

    if (supportsSentiment && !supportsDealer) {
      finalDirection = sentimentDirection;
      finalScore = context.sentiment.score;
      strengthBranch = "strength_commercial_tiebreak_sentiment_supported";
    } else if (supportsDealer && !supportsSentiment) {
      finalDirection = dealerDirection;
      finalScore = context.dealer.score;
      strengthBranch = "strength_commercial_tiebreak_dealer_supported";
    } else if (supportsSentiment && supportsDealer) {
      // Both sides have support — count supporters, sentiment wins ties
      const sentimentCount =
        (strengthSupportsSentiment ? 1 : 0) + (commercialSupportsSentiment ? 1 : 0);
      const dealerCount =
        (strengthSupportsDealer ? 1 : 0) + (commercialSupportsDealer ? 1 : 0);

      if (sentimentCount >= dealerCount) {
        finalDirection = sentimentDirection;
        finalScore = context.sentiment.score;
        strengthBranch = "strength_commercial_tiebreak_sentiment_wins_count";
      } else {
        finalDirection = dealerDirection;
        finalScore = context.dealer.score;
        strengthBranch = "strength_commercial_tiebreak_dealer_wins_count";
      }
    }
    // If neither supports either (both neutral), finalDirection stays as base policy
  }

  const { commercialCaution, commercialBranch } = classifyCommercialCaution(
    context.commercial,
    finalDirection,
  );

  return {
    weekOpenUtc,
    pair: context.pair,
    assetClass: context.assetClass,
    selectorVariant: "strength_commercial_tiebreak",
    sentimentScore: context.sentiment.score,
    sentimentDirection: scoreToDirectionalState(context.sentiment.score),
    dealerScore: context.dealer.score,
    dealerDirection: scoreToDirectionalState(context.dealer.score),
    commercialScore: context.commercial.score,
    commercialDirection: scoreToDirectionalState(context.commercial.score),
    strengthCompositeScore: context.strength.compositeScore,
    strengthCompositeDirection: context.strength.compositeDirection,
    strengthAvailableWindows: context.strength.availableWindows,
    strengthLatestSnapshotUtc: context.strength.latestSnapshotUtc,
    strengthRelationToProposed,
    baseSelectorBranch: baseDecision.branch,
    strengthBranch,
    commercialExtremity: context.commercial.extremity,
    commercialCaution,
    commercialBranch,
    baseDirection: baseDecision.direction,
    finalDirection,
    finalScore,
  };
}
```

### 1f. Add dispatch for new variant in resolveSelectorAuditInternal

In the variant dispatch chain (around line 1001-1012), add the new variant. The chain currently is:

```typescript
const auditEntry = variant === "strength_veto"
  ? applyStrengthVetoVariant(canonicalWeekOpenUtc, ctx, baseDecision)
  : variant === "strength_tiebreak"
    ? applyStrengthTiebreakVariant(canonicalWeekOpenUtc, ctx, baseDecision)
    : variant === "commercial_audit_only"
      ...
```

Add `strength_commercial_tiebreak` right after `strength_tiebreak`:

```typescript
const auditEntry = variant === "strength_veto"
  ? applyStrengthVetoVariant(canonicalWeekOpenUtc, ctx, baseDecision)
  : variant === "strength_tiebreak"
    ? applyStrengthTiebreakVariant(canonicalWeekOpenUtc, ctx, baseDecision)
    : variant === "strength_commercial_tiebreak"
      ? applyStrengthCommercialTiebreakVariant(canonicalWeekOpenUtc, ctx, baseDecision)
      : variant === "commercial_audit_only"
        ? applyCommercialAuditOnlyVariant(canonicalWeekOpenUtc, ctx, baseDecision)
        : variant === "commercial_caution_skip"
          ? applyCommercialCautionSkipVariant(canonicalWeekOpenUtc, ctx, baseDecision)
          : variant === "commercial_strength_disagree_skip"
            ? applyCommercialStrengthDisagreeSkipVariant(canonicalWeekOpenUtc, ctx, baseDecision)
            : applyStrengthConfirmationVariant(canonicalWeekOpenUtc, ctx, baseDecision);
```

### 1g. Update canonical selector to use new variant

Change the two canonical public functions to use the new variant:

```typescript
// resolveSelectorAudit — line 1043-1047
// Change from:
export async function resolveSelectorAudit(
  weekOpenUtc: string,
): Promise<SelectorAuditWeek> {
  return resolveSelectorAuditInternal(weekOpenUtc, "strength_tiebreak", { requireStrength: true });
}

// To:
export async function resolveSelectorAudit(
  weekOpenUtc: string,
): Promise<SelectorAuditWeek> {
  return resolveSelectorAuditInternal(weekOpenUtc, "strength_commercial_tiebreak", { requireStrength: true });
}
```

**DO NOT change `resolveSelectorStrengthTiebreakAudit`** — keep it pointing to `"strength_tiebreak"`. It's used by research scripts to get the old baseline for comparison.

### 1h. Add public function for new variant audit

After `resolveSelectorStrengthTiebreakAudit` (line 1058), add:

```typescript
export async function resolveSelectorStrengthCommercialTiebreakAudit(
  weekOpenUtc: string,
): Promise<SelectorAuditWeek> {
  return resolveSelectorAuditInternal(weekOpenUtc, "strength_commercial_tiebreak", { requireStrength: true });
}
```

---

## File 2: MODIFY `src/lib/performance/strategyConfig.ts`

Update the selector strategy description to reflect the new logic. Around line 119-125:

```typescript
// Change from:
{
  id: SELECTOR_SENTIMENT_OVERRIDE_STRATEGY_ID,
  label: "Selector",
  type: "single",
  description: "Sentiment-primary with strength tie-break. Follows sentiment as the base signal, allows a dealer override when sentiment is stretched and weakening, and uses strength to resolve sentiment versus dealer conflicts. Commercial is excluded from directional decisions.",
  cardBreakdown: "asset_class",
},

// To:
{
  id: SELECTOR_SENTIMENT_OVERRIDE_STRATEGY_ID,
  label: "Selector",
  type: "single",
  description: "Sentiment-primary with strength and commercial tie-break. Follows sentiment as the base signal, allows a dealer override when sentiment is stretched and weakening, and uses both strength and commercial as equal voters to resolve sentiment versus dealer conflicts.",
  cardBreakdown: "asset_class",
},
```

---

## File 3: MODIFY `src/lib/performance/strategyPageData.ts`

Bump the engine version to force full recomputation:

```typescript
// Change from:
const STRATEGY_ARTIFACT_ENGINE_VERSION =
  process.env.STRATEGY_ARTIFACT_ENGINE_VERSION?.trim() || "strategy-artifact-v17";

// To:
const STRATEGY_ARTIFACT_ENGINE_VERSION =
  process.env.STRATEGY_ARTIFACT_ENGINE_VERSION?.trim() || "strategy-artifact-v18";
```

---

## What NOT to Change

- **Do NOT change `resolveSelectorStrengthTiebreakAudit`** — it must stay on `"strength_tiebreak"` for research scripts
- **Do NOT change the other commercial variant functions** (audit_only, caution_skip, disagree_skip) — they are research variants
- **Do NOT change `resolveSelectorDirections`** — it calls `resolveSelectorAudit` which will now route to the new variant automatically
- **basketSource.ts** — Unchanged
- **weeklyHoldEngine.ts** — Unchanged (the engine calls `resolveSelectorAudit` which is updated)
- **No new files needed**
- **Do NOT modify any research scripts or docs**

---

## Verification

### 1. Type check
```bash
npx tsc --noEmit
```

### 2. Build check
```bash
npm run build
```

### 3. Functional verification

After build passes:

- Navigate to Performance page → Selector strategy
- Should show updated description mentioning "strength and commercial tie-break"
- Performance numbers should match research: ~+88.49%, ~1.91% DD, ~58.9% WR
- The old `strength_tiebreak` behavior is still accessible via `resolveSelectorStrengthTiebreakAudit` for research

### 4. Refresh performance data

```bash
npx tsx scripts/refresh-performance-latest.ts
```

Verify output mentions engine version v18 and selector-engine-v7.

---

## Important Warnings

1. **The new variant function uses `directionMatchesCommercial`** — a new helper that parallels the existing `directionMatchesStrength`. Both check if a direction matches a source, returning false when either side is NEUTRAL.

2. **Sentiment wins ties.** When both sides have equal supporter count, sentiment wins. This is the sentiment-first bias that matches the base policy's philosophy.

3. **The old `strength_tiebreak` variant function stays in the codebase.** Do NOT remove it. It's still dispatched when variant === "strength_tiebreak" and is used by research scripts via `resolveSelectorStrengthTiebreakAudit`.

4. **Both version bumps are mandatory:**
   - `SELECTOR_ENGINE_VERSION`: v6 → v7 (invalidates selector cache)
   - `STRATEGY_ARTIFACT_ENGINE_VERSION`: v17 → v18 (invalidates strategy artifact cache)

5. **`resolveSelectorDirections` does not need changes.** It calls `resolveSelectorAudit` which now routes to `strength_commercial_tiebreak`. All downstream consumers (weeklyHoldEngine, basketSignals) get the new behavior automatically.

6. **File header standard applies.**

7. **Do NOT modify any research scripts or docs.**

---

## Expected Production Behavior After Ship

- **Selector strategy:** Same label "Selector", updated description
- **Trade count:** 360/week (same as before — tiebreak never skips)
- **Performance:** +88.49%, 1.91% DD, 58.9% WR, 2 losing weeks
- **Key behavioral change:** In sentiment-vs-dealer conflicts where strength supports dealer but commercial supports sentiment, the direction now stays with sentiment (was dealer). This reduces the worst-week drawdowns.
- **Research access:** Old baseline still available via `resolveSelectorStrengthTiebreakAudit()`
