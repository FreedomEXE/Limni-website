# Gate 82 Hedged Grid Four Variant Preflight

Generated: `2026-06-30T20:17:40.181Z`

## Verdict

`PASS_FOUR_VARIANT_HEDGED_GRID_DIAGNOSTIC_BUILT_NO_PROMOTION`

## Scope

- Diagnostic four-variant hedged-grid comparison before one-pair MT5 prototype work.
- Same Gate 74B/Gate 80 warehouse lineage, universe, date range, T100 target, and S020 spacing.
- Raw L3 and raw no-limit rows are imported from Gate 80 artifacts and labeled with their source rule IDs.
- Pair-net variants add a deterministic total pair-cycle MTM `+1 ADR` flatten/reset rule.
- The L3 pair-net flatten/reset counts against the L3 reset cap and cannot bypass it.
- No Candidate B mutation, COT, Strength, Regime, risk layer, MT5 code, all-28 runtime, optimization, promotion, or live-readiness claim.

## Four Variant Comparison

| variant_id | final_equity_adr | closed_adr | final_open_unrealized_adr | worst_open_unrealized_adr | max_drawdown_adr | return_dd_ratio | weekly_mtm_profit_factor | weekly_sharpe | weekly_sortino | weekly_win_rate | monthly_win_rate | worst_weekly_mtm_loss_adr | worst_13_week_aggregate_mtm_loss_adr | fills | resets | pair_net_flatten_reset_count | active_side_week_count | max_open_position_inventory_count | gate81_style_stressed_cost_final_equity_adr | metric_semantics | gate80_reference_rule_id |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| HEDGED_GRID_T100_S020_L3_RAW | 53646.297719 | 53870.954145 | -224.656426 | -966.732115 | -705.647194 | 76.024249 | 10.308136 | 0.856116 | 1.103443 | 0.857909 | 0.965116 | -705.647194 | 915.954548 | 204752 | 48500 | 0 | 20888 | 56 | 42637.417719 | imported_gate80_artifact | FULLY_HEDGED_LONG_SHORT_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE |
| HEDGED_GRID_T100_S020_NO_LIMIT_RAW | 82549.112283 | 82805.435182 | -256.322899 | -1927.15691 | -1167.092908 | 70.730541 | 22.70833 | 1.007575 | 0.902634 | 0.932976 | 0.988372 | -1167.092908 | 1520.691714 | 305641 | 74186 | 0 | 20888 | 56 | 65307.632283 | imported_gate80_artifact | FULLY_HEDGED_LONG_SHORT_28_PAIR_WEEKLY_T100_S020_NO_LIMIT_REFERENCE |
| HEDGED_GRID_T100_S020_L3_PAIR_NET_TP_1ADR | 18485.96236 | 18620.033363 | -134.071003 | -579.311431 | -512.875076 | 36.043792 | 4.865168 | 0.531734 | 0.502998 | 0.839142 | 0.976744 | -512.875076 | 56.476465 | 203683 | 41396 | 13864 | 20888 | 35 | 10650.58236 | new_pair_net_variant |  |
| HEDGED_GRID_T100_S020_NO_LIMIT_PAIR_NET_TP_1ADR | 49969.699611 | 50157.820093 | -188.120482 | -1401.686805 | -904.007419 | 55.275763 | 11.50173 | 0.773924 | 0.805037 | 0.895442 | 0.976744 | -904.007419 | 795.706991 | 530415 | 96497 | 24314 | 20888 | 63 | 30325.019611 | new_pair_net_variant |  |

## Pair-Net Interpretation

| comparison | final_equity_delta_adr | final_open_delta_adr | worst_open_delta_adr |
|---|---|---|---|
| L3 raw vs L3 pair-net +1ADR | -35160.335359 | 90.585423 | 387.420684 |
| no-limit raw vs no-limit pair-net +1ADR | -32579.412672 | 68.202417 | 525.470105 |

Positive open deltas mean the pair-net row has less negative open inventory than its raw anchor. Final-equity deltas show whether that inventory relief destroyed the harvest engine.

## Metric Definitions

| metric | definition |
|---|---|
| final_equity_adr | cumulative closed ADR plus final week-end open unrealized ADR |
| closed_adr | sum of realized non-sample-end closes in ADR units |
| final_open_unrealized_adr | week-end open unrealized ADR at the final replay week |
| worst_open_unrealized_adr | most negative week-end open unrealized ADR across the replay |
| max_drawdown_adr | max peak-to-trough drawdown of weekly mark-to-market equity snapshots |
| return_dd_ratio | final equity ADR divided by absolute max drawdown ADR |
| weekly_mtm_profit_factor | profit factor over weekly mark-to-market equity deltas |
| weekly_sharpe | ADR-normalized mean weekly MTM delta divided by weekly standard deviation; diagnostic only |
| weekly_sortino | ADR-normalized mean weekly MTM delta divided by downside weekly standard deviation; diagnostic only |
| weekly_win_rate | share of replay weeks with positive weekly MTM delta |
| monthly_win_rate | share of calendar months with positive summed weekly MTM delta |
| fills | sum of open and closed cycle fill quantities, including initial fills and sample-end open inventory fills |
| resets | side target resets plus pair-net flatten resets; pair-net flatten increments once per full pair flatten |
| pair_net_flatten_reset_count | count of full long+short pair flatten/reset events triggered by total pair-cycle MTM at +1 ADR |
| active_side_week_count | count of pair/week/side slots that opened at least one cycle |
| gate81_style_stressed_cost_final_equity_adr | gross final equity less 0.05 ADR per fill and 0.01 ADR per active side-week |

