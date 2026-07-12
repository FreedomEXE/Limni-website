# Gate 67B Final Forced-28 Candidate Contract

Generated: `2026-06-28T02:53:06.892Z`

## Verdict

`PASS_FINAL_FORCED28_CANDIDATE_CONTRACT__EXACTLY_THREE_UNNAMED_SIMPLE_CANDIDATES`

## Scope

- Defines exactly three unnamed final forced-28 algorithm candidates.
- Collapses Gate 65E router discovery into a small Brain arbitration test set.
- Does not score, promote, name, brand, risk-filter, or execute a final algorithm.
- Uses fixed rules only; no optimized thresholds, learned weights, pair exclusions, or date exclusions.

## Candidates

| candidate_id | candidate_label | complexity | source_cells |
|---|---|---|---|
| candidate_a_macro_anchor_conservative | Candidate A - Macro Anchor Conservative | 4 | regime, cot, strength |
| candidate_b_macro_anchor_with_cot_warning | Candidate B - Macro Anchor with COT Warning | 3 | regime, cot, strength |
| candidate_c_scenario_memory_guarded | Candidate C - Scenario-Memory Guarded | 5 | regime, cot, strength |

## Rule Boundary

```json
{
  "exactly_three_candidates": true,
  "final_algorithm_name": null,
  "final_algorithm_named_or_branded": false,
  "optimized_thresholds": false,
  "learned_weights": false,
  "pair_exclusions": false,
  "date_exclusions": false,
  "final_promotion": false
}
```

## Artifacts

- Candidate contracts: `docs/research/gates/gate67b/artifacts/gate67b-final-forced28-candidate-contract/final-forced28-candidate-contracts.json`
- Arbitration rules: `docs/research/gates/gate67b/artifacts/gate67b-final-forced28-candidate-contract/final-forced28-arbitration-rules.md`
- Reason-code contract: `docs/research/gates/gate67b/artifacts/gate67b-final-forced28-candidate-contract/final-forced28-reason-code-contract.json`
- Summary: `docs/research/gates/gate67b/artifacts/gate67b-final-forced28-candidate-contract/gate67b-summary.json`
- SHA identity: `docs/research/gates/gate67b/artifacts/gate67b-final-forced28-candidate-contract/gate67b-sha256.txt`

## Stop Line

Gate 67B stops at candidate contracts. It does not score candidates or promote a final algorithm.
