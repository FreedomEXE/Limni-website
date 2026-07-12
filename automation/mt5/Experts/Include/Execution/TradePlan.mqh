/*-----------------------------------------------
  TradePlan helpers
-----------------------------------------------*/
#ifndef __LIMNI_PORTFOLIO_TRADE_PLAN_MQH__
#define __LIMNI_PORTFOLIO_TRADE_PLAN_MQH__

#include "..\\Core\\Types.mqh"

void LP_ResetTradePlan(LP_TradePlan &plan)
{
   plan.gate108 = false;
   plan.discovery_branch = -1;
   plan.discovery_branch_grid_id = 0;
   plan.discovery_candidate_identity = 0;
   plan.discovery_shared_snapshot_hash = 0;
   plan.discovery_matched_snapshot_hash = 0;
   plan.discovery_pre_candidate_state_hash = 0;
   plan.discovery_source_m1_time = 0;
   plan.discovery_close_owner = 0;
   plan.discovery_origin_terminal_reason = "";
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
   plan.grid_key = 0;
   plan.grid_tickets = "";
   plan.expected_grid_ticket_count = 0;
   plan.research_lifecycle_event = LP_RESEARCH_LIFECYCLE_NONE;
   plan.research_add_type = "";
   plan.close_reason = "";
   plan.reservation_status = "not_applicable";
   plan.reservation_reason = "";
   plan.comment = "";
   plan.reason = "";
   plan.executable = false;
   LP_ResetExecutionContract(plan.execution_contract);
}

#endif // __LIMNI_PORTFOLIO_TRADE_PLAN_MQH__
