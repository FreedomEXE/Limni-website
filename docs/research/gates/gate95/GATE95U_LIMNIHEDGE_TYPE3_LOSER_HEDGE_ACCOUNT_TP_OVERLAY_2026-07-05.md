# Gate 95U LimniHedge Type 3 Loser Hedge Account TP Overlay

Date: 2026-07-05

Verdict: `FAIL_GATE95U_HEDGE_ACCOUNT_TP_NO_IMPROVED_ROW`

## Scope

Gate 95U is a bounded repo-side hedge lifecycle overlay on the existing Gate 95 OOS trade ledger for `2025-01-01T00:00:00.000Z..2026-05-31T23:59:59.999Z`. It uses the Gate 95R corrected actual-USD accounting helper, does not rerun entries, does not run 2019-2024, does not mutate MT5, and does not add Candidate B, Katarakti, LRMG, Q, Triangle, new signals, or optimization.

Observer time is explicit: `16:00 America/New_York`. At the observer, an unhedged red original trade receives a same-lot opposite hedge when the trigger condition is met. If corrected account-cycle marked net reaches the account TP, the whole open basket is flushed: originals, hedges, and unhedged opens.

## Baseline Corrected Rows

| variant_id | corrected_closed_plus_marked_net_actual | corrected_profit_factor_closed_plus_marked | terminal_inventory_net_loss_share_of_closed_net | open_inventory_count | top_pair_contribution_pct | top_3_pair_contribution_pct | stress_double_commission_net | stress_slippage_0_1_net | baseline_max_gross_lots |
|---|---|---|---|---|---|---|---|---|---|
| adr_event_0_025_type3_long_only | 241798.06 | 3.386761 | 0.293841 | 2933 | 15.921975 | 34.452206 | 229175.1 | 240300.04 | 51.56 |
| adr_event_0_05_type3_long_only | 21203.43 | 2.085265 | 0.47848 | 369 | 47.404787 | 90.979609 | 19955.75 | 21022.57 | 9.02 |
| adr_event_0_075_type3_long_only | 11589.14 | 6.301022 | 0.138387 | 118 | 39.790702 | 92.126505 | 11222.2 | 11530.56 | 4.16 |
| time_h1_type3_long_only | 727.33 | 1.344827 | 0.734579 | 53 | 154.689911 | 174.720691 | 651.17 | 713.69 | 1.1 |

## Primary Hedge Matrix

