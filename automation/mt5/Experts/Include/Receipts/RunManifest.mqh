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
         "|enable_strategy_evaluation=" + LP_BoolText(config.enable_strategy_evaluation) +
         "|news_guard_mode=" + LP_NewsGuardModeName(config.news_guard_mode) +
         "|week_boundary=" + LP_BoolText(config.use_week_boundary_guard),
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
   receipts.Summary("strategy_evaluation_enabled", LP_BoolText(config.enable_strategy_evaluation));
   receipts.Summary("news_guard_mode", LP_NewsGuardModeName(config.news_guard_mode));
   receipts.Summary("news_calendar_file", config.news_calendar_file);
   receipts.Summary("week_boundary_description", LP_WeekBoundaryDescription());
}

#endif // __LIMNI_PORTFOLIO_RUN_MANIFEST_MQH__
