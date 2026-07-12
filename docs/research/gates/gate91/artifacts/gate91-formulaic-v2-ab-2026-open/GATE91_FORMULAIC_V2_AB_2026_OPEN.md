# Gate 90 Grid Activation Accuracy One-Sided Selection

Generated: `2026-07-03T20:58:48.711Z`

## Verdict

`PASS_GATE90_GRID_ACTIVATION_ONE_SIDED_SELECTION_BUILT_DIAGNOSTIC_ONLY`

## Scope

- Warehouse truth replay with one-sided activation gates and explicit session mode controls.
- Variants: `RAW_GRID_T100_S020_GATE90_TRIANGLE_FORMULAIC_DIRECTIONLESS_GEOMETRY_V2,RAW_GRID_T100_S020_GATE90_TRIANGLE_FORMULAIC_DIRECTIONLESS_GEOMETRY_V2__PROTECT_PAIN_1Q_STOP_ADDS_BEFORE_PROFIT_0_5Q`.
- Activation rules: `triangle_formulaic_directionless_geometry_v2`.
- Protection modes: `baseline,pain_1q_stop_adds_before_profit_0_5q`.
- Triangle v0 formula is disabled for this run.

- Triangle v1 formula is disabled for this run.
- Gate 91 formulaic geometry is enabled: directionless first pass, no Candidate B or David side dependency.

- Gate 91 v2 formulaic geometry id: `gate91_formulaic_directionless_grid_geometry_v2_cost_bend_center_band_2026_07_03`; Q equation `Q = max(Q_cost, current_volatility_floor, R / (1 + sqrt(B_cost / Q_cost)))`, center `median M1 close`, signal event brick `max(Q / 4, Q_cost / 2)`, target band `max(Q / 4, Q_cost / 2)`, and geometry quality floor `1`.
- Signal settings id: `DAVID_LWMA35_RSI21_80_20__STOCH_100_3_21_80_20_low_high_simple_main_only`.
- David MA settings: LWMA `35`, close price, RSI `21`, overbought `80`, oversold `20`.
- Stochastic settings: K `100`, D `3`, slowing `21`, OB/OS `80/20`, Low/High, Simple, main line only.
- Signal clock: `m1`, ADR event brick `0.1`.
- Session mode: `ny_daily_window`, time zone `America/New_York`, trade window start `18:05`, trade cutoff `15:45`, flatten `16:00`, Sunday start `20:00`, flatten overrides `none`.
- Summary-only output: `true`.
- Activation uses closed warehouse bars and controls only missing side-cycle starts.
- Target mode `session_center_band_reversion`, fixed target `1` ADR used only by fixed_adr mode, spacing `0.2` ADR, minimum MA expansion `0` ADR, grid add mode `adverse_only`, lot size `0.01`.
- Protection modes are diagnostic replay controls only. `lock_1q_stop_adds` blocks new adds after a cycle reaches `1Q` MFE; trail modes close after Q-denominated giveback; protected flatten closes green cycles, holds small-red cycles, and closes ugly-red cycles at `-1Q`; live-state guards use first MFE/MAE quantum timestamps observed while the cycle is open; EOD hold-red modes close green cycles at flatten and carry red cycles forward.
- Bar path mode: `open`.
- Continuous mode carries side-grid positions across warehouse week boundaries; session-window mode carries only until target reset, session flatten, or terminal liquidation.
- Target resets use the selected target mode. fixed_adr uses price ADR PnL; david_ma_reversion closes only profitable returns to the current David MA; session_mid_reversion closes only profitable returns to the formulaic session midpoint; session_center_band_reversion closes only profitable returns into the formulaic center band.
- In `ny_daily_window`, target closes are still allowed whenever a tick exists, but starts/adds are blocked outside the configured clean session and unresolved cycles are force-closed at the flatten boundary.
- In `ny_daily_window`, any cycle still open at the selected test endpoint is closed as a session flatten at the last available mark; this prevents endpoint terminal inventory from masquerading as a live overnight hold.
- Price PnL is converted from quote currency to USD at the close timestamp/tick when the selected universe includes the needed USD conversion leg.
- Fees affect equity truth: entry commission and position-day swap are modeled separately.
- Explicit bid/ask spread and slippage are not modeled in this runner yet.
- Terminal liquidation is explicit and reported separately.
- No MT5 implementation, target/spacing optimization, pair-specific swap ingestion, margin stopout simulator, app/live integration, promotion, live-readiness, or double-sided in-between policy.

