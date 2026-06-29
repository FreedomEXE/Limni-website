# Gate 74D Pair Net-Grid Open-Loss Forensics

Generated: `2026-06-29T11:17:09.667Z`

## Verdict

`PASS_GATE74D_PAIR_NET_GRID_OPEN_LOSS_FORENSICS__UNRESOLVED_INVENTORY_AND_DRAWDOWN_ANATOMY_VISIBLE`

## Scope

- Replays Gate 74C-style lifecycle adapters from the frozen Gate 74B trade-leg path warehouse.
- Focuses on unresolved open-loss inventory, drawdown decomposition, flip losses, recovery, and narrow target/spacing robustness.
- Applies no costs, risk sizing, pair pruning, account-level equity exit policy, signal mutation, MT5/live/runtime work, or promotion logic.

## Focus Adapter

```json
{
  "rule_id": "PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP",
  "rule_family": "gross_lifecycle",
  "review_role": "gate74c_best_adapter_focus",
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
  "content_hash": "64085B298A8C933291129815A5F3454EBF1FB3D389AF9C4389EC37D9A063A4BA"
}
```

## Rule Forensics

| rule_id | closed | equity | open | eq_pf | dd | recovery | flip_loss | max_fills |
|---|---|---|---|---|---|---|---|---|
| WEEKLY_FORCED_CLOSE | 638.115405 | 638.115405 | 0 | 1.414187 | -116.795157 |  | 0 | 0 |
| CARRY_UNTIL_FLIP | 694.688146 | 597.519846 | -97.1683 | 1.349786 | -167.030217 | 0 | -963.436728 | 1 |
| PAIR_NET_GRID_CYCLE_TARGET_050_SPACING_020_RESTART_UNTIL_FLIP | 13469.050444 | 7874.678505 | -5594.371939 | 1.1971 | -7844.230957 | 0.977656 | -11948.955932 | 200 |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP | 14381.312614 | 9901.156008 | -4480.156606 | 1.254319 | -5462.545131 | 0.967986 | -10815.950986 | 200 |
| PAIR_NET_GRID_CYCLE_TARGET_100_SPACING_020_RESTART_UNTIL_FLIP | 13434.211888 | 9129.702498 | -4304.50939 | 1.25162 | -6166.809948 | 0.95839 | -11547.619185 | 196 |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_015_RESTART_UNTIL_FLIP | 17391.208857 | 10343.99932 | -7047.209537 | 1.196252 | -9502.141017 | 0.974102 | -14294.393487 | 267 |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_025_RESTART_UNTIL_FLIP | 11059.199863 | 6644.485614 | -4414.714249 | 1.197329 | -6060.99223 | 0.962605 | -10084.099344 | 158 |

## Recovery Summary

| rule_id | negative_cycles | negative_cycles_recovered_to_target | negative_recovery_rate | median_time_to_recovery_hours | worst_mae_never_recovered_adr |
|---|---|---|---|---|---|
| CARRY_UNTIL_FLIP | 923 | 0 | 0 |  | -39.622982 |
| PAIR_NET_GRID_CYCLE_TARGET_050_SPACING_020_RESTART_UNTIL_FLIP | 41040 | 40123 | 0.977656 | 13.25 | -3849.124023 |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP | 28456 | 27545 | 0.967986 | 21.966667 | -3830.275559 |
| PAIR_NET_GRID_CYCLE_TARGET_100_SPACING_020_RESTART_UNTIL_FLIP | 21966 | 21052 | 0.95839 | 29.966667 | -3684.031478 |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_015_RESTART_UNTIL_FLIP | 35061 | 34153 | 0.974102 | 17.55 | -5125.487683 |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_025_RESTART_UNTIL_FLIP | 24388 | 23476 | 0.962605 | 25.025 | -3020.249887 |

## Flip Loss Summary

| rule_id | flip_loss_count | flip_loss_total_adr | flip_loss_worst_adr | median_age_at_flip_hours | previously_positive_rate |
|---|---|---|---|---|---|
| CARRY_UNTIL_FLIP | 400 | -963.436728 | -21.63951 | 420 | 0.99 |
| PAIR_NET_GRID_CYCLE_TARGET_050_SPACING_020_RESTART_UNTIL_FLIP | 643 | -11948.955932 | -1331.616427 | 85.633333 | 0.947123 |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP | 616 | -10815.950986 | -1317.346336 | 95.016667 | 0.948052 |
| PAIR_NET_GRID_CYCLE_TARGET_100_SPACING_020_RESTART_UNTIL_FLIP | 592 | -11547.619185 | -1326.593308 | 105.058333 | 0.967905 |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_015_RESTART_UNTIL_FLIP | 606 | -14294.393487 | -1781.67483 | 88.016667 | 0.942244 |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_025_RESTART_UNTIL_FLIP | 618 | -10084.099344 | -1067.390649 | 101.6 | 0.961165 |

