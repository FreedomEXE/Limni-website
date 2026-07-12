# Gate 90D Feature Ledger And Start Mode Diagnostic

Generated: 2026-07-03

## Verdict

`PASS_GATE90D_FEATURE_LEDGER_START_MODES_LOGGED_NO_REPLAY_NO_FULL_HANDSHAKE`

This extends the Gate 90D feature ledger before replay freeze. It is not a trading replay, not an MT5 build, and not a full currency-family handshake implementation.

## Scope

- Warehouse manifest: `gate74b_trade_leg_path_ECDE7C4A6553`
- Price bundle: `gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953`
- Weeks: `2022-01-10T00:00:00.000Z..2022-02-07T00:00:00.000Z` (5)
- Pairs: `28`
- Grid quantum used for trigger/lock shadow: `0.2 ADR`
- Signal brick: `0.05 ADR`
- Adaptive spacing receipt: `gate90d_range_box_slots_cost_clamped_v0`, `3` target slots, `0.2..0.3 ADR` rails
- Design-question diagnostics: M1/ADR-event path efficiency, archived UTC versus NY-clean boxes, 1-session/5-session/EMA PE, max(pair, account) heat, blocked centerline-only opportunities, neutral-alignment penalty distance, lockout thresholds, and profit-stop receipt-only state.
- Start-mode diagnostics: strict sweep/rejection/displacement, relaxed sweep/rejection, first session-mid extension touch, Candidate B geometry start, and David contra geometry start inside ADR-event harvestable geometry.
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

## Design Question Diagnostics

| box_model | session_label | pe_m1_1_session | pe_adr_event_1_session | pe_m1_5_session_avg | pe_m1_fast_slow_ema | geometry_regime_m1 | centerline_only_blocked_candidate | neutral_alignment_allow_distance_adr | neutral_alignment_penalty_distance_adr | pair_heat | account_heat | selected_heat |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| archived_utc | NY | 0.027721 | 0.0801 | 0.027721 | 0 | dead_chop_cost_churn | false | 0.2 | 0.25 | 1 | 1 | 1 |
| archived_utc | ASIA_LONDON | 0.053605 | 0.168038 | 0.040663 | 0.006163 | dead_chop_cost_churn | false | 0.2 | 0.25 | 1 | 1 | 1 |
| archived_utc | NY | 0.008019 | 0.006826 | 0.029782 | -0.001169 | harvestable_chop_candidate | false | 0.215293 | 0.269116 | 1 | 1 | 1 |
| archived_utc | ASIA_LONDON | 0.037868 | 0.108264 | 0.031803 | 0.001552 | dead_chop_cost_churn | false | 0.2 | 0.25 | 1 | 1 | 1 |
| archived_utc | NY | 0.13546 | 0.312441 | 0.052535 | 0.026381 | dead_chop_cost_churn | false | 0.2 | 0.25 | 1 | 1 | 1 |
| archived_utc | ASIA_LONDON | 0.001874 | 0.018605 | 0.047365 | 0.008713 | harvestable_chop_candidate | true | 0.3 | 0.375 | 1 | 1 | 1 |
| archived_utc | NY | 0.001752 | 0.005163 | 0.036995 | -0.00225 | dead_chop_cost_churn | false | 0.2 | 0.25 | 1 | 1 | 1 |
| archived_utc | ASIA_LONDON | 0.066541 | 0.198718 | 0.048699 | 0.006635 | dead_chop_cost_churn | false | 0.2 | 0.25 | 1 | 1 | 1 |
| archived_utc | NY | 0.000897 | 0.006833 | 0.041305 | -0.003845 | harvestable_chop_candidate | false | 0.245803 | 0.307254 | 1 | 1 | 1 |
| ny_clean_et | NY | 0.030983 | 0.079635 | 0.030983 | 0 | dead_chop_cost_churn | false | 0.2 | 0.25 | 1 | 1 | 1 |
| ny_clean_et | ASIA_LONDON | 0.054676 | 0.184782 | 0.04283 | 0.005641 | dead_chop_cost_churn | false | 0.2 | 0.25 | 1 | 1 | 1 |
| ny_clean_et | NY | 0.007689 | 0.024306 | 0.031116 | -0.002323 | harvestable_chop_candidate | true | 0.215293 | 0.269116 | 1 | 1 | 1 |
| ny_clean_et | ASIA_LONDON | 0.030086 | 0.087065 | 0.030859 | -0.00172 | dead_chop_cost_churn | false | 0.2 | 0.25 | 1 | 1 | 1 |
| ny_clean_et | NY | 0.134051 | 0.301832 | 0.051497 | 0.023452 | dead_chop_cost_churn | false | 0.2 | 0.25 | 1 | 1 | 1 |
| ny_clean_et | ASIA_LONDON | 0.005358 | 0.008929 | 0.046372 | 0.007249 | harvestable_chop_candidate | true | 0.3 | 0.375 | 1 | 1 | 1 |
| ny_clean_et | NY | 0.000519 | 0.00738 | 0.035541 | -0.003906 | dead_chop_cost_churn | false | 0.2 | 0.25 | 1 | 1 | 1 |
| ny_clean_et | ASIA_LONDON | 0.065547 | 0.195344 | 0.047112 | 0.004972 | dead_chop_cost_churn | false | 0.2 | 0.25 | 1 | 1 | 1 |
| ny_clean_et | NY | 0.000897 | 0.006833 | 0.041274 | -0.005224 | harvestable_chop_candidate | true | 0.246954 | 0.308693 | 1 | 1 | 1 |
| archived_utc | NY | 0.066729 | 0.130476 | 0.066729 | 0 | harvestable_chop_candidate | false | 0.296025 | 0.370031 | 1 | 1 | 1 |
| archived_utc | ASIA_LONDON | 0.022222 | 0.054286 | 0.044476 | -0.010597 | harvestable_chop_candidate | true | 0.3 | 0.375 | 1 | 1 | 1 |

