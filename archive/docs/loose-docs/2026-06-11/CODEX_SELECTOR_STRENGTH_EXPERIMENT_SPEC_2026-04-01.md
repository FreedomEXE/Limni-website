# Selector Strength Experiment Spec

Date: 2026-04-01
Status: Ready to implement

## Goal

Run the first clean selector upgrade by adding `strength` to the selector decision process without changing the role of `commercial`.

This is an experiment, not yet the final architecture refactor.

The objective is to answer one narrow question:

- does adding `strength` improve selector timing and reduce avoidable bad calls without breaking the crypto math fix?

## Hard Boundaries

For this pass:

- `commercial` stays out of final selector decision changes
- no new strength derivation path is allowed
- no new raw-table interpretation of strength is allowed
- strength must come only from the existing canonical weekly strength source

Specifically:

- use [weeklyStrength.ts](/C:/Users/User/Documents/GitHub/limni-website/src/lib/strength/weeklyStrength.ts)
- read strength only through `readWeeklyPairStrengths(weekOpenUtc)`
- do **not** reuse `evaluateStrengthGate()` for selector policy
- do **not** add separate strength math in research scripts

Reason:

- if the selector and the `strength` strategy read different strength truth, the experiment becomes uninterpretable

## Current Selector Baseline

Current production candidate:

- `selector_sentiment_override`

Current high-level logic:

- `sentiment` is primary
- `dealer` / `commercial` are COT override or fallback context
- strength is not yet part of selector decisions

This experiment keeps that baseline and only inserts strength as:

- confirmation
- veto
- tie-break

in three separate variants

## Canonical Strength Input

The selector should consume these existing fields from `readWeeklyPairStrengths()`:

- `compositeScore`
- `compositeDirection`
- `windows`

`compositeScore` is already the canonical selector-grade summary:

- each of `1h`, `4h`, `24h` contributes:
  - `LONG` = `+1`
  - `NEUTRAL` = `0`
  - `SHORT` = `-1`
- total range is `[-3, +3]`

## Strength Relation Model

Strength is evaluated against the selector's proposed direction.

Definitions:

- `agree`
  - `compositeScore` has the same sign as proposed direction
- `neutral`
  - `compositeScore === 0`
- `disagree`
  - `compositeScore` has the opposite sign of proposed direction
- `strong_agree`
  - same sign and `abs(compositeScore) >= 2`
- `strong_disagree`
  - opposite sign and `abs(compositeScore) >= 2`

This keeps confirmation cheap and veto expensive.

## Variant Order

Run these in strict order:

1. confirmation
2. veto
3. tie-break

Do not combine them initially.

Reason:

- each variant answers a different question
- combining them immediately makes attribution impossible

## Variant A: Strength Confirmation

### Intent

Test whether strength helps when it supports the selector's chosen direction.

### Policy

Keep the current selector logic unchanged until it produces a proposed direction.

Then classify strength relation to that proposed direction.

Behavior:

- if strength is `agree` or `strong_agree`
  - keep the proposed direction
  - mark branch as strength-confirmed
- if strength is `neutral`
  - keep the proposed direction
  - mark branch as no-strength-confirmation
- if strength is `disagree` or `strong_disagree`
  - keep the proposed direction anyway
  - mark branch as strength-disagreed-but-not-blocking

### What changes

- only audit / branch labeling
- optionally confidence metadata if desired

### What does not change

- final direction should not change from current selector

### Why run it first

- verifies the audit path
- proves strength integration is reading canonical source correctly
- gives a no-risk baseline for later variants

## Variant B: Strength Veto

### Intent

Test whether strength can block weak or mistimed selector calls.

### Policy

Run the current selector first and get proposed direction.

Then apply strength:

- if strength is `strong_disagree`
  - veto the proposed direction
- else
  - keep the proposed direction

### Veto behavior

For this first pass, veto means:

- return `NEUTRAL` in the experiment artifact
- do not replace with the opposite side yet

Reason:

- flipping direction introduces a second policy assumption
- first we only want to know whether the trade should have been blocked

### Branch names

- `strength_veto_blocked`
- `strength_veto_passed`
- `strength_veto_neutral`

### Important note

This is the only variant where `NEUTRAL` is allowed in the experiment result.

That means this variant must be tested in research mode first, not immediately pushed into production selector behavior.

## Variant C: Strength Tie-Break

