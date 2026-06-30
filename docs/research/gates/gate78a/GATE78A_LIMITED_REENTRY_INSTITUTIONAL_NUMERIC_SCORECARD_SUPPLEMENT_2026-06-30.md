# Gate 78A Limited-Reentry Institutional Numeric Scorecard Supplement

Generated: `2026-06-30T02:03:11.138Z`

## Verdict

`PASS_SCORECARD_T100_L3_REMAINS_PRIMARY_CANDIDATE_NO_PROMOTION`

## Scope

- Audit layer only over existing Gate 78 rows.
- No strategy logic, row, parameter, Candidate B, pair universe, source input, exit, rescue, optimization, freeze, risk layer, cost model, MT5/live/app/runtime work, or promotion change.
- Mark-to-market equity is primary. Closed PnL is secondary.
- All results are gross, pre-cost, pre-risk-layer, pre-MT5, pre-promotion research evidence.
- Sharpe and Sortino are ADR-normalized diagnostics, not true investment Sharpe or Sortino.

## Decision

Gate 78A keeps `PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK` as the primary non-reference research candidate. It remains the best real trading-system candidate in this fixed packet because it has the strongest MTM equity among candidate rows while avoiding the no-limit T150 tail and avoiding the runner rows' harvest collapse.

Key T100/L3 values:

- Equity ADR: `13772.999764`
- Closed ADR: `16124.084275`
- Max drawdown ADR: `-1989.442654`
- Weekly MTM PF: `1.561828`
- ADR-Calmar: `0.965143`
- ADR-normalized Sortino: `1.362816`
- Worst 13-week MTM loss ADR: `-8525.307355`
- Final open unrealized ADR: `-2351.084511`

## Candidate Ranking

| rule_id | institutional_label | institutional_candidate_rank | equity_adr | max_drawdown_adr | weekly_mtm_profit_factor | adr_calmar | weekly_mtm_sortino_adr_normalized | worst_13_week_mtm_loss_adr | final_open_unrealized_adr | flip_loss_adr | average_fills_per_week | right_tail_give_up_vs_t150_adr |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | primary candidate | 1 | 13772.999764 | -1989.442654 | 1.561828 | 0.965143 | 1.362816 | -8525.307355 | -2351.084511 | -6297.282489 | 284.396783 | 4767.124605 |
| PAIR_TWO_SIDED_GRID_T125_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | too much tail | 2 | 13018.163434 | -4074.085132 | 1.440649 | 0.445466 | 1.100962 | -10061.81341 | -4467.300235 | -7245.973831 | 296.123324 | 3649.885428 |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | alternate candidate | 3 | 11713.727501 | -1811.737115 | 1.51746 | 0.901352 | 1.273224 | -7753.393942 | -2308.220032 | -5132.272395 | 288.823056 | 6242.315851 |
| PAIR_TWO_SIDED_GRID_T075_S020_L3_FINAL_RESET_RUNNER_050 | too much harvest loss | 4 | 2923.668101 | -602.738028 | 1.569189 | 0.676229 | 1.443515 | -1832.075042 | -205.960941 | -2571.273518 | 39.336461 | 10843.887499 |
| PAIR_TWO_SIDED_GRID_T100_S020_L3_FINAL_RESET_RUNNER_050 | too much harvest loss | 5 | 2651.238026 | -890.894792 | 1.392916 | 0.414875 | 0.986107 | -2437.923542 | -245.538946 | -3522.667491 | 45.107239 | 10700.669226 |
| PAIR_TWO_SIDED_GRID_T075_S020_L3_FINAL_RESET_RUNNER_025 | too much harvest loss | 6 | 2254.07738 | -646.124869 | 1.553754 | 0.486348 | 1.094198 | -1799.829669 | -103.027711 | -1810.801341 | 39.409517 | 11578.48275 |
| PAIR_TWO_SIDED_GRID_T100_S020_L3_FINAL_RESET_RUNNER_025 | too much harvest loss | 7 | 2057.524025 | -773.468845 | 1.35852 | 0.370849 | 0.733317 | -2363.255967 | -123.844837 | -2782.341696 | 45.180965 | 11419.233294 |
| PAIR_TWO_SIDED_GRID_T125_S020_L3_FINAL_RESET_RUNNER_050 | reject | 8 | 409.620619 | -4211.915285 | 1.031823 | 0.013558 | 0.062301 | -5619.542302 | -3314.542721 | -4131.530684 | 54.597855 | 10458.068405 |

