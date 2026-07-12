# Gate 90 Grid Activation Accuracy One-Sided Selection

Generated: `2026-07-02T12:22:41.792Z`

## Verdict

`PASS_GATE90_GRID_ACTIVATION_ONE_SIDED_SELECTION_BUILT_DIAGNOSTIC_ONLY`

## Scope

- Continuous warehouse truth replay with one-sided activation gates.
- Variants: `RAW_GRID_T100_S020_GATE90_RAW_BOTH,RAW_GRID_T100_S020_GATE90_CANDIDATE_B,RAW_GRID_T100_S020_GATE90_DAVID_CONTRA,RAW_GRID_T100_S020_GATE90_STOCH_CONTRA,RAW_GRID_T100_S020_GATE90_DAVID_STOCH_CONFIRM,RAW_GRID_T100_S020_GATE90_DAVID_STOCH_RELEASE`.
- Activation rules: `raw_both,candidate_b,david_contra,stoch_contra,david_stoch_confirm,david_stoch_release`.
- Signal settings id: `DAVID_LWMA100_RSI50_60_40__STOCH_100_3_100_70_30_low_high_simple_main_only`.
- David MA settings: LWMA `100`, close price, RSI `50`, overbought `60`, oversold `40`.
- Stochastic settings: K `100`, D `3`, slowing `100`, OB/OS `70/30`, Low/High, Simple, main line only.
- Summary-only output: `true`.
- Activation uses closed warehouse bars and controls only missing side-cycle starts.
- Target mode `david_ma_reversion`, fixed target `1` ADR used only by fixed_adr mode, spacing `0.2` ADR, minimum MA expansion `0.1` ADR, grid add mode `adverse_only`, lot size `0.01`.
- Bar path mode: `ohlc_high_low`.
- Carries side-grid positions across warehouse week boundaries.
- Target resets use the selected target mode. fixed_adr uses price ADR PnL; david_ma_reversion closes only profitable returns to the current David MA.
- Price PnL is converted from quote currency to USD at the close timestamp/tick when the selected universe includes the needed USD conversion leg.
- Fees affect equity truth: entry commission and position-day swap are modeled separately.
- Terminal liquidation is explicit and reported separately.
- No MT5 implementation, target/spacing optimization, pair-specific swap ingestion, margin stopout simulator, app/live integration, promotion, live-readiness, or double-sided in-between policy.

## Summary

