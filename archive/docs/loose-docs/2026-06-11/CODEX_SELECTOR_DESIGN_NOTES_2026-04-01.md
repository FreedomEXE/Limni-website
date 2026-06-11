# Selector Design Notes

Date: 2026-04-01

## Context Captured

User follow-up after selector math fix:

- Commercial appears to be the weakest standalone weekly-hold performer in backtests.
- The current selector needs to become more straightforward and more robust.
- Goal: reduce discrepancies between research scripts, basket truth, and app selector behavior.

## Commercial Reframing

The most useful interpretation of Commercial is probably not:

- "weekly directional voter equal to sentiment/dealer"

It is more likely:

- "slow regime / value / accumulation-distribution signal"

Working hypothesis from the user-provided discussion:

- Commercial accumulation during a persistent decline can signal undervaluation and a coming reversal.
- The reversal usually does not happen when accumulation begins.
- Extreme positioning matters more than short streaks.
- Slowing accumulation velocity can matter as much as raw position level.
- Entry should wait for a trigger, not fire immediately on Commercial extreme.
- Maximum disagreement between Commercial and trend-following participants may mark the best reversal zones.

This suggests Commercial should be used as:

- reversal watchlist
- regime bias
- override candidate only when paired with confirmation

Not as:

- primary weekly hold direction source

## Recommended Source Roles

Instead of treating all sources as equal directional votes:

- Sentiment: fast contrarian trigger
- Dealer: medium-term positioning / context / override
- Commercial: slow reversal regime state
- Strength: timing / confirmation / veto / tie-break

This is cleaner than forcing Commercial to behave like a weekly entry engine.

## Better Selector Shape

Every source should emit the same canonical object per pair per week:

```ts
type SourceState = {
  direction: "LONG" | "SHORT" | "NEUTRAL";
  signedScore: number;     // directional conviction
  extremity: number;       // how stretched the source is
  reliability: number;     // confidence / coverage / maturity
  regime: "trend" | "reversal" | "neutral";
  reason: string;          // human-readable branch explanation
};
```

Then the selector consumes canonical source states instead of rebuilding source truth from raw tables.

## Cleaner Policy Model

Suggested policy layers:

1. Source truth layer
   - basketSource defines canonical dealer/commercial/sentiment direction
   - strength module defines canonical strength state

2. Context layer
   - normalized extremity
   - strengthening / weakening
   - divergence
   - source reliability

3. Decision layer
   - explicit branch selection with named outcomes

Example branches:

- follow_sentiment
- sentiment_blocked_by_strength
- dealer_override_sentiment
- commercial_regime_bias_only
- commercial_reversal_armed_waiting_for_trigger
- commercial_reversal_confirmed
- fallback_dealer

The key point: no hidden fallback chain and no silent reinterpretation of raw source truth.

## Commercial-Specific Ideas

Commercial should probably use different features from dealer/sentiment:

- long-horizon COT index / percentile
- accumulation streak length
- accumulation velocity change
- divergence vs dealer or spec-style proxy
- reversal trigger confirmation

Candidate implementation ideas:

### 1. Commercial Regime State

Classify Commercial as:

- accumulation_long
- distribution_short
- neutral

This is not yet a trade signal. It is regime context.

### 2. Commercial Reversal Readiness

Build a readiness score from:

- percentile extreme
- weeks in accumulation/distribution
- velocity slowdown
- disagreement with dealer/trend source

Example:

```ts
commercialReversalReady =
  extremePercentile > 0.9 &&
  streakWeeks >= 4 &&
  velocityDelta < 0 &&
  divergenceScore > threshold;
```

### 3. Triggered Use Only

Allow Commercial to affect final direction only if one of these confirms:

- strength flips toward Commercial direction
- sentiment extreme unwinds toward Commercial direction
- dealer stops opposing it
- price/technical trigger exists

Until then, Commercial is a watch state, not an entry command.

## Proposed Simplification Path

Short version:

- remove Commercial from equal voting
- keep Sentiment as primary fast source
- keep Dealer as context override
- add Strength as confirmation / veto
- repurpose Commercial as a slow reversal regime module

That would likely reduce both:

- false precision
- unexplained selector disagreements

## Architecture Recommendation

To avoid future drift, all app/research work should use one shared selector pipeline:

- canonical source adapters
- selector context builder
- selector policy engine
- selector audit artifact

The audit artifact should persist per pair per week:

- raw source directions
- normalized scores
- branch selected
- final direction

If totals change, the system should tell us exactly which pair-weeks moved and why.

## Practical Next Step

Best next refactor before adding more logic:

- extract source adapters
- make selector consume canonical source states only
- keep full branch audit permanently

Then add Strength.

After that, reintroduce Commercial in its new role as regime/reversal context instead of equal weekly voter.
