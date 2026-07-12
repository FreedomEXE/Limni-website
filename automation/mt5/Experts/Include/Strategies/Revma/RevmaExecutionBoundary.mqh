/*-----------------------------------------------
  Revma execution and research-validity boundary
  Phase B.2.1: explicit observation outcome propagation.
-----------------------------------------------*/
#ifndef __LIMNI_PORTFOLIO_REVMA_EXECUTION_BOUNDARY_MQH__
#define __LIMNI_PORTFOLIO_REVMA_EXECUTION_BOUNDARY_MQH__

#include "..\\..\\Core\\Types.mqh"
#include "..\\..\\Core\\Config.mqh"
#include "..\\..\\Execution\\MagicCodec.mqh"
#include "..\\..\\Execution\\TradeRouter.mqh"
#include "..\\..\\Portfolio\\PositionIndex.mqh"
#include "..\\..\\Receipts\\MandatoryDiagnostics.mqh"
#include "RevmaDiscoveryTypes.mqh"

class LP_RevmaExecutionBoundary
{
private:
   LP_Config m_config;
   bool m_active;
   long m_run_start_msc;
   ulong m_baseline_deal_tickets[];
   ulong m_baseline_deal_count;
   ulong m_incremental_deal_tickets[];
   ulong m_incremental_deal_count;
   int m_incremental_deal_capacity;
   ulong m_incremental_deal_hash;
   ulong m_routed_deal_tickets[];
   ulong m_routed_deal_count;
   int m_routed_deal_capacity;
   ulong m_routed_deal_hash;
   bool m_account_deal_contamination;
   bool m_account_deal_mutation_observed;
   bool m_quarantine_active;
   bool m_quarantine_flat_confirmed;
   ulong m_quarantine_steps;
   string m_quarantine_reason;

   long VolumeStepUnits(const double volume, const double step)
   {
      if(volume <= 0.0 || step <= 0.0 ||
         !MathIsValidNumber(volume) || !MathIsValidNumber(step))
         return 0;
      long units = (long)MathRound(volume / step);
      if(units <= 0 || MathAbs(volume - ((double)units * step)) >
         MathMax(0.000000000001, step * 0.00000001))
         return 0;
      return units;
   }

   bool AppendTicket(ulong &tickets[], ulong &count, int &capacity,
      const ulong ticket)
   {
      if(ticket == 0 || count >= (ulong)LP_REVMA_DISCOVERY_MINOR_ABS_LIMIT ||
         count > 2147483646)
         return false;
      if((int)count >= capacity)
      {
         int next_capacity = capacity <= 0 ? 64 : capacity * 2;
         if(next_capacity <= capacity || next_capacity < 0 ||
            ArrayResize(tickets, next_capacity, next_capacity) != next_capacity)
            return false;
         capacity = next_capacity;
      }
      tickets[(int)count] = ticket;
      count++;
      return true;
   }

   bool SortAndValidate(ulong &tickets[], const ulong count)
   {
      if(count > 2147483647 || ArrayResize(tickets, (int)count) != (int)count)
         return false;
      if(count > 1)
         ArraySort(tickets);
      for(int i = 0; i < (int)count; i++)
      {
         if(tickets[i] == 0 || (i > 0 && tickets[i - 1] >= tickets[i]))
            return false;
      }
      return true;
   }

   bool BaselineContains(const ulong ticket)
   {
      int left = 0;
      int right = (int)m_baseline_deal_count - 1;
      while(left <= right)
      {
         int middle = left + (right - left) / 2;
         if(m_baseline_deal_tickets[middle] == ticket)
            return true;
         if(m_baseline_deal_tickets[middle] < ticket)
            left = middle + 1;
         else
            right = middle - 1;
      }
      return false;
   }