| variant_id | activation_rule_id | signal_settings_id | symbol_universe | bar_path_mode | target_mode | target_adr | spacing_adr | min_ma_expansion_adr | grid_add_mode | weeks_replayed | pairs_replayed | final_balance_usd | net_profit_usd | closed_price_pnl_usd | end_liquidation_price_pnl_usd | total_commission_usd | total_swap_usd | entries_opened | end_liquidation_positions | max_open_positions | max_add_depth | max_equity_drawdown_usd | activation_started_long | activation_started_short | activation_blocked_long | activation_blocked_short | activation_blocked_expansion | activation_long_allow_pct | activation_short_allow_pct | summary_only |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| RAW_GRID_T100_S020_GATE90_RAW_BOTH | raw_both | DAVID_LWMA100_RSI50_60_40__STOCH_100_3_100_70_30_low_high_simple_main_only | AUDCAD,AUDCHF,AUDJPY,AUDNZD,AUDUSD,CADCHF,CADJPY,CHFJPY,EURAUD,EURCAD,EURCHF,EURGBP,EURJPY,EURNZD,EURUSD,GBPAUD,GBPCAD,GBPCHF,GBPJPY,GBPNZD,GBPUSD,NZDCAD,NZDCHF,NZDJPY,NZDUSD,USDCAD,USDCHF,USDJPY | ohlc_high_low | david_ma_reversion | 1 | 0.2 | 0.1 | adverse_only | 5 | 28 | 12728.09 | 2728.09 | 3865.99 | -516.54 | -482.58 | -138.79 | 8043 | 139 | 176 | 21 | 0 | 2969 | 2899 | 2555480 | 2421372 | 4976852 | 0.12 | 0.12 | true |
| RAW_GRID_T100_S020_GATE90_CANDIDATE_B | candidate_b | DAVID_LWMA100_RSI50_60_40__STOCH_100_3_100_70_30_low_high_simple_main_only | AUDCAD,AUDCHF,AUDJPY,AUDNZD,AUDUSD,CADCHF,CADJPY,CHFJPY,EURAUD,EURCAD,EURCHF,EURGBP,EURJPY,EURNZD,EURUSD,GBPAUD,GBPCAD,GBPCHF,GBPJPY,GBPNZD,GBPUSD,NZDCAD,NZDCHF,NZDJPY,NZDUSD,USDCAD,USDCHF,USDJPY | ohlc_high_low | david_ma_reversion | 1 | 0.2 | 0.1 | adverse_only | 5 | 28 | 11191.12 | 1191.12 | 1928.11 | -404.54 | -231.78 | -100.67 | 3863 | 90 | 106 | 21 | -228.62 | 1382 | 1422 | 3023813 | 3028713 | 2396861 | 0.05 | 0.05 | true |
| RAW_GRID_T100_S020_GATE90_DAVID_CONTRA | david_contra | DAVID_LWMA100_RSI50_60_40__STOCH_100_3_100_70_30_low_high_simple_main_only | AUDCAD,AUDCHF,AUDJPY,AUDNZD,AUDUSD,CADCHF,CADJPY,CHFJPY,EURAUD,EURCAD,EURCHF,EURGBP,EURJPY,EURNZD,EURUSD,GBPAUD,GBPCAD,GBPCHF,GBPJPY,GBPNZD,GBPUSD,NZDCAD,NZDCHF,NZDJPY,NZDUSD,USDCAD,USDCHF,USDJPY | ohlc_high_low | david_ma_reversion | 1 | 0.2 | 0.1 | adverse_only | 5 | 28 | 12161.21 | 2161.21 | 3037.47 | -401.86 | -356.82 | -117.58 | 5947 | 117 | 168 | 26 | -8.12 | 2130 | 2045 | 2776072 | 2663908 | 2101328 | 0.08 | 0.08 | true |
| RAW_GRID_T100_S020_GATE90_STOCH_CONTRA | stoch_contra | DAVID_LWMA100_RSI50_60_40__STOCH_100_3_100_70_30_low_high_simple_main_only | AUDCAD,AUDCHF,AUDJPY,AUDNZD,AUDUSD,CADCHF,CADJPY,CHFJPY,EURAUD,EURCAD,EURCHF,EURGBP,EURJPY,EURNZD,EURUSD,GBPAUD,GBPCAD,GBPCHF,GBPJPY,GBPNZD,GBPUSD,NZDCAD,NZDCHF,NZDJPY,NZDUSD,USDCAD,USDCHF,USDJPY | ohlc_high_low | david_ma_reversion | 1 | 0.2 | 0.1 | adverse_only | 5 | 28 | 10616.18 | 616.18 | 1110.23 | -247.9 | -191.94 | -54.21 | 3199 | 77 | 117 | 17 | -176.42 | 1118 | 1202 | 3233613 | 3117330 | 923346 | 0.03 | 0.04 | true |
| RAW_GRID_T100_S020_GATE90_DAVID_STOCH_CONFIRM | david_stoch_confirm | DAVID_LWMA100_RSI50_60_40__STOCH_100_3_100_70_30_low_high_simple_main_only | AUDCAD,AUDCHF,AUDJPY,AUDNZD,AUDUSD,CADCHF,CADJPY,CHFJPY,EURAUD,EURCAD,EURCHF,EURGBP,EURJPY,EURNZD,EURUSD,GBPAUD,GBPCAD,GBPCHF,GBPJPY,GBPNZD,GBPUSD,NZDCAD,NZDCHF,NZDJPY,NZDUSD,USDCAD,USDCHF,USDJPY | ohlc_high_low | david_ma_reversion | 1 | 0.2 | 0.1 | adverse_only | 5 | 28 | 10549.59 | 549.59 | 1028.98 | -246.23 | -179.64 | -53.52 | 2994 | 77 | 113 | 17 | -183.31 | 1034 | 1109 | 3245369 | 3131193 | 695770 | 0.03 | 0.04 | true |
| RAW_GRID_T100_S020_GATE90_DAVID_STOCH_RELEASE | david_stoch_release | DAVID_LWMA100_RSI50_60_40__STOCH_100_3_100_70_30_low_high_simple_main_only | AUDCAD,AUDCHF,AUDJPY,AUDNZD,AUDUSD,CADCHF,CADJPY,CHFJPY,EURAUD,EURCAD,EURCHF,EURGBP,EURJPY,EURNZD,EURUSD,GBPAUD,GBPCAD,GBPCHF,GBPJPY,GBPNZD,GBPUSD,NZDCAD,NZDCHF,NZDJPY,NZDUSD,USDCAD,USDCHF,USDJPY | ohlc_high_low | david_ma_reversion | 1 | 0.2 | 0.1 | adverse_only | 5 | 28 | 10013.35 | 13.35 | 19.38 | -4.27 | -1.8 | 0.03 | 30 | 4 | 5 | 3 | -2.5 | 4 | 16 | 3683926 | 3673680 | 12640 | 0 | 0 | true |

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
| closed_price_pnl_usd | target-reset price PnL before swap and commission, with quote-currency PnL converted to USD at the close timestamp/tick when a USD conversion leg is selected |
| total_commission_usd | entry commission charged at MT5-observed 0.06 USD per 0.01 lot entry; exits have zero commission in the reference report |
| total_swap_usd | position-day carry fee accrued per fill by side using MT5-derived EURUSD average swap rates |
| end_liquidation_price_pnl_usd | price PnL from all positions still open at the final warehouse mark |
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
| continuous_carried_inventory | true | true | true |
| weekly_sample_end_close_disabled | true | true | true |
| target_reset_uses_selected_target_mode | david_ma_reversion | fixed_adr_or_david_ma_reversion | true |
| target_mode | david_ma_reversion | explicit | true |
| target_adr | 1 | >0 | true |
| spacing_adr | 0.2 | >0 | true |
| min_ma_expansion_adr | 0.1 | >=0 | true |
| grid_add_mode | adverse_only | explicit | true |
| bar_path_mode | ohlc_high_low | explicit | true |
| quote_currency_pnl_converted_to_usd | true | true | true |
| swap_triggers_target_reset | false | false | true |
| activation_rule_ids | raw_both,candidate_b,david_contra,stoch_contra,david_stoch_confirm,david_stoch_release | explicit | true |
| activation_controls_initial_cycle_start_only | true | true | true |
| david_ma_settings | LWMA100_RSI50_60_40 | explicit CLI/default settings | true |
| stochastic_settings | 100_3_100_70_30_low_high_simple_main_only | explicit CLI/default settings | true |
| summary_only | true | explicit | true |
| commission_per_entry_per_001_lot_usd | 0.06 | 0.06 | true |
| eurusd_long_swap_per_001_lot_day_usd | -0.0917 | MT5-derived approx | true |
| eurusd_short_swap_per_001_lot_day_usd | 0.01 | MT5-derived approx | true |
| selected_week_count | 5 | >=1 | true |
| selected_pair_count | 28 | >=1 | true |