| variant_id | hedge_trigger | account_tp_usd | corrected_closed_plus_marked_net_actual | corrected_profit_factor_closed_plus_marked | max_month_end_marked_dd_actual | terminal_inventory_net_loss_share_of_closed_net | terminal_open_original_count | terminal_open_hedge_count | hedge_open_count | account_tp_flush_count | max_gross_lot_ratio | top_pair_contribution_pct | top_3_pair_contribution_pct | stress_double_commission_net | stress_slippage_0_1_net | decision_improved_row | decision_reason |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| adr_event_0_025_type3_long_only | corrected_marked_net_lt_0 | 25 | -5290.38 | 0.977265 | -7651.59 | 2.348694 | 1681 | 1487 | 25375 | 11 | 1.768037 |  |  | -16658.1 | -6658.43 | false | corrected_closed_plus_marked_net_not_positive;terminal_inventory_net_loss_share_not_below_25pct_closed_net;max_gross_lot_ratio_gt_guard;concentration_worse_or_missing;cost_fragility_worse_or_missing;gate95r_failure_reason_not_fixed |
| adr_event_0_025_type3_long_only | corrected_marked_net_lt_0 | 50 | -5290.38 | 0.977265 | -7651.59 | 2.348694 | 1681 | 1487 | 25375 | 11 | 1.768037 |  |  | -16658.1 | -6658.43 | false | corrected_closed_plus_marked_net_not_positive;terminal_inventory_net_loss_share_not_below_25pct_closed_net;max_gross_lot_ratio_gt_guard;concentration_worse_or_missing;cost_fragility_worse_or_missing;gate95r_failure_reason_not_fixed |
| adr_event_0_025_type3_long_only | corrected_marked_net_lt_0 | 100 | -5240.89 | 0.977492 | -7651.59 | 2.319426 | 1681 | 1487 | 25423 | 9 | 1.768037 |  |  | -16615.33 | -6609.98 | false | corrected_closed_plus_marked_net_not_positive;terminal_inventory_net_loss_share_not_below_25pct_closed_net;max_gross_lot_ratio_gt_guard;concentration_worse_or_missing;cost_fragility_worse_or_missing;gate95r_failure_reason_not_fixed |
| adr_event_0_025_type3_long_only | corrected_marked_net_lt_0 | 250 | -5228.39 | 0.978182 | -7743 | 2.179067 | 1769 | 1575 | 25493 | 5 | 1.889837 |  |  | -16612.63 | -6599.85 | false | corrected_closed_plus_marked_net_not_positive;terminal_inventory_net_loss_share_not_below_25pct_closed_net;max_gross_lot_ratio_gt_guard;concentration_worse_or_missing;cost_fragility_worse_or_missing;gate95r_failure_reason_not_fixed |
| adr_event_0_025_type3_long_only | corrected_marked_net_lt_minus_1x_commission | 25 | -4718.86 | 0.979661 | -7274.41 | 2.026601 | 1681 | 1483 | 24843 | 11 | 1.766486 |  |  | -16012.1 | -6078.43 | false | corrected_closed_plus_marked_net_not_positive;terminal_inventory_net_loss_share_not_below_25pct_closed_net;max_gross_lot_ratio_gt_guard;concentration_worse_or_missing;cost_fragility_worse_or_missing;gate95r_failure_reason_not_fixed |
| adr_event_0_025_type3_long_only | corrected_marked_net_lt_minus_1x_commission | 50 | -4718.86 | 0.979661 | -7274.41 | 2.026601 | 1681 | 1483 | 24843 | 11 | 1.766486 |  |  | -16012.1 | -6078.43 | false | corrected_closed_plus_marked_net_not_positive;terminal_inventory_net_loss_share_not_below_25pct_closed_net;max_gross_lot_ratio_gt_guard;concentration_worse_or_missing;cost_fragility_worse_or_missing;gate95r_failure_reason_not_fixed |
| adr_event_0_025_type3_long_only | corrected_marked_net_lt_minus_1x_commission | 100 | -4654 | 0.979952 | -7274.41 | 1.998403 | 1681 | 1483 | 24887 | 9 | 1.766486 |  |  | -15953.4 | -6014.53 | false | corrected_closed_plus_marked_net_not_positive;terminal_inventory_net_loss_share_not_below_25pct_closed_net;max_gross_lot_ratio_gt_guard;concentration_worse_or_missing;cost_fragility_worse_or_missing;gate95r_failure_reason_not_fixed |
| adr_event_0_025_type3_long_only | corrected_marked_net_lt_minus_1x_commission | 250 | -4576.85 | 0.980409 | -7275.17 | 1.965868 | 1681 | 1483 | 24923 | 6 | 1.766486 |  |  | -15881.29 | -5938.12 | false | corrected_closed_plus_marked_net_not_positive;terminal_inventory_net_loss_share_not_below_25pct_closed_net;max_gross_lot_ratio_gt_guard;concentration_worse_or_missing;cost_fragility_worse_or_missing;gate95r_failure_reason_not_fixed |
| adr_event_0_05_type3_long_only | corrected_marked_net_lt_0 | 25 | -1189.64 | 0.970099 | -2193.15 | 3.075999 | 288 | 273 | 3611 | 1 | 1.886918 |  |  | -2663 | -1408.98 | false | corrected_closed_plus_marked_net_not_positive;terminal_inventory_net_loss_share_not_below_25pct_closed_net;max_gross_lot_ratio_gt_guard;concentration_worse_or_missing;cost_fragility_worse_or_missing;0_05_terminal_inventory_not_materially_improved;0_05_pair_concentration_not_materially_improved;gate95r_failure_reason_not_fixed |
| adr_event_0_05_type3_long_only | corrected_marked_net_lt_0 | 50 | -1189.64 | 0.970099 | -2193.15 | 3.075999 | 288 | 273 | 3611 | 1 | 1.886918 |  |  | -2663 | -1408.98 | false | corrected_closed_plus_marked_net_not_positive;terminal_inventory_net_loss_share_not_below_25pct_closed_net;max_gross_lot_ratio_gt_guard;concentration_worse_or_missing;cost_fragility_worse_or_missing;0_05_terminal_inventory_not_materially_improved;0_05_pair_concentration_not_materially_improved;gate95r_failure_reason_not_fixed |
| adr_event_0_05_type3_long_only | corrected_marked_net_lt_0 | 100 | -1189.64 | 0.970099 | -2193.15 | 3.075999 | 288 | 273 | 3611 | 1 | 1.886918 |  |  | -2663 | -1408.98 | false | corrected_closed_plus_marked_net_not_positive;terminal_inventory_net_loss_share_not_below_25pct_closed_net;max_gross_lot_ratio_gt_guard;concentration_worse_or_missing;cost_fragility_worse_or_missing;0_05_terminal_inventory_not_materially_improved;0_05_pair_concentration_not_materially_improved;gate95r_failure_reason_not_fixed |
| adr_event_0_05_type3_long_only | corrected_marked_net_lt_0 | 250 | -1189.64 | 0.970099 | -2193.15 | 3.075999 | 288 | 273 | 3611 | 1 | 1.886918 |  |  | -2663 | -1408.98 | false | corrected_closed_plus_marked_net_not_positive;terminal_inventory_net_loss_share_not_below_25pct_closed_net;max_gross_lot_ratio_gt_guard;concentration_worse_or_missing;cost_fragility_worse_or_missing;0_05_terminal_inventory_not_materially_improved;0_05_pair_concentration_not_materially_improved;gate95r_failure_reason_not_fixed |
| adr_event_0_05_type3_long_only | corrected_marked_net_lt_minus_1x_commission | 25 | -1214.9 | 0.969416 | -2214.21 | 2.901805 | 288 | 272 | 3542 | 1 | 1.880266 |  |  | -2678.6 | -1432.86 | false | corrected_closed_plus_marked_net_not_positive;terminal_inventory_net_loss_share_not_below_25pct_closed_net;max_gross_lot_ratio_gt_guard;concentration_worse_or_missing;cost_fragility_worse_or_missing;0_05_terminal_inventory_not_materially_improved;0_05_pair_concentration_not_materially_improved;gate95r_failure_reason_not_fixed |
| adr_event_0_05_type3_long_only | corrected_marked_net_lt_minus_1x_commission | 50 | -1214.9 | 0.969416 | -2214.21 | 2.901805 | 288 | 272 | 3542 | 1 | 1.880266 |  |  | -2678.6 | -1432.86 | false | corrected_closed_plus_marked_net_not_positive;terminal_inventory_net_loss_share_not_below_25pct_closed_net;max_gross_lot_ratio_gt_guard;concentration_worse_or_missing;cost_fragility_worse_or_missing;0_05_terminal_inventory_not_materially_improved;0_05_pair_concentration_not_materially_improved;gate95r_failure_reason_not_fixed |
| adr_event_0_05_type3_long_only | corrected_marked_net_lt_minus_1x_commission | 100 | -1214.9 | 0.969416 | -2214.21 | 2.901805 | 288 | 272 | 3542 | 1 | 1.880266 |  |  | -2678.6 | -1432.86 | false | corrected_closed_plus_marked_net_not_positive;terminal_inventory_net_loss_share_not_below_25pct_closed_net;max_gross_lot_ratio_gt_guard;concentration_worse_or_missing;cost_fragility_worse_or_missing;0_05_terminal_inventory_not_materially_improved;0_05_pair_concentration_not_materially_improved;gate95r_failure_reason_not_fixed |
| adr_event_0_05_type3_long_only | corrected_marked_net_lt_minus_1x_commission | 250 | -1214.9 | 0.969416 | -2214.21 | 2.901805 | 288 | 272 | 3542 | 1 | 1.880266 |  |  | -2678.6 | -1432.86 | false | corrected_closed_plus_marked_net_not_positive;terminal_inventory_net_loss_share_not_below_25pct_closed_net;max_gross_lot_ratio_gt_guard;concentration_worse_or_missing;cost_fragility_worse_or_missing;0_05_terminal_inventory_not_materially_improved;0_05_pair_concentration_not_materially_improved;gate95r_failure_reason_not_fixed |

