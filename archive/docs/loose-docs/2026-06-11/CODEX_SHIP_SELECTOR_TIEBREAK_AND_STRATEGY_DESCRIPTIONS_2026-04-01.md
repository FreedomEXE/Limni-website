# Ship Selector Tie-Break + Strategy Descriptions

Date: 2026-04-01
Status: Ready for implementation

## Overview

Two independent tasks in one prompt. They share no code paths and can be implemented in either order.

1. **Promote Variant C (strength tie-break) to production selector**
2. **Add strategy descriptions to the performance notes tab**

---

## Task 1: Promote Strength Tie-Break to Production

### Context

The selector experiment tested three strength variants and two commercial overlays. Results:

| Variant | Return | DD | Verdict |
|---------|--------|----|---------|
| Baseline (no strength) | +173.29% | -15.08% | Old production |
| Confirmation (A) | +173.29% | -15.08% | Audit only |
| Veto (B) | +146.73% | -16.79% | Too aggressive |
| **Tie-break (C)** | **+187.66%** | **-14.09%** | **Winner** |
| Commercial skip | +126.28% | -22.95% | Removed winners |
| Commercial narrow skip | +157.61% | -14.41% | Still worse |

Variant C (strength tie-break) is the clear winner. It should become the production selector.

### What to change

**File: `src/lib/performance/selectorEngine.ts`**

1. Change `resolveSelectorAudit()` to use `strength_tiebreak` instead of `strength_confirmation`:

```ts
// BEFORE (line ~1037):
export async function resolveSelectorAudit(
  weekOpenUtc: string,
): Promise<SelectorAuditWeek> {
  return resolveSelectorAuditInternal(weekOpenUtc, "strength_confirmation");
}

// AFTER:
export async function resolveSelectorAudit(
  weekOpenUtc: string,
): Promise<SelectorAuditWeek> {
  return resolveSelectorAuditInternal(weekOpenUtc, "strength_tiebreak", { requireStrength: true });
}
```

2. Bump `SELECTOR_ENGINE_VERSION` to `"selector-engine-v6"` to invalidate cached results.

3. `resolveSelectorDirections()` calls `resolveSelectorAudit()` so it will automatically use the new path. No change needed there.

### What NOT to change

- Do not remove the research audit functions (`resolveSelectorStrengthVetoAudit`, `resolveSelectorCommercialCautionSkip`, etc.). They remain available for future research.
- Do not change the tie-break policy logic itself. It is already correct.
- Do not change the `policySentimentContextOverride` base policy. Tie-break runs on top of it.

### Update selector description

**File: `src/lib/performance/strategyConfig.ts`**

Update the selector strategy description to reflect the new production behavior:

```ts
// BEFORE:
{
  id: SELECTOR_SENTIMENT_OVERRIDE_STRATEGY_ID,
  label: "Selector",
  type: "single",
  description: "Selector Sentiment Override: follow sentiment unless stretched+weakening → COT override",
  cardBreakdown: "asset_class",
},

// AFTER:
{
  id: SELECTOR_SENTIMENT_OVERRIDE_STRATEGY_ID,
  label: "Selector",
  type: "single",
  description: "Sentiment-primary with strength tie-break: follow sentiment, use dealer override when stretched+weakening, strength resolves sentiment vs dealer disagreements",
  cardBreakdown: "asset_class",
},
```

### Verification

After making the change:

1. Run `npx tsx scripts/verify-selector-strength-tiebreak.ts` — result should still be +187.66% / -14.09%
2. Run `npx tsx scripts/verify-selector-parity.ts` — **this will fail** because baselines changed. Update the parity script baselines to match the new production numbers (+187.66% / -14.09%)
3. Run `npm test`
4. Run `npm run build`

### Parity script update

**File: `scripts/verify-selector-parity.ts`**

Find the baseline constants and update them to the tie-break numbers. The exact variable names may differ — search for the old baseline values (+173.29% and -15.08%) and replace with +187.66% and -14.09%.

---

## Task 2: Strategy Descriptions in Performance Notes Tab

### Context

The performance section has a "Notes" tab in the modal for each strategy card. When viewing "all time", it currently shows generic text like:

- `"Tier 1 contribution across the canonical weekly reconstruction."`
- `"dealer normalized 1x return across the canonical weekly reconstruction."`

Freedom wants these to show **meaningful descriptions of what each strategy IS and how it works**, so he can quickly reference the logic behind each system.

### What exists

- `StrategyConfig` in `strategyConfig.ts` already has a `description` field per strategy
- The `note` field on `ModelPerformance` is generated in `src/app/performance/page.tsx`
- For tiered strategies: lines ~316 (all-time), ~273 (per-week), ~532 (current-week)
- For single/normalized strategies: lines ~774 (all-time), ~748 (per-week)

### What to change

**File: `src/lib/performance/strategyConfig.ts`**

Update the `description` field on each strategy to be a clear, human-readable explanation:

