# Gate 90D Triangle Feature Shadow Audit

Generated: 2026-07-02

## Verdict

`PASS_GATE90D_TRIANGLE_FEATURE_SHADOW_AUDIT_BUILT_NO_REPLAY_NO_FULL_HANDSHAKE`

This is the first Gate 90D evidence pass. It is not a trading replay, not an MT5 build, and not a full currency-family handshake implementation.

## Scope

- Warehouse manifest: `gate74b_trade_leg_path_ECDE7C4A6553`
- Price bundle: `gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953`
- Weeks: `2022-01-10T00:00:00.000Z..2022-02-07T00:00:00.000Z` (5)
- Pairs: `28`
- Grid quantum used for trigger/lock shadow: `0.2 ADR`
- Signal brick: `0.05 ADR`
- Adaptive spacing receipt: `gate90d_range_box_slots_cost_clamped_v0`, `3` target slots, `0.2..0.3 ADR` rails
- Close-event source: `docs/research/gates/gate90/artifacts/gate90d-start-trace-oos4-refresh/close-events.rows.csv`

## Summary

| scope | rows | weeks | pairs | trigger_candidates | pairs_with_trigger | long_triggers | short_triggers | lock_preserve_candidates | shadow_preserved_adr |
|---|---|---|---|---|---|---|---|---|---|
| trigger_feature_ledger | 140 | 5 | 28 | 597 | 122 | 289 | 308 |  |  |
| lock_shadow_ledger | 8738 | 5 | 28 |  |  |  |  | 322 | 400.406879 |

## Trigger Context

| bucket | trigger_candidates | distinct_pair_weeks | long_triggers | short_triggers | bb_true | family_positive | candidate_b_aligned | candidate_b_contra_aligned |
|---|---|---|---|---|---|---|---|---|
| all | 597 | 122 | 289 | 308 | 149 | 101 | 291 | 306 |
| candidate_b_aligned | 291 | 91 | 228 | 63 | 82 | 28 | 291 | 0 |
| candidate_b_contra_aligned | 306 | 92 | 61 | 245 | 67 | 73 | 0 | 306 |
| bb_true | 149 | 69 | 74 | 75 | 149 | 25 | 82 | 67 |
| family_positive | 101 | 39 | 27 | 74 | 25 | 101 | 28 | 73 |

## Geometry Regimes

| geometry_regime | pair_weeks | trigger_candidates | avg_path_efficiency_week | avg_week_range_adr | avg_range_ratio_pair | avg_adaptive_spacing_adr | range_condition_pass_pair_weeks | adaptive_range_condition_pass_pair_weeks | harvestable_candidate_pair_weeks |
|---|---|---|---|---|---|---|---|---|---|
| harvestable_chop_candidate | 140 | 597 | 0.013119 | 2.299976 | 1.051202 | 0.3 | 140 | 140 | 140 |

## Session Geometry Regimes

| geometry_regime | sessions | trigger_candidates | avg_entry_path_efficiency | avg_session_range_adr | avg_entry_range_adr | avg_adaptive_spacing_adr | range_condition_pass_sessions | adaptive_range_condition_pass_sessions | harvestable_candidate_sessions |
|---|---|---|---|---|---|---|---|---|---|
| harvestable_chop_candidate | 734 | 359 | 0.039884 | 0.872854 | 0.710834 | 0.262674 | 734 | 734 | 734 |
| dead_chop_cost_churn | 526 | 238 | 0.040929 | 0.470109 | 0.640635 | 0.2 | 0 | 0 | 0 |

## Lock Shadow By Variant

| variant_id | close_reason | rows | preserve_candidates | shadow_preserved_adr | avg_shadow_preserved_adr |
|---|---|---|---|---|---|
| RAW_GRID_T100_S020_GATE90_RAW_BOTH | session_flatten | 578 | 117 | 171.522992 | 1.466008 |
| RAW_GRID_T100_S020_GATE90_DAVID_CONTRA | session_flatten | 277 | 54 | 88.800436 | 1.644453 |
| RAW_GRID_T100_S020_GATE90_CANDIDATE_B | session_flatten | 281 | 57 | 64.613434 | 1.133569 |
| RAW_GRID_T100_S020_GATE90_STOCH_CONTRA | session_flatten | 182 | 29 | 35.159015 | 1.21238 |
| RAW_GRID_T100_S020_GATE90_DAVID_STOCH_CONFIRM | session_flatten | 123 | 17 | 24.491374 | 1.440669 |
| RAW_GRID_T100_S020_GATE90_RAW_BOTH | target | 2876 | 17 | 5.545043 | 0.326179 |
| RAW_GRID_T100_S020_GATE90_DAVID_CONTRA | target | 1405 | 9 | 3.595159 | 0.399462 |
| RAW_GRID_T100_S020_GATE90_STOCH_CONTRA | target | 923 | 9 | 2.939831 | 0.326648 |
| RAW_GRID_T100_S020_GATE90_DAVID_STOCH_CONFIRM | target | 660 | 6 | 2.123412 | 0.353902 |
| RAW_GRID_T100_S020_GATE90_CANDIDATE_B | target | 1433 | 7 | 1.616183 | 0.230883 |

