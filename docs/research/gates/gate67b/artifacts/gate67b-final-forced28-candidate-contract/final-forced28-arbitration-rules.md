# Gate 67B Final Forced-28 Arbitration Rules

The final algorithm remains unnamed. These are candidate contracts only.

## Candidate A - Macro Anchor Conservative

- Regime/RRP is the candidate anchor.
- RRP can select direction only when valuation_gap REER confirms it.
- If valuation does not confirm RRP, fallback is Alpha v1 continuity.
- High-confidence clean COT contradiction can warning-veto RRP to Alpha continuity.
- Strength can confirm timing but cannot override.

## Candidate B - Macro Anchor With COT Warning

- RRP is anchor.
- High-confidence clean COT contradiction falls back to Alpha v1 continuity.
- Strength confirms timing but cannot override.
- Valuation confirms macro but cannot override by itself.
- Scenario memory is not direct-vote.

## Candidate C - Scenario-Memory Guarded

- RRP/valuation anchor is used when valuation confirms RRP; otherwise Alpha continuity is the fallback anchor.
- COT and Strength act as confirm/warn layers.
- Scenario memory can enable veto/fallback only when the Gate 65D cell-agreement group is high-support, covers at least three years, is not low-support flagged, and is not concentrated.
- Scenario memory cannot choose a fresh direction. It only allows COT/Strength clean agreement to veto to their shared direction, or downgrade to Alpha fallback when they are not both direct-vote clean.

## Fixed Boundary

- No optimized thresholds.
- No learned weights.
- No pair exclusions.
- No date exclusions.
- No final algorithm name.
- No promotion.
