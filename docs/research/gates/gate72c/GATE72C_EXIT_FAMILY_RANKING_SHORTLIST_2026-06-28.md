# Gate 72C Exit Family Ranking / Shortlist

Generated: `2026-06-29T00:16:59.847Z`

## Verdict

`PASS_GATE72C_EXIT_FAMILY_RANKING_SHORTLIST__NO_CLEAN_PROMOTION_CANDIDATE`

## Scope

- Reviews the full Gate 71C result ledger after Gate 72A/72B integrity checks.
- Ranks predeclared exit rules by profitable-week lift with explicit tail, total ADR, and year-stability constraints.
- Produces a research shortlist only. No exit is promoted.

## Objective

`maximize profitable-week rate subject to no tail-risk degradation, no total-ADR collapse, and no year/regime concentration`

Gate 72C evaluates year stability but does not evaluate regime concentration because no regime labels or filters are introduced in this gate.

## Validation

```json
{
  "gate72b_passed": true,
  "candidate_summary_count": 34,
  "review_shortlist_count": 4,
  "family_coverage": {
    "basket_profit_floor_trailing": true,
    "global_close_all_stop_week": true,
    "global_target_plus_adverse_stop": true,
    "trail_plus_hard_tp": true
  },
  "promotion_eligible_count": 0,
  "no_clean_rule_passes_all_constraints": true,
  "total_adr_collapse_threshold": "clean exit total ADR must be at least 50 percent of weekly-hold total ADR for promotion consideration",
  "year_stability_threshold": "negative year count must be no worse than weekly hold for promotion consideration",
  "regime_concentration_evaluated": false,
  "exit_promotion_performed": false,
  "risk_layer_started": false
}
```

## Shortlist

| rule_id | family | win_rate | total_adr | adr_retention | max_dd | worst_week | neg_years | class | blockers |
|---|---|---|---|---|---|---|---|---|---|
| TRAIL_TP_A100_F050_T200 | trail plus hard TP | 0.914209 | 45.849583 | 0.071852 | -67.51491 | -31.994788 | 3 | review_shortlist | total_adr_below_50pct_of_weekly_hold, negative_year_count_worse_than_weekly_hold |
| GLOBAL_TP_125_STOP_WEEK | global close-all target | 0.911528 | 79.591558 | 0.124729 | -74.934821 | -31.994788 | 4 | review_shortlist | total_adr_below_50pct_of_weekly_hold, negative_year_count_worse_than_weekly_hold |
| TRAIL_A075_F025 | basket profit-floor trailing | 0.871314 | 173.491049 | 0.27188 | -39.228258 | -31.994788 | 3 | review_shortlist | total_adr_below_50pct_of_weekly_hold, negative_year_count_worse_than_weekly_hold |
| GLOBAL_TP_050_STOP_200 | global target plus adverse stop | 0.809651 | 31.070777 | 0.048691 | -11.79483 | -2.329995 | 3 | review_shortlist | total_adr_below_50pct_of_weekly_hold, negative_year_count_worse_than_weekly_hold |

## Ranking Summary

