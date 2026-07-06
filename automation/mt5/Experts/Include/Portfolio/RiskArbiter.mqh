/*-----------------------------------------------
  Intent -> RiskDecision -> TradePlan boundary
-----------------------------------------------*/
#ifndef __LIMNI_PORTFOLIO_RISK_ARBITER_MQH__
#define __LIMNI_PORTFOLIO_RISK_ARBITER_MQH__

#include "..\\Core\\Types.mqh"
#include "..\\Core\\SymbolUniverse.mqh"
#include "..\\Execution\\MagicCodec.mqh"
#include "..\\Execution\\TradePlan.mqh"
#include "..\\Receipts\\ReceiptWriter.mqh"
#include "CurrencyExposureGuard.mqh"

class LP_RiskArbiter
{
private:
   ulong m_next_decision_id;
   ulong m_next_plan_id;

   bool IsOpenAction(const int action)
   {
      return action == LP_INTENT_OPEN_GRID || action == LP_INTENT_ADD_GRID_LEG;
   }

   bool IsReduceAction(const int action)
   {
      return action == LP_INTENT_REDUCE_GRID;
   }

   bool IsCloseAction(const int action)
   {
      return action == LP_INTENT_CLOSE_GRID || action == LP_INTENT_CLOSE_ALL_EA;
   }

   bool IsKnownAction(const int action)
   {
      return IsOpenAction(action) || IsReduceAction(action) || IsCloseAction(action);
   }

   bool SymbolTradable(const string symbol)
   {
      if(StringLen(symbol) <= 0)
         return false;
      if(!SymbolInfoInteger(symbol, SYMBOL_EXIST))
         return false;
      int trade_mode = (int)SymbolInfoInteger(symbol, SYMBOL_TRADE_MODE);
      return trade_mode != SYMBOL_TRADE_MODE_DISABLED;
   }

   int GridFamilyForIntent(const LP_TradeIntent &intent)
   {
      if(intent.grid_key > 0)
      {
         int family = (int)(intent.grid_key % 10000);
         if(family > 0)
            return family;
      }
      if(IsOpenAction(intent.action))
         return (int)(intent.intent_id % 9000) + 1;
      return 0;
   }

   bool ValidateIntent(const LP_TradeIntent &intent, string &reason)
   {
      reason = "";
      if(!IsKnownAction(intent.action))
      {
         reason = "unknown_action";
         return false;
      }

      if(intent.action != LP_INTENT_CLOSE_ALL_EA)
      {
         if(intent.symbol_id < 0 || intent.symbol_id >= LP_SYMBOL_COUNT || StringLen(intent.symbol) <= 0)
         {
            reason = "symbol_missing";
            return false;
         }
         if(!SymbolTradable(intent.symbol))
         {
            reason = "symbol_not_tradable";
            return false;
         }
      }

      if(IsOpenAction(intent.action))
      {
         if(intent.direction == LP_SIDE_NONE || intent.requested_lots <= 0.0)
         {
            reason = "open_intent_missing_direction_or_lots";
            return false;
         }
      }

      if(IsReduceAction(intent.action))
      {
         if(intent.direction == LP_SIDE_NONE || intent.requested_lots <= 0.0 || intent.grid_key <= 0)
         {
            reason = "reduce_intent_missing_direction_lots_or_grid";
            return false;
         }
      }

      if(intent.action == LP_INTENT_CLOSE_GRID)
      {
         if(intent.direction == LP_SIDE_NONE || intent.grid_key <= 0)
         {
            reason = "close_grid_missing_direction_or_grid";
            return false;
         }
      }

      if(intent.expires_at > 0 && TimeCurrent() > intent.expires_at)
      {
         reason = "intent_expired";
         return false;
      }

      return true;
   }

   void BuildPlanFromIntent(const LP_TradeIntent &intent, const ulong decision_id, LP_TradePlan &plan)
   {
      plan.plan_id = m_next_plan_id++;
      plan.decision_id = decision_id;
      plan.intent_id = intent.intent_id;
      plan.symbol_id = intent.symbol_id;
      plan.symbol = intent.symbol;
      plan.lane_id = intent.lane_id;
      plan.variant_id = intent.variant_id;
      plan.action = intent.action;
      plan.direction = intent.direction;
      plan.lots = intent.requested_lots;
      plan.max_slippage_points = intent.max_slippage_points;
      plan.reason = intent.human_reason;
      plan.executable = true;

      int grid_family = GridFamilyForIntent(intent);
      if(intent.action == LP_INTENT_CLOSE_ALL_EA)
      {
         plan.magic = 0;
         plan.comment = "LMN1|ACCOUNT|CLOSE_ALL|C" + StringSubstr((string)intent.config_hash, 0, 6);
      }
      else
      {
         plan.magic = LP_BuildMagic(intent.symbol_id, intent.lane_id, intent.variant_id, intent.direction, grid_family);
         plan.comment = LP_BuildComment(LP_CanonicalSymbol(intent.symbol_id), intent.lane_id, intent.variant_id, intent.direction, intent.config_hash);
      }
   }

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
      plan.decision_id = decision.decision_id;
      plan.intent_id = intent.intent_id;

      string invalid_reason = "";
      if(!ValidateIntent(intent, invalid_reason))
      {
         decision.decision = LP_RISK_REJECT;
         decision.reason = invalid_reason == "symbol_not_tradable" ? LP_RISK_REASON_SYMBOL_NOT_TRADABLE : LP_RISK_REASON_INVALID_INTENT;
         decision.explanation = invalid_reason;
         return false;
      }

      if(portfolio.recovery_state != LP_RECOVERY_OK && IsOpenAction(intent.action))
      {
         decision.decision = LP_RISK_REJECT;
         decision.reason = LP_RISK_REASON_RECOVERY_LOCKED;
         decision.explanation = "recovery_locked";
         return false;
      }

      string guard_reason = "";
      if(IsOpenAction(intent.action) && !currency_guard.AllowsCandidate(intent, guard_reason))
      {
         decision.decision = LP_RISK_REJECT;
         decision.reason = LP_RISK_REASON_CURRENCY_EXPOSURE;
         decision.explanation = guard_reason;
         return false;
      }

      decision.decision = LP_RISK_APPROVE;
      decision.reason = LP_RISK_REASON_NONE;
      decision.approved_lots = intent.requested_lots;
      decision.rejected_lots = 0.0;
      decision.allow_new_order = IsOpenAction(intent.action);
      decision.allow_reduce = IsReduceAction(intent.action);
      decision.allow_close = IsCloseAction(intent.action);
      decision.explanation = "approved_strategy_agnostic_plan";

      BuildPlanFromIntent(intent, decision.decision_id, plan);
      return true;
   }
};

#endif // __LIMNI_PORTFOLIO_RISK_ARBITER_MQH__