## Design Question Read

- Design-question ledger rows: `2520` total; archived UTC `1260`, NY-clean ET `1260`.
- Harvestable geometry rows: archived UTC `734`, NY-clean ET `737`.
- Blocked centerline-only diagnostic rows: archived UTC `561`, NY-clean ET `737`; these remain blocked diagnostics, not replay starts.
- Average PE comparison: archived UTC M1 `0.04032` vs ADR-event `0.106344`; NY-clean ET M1 `0.040214` vs ADR-event `0.105597`.
- Lockout/profit receipts: `2505` rows hit 1Q add-block, `1231` rows hit 2Q add-block, profit-stop remains receipt-only with `322` preserve candidates.

## Start Mode Diagnostics

| box_model | start_mode_id | valid_geometry_sessions | found_starts | blocked_no_start | blocked_no_david_side | avg_start_delay_minutes | avg_start_distance_from_mid_adr | avg_eod_mfe_adr | avg_eod_mae_adr | eod_hit_1q_starts | eod_hit_2q_starts | eod_hit_3q_starts | avg_next_day_mfe_adr | next_day_hit_1q_starts | next_day_hit_2q_starts | next_day_hit_3q_starts | avg_full_available_mfe_adr | full_available_hit_1q_starts | full_available_hit_2q_starts | full_available_hit_3q_starts |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| archived_utc | candidate_b_geometry_start | 632 | 367 | 265 | 0 | 86.866485 | 0.332152 | 0.372999 | 0.375487 | 208 | 86 | 40 | 0.600234 | 259 | 157 | 107 | 0.790333 | 267 | 189 | 147 |
| archived_utc | david_contra_geometry_start | 632 | 368 | 167 | 97 | 140.442935 | 0.387187 | 0.371475 | 0.359645 | 208 | 82 | 41 | 0.595202 | 261 | 152 | 107 | 0.779869 | 277 | 182 | 147 |
| archived_utc | first_mean_extension_touch | 632 | 623 | 9 | 0 | 47 | 0.345212 | 0.375394 | 0.408465 | 357 | 151 | 64 | 0.576461 | 434 | 269 | 169 | 0.76229 | 456 | 323 | 239 |
| archived_utc | relaxed_sweep_rejection | 632 | 46 | 586 | 0 | 188.978261 |  | 0.26969 | 0.3331 | 22 | 4 | 2 | 0.498853 | 30 | 18 | 12 | 0.684169 | 30 | 21 | 16 |
| archived_utc | strict_sweep_rejection_displacement | 632 | 15 | 617 | 0 | 184.266667 |  | 0.327999 | 0.23258 | 9 | 2 | 1 | 0.477411 | 11 | 4 | 3 | 0.617085 | 11 | 5 | 3 |
| ny_clean_et | candidate_b_geometry_start | 633 | 363 | 270 | 0 | 98.62259 | 0.332862 | 0.373859 | 0.371789 | 202 | 85 | 37 | 0.601158 | 254 | 158 | 106 | 0.790846 | 261 | 190 | 144 |
| ny_clean_et | david_contra_geometry_start | 633 | 368 | 172 | 93 | 152.217391 | 0.385089 | 0.3688 | 0.363081 | 202 | 79 | 38 | 0.590988 | 256 | 152 | 109 | 0.778439 | 273 | 183 | 146 |
| ny_clean_et | first_mean_extension_touch | 633 | 623 | 10 | 0 | 53.481541 | 0.342952 | 0.37314 | 0.406652 | 347 | 150 | 64 | 0.5735 | 428 | 269 | 169 | 0.76198 | 450 | 324 | 238 |
| ny_clean_et | relaxed_sweep_rejection | 633 | 45 | 588 | 0 | 199.711111 |  | 0.259508 | 0.323095 | 22 | 3 | 1 | 0.488041 | 29 | 17 | 11 | 0.650252 | 29 | 19 | 14 |
| ny_clean_et | strict_sweep_rejection_displacement | 633 | 15 | 618 | 0 | 191.6 |  | 0.327999 | 0.23258 | 9 | 2 | 1 | 0.477411 | 11 | 4 | 3 | 0.617085 | 11 | 5 | 3 |

