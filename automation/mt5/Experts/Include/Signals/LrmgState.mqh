/*-----------------------------------------------
  Internal LRMG q-state feature builder
-----------------------------------------------*/
#ifndef __LIMNI_PORTFOLIO_LRMG_STATE_MQH__
#define __LIMNI_PORTFOLIO_LRMG_STATE_MQH__

#include "..\\Core\\Types.mqh"
#include "..\\Core\\SymbolUniverse.mqh"
#include "SignalSnapshot.mqh"
#include "..\\..\\..\\Indicators\\Include\\LimniQStateCore.mqh"

struct LP_LrmgSymbolState
{
   int day_key;
   int day_bar_count;
   int day_bar_capacity;
   datetime day_times[];
   double day_closes[];
   int q_day_count;
   int q_day_capacity;
   double q_days[];
   bool has_confirmed_event;
   double base_price;
   double last_event_price;
   int current_level;
   int event_count;
   int event_capacity;
   double events[];
   int cached_metric_event_count;
   double cached_line;
   double cached_lo;
   double cached_hi;
   int last_david_state;
   int david_state_age_events;
   int lower_ktr_stage;
   int lower_ktr_age;
   double lower_ktr_boundary;
   int upper_ktr_stage;
   int upper_ktr_age;
   double upper_ktr_boundary;
   int last_ktr_signal;
   int last_event_direction;
   datetime last_bar_time;
   int last_pair_state;
   ulong last_feature_hash;
};

class LP_LrmgState
{
private:
   LP_LrmgSymbolState m_state[LP_SYMBOL_COUNT];
   double m_currency_scores[LP_CCY_COUNT];
   int m_ready_count;

   double Clamp(const double value, const double min_value, const double max_value)
   {
      if(value < min_value)
         return min_value;
      if(value > max_value)
         return max_value;
      return value;
   }

   int DayKey(const datetime value)
   {
      MqlDateTime parts;
      TimeToStruct(value, parts);
      return parts.year * 10000 + parts.mon * 100 + parts.day;
   }

   void ResetSymbol(LP_LrmgSymbolState &state)
   {
      state.day_key = 0;
      state.day_bar_count = 0;
      state.day_bar_capacity = 0;
      ArrayResize(state.day_times, 0);
      ArrayResize(state.day_closes, 0);
      state.q_day_count = 0;
      state.q_day_capacity = 0;
      ArrayResize(state.q_days, 0);
      state.has_confirmed_event = false;
      state.base_price = 0.0;
      state.last_event_price = 0.0;
      state.current_level = 0;
      state.event_count = 0;
      state.event_capacity = 0;
      ArrayResize(state.events, 0);
      state.cached_metric_event_count = -1;
      state.cached_line = EMPTY_VALUE;
      state.cached_lo = 0.0;
      state.cached_hi = 0.0;
      state.last_david_state = 0;
      state.david_state_age_events = 0;
      state.lower_ktr_stage = 0;
      state.lower_ktr_age = 0;
      state.lower_ktr_boundary = 0.0;
      state.upper_ktr_stage = 0;
      state.upper_ktr_age = 0;
      state.upper_ktr_boundary = 0.0;
      state.last_ktr_signal = 0;
      state.last_event_direction = 0;
      state.last_bar_time = 0;
      state.last_pair_state = LP_PAIR_STATE_NEUTRAL;
      state.last_feature_hash = 0;
   }

   void AppendDayBar(LP_LrmgSymbolState &state, const datetime value_time, const double value_close)
   {
      if(state.day_bar_count >= state.day_bar_capacity)
      {
         state.day_bar_capacity = state.day_bar_capacity <= 0 ? 2048 : state.day_bar_capacity * 2;
         ArrayResize(state.day_times, state.day_bar_capacity);
         ArrayResize(state.day_closes, state.day_bar_capacity);
      }

      state.day_times[state.day_bar_count] = value_time;
      state.day_closes[state.day_bar_count] = value_close;
      state.day_bar_count++;
   }

   void AppendQDay(LP_LrmgSymbolState &state, const double q_day)
   {
      if(q_day <= 0.0 || !MathIsValidNumber(q_day))
         return;

      if(state.q_day_count >= state.q_day_capacity)
      {
         state.q_day_capacity = state.q_day_capacity <= 0 ? 256 : state.q_day_capacity * 2;
         ArrayResize(state.q_days, state.q_day_capacity);
      }

      state.q_days[state.q_day_count] = q_day;
      state.q_day_count++;
   }

