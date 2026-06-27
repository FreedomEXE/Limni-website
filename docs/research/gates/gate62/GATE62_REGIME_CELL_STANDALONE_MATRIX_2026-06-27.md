# Gate 62 Regime-Cell Standalone Matrix

Generated: `2026-06-27T18:10:40.641Z`

## Verdict

`PASS_REGIME_CELL_STANDALONE_MATRIX__FORCED28_PRESERVED__NO_GATE63`

## Boundary

- Regime-cell discovery matrix only.
- Uses Regime atoms only: BPR, rates, CPI/inflation, RRP, PPP, NEER, and REER.
- BPR remains inside Regime.
- No COT atoms, Strength atoms, universal all-atom matrix, Gate 63, Alpha v2, final Body algorithm, risk, execution, MT5/live, app/runtime work, source mutation, row dropping, COT retuning, or Strength retuning.

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
  "candidate_count": 23,
  "disqualified_candidates": 0,
  "cot_atoms_used": false,
  "strength_atoms_used": false,
  "source_rows_mutated": false
}
```

## Candidate Ranking

| Rank | Candidate | Bucket | ADR Grid | DD | R/DD | PF | Weekly Hold | Degraded Rows |
|---:|---|---|---:|---:|---:|---:|---:|---:|
| 1 | rrp_derived_inverse | promising_discovery_only | 2383.621777 | -346.988306 | 6.869459 | 1.259757 | 688.316096 | 0 |
| 2 | full_regime_simple_composite_inverse | fragile_or_governance_review | 1551.056618 | -358.844513 | 4.322364 | 1.155499 | 481.216126 | 5331 |
| 3 | bpr_plus_valuation_bundle_inverse | fragile_or_governance_review | 1451.571388 | -349.148071 | 4.157466 | 1.143881 | 581.90928 | 5331 |
| 4 | reer_inverse | fragile_or_governance_review | 1643.629493 | -431.714943 | 3.80721 | 1.166496 | 507.4308 | 0 |
| 5 | ppp_inverse | promising_discovery_only | 1930.004196 | -551.625886 | 3.498756 | 1.197913 | 333.232146 | 0 |
| 6 | valuation_bundle_ppp_neer_reer_inverse | fragile_or_governance_review | 1346.430891 | -431.34434 | 3.121476 | 1.132548 | 348.578064 | 0 |
| 7 | bpr_plus_rate_inflation_bundle_inverse | fragile_or_governance_review | 1230.08956 | -446.876728 | 2.752637 | 1.119525 | 342.185298 | 5331 |
| 8 | rates_nominal_rate_3m_inverse | fragile_or_governance_review | 1018.774372 | -515.20268 | 1.977424 | 1.096749 | 206.862132 | 0 |
| 9 | rate_inflation_bundle_rates_cpi_rrp_inverse | fragile_or_governance_review | 1018.774372 | -515.20268 | 1.977424 | 1.096749 | 206.862132 | 0 |
| 10 | inflation_cpi_yoy_natural | fragile_or_governance_review | 1314.052144 | -783.477572 | 1.677205 | 1.127237 | 155.96847 | 0 |
| 11 | rates_nominal_rate_3m_natural | fragile_or_governance_review | 1103.143038 | -668.024 | 1.651352 | 1.104597 | -206.862132 | 0 |
| 12 | rate_inflation_bundle_rates_cpi_rrp_natural | fragile_or_governance_review | 1103.143038 | -668.024 | 1.651352 | 1.104597 | -206.862132 | 0 |
| 13 | bpr_only_forced28_source_direction | fragile_or_governance_review | 916.693099 | -693.393771 | 1.322038 | 1.086285 | 282.841338 | 5331 |
| 14 | neer_natural | promising_discovery_only | 1448.357274 | -1238.43941 | 1.169502 | 1.140358 | -238.137568 | 0 |
| 15 | inflation_cpi_yoy_inverse | fragile_or_governance_review | 807.865266 | -825.312391 | 0.97886 | 1.075157 | -155.96847 | 0 |
| 16 | neer_inverse | promising_discovery_only | 673.560136 | -718.906504 | 0.936923 | 1.062612 | 238.137568 | 0 |

## BPR Quality Cohorts

BPR cohort diagnostics are intentionally separate from row-complete matrix candidates. They do not silently drop rows from candidate scoring.

```json
[
  {
    "cohort_id": "bpr_promotion_eligible_pair_direction",
    "rows": 5113,
    "weeks": 369,
    "adr_grid_adr": 665.675935,
    "weekly_hold_adr": 203.369635,
    "degraded_rows": 0
  },
  {
    "cohort_id": "bpr_source_direction_eligible",
    "rows": 8043,
    "weeks": 370,
    "adr_grid_adr": 711.478752,
    "weekly_hold_adr": 252.135375,
    "degraded_rows": 2930
  },
  {
    "cohort_id": "bpr_raw_or_fresh_only_both_sides",
    "rows": 4427,
    "weeks": 369,
    "adr_grid_adr": 616.523795,
    "weekly_hold_adr": 155.958064,
    "degraded_rows": 0
  },
  {
    "cohort_id": "bpr_excluding_stale_carried",
    "rows": 8487,
    "weeks": 373,
    "adr_grid_adr": 955.487158,
    "weekly_hold_adr": 257.734753,
    "degraded_rows": 3374
  },
  {
    "cohort_id": "bpr_excluding_synthetic_usd",
    "rows": 7854,
    "weeks": 373,
    "adr_grid_adr": 861.823461,
    "weekly_hold_adr": 230.363972,
    "degraded_rows": 3427
  },
  {
    "cohort_id": "bpr_promotion_ineligible_pair_direction",
    "rows": 5331,
    "weeks": 275,
    "adr_grid_adr": 251.017164,
    "weekly_hold_adr": 79.471703,
    "degraded_rows": 5331
  }
]
```

## Artifacts

- Candidate contracts: `docs/research/gates/gate62/artifacts/gate62-regime-cell-standalone-matrix/gate62-regime-cell-candidate-contracts.json`
- Matrix rows: `docs/research/gates/gate62/artifacts/gate62-regime-cell-standalone-matrix/gate62-regime-cell-matrix.rows.jsonl`
- Summary JSON: `docs/research/gates/gate62/artifacts/gate62-regime-cell-standalone-matrix/gate62-regime-cell-matrix.summary.json`
- Quality cohorts: `docs/research/gates/gate62/artifacts/gate62-regime-cell-standalone-matrix/gate62-regime-cell-quality-cohorts.json`
- Best candidates: `docs/research/gates/gate62/artifacts/gate62-regime-cell-standalone-matrix/gate62-regime-cell-best-candidates.md`
- Query/rebuild receipt: `docs/research/gates/gate62/artifacts/gate62-regime-cell-standalone-matrix/gate62-regime-cell-standalone-matrix.query-receipt.md`
- SHA identity: `docs/research/gates/gate62/artifacts/gate62-regime-cell-standalone-matrix/gate62-regime-cell-standalone-matrix.sha256.txt`

## Stop Line

Gate 62 stops here for Freedom review. No Gate 63 work, universal atom matrix, Alpha v2, final Body algorithm, risk, execution, MT5/live, app/runtime work, or source mutation was started.
