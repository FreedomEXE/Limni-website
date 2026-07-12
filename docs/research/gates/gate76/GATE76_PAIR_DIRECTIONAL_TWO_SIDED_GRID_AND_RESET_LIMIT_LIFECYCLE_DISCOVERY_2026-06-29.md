# Gate 76 Pair Directional Two-Sided Grid And Reset-Limit Lifecycle Discovery

Generated: `2026-06-29T20:31:17.685Z`

## Verdict

`PASS_GATE76_PAIR_DIRECTIONAL_TWO_SIDED_GRID_RESET_LIMIT_DISCOVERY__RECOVERY_EXPANSION_AND_ACCOUNT_RESET_LIFECYCLE_VISIBLE_NO_PROMOTION`

## Scope

- Tests a first-pass directional two-sided grid that adds adverse recovery fills and favorable expansion fills in the immutable Candidate B direction.
- Tests exact close-mark account-level reset targets and reset-limit variants using a synchronized all-pair replay built from the Gate 74B pair-week path warehouse.
- Compares directly against the Gate 74E adverse-only focus baseline.
- Does not amend Gate 75A, promote exits, start risk/correlation pruning, add costs, mutate Candidate B, mutate sources, or touch MT5/live/app/runtime.

## Adapter Ranking

| rule_id | family | closed | equity | eq_pf | dd | open | top20 | recovery | flip_loss | resets | fills | adverse | expansion |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| WEEKLY_FORCED_CLOSE | control | 638.115405 | 638.115405 | 1.414187 | -116.795157 | 0 | 1 | 0.5075 | 0 | 0 | 10444 | 0 | 0 |
| CARRY_UNTIL_FLIP | control | 694.688146 | 597.519846 | 1.349786 | -167.030217 | -97.1683 | 0.988383 | 0 | -963.436728 | 0 | 902 | 0 | 0 |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP | adverse_only_pair_net_grid | 14381.312614 | 9901.156008 | 1.254319 | -5462.545131 | -4480.156606 | 16.1365 | 0.967986 | -10815.950986 | 28300 | 124689 | 95487 | 0 |
| PAIR_TWO_SIDED_GRID_TARGET_050_SPACING_020_RESTART_UNTIL_FLIP | pair_directional_two_sided_grid | 16148.233051 | 10469.206797 | 1.248155 | -7773.850285 | -5679.026254 | 16.844303 | 0.979745 | -13021.844183 | 46399 | 186641 | 112184 | 27156 |
| PAIR_TWO_SIDED_GRID_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP | pair_directional_two_sided_grid | 16533.995903 | 10836.846159 | 1.250324 | -7612.54898 | -5697.149744 | 17.802632 | 0.972085 | -13910.126902 | 33186 | 168503 | 99405 | 35010 |
| PAIR_TWO_SIDED_GRID_TARGET_100_SPACING_020_RESTART_UNTIL_FLIP | pair_directional_two_sided_grid | 17086.494473 | 11379.952114 | 1.263779 | -7611.403172 | -5706.542359 | 18.05515 | 0.965084 | -14192.508651 | 26161 | 146750 | 90902 | 28785 |
| PAIR_TWO_SIDED_GRID_TARGET_125_SPACING_020_RESTART_UNTIL_FLIP | pair_directional_two_sided_grid | 17662.466534 | 11966.236998 | 1.277206 | -7631.558665 | -5696.229536 | 18.173582 | 0.958284 | -14393.111684 | 21697 | 141756 | 84709 | 34448 |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP | pair_directional_two_sided_grid | 18012.423714 | 12295.79489 | 1.282295 | -7565.450203 | -5716.628824 | 18.703482 | 0.951924 | -14668.815258 | 18703 | 129588 | 79815 | 30168 |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_1_PAIR_RESETS_WEEK | pair_reset_limit | 5635.153165 | 5508.318888 | 1.525584 | -1240.1741 | -126.834277 | 2.211099 | 0.990562 | -2290.803707 | 9148 | 44932 | 26328 | 9380 |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_2_PAIR_RESETS_WEEK | pair_reset_limit | 10518.784081 | 10137.547558 | 1.619273 | -1394.242003 | -381.236523 | 6.237548 | 0.988665 | -3789.579526 | 16275 | 80554 | 47416 | 16693 |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | pair_reset_limit | 14021.947533 | 11713.727501 | 1.51746 | -1811.737115 | -2308.220032 | 9.623613 | 0.984877 | -5132.272395 | 21658 | 107731 | 63510 | 22252 |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_5_PAIR_RESETS_WEEK | pair_reset_limit | 14173.47334 | 10472.909752 | 1.304058 | -5638.379015 | -3700.563588 | 14.278195 | 0.97835 | -10775.531366 | 27945 | 140121 | 82882 | 28716 |
| ACCOUNT_TWO_SIDED_GRID_RESET_TARGET_100_SPACING_020 | account_reset_target | 5458.882914 | 1067.385259 | 1.044573 | -6511.502354 | -4391.497655 | 6.328169 | 0.560255 | -6309.577362 | 148820 | 304583 | 96087 | 58774 |
| ACCOUNT_TWO_SIDED_GRID_RESET_TARGET_150_SPACING_020 | account_reset_target | 5748.952412 | 1357.454757 | 1.056034 | -6511.502354 | -4391.497655 | 6.488214 | 0.572358 | -6391.345106 | 108500 | 262202 | 92411 | 60389 |
| ACCOUNT_TWO_SIDED_GRID_RESET_TARGET_200_SPACING_020 | account_reset_target | 5982.618712 | 1591.121057 | 1.065976 | -6511.502354 | -4391.497655 | 6.595382 | 0.57883 | -6326.165601 | 87640 | 239433 | 89839 | 61052 |
| ACCOUNT_TWO_SIDED_GRID_RESET_TARGET_300_SPACING_020 | account_reset_target | 6262.893813 | 1819.37303 | 1.07472 | -6577.847171 | -4443.520783 | 6.59586 | 0.584572 | -6505.599725 | 63168 | 207871 | 83921 | 59880 |
| ACCOUNT_TWO_SIDED_GRID_T150_S020_STOP_AFTER_1_ACCOUNT_RESETS_WEEK | account_reset_limit | 681.263007 | 681.263007 | 2.071081 | -277.290614 | 0 | 0.080673 | 0.558926 | -40.032126 | 10332 | 24281 | 8360 | 5574 |
| ACCOUNT_TWO_SIDED_GRID_T150_S020_STOP_AFTER_2_ACCOUNT_RESETS_WEEK | account_reset_limit | 1409.996697 | 1409.996697 | 2.161018 | -277.290614 | 0 | 0.145133 | 0.57246 | -61.166196 | 20440 | 48213 | 16681 | 11057 |
| ACCOUNT_TWO_SIDED_GRID_T150_S020_STOP_AFTER_3_ACCOUNT_RESETS_WEEK | account_reset_limit | 2544.093812 | 2521.967529 | 2.206997 | -663.692511 | -22.126283 | 0.370058 | 0.57242 | -84.69498 | 29960 | 70944 | 24608 | 16322 |
| ACCOUNT_TWO_SIDED_GRID_T150_S020_STOP_AFTER_5_ACCOUNT_RESETS_WEEK | account_reset_limit | 3707.157452 | 3685.031169 | 1.983719 | -663.692511 | -22.126283 | 0.915075 | 0.574134 | -403.627774 | 47572 | 114700 | 40339 | 26618 |

