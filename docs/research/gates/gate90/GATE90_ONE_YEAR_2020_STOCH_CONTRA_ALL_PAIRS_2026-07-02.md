# Gate 90 Grid Activation Accuracy One-Sided Selection

Generated: `2026-07-02T02:29:22.740Z`

## Verdict

`PASS_GATE90_GRID_ACTIVATION_ONE_SIDED_SELECTION_BUILT_DIAGNOSTIC_ONLY`

## Scope

- Continuous warehouse truth replay with one-sided activation gates.
- Variant: `RAW_GRID_T100_S020_GATE90_STOCH_CONTRA`.
- Activation rule: `stoch_contra`.
- David MA settings: LWMA `35`, close price, RSI `21`, overbought `80`, oversold `20`.
- Stochastic settings: `100,3,21`, Low/High, Simple, main line only.
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

| variant_id | activation_rule_id | symbol_universe | bar_path_mode | weeks_replayed | pairs_replayed | final_balance_usd | net_profit_usd | closed_price_pnl_usd | end_liquidation_price_pnl_usd | total_commission_usd | total_swap_usd | entries_opened | end_liquidation_positions | max_open_positions | max_add_depth | max_equity_drawdown_usd | activation_started_long | activation_started_short | activation_blocked_long | activation_blocked_short | activation_long_allow_pct | activation_short_allow_pct |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| RAW_GRID_T100_S020_GATE90_STOCH_CONTRA | stoch_contra | AUDCAD,AUDCHF,AUDJPY,AUDNZD,AUDUSD,CADCHF,CADJPY,CHFJPY,EURAUD,EURCAD,EURCHF,EURGBP,EURJPY,EURNZD,EURUSD,GBPAUD,GBPCAD,GBPCHF,GBPJPY,GBPNZD,GBPUSD,NZDCAD,NZDCHF,NZDJPY,NZDUSD,USDCAD,USDCHF,USDJPY | ohlc_high_low | 52 | 28 | 12547.46 | 2547.46 | 68800.83 | -51515.33 | -2307.96 | -12430.09 | 38466 | 1460 | 1575 | 174 | -24229.05 | 3576 | 3572 | 2958861 | 2862425 | 0.12 | 0.12 |

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
| activation_rule_id | stoch_contra | explicit | true |
| activation_controls_initial_cycle_start_only | true | true | true |
| david_ma_settings | LWMA35_RSI21_80_20 | screenshot/template settings | true |
| stochastic_settings | 100_3_21_low_high_simple | screenshot/template settings | true |
| commission_per_entry_per_001_lot_usd | 0.06 | 0.06 | true |
| eurusd_long_swap_per_001_lot_day_usd | -0.0917 | MT5-derived approx | true |
| eurusd_short_swap_per_001_lot_day_usd | 0.01 | MT5-derived approx | true |
| selected_week_count | 52 | >=1 | true |
| selected_pair_count | 28 | >=1 | true |

## Artifacts

- summaryJson: `docs/research/gates/gate90/artifacts/one-year-2020-stoch_contra/activation-summary.rows.json`
- summaryCsv: `docs/research/gates/gate90/artifacts/one-year-2020-stoch_contra/activation-summary.rows.csv`
- weeklyJson: `docs/research/gates/gate90/artifacts/one-year-2020-stoch_contra/weekly-activation-truth.rows.json`
- weeklyCsv: `docs/research/gates/gate90/artifacts/one-year-2020-stoch_contra/weekly-activation-truth.rows.csv`
- closeEventsJson: `docs/research/gates/gate90/artifacts/one-year-2020-stoch_contra/close-events.rows.json`
- closeEventsCsv: `docs/research/gates/gate90/artifacts/one-year-2020-stoch_contra/close-events.rows.csv`
- validationJson: `docs/research/gates/gate90/artifacts/one-year-2020-stoch_contra/validation.rows.json`
- validationCsv: `docs/research/gates/gate90/artifacts/one-year-2020-stoch_contra/validation.rows.csv`
- metricDefinitionsJson: `docs/research/gates/gate90/artifacts/one-year-2020-stoch_contra/metric-definitions.rows.json`
- metricDefinitionsCsv: `docs/research/gates/gate90/artifacts/one-year-2020-stoch_contra/metric-definitions.rows.csv`
- commandReceipt: `docs/research/gates/gate90/artifacts/one-year-2020-stoch_contra/command-receipt.json`
- runSummaryJson: `docs/research/gates/gate90/artifacts/one-year-2020-stoch_contra/gate90-run-summary.json`
- shaManifest: `docs/research/gates/gate90/artifacts/one-year-2020-stoch_contra/gate90-activation-sha256.txt`
- report: `docs/research/gates/gate90/GATE90_ONE_YEAR_2020_STOCH_CONTRA_ALL_PAIRS_2026-07-02.md`

## Stop Line

Gate 90 is warehouse activation research only. Do not optimize MT5 lifecycle controls, retune target/spacing, promote strategy logic, or open double-sided in-between policy from this run.
