# Gate 81 Hedged Broker-Real Feasibility Preflight

Generated: `2026-06-30T18:27:50.924Z`

## Verdict

`PASS_HEDGED_FEASIBILITY_PREFLIGHT__ONE_PAIR_MT5_PROTOTYPE_NEXT_NO_PROMOTION`

## Scope

- Fast artifact-derived feasibility pass over Gate 80 outputs only.
- No database replay, no path reconstruction, no full 373-week backtest rerun.
- Stress-tests the fully hedged T100/S020/L3 reference against fixed ADR-per-fill cost and active-side-week swap proxies.
- Reports order-count and margin/exposure proxies before any MT5 build.
- Does not mutate Candidate B, COT, Strength, Regime, source truth, pair set, AUDNZD, risk layer, MT5/live/app/runtime, or promotion state.

## Direct Answers

| question | answer | evidence |
|---|---|---|
| Did Gate81 rerun the expensive path replay? | no_artifact_derived_from_gate80_receipts | Reads Gate80 JSON artifacts only; no DB replay or warehouse reconstruction. |
| Does the hedged baseline survive first-pass cost and swap stress? | yes_under_fixed_adr_proxy | 42637.417719 ADR after 0.05 ADR/fill and 0.01 ADR/active-side-week stress. |
| Does hedged still beat directional under stress? | yes_under_fixed_adr_proxy | hedged 42637.417719 vs directional 9334.109764. |
| Is all-28 broker deployment approved? | no | Order count, margin mode, swap, execution, and MT5 parity remain unresolved. |
| Is a one-pair MT5 prototype justified? | yes_as_feasibility_validation_only | One pair makes fill/reset/spread/swap/margin behavior visible without turning this into portfolio runtime work. |
| Does Gate81 promote a system? | no | No promotion, no live readiness, no risk layer, no Candidate B mutation. |

## Source Artifact Validation

| check | value | passed |
|---|---|---|
| gate80_verdict_input | PASS_HEDGED_BASELINE_PROMISING_BUT_COST_MARGIN_VALIDATION_REQUIRED_NO_PROMOTION | true |
| gate80_weeks | 373 | true |
| gate80_pairs | 28 | true |
| gate80_pair_week_rows | 10444 | true |
| gate74b_hash_matched | true | true |
| artifact_only_no_replay | true | true |
| candidate_b_mutated | false | true |
| mt5_live_runtime_started | false | true |

## Broker Stress Scenarios

| scenario_id | rule_id | all_in_cost_adr_per_fill | swap_drag_adr_per_active_side_week | stressed_final_equity_adr | stressed_max_drawdown_adr |
|---|---|---|---|---|---|
| tight_execution_no_swap | PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | 0.005 | 0 | 13339.554764 | -2004.982654 |
| normal_execution_small_swap | PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | 0.01 | 0.0025 | 12879.999764 | -2021.432654 |
| wide_execution_visible_swap | PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | 0.025 | 0.005 | 11553.554764 | -2079.086738 |
| stress_execution_high_swap | PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | 0.05 | 0.01 | 9334.109764 | -2205.316738 |
| extreme_execution_punitive_swap | PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | 0.1 | 0.02 | 4895.219764 | -2472.70157 |
| tight_execution_no_swap | FULLY_HEDGED_LONG_SHORT_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE | 0.005 | 0 | 52566.297719 | -709.517194 |
| normal_execution_small_swap | FULLY_HEDGED_LONG_SHORT_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE | 0.01 | 0.0025 | 51434.077719 | -713.527194 |
| wide_execution_visible_swap | FULLY_HEDGED_LONG_SHORT_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE | 0.025 | 0.005 | 48141.857719 | -725.277194 |
| stress_execution_high_swap | FULLY_HEDGED_LONG_SHORT_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE | 0.05 | 0.01 | 42637.417719 | -744.907194 |
| extreme_execution_punitive_swap | FULLY_HEDGED_LONG_SHORT_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE | 0.1 | 0.02 | 31628.537719 | -784.167194 |

## Order Count Feasibility

