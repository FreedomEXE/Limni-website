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
#include "..\\Strategies\\PortfolioIntentSelector.mqh"
#include "..\\Strategies\\IntentBus.mqh"
#include "..\\Portfolio\\PositionIndex.mqh"
#include "..\\Portfolio\\GridBook.mqh"
#include "..\\Portfolio\\PortfolioState.mqh"
#include "..\\Portfolio\\CurrencyExposureGuard.mqh"
#include "..\\Portfolio\\AccountHarvestGuard.mqh"
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
   datetime m_last_revma_dashboard_update;
   string m_last_revma_dashboard_text;
   bool m_revma_dashboard_screenshot_captured;
   LP_SignalSnapshot m_latest_signals[LP_SYMBOL_COUNT];
   bool m_signal_available[LP_SYMBOL_COUNT];
   bool m_revma_reentry_observed[LP_SYMBOL_COUNT];
   bool m_revma_last_has_active_grid[LP_SYMBOL_COUNT];
   bool m_revma_post_flat_waiting[LP_SYMBOL_COUNT];
   int m_revma_observed_direction[LP_SYMBOL_COUNT];
   int m_revma_observed_sleeve[LP_SYMBOL_COUNT];
   int m_revma_observed_variant[LP_SYMBOL_COUNT];
   datetime m_revma_observed_source_m1_time[LP_SYMBOL_COUNT];

   LP_ReceiptWriter m_receipts;
   LP_SymbolSpecCache m_symbol_cache;
   LP_NewsCalendar m_news_calendar;
   LP_TickBarCache m_tick_cache;
   LP_M1Clock m_clock;
   LP_LrmgState m_lrmg_state;
   LP_RevmaSignalState m_revma_state;
   LP_StrategyRegistry m_strategy_registry;
   LP_PortfolioIntentSelector m_intent_selector;
   LP_IntentBus m_intent_bus;
   LP_PositionIndex m_position_index;
   LP_GridBook m_grid_book;
   LP_CurrencyExposureGuard m_currency_guard;
   LP_AccountHarvestGuard m_account_guard;
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

   bool RevmaSymbolActive(const LP_SymbolMeta &meta)
   {
      if(m_config.revma_universe_mode == LP_UNIVERSE_FX28)
         return true;
      return meta.symbol_id == LP_SymbolIdFromBrokerSymbol(_Symbol);
   }

   void UpdateRevmaDashboard(const bool force)
   {
      if(!m_config.revma_show_visual_dashboard)
         return;
      string text = m_strategy_registry.RevmaVisualDashboardText();
      if(text == "")
         return;

      datetime now = TimeCurrent();
      int refresh_seconds = MathMax(0, m_config.revma_dashboard_refresh_seconds);
      if(!force && refresh_seconds > 0 && m_last_revma_dashboard_update > 0 &&
         now - m_last_revma_dashboard_update < refresh_seconds &&
         text == m_last_revma_dashboard_text)
      {
         return;
      }

      Comment("");
      DrawRevmaDashboardText(text);
      if(m_config.revma_dashboard_screenshot_on_divergent_add &&
         !m_revma_dashboard_screenshot_captured &&
         m_strategy_registry.ConsumeRevmaDashboardScreenshotRequest())
      {
         m_revma_dashboard_screenshot_captured = true;
         CaptureRevmaDashboardScreenshot(text);
      }
      m_last_revma_dashboard_update = now;
      m_last_revma_dashboard_text = text;
   }

   void CaptureRevmaDashboardScreenshot(const string dashboard_text)
   {
      string stamp = LP_SafePart(LP_Stamp(TimeCurrent()) + "_" + IntegerToString((int)TimeLocal()));
      int file_scope = m_config.export_to_common_files ? FILE_COMMON : 0;
      FolderCreate(m_config.output_folder, file_scope);
      string dashboard_text_file = m_config.output_folder + "\\revma_dashboard_snapshot_" + stamp + ".txt";
      bool dashboard_text_ok = false;
      int handle = FileOpen(dashboard_text_file, FILE_WRITE | FILE_TXT | FILE_ANSI | file_scope);
      if(handle != INVALID_HANDLE)
      {
         FileWriteString(handle, dashboard_text);
         FileClose(handle);
         dashboard_text_ok = true;
      }

      string file = "Gate99ZZA_revma_divergent_add_dashboard_" + stamp + ".png";
      bool ok = ChartScreenShot(0, file, 1600, 900, ALIGN_RIGHT);
      m_receipts.Summary("revma_dashboard_screenshot", (ok ? "ok:" : "failed:") + file);
      m_receipts.Summary("revma_dashboard_snapshot", (dashboard_text_ok ? "ok:" : "failed:") + dashboard_text_file);
      m_receipts.Write(
         LP_RECEIPT_REVMA_GRID_ADD,
         "",
         ok ? "dashboard_screenshot" : "dashboard_screenshot_failed",
         "file=" + file +
            "|ok=" + LP_BoolText(ok) +
            "|dashboard_text_file=" + dashboard_text_file +
            "|dashboard_text_ok=" + LP_BoolText(dashboard_text_ok) +
            "|terminal_data_path=" + TerminalInfoString(TERMINAL_DATA_PATH),
         LP_LANE_REVMA,
         0,
         0,
         0,
         0,
         0
      );
      m_receipts.Flush();
   }

   void DrawRevmaDashboardText(const string text)
   {
      string lines[];
      int count = StringSplit(text, '\n', lines);
      int max_lines = 34;
      int x = 18;
      int y = 44;
      int line_height = 15;
      for(int i = 0; i < max_lines; i++)
      {
         string name = "Limni_RevmaDash_Line_" + IntegerToString(i);
         if(ObjectFind(0, name) < 0)
            ObjectCreate(0, name, OBJ_LABEL, 0, 0, 0);
         ObjectSetInteger(0, name, OBJPROP_CORNER, CORNER_LEFT_UPPER);
         ObjectSetInteger(0, name, OBJPROP_XDISTANCE, x);
         ObjectSetInteger(0, name, OBJPROP_YDISTANCE, y + i * line_height);
         ObjectSetInteger(0, name, OBJPROP_COLOR, i == 0 ? C'87,194,255' : clrWhite);
         ObjectSetInteger(0, name, OBJPROP_FONTSIZE, i == 0 ? 10 : 8);
         ObjectSetString(0, name, OBJPROP_FONT, i == 0 ? "Segoe UI Semibold" : "Consolas");
         ObjectSetString(0, name, OBJPROP_TEXT, i < count ? lines[i] : "");
         ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
         ObjectSetInteger(0, name, OBJPROP_SELECTED, false);
         ObjectSetInteger(0, name, OBJPROP_HIDDEN, true);
         ObjectSetInteger(0, name, OBJPROP_ZORDER, 50);
      }
      ChartRedraw(0);
   }

   void WriteRevmaSignalReceipt(
      const LP_RevmaSignal &signal,
      const string status,
      const string detail,
      const int emitted
   )
   {
      m_receipts.Write(
         LP_RECEIPT_REVMA_SIGNAL,
         signal.symbol,
         status,
         "system_id=" + LP_REVMA_SYSTEM_ID +
            "|system_name=" + LP_REVMA_SYSTEM_NAME +
            "|formula_id=" + LP_REVMA_FORMULA_ID +
            "|formula_hash=" + (string)signal.formula_hash +
            "|pair_direction_formula_id=" + LimniPairDirectionFormulaId() +
            "|pair_direction_formula_hash=" + (string)LimniPairDirectionFormulaHash() +
            "|source_m1_time=" + LP_Stamp(signal.source_m1_time) +
            "|q_profile=" + LP_RevmaQProfileName(signal.q_profile) +
            "|max_m1_bars=" + IntegerToString(signal.max_m1_bars) +
            "|q_profile_id=" + signal.q_profile_id +
            "|direction=" + LP_RevmaDirectionName(signal.direction) +
            "|sleeve=" + LP_RevmaSleeveName(signal.sleeve) +
            "|anchor_relation=" + LP_RevmaAnchorRelationName(signal.anchor_relation) +
            "|q=" + DoubleToString(signal.q, 8) +
            "|q_pips=" + DoubleToString(signal.q_pips, 2) +
            "|anchor=" + DoubleToString(signal.anchor, 5) +
            "|stochastic=" + DoubleToString(signal.stoch, 2) +
            "|raw_score=" + DoubleToString(signal.raw_score, 6) +
            "|q_days=" + IntegerToString(signal.q_days) +
            "|closed_m1_bars=" + IntegerToString(signal.closed_m1_bars) +
            "|emitted=" + IntegerToString(emitted) +
            "|detail=" + detail,
         LP_LANE_REVMA,
         signal.variant_id,
         signal.formula_hash,
         0,
         0,
         0
      );
   }

   string RevmaObservedStateText(const int symbol_id)
   {
      if(symbol_id < 0 || symbol_id >= LP_SYMBOL_COUNT || !m_revma_reentry_observed[symbol_id])
         return "observed=false";
      return "observed=true" +
         "|observed_direction=" + LP_RevmaDirectionName(m_revma_observed_direction[symbol_id]) +
         "|observed_sleeve=" + LP_RevmaSleeveName(m_revma_observed_sleeve[symbol_id]) +
         "|observed_variant_id=" + IntegerToString(m_revma_observed_variant[symbol_id]) +
         "|observed_source_m1_time=" + LP_Stamp(m_revma_observed_source_m1_time[symbol_id]);
   }

   string RevmaReentryGateDetail(
      const LP_RevmaSignal &signal,
      const bool has_active_grid,
      const string reason
   )
   {
      return "system_id=" + LP_REVMA_SYSTEM_ID +
         "|source_m1_time=" + LP_Stamp(signal.source_m1_time) +
         "|direction=" + LP_RevmaDirectionName(signal.direction) +
         "|sleeve=" + LP_RevmaSleeveName(signal.sleeve) +
         "|variant_id=" + IntegerToString(signal.variant_id) +
         "|q_profile_id=" + signal.q_profile_id +
         "|has_active_grid=" + LP_BoolText(has_active_grid) +
         "|post_harvest_waiting=" + LP_BoolText(m_revma_post_flat_waiting[signal.symbol_id]) +
         "|" + RevmaObservedStateText(signal.symbol_id) +
         "|reason=" + reason;
   }

   void WriteRevmaReentryGateReceipt(
      const LP_RevmaSignal &signal,
      const string status,
      const string reason,
      const bool has_active_grid
   )
   {
      m_receipts.Write(
         LP_RECEIPT_REVMA_REENTRY_GATE,
         signal.symbol,
         status,
         RevmaReentryGateDetail(signal, has_active_grid, reason),
         LP_LANE_REVMA,
         signal.variant_id,
         0,
         0,
         0,
         0
      );
   }

   void RevmaRecordObservedState(const LP_RevmaSignal &signal)
   {
      int symbol_id = signal.symbol_id;
      if(symbol_id < 0 || symbol_id >= LP_SYMBOL_COUNT)
         return;
      m_revma_reentry_observed[symbol_id] = true;
      m_revma_observed_direction[symbol_id] = signal.direction;
      m_revma_observed_sleeve[symbol_id] = signal.sleeve;
      m_revma_observed_variant[symbol_id] = signal.variant_id;
      m_revma_observed_source_m1_time[symbol_id] = signal.source_m1_time;
   }

   bool RevmaIdentityChanged(const LP_RevmaSignal &signal)
   {
      int symbol_id = signal.symbol_id;
      if(symbol_id < 0 || symbol_id >= LP_SYMBOL_COUNT || !m_revma_reentry_observed[symbol_id])
         return false;
      return signal.direction != m_revma_observed_direction[symbol_id] ||
         signal.sleeve != m_revma_observed_sleeve[symbol_id] ||
         signal.variant_id != m_revma_observed_variant[symbol_id];
   }

   bool RevmaEvaluateReentryGate(
      const LP_RevmaSignal &signal,
      const bool has_active_grid,
      bool &birth_allowed
   )
   {
      birth_allowed = false;
      int symbol_id = signal.symbol_id;
      if(symbol_id < 0 || symbol_id >= LP_SYMBOL_COUNT)
         return false;

      if(has_active_grid)
      {
         if(!m_revma_reentry_observed[symbol_id])
         {
            WriteRevmaReentryGateReceipt(signal, "startup_state_observed", "existing_grid_attached", true);
            RevmaRecordObservedState(signal);
         }
         m_revma_last_has_active_grid[symbol_id] = true;
         m_revma_post_flat_waiting[symbol_id] = false;
         return true;
      }

      if(!m_revma_reentry_observed[symbol_id])
      {
         WriteRevmaReentryGateReceipt(signal, "startup_state_observed", "flat_attach_observe_current_state", false);
         RevmaRecordObservedState(signal);
         WriteRevmaReentryGateReceipt(signal, "birth_blocked_waiting_for_fresh_state", "startup_current_state_not_birth_event", false);
         m_revma_last_has_active_grid[symbol_id] = false;
         return false;
      }

      if(m_revma_last_has_active_grid[symbol_id])
      {
         RevmaRecordObservedState(signal);
         m_revma_last_has_active_grid[symbol_id] = false;
         m_revma_post_flat_waiting[symbol_id] = true;
         WriteRevmaReentryGateReceipt(signal, "post_harvest_reentry_blocked", "grid_transitioned_flat_waiting_for_fresh_state", false);
         return false;
      }

      if(RevmaIdentityChanged(signal))
      {
         WriteRevmaReentryGateReceipt(signal, "fresh_state_change_detected", "current_identity_differs_from_observed_state", false);
         RevmaRecordObservedState(signal);
         m_revma_post_flat_waiting[symbol_id] = false;
         birth_allowed = true;
         return true;
      }

      if(m_revma_post_flat_waiting[symbol_id])
         WriteRevmaReentryGateReceipt(signal, "post_harvest_reentry_blocked", "same_state_after_flat_close", false);
      else
         WriteRevmaReentryGateReceipt(signal, "birth_blocked_waiting_for_fresh_state", "same_state_as_startup_observation", false);
      return false;
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

   double EstimatedManagedCloseFee()
   {
      double estimated_fee = 0.0;
      if(m_config.stop_take_profit_close_commission_per_lot <= 0.0)
         return 0.0;

      for(int i = 0; i < PositionsTotal(); i++)
      {
         ulong ticket = PositionGetTicket(i);
         if(ticket == 0)
            continue;
         if(!PositionSelectByTicket(ticket))
            continue;

         long magic = (long)PositionGetInteger(POSITION_MAGIC);
         if(!LP_IsManagedMagic(magic))
            continue;

         double lots = MathAbs(PositionGetDouble(POSITION_VOLUME));
         estimated_fee += lots * m_config.stop_take_profit_close_commission_per_lot;
      }
      return estimated_fee;
   }

   bool EvaluateStopTakeProfitGuard(
      const LP_PortfolioState &portfolio,
      string &reason,
      double &net_open_pct,
      double &gross_open_money,
      double &estimated_close_fee,
      double &net_open_money
   )
   {
      reason = "";
      net_open_pct = 0.0;
      gross_open_money = 0.0;
      estimated_close_fee = 0.0;
      net_open_money = 0.0;

      if(m_config.stop_take_profit_mode != LP_SLTP_MULTI_CURRENCY_PERCENT_AFTER_FEES)
         return false;
      if(m_config.revma_universe_mode != LP_UNIVERSE_FX28)
         return false;
      if(portfolio.managed_position_count <= 0 || portfolio.balance <= 0.0)
         return false;

      gross_open_money = portfolio.ea_floating_pnl;
      estimated_close_fee = EstimatedManagedCloseFee();
      net_open_money = gross_open_money - estimated_close_fee;
      net_open_pct = 100.0 * net_open_money / portfolio.balance;

      if(m_config.take_profit_value > 0.0 && net_open_pct >= m_config.take_profit_value)
         reason = "take_profit_percent_after_fees";
      if(reason == "" && m_config.stop_loss_value > 0.0 && net_open_pct <= -m_config.stop_loss_value)
         reason = "stop_loss_percent_after_fees";

      return reason != "";
   }

   void WriteStopTakeProfitGuardReceipt(
      const LP_PortfolioState &portfolio,
      const string status,
      const string reason,
      const double net_open_pct,
      const double gross_open_money,
      const double estimated_close_fee,
      const double net_open_money
   )
   {
      m_receipts.Write(
         LP_RECEIPT_STOP_TAKE_PROFIT_GUARD,
         "",
         status,
         "scope=multi_currency_percent_after_fees" +
            "|reason=" + reason +
            "|net_open_pct_after_fees=" + DoubleToString(net_open_pct, 6) +
            "|gross_open_money=" + DoubleToString(gross_open_money, 2) +
            "|estimated_close_fee=" + DoubleToString(estimated_close_fee, 2) +
            "|net_open_money_after_fees=" + DoubleToString(net_open_money, 2) +
            "|take_profit_value_pct=" + DoubleToString(m_config.take_profit_value, 4) +
            "|stop_loss_value_pct=" + DoubleToString(m_config.stop_loss_value, 4) +
            "|close_commission_per_lot=" + DoubleToString(m_config.stop_take_profit_close_commission_per_lot, 2) +
            "|managed_positions=" + IntegerToString(portfolio.managed_position_count) +
            "|managed_floating_pnl=" + DoubleToString(portfolio.ea_floating_pnl, 2) +
            "|balance=" + DoubleToString(portfolio.balance, 2),
         LP_LANE_NONE,
         LP_VARIANT_NONE,
         0,
         0,
         0,
         0
      );
   }

   void AddStopTakeProfitCloseIntent(
      const LP_PortfolioState &portfolio,
      const string reason,
      const double net_open_pct,
      const double gross_open_money,
      const double estimated_close_fee,
      const double net_open_money,
      LP_IntentBus &bus
   )
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
      intent.source_bar_time = portfolio.asof;
      intent.expires_at = 0;
      intent.requested_lots = 0.0;
      intent.max_slippage_points = 10.0;
      intent.take_profit_distance_price = 0.0;
      intent.stop_loss_distance_price = 0.0;
      intent.stop_take_profit_basis = "";
      intent.priority = 100;
      intent.score = net_open_pct;
      intent.grid_key = 0;
      intent.config_hash = m_config_hash;
      intent.strategy_version_hash = LP_HashString("gate99zzc_stop_take_profit_close_all_pct_after_fees");
      intent.human_reason = "stop_take_profit_scope=multi_currency_percent_after_fees" +
         "|reason=" + reason +
         "|net_open_pct_after_fees=" + DoubleToString(net_open_pct, 6) +
         "|gross_open_money=" + DoubleToString(gross_open_money, 2) +
         "|estimated_close_fee=" + DoubleToString(estimated_close_fee, 2) +
         "|net_open_money_after_fees=" + DoubleToString(net_open_money, 2) +
         "|take_profit_value_pct=" + DoubleToString(m_config.take_profit_value, 4) +
         "|stop_loss_value_pct=" + DoubleToString(m_config.stop_loss_value, 4) +
         "|managed_positions=" + IntegerToString(portfolio.managed_position_count);
      bus.Add(intent);
      WriteStopTakeProfitGuardReceipt(
         portfolio,
         "account_exit_intent",
         reason,
         net_open_pct,
         gross_open_money,
         estimated_close_fee,
         net_open_money
      );
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
         bool reentry_gate_open = RevmaEvaluateReentryGate(signal, has_active_grid, birth_allowed);
         if(reentry_gate_open && !harvest.block_new_entries && !stop_take_profit_block_new_entries)
         {
            if(birth_allowed)
               WriteRevmaReentryGateReceipt(signal, "revma_grid_birth_allowed", "fresh_state_change_gate_open", false);
            emitted = m_strategy_registry.EvaluateRevma(signal, m_config, m_grid_book, m_receipts, m_intent_bus, birth_allowed);
         }
      }

      UpdateRevmaDashboard(emitted > 0);

      if(emitted > 0)
      {
         m_total_intents += emitted;
         string receipt_detail = detail == "" ? "ready" : detail;
         receipt_detail += "|calendar_reason=" + calendar.reason;
         WriteRevmaSignalReceipt(signal, "intents_emitted", receipt_detail, emitted);
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
      m_last_revma_dashboard_update = 0;
      m_last_revma_dashboard_text = "";
      m_revma_dashboard_screenshot_captured = false;
      for(int i = 0; i < LP_SYMBOL_COUNT; i++)
      {
         LP_ResetSignalSnapshot(m_latest_signals[i]);
         m_signal_available[i] = false;
         m_revma_reentry_observed[i] = false;
         m_revma_last_has_active_grid[i] = false;
         m_revma_post_flat_waiting[i] = false;
         m_revma_observed_direction[i] = LP_SIDE_NONE;
         m_revma_observed_sleeve[i] = LP_REVMA_SLEEVE_NONE;
         m_revma_observed_variant[i] = LP_VARIANT_NONE;
         m_revma_observed_source_m1_time[i] = 0;
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

      string stop_take_profit_reason = "";
      double stop_take_profit_net_open_pct = 0.0;
      double stop_take_profit_gross_open_money = 0.0;
      double stop_take_profit_estimated_close_fee = 0.0;
      double stop_take_profit_net_open_money = 0.0;
      bool stop_take_profit_block_new_entries = EvaluateStopTakeProfitGuard(
         portfolio,
         stop_take_profit_reason,
         stop_take_profit_net_open_pct,
         stop_take_profit_gross_open_money,
         stop_take_profit_estimated_close_fee,
         stop_take_profit_net_open_money
      );
      if(stop_take_profit_block_new_entries)
      {
         if(harvest_close_required)
            WriteStopTakeProfitGuardReceipt(
               portfolio,
               "triggered_harvest_close_already_queued",
               stop_take_profit_reason,
               stop_take_profit_net_open_pct,
               stop_take_profit_gross_open_money,
               stop_take_profit_estimated_close_fee,
               stop_take_profit_net_open_money
            );
         else
            AddStopTakeProfitCloseIntent(
               portfolio,
               stop_take_profit_reason,
               stop_take_profit_net_open_pct,
               stop_take_profit_gross_open_money,
               stop_take_profit_estimated_close_fee,
               stop_take_profit_net_open_money,
               m_intent_bus
            );
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
         if(!RevmaSymbolActive(meta))
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
            if(!RevmaSymbolActive(meta))
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
               "|stop_take_profit_reason=" + stop_take_profit_reason +
               "|revma_grid_exit_intents=" + IntegerToString(revma_grid_exit_intents) +
               "|stop_take_profit_net_open_pct_after_fees=" + DoubleToString(stop_take_profit_net_open_pct, 6) +
               "|stop_take_profit_estimated_close_fee=" + DoubleToString(stop_take_profit_estimated_close_fee, 2),
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