   double EffectiveQ(LP_LrmgSymbolState &state, const int scale_lookback_days)
   {
      if(state.q_day_count <= 0)
         return 0.0;

      int horizon = MathMax(0, scale_lookback_days);
      int sample_count = horizon == 0 || horizon > state.q_day_count ? state.q_day_count : horizon;
      if(sample_count <= 0)
         return 0.0;

      double samples[];
      ArrayResize(samples, sample_count);
      int start_index = state.q_day_count - sample_count;
      for(int i = 0; i < sample_count; i++)
         samples[i] = state.q_days[start_index + i];

      return LimniMedianValues(samples, sample_count);
   }

   void FinishCurrentDay(LP_LrmgSymbolState &state)
   {
      if(state.day_key == 0 || state.day_bar_count < LIMNI_LRMG_MIN_DAY_BARS)
         return;

      LimniRadialMap map;
      if(!LimniComputeMovementMap(state.day_times, state.day_closes, 0, state.day_bar_count - 1, false, map))
         return;

      if(map.radius > 0.0 && MathIsValidNumber(map.radius))
         AppendQDay(state, map.radius);
   }

   void StartDay(LP_LrmgSymbolState &state, const MqlRates &bar)
   {
      state.day_key = DayKey(bar.time);
      state.day_bar_count = 0;
      state.base_price = state.has_confirmed_event ? state.last_event_price : bar.close;
      state.current_level = 0;
   }

   void EnsureDay(LP_LrmgSymbolState &state, const MqlRates &bar)
   {
      int bar_day_key = DayKey(bar.time);
      if(state.day_key == 0)
      {
         StartDay(state, bar);
         return;
      }

      if(bar_day_key == state.day_key)
         return;

      FinishCurrentDay(state);
      StartDay(state, bar);
   }

   void AppendEvent(LP_LrmgSymbolState &state, const double event_price, const int direction)
   {
      LimniAppendEventPrice(state.events, state.event_count, state.event_capacity, event_price);
      state.last_event_price = event_price;
      state.has_confirmed_event = true;
      state.last_event_direction = direction;
   }

   double RecentEventDirectionPersistence(const LP_LrmgSymbolState &state)
   {
      if(state.event_count < 2)
         return 0.0;

      int start_index = MathMax(1, state.event_count - 8);
      int count = 0;
      double sum = 0.0;
      for(int i = start_index; i < state.event_count; i++)
      {
         double delta = state.events[i] - state.events[i - 1];
         if(delta > 0.0)
            sum += 1.0;
         else if(delta < 0.0)
            sum -= 1.0;
         count++;
      }

      if(count <= 0)
         return 0.0;
      return Clamp(sum / (double)count, -1.0, 1.0);
   }

   double SweepResolutionScore(const int signal)
   {
      if(signal == LIMNI_KTR_CONTINUATION_BUY)
         return 1.0;
      if(signal == LIMNI_KTR_CONTINUATION_SELL)
         return -1.0;
      if(signal == LIMNI_KTR_REVERSAL_BUY)
         return 0.50;
      if(signal == LIMNI_KTR_REVERSAL_SELL)
         return -0.50;
      return 0.0;
   }

   void UpdateEventMetrics(LP_LrmgSymbolState &state, const double q)
   {
      if(state.event_count <= 0 || q <= 0.0)
         return;

      if(state.cached_metric_event_count == state.event_count)
         return;

      int first_new_event = state.cached_metric_event_count < 0 ? 0 : state.cached_metric_event_count;
      for(int event_index = first_new_event; event_index < state.event_count; event_index++)
      {
         double event_line = LimniMedianRecentEvents(state.events, event_index + 1, LIMNI_LRMG_LINE_EVENT_WINDOW);
         int previous_david = state.last_david_state;
         state.last_david_state = LimniLrmgDavidState(state.events[event_index], event_line, q, state.last_david_state);
         if(state.last_david_state != 0 && state.last_david_state == previous_david)
            state.david_state_age_events++;
         else if(state.last_david_state != 0)
            state.david_state_age_events = 1;
         else
            state.david_state_age_events = 0;

         LimniKataraktiEvent ktr_event;
         int ktr_signal = LimniLrmgKataraktiClassify(
            state.events,
            event_index,
            q,
            event_line,
            state.last_david_state,
            state.lower_ktr_stage,
            state.lower_ktr_age,
            state.lower_ktr_boundary,
            state.upper_ktr_stage,
            state.upper_ktr_age,
            state.upper_ktr_boundary,
            ktr_event
         );
         if(ktr_signal != LIMNI_KTR_SIGNAL_NONE)
            state.last_ktr_signal = ktr_signal;
      }

      state.cached_line = LimniMedianRecentEvents(state.events, state.event_count, LIMNI_LRMG_LINE_EVENT_WINDOW);
      LimniRecentEventRange(state.events, state.event_count, LIMNI_LRMG_STOCH_EVENT_WINDOW, state.cached_lo, state.cached_hi);
      state.cached_metric_event_count = state.event_count;
   }

