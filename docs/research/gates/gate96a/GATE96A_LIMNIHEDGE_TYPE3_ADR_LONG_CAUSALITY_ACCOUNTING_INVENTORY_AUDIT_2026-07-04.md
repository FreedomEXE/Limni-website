# Gate 96A LimniHedge Type 3 ADR Long Causality Accounting Inventory Audit

Date: 2026-07-04

Verdict: `FAIL_GATE96A_ADR_LONG_AUDIT_BLOCKED_NO_HISTORY_EXPANSION`

## Scope

Gate 96A consumes the Gate 95 OOS artifact surface for `2025-01-01..2026-05-31`. It does not run 2019-2024, optimize variants, add Candidate B/Katarakti/Q filters, change lifecycle rules, touch MT5, or promote a runtime.

Audited rows: `adr_event_0_025_type3_long_only`, `adr_event_0_05_type3_long_only`.

Controls: `adr_event_0_025_type3_short_only`, `adr_event_0_05_type3_short_only`, `time_h1_type3_long_only`, `time_h1_type3_short_only`.

Config hash: `F77BBD457464DEC2C6FFEB3C1782DECB5FBE84BE15A317BCCAFE22C7ED844020`

## Audit Summary

| variant_id | trades | gate95_net_usd_model | actual_usd_net | gate95_minus_actual_usd | conversion_gap_rows | max_abs_model_delta |
|---|---|---|---|---|---|---|
| time_h1_type3_long_only | 544 | 469.64 | 727.33 | -257.69 | 0 | 16.583849 |
| adr_event_0_025_type3_long_only | 90164 | 9311179.47 | 241798.06 | 9069381.41 | 0 | 4184.094116 |
| adr_event_0_025_type3_short_only | 89290 | -33818990.52 | -117688.33 | -33701302.19 | 0 | 52029.314774 |
| adr_event_0_05_type3_long_only | 8912 | 853628.29 | 21203.43 | 832424.86 | 0 | 4092.855901 |
| adr_event_0_05_type3_short_only | 11017 | -3391309.52 | -12899.16 | -3378410.36 | 0 | 36063.520467 |

## Inventory Markout

| variant_id | closed_net_actual_ex_terminal | terminal_inventory_actual | closed_plus_marked_actual | gate95_report_net | terminal_open_count | max_open_unrealized_loss_actual | worst_open_inventory_day |
|---|---|---|---|---|---|---|---|
| adr_event_0_025_type3_long_only | 342412.87 | -100614.81 | 241798.06 | 9311179.47 | 2933 | -319.55 | 2026-05-29 |
| adr_event_0_05_type3_long_only | 40657.02 | -19453.59 | 21203.43 | 853628.29 | 369 | -209.33 | 2026-05-29 |
| adr_event_0_025_type3_short_only | 370201.72 | -487890.05 | -117688.33 | -33818990.52 | 5490 | -329.04 | 2026-05-29 |
| adr_event_0_05_type3_short_only | 45486.92 | -58386.08 | -12899.16 | -3391309.52 | 620 | -228.11 | 2026-05-29 |
| time_h1_type3_long_only | 2740.27 | -2012.95 | 727.33 | 469.64 | 53 | -203.45 | 2026-05-29 |
| time_h1_type3_short_only | 0 | 0 | 0 | 0 | 0 | 0 |  |

## Month-End Marked Equity

| variant_id | months | negative_marked_months | worst_month | worst_marked_equity_actual | best_month | best_marked_equity_actual |
|---|---|---|---|---|---|---|
| adr_event_0_025_type3_long_only | 17 | 1 | 2025-02 | -1392.85 | 2026-05 | 241798.06 |
| adr_event_0_05_type3_long_only | 17 | 1 | 2025-06 | -1223.34 | 2026-05 | 21203.43 |

## Pair Concentration

| variant_id | marked_net_actual | top_pair | top_pair_contribution_pct | top_3_contribution_pct | remove_best_pair_net_actual | remove_top_3_pairs_net_actual | aud_net_actual | non_aud_net_actual | jpy_cross_net_actual | non_jpy_net_actual |
|---|---|---|---|---|---|---|---|---|---|---|
| adr_event_0_025_type3_long_only | 241798.06 | AUDUSD | 15.921975 | 34.452206 | 203299.03 | 158493.3 | 115862.63 | 125935.44 | 63433.07 | 178364.99 |
| adr_event_0_05_type3_long_only | 21203.43 | AUDCHF | 47.404787 | 90.979609 | 11151.99 | 1912.63 | 21163.25 | 40.18 | 5367.57 | 15835.86 |
| adr_event_0_025_type3_short_only | -117688.33 | CADCHF | -34.758883 | -96.186538 | -158595.48 | -230888.65 | -152587.42 | 34899.09 | -211562.74 | 93874.42 |
| adr_event_0_05_type3_short_only | -12899.16 | GBPAUD | -58.246666 | -148.752925 | -20412.49 | -32087.03 | -20830.5 | 7931.34 | -21477.79 | 8578.63 |
| time_h1_type3_long_only | 727.33 | AUDCHF | 154.689911 | 174.720691 | -397.77 | -543.46 | 1125.1 | -397.77 | 0 | 727.33 |
| time_h1_type3_short_only | 0 |  |  |  | 0 | 0 | 0 | 0 | 0 | 0 |

