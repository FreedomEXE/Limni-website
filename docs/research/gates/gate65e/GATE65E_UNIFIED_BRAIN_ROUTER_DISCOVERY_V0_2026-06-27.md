# Gate 65E Unified Brain Router Discovery v0

Generated: `2026-06-28T00:52:03.533Z`

## Verdict

`PASS_UNIFIED_BRAIN_ROUTER_DISCOVERY_V0__FORCED28_PRESERVED__DISCOVERY_ONLY_NO_BODY`

## Scope

- Discovery-only unified Brain router matrix.
- Forced-28 rows preserved; no pair/date exclusions.
- Router families are fixed and predeclared.
- No final Body lock, Alpha v2 promotion, risk, learned weights, or threshold optimization.

## Best Router Candidates By ADR Grid R/DD

| candidate_id | adr | dd | rdd | pf | wh | wh_pf | neg_years | signature_match |
|---|---|---|---|---|---|---|---|---|
| macro_anchor_crowding_warning_rrp_cot_extreme | 2341.080708 | -241.508971 | 9.693556 | 1.25407 | 638.603176 | 1.118059 | 1 | new_signature_vs_gate64c |
| valuation_relative_extreme_macro_anchor_else_rrp | 2422.437808 | -271.139895 | 8.934273 | 1.264195 | 620.140634 | 1.11445 | 3 | valuation_gap_relative_inverse_extreme_else_rrp_inverse |
| cot_crowding_router_cot_high_conf_else_rrp | 2200.545652 | -282.822603 | 7.780657 | 1.23606 | 607.30175 | 1.111948 | 1 | new_signature_vs_gate64c |
| scenario_memory_confirmation_router_cell_agreement_support112 | 2640.245739 | -347.238105 | 7.60356 | 1.294048 | 746.687556 | 1.139433 | 1 | new_signature_vs_gate64c |
| bpr_quality_aware_router_bpr_promotion_else_rrp | 2038.170689 | -292.768688 | 6.96171 | 1.214924 | 601.845564 | 1.110887 | 2 | new_signature_vs_gate64c |
| pf_reporting_router_rrp_inverse_continuity | 2383.621777 | -346.988306 | 6.869459 | 1.259757 | 688.316096 | 1.127837 | 2 | rrp_inverse_when_disagrees_valuation_reer_else_valuation |
| macro_anchor_unanimous_cells_else_rrp | 2383.621777 | -346.988306 | 6.869459 | 1.259757 | 688.316096 | 1.127837 | 2 | rrp_inverse_when_disagrees_valuation_reer_else_valuation |
| valuation_confirmation_router_rrp_reer_else_alpha | 2168.117445 | -355.359825 | 6.101189 | 1.231009 | 831.585556 | 1.156528 | 0 | rrp_inverse_when_agrees_valuation_reer_else_alpha |
| conservative_router_rrp_valuation_confirmed_else_alpha | 2168.117445 | -355.359825 | 6.101189 | 1.231009 | 831.585556 | 1.156528 | 0 | rrp_inverse_when_agrees_valuation_reer_else_alpha |
| macro_anchor_timing_confirm_rrp_valuation_relative | 1940.856497 | -352.255862 | 5.509792 | 1.202333 | 632.205622 | 1.116807 | 2 | cot_strength_rrp_valuation_relative_majority |
| strength_timing_router_strength_direct_else_rrp | 1733.430253 | -392.789958 | 4.413123 | 1.176586 | 505.62238 | 1.092339 | 2 | new_signature_vs_gate64c |

## Findings

```json
{
  "best_by_adr_grid_rdd": {
    "candidate_id": "macro_anchor_crowding_warning_rrp_cot_extreme",
    "family": "macro_anchor_crowding_warning",
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
  "best_by_adr_grid_pf": {
    "candidate_id": "scenario_memory_confirmation_router_cell_agreement_support112",
    "family": "scenario_memory_confirmation_router",
    "adr_grid": {
      "adr_sum": 2640.245739,
      "adr_mean": 0.2528,
      "max_drawdown": -347.238105,
      "r_over_drawdown": 7.60356,
      "row_pf": 1.294048
    },
    "weekly_hold": {
      "adr_sum": 746.687556,
      "adr_mean": 0.071494,
      "max_drawdown": -87.207752,
      "r_over_drawdown": 8.56217,
      "row_pf": 1.139433
    },
    "degraded_row_count": 4880,
    "negative_adr_grid_years": 1,
    "worst_adr_grid_year": {
      "year": 2024,
      "adr_grid_adr": -124.118254,
      "weekly_hold_adr": -33.633932
    },
    "decision_signature_sha256": "6BD55969AD6A7486BA2C0C1AB65CAA69F9A9EAF8E27674BFBA31D7215793F9C3"
  },
  "best_zero_negative_year_candidate": {
    "candidate_id": "valuation_confirmation_router_rrp_reer_else_alpha",
    "family": "valuation_confirmation_router",
    "adr_grid": {
      "adr_sum": 2168.117445,
      "adr_mean": 0.207595,
      "max_drawdown": -355.359825,
      "r_over_drawdown": 6.101189,
      "row_pf": 1.231009
    },
    "weekly_hold": {
      "adr_sum": 831.585556,
      "adr_mean": 0.079623,
      "max_drawdown": -123.907358,
      "r_over_drawdown": 6.711349,
      "row_pf": 1.156528
    },
    "degraded_row_count": 0,
    "negative_adr_grid_years": 0,
    "worst_adr_grid_year": {
      "year": 2024,
      "adr_grid_adr": 0.570542,
      "weekly_hold_adr": 60.1463
    },
    "decision_signature_sha256": "069CBE907A8354B306FDA2DBCD6C1AA31F2E80007AAD6D9A1B39400D119D5B8D"
  },
  "router_signatures_matching_gate64c": 4,
  "genuinely_new_router_signatures": 5,
  "pf_improved_but_robustness_caveat": true,
  "no_final_promotion": true
}
```

## Artifacts

- Candidate contracts: `docs/research/gates/gate65e/artifacts/gate65e-unified-brain-router-discovery-v0/brain-router-candidate-contracts.json`
- Router matrix rows: `docs/research/gates/gate65e/artifacts/gate65e-unified-brain-router-discovery-v0/brain-router-matrix.rows.jsonl`
- Router summary: `docs/research/gates/gate65e/artifacts/gate65e-unified-brain-router-discovery-v0/brain-router-summary.json`
- Best candidates: `docs/research/gates/gate65e/artifacts/gate65e-unified-brain-router-discovery-v0/brain-router-best-candidates.md`
- PF rankings: `docs/research/gates/gate65e/artifacts/gate65e-unified-brain-router-discovery-v0/brain-router-pf-rankings.json`
- Year diagnostics: `docs/research/gates/gate65e/artifacts/gate65e-unified-brain-router-discovery-v0/brain-router-year-by-year-diagnostics.json`
- Policy participation: `docs/research/gates/gate65e/artifacts/gate65e-unified-brain-router-discovery-v0/brain-router-policy-participation.json`
- Scenario exposure: `docs/research/gates/gate65e/artifacts/gate65e-unified-brain-router-discovery-v0/brain-router-scenario-memory-exposure.json`
- Signature collapse: `docs/research/gates/gate65e/artifacts/gate65e-unified-brain-router-discovery-v0/brain-router-signature-collapse.json`
- SHA identity: `docs/research/gates/gate65e/artifacts/gate65e-unified-brain-router-discovery-v0/gate65e-sha256.txt`

## Stop Line

Gate 65E stops at discovery-only router evidence. It does not emit final Body decisions or promote Alpha v2.
