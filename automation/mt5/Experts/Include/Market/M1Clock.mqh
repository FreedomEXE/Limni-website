/*-----------------------------------------------
  Closed-M1 multi-symbol clock
-----------------------------------------------*/
#ifndef __LIMNI_PORTFOLIO_M1_CLOCK_MQH__
#define __LIMNI_PORTFOLIO_M1_CLOCK_MQH__

#include "..\\Core\\Types.mqh"
#include "SymbolSpecCache.mqh"

class LP_M1Clock
{
private:
   datetime m_last_bar_time[LP_SYMBOL_COUNT];
   int m_new_bar_count;
   int m_sync_fail_count;

public:
   void Reset()
   {
      m_new_bar_count = 0;
      m_sync_fail_count = 0;
      for(int i = 0; i < LP_SYMBOL_COUNT; i++)
         m_last_bar_time[i] = 0;
   }

   bool RefreshSymbol(const LP_SymbolMeta &meta, LP_BarClockState &state)
   {
      state.symbol = meta.broker_symbol;
      state.last_bar_time = 0;
      state.close = 0.0;
      state.new_bar = false;
      state.synchronized = false;

      if(!meta.tradable)
         return false;

      datetime closed_bar_time = iTime(meta.broker_symbol, PERIOD_M1, 1);
      if(closed_bar_time <= 0)
      {
         m_sync_fail_count++;
         return false;
      }

      int id = meta.symbol_id;
      if(id < 0 || id >= LP_SYMBOL_COUNT)
         return false;

      state.synchronized = true;
      state.last_bar_time = closed_bar_time;
      if(m_last_bar_time[id] > 0 && closed_bar_time == m_last_bar_time[id])
         return true;

      MqlRates rates[1];
      if(CopyRates(meta.broker_symbol, PERIOD_M1, 1, 1, rates) != 1)
      {
         m_sync_fail_count++;
         return false;
      }

      state.last_bar_time = rates[0].time;
      state.close = rates[0].close;

      if(m_last_bar_time[id] == 0)
      {
         m_last_bar_time[id] = state.last_bar_time;
         return true;
      }

      if(state.last_bar_time != m_last_bar_time[id])
      {
         m_last_bar_time[id] = state.last_bar_time;
         state.new_bar = true;
         m_new_bar_count++;
      }
      return true;
   }

   int NewBarCount()
   {
      return m_new_bar_count;
   }

   int SyncFailCount()
   {
      return m_sync_fail_count;
   }
};

#endif // __LIMNI_PORTFOLIO_M1_CLOCK_MQH__
