# Gate 92 LimniHedge Legacy Parity Intake

Date: 2026-07-04

Verdict: `PASS_GATE92_LIMNIHEDGE_LEGACY_PARITY_INTAKE_READY_FOR_FULL_REPLAY`

## Scope

Gate 92 treats `automation/mt5/Experts/LimniHedge_V1.mq5` as the MT5 reference implementation. This pass builds the repo parity replica surface only: MT5 report parsing, legacy contract receipts, H1 source coverage checks, entry-shape replay, lifecycle count replay, and shape-level accounting reconciliation against the saved reports.

Frozen: no EA re-engineering, no LRMG entry changes, no LRMG trailing, no zero-line replacement, no Katarakti-lite integration, no Direction/Candidate B/David redesign, no live MT5 trading, no promotion, and no broad optimization matrix.

## MT5 Report Inventory

| case_id | scope | expected_filename | exists | note |
|---|---|---|---|---|
| audcad_h1_12y_type1_type3_primary | primary | AUDCAD 12 YEAR TEST 1 HOUR CHART.html | true | expected_report_found |
| audcad_h1_type3_ma_changed_primary | primary | AUDCAD 12 YEAR TEST 1 HOUR CHART TYPE 3 ONLY MA SETTINGS CHANGED.html | true | expected_report_found |
| audjpy_h1_type3_primary | primary | AUDJPY 1 HOUR CHART.html | true | expected_report_found |
| audchf_h1_type3_secondary | secondary | AUDCHF 1 HOUR CHART.html | true | expected_report_found |
| audcad_1_hour_chart | discovered | AUDCAD 1 HOUR CHART.html | true | discovered_html_report_not_in_primary_handoff_list |

## Parsed Report Shape

| case_id | scope | normalized_symbol | period | entry_deals | exit_deals | terminal_liquidation_deals | headline_total_net_profit | headline_profit_factor | max_hold_hours_fifo |
|---|---|---|---|---|---|---|---|---|---|
| audcad_h1_12y_type1_type3_primary | primary | AUDCAD | H1 (2014.07.02 - 2026.07.03) | 1432 | 1432 | 16 | 5039.46 | 5.15 | 5372.999167 |
| audcad_h1_type3_ma_changed_primary | primary | AUDCAD | H1 (2014.07.02 - 2026.07.03) | 260 | 260 | 2 | 5140.6 | 15.78 | 340.999167 |
| audjpy_h1_type3_primary | primary | AUDJPY | H1 (2014.07.02 - 2026.07.03) | 1518 | 1518 | 11 | 11965.24 | 39.57 | 1527.999167 |
| audchf_h1_type3_secondary | secondary | AUDCHF | H1 (2014.07.02 - 2026.07.03) | 386 | 386 | 36 | 3260.96 | 10.16 | 2864.999444 |
| audcad_1_hour_chart | discovered | AUDCAD | H1 (2014.07.02 - 2026.07.03) | 260 | 260 | 11 | 1333.04 | 12.39 | 1039.999444 |

## H1 Source Coverage

Replay source: `mt5_h1_export`

Canonical price bundle guard, when `--price-source=canonical` is explicitly used: `gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953`

| case_id | symbol | timeframe | source | david_profile | bar_count | first_bar_open_utc | last_bar_open_utc | reaches_report_start | reaches_report_end | note |
|---|---|---|---|---|---|---|---|---|---|---|
| audcad_h1_12y_type1_type3_primary | AUDCAD | 1h | mt5_h1_export | ma100_rsi100_60_40 | 54890 | 2014-07-02T00:00:00.000Z | 2026-07-03T23:00:00.000Z | true | true | mt5_h1_export_loaded_for_report_profile |
| audcad_h1_type3_ma_changed_primary | AUDCAD | 1h | mt5_h1_export | ma100_rsi100_70_30 | 54890 | 2014-07-02T00:00:00.000Z | 2026-07-03T23:00:00.000Z | true | true | mt5_h1_export_loaded_for_report_profile |
| audjpy_h1_type3_primary | AUDJPY | 1h | mt5_h1_export | ma100_rsi100_70_30 | 54890 | 2014-07-02T00:00:00.000Z | 2026-07-03T23:00:00.000Z | true | true | mt5_h1_export_loaded_for_report_profile |
| audchf_h1_type3_secondary | AUDCHF | 1h | mt5_h1_export | ma100_rsi100_70_30 | 54890 | 2014-07-02T00:00:00.000Z | 2026-07-03T23:00:00.000Z | true | true | mt5_h1_export_loaded_for_report_profile |
| audcad_1_hour_chart | AUDCAD | 1h | mt5_h1_export | ma100_rsi100_70_30 | 54890 | 2014-07-02T00:00:00.000Z | 2026-07-03T23:00:00.000Z | true | true | mt5_h1_export_loaded_for_report_profile |