   int PairStateFromScore(const double score, const LP_Config &config)
   {
      double strong = MathMax(0.01, config.qstate_strong_threshold);
      double weak = MathMax(0.0, config.qstate_weak_threshold);
      if(score >= strong)
         return LP_PAIR_STATE_STRONG_LONG;
      if(score >= weak)
         return LP_PAIR_STATE_WEAK_LONG;
      if(score <= -strong)
         return LP_PAIR_STATE_STRONG_SHORT;
      if(score <= -weak)
         return LP_PAIR_STATE_WEAK_SHORT;
      return LP_PAIR_STATE_NEUTRAL;
   }

   int MarketModeFromState(const int pair_state, const double local_score)
   {
      if(pair_state == LP_PAIR_STATE_STRESS)
         return LP_MARKET_STRESS;
      if(pair_state == LP_PAIR_STATE_STRONG_LONG || pair_state == LP_PAIR_STATE_WEAK_LONG)
         return LP_MARKET_TREND_UP;
      if(pair_state == LP_PAIR_STATE_STRONG_SHORT || pair_state == LP_PAIR_STATE_WEAK_SHORT)
         return LP_MARKET_TREND_DOWN;
      if(MathAbs(local_score) < 0.25)
         return LP_MARKET_RANGE;
      return LP_MARKET_TRANSITION;
   }

   void RebuildFeatureHash(LP_SignalSnapshot &snapshot)
   {
      string payload = snapshot.symbol + "|" +
         LP_Stamp(snapshot.source_bar_time) + "|" +
         snapshot.formula_id + "|" +
         (string)snapshot.formula_hash + "|" +
         DoubleToString(snapshot.q, 8) + "|" +
         DoubleToString(snapshot.pair_q_score, 6) + "|" +
         DoubleToString(snapshot.pair_direction_score, 6) + "|" +
         IntegerToString(snapshot.pair_state) + "|" +
         IntegerToString(snapshot.market_mode) + "|" +
         IntegerToString(snapshot.katarakti_signal);
      snapshot.feature_hash = LP_HashString(payload);
   }

public:
   void Reset()
   {
      m_ready_count = 0;
      for(int i = 0; i < LP_CCY_COUNT; i++)
         m_currency_scores[i] = 0.0;
      for(int s = 0; s < LP_SYMBOL_COUNT; s++)
         ResetSymbol(m_state[s]);
   }

   bool BuildSnapshot(
      const LP_SymbolMeta &meta,
      const datetime source_bar_time,
      const LP_Config &config,
      LP_SignalSnapshot &snapshot
   )
   {
      LP_ResetSignalSnapshot(snapshot);
      snapshot.symbol_id = meta.symbol_id;
      snapshot.symbol = meta.broker_symbol;
      snapshot.lane_id = LP_LANE_TREND_FOLLOW;
      snapshot.variant_id = LP_VARIANT_STRICT;
      snapshot.source_bar_time = source_bar_time;

      if(!meta.tradable || source_bar_time <= 0 || meta.symbol_id < 0 || meta.symbol_id >= LP_SYMBOL_COUNT)
      {
         snapshot.reason = "not_tradable_or_bad_symbol";
         return false;
      }

      LimniQStatePairFeatures features;
      if(!LimniQStateBuildPairFeatures(meta.broker_symbol, features))
      {
         snapshot.reason = features.reason_code;
         snapshot.reason_code = features.reason_code;
         snapshot.formula_id = features.formula_id;
         snapshot.formula_hash = features.formula_hash;
         return false;
      }

      LP_LrmgSymbolState state = m_state[meta.symbol_id];
      if(state.last_bar_time == features.source_m1_time)
      {
         snapshot.reason = "duplicate_bar";
         snapshot.reason_code = "duplicate_bar";
         return false;
      }

      state.last_bar_time = features.source_m1_time;
      snapshot.source_bar_time = features.source_m1_time;
      snapshot.source_m1_time = features.source_m1_time;
      snapshot.formula_id = features.formula_id;
      snapshot.formula_hash = features.formula_hash;
      snapshot.price = features.price;
      snapshot.q = features.q;
      snapshot.anchor = features.anchor;
      snapshot.trend_persistence = features.trend_persistence;
      snapshot.anchor_displacement = features.anchor_displacement;
      snapshot.event_direction_persistence = features.event_direction_persistence;
      snapshot.range_position = features.range_position;
      snapshot.sweep_resolution = features.sweep_resolution;
      snapshot.spread_cost_q = features.spread_cost_q;
      snapshot.pair_q_score = features.pair_q_score;
      snapshot.score = features.pair_q_score;
      snapshot.confidence = features.confidence;
      snapshot.katarakti_signal = features.katarakti_signal;
      snapshot.event_count = features.event_count;
      snapshot.reason_code = features.reason_code;
      snapshot.valid = true;
      snapshot.reason = features.reason_code;
      m_ready_count++;

      m_state[meta.symbol_id] = state;
      return true;
   }

