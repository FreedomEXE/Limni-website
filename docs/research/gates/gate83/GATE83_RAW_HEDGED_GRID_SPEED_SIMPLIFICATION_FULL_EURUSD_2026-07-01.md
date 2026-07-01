# Gate 83 Raw Hedged Grid Speed Simplification

Generated: `2026-07-01T09:36:57.690Z`

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
| RAW_HEDGED_GRID_T100_S020_NO_BOUNDARY | FULL_PAIR_HISTORY | 373 | 1 | 0 | 2937.283889 | 2944.614951 | -7.331062 | 2937.283889 | -87.975012 | 0 | 33.387707 | 6.594031 | 0.836461 | 15471 | 0 | 0 | 39 | 2025-02-24T00:00:00.000Z | 2025-03-03T00:00:00.000Z |
| RAW_HEDGED_GRID_T100_S020_NO_BOUNDARY | FULL_PAIR_HISTORY | 373 | 1 | 0.0025 | 2910.340139 | 2917.684951 | -7.331062 | 2910.326389 | -88.138762 | 0 | 33.01998 | 6.490368 | 0.831099 | 15471 | 38.6775 | 1.313499 | 39 | 2025-02-24T00:00:00.000Z | 2025-03-03T00:00:00.000Z |
| RAW_HEDGED_GRID_T100_S020_NO_BOUNDARY | FULL_PAIR_HISTORY | 373 | 1 | 0.005 | 2883.396389 | 2890.754951 | -7.331062 | 2883.368889 | -88.302512 | 0 | 32.653617 | 6.38735 | 0.831099 | 15471 | 77.355 | 2.626999 | 39 | 2025-02-24T00:00:00.000Z | 2025-03-03T00:00:00.000Z |
| RAW_HEDGED_GRID_T100_S020_NO_BOUNDARY | FULL_PAIR_HISTORY | 373 | 1 | 0.01 | 2829.508889 | 2836.894951 | -7.331062 | 2829.453889 | -88.630012 | 0 | 31.924952 | 6.185365 | 0.825737 | 15471 | 154.71 | 5.253998 | 39 | 2025-02-24T00:00:00.000Z | 2025-03-03T00:00:00.000Z |
| RAW_HEDGED_GRID_T100_S020_NO_BOUNDARY | FULL_PAIR_HISTORY | 373 | 1 | 0.02 | 2721.733889 | 2729.174951 | -7.331062 | 2721.623889 | -89.285012 | 0 | 30.483659 | 5.798787 | 0.823056 | 15471 | 309.42 | 10.507995 | 39 | 2025-02-24T00:00:00.000Z | 2025-03-03T00:00:00.000Z |
| RAW_HEDGED_GRID_T100_S020_NO_BOUNDARY | FULL_PAIR_HISTORY | 373 | 1 | 0.05 | 2398.408889 | 2406.014951 | -7.331062 | 2398.133889 | -91.609813 | 0 | 26.180698 | 4.769259 | 0.796247 | 15471 | 773.55 | 26.269988 | 39 | 2025-02-17T00:00:00.000Z | 2025-03-03T00:00:00.000Z |
| RAW_HEDGED_GRID_T100_S020_NO_BOUNDARY | FULL_PAIR_HISTORY | 373 | 1 | 0.1 | 1859.533889 | 1867.414951 | -7.331062 | 1858.983889 | -96.084813 | 0 | 19.353047 | 3.390424 | 0.726542 | 15471 | 1547.1 | 52.539976 | 39 | 2025-02-17T00:00:00.000Z | 2025-03-03T00:00:00.000Z |
| RAW_HEDGED_GRID_T100_S020_NO_BOUNDARY | FULL_PAIR_HISTORY | 373 | 1 | 0.2 | 781.783889 | 790.214951 | -7.331062 | 780.683889 | -105.034813 | 0 | 7.443093 | 1.666761 | 0.619303 | 15471 | 3094.2 | 105.079953 | 39 | 2025-02-17T00:00:00.000Z | 2025-03-03T00:00:00.000Z |
| RAW_HEDGED_GRID_T100_S020_NO_BOUNDARY | FULL_PAIR_HISTORY | 373 | 1 | 0.5 | -2451.466111 | -2441.385049 | -7.331062 | -2454.216111 | -2451.466111 | -2441.385049 | -1 | 0.288574 | 0.252011 | 15471 | 7735.5 | 262.699882 | 39 |  | 2026-05-31T23:00:00.000Z |

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
| full_acceptance_week_count | not_applicable | FULL_ACCEPTANCE only | true |
| full_acceptance_pair_count | not_applicable | FULL_ACCEPTANCE only | true |
| full_pair_history_week_count | 373 | 373 | true |
| full_pair_history_has_eurusd | true | true | true |
| full_pair_history_pair_count_at_least_one | 1 | >=1 | true |

## Artifacts

- summaryJson: `docs/research/gates/gate83/artifacts/full-eurusd/cost-ladder-summary.rows.json`
- summaryCsv: `docs/research/gates/gate83/artifacts/full-eurusd/cost-ladder-summary.rows.csv`
- weeklyGrossJson: `docs/research/gates/gate83/artifacts/full-eurusd/weekly-gross-mtm.rows.json`
- weeklyGrossCsv: `docs/research/gates/gate83/artifacts/full-eurusd/weekly-gross-mtm.rows.csv`
- weeklyCostJson: `docs/research/gates/gate83/artifacts/full-eurusd/weekly-cost-ladder-mtm.rows.json`
- weeklyCostCsv: `docs/research/gates/gate83/artifacts/full-eurusd/weekly-cost-ladder-mtm.rows.csv`
- closeEventsJson: `docs/research/gates/gate83/artifacts/full-eurusd/close-events.rows.json`
- closeEventsCsv: `docs/research/gates/gate83/artifacts/full-eurusd/close-events.rows.csv`
- pairContributionJson: `docs/research/gates/gate83/artifacts/full-eurusd/worst-drawdown-pair-contribution.rows.json`
- pairContributionCsv: `docs/research/gates/gate83/artifacts/full-eurusd/worst-drawdown-pair-contribution.rows.csv`
- validationJson: `docs/research/gates/gate83/artifacts/full-eurusd/validation.rows.json`
- validationCsv: `docs/research/gates/gate83/artifacts/full-eurusd/validation.rows.csv`
- metricDefinitionsJson: `docs/research/gates/gate83/artifacts/full-eurusd/metric-definitions.rows.json`
- metricDefinitionsCsv: `docs/research/gates/gate83/artifacts/full-eurusd/metric-definitions.rows.csv`
- commandReceipt: `docs/research/gates/gate83/artifacts/full-eurusd/command-receipt.json`
- runSummaryJson: `docs/research/gates/gate83/artifacts/full-eurusd/gate83-run-summary.json`
- shaManifest: `docs/research/gates/gate83/artifacts/full-eurusd/gate83-raw-speed-sha256.txt`
- report: `docs/research/gates/gate83/GATE83_RAW_HEDGED_GRID_SPEED_SIMPLIFICATION_FULL_EURUSD_2026-07-01.md`

## Stop Line

Gate 83 is warehouse diagnostic evidence only. MT5 EA simplification, dangerous-fill guard implementation, MT5 compile/tester work, live trading, risk layer, parameter optimization, and promotion remain closed.
