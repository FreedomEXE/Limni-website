/*-----------------------------------------------
  Revma adapter
  Phase B.2.1: explicit execution observation outcome forwarding.
-----------------------------------------------*/
#ifndef __LIMNI_PORTFOLIO_REVMA_ADAPTER_MQH__
#define __LIMNI_PORTFOLIO_REVMA_ADAPTER_MQH__

#include "..\\..\\Core\\Types.mqh"
#include "..\\IntentBus.mqh"
#include "RevmaGridSleeve.mqh"
#include "RevmaSignalState.mqh"
#include "RevmaLifecycleGate.mqh"
#include "RevmaReceipts.mqh"
#include "RevmaVisualReporter.mqh"
#include "RevmaDiscoveryValuation.mqh"
#include "..\\..\\Market\\NewsCalendar.mqh"
#include "..\\..\\Market\\TickBarCache.mqh"
#include "..\\..\\Market\\SymbolSpecCache.mqh"
#include "..\\..\\Receipts\\MandatoryDiagnostics.mqh"
#include "..\\..\\Receipts\\RuntimeTelemetry.mqh"
#include "..\\..\\Receipts\\DecisionLog.mqh"
#include "RevmaExecutionBoundary.mqh"

class LP_RevmaAdapter
{
private:
   LP_RevmaSignalState m_signal_state;
   LP_RevmaLifecycleGate m_lifecycle_gate;
   LP_RevmaVisualReporter m_visual_reporter;
   LP_RevmaGridSleeve m_revma;
   LP_RevmaExecutionBoundary m_execution;

public:
   bool CanReset()
   {
      return m_revma.CanResetDiscoveryForNewRun();
   }

   bool Reset()
   {
      if(!CanReset())
         return false;
      m_signal_state.Reset();
      m_lifecycle_gate.Reset();
      m_visual_reporter.Reset();
      m_execution.Reset();
      return m_revma.Reset();
   }

   void Configure(const ulong config_hash, const LP_Config &config)
   {
      m_revma.Configure(config_hash, config);
   }

   bool SymbolActive(
      const LP_Config &config,
      const LP_SymbolMeta &meta,
      const string chart_symbol)
   {
      return LP_RevmaSymbolActive(config, meta, chart_symbol);
   }

   bool IsDiscoveryRun(const LP_Config &config)
   {
      return config.enable_revma_system &&
         config.revma_universe_mode == LP_UNIVERSE_FX28;
   }

   bool PrepareExecutionBoundary(const LP_Config &config)
   {
      if(!IsDiscoveryRun(config))
         return true;
      return m_execution.Prepare(config);
   }

   bool ExecutionBoundaryActive()
   {
      return m_execution.Active();
   }

   bool ExecutionQuarantineActive()
   {
      return m_execution.QuarantineActive();
   }

   bool ExecutionQuarantineFlatConfirmed()
   {
      return m_execution.QuarantineFlatConfirmed();
   }

   ulong ExecutionQuarantineSteps()
   {
      return m_execution.QuarantineSteps();
   }

   string ExecutionQuarantineReason()
   {
      return m_execution.QuarantineReason();
   }

   bool ExecutionAccountDealContamination()
   {
      return m_execution.AccountDealContamination();
   }

   bool ExecutionAccountDealMutationObserved()
   {
      return m_execution.AccountDealMutationObserved();
   }

   ulong ExecutionIncrementalDealCount()
   {
      return m_execution.IncrementalDealCount();
   }

   ulong ExecutionIncrementalDealHash()
   {
      return m_execution.IncrementalDealHash();
   }

   ulong ExecutionRoutedDealCount()
   {
      return m_execution.RoutedDealCount();
   }

   ulong ExecutionRoutedDealHash()
   {
      return m_execution.RoutedDealHash();
   }

   void EnterExecutionQuarantine(const string reason,
      LP_MandatoryDiagnostics &mandatory, LP_ReceiptWriter &receipts)
   {
      m_execution.EnterQuarantine(reason, mandatory, receipts);
   }

