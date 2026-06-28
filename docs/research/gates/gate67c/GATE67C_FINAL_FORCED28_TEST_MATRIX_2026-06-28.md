# Gate 67C Final Forced-28 Test Matrix

Generated: `2026-06-28T02:53:27.326Z`

## Verdict

`PASS_FINAL_FORCED28_TEST_MATRIX__EXACTLY_THREE_CANDIDATES__FORCED28_PRESERVED__NO_PROMOTION`

## Scope

- Scores exactly the three Gate 67B unnamed final forced-28 candidates.
- Preserves 10,444 rows, 373 weeks, 28 pairs per week, and zero duplicate pair-weeks for every candidate.
- Uses outcome fields only after fixed decisions are emitted.
- Does not promote a candidate, start risk, or add more candidates.

## Candidate Metrics

| candidate_id | adr | dd | rdd | pf | wh | wh_pf | neg_years | warnings | fallback | veto |
|---|---|---|---|---|---|---|---|---|---|---|
| candidate_b_macro_anchor_with_cot_warning | 2341.080708 | -241.508971 | 9.693556 | 1.25407 | 638.603176 | 1.118059 | 1 | 1292 | 1292 | 1292 |
| candidate_c_scenario_memory_guarded | 2276.283276 | -275.03638 | 8.276299 | 1.242893 | 732.900462 | 1.136683 | 0 | 1813 | 5883 | 1813 |
| candidate_a_macro_anchor_conservative | 2184.300854 | -369.470056 | 5.911983 | 1.233289 | 787.143516 | 1.147545 | 0 | 691 | 4761 | 691 |

## Best Candidate Review

```json
{
  "best_adr_grid_rdd_candidate": {
    "candidate_id": "candidate_b_macro_anchor_with_cot_warning",
    "family": "final_forced28_candidate",
    "adr_grid": {
      "adr_sum": 2341.080708,
      "adr_mean": 0.224156,
      "max_drawdown": -241.508971,
      "r_over_drawdown": 9.693556,
      "row_pf": 1.25407
    },
    "weekly_hold": {
      "adr_sum": 638.603176,
      "adr_mean": 0.061145,
      "max_drawdown": -116.779755,
      "r_over_drawdown": 5.468441,
      "row_pf": 1.118059
    },
    "degraded_row_count": 1292,
    "negative_adr_grid_years": 1,
    "worst_adr_grid_year": {
      "year": 2019,
      "adr_grid_adr": -127.613437,
      "weekly_hold_adr": 108.7495
    },
    "decision_signature_sha256": "8C873CCCF9FA3D3A578EAC7160C8526EC25A0BEA528FE3C0A5304BE9413E6F01"
  },
  "best_adr_grid_pf_candidate": {
    "candidate_id": "candidate_b_macro_anchor_with_cot_warning",
    "family": "final_forced28_candidate",
    "adr_grid": {
      "adr_sum": 2341.080708,
      "adr_mean": 0.224156,
      "max_drawdown": -241.508971,
      "r_over_drawdown": 9.693556,
      "row_pf": 1.25407
    },
    "weekly_hold": {
      "adr_sum": 638.603176,
      "adr_mean": 0.061145,
      "max_drawdown": -116.779755,
      "r_over_drawdown": 5.468441,
      "row_pf": 1.118059
    },
    "degraded_row_count": 1292,
    "negative_adr_grid_years": 1,
    "worst_adr_grid_year": {
      "year": 2019,
      "adr_grid_adr": -127.613437,
      "weekly_hold_adr": 108.7495
    },
    "decision_signature_sha256": "8C873CCCF9FA3D3A578EAC7160C8526EC25A0BEA528FE3C0A5304BE9413E6F01"
  },
  "best_zero_negative_year_candidate": {
    "candidate_id": "candidate_c_scenario_memory_guarded",
    "family": "final_forced28_candidate",
    "adr_grid": {
      "adr_sum": 2276.283276,
      "adr_mean": 0.217951,
      "max_drawdown": -275.03638,
      "r_over_drawdown": 8.276299,
      "row_pf": 1.242893
    },
    "weekly_hold": {
      "adr_sum": 732.900462,
      "adr_mean": 0.070174,
      "max_drawdown": -126.241709,
      "r_over_drawdown": 5.805533,
      "row_pf": 1.136683
    },
    "degraded_row_count": 1813,
    "negative_adr_grid_years": 0,
    "worst_adr_grid_year": {
      "year": 2019,
      "adr_grid_adr": 13.038684,
      "weekly_hold_adr": 159.647828
    },
    "decision_signature_sha256": "81577C4BABEE192F9CACB4556B035A68A7C0D76AAD7C976EFA55F0FCD87B4D23"
  },
  "best_weekly_hold_candidate": {
    "candidate_id": "candidate_c_scenario_memory_guarded",
    "family": "final_forced28_candidate",
    "adr_grid": {
      "adr_sum": 2276.283276,
      "adr_mean": 0.217951,
      "max_drawdown": -275.03638,
      "r_over_drawdown": 8.276299,
      "row_pf": 1.242893
    },
    "weekly_hold": {
      "adr_sum": 732.900462,
      "adr_mean": 0.070174,
      "max_drawdown": -126.241709,
      "r_over_drawdown": 5.805533,
      "row_pf": 1.136683
    },
    "degraded_row_count": 1813,
    "negative_adr_grid_years": 0,
    "worst_adr_grid_year": {
      "year": 2019,
      "adr_grid_adr": 13.038684,
      "weekly_hold_adr": 159.647828
    },
    "decision_signature_sha256": "81577C4BABEE192F9CACB4556B035A68A7C0D76AAD7C976EFA55F0FCD87B4D23"
  },
  "genuinely_new_candidate_count": 2,
  "no_promotion": true
}
```

