# Gate 90 Grid Activation Accuracy One-Sided Selection

Generated: `2026-07-02T15:40:14.386Z`

## Verdict

`PASS_GATE90_GRID_ACTIVATION_ONE_SIDED_SELECTION_BUILT_DIAGNOSTIC_ONLY`

## Scope

- Warehouse truth replay with one-sided activation gates and explicit session mode controls.
- Variants: `RAW_GRID_T100_S020_GATE90_RAW_BOTH,RAW_GRID_T100_S020_GATE90_DAVID_CONTRA,RAW_GRID_T100_S020_GATE90_CANDIDATE_B,RAW_GRID_T100_S020_GATE90_STOCH_CONTRA,RAW_GRID_T100_S020_GATE90_DAVID_STOCH_CONFIRM`.
- Activation rules: `raw_both,david_contra,candidate_b,stoch_contra,david_stoch_confirm`.
- Signal settings id: `DAVID_LWMA25_RSI50_60_40__STOCH_100_3_100_60_40_low_high_simple_main_only`.
- David MA settings: LWMA `25`, close price, RSI `50`, overbought `60`, oversold `40`.
- Stochastic settings: K `100`, D `3`, slowing `100`, OB/OS `60/40`, Low/High, Simple, main line only.
- Signal clock: `adr_event`, ADR event brick `0.05`.
- Session mode: `ny_daily_window`, time zone `America/New_York`, trade window start `18:05`, trade cutoff `15:45`, flatten `16:00`, Sunday start `20:00`, flatten overrides `none`.
- Summary-only output: `false`.
- Activation uses closed warehouse bars and controls only missing side-cycle starts.
- Target mode `david_ma_reversion`, fixed target `1` ADR used only by fixed_adr mode, spacing `0.2` ADR, minimum MA expansion `0.1` ADR, grid add mode `adverse_only`, lot size `0.01`.
- Bar path mode: `ohlc_high_low`.
- Continuous mode carries side-grid positions across warehouse week boundaries; session-window mode carries only until target reset, session flatten, or terminal liquidation.
- Target resets use the selected target mode. fixed_adr uses price ADR PnL; david_ma_reversion closes only profitable returns to the current David MA.
- In `ny_daily_window`, target closes are still allowed whenever a tick exists, but starts/adds are blocked outside the configured clean session and unresolved cycles are force-closed at the flatten boundary.
- In `ny_daily_window`, any cycle still open at the selected test endpoint is closed as a session flatten at the last available mark; this prevents endpoint terminal inventory from masquerading as a live overnight hold.
- Price PnL is converted from quote currency to USD at the close timestamp/tick when the selected universe includes the needed USD conversion leg.
- Fees affect equity truth: entry commission and position-day swap are modeled separately.
- Explicit bid/ask spread and slippage are not modeled in this runner yet.
- Terminal liquidation is explicit and reported separately.
- No MT5 implementation, target/spacing optimization, pair-specific swap ingestion, margin stopout simulator, app/live integration, promotion, live-readiness, or double-sided in-between policy.

## Summary

