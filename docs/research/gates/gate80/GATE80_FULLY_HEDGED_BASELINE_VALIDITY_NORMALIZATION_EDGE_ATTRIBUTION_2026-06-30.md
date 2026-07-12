# Gate 80 Fully Hedged Baseline Validity, Normalization, and Edge Attribution

Generated: `2026-06-30T17:39:11.951Z`

## Verdict

`PASS_HEDGED_BASELINE_PROMISING_BUT_COST_MARGIN_VALIDATION_REQUIRED_NO_PROMOTION`

## Scope

- Validates whether Gate 79's fully hedged long+short reference is mechanically real or an accounting artifact.
- Compares directional T075/T100/T125, Gate74E adverse-only focus, fully hedged T100/L3, fully hedged no-limit, long-only, short-only, deterministic random-side, and fixed T100 flip diagnostics.
- Uses the Gate 74B trade-leg path warehouse; Candidate B directions remain read-only and unchanged.
- Cost and margin sections are preliminary transparent proxies only, not a broker model or risk layer.
- Does not promote, freeze, exclude pairs, exclude AUDNZD, start fair-value pruning, start risk-layer pruning, mutate Brain/source truth, or touch MT5/live/app/runtime.

## Direct Answers

| question | answer | evidence |
|---|---|---|
| Is the fully hedged result mechanically valid? | yes_under_gross_no_cost_replay_semantics | long_short_cycles_not_netted_shared_close_reset_pnl_math_data_end_inventory_visible |
| Does the fully hedged system still beat the directional system after fair exposure normalization? | yes_on_gross_side_slot_and_risk_budget_proxies | {"rule_id":"FULLY_HEDGED_LONG_SHORT_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE","raw_final_equity_adr":53646.297719,"raw_max_drawdown_adr":-705.647194,"gross_pair_side_slots_proxy":56,"gross_exposure_normalized_to_28_pair_side_slots_adr":26823.14886,"margin_proxy_denominator_abs_dd_plus_abs_open":1672.379309,"margin_proxy_return_per_unit":32.077829,"fill_count":204752,"fill_ratio_vs_t100":1.930166,"final_equity_per_10000_fills_adr":2620.062208,"risk_budget_scale_to_t100_dd":2.819316,"risk_budget_normalized_final_equity_to_t100_dd_adr":151245.882955,"normalized_edge_vs_t100_gross_slots_adr":13050.149096,"content_hash":"E71A9C5B74A010B3210826A0DC584E3598562766555B7C9F7E74B36742EEEEEC"} |
| Is the fully hedged edge large enough to plausibly survive real trading friction? | plausibly_yes_but_requires_full_broker_model | {"rule_id":"FULLY_HEDGED_LONG_SHORT_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE","fill_count":204752,"raw_final_equity_adr":53646.297719,"break_even_cost_adr_per_fill":0.262006,"cost_adr_per_fill_to_reduce_return_25pct":0.065502,"cost_adr_per_fill_to_reduce_return_50pct":0.131003,"cost_adr_per_fill_to_make_flat":0.262006,"final_equity_after_0_01_adr_per_fill_cost":51598.777719,"final_equity_after_0_05_adr_per_fill_cost":43408.697719,"equal_0_01_cost_still_beats_directional_t100":true,"hedged_vs_directional_equal_cost_crossover_adr_per_fill":0.404099,"cost_read":"large_gross_edge_buffer_but_full_broker_cost_model_required","content_hash":"79FE6523BDE3E544ACB571D71DF500627B4BDAF5BB32DBCB6B9D8F1C2EC4FF86"} |
| Is the fully hedged equity curve genuinely smoother, or does it hide unresolved inventory? | smoother_but_open_inventory_visible | {"rule_id":"FULLY_HEDGED_LONG_SHORT_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE","final_equity_adr":53646.297719,"max_drawdown_adr":-705.647194,"equity_curve_smoothness_score":307.029797,"weekly_mtm_volatility_adr":167.99567,"downside_weekly_volatility_adr":130.341042,"time_in_drawdown_weeks":53,"longest_drawdown_weeks":2,"recovery_duration_from_max_drawdown_weeks_proxy":2,"worst_4_week_period_adr":-280.187081,"worst_13_week_period_adr":915.954548,"worst_26_week_period_adr":2862.191747,"monthly_consistency":0.965116,"path_skew_proxy_mean_minus_median":3.060464,"top5_loss_share_of_total_losses":0.368374,"unresolved_inventory_read":"open_inventory_visible","content_hash":"F7ECEB240107C212F130930DDEBA1B4750258F81170FF5168F52B338F576B640"} |
| Does Candidate B add directional value, reduce risk, increase risk, or mainly introduce flip-loss damage? | candidate_b_direction_does_not_beat_non_directional_hedged_harvest_and_introduces_flip_loss | {"comparison":"candidate_b_directional_t100_l3_vs_fully_hedged_t100_l3","left_rule_id":"PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK","right_rule_id":"FULLY_HEDGED_LONG_SHORT_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE","left_final_equity_adr":13772.999764,"right_final_equity_adr":53646.297719,"left_minus_right_equity_adr":-39873.297955,"left_max_drawdown_adr":-1989.442654,"right_max_drawdown_adr":-705.647194,"left_minus_right_drawdown_adr":-1283.79546,"left_flip_loss_adr":-6297.282489,"right_flip_loss_adr":0,"read":"left_does_not_add_enough_edge","content_hash":"A06EEA88D19B9403E04CA9098549366B40BB44E85989D9A729AB39467895BF75"} |
| Which family, if any, is realistically closer to Freedom's target? | fully_hedged_harvest_family_is_closer_but_not_promotable_until_cost_margin_validation | Gate80 target feasibility uses rough linear ADR scaling only; no promotion or risk layer started |

## Implementation Validity

| check | value |
|---|---|
| exact_hedged_rules | T100/S020/L3 weekly bounded long+short on every forced-28 pair; no Candidate B mutation; diagnostic only |
| long_side_lifecycle | tracked as independent LONG cycle with its own fills, target resets, terminal reset-limit close, and data-end open inventory |
| short_side_lifecycle | tracked as independent SHORT cycle with identical fill, target reset, terminal reset-limit, and data-end inventory logic |
| long_short_netting | not netted; long and short cycles are tracked separately and summed only at weekly/account reporting |
| realized_unrealized_pnl | same cycleNetPnlAdr math as directional replay; mark price reconstructed from Gate74B warehouse path |
| open_inventory_visible | yes; weekly open_unrealized_adr and data_end sample_end events are written |
| future_costs | both sides must pay costs in any full broker model; Gate80 uses preliminary per-fill stress only |
| margin_exposure | both sides consume gross pair-side exposure; Gate80 reports gross side-slot and margin proxies, not broker margin |
| close_event_symmetry | yes; closeCycle is shared by long, short, hedged, and directional rules |
| reset_event_symmetry | yes; target reset and terminal reset-limit logic are shared for both sides |
| data_end_inventory | included through sample_end close events and weekly open snapshots |
| overlap_counting | gross exposure is double-counted for long+short; PnL is not netted; normalized tables expose this explicitly |
| mechanical_validity_answer | mechanically_valid_under_gross_no_cost_replay_semantics |

## Raw Comparison

| rule_id | rule_family | closed_total_adr | final_equity_adr | max_drawdown_adr | return_drawdown | weekly_mtm_profit_factor | adr_sharpe_weekly | adr_sortino_weekly | weekly_mtm_win_rate | monthly_mtm_win_rate | worst_1_week_mtm_loss_adr | worst_5_week_mtm_loss_adr | worst_13_week_mtm_loss_adr | final_open_unrealized_adr | worst_open_unrealized_adr | flip_loss_adr | total_fills | resets | worst_pair_by_mtm | worst_currency_by_mtm |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP | adverse_only_pair_net_grid | 14381.312614 | 9901.156008 | -5462.545131 | 1.812554 | 1.254319 | 0.070691 | 0.098123 | 0.533512 | 0.662791 | -1582.117861 | -2392.383436 | -3908.06394 | -4480.156606 | -5730.416295 | -10815.950986 | 124689 | 28300 | AUDNZD | AUD |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | pair_reset_limit | 14021.947533 | 11713.727501 | -1811.737115 | 6.465468 | 1.51746 | 0.13524 | 0.176564 | 0.613941 | 0.709302 | -1139.447341 | -1634.856483 | -1801.272614 | -2308.220032 | -2627.126459 | -5132.272395 | 107731 | 21658 | AUDNZD | AUD |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | pair_reset_limit | 16124.084275 | 13772.999764 | -1989.442654 | 6.923044 | 1.561828 | 0.138719 | 0.188989 | 0.595174 | 0.755814 | -1151.146735 | -1623.435434 | -1989.442654 | -2351.084511 | -3001.945057 | -6297.282489 | 106080 | 19367 | AUDNZD | AUD |
| PAIR_TWO_SIDED_GRID_T125_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | pair_reset_limit | 17485.463669 | 13018.163434 | -4074.085132 | 3.195359 | 1.440649 | 0.113014 | 0.152676 | 0.592493 | 0.72093 | -1333.160859 | -2305.981966 | -3299.95095 | -4467.300235 | -5032.162889 | -7245.973831 | 110454 | 17218 | AUDNZD | AUD |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_LOSER_WAREHOUSE | flip_counterfactual | 16193.653693 | 13842.569182 | -1992.408147 | 6.947657 | 1.563144 | 0.139197 | 0.189578 | 0.600536 | 0.744186 | -1151.146735 | -1634.5264 | -1992.408147 | -2351.084511 | -3001.945057 | 0 | 106080 | 19367 | AUDNZD | AUD |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__NO_FLIP_FORCE_DIAGNOSTIC | flip_counterfactual | 22529.655745 | 14820.927278 | -2895.729322 | 5.118202 | 1.438622 | 0.120571 | 0.169177 | 0.576408 | 0.686047 | -1227.028629 | -2240.958708 | -2559.995671 | -7708.728467 | -8067.331207 | 0 | 105766 | 19367 | AUDNZD | AUD |
| FULLY_HEDGED_LONG_SHORT_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE | fully_hedged_reference | 53870.954145 | 53646.297719 | -705.647194 | 76.024249 | 10.308136 | 0.856116 | 1.103443 | 0.857909 | 0.965116 | -705.647194 | -232.636634 | 915.954548 | -224.656426 | -966.732115 | 0 | 204752 | 48500 | EURCHF | JPY |
| FULLY_HEDGED_LONG_SHORT_28_PAIR_WEEKLY_T100_S020_NO_LIMIT_REFERENCE | fully_hedged_reference | 82805.435182 | 82549.112283 | -1167.092908 | 70.730541 | 22.70833 | 1.007575 | 0.902634 | 0.932976 | 0.988372 | -1167.092908 | -9.886152 | 1520.691714 | -256.322899 | -1927.15691 | 0 | 305641 | 74186 | AUDNZD | CAD |
| LONG_ONLY_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE | all_pairs_direction_reference | 27202.723157 | 27114.519974 | -563.927568 | 48.081565 | 6.273392 | 0.619147 | 0.712334 | 0.839142 | 0.953488 | -563.927568 | -398.697289 | 201.456977 | -88.203183 | -752.678688 | 0 | 102551 | 24544 | EURCHF | EUR |
| SHORT_ONLY_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE | all_pairs_direction_reference | 26668.230988 | 26531.777745 | -694.023413 | 38.228938 | 6.188664 | 0.644807 | 0.704105 | 0.817694 | 0.988372 | -694.023413 | -492.885428 | 91.528115 | -136.453243 | -829.213048 | 0 | 102201 | 23956 | GBPJPY | JPY |
| DETERMINISTIC_RANDOM_SIDE_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE | all_pairs_direction_reference | 26859.003852 | 26726.881812 | -375.382096 | 71.199138 | 7.910906 | 0.775429 | 0.881178 | 0.863271 | 0.965116 | -375.382096 | -130.265732 | 418.956166 | -132.12204 | -493.661799 | 0 | 102253 | 24220 | EURCHF | JPY |