## Reference And Control Rows

| variant_id | hedge_trigger | account_tp_usd | corrected_closed_plus_marked_net_actual | corrected_profit_factor_closed_plus_marked | terminal_inventory_net_loss_share_of_closed_net | terminal_open_original_count | terminal_open_hedge_count | hedge_open_count | account_tp_flush_count | max_gross_lot_ratio | top_pair_contribution_pct | top_3_pair_contribution_pct | stress_double_commission_net | stress_slippage_0_1_net |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| adr_event_0_075_type3_long_only | corrected_marked_net_lt_0 | 25 | -212.85 | 0.982139 | 1.940076 | 113 | 103 | 1191 | 1 | 1.913462 |  |  | -686.61 | -289.56 |
| adr_event_0_075_type3_long_only | corrected_marked_net_lt_0 | 50 | -212.85 | 0.982139 | 1.940076 | 113 | 103 | 1191 | 1 | 1.913462 |  |  | -686.61 | -289.56 |
| adr_event_0_075_type3_long_only | corrected_marked_net_lt_0 | 100 | -212.85 | 0.982139 | 1.940076 | 113 | 103 | 1191 | 1 | 1.913462 |  |  | -686.61 | -289.56 |
| adr_event_0_075_type3_long_only | corrected_marked_net_lt_0 | 250 | -214.99 | 0.982002 | 1.958594 | 113 | 103 | 1196 | 0 | 1.913462 |  |  | -689.45 | -291.82 |
| adr_event_0_075_type3_long_only | corrected_marked_net_lt_minus_1x_commission | 25 | -237.38 | 0.980111 | 2.156746 | 113 | 102 | 1171 | 1 | 1.913462 |  |  | -708.34 | -313.63 |
| adr_event_0_075_type3_long_only | corrected_marked_net_lt_minus_1x_commission | 50 | -237.38 | 0.980111 | 2.156746 | 113 | 102 | 1171 | 1 | 1.913462 |  |  | -708.34 | -313.63 |
| adr_event_0_075_type3_long_only | corrected_marked_net_lt_minus_1x_commission | 100 | -237.38 | 0.980111 | 2.156746 | 113 | 102 | 1171 | 1 | 1.913462 |  |  | -708.34 | -313.63 |
| adr_event_0_075_type3_long_only | corrected_marked_net_lt_minus_1x_commission | 250 | -239.52 | 0.979979 | 2.17948 | 113 | 102 | 1176 | 0 | 1.913462 |  |  | -711.18 | -315.88 |
| time_h1_type3_long_only | corrected_marked_net_lt_0 | 25 | -118.3 | 0.974186 | 2.631061 | 52 | 48 | 333 | 1 | 1.854545 |  |  | -241.08 | -140.31 |
| time_h1_type3_long_only | corrected_marked_net_lt_0 | 50 | -118.52 | 0.975188 | 2.530322 | 53 | 49 | 333 | 0 | 1.890909 |  |  | -241.3 | -140.54 |
| time_h1_type3_long_only | corrected_marked_net_lt_0 | 100 | -118.52 | 0.975188 | 2.530322 | 53 | 49 | 333 | 0 | 1.890909 |  |  | -241.3 | -140.54 |
| time_h1_type3_long_only | corrected_marked_net_lt_0 | 250 | -118.52 | 0.975188 | 2.530322 | 53 | 49 | 333 | 0 | 1.890909 |  |  | -241.3 | -140.54 |
| time_h1_type3_long_only | corrected_marked_net_lt_minus_1x_commission | 25 | -140.52 | 0.969433 | 3.336451 | 52 | 48 | 326 | 1 | 1.854545 |  |  | -262.32 | -162.35 |
| time_h1_type3_long_only | corrected_marked_net_lt_minus_1x_commission | 50 | -140.74 | 0.970625 | 3.163193 | 53 | 49 | 326 | 0 | 1.890909 |  |  | -262.54 | -162.58 |
| time_h1_type3_long_only | corrected_marked_net_lt_minus_1x_commission | 100 | -140.74 | 0.970625 | 3.163193 | 53 | 49 | 326 | 0 | 1.890909 |  |  | -262.54 | -162.58 |
| time_h1_type3_long_only | corrected_marked_net_lt_minus_1x_commission | 250 | -140.74 | 0.970625 | 3.163193 | 53 | 49 | 326 | 0 | 1.890909 |  |  | -262.54 | -162.58 |

