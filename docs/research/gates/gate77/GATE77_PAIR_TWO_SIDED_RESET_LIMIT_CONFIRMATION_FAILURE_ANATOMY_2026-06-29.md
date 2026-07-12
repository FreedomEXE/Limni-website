# Gate 77 Pair Two-Sided Reset-Limit Confirmation And Failure Anatomy

Generated: `2026-06-29T21:50:38.634Z`

## Verdict

`PASS_GATE77_PAIR_TWO_SIDED_RESET_LIMIT_CONFIRMATION_FAILURE_ANATOMY__PAIR_LIMIT3_PROMISING_RESEARCH_ONLY_NO_PROMOTION`

## Scope

- Confirms whether Gate 76 pair-level reset-limit behavior is structurally real or just an in-sample compromise.
- Uses a small fixed matrix only: spacing 0.2 ADR, no-limit targets 0.75/1.25/1.5, reset limits 2/3/5 at target 0.75, and target 1.0/1.25 reset-limit-3 structure checks.
- Reproduces the Gate 74E adverse-only focus and the Gate 76 key rows before comparison.
- Does not run account reset families, Gate 75B, costs, risk/correlation pruning, pair/date exclusions, source mutation, Brain mutation, MT5/live/app/runtime, or promotion.

## Adapter Ranking

| rule_id | family | closed | equity | eq_pf | dd | open | worst1 | worst5 | worst13 | neg_years | profitable_week_rate | top20 | recovery | flip_loss | resets | fills | adverse | expansion |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| WEEKLY_FORCED_CLOSE | control | 638.115405 | 638.115405 | 1.414187 | -116.795157 | 0 | -31.994789 | -137.015712 | -314.610634 | 1 | 0.520107 | 1 | 0.5075 | 0 | 0 | 10444 | 0 | 0 |
| CARRY_UNTIL_FLIP | control | 694.688146 | 597.519846 | 1.349786 | -167.030217 | -97.1683 | -36.95747 | -159.788796 | -361.898348 | 2 | 0.509383 | 0.988383 | 0 | -963.436728 | 0 | 902 | 0 | 0 |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP | adverse_only_pair_net_grid | 14381.312614 | 9901.156008 | 1.254319 | -5462.545131 | -4480.156606 | -1582.117861 | -6462.22487 | -12815.828748 | 1 | 0.533512 | 16.1365 | 0.967986 | -10815.950986 | 28300 | 124689 | 95487 | 0 |
| PAIR_TWO_SIDED_GRID_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP | pair_directional_two_sided_grid | 16533.995903 | 10836.846159 | 1.250324 | -7612.54898 | -5697.149744 | -1526.321325 | -7285.46436 | -14806.420145 | 2 | 0.533512 | 17.802632 | 0.972085 | -13910.126902 | 33186 | 168503 | 99405 | 35010 |
| PAIR_TWO_SIDED_GRID_TARGET_125_SPACING_020_RESTART_UNTIL_FLIP | pair_directional_two_sided_grid | 17662.466534 | 11966.236998 | 1.277206 | -7631.558665 | -5696.229536 | -1571.223897 | -7342.466485 | -14809.528464 | 2 | 0.552279 | 18.173582 | 0.958284 | -14393.111684 | 21697 | 141756 | 84709 | 34448 |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP | pair_directional_two_sided_grid | 18012.423714 | 12295.79489 | 1.282295 | -7565.450203 | -5716.628824 | -1570.62905 | -7361.455451 | -14861.678507 | 2 | 0.544236 | 18.703482 | 0.951924 | -14668.815258 | 18703 | 129588 | 79815 | 30168 |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_2_PAIR_RESETS_WEEK | pair_reset_limit | 10518.784081 | 10137.547558 | 1.619273 | -1394.242003 | -381.236523 | -1029.767911 | -3101.053276 | -5679.524769 | 1 | 0.61126 | 6.237548 | 0.988665 | -3789.579526 | 16275 | 80554 | 47416 | 16693 |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | pair_reset_limit | 14021.947533 | 11713.727501 | 1.51746 | -1811.737115 | -2308.220032 | -1139.447341 | -4088.571521 | -7753.393942 | 1 | 0.613941 | 9.623613 | 0.984877 | -5132.272395 | 21658 | 107731 | 63510 | 22252 |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_5_PAIR_RESETS_WEEK | pair_reset_limit | 14173.47334 | 10472.909752 | 1.304058 | -5638.379015 | -3700.563588 | -1498.189769 | -6186.019208 | -12074.43544 | 1 | 0.565684 | 14.278195 | 0.97835 | -10775.531366 | 27945 | 140121 | 82882 | 28716 |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | pair_reset_limit | 16124.084275 | 13772.999764 | 1.561828 | -1989.442654 | -2351.084511 | -1151.146735 | -4601.201676 | -8525.307355 | 1 | 0.595174 | 11.769378 | 0.978224 | -6297.282489 | 19367 | 106080 | 65843 | 20468 |
| PAIR_TWO_SIDED_GRID_T125_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | pair_reset_limit | 17485.463669 | 13018.163434 | 1.440649 | -4074.085132 | -4467.300235 | -1333.160859 | -5596.939385 | -10061.81341 | 1 | 0.592493 | 13.394478 | 0.970286 | -7245.973831 | 17218 | 110454 | 66112 | 26629 |

