/*-----------------------------------------------
  Portfolio state snapshot receipt helper
-----------------------------------------------*/
#ifndef __LIMNI_PORTFOLIO_STATE_SNAPSHOT_MQH__
#define __LIMNI_PORTFOLIO_STATE_SNAPSHOT_MQH__

#include "..\\Core\\Types.mqh"
#include "ReceiptWriter.mqh"

void LP_WritePortfolioSummary(LP_ReceiptWriter &receipts, const LP_PortfolioState &state)
{
   receipts.Summary("portfolio_asof", LP_Stamp(state.asof));
   receipts.Summary("balance", DoubleToString(state.balance, 2));
   receipts.Summary("equity", DoubleToString(state.equity, 2));
   receipts.Summary("margin", DoubleToString(state.margin, 2));
   receipts.Summary("free_margin", DoubleToString(state.free_margin, 2));
   receipts.Summary("ea_floating_pnl", DoubleToString(state.ea_floating_pnl, 2));
   receipts.Summary("entry_group_floating_pnl", DoubleToString(state.entry_group_floating_pnl, 2));
   receipts.Summary("grid_group_floating_pnl", DoubleToString(state.grid_group_floating_pnl, 2));
   receipts.Summary("external_floating_pnl", DoubleToString(state.external_floating_pnl, 2));
   receipts.Summary("open_position_count", IntegerToString(state.open_position_count));
   receipts.Summary("managed_position_count", IntegerToString(state.managed_position_count));
   receipts.Summary("entry_group_position_count", IntegerToString(state.entry_group_position_count));
   receipts.Summary("grid_group_position_count", IntegerToString(state.grid_group_position_count));
   receipts.Summary("external_position_count", IntegerToString(state.external_position_count));
   receipts.Summary("unknown_managed_position_count", IntegerToString(state.unknown_managed_position_count));
   receipts.Summary("position_snapshot_hash", (string)state.position_snapshot_hash);
   receipts.Summary("recovery_state", IntegerToString(state.recovery_state));
}

void LP_WritePositionAttribution(LP_ReceiptWriter &receipts, const LP_PortfolioState &state)
{
   receipts.Write(
      LP_RECEIPT_POSITION_ATTRIBUTION,
      "",
      "snapshot",
      "open_positions=" + IntegerToString(state.open_position_count) +
         "|managed_positions=" + IntegerToString(state.managed_position_count) +
         "|entry_positions=" + IntegerToString(state.entry_group_position_count) +
         "|grid_positions=" + IntegerToString(state.grid_group_position_count) +
         "|external_positions=" + IntegerToString(state.external_position_count) +
         "|unknown_managed_positions=" + IntegerToString(state.unknown_managed_position_count) +
         "|managed_pnl=" + DoubleToString(state.ea_floating_pnl, 2) +
         "|entry_pnl=" + DoubleToString(state.entry_group_floating_pnl, 2) +
         "|grid_pnl=" + DoubleToString(state.grid_group_floating_pnl, 2) +
         "|external_pnl=" + DoubleToString(state.external_floating_pnl, 2) +
         "|position_snapshot_hash=" + (string)state.position_snapshot_hash,
      0,
      0,
      0,
      0,
      0,
      0
   );
}

void LP_WriteHarvestState(LP_ReceiptWriter &receipts, const LP_HarvestDecision &decision)
{
   receipts.Write(
      LP_RECEIPT_HARVEST_STATE,
      "",
      LP_HarvestStateName(decision.state),
      "previous_state=" + LP_HarvestStateName(decision.previous_state) +
         "|enabled=" + LP_BoolText(decision.enabled) +
         "|config_valid=" + LP_BoolText(decision.config_valid) +
         "|block_new_entries=" + LP_BoolText(decision.block_new_entries) +
         "|soft_lock=" + LP_BoolText(decision.soft_lock_active) +
         "|grid_winddown=" + LP_BoolText(decision.grid_winddown_active) +
         "|emergency_armed=" + LP_BoolText(decision.emergency_liquidation_armed) +
         "|managed_pnl=" + DoubleToString(decision.managed_floating_pnl, 2) +
         "|entry_pnl=" + DoubleToString(decision.entry_group_floating_pnl, 2) +
         "|grid_pnl=" + DoubleToString(decision.grid_group_floating_pnl, 2) +
         "|hwm=" + DoubleToString(decision.high_watermark_money, 2) +
         "|trail_floor=" + DoubleToString(decision.trail_floor_money, 2) +
         "|target=" + DoubleToString(decision.target_money, 2) +
         "|trail=" + DoubleToString(decision.trail_money, 2) +
         "|reason=" + decision.reason,
      0,
      0,
      0,
      0,
      0,
      0
   );
}

#endif // __LIMNI_PORTFOLIO_STATE_SNAPSHOT_MQH__