## MT5 Export Procedure

The broker-source parity lane uses the read-only MT5 script `automation/mt5/Scripts/LimniHedgeV1ExportParityH1.mq5`. It exports H1 bars plus David buffer state to `C:/Users/User/AppData/Roaming/MetaQuotes/Terminal/94497F60A2BFEA1AFAB110FCF3E331BB/MQL5/Files/LimniHedge_V1_Parity` as `<SYMBOL>_H1_LimniHedgeV1Parity.csv`. After export, rerun:

```powershell
npm run engine:gate92:limnihedge-legacy-parity -- --price-source=mt5-export
```

## MT5 Tester Acceptance Layer

The repo replica keeps raw legacy Type 3 candidates separate from MT5 tester-admitted entries. The raw stream is written to `replica-raw-entry-signals.rows.*`; the acceptance ledger is written to `replica-entry-acceptance.rows.*`; strict comparison uses the accepted replica entries in `replica-entry-shape.rows.*`.

Acceptance rules in this intake are limited to MT5 report execution semantics: the period end date is treated as the exclusive Strategy Tester boundary, and `00:00` daily rollover candidates are skipped because the parsed saved MT5 reports contain zero accepted entry deals at `00:00` across the available AUDJPY, AUDCHF, and AUDCAD reports. This is a tester-admission layer, not a change to the legacy Type 3 formula.

| case_id | raw_signal_count | accepted_count | skipped_daily_rollover_0000 | skipped_after_report_execution_end | first_skipped_daily_rollover_0000 |
|---|---|---|---|---|---|
| audcad_1_hour_chart | 266 | 260 | 6 | 0 | 2025-05-06T00:00:00.000Z |
| audcad_h1_12y_type1_type3_primary | 1492 | 1432 | 60 | 0 | 2018-04-23T00:00:00.000Z |
| audcad_h1_type3_ma_changed_primary | 266 | 260 | 6 | 0 | 2025-05-06T00:00:00.000Z |
| audchf_h1_type3_secondary | 391 | 386 | 5 | 0 | 2024-11-06T00:00:00.000Z |
| audjpy_h1_type3_primary | 1551 | 1518 | 33 | 0 | 2019-03-05T00:00:00.000Z |

## Entry-Shape Replica Comparison

The replica comparison is intentionally strict on entry timestamp, side, inferred order type, and lot size. When MT5 H1 exports include David buffer state, the replica uses that buffer state because the EA itself consumes David through `iCustom`.

| case_id | comparison_status | mt5_entries_in_coverage | replica_entries_in_coverage | exact_sequence_matches | first_mismatch_index | verdict |
|---|---|---|---|---|---|---|
| audcad_h1_12y_type1_type3_primary | compared | 1432 | 1432 | 1432 |  | PASS |
| audcad_h1_type3_ma_changed_primary | compared | 260 | 260 | 260 |  | PASS |
| audjpy_h1_type3_primary | compared | 1518 | 1518 | 1518 |  | PASS |
| audchf_h1_type3_secondary | compared | 386 | 386 | 386 |  | PASS |
| audcad_1_hour_chart | compared | 260 | 260 | 260 |  | PASS |

## Lifecycle Replay Probe

This probe is downstream of entry parity. It replays the accepted entry stream over the exported H1 OHLC path using the EA's trailing-stop formulas and compares against the saved MT5 exit deal sequence. The HTML report does not expose hedged position ids, so FIFO hold pairing is kept as a separate report-shape metric rather than the lifecycle matcher. The count verdict is now part of the Gate 92 pass/fail checks; exact tick-order timestamps remain a profile diagnostic.