   bool RunExecutionQuarantineStep(
      LP_PortfolioState &portfolio,
      LP_TradeRouter &router,
      LP_PositionIndex &position_index,
      LP_ReceiptWriter &receipts,
      LP_MandatoryDiagnostics &mandatory,
      bool &portfolio_dirty)
   {
      return m_execution.RunQuarantineStep(portfolio, router,
         position_index, receipts, mandatory, portfolio_dirty);
   }

   bool RememberExecutionDealSet(const LP_TradePlan &plan,
      const LP_TradeExecutionResult &execution)
   {
      return m_execution.RememberRoutedDealSet(plan, execution);
   }

    LP_ExecutionObservationOutcome ObserveExecutionTransaction(
       const MqlTradeTransaction &trans,
       const bool fatal_latched,
       LP_MandatoryDiagnostics &mandatory,
       LP_ReceiptWriter &receipts,
       string &outcome_reason)
    {
       return m_execution.ObserveTransaction(trans, fatal_latched,
          mandatory, receipts, outcome_reason);
    }

   bool FinalizeExecutionDealAudit(ulong &final_deal_count,
      ulong &final_deal_hash, bool &final_contamination, bool &exact_sets)
   {
      return m_execution.FinalizeDealAudit(final_deal_count, final_deal_hash,
         final_contamination, exact_sets);
   }

   bool IsSinglePairRun(const LP_Config &config)
   {
      return config.revma_universe_mode == LP_UNIVERSE_CURRENT_CHART;
   }

   bool OwnsIntent(const LP_TradeIntent &intent)
   {
      return intent.lane_id == LP_LANE_REVMA &&
         intent.variant_id == LP_VARIANT_REVMA_REVERSION;
   }

   void LogIntent(LP_ReceiptWriter &receipts, const LP_TradeIntent &intent)
   {
      if(!OwnsIntent(intent))
      {
         LP_LogTradeIntent(receipts, intent);
         return;
      }

      string reason = intent.human_reason;
      string payload_reference = "";
      if(receipts.CompactLongRunMode() &&
         (intent.research_lifecycle_event == LP_RESEARCH_LIFECYCLE_GRID_BIRTH ||
          intent.research_lifecycle_event == LP_RESEARCH_LIFECYCLE_GRID_ADD))
      {
         int candidate_receipt_kind =
            intent.research_lifecycle_event == LP_RESEARCH_LIFECYCLE_GRID_BIRTH ?
            LP_RECEIPT_REVMA_GRID_BIRTH : LP_RECEIPT_REVMA_GRID_ADD;
         string expected_reason =
            intent.research_lifecycle_event == LP_RESEARCH_LIFECYCLE_GRID_BIRTH ?
            "revma_grid_birth" : "revma_grid_add";
         int reason_separator = StringFind(intent.human_reason, "|");
         string actual_reason = reason_separator >= 0 ?
            StringSubstr(intent.human_reason, 0, reason_separator) :
            intent.human_reason;
         if(actual_reason == expected_reason)
         {
            reason = actual_reason;
            payload_reference =
               "|payload_contract=" + receipts.PayloadContract() +
               "|candidate_payload_role=reference" +
               "|candidate_payload_ref_receipt_type=" +
               LP_ReceiptKindName(candidate_receipt_kind) +
               "|candidate_payload_ref_status=intent_created" +
               "|candidate_payload_ref_intent_id=" +
               (string)intent.intent_id;
         }
         else
            payload_reference =
               "|payload_contract=inline_fallback_reason_mismatch" +
               "|expected_lifecycle_reason=" + expected_reason;
      }

      receipts.Write(
         LP_RECEIPT_INTENT,
         intent.symbol,
         "intent",
         "action=" + IntegerToString(intent.action) +
            "|direction=" + IntegerToString(intent.direction) +
            "|lots=" + DoubleToString(intent.requested_lots, 4) +
            "|score=" + DoubleToString(intent.score, 6) +
            "|grid_key=" + (string)intent.grid_key +
            "|research_lifecycle_event=" +
               LP_ResearchLifecycleEventName(intent.research_lifecycle_event) +
            "|research_add_type=" + intent.research_add_type +
            "|close_reason=" + intent.close_reason +
            "|source_bar_time=" + LP_Stamp(intent.source_bar_time) +
            "|expires_at=" + LP_Stamp(intent.expires_at) +
            LP_StopTakeProfitReceiptFields(
               intent.stop_take_profit_basis,
               intent.take_profit_distance_price,
               intent.stop_loss_distance_price,
               intent.target_take_profit_price,
               intent.target_stop_loss_price) +
            "|reason=" + reason + payload_reference,
         intent.lane_id,
         intent.variant_id,
         intent.grid_key,
         intent.intent_id,
         0,
         0);
   }

