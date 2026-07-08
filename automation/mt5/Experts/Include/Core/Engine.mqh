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

class LP_Engine
{
private:
   LP_Config m_config;
   ulong m_config_hash;
   ulong m_symbol_universe_hash;
   bool m_initialized;
   int m_step_count;
   int m_total_new_bars;
   int m_total_intents;
   ulong m_next_system_intent_id;
   ulong m_last_attribution_hash;
   ulong m_last_currency_exposure_hash;
   ulong m_last_grid_inventory_hash;
   datetime m_last_portfolio_qstate_asof;
   ulong m_last_portfolio_qstate_hash;
   LP_SignalSnapshot m_latest_signals[LP_SYMBOL_COUNT];
   bool m_signal_available[LP_SYMBOL_COUNT];

   LP_ReceiptWriter m_receipts;
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

   void WriteError(const string status, const string message)
   {
      m_receipts.Write(LP_RECEIPT_ERROR, "", status, message, 0, 0, 0, 0, 0, 0);
      Print(LP_EA_NAME, " ", status, ": ", message);
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

   void AddHarvestCloseIntent(const LP_HarvestDecision &harvest, LP_IntentBus &bus)
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
      intent.stop_take_profit_basis = "";
      intent.priority = 100;
      intent.score = harvest.managed_floating_pnl;
      intent.grid_key = 0;
      intent.config_hash = m_config_hash;
      intent.strategy_version_hash = LP_HashString("gate99w_harvest_close_all_next_day_reentry");
      intent.human_reason = "portfolio_harvest_state=" + LP_HarvestStateName(harvest.state) +
         "|reason=" + harvest.reason +
         "|managed_floating_pnl=" + DoubleToString(harvest.managed_floating_pnl, 2) +
         "|hwm=" + DoubleToString(harvest.high_watermark_money, 2) +
         "|trail_floor=" + DoubleToString(harvest.trail_floor_money, 2);
      bus.Add(intent);
   }

   int EvaluateRevmaSymbol(
      const LP_SymbolMeta &meta,
      const LP_HarvestDecision &harvest,
      const bool stop_take_profit_block_new_entries
   )
   {
      LP_RevmaSignal signal;
      string detail = "";
      if(!m_revma_state.BuildSignal(meta, m_config, signal, detail))
         return 0;
      if(!signal.valid)
         return 0;

      LP_CalendarDecision calendar;
      LP_EvaluateCalendar(signal.source_m1_time, m_config, calendar);
      m_news_calendar.Apply(signal.source_m1_time, meta, m_config, calendar);
      if(calendar.week_boundary_blocked || calendar.news_blocked)
         return 0;

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
         m_revma_visual_reporter.Update(m_config, dashboard_text, screenshot_requested, m_receipts);
      }

      if(emitted > 0)
      {
         m_total_intents += emitted;
         string receipt_detail = detail == "" ? "ready" : detail;
         receipt_detail += "|calendar_reason=" + calendar.reason;
         LP_WriteRevmaSignalReceipt(m_receipts, signal, "intents_emitted", receipt_detail, emitted);
      }
      return emitted;
   }

