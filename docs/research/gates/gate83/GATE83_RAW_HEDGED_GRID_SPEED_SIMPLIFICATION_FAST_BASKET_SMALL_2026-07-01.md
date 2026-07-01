# Gate 83 Raw Hedged Grid Speed Simplification

Generated: `2026-07-01T09:02:49.196Z`

## Verdict

`PASS_RAW_HEDGED_GRID_SPEED_SIMPLIFICATION_BUILT_NO_PROMOTION`

## Scope

- Warehouse/backtester-only speed simplification for raw fully hedged grid mechanics.
- Variant: `RAW_HEDGED_GRID_T100_S020_NO_BOUNDARY`.
- T100/S020 only: target `1` ADR and spacing `0.2` ADR.
- No direction signal, no Candidate B pair selection, no COT, Strength, Regime, risk layer, Grid Cap, pair-net flatten, trailing, Pine price-anchor mode, MT5 compile, MT5 Strategy Tester run, optimization, promotion, or live-readiness claim.
- No artificial weekly execution boundary is active in this runner. The old Sunday 20:00 ET to Friday 11:00 ET action window is not used.
- Week identity is retained for warehouse grouping and reporting only. This remains a pair-week warehouse replay, not a cross-week carried-position EA simulator.
- Cost ladder is ADR-normalized all-in execution cost for spread, slippage, and commission.

## Cost Ladder Summary

| variant_id | speed_profile | weeks_replayed | pairs_replayed | cost_fraction | final_equity_mtm_adr | closed_pnl_after_cost_adr | open_unrealized_pnl_adr | liquidation_mtm_after_estimated_exit_cost_adr | max_equity_drawdown_adr | max_balance_drawdown_adr | return_dd_ratio | weekly_mtm_profit_factor | weekly_win_rate | fills | total_modeled_execution_cost_with_liquidation_adr | cost_drag_pct_of_gross_profit | max_open_positions | worst_drawdown_window_start_utc | worst_drawdown_window_end_utc |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| RAW_HEDGED_GRID_T100_S020_NO_BOUNDARY | FAST_BASKET | 1 | 4 | 0 | 9.561754 | 21.450233 | -11.888479 | 9.561754 | 0 | 0 |  |  | 1 | 106 | 0 | 0 | 13 |  |  |
| RAW_HEDGED_GRID_T100_S020_NO_BOUNDARY | FAST_BASKET | 1 | 4 | 0.0025 | 9.343004 | 21.277733 | -11.888479 | 9.296754 | 0 | 0 |  |  | 1 | 106 | 0.265 | 1.235418 | 13 |  |  |
| RAW_HEDGED_GRID_T100_S020_NO_BOUNDARY | FAST_BASKET | 1 | 4 | 0.005 | 9.124254 | 21.105233 | -11.888479 | 9.031754 | 0 | 0 |  |  | 1 | 106 | 0.53 | 2.470836 | 13 |  |  |
| RAW_HEDGED_GRID_T100_S020_NO_BOUNDARY | FAST_BASKET | 1 | 4 | 0.01 | 8.686754 | 20.760233 | -11.888479 | 8.501754 | 0 | 0 |  |  | 1 | 106 | 1.06 | 4.941671 | 13 |  |  |
| RAW_HEDGED_GRID_T100_S020_NO_BOUNDARY | FAST_BASKET | 1 | 4 | 0.02 | 7.811754 | 20.070233 | -11.888479 | 7.441754 | 0 | 0 |  |  | 1 | 106 | 2.12 | 9.883343 | 13 |  |  |
| RAW_HEDGED_GRID_T100_S020_NO_BOUNDARY | FAST_BASKET | 1 | 4 | 0.05 | 5.186754 | 18.000233 | -11.888479 | 4.261754 | 0 | 0 |  |  | 1 | 106 | 5.3 | 24.708356 | 13 |  |  |
| RAW_HEDGED_GRID_T100_S020_NO_BOUNDARY | FAST_BASKET | 1 | 4 | 0.1 | 0.811754 | 14.550233 | -11.888479 | -1.038246 | 0 | 0 |  |  | 1 | 106 | 10.6 | 49.416713 | 13 |  |  |
| RAW_HEDGED_GRID_T100_S020_NO_BOUNDARY | FAST_BASKET | 1 | 4 | 0.2 | -7.938246 | 7.650233 | -11.888479 | -11.638246 | -7.938246 | 0 | -1 | 0 | 0 | 106 | 21.2 | 98.833425 | 13 |  | 2019-04-14T23:00:00.000Z |
| RAW_HEDGED_GRID_T100_S020_NO_BOUNDARY | FAST_BASKET | 1 | 4 | 0.5 | -34.188246 | -13.049767 | -11.888479 | -43.438246 | -34.188246 | -13.049767 | -1 | 0 | 0 | 106 | 53 | 247.083563 | 13 |  | 2019-04-14T23:00:00.000Z |

## Metric Definitions

