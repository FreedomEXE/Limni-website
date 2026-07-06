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
#include "..\\Market\\SymbolSpecCache.mqh"
#include "..\\Market\\TickBarCache.mqh"
#include "..\\Market\\M1Clock.mqh"
#include "..\\Signals\\LrmgState.mqh"
#include "..\\Strategies\\StrategyRegistry.mqh"
#include "..\\Strategies\\IntentBus.mqh"
#include "..\\Portfolio\\PositionIndex.mqh"
#include "..\\Portfolio\\GridBook.mqh"
#include "..\\Portfolio\\PortfolioState.mqh"
#include "..\\Portfolio\\CurrencyExposureGuard.mqh"
#include "..\\Portfolio\\AccountHarvestGuard.mqh"
#include "..\\Portfolio\\RiskArbiter.mqh"
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

   LP_ReceiptWriter m_receipts;
   LP_SymbolSpecCache m_symbol_cache;
   LP_TickBarCache m_tick_cache;
   LP_M1Clock m_clock;
   LP_LrmgState m_lrmg_state;
   LP_StrategyRegistry m_strategy_registry;
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

public:
   void Reset()
   {
      m_config_hash = 0;
      m_symbol_universe_hash = 0;
      m_initialized = false;
      m_step_count = 0;
      m_total_new_bars = 0;
      m_total_intents = 0;
      m_receipts.Reset();
      m_symbol_cache.Reset();
      m_clock.Reset();
      m_lrmg_state.Reset();
      m_strategy_registry.Reset();
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

      m_position_index.Refresh();
      m_strategy_registry.SetEnabled(m_config.enable_strategy_evaluation);
      m_trade_router.Configure(m_config);

      LP_PortfolioState state;
      m_position_index.BuildPortfolioState(m_config_hash, state);
      LP_WritePortfolioSummary(m_receipts, state);

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

      string account_reason = "";
      if(m_account_guard.RequiresAccountClose(portfolio, account_reason))
      {
         m_receipts.Write(LP_RECEIPT_ACCOUNT_GOVERNOR, "", "close_required", account_reason, 0, 0, 0, 0, 0, 0);
      }

      int cycle_new_bars = 0;
      for(int i = 0; i < m_symbol_cache.Count(); i++)
      {
         LP_SymbolMeta meta;
         if(!m_symbol_cache.Get(i, meta))
            continue;

         LP_TickSnapshot tick;
         m_tick_cache.RefreshTick(meta.broker_symbol, tick);

         LP_BarClockState clock_state;
         if(!m_clock.RefreshSymbol(meta, clock_state))
            continue;

         if(!clock_state.new_bar)
            continue;

         cycle_new_bars++;
         LP_CalendarDecision calendar;
         LP_EvaluateCalendar(clock_state.last_bar_time, m_config, calendar);

         LP_SignalSnapshot signal;
         if(m_lrmg_state.BuildSnapshot(meta, clock_state.last_bar_time, signal))
         {
            signal.session_allowed = !calendar.week_boundary_blocked;
            signal.news_allowed = !calendar.news_blocked;
            signal.reason = calendar.reason;
            int emitted = m_strategy_registry.EvaluateAll(signal, m_intent_bus);
            m_total_intents += emitted;
            if(emitted > 0)
            {
               m_receipts.Write(
                  LP_RECEIPT_SIGNAL,
                  meta.broker_symbol,
                  "intents_emitted",
                  "emitted=" + IntegerToString(emitted) + "|calendar=" + calendar.reason,
                  0,
                  0,
                  0,
                  0,
                  0,
                  0
               );
            }
         }
      }

      m_total_new_bars += cycle_new_bars;

      for(int intent_index = 0; intent_index < m_intent_bus.Count(); intent_index++)
      {
         LP_TradeIntent intent;
         if(!m_intent_bus.Get(intent_index, intent))
            continue;

         LP_RiskDecision decision;
         LP_TradePlan plan;
         m_risk_arbiter.Decide(intent, portfolio, m_currency_guard, decision, plan);
         LP_LogRiskDecision(m_receipts, decision);
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
               "|managed_positions=" + IntegerToString(portfolio.managed_position_count),
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
