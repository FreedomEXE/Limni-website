/*-----------------------------------------------
  Intent -> RiskDecision -> TradePlan boundary
-----------------------------------------------*/
#ifndef __LIMNI_PORTFOLIO_RISK_ARBITER_MQH__
#define __LIMNI_PORTFOLIO_RISK_ARBITER_MQH__

#include "..\\Core\\Types.mqh"
#include "..\\Execution\\MagicCodec.mqh"
#include "..\\Execution\\TradePlan.mqh"
#include "..\\Receipts\\ReceiptWriter.mqh"
#include "CurrencyExposureGuard.mqh"

class LP_RiskArbiter
{
private:
   ulong m_next_decision_id;
   ulong m_next_plan_id;

public:
   void Reset()
   {
      m_next_decision_id = 1;
      m_next_plan_id = 1;
   }

   bool Decide(
      const LP_TradeIntent &intent,
      const LP_PortfolioState &portfolio,
      LP_CurrencyExposureGuard &currency_guard,
      LP_RiskDecision &decision,
      LP_TradePlan &plan
   )
   {
      decision.decision_id = m_next_decision_id++;
      decision.intent_id = intent.intent_id;
      decision.decided_at = TimeCurrent();
      decision.portfolio_snapshot_hash = portfolio.position_snapshot_hash;
      decision.config_hash = portfolio.config_hash;
      decision.approved_lots = 0.0;
      decision.rejected_lots = intent.requested_lots;
      decision.allow_new_order = false;
      decision.allow_reduce = false;
      decision.allow_close = false;

      LP_ResetTradePlan(plan);
      plan.plan_id = m_next_plan_id++;
      plan.decision_id = decision.decision_id;
      plan.intent_id = intent.intent_id;

      if(portfolio.recovery_state != LP_RECOVERY_OK)
      {
         decision.decision = LP_RISK_REJECT;
         decision.reason = LP_RISK_REASON_RECOVERY_LOCKED;
         decision.explanation = "recovery_locked";
         return false;
      }

      string guard_reason = "";
      if(!currency_guard.AllowsCandidate(intent, guard_reason))
      {
         decision.decision = LP_RISK_REJECT;
         decision.reason = LP_RISK_REASON_CURRENCY_EXPOSURE;
         decision.explanation = guard_reason;
         return false;
      }

      decision.decision = LP_RISK_REJECT;
      decision.reason = LP_RISK_REASON_NO_STRATEGY;
      decision.explanation = "gate99s_no_strategy_lane_approved";
      return false;
   }
};

#endif // __LIMNI_PORTFOLIO_RISK_ARBITER_MQH__
