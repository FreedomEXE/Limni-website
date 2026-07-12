/*-----------------------------------------------
  Revma closed-M1 pair-direction signal state
-----------------------------------------------*/
#ifndef __LIMNI_PORTFOLIO_REVMA_SIGNAL_STATE_MQH__
#define __LIMNI_PORTFOLIO_REVMA_SIGNAL_STATE_MQH__

#include "..\\..\\Core\\Types.mqh"
#include "..\\..\\Core\\SymbolUniverse.mqh"
#include "..\\..\\Market\\SymbolSpecCache.mqh"
#include "RevmaTypes.mqh"
#include "..\\..\\..\\..\\Indicators\\Include\\LimniRadialMovementGrid.mqh"

#define LP_REVMA_LINE_EVENT_WINDOW 55
#define LP_REVMA_STOCH_EVENT_WINDOW 55
#define LP_REVMA_DAVID_CONFIRM_Q 1.0
#define LP_REVMA_MIN_DAY_BARS 10
#define LP_REVMA_MAX_BRICKS_PER_BAR 200

struct LP_RevmaSymbolState
{
   bool bootstrapped;
   datetime last_processed_m1;
   int closed_m1_bars;
   int day_key;
   int day_bar_count;
   int day_bar_capacity;
   datetime day_times[];
   double day_closes[];
   int q_day_count;
   int q_day_capacity;
   double q_days[];
   int cached_q_day_count;
   double cached_effective_q;
   bool has_confirmed_event;
   double base_price;
   double last_event_price;
   int current_level;
   int event_count;
   ulong reconstruction_epoch;
   datetime initial_history_boundary;
   int event_capacity;
   double events[];
   int cached_metric_event_count;
   double cached_line;
   double cached_lo;
   double cached_hi;
   int last_trend_state;
   int previous_raw_direction;
   int confirmed_direction;
   int pending_direction;
   int pending_count;
   bool has_last_decision;
   LimniPairDirectionPoint last_decision_point;
   LimniPairDirectionExtremeTracker extreme_tracker;
   LimniPairDirectionResult latest_pair_direction;
};

class LP_RevmaSignalState
{
private:
   LP_RevmaSymbolState m_state[LP_SYMBOL_COUNT];

   int DayKey(const datetime value)
   {
      MqlDateTime parts;
      TimeToStruct(value, parts);
      return parts.year * 10000 + parts.mon * 100 + parts.day;
   }

   void ResetSymbol(LP_RevmaSymbolState &state)
   {
      state.bootstrapped = false;
      state.last_processed_m1 = 0;
      state.closed_m1_bars = 0;
      state.day_key = 0;
      state.day_bar_count = 0;
      state.day_bar_capacity = 0;
      ArrayResize(state.day_times, 0);
      ArrayResize(state.day_closes, 0);
      state.q_day_count = 0;
      state.q_day_capacity = 0;
      ArrayResize(state.q_days, 0);
      state.cached_q_day_count = -1;
      state.cached_effective_q = 0.0;
      state.has_confirmed_event = false;
      state.base_price = 0.0;
      state.last_event_price = 0.0;
      state.current_level = 0;
      state.event_count = 0;
      state.reconstruction_epoch = 0;
      state.initial_history_boundary = 0;
      state.event_capacity = 0;
      ArrayResize(state.events, 0);
      state.cached_metric_event_count = -1;
      state.cached_line = EMPTY_VALUE;
      state.cached_lo = 0.0;
      state.cached_hi = 0.0;
      state.last_trend_state = 0;
      state.previous_raw_direction = LP_SIDE_NONE;
      state.confirmed_direction = LP_SIDE_NONE;
      state.pending_direction = LP_SIDE_NONE;
      state.pending_count = 0;
      state.has_last_decision = false;
      LimniPairDirectionResetPoint(state.last_decision_point);
      LimniPairDirectionResetExtremeTracker(state.extreme_tracker);
      LimniPairDirectionResetResult(state.latest_pair_direction);
   }

   void AppendDayBar(LP_RevmaSymbolState &state, const datetime value_time, const double value_close)
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

