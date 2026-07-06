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
   receipts.Summary("open_position_count", IntegerToString(state.open_position_count));
   receipts.Summary("managed_position_count", IntegerToString(state.managed_position_count));
   receipts.Summary("recovery_state", IntegerToString(state.recovery_state));
}

#endif // __LIMNI_PORTFOLIO_STATE_SNAPSHOT_MQH__