## Row Classification

| rule_id | institutional_label | institutional_reason | equity_adr | max_drawdown_adr | weekly_mtm_profit_factor | final_open_unrealized_adr |
|---|---|---|---|---|---|---|
| WEEKLY_FORCED_CLOSE | reference only | control row, not an exit candidate | 638.115405 | -116.795157 | 1.414187 | 0 |
| CARRY_UNTIL_FLIP | reference only | control row, not an exit candidate | 597.519846 | -167.030217 | 1.349786 | -97.1683 |
| PAIR_NET_GRID_CYCLE_TARGET_075_SPACING_020_RESTART_UNTIL_FLIP | conservative reference | adverse-only discovery baseline retains harvest but carries large floating tail | 9901.156008 | -5462.545131 | 1.254319 | -4480.156606 |
| PAIR_TWO_SIDED_GRID_TARGET_150_SPACING_020_RESTART_UNTIL_FLIP | aggressive reference | no-limit two-sided reference has right-tail upside but excessive tail/open-loss behavior | 12295.79489 | -7565.450203 | 1.282295 | -5716.628824 |
| PAIR_TWO_SIDED_GRID_T075_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | alternate candidate | lower equity than T100/L3 but cleaner drawdown and flip-loss profile | 11713.727501 | -1811.737115 | 1.51746 | -2308.220032 |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | primary candidate | best non-reference MTM equity with controlled drawdown versus T150 and no runner harvest collapse | 13772.999764 | -1989.442654 | 1.561828 | -2351.084511 |
| PAIR_TWO_SIDED_GRID_T125_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | too much tail | higher closed harvest than T100/L3 but worse drawdown, open loss, and rolling loss behavior | 13018.163434 | -4074.085132 | 1.440649 | -4467.300235 |
| PAIR_TWO_SIDED_GRID_T075_S020_L3_FINAL_RESET_RUNNER_025 | too much harvest loss | runner row improves surface risk but gives up too much MTM equity and right-tail retention | 2254.07738 | -646.124869 | 1.553754 | -103.027711 |
| PAIR_TWO_SIDED_GRID_T075_S020_L3_FINAL_RESET_RUNNER_050 | too much harvest loss | runner row improves surface risk but gives up too much MTM equity and right-tail retention | 2923.668101 | -602.738028 | 1.569189 | -205.960941 |
| PAIR_TWO_SIDED_GRID_T100_S020_L3_FINAL_RESET_RUNNER_025 | too much harvest loss | runner row improves surface risk but gives up too much MTM equity and right-tail retention | 2057.524025 | -773.468845 | 1.35852 | -123.844837 |
| PAIR_TWO_SIDED_GRID_T100_S020_L3_FINAL_RESET_RUNNER_050 | too much harvest loss | runner row improves surface risk but gives up too much MTM equity and right-tail retention | 2651.238026 | -890.894792 | 1.392916 | -245.538946 |
| PAIR_TWO_SIDED_GRID_T125_S020_L3_FINAL_RESET_RUNNER_025 | reject | runner row fails MTM equity and does not earn candidate status | -281.902214 | -4028.764559 | 0.976202 | -3216.328756 |
| PAIR_TWO_SIDED_GRID_T125_S020_L3_FINAL_RESET_RUNNER_050 | reject | runner row fails MTM equity and does not earn candidate status | 409.620619 | -4211.915285 | 1.031823 | -3314.542721 |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK_ACCOUNT_EMERGENCY_SL_3ADR | reference only | emergency-SL row is diagnostic only and clips harvest | 321.064729 | -261.64547 | 1.271227 | 0 |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK_ACCOUNT_EMERGENCY_SL_5ADR | reference only | emergency-SL row is diagnostic only and clips harvest | -2.262084 | -416.424575 | 0.99877 | 0 |
| PAIR_TWO_SIDED_GRID_T075_S020_L3_FINAL_RESET_RUNNER_050_ACCOUNT_EMERGENCY_SL_3ADR | reference only | emergency-SL row is diagnostic only and clips harvest | 296.337801 | -198.162535 | 1.195601 | 0 |
| PAIR_TWO_SIDED_GRID_T075_S020_L3_FINAL_RESET_RUNNER_050_ACCOUNT_EMERGENCY_SL_5ADR | reference only | emergency-SL row is diagnostic only and clips harvest | 81.829163 | -439.603461 | 1.040528 | 0 |

