# Gate 95R LimniHedge Type 3 Corrected Accounting OOS Replay

Date: 2026-07-04

Verdict: `FAIL_GATE95R_NO_CORRECTED_ROW_SURVIVES`

## Scope

Gate 95R replays the exact Gate 95 OOS artifact surface for `2025-01-01T00:00:00.000Z..2026-05-31T23:59:59.999Z` using corrected actual-USD accounting from Gate 96A. It does not change strategy logic, add variants, run 2019-2024, mutate MT5, add lifecycle/protection changes, or integrate Candidate B/Katarakti/Q/Triangle/LRMG changes.

Swap remains unavailable in this repo replay, so every row carries `swap_unavailable_blocker=true`.

## Ranked Corrected Rows

Rows are ranked only by closed + marked corrected equity, then PF, equity DD, net/DD, terminal inventory, pair concentration, monthly stability, and cost-stress survival.

| variant_id | trade_rows | corrected_closed_plus_marked_net_actual | corrected_profit_factor_closed_plus_marked | corrected_max_equity_dd_actual | corrected_net_to_max_equity_dd | terminal_marked_loss_share_of_closed_net | top_pair_contribution_pct | top_3_pair_contribution_pct | stress_double_commission_net | stress_slippage_0_1_net | continue_candidate | continue_fail_reasons |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| adr_event_0_025_type3_long_only | 90164 | 241798.06 | 3.386761 | -4619.06 | 52.347894 | 0.293841 |  | 0 | 229175.1 | 240300.04 | false | terminal_inventory_loss_share_gte_25pct_closed_net;top_pair_gt_25pct_net |
| adr_event_0_025_candidate_b_fade_strict | 96739 | 201123.94 | 2.200589 | -19782.64 | 10.166689 | 0.453852 |  | 0 | 187580.48 | 199537.42 | false | terminal_inventory_loss_share_gte_25pct_closed_net;top_pair_gt_25pct_net |
| adr_event_0_025_type3_both_no_direction | 179454 | 124109.74 | 1.210584 | -90844.84 | 1.366173 | 0.825839 |  | 0 | 98986.18 | 121065.32 | false | pf_below_1_25;negative_month_worse_than_25pct_net;terminal_inventory_loss_share_gte_25pct_closed_net;top_pair_gt_25pct_net |
| adr_event_0_05_candidate_b_fade_strict | 11062 | 27758.23 | 2.287908 | -7422.91 | 3.739534 | 0.436355 |  | 0 | 26209.55 | 27557.08 | false | terminal_inventory_loss_share_gte_25pct_closed_net;top_pair_gt_25pct_net |
| adr_event_0_05_type3_long_only | 8912 | 21203.43 | 2.085265 | -5066.9 | 4.184695 | 0.47848 |  | 0 | 19955.75 | 21022.57 | false | terminal_inventory_loss_share_gte_25pct_closed_net;top_pair_gt_25pct_net |
| adr_event_0_075_type3_both_no_direction | 4226 | 18942.45 | 9.437209 | -402.81 | 47.025769 | 0.092043 |  | 0 | 18350.81 | 18862.46 | false | top_pair_gt_25pct_net |
| adr_event_0_075_candidate_b_fade_strict | 3016 | 12943.4 | 6.895105 | -759.84 | 17.034373 | 0.135168 |  | 0 | 12521.16 | 12886.64 | false | top_pair_gt_25pct_net |
| adr_event_0_075_type3_long_only | 2621 | 11589.14 | 6.301022 | -1101.02 | 10.525824 | 0.138387 |  | 0 | 11222.2 | 11530.56 | false | top_pair_gt_25pct_net |
| adr_event_0_05_type3_both_no_direction | 19929 | 8304.27 | 1.106569 | -17152.49 | 0.484144 | 0.9036 |  | 0 | 5514.21 | 7976.42 | false | pf_below_1_25;net_to_max_equity_dd_below_1;negative_month_worse_than_25pct_net;terminal_inventory_loss_share_gte_25pct_closed_net;top_pair_gt_25pct_net |
| adr_event_0_075_type3_short_only | 1605 | 7353.31 | 125.845076 | -170.47 | 43.135491 | 0.007946 |  | 0 | 7128.61 | 7331.9 | false | top_pair_gt_25pct_net |
| adr_event_0_075_candidate_b_agreement_strict | 1210 | 5999.05 | 122.215992 | -72.08 | 83.227686 | 0 |  | 0 | 5829.65 | 5975.81 | false | top_pair_gt_25pct_net |
| adr_event_0_10_type3_both_no_direction | 852 | 3069.39 | 3.680562 | -1066.79 | 2.87722 | 0.252157 |  | 0 | 2950.11 | 3053.52 | false | terminal_inventory_loss_share_gte_25pct_closed_net;top_pair_gt_25pct_net |