## Exposure And Margin Normalization

| rule_id | raw_final_equity_adr | raw_max_drawdown_adr | gross_pair_side_slots_proxy | gross_exposure_normalized_to_28_pair_side_slots_adr | margin_proxy_denominator_abs_dd_plus_abs_open | margin_proxy_return_per_unit | fill_count | fill_ratio_vs_t100 | final_equity_per_10000_fills_adr | risk_budget_scale_to_t100_dd | risk_budget_normalized_final_equity_to_t100_dd_adr | normalized_edge_vs_t100_gross_slots_adr |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP | 9901.156008 | -5462.545131 | 28 | 9901.156008 | 11192.961426 | 0.884588 | 124689 | 1.175424 | 794.068122 | 0.364197 | 3605.971505 | -3871.843756 |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | 11713.727501 | -1811.737115 | 28 | 11713.727501 | 4438.863574 | 2.638902 | 107731 | 1.015564 | 1087.312612 | 1.098086 | 12862.676894 | -2059.272263 |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | 13772.999764 | -1989.442654 | 28 | 13772.999764 | 4991.387711 | 2.759353 | 106080 | 1 | 1298.359706 | 1 | 13772.999764 | 0 |
| PAIR_TWO_SIDED_GRID_T125_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | 13018.163434 | -4074.085132 | 28 | 13018.163434 | 9106.248021 | 1.429586 | 110454 | 1.041233 | 1178.604979 | 0.488316 | 6356.982923 | -754.83633 |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_LOSER_WAREHOUSE | 13842.569182 | -1992.408147 | 28 | 13842.569182 | 4994.353204 | 2.771644 | 106080 | 1 | 1304.917909 | 0.998512 | 13821.965953 | 69.569418 |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__NO_FLIP_FORCE_DIAGNOSTIC | 14820.927278 | -2895.729322 | 28 | 14820.927278 | 10963.060529 | 1.351897 | 105766 | 0.99704 | 1401.294109 | 0.687026 | 10182.369144 | 1047.927514 |
| FULLY_HEDGED_LONG_SHORT_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE | 53646.297719 | -705.647194 | 56 | 26823.14886 | 1672.379309 | 32.077829 | 204752 | 1.930166 | 2620.062208 | 2.819316 | 151245.882955 | 13050.149096 |
| FULLY_HEDGED_LONG_SHORT_28_PAIR_WEEKLY_T100_S020_NO_LIMIT_REFERENCE | 82549.112283 | -1167.092908 | 56 | 41274.556142 | 3094.249818 | 26.678231 | 305641 | 2.881231 | 2700.852055 | 1.704614 | 140714.354359 | 27501.556377 |
| LONG_ONLY_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE | 27114.519974 | -563.927568 | 28 | 27114.519974 | 1316.606256 | 20.594251 | 102551 | 0.966733 | 2644.003469 | 3.527834 | 95655.516134 | 13341.52021 |
| SHORT_ONLY_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE | 26531.777745 | -694.023413 | 28 | 26531.777745 | 1523.236461 | 17.41803 | 102201 | 0.963433 | 2596.038957 | 2.866535 | 76054.279068 | 12758.777981 |
| DETERMINISTIC_RANDOM_SIDE_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE | 26726.881812 | -375.382096 | 28 | 26726.881812 | 869.043895 | 30.754352 | 102253 | 0.963923 | 2613.799283 | 5.29978 | 141646.602893 | 12953.882048 |

## Cost Sensitivity Precheck

| rule_id | fill_count | raw_final_equity_adr | break_even_cost_adr_per_fill | cost_adr_per_fill_to_reduce_return_25pct | cost_adr_per_fill_to_reduce_return_50pct | cost_adr_per_fill_to_make_flat | final_equity_after_0_01_adr_per_fill_cost | final_equity_after_0_05_adr_per_fill_cost | equal_0_01_cost_still_beats_directional_t100 | hedged_vs_directional_equal_cost_crossover_adr_per_fill | cost_read |
|---|---|---|---|---|---|---|---|---|---|---|---|
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP | 124689 | 9901.156008 | 0.079407 | 0.019852 | 0.039703 | 0.079407 | 8654.266008 | 3666.706008 | false | 0.404099 | preliminary_cost_proxy_only |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | 107731 | 11713.727501 | 0.108731 | 0.027183 | 0.054366 | 0.108731 | 10636.417501 | 6327.177501 | false | 0.404099 | preliminary_cost_proxy_only |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | 106080 | 13772.999764 | 0.129836 | 0.032459 | 0.064918 | 0.129836 | 12712.199764 | 8468.999764 | false | 0.404099 | preliminary_cost_proxy_only |
| PAIR_TWO_SIDED_GRID_T125_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | 110454 | 13018.163434 | 0.11786 | 0.029465 | 0.05893 | 0.11786 | 11913.623434 | 7495.463434 | false | 0.404099 | preliminary_cost_proxy_only |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_LOSER_WAREHOUSE | 106080 | 13842.569182 | 0.130492 | 0.032623 | 0.065246 | 0.130492 | 12781.769182 | 8538.569182 | true | 0.404099 | preliminary_cost_proxy_only |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__NO_FLIP_FORCE_DIAGNOSTIC | 105766 | 14820.927278 | 0.140129 | 0.035032 | 0.070065 | 0.140129 | 13763.267278 | 9532.627278 | true | 0.404099 | preliminary_cost_proxy_only |
| FULLY_HEDGED_LONG_SHORT_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE | 204752 | 53646.297719 | 0.262006 | 0.065502 | 0.131003 | 0.262006 | 51598.777719 | 43408.697719 | true | 0.404099 | large_gross_edge_buffer_but_full_broker_cost_model_required |
| FULLY_HEDGED_LONG_SHORT_28_PAIR_WEEKLY_T100_S020_NO_LIMIT_REFERENCE | 305641 | 82549.112283 | 0.270085 | 0.067521 | 0.135043 | 0.270085 | 79492.702283 | 67267.062283 | true | 0.404099 | preliminary_cost_proxy_only |
| LONG_ONLY_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE | 102551 | 27114.519974 | 0.2644 | 0.0661 | 0.1322 | 0.2644 | 26089.009974 | 21986.969974 | true | 0.404099 | preliminary_cost_proxy_only |
| SHORT_ONLY_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE | 102201 | 26531.777745 | 0.259604 | 0.064901 | 0.129802 | 0.259604 | 25509.767745 | 21421.727745 | true | 0.404099 | preliminary_cost_proxy_only |
| DETERMINISTIC_RANDOM_SIDE_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE | 102253 | 26726.881812 | 0.26138 | 0.065345 | 0.13069 | 0.26138 | 25704.351812 | 21614.231812 | true | 0.404099 | preliminary_cost_proxy_only |

## Exposure Proxy

| rule_id | rule_family | average_active_pair_side_slots_proxy | max_active_pair_side_slots_proxy | average_open_inventory_abs_adr | max_open_inventory_abs_adr | total_fills | resets | worst_pair_by_mtm | worst_currency_by_mtm |
|---|---|---|---|---|---|---|---|---|---|
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP | adverse_only_pair_net_grid | 28 | 28 | 1095.021689 | 5730.416295 | 124689 | 28300 | AUDNZD | AUD |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | pair_reset_limit | 28 | 28 | 498.892713 | 2627.126459 | 107731 | 21658 | AUDNZD | AUD |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | pair_reset_limit | 28 | 28 | 595.047388 | 3001.945057 | 106080 | 19367 | AUDNZD | AUD |
| PAIR_TWO_SIDED_GRID_T125_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | pair_reset_limit | 28 | 28 | 804.10926 | 5032.162889 | 110454 | 17218 | AUDNZD | AUD |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_LOSER_WAREHOUSE | flip_counterfactual | 28 | 28 | 595.974081 | 3001.945057 | 106080 | 19367 | AUDNZD | AUD |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__NO_FLIP_FORCE_DIAGNOSTIC | flip_counterfactual | 28 | 28 | 2238.865171 | 8067.331207 | 105766 | 19367 | AUDNZD | AUD |
| FULLY_HEDGED_LONG_SHORT_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE | fully_hedged_reference | 56 | 56 | 142.941837 | 966.732115 | 204752 | 48500 | EURCHF | JPY |
| FULLY_HEDGED_LONG_SHORT_28_PAIR_WEEKLY_T100_S020_NO_LIMIT_REFERENCE | fully_hedged_reference | 56 | 56 | 226.678314 | 1927.15691 | 305641 | 74186 | AUDNZD | CAD |
| LONG_ONLY_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE | all_pairs_direction_reference | 28 | 28 | 71.384067 | 752.678688 | 102551 | 24544 | EURCHF | EUR |
| SHORT_ONLY_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE | all_pairs_direction_reference | 28 | 28 | 71.561777 | 829.213048 | 102201 | 23956 | GBPJPY | JPY |
| DETERMINISTIC_RANDOM_SIDE_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE | all_pairs_direction_reference | 28 | 28 | 70.838909 | 493.661799 | 102253 | 24220 | EURCHF | JPY |

## Equity Smoothness