## Failure Anatomy

| comparison_role | candidate_rule_id | baseline_no_limit_rule_id | helped_week_count | hurt_week_count | net_equity_delta_vs_no_limit_adr | closed_delta_vs_no_limit_adr | max_drawdown_improvement_vs_no_limit_adr | final_open_improvement_vs_no_limit_adr | flip_loss_improvement_vs_no_limit_adr | top20_winner_retention_loss_vs_no_limit_adr |
|---|---|---|---|---|---|---|---|---|---|---|
| gate76_t075_reset_limit_2_vs_same_target_no_limit | PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_2_PAIR_RESETS_WEEK | PAIR_TWO_SIDED_GRID_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP | 187 | 186 | -699.298601 | -6015.211822 | 6218.306977 | 5315.913221 | 10120.547376 | 7950.874979 |
| gate76_t075_reset_limit_3_vs_same_target_no_limit | PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | PAIR_TWO_SIDED_GRID_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP | 198 | 175 | 876.881342 | -2512.04837 | 5800.811865 | 3388.929712 | 8777.854507 | 5622.990655 |
| gate76_t075_reset_limit_5_vs_same_target_no_limit | PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_5_PAIR_RESETS_WEEK | PAIR_TWO_SIDED_GRID_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP | 192 | 181 | -363.936407 | -2360.522563 | 1974.169965 | 1996.586156 | 3134.595536 | 2423.013383 |
| structure_t125_reset_limit_3_vs_same_target_no_limit | PAIR_TWO_SIDED_GRID_T125_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | PAIR_TWO_SIDED_GRID_TARGET_125_SPACING_020_RESTART_UNTIL_FLIP | 194 | 179 | 1051.926436 | -177.002865 | 3557.473533 | 1228.929301 | 7147.137853 | 3285.584562 |

## Interpretation Rule

- Tail concentration is reporting-only and is not a reason to exclude pairs.
- Reset-limit rows are not ranked by final equity or closed PnL alone.
- If reset limits reduce drawdown or open loss by deleting right-tail participation, that is called out in the failure-anatomy artifact.

## Validation