```json
{
  "weekly_hold_control": {
    "rule_id": "CONTROL_WEEKLY_HOLD",
    "family": "control",
    "profitable_week_rate": 0.520107,
    "total_adr": 638.115398,
    "adr_retention_vs_weekly_hold": 1,
    "max_drawdown_adr": -116.795153,
    "worst_week_adr": -31.994788,
    "negative_years": 1,
    "return_to_drawdown": 5.463543,
    "review_classification": "baseline_control",
    "promotion_eligible": false,
    "disqualification_reasons": [
      "baseline_control_not_exit_candidate",
      "no_profitable_week_rate_lift"
    ]
  },
  "legacy_adr_grid_control": {
    "rule_id": "CONTROL_LEGACY_ADR_GRID",
    "family": "control",
    "profitable_week_rate": 0.683646,
    "total_adr": 2341.080708,
    "adr_retention_vs_weekly_hold": 3.668742,
    "max_drawdown_adr": -241.508971,
    "worst_week_adr": -184.530498,
    "negative_years": 1,
    "return_to_drawdown": 9.693556,
    "review_classification": "coupled_control",
    "promotion_eligible": false,
    "disqualification_reasons": [
      "coupled_entry_exit_control_only",
      "tail_risk_degraded_vs_weekly_hold"
    ]
  },
  "clean_exit_rules_reviewed": 31,
  "review_shortlist_count": 4,
  "promotion_eligible_count": 0,
  "best_clean_by_profitable_week_rate": {
    "rule_id": "GLOBAL_TP_025_STOP_WEEK",
    "family": "global_close_all_stop_week",
    "profitable_week_rate": 0.981233,
    "total_adr": 26.114195,
    "adr_retention_vs_weekly_hold": 0.040924,
    "max_drawdown_adr": -44.726851,
    "worst_week_adr": -31.994788,
    "negative_years": 4,
    "return_to_drawdown": 0.583859,
    "review_classification": "watch_only",
    "promotion_eligible": false,
    "disqualification_reasons": [
      "total_adr_below_50pct_of_weekly_hold",
      "negative_year_count_worse_than_weekly_hold"
    ]
  },
  "best_clean_by_total_adr": {
    "rule_id": "TRAIL_A050_F010",
    "family": "basket_profit_floor_trailing",
    "profitable_week_rate": 0.705094,
    "total_adr": 235.98133,
    "adr_retention_vs_weekly_hold": 0.36981,
    "max_drawdown_adr": -41.857627,
    "worst_week_adr": -31.994788,
    "negative_years": 3,
    "return_to_drawdown": 5.637714,
    "review_classification": "watch_only",
    "promotion_eligible": false,
    "disqualification_reasons": [
      "total_adr_below_50pct_of_weekly_hold",
      "negative_year_count_worse_than_weekly_hold"
    ]
  },
  "best_clean_by_tail_drawdown": {
    "rule_id": "GLOBAL_TP_050_STOP_100",
    "family": "global_target_plus_adverse_stop",
    "profitable_week_rate": 0.705094,
    "total_adr": 34.075536,
    "adr_retention_vs_weekly_hold": 0.0534,
    "max_drawdown_adr": -8.181849,
    "worst_week_adr": -1.6753,
    "negative_years": 2,
    "return_to_drawdown": 4.164772,
    "review_classification": "watch_only",
    "promotion_eligible": false,
    "disqualification_reasons": [
      "total_adr_below_50pct_of_weekly_hold",
      "negative_year_count_worse_than_weekly_hold"
    ]
  },
  "family_shortlist": [
    {
      "rule_id": "TRAIL_TP_A100_F050_T200",
      "family": "trail_plus_hard_tp",
      "profitable_week_rate": 0.914209,
      "total_adr": 45.849583,
      "adr_retention_vs_weekly_hold": 0.071852,
      "max_drawdown_adr": -67.51491,
      "worst_week_adr": -31.994788,
      "negative_years": 3,
      "return_to_drawdown": 0.679103,
      "review_classification": "review_shortlist",
      "promotion_eligible": false,
      "disqualification_reasons": [
        "total_adr_below_50pct_of_weekly_hold",
        "negative_year_count_worse_than_weekly_hold"
      ]
    },
    {
      "rule_id": "GLOBAL_TP_125_STOP_WEEK",
      "family": "global_close_all_stop_week",
      "profitable_week_rate": 0.911528,
      "total_adr": 79.591558,
      "adr_retention_vs_weekly_hold": 0.124729,
      "max_drawdown_adr": -74.934821,
      "worst_week_adr": -31.994788,
      "negative_years": 4,
      "return_to_drawdown": 1.062144,
      "review_classification": "review_shortlist",
      "promotion_eligible": false,
      "disqualification_reasons": [
        "total_adr_below_50pct_of_weekly_hold",
        "negative_year_count_worse_than_weekly_hold"
      ]
    },
    {
      "rule_id": "TRAIL_A075_F025",
      "family": "basket_profit_floor_trailing",
      "profitable_week_rate": 0.871314,
      "total_adr": 173.491049,
      "adr_retention_vs_weekly_hold": 0.27188,
      "max_drawdown_adr": -39.228258,
      "worst_week_adr": -31.994788,
      "negative_years": 3,
      "return_to_drawdown": 4.422604,
      "review_classification": "review_shortlist",
      "promotion_eligible": false,
      "disqualification_reasons": [
        "total_adr_below_50pct_of_weekly_hold",
        "negative_year_count_worse_than_weekly_hold"
      ]
    },
    {
      "rule_id": "GLOBAL_TP_050_STOP_200",
      "family": "global_target_plus_adverse_stop",
      "profitable_week_rate": 0.809651,
      "total_adr": 31.070777,
      "adr_retention_vs_weekly_hold": 0.048691,
      "max_drawdown_adr": -11.79483,
      "worst_week_adr": -2.329995,
      "negative_years": 3,
      "return_to_drawdown": 2.634271,
      "review_classification": "review_shortlist",
      "promotion_eligible": false,
      "disqualification_reasons": [
        "total_adr_below_50pct_of_weekly_hold",
        "negative_year_count_worse_than_weekly_hold"
      ]
    }
  ]
}
```

## Artifacts

- Ranking rows: `docs/research/gates/gate72c/artifacts/gate72c-exit-family-ranking-shortlist/exit-family-ranking.rows.json`
- Review shortlist: `docs/research/gates/gate72c/artifacts/gate72c-exit-family-ranking-shortlist/exit-family-review-shortlist.json`
- Ranking summary: `docs/research/gates/gate72c/artifacts/gate72c-exit-family-ranking-shortlist/exit-family-ranking-summary.json`
- Summary: `docs/research/gates/gate72c/artifacts/gate72c-exit-family-ranking-shortlist/gate72c-summary.json`
- SHA identity: `docs/research/gates/gate72c/artifacts/gate72c-exit-family-ranking-shortlist/gate72c-sha256.txt`

## Strategic Read

The high win-rate rules do what expected: they clip many weeks green. The problem is that clean exit rules still collapse total ADR versus weekly hold, and most worsen year stability. This packet is a shortlist for further review, not a promotion packet.
