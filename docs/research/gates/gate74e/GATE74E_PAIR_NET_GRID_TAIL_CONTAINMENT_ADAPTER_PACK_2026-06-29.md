# Gate 74E Pair Net-Grid Tail-Containment Adapter Pack

Generated: `2026-06-29T13:12:07.618Z`

## Verdict

`PASS_GATE74E_PAIR_NET_GRID_TAIL_CONTAINMENT_ADAPTER_PACK__TAIL_MECHANICS_AND_UNIVERSAL_CONTAINMENT_RANKING_VISIBLE_NO_PROMOTION`

## Scope

- Replays the exact Gate 74C/74D focus adapter plus a small universal containment pack from the frozen Gate 74B trade-leg path warehouse.
- Keeps target `0.75 ADR`, spacing `0.2 ADR`, restart-until-flip, cross-week carry, and close-mark semantics unless the named adapter explicitly changes lifecycle handling.
- Applies no costs, risk sizing, pair pruning, pair/date exclusions, signal mutation, MT5/live/runtime work, or promotion logic.
- Exact account-level intraminute stop/recovery/floor policies are not started here because they require a synchronized all-pair event replay rather than the pair-series warehouse reader used by Gates 74C-74E.

## Focus Adapter

```json
{
  "rule_id": "PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP",
  "rule_family": "focus_baseline",
  "review_role": "gate74d_focus_baseline_parity",
  "target_adr": 0.75,
  "spacing_adr": 0.2,
  "closed_total_adr": 14381.312614,
  "final_equity_adr": 9901.156008,
  "final_open_unrealized_adr": -4480.156606,
  "closed_profit_factor": 2.329639,
  "equity_profit_factor": 1.254319,
  "equity_max_drawdown_adr": -5462.545131,
  "time_underwater_week_rate": 0.75067,
  "entries": 125296,
  "closed_cycles": 29202,
  "target_closed_cycles": 28300,
  "flip_closed_cycles": 902,
  "final_open_cycles": 28,
  "final_open_loss_adr": -4481.135481,
  "final_open_loss_ratio_to_closed": 0.311526,
  "worst_final_open_cycle_adr": -3099.046979,
  "worst_final_open_cycle_pair": "AUDNZD",
  "max_fill_count": 200,
  "max_open_cycle_age_hours": 6961.233333,
  "negative_cycles": 28456,
  "negative_cycles_recovered_to_target": 27545,
  "negative_cycle_recovery_rate": 0.967986,
  "flip_loss_cycles": 616,
  "flip_loss_total_adr": -10815.950986,
  "flip_loss_average_adr": -17.558362,
  "guarded_stopped_frozen_locked_cycles": 0,
  "closed_adr_retention_vs_focus": 1,
  "equity_adr_retention_vs_focus": 1,
  "final_open_unrealized_improvement_vs_focus": 0,
  "max_drawdown_improvement_vs_focus": 0,
  "flip_loss_improvement_vs_focus": 0,
  "no_promotion_status": "research_only_no_promotion",
  "content_hash": "014E5FD24B923B1802C047208730A5BF89095D901564AFAAF75EA42D21778C33"
}
```

## Adapter Ranking

