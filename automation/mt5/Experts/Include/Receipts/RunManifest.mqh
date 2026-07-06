/*-----------------------------------------------
  Run manifest receipt writer
-----------------------------------------------*/
#ifndef __LIMNI_PORTFOLIO_RUN_MANIFEST_MQH__
#define __LIMNI_PORTFOLIO_RUN_MANIFEST_MQH__

#include "..\\Core\\BuildInfo.mqh"
#include "..\\Core\\Types.mqh"
#include "..\\Market\\SessionCalendar.mqh"
#include "ReceiptWriter.mqh"

void LP_WriteRunManifest(
   LP_ReceiptWriter &receipts,
   const LP_Config &config,
   const ulong config_hash,
   const ulong symbol_universe_hash
)
{
   receipts.Write(
      LP_RECEIPT_RUN_START,
      "",
      "started",
      "scope=" + LP_BUILD_SCOPE +
         "|execution_mode=" + LP_ExecutionModeName(config.execution_mode) +
         "|enable_trading=" + LP_BoolText(config.enable_trading) +
         "|allow_live_trading=" + LP_BoolText(config.allow_live_trading) +
         "|open_order_routing=" + LP_BoolText(config.enable_open_order_routing) +
         "|enable_strategy_evaluation=" + LP_BoolText(config.enable_strategy_evaluation) +
         "|news_guard_mode=" + LP_NewsGuardModeName(config.news_guard_mode) +
         "|week_boundary=" + LP_BoolText(config.use_week_boundary_guard) +
         "|harvest_governor=" + LP_BoolText(config.enable_portfolio_harvest_governor) +
         "|currency_guard=" + LP_BoolText(config.enable_currency_exposure_guard),
      0,
      0,
      0,
      0,
      0,
      0
   );

   receipts.Summary("ea_name", LP_EA_NAME);
   receipts.Summary("ea_version", LP_EA_VERSION);
   receipts.Summary("build_gate", LP_BUILD_GATE);
   receipts.Summary("build_scope", LP_BUILD_SCOPE);
   receipts.Summary("config_hash", (string)config_hash);
   receipts.Summary("symbol_universe_hash", (string)symbol_universe_hash);
   receipts.Summary("execution_mode", LP_ExecutionModeName(config.execution_mode));
   receipts.Summary("enable_trading", LP_BoolText(config.enable_trading));
   receipts.Summary("allow_live_trading", LP_BoolText(config.allow_live_trading));
   receipts.Summary("open_order_routing_enabled", LP_BoolText(config.enable_open_order_routing));
   receipts.Summary("strategy_evaluation_enabled", LP_BoolText(config.enable_strategy_evaluation));
   receipts.Summary("news_guard_mode", LP_NewsGuardModeName(config.news_guard_mode));
   receipts.Summary("news_calendar_file", config.news_calendar_file);
   receipts.Summary("week_boundary_description", LP_WeekBoundaryDescription());
   receipts.Summary("portfolio_harvest_governor_enabled", LP_BoolText(config.enable_portfolio_harvest_governor));
   receipts.Summary("harvest_initial_target_money", DoubleToString(config.harvest_initial_target_money, 2));
   receipts.Summary("harvest_trail_money", DoubleToString(config.harvest_trail_money, 2));
   receipts.Summary("harvest_soft_lock_on_breach", LP_BoolText(config.harvest_soft_lock_on_breach));
   receipts.Summary("harvest_grid_winddown_on_breach", LP_BoolText(config.harvest_grid_winddown_on_breach));
   receipts.Summary("harvest_arm_emergency_liquidation", LP_BoolText(config.harvest_arm_emergency_liquidation));
   receipts.Summary("currency_exposure_guard_enabled", LP_BoolText(config.enable_currency_exposure_guard));
   receipts.Summary("max_currency_signed_lots", DoubleToString(config.max_currency_signed_lots, 2));
   receipts.Summary("max_currency_gross_lots", DoubleToString(config.max_currency_gross_lots, 2));
   receipts.Summary("max_same_direction_grids_per_currency", IntegerToString(config.max_same_direction_grids_per_currency));
   receipts.Summary("max_managed_positions", IntegerToString(config.max_managed_positions));
   receipts.Summary("max_single_order_lots", DoubleToString(config.max_single_order_lots, 2));
   receipts.Summary("news_minimum_impact", IntegerToString(config.news_minimum_impact));
}

#endif // __LIMNI_PORTFOLIO_RUN_MANIFEST_MQH__
