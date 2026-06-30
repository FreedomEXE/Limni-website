# Gate 78 Pair Two-Sided Limited-Reentry Enhancement Matrix

Generated: `2026-06-30T00:24:03.184Z`

## Verdict

`PASS_GATE78_PAIR_TWO_SIDED_LIMITED_REENTRY_ENHANCEMENT_MATRIX__RUNNER_AND_REFERENCE_SL_VISIBLE_NO_PROMOTION`

## Scope

- Tests only final-reset runner preservation and reference-only account emergency SL diagnostics.
- Uses spacing 0.2 ADR, pair reset limit 3, targets 0.75/1.0/1.25, runner fractions 25%/50%, and account emergency bands -3/-5 ADR.
- Reproduces Gate 74E, Gate 76 T150, and Gate 77 T075/T100/T125 L3 rows before comparison.
- Does not run costs, risk/correlation pruning, pair/date exclusions, source mutation, Brain mutation, MT5/live/app/runtime, or promotion.

## Adapter Ranking

| rule_id | family | runner | account_sl | reference_only | closed | equity | eq_pf | dd | open | worst1 | worst5 | worst13 | neg_years | profitable_week_rate | top20 | recovery | flip_loss | resets | account_sl_events | fills | adverse | expansion |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| WEEKLY_FORCED_CLOSE | control |  |  | false | 638.115405 | 638.115405 | 1.414187 | -116.795157 | 0 | -31.994789 | -137.015712 | -314.610634 | 1 | 0.520107 | 1 | 0.5075 | 0 | 0 | 0 | 10444 | 0 | 0 |
| CARRY_UNTIL_FLIP | control |  |  | false | 694.688146 | 597.519846 | 1.349786 | -167.030217 | -97.1683 | -36.95747 | -159.788796 | -361.898348 | 2 | 0.509383 | 0.988383 | 0 | -963.436728 | 0 | 0 | 902 | 0 | 0 |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP | adverse_only_pair_net_grid |  |  | false | 14381.312614 | 9901.156008 | 1.254319 | -5462.545131 | -4480.156606 | -1582.117861 | -6462.22487 | -12815.828748 | 1 | 0.533512 | 16.1365 | 0.967986 | -10815.950986 | 28300 | 0 | 124689 | 95487 | 0 |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP | pair_directional_two_sided_grid |  |  | false | 18012.423714 | 12295.79489 | 1.282295 | -7565.450203 | -5716.628824 | -1570.62905 | -7361.455451 | -14861.678507 | 2 | 0.544236 | 18.703482 | 0.951924 | -14668.815258 | 18703 | 0 | 129588 | 79815 | 30168 |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | pair_reset_limit |  |  | false | 14021.947533 | 11713.727501 | 1.51746 | -1811.737115 | -2308.220032 | -1139.447341 | -4088.571521 | -7753.393942 | 1 | 0.613941 | 9.623613 | 0.984877 | -5132.272395 | 21658 | 0 | 107731 | 63510 | 22252 |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | pair_reset_limit |  |  | false | 16124.084275 | 13772.999764 | 1.561828 | -1989.442654 | -2351.084511 | -1151.146735 | -4601.201676 | -8525.307355 | 1 | 0.595174 | 11.769378 | 0.978224 | -6297.282489 | 19367 | 0 | 106080 | 65843 | 20468 |
| PAIR_TWO_SIDED_GRID_T125_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | pair_reset_limit |  |  | false | 17485.463669 | 13018.163434 | 1.440649 | -4074.085132 | -4467.300235 | -1333.160859 | -5596.939385 | -10061.81341 | 1 | 0.592493 | 13.394478 | 0.970286 | -7245.973831 | 17218 | 0 | 110454 | 66112 | 26629 |
| PAIR_TWO_SIDED_GRID_T075_S020_L3_FINAL_RESET_RUNNER_025 | pair_final_reset_runner | 0.25 |  | false | 2357.105091 | 2254.07738 | 1.553754 | -646.124869 | -103.027711 | -293.312292 | -999.272243 | -1799.829669 | 0 | 0.565684 | 1.861799 | 0.753326 | -1810.801341 | 2925 | 0 | 14699.75 | 8624 | 3058.75 |
| PAIR_TWO_SIDED_GRID_T075_S020_L3_FINAL_RESET_RUNNER_050 | pair_final_reset_runner | 0.5 |  | false | 3129.629042 | 2923.668101 | 1.569189 | -602.738028 | -205.960941 | -261.731093 | -965.997026 | -1832.075042 | 1 | 0.565684 | 2.930317 | 0.753326 | -2571.273518 | 2925 | 0 | 14672.5 | 8610 | 3052.5 |
| PAIR_TWO_SIDED_GRID_T100_S020_L3_FINAL_RESET_RUNNER_025 | pair_final_reset_runner | 0.25 |  | false | 2181.368862 | 2057.524025 | 1.35852 | -773.468845 | -123.844837 | -390.105979 | -1196.404394 | -2363.255967 | 1 | 0.587131 | 2.093438 | 0.759648 | -2782.341696 | 3004 | 0 | 16852.5 | 10468.75 | 3243.5 |
| PAIR_TWO_SIDED_GRID_T100_S020_L3_FINAL_RESET_RUNNER_050 | pair_final_reset_runner | 0.5 |  | false | 2896.776972 | 2651.238026 | 1.392916 | -890.894792 | -245.538946 | -364.060903 | -1202.18539 | -2437.923542 | 1 | 0.552279 | 3.138638 | 0.759648 | -3522.667491 | 3004 | 0 | 16825 | 10457.5 | 3234 |
| PAIR_TWO_SIDED_GRID_T125_S020_L3_FINAL_RESET_RUNNER_025 | pair_final_reset_runner | 0.25 |  | false | 2934.426542 | -281.902214 | 0.976202 | -4028.764559 | -3216.328756 | -796.498797 | -3330.120203 | -5544.059117 | 2 | 0.565684 | 2.237259 | 0.767442 | -3264.516762 | 3128 | 0 | 20395 | 12099.25 | 4991 |
| PAIR_TWO_SIDED_GRID_T125_S020_L3_FINAL_RESET_RUNNER_050 | pair_final_reset_runner | 0.5 |  | false | 3724.16334 | 409.620619 | 1.031823 | -4211.915285 | -3314.542721 | -809.156559 | -3414.662216 | -5619.542302 | 2 | 0.544236 | 3.491517 | 0.767442 | -4131.530684 | 3128 | 0 | 20365 | 12087.5 | 4979 |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK_ACCOUNT_EMERGENCY_SL_3ADR | account_emergency_sl_reference |  | -3 | true | 321.064729 | 321.064729 | 1.271227 | -261.64547 | 0 | -26.045641 | -76.537653 | -123.493692 | 4 | 0.101877 | 0.406379 | 0.343243 | -61.809797 | 4849 | 347 | 40705 | 15621 | 10783 |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK_ACCOUNT_EMERGENCY_SL_5ADR | account_emergency_sl_reference |  | -5 | true | -2.262084 | -2.262084 | 0.99877 | -416.424575 | 0 | -26.045641 | -88.297024 | -173.179165 | 5 | 0.126005 | 0.355794 | 0.430533 | -67.577309 | 6590 | 339 | 49862 | 21077 | 13135 |
| PAIR_TWO_SIDED_GRID_T075_S020_L3_FINAL_RESET_RUNNER_050_ACCOUNT_EMERGENCY_SL_3ADR | account_emergency_sl_reference | 0.5 | -3 | true | 296.337801 | 296.337801 | 1.195601 | -198.162535 | 0 | -71.32511 | -242.406469 | -429.073132 | 3 | 0.147453 | 0.351747 | 0.389018 | -249.597644 | 5882 | 312 | 39769 | 15263 | 10830 |
| PAIR_TWO_SIDED_GRID_T075_S020_L3_FINAL_RESET_RUNNER_050_ACCOUNT_EMERGENCY_SL_5ADR | account_emergency_sl_reference | 0.5 | -5 | true | 81.829163 | 81.829163 | 1.040528 | -439.603461 | 0 | -45.087827 | -206.570396 | -401.709363 | 5 | 0.179625 | 0.35716 | 0.462152 | -148.113234 | 7821 | 310 | 48438 | 20217 | 13087 |