## Start Mode Sample

| box_model | session_label | start_mode_id | start_side | start_timestamp_utc | pe_adr_event_1_session | adaptive_spacing_adr | start_distance_from_mid_adr | eod_mfe_adr | eod_mae_adr | eod_mfe_quantum_units | next_day_mfe_adr | full_available_mfe_adr | hold_until_profit_first_1q_timestamp_utc | candidate_b_alignment | david_alignment |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| archived_utc | NY | relaxed_sweep_rejection | LONG | 2022-01-11T15:52:00.000Z | 0.067449 | 0.215293 |  | 0.155426 | 0.131248 | 0.721928 | 0.894563 | 1.094889 | 2022-01-12T14:08:00.000Z | 1 |  |
| archived_utc | NY | first_mean_extension_touch | LONG | 2022-01-11T13:00:00.000Z | 0.067449 | 0.215293 | 0.324667 | 0.15888 | 0.151971 | 0.737971 | 0.898017 | 1.098343 | 2022-01-12T14:07:00.000Z | 1 |  |
| archived_utc | NY | candidate_b_geometry_start | LONG | 2022-01-11T13:00:00.000Z | 0.067449 | 0.215293 | 0.324667 | 0.15888 | 0.151971 | 0.737971 | 0.898017 | 1.098343 | 2022-01-12T14:07:00.000Z | 1 |  |
| archived_utc | ASIA_LONDON | first_mean_extension_touch | SHORT | 2022-01-13T00:00:00.000Z | 0.089022 | 0.3 | 0.440373 | 0.094982 | 0.417923 | 0.316607 | 0.80476 | 0.80476 | 2022-01-14T08:53:00.000Z | -1 | -1 |
| archived_utc | NY | first_mean_extension_touch | LONG | 2022-01-14T13:00:00.000Z | 0.035294 | 0.245803 | 0.315169 | 0.120887 | 0.227958 | 0.491804 | 0.120887 | 0.120887 |  | 1 | 1 |
| archived_utc | NY | candidate_b_geometry_start | LONG | 2022-01-14T13:00:00.000Z | 0.035294 | 0.245803 | 0.315169 | 0.120887 | 0.227958 | 0.491804 | 0.120887 | 0.120887 |  | 1 | 1 |
| archived_utc | NY | david_contra_geometry_start | LONG | 2022-01-14T13:00:00.000Z | 0.035294 | 0.245803 | 0.315169 | 0.120887 | 0.227958 | 0.491804 | 0.120887 | 0.120887 |  | 1 | 1 |
| ny_clean_et | NY | relaxed_sweep_rejection | LONG | 2022-01-11T15:52:00.000Z | 0.067449 | 0.215293 |  | 0.155426 | 0.131248 | 0.721928 | 0.894563 | 1.094889 | 2022-01-12T14:08:00.000Z | 1 |  |
| ny_clean_et | NY | first_mean_extension_touch | LONG | 2022-01-11T13:00:00.000Z | 0.067449 | 0.215293 | 0.324667 | 0.15888 | 0.151971 | 0.737971 | 0.898017 | 1.098343 | 2022-01-12T14:07:00.000Z | 1 |  |
| ny_clean_et | NY | candidate_b_geometry_start | LONG | 2022-01-11T13:00:00.000Z | 0.067449 | 0.215293 | 0.324667 | 0.15888 | 0.151971 | 0.737971 | 0.898017 | 1.098343 | 2022-01-12T14:07:00.000Z | 1 |  |
| ny_clean_et | ASIA_LONDON | first_mean_extension_touch | SHORT | 2022-01-12T23:05:00.000Z | 0.047059 | 0.3 | 0.49909 | 0.157153 | 0.355752 | 0.523843 | 0.866931 | 0.866931 | 2022-01-14T08:46:00.000Z | -1 | -1 |
| ny_clean_et | NY | first_mean_extension_touch | LONG | 2022-01-14T13:00:00.000Z | 0.035294 | 0.246954 | 0.316896 | 0.120887 | 0.227958 | 0.489512 | 0.120887 | 0.120887 |  | 1 | 1 |
| ny_clean_et | NY | candidate_b_geometry_start | LONG | 2022-01-14T13:00:00.000Z | 0.035294 | 0.246954 | 0.316896 | 0.120887 | 0.227958 | 0.489512 | 0.120887 | 0.120887 |  | 1 | 1 |
| ny_clean_et | NY | david_contra_geometry_start | LONG | 2022-01-14T13:00:00.000Z | 0.035294 | 0.246954 | 0.316896 | 0.120887 | 0.227958 | 0.489512 | 0.120887 | 0.120887 |  | 1 | 1 |
| archived_utc | NY | first_mean_extension_touch | SHORT | 2022-01-10T13:35:00.000Z | 0.223929 | 0.296025 | 0.330967 | 0.433437 | 0.546508 | 1.464191 | 0.433437 | 0.965811 | 2022-01-10T15:43:00.000Z | -1 |  |
| archived_utc | NY | david_contra_geometry_start | SHORT | 2022-01-10T19:54:00.000Z | 0.223929 | 0.296025 | 0.542974 | 0.007067 | 0.348635 | 0.023873 | 0.127204 | 1.163684 | 2022-01-14T00:04:00.000Z | -1 | 1 |
| archived_utc | ASIA_LONDON | first_mean_extension_touch | SHORT | 2022-01-11T00:00:00.000Z | 0.087349 | 0.3 | 0.567709 | 0.541796 | 0.212008 | 1.805987 | 0.541796 | 1.578276 | 2022-01-11T06:45:00.000Z | -1 | 1 |
| archived_utc | ASIA_LONDON | david_contra_geometry_start | SHORT | 2022-01-11T00:00:00.000Z | 0.087349 | 0.3 | 0.567709 | 0.541796 | 0.212008 | 1.805987 | 0.541796 | 1.578276 | 2022-01-11T06:45:00.000Z | -1 | 1 |
| archived_utc | NY | first_mean_extension_touch | LONG | 2022-01-11T13:16:00.000Z | 0.166666 | 0.212007 | 0.219074 | 0.478194 | 0.219074 | 2.255558 | 0.803272 | 0.822117 | 2022-01-11T17:13:00.000Z | 1 | -1 |
| archived_utc | NY | candidate_b_geometry_start | LONG | 2022-01-11T13:16:00.000Z | 0.166666 | 0.212007 | 0.219074 | 0.478194 | 0.219074 | 2.255558 | 0.803272 | 0.822117 | 2022-01-11T17:13:00.000Z | 1 | -1 |

