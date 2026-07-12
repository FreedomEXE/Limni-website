# Gate 90 Grid Activation Accuracy One-Sided Selection

Generated: `2026-07-03T04:00:49.133Z`

## Verdict

`PASS_GATE90_GRID_ACTIVATION_ONE_SIDED_SELECTION_BUILT_DIAGNOSTIC_ONLY`

## Scope

- Warehouse truth replay with one-sided activation gates and explicit session mode controls.
- Variants: `RAW_GRID_T100_S020_GATE90_TRIANGLE_V1_DAVID_CONTRA_EXTENSION,RAW_GRID_T100_S020_GATE90_TRIANGLE_V1_DAVID_CONTRA_EXTENSION__PROTECT_LOCK_1Q_STOP_ADDS,RAW_GRID_T100_S020_GATE90_TRIANGLE_V1_DAVID_CONTRA_EXTENSION__PROTECT_TRAIL_1Q_1Q,RAW_GRID_T100_S020_GATE90_TRIANGLE_V1_DAVID_CONTRA_EXTENSION__PROTECT_TRAIL_1Q_0_5Q,RAW_GRID_T100_S020_GATE90_TRIANGLE_V1_DAVID_CONTRA_EXTENSION__PROTECT_PROTECTED_FLATTEN_1Q,RAW_GRID_T100_S020_GATE90_TRIANGLE_V1_DAVID_CONTRA_EXTENSION__PROTECT_PROTECTED_FLATTEN_1Q_TRAIL_1Q,RAW_GRID_T100_S020_GATE90_DAVID_CONTRA,RAW_GRID_T100_S020_GATE90_DAVID_CONTRA__PROTECT_LOCK_1Q_STOP_ADDS,RAW_GRID_T100_S020_GATE90_DAVID_CONTRA__PROTECT_TRAIL_1Q_1Q,RAW_GRID_T100_S020_GATE90_DAVID_CONTRA__PROTECT_TRAIL_1Q_0_5Q,RAW_GRID_T100_S020_GATE90_DAVID_CONTRA__PROTECT_PROTECTED_FLATTEN_1Q,RAW_GRID_T100_S020_GATE90_DAVID_CONTRA__PROTECT_PROTECTED_FLATTEN_1Q_TRAIL_1Q,RAW_GRID_T100_S020_GATE90_TRIANGLE_V0_NO_CANDIDATE_B,RAW_GRID_T100_S020_GATE90_TRIANGLE_V0_NO_CANDIDATE_B__PROTECT_LOCK_1Q_STOP_ADDS,RAW_GRID_T100_S020_GATE90_TRIANGLE_V0_NO_CANDIDATE_B__PROTECT_TRAIL_1Q_1Q,RAW_GRID_T100_S020_GATE90_TRIANGLE_V0_NO_CANDIDATE_B__PROTECT_TRAIL_1Q_0_5Q,RAW_GRID_T100_S020_GATE90_TRIANGLE_V0_NO_CANDIDATE_B__PROTECT_PROTECTED_FLATTEN_1Q,RAW_GRID_T100_S020_GATE90_TRIANGLE_V0_NO_CANDIDATE_B__PROTECT_PROTECTED_FLATTEN_1Q_TRAIL_1Q`.
- Activation rules: `triangle_v1_david_contra_extension,david_contra,triangle_v0_no_candidate_b`.
- Protection modes: `baseline,lock_1q_stop_adds,trail_1q_1q,trail_1q_0_5q,protected_flatten_1q,protected_flatten_1q_trail_1q`.
- Triangle v0 formula id: `gate90d_triangle_v0_katarakti_start_spacing_scaffold_2026_07_03`; starts require a completed session range, sweep/rejection/displacement trigger, point-in-time harvestable path geometry, and Candidate/David alignment.
- Triangle v0 spacing is per-cycle adaptive: completed session range / `3`, clamped to `0.2..0.3` ADR; close-event rows emit `cycle_spacing_adr` and `triangle_trigger_key`.
- `triangle_v0_no_candidate_b` is enabled: Candidate B is removed from the Triangle direction formula and David-only side agreement is required.
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
- Protection modes are diagnostic replay controls only. `lock_1q_stop_adds` blocks new adds after a cycle reaches `1Q` MFE; trail modes close after Q-denominated giveback; protected flatten closes green cycles, holds small-red cycles, and closes ugly-red cycles at `-1Q`.
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