| rule_id | family | closed | equity | open | eq_pf | dd | recovery | flip_loss | guarded | closed_ret | equity_ret | open_impr | dd_impr | flip_impr | max_fills |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP | focus_baseline | 14381.312614 | 9901.156008 | -4480.156606 | 1.254319 | -5462.545131 | 0.967986 | -10815.950986 | 0 | 1 | 1 | 0 | 0 | 0 | 200 |
| PAIR_NET_GRID_T075_S020_MAX_FILL_050_RESTART_UNTIL_FLIP | max_fill_guard | 6127.673638 | 5691.39271 | -436.280928 | 1.269189 | -1232.916919 | 0.967818 | -6298.091399 | 56 | 0.426086 | 0.574821 | 4043.875678 | 4229.628212 | 4517.859587 | 59 |
| PAIR_NET_GRID_T075_S020_MAX_FILL_075_RESTART_UNTIL_FLIP | max_fill_guard | 8825.628117 | 8099.307112 | -726.321005 | 1.304118 | -1893.688036 | 0.968085 | -8000.815971 | 16 | 0.613687 | 0.818016 | 3753.835601 | 3568.857095 | 2815.135015 | 75 |
| PAIR_NET_GRID_T075_S020_MAX_AGE_720H_RESTART_UNTIL_FLIP | max_age_guard | 6807.408308 | 6612.893515 | -194.514793 | 1.393707 | -1017.983578 | 0.964189 | -5278.221812 | 241 | 0.473351 | 0.667891 | 4285.641813 | 4444.561553 | 5537.729174 | 126 |
| PAIR_NET_GRID_T075_S020_MAX_AGE_2160H_RESTART_UNTIL_FLIP | max_age_guard | 8573.103021 | 8245.190236 | -327.912785 | 1.334366 | -2612.303859 | 0.96792 | -7543.345937 | 42 | 0.596128 | 0.83275 | 4152.243821 | 2850.241272 | 3272.605049 | 126 |
| PAIR_NET_GRID_T075_S020_PAIR_STOP_10_RESTART_UNTIL_FLIP | pair_stop_loss | -1096.339927 | -1141.160536 | -44.820609 | 0.859951 | -1170.130374 | 0.903236 | -1127.311775 | 3371 | -0.076234 | -0.115255 | 4435.335997 | 4292.414757 | 9688.639211 | 20 |
| PAIR_NET_GRID_T075_S020_PAIR_STOP_15_RESTART_UNTIL_FLIP | pair_stop_loss | -832.396825 | -885.125874 | -52.729049 | 0.904157 | -1155.925928 | 0.92586 | -1442.86453 | 2148 | -0.05788 | -0.089396 | 4427.427557 | 4306.619203 | 9373.086456 | 23 |
| PAIR_NET_GRID_T075_S020_PAIR_STOP_20_RESTART_UNTIL_FLIP | pair_stop_loss | -162.964866 | -217.27639 | -54.311524 | 0.978231 | -872.758514 | 0.938208 | -1829.166714 | 1514 | -0.011332 | -0.021945 | 4425.845082 | 4589.786617 | 8986.784272 | 23 |
| PAIR_NET_GRID_T075_S020_FREEZE_LOCK_15_UNTIL_FLIP_RESTART_UNTIL_FLIP | hedge_freeze_lock | -21.063204 | -383.784205 | -362.721001 | 0.881495 | -621.810128 | 0.908731 | -719.485731 | 475 | -0.001465 | -0.038762 | 4117.435605 | 4840.735003 | 10096.465255 | 18 |
| PAIR_NET_GRID_T075_S020_RECOVERY_CLOSE_AFTER_15_TO_MINUS_250_RESTART_UNTIL_FLIP | recovery_close | 12520.278211 | 8412.154864 | -4108.123347 | 1.231731 | -5100.012385 | 0.925259 | -9640.968369 | 1345 | 0.870594 | 0.849613 | 372.033259 | 362.532746 | 1174.982617 | 200 |

## Recovery Summary

| rule_id | negative_cycles | negative_cycles_recovered_to_target | negative_recovery_rate | median_time_to_recovery_hours | worst_mae_never_recovered_adr |
|---|---|---|---|---|---|
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP | 28456 | 27545 | 0.967986 | 21.966667 | -3830.275559 |
| PAIR_NET_GRID_T075_S020_MAX_FILL_050_RESTART_UNTIL_FLIP | 30048 | 29081 | 0.967818 | 21.783333 | -359.654609 |
| PAIR_NET_GRID_T075_S020_MAX_FILL_075_RESTART_UNTIL_FLIP | 29046 | 28119 | 0.968085 | 21.883333 | -589.433909 |
| PAIR_NET_GRID_T075_S020_MAX_AGE_720H_RESTART_UNTIL_FLIP | 32169 | 31017 | 0.964189 | 21.7 | -897.153933 |
| PAIR_NET_GRID_T075_S020_MAX_AGE_2160H_RESTART_UNTIL_FLIP | 29707 | 28754 | 0.96792 | 21.866667 | -1312.422281 |
| PAIR_NET_GRID_T075_S020_PAIR_STOP_10_RESTART_UNTIL_FLIP | 44190 | 39914 | 0.903236 | 19.55 | -40.509785 |
| PAIR_NET_GRID_T075_S020_PAIR_STOP_15_RESTART_UNTIL_FLIP | 41273 | 38213 | 0.92586 | 19.966667 | -53.376218 |
| PAIR_NET_GRID_T075_S020_PAIR_STOP_20_RESTART_UNTIL_FLIP | 39261 | 36835 | 0.938208 | 20.45 | -53.778944 |
| PAIR_NET_GRID_T075_S020_FREEZE_LOCK_15_UNTIL_FLIP_RESTART_UNTIL_FLIP | 10091 | 9170 | 0.908731 | 20.941667 | -33.600857 |
| PAIR_NET_GRID_T075_S020_RECOVERY_CLOSE_AFTER_15_TO_MINUS_250_RESTART_UNTIL_FLIP | 30211 | 27953 | 0.925259 | 20.666667 | -3830.275559 |