## Null Controls

These are matched-hold audit controls, not lifecycle strategy variants. Random and shifted controls preserve the audited trade hold duration and long side, then reprice from deterministic alternative entry timestamps.

| variant_id | control_id | trades | net_actual | profit_factor | notes |
|---|---|---|---|---|---|
| adr_event_0_025_type3_long_only | always_long_same_pair_month_total_lots | 202 | 157534.31 | 1.175054 | pair-month long hold using summed actual lot exposure |
| adr_event_0_025_type3_long_only | random_long_entries_same_pair_month_count | 90156 | -52803.89 | 0.834147 | deterministic same symbol/month random start with actual hold duration |
| adr_event_0_025_type3_long_only | shifted_type3_entries_plus_1_events | 90164 | 218431.95 | 3.110333 | shifted ADR-event entry with actual hold duration |
| adr_event_0_025_type3_long_only | shifted_type3_entries_plus_5_events | 90163 | 201608.84 | 2.855812 | shifted ADR-event entry with actual hold duration |
| adr_event_0_025_type3_long_only | shifted_type3_entries_plus_20_events | 90109 | 188687.19 | 2.473985 | shifted ADR-event entry with actual hold duration |
| adr_event_0_05_type3_long_only | always_long_same_pair_month_total_lots | 74 | -2728.57 | 0.972351 | pair-month long hold using summed actual lot exposure |
| adr_event_0_05_type3_long_only | random_long_entries_same_pair_month_count | 8911 | -14866.74 | 0.647758 | deterministic same symbol/month random start with actual hold duration |
| adr_event_0_05_type3_long_only | shifted_type3_entries_plus_1_events | 8912 | 17729.96 | 1.888702 | shifted ADR-event entry with actual hold duration |
| adr_event_0_05_type3_long_only | shifted_type3_entries_plus_5_events | 8902 | 15653.89 | 1.745384 | shifted ADR-event entry with actual hold duration |
| adr_event_0_05_type3_long_only | shifted_type3_entries_plus_20_events | 8895 | 14558.53 | 1.611554 | shifted ADR-event entry with actual hold duration |

## Candidate B Decomposition

| variant_id | bucket | side | trades | net_actual | net_gate95_model |
|---|---|---|---|---|---|
| adr_event_0_025_candidate_b_agreement_strict | agree | BUY | 27093 | 93880.01 | 2771908.22 |
| adr_event_0_025_candidate_b_agreement_strict | agree | SELL | 55622 | -170894.22 | -28063882.18 |
| adr_event_0_025_candidate_b_fade_strict | fade | BUY | 63071 | 147918.05 | 6539271.26 |
| adr_event_0_025_candidate_b_fade_strict | fade | SELL | 33668 | 53205.89 | -5755108.34 |
| adr_event_0_05_candidate_b_agreement_strict | agree | BUY | 2219 | 9948.16 | 636429.96 |
| adr_event_0_05_candidate_b_agreement_strict | agree | SELL | 6648 | -29402.11 | -3544917.3 |
| adr_event_0_05_candidate_b_fade_strict | fade | BUY | 6693 | 11255.27 | 217198.33 |
| adr_event_0_05_candidate_b_fade_strict | fade | SELL | 4369 | 16502.95 | 153607.78 |

## Validation

Validation failures: `2`

| check | value | expected | passed |
|---|---|---|---|
| gate95_oos_artifacts_present | docs/research/gates/gate95/artifacts/limnihedge-type3-28pair-repo-discovery-all28-oos-2025-2026/gate95-config.json plus local full ledgers | config, summary, validation, command receipt, sha manifest, full local ledgers | true |
| gate95_oos_validation_failures | 0 | 0 | true |
| scope_limited_to_gate96a_rows | 2 audit variants, 4 controls | 2 audit variants plus 4 controls | true |
| movement_candle_causality_failures | 0 | 0 | true |
| causality_unique_entry_coverage | 62736/62736 | all unique audited entry ids | true |
| pnl_actual_usd_reconciliation_max_abs_delta | 4184.094116 | <= 0.01 | false |
| actual_usd_conversion_gap_rows | 0 | 0 | true |
| gate95_vs_actual_usd_delta_total | 9901806.27 | <= 1.00 for audited winning rows | false |
| ranked_net_includes_terminal_inventory | closed_plus_marked_actual emitted from closed exits plus terminal inventory | closed + marked open inventory | true |
| month_end_marked_equity_emitted | 34 | >0 | true |
| null_controls_emitted | 10 | always-long, random, shifted +1/+5/+20 for each audit row | true |
| pair_concentration_gate_0_05_remove_best_pair | 11151.99 | >0 | true |
| price_bundle_and_command_receipt_bound | gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953 | gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953 | true |
| history_expansion_not_run | 2025-01-01T00:00:00.000Z..2026-05-31T23:59:59.999Z | 2025-01-01..2026-05-31 only | true |
| mt5_ea_mutated_by_gate96a_script | repo-side artifact audit only | reference-only EA | true |