## Candidate Rows

| variant_id | corrected_closed_net_actual | corrected_terminal_marked_actual | corrected_closed_plus_marked_net_actual | corrected_profit_factor_closed_plus_marked | worst_marked_month_delta_actual | stress_double_commission_net | stress_slippage_0_1_net | stress_slippage_0_2_net | continue_candidate | continue_fail_reasons |
|---|---|---|---|---|---|---|---|---|---|---|
| adr_event_0_025_type3_long_only | 342412.87 | -100614.81 | 241798.06 | 3.386761 | -4619.07 | 229175.1 | 240300.04 | 238802.01 | false | terminal_inventory_loss_share_gte_25pct_closed_net;top_pair_gt_25pct_net |
| adr_event_0_05_type3_long_only | 40657.02 | -19453.59 | 21203.43 | 2.085265 | -5066.9 | 19955.75 | 21022.57 | 20841.71 | false | terminal_inventory_loss_share_gte_25pct_closed_net;top_pair_gt_25pct_net |

## Inventory Summary

| variant_id | closed_net_actual | terminal_inventory_actual | closed_plus_marked_actual | open_inventory_rows | max_open_unrealized_loss_actual | terminal_loss_share_of_closed_net |
|---|---|---|---|---|---|---|
| time_h1_type3_both_no_direction | 2740.27 | -2012.95 | 727.33 | 53 | -203.45 | 0.734579 |
| time_h1_type3_long_only | 2740.27 | -2012.95 | 727.33 | 53 | -203.45 | 0.734579 |
| time_h1_type3_short_only | 0 | 0 | 0 | 0 | 0 |  |
| time_h1_candidate_b_agreement_strict | 387.8 | -31.33 | 356.47 | 8 | -94.12 | 0.080788 |
| time_h1_candidate_b_fade_strict | 2352.47 | -1981.62 | 370.85 | 45 | -203.45 | 0.842356 |
| adr_event_0_025_type3_both_no_direction | 712614.59 | -588504.85 | 124109.74 | 8423 | -329.04 | 0.825839 |
| adr_event_0_025_type3_long_only | 342412.87 | -100614.81 | 241798.06 | 2933 | -319.55 | 0.293841 |
| adr_event_0_025_type3_short_only | 370201.72 | -487890.05 | -117688.33 | 5490 | -329.04 | 1.317903 |
| adr_event_0_025_candidate_b_agreement_strict | 344355.84 | -421370.05 | -77014.21 | 5221 | -319.55 | 1.223647 |
| adr_event_0_025_candidate_b_fade_strict | 368258.75 | -167134.81 | 201123.94 | 3202 | -329.04 | 0.453852 |
| adr_event_0_05_type3_both_no_direction | 86143.95 | -77839.67 | 8304.27 | 989 | -228.11 | 0.9036 |
| adr_event_0_05_type3_long_only | 40657.02 | -19453.59 | 21203.43 | 369 | -209.33 | 0.47848 |
| adr_event_0_05_type3_short_only | 45486.92 | -58386.08 | -12899.16 | 620 | -228.11 | 1.283579 |
| adr_event_0_05_candidate_b_agreement_strict | 36896.24 | -56350.19 | -19453.95 | 563 | -228.11 | 1.527261 |
| adr_event_0_05_candidate_b_fade_strict | 49247.71 | -21489.48 | 27758.23 | 426 | -209.33 | 0.436355 |
| adr_event_0_075_type3_both_no_direction | 20862.72 | -1920.27 | 18942.45 | 125 | -77.75 | 0.092043 |
| adr_event_0_075_type3_long_only | 13450.52 | -1861.37 | 11589.14 | 118 | -77.75 | 0.138387 |
| adr_event_0_075_type3_short_only | 7412.21 | -58.9 | 7353.31 | 7 | -12.88 | 0.007946 |
| adr_event_0_075_candidate_b_agreement_strict | 5896.35 | 102.71 | 5999.05 | 26 | -15.79 | 0 |
| adr_event_0_075_candidate_b_fade_strict | 14966.38 | -2022.98 | 12943.4 | 99 | -77.75 | 0.135168 |
| adr_event_0_10_type3_both_no_direction | 4104.32 | -1034.93 | 3069.39 | 49 | -76.68 | 0.252157 |
| adr_event_0_10_type3_long_only | 1939.16 | -1018.04 | 921.12 | 43 | -76.68 | 0.524991 |
| adr_event_0_10_type3_short_only | 2165.16 | -16.89 | 2148.27 | 6 | -13.65 | 0.0078 |
| adr_event_0_10_candidate_b_agreement_strict | 1342.62 | 49.09 | 1391.71 | 11 | -6.22 | 0 |
| adr_event_0_10_candidate_b_fade_strict | 2761.71 | -1084.02 | 1677.68 | 38 | -76.68 | 0.392519 |

