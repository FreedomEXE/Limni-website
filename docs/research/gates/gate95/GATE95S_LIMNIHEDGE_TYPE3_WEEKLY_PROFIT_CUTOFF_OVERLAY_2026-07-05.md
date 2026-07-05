# Gate 95S LimniHedge Type 3 Weekly Profit Cutoff Overlay

Date: 2026-07-05

Verdict: `FAIL_GATE95S_WEEKLY_CUTOFF_NO_IMPROVED_ROW`

## Scope

Gate 95S is a bounded lifecycle overlay on the existing Gate 95 OOS trade ledger for `2025-01-01T00:00:00.000Z..2026-05-31T23:59:59.999Z`. It uses the Gate 95R corrected actual-USD accounting helper, does not rerun entries, does not run 2019-2024, does not mutate MT5, and does not add Candidate B, Katarakti, LRMG, Q, Triangle, new signals, or optimization.

Cutoff timezone is explicit: `America/New_York`. At each Friday cutoff, an open trade is closed only when the corrected marked net passes the condition. The mark price is the latest available Gate 74B raw path price at or before the cutoff timestamp. Losses are carried forward.

## Baseline Corrected Rows

| variant_id | corrected_closed_plus_marked_net_actual | corrected_profit_factor_closed_plus_marked | terminal_inventory_net_loss_share_of_closed_net | open_inventory_count | top_pair_contribution_pct | top_3_pair_contribution_pct | stress_double_commission_net | stress_slippage_0_1_net |
|---|---|---|---|---|---|---|---|---|
| adr_event_0_025_type3_long_only | 241798.06 | 3.386761 | 0.293841 | 2933 | 15.921975 | 34.452206 | 229175.1 | 240300.04 |
| adr_event_0_05_type3_long_only | 21203.43 | 2.085265 | 0.47848 | 369 | 47.404787 | 90.979609 | 19955.75 | 21022.57 |
| adr_event_0_075_type3_long_only | 11589.14 | 6.301022 | 0.138387 | 118 | 39.790702 | 92.126505 | 11222.2 | 11530.56 |
| time_h1_type3_long_only | 727.33 | 1.344827 | 0.734579 | 53 | 154.689911 | 174.720691 | 651.17 | 713.69 |

## Primary Overlay Rows

