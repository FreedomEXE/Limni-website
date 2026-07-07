/*-----------------------------------------------
  Decision receipt helper
-----------------------------------------------*/
#ifndef __LIMNI_PORTFOLIO_DECISION_LOG_MQH__
#define __LIMNI_PORTFOLIO_DECISION_LOG_MQH__

#include "..\\Core\\Types.mqh"
#include "ReceiptWriter.mqh"

string LP_BasicStopTakeProfitReceiptFields(
   const string basis,
   const double take_profit_distance,
   const double stop_loss_distance
)
{
   if(basis == "" && take_profit_distance <= 0.0 && stop_loss_distance <= 0.0)
      return "";
   return "|basic_sltp_basis=" + (basis == "" ? "none" : basis) +
      "|basic_tp_distance_price=" + DoubleToString(MathMax(0.0, take_profit_distance), 8) +
      "|basic_sl_distance_price=" + DoubleToString(MathMax(0.0, stop_loss_distance), 8);
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
          "|source_bar_time=" + LP_Stamp(intent.source_bar_time) +
          "|expires_at=" + LP_Stamp(intent.expires_at) +
          LP_BasicStopTakeProfitReceiptFields(
             intent.basic_stop_take_profit_basis,
             intent.basic_take_profit_distance_price,
             intent.basic_stop_loss_distance_price
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
         LP_BasicStopTakeProfitReceiptFields(
            plan.basic_stop_take_profit_basis,
            plan.basic_take_profit_distance_price,
            plan.basic_stop_loss_distance_price
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
