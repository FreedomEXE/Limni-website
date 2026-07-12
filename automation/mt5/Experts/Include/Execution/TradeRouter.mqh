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
#include "TradeSessionAdmission.mqh"

class LP_TradeRouter
{
private:
   CTrade m_trade;
   LP_Config m_config;
   bool m_ready;
   ulong m_broker_tp_sync_ticket_scans;
   ulong m_broker_tp_modify_attempts;
   ulong m_order_open_attempts;
   ulong m_order_close_attempts;
   LP_BrokerExecutionIntegrity m_execution_integrity;

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

   bool IsProtectionModifyAction(const int action)
   {
      return action == LP_INTENT_SYNC_GRID_TP;
   }

   bool IsExecutedFillRetcode(const uint retcode)
   {
      return retcode == TRADE_RETCODE_DONE || retcode == TRADE_RETCODE_DONE_PARTIAL;
   }

   void ObserveSessionAdmissionBlock(
      const int action,
      const datetime server_now,
      const bool metadata_unavailable
   )
   {
      if(IsOpenAction(action))
         m_execution_integrity.session_blocked_open_count++;
      else if(IsCloseAction(action))
         m_execution_integrity.session_deferred_close_count++;
      else if(IsProtectionModifyAction(action))
         m_execution_integrity.session_blocked_modify_count++;
      if(metadata_unavailable)
         m_execution_integrity.session_metadata_failure_count++;
      if(m_execution_integrity.first_session_block_time <= 0)
         m_execution_integrity.first_session_block_time = server_now;
      m_execution_integrity.last_session_block_time = server_now;
   }

   void BindPlanToPosition(
      const LP_TradePlan &plan,
      const string position_symbol,
      const long position_magic,
      LP_TradePlan &position_plan
   )
   {
      position_plan = plan;
      position_plan.symbol = position_symbol;
      position_plan.magic = position_magic;
      LP_MagicParts parts;
      if(LP_DecodeMagic(position_magic, parts))
      {
         position_plan.symbol_id = parts.symbol_id;
         position_plan.lane_id = parts.lane_id;
         position_plan.variant_id = parts.variant_id;
         position_plan.direction = parts.direction;
         position_plan.grid_key = LP_BuildGridKeyFromParts(parts);
      }
   }

   void ObserveBrokerExecutionResult(const LP_TradeExecutionResult &execution)
   {
      if(execution.accepted)
      {
         m_execution_integrity.successful_order_results++;
         return;
      }

      m_execution_integrity.failed_order_results++;
      if(!execution.broker_rejected)
         return;

      datetime now = TimeCurrent();
      m_execution_integrity.broker_rejection_count++;
      if(m_execution_integrity.first_broker_rejection_time <= 0)
         m_execution_integrity.first_broker_rejection_time = now;
      m_execution_integrity.last_broker_rejection_time = now;

      if(execution.retcode == TRADE_RETCODE_NO_MONEY)
      {
         m_execution_integrity.no_money_count++;
         if(m_execution_integrity.first_no_money_time <= 0)
            m_execution_integrity.first_no_money_time = now;
         m_execution_integrity.last_no_money_time = now;
      }
      else if(execution.retcode == TRADE_RETCODE_MARKET_CLOSED)
      {
         m_execution_integrity.market_closed_count++;
      }
   }

   void ObserveBrokerModifyResult(const bool accepted, const MqlTradeResult &result)
   {
      LP_TradeExecutionResult execution;
      LP_ResetTradeExecutionResult(execution);
      execution.accepted = accepted;
      execution.retcode = result.retcode;
      execution.broker_rejected = !accepted && result.retcode != TRADE_RETCODE_PLACED;
      ObserveBrokerExecutionResult(execution);
   }