## Start Traceability

| start_trace_status | rows | session_flatten_rows | target_rows | net_usd | avg_net_usd | profit_factor | win_pct | avg_minutes_from_trigger_to_start |
|---|---|---|---|---|---|---|---|---|
| missing_start_timestamp | 0 | 0 | 0 |  |  |  |  |  |
| invalid_start_timestamp | 0 | 0 | 0 |  |  |  |  |  |
| matched_prior_trigger | 551 | 92 | 459 | 251.955653 | 0.45727 | 2.016007 | 86.751361 | 151.422868 |
| no_in_session_trigger | 8187 | 1349 | 6838 | 2058.208199 | 0.2514 | 1.263598 | 86.783926 |  |

## Start Traceability By Variant

| variant_id | start_trace_status | rows | session_flatten_rows | target_rows | net_usd | avg_net_usd | profit_factor | win_pct | avg_minutes_from_trigger_to_start |
|---|---|---|---|---|---|---|---|---|---|
| RAW_GRID_T100_S020_GATE90_CANDIDATE_B | matched_prior_trigger | 109 | 15 | 94 | 50.333094 | 0.461772 | 2.142084 | 89.908257 | 140.889908 |
| RAW_GRID_T100_S020_GATE90_CANDIDATE_B | no_in_session_trigger | 1605 | 266 | 1339 | 471.143308 | 0.293547 | 1.327045 | 86.666667 |  |
| RAW_GRID_T100_S020_GATE90_DAVID_CONTRA | matched_prior_trigger | 94 | 14 | 80 | 27.166026 | 0.289 | 1.479116 | 86.170213 | 153.904255 |
| RAW_GRID_T100_S020_GATE90_DAVID_CONTRA | no_in_session_trigger | 1588 | 263 | 1325 | 302.55614 | 0.190527 | 1.188473 | 86.775819 |  |
| RAW_GRID_T100_S020_GATE90_DAVID_STOCH_CONFIRM | matched_prior_trigger | 47 | 10 | 37 | 27.292864 | 0.580699 | 2.503219 | 80.851064 | 128.255319 |
| RAW_GRID_T100_S020_GATE90_DAVID_STOCH_CONFIRM | no_in_session_trigger | 736 | 113 | 623 | 266.250406 | 0.361753 | 1.410746 | 88.043478 |  |
| RAW_GRID_T100_S020_GATE90_RAW_BOTH | matched_prior_trigger | 217 | 35 | 182 | 93.074658 | 0.428915 | 1.874731 | 87.096774 | 167.442396 |
| RAW_GRID_T100_S020_GATE90_RAW_BOTH | no_in_session_trigger | 3237 | 543 | 2694 | 765.526087 | 0.236492 | 1.244631 | 86.43806 |  |
| RAW_GRID_T100_S020_GATE90_STOCH_CONTRA | matched_prior_trigger | 84 | 18 | 66 | 54.089011 | 0.643917 | 3.387555 | 85.714286 | 133.892857 |
| RAW_GRID_T100_S020_GATE90_STOCH_CONTRA | no_in_session_trigger | 1021 | 164 | 857 | 252.732258 | 0.247534 | 1.256659 | 87.169442 |  |

## Start Traceability By Geometry

| start_trace_status | geometry_source | geometry_regime | rows | session_flatten_rows | target_rows | net_usd | avg_net_usd | profit_factor | win_pct | avg_minutes_from_trigger_to_start |
|---|---|---|---|---|---|---|---|---|---|---|
| matched_prior_trigger | matched_trigger_session | harvestable_chop_candidate | 289 | 41 | 248 | 220.933711 | 0.764477 | 5.403558 | 91.00346 | 163.560554 |
| matched_prior_trigger | matched_trigger_session | dead_chop_cost_churn | 262 | 51 | 211 | 31.021942 | 0.118404 | 1.156823 | 82.061069 | 138.034351 |
| no_in_session_trigger | pair_week_fallback | harvestable_chop_candidate | 8187 | 1349 | 6838 | 2058.208199 | 0.2514 | 1.263598 | 86.783926 |  |

