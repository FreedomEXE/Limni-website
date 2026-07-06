/*-----------------------------------------------
  The only module allowed to include Trade/Trade.mqh
-----------------------------------------------*/
#ifndef __LIMNI_PORTFOLIO_TRADE_ROUTER_MQH__
#define __LIMNI_PORTFOLIO_TRADE_ROUTER_MQH__

#include <Trade/Trade.mqh>
#include "..\\Core\\Types.mqh"
#include "..\\Receipts\\ReceiptWriter.mqh"
#include "MagicCodec.mqh"
#include "RetcodeClassifier.mqh"

class LP_TradeRouter
{
private:
   CTrade m_trade;
   LP_Config m_config;
   bool m_ready;

   bool IsOpenAction(const int action)
   {
      return action == LP_INTENT_OPEN_GRID || action == LP_INTENT_ADD_GRID_LEG;
   }

   bool IsCloseAction(const int action)
   {
      return action == LP_INTENT_CLOSE_GRID ||
         action == LP_INTENT_CLOSE_ALL_EA ||
         action == LP_INTENT_REDUCE_GRID;
   }

   int VolumePrecision(const double step)
   {
      double scaled = step;
      for(int precision = 0; precision <= 8; precision++)
      {
         if(MathAbs(scaled - MathRound(scaled)) < 0.00000001)
            return precision;
         scaled *= 10.0;
      }
      return 8;
   }

