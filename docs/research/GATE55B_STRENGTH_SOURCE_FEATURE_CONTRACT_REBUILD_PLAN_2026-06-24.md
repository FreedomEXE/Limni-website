# Gate 55B Strength Source / Feature Contract Rebuild Plan

Date: 2026-06-24

## Objective

Gate 55B keeps Gate 55 open, but changes the work from legacy selected-vs-fade
scoring to design-only Strength source-contract rebuilding.

The active research question remains:

`Does Strength contain broad repeatable directional information, and does it work better as selected direction, fade direction, or neither?`

Gate 55A showed that the current Friday Strength artifact is not sufficient to
answer that question at the same evidence standard as COT. Gate 55B defines the
source and feature contract required before selected-vs-fade testing can be
reopened.

## Governance Position

Strength should not be scrapped.

Strength should not be promoted.

Strength should not be combined with COT yet.

Strength is demoted from candidate signal baseline to legacy diagnostic
requiring source-contract rebuild.

## Allowed In Gate 55B

- Define Strength raw input identity.
- Define point-in-time availability rules.
- Define historical warmup/backfill requirements before `2019-01-07`.
- Define immutable source hashes and receipt lineage.
- Define weekly 28-pair completeness rules.
- Define missing, neutral, tie, stale, and fallback handling.
- Define daily, weekly, and monthly Strength horizons.
- Define raw strength values, pair-relative deltas, ranks, z-scores,
  percentile ranks, trend, and acceleration fields.
- Define bucket taxonomy.
- Define receipts required before selected-vs-fade testing reopens.

## Not Allowed In Gate 55B

- No choosing best horizon by PnL.
- No threshold optimization.
- No pair filtering.
- No COT combination.
- No regime overlay.
- No BPR/RRP retests.
- No PPP/NEER/REER work.
- No execution optimization.
- No risk overlay.
- No production/live/MT5 claims.
- No final Signal Model selection.

## Required Source Contract

The rebuilt Strength source contract must specify:

1. Raw source identity:
   - Vendor/source name.
   - Retrieval endpoint or local source identity.
   - Instrument universe.
   - Timestamp semantics.
   - Timezone normalization.
   - Source availability precision.

2. Point-in-time rule:
   - What Strength state is available before each weekly decision.
   - Exact cutoff for Friday Strength snapshots.
   - Whether weekend/market-open fallbacks are allowed.
   - How late, stale, or unavailable rows fail closed.

3. Historical backfill:
   - Backfill must extend before `2019-01-07` enough to support warmup.
   - Warmup length must be declared before outcome testing.
   - Backfill receipts must include row counts, min/max timestamps, and source
     hashes.
   - Backfill must not overwrite frozen matrix data without explicit approval.

4. Completeness:
   - Each eligible week should produce 28 pair-level Strength decisions.
   - The system must report parent rows, retained rows, removed rows, full
     weeks, partial weeks, unavailable weeks, and missing price rows.
   - Any partial week must have a deterministic no-lookahead handling rule.

5. Missing, neutral, tie, stale, and fallback handling:
   - `MISSING` means no usable source state.
   - `NEUTRAL` means source state exists but no direction is selected.
   - `TIE` means the calculation cannot choose between sides.
   - `STALE` means the latest source state is older than the accepted age
     threshold.
   - Fallbacks must be deterministic, point-in-time, and separately counted.

## Required Feature Contract

The rebuilt Strength feature set should persist enough information to audit the
decision, not just the final selected side.

Minimum fields:

- Raw currency strength value by currency.
- Pair-relative strength delta.
- Direction selected from pair-relative delta.
- Direction confidence or magnitude.
- Currency rank.
- Pair rank.
- Cross-sectional z-score.
- Rolling z-score.
- Percentile rank.
- Trend slope.
- Acceleration or second-difference.
- Source timestamp.
- Feature timestamp.
- Feature horizon.
- Warmup status.
- Staleness age.
- Missing/tie/neutral reason.

## Horizons

Gate 55B should define the feature schema for at least three horizons before
testing:

- Daily or short-term Strength.
- Weekly or intermediate Strength.
- Monthly or structural Strength.

These horizons should be defined as feature contracts first. Gate 55B must not
pick a winning horizon by PnL.

## Candidate Bucket Taxonomy

The rebuilt Strength model should support COT-style behavior buckets, but the
buckets must be declared before outcome scoring.

Initial taxonomy:

1. `FOLLOW_STRENGTH`
   - Strength is directional and continuation-like.
   - Selected direction is the hypothesis.

2. `FADE_OVEREXTENSION`
   - Strength is stretched or overextended.
   - Fade direction is the hypothesis.

3. `NEUTRAL_NO_EDGE`
   - Strength has no actionable directional information.
   - No selected/fade claim should be made.

The taxonomy can use combinations of level, rank, z-score, percentile, trend,
acceleration, and horizon alignment, but thresholds must be declared as source
and feature rules before PnL testing.

## Required Receipts Before Testing Reopens

Before selected-vs-fade testing can reopen, Gate 55B requires:

- Source inventory receipt.
- Historical backfill receipt.
- Warmup receipt.
- Point-in-time availability receipt.
- Feature schema receipt.
- 28-pair weekly completeness receipt.
- Missing/tie/neutral/stale handling receipt.
- Hash/lineage receipt.
- No-lookahead audit receipt.
- Frozen test command and output path.

## Pass/Fail Criteria

Gate 55B may pass only if:

- The rebuilt Strength source can be reconstructed from auditable inputs.
- The rebuilt feature contract covers the full historical matrix window with
  approved warmup.
- Each eligible week can produce 28 pair-level decisions or explicitly counted
  no-lookahead fallbacks.
- Raw values and derived feature fields are persisted for audit.
- Missing, neutral, tie, stale, and fallback rows are separable.
- No outcome scoring was used to tune source rules, thresholds, pair inclusion,
  or horizon selection.

Gate 55B fails or blocks if:

- Historical source coverage cannot be reconstructed.
- Backfill cannot produce point-in-time auditable rows.
- The contract cannot support 28-pair weekly completeness.
- Feature rows cannot be traced to immutable source hashes.
- Testing pressure causes threshold, pair, or horizon optimization before the
  source contract is frozen.

## Reopen Boundary

Only after Gate 55B passes may Gate 55 reopen selected-vs-fade testing under
the rebuilt Strength contract.

Reopened testing must still report selected and fade separately under both ADR
Grid and simple weekly hold. It must not combine with COT until a later named
gate explicitly authorizes that work.