## Decision Rows

| variant_id | best_hedge_trigger | best_account_tp_usd | best_closed_plus_marked_net_actual | best_terminal_inventory_net_loss_share_of_closed_net | best_terminal_open_original_count | best_terminal_open_hedge_count | best_account_tp_flush_count | best_max_gross_lot_ratio | best_top_pair_contribution_pct | best_top_3_pair_contribution_pct | best_stress_double_commission_net | best_stress_slippage_0_1_net | decision_improved_row | decision_reason |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| adr_event_0_025_type3_long_only | corrected_marked_net_lt_minus_1x_commission | 250 | -4576.85 | 1.965868 | 1681 | 1483 | 6 | 1.766486 |  |  | -15881.29 | -5938.12 | false | corrected_closed_plus_marked_net_not_positive;terminal_inventory_net_loss_share_not_below_25pct_closed_net;max_gross_lot_ratio_gt_guard;concentration_worse_or_missing;cost_fragility_worse_or_missing;gate95r_failure_reason_not_fixed |
| adr_event_0_05_type3_long_only | corrected_marked_net_lt_minus_1x_commission | 25 | -1214.9 | 2.901805 | 288 | 272 | 1 | 1.880266 |  |  | -2678.6 | -1432.86 | false | corrected_closed_plus_marked_net_not_positive;terminal_inventory_net_loss_share_not_below_25pct_closed_net;max_gross_lot_ratio_gt_guard;concentration_worse_or_missing;cost_fragility_worse_or_missing;0_05_terminal_inventory_not_materially_improved;0_05_pair_concentration_not_materially_improved;gate95r_failure_reason_not_fixed |
| adr_event_0_075_type3_long_only | corrected_marked_net_lt_0 | 25 | -212.85 | 1.940076 | 113 | 103 | 1 | 1.913462 |  |  | -686.61 | -289.56 | false | reference_or_control_row;corrected_closed_plus_marked_net_not_positive |
| time_h1_type3_long_only | corrected_marked_net_lt_0 | 50 | -118.52 | 2.530322 | 53 | 49 | 0 | 1.890909 |  |  | -241.3 | -140.54 | false | reference_or_control_row;corrected_closed_plus_marked_net_not_positive |