## Summary

| variant_id | activation_rule_id | protection_mode | signal_settings_id | symbol_universe | bar_path_mode | signal_clock | signal_adr_brick | session_mode | session_trade_start_et | session_trade_end_et | session_flatten_et | session_sunday_start_et | target_mode | target_adr | spacing_adr | min_ma_expansion_adr | grid_add_mode | weeks_replayed | pairs_replayed | final_balance_usd | net_profit_usd | closed_price_pnl_usd | end_liquidation_price_pnl_usd | total_commission_usd | total_swap_usd | session_flatten_count | session_flatten_positions | session_flatten_price_pnl_usd | session_flatten_swap_usd | protection_close_count | protection_close_positions | entries_opened | end_liquidation_positions | max_open_positions | max_add_depth | max_equity_drawdown_usd | weekly_equity_profit_factor | close_event_count | close_event_profit_factor | close_event_win_pct | adr_normalized_return_pct | close_event_total_realized_pnl_adr | close_event_total_realized_market_pct | close_event_avg_realized_pnl_adr | close_event_avg_realized_market_pct | close_event_avg_mfe_adr | close_event_avg_mae_adr_abs | close_event_avg_mfe_market_pct | close_event_avg_mae_market_pct_abs | close_event_mfe_1q_hit_pct | close_event_mfe_2q_hit_pct | close_event_mfe_3q_hit_pct | close_event_mae_1q_hit_pct | close_event_mae_2q_hit_pct | close_event_mae_3q_hit_pct | target_close_net_usd | session_flatten_close_net_usd | protection_close_net_usd | activation_started_long | activation_started_short | activation_blocked_long | activation_blocked_short | activation_blocked_expansion | activation_long_allow_pct | activation_short_allow_pct | summary_only |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| RAW_GRID_T100_S020_GATE90_TRIANGLE_FORMULAIC_DIRECTIONLESS_GEOMETRY_V2 | triangle_formulaic_directionless_geometry_v2 | baseline | DAVID_LWMA35_RSI21_80_20__STOCH_100_3_21_80_20_low_high_simple_main_only | AUDCAD,AUDCHF,AUDJPY,AUDNZD,AUDUSD,CADCHF,CADJPY,CHFJPY,EURAUD,EURCAD,EURCHF,EURGBP,EURJPY,EURNZD,EURUSD,GBPAUD,GBPCAD,GBPCHF,GBPJPY,GBPNZD,GBPUSD,NZDCAD,NZDCHF,NZDJPY,NZDUSD,USDCAD,USDCHF,USDJPY | open | m1 | 0.1 | ny_daily_window | 18:05 | 15:45 | 16:00 | 20:00 | session_center_band_reversion | 1 | 0.2 | 0 | adverse_only | 26 | 28 | 11089.44 | 1089.44 | 6036.12 | 0 | -3884.58 | -1062.1 | 3459 | 30789 | -28812.66 | -925.8 | 0 | 0 | 64743 | 0 | 377 | 127 | -3981.92 | 1.124442 | 21700 | 1.026063 | 89.45 | 900.585056 | 900.585056 | 624.802386 | 0.041502 | 0.028793 | 0.438635 | 0.796953 | 0.278194 | 0.487875 | 61.42 | 43.26 | 34.54 | 43.59 | 34.39 | 29.35 | 32675.24 | -31585.8 | 0 | 10796 | 10904 | 2788647 | 2701041 | 3818282 | 0.39 | 0.4 | true |
| RAW_GRID_T100_S020_GATE90_TRIANGLE_FORMULAIC_DIRECTIONLESS_GEOMETRY_V2__PROTECT_PAIN_1Q_STOP_ADDS_BEFORE_PROFIT_0_5Q | triangle_formulaic_directionless_geometry_v2 | pain_1q_stop_adds_before_profit_0_5q | DAVID_LWMA35_RSI21_80_20__STOCH_100_3_21_80_20_low_high_simple_main_only | AUDCAD,AUDCHF,AUDJPY,AUDNZD,AUDUSD,CADCHF,CADJPY,CHFJPY,EURAUD,EURCAD,EURCHF,EURGBP,EURJPY,EURNZD,EURUSD,GBPAUD,GBPCAD,GBPCHF,GBPJPY,GBPNZD,GBPUSD,NZDCAD,NZDCHF,NZDJPY,NZDUSD,USDCAD,USDCHF,USDJPY | open | m1 | 0.1 | ny_daily_window | 18:05 | 15:45 | 16:00 | 20:00 | session_center_band_reversion | 1 | 0.2 | 0 | adverse_only | 26 | 28 | 9898.54 | -101.46 | 2244.59 | 0 | -1953 | -393.05 | 3459 | 10747 | -13180.26 | -325.46 | 0 | 0 | 32550 | 0 | 203 | 110 | -2580.44 | 0.978326 | 21700 | 0.994187 | 86.78 | 333.497407 | 333.497407 | 275.544608 | 0.015369 | 0.012698 | 0.175379 | 0.343927 | 0.109969 | 0.206416 | 40.85 | 15.29 | 11.15 | 43.59 | 31.17 | 24.22 | 14049.08 | -14150.55 | 0 | 10796 | 10904 | 2788647 | 2701041 | 3818282 | 0.39 | 0.4 | true |

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
| protection_mode | diagnostic cycle-management replay mode; baseline preserves existing behavior, Q modes add stop-add, trailing, protected-flatten, or live-state pain guards without changing entries |
| protection_trail | close reason emitted when a cycle reaches the configured Q-profit activation threshold and then gives back the configured Q trail distance |
| protected_flatten | close reason emitted by protected flatten when a cycle is ugly red at the daily flatten boundary; small-red cycles can be held instead of force-closed |
| pain_circuit | close reason emitted when a live-state guard closes a cycle after adverse 2Q pain occurs before any 0.5Q favorable excursion |
| pain_1q_stop_adds_before_profit_0_5q | protection mode that blocks new adds after the cycle reaches 1Q adverse excursion before any 0.5Q favorable excursion |
| pain_2q_circuit_before_profit_0_5q | protection mode that closes the cycle after it reaches 2Q adverse excursion before any 0.5Q favorable excursion |
| live_state_guard_v0 | combined diagnostic guard: stop adds after profit reaches 1Q, stop adds after pain reaches 1Q before 0.5Q profit, and close after pain reaches 2Q before 0.5Q profit |
| eod_green_hold_red | protection mode that closes green cycles at the daily flatten boundary and holds red cycles open for later target/flatten handling |
| eod_green_hold_red_pain_1q_stop_adds | hold-red mode plus locked stop-add after 1Q adverse excursion happens before any 0.5Q favorable excursion |
| eod_green_hold_red_pain_1q_stop_adds_reset_0_5q | hold-red mode plus stop-add while 1Q adverse excursion has occurred before any 0.5Q favorable excursion; stop-add unlocks after the same cycle reaches 0.5Q favorable excursion |
| eod_green_hold_red_max_3d | hold-red mode capped at three calendar days of max fill age; red cycles older than the cap close at the next flatten boundary |
| eod_green_hold_red_pain_1q_stop_adds_max_3d | three-day capped hold-red mode plus locked stop-add after 1Q adverse excursion happens before any 0.5Q favorable excursion |
| eod_green_hold_red_pain_1q_stop_adds_reset_0_5q_max_3d | three-day capped hold-red mode plus pain stop-add that unlocks after the same cycle reaches 0.5Q favorable excursion |
| protection_close_net_usd | aggregate net USD from protection_trail, protected_flatten, and pain_circuit close cycles, including price PnL, commission, and swap |
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
| triangle_formulaic_directionless_geometry | Gate 91 scaffold rule that ignores direction evidence, computes Q from completed session range plus current path efficiency plus cost floor, starts symmetric long/short extensions away from session midpoint, and targets session-mid reversion |
| triangle_formulaic_q_equation | Gate 91 equation: Q = max(R / (2 + 2 * (1 - PE)), C), where C=0.05 ADR and PE above 0.35 is rejected as too clean/trendy |
| triangle_formulaic_directionless_geometry_v2 | Gate 91 v2 scaffold rule that ignores direction evidence, computes Q from cost-adjusted bending path, targets a median-session center band, and starts symmetric long/short extensions away from that center |
| triangle_formulaic_v2_q_equation | Gate 91 v2 equation: Q = max(Q_cost, current_volatility_floor, R / (1 + sqrt(B_cost / Q_cost))), where Q_cost is 4x the modeled round-trip cost in ADR units |
| reversion_target_band_adr | per-cycle center-band target radius in ADR units; v2 sets it to max(Q/4, Q_cost/2) and closes only when the basket is price-green inside the band |
| triangle_geometry_q_cost_adr | per-cycle v2 economic spacing floor in ADR units; commission-derived round-trip cost is used when USD conversion is available, otherwise the legacy fallback floor is receipted |
| triangle_geometry_round_trip_cost_adr | per-cycle modeled round-trip cost in ADR units used by v2 geometry; spread and slippage are not included in this runner |
| triangle_geometry_p_raw_adr | completed-session total absolute close-path movement in ADR units before cost filtering |
| triangle_geometry_p_cost_adr | completed-session path movement after subtracting one-way cost from each close-path delta and flooring each delta at zero |
| triangle_geometry_b_cost_adr | completed-session cost-adjusted bending path: max(P_cost - net session displacement, 0) |
| triangle_geometry_balance | completed-session time balance around the median M1 close center; 1 is balanced, 0 is one-sided occupancy |
| triangle_geometry_quality | v2 geometry score: (B_cost / Q) * balance; the first v2 scaffold requires this to be at least one |
| triangle_geometry_current_volatility_adr | completed-session median absolute close-path delta in ADR units used as the v2 current-volatility floor |
| cycle_signal_adr_brick | per-cycle derived signal event brick; Gate 91 v1 sets it to Q/4, and v2 sets it to max(Q/4, Q_cost/2) instead of using a fixed ADR-event brick |
| reversion_target_price | per-cycle non-David reversion target price; Gate 91 v1 formulaic geometry uses the completed session midpoint, and v2 uses the completed-session median M1 close center |
| cycle_spacing_adr | actual ADR spacing assigned to the side cycle at start; triangle_v0/v1 use the Gate 90D adaptive spacing receipt, Gate 91 v1 uses Q from range/path efficiency/cost floor, and Gate 91 v2 uses cost-adjusted bending-path Q |
| triangle_trigger_key | stable provenance key for the session box, side, sweep, and displacement trigger that started a triangle_v0 cycle |
| triangle_v0_formula_id | scaffold formula identifier for the Gate 90D bounded Triangle v0 replay path |
| min_ma_expansion_adr | minimum side-specific distance from current David MA required before a missing side can start; long requires price below MA, short requires price above MA |
| grid_add_mode | adverse_and_favorable keeps both recovery and favorable expansion adds; adverse_only adds only when price moves against the side from its cycle anchor |
| close_event_profit_factor | gross winning close-cycle net USD divided by absolute gross losing close-cycle net USD; computed even in summary-only mode without retaining close-event rows |
| close_event_win_pct | winning close-cycle count divided by all close cycles; target, session_flatten, and end_of_test close reasons are included |
| adr_normalized_return_pct | price-movement return normalized by each pair's ADR; one ADR is reported as one percent for cross-currency comparison; commission and swap remain costed in USD fields |
| close_event_total_realized_pnl_adr | sum of close-cycle realized price PnL in ADR units; same numeric value as adr_normalized_return_pct because one ADR is reported as one percent |
| close_event_total_realized_market_pct | sum of close-cycle realized raw market-percent movement before ADR normalization; fill-weighted and still separate from costed USD account return |
| close_event_avg_realized_pnl_adr | average realized price PnL per closed side cycle in ADR units, before commission and swap |
| close_event_avg_realized_market_pct | average realized raw market-percent movement per closed side cycle, before ADR normalization and before commission/swap |
| close_event_avg_mfe_adr | average Maximum Favorable Excursion per closed side cycle in ADR units, computed from observed cycle max_pnl_adr |
| close_event_avg_mae_adr_abs | average absolute Maximum Adverse Excursion per closed side cycle in ADR units, computed from observed negative cycle min_pnl_adr |
| close_event_avg_mfe_market_pct | average raw market-percent Maximum Favorable Excursion per closed side cycle |
| close_event_avg_mae_market_pct_abs | average absolute raw market-percent Maximum Adverse Excursion per closed side cycle |
| first_mfe_0_5q/1q/2q/3q_timestamp_utc | first timestamp while the cycle was open when net cycle PnL reached the named favorable quantum threshold; used for live-safe profit-first diagnostics |
| first_mae_0_5q/1q/2q/3q_timestamp_utc | first timestamp while the cycle was open when net cycle PnL reached the named adverse quantum threshold; used for live-safe pain-first diagnostics |
| max_pnl_timestamp_utc | timestamp when observed cycle MFE was first set to its maximum value in the replay path |
| min_pnl_timestamp_utc | timestamp when observed cycle MAE was first set to its worst value in the replay path |
| close_event_mfe_1q/2q/3q_hit_pct | share of closed side cycles whose observed MFE reached at least one, two, or three cycle-spacing quanta before close |
| close_event_mae_1q/2q/3q_hit_pct | share of closed side cycles whose observed MAE reached at least one, two, or three cycle-spacing quanta before close |
| close-event-breakdown.rows | non-summary close-cycle aggregate artifact grouped by anchor week, close month, pair, pair side, close reason, and strategy class; includes ADR-normalized return percent plus costed account-return percent |
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
| target_reset_uses_selected_target_mode | session_center_band_reversion | fixed_adr_or_david_ma_reversion_or_session_mid_reversion_or_session_center_band_reversion | true |
| target_mode | session_center_band_reversion | explicit | true |
| target_adr | 1 | >0 | true |
| spacing_adr | 0.2 | >0 | true |
| signal_clock | m1 | explicit | true |
| signal_adr_brick | 0.1 | >0 | true |
| session_mode | ny_daily_window | explicit continuous_or_ny_daily_window | true |
| session_time_zone | America/New_York | IANA time zone | true |
| session_trade_start_et | 18:05 | HH:mm | true |
| session_trade_end_et | 15:45 | HH:mm | true |
| session_flatten_et | 16:00 | HH:mm | true |
| session_sunday_start_et | 20:00 | HH:mm | true |
| session_flatten_overrides_et |  | optional YYYY-MM-DD=HH:mm list | true |
| session_endpoint_open_cycles_close_as_session_flatten | true | true only in ny_daily_window | true |
| min_ma_expansion_adr | 0 | >=0 | true |
| grid_add_mode | adverse_only | explicit | true |
| bar_path_mode | open | explicit | true |
| quote_currency_pnl_converted_to_usd | true | true | true |
| swap_triggers_target_reset | false | false | true |
| activation_rule_ids | triangle_formulaic_directionless_geometry_v2 | explicit | true |
| protection_modes | baseline,pain_1q_stop_adds_before_profit_0_5q | explicit | true |
| activation_controls_initial_cycle_start_only | true | true | true |
| triangle_v0_enabled | false | true when activation_rule_ids includes a triangle_v0 rule | true |
| triangle_v0_formula_id |  | visible when a triangle_v0 rule is enabled | true |
| triangle_v0_spacing_rails_adr |  | range/3 clamped rails when a triangle_v0 rule is enabled | true |
| triangle_v0_traceability_columns |  | close-events and terminal-inventory rows carry trigger provenance | true |
| triangle_v1_enabled | false | true when activation_rule_ids includes a triangle_v1 rule | true |
| triangle_v1_formula_id |  | visible when a triangle_v1 rule is enabled | true |
| triangle_v1_start_gate |  | geometry plus extension plus Candidate B/David permission | true |
| triangle_formulaic_enabled | true | true when activation_rule_ids includes a formulaic directionless geometry rule | true |
| triangle_formulaic_v1_id |  | visible when the Gate 91 v1 formulaic rule is enabled | true |
| triangle_formulaic_v1_q_equation |  | range/path-efficiency/cost-floor equation | true |
| triangle_formulaic_v1_signal_brick |  | derived from Q, not fixed ADR-event brick | true |
| triangle_formulaic_direction_policy | directionless_symmetric_long_short | no Candidate B or David direction dependency | true |
| triangle_formulaic_target | session_center_band_reversion | session_mid_reversion_or_session_center_band_reversion | true |
| triangle_formulaic_v2_enabled | true | true when activation_rule_ids includes triangle_formulaic_directionless_geometry_v2 | true |
| triangle_formulaic_v2_id | gate91_formulaic_directionless_grid_geometry_v2_cost_bend_center_band_2026_07_03 | visible when the Gate 91 v2 formulaic rule is enabled | true |
| triangle_formulaic_v2_q_equation | Q=max(Q_cost,current_volatility_floor,R/(1+sqrt(B_cost/Q_cost))) | cost-adjusted bending path equation | true |
| triangle_formulaic_v2_target | session_center_band_reversion | session_center_band_reversion | true |
| triangle_formulaic_v2_receipts | q_cost,p_raw,p_cost,b_cost,balance,geometry_quality,target_band | close-events and terminal-inventory rows carry v2 geometry receipts | true |
| david_ma_settings | LWMA35_RSI21_80_20 | explicit CLI/default settings | true |
| stochastic_settings | 100_3_21_80_20_low_high_simple_main_only | explicit CLI/default settings | true |
| summary_only | true | explicit | true |
| commission_per_entry_per_001_lot_usd | 0.06 | 0.06 | true |
| eurusd_long_swap_per_001_lot_day_usd | -0.0917 | MT5-derived approx | true |
| eurusd_short_swap_per_001_lot_day_usd | 0.01 | MT5-derived approx | true |
| selected_week_count | 26 | >=1 | true |
| selected_pair_count | 28 | >=1 | true |