| variant_id | activation_rule_id | signal_settings_id | symbol_universe | bar_path_mode | signal_clock | signal_adr_brick | session_mode | session_trade_start_et | session_trade_end_et | session_flatten_et | session_sunday_start_et | target_mode | target_adr | spacing_adr | min_ma_expansion_adr | grid_add_mode | weeks_replayed | pairs_replayed | final_balance_usd | net_profit_usd | closed_price_pnl_usd | end_liquidation_price_pnl_usd | total_commission_usd | total_swap_usd | session_flatten_count | session_flatten_positions | session_flatten_price_pnl_usd | session_flatten_swap_usd | entries_opened | end_liquidation_positions | max_open_positions | max_add_depth | max_equity_drawdown_usd | activation_started_long | activation_started_short | activation_blocked_long | activation_blocked_short | activation_blocked_expansion | activation_long_allow_pct | activation_short_allow_pct | summary_only |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| RAW_GRID_T100_S020_GATE90_RAW_BOTH | raw_both | DAVID_LWMA25_RSI50_60_40__STOCH_100_3_100_60_40_low_high_simple_main_only | AUDCAD,AUDCHF,AUDJPY,AUDNZD,AUDUSD,CADCHF,CADJPY,CHFJPY,EURAUD,EURCAD,EURCHF,EURGBP,EURJPY,EURNZD,EURUSD,GBPAUD,GBPCAD,GBPCHF,GBPJPY,GBPNZD,GBPUSD,NZDCAD,NZDCHF,NZDJPY,NZDUSD,USDCAD,USDCHF,USDJPY | ohlc_high_low | adr_event | 0.05 | ny_daily_window | 18:05 | 15:45 | 16:00 | 20:00 | david_ma_reversion | 1 | 0.2 | 0.1 | adverse_only | 5 | 28 | 11806.83 | 1806.83 | 2476.09 | 0 | -613.44 | -55.82 | 484 | 1233 | -2289.9 | -33.29 | 10224 | 0 | 102 | 14 | 0 | 3656 | 3697 | 2202983 | 2101227 | 4304210 | 0.17 | 0.18 | false |
| RAW_GRID_T100_S020_GATE90_DAVID_CONTRA | david_contra | DAVID_LWMA25_RSI50_60_40__STOCH_100_3_100_60_40_low_high_simple_main_only | AUDCAD,AUDCHF,AUDJPY,AUDNZD,AUDUSD,CADCHF,CADJPY,CHFJPY,EURAUD,EURCAD,EURCHF,EURGBP,EURJPY,EURNZD,EURUSD,GBPAUD,GBPCAD,GBPCHF,GBPJPY,GBPNZD,GBPUSD,NZDCAD,NZDCHF,NZDJPY,NZDUSD,USDCAD,USDCHF,USDJPY | ohlc_high_low | adr_event | 0.05 | ny_daily_window | 18:05 | 15:45 | 16:00 | 20:00 | david_ma_reversion | 1 | 0.2 | 0.1 | adverse_only | 5 | 28 | 11072.92 | 1072.92 | 1422.93 | 0 | -317.88 | -32.13 | 224 | 569 | -1079.05 | -18.91 | 5298 | 0 | 64 | 10 | -2.36 | 1948 | 1840 | 2716553 | 2747601 | 2048322 | 0.07 | 0.07 | false |
| RAW_GRID_T100_S020_GATE90_CANDIDATE_B | candidate_b | DAVID_LWMA25_RSI50_60_40__STOCH_100_3_100_60_40_low_high_simple_main_only | AUDCAD,AUDCHF,AUDJPY,AUDNZD,AUDUSD,CADCHF,CADJPY,CHFJPY,EURAUD,EURCAD,EURCHF,EURGBP,EURJPY,EURNZD,EURUSD,GBPAUD,GBPCAD,GBPCHF,GBPJPY,GBPNZD,GBPUSD,NZDCAD,NZDCHF,NZDJPY,NZDUSD,USDCAD,USDCHF,USDJPY | ohlc_high_low | adr_event | 0.05 | ny_daily_window | 18:05 | 15:45 | 16:00 | 20:00 | david_ma_reversion | 1 | 0.2 | 0.1 | adverse_only | 5 | 28 | 10848.68 | 848.68 | 1206.09 | 0 | -304.02 | -53.39 | 236 | 638 | -1080.01 | -33.09 | 5067 | 0 | 67 | 10 | -133.01 | 2936 | 690 | 2408470 | 3102343 | 2149283 | 0.12 | 0.02 | false |
| RAW_GRID_T100_S020_GATE90_STOCH_CONTRA | stoch_contra | DAVID_LWMA25_RSI50_60_40__STOCH_100_3_100_60_40_low_high_simple_main_only | AUDCAD,AUDCHF,AUDJPY,AUDNZD,AUDUSD,CADCHF,CADJPY,CHFJPY,EURAUD,EURCAD,EURCHF,EURGBP,EURJPY,EURNZD,EURUSD,GBPAUD,GBPCAD,GBPCHF,GBPJPY,GBPNZD,GBPUSD,NZDCAD,NZDCHF,NZDJPY,NZDUSD,USDCAD,USDCHF,USDJPY | ohlc_high_low | adr_event | 0.05 | ny_daily_window | 18:05 | 15:45 | 16:00 | 20:00 | david_ma_reversion | 1 | 0.2 | 0.1 | adverse_only | 5 | 28 | 10817.82 | 817.82 | 1075.65 | 0 | -236.1 | -21.73 | 175 | 406 | -765.89 | -12.1 | 3935 | 0 | 46 | 14 | 0 | 1374 | 1429 | 2914413 | 2855479 | 1429423 | 0.05 | 0.05 | false |
| RAW_GRID_T100_S020_GATE90_DAVID_STOCH_CONFIRM | david_stoch_confirm | DAVID_LWMA25_RSI50_60_40__STOCH_100_3_100_60_40_low_high_simple_main_only | AUDCAD,AUDCHF,AUDJPY,AUDNZD,AUDUSD,CADCHF,CADJPY,CHFJPY,EURAUD,EURCAD,EURCHF,EURGBP,EURJPY,EURNZD,EURUSD,GBPAUD,GBPCAD,GBPCHF,GBPJPY,GBPNZD,GBPUSD,NZDCAD,NZDCHF,NZDJPY,NZDUSD,USDCAD,USDCHF,USDJPY | ohlc_high_low | adr_event | 0.05 | ny_daily_window | 18:05 | 15:45 | 16:00 | 20:00 | david_ma_reversion | 1 | 0.2 | 0.1 | adverse_only | 5 | 28 | 10737.35 | 737.35 | 947.02 | 0 | -190.56 | -19.11 | 135 | 317 | -552.66 | -10.79 | 3176 | 0 | 45 | 9 | 0 | 1132 | 1114 | 2982656 | 2972655 | 1134446 | 0.04 | 0.04 | false |