| variant_id | cutoff_hour_ny | profit_condition | corrected_closed_plus_marked_net_actual | corrected_profit_factor_closed_plus_marked | max_month_end_marked_dd_actual | terminal_inventory_net_actual | terminal_inventory_loss_share_of_closed_net | terminal_inventory_net_loss_share_of_closed_net | open_inventory_count | weekly_cutoff_closures_count | carried_loss_count | avg_hold_reduction_hours | worst_month | top_pair_contribution_pct | top_3_pair_contribution_pct | stress_double_commission_net | stress_slippage_0_1_net | decision_improved_row | decision_reason |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| adr_event_0_025_type3_long_only | 12 | corrected_marked_net_gt_0 | 231093.43 | 3.443697 | -4102.68 | -93882.98 | 0.290997 | 0.288892 | 2830 | 6886 | 126365 | 16.976868 | 2025-09 | 16.116317 | 34.294439 | 218470.47 | 229595.4 | false | 0_025_terminal_inventory_net_loss_share_not_below_25pct_closed_net;gate95r_failure_reason_not_fixed;concentration_worse_or_missing |
| adr_event_0_025_type3_long_only | 14 | corrected_marked_net_gt_0 | 231093.43 | 3.443697 | -4102.68 | -93882.98 | 0.290997 | 0.288892 | 2830 | 6886 | 126365 | 16.824124 | 2025-09 | 16.116317 | 34.294439 | 218470.47 | 229595.4 | false | 0_025_terminal_inventory_net_loss_share_not_below_25pct_closed_net;gate95r_failure_reason_not_fixed;concentration_worse_or_missing |
| adr_event_0_025_type3_long_only | 16 | corrected_marked_net_gt_0 | 231093.43 | 3.443697 | -4102.68 | -93882.98 | 0.290997 | 0.288892 | 2830 | 6886 | 126365 | 16.67138 | 2025-09 | 16.116317 | 34.294439 | 218470.47 | 229595.4 | false | 0_025_terminal_inventory_net_loss_share_not_below_25pct_closed_net;gate95r_failure_reason_not_fixed;concentration_worse_or_missing |
| adr_event_0_025_type3_long_only | 18 | corrected_marked_net_gt_0 | 231093.43 | 3.443697 | -4102.68 | -93882.98 | 0.290997 | 0.288892 | 2830 | 6886 | 126365 | 16.518637 | 2025-09 | 16.116317 | 34.294439 | 218470.47 | 229595.4 | false | 0_025_terminal_inventory_net_loss_share_not_below_25pct_closed_net;gate95r_failure_reason_not_fixed;concentration_worse_or_missing |
| adr_event_0_025_type3_long_only | 12 | corrected_marked_net_gt_1x_commission | 232764.67 | 3.458201 | -4278.95 | -94004.88 | 0.289773 | 0.287679 | 2836 | 6478 | 126933 | 15.469225 | 2025-09 | 16.03864 | 34.21674 | 220141.71 | 231266.65 | false | 0_025_terminal_inventory_net_loss_share_not_below_25pct_closed_net;gate95r_failure_reason_not_fixed;concentration_worse_or_missing |
| adr_event_0_025_type3_long_only | 14 | corrected_marked_net_gt_1x_commission | 232764.67 | 3.458201 | -4278.95 | -94004.88 | 0.289773 | 0.287679 | 2836 | 6478 | 126933 | 15.325531 | 2025-09 | 16.03864 | 34.21674 | 220141.71 | 231266.65 | false | 0_025_terminal_inventory_net_loss_share_not_below_25pct_closed_net;gate95r_failure_reason_not_fixed;concentration_worse_or_missing |
| adr_event_0_025_type3_long_only | 16 | corrected_marked_net_gt_1x_commission | 232764.67 | 3.458201 | -4278.95 | -94004.88 | 0.289773 | 0.287679 | 2836 | 6478 | 126933 | 15.181838 | 2025-09 | 16.03864 | 34.21674 | 220141.71 | 231266.65 | false | 0_025_terminal_inventory_net_loss_share_not_below_25pct_closed_net;gate95r_failure_reason_not_fixed;concentration_worse_or_missing |
| adr_event_0_025_type3_long_only | 18 | corrected_marked_net_gt_1x_commission | 232764.67 | 3.458201 | -4278.95 | -94004.88 | 0.289773 | 0.287679 | 2836 | 6478 | 126933 | 15.038144 | 2025-09 | 16.03864 | 34.21674 | 220141.71 | 231266.65 | false | 0_025_terminal_inventory_net_loss_share_not_below_25pct_closed_net;gate95r_failure_reason_not_fixed;concentration_worse_or_missing |
| adr_event_0_05_type3_long_only | 12 | corrected_marked_net_gt_0 | 19799.48 | 2.064199 | -4623.87 | -18525.58 | 0.485454 | 0.48338 | 354 | 1054 | 17650 | 25.353769 | 2025-06 | 47.55403 | 92.504596 | 18551.8 | 19618.62 | false | 0_05_terminal_inventory_not_materially_improved;0_05_pair_concentration_not_materially_improved;gate95r_failure_reason_not_fixed;concentration_worse_or_missing |
| adr_event_0_05_type3_long_only | 14 | corrected_marked_net_gt_0 | 19799.48 | 2.064199 | -4623.87 | -18525.58 | 0.485454 | 0.48338 | 354 | 1054 | 17650 | 25.117234 | 2025-06 | 47.55403 | 92.504596 | 18551.8 | 19618.62 | false | 0_05_terminal_inventory_not_materially_improved;0_05_pair_concentration_not_materially_improved;gate95r_failure_reason_not_fixed;concentration_worse_or_missing |
| adr_event_0_05_type3_long_only | 16 | corrected_marked_net_gt_0 | 19799.48 | 2.064199 | -4623.87 | -18525.58 | 0.485454 | 0.48338 | 354 | 1054 | 17650 | 24.880699 | 2025-06 | 47.55403 | 92.504596 | 18551.8 | 19618.62 | false | 0_05_terminal_inventory_not_materially_improved;0_05_pair_concentration_not_materially_improved;gate95r_failure_reason_not_fixed;concentration_worse_or_missing |
| adr_event_0_05_type3_long_only | 18 | corrected_marked_net_gt_0 | 19799.48 | 2.064199 | -4623.87 | -18525.58 | 0.485454 | 0.48338 | 354 | 1054 | 17650 | 24.644164 | 2025-06 | 47.55403 | 92.504596 | 18551.8 | 19618.62 | false | 0_05_terminal_inventory_not_materially_improved;0_05_pair_concentration_not_materially_improved;gate95r_failure_reason_not_fixed;concentration_worse_or_missing |
| adr_event_0_05_type3_long_only | 12 | corrected_marked_net_gt_1x_commission | 19902.29 | 2.06571 | -4617.56 | -18595.67 | 0.485094 | 0.48303 | 356 | 1011 | 17720 | 23.498965 | 2025-06 | 47.4451 | 92.301054 | 18654.61 | 19721.42 | false | 0_05_terminal_inventory_not_materially_improved;0_05_pair_concentration_not_materially_improved;gate95r_failure_reason_not_fixed;concentration_worse_or_missing |
| adr_event_0_05_type3_long_only | 14 | corrected_marked_net_gt_1x_commission | 19902.29 | 2.06571 | -4617.56 | -18595.67 | 0.485094 | 0.48303 | 356 | 1011 | 17720 | 23.27208 | 2025-06 | 47.4451 | 92.301054 | 18654.61 | 19721.42 | false | 0_05_terminal_inventory_not_materially_improved;0_05_pair_concentration_not_materially_improved;gate95r_failure_reason_not_fixed;concentration_worse_or_missing |
| adr_event_0_05_type3_long_only | 16 | corrected_marked_net_gt_1x_commission | 19902.29 | 2.06571 | -4617.56 | -18595.67 | 0.485094 | 0.48303 | 356 | 1011 | 17720 | 23.045195 | 2025-06 | 47.4451 | 92.301054 | 18654.61 | 19721.42 | false | 0_05_terminal_inventory_not_materially_improved;0_05_pair_concentration_not_materially_improved;gate95r_failure_reason_not_fixed;concentration_worse_or_missing |
| adr_event_0_05_type3_long_only | 18 | corrected_marked_net_gt_1x_commission | 19902.29 | 2.06571 | -4617.56 | -18595.67 | 0.485094 | 0.48303 | 356 | 1011 | 17720 | 22.81831 | 2025-06 | 47.4451 | 92.301054 | 18654.61 | 19721.42 | false | 0_05_terminal_inventory_not_materially_improved;0_05_pair_concentration_not_materially_improved;gate95r_failure_reason_not_fixed;concentration_worse_or_missing |