## Expansion Attribution Versus Gate 74E Focus

| rule_id | target_adr | closed_delta_vs_adverse_focus | final_equity_delta_vs_adverse_focus | max_drawdown_delta_vs_adverse_focus | final_open_delta_vs_adverse_focus | giveback_delta_vs_adverse_focus | closed_adr_from_recovery_fills | closed_adr_from_expansion_fills | interpretation |
|---|---|---|---|---|---|---|---|---|---|
| PAIR_TWO_SIDED_GRID_TARGET_050_SPACING_020_RESTART_UNTIL_FLIP | 0.5 | 1766.920437 | 568.050789 | -2311.305154 | -1198.869648 | 2137.558584 | 13956.659285 | 1490.482759 | expansion_not_superior_to_adverse_focus_on_first_pass |
| PAIR_TWO_SIDED_GRID_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP | 0.75 | 2152.683289 | 935.690151 | -2150.003849 | -1216.993138 | 3118.793777 | 14311.377119 | 1523.205823 | expansion_not_superior_to_adverse_focus_on_first_pass |
| PAIR_TWO_SIDED_GRID_TARGET_100_SPACING_020_RESTART_UNTIL_FLIP | 1 | 2705.181859 | 1478.796106 | -2148.858041 | -1226.385753 | 3469.882671 | 14715.912603 | 1665.38408 | expansion_not_superior_to_adverse_focus_on_first_pass |
| PAIR_TWO_SIDED_GRID_TARGET_125_SPACING_020_RESTART_UNTIL_FLIP | 1.25 | 3281.15392 | 2065.08099 | -2169.013534 | -1216.07293 | 3760.613269 | 15053.409654 | 1902.009873 | expansion_not_superior_to_adverse_focus_on_first_pass |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP | 1.5 | 3631.1111 | 2394.638882 | -2102.905072 | -1236.472218 | 4126.526781 | 15606.245343 | 1707.215318 | expansion_not_superior_to_adverse_focus_on_first_pass |

