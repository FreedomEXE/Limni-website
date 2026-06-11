# Selector Commercial Caution Spec

Date: 2026-04-01
Status: Ready for implementation after review

## Goal

Add `commercial` to the selector stack without using it as a weekly directional voter.

This experiment starts from the current winning research result:

- `Variant C` (`strength_tiebreak`)

Commercial is added only as a:

- caution flag
- confidence reducer
- optional skip filter

Commercial must **not** set or flip direction in this pass.

## Why This Is the Right Framing

Backtest evidence and market structure both point to the same conclusion:

- commercial works poorly as a standalone weekly directional source
- commercials are hedgers, not tactical timers
- they are often structurally early
- they can be correct on the larger turn while still losing badly in weekly-hold space

So the right interpretation is:

- commercial extremity = regime transition probability

Not:

- commercial direction = trade direction for this week

## Base Engine

The directional engine for this experiment is:

- `strength_tiebreak`

That means:

- `sentiment` remains primary
- `dealer` remains the alternate directional source
- `strength` resolves `sentiment` vs `dealer` disagreement
- `commercial` only modifies trust in the chosen result

## Hard Rules

For this experiment:

- commercial does not choose direction
- commercial does not override direction
- commercial does not break ties
- commercial only affects confidence or eligibility

If commercial is used to flip direction, that is a different experiment and should not be mixed into this one.

## Commercial Signal to Use

Pass one should stay simple.

Use only:

- commercial score
- commercial direction
- commercial extremity

from the same corrected selector math already used in [selectorEngine.ts](/C:/Users/User/Documents/GitHub/limni-website/src/lib/performance/selectorEngine.ts)

Specifically:

- same one-sided normalization fix
- same COT lookback window
- no new commercial math path

Do **not** add yet:

- velocity
- accumulation streaks
- multi-horizon commercial models
- divergence taxonomy
- regime labels beyond a simple caution state

Those belong to later passes.

## Caution Condition

Commercial should raise caution only when both are true:

1. commercial extremity is high
2. commercial disagrees with the current Variant C final direction

Starting threshold:

- `commercialExtremity >= 0.85`

Starting disagreement rule:

- `commercialDirection !== finalDirection`
- ignore if commercial direction is effectively neutral

So the simplest condition is:

```ts
commercialCaution =
  commercialExtremity >= 0.85 &&
  commercialDirection !== "NEUTRAL" &&
  commercialDirection !== finalDirection;
```

## Variant Order

Run these in strict order:

1. `audit_only`
2. `caution_skip`
3. `caution_reduce`

Do not combine them at first.

## Variant 1: Audit Only

### Intent

Measure how often commercial would have warned us against the Variant C direction, without changing any trades.

### Behavior

- final direction stays exactly equal to Variant C
- if caution condition is met, log it
- no trade suppression
- no weighting changes

### Branch names

- `commercial_no_caution`
- `commercial_caution_flag`

### Why first

- proves the audit path
- shows asset-class distribution
- tells us whether commercial caution clusters in commodities, indices, or elsewhere

## Variant 2: Caution Skip

### Intent

Test whether extreme opposing commercial positioning should cause us to skip the trade entirely.

### Behavior

- if caution condition is false:
  - keep Variant C direction
- if caution condition is true:
  - set final direction to `NEUTRAL`

### Branch names

- `commercial_no_caution`
- `commercial_caution_skip`

### Research meaning

- this is a trade suppression experiment
- it asks: when commercial is at a high extreme against us, should we stand down?

## Variant 3: Caution Reduce

### Intent

Test whether commercial is better used as a sizing or confidence reducer than as a hard skip.

### Behavior

- direction stays equal to Variant C
- if caution condition is false:
  - full weight
- if caution condition is true:
  - reduced weight in research mode

### Starting reduction

Use one simple fixed value:

- `0.5x` weight

### Branch names

- `commercial_no_caution`
- `commercial_caution_reduce`

### Important note

This is research-only until weighting can be cleanly represented in the real engine.

## Required Audit Fields

Every pair-week row must include:

- `weekOpenUtc`
- `pair`
- `assetClass`
- `baseVariant`
- `baseDirection`
- `finalDirection`
- `sentimentScore`
- `sentimentDirection`
- `dealerScore`
- `dealerDirection`
- `strengthCompositeScore`
- `strengthCompositeDirection`
- `strengthBranch`
- `commercialScore`
- `commercialDirection`
- `commercialExtremity`
- `commercialCaution`
- `commercialBranch`

Optional but useful:

- `commercialNormalizationMode`
- `commercialCrossesZero`
- `commercialThresholdUsed`

## Required Reporting

Every verifier must report:

- total return
- max drawdown
- trade count
- changed pair-weeks
- branch counts
- per-asset-class returns
- per-asset-class changed pair-weeks
- current-week BTC/ETH focus

But for this experiment, the key output is:

- per-asset-class caution frequency

Because commercial is most likely to matter in:

- commodities
- indices

and may be mostly noise elsewhere.

## Success Criteria

### Audit-only

- no direction changes
- clean branch counts
- clear per-asset caution distribution

### Caution-skip

- does not destroy the basket the way global strength veto did
- ideally improves commodities and/or indices
- does not severely degrade FX or crypto

### Caution-reduce

- smoother drawdown without sacrificing too much return
- likely more realistic than hard skip if commercial is truly a trust modifier

## What Not to Change

For this pass:

- do not change Variant C directional logic
- do not let commercial choose sides
- do not add commercial velocity logic yet
- do not add commercial/dealer/spec divergence models yet
- do not mix in risk-on / risk-off cross-asset logic yet

That can be added in a later regime model pass.

## Likely Implementation Shape

Expected additions:

- extend selector audit to support `commercial_caution_*` variants
- add one research-only resolver for each commercial caution variant
- add one verification script per variant, or one shared verifier with a variant switch

Likely files:

- [selectorEngine.ts](/C:/Users/User/Documents/GitHub/limni-website/src/lib/performance/selectorEngine.ts)
- new script under `scripts/` for commercial caution verification

## Recommended Sequence

1. Add `commercial_audit_only` on top of Variant C
2. Verify caution frequency by asset class
3. Add `commercial_caution_skip`
4. Evaluate by asset class
5. Add `commercial_caution_reduce`
6. Compare skip vs reduce

## Expected Decision After This Experiment

One of these will likely be true:

- commercial caution is useful only in commodities
- commercial caution is useful in commodities + indices
- commercial caution is too blunt globally but useful as a sizing reducer
- commercial caution adds little and should stay purely informational for now

Any of those outcomes are useful.

The wrong outcome would be forcing commercial back into directional voting.