   bool MixDealIdentity(const ulong ticket, ulong &hash,
      bool &contamination)
   {
      if(ticket == 0 || !HistoryDealSelect(ticket))
         return false;
      long deal_time_msc = HistoryDealGetInteger(ticket, DEAL_TIME_MSC);
      int deal_type = (int)HistoryDealGetInteger(ticket, DEAL_TYPE);
      int deal_entry = (int)HistoryDealGetInteger(ticket, DEAL_ENTRY);
      int deal_reason = (int)HistoryDealGetInteger(ticket, DEAL_REASON);
      long deal_magic = HistoryDealGetInteger(ticket, DEAL_MAGIC);
      ulong deal_order = (ulong)HistoryDealGetInteger(ticket, DEAL_ORDER);
      ulong deal_position = (ulong)HistoryDealGetInteger(ticket, DEAL_POSITION_ID);
      string deal_symbol = HistoryDealGetString(ticket, DEAL_SYMBOL);
      double volume = HistoryDealGetDouble(ticket, DEAL_VOLUME);
      double profit = HistoryDealGetDouble(ticket, DEAL_PROFIT);
      double swap = HistoryDealGetDouble(ticket, DEAL_SWAP);
      double commission = HistoryDealGetDouble(ticket, DEAL_COMMISSION);
      double fee = HistoryDealGetDouble(ticket, DEAL_FEE);
      if(deal_time_msc <= 0 || !MathIsValidNumber(volume) ||
         !MathIsValidNumber(profit) || !MathIsValidNumber(swap) ||
         !MathIsValidNumber(commission) || !MathIsValidNumber(fee))
         return false;

      LP_MagicParts parts;
      bool decoded = LP_IsManagedMagic(deal_magic) &&
         LP_DecodeMagic(deal_magic, parts);
      bool opening = deal_entry == DEAL_ENTRY_IN;
      bool closing = deal_entry == DEAL_ENTRY_OUT ||
         deal_entry == DEAL_ENTRY_OUT_BY;
      int expected_type = decoded ?
         (opening ?
            (parts.direction == LP_SIDE_LONG ? DEAL_TYPE_BUY : DEAL_TYPE_SELL) :
            (parts.direction == LP_SIDE_LONG ? DEAL_TYPE_SELL : DEAL_TYPE_BUY)) :
         -1;
      string expected_symbol = decoded ?
         LP_CanonicalSymbol(parts.symbol_id) + m_config.broker_symbol_suffix : "";
      bool order_clean = deal_order > 0 && HistoryOrderSelect(deal_order) &&
         HistoryOrderGetInteger(deal_order, ORDER_MAGIC) == deal_magic &&
         HistoryOrderGetString(deal_order, ORDER_SYMBOL) == deal_symbol;
      bool managed_revma = decoded &&
         parts.lane_id == LP_LANE_REVMA &&
         parts.variant_id == LP_VARIANT_REVMA_REVERSION &&
         parts.symbol_id >= 0 && parts.symbol_id < LP_SYMBOL_COUNT &&
         (parts.direction == LP_SIDE_LONG || parts.direction == LP_SIDE_SHORT) &&
         (opening || closing) && deal_type == expected_type &&
         deal_reason == DEAL_REASON_EXPERT && deal_symbol == expected_symbol &&
         deal_position > 0 &&
         VolumeStepUnits(volume,
            SymbolInfoDouble(deal_symbol, SYMBOL_VOLUME_STEP)) ==
            VolumeStepUnits(LP_REVMA_DISCOVERY_ATOM_LOTS,
               SymbolInfoDouble(deal_symbol, SYMBOL_VOLUME_STEP)) &&
         VolumeStepUnits(volume,
            SymbolInfoDouble(deal_symbol, SYMBOL_VOLUME_STEP)) > 0 &&
         order_clean;
      contamination = contamination || !managed_revma;
      LP_HashMixULong(hash, ticket);
      LP_HashMixLong(hash, deal_time_msc);
      LP_HashMixInt(hash, deal_type);
      LP_HashMixInt(hash, deal_entry);
      LP_HashMixInt(hash, deal_reason);
      LP_HashMixLong(hash, deal_magic);
      LP_HashMixULong(hash, deal_order);
      LP_HashMixULong(hash, deal_position);
      LP_HashMixULong(hash, LP_HashString(deal_symbol));
      LP_HashMixULong(hash, LP_HashString(DoubleToString(volume, 8)));
      LP_HashMixULong(hash, LP_HashString(DoubleToString(profit, 8)));
      LP_HashMixULong(hash, LP_HashString(DoubleToString(swap, 8)));
      LP_HashMixULong(hash, LP_HashString(DoubleToString(commission, 8)));
      LP_HashMixULong(hash, LP_HashString(DoubleToString(fee, 8)));
      return hash != 0;
   }

   bool Canonicalize(ulong &tickets[], const ulong count, ulong &hash,
      bool &contamination)
   {
      hash = LP_HashString("gate108_account_deal_set_v1");
      contamination = false;
      if(hash == 0 || !SortAndValidate(tickets, count))
         return false;
      for(int i = 0; i < (int)count; i++)
      {
         if(!MixDealIdentity(tickets[i], hash, contamination))
            return false;
      }
      return hash != 0;
   }