   bool CaptureCanonicalDealSet(
      const LP_TradePlan &plan,
      LP_TradeExecutionResult &execution)
   {
      execution.deal_set_complete = false;
      execution.deal_linkage_clean = false;
      execution.deal_count = 0;
      execution.deal_set_hash = 0;
      execution.first_deal_ticket = 0;
      execution.last_deal_ticket = 0;
      if(execution.deal_ticket == 0 ||
         !HistoryDealSelect(execution.deal_ticket))
         return false;

      ulong position_id = (ulong)HistoryDealGetInteger(
         execution.deal_ticket, DEAL_POSITION_ID);
      ulong order_id = (ulong)HistoryDealGetInteger(
         execution.deal_ticket, DEAL_ORDER);
      if(position_id == 0 || order_id == 0 ||
         (execution.order_ticket != 0 && execution.order_ticket != order_id))
         return false;
      execution.position_ticket = position_id;
      execution.order_ticket = order_id;
      if(!HistorySelectByPosition(position_id))
         return false;

      ulong tickets[];
      int count = 0;
      int total = HistoryDealsTotal();
      for(int i = 0; i < total; i++)
      {
         ulong ticket = HistoryDealGetTicket(i);
         if(ticket == 0 ||
            (ulong)HistoryDealGetInteger(ticket, DEAL_ORDER) != order_id)
            continue;
         if(count >= 32 || ArrayResize(tickets, count + 1) != count + 1)
            return false;
         tickets[count++] = ticket;
      }
      if(count <= 0)
         return false;
      for(int i = 1; i < count; i++)
      {
         ulong value = tickets[i];
         int j = i - 1;
         while(j >= 0 && tickets[j] > value)
         {
            tickets[j + 1] = tickets[j];
            j--;
         }
         tickets[j + 1] = value;
      }

      bool opening = IsOpenAction(plan.action);
      bool closing = IsCloseAction(plan.action);
      if(!opening && !closing)
         return false;
      double total_volume = 0.0;
      double weighted_price = 0.0;
      double realized_profit = 0.0;
      double realized_swap = 0.0;
      double realized_commission = 0.0;
      double realized_fee = 0.0;
      ulong hash = LP_HashString("canonical_order_deal_set_v1");
      LP_HashMixULong(hash, order_id);
      LP_HashMixULong(hash, position_id);
      LP_HashMixLong(hash, plan.magic);
      LP_HashMixInt(hash, plan.action);
      LP_HashMixInt(hash, plan.direction);
      for(int i = 0; i < count; i++)
      {
         ulong ticket = tickets[i];
         long deal_order = HistoryDealGetInteger(ticket, DEAL_ORDER);
         long deal_position = HistoryDealGetInteger(ticket, DEAL_POSITION_ID);
         long deal_magic = HistoryDealGetInteger(ticket, DEAL_MAGIC);
         int deal_entry = (int)HistoryDealGetInteger(ticket, DEAL_ENTRY);
         int deal_type = (int)HistoryDealGetInteger(ticket, DEAL_TYPE);
         string deal_symbol = HistoryDealGetString(ticket, DEAL_SYMBOL);
         double volume = HistoryDealGetDouble(ticket, DEAL_VOLUME);
         double price = HistoryDealGetDouble(ticket, DEAL_PRICE);
         bool entry_clean = opening ? deal_entry == DEAL_ENTRY_IN :
            (deal_entry == DEAL_ENTRY_OUT || deal_entry == DEAL_ENTRY_OUT_BY);
         int expected_type = opening ?
            (plan.direction == LP_SIDE_LONG ? DEAL_TYPE_BUY : DEAL_TYPE_SELL) :
            (plan.direction == LP_SIDE_LONG ? DEAL_TYPE_SELL : DEAL_TYPE_BUY);
         if(deal_order != (long)order_id ||
            deal_position != (long)position_id || deal_magic != plan.magic ||
            deal_symbol != plan.symbol || !entry_clean ||
            deal_type != expected_type || volume <= 0.0 || price <= 0.0 ||
            !MathIsValidNumber(volume) || !MathIsValidNumber(price))
            return false;
         total_volume += volume;
         weighted_price += volume * price;
         realized_profit += HistoryDealGetDouble(ticket, DEAL_PROFIT);
         realized_swap += HistoryDealGetDouble(ticket, DEAL_SWAP);
         realized_commission += HistoryDealGetDouble(ticket, DEAL_COMMISSION);
         realized_fee += HistoryDealGetDouble(ticket, DEAL_FEE);
         if(!MathIsValidNumber(total_volume) ||
            !MathIsValidNumber(weighted_price) ||
            !MathIsValidNumber(realized_profit) ||
            !MathIsValidNumber(realized_swap) ||
            !MathIsValidNumber(realized_commission) ||
            !MathIsValidNumber(realized_fee))
            return false;
         LP_HashMixULong(hash, ticket);
         LP_HashMixLong(hash, deal_order);
         LP_HashMixLong(hash, deal_position);
         LP_HashMixLong(hash, deal_magic);
         LP_HashMixInt(hash, deal_entry);
         LP_HashMixInt(hash, deal_type);
         LP_HashMixULong(hash, LP_HashString(deal_symbol));
         LP_HashMixULong(hash,
            LP_HashString(DoubleToString(volume, 8)));
         LP_HashMixULong(hash,
            LP_HashString(DoubleToString(price, 12)));
         LP_HashMixULong(hash, LP_HashString(DoubleToString(
            HistoryDealGetDouble(ticket, DEAL_PROFIT), 8)));
         LP_HashMixULong(hash, LP_HashString(DoubleToString(
            HistoryDealGetDouble(ticket, DEAL_SWAP), 8)));
         LP_HashMixULong(hash, LP_HashString(DoubleToString(
            HistoryDealGetDouble(ticket, DEAL_COMMISSION), 8)));
         LP_HashMixULong(hash, LP_HashString(DoubleToString(
            HistoryDealGetDouble(ticket, DEAL_FEE), 8)));
      }
      if(total_volume <= 0.0 || weighted_price <= 0.0 || hash == 0)
         return false;
      execution.deal_count = count;
      execution.first_deal_ticket = tickets[0];
      execution.last_deal_ticket = tickets[count - 1];
      for(int i = 0; i < count; i++)
         execution.canonical_deal_tickets[i] = tickets[i];
      execution.deal_ticket = execution.last_deal_ticket;
      execution.executed_lots = NormalizeDouble(total_volume, 8);
      execution.executed_price = weighted_price / total_volume;
      execution.realized_profit = realized_profit;
      execution.realized_swap = realized_swap;
      execution.realized_commission = realized_commission;
      execution.realized_fee = realized_fee;
      execution.deal_set_hash = hash;
      execution.deal_linkage_clean = true;
      execution.deal_set_complete = true;
      return true;
   }

