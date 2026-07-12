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

   bool IsProtectionModifyAction(const int action)
   {
      return action == LP_INTENT_SYNC_GRID_TP;
   }

   bool IsKnownAction(const int action)
   {
      return IsOpenAction(action) || IsReduceAction(action) || IsCloseAction(action) || IsProtectionModifyAction(action);
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

   bool ValidateIntent(
      const LP_TradeIntent &intent,
      ulong &resolved_grid_key,
      int &resolved_grid_family,
      string &reason
   )
   {
      resolved_grid_key = 0;
      resolved_grid_family = 0;
      reason = "";
      if(!IsKnownAction(intent.action))
      {
         reason = "unknown_action";
         return false;
      }

      if(intent.action != LP_INTENT_CLOSE_ALL_EA)
      {
         if(!LP_IsSupportedMagicLaneVariant(intent.lane_id, intent.variant_id) ||
            (intent.direction != LP_SIDE_LONG && intent.direction != LP_SIDE_SHORT))
         {
            reason = "unsupported_managed_lane_variant_or_direction";
            return false;
         }
         if(intent.symbol_id < 0 || intent.symbol_id >= LP_SYMBOL_COUNT || StringLen(intent.symbol) <= 0)
         {
            reason = "symbol_missing";
            return false;
         }
         if(LP_SymbolIdFromBrokerSymbol(intent.symbol) != intent.symbol_id)
         {
            reason = "intent_symbol_identity_mismatch";
            return false;
         }
         if(!SymbolTradable(intent.symbol))
         {
            reason = "symbol_not_tradable";
            return false;
         }
      }

      string grid_identity_reason = "";
      if(!LP_ResolveIntentGridIdentity(
            intent,
            resolved_grid_key,
            resolved_grid_family,
            grid_identity_reason
         ))
      {
         reason = grid_identity_reason;
         return false;
      }

      if(IsOpenAction(intent.action))
      {
         if(intent.direction == LP_SIDE_NONE || intent.requested_lots <= 0.0)
         {
            reason = "open_intent_missing_direction_or_lots";
            return false;
         }
         if(intent.action == LP_INTENT_ADD_GRID_LEG && intent.grid_key <= 0)
         {
            reason = "add_grid_missing_grid";
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

      if(intent.action == LP_INTENT_SYNC_GRID_TP)
      {
         if(intent.direction == LP_SIDE_NONE || intent.grid_key <= 0 || intent.target_take_profit_price <= 0.0)
         {
            reason = "grid_tp_sync_missing_direction_grid_or_target";
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

   void BuildPlanFromIntent(
      const LP_TradeIntent &intent,
      const ulong decision_id,
      const ulong resolved_grid_key,
      const int resolved_grid_family,
      LP_TradePlan &plan
   )
   {
      plan.plan_id = m_next_plan_id++;
      plan.gate108 = intent.gate108;
      plan.discovery_branch = intent.discovery_branch;
      plan.discovery_branch_grid_id = intent.discovery_branch_grid_id;
      plan.discovery_candidate_identity =
         intent.discovery_candidate_identity;
      plan.discovery_shared_snapshot_hash =
         intent.discovery_shared_snapshot_hash;
      plan.discovery_matched_snapshot_hash =
         intent.discovery_matched_snapshot_hash;
      plan.discovery_pre_candidate_state_hash =
         intent.discovery_pre_candidate_state_hash;
      plan.discovery_source_m1_time = intent.discovery_source_m1_time;
      plan.discovery_close_owner = intent.discovery_close_owner;
      plan.discovery_origin_terminal_reason =
         intent.discovery_origin_terminal_reason;
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
      plan.take_profit_distance_price = intent.take_profit_distance_price;
      plan.stop_loss_distance_price = intent.stop_loss_distance_price;
      plan.target_take_profit_price = intent.target_take_profit_price;
      plan.target_stop_loss_price = intent.target_stop_loss_price;
      plan.stop_take_profit_basis = intent.stop_take_profit_basis;
      plan.grid_key = resolved_grid_key;
      plan.grid_tickets = intent.grid_tickets;
      plan.expected_grid_ticket_count = intent.expected_grid_ticket_count;
      plan.research_lifecycle_event = intent.research_lifecycle_event;
      plan.research_add_type = intent.research_add_type;
      plan.close_reason = intent.close_reason;
      plan.reason = intent.human_reason;
      plan.executable = true;
      plan.execution_contract = intent.execution_contract;

      if(intent.action == LP_INTENT_CLOSE_ALL_EA)
      {
         plan.magic = 0;
         plan.comment = "Limni Close All C" + StringSubstr((string)intent.config_hash, 0, 6);
      }
      else
      {
         plan.magic = LP_BuildMagic(intent.symbol_id, intent.lane_id, intent.variant_id, intent.direction, resolved_grid_family);
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
      ulong resolved_grid_key = 0;
      int resolved_grid_family = 0;
      if(!ValidateIntent(
            intent,
            resolved_grid_key,
            resolved_grid_family,
            invalid_reason
         ))
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
      if(IsOpenAction(intent.action) &&
         !currency_guard.ReserveCandidate(intent, resolved_grid_key, guard_reason))
      {
         decision.decision = LP_RISK_REJECT;
         decision.reason = LP_RISK_REASON_CURRENCY_EXPOSURE;
         decision.explanation = "risk_reservation_status=rejected_by_reservation" +
            "|reservation_reason=" + guard_reason;
         return false;
      }

      decision.decision = LP_RISK_APPROVE;
      decision.reason = LP_RISK_REASON_NONE;
      decision.approved_lots = intent.requested_lots;
      decision.rejected_lots = 0.0;
      decision.allow_new_order = IsOpenAction(intent.action);
      decision.allow_reduce = IsReduceAction(intent.action);
      decision.allow_close = IsCloseAction(intent.action);
      BuildPlanFromIntent(
         intent,
         decision.decision_id,
         resolved_grid_key,
         resolved_grid_family,
         plan
      );
      if(IsOpenAction(intent.action))
      {
         plan.reservation_status = StringFind(guard_reason, "currency_guard_reserved") == 0 ?
            "approved_reserved" : "not_required_guard_disabled";
         plan.reservation_reason = guard_reason;
         decision.explanation = "approved_strategy_agnostic_plan" +
            "|risk_reservation_status=" + plan.reservation_status +
            "|reservation_reason=" + guard_reason;
      }
      else
      {
         plan.reservation_status = "not_applicable";
         plan.reservation_reason = "action_not_open_or_add";
         decision.explanation = "approved_strategy_agnostic_plan" +
            "|risk_reservation_status=not_applicable";
      }
      return true;
   }
};

#endif // __LIMNI_PORTFOLIO_RISK_ARBITER_MQH__
