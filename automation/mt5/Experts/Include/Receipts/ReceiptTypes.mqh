/*-----------------------------------------------
  Receipt schema helpers
-----------------------------------------------*/
#ifndef __LIMNI_PORTFOLIO_RECEIPT_TYPES_MQH__
#define __LIMNI_PORTFOLIO_RECEIPT_TYPES_MQH__

#include "..\\Core\\Types.mqh"

string LP_ReceiptKindName(const int kind)
{
   switch(kind)
   {
      case LP_RECEIPT_RUN_START: return "run_start";
      case LP_RECEIPT_SYMBOL_INIT: return "symbol_init";
      case LP_RECEIPT_ENGINE_STEP: return "engine_step";
      case LP_RECEIPT_SIGNAL: return "signal";
      case LP_RECEIPT_INTENT: return "intent";
      case LP_RECEIPT_RISK_DECISION: return "risk_decision";
      case LP_RECEIPT_TRADE_PLAN: return "trade_plan";
      case LP_RECEIPT_ORDER_REQUEST: return "order_request";
      case LP_RECEIPT_ORDER_RESULT: return "order_result";
      case LP_RECEIPT_TRADE_TRANSACTION: return "trade_transaction";
      case LP_RECEIPT_ACCOUNT_GOVERNOR: return "account_governor";
      case LP_RECEIPT_RUN_END: return "run_end";
      case LP_RECEIPT_ERROR: return "error";
      case LP_RECEIPT_POSITION_ATTRIBUTION: return "position_attribution";
      case LP_RECEIPT_HARVEST_STATE: return "harvest_state";
      case LP_RECEIPT_CURRENCY_EXPOSURE: return "currency_exposure";
      case LP_RECEIPT_GRID_INVENTORY: return "grid_inventory";
      case LP_RECEIPT_NEWS_GUARD: return "news_guard";
      case LP_RECEIPT_Q_STATE: return "q_state";
      case LP_RECEIPT_PORTFOLIO_SELECTOR: return "portfolio_selector";
      case LP_RECEIPT_PORTFOLIO_Q_STATE: return "portfolio_q_state";
      case LP_RECEIPT_REVMA_SIGNAL: return "revma_signal";
      case LP_RECEIPT_REVMA_GRID_BIRTH: return "revma_grid_birth";
      case LP_RECEIPT_REVMA_GRID_ADD: return "revma_grid_add";
      case LP_RECEIPT_REVMA_GRID_ADD_SKIP: return "revma_grid_add_skip";
      case LP_RECEIPT_BASIC_SLTP_GUARD: return "basic_sltp_guard";
   }
   return "unknown";
}

#endif // __LIMNI_PORTFOLIO_RECEIPT_TYPES_MQH__
