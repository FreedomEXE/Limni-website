# Gate 68B Brain Mode Selector Test Matrix

Generated: `2026-06-28T04:43:20.534Z`

## Verdict

`PASS_BRAIN_MODE_SELECTOR_TEST_MATRIX__EXACTLY_FOUR_CANDIDATES__FORCED28_PRESERVED__NO_PROMOTION`

## Scope

- Scores exactly four candidates: Gate 67 Candidate A, B, C, and Candidate D Brain Mode Selector.
- Candidate D emits one forced-28 decision and one mode per pair-week.
- Outcomes are used only after fixed decisions are emitted.
- No candidate promotion, optimized threshold search, learned weights, pair exclusions, or date exclusions are introduced.

## Candidate Metrics

| candidate_id | adr | dd | rdd | pf | wh | wh_rdd | wh_pf | neg_years | warnings | fallback | veto |
|---|---|---|---|---|---|---|---|---|---|---|---|
| candidate_b_macro_anchor_with_cot_warning | 2341.080708 | -241.508971 | 9.693556 | 1.25407 | 638.603176 | 5.468441 | 1.118059 | 1 | 1292 | 1292 | 1292 |
| candidate_c_scenario_memory_guarded | 2276.283276 | -275.03638 | 8.276299 | 1.242893 | 732.900462 | 5.805533 | 1.136683 | 0 | 1813 | 5883 | 1813 |
| candidate_a_macro_anchor_conservative | 2184.300854 | -369.470056 | 5.911983 | 1.233289 | 787.143516 | 5.736025 | 1.147545 | 0 | 691 | 4761 | 691 |
| candidate_d_brain_mode_selector | 2235.61899 | -388.935048 | 5.748052 | 1.239439 | 846.072114 | 7.273626 | 1.159472 | 1 | 1353 | 4850 | 1353 |

## Candidate D Findings

```json
{
  "candidate_d": {
    "candidate_id": "candidate_d_brain_mode_selector",
    "family": "brain_mode_selector",
    "adr_grid": {
      "adr_sum": 2235.61899,
      "adr_mean": 0.214058,
      "max_drawdown": -388.935048,
      "r_over_drawdown": 5.748052,
      "row_pf": 1.239439
    },
    "weekly_hold": {
      "adr_sum": 846.072114,
      "adr_mean": 0.08101,
      "max_drawdown": -116.320546,
      "r_over_drawdown": 7.273626,
      "row_pf": 1.159472
    },
    "degraded_row_count": 7864,
    "negative_adr_grid_years": 1,
    "worst_adr_grid_year": {
      "year": 2019,
      "adr_grid_adr": -3.699695,
      "weekly_hold_adr": 198.47955
    },
    "decision_signature_sha256": "5FC0C033E0464597AAC0DCC3E50C2F7133C55C2BC05262BE545E1FBC5682D78B",
    "mode_counts": {
      "CONSERVATIVE": 6762,
      "NORMAL": 2811,
      "PROTECTION": 871
    }
  },
  "mode_counts": {
    "CONSERVATIVE": 6762,
    "NORMAL": 2811,
    "PROTECTION": 871
  },
  "reason_code_counts": {
    "A_ALPHA_FALLBACK_VALUATION_DID_NOT_CONFIRM_RRP": 3497,
    "A_COT_HIGH_CONF_WARNING_FALLBACK_ALPHA": 251,
    "A_RRP_VALUATION_CONFIRMED_ANCHOR": 3014,
    "B_COT_HIGH_CONF_WARNING_FALLBACK_ALPHA": 231,
    "B_RRP_ANCHOR_NO_COT_WARNING": 2580,
    "C_SCENARIO_MEMORY_ROBUST_GUARD_ENABLED": 871,
    "COT_STRENGTH_AGREE_BUT_NOT_BOTH_DIRECT": 738,
    "COT_STRENGTH_CLEAN_DIRECT_AGREEMENT": 133,
    "MODE_CONSERVATIVE_CELL_QUALITY_CLEAN": 1161,
    "MODE_CONSERVATIVE_CELL_QUALITY_NOT_CLEAN": 5601,
    "MODE_CONSERVATIVE_MACRO_ANCHOR_CLEAN": 3894,
    "MODE_CONSERVATIVE_MACRO_ANCHOR_NOT_CLEAN": 2868,
    "MODE_CONSERVATIVE_QUALITY_CLEAN": 14439,
    "MODE_CONSERVATIVE_QUALITY_DEGRADED": 5847,
    "MODE_NORMAL_DEFAULT": 2811,
    "MODE_PROTECTION_SCENARIO_MEMORY_ROBUST_GUARD_ENABLED": 871,
    "STRENGTH_CONFIRMED_RRP": 3275,
    "STRENGTH_CONTEXT_ONLY": 2370,
    "STRENGTH_DID_NOT_CONFIRM_RRP": 200,
    "VALUATION_CONFIRMED_RRP": 3109,
    "VALUATION_CONTEXT_ONLY": 573
  },
  "delta_vs_candidate_b": {
    "adr_grid_adr_delta": -105.461718,
    "adr_grid_rdd_delta": -3.945504,
    "adr_grid_pf_delta": -0.014631,
    "weekly_hold_adr_delta": 207.468938,
    "weekly_hold_rdd_delta": 1.805185,
    "weekly_hold_pf_delta": 0.041413,
    "negative_adr_grid_year_delta": 0
  },
  "delta_vs_candidate_c": {
    "adr_grid_adr_delta": -40.664286,
    "adr_grid_rdd_delta": -2.528247,
    "adr_grid_pf_delta": -0.003454,
    "weekly_hold_adr_delta": 113.171652,
    "weekly_hold_rdd_delta": 1.468093,
    "weekly_hold_pf_delta": 0.022789,
    "negative_adr_grid_year_delta": 1
  },
  "signature_collapse": {
    "candidate_id": "candidate_d_brain_mode_selector",
    "decision_signature_sha256": "5FC0C033E0464597AAC0DCC3E50C2F7133C55C2BC05262BE545E1FBC5682D78B",
    "equivalent_gate64c_candidate_id": null,
    "equivalent_gate65e_candidate_id": null,
    "equivalent_gate67_candidate_id": null,
    "genuinely_new_vs_gate64_65_67": true
  },
  "improved_vs_candidate_b_on_adr_grid_rdd": false,
  "preserves_candidate_c_zero_negative_years": false,
  "no_promotion": true
}
```