   void CaptureExecutionResult(
      const LP_TradePlan &plan,
      const bool request_ok,
      LP_TradeExecutionResult &execution
   )
   {
      execution.action = plan.action;
      execution.requested_lots = plan.lots;
      execution.retcode = m_trade.ResultRetcode();
      execution.order_ticket = m_trade.ResultOrder();
      execution.deal_ticket = m_trade.ResultDeal();
      execution.executed_lots = m_trade.ResultVolume();
      execution.executed_price = m_trade.ResultPrice();
      execution.partial_fill = execution.retcode == TRADE_RETCODE_DONE_PARTIAL;
      bool executed_retcode = IsExecutedFillRetcode(execution.retcode);
      bool deal_proof = !executed_retcode ||
         CaptureCanonicalDealSet(plan, execution);
      bool deferred_single_pair_deal_proof = !plan.gate108 &&
         executed_retcode && execution.deal_ticket > 0 &&
         execution.executed_lots > 0.0;
      // A tester fill can be reported before its history row is selectable.
      // Keep the broker result accepted for single-pair mechanics and let the
      // later DEAL_ADD/history reconciliation complete the linkage.  Gate108
      // R keeps its stricter canonical deal-set requirement.
      execution.accepted = request_ok && executed_retcode &&
         (deal_proof || deferred_single_pair_deal_proof);
      execution.broker_rejected = !execution.accepted &&
         !executed_retcode && execution.retcode != TRADE_RETCODE_PLACED;

      execution.detail = "request_ok=" + LP_BoolText(request_ok) +
         "|retcode=" + IntegerToString((int)execution.retcode) +
         "|retcode_name=" + LP_RetcodeName(execution.retcode) +
         "|order_ticket=" + (string)execution.order_ticket +
         "|deal_ticket=" + (string)execution.deal_ticket +
         "|position_ticket=" + (string)execution.position_ticket +
         "|executed_lots=" + DoubleToString(execution.executed_lots, 2) +
         "|executed_price=" + DoubleToString(execution.executed_price, 8) +
         "|partial_fill=" + LP_BoolText(execution.partial_fill) +
         "|executed_fill=" + LP_BoolText(execution.accepted) +
         "|deal_set_complete=" + LP_BoolText(execution.deal_set_complete) +
         "|deal_linkage_clean=" + LP_BoolText(execution.deal_linkage_clean) +
         "|deal_proof_deferred=" +
            LP_BoolText(deferred_single_pair_deal_proof && !deal_proof) +
         "|deal_count=" + IntegerToString(execution.deal_count) +
         "|deal_set_hash=" + (string)execution.deal_set_hash;
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

   string PriceText(const double value, const int digits)
   {
      if(value <= 0.0 || !MathIsValidNumber(value))
         return "0";
      return DoubleToString(value, digits);
   }

   void BuildStopTakeProfitPrices(
      const LP_TradePlan &plan,
      double &stop_loss,
      double &take_profit,
      double &entry_reference,
      string &detail
   )
   {
      stop_loss = 0.0;
      take_profit = 0.0;
      entry_reference = 0.0;

      int digits = 5;
      if(StringLen(plan.symbol) > 0 && SymbolInfoInteger(plan.symbol, SYMBOL_EXIST))
         digits = (int)SymbolInfoInteger(plan.symbol, SYMBOL_DIGITS);

      string basis = plan.stop_take_profit_basis == "" ? "none" : plan.stop_take_profit_basis;
      detail = "sltp_basis=" + basis +
         "|take_profit_distance_price=" + DoubleToString(MathMax(0.0, plan.take_profit_distance_price), 8) +
         "|stop_loss_distance_price=" + DoubleToString(MathMax(0.0, plan.stop_loss_distance_price), 8);

      if(plan.stop_take_profit_basis == "" ||
         (plan.take_profit_distance_price <= 0.0 && plan.stop_loss_distance_price <= 0.0))
      {
         detail += "|sltp_active=false";
         return;
      }

      MqlTick tick;
      if(!SymbolInfoTick(plan.symbol, tick) || tick.ask <= 0.0 || tick.bid <= 0.0)
      {
         detail += "|sltp_active=false|sltp_note=tick_unavailable";
         return;
      }

      if(plan.direction > 0)
         entry_reference = tick.ask;
      else if(plan.direction < 0)
         entry_reference = tick.bid;
      else
      {
         detail += "|sltp_active=false|sltp_note=invalid_direction";
         return;
      }

      double point = SymbolInfoDouble(plan.symbol, SYMBOL_POINT);
      long stop_level_points = (long)SymbolInfoInteger(plan.symbol, SYMBOL_TRADE_STOPS_LEVEL);
      double min_stop_distance = point > 0.0 && stop_level_points > 0 ? (double)stop_level_points * point : 0.0;
      string notes = "";

      if(plan.stop_loss_distance_price > 0.0)
      {
         if(min_stop_distance > 0.0 && plan.stop_loss_distance_price < min_stop_distance)
            notes = "sl_below_min_stop_distance";
         else if(plan.direction > 0)
            stop_loss = NormalizeDouble(entry_reference - plan.stop_loss_distance_price, digits);
         else
            stop_loss = NormalizeDouble(entry_reference + plan.stop_loss_distance_price, digits);
      }

      if(plan.take_profit_distance_price > 0.0)
      {
         if(min_stop_distance > 0.0 && plan.take_profit_distance_price < min_stop_distance)
         {
            if(notes != "")
               notes += ",";
            notes += "tp_below_min_stop_distance";
         }
         else if(plan.direction > 0)
            take_profit = NormalizeDouble(entry_reference + plan.take_profit_distance_price, digits);
         else
            take_profit = NormalizeDouble(entry_reference - plan.take_profit_distance_price, digits);
      }

      detail += "|sltp_active=true" +
         "|entry_reference=" + PriceText(entry_reference, digits) +
         "|stop_loss=" + PriceText(stop_loss, digits) +
         "|take_profit=" + PriceText(take_profit, digits) +
         "|min_stop_distance=" + DoubleToString(min_stop_distance, digits);

      if(notes != "")
         detail += "|sltp_note=" + notes;
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
             "|close_reason=" + (plan.close_reason == "" ? "none" : plan.close_reason) +
             "|reservation_status=" + plan.reservation_status +
             "|reservation_reason=" + plan.reservation_reason +
             "|" + message,
         plan.lane_id,
         plan.variant_id,
         plan.grid_key,
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
             "|price=" + DoubleToString(m_trade.ResultPrice(), digits) +
             "|reservation_status=" + plan.reservation_status +
             "|reservation_reason=" + plan.reservation_reason,
         plan.lane_id,
         plan.variant_id,
         plan.grid_key,
         plan.intent_id,
         plan.decision_id,
         plan.magic
      );
   }

