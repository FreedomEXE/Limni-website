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

   bool ProbeSymbol(const LP_SymbolMeta &meta, LP_BarClockState &state)
   {
      state.symbol_id = meta.symbol_id;
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
      MqlRates rates[1];
      if(CopyRates(meta.broker_symbol, PERIOD_M1, 1, 1, rates) != 1)
      {
         m_sync_fail_count++;
         return false;
      }

      state.last_bar_time = rates[0].time;
      state.close = rates[0].close;

      state.new_bar = m_last_bar_time[id] == 0 ||
         state.last_bar_time > m_last_bar_time[id];
      return true;
   }

   bool CommitCohort(LP_BarClockState &states[], const int count)
   {
      if(count != LP_SYMBOL_COUNT)
         return false;
      bool seen[LP_SYMBOL_COUNT];
      for(int i = 0; i < LP_SYMBOL_COUNT; i++)
         seen[i] = false;
      datetime cohort_time = 0;
      for(int i = 0; i < count; i++)
      {
         int id = states[i].symbol_id;
         if(id < 0 || id >= LP_SYMBOL_COUNT || seen[id] ||
            !states[i].synchronized || !states[i].new_bar ||
            states[i].last_bar_time <= 0 ||
            ((long)states[i].last_bar_time % 60) != 0 ||
            states[i].close <= 0.0 ||
            (m_last_bar_time[id] > 0 &&
             states[i].last_bar_time <= m_last_bar_time[id]))
            return false;
         if(cohort_time == 0)
            cohort_time = states[i].last_bar_time;
         else if(states[i].last_bar_time != cohort_time)
            return false;
         seen[id] = true;
      }
      for(int i = 0; i < count; i++)
      {
         m_last_bar_time[states[i].symbol_id] = states[i].last_bar_time;
         m_new_bar_count++;
      }
      return true;
   }

   bool CommitSingle(const LP_BarClockState &state)
   {
      int id = state.symbol_id;
      if(id < 0 || id >= LP_SYMBOL_COUNT || !state.synchronized ||
         !state.new_bar || state.last_bar_time <= 0 ||
         ((long)state.last_bar_time % 60) != 0 || state.close <= 0.0 ||
         (m_last_bar_time[id] > 0 &&
          state.last_bar_time <= m_last_bar_time[id]))
         return false;
      m_last_bar_time[id] = state.last_bar_time;
      m_new_bar_count++;
      return true;
   }

   bool RefreshSymbol(const LP_SymbolMeta &meta, LP_BarClockState &state)
   {
      if(!ProbeSymbol(meta, state))
         return false;
      if(!state.new_bar)
         return true;
      LP_BarClockState cohort[LP_SYMBOL_COUNT];
      if(LP_SYMBOL_COUNT != 1)
         return true;
      cohort[0] = state;
      return CommitCohort(cohort, 1);
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
