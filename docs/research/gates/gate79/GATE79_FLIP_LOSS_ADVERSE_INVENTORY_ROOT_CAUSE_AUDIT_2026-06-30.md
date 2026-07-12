# Gate 79 Flip-Loss and Adverse Inventory Root-Cause Audit

Generated: `2026-06-30T16:11:16.986Z`

## Verdict

`FAIL_LIMITED_REENTRY_FAMILY_TOO_WEAK_FOR_TARGET_NO_PROMOTION`

## Scope

- Forensic replay audit of required baselines, fixed flip-policy counterfactuals, and a fully hedged weekly long-short diagnostic reference.
- Uses the Gate 74B trade-leg path warehouse; Candidate B directions remain read-only.
- The fully hedged row is a gross reference only: both long and short on all 28 pairs each week using T100/S020/L3, week-bounded.
- Does not run costs, risk/correlation pruning, pair/date exclusions, AUDNZD exclusion, source mutation, Brain mutation, MT5/live/app/runtime, freeze, or promotion.

## MTM Scorecard

| rule_id | family | flip_policy | reference_only | closed | equity | eq_pf | closed_pf | dd | open | worst_open | worst1 | worst5 | worst13 | mtm_weekly_win_rate | closed_weekly_win_rate | mtm_monthly_win_rate | flip_loss | warehouse_recovery_rate | fills | adverse | expansion |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| WEEKLY_FORCED_CLOSE | control | current_forced_flip_close | false | 638.115405 | 638.115405 | 1.414187 | 1.414187 | -116.795157 | 0 | 0 | -31.994789 | -55.237608 | -91.084942 | 0.520107 | 0.520107 | 0.593023 | 0 |  | 10444 | 0 | 0 |
| CARRY_UNTIL_FLIP | control | current_forced_flip_close | false | 694.688146 | 597.519846 | 1.349786 | 2.198218 | -167.030217 | -97.1683 | -139.631661 | -36.95747 | -61.267983 | -93.469827 | 0.509383 | 0.49866 | 0.593023 | -963.436728 |  | 902 | 0 | 0 |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP | adverse_only_pair_net_grid | current_forced_flip_close | false | 14381.312614 | 9901.156008 | 1.254319 | 3.813599 | -5462.545131 | -4480.156606 | -5730.416295 | -1582.117861 | -2392.383436 | -3908.06394 | 0.533512 | 0.89008 | 0.662791 | -10815.950986 |  | 124689 | 95487 | 0 |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP | pair_directional_two_sided_grid | current_forced_flip_close | false | 18012.423714 | 12295.79489 | 1.282295 | 3.666998 | -7565.450203 | -5716.628824 | -7946.092545 | -1570.62905 | -3070.92484 | -4839.296978 | 0.544236 | 0.882038 | 0.639535 | -14668.815258 |  | 129588 | 79815 | 30168 |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_2_PAIR_RESETS_WEEK | pair_reset_limit | current_forced_flip_close | false | 10518.784081 | 10137.547558 | 1.619273 | 7.680391 | -1394.242003 | -381.236523 | -1850.992699 | -1029.767911 | -1219.040918 | -1308.382024 | 0.61126 | 0.914209 | 0.686047 | -3789.579526 |  | 80554 | 47416 | 16693 |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | pair_reset_limit | current_forced_flip_close | false | 14021.947533 | 11713.727501 | 1.51746 | 9.245321 | -1811.737115 | -2308.220032 | -2627.126459 | -1139.447341 | -1634.856483 | -1801.272614 | 0.613941 | 0.91689 | 0.709302 | -5132.272395 |  | 107731 | 63510 | 22252 |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | pair_reset_limit | current_forced_flip_close | false | 16124.084275 | 13772.999764 | 1.561828 | 8.468468 | -1989.442654 | -2351.084511 | -3001.945057 | -1151.146735 | -1623.435434 | -1989.442654 | 0.595174 | 0.919571 | 0.755814 | -6297.282489 |  | 106080 | 65843 | 20468 |
| PAIR_TWO_SIDED_GRID_T125_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | pair_reset_limit | current_forced_flip_close | false | 17485.463669 | 13018.163434 | 1.440649 | 8.353254 | -4074.085132 | -4467.300235 | -5032.162889 | -1333.160859 | -2305.981966 | -3299.95095 | 0.592493 | 0.91689 | 0.72093 | -7245.973831 |  | 110454 | 66112 | 26629 |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP__FLIP_LOSER_WAREHOUSE | flip_counterfactual | warehouse_losing_flip_no_new_fills | true | 14241.957938 | 9761.801332 | 1.249761 | 3.760658 | -5443.881128 | -4480.156606 | -5737.711289 | -1592.442571 | -2413.33377 | -3925.299997 | 0.530831 | 0.89008 | 0.662791 | 0 | 0.602273 | 124689 | 95487 | 0 |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP__FLIP_GRACE_1W | flip_counterfactual | grace_window_losing_flip_no_new_fills | true | 15402.382894 | 10922.226288 | 1.277327 | 3.951156 | -4806.489856 | -4480.156606 | -5730.416295 | -1582.446464 | -2387.850165 | -3799.612728 | 0.522788 | 0.89008 | 0.651163 | 0 | 0.644481 | 124689 | 95487 | 0 |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP__FLIP_CLOSE_SMALL_LOSS_WAREHOUSE_GT3ADR | flip_counterfactual | close_small_loss_warehouse_large_loss | true | 14213.006215 | 9732.849609 | 1.249211 | 3.775199 | -5458.791317 | -4480.156606 | -5730.416295 | -1582.117861 | -2399.501251 | -3916.80398 | 0.533512 | 0.89008 | 0.662791 | -310.995218 | 0.26 | 124689 | 95487 | 0 |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP__NO_FLIP_FORCE_DIAGNOSTIC | flip_counterfactual | no_flip_force_no_new_fills | true | 25311.038916 | 11775.065002 | 1.230054 |  | -7679.752157 | -13535.973914 | -13997.332027 | -1698.693063 | -2899.175092 | -4830.648047 | 0.541555 | 1 | 0.593023 | 0 | 0.949675 | 123988 | 94817 | 0 |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP__FLIP_LOSER_WAREHOUSE | flip_counterfactual | warehouse_losing_flip_no_new_fills | true | 17922.902902 | 12206.274078 | 1.279716 | 3.631337 | -7525.31001 | -5716.628824 | -7950.202064 | -1568.193563 | -3080.546462 | -4848.017532 | 0.536193 | 0.876676 | 0.662791 | 0 | 0.547865 | 129588 | 79815 | 30168 |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP__FLIP_GRACE_1W | flip_counterfactual | grace_window_losing_flip_no_new_fills | true | 19010.070114 | 13293.44129 | 1.301918 | 3.662866 | -6903.833997 | -5716.628824 | -7946.092545 | -1592.123643 | -2466.404513 | -4840.971676 | 0.530831 | 0.86059 | 0.627907 | 0 | 0.60972 | 129588 | 79815 | 30168 |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP__FLIP_CLOSE_SMALL_LOSS_WAREHOUSE_GT3ADR | flip_counterfactual | close_small_loss_warehouse_large_loss | true | 17919.428348 | 12202.799524 | 1.279612 | 3.633063 | -7545.276775 | -5716.628824 | -7946.092545 | -1570.336823 | -3091.123929 | -4851.199551 | 0.541555 | 0.871314 | 0.662791 | -307.477394 | 0.28392 | 129588 | 79815 | 30168 |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP__NO_FLIP_FORCE_DIAGNOSTIC | flip_counterfactual | no_flip_force_no_new_fills | true | 32835.922327 | 13803.155947 | 1.234492 |  | -10180.94506 | -19032.76638 | -19359.403024 | -1809.308731 | -3908.017117 | -5989.009087 | 0.517426 | 1 | 0.604651 | 0 | 0.942563 | 128551 | 78848 | 30137 |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_2_PAIR_RESETS_WEEK__FLIP_LOSER_WAREHOUSE | flip_counterfactual | warehouse_losing_flip_no_new_fills | true | 10507.437543 | 10126.20102 | 1.61575 | 7.721318 | -1386.121244 | -381.236523 | -1850.992699 | -1029.767911 | -1217.250752 | -1306.570008 | 0.61126 | 0.911528 | 0.686047 | 0 | 0.374194 | 80554 | 47416 | 16693 |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_2_PAIR_RESETS_WEEK__FLIP_GRACE_1W | flip_counterfactual | grace_window_losing_flip_no_new_fills | true | 11007.624246 | 10626.387723 | 1.641909 | 8.774193 | -1393.99832 | -381.236523 | -1850.992699 | -1029.767911 | -1217.250752 | -1311.794791 | 0.600536 | 0.906166 | 0.709302 | 0 | 0.464516 | 80554 | 47416 | 16693 |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_2_PAIR_RESETS_WEEK__FLIP_CLOSE_SMALL_LOSS_WAREHOUSE_GT3ADR | flip_counterfactual | close_small_loss_warehouse_large_loss | true | 10492.661616 | 10111.425093 | 1.615359 | 7.674325 | -1387.91141 | -381.236523 | -1850.992699 | -1029.767911 | -1219.040918 | -1308.360174 | 0.61126 | 0.911528 | 0.686047 | -42.026587 | 0.233871 | 80554 | 47416 | 16693 |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_2_PAIR_RESETS_WEEK__NO_FLIP_FORCE_DIAGNOSTIC | flip_counterfactual | no_flip_force_no_new_fills | true | 14372.226437 | 10213.085259 | 1.467986 |  | -1604.159284 | -4159.141178 | -4238.90289 | -839.446671 | -1346.077972 | -1553.18464 | 0.589812 | 1 | 0.662791 | 0 | 0.948387 | 80319 | 47192 | 16690 |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_LOSER_WAREHOUSE | flip_counterfactual | warehouse_losing_flip_no_new_fills | true | 14028.861203 | 11720.641171 | 1.515576 | 9.295385 | -1826.760979 | -2308.220032 | -2627.126459 | -1139.447341 | -1632.008906 | -1812.76206 | 0.605898 | 0.919571 | 0.709302 | 0 | 0.458955 | 107731 | 63510 | 22252 |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_GRACE_1W | flip_counterfactual | grace_window_losing_flip_no_new_fills | true | 14224.287547 | 11916.067515 | 1.514426 | 8.466369 | -1709.896784 | -2308.220032 | -2627.126459 | -1139.447341 | -1632.008906 | -1610.350318 | 0.613941 | 0.906166 | 0.72093 | 0 | 0.522388 | 107731 | 63510 | 22252 |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_CLOSE_SMALL_LOSS_WAREHOUSE_GT3ADR | flip_counterfactual | close_small_loss_warehouse_large_loss | true | 14021.218941 | 11712.998909 | 1.515718 | 9.24024 | -1817.110743 | -2308.220032 | -2627.126459 | -1139.447341 | -1634.856483 | -1803.111824 | 0.605898 | 0.919571 | 0.72093 | -84.018696 | 0.26455 | 107731 | 63510 | 22252 |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__NO_FLIP_FORCE_DIAGNOSTIC | flip_counterfactual | no_flip_force_no_new_fills | true | 19239.485961 | 11894.890868 | 1.395726 |  | -2921.847932 | -7344.595093 | -7743.049098 | -1085.696072 | -2009.107668 | -2422.51103 | 0.587131 | 1 | 0.651163 | 0 | 0.947761 | 107399 | 63199 | 22245 |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_LOSER_WAREHOUSE | flip_counterfactual | warehouse_losing_flip_no_new_fills | true | 16193.653693 | 13842.569182 | 1.563144 | 8.461062 | -1992.408147 | -2351.084511 | -3001.945057 | -1151.146735 | -1634.5264 | -1992.408147 | 0.600536 | 0.914209 | 0.744186 | 0 | 0.514535 | 106080 | 65843 | 20468 |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_GRACE_1W | flip_counterfactual | grace_window_losing_flip_no_new_fills | true | 16511.607861 | 14160.52335 | 1.564245 | 7.840712 | -1694.811188 | -2351.084511 | -3043.178003 | -1151.146735 | -1578.927434 | -1660.82999 | 0.592493 | 0.908847 | 0.732558 | 0 | 0.569767 | 106080 | 65843 | 20468 |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_CLOSE_SMALL_LOSS_WAREHOUSE_GT3ADR | flip_counterfactual | close_small_loss_warehouse_large_loss | true | 16128.957728 | 13777.873217 | 1.560775 | 8.415976 | -1988.00802 | -2351.084511 | -3001.945057 | -1151.146735 | -1627.31646 | -1988.00802 | 0.600536 | 0.914209 | 0.744186 | -138.230157 | 0.278027 | 106080 | 65843 | 20468 |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__NO_FLIP_FORCE_DIAGNOSTIC | flip_counterfactual | no_flip_force_no_new_fills | true | 22529.655745 | 14820.927278 | 1.438622 |  | -2895.729322 | -7708.728467 | -8067.331207 | -1227.028629 | -2240.958708 | -2559.995671 | 0.576408 | 1 | 0.686047 | 0 | 0.962209 | 105766 | 65555 | 20455 |
| PAIR_TWO_SIDED_GRID_T125_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_LOSER_WAREHOUSE | flip_counterfactual | warehouse_losing_flip_no_new_fills | true | 17525.932805 | 13058.63257 | 1.440995 | 8.26353 | -4092.87448 | -4467.300235 | -5032.162889 | -1332.846058 | -2318.396081 | -3312.0798 | 0.589812 | 0.91689 | 0.72093 | 0 | 0.523002 | 110454 | 66112 | 26629 |
| PAIR_TWO_SIDED_GRID_T125_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_GRACE_1W | flip_counterfactual | grace_window_losing_flip_no_new_fills | true | 17805.182582 | 13337.882347 | 1.442586 | 7.607253 | -3525.943814 | -4467.300235 | -5032.162889 | -1360.447819 | -1854.823852 | -2816.016684 | 0.579088 | 0.908847 | 0.72093 | 0 | 0.583535 | 110454 | 66112 | 26629 |
| PAIR_TWO_SIDED_GRID_T125_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_CLOSE_SMALL_LOSS_WAREHOUSE_GT3ADR | flip_counterfactual | close_small_loss_warehouse_large_loss | true | 17485.6992 | 13018.398965 | 1.440007 | 8.282823 | -4075.313293 | -4467.300235 | -5032.162889 | -1332.846058 | -2309.97075 | -3307.695623 | 0.592493 | 0.919571 | 0.72093 | -158.480469 | 0.293233 | 110454 | 66112 | 26629 |
| PAIR_TWO_SIDED_GRID_T125_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__NO_FLIP_FORCE_DIAGNOSTIC | flip_counterfactual | no_flip_force_no_new_fills | true | 24845.714045 | 12991.974395 | 1.312678 |  | -5816.74014 | -11853.73965 | -12461.879402 | -1600.101164 | -2871.161505 | -4384.064223 | 0.565684 | 1 | 0.686047 | 0 | 0.949153 | 109983 | 65678 | 26613 |
| FULLY_HEDGED_LONG_SHORT_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE | fully_hedged_reference | current_forced_flip_close | true | 53870.954145 | 53646.297719 | 10.308136 |  | -705.647194 | -224.656426 | -966.732115 | -705.647194 | -232.636634 | 915.954548 | 0.857909 | 1 | 0.965116 | 0 |  | 204752 | 102895 | 53357 |

