# Gate 68A Brain Mode Selector Rules

The final algorithm remains unnamed. Candidate D is a single deterministic selector over the three Gate 67 candidates.

## Modes

- `NORMAL` maps to `candidate_b_macro_anchor_with_cot_warning`.
- `PROTECTION` maps to `candidate_c_scenario_memory_guarded`.
- `CONSERVATIVE` maps to `candidate_a_macro_anchor_conservative`.

## Priority

1. Select `CONSERVATIVE` when source quality or macro-anchor evidence is degraded, fail-closed, mixed, or ambiguous.
2. Select `PROTECTION` when the fixed Candidate C robust scenario guard activates from point-in-time state.
3. Otherwise select `NORMAL`.

## Fixed Boundary

- Scenario memory cannot choose a new direction; it can only select `PROTECTION` or leave `NORMAL` safe.
- Strength may confirm or warn; it cannot create a fourth mode.
- COT high-confidence crowding contradiction remains inside `NORMAL` mode behavior.
- Candidate A/B/C behavior is unchanged.
- No outcomes, optimized thresholds, learned weights, pair exclusions, or date exclusions are mode-selection inputs.