## Flip Loss Summary

| rule_id | flip_loss_count | flip_loss_total_adr | flip_loss_worst_adr | median_age_at_flip_hours | previously_positive_rate |
|---|---|---|---|---|---|
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP | 616 | -10815.950986 | -1317.346336 | 95.016667 | 0.948052 |
| PAIR_NET_GRID_T075_S020_MAX_FILL_050_RESTART_UNTIL_FLIP | 614 | -6298.091399 | -207.181418 | 93.683333 | 0.947883 |
| PAIR_NET_GRID_T075_S020_MAX_FILL_075_RESTART_UNTIL_FLIP | 614 | -8000.815971 | -308.858173 | 94.616667 | 0.947883 |
| PAIR_NET_GRID_T075_S020_MAX_AGE_720H_RESTART_UNTIL_FLIP | 601 | -5278.221812 | -308.858173 | 92.566667 | 0.945092 |
| PAIR_NET_GRID_T075_S020_MAX_AGE_2160H_RESTART_UNTIL_FLIP | 612 | -7543.345937 | -608.323278 | 94.616667 | 0.947712 |
| PAIR_NET_GRID_T075_S020_PAIR_STOP_10_RESTART_UNTIL_FLIP | 532 | -1127.311775 | -17.232355 | 79.358334 | 0.947368 |
| PAIR_NET_GRID_T075_S020_PAIR_STOP_15_RESTART_UNTIL_FLIP | 556 | -1442.86453 | -17.459858 | 82.141667 | 0.953237 |
| PAIR_NET_GRID_T075_S020_PAIR_STOP_20_RESTART_UNTIL_FLIP | 569 | -1829.166714 | -21.193198 | 83.333333 | 0.945518 |
| PAIR_NET_GRID_T075_S020_FREEZE_LOCK_15_UNTIL_FLIP_RESTART_UNTIL_FLIP | 281 | -719.485731 | -17.459858 | 82.816667 | 0.939502 |
| PAIR_NET_GRID_T075_S020_RECOVERY_CLOSE_AFTER_15_TO_MINUS_250_RESTART_UNTIL_FLIP | 612 | -9640.968369 | -1317.346336 | 91.225 | 0.95098 |

## Validation

```json
{
  "gate74b_passed": true,
  "gate74c_passed": true,
  "gate74d_passed": true,
  "gate74b_manifest_complete": true,
  "warehouse_hash_matches_gate74b_summary": true,
  "selected_weeks": 373,
  "selected_pairs": 28,
  "focus_baseline_replayed": 1,
  "containment_adapters_replayed": 9,
  "weekly_rows": 3730,
  "final_open_inventory_rows": 280,
  "focus_closed_matches_gate74c": true,
  "focus_equity_matches_gate74c": true,
  "focus_closed_matches_gate74d": true,
  "focus_equity_matches_gate74d": true,
  "gross_only": true,
  "costs_applied": false,
  "raw_m1_rebuild_performed": false,
  "exact_account_level_synchronous_containment_started": false,
  "account_level_profit_floor_trail_started": false,
  "broad_parameter_matrix_started": false,
  "small_universal_adapter_pack_only": true,
  "pair_pruning_started": false,
  "audnzd_excluded": false,
  "risk_layer_started": false,
  "exit_promotion_started": false,
  "mt5_live_runtime_started": false,
  "brain_truth_mutated": false,
  "source_mutation_started": false,
  "runtime_seconds": 1642.551
}
```

