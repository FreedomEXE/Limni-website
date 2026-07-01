# Gate 85A EURUSD Tail-Trail Lifecycle Smoke

Generated: `2026-07-01T16:33:23.510Z`

## Verdict

`PASS_TAIL_TRAIL_SMOKE_BUILT_IDEAS_WEAK_NO_PROMOTION`

## Scope

- Warehouse/backtester-only EURUSD smoke.
- Uses the Gate 74B trade-leg path warehouse and frozen canonical price lineage.
- MT5/EA files were not inspected, compiled, installed, or changed in this gate.
- The user has an MT5 V3 Strategy Tester run active; this gate stays hands-off.
- No Candidate B, direction, COT, Strength, Regime, Brain/Cell inputs, Grid Cap, L3, pair-net flatten, Pine anchor mode, weekly execution boundary, risk layer, optimization, promotion, or live-readiness claim.

## Contract

- Pair: `EURUSD`.
- Window: `2020-01-06` through `2026-05-31T23:00:00.000Z`.
- Raw grid: target `1` ADR, spacing `0.2` ADR.
- Tail fractions: `0, 0.025, 0.05, 0.1`.
- Tail activation ADR: `1, 2`.
- Tail trailing-stop ADR: `1, 2, 3, 5`.
- HWM reset: `OFF` in Gate 85A. Account HWM reset remains a later synchronized-account replay gate if this tail smoke is alive.
- Cost ladder: `0, 0.0025, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5`.
- Meaningful tail-smoke threshold: at `0.05` cost fraction, improve max drawdown by at least `5` ADR while retaining at least `70%` of baseline final equity.

Tail stop semantics use full-size-equivalent tail PnL for activation/trailing,
while actual tail PnL is scaled by `tail_fraction`. This keeps tiny residual
tails from needing impossible actual-ADR movement before a wide trail can act.

Runtime: `602s`.

## Focus Rows

