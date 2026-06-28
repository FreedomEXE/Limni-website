# Gate 71C Exit Baseline Matrix

Generated: `2026-06-28T20:17:46.372Z`

## Verdict

`PASS_GATE71C_EXIT_BASELINE_MATRIX__PREDECLARED_BASKET_RULES_SCORED`

## Scope

- Executes the predeclared basket-exit matrix against the clean Gate 71A/71B basket path.
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
  "legacy_adr_grid_used_as_foundation": false,
  "legacy_adr_grid_control_only": true,
  "rules_scored": 34,
  "weeks_scored": 2,
  "weekly_matrix_rows": 68,
  "expected_weekly_matrix_rows": 68,
  "time_based_profit_capture_executed": false,
  "pure_peak_trailing_executed": false,
  "pair_specific_exits_executed": false,
  "regime_specific_exits_executed": false,
  "risk_filters_started": false,
  "brain_truth_mutated": false,
  "exit_promotion_performed": false,
  "runtime_seconds": 14
}
```

## Top Preview

```json
[
  {
    "rule_id": "GLOBAL_TP_200_STOP_WEEK",
    "family": "global_close_all_stop_week",
    "profitable_week_rate": 1,
    "total_adr": 4.289108,
    "max_drawdown_adr": 0,
    "worst_week_adr": 2.140594,
    "negative_years": 0
  },
  {
    "rule_id": "GLOBAL_TP_150_STOP_WEEK",
    "family": "global_close_all_stop_week",
    "profitable_week_rate": 1,
    "total_adr": 3.139942,
    "max_drawdown_adr": 0,
    "worst_week_adr": 1.543801,
    "negative_years": 0
  },
  {
    "rule_id": "GLOBAL_TP_125_STOP_WEEK",
    "family": "global_close_all_stop_week",
    "profitable_week_rate": 1,
    "total_adr": 2.59696,
    "max_drawdown_adr": 0,
    "worst_week_adr": 1.280273,
    "negative_years": 0
  },
  {
    "rule_id": "TRAIL_TP_A075_F025_T125",
    "family": "trail_plus_hard_tp",
    "profitable_week_rate": 1,
    "total_adr": 2.59696,
    "max_drawdown_adr": 0,
    "worst_week_adr": 1.280273,
    "negative_years": 0
  },
  {
    "rule_id": "TRAIL_TP_A100_F050_T200",
    "family": "trail_plus_hard_tp",
    "profitable_week_rate": 1,
    "total_adr": 2.468276,
    "max_drawdown_adr": 0,
    "worst_week_adr": 0.327682,
    "negative_years": 0
  },
  {
    "rule_id": "GLOBAL_TP_100_STOP_WEEK",
    "family": "global_close_all_stop_week",
    "profitable_week_rate": 1,
    "total_adr": 2.035648,
    "max_drawdown_adr": 0,
    "worst_week_adr": 1.014429,
    "negative_years": 0
  },
  {
    "rule_id": "GLOBAL_TP_075_STOP_WEEK",
    "family": "global_close_all_stop_week",
    "profitable_week_rate": 1,
    "total_adr": 1.788869,
    "max_drawdown_adr": 0,
    "worst_week_adr": 0.76765,
    "negative_years": 0
  },
  {
    "rule_id": "GLOBAL_TP_050_STOP_WEEK",
    "family": "global_close_all_stop_week",
    "profitable_week_rate": 1,
    "total_adr": 1.118636,
    "max_drawdown_adr": 0,
    "worst_week_adr": 0.507236,
    "negative_years": 0
  },
  {
    "rule_id": "TRAIL_A075_F050",
    "family": "basket_profit_floor_trailing",
    "profitable_week_rate": 1,
    "total_adr": 0.785607,
    "max_drawdown_adr": 0,
    "worst_week_adr": 0.327682,
    "negative_years": 0
  },
  {
    "rule_id": "TRAIL_TP_A075_F050_T150",
    "family": "trail_plus_hard_tp",
    "profitable_week_rate": 1,
    "total_adr": 0.785607,
    "max_drawdown_adr": 0,
    "worst_week_adr": 0.327682,
    "negative_years": 0
  }
]
```

## Artifacts

- Predeclared matrix: `docs/research/gates/gate71c/artifacts/gate71c-exit-baseline-matrix-smoke/predeclared-exit-baseline-matrix.json`
- Weekly matrix rows: `docs/research/gates/gate71c/artifacts/gate71c-exit-baseline-matrix-smoke/exit-baseline-matrix.weekly.rows.jsonl`
- Candidate summaries: `docs/research/gates/gate71c/artifacts/gate71c-exit-baseline-matrix-smoke/exit-baseline-matrix.candidate-summaries.json`
- Summary: `docs/research/gates/gate71c/artifacts/gate71c-exit-baseline-matrix-smoke/gate71c-summary.json`
- SHA identity: `docs/research/gates/gate71c/artifacts/gate71c-exit-baseline-matrix-smoke/gate71c-sha256.txt`

## Stop Line

Gate 71C is a baseline matrix execution only. It ranks for review but does not promote an exit rule.