### Intent

Test whether strength can resolve ambiguity between `sentiment` and `dealer`.

### Entry condition

Only engage tie-break if:

- `sentiment` direction exists
- `dealer` direction exists
- `sentiment` and `dealer` disagree

### Policy

When they disagree:

- if strength agrees with `sentiment`
  - choose `sentiment`
- if strength agrees with `dealer`
  - choose `dealer`
- if strength is `neutral`
  - fall back to current selector logic
- if strength disagrees with both or is ambiguous
  - fall back to current selector logic

### Branch names

- `strength_tiebreak_sentiment`
- `strength_tiebreak_dealer`
- `strength_tiebreak_neutral_fallback`
- `strength_tiebreak_ambiguous_fallback`

### Why this is third

- it changes actual decisions
- but only in disagreement states
- that makes it more controlled than a broad veto layer

## Recommended First Implementation Shape

Do not rewrite the architecture yet.

Instead:

1. keep the current selector engine
2. add a strength context loader using `readWeeklyPairStrengths()`
3. attach strength data to the per-pair weekly context
4. add experiment-only policy variants
5. emit full audit output

This allows research on the current architecture while keeping the strength source canonical.

## Suggested New Context Shape

Add strength to selector context:

```ts
type SelectorStrengthContext = {
  compositeScore: number;
  compositeDirection: "LONG" | "SHORT" | "NEUTRAL";
  availableWindows: number;
};
```

And include it in the per-pair selector context.

## Required Audit Output

This is non-negotiable.

Every experiment result must persist or print a per-pair per-week audit row containing:

- `weekOpenUtc`
- `pair`
- `assetClass`
- `sentimentScore`
- `sentimentDirection`
- `dealerScore`
- `dealerDirection`
- `commercialScore`
- `commercialDirection`
- `strengthCompositeScore`
- `strengthCompositeDirection`
- `strengthRelationToProposed`
- `selectorVariant`
- `baseSelectorBranch`
- `strengthBranch`
- `finalDirection`

Optional but useful:

- `sentimentExtremity`
- `dealerExtremity`
- `commercialExtremity`
- `strengthAvailableWindows`

## Research Output Requirements

For each variant, report:

- total return
- max drawdown
- trade count
- per-asset-class return
- BTC/ETH weekly direction audit
- changed pair-weeks vs current selector baseline
- branch counts

Branch counts matter because they show whether strength is actually doing work or just sitting idle.

## Success Criteria

### Global

- crypto Jan 19 fix must remain intact
- no reintroduction of one-sided COT inversion behavior
- no new strength truth path

### Confirmation variant

- output should prove canonical strength integration works
- final decisions should match current selector
- audit artifact should show agreement/disagreement states clearly

### Veto variant

- should reduce obviously poor mistimed calls
- should not neutralize too many trades
- should be especially watched in indices and commodities

### Tie-break variant

- should improve disagreement handling between `sentiment` and `dealer`
- should remain easy to explain pair by pair
- should not create large regressions in crypto

## What Not To Change

For this experiment:

- do not change `basketSource.ts`
- do not repurpose `commercial`
- do not build the full clean architecture yet
- do not combine confirmation + veto + tie-break into one policy on day one

## Files Expected To Change

Likely first-pass implementation files:

- [selectorEngine.ts](/C:/Users/User/Documents/GitHub/limni-website/src/lib/performance/selectorEngine.ts)
  - add strength context loading
  - add experiment policy variants
  - add strength-aware audit details
- [weeklyStrength.ts](/C:/Users/User/Documents/GitHub/limni-website/src/lib/strength/weeklyStrength.ts)
  - no behavior changes expected
  - source only
- new experiment script under `scripts/`
  - compare variants against current selector baseline

## Recommended Implementation Order

1. Add strength context to selector engine using `readWeeklyPairStrengths()`
2. Add audit fields without changing baseline selector behavior
3. Implement confirmation variant
4. Implement veto variant
5. Implement tie-break variant
6. Backtest all three independently
7. Compare changed pair-weeks, not just aggregate totals

## Expected Next Decision After This Experiment

After these three runs:

- if strength meaningfully improves timing, keep it in selector design
- if it only helps in certain asset classes, split policy by asset class
- only after that revisit `commercial` as a slow regime/reversal module

Do not touch `commercial` before the strength experiment is settled.