| variant_id | cost_fraction | tail_fraction | activation | trail | final_equity | final_vs_base | max_dd | dd_improve | tail_realized | tail_open | hint |
|---|---|---|---|---|---|---|---|---|---|---|---|
| RAW_HEDGED_GRID_T100_S020_EURUSD_TAIL_TRAIL_SMOKE_TAIL100_A1_TR1 | 0.1 | 0.1 | 1 | 1 | -84.867366 | -5.157032 | -1342.662941 | 0.250811 | 121.646322 | 0 | weak |
| RAW_HEDGED_GRID_T100_S020_EURUSD_TAIL_TRAIL_SMOKE_TAIL100_A1_TR1 | 0.05 | 0.1 | 1 | 1 | 212.507634 | -5.157032 | -1306.027941 | 0.235811 | 121.646322 | 0 | weak |
| RAW_HEDGED_GRID_T100_S020_EURUSD_TAIL_TRAIL_SMOKE_TAIL100_A1_TR1 | 0 | 0.1 | 1 | 1 | 509.882634 | -5.157032 | -1269.392941 | 0.220811 | 121.646322 | 0 | weak |
| RAW_HEDGED_GRID_T100_S020_EURUSD_TAIL_TRAIL_SMOKE_TAIL050_A1_TR1 | 0.1 | 0.05 | 1 | 1 | -82.288869 | -2.578535 | -1342.788341 | 0.125411 | 60.82315 | 0 | weak |
| RAW_HEDGED_GRID_T100_S020_EURUSD_TAIL_TRAIL_SMOKE_TAIL050_A1_TR1 | 0.05 | 0.05 | 1 | 1 | 215.086131 | -2.578535 | -1306.145841 | 0.117911 | 60.82315 | 0 | weak |
| RAW_HEDGED_GRID_T100_S020_EURUSD_TAIL_TRAIL_SMOKE_TAIL050_A1_TR1 | 0 | 0.05 | 1 | 1 | 512.461131 | -2.578535 | -1269.503341 | 0.110411 | 60.82315 | 0 | weak |
| RAW_HEDGED_GRID_T100_S020_EURUSD_TAIL_TRAIL_SMOKE_TAIL025_A1_TR1 | 0.1 | 0.025 | 1 | 1 | -80.999572 | -1.289238 | -1342.851051 | 0.062701 | 30.411585 | 0 | weak |
| RAW_HEDGED_GRID_T100_S020_EURUSD_TAIL_TRAIL_SMOKE_TAIL025_A1_TR1 | 0.05 | 0.025 | 1 | 1 | 216.375428 | -1.289238 | -1306.204801 | 0.058951 | 30.411585 | 0 | weak |
| RAW_HEDGED_GRID_T100_S020_EURUSD_TAIL_TRAIL_SMOKE_TAIL025_A1_TR1 | 0 | 0.025 | 1 | 1 | 513.750428 | -1.289238 | -1269.558551 | 0.055201 | 30.411585 | 0 | weak |
| RAW_HEDGED_GRID_T100_S020_EURUSD_TAIL_TRAIL_SMOKE_TAIL025_A1_TR2 | 0.1 | 0.025 | 1 | 2 | -82.223006 | -2.512672 | -1343.083759 | -0.170007 | 29.188151 | 0 | weak |
| RAW_HEDGED_GRID_T100_S020_EURUSD_TAIL_TRAIL_SMOKE_TAIL025_A1_TR2 | 0.05 | 0.025 | 1 | 2 | 215.151994 | -2.512672 | -1306.437509 | -0.173757 | 29.188151 | 0 | weak |
| RAW_HEDGED_GRID_T100_S020_EURUSD_TAIL_TRAIL_SMOKE_TAIL025_A1_TR2 | 0 | 0.025 | 1 | 2 | 512.526994 | -2.512672 | -1269.791259 | -0.177507 | 29.188151 | 0 | weak |
| RAW_HEDGED_GRID_T100_S020_EURUSD_TAIL_TRAIL_SMOKE_TAIL050_A1_TR2 | 0.1 | 0.05 | 1 | 2 | -84.735705 | -5.025371 | -1343.25377 | -0.340018 | 58.376314 | 0 | weak |
| RAW_HEDGED_GRID_T100_S020_EURUSD_TAIL_TRAIL_SMOKE_TAIL050_A1_TR2 | 0.05 | 0.05 | 1 | 2 | 212.639295 | -5.025371 | -1306.61127 | -0.347518 | 58.376314 | 0 | weak |
| RAW_HEDGED_GRID_T100_S020_EURUSD_TAIL_TRAIL_SMOKE_TAIL050_A1_TR2 | 0 | 0.05 | 1 | 2 | 510.014295 | -5.025371 | -1269.96877 | -0.355018 | 58.376314 | 0 | weak |
| RAW_HEDGED_GRID_T100_S020_EURUSD_TAIL_TRAIL_SMOKE_TAIL100_A1_TR2 | 0.1 | 0.1 | 1 | 2 | -89.761055 | -10.050721 | -1343.593794 | -0.680042 | 116.752633 | 0 | weak |
| RAW_HEDGED_GRID_T100_S020_EURUSD_TAIL_TRAIL_SMOKE_TAIL100_A1_TR2 | 0.05 | 0.1 | 1 | 2 | 207.613945 | -10.050721 | -1306.958794 | -0.695042 | 116.752633 | 0 | weak |
| RAW_HEDGED_GRID_T100_S020_EURUSD_TAIL_TRAIL_SMOKE_TAIL025_A1_TR3 | 0.1 | 0.025 | 1 | 3 | -81.504188 | -1.793854 | -1343.609269 | -0.695517 | 29.906969 | 0 | weak |
| RAW_HEDGED_GRID_T100_S020_EURUSD_TAIL_TRAIL_SMOKE_TAIL025_A1_TR3 | 0.05 | 0.025 | 1 | 3 | 215.870812 | -1.793854 | -1306.963019 | -0.699267 | 29.906969 | 0 | weak |
| RAW_HEDGED_GRID_T100_S020_EURUSD_TAIL_TRAIL_SMOKE_TAIL025_A1_TR3 | 0 | 0.025 | 1 | 3 | 513.245812 | -1.793854 | -1270.316769 | -0.703017 | 29.906969 | 0 | weak |
| RAW_HEDGED_GRID_T100_S020_EURUSD_TAIL_TRAIL_SMOKE_TAIL100_A1_TR2 | 0 | 0.1 | 1 | 2 | 504.988945 | -10.050721 | -1270.323794 | -0.710042 | 116.752633 | 0 | weak |
| RAW_HEDGED_GRID_T100_S020_EURUSD_TAIL_TRAIL_SMOKE_TAIL050_A1_TR3 | 0.1 | 0.05 | 1 | 3 | -83.298115 | -3.587781 | -1344.304793 | -1.391041 | 59.813904 | 0 | weak |
| RAW_HEDGED_GRID_T100_S020_EURUSD_TAIL_TRAIL_SMOKE_TAIL050_A1_TR3 | 0.05 | 0.05 | 1 | 3 | 214.076885 | -3.587781 | -1307.662293 | -1.398541 | 59.813904 | 0 | weak |
| RAW_HEDGED_GRID_T100_S020_EURUSD_TAIL_TRAIL_SMOKE_TAIL050_A1_TR3 | 0 | 0.05 | 1 | 3 | 511.451885 | -3.587781 | -1271.019793 | -1.406041 | 59.813904 | 0 | weak |
| RAW_HEDGED_GRID_T100_S020_EURUSD_TAIL_TRAIL_SMOKE_TAIL025_A1_TR5 | 0 | 0.025 | 1 | 5 | 505.232832 | -9.806834 | -1271.328959 | -1.715207 | 21.893989 | 0 | weak |