## Artifacts

```json
{
  "adapterResultRows": "docs/research/gates/gate74e/artifacts/gate74e-pair-net-grid-tail-containment-adapter-pack/adapter-result.rows.json",
  "cycleStateReconciliationRows": "docs/research/gates/gate74e/artifacts/gate74e-pair-net-grid-tail-containment-adapter-pack/cycle-state-reconciliation.rows.json",
  "tailConcentrationRows": "docs/research/gates/gate74e/artifacts/gate74e-pair-net-grid-tail-containment-adapter-pack/tail-concentration.rows.json",
  "weeklyEquityTruthRows": "docs/research/gates/gate74e/artifacts/gate74e-pair-net-grid-tail-containment-adapter-pack/weekly-equity-truth.rows.json",
  "finalOpenInventoryRows": "docs/research/gates/gate74e/artifacts/gate74e-pair-net-grid-tail-containment-adapter-pack/final-open-inventory.rows.json",
  "finalOpenByPairRows": "docs/research/gates/gate74e/artifacts/gate74e-pair-net-grid-tail-containment-adapter-pack/final-open-by-pair.rows.json",
  "finalOpenByStartYearRows": "docs/research/gates/gate74e/artifacts/gate74e-pair-net-grid-tail-containment-adapter-pack/final-open-by-start-year.rows.json",
  "finalOpenByAgeRows": "docs/research/gates/gate74e/artifacts/gate74e-pair-net-grid-tail-containment-adapter-pack/final-open-by-age.rows.json",
  "finalOpenByStreakRows": "docs/research/gates/gate74e/artifacts/gate74e-pair-net-grid-tail-containment-adapter-pack/final-open-by-streak.rows.json",
  "drawdownRows": "docs/research/gates/gate74e/artifacts/gate74e-pair-net-grid-tail-containment-adapter-pack/drawdown-windows.rows.json",
  "drawdownPairContributors": "docs/research/gates/gate74e/artifacts/gate74e-pair-net-grid-tail-containment-adapter-pack/drawdown-pair-contributors.rows.json",
  "drawdownCurrencyContributors": "docs/research/gates/gate74e/artifacts/gate74e-pair-net-grid-tail-containment-adapter-pack/drawdown-currency-contributors.rows.json",
  "flipLossSummaryRows": "docs/research/gates/gate74e/artifacts/gate74e-pair-net-grid-tail-containment-adapter-pack/flip-loss-summary.rows.json",
  "worstFlipLossCycles": "docs/research/gates/gate74e/artifacts/gate74e-pair-net-grid-tail-containment-adapter-pack/worst-flip-loss-cycles.rows.json",
  "recoverySummaryRows": "docs/research/gates/gate74e/artifacts/gate74e-pair-net-grid-tail-containment-adapter-pack/recovery-summary.rows.json",
  "worstNeverRecoveredCycles": "docs/research/gates/gate74e/artifacts/gate74e-pair-net-grid-tail-containment-adapter-pack/worst-never-recovered-cycles.rows.json",
  "worst10Weeks": "docs/research/gates/gate74e/artifacts/gate74e-pair-net-grid-tail-containment-adapter-pack/worst-10-equity-weeks.rows.json",
  "best10ClosedWeeks": "docs/research/gates/gate74e/artifacts/gate74e-pair-net-grid-tail-containment-adapter-pack/best-10-closed-harvest-weeks.rows.json",
  "summaryJson": "docs/research/gates/gate74e/artifacts/gate74e-pair-net-grid-tail-containment-adapter-pack/gate74e-summary.json",
  "shaIdentity": "docs/research/gates/gate74e/artifacts/gate74e-pair-net-grid-tail-containment-adapter-pack/gate74e-sha256.txt",
  "report": "docs/research/gates/gate74e/GATE74E_PAIR_NET_GRID_TAIL_CONTAINMENT_ADAPTER_PACK_2026-06-29.md"
}
```

## Stop Line

Gate 74E is research review only. Gate 75, cost validation, exact account-level synchronized exits, broad optimization, risk/correlation pruning, pair selection, fair-value pruning, promotion, MT5/live/runtime work, source mutation, and Brain mutation remain closed unless explicitly opened.