## Month Summary

| variant_id | months | negative_marked_months | worst_month | worst_marked_month_delta_actual | best_month | best_marked_month_delta_actual | ending_marked_equity_actual |
|---|---|---|---|---|---|---|---|
| time_h1_type3_both_no_direction | 17 | 7 | 2025-06 | -643.25 | 2026-03 | 1323.46 | 727.33 |
| time_h1_type3_long_only | 17 | 7 | 2025-06 | -643.25 | 2026-03 | 1323.46 | 727.33 |
| time_h1_type3_short_only | 17 | 0 | 2025-01 | 0 | 2025-01 | 0 | 0 |
| time_h1_candidate_b_agreement_strict | 17 | 5 | 2025-12 | -84.96 | 2025-07 | 137.17 | 356.47 |
| time_h1_candidate_b_fade_strict | 17 | 7 | 2025-06 | -563.93 | 2026-03 | 1211.87 | 370.85 |
| adr_event_0_025_type3_both_no_direction | 17 | 7 | 2025-12 | -66486.54 | 2026-03 | 148806.36 | 124109.74 |
| adr_event_0_025_type3_long_only | 17 | 2 | 2025-09 | -4619.07 | 2026-03 | 73949.96 | 241798.06 |
| adr_event_0_025_type3_short_only | 17 | 9 | 2026-04 | -85301.1 | 2026-03 | 74856.4 | -117688.33 |
| adr_event_0_025_candidate_b_agreement_strict | 17 | 7 | 2026-04 | -70570.19 | 2026-03 | 34364.11 | -77014.21 |
| adr_event_0_025_candidate_b_fade_strict | 17 | 6 | 2025-09 | -11884.52 | 2026-03 | 114442.25 | 201123.94 |
| adr_event_0_05_type3_both_no_direction | 17 | 6 | 2026-04 | -12860.24 | 2026-03 | 16736.24 | 8304.27 |
| adr_event_0_05_type3_long_only | 17 | 6 | 2025-06 | -5066.9 | 2026-03 | 12239.02 | 21203.43 |
| adr_event_0_05_type3_short_only | 17 | 7 | 2026-04 | -11349.87 | 2026-01 | 5199.8 | -12899.16 |
| adr_event_0_05_candidate_b_agreement_strict | 17 | 8 | 2026-04 | -11425.91 | 2026-03 | 5642.37 | -19453.95 |
| adr_event_0_05_candidate_b_fade_strict | 17 | 5 | 2025-08 | -4670.85 | 2026-03 | 11093.87 | 27758.23 |
| adr_event_0_075_type3_both_no_direction | 17 | 3 | 2025-08 | -346.79 | 2026-01 | 4660.73 | 18942.45 |
| adr_event_0_075_type3_long_only | 17 | 3 | 2025-09 | -756.5 | 2026-01 | 3580.22 | 11589.14 |
| adr_event_0_075_type3_short_only | 17 | 4 | 2026-03 | -170.47 | 2026-01 | 1080.51 | 7353.31 |
| adr_event_0_075_candidate_b_agreement_strict | 17 | 2 | 2026-03 | -72.08 | 2026-01 | 1251.74 | 5999.05 |
| adr_event_0_075_candidate_b_fade_strict | 17 | 3 | 2025-08 | -444.77 | 2026-01 | 3409 | 12943.4 |
| adr_event_0_10_type3_both_no_direction | 17 | 6 | 2025-09 | -542.51 | 2026-01 | 1606.06 | 3069.39 |
| adr_event_0_10_type3_long_only | 17 | 7 | 2025-09 | -743.59 | 2026-01 | 1243.31 | 921.12 |
| adr_event_0_10_type3_short_only | 17 | 3 | 2026-03 | -240.17 | 2026-04 | 415.49 | 2148.27 |
| adr_event_0_10_candidate_b_agreement_strict | 17 | 3 | 2026-03 | -288.77 | 2026-04 | 528.36 | 1391.71 |
| adr_event_0_10_candidate_b_fade_strict | 17 | 6 | 2025-09 | -617.41 | 2026-01 | 1144.36 | 1677.68 |