## Validation

| check | value | expected | passed |
|---|---|---|---|
| gate74b_verdict | PASS_GATE74B_TRADE_LEG_PATH_MATERIALIZATION__POLICY_NEUTRAL_PAIR_WEEK_PATH_WAREHOUSE_READY |  | true |
| manifest_complete | complete |  | true |
| pair | EURUSD | EURUSD | true |
| weeks_replayed | 335 | >=300 | true |
| candidate_b_direction_used | false |  | true |
| weekly_execution_boundary_active | false |  | true |
| hwm_reset_active | false | Gate85A tail smoke only | true |
| mt5_touched | false |  | true |
| promotion_claimed | false |  | true |

## Artifacts

- summaryJson: `docs/research/gates/gate85a/artifacts/eurusd-tail-trail-lifecycle-smoke/gate85a_lifecycle_matrix_summary.rows.json`
- summaryCsv: `docs/research/gates/gate85a/artifacts/eurusd-tail-trail-lifecycle-smoke/gate85a_lifecycle_matrix_summary.rows.csv`
- weeklyGrossJson: `docs/research/gates/gate85a/artifacts/eurusd-tail-trail-lifecycle-smoke/gate85a_weekly_gross.rows.json`
- weeklyGrossCsv: `docs/research/gates/gate85a/artifacts/eurusd-tail-trail-lifecycle-smoke/gate85a_weekly_gross.rows.csv`
- weeklyCostJson: `docs/research/gates/gate85a/artifacts/eurusd-tail-trail-lifecycle-smoke/gate85a_weekly_cost_ladder.rows.json`
- weeklyCostCsv: `docs/research/gates/gate85a/artifacts/eurusd-tail-trail-lifecycle-smoke/gate85a_weekly_cost_ladder.rows.csv`
- yearlyJson: `docs/research/gates/gate85a/artifacts/eurusd-tail-trail-lifecycle-smoke/gate85a_yearly_breakdown.rows.json`
- yearlyCsv: `docs/research/gates/gate85a/artifacts/eurusd-tail-trail-lifecycle-smoke/gate85a_yearly_breakdown.rows.csv`
- rollingJson: `docs/research/gates/gate85a/artifacts/eurusd-tail-trail-lifecycle-smoke/gate85a_rolling_12m_breakdown.rows.json`
- rollingCsv: `docs/research/gates/gate85a/artifacts/eurusd-tail-trail-lifecycle-smoke/gate85a_rolling_12m_breakdown.rows.csv`
- worstDrawdownsJson: `docs/research/gates/gate85a/artifacts/eurusd-tail-trail-lifecycle-smoke/gate85a_worst_drawdown_windows.rows.json`
- worstDrawdownsCsv: `docs/research/gates/gate85a/artifacts/eurusd-tail-trail-lifecycle-smoke/gate85a_worst_drawdown_windows.rows.csv`
- tailSummaryJson: `docs/research/gates/gate85a/artifacts/eurusd-tail-trail-lifecycle-smoke/gate85a_tail_summary.rows.json`
- tailSummaryCsv: `docs/research/gates/gate85a/artifacts/eurusd-tail-trail-lifecycle-smoke/gate85a_tail_summary.rows.csv`
- tailEventsJson: `docs/research/gates/gate85a/artifacts/eurusd-tail-trail-lifecycle-smoke/gate85a_tail_events.rows.json`
- tailEventsCsv: `docs/research/gates/gate85a/artifacts/eurusd-tail-trail-lifecycle-smoke/gate85a_tail_events.rows.csv`
- validationJson: `docs/research/gates/gate85a/artifacts/eurusd-tail-trail-lifecycle-smoke/gate85a_validation.rows.json`
- validationCsv: `docs/research/gates/gate85a/artifacts/eurusd-tail-trail-lifecycle-smoke/gate85a_validation.rows.csv`
- commandReceipt: `docs/research/gates/gate85a/artifacts/eurusd-tail-trail-lifecycle-smoke/gate85a_command_receipt.json`
- runSummaryJson: `docs/research/gates/gate85a/artifacts/eurusd-tail-trail-lifecycle-smoke/gate85a_run_summary.json`
- shaManifest: `docs/research/gates/gate85a/artifacts/eurusd-tail-trail-lifecycle-smoke/gate85a_sha256.txt`
- report: `docs/research/gates/gate85a/GATE85A_EURUSD_TAIL_TRAIL_LIFECYCLE_SMOKE_2026-07-01.md`

## Stop Line

Gate 85A is a one-pair warehouse smoke only. It does not promote a strategy and
does not touch MT5 while the manual V3 tester run is active.