## Reference And Control Rows

| variant_id | cutoff_hour_ny | profit_condition | corrected_closed_plus_marked_net_actual | corrected_profit_factor_closed_plus_marked | max_month_end_marked_dd_actual | terminal_inventory_net_loss_share_of_closed_net | open_inventory_count | weekly_cutoff_closures_count | carried_loss_count | avg_hold_reduction_hours | top_pair_contribution_pct | top_3_pair_contribution_pct | stress_double_commission_net | stress_slippage_0_1_net |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| adr_event_0_075_type3_long_only | 12 | corrected_marked_net_gt_0 | 10703.65 | 6.080628 | -1000.04 | 0.143103 | 114 | 405 | 4503 | 29.842876 | 40.127117 | 91.688819 | 10336.71 | 10645.06 |
| adr_event_0_075_type3_long_only | 14 | corrected_marked_net_gt_0 | 10703.65 | 6.080628 | -1000.04 | 0.143103 | 114 | 405 | 4503 | 29.533833 | 40.127117 | 91.688819 | 10336.71 | 10645.06 |
| adr_event_0_075_type3_long_only | 16 | corrected_marked_net_gt_0 | 10703.65 | 6.080628 | -1000.04 | 0.143103 | 114 | 405 | 4503 | 29.224791 | 40.127117 | 91.688819 | 10336.71 | 10645.06 |
| adr_event_0_075_type3_long_only | 18 | corrected_marked_net_gt_0 | 10703.65 | 6.080628 | -1000.04 | 0.143103 | 114 | 405 | 4503 | 28.915749 | 40.127117 | 91.688819 | 10336.71 | 10645.06 |
| adr_event_0_075_type3_long_only | 12 | corrected_marked_net_gt_1x_commission | 10728.79 | 6.015562 | -1049.31 | 0.145025 | 115 | 390 | 4565 | 25.137817 | 40.204096 | 91.708292 | 10361.85 | 10670.2 |
| adr_event_0_075_type3_long_only | 14 | corrected_marked_net_gt_1x_commission | 10728.79 | 6.015562 | -1049.31 | 0.145025 | 115 | 390 | 4565 | 24.840221 | 40.204096 | 91.708292 | 10361.85 | 10670.2 |
| adr_event_0_075_type3_long_only | 16 | corrected_marked_net_gt_1x_commission | 10728.79 | 6.015562 | -1049.31 | 0.145025 | 115 | 390 | 4565 | 24.542624 | 40.204096 | 91.708292 | 10361.85 | 10670.2 |
| adr_event_0_075_type3_long_only | 18 | corrected_marked_net_gt_1x_commission | 10728.79 | 6.015562 | -1049.31 | 0.145025 | 115 | 390 | 4565 | 24.245028 | 40.204096 | 91.708292 | 10361.85 | 10670.2 |
| time_h1_type3_long_only | 12 | corrected_marked_net_gt_0 | 731.34 | 1.390041 | -829.3 | 0.708637 | 51 | 88 | 1655 | 49.123081 | 138.147874 | 148.024662 | 655.18 | 717.71 |
| time_h1_type3_long_only | 14 | corrected_marked_net_gt_0 | 731.34 | 1.390041 | -829.3 | 0.708637 | 51 | 88 | 1655 | 48.799552 | 138.147874 | 148.024662 | 655.18 | 717.71 |
| time_h1_type3_long_only | 16 | corrected_marked_net_gt_0 | 731.34 | 1.390041 | -829.3 | 0.708637 | 51 | 88 | 1655 | 48.476022 | 138.147874 | 148.024662 | 655.18 | 717.71 |
| time_h1_type3_long_only | 18 | corrected_marked_net_gt_0 | 731.34 | 1.390041 | -829.3 | 0.708637 | 51 | 88 | 1655 | 48.152493 | 138.147874 | 148.024662 | 655.18 | 717.71 |
| time_h1_type3_long_only | 12 | corrected_marked_net_gt_1x_commission | 742.86 | 1.396185 | -821.12 | 0.7054 | 51 | 85 | 1655 | 48.586319 | 136.932712 | 147.279925 | 666.7 | 729.23 |
| time_h1_type3_long_only | 14 | corrected_marked_net_gt_1x_commission | 742.86 | 1.396185 | -821.12 | 0.7054 | 51 | 85 | 1655 | 48.273819 | 136.932712 | 147.279925 | 666.7 | 729.23 |
| time_h1_type3_long_only | 16 | corrected_marked_net_gt_1x_commission | 742.86 | 1.396185 | -821.12 | 0.7054 | 51 | 85 | 1655 | 47.961319 | 136.932712 | 147.279925 | 666.7 | 729.23 |
| time_h1_type3_long_only | 18 | corrected_marked_net_gt_1x_commission | 742.86 | 1.396185 | -821.12 | 0.7054 | 51 | 85 | 1655 | 47.648819 | 136.932712 | 147.279925 | 666.7 | 729.23 |