```json
{
  "gate74b_passed": true,
  "gate74e_passed": true,
  "gate75a_passed_and_closed": true,
  "gate75a_matrix_not_executed_by_this_gate": true,
  "manifest_complete": true,
  "warehouse_hash_matches_gate74b_summary": true,
  "candidate_b_forced28_preserved": true,
  "candidate_b_directions_mutated": false,
  "pairs_replayed": 28,
  "audnzd_excluded": false,
  "weeks_replayed": 373,
  "expected_weeks_replayed": 373,
  "pair_week_rows_replayed": 10444,
  "fixed_rule_count": 11,
  "pair_two_sided_target_count": 3,
  "optional_1_5_target_included": true,
  "account_reset_target_count": 0,
  "pair_reset_limit_variant_count": 5,
  "account_level_replay_started": false,
  "pair_series_only_account_reset_claim_started": false,
  "unbounded_parameter_search_started": false,
  "costs_applied": false,
  "spread_slippage_swap_commission_applied": false,
  "risk_layer_started": false,
  "correlation_pruning_started": false,
  "pair_pruning_started": false,
  "fair_value_pruning_started": false,
  "exit_promotion_started": false,
  "mt5_live_runtime_started": false,
  "app_runtime_started": false,
  "brain_truth_mutated": false,
  "source_mutation_started": false,
  "candidate_c_promotion_started": false,
  "candidate_d_retest_started": false,
  "candidate_e_started": false,
  "alpha_v2_started": false,
  "focus_closed_matches_gate74e": true,
  "focus_equity_matches_gate74e": true,
  "focus_open_matches_gate74e": true,
  "focus_drawdown_matches_gate74e": true,
  "focus_flip_loss_matches_gate74e": true,
  "gate76_best_no_limit_t150_reproduced": true,
  "gate76_pair_reset_limit3_reproduced": true,
  "gate76_key_rows_reproduced_before_comparison": true,
  "closed_and_equity_reported_side_by_side": true
}
```

## Artifacts

- adapterSummaryRows: `docs/research/gates/gate77/artifacts/gate77-pair-two-sided-reset-limit-confirmation-failure-anatomy/adapter-summary.rows.json`
- weeklyEquityRows: `docs/research/gates/gate77/artifacts/gate77-pair-two-sided-reset-limit-confirmation-failure-anatomy/weekly-equity-truth.rows.json`
- annualRows: `docs/research/gates/gate77/artifacts/gate77-pair-two-sided-reset-limit-confirmation-failure-anatomy/annual-summary.rows.json`
- expansionAttributionRows: `docs/research/gates/gate77/artifacts/gate77-pair-two-sided-reset-limit-confirmation-failure-anatomy/expansion-attribution-vs-adverse-focus.rows.json`
- fillSideAttributionRows: `docs/research/gates/gate77/artifacts/gate77-pair-two-sided-reset-limit-confirmation-failure-anatomy/fill-side-attribution.rows.json`
- failureAnatomyRows: `docs/research/gates/gate77/artifacts/gate77-pair-two-sided-reset-limit-confirmation-failure-anatomy/failure-anatomy.rows.json`
- resetCountWeeklyRows: `docs/research/gates/gate77/artifacts/gate77-pair-two-sided-reset-limit-confirmation-failure-anatomy/reset-count-week.rows.json`
- resetCountPairRows: `docs/research/gates/gate77/artifacts/gate77-pair-two-sided-reset-limit-confirmation-failure-anatomy/reset-count-pair.rows.json`
- tailConcentrationPairRows: `docs/research/gates/gate77/artifacts/gate77-pair-two-sided-reset-limit-confirmation-failure-anatomy/tail-concentration-pair.rows.json`
- tailConcentrationCurrencyRows: `docs/research/gates/gate77/artifacts/gate77-pair-two-sided-reset-limit-confirmation-failure-anatomy/tail-concentration-currency.rows.json`
- commandReceipt: `docs/research/gates/gate77/artifacts/gate77-pair-two-sided-reset-limit-confirmation-failure-anatomy/command-receipt.json`
- summaryJson: `docs/research/gates/gate77/artifacts/gate77-pair-two-sided-reset-limit-confirmation-failure-anatomy/gate77-summary.json`
- shaIdentity: `docs/research/gates/gate77/artifacts/gate77-pair-two-sided-reset-limit-confirmation-failure-anatomy/gate77-sha256.txt`
- report: `docs/research/gates/gate77/GATE77_PAIR_TWO_SIDED_RESET_LIMIT_CONFIRMATION_FAILURE_ANATOMY_2026-06-29.md`

## Stop Line

Gate 77 is confirmation and failure anatomy only. Do not promote, start robustness, costs, risk, pair pruning, Gate 75B, Gate 78, MT5/live, app/runtime, retuning, or source mutation unless Freedom explicitly opens the next scope.