## Runner Audit

| rule_id | runner_fraction | final_equity_adr | runner_realized_contribution_adr | runner_unrealized_contribution_adr | total_result_excluding_runner_contribution_adr | harvest_loss_vs_base_adr | right_tail_loss_vs_base_adr | interpretation |
|---|---|---|---|---|---|---|---|---|
| PAIR_TWO_SIDED_GRID_T075_S020_L3_FINAL_RESET_RUNNER_025 | 0.25 | 2254.07738 | 1525.226554 | -103.027711 | 1396.60977 | 11664.842442 | 5336.166899 | runner improved selected surface-risk terms but did not beat T100/L3 on institutional MTM scorecard |
| PAIR_TWO_SIDED_GRID_T075_S020_L3_FINAL_RESET_RUNNER_050 | 0.5 | 2923.668101 | 2297.750505 | -205.960941 | 1208.430334 | 10892.318491 | 4601.571648 | runner improved selected surface-risk terms but did not beat T100/L3 on institutional MTM scorecard |
| PAIR_TWO_SIDED_GRID_T100_S020_L3_FINAL_RESET_RUNNER_025 | 0.25 | 2057.524025 | 1607.059318 | -121.621639 | 1240.753777 | 13942.715413 | 6652.108689 | runner improved selected surface-risk terms but did not beat T100/L3 on institutional MTM scorecard |
| PAIR_TWO_SIDED_GRID_T100_S020_L3_FINAL_RESET_RUNNER_050 | 0.5 | 2651.238026 | 2322.467428 | -243.315748 | 1017.831819 | 13227.307303 | 5933.544621 | runner improved selected surface-risk terms but did not beat T100/L3 on institutional MTM scorecard |
| PAIR_TWO_SIDED_GRID_T125_S020_L3_FINAL_RESET_RUNNER_025 | 0.25 | -281.902214 | 1850.446211 | -98.236065 | -1238.68955 | 14551.037127 | 7670.472357 | runner improved selected surface-risk terms but did not beat T100/L3 on institutional MTM scorecard |
| PAIR_TWO_SIDED_GRID_T125_S020_L3_FINAL_RESET_RUNNER_050 | 0.5 | 409.620619 | 2640.183009 | -196.45003 | -1503.781295 | 13761.300329 | 6808.182977 | runner improved selected surface-risk terms but did not beat T100/L3 on institutional MTM scorecard |
| PAIR_TWO_SIDED_GRID_T075_S020_L3_FINAL_RESET_RUNNER_050_ACCOUNT_EMERGENCY_SL_3ADR | 0.5 | 296.337801 | 1015.119391 | 0 | -264.997122 |  |  | runner improved selected surface-risk terms but did not beat T100/L3 on institutional MTM scorecard |
| PAIR_TWO_SIDED_GRID_T075_S020_L3_FINAL_RESET_RUNNER_050_ACCOUNT_EMERGENCY_SL_5ADR | 0.5 | 81.829163 | 1250.626374 | 0 | -540.516612 |  |  | runner improved selected surface-risk terms but did not beat T100/L3 on institutional MTM scorecard |

