# Gate 82D Hedged Grid V2 Price Anchor Comparison

Generated: `2026-07-01T06:00:37.534Z`

## Verdict

`PASS_GATE82D_PRICE_ANCHOR_V2_WAREHOUSE_COMPARISON_BUILT_NO_PROMOTION`

## Scope

- Diagnostic warehouse comparison opened by Freedom before the next MT5 decision.
- Same Gate 74B/Gate 80 warehouse lineage, universe, date range, T100 target, and S020 spacing.
- Old raw fill-anchor L3 and no-limit rows are imported from Gate 80 artifacts and labeled with their source rule IDs.
- V2 rows replay price-anchor first-entry logic: seed weekly anchor first, then use previous anchor high/low for long/short first-entry levels.
- `GRID_CAP_3` uses the inherited side-local three target-reset cap only as a starting point; this gate does not optimize the cap.
- No Candidate B mutation, COT, Strength, Regime, risk layer, MT5 compile/tester run, all-28 runtime, optimization, promotion, or live-readiness claim.

Post-run caveat: Gate 82E corrected the active weekly boundary contract to one
trade window, Sunday 20:00 ET through Friday 11:00 ET, with no entries, grid
fills, or target closes outside that window. Gate 82D did not replay both old
raw fill-anchor and new price-anchor rows under that corrected single-window
contract, so it is diagnostic evidence only and not replacement evidence.

## Variant Comparison

| variant_id | final_equity_adr | closed_adr | final_open_unrealized_adr | worst_open_unrealized_adr | max_drawdown_adr | return_dd_ratio | weekly_mtm_profit_factor | weekly_sharpe | weekly_sortino | weekly_win_rate | monthly_win_rate | worst_weekly_mtm_loss_adr | worst_13_week_aggregate_mtm_loss_adr | fills | resets | pair_net_flatten_reset_count | active_side_week_count | max_open_position_inventory_count | gate81_style_stressed_cost_final_equity_adr | metric_semantics | gate80_reference_rule_id |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| HEDGED_GRID_T100_S020_L3_RAW | 53646.297719 | 53870.954145 | -224.656426 | -966.732115 | -705.647194 | 76.024249 | 10.308136 | 0.856116 | 1.103443 | 0.857909 | 0.965116 | -705.647194 | 915.954548 | 204752 | 48500 | 0 | 20888 | 56 | 42637.417719 | imported_gate80_artifact | FULLY_HEDGED_LONG_SHORT_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE |
| HEDGED_GRID_T100_S020_NO_LIMIT_RAW | 82549.112283 | 82805.435182 | -256.322899 | -1927.15691 | -1167.092908 | 70.730541 | 22.70833 | 1.007575 | 0.902634 | 0.932976 | 0.988372 | -1167.092908 | 1520.691714 | 305641 | 74186 | 0 | 20888 | 56 | 65307.632283 | imported_gate80_artifact | FULLY_HEDGED_LONG_SHORT_28_PAIR_WEEKLY_T100_S020_NO_LIMIT_REFERENCE |
| HEDGED_GRID_V2_RAW_PRICE_ANCHOR | 31861.651847 | 31940.162404 | -78.510557 | -1412.179673 | -1135.436382 | 28.061151 | 5.979238 | 0.523782 | 0.497149 | 0.841823 | 0.953488 | -1135.436382 | -89.479319 | 172568 | 28297 | 0 | 17254 | 57 | 23060.711847 | price_anchor_v2_replay |  |
| HEDGED_GRID_V2_GRID_CAP_3_PRICE_ANCHOR | 28128.243783 | 28202.238439 | -73.994656 | -1034.302267 | -855.413524 | 32.882627 | 5.571719 | 0.538358 | 0.555296 | 0.831099 | 0.94186 | -855.413524 | 81.181583 | 151272 | 25155 | 0 | 17254 | 50 | 20392.103783 | price_anchor_v2_replay |  |

## V2 Interpretation

| comparison | final_equity_delta_adr | final_open_delta_adr | worst_open_delta_adr |
|---|---|---|---|
| old no-limit raw fill-anchor vs V2 RAW price-anchor | -50687.460436 | 177.812342 | 514.977237 |
| old L3 raw fill-anchor vs V2 GRID_CAP_3 price-anchor | -25518.053936 | 150.66177 | -67.570152 |
| V2 RAW price-anchor vs V2 GRID_CAP_3 price-anchor | -3733.408064 | 4.515901 | 377.877406 |

