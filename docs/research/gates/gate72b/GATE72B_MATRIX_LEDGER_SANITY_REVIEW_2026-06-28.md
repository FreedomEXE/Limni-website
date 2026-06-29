# Gate 72B Matrix Ledger Sanity Review

Generated: `2026-06-29T00:16:02.523Z`

## Verdict

`PASS_GATE72B_MATRIX_LEDGER_SANITY_REVIEW__RESULT_LEDGER_SHAPE_VALID_NO_REPLAY_DRIFT`

## Scope

- Verifies the Gate 71C matrix result ledger before ranking.
- Confirms rule/week shape, duplicate keys, unavailable controls, Candidate B hash consistency, and warehouse replay flags.
- Does not score new exits or promote any exit.

## Validation

```json
{
  "gate72a_passed": true,
  "gate71c_passed": true,
  "rule_count_matches": true,
  "week_count_matches": true,
  "weekly_row_count_matches_rule_x_week": true,
  "duplicate_rule_week_rows": 0,
  "candidate_b_hash_singleton": true,
  "path_diagnostic_hash_singleton_per_week": true,
  "unavailable_rows_limited_to_pair_silo_control": true,
  "warehouse_replay_confirmed": true,
  "raw_m1_rebuild_performed": false,
  "exit_promotion_performed": false,
  "risk_layer_started": false
}
```

## Matrix Integrity

```json
{
  "candidate_summary_count": 34,
  "predeclared_rule_count": 34,
  "week_count": 373,
  "expected_week_count": 373,
  "weekly_matrix_rows": 12682,
  "expected_weekly_matrix_rows": 12682,
  "duplicate_rule_week_count": 0,
  "duplicate_rule_weeks_sample": [],
  "row_rules_missing_from_summary": [],
  "summary_rules_missing_from_rows": [],
  "candidate_b_ledger_hashes": [
    "92C9E090F14B3EF2F96C78E749D9783F0F8F0E8E6CEA4900FDEFB115ED1BAD03"
  ],
  "path_diagnostic_hash_count": 373,
  "inconsistent_diagnostic_hash_weeks": [],
  "unavailable_rows": 373,
  "unavailable_by_rule": {
    "CONTROL_PAIR_SILO_1ADR_UNAVAILABLE": 373
  },
  "pair_silo_unavailable_only": true,
  "weekly_hold_rows": 373,
  "gate71c_replay_from_warehouse": true,
  "gate71c_raw_m1_rebuild_performed": false,
  "gate71c_exit_promotion_performed": false,
  "legacy_adr_grid_control_only": true
}
```

## Artifacts

- Matrix integrity: `docs/research/gates/gate72b/artifacts/gate72b-matrix-ledger-sanity-review/matrix-ledger-integrity.json`
- Summary: `docs/research/gates/gate72b/artifacts/gate72b-matrix-ledger-sanity-review/gate72b-summary.json`
- SHA identity: `docs/research/gates/gate72b/artifacts/gate72b-matrix-ledger-sanity-review/gate72b-sha256.txt`
