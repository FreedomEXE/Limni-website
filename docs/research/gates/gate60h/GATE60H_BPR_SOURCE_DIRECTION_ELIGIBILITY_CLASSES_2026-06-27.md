# Gate 60H BPR Source-Direction Eligibility Classes

Generated: `2026-06-27T17:29:35.206Z`

## Verdict

`PASS_BPR_SOURCE_DIRECTION_ELIGIBILITY_CLASSES_LOCKED__GATE60G_ARTIFACTS_ONLY__NO_REGIME_SIDE`

## Boundary

- Gate 60G artifacts only.
- BPR source-direction eligibility classes only.
- Direction remains `BASE_CURRENCY` / `QUOTE_CURRENCY`; no LONG/SHORT side.
- No Regime transform, broad matrix, side construction, P&L, attribution, Alpha v2, risk, execution, MT5/live, app work, or source mutation.

## Denominator

- Pair rows: `10444` / `10444`
- Alpha weeks: `373` / `373`
- Symbols/week histogram: `{"28":373}`
- Duplicate row keys: `0`
- Neutral pair-direction rows: `0`
- Non BASE_CURRENCY/QUOTE_CURRENCY rows: `0`

## Eligibility Decision Table

| Class | Scope | Source-direction | Promotion | Decision | Currency rows | Pair occurrences | Pair rule rows | Promotion count | Shadow count | Fail-closed count |
|---|---|---:|---:|---|---:|---:|---:|---:|---:|---:|
| raw_present | currency_state_quality | eligible_when_numeric | always_eligible | promotion_eligible | 1805 | 12635 | 0 | 12635 | 0 | 0 |
| carried_fresh | currency_state_quality | eligible_when_numeric | always_eligible | promotion_eligible | 131 | 917 | 0 | 917 | 0 | 0 |
| carried_stale | currency_state_quality | eligible_when_numeric | not_eligible | shadow_only | 291 | 2037 | 0 | 0 | 2037 | 0 |
| synthetic_usd | currency_state_quality | eligible_when_numeric | conditional_row_level | source_direction_eligible | 370 | 2590 | 0 | 686 | 1904 | 0 |
| single_numeric_state_degraded | pair_direction_rule | not_eligible | not_eligible | shadow_only | 0 | 0 | 2142 | 0 | 2142 | 0 |
| deterministic_unresolved_currency_rank_fallback | pair_direction_rule | not_eligible | not_eligible | fail_closed | 0 | 0 | 259 | 0 | 0 | 259 |
| timing_blocked_carry | currency_state_quality | eligible_when_numeric | not_eligible | shadow_only | 7 | 49 | 0 | 0 | 49 | 0 |
| unresolved_no_prior | currency_state_quality | not_eligible | not_eligible | fail_closed | 375 | 2625 | 0 | 0 | 0 | 2625 |
| unresolved_source_ambiguous | currency_state_quality | not_eligible | not_eligible | fail_closed | 5 | 35 | 0 | 0 | 0 | 35 |

## Gate 60G Pair-Level Counts

- Source-direction eligible pair rows: `8043`
- Source-direction ineligible pair rows: `2401`
- Promotion eligible pair-direction rows: `5113`
- Promotion ineligible pair-direction rows: `5331`
- BASE_CURRENCY direction rows: `4403`
- QUOTE_CURRENCY direction rows: `6041`

## Stop Line

Gate 60H stops after locking BPR source-direction eligibility classes. It does not proceed to BPR promotion or Regime construction.