## Decision Rows

| variant_id | best_cutoff_hour_ny | best_profit_condition | best_closed_plus_marked_net_actual | best_terminal_inventory_net_loss_share_of_closed_net | best_open_inventory_count | best_top_pair_contribution_pct | best_top_3_pair_contribution_pct | best_stress_double_commission_net | best_stress_slippage_0_1_net | decision_improved_row | decision_reason |
|---|---|---|---|---|---|---|---|---|---|---|---|
| adr_event_0_025_type3_long_only | 12 | corrected_marked_net_gt_1x_commission | 232764.67 | 0.287679 | 2836 | 16.03864 | 34.21674 | 220141.71 | 231266.65 | false | 0_025_terminal_inventory_net_loss_share_not_below_25pct_closed_net;gate95r_failure_reason_not_fixed;concentration_worse_or_missing |
| adr_event_0_05_type3_long_only | 12 | corrected_marked_net_gt_1x_commission | 19902.29 | 0.48303 | 356 | 47.4451 | 92.301054 | 18654.61 | 19721.42 | false | 0_05_terminal_inventory_not_materially_improved;0_05_pair_concentration_not_materially_improved;gate95r_failure_reason_not_fixed;concentration_worse_or_missing |
| adr_event_0_075_type3_long_only | 12 | corrected_marked_net_gt_1x_commission | 10728.79 | 0.145025 | 115 | 40.204096 | 91.708292 | 10361.85 | 10670.2 | false | reference_or_control_row |
| time_h1_type3_long_only | 12 | corrected_marked_net_gt_1x_commission | 742.86 | 0.7054 | 51 | 136.932712 | 147.279925 | 666.7 | 729.23 | false | reference_or_control_row |

## Validation

Validation failures: `0`