## Fee Model

- Commission: `0.06` USD per 0.01-lot entry.
- Long swap: `-0.0917` USD per 0.01-lot day.
- Short swap: `0.01` USD per 0.01-lot day.
- Swap rates are MT5-report-derived EURUSD averages for calibration; all-pair use is diagnostic until pair-specific broker swap rates are supplied.
- Spread and slippage are excluded here; the daily session window is a structural exposure test, not a full execution-cost model.

## Metric Definitions

| metric | definition |
|---|---|
| continuous_carried_position_truth_replay | keeps side grid state open across warehouse week boundaries until target reset or terminal liquidation |
| session_window_position_truth_replay | keeps side grid state open inside the configured session window, allows target closes whenever ticks exist, and force-closes unresolved cycles at session flatten |
| bar_path_mode | intrabar path used for each warehouse M1 bar; close mode uses close-only marks, OHLC modes synthesize four tester-like marks per bar |
| signal_clock | clock used to update David MA/RSI/Stoch signal state; m1 updates on every M1 close, adr_event updates only after a configured ADR movement brick completes |
| signal_adr_brick | ADR movement required to complete one synthetic signal bar when signal_clock is adr_event |
| session_mode | continuous keeps the original carried-position replay; ny_daily_window allows starts/adds only inside the configured New York session and force-closes remaining cycles at the daily flatten boundary |
| session_flatten_count | number of side cycles closed by the configured daily session flatten boundary, a missed no-tick boundary, or the session-mode endpoint cleanup rather than a target reset or final end-of-test liquidation |
| session_flatten_price_pnl_usd | price PnL from cycles force-closed by the configured daily session flatten boundary |
| closed_price_pnl_usd | target-reset price PnL before swap and commission, with quote-currency PnL converted to USD at the close timestamp/tick when a USD conversion leg is selected |
| total_commission_usd | entry commission charged at MT5-observed 0.06 USD per 0.01 lot entry; exits have zero commission in the reference report |
| total_swap_usd | position-day carry fee accrued per fill by side using MT5-derived EURUSD average swap rates |
| end_liquidation_price_pnl_usd | price PnL from all positions still open at the final warehouse mark |
| terminal_inventory_rows | one row per side cycle that survived until terminal liquidation; used to attribute unresolved inventory by pair, side, age, MA distance, fill depth, and liquidation PnL |
| side_exit_distance_to_ma_adr | side-specific ADR distance from terminal mark back to the David MA exit line; positive means the cycle still needs that many ADR to return to MA |
| max_open_positions | maximum simultaneous fill count across carried side grids |
| activation_rule_id | one-sided start rule used when a side cycle is missing; existing cycles are not flattened by later signal changes |
| min_ma_expansion_adr | minimum side-specific distance from current David MA required before a missing side can start; long requires price below MA, short requires price above MA |
| grid_add_mode | adverse_and_favorable keeps both recovery and favorable expansion adds; adverse_only adds only when price moves against the side from its cycle anchor |
| activation_started_long/short | number of initial side cycles started after the activation gate allowed that side |
| activation_blocked_long/short | number of missing-side start checks rejected by the activation gate |
| activation_blocked_expansion | number of missing-side start checks where the signal allowed the side but price was not far enough from the David MA |