## Synchronized Account Replay

- Account reset rows are not pair-series approximations. They are replayed by week on a unioned close-mark timestamp clock across all 28 Candidate B pairs.
- Account-level reset target rows close all active pair cycles together when account net ADR reaches the target, then restart unless a reset-limit rule stops reentry for the week.
- Locked or floating loss remains visible in mark-to-market equity accounting.

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
  "fixed_rule_count": 20,
  "pair_two_sided_target_count": 5,
  "optional_1_5_target_included": true,
  "account_reset_target_count": 4,
  "reset_limit_variant_count": 8,
  "account_synchronized_close_mark_replay_built": true,
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
  "closed_and_equity_reported_side_by_side": true
}
```

## Artifacts

- adapterSummaryRows: `docs/research/gates/gate76/artifacts/gate76-pair-directional-two-sided-grid-reset-limit-lifecycle-discovery/adapter-summary.rows.json`
- weeklyEquityRows: `docs/research/gates/gate76/artifacts/gate76-pair-directional-two-sided-grid-reset-limit-lifecycle-discovery/weekly-equity-truth.rows.json`
- annualRows: `docs/research/gates/gate76/artifacts/gate76-pair-directional-two-sided-grid-reset-limit-lifecycle-discovery/annual-summary.rows.json`
- expansionAttributionRows: `docs/research/gates/gate76/artifacts/gate76-pair-directional-two-sided-grid-reset-limit-lifecycle-discovery/expansion-attribution-vs-adverse-focus.rows.json`
- fillSideAttributionRows: `docs/research/gates/gate76/artifacts/gate76-pair-directional-two-sided-grid-reset-limit-lifecycle-discovery/fill-side-attribution.rows.json`
- resetCountWeeklyRows: `docs/research/gates/gate76/artifacts/gate76-pair-directional-two-sided-grid-reset-limit-lifecycle-discovery/reset-count-week.rows.json`
- resetCountPairRows: `docs/research/gates/gate76/artifacts/gate76-pair-directional-two-sided-grid-reset-limit-lifecycle-discovery/reset-count-pair.rows.json`
- tailConcentrationPairRows: `docs/research/gates/gate76/artifacts/gate76-pair-directional-two-sided-grid-reset-limit-lifecycle-discovery/tail-concentration-pair.rows.json`
- tailConcentrationCurrencyRows: `docs/research/gates/gate76/artifacts/gate76-pair-directional-two-sided-grid-reset-limit-lifecycle-discovery/tail-concentration-currency.rows.json`
- commandReceipt: `docs/research/gates/gate76/artifacts/gate76-pair-directional-two-sided-grid-reset-limit-lifecycle-discovery/command-receipt.json`
- summaryJson: `docs/research/gates/gate76/artifacts/gate76-pair-directional-two-sided-grid-reset-limit-lifecycle-discovery/gate76-summary.json`
- shaIdentity: `docs/research/gates/gate76/artifacts/gate76-pair-directional-two-sided-grid-reset-limit-lifecycle-discovery/gate76-sha256.txt`
- report: `docs/research/gates/gate76/GATE76_PAIR_DIRECTIONAL_TWO_SIDED_GRID_AND_RESET_LIMIT_LIFECYCLE_DISCOVERY_2026-06-29.md`

## Stop Line

Gate 76 is research evidence only. Do not promote, start risk, add costs, prune pairs, mutate signals, or start MT5/live/app/runtime work unless Freedom explicitly opens the next scope.
