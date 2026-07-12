# Gate 90 Grid Activation Accuracy One-Sided Selection

Generated: `2026-07-03T02:59:18.682Z`

## Verdict

`PASS_GATE90_GRID_ACTIVATION_ONE_SIDED_SELECTION_BUILT_DIAGNOSTIC_ONLY`

## Scope

- Warehouse truth replay with one-sided activation gates and explicit session mode controls.
- Variants: `RAW_GRID_T100_S020_GATE90_TRIANGLE_V1_DAVID_CONTRA_EXTENSION`.
- Activation rules: `triangle_v1_david_contra_extension`.
- Triangle v0 formula is disabled for this run.

- Triangle v1 formula id: `gate90d_triangle_v1_geometry_extension_start_scaffold_2026_07_03`; starts require valid harvestable session geometry, session-mid extension, and Candidate B / David direction permission. Strict Katarakti is not required for v1 starts.
- Triangle v1 spacing is per-cycle adaptive: completed session range / `3`, clamped to `0.2..0.3` ADR; close-event rows emit `cycle_spacing_adr` and `triangle_trigger_key`.
- Signal settings id: `DAVID_LWMA50_RSI50_60_40__STOCH_100_3_100_60_40_low_high_simple_main_only`.
- David MA settings: LWMA `50`, close price, RSI `50`, overbought `60`, oversold `40`.
- Stochastic settings: K `100`, D `3`, slowing `100`, OB/OS `60/40`, Low/High, Simple, main line only.
- Signal clock: `adr_event`, ADR event brick `0.075`.
- Session mode: `ny_daily_window`, time zone `America/New_York`, trade window start `18:05`, trade cutoff `15:45`, flatten `16:00`, Sunday start `20:00`, flatten overrides `none`.
- Summary-only output: `false`.
- Activation uses closed warehouse bars and controls only missing side-cycle starts.
- Target mode `david_ma_reversion`, fixed target `1` ADR used only by fixed_adr mode, spacing `0.2` ADR, minimum MA expansion `0.1` ADR, grid add mode `adverse_only`, lot size `0.01`.
- Bar path mode: `open`.
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

