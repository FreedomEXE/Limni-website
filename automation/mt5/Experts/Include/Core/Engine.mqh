/*-----------------------------------------------
  LimniPortfolioEA central orchestration
-----------------------------------------------*/
#ifndef __LIMNI_PORTFOLIO_ENGINE_MQH__
#define __LIMNI_PORTFOLIO_ENGINE_MQH__

#include "BuildInfo.mqh"
#include "Types.mqh"
#include "Config.mqh"
#include "SymbolUniverse.mqh"
#include "..\\Market\\SessionCalendar.mqh"
#include "..\\Market\\NewsCalendar.mqh"
#include "..\\Market\\SymbolSpecCache.mqh"
#include "..\\Market\\TickBarCache.mqh"
#include "..\\Market\\M1Clock.mqh"
#include "..\\Signals\\RevmaSignalState.mqh"
#include "..\\Strategies\\Revma\\RevmaAdapter.mqh"
#include "..\\Strategies\\Revma\\RevmaLifecycleGate.mqh"
#include "..\\Strategies\\Revma\\RevmaReceipts.mqh"
#include "..\\Strategies\\Revma\\RevmaVisualReporter.mqh"
#include "..\\Strategies\\Revma\\RevmaDiscoveryValuation.mqh"
#include "..\\Strategies\\IntentBus.mqh"
#include "..\\Portfolio\\PositionIndex.mqh"
#include "..\\Portfolio\\PositionCommissionCache.mqh"
#include "..\\Portfolio\\GridBook.mqh"
#include "..\\Portfolio\\PortfolioState.mqh"
#include "..\\Portfolio\\CurrencyExposureGuard.mqh"
#include "..\\Portfolio\\AccountHarvestGuard.mqh"
#include "..\\Portfolio\\PortfolioStopTakeProfitGuard.mqh"
#include "..\\Portfolio\\RiskArbiter.mqh"
#include "..\\Execution\\MagicCodec.mqh"
#include "..\\Execution\\TradeRouter.mqh"
#include "..\\Receipts\\ReceiptWriter.mqh"
#include "..\\Receipts\\RunManifest.mqh"
#include "..\\Receipts\\MandatoryDiagnostics.mqh"
#include "..\\Receipts\\DecisionLog.mqh"
#include "..\\Receipts\\StateSnapshot.mqh"
#include "..\\Receipts\\RuntimeTelemetry.mqh"

class LP_Engine
{
private:
   LP_Config m_config;
   ulong m_config_hash;
   ulong m_symbol_universe_hash;
   bool m_initialized;
   bool m_gate108_research_active;
   int m_step_count;
   int m_tick_count;
   int m_timer_count;
   int m_total_new_bars;
   int m_total_closed_m1_cycles;
   int m_total_intents;
   int m_total_position_grid_refreshes;
   int m_total_grid_exit_scans;
   int m_total_tp_sync_scans;
   ulong m_total_revma_symbol_evaluations;
   ulong m_next_system_intent_id;
   uint m_started_tick_count;
   ulong m_last_attribution_hash;
   ulong m_last_currency_exposure_hash;
   ulong m_last_grid_inventory_hash;
   ulong m_last_revma_tp_sync_scan_hash;
   int m_closed_m1_cycles_since_tp_sync;
   bool m_cached_portfolio_valid;
   bool m_portfolio_dirty;
   bool m_stop_take_profit_liquidation_active;
   bool m_fatal_invariant_latched;
   int m_cached_positions_total;
   datetime m_last_tester_chart_closed_m1_time;
   datetime m_pending_cohort_first_seen_time;
   datetime m_pending_cohort_target_m1_time;
   long m_gate108_run_start_msc;
   ulong m_gate108_baseline_deal_tickets[];
   ulong m_gate108_baseline_deal_count;
   ulong m_gate108_incremental_deal_tickets[];
   ulong m_gate108_incremental_deal_count;
   int m_gate108_incremental_deal_capacity;
   ulong m_gate108_incremental_deal_hash;
   ulong m_gate108_routed_deal_tickets[];
   ulong m_gate108_routed_deal_count;
   int m_gate108_routed_deal_capacity;
   ulong m_gate108_routed_deal_hash;
   bool m_gate108_account_deal_contamination;
   bool m_gate108_account_deal_mutation_observed;
   bool m_gate108_execution_quarantine_active;
   bool m_gate108_execution_quarantine_flat_confirmed;
   ulong m_gate108_execution_quarantine_steps;
   string m_gate108_execution_quarantine_reason;
   bool m_mandatory_history_waiting;
   ulong m_last_mandatory_inventory_hash;
   LP_PortfolioState m_cached_portfolio;

   LP_ReceiptWriter m_receipts;
   LP_MandatoryDiagnostics m_mandatory;
   LP_RuntimeTelemetry m_runtime_telemetry;
   LP_SymbolSpecCache m_symbol_cache;
   LP_NewsCalendar m_news_calendar;
   LP_TickBarCache m_tick_cache;
   LP_M1Clock m_clock;
   LP_RevmaSignalState m_revma_state;
   LP_RevmaAdapter m_revma_adapter;
   LP_RevmaLifecycleGate m_revma_lifecycle_gate;
   LP_RevmaVisualReporter m_revma_visual_reporter;
   LP_IntentBus m_intent_bus;
   LP_PositionCommissionCache m_position_commission_cache;
   LP_PositionIndex m_position_index;
   LP_GridBook m_grid_book;
   LP_CurrencyExposureGuard m_currency_guard;
   LP_AccountHarvestGuard m_account_guard;
   LP_PortfolioStopTakeProfitGuard m_stop_take_profit_guard;
   LP_RiskArbiter m_risk_arbiter;
   LP_TradeRouter m_trade_router;

   bool Gate108ResearchRun()
   {
      return m_config.enable_revma_system &&
         m_config.revma_universe_mode == LP_UNIVERSE_FX28;
   }

   bool SinglePairRun()
   {
      return m_config.revma_universe_mode == LP_UNIVERSE_CURRENT_CHART;
   }

   bool OperatorSurfaceValid(string &reason)
   {
      reason = "";
      if(m_config.execution_mode == LP_EXECUTION_LIVE_ALLOWED &&
         !m_config.allow_live_trading)
      {
         reason = "live_execution_requires_allow_live_trading";
         return false;
      }
      if(m_config.enable_kyma_system)
      {
         reason = "system_lane_not_implemented:Kyma";
         return false;
      }
      if(m_config.enable_katarakti_system)
      {
         reason = "system_lane_not_implemented:Katarakti";
         return false;
      }
      return true;
   }

   string OperatorIdentityText()
   {
       return "EA: " + LP_EA_DisplayName() +
         " | version=" + LP_EA_VERSION +
         " | source_bundle=" + LP_EA_SourceBundleShort() +
         "\nActive Systems: " + LP_ActiveSystemsText(
            m_config.enable_revma_system,
            m_config.enable_kyma_system,
            m_config.enable_katarakti_system) +
         "\nUniverse: " + LP_UniverseDisplayName(
            m_config.revma_universe_mode) +
         "\nExecution: " + LP_ExecutionModeName(
            m_config.execution_mode) +
         "\nResearch Build: " + LP_BUILD_GATE;
   }

   bool LiveNewsBarrierFails()
   {
      if(m_config.execution_mode != LP_EXECUTION_LIVE_ALLOWED)
         return false;
      if(m_config.news_guard_mode == LP_NEWS_GUARD_DISABLED)
         return true;
      if(!LP_NewsSourceConfigured(m_config))
         return true;
      return false;
   }

   bool LiveSchedulerBarrierFails()
   {
      return m_config.execution_mode == LP_EXECUTION_LIVE_ALLOWED &&
         !m_config.use_timer_watchdog;
   }

   void WriteError(const string status, const string message)
   {
      m_receipts.Write(LP_RECEIPT_ERROR, "", status, message, 0, 0, 0, 0, 0, 0);
      m_mandatory.Event("error", "", 0, 0, 0, 0, 0, 0, status, message, false);
      Print(LP_EA_NAME, " ", status, ": ", message);
   }

   bool CloseAction(const int action)
   {
      return action == LP_INTENT_CLOSE_GRID ||
         action == LP_INTENT_CLOSE_ALL_EA ||
         action == LP_INTENT_REDUCE_GRID;
   }

   void FailInitialization(const string reason)
   {
      m_mandatory.FirstBlocker("initialization", "", 0, "", 0, 0, 0, 0,
         reason);
      m_mandatory.Event("initialization_failed", "", 0, 0, 0, 0, 0, 0,
         reason, "", false);
      m_mandatory.Complete("FAIL", reason, PositionsTotal(), OrdersTotal(),
         AccountInfoDouble(ACCOUNT_BALANCE), AccountInfoDouble(ACCOUNT_EQUITY),
         false);
      m_mandatory.Close();
   }

   void LatchFatalInvariant(const string reason)
   {
      if(m_fatal_invariant_latched)
         return;
      string first_reason = reason == "" ?
         "fatal_invariant_unspecified" : reason;
      m_mandatory.FirstBlocker("fatal_invariant", "", 0, "", 0, 0, 0, 0,
         first_reason);
      m_mandatory.Event("fatal_invariant", "", 0, 0, 0, 0, 0, 0,
         first_reason, "", false);
      if(m_gate108_research_active && m_initialized &&
         !m_gate108_execution_quarantine_active &&
         (PositionsTotal() > 0 || OrdersTotal() > 0))
      {
         m_gate108_execution_quarantine_active = true;
         m_gate108_execution_quarantine_flat_confirmed = false;
         m_gate108_execution_quarantine_reason = first_reason;
         m_mandatory.Event("quarantine_start", "", 0, 0, 0, 0, 0, 0,
            m_gate108_execution_quarantine_reason,
            "owner=gate108_execution_quarantine", false);
         WriteError("gate108_execution_quarantine_latched",
            m_gate108_execution_quarantine_reason);
      }
      m_fatal_invariant_latched = true;
      if(m_gate108_research_active)
         m_revma_adapter.InvalidateRevmaDiscovery(first_reason);
      WriteError("fatal_invariant_latched", first_reason);
   }

   ulong NextSystemIntentId()
   {
      ulong id = m_next_system_intent_id;
      m_next_system_intent_id++;
      return id;
   }

   bool TesterRuntime()
   {
      return LP_IsTesterRuntime();
   }

   bool TesterClosedM1ScanDue()
   {
      if(!TesterRuntime())
         return true;

      datetime closed_m1_time = iTime(_Symbol, PERIOD_M1, 1);
      if(closed_m1_time <= 0)
         return true;

      if(m_last_tester_chart_closed_m1_time == 0)
      {
         m_last_tester_chart_closed_m1_time = closed_m1_time;
         return true;
      }

      if(closed_m1_time == m_last_tester_chart_closed_m1_time)
         return false;

      m_last_tester_chart_closed_m1_time = closed_m1_time;
      return true;
   }

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

   bool Gate108SymbolExecutionContractValid(string &reason)
   {
      reason = "";
      for(int i = 0; i < m_symbol_cache.Count(); i++)
      {
         LP_SymbolMeta meta;
         if(!m_symbol_cache.Get(i, meta))
         {
            reason = "gate108_symbol_spec_cache_read_failed";
            return false;
         }
         if(!LP_RevmaSymbolActive(m_config, meta, _Symbol))
            continue;
         double atom = LP_REVMA_DISCOVERY_ATOM_LOTS;
         long atom_units = VolumeStepUnits(atom, meta.lot_step);
         double normalized_atom = (double)atom_units * meta.lot_step;
         long filling_mode = (long)SymbolInfoInteger(meta.broker_symbol,
            SYMBOL_FILLING_MODE);
         bool fok_supported =
            (filling_mode & SYMBOL_FILLING_FOK) == SYMBOL_FILLING_FOK;
         if(!meta.tradable || meta.trade_mode != SYMBOL_TRADE_MODE_FULL ||
            meta.point <= 0.0 || meta.tick_size <= 0.0 ||
            meta.contract_size <= 0.0 || meta.min_lot <= 0.0 ||
            meta.max_lot < atom || meta.lot_step <= 0.0 ||
            atom + 0.000000001 < meta.min_lot ||
            atom_units <= 0 ||
            MathAbs(normalized_atom - atom) > 0.000000001 ||
            meta.base_ccy < 0 || meta.base_ccy >= LP_CCY_COUNT ||
            meta.quote_ccy < 0 || meta.quote_ccy >= LP_CCY_COUNT ||
            meta.base_ccy == meta.quote_ccy || !fok_supported)
         {
            reason = "gate108_symbol_execution_contract_invalid:" +
               meta.canonical_symbol;
            return false;
         }
      }
      return true;
   }

