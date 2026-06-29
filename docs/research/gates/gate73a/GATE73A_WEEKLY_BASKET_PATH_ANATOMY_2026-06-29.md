# Gate 73A Weekly Basket Path Anatomy

Generated: `2026-06-29T00:37:56.879Z`

## Verdict

`PASS_GATE73A_WEEKLY_BASKET_PATH_ANATOMY__RIGHT_TAIL_AND_GIVEBACK_PROFILE_VISIBLE`

## Scope

- Uses Gate 71B basket path diagnostics and Gate 71C/72C exit result ledgers.
- Classifies weekly basket paths and measures MFE, MAE, giveback, time-to-extreme, threshold hits, right-tail dependency, and shortlist attribution.
- Does not introduce new exit rules, optimize thresholds, promote exits, or open risk/live work.

## Classification Summary

| primary_class | weeks | rate | total_weekly_hold_adr | average_weekly_hold_adr | average_mfe_adr | average_mae_adr | average_giveback_adr |
|---|---|---|---|---|---|---|---|
| green_then_giveback | 222 | 0.595174 | -1183.85448 | -5.332678 | 6.765667 | -10.340071 | 12.098344 |
| clean_winner | 50 | 0.134048 | 667.276689 | 13.345534 | 14.961789 | -3.799911 | 1.616255 |
| mixed_or_neutral | 48 | 0.128686 | 313.389799 | 6.528954 | 13.503791 | -6.123448 | 6.974837 |
| volatile_recovery | 26 | 0.069705 | 258.882005 | 9.957 | 13.063961 | -6.425688 | 3.10696 |
| monster_trend | 20 | 0.053619 | 687.48965 | 34.374483 | 39.789995 | -4.899558 | 5.415512 |
| never_green_loser | 7 | 0.018767 | -105.068265 | -15.009752 | 0.044829 | -20.527898 | 15.054581 |

## Key Finding

Top 20 weekly-hold winners contribute 1.077375x total net ADR, while green-then-giveback weeks occur at 0.595174. This supports runner-preserving profit protection rather than fixed close-all targets.

## Validation

```json
{
  "diagnostics_weeks": 373,
  "expected_weeks": 373,
  "weekly_hold_rows": 373,
  "shortlist_rule_count": 4,
  "raw_m1_rebuild_performed": false,
  "new_exit_rules_scored": false,
  "exit_promotion_performed": false,
  "risk_layer_started": false,
  "classified_week_count": 373,
  "class_summary_count": 6,
  "top20_share_of_total_net_adr": 1.077375,
  "green_then_giveback_rate": 0.595174,
  "volatile_recovery_rate": 0.120643,
  "late_runner_rate": 0.005362
}
```

## Recommendation

```json
{
  "next_gate_recommendation": "Gate 73B: runner-preserving-profit-protection-design",
  "recommended_matrix_direction": [
    "no hard TP as the default next test",
    "delayed activation trails such as +1.25/+0.25, +1.50/+0.50, +2.00/+0.75",
    "peak-distance trailing after meaningful profit rather than fixed close-all targets",
    "wide or absent adverse stops until volatile recovery is quantified more tightly"
  ],
  "notes": [
    "Do not run another broad fixed-target matrix yet.",
    "Next exit matrix should preserve right-tail weeks and test profit protection without hard caps.",
    "Top-winner dependency is high; hard profit targets are structurally dangerous unless paired with a runner-preservation rule.",
    "Green-then-giveback support is high enough to justify delayed/wider basket profit-floor trailing tests."
  ]
}
```

## Artifacts

- Weekly classification ledger: `docs/research/gates/gate73a/artifacts/gate73a-weekly-basket-path-anatomy/weekly-path-classification.rows.jsonl`
- Path anatomy percentiles: `docs/research/gates/gate73a/artifacts/gate73a-weekly-basket-path-anatomy/path-anatomy-percentiles.json`
- Threshold anatomy: `docs/research/gates/gate73a/artifacts/gate73a-weekly-basket-path-anatomy/threshold-hit-anatomy.json`
- Top-winner dependency: `docs/research/gates/gate73a/artifacts/gate73a-weekly-basket-path-anatomy/top-winner-dependency.json`
- Shortlist attribution: `docs/research/gates/gate73a/artifacts/gate73a-weekly-basket-path-anatomy/shortlist-vs-weekly-hold-attribution.json`
- Summary: `docs/research/gates/gate73a/artifacts/gate73a-weekly-basket-path-anatomy/gate73a-summary.json`
- SHA identity: `docs/research/gates/gate73a/artifacts/gate73a-weekly-basket-path-anatomy/gate73a-sha256.txt`