   bool TicketSetsEqual(ulong &left[], const ulong left_count,
      ulong &right[], const ulong right_count)
   {
      if(left_count != right_count)
         return false;
      for(int i = 0; i < (int)left_count; i++)
      {
         if(left[i] != right[i])
            return false;
      }
      return true;
   }

   bool FinalAccountAudit(ulong &deal_tickets[], ulong &deal_count,
      ulong &deal_hash, bool &contamination)
   {
      deal_count = 0;
      deal_hash = 0;
      contamination = false;
      ArrayResize(deal_tickets, 0);
      if(m_run_start_msc <= 0 || !HistorySelect((datetime)0, TimeCurrent() + 60))
         return false;
      int total = HistoryDealsTotal();
      if(total < 0 || ArrayResize(deal_tickets, total) != total)
         return false;
      for(int i = 0; i < total; i++)
      {
         ulong ticket = HistoryDealGetTicket(i);
         if(ticket == 0)
            return false;
         if(BaselineContains(ticket))
            continue;
         deal_tickets[(int)deal_count] = ticket;
         deal_count++;
      }
      return Canonicalize(deal_tickets, deal_count, deal_hash, contamination);
   }

public:
   void Reset()
   {
      ZeroMemory(m_config);
      m_active = false;
      m_run_start_msc = 0;
      m_baseline_deal_count = 0;
      ArrayResize(m_baseline_deal_tickets, 0);
      m_incremental_deal_count = 0;
      m_incremental_deal_capacity = 0;
      ArrayResize(m_incremental_deal_tickets, 0);
      m_incremental_deal_hash = LP_HashString("gate108_account_deal_set_v1");
      m_routed_deal_count = 0;
      m_routed_deal_capacity = 0;
      ArrayResize(m_routed_deal_tickets, 0);
      m_routed_deal_hash = LP_HashString("gate108_account_deal_set_v1");
      m_account_deal_contamination = false;
      m_account_deal_mutation_observed = false;
      m_quarantine_active = false;
      m_quarantine_flat_confirmed = false;
      m_quarantine_steps = 0;
      m_quarantine_reason = "";
   }

   bool Prepare(const LP_Config &config)
   {
      m_config = config;
      m_active = true;
      m_run_start_msc = (long)TimeCurrent() * 1000;
      m_baseline_deal_count = 0;
      ArrayResize(m_baseline_deal_tickets, 0);
      if(m_run_start_msc <= 0 || !HistorySelect((datetime)0, TimeCurrent() + 60))
         return false;
      int total = HistoryDealsTotal();
      if(total < 0 || ArrayResize(m_baseline_deal_tickets, total) != total)
         return false;
      for(int i = 0; i < total; i++)
      {
         ulong ticket = HistoryDealGetTicket(i);
         if(ticket == 0)
            return false;
         m_baseline_deal_tickets[(int)m_baseline_deal_count] = ticket;
         m_baseline_deal_count++;
      }
      return SortAndValidate(m_baseline_deal_tickets, m_baseline_deal_count);
   }

   bool Active() const { return m_active; }
   bool QuarantineActive() const { return m_quarantine_active; }
   bool QuarantineFlatConfirmed() const { return m_quarantine_flat_confirmed; }
   ulong QuarantineSteps() const { return m_quarantine_steps; }
   string QuarantineReason() const { return m_quarantine_reason; }
   bool AccountDealContamination() const { return m_account_deal_contamination; }
   bool AccountDealMutationObserved() const { return m_account_deal_mutation_observed; }
   ulong IncrementalDealCount() const { return m_incremental_deal_count; }
   ulong IncrementalDealHash() const { return m_incremental_deal_hash; }
   ulong RoutedDealCount() const { return m_routed_deal_count; }
   ulong RoutedDealHash() const { return m_routed_deal_hash; }

   bool RememberRoutedDealSet(const LP_TradePlan &plan,
      const LP_TradeExecutionResult &execution)
   {
      if(!plan.gate108 || execution.deal_count <= 0)
         return true;
      bool quarantine_close = plan.action == LP_INTENT_CLOSE_ALL_EA &&
         plan.close_reason == "gate108_execution_quarantine";
      if((plan.action != LP_INTENT_OPEN_GRID &&
          plan.action != LP_INTENT_ADD_GRID_LEG &&
          plan.action != LP_INTENT_CLOSE_GRID && !quarantine_close) ||
         execution.deal_count > LP_MAX_EXECUTION_DEAL_TICKETS)
         return false;
      for(int i = 0; i < execution.deal_count; i++)
      {
         if(!AppendTicket(m_routed_deal_tickets, m_routed_deal_count,
               m_routed_deal_capacity, execution.canonical_deal_tickets[i]))
            return false;
      }
      return true;
   }