## Emergency SL Reference Audit

Emergency-SL rows are reference-only diagnostics. They are not ranked as exit candidates.

| rule_id | account_emergency_sl_adr | emergency_breach_count | triggered_week_count | equity_saved_proxy_drawdown_improvement_adr | harvest_lost_adr | right_tail_lost_vs_t150_adr | final_equity_delta_vs_base_adr | interpretation |
|---|---|---|---|---|---|---|---|---|
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK_ACCOUNT_EMERGENCY_SL_3ADR | -3 | 347 | 347 | 1727.797184 | 15803.019546 | 12579.068445 | -13451.935035 | reference-only diagnostic; drawdown/open-loss improvement comes with unacceptable harvest loss |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK_ACCOUNT_EMERGENCY_SL_5ADR | -5 | 339 | 339 | 1573.018079 | 16126.346359 | 12613.845682 | -13775.261848 | reference-only diagnostic; drawdown/open-loss improvement comes with unacceptable harvest loss |
| PAIR_TWO_SIDED_GRID_T075_S020_L3_FINAL_RESET_RUNNER_050_ACCOUNT_EMERGENCY_SL_3ADR | -3 | 312 | 312 | 404.575493 | 2833.291241 | 12616.627361 | -2627.3303 | reference-only diagnostic; drawdown/open-loss improvement comes with unacceptable harvest loss |
| PAIR_TWO_SIDED_GRID_T075_S020_L3_FINAL_RESET_RUNNER_050_ACCOUNT_EMERGENCY_SL_5ADR | -5 | 310 | 310 | 163.134567 | 3047.799879 | 12612.906322 | -2841.838938 | reference-only diagnostic; drawdown/open-loss improvement comes with unacceptable harvest loss |

## Metric Availability

The following fields require replay instrumentation beyond the Gate 78 artifact surface. Gate 78A leaves them null and reports available proxies instead.

| metric | availability | gate78a_handling |
|---|---|---|
| pair_week_lifecycle_profit_factor | not_available_from_gate78_artifacts | reported null; requires pair-week lifecycle replay instrumentation |
| account_week_mfe_mae | not_available_from_gate78_artifacts | reported null; weekly MTM rolling losses and week-end open-unrealized values reported instead |
| pair_week_lifecycle_mfe_mae | not_available_from_gate78_artifacts | reported null; max cycle MFE and total giveback proxies reported |
| average_open_inventory | not_available_from_gate78_artifacts | reported null; fill and reset burden proxies reported |
| max_open_inventory | not_available_from_gate78_artifacts | reported null; max weekly fill and reset counts reported |
| max_holding_time | not_available_from_gate78_artifacts | reported null; average closed cycle hold hours reported |
| runner_mfe_mae | not_available_from_gate78_artifacts | reported null; runner realized/unrealized contribution and close counts reported |

## Evidence Integrity

- Candidate B forced-28 ledger was not mutated.
- Candidate B was not recomputed.
- Candidate B was not relabeled.
- Candidate B was not reweighted.
- Candidate B was not filtered.
- No pairs were excluded.
- AUDNZD was not excluded or given special treatment.
- No fair-value pruning was introduced.
- No risk/correlation pruning was introduced.
- No cost, spread, slippage, swap, or commission assumptions were introduced.
- No MT5/live/app/runtime work was introduced.
- No promotion was made.
- Emergency-SL rows are reference-only diagnostics.
- Runner rows are diagnostics unless proven superior by the scorecard; Gate 78A did not find them superior.
- All results are gross, pre-cost, pre-risk, and research-only.

## Artifact Paths And Hashes