   bool AnySleeveStopTakeProfitEnabled(const LP_Config &config)
   {
      return LP_RevmaAnySleeveStopTakeProfitEnabled(config);
   }

   bool SymbolExecutionContractValid(
      const LP_Config &config,
      LP_SymbolSpecCache &symbol_cache,
      const string chart_symbol,
      string &reason)
   {
      reason = "";
      for(int i = 0; i < symbol_cache.Count(); i++)
      {
         LP_SymbolMeta meta;
         if(!symbol_cache.Get(i, meta))
         {
            reason = "gate108_symbol_spec_cache_read_failed";
            return false;
         }
         if(!SymbolActive(config, meta, chart_symbol))
            continue;
         double atom = LP_REVMA_DISCOVERY_ATOM_LOTS;
         long atom_units = (long)MathRound(atom / meta.lot_step);
         double normalized_atom = (double)atom_units * meta.lot_step;
         long filling_mode = (long)SymbolInfoInteger(meta.broker_symbol,
            SYMBOL_FILLING_MODE);
         bool fok_supported =
            (filling_mode & SYMBOL_FILLING_FOK) == SYMBOL_FILLING_FOK;
         if(!meta.tradable || meta.trade_mode != SYMBOL_TRADE_MODE_FULL ||
            meta.point <= 0.0 || meta.tick_size <= 0.0 ||
            meta.contract_size <= 0.0 || meta.min_lot <= 0.0 ||
            meta.max_lot < atom || meta.lot_step <= 0.0 ||
            atom + 0.000000001 < meta.min_lot || atom_units <= 0 ||
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

   double DiscoveryMoneyQuantum()
   {
      return MathPow(10.0, -LP_REVMA_DISCOVERY_ACCOUNT_CURRENCY_DIGITS);
   }

   bool DiscoveryMoneyToSignedMinor(const double money,
      const double quantum, long &minor)
   {
      return LP_RevmaDiscoveryMoneyToSignedMinor(money, quantum, minor);
   }

   bool DiscoveryMoneyBurdenToMinor(const double money,
      const double quantum, long &minor)
   {
      return LP_RevmaDiscoveryMoneyBurdenToMinor(money, quantum, minor);
   }

   bool InitializeDiscoveryRun(
      const LP_Config &config,
      const LP_PortfolioState &state,
      string &reason)
   {
      reason = "";
      if(state.open_position_count != 0 || OrdersTotal() != 0 ||
         state.managed_position_count != 0 ||
         state.entry_group_position_count != 0 ||
         state.grid_group_position_count != 0 ||
         state.external_position_count != 0 ||
         state.unknown_managed_position_count != 0)
      {
         reason = "discovery_requires_flat_strategy_account";
         return false;
      }
      if(AccountInfoString(ACCOUNT_CURRENCY) !=
         LP_REVMA_DISCOVERY_ACCOUNT_CURRENCY)
      {
         reason = "discovery_requires_flat_strategy_only_usd_account";
         return false;
      }
      double money_quantum = DiscoveryMoneyQuantum();
      long equity_reference_minor = 0;
      if(!DiscoveryMoneyBurdenToMinor(state.equity, money_quantum,
            equity_reference_minor) || equity_reference_minor <= 0)
      {
         reason = "discovery_equity_reference_quantization_failed";
         return false;
      }
      if(!PrepareExecutionBoundary(config))
      {
         reason = "discovery_account_history_baseline_capture_failed";
         return false;
      }
      string discovery_run_id = "G108A_" + LP_SafePart(
         LP_Stamp(TimeLocal()) + "_R" + IntegerToString((long)GetTickCount()));
      if(!m_revma.InitializeDiscovery(config, discovery_run_id,
            equity_reference_minor, money_quantum))
      {
         reason = "discovery_initialize_failed:" +
            m_revma.DiscoveryTelemetryInvalidReason();
         return false;
      }
      return true;
   }

   int ProcessDiscoveryCompletedM1Batch(
      const int &new_symbol_ids[],
      const MqlRates &new_symbol_bars[],
      const int new_symbol_count,
      LP_SymbolSpecCache &symbol_cache,
      LP_TickBarCache &tick_cache,
      LP_NewsCalendar &news_calendar,
      const LP_Config &config,
      LP_GridBook &grid_book,
      LP_IntentBus &bus,
      LP_RuntimeTelemetry &runtime_telemetry,
      ulong &evaluations,
      string &reason)
   {
      reason = "";
      evaluations = 0;
      LP_RevmaCompletedM1Snapshot snapshots[LP_SYMBOL_COUNT];
      bool seen[LP_SYMBOL_COUNT];
      for(int symbol_id = 0; symbol_id < LP_SYMBOL_COUNT; symbol_id++)
      {
         LP_ResetRevmaCompletedM1Snapshot(snapshots[symbol_id]);
         seen[symbol_id] = false;
      }
      for(int i = 0; i < new_symbol_count; i++)
      {
         LP_SymbolMeta meta;
         if(!symbol_cache.Get(new_symbol_ids[i], meta))
            continue;
         if(!SymbolActive(config, meta, _Symbol))
            continue;
         evaluations++;
         LP_CalendarDecision calendar;
         LP_EvaluateCalendar(new_symbol_bars[i].time, config, calendar);
         news_calendar.Apply(new_symbol_bars[i].time, meta, config, calendar);
         LP_TickSnapshot tick;
         string snapshot_reason = "";
         if(!tick_cache.RefreshTick(meta.broker_symbol, tick) ||
            !BuildCompletedM1Snapshot(meta, config, new_symbol_bars[i], tick,
               !calendar.week_boundary_blocked, !calendar.news_blocked,
               calendar.reason, snapshots[meta.symbol_id], snapshot_reason,
               runtime_telemetry))
         {
            reason = "discovery_shared_snapshot_build_failed:" +
               meta.canonical_symbol + ":" + snapshot_reason;
            m_revma.InvalidateDiscovery(reason);
            return -1;
         }
         seen[meta.symbol_id] = true;
      }
      for(int symbol_id = 0; symbol_id < LP_SYMBOL_COUNT; symbol_id++)
      {
         if(!seen[symbol_id])
         {
            reason = "discovery_shared_snapshot_fx28_incomplete";
            m_revma.InvalidateDiscovery(reason);
            return -1;
         }
      }
      return m_revma.ProcessDiscoveryCompletedM1Batch(
         snapshots, LP_SYMBOL_COUNT, grid_book, bus);
   }

   bool FinalizeDiscoveryRun(
      const LP_PortfolioState &state,
      LP_GridBook &grid_book,
      LP_ReceiptWriter &receipts)
   {
      long actual_account_equity_minor = 0;
      double money_quantum = DiscoveryMoneyQuantum();
      bool account_inventory_clean =
         state.external_position_count == 0 &&
         state.unknown_managed_position_count == 0 &&
         state.entry_group_position_count == 0 &&
         state.managed_position_count == state.grid_group_position_count &&
         OrdersTotal() == 0;
      bool equity_clean = DiscoveryMoneyToSignedMinor(state.equity,
         money_quantum, actual_account_equity_minor) &&
         actual_account_equity_minor > 0;
      bool real_reconciled = account_inventory_clean && equity_clean &&
         m_revma.ReconcileDiscoveryRealConfirmedFlat(grid_book,
            actual_account_equity_minor);
      ulong final_deal_count = 0;
      ulong final_deal_hash = 0;
      bool final_deal_contamination = false;
      bool exact_deal_sets = false;
      bool final_deal_audit_clean = m_execution.FinalizeDealAudit(
         final_deal_count, final_deal_hash, final_deal_contamination,
         exact_deal_sets);
      bool deal_audit_clean = final_deal_audit_clean && exact_deal_sets &&
         !final_deal_contamination &&
         !m_execution.AccountDealContamination() &&
         !m_execution.AccountDealMutationObserved() &&
         final_deal_hash == m_execution.IncrementalDealHash() &&
         final_deal_hash == m_execution.RoutedDealHash();
      if(!account_inventory_clean || !equity_clean || !real_reconciled ||
         !deal_audit_clean)
      {
         string audit_reason = !account_inventory_clean ?
            "discovery_final_account_inventory_contamination" :
            (!equity_clean ? "discovery_final_equity_quantization_failed" :
             (!real_reconciled ?
                "discovery_final_real_inventory_reconciliation_failed" :
                "discovery_final_account_deal_audit_mismatch"));
         m_revma.InvalidateDiscovery(audit_reason);
      }
      bool finalized = m_revma.FinalizeDiscovery();
      receipts.Summary("discovery_final_deal_count", (string)final_deal_count);
      receipts.Summary("discovery_final_deal_hash", (string)final_deal_hash);
      receipts.Summary("discovery_incremental_deal_count",
         (string)m_execution.IncrementalDealCount());
      receipts.Summary("discovery_incremental_deal_hash",
         (string)m_execution.IncrementalDealHash());
      receipts.Summary("discovery_routed_deal_count",
         (string)m_execution.RoutedDealCount());
      receipts.Summary("discovery_routed_deal_hash",
         (string)m_execution.RoutedDealHash());
      receipts.Summary("discovery_exact_deal_ticket_sets",
         LP_BoolText(exact_deal_sets));
      receipts.Summary("discovery_account_deal_mutation_observed",
         LP_BoolText(m_execution.AccountDealMutationObserved()));
      receipts.Summary("discovery_account_deal_contamination",
         LP_BoolText(final_deal_contamination ||
            m_execution.AccountDealContamination()));
      receipts.Summary("discovery_execution_quarantine_active",
         LP_BoolText(m_execution.QuarantineActive()));
      receipts.Summary("discovery_execution_quarantine_flat_confirmed",
         LP_BoolText(m_execution.QuarantineFlatConfirmed()));
      receipts.Summary("discovery_execution_quarantine_steps",
         (string)m_execution.QuarantineSteps());
      receipts.Summary("discovery_execution_quarantine_reason",
         m_execution.QuarantineReason());
      receipts.Summary("discovery_completion_valid",
         LP_BoolText(m_revma.DiscoveryCompletionValid()));
      return finalized;
   }

   int DiscoveryCohortWaitSeconds()
   {
      return LP_REVMA_DISCOVERY_COHORT_WAIT_SECONDS;
   }

   bool ValidateDiscoveryLiveState(
      const LP_PortfolioState &portfolio,
      LP_GridBook &grid_book,
      string &reason)
   {
      reason = "";
      if(portfolio.external_position_count != 0 ||
         OrdersTotal() != 0 ||
         portfolio.unknown_managed_position_count != 0 ||
         portfolio.entry_group_position_count != 0 ||
         portfolio.managed_position_count != portfolio.grid_group_position_count)
      {
         reason = "discovery_strategy_account_contamination";
         return false;
      }
      long actual_account_equity_minor = 0;
      if(!DiscoveryMoneyToSignedMinor(portfolio.equity,
            DiscoveryMoneyQuantum(), actual_account_equity_minor) ||
         actual_account_equity_minor <= 0 ||
         !m_revma.ReconcileDiscoveryRealConfirmedFlat(grid_book,
            actual_account_equity_minor))
      {
         reason = m_revma.DiscoveryTelemetryInvalidReason();
         if(reason == "")
            reason = "discovery_live_equity_or_inventory_reconciliation_failed";
         return false;
      }
      return true;
   }

   string ExecutionCommitStage(const LP_TradePlan &plan)
   {
      if(plan.action == LP_INTENT_CLOSE_GRID ||
         plan.action == LP_INTENT_CLOSE_ALL_EA ||
         plan.action == LP_INTENT_REDUCE_GRID)
         return "close_committed";
      if(plan.research_lifecycle_event == LP_RESEARCH_LIFECYCLE_GRID_BIRTH)
         return "birth_committed";
      if(plan.research_lifecycle_event == LP_RESEARCH_LIFECYCLE_GRID_ADD)
         return "add_committed";
      return "execution_commit";
   }

   bool BuildCompletedM1Snapshot(
      const LP_SymbolMeta &meta,
      const LP_Config &config,
      const MqlRates &bar,
      const LP_TickSnapshot &tick,
      const bool session_allowed,
      const bool news_allowed,
      const string calendar_reason,
      LP_RevmaCompletedM1Snapshot &snapshot,
      string &reason,
      LP_RuntimeTelemetry &runtime_telemetry)
   {
      LP_RevmaSignal signal;
      string signal_detail = "";
      if(!m_signal_state.BuildSignalAtClosedBar(meta, config, bar,
            signal, signal_detail) || !signal.valid ||
         signal.source_m1_time != bar.time)
      {
         reason = signal.reason_code == "" ?
            "revma_signal_build_failed" : signal.reason_code;
         return false;
      }

      ulong started_at = runtime_telemetry.Start();
      bool built = LP_RevmaBuildCompletedM1Snapshot(meta, signal, tick,
         session_allowed, news_allowed, calendar_reason, snapshot, reason);
      runtime_telemetry.ObserveElapsed(LP_RUNTIME_REVMA_SIGNAL_EVALUATION,
         started_at);
      return built;
   }

   int EvaluateSinglePairSymbol(
      const LP_SymbolMeta &meta,
      const LP_HarvestDecision &harvest,
      const bool stop_take_profit_block_new_entries,
      const MqlRates &latest_bar,
      const LP_Config &config,
      LP_GridBook &grid_book,
      LP_NewsCalendar &news_calendar,
      LP_ReceiptWriter &receipts,
      LP_MandatoryDiagnostics &mandatory,
      LP_RuntimeTelemetry &runtime_telemetry,
      LP_IntentBus &bus,
      const string operator_identity)
   {
      ulong started_at = runtime_telemetry.Start();
      LP_RevmaSignal signal;
      string detail = "";
      if(!m_signal_state.BuildSignalAtClosedBar(meta, config, latest_bar,
            signal, detail) || !signal.valid)
      {
         runtime_telemetry.ObserveElapsed(LP_RUNTIME_REVMA_SIGNAL_EVALUATION,
            started_at);
         return 0;
      }

      mandatory.Event("signal_created", signal.symbol,
         signal.source_m1_time, 0, 0, 0, 0, 0, "valid_revma_signal",
         "direction=" + LP_RevmaDirectionName(signal.direction) +
         "|q=" + DoubleToString(signal.q, 8) +
         "|anchor=" + DoubleToString(signal.anchor, 8), false);

      LP_CalendarDecision calendar;
      LP_EvaluateCalendar(signal.source_m1_time, config, calendar);
      news_calendar.Apply(signal.source_m1_time, meta, config, calendar);
      if(calendar.week_boundary_blocked || calendar.news_blocked)
      {
         mandatory.Event("risk_decision", signal.symbol,
            signal.source_m1_time, 0, 0, 0, 0, 0,
            calendar.news_blocked ? "news_blocked" : "session_blocked",
            "calendar_reason=" + calendar.reason, false);
         runtime_telemetry.ObserveElapsed(
            LP_RUNTIME_REVMA_SIGNAL_EVALUATION, started_at);
         return 0;
      }

      int emitted = 0;
      if(config.enable_strategy_evaluation)
      {
         LP_GridInventoryRow active_grid;
         bool has_active_grid = grid_book.FindSymbolLaneGrid(
            signal.symbol_id, LP_LANE_REVMA, active_grid);
         bool birth_allowed = false;
         bool reentry_gate_open = m_lifecycle_gate.Evaluate(signal,
            has_active_grid, receipts, birth_allowed);
         mandatory.Event("birth_gate_decision", signal.symbol,
            signal.source_m1_time, 0, 0, 0, 0, 0,
            birth_allowed && reentry_gate_open ? "allowed" : "blocked",
            "reentry_gate_open=" + LP_BoolText(reentry_gate_open) +
            "|birth_allowed=" + LP_BoolText(birth_allowed) +
            "|has_active_grid=" + LP_BoolText(has_active_grid), false);
         if(reentry_gate_open && !harvest.block_new_entries &&
            !stop_take_profit_block_new_entries)
         {
            if(birth_allowed)
               m_lifecycle_gate.WriteReceipt(receipts, signal,
                  "revma_grid_birth_allowed",
                  "fresh_state_change_gate_open", false);
            emitted = m_revma.Evaluate(signal, config, grid_book,
               receipts, bus, birth_allowed);
         }
      }

      string dashboard_text = operator_identity + "\n" +
         m_revma.VisualDashboardText();
      if(m_visual_reporter.UpdateRequired(config, dashboard_text, emitted > 0))
      {
         bool screenshot_requested = m_revma.ConsumeDashboardScreenshotRequest();
         m_visual_reporter.Update(config, dashboard_text,
            m_revma.VisualDashboardCenterlinePrice(), screenshot_requested,
            receipts);
      }

      if(emitted > 0)
      {
         string receipt_detail = detail == "" ? "ready" : detail;
         receipt_detail += "|calendar_reason=" + calendar.reason;
         LP_WriteRevmaSignalReceipt(receipts, signal, "intents_emitted",
            receipt_detail, emitted);
      }
      runtime_telemetry.ObserveElapsed(LP_RUNTIME_REVMA_SIGNAL_EVALUATION,
         started_at);
      return emitted;
   }

   bool InitializeRevmaDiscovery(
      const LP_Config &config,
      const string run_id,
      const long equity_reference_minor,
      const double money_quantum
   )
   {
      return m_revma.InitializeDiscovery(
         config, run_id, equity_reference_minor, money_quantum);
   }

   bool FinalizeRevmaDiscovery()
   {
      return m_revma.FinalizeDiscovery();
   }

   bool ReconcileRevmaDiscoveryRealConfirmedFlat(
      LP_GridBook &grid_book,
      const long actual_account_equity_minor)
   {
      return m_revma.ReconcileDiscoveryRealConfirmedFlat(grid_book,
         actual_account_equity_minor);
   }

   int ContinueRevmaDiscoveryRealCloses(
      LP_GridBook &grid_book,
      LP_IntentBus &bus)
   {
      return m_revma.ContinueDiscoveryRealCloses(grid_book, bus, 0);
   }

   int ProcessRevmaDiscoveryCompletedM1Batch(
      LP_RevmaCompletedM1Snapshot &snapshots[],
      const int snapshot_count,
      LP_GridBook &grid_book,
      LP_IntentBus &bus)
   {
      return m_revma.ProcessDiscoveryCompletedM1Batch(
         snapshots, snapshot_count, grid_book, bus);
   }

   bool EndRevmaDiscoveryRealBatch()
   {
      return m_revma.EndDiscoveryRealBatch();
   }

   bool AuthorizeRevmaDiscoveryRealIntentBeforeRoute(
      const LP_TradeIntent &intent,
      bool &authorized)
   {
      return m_revma.AuthorizeDiscoveryRealIntentBeforeRoute(intent,
         authorized);
   }

   bool RevmaDiscoveryTelemetryValid()
   {
      return m_revma.DiscoveryTelemetryValid();
   }

   string RevmaDiscoveryTelemetryInvalidReason()
   {
      return m_revma.DiscoveryTelemetryInvalidReason();
   }

   bool RevmaDiscoveryInitialized()
   {
      return m_revma.DiscoveryInitialized();
   }

   bool RevmaDiscoveryFaultLatched()
   {
      return m_revma.DiscoveryFaultLatched();
   }

   bool RevmaDiscoveryOperationalValid()
   {
      return m_revma.DiscoveryOperationalValid();
   }

   bool RevmaDiscoveryCompletionValid()
   {
      return m_revma.DiscoveryCompletionValid();
   }

   void InvalidateRevmaDiscovery(const string reason)
   {
      m_revma.InvalidateDiscovery(reason);
   }

   int LoadRevmaGridState(LP_GridBook &grid_book, LP_ReceiptWriter &receipts)
   {
      return m_revma.LoadPersistedBirths(grid_book, receipts);
   }

   int CleanupRevmaGridState(LP_GridBook &grid_book, LP_ReceiptWriter &receipts)
   {
      return m_revma.CleanupClosedBirths(grid_book, receipts);
   }

   void ObserveRevmaGridPath(LP_GridBook &grid_book)
   {
      m_revma.ObserveGridPath(grid_book);
   }

   void FinalizeRevmaResearchTelemetry(
      const LP_Config &config,
      const LP_BrokerExecutionIntegrity &broker_integrity,
      LP_ReceiptWriter &receipts
   )
   {
      m_revma.FinalizeResearchTelemetry(config, broker_integrity, receipts);
   }

   ulong RevmaLifecyclePersistenceWriteCount()
   {
      return m_revma.LifecyclePersistenceWriteCount();
   }

   ulong RevmaLifecyclePersistenceTotalMicroseconds()
   {
      return m_revma.LifecyclePersistenceTotalMicroseconds();
   }

   ulong RevmaLifecyclePersistenceMaxMicroseconds()
   {
      return m_revma.LifecyclePersistenceMaxMicroseconds();
   }

   int EvaluateRevma(
      const LP_RevmaSignal &signal,
      const LP_Config &config,
      LP_GridBook &grid_book,
      LP_ReceiptWriter &receipts,
      LP_IntentBus &bus,
      const bool birth_allowed
   )
   {
      return m_revma.Evaluate(signal, config, grid_book, receipts, bus, birth_allowed);
   }

   int EvaluateRevmaGridExits(
      const LP_Config &config,
      LP_GridBook &grid_book,
      LP_ReceiptWriter &receipts,
      LP_IntentBus &bus
   )
   {
      return m_revma.EvaluateGridExits(config, grid_book, receipts, bus);
   }

   int SyncRevmaGridTakeProfits(
      const LP_Config &config,
      LP_GridBook &grid_book,
      LP_ReceiptWriter &receipts,
      LP_IntentBus &bus
   )
   {
      return m_revma.SyncGridTakeProfits(config, grid_book, receipts, bus);
   }

   string RevmaVisualDashboardText()
   {
      return m_revma.VisualDashboardText();
   }

   double RevmaVisualCenterlinePrice()
   {
      return m_revma.VisualDashboardCenterlinePrice();
   }

   bool ConsumeRevmaDashboardScreenshotRequest()
   {
      return m_revma.ConsumeDashboardScreenshotRequest();
   }

   ulong RevmaBrokerTpSyncTicketScanCount()
   {
      return m_revma.BrokerTpSyncTicketScanCount();
   }

   bool RecordRevmaRiskDecision(
      const LP_TradeIntent &intent,
      const LP_RiskDecision &decision,
      LP_ReceiptWriter &receipts
   )
   {
      return m_revma.RecordRiskDecision(intent, decision, receipts);
   }

   bool RecordRevmaExecutionOutcome(
      const LP_TradePlan &plan,
      const LP_TradeExecutionResult &execution,
      LP_ReceiptWriter &receipts
   )
   {
      return m_revma.RecordExecutionOutcome(plan, execution, receipts);
   }

   bool RecordRevmaCloseExecution(
      const LP_TradePlan &plan,
      const LP_TradeExecutionResult &execution,
      LP_ReceiptWriter &receipts
   )
   {
      return m_revma.RecordCloseExecution(plan, execution, receipts);
   }

   bool HasLatchedRevmaGridClose()
   {
      return m_revma.HasLatchedGridClose();
   }
};

#endif // __LIMNI_PORTFOLIO_REVMA_ADAPTER_MQH__
