# Gate 65B Decision-Signature Collapse and PF Surface

Generated: `2026-06-28T00:51:11.998Z`

## Verdict

`PASS_DECISION_SIGNATURE_COLLAPSE_AND_PF_SURFACE__NO_PROMOTION`

## Scope

- Diagnostic/evidence gate only.
- Reads Gate 64C matrix rows and summaries.
- Collapses decision-equivalent candidates before interpreting PF.
- Does not create new candidate rules, optimize thresholds, or promote a candidate.

## Signature Collapse

```json
{
  "candidate_count": 26,
  "decision_signature_count": 25,
  "duplicate_signature_count": 1,
  "duplicate_candidate_count": 1,
  "matrix_source_hash": "0FD57E33257C5E707F60FFAD7CE5543AB60E988E53DEC66A9F2586862D841CC3"
}
```

## PF Rankings

### ADR Grid PF

| candidate_id | adr_pf | wh_pf | adr_rdd | degraded | negative_years |
|---|---|---|---|---|---|
| valuation_gap_relative_inverse_extreme_else_rrp_inverse | 1.264195 | 1.11445 | 8.934273 | 0 | 3 |
| gate63_rrp_derived_inverse | 1.259757 | 1.127837 | 6.869459 | 0 | 2 |
| rrp_inverse_when_disagrees_valuation_reer_else_valuation | 1.259757 | 1.127837 | 6.869459 | 0 | 2 |
| rrp_inverse_when_agrees_valuation_reer_else_alpha | 1.231009 | 1.156528 | 6.101189 | 0 | 0 |
| strength_when_agrees_valuation_reer_else_rrp | 1.218246 | 1.154452 | 6.275519 | 0 | 1 |
| cot_strength_rrp_valuation_reer_majority | 1.204779 | 1.144967 | 6.432025 | 0 | 3 |
| cot_strength_rrp_valuation_relative_majority | 1.202333 | 1.116807 | 5.509792 | 0 | 2 |
| gate63_cot_strength_rrp_inverse_majority | 1.20065 | 1.11725 | 7.502986 | 0 | 1 |

### Weekly Hold PF

| candidate_id | adr_pf | wh_pf | adr_rdd | degraded | negative_years |
|---|---|---|---|---|---|
| rrp_inverse_when_agrees_valuation_reer_else_alpha | 1.231009 | 1.156528 | 6.101189 | 0 | 0 |
| strength_when_agrees_valuation_reer_else_rrp | 1.218246 | 1.154452 | 6.275519 | 0 | 1 |
| cot_strength_rrp_valuation_reer_majority | 1.204779 | 1.144967 | 6.432025 | 0 | 3 |
| gate63_rrp_derived_inverse | 1.259757 | 1.127837 | 6.869459 | 0 | 2 |
| rrp_inverse_when_disagrees_valuation_reer_else_valuation | 1.259757 | 1.127837 | 6.869459 | 0 | 2 |
| cot_when_agrees_valuation_reer_else_rrp | 1.161801 | 1.120289 | 4.759056 | 0 | 3 |
| cot_strength_regime_valuation_bundle_reer | 1.165874 | 1.119313 | 4.300031 | 0 | 1 |
| gate63_cot_strength_rrp_inverse_majority | 1.20065 | 1.11725 | 7.502986 | 0 | 1 |

### Combined PF

| candidate_id | adr_pf | wh_pf | adr_rdd | degraded | negative_years |
|---|---|---|---|---|---|
| gate63_rrp_derived_inverse | 1.259757 | 1.127837 | 6.869459 | 0 | 2 |
| rrp_inverse_when_disagrees_valuation_reer_else_valuation | 1.259757 | 1.127837 | 6.869459 | 0 | 2 |
| rrp_inverse_when_agrees_valuation_reer_else_alpha | 1.231009 | 1.156528 | 6.101189 | 0 | 0 |
| valuation_gap_relative_inverse_extreme_else_rrp_inverse | 1.264195 | 1.11445 | 8.934273 | 0 | 3 |
| strength_when_agrees_valuation_reer_else_rrp | 1.218246 | 1.154452 | 6.275519 | 0 | 1 |
| cot_strength_rrp_valuation_reer_majority | 1.204779 | 1.144967 | 6.432025 | 0 | 3 |
| cot_strength_rrp_valuation_relative_majority | 1.202333 | 1.116807 | 5.509792 | 0 | 2 |
| gate63_cot_strength_rrp_inverse_majority | 1.20065 | 1.11725 | 7.502986 | 0 | 1 |

## Findings

```json
{
  "candidate_count": 26,
  "decision_signature_count": 25,
  "duplicate_signature_count": 1,
  "duplicate_candidate_count": 1,
  "highest_adr_grid_pf_candidate": {
    "candidate_id": "valuation_gap_relative_inverse_extreme_else_rrp_inverse",
    "family": "valuation_gap_tiered",
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
    "decision_signature_sha256": "FF6A2D106213CA1AD5C0B6665E3C89D4E170F1694CD46D274C8C6654E2925CF1"
  },
  "highest_robust_pf_candidate": {
    "candidate_id": "rrp_inverse_when_agrees_valuation_reer_else_alpha",
    "family": "atom_dependency",
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
  "highest_pf_after_signature_collapse": {
    "candidate_id": "valuation_gap_relative_inverse_extreme_else_rrp_inverse",
    "family": "valuation_gap_tiered",
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
    "decision_signature_sha256": "FF6A2D106213CA1AD5C0B6665E3C89D4E170F1694CD46D274C8C6654E2925CF1"
  },
  "improves_pf_meaningfully_over_gate64c_top_rdd": false,
  "improves_pf_meaningfully_over_gate63_rrp_inverse": false,
  "improves_pf_meaningfully_over_gate64c_zero_negative": true,
  "no_new_candidate_rules_created": true,
  "no_threshold_optimization": true,
  "no_candidate_promoted": true
}
```

## Artifacts

- Decision signature collapse: `docs/research/gates/gate65b/artifacts/gate65b-decision-signature-pf-surface/decision-signature-collapse.json`
- PF ranking surface: `docs/research/gates/gate65b/artifacts/gate65b-decision-signature-pf-surface/pf-ranking-surface.json`
- PF year stability diagnostics: `docs/research/gates/gate65b/artifacts/gate65b-decision-signature-pf-surface/pf-year-stability-diagnostics.json`
- PF comparison: `docs/research/gates/gate65b/artifacts/gate65b-decision-signature-pf-surface/pf-comparison-vs-gate64c.json`
- Summary: `docs/research/gates/gate65b/artifacts/gate65b-decision-signature-pf-surface/gate65b-summary.json`
- SHA identity: `docs/research/gates/gate65b/artifacts/gate65b-decision-signature-pf-surface/gate65b-sha256.txt`

## Stop Line

Gate 65B stops after PF/signature diagnostics. It does not promote any Gate 64C or new candidate.