   void WriteModifyResult(
      LP_ReceiptWriter &receipts,
      const LP_TradePlan &plan,
      const ulong ticket,
      const bool ok,
      const MqlTradeResult &result
   )
   {
      int digits = 5;
      if(StringLen(plan.symbol) > 0 && SymbolInfoInteger(plan.symbol, SYMBOL_EXIST))
         digits = (int)SymbolInfoInteger(plan.symbol, SYMBOL_DIGITS);
      receipts.Write(
         LP_RECEIPT_ORDER_RESULT,
         plan.symbol,
         ok ? "modified" : "modify_failed",
         "plan_id=" + (string)plan.plan_id +
            "|ticket=" + (string)ticket +
            "|ok=" + LP_BoolText(ok) +
            "|retcode=" + IntegerToString((int)result.retcode) +
            "|retcode_name=" + LP_RetcodeName(result.retcode) +
            "|order=" + (string)result.order +
            "|deal=" + (string)result.deal +
            "|target_take_profit_price=" + DoubleToString(plan.target_take_profit_price, digits),
         plan.lane_id,
         plan.variant_id,
         plan.grid_key,
         plan.intent_id,
         plan.decision_id,
         plan.magic
      );
   }

   bool TargetTakeProfitTradable(
      const LP_TradePlan &plan,
      string &reason
   )
   {
      reason = "";
      if(plan.target_take_profit_price <= 0.0)
      {
         reason = "target_take_profit_missing";
         return false;
      }

      MqlTick tick;
      if(!SymbolInfoTick(plan.symbol, tick) || tick.ask <= 0.0 || tick.bid <= 0.0)
      {
         reason = "tick_unavailable";
         return false;
      }

      double point = SymbolInfoDouble(plan.symbol, SYMBOL_POINT);
      long stop_level_points = (long)SymbolInfoInteger(plan.symbol, SYMBOL_TRADE_STOPS_LEVEL);
      double min_stop_distance = point > 0.0 && stop_level_points > 0 ? (double)stop_level_points * point : 0.0;

      if(plan.direction > 0)
      {
         if(plan.target_take_profit_price <= tick.bid)
         {
            reason = "long_tp_not_above_bid";
            return false;
         }
         if(min_stop_distance > 0.0 && plan.target_take_profit_price - tick.bid < min_stop_distance)
         {
            reason = "long_tp_inside_stop_level";
            return false;
         }
      }
      else if(plan.direction < 0)
      {
         if(plan.target_take_profit_price >= tick.ask)
         {
            reason = "short_tp_not_below_ask";
            return false;
         }
         if(min_stop_distance > 0.0 && tick.ask - plan.target_take_profit_price < min_stop_distance)
         {
            reason = "short_tp_inside_stop_level";
            return false;
         }
      }
      else
      {
         reason = "invalid_direction";
         return false;
      }

      return true;
   }

   bool TakeProfitAlreadySynced(
      const string symbol,
      const double current_take_profit,
      const double target_take_profit
   )
   {
      if(current_take_profit <= 0.0 || target_take_profit <= 0.0)
         return false;
      double point = SymbolInfoDouble(symbol, SYMBOL_POINT);
      double tolerance = point > 0.0 ? point * 0.5 : 0.00000001;
      return MathAbs(current_take_profit - target_take_profit) <= tolerance;
   }

   bool PositionDirectionMatchesPlan(const long position_type, const int direction)
   {
      if(direction > 0)
         return position_type == POSITION_TYPE_BUY;
      if(direction < 0)
         return position_type == POSITION_TYPE_SELL;
      return false;
   }

