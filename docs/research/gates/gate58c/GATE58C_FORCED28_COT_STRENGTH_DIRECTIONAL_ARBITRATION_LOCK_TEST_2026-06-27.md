# Gate 58C Forced-28 COT x Strength Directional Arbitration Lock Test

Generated: 2026-06-27T04:42:25.558Z

## Verdict

PASS_FORCED_28_DIRECTIONAL_LOCK.

A unique predeclared forced-28 hybrid beats the COT 373-week intersection on ADR Grid and R/DD, does not materially worsen PF, preserves year stability versus both baselines, and is not concentrated in a tiny cell, one pair, or the top five weeks.

## Boundary

- Matrix input: `docs/research/gates/gate58/artifacts/gate58-cot-strength-forensic-matrix/gate58-cot-strength-forensic-matrix.rows.jsonl`
- Warehouse ID: `gate57a0b_pair_week_path_outcomes_47B8F40AFB3B`
- Price bundle: `gate55e_fx_m1_oanda_ny5_v1_20181217_20260607_8E37E953`
- COT baseline: `CLP carry-forward + carry-previous tie fill`
- Strength baseline: `phase_conditioned_remainder`
- Window: 373-week COT x Strength intersection only
- Outcome source: frozen Gate 58 matrix plus warehouse long/short outcomes only
- Forced-28 rule: every candidate must output `10,444` rows = `373` weeks x `28` symbols
- Not run: raw M1 simulation, app code, COT source changes, Strength window/source changes, row vetoes, skipped pair-weeks, eligibility filters, pair/calendar exclusions, regimes, risk overlays, execution changes, market-open confirmation, thresholds, buckets, or parameter searches.

## Artifacts

- Summary JSON: `docs/research/gates/gate58c/artifacts/gate58c-forced28-directional-arbitration/gate58c-forced28-directional-arbitration.summary.json`
- Summary SHA-256: `FF046B64705DFA744085E0954E046E6017104D56CC67FFB2158D13C6DE91149C`
- Candidate row-level decisions JSONL: `docs/research/gates/gate58c/artifacts/gate58c-forced28-directional-arbitration/gate58c-forced28-directional-arbitration.decisions.jsonl`
- Candidate row-level decisions SHA-256: `B0E72B79A19F3FD0A411FBF1D0D1BD36B2763E33F9885145B3AE73958DD0D698`
- Receipt JSON: `docs/research/gates/gate58c/artifacts/gate58c-forced28-directional-arbitration/gate58c-forced28-directional-arbitration.receipt.json`
- Receipt SHA-256: `5D8ACCBDB54FBFD4A44AC847276D24C473E07EE627CECDBFCCC1391D4C4D82B0`
- Hash manifest JSON: `docs/research/gates/gate58c/artifacts/gate58c-forced28-directional-arbitration/gate58c-forced28-directional-arbitration.hash.json`
- Tracked SHA-256 identity file: `docs/research/gates/gate58c/artifacts/gate58c-forced28-directional-arbitration/gate58c-forced28-directional-arbitration.sha256.txt`
- Combined artifact hash: `ACABB23D19E937DEBDC4FEC9FE543FF0740DE4C5D535F0FCB69A73619E0D81DC`

## Validation

```json
{
  "row_count": 10444,
  "expected_row_count": 10444,
  "week_count": 373,
  "expected_week_count": 373,
  "symbol_count": 28,
  "expected_symbols_per_week": 28,
  "rows_per_week": {
    "weeks": 373,
    "full_weeks_count": 373,
    "min_rows_per_week": 28,
    "max_rows_per_week": 28,
    "mean_rows_per_week": 28,
    "histogram": {
      "28": 373
    },
    "non_full_weeks": []
  },
  "duplicate_week_symbol_rows": 0,
  "missing_cot_state_rows": 0,
  "missing_strength_state_rows": 0,
  "missing_long_outcomes": 0,
  "missing_short_outcomes": 0,
  "price_bundle_mismatch_rows": 0,
  "warehouse_mismatch_rows": 0,
  "first_week": "2019-04-14T23:00:00.000Z",
  "last_week": "2026-05-31T23:00:00.000Z",
  "warehouse": {
    "warehouse_rows_read": 20888,
    "expected_rows": 20888,
    "missing_directional_outcomes": 0
  }
}
```