| rule_id | final_equity_adr | max_drawdown_adr | equity_curve_smoothness_score | weekly_mtm_volatility_adr | downside_weekly_volatility_adr | time_in_drawdown_weeks | longest_drawdown_weeks | worst_4_week_period_adr | worst_13_week_period_adr | worst_26_week_period_adr | monthly_consistency | path_skew_proxy_mean_minus_median | top5_loss_share_of_total_losses | unresolved_inventory_read |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP | 9901.156008 | -5462.545131 | 42.079601 | 375.500597 | 270.523902 | 280 | 42 | -2563.980674 | -3908.06394 | -4931.527275 | 0.662791 | 7.340363 | 0.165987 | open_inventory_visible |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | 11713.727501 | -1811.737115 | 76.669589 | 232.209317 | 177.862014 | 232 | 23 | -1320.821015 | -1801.272614 | -1431.330143 | 0.709302 | 0.510328 | 0.180615 | open_inventory_visible |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | 13772.999764 | -1989.442654 | 81.80169 | 266.184638 | 195.381846 | 233 | 25 | -1516.75362 | -1989.442654 | -1618.939434 | 0.755814 | 2.566164 | 0.187692 | open_inventory_visible |
| PAIR_TWO_SIDED_GRID_T125_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | 13018.163434 | -4074.085132 | 67.343587 | 308.821249 | 228.596742 | 244 | 27 | -2140.08273 | -3299.95095 | -3700.803801 | 0.72093 | 6.976519 | 0.18945 | open_inventory_visible |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_LOSER_WAREHOUSE | 13842.569182 | -1992.408147 | 81.951145 | 266.611821 | 195.757998 | 232 | 25 | -1517.873487 | -1992.408147 | -1619.279468 | 0.744186 | 0.192231 | 0.187273 | open_inventory_visible |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__NO_FLIP_FORCE_DIAGNOSTIC | 14820.927278 | -2895.729322 | 67.089487 | 329.550948 | 234.868671 | 248 | 39 | -1995.035439 | -2559.995671 | -2463.122581 | 0.686047 | 4.790706 | 0.162258 | open_inventory_visible |
| FULLY_HEDGED_LONG_SHORT_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE | 53646.297719 | -705.647194 | 307.029797 | 167.99567 | 130.341042 | 53 | 2 | -280.187081 | 915.954548 | 2862.191747 | 0.965116 | 3.060464 | 0.368374 | open_inventory_visible |
| FULLY_HEDGED_LONG_SHORT_28_PAIR_WEEKLY_T100_S020_NO_LIMIT_REFERENCE | 82549.112283 | -1167.092908 | 341.534267 | 219.647506 | 245.183777 | 26 | 2 | -14.270997 | 1520.691714 | 4408.050816 | 0.988372 | 17.341329 | 0.672299 | open_inventory_visible |
| LONG_ONLY_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE | 27114.519974 | -563.927568 | 270.434379 | 117.408362 | 102.049143 | 61 | 3 | -464.974514 | 201.456977 | 1259.397159 | 0.953488 | -0.725183 | 0.339328 | open_inventory_visible |
| SHORT_ONLY_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE | 26531.777745 | -694.023413 | 269.225499 | 110.31327 | 101.02289 | 71 | 2 | -550.010253 | 91.528115 | 1027.034615 | 0.988372 | -2.155597 | 0.33705 | open_inventory_visible |
| DETERMINISTIC_RANDOM_SIDE_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE | 26726.881812 | -375.382096 | 289.282358 | 92.405449 | 81.316 | 51 | 2 | -190.334156 | 418.956166 | 1339.375073 | 0.965116 | 2.148494 | 0.364264 | open_inventory_visible |

## Edge Attribution

| comparison | left_rule_id | right_rule_id | left_final_equity_adr | right_final_equity_adr | left_minus_right_equity_adr | left_max_drawdown_adr | right_max_drawdown_adr | left_minus_right_drawdown_adr | left_flip_loss_adr | right_flip_loss_adr | read |
|---|---|---|---|---|---|---|---|---|---|---|---|
| candidate_b_directional_t100_l3_vs_fully_hedged_t100_l3 | PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | FULLY_HEDGED_LONG_SHORT_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE | 13772.999764 | 53646.297719 | -39873.297955 | -1989.442654 | -705.647194 | -1283.79546 | -6297.282489 | 0 | left_does_not_add_enough_edge |
| candidate_b_directional_t100_l3_vs_long_only_all_pairs | PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | LONG_ONLY_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE | 13772.999764 | 27114.519974 | -13341.52021 | -1989.442654 | -563.927568 | -1425.515086 | -6297.282489 | 0 | left_does_not_add_enough_edge |
| candidate_b_directional_t100_l3_vs_short_only_all_pairs | PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | SHORT_ONLY_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE | 13772.999764 | 26531.777745 | -12758.777981 | -1989.442654 | -694.023413 | -1295.419241 | -6297.282489 | 0 | left_does_not_add_enough_edge |
| candidate_b_directional_t100_l3_vs_deterministic_random_side | PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | DETERMINISTIC_RANDOM_SIDE_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE | 13772.999764 | 26726.881812 | -12953.882048 | -1989.442654 | -375.382096 | -1614.060558 | -6297.282489 | 0 | left_does_not_add_enough_edge |
| candidate_b_current_flip_vs_no_flip_force_diagnostic | PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__NO_FLIP_FORCE_DIAGNOSTIC | 13772.999764 | 14820.927278 | -1047.927514 | -1989.442654 | -2895.729322 | 906.286668 | -6297.282489 | 0 | left_does_not_add_enough_edge |
| candidate_b_current_flip_vs_warehouse_losing_flip_diagnostic | PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_LOSER_WAREHOUSE | 13772.999764 | 13842.569182 | -69.569418 | -1989.442654 | -1992.408147 | 2.965493 | -6297.282489 | 0 | left_does_not_add_enough_edge |

## Close Reason Breakdown

