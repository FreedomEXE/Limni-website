/*-----------------------------------------------
  TradePlan helpers
-----------------------------------------------*/
#ifndef __LIMNI_PORTFOLIO_TRADE_PLAN_MQH__
#define __LIMNI_PORTFOLIO_TRADE_PLAN_MQH__

#include "..\\Core\\Types.mqh"

void LP_ResetTradePlan(LP_TradePlan &plan)
{
   plan.plan_id = 0;
   plan.decision_id = 0;
   plan.intent_id = 0;
   plan.symbol_id = -1;
   plan.symbol = "";
   plan.lane_id = LP_LANE_NONE;
   plan.variant_id = LP_VARIANT_NONE;
   plan.action = LP_INTENT_NONE;
   plan.direction = LP_SIDE_NONE;
   plan.lots = 0.0;
   plan.max_slippage_points = 0.0;
   plan.take_profit_distance_price = 0.0;
   plan.stop_loss_distance_price = 0.0;
   plan.target_take_profit_price = 0.0;
   plan.target_stop_loss_price = 0.0;
   plan.stop_take_profit_basis = "";
   plan.magic = 0;
   plan.grid_tickets = "";
   plan.expected_grid_ticket_count = 0;
   plan.comment = "";
   plan.reason = "";
   plan.executable = false;
}

#endif // __LIMNI_PORTFOLIO_TRADE_PLAN_MQH__
