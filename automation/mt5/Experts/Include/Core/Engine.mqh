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
#include "..\\Signals\\LrmgState.mqh"
#include "..\\Signals\\RevmaSignalState.mqh"
#include "..\\Strategies\\StrategyRegistry.mqh"
#include "..\\Strategies\\Revma\\RevmaLifecycleGate.mqh"
#include "..\\Strategies\\Revma\\RevmaReceipts.mqh"
#include "..\\Strategies\\Revma\\RevmaVisualReporter.mqh"
#include "..\\Strategies\\PortfolioIntentSelector.mqh"
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
   datetime m_last_portfolio_qstate_asof;
   ulong m_last_portfolio_qstate_hash;
   bool m_cached_portfolio_valid;
   bool m_portfolio_dirty;
   bool m_stop_take_profit_liquidation_active;
   bool m_fatal_invariant_latched;
   int m_cached_positions_total;
   datetime m_last_tester_chart_closed_m1_time;
   LP_PortfolioState m_cached_portfolio;
   LP_SignalSnapshot m_latest_signals[LP_SYMBOL_COUNT];
   bool m_signal_available[LP_SYMBOL_COUNT];

   LP_ReceiptWriter m_receipts;
   LP_RuntimeTelemetry m_runtime_telemetry;
   LP_SymbolSpecCache m_symbol_cache;
   LP_NewsCalendar m_news_calendar;
   LP_TickBarCache m_tick_cache;
   LP_M1Clock m_clock;
   LP_LrmgState m_lrmg_state;
   LP_RevmaSignalState m_revma_state;
   LP_StrategyRegistry m_strategy_registry;
   LP_RevmaLifecycleGate m_revma_lifecycle_gate;
   LP_RevmaVisualReporter m_revma_visual_reporter;
   LP_PortfolioIntentSelector m_intent_selector;
   LP_IntentBus m_intent_bus;
   LP_PositionCommissionCache m_position_commission_cache;
   LP_PositionIndex m_position_index;
   LP_GridBook m_grid_book;
   LP_CurrencyExposureGuard m_currency_guard;
   LP_AccountHarvestGuard m_account_guard;
   LP_PortfolioStopTakeProfitGuard m_stop_take_profit_guard;
   LP_RiskArbiter m_risk_arbiter;
   LP_TradeRouter m_trade_router;

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
      Print(LP_EA_NAME, " ", status, ": ", message);
   }

   void LatchFatalInvariant(const string reason)
   {
      if(m_fatal_invariant_latched)
         return;
      m_fatal_invariant_latched = true;
      m_strategy_registry.InvalidateRevmaDiscovery(reason);
      WriteError("fatal_invariant_latched", reason);
   }

   ulong NextSystemIntentId()
   {
      ulong id = m_next_system_intent_id;
      m_next_system_intent_id++;
      return id;
   }

   void ClearSignalAvailability()
   {
      for(int i = 0; i < LP_SYMBOL_COUNT; i++)
         m_signal_available[i] = false;
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
      m_runtime_telemetry.ObserveElapsed(LP_RUNTIME_INVENTORY_REFRESH, started_at);
   }

   void WriteRuntimeProfileSummary()
   {
      double elapsed_seconds = 0.0;
      if(m_started_tick_count > 0)
         elapsed_seconds = (double)(GetTickCount() - m_started_tick_count) / 1000.0;
      ulong broker_tp_sync_ticket_scans = m_strategy_registry.RevmaBrokerTpSyncTicketScanCount() +
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
         LP_EA_NAME,
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

   ulong BuildPortfolioQStateHash(const LP_SignalSnapshot &signals[])
   {
      string payload = LimniQStateFormulaId() + "|" + (string)LimniQStateFormulaHash();
      for(int symbol_id = 0; symbol_id < LP_SYMBOL_COUNT; symbol_id++)
      {
         const LP_SignalSnapshot signal = signals[symbol_id];
         payload += "|" + IntegerToString(symbol_id) +
            ":" + LP_Stamp(signal.source_m1_time) +
            ":" + DoubleToString(signal.pair_q_score, 6) +
            ":" + DoubleToString(signal.base_currency_score, 6) +
            ":" + DoubleToString(signal.quote_currency_score, 6) +
            ":" + DoubleToString(signal.pair_direction_score, 6) +
            ":" + IntegerToString(signal.pair_state) +
            ":" + IntegerToString(signal.market_mode);
      }
      return LP_HashString(payload);
   }

   bool BuildPortfolioQStateSnapshot(
      LP_PortfolioQStateSnapshot &snapshot,
      LP_SignalSnapshot &signals[],
      bool &available[]
   )
   {
      LP_ResetPortfolioQStateSnapshot(snapshot);
      for(int i = 0; i < LP_SYMBOL_COUNT; i++)
      {
         LP_ResetSignalSnapshot(signals[i]);
         available[i] = false;
      }

      for(int symbol_id = 0; symbol_id < LP_SYMBOL_COUNT; symbol_id++)
      {
         LP_SymbolMeta meta;
         if(!m_symbol_cache.Get(symbol_id, meta))
         {
            snapshot.reason_code = "symbol_meta_unavailable";
            snapshot.detail = "symbol_id=" + IntegerToString(symbol_id);
            return false;
         }

         LP_TickSnapshot tick;
         m_tick_cache.RefreshTick(meta.broker_symbol, tick);

         LP_SignalSnapshot signal;
         if(!m_lrmg_state.BuildQStatePairSnapshot(meta, signal))
         {
            snapshot.reason_code = signal.reason_code == "" ? "pair_qstate_build_failed" : signal.reason_code;
            snapshot.detail = "symbol=" + meta.broker_symbol;
            return false;
         }

         if(snapshot.asof_m1_time <= 0)
            snapshot.asof_m1_time = signal.source_m1_time;
         else if(signal.source_m1_time != snapshot.asof_m1_time)
         {
            snapshot.reason_code = "mixed_source_m1_time";
            snapshot.detail = "symbol=" + meta.broker_symbol +
               "|expected=" + LP_Stamp(snapshot.asof_m1_time) +
               "|actual=" + LP_Stamp(signal.source_m1_time);
            return false;
         }

         LP_CalendarDecision calendar;
         LP_EvaluateCalendar(snapshot.asof_m1_time, m_config, calendar);
         m_news_calendar.Apply(snapshot.asof_m1_time, meta, m_config, calendar);
         signal.session_allowed = !calendar.week_boundary_blocked;
         signal.news_allowed = !calendar.news_blocked;
         signal.reason = calendar.reason;

         signals[symbol_id] = signal;
         available[symbol_id] = true;
         snapshot.valid_pair_count++;
      }

      if(snapshot.valid_pair_count != LP_SYMBOL_COUNT)
      {
         snapshot.reason_code = "incomplete_portfolio_qstate";
         snapshot.detail = "valid_pair_count=" + IntegerToString(snapshot.valid_pair_count);
         return false;
      }

      for(int symbol_id = 0; symbol_id < LP_SYMBOL_COUNT; symbol_id++)
      {
         signals[symbol_id].portfolio_asof_m1_time = snapshot.asof_m1_time;
         signals[symbol_id].portfolio_valid_pair_count = snapshot.valid_pair_count;
      }

      m_lrmg_state.ApplyCurrencyQState(signals, available, m_config);
      snapshot.snapshot_hash = BuildPortfolioQStateHash(signals);
      snapshot.valid = true;
      snapshot.reason_code = "portfolio_qstate_ready";
      snapshot.detail = "all_pairs_same_closed_m1";

      for(int symbol_id = 0; symbol_id < LP_SYMBOL_COUNT; symbol_id++)
         signals[symbol_id].portfolio_snapshot_hash = snapshot.snapshot_hash;

      return true;
   }

   bool AddHarvestCloseIntent(const LP_HarvestDecision &harvest, LP_IntentBus &bus)
   {
      LP_TradeIntent intent;
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

      LP_CalendarDecision calendar;
      LP_EvaluateCalendar(signal.source_m1_time, m_config, calendar);
      m_news_calendar.Apply(signal.source_m1_time, meta, m_config, calendar);
      if(calendar.week_boundary_blocked || calendar.news_blocked)
      {
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
         if(reentry_gate_open && !harvest.block_new_entries && !stop_take_profit_block_new_entries)
         {
            if(birth_allowed)
               m_revma_lifecycle_gate.WriteReceipt(m_receipts, signal, "revma_grid_birth_allowed", "fresh_state_change_gate_open", false);
            emitted = m_strategy_registry.EvaluateRevma(signal, m_config, m_grid_book, m_receipts, m_intent_bus, birth_allowed);
         }
      }

      string dashboard_text = m_strategy_registry.RevmaVisualDashboardText();
      if(m_revma_visual_reporter.UpdateRequired(m_config, dashboard_text, emitted > 0))
      {
         bool screenshot_requested = m_strategy_registry.ConsumeRevmaDashboardScreenshotRequest();
         double centerline_price = m_strategy_registry.RevmaVisualCenterlinePrice();
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
      if(!m_strategy_registry.CanReset())
         return false;
      m_config_hash = 0;
      m_symbol_universe_hash = 0;
      m_initialized = false;
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
      m_last_portfolio_qstate_asof = 0;
      m_last_portfolio_qstate_hash = 0;
      m_cached_portfolio_valid = false;
      m_portfolio_dirty = true;
      m_stop_take_profit_liquidation_active = false;
      m_fatal_invariant_latched = false;
      m_cached_positions_total = -1;
      m_last_tester_chart_closed_m1_time = 0;
      for(int i = 0; i < LP_SYMBOL_COUNT; i++)
      {
         LP_ResetSignalSnapshot(m_latest_signals[i]);
         m_signal_available[i] = false;
      }
      m_receipts.Reset();
      m_runtime_telemetry.Reset();
      m_symbol_cache.Reset();
      m_news_calendar.Reset();
      m_clock.Reset();
      m_lrmg_state.Reset();
      m_revma_state.Reset();
      if(!m_strategy_registry.Reset())
         return false;
      m_intent_selector.Reset();
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
      if(!Reset())
      {
         Print(LP_EA_NAME, " discovery reset preflight failed.");
         return INIT_FAILED;
      }
      m_started_tick_count = GetTickCount();
      LP_LoadConfig(m_config);
      m_config_hash = LP_ConfigHash(m_config);
      m_symbol_universe_hash = LP_SymbolUniverseHash(m_config.broker_symbol_suffix);

      if(!m_receipts.Open(m_config, m_config_hash, m_symbol_universe_hash))
      {
         Print(LP_EA_NAME, " failed to open receipt files.");
         return INIT_FAILED;
      }

      LP_WriteRunManifest(m_receipts, m_config, m_config_hash, m_symbol_universe_hash);

      if(m_config.require_hedging_account && !LP_HedgingAccount())
      {
         WriteError("init_failed", "hedging_account_required");
         m_receipts.Flush();
         return INIT_FAILED;
      }

      if(LiveNewsBarrierFails())
      {
         WriteError("init_failed", "live_mode_requires_enabled_news_guard_source");
         m_receipts.Flush();
         return INIT_FAILED;
      }

      if(LiveSchedulerBarrierFails())
      {
         WriteError("init_failed", "live_mode_requires_timer_watchdog");
         m_receipts.Flush();
         return INIT_FAILED;
      }

      bool symbols_ok = m_symbol_cache.Load(m_config, m_receipts);
      if(!symbols_ok)
      {
         WriteError("init_failed", "symbol_universe_incomplete");
         m_receipts.Flush();
         return INIT_FAILED;
      }

      bool news_ok = m_news_calendar.Load(m_config, m_receipts);
      if(!news_ok)
      {
         WriteError("init_failed", "news_guard_source_unavailable");
         m_receipts.Flush();
         return INIT_FAILED;
      }

      m_account_guard.Configure(m_config);
      m_currency_guard.Configure(m_config);
      m_strategy_registry.SetEnabled(m_config.enable_strategy_evaluation);
      m_strategy_registry.Configure(m_config_hash, m_config);
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
      m_strategy_registry.LoadRevmaGridState(m_grid_book, m_receipts);
      m_strategy_registry.CleanupRevmaGridState(m_grid_book, m_receipts);
      m_strategy_registry.ObserveRevmaGridPath(m_grid_book);

      LP_HarvestDecision harvest;
      m_account_guard.Evaluate(state, harvest);
      if(harvest.receipt_required)
         LP_WriteHarvestState(m_receipts, harvest);

      if(m_config.use_timer_watchdog)
         EventSetTimer(m_config.timer_watchdog_seconds);

      m_initialized = true;
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

      Print(LP_EA_NAME, " initialized. run_id=", m_receipts.RunId(), " execution=", LP_ExecutionModeName(m_config.execution_mode));
      return INIT_SUCCEEDED;
   }

   void OnDeinit(const int reason)
   {
      if(m_config.use_timer_watchdog)
         EventKillTimer();

       LP_PortfolioState state;
       m_position_index.MarkDirty();
       RefreshPortfolioAndGrid(state);
       m_strategy_registry.ObserveRevmaGridPath(m_grid_book);
       m_strategy_registry.CleanupRevmaGridState(m_grid_book, m_receipts);
       LP_WritePortfolioSummary(m_receipts, state);

      m_receipts.Summary("deinit_reason", IntegerToString(reason));
      m_receipts.Summary("engine_steps", IntegerToString(m_step_count));
      m_receipts.Summary("total_ticks", IntegerToString(m_tick_count));
      m_receipts.Summary("total_new_bars", IntegerToString(m_total_new_bars));
       m_receipts.Summary("total_closed_m1_evaluation_cycles", IntegerToString(m_total_closed_m1_cycles));
       m_receipts.Summary("total_intents", IntegerToString(m_total_intents));
       m_receipts.Write(LP_RECEIPT_RUN_END, "", "deinit", "reason=" + IntegerToString(reason), 0, 0, 0, 0, 0, 0);
       LP_BrokerExecutionIntegrity broker_integrity;
       m_trade_router.GetBrokerExecutionIntegrity(broker_integrity);
       m_strategy_registry.FinalizeRevmaResearchTelemetry(m_config, broker_integrity, m_receipts);
      m_runtime_telemetry.ObserveAggregate(
         LP_RUNTIME_LIFECYCLE_PERSISTENCE,
         m_strategy_registry.RevmaLifecyclePersistenceWriteCount(),
         m_strategy_registry.RevmaLifecyclePersistenceTotalMicroseconds(),
         m_strategy_registry.RevmaLifecyclePersistenceMaxMicroseconds()
      );
      WriteRuntimeProfileSummary();
      m_receipts.Close();
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
      if(!m_initialized)
         return;
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
         return;

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
      bool tester_fast_cadence = TesterRuntime();
      bool force_initial_fx28_scan = m_step_count == 1 && m_config.revma_universe_mode == LP_UNIVERSE_FX28;
      bool scan_symbol_clocks = !tester_fast_cadence || force_initial_fx28_scan || TesterClosedM1ScanDue();
      ulong closed_m1_scan_started_at = m_runtime_telemetry.Start();
      if(scan_symbol_clocks)
      {
         for(int i = 0; i < m_symbol_cache.Count(); i++)
         {
            LP_SymbolMeta meta;
            if(!m_symbol_cache.Get(i, meta))
               continue;
            if(!LP_RevmaSymbolActive(m_config, meta, _Symbol))
               continue;
            active_symbols_scanned++;

            LP_BarClockState clock_state;
            if(!m_clock.RefreshSymbol(meta, clock_state))
               continue;
            clock_ready_symbols++;

            bool evaluate_symbol = clock_state.new_bar;
            if(!evaluate_symbol && force_initial_fx28_scan)
            {
               evaluate_symbol = true;
               forced_initial_symbols++;
            }

            if(!evaluate_symbol)
               continue;

            cycle_new_bars++;
            if(new_symbol_count < LP_SYMBOL_COUNT)
            {
               new_symbol_ids[new_symbol_count] = meta.symbol_id;
               new_symbol_bars[new_symbol_count].time = clock_state.last_bar_time;
               new_symbol_bars[new_symbol_count].close = clock_state.close;
               new_symbol_count++;
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
      m_strategy_registry.ObserveRevmaGridPath(m_grid_book);

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
         m_strategy_registry.CleanupRevmaGridState(m_grid_book, m_receipts);
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
       bool revma_grid_close_latched = m_strategy_registry.HasLatchedRevmaGridClose();
       bool should_scan_grid_exits = !account_liquidation_owns_closes && portfolio.open_grid_count > 0 &&
          (revma_grid_close_latched || !tester_fast_cadence || cycle_new_bars > 0 || grid_inventory_changed || dirty_before_refresh || m_stop_take_profit_liquidation_active);
      if(should_scan_grid_exits)
      {
         ulong grid_close_started_at = m_runtime_telemetry.Start();
         m_total_grid_exit_scans++;
         revma_grid_exit_intents = m_strategy_registry.EvaluateRevmaGridExits(
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
      bool should_scan_tp_sync = portfolio.open_grid_count > 0 &&
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
         revma_grid_tp_sync_intents = m_strategy_registry.SyncRevmaGridTakeProfits(
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
         for(int i = 0; i < new_symbol_count; i++)
         {
            LP_SymbolMeta meta;
            if(!m_symbol_cache.Get(new_symbol_ids[i], meta))
               continue;
            if(!LP_RevmaSymbolActive(m_config, meta, _Symbol))
               continue;
            EvaluateRevmaSymbol(meta, harvest, exit_block_new_entries, new_symbol_bars[i]);
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

      if(m_strategy_registry.RevmaDiscoveryFaultLatched() ||
         (m_strategy_registry.RevmaDiscoveryInitialized() &&
         !m_strategy_registry.RevmaDiscoveryOperationalValid())
      )
      {
         LatchFatalInvariant(
            m_strategy_registry.RevmaDiscoveryTelemetryInvalidReason());
         return;
      }

      m_currency_guard.BeginIntentBatch();
      for(int intent_index = 0; intent_index < m_intent_bus.Count(); intent_index++)
      {
         LP_TradeIntent intent;
         if(!m_intent_bus.Get(intent_index, intent))
            continue;

         LP_LogTradeIntent(m_receipts, intent);

         LP_RiskDecision decision;
         LP_TradePlan plan;
         ulong risk_reservation_started_at = m_runtime_telemetry.Start();
         m_risk_arbiter.Decide(intent, portfolio, m_currency_guard, decision, plan);
         m_runtime_telemetry.ObserveElapsed(LP_RUNTIME_RISK_RESERVATION, risk_reservation_started_at);
         LP_LogRiskDecision(m_receipts, decision);
         if(!m_strategy_registry.RecordRevmaRiskDecision(
            intent, decision, m_receipts))
         {
            LatchFatalInvariant(
               m_strategy_registry.RevmaDiscoveryTelemetryInvalidReason());
            return;
         }
         if(plan.executable)
            LP_LogTradePlan(m_receipts, plan);
         if(plan.executable)
         {
            LP_TradeExecutionResult execution;
            m_trade_router.Execute(plan, m_receipts, execution);
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
            if(!m_strategy_registry.RecordRevmaExecutionOutcome(
               plan, execution, m_receipts))
            {
               LatchFatalInvariant(
                  m_strategy_registry.RevmaDiscoveryTelemetryInvalidReason());
               return;
            }
            if(!m_strategy_registry.RecordRevmaCloseExecution(
               plan, execution, m_receipts))
            {
               LatchFatalInvariant(
                  m_strategy_registry.RevmaDiscoveryTelemetryInvalidReason());
               return;
            }
            m_position_index.MarkDirty();
            m_portfolio_dirty = true;
         }
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
               "|forced_initial_fx28_symbols=" + IntegerToString(forced_initial_symbols) +
               "|total_new_bars=" + IntegerToString(m_total_new_bars) +
               "|intents=" + IntegerToString(m_intent_bus.Count()) +
               "|active_system=" + LP_REVMA_SYSTEM_ID +
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