   void AppendQDay(LP_RevmaSymbolState &state, const double q_day)
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
      state.cached_q_day_count = -1;
      state.cached_effective_q = 0.0;
   }

   double MedianValues(double &values[], const int count)
   {
      if(count <= 0)
         return 0.0;
      ArrayResize(values, count);
      ArraySort(values);
      int mid = count / 2;
      if((count % 2) == 1)
         return values[mid];
      return (values[mid - 1] + values[mid]) / 2.0;
   }

   double EffectiveQ(LP_RevmaSymbolState &state)
   {
      if(state.q_day_count <= 0)
      {
         state.cached_q_day_count = 0;
         state.cached_effective_q = 0.0;
         return 0.0;
      }
      if(state.cached_q_day_count == state.q_day_count && state.cached_effective_q > 0.0 && MathIsValidNumber(state.cached_effective_q))
         return state.cached_effective_q;
      double samples[];
      ArrayResize(samples, state.q_day_count);
      for(int i = 0; i < state.q_day_count; i++)
         samples[i] = state.q_days[i];
      state.cached_effective_q = MedianValues(samples, state.q_day_count);
      state.cached_q_day_count = state.q_day_count;
      return state.cached_effective_q;
   }

   void FinishCurrentDay(LP_RevmaSymbolState &state)
   {
      if(state.day_key == 0 || state.day_bar_count < LP_REVMA_MIN_DAY_BARS)
         return;

      LimniRadialMap map;
      if(!LimniComputeMovementMap(state.day_times, state.day_closes, 0, state.day_bar_count - 1, false, map))
         return;
      if(map.radius > 0.0 && MathIsValidNumber(map.radius))
         AppendQDay(state, map.radius);
   }

   void StartDay(LP_RevmaSymbolState &state, const MqlRates &bar)
   {
      state.day_key = DayKey(bar.time);
      state.day_bar_count = 0;
      state.base_price = state.has_confirmed_event ? state.last_event_price : bar.close;
      state.current_level = 0;
   }

   void EnsureDay(LP_RevmaSymbolState &state, const MqlRates &bar)
   {
      int key = DayKey(bar.time);
      if(state.day_key == 0)
      {
         StartDay(state, bar);
         return;
      }
      if(key == state.day_key)
         return;
      FinishCurrentDay(state);
      StartDay(state, bar);
   }

   void AppendEvent(LP_RevmaSymbolState &state, const double event_price)
   {
      if(state.event_count >= state.event_capacity)
      {
         state.event_capacity = state.event_capacity <= 0 ? 256 : state.event_capacity * 2;
         ArrayResize(state.events, state.event_capacity);
      }
      state.events[state.event_count] = event_price;
      state.event_count++;
      state.last_event_price = event_price;
      state.has_confirmed_event = true;
   }

   double MedianRecentEvents(LP_RevmaSymbolState &state, const int count, const int window)
   {
      if(count <= 0)
         return 0.0;
      int start_index = MathMax(0, count - MathMax(1, window));
      int sample_count = count - start_index;
      double samples[];
      ArrayResize(samples, sample_count);
      for(int i = 0; i < sample_count; i++)
         samples[i] = state.events[start_index + i];
      return MedianValues(samples, sample_count);
   }

   void RecentEventRange(LP_RevmaSymbolState &state, const int count, const int window, double &lo, double &hi)
   {
      lo = 0.0;
      hi = 0.0;
      if(count <= 0)
         return;
      int start_index = MathMax(0, count - MathMax(2, window));
      lo = state.events[start_index];
      hi = state.events[start_index];
      for(int i = start_index + 1; i < count; i++)
      {
         if(state.events[i] < lo)
            lo = state.events[i];
         if(state.events[i] > hi)
            hi = state.events[i];
      }
   }

   double BoundedStoch(const double price, const double lo, const double hi)
   {
      double span = hi - lo;
      if(span <= 0.0)
         return EMPTY_VALUE;
      double raw = 100.0 * (price - lo) / span;
      if(raw < 0.0)
         return 0.0;
      if(raw > 100.0)
         return 100.0;
      return raw;
   }

   int TrendState(const double event_price, const double reference_line, const double q, const int previous_state)
   {
      if(reference_line == EMPTY_VALUE || q <= 0.0)
         return previous_state;
      double z = (event_price - reference_line) / q;
      if(z >= LP_REVMA_DAVID_CONFIRM_Q)
         return 1;
      if(z <= -LP_REVMA_DAVID_CONFIRM_Q)
         return -1;
      return previous_state;
   }

   void BuildSignalFromResult(
      const LP_SymbolMeta &meta,
      const LP_RevmaSymbolState &state,
      const LP_Config &config,
      const LimniPairDirectionResult &direction,
      LP_RevmaSignal &signal
   )
   {
      LP_ResetRevmaSignal(signal);
      signal.valid = direction.valid;
      signal.symbol_id = meta.symbol_id;
      signal.symbol = meta.broker_symbol;
      signal.source_m1_time = direction.asof_m1_time;
      signal.closed_m1_bars = state.closed_m1_bars;
      signal.q_days = state.q_day_count;
      signal.q_event_count = state.event_count;
      signal.reconstruction_epoch = state.reconstruction_epoch;
      signal.initial_history_boundary = state.initial_history_boundary;
      signal.q_profile = config.revma_q_profile;
      signal.max_m1_bars = LP_RevmaResolvedMaxM1Bars(config);
      signal.q_profile_id = LP_RevmaConfigQProfileId(config);
      signal.price = 0.0;
      signal.q = direction.q;
      signal.q_pips = direction.q_pips;
      signal.anchor = direction.anchor;
      signal.anchor_distance_q = direction.anchor_distance_q;
      signal.stoch = direction.stoch;
      signal.trend_state = direction.trend_state;
      signal.direction = direction.confirmed_direction;
      signal.raw_direction = direction.raw_direction;
      signal.pending_direction = direction.pending_direction;
      signal.pending_count = direction.pending_count;
      signal.raw_score = direction.raw_score;
      signal.trend_score = direction.trend_score;
      signal.exhaustion_score = direction.exhaustion_score;
      signal.confidence = direction.confidence;
      signal.extreme_state = direction.extreme_state;
      signal.extreme_age_events = direction.extreme_age_events;
      signal.max_extension_q = direction.max_extension_q;
      signal.failed_extension = direction.failed_extension;
      signal.stoch_reclaim = direction.stoch_reclaim;
      signal.event_momentum_decay = direction.event_momentum_decay;
      signal.price = direction.anchor + direction.anchor_distance_q * direction.q;
      signal.reason_code = direction.reason_code;
      int relation = 0;
      int sleeve = LP_REVMA_SLEEVE_NONE;
      if(direction.valid && LP_RevmaClassifySleeve(direction.confirmed_direction, signal.price, direction.anchor, relation, sleeve))
      {
         signal.birth_eligible = true;
         signal.anchor_relation = relation;
         signal.sleeve = sleeve;
         signal.variant_id = LP_RevmaVariantForSleeve(sleeve);
      }
      else
      {
         signal.birth_eligible = false;
         signal.anchor_relation = relation;
         signal.reason_code = direction.valid ? "mean_reversion_setup_required" : direction.reason_code;
      }
   }

   bool ProcessClosedBar(
      LP_RevmaSymbolState &state,
      const LP_SymbolMeta &meta,
      const LP_Config &config,
      const MqlRates &bar,
      LP_RevmaSignal &signal
   )
   {
      LP_ResetRevmaSignal(signal);
      if(bar.time <= 0 || (state.last_processed_m1 > 0 && bar.time <= state.last_processed_m1))
         return false;

      EnsureDay(state, bar);
      AppendDayBar(state, bar.time, bar.close);
      state.last_processed_m1 = bar.time;
      state.closed_m1_bars++;

      double q = EffectiveQ(state);
      if(q <= 0.0)
      {
         signal.reason_code = "q_not_ready";
         return false;
      }

      int trigger = 0;
      int guard = 0;
      while(bar.close >= state.base_price + ((double)state.current_level + 1.0) * q && guard < LP_REVMA_MAX_BRICKS_PER_BAR)
      {
         state.current_level++;
         AppendEvent(state, state.base_price + (double)state.current_level * q);
         trigger = 1;
         guard++;
      }

      guard = 0;
      while(bar.close <= state.base_price + ((double)state.current_level - 1.0) * q && guard < LP_REVMA_MAX_BRICKS_PER_BAR)
      {
         state.current_level--;
         AppendEvent(state, state.base_price + (double)state.current_level * q);
         trigger = -1;
         guard++;
      }

      if(state.event_count <= 0)
      {
         signal.reason_code = "event_stack_not_ready";
         return false;
      }

      if(state.cached_metric_event_count != state.event_count)
      {
         int first_new_event = state.cached_metric_event_count < 0 ? 0 : state.cached_metric_event_count;
         for(int event_index = first_new_event; event_index < state.event_count; event_index++)
         {
            double event_line = MedianRecentEvents(state, event_index + 1, LP_REVMA_LINE_EVENT_WINDOW);
            state.last_trend_state = TrendState(state.events[event_index], event_line, q, state.last_trend_state);
         }
         state.cached_line = MedianRecentEvents(state, state.event_count, LP_REVMA_LINE_EVENT_WINDOW);
         RecentEventRange(state, state.event_count, LP_REVMA_STOCH_EVENT_WINDOW, state.cached_lo, state.cached_hi);
         state.cached_metric_event_count = state.event_count;
      }

      LimniPairDirectionPoint point;
      LimniPairDirectionResetPoint(point);
      point.time = bar.time;
      point.price = bar.close;
      point.q = q;
      point.anchor = state.cached_line;
      point.stoch = BoundedStoch(bar.close, state.cached_lo, state.cached_hi);
      point.trend_state = state.last_trend_state;
      point.trigger = trigger;

      bool is_decision = LimniPairDirectionDecisionPoint(point, false, state.has_last_decision, state.last_decision_point);
      LimniPairDirectionPoint reference;
      LimniPairDirectionResetPoint(reference);
      if(state.has_last_decision)
         reference = state.last_decision_point;

      LimniPairDirectionResult direction;
      if(!LimniPairDirectionEvaluatePoint(
         point,
         reference,
         state.previous_raw_direction,
         is_decision,
         LP_RevmaPipSize(meta),
         state.extreme_tracker,
         direction
      ))
      {
         signal.reason_code = direction.reason_code;
         return false;
      }

      state.previous_raw_direction = direction.raw_direction;
      if(is_decision)
      {
         if(state.confirmed_direction == LP_SIDE_NONE)
         {
            state.confirmed_direction = direction.raw_direction;
            state.pending_direction = LP_SIDE_NONE;
            state.pending_count = 0;
         }
         else if(direction.raw_direction == state.confirmed_direction)
         {
            state.pending_direction = LP_SIDE_NONE;
            state.pending_count = 0;
         }
         else if(MathAbs(direction.raw_score) >= LIMNI_PAIR_DIRECTION_MIN_FLIP_SCORE)
         {
            if(state.pending_direction == direction.raw_direction)
               state.pending_count++;
            else
            {
               state.pending_direction = direction.raw_direction;
               state.pending_count = 1;
            }

            if(state.pending_count >= LIMNI_PAIR_DIRECTION_CONFIRM_EVENTS)
            {
               state.confirmed_direction = direction.raw_direction;
               state.pending_direction = LP_SIDE_NONE;
               state.pending_count = 0;
            }
         }
         else
         {
            state.pending_direction = LP_SIDE_NONE;
            state.pending_count = 0;
         }

         state.last_decision_point = point;
         state.has_last_decision = true;
      }

      if(state.confirmed_direction == LP_SIDE_NONE)
         state.confirmed_direction = direction.raw_direction;

      direction.confirmed_direction = state.confirmed_direction;
      direction.pending_direction = state.pending_direction;
      direction.pending_count = state.pending_count;
      state.latest_pair_direction = direction;
      BuildSignalFromResult(meta, state, config, direction, signal);
      return signal.valid;
   }

   void NormalizeRatesOrder(MqlRates &rates[], const int count)
   {
      if(count <= 1)
         return;
      if(rates[0].time <= rates[count - 1].time)
         return;
      for(int i = 0; i < count / 2; i++)
      {
         MqlRates tmp = rates[i];
         rates[i] = rates[count - 1 - i];
         rates[count - 1 - i] = tmp;
      }
   }

   bool Bootstrap(
      LP_RevmaSymbolState &state,
      const LP_SymbolMeta &meta,
      const LP_Config &config,
      LP_RevmaSignal &signal,
      string &detail
   )
   {
      int requested_bars = LP_RevmaResolvedMaxM1Bars(config);
      int bars = requested_bars <= 0 ? MathMax(0, Bars(meta.broker_symbol, PERIOD_M1) - 1) : requested_bars;
      if(bars <= 0)
         bars = 500;
      MqlRates rates[];
      int copied = CopyRates(meta.broker_symbol, PERIOD_M1, 1, bars, rates);
      if(copied <= 0)
      {
         detail = "bootstrap_copyrates_failed";
         return false;
      }
      NormalizeRatesOrder(rates, copied);
      ulong reconstruction_epoch = LP_HashString("revma_reconstruction_epoch_v1");
      LP_HashMixInt(reconstruction_epoch, meta.symbol_id);
      LP_HashMixLong(reconstruction_epoch, (long)rates[0].time);
      LP_HashMixLong(reconstruction_epoch, (long)rates[copied - 1].time);
      LP_HashMixInt(reconstruction_epoch, copied);
      LP_HashMixInt(reconstruction_epoch, LP_RevmaResolvedMaxM1Bars(config));
      LP_HashMixInt(reconstruction_epoch, (int)config.revma_q_profile);
      if(reconstruction_epoch == 0)
      {
         detail = "bootstrap_reconstruction_epoch_zero";
         return false;
      }
      state.reconstruction_epoch = reconstruction_epoch;
      state.initial_history_boundary = rates[0].time;
      for(int i = 0; i < copied; i++)
         ProcessClosedBar(state, meta, config, rates[i], signal);
      state.bootstrapped = true;
      detail = "bootstrap_copied=" + IntegerToString(copied);
      return true;
   }