## Cost Stress

| variant_id | stress_id | corrected_closed_plus_marked_net_actual | profit_factor | survives_positive_net |
|---|---|---|---|---|
| time_h1_type3_long_only | base_commission | 727.33 | 1.344827 | true |
| time_h1_type3_long_only | double_commission | 651.17 | 1.307902 | true |
| time_h1_type3_long_only | base_commission_plus_0_1_pip_slippage | 713.69 | 1.338196 | true |
| time_h1_type3_long_only | base_commission_plus_0_2_pip_slippage | 700.04 | 1.331571 | true |
| adr_event_0_025_type3_long_only | base_commission | 241798.06 | 3.386761 | true |
| adr_event_0_025_type3_long_only | double_commission | 229175.1 | 3.253793 | true |
| adr_event_0_025_type3_long_only | base_commission_plus_0_1_pip_slippage | 240300.04 | 3.370635 | true |
| adr_event_0_025_type3_long_only | base_commission_plus_0_2_pip_slippage | 238802.01 | 3.354526 | true |
| adr_event_0_05_type3_long_only | base_commission | 21203.43 | 2.085265 | true |
| adr_event_0_05_type3_long_only | double_commission | 19955.75 | 2.019009 | true |
| adr_event_0_05_type3_long_only | base_commission_plus_0_1_pip_slippage | 21022.57 | 2.075548 | true |
| adr_event_0_05_type3_long_only | base_commission_plus_0_2_pip_slippage | 20841.71 | 2.065839 | true |
| adr_event_0_075_type3_long_only | base_commission | 11589.14 | 6.301022 | true |
| adr_event_0_075_type3_long_only | double_commission | 11222.2 | 6.109946 | true |
| adr_event_0_075_type3_long_only | base_commission_plus_0_1_pip_slippage | 11530.56 | 6.269976 | true |
| adr_event_0_075_type3_long_only | base_commission_plus_0_2_pip_slippage | 11471.97 | 6.23898 | true |
| adr_event_0_10_type3_long_only | base_commission | 921.12 | 1.82248 | true |
| adr_event_0_10_type3_long_only | double_commission | 866.8 | 1.771181 | true |
| adr_event_0_10_type3_long_only | base_commission_plus_0_1_pip_slippage | 911.44 | 1.813296 | true |
| adr_event_0_10_type3_long_only | base_commission_plus_0_2_pip_slippage | 901.75 | 1.804123 | true |

## Validation

Validation failures: `0`

| check | value | expected | passed |
|---|---|---|---|
| gate95_erratum_exists | docs/research/gates/gate95/GATE95_ERRATUM_INVALIDATED_BY_GATE96A_ACCOUNTING_2026-07-04.md | erratum committed before Gate95R | true |
| gate95_oos_validation_failures | 0 | 0 | true |
| same_gate95_oos_window | 2025-01-01T00:00:00.000Z..2026-05-31T23:59:59.999Z | 2025-01-01T00:00:00.000Z..2026-05-31T23:59:59.999Z | true |
| variant_count | 25 | 25 | true |
| old_gate95_modeled_conversion_path_used_by_gate95r | correctedFxPnl helper | no old Gate95 conversion function | true |
| corrected_conversion_gap_rows | 0 | 0 | true |
| closed_plus_marked_equity_present | 25 | 25 | true |
| month_end_marked_equity_rows | 425 | 25 variants x 17 months | true |
| cost_stress_rows | 100 | 100 | true |
| price_bundle_id | gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953 | gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953 | true |
| config_hash_present | 36C5AEDF6901A0D072F8595F560AD63BDEC77BD0CB3F8DCDF87215AC4682F118 | non-empty Gate95 config hash | true |
| command_receipt_emitted | npm run engine:gate95r:limnihedge-type3-corrected-accounting-oos-replay | Gate95R command receipt | true |
| swap_unavailable_blocker | true | true | true |

## Interpretation Boundary

Gate 95R is a corrected accounting replay, not a strategy-design gate. Original Gate 95 performance metrics remain invalidated by the Gate 95 erratum. Only corrected rows in this report may be used for the next decision.

