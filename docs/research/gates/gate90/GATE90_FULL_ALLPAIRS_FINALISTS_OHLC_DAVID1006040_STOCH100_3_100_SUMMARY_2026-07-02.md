# Gate 90 Grid Activation Accuracy One-Sided Selection

Generated: `2026-07-02T05:35:21.824Z`

## Verdict

`PASS_GATE90_GRID_ACTIVATION_ONE_SIDED_SELECTION_BUILT_DIAGNOSTIC_ONLY`

## Scope

- Continuous warehouse truth replay with one-sided activation gates.
- Variants: `RAW_GRID_T100_S020_GATE90_RAW_BOTH,RAW_GRID_T100_S020_GATE90_DAVID_STOCH_RELEASE,RAW_GRID_T100_S020_GATE90_DAVID_CONTRA,RAW_GRID_T100_S020_GATE90_DAVID_STOCH_CONFIRM`.
- Activation rules: `raw_both,david_stoch_release,david_contra,david_stoch_confirm`.
- Signal settings id: `DAVID_LWMA35_RSI100_60_40__STOCH_100_3_100_80_20_low_high_simple_main_only`.
- David MA settings: LWMA `35`, close price, RSI `100`, overbought `60`, oversold `40`.
- Stochastic settings: K `100`, D `3`, slowing `100`, OB/OS `80/20`, Low/High, Simple, main line only.
- Summary-only output: `true`.
- Activation uses closed warehouse bars and controls only missing side-cycle starts.
- Target `1` ADR, spacing `0.2` ADR, lot size `0.01`.
- Bar path mode: `ohlc_high_low`.
- Carries side-grid positions across warehouse week boundaries.
- Target resets are based on price ADR PnL only, matching the EA leg-reset decision.
- Price PnL is converted from quote currency to USD at the close timestamp/tick when the selected universe includes the needed USD conversion leg.
- Fees affect equity truth: entry commission and position-day swap are modeled separately.
- Terminal liquidation is explicit and reported separately.
- No MT5 implementation, target/spacing optimization, pair-specific swap ingestion, margin stopout simulator, app/live integration, promotion, live-readiness, or double-sided in-between policy.

## Summary

| variant_id | activation_rule_id | signal_settings_id | symbol_universe | bar_path_mode | weeks_replayed | pairs_replayed | final_balance_usd | net_profit_usd | closed_price_pnl_usd | end_liquidation_price_pnl_usd | total_commission_usd | total_swap_usd | entries_opened | end_liquidation_positions | max_open_positions | max_add_depth | max_equity_drawdown_usd | activation_started_long | activation_started_short | activation_blocked_long | activation_blocked_short | activation_long_allow_pct | activation_short_allow_pct | summary_only |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| RAW_GRID_T100_S020_GATE90_RAW_BOTH | raw_both | DAVID_LWMA35_RSI100_60_40__STOCH_100_3_100_80_20_low_high_simple_main_only | AUDCAD,AUDCHF,AUDJPY,AUDNZD,AUDUSD,CADCHF,CADJPY,CHFJPY,EURAUD,EURCAD,EURCHF,EURGBP,EURJPY,EURNZD,EURUSD,GBPAUD,GBPCAD,GBPCHF,GBPJPY,GBPNZD,GBPUSD,NZDCAD,NZDCHF,NZDJPY,NZDUSD,USDCAD,USDCHF,USDJPY | ohlc_high_low | 373 | 28 | 58141.7 | 48141.7 | 439901.69 | -238722.32 | -16175.46 | -136862.21 | 269591 | 2558 | 2856 | 249 | -119605.92 | 24513 | 24966 | 0 | 0 | 100 | 100 | true |
| RAW_GRID_T100_S020_GATE90_DAVID_STOCH_RELEASE | david_stoch_release | DAVID_LWMA35_RSI100_60_40__STOCH_100_3_100_80_20_low_high_simple_main_only | AUDCAD,AUDCHF,AUDJPY,AUDNZD,AUDUSD,CADCHF,CADJPY,CHFJPY,EURAUD,EURCAD,EURCHF,EURGBP,EURJPY,EURNZD,EURUSD,GBPAUD,GBPCAD,GBPCHF,GBPJPY,GBPNZD,GBPUSD,NZDCAD,NZDCHF,NZDJPY,NZDUSD,USDCAD,USDCHF,USDJPY | ohlc_high_low | 373 | 28 | 90156.4 | 80156.4 | 271118.16 | -117235.84 | -9576.24 | -64149.69 | 159604 | 968 | 1286 | 249 | -54509.25 | 15019 | 14613 | 116329676 | 110203377 | 0.02 | 0.01 | true |
| RAW_GRID_T100_S020_GATE90_DAVID_CONTRA | david_contra | DAVID_LWMA35_RSI100_60_40__STOCH_100_3_100_80_20_low_high_simple_main_only | AUDCAD,AUDCHF,AUDJPY,AUDNZD,AUDUSD,CADCHF,CADJPY,CHFJPY,EURAUD,EURCAD,EURCHF,EURGBP,EURJPY,EURNZD,EURUSD,GBPAUD,GBPCAD,GBPCHF,GBPJPY,GBPNZD,GBPUSD,NZDCAD,NZDCHF,NZDJPY,NZDUSD,USDCAD,USDCHF,USDJPY | ohlc_high_low | 373 | 28 | 133539.9 | 123539.9 | 348196.09 | -134866.45 | -12717.3 | -77072.44 | 211955 | 1689 | 1884 | 249 | -65451.04 | 20456 | 18973 | 72142948 | 69276043 | 3.75 | 0.03 | true |
| RAW_GRID_T100_S020_GATE90_DAVID_STOCH_CONFIRM | david_stoch_confirm | DAVID_LWMA35_RSI100_60_40__STOCH_100_3_100_80_20_low_high_simple_main_only | AUDCAD,AUDCHF,AUDJPY,AUDNZD,AUDUSD,CADCHF,CADJPY,CHFJPY,EURAUD,EURCAD,EURCHF,EURGBP,EURJPY,EURNZD,EURUSD,GBPAUD,GBPCAD,GBPCHF,GBPJPY,GBPNZD,GBPUSD,NZDCAD,NZDCHF,NZDJPY,NZDUSD,USDCAD,USDCHF,USDJPY | ohlc_high_low | 373 | 28 | 66335.77 | 56335.77 | 265499.07 | -132086.43 | -9876.18 | -67200.7 | 164603 | 1533 | 1554 | 249 | -70035.51 | 15520 | 14953 | 112596618 | 106250473 | 0.18 | 0.01 | true |

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
| activation_started_long/short | number of initial side cycles started after the activation gate allowed that side |
| activation_blocked_long/short | number of missing-side start checks rejected by the activation gate |