   bool SyncGridTakeProfit(const LP_TradePlan &plan, LP_ReceiptWriter &receipts)
   {
      string barrier_reason = "";
      bool can_place = CanPlaceOrders(barrier_reason);
      if(!can_place || m_config.execution_mode == LP_EXECUTION_DRY_RUN)
      {
         WriteOrderRequest(receipts, plan, "grid_tp_sync_dry_or_blocked", "reason=" + (barrier_reason == "" ? "dry_run" : barrier_reason));
         return false;
      }

      datetime server_now = TimeTradeServer();
      string session_reason = "";
      string session_detail = "";
      bool session_metadata_unavailable = false;
      if(!LP_IsTradeSessionOpen(plan.symbol, server_now, session_reason, session_detail, session_metadata_unavailable))
      {
         ObserveSessionAdmissionBlock(plan.action, server_now, session_metadata_unavailable);
         WriteOrderRequest(
            receipts,
            plan,
            "grid_tp_sync_session_blocked",
            "reason=" + session_reason +
               "|order_send_attempted=false|" + session_detail
         );
         return false;
      }

      string target_reason = "";
      if(!TargetTakeProfitTradable(plan, target_reason))
      {
         WriteOrderRequest(
            receipts,
            plan,
            "grid_tp_sync_target_invalid",
            "reason=" + target_reason +
               "|grid_magic=" + (string)plan.magic +
               "|target_take_profit_price=" + DoubleToString(plan.target_take_profit_price, 8)
         );
         return false;
      }

      int digits = 5;
      if(StringLen(plan.symbol) > 0 && SymbolInfoInteger(plan.symbol, SYMBOL_EXIST))
         digits = (int)SymbolInfoInteger(plan.symbol, SYMBOL_DIGITS);

      int matched = 0;
      int skipped_synced = 0;
      int attempted = 0;
      int modified = 0;
      int failed = 0;
      bool bounded_ticket_scan = false;
      ulong tickets[];
      int ticket_count = LP_ParseTicketList(plan.grid_tickets, tickets);
      if(ticket_count > 0)
         bounded_ticket_scan = true;

      if(bounded_ticket_scan)
      {
         for(int i = 0; i < ticket_count; i++)
         {
            ulong ticket = tickets[i];
            m_broker_tp_sync_ticket_scans++;
            if(ticket == 0)
               continue;
            if(!PositionSelectByTicket(ticket))
               continue;

            long magic = (long)PositionGetInteger(POSITION_MAGIC);
            if(magic != plan.magic)
               continue;
            if(PositionGetString(POSITION_SYMBOL) != plan.symbol)
               continue;

            long position_type = (long)PositionGetInteger(POSITION_TYPE);
            if(!PositionDirectionMatchesPlan(position_type, plan.direction))
               continue;

            matched++;
            double current_stop_loss = PositionGetDouble(POSITION_SL);
            double current_take_profit = PositionGetDouble(POSITION_TP);
            if(TakeProfitAlreadySynced(plan.symbol, current_take_profit, plan.target_take_profit_price))
            {
               skipped_synced++;
               continue;
            }

            WriteOrderRequest(
               receipts,
               plan,
               "grid_tp_modify_request",
               "ticket=" + (string)ticket +
                  "|current_stop_loss=" + PriceText(current_stop_loss, digits) +
                  "|current_take_profit=" + PriceText(current_take_profit, digits) +
                  "|target_take_profit_price=" + DoubleToString(plan.target_take_profit_price, digits) +
                  "|grid_magic=" + (string)plan.magic
            );

            MqlTradeRequest request;
            MqlTradeResult result;
            ZeroMemory(request);
            ZeroMemory(result);
            request.action = TRADE_ACTION_SLTP;
            request.position = ticket;
            request.symbol = plan.symbol;
            request.magic = plan.magic;
            request.sl = current_stop_loss;
            request.tp = plan.target_take_profit_price;
            request.deviation = (ulong)MathMax(0, (int)MathRound(plan.max_slippage_points));

            attempted++;
            m_broker_tp_modify_attempts++;
            bool ok = OrderSend(request, result);
            bool accepted = ok && (result.retcode == TRADE_RETCODE_DONE || result.retcode == TRADE_RETCODE_PLACED);
            ObserveBrokerModifyResult(accepted, result);
            if(accepted)
               modified++;
            else
               failed++;
            WriteModifyResult(receipts, plan, ticket, accepted, result);
         }
      }
      else
      {
         for(int i = PositionsTotal() - 1; i >= 0; i--)
         {
            m_broker_tp_sync_ticket_scans++;
            ulong ticket = PositionGetTicket(i);
            if(ticket == 0)
               continue;
            if(!PositionSelectByTicket(ticket))
               continue;

            long magic = (long)PositionGetInteger(POSITION_MAGIC);
            if(magic != plan.magic)
               continue;
            if(PositionGetString(POSITION_SYMBOL) != plan.symbol)
               continue;

            long position_type = (long)PositionGetInteger(POSITION_TYPE);
            if(!PositionDirectionMatchesPlan(position_type, plan.direction))
               continue;

            matched++;
            double current_stop_loss = PositionGetDouble(POSITION_SL);
            double current_take_profit = PositionGetDouble(POSITION_TP);
            if(TakeProfitAlreadySynced(plan.symbol, current_take_profit, plan.target_take_profit_price))
            {
               skipped_synced++;
               continue;
            }

            WriteOrderRequest(
               receipts,
               plan,
               "grid_tp_modify_request",
               "ticket=" + (string)ticket +
                  "|current_stop_loss=" + PriceText(current_stop_loss, digits) +
                  "|current_take_profit=" + PriceText(current_take_profit, digits) +
                  "|target_take_profit_price=" + DoubleToString(plan.target_take_profit_price, digits) +
                  "|grid_magic=" + (string)plan.magic
            );

            MqlTradeRequest request;
            MqlTradeResult result;
            ZeroMemory(request);
            ZeroMemory(result);
            request.action = TRADE_ACTION_SLTP;
            request.position = ticket;
            request.symbol = plan.symbol;
            request.magic = plan.magic;
            request.sl = current_stop_loss;
            request.tp = plan.target_take_profit_price;
            request.deviation = (ulong)MathMax(0, (int)MathRound(plan.max_slippage_points));

            attempted++;
            m_broker_tp_modify_attempts++;
            bool ok = OrderSend(request, result);
            bool accepted = ok && (result.retcode == TRADE_RETCODE_DONE || result.retcode == TRADE_RETCODE_PLACED);
            ObserveBrokerModifyResult(accepted, result);
            if(accepted)
               modified++;
            else
               failed++;
            WriteModifyResult(receipts, plan, ticket, accepted, result);
         }
      }

      WriteOrderRequest(
         receipts,
         plan,
         "grid_tp_sync_scan_complete",
         "matched=" + IntegerToString(matched) +
            "|attempted=" + IntegerToString(attempted) +
            "|modified=" + IntegerToString(modified) +
            "|skipped_already_synced=" + IntegerToString(skipped_synced) +
            "|failed=" + IntegerToString(failed) +
            "|bounded_ticket_scan=" + LP_BoolText(bounded_ticket_scan) +
            "|expected_grid_ticket_count=" + IntegerToString(plan.expected_grid_ticket_count) +
            "|target_take_profit_price=" + DoubleToString(plan.target_take_profit_price, digits) +
            "|grid_magic=" + (string)plan.magic
      );

      return matched > 0 && failed == 0;
   }