   void ApplyCurrencyQState(
      LP_SignalSnapshot &snapshots[],
      const bool &available[],
      const LP_Config &config
   )
   {
      double sums[LP_CCY_COUNT];
      int counts[LP_CCY_COUNT];
      for(int c = 0; c < LP_CCY_COUNT; c++)
      {
         sums[c] = 0.0;
         counts[c] = 0;
         m_currency_scores[c] = 0.0;
      }

      for(int i = 0; i < LP_SYMBOL_COUNT; i++)
      {
         if(!available[i] || !snapshots[i].valid)
            continue;

         int base_ccy = -1;
         int quote_ccy = -1;
         LP_CanonicalBaseQuote(LP_CanonicalSymbol(snapshots[i].symbol_id), base_ccy, quote_ccy);
         if(base_ccy < 0 || quote_ccy < 0)
            continue;

         sums[base_ccy] += snapshots[i].pair_q_score;
         counts[base_ccy]++;
         sums[quote_ccy] -= snapshots[i].pair_q_score;
         counts[quote_ccy]++;
      }

      for(int c = 0; c < LP_CCY_COUNT; c++)
      {
         if(counts[c] > 0)
            m_currency_scores[c] = sums[c] / (double)counts[c];
      }

      for(int i = 0; i < LP_SYMBOL_COUNT; i++)
      {
         if(!available[i] || !snapshots[i].valid)
            continue;

         int base_ccy = -1;
         int quote_ccy = -1;
         LP_CanonicalBaseQuote(LP_CanonicalSymbol(snapshots[i].symbol_id), base_ccy, quote_ccy);
         if(base_ccy < 0 || quote_ccy < 0)
            continue;

         snapshots[i].base_currency_score = m_currency_scores[base_ccy];
         snapshots[i].quote_currency_score = m_currency_scores[quote_ccy];

         LimniQStatePairFeatures features;
         LimniQStateResetPairFeatures(features);
         features.valid = snapshots[i].valid;
         features.symbol = snapshots[i].symbol;
         features.formula_id = snapshots[i].formula_id;
         features.formula_hash = snapshots[i].formula_hash;
         features.source_m1_time = snapshots[i].source_m1_time;
         features.pair_q_score = snapshots[i].pair_q_score;
         features.spread_cost_q = snapshots[i].spread_cost_q;

         LimniQStateDirection direction;
         LimniQStateFinalizeDirection(
            features,
            snapshots[i].base_currency_score,
            snapshots[i].quote_currency_score,
            direction
         );

         snapshots[i].pair_direction_score = direction.pair_direction_score;
         snapshots[i].direction = direction.trade_direction;
         snapshots[i].pair_state = direction.state;
         snapshots[i].market_mode = direction.market_mode;
         snapshots[i].confidence = direction.confidence;
         snapshots[i].reason_code = direction.reason_code;

         RebuildFeatureHash(snapshots[i]);
         bool changed = snapshots[i].feature_hash != m_state[i].last_feature_hash ||
            snapshots[i].pair_state != m_state[i].last_pair_state;
         snapshots[i].receipt_required = changed;
         m_state[i].last_feature_hash = snapshots[i].feature_hash;
         m_state[i].last_pair_state = snapshots[i].pair_state;
      }
   }

   int ReadyCount()
   {
      return m_ready_count;
   }
};

#endif // __LIMNI_PORTFOLIO_LRMG_STATE_MQH__
