/*-----------------------------------------------
  LimniPortfolioEA operator inputs and config loader
-----------------------------------------------*/
#ifndef __LIMNI_PORTFOLIO_CONFIG_MQH__
#define __LIMNI_PORTFOLIO_CONFIG_MQH__

#include "Types.mqh"
#include "..\\..\\..\\Indicators\\Include\\LimniQStateCore.mqh"
#include "..\\Strategies\\RevmaTypes.mqh"

input string LP_INPUT_0 = "********** LimniPortfolioEA **********";
input string LP_INPUT_1 = "----- Execution Barrier -----";
input LP_ExecutionMode ExecutionMode = LP_EXECUTION_DISABLED;
input bool EnableTrading = false;
input bool AllowLiveTrading = false;
input bool EnableOpenOrderRouting = false;
input bool EnableCloseExecution = false;
input bool EnableAccountCloseExecution = false;
input bool EnableStrategyEvaluation = false;
input bool RequireHedgingAccount = true;
input bool RequireAllSymbols = false;
input string LP_INPUT_2 = "----- Symbol Universe -----";
input string BrokerSymbolSuffix = "";
input string LP_INPUT_3 = "----- Calendar Guards -----";
input bool UseWeekBoundaryGuard = true;
input double BrokerToEstOffsetHours = 0.0;
input LP_NewsGuardMode NewsGuardMode = LP_NEWS_GUARD_REQUIRED_FOR_LIVE;
input string NewsCalendarFile = "LimniPortfolioEA\\news_events.csv";
input int NewsBlockBeforeMinutes = 30;
input int NewsBlockAfterMinutes = 30;
input string LP_INPUT_4 = "----- Portfolio Harvest Governor -----";
input bool EnablePortfolioHarvestGovernor = false;
input double HarvestInitialTargetMoney = 0.0;
input double HarvestTrailMoney = 0.0;
input bool HarvestSoftLockOnBreach = true;
input bool HarvestGridWinddownOnBreach = true;
input bool HarvestArmEmergencyLiquidation = false;
input string LP_INPUT_5 = "----- Portfolio Risk Guards -----";
input bool EnableCurrencyExposureGuard = false;
input double MaxCurrencySignedLots = 5.0;
input double MaxCurrencyGrossLots = 10.0;
input int MaxSameDirectionGridsPerCurrency = 4;
input int MaxManagedPositions = 200;
input double MaxSingleOrderLots = 1.0;
input int MaxClosePositionsPerStep = 10;
input int NewsMinimumImpact = 3;
input string LP_INPUT_6 = "----- System: Revma v001 -----";
input bool EnableRevmaSystem = true;
input LP_UniverseMode RevmaUniverseMode = LP_UNIVERSE_CURRENT_CHART;
input bool RevmaEnableContinuationSleeve = true;
input bool RevmaEnableReversionSleeve = true;
input LP_RevmaQProfile RevmaQProfile = LP_REVMA_Q_PROFILE_MEDIUM;
input int RevmaMaxM1Bars = 50000;
input double RevmaFixedLots = 0.01;
input double RevmaGridSpacingQ = 1.0;
input int RevmaIntentExpiryMinutes = 10;
input string LP_INPUT_7 = "----- Future System: Q-State Legacy Disabled -----";
input bool EnableQStateTrendVariant = false;
input double QStateFixedLots = 0.01;
input double QStateGridSpacingQ = 1.0;
input int QStateGridCap = 50;
input int QStateIntentExpiryMinutes = 10;
input bool QStateReentryNextDayAfterHarvest = true;
input string LP_INPUT_8 = "----- Diagnostics -----";
input bool UseTimerWatchdog = false;
input bool ExportToCommonFiles = true;
input string OutputFolder = "LimniPortfolioEA";