| variant_id | activation_rule_id | signal_settings_id | symbol_universe | bar_path_mode | signal_clock | signal_adr_brick | session_mode | session_trade_start_et | session_trade_end_et | session_flatten_et | session_sunday_start_et | target_mode | target_adr | spacing_adr | min_ma_expansion_adr | grid_add_mode | weeks_replayed | pairs_replayed | final_balance_usd | net_profit_usd | closed_price_pnl_usd | end_liquidation_price_pnl_usd | total_commission_usd | total_swap_usd | session_flatten_count | session_flatten_positions | session_flatten_price_pnl_usd | session_flatten_swap_usd | entries_opened | end_liquidation_positions | max_open_positions | max_add_depth | max_equity_drawdown_usd | weekly_equity_profit_factor | close_event_count | close_event_profit_factor | close_event_win_pct | close_event_avg_realized_pnl_adr | close_event_avg_mfe_adr | close_event_avg_mae_adr_abs | close_event_mfe_1q_hit_pct | close_event_mfe_2q_hit_pct | close_event_mfe_3q_hit_pct | close_event_mae_1q_hit_pct | close_event_mae_2q_hit_pct | close_event_mae_3q_hit_pct | target_close_net_usd | session_flatten_close_net_usd | activation_started_long | activation_started_short | activation_blocked_long | activation_blocked_short | activation_blocked_expansion | activation_long_allow_pct | activation_short_allow_pct | summary_only |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| RAW_GRID_T100_S020_GATE90_TRIANGLE_V1_DAVID_CONTRA_EXTENSION | triangle_v1_david_contra_extension | DAVID_LWMA50_RSI50_60_40__STOCH_100_3_100_60_40_low_high_simple_main_only | AUDCAD,AUDCHF,AUDJPY,AUDNZD,AUDUSD,CADCHF,CADJPY,CHFJPY,EURAUD,EURCAD,EURCHF,EURGBP,EURJPY,EURNZD,EURUSD,GBPAUD,GBPCAD,GBPCHF,GBPJPY,GBPNZD,GBPUSD,NZDCAD,NZDCHF,NZDJPY,NZDUSD,USDCAD,USDCHF,USDJPY | open | adr_event | 0.075 | ny_daily_window | 18:05 | 15:45 | 16:00 | 20:00 | david_ma_reversion | 1 | 0.2 | 0.1 | adverse_only | 38 | 28 | 9926.34 | -73.66 | 986.34 | 0 | -934.02 | -125.98 | 1417 | 2931 | -3952.62 | -95.98 | 15567 | 0 | 106 | 13 | -991.56 | 0.955855 | 12363 | 0.984393 | 62.7 | 0.014352 | 0.084869 | 0.204106 | 9.12 | 1.96 | 0.59 | 15.16 | 8.92 | 5.44 | 4150.8 | -4224.46 | 6239 | 6124 | 5590268 | 5669623 | 12883 | 0.11 | 0.11 | false |

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
| bar_path_mode | intrabar path used for each warehouse M1 bar; open/close modes use one mark per bar, OHLC modes synthesize four tester-like marks per bar |
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
| triangle_v0 | Gate 90D scaffold rule that starts only after a completed session range sweep, rejection, displacement, point-in-time harvestable path geometry, and Candidate/David alignment gate |
| triangle_v0_no_candidate_b | Gate 90D diagnostic rule that keeps the Triangle trigger and geometry but removes Candidate B from the direction gate and requires David-only side agreement |
| triangle_v1_candidate_b_extension | Gate 90D v1 scaffold rule that starts on valid harvestable session geometry plus session-mid extension in Candidate B side; Katarakti is not required |
| triangle_v1_david_contra_extension | Gate 90D v1 scaffold rule that starts on valid harvestable session geometry plus session-mid extension in David contra side; Katarakti is not required |
| triangle_v1_candidate_or_david_extension | Gate 90D v1 scaffold rule that starts on valid harvestable session geometry plus session-mid extension when Candidate B or David contra permits the side |
| cycle_spacing_adr | actual ADR spacing assigned to the side cycle at start; triangle_v0 uses completed session range divided into target slots and clamped to the configured rails |
| triangle_trigger_key | stable provenance key for the session box, side, sweep, and displacement trigger that started a triangle_v0 cycle |
| triangle_v0_formula_id | scaffold formula identifier for the Gate 90D bounded Triangle v0 replay path |
| min_ma_expansion_adr | minimum side-specific distance from current David MA required before a missing side can start; long requires price below MA, short requires price above MA |
| grid_add_mode | adverse_and_favorable keeps both recovery and favorable expansion adds; adverse_only adds only when price moves against the side from its cycle anchor |
| close_event_profit_factor | gross winning close-cycle net USD divided by absolute gross losing close-cycle net USD; computed even in summary-only mode without retaining close-event rows |
| close_event_win_pct | winning close-cycle count divided by all close cycles; target, session_flatten, and end_of_test close reasons are included |
| close_event_avg_realized_pnl_adr | average realized price PnL per closed side cycle in ADR units, before commission and swap |
| close_event_avg_mfe_adr | average Maximum Favorable Excursion per closed side cycle in ADR units, computed from observed cycle max_pnl_adr |
| close_event_avg_mae_adr_abs | average absolute Maximum Adverse Excursion per closed side cycle in ADR units, computed from observed negative cycle min_pnl_adr |
| close_event_mfe_1q/2q/3q_hit_pct | share of closed side cycles whose observed MFE reached at least one, two, or three cycle-spacing quanta before close |
| close_event_mae_1q/2q/3q_hit_pct | share of closed side cycles whose observed MAE reached at least one, two, or three cycle-spacing quanta before close |
| close_event_start_timestamp_utc | cycle start timestamp emitted on close-event rows for downstream start-level trigger traceability |
| close_event_cycle_id | stable side-cycle identifier emitted on close-event rows so close outcomes can be matched to cycle starts |
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
| spacing_adr | 0.2 | >0 | true |
| signal_clock | adr_event | explicit | true |
| signal_adr_brick | 0.075 | >0 | true |
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
| bar_path_mode | open | explicit | true |
| quote_currency_pnl_converted_to_usd | true | true | true |
| swap_triggers_target_reset | false | false | true |
| activation_rule_ids | triangle_v1_david_contra_extension | explicit | true |
| activation_controls_initial_cycle_start_only | true | true | true |
| triangle_v0_enabled | false | true when activation_rule_ids includes a triangle_v0 rule | true |
| triangle_v0_formula_id |  | visible when a triangle_v0 rule is enabled | true |
| triangle_v0_spacing_rails_adr |  | range/3 clamped rails when a triangle_v0 rule is enabled | true |
| triangle_v0_traceability_columns |  | close-events and terminal-inventory rows carry trigger provenance | true |
| triangle_v1_enabled | true | true when activation_rule_ids includes a triangle_v1 rule | true |
| triangle_v1_formula_id | gate90d_triangle_v1_geometry_extension_start_scaffold_2026_07_03 | visible when a triangle_v1 rule is enabled | true |
| triangle_v1_start_gate | valid_geometry_session_mid_extension_direction_permission | geometry plus extension plus Candidate B/David permission | true |
| david_ma_settings | LWMA50_RSI50_60_40 | explicit CLI/default settings | true |
| stochastic_settings | 100_3_100_60_40_low_high_simple_main_only | explicit CLI/default settings | true |
| summary_only | false | explicit | true |
| commission_per_entry_per_001_lot_usd | 0.06 | 0.06 | true |
| eurusd_long_swap_per_001_lot_day_usd | -0.0917 | MT5-derived approx | true |
| eurusd_short_swap_per_001_lot_day_usd | 0.01 | MT5-derived approx | true |
| selected_week_count | 38 | >=1 | true |
| selected_pair_count | 28 | >=1 | true |