## Runner Ranking

| rule_id | base_rule_id | target_adr | runner_fraction | gate78_research_rank_score | final_equity_adr | max_equity_drawdown_adr | final_open_unrealized_adr | flip_loss_adr | closed_total_adr | top20_winner_adr | interpretation |
|---|---|---|---|---|---|---|---|---|---|---|---|
| PAIR_TWO_SIDED_GRID_T075_S020_L3_FINAL_RESET_RUNNER_050 | PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | 0.75 | 0.5 | -1002.331511 | 2923.668101 | -602.738028 | -205.960941 | -2571.273518 | 3129.629042 | 2014.562627 | runner_did_not_improve_t100_l3_balance |
| PAIR_TWO_SIDED_GRID_T075_S020_L3_FINAL_RESET_RUNNER_025 | PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | 0.75 | 0.25 | -1196.438093 | 2254.07738 | -646.124869 | -103.027711 | -1810.801341 | 2357.105091 | 1279.967376 | runner_did_not_improve_t100_l3_balance |
| PAIR_TWO_SIDED_GRID_T100_S020_L3_FINAL_RESET_RUNNER_025 | PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | 1 | 0.25 | -3080.240896 | 2057.524025 | -773.468845 | -123.844837 | -2782.341696 | 2181.368862 | 1439.216832 | runner_did_not_improve_t100_l3_balance |
| PAIR_TWO_SIDED_GRID_T100_S020_L3_FINAL_RESET_RUNNER_050 | PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | 1 | 0.5 | -3182.147277 | 2651.238026 | -890.894792 | -245.538946 | -3522.667491 | 2896.776972 | 2157.7809 | runner_did_not_improve_t100_l3_balance |
| PAIR_TWO_SIDED_GRID_T125_S020_L3_FINAL_RESET_RUNNER_025 | PAIR_TWO_SIDED_GRID_T125_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | 1.25 | 0.25 | -15217.441687 | -281.902214 | -4028.764559 | -3216.328756 | -3264.516762 | 2934.426542 | 1538.092341 | runner_did_not_improve_t100_l3_balance |
| PAIR_TWO_SIDED_GRID_T125_S020_L3_FINAL_RESET_RUNNER_050 | PAIR_TWO_SIDED_GRID_T125_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | 1.25 | 0.5 | -15336.774108 | 409.620619 | -4211.915285 | -3314.542721 | -4131.530684 | 3724.16334 | 2400.381721 | runner_did_not_improve_t100_l3_balance |

