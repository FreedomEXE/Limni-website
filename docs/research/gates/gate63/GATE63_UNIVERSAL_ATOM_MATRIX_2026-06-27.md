# Gate 63 Universal Atom Matrix

Generated: `2026-06-27T19:58:38.423Z`

## Verdict

`PASS_UNIVERSAL_ATOM_MATRIX__FORCED28_PRESERVED__DISCOVERY_ONLY__NO_BODY`

## Boundary

- Universal all-atom discovery matrix across COT, Strength, and Regime cells.
- Uses frozen Gate 59 outcomes and Gate 60C/60G/60H Regime artifacts.
- Candidate labels use `candidate_atom_direction`, `candidate_cell_direction`, and `candidate_composite_direction`.
- No promotion, Body algorithm, Alpha v2, risk, exits, execution, MT5/live, app/runtime work, source mutation, COT retuning, Strength retuning, or broad Brain refactor.

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
  "candidate_count": 32,
  "disqualified_candidates": 0,
  "candidate_direction_kind_counts": {
    "candidate_atom_direction": 13,
    "candidate_cell_direction": 4,
    "candidate_composite_direction": 15
  },
  "source_mutation_rows": 0,
  "body_algorithm_started": false,
  "promotion_started": false
}
```

## Top Candidates By ADR Grid R/DD

| Rank | Candidate | Family | ADR Grid | DD | R/DD | Weekly Hold | Degraded Rows | Negative Years |
|---:|---|---|---:|---:|---:|---:|---:|---:|
| 1 | cot_strength_bpr_rrp_inverse_majority_tie_rrp | cross_atom_composite | 1871.434177 | -223.784751 | 8.362653 | 654.974192 | 5331 | 2 |
| 2 | cot_strength_rrp_inverse_majority | three_cell_composite | 1938.481292 | -258.36132 | 7.502986 | 634.471586 | 0 | 1 |
| 3 | cot_strength_regime_best_rrp_inverse | three_cell_composite | 1938.481292 | -258.36132 | 7.502986 | 634.471586 | 0 | 1 |
| 4 | regime_cell_gate62_best_rrp_derived_inverse | single_cell_baseline | 2383.621777 | -346.988306 | 6.869459 | 688.316096 | 0 | 2 |
| 5 | rrp_derived_inverse | single_regime_atom | 2383.621777 | -346.988306 | 6.869459 | 688.316096 | 0 | 2 |
| 6 | cot_plus_rrp_inverse_tie_rrp | two_cell_composite | 2383.621777 | -346.988306 | 6.869459 | 688.316096 | 0 | 2 |
| 7 | strength_plus_rrp_inverse_tie_rrp | two_cell_composite | 2383.621777 | -346.988306 | 6.869459 | 688.316096 | 0 | 2 |
| 8 | alpha_v1_plus_rrp_inverse_tie_rrp | alpha_regime_composite | 2383.621777 | -346.988306 | 6.869459 | 688.316096 | 0 | 2 |
| 9 | cot_strength_rrp_ppp_reer_inverse_majority | cross_atom_composite | 2223.570939 | -338.570977 | 6.567518 | 829.13383 | 0 | 1 |
| 10 | cot_strength_full_regime_inverse_majority | three_cell_composite | 1696.064942 | -265.665025 | 6.384224 | 620.233774 | 5331 | 0 |
| 11 | cot_strength_rrp_ppp_neer_reer_inverse_majority | cross_atom_composite | 1914.594104 | -300.48435 | 6.371693 | 839.4598 | 0 | 2 |
| 12 | cot_strength_reer_inverse_majority | three_cell_composite | 1692.671866 | -277.198413 | 6.106355 | 557.170064 | 0 | 0 |
| 13 | alpha_v1_frozen_final_side | single_cell_baseline | 1648.250785 | -312.072214 | 5.281633 | 534.366308 | 0 | 1 |
| 14 | alpha_v1_plus_rrp_inverse_tie_alpha | alpha_regime_composite | 1648.250785 | -312.072214 | 5.281633 | 534.366308 | 0 | 1 |
| 15 | cot_strength_ppp_inverse_majority | three_cell_composite | 1775.335668 | -341.144558 | 5.204057 | 572.570716 | 0 | 1 |
| 16 | strength_cell_gate57e_side | single_cell_baseline | 1386.281312 | -304.412583 | 4.553955 | 401.524762 | 0 | 1 |

## Ranking Views

```json
{
  "best_by_adr_grid_r_over_drawdown": [
    {
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
    {
      "candidate_id": "cot_strength_rrp_inverse_majority",
      "family": "three_cell_composite",
      "candidate_direction_kind": "candidate_composite_direction",
      "interpretation_bucket": "promising_discovery_only",
      "complexity": 3,
      "source_count": 3,
      "adr_grid": {
        "adr_sum": 1938.481292,
        "adr_mean": 0.185607,
        "max_drawdown": -258.36132,
        "r_over_drawdown": 7.502986,
        "row_pf": 1.20065
      },
      "weekly_hold": {
        "adr_sum": 634.471586,
        "adr_mean": 0.06075,
        "max_drawdown": -163.935445,
        "r_over_drawdown": 3.870253,
        "row_pf": 1.11725
      },
      "missing_degraded_row_count": 0,
      "negative_adr_grid_years": 1,
      "worst_adr_grid_year": {
        "year": 2019,
        "adr_grid_adr": -72.0768,
        "weekly_hold_adr": 85.33688
      }
    },
    {
      "candidate_id": "cot_strength_regime_best_rrp_inverse",
      "family": "three_cell_composite",
      "candidate_direction_kind": "candidate_composite_direction",
      "interpretation_bucket": "promising_discovery_only",
      "complexity": 3,
      "source_count": 3,
      "adr_grid": {
        "adr_sum": 1938.481292,
        "adr_mean": 0.185607,
        "max_drawdown": -258.36132,
        "r_over_drawdown": 7.502986,
        "row_pf": 1.20065
      },
      "weekly_hold": {
        "adr_sum": 634.471586,
        "adr_mean": 0.06075,
        "max_drawdown": -163.935445,
        "r_over_drawdown": 3.870253,
        "row_pf": 1.11725
      },
      "missing_degraded_row_count": 0,
      "negative_adr_grid_years": 1,
      "worst_adr_grid_year": {
        "year": 2019,
        "adr_grid_adr": -72.0768,
        "weekly_hold_adr": 85.33688
      }
    },
    {
      "candidate_id": "regime_cell_gate62_best_rrp_derived_inverse",
      "family": "single_cell_baseline",
      "candidate_direction_kind": "candidate_cell_direction",
      "interpretation_bucket": "promising_discovery_only",
      "complexity": 1,
      "source_count": 1,
      "adr_grid": {
        "adr_sum": 2383.621777,
        "adr_mean": 0.228229,
        "max_drawdown": -346.988306,
        "r_over_drawdown": 6.869459,
        "row_pf": 1.259757
      },
      "weekly_hold": {
        "adr_sum": 688.316096,
        "adr_mean": 0.065905,
        "max_drawdown": -134.375348,
        "r_over_drawdown": 5.122339,
        "row_pf": 1.127837
      },
      "missing_degraded_row_count": 0,
      "negative_adr_grid_years": 2,
      "worst_adr_grid_year": {
        "year": 2024,
        "adr_grid_adr": -188.326514,
        "weekly_hold_adr": -68.645484
      }
    },
    {
      "candidate_id": "rrp_derived_inverse",
      "family": "single_regime_atom",
      "candidate_direction_kind": "candidate_atom_direction",
      "interpretation_bucket": "promising_discovery_only",
      "complexity": 1,
      "source_count": 1,
      "adr_grid": {
        "adr_sum": 2383.621777,
        "adr_mean": 0.228229,
        "max_drawdown": -346.988306,
        "r_over_drawdown": 6.869459,
        "row_pf": 1.259757
      },
      "weekly_hold": {
        "adr_sum": 688.316096,
        "adr_mean": 0.065905,
        "max_drawdown": -134.375348,
        "r_over_drawdown": 5.122339,
        "row_pf": 1.127837
      },
      "missing_degraded_row_count": 0,
      "negative_adr_grid_years": 2,
      "worst_adr_grid_year": {
        "year": 2024,
        "adr_grid_adr": -188.326514,
        "weekly_hold_adr": -68.645484
      }
    },
    {
      "candidate_id": "cot_plus_rrp_inverse_tie_rrp",
      "family": "two_cell_composite",
      "candidate_direction_kind": "candidate_composite_direction",
      "interpretation_bucket": "promising_discovery_only",
      "complexity": 2,
      "source_count": 2,
      "adr_grid": {
        "adr_sum": 2383.621777,
        "adr_mean": 0.228229,
        "max_drawdown": -346.988306,
        "r_over_drawdown": 6.869459,
        "row_pf": 1.259757
      },
      "weekly_hold": {
        "adr_sum": 688.316096,
        "adr_mean": 0.065905,
        "max_drawdown": -134.375348,
        "r_over_drawdown": 5.122339,
        "row_pf": 1.127837
      },
      "missing_degraded_row_count": 0,
      "negative_adr_grid_years": 2,
      "worst_adr_grid_year": {
        "year": 2024,
        "adr_grid_adr": -188.326514,
        "weekly_hold_adr": -68.645484
      }
    },
    {
      "candidate_id": "strength_plus_rrp_inverse_tie_rrp",
      "family": "two_cell_composite",
      "candidate_direction_kind": "candidate_composite_direction",
      "interpretation_bucket": "promising_discovery_only",
      "complexity": 2,
      "source_count": 2,
      "adr_grid": {
        "adr_sum": 2383.621777,
        "adr_mean": 0.228229,
        "max_drawdown": -346.988306,
        "r_over_drawdown": 6.869459,
        "row_pf": 1.259757
      },
      "weekly_hold": {
        "adr_sum": 688.316096,
        "adr_mean": 0.065905,
        "max_drawdown": -134.375348,
        "r_over_drawdown": 5.122339,
        "row_pf": 1.127837
      },
      "missing_degraded_row_count": 0,
      "negative_adr_grid_years": 2,
      "worst_adr_grid_year": {
        "year": 2024,
        "adr_grid_adr": -188.326514,
        "weekly_hold_adr": -68.645484
      }
    },
    {
      "candidate_id": "alpha_v1_plus_rrp_inverse_tie_rrp",
      "family": "alpha_regime_composite",
      "candidate_direction_kind": "candidate_composite_direction",
      "interpretation_bucket": "promising_discovery_only",
      "complexity": 2,
      "source_count": 2,
      "adr_grid": {
        "adr_sum": 2383.621777,
        "adr_mean": 0.228229,
        "max_drawdown": -346.988306,
        "r_over_drawdown": 6.869459,
        "row_pf": 1.259757
      },
      "weekly_hold": {
        "adr_sum": 688.316096,
        "adr_mean": 0.065905,
        "max_drawdown": -134.375348,
        "r_over_drawdown": 5.122339,
        "row_pf": 1.127837
      },
      "missing_degraded_row_count": 0,
      "negative_adr_grid_years": 2,
      "worst_adr_grid_year": {
        "year": 2024,
        "adr_grid_adr": -188.326514,
        "weekly_hold_adr": -68.645484
      }
    },
    {
      "candidate_id": "cot_strength_rrp_ppp_reer_inverse_majority",
      "family": "cross_atom_composite",
      "candidate_direction_kind": "candidate_composite_direction",
      "interpretation_bucket": "promising_discovery_only",
      "complexity": 5,
      "source_count": 3,
      "adr_grid": {
        "adr_sum": 2223.570939,
        "adr_mean": 0.212904,
        "max_drawdown": -338.570977,
        "r_over_drawdown": 6.567518,
        "row_pf": 1.23713
      },
      "weekly_hold": {
        "adr_sum": 829.13383,
        "adr_mean": 0.079389,
        "max_drawdown": -123.117691,
        "r_over_drawdown": 6.734482,
        "row_pf": 1.15603
      },
      "missing_degraded_row_count": 0,
      "negative_adr_grid_years": 1,
      "worst_adr_grid_year": {
        "year": 2019,
        "adr_grid_adr": -24.055963,
        "weekly_hold_adr": 126.040684
      }
    },
    {
      "candidate_id": "cot_strength_full_regime_inverse_majority",
      "family": "three_cell_composite",
      "candidate_direction_kind": "candidate_composite_direction",
      "interpretation_bucket": "fragile_or_governance_review",
      "complexity": 9,
      "source_count": 3,
      "adr_grid": {
        "adr_sum": 1696.064942,
        "adr_mean": 0.162396,
        "max_drawdown": -265.665025,
        "r_over_drawdown": 6.384224,
        "row_pf": 1.170992
      },
      "weekly_hold": {
        "adr_sum": 620.233774,
        "adr_mean": 0.059387,
        "max_drawdown": -120.348871,
        "r_over_drawdown": 5.153632,
        "row_pf": 1.114468
      },
      "missing_degraded_row_count": 5331,
      "negative_adr_grid_years": 0,
      "worst_adr_grid_year": {
        "year": 2019,
        "adr_grid_adr": 18.760722,
        "weekly_hold_adr": 141.99851
      }
    }
  ],
  "best_by_adr_grid_total": [
    {
      "candidate_id": "regime_cell_gate62_best_rrp_derived_inverse",
      "family": "single_cell_baseline",
      "candidate_direction_kind": "candidate_cell_direction",
      "interpretation_bucket": "promising_discovery_only",
      "complexity": 1,
      "source_count": 1,
      "adr_grid": {
        "adr_sum": 2383.621777,
        "adr_mean": 0.228229,
        "max_drawdown": -346.988306,
        "r_over_drawdown": 6.869459,
        "row_pf": 1.259757
      },
      "weekly_hold": {
        "adr_sum": 688.316096,
        "adr_mean": 0.065905,
        "max_drawdown": -134.375348,
        "r_over_drawdown": 5.122339,
        "row_pf": 1.127837
      },
      "missing_degraded_row_count": 0,
      "negative_adr_grid_years": 2,
      "worst_adr_grid_year": {
        "year": 2024,
        "adr_grid_adr": -188.326514,
        "weekly_hold_adr": -68.645484
      }
    },
    {
      "candidate_id": "rrp_derived_inverse",
      "family": "single_regime_atom",
      "candidate_direction_kind": "candidate_atom_direction",
      "interpretation_bucket": "promising_discovery_only",
      "complexity": 1,
      "source_count": 1,
      "adr_grid": {
        "adr_sum": 2383.621777,
        "adr_mean": 0.228229,
        "max_drawdown": -346.988306,
        "r_over_drawdown": 6.869459,
        "row_pf": 1.259757
      },
      "weekly_hold": {
        "adr_sum": 688.316096,
        "adr_mean": 0.065905,
        "max_drawdown": -134.375348,
        "r_over_drawdown": 5.122339,
        "row_pf": 1.127837
      },
      "missing_degraded_row_count": 0,
      "negative_adr_grid_years": 2,
      "worst_adr_grid_year": {
        "year": 2024,
        "adr_grid_adr": -188.326514,
        "weekly_hold_adr": -68.645484
      }
    },
    {
      "candidate_id": "cot_plus_rrp_inverse_tie_rrp",
      "family": "two_cell_composite",
      "candidate_direction_kind": "candidate_composite_direction",
      "interpretation_bucket": "promising_discovery_only",
      "complexity": 2,
      "source_count": 2,
      "adr_grid": {
        "adr_sum": 2383.621777,
        "adr_mean": 0.228229,
        "max_drawdown": -346.988306,
        "r_over_drawdown": 6.869459,
        "row_pf": 1.259757
      },
      "weekly_hold": {
        "adr_sum": 688.316096,
        "adr_mean": 0.065905,
        "max_drawdown": -134.375348,
        "r_over_drawdown": 5.122339,
        "row_pf": 1.127837
      },
      "missing_degraded_row_count": 0,
      "negative_adr_grid_years": 2,
      "worst_adr_grid_year": {
        "year": 2024,
        "adr_grid_adr": -188.326514,
        "weekly_hold_adr": -68.645484
      }
    },
    {
      "candidate_id": "strength_plus_rrp_inverse_tie_rrp",
      "family": "two_cell_composite",
      "candidate_direction_kind": "candidate_composite_direction",
      "interpretation_bucket": "promising_discovery_only",
      "complexity": 2,
      "source_count": 2,
      "adr_grid": {
        "adr_sum": 2383.621777,
        "adr_mean": 0.228229,
        "max_drawdown": -346.988306,
        "r_over_drawdown": 6.869459,
        "row_pf": 1.259757
      },
      "weekly_hold": {
        "adr_sum": 688.316096,
        "adr_mean": 0.065905,
        "max_drawdown": -134.375348,
        "r_over_drawdown": 5.122339,
        "row_pf": 1.127837
      },
      "missing_degraded_row_count": 0,
      "negative_adr_grid_years": 2,
      "worst_adr_grid_year": {
        "year": 2024,
        "adr_grid_adr": -188.326514,
        "weekly_hold_adr": -68.645484
      }
    },
    {
      "candidate_id": "alpha_v1_plus_rrp_inverse_tie_rrp",
      "family": "alpha_regime_composite",
      "candidate_direction_kind": "candidate_composite_direction",
      "interpretation_bucket": "promising_discovery_only",
      "complexity": 2,
      "source_count": 2,
      "adr_grid": {
        "adr_sum": 2383.621777,
        "adr_mean": 0.228229,
        "max_drawdown": -346.988306,
        "r_over_drawdown": 6.869459,
        "row_pf": 1.259757
      },
      "weekly_hold": {
        "adr_sum": 688.316096,
        "adr_mean": 0.065905,
        "max_drawdown": -134.375348,
        "r_over_drawdown": 5.122339,
        "row_pf": 1.127837
      },
      "missing_degraded_row_count": 0,
      "negative_adr_grid_years": 2,
      "worst_adr_grid_year": {
        "year": 2024,
        "adr_grid_adr": -188.326514,
        "weekly_hold_adr": -68.645484
      }
    },
    {
      "candidate_id": "cot_strength_rrp_ppp_reer_inverse_majority",
      "family": "cross_atom_composite",
      "candidate_direction_kind": "candidate_composite_direction",
      "interpretation_bucket": "promising_discovery_only",
      "complexity": 5,
      "source_count": 3,
      "adr_grid": {
        "adr_sum": 2223.570939,
        "adr_mean": 0.212904,
        "max_drawdown": -338.570977,
        "r_over_drawdown": 6.567518,
        "row_pf": 1.23713
      },
      "weekly_hold": {
        "adr_sum": 829.13383,
        "adr_mean": 0.079389,
        "max_drawdown": -123.117691,
        "r_over_drawdown": 6.734482,
        "row_pf": 1.15603
      },
      "missing_degraded_row_count": 0,
      "negative_adr_grid_years": 1,
      "worst_adr_grid_year": {
        "year": 2019,
        "adr_grid_adr": -24.055963,
        "weekly_hold_adr": 126.040684
      }
    },
    {
      "candidate_id": "cot_strength_rrp_inverse_majority",
      "family": "three_cell_composite",
      "candidate_direction_kind": "candidate_composite_direction",
      "interpretation_bucket": "promising_discovery_only",
      "complexity": 3,
      "source_count": 3,
      "adr_grid": {
        "adr_sum": 1938.481292,
        "adr_mean": 0.185607,
        "max_drawdown": -258.36132,
        "r_over_drawdown": 7.502986,
        "row_pf": 1.20065
      },
      "weekly_hold": {
        "adr_sum": 634.471586,
        "adr_mean": 0.06075,
        "max_drawdown": -163.935445,
        "r_over_drawdown": 3.870253,
        "row_pf": 1.11725
      },
      "missing_degraded_row_count": 0,
      "negative_adr_grid_years": 1,
      "worst_adr_grid_year": {
        "year": 2019,
        "adr_grid_adr": -72.0768,
        "weekly_hold_adr": 85.33688
      }
    },
    {
      "candidate_id": "cot_strength_regime_best_rrp_inverse",
      "family": "three_cell_composite",
      "candidate_direction_kind": "candidate_composite_direction",
      "interpretation_bucket": "promising_discovery_only",
      "complexity": 3,
      "source_count": 3,
      "adr_grid": {
        "adr_sum": 1938.481292,
        "adr_mean": 0.185607,
        "max_drawdown": -258.36132,
        "r_over_drawdown": 7.502986,
        "row_pf": 1.20065
      },
      "weekly_hold": {
        "adr_sum": 634.471586,
        "adr_mean": 0.06075,
        "max_drawdown": -163.935445,
        "r_over_drawdown": 3.870253,
        "row_pf": 1.11725
      },
      "missing_degraded_row_count": 0,
      "negative_adr_grid_years": 1,
      "worst_adr_grid_year": {
        "year": 2019,
        "adr_grid_adr": -72.0768,
        "weekly_hold_adr": 85.33688
      }
    },
    {
      "candidate_id": "ppp_inverse",
      "family": "single_regime_atom",
      "candidate_direction_kind": "candidate_atom_direction",
      "interpretation_bucket": "promising_discovery_only",
      "complexity": 1,
      "source_count": 1,
      "adr_grid": {
        "adr_sum": 1930.004196,
        "adr_mean": 0.184795,
        "max_drawdown": -551.625886,
        "r_over_drawdown": 3.498756,
        "row_pf": 1.197913
      },
      "weekly_hold": {
        "adr_sum": 333.232146,
        "adr_mean": 0.031907,
        "max_drawdown": -123.966859,
        "r_over_drawdown": 2.688074,
        "row_pf": 1.059914
      },
      "missing_degraded_row_count": 0,
      "negative_adr_grid_years": 2,
      "worst_adr_grid_year": {
        "year": 2019,
        "adr_grid_adr": -210.222358,
        "weekly_hold_adr": -60.952202
      }
    },
    {
      "candidate_id": "cot_strength_rrp_ppp_neer_reer_inverse_majority",
      "family": "cross_atom_composite",
      "candidate_direction_kind": "candidate_composite_direction",
      "interpretation_bucket": "promising_discovery_only",
      "complexity": 6,
      "source_count": 3,
      "adr_grid": {
        "adr_sum": 1914.594104,
        "adr_mean": 0.18332,
        "max_drawdown": -300.48435,
        "r_over_drawdown": 6.371693,
        "row_pf": 1.199381
      },
      "weekly_hold": {
        "adr_sum": 839.4598,
        "adr_mean": 0.080377,
        "max_drawdown": -150.189588,
        "r_over_drawdown": 5.589334,
        "row_pf": 1.158127
      },
      "missing_degraded_row_count": 0,
      "negative_adr_grid_years": 2,
      "worst_adr_grid_year": {
        "year": 2024,
        "adr_grid_adr": -28.586008,
        "weekly_hold_adr": 62.798562
      }
    }
  ],
  "best_by_weekly_hold_r_over_drawdown": [
    {
      "candidate_id": "cot_strength_rrp_ppp_reer_inverse_majority",
      "family": "cross_atom_composite",
      "candidate_direction_kind": "candidate_composite_direction",
      "interpretation_bucket": "promising_discovery_only",
      "complexity": 5,
      "source_count": 3,
      "adr_grid": {
        "adr_sum": 2223.570939,
        "adr_mean": 0.212904,
        "max_drawdown": -338.570977,
        "r_over_drawdown": 6.567518,
        "row_pf": 1.23713
      },
      "weekly_hold": {
        "adr_sum": 829.13383,
        "adr_mean": 0.079389,
        "max_drawdown": -123.117691,
        "r_over_drawdown": 6.734482,
        "row_pf": 1.15603
      },
      "missing_degraded_row_count": 0,
      "negative_adr_grid_years": 1,
      "worst_adr_grid_year": {
        "year": 2019,
        "adr_grid_adr": -24.055963,
        "weekly_hold_adr": 126.040684
      }
    },
    {
      "candidate_id": "cot_strength_ppp_inverse_majority",
      "family": "three_cell_composite",
      "candidate_direction_kind": "candidate_composite_direction",
      "interpretation_bucket": "promising_discovery_only",
      "complexity": 3,
      "source_count": 3,
      "adr_grid": {
        "adr_sum": 1775.335668,
        "adr_mean": 0.169986,
        "max_drawdown": -341.144558,
        "r_over_drawdown": 5.204057,
        "row_pf": 1.178878
      },
      "weekly_hold": {
        "adr_sum": 572.570716,
        "adr_mean": 0.054823,
        "max_drawdown": -100.995161,
        "r_over_drawdown": 5.669289,
        "row_pf": 1.105209
      },
      "missing_degraded_row_count": 0,
      "negative_adr_grid_years": 1,
      "worst_adr_grid_year": {
        "year": 2019,
        "adr_grid_adr": -15.246283,
        "weekly_hold_adr": 70.484572
      }
    },
    {
      "candidate_id": "cot_strength_rrp_ppp_neer_reer_inverse_majority",
      "family": "cross_atom_composite",
      "candidate_direction_kind": "candidate_composite_direction",
      "interpretation_bucket": "promising_discovery_only",
      "complexity": 6,
      "source_count": 3,
      "adr_grid": {
        "adr_sum": 1914.594104,
        "adr_mean": 0.18332,
        "max_drawdown": -300.48435,
        "r_over_drawdown": 6.371693,
        "row_pf": 1.199381
      },
      "weekly_hold": {
        "adr_sum": 839.4598,
        "adr_mean": 0.080377,
        "max_drawdown": -150.189588,
        "r_over_drawdown": 5.589334,
        "row_pf": 1.158127
      },
      "missing_degraded_row_count": 0,
      "negative_adr_grid_years": 2,
      "worst_adr_grid_year": {
        "year": 2024,
        "adr_grid_adr": -28.586008,
        "weekly_hold_adr": 62.798562
      }
    },
    {
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
    {
      "candidate_id": "cot_strength_full_regime_inverse_majority",
      "family": "three_cell_composite",
      "candidate_direction_kind": "candidate_composite_direction",
      "interpretation_bucket": "fragile_or_governance_review",
      "complexity": 9,
      "source_count": 3,
      "adr_grid": {
        "adr_sum": 1696.064942,
        "adr_mean": 0.162396,
        "max_drawdown": -265.665025,
        "r_over_drawdown": 6.384224,
        "row_pf": 1.170992
      },
      "weekly_hold": {
        "adr_sum": 620.233774,
        "adr_mean": 0.059387,
        "max_drawdown": -120.348871,
        "r_over_drawdown": 5.153632,
        "row_pf": 1.114468
      },
      "missing_degraded_row_count": 5331,
      "negative_adr_grid_years": 0,
      "worst_adr_grid_year": {
        "year": 2019,
        "adr_grid_adr": 18.760722,
        "weekly_hold_adr": 141.99851
      }
    },
    {
      "candidate_id": "regime_cell_gate62_best_rrp_derived_inverse",
      "family": "single_cell_baseline",
      "candidate_direction_kind": "candidate_cell_direction",
      "interpretation_bucket": "promising_discovery_only",
      "complexity": 1,
      "source_count": 1,
      "adr_grid": {
        "adr_sum": 2383.621777,
        "adr_mean": 0.228229,
        "max_drawdown": -346.988306,
        "r_over_drawdown": 6.869459,
        "row_pf": 1.259757
      },
      "weekly_hold": {
        "adr_sum": 688.316096,
        "adr_mean": 0.065905,
        "max_drawdown": -134.375348,
        "r_over_drawdown": 5.122339,
        "row_pf": 1.127837
      },
      "missing_degraded_row_count": 0,
      "negative_adr_grid_years": 2,
      "worst_adr_grid_year": {
        "year": 2024,
        "adr_grid_adr": -188.326514,
        "weekly_hold_adr": -68.645484
      }
    },
    {
      "candidate_id": "rrp_derived_inverse",
      "family": "single_regime_atom",
      "candidate_direction_kind": "candidate_atom_direction",
      "interpretation_bucket": "promising_discovery_only",
      "complexity": 1,
      "source_count": 1,
      "adr_grid": {
        "adr_sum": 2383.621777,
        "adr_mean": 0.228229,
        "max_drawdown": -346.988306,
        "r_over_drawdown": 6.869459,
        "row_pf": 1.259757
      },
      "weekly_hold": {
        "adr_sum": 688.316096,
        "adr_mean": 0.065905,
        "max_drawdown": -134.375348,
        "r_over_drawdown": 5.122339,
        "row_pf": 1.127837
      },
      "missing_degraded_row_count": 0,
      "negative_adr_grid_years": 2,
      "worst_adr_grid_year": {
        "year": 2024,
        "adr_grid_adr": -188.326514,
        "weekly_hold_adr": -68.645484
      }
    },
    {
      "candidate_id": "cot_plus_rrp_inverse_tie_rrp",
      "family": "two_cell_composite",
      "candidate_direction_kind": "candidate_composite_direction",
      "interpretation_bucket": "promising_discovery_only",
      "complexity": 2,
      "source_count": 2,
      "adr_grid": {
        "adr_sum": 2383.621777,
        "adr_mean": 0.228229,
        "max_drawdown": -346.988306,
        "r_over_drawdown": 6.869459,
        "row_pf": 1.259757
      },
      "weekly_hold": {
        "adr_sum": 688.316096,
        "adr_mean": 0.065905,
        "max_drawdown": -134.375348,
        "r_over_drawdown": 5.122339,
        "row_pf": 1.127837
      },
      "missing_degraded_row_count": 0,
      "negative_adr_grid_years": 2,
      "worst_adr_grid_year": {
        "year": 2024,
        "adr_grid_adr": -188.326514,
        "weekly_hold_adr": -68.645484
      }
    },
    {
      "candidate_id": "strength_plus_rrp_inverse_tie_rrp",
      "family": "two_cell_composite",
      "candidate_direction_kind": "candidate_composite_direction",
      "interpretation_bucket": "promising_discovery_only",
      "complexity": 2,
      "source_count": 2,
      "adr_grid": {
        "adr_sum": 2383.621777,
        "adr_mean": 0.228229,
        "max_drawdown": -346.988306,
        "r_over_drawdown": 6.869459,
        "row_pf": 1.259757
      },
      "weekly_hold": {
        "adr_sum": 688.316096,
        "adr_mean": 0.065905,
        "max_drawdown": -134.375348,
        "r_over_drawdown": 5.122339,
        "row_pf": 1.127837
      },
      "missing_degraded_row_count": 0,
      "negative_adr_grid_years": 2,
      "worst_adr_grid_year": {
        "year": 2024,
        "adr_grid_adr": -188.326514,
        "weekly_hold_adr": -68.645484
      }
    },
    {
      "candidate_id": "alpha_v1_plus_rrp_inverse_tie_rrp",
      "family": "alpha_regime_composite",
      "candidate_direction_kind": "candidate_composite_direction",
      "interpretation_bucket": "promising_discovery_only",
      "complexity": 2,
      "source_count": 2,
      "adr_grid": {
        "adr_sum": 2383.621777,
        "adr_mean": 0.228229,
        "max_drawdown": -346.988306,
        "r_over_drawdown": 6.869459,
        "row_pf": 1.259757
      },
      "weekly_hold": {
        "adr_sum": 688.316096,
        "adr_mean": 0.065905,
        "max_drawdown": -134.375348,
        "r_over_drawdown": 5.122339,
        "row_pf": 1.127837
      },
      "missing_degraded_row_count": 0,
      "negative_adr_grid_years": 2,
      "worst_adr_grid_year": {
        "year": 2024,
        "adr_grid_adr": -188.326514,
        "weekly_hold_adr": -68.645484
      }
    }
  ],
  "best_balanced_adr_and_weekly_hold": [
    {
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
    {
      "candidate_id": "cot_strength_rrp_ppp_reer_inverse_majority",
      "family": "cross_atom_composite",
      "candidate_direction_kind": "candidate_composite_direction",
      "interpretation_bucket": "promising_discovery_only",
      "complexity": 5,
      "source_count": 3,
      "adr_grid": {
        "adr_sum": 2223.570939,
        "adr_mean": 0.212904,
        "max_drawdown": -338.570977,
        "r_over_drawdown": 6.567518,
        "row_pf": 1.23713
      },
      "weekly_hold": {
        "adr_sum": 829.13383,
        "adr_mean": 0.079389,
        "max_drawdown": -123.117691,
        "r_over_drawdown": 6.734482,
        "row_pf": 1.15603
      },
      "missing_degraded_row_count": 0,
      "negative_adr_grid_years": 1,
      "worst_adr_grid_year": {
        "year": 2019,
        "adr_grid_adr": -24.055963,
        "weekly_hold_adr": 126.040684
      }
    },
    {
      "candidate_id": "regime_cell_gate62_best_rrp_derived_inverse",
      "family": "single_cell_baseline",
      "candidate_direction_kind": "candidate_cell_direction",
      "interpretation_bucket": "promising_discovery_only",
      "complexity": 1,
      "source_count": 1,
      "adr_grid": {
        "adr_sum": 2383.621777,
        "adr_mean": 0.228229,
        "max_drawdown": -346.988306,
        "r_over_drawdown": 6.869459,
        "row_pf": 1.259757
      },
      "weekly_hold": {
        "adr_sum": 688.316096,
        "adr_mean": 0.065905,
        "max_drawdown": -134.375348,
        "r_over_drawdown": 5.122339,
        "row_pf": 1.127837
      },
      "missing_degraded_row_count": 0,
      "negative_adr_grid_years": 2,
      "worst_adr_grid_year": {
        "year": 2024,
        "adr_grid_adr": -188.326514,
        "weekly_hold_adr": -68.645484
      }
    },
    {
      "candidate_id": "rrp_derived_inverse",
      "family": "single_regime_atom",
      "candidate_direction_kind": "candidate_atom_direction",
      "interpretation_bucket": "promising_discovery_only",
      "complexity": 1,
      "source_count": 1,
      "adr_grid": {
        "adr_sum": 2383.621777,
        "adr_mean": 0.228229,
        "max_drawdown": -346.988306,
        "r_over_drawdown": 6.869459,
        "row_pf": 1.259757
      },
      "weekly_hold": {
        "adr_sum": 688.316096,
        "adr_mean": 0.065905,
        "max_drawdown": -134.375348,
        "r_over_drawdown": 5.122339,
        "row_pf": 1.127837
      },
      "missing_degraded_row_count": 0,
      "negative_adr_grid_years": 2,
      "worst_adr_grid_year": {
        "year": 2024,
        "adr_grid_adr": -188.326514,
        "weekly_hold_adr": -68.645484
      }
    },
    {
      "candidate_id": "cot_plus_rrp_inverse_tie_rrp",
      "family": "two_cell_composite",
      "candidate_direction_kind": "candidate_composite_direction",
      "interpretation_bucket": "promising_discovery_only",
      "complexity": 2,
      "source_count": 2,
      "adr_grid": {
        "adr_sum": 2383.621777,
        "adr_mean": 0.228229,
        "max_drawdown": -346.988306,
        "r_over_drawdown": 6.869459,
        "row_pf": 1.259757
      },
      "weekly_hold": {
        "adr_sum": 688.316096,
        "adr_mean": 0.065905,
        "max_drawdown": -134.375348,
        "r_over_drawdown": 5.122339,
        "row_pf": 1.127837
      },
      "missing_degraded_row_count": 0,
      "negative_adr_grid_years": 2,
      "worst_adr_grid_year": {
        "year": 2024,
        "adr_grid_adr": -188.326514,
        "weekly_hold_adr": -68.645484
      }
    },
    {
      "candidate_id": "strength_plus_rrp_inverse_tie_rrp",
      "family": "two_cell_composite",
      "candidate_direction_kind": "candidate_composite_direction",
      "interpretation_bucket": "promising_discovery_only",
      "complexity": 2,
      "source_count": 2,
      "adr_grid": {
        "adr_sum": 2383.621777,
        "adr_mean": 0.228229,
        "max_drawdown": -346.988306,
        "r_over_drawdown": 6.869459,
        "row_pf": 1.259757
      },
      "weekly_hold": {
        "adr_sum": 688.316096,
        "adr_mean": 0.065905,
        "max_drawdown": -134.375348,
        "r_over_drawdown": 5.122339,
        "row_pf": 1.127837
      },
      "missing_degraded_row_count": 0,
      "negative_adr_grid_years": 2,
      "worst_adr_grid_year": {
        "year": 2024,
        "adr_grid_adr": -188.326514,
        "weekly_hold_adr": -68.645484
      }
    },
    {
      "candidate_id": "alpha_v1_plus_rrp_inverse_tie_rrp",
      "family": "alpha_regime_composite",
      "candidate_direction_kind": "candidate_composite_direction",
      "interpretation_bucket": "promising_discovery_only",
      "complexity": 2,
      "source_count": 2,
      "adr_grid": {
        "adr_sum": 2383.621777,
        "adr_mean": 0.228229,
        "max_drawdown": -346.988306,
        "r_over_drawdown": 6.869459,
        "row_pf": 1.259757
      },
      "weekly_hold": {
        "adr_sum": 688.316096,
        "adr_mean": 0.065905,
        "max_drawdown": -134.375348,
        "r_over_drawdown": 5.122339,
        "row_pf": 1.127837
      },
      "missing_degraded_row_count": 0,
      "negative_adr_grid_years": 2,
      "worst_adr_grid_year": {
        "year": 2024,
        "adr_grid_adr": -188.326514,
        "weekly_hold_adr": -68.645484
      }
    },
    {
      "candidate_id": "cot_strength_rrp_ppp_neer_reer_inverse_majority",
      "family": "cross_atom_composite",
      "candidate_direction_kind": "candidate_composite_direction",
      "interpretation_bucket": "promising_discovery_only",
      "complexity": 6,
      "source_count": 3,
      "adr_grid": {
        "adr_sum": 1914.594104,
        "adr_mean": 0.18332,
        "max_drawdown": -300.48435,
        "r_over_drawdown": 6.371693,
        "row_pf": 1.199381
      },
      "weekly_hold": {
        "adr_sum": 839.4598,
        "adr_mean": 0.080377,
        "max_drawdown": -150.189588,
        "r_over_drawdown": 5.589334,
        "row_pf": 1.158127
      },
      "missing_degraded_row_count": 0,
      "negative_adr_grid_years": 2,
      "worst_adr_grid_year": {
        "year": 2024,
        "adr_grid_adr": -28.586008,
        "weekly_hold_adr": 62.798562
      }
    },
    {
      "candidate_id": "cot_strength_full_regime_inverse_majority",
      "family": "three_cell_composite",
      "candidate_direction_kind": "candidate_composite_direction",
      "interpretation_bucket": "fragile_or_governance_review",
      "complexity": 9,
      "source_count": 3,
      "adr_grid": {
        "adr_sum": 1696.064942,
        "adr_mean": 0.162396,
        "max_drawdown": -265.665025,
        "r_over_drawdown": 6.384224,
        "row_pf": 1.170992
      },
      "weekly_hold": {
        "adr_sum": 620.233774,
        "adr_mean": 0.059387,
        "max_drawdown": -120.348871,
        "r_over_drawdown": 5.153632,
        "row_pf": 1.114468
      },
      "missing_degraded_row_count": 5331,
      "negative_adr_grid_years": 0,
      "worst_adr_grid_year": {
        "year": 2019,
        "adr_grid_adr": 18.760722,
        "weekly_hold_adr": 141.99851
      }
    },
    {
      "candidate_id": "cot_strength_rrp_inverse_majority",
      "family": "three_cell_composite",
      "candidate_direction_kind": "candidate_composite_direction",
      "interpretation_bucket": "promising_discovery_only",
      "complexity": 3,
      "source_count": 3,
      "adr_grid": {
        "adr_sum": 1938.481292,
        "adr_mean": 0.185607,
        "max_drawdown": -258.36132,
        "r_over_drawdown": 7.502986,
        "row_pf": 1.20065
      },
      "weekly_hold": {
        "adr_sum": 634.471586,
        "adr_mean": 0.06075,
        "max_drawdown": -163.935445,
        "r_over_drawdown": 3.870253,
        "row_pf": 1.11725
      },
      "missing_degraded_row_count": 0,
      "negative_adr_grid_years": 1,
      "worst_adr_grid_year": {
        "year": 2019,
        "adr_grid_adr": -72.0768,
        "weekly_hold_adr": 85.33688
      }
    }
  ],
  "best_low_degradation": [
    {
      "candidate_id": "cot_strength_rrp_inverse_majority",
      "family": "three_cell_composite",
      "candidate_direction_kind": "candidate_composite_direction",
      "interpretation_bucket": "promising_discovery_only",
      "complexity": 3,
      "source_count": 3,
      "adr_grid": {
        "adr_sum": 1938.481292,
        "adr_mean": 0.185607,
        "max_drawdown": -258.36132,
        "r_over_drawdown": 7.502986,
        "row_pf": 1.20065
      },
      "weekly_hold": {
        "adr_sum": 634.471586,
        "adr_mean": 0.06075,
        "max_drawdown": -163.935445,
        "r_over_drawdown": 3.870253,
        "row_pf": 1.11725
      },
      "missing_degraded_row_count": 0,
      "negative_adr_grid_years": 1,
      "worst_adr_grid_year": {
        "year": 2019,
        "adr_grid_adr": -72.0768,
        "weekly_hold_adr": 85.33688
      }
    },
    {
      "candidate_id": "cot_strength_regime_best_rrp_inverse",
      "family": "three_cell_composite",
      "candidate_direction_kind": "candidate_composite_direction",
      "interpretation_bucket": "promising_discovery_only",
      "complexity": 3,
      "source_count": 3,
      "adr_grid": {
        "adr_sum": 1938.481292,
        "adr_mean": 0.185607,
        "max_drawdown": -258.36132,
        "r_over_drawdown": 7.502986,
        "row_pf": 1.20065
      },
      "weekly_hold": {
        "adr_sum": 634.471586,
        "adr_mean": 0.06075,
        "max_drawdown": -163.935445,
        "r_over_drawdown": 3.870253,
        "row_pf": 1.11725
      },
      "missing_degraded_row_count": 0,
      "negative_adr_grid_years": 1,
      "worst_adr_grid_year": {
        "year": 2019,
        "adr_grid_adr": -72.0768,
        "weekly_hold_adr": 85.33688
      }
    },
    {
      "candidate_id": "regime_cell_gate62_best_rrp_derived_inverse",
      "family": "single_cell_baseline",
      "candidate_direction_kind": "candidate_cell_direction",
      "interpretation_bucket": "promising_discovery_only",
      "complexity": 1,
      "source_count": 1,
      "adr_grid": {
        "adr_sum": 2383.621777,
        "adr_mean": 0.228229,
        "max_drawdown": -346.988306,
        "r_over_drawdown": 6.869459,
        "row_pf": 1.259757
      },
      "weekly_hold": {
        "adr_sum": 688.316096,
        "adr_mean": 0.065905,
        "max_drawdown": -134.375348,
        "r_over_drawdown": 5.122339,
        "row_pf": 1.127837
      },
      "missing_degraded_row_count": 0,
      "negative_adr_grid_years": 2,
      "worst_adr_grid_year": {
        "year": 2024,
        "adr_grid_adr": -188.326514,
        "weekly_hold_adr": -68.645484
      }
    },
    {
      "candidate_id": "rrp_derived_inverse",
      "family": "single_regime_atom",
      "candidate_direction_kind": "candidate_atom_direction",
      "interpretation_bucket": "promising_discovery_only",
      "complexity": 1,
      "source_count": 1,
      "adr_grid": {
        "adr_sum": 2383.621777,
        "adr_mean": 0.228229,
        "max_drawdown": -346.988306,
        "r_over_drawdown": 6.869459,
        "row_pf": 1.259757
      },
      "weekly_hold": {
        "adr_sum": 688.316096,
        "adr_mean": 0.065905,
        "max_drawdown": -134.375348,
        "r_over_drawdown": 5.122339,
        "row_pf": 1.127837
      },
      "missing_degraded_row_count": 0,
      "negative_adr_grid_years": 2,
      "worst_adr_grid_year": {
        "year": 2024,
        "adr_grid_adr": -188.326514,
        "weekly_hold_adr": -68.645484
      }
    },
    {
      "candidate_id": "cot_plus_rrp_inverse_tie_rrp",
      "family": "two_cell_composite",
      "candidate_direction_kind": "candidate_composite_direction",
      "interpretation_bucket": "promising_discovery_only",
      "complexity": 2,
      "source_count": 2,
      "adr_grid": {
        "adr_sum": 2383.621777,
        "adr_mean": 0.228229,
        "max_drawdown": -346.988306,
        "r_over_drawdown": 6.869459,
        "row_pf": 1.259757
      },
      "weekly_hold": {
        "adr_sum": 688.316096,
        "adr_mean": 0.065905,
        "max_drawdown": -134.375348,
        "r_over_drawdown": 5.122339,
        "row_pf": 1.127837
      },
      "missing_degraded_row_count": 0,
      "negative_adr_grid_years": 2,
      "worst_adr_grid_year": {
        "year": 2024,
        "adr_grid_adr": -188.326514,
        "weekly_hold_adr": -68.645484
      }
    },
    {
      "candidate_id": "strength_plus_rrp_inverse_tie_rrp",
      "family": "two_cell_composite",
      "candidate_direction_kind": "candidate_composite_direction",
      "interpretation_bucket": "promising_discovery_only",
      "complexity": 2,
      "source_count": 2,
      "adr_grid": {
        "adr_sum": 2383.621777,
        "adr_mean": 0.228229,
        "max_drawdown": -346.988306,
        "r_over_drawdown": 6.869459,
        "row_pf": 1.259757
      },
      "weekly_hold": {
        "adr_sum": 688.316096,
        "adr_mean": 0.065905,
        "max_drawdown": -134.375348,
        "r_over_drawdown": 5.122339,
        "row_pf": 1.127837
      },
      "missing_degraded_row_count": 0,
      "negative_adr_grid_years": 2,
      "worst_adr_grid_year": {
        "year": 2024,
        "adr_grid_adr": -188.326514,
        "weekly_hold_adr": -68.645484
      }
    },
    {
      "candidate_id": "alpha_v1_plus_rrp_inverse_tie_rrp",
      "family": "alpha_regime_composite",
      "candidate_direction_kind": "candidate_composite_direction",
      "interpretation_bucket": "promising_discovery_only",
      "complexity": 2,
      "source_count": 2,
      "adr_grid": {
        "adr_sum": 2383.621777,
        "adr_mean": 0.228229,
        "max_drawdown": -346.988306,
        "r_over_drawdown": 6.869459,
        "row_pf": 1.259757
      },
      "weekly_hold": {
        "adr_sum": 688.316096,
        "adr_mean": 0.065905,
        "max_drawdown": -134.375348,
        "r_over_drawdown": 5.122339,
        "row_pf": 1.127837
      },
      "missing_degraded_row_count": 0,
      "negative_adr_grid_years": 2,
      "worst_adr_grid_year": {
        "year": 2024,
        "adr_grid_adr": -188.326514,
        "weekly_hold_adr": -68.645484
      }
    },
    {
      "candidate_id": "cot_strength_rrp_ppp_reer_inverse_majority",
      "family": "cross_atom_composite",
      "candidate_direction_kind": "candidate_composite_direction",
      "interpretation_bucket": "promising_discovery_only",
      "complexity": 5,
      "source_count": 3,
      "adr_grid": {
        "adr_sum": 2223.570939,
        "adr_mean": 0.212904,
        "max_drawdown": -338.570977,
        "r_over_drawdown": 6.567518,
        "row_pf": 1.23713
      },
      "weekly_hold": {
        "adr_sum": 829.13383,
        "adr_mean": 0.079389,
        "max_drawdown": -123.117691,
        "r_over_drawdown": 6.734482,
        "row_pf": 1.15603
      },
      "missing_degraded_row_count": 0,
      "negative_adr_grid_years": 1,
      "worst_adr_grid_year": {
        "year": 2019,
        "adr_grid_adr": -24.055963,
        "weekly_hold_adr": 126.040684
      }
    },
    {
      "candidate_id": "cot_strength_rrp_ppp_neer_reer_inverse_majority",
      "family": "cross_atom_composite",
      "candidate_direction_kind": "candidate_composite_direction",
      "interpretation_bucket": "promising_discovery_only",
      "complexity": 6,
      "source_count": 3,
      "adr_grid": {
        "adr_sum": 1914.594104,
        "adr_mean": 0.18332,
        "max_drawdown": -300.48435,
        "r_over_drawdown": 6.371693,
        "row_pf": 1.199381
      },
      "weekly_hold": {
        "adr_sum": 839.4598,
        "adr_mean": 0.080377,
        "max_drawdown": -150.189588,
        "r_over_drawdown": 5.589334,
        "row_pf": 1.158127
      },
      "missing_degraded_row_count": 0,
      "negative_adr_grid_years": 2,
      "worst_adr_grid_year": {
        "year": 2024,
        "adr_grid_adr": -28.586008,
        "weekly_hold_adr": 62.798562
      }
    },
    {
      "candidate_id": "cot_strength_reer_inverse_majority",
      "family": "three_cell_composite",
      "candidate_direction_kind": "candidate_composite_direction",
      "interpretation_bucket": "promising_discovery_only",
      "complexity": 3,
      "source_count": 3,
      "adr_grid": {
        "adr_sum": 1692.671866,
        "adr_mean": 0.162071,
        "max_drawdown": -277.198413,
        "r_over_drawdown": 6.106355,
        "row_pf": 1.17065
      },
      "weekly_hold": {
        "adr_sum": 557.170064,
        "adr_mean": 0.053348,
        "max_drawdown": -152.707155,
        "r_over_drawdown": 3.648618,
        "row_pf": 1.102235
      },
      "missing_degraded_row_count": 0,
      "negative_adr_grid_years": 0,
      "worst_adr_grid_year": {
        "year": 2019,
        "adr_grid_adr": 30.942457,
        "weekly_hold_adr": 175.426214
      }
    }
  ],
  "best_simple": [
    {
      "candidate_id": "cot_strength_rrp_inverse_majority",
      "family": "three_cell_composite",
      "candidate_direction_kind": "candidate_composite_direction",
      "interpretation_bucket": "promising_discovery_only",
      "complexity": 3,
      "source_count": 3,
      "adr_grid": {
        "adr_sum": 1938.481292,
        "adr_mean": 0.185607,
        "max_drawdown": -258.36132,
        "r_over_drawdown": 7.502986,
        "row_pf": 1.20065
      },
      "weekly_hold": {
        "adr_sum": 634.471586,
        "adr_mean": 0.06075,
        "max_drawdown": -163.935445,
        "r_over_drawdown": 3.870253,
        "row_pf": 1.11725
      },
      "missing_degraded_row_count": 0,
      "negative_adr_grid_years": 1,
      "worst_adr_grid_year": {
        "year": 2019,
        "adr_grid_adr": -72.0768,
        "weekly_hold_adr": 85.33688
      }
    },
    {
      "candidate_id": "cot_strength_regime_best_rrp_inverse",
      "family": "three_cell_composite",
      "candidate_direction_kind": "candidate_composite_direction",
      "interpretation_bucket": "promising_discovery_only",
      "complexity": 3,
      "source_count": 3,
      "adr_grid": {
        "adr_sum": 1938.481292,
        "adr_mean": 0.185607,
        "max_drawdown": -258.36132,
        "r_over_drawdown": 7.502986,
        "row_pf": 1.20065
      },
      "weekly_hold": {
        "adr_sum": 634.471586,
        "adr_mean": 0.06075,
        "max_drawdown": -163.935445,
        "r_over_drawdown": 3.870253,
        "row_pf": 1.11725
      },
      "missing_degraded_row_count": 0,
      "negative_adr_grid_years": 1,
      "worst_adr_grid_year": {
        "year": 2019,
        "adr_grid_adr": -72.0768,
        "weekly_hold_adr": 85.33688
      }
    },
    {
      "candidate_id": "regime_cell_gate62_best_rrp_derived_inverse",
      "family": "single_cell_baseline",
      "candidate_direction_kind": "candidate_cell_direction",
      "interpretation_bucket": "promising_discovery_only",
      "complexity": 1,
      "source_count": 1,
      "adr_grid": {
        "adr_sum": 2383.621777,
        "adr_mean": 0.228229,
        "max_drawdown": -346.988306,
        "r_over_drawdown": 6.869459,
        "row_pf": 1.259757
      },
      "weekly_hold": {
        "adr_sum": 688.316096,
        "adr_mean": 0.065905,
        "max_drawdown": -134.375348,
        "r_over_drawdown": 5.122339,
        "row_pf": 1.127837
      },
      "missing_degraded_row_count": 0,
      "negative_adr_grid_years": 2,
      "worst_adr_grid_year": {
        "year": 2024,
        "adr_grid_adr": -188.326514,
        "weekly_hold_adr": -68.645484
      }
    },
    {
      "candidate_id": "rrp_derived_inverse",
      "family": "single_regime_atom",
      "candidate_direction_kind": "candidate_atom_direction",
      "interpretation_bucket": "promising_discovery_only",
      "complexity": 1,
      "source_count": 1,
      "adr_grid": {
        "adr_sum": 2383.621777,
        "adr_mean": 0.228229,
        "max_drawdown": -346.988306,
        "r_over_drawdown": 6.869459,
        "row_pf": 1.259757
      },
      "weekly_hold": {
        "adr_sum": 688.316096,
        "adr_mean": 0.065905,
        "max_drawdown": -134.375348,
        "r_over_drawdown": 5.122339,
        "row_pf": 1.127837
      },
      "missing_degraded_row_count": 0,
      "negative_adr_grid_years": 2,
      "worst_adr_grid_year": {
        "year": 2024,
        "adr_grid_adr": -188.326514,
        "weekly_hold_adr": -68.645484
      }
    },
    {
      "candidate_id": "cot_plus_rrp_inverse_tie_rrp",
      "family": "two_cell_composite",
      "candidate_direction_kind": "candidate_composite_direction",
      "interpretation_bucket": "promising_discovery_only",
      "complexity": 2,
      "source_count": 2,
      "adr_grid": {
        "adr_sum": 2383.621777,
        "adr_mean": 0.228229,
        "max_drawdown": -346.988306,
        "r_over_drawdown": 6.869459,
        "row_pf": 1.259757
      },
      "weekly_hold": {
        "adr_sum": 688.316096,
        "adr_mean": 0.065905,
        "max_drawdown": -134.375348,
        "r_over_drawdown": 5.122339,
        "row_pf": 1.127837
      },
      "missing_degraded_row_count": 0,
      "negative_adr_grid_years": 2,
      "worst_adr_grid_year": {
        "year": 2024,
        "adr_grid_adr": -188.326514,
        "weekly_hold_adr": -68.645484
      }
    },
    {
      "candidate_id": "strength_plus_rrp_inverse_tie_rrp",
      "family": "two_cell_composite",
      "candidate_direction_kind": "candidate_composite_direction",
      "interpretation_bucket": "promising_discovery_only",
      "complexity": 2,
      "source_count": 2,
      "adr_grid": {
        "adr_sum": 2383.621777,
        "adr_mean": 0.228229,
        "max_drawdown": -346.988306,
        "r_over_drawdown": 6.869459,
        "row_pf": 1.259757
      },
      "weekly_hold": {
        "adr_sum": 688.316096,
        "adr_mean": 0.065905,
        "max_drawdown": -134.375348,
        "r_over_drawdown": 5.122339,
        "row_pf": 1.127837
      },
      "missing_degraded_row_count": 0,
      "negative_adr_grid_years": 2,
      "worst_adr_grid_year": {
        "year": 2024,
        "adr_grid_adr": -188.326514,
        "weekly_hold_adr": -68.645484
      }
    },
    {
      "candidate_id": "alpha_v1_plus_rrp_inverse_tie_rrp",
      "family": "alpha_regime_composite",
      "candidate_direction_kind": "candidate_composite_direction",
      "interpretation_bucket": "promising_discovery_only",
      "complexity": 2,
      "source_count": 2,
      "adr_grid": {
        "adr_sum": 2383.621777,
        "adr_mean": 0.228229,
        "max_drawdown": -346.988306,
        "r_over_drawdown": 6.869459,
        "row_pf": 1.259757
      },
      "weekly_hold": {
        "adr_sum": 688.316096,
        "adr_mean": 0.065905,
        "max_drawdown": -134.375348,
        "r_over_drawdown": 5.122339,
        "row_pf": 1.127837
      },
      "missing_degraded_row_count": 0,
      "negative_adr_grid_years": 2,
      "worst_adr_grid_year": {
        "year": 2024,
        "adr_grid_adr": -188.326514,
        "weekly_hold_adr": -68.645484
      }
    },
    {
      "candidate_id": "cot_strength_reer_inverse_majority",
      "family": "three_cell_composite",
      "candidate_direction_kind": "candidate_composite_direction",
      "interpretation_bucket": "promising_discovery_only",
      "complexity": 3,
      "source_count": 3,
      "adr_grid": {
        "adr_sum": 1692.671866,
        "adr_mean": 0.162071,
        "max_drawdown": -277.198413,
        "r_over_drawdown": 6.106355,
        "row_pf": 1.17065
      },
      "weekly_hold": {
        "adr_sum": 557.170064,
        "adr_mean": 0.053348,
        "max_drawdown": -152.707155,
        "r_over_drawdown": 3.648618,
        "row_pf": 1.102235
      },
      "missing_degraded_row_count": 0,
      "negative_adr_grid_years": 0,
      "worst_adr_grid_year": {
        "year": 2019,
        "adr_grid_adr": 30.942457,
        "weekly_hold_adr": 175.426214
      }
    },
    {
      "candidate_id": "alpha_v1_frozen_final_side",
      "family": "single_cell_baseline",
      "candidate_direction_kind": "candidate_cell_direction",
      "interpretation_bucket": "promising_discovery_only",
      "complexity": 2,
      "source_count": 3,
      "adr_grid": {
        "adr_sum": 1648.250785,
        "adr_mean": 0.157818,
        "max_drawdown": -312.072214,
        "r_over_drawdown": 5.281633,
        "row_pf": 1.164255
      },
      "weekly_hold": {
        "adr_sum": 534.366308,
        "adr_mean": 0.051165,
        "max_drawdown": -122.661557,
        "r_over_drawdown": 4.356429,
        "row_pf": 1.097846
      },
      "missing_degraded_row_count": 0,
      "negative_adr_grid_years": 1,
      "worst_adr_grid_year": {
        "year": 2019,
        "adr_grid_adr": -32.536985,
        "weekly_hold_adr": 135.43476
      }
    },
    {
      "candidate_id": "alpha_v1_plus_rrp_inverse_tie_alpha",
      "family": "alpha_regime_composite",
      "candidate_direction_kind": "candidate_composite_direction",
      "interpretation_bucket": "promising_discovery_only",
      "complexity": 2,
      "source_count": 2,
      "adr_grid": {
        "adr_sum": 1648.250785,
        "adr_mean": 0.157818,
        "max_drawdown": -312.072214,
        "r_over_drawdown": 5.281633,
        "row_pf": 1.164255
      },
      "weekly_hold": {
        "adr_sum": 534.366308,
        "adr_mean": 0.051165,
        "max_drawdown": -122.661557,
        "r_over_drawdown": 4.356429,
        "row_pf": 1.097846
      },
      "missing_degraded_row_count": 0,
      "negative_adr_grid_years": 1,
      "worst_adr_grid_year": {
        "year": 2019,
        "adr_grid_adr": -32.536985,
        "weekly_hold_adr": 135.43476
      }
    }
  ],
  "best_cross_cell_composite": [
    {
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
    {
      "candidate_id": "cot_strength_rrp_inverse_majority",
      "family": "three_cell_composite",
      "candidate_direction_kind": "candidate_composite_direction",
      "interpretation_bucket": "promising_discovery_only",
      "complexity": 3,
      "source_count": 3,
      "adr_grid": {
        "adr_sum": 1938.481292,
        "adr_mean": 0.185607,
        "max_drawdown": -258.36132,
        "r_over_drawdown": 7.502986,
        "row_pf": 1.20065
      },
      "weekly_hold": {
        "adr_sum": 634.471586,
        "adr_mean": 0.06075,
        "max_drawdown": -163.935445,
        "r_over_drawdown": 3.870253,
        "row_pf": 1.11725
      },
      "missing_degraded_row_count": 0,
      "negative_adr_grid_years": 1,
      "worst_adr_grid_year": {
        "year": 2019,
        "adr_grid_adr": -72.0768,
        "weekly_hold_adr": 85.33688
      }
    },
    {
      "candidate_id": "cot_strength_regime_best_rrp_inverse",
      "family": "three_cell_composite",
      "candidate_direction_kind": "candidate_composite_direction",
      "interpretation_bucket": "promising_discovery_only",
      "complexity": 3,
      "source_count": 3,
      "adr_grid": {
        "adr_sum": 1938.481292,
        "adr_mean": 0.185607,
        "max_drawdown": -258.36132,
        "r_over_drawdown": 7.502986,
        "row_pf": 1.20065
      },
      "weekly_hold": {
        "adr_sum": 634.471586,
        "adr_mean": 0.06075,
        "max_drawdown": -163.935445,
        "r_over_drawdown": 3.870253,
        "row_pf": 1.11725
      },
      "missing_degraded_row_count": 0,
      "negative_adr_grid_years": 1,
      "worst_adr_grid_year": {
        "year": 2019,
        "adr_grid_adr": -72.0768,
        "weekly_hold_adr": 85.33688
      }
    },
    {
      "candidate_id": "cot_plus_rrp_inverse_tie_rrp",
      "family": "two_cell_composite",
      "candidate_direction_kind": "candidate_composite_direction",
      "interpretation_bucket": "promising_discovery_only",
      "complexity": 2,
      "source_count": 2,
      "adr_grid": {
        "adr_sum": 2383.621777,
        "adr_mean": 0.228229,
        "max_drawdown": -346.988306,
        "r_over_drawdown": 6.869459,
        "row_pf": 1.259757
      },
      "weekly_hold": {
        "adr_sum": 688.316096,
        "adr_mean": 0.065905,
        "max_drawdown": -134.375348,
        "r_over_drawdown": 5.122339,
        "row_pf": 1.127837
      },
      "missing_degraded_row_count": 0,
      "negative_adr_grid_years": 2,
      "worst_adr_grid_year": {
        "year": 2024,
        "adr_grid_adr": -188.326514,
        "weekly_hold_adr": -68.645484
      }
    },
    {
      "candidate_id": "strength_plus_rrp_inverse_tie_rrp",
      "family": "two_cell_composite",
      "candidate_direction_kind": "candidate_composite_direction",
      "interpretation_bucket": "promising_discovery_only",
      "complexity": 2,
      "source_count": 2,
      "adr_grid": {
        "adr_sum": 2383.621777,
        "adr_mean": 0.228229,
        "max_drawdown": -346.988306,
        "r_over_drawdown": 6.869459,
        "row_pf": 1.259757
      },
      "weekly_hold": {
        "adr_sum": 688.316096,
        "adr_mean": 0.065905,
        "max_drawdown": -134.375348,
        "r_over_drawdown": 5.122339,
        "row_pf": 1.127837
      },
      "missing_degraded_row_count": 0,
      "negative_adr_grid_years": 2,
      "worst_adr_grid_year": {
        "year": 2024,
        "adr_grid_adr": -188.326514,
        "weekly_hold_adr": -68.645484
      }
    },
    {
      "candidate_id": "alpha_v1_plus_rrp_inverse_tie_rrp",
      "family": "alpha_regime_composite",
      "candidate_direction_kind": "candidate_composite_direction",
      "interpretation_bucket": "promising_discovery_only",
      "complexity": 2,
      "source_count": 2,
      "adr_grid": {
        "adr_sum": 2383.621777,
        "adr_mean": 0.228229,
        "max_drawdown": -346.988306,
        "r_over_drawdown": 6.869459,
        "row_pf": 1.259757
      },
      "weekly_hold": {
        "adr_sum": 688.316096,
        "adr_mean": 0.065905,
        "max_drawdown": -134.375348,
        "r_over_drawdown": 5.122339,
        "row_pf": 1.127837
      },
      "missing_degraded_row_count": 0,
      "negative_adr_grid_years": 2,
      "worst_adr_grid_year": {
        "year": 2024,
        "adr_grid_adr": -188.326514,
        "weekly_hold_adr": -68.645484
      }
    },
    {
      "candidate_id": "cot_strength_rrp_ppp_reer_inverse_majority",
      "family": "cross_atom_composite",
      "candidate_direction_kind": "candidate_composite_direction",
      "interpretation_bucket": "promising_discovery_only",
      "complexity": 5,
      "source_count": 3,
      "adr_grid": {
        "adr_sum": 2223.570939,
        "adr_mean": 0.212904,
        "max_drawdown": -338.570977,
        "r_over_drawdown": 6.567518,
        "row_pf": 1.23713
      },
      "weekly_hold": {
        "adr_sum": 829.13383,
        "adr_mean": 0.079389,
        "max_drawdown": -123.117691,
        "r_over_drawdown": 6.734482,
        "row_pf": 1.15603
      },
      "missing_degraded_row_count": 0,
      "negative_adr_grid_years": 1,
      "worst_adr_grid_year": {
        "year": 2019,
        "adr_grid_adr": -24.055963,
        "weekly_hold_adr": 126.040684
      }
    },
    {
      "candidate_id": "cot_strength_full_regime_inverse_majority",
      "family": "three_cell_composite",
      "candidate_direction_kind": "candidate_composite_direction",
      "interpretation_bucket": "fragile_or_governance_review",
      "complexity": 9,
      "source_count": 3,
      "adr_grid": {
        "adr_sum": 1696.064942,
        "adr_mean": 0.162396,
        "max_drawdown": -265.665025,
        "r_over_drawdown": 6.384224,
        "row_pf": 1.170992
      },
      "weekly_hold": {
        "adr_sum": 620.233774,
        "adr_mean": 0.059387,
        "max_drawdown": -120.348871,
        "r_over_drawdown": 5.153632,
        "row_pf": 1.114468
      },
      "missing_degraded_row_count": 5331,
      "negative_adr_grid_years": 0,
      "worst_adr_grid_year": {
        "year": 2019,
        "adr_grid_adr": 18.760722,
        "weekly_hold_adr": 141.99851
      }
    },
    {
      "candidate_id": "cot_strength_rrp_ppp_neer_reer_inverse_majority",
      "family": "cross_atom_composite",
      "candidate_direction_kind": "candidate_composite_direction",
      "interpretation_bucket": "promising_discovery_only",
      "complexity": 6,
      "source_count": 3,
      "adr_grid": {
        "adr_sum": 1914.594104,
        "adr_mean": 0.18332,
        "max_drawdown": -300.48435,
        "r_over_drawdown": 6.371693,
        "row_pf": 1.199381
      },
      "weekly_hold": {
        "adr_sum": 839.4598,
        "adr_mean": 0.080377,
        "max_drawdown": -150.189588,
        "r_over_drawdown": 5.589334,
        "row_pf": 1.158127
      },
      "missing_degraded_row_count": 0,
      "negative_adr_grid_years": 2,
      "worst_adr_grid_year": {
        "year": 2024,
        "adr_grid_adr": -28.586008,
        "weekly_hold_adr": 62.798562
      }
    },
    {
      "candidate_id": "cot_strength_reer_inverse_majority",
      "family": "three_cell_composite",
      "candidate_direction_kind": "candidate_composite_direction",
      "interpretation_bucket": "promising_discovery_only",
      "complexity": 3,
      "source_count": 3,
      "adr_grid": {
        "adr_sum": 1692.671866,
        "adr_mean": 0.162071,
        "max_drawdown": -277.198413,
        "r_over_drawdown": 6.106355,
        "row_pf": 1.17065
      },
      "weekly_hold": {
        "adr_sum": 557.170064,
        "adr_mean": 0.053348,
        "max_drawdown": -152.707155,
        "r_over_drawdown": 3.648618,
        "row_pf": 1.102235
      },
      "missing_degraded_row_count": 0,
      "negative_adr_grid_years": 0,
      "worst_adr_grid_year": {
        "year": 2019,
        "adr_grid_adr": 30.942457,
        "weekly_hold_adr": 175.426214
      }
    }
  ]
}
```

## Architecture Debt Map

- Debt map: `docs/research/gates/gate63/artifacts/gate63-universal-atom-matrix/gate63-brain-architecture-debt-map.md`
- Recommended future refactor gate, only if opened later: `Gate 64A: Brain source consolidation after universal atom matrix`.

## Artifacts

- Candidate contracts: `docs/research/gates/gate63/artifacts/gate63-universal-atom-matrix/gate63-universal-atom-candidate-contracts.json`
- Matrix rows: `docs/research/gates/gate63/artifacts/gate63-universal-atom-matrix/gate63-universal-atom-matrix.rows.jsonl`
- Summary JSON: `docs/research/gates/gate63/artifacts/gate63-universal-atom-matrix/gate63-universal-atom-matrix.summary.json`
- Best candidates: `docs/research/gates/gate63/artifacts/gate63-universal-atom-matrix/gate63-universal-atom-best-candidates.md`
- Year diagnostics: `docs/research/gates/gate63/artifacts/gate63-universal-atom-matrix/gate63-universal-atom-year-by-year-diagnostics.json`
- Quality diagnostics: `docs/research/gates/gate63/artifacts/gate63-universal-atom-matrix/gate63-universal-atom-quality-diagnostics.json`
- RRP inverse diagnostics: `docs/research/gates/gate63/artifacts/gate63-universal-atom-matrix/gate63-rrp-inverse-tier-diagnostics.json`
- Cross-cell diagnostics: `docs/research/gates/gate63/artifacts/gate63-universal-atom-matrix/gate63-cross-cell-agreement-diagnostics.json`
- Query/rebuild receipt: `docs/research/gates/gate63/artifacts/gate63-universal-atom-matrix/gate63-universal-atom-matrix.query-receipt.md`
- SHA identity: `docs/research/gates/gate63/artifacts/gate63-universal-atom-matrix/gate63-universal-atom-matrix.sha256.txt`

## Stop Line

Stop after Gate 63. Do not proceed to Body design, Alpha v2, risk, exits, execution, MT5/live, app/runtime, source mutation, COT retuning, Strength retuning, or broad Brain source refactor.