## Validation

| check | value | expected | passed |
|---|---|---|---|
| gate74b_verdict | PASS_GATE74B_TRADE_LEG_PATH_MATERIALIZATION__POLICY_NEUTRAL_PAIR_WEEK_PATH_WAREHOUSE_READY | PASS_GATE74B | true |
| continuous_carried_inventory | false | true only in continuous session mode | true |
| weekly_sample_end_close_disabled | true | true | true |
| target_reset_uses_selected_target_mode | david_ma_reversion | fixed_adr_or_david_ma_reversion | true |
| target_mode | david_ma_reversion | explicit | true |
| target_adr | 1 | >0 | true |
| spacing_adr | 0.2 | >0 | true |
| signal_clock | adr_event | explicit | true |
| signal_adr_brick | 0.05 | >0 | true |
| session_mode | ny_daily_window | explicit continuous_or_ny_daily_window | true |
| session_time_zone | America/New_York | IANA time zone | true |
| session_trade_start_et | 18:05 | HH:mm | true |
| session_trade_end_et | 15:45 | HH:mm | true |
| session_flatten_et | 16:00 | HH:mm | true |
| session_sunday_start_et | 20:00 | HH:mm | true |
| session_flatten_overrides_et |  | optional YYYY-MM-DD=HH:mm list | true |
| session_endpoint_open_cycles_close_as_session_flatten | true | true only in ny_daily_window | true |
| min_ma_expansion_adr | 0.1 | >=0 | true |
| grid_add_mode | adverse_only | explicit | true |
| bar_path_mode | ohlc_high_low | explicit | true |
| quote_currency_pnl_converted_to_usd | true | true | true |
| swap_triggers_target_reset | false | false | true |
| activation_rule_ids | raw_both,david_contra,candidate_b,stoch_contra,david_stoch_confirm | explicit | true |
| activation_controls_initial_cycle_start_only | true | true | true |
| david_ma_settings | LWMA25_RSI50_60_40 | explicit CLI/default settings | true |
| stochastic_settings | 100_3_100_60_40_low_high_simple_main_only | explicit CLI/default settings | true |
| summary_only | false | explicit | true |
| commission_per_entry_per_001_lot_usd | 0.06 | 0.06 | true |
| eurusd_long_swap_per_001_lot_day_usd | -0.0917 | MT5-derived approx | true |
| eurusd_short_swap_per_001_lot_day_usd | 0.01 | MT5-derived approx | true |
| selected_week_count | 5 | >=1 | true |
| selected_pair_count | 28 | >=1 | true |

