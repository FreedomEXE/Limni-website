/*-----------------------------------------------
  LimniPortfolioEA operator inputs and config loader
-----------------------------------------------*/
#ifndef __LIMNI_PORTFOLIO_CONFIG_MQH__
#define __LIMNI_PORTFOLIO_CONFIG_MQH__

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

enum ReceiptModeInput
{
   ReceiptOff = 0,           // Off
   ReceiptFull = 1,          // Full
   ReceiptCompactLongRun = 2 // Compact Long Run
};

input group "Execution"
input ExecutionModeInput ExecutionMode = ExecutionTester;
input bool EnableTrading = true;
input bool AllowLiveTrading = false;
input bool EnableOpenOrderRouting = true;
input bool EnableCloseExecution = true;
input bool EnableAccountCloseExecution = false;
input bool EnableStrategyEvaluation = true;
input bool RequireHedgingAccount = true;
input bool RequireAllSymbols = false;

input group "Symbol Universe"
input string BrokerSymbolSuffix = ".i";

input group "Calendar Guards"
input bool UseWeekBoundaryGuard = true;
input double BrokerToEstOffsetHours = 0.0;
input NewsGuardModeInput NewsGuardMode = NewsDisabled;
input string NewsCalendarFile = "LimniPortfolioEA\\news_events.csv";
input int NewsBlockBeforeMinutes = 30;
input int NewsBlockAfterMinutes = 30;

input group "Portfolio Risk Guards"
input bool EnableCurrencyExposureGuard = false;
input double MaxCurrencySignedLots = 5.0;
input double MaxCurrencyGrossLots = 10.0;
input int MaxSameDirectionGridsPerCurrency = 4;
input int MaxManagedPositions = 200;
input double MaxSingleOrderLots = 1.0;
input int MaxClosePositionsPerStep = 10;
input NewsImpactLevelInput NewsMinimumImpact = NewsImpactHigh;

input group "Revma"
input UniverseModeInput RevmaUniverseMode = UniverseCurrentChart;
input RevmaQProfileInput RevmaQProfile = RevmaQMedium;
input int RevmaCustomMaxM1Bars = 50000;
input double RevmaFixedLots = 0.01;
input double RevmaGridSpacingQ = 0.1;
input int RevmaIntentExpiryMinutes = 10;
input bool RevmaShowVisualDashboard = false;
input int RevmaDashboardRefreshSeconds = 1;
input bool RevmaDashboardScreenshotOnDivergentAdd = false;

input group "Stop / Take Profit"
input StopTakeProfitModeInput StopTakeProfitMode = SinglePairQAfterFees;
input double GridTakeProfitQ = 0.1;
input double GridStopLossQ = 0.0;
input double AccountTakeProfitPct = 0.0;
input double AccountStopLossPct = 0.0;
input double StopTakeProfitCloseCommissionPerLot = 0.00;
input double HwmTrailArmPct = 0.010;
input double HwmTrailMinLockPct = 0.005;
input double HwmTrailGivebackPct = 0.010;
input bool HwmTrailBlockNewEntriesWhenArmed = true;
input double HwmTrailHardStopLossPct = 0.000;

input group "Diagnostics"
input bool UseTimerWatchdog = false;
input bool ExportToCommonFiles = true;
input ReceiptModeInput ReceiptMode = ReceiptOff;
input string OutputFolder = "OFF";

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
   string folder = "LimniPortfolioEA_Rv_" +
      LP_UniverseModeName(config.revma_universe_mode) + "_" +
      LP_RevmaConfigQProfileId(config) + "_" +
      LP_OutputFolderStopModePart(config.stop_take_profit_mode) +
      "_GTP" + LP_OutputFolderNumberPart(config.grid_take_profit_q, 3) +
      "_GSL" + LP_OutputFolderNumberPart(config.grid_stop_loss_q, 3) +
      "_ATP" + LP_OutputFolderNumberPart(config.account_take_profit_pct, 3) +
      "_ASL" + LP_OutputFolderNumberPart(config.account_stop_loss_pct, 3) +
      "_L" + LP_OutputFolderNumberPart(config.revma_fixed_lots, 3) +
      "_G" + LP_OutputFolderNumberPart(config.revma_grid_spacing_q, 2) + "Q_" +
      LP_OutputFolderReceiptModePart(config.receipt_mode) + "_" +
      (config.enable_currency_exposure_guard ? "CG" : "NCG") + "_" +
      (config.enable_portfolio_harvest_governor ? "EG" : "NEG") + "_" +
      (config.enable_account_close_execution ? "AC" : "NAC") + "_" +
      stamp;
   return folder;
}

