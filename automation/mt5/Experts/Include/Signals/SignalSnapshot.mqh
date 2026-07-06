/*-----------------------------------------------
  Signal snapshot helpers
-----------------------------------------------*/
#ifndef __LIMNI_PORTFOLIO_SIGNAL_SNAPSHOT_MQH__
#define __LIMNI_PORTFOLIO_SIGNAL_SNAPSHOT_MQH__

#include "..\\Core\\Types.mqh"

void LP_ResetSignalSnapshot(LP_SignalSnapshot &snapshot)
{
   snapshot.symbol_id = -1;
   snapshot.symbol = "";
   snapshot.lane_id = LP_LANE_NONE;
   snapshot.variant_id = LP_VARIANT_NONE;
   snapshot.source_bar_time = 0;
   snapshot.direction = LP_SIDE_NONE;
   snapshot.score = 0.0;
   snapshot.valid = false;
   snapshot.session_allowed = false;
   snapshot.news_allowed = false;
   snapshot.reason = "";
}

#endif // __LIMNI_PORTFOLIO_SIGNAL_SNAPSHOT_MQH__
