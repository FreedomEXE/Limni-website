# Gate 90 Grid Activation Accuracy One-Sided Selection

Generated: `2026-07-02T18:16:28.464Z`

## Verdict

`PASS_GATE90_GRID_ACTIVATION_ONE_SIDED_SELECTION_BUILT_DIAGNOSTIC_ONLY`

## Scope

- Warehouse truth replay with one-sided activation gates and explicit session mode controls.
- Variants: `RAW_GRID_T100_S020_GATE90_RAW_BOTH,RAW_GRID_T100_S020_GATE90_DAVID_CONTRA,RAW_GRID_T100_S020_GATE90_CANDIDATE_B,RAW_GRID_T100_S020_GATE90_CANDIDATE_B_DAVID_CONTRA_CONFIRM,RAW_GRID_T100_S020_GATE90_CANDIDATE_B_DAVID_CONTRA_CONFLICT_CANDIDATE,RAW_GRID_T100_S020_GATE90_STOCH_CONTRA,RAW_GRID_T100_S020_GATE90_DAVID_STOCH_CONFIRM`.
- Activation rules: `raw_both,david_contra,candidate_b,candidate_b_david_contra_confirm,candidate_b_david_contra_conflict_candidate,stoch_contra,david_stoch_confirm`.
- Signal settings id: `DAVID_LWMA25_RSI50_60_40__STOCH_100_3_100_60_40_low_high_simple_main_only`.
- David MA settings: LWMA `25`, close price, RSI `50`, overbought `60`, oversold `40`.
- Stochastic settings: K `100`, D `3`, slowing `100`, OB/OS `60/40`, Low/High, Simple, main line only.
- Signal clock: `adr_event`, ADR event brick `0.025`.
- Session mode: `ny_daily_window`, time zone `America/New_York`, trade window start `18:05`, trade cutoff `15:45`, flatten `16:00`, Sunday start `20:00`, flatten overrides `none`.
- Summary-only output: `true`.
- Activation uses closed warehouse bars and controls only missing side-cycle starts.
- Target mode `david_ma_reversion`, fixed target `1` ADR used only by fixed_adr mode, spacing `0.1` ADR, minimum MA expansion `0.1` ADR, grid add mode `adverse_only`, lot size `0.01`.
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