## COT Full Reference

The COT full 388-week reference is reported separately and is not the direct lock-comparison window.

```json
{
  "cot_full_388_week_baseline": {
    "label": "COT full 388-week baseline",
    "rows": 10864,
    "weeks": 388,
    "missing_outcomes": 0,
    "adr_grid_sum": 1493.816099,
    "adr_grid_mean": 0.137501,
    "adr_grid_row_pf": 1.141179,
    "adr_grid_max_drawdown": -344.994076,
    "weekly_hold_sum": 367.516556,
    "weekly_hold_mean": 0.033829,
    "weekly_hold_row_pf": 1.063853,
    "weekly_hold_max_drawdown": -151.931271
  },
  "cot_only_warmup_remainder": {
    "label": "COT-only FRS15 warmup remainder",
    "rows": 392,
    "weeks": 14,
    "missing_outcomes": 0,
    "adr_grid_sum": 35.293419,
    "adr_grid_mean": 0.090034,
    "adr_grid_row_pf": 1.096991,
    "adr_grid_max_drawdown": -99.021161,
    "weekly_hold_sum": 10.507593,
    "weekly_hold_mean": 0.026805,
    "weekly_hold_row_pf": 1.053543,
    "weekly_hold_max_drawdown": -42.489799
  },
  "cot_intersection_373_week_reference": {
    "label": "COT side on 373-week intersection",
    "rows": 10444,
    "weeks": 373,
    "missing_outcomes": 0,
    "adr_grid_sum": 1417.521896,
    "adr_grid_mean": 0.135726,
    "adr_grid_row_pf": 1.13874,
    "adr_grid_max_drawdown": -344.994076,
    "weekly_hold_sum": 353.969364,
    "weekly_hold_mean": 0.033892,
    "weekly_hold_row_pf": 1.063761,
    "weekly_hold_max_drawdown": -151.931271
  },
  "strength_parent_intersection_reference": {
    "label": "FRS15 parent selected side on 373-week intersection",
    "rows": 10444,
    "weeks": 373,
    "missing_outcomes": 0,
    "adr_grid_sum": 1244.374933,
    "adr_grid_mean": 0.119147,
    "adr_grid_row_pf": 1.120185,
    "adr_grid_max_drawdown": -691.195741,
    "weekly_hold_sum": -268.29494,
    "weekly_hold_mean": -0.025689,
    "weekly_hold_row_pf": 0.954237,
    "weekly_hold_max_drawdown": -526.981195
  },
  "strength_gate57e_intersection_reference": {
    "label": "Gate 57E phase_conditioned_remainder side on 373-week intersection",
    "rows": 10444,
    "weeks": 373,
    "missing_outcomes": 0,
    "adr_grid_sum": 1386.281312,
    "adr_grid_mean": 0.132735,
    "adr_grid_row_pf": 1.135607,
    "adr_grid_max_drawdown": -304.412583,
    "weekly_hold_sum": 401.524762,
    "weekly_hold_mean": 0.038445,
    "weekly_hold_row_pf": 1.072638,
    "weekly_hold_max_drawdown": -181.589347
  }
}
```

## Candidate Metrics

