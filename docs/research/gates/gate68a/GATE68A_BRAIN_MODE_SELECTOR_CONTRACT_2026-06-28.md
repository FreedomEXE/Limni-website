# Gate 68A Brain Mode Selector Contract

Generated: `2026-06-28T04:40:24.158Z`

## Verdict

`PASS_BRAIN_MODE_SELECTOR_CONTRACT__ONE_SELECTOR_THREE_MODES_NO_OUTCOME_INPUTS`

## Scope

- Defines exactly one deterministic Brain Mode Selector.
- Uses exactly three modes: NORMAL, PROTECTION, and CONSERVATIVE.
- Maps modes to unchanged Gate 67 Candidate B, C, and A behavior.
- Does not use outcomes, optimized thresholds, learned weights, pair/date exclusions, or final naming.

## Mode Map

| mode | behavior_candidate_id | purpose |
|---|---|---|
| NORMAL | candidate_b_macro_anchor_with_cot_warning | Default macro-anchor behavior with COT high-confidence warning/fallback inside the mode. |
| PROTECTION | candidate_c_scenario_memory_guarded | Use only when fixed scenario-memory and cell-state context says robust protection is required. |
| CONSERVATIVE | candidate_a_macro_anchor_conservative | Use when source quality, macro-anchor confirmation, or evidence clarity is degraded or ambiguous. |

## Validation

```json
{
  "exactly_one_combined_selector": true,
  "mode_count": 3,
  "allowed_modes_only": true,
  "references_candidate_a_b_c_as_mode_behaviors": true,
  "outcome_fields_used_for_mode_selection": false,
  "optimized_thresholds": false,
  "learned_weights": false,
  "pair_exclusions": 0,
  "date_exclusions": 0,
  "final_algorithm_named_or_promoted": false
}
```

## Artifacts

- Contract: `docs/research/gates/gate68a/artifacts/gate68a-brain-mode-selector-contract/brain-mode-selector-contract.json`
- Rules: `docs/research/gates/gate68a/artifacts/gate68a-brain-mode-selector-contract/brain-mode-selector-rules.md`
- Mode map: `docs/research/gates/gate68a/artifacts/gate68a-brain-mode-selector-contract/brain-mode-selector-mode-map.json`
- Reason-code contract: `docs/research/gates/gate68a/artifacts/gate68a-brain-mode-selector-contract/brain-mode-selector-reason-code-contract.json`
- Summary: `docs/research/gates/gate68a/artifacts/gate68a-brain-mode-selector-contract/gate68a-summary.json`
- SHA identity: `docs/research/gates/gate68a/artifacts/gate68a-brain-mode-selector-contract/gate68a-sha256.txt`

## Stop Line

Gate 68A stops at selector contract definition. It does not score, promote, name, or lock a final algorithm.
