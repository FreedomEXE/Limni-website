# Research Context: Blended Weighted vs Agreement Filter

**Date logged**: 2026-02-13  
**Scope**: Preserve test rationale and outcomes for later re-validation

## Why this test was run

Hypothesis: current `blended_weighted` (60% dealer / 40% commercial) may be logically weak in some weeks by over-following dealer bias.  
Proposed alternative: use blended as a strict filter (`dealer` and `commercial` must agree) instead of a weighted combination.

Observed motivation examples (week-level):  
- Potentially reduced USD concentration by staying neutral when dealer/commercial disagree.  
- Potentially better neutral stance in metals (gold/silver) during disagreement weeks.

## Compared variants

1. `blended_weighted` (current): weighted blend of dealer and commercial.
2. `blended_agreement` (proposed): signal only when dealer and commercial agree.

## Artifacts produced

- Current-week comparison: `reports/blended-comparison-2026-02-12.md`
- Current-week raw JSON: `reports/blended-comparison-2026-02-12.json`
- Historical (available weeks) comparison: `reports/blended-historical-20w-2026-02-12.md`
- Historical raw JSON: `reports/blended-historical-20w-2026-02-12.json`
- Script used in that session: `scripts/research-blended-agreement-historical.ts`

## Reported outcomes from the test session

### Current week snapshot (report date 2026-02-03 data)

- `blended_weighted`: +21.41%, 24 signals, 70.8% win rate
- `blended_agreement`: +13.51%, 3 signals, 66.7% win rate

Interpretation from session: agreement reduced exposure and filtered out many trades, including FX and commodities in that week.

### Historical window available at test time

- Available history: 4 weeks
- `blended_weighted`: +78.30% total, 21.5 signals/week, won 4/4 weeks
- `blended_agreement`: +44.53% total, 1.5 signals/week, won 0/4 weeks

Interpretation from session: strict agreement likely too restrictive in this dataset and window.

## Important caveats (do not overfit)

- Only 4 historical weeks were available during this comparison.
- `blended_agreement` signal count was very small (6 total), which raises variance risk.
- This result should be treated as provisional until longer history is available (recommended: 10-20+ additional closed weeks).

## Decision at this stage

- Do not change production logic yet.
- Keep this as a tracked research thread for future re-test with deeper history and possibly a softer agreement variant.

## Follow-up ideas for future runs

1. Re-run once additional closed weeks are available.
2. Add "soft agreement" variants (for example: confidence threshold or partial alignment rules).
3. Evaluate not just return, but exposure concentration (USD-heavy weeks), drawdown, and class-level stability.
