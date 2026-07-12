# Gate 60H BPR Eligibility Decision Table

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