## Validation

```json
{
  "gate74b_passed": true,
  "gate74c_passed": true,
  "gate74b_manifest_complete": true,
  "warehouse_hash_matches_gate74b_summary": true,
  "selected_weeks": 373,
  "selected_pairs": 28,
  "controls_replayed": 2,
  "lifecycle_rules_replayed": 5,
  "weekly_rows": 2611,
  "final_open_inventory_rows": 168,
  "focus_closed_matches_gate74c": true,
  "focus_equity_matches_gate74c": true,
  "gross_only": true,
  "costs_applied": false,
  "raw_m1_rebuild_performed": false,
  "account_equity_exit_policy_started": false,
  "broad_spacing_matrix_started": false,
  "narrow_spacing_robustness_check": true,
  "pair_pruning_started": false,
  "risk_layer_started": false,
  "exit_promotion_started": false,
  "mt5_live_runtime_started": false,
  "brain_truth_mutated": false,
  "source_mutation_started": false,
  "runtime_seconds": 400.862
}
```

## Artifacts

```json
{
  "ruleForensicsRows": "docs/research/gates/gate74d/artifacts/gate74d-pair-net-grid-open-loss-forensics/rule-forensics.rows.json",
  "weeklyEquityTruthRows": "docs/research/gates/gate74d/artifacts/gate74d-pair-net-grid-open-loss-forensics/weekly-equity-truth.rows.json",
  "finalOpenInventoryRows": "docs/research/gates/gate74d/artifacts/gate74d-pair-net-grid-open-loss-forensics/final-open-inventory.rows.json",
  "finalOpenByPairRows": "docs/research/gates/gate74d/artifacts/gate74d-pair-net-grid-open-loss-forensics/final-open-by-pair.rows.json",
  "finalOpenByStartYearRows": "docs/research/gates/gate74d/artifacts/gate74d-pair-net-grid-open-loss-forensics/final-open-by-start-year.rows.json",
  "finalOpenByAgeRows": "docs/research/gates/gate74d/artifacts/gate74d-pair-net-grid-open-loss-forensics/final-open-by-age.rows.json",
  "finalOpenByStreakRows": "docs/research/gates/gate74d/artifacts/gate74d-pair-net-grid-open-loss-forensics/final-open-by-streak.rows.json",
  "drawdownRows": "docs/research/gates/gate74d/artifacts/gate74d-pair-net-grid-open-loss-forensics/drawdown-windows.rows.json",
  "drawdownPairContributors": "docs/research/gates/gate74d/artifacts/gate74d-pair-net-grid-open-loss-forensics/drawdown-pair-contributors.rows.json",
  "drawdownCurrencyContributors": "docs/research/gates/gate74d/artifacts/gate74d-pair-net-grid-open-loss-forensics/drawdown-currency-contributors.rows.json",
  "flipLossSummaryRows": "docs/research/gates/gate74d/artifacts/gate74d-pair-net-grid-open-loss-forensics/flip-loss-summary.rows.json",
  "worstFlipLossCycles": "docs/research/gates/gate74d/artifacts/gate74d-pair-net-grid-open-loss-forensics/worst-flip-loss-cycles.rows.json",
  "recoverySummaryRows": "docs/research/gates/gate74d/artifacts/gate74d-pair-net-grid-open-loss-forensics/recovery-summary.rows.json",
  "worstNeverRecoveredCycles": "docs/research/gates/gate74d/artifacts/gate74d-pair-net-grid-open-loss-forensics/worst-never-recovered-cycles.rows.json",
  "worst10Weeks": "docs/research/gates/gate74d/artifacts/gate74d-pair-net-grid-open-loss-forensics/worst-10-equity-weeks.rows.json",
  "best10ClosedWeeks": "docs/research/gates/gate74d/artifacts/gate74d-pair-net-grid-open-loss-forensics/best-10-closed-harvest-weeks.rows.json",
  "summaryJson": "docs/research/gates/gate74d/artifacts/gate74d-pair-net-grid-open-loss-forensics/gate74d-summary.json",
  "shaIdentity": "docs/research/gates/gate74d/artifacts/gate74d-pair-net-grid-open-loss-forensics/gate74d-sha256.txt",
  "report": "docs/research/gates/gate74d/GATE74D_PAIR_NET_GRID_OPEN_LOSS_FORENSICS_2026-06-29.md"
}
```

## Stop Line

Gate 74D is forensic review only. Cost validation, account-level equity exits, broad spacing optimization, risk/correlation pruning, pair selection, promotion, MT5/live/runtime work, source mutation, and Brain mutation remain closed unless explicitly opened.