| rule_id | flip_policy | close_reason_bucket | event_count | adr | loss_adr | median_event_adr | worst_event_adr | average_age_hours |
|---|---|---|---|---|---|---|---|---|
| WEEKLY_FORCED_CLOSE | current_forced_flip_close | weekly_close | 10444 | 638.115405 | -5409.48869 | 0.033368 | -8.320839 | 110.836359 |
| CARRY_UNTIL_FLIP | current_forced_flip_close | candidate_b_flip_close | 902 | 694.688146 | -963.436728 | 0.294797 | -21.63951 | 1833.476718 |
| CARRY_UNTIL_FLIP | current_forced_flip_close | data_end_open_inventory | 28 | -97.1683 | -116.965791 | -0.638608 | -35.838472 | 3542.857143 |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP | current_forced_flip_close | target_reset_close | 28300 | 24983.633059 | 0 | 0.782799 | 0 | 55.062488 |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP | current_forced_flip_close | candidate_b_flip_close | 902 | -10602.320445 | -10815.950986 | -0.7546 | -1317.346336 | 193.844623 |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP | current_forced_flip_close | data_end_open_inventory | 28 | -4480.156606 | -4481.135481 | -3.062041 | -3099.046979 | 709.991071 |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP | current_forced_flip_close | target_reset_close | 18703 | 32434.879613 | 0 | 1.566357 | 0 | 80.81217 |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP | current_forced_flip_close | candidate_b_flip_close | 902 | -14422.455899 | -14668.815258 | -1.912746 | -1335.319119 | 241.977568 |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP | current_forced_flip_close | data_end_open_inventory | 28 | -5716.628824 | -5718.248238 | -5.981555 | -3088.881635 | 832.222024 |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_2_PAIR_RESETS_WEEK | current_forced_flip_close | target_reset_close | 8590 | 7722.972214 | 0 | 0.792461 | 0 | 67.898855 |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_2_PAIR_RESETS_WEEK | current_forced_flip_close | terminal_reset_limit_close | 7685 | 6557.212511 | 0 | 0.791236 | 0 | 19.822462 |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_2_PAIR_RESETS_WEEK | current_forced_flip_close | candidate_b_flip_close | 170 | -3761.400644 | -3789.579526 | -8.926051 | -357.793296 | 305.370882 |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_2_PAIR_RESETS_WEEK | current_forced_flip_close | data_end_open_inventory | 11 | -381.236523 | -381.236523 | -18.95205 | -146.633187 | 520.063636 |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | current_forced_flip_close | target_reset_close | 15493 | 13841.079814 | 0 | 0.793572 | 0 | 56.743212 |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | current_forced_flip_close | terminal_reset_limit_close | 6165 | 5272.805365 | 0 | 0.791059 | 0 | 17.354839 |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | current_forced_flip_close | candidate_b_flip_close | 311 | -5091.937646 | -5132.272395 | -5.320013 | -357.793296 | 239.572026 |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | current_forced_flip_close | data_end_open_inventory | 13 | -2308.220032 | -2308.284089 | -17.235202 | -2073.550175 | 745.032051 |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | current_forced_flip_close | target_reset_close | 14297 | 16658.181016 | 0 | 1.047997 | 0 | 71.353223 |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | current_forced_flip_close | terminal_reset_limit_close | 5070 | 5698.938595 | 0 | 1.044309 | 0 | 19.447045 |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | current_forced_flip_close | candidate_b_flip_close | 402 | -6233.035336 | -6297.282489 | -4.091098 | -621.509684 | 229.098051 |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | current_forced_flip_close | data_end_open_inventory | 19 | -2351.084511 | -2351.309915 | -12.004464 | -2073.0693 | 698.388596 |
| PAIR_TWO_SIDED_GRID_T125_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | current_forced_flip_close | target_reset_close | 13141 | 18963.880557 | 0 | 1.310424 | 0 | 85.527734 |
| PAIR_TWO_SIDED_GRID_T125_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | current_forced_flip_close | terminal_reset_limit_close | 4077 | 5679.357619 | 0 | 1.30544 | 0 | 20.591411 |
| PAIR_TWO_SIDED_GRID_T125_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | current_forced_flip_close | candidate_b_flip_close | 495 | -7157.774507 | -7245.973831 | -3.835462 | -628.671368 | 240.270539 |
| PAIR_TWO_SIDED_GRID_T125_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | current_forced_flip_close | data_end_open_inventory | 23 | -4467.300235 | -4469.172912 | -12.004464 | -3119.377621 | 843.47971 |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_LOSER_WAREHOUSE | warehouse_losing_flip_no_new_fills | target_reset_close | 14297 | 16658.181016 | 0 | 1.047997 | 0 | 71.353223 |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_LOSER_WAREHOUSE | warehouse_losing_flip_no_new_fills | terminal_reset_limit_close | 5070 | 5698.938595 | 0 | 1.044309 | 0 | 19.447045 |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_LOSER_WAREHOUSE | warehouse_losing_flip_no_new_fills | warehouse_recovery | 177 | 20.177728 | 0 | 0.061591 | 0 | 200.504237 |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_LOSER_WAREHOUSE | warehouse_losing_flip_no_new_fills | warehouse_hard_loss | 166 | -6241.369363 | -6241.369363 | -18.247304 | -631.409219 | 396.116466 |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_LOSER_WAREHOUSE | warehouse_losing_flip_no_new_fills | candidate_b_flip_close | 58 | 64.247153 | 0 | 0.583468 | 0 | 92.758046 |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_LOSER_WAREHOUSE | warehouse_losing_flip_no_new_fills | data_end_open_inventory | 19 | -2351.084511 | -2351.309915 | -12.004464 | -2073.0693 | 698.388596 |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_LOSER_WAREHOUSE | warehouse_losing_flip_no_new_fills | warehouse_expiry | 1 | -6.521436 | -6.521436 | -6.521436 | -6.521436 | 2241.833333 |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_GRACE_1W | grace_window_losing_flip_no_new_fills | target_reset_close | 14297 | 16658.181016 | 0 | 1.047997 | 0 | 71.353223 |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_GRACE_1W | grace_window_losing_flip_no_new_fills | terminal_reset_limit_close | 5070 | 5698.938595 | 0 | 1.044309 | 0 | 19.447045 |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_GRACE_1W | grace_window_losing_flip_no_new_fills | warehouse_recovery | 196 | 39.316818 | 0 | 0.073667 | 0 | 206.835034 |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_GRACE_1W | grace_window_losing_flip_no_new_fills | grace_expiry | 148 | -5949.075721 | -5949.075721 | -23.289902 | -411.29657 | 522.65 |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_GRACE_1W | grace_window_losing_flip_no_new_fills | candidate_b_flip_close | 58 | 64.247153 | 0 | 0.583468 | 0 | 92.758046 |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_GRACE_1W | grace_window_losing_flip_no_new_fills | data_end_open_inventory | 19 | -2351.084511 | -2351.309915 | -12.004464 | -2073.0693 | 698.388596 |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_CLOSE_SMALL_LOSS_WAREHOUSE_GT3ADR | close_small_loss_warehouse_large_loss | target_reset_close | 14297 | 16658.181016 | 0 | 1.047997 | 0 | 71.353223 |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_CLOSE_SMALL_LOSS_WAREHOUSE_GT3ADR | close_small_loss_warehouse_large_loss | terminal_reset_limit_close | 5070 | 5698.938595 | 0 | 1.044309 | 0 | 19.447045 |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_CLOSE_SMALL_LOSS_WAREHOUSE_GT3ADR | close_small_loss_warehouse_large_loss | warehouse_recovery | 62 | 11.827193 | 0 | 0.09598 | 0 | 241.511021 |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_CLOSE_SMALL_LOSS_WAREHOUSE_GT3ADR | close_small_loss_warehouse_large_loss | candidate_b_flip_close | 179 | -73.983004 | -138.230157 | -0.47532 | -2.94759 | 111.658287 |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_CLOSE_SMALL_LOSS_WAREHOUSE_GT3ADR | close_small_loss_warehouse_large_loss | warehouse_hard_loss | 161 | -6166.006072 | -6166.006072 | -18.754119 | -631.409219 | 398.582402 |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_CLOSE_SMALL_LOSS_WAREHOUSE_GT3ADR | close_small_loss_warehouse_large_loss | data_end_open_inventory | 19 | -2351.084511 | -2351.309915 | -12.004464 | -2073.0693 | 698.388596 |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__NO_FLIP_FORCE_DIAGNOSTIC | no_flip_force_no_new_fills | target_reset_close | 14297 | 16658.181016 | 0 | 1.047997 | 0 | 71.353223 |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__NO_FLIP_FORCE_DIAGNOSTIC | no_flip_force_no_new_fills | terminal_reset_limit_close | 5070 | 5698.938595 | 0 | 1.044309 | 0 | 19.447045 |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__NO_FLIP_FORCE_DIAGNOSTIC | no_flip_force_no_new_fills | warehouse_recovery | 331 | 108.288981 | 0 | 0.093337 | 0 | 1379.566415 |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__NO_FLIP_FORCE_DIAGNOSTIC | no_flip_force_no_new_fills | candidate_b_flip_close | 58 | 64.247153 | 0 | 0.583468 | 0 | 92.758046 |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__NO_FLIP_FORCE_DIAGNOSTIC | no_flip_force_no_new_fills | data_end_open_inventory | 32 | -7708.728467 | -7708.953871 | -24.066837 | -2073.0693 | 10065.648437 |
| FULLY_HEDGED_LONG_SHORT_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE | current_forced_flip_close | target_reset_close | 35591 | 39427.497247 | 0 | 1.04084 | 0 | 26.17859 |
| FULLY_HEDGED_LONG_SHORT_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE | current_forced_flip_close | terminal_reset_limit_close | 12909 | 14443.456898 | 0 | 1.044405 | 0 | 19.836513 |
| FULLY_HEDGED_LONG_SHORT_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE | current_forced_flip_close | data_end_open_inventory | 7976 | -53317.305346 | -53603.620104 | -3.082809 | -120.167048 | 64.581438 |
| FULLY_HEDGED_LONG_SHORT_28_PAIR_WEEKLY_T100_S020_NO_LIMIT_REFERENCE | current_forced_flip_close | target_reset_close | 74186 | 82805.435182 | 0 | 1.044157 | 0 | 20.73729 |
| FULLY_HEDGED_LONG_SHORT_28_PAIR_WEEKLY_T100_S020_NO_LIMIT_REFERENCE | current_forced_flip_close | data_end_open_inventory | 20874 | -84551.01102 | -85754.722864 | -0.98757 | -245.251424 | 37.054528 |
| LONG_ONLY_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE | current_forced_flip_close | target_reset_close | 17964 | 19820.619808 | 0 | 1.039034 | 0 | 25.759156 |
| LONG_ONLY_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE | current_forced_flip_close | terminal_reset_limit_close | 6580 | 7382.103349 | 0 | 1.042391 | 0 | 20.020816 |
| LONG_ONLY_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE | current_forced_flip_close | data_end_open_inventory | 3862 | -26624.882945 | -26768.4942 | -3.064255 | -120.167048 | 64.560116 |
| SHORT_ONLY_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE | current_forced_flip_close | target_reset_close | 17627 | 19606.877439 | 0 | 1.042711 | 0 | 26.606042 |
| SHORT_ONLY_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE | current_forced_flip_close | terminal_reset_limit_close | 6329 | 7061.353549 | 0 | 1.046079 | 0 | 19.644902 |
| SHORT_ONLY_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE | current_forced_flip_close | data_end_open_inventory | 4114 | -26692.422401 | -26835.125904 | -3.095249 | -113.73468 | 64.601454 |
| DETERMINISTIC_RANDOM_SIDE_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE | current_forced_flip_close | target_reset_close | 17749 | 19634.256946 | 0 | 1.041305 | 0 | 26.350778 |
| DETERMINISTIC_RANDOM_SIDE_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE | current_forced_flip_close | terminal_reset_limit_close | 6471 | 7224.746906 | 0 | 1.043398 | 0 | 19.734953 |
| DETERMINISTIC_RANDOM_SIDE_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE | current_forced_flip_close | data_end_open_inventory | 3970 | -26422.912954 | -26569.27695 | -3.12569 | -113.993071 | 64.690991 |

## Flip Anatomy

| rule_id | flip_policy | flip_event_count | total_flip_loss_adr | average_flip_loss_adr | worst_flip_loss_adr | losing_inventory_flip_count | mixed_inventory_flip_count | median_reset_ordinal_at_flip | median_inventory_age_hours_at_flip | worst_pair | worst_currency |
|---|---|---|---|---|---|---|---|---|---|---|---|
| WEEKLY_FORCED_CLOSE | current_forced_flip_close | 0 | 0 |  | 0 | 0 | 0 |  |  |  |  |
| CARRY_UNTIL_FLIP | current_forced_flip_close | 902 | -963.436728 | -2.408592 | -21.63951 | 400 | 0 | 0 | 504 | EURCHF | GBP |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP | current_forced_flip_close | 902 | -10815.950986 | -17.558362 | -1317.346336 | 616 | 108 | 3 | 83.475 | CHFJPY | JPY |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP | current_forced_flip_close | 902 | -14668.815258 | -21.603557 | -1335.319119 | 679 | 197 | 2 | 100.016667 | CHFJPY | JPY |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_2_PAIR_RESETS_WEEK | current_forced_flip_close | 170 | -3789.579526 | -24.4489 | -357.793296 | 155 | 25 | 1 | 168 | AUDNZD | AUD |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | current_forced_flip_close | 311 | -5132.272395 | -19.15027 | -357.793296 | 268 | 58 | 1 | 145.466667 | AUDCAD | AUD |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | current_forced_flip_close | 402 | -6297.282489 | -18.306054 | -621.509684 | 344 | 70 | 1 | 139.208334 | AUDCAD | AUD |
| PAIR_TWO_SIDED_GRID_T125_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | current_forced_flip_close | 495 | -7245.973831 | -17.544731 | -628.671368 | 413 | 93 | 1 | 133.85 | AUDCAD | AUD |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_LOSER_WAREHOUSE | warehouse_losing_flip_no_new_fills | 58 | 0 |  | 0 | 0 | 29 | 2 | 80.533334 | AUDCHF | AUD |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_GRACE_1W | grace_window_losing_flip_no_new_fills | 58 | 0 |  | 0 | 0 | 29 | 2 | 80.533334 | AUDCHF | AUD |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_CLOSE_SMALL_LOSS_WAREHOUSE_GT3ADR | close_small_loss_warehouse_large_loss | 179 | -138.230157 | -1.142398 | -2.94759 | 121 | 70 | 2 | 87.183333 | EURCAD | AUD |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__NO_FLIP_FORCE_DIAGNOSTIC | no_flip_force_no_new_fills | 58 | 0 |  | 0 | 0 | 29 | 2 | 80.533334 | AUDCHF | AUD |
| FULLY_HEDGED_LONG_SHORT_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE | current_forced_flip_close | 0 | 0 |  | 0 | 0 | 0 |  |  |  |  |
| FULLY_HEDGED_LONG_SHORT_28_PAIR_WEEKLY_T100_S020_NO_LIMIT_REFERENCE | current_forced_flip_close | 0 | 0 |  | 0 | 0 | 0 |  |  |  |  |
| LONG_ONLY_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE | current_forced_flip_close | 0 | 0 |  | 0 | 0 | 0 |  |  |  |  |
| SHORT_ONLY_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE | current_forced_flip_close | 0 | 0 |  | 0 | 0 | 0 |  |  |  |  |
| DETERMINISTIC_RANDOM_SIDE_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE | current_forced_flip_close | 0 | 0 |  | 0 | 0 | 0 |  |  |  |  |

## Reset Ordinal and Age

