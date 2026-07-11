/*-----------------------------------------------
  Gate 108A controlled profile and broker input
-----------------------------------------------*/
#ifndef __LIMNI_PORTFOLIO_CONFIG_MQH__
#define __LIMNI_PORTFOLIO_CONFIG_MQH__

#include "BuildInfo.mqh"
#include "Types.mqh"
#include "..\\..\\..\\Indicators\\Include\\LimniQStateCore.mqh"
#include "..\\Strategies\\RevmaTypes.mqh"

enum ExecutionModeInput
{
   ExecutionDisabled = 0,    // Disabled
   ExecutionDryRun = 1,      // Dry Run
   ExecutionTester = 2,      // Tester
   ExecutionLive = 3         // Live
};

enum NewsGuardModeInput
{
   NewsDisabled = 0,         // Disabled
   NewsManualFile = 1,       // Manual File
   NewsRequiredForLive = 2   // Required For Live
};

enum NewsImpactLevelInput
{
   NewsImpactLow = 1,        // Low
   NewsImpactMedium = 2,     // Medium
   NewsImpactHigh = 3        // High
};

enum UniverseModeInput
{
   UniverseCurrentChart = 0, // Current Chart
   UniverseFx28 = 1          // FX28
};

enum RevmaQProfileInput
{
   RevmaQFast = 0,           // Fast
   RevmaQMedium = 1,         // Medium
   RevmaQSlow = 2,           // Slow
   RevmaQFull = 3,           // Full
   RevmaQCustom = 4          // Custom
};

enum StopTakeProfitModeInput
{
   StopTakeProfitDisabled = 0,       // Disabled
   SinglePairQAfterFees = 1,         // Single Pair Grid Q After Fees
   MultiCurrencyPercentAfterFees = 2, // Multi Currency Percent After Fees
   MultiCurrencyHwmTrailAfterFees = 3 // Multi Currency HWM Trail After Fees
};

enum BrokerGridTpSyncModeInput
{
   BrokerGridTpSyncOff = 0,          // Off
   BrokerGridTpSyncLiveOnly = 1,     // Live Only
   BrokerGridTpSyncTesterAndLive = 2 // Tester And Live
};

enum ReceiptModeInput
{
   ReceiptOff = 0,           // Off
   ReceiptFull = 1,          // Full
   ReceiptCompactLongRun = 2 // Compact Long Run
};

// Gate 108 strategy, lifecycle, capacity and evidence settings are compile
// frozen. The broker suffix is the only exposed compatibility input and has no
// formula authority.
input group "Gate 108 Broker Compatibility"
input string BrokerSymbolSuffix = ".i";
const string SourceRevision = LP_EA_SOURCE_BUNDLE_ID;

string LP_OutputFolderNumberPart(const double value, const int digits)
{
   string text = DoubleToString(value, digits);
   StringReplace(text, "-", "m");
   StringReplace(text, ".", "p");
   return text;
}

string LP_OutputFolderStopModePart(const LP_StopTakeProfitMode mode)
{
   if(mode == LP_SLTP_MULTI_CURRENCY_HWM_TRAIL_AFTER_FEES)
      return "AHwm";
   if(mode == LP_SLTP_MULTI_CURRENCY_PERCENT_AFTER_FEES)
      return "APct";
   if(mode == LP_SLTP_SINGLE_PAIR_Q_AFTER_FEES)
      return "GQ";
   return "NoTP";
}

string LP_OutputFolderReceiptModePart(const LP_ReceiptMode mode)
{
   if(mode == LP_RECEIPT_MODE_COMPACT_LONG_RUN)
      return "RC";
   return "RF";
}

bool LP_OutputFolderAutoRequested(const string requested_folder)
{
   return requested_folder == "" ||
      requested_folder == "AUTO" ||
      requested_folder == "auto" ||
      requested_folder == "Auto";
}

bool LP_OutputFolderDisabled(const string requested_folder)
{
   return requested_folder == "" ||
      requested_folder == "OFF" ||
      requested_folder == "off" ||
      requested_folder == "Off" ||
      requested_folder == "NONE" ||
      requested_folder == "none" ||
      requested_folder == "None" ||
      requested_folder == "DISABLED" ||
      requested_folder == "disabled" ||
      requested_folder == "Disabled";
}