## Right-Tail Retention Versus T150

| rule_id | rule_family | target_adr | runner_fraction | account_emergency_sl_adr | top20_winner_retention_delta_vs_t150_adr | top20_winner_retention_loss_vs_t150_adr | closed_delta_vs_t150_adr | final_equity_delta_vs_t150_adr | max_drawdown_improvement_vs_t150_adr |
|---|---|---|---|---|---|---|---|---|---|
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP | adverse_only_pair_net_grid | 0.75 |  |  | -1764.773526 | 1764.773526 | -3631.1111 | -2394.638882 | 2102.905072 |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP | pair_directional_two_sided_grid | 1.5 |  |  | 0 | 0 | 0 | 0 | 0 |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | pair_reset_limit | 0.75 |  |  | -6242.315851 | 6242.315851 | -3990.476181 | -582.067389 | 5753.713088 |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | pair_reset_limit | 1 |  |  | -4767.124605 | 4767.124605 | -1888.339439 | 1477.204874 | 5576.007549 |
| PAIR_TWO_SIDED_GRID_T125_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | pair_reset_limit | 1.25 |  |  | -3649.885428 | 3649.885428 | -526.960045 | 722.368544 | 3491.365071 |
| PAIR_TWO_SIDED_GRID_T075_S020_L3_FINAL_RESET_RUNNER_025 | pair_final_reset_runner | 0.75 | 0.25 |  | -11578.48275 | 11578.48275 | -15655.318623 | -10041.71751 | 6919.325334 |
| PAIR_TWO_SIDED_GRID_T075_S020_L3_FINAL_RESET_RUNNER_050 | pair_final_reset_runner | 0.75 | 0.5 |  | -10843.887499 | 10843.887499 | -14882.794672 | -9372.126789 | 6962.712175 |
| PAIR_TWO_SIDED_GRID_T100_S020_L3_FINAL_RESET_RUNNER_025 | pair_final_reset_runner | 1 | 0.25 |  | -11419.233294 | 11419.233294 | -15831.054852 | -10238.270865 | 6791.981358 |
| PAIR_TWO_SIDED_GRID_T100_S020_L3_FINAL_RESET_RUNNER_050 | pair_final_reset_runner | 1 | 0.5 |  | -10700.669226 | 10700.669226 | -15115.646742 | -9644.556864 | 6674.555411 |
| PAIR_TWO_SIDED_GRID_T125_S020_L3_FINAL_RESET_RUNNER_025 | pair_final_reset_runner | 1.25 | 0.25 |  | -11320.357785 | 11320.357785 | -15077.997172 | -12577.697104 | 3536.685644 |
| PAIR_TWO_SIDED_GRID_T125_S020_L3_FINAL_RESET_RUNNER_050 | pair_final_reset_runner | 1.25 | 0.5 |  | -10458.068405 | 10458.068405 | -14288.260374 | -11886.174271 | 3353.534918 |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK_ACCOUNT_EMERGENCY_SL_3ADR | account_emergency_sl_reference | 1 |  | -3 | -12579.068445 | 12579.068445 | -17691.358985 | -11974.730161 | 7303.804733 |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK_ACCOUNT_EMERGENCY_SL_5ADR | account_emergency_sl_reference | 1 |  | -5 | -12613.845682 | 12613.845682 | -18014.685798 | -12298.056974 | 7149.025628 |
| PAIR_TWO_SIDED_GRID_T075_S020_L3_FINAL_RESET_RUNNER_050_ACCOUNT_EMERGENCY_SL_3ADR | account_emergency_sl_reference | 0.75 | 0.5 | -3 | -12616.627361 | 12616.627361 | -17716.085913 | -11999.457089 | 7367.287668 |
| PAIR_TWO_SIDED_GRID_T075_S020_L3_FINAL_RESET_RUNNER_050_ACCOUNT_EMERGENCY_SL_5ADR | account_emergency_sl_reference | 0.75 | 0.5 | -5 | -12612.906322 | 12612.906322 | -17930.594551 | -12213.965727 | 7125.846742 |