## Direct Answers

| question | answer | evidence |
|---|---|---|
| Are strong closed weekly wins being offset by unresolved adverse open inventory? | yes | closed_weekly=0.919571 mtm_weekly=0.595174 final_open=-2351.084511 |
| Is Candidate B flip handling the main source of realized damage? | material_realized_damage | flip_loss=-6297.282489 flip_events=402 |
| Is the third reset actually dangerous? | not_obviously_third_reset | worst_bucket=reset_1 |
| At what age does adverse inventory become toxic? | 13_plus_weeks | open_loss=-2073.0693 flip_loss=-541.15384 |
| Does directional T100/L3 beat the fully hedged long-short weekly reference? | hedged_reference_matches_or_beats_directional_candidate_gross_edge_warning | {"diagnostic":"fully_hedged_long_short_28_pairs_weekly_vs_directional_t100_l3","directional_rule_id":"PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK","hedged_rule_id":"FULLY_HEDGED_LONG_SHORT_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE","directional_final_equity_adr":13772.999764,"hedged_final_equity_adr":53646.297719,"equity_edge_vs_hedged_adr":-39873.297955,"directional_max_drawdown_adr":-1989.442654,"hedged_max_drawdown_adr":-705.647194,"drawdown_edge_vs_hedged_adr":-1283.79546,"directional_worst_13_week_loss_adr":-1989.442654,"hedged_worst_13_week_loss_adr":915.954548,"directional_mtm_weekly_win_rate":0.595174,"hedged_mtm_weekly_win_rate":0.857909,"edge_read":"hedged_reference_matches_or_beats_directional_candidate_gross_edge_warning","content_hash":"FDDB68FC754971D5C7F4EC320382F799B5EDE6BAD22786E74AAD09AA353276CF"} |