| case_id | match_method | mt5_exit_deals | replica_exit_deals | matched_exit_deals | unmatched_mt5_exit_deals | unmatched_replica_exit_deals | mt5_sl_exit_deals | replica_sl_exit_deals | mt5_terminal_liquidation_deals | replica_terminal_liquidation_deals | same_exit_hour_matches | average_abs_exit_price_delta | max_abs_exit_price_delta | verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| audcad_h1_12y_type1_type3_primary | exit_sequence | 1432 | 1432 | 1432 | 0 | 0 | 1416 | 1416 | 16 | 16 | 1278 | 0.000097 | 0.00979 | PROFILED_PASS_COUNTS |
| audcad_h1_type3_ma_changed_primary | exit_sequence | 260 | 260 | 260 | 0 | 0 | 258 | 258 | 2 | 2 | 237 | 0.00004 | 0.0021 | PROFILED_PASS_COUNTS |
| audjpy_h1_type3_primary | exit_sequence | 1518 | 1518 | 1518 | 0 | 0 | 1507 | 1507 | 11 | 11 | 1390 | 0.007397 | 0.756 | PROFILED_PASS_COUNTS |
| audchf_h1_type3_secondary | exit_sequence | 386 | 386 | 386 | 0 | 0 | 350 | 350 | 36 | 36 | 293 | 0.000488 | 0.01035 | PROFILED_PASS_COUNTS |
| audcad_1_hour_chart | exit_sequence | 260 | 260 | 260 | 0 | 0 | 249 | 249 | 11 | 11 | 248 | 0.000025 | 0.00292 | PROFILED_PASS_COUNTS |

## Accounting Replay

The accounting replay converts replica price PnL through the exported MT5 H1 conversion close for the quote currency, applies the observed broker commission rate of `-7.00 * lots`, and carries MT5 report swap as an observed broker-accounting passthrough. That swap passthrough is deliberate: the saved reports are the parity baseline, while an independent historical swap model is outside this frozen gate.

| case_id | matched_exit_deals | conversion_missing_exit_deals | mt5_price_profit | replica_price_profit | price_profit_delta | price_profit_delta_pct | mt5_commission | replica_commission | commission_delta | mt5_swap | mt5_net_profit | replica_net_profit_with_observed_swap | net_profit_delta_with_observed_swap | verdict |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| audcad_h1_12y_type1_type3_primary | 1432 | 0 | 5074.1 | 5062.71 | -11.39 | -0.224473 | -204.68 | -204.68 | 0 | 170.04 | 5039.46 | 5028.07 | -11.39 | PROFILED_PASS_ACCOUNTING_SHAPE |
| audcad_h1_type3_ma_changed_primary | 260 | 0 | 5045.28 | 5075.51 | 30.23 | 0.599174 | -364 | -364 | 0 | 459.32 | 5140.6 | 5170.83 | 30.23 | PROFILED_PASS_ACCOUNTING_SHAPE |
| audjpy_h1_type3_primary | 1518 | 0 | 9365.54 | 9306.98 | -58.56 | -0.625271 | -212.52 | -212.52 | 0 | 2812.22 | 11965.24 | 11906.68 | -58.56 | PROFILED_PASS_ACCOUNTING_SHAPE |
| audchf_h1_type3_secondary | 386 | 0 | 1347.19 | 1330.49 | -16.7 | -1.239617 | -54.04 | -54.04 | 0 | 1967.81 | 3260.96 | 3244.26 | -16.7 | PROFILED_PASS_ACCOUNTING_SHAPE |
| audcad_1_hour_chart | 260 | 0 | 1216.63 | 1224.33 | 7.7 | 0.632896 | -36.4 | -36.4 | 0 | 152.81 | 1333.04 | 1340.74 | 7.7 | PROFILED_PASS_ACCOUNTING_SHAPE |

## Yearly Closed Split

Yearly rows are grouped on the MT5 close year for matched exits, so the split checks the saved report's closed-year accounting surface while still using replica lifecycle price PnL for the comparison columns.