    LP_ExecutionObservationOutcome ObserveTransaction(
       const MqlTradeTransaction &trans,
       const bool fatal_latched,
       LP_MandatoryDiagnostics &mandatory,
       LP_ReceiptWriter &receipts,
       string &outcome_reason)
    {
       outcome_reason = "";
       if(!m_active)
          return LP_EXECUTION_OBSERVATION_OK;
       if(trans.type == TRADE_TRANSACTION_DEAL_DELETE)
       {
          m_account_deal_mutation_observed = true;
          EnterQuarantine("gate108_canonical_deal_deleted", mandatory, receipts);
          outcome_reason = m_quarantine_reason;
          return LP_EXECUTION_OBSERVATION_QUARANTINE;
       }
      if(trans.type == TRADE_TRANSACTION_DEAL_UPDATE)
      {
         mandatory.Event("deal_history_update", trans.symbol, 0,
            (int)trans.type, 0, trans.order, trans.deal, trans.position,
            "normal_history_refresh",
            "history_update_is_not_automatic_quarantine", false);
      }
      if(trans.type == TRADE_TRANSACTION_DEAL_ADD && trans.deal > 0)
      {
         if(!AppendTicket(m_incremental_deal_tickets,
               m_incremental_deal_count, m_incremental_deal_capacity,
               trans.deal))
         {
            EnterQuarantine("gate108_incremental_deal_audit_failed",
               mandatory, receipts);
            outcome_reason = m_quarantine_reason;
            return LP_EXECUTION_OBSERVATION_AUDIT_FAILURE;
         }
         if(fatal_latched && !m_quarantine_active)
         {
            EnterQuarantine("gate108_delayed_deal_after_fatal_quarantine",
               mandatory, receipts);
            outcome_reason = m_quarantine_reason;
            return LP_EXECUTION_OBSERVATION_QUARANTINE;
         }
      }
      return LP_EXECUTION_OBSERVATION_OK;
   }

   void EnterQuarantine(const string reason,
      LP_MandatoryDiagnostics &mandatory, LP_ReceiptWriter &receipts)
   {
      if(!m_active)
         return;
      if(!m_quarantine_active)
      {
         m_quarantine_active = true;
         m_quarantine_flat_confirmed = false;
         m_quarantine_reason = reason == "" ?
            "gate108_execution_quarantine_unspecified" : reason;
         mandatory.Event("close_owner_latch", "", 0, 0, 0, 0, 0, 0,
            m_quarantine_reason, "owner=gate108_execution_quarantine", false);
         receipts.Write(LP_RECEIPT_ERROR, "",
            "gate108_execution_quarantine_latched", m_quarantine_reason,
            0, 0, 0, 0, 0, 0);
      }
   }

