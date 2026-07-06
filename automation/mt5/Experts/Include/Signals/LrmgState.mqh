/*-----------------------------------------------
  LRMG state placeholder for Gate 99N
-----------------------------------------------*/
#ifndef __LIMNI_PORTFOLIO_LRMG_STATE_MQH__
#define __LIMNI_PORTFOLIO_LRMG_STATE_MQH__

#include "..\\Core\\Types.mqh"
#include "SignalSnapshot.mqh"

class LP_LrmgState
{
private:
   int m_ready_count;

public:
   void Reset()
   {
      m_ready_count = 0;
   }

   bool BuildSnapshot(const LP_SymbolMeta &meta, const datetime source_bar_time, LP_SignalSnapshot &snapshot)
   {
      LP_ResetSignalSnapshot(snapshot);
      snapshot.symbol_id = meta.symbol_id;
      snapshot.symbol = meta.broker_symbol;
      snapshot.source_bar_time = source_bar_time;
      snapshot.valid = meta.tradable && source_bar_time > 0;
      snapshot.reason = snapshot.valid ? "gate99s_signal_placeholder" : "not_ready";
      if(snapshot.valid)
         m_ready_count++;
      return snapshot.valid;
   }

   int ReadyCount()
   {
      return m_ready_count;
   }
};

#endif // __LIMNI_PORTFOLIO_LRMG_STATE_MQH__
