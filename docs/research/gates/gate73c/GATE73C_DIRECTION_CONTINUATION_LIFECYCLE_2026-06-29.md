# Gate 73C Direction-Continuation Lifecycle Diagnostic

Generated: `2026-06-29T01:54:57.594Z`

## Verdict

`PASS_GATE73C_DIRECTION_CONTINUATION_LIFECYCLE__PERSISTENCE_AND_COST_SENSITIVITY_VISIBLE`

## Scope

- Tests whether Candidate B pair directions persist enough to justify a continuation lifecycle diagnostic.
- Uses locked Candidate B directions plus existing pair-week weekly-hold outcomes.
- Compares weekly forced close versus carry-until-flip under gross aggregation and cost sensitivity.
- Does not run dynamic intrawEEK trade exits, rebuild raw M1, mutate Candidate B, start risk, or promote a lifecycle.

## Key Finding

Candidate B produced 930 pair-direction streaks across 10444 pair-week rows. Gross carry-until-flip equals weekly forced close under the existing weekly outcome warehouse, but standard-cost carry saves 190.28 ADR through 0.910954 turnover reduction; carry standard PF is 1.400007 versus weekly forced standard PF 1.261308.

## Streak Length Distribution

| streak_length_bucket | streaks | total_weeks | average_streak_length | average_adr | median_adr | total_adr | profit_factor_adr | contribution_to_total_adr |
|---|---|---|---|---|---|---|---|---|
| 1 | 252 | 252 | 1 | -0.125259 | -0.194325 | -31.565262 | 0.789389 | -0.049429 |
| 2 | 131 | 262 | 2 | -0.001383 | -0.006404 | -0.181216 | 0.998135 | -0.000284 |
| 3 | 80 | 240 | 3 | 0.438754 | 0.122036 | 35.100356 | 1.686457 | 0.054964 |
| 4 | 59 | 236 | 4 | 0.411297 | 0.301782 | 24.266546 | 1.551863 | 0.037999 |
| 5_plus | 408 | 9454 | 23.171569 | 1.497507 | 1.416952 | 610.982752 | 1.950676 | 0.956749 |

## Lifecycle Comparison

```json
{
  "cost_model": {
    "standard_cost_per_transaction_adr": 0.01,
    "harsh_cost_per_transaction_adr": 0.03,
    "transaction_definition": "one pair-side open or close event in ADR units",
    "gross_model_note": "Gross carry-until-flip uses weekly outcome aggregation and equals weekly forced close gross by construction; cost and lifecycle grouping are the first-order warehouse-answerable differences."
  },
  "weekly_forced_close_gross_pair_week": {
    "observations": 10444,
    "total_adr": 638.603176,
    "average_adr": 0.061145,
    "median_adr": 0.033368,
    "gross_profit_adr": 6047.803248,
    "gross_loss_adr": -5409.200072,
    "profit_factor_adr": 1.118059,
    "win_rate": 0.509768,
    "max_drawdown_adr": -118.689875
  },
  "carry_until_flip_gross_streak_lifecycle": {
    "observations": 930,
    "total_adr": 638.603176,
    "average_adr": 0.68667,
    "median_adr": 0.248611,
    "gross_profit_adr": 1623.424914,
    "gross_loss_adr": -984.821738,
    "profit_factor_adr": 1.648445,
    "win_rate": 0.541935,
    "max_drawdown_adr": -64.526358
  },
  "weekly_forced_close_standard_cost_weekly_series": {
    "observations": 373,
    "total_adr": 429.723176,
    "average_adr": 1.152073,
    "median_adr": -0.350844,
    "gross_profit_adr": 2074.233262,
    "gross_loss_adr": -1644.510086,
    "profit_factor_adr": 1.261308,
    "win_rate": 0.490617,
    "max_drawdown_adr": -131.899755
  },
  "carry_until_flip_standard_cost_weekly_series": {
    "observations": 373,
    "total_adr": 620.003176,
    "average_adr": 1.662207,
    "median_adr": 0.189156,
    "gross_profit_adr": 2169.985312,
    "gross_loss_adr": -1549.982136,
    "profit_factor_adr": 1.400007,
    "win_rate": 0.514745,
    "max_drawdown_adr": -117.629755
  },
  "turnover": {
    "weekly_forced_close_transactions": 20888,
    "carry_until_flip_transactions": 1860,
    "turnover_reduction_transactions": 19028,
    "turnover_reduction_rate": 0.910954,
    "standard_cost_saved_adr": 190.28,
    "harsh_cost_saved_adr": 570.84
  }
}
```

## Continuation Summary

```json
{
  "losing_friday_continuation": {
    "count": 4641,
    "recovered_to_breakeven_rate": 0.752424,
    "later_became_profitable_rate": 0.752424,
    "materially_worsened_rate": 0.620125,
    "average_remaining_streak_adr_after_week": 2.152548,
    "median_remaining_streak_adr_after_week": 1.673592,
    "total_adr_effect_of_carrying": 9989.973412
  },
  "winning_friday_continuation": {
    "count": 4871,
    "continued_higher_rate": 0.638883,
    "gave_back_rate": 0.361117,
    "average_continuation_gain_adr": 4.716935,
    "average_giveback_adr": -3.397364,
    "median_remaining_streak_adr_after_week": 1.288887,
    "total_adr_effect_of_carrying": 8703.137719
  }
}
```