## Validation

Validation failures: `0`

| check | value | expected | passed |
|---|---|---|---|
| gate95_original_accounting_invalidated | docs/research/gates/gate95/GATE95_ERRATUM_INVALIDATED_BY_GATE96A_ACCOUNTING_2026-07-04.md | Gate95 original accounting not used | true |
| corrected_accounting_helper_used | engine/scripts/verification/limnihedge-corrected-accounting.ts::correctedFxPnl | corrected actual-USD helper | true |
| old_gate95_modeled_conversion_used | false | false | true |
| observer_timezone_explicit | America/New_York | America/New_York | true |
| same_gate95_oos_window | 2025-01-01T00:00:00.000Z..2026-05-31T23:59:59.999Z | 2025-01-01T00:00:00.000Z..2026-05-31T23:59:59.999Z | true |
| no_2019_2024_rerun | 2025-01-01T00:00:00.000Z | starts 2025-01-01 | true |
| gate95_oos_validation_failures | 0 | 0 | true |
| gate95r_validation_failures | 0 | 0 | true |
| target_variant_count | 4 | 4 | true |
| matrix_rows | 32 | 4 variants x 2 hedge triggers x 4 account TPs | true |
| source_original_entries_preserved_no_entry_rerun | true | true | true |
| hedges_are_overlay_positions_only | same-lot opposite hedges opened only by hedge trigger | no signal-generated hedge entries | true |
| closed_plus_marked_equity_present | 32 | 32 | true |
| cost_stress_present | 32 | 32 | true |
| corrected_conversion_gap_count | 0 | 0 | true |
| baseline_reconciles_to_gate95r_corrected_rows | 0 | <= 1.00 USD max target-row delta | true |
| price_bundle_id | gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953 | gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953 | true |
| mt5_mutated | false | false | true |
| new_signals_introduced | false | false | true |

