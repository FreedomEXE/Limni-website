/*-----------------------------------------------
  LimniPortfolioEA operator inputs and config loader
-----------------------------------------------*/
#ifndef __LIMNI_PORTFOLIO_CONFIG_MQH__
#define __LIMNI_PORTFOLIO_CONFIG_MQH__

#include "Types.mqh"

input string LP_INPUT_0 = "********** LimniPortfolioEA **********";
input string LP_INPUT_1 = "----- Execution Barrier -----";
input LP_ExecutionMode ExecutionMode = LP_EXECUTION_DISABLED;
input bool EnableTrading = false;
input bool AllowLiveTrading = false;
input bool EnableStrategyEvaluation = false;
input bool RequireHedgingAccount = true;
input bool RequireAllSymbols = true;
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
input bool EnableCurrencyExposureGuard = true;
input double MaxCurrencySignedLots = 5.0;
input double MaxCurrencyGrossLots = 10.0;
input int MaxSameDirectionGridsPerCurrency = 4;
input int MaxManagedPositions = 200;
input int NewsMinimumImpact = 3;
input string LP_INPUT_6 = "----- Diagnostics -----";
input bool UseTimerWatchdog = false;
input bool ExportToCommonFiles = true;
input string OutputFolder = "LimniPortfolioEA";

void LP_LoadConfig(LP_Config &config)
{
   config.execution_mode = ExecutionMode;
   config.news_guard_mode = NewsGuardMode;
   config.enable_trading = EnableTrading;
   config.allow_live_trading = AllowLiveTrading;
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
   config.max_currency_signed_lots = MaxCurrencySignedLots;
   config.max_currency_gross_lots = MaxCurrencyGrossLots;
   config.max_same_direction_grids_per_currency = MaxSameDirectionGridsPerCurrency;
   config.max_managed_positions = MaxManagedPositions;
   config.news_minimum_impact = NewsMinimumImpact;
}

ulong LP_ConfigHash(const LP_Config &config)
{
   string payload = LP_ExecutionModeName(config.execution_mode) + "|" +
      LP_NewsGuardModeName(config.news_guard_mode) + "|" +
      LP_BoolText(config.enable_trading) + "|" +
      LP_BoolText(config.allow_live_trading) + "|" +
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
      DoubleToString(config.max_currency_signed_lots, 2) + "|" +
      DoubleToString(config.max_currency_gross_lots, 2) + "|" +
      IntegerToString(config.max_same_direction_grids_per_currency) + "|" +
      IntegerToString(config.max_managed_positions) + "|" +
      IntegerToString(config.news_minimum_impact);
   return LP_HashString(payload);
}

#endif // __LIMNI_PORTFOLIO_CONFIG_MQH__