## Artifacts

- config: `docs/research/gates/gate95/artifacts/limnihedge-type3-corrected-accounting-oos-replay/gate95r-config.json`
- variantJson: `docs/research/gates/gate95/artifacts/limnihedge-type3-corrected-accounting-oos-replay/corrected-variant-summary.rows.json`
- variantCsv: `docs/research/gates/gate95/artifacts/limnihedge-type3-corrected-accounting-oos-replay/corrected-variant-summary.rows.csv`
- pairJson: `docs/research/gates/gate95/artifacts/limnihedge-type3-corrected-accounting-oos-replay/corrected-pair-summary.rows.json`
- pairCsv: `docs/research/gates/gate95/artifacts/limnihedge-type3-corrected-accounting-oos-replay/corrected-pair-summary.rows.csv`
- monthJson: `docs/research/gates/gate95/artifacts/limnihedge-type3-corrected-accounting-oos-replay/corrected-month-summary.rows.json`
- monthCsv: `docs/research/gates/gate95/artifacts/limnihedge-type3-corrected-accounting-oos-replay/corrected-month-summary.rows.csv`
- monthEndJson: `docs/research/gates/gate95/artifacts/limnihedge-type3-corrected-accounting-oos-replay/corrected-month-end-marked-equity.rows.json`
- monthEndCsv: `docs/research/gates/gate95/artifacts/limnihedge-type3-corrected-accounting-oos-replay/corrected-month-end-marked-equity.rows.csv`
- inventoryJson: `docs/research/gates/gate95/artifacts/limnihedge-type3-corrected-accounting-oos-replay/corrected-inventory-summary.rows.json`
- inventoryCsv: `docs/research/gates/gate95/artifacts/limnihedge-type3-corrected-accounting-oos-replay/corrected-inventory-summary.rows.csv`
- costJson: `docs/research/gates/gate95/artifacts/limnihedge-type3-corrected-accounting-oos-replay/corrected-cost-stress-summary.rows.json`
- costCsv: `docs/research/gates/gate95/artifacts/limnihedge-type3-corrected-accounting-oos-replay/corrected-cost-stress-summary.rows.csv`
- reconciliationJson: `docs/research/gates/gate95/artifacts/limnihedge-type3-corrected-accounting-oos-replay/pnl-reconciliation-validation.rows.json`
- reconciliationCsv: `docs/research/gates/gate95/artifacts/limnihedge-type3-corrected-accounting-oos-replay/pnl-reconciliation-validation.rows.csv`
- longShortJson: `docs/research/gates/gate95/artifacts/limnihedge-type3-corrected-accounting-oos-replay/corrected-long-short-summary.rows.json`
- longShortCsv: `docs/research/gates/gate95/artifacts/limnihedge-type3-corrected-accounting-oos-replay/corrected-long-short-summary.rows.csv`
- candidateJson: `docs/research/gates/gate95/artifacts/limnihedge-type3-corrected-accounting-oos-replay/corrected-candidate-b-summary.rows.json`
- candidateCsv: `docs/research/gates/gate95/artifacts/limnihedge-type3-corrected-accounting-oos-replay/corrected-candidate-b-summary.rows.csv`
- movementJson: `docs/research/gates/gate95/artifacts/limnihedge-type3-corrected-accounting-oos-replay/corrected-movement-bucket-summary.rows.json`
- movementCsv: `docs/research/gates/gate95/artifacts/limnihedge-type3-corrected-accounting-oos-replay/corrected-movement-bucket-summary.rows.csv`
- validationJson: `docs/research/gates/gate95/artifacts/limnihedge-type3-corrected-accounting-oos-replay/validation.rows.json`
- validationCsv: `docs/research/gates/gate95/artifacts/limnihedge-type3-corrected-accounting-oos-replay/validation.rows.csv`
- commandReceipt: `docs/research/gates/gate95/artifacts/limnihedge-type3-corrected-accounting-oos-replay/command-receipt.json`
- runSummary: `docs/research/gates/gate95/artifacts/limnihedge-type3-corrected-accounting-oos-replay/gate95r-run-summary.json`
- shaManifest: `docs/research/gates/gate95/artifacts/limnihedge-type3-corrected-accounting-oos-replay/gate95r-sha256.txt`
- report: `docs/research/gates/gate95/GATE95R_LIMNIHEDGE_TYPE3_CORRECTED_ACCOUNTING_OOS_REPLAY_2026-07-04.md`