   bool CloseTicket(
      const ulong ticket,
      const LP_TradePlan &plan,
      LP_ReceiptWriter &receipts,
      double &remaining_lots,
      LP_TradeExecutionResult &execution
   )
   {
      if(!PositionSelectByTicket(ticket))
         return false;

      string symbol = PositionGetString(POSITION_SYMBOL);
      long position_magic = (long)PositionGetInteger(POSITION_MAGIC);
      if(!LP_IsManagedMagic(position_magic))
         return false;
      if(plan.gate108 && plan.action == LP_INTENT_CLOSE_ALL_EA)
      {
         LP_MagicParts quarantine_parts;
         if(!LP_DecodeMagic(position_magic, quarantine_parts) ||
            quarantine_parts.lane_id != LP_LANE_REVMA ||
            quarantine_parts.variant_id != LP_VARIANT_REVMA_REVERSION)
            return false;
      }
      LP_TradePlan position_plan;
      BindPlanToPosition(plan, symbol, position_magic, position_plan);
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
         position_plan,
         partial ? "reduce_request" : "close_request",
          "ticket=" + (string)ticket +
             "|close_scope=" + (plan.action == LP_INTENT_CLOSE_ALL_EA ? "account_all_ea" : (partial ? "grid_reduce" : "grid_close")) +
             "|position_lots=" + DoubleToString(position_lots, 2) +
             "|close_lots=" + DoubleToString(close_lots, 2) +
              "|plan_magic=" + (string)plan.magic +
              "|position_magic=" + (string)position_magic +
              "|request_magic=" + (string)position_magic +
              "|close_reason=" + (plan.close_reason == "" ? "unknown_error" : plan.close_reason)
      );

      bool ok = false;
      m_trade.SetExpertMagicNumber((ulong)position_magic);
      if(!m_trade.SetTypeFillingBySymbol(symbol))
      {
         execution.failed_positions++;
         execution.detail = "symbol_filling_policy_unavailable";
         return false;
      }
      m_trade.SetTypeFilling(ORDER_FILLING_FOK);
      m_order_close_attempts++;
      if(partial && close_lots < position_lots)
         ok = m_trade.PositionClosePartial(ticket, close_lots, (ulong)MathMax(0, (int)MathRound(plan.max_slippage_points)));
      else
         ok = m_trade.PositionClose(ticket, (ulong)MathMax(0, (int)MathRound(plan.max_slippage_points)));

      LP_TradeExecutionResult ticket_execution;
      LP_ResetTradeExecutionResult(ticket_execution);
      ticket_execution.order_send_attempted = true;
      ticket_execution.session_open = true;
      ticket_execution.session_outcome = "broker_session_open";
      CaptureExecutionResult(position_plan, ok, ticket_execution);
      ObserveBrokerExecutionResult(ticket_execution);
      execution.retcode = ticket_execution.retcode;
      execution.order_ticket = ticket_execution.order_ticket;
      execution.deal_ticket = ticket_execution.deal_ticket;
      execution.position_ticket = ticket_execution.position_ticket;
      execution.executed_lots += ticket_execution.executed_lots;
      execution.realized_profit += ticket_execution.realized_profit;
      execution.realized_swap += ticket_execution.realized_swap;
      execution.realized_commission += ticket_execution.realized_commission;
      execution.realized_fee += ticket_execution.realized_fee;
      if(execution.deal_set_hash == 0)
         execution.deal_set_hash = LP_HashString(
            "canonical_close_deal_set_batch_v1");
      execution.deal_set_complete = execution.deal_set_complete &&
         ticket_execution.deal_set_complete;
      execution.deal_linkage_clean = execution.deal_linkage_clean &&
         ticket_execution.deal_linkage_clean;
      if(ticket_execution.deal_count > 0)
      {
         if(execution.deal_count >
            LP_MAX_EXECUTION_DEAL_TICKETS - ticket_execution.deal_count)
         {
            execution.deal_set_complete = false;
            execution.deal_linkage_clean = false;
            execution.failed_positions++;
            execution.detail = "canonical_close_deal_ticket_capacity_exhausted";
            return false;
         }
         if(execution.deal_count == 0)
            execution.first_deal_ticket =
               ticket_execution.first_deal_ticket;
         execution.last_deal_ticket = ticket_execution.last_deal_ticket;
         for(int deal_index = 0;
             deal_index < ticket_execution.deal_count; deal_index++)
         {
            execution.canonical_deal_tickets[execution.deal_count +
               deal_index] = ticket_execution.canonical_deal_tickets[
                  deal_index];
         }
         execution.deal_count += ticket_execution.deal_count;
         LP_HashMixULong(execution.deal_set_hash,
            ticket_execution.deal_set_hash);
      }
      execution.partial_fill = execution.partial_fill || ticket_execution.partial_fill;
      bool ticket_flat = false;
      if(ticket_execution.accepted)
      {
         if(partial)
            remaining_lots -= MathMin(close_lots, ticket_execution.executed_lots > 0.0 ? ticket_execution.executed_lots : close_lots);
         ticket_flat = !PositionSelectByTicket(ticket) || PositionGetDouble(POSITION_VOLUME) <= 0.0;
         if(ticket_flat)
            execution.closed_positions++;
      }
      else
         execution.failed_positions++;