| rule_id | total_fills | average_fills_per_week | p95_fills_per_week | max_fills_per_week | average_fills_per_pair_week_proxy | all_28_runtime_read |
|---|---|---|---|---|---|---|
| FULLY_HEDGED_LONG_SHORT_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE | 204752 | 548.932976 | 696 | 852 | 19.604749 | portfolio_order_count_high_requires_separate_runtime_design |
| FULLY_HEDGED_LONG_SHORT_28_PAIR_WEEKLY_T100_S020_NO_LIMIT_REFERENCE | 305641 | 819.412869 | 1526 | 2763 | 29.264745 | portfolio_order_count_high_requires_separate_runtime_design |
| LONG_ONLY_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE | 102551 | 274.935657 | 380 | 575 | 9.819131 | portfolio_order_count_lower_but_still_not_live_ready |
| SHORT_ONLY_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE | 102201 | 273.997319 | 372 | 506 | 9.785619 | portfolio_order_count_lower_but_still_not_live_ready |
| DETERMINISTIC_RANDOM_SIDE_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE | 102253 | 274.136729 | 365 | 441 | 9.790597 | portfolio_order_count_lower_but_still_not_live_ready |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | 106080 | 284.396783 | 317 | 465 | 10.157028 | portfolio_order_count_lower_but_still_not_live_ready |

## Margin And Exposure Proxy

| rule_id | final_equity_adr | max_drawdown_adr | worst_open_unrealized_adr | dd_plus_open_margin_proxy_adr | return_per_margin_proxy_unit |
|---|---|---|---|---|---|
| FULLY_HEDGED_LONG_SHORT_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE | 53646.297719 | -705.647194 | -966.732115 | 1672.379309 | 32.077829 |
| FULLY_HEDGED_LONG_SHORT_28_PAIR_WEEKLY_T100_S020_NO_LIMIT_REFERENCE | 82549.112283 | -1167.092908 | -1927.15691 | 3094.249818 | 26.678231 |
| PAIR_TWO_SIDED_GRID_T100_S020_STOP_AFTER_3_PAIR_RESETS_WEEK | 13772.999764 | -1989.442654 | -3001.945057 | 4991.387711 | 2.759353 |
| LONG_ONLY_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE | 27114.519974 | -563.927568 | -752.678688 | 1316.606256 | 20.594251 |
| SHORT_ONLY_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE | 26531.777745 | -694.023413 | -829.213048 | 1523.236461 | 17.41803 |
| DETERMINISTIC_RANDOM_SIDE_28_PAIR_WEEKLY_T100_S020_L3_REFERENCE | 26726.881812 | -375.382096 | -493.661799 | 869.043895 | 30.754352 |

## Decision Table

| decision | value | evidence |
|---|---|---|
| verdict | PASS_HEDGED_FEASIBILITY_PREFLIGHT__ONE_PAIR_MT5_PROTOTYPE_NEXT_NO_PROMOTION | Gate80 artifact-derived stress only; hedged T100/L3 remains positive and ahead of directional T100/L3 under normal and stress fixed ADR cost/swap proxies. |
| gate80_mechanical_validity | accepted_as_input | PASS_HEDGED_BASELINE_PROMISING_BUT_COST_MARGIN_VALIDATION_REQUIRED_NO_PROMOTION |
| normal_cost_survival | pass | 51434.077719 ADR stressed final equity |
| stress_cost_survival | pass | 42637.417719 ADR stressed final equity |
| extreme_cost_survival | pass_but_not_required | 31628.537719 ADR stressed final equity |
| cost_buffer | visible | Gate80 break-even cost 0.262006 ADR/fill; 50 percent return reduction cost 0.131003 ADR/fill. |
| margin_proxy | not_blocking_preflight_not_broker_real | Hedged worst open -966.732115 ADR, max DD -705.647194 ADR, avg active side slots 56. |
| smoothness | strong_relative_to_directional_but_not_live_proof | Gate80 smoothness 307.029797, longest drawdown 2 weeks. |
| next_action | open_one_pair_mt5_visual_prototype | Prototype scope must be one pair, no Candidate B, no COT, no Strength, no Regime, no risk layer, no live capital. |