| rule_id | flip_policy | reset_ordinal_bucket | event_count | closed_adr | open_unrealized_adr | win_rate | worst_loss_adr | flip_loss_adr | final_open_loss_adr | worst_pair |
|---|---|---|---|---|---|---|---|---|---|---|
| CARRY_UNTIL_FLIP | current_forced_flip_close | initial_cycle | 930 | 694.688146 | -97.1683 | 0.556541 | -21.63951 | -963.436728 | -116.965791 | AUDNZD |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP | current_forced_flip_close | initial_cycle | 930 | 469.52593 | 0 | 0.978495 | -57.60135 | -303.108341 | 0 | CADJPY |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP | current_forced_flip_close | reset_1 | 7376 | 4585.297225 | -919.873541 | 0.988604 | -289.646736 | -1702.223609 | -919.873541 | AUDJPY |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP | current_forced_flip_close | reset_2 | 6334 | 4276.384028 | -3417.125332 | 0.978979 | -318.297146 | -1180.286331 | -3417.125332 | AUDNZD |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP | current_forced_flip_close | reset_3 | 4968 | 2361.919595 | -27.379447 | 0.978239 | -213.148072 | -1867.04834 | -27.615781 | AUDUSD |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP | current_forced_flip_close | reset_4 | 3544 | 58.371337 | -80.324645 | 0.970605 | -1317.346336 | -2955.663518 | -81.067186 | CHFJPY |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP | current_forced_flip_close | reset_5 | 2304 | -21.301782 | -35.453641 | 0.964767 | -570.227806 | -1976.407635 | -35.453641 | EURCHF |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP | current_forced_flip_close | reset_6 | 1372 | 1020.261868 | 0 | 0.973032 | -36.740495 | -206.658608 | 0 | EURAUD |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP | current_forced_flip_close | reset_7 | 860 | 509.638171 | 0 | 0.977907 | -86.908257 | -251.010645 | 0 | AUDCAD |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP | current_forced_flip_close | reset_8 | 527 | 218.181766 | 0 | 0.969639 | -115.076251 | -267.935663 | 0 | GBPCHF |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP | current_forced_flip_close | reset_9 | 320 | 260.102699 | 0 | 0.9875 | -11.912155 | -13.84743 | 0 | CADCHF |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP | current_forced_flip_close | reset_10 | 229 | 218.17234 | 0 | 0.9869 | -2.163774 | -3.557741 | 0 | USDJPY |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP | current_forced_flip_close | reset_11 | 146 | 70.582232 | 0 | 0.979452 | -46.779209 | -76.828005 | 0 | AUDUSD |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP | current_forced_flip_close | reset_12 | 102 | 83.046002 | 0 | 0.980392 | -5.662592 | -5.796382 | 0 | EURAUD |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP | current_forced_flip_close | reset_13 | 72 | 76.63136 | 0 | 1 | 0 | 0 | 0 | AUDCAD |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP | current_forced_flip_close | reset_14 | 48 | 65.280064 | 0 | 0.979167 | -4.140377 | -4.140377 | 0 | GBPAUD |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP | current_forced_flip_close | reset_15 | 32 | 43.375526 | 0 | 1 | 0 | 0 | 0 | AUDCAD |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP | current_forced_flip_close | reset_16 | 22 | 23.35892 | 0 | 0.954545 | -1.438361 | -1.438361 | 0 | EURJPY |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP | current_forced_flip_close | reset_17 | 17 | 19.730486 | 0 | 1 | 0 | 0 | 0 | AUDCAD |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP | current_forced_flip_close | reset_18 | 11 | 18.853318 | 0 | 1 | 0 | 0 | 0 | AUDCAD |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP | current_forced_flip_close | reset_19 | 7 | 8.144531 | 0 | 1 | 0 | 0 | 0 | AUDCHF |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP | current_forced_flip_close | reset_20 | 5 | 5.264587 | 0 | 1 | 0 | 0 | 0 | AUDCHF |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP | current_forced_flip_close | reset_21 | 2 | 1.731011 | 0 | 1 | 0 | 0 | 0 | AUDCHF |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP | current_forced_flip_close | reset_22 | 1 | 0.833008 | 0 | 1 | 0 | 0 | 0 | AUDCHF |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP | current_forced_flip_close | reset_23 | 1 | 7.928392 | 0 | 1 | 0 | 0 | 0 | AUDCHF |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP | current_forced_flip_close | initial_cycle | 930 | 841.195257 | 0 | 0.954839 | -82.92663 | -642.27958 | 0 | CADJPY |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP | current_forced_flip_close | reset_1 | 6424 | 6549.755176 | -30.706142 | 0.970079 | -615.97793 | -3936.091048 | -31.795207 | AUDCAD |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP | current_forced_flip_close | reset_2 | 4844 | 3735.931514 | -3391.491683 | 0.966928 | -1335.319119 | -4231.274586 | -3391.577044 | AUDNZD |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP | current_forced_flip_close | reset_3 | 3163 | 1942.073093 | -176.080223 | 0.957831 | -1187.735375 | -3220.211043 | -176.525211 | EURJPY |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP | current_forced_flip_close | reset_4 | 1835 | 1805.564294 | -5.787877 | 0.961287 | -296.961047 | -1333.388991 | -5.787877 | USDCAD |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP | current_forced_flip_close | reset_5 | 1002 | 1385.684615 | -162.266396 | 0.963928 | -73.81559 | -326.23501 | -162.266396 | USDCAD |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP | current_forced_flip_close | reset_6 | 573 | 481.915918 | 0 | 0.965096 | -264.727488 | -570.335105 | 0 | AUDCHF |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP | current_forced_flip_close | reset_7 | 324 | 247.349449 | 0 | 0.953704 | -115.714356 | -314.249259 | 0 | GBPCHF |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP | current_forced_flip_close | reset_8 | 197 | 322.422482 | 0 | 0.964467 | -47.32317 | -62.272313 | 0 | AUDUSD |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP | current_forced_flip_close | reset_9 | 126 | 190.154638 | 0 | 0.984127 | -30.319186 | -30.606084 | 0 | GBPCAD |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP | current_forced_flip_close | reset_10 | 82 | 200.968565 | 0 | 1 | 0 | 0 | 0 | AUDCAD |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP | current_forced_flip_close | reset_11 | 49 | 99.900101 | -1950.296503 | 0.979167 | -1.872239 | -1.872239 | -1950.296503 | AUDJPY |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP | current_forced_flip_close | reset_12 | 31 | 56.30373 | 0 | 1 | 0 | 0 | 0 | AUDCAD |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP | current_forced_flip_close | reset_13 | 19 | 42.264382 | 0 | 1 | 0 | 0 | 0 | AUDCAD |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP | current_forced_flip_close | reset_14 | 14 | 30.26718 | 0 | 1 | 0 | 0 | 0 | AUDCAD |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP | current_forced_flip_close | reset_15 | 10 | 21.570871 | 0 | 1 | 0 | 0 | 0 | AUDCAD |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP | current_forced_flip_close | reset_16 | 5 | 28.598295 | 0 | 1 | 0 | 0 | 0 | AUDCAD |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP | current_forced_flip_close | reset_17 | 3 | 14.394407 | 0 | 1 | 0 | 0 | 0 | AUDCAD |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP | current_forced_flip_close | reset_18 | 1 | 1.615575 | 0 | 1 | 0 | 0 | 0 | AUDCHF |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP | current_forced_flip_close | reset_19 | 1 | 14.494172 | 0 | 1 | 0 | 0 | 0 | AUDCHF |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_2_PAIR_RESETS_WEEK | current_forced_flip_close | initial_cycle | 7866 | 4485.511869 | -115.469376 | 0.991475 | -357.793296 | -2235.501402 | -115.469376 | AUDCAD |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_2_PAIR_RESETS_WEEK | current_forced_flip_close | terminal_after_reset_2 | 7685 | 6557.212511 | 0 | 1 | 0 | 0 | 0 | AUDCAD |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_2_PAIR_RESETS_WEEK | current_forced_flip_close | reset_1 | 905 | -523.940299 | -265.767147 | 0.902331 | -265.786521 | -1554.078124 | -265.767147 | AUDNZD |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | current_forced_flip_close | initial_cycle | 6489 | 3572.422303 | -96.517326 | 0.991054 | -357.793296 | -1979.807567 | -96.517326 | AUDCAD |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | current_forced_flip_close | reset_1 | 8201 | 5606.675393 | -119.13396 | 0.9889 | -265.786521 | -1605.624211 | -119.13396 | AUDNZD |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | current_forced_flip_close | terminal_after_reset_3 | 6165 | 5272.805365 | 0 | 1 | 0 | 0 | 0 | AUDCAD |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | current_forced_flip_close | reset_2 | 1127 | -429.955528 | -2092.568746 | 0.894034 | -129.307259 | -1546.840617 | -2092.632803 | AUDNZD |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | current_forced_flip_close | initial_cycle | 5491 | 4530.536414 | -119.230587 | 0.987603 | -281.416422 | -1614.410539 | -119.230587 | AUDCHF |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | current_forced_flip_close | reset_1 | 7765 | 6400.552898 | -2170.871112 | 0.984021 | -621.509684 | -2420.484784 | -2171.096516 | AUDNZD |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | current_forced_flip_close | terminal_after_reset_3 | 5070 | 5698.938595 | 0 | 1 | 0 | 0 | 0 | AUDCAD |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | current_forced_flip_close | reset_2 | 1462 | -505.943632 | -60.982812 | 0.895461 | -224.20159 | -2262.387166 | -60.982812 | USDCAD |
| PAIR_TWO_SIDED_GRID_T125_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | current_forced_flip_close | initial_cycle | 4595 | 4621.33003 | -119.230587 | 0.982567 | -281.416422 | -1735.371516 | -119.230587 | AUDCHF |
| PAIR_TWO_SIDED_GRID_T125_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | current_forced_flip_close | reset_1 | 7348 | 7370.565456 | -875.410535 | 0.977257 | -628.671368 | -2907.093022 | -876.594087 | AUDJPY |
| PAIR_TWO_SIDED_GRID_T125_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | current_forced_flip_close | terminal_after_reset_3 | 4077 | 5679.357619 | 0 | 1 | 0 | 0 | 0 | AUDCAD |
| PAIR_TWO_SIDED_GRID_T125_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | current_forced_flip_close | reset_2 | 1716 | -185.789436 | -3472.659113 | 0.902582 | -341.176551 | -2603.509293 | -3473.348238 | AUDNZD |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_LOSER_WAREHOUSE | warehouse_losing_flip_no_new_fills | initial_cycle | 5491 | 4566.632715 | -119.230587 | 0.991796 | -280.959535 | 0 | -119.230587 | AUDCHF |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_LOSER_WAREHOUSE | warehouse_losing_flip_no_new_fills | reset_1 | 7765 | 6445.293548 | -2170.871112 | 0.992526 | -631.409219 | 0 | -2171.096516 | AUDNZD |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_LOSER_WAREHOUSE | warehouse_losing_flip_no_new_fills | terminal_after_reset_3 | 5070 | 5698.938595 | 0 | 1 | 0 | 0 | 0 | AUDCAD |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_LOSER_WAREHOUSE | warehouse_losing_flip_no_new_fills | reset_2 | 1462 | -517.211165 | -60.982812 | 0.955983 | -223.680913 | 0 | -60.982812 | USDCAD |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_GRACE_1W | grace_window_losing_flip_no_new_fills | initial_cycle | 5491 | 4811.416261 | -119.230587 | 0.993801 | -316.673731 | 0 | -119.230587 | AUDCHF |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_GRACE_1W | grace_window_losing_flip_no_new_fills | reset_1 | 7765 | 7056.647432 | -2170.871112 | 0.99317 | -216.249393 | 0 | -2171.096516 | AUDNZD |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_GRACE_1W | grace_window_losing_flip_no_new_fills | terminal_after_reset_3 | 5070 | 5698.938595 | 0 | 1 | 0 | 0 | 0 | AUDCAD |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_GRACE_1W | grace_window_losing_flip_no_new_fills | reset_2 | 1462 | -1055.394427 | -60.982812 | 0.958047 | -411.29657 | 0 | -60.982812 | AUDUSD |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_CLOSE_SMALL_LOSS_WAREHOUSE_GT3ADR | close_small_loss_warehouse_large_loss | initial_cycle | 5491 | 4552.041273 | -119.230587 | 0.990155 | -280.959535 | -13.767742 | -119.230587 | AUDCHF |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_CLOSE_SMALL_LOSS_WAREHOUSE_GT3ADR | close_small_loss_warehouse_large_loss | reset_1 | 7765 | 6413.840283 | -2170.871112 | 0.987758 | -631.409219 | -43.921253 | -2171.096516 | AUDNZD |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_CLOSE_SMALL_LOSS_WAREHOUSE_GT3ADR | close_small_loss_warehouse_large_loss | terminal_after_reset_3 | 5070 | 5698.938595 | 0 | 1 | 0 | 0 | 0 | AUDCAD |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_CLOSE_SMALL_LOSS_WAREHOUSE_GT3ADR | close_small_loss_warehouse_large_loss | reset_2 | 1462 | -535.862423 | -60.982812 | 0.908528 | -223.680913 | -80.541162 | -60.982812 | USDCAD |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__NO_FLIP_FORCE_DIAGNOSTIC | no_flip_force_no_new_fills | initial_cycle | 5491 | 6177.855544 | -1109.242018 | 1 | 0 | 0 | -1109.242018 | AUDCHF |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__NO_FLIP_FORCE_DIAGNOSTIC | no_flip_force_no_new_fills | reset_1 | 7765 | 8854.438676 | -6050.352574 | 1 | 0 | 0 | -6050.577978 | AUDNZD |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__NO_FLIP_FORCE_DIAGNOSTIC | no_flip_force_no_new_fills | terminal_after_reset_3 | 5070 | 5698.938595 | 0 | 1 | 0 | 0 | 0 | AUDCAD |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__NO_FLIP_FORCE_DIAGNOSTIC | no_flip_force_no_new_fills | reset_2 | 1462 | 1798.42293 | -549.133875 | 1 | 0 | 0 | -549.133875 | USDCAD |
| FULLY_HEDGED_LONG_SHORT_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE | current_forced_flip_close | initial_cycle | 20888 | 21061.215861 | -21011.006797 | 1 | 0 | 0 | -21017.297138 | EURUSD |
| FULLY_HEDGED_LONG_SHORT_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE | current_forced_flip_close | reset_1 | 19160 | 18366.281386 | -18144.28662 | 1 | 0 | 0 | -18237.066188 | NZDJPY |
| FULLY_HEDGED_LONG_SHORT_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE | current_forced_flip_close | terminal_after_reset_3 | 12909 | 14443.456898 | 0 | 1 | 0 | 0 | 0 | AUDCAD |
| FULLY_HEDGED_LONG_SHORT_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE | current_forced_flip_close | reset_2 | 3519 | 0 | -14162.011929 | 0 | 0 | 0 | -14349.256778 | USDCHF |