string LP_ResolveOutputFolder(const LP_Config &config, const string requested_folder)
{
   if(LP_OutputFolderDisabled(requested_folder))
      return "OFF";
   if(!LP_OutputFolderAutoRequested(requested_folder))
      return requested_folder;

   string stamp = LP_SafePart(LP_Stamp(TimeLocal()) + "_R" + IntegerToString((long)GetTickCount()));
   // Keep AUTO deliberately short. Receipt and telemetry files add their own
   // run/artifact suffixes below the terminal Common Files root; descriptive
   // parameter strings here can exceed MQL5's filename/path limit (5003).
   // The complete configuration remains in the run manifest and summary.
   string folder = "LPEA_" +
      LP_UniverseModeName(config.revma_universe_mode) + "_" +
      LP_RevmaConfigQProfileId(config) + "_" +
      LP_OutputFolderStopModePart(config.stop_take_profit_mode) +
      "_" + LP_OutputFolderReceiptModePart(config.receipt_mode) + "_" + stamp;
   return folder;
}

void LP_LoadConfig(LP_Config &config)
{
   config.execution_mode = LP_EXECUTION_TESTER_ONLY;
   config.news_guard_mode = LP_NEWS_GUARD_DISABLED;
   config.enable_trading = true;
   config.allow_live_trading = false;
   config.enable_open_order_routing = true;
   config.enable_close_execution = true;
   config.enable_account_close_execution = true;
   config.enable_strategy_evaluation = true;
   config.require_hedging_account = true;
   config.require_all_symbols = true;
   config.use_timer_watchdog = true;
   config.timer_watchdog_seconds = 5;
   config.persist_revma_lifecycle_state = false;
   config.source_revision = SourceRevision;
   config.use_week_boundary_guard = true;
   config.broker_to_est_offset_hours = 0.0;
   config.sunday_open_hour_est = 17;
   config.friday_close_hour_est = 17;
   config.boundary_block_minutes = 60;
   config.news_block_before_minutes = 30;
   config.news_block_after_minutes = 30;
   config.broker_symbol_suffix = BrokerSymbolSuffix;
   config.news_calendar_file = "LimniPortfolioEA\\news_events.csv";
   config.export_to_common_files = true;
   config.receipt_mode = LP_RECEIPT_MODE_OFF;
   config.enable_portfolio_harvest_governor = false;
   config.harvest_initial_target_money = 0.0;
   config.harvest_trail_money = 0.0;
   config.harvest_soft_lock_on_breach = false;
   config.harvest_grid_winddown_on_breach = false;
   config.harvest_arm_emergency_liquidation = false;
   config.enable_currency_exposure_guard = false;
   config.enable_qstate_trend_variant = false;
   config.enable_revma_system = true;
   config.revma_universe_mode = LP_UNIVERSE_FX28;
   config.revma_q_profile = LP_REVMA_Q_PROFILE_MEDIUM;
   config.revma_max_m1_bars = 50000;
   config.revma_fixed_lots = 0.01;
   config.revma_grid_spacing_q = 0.10;
   config.revma_intent_expiry_minutes = 10;
   config.revma_show_visual_dashboard = false;
   config.revma_dashboard_refresh_seconds = 1;
   config.revma_dashboard_screenshot_on_divergent_add = false;
   config.stop_take_profit_mode = LP_SLTP_DISABLED;
   config.broker_grid_tp_sync_mode = LP_BROKER_GRID_TP_SYNC_OFF;
   config.grid_take_profit_q = 0.0;
   config.grid_stop_loss_q = 0.0;
   config.account_take_profit_pct = 0.0;
   config.account_stop_loss_pct = 0.0;
   config.stop_take_profit_close_commission_per_lot = 0.0;
   config.hwm_trail_arm_pct = 0.0;
   config.hwm_trail_min_lock_pct = 0.0;
   config.hwm_trail_giveback_pct = 0.0;
   config.hwm_trail_block_new_entries_when_armed = false;
   config.hwm_trail_hard_stop_loss_pct = 0.0;
   config.max_currency_signed_lots = 5.0;
   config.max_currency_gross_lots = 10.0;
   config.max_same_direction_grids_per_currency = 4;
   config.max_managed_positions = 200;
   config.max_single_order_lots = 1.0;
   config.max_close_positions_per_step = 10;
   config.news_minimum_impact = 3;
   config.qstate_scale_lookback_days = LIMNI_QSTATE_V001_SCALE_LOOKBACK_DAYS;
   config.qstate_fixed_lots = 0.01;
   config.qstate_grid_spacing_q = 1.0;
   config.qstate_grid_cap = 50;
   config.qstate_weak_threshold = LIMNI_QSTATE_V001_WEAK_THRESHOLD;
   config.qstate_strong_threshold = LIMNI_QSTATE_V001_STRONG_THRESHOLD;
   config.qstate_max_spread_cost_q = LIMNI_QSTATE_V001_MAX_SPREAD_COST_Q;
   config.qstate_intent_expiry_minutes = 10;
   config.qstate_reentry_next_day_after_harvest = true;
   config.output_folder = "OFF";
}