## Validation

```json
{
  "exactly_three_candidates_scored": true,
  "forced28_preserved_for_every_candidate": true,
  "decision_rows": 31332,
  "expected_decision_rows": 31332,
  "outcome_fields_used_for_decision_logic": false,
  "outcome_fields_used_for_scoring_only": true,
  "pair_exclusions": 0,
  "date_exclusions": 0,
  "optimized_thresholds": false,
  "learned_weights": false,
  "final_promotion": false
}
```

## Artifacts

- Matrix rows: `docs/research/gates/gate67c/artifacts/gate67c-final-forced28-test-matrix/final-forced28-test-matrix.rows.jsonl`
- Test summary: `docs/research/gates/gate67c/artifacts/gate67c-final-forced28-test-matrix/final-forced28-test-summary.json`
- Best candidate review: `docs/research/gates/gate67c/artifacts/gate67c-final-forced28-test-matrix/final-forced28-best-candidate-review.md`
- Year diagnostics: `docs/research/gates/gate67c/artifacts/gate67c-final-forced28-test-matrix/final-forced28-year-by-year-diagnostics.json`
- Policy participation: `docs/research/gates/gate67c/artifacts/gate67c-final-forced28-test-matrix/final-forced28-policy-participation.json`
- Reason-code diagnostics: `docs/research/gates/gate67c/artifacts/gate67c-final-forced28-test-matrix/final-forced28-reason-code-diagnostics.json`
- Signature collapse: `docs/research/gates/gate67c/artifacts/gate67c-final-forced28-test-matrix/final-forced28-signature-collapse.json`
- Comparison vs Gate 64/65: `docs/research/gates/gate67c/artifacts/gate67c-final-forced28-test-matrix/final-forced28-comparison-vs-gate64-65.json`
- SHA identity: `docs/research/gates/gate67c/artifacts/gate67c-final-forced28-test-matrix/gate67c-sha256.txt`

## Stop Line

Gate 67C stops at the fixed three-candidate test matrix. No final algorithm is named or promoted.