   bool RunQuarantineStep(
      LP_PortfolioState &portfolio,
      LP_TradeRouter &router,
      LP_PositionIndex &position_index,
      LP_ReceiptWriter &receipts,
      LP_MandatoryDiagnostics &mandatory,
      bool &portfolio_dirty)
   {
      if(!m_quarantine_active)
         return true;
      if(m_quarantine_steps >= (ulong)LP_REVMA_DISCOVERY_MINOR_ABS_LIMIT)
      {
         receipts.Write(LP_RECEIPT_ERROR, "",
            "gate108_execution_quarantine_counter_overflow",
            m_quarantine_reason, 0, 0, 0, 0, 0, 0);
         return false;
      }
      m_quarantine_steps++;
      LP_TradePlan filter_plan;
      LP_ResetTradePlan(filter_plan);
      filter_plan.execution_contract.close_limit_override = 1;
      filter_plan.execution_contract.close_identity_filter = true;
      filter_plan.execution_contract.close_lane_id = LP_LANE_REVMA;
      filter_plan.execution_contract.close_variant_id = LP_VARIANT_REVMA_REVERSION;
      int pending_matched = 0;
      int pending_deleted = 0;
      int pending_failed = 0;
      int pending_foreign = 0;
      bool pending_clean = router.CancelManagedPendingOrders(filter_plan,
         receipts, pending_matched, pending_deleted, pending_failed,
         pending_foreign);

      bool foreign_inventory = portfolio.external_position_count != 0 ||
         portfolio.unknown_managed_position_count != 0 ||
         portfolio.entry_group_position_count != 0 ||
         portfolio.managed_position_count != portfolio.grid_group_position_count ||
         pending_foreign != 0;
      if(foreign_inventory)
      {
         receipts.Write(LP_RECEIPT_ERROR, "",
            "gate108_execution_quarantine_account_contamination",
            "external=" + IntegerToString(portfolio.external_position_count) +
            "|unknown_managed=" + IntegerToString(
               portfolio.unknown_managed_position_count) +
            "|entry_group=" + IntegerToString(
               portfolio.entry_group_position_count) +
            "|foreign_orders=" + IntegerToString(pending_foreign),
            0, 0, 0, 0, 0, 0);
         return false;
      }
      if(portfolio.managed_position_count == 0 && OrdersTotal() == 0)
      {
         m_quarantine_active = false;
         m_quarantine_flat_confirmed = true;
         receipts.Write(LP_RECEIPT_ERROR, "",
            "gate108_execution_quarantine_flat_confirmed",
            "steps=" + (string)m_quarantine_steps +
            "|reason=" + m_quarantine_reason, 0, 0, 0, 0, 0, 0);
         mandatory.Event("confirmed_flat", "", 0, 0, 0, 0, 0, 0,
            m_quarantine_reason, "owner=gate108_execution_quarantine", false);
         return true;
      }
      if(!pending_clean || OrdersTotal() != 0 ||
         portfolio.managed_position_count <= 0)
         return true;

      LP_TradePlan plan;
      LP_ResetTradePlan(plan);
      plan.action = LP_INTENT_CLOSE_ALL_EA;
      plan.max_slippage_points = (double)LP_REVMA_DISCOVERY_MAX_SLIPPAGE_POINTS;
      plan.close_reason = "gate108_execution_quarantine";
      plan.gate108 = true;
      plan.execution_contract.close_limit_override = 1;
      plan.execution_contract.close_identity_filter = true;
      plan.execution_contract.close_lane_id = LP_LANE_REVMA;
      plan.execution_contract.close_variant_id = LP_VARIANT_REVMA_REVERSION;
      plan.discovery_branch = LP_REVMA_BRANCH_R;
      plan.executable = true;
      plan.reason = "invalid_run_defensive_flatten";
      mandatory.Event("quarantine_close", "", 0, 0, 0, 0, 0, 0,
         plan.close_reason, plan.reason, false);
      LP_TradeExecutionResult execution;
      router.Execute(plan, receipts, execution);
      mandatory.Event("order_result", plan.symbol, 0, 0, 0,
         execution.order_ticket, execution.deal_ticket,
         execution.position_ticket, plan.close_reason, execution.detail,
         execution.order_send_attempted);
      if(execution.accepted)
         mandatory.Event("close_committed", plan.symbol, 0, 0, 0,
            execution.order_ticket, execution.deal_ticket,
            execution.position_ticket, plan.close_reason, execution.detail,
            execution.order_send_attempted);
      if(!RememberRoutedDealSet(plan, execution))
         receipts.Write(LP_RECEIPT_ERROR, "",
            "gate108_quarantine_deal_linkage_failed", execution.detail,
            0, 0, 0, 0, 0, 0);
      if(execution.order_send_attempted || execution.deal_count > 0 ||
         execution.order_ticket > 0 || execution.position_ticket > 0)
      {
         position_index.MarkDirty();
         portfolio_dirty = true;
      }
      return true;
   }

   bool FinalizeDealAudit(ulong &final_deal_count, ulong &final_deal_hash,
      bool &final_contamination, bool &exact_sets)
   {
      ulong final_tickets[];
      final_deal_count = 0;
      final_deal_hash = 0;
      final_contamination = false;
      exact_sets = false;
      bool incremental_clean = Canonicalize(m_incremental_deal_tickets,
         m_incremental_deal_count, m_incremental_deal_hash,
         m_account_deal_contamination);
      bool routed_contamination = false;
      bool routed_clean = Canonicalize(m_routed_deal_tickets,
         m_routed_deal_count, m_routed_deal_hash, routed_contamination);
      bool final_clean = FinalAccountAudit(final_tickets, final_deal_count,
         final_deal_hash, final_contamination);
      exact_sets = TicketSetsEqual(m_incremental_deal_tickets,
         m_incremental_deal_count, m_routed_deal_tickets,
         m_routed_deal_count) &&
         TicketSetsEqual(m_incremental_deal_tickets,
            m_incremental_deal_count, final_tickets, final_deal_count);
      m_account_deal_contamination = m_account_deal_contamination ||
         routed_contamination || final_contamination;
      return incremental_clean && routed_clean && final_clean;
   }
};

#endif // __LIMNI_PORTFOLIO_REVMA_EXECUTION_BOUNDARY_MQH__