| check | value | expected | passed |
|---|---|---|---|
| gate95_original_accounting_invalidated | docs/research/gates/gate95/GATE95_ERRATUM_INVALIDATED_BY_GATE96A_ACCOUNTING_2026-07-04.md | Gate95 original accounting not used | true |
| corrected_accounting_helper_used | engine/scripts/verification/limnihedge-corrected-accounting.ts::correctedFxPnl | corrected actual-USD helper | true |
| old_gate95_modeled_conversion_used | false | false | true |
| cutoff_timezone_explicit | America/New_York | America/New_York | true |
| same_gate95_oos_window | 2025-01-01T00:00:00.000Z..2026-05-31T23:59:59.999Z | 2025-01-01T00:00:00.000Z..2026-05-31T23:59:59.999Z | true |
| no_2019_2024_rerun | 2025-01-01T00:00:00.000Z | starts 2025-01-01 | true |
| gate95_oos_validation_failures | 0 | 0 | true |
| gate95r_validation_failures | 0 | 0 | true |
| target_variant_count | 4 | 4 | true |
| matrix_rows | 32 | 4 variants x 4 cutoff hours x 2 profit conditions | true |
| source_trade_count_preserved_no_new_entries | true | true | true |
| closed_plus_marked_equity_present | 32 | 32 | true |
| cost_stress_present | 32 | 32 | true |
| baseline_reconciles_to_gate95r_corrected_rows | 0 | <= 1.00 USD max target-row delta | true |
| price_bundle_id | gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953 | gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953 | true |
| mt5_mutated | false | false | true |
| new_signals_introduced | false | false | true |

## Interpretation Boundary

This is a dumb weekly profit-cutoff overlay only. A row is considered improved only if it fixes the Gate 95R failure reason without worse concentration or cost fragility. For `adr_event_0_025_type3_long_only`, terminal inventory net-loss share must fall below `25%` of closed net. For `adr_event_0_05_type3_long_only`, terminal inventory and pair concentration must both improve materially.

## Artifacts

- config: `docs/research/gates/gate95/artifacts/limnihedge-type3-weekly-profit-cutoff-overlay/gate95s-config.json`
- baselineJson: `docs/research/gates/gate95/artifacts/limnihedge-type3-weekly-profit-cutoff-overlay/baseline-corrected-summary.rows.json`
- baselineCsv: `docs/research/gates/gate95/artifacts/limnihedge-type3-weekly-profit-cutoff-overlay/baseline-corrected-summary.rows.csv`
- matrixJson: `docs/research/gates/gate95/artifacts/limnihedge-type3-weekly-profit-cutoff-overlay/weekly-cutoff-matrix.rows.json`
- matrixCsv: `docs/research/gates/gate95/artifacts/limnihedge-type3-weekly-profit-cutoff-overlay/weekly-cutoff-matrix.rows.csv`
- decisionJson: `docs/research/gates/gate95/artifacts/limnihedge-type3-weekly-profit-cutoff-overlay/weekly-cutoff-decision.rows.json`
- decisionCsv: `docs/research/gates/gate95/artifacts/limnihedge-type3-weekly-profit-cutoff-overlay/weekly-cutoff-decision.rows.csv`
- outcomeJson: `docs/research/gates/gate95/artifacts/limnihedge-type3-weekly-profit-cutoff-overlay/weekly-cutoff-closure-and-terminal.rows.json`
- outcomeCsv: `docs/research/gates/gate95/artifacts/limnihedge-type3-weekly-profit-cutoff-overlay/weekly-cutoff-closure-and-terminal.rows.csv`
- validationJson: `docs/research/gates/gate95/artifacts/limnihedge-type3-weekly-profit-cutoff-overlay/validation.rows.json`
- validationCsv: `docs/research/gates/gate95/artifacts/limnihedge-type3-weekly-profit-cutoff-overlay/validation.rows.csv`
- commandReceipt: `docs/research/gates/gate95/artifacts/limnihedge-type3-weekly-profit-cutoff-overlay/command-receipt.json`
- runSummary: `docs/research/gates/gate95/artifacts/limnihedge-type3-weekly-profit-cutoff-overlay/gate95s-run-summary.json`
- shaManifest: `docs/research/gates/gate95/artifacts/limnihedge-type3-weekly-profit-cutoff-overlay/gate95s-sha256.txt`
- report: `docs/research/gates/gate95/GATE95S_LIMNIHEDGE_TYPE3_WEEKLY_PROFIT_CUTOFF_OVERLAY_2026-07-05.md`