## Account Emergency SL Reference Rows

| rule_id | base_rule_id | account_emergency_sl_adr | emergency_breach_count | emergency_closed_cycle_count | emergency_closed_adr | final_equity_delta_vs_base_adr | closed_delta_vs_base_adr | max_drawdown_improvement_vs_base_adr | interpretation |
|---|---|---|---|---|---|---|---|---|---|
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK_ACCOUNT_EMERGENCY_SL_3ADR | PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | -3 | 347 | 9438 | -4921.345773 | -13451.935035 | -15803.019546 | 1727.797184 | reference_sl_clipped_tail_but_gave_up_harvest |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK_ACCOUNT_EMERGENCY_SL_5ADR | PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | -5 | 339 | 9043 | -7115.56621 | -13775.261848 | -16126.346359 | 1573.018079 | reference_sl_clipped_tail_but_gave_up_harvest |
| PAIR_TWO_SIDED_GRID_T075_S020_L3_FINAL_RESET_RUNNER_050_ACCOUNT_EMERGENCY_SL_3ADR | PAIR_TWO_SIDED_GRID_T075_S020_L3_FINAL_RESET_RUNNER_050 | -3 | 312 | 8736 | -4175.919118 | -2627.3303 | -2833.291241 | 404.575493 | reference_sl_clipped_tail_but_gave_up_harvest |
| PAIR_TWO_SIDED_GRID_T075_S020_L3_FINAL_RESET_RUNNER_050_ACCOUNT_EMERGENCY_SL_5ADR | PAIR_TWO_SIDED_GRID_T075_S020_L3_FINAL_RESET_RUNNER_050 | -5 | 310 | 8680 | -5869.239509 | -2841.838938 | -3047.799879 | 163.134567 | reference_sl_clipped_tail_but_gave_up_harvest |

## Failure Anatomy