   bool AppendGate108DealTicket(
      ulong &tickets[],
      ulong &count,
      int &capacity,
      const ulong ticket)
   {
      if(ticket == 0 || count >=
            (ulong)LP_REVMA_DISCOVERY_MINOR_ABS_LIMIT ||
         count > 2147483646)
         return false;
      if((int)count >= capacity)
      {
         int next_capacity = capacity <= 0 ? 64 : capacity * 2;
         if(next_capacity <= capacity || next_capacity < 0 ||
            ArrayResize(tickets, next_capacity, next_capacity) !=
               next_capacity)
            return false;
         capacity = next_capacity;
      }
      tickets[(int)count] = ticket;
      count++;
      return true;
   }

   bool SortAndValidateGate108DealTickets(
      ulong &tickets[],
      const ulong count)
   {
      if(count > 2147483647 ||
         ArrayResize(tickets, (int)count) != (int)count)
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

   bool Gate108DealTicketSetsEqual(
      ulong &left[],
      const ulong left_count,
      ulong &right[],
      const ulong right_count)
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

   bool Gate108BaselineContainsDeal(const ulong ticket)
   {
      int left = 0;
      int right = (int)m_gate108_baseline_deal_count - 1;
      while(left <= right)
      {
         int middle = left + (right - left) / 2;
         if(m_gate108_baseline_deal_tickets[middle] == ticket)
            return true;
         if(m_gate108_baseline_deal_tickets[middle] < ticket)
            left = middle + 1;
         else
            right = middle - 1;
      }
      return false;
   }

   bool CaptureGate108AccountHistoryBaseline()
   {
      m_gate108_run_start_msc = (long)TimeCurrent() * 1000;
      m_gate108_baseline_deal_count = 0;
      ArrayResize(m_gate108_baseline_deal_tickets, 0);
      if(m_gate108_run_start_msc <= 0 ||
         !HistorySelect((datetime)0, TimeCurrent() + 60))
         return false;
      int total = HistoryDealsTotal();
      if(total < 0 || ArrayResize(m_gate108_baseline_deal_tickets,
            total) != total)
         return false;
      for(int i = 0; i < total; i++)
      {
         ulong ticket = HistoryDealGetTicket(i);
         if(ticket == 0)
            return false;
         m_gate108_baseline_deal_tickets[(int)
            m_gate108_baseline_deal_count] = ticket;
         m_gate108_baseline_deal_count++;
      }
      return SortAndValidateGate108DealTickets(
         m_gate108_baseline_deal_tickets,
         m_gate108_baseline_deal_count);
   }

   bool MixGate108DealIdentity(const ulong ticket, ulong &hash,
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
      ulong deal_position = (ulong)HistoryDealGetInteger(ticket,
         DEAL_POSITION_ID);
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
         LP_CanonicalSymbol(parts.symbol_id) +
            m_config.broker_symbol_suffix : "";
      bool order_clean = deal_order > 0 &&
         HistoryOrderSelect(deal_order) &&
         HistoryOrderGetInteger(deal_order, ORDER_MAGIC) == deal_magic &&
         HistoryOrderGetString(deal_order, ORDER_SYMBOL) == deal_symbol;
      bool managed_revma = decoded &&
         parts.lane_id == LP_LANE_REVMA &&
         parts.variant_id == LP_VARIANT_REVMA_REVERSION &&
         parts.symbol_id >= 0 && parts.symbol_id < LP_SYMBOL_COUNT &&
         (parts.direction == LP_SIDE_LONG ||
          parts.direction == LP_SIDE_SHORT) &&
         (opening || closing) && deal_type == expected_type &&
         deal_reason == DEAL_REASON_EXPERT &&
         deal_symbol == expected_symbol && deal_position > 0 &&
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

   bool CanonicalizeGate108DealSet(
      ulong &tickets[],
      const ulong deal_count,
      ulong &deal_hash,
      bool &contamination)
   {
      deal_hash = LP_HashString("gate108_account_deal_set_v1");
      contamination = false;
      if(deal_hash == 0 ||
         !SortAndValidateGate108DealTickets(tickets, deal_count))
         return false;
      for(int i = 0; i < (int)deal_count; i++)
      {
         if(!MixGate108DealIdentity(tickets[i], deal_hash, contamination))
            return false;
      }
      return deal_hash != 0;
   }

   bool RememberGate108RoutedDealSet(
      const LP_TradePlan &plan,
      const LP_TradeExecutionResult &execution)
   {
      if(!plan.gate108)
         return true;
      if(execution.deal_count <= 0)
         return true;
      bool quarantine_close = plan.action == LP_INTENT_CLOSE_ALL_EA &&
         plan.close_reason == "gate108_execution_quarantine";
      if(!plan.gate108 ||
         (plan.action != LP_INTENT_OPEN_GRID &&
          plan.action != LP_INTENT_ADD_GRID_LEG &&
          plan.action != LP_INTENT_CLOSE_GRID && !quarantine_close) ||
         execution.deal_count > LP_MAX_EXECUTION_DEAL_TICKETS)
         return false;
      for(int i = 0; i < execution.deal_count; i++)
      {
         if(!AppendGate108DealTicket(m_gate108_routed_deal_tickets,
               m_gate108_routed_deal_count,
               m_gate108_routed_deal_capacity,
               execution.canonical_deal_tickets[i]))
            return false;
      }
      return true;
   }

   bool FinalGate108AccountDealAudit(
      ulong &deal_tickets[],
      ulong &deal_count,
      ulong &deal_hash,
      bool &contamination)
   {
      deal_count = 0;
      deal_hash = 0;
      contamination = false;
      ArrayResize(deal_tickets, 0);
      if(m_gate108_run_start_msc <= 0 ||
         !HistorySelect((datetime)0, TimeCurrent() + 60))
         return false;
      int total = HistoryDealsTotal();
      if(total < 0 || ArrayResize(deal_tickets, total) != total)
         return false;
      for(int i = 0; i < total; i++)
      {
         ulong ticket = HistoryDealGetTicket(i);
         if(ticket == 0)
            return false;
         if(Gate108BaselineContainsDeal(ticket))
            continue;
         deal_tickets[(int)deal_count] = ticket;
         deal_count++;
      }
      return CanonicalizeGate108DealSet(deal_tickets, deal_count,
         deal_hash, contamination);
   }

   void EnterGate108ExecutionQuarantine(const string reason)
   {
      if(!m_gate108_research_active)
      {
         WriteError("gate108_path_ignored_outside_fx28", reason);
         return;
      }
      if(!m_gate108_execution_quarantine_active)
      {
         m_gate108_execution_quarantine_active = true;
         m_gate108_execution_quarantine_flat_confirmed = false;
         m_gate108_execution_quarantine_reason = reason == "" ?
            "gate108_execution_quarantine_unspecified" : reason;
         m_mandatory.Event("close_owner_latch", "", 0, 0, 0, 0, 0, 0,
            m_gate108_execution_quarantine_reason,
            "owner=gate108_execution_quarantine", false);
         WriteError("gate108_execution_quarantine_latched",
            m_gate108_execution_quarantine_reason);
      }
      LatchFatalInvariant(m_gate108_execution_quarantine_reason);
   }

   void RunGate108ExecutionQuarantineStep()
   {
      if(!m_gate108_execution_quarantine_active)
         return;
      if(m_gate108_execution_quarantine_steps >=
         (ulong)LP_REVMA_DISCOVERY_MINOR_ABS_LIMIT)
      {
         WriteError("gate108_execution_quarantine_counter_overflow",
            m_gate108_execution_quarantine_reason);
         return;
      }
      m_gate108_execution_quarantine_steps++;

      int pending_matched = 0;
      int pending_deleted = 0;
      int pending_failed = 0;
      int pending_foreign = 0;
      bool pending_clean = m_trade_router.CancelGate108ManagedPendingOrders(
         m_receipts, pending_matched, pending_deleted, pending_failed,
         pending_foreign);
      m_position_index.MarkDirty();
      m_portfolio_dirty = true;
      LP_PortfolioState portfolio;
      RefreshPortfolioAndGrid(portfolio);

      bool foreign_inventory = portfolio.external_position_count != 0 ||
         portfolio.unknown_managed_position_count != 0 ||
         portfolio.entry_group_position_count != 0 ||
         portfolio.managed_position_count !=
            portfolio.grid_group_position_count || pending_foreign != 0;
      if(foreign_inventory)
      {
         WriteError("gate108_execution_quarantine_account_contamination",
            "external=" + IntegerToString(
               portfolio.external_position_count) +
            "|unknown_managed=" + IntegerToString(
               portfolio.unknown_managed_position_count) +
            "|entry_group=" + IntegerToString(
               portfolio.entry_group_position_count) +
            "|foreign_orders=" + IntegerToString(pending_foreign));
         return;
      }

      if(portfolio.managed_position_count == 0 && OrdersTotal() == 0)
      {
         m_gate108_execution_quarantine_active = false;
         m_gate108_execution_quarantine_flat_confirmed = true;
         m_receipts.Write(LP_RECEIPT_ERROR, "",
            "gate108_execution_quarantine_flat_confirmed",
            "steps=" + (string)m_gate108_execution_quarantine_steps +
               "|reason=" + m_gate108_execution_quarantine_reason,
            0, 0, 0, 0, 0, 0);
         m_mandatory.Event("confirmed_flat", "", 0, 0, 0, 0, 0, 0,
            m_gate108_execution_quarantine_reason,
            "owner=gate108_execution_quarantine", false);
         return;
      }
      if(!pending_clean || OrdersTotal() != 0 ||
         portfolio.managed_position_count <= 0)
         return;

      LP_TradePlan plan;
      LP_ResetTradePlan(plan);
      plan.intent_id = NextSystemIntentId();
      plan.action = LP_INTENT_CLOSE_ALL_EA;
      plan.max_slippage_points =
         (double)LP_REVMA_DISCOVERY_MAX_SLIPPAGE_POINTS;
      plan.close_reason = "gate108_execution_quarantine";
      plan.gate108 = true;
      plan.discovery_branch = LP_REVMA_BRANCH_R;
      plan.executable = true;
      plan.reason = "invalid_run_defensive_flatten";
      m_mandatory.Event("quarantine_close", "", 0, 0, plan.intent_id, 0,
         0, 0, plan.close_reason, plan.reason, false);
      LP_TradeExecutionResult execution;
      m_trade_router.Execute(plan, m_receipts, execution);
      m_mandatory.Event("order_result", plan.symbol, 0, 0, plan.intent_id,
         execution.order_ticket, execution.deal_ticket,
         execution.position_ticket, plan.close_reason, execution.detail,
         execution.order_send_attempted);
      if(execution.accepted)
         m_mandatory.Event("close_committed", plan.symbol, 0, 0,
            plan.intent_id, execution.order_ticket, execution.deal_ticket,
            execution.position_ticket, plan.close_reason, execution.detail,
            execution.order_send_attempted);
      if(!RememberGate108RoutedDealSet(plan, execution))
         WriteError("gate108_quarantine_deal_linkage_failed",
            execution.detail);
      if(execution.order_send_attempted || execution.deal_count > 0 ||
         execution.order_ticket > 0 || execution.position_ticket > 0)
      {
         m_position_index.MarkDirty();
         m_portfolio_dirty = true;
      }
   }

   void RefreshPortfolioAndGrid(LP_PortfolioState &portfolio)
   {
      ulong started_at = m_runtime_telemetry.Start();
      m_position_commission_cache.BeginRefresh();
      m_position_index.BuildPortfolioStateAndGridBook(
         m_config_hash,
         portfolio,
         m_grid_book,
         m_position_commission_cache,
         m_currency_guard,
         m_receipts
      );
      m_position_commission_cache.EndRefresh();
      m_total_position_grid_refreshes++;
      m_cached_portfolio = portfolio;
      m_cached_portfolio_valid = true;
      m_portfolio_dirty = false;
      m_cached_positions_total = PositionsTotal();
      m_receipts.ObservePortfolioState(portfolio);
      if(m_mandatory.Opened() &&
         (m_last_mandatory_inventory_hash == 0 ||
          m_last_mandatory_inventory_hash != portfolio.position_snapshot_hash))
      {
         m_mandatory.Event("inventory_reconciliation", "", portfolio.asof,
            0, 0, 0, 0, 0, "",
            "positions=" + IntegerToString(portfolio.open_position_count) +
            "|managed=" + IntegerToString(portfolio.managed_position_count) +
            "|grid=" + IntegerToString(portfolio.grid_group_position_count) +
            "|external=" + IntegerToString(portfolio.external_position_count) +
            "|unknown_managed=" + IntegerToString(
               portfolio.unknown_managed_position_count) +
            "|snapshot_hash=" + (string)portfolio.position_snapshot_hash,
            false);
         m_last_mandatory_inventory_hash = portfolio.position_snapshot_hash;
      }
      m_runtime_telemetry.ObserveElapsed(LP_RUNTIME_INVENTORY_REFRESH, started_at);
   }

   void WriteRuntimeProfileSummary()
   {
      double elapsed_seconds = 0.0;
      if(m_started_tick_count > 0)
         elapsed_seconds = (double)(GetTickCount() - m_started_tick_count) / 1000.0;
      ulong broker_tp_sync_ticket_scans = m_revma_adapter.RevmaBrokerTpSyncTicketScanCount() +
         m_trade_router.BrokerTpSyncTicketScanCount();

      m_receipts.Summary("runtime_profile_total_engine_steps", IntegerToString(m_step_count));
      m_receipts.Summary("runtime_profile_total_ticks", IntegerToString(m_tick_count));
      m_receipts.Summary("runtime_profile_total_timers", IntegerToString(m_timer_count));
      m_receipts.Summary("runtime_profile_closed_m1_evaluation_cycles", IntegerToString(m_total_closed_m1_cycles));
      m_receipts.Summary("runtime_profile_total_new_bars", IntegerToString(m_total_new_bars));
      m_receipts.Summary("runtime_profile_position_grid_refreshes", IntegerToString(m_total_position_grid_refreshes));
      m_receipts.Summary("runtime_profile_inventory_exact_full_scans", (string)m_position_index.ExactFullScanCount());
      m_receipts.Summary("runtime_profile_inventory_cached_market_reprices", (string)m_position_index.CachedMarketRepriceCount());
      m_receipts.Summary("runtime_profile_inventory_cached_position_profit_reprices", (string)m_position_index.CachedMarketRepriceCount());
      m_receipts.Summary("runtime_profile_inventory_cache_valuation_basis", "authoritative_POSITION_PROFIT_by_cached_position_order");
      m_receipts.Summary("runtime_profile_inventory_position_profit_reads", (string)m_grid_book.PositionProfitReadCount());
      m_receipts.Summary("runtime_profile_inventory_position_profit_read_failures", (string)m_grid_book.PositionProfitReadFailureCount());
      m_receipts.Summary("runtime_profile_inventory_cache_active_at_end", LP_BoolText(m_position_index.TesterCacheActive()));
      m_receipts.Summary("runtime_profile_inventory_cache_validations", (string)m_position_index.CacheValidationCount());
      m_receipts.Summary("runtime_profile_inventory_cache_validation_passes", (string)m_position_index.CacheValidationPassCount());
      m_receipts.Summary("runtime_profile_inventory_cache_validation_failures", (string)m_position_index.CacheValidationFailureCount());
      m_receipts.Summary("runtime_profile_inventory_cache_runtime_fallbacks", (string)m_position_index.CacheRuntimeFallbackCount());
      m_receipts.Summary("runtime_profile_inventory_cache_structural_checkpoints", (string)m_position_index.CacheStructuralCheckpointCount());
      m_receipts.Summary("runtime_profile_inventory_cache_daily_checkpoints", (string)m_position_index.CacheDailyCheckpointCount());
      m_receipts.Summary("runtime_profile_inventory_cache_invalidations", (string)m_position_index.CacheInvalidationCount());
      m_receipts.Summary("runtime_profile_inventory_cache_validation_tolerance", DoubleToString(m_position_index.CacheValidationTolerance(), 8));
      m_receipts.Summary("runtime_profile_inventory_cache_max_validation_difference", DoubleToString(m_position_index.CacheMaxValidationDifference(), 8));
      m_receipts.Summary("runtime_profile_inventory_cache_structure_mismatch_positions", IntegerToString(m_position_index.CacheStructureMismatchPositions()));
      m_receipts.Summary("runtime_profile_inventory_leg_allocation_failures", (string)m_grid_book.LegAllocationFailureCount());
      m_receipts.Summary("runtime_profile_inventory_leg_index_build_failures", (string)m_grid_book.LegIndexBuildFailureCount());
      m_receipts.Summary("runtime_profile_inventory_cache_last_reason", m_position_index.CacheLastReason());
      m_receipts.Summary("runtime_profile_commission_cache_hits", (string)m_position_commission_cache.CacheHitCount());
      m_receipts.Summary("runtime_profile_commission_cache_misses", (string)m_position_commission_cache.CacheMissCount());
      m_receipts.Summary("runtime_profile_commission_history_reads", (string)m_position_commission_cache.HistoryReadCount());
      m_receipts.Summary("runtime_profile_commission_targeted_invalidations", (string)m_position_commission_cache.TargetedInvalidationCount());
      m_receipts.Summary("runtime_profile_commission_full_invalidations", (string)m_position_commission_cache.FullInvalidationCount());
      m_receipts.Summary("runtime_profile_commission_cache_allocation_failures", (string)m_position_commission_cache.AllocationFailureCount());
      m_receipts.Summary("runtime_profile_fx28_symbol_evaluations", (string)m_total_revma_symbol_evaluations);
      m_receipts.Summary("runtime_profile_grid_exit_scans", IntegerToString(m_total_grid_exit_scans));
      m_receipts.Summary("runtime_profile_tp_sync_scans", IntegerToString(m_total_tp_sync_scans));
      m_receipts.Summary("runtime_profile_broker_tp_sync_ticket_scans", (string)broker_tp_sync_ticket_scans);
      m_receipts.Summary("runtime_profile_broker_tp_modify_attempts", (string)m_trade_router.BrokerTpModifyAttemptCount());
      m_receipts.Summary("runtime_profile_order_open_attempts", (string)m_trade_router.OrderOpenAttemptCount());
      m_receipts.Summary("runtime_profile_order_close_attempts", (string)m_trade_router.OrderCloseAttemptCount());
      m_receipts.Summary("runtime_profile_receipt_writes", (string)m_receipts.ReceiptWriteCount());
      m_receipts.Summary("runtime_profile_summary_writes", (string)m_receipts.SummaryWriteCount());
      m_receipts.Summary("runtime_profile_flushes", (string)m_receipts.FlushCount());
      m_receipts.Summary("runtime_profile_compact_rows_skipped", (string)m_receipts.CompactSkippedRows());
      m_receipts.Summary("runtime_profile_elapsed_wall_seconds", DoubleToString(elapsed_seconds, 3));
      m_receipts.Summary("runtime_profile_tester_fast_cadence", LP_BoolText(TesterRuntime()));
      m_runtime_telemetry.WriteSummary(m_receipts);
      Print(
          LP_EA_DisplayName(),
         " runtime_profile|elapsed_wall_seconds=",
         DoubleToString(elapsed_seconds, 3),
         "|total_ticks=",
         IntegerToString(m_tick_count),
         "|closed_m1_cycles=",
         IntegerToString(m_total_closed_m1_cycles),
         "|position_grid_refreshes=",
         IntegerToString(m_total_position_grid_refreshes),
         "|fx28_symbol_evaluations=",
         (string)m_total_revma_symbol_evaluations,
         "|grid_exit_scans=",
         IntegerToString(m_total_grid_exit_scans),
         "|broker_tp_sync_scans=",
         IntegerToString(m_total_tp_sync_scans),
         "|broker_tp_sync_ticket_scans=",
         (string)broker_tp_sync_ticket_scans,
         "|broker_tp_modify_attempts=",
         (string)m_trade_router.BrokerTpModifyAttemptCount(),
         "|order_open_attempts=",
         (string)m_trade_router.OrderOpenAttemptCount(),
         "|order_close_attempts=",
         (string)m_trade_router.OrderCloseAttemptCount()
      );
   }

   void WritePortfolioQStateReceipt(
      const LP_PortfolioQStateSnapshot &snapshot,
      const string status
   )
   {
      m_receipts.Write(
         LP_RECEIPT_PORTFOLIO_Q_STATE,
         "",
         status,
         "formula_id=" + LimniQStateFormulaId() +
            "|formula_hash=" + (string)LimniQStateFormulaHash() +
            "|portfolio_asof_m1_time=" + LP_Stamp(snapshot.asof_m1_time) +
            "|valid_pair_count=" + IntegerToString(snapshot.valid_pair_count) +
            "|expected_pair_count=" + IntegerToString(snapshot.expected_pair_count) +
            "|snapshot_hash=" + (string)snapshot.snapshot_hash +
            "|valid=" + LP_BoolText(snapshot.valid) +
            "|reason_code=" + snapshot.reason_code +
            "|detail=" + snapshot.detail,
         0,
         0,
         snapshot.snapshot_hash,
         0,
         0,
         0
      );
   }

   void WriteQStateReceipt(const LP_SignalSnapshot &signal)
   {
      m_receipts.Write(
         LP_RECEIPT_Q_STATE,
         signal.symbol,
         LP_PairStateName(signal.pair_state),
         "variant_id=g99w-qstate-v001" +
            "|formula_id=" + signal.formula_id +
            "|formula_hash=" + (string)signal.formula_hash +
            "|source_m1_time=" + LP_Stamp(signal.source_m1_time) +
            "|portfolio_asof_m1_time=" + LP_Stamp(signal.portfolio_asof_m1_time) +
            "|portfolio_valid_pair_count=" + IntegerToString(signal.portfolio_valid_pair_count) +
            "|portfolio_snapshot_hash=" + (string)signal.portfolio_snapshot_hash +
            "|market_mode=" + LP_MarketModeName(signal.market_mode) +
            "|direction=" + IntegerToString(signal.direction) +
            "|confidence=" + DoubleToString(signal.confidence, 6) +
            "|reason_code=" + signal.reason_code +
            "|price=" + DoubleToString(signal.price, 5) +
            "|q=" + DoubleToString(signal.q, 8) +
            "|anchor=" + DoubleToString(signal.anchor, 5) +
            "|trend_persistence=" + DoubleToString(signal.trend_persistence, 6) +
            "|anchor_displacement=" + DoubleToString(signal.anchor_displacement, 6) +
            "|event_direction_persistence=" + DoubleToString(signal.event_direction_persistence, 6) +
            "|range_position=" + DoubleToString(signal.range_position, 6) +
            "|sweep_resolution=" + DoubleToString(signal.sweep_resolution, 6) +
            "|spread_cost_q=" + DoubleToString(signal.spread_cost_q, 6) +
            "|pair_q_score=" + DoubleToString(signal.pair_q_score, 6) +
            "|base_currency_score=" + DoubleToString(signal.base_currency_score, 6) +
            "|quote_currency_score=" + DoubleToString(signal.quote_currency_score, 6) +
            "|pair_direction_score=" + DoubleToString(signal.pair_direction_score, 6) +
            "|katarakti_signal=" + IntegerToString(signal.katarakti_signal) +
            "|event_count=" + IntegerToString(signal.event_count) +
            "|feature_hash=" + (string)signal.feature_hash +
            "|session_allowed=" + LP_BoolText(signal.session_allowed) +
            "|news_allowed=" + LP_BoolText(signal.news_allowed),
         signal.lane_id,
         signal.variant_id,
         0,
         0,
         0,
         0
      );
   }

   bool AddHarvestCloseIntent(const LP_HarvestDecision &harvest, LP_IntentBus &bus)
   {
      LP_TradeIntent intent;
      LP_ResetTradeIntent(intent);
      intent.intent_id = NextSystemIntentId();
      intent.symbol_id = -1;
      intent.symbol = "";
      intent.lane_id = LP_LANE_NONE;
      intent.variant_id = LP_VARIANT_NONE;
      intent.action = LP_INTENT_CLOSE_ALL_EA;
      intent.direction = LP_SIDE_NONE;
      intent.emitted_at = TimeCurrent();
      intent.source_bar_time = harvest.asof;
      intent.expires_at = 0;
      intent.requested_lots = 0.0;
      intent.max_slippage_points = 10.0;
      intent.take_profit_distance_price = 0.0;
      intent.stop_loss_distance_price = 0.0;
      intent.target_take_profit_price = 0.0;
      intent.target_stop_loss_price = 0.0;
      intent.stop_take_profit_basis = "";
      intent.priority = 100;
      intent.score = harvest.managed_floating_pnl;
      intent.grid_key = 0;
      intent.grid_tickets = "";
      intent.expected_grid_ticket_count = 0;
      intent.research_lifecycle_event = LP_RESEARCH_LIFECYCLE_NONE;
      intent.research_add_type = "";
      intent.close_reason = "account_hwm";
      intent.config_hash = m_config_hash;
      intent.strategy_version_hash = LP_HashString("gate99w_harvest_close_all_next_day_reentry");
      intent.human_reason = "portfolio_harvest_state=" + LP_HarvestStateName(harvest.state) +
         "|reason=" + harvest.reason +
         "|managed_floating_pnl=" + DoubleToString(harvest.managed_floating_pnl, 2) +
         "|hwm=" + DoubleToString(harvest.high_watermark_money, 2) +
         "|trail_floor=" + DoubleToString(harvest.trail_floor_money, 2);
      return bus.Add(intent);
   }

   int EvaluateRevmaSymbol(
      const LP_SymbolMeta &meta,
      const LP_HarvestDecision &harvest,
      const bool stop_take_profit_block_new_entries,
      const MqlRates &latest_bar
   )
   {
      ulong started_at = m_runtime_telemetry.Start();
      m_total_revma_symbol_evaluations++;
      LP_RevmaSignal signal;
      string detail = "";
      if(!m_revma_state.BuildSignalAtClosedBar(meta, m_config, latest_bar, signal, detail))
      {
         m_runtime_telemetry.ObserveElapsed(LP_RUNTIME_REVMA_SIGNAL_EVALUATION, started_at);
         return 0;
      }
      if(!signal.valid)
      {
         m_runtime_telemetry.ObserveElapsed(LP_RUNTIME_REVMA_SIGNAL_EVALUATION, started_at);
         return 0;
      }

      m_mandatory.Event("signal_created", signal.symbol, signal.source_m1_time,
         0, 0, 0, 0, 0, "valid_revma_signal",
         "direction=" + LP_RevmaDirectionName(signal.direction) +
         "|q=" + DoubleToString(signal.q, 8) +
         "|anchor=" + DoubleToString(signal.anchor, 8), false);

      LP_CalendarDecision calendar;
      LP_EvaluateCalendar(signal.source_m1_time, m_config, calendar);
      m_news_calendar.Apply(signal.source_m1_time, meta, m_config, calendar);
      if(calendar.week_boundary_blocked || calendar.news_blocked)
      {
         m_mandatory.Event("risk_decision", signal.symbol,
            signal.source_m1_time, 0, 0, 0, 0, 0,
            calendar.news_blocked ? "news_blocked" : "session_blocked",
            "calendar_reason=" + calendar.reason, false);
         m_runtime_telemetry.ObserveElapsed(LP_RUNTIME_REVMA_SIGNAL_EVALUATION, started_at);
         return 0;
      }

      int emitted = 0;
      if(m_config.enable_strategy_evaluation)
      {
         LP_GridInventoryRow active_grid;
         bool has_active_grid = m_grid_book.FindSymbolLaneGrid(signal.symbol_id, LP_LANE_REVMA, active_grid);
         bool birth_allowed = false;
         bool reentry_gate_open = m_revma_lifecycle_gate.Evaluate(signal, has_active_grid, m_receipts, birth_allowed);
         m_mandatory.Event("birth_gate_decision", signal.symbol,
            signal.source_m1_time, 0, 0, 0, 0, 0,
            birth_allowed && reentry_gate_open ? "allowed" : "blocked",
            "reentry_gate_open=" + LP_BoolText(reentry_gate_open) +
            "|birth_allowed=" + LP_BoolText(birth_allowed) +
            "|has_active_grid=" + LP_BoolText(has_active_grid), false);
         if(reentry_gate_open && !harvest.block_new_entries && !stop_take_profit_block_new_entries)
         {
            if(birth_allowed)
               m_revma_lifecycle_gate.WriteReceipt(m_receipts, signal, "revma_grid_birth_allowed", "fresh_state_change_gate_open", false);
            emitted = m_revma_adapter.EvaluateRevma(signal, m_config, m_grid_book, m_receipts, m_intent_bus, birth_allowed);
         }
      }

       string dashboard_text = OperatorIdentityText() + "\n" +
          m_revma_adapter.RevmaVisualDashboardText();
      if(m_revma_visual_reporter.UpdateRequired(m_config, dashboard_text, emitted > 0))
      {
         bool screenshot_requested = m_revma_adapter.ConsumeRevmaDashboardScreenshotRequest();
         double centerline_price = m_revma_adapter.RevmaVisualCenterlinePrice();
         m_revma_visual_reporter.Update(m_config, dashboard_text, centerline_price, screenshot_requested, m_receipts);
      }

      if(emitted > 0)
      {
         m_total_intents += emitted;
         string receipt_detail = detail == "" ? "ready" : detail;
         receipt_detail += "|calendar_reason=" + calendar.reason;
         LP_WriteRevmaSignalReceipt(m_receipts, signal, "intents_emitted", receipt_detail, emitted);
      }
      m_runtime_telemetry.ObserveElapsed(LP_RUNTIME_REVMA_SIGNAL_EVALUATION, started_at);
      return emitted;
   }

public:
   bool Reset()
   {
      if(!m_revma_adapter.CanReset())
         return false;
      m_config_hash = 0;
      m_symbol_universe_hash = 0;
      m_initialized = false;
      m_gate108_research_active = false;
      m_step_count = 0;
      m_tick_count = 0;
      m_timer_count = 0;
      m_total_new_bars = 0;
      m_total_closed_m1_cycles = 0;
      m_total_intents = 0;
      m_total_position_grid_refreshes = 0;
      m_total_grid_exit_scans = 0;
      m_total_tp_sync_scans = 0;
      m_total_revma_symbol_evaluations = 0;
      m_next_system_intent_id = 990900000001;
      m_started_tick_count = 0;
      m_last_attribution_hash = 0;
      m_last_currency_exposure_hash = 0;
      m_last_grid_inventory_hash = 0;
      m_last_revma_tp_sync_scan_hash = 0;
      m_closed_m1_cycles_since_tp_sync = 0;
      m_cached_portfolio_valid = false;
      m_portfolio_dirty = true;
      m_stop_take_profit_liquidation_active = false;
      m_fatal_invariant_latched = false;
      m_cached_positions_total = -1;
      m_last_tester_chart_closed_m1_time = 0;
      m_pending_cohort_first_seen_time = 0;
      m_pending_cohort_target_m1_time = 0;
      m_gate108_run_start_msc = 0;
      m_gate108_baseline_deal_count = 0;
      ArrayResize(m_gate108_baseline_deal_tickets, 0);
      m_gate108_incremental_deal_count = 0;
      m_gate108_incremental_deal_capacity = 0;
      ArrayResize(m_gate108_incremental_deal_tickets, 0);
      m_gate108_incremental_deal_hash =
         LP_HashString("gate108_account_deal_set_v1");
      m_gate108_routed_deal_count = 0;
      m_gate108_routed_deal_capacity = 0;
      ArrayResize(m_gate108_routed_deal_tickets, 0);
      m_gate108_routed_deal_hash =
         LP_HashString("gate108_account_deal_set_v1");
      m_gate108_account_deal_contamination = false;
      m_gate108_account_deal_mutation_observed = false;
      m_gate108_execution_quarantine_active = false;
      m_gate108_execution_quarantine_flat_confirmed = false;
      m_gate108_execution_quarantine_steps = 0;
      m_gate108_execution_quarantine_reason = "";
      m_mandatory_history_waiting = false;
      m_last_mandatory_inventory_hash = 0;
      m_receipts.Reset();
      m_runtime_telemetry.Reset();
      m_symbol_cache.Reset();
      m_news_calendar.Reset();
      m_clock.Reset();
      m_revma_state.Reset();
      if(!m_revma_adapter.Reset())
         return false;
      m_intent_bus.Reset();
      m_position_commission_cache.Reset();
      m_position_index.Reset();
      m_grid_book.Reset();
      m_currency_guard.Reset();
      m_account_guard.Reset();
      m_stop_take_profit_guard.Reset();
      m_revma_lifecycle_gate.Reset();
      m_revma_visual_reporter.Reset();
      m_risk_arbiter.Reset();
      m_trade_router.Reset();
      return true;
   }

   int OnInit()
   {
      m_mandatory.Reset();
      LP_LoadConfig(m_config);
      m_config_hash = LP_ConfigHash(m_config);
      m_symbol_universe_hash = LP_SymbolUniverseHash(
         m_config.broker_symbol_suffix);
      if(!Reset())
      {
         Print(LP_EA_NAME, " discovery reset preflight failed.");
         m_mandatory.Open(m_config, m_config_hash, m_symbol_universe_hash);
         FailInitialization("discovery_reset_preflight_failed");
         return INIT_FAILED;
      }
      m_started_tick_count = GetTickCount();
      LP_LoadConfig(m_config);
      m_config_hash = LP_ConfigHash(m_config);
      m_symbol_universe_hash = LP_SymbolUniverseHash(m_config.broker_symbol_suffix);
      m_gate108_research_active = Gate108ResearchRun();

      if(!m_mandatory.Open(m_config, m_config_hash, m_symbol_universe_hash))
         return INIT_FAILED;
      m_mandatory.Event("initialization", "", 0, 0, 0, 0, 0, 0, "",
         "phase=preflight|gate108_research_active=" +
         LP_BoolText(m_gate108_research_active), false);

      if((bool)MQLInfoInteger(MQL_OPTIMIZATION))
      {
         Print(LP_EA_NAME,
            " optimization is disabled for this operator surface.");
         FailInitialization("optimization_disabled");
         return INIT_FAILED;
      }

      if(m_config.execution_mode == LP_EXECUTION_TESTER_ONLY &&
         !LP_IsTesterRuntime())
      {
         Print(LP_EA_NAME, " Execution=Tester requires Strategy Tester runtime.");
         FailInitialization("tester_runtime_required");
         return INIT_FAILED;
      }

      if(!m_receipts.Open(m_config, m_config_hash, m_symbol_universe_hash))
      {
         Print(LP_EA_NAME, " failed to open receipt files.");
         FailInitialization("optional_receipt_open_failed");
         return INIT_FAILED;
      }

      LP_WriteRunManifest(m_receipts, m_config, m_config_hash, m_symbol_universe_hash);

      string operator_reason = "";
      if(!OperatorSurfaceValid(operator_reason))
      {
         WriteError("init_failed", operator_reason);
         m_receipts.Flush();
         FailInitialization(operator_reason);
         return INIT_FAILED;
      }

      if(m_config.require_hedging_account && !LP_HedgingAccount())
      {
         WriteError("init_failed", "hedging_account_required");
         m_receipts.Flush();
         FailInitialization("hedging_account_required");
         return INIT_FAILED;
      }

      if(LiveNewsBarrierFails())
      {
         WriteError("init_failed", "live_mode_requires_enabled_news_guard_source");
         m_receipts.Flush();
         FailInitialization("live_mode_requires_enabled_news_guard_source");
         return INIT_FAILED;
      }

      if(LiveSchedulerBarrierFails())
      {
         WriteError("init_failed", "live_mode_requires_timer_watchdog");
         m_receipts.Flush();
         FailInitialization("live_mode_requires_timer_watchdog");
         return INIT_FAILED;
      }

      bool symbols_ok = m_symbol_cache.Load(m_config, m_receipts);
      if(!symbols_ok)
      {
         WriteError("init_failed", "symbol_universe_incomplete");
         m_receipts.Flush();
         FailInitialization("symbol_universe_incomplete");
         return INIT_FAILED;
      }
      string symbol_execution_reason = "";
      if(m_config.enable_revma_system &&
         !Gate108SymbolExecutionContractValid(symbol_execution_reason))
      {
         WriteError("init_failed", symbol_execution_reason);
         m_receipts.Flush();
         FailInitialization(symbol_execution_reason);
         return INIT_FAILED;
      }

      bool news_ok = m_news_calendar.Load(m_config, m_receipts);
      if(!news_ok)
      {
         WriteError("init_failed", "news_guard_source_unavailable");
         m_receipts.Flush();
         FailInitialization("news_guard_source_unavailable");
         return INIT_FAILED;
      }

      m_account_guard.Configure(m_config);
      m_currency_guard.Configure(m_config);
      m_revma_adapter.Configure(m_config_hash, m_config);
      m_trade_router.Configure(m_config);

      LP_PortfolioState state;
      RefreshPortfolioAndGrid(state);
      LP_WritePortfolioSummary(m_receipts, state);
      LP_WritePositionAttribution(m_receipts, state);
      m_last_attribution_hash = state.position_snapshot_hash;
      m_currency_guard.WriteReceipt(m_receipts);
      m_last_currency_exposure_hash = m_currency_guard.SnapshotHash();
      m_grid_book.WriteReceipt(m_receipts);
      m_last_grid_inventory_hash = m_grid_book.SnapshotHash();
      m_revma_adapter.LoadRevmaGridState(m_grid_book, m_receipts);
      m_revma_adapter.CleanupRevmaGridState(m_grid_book, m_receipts);
      m_revma_adapter.ObserveRevmaGridPath(m_grid_book);

      if(m_gate108_research_active &&
         (state.open_position_count != 0 ||
         OrdersTotal() != 0 ||
         state.managed_position_count != 0 ||
         state.entry_group_position_count != 0 ||
         state.grid_group_position_count != 0 ||
         state.external_position_count != 0 ||
         state.unknown_managed_position_count != 0 ||
          AccountInfoString(ACCOUNT_CURRENCY) !=
             LP_REVMA_DISCOVERY_ACCOUNT_CURRENCY))
      {
         WriteError("init_failed",
            "gate108_requires_flat_revma_only_usd_account");
         m_receipts.Flush();
         FailInitialization("gate108_requires_flat_revma_only_usd_account");
         return INIT_FAILED;
      }
      if(m_gate108_research_active)
      {
         double money_quantum = MathPow(10.0,
            -LP_REVMA_DISCOVERY_ACCOUNT_CURRENCY_DIGITS);
         long equity_reference_minor = 0;
         if(!LP_RevmaDiscoveryMoneyBurdenToMinor(state.equity,
               money_quantum, equity_reference_minor) ||
            equity_reference_minor <= 0)
         {
            WriteError("init_failed",
               "gate108_equity_reference_quantization_failed");
            m_receipts.Flush();
            FailInitialization("gate108_equity_reference_quantization_failed");
            return INIT_FAILED;
         }
         if(!CaptureGate108AccountHistoryBaseline())
         {
            WriteError("init_failed",
               "gate108_account_history_baseline_capture_failed");
            m_receipts.Flush();
            FailInitialization("gate108_account_history_baseline_capture_failed");
            return INIT_FAILED;
         }
         string discovery_run_id = "G108A_" + LP_SafePart(
            LP_Stamp(TimeLocal()) + "_R" +
            IntegerToString((long)GetTickCount()));
         if(!m_revma_adapter.InitializeRevmaDiscovery(m_config,
               discovery_run_id, equity_reference_minor, money_quantum))
         {
            WriteError("init_failed",
               "gate108_discovery_initialize_failed:" +
                  m_revma_adapter.RevmaDiscoveryTelemetryInvalidReason());
            m_receipts.Flush();
            FailInitialization("gate108_discovery_initialize_failed:" +
               m_revma_adapter.RevmaDiscoveryTelemetryInvalidReason());
            return INIT_FAILED;
         }
      }

      LP_HarvestDecision harvest;
      m_account_guard.Evaluate(state, harvest);
      if(harvest.receipt_required)
         LP_WriteHarvestState(m_receipts, harvest);

      if(m_config.use_timer_watchdog)
         EventSetTimer(m_config.timer_watchdog_seconds);

      m_initialized = true;
      m_mandatory.Event("initialization", "", 0, 0, 0, 0, 0, 0, "",
         "phase=ready|run_id=" + m_mandatory.RunId(), false);
      m_receipts.Write(
         LP_RECEIPT_RUN_START,
         "",
         "initialized",
         "valid_symbols=" + IntegerToString(m_symbol_cache.ValidCount()) + "|timer_watchdog=" + LP_BoolText(m_config.use_timer_watchdog),
         0,
         0,
         0,
         0,
         0,
         0
      );
      ulong init_flush_started_at = m_runtime_telemetry.Start();
      m_receipts.Flush();
      m_runtime_telemetry.ObserveElapsed(LP_RUNTIME_RECEIPT_FLUSH, init_flush_started_at);

      Print(
         LP_EA_NAME,
         " initialized | active_systems=",
         LP_ActiveSystemsText(
            m_config.enable_revma_system,
            m_config.enable_kyma_system,
            m_config.enable_katarakti_system),
         " | universe=", LP_UniverseDisplayName(m_config.revma_universe_mode),
         " | execution=", LP_ExecutionModeName(m_config.execution_mode),
         " | classification=", LP_RunClassification(m_config.revma_universe_mode),
         " | research_build=", LP_BUILD_GATE,
         " | version=", LP_EA_VERSION,
         " | source_bundle=", LP_EA_SourceBundleShort(),
         " | run_id=", m_receipts.RunId()
      );
      return INIT_SUCCEEDED;
   }

   void OnDeinit(const int reason)
   {
      if(m_config.use_timer_watchdog)
         EventKillTimer();

      if(!m_initialized)
      {
         if(m_mandatory.Opened())
         {
            string init_reason = "deinitialization_before_initialized";
            m_mandatory.FirstBlocker("deinitialization", "", 0, "", 0, 0,
               0, 0, init_reason);
            m_mandatory.Complete("FAIL", init_reason, PositionsTotal(),
               OrdersTotal(), AccountInfoDouble(ACCOUNT_BALANCE),
               AccountInfoDouble(ACCOUNT_EQUITY), false);
            m_mandatory.Close();
         }
         m_receipts.Close();
         return;
      }

      LP_PortfolioState state;
      m_position_index.MarkDirty();
      RefreshPortfolioAndGrid(state);
      m_revma_adapter.ObserveRevmaGridPath(m_grid_book);
      m_revma_adapter.CleanupRevmaGridState(m_grid_book, m_receipts);
      LP_WritePortfolioSummary(m_receipts, state);

      bool discovery_finalize_ok = true;
      ulong final_deal_count = 0;
      ulong final_deal_hash = 0;
      bool final_deal_contamination = false;
      ulong final_deal_tickets[];
      if(m_revma_adapter.RevmaDiscoveryInitialized())
      {
         long actual_account_equity_minor = 0;
         double money_quantum = MathPow(10.0,
            -LP_REVMA_DISCOVERY_ACCOUNT_CURRENCY_DIGITS);
         bool account_inventory_clean =
            state.external_position_count == 0 &&
            state.unknown_managed_position_count == 0 &&
            state.entry_group_position_count == 0 &&
            state.managed_position_count == state.grid_group_position_count &&
            OrdersTotal() == 0;
         bool equity_clean = LP_RevmaDiscoveryMoneyToSignedMinor(
             state.equity, money_quantum, actual_account_equity_minor) &&
            actual_account_equity_minor > 0;
         bool real_reconciled = account_inventory_clean && equity_clean &&
            m_revma_adapter.ReconcileRevmaDiscoveryRealConfirmedFlat(
               m_grid_book, actual_account_equity_minor);
         bool incremental_deal_contamination = false;
         bool routed_deal_contamination = false;
         bool incremental_deal_audit_clean = CanonicalizeGate108DealSet(
            m_gate108_incremental_deal_tickets,
            m_gate108_incremental_deal_count,
            m_gate108_incremental_deal_hash,
            incremental_deal_contamination);
         bool routed_deal_audit_clean = CanonicalizeGate108DealSet(
            m_gate108_routed_deal_tickets,
            m_gate108_routed_deal_count,
            m_gate108_routed_deal_hash,
            routed_deal_contamination);
         bool final_deal_audit_clean = FinalGate108AccountDealAudit(
            final_deal_tickets, final_deal_count, final_deal_hash,
            final_deal_contamination);
         bool exact_deal_sets = incremental_deal_audit_clean &&
            routed_deal_audit_clean && final_deal_audit_clean &&
            Gate108DealTicketSetsEqual(
               m_gate108_incremental_deal_tickets,
               m_gate108_incremental_deal_count,
               m_gate108_routed_deal_tickets,
               m_gate108_routed_deal_count) &&
            Gate108DealTicketSetsEqual(
               m_gate108_incremental_deal_tickets,
               m_gate108_incremental_deal_count,
               final_deal_tickets, final_deal_count);
         bool deal_audit_clean = exact_deal_sets &&
            !final_deal_contamination &&
            !incremental_deal_contamination &&
            !routed_deal_contamination &&
            !m_gate108_account_deal_contamination &&
            !m_gate108_account_deal_mutation_observed &&
            final_deal_hash == m_gate108_incremental_deal_hash &&
            final_deal_hash == m_gate108_routed_deal_hash;
         if(!account_inventory_clean || !equity_clean || !real_reconciled ||
            !deal_audit_clean)
         {
            string audit_reason = !account_inventory_clean ?
               "gate108_final_account_inventory_contamination" :
               (!equity_clean ? "gate108_final_equity_quantization_failed" :
                (!real_reconciled ?
                   "gate108_final_real_inventory_reconciliation_failed" :
                   "gate108_final_account_deal_audit_mismatch"));
            m_revma_adapter.InvalidateRevmaDiscovery(audit_reason);
         }
         discovery_finalize_ok =
            m_revma_adapter.FinalizeRevmaDiscovery();
         m_receipts.Summary("gate108_final_deal_count",
            (string)final_deal_count);
         m_receipts.Summary("gate108_final_deal_hash",
            (string)final_deal_hash);
         m_receipts.Summary("gate108_incremental_deal_count",
            (string)m_gate108_incremental_deal_count);
         m_receipts.Summary("gate108_incremental_deal_hash",
            (string)m_gate108_incremental_deal_hash);
         m_receipts.Summary("gate108_routed_deal_count",
            (string)m_gate108_routed_deal_count);
         m_receipts.Summary("gate108_routed_deal_hash",
            (string)m_gate108_routed_deal_hash);
         m_receipts.Summary("gate108_exact_deal_ticket_sets",
            LP_BoolText(exact_deal_sets));
         m_receipts.Summary("gate108_account_deal_mutation_observed",
            LP_BoolText(m_gate108_account_deal_mutation_observed));
         m_receipts.Summary("gate108_account_deal_contamination",
            LP_BoolText(final_deal_contamination ||
               incremental_deal_contamination ||
               routed_deal_contamination ||
               m_gate108_account_deal_contamination));
         m_receipts.Summary("gate108_execution_quarantine_active",
            LP_BoolText(m_gate108_execution_quarantine_active));
         m_receipts.Summary("gate108_execution_quarantine_flat_confirmed",
            LP_BoolText(
               m_gate108_execution_quarantine_flat_confirmed));
         m_receipts.Summary("gate108_execution_quarantine_steps",
            (string)m_gate108_execution_quarantine_steps);
         m_receipts.Summary("gate108_execution_quarantine_reason",
            m_gate108_execution_quarantine_reason);
         m_receipts.Summary("gate108_discovery_completion_valid",
            LP_BoolText(m_revma_adapter.
               RevmaDiscoveryCompletionValid()));
         if(!discovery_finalize_ok)
            WriteError("gate108_finalize_failed",
               m_revma_adapter.RevmaDiscoveryTelemetryInvalidReason());
      }

      m_receipts.Summary("deinit_reason", IntegerToString(reason));
      m_receipts.Summary("completion_ea_name", LP_EA_NAME);
      m_receipts.Summary("completion_active_systems", LP_ActiveSystemsText(
         m_config.enable_revma_system,
         m_config.enable_kyma_system,
         m_config.enable_katarakti_system));
      m_receipts.Summary("completion_universe",
         LP_UniverseDisplayName(m_config.revma_universe_mode));
      m_receipts.Summary("completion_execution",
         LP_ExecutionModeName(m_config.execution_mode));
      m_receipts.Summary("completion_profile_classification",
         LP_RunClassification(m_config.revma_universe_mode));
       m_receipts.Summary("completion_research_build_identity", LP_BUILD_GATE);
       m_receipts.Summary("completion_ea_name", LP_EA_DisplayName());
      m_receipts.Summary("completion_ea_version", LP_EA_VERSION);
      m_receipts.Summary("completion_source_bundle_id",
         LP_EA_SOURCE_BUNDLE_ID);
      m_receipts.Summary("completion_source_bundle_short",
         LP_EA_SourceBundleShort());
      m_receipts.Summary("engine_steps", IntegerToString(m_step_count));
      m_receipts.Summary("total_ticks", IntegerToString(m_tick_count));
      m_receipts.Summary("total_new_bars", IntegerToString(m_total_new_bars));
      m_receipts.Summary("total_closed_m1_evaluation_cycles", IntegerToString(m_total_closed_m1_cycles));
      m_receipts.Summary("total_intents", IntegerToString(m_total_intents));
      m_receipts.Write(LP_RECEIPT_RUN_END, "", "deinit",
         "reason=" + IntegerToString(reason) +
          "|ea=" + LP_EA_DisplayName() +
         "|active_systems=" + LP_ActiveSystemsText(
            m_config.enable_revma_system,
            m_config.enable_kyma_system,
            m_config.enable_katarakti_system) +
         "|universe=" + LP_UniverseDisplayName(m_config.revma_universe_mode) +
         "|execution=" + LP_ExecutionModeName(m_config.execution_mode) +
         "|profile_classification=" + LP_RunClassification(m_config.revma_universe_mode) +
         "|research_build_identity=" + LP_BUILD_GATE +
         "|ea_version=" + LP_EA_VERSION +
         "|source_bundle_short=" + LP_EA_SourceBundleShort() +
         "|source_bundle_id=" + LP_EA_SOURCE_BUNDLE_ID +
         "|gate108_finalize_ok=" + LP_BoolText(discovery_finalize_ok),
         0, 0, 0, 0, 0, 0);
      LP_BrokerExecutionIntegrity broker_integrity;
      m_trade_router.GetBrokerExecutionIntegrity(broker_integrity);
      m_revma_adapter.FinalizeRevmaResearchTelemetry(m_config,
         broker_integrity, m_receipts);
      m_runtime_telemetry.ObserveAggregate(
         LP_RUNTIME_LIFECYCLE_PERSISTENCE,
         m_revma_adapter.RevmaLifecyclePersistenceWriteCount(),
         m_revma_adapter.RevmaLifecyclePersistenceTotalMicroseconds(),
         m_revma_adapter.RevmaLifecyclePersistenceMaxMicroseconds()
      );
      WriteRuntimeProfileSummary();
      bool fully_reconciled = !m_fatal_invariant_latched &&
         state.external_position_count == 0 &&
         state.unknown_managed_position_count == 0 &&
         state.entry_group_position_count == 0 &&
         state.managed_position_count == state.grid_group_position_count &&
         state.managed_position_count == 0 && OrdersTotal() == 0;
      string completion_status = fully_reconciled ? "PASS" : "FAIL";
      m_mandatory.Event("deinitialization", "", state.asof, 0, 0, 0, 0, 0,
         completion_status,
         "reason=" + IntegerToString(reason) +
         "|managed=" + IntegerToString(state.managed_position_count),
         false);
      m_mandatory.Complete(completion_status,
         fully_reconciled ? "none" : "run_not_fully_reconciled",
         PositionsTotal(), OrdersTotal(), state.balance, state.equity,
         fully_reconciled);
      m_receipts.Close();
      m_mandatory.Close();
      m_initialized = false;
   }

   void OnTick()
   {
      Step("tick");
   }

   void OnTimer()
   {
      Step("timer");
   }

   void OnTradeTransaction(
      const MqlTradeTransaction &trans,
      const MqlTradeRequest &request,
      const MqlTradeResult &result
   )
   {
      m_mandatory.Event("transaction", trans.symbol, 0, (int)trans.type, 0,
         trans.order, trans.deal, trans.position, "",
         "request_magic=" + (string)request.magic +
         "|retcode=" + IntegerToString((int)result.retcode), false);
      if(!m_initialized)
         return;
      if(m_gate108_research_active &&
         trans.type == TRADE_TRANSACTION_DEAL_DELETE)
      {
         m_gate108_account_deal_mutation_observed = true;
         EnterGate108ExecutionQuarantine(
            "gate108_canonical_deal_deleted");
         return;
      }
      if(m_gate108_research_active &&
         trans.type == TRADE_TRANSACTION_DEAL_UPDATE)
      {
         // A history update is not itself proof of deal tampering.  MT5 can
         // refresh economic fields after DEAL_ADD.  Final deal-set and
         // structural identity audits remain the authority for genuine drift.
         m_mandatory.Event("deal_history_update", trans.symbol, 0,
            (int)trans.type, 0, trans.order, trans.deal, trans.position,
            "normal_history_refresh",
            "history_update_is_not_automatic_quarantine", false);
      }
      if(m_gate108_research_active &&
         trans.type == TRADE_TRANSACTION_DEAL_ADD && trans.deal > 0)
      {
         // Transaction ordering does not guarantee that the corresponding
         // history order is selectable yet.  Capture the exact ticket now;
         // canonical deal/order identity is recomputed from final history.
         if(!AppendGate108DealTicket(m_gate108_incremental_deal_tickets,
               m_gate108_incremental_deal_count,
               m_gate108_incremental_deal_capacity, trans.deal))
         {
            EnterGate108ExecutionQuarantine(
               "gate108_incremental_deal_audit_failed");
            return;
         }
         if(m_fatal_invariant_latched &&
            !m_gate108_execution_quarantine_active)
            EnterGate108ExecutionQuarantine(
               "gate108_delayed_deal_after_fatal_quarantine");
      }
      bool commission_deal_transaction =
         trans.type == TRADE_TRANSACTION_DEAL_ADD ||
         trans.type == TRADE_TRANSACTION_DEAL_UPDATE ||
         trans.type == TRADE_TRANSACTION_DEAL_DELETE;
      if(commission_deal_transaction)
      {
         long position_identifier = 0;
         if(trans.deal > 0 && HistoryDealSelect(trans.deal))
            position_identifier = (long)HistoryDealGetInteger(trans.deal, DEAL_POSITION_ID);
         if(position_identifier > 0)
            m_position_commission_cache.Invalidate(position_identifier);
         else
            m_position_commission_cache.InvalidateAll();
      }
      m_position_index.MarkDirty();
      m_portfolio_dirty = true;
      m_receipts.Write(
         LP_RECEIPT_TRADE_TRANSACTION,
         trans.symbol,
         "transaction",
         "type=" + IntegerToString((int)trans.type) +
            "|order=" + (string)trans.order +
            "|deal=" + (string)trans.deal +
            "|request_magic=" + (string)request.magic +
            "|retcode=" + IntegerToString((int)result.retcode),
         0,
         0,
         0,
         0,
         0,
         (long)request.magic
      );
      ulong transaction_flush_started_at = m_runtime_telemetry.Start();
      m_receipts.Flush();
      m_runtime_telemetry.ObserveElapsed(LP_RUNTIME_RECEIPT_FLUSH, transaction_flush_started_at);
   }

   void Step(const string source)
   {
      if(!m_initialized)
         return;
      if(m_fatal_invariant_latched)
      {
         if(m_gate108_execution_quarantine_active)
            RunGate108ExecutionQuarantineStep();
         return;
      }

      m_step_count++;
      if(source == "tick")
         m_tick_count++;
      else if(source == "timer")
         m_timer_count++;
      m_intent_bus.Clear();

      int cycle_new_bars = 0;
      int active_symbols_scanned = 0;
      int clock_ready_symbols = 0;
      int forced_initial_symbols = 0;
      int new_symbol_ids[LP_SYMBOL_COUNT];
      MqlRates new_symbol_bars[LP_SYMBOL_COUNT];
      int new_symbol_count = 0;
      LP_BarClockState cohort_states[LP_SYMBOL_COUNT];
      int cohort_count = 0;
      bool tester_fast_cadence = TesterRuntime();
      bool single_pair_run = SinglePairRun();
      bool single_pair_history_waiting = false;
      bool fx28_history_waiting = false;
      bool force_initial_fx28_scan = m_step_count == 1 && m_config.revma_universe_mode == LP_UNIVERSE_FX28;
      bool scan_symbol_clocks = !tester_fast_cadence ||
         force_initial_fx28_scan ||
         m_pending_cohort_first_seen_time > 0 || TesterClosedM1ScanDue();
      ulong closed_m1_scan_started_at = m_runtime_telemetry.Start();
      if(scan_symbol_clocks)
      {
         bool any_new_cohort_bar = false;
         bool all_cohort_bars_new = true;
         bool cohort_source_times_mixed = false;
         datetime cohort_m1_time = 0;
         for(int i = 0; i < m_symbol_cache.Count(); i++)
         {
            LP_SymbolMeta meta;
            if(!m_symbol_cache.Get(i, meta))
               continue;
            if(!LP_RevmaSymbolActive(m_config, meta, _Symbol))
               continue;
            active_symbols_scanned++;

            LP_BarClockState clock_state;
            if(!m_clock.ProbeSymbol(meta, clock_state))
            {
               datetime now = TimeCurrent();
               if(m_pending_cohort_first_seen_time == 0)
                  m_pending_cohort_first_seen_time = now;
               long wait_seconds = (long)now -
                  (long)m_pending_cohort_first_seen_time;
               if(wait_seconds < 0 || wait_seconds >
                  LP_REVMA_DISCOVERY_COHORT_WAIT_SECONDS)
               {
                  LatchFatalInvariant(single_pair_run ?
                     "single_pair_m1_history_wait_timeout" :
                     "gate108_m1_history_wait_timeout");
                  return;
               }
               if(single_pair_run)
                  single_pair_history_waiting = true;
               else
                  fx28_history_waiting = true;
               continue;
            }
            clock_ready_symbols++;
            if(cohort_count >= LP_SYMBOL_COUNT)
            {
               LatchFatalInvariant("gate108_m1_cohort_symbol_overflow");
               return;
            }
            cohort_states[cohort_count++] = clock_state;
            any_new_cohort_bar = any_new_cohort_bar || clock_state.new_bar;
            all_cohort_bars_new = all_cohort_bars_new &&
               clock_state.new_bar;
            if(clock_state.new_bar)
            {
               if(cohort_m1_time == 0)
                  cohort_m1_time = clock_state.last_bar_time;
               else if(clock_state.last_bar_time != cohort_m1_time)
                  cohort_source_times_mixed = true;
            }
         }
         bool history_waiting = single_pair_history_waiting ||
            fx28_history_waiting;
         if(m_mandatory.Opened() &&
            m_mandatory_history_waiting != history_waiting)
         {
            m_mandatory.Event("history_waiting", _Symbol, 0, 0, 0, 0, 0, 0,
               history_waiting ?
                  (single_pair_run ? "WAITING_FOR_SINGLE_PAIR_HISTORY" :
                     "WAITING_FOR_FX28_HISTORY") : "HISTORY_READY",
               "active_symbols_scanned=" + IntegerToString(active_symbols_scanned) +
               "|clock_ready_symbols=" + IntegerToString(clock_ready_symbols),
               false);
            m_mandatory_history_waiting = history_waiting;
         }
         if(single_pair_run)
         {
            if(cohort_count == 1 && cohort_states[0].new_bar)
            {
               if(!m_clock.CommitSingle(cohort_states[0]))
               {
                  LatchFatalInvariant(
                     "single_pair_m1_commit_failed:" +
                        cohort_states[0].symbol);
                  return;
               }
               cycle_new_bars = 1;
               new_symbol_count = 1;
               new_symbol_ids[0] = cohort_states[0].symbol_id;
               ZeroMemory(new_symbol_bars[0]);
               new_symbol_bars[0].time = cohort_states[0].last_bar_time;
               new_symbol_bars[0].close = cohort_states[0].close;
            }
         }
         else if(any_new_cohort_bar)
         {
            bool cohort_ready = all_cohort_bars_new &&
               !cohort_source_times_mixed &&
               cohort_count == LP_SYMBOL_COUNT &&
               active_symbols_scanned == LP_SYMBOL_COUNT &&
               clock_ready_symbols == LP_SYMBOL_COUNT;
            if(!cohort_ready)
            {
               datetime now = TimeCurrent();
               if(m_pending_cohort_first_seen_time == 0)
                  m_pending_cohort_first_seen_time = now;
               if(cohort_m1_time > m_pending_cohort_target_m1_time)
                  m_pending_cohort_target_m1_time = cohort_m1_time;
               long wait_seconds = (long)now -
                  (long)m_pending_cohort_first_seen_time;
               if(wait_seconds < 0 || wait_seconds >
                  LP_REVMA_DISCOVERY_COHORT_WAIT_SECONDS)
               {
                  LatchFatalInvariant(
                     "gate108_m1_cohort_synchronization_timeout");
                  return;
               }
            }
            else
            {
               if(!m_clock.CommitCohort(cohort_states, cohort_count))
               {
                  LatchFatalInvariant(
                     "gate108_m1_cohort_atomic_commit_failed");
                  return;
               }
               m_pending_cohort_first_seen_time = 0;
               m_pending_cohort_target_m1_time = 0;
               cycle_new_bars = LP_SYMBOL_COUNT;
               new_symbol_count = LP_SYMBOL_COUNT;
               forced_initial_symbols = force_initial_fx28_scan ?
                  LP_SYMBOL_COUNT : 0;
               for(int i = 0; i < cohort_count; i++)
               {
                  new_symbol_ids[i] = cohort_states[i].symbol_id;
                  ZeroMemory(new_symbol_bars[i]);
                  new_symbol_bars[i].time =
                     cohort_states[i].last_bar_time;
                  new_symbol_bars[i].close = cohort_states[i].close;
               }
               m_mandatory.Event("cohort_ready", _Symbol, cohort_m1_time, 0,
                  0, 0, 0, 0, "WAITING_FOR_COMPLETE_COHORT_CLEARED",
                  "symbols=" + IntegerToString(cohort_count), false);
            }
         }
      }
      if(scan_symbol_clocks)
         m_runtime_telemetry.ObserveElapsed(LP_RUNTIME_CLOSED_M1_SCAN, closed_m1_scan_started_at);
      if(cycle_new_bars > 0)
      {
         m_total_closed_m1_cycles++;
         m_closed_m1_cycles_since_tp_sync++;
      }

      bool positions_total_changed = m_cached_portfolio_valid && PositionsTotal() != m_cached_positions_total;
      if(positions_total_changed)
         m_portfolio_dirty = true;

      bool dirty_before_refresh = m_portfolio_dirty || positions_total_changed;
      bool refresh_required = !tester_fast_cadence ||
         !m_cached_portfolio_valid ||
         dirty_before_refresh ||
         cycle_new_bars > 0 ||
         m_stop_take_profit_liquidation_active;

      if(!refresh_required)
         return;

      LP_PortfolioState portfolio;
      RefreshPortfolioAndGrid(portfolio);
      m_revma_adapter.ObserveRevmaGridPath(m_grid_book);
      if(portfolio.external_position_count != 0 ||
         OrdersTotal() != 0 ||
         portfolio.unknown_managed_position_count != 0 ||
         portfolio.entry_group_position_count != 0 ||
         portfolio.managed_position_count !=
            portfolio.grid_group_position_count)
      {
         LatchFatalInvariant(m_gate108_research_active ?
            "gate108_revma_only_account_contamination" :
            "single_pair_revma_account_contamination");
         return;
      }
      if(m_gate108_research_active)
      {
         long actual_account_equity_minor = 0;
         double gate108_money_quantum = MathPow(10.0,
            -LP_REVMA_DISCOVERY_ACCOUNT_CURRENCY_DIGITS);
         if(!LP_RevmaDiscoveryMoneyToSignedMinor(portfolio.equity,
                gate108_money_quantum, actual_account_equity_minor) ||
            actual_account_equity_minor <= 0 ||
            !m_revma_adapter.ReconcileRevmaDiscoveryRealConfirmedFlat(
               m_grid_book, actual_account_equity_minor))
         {
            LatchFatalInvariant(
               m_revma_adapter.RevmaDiscoveryTelemetryInvalidReason());
            return;
         }
      }

      bool grid_inventory_changed = m_step_count == 1 || m_grid_book.SnapshotHash() != m_last_grid_inventory_hash;
      if(m_step_count == 1 || portfolio.position_snapshot_hash != m_last_attribution_hash)
      {
         LP_WritePositionAttribution(m_receipts, portfolio);
         m_last_attribution_hash = portfolio.position_snapshot_hash;
      }
      if(m_step_count == 1 || m_currency_guard.SnapshotHash() != m_last_currency_exposure_hash)
      {
         m_currency_guard.WriteReceipt(m_receipts);
         m_last_currency_exposure_hash = m_currency_guard.SnapshotHash();
      }
      if(grid_inventory_changed)
      {
         m_grid_book.WriteReceipt(m_receipts);
         m_last_grid_inventory_hash = m_grid_book.SnapshotHash();
         m_revma_adapter.CleanupRevmaGridState(m_grid_book, m_receipts);
      }

      // Shared completed-M1 marking may escalate a close owner. Defer close
      // staging on those steps until the discovery batch has applied the new
      // authority, so no queued intent can retain a stale owner identity.
      if(m_gate108_research_active && cycle_new_bars == 0)
      {
         int discovery_real_close_intents =
            m_revma_adapter.ContinueRevmaDiscoveryRealCloses(
               m_grid_book, m_intent_bus);
         if(discovery_real_close_intents > 0)
            m_total_intents += discovery_real_close_intents;
      }

      LP_HarvestDecision harvest;
      ulong account_close_started_at = m_runtime_telemetry.Start();
      m_account_guard.Evaluate(portfolio, harvest);
      if(harvest.block_new_entries)
         portfolio.recovery_state = LP_RECOVERY_LOCKED;
      if(harvest.receipt_required)
         LP_WriteHarvestState(m_receipts, harvest);

      string harvest_close_reason = "";
      bool harvest_close_required = m_account_guard.RequiresAccountClose(portfolio, harvest_close_reason);
      if(harvest_close_required)
      {
         if(!AddHarvestCloseIntent(harvest, m_intent_bus))
            LatchFatalInvariant("harvest_close_intent_allocation_failed");
      }

      LP_PortfolioStopTakeProfitDecision stop_take_profit;
      bool stop_take_profit_block_new_entries = m_stop_take_profit_guard.Evaluate(
         m_config,
         portfolio,
         stop_take_profit
      );
      m_runtime_telemetry.ObserveElapsed(LP_RUNTIME_ACCOUNT_CLOSE_EVALUATION, account_close_started_at);
      if(
         (m_config.stop_take_profit_mode == LP_SLTP_MULTI_CURRENCY_PERCENT_AFTER_FEES ||
          m_config.stop_take_profit_mode == LP_SLTP_MULTI_CURRENCY_HWM_TRAIL_AFTER_FEES) &&
         m_config.revma_universe_mode == LP_UNIVERSE_FX28 &&
         portfolio.managed_position_count > 0 &&
         portfolio.balance > 0.0
      )
      {
         m_receipts.ObserveStopTakeProfitMetrics(
            portfolio.managed_position_count,
            stop_take_profit.net_open_pct,
            stop_take_profit.net_open_money
         );
      }
      if(stop_take_profit_block_new_entries)
      {
         if(!stop_take_profit.close_required)
            m_stop_take_profit_guard.WriteReceipt(m_config, m_receipts, portfolio, stop_take_profit.reason, stop_take_profit);
         else if(harvest_close_required)
            m_stop_take_profit_guard.WriteReceipt(m_config, m_receipts, portfolio, "triggered_harvest_close_already_queued", stop_take_profit);
         else
         {
            if(!m_stop_take_profit_guard.AddCloseIntent(m_config, m_config_hash,
               NextSystemIntentId(), portfolio, stop_take_profit, m_intent_bus,
               m_receipts))
               LatchFatalInvariant("account_close_intent_allocation_failed");
         }
      }
      else if(stop_take_profit.hwm_cycle_reset_flat)
      {
         m_stop_take_profit_guard.WriteReceipt(m_config, m_receipts, portfolio, "hwm_cycle_reset_flat", stop_take_profit);
      }
      else if(stop_take_profit.hwm_mode &&
         (stop_take_profit.newly_triggered || stop_take_profit.hwm_floor_raised))
      {
         m_stop_take_profit_guard.WriteReceipt(m_config, m_receipts, portfolio, stop_take_profit.reason, stop_take_profit);
      }
      else
      {
         m_stop_take_profit_guard.WriteMonitoringReceipt(m_config, m_receipts, portfolio, stop_take_profit);
      }
      m_stop_take_profit_liquidation_active = stop_take_profit.liquidation_active || harvest_close_required;

      int revma_grid_exit_intents = 0;
      bool account_liquidation_owns_closes = m_stop_take_profit_liquidation_active;
      bool revma_grid_close_latched = m_revma_adapter.HasLatchedRevmaGridClose();
       bool should_scan_grid_exits =
         m_config.enable_strategy_evaluation &&
         LP_RevmaAnySleeveStopTakeProfitEnabled(m_config) &&
         !account_liquidation_owns_closes && portfolio.open_grid_count > 0 &&
         (revma_grid_close_latched || !tester_fast_cadence || cycle_new_bars > 0 || grid_inventory_changed || dirty_before_refresh || m_stop_take_profit_liquidation_active);
      if(should_scan_grid_exits)
      {
         ulong grid_close_started_at = m_runtime_telemetry.Start();
         m_total_grid_exit_scans++;
         revma_grid_exit_intents = m_revma_adapter.EvaluateRevmaGridExits(
            m_config,
            m_grid_book,
            m_receipts,
            m_intent_bus
         );
         m_runtime_telemetry.ObserveElapsed(LP_RUNTIME_GRID_CLOSE_EVALUATION, grid_close_started_at);
      }
      bool revma_grid_exit_block_new_entries = revma_grid_exit_intents > 0 || revma_grid_close_latched;
      bool exit_block_new_entries = stop_take_profit_block_new_entries || revma_grid_exit_block_new_entries;
      if(revma_grid_exit_intents > 0)
         m_total_intents += revma_grid_exit_intents;

      int revma_grid_tp_sync_intents = 0;
      bool tp_sync_periodic_due = tester_fast_cadence && m_closed_m1_cycles_since_tp_sync >= 15;
      bool should_scan_tp_sync =
         m_config.enable_strategy_evaluation &&
         m_config.broker_grid_tp_sync_mode != LP_BROKER_GRID_TP_SYNC_OFF &&
         portfolio.open_grid_count > 0 &&
         !account_liquidation_owns_closes &&
         revma_grid_exit_intents <= 0 &&
         (!tester_fast_cadence ||
          grid_inventory_changed ||
          dirty_before_refresh ||
          m_last_revma_tp_sync_scan_hash != m_grid_book.SnapshotHash() ||
          tp_sync_periodic_due);
      if(should_scan_tp_sync)
      {
         ulong broker_tp_sync_started_at = m_runtime_telemetry.Start();
         m_total_tp_sync_scans++;
         revma_grid_tp_sync_intents = m_revma_adapter.SyncRevmaGridTakeProfits(
            m_config,
            m_grid_book,
            m_receipts,
            m_intent_bus
         );
         m_last_revma_tp_sync_scan_hash = m_grid_book.SnapshotHash();
         m_closed_m1_cycles_since_tp_sync = 0;
         if(revma_grid_tp_sync_intents > 0)
            m_total_intents += revma_grid_tp_sync_intents;
         m_runtime_telemetry.ObserveElapsed(LP_RUNTIME_BROKER_TP_SYNC, broker_tp_sync_started_at);
      }

       if(cycle_new_bars > 0)
       {
         if(m_gate108_research_active)
         {
          LP_RevmaCompletedM1Snapshot discovery_snapshots[LP_SYMBOL_COUNT];
         bool discovery_snapshot_seen[LP_SYMBOL_COUNT];
         for(int symbol_id = 0; symbol_id < LP_SYMBOL_COUNT; symbol_id++)
         {
            LP_ResetRevmaCompletedM1Snapshot(
               discovery_snapshots[symbol_id]);
            discovery_snapshot_seen[symbol_id] = false;
         }
         for(int i = 0; i < new_symbol_count; i++)
         {
            LP_SymbolMeta meta;
            if(!m_symbol_cache.Get(new_symbol_ids[i], meta))
               continue;
            if(!LP_RevmaSymbolActive(m_config, meta, _Symbol))
               continue;
            ulong revma_started_at = m_runtime_telemetry.Start();
            m_total_revma_symbol_evaluations++;
            LP_RevmaSignal signal;
            string signal_detail = "";
            if(!m_revma_state.BuildSignalAtClosedBar(meta, m_config,
                  new_symbol_bars[i], signal, signal_detail) ||
               !signal.valid ||
               signal.source_m1_time != new_symbol_bars[i].time)
            {
               LatchFatalInvariant(
                  "gate108_shared_signal_build_failed:" +
                     meta.canonical_symbol + ":" + signal.reason_code);
               return;
            }
            LP_CalendarDecision calendar;
            LP_EvaluateCalendar(signal.source_m1_time, m_config, calendar);
            m_news_calendar.Apply(signal.source_m1_time, meta, m_config,
               calendar);
            LP_TickSnapshot tick;
            string snapshot_reason = "";
            if(!m_tick_cache.RefreshTick(meta.broker_symbol, tick) ||
               !LP_RevmaBuildCompletedM1Snapshot(meta, signal, tick,
                  !calendar.week_boundary_blocked,
                  !calendar.news_blocked, calendar.reason,
                  discovery_snapshots[meta.symbol_id], snapshot_reason))
            {
               LatchFatalInvariant(
                  "gate108_shared_snapshot_build_failed:" +
                     meta.canonical_symbol + ":" + snapshot_reason);
               return;
            }
            discovery_snapshot_seen[meta.symbol_id] = true;
            m_runtime_telemetry.ObserveElapsed(
               LP_RUNTIME_REVMA_SIGNAL_EVALUATION, revma_started_at);
         }
         for(int symbol_id = 0; symbol_id < LP_SYMBOL_COUNT; symbol_id++)
         {
            if(!discovery_snapshot_seen[symbol_id])
            {
               LatchFatalInvariant(
                  "gate108_shared_snapshot_fx28_incomplete");
               return;
            }
         }
         int discovery_intents =
            m_revma_adapter.ProcessRevmaDiscoveryCompletedM1Batch(
               discovery_snapshots, LP_SYMBOL_COUNT, m_grid_book,
               m_intent_bus);
         if(m_revma_adapter.RevmaDiscoveryFaultLatched())
         {
            LatchFatalInvariant(
               m_revma_adapter.RevmaDiscoveryTelemetryInvalidReason());
            return;
         }
          if(discovery_intents > 0)
          {
             m_total_intents += discovery_intents;
          }
         }
         else if(single_pair_run && m_config.enable_revma_system &&
            !single_pair_history_waiting && new_symbol_count == 1)
         {
            LP_SymbolMeta meta;
            if(!m_symbol_cache.Get(new_symbol_ids[0], meta))
            {
               LatchFatalInvariant("single_pair_symbol_meta_unavailable");
               return;
            }
            EvaluateRevmaSymbol(
               meta,
               harvest,
               exit_block_new_entries,
               new_symbol_bars[0]
            );
         }
       }

      m_total_new_bars += cycle_new_bars;

      if(!m_intent_bus.Valid())
      {
         LatchFatalInvariant(m_intent_bus.InvalidReason());
         return;
      }
      if(m_fatal_invariant_latched)
         return;

       if(m_gate108_research_active &&
          (m_revma_adapter.RevmaDiscoveryFaultLatched() ||
           (m_revma_adapter.RevmaDiscoveryInitialized() &&
            !m_revma_adapter.RevmaDiscoveryOperationalValid())))
      {
         LatchFatalInvariant(
            m_revma_adapter.RevmaDiscoveryTelemetryInvalidReason());
         return;
      }

      m_currency_guard.BeginIntentBatch();
      for(int intent_index = 0; intent_index < m_intent_bus.Count(); intent_index++)
      {
         LP_TradeIntent intent;
         LP_ResetTradeIntent(intent);
         if(!m_intent_bus.Get(intent_index, intent))
            continue;

         bool discovery_route_authorized = true;
         if(m_gate108_research_active &&
            !m_revma_adapter.AuthorizeRevmaDiscoveryRealIntentBeforeRoute(
               intent, discovery_route_authorized))
         {
            LatchFatalInvariant(
               m_revma_adapter.RevmaDiscoveryTelemetryInvalidReason());
            return;
         }
         if(!discovery_route_authorized)
            continue;

         LP_LogTradeIntent(m_receipts, intent);

         LP_RiskDecision decision;
         LP_TradePlan plan;
         ulong risk_reservation_started_at = m_runtime_telemetry.Start();
         m_risk_arbiter.Decide(intent, portfolio, m_currency_guard, decision, plan);
         m_runtime_telemetry.ObserveElapsed(LP_RUNTIME_RISK_RESERVATION, risk_reservation_started_at);
         LP_LogRiskDecision(m_receipts, decision);
         m_mandatory.Event("risk_decision", intent.symbol,
            intent.source_bar_time, 0, intent.intent_id, 0, 0, 0,
            decision.allow_new_order || decision.allow_reduce ||
               decision.allow_close ? "allowed" : "rejected",
            decision.explanation, false);
         if(!m_revma_adapter.RecordRevmaRiskDecision(
            intent, decision, m_receipts))
         {
            LatchFatalInvariant(
               m_revma_adapter.RevmaDiscoveryTelemetryInvalidReason());
            return;
         }
         if(plan.executable)
            LP_LogTradePlan(m_receipts, plan);
         if(plan.executable)
         {
            if(CloseAction(plan.action) && plan.close_reason == "")
               plan.close_reason = plan.reason == "" ?
                  "unspecified_close_owner" : plan.reason;
            m_mandatory.Event("route_attempt", plan.symbol,
               plan.discovery_source_m1_time, 0, plan.intent_id, 0, 0, 0,
               CloseAction(plan.action) ? plan.close_reason : plan.reason,
               "action=" + IntegerToString(plan.action) +
               "|lots=" + DoubleToString(plan.lots, 8) +
               "|gate108=" + LP_BoolText(plan.gate108), false);
            LP_TradeExecutionResult execution;
            m_trade_router.Execute(plan, m_receipts, execution);
            m_mandatory.Event("order_result", plan.symbol,
               plan.discovery_source_m1_time, 0, plan.intent_id,
               execution.order_ticket, execution.deal_ticket,
               execution.position_ticket,
               CloseAction(plan.action) ? plan.close_reason :
                  (execution.accepted ? "accepted" : "execution_rejected"),
               execution.detail, execution.order_send_attempted);
            bool broker_state_may_have_changed =
               execution.order_send_attempted &&
               (execution.accepted || execution.partial_fill ||
                execution.executed_lots > 0.0 || execution.deal_ticket > 0 ||
                execution.position_ticket > 0 || execution.order_ticket > 0 ||
                execution.retcode == TRADE_RETCODE_PLACED);
            if(broker_state_may_have_changed)
            {
               m_position_index.MarkDirty();
               m_portfolio_dirty = true;
            }
            if(!RememberGate108RoutedDealSet(plan, execution))
            {
               EnterGate108ExecutionQuarantine(
                  "gate108_routed_deal_set_capture_failed");
               RunGate108ExecutionQuarantineStep();
               return;
            }
            if(m_fatal_invariant_latched)
            {
               if(broker_state_may_have_changed)
               {
                  EnterGate108ExecutionQuarantine(
                     "gate108_transaction_audit_failed_during_route");
                  RunGate108ExecutionQuarantineStep();
               }
               return;
            }
            if(plan.reservation_status == "approved_reserved" && !execution.accepted)
            {
               // Reservations intentionally remain conservative for this
               // batch after a zero-fill router/broker failure. Releasing
               // partial or placed outcomes would weaken the stale-snapshot
               // safety invariant.
               m_receipts.Write(
                  LP_RECEIPT_ERROR,
                  plan.symbol,
                  "reservation_retained_after_router_failure",
                  "intent_id=" + (string)plan.intent_id +
                     "|reservation_status=approved_reserved" +
                     "|reservation_reason=" + plan.reservation_reason +
                     "|execution_outcome=" + (execution.broker_rejected ? "broker_rejected" : "router_rejected") +
                     "|retcode=" + IntegerToString((int)execution.retcode) +
                     "|retcode_name=" + LP_RetcodeName(execution.retcode) +
                     "|executed_lots=" + DoubleToString(execution.executed_lots, 2) +
                     "|reservation_release=not_attempted_conservative_batch",
                  plan.lane_id,
                  plan.variant_id,
                  plan.grid_key,
                  plan.intent_id,
                  plan.decision_id,
                  plan.magic
               );
            }
            if(!m_revma_adapter.RecordRevmaExecutionOutcome(
               plan, execution, m_receipts))
            {
               string failure_reason = m_revma_adapter.
                  RevmaDiscoveryTelemetryInvalidReason();
               if(broker_state_may_have_changed)
               {
                  EnterGate108ExecutionQuarantine(failure_reason);
                  RunGate108ExecutionQuarantineStep();
               }
               else
                  LatchFatalInvariant(failure_reason);
               return;
            }
            if(execution.accepted)
            {
               string commit_stage = CloseAction(plan.action) ?
                  "close_committed" :
                  (plan.research_lifecycle_event ==
                     LP_RESEARCH_LIFECYCLE_GRID_BIRTH ?
                     "birth_committed" :
                     (plan.research_lifecycle_event ==
                        LP_RESEARCH_LIFECYCLE_GRID_ADD ?
                        "add_committed" : "execution_commit"));
               m_mandatory.Event(commit_stage, plan.symbol,
                  plan.discovery_source_m1_time, 0, plan.intent_id,
                  execution.order_ticket, execution.deal_ticket,
                  execution.position_ticket,
                  CloseAction(plan.action) ? plan.close_reason : "",
                  execution.detail, execution.order_send_attempted);
            }
            if(!m_revma_adapter.RecordRevmaCloseExecution(
               plan, execution, m_receipts))
            {
               string failure_reason = m_revma_adapter.
                  RevmaDiscoveryTelemetryInvalidReason();
               if(broker_state_may_have_changed)
               {
                  EnterGate108ExecutionQuarantine(failure_reason);
                  RunGate108ExecutionQuarantineStep();
               }
               else
                  LatchFatalInvariant(failure_reason);
               return;
            }
         }
      }

       if(m_gate108_research_active &&
          !m_revma_adapter.EndRevmaDiscoveryRealBatch())
      {
         LatchFatalInvariant(
            m_revma_adapter.RevmaDiscoveryTelemetryInvalidReason());
         return;
      }

      if(m_step_count == 1 || cycle_new_bars > 0 || m_intent_bus.Count() > 0 || dirty_before_refresh)
      {
         m_receipts.Write(
            LP_RECEIPT_ENGINE_STEP,
            "",
            source,
             "cycle_new_bars=" + IntegerToString(cycle_new_bars) +
               "|active_symbols_scanned=" + IntegerToString(active_symbols_scanned) +
               "|clock_ready_symbols=" + IntegerToString(clock_ready_symbols) +
               "|evaluated_symbols=" + IntegerToString(new_symbol_count) +
               "|run_classification=" + LP_RunClassification(m_config.revma_universe_mode) +
               "|active_systems=" + LP_ActiveSystemsText(
                  m_config.enable_revma_system,
                  m_config.enable_kyma_system,
                  m_config.enable_katarakti_system) +
               "|single_pair_history_waiting=" + LP_BoolText(single_pair_history_waiting) +
               "|forced_initial_fx28_symbols=" + IntegerToString(forced_initial_symbols) +
               "|total_new_bars=" + IntegerToString(m_total_new_bars) +
                "|intents=" + IntegerToString(m_intent_bus.Count()) +
                "|managed_positions=" + IntegerToString(portfolio.managed_position_count) +
               "|open_grids=" + IntegerToString(portfolio.open_grid_count) +
               "|harvest_state=" + LP_HarvestStateName(harvest.state) +
               "|harvest_block_new_entries=" + LP_BoolText(harvest.block_new_entries) +
               "|stop_take_profit_block_new_entries=" + LP_BoolText(exit_block_new_entries) +
               "|stop_take_profit_reason=" + stop_take_profit.reason +
               "|revma_grid_exit_intents=" + IntegerToString(revma_grid_exit_intents) +
               "|revma_grid_tp_sync_intents=" + IntegerToString(revma_grid_tp_sync_intents) +
               "|stop_take_profit_net_open_pct_after_fees=" + DoubleToString(stop_take_profit.net_open_pct, 6) +
               "|stop_take_profit_estimated_close_fee=" + DoubleToString(stop_take_profit.estimated_close_fee, 2),
            0,
            0,
            0,
            0,
            0,
            0
         );
          ulong flush_started_at = m_runtime_telemetry.Start();
          m_receipts.Flush();
          m_runtime_telemetry.ObserveElapsed(LP_RUNTIME_RECEIPT_FLUSH, flush_started_at);
      }
   }
};

#endif // __LIMNI_PORTFOLIO_ENGINE_MQH__