## Interpretation Boundary

This is a hedge-only lifecycle overlay. A row is considered improved only if it fixes the Gate 95R terminal-inventory failure reason without worse concentration, survives cost stress, and keeps max gross lots within `1.75x` baseline. For `adr_event_0_05_type3_long_only`, terminal inventory and pair concentration must both improve materially.

## Artifacts

- config: `docs/research/gates/gate95/artifacts/limnihedge-type3-loser-hedge-account-tp-overlay/gate95u-config.json`
- baselineJson: `docs/research/gates/gate95/artifacts/limnihedge-type3-loser-hedge-account-tp-overlay/baseline-corrected-summary.rows.json`
- baselineCsv: `docs/research/gates/gate95/artifacts/limnihedge-type3-loser-hedge-account-tp-overlay/baseline-corrected-summary.rows.csv`
- matrixJson: `docs/research/gates/gate95/artifacts/limnihedge-type3-loser-hedge-account-tp-overlay/hedge-account-tp-matrix.rows.json`
- matrixCsv: `docs/research/gates/gate95/artifacts/limnihedge-type3-loser-hedge-account-tp-overlay/hedge-account-tp-matrix.rows.csv`
- decisionJson: `docs/research/gates/gate95/artifacts/limnihedge-type3-loser-hedge-account-tp-overlay/hedge-account-tp-decision.rows.json`
- decisionCsv: `docs/research/gates/gate95/artifacts/limnihedge-type3-loser-hedge-account-tp-overlay/hedge-account-tp-decision.rows.csv`
- cycleJson: `docs/research/gates/gate95/artifacts/limnihedge-type3-loser-hedge-account-tp-overlay/account-tp-cycle-flush.rows.json`
- cycleCsv: `docs/research/gates/gate95/artifacts/limnihedge-type3-loser-hedge-account-tp-overlay/account-tp-cycle-flush.rows.csv`
- validationJson: `docs/research/gates/gate95/artifacts/limnihedge-type3-loser-hedge-account-tp-overlay/validation.rows.json`
- validationCsv: `docs/research/gates/gate95/artifacts/limnihedge-type3-loser-hedge-account-tp-overlay/validation.rows.csv`
- commandReceipt: `docs/research/gates/gate95/artifacts/limnihedge-type3-loser-hedge-account-tp-overlay/command-receipt.json`
- runSummary: `docs/research/gates/gate95/artifacts/limnihedge-type3-loser-hedge-account-tp-overlay/gate95u-run-summary.json`
- shaManifest: `docs/research/gates/gate95/artifacts/limnihedge-type3-loser-hedge-account-tp-overlay/gate95u-sha256.txt`
- report: `docs/research/gates/gate95/GATE95U_LIMNIHEDGE_TYPE3_LOSER_HEDGE_ACCOUNT_TP_OVERLAY_2026-07-05.md`