| label | sha256 | path |
|---|---|---|
| scorecard_json | CE0EB10EC858B3B87072B538843AC4201F3D4E5AB47034B7C6E61E7D12391E3C | docs/research/gates/gate78a/artifacts/gate78a-limited-reentry-institutional-numeric-scorecard-supplement/gate78a-scorecard.rows.json |
| scorecard_csv | CDB9587FD2C09EC1FC75459A5C429716A708D8A2B0ABA3426909625E3EAB54B6 | docs/research/gates/gate78a/artifacts/gate78a-limited-reentry-institutional-numeric-scorecard-supplement/gate78a-scorecard.rows.csv |
| weekly_series_json | A8C13138AB2BF8984A9F09F2794ABD0D5752D33F94681F007315E0AFF7167B2E | docs/research/gates/gate78a/artifacts/gate78a-limited-reentry-institutional-numeric-scorecard-supplement/weekly-mtm-equity-series.rows.json |
| weekly_series_csv | B9C771D0C2FE87F1EFD9C9815DF498132D66D22EB5C64CF98C64C2E4CC1D54F9 | docs/research/gates/gate78a/artifacts/gate78a-limited-reentry-institutional-numeric-scorecard-supplement/weekly-mtm-equity-series.rows.csv |
| monthly_summary_json | 7B5D95200E8990EB47DD7EE3ABB71E645D0F649D0FF9677E565EB2CBE9CC883D | docs/research/gates/gate78a/artifacts/gate78a-limited-reentry-institutional-numeric-scorecard-supplement/monthly-mtm-summary.rows.json |
| monthly_summary_csv | 9ED8AB12EFEE16A7AA5D2DFF29856B47C0C7216496A44F0541E92D54BDDA6D92 | docs/research/gates/gate78a/artifacts/gate78a-limited-reentry-institutional-numeric-scorecard-supplement/monthly-mtm-summary.rows.csv |
| pair_currency_attribution_json | 02405A327813F1F94EE66422514945D4FBDCC021E7C4E8AE1CB418D3903B9DF1 | docs/research/gates/gate78a/artifacts/gate78a-limited-reentry-institutional-numeric-scorecard-supplement/pair-currency-attribution.rows.json |
| pair_currency_attribution_csv | 105731CA0E8761C549F8B3EBA9DA458EAB3BDBD09C523044AC852883DEBF352B | docs/research/gates/gate78a/artifacts/gate78a-limited-reentry-institutional-numeric-scorecard-supplement/pair-currency-attribution.rows.csv |
| fill_reset_inventory_json | 366E218E5DBD68E0A14C4DEFCE266DBC31FDB729AF11628C11DBA4589099965A | docs/research/gates/gate78a/artifacts/gate78a-limited-reentry-institutional-numeric-scorecard-supplement/fill-reset-inventory-summary.rows.json |
| fill_reset_inventory_csv | 4A6E8CDB0B355261A4515884EEF81E60E68870F6C92614A1FCF4CD5986CD000B | docs/research/gates/gate78a/artifacts/gate78a-limited-reentry-institutional-numeric-scorecard-supplement/fill-reset-inventory-summary.rows.csv |
| metric_definitions_json | 8B64D501F8958A32B27F707F8AE501BD6CDE75408A43FB1205A3C7D84929346C | docs/research/gates/gate78a/artifacts/gate78a-limited-reentry-institutional-numeric-scorecard-supplement/metric-definition-appendix.rows.json |
| metric_definitions_csv | 7B97D2219CC6528909F44203A9A6BFAAC62B90E6A7D76D1FA7BCB192B322C9D6 | docs/research/gates/gate78a/artifacts/gate78a-limited-reentry-institutional-numeric-scorecard-supplement/metric-definition-appendix.rows.csv |
| row_classification_json | B12B217DAA3FCE4F77BC08FF6FBB36A00C7C0BC91C34981B3E1A68B1B001C13F | docs/research/gates/gate78a/artifacts/gate78a-limited-reentry-institutional-numeric-scorecard-supplement/row-classification.rows.json |
| row_classification_csv | 2429C4137D395424B068F715B6F72A62A657C64FCD5812D232F587076D5FDB99 | docs/research/gates/gate78a/artifacts/gate78a-limited-reentry-institutional-numeric-scorecard-supplement/row-classification.rows.csv |
| runner_audit_json | 5D66F2387075BEA75C733526F986FACE6DE5417751C8C5A886AD4337F1E3A373 | docs/research/gates/gate78a/artifacts/gate78a-limited-reentry-institutional-numeric-scorecard-supplement/runner-audit.rows.json |
| runner_audit_csv | 106C889AEC903C31F0CBFF2712A95B77ACB68EC6F66023AFBA02AA82011794DA | docs/research/gates/gate78a/artifacts/gate78a-limited-reentry-institutional-numeric-scorecard-supplement/runner-audit.rows.csv |
| emergency_sl_audit_json | D8BEB4A373D78B7CAABA38FDEE0B77BA3E9BFC221AA9BA8BE06BE4504599DC50 | docs/research/gates/gate78a/artifacts/gate78a-limited-reentry-institutional-numeric-scorecard-supplement/emergency-sl-reference-audit.rows.json |
| emergency_sl_audit_csv | 09D79019DFD2A314B4DD9770159FC45F1F22E5C5892954016D7EBE8D4CFA810B | docs/research/gates/gate78a/artifacts/gate78a-limited-reentry-institutional-numeric-scorecard-supplement/emergency-sl-reference-audit.rows.csv |
| metric_availability_json | 0D2874819873C74832B0C79ED70F95C31791737EF7CB2AB1FE87102865A2AFC1 | docs/research/gates/gate78a/artifacts/gate78a-limited-reentry-institutional-numeric-scorecard-supplement/metric-availability.rows.json |
| metric_availability_csv | 91E9622C6534F2BCFCAD40BA20139F7821EC6B4978F218ED9814F63110F1DD39 | docs/research/gates/gate78a/artifacts/gate78a-limited-reentry-institutional-numeric-scorecard-supplement/metric-availability.rows.csv |
| command_receipt | AB631D955A7886AB75AAA6B735F5B972BF87E6971B1B2CD06578941DA8A42850 | docs/research/gates/gate78a/artifacts/gate78a-limited-reentry-institutional-numeric-scorecard-supplement/command-receipt.json |
| summary_json | 672308EB9384F223AF5BF48E39A32848EB68B5B7535C2AFC7A9FAF29BEC8E55C | docs/research/gates/gate78a/artifacts/gate78a-limited-reentry-institutional-numeric-scorecard-supplement/gate78a-summary.json |