```json
[
  {
    "id": "A_COT_ONLY_INTERSECTION",
    "duplicate_of": null,
    "rows": 10444,
    "weeks": 373,
    "full_weeks_count": 373,
    "duplicate_week_symbol_rows": 0,
    "missing_cot_rows": 0,
    "missing_strength_rows": 0,
    "missing_warehouse_outcomes": 0,
    "adr_grid_adr": 1417.521896,
    "max_drawdown": -344.994076,
    "r_over_drawdown": 4.10883,
    "pf": 1.13874,
    "weekly_hold_adr": 353.969364,
    "top5_abs_week_share": 0.076869,
    "top_abs_pair_share": 0.076263,
    "rule": "Final side equals the locked CLP COT side for every pair-week in the 373-week COT x Strength intersection."
  },
  {
    "id": "B_STRENGTH_57E_ONLY_INTERSECTION",
    "duplicate_of": null,
    "rows": 10444,
    "weeks": 373,
    "full_weeks_count": 373,
    "duplicate_week_symbol_rows": 0,
    "missing_cot_rows": 0,
    "missing_strength_rows": 0,
    "missing_warehouse_outcomes": 0,
    "adr_grid_adr": 1386.281312,
    "max_drawdown": -304.412583,
    "r_over_drawdown": 4.553955,
    "pf": 1.135607,
    "weekly_hold_adr": 401.524762,
    "top5_abs_week_share": 0.078738,
    "top_abs_pair_share": 0.084153,
    "rule": "Final side equals the locked Gate 57E phase_conditioned_remainder Strength side for every pair-week in the 373-week intersection."
  },
  {
    "id": "C_STRENGTH_HEALTHY_COT_FALLBACK",
    "duplicate_of": null,
    "rows": 10444,
    "weeks": 373,
    "full_weeks_count": 373,
    "duplicate_week_symbol_rows": 0,
    "missing_cot_rows": 0,
    "missing_strength_rows": 0,
    "missing_warehouse_outcomes": 0,
    "adr_grid_adr": 1648.250785,
    "max_drawdown": -312.072214,
    "r_over_drawdown": 5.281633,
    "pf": 1.164255,
    "weekly_hold_adr": 534.366308,
    "top5_abs_week_share": 0.077325,
    "top_abs_pair_share": 0.084361,
    "rule": "Use Gate 57E Strength when the Strength lifecycle x phase state is compressed:persistent, compressed:flip, or middle:persistent; otherwise fall back to locked COT."
  },
  {
    "id": "D_COT_PARENT_STRENGTH_HEALTHY_OVERRIDE",
    "duplicate_of": "C_STRENGTH_HEALTHY_COT_FALLBACK",
    "rows": 10444,
    "weeks": 373,
    "full_weeks_count": 373,
    "duplicate_week_symbol_rows": 0,
    "missing_cot_rows": 0,
    "missing_strength_rows": 0,
    "missing_warehouse_outcomes": 0,
    "adr_grid_adr": 1648.250785,
    "max_drawdown": -312.072214,
    "r_over_drawdown": 5.281633,
    "pf": 1.164255,
    "weekly_hold_adr": 534.366308,
    "top5_abs_week_share": 0.077325,
    "top_abs_pair_share": 0.084361,
    "rule": "Use locked COT by default; override to Gate 57E Strength only for compressed:persistent, compressed:flip, and middle:persistent Strength states."
  }
]
```

## Promotion Screen