public:
   void Reset()
   {
      m_config_hash = 0;
      m_symbol_universe_hash = 0;
      m_initialized = false;
      m_step_count = 0;
      m_total_new_bars = 0;
      m_total_intents = 0;
      m_next_system_intent_id = 990900000001;
      m_last_attribution_hash = 0;
      m_last_currency_exposure_hash = 0;
      m_last_grid_inventory_hash = 0;
      m_last_portfolio_qstate_asof = 0;
      m_last_portfolio_qstate_hash = 0;
      for(int i = 0; i < LP_SYMBOL_COUNT; i++)
      {
         LP_ResetSignalSnapshot(m_latest_signals[i]);
         m_signal_available[i] = false;
      }
      m_receipts.Reset();
      m_symbol_cache.Reset();
      m_news_calendar.Reset();
      m_clock.Reset();
      m_lrmg_state.Reset();
      m_revma_state.Reset();
      m_strategy_registry.Reset();
      m_intent_selector.Reset();
      m_intent_bus.Reset();
      m_position_index.Reset();
      m_grid_book.Reset();
      m_currency_guard.Reset();
      m_account_guard.Reset();
      m_stop_take_profit_guard.Reset();
      m_revma_lifecycle_gate.Reset();
      m_revma_visual_reporter.Reset();
      m_risk_arbiter.Reset();
      m_trade_router.Reset();
   }

   int OnInit()
   {
      Reset();
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

      m_position_index.Refresh();
      m_account_guard.Configure(m_config);
      m_currency_guard.Configure(m_config);
      m_strategy_registry.SetEnabled(m_config.enable_strategy_evaluation);
      m_strategy_registry.Configure(m_config_hash);
      m_trade_router.Configure(m_config);

      LP_PortfolioState state;
      m_position_index.BuildPortfolioState(m_config_hash, state);
      m_currency_guard.Refresh();
      m_grid_book.Refresh();
      state.open_grid_count = m_grid_book.OpenGridCount();
      LP_WritePortfolioSummary(m_receipts, state);
      LP_WritePositionAttribution(m_receipts, state);
      m_last_attribution_hash = state.position_snapshot_hash;
      m_currency_guard.WriteReceipt(m_receipts);
      m_last_currency_exposure_hash = m_currency_guard.SnapshotHash();
      m_grid_book.WriteReceipt(m_receipts);
      m_last_grid_inventory_hash = m_grid_book.SnapshotHash();

      LP_HarvestDecision harvest;
      m_account_guard.Evaluate(state, harvest);
      if(harvest.receipt_required)
         LP_WriteHarvestState(m_receipts, harvest);

      if(m_config.use_timer_watchdog)
         EventSetTimer(5);

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
      m_receipts.Flush();

      Print(LP_EA_NAME, " initialized. run_id=", m_receipts.RunId(), " execution=", LP_ExecutionModeName(m_config.execution_mode));
      return INIT_SUCCEEDED;
   }

   void OnDeinit(const int reason)
   {
      if(m_config.use_timer_watchdog)
         EventKillTimer();

      LP_PortfolioState state;
      m_position_index.BuildPortfolioState(m_config_hash, state);
      m_grid_book.Refresh();
      state.open_grid_count = m_grid_book.OpenGridCount();
      LP_WritePortfolioSummary(m_receipts, state);

      m_receipts.Summary("deinit_reason", IntegerToString(reason));
      m_receipts.Summary("engine_steps", IntegerToString(m_step_count));
      m_receipts.Summary("total_new_bars", IntegerToString(m_total_new_bars));
      m_receipts.Summary("total_intents", IntegerToString(m_total_intents));
      m_receipts.Write(LP_RECEIPT_RUN_END, "", "deinit", "reason=" + IntegerToString(reason), 0, 0, 0, 0, 0, 0);
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
      m_position_index.MarkDirty();
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
      m_receipts.Flush();
   }

   void Step(const string source)
   {
      if(!m_initialized)
         return;

      m_step_count++;
      m_intent_bus.Clear();

      LP_PortfolioState portfolio;
      m_position_index.BuildPortfolioState(m_config_hash, portfolio);
      m_currency_guard.Refresh();
      m_grid_book.Refresh();
      portfolio.open_grid_count = m_grid_book.OpenGridCount();

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
      if(m_step_count == 1 || m_grid_book.SnapshotHash() != m_last_grid_inventory_hash)
      {
         m_grid_book.WriteReceipt(m_receipts);
         m_last_grid_inventory_hash = m_grid_book.SnapshotHash();
      }

      LP_HarvestDecision harvest;
      m_account_guard.Evaluate(portfolio, harvest);
      if(harvest.block_new_entries)
         portfolio.recovery_state = LP_RECOVERY_LOCKED;
      if(harvest.receipt_required)
         LP_WriteHarvestState(m_receipts, harvest);

      string harvest_close_reason = "";
      bool harvest_close_required = m_account_guard.RequiresAccountClose(portfolio, harvest_close_reason);
      if(harvest_close_required)
         AddHarvestCloseIntent(harvest, m_intent_bus);

      LP_PortfolioStopTakeProfitDecision stop_take_profit;
      bool stop_take_profit_block_new_entries = m_stop_take_profit_guard.Evaluate(
         m_config,
         portfolio,
         stop_take_profit
      );
      if(stop_take_profit_block_new_entries)
      {
         if(harvest_close_required)
            m_stop_take_profit_guard.WriteReceipt(m_config, m_receipts, portfolio, "triggered_harvest_close_already_queued", stop_take_profit);
         else
            m_stop_take_profit_guard.AddCloseIntent(m_config, m_config_hash, NextSystemIntentId(), portfolio, stop_take_profit, m_intent_bus, m_receipts);
      }

      int revma_grid_exit_intents = m_strategy_registry.EvaluateRevmaGridExits(
         m_config,
         m_grid_book,
         m_receipts,
         m_intent_bus
      );
      bool revma_grid_exit_block_new_entries = revma_grid_exit_intents > 0;
      bool exit_block_new_entries = stop_take_profit_block_new_entries || revma_grid_exit_block_new_entries;
      if(revma_grid_exit_intents > 0)
         m_total_intents += revma_grid_exit_intents;

      int cycle_new_bars = 0;
      int new_symbol_ids[LP_SYMBOL_COUNT];
      int new_symbol_count = 0;
      for(int i = 0; i < m_symbol_cache.Count(); i++)
      {
         LP_SymbolMeta meta;
         if(!m_symbol_cache.Get(i, meta))
            continue;
         if(!LP_RevmaSymbolActive(m_config, meta, _Symbol))
            continue;

         LP_TickSnapshot tick;
         m_tick_cache.RefreshTick(meta.broker_symbol, tick);

         LP_BarClockState clock_state;
         if(!m_clock.RefreshSymbol(meta, clock_state))
            continue;

         if(!clock_state.new_bar)
            continue;

         cycle_new_bars++;
         if(new_symbol_count < LP_SYMBOL_COUNT)
         {
            new_symbol_ids[new_symbol_count] = meta.symbol_id;
            new_symbol_count++;
         }
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
            EvaluateRevmaSymbol(meta, harvest, exit_block_new_entries);
         }
      }

      m_total_new_bars += cycle_new_bars;

      for(int intent_index = 0; intent_index < m_intent_bus.Count(); intent_index++)
      {
         LP_TradeIntent intent;
         if(!m_intent_bus.Get(intent_index, intent))
            continue;

         LP_LogTradeIntent(m_receipts, intent);

         LP_RiskDecision decision;
         LP_TradePlan plan;
         m_risk_arbiter.Decide(intent, portfolio, m_currency_guard, decision, plan);
         LP_LogRiskDecision(m_receipts, decision);
         if(plan.executable)
            LP_LogTradePlan(m_receipts, plan);
         if(plan.executable)
            m_trade_router.Execute(plan, m_receipts);
      }

      if(m_step_count == 1 || cycle_new_bars > 0)
      {
         m_receipts.Write(
            LP_RECEIPT_ENGINE_STEP,
            "",
            source,
            "cycle_new_bars=" + IntegerToString(cycle_new_bars) +
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
               "|stop_take_profit_net_open_pct_after_fees=" + DoubleToString(stop_take_profit.net_open_pct, 6) +
               "|stop_take_profit_estimated_close_fee=" + DoubleToString(stop_take_profit.estimated_close_fee, 2),
            0,
            0,
            0,
            0,
            0,
            0
         );
         m_receipts.Flush();
      }
   }
};

#endif // __LIMNI_PORTFOLIO_ENGINE_MQH__
