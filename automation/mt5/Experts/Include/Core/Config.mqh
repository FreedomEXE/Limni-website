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

enum RevmaSleeveModeInput
{
   RevmaSleevesBoth = 0,     // Both
   RevmaContinuationOnly = 1,// Continuation Only
   RevmaReversionOnly = 2    // Reversion Only
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
   MultiCurrencyPercentAfterFees = 2 // Multi Currency Percent After Fees
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
input RevmaSleeveModeInput RevmaSleeveMode = RevmaSleevesBoth;
input RevmaQProfileInput RevmaQProfile = RevmaQMedium;
input int RevmaCustomMaxM1Bars = 50000;
input double RevmaFixedLots = 0.01;
input double RevmaGridSpacingQ = 0.1;
input double RevmaReversionGridSpacingQ = 0.0;
input double RevmaContinuationGridSpacingQ = 0.0;
input int RevmaIntentExpiryMinutes = 10;
input bool RevmaShowVisualDashboard = true;
input int RevmaDashboardRefreshSeconds = 1;
input bool RevmaDashboardScreenshotOnDivergentAdd = false;

input group "Stop / Take Profit"
input StopTakeProfitModeInput StopTakeProfitMode = SinglePairQAfterFees;
input double TakeProfit = 0.1;
input double StopLoss = 0.0;
input double RevmaReversionTakeProfit = 0.0;
input double RevmaReversionStopLoss = 0.0;
input double RevmaContinuationTakeProfit = 0.0;
input double RevmaContinuationStopLoss = 0.0;
input double StopTakeProfitCloseCommissionPerLot = 0.00;

input group "Diagnostics"
input bool UseTimerWatchdog = false;
input bool ExportToCommonFiles = true;
input string OutputFolder = "LimniPortfolioEA_Gate99ZZE_Smoke";

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
   config.output_folder = OutputFolder;
   config.news_calendar_file = NewsCalendarFile;
   config.export_to_common_files = ExportToCommonFiles;
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
   config.revma_sleeve_mode = (LP_RevmaSleeveMode)RevmaSleeveMode;
   config.revma_enable_continuation_sleeve =
      config.revma_sleeve_mode == LP_REVMA_SLEEVES_BOTH ||
      config.revma_sleeve_mode == LP_REVMA_SLEEVES_TREND_ONLY;
   config.revma_enable_reversion_sleeve =
      config.revma_sleeve_mode == LP_REVMA_SLEEVES_BOTH ||
      config.revma_sleeve_mode == LP_REVMA_SLEEVES_MEAN_REVERSION_ONLY;
   config.revma_q_profile = (LP_RevmaQProfile)RevmaQProfile;
   config.revma_max_m1_bars = RevmaCustomMaxM1Bars;
   config.revma_fixed_lots = RevmaFixedLots;
   config.revma_grid_spacing_q = RevmaGridSpacingQ;
   config.revma_reversion_grid_spacing_q = MathMax(0.0, RevmaReversionGridSpacingQ);
   config.revma_continuation_grid_spacing_q = MathMax(0.0, RevmaContinuationGridSpacingQ);
   config.revma_intent_expiry_minutes = RevmaIntentExpiryMinutes;
   config.revma_show_visual_dashboard = RevmaShowVisualDashboard;
   config.revma_dashboard_refresh_seconds = MathMax(0, RevmaDashboardRefreshSeconds);
   config.revma_dashboard_screenshot_on_divergent_add = RevmaDashboardScreenshotOnDivergentAdd;
   config.stop_take_profit_mode = (LP_StopTakeProfitMode)StopTakeProfitMode;
   config.take_profit_value = MathMax(0.0, TakeProfit);
   config.stop_loss_value = MathMax(0.0, StopLoss);
   config.revma_reversion_take_profit_value = MathMax(0.0, RevmaReversionTakeProfit);
   config.revma_reversion_stop_loss_value = MathMax(0.0, RevmaReversionStopLoss);
   config.revma_continuation_take_profit_value = MathMax(0.0, RevmaContinuationTakeProfit);
   config.revma_continuation_stop_loss_value = MathMax(0.0, RevmaContinuationStopLoss);
   config.stop_take_profit_close_commission_per_lot = MathMax(0.0, StopTakeProfitCloseCommissionPerLot);
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
      LP_RevmaSleeveModeName(config.revma_sleeve_mode) + "|" +
      LP_RevmaQProfileName(config.revma_q_profile) + "|" +
      IntegerToString(LP_RevmaResolvedMaxM1Bars(config)) + "|" +
      LP_RevmaConfigQProfileId(config) + "|" +
      DoubleToString(config.revma_fixed_lots, 4) + "|" +
      DoubleToString(config.revma_grid_spacing_q, 2) + "|" +
      DoubleToString(config.revma_reversion_grid_spacing_q, 2) + "|" +
      DoubleToString(config.revma_continuation_grid_spacing_q, 2) + "|" +
      IntegerToString(config.revma_intent_expiry_minutes) + "|" +
      LP_StopTakeProfitModeName(config.stop_take_profit_mode) + "|" +
      DoubleToString(config.take_profit_value, 4) + "|" +
      DoubleToString(config.stop_loss_value, 4) + "|" +
      DoubleToString(config.revma_reversion_take_profit_value, 4) + "|" +
      DoubleToString(config.revma_reversion_stop_loss_value, 4) + "|" +
      DoubleToString(config.revma_continuation_take_profit_value, 4) + "|" +
      DoubleToString(config.revma_continuation_stop_loss_value, 4) + "|" +
      DoubleToString(config.stop_take_profit_close_commission_per_lot, 2) + "|" +
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
