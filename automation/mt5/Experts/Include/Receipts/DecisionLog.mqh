/*-----------------------------------------------
  Decision receipt helper
-----------------------------------------------*/
#ifndef __LIMNI_PORTFOLIO_DECISION_LOG_MQH__
#define __LIMNI_PORTFOLIO_DECISION_LOG_MQH__

#include "..\\Core\\Types.mqh"
#include "ReceiptWriter.mqh"

string LP_StopTakeProfitReceiptFields(
   const string basis,
   const double take_profit_distance,
   const double stop_loss_distance,
   const double target_take_profit_price,
   const double target_stop_loss_price
)
{
   if(basis == "" &&
      take_profit_distance <= 0.0 &&
      stop_loss_distance <= 0.0 &&
      target_take_profit_price <= 0.0 &&
      target_stop_loss_price <= 0.0)
      return "";
   return "|sltp_basis=" + (basis == "" ? "none" : basis) +
      "|take_profit_distance_price=" + DoubleToString(MathMax(0.0, take_profit_distance), 8) +
      "|stop_loss_distance_price=" + DoubleToString(MathMax(0.0, stop_loss_distance), 8) +
      "|target_take_profit_price=" + DoubleToString(MathMax(0.0, target_take_profit_price), 8) +
      "|target_stop_loss_price=" + DoubleToString(MathMax(0.0, target_stop_loss_price), 8);
}

void LP_LogTradeIntent(LP_ReceiptWriter &receipts, const LP_TradeIntent &intent)
{
   receipts.Write(
      LP_RECEIPT_INTENT,
      intent.symbol,
      "intent",
      "action=" + IntegerToString(intent.action) +
         "|direction=" + IntegerToString(intent.direction) +
         "|lots=" + DoubleToString(intent.requested_lots, 4) +
          "|score=" + DoubleToString(intent.score, 6) +
          "|grid_key=" + (string)intent.grid_key +
          "|research_lifecycle_event=" + LP_ResearchLifecycleEventName(intent.research_lifecycle_event) +
          "|research_add_type=" + intent.research_add_type +
          "|close_reason=" + intent.close_reason +
          "|source_bar_time=" + LP_Stamp(intent.source_bar_time) +
          "|expires_at=" + LP_Stamp(intent.expires_at) +
          LP_StopTakeProfitReceiptFields(
             intent.stop_take_profit_basis,
             intent.take_profit_distance_price,
             intent.stop_loss_distance_price,
             intent.target_take_profit_price,
             intent.target_stop_loss_price
          ) +
          "|reason=" + intent.human_reason,
      intent.lane_id,
      intent.variant_id,
      intent.grid_key,
      intent.intent_id,
      0,
      0
   );
}

void LP_LogRiskDecision(LP_ReceiptWriter &receipts, const LP_RiskDecision &decision)
{
   receipts.Write(
      LP_RECEIPT_RISK_DECISION,
      "",
      "decision",
      "decision=" + IntegerToString(decision.decision) +
         "|reason=" + IntegerToString(decision.reason) +
         "|approved_lots=" + DoubleToString(decision.approved_lots, 2) +
         "|explanation=" + decision.explanation,
      0,
      0,
      0,
      decision.intent_id,
      decision.decision_id,
      0
   );
}

void LP_LogTradePlan(LP_ReceiptWriter &receipts, const LP_TradePlan &plan)
{
   receipts.Write(
      LP_RECEIPT_TRADE_PLAN,
      plan.symbol,
      plan.executable ? "plan_executable" : "plan_not_executable",
      "plan_id=" + (string)plan.plan_id +
         "|action=" + IntegerToString(plan.action) +
         "|direction=" + IntegerToString(plan.direction) +
          "|lots=" + DoubleToString(plan.lots, 4) +
          "|research_lifecycle_event=" + LP_ResearchLifecycleEventName(plan.research_lifecycle_event) +
          "|research_add_type=" + plan.research_add_type +
          "|close_reason=" + plan.close_reason +
         LP_StopTakeProfitReceiptFields(
            plan.stop_take_profit_basis,
            plan.take_profit_distance_price,
            plan.stop_loss_distance_price,
            plan.target_take_profit_price,
            plan.target_stop_loss_price
         ) +
         "|reason=" + plan.reason +
         "|comment=" + plan.comment,
      plan.lane_id,
      plan.variant_id,
      0,
      plan.intent_id,
      plan.decision_id,
      plan.magic
   );
}

#endif // __LIMNI_PORTFOLIO_DECISION_LOG_MQH__
