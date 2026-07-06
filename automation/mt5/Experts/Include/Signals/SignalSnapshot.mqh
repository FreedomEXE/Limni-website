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
   snapshot.source_m1_time = 0;
   snapshot.direction = LP_SIDE_NONE;
   snapshot.market_mode = LP_MARKET_UNKNOWN;
   snapshot.pair_state = LP_PAIR_STATE_NEUTRAL;
   snapshot.formula_id = "";
   snapshot.formula_hash = 0;
   snapshot.score = 0.0;
   snapshot.price = 0.0;
   snapshot.q = 0.0;
   snapshot.anchor = 0.0;
   snapshot.trend_persistence = 0.0;
   snapshot.anchor_displacement = 0.0;
   snapshot.event_direction_persistence = 0.0;
   snapshot.range_position = 0.0;
   snapshot.sweep_resolution = 0.0;
   snapshot.spread_cost_q = 0.0;
   snapshot.pair_q_score = 0.0;
   snapshot.base_currency_score = 0.0;
   snapshot.quote_currency_score = 0.0;
   snapshot.pair_direction_score = 0.0;
   snapshot.confidence = 0.0;
   snapshot.katarakti_signal = 0;
   snapshot.event_count = 0;
   snapshot.valid = false;
   snapshot.session_allowed = false;
   snapshot.news_allowed = false;
   snapshot.receipt_required = false;
   snapshot.feature_hash = 0;
   snapshot.reason_code = "";
   snapshot.reason = "";
}

#endif // __LIMNI_PORTFOLIO_SIGNAL_SNAPSHOT_MQH__
