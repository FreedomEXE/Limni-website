/*-----------------------------------------------
  Decision receipt helper
-----------------------------------------------*/
#ifndef __LIMNI_PORTFOLIO_DECISION_LOG_MQH__
#define __LIMNI_PORTFOLIO_DECISION_LOG_MQH__

#include "..\\Core\\Types.mqh"
#include "ReceiptWriter.mqh"

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

#endif // __LIMNI_PORTFOLIO_DECISION_LOG_MQH__