## Start Mode Read

- Start-mode diagnostic rows: `6325` across ADR-event harvestable geometry sessions; archived UTC denominator `632`, NY-clean ET denominator `633`.
- Strict versus relaxed starts: archived UTC strict `15`, relaxed `46`; NY-clean ET strict `15`, relaxed `45`.
- Geometry-only start shapes: archived UTC mean-extension `623`, Candidate B `367`, David contra `368`; NY-clean ET mean-extension `623`, Candidate B `363`, David contra `368`.
- Start-mode rows now include MFE/MAE excursion receipts: next NY 16:00 flatten, one additional NY 16:00 flatten, and full available pair-week path, with 1Q/2Q/3Q target-hit flags.
- David diagnostic settings: `adr_event`, brick `0.1 ADR`, LWMA `50`, RSI `50`, OB/OS `60/40`.

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

- Formula contract hash: `E1901D5442570BB7EA92DE28E11A5F787AD0F7A53F0A24A63D9AF21BA02EAEAC`.
- `pair-week-feature.rows.*` records week-level path efficiency, range ratio, range-condition pass/fail, geometry regime, derived grid quantum, signal brick, and log-only family context.
- `session-geometry.rows.*` records the same efficiency/range regime test at Katarakti session-box resolution so low-efficiency dead churn is not confused with harvestable chop.
- `design-question-diagnostic.rows.*` logs the open Gate 90D design questions side by side before any replay freeze: M1 versus ADR-event PE, archived UTC versus NY-clean boxes, 1-session/5-session/EMA PE, max(pair, account) heat, blocked centerline-only rows, neutral alignment allow-versus-penalty distance, and profit-stop receipt-only state.
- `start-mode-diagnostic.rows.*` compares strict, relaxed, session-mid extension, Candidate B geometry, and David contra geometry starts inside the same ADR-event harvestable geometry denominator.
- `start-mode-diagnostic.rows.*` also records MFE/MAE, EOD flatten PnL, next-day hold what-if, full available path MFE, and 1Q/2Q/3Q target-hit timestamps/flags so larger-target hypotheses remain visible without changing replay state.
- `start-mode-summary.rows.*` groups those start modes and excursion receipts by box model so v1 can choose a handshake shape before any replay freeze.
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