   bool NormalizeLots(const string symbol, const double requested_lots, double &normalized_lots, string &reason)
   {
      normalized_lots = 0.0;
      reason = "";
      if(requested_lots <= 0.0)
      {
         reason = "invalid_lots";
         return false;
      }

      double min_lot = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MIN);
      double max_lot = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MAX);
      double step = SymbolInfoDouble(symbol, SYMBOL_VOLUME_STEP);
      if(min_lot <= 0.0 || max_lot <= 0.0 || step <= 0.0)
      {
         reason = "symbol_volume_spec_invalid";
         return false;
      }

      if(m_config.max_single_order_lots > 0.0 && requested_lots > m_config.max_single_order_lots)
      {
         reason = "max_single_order_lots";
         return false;
      }

      if(requested_lots < min_lot || requested_lots > max_lot)
      {
         reason = "symbol_lot_range";
         return false;
      }

      double steps = MathFloor((requested_lots - min_lot) / step + 0.00000001);
      normalized_lots = min_lot + steps * step;
      normalized_lots = NormalizeDouble(normalized_lots, VolumePrecision(step));
      if(normalized_lots < min_lot || normalized_lots <= 0.0)
      {
         reason = "normalized_lots_invalid";
         return false;
      }
      return true;
   }

   void WriteOrderRequest(
      LP_ReceiptWriter &receipts,
      const LP_TradePlan &plan,
      const string status,
      const string message
   )
   {
      receipts.Write(
         LP_RECEIPT_ORDER_REQUEST,
         plan.symbol,
         status,
         "plan_id=" + (string)plan.plan_id +
            "|action=" + IntegerToString(plan.action) +
            "|direction=" + IntegerToString(plan.direction) +
            "|lots=" + DoubleToString(plan.lots, 2) +
            "|" + message,
         plan.lane_id,
         plan.variant_id,
         0,
         plan.intent_id,
         plan.decision_id,
         plan.magic
      );
   }

   void WriteOrderResult(
      LP_ReceiptWriter &receipts,
      const LP_TradePlan &plan,
      const bool ok,
      const double normalized_lots,
      const string result_symbol
   )
   {
      uint retcode = m_trade.ResultRetcode();
      int digits = 5;
      if(StringLen(result_symbol) > 0 && SymbolInfoInteger(result_symbol, SYMBOL_EXIST))
         digits = (int)SymbolInfoInteger(result_symbol, SYMBOL_DIGITS);
      receipts.Write(
         LP_RECEIPT_ORDER_RESULT,
         result_symbol,
         ok ? "sent" : "failed",
         "plan_id=" + (string)plan.plan_id +
            "|ok=" + LP_BoolText(ok) +
            "|retcode=" + IntegerToString((int)retcode) +
            "|retcode_name=" + LP_RetcodeName(retcode) +
            "|order=" + (string)m_trade.ResultOrder() +
            "|deal=" + (string)m_trade.ResultDeal() +
            "|volume=" + DoubleToString(normalized_lots, 2) +
            "|price=" + DoubleToString(m_trade.ResultPrice(), digits),
         plan.lane_id,
         plan.variant_id,
         0,
         plan.intent_id,
         plan.decision_id,
         plan.magic
      );
   }

   bool CloseTicket(
      const ulong ticket,
      const LP_TradePlan &plan,
      LP_ReceiptWriter &receipts,
      double &remaining_lots
   )
   {
      if(!PositionSelectByTicket(ticket))
         return false;

      string symbol = PositionGetString(POSITION_SYMBOL);
      double position_lots = PositionGetDouble(POSITION_VOLUME);
      double close_lots = position_lots;
      bool partial = plan.action == LP_INTENT_REDUCE_GRID;
      if(partial)
      {
         if(remaining_lots <= 0.0)
            return false;
         close_lots = MathMin(position_lots, remaining_lots);
      }

      WriteOrderRequest(
         receipts,
         plan,
         partial ? "reduce_request" : "close_request",
         "ticket=" + (string)ticket +
            "|position_lots=" + DoubleToString(position_lots, 2) +
            "|close_lots=" + DoubleToString(close_lots, 2)
      );

      bool ok = false;
      if(partial && close_lots < position_lots)
         ok = m_trade.PositionClosePartial(ticket, close_lots, (ulong)MathMax(0, (int)MathRound(plan.max_slippage_points)));
      else
         ok = m_trade.PositionClose(ticket, (ulong)MathMax(0, (int)MathRound(plan.max_slippage_points)));

      if(ok && partial)
         remaining_lots -= close_lots;

      WriteOrderResult(receipts, plan, ok, close_lots, symbol);
      return ok;
   }

   bool CloseMatchingPositions(const LP_TradePlan &plan, LP_ReceiptWriter &receipts)
   {
      if(!m_config.enable_close_execution)
      {
         WriteOrderRequest(receipts, plan, "close_execution_disabled", "reason=close_execution_disabled");
         return false;
      }

      if(plan.action == LP_INTENT_CLOSE_ALL_EA && !m_config.enable_account_close_execution)
      {
         WriteOrderRequest(receipts, plan, "account_close_execution_disabled", "reason=account_close_execution_disabled");
         return false;
      }

      if(m_config.max_close_positions_per_step <= 0)
      {
         WriteOrderRequest(receipts, plan, "close_limit_invalid", "reason=max_close_positions_per_step_invalid");
         return false;
      }

      string barrier_reason = "";
      bool can_place = CanPlaceOrders(barrier_reason);
      if(!can_place || m_config.execution_mode == LP_EXECUTION_DRY_RUN)
      {
         WriteOrderRequest(receipts, plan, "close_dry_or_blocked", "reason=" + (barrier_reason == "" ? "dry_run" : barrier_reason));
         return false;
      }

      m_trade.SetExpertMagicNumber(plan.magic);
      m_trade.SetDeviationInPoints((ulong)MathMax(0, (int)MathRound(plan.max_slippage_points)));

      int attempted = 0;
      int closed = 0;
      double remaining_lots = plan.lots;
      bool reduce_done = false;

      for(int i = PositionsTotal() - 1; i >= 0; i--)
      {
         ulong ticket = PositionGetTicket(i);
         if(ticket == 0)
            continue;
         if(!PositionSelectByTicket(ticket))
            continue;

         long magic = (long)PositionGetInteger(POSITION_MAGIC);
         if(!LP_IsManagedMagic(magic))
            continue;

         if(plan.action != LP_INTENT_CLOSE_ALL_EA)
         {
            if(magic != plan.magic)
               continue;
            if(StringLen(plan.symbol) > 0 && PositionGetString(POSITION_SYMBOL) != plan.symbol)
               continue;
         }

         if(attempted >= m_config.max_close_positions_per_step)
            break;

         attempted++;
         if(CloseTicket(ticket, plan, receipts, remaining_lots))
            closed++;

         if(plan.action == LP_INTENT_REDUCE_GRID && remaining_lots <= 0.0)
         {
            reduce_done = true;
            break;
         }
      }

      WriteOrderRequest(
         receipts,
         plan,
         "close_scan_complete",
         "attempted=" + IntegerToString(attempted) +
            "|closed=" + IntegerToString(closed) +
            "|remaining_lots=" + DoubleToString(MathMax(0.0, remaining_lots), 2) +
            "|reduce_done=" + LP_BoolText(reduce_done)
      );
      return closed > 0;
   }

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
      if(IsCloseAction(plan.action))
         return CloseMatchingPositions(plan, receipts);

      if(!IsOpenAction(plan.action))
      {
         WriteOrderRequest(receipts, plan, "unsupported_action", "reason=unsupported_action");
         return false;
      }

      double normalized_lots = 0.0;
      string lot_reason = "";
      if(!NormalizeLots(plan.symbol, plan.lots, normalized_lots, lot_reason))
      {
         WriteOrderRequest(receipts, plan, "lot_rejected", "reason=" + lot_reason);
         return false;
      }

      string barrier_reason = "";
      bool can_place = CanPlaceOrders(barrier_reason);
      if(!m_config.enable_open_order_routing)
      {
         WriteOrderRequest(receipts, plan, "open_routing_disabled", "reason=open_order_routing_disabled");
         return false;
      }

      if(!can_place || m_config.execution_mode == LP_EXECUTION_DRY_RUN)
      {
         WriteOrderRequest(receipts, plan, "dry_or_blocked", "reason=" + (barrier_reason == "" ? "dry_run" : barrier_reason));
         return false;
      }

      m_trade.SetExpertMagicNumber(plan.magic);
      m_trade.SetDeviationInPoints((ulong)MathMax(0, (int)MathRound(plan.max_slippage_points)));
      bool ok = false;
      if(plan.direction > 0)
         ok = m_trade.Buy(normalized_lots, plan.symbol, 0.0, 0.0, 0.0, plan.comment);
      else if(plan.direction < 0)
         ok = m_trade.Sell(normalized_lots, plan.symbol, 0.0, 0.0, 0.0, plan.comment);
      else
      {
         WriteOrderRequest(receipts, plan, "direction_rejected", "reason=invalid_direction");
         return false;
      }

      WriteOrderResult(receipts, plan, ok, normalized_lots, plan.symbol);
      return ok;
   }
};

#endif // __LIMNI_PORTFOLIO_TRADE_ROUTER_MQH__