## Artifacts

- summaryJson: `docs/research/gates/gate90/artifacts/ma-expansion-adverse-only-stochfilter-levels-5w-ohlc-ma100-s020-exp010-rsi506040-stoch100-3-100-7030/activation-summary.rows.json`
- summaryCsv: `docs/research/gates/gate90/artifacts/ma-expansion-adverse-only-stochfilter-levels-5w-ohlc-ma100-s020-exp010-rsi506040-stoch100-3-100-7030/activation-summary.rows.csv`
- weeklyJson: `docs/research/gates/gate90/artifacts/ma-expansion-adverse-only-stochfilter-levels-5w-ohlc-ma100-s020-exp010-rsi506040-stoch100-3-100-7030/weekly-activation-truth.rows.json`
- weeklyCsv: `docs/research/gates/gate90/artifacts/ma-expansion-adverse-only-stochfilter-levels-5w-ohlc-ma100-s020-exp010-rsi506040-stoch100-3-100-7030/weekly-activation-truth.rows.csv`
- closeEventsJson: `docs/research/gates/gate90/artifacts/ma-expansion-adverse-only-stochfilter-levels-5w-ohlc-ma100-s020-exp010-rsi506040-stoch100-3-100-7030/close-events.rows.json`
- closeEventsCsv: `docs/research/gates/gate90/artifacts/ma-expansion-adverse-only-stochfilter-levels-5w-ohlc-ma100-s020-exp010-rsi506040-stoch100-3-100-7030/close-events.rows.csv`
- validationJson: `docs/research/gates/gate90/artifacts/ma-expansion-adverse-only-stochfilter-levels-5w-ohlc-ma100-s020-exp010-rsi506040-stoch100-3-100-7030/validation.rows.json`
- validationCsv: `docs/research/gates/gate90/artifacts/ma-expansion-adverse-only-stochfilter-levels-5w-ohlc-ma100-s020-exp010-rsi506040-stoch100-3-100-7030/validation.rows.csv`
- metricDefinitionsJson: `docs/research/gates/gate90/artifacts/ma-expansion-adverse-only-stochfilter-levels-5w-ohlc-ma100-s020-exp010-rsi506040-stoch100-3-100-7030/metric-definitions.rows.json`
- metricDefinitionsCsv: `docs/research/gates/gate90/artifacts/ma-expansion-adverse-only-stochfilter-levels-5w-ohlc-ma100-s020-exp010-rsi506040-stoch100-3-100-7030/metric-definitions.rows.csv`
- commandReceipt: `docs/research/gates/gate90/artifacts/ma-expansion-adverse-only-stochfilter-levels-5w-ohlc-ma100-s020-exp010-rsi506040-stoch100-3-100-7030/command-receipt.json`
- runSummaryJson: `docs/research/gates/gate90/artifacts/ma-expansion-adverse-only-stochfilter-levels-5w-ohlc-ma100-s020-exp010-rsi506040-stoch100-3-100-7030/gate90-run-summary.json`
- shaManifest: `docs/research/gates/gate90/artifacts/ma-expansion-adverse-only-stochfilter-levels-5w-ohlc-ma100-s020-exp010-rsi506040-stoch100-3-100-7030/gate90-activation-sha256.txt`
- report: `docs/research/gates/gate90/GATE90_MA_EXPANSION_ADVERSE_ONLY_STOCHFILTER_LEVELS_5W_OHLC_MA100_S020_EXP010_RSI506040_STOCH100_3_100_7030_2026-07-02.md`

## Stop Line

Gate 90 is warehouse activation research only. Do not optimize MT5 lifecycle controls, retune target/spacing, promote strategy logic, or open double-sided in-between policy from this run.