      WriteOrderResult(receipts, position_plan, ticket_execution.accepted, close_lots, symbol);
      return ticket_flat;
   }

   bool CloseMatchingPositions(const LP_TradePlan &plan, LP_ReceiptWriter &receipts, LP_TradeExecutionResult &execution)
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

      m_trade.SetDeviationInPoints((ulong)MathMax(0, (int)MathRound(plan.max_slippage_points)));

      string close_scope = plan.action == LP_INTENT_CLOSE_ALL_EA ? "account_all_ea" :
         (plan.action == LP_INTENT_REDUCE_GRID ? "grid_reduce" : "grid_close");
      int close_limit = plan.gate108 &&
         (plan.action == LP_INTENT_CLOSE_GRID ||
          plan.action == LP_INTENT_CLOSE_ALL_EA) ?
         1 : m_config.max_close_positions_per_step;
      int matched = 0;
      int attempted = 0;
      int closed = 0;
      int skipped_due_to_close_limit = 0;
      int session_deferred = 0;
      int session_metadata_unavailable_count = 0;
      double remaining_lots = plan.lots;
      bool reduce_done = false;
      execution.close_limit = close_limit;
      execution.deal_set_complete = true;
      execution.deal_linkage_clean = true;
      datetime server_now = TimeTradeServer();

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
         if(plan.gate108 && plan.action == LP_INTENT_CLOSE_ALL_EA)
         {
            LP_MagicParts quarantine_parts;
            if(!LP_DecodeMagic(magic, quarantine_parts) ||
               quarantine_parts.lane_id != LP_LANE_REVMA ||
               quarantine_parts.variant_id != LP_VARIANT_REVMA_REVERSION)
               continue;
         }

         if(plan.action != LP_INTENT_CLOSE_ALL_EA)
         {
            if(magic != plan.magic)
               continue;
            if(StringLen(plan.symbol) > 0 && PositionGetString(POSITION_SYMBOL) != plan.symbol)
               continue;
         }

         matched++;
         execution.matched_positions++;
         string position_symbol = PositionGetString(POSITION_SYMBOL);
         string session_reason = "";
         string session_detail = "";
         bool session_metadata_unavailable = false;
         if(!LP_IsTradeSessionOpen(position_symbol, server_now, session_reason, session_detail, session_metadata_unavailable))
         {
            session_deferred++;
            if(session_metadata_unavailable)
               session_metadata_unavailable_count++;
            ObserveSessionAdmissionBlock(plan.action, server_now, session_metadata_unavailable);
            LP_TradePlan position_plan;
            BindPlanToPosition(plan, position_symbol, magic, position_plan);
            WriteOrderRequest(
               receipts,
               position_plan,
               "close_session_deferred",
               "ticket=" + (string)ticket +
                  "|reason=" + session_reason +
                  "|order_send_attempted=false|" + session_detail
            );
            continue;
         }
         if(attempted >= close_limit)
         {
            skipped_due_to_close_limit++;
            continue;
         }

         if(reduce_done)
            break;

         attempted++;
         execution.attempted_positions++;
         execution.order_send_attempted = true;
         execution.session_open = true;
         execution.session_outcome = "broker_session_open";
         if(CloseTicket(ticket, plan, receipts, remaining_lots, execution))
            closed++;

         if(plan.action == LP_INTENT_REDUCE_GRID && remaining_lots <= 0.0)
         {
            reduce_done = true;
            break;
         }
      }

      bool close_work_pending = matched > closed;
      bool close_all_pending = plan.action == LP_INTENT_CLOSE_ALL_EA && close_work_pending;

      WriteOrderRequest(
         receipts,
         plan,
          "close_scan_complete",
          "close_scope=" + close_scope +
             "|matched=" + IntegerToString(matched) +
             "|attempted=" + IntegerToString(attempted) +
             "|closed=" + IntegerToString(closed) +
             "|skipped_due_to_close_limit=" + IntegerToString(skipped_due_to_close_limit) +
             "|session_deferred=" + IntegerToString(session_deferred) +
             "|close_limit=" + IntegerToString(close_limit) +
             "|close_work_pending=" + LP_BoolText(close_work_pending) +
             "|close_all_pending=" + LP_BoolText(close_all_pending) +
             "|remaining_lots=" + DoubleToString(MathMax(0.0, remaining_lots), 2) +
              "|reduce_done=" + LP_BoolText(reduce_done) +
              "|grid_magic=" + (string)plan.magic +
              "|close_reason=" + (plan.close_reason == "" ? "unknown_error" : plan.close_reason)
      );
      execution.accepted = (closed > 0 || execution.partial_fill) &&
         execution.failed_positions == 0 && execution.deal_set_complete &&
         execution.deal_linkage_clean && execution.deal_count > 0 &&
         execution.deal_set_hash != 0;
      execution.broker_rejected = closed == 0 && !execution.partial_fill && execution.attempted_positions > 0;
      if(attempted == 0 && session_deferred > 0)
      {
         execution.session_open = false;
         execution.session_outcome =
            session_metadata_unavailable_count > 0 ?
               "trade_session_metadata_unavailable" :
               "trade_session_closed_before_order_send";
      }
      else if(attempted == 0)
      {
         execution.session_open = false;
         execution.session_outcome = "no_matching_position";
      }
      execution.detail = "matched=" + IntegerToString(execution.matched_positions) +
         "|attempted=" + IntegerToString(execution.attempted_positions) +
         "|closed=" + IntegerToString(execution.closed_positions) +
         "|failed=" + IntegerToString(execution.failed_positions) +
         "|session_deferred=" + IntegerToString(session_deferred) +
         "|close_reason=" + (plan.close_reason == "" ? "unknown_error" : plan.close_reason);
      return execution.accepted;
   }