## Artifacts

- summaryJson: `docs/research/gates/gate90/artifacts/oos-session-window-5w-oos4-adr005_ma25-s020-exp010-rsi506040-stoch100-3-100-6040/activation-summary.rows.json`
- summaryCsv: `docs/research/gates/gate90/artifacts/oos-session-window-5w-oos4-adr005_ma25-s020-exp010-rsi506040-stoch100-3-100-6040/activation-summary.rows.csv`
- weeklyJson: `docs/research/gates/gate90/artifacts/oos-session-window-5w-oos4-adr005_ma25-s020-exp010-rsi506040-stoch100-3-100-6040/weekly-activation-truth.rows.json`
- weeklyCsv: `docs/research/gates/gate90/artifacts/oos-session-window-5w-oos4-adr005_ma25-s020-exp010-rsi506040-stoch100-3-100-6040/weekly-activation-truth.rows.csv`
- closeEventsJson: `docs/research/gates/gate90/artifacts/oos-session-window-5w-oos4-adr005_ma25-s020-exp010-rsi506040-stoch100-3-100-6040/close-events.rows.json`
- closeEventsCsv: `docs/research/gates/gate90/artifacts/oos-session-window-5w-oos4-adr005_ma25-s020-exp010-rsi506040-stoch100-3-100-6040/close-events.rows.csv`
- terminalInventoryJson: `docs/research/gates/gate90/artifacts/oos-session-window-5w-oos4-adr005_ma25-s020-exp010-rsi506040-stoch100-3-100-6040/terminal-inventory.rows.json`
- terminalInventoryCsv: `docs/research/gates/gate90/artifacts/oos-session-window-5w-oos4-adr005_ma25-s020-exp010-rsi506040-stoch100-3-100-6040/terminal-inventory.rows.csv`
- validationJson: `docs/research/gates/gate90/artifacts/oos-session-window-5w-oos4-adr005_ma25-s020-exp010-rsi506040-stoch100-3-100-6040/validation.rows.json`
- validationCsv: `docs/research/gates/gate90/artifacts/oos-session-window-5w-oos4-adr005_ma25-s020-exp010-rsi506040-stoch100-3-100-6040/validation.rows.csv`
- metricDefinitionsJson: `docs/research/gates/gate90/artifacts/oos-session-window-5w-oos4-adr005_ma25-s020-exp010-rsi506040-stoch100-3-100-6040/metric-definitions.rows.json`
- metricDefinitionsCsv: `docs/research/gates/gate90/artifacts/oos-session-window-5w-oos4-adr005_ma25-s020-exp010-rsi506040-stoch100-3-100-6040/metric-definitions.rows.csv`
- commandReceipt: `docs/research/gates/gate90/artifacts/oos-session-window-5w-oos4-adr005_ma25-s020-exp010-rsi506040-stoch100-3-100-6040/command-receipt.json`
- runSummaryJson: `docs/research/gates/gate90/artifacts/oos-session-window-5w-oos4-adr005_ma25-s020-exp010-rsi506040-stoch100-3-100-6040/gate90-run-summary.json`
- shaManifest: `docs/research/gates/gate90/artifacts/oos-session-window-5w-oos4-adr005_ma25-s020-exp010-rsi506040-stoch100-3-100-6040/gate90-activation-sha256.txt`
- report: `docs/research/gates/gate90/GATE90_OOS_SESSION_WINDOW_5W_OOS4_ADR005_MA25_S020_EXP010_RSI506040_STOCH100_3_100_6040_2026-07-02.md`

## Stop Line

Gate 90 is warehouse activation research only. Do not optimize MT5 lifecycle controls, retune target/spacing, promote strategy logic, or open double-sided in-between policy from this run.