| variant_id | activation_rule_id | signal_settings_id | symbol_universe | bar_path_mode | signal_clock | signal_adr_brick | session_mode | session_trade_start_et | session_trade_end_et | session_flatten_et | session_sunday_start_et | target_mode | target_adr | spacing_adr | min_ma_expansion_adr | grid_add_mode | weeks_replayed | pairs_replayed | final_balance_usd | net_profit_usd | closed_price_pnl_usd | end_liquidation_price_pnl_usd | total_commission_usd | total_swap_usd | session_flatten_count | session_flatten_positions | session_flatten_price_pnl_usd | session_flatten_swap_usd | entries_opened | end_liquidation_positions | max_open_positions | max_add_depth | max_equity_drawdown_usd | weekly_equity_profit_factor | close_event_count | close_event_profit_factor | close_event_win_pct | target_close_net_usd | session_flatten_close_net_usd | activation_started_long | activation_started_short | activation_blocked_long | activation_blocked_short | activation_blocked_expansion | activation_long_allow_pct | activation_short_allow_pct | summary_only |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| RAW_GRID_T100_S020_GATE90_RAW_BOTH | raw_both | DAVID_LWMA25_RSI50_60_40__STOCH_100_3_100_60_40_low_high_simple_main_only | AUDCAD,AUDCHF,AUDJPY,AUDNZD,AUDUSD,CADCHF,CADJPY,CHFJPY,EURAUD,EURCAD,EURCHF,EURGBP,EURJPY,EURNZD,EURUSD,GBPAUD,GBPCAD,GBPCHF,GBPJPY,GBPNZD,GBPUSD,NZDCAD,NZDCHF,NZDJPY,NZDUSD,USDCAD,USDCHF,USDJPY | ohlc_high_low | adr_event | 0.025 | ny_daily_window | 18:05 | 15:45 | 16:00 | 20:00 | david_ma_reversion | 1 | 0.1 | 0.1 | adverse_only | 1 | 28 | 10774.25 | 774.25 | 937.99 | 0 | -159.54 | -4.2 | 52 | 216 | -249.82 | -0.64 | 2659 | 0 | 23 | 13 | 0 |  | 1673 | 3.682302 | 89.3 | 1037.67 | -263.42 | 874 | 799 | 506068 | 489958 | 996026 | 0.17 | 0.16 | true |
| RAW_GRID_T100_S020_GATE90_DAVID_CONTRA | david_contra | DAVID_LWMA25_RSI50_60_40__STOCH_100_3_100_60_40_low_high_simple_main_only | AUDCAD,AUDCHF,AUDJPY,AUDNZD,AUDUSD,CADCHF,CADJPY,CHFJPY,EURAUD,EURCAD,EURCHF,EURGBP,EURJPY,EURNZD,EURUSD,GBPAUD,GBPCAD,GBPCHF,GBPJPY,GBPNZD,GBPUSD,NZDCAD,NZDCHF,NZDJPY,NZDUSD,USDCAD,USDCHF,USDJPY | ohlc_high_low | adr_event | 0.025 | ny_daily_window | 18:05 | 15:45 | 16:00 | 20:00 | david_ma_reversion | 1 | 0.1 | 0.1 | adverse_only | 1 | 28 | 10460.79 | 460.79 | 549.82 | 0 | -87.12 | -1.91 | 23 | 85 | -80.79 | -0.2 | 1452 | 0 | 19 | 13 | 0 |  | 912 | 5.513055 | 89.47 | 546.87 | -86.09 | 471 | 441 | 569860 | 559611 | 474227 | 0.08 | 0.08 | true |
| RAW_GRID_T100_S020_GATE90_CANDIDATE_B | candidate_b | DAVID_LWMA25_RSI50_60_40__STOCH_100_3_100_60_40_low_high_simple_main_only | AUDCAD,AUDCHF,AUDJPY,AUDNZD,AUDUSD,CADCHF,CADJPY,CHFJPY,EURAUD,EURCAD,EURCHF,EURGBP,EURJPY,EURNZD,EURUSD,GBPAUD,GBPCAD,GBPCHF,GBPJPY,GBPNZD,GBPUSD,NZDCAD,NZDCHF,NZDJPY,NZDUSD,USDCAD,USDCHF,USDJPY | ohlc_high_low | adr_event | 0.025 | ny_daily_window | 18:05 | 15:45 | 16:00 | 20:00 | david_ma_reversion | 1 | 0.1 | 0.1 | adverse_only | 1 | 28 | 10395.97 | 395.97 | 481.54 | 0 | -83.34 | -2.22 | 27 | 112 | -130.17 | -0.42 | 1389 | 0 | 16 | 13 | 0 |  | 852 | 3.6782 | 88.85 | 533.29 | -137.31 | 512 | 340 | 563772 | 570910 | 497638 | 0.09 | 0.06 | true |
| RAW_GRID_T100_S020_GATE90_CANDIDATE_B_DAVID_CONTRA_CONFIRM | candidate_b_david_contra_confirm | DAVID_LWMA25_RSI50_60_40__STOCH_100_3_100_60_40_low_high_simple_main_only | AUDCAD,AUDCHF,AUDJPY,AUDNZD,AUDUSD,CADCHF,CADJPY,CHFJPY,EURAUD,EURCAD,EURCHF,EURGBP,EURJPY,EURNZD,EURUSD,GBPAUD,GBPCAD,GBPCHF,GBPJPY,GBPNZD,GBPUSD,NZDCAD,NZDCHF,NZDJPY,NZDUSD,USDCAD,USDCHF,USDJPY | ohlc_high_low | adr_event | 0.025 | ny_daily_window | 18:05 | 15:45 | 16:00 | 20:00 | david_ma_reversion | 1 | 0.1 | 0.1 | adverse_only | 1 | 28 | 10286.38 | 286.38 | 338.74 | 0 | -51.18 | -1.19 | 16 | 64 | -58.05 | -0.24 | 853 | 0 | 16 | 13 | 0 |  | 528 | 5.176732 | 88.83 | 348.51 | -62.13 | 311 | 217 | 597330 | 598156 | 248898 | 0.05 | 0.04 | true |
| RAW_GRID_T100_S020_GATE90_CANDIDATE_B_DAVID_CONTRA_CONFLICT_CANDIDATE | candidate_b_david_contra_conflict_candidate | DAVID_LWMA25_RSI50_60_40__STOCH_100_3_100_60_40_low_high_simple_main_only | AUDCAD,AUDCHF,AUDJPY,AUDNZD,AUDUSD,CADCHF,CADJPY,CHFJPY,EURAUD,EURCAD,EURCHF,EURGBP,EURJPY,EURNZD,EURUSD,GBPAUD,GBPCAD,GBPCHF,GBPJPY,GBPNZD,GBPUSD,NZDCAD,NZDCHF,NZDJPY,NZDUSD,USDCAD,USDCHF,USDJPY | ohlc_high_low | adr_event | 0.025 | ny_daily_window | 18:05 | 15:45 | 16:00 | 20:00 | david_ma_reversion | 1 | 0.1 | 0.1 | adverse_only | 1 | 28 | 10143.15 | 143.15 | 184.5 | 0 | -40.26 | -1.09 | 15 | 69 | -88.06 | -0.13 | 671 | 0 | 13 | 12 | 0 |  | 400 | 2.470022 | 87.75 | 235.48 | -92.33 | 242 | 158 | 598831 | 601212 | 239492 | 0.04 | 0.03 | true |
| RAW_GRID_T100_S020_GATE90_STOCH_CONTRA | stoch_contra | DAVID_LWMA25_RSI50_60_40__STOCH_100_3_100_60_40_low_high_simple_main_only | AUDCAD,AUDCHF,AUDJPY,AUDNZD,AUDUSD,CADCHF,CADJPY,CHFJPY,EURAUD,EURCAD,EURCHF,EURGBP,EURJPY,EURNZD,EURUSD,GBPAUD,GBPCAD,GBPCHF,GBPJPY,GBPNZD,GBPUSD,NZDCAD,NZDCHF,NZDJPY,NZDUSD,USDCAD,USDCHF,USDJPY | ohlc_high_low | adr_event | 0.025 | ny_daily_window | 18:05 | 15:45 | 16:00 | 20:00 | david_ma_reversion | 1 | 0.1 | 0.1 | adverse_only | 1 | 28 | 10427.73 | 427.73 | 485.03 | 0 | -56.16 | -1.13 | 10 | 21 | -8.9 | -0.2 | 936 | 0 | 12 | 10 | 0 |  | 604 | 26.86789 | 91.56 | 438.09 | -10.36 | 338 | 266 | 594096 | 601184 | 307194 | 0.06 | 0.04 | true |
| RAW_GRID_T100_S020_GATE90_DAVID_STOCH_CONFIRM | david_stoch_confirm | DAVID_LWMA25_RSI50_60_40__STOCH_100_3_100_60_40_low_high_simple_main_only | AUDCAD,AUDCHF,AUDJPY,AUDNZD,AUDUSD,CADCHF,CADJPY,CHFJPY,EURAUD,EURCAD,EURCHF,EURGBP,EURJPY,EURNZD,EURUSD,GBPAUD,GBPCAD,GBPCHF,GBPJPY,GBPNZD,GBPUSD,NZDCAD,NZDCHF,NZDJPY,NZDUSD,USDCAD,USDCHF,USDJPY | ohlc_high_low | adr_event | 0.025 | ny_daily_window | 18:05 | 15:45 | 16:00 | 20:00 | david_ma_reversion | 1 | 0.1 | 0.1 | adverse_only | 1 | 28 | 10351.37 | 351.37 | 401.67 | 0 | -49.26 | -1.04 | 10 | 21 | -8.91 | -0.2 | 821 | 0 | 12 | 10 | 0 |  | 540 | 22.670585 | 90.93 | 361.74 | -10.37 | 298 | 242 | 598785 | 603535 | 245323 | 0.05 | 0.04 | true |

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
| close_event_profit_factor | gross winning close-cycle net USD divided by absolute gross losing close-cycle net USD; computed even in summary-only mode without retaining close-event rows |
| close_event_win_pct | winning close-cycle count divided by all close cycles; target, session_flatten, and end_of_test close reasons are included |
| target_close_net_usd | aggregate net USD from close cycles closed by target reset, including price PnL, commission, and swap |
| session_flatten_close_net_usd | aggregate net USD from close cycles force-closed by the configured session flatten boundary, including price PnL, commission, and swap |
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
| spacing_adr | 0.1 | >0 | true |
| signal_clock | adr_event | explicit | true |
| signal_adr_brick | 0.025 | >0 | true |
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
| activation_rule_ids | raw_both,david_contra,candidate_b,candidate_b_david_contra_confirm,candidate_b_david_contra_conflict_candidate,stoch_contra,david_stoch_confirm | explicit | true |
| activation_controls_initial_cycle_start_only | true | true | true |
| david_ma_settings | LWMA25_RSI50_60_40 | explicit CLI/default settings | true |
| stochastic_settings | 100_3_100_60_40_low_high_simple_main_only | explicit CLI/default settings | true |
| summary_only | true | explicit | true |
| commission_per_entry_per_001_lot_usd | 0.06 | 0.06 | true |
| eurusd_long_swap_per_001_lot_day_usd | -0.0917 | MT5-derived approx | true |
| eurusd_short_swap_per_001_lot_day_usd | 0.01 | MT5-derived approx | true |
| selected_week_count | 1 | >=1 | true |
| selected_pair_count | 28 | >=1 | true |