```ts
{
  id: "dealer",
  label: "Dealer",
  type: "single",
  description: "Follows COT dealer/intermediary net positioning. Dealers (banks, brokers) are the informed counterparty — when they build a directional position, it signals institutional flow. Direction is derived from the net long/short positioning of dealer/intermediary category in the COT report, normalized over a 156-week lookback.",
  cardBreakdown: "asset_class",
},
{
  id: "commercial",
  label: "Commercial",
  type: "single",
  description: "Follows COT commercial/hedger net positioning. Commercials are producers and consumers hedging physical exposure — they buy low and sell high at extremes, making them structurally early but eventually correct on major turns. As a standalone weekly system it suffers large drawdowns because it fades trends before they reverse.",
  cardBreakdown: "asset_class",
},
{
  id: "sentiment",
  label: "Sentiment",
  type: "single",
  description: "Contrarian retail sentiment. When the retail crowd is heavily long, go short and vice versa. Uses aggregated net positioning from retail brokers, normalized over a 52-week lookback. Strong standalone edge in crypto and FX where retail crowding is a reliable fade signal.",
  cardBreakdown: "asset_class",
},
{
  id: "tiered_v3",
  label: "Tiered V3",
  type: "tiered",
  description: "Three-tier directional voting system: Tier 1 (Dealer), Tier 2 (Commercial), Tier 3 (Sentiment). Each source votes a direction independently. Final basket direction for each pair is determined by the tiered priority — higher tiers override lower tiers when signals conflict. Does not include strength.",
  cardBreakdown: "tiers",
},
{
  id: "agree_2of3",
  label: "2-of-3 Agree",
  type: "agreement",
  description: "Agreement filter requiring at least 2 of 3 sources (Dealer, Commercial, Sentiment) to agree on direction before taking a position. When fewer than 2 agree, the pair is excluded from the basket. Trades fewer pairs but with higher conviction. Does not include strength.",
  cardBreakdown: "asset_class",
},
{
  id: "tandem",
  label: "Tandem",
  type: "tandem",
  description: "Independent sleeve portfolio — each data source (Dealer, Commercial, Sentiment, Strength) runs its own separate basket as an independent sleeve. No voting or combining. Each sleeve is sized and tracked independently. Shows which sources contribute edge and which are dead weight.",
  cardBreakdown: "per_model",
  models: ["dealer", "commercial", "sentiment", "strength"],
},
{
  id: SELECTOR_SENTIMENT_OVERRIDE_STRATEGY_ID,
  label: "Selector",
  type: "single",
  description: "Sentiment-primary with strength tie-break. Follows sentiment as the base signal. When sentiment is at an extreme and weakening, allows a dealer override. When sentiment and dealer disagree, strength (1h+4h+24h composite) breaks the tie. Commercial is excluded from directional decisions — the cleanest multi-source system tested.",
  cardBreakdown: "asset_class",
},
{
  id: "strength",
  label: "Strength",
  type: "single",
  description: "Multi-timeframe currency strength composite. Scores each pair across 1-hour, 4-hour, and 24-hour windows by measuring relative currency performance against all other currencies. Each window votes LONG/SHORT/NEUTRAL, combined into a composite score from -3 to +3. Pure momentum/flow signal with no fundamental input.",
  cardBreakdown: "asset_class",
},
```

### Surface the description in the notes tab

**File: `src/app/performance/page.tsx`**

For **all-time** views, replace the generic note text with the strategy description. The strategy config is available in the page context — find where the `note` field is set for the all-time case and use the strategy's `description` field instead.

There are multiple places where `note` is generated for all-time:

1. **Tiered strategies** (line ~316): Currently `${TIER_LABELS[model]} contribution across the canonical weekly reconstruction.`
   - For tiered, keep the existing note since each card represents a tier, not the full strategy. But add the overall strategy description to the first card or as a header note if possible.

2. **Single/normalized strategies** (line ~774): Currently `${PERFORMANCE_MODEL_LABELS[options.model]} normalized 1x return across the canonical weekly reconstruction.`
   - Replace with the strategy `description` from `strategyConfig.ts`.

For **per-week** views, keep the existing per-week notes (they describe what happened that specific week). The strategy description is for all-time only.

For **current-week** views, keep the existing text.

### How to access strategy description in page.tsx

The strategy config is already available. In `src/app/performance/page.tsx`, the `strategy` parameter flows through from the URL params. You can import `getStrategy` from `strategyConfig.ts` and look up the description:

```ts
import { getStrategy } from "@/lib/performance/strategyConfig";

// Then where the note is generated for all-time:
const strategyConfig = getStrategy(strategyId);
const note = strategyConfig?.description ?? `${label} contribution across the canonical weekly reconstruction.`;
```

The exact integration point depends on which builder function generates the `ModelPerformance` for each view type. Trace from where `note:` is set in the all-time branch and replace the generic string with the strategy description.

### What NOT to change

- Do not change the per-week notes — those stay as temporal context
- Do not change the user-editable localStorage notes in the modal — those are Freedom's manual observations
- Do not change the notes tab UI component itself
- Do not add new UI elements — just change the auto-generated `note` text content

### Verification

1. `npm run build` — must pass
2. `npm test` — must pass
3. Visual check: open Performance page, select "all time", open a strategy card modal, go to Notes tab. Should see the strategy description instead of generic text.

---

## Files Expected to Change

- `src/lib/performance/selectorEngine.ts` — bump version, change `resolveSelectorAudit` to use tie-break
- `src/lib/performance/strategyConfig.ts` — update all strategy descriptions
- `src/app/performance/page.tsx` — surface strategy description in all-time note
- `scripts/verify-selector-parity.ts` — update baselines to tie-break numbers

## Success Criteria

1. Selector production path uses strength tie-break
2. Engine version bumped to v6
3. All existing tests pass
4. Parity script updated and passing with new baselines
5. Strategy descriptions visible in notes tab when viewing all-time
6. Per-week and current-week notes unchanged
7. User-editable notes unchanged
