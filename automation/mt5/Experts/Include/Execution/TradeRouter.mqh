/*-----------------------------------------------
  The only module allowed to include Trade/Trade.mqh
-----------------------------------------------*/
#ifndef __LIMNI_PORTFOLIO_TRADE_ROUTER_MQH__
#define __LIMNI_PORTFOLIO_TRADE_ROUTER_MQH__

#include <Trade/Trade.mqh>
#include "..\\Core\\Types.mqh"
#include "..\\Receipts\\ReceiptWriter.mqh"
#include "RetcodeClassifier.mqh"

class LP_TradeRouter
{
private:
   CTrade m_trade;
   LP_Config m_config;
   bool m_ready;

public:
   void Reset()
   {
      m_ready = false;
   }

   void Configure(const LP_Config &config)
   {
      m_config = config;
      m_ready = true;
   }

   bool CanPlaceOrders(string &reason)
   {
      reason = "";
      if(!m_ready)
      {
         reason = "router_not_ready";
         return false;
      }

      if(!m_config.enable_trading || m_config.execution_mode == LP_EXECUTION_DISABLED)
      {
         reason = "execution_disabled";
         return false;
      }

      bool is_tester = (bool)MQLInfoInteger(MQL_TESTER) || (bool)MQLInfoInteger(MQL_OPTIMIZATION);
      if(is_tester)
         return m_config.execution_mode == LP_EXECUTION_TESTER_ONLY || m_config.execution_mode == LP_EXECUTION_LIVE_ALLOWED || m_config.execution_mode == LP_EXECUTION_DRY_RUN;

      if(m_config.execution_mode != LP_EXECUTION_LIVE_ALLOWED || !m_config.allow_live_trading)
      {
         reason = "live_trading_not_authorized";
         return false;
      }

      if(!MQLInfoInteger(MQL_TRADE_ALLOWED) || !TerminalInfoInteger(TERMINAL_TRADE_ALLOWED))
      {
         reason = "terminal_trade_not_allowed";
         return false;
      }

      return true;
   }

   bool Execute(const LP_TradePlan &plan, LP_ReceiptWriter &receipts)
   {
      string barrier_reason = "";
      bool can_place = CanPlaceOrders(barrier_reason);
      if(!can_place || m_config.execution_mode == LP_EXECUTION_DRY_RUN)
      {
         receipts.Write(
            LP_RECEIPT_ORDER_REQUEST,
            plan.symbol,
            "dry_or_blocked",
            "plan_id=" + (string)plan.plan_id + "|reason=" + (barrier_reason == "" ? "dry_run" : barrier_reason),
            plan.lane_id,
            plan.variant_id,
            0,
            plan.intent_id,
            plan.decision_id,
            plan.magic
         );
         return false;
      }

      // Gate 99N produces no executable plans. Future gates add order building here.
      receipts.Write(
         LP_RECEIPT_ORDER_REQUEST,
         plan.symbol,
         "not_implemented_gate99n",
         "plan_id=" + (string)plan.plan_id,
         plan.lane_id,
         plan.variant_id,
         0,
         plan.intent_id,
         plan.decision_id,
         plan.magic
      );
      return false;
   }
};

#endif // __LIMNI_PORTFOLIO_TRADE_ROUTER_MQH__