| rule_id | flip_policy | age_bucket | event_count | open_loss_adr | realized_loss_adr | flip_loss_adr | recovery_rate | average_time_to_recovery_hours | worst_pair | worst_currency |
|---|---|---|---|---|---|---|---|---|---|---|
| CARRY_UNTIL_FLIP | current_forced_flip_close | 1_2_weeks | 128 | -0.266919 | -92.333093 | -92.333093 | 0 |  | USDCHF | USD |
| CARRY_UNTIL_FLIP | current_forced_flip_close | 9_13_weeks | 84 | -1.827368 | -79.487934 | -79.487934 | 0 |  | GBPJPY | GBP |
| CARRY_UNTIL_FLIP | current_forced_flip_close | 13_plus_weeks | 205 | -106.968507 | -424.38828 | -424.38828 | 0 |  | AUDNZD | JPY |
| CARRY_UNTIL_FLIP | current_forced_flip_close | 3_4_weeks | 139 | -2.057177 | -97.1781 | -97.1781 | 0 |  | NZDUSD | USD |
| CARRY_UNTIL_FLIP | current_forced_flip_close | 5_8_weeks | 125 | -5.84582 | -114.415424 | -114.415424 | 0 |  | USDJPY | USD |
| CARRY_UNTIL_FLIP | current_forced_flip_close | same_week | 249 | 0 | -155.633897 | -155.633897 | 0 |  | EURAUD | AUD |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP | current_forced_flip_close | same_week | 27692 | -24.130746 | -2580.116603 | -2580.116603 | 0.971878 | 21.05 | EURAUD | AUD |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP | current_forced_flip_close | 1_2_weeks | 979 | -106.671015 | -1394.956092 | -1394.956092 | 0.914198 | 210.183333 | USDCAD | USD |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP | current_forced_flip_close | 3_4_weeks | 330 | -33.471982 | -1007.72799 | -1007.72799 | 0.9 | 451.733333 | GBPCHF | GBP |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP | current_forced_flip_close | 5_8_weeks | 143 | -111.833923 | -1470.581865 | -1470.581865 | 0.853147 | 860.575 | USDCAD | USD |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP | current_forced_flip_close | 13_plus_weeks | 36 | -4180.217386 | -3404.205026 | -3404.205026 | 0.694444 | 3277.283333 | AUDNZD | AUD |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP | current_forced_flip_close | 9_13_weeks | 50 | -24.810429 | -958.36341 | -958.36341 | 0.9 | 1686.016667 | AUDCAD | AUD |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP | current_forced_flip_close | same_week | 17653 | -20.837184 | -3070.308829 | -3070.308829 | 0.958502 | 25.441667 | EURAUD | AUD |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP | current_forced_flip_close | 1_2_weeks | 1222 | -137.305544 | -1749.431327 | -1749.431327 | 0.917349 | 214.666667 | USDCAD | USD |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP | current_forced_flip_close | 3_4_weeks | 457 | -5.404647 | -1888.539932 | -1888.539932 | 0.875274 | 438.208334 | NZDUSD | GBP |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP | current_forced_flip_close | 5_8_weeks | 193 | -177.670398 | -1985.533686 | -1985.533686 | 0.84456 | 864.416667 | USDCAD | USD |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP | current_forced_flip_close | 13_plus_weeks | 44 | -5336.344379 | -4939.113262 | -4939.113262 | 0.704545 | 3173.966667 | AUDNZD | AUD |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP | current_forced_flip_close | 9_13_weeks | 64 | -40.686086 | -1035.888222 | -1035.888222 | 0.875 | 1759.758334 | AUDCAD | AUD |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_2_PAIR_RESETS_WEEK | current_forced_flip_close | same_week | 15571 | -94.388069 | -979.235144 | -979.235144 | 0.99211 | 15.4 | NZDJPY | NZD |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_2_PAIR_RESETS_WEEK | current_forced_flip_close | 1_2_weeks | 558 | -3.606858 | -697.008228 | -697.008228 | 0.953405 | 205.241667 | GBPCAD | GBP |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_2_PAIR_RESETS_WEEK | current_forced_flip_close | 3_4_weeks | 193 | -54.10093 | -563.930505 | -563.930505 | 0.88601 | 413.35 | AUDNZD | NZD |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_2_PAIR_RESETS_WEEK | current_forced_flip_close | 5_8_weeks | 85 | -82.507479 | -893.849738 | -893.849738 | 0.882353 | 881.216667 | AUDCAD | CAD |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_2_PAIR_RESETS_WEEK | current_forced_flip_close | 13_plus_weeks | 18 | -146.633187 | -547.202943 | -547.202943 | 0.833333 | 3743.8 | AUDNZD | AUD |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_2_PAIR_RESETS_WEEK | current_forced_flip_close | 9_13_weeks | 31 | 0 | -108.352968 | -108.352968 | 0.967742 | 1736.466667 | AUDUSD | AUD |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | current_forced_flip_close | same_week | 20803 | -75.617638 | -1468.688205 | -1468.688205 | 0.988404 | 15.416667 | GBPUSD | USD |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | current_forced_flip_close | 5_8_weeks | 115 | -82.507479 | -1198.768118 | -1198.768118 | 0.869565 | 885.15 | AUDCAD | CAD |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | current_forced_flip_close | 1_2_weeks | 745 | -22.507867 | -1122.781762 | -1122.781762 | 0.938255 | 204.583333 | GBPCAD | CAD |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | current_forced_flip_close | 3_4_weeks | 262 | -54.10093 | -686.478399 | -686.478399 | 0.908397 | 416.05 | GBPJPY | NZD |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | current_forced_flip_close | 13_plus_weeks | 22 | -2073.550175 | -547.202943 | -547.202943 | 0.863636 | 3743.8 | AUDNZD | AUD |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | current_forced_flip_close | 9_13_weeks | 35 | 0 | -108.352968 | -108.352968 | 0.971429 | 1697.783333 | AUDUSD | AUD |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | current_forced_flip_close | same_week | 18347 | -85.284191 | -1684.276876 | -1684.276876 | 0.98273 | 20.516667 | GBPUSD | USD |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | current_forced_flip_close | 5_8_weeks | 138 | -84.176156 | -1197.225007 | -1197.225007 | 0.876812 | 881.066667 | USDCAD | USD |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | current_forced_flip_close | 1_2_weeks | 894 | -23.759667 | -1083.381682 | -1083.381682 | 0.939597 | 204.6 | USDCAD | USD |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | current_forced_flip_close | 3_4_weeks | 345 | -49.400878 | -1061.382432 | -1061.382432 | 0.901449 | 419.816667 | GBPJPY | GBP |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | current_forced_flip_close | 9_13_weeks | 43 | -35.619723 | -729.862652 | -729.862652 | 0.906977 | 1748.366667 | AUDCAD | AUD |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | current_forced_flip_close | 13_plus_weeks | 21 | -2073.0693 | -541.15384 | -541.15384 | 0.857143 | 3776.325 | AUDNZD | AUD |
| PAIR_TWO_SIDED_GRID_T125_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | current_forced_flip_close | same_week | 16084 | -84.566249 | -1943.790473 | -1943.790473 | 0.975487 | 24.266667 | GBPUSD | USD |
| PAIR_TWO_SIDED_GRID_T125_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | current_forced_flip_close | 1_2_weeks | 1048 | -24.019263 | -1149.628505 | -1149.628505 | 0.938931 | 205.116667 | NZDUSD | USD |
| PAIR_TWO_SIDED_GRID_T125_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | current_forced_flip_close | 5_8_weeks | 155 | -81.529317 | -1473.515242 | -1473.515242 | 0.864516 | 875.525 | USDCAD | USD |
| PAIR_TWO_SIDED_GRID_T125_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | current_forced_flip_close | 3_4_weeks | 374 | -49.295001 | -1051.074017 | -1051.074017 | 0.903743 | 431.441667 | GBPJPY | CAD |
| PAIR_TWO_SIDED_GRID_T125_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | current_forced_flip_close | 9_13_weeks | 47 | -24.810429 | -745.635203 | -745.635203 | 0.914894 | 1691.95 | AUDCAD | AUD |
| PAIR_TWO_SIDED_GRID_T125_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | current_forced_flip_close | 13_plus_weeks | 28 | -4204.952653 | -882.330391 | -882.330391 | 0.785714 | 3463.083333 | AUDNZD | AUD |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_LOSER_WAREHOUSE | warehouse_losing_flip_no_new_fills | same_week | 18246 | -85.284191 | -898.596988 | 0 | 0.994098 | 20.725 | GBPUSD | USD |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_LOSER_WAREHOUSE | warehouse_losing_flip_no_new_fills | 1_2_weeks | 967 | -23.759667 | -1375.968406 | 0 | 0.926577 | 204.408334 | NZDUSD | USD |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_LOSER_WAREHOUSE | warehouse_losing_flip_no_new_fills | 5_8_weeks | 142 | -84.176156 | -1271.639439 | 0 | 0.887324 | 874.133333 | USDCAD | USD |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_LOSER_WAREHOUSE | warehouse_losing_flip_no_new_fills | 3_4_weeks | 365 | -49.400878 | -1392.98497 | 0 | 0.882192 | 420.333334 | GBPJPY | GBP |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_LOSER_WAREHOUSE | warehouse_losing_flip_no_new_fills | 9_13_weeks | 46 | -35.619723 | -753.312093 | 0 | 0.891304 | 1740.166667 | AUDCAD | AUD |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_LOSER_WAREHOUSE | warehouse_losing_flip_no_new_fills | 13_plus_weeks | 22 | -2073.0693 | -555.388903 | 0 | 0.818182 | 3776.325 | AUDNZD | AUD |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_GRACE_1W | grace_window_losing_flip_no_new_fills | same_week | 18207 | -85.284191 | 0 | 0 | 0.996282 | 20.725 | GBPNZD | NZD |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_GRACE_1W | grace_window_losing_flip_no_new_fills | 1_2_weeks | 989 | -23.759667 | -1801.499897 | 0 | 0.918099 | 204.308333 | GBPUSD | USD |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_GRACE_1W | grace_window_losing_flip_no_new_fills | 5_8_weeks | 144 | -84.176156 | -1247.780162 | 0 | 0.875 | 877.925 | AUDUSD | USD |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_GRACE_1W | grace_window_losing_flip_no_new_fills | 3_4_weeks | 382 | -49.400878 | -2018.650145 | 0 | 0.863874 | 419.416667 | USDCAD | GBP |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_GRACE_1W | grace_window_losing_flip_no_new_fills | 9_13_weeks | 45 | -35.619723 | -348.222393 | 0 | 0.888889 | 1744.266667 | NZDUSD | NZD |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_GRACE_1W | grace_window_losing_flip_no_new_fills | 13_plus_weeks | 21 | -2073.0693 | -532.923124 | 0 | 0.857143 | 3776.325 | AUDNZD | AUD |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_CLOSE_SMALL_LOSS_WAREHOUSE_GT3ADR | close_small_loss_warehouse_large_loss | same_week | 18275 | -85.284191 | -1019.486209 | -135.979684 | 0.987654 | 20.558334 | GBPUSD | USD |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_CLOSE_SMALL_LOSS_WAREHOUSE_GT3ADR | close_small_loss_warehouse_large_loss | 1_2_weeks | 949 | -23.759667 | -1346.575428 | -0.729647 | 0.925184 | 204.408334 | NZDUSD | USD |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_CLOSE_SMALL_LOSS_WAREHOUSE_GT3ADR | close_small_loss_warehouse_large_loss | 5_8_weeks | 139 | -84.176156 | -1271.779643 | -0.140204 | 0.877698 | 877.925 | USDCAD | USD |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_CLOSE_SMALL_LOSS_WAREHOUSE_GT3ADR | close_small_loss_warehouse_large_loss | 3_4_weeks | 359 | -49.400878 | -1364.215389 | -1.380622 | 0.880223 | 421.991667 | GBPJPY | GBP |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_CLOSE_SMALL_LOSS_WAREHOUSE_GT3ADR | close_small_loss_warehouse_large_loss | 9_13_weeks | 45 | -35.619723 | -753.312093 | 0 | 0.888889 | 1744.266667 | AUDCAD | AUD |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_CLOSE_SMALL_LOSS_WAREHOUSE_GT3ADR | close_small_loss_warehouse_large_loss | 13_plus_weeks | 21 | -2073.0693 | -548.867467 | 0 | 0.857143 | 3776.325 | AUDNZD | AUD |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__NO_FLIP_FORCE_DIAGNOSTIC | no_flip_force_no_new_fills | same_week | 18207 | -85.284191 | 0 | 0 | 0.996282 | 20.725 | GBPNZD | NZD |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__NO_FLIP_FORCE_DIAGNOSTIC | no_flip_force_no_new_fills | 1_2_weeks | 926 | -23.759667 | 0 | 0 | 0.99568 | 204.641667 | GBPCHF | GBP |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__NO_FLIP_FORCE_DIAGNOSTIC | no_flip_force_no_new_fills | 5_8_weeks | 163 | -84.176156 | 0 | 0 | 0.993865 | 887.85 | USDCAD | USD |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__NO_FLIP_FORCE_DIAGNOSTIC | no_flip_force_no_new_fills | 3_4_weeks | 367 | -49.400878 | 0 | 0 | 0.991826 | 424.5 | EURUSD | USD |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__NO_FLIP_FORCE_DIAGNOSTIC | no_flip_force_no_new_fills | 9_13_weeks | 55 | -35.619723 | 0 | 0 | 0.963636 | 1740.166667 | EURAUD | AUD |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__NO_FLIP_FORCE_DIAGNOSTIC | no_flip_force_no_new_fills | 13_plus_weeks | 70 | -7430.713256 | 0 | 0 | 0.8 | 3933.591667 | AUDNZD | AUD |
| FULLY_HEDGED_LONG_SHORT_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE | current_forced_flip_close | same_week | 56476 | -53603.620104 | 0 | 0 | 0.856204 | 18.95 | NZDJPY | JPY |
| FULLY_HEDGED_LONG_SHORT_28_PAIR_WEEKLY_T100_S020_NO_LIMIT_REFERENCE | current_forced_flip_close | same_week | 95060 | -85754.722864 | 0 | 0 | 0.777986 | 15.5 | NZDJPY | JPY |
| LONG_ONLY_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE | current_forced_flip_close | same_week | 28406 | -26768.4942 | 0 | 0 | 0.861668 | 18.783333 | USDCHF | USD |
| SHORT_ONLY_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE | current_forced_flip_close | same_week | 28070 | -26835.125904 | 0 | 0 | 0.850669 | 19.158333 | CHFJPY | JPY |
| DETERMINISTIC_RANDOM_SIDE_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE | current_forced_flip_close | same_week | 28190 | -26569.27695 | 0 | 0 | 0.856588 | 19.016667 | AUDJPY | JPY |