| variant_id | activation_rule_id | protection_mode | signal_settings_id | symbol_universe | bar_path_mode | signal_clock | signal_adr_brick | session_mode | session_trade_start_et | session_trade_end_et | session_flatten_et | session_sunday_start_et | target_mode | target_adr | spacing_adr | min_ma_expansion_adr | grid_add_mode | weeks_replayed | pairs_replayed | final_balance_usd | net_profit_usd | closed_price_pnl_usd | end_liquidation_price_pnl_usd | total_commission_usd | total_swap_usd | session_flatten_count | session_flatten_positions | session_flatten_price_pnl_usd | session_flatten_swap_usd | protection_close_count | protection_close_positions | entries_opened | end_liquidation_positions | max_open_positions | max_add_depth | max_equity_drawdown_usd | weekly_equity_profit_factor | close_event_count | close_event_profit_factor | close_event_win_pct | adr_normalized_return_pct | close_event_total_realized_pnl_adr | close_event_avg_realized_pnl_adr | close_event_avg_mfe_adr | close_event_avg_mae_adr_abs | close_event_mfe_1q_hit_pct | close_event_mfe_2q_hit_pct | close_event_mfe_3q_hit_pct | close_event_mae_1q_hit_pct | close_event_mae_2q_hit_pct | close_event_mae_3q_hit_pct | target_close_net_usd | session_flatten_close_net_usd | protection_close_net_usd | activation_started_long | activation_started_short | activation_blocked_long | activation_blocked_short | activation_blocked_expansion | activation_long_allow_pct | activation_short_allow_pct | summary_only |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| RAW_GRID_T100_S020_GATE90_TRIANGLE_V1_DAVID_CONTRA_EXTENSION | triangle_v1_david_contra_extension | baseline | DAVID_LWMA50_RSI50_60_40__STOCH_100_3_100_60_40_low_high_simple_main_only | AUDCAD,AUDCHF,AUDJPY,AUDNZD,AUDUSD,CADCHF,CADJPY,CHFJPY,EURAUD,EURCAD,EURCHF,EURGBP,EURJPY,EURNZD,EURUSD,GBPAUD,GBPCAD,GBPCHF,GBPJPY,GBPNZD,GBPUSD,NZDCAD,NZDCHF,NZDJPY,NZDUSD,USDCAD,USDCHF,USDJPY | open | adr_event | 0.075 | ny_daily_window | 18:05 | 15:45 | 16:00 | 20:00 | david_ma_reversion | 1 | 0.2 | 0.1 | adverse_only | 38 | 28 | 9926.34 | -73.66 | 986.34 | 0 | -934.02 | -125.98 | 1417 | 2931 | -3952.62 | -95.98 | 0 | 0 | 15567 | 0 | 106 | 13 | -991.56 | 0.955855 | 12363 | 0.984393 | 62.7 | 177.43224 | 177.43224 | 0.014352 | 0.084869 | 0.204106 | 9.12 | 1.96 | 0.59 | 15.16 | 8.92 | 5.44 | 4150.8 | -4224.46 | 0 | 6239 | 6124 | 5590268 | 5669623 | 12883 | 0.11 | 0.11 | false |
| RAW_GRID_T100_S020_GATE90_TRIANGLE_V1_DAVID_CONTRA_EXTENSION__PROTECT_LOCK_1Q_STOP_ADDS | triangle_v1_david_contra_extension | lock_1q_stop_adds | DAVID_LWMA50_RSI50_60_40__STOCH_100_3_100_60_40_low_high_simple_main_only | AUDCAD,AUDCHF,AUDJPY,AUDNZD,AUDUSD,CADCHF,CADJPY,CHFJPY,EURAUD,EURCAD,EURCHF,EURGBP,EURJPY,EURNZD,EURUSD,GBPAUD,GBPCAD,GBPCHF,GBPJPY,GBPNZD,GBPUSD,NZDCAD,NZDCHF,NZDJPY,NZDUSD,USDCAD,USDCHF,USDJPY | open | adr_event | 0.075 | ny_daily_window | 18:05 | 15:45 | 16:00 | 20:00 | david_ma_reversion | 1 | 0.2 | 0.1 | adverse_only | 38 | 28 | 9862.14 | -137.86 | 905.79 | 0 | -919.02 | -124.62 | 1420 | 2888 | -3967.87 | -95.48 | 0 | 0 | 15317 | 0 | 104 | 13 | -999.37 | 0.917623 | 12235 | 0.970816 | 62.63 | 163.693927 | 163.693927 | 0.013379 | 0.085138 | 0.203629 | 9.2 | 1.91 | 0.58 | 15.24 | 8.92 | 5.44 | 4098.78 | -4236.64 | 0 | 6174 | 6061 | 5589753 | 5669461 | 12883 | 0.11 | 0.11 | false |
| RAW_GRID_T100_S020_GATE90_TRIANGLE_V1_DAVID_CONTRA_EXTENSION__PROTECT_TRAIL_1Q_1Q | triangle_v1_david_contra_extension | trail_1q_1q | DAVID_LWMA50_RSI50_60_40__STOCH_100_3_100_60_40_low_high_simple_main_only | AUDCAD,AUDCHF,AUDJPY,AUDNZD,AUDUSD,CADCHF,CADJPY,CHFJPY,EURAUD,EURCAD,EURCHF,EURGBP,EURJPY,EURNZD,EURUSD,GBPAUD,GBPCAD,GBPCHF,GBPJPY,GBPNZD,GBPUSD,NZDCAD,NZDCHF,NZDJPY,NZDUSD,USDCAD,USDCHF,USDJPY | open | adr_event | 0.075 | ny_daily_window | 18:05 | 15:45 | 16:00 | 20:00 | david_ma_reversion | 1 | 0.2 | 0.1 | adverse_only | 38 | 28 | 9803.86 | -196.14 | 883.64 | 0 | -956.16 | -123.62 | 1409 | 2855 | -3908.25 | -93.13 | 326 | 652 | 15936 | 0 | 105 | 13 | -1040.07 | 0.884739 | 12692 | 0.958098 | 62.72 | 159.396813 | 159.396813 | 0.012559 | 0.084827 | 0.20062 | 9.49 | 1.51 | 0.44 | 15.26 | 8.75 | 5.26 | 3867.58 | -4172.68 | 108.96 | 6420 | 6272 | 5591914 | 5670118 | 12892 | 0.11 | 0.11 | false |
| RAW_GRID_T100_S020_GATE90_TRIANGLE_V1_DAVID_CONTRA_EXTENSION__PROTECT_TRAIL_1Q_0_5Q | triangle_v1_david_contra_extension | trail_1q_0_5q | DAVID_LWMA50_RSI50_60_40__STOCH_100_3_100_60_40_low_high_simple_main_only | AUDCAD,AUDCHF,AUDJPY,AUDNZD,AUDUSD,CADCHF,CADJPY,CHFJPY,EURAUD,EURCAD,EURCHF,EURGBP,EURJPY,EURNZD,EURUSD,GBPAUD,GBPCAD,GBPCHF,GBPJPY,GBPNZD,GBPUSD,NZDCAD,NZDCHF,NZDJPY,NZDUSD,USDCAD,USDCHF,USDJPY | open | adr_event | 0.075 | ny_daily_window | 18:05 | 15:45 | 16:00 | 20:00 | david_ma_reversion | 1 | 0.2 | 0.1 | adverse_only | 38 | 28 | 9832.52 | -167.48 | 920.11 | 0 | -963.48 | -124.11 | 1401 | 2862 | -3995.16 | -93.89 | 449 | 849 | 16058 | 0 | 105 | 13 | -990.46 | 0.900063 | 12774 | 0.964356 | 63.61 | 168.206919 | 168.206919 | 0.013168 | 0.083573 | 0.201449 | 9.48 | 1.24 | 0.34 | 15.38 | 8.74 | 5.26 | 3642.38 | -4260.77 | 450.91 | 6466 | 6308 | 5593313 | 5672037 | 12903 | 0.12 | 0.11 | false |
| RAW_GRID_T100_S020_GATE90_TRIANGLE_V1_DAVID_CONTRA_EXTENSION__PROTECT_PROTECTED_FLATTEN_1Q | triangle_v1_david_contra_extension | protected_flatten_1q | DAVID_LWMA50_RSI50_60_40__STOCH_100_3_100_60_40_low_high_simple_main_only | AUDCAD,AUDCHF,AUDJPY,AUDNZD,AUDUSD,CADCHF,CADJPY,CHFJPY,EURAUD,EURCAD,EURCHF,EURGBP,EURJPY,EURNZD,EURUSD,GBPAUD,GBPCAD,GBPCHF,GBPJPY,GBPNZD,GBPUSD,NZDCAD,NZDCHF,NZDJPY,NZDUSD,USDCAD,USDCHF,USDJPY | open | adr_event | 0.075 | ny_daily_window | 18:05 | 15:45 | 16:00 | 20:00 | david_ma_reversion | 1 | 0.2 | 0.1 | adverse_only | 38 | 28 | 9816.92 | -183.08 | 871.31 | 0 | -921.9 | -132.49 | 589 | 829 | 411.45 | -27.99 | 627 | 1872 | 15365 | 0 | 104 | 13 | -941.37 | 0.89392 | 12154 | 0.962379 | 64.07 | 174.308661 | 174.308661 | 0.014342 | 0.086231 | 0.211928 | 9.33 | 1.95 | 0.6 | 16.12 | 9.35 | 5.77 | 4159.27 | 333.72 | -4676.07 | 6123 | 6031 | 5549017 | 5638065 | 12619 | 0.11 | 0.11 | false |
| RAW_GRID_T100_S020_GATE90_TRIANGLE_V1_DAVID_CONTRA_EXTENSION__PROTECT_PROTECTED_FLATTEN_1Q_TRAIL_1Q | triangle_v1_david_contra_extension | protected_flatten_1q_trail_1q | DAVID_LWMA50_RSI50_60_40__STOCH_100_3_100_60_40_low_high_simple_main_only | AUDCAD,AUDCHF,AUDJPY,AUDNZD,AUDUSD,CADCHF,CADJPY,CHFJPY,EURAUD,EURCAD,EURCHF,EURGBP,EURJPY,EURNZD,EURUSD,GBPAUD,GBPCAD,GBPCHF,GBPJPY,GBPNZD,GBPUSD,NZDCAD,NZDCHF,NZDJPY,NZDUSD,USDCAD,USDCHF,USDJPY | open | adr_event | 0.075 | ny_daily_window | 18:05 | 15:45 | 16:00 | 20:00 | david_ma_reversion | 1 | 0.2 | 0.1 | adverse_only | 38 | 28 | 9752.23 | -247.77 | 842.99 | 0 | -958.62 | -132.15 | 584 | 802 | 393.02 | -27.76 | 928 | 2496 | 15977 | 0 | 105 | 13 | -983.41 | 0.858769 | 12592 | 0.948804 | 64.18 | 170.529212 | 170.529212 | 0.013543 | 0.086047 | 0.20926 | 9.62 | 1.56 | 0.46 | 16.16 | 9.21 | 5.63 | 3934.87 | 317.14 | -4499.79 | 6362 | 6230 | 5550278 | 5637733 | 12598 | 0.11 | 0.11 | false |
| RAW_GRID_T100_S020_GATE90_DAVID_CONTRA | david_contra | baseline | DAVID_LWMA50_RSI50_60_40__STOCH_100_3_100_60_40_low_high_simple_main_only | AUDCAD,AUDCHF,AUDJPY,AUDNZD,AUDUSD,CADCHF,CADJPY,CHFJPY,EURAUD,EURCAD,EURCHF,EURGBP,EURJPY,EURNZD,EURUSD,GBPAUD,GBPCAD,GBPCHF,GBPJPY,GBPNZD,GBPUSD,NZDCAD,NZDCHF,NZDJPY,NZDUSD,USDCAD,USDCHF,USDJPY | open | adr_event | 0.075 | ny_daily_window | 18:05 | 15:45 | 16:00 | 20:00 | david_ma_reversion | 1 | 0.2 | 0.1 | adverse_only | 38 | 28 | 10930.13 | 930.13 | 2671.38 | 0 | -1399.26 | -341.99 | 2459 | 7021 | -11083.41 | -237.43 | 0 | 0 | 23321 | 0 | 131 | 21 | -1132.23 | 1.301683 | 13257 | 1.074854 | 83.8 | 392.371928 | 392.371928 | 0.029597 | 0.201379 | 0.466685 | 30.01 | 10.64 | 4.01 | 35.4 | 24.55 | 18.09 | 12672.23 | -11742.1 | 0 | 7065 | 6192 | 4582306 | 4840930 | 3236527 | 0.15 | 0.13 | false |
| RAW_GRID_T100_S020_GATE90_DAVID_CONTRA__PROTECT_LOCK_1Q_STOP_ADDS | david_contra | lock_1q_stop_adds | DAVID_LWMA50_RSI50_60_40__STOCH_100_3_100_60_40_low_high_simple_main_only | AUDCAD,AUDCHF,AUDJPY,AUDNZD,AUDUSD,CADCHF,CADJPY,CHFJPY,EURAUD,EURCAD,EURCHF,EURGBP,EURJPY,EURNZD,EURUSD,GBPAUD,GBPCAD,GBPCHF,GBPJPY,GBPNZD,GBPUSD,NZDCAD,NZDCHF,NZDJPY,NZDUSD,USDCAD,USDCHF,USDJPY | open | adr_event | 0.075 | ny_daily_window | 18:05 | 15:45 | 16:00 | 20:00 | david_ma_reversion | 1 | 0.2 | 0.1 | adverse_only | 38 | 28 | 10743.36 | 743.36 | 2407.29 | 0 | -1338.96 | -324.97 | 2497 | 6628 | -10887.6 | -224.27 | 0 | 0 | 22316 | 0 | 101 | 21 | -1058.36 | 1.266807 | 13164 | 1.061162 | 83.08 | 346.799001 | 346.799001 | 0.026345 | 0.198637 | 0.448361 | 29.99 | 10.17 | 3.7 | 35.38 | 24.38 | 17.85 | 12252.91 | -11509.55 | 0 | 7018 | 6146 | 4576609 | 4834226 | 3224126 | 0.15 | 0.13 | false |
| RAW_GRID_T100_S020_GATE90_DAVID_CONTRA__PROTECT_TRAIL_1Q_1Q | david_contra | trail_1q_1q | DAVID_LWMA50_RSI50_60_40__STOCH_100_3_100_60_40_low_high_simple_main_only | AUDCAD,AUDCHF,AUDJPY,AUDNZD,AUDUSD,CADCHF,CADJPY,CHFJPY,EURAUD,EURCAD,EURCHF,EURGBP,EURJPY,EURNZD,EURUSD,GBPAUD,GBPCAD,GBPCHF,GBPJPY,GBPNZD,GBPUSD,NZDCAD,NZDCHF,NZDJPY,NZDUSD,USDCAD,USDCHF,USDJPY | open | adr_event | 0.075 | ny_daily_window | 18:05 | 15:45 | 16:00 | 20:00 | david_ma_reversion | 1 | 0.2 | 0.1 | adverse_only | 38 | 28 | 10740.86 | 740.86 | 2594.52 | 0 | -1534.56 | -319.1 | 2443 | 6600 | -10314.8 | -212.17 | 1799 | 4052 | 25576 | 0 | 112 | 21 | -1099.21 | 1.272801 | 15051 | 1.062614 | 81.23 | 372.280519 | 372.280519 | 0.024735 | 0.188128 | 0.417036 | 31.1 | 7.59 | 2.23 | 34.89 | 22.4 | 16.16 | 11173.93 | -10922.97 | 489.9 | 8059 | 6992 | 4585134 | 4842357 | 3240782 | 0.18 | 0.14 | false |
| RAW_GRID_T100_S020_GATE90_DAVID_CONTRA__PROTECT_TRAIL_1Q_0_5Q | david_contra | trail_1q_0_5q | DAVID_LWMA50_RSI50_60_40__STOCH_100_3_100_60_40_low_high_simple_main_only | AUDCAD,AUDCHF,AUDJPY,AUDNZD,AUDUSD,CADCHF,CADJPY,CHFJPY,EURAUD,EURCAD,EURCHF,EURGBP,EURJPY,EURNZD,EURUSD,GBPAUD,GBPCAD,GBPCHF,GBPJPY,GBPNZD,GBPUSD,NZDCAD,NZDCHF,NZDJPY,NZDUSD,USDCAD,USDCHF,USDJPY | open | adr_event | 0.075 | ny_daily_window | 18:05 | 15:45 | 16:00 | 20:00 | david_ma_reversion | 1 | 0.2 | 0.1 | adverse_only | 38 | 28 | 10729.96 | 729.96 | 2624.08 | 0 | -1571.64 | -322.48 | 2440 | 6664 | -10683.19 | -216.19 | 2371 | 5083 | 26194 | 0 | 114 | 21 | -1111.58 | 1.258694 | 15451 | 1.060938 | 85.19 | 380.373097 | 380.373097 | 0.024618 | 0.179685 | 0.415328 | 30.83 | 5.74 | 1.56 | 34.66 | 22.22 | 16.06 | 10175.11 | -11299.21 | 1854.06 | 8269 | 7182 | 4586971 | 4844059 | 3244321 | 0.18 | 0.15 | false |
| RAW_GRID_T100_S020_GATE90_DAVID_CONTRA__PROTECT_PROTECTED_FLATTEN_1Q | david_contra | protected_flatten_1q | DAVID_LWMA50_RSI50_60_40__STOCH_100_3_100_60_40_low_high_simple_main_only | AUDCAD,AUDCHF,AUDJPY,AUDNZD,AUDUSD,CADCHF,CADJPY,CHFJPY,EURAUD,EURCAD,EURCHF,EURGBP,EURJPY,EURNZD,EURUSD,GBPAUD,GBPCAD,GBPCHF,GBPJPY,GBPNZD,GBPUSD,NZDCAD,NZDCHF,NZDJPY,NZDUSD,USDCAD,USDCHF,USDJPY | open | adr_event | 0.075 | ny_daily_window | 18:05 | 15:45 | 16:00 | 20:00 | david_ma_reversion | 1 | 0.2 | 0.1 | adverse_only | 38 | 28 | 10577.11 | 577.11 | 2233.21 | 0 | -1328.7 | -327.4 | 874 | 1353 | 649.56 | -41.15 | 1444 | 5065 | 22145 | 0 | 101 | 21 | -1047.86 | 1.197633 | 12978 | 1.046944 | 84.74 | 350.779412 | 350.779412 | 0.027029 | 0.20041 | 0.455392 | 30.34 | 10.27 | 3.74 | 36.35 | 24.8 | 18.18 | 12209.93 | 527.23 | -12160.05 | 6918 | 6060 | 4573967 | 4832552 | 3219810 | 0.15 | 0.13 | false |
| RAW_GRID_T100_S020_GATE90_DAVID_CONTRA__PROTECT_PROTECTED_FLATTEN_1Q_TRAIL_1Q | david_contra | protected_flatten_1q_trail_1q | DAVID_LWMA50_RSI50_60_40__STOCH_100_3_100_60_40_low_high_simple_main_only | AUDCAD,AUDCHF,AUDJPY,AUDNZD,AUDUSD,CADCHF,CADJPY,CHFJPY,EURAUD,EURCAD,EURCHF,EURGBP,EURJPY,EURNZD,EURUSD,GBPAUD,GBPCAD,GBPCHF,GBPJPY,GBPNZD,GBPUSD,NZDCAD,NZDCHF,NZDJPY,NZDUSD,USDCAD,USDCHF,USDJPY | open | adr_event | 0.075 | ny_daily_window | 18:05 | 15:45 | 16:00 | 20:00 | david_ma_reversion | 1 | 0.2 | 0.1 | adverse_only | 38 | 28 | 10648.12 | 648.12 | 2496.12 | 0 | -1525.86 | -322.14 | 908 | 1341 | 641.78 | -38.56 | 3132 | 9091 | 25431 | 0 | 112 | 21 | -1079.16 | 1.229802 | 14849 | 1.054323 | 82.86 | 387.438964 | 387.438964 | 0.026092 | 0.189921 | 0.42373 | 31.48 | 7.71 | 2.28 | 35.98 | 22.83 | 16.47 | 11165.4 | 522.76 | -11040.04 | 7943 | 6906 | 4583996 | 4842166 | 3239453 | 0.17 | 0.14 | false |
| RAW_GRID_T100_S020_GATE90_TRIANGLE_V0_NO_CANDIDATE_B | triangle_v0_no_candidate_b | baseline | DAVID_LWMA50_RSI50_60_40__STOCH_100_3_100_60_40_low_high_simple_main_only | AUDCAD,AUDCHF,AUDJPY,AUDNZD,AUDUSD,CADCHF,CADJPY,CHFJPY,EURAUD,EURCAD,EURCHF,EURGBP,EURJPY,EURNZD,EURUSD,GBPAUD,GBPCAD,GBPCHF,GBPJPY,GBPNZD,GBPUSD,NZDCAD,NZDCHF,NZDJPY,NZDUSD,USDCAD,USDCHF,USDJPY | open | adr_event | 0.075 | ny_daily_window | 18:05 | 15:45 | 16:00 | 20:00 | david_ma_reversion | 1 | 0.2 | 0.1 | adverse_only | 38 | 28 | 10117.43 | 117.43 | 166.08 | 0 | -41.34 | -7.31 | 136 | 263 | -440.35 | -5.45 | 0 | 0 | 689 | 0 | 13 | 10 | -219.05 | 1.401513 | 454 | 1.229681 | 79.3 | 25.29494 | 25.29494 | 0.055716 | 0.277514 | 0.40706 | 46.92 | 8.15 | 2.64 | 28.85 | 17.62 | 11.45 | 579.01 | -461.57 | 0 | 233 | 221 | 6110417 | 6110811 | 51749 | 0 | 0 | false |
| RAW_GRID_T100_S020_GATE90_TRIANGLE_V0_NO_CANDIDATE_B__PROTECT_LOCK_1Q_STOP_ADDS | triangle_v0_no_candidate_b | lock_1q_stop_adds | DAVID_LWMA50_RSI50_60_40__STOCH_100_3_100_60_40_low_high_simple_main_only | AUDCAD,AUDCHF,AUDJPY,AUDNZD,AUDUSD,CADCHF,CADJPY,CHFJPY,EURAUD,EURCAD,EURCHF,EURGBP,EURJPY,EURNZD,EURUSD,GBPAUD,GBPCAD,GBPCHF,GBPJPY,GBPNZD,GBPUSD,NZDCAD,NZDCHF,NZDJPY,NZDUSD,USDCAD,USDCHF,USDJPY | open | adr_event | 0.075 | ny_daily_window | 18:05 | 15:45 | 16:00 | 20:00 | david_ma_reversion | 1 | 0.2 | 0.1 | adverse_only | 38 | 28 | 10101.39 | 101.39 | 148.11 | 0 | -39.48 | -7.24 | 136 | 251 | -443.28 | -5.42 | 0 | 0 | 658 | 0 | 13 | 10 | -231.38 | 1.336572 | 452 | 1.199983 | 78.76 | 24.523944 | 24.523944 | 0.054257 | 0.275901 | 0.39193 | 46.9 | 7.96 | 2.43 | 28.98 | 17.48 | 11.06 | 565.15 | -463.76 | 0 | 233 | 219 | 6110368 | 6110383 | 51475 | 0 | 0 | false |
| RAW_GRID_T100_S020_GATE90_TRIANGLE_V0_NO_CANDIDATE_B__PROTECT_TRAIL_1Q_1Q | triangle_v0_no_candidate_b | trail_1q_1q | DAVID_LWMA50_RSI50_60_40__STOCH_100_3_100_60_40_low_high_simple_main_only | AUDCAD,AUDCHF,AUDJPY,AUDNZD,AUDUSD,CADCHF,CADJPY,CHFJPY,EURAUD,EURCAD,EURCHF,EURGBP,EURJPY,EURNZD,EURUSD,GBPAUD,GBPCAD,GBPCHF,GBPJPY,GBPNZD,GBPUSD,NZDCAD,NZDCHF,NZDJPY,NZDUSD,USDCAD,USDCHF,USDJPY | open | adr_event | 0.075 | ny_daily_window | 18:05 | 15:45 | 16:00 | 20:00 | david_ma_reversion | 1 | 0.2 | 0.1 | adverse_only | 38 | 28 | 10088.22 | 88.22 | 138.9 | 0 | -44.28 | -6.4 | 133 | 253 | -445.61 | -4.55 | 61 | 92 | 738 | 0 | 13 | 10 | -219.41 | 1.293833 | 502 | 1.171764 | 76.89 | 21.456103 | 21.456103 | 0.042741 | 0.266018 | 0.367455 | 46.81 | 6.57 | 2.19 | 27.49 | 15.94 | 10.16 | 541.03 | -465.34 | 12.53 | 251 | 251 | 6111094 | 6111081 | 51936 | 0 | 0 | false |
| RAW_GRID_T100_S020_GATE90_TRIANGLE_V0_NO_CANDIDATE_B__PROTECT_TRAIL_1Q_0_5Q | triangle_v0_no_candidate_b | trail_1q_0_5q | DAVID_LWMA50_RSI50_60_40__STOCH_100_3_100_60_40_low_high_simple_main_only | AUDCAD,AUDCHF,AUDJPY,AUDNZD,AUDUSD,CADCHF,CADJPY,CHFJPY,EURAUD,EURCAD,EURCHF,EURGBP,EURJPY,EURNZD,EURUSD,GBPAUD,GBPCAD,GBPCHF,GBPJPY,GBPNZD,GBPUSD,NZDCAD,NZDCHF,NZDJPY,NZDUSD,USDCAD,USDCHF,USDJPY | open | adr_event | 0.075 | ny_daily_window | 18:05 | 15:45 | 16:00 | 20:00 | david_ma_reversion | 1 | 0.2 | 0.1 | adverse_only | 38 | 28 | 10097.64 | 97.64 | 149.67 | 0 | -45.66 | -6.37 | 132 | 253 | -455.19 | -4.57 | 96 | 140 | 761 | 0 | 13 | 10 | -214.23 | 1.332114 | 518 | 1.189562 | 81.08 | 22.957795 | 22.957795 | 0.04432 | 0.258566 | 0.365279 | 45.95 | 5.02 | 1.74 | 27.41 | 15.44 | 9.85 | 473.78 | -474.95 | 98.8 | 253 | 265 | 6111356 | 6111400 | 52316 | 0 | 0 | false |
| RAW_GRID_T100_S020_GATE90_TRIANGLE_V0_NO_CANDIDATE_B__PROTECT_PROTECTED_FLATTEN_1Q | triangle_v0_no_candidate_b | protected_flatten_1q | DAVID_LWMA50_RSI50_60_40__STOCH_100_3_100_60_40_low_high_simple_main_only | AUDCAD,AUDCHF,AUDJPY,AUDNZD,AUDUSD,CADCHF,CADJPY,CHFJPY,EURAUD,EURCAD,EURCHF,EURGBP,EURJPY,EURNZD,EURUSD,GBPAUD,GBPCAD,GBPCHF,GBPJPY,GBPNZD,GBPUSD,NZDCAD,NZDCHF,NZDJPY,NZDUSD,USDCAD,USDCHF,USDJPY | open | adr_event | 0.075 | ny_daily_window | 18:05 | 15:45 | 16:00 | 20:00 | david_ma_reversion | 1 | 0.2 | 0.1 | adverse_only | 38 | 28 | 10102.59 | 102.59 | 152.24 | 0 | -40.62 | -9.03 | 71 | 90 | 49.6 | -1.43 | 48 | 149 | 677 | 0 | 13 | 10 | -231.73 | 1.345266 | 452 | 1.196267 | 84.07 | 25.91911 | 25.91911 | 0.057343 | 0.280038 | 0.42846 | 47.79 | 8.19 | 2.65 | 31.19 | 19.03 | 11.95 | 580.51 | 42.76 | -520.68 | 233 | 219 | 6103318 | 6107119 | 51475 | 0 | 0 | false |
| RAW_GRID_T100_S020_GATE90_TRIANGLE_V0_NO_CANDIDATE_B__PROTECT_PROTECTED_FLATTEN_1Q_TRAIL_1Q | triangle_v0_no_candidate_b | protected_flatten_1q_trail_1q | DAVID_LWMA50_RSI50_60_40__STOCH_100_3_100_60_40_low_high_simple_main_only | AUDCAD,AUDCHF,AUDJPY,AUDNZD,AUDUSD,CADCHF,CADJPY,CHFJPY,EURAUD,EURCAD,EURCHF,EURGBP,EURJPY,EURNZD,EURUSD,GBPAUD,GBPCAD,GBPCHF,GBPJPY,GBPNZD,GBPUSD,NZDCAD,NZDCHF,NZDJPY,NZDUSD,USDCAD,USDCHF,USDJPY | open | adr_event | 0.075 | ny_daily_window | 18:05 | 15:45 | 16:00 | 20:00 | david_ma_reversion | 1 | 0.2 | 0.1 | adverse_only | 38 | 28 | 10075.97 | 75.97 | 129.77 | 0 | -45.54 | -8.26 | 71 | 87 | 48.12 | -1.06 | 110 | 256 | 759 | 0 | 13 | 10 | -219.76 | 1.247024 | 502 | 1.141371 | 81.27 | 20.676091 | 20.676091 | 0.041187 | 0.26858 | 0.401743 | 47.61 | 6.57 | 2.19 | 29.28 | 17.33 | 11.16 | 550.43 | 41.85 | -516.3 | 251 | 251 | 6103329 | 6109124 | 51936 | 0 | 0 | false |

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
| protection_mode | diagnostic cycle-management replay mode; baseline preserves existing behavior, Q modes add stop-add, trailing, or protected-flatten rules without changing entries |
| protection_trail | close reason emitted when a cycle reaches the configured Q-profit activation threshold and then gives back the configured Q trail distance |
| protected_flatten | close reason emitted by protected flatten when a cycle is ugly red at the daily flatten boundary; small-red cycles can be held instead of force-closed |
| protection_close_net_usd | aggregate net USD from protection_trail and protected_flatten close cycles, including price PnL, commission, and swap |
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
| adr_normalized_return_pct | price-movement return normalized by each pair's ADR; one ADR is reported as one percent for cross-currency comparison; commission and swap remain costed in USD fields |
| close_event_total_realized_pnl_adr | sum of close-cycle realized price PnL in ADR units; same numeric value as adr_normalized_return_pct because one ADR is reported as one percent |
| close_event_avg_realized_pnl_adr | average realized price PnL per closed side cycle in ADR units, before commission and swap |
| close_event_avg_mfe_adr | average Maximum Favorable Excursion per closed side cycle in ADR units, computed from observed cycle max_pnl_adr |
| close_event_avg_mae_adr_abs | average absolute Maximum Adverse Excursion per closed side cycle in ADR units, computed from observed negative cycle min_pnl_adr |
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
| activation_rule_ids | triangle_v1_david_contra_extension,david_contra,triangle_v0_no_candidate_b | explicit | true |
| protection_modes | baseline,lock_1q_stop_adds,trail_1q_1q,trail_1q_0_5q,protected_flatten_1q,protected_flatten_1q_trail_1q | explicit | true |
| activation_controls_initial_cycle_start_only | true | true | true |
| triangle_v0_enabled | true | true when activation_rule_ids includes a triangle_v0 rule | true |
| triangle_v0_formula_id | gate90d_triangle_v0_katarakti_start_spacing_scaffold_2026_07_03 | visible when a triangle_v0 rule is enabled | true |
| triangle_v0_spacing_rails_adr | 0.2..0.3 | range/3 clamped rails when a triangle_v0 rule is enabled | true |
| triangle_v0_traceability_columns | cycle_spacing_adr,triangle_trigger_key | close-events and terminal-inventory rows carry trigger provenance | true |
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