## Artifacts

- summaryJson: `docs/research/gates/gate91/artifacts/gate91-formulaic-v2-ab-2026-open/activation-summary.rows.json`
- summaryCsv: `docs/research/gates/gate91/artifacts/gate91-formulaic-v2-ab-2026-open/activation-summary.rows.csv`
- weeklyJson: `docs/research/gates/gate91/artifacts/gate91-formulaic-v2-ab-2026-open/weekly-activation-truth.rows.json`
- weeklyCsv: `docs/research/gates/gate91/artifacts/gate91-formulaic-v2-ab-2026-open/weekly-activation-truth.rows.csv`
- closeEventsJson: `docs/research/gates/gate91/artifacts/gate91-formulaic-v2-ab-2026-open/close-events.rows.json`
- closeEventsCsv: `docs/research/gates/gate91/artifacts/gate91-formulaic-v2-ab-2026-open/close-events.rows.csv`
- closeEventBreakdownsJson: `docs/research/gates/gate91/artifacts/gate91-formulaic-v2-ab-2026-open/close-event-breakdown.rows.json`
- closeEventBreakdownsCsv: `docs/research/gates/gate91/artifacts/gate91-formulaic-v2-ab-2026-open/close-event-breakdown.rows.csv`
- terminalInventoryJson: `docs/research/gates/gate91/artifacts/gate91-formulaic-v2-ab-2026-open/terminal-inventory.rows.json`
- terminalInventoryCsv: `docs/research/gates/gate91/artifacts/gate91-formulaic-v2-ab-2026-open/terminal-inventory.rows.csv`
- validationJson: `docs/research/gates/gate91/artifacts/gate91-formulaic-v2-ab-2026-open/validation.rows.json`
- validationCsv: `docs/research/gates/gate91/artifacts/gate91-formulaic-v2-ab-2026-open/validation.rows.csv`
- metricDefinitionsJson: `docs/research/gates/gate91/artifacts/gate91-formulaic-v2-ab-2026-open/metric-definitions.rows.json`
- metricDefinitionsCsv: `docs/research/gates/gate91/artifacts/gate91-formulaic-v2-ab-2026-open/metric-definitions.rows.csv`
- commandReceipt: `docs/research/gates/gate91/artifacts/gate91-formulaic-v2-ab-2026-open/command-receipt.json`
- runSummaryJson: `docs/research/gates/gate91/artifacts/gate91-formulaic-v2-ab-2026-open/gate90-run-summary.json`
- shaManifest: `docs/research/gates/gate91/artifacts/gate91-formulaic-v2-ab-2026-open/gate90-activation-sha256.txt`
- report: `docs/research/gates/gate91/artifacts/gate91-formulaic-v2-ab-2026-open/GATE91_FORMULAIC_V2_AB_2026_OPEN.md`

## Stop Line

Gate 90 is warehouse activation research only. Do not optimize MT5 lifecycle controls, retune target/spacing, promote strategy logic, or open double-sided in-between policy from this run.