## Flip Quality Summary

```json
{
  "flips": 902,
  "flip_after_losing_streak_rate": 0.452328,
  "flip_after_losing_last_week_rate": 0.511086,
  "next_direction_first_week_positive_rate": 0.488914,
  "flip_saved_loss_proxy_rate": 0.222838,
  "flip_arrived_late_proxy_rate": 0.2051,
  "average_prior_streak_adr": 0.78309,
  "average_next_first_week_adr": -0.042999,
  "average_next_streak_adr": 0.630346
}
```

## Validation

```json
{
  "candidate_b_forced28_preserved": true,
  "candidate_b_ledger_hash_matches_gate71bm": true,
  "gate71bm_passed": true,
  "pair_week_outcome_warehouse_id": "gate57a0b_pair_week_path_outcomes_47B8F40AFB3B",
  "raw_m1_rebuild_performed": false,
  "dynamic_intrweek_exit_matrix_started": false,
  "continuation_lifecycle_diagnostic_only": true,
  "exit_promotion_performed": false,
  "risk_layer_started": false,
  "brain_truth_mutated": false,
  "weeks_reviewed": 373,
  "expected_weeks": 373,
  "pair_week_rows": 10444,
  "expected_pair_week_rows": 10444,
  "symbols": 28,
  "expected_symbols_per_week": 28,
  "direction_streaks": 930,
  "continuation_events": 9514,
  "flip_events": 902,
  "missing_price_pair_week_rows": 0,
  "default_adr_pair_week_rows": 270,
  "standard_cost_per_transaction_adr": 0.01,
  "harsh_cost_per_transaction_adr": 0.03,
  "weekly_forced_standard_total_adr": 429.723176,
  "carry_until_flip_standard_total_adr": 620.003176,
  "carry_minus_weekly_standard_total_adr": 190.28,
  "weekly_forced_standard_pf": 1.261308,
  "carry_until_flip_standard_pf": 1.400007,
  "turnover_reduction_rate": 0.910954,
  "runtime_seconds": 8.671
}
```

## Recommendation

```json
{
  "next_gate_recommendation": "Gate 73D: continuation verdict and baseline decision preflight",
  "decision_options": [
    "keep weekly forced close as baseline and return to profit-protection tests",
    "treat carry-until-flip as a candidate lifecycle baseline requiring continuous-path materialization before promotion",
    "run a small cost-sensitivity-only continuation review if Freedom wants more conservative transaction assumptions"
  ],
  "notes": [
    "Do not promote carry-until-flip from Gate 73C; this is lifecycle diagnostics only.",
    "Do not use this as a substitute for dynamic intrawEEK trade-leg exits.",
    "Gross carry equals weekly gross under current warehouses; continuous raw-price carry would need a separate materialized path contract.",
    "Cost-adjusted weekly carry series improves PF versus weekly forced close under the standard sensitivity.",
    "Same-direction continuation meaningfully reduces modeled turnover.",
    "Losing-Friday continuation often recovers on a weekly-close proxy; weekly force-close may be prematurely realizing some valid directions."
  ],
  "forbidden_next_steps": [
    "no promotion",
    "no risk layer",
    "no dynamic intrawEEK trade-leg exit matrix",
    "no pair-specific parameters",
    "no source or Candidate B mutation",
    "no MT5/live/runtime work"
  ]
}
```

## Artifacts

- Direction streak ledger: `docs/research/gates/gate73c/artifacts/gate73c-direction-continuation-lifecycle/direction-streak-ledger.rows.jsonl`
- Continuation event ledger: `docs/research/gates/gate73c/artifacts/gate73c-direction-continuation-lifecycle/continuation-event-ledger.rows.jsonl`
- Flip quality ledger: `docs/research/gates/gate73c/artifacts/gate73c-direction-continuation-lifecycle/flip-quality-ledger.rows.jsonl`
- Streak length distribution: `docs/research/gates/gate73c/artifacts/gate73c-direction-continuation-lifecycle/streak-length-distribution.json`
- Lifecycle comparison: `docs/research/gates/gate73c/artifacts/gate73c-direction-continuation-lifecycle/weekly-close-vs-carry-comparison.json`
- Continuation summaries: `docs/research/gates/gate73c/artifacts/gate73c-direction-continuation-lifecycle/losing-winning-friday-continuation-summary.json`
- Flip quality summary: `docs/research/gates/gate73c/artifacts/gate73c-direction-continuation-lifecycle/flip-quality-summary.json`
- Annual stability: `docs/research/gates/gate73c/artifacts/gate73c-direction-continuation-lifecycle/annual-stability.json`
- Top-winner stability: `docs/research/gates/gate73c/artifacts/gate73c-direction-continuation-lifecycle/top-winner-stability.json`
- Summary: `docs/research/gates/gate73c/artifacts/gate73c-direction-continuation-lifecycle/gate73c-summary.json`
- SHA identity: `docs/research/gates/gate73c/artifacts/gate73c-direction-continuation-lifecycle/gate73c-sha256.txt`

## Stop Line

Gate 73C is diagnostic only. No continuation lifecycle is promoted by this receipt.