## Validation

```json
{
  "gate78a_supplement_only": true,
  "gate78_verdict_preserved": "PASS_GATE78_PAIR_TWO_SIDED_LIMITED_REENTRY_ENHANCEMENT_MATRIX__RUNNER_AND_REFERENCE_SL_VISIBLE_NO_PROMOTION",
  "gate78_rule_count": 17,
  "expected_gate78_rule_count": 17,
  "weekly_rows": 6341,
  "expected_weekly_rows": 6341,
  "weeks_per_rule": true,
  "pairs_replayed_from_gate78_summary": 28,
  "expected_pairs": 28,
  "pair_week_rows_replayed_from_gate78_summary": 10444,
  "expected_pair_week_rows": 10444,
  "candidate_b_forced28_ledger_mutated": false,
  "candidate_b_recomputed": false,
  "candidate_b_relabeled": false,
  "candidate_b_reweighted": false,
  "candidate_b_filtered": false,
  "pair_exclusions_started": false,
  "audnzd_excluded": false,
  "fair_value_pruning_started": false,
  "risk_correlation_pruning_started": false,
  "cost_slippage_swap_commission_assumptions_introduced": false,
  "mt5_live_app_runtime_started": false,
  "promotion_made": false,
  "emergency_sl_rows_reference_only": true,
  "runner_rows_ranked_as_diagnostics": true,
  "gross_pre_cost_pre_risk_pre_promotion_research_only": true,
  "primary_candidate": "PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK"
}
```