## Validation

| check | value | expected | passed |
|---|---|---|---|
| gate74b_verdict | PASS_GATE74B_TRADE_LEG_PATH_MATERIALIZATION__POLICY_NEUTRAL_PAIR_WEEK_PATH_WAREHOUSE_READY |  | true |
| gate80_verdict | PASS_HEDGED_BASELINE_PROMISING_BUT_COST_MARGIN_VALIDATION_REQUIRED_NO_PROMOTION |  | true |
| manifest_complete | complete |  | true |
| same_manifest_as_gate80 | gate74b_trade_leg_path_ECDE7C4A6553 | gate74b_trade_leg_path_ECDE7C4A6553 | true |
| same_warehouse_hash_as_gate80 | 36290BFDD28B47AFF31CA798C75ED1E7736A4778EBAA3E5FFAB64ECA07C462CC | 36290BFDD28B47AFF31CA798C75ED1E7736A4778EBAA3E5FFAB64ECA07C462CC | true |
| week_count | 373 | 373 | true |
| pair_count | 28 | 28 | true |
| pair_week_rows | 10444 | 10444 | true |
| raw_rows_imported_from_gate80 | FULLY_HEDGED_LONG_SHORT_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE,FULLY_HEDGED_LONG_SHORT_28_PAIR_WEEKLY_T100_S020_NO_LIMIT_REFERENCE |  | true |
| pair_net_rows_present | 2 | 2 | true |
| pair_net_flatten_counts_visible | 13864,24314 |  | true |
| candidate_b_mutated | false |  | true |
| cot_strength_regime_used | false |  | true |
| risk_layer_started | false |  | true |
| mt5_code_written | false |  | true |
| promotion_claimed | false |  | true |

## Artifacts

- comparisonJson: `docs/research/gates/gate82_preflight/artifacts/gate82-hedged-grid-four-variant-preflight/four-variant-comparison.rows.json`
- comparisonCsv: `docs/research/gates/gate82_preflight/artifacts/gate82-hedged-grid-four-variant-preflight/four-variant-comparison.rows.csv`
- weeklyEquityJson: `docs/research/gates/gate82_preflight/artifacts/gate82-hedged-grid-four-variant-preflight/weekly-equity.rows.json`
- weeklyEquityCsv: `docs/research/gates/gate82_preflight/artifacts/gate82-hedged-grid-four-variant-preflight/weekly-equity.rows.csv`
- closeReasonJson: `docs/research/gates/gate82_preflight/artifacts/gate82-hedged-grid-four-variant-preflight/close-reason-breakdown.rows.json`
- closeReasonCsv: `docs/research/gates/gate82_preflight/artifacts/gate82-hedged-grid-four-variant-preflight/close-reason-breakdown.rows.csv`
- validationJson: `docs/research/gates/gate82_preflight/artifacts/gate82-hedged-grid-four-variant-preflight/validation.rows.json`
- validationCsv: `docs/research/gates/gate82_preflight/artifacts/gate82-hedged-grid-four-variant-preflight/validation.rows.csv`
- metricDefinitionsJson: `docs/research/gates/gate82_preflight/artifacts/gate82-hedged-grid-four-variant-preflight/metric-definitions.rows.json`
- metricDefinitionsCsv: `docs/research/gates/gate82_preflight/artifacts/gate82-hedged-grid-four-variant-preflight/metric-definitions.rows.csv`
- commandReceipt: `docs/research/gates/gate82_preflight/artifacts/gate82-hedged-grid-four-variant-preflight/command-receipt.json`
- summaryJson: `docs/research/gates/gate82_preflight/artifacts/gate82-hedged-grid-four-variant-preflight/gate82-preflight-summary.json`
- shaIdentity: `docs/research/gates/gate82_preflight/artifacts/gate82-hedged-grid-four-variant-preflight/gate82-preflight-sha256.txt`
- report: `docs/research/gates/gate82_preflight/GATE82_HEDGED_GRID_FOUR_VARIANT_PREFLIGHT_2026-06-30.md`

## Stop Line

Gate 82 preflight is diagnostic evidence only. No MT5 code was written in this gate. No promotion, no all-28 runtime, no risk layer, no signal research, and no live-capital claim.
