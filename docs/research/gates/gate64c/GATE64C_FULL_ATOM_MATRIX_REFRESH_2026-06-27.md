# Gate 64C Full Atom Matrix Refresh

Generated: `2026-06-27T21:08:49.495Z`

## Verdict

`PASS_FULL_ATOM_MATRIX_REFRESH__VALUATION_GAP_INCLUDED__DISCOVERY_ONLY_NO_BODY`

## Boundary

- Full atom matrix refresh with Gate 64A audit and Gate 64B valuation-gap atoms included.
- Dependency-style interactions are predeclared and small: follow, fade, confirm, contradict, quality/tier context, and tie-breaker.
- No final Body algorithm, Alpha v2 lock, risk, exits, execution, MT5/live, app/runtime work, source mutation, COT/Strength retuning, optimized thresholds, pair exclusions, or date exclusions.

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
  "valuation_gap_pair_rows": 20888,
  "candidate_count": 26,
  "disqualified_candidates": 0,
  "source_mutation_rows": 0,
  "body_algorithm_started": false,
  "alpha_v2_started": false
}
```

## Top Candidates By ADR Grid R/DD

| Rank | Candidate | Family | ADR Grid | DD | R/DD | Weekly Hold | Degraded | Negative Years |
|---:|---|---|---:|---:|---:|---:|---:|---:|
| 1 | valuation_gap_relative_inverse_extreme_else_rrp_inverse | valuation_gap_tiered | 2422.437808 | -271.139895 | 8.934273 | 620.140634 | 0 | 3 |
| 2 | gate63_cot_strength_rrp_inverse_majority | gate63_continuity | 1938.481292 | -258.36132 | 7.502986 | 634.471586 | 0 | 1 |
| 3 | gate63_rrp_derived_inverse | gate63_continuity | 2383.621777 | -346.988306 | 6.869459 | 688.316096 | 0 | 2 |
| 4 | rrp_inverse_when_disagrees_valuation_reer_else_valuation | atom_dependency | 2383.621777 | -346.988306 | 6.869459 | 688.316096 | 0 | 2 |
| 5 | cot_strength_rrp_valuation_reer_majority | cross_cell_composite | 1957.696802 | -304.367089 | 6.432025 | 774.317348 | 0 | 3 |
| 6 | strength_when_agrees_valuation_reer_else_rrp | atom_dependency | 2065.468717 | -329.131119 | 6.275519 | 821.350178 | 0 | 1 |
| 7 | cot_strength_tie_breaker_valuation_reer_inverse | valuation_gap_tie_breaker | 1692.671866 | -277.198413 | 6.106355 | 557.170064 | 0 | 0 |
| 8 | rrp_inverse_when_agrees_valuation_reer_else_alpha | atom_dependency | 2168.117445 | -355.359825 | 6.101189 | 831.585556 | 0 | 0 |
| 9 | cot_extreme_follow_else_alpha | follow_fade | 1736.301146 | -310.946173 | 5.583928 | 552.701948 | 0 | 1 |
| 10 | cot_strength_rrp_valuation_relative_majority | cross_cell_composite | 1940.856497 | -352.255862 | 5.509792 | 632.205622 | 0 | 2 |
| 11 | gate63_alpha_v1_frozen_final_side | gate63_continuity | 1648.250785 | -312.072214 | 5.281633 | 534.366308 | 0 | 1 |
| 12 | cot_strength_tie_breaker_valuation_relative_inverse | valuation_gap_tie_breaker | 1375.706265 | -284.177614 | 4.841009 | 307.051448 | 0 | 1 |
| 13 | cot_when_agrees_valuation_reer_else_rrp | atom_dependency | 1604.115461 | -337.065864 | 4.759056 | 649.982996 | 0 | 3 |
| 14 | strength_persistent_follow_else_alpha | follow_fade | 1403.874131 | -300.87959 | 4.6659 | 437.34298 | 0 | 2 |
| 15 | cot_strength_regime_valuation_bundle_reer | cross_cell_composite | 1639.00817 | -381.161907 | 4.300031 | 645.004192 | 0 | 1 |
| 16 | bpr_when_agrees_valuation_reer_else_rrp | atom_dependency | 1549.848628 | -378.987486 | 4.089445 | 556.760238 | 3188 | 2 |

## Gate 63 Comparison

```json
{
  "gate63_best_by_adr_grid_r_over_drawdown": {
    "candidate_id": "cot_strength_bpr_rrp_inverse_majority_tie_rrp",
    "family": "cross_atom_composite",
    "candidate_direction_kind": "candidate_composite_direction",
    "interpretation_bucket": "fragile_or_governance_review",
    "complexity": 4,
    "source_count": 3,
    "adr_grid": {
      "adr_sum": 1871.434177,
      "adr_mean": 0.179187,
      "max_drawdown": -223.784751,
      "r_over_drawdown": 8.362653,
      "row_pf": 1.192983
    },
    "weekly_hold": {
      "adr_sum": 654.974192,
      "adr_mean": 0.062713,
      "max_drawdown": -120.855972,
      "r_over_drawdown": 5.419461,
      "row_pf": 1.121269
    },
    "missing_degraded_row_count": 5331,
    "negative_adr_grid_years": 2,
    "worst_adr_grid_year": {
      "year": 2019,
      "adr_grid_adr": -130.537912,
      "weekly_hold_adr": 80.392462
    }
  },
  "gate64c_best_by_adr_grid_r_over_drawdown": {
    "candidate_id": "valuation_gap_relative_inverse_extreme_else_rrp_inverse",
    "family": "valuation_gap_tiered",
    "interpretation_bucket": "fragile_or_governance_review",
    "adr_grid": {
      "adr_sum": 2422.437808,
      "adr_mean": 0.231945,
      "max_drawdown": -271.139895,
      "r_over_drawdown": 8.934273,
      "row_pf": 1.264195
    },
    "weekly_hold": {
      "adr_sum": 620.140634,
      "adr_mean": 0.059378,
      "max_drawdown": -157.534342,
      "r_over_drawdown": 3.936543,
      "row_pf": 1.11445
    },
    "degraded_row_count": 0,
    "negative_adr_grid_years": 3,
    "worst_adr_grid_year": {
      "year": 2019,
      "adr_grid_adr": -134.917366,
      "weekly_hold_adr": 80.840358
    },
    "complexity": 2
  },
  "gate64c_best_valuation_gap_enhanced": {
    "candidate_id": "valuation_gap_relative_inverse_extreme_else_rrp_inverse",
    "family": "valuation_gap_tiered",
    "interpretation_bucket": "fragile_or_governance_review",
    "adr_grid": {
      "adr_sum": 2422.437808,
      "adr_mean": 0.231945,
      "max_drawdown": -271.139895,
      "r_over_drawdown": 8.934273,
      "row_pf": 1.264195
    },
    "weekly_hold": {
      "adr_sum": 620.140634,
      "adr_mean": 0.059378,
      "max_drawdown": -157.534342,
      "r_over_drawdown": 3.936543,
      "row_pf": 1.11445
    },
    "degraded_row_count": 0,
    "negative_adr_grid_years": 3,
    "worst_adr_grid_year": {
      "year": 2019,
      "adr_grid_adr": -134.917366,
      "weekly_hold_adr": 80.840358
    },
    "complexity": 2
  },
  "interpretation": "Gate 64C is discovery-only; comparison does not promote Alpha v2 or Body logic."
}
```

## Artifacts

- Candidate contracts: `docs/research/gates/gate64c/artifacts/gate64c-full-atom-matrix-refresh/gate64c-candidate-contracts.json`
- Matrix rows: `docs/research/gates/gate64c/artifacts/gate64c-full-atom-matrix-refresh/gate64c-matrix.rows.jsonl`
- Summary JSON: `docs/research/gates/gate64c/artifacts/gate64c-full-atom-matrix-refresh/gate64c-summary.json`
- Best candidates: `docs/research/gates/gate64c/artifacts/gate64c-full-atom-matrix-refresh/gate64c-best-candidates.md`
- Year diagnostics: `docs/research/gates/gate64c/artifacts/gate64c-full-atom-matrix-refresh/gate64c-year-by-year-diagnostics.json`
- Valuation-gap diagnostics: `docs/research/gates/gate64c/artifacts/gate64c-full-atom-matrix-refresh/gate64c-valuation-gap-diagnostics.json`
- Atom dependency diagnostics: `docs/research/gates/gate64c/artifacts/gate64c-full-atom-matrix-refresh/gate64c-atom-dependency-diagnostics.json`
- Quality diagnostics: `docs/research/gates/gate64c/artifacts/gate64c-full-atom-matrix-refresh/gate64c-quality-diagnostics.json`
- SHA identity: `docs/research/gates/gate64c/artifacts/gate64c-full-atom-matrix-refresh/gate64c-sha256.txt`

## Stop Line

Stop after Gate 64C. Do not proceed to Body design, Alpha v2, exit-layer research, risk, execution, MT5/live, app/runtime, source mutation, COT retuning, Strength retuning, or broad Brain source consolidation.