| case_id | close_year | mt5_exit_deals | replica_exit_deals | mt5_net_profit | replica_net_profit_with_observed_swap | net_profit_delta_with_observed_swap | mt5_price_profit | replica_price_profit | price_profit_delta | verdict |
|---|---|---|---|---|---|---|---|---|---|---|
| audcad_h1_12y_type1_type3_primary | 2018 | 120 | 120 | 515.87 | 502.97 | -12.9 | 527.07 | 514.17 | -12.9 | PROFILED_PASS_YEARLY_SHAPE |
| audcad_h1_12y_type1_type3_primary | 2019 | 177 | 177 | 646.57 | 647.29 | 0.72 | 673.38 | 674.1 | 0.72 | PROFILED_PASS_YEARLY_SHAPE |
| audcad_h1_12y_type1_type3_primary | 2020 | 186 | 186 | 731.08 | 731.6 | 0.52 | 782.4 | 782.92 | 0.52 | PROFILED_PASS_YEARLY_SHAPE |
| audcad_h1_12y_type1_type3_primary | 2021 | 165 | 165 | 696.63 | 690.74 | -5.89 | 666.05 | 660.16 | -5.89 | PROFILED_PASS_YEARLY_SHAPE |
| audcad_h1_12y_type1_type3_primary | 2022 | 156 | 156 | 724.72 | 724.34 | -0.38 | 625.23 | 624.85 | -0.38 | PROFILED_PASS_YEARLY_SHAPE |
| audcad_h1_12y_type1_type3_primary | 2023 | 141 | 141 | 403.93 | 414.83 | 10.9 | 553.6 | 564.5 | 10.9 | PROFILED_PASS_YEARLY_SHAPE |
| audcad_h1_12y_type1_type3_primary | 2024 | 220 | 220 | 879.04 | 880.29 | 1.25 | 865.69 | 866.94 | 1.25 | PROFILED_PASS_YEARLY_SHAPE |
| audcad_h1_12y_type1_type3_primary | 2025 | 177 | 177 | 471.04 | 469.55 | -1.49 | 674.69 | 673.2 | -1.49 | PROFILED_PASS_YEARLY_SHAPE |
| audcad_h1_12y_type1_type3_primary | 2026 | 90 | 90 | -29.42 | -33.54 | -4.12 | -294.01 | -298.13 | -4.12 | PROFILED_PASS_YEARLY_SHAPE |
| audcad_h1_type3_ma_changed_primary | 2025 | 152 | 152 | 3163.24 | 3187.91 | 24.67 | 3044.52 | 3069.19 | 24.67 | PROFILED_PASS_YEARLY_SHAPE |
| audcad_h1_type3_ma_changed_primary | 2026 | 108 | 108 | 1977.36 | 1982.92 | 5.56 | 2000.76 | 2006.32 | 5.56 | PROFILED_PASS_YEARLY_SHAPE |
| audjpy_h1_type3_primary | 2019 | 183 | 183 | 1687.87 | 1689.49 | 1.62 | 1382.15 | 1383.77 | 1.62 | PROFILED_PASS_YEARLY_SHAPE |
| audjpy_h1_type3_primary | 2020 | 212 | 212 | 2220.14 | 2215.98 | -4.16 | 1626.81 | 1622.65 | -4.16 | PROFILED_PASS_YEARLY_SHAPE |
| audjpy_h1_type3_primary | 2021 | 206 | 206 | 2170.78 | 2140.89 | -29.89 | 1605.16 | 1575.27 | -29.89 | PROFILED_PASS_YEARLY_SHAPE |
| audjpy_h1_type3_primary | 2022 | 187 | 187 | 1333.63 | 1306.2 | -27.43 | 1249.17 | 1221.74 | -27.43 | PROFILED_PASS_YEARLY_SHAPE |
| audjpy_h1_type3_primary | 2023 | 185 | 185 | 1404.85 | 1403.04 | -1.81 | 1083.5 | 1081.69 | -1.81 | PROFILED_PASS_YEARLY_SHAPE |
| audjpy_h1_type3_primary | 2024 | 202 | 202 | 1144.41 | 1152.32 | 7.91 | 1038.09 | 1046 | 7.91 | PROFILED_PASS_YEARLY_SHAPE |
| audjpy_h1_type3_primary | 2025 | 226 | 226 | 1557.1 | 1556.73 | -0.37 | 1162.36 | 1161.99 | -0.37 | PROFILED_PASS_YEARLY_SHAPE |
| audjpy_h1_type3_primary | 2026 | 117 | 117 | 446.46 | 442.03 | -4.43 | 218.3 | 213.87 | -4.43 | PROFILED_PASS_YEARLY_SHAPE |
| audchf_h1_type3_secondary | 2024 | 61 | 61 | 520.37 | 521.29 | 0.92 | 478.68 | 479.6 | 0.92 | PROFILED_PASS_YEARLY_SHAPE |
| audchf_h1_type3_secondary | 2025 | 166 | 166 | 1422.17 | 1412.42 | -9.75 | 1194.48 | 1184.73 | -9.75 | PROFILED_PASS_YEARLY_SHAPE |
| audchf_h1_type3_secondary | 2026 | 159 | 159 | 1318.42 | 1310.55 | -7.87 | -325.97 | -333.84 | -7.87 | PROFILED_PASS_YEARLY_SHAPE |
| audcad_1_hour_chart | 2025 | 143 | 143 | 780.31 | 782.4 | 2.09 | 700.8 | 702.89 | 2.09 | PROFILED_PASS_YEARLY_SHAPE |
| audcad_1_hour_chart | 2026 | 117 | 117 | 552.73 | 558.34 | 5.61 | 515.83 | 521.44 | 5.61 | PROFILED_PASS_YEARLY_SHAPE |