| comparison_role | candidate_rule_id | baseline_rule_id | helped_week_count | hurt_week_count | net_equity_delta_vs_base_adr | closed_delta_vs_base_adr | max_drawdown_improvement_vs_base_adr | final_open_improvement_vs_base_adr | flip_loss_improvement_vs_base_adr | top20_winner_retention_loss_vs_base_adr |
|---|---|---|---|---|---|---|---|---|---|---|
| runner_075_025_vs_PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | PAIR_TWO_SIDED_GRID_T075_S020_L3_FINAL_RESET_RUNNER_025 | PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | 142 | 231 | -9459.650121 | -11664.842442 | 1165.612246 | 2205.192321 | 3321.471054 | 5336.166899 |
| runner_075_050_vs_PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | PAIR_TWO_SIDED_GRID_T075_S020_L3_FINAL_RESET_RUNNER_050 | PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | 144 | 229 | -8790.0594 | -10892.318491 | 1208.999087 | 2102.259091 | 2560.998877 | 4601.571648 |
| runner_100_025_vs_PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | PAIR_TWO_SIDED_GRID_T100_S020_L3_FINAL_RESET_RUNNER_025 | PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | 148 | 225 | -11715.475739 | -13942.715413 | 1215.973809 | 2227.239674 | 3514.940793 | 6652.108689 |
| runner_100_050_vs_PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | PAIR_TWO_SIDED_GRID_T100_S020_L3_FINAL_RESET_RUNNER_050 | PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | 142 | 231 | -11121.761738 | -13227.307303 | 1098.547862 | 2105.545565 | 2774.614998 | 5933.544621 |
| runner_125_025_vs_PAIR_TWO_SIDED_GRID_T125_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | PAIR_TWO_SIDED_GRID_T125_S020_L3_FINAL_RESET_RUNNER_025 | PAIR_TWO_SIDED_GRID_T125_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | 145 | 228 | -13300.065648 | -14551.037127 | 45.320573 | 1250.971479 | 3981.457069 | 7670.472357 |
| runner_125_050_vs_PAIR_TWO_SIDED_GRID_T125_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | PAIR_TWO_SIDED_GRID_T125_S020_L3_FINAL_RESET_RUNNER_050 | PAIR_TWO_SIDED_GRID_T125_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | 150 | 223 | -12608.542815 | -13761.300329 | -137.830153 | 1152.757514 | 3114.443147 | 6808.182977 |

## Interpretation Rule

- Tail concentration is reporting-only and is not a reason to exclude pairs.
- Account emergency SL rows are reference-only diagnostics and are not ranking tricks.
- Runner rows are not ranked by final equity or closed PnL alone.
- If runner preservation reopens the no-limit negative tail, the failure anatomy and right-tail artifacts call it out.

## Validation

```json
{
  "gate74b_passed": true,
  "gate74e_passed": true,
  "gate75a_passed_and_closed": true,
  "gate75a_matrix_not_executed_by_this_gate": true,
  "manifest_complete": true,
  "warehouse_hash_matches_gate74b_summary": true,
  "candidate_b_forced28_preserved": true,
  "candidate_b_directions_mutated": false,
  "pairs_replayed": 28,
  "audnzd_excluded": false,
  "weeks_replayed": 373,
  "expected_weeks_replayed": 373,
  "pair_week_rows_replayed": 10444,
  "fixed_rule_count": 17,
  "pair_two_sided_target_count": 3,
  "t150_no_limit_reference_included": true,
  "account_reset_target_count": 0,
  "final_reset_runner_row_count": 6,
  "final_reset_runner_fractions": [
    0.25,
    0.5
  ],
  "account_emergency_sl_reference_row_count": 4,
  "account_emergency_sl_bands": [
    -3,
    -5
  ],
  "account_level_emergency_sl_replay_started": true,
  "account_emergency_rows_reference_only": true,
  "pair_series_only_account_reset_claim_started": false,
  "unbounded_parameter_search_started": false,
  "costs_applied": false,
  "spread_slippage_swap_commission_applied": false,
  "risk_layer_started": false,
  "correlation_pruning_started": false,
  "pair_pruning_started": false,
  "fair_value_pruning_started": false,
  "exit_promotion_started": false,
  "mt5_live_runtime_started": false,
  "app_runtime_started": false,
  "brain_truth_mutated": false,
  "source_mutation_started": false,
  "candidate_c_promotion_started": false,
  "candidate_d_retest_started": false,
  "candidate_e_started": false,
  "alpha_v2_started": false,
  "focus_closed_matches_gate74e": true,
  "focus_equity_matches_gate74e": true,
  "focus_open_matches_gate74e": true,
  "focus_drawdown_matches_gate74e": true,
  "focus_flip_loss_matches_gate74e": true,
  "gate76_best_no_limit_t150_reproduced": true,
  "gate77_t075_l3_reproduced": true,
  "gate77_t100_l3_reproduced": true,
  "gate77_t125_l3_reproduced": true,
  "gate77_limited_reentry_rows_reproduced_before_comparison": true,
  "gate76_and_gate77_key_rows_reproduced_before_comparison": true,
  "fill_level_trailing_started": false,
  "closed_and_equity_reported_side_by_side": true
}
```

