# Gate 64A Silent Missing-Atom Audit

Generated: `2026-06-27T21:09:37.277Z`

## Verdict

`PASS_SILENT_MISSING_ATOM_AUDIT__VALUATION_GAP_REQUIRED_FOR_GATE64B__NO_OTHER_REQUIRED_MISSING`

## Boundary

- Audit only: COT, Strength, and Regime expected atoms versus emitted ledgers and Gate 63 matrix visibility.
- No Body design, Alpha v2, risk, exits, execution, MT5/live, app/runtime work, source mutation, COT retuning, Strength retuning, Regime source mutation, or broad Brain refactor.

## Denominator

```json
{
  "alpha_rows": 10444,
  "expected_alpha_rows": 10444,
  "alpha_weeks": 373,
  "expected_alpha_weeks": 373,
  "symbols_per_week_histogram": {
    "28": 373
  },
  "expected_symbols_per_week": 28,
  "full_weeks": 373,
  "duplicate_week_symbol_rows": 0,
  "bpr_pair_direction_rows": 10444,
  "expected_atom_count": 32,
  "required_missing_count": 1,
  "non_valuation_required_missing_count": 0,
  "valuation_gap_missing": true,
  "source_mutation_rows": 0
}
```

## Missing Required Atoms

```json
{
  "required_missing_count": 1,
  "required_missing_atoms": [
    {
      "cell_id": "regime",
      "atom_id": "valuation_gap",
      "decision_reason": "valuation_gap_formula_not_versioned",
      "route": "Gate 64B valuation-gap derived atom lock"
    }
  ],
  "non_valuation_required_missing_count": 0,
  "valuation_gap_status": {
    "cell_id": "regime",
    "atom_id": "valuation_gap",
    "label": "valuation gap derived Regime atom",
    "atom_class": "fail_closed_not_versioned_atom",
    "expected_scope": "conceptual",
    "required_before_body": true,
    "expected_source": "Gate 60C derived valuation contract",
    "emitted_probe": {
      "kind": "conceptual_only",
      "reason": "valuation_gap_formula_not_versioned"
    },
    "matrix_atom_keys": [
      "valuation_gap"
    ],
    "fail_closed_reason": "valuation_gap_formula_not_versioned",
    "emitted_rows": 0,
    "expected_rows": 0,
    "emitted_status": "conceptual_fail_closed",
    "brain_architecture_visible": false,
    "matrix_visible": false,
    "matrix_candidate_ids": [],
    "required_before_body_decision": "required_now",
    "decision_reason": "valuation_gap_formula_not_versioned"
  }
}
```

## Matrix Visibility

```json
{
  "matrix_visible_atoms": [
    "cot_side",
    "strength_gate57e_side",
    "bpr_futures",
    "bpr_futures_and_options",
    "bpr_futures_carried_state",
    "bpr_futures_synthetic_usd_state",
    "nominal_rate_3m",
    "cpi_inflation_yoy",
    "rrp_derived",
    "ppp",
    "neer",
    "reer"
  ],
  "emitted_not_matrix_visible_atoms": [
    {
      "atom_id": "cot_tei_spread",
      "cell_id": "cot",
      "atom_class": "raw_source_atom",
      "decision": "already_covered"
    },
    {
      "atom_id": "cot_abs_tei_spread",
      "cell_id": "cot",
      "atom_class": "source_quality_atom",
      "decision": "already_covered"
    },
    {
      "atom_id": "cot_tei_spread_bucket",
      "cell_id": "cot",
      "atom_class": "source_quality_atom",
      "decision": "already_covered"
    },
    {
      "atom_id": "cot_tie_flag",
      "cell_id": "cot",
      "atom_class": "source_quality_atom",
      "decision": "already_covered"
    },
    {
      "atom_id": "cot_carry_forward_flag",
      "cell_id": "cot",
      "atom_class": "source_quality_atom",
      "decision": "already_covered"
    },
    {
      "atom_id": "cot_carry_previous_flag",
      "cell_id": "cot",
      "atom_class": "source_quality_atom",
      "decision": "already_covered"
    },
    {
      "atom_id": "cot_lifecycle_state",
      "cell_id": "cot",
      "atom_class": "source_quality_atom",
      "decision": "already_covered"
    },
    {
      "atom_id": "strength_parent_side",
      "cell_id": "strength",
      "atom_class": "direction_atom",
      "decision": "already_covered"
    },
    {
      "atom_id": "strength_score_spread",
      "cell_id": "strength",
      "atom_class": "raw_source_atom",
      "decision": "already_covered"
    },
    {
      "atom_id": "strength_abs_score_spread",
      "cell_id": "strength",
      "atom_class": "source_quality_atom",
      "decision": "already_covered"
    },
    {
      "atom_id": "strength_score_spread_bucket",
      "cell_id": "strength",
      "atom_class": "source_quality_atom",
      "decision": "already_covered"
    },
    {
      "atom_id": "strength_lifecycle_bucket",
      "cell_id": "strength",
      "atom_class": "source_quality_atom",
      "decision": "already_covered"
    },
    {
      "atom_id": "strength_phase_bucket",
      "cell_id": "strength",
      "atom_class": "source_quality_atom",
      "decision": "already_covered"
    },
    {
      "atom_id": "strength_lifecycle_phase_key",
      "cell_id": "strength",
      "atom_class": "source_quality_atom",
      "decision": "already_covered"
    },
    {
      "atom_id": "strength_gate57c_side",
      "cell_id": "strength",
      "atom_class": "direction_atom",
      "decision": "already_covered"
    },
    {
      "atom_id": "strength_gate57c_action_label",
      "cell_id": "strength",
      "atom_class": "source_quality_atom",
      "decision": "already_covered"
    },
    {
      "atom_id": "strength_gate57d_side",
      "cell_id": "strength",
      "atom_class": "direction_atom",
      "decision": "already_covered"
    },
    {
      "atom_id": "strength_gate57d_action_label",
      "cell_id": "strength",
      "atom_class": "source_quality_atom",
      "decision": "already_covered"
    },
    {
      "atom_id": "strength_gate57e_action_label",
      "cell_id": "strength",
      "atom_class": "source_quality_atom",
      "decision": "already_covered"
    }
  ],
  "conceptual_not_matrix_visible_atoms": [
    "valuation_gap"
  ]
}
```

## Decision

Valuation gap is the required conceptual Regime atom that is not emitted in Gate 63. It is routed to Gate 64B. No other required atom was silently missing from the source ledgers audited here.

## Artifacts

- Expected inventory: `docs/research/gates/gate64a/artifacts/gate64a-silent-missing-atom-audit/expected-atom-inventory.contract.json`
- Emitted map: `docs/research/gates/gate64a/artifacts/gate64a-silent-missing-atom-audit/emitted-vs-expected-atom-map.json`
- Missing report: `docs/research/gates/gate64a/artifacts/gate64a-silent-missing-atom-audit/missing-atom-report.json`
- Matrix visibility: `docs/research/gates/gate64a/artifacts/gate64a-silent-missing-atom-audit/matrix-visibility-report.json`
- SHA identity: `docs/research/gates/gate64a/artifacts/gate64a-silent-missing-atom-audit/gate64a-silent-missing-atom-audit.sha256.txt`

## Stop Line

Stop Gate 64A after audit. Proceed to Gate 64B only because valuation_gap is the only required missing atom and it can be tested against existing valuation inputs without source mutation.