## Interpretation Boundary

Gate 96A is an audit gate. Any failed validation blocks historical expansion. In particular, material actual-USD conversion deltas mean the Gate 95 dollar headline is not broker-real until accounting is corrected and rerun.

## Artifact Durability

The full row ledgers `causality-audit.rows.*` and `pnl-reconciliation.rows.*` are local-only due size and are hash-bound in `gate96a-sha256.txt`. The committed repo surface is the report, config, command receipt, SHA manifest, validation rows, and compact summary tables.

## Artifacts

- config: `docs/research/gates/gate96a/artifacts/limnihedge-type3-adr-long-causality-accounting-inventory-audit/gate96a-config.json`
- causalityJson: `docs/research/gates/gate96a/artifacts/limnihedge-type3-adr-long-causality-accounting-inventory-audit/causality-audit.rows.json`
- causalityCsv: `docs/research/gates/gate96a/artifacts/limnihedge-type3-adr-long-causality-accounting-inventory-audit/causality-audit.rows.csv`
- pnlJson: `docs/research/gates/gate96a/artifacts/limnihedge-type3-adr-long-causality-accounting-inventory-audit/pnl-reconciliation.rows.json`
- pnlCsv: `docs/research/gates/gate96a/artifacts/limnihedge-type3-adr-long-causality-accounting-inventory-audit/pnl-reconciliation.rows.csv`
- inventoryJson: `docs/research/gates/gate96a/artifacts/limnihedge-type3-adr-long-causality-accounting-inventory-audit/inventory-markout.rows.json`
- inventoryCsv: `docs/research/gates/gate96a/artifacts/limnihedge-type3-adr-long-causality-accounting-inventory-audit/inventory-markout.rows.csv`
- monthJson: `docs/research/gates/gate96a/artifacts/limnihedge-type3-adr-long-causality-accounting-inventory-audit/month-end-marked-equity.rows.json`
- monthCsv: `docs/research/gates/gate96a/artifacts/limnihedge-type3-adr-long-causality-accounting-inventory-audit/month-end-marked-equity.rows.csv`
- monthSummaryJson: `docs/research/gates/gate96a/artifacts/limnihedge-type3-adr-long-causality-accounting-inventory-audit/month-end-marked-equity-summary.rows.json`
- monthSummaryCsv: `docs/research/gates/gate96a/artifacts/limnihedge-type3-adr-long-causality-accounting-inventory-audit/month-end-marked-equity-summary.rows.csv`
- pairJson: `docs/research/gates/gate96a/artifacts/limnihedge-type3-adr-long-causality-accounting-inventory-audit/pair-concentration.rows.json`
- pairCsv: `docs/research/gates/gate96a/artifacts/limnihedge-type3-adr-long-causality-accounting-inventory-audit/pair-concentration.rows.csv`
- currencyJson: `docs/research/gates/gate96a/artifacts/limnihedge-type3-adr-long-causality-accounting-inventory-audit/currency-exposure.rows.json`
- currencyCsv: `docs/research/gates/gate96a/artifacts/limnihedge-type3-adr-long-causality-accounting-inventory-audit/currency-exposure.rows.csv`
- nullJson: `docs/research/gates/gate96a/artifacts/limnihedge-type3-adr-long-causality-accounting-inventory-audit/null-control-summary.rows.json`
- nullCsv: `docs/research/gates/gate96a/artifacts/limnihedge-type3-adr-long-causality-accounting-inventory-audit/null-control-summary.rows.csv`
- candidateJson: `docs/research/gates/gate96a/artifacts/limnihedge-type3-adr-long-causality-accounting-inventory-audit/candidate-b-decomposition.rows.json`
- candidateCsv: `docs/research/gates/gate96a/artifacts/limnihedge-type3-adr-long-causality-accounting-inventory-audit/candidate-b-decomposition.rows.csv`
- validationJson: `docs/research/gates/gate96a/artifacts/limnihedge-type3-adr-long-causality-accounting-inventory-audit/validation.rows.json`
- validationCsv: `docs/research/gates/gate96a/artifacts/limnihedge-type3-adr-long-causality-accounting-inventory-audit/validation.rows.csv`
- commandReceipt: `docs/research/gates/gate96a/artifacts/limnihedge-type3-adr-long-causality-accounting-inventory-audit/command-receipt.json`
- runSummary: `docs/research/gates/gate96a/artifacts/limnihedge-type3-adr-long-causality-accounting-inventory-audit/gate96a-run-summary.json`
- shaManifest: `docs/research/gates/gate96a/artifacts/limnihedge-type3-adr-long-causality-accounting-inventory-audit/gate96a-sha256.txt`
- report: `docs/research/gates/gate96a/GATE96A_LIMNIHEDGE_TYPE3_ADR_LONG_CAUSALITY_ACCOUNTING_INVENTORY_AUDIT_2026-07-04.md`
