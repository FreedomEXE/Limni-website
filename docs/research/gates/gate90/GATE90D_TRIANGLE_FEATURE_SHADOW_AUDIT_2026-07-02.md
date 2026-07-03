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
- Close-event source: `docs/research/gates/gate90/artifacts/oos-session-window-5w-oos4-adr010_ma50-s020-exp010-rsi506040-stoch100-3-100-6040/close-events.rows.csv`

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
| missing_start_timestamp | 8738 | 1441 | 7297 | 2310.163852 | 0.264381 | 1.286759 | 86.781872 |  |
| invalid_start_timestamp | 0 | 0 | 0 |  |  |  |  |  |
| matched_prior_trigger | 0 | 0 | 0 |  |  |  |  |  |
| no_in_session_trigger | 0 | 0 | 0 |  |  |  |  |  |

## Start Traceability By Variant

| variant_id | start_trace_status | rows | session_flatten_rows | target_rows | net_usd | avg_net_usd | profit_factor | win_pct | avg_minutes_from_trigger_to_start |
|---|---|---|---|---|---|---|---|---|---|
| RAW_GRID_T100_S020_GATE90_CANDIDATE_B | missing_start_timestamp | 1714 | 281 | 1433 | 521.476402 | 0.304245 | 1.351239 | 86.872812 |  |
| RAW_GRID_T100_S020_GATE90_DAVID_CONTRA | missing_start_timestamp | 1682 | 277 | 1405 | 329.722166 | 0.19603 | 1.198388 | 86.741974 |  |
| RAW_GRID_T100_S020_GATE90_DAVID_STOCH_CONFIRM | missing_start_timestamp | 783 | 123 | 660 | 293.54327 | 0.374896 | 1.440512 | 87.61175 |  |
| RAW_GRID_T100_S020_GATE90_RAW_BOTH | missing_start_timestamp | 3454 | 578 | 2876 | 858.600745 | 0.248582 | 1.265351 | 86.479444 |  |
| RAW_GRID_T100_S020_GATE90_STOCH_CONTRA | missing_start_timestamp | 1105 | 182 | 923 | 306.821269 | 0.277666 | 1.304581 | 87.058824 |  |

## Start Traceability By Geometry

| start_trace_status | geometry_source | geometry_regime | rows | session_flatten_rows | target_rows | net_usd | avg_net_usd | profit_factor | win_pct | avg_minutes_from_trigger_to_start |
|---|---|---|---|---|---|---|---|---|---|---|
| missing_start_timestamp | pair_week_fallback | harvestable_chop_candidate | 8738 | 1441 | 7297 | 2310.163852 | 0.264381 | 1.286759 | 86.781872 |  |

## Read

- Formula contract hash: `26B409436632B3681E0A52A3D19A93900186B80AF0BFA542DEF2ABB0DBDDE1BE`.
- `pair-week-feature.rows.*` records week-level path efficiency, range ratio, range-condition pass/fail, geometry regime, derived grid quantum, signal brick, and log-only family context.
- `session-geometry.rows.*` records the same efficiency/range regime test at Katarakti session-box resolution so low-efficiency dead churn is not confused with harvestable chop.
- Adaptive spacing receipts use completed session range divided into fixed slots, then apply cost/min/max rails; they are feature receipts only in this pass, not trading replay controls.
- `katarakti-trigger-candidates.rows.*` records session sweep / rejection / displacement trigger candidates in ADR/grid units.
- `geometry-regime-summary.rows.*` separates harvestable chop candidates from dead chop, efficient tail risk, and mixed regimes.
- `grid-lock-shadow.rows.*` reads existing full-stat close events and estimates where a grid-unit lock floor could have preserved MFE.
- `start-traceability.rows.*` matches close-event cycle starts to prior Katarakti trigger candidates when source close events include `start_timestamp_utc`, then carries close-event outcome fields for start-gate shadow scoring.
- `start-traceability-by-variant.rows.*` compares matched versus unmatched start outcomes by source variant without mutating replay state.
- `start-traceability-by-geometry.rows.*` separates matched harvestable geometry from matched dead-chop geometry before any trading replay is attempted.
- The supplied close-event source does not include cycle start timestamps, so this generated pass reports those rows as `missing_start_timestamp`.

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

- `docs/research/gates/gate90/artifacts/gate90d-triangle-shadow-audit-oos4-5w/pair-week-feature.rows.csv`
- `docs/research/gates/gate90/artifacts/gate90d-triangle-shadow-audit-oos4-5w/session-geometry.rows.csv`
- `docs/research/gates/gate90/artifacts/gate90d-triangle-shadow-audit-oos4-5w/katarakti-trigger-candidates.rows.csv`
- `docs/research/gates/gate90/artifacts/gate90d-triangle-shadow-audit-oos4-5w/grid-lock-shadow.rows.csv`
- `docs/research/gates/gate90/artifacts/gate90d-triangle-shadow-audit-oos4-5w/gate90d-summary.rows.csv`
- `docs/research/gates/gate90/artifacts/gate90d-triangle-shadow-audit-oos4-5w/trigger-context-summary.rows.csv`
- `docs/research/gates/gate90/artifacts/gate90d-triangle-shadow-audit-oos4-5w/grid-lock-shadow-by-variant.rows.csv`
- `docs/research/gates/gate90/artifacts/gate90d-triangle-shadow-audit-oos4-5w/geometry-regime-summary.rows.csv`
- `docs/research/gates/gate90/artifacts/gate90d-triangle-shadow-audit-oos4-5w/session-geometry-regime-summary.rows.csv`
- `docs/research/gates/gate90/artifacts/gate90d-triangle-shadow-audit-oos4-5w/start-traceability.rows.csv`
- `docs/research/gates/gate90/artifacts/gate90d-triangle-shadow-audit-oos4-5w/start-traceability-summary.rows.csv`
- `docs/research/gates/gate90/artifacts/gate90d-triangle-shadow-audit-oos4-5w/start-traceability-by-variant.rows.csv`
- `docs/research/gates/gate90/artifacts/gate90d-triangle-shadow-audit-oos4-5w/start-traceability-by-geometry.rows.csv`
- `docs/research/gates/gate90/artifacts/gate90d-triangle-shadow-audit-oos4-5w/gate90d-config.json`
- `docs/research/gates/gate90/artifacts/gate90d-triangle-shadow-audit-oos4-5w/gate90d-formula-config.json`
- `docs/research/gates/gate90/artifacts/gate90d-triangle-shadow-audit-oos4-5w/gate90d-triangle-shadow-audit-sha256.txt`

## Stop Line

No Triangle trading replay, no long matrix, no 2020 year run, no MT5/live/app work, and no full seven-pair handshake gating were performed.
