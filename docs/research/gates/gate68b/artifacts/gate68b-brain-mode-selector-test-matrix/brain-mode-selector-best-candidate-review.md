# Gate 68B Best Candidate Review

No promotion. Candidate D is tested only.

## Best ADR Grid R/DD

```json
{
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
  "decision_signature_sha256": "8C873CCCF9FA3D3A578EAC7160C8526EC25A0BEA528FE3C0A5304BE9413E6F01",
  "mode_counts": null
}
```

## Best ADR Grid PF

```json
{
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
  "decision_signature_sha256": "8C873CCCF9FA3D3A578EAC7160C8526EC25A0BEA528FE3C0A5304BE9413E6F01",
  "mode_counts": null
}
```

## Best Zero-Negative-Year Candidate

```json
{
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
  "decision_signature_sha256": "81577C4BABEE192F9CACB4556B035A68A7C0D76AAD7C976EFA55F0FCD87B4D23",
  "mode_counts": null
}
```

## Candidate D Delta

```json
{
  "vs_candidate_b": {
    "adr_grid_adr_delta": -105.461718,
    "adr_grid_rdd_delta": -3.945504,
    "adr_grid_pf_delta": -0.014631,
    "weekly_hold_adr_delta": 207.468938,
    "weekly_hold_rdd_delta": 1.805185,
    "weekly_hold_pf_delta": 0.041413,
    "negative_adr_grid_year_delta": 0
  },
  "vs_candidate_c": {
    "adr_grid_adr_delta": -40.664286,
    "adr_grid_rdd_delta": -2.528247,
    "adr_grid_pf_delta": -0.003454,
    "weekly_hold_adr_delta": 113.171652,
    "weekly_hold_rdd_delta": 1.468093,
    "weekly_hold_pf_delta": 0.022789,
    "negative_adr_grid_year_delta": 1
  }
}
```

## Signature Collapse

```json
[
  {
    "candidate_id": "candidate_a_macro_anchor_conservative",
    "decision_signature_sha256": "5FD8968F883A461671D7EAAC78B71BF8A3045F594267F2926A48290BC1FF827A",
    "equivalent_gate64c_candidate_id": null,
    "equivalent_gate65e_candidate_id": null,
    "equivalent_gate67_candidate_id": "candidate_a_macro_anchor_conservative",
    "genuinely_new_vs_gate64_65_67": false
  },
  {
    "candidate_id": "candidate_b_macro_anchor_with_cot_warning",
    "decision_signature_sha256": "8C873CCCF9FA3D3A578EAC7160C8526EC25A0BEA528FE3C0A5304BE9413E6F01",
    "equivalent_gate64c_candidate_id": null,
    "equivalent_gate65e_candidate_id": "macro_anchor_crowding_warning_rrp_cot_extreme",
    "equivalent_gate67_candidate_id": "candidate_b_macro_anchor_with_cot_warning",
    "genuinely_new_vs_gate64_65_67": false
  },
  {
    "candidate_id": "candidate_c_scenario_memory_guarded",
    "decision_signature_sha256": "81577C4BABEE192F9CACB4556B035A68A7C0D76AAD7C976EFA55F0FCD87B4D23",
    "equivalent_gate64c_candidate_id": null,
    "equivalent_gate65e_candidate_id": null,
    "equivalent_gate67_candidate_id": "candidate_c_scenario_memory_guarded",
    "genuinely_new_vs_gate64_65_67": false
  },
  {
    "candidate_id": "candidate_d_brain_mode_selector",
    "decision_signature_sha256": "5FC0C033E0464597AAC0DCC3E50C2F7133C55C2BC05262BE545E1FBC5682D78B",
    "equivalent_gate64c_candidate_id": null,
    "equivalent_gate65e_candidate_id": null,
    "equivalent_gate67_candidate_id": null,
    "genuinely_new_vs_gate64_65_67": true
  }
]
```