## Decision Table

| rule_id | rule_family | flip_policy | harvest_engine_promising | flip_logic_is_main_defect | open_tail_defect_unresolved | closed_pnl_illusion | return_too_weak | candidate_worth_further_research | reject |
|---|---|---|---|---|---|---|---|---|---|
| WEEKLY_FORCED_CLOSE | control | current_forced_flip_close | false | false | false | false | true | false | false |
| CARRY_UNTIL_FLIP | control | current_forced_flip_close | false | false | false | false | true | false | false |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP | adverse_only_pair_net_grid | current_forced_flip_close | true | true | true | true | true | false | true |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP | pair_directional_two_sided_grid | current_forced_flip_close | true | true | true | true | true | false | true |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_2_PAIR_RESETS_WEEK | pair_reset_limit | current_forced_flip_close | false | false | false | false | true | false | false |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | pair_reset_limit | current_forced_flip_close | true | true | true | true | true | false | true |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | pair_reset_limit | current_forced_flip_close | true | true | true | true | true | true | false |
| PAIR_TWO_SIDED_GRID_T125_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | pair_reset_limit | current_forced_flip_close | true | true | true | true | true | false | true |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_LOSER_WAREHOUSE | flip_counterfactual | warehouse_losing_flip_no_new_fills | true | false | true | true | true | true | false |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_GRACE_1W | flip_counterfactual | grace_window_losing_flip_no_new_fills | true | false | true | true | true | true | false |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_CLOSE_SMALL_LOSS_WAREHOUSE_GT3ADR | flip_counterfactual | close_small_loss_warehouse_large_loss | true | false | true | true | true | true | false |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__NO_FLIP_FORCE_DIAGNOSTIC | flip_counterfactual | no_flip_force_no_new_fills | true | false | true | true | true | true | false |
| FULLY_HEDGED_LONG_SHORT_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE | fully_hedged_reference | current_forced_flip_close | true | false | false | false | true | false | false |
| FULLY_HEDGED_LONG_SHORT_28_PAIR_WEEKLY_T100_S020_NO_LIMIT_REFERENCE | fully_hedged_reference | current_forced_flip_close | true | false | false | false | false | false | false |
| LONG_ONLY_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE | all_pairs_direction_reference | current_forced_flip_close | true | false | false | false | true | false | false |
| SHORT_ONLY_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE | all_pairs_direction_reference | current_forced_flip_close | true | false | false | false | true | false | false |
| DETERMINISTIC_RANDOM_SIDE_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE | all_pairs_direction_reference | current_forced_flip_close | true | false | false | false | true | false | false |

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
  "expected_fixed_rule_count": 17,
  "required_baseline_rows_present": true,
  "t150_no_limit_reference_included": true,
  "flip_counterfactual_row_count": 4,
  "expected_flip_counterfactual_row_count": 4,
  "fully_hedged_reference_included": true,
  "fully_hedged_reference_is_reference_only": true,
  "fully_hedged_no_limit_reference_included": true,
  "long_only_reference_included": true,
  "short_only_reference_included": true,
  "deterministic_random_side_reference_included": true,
  "account_reset_target_count": 0,
  "account_level_emergency_sl_replay_started": false,
  "pair_series_only_account_reset_claim_started": false,
  "unbounded_parameter_search_started": false,
  "costs_applied": false,
  "preliminary_cost_sensitivity_only": true,
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
  "closed_and_equity_reported_side_by_side": true,
  "csv_scorecards_written": true,
  "close_reason_breakdown_written": true,
  "reset_ordinal_breakdown_written": true,
  "age_bucket_breakdown_written": true,
  "audnzd_sentinel_written": true,
  "hedged_edge_diagnostic_written": true,
  "raw_comparison_written": true,
  "normalized_comparison_written": true,
  "cost_sensitivity_written": true,
  "exposure_margin_proxy_written": true,
  "equity_smoothness_written": true,
  "edge_attribution_written": true,
  "implementation_validity_written": true
}
```

## Artifacts

- scorecardRowsJson: `docs/research/gates/gate80/artifacts/gate80-fully-hedged-baseline-validity-normalization-edge-attribution/gate80-scorecard.rows.json`
- scorecardRowsCsv: `docs/research/gates/gate80/artifacts/gate80-fully-hedged-baseline-validity-normalization-edge-attribution/gate80-scorecard.rows.csv`
- rawComparisonRowsJson: `docs/research/gates/gate80/artifacts/gate80-fully-hedged-baseline-validity-normalization-edge-attribution/raw-comparison.rows.json`
- rawComparisonRowsCsv: `docs/research/gates/gate80/artifacts/gate80-fully-hedged-baseline-validity-normalization-edge-attribution/raw-comparison.rows.csv`
- normalizedComparisonRowsJson: `docs/research/gates/gate80/artifacts/gate80-fully-hedged-baseline-validity-normalization-edge-attribution/normalized-comparison.rows.json`
- normalizedComparisonRowsCsv: `docs/research/gates/gate80/artifacts/gate80-fully-hedged-baseline-validity-normalization-edge-attribution/normalized-comparison.rows.csv`
- costSensitivityRowsJson: `docs/research/gates/gate80/artifacts/gate80-fully-hedged-baseline-validity-normalization-edge-attribution/cost-sensitivity.rows.json`
- costSensitivityRowsCsv: `docs/research/gates/gate80/artifacts/gate80-fully-hedged-baseline-validity-normalization-edge-attribution/cost-sensitivity.rows.csv`
- exposureMarginProxyRowsJson: `docs/research/gates/gate80/artifacts/gate80-fully-hedged-baseline-validity-normalization-edge-attribution/exposure-margin-proxy.rows.json`
- exposureMarginProxyRowsCsv: `docs/research/gates/gate80/artifacts/gate80-fully-hedged-baseline-validity-normalization-edge-attribution/exposure-margin-proxy.rows.csv`
- equitySmoothnessRowsJson: `docs/research/gates/gate80/artifacts/gate80-fully-hedged-baseline-validity-normalization-edge-attribution/equity-smoothness.rows.json`
- equitySmoothnessRowsCsv: `docs/research/gates/gate80/artifacts/gate80-fully-hedged-baseline-validity-normalization-edge-attribution/equity-smoothness.rows.csv`
- edgeAttributionRowsJson: `docs/research/gates/gate80/artifacts/gate80-fully-hedged-baseline-validity-normalization-edge-attribution/edge-attribution.rows.json`
- edgeAttributionRowsCsv: `docs/research/gates/gate80/artifacts/gate80-fully-hedged-baseline-validity-normalization-edge-attribution/edge-attribution.rows.csv`
- implementationValidityRowsJson: `docs/research/gates/gate80/artifacts/gate80-fully-hedged-baseline-validity-normalization-edge-attribution/implementation-validity.rows.json`
- implementationValidityRowsCsv: `docs/research/gates/gate80/artifacts/gate80-fully-hedged-baseline-validity-normalization-edge-attribution/implementation-validity.rows.csv`
- weeklyEquityRowsJson: `docs/research/gates/gate80/artifacts/gate80-fully-hedged-baseline-validity-normalization-edge-attribution/weekly-equity-truth.rows.json`
- weeklyEquityRowsCsv: `docs/research/gates/gate80/artifacts/gate80-fully-hedged-baseline-validity-normalization-edge-attribution/weekly-equity-truth.rows.csv`
- annualRowsJson: `docs/research/gates/gate80/artifacts/gate80-fully-hedged-baseline-validity-normalization-edge-attribution/annual-summary.rows.json`
- annualRowsCsv: `docs/research/gates/gate80/artifacts/gate80-fully-hedged-baseline-validity-normalization-edge-attribution/annual-summary.rows.csv`
- closeReasonRowsJson: `docs/research/gates/gate80/artifacts/gate80-fully-hedged-baseline-validity-normalization-edge-attribution/close-reason-breakdown.rows.json`
- closeReasonRowsCsv: `docs/research/gates/gate80/artifacts/gate80-fully-hedged-baseline-validity-normalization-edge-attribution/close-reason-breakdown.rows.csv`
- flipAnatomyRowsJson: `docs/research/gates/gate80/artifacts/gate80-fully-hedged-baseline-validity-normalization-edge-attribution/flip-loss-anatomy.rows.json`
- flipAnatomyRowsCsv: `docs/research/gates/gate80/artifacts/gate80-fully-hedged-baseline-validity-normalization-edge-attribution/flip-loss-anatomy.rows.csv`
- resetOrdinalRowsJson: `docs/research/gates/gate80/artifacts/gate80-fully-hedged-baseline-validity-normalization-edge-attribution/reset-ordinal-breakdown.rows.json`
- resetOrdinalRowsCsv: `docs/research/gates/gate80/artifacts/gate80-fully-hedged-baseline-validity-normalization-edge-attribution/reset-ordinal-breakdown.rows.csv`
- ageBucketRowsJson: `docs/research/gates/gate80/artifacts/gate80-fully-hedged-baseline-validity-normalization-edge-attribution/age-bucket-breakdown.rows.json`
- ageBucketRowsCsv: `docs/research/gates/gate80/artifacts/gate80-fully-hedged-baseline-validity-normalization-edge-attribution/age-bucket-breakdown.rows.csv`
- pairAttributionRowsJson: `docs/research/gates/gate80/artifacts/gate80-fully-hedged-baseline-validity-normalization-edge-attribution/pair-tail-attribution.rows.json`
- pairAttributionRowsCsv: `docs/research/gates/gate80/artifacts/gate80-fully-hedged-baseline-validity-normalization-edge-attribution/pair-tail-attribution.rows.csv`
- currencyAttributionRowsJson: `docs/research/gates/gate80/artifacts/gate80-fully-hedged-baseline-validity-normalization-edge-attribution/currency-tail-attribution.rows.json`
- currencyAttributionRowsCsv: `docs/research/gates/gate80/artifacts/gate80-fully-hedged-baseline-validity-normalization-edge-attribution/currency-tail-attribution.rows.csv`
- audnzdSentinelRowsJson: `docs/research/gates/gate80/artifacts/gate80-fully-hedged-baseline-validity-normalization-edge-attribution/audnzd-sentinel.rows.json`
- audnzdSentinelRowsCsv: `docs/research/gates/gate80/artifacts/gate80-fully-hedged-baseline-validity-normalization-edge-attribution/audnzd-sentinel.rows.csv`
- counterfactualRowsJson: `docs/research/gates/gate80/artifacts/gate80-fully-hedged-baseline-validity-normalization-edge-attribution/flip-policy-counterfactual.rows.json`
- counterfactualRowsCsv: `docs/research/gates/gate80/artifacts/gate80-fully-hedged-baseline-validity-normalization-edge-attribution/flip-policy-counterfactual.rows.csv`
- fullyHedgedBenchmarkRowsJson: `docs/research/gates/gate80/artifacts/gate80-fully-hedged-baseline-validity-normalization-edge-attribution/fully-hedged-benchmark.rows.json`
- fullyHedgedBenchmarkRowsCsv: `docs/research/gates/gate80/artifacts/gate80-fully-hedged-baseline-validity-normalization-edge-attribution/fully-hedged-benchmark.rows.csv`
- returnTargetGapRowsJson: `docs/research/gates/gate80/artifacts/gate80-fully-hedged-baseline-validity-normalization-edge-attribution/return-target-gap.rows.json`
- returnTargetGapRowsCsv: `docs/research/gates/gate80/artifacts/gate80-fully-hedged-baseline-validity-normalization-edge-attribution/return-target-gap.rows.csv`
- decisionRowsJson: `docs/research/gates/gate80/artifacts/gate80-fully-hedged-baseline-validity-normalization-edge-attribution/final-decision-table.rows.json`
- decisionRowsCsv: `docs/research/gates/gate80/artifacts/gate80-fully-hedged-baseline-validity-normalization-edge-attribution/final-decision-table.rows.csv`
- directAnswerRowsJson: `docs/research/gates/gate80/artifacts/gate80-fully-hedged-baseline-validity-normalization-edge-attribution/direct-answers.rows.json`
- directAnswerRowsCsv: `docs/research/gates/gate80/artifacts/gate80-fully-hedged-baseline-validity-normalization-edge-attribution/direct-answers.rows.csv`
- commandReceipt: `docs/research/gates/gate80/artifacts/gate80-fully-hedged-baseline-validity-normalization-edge-attribution/command-receipt.json`
- summaryJson: `docs/research/gates/gate80/artifacts/gate80-fully-hedged-baseline-validity-normalization-edge-attribution/gate80-summary.json`
- shaIdentity: `docs/research/gates/gate80/artifacts/gate80-fully-hedged-baseline-validity-normalization-edge-attribution/gate80-sha256.txt`
- report: `docs/research/gates/gate80/GATE80_FULLY_HEDGED_BASELINE_VALIDITY_NORMALIZATION_EDGE_ATTRIBUTION_2026-06-30.md`

## Stop Line

Gate 80 is baseline-validity evidence only. No promotion, no freeze, no Candidate B mutation, no pair exclusion, no AUDNZD exclusion, no fair-value pruning, no risk layer, no MT5/live/app/runtime, and no broker-cost claim unless Freedom explicitly opens the next scope.