## Validation

```json
{
  "exactly_four_candidates_scored": true,
  "candidate_d_has_one_forced28_direction_per_pair_week": true,
  "candidate_d_has_one_mode_per_pair_week": true,
  "forced28_preserved_for_every_candidate": true,
  "decision_rows": 41776,
  "expected_decision_rows": 41776,
  "outcome_fields_used_for_mode_selection": false,
  "outcome_fields_used_for_scoring_only": true,
  "pair_exclusions": 0,
  "date_exclusions": 0,
  "optimized_thresholds": false,
  "learned_weights": false,
  "final_promotion": false
}
```

## Artifacts

- Matrix rows: `docs/research/gates/gate68b/artifacts/gate68b-brain-mode-selector-test-matrix/brain-mode-selector-test-matrix.rows.jsonl`
- Test summary: `docs/research/gates/gate68b/artifacts/gate68b-brain-mode-selector-test-matrix/brain-mode-selector-test-summary.json`
- Best candidate review: `docs/research/gates/gate68b/artifacts/gate68b-brain-mode-selector-test-matrix/brain-mode-selector-best-candidate-review.md`
- Mode diagnostics: `docs/research/gates/gate68b/artifacts/gate68b-brain-mode-selector-test-matrix/brain-mode-selector-mode-diagnostics.json`
- Year diagnostics: `docs/research/gates/gate68b/artifacts/gate68b-brain-mode-selector-test-matrix/brain-mode-selector-year-by-year-diagnostics.json`
- Reason-code diagnostics: `docs/research/gates/gate68b/artifacts/gate68b-brain-mode-selector-test-matrix/brain-mode-selector-reason-code-diagnostics.json`
- Policy participation: `docs/research/gates/gate68b/artifacts/gate68b-brain-mode-selector-test-matrix/brain-mode-selector-policy-participation.json`
- Signature collapse: `docs/research/gates/gate68b/artifacts/gate68b-brain-mode-selector-test-matrix/brain-mode-selector-signature-collapse.json`
- Comparison vs Gate 64-67: `docs/research/gates/gate68b/artifacts/gate68b-brain-mode-selector-test-matrix/brain-mode-selector-comparison-vs-gate64-67.json`
- SHA identity: `docs/research/gates/gate68b/artifacts/gate68b-brain-mode-selector-test-matrix/gate68b-sha256.txt`

## Stop Line

Gate 68B stops at the four-candidate test matrix. Candidate D is not promoted or named.