## Artifacts

- summaryJson: `docs/research/gates/gate90/artifacts/gate90d-triangle-v1-open-2019-david-only-full-mfe/activation-summary.rows.json`
- summaryCsv: `docs/research/gates/gate90/artifacts/gate90d-triangle-v1-open-2019-david-only-full-mfe/activation-summary.rows.csv`
- weeklyJson: `docs/research/gates/gate90/artifacts/gate90d-triangle-v1-open-2019-david-only-full-mfe/weekly-activation-truth.rows.json`
- weeklyCsv: `docs/research/gates/gate90/artifacts/gate90d-triangle-v1-open-2019-david-only-full-mfe/weekly-activation-truth.rows.csv`
- closeEventsJson: `docs/research/gates/gate90/artifacts/gate90d-triangle-v1-open-2019-david-only-full-mfe/close-events.rows.json`
- closeEventsCsv: `docs/research/gates/gate90/artifacts/gate90d-triangle-v1-open-2019-david-only-full-mfe/close-events.rows.csv`
- terminalInventoryJson: `docs/research/gates/gate90/artifacts/gate90d-triangle-v1-open-2019-david-only-full-mfe/terminal-inventory.rows.json`
- terminalInventoryCsv: `docs/research/gates/gate90/artifacts/gate90d-triangle-v1-open-2019-david-only-full-mfe/terminal-inventory.rows.csv`
- validationJson: `docs/research/gates/gate90/artifacts/gate90d-triangle-v1-open-2019-david-only-full-mfe/validation.rows.json`
- validationCsv: `docs/research/gates/gate90/artifacts/gate90d-triangle-v1-open-2019-david-only-full-mfe/validation.rows.csv`
- metricDefinitionsJson: `docs/research/gates/gate90/artifacts/gate90d-triangle-v1-open-2019-david-only-full-mfe/metric-definitions.rows.json`
- metricDefinitionsCsv: `docs/research/gates/gate90/artifacts/gate90d-triangle-v1-open-2019-david-only-full-mfe/metric-definitions.rows.csv`
- commandReceipt: `docs/research/gates/gate90/artifacts/gate90d-triangle-v1-open-2019-david-only-full-mfe/command-receipt.json`
- runSummaryJson: `docs/research/gates/gate90/artifacts/gate90d-triangle-v1-open-2019-david-only-full-mfe/gate90-run-summary.json`
- shaManifest: `docs/research/gates/gate90/artifacts/gate90d-triangle-v1-open-2019-david-only-full-mfe/gate90-activation-sha256.txt`
- report: `docs/research/gates/gate90/artifacts/gate90d-triangle-v1-open-2019-david-only-full-mfe/GATE90D_TRIANGLE_V1_OPEN_2019_DAVID_ONLY_FULL_MFE.md`

## Stop Line

Gate 90 is warehouse activation research only. Do not optimize MT5 lifecycle controls, retune target/spacing, promote strategy logic, or open double-sided in-between policy from this run.