## Read

- Formula contract hash: `EDAC42D2519046BCC4CBA2ECB42E1524A0AC4D9670517240C19C371E3DAA227B`.
- `pair-week-feature.rows.*` records week-level path efficiency, range ratio, range-condition pass/fail, geometry regime, derived grid quantum, signal brick, and log-only family context.
- `session-geometry.rows.*` records the same efficiency/range regime test at Katarakti session-box resolution so low-efficiency dead churn is not confused with harvestable chop.
- Adaptive spacing receipts use completed session range divided into fixed slots, then apply cost/min/max rails; they are feature receipts only in this pass, not trading replay controls.
- `katarakti-trigger-candidates.rows.*` records session sweep / rejection / displacement trigger candidates in ADR/grid units.
- `geometry-regime-summary.rows.*` separates harvestable chop candidates from dead chop, efficient tail risk, and mixed regimes.
- `grid-lock-shadow.rows.*` reads existing full-stat close events and estimates where a grid-unit lock floor could have preserved MFE.
- `start-traceability.rows.*` matches close-event cycle starts to prior Katarakti trigger candidates when source close events include `start_timestamp_utc`, then carries close-event outcome fields for start-gate shadow scoring.
- `start-traceability-by-variant.rows.*` compares matched versus unmatched start outcomes by source variant without mutating replay state.
- `start-traceability-by-geometry.rows.*` separates matched harvestable geometry from matched dead-chop geometry before any trading replay is attempted.
- The supplied close-event source includes cycle start timestamps; this pass matched 551 close events to prior in-session trigger candidates and left 8187 without a valid same-session trigger.

## Post-Review Caveat

After outsider review, the Gate 90D proposal splits lock behavior into default
entry/add lockout versus optional explicit profit-stop. The `grid-lock-shadow`
rows in this report are therefore protection receipts only. They show where MFE
giveback might be worth controlling; they do not prove forced-close replay
behavior, lockout timing, or that protection would have acted before session
flatten. The next evidence pass must distinguish lockout receipts from
profit-stop receipts using start-level traceability and after-cost basket
quantum units.

## Artifacts

- `docs/research/gates/gate90/artifacts/gate90d-start-trace-oos4-refresh-audit/pair-week-feature.rows.csv`
- `docs/research/gates/gate90/artifacts/gate90d-start-trace-oos4-refresh-audit/session-geometry.rows.csv`
- `docs/research/gates/gate90/artifacts/gate90d-start-trace-oos4-refresh-audit/katarakti-trigger-candidates.rows.csv`
- `docs/research/gates/gate90/artifacts/gate90d-start-trace-oos4-refresh-audit/grid-lock-shadow.rows.csv`
- `docs/research/gates/gate90/artifacts/gate90d-start-trace-oos4-refresh-audit/gate90d-summary.rows.csv`
- `docs/research/gates/gate90/artifacts/gate90d-start-trace-oos4-refresh-audit/trigger-context-summary.rows.csv`
- `docs/research/gates/gate90/artifacts/gate90d-start-trace-oos4-refresh-audit/grid-lock-shadow-by-variant.rows.csv`
- `docs/research/gates/gate90/artifacts/gate90d-start-trace-oos4-refresh-audit/geometry-regime-summary.rows.csv`
- `docs/research/gates/gate90/artifacts/gate90d-start-trace-oos4-refresh-audit/session-geometry-regime-summary.rows.csv`
- `docs/research/gates/gate90/artifacts/gate90d-start-trace-oos4-refresh-audit/start-traceability.rows.csv`
- `docs/research/gates/gate90/artifacts/gate90d-start-trace-oos4-refresh-audit/start-traceability-summary.rows.csv`
- `docs/research/gates/gate90/artifacts/gate90d-start-trace-oos4-refresh-audit/start-traceability-by-variant.rows.csv`
- `docs/research/gates/gate90/artifacts/gate90d-start-trace-oos4-refresh-audit/start-traceability-by-geometry.rows.csv`
- `docs/research/gates/gate90/artifacts/gate90d-start-trace-oos4-refresh-audit/gate90d-config.json`
- `docs/research/gates/gate90/artifacts/gate90d-start-trace-oos4-refresh-audit/gate90d-formula-config.json`
- `docs/research/gates/gate90/artifacts/gate90d-start-trace-oos4-refresh-audit/gate90d-triangle-shadow-audit-sha256.txt`

## Stop Line

No Triangle trading replay, no long matrix, no 2020 year run, no MT5/live/app work, and no full seven-pair handshake gating were performed.