- summaryJson: `docs/research/gates/gate90/artifacts/gate90d-2019-open-protection-sweep-no-candidate-b/activation-summary.rows.json`
- summaryCsv: `docs/research/gates/gate90/artifacts/gate90d-2019-open-protection-sweep-no-candidate-b/activation-summary.rows.csv`
- weeklyJson: `docs/research/gates/gate90/artifacts/gate90d-2019-open-protection-sweep-no-candidate-b/weekly-activation-truth.rows.json`
- weeklyCsv: `docs/research/gates/gate90/artifacts/gate90d-2019-open-protection-sweep-no-candidate-b/weekly-activation-truth.rows.csv`
- closeEventsJson: `docs/research/gates/gate90/artifacts/gate90d-2019-open-protection-sweep-no-candidate-b/close-events.rows.json`
- closeEventsCsv: `docs/research/gates/gate90/artifacts/gate90d-2019-open-protection-sweep-no-candidate-b/close-events.rows.csv`
- closeEventBreakdownsJson: `docs/research/gates/gate90/artifacts/gate90d-2019-open-protection-sweep-no-candidate-b/close-event-breakdown.rows.json`
- closeEventBreakdownsCsv: `docs/research/gates/gate90/artifacts/gate90d-2019-open-protection-sweep-no-candidate-b/close-event-breakdown.rows.csv`
- terminalInventoryJson: `docs/research/gates/gate90/artifacts/gate90d-2019-open-protection-sweep-no-candidate-b/terminal-inventory.rows.json`
- terminalInventoryCsv: `docs/research/gates/gate90/artifacts/gate90d-2019-open-protection-sweep-no-candidate-b/terminal-inventory.rows.csv`
- validationJson: `docs/research/gates/gate90/artifacts/gate90d-2019-open-protection-sweep-no-candidate-b/validation.rows.json`
- validationCsv: `docs/research/gates/gate90/artifacts/gate90d-2019-open-protection-sweep-no-candidate-b/validation.rows.csv`
- metricDefinitionsJson: `docs/research/gates/gate90/artifacts/gate90d-2019-open-protection-sweep-no-candidate-b/metric-definitions.rows.json`
- metricDefinitionsCsv: `docs/research/gates/gate90/artifacts/gate90d-2019-open-protection-sweep-no-candidate-b/metric-definitions.rows.csv`
- commandReceipt: `docs/research/gates/gate90/artifacts/gate90d-2019-open-protection-sweep-no-candidate-b/command-receipt.json`
- runSummaryJson: `docs/research/gates/gate90/artifacts/gate90d-2019-open-protection-sweep-no-candidate-b/gate90-run-summary.json`
- shaManifest: `docs/research/gates/gate90/artifacts/gate90d-2019-open-protection-sweep-no-candidate-b/gate90-activation-sha256.txt`
- report: `docs/research/gates/gate90/artifacts/gate90d-2019-open-protection-sweep-no-candidate-b/GATE90D_2019_OPEN_PROTECTION_SWEEP_NO_CANDIDATE_B.md`

## Stop Line

Gate 90 is warehouse activation research only. Do not optimize MT5 lifecycle controls, retune target/spacing, promote strategy logic, or open double-sided in-between policy from this run.