void LP_LoadConfig(LP_Config &config)
{
   config.execution_mode = ExecutionMode;
   config.news_guard_mode = NewsGuardMode;
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
   config.enable_portfolio_harvest_governor = EnablePortfolioHarvestGovernor;
   config.harvest_initial_target_money = HarvestInitialTargetMoney;
   config.harvest_trail_money = HarvestTrailMoney;
   config.harvest_soft_lock_on_breach = HarvestSoftLockOnBreach;
   config.harvest_grid_winddown_on_breach = HarvestGridWinddownOnBreach;
   config.harvest_arm_emergency_liquidation = HarvestArmEmergencyLiquidation;
   config.enable_currency_exposure_guard = EnableCurrencyExposureGuard;
   config.enable_qstate_trend_variant = EnableQStateTrendVariant;
   config.enable_revma_system = EnableRevmaSystem;
   config.revma_universe_mode = RevmaUniverseMode;
   config.revma_enable_continuation_sleeve = RevmaEnableContinuationSleeve;
   config.revma_enable_reversion_sleeve = RevmaEnableReversionSleeve;
   config.revma_q_profile = RevmaQProfile;
   config.revma_max_m1_bars = RevmaMaxM1Bars;
   config.revma_fixed_lots = RevmaFixedLots;
   config.revma_grid_spacing_q = RevmaGridSpacingQ;
   config.revma_intent_expiry_minutes = RevmaIntentExpiryMinutes;
   config.max_currency_signed_lots = MaxCurrencySignedLots;
   config.max_currency_gross_lots = MaxCurrencyGrossLots;
   config.max_same_direction_grids_per_currency = MaxSameDirectionGridsPerCurrency;
   config.max_managed_positions = MaxManagedPositions;
   config.max_single_order_lots = MaxSingleOrderLots;
   config.max_close_positions_per_step = MaxClosePositionsPerStep;
   config.news_minimum_impact = NewsMinimumImpact;
   config.qstate_scale_lookback_days = LIMNI_QSTATE_V001_SCALE_LOOKBACK_DAYS;
   config.qstate_fixed_lots = QStateFixedLots;
   config.qstate_grid_spacing_q = QStateGridSpacingQ;
   config.qstate_grid_cap = QStateGridCap;
   config.qstate_weak_threshold = LIMNI_QSTATE_V001_WEAK_THRESHOLD;
   config.qstate_strong_threshold = LIMNI_QSTATE_V001_STRONG_THRESHOLD;
   config.qstate_max_spread_cost_q = LIMNI_QSTATE_V001_MAX_SPREAD_COST_Q;
   config.qstate_intent_expiry_minutes = QStateIntentExpiryMinutes;
   config.qstate_reentry_next_day_after_harvest = QStateReentryNextDayAfterHarvest;
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
      LP_BoolText(config.enable_qstate_trend_variant) + "|" +
      LP_BoolText(config.enable_revma_system) + "|" +
      LP_UniverseModeName(config.revma_universe_mode) + "|" +
      LP_BoolText(config.revma_enable_continuation_sleeve) + "|" +
      LP_BoolText(config.revma_enable_reversion_sleeve) + "|" +
      LP_RevmaQProfileName(config.revma_q_profile) + "|" +
      IntegerToString(LP_RevmaResolvedMaxM1Bars(config)) + "|" +
      LP_RevmaConfigQProfileId(config) + "|" +
      DoubleToString(config.revma_fixed_lots, 4) + "|" +
      DoubleToString(config.revma_grid_spacing_q, 2) + "|" +
      IntegerToString(config.revma_intent_expiry_minutes) + "|" +
      DoubleToString(config.max_currency_signed_lots, 2) + "|" +
      DoubleToString(config.max_currency_gross_lots, 2) + "|" +
      IntegerToString(config.max_same_direction_grids_per_currency) + "|" +
      IntegerToString(config.max_managed_positions) + "|" +
      DoubleToString(config.max_single_order_lots, 2) + "|" +
      IntegerToString(config.max_close_positions_per_step) + "|" +
      IntegerToString(config.news_minimum_impact) + "|" +
      IntegerToString(config.qstate_scale_lookback_days) + "|" +
      DoubleToString(config.qstate_fixed_lots, 4) + "|" +
      DoubleToString(config.qstate_grid_spacing_q, 2) + "|" +
      IntegerToString(config.qstate_grid_cap) + "|" +
      DoubleToString(config.qstate_weak_threshold, 2) + "|" +
      DoubleToString(config.qstate_strong_threshold, 2) + "|" +
      DoubleToString(config.qstate_max_spread_cost_q, 2) + "|" +
      IntegerToString(config.qstate_intent_expiry_minutes) + "|" +
      LP_BoolText(config.qstate_reentry_next_day_after_harvest);
   return LP_HashString(payload);
}

#endif // __LIMNI_PORTFOLIO_CONFIG_MQH__