void LP_LoadConfig(LP_Config &config)
{
   config.execution_mode = (LP_ExecutionMode)ExecutionMode;
   config.news_guard_mode = (LP_NewsGuardMode)NewsGuardMode;
   config.enable_trading = EnableTrading;
   config.allow_live_trading = AllowLiveTrading;
   config.enable_open_order_routing = EnableOpenOrderRouting;
   config.enable_close_execution = EnableCloseExecution;
   config.enable_account_close_execution = EnableAccountCloseExecution;
   config.enable_strategy_evaluation = EnableStrategyEvaluation;
   config.require_hedging_account = RequireHedgingAccount;
   config.require_all_symbols = RequireAllSymbols;
   config.use_timer_watchdog = UseTimerWatchdog;
   config.use_week_boundary_guard = UseWeekBoundaryGuard;
   config.broker_to_est_offset_hours = BrokerToEstOffsetHours;
   config.sunday_open_hour_est = 17;
   config.friday_close_hour_est = 17;
   config.boundary_block_minutes = 60;
   config.news_block_before_minutes = NewsBlockBeforeMinutes;
   config.news_block_after_minutes = NewsBlockAfterMinutes;
   config.broker_symbol_suffix = BrokerSymbolSuffix;
   config.news_calendar_file = NewsCalendarFile;
   config.export_to_common_files = ExportToCommonFiles;
   config.receipt_mode = (LP_ReceiptMode)ReceiptMode;
   if(LP_OutputFolderAutoRequested(OutputFolder))
   {
      config.export_to_common_files = true;
      config.receipt_mode = LP_RECEIPT_MODE_COMPACT_LONG_RUN;
   }
   config.enable_portfolio_harvest_governor = false;
   config.harvest_initial_target_money = 0.0;
   config.harvest_trail_money = 0.0;
   config.harvest_soft_lock_on_breach = false;
   config.harvest_grid_winddown_on_breach = false;
   config.harvest_arm_emergency_liquidation = false;
   config.enable_currency_exposure_guard = EnableCurrencyExposureGuard;
   config.enable_qstate_trend_variant = false;
   config.enable_revma_system = true;
   config.revma_universe_mode = (LP_UniverseMode)RevmaUniverseMode;
   config.revma_q_profile = (LP_RevmaQProfile)RevmaQProfile;
   config.revma_max_m1_bars = RevmaCustomMaxM1Bars;
   config.revma_fixed_lots = RevmaFixedLots;
   config.revma_grid_spacing_q = RevmaGridSpacingQ;
   config.revma_intent_expiry_minutes = RevmaIntentExpiryMinutes;
   config.revma_show_visual_dashboard = RevmaShowVisualDashboard;
   config.revma_dashboard_refresh_seconds = MathMax(0, RevmaDashboardRefreshSeconds);
   config.revma_dashboard_screenshot_on_divergent_add = RevmaDashboardScreenshotOnDivergentAdd;
   config.stop_take_profit_mode = (LP_StopTakeProfitMode)StopTakeProfitMode;
   config.grid_take_profit_q = MathMax(0.0, GridTakeProfitQ);
   config.grid_stop_loss_q = MathMax(0.0, GridStopLossQ);
   config.account_take_profit_pct = MathMax(0.0, AccountTakeProfitPct);
   config.account_stop_loss_pct = MathMax(0.0, AccountStopLossPct);
   config.stop_take_profit_close_commission_per_lot = MathMax(0.0, StopTakeProfitCloseCommissionPerLot);
   config.hwm_trail_arm_pct = MathMax(0.0, HwmTrailArmPct);
   config.hwm_trail_min_lock_pct = MathMax(0.0, HwmTrailMinLockPct);
   config.hwm_trail_giveback_pct = MathMax(0.0, HwmTrailGivebackPct);
   config.hwm_trail_block_new_entries_when_armed = HwmTrailBlockNewEntriesWhenArmed;
   config.hwm_trail_hard_stop_loss_pct = MathMax(0.0, HwmTrailHardStopLossPct);
   config.max_currency_signed_lots = MaxCurrencySignedLots;
   config.max_currency_gross_lots = MaxCurrencyGrossLots;
   config.max_same_direction_grids_per_currency = MaxSameDirectionGridsPerCurrency;
   config.max_managed_positions = MaxManagedPositions;
   config.max_single_order_lots = MaxSingleOrderLots;
   config.max_close_positions_per_step = MaxClosePositionsPerStep;
   config.news_minimum_impact = (int)NewsMinimumImpact;
   config.qstate_scale_lookback_days = LIMNI_QSTATE_V001_SCALE_LOOKBACK_DAYS;
   config.qstate_fixed_lots = 0.01;
   config.qstate_grid_spacing_q = 1.0;
   config.qstate_grid_cap = 50;
   config.qstate_weak_threshold = LIMNI_QSTATE_V001_WEAK_THRESHOLD;
   config.qstate_strong_threshold = LIMNI_QSTATE_V001_STRONG_THRESHOLD;
   config.qstate_max_spread_cost_q = LIMNI_QSTATE_V001_MAX_SPREAD_COST_Q;
   config.qstate_intent_expiry_minutes = 10;
   config.qstate_reentry_next_day_after_harvest = true;
   config.output_folder = LP_ResolveOutputFolder(config, OutputFolder);
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
      LP_ReceiptModeName(config.receipt_mode) + "|" +
      DoubleToString(config.broker_to_est_offset_hours, 2) + "|" +
      config.broker_symbol_suffix + "|" +
      config.news_calendar_file + "|" +
      LP_BoolText(config.enable_portfolio_harvest_governor) + "|" +
      DoubleToString(config.harvest_initial_target_money, 2) + "|" +
      DoubleToString(config.harvest_trail_money, 2) + "|" +
      LP_BoolText(config.harvest_soft_lock_on_breach) + "|" +
      LP_BoolText(config.harvest_grid_winddown_on_breach) + "|" +
      LP_BoolText(config.harvest_arm_emergency_liquidation) + "|" +
      LP_BoolText(config.enable_currency_exposure_guard) + "|" +
      LP_UniverseModeName(config.revma_universe_mode) + "|" +
      LP_RevmaQProfileName(config.revma_q_profile) + "|" +
      IntegerToString(LP_RevmaResolvedMaxM1Bars(config)) + "|" +
      LP_RevmaConfigQProfileId(config) + "|" +
      DoubleToString(config.revma_fixed_lots, 4) + "|" +
      DoubleToString(config.revma_grid_spacing_q, 2) + "|" +
      IntegerToString(config.revma_intent_expiry_minutes) + "|" +
      LP_StopTakeProfitModeName(config.stop_take_profit_mode) + "|" +
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