## Fully Hedged Diagnostic

| diagnostic | directional_final_equity_adr | hedged_final_equity_adr | equity_edge_vs_hedged_adr | directional_max_drawdown_adr | hedged_max_drawdown_adr | edge_read |
|---|---|---|---|---|---|---|
| fully_hedged_long_short_28_pairs_weekly_vs_directional_t100_l3 | 13772.999764 | 53646.297719 | -39873.297955 | -1989.442654 | -705.647194 | hedged_reference_matches_or_beats_directional_candidate_gross_edge_warning |

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
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP__FLIP_LOSER_WAREHOUSE | warehouse_losing_flip_no_new_fills | target_reset_close | 28300 | 24983.633059 | 0 | 0.782799 | 0 | 55.062488 |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP__FLIP_LOSER_WAREHOUSE | warehouse_losing_flip_no_new_fills | warehouse_hard_loss | 239 | -10947.92477 | -10947.92477 | -16.440704 | -1316.089692 | 556.031939 |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP__FLIP_LOSER_WAREHOUSE | warehouse_losing_flip_no_new_fills | warehouse_recovery | 371 | 34.68273 | 0 | 0.037043 | 0 | 149.98513 |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP__FLIP_LOSER_WAREHOUSE | warehouse_losing_flip_no_new_fills | candidate_b_flip_close | 286 | 213.630541 | 0 | 0.420227 | 0 | 79.548718 |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP__FLIP_LOSER_WAREHOUSE | warehouse_losing_flip_no_new_fills | warehouse_expiry | 6 | -42.063622 | -42.063622 | -6.800278 | -9.349883 | 2253.816667 |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP__FLIP_LOSER_WAREHOUSE | warehouse_losing_flip_no_new_fills | data_end_open_inventory | 28 | -4480.156606 | -4481.135481 | -3.062041 | -3099.046979 | 709.991071 |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP__FLIP_GRACE_1W | grace_window_losing_flip_no_new_fills | target_reset_close | 28300 | 24983.633059 | 0 | 0.782799 | 0 | 55.062488 |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP__FLIP_GRACE_1W | grace_window_losing_flip_no_new_fills | grace_expiry | 219 | -9852.269725 | -9852.269725 | -19.585657 | -1212.812518 | 638.338813 |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP__FLIP_GRACE_1W | grace_window_losing_flip_no_new_fills | warehouse_recovery | 397 | 57.389019 | 0 | 0.041726 | 0 | 148.803359 |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP__FLIP_GRACE_1W | grace_window_losing_flip_no_new_fills | candidate_b_flip_close | 286 | 213.630541 | 0 | 0.420227 | 0 | 79.548718 |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP__FLIP_GRACE_1W | grace_window_losing_flip_no_new_fills | data_end_open_inventory | 28 | -4480.156606 | -4481.135481 | -3.062041 | -3099.046979 | 709.991071 |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP__FLIP_CLOSE_SMALL_LOSS_WAREHOUSE_GT3ADR | close_small_loss_warehouse_large_loss | target_reset_close | 28300 | 24983.633059 | 0 | 0.782799 | 0 | 55.062488 |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP__FLIP_CLOSE_SMALL_LOSS_WAREHOUSE_GT3ADR | close_small_loss_warehouse_large_loss | warehouse_hard_loss | 222 | -10691.648924 | -10691.648924 | -17.726933 | -1316.089692 | 537.969069 |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP__FLIP_CLOSE_SMALL_LOSS_WAREHOUSE_GT3ADR | close_small_loss_warehouse_large_loss | warehouse_recovery | 78 | 18.386757 | 0 | 0.075921 | 0 | 208.379487 |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP__FLIP_CLOSE_SMALL_LOSS_WAREHOUSE_GT3ADR | close_small_loss_warehouse_large_loss | candidate_b_flip_close | 602 | -97.364677 | -310.995218 | -0.043305 | -2.978452 | 83.766639 |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP__FLIP_CLOSE_SMALL_LOSS_WAREHOUSE_GT3ADR | close_small_loss_warehouse_large_loss | data_end_open_inventory | 28 | -4480.156606 | -4481.135481 | -3.062041 | -3099.046979 | 709.991071 |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP__NO_FLIP_FORCE_DIAGNOSTIC | no_flip_force_no_new_fills | target_reset_close | 28300 | 24983.633059 | 0 | 0.782799 | 0 | 55.062488 |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP__NO_FLIP_FORCE_DIAGNOSTIC | no_flip_force_no_new_fills | warehouse_recovery | 585 | 113.775316 | 0 | 0.057631 | 0 | 1014.422536 |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP__NO_FLIP_FORCE_DIAGNOSTIC | no_flip_force_no_new_fills | candidate_b_flip_close | 286 | 213.630541 | 0 | 0.420227 | 0 | 79.548718 |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP__NO_FLIP_FORCE_DIAGNOSTIC | no_flip_force_no_new_fills | data_end_open_inventory | 59 | -13535.973914 | -13536.952789 | -42.241724 | -3099.046979 | 9516.585028 |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP__FLIP_LOSER_WAREHOUSE | warehouse_losing_flip_no_new_fills | target_reset_close | 18703 | 32434.879613 | 0 | 1.566357 | 0 | 80.81217 |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP__FLIP_LOSER_WAREHOUSE | warehouse_losing_flip_no_new_fills | warehouse_hard_loss | 305 | -14775.209056 | -14775.209056 | -16.995972 | -1334.052716 | 573.445137 |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP__FLIP_LOSER_WAREHOUSE | warehouse_losing_flip_no_new_fills | candidate_b_flip_close | 223 | 246.359359 | 0 | 0.627277 | 0 | 83.16846 |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP__FLIP_LOSER_WAREHOUSE | warehouse_losing_flip_no_new_fills | warehouse_recovery | 372 | 33.616387 | 0 | 0.047151 | 0 | 169.445699 |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP__FLIP_LOSER_WAREHOUSE | warehouse_losing_flip_no_new_fills | data_end_open_inventory | 28 | -5716.628824 | -5718.248238 | -5.981555 | -3088.881635 | 832.222024 |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP__FLIP_LOSER_WAREHOUSE | warehouse_losing_flip_no_new_fills | warehouse_expiry | 2 | -16.743401 | -16.743401 | -8.3717 | -11.802574 | 2243.9 |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP__FLIP_GRACE_1W | grace_window_losing_flip_no_new_fills | target_reset_close | 18703 | 32434.879613 | 0 | 1.566357 | 0 | 80.81217 |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP__FLIP_GRACE_1W | grace_window_losing_flip_no_new_fills | grace_expiry | 265 | -13735.884341 | -13735.884341 | -22.987588 | -1229.973457 | 677.747862 |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP__FLIP_GRACE_1W | grace_window_losing_flip_no_new_fills | warehouse_recovery | 414 | 64.715483 | 0 | 0.055097 | 0 | 184.368438 |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP__FLIP_GRACE_1W | grace_window_losing_flip_no_new_fills | candidate_b_flip_close | 223 | 246.359359 | 0 | 0.627277 | 0 | 83.16846 |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP__FLIP_GRACE_1W | grace_window_losing_flip_no_new_fills | data_end_open_inventory | 28 | -5716.628824 | -5718.248238 | -5.981555 | -3088.881635 | 832.222024 |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP__FLIP_CLOSE_SMALL_LOSS_WAREHOUSE_GT3ADR | close_small_loss_warehouse_large_loss | target_reset_close | 18703 | 32434.879613 | 0 | 1.566357 | 0 | 80.81217 |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP__FLIP_CLOSE_SMALL_LOSS_WAREHOUSE_GT3ADR | close_small_loss_warehouse_large_loss | warehouse_hard_loss | 285 | -14473.403002 | -14473.403002 | -18.374281 | -1334.052716 | 560.896842 |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP__FLIP_CLOSE_SMALL_LOSS_WAREHOUSE_GT3ADR | close_small_loss_warehouse_large_loss | candidate_b_flip_close | 504 | -61.118035 | -307.477394 | -0.121211 | -2.968174 | 92.354134 |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP__FLIP_CLOSE_SMALL_LOSS_WAREHOUSE_GT3ADR | close_small_loss_warehouse_large_loss | warehouse_recovery | 113 | 19.069772 | 0 | 0.084486 | 0 | 212.925959 |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP__FLIP_CLOSE_SMALL_LOSS_WAREHOUSE_GT3ADR | close_small_loss_warehouse_large_loss | data_end_open_inventory | 28 | -5716.628824 | -5718.248238 | -5.981555 | -3088.881635 | 832.222024 |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP__NO_FLIP_FORCE_DIAGNOSTIC | no_flip_force_no_new_fills | target_reset_close | 18703 | 32434.879613 | 0 | 1.566357 | 0 | 80.81217 |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP__NO_FLIP_FORCE_DIAGNOSTIC | no_flip_force_no_new_fills | warehouse_recovery | 640 | 154.683355 | 0 | 0.071117 | 0 | 1230.407656 |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP__NO_FLIP_FORCE_DIAGNOSTIC | no_flip_force_no_new_fills | candidate_b_flip_close | 223 | 246.359359 | 0 | 0.627277 | 0 | 83.16846 |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP__NO_FLIP_FORCE_DIAGNOSTIC | no_flip_force_no_new_fills | data_end_open_inventory | 67 | -19032.76638 | -19034.385794 | -73.643255 | -3088.881635 | 10970.718159 |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_2_PAIR_RESETS_WEEK__FLIP_LOSER_WAREHOUSE | warehouse_losing_flip_no_new_fills | target_reset_close | 8590 | 7722.972214 | 0 | 0.792461 | 0 | 67.898855 |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_2_PAIR_RESETS_WEEK__FLIP_LOSER_WAREHOUSE | warehouse_losing_flip_no_new_fills | terminal_reset_limit_close | 7685 | 6557.212511 | 0 | 0.791236 | 0 | 19.822462 |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_2_PAIR_RESETS_WEEK__FLIP_LOSER_WAREHOUSE | warehouse_losing_flip_no_new_fills | warehouse_recovery | 58 | 9.048957 | 0 | 0.067581 | 0 | 266.180747 |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_2_PAIR_RESETS_WEEK__FLIP_LOSER_WAREHOUSE | warehouse_losing_flip_no_new_fills | warehouse_hard_loss | 97 | -3809.975021 | -3809.975021 | -20.442767 | -364.067975 | 418.870619 |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_2_PAIR_RESETS_WEEK__FLIP_LOSER_WAREHOUSE | warehouse_losing_flip_no_new_fills | candidate_b_flip_close | 15 | 28.178882 | 0 | 0.524475 | 0 | 118.982222 |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_2_PAIR_RESETS_WEEK__FLIP_LOSER_WAREHOUSE | warehouse_losing_flip_no_new_fills | data_end_open_inventory | 11 | -381.236523 | -381.236523 | -18.95205 | -146.633187 | 520.063636 |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_2_PAIR_RESETS_WEEK__FLIP_GRACE_1W | grace_window_losing_flip_no_new_fills | target_reset_close | 8590 | 7722.972214 | 0 | 0.792461 | 0 | 67.898855 |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_2_PAIR_RESETS_WEEK__FLIP_GRACE_1W | grace_window_losing_flip_no_new_fills | terminal_reset_limit_close | 7685 | 6557.212511 | 0 | 0.791236 | 0 | 19.822462 |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_2_PAIR_RESETS_WEEK__FLIP_GRACE_1W | grace_window_losing_flip_no_new_fills | warehouse_recovery | 72 | 18.450114 | 0 | 0.072763 | 0 | 268.552546 |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_2_PAIR_RESETS_WEEK__FLIP_GRACE_1W | grace_window_losing_flip_no_new_fills | grace_expiry | 83 | -3319.189475 | -3319.189475 | -28.696083 | -316.673731 | 566.81506 |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_2_PAIR_RESETS_WEEK__FLIP_GRACE_1W | grace_window_losing_flip_no_new_fills | candidate_b_flip_close | 15 | 28.178882 | 0 | 0.524475 | 0 | 118.982222 |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_2_PAIR_RESETS_WEEK__FLIP_GRACE_1W | grace_window_losing_flip_no_new_fills | data_end_open_inventory | 11 | -381.236523 | -381.236523 | -18.95205 | -146.633187 | 520.063636 |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_2_PAIR_RESETS_WEEK__FLIP_CLOSE_SMALL_LOSS_WAREHOUSE_GT3ADR | close_small_loss_warehouse_large_loss | target_reset_close | 8590 | 7722.972214 | 0 | 0.792461 | 0 | 67.898855 |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_2_PAIR_RESETS_WEEK__FLIP_CLOSE_SMALL_LOSS_WAREHOUSE_GT3ADR | close_small_loss_warehouse_large_loss | terminal_reset_limit_close | 7685 | 6557.212511 | 0 | 0.791236 | 0 | 19.822462 |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_2_PAIR_RESETS_WEEK__FLIP_CLOSE_SMALL_LOSS_WAREHOUSE_GT3ADR | close_small_loss_warehouse_large_loss | warehouse_recovery | 29 | 5.767974 | 0 | 0.084716 | 0 | 281.556897 |

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
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP__FLIP_LOSER_WAREHOUSE | warehouse_losing_flip_no_new_fills | 286 | 0 |  | 0 | 0 | 67 | 4 | 68.533334 | EURNZD | EUR |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP__FLIP_GRACE_1W | grace_window_losing_flip_no_new_fills | 286 | 0 |  | 0 | 0 | 67 | 4 | 68.533334 | EURNZD | EUR |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP__FLIP_CLOSE_SMALL_LOSS_WAREHOUSE_GT3ADR | close_small_loss_warehouse_large_loss | 602 | -310.995218 | -0.984162 | -2.978452 | 316 | 108 | 4 | 71.183334 | EURCAD | EUR |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP__NO_FLIP_FORCE_DIAGNOSTIC | no_flip_force_no_new_fills | 286 | 0 |  | 0 | 0 | 67 | 4 | 68.533334 | EURNZD | EUR |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP__FLIP_LOSER_WAREHOUSE | warehouse_losing_flip_no_new_fills | 223 | 0 |  | 0 | 0 | 103 | 3 | 71.083333 | EURCHF | EUR |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP__FLIP_GRACE_1W | grace_window_losing_flip_no_new_fills | 223 | 0 |  | 0 | 0 | 103 | 3 | 71.083333 | EURCHF | EUR |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP__FLIP_CLOSE_SMALL_LOSS_WAREHOUSE_GT3ADR | close_small_loss_warehouse_large_loss | 504 | -307.477394 | -1.094226 | -2.968174 | 281 | 196 | 3 | 80.508333 | GBPNZD | GBP |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP__NO_FLIP_FORCE_DIAGNOSTIC | no_flip_force_no_new_fills | 223 | 0 |  | 0 | 0 | 103 | 3 | 71.083333 | EURCHF | EUR |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_2_PAIR_RESETS_WEEK__FLIP_LOSER_WAREHOUSE | warehouse_losing_flip_no_new_fills | 15 | 0 |  | 0 | 0 | 13 | 1 | 100.483333 | EURAUD | EUR |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_2_PAIR_RESETS_WEEK__FLIP_GRACE_1W | grace_window_losing_flip_no_new_fills | 15 | 0 |  | 0 | 0 | 13 | 1 | 100.483333 | EURAUD | EUR |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_2_PAIR_RESETS_WEEK__FLIP_CLOSE_SMALL_LOSS_WAREHOUSE_GT3ADR | close_small_loss_warehouse_large_loss | 46 | -42.026587 | -1.355696 | -2.963438 | 31 | 25 | 1 | 139.5 | EURCAD | EUR |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_2_PAIR_RESETS_WEEK__NO_FLIP_FORCE_DIAGNOSTIC | no_flip_force_no_new_fills | 15 | 0 |  | 0 | 0 | 13 | 1 | 100.483333 | EURAUD | EUR |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_LOSER_WAREHOUSE | warehouse_losing_flip_no_new_fills | 43 | 0 |  | 0 | 0 | 31 | 2 | 79.983333 | USDCHF | USD |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_GRACE_1W | grace_window_losing_flip_no_new_fills | 43 | 0 |  | 0 | 0 | 31 | 2 | 79.983333 | USDCHF | USD |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_CLOSE_SMALL_LOSS_WAREHOUSE_GT3ADR | close_small_loss_warehouse_large_loss | 122 | -84.018696 | -1.063528 | -2.940061 | 79 | 58 | 2 | 94.675 | EURCAD | EUR |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__NO_FLIP_FORCE_DIAGNOSTIC | no_flip_force_no_new_fills | 43 | 0 |  | 0 | 0 | 31 | 2 | 79.983333 | USDCHF | USD |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_LOSER_WAREHOUSE | warehouse_losing_flip_no_new_fills | 58 | 0 |  | 0 | 0 | 29 | 2 | 80.533334 | AUDCHF | AUD |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_GRACE_1W | grace_window_losing_flip_no_new_fills | 58 | 0 |  | 0 | 0 | 29 | 2 | 80.533334 | AUDCHF | AUD |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_CLOSE_SMALL_LOSS_WAREHOUSE_GT3ADR | close_small_loss_warehouse_large_loss | 179 | -138.230157 | -1.142398 | -2.94759 | 121 | 70 | 2 | 87.183333 | EURCAD | AUD |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__NO_FLIP_FORCE_DIAGNOSTIC | no_flip_force_no_new_fills | 58 | 0 |  | 0 | 0 | 29 | 2 | 80.533334 | AUDCHF | AUD |
| PAIR_TWO_SIDED_GRID_T125_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_LOSER_WAREHOUSE | warehouse_losing_flip_no_new_fills | 82 | 0 |  | 0 | 0 | 45 | 2 | 85.683334 | GBPUSD | EUR |
| PAIR_TWO_SIDED_GRID_T125_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_GRACE_1W | grace_window_losing_flip_no_new_fills | 82 | 0 |  | 0 | 0 | 45 | 2 | 85.683334 | GBPUSD | EUR |
| PAIR_TWO_SIDED_GRID_T125_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_CLOSE_SMALL_LOSS_WAREHOUSE_GT3ADR | close_small_loss_warehouse_large_loss | 229 | -158.480469 | -1.078098 | -2.848655 | 147 | 93 | 2 | 89.033333 | EURCAD | EUR |
| PAIR_TWO_SIDED_GRID_T125_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__NO_FLIP_FORCE_DIAGNOSTIC | no_flip_force_no_new_fills | 82 | 0 |  | 0 | 0 | 45 | 2 | 85.683334 | GBPUSD | EUR |
| FULLY_HEDGED_LONG_SHORT_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE | current_forced_flip_close | 0 | 0 |  | 0 | 0 | 0 |  |  |  |  |

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
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP__FLIP_LOSER_WAREHOUSE | warehouse_losing_flip_no_new_fills | initial_cycle | 930 | 482.081734 | 0 | 0.988172 | -59.362056 | 0 | 0 | CADJPY |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP__FLIP_LOSER_WAREHOUSE | warehouse_losing_flip_no_new_fills | reset_1 | 7376 | 4542.234127 | -919.873541 | 0.993488 | -299.316284 | 0 | -919.873541 | AUDJPY |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP__FLIP_LOSER_WAREHOUSE | warehouse_losing_flip_no_new_fills | reset_2 | 6334 | 4313.944261 | -3417.125332 | 0.993362 | -322.819382 | 0 | -3417.125332 | AUDNZD |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP__FLIP_LOSER_WAREHOUSE | warehouse_losing_flip_no_new_fills | reset_3 | 4968 | 2349.089193 | -27.379447 | 0.991134 | -212.636378 | 0 | -27.615781 | AUDUSD |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP__FLIP_LOSER_WAREHOUSE | warehouse_losing_flip_no_new_fills | reset_4 | 3544 | 47.287793 | -80.324645 | 0.989825 | -1316.089692 | 0 | -81.067186 | CHFJPY |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP__FLIP_LOSER_WAREHOUSE | warehouse_losing_flip_no_new_fills | reset_5 | 2304 | -119.183327 | -35.453641 | 0.984341 | -570.440412 | 0 | -35.453641 | EURCHF |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP__FLIP_LOSER_WAREHOUSE | warehouse_losing_flip_no_new_fills | reset_6 | 1372 | 998.839871 | 0 | 0.991254 | -36.132187 | 0 | 0 | EURAUD |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP__FLIP_LOSER_WAREHOUSE | warehouse_losing_flip_no_new_fills | reset_7 | 860 | 513.934294 | 0 | 0.99186 | -86.149265 | 0 | 0 | AUDCAD |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP__FLIP_LOSER_WAREHOUSE | warehouse_losing_flip_no_new_fills | reset_8 | 527 | 217.927979 | 0 | 0.988615 | -114.99242 | 0 | 0 | GBPCHF |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP__FLIP_LOSER_WAREHOUSE | warehouse_losing_flip_no_new_fills | reset_9 | 320 | 258.578676 | 0 | 0.996875 | -15.484258 | 0 | 0 | CADCHF |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP__FLIP_LOSER_WAREHOUSE | warehouse_losing_flip_no_new_fills | reset_10 | 229 | 222.065101 | 0 | 1 | 0 | 0 | 0 | AUDCAD |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP__FLIP_LOSER_WAREHOUSE | warehouse_losing_flip_no_new_fills | reset_11 | 146 | 64.502669 | 0 | 0.979452 | -47.342612 | 0 | 0 | AUDUSD |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP__FLIP_LOSER_WAREHOUSE | warehouse_losing_flip_no_new_fills | reset_12 | 102 | 73.799733 | 0 | 0.990196 | -15.07483 | 0 | 0 | EURAUD |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP__FLIP_LOSER_WAREHOUSE | warehouse_losing_flip_no_new_fills | reset_13 | 72 | 76.63136 | 0 | 1 | 0 | 0 | 0 | AUDCAD |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP__FLIP_LOSER_WAREHOUSE | warehouse_losing_flip_no_new_fills | reset_14 | 48 | 69.494445 | 0 | 1 | 0 | 0 | 0 | AUDCAD |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP__FLIP_LOSER_WAREHOUSE | warehouse_losing_flip_no_new_fills | reset_15 | 32 | 43.375526 | 0 | 1 | 0 | 0 | 0 | AUDCAD |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP__FLIP_LOSER_WAREHOUSE | warehouse_losing_flip_no_new_fills | reset_16 | 22 | 24.86917 | 0 | 1 | 0 | 0 | 0 | AUDCAD |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP__FLIP_LOSER_WAREHOUSE | warehouse_losing_flip_no_new_fills | reset_17 | 17 | 19.730486 | 0 | 1 | 0 | 0 | 0 | AUDCAD |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP__FLIP_LOSER_WAREHOUSE | warehouse_losing_flip_no_new_fills | reset_18 | 11 | 18.853318 | 0 | 1 | 0 | 0 | 0 | AUDCAD |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP__FLIP_LOSER_WAREHOUSE | warehouse_losing_flip_no_new_fills | reset_19 | 7 | 8.144531 | 0 | 1 | 0 | 0 | 0 | AUDCHF |

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
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP__FLIP_LOSER_WAREHOUSE | warehouse_losing_flip_no_new_fills | same_week | 27580 | -24.130746 | -1903.364313 | 0 | 0.986794 | 21.35 | EURAUD | AUD |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP__FLIP_LOSER_WAREHOUSE | warehouse_losing_flip_no_new_fills | 1_2_weeks | 1040 | -106.671015 | -1708.522151 | 0 | 0.911538 | 210.1 | GBPAUD | USD |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP__FLIP_LOSER_WAREHOUSE | warehouse_losing_flip_no_new_fills | 3_4_weeks | 360 | -33.471982 | -1285.409933 | 0 | 0.877778 | 454.025 | GBPCAD | GBP |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP__FLIP_LOSER_WAREHOUSE | warehouse_losing_flip_no_new_fills | 5_8_weeks | 154 | -111.833923 | -1611.696794 | 0 | 0.824675 | 863.833333 | USDCAD | USD |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP__FLIP_LOSER_WAREHOUSE | warehouse_losing_flip_no_new_fills | 13_plus_weeks | 42 | -4180.217386 | -3468.736449 | 0 | 0.595238 | 3277.283333 | AUDNZD | AUD |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP__FLIP_LOSER_WAREHOUSE | warehouse_losing_flip_no_new_fills | 9_13_weeks | 54 | -24.810429 | -1012.258752 | 0 | 0.851852 | 1709.208334 | AUDCAD | AUD |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP__FLIP_GRACE_1W | grace_window_losing_flip_no_new_fills | same_week | 27514 | -24.130746 | 0 | 0 | 0.989604 | 21.35 | NZDJPY | JPY |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP__FLIP_GRACE_1W | grace_window_losing_flip_no_new_fills | 3_4_weeks | 379 | -33.471982 | -2128.61751 | 0 | 0.831135 | 450.95 | USDCAD | USD |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP__FLIP_GRACE_1W | grace_window_losing_flip_no_new_fills | 1_2_weeks | 1102 | -106.671015 | -2565.537946 | 0 | 0.875681 | 210.183333 | GBPUSD | USD |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP__FLIP_GRACE_1W | grace_window_losing_flip_no_new_fills | 5_8_weeks | 147 | -111.833923 | -1485.007402 | 0 | 0.863946 | 863.833333 | AUDUSD | USD |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP__FLIP_GRACE_1W | grace_window_losing_flip_no_new_fills | 9_13_weeks | 52 | -24.810429 | -590.767779 | 0 | 0.884615 | 1683.333334 | GBPJPY | NZD |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP__FLIP_GRACE_1W | grace_window_losing_flip_no_new_fills | 13_plus_weeks | 36 | -4180.217386 | -3082.339088 | 0 | 0.694444 | 3277.283333 | AUDNZD | AUD |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP__FLIP_CLOSE_SMALL_LOSS_WAREHOUSE_GT3ADR | close_small_loss_warehouse_large_loss | same_week | 27638 | -24.130746 | -2178.862842 | -305.945434 | 0.975357 | 21.083333 | EURAUD | AUD |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP__FLIP_CLOSE_SMALL_LOSS_WAREHOUSE_GT3ADR | close_small_loss_warehouse_large_loss | 1_2_weeks | 1013 | -106.671015 | -1665.819337 | -2.436089 | 0.910168 | 210.3 | GBPAUD | USD |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP__FLIP_CLOSE_SMALL_LOSS_WAREHOUSE_GT3ADR | close_small_loss_warehouse_large_loss | 3_4_weeks | 345 | -33.471982 | -1225.218919 | 0 | 0.884058 | 453.066667 | GBPCAD | GBP |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP__FLIP_CLOSE_SMALL_LOSS_WAREHOUSE_GT3ADR | close_small_loss_warehouse_large_loss | 5_8_weeks | 148 | -111.833923 | -1539.066537 | -2.613695 | 0.837838 | 857 | USDCAD | USD |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP__FLIP_CLOSE_SMALL_LOSS_WAREHOUSE_GT3ADR | close_small_loss_warehouse_large_loss | 13_plus_weeks | 36 | -4180.217386 | -3426.672827 | 0 | 0.694444 | 3277.283333 | AUDNZD | AUD |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP__FLIP_CLOSE_SMALL_LOSS_WAREHOUSE_GT3ADR | close_small_loss_warehouse_large_loss | 9_13_weeks | 50 | -24.810429 | -967.00368 | 0 | 0.9 | 1686.016667 | AUDCAD | AUD |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP__NO_FLIP_FORCE_DIAGNOSTIC | no_flip_force_no_new_fills | same_week | 27514 | -24.130746 | 0 | 0 | 0.989604 | 21.35 | NZDJPY | JPY |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP__NO_FLIP_FORCE_DIAGNOSTIC | no_flip_force_no_new_fills | 3_4_weeks | 365 | -33.471982 | 0 | 0 | 0.991781 | 455.433334 | EURUSD | EUR |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP__NO_FLIP_FORCE_DIAGNOSTIC | no_flip_force_no_new_fills | 1_2_weeks | 997 | -106.671015 | 0 | 0 | 0.98997 | 212.4 | GBPNZD | GBP |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP__NO_FLIP_FORCE_DIAGNOSTIC | no_flip_force_no_new_fills | 5_8_weeks | 175 | -121.886699 | 0 | 0 | 0.982857 | 870.366667 | USDCAD | USD |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP__NO_FLIP_FORCE_DIAGNOSTIC | no_flip_force_no_new_fills | 13_plus_weeks | 113 | -13225.981918 | 0 | 0 | 0.707965 | 3860.741667 | AUDNZD | AUD |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP__NO_FLIP_FORCE_DIAGNOSTIC | no_flip_force_no_new_fills | 9_13_weeks | 66 | -24.810429 | 0 | 0 | 0.984848 | 1680.65 | EURAUD | EUR |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP__FLIP_LOSER_WAREHOUSE | warehouse_losing_flip_no_new_fills | same_week | 17516 | -20.837184 | -1962.911474 | 0 | 0.982057 | 26.016667 | EURAUD | AUD |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP__FLIP_LOSER_WAREHOUSE | warehouse_losing_flip_no_new_fills | 1_2_weeks | 1313 | -137.305544 | -2430.93932 | 0 | 0.908606 | 214.133333 | USDCAD | USD |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP__FLIP_LOSER_WAREHOUSE | warehouse_losing_flip_no_new_fills | 3_4_weeks | 485 | -5.404647 | -2205.188436 | 0 | 0.861856 | 446.683333 | NZDUSD | GBP |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP__FLIP_LOSER_WAREHOUSE | warehouse_losing_flip_no_new_fills | 5_8_weeks | 201 | -177.670398 | -2082.259556 | 0 | 0.840796 | 864.416667 | USDCAD | USD |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP__FLIP_LOSER_WAREHOUSE | warehouse_losing_flip_no_new_fills | 13_plus_weeks | 46 | -5336.344379 | -4982.401741 | 0 | 0.673913 | 3173.966667 | AUDNZD | AUD |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP__FLIP_LOSER_WAREHOUSE | warehouse_losing_flip_no_new_fills | 9_13_weeks | 72 | -40.686086 | -1128.25193 | 0 | 0.819444 | 1743.016667 | AUDCAD | AUD |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP__FLIP_GRACE_1W | grace_window_losing_flip_no_new_fills | same_week | 17446 | -20.837184 | 0 | 0 | 0.986604 | 26.016667 | EURJPY | EUR |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP__FLIP_GRACE_1W | grace_window_losing_flip_no_new_fills | 3_4_weeks | 514 | -5.404647 | -3056.672186 | 0 | 0.832685 | 438.208334 | USDCAD | USD |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP__FLIP_GRACE_1W | grace_window_losing_flip_no_new_fills | 1_2_weeks | 1361 | -137.305544 | -3124.920343 | 0 | 0.891256 | 213.666667 | GBPUSD | USD |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP__FLIP_GRACE_1W | grace_window_losing_flip_no_new_fills | 5_8_weeks | 200 | -177.670398 | -1973.339078 | 0 | 0.86 | 862.825 | AUDUSD | USD |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP__FLIP_GRACE_1W | grace_window_losing_flip_no_new_fills | 9_13_weeks | 68 | -40.686086 | -933.877874 | 0 | 0.867647 | 1743.016667 | GBPJPY | USD |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP__FLIP_GRACE_1W | grace_window_losing_flip_no_new_fills | 13_plus_weeks | 44 | -5336.344379 | -4647.07486 | 0 | 0.704545 | 3173.966667 | AUDNZD | AUD |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP__FLIP_CLOSE_SMALL_LOSS_WAREHOUSE_GT3ADR | close_small_loss_warehouse_large_loss | same_week | 17569 | -20.837184 | -2239.132348 | -291.437223 | 0.966489 | 25.566667 | EURAUD | AUD |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP__FLIP_CLOSE_SMALL_LOSS_WAREHOUSE_GT3ADR | close_small_loss_warehouse_large_loss | 1_2_weeks | 1288 | -137.305544 | -2368.92397 | -13.604143 | 0.904503 | 213.9 | USDCAD | USD |

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
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP__FLIP_LOSER_WAREHOUSE | flip_counterfactual | warehouse_losing_flip_no_new_fills | true | false | true | true | true | false | true |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP__FLIP_GRACE_1W | flip_counterfactual | grace_window_losing_flip_no_new_fills | true | false | true | true | true | false | true |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP__FLIP_CLOSE_SMALL_LOSS_WAREHOUSE_GT3ADR | flip_counterfactual | close_small_loss_warehouse_large_loss | true | false | true | true | true | false | true |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP__NO_FLIP_FORCE_DIAGNOSTIC | flip_counterfactual | no_flip_force_no_new_fills | true | false | true | true | true | false | true |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP__FLIP_LOSER_WAREHOUSE | flip_counterfactual | warehouse_losing_flip_no_new_fills | true | false | true | true | true | false | true |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP__FLIP_GRACE_1W | flip_counterfactual | grace_window_losing_flip_no_new_fills | true | false | true | true | true | false | true |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP__FLIP_CLOSE_SMALL_LOSS_WAREHOUSE_GT3ADR | flip_counterfactual | close_small_loss_warehouse_large_loss | true | false | true | true | true | false | true |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP__NO_FLIP_FORCE_DIAGNOSTIC | flip_counterfactual | no_flip_force_no_new_fills | true | false | true | true | true | false | true |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_2_PAIR_RESETS_WEEK__FLIP_LOSER_WAREHOUSE | flip_counterfactual | warehouse_losing_flip_no_new_fills | false | false | false | false | true | true | false |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_2_PAIR_RESETS_WEEK__FLIP_GRACE_1W | flip_counterfactual | grace_window_losing_flip_no_new_fills | true | false | false | false | true | true | false |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_2_PAIR_RESETS_WEEK__FLIP_CLOSE_SMALL_LOSS_WAREHOUSE_GT3ADR | flip_counterfactual | close_small_loss_warehouse_large_loss | false | false | false | false | true | true | false |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_2_PAIR_RESETS_WEEK__NO_FLIP_FORCE_DIAGNOSTIC | flip_counterfactual | no_flip_force_no_new_fills | true | false | true | true | true | true | false |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_LOSER_WAREHOUSE | flip_counterfactual | warehouse_losing_flip_no_new_fills | true | false | true | true | true | true | false |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_GRACE_1W | flip_counterfactual | grace_window_losing_flip_no_new_fills | true | false | true | true | true | true | false |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_CLOSE_SMALL_LOSS_WAREHOUSE_GT3ADR | flip_counterfactual | close_small_loss_warehouse_large_loss | true | false | true | true | true | true | false |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__NO_FLIP_FORCE_DIAGNOSTIC | flip_counterfactual | no_flip_force_no_new_fills | true | false | true | true | true | true | false |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_LOSER_WAREHOUSE | flip_counterfactual | warehouse_losing_flip_no_new_fills | true | false | true | true | true | true | false |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_GRACE_1W | flip_counterfactual | grace_window_losing_flip_no_new_fills | true | false | true | true | true | true | false |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_CLOSE_SMALL_LOSS_WAREHOUSE_GT3ADR | flip_counterfactual | close_small_loss_warehouse_large_loss | true | false | true | true | true | true | false |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__NO_FLIP_FORCE_DIAGNOSTIC | flip_counterfactual | no_flip_force_no_new_fills | true | false | true | true | true | true | false |
| PAIR_TWO_SIDED_GRID_T125_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_LOSER_WAREHOUSE | flip_counterfactual | warehouse_losing_flip_no_new_fills | true | false | true | true | true | false | true |
| PAIR_TWO_SIDED_GRID_T125_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_GRACE_1W | flip_counterfactual | grace_window_losing_flip_no_new_fills | true | false | true | true | true | false | true |
| PAIR_TWO_SIDED_GRID_T125_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__FLIP_CLOSE_SMALL_LOSS_WAREHOUSE_GT3ADR | flip_counterfactual | close_small_loss_warehouse_large_loss | true | false | true | true | true | false | true |
| PAIR_TWO_SIDED_GRID_T125_S020_STOP_AFTER_3_PAIR_RESETS_WEEK__NO_FLIP_FORCE_DIAGNOSTIC | flip_counterfactual | no_flip_force_no_new_fills | true | false | true | true | true | false | true |
| FULLY_HEDGED_LONG_SHORT_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE | fully_hedged_reference | current_forced_flip_close | true | false | false | false | true | false | false |

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
  "fixed_rule_count": 33,
  "expected_fixed_rule_count": 33,
  "required_baseline_rows_present": true,
  "t150_no_limit_reference_included": true,
  "flip_counterfactual_row_count": 24,
  "expected_flip_counterfactual_row_count": 24,
  "fully_hedged_reference_included": true,
  "fully_hedged_reference_is_reference_only": true,
  "account_reset_target_count": 0,
  "account_level_emergency_sl_replay_started": false,
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
  "closed_and_equity_reported_side_by_side": true,
  "csv_scorecards_written": true,
  "close_reason_breakdown_written": true,
  "reset_ordinal_breakdown_written": true,
  "age_bucket_breakdown_written": true,
  "audnzd_sentinel_written": true,
  "hedged_edge_diagnostic_written": true
}
```

## Artifacts

- scorecardRowsJson: `docs/research/gates/gate79/artifacts/gate79-flip-loss-adverse-inventory-root-cause-audit/gate79-scorecard.rows.json`
- scorecardRowsCsv: `docs/research/gates/gate79/artifacts/gate79-flip-loss-adverse-inventory-root-cause-audit/gate79-scorecard.rows.csv`
- weeklyEquityRowsJson: `docs/research/gates/gate79/artifacts/gate79-flip-loss-adverse-inventory-root-cause-audit/weekly-equity-truth.rows.json`
- weeklyEquityRowsCsv: `docs/research/gates/gate79/artifacts/gate79-flip-loss-adverse-inventory-root-cause-audit/weekly-equity-truth.rows.csv`
- annualRowsJson: `docs/research/gates/gate79/artifacts/gate79-flip-loss-adverse-inventory-root-cause-audit/annual-summary.rows.json`
- annualRowsCsv: `docs/research/gates/gate79/artifacts/gate79-flip-loss-adverse-inventory-root-cause-audit/annual-summary.rows.csv`
- closeReasonRowsJson: `docs/research/gates/gate79/artifacts/gate79-flip-loss-adverse-inventory-root-cause-audit/close-reason-breakdown.rows.json`
- closeReasonRowsCsv: `docs/research/gates/gate79/artifacts/gate79-flip-loss-adverse-inventory-root-cause-audit/close-reason-breakdown.rows.csv`
- flipAnatomyRowsJson: `docs/research/gates/gate79/artifacts/gate79-flip-loss-adverse-inventory-root-cause-audit/flip-loss-anatomy.rows.json`
- flipAnatomyRowsCsv: `docs/research/gates/gate79/artifacts/gate79-flip-loss-adverse-inventory-root-cause-audit/flip-loss-anatomy.rows.csv`
- resetOrdinalRowsJson: `docs/research/gates/gate79/artifacts/gate79-flip-loss-adverse-inventory-root-cause-audit/reset-ordinal-breakdown.rows.json`
- resetOrdinalRowsCsv: `docs/research/gates/gate79/artifacts/gate79-flip-loss-adverse-inventory-root-cause-audit/reset-ordinal-breakdown.rows.csv`
- ageBucketRowsJson: `docs/research/gates/gate79/artifacts/gate79-flip-loss-adverse-inventory-root-cause-audit/age-bucket-breakdown.rows.json`
- ageBucketRowsCsv: `docs/research/gates/gate79/artifacts/gate79-flip-loss-adverse-inventory-root-cause-audit/age-bucket-breakdown.rows.csv`
- pairAttributionRowsJson: `docs/research/gates/gate79/artifacts/gate79-flip-loss-adverse-inventory-root-cause-audit/pair-tail-attribution.rows.json`
- pairAttributionRowsCsv: `docs/research/gates/gate79/artifacts/gate79-flip-loss-adverse-inventory-root-cause-audit/pair-tail-attribution.rows.csv`
- currencyAttributionRowsJson: `docs/research/gates/gate79/artifacts/gate79-flip-loss-adverse-inventory-root-cause-audit/currency-tail-attribution.rows.json`
- currencyAttributionRowsCsv: `docs/research/gates/gate79/artifacts/gate79-flip-loss-adverse-inventory-root-cause-audit/currency-tail-attribution.rows.csv`
- audnzdSentinelRowsJson: `docs/research/gates/gate79/artifacts/gate79-flip-loss-adverse-inventory-root-cause-audit/audnzd-sentinel.rows.json`
- audnzdSentinelRowsCsv: `docs/research/gates/gate79/artifacts/gate79-flip-loss-adverse-inventory-root-cause-audit/audnzd-sentinel.rows.csv`
- counterfactualRowsJson: `docs/research/gates/gate79/artifacts/gate79-flip-loss-adverse-inventory-root-cause-audit/flip-policy-counterfactual.rows.json`
- counterfactualRowsCsv: `docs/research/gates/gate79/artifacts/gate79-flip-loss-adverse-inventory-root-cause-audit/flip-policy-counterfactual.rows.csv`
- fullyHedgedBenchmarkRowsJson: `docs/research/gates/gate79/artifacts/gate79-flip-loss-adverse-inventory-root-cause-audit/fully-hedged-benchmark.rows.json`
- fullyHedgedBenchmarkRowsCsv: `docs/research/gates/gate79/artifacts/gate79-flip-loss-adverse-inventory-root-cause-audit/fully-hedged-benchmark.rows.csv`
- returnTargetGapRowsJson: `docs/research/gates/gate79/artifacts/gate79-flip-loss-adverse-inventory-root-cause-audit/return-target-gap.rows.json`
- returnTargetGapRowsCsv: `docs/research/gates/gate79/artifacts/gate79-flip-loss-adverse-inventory-root-cause-audit/return-target-gap.rows.csv`
- decisionRowsJson: `docs/research/gates/gate79/artifacts/gate79-flip-loss-adverse-inventory-root-cause-audit/final-decision-table.rows.json`
- decisionRowsCsv: `docs/research/gates/gate79/artifacts/gate79-flip-loss-adverse-inventory-root-cause-audit/final-decision-table.rows.csv`
- directAnswerRowsJson: `docs/research/gates/gate79/artifacts/gate79-flip-loss-adverse-inventory-root-cause-audit/direct-answers.rows.json`
- directAnswerRowsCsv: `docs/research/gates/gate79/artifacts/gate79-flip-loss-adverse-inventory-root-cause-audit/direct-answers.rows.csv`
- commandReceipt: `docs/research/gates/gate79/artifacts/gate79-flip-loss-adverse-inventory-root-cause-audit/command-receipt.json`
- summaryJson: `docs/research/gates/gate79/artifacts/gate79-flip-loss-adverse-inventory-root-cause-audit/gate79-summary.json`
- shaIdentity: `docs/research/gates/gate79/artifacts/gate79-flip-loss-adverse-inventory-root-cause-audit/gate79-sha256.txt`
- report: `docs/research/gates/gate79/GATE79_FLIP_LOSS_ADVERSE_INVENTORY_ROOT_CAUSE_AUDIT_2026-06-30.md`

## Stop Line

Gate 79 is forensic evidence only. Do not promote, freeze, start costs, risk, pair pruning, AUDNZD exclusion, MT5/live, app/runtime, retuning, or source mutation unless Freedom explicitly opens the next scope.