## Validation

| check | value | expected | passed |
|---|---|---|---|
| gate74b_verdict | PASS_GATE74B_TRADE_LEG_PATH_MATERIALIZATION__POLICY_NEUTRAL_PAIR_WEEK_PATH_WAREHOUSE_READY | PASS_GATE74B | true |
| continuous_carried_inventory | true | true | true |
| weekly_sample_end_close_disabled | true | true | true |
| target_reset_uses_price_adr_pnl | true | true | true |
| bar_path_mode | ohlc_high_low | explicit | true |
| quote_currency_pnl_converted_to_usd | true | true | true |
| swap_triggers_target_reset | false | false | true |
| activation_rule_ids | raw_both,david_stoch_release,david_contra,david_stoch_confirm | explicit | true |
| activation_controls_initial_cycle_start_only | true | true | true |
| david_ma_settings | LWMA35_RSI100_60_40 | explicit CLI/default settings | true |
| stochastic_settings | 100_3_100_80_20_low_high_simple_main_only | explicit CLI/default settings | true |
| summary_only | true | explicit | true |
| commission_per_entry_per_001_lot_usd | 0.06 | 0.06 | true |
| eurusd_long_swap_per_001_lot_day_usd | -0.0917 | MT5-derived approx | true |
| eurusd_short_swap_per_001_lot_day_usd | 0.01 | MT5-derived approx | true |
| selected_week_count | 373 | >=1 | true |
| selected_pair_count | 28 | >=1 | true |

## Artifacts

- summaryJson: `docs/research/gates/gate90/artifacts/full-allpairs-finalists-ohlc-david1006040-stoch100-3-100-summary/activation-summary.rows.json`
- summaryCsv: `docs/research/gates/gate90/artifacts/full-allpairs-finalists-ohlc-david1006040-stoch100-3-100-summary/activation-summary.rows.csv`
- weeklyJson: `docs/research/gates/gate90/artifacts/full-allpairs-finalists-ohlc-david1006040-stoch100-3-100-summary/weekly-activation-truth.rows.json`
- weeklyCsv: `docs/research/gates/gate90/artifacts/full-allpairs-finalists-ohlc-david1006040-stoch100-3-100-summary/weekly-activation-truth.rows.csv`
- closeEventsJson: `docs/research/gates/gate90/artifacts/full-allpairs-finalists-ohlc-david1006040-stoch100-3-100-summary/close-events.rows.json`
- closeEventsCsv: `docs/research/gates/gate90/artifacts/full-allpairs-finalists-ohlc-david1006040-stoch100-3-100-summary/close-events.rows.csv`
- validationJson: `docs/research/gates/gate90/artifacts/full-allpairs-finalists-ohlc-david1006040-stoch100-3-100-summary/validation.rows.json`
- validationCsv: `docs/research/gates/gate90/artifacts/full-allpairs-finalists-ohlc-david1006040-stoch100-3-100-summary/validation.rows.csv`
- metricDefinitionsJson: `docs/research/gates/gate90/artifacts/full-allpairs-finalists-ohlc-david1006040-stoch100-3-100-summary/metric-definitions.rows.json`
- metricDefinitionsCsv: `docs/research/gates/gate90/artifacts/full-allpairs-finalists-ohlc-david1006040-stoch100-3-100-summary/metric-definitions.rows.csv`
- commandReceipt: `docs/research/gates/gate90/artifacts/full-allpairs-finalists-ohlc-david1006040-stoch100-3-100-summary/command-receipt.json`
- runSummaryJson: `docs/research/gates/gate90/artifacts/full-allpairs-finalists-ohlc-david1006040-stoch100-3-100-summary/gate90-run-summary.json`
- shaManifest: `docs/research/gates/gate90/artifacts/full-allpairs-finalists-ohlc-david1006040-stoch100-3-100-summary/gate90-activation-sha256.txt`
- report: `docs/research/gates/gate90/GATE90_FULL_ALLPAIRS_FINALISTS_OHLC_DAVID1006040_STOCH100_3_100_SUMMARY_2026-07-02.md`

## Stop Line

Gate 90 is warehouse activation research only. Do not optimize MT5 lifecycle controls, retune target/spacing, promote strategy logic, or open double-sided in-between policy from this run.