## Read

Gate 81 does not prove the hedged baseline is broker-real. It proves the gross Gate 80 phenomenon has enough fixed-cost buffer to justify one small MT5 mechanics prototype. The next build should be one pair only, visual and auditable, with long and short legs tracked separately and every spread, swap, fill, reset, open loss, closed profit, and margin state visible.

The all-28 hedged portfolio is still closed. Portfolio runtime, broker order throughput, margin-mode behavior, swap realism, pair pruning, risk overlays, and live readiness remain unresolved.

## Artifacts

- sourceArtifactValidationJson: `docs/research/gates/gate81/artifacts/gate81-hedged-broker-real-feasibility-preflight/source-artifact-validation.rows.json`
- sourceArtifactValidationCsv: `docs/research/gates/gate81/artifacts/gate81-hedged-broker-real-feasibility-preflight/source-artifact-validation.rows.csv`
- brokerStressScenariosJson: `docs/research/gates/gate81/artifacts/gate81-hedged-broker-real-feasibility-preflight/broker-stress-scenarios.rows.json`
- brokerStressScenariosCsv: `docs/research/gates/gate81/artifacts/gate81-hedged-broker-real-feasibility-preflight/broker-stress-scenarios.rows.csv`
- orderCountFeasibilityJson: `docs/research/gates/gate81/artifacts/gate81-hedged-broker-real-feasibility-preflight/order-count-feasibility.rows.json`
- orderCountFeasibilityCsv: `docs/research/gates/gate81/artifacts/gate81-hedged-broker-real-feasibility-preflight/order-count-feasibility.rows.csv`
- marginExposureProxyJson: `docs/research/gates/gate81/artifacts/gate81-hedged-broker-real-feasibility-preflight/margin-exposure-proxy.rows.json`
- marginExposureProxyCsv: `docs/research/gates/gate81/artifacts/gate81-hedged-broker-real-feasibility-preflight/margin-exposure-proxy.rows.csv`
- finalDecisionRowsJson: `docs/research/gates/gate81/artifacts/gate81-hedged-broker-real-feasibility-preflight/final-decision-table.rows.json`
- finalDecisionRowsCsv: `docs/research/gates/gate81/artifacts/gate81-hedged-broker-real-feasibility-preflight/final-decision-table.rows.csv`
- directAnswerRowsJson: `docs/research/gates/gate81/artifacts/gate81-hedged-broker-real-feasibility-preflight/direct-answers.rows.json`
- directAnswerRowsCsv: `docs/research/gates/gate81/artifacts/gate81-hedged-broker-real-feasibility-preflight/direct-answers.rows.csv`
- sourceArtifactHashesJson: `docs/research/gates/gate81/artifacts/gate81-hedged-broker-real-feasibility-preflight/source-artifact-hashes.rows.json`
- sourceArtifactHashesCsv: `docs/research/gates/gate81/artifacts/gate81-hedged-broker-real-feasibility-preflight/source-artifact-hashes.rows.csv`
- commandReceipt: `docs/research/gates/gate81/artifacts/gate81-hedged-broker-real-feasibility-preflight/command-receipt.json`
- summaryJson: `docs/research/gates/gate81/artifacts/gate81-hedged-broker-real-feasibility-preflight/gate81-summary.json`
- shaIdentity: `docs/research/gates/gate81/artifacts/gate81-hedged-broker-real-feasibility-preflight/gate81-sha256.txt`
- report: `docs/research/gates/gate81/GATE81_HEDGED_BROKER_REAL_FEASIBILITY_PREFLIGHT_2026-06-30.md`

## Stop Line

Gate 81 is feasibility-preflight evidence only. No promotion, no full portfolio build, no Candidate B mutation, no signal research, no pair exclusion, no AUDNZD exclusion, no risk layer, no Regime/fair-value layer, no live readiness, and no broker-real claim beyond the fixed ADR proxy scenarios. The only next build this can justify is a one-pair MT5 mechanics prototype.
