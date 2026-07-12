# Gate 89 Continuous Raw Truth Simulator

Generated: `2026-07-01T22:40:29.115Z`

## Verdict

`PASS_GATE89_CONTINUOUS_TRUTH_SIMULATOR_BUILT_DIAGNOSTIC_ONLY`

## Scope

- Continuous warehouse truth replay for raw fully hedged grid mechanics.
- Variant: `RAW_HEDGED_GRID_T100_S020_CONTINUOUS_TRUTH`.
- Target `1` ADR, spacing `0.2` ADR, lot size `0.01`.
- Bar path mode: `ohlc_high_low`.
- Carries side-grid positions across warehouse week boundaries.
- Target resets are based on price ADR PnL only, matching the EA leg-reset decision.
- Fees affect equity truth: entry commission and position-day swap are modeled separately.
- Terminal liquidation is explicit and reported separately.
- No filter logic, Candidate B, COT, Strength, Regime, lifecycle HWM/LWM tuning, risk layer, promotion, or live-readiness claim.

## Summary

| symbol_universe | bar_path_mode | weeks_replayed | pairs_replayed | final_balance_usd | net_profit_usd | closed_price_pnl_usd | end_liquidation_price_pnl_usd | total_commission_usd | total_swap_usd | entries_opened | end_liquidation_positions | max_open_positions | max_add_depth | max_equity_drawdown_usd | net_delta_vs_mt5_usd |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| EURUSD | ohlc_high_low | 312 | 1 | 10232.18 | 232.18 | 11051.73 | -6582.17 | -400.2 | -3837.17 | 6670 | 161 | 184 | 155 | -7735.94 | 57.67 |

## Fee Model

- Commission: `0.06` USD per 0.01-lot entry.
- Long swap: `-0.0917` USD per 0.01-lot day.
- Short swap: `0.01` USD per 0.01-lot day.
- Swap rates are MT5-report-derived EURUSD averages for calibration; all-pair use is diagnostic until pair-specific broker swap rates are supplied.

## Metric Definitions

| metric | definition |
|---|---|
| continuous_carried_position_truth_replay | keeps side grid state open across warehouse week boundaries until target reset or terminal liquidation |
| bar_path_mode | intrabar path used for each warehouse M1 bar; close mode uses close-only marks, OHLC modes synthesize four tester-like marks per bar |
| closed_price_pnl_usd | target-reset price PnL before swap and commission |
| total_commission_usd | entry commission charged at MT5-observed 0.06 USD per 0.01 lot entry; exits have zero commission in the reference report |
| total_swap_usd | position-day carry fee accrued per fill by side using MT5-derived EURUSD average swap rates |
| end_liquidation_price_pnl_usd | price PnL from all positions still open at the final warehouse mark |
| max_open_positions | maximum simultaneous fill count across carried side grids |

## Validation

| check | value | expected | passed |
|---|---|---|---|
| gate74b_verdict | PASS_GATE74B_TRADE_LEG_PATH_MATERIALIZATION__POLICY_NEUTRAL_PAIR_WEEK_PATH_WAREHOUSE_READY | PASS_GATE74B | true |
| continuous_carried_inventory | true | true | true |
| weekly_sample_end_close_disabled | true | true | true |
| target_reset_uses_price_adr_pnl | true | true | true |
| bar_path_mode | ohlc_high_low | explicit | true |
| swap_triggers_target_reset | false | false | true |
| commission_per_entry_per_001_lot_usd | 0.06 | 0.06 | true |
| eurusd_long_swap_per_001_lot_day_usd | -0.0917 | MT5-derived approx | true |
| eurusd_short_swap_per_001_lot_day_usd | 0.01 | MT5-derived approx | true |
| selected_week_count | 312 | >=1 | true |
| selected_pair_count | 1 | >=1 | true |

## Artifacts

- summaryJson: `docs/research/gates/gate89/artifacts/continuous-raw-truth-eurusd-ohlc-high-low/continuous-truth-summary.rows.json`
- summaryCsv: `docs/research/gates/gate89/artifacts/continuous-raw-truth-eurusd-ohlc-high-low/continuous-truth-summary.rows.csv`
- weeklyJson: `docs/research/gates/gate89/artifacts/continuous-raw-truth-eurusd-ohlc-high-low/weekly-continuous-truth.rows.json`
- weeklyCsv: `docs/research/gates/gate89/artifacts/continuous-raw-truth-eurusd-ohlc-high-low/weekly-continuous-truth.rows.csv`
- closeEventsJson: `docs/research/gates/gate89/artifacts/continuous-raw-truth-eurusd-ohlc-high-low/close-events.rows.json`
- closeEventsCsv: `docs/research/gates/gate89/artifacts/continuous-raw-truth-eurusd-ohlc-high-low/close-events.rows.csv`
- validationJson: `docs/research/gates/gate89/artifacts/continuous-raw-truth-eurusd-ohlc-high-low/validation.rows.json`
- validationCsv: `docs/research/gates/gate89/artifacts/continuous-raw-truth-eurusd-ohlc-high-low/validation.rows.csv`
- metricDefinitionsJson: `docs/research/gates/gate89/artifacts/continuous-raw-truth-eurusd-ohlc-high-low/metric-definitions.rows.json`
- metricDefinitionsCsv: `docs/research/gates/gate89/artifacts/continuous-raw-truth-eurusd-ohlc-high-low/metric-definitions.rows.csv`
- commandReceipt: `docs/research/gates/gate89/artifacts/continuous-raw-truth-eurusd-ohlc-high-low/command-receipt.json`
- runSummaryJson: `docs/research/gates/gate89/artifacts/continuous-raw-truth-eurusd-ohlc-high-low/gate89-run-summary.json`
- shaManifest: `docs/research/gates/gate89/artifacts/continuous-raw-truth-eurusd-ohlc-high-low/gate89-continuous-truth-sha256.txt`
- report: `docs/research/gates/gate89/GATE89_CONTINUOUS_RAW_TRUTH_SIMULATOR_EURUSD_OHLC_HIGH_LOW_2026-07-01.md`

## Stop Line

Gate 89 is truth-simulator/calibration evidence only. Do not optimize filters, retune lifecycle controls, promote strategy logic, or claim live-readiness from this run.
