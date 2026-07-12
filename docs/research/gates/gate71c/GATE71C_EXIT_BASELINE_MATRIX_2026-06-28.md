# Gate 71C Exit Baseline Matrix

Generated: `2026-06-28T23:18:50.606Z`

## Verdict

`PASS_GATE71C_EXIT_BASELINE_MATRIX__PREDECLARED_BASKET_RULES_SCORED`

## Scope

- Executes the predeclared basket-exit matrix against the clean Gate 71A/71B basket path.
- Replays exit policies from the Gate 71B-M frozen basket path warehouse by default.
- Keeps legacy ADR Grid as a control only.
- Excludes time-based profit capture and pure peak trailing from first-pass execution unless later diagnostics justify them.
- Does not promote an exit, apply risk filters, prune pairs, or mutate Candidate B.

## Validation

```json
{
  "gate71a_passed": true,
  "gate71b_passed": true,
  "candidate_b_forced28_preserved": true,
  "clean_basket_path_used": true,
  "basket_path_warehouse_id": "gate71bm_basket_path_1A8231225169",
  "exit_policy_replay_from_frozen_warehouse": true,
  "raw_m1_rebuild_performed": false,
  "legacy_adr_grid_used_as_foundation": false,
  "legacy_adr_grid_control_only": true,
  "rules_scored": 34,
  "legacy_adr_grid_control_warehouse_id": "gate57a0b_pair_week_path_outcomes_47B8F40AFB3B",
  "legacy_adr_grid_control_missing_weeks": 0,
  "weeks_scored": 373,
  "weekly_matrix_rows": 12682,
  "expected_weekly_matrix_rows": 12682,
  "time_based_profit_capture_executed": false,
  "pure_peak_trailing_executed": false,
  "pair_specific_exits_executed": false,
  "regime_specific_exits_executed": false,
  "risk_filters_started": false,
  "brain_truth_mutated": false,
  "exit_promotion_performed": false,
  "runtime_seconds": 125.3
}
```

## Top Preview

```json
[
  {
    "rule_id": "GLOBAL_TP_025_STOP_WEEK",
    "family": "global_close_all_stop_week",
    "profitable_week_rate": 0.981233,
    "total_adr": 26.114195,
    "max_drawdown_adr": -44.726851,
    "worst_week_adr": -31.994788,
    "negative_years": 4
  },
  {
    "rule_id": "GLOBAL_TP_050_STOP_WEEK",
    "family": "global_close_all_stop_week",
    "profitable_week_rate": 0.965147,
    "total_adr": 28.884403,
    "max_drawdown_adr": -63.75333,
    "worst_week_adr": -31.994788,
    "negative_years": 3
  },
  {
    "rule_id": "GLOBAL_TP_075_STOP_WEEK",
    "family": "global_close_all_stop_week",
    "profitable_week_rate": 0.9437,
    "total_adr": 30.946525,
    "max_drawdown_adr": -55.911196,
    "worst_week_adr": -31.994788,
    "negative_years": 4
  },
  {
    "rule_id": "TRAIL_TP_A075_F050_T150",
    "family": "trail_plus_hard_tp",
    "profitable_week_rate": 0.932976,
    "total_adr": 29.350747,
    "max_drawdown_adr": -55.077447,
    "worst_week_adr": -31.994788,
    "negative_years": 4
  },
  {
    "rule_id": "GLOBAL_TP_100_STOP_WEEK",
    "family": "global_close_all_stop_week",
    "profitable_week_rate": 0.927614,
    "total_adr": 64.607761,
    "max_drawdown_adr": -67.982351,
    "worst_week_adr": -31.994788,
    "negative_years": 3
  },
  {
    "rule_id": "TRAIL_A075_F050",
    "family": "basket_profit_floor_trailing",
    "profitable_week_rate": 0.919571,
    "total_adr": 90.364402,
    "max_drawdown_adr": -71.673597,
    "worst_week_adr": -31.994788,
    "negative_years": 4
  },
  {
    "rule_id": "TRAIL_TP_A100_F050_T200",
    "family": "trail_plus_hard_tp",
    "profitable_week_rate": 0.914209,
    "total_adr": 45.849583,
    "max_drawdown_adr": -67.51491,
    "worst_week_adr": -31.994788,
    "negative_years": 3
  },
  {
    "rule_id": "GLOBAL_TP_125_STOP_WEEK",
    "family": "global_close_all_stop_week",
    "profitable_week_rate": 0.911528,
    "total_adr": 79.591558,
    "max_drawdown_adr": -74.934821,
    "worst_week_adr": -31.994788,
    "negative_years": 4
  },
  {
    "rule_id": "TRAIL_TP_A050_F025_T100",
    "family": "trail_plus_hard_tp",
    "profitable_week_rate": 0.911528,
    "total_adr": 26.091533,
    "max_drawdown_adr": -60.356394,
    "worst_week_adr": -31.994788,
    "negative_years": 3
  },
  {
    "rule_id": "TRAIL_TP_A075_F025_T125",
    "family": "trail_plus_hard_tp",
    "profitable_week_rate": 0.908847,
    "total_adr": 44.653837,
    "max_drawdown_adr": -50.581983,
    "worst_week_adr": -31.994788,
    "negative_years": 4
  }
]
```

## Artifacts

- Predeclared matrix: `docs/research/gates/gate71c/artifacts/gate71c-exit-baseline-matrix/predeclared-exit-baseline-matrix.json`
- Weekly matrix rows: `docs/research/gates/gate71c/artifacts/gate71c-exit-baseline-matrix/exit-baseline-matrix.weekly.rows.jsonl`
- Candidate summaries: `docs/research/gates/gate71c/artifacts/gate71c-exit-baseline-matrix/exit-baseline-matrix.candidate-summaries.json`
- Summary: `docs/research/gates/gate71c/artifacts/gate71c-exit-baseline-matrix/gate71c-summary.json`
- SHA identity: `docs/research/gates/gate71c/artifacts/gate71c-exit-baseline-matrix/gate71c-sha256.txt`

## Stop Line

Gate 71C is a baseline matrix execution only. It ranks for review but does not promote an exit rule.