## Artifacts

- summaryJson: `docs/research/gates/gate90/artifacts/gate90c-speed-check-1w-ohlc-adr025_ma25_s1-after-lazy-conversion/activation-summary.rows.json`
- summaryCsv: `docs/research/gates/gate90/artifacts/gate90c-speed-check-1w-ohlc-adr025_ma25_s1-after-lazy-conversion/activation-summary.rows.csv`
- weeklyJson: `docs/research/gates/gate90/artifacts/gate90c-speed-check-1w-ohlc-adr025_ma25_s1-after-lazy-conversion/weekly-activation-truth.rows.json`
- weeklyCsv: `docs/research/gates/gate90/artifacts/gate90c-speed-check-1w-ohlc-adr025_ma25_s1-after-lazy-conversion/weekly-activation-truth.rows.csv`
- closeEventsJson: `docs/research/gates/gate90/artifacts/gate90c-speed-check-1w-ohlc-adr025_ma25_s1-after-lazy-conversion/close-events.rows.json`
- closeEventsCsv: `docs/research/gates/gate90/artifacts/gate90c-speed-check-1w-ohlc-adr025_ma25_s1-after-lazy-conversion/close-events.rows.csv`
- terminalInventoryJson: `docs/research/gates/gate90/artifacts/gate90c-speed-check-1w-ohlc-adr025_ma25_s1-after-lazy-conversion/terminal-inventory.rows.json`
- terminalInventoryCsv: `docs/research/gates/gate90/artifacts/gate90c-speed-check-1w-ohlc-adr025_ma25_s1-after-lazy-conversion/terminal-inventory.rows.csv`
- validationJson: `docs/research/gates/gate90/artifacts/gate90c-speed-check-1w-ohlc-adr025_ma25_s1-after-lazy-conversion/validation.rows.json`
- validationCsv: `docs/research/gates/gate90/artifacts/gate90c-speed-check-1w-ohlc-adr025_ma25_s1-after-lazy-conversion/validation.rows.csv`
- metricDefinitionsJson: `docs/research/gates/gate90/artifacts/gate90c-speed-check-1w-ohlc-adr025_ma25_s1-after-lazy-conversion/metric-definitions.rows.json`
- metricDefinitionsCsv: `docs/research/gates/gate90/artifacts/gate90c-speed-check-1w-ohlc-adr025_ma25_s1-after-lazy-conversion/metric-definitions.rows.csv`
- commandReceipt: `docs/research/gates/gate90/artifacts/gate90c-speed-check-1w-ohlc-adr025_ma25_s1-after-lazy-conversion/command-receipt.json`
- runSummaryJson: `docs/research/gates/gate90/artifacts/gate90c-speed-check-1w-ohlc-adr025_ma25_s1-after-lazy-conversion/gate90-run-summary.json`
- shaManifest: `docs/research/gates/gate90/artifacts/gate90c-speed-check-1w-ohlc-adr025_ma25_s1-after-lazy-conversion/gate90-activation-sha256.txt`
- report: `docs/research/gates/gate90/artifacts/gate90c-speed-check-1w-ohlc-adr025_ma25_s1-after-lazy-conversion/report.md`

## Stop Line

Gate 90 is warehouse activation research only. Do not optimize MT5 lifecycle controls, retune target/spacing, promote strategy logic, or open double-sided in-between policy from this run.
