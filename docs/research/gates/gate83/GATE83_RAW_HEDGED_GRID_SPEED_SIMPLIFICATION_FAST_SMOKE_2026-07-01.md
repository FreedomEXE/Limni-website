# Gate 83 Raw Hedged Grid Speed Simplification

Generated: `2026-07-01T09:09:21.484Z`

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
| RAW_HEDGED_GRID_T100_S020_NO_BOUNDARY | FAST_SMOKE | 1 | 1 | 0 | 7.493187 | 8.262829 | -0.769642 | 7.493187 | 0 | 0 |  |  | 1 | 37 | 0 | 0 | 9 |  |  |
| RAW_HEDGED_GRID_T100_S020_NO_BOUNDARY | FAST_SMOKE | 1 | 1 | 0.0025 | 7.409437 | 8.187829 | -0.769642 | 7.400687 | 0 | 0 |  |  | 1 | 37 | 0.0925 | 1.119471 | 9 |  |  |
| RAW_HEDGED_GRID_T100_S020_NO_BOUNDARY | FAST_SMOKE | 1 | 1 | 0.005 | 7.325687 | 8.112829 | -0.769642 | 7.308187 | 0 | 0 |  |  | 1 | 37 | 0.185 | 2.238943 | 9 |  |  |
| RAW_HEDGED_GRID_T100_S020_NO_BOUNDARY | FAST_SMOKE | 1 | 1 | 0.01 | 7.158187 | 7.962829 | -0.769642 | 7.123187 | 0 | 0 |  |  | 1 | 37 | 0.37 | 4.477885 | 9 |  |  |
| RAW_HEDGED_GRID_T100_S020_NO_BOUNDARY | FAST_SMOKE | 1 | 1 | 0.02 | 6.823187 | 7.662829 | -0.769642 | 6.753187 | 0 | 0 |  |  | 1 | 37 | 0.74 | 8.95577 | 9 |  |  |
| RAW_HEDGED_GRID_T100_S020_NO_BOUNDARY | FAST_SMOKE | 1 | 1 | 0.05 | 5.818187 | 6.762829 | -0.769642 | 5.643187 | 0 | 0 |  |  | 1 | 37 | 1.85 | 22.389426 | 9 |  |  |
| RAW_HEDGED_GRID_T100_S020_NO_BOUNDARY | FAST_SMOKE | 1 | 1 | 0.1 | 4.143187 | 5.262829 | -0.769642 | 3.793187 | 0 | 0 |  |  | 1 | 37 | 3.7 | 44.778852 | 9 |  |  |
| RAW_HEDGED_GRID_T100_S020_NO_BOUNDARY | FAST_SMOKE | 1 | 1 | 0.2 | 0.793187 | 2.262829 | -0.769642 | 0.093187 | 0 | 0 |  |  | 1 | 37 | 7.4 | 89.557705 | 9 |  |  |
| RAW_HEDGED_GRID_T100_S020_NO_BOUNDARY | FAST_SMOKE | 1 | 1 | 0.5 | -9.256813 | -6.737171 | -0.769642 | -11.006813 | -9.256813 | -6.737171 | -1 | 0 | 0 | 37 | 18.5 | 223.894262 | 9 |  | 2019-04-14T23:00:00.000Z |

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
| full_acceptance_pair_count | 1 | 28 | true |

## Artifacts

- summaryJson: `docs/research/gates/gate83/artifacts/fast-smoke/cost-ladder-summary.rows.json`
- summaryCsv: `docs/research/gates/gate83/artifacts/fast-smoke/cost-ladder-summary.rows.csv`
- weeklyGrossJson: `docs/research/gates/gate83/artifacts/fast-smoke/weekly-gross-mtm.rows.json`
- weeklyGrossCsv: `docs/research/gates/gate83/artifacts/fast-smoke/weekly-gross-mtm.rows.csv`
- weeklyCostJson: `docs/research/gates/gate83/artifacts/fast-smoke/weekly-cost-ladder-mtm.rows.json`
- weeklyCostCsv: `docs/research/gates/gate83/artifacts/fast-smoke/weekly-cost-ladder-mtm.rows.csv`
- closeEventsJson: `docs/research/gates/gate83/artifacts/fast-smoke/close-events.rows.json`
- closeEventsCsv: `docs/research/gates/gate83/artifacts/fast-smoke/close-events.rows.csv`
- pairContributionJson: `docs/research/gates/gate83/artifacts/fast-smoke/worst-drawdown-pair-contribution.rows.json`
- pairContributionCsv: `docs/research/gates/gate83/artifacts/fast-smoke/worst-drawdown-pair-contribution.rows.csv`
- validationJson: `docs/research/gates/gate83/artifacts/fast-smoke/validation.rows.json`
- validationCsv: `docs/research/gates/gate83/artifacts/fast-smoke/validation.rows.csv`
- metricDefinitionsJson: `docs/research/gates/gate83/artifacts/fast-smoke/metric-definitions.rows.json`
- metricDefinitionsCsv: `docs/research/gates/gate83/artifacts/fast-smoke/metric-definitions.rows.csv`
- commandReceipt: `docs/research/gates/gate83/artifacts/fast-smoke/command-receipt.json`
- runSummaryJson: `docs/research/gates/gate83/artifacts/fast-smoke/gate83-run-summary.json`
- shaManifest: `docs/research/gates/gate83/artifacts/fast-smoke/gate83-raw-speed-sha256.txt`
- report: `docs/research/gates/gate83/GATE83_RAW_HEDGED_GRID_SPEED_SIMPLIFICATION_FAST_SMOKE_2026-07-01.md`

## Stop Line

Gate 83 is warehouse diagnostic evidence only. MT5 EA simplification, dangerous-fill guard implementation, MT5 compile/tester work, live trading, risk layer, parameter optimization, and promotion remain closed.