## Artifacts

- adapterSummaryRows: `docs/research/gates/gate78/artifacts/gate78-pair-two-sided-limited-reentry-enhancement-matrix/adapter-summary.rows.json`
- weeklyEquityRows: `docs/research/gates/gate78/artifacts/gate78-pair-two-sided-limited-reentry-enhancement-matrix/weekly-equity-truth.rows.json`
- annualRows: `docs/research/gates/gate78/artifacts/gate78-pair-two-sided-limited-reentry-enhancement-matrix/annual-summary.rows.json`
- expansionAttributionRows: `docs/research/gates/gate78/artifacts/gate78-pair-two-sided-limited-reentry-enhancement-matrix/expansion-attribution-vs-adverse-focus.rows.json`
- fillSideAttributionRows: `docs/research/gates/gate78/artifacts/gate78-pair-two-sided-limited-reentry-enhancement-matrix/fill-side-attribution.rows.json`
- runnerContributionRows: `docs/research/gates/gate78/artifacts/gate78-pair-two-sided-limited-reentry-enhancement-matrix/runner-contribution.rows.json`
- runnerRankingRows: `docs/research/gates/gate78/artifacts/gate78-pair-two-sided-limited-reentry-enhancement-matrix/runner-ranking.rows.json`
- rightTailRetentionRows: `docs/research/gates/gate78/artifacts/gate78-pair-two-sided-limited-reentry-enhancement-matrix/right-tail-retention.rows.json`
- accountEmergencySlRows: `docs/research/gates/gate78/artifacts/gate78-pair-two-sided-limited-reentry-enhancement-matrix/account-emergency-sl-attribution.rows.json`
- failureAnatomyRows: `docs/research/gates/gate78/artifacts/gate78-pair-two-sided-limited-reentry-enhancement-matrix/failure-anatomy.rows.json`
- resetCountWeeklyRows: `docs/research/gates/gate78/artifacts/gate78-pair-two-sided-limited-reentry-enhancement-matrix/reset-count-week.rows.json`
- resetCountPairRows: `docs/research/gates/gate78/artifacts/gate78-pair-two-sided-limited-reentry-enhancement-matrix/reset-count-pair.rows.json`
- tailConcentrationPairRows: `docs/research/gates/gate78/artifacts/gate78-pair-two-sided-limited-reentry-enhancement-matrix/tail-concentration-pair.rows.json`
- tailConcentrationCurrencyRows: `docs/research/gates/gate78/artifacts/gate78-pair-two-sided-limited-reentry-enhancement-matrix/tail-concentration-currency.rows.json`
- commandReceipt: `docs/research/gates/gate78/artifacts/gate78-pair-two-sided-limited-reentry-enhancement-matrix/command-receipt.json`
- summaryJson: `docs/research/gates/gate78/artifacts/gate78-pair-two-sided-limited-reentry-enhancement-matrix/gate78-summary.json`
- shaIdentity: `docs/research/gates/gate78/artifacts/gate78-pair-two-sided-limited-reentry-enhancement-matrix/gate78-sha256.txt`
- report: `docs/research/gates/gate78/GATE78_PAIR_TWO_SIDED_LIMITED_REENTRY_ENHANCEMENT_MATRIX_2026-06-29.md`

## Stop Line

Gate 78 is enhancement-matrix evidence only. Do not promote, start costs, risk, pair pruning, Gate 75B, Gate 79, MT5/live, app/runtime, retuning, or source mutation unless Freedom explicitly opens the next scope.