## Validation

| check | value | expected | passed |
|---|---|---|---|
| required_primary_mt5_reports_present | 0 | 0 | true |
| primary_reports_parsed | 3 | 3 | true |
| h1_source_rows_available | 0 | 0 | true |
| h1_source_coverage_reaches_report_windows | 0 | 0 | true |
| entry_shape_comparisons_pass | pass=5;fail=0;skip=0 | fail=0;skip=0;pass>=1 | true |
| lifecycle_count_comparisons_pass | pass=5;fail=0;skip=0 | fail=0;skip=0;pass>=1 | true |
| accounting_shape_comparisons_pass | pass=5;fail=0;skip=0 | fail=0;skip=0;pass>=1 | true |
| mt5_ea_not_mutated_by_gate92_script | no writes to automation/mt5/Experts/LimniHedge_V1.mq5 | reference-only | true |
| frozen_reengineering_scope_respected | no LRMG, Katarakti, zero-line, Direction, Candidate B, David redesign, promotion, or live MT5 trading | frozen | true |

## Artifacts

- inventoryJson: `docs/research/gates/gate92/artifacts/limnihedge-legacy-parity-intake/mt5-report-inventory.rows.json`
- inventoryCsv: `docs/research/gates/gate92/artifacts/limnihedge-legacy-parity-intake/mt5-report-inventory.rows.csv`
- summaryJson: `docs/research/gates/gate92/artifacts/limnihedge-legacy-parity-intake/mt5-report-summary.rows.json`
- summaryCsv: `docs/research/gates/gate92/artifacts/limnihedge-legacy-parity-intake/mt5-report-summary.rows.csv`
- settingsJson: `docs/research/gates/gate92/artifacts/limnihedge-legacy-parity-intake/mt5-report-settings.rows.json`
- settingsCsv: `docs/research/gates/gate92/artifacts/limnihedge-legacy-parity-intake/mt5-report-settings.rows.csv`
- ordersJson: `docs/research/gates/gate92/artifacts/limnihedge-legacy-parity-intake/mt5-orders.rows.json`
- ordersCsv: `docs/research/gates/gate92/artifacts/limnihedge-legacy-parity-intake/mt5-orders.rows.csv`
- dealsJson: `docs/research/gates/gate92/artifacts/limnihedge-legacy-parity-intake/mt5-deals.rows.json`
- dealsCsv: `docs/research/gates/gate92/artifacts/limnihedge-legacy-parity-intake/mt5-deals.rows.csv`
- yearlyJson: `docs/research/gates/gate92/artifacts/limnihedge-legacy-parity-intake/mt5-yearly-closed.rows.json`
- yearlyCsv: `docs/research/gates/gate92/artifacts/limnihedge-legacy-parity-intake/mt5-yearly-closed.rows.csv`
- holdsJson: `docs/research/gates/gate92/artifacts/limnihedge-legacy-parity-intake/mt5-fifo-holds.rows.json`
- holdsCsv: `docs/research/gates/gate92/artifacts/limnihedge-legacy-parity-intake/mt5-fifo-holds.rows.csv`
- contractJson: `docs/research/gates/gate92/artifacts/limnihedge-legacy-parity-intake/limnihedge-replica-contract.rows.json`
- contractCsv: `docs/research/gates/gate92/artifacts/limnihedge-legacy-parity-intake/limnihedge-replica-contract.rows.csv`
- coverageJson: `docs/research/gates/gate92/artifacts/limnihedge-legacy-parity-intake/h1-source-coverage.rows.json`
- coverageCsv: `docs/research/gates/gate92/artifacts/limnihedge-legacy-parity-intake/h1-source-coverage.rows.csv`
- rawReplicaEntriesJson: `docs/research/gates/gate92/artifacts/limnihedge-legacy-parity-intake/replica-raw-entry-signals.rows.json`
- rawReplicaEntriesCsv: `docs/research/gates/gate92/artifacts/limnihedge-legacy-parity-intake/replica-raw-entry-signals.rows.csv`
- replicaAcceptanceJson: `docs/research/gates/gate92/artifacts/limnihedge-legacy-parity-intake/replica-entry-acceptance.rows.json`
- replicaAcceptanceCsv: `docs/research/gates/gate92/artifacts/limnihedge-legacy-parity-intake/replica-entry-acceptance.rows.csv`
- replicaEntriesJson: `docs/research/gates/gate92/artifacts/limnihedge-legacy-parity-intake/replica-entry-shape.rows.json`
- replicaEntriesCsv: `docs/research/gates/gate92/artifacts/limnihedge-legacy-parity-intake/replica-entry-shape.rows.csv`
- comparisonJson: `docs/research/gates/gate92/artifacts/limnihedge-legacy-parity-intake/entry-shape-comparison.rows.json`
- comparisonCsv: `docs/research/gates/gate92/artifacts/limnihedge-legacy-parity-intake/entry-shape-comparison.rows.csv`
- replicaLifecycleExitsJson: `docs/research/gates/gate92/artifacts/limnihedge-legacy-parity-intake/replica-lifecycle-exits.rows.json`
- replicaLifecycleExitsCsv: `docs/research/gates/gate92/artifacts/limnihedge-legacy-parity-intake/replica-lifecycle-exits.rows.csv`
- lifecycleComparisonJson: `docs/research/gates/gate92/artifacts/limnihedge-legacy-parity-intake/lifecycle-replay-comparison.rows.json`
- lifecycleComparisonCsv: `docs/research/gates/gate92/artifacts/limnihedge-legacy-parity-intake/lifecycle-replay-comparison.rows.csv`
- replicaPnlExitsJson: `docs/research/gates/gate92/artifacts/limnihedge-legacy-parity-intake/replica-pnl-exits.rows.json`
- replicaPnlExitsCsv: `docs/research/gates/gate92/artifacts/limnihedge-legacy-parity-intake/replica-pnl-exits.rows.csv`
- pnlComparisonJson: `docs/research/gates/gate92/artifacts/limnihedge-legacy-parity-intake/pnl-replay-comparison.rows.json`
- pnlComparisonCsv: `docs/research/gates/gate92/artifacts/limnihedge-legacy-parity-intake/pnl-replay-comparison.rows.csv`
- pnlYearlyComparisonJson: `docs/research/gates/gate92/artifacts/limnihedge-legacy-parity-intake/pnl-yearly-comparison.rows.json`
- pnlYearlyComparisonCsv: `docs/research/gates/gate92/artifacts/limnihedge-legacy-parity-intake/pnl-yearly-comparison.rows.csv`
- validationJson: `docs/research/gates/gate92/artifacts/limnihedge-legacy-parity-intake/validation.rows.json`
- validationCsv: `docs/research/gates/gate92/artifacts/limnihedge-legacy-parity-intake/validation.rows.csv`
- metricsJson: `docs/research/gates/gate92/artifacts/limnihedge-legacy-parity-intake/metric-definitions.rows.json`
- metricsCsv: `docs/research/gates/gate92/artifacts/limnihedge-legacy-parity-intake/metric-definitions.rows.csv`
- commandReceipt: `docs/research/gates/gate92/artifacts/limnihedge-legacy-parity-intake/command-receipt.json`
- runSummary: `docs/research/gates/gate92/artifacts/limnihedge-legacy-parity-intake/gate92-run-summary.json`
- shaManifest: `docs/research/gates/gate92/artifacts/limnihedge-legacy-parity-intake/gate92-limnihedge-parity-sha256.txt`
- report: `docs/research/gates/gate92/GATE92_LIMNIHEDGE_LEGACY_PARITY_INTAKE_2026-07-04.md`

## Stop Line

If any required MT5 report is missing, selected H1 source coverage misses the report window, or entry-shape parity fails, stop research and fix parity before adding LRMG, Katarakti, Direction, new exits, or optimization.
