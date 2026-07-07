/*-----------------------------------------------
  Run manifest receipt writer
-----------------------------------------------*/
#ifndef __LIMNI_PORTFOLIO_RUN_MANIFEST_MQH__
#define __LIMNI_PORTFOLIO_RUN_MANIFEST_MQH__

#include "..\\Core\\BuildInfo.mqh"
#include "..\\Core\\Types.mqh"
#include "..\\Market\\SessionCalendar.mqh"
#include "..\\Strategies\\RevmaTypes.mqh"
#include "..\\..\\..\\Indicators\\Include\\LimniQStateCore.mqh"
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
         "|close_execution=" + LP_BoolText(config.enable_close_execution) +
         "|account_close_execution=" + LP_BoolText(config.enable_account_close_execution) +
         "|enable_strategy_evaluation=" + LP_BoolText(config.enable_strategy_evaluation) +
         "|news_guard_mode=" + LP_NewsGuardModeName(config.news_guard_mode) +
         "|week_boundary=" + LP_BoolText(config.use_week_boundary_guard) +
         "|harvest_governor=" + LP_BoolText(config.enable_portfolio_harvest_governor) +
         "|currency_guard=" + LP_BoolText(config.enable_currency_exposure_guard) +
         "|active_system=" + (config.enable_revma_system ? LP_REVMA_SYSTEM_ID : (config.enable_qstate_trend_variant ? "legacy-qstate" : "none")) +
         "|revma_enabled=" + LP_BoolText(config.enable_revma_system) +
         "|revma_formula_id=" + LP_REVMA_FORMULA_ID +
         "|revma_formula_hash=" + (string)LP_RevmaFormulaHash() +
         "|revma_pair_direction_formula_id=" + LimniPairDirectionFormulaId() +
         "|revma_pair_direction_formula_hash=" + (string)LimniPairDirectionFormulaHash() +
         "|legacy_qstate_enabled=" + LP_BoolText(config.enable_qstate_trend_variant) +
         (config.enable_qstate_trend_variant ?
            "|qstate_formula_id=" + LimniQStateFormulaId() +
            "|qstate_formula_hash=" + (string)LimniQStateFormulaHash() : ""),
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
   receipts.Summary("close_execution_enabled", LP_BoolText(config.enable_close_execution));
   receipts.Summary("account_close_execution_enabled", LP_BoolText(config.enable_account_close_execution));
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
   receipts.Summary("active_system", config.enable_revma_system ? LP_REVMA_SYSTEM_ID : (config.enable_qstate_trend_variant ? "legacy-qstate" : "none"));
   receipts.Summary("revma_system_id", LP_REVMA_SYSTEM_ID);
   receipts.Summary("revma_system_name", LP_REVMA_SYSTEM_NAME);
   receipts.Summary("revma_enabled", LP_BoolText(config.enable_revma_system));
   receipts.Summary("revma_universe_mode", LP_UniverseModeName(config.revma_universe_mode));
   receipts.Summary("revma_formula_id", LP_REVMA_FORMULA_ID);
   receipts.Summary("revma_formula_hash", (string)LP_RevmaFormulaHash());
   receipts.Summary("revma_pair_direction_formula_id", LimniPairDirectionFormulaId());
   receipts.Summary("revma_pair_direction_formula_hash", (string)LimniPairDirectionFormulaHash());
   receipts.Summary("revma_continuation_sleeve_enabled", LP_BoolText(config.revma_enable_continuation_sleeve));
   receipts.Summary("revma_reversion_sleeve_enabled", LP_BoolText(config.revma_enable_reversion_sleeve));
   receipts.Summary("revma_fixed_lots", DoubleToString(config.revma_fixed_lots, 4));
   receipts.Summary("revma_grid_spacing_q", DoubleToString(config.revma_grid_spacing_q, 2));
   receipts.Summary("revma_intent_expiry_minutes", IntegerToString(config.revma_intent_expiry_minutes));
   receipts.Summary("revma_bootstrap_m1_bars", IntegerToString(config.revma_bootstrap_m1_bars));
   receipts.Summary("qstate_trend_variant_enabled", LP_BoolText(config.enable_qstate_trend_variant));
   receipts.Summary("max_currency_signed_lots", DoubleToString(config.max_currency_signed_lots, 2));
   receipts.Summary("max_currency_gross_lots", DoubleToString(config.max_currency_gross_lots, 2));
   receipts.Summary("max_same_direction_grids_per_currency", IntegerToString(config.max_same_direction_grids_per_currency));
   receipts.Summary("max_managed_positions", IntegerToString(config.max_managed_positions));
   receipts.Summary("max_single_order_lots", DoubleToString(config.max_single_order_lots, 2));
   receipts.Summary("max_close_positions_per_step", IntegerToString(config.max_close_positions_per_step));
   receipts.Summary("news_minimum_impact", IntegerToString(config.news_minimum_impact));
   if(config.enable_qstate_trend_variant)
   {
      receipts.Summary("qstate_variant_id", "g99w-qstate-v001");
      receipts.Summary("qstate_formula_id", LimniQStateFormulaId());
      receipts.Summary("qstate_formula_hash", (string)LimniQStateFormulaHash());
      receipts.Summary("qstate_source_timeframe", "PERIOD_M1_CLOSED_ONLY");
      receipts.Summary("qstate_rolling_window_m1", IntegerToString(LIMNI_QSTATE_V001_ROLLING_WINDOW_M1));
      receipts.Summary("qstate_min_history_m1", IntegerToString(LIMNI_QSTATE_V001_MIN_HISTORY_M1));
      receipts.Summary("qstate_z_clip", DoubleToString(LIMNI_QSTATE_V001_Z_CLIP, 2));
      receipts.Summary("qstate_portfolio_selector", "ranked_currency_balanced_subset");
      receipts.Summary("qstate_scale_lookback_days", IntegerToString(config.qstate_scale_lookback_days));
      receipts.Summary("qstate_fixed_lots", DoubleToString(config.qstate_fixed_lots, 4));
      receipts.Summary("qstate_grid_spacing_q", DoubleToString(config.qstate_grid_spacing_q, 2));
      receipts.Summary("qstate_grid_cap", IntegerToString(config.qstate_grid_cap));
      receipts.Summary("qstate_weak_threshold", DoubleToString(config.qstate_weak_threshold, 2));
      receipts.Summary("qstate_strong_threshold", DoubleToString(config.qstate_strong_threshold, 2));
      receipts.Summary("qstate_max_spread_cost_q", DoubleToString(config.qstate_max_spread_cost_q, 2));
      receipts.Summary("qstate_intent_expiry_minutes", IntegerToString(config.qstate_intent_expiry_minutes));
      receipts.Summary("qstate_reentry_next_day_after_harvest", LP_BoolText(config.qstate_reentry_next_day_after_harvest));
   }
}

#endif // __LIMNI_PORTFOLIO_RUN_MANIFEST_MQH__