```json
{
  "cot_intersection_stability": {
    "negative_year_count": 1,
    "worst_year_adr_grid": -65.90586,
    "best_year_adr_grid": 486.752647,
    "adr_grid_sum": 1417.521896,
    "adr_grid_r_over_drawdown": 4.10883,
    "adr_grid_pf": 1.13874
  },
  "strength57e_intersection_stability": {
    "negative_year_count": 1,
    "worst_year_adr_grid": -39.611613,
    "best_year_adr_grid": 506.590817,
    "adr_grid_sum": 1386.281312,
    "adr_grid_r_over_drawdown": 4.553955,
    "adr_grid_pf": 1.135607
  },
  "candidates": [
    {
      "candidate_id": "A_COT_ONLY_INTERSECTION",
      "duplicate_of": null,
      "family": "baseline",
      "full_forced_28": true,
      "beats_cot_adr_grid_adr": false,
      "beats_cot_rdd": false,
      "pf_delta_vs_cot": 0,
      "pf_not_materially_worse": true,
      "year_stability_not_degraded_vs_both": true,
      "negative_year_count": 1,
      "worst_year_adr_grid": -65.90586,
      "top5_abs_week_share": 0.076869,
      "not_top_five_week_dependent": true,
      "top_abs_pair_share": 0.076263,
      "not_pair_dependent": true,
      "top_positive_lifecycle_phase_delta_vs_cot": null,
      "not_tiny_cell_dependent": true,
      "simple_one_paragraph_rule": true,
      "evaluated_for_combined_lock": false,
      "lock_candidate": false
    },
    {
      "candidate_id": "B_STRENGTH_57E_ONLY_INTERSECTION",
      "duplicate_of": null,
      "family": "baseline",
      "full_forced_28": true,
      "beats_cot_adr_grid_adr": false,
      "beats_cot_rdd": true,
      "pf_delta_vs_cot": -0.003133,
      "pf_not_materially_worse": true,
      "year_stability_not_degraded_vs_both": true,
      "negative_year_count": 1,
      "worst_year_adr_grid": -39.611613,
      "top5_abs_week_share": 0.078738,
      "not_top_five_week_dependent": true,
      "top_abs_pair_share": 0.084153,
      "not_pair_dependent": true,
      "top_positive_lifecycle_phase_delta_vs_cot": {
        "group": {
          "strength_lifecycle_bucket": "compressed",
          "strength_phase_bucket": "flip"
        },
        "rows": 835,
        "weeks": 343,
        "adr_grid_delta_vs_cot": 215.49964
      },
      "not_tiny_cell_dependent": true,
      "simple_one_paragraph_rule": true,
      "evaluated_for_combined_lock": false,
      "lock_candidate": false
    },
    {
      "candidate_id": "C_STRENGTH_HEALTHY_COT_FALLBACK",
      "duplicate_of": null,
      "family": "hybrid",
      "full_forced_28": true,
      "beats_cot_adr_grid_adr": true,
      "beats_cot_rdd": true,
      "pf_delta_vs_cot": 0.025515,
      "pf_not_materially_worse": true,
      "year_stability_not_degraded_vs_both": true,
      "negative_year_count": 1,
      "worst_year_adr_grid": -32.536985,
      "top5_abs_week_share": 0.077325,
      "not_top_five_week_dependent": true,
      "top_abs_pair_share": 0.084361,
      "not_pair_dependent": true,
      "top_positive_lifecycle_phase_delta_vs_cot": {
        "group": {
          "strength_lifecycle_bucket": "compressed",
          "strength_phase_bucket": "flip"
        },
        "rows": 835,
        "weeks": 343,
        "adr_grid_delta_vs_cot": 215.49964
      },
      "not_tiny_cell_dependent": true,
      "simple_one_paragraph_rule": true,
      "evaluated_for_combined_lock": true,
      "lock_candidate": true
    },
    {
      "candidate_id": "D_COT_PARENT_STRENGTH_HEALTHY_OVERRIDE",
      "duplicate_of": "C_STRENGTH_HEALTHY_COT_FALLBACK",
      "family": "hybrid",
      "full_forced_28": true,
      "beats_cot_adr_grid_adr": true,
      "beats_cot_rdd": true,
      "pf_delta_vs_cot": 0.025515,
      "pf_not_materially_worse": true,
      "year_stability_not_degraded_vs_both": true,
      "negative_year_count": 1,
      "worst_year_adr_grid": -32.536985,
      "top5_abs_week_share": 0.077325,
      "not_top_five_week_dependent": true,
      "top_abs_pair_share": 0.084361,
      "not_pair_dependent": true,
      "top_positive_lifecycle_phase_delta_vs_cot": {
        "group": {
          "strength_lifecycle_bucket": "compressed",
          "strength_phase_bucket": "flip"
        },
        "rows": 835,
        "weeks": 343,
        "adr_grid_delta_vs_cot": 215.49964
      },
      "not_tiny_cell_dependent": true,
      "simple_one_paragraph_rule": true,
      "evaluated_for_combined_lock": false,
      "lock_candidate": false
    }
  ]
}
```

## Decision Read

```json
{
  "verdict": "PASS_FORCED_28_DIRECTIONAL_LOCK",
  "summary": "A unique predeclared forced-28 hybrid beats the COT 373-week intersection on ADR Grid and R/DD, does not materially worsen PF, preserves year stability versus both baselines, and is not concentrated in a tiny cell, one pair, or the top five weeks.",
  "lock_candidate": {
    "candidate_id": "C_STRENGTH_HEALTHY_COT_FALLBACK",
    "duplicate_of": null,
    "family": "hybrid",
    "full_forced_28": true,
    "beats_cot_adr_grid_adr": true,
    "beats_cot_rdd": true,
    "pf_delta_vs_cot": 0.025515,
    "pf_not_materially_worse": true,
    "year_stability_not_degraded_vs_both": true,
    "negative_year_count": 1,
    "worst_year_adr_grid": -32.536985,
    "top5_abs_week_share": 0.077325,
    "not_top_five_week_dependent": true,
    "top_abs_pair_share": 0.084361,
    "not_pair_dependent": true,
    "top_positive_lifecycle_phase_delta_vs_cot": {
      "group": {
        "strength_lifecycle_bucket": "compressed",
        "strength_phase_bucket": "flip"
      },
      "rows": 835,
      "weeks": 343,
      "adr_grid_delta_vs_cot": 215.49964
    },
    "not_tiny_cell_dependent": true,
    "simple_one_paragraph_rule": true,
    "evaluated_for_combined_lock": true,
    "lock_candidate": true
  }
}
```