public:
   void Reset()
   {
      m_ready = false;
      m_broker_tp_sync_ticket_scans = 0;
      m_broker_tp_modify_attempts = 0;
      m_order_open_attempts = 0;
      m_order_close_attempts = 0;
      LP_ResetBrokerExecutionIntegrity(m_execution_integrity);
   }

   void Configure(const LP_Config &config)
   {
      m_config = config;
      m_ready = true;
   }

   bool CancelGate108ManagedPendingOrders(
      LP_ReceiptWriter &receipts,
      int &matched,
      int &deleted,
      int &failed,
      int &foreign)
   {
      matched = 0;
      deleted = 0;
      failed = 0;
      foreign = 0;
      if(!m_ready)
         return false;
      for(int i = OrdersTotal() - 1; i >= 0; i--)
      {
         ulong ticket = OrderGetTicket(i);
         if(ticket == 0)
         {
            failed++;
            continue;
         }
         long magic = OrderGetInteger(ORDER_MAGIC);
         string symbol = OrderGetString(ORDER_SYMBOL);
         LP_MagicParts parts;
         bool managed_revma = LP_IsManagedMagic(magic) &&
            LP_DecodeMagic(magic, parts) &&
            parts.lane_id == LP_LANE_REVMA &&
            parts.variant_id == LP_VARIANT_REVMA_REVERSION;
         if(!managed_revma)
         {
            foreign++;
            receipts.Write(
               LP_RECEIPT_ERROR,
               symbol,
               "gate108_quarantine_foreign_pending_order",
               "ticket=" + (string)ticket + "|magic=" + (string)magic,
               0, 0, 0, 0, 0, magic);
            continue;
         }
         matched++;
         ResetLastError();
         m_trade.SetExpertMagicNumber((ulong)magic);
         bool accepted = m_trade.OrderDelete(ticket);
         uint retcode = m_trade.ResultRetcode();
         if(accepted && retcode == TRADE_RETCODE_DONE)
            deleted++;
         else
            failed++;
         receipts.Write(
            LP_RECEIPT_ORDER_RESULT,
            symbol,
            accepted ? "gate108_quarantine_order_cancelled" :
               "gate108_quarantine_order_cancel_failed",
            "ticket=" + (string)ticket +
               "|magic=" + (string)magic +
               "|retcode=" + IntegerToString((int)retcode) +
               "|retcode_name=" + LP_RetcodeName(retcode) +
               "|error=" + IntegerToString(GetLastError()),
            parts.lane_id,
            parts.variant_id,
            LP_BuildGridKeyFromParts(parts),
            0, 0, magic);
      }
      return failed == 0 && foreign == 0;
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

      bool is_tester = LP_IsTesterRuntime();
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

   bool Execute(const LP_TradePlan &plan, LP_ReceiptWriter &receipts, LP_TradeExecutionResult &execution)
   {
      LP_ResetTradeExecutionResult(execution);
      execution.action = plan.action;
      execution.requested_lots = plan.lots;
      if(IsProtectionModifyAction(plan.action))
         return SyncGridTakeProfit(plan, receipts);

      if(IsCloseAction(plan.action))
         return CloseMatchingPositions(plan, receipts, execution);

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
      if(plan.gate108 &&
         NormalizeDouble(normalized_lots, 2) !=
            NormalizeDouble(0.01, 2))
      {
         execution.detail =
            "order_send_attempted=false|reason=gate108_atom_lot_mismatch";
         execution.session_outcome = "not_reached_lot_invariant";
         WriteOrderRequest(receipts, plan, "lot_rejected", execution.detail);
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

      datetime server_now = TimeTradeServer();
      string session_reason = "";
      string session_detail = "";
      bool session_metadata_unavailable = false;
      if(!LP_IsTradeSessionOpen(plan.symbol, server_now, session_reason, session_detail, session_metadata_unavailable))
      {
         ObserveSessionAdmissionBlock(plan.action, server_now, session_metadata_unavailable);
         execution.detail = "order_send_attempted=false|reason=" + session_reason + "|" + session_detail;
         execution.session_open = false;
         execution.session_outcome = session_reason;
         WriteOrderRequest(
            receipts,
            plan,
            "open_session_blocked",
            execution.detail
         );
         return false;
      }
      execution.session_open = true;
      execution.session_outcome = "broker_session_open";

      m_trade.SetExpertMagicNumber(plan.magic);
      m_trade.SetDeviationInPoints((ulong)MathMax(0, (int)MathRound(plan.max_slippage_points)));
      if(!m_trade.SetTypeFillingBySymbol(plan.symbol))
      {
         execution.detail =
            "order_send_attempted=false|reason=symbol_filling_policy_unavailable";
         return false;
      }
      m_trade.SetTypeFilling(ORDER_FILLING_FOK);
      double stop_loss = 0.0;
      double take_profit = 0.0;
      double entry_reference = 0.0;
      string sltp_detail = "";
      BuildStopTakeProfitPrices(plan, stop_loss, take_profit, entry_reference, sltp_detail);
      WriteOrderRequest(
         receipts,
         plan,
         "open_request",
         "normalized_lots=" + DoubleToString(normalized_lots, 2) +
            "|" + sltp_detail
      );
      bool ok = false;
      if(plan.direction > 0)
      {
         m_order_open_attempts++;
         execution.order_send_attempted = true;
         ok = m_trade.Buy(normalized_lots, plan.symbol, 0.0, stop_loss, take_profit, plan.comment);
      }
      else if(plan.direction < 0)
      {
         m_order_open_attempts++;
         execution.order_send_attempted = true;
         ok = m_trade.Sell(normalized_lots, plan.symbol, 0.0, stop_loss, take_profit, plan.comment);
      }
      else
      {
         WriteOrderRequest(receipts, plan, "direction_rejected", "reason=invalid_direction");
         return false;
      }

      CaptureExecutionResult(plan, ok, execution);
      ObserveBrokerExecutionResult(execution);
      WriteOrderResult(receipts, plan, execution.accepted, normalized_lots, plan.symbol);
      return execution.accepted;
   }

   ulong BrokerTpSyncTicketScanCount()
   {
      return m_broker_tp_sync_ticket_scans;
   }

   ulong BrokerTpModifyAttemptCount()
   {
      return m_broker_tp_modify_attempts;
   }

   ulong OrderOpenAttemptCount()
   {
      return m_order_open_attempts;
   }

   ulong OrderCloseAttemptCount()
   {
      return m_order_close_attempts;
   }

   void GetBrokerExecutionIntegrity(LP_BrokerExecutionIntegrity &integrity)
   {
      integrity = m_execution_integrity;
   }
};

#endif // __LIMNI_PORTFOLIO_TRADE_ROUTER_MQH__