- `docs/research/gates/gate90/artifacts/gate90d-design-question-diagnostic-oos4-5w/pair-week-feature.rows.csv`
- `docs/research/gates/gate90/artifacts/gate90d-design-question-diagnostic-oos4-5w/session-geometry.rows.csv`
- `docs/research/gates/gate90/artifacts/gate90d-design-question-diagnostic-oos4-5w/design-question-diagnostic.rows.csv`
- `docs/research/gates/gate90/artifacts/gate90d-design-question-diagnostic-oos4-5w/start-mode-diagnostic.rows.csv`
- `docs/research/gates/gate90/artifacts/gate90d-design-question-diagnostic-oos4-5w/start-mode-summary.rows.csv`
- `docs/research/gates/gate90/artifacts/gate90d-design-question-diagnostic-oos4-5w/katarakti-trigger-candidates.rows.csv`
- `docs/research/gates/gate90/artifacts/gate90d-design-question-diagnostic-oos4-5w/grid-lock-shadow.rows.csv`
- `docs/research/gates/gate90/artifacts/gate90d-design-question-diagnostic-oos4-5w/gate90d-summary.rows.csv`
- `docs/research/gates/gate90/artifacts/gate90d-design-question-diagnostic-oos4-5w/trigger-context-summary.rows.csv`
- `docs/research/gates/gate90/artifacts/gate90d-design-question-diagnostic-oos4-5w/grid-lock-shadow-by-variant.rows.csv`
- `docs/research/gates/gate90/artifacts/gate90d-design-question-diagnostic-oos4-5w/geometry-regime-summary.rows.csv`
- `docs/research/gates/gate90/artifacts/gate90d-design-question-diagnostic-oos4-5w/session-geometry-regime-summary.rows.csv`
- `docs/research/gates/gate90/artifacts/gate90d-design-question-diagnostic-oos4-5w/start-traceability.rows.csv`
- `docs/research/gates/gate90/artifacts/gate90d-design-question-diagnostic-oos4-5w/start-traceability-summary.rows.csv`
- `docs/research/gates/gate90/artifacts/gate90d-design-question-diagnostic-oos4-5w/start-traceability-by-variant.rows.csv`
- `docs/research/gates/gate90/artifacts/gate90d-design-question-diagnostic-oos4-5w/start-traceability-by-geometry.rows.csv`
- `docs/research/gates/gate90/artifacts/gate90d-design-question-diagnostic-oos4-5w/gate90d-config.json`
- `docs/research/gates/gate90/artifacts/gate90d-design-question-diagnostic-oos4-5w/gate90d-formula-config.json`
- `docs/research/gates/gate90/artifacts/gate90d-design-question-diagnostic-oos4-5w/gate90d-triangle-shadow-audit-sha256.txt`

## Stop Line

No Triangle trading replay, no long matrix, no 2020 year run, no MT5/live/app work, and no full seven-pair handshake gating were performed.