Positive deltas mean the V2 comparator improved that metric versus the reference row. Negative final-equity deltas mean the price-anchor or cap change reduced harvest versus the old fill-anchor reference.

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
| resets | side target resets; GRID_CAP_3 inherits a three-reset side cap per pair/week/side |
| pair_net_flatten_reset_count | kept as zero-valued schema continuity with Gate 82; Gate 82D does not replay pair-net flattening |
| active_side_week_count | count of pair/week/side slots that opened at least one cycle |
| gate81_style_stressed_cost_final_equity_adr | gross final equity less 0.05 ADR per fill and 0.01 ADR per active side-week |
| price_anchor_v2_replay | weekly price anchor is seeded first; first-entry levels use previous anchor high/low and row entry-price ADR-distance proxy |

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
| price_anchor_v2_rows_present | HEDGED_GRID_V2_RAW_PRICE_ANCHOR,HEDGED_GRID_V2_GRID_CAP_3_PRICE_ANCHOR | HEDGED_GRID_V2_RAW_PRICE_ANCHOR,HEDGED_GRID_V2_GRID_CAP_3_PRICE_ANCHOR | true |
| grid_cap_3_visible_but_not_optimized | price_anchor_v2_grid_cap_3_inherited_cap_not_optimized | inherited_cap_not_optimized | true |
| candidate_b_mutated | false |  | true |
| cot_strength_regime_used | false |  | true |
| risk_layer_started | false |  | true |
| mt5_compile_or_tester_run | false |  | true |
| promotion_claimed | false |  | true |

## Artifacts

- comparisonJson: `docs/research/gates/gate82d/artifacts/gate82d-hedged-grid-v2-price-anchor-comparison/v2-price-anchor-comparison.rows.json`
- comparisonCsv: `docs/research/gates/gate82d/artifacts/gate82d-hedged-grid-v2-price-anchor-comparison/v2-price-anchor-comparison.rows.csv`
- weeklyEquityJson: `docs/research/gates/gate82d/artifacts/gate82d-hedged-grid-v2-price-anchor-comparison/weekly-equity.rows.json`
- weeklyEquityCsv: `docs/research/gates/gate82d/artifacts/gate82d-hedged-grid-v2-price-anchor-comparison/weekly-equity.rows.csv`
- closeReasonJson: `docs/research/gates/gate82d/artifacts/gate82d-hedged-grid-v2-price-anchor-comparison/close-reason-breakdown.rows.json`
- closeReasonCsv: `docs/research/gates/gate82d/artifacts/gate82d-hedged-grid-v2-price-anchor-comparison/close-reason-breakdown.rows.csv`
- validationJson: `docs/research/gates/gate82d/artifacts/gate82d-hedged-grid-v2-price-anchor-comparison/validation.rows.json`
- validationCsv: `docs/research/gates/gate82d/artifacts/gate82d-hedged-grid-v2-price-anchor-comparison/validation.rows.csv`
- metricDefinitionsJson: `docs/research/gates/gate82d/artifacts/gate82d-hedged-grid-v2-price-anchor-comparison/metric-definitions.rows.json`
- metricDefinitionsCsv: `docs/research/gates/gate82d/artifacts/gate82d-hedged-grid-v2-price-anchor-comparison/metric-definitions.rows.csv`
- commandReceipt: `docs/research/gates/gate82d/artifacts/gate82d-hedged-grid-v2-price-anchor-comparison/command-receipt.json`
- summaryJson: `docs/research/gates/gate82d/artifacts/gate82d-hedged-grid-v2-price-anchor-comparison/gate82d-price-anchor-summary.json`
- shaIdentity: `docs/research/gates/gate82d/artifacts/gate82d-hedged-grid-v2-price-anchor-comparison/gate82d-price-anchor-sha256.txt`
- report: `docs/research/gates/gate82d/GATE82D_HEDGED_GRID_V2_PRICE_ANCHOR_COMPARISON_2026-07-01.md`

## Stop Line

Gate 82D is diagnostic warehouse evidence only. No MT5 compile, no MT5 Strategy Tester claim, no cap optimization, no promotion, no all-28 runtime, no risk layer, no signal research, and no live-capital claim.