| metric | definition |
|---|---|
| final_equity_mtm_adr | closed PnL after modeled costs plus gross open MTM after modeled entry cost, before open liquidation exit cost |
| liquidation_mtm_after_estimated_exit_cost_adr | final equity MTM after subtracting estimated exit cost for all open positions |
| closed_pnl_after_cost_adr | realized target closes after entry and exit execution-cost stress |
| cost_fraction | round-trip all-in execution cost as a fraction of target ADR |
| weekly_execution_boundary_active | false for this runner; no Sunday 20 ET or Friday 11 ET artificial action cutoff is applied |
| week_identity_reporting_only | warehouse week key is retained for grouping and output; strategy opens, fills, closes, and resets inside each available row without old cutoff checks |
| max_equity_drawdown_adr | peak-to-trough drawdown over weekly mark-to-market snapshots before open liquidation exit cost |
| max_balance_drawdown_adr | peak-to-trough drawdown over realized balance after modeled costs; secondary to MTM drawdown |

## Validation

| check | value | expected | passed |
|---|---|---|---|
| gate74b_verdict | PASS_GATE74B_TRADE_LEG_PATH_MATERIALIZATION__POLICY_NEUTRAL_PAIR_WEEK_PATH_WAREHOUSE_READY |  | true |
| manifest_complete | complete |  | true |
| same_manifest_as_gate74b_summary | gate74b_trade_leg_path_ECDE7C4A6553 | gate74b_trade_leg_path_ECDE7C4A6553 | true |
| same_warehouse_hash_as_gate74b_summary | 36290BFDD28B47AFF31CA798C75ED1E7736A4778EBAA3E5FFAB64ECA07C462CC | 36290BFDD28B47AFF31CA798C75ED1E7736A4778EBAA3E5FFAB64ECA07C462CC | true |
| raw_only_no_direction_signal | true |  | true |
| candidate_b_mutated | false |  | true |
| candidate_b_pair_selection_used | false |  | true |
| candidate_b_side_used_only_for_path_price_reconstruction | true |  | true |
| weekly_execution_boundary_active | false |  | true |
| week_identity_reporting_only | true |  | true |
| grid_cap_active | false |  | true |
| pine_price_anchor_active | false |  | true |
| pair_net_flatten_active | false |  | true |
| cost_ladder_tiers | 0,0.0025,0.005,0.01,0.02,0.05,0.1,0.2,0.5 |  | true |
| mt5_ea_touched | false |  | true |
| promotion_claimed | false |  | true |
| full_acceptance_week_count | 1 | 373 | true |
| full_acceptance_pair_count | 4 | 28 | true |

## Artifacts

- summaryJson: `docs/research/gates/gate83/artifacts/fast-basket-small/cost-ladder-summary.rows.json`
- summaryCsv: `docs/research/gates/gate83/artifacts/fast-basket-small/cost-ladder-summary.rows.csv`
- weeklyGrossJson: `docs/research/gates/gate83/artifacts/fast-basket-small/weekly-gross-mtm.rows.json`
- weeklyGrossCsv: `docs/research/gates/gate83/artifacts/fast-basket-small/weekly-gross-mtm.rows.csv`
- weeklyCostJson: `docs/research/gates/gate83/artifacts/fast-basket-small/weekly-cost-ladder-mtm.rows.json`
- weeklyCostCsv: `docs/research/gates/gate83/artifacts/fast-basket-small/weekly-cost-ladder-mtm.rows.csv`
- closeEventsJson: `docs/research/gates/gate83/artifacts/fast-basket-small/close-events.rows.json`
- closeEventsCsv: `docs/research/gates/gate83/artifacts/fast-basket-small/close-events.rows.csv`
- pairContributionJson: `docs/research/gates/gate83/artifacts/fast-basket-small/worst-drawdown-pair-contribution.rows.json`
- pairContributionCsv: `docs/research/gates/gate83/artifacts/fast-basket-small/worst-drawdown-pair-contribution.rows.csv`
- validationJson: `docs/research/gates/gate83/artifacts/fast-basket-small/validation.rows.json`
- validationCsv: `docs/research/gates/gate83/artifacts/fast-basket-small/validation.rows.csv`
- metricDefinitionsJson: `docs/research/gates/gate83/artifacts/fast-basket-small/metric-definitions.rows.json`
- metricDefinitionsCsv: `docs/research/gates/gate83/artifacts/fast-basket-small/metric-definitions.rows.csv`
- commandReceipt: `docs/research/gates/gate83/artifacts/fast-basket-small/command-receipt.json`
- runSummaryJson: `docs/research/gates/gate83/artifacts/fast-basket-small/gate83-run-summary.json`
- shaManifest: `docs/research/gates/gate83/artifacts/fast-basket-small/gate83-raw-speed-sha256.txt`
- report: `docs/research/gates/gate83/GATE83_RAW_HEDGED_GRID_SPEED_SIMPLIFICATION_FAST_BASKET_SMALL_2026-07-01.md`

## Stop Line

Gate 83 is warehouse diagnostic evidence only. MT5 EA simplification, dangerous-fill guard implementation, MT5 compile/tester work, live trading, risk layer, parameter optimization, and promotion remain closed.