## Alpha V1 Governance

```json
{
  "alpha_id": "ALPHA_V1_COT_PARENT_STRENGTH_HEALTHY_FALLBACK",
  "status": "provisional_forced28_directional_lock_for_forward_comparison",
  "one_paragraph_rule": "Use locked COT side by default for every pair-week. Use locked Gate 57E Strength side only when the Strength state is compressed:persistent, compressed:flip, or middle:persistent. The alpha layer must output exactly 28 pair directions per supported week and must never skip rows.",
  "interpretation": [
    "Gate 58C is accepted as the current forced-28 Alpha v1 directional lock, not as a permanent endorsement of the current Strength formulation.",
    "The lock exists to provide a stable baseline for Regime construction.",
    "This is not a final trading system, portfolio-ready system, investor-ready system, live system, risk layer, execution layer, or MT5/app integration."
  ],
  "strength_caveat": [
    "Strength remains provisional signal debt.",
    "Current Strength improved the forced-28 directional surface but lowered PF relative to stronger standalone Strength-quality diagnostics.",
    "PF caveat is real: the result is stronger aggregate forced-28 directional value, not a finished execution-quality portfolio."
  ],
  "future_versioning_rights": [
    "Strength may be revised, removed, or replaced only through a new versioned research gate.",
    "Future Strength changes must compare against COT-only, Alpha v1, Regime-only forced-28 shadow signal when available, and any Alpha v2 arbitration candidate.",
    "No silent Strength retuning, removal, or replacement is allowed inside Regime, risk, execution, MT5/live, or app-integration gates."
  ],
  "sequencing": [
    "Do not run more COT x Strength optimization in this lane.",
    "Do not test more Strength windows, add state cells, or expand the three-state rule into a larger tree before Regime source integrity and Regime shadow-signal work.",
    "Regime may begin from this frozen Alpha v1 baseline after Gate 58C is packaged."
  ],
  "permanent_layering_rule": "Alpha layers must force 28 pair-week directions. Risk/portfolio layers may later trade fewer than 28, but the shadow ledger must retain all 28 signal outcomes."
}
```

## Duplicate Decision Surface

`D_COT_PARENT_STRENGTH_HEALTHY_OVERRIDE` is expected to collapse to Candidate C if the predeclared healthy-state override is identical to Strength-healthy/COT-fallback. Duplicate status is recorded in the candidate summaries and promotion screen.

## Dirty Tree

- Run-time git commit: `4369aff0f3be1596ddcf0294b8444d307f3f0318`
- Working tree status: `dirty`
- M docs/backlog/CURRENT_WORK.md
- M package.json
- ?? docs/research/gates/gate58c/GATE58C_FORCED28_COT_STRENGTH_DIRECTIONAL_ARBITRATION_LOCK_TEST_2026-06-27.md
- ?? docs/research/gates/gate58c/artifacts/gate58c-forced28-directional-arbitration/gate58c-forced28-directional-arbitration.decisions.jsonl
- ?? docs/research/gates/gate58c/artifacts/gate58c-forced28-directional-arbitration/gate58c-forced28-directional-arbitration.sha256.txt
- ?? engine/scripts/verification/build-gate58c-forced28-directional-arbitration.ts

## Command

`C:\Users\User\AppData\Local\Volta\tools\image\node\24.8.0\node.exe C:\Users\User\Documents\GitHub\limni-website\engine\scripts\verification\build-gate58c-forced28-directional-arbitration.ts`

## Stop Line

Stop here. Gate 58C is a forced-28 directional arbitration lock test only. Do not proceed to regimes, risk overlays, execution work, MT5/live, app work, or cleanup.

Runtime seconds: 8.9

Report hash: `64E6A6B2FC4296F8CC1C55F012A29D3FD82CA0E6B9CC7619156268F3F8B3074A`