public:
   void Reset()
   {
      for(int i = 0; i < LP_SYMBOL_COUNT; i++)
         ResetSymbol(m_state[i]);
   }

   bool BuildSignal(
      const LP_SymbolMeta &meta,
      const LP_Config &config,
      LP_RevmaSignal &signal,
      string &detail
   )
   {
      MqlRates latest_rates[1];
      if(CopyRates(meta.broker_symbol, PERIOD_M1, 1, 1, latest_rates) != 1)
      {
         LP_ResetRevmaSignal(signal);
         detail = "";
         signal.reason_code = "latest_closed_m1_missing";
         return false;
      }
      return BuildSignalAtClosedBar(meta, config, latest_rates[0], signal, detail);
   }

   bool BuildSignalAtClosedBar(
      const LP_SymbolMeta &meta,
      const LP_Config &config,
      const MqlRates &latest_bar,
      LP_RevmaSignal &signal,
      string &detail
   )
   {
      LP_ResetRevmaSignal(signal);
      detail = "";
      if(meta.symbol_id < 0 || meta.symbol_id >= LP_SYMBOL_COUNT || !meta.tradable)
      {
         signal.reason_code = "not_tradable_or_bad_symbol";
         return false;
      }

      int symbol_id = meta.symbol_id;
      if(!m_state[symbol_id].bootstrapped)
      {
         if(!Bootstrap(m_state[symbol_id], meta, config, signal, detail))
         {
            signal.reason_code = detail;
            return false;
         }
      }

      if(latest_bar.time <= 0 || latest_bar.close <= 0.0 || !MathIsValidNumber(latest_bar.close))
      {
         signal.reason_code = "latest_closed_m1_missing";
         return false;
      }

      datetime latest_closed = latest_bar.time;
      if(latest_closed <= m_state[symbol_id].last_processed_m1)
      {
         BuildSignalFromResult(meta, m_state[symbol_id], config, m_state[symbol_id].latest_pair_direction, signal);
         detail = detail == "" ? "duplicate_closed_m1" : detail + "|duplicate_closed_m1";
         return signal.valid;
      }

      datetime expected_next = (datetime)((long)m_state[symbol_id].last_processed_m1 + 60);
      if(m_state[symbol_id].last_processed_m1 > 0 && latest_closed == expected_next)
      {
         ProcessClosedBar(m_state[symbol_id], meta, config, latest_bar, signal);
         detail = detail == "" ? "clock_bar_processed=1" : detail + "|clock_bar_processed=1";
         return signal.valid;
      }

      MqlRates rates[];
      datetime from_time = expected_next;
      int copied = CopyRates(meta.broker_symbol, PERIOD_M1, from_time, latest_closed, rates);
      if(copied <= 0)
      {
         signal.reason_code = "incremental_copyrates_failed";
         return false;
      }
      NormalizeRatesOrder(rates, copied);
      for(int i = 0; i < copied; i++)
         ProcessClosedBar(m_state[symbol_id], meta, config, rates[i], signal);

      detail = detail == "" ? "incremental_copied=" + IntegerToString(copied) : detail + "|incremental_copied=" + IntegerToString(copied);
      return signal.valid;
   }
};

#endif // __LIMNI_PORTFOLIO_REVMA_SIGNAL_STATE_MQH__
