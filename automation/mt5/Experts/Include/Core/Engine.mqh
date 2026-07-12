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
#include "..\\Strategies\\Revma\\RevmaAdapter.mqh"
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
   bool m_discovery_active;
   int m_step_count;
   int m_tick_count;
   int m_timer_count;
   int m_total_new_bars;
   int m_total_closed_m1_cycles;
   int m_total_intents;
   int m_total_position_grid_refreshes;
   int m_total_grid_exit_scans;
   int m_total_tp_sync_scans;
   ulong m_total_strategy_symbol_evaluations;
   ulong m_next_system_intent_id;
   uint m_started_tick_count;
   ulong m_last_attribution_hash;
   ulong m_last_currency_exposure_hash;
   ulong m_last_grid_inventory_hash;
   ulong m_last_strategy_tp_sync_scan_hash;
   int m_closed_m1_cycles_since_tp_sync;
   bool m_cached_portfolio_valid;
   bool m_portfolio_dirty;
   bool m_stop_take_profit_liquidation_active;
   bool m_fatal_invariant_latched;
   int m_cached_positions_total;
   datetime m_last_tester_chart_closed_m1_time;
   datetime m_pending_cohort_first_seen_time;
   datetime m_pending_cohort_target_m1_time;
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
   LP_RevmaAdapter m_revma_adapter;
   LP_IntentBus m_intent_bus;
   LP_PositionCommissionCache m_position_commission_cache;
   LP_PositionIndex m_position_index;
   LP_GridBook m_grid_book;
   LP_CurrencyExposureGuard m_currency_guard;
   LP_AccountHarvestGuard m_account_guard;
   LP_PortfolioStopTakeProfitGuard m_stop_take_profit_guard;
   LP_RiskArbiter m_risk_arbiter;
   LP_TradeRouter m_trade_router;

   bool DiscoveryRun()
   {
      return m_revma_adapter.IsDiscoveryRun(m_config);
   }

   bool SinglePairRun()
   {
      return m_revma_adapter.IsSinglePairRun(m_config);
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
       if(m_discovery_active && m_initialized &&
          !m_revma_adapter.ExecutionQuarantineActive() &&
          (PositionsTotal() > 0 || OrdersTotal() > 0))
       {
          m_revma_adapter.EnterExecutionQuarantine(first_reason,
             m_mandatory, m_receipts);
          WriteError("strategy_execution_quarantine_latched",
             m_revma_adapter.ExecutionQuarantineReason());
      }
      m_fatal_invariant_latched = true;
      if(m_discovery_active)
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

   void EnterExecutionQuarantine(const string reason)
   {
      if(!m_discovery_active)
      {
         WriteError("strategy_execution_quarantine_ignored_outside_discovery", reason);
         return;
      }
      m_revma_adapter.EnterExecutionQuarantine(reason, m_mandatory,
         m_receipts);
      WriteError("strategy_execution_quarantine_latched",
         m_revma_adapter.ExecutionQuarantineReason());
      m_fatal_invariant_latched = true;
   }

   void RunExecutionQuarantineStep()
   {
      if(!m_revma_adapter.ExecutionQuarantineActive())
         return;
      m_position_index.MarkDirty();
      m_portfolio_dirty = true;
      LP_PortfolioState portfolio;
      RefreshPortfolioAndGrid(portfolio);
      m_revma_adapter.RunExecutionQuarantineStep(
         portfolio, m_trade_router, m_position_index, m_receipts,
         m_mandatory, m_portfolio_dirty);
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
      m_receipts.Summary("runtime_profile_strategy_symbol_evaluations", (string)m_total_strategy_symbol_evaluations);
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
         (string)m_total_strategy_symbol_evaluations,
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

   int EvaluateSinglePairStrategySymbol(
      const LP_SymbolMeta &meta,
      const LP_HarvestDecision &harvest,
      const bool stop_take_profit_block_new_entries,
      const MqlRates &latest_bar
   )
   {
      m_total_strategy_symbol_evaluations++;
      int emitted = m_revma_adapter.EvaluateSinglePairSymbol(
         meta, harvest, stop_take_profit_block_new_entries, latest_bar,
         m_config, m_grid_book, m_news_calendar, m_receipts, m_mandatory,
         m_runtime_telemetry, m_intent_bus, OperatorIdentityText());
      if(emitted > 0)
         m_total_intents += emitted;
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
      m_discovery_active = false;
      m_step_count = 0;
      m_tick_count = 0;
      m_timer_count = 0;
      m_total_new_bars = 0;
      m_total_closed_m1_cycles = 0;
      m_total_intents = 0;
      m_total_position_grid_refreshes = 0;
      m_total_grid_exit_scans = 0;
      m_total_tp_sync_scans = 0;
      m_total_strategy_symbol_evaluations = 0;
      m_next_system_intent_id = 990900000001;
      m_started_tick_count = 0;
      m_last_attribution_hash = 0;
      m_last_currency_exposure_hash = 0;
      m_last_grid_inventory_hash = 0;
      m_last_strategy_tp_sync_scan_hash = 0;
      m_closed_m1_cycles_since_tp_sync = 0;
      m_cached_portfolio_valid = false;
      m_portfolio_dirty = true;
      m_stop_take_profit_liquidation_active = false;
      m_fatal_invariant_latched = false;
      m_cached_positions_total = -1;
      m_last_tester_chart_closed_m1_time = 0;
      m_pending_cohort_first_seen_time = 0;
      m_pending_cohort_target_m1_time = 0;
      m_mandatory_history_waiting = false;
      m_last_mandatory_inventory_hash = 0;
      m_receipts.Reset();
      m_runtime_telemetry.Reset();
      m_symbol_cache.Reset();
      m_news_calendar.Reset();
      m_clock.Reset();
      if(!m_revma_adapter.Reset())
         return false;
      m_intent_bus.Reset();
      m_position_commission_cache.Reset();
      m_position_index.Reset();
      m_grid_book.Reset();
      m_currency_guard.Reset();
      m_account_guard.Reset();
      m_stop_take_profit_guard.Reset();
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
      m_discovery_active = DiscoveryRun();

      if(!m_mandatory.Open(m_config, m_config_hash, m_symbol_universe_hash))
         return INIT_FAILED;
      m_mandatory.Event("initialization", "", 0, 0, 0, 0, 0, 0, "",
         "phase=preflight|discovery_active=" +
         LP_BoolText(m_discovery_active), false);

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
         !m_revma_adapter.SymbolExecutionContractValid(m_config,
            m_symbol_cache, _Symbol, symbol_execution_reason))
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

       if(m_discovery_active)
       {
          string discovery_reason = "";
          if(!m_revma_adapter.InitializeDiscoveryRun(m_config, state,
                discovery_reason))
          {
             string failure = discovery_reason == "" ?
                "discovery_initialize_failed" : discovery_reason;
             WriteError("init_failed", failure);
             m_receipts.Flush();
             FailInitialization(failure);
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
       if(m_revma_adapter.RevmaDiscoveryInitialized())
       {
          discovery_finalize_ok = m_revma_adapter.FinalizeDiscoveryRun(
             state, m_grid_book, m_receipts);
          if(!discovery_finalize_ok)
             WriteError("strategy_discovery_finalize_failed",
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
         "|discovery_finalize_ok=" + LP_BoolText(discovery_finalize_ok),
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

   void MarkTradeTransactionDirty(const MqlTradeTransaction &trans)
   {
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
      if(m_discovery_active)
      {
         string observation_reason = "";
         LP_ExecutionObservationOutcome observation =
            m_revma_adapter.ObserveExecutionTransaction(trans,
               m_fatal_invariant_latched, m_mandatory, m_receipts,
               observation_reason);
         if(observation != LP_EXECUTION_OBSERVATION_OK)
         {
            MarkTradeTransactionDirty(trans);
            string failure_reason = observation_reason == "" ?
               "strategy_execution_observation_failed" : observation_reason;
            LatchFatalInvariant(failure_reason);
            string outcome_name = observation ==
               LP_EXECUTION_OBSERVATION_QUARANTINE ?
               "quarantine" : "audit_failure";
            m_receipts.Write(
               LP_RECEIPT_TRADE_TRANSACTION,
               trans.symbol,
               "transaction_observation_failure",
               "type=" + IntegerToString((int)trans.type) +
                  "|order=" + (string)trans.order +
                  "|deal=" + (string)trans.deal +
                  "|observation_outcome=" + outcome_name +
                  "|reason=" + failure_reason +
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
            m_runtime_telemetry.ObserveElapsed(LP_RUNTIME_RECEIPT_FLUSH,
               transaction_flush_started_at);
            return;
         }
      }
      MarkTradeTransactionDirty(trans);
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
          if(m_revma_adapter.ExecutionQuarantineActive())
            RunExecutionQuarantineStep();
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
       bool force_initial_discovery_scan = m_step_count == 1 &&
          m_revma_adapter.IsDiscoveryRun(m_config);
      bool scan_symbol_clocks = !tester_fast_cadence ||
          force_initial_discovery_scan ||
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
            if(!m_revma_adapter.SymbolActive(m_config, meta, _Symbol))
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
                   m_revma_adapter.DiscoveryCohortWaitSeconds())
               {
                  LatchFatalInvariant(single_pair_run ?
                     "single_pair_m1_history_wait_timeout" :
                     "discovery_m1_history_wait_timeout");
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
               LatchFatalInvariant("discovery_m1_cohort_symbol_overflow");
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
                  m_revma_adapter.DiscoveryCohortWaitSeconds())
               {
                  LatchFatalInvariant(
                     "discovery_m1_cohort_synchronization_timeout");
                  return;
               }
            }
            else
            {
               if(!m_clock.CommitCohort(cohort_states, cohort_count))
               {
                  LatchFatalInvariant(
                     "discovery_m1_cohort_atomic_commit_failed");
                  return;
               }
               m_pending_cohort_first_seen_time = 0;
               m_pending_cohort_target_m1_time = 0;
               cycle_new_bars = LP_SYMBOL_COUNT;
               new_symbol_count = LP_SYMBOL_COUNT;
               forced_initial_symbols = force_initial_discovery_scan ?
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
      if(!m_discovery_active &&
         (portfolio.external_position_count != 0 ||
          OrdersTotal() != 0 ||
          portfolio.unknown_managed_position_count != 0 ||
          portfolio.entry_group_position_count != 0 ||
          portfolio.managed_position_count !=
             portfolio.grid_group_position_count))
      {
         LatchFatalInvariant("strategy_account_contamination");
         return;
      }
      if(m_discovery_active)
      {
         string discovery_state_reason = "";
         if(!m_revma_adapter.ValidateDiscoveryLiveState(portfolio,
               m_grid_book, discovery_state_reason))
         {
            LatchFatalInvariant(discovery_state_reason == "" ?
               m_revma_adapter.RevmaDiscoveryTelemetryInvalidReason() :
               discovery_state_reason);
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
      if(m_discovery_active && cycle_new_bars == 0)
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
         m_revma_adapter.AnySleeveStopTakeProfitEnabled(m_config) &&
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
          m_last_strategy_tp_sync_scan_hash != m_grid_book.SnapshotHash() ||
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
         m_last_strategy_tp_sync_scan_hash = m_grid_book.SnapshotHash();
         m_closed_m1_cycles_since_tp_sync = 0;
         if(revma_grid_tp_sync_intents > 0)
            m_total_intents += revma_grid_tp_sync_intents;
         m_runtime_telemetry.ObserveElapsed(LP_RUNTIME_BROKER_TP_SYNC, broker_tp_sync_started_at);
      }

       if(cycle_new_bars > 0)
       {
          if(m_discovery_active)
          {
              string discovery_snapshot_reason = "";
              ulong batch_evaluations = 0;
              int discovery_intents =
                 m_revma_adapter.ProcessDiscoveryCompletedM1Batch(
                   new_symbol_ids, new_symbol_bars, new_symbol_count,
                   m_symbol_cache, m_tick_cache, m_news_calendar, m_config,
                    m_grid_book, m_intent_bus, m_runtime_telemetry,
                    batch_evaluations,
                    discovery_snapshot_reason);
              m_total_strategy_symbol_evaluations += batch_evaluations;
             if(discovery_intents < 0 ||
                m_revma_adapter.RevmaDiscoveryFaultLatched())
             {
                LatchFatalInvariant(discovery_snapshot_reason == "" ?
                   m_revma_adapter.RevmaDiscoveryTelemetryInvalidReason() :
                   discovery_snapshot_reason);
                return;
             }
             if(discovery_intents > 0)
                m_total_intents += discovery_intents;
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
            EvaluateSinglePairStrategySymbol(
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

      if(m_discovery_active &&
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
      if(m_discovery_active &&
            !m_revma_adapter.AuthorizeRevmaDiscoveryRealIntentBeforeRoute(
               intent, discovery_route_authorized))
         {
            LatchFatalInvariant(
               m_revma_adapter.RevmaDiscoveryTelemetryInvalidReason());
            return;
         }
         if(!discovery_route_authorized)
            continue;

          m_revma_adapter.LogIntent(m_receipts, intent);

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
               "|execution_contract_present=" +
                  LP_BoolText(LP_ExecutionContractPresent(plan.execution_contract)), false);
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
            if(!m_revma_adapter.RememberExecutionDealSet(plan, execution))
            {
               EnterExecutionQuarantine(
                  "strategy_routed_deal_set_capture_failed");
               RunExecutionQuarantineStep();
               return;
            }
            if(m_fatal_invariant_latched)
            {
               if(broker_state_may_have_changed)
               {
                  EnterExecutionQuarantine(
                     "strategy_transaction_audit_failed_during_route");
                  RunExecutionQuarantineStep();
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
                  EnterExecutionQuarantine(failure_reason);
                  RunExecutionQuarantineStep();
               }
               else
                  LatchFatalInvariant(failure_reason);
               return;
            }
            if(execution.accepted)
            {
               string commit_stage = m_revma_adapter.ExecutionCommitStage(plan);
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
                  EnterExecutionQuarantine(failure_reason);
                  RunExecutionQuarantineStep();
               }
               else
                  LatchFatalInvariant(failure_reason);
               return;
            }
         }
      }

      if(m_discovery_active &&
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