ulong LP_ConfigHash(const LP_Config &config)
{
   string payload = LP_ExecutionModeName(config.execution_mode) + "|" +
      LP_NewsGuardModeName(config.news_guard_mode) + "|" +
      LP_BoolText(config.enable_trading) + "|" +
      LP_BoolText(config.allow_live_trading) + "|" +
      LP_BoolText(config.enable_open_order_routing) + "|" +
      LP_BoolText(config.enable_close_execution) + "|" +
      LP_BoolText(config.enable_account_close_execution) + "|" +
      LP_BoolText(config.enable_strategy_evaluation) + "|" +
       LP_BoolText(config.require_hedging_account) + "|" +
       LP_BoolText(config.require_all_symbols) + "|" +
       LP_BoolText(config.use_timer_watchdog) + "|" +
       IntegerToString(config.timer_watchdog_seconds) + "|" +
       LP_BoolText(config.persist_revma_lifecycle_state) + "|" +
       config.source_revision + "|" +
       LP_ReceiptModeName(config.receipt_mode) + "|" +
      LP_BoolText(config.export_to_common_files) + "|" +
      config.output_folder + "|" +
      LP_BoolText(config.use_week_boundary_guard) + "|" +
      DoubleToString(config.broker_to_est_offset_hours, 2) + "|" +
      IntegerToString(config.sunday_open_hour_est) + "|" +
      IntegerToString(config.friday_close_hour_est) + "|" +
      IntegerToString(config.boundary_block_minutes) + "|" +
      IntegerToString(config.news_block_before_minutes) + "|" +
      IntegerToString(config.news_block_after_minutes) + "|" +
      config.broker_symbol_suffix + "|" +
      config.news_calendar_file + "|" +
      LP_BoolText(config.enable_portfolio_harvest_governor) + "|" +
      DoubleToString(config.harvest_initial_target_money, 2) + "|" +
      DoubleToString(config.harvest_trail_money, 2) + "|" +
      LP_BoolText(config.harvest_soft_lock_on_breach) + "|" +
      LP_BoolText(config.harvest_grid_winddown_on_breach) + "|" +
      LP_BoolText(config.harvest_arm_emergency_liquidation) + "|" +
      LP_BoolText(config.enable_currency_exposure_guard) + "|" +
      LP_BoolText(config.enable_qstate_trend_variant) + "|" +
      LP_BoolText(config.enable_revma_system) + "|" +
      LP_UniverseModeName(config.revma_universe_mode) + "|" +
      LP_RevmaQProfileName(config.revma_q_profile) + "|" +
      IntegerToString(LP_RevmaResolvedMaxM1Bars(config)) + "|" +
      LP_RevmaConfigQProfileId(config) + "|" +
      DoubleToString(config.revma_fixed_lots, 4) + "|" +
      DoubleToString(config.revma_grid_spacing_q, 2) + "|" +
      IntegerToString(config.revma_intent_expiry_minutes) + "|" +
      LP_BoolText(config.revma_show_visual_dashboard) + "|" +
      IntegerToString(config.revma_dashboard_refresh_seconds) + "|" +
      LP_BoolText(config.revma_dashboard_screenshot_on_divergent_add) + "|" +
      LP_StopTakeProfitModeName(config.stop_take_profit_mode) + "|" +
      LP_BrokerGridTpSyncModeName(config.broker_grid_tp_sync_mode) + "|" +
      DoubleToString(config.grid_take_profit_q, 4) + "|" +
      DoubleToString(config.grid_stop_loss_q, 4) + "|" +
      DoubleToString(config.account_take_profit_pct, 4) + "|" +
      DoubleToString(config.account_stop_loss_pct, 4) + "|" +
      DoubleToString(config.stop_take_profit_close_commission_per_lot, 2) + "|" +
      DoubleToString(config.hwm_trail_arm_pct, 4) + "|" +
      DoubleToString(config.hwm_trail_min_lock_pct, 4) + "|" +
      DoubleToString(config.hwm_trail_giveback_pct, 4) + "|" +
      LP_BoolText(config.hwm_trail_block_new_entries_when_armed) + "|" +
      DoubleToString(config.hwm_trail_hard_stop_loss_pct, 4) + "|" +
      DoubleToString(config.max_currency_signed_lots, 2) + "|" +
      DoubleToString(config.max_currency_gross_lots, 2) + "|" +
      IntegerToString(config.max_same_direction_grids_per_currency) + "|" +
      IntegerToString(config.max_managed_positions) + "|" +
      DoubleToString(config.max_single_order_lots, 2) + "|" +
      IntegerToString(config.max_close_positions_per_step) + "|" +
      IntegerToString(config.news_minimum_impact);
   return LP_HashString(payload);
}

#endif // __LIMNI_PORTFOLIO_CONFIG_MQH__
