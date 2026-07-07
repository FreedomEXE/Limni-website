//+------------------------------------------------------------------+
//|                         LimniPairDirectionCore.mqh               |
//|       Shared closed-M1 pair-direction exhaustion formula          |
//+------------------------------------------------------------------+
#ifndef LIMNI_PAIR_DIRECTION_CORE_MQH
#define LIMNI_PAIR_DIRECTION_CORE_MQH

#define LIMNI_PAIR_DIRECTION_V001_FORMULA_ID "g99zv-pair-direction-exhaustion-v001"
#define LIMNI_PAIR_DIRECTION_SIDE_SHORT -1
#define LIMNI_PAIR_DIRECTION_SIDE_NONE 0
#define LIMNI_PAIR_DIRECTION_SIDE_LONG 1
#define LIMNI_PAIR_DIRECTION_EXTREME_NONE 0
#define LIMNI_PAIR_DIRECTION_EXTREME_UPPER 1
#define LIMNI_PAIR_DIRECTION_EXTREME_LOWER -1
#define LIMNI_PAIR_DIRECTION_SETUP_UNKNOWN 0
#define LIMNI_PAIR_DIRECTION_SETUP_TREND_CONTINUATION 1
#define LIMNI_PAIR_DIRECTION_SETUP_EXHAUSTION_REVERSAL 2
#define LIMNI_PAIR_DIRECTION_CONFIRM_EVENTS 5
#define LIMNI_PAIR_DIRECTION_MIN_FLIP_SCORE 0.25
#define LIMNI_PAIR_DIRECTION_TREND_WEIGHT 0.60
#define LIMNI_PAIR_DIRECTION_EXHAUSTION_WEIGHT 0.90
#define LIMNI_PAIR_DIRECTION_MOMENTUM_WEIGHT 0.35
#define LIMNI_PAIR_DIRECTION_TREND_STATE_WEIGHT 0.65
#define LIMNI_PAIR_DIRECTION_EXTREME_STOCH_UPPER 95.0
#define LIMNI_PAIR_DIRECTION_EXTREME_STOCH_LOWER 5.0
#define LIMNI_PAIR_DIRECTION_RECLAIM_STOCH_UPPER 90.0
#define LIMNI_PAIR_DIRECTION_RECLAIM_STOCH_LOWER 10.0
#define LIMNI_PAIR_DIRECTION_EXTREME_MIN_DISTANCE_Q 1.0
#define LIMNI_PAIR_DIRECTION_FAILED_EXTENSION_Q 0.25
#define LIMNI_PAIR_DIRECTION_MOMENTUM_DECAY_Q 0.25
#define LIMNI_PAIR_DIRECTION_EXHAUSTION_MIN_FAILURES 2
#define LIMNI_PAIR_DIRECTION_EXTREME_RESET_DISTANCE_Q 0.20
#define LIMNI_PAIR_DIRECTION_EXTREME_MAX_AGE_EVENTS 55

struct LimniPairDirectionResult
{
   bool valid;
   string formula_id;
   ulong formula_hash;
   datetime asof_m1_time;
   int raw_direction;
   int confirmed_direction;
   int pending_direction;
   int pending_count;
   double raw_score;
   double trend_score;
   double reversion_score;
   double exhaustion_score;
   double confidence;
   double q;
   double q_pips;
   double anchor;
   double anchor_distance_q;
   double stoch;
   int trend_state;
   int extreme_state;
   int extreme_age_events;
   double max_extension_q;
   bool failed_extension;
   bool stoch_reclaim;
   bool event_momentum_decay;
   int setup_type;
   string reason_code;
};

struct LimniPairDirectionExtremeTracker
{
   int extreme_state;
   int extreme_age_events;
   double max_extension_q;
   double previous_extension_q;
   double previous_momentum_q;
   bool failed_extension;
   bool stoch_reclaim;
   bool event_momentum_decay;
};

ulong LimniPairDirectionHashString(const string value)
{
   ulong hash = 1469598103934665603;
   int len = StringLen(value);
   for(int i = 0; i < len; i++)
   {
      hash ^= (ulong)StringGetCharacter(value, i);
      hash *= 1099511628211;
   }
   return hash;
}

string LimniPairDirectionFormulaId()
{
   return LIMNI_PAIR_DIRECTION_V001_FORMULA_ID;
}

ulong LimniPairDirectionFormulaHash()
{
   string payload = LIMNI_PAIR_DIRECTION_V001_FORMULA_ID;
   payload += "|closed_m1_stack_only";
   payload += "|forced_long_short_for_valid_data";
   payload += "|confirm_events=" + IntegerToString(LIMNI_PAIR_DIRECTION_CONFIRM_EVENTS);
   payload += "|min_flip_score=" + DoubleToString(LIMNI_PAIR_DIRECTION_MIN_FLIP_SCORE, 2);
   payload += "|weights=trend_0_60,exhaustion_0_90";
   payload += "|trend=state_0_65,momentum_0_35";
   payload += "|exhaustion=extreme_plus_2_failures";
   payload += "|extreme_stoch=95_5";
   payload += "|reclaim_stoch=90_10";
   payload += "|min_extreme_q=1_00";
   payload += "|failed_extension_q=0_25";
   payload += "|momentum_decay_q=0_25";
   payload += "|decision_samples=trend_anchor_trigger_or_q_move";
   return LimniPairDirectionHashString(payload);
}

double LimniPairDirectionClamp(const double value, const double min_value, const double max_value)
{
   if(value < min_value)
      return min_value;
   if(value > max_value)
      return max_value;
   return value;
}

int LimniPairDirectionSign(const double value)
{
   if(value > 0.0)
      return LIMNI_PAIR_DIRECTION_SIDE_LONG;
   if(value < 0.0)
      return LIMNI_PAIR_DIRECTION_SIDE_SHORT;
   return LIMNI_PAIR_DIRECTION_SIDE_NONE;
}

void LimniPairDirectionResetResult(LimniPairDirectionResult &result)
{
   result.valid = false;
   result.formula_id = LimniPairDirectionFormulaId();
   result.formula_hash = LimniPairDirectionFormulaHash();
   result.asof_m1_time = 0;
   result.raw_direction = LIMNI_PAIR_DIRECTION_SIDE_NONE;
   result.confirmed_direction = LIMNI_PAIR_DIRECTION_SIDE_NONE;
   result.pending_direction = LIMNI_PAIR_DIRECTION_SIDE_NONE;
   result.pending_count = 0;
   result.raw_score = 0.0;
   result.trend_score = 0.0;
   result.reversion_score = 0.0;
   result.exhaustion_score = 0.0;
   result.confidence = 0.0;
   result.q = 0.0;
   result.q_pips = 0.0;
   result.anchor = 0.0;
   result.anchor_distance_q = 0.0;
   result.stoch = EMPTY_VALUE;
   result.trend_state = 0;
   result.extreme_state = LIMNI_PAIR_DIRECTION_EXTREME_NONE;
   result.extreme_age_events = 0;
   result.max_extension_q = 0.0;
   result.failed_extension = false;
   result.stoch_reclaim = false;
   result.event_momentum_decay = false;
   result.setup_type = LIMNI_PAIR_DIRECTION_SETUP_UNKNOWN;
   result.reason_code = "not_evaluated";
}

void LimniPairDirectionResetExtremeTracker(LimniPairDirectionExtremeTracker &tracker)
{
   tracker.extreme_state = LIMNI_PAIR_DIRECTION_EXTREME_NONE;
   tracker.extreme_age_events = 0;
   tracker.max_extension_q = 0.0;
   tracker.previous_extension_q = 0.0;
   tracker.previous_momentum_q = 0.0;
   tracker.failed_extension = false;
   tracker.stoch_reclaim = false;
   tracker.event_momentum_decay = false;
}

void LimniPairDirectionStartExtreme(
   LimniPairDirectionExtremeTracker &tracker,
   const int extreme_state,
   const double extension_q,
   const double momentum_q
)
{
   LimniPairDirectionResetExtremeTracker(tracker);
   tracker.extreme_state = extreme_state;
   tracker.extreme_age_events = 1;
   tracker.max_extension_q = extension_q;
   tracker.previous_extension_q = extension_q;
   tracker.previous_momentum_q = momentum_q;
}

int LimniPairDirectionSampleExtreme(const double anchor_distance_q, const double stoch)
{
   if(anchor_distance_q >= LIMNI_PAIR_DIRECTION_EXTREME_MIN_DISTANCE_Q &&
      stoch >= LIMNI_PAIR_DIRECTION_EXTREME_STOCH_UPPER)
   {
      return LIMNI_PAIR_DIRECTION_EXTREME_UPPER;
   }

   if(anchor_distance_q <= -LIMNI_PAIR_DIRECTION_EXTREME_MIN_DISTANCE_Q &&
      stoch <= LIMNI_PAIR_DIRECTION_EXTREME_STOCH_LOWER)
   {
      return LIMNI_PAIR_DIRECTION_EXTREME_LOWER;
   }

   return LIMNI_PAIR_DIRECTION_EXTREME_NONE;
}

void LimniPairDirectionUpdateExtremeTracker(
   const double anchor_distance_q,
   const double stoch,
   const double momentum_q,
   LimniPairDirectionExtremeTracker &tracker
)
{
   int sample_extreme = LimniPairDirectionSampleExtreme(anchor_distance_q, stoch);
   if(sample_extreme != LIMNI_PAIR_DIRECTION_EXTREME_NONE &&
      sample_extreme != tracker.extreme_state)
   {
      LimniPairDirectionStartExtreme(tracker, sample_extreme, anchor_distance_q, momentum_q);
      return;
   }

   if(tracker.extreme_state == LIMNI_PAIR_DIRECTION_EXTREME_NONE)
      return;

   tracker.extreme_age_events++;
   if(MathAbs(anchor_distance_q) <= LIMNI_PAIR_DIRECTION_EXTREME_RESET_DISTANCE_Q ||
      tracker.extreme_age_events > LIMNI_PAIR_DIRECTION_EXTREME_MAX_AGE_EVENTS)
   {
      LimniPairDirectionResetExtremeTracker(tracker);
      return;
   }

   if(tracker.extreme_state == LIMNI_PAIR_DIRECTION_EXTREME_UPPER)
   {
      if(anchor_distance_q > tracker.max_extension_q)
         tracker.max_extension_q = anchor_distance_q;
      if(anchor_distance_q <= tracker.max_extension_q - LIMNI_PAIR_DIRECTION_FAILED_EXTENSION_Q)
         tracker.failed_extension = true;
      if(stoch <= LIMNI_PAIR_DIRECTION_RECLAIM_STOCH_UPPER)
         tracker.stoch_reclaim = true;
      if(tracker.previous_momentum_q > 0.0 &&
         (momentum_q <= 0.0 || tracker.previous_momentum_q - momentum_q >= LIMNI_PAIR_DIRECTION_MOMENTUM_DECAY_Q))
      {
         tracker.event_momentum_decay = true;
      }
   }
   else if(tracker.extreme_state == LIMNI_PAIR_DIRECTION_EXTREME_LOWER)
   {
      if(anchor_distance_q < tracker.max_extension_q)
         tracker.max_extension_q = anchor_distance_q;
      if(anchor_distance_q >= tracker.max_extension_q + LIMNI_PAIR_DIRECTION_FAILED_EXTENSION_Q)
         tracker.failed_extension = true;
      if(stoch >= LIMNI_PAIR_DIRECTION_RECLAIM_STOCH_LOWER)
         tracker.stoch_reclaim = true;
      if(tracker.previous_momentum_q < 0.0 &&
         (momentum_q >= 0.0 || momentum_q - tracker.previous_momentum_q >= LIMNI_PAIR_DIRECTION_MOMENTUM_DECAY_Q))
      {
         tracker.event_momentum_decay = true;
      }
   }

   tracker.previous_extension_q = anchor_distance_q;
   tracker.previous_momentum_q = momentum_q;
}

int LimniPairDirectionExtremeFailureCount(const LimniPairDirectionExtremeTracker &tracker)
{
   int failure_count = 0;
   if(tracker.failed_extension)
      failure_count++;
   if(tracker.stoch_reclaim)
      failure_count++;
   if(tracker.event_momentum_decay)
      failure_count++;
   return failure_count;
}

double LimniPairDirectionExhaustionScore(const LimniPairDirectionExtremeTracker &tracker)
{
   if(tracker.extreme_state == LIMNI_PAIR_DIRECTION_EXTREME_NONE)
      return 0.0;

   int failure_count = LimniPairDirectionExtremeFailureCount(tracker);
   if(failure_count < LIMNI_PAIR_DIRECTION_EXHAUSTION_MIN_FAILURES)
      return 0.0;

   double distance_strength = LimniPairDirectionClamp(MathAbs(tracker.max_extension_q) / 2.0, 0.0, 1.0);
   double failure_strength = LimniPairDirectionClamp((double)failure_count / 3.0, 0.0, 1.0);
   double strength = LimniPairDirectionClamp(0.70 * failure_strength + 0.30 * distance_strength, 0.0, 1.0);

   if(tracker.extreme_state == LIMNI_PAIR_DIRECTION_EXTREME_UPPER)
      return -strength;
   if(tracker.extreme_state == LIMNI_PAIR_DIRECTION_EXTREME_LOWER)
      return strength;
   return 0.0;
}

bool LimniPairDirectionValidNumber(const double value)
{
   return value != EMPTY_VALUE && MathIsValidNumber(value);
}

bool LimniPairDirectionValidSample(
   const int index,
   const datetime &source_times[],
   const double &source_closes[],
   const double &source_q[],
   const double &source_line[],
   const double &source_stoch[]
)
{
   int count = ArraySize(source_times);
   if(index < 0 || index >= count)
      return false;
   if(ArraySize(source_closes) <= index || ArraySize(source_q) <= index || ArraySize(source_line) <= index || ArraySize(source_stoch) <= index)
      return false;
   if(source_times[index] <= 0)
      return false;
   if(!LimniPairDirectionValidNumber(source_closes[index]))
      return false;
   if(source_q[index] <= 0.0 || !MathIsValidNumber(source_q[index]))
      return false;
   if(!LimniPairDirectionValidNumber(source_line[index]))
      return false;
   if(!LimniPairDirectionValidNumber(source_stoch[index]))
      return false;
   return true;
}

int LimniPairDirectionFallbackDirection(
   const int previous_direction,
   const int trend_state,
   const double anchor_distance_q
)
{
   if(previous_direction != LIMNI_PAIR_DIRECTION_SIDE_NONE)
      return previous_direction;
   if(trend_state > 0)
      return LIMNI_PAIR_DIRECTION_SIDE_LONG;
   if(trend_state < 0)
      return LIMNI_PAIR_DIRECTION_SIDE_SHORT;
   if(anchor_distance_q > 0.0)
      return LIMNI_PAIR_DIRECTION_SIDE_LONG;
   return LIMNI_PAIR_DIRECTION_SIDE_SHORT;
}

bool LimniPairDirectionDecisionSample(
   const int index,
   const int latest_index,
   const int last_decision_index,
   const double &source_closes[],
   const double &source_q[],
   const double &source_line[],
   const int &source_ma_state[],
   const int &source_trigger[]
)
{
   if(last_decision_index < 0 || index == latest_index)
      return true;
   if(ArraySize(source_ma_state) > index && ArraySize(source_ma_state) > last_decision_index)
   {
      if(source_ma_state[index] != source_ma_state[last_decision_index])
         return true;
   }
   if(ArraySize(source_trigger) > index && source_trigger[index] != 0)
      return true;
   if(ArraySize(source_line) > index && ArraySize(source_line) > last_decision_index)
   {
      double q = source_q[index] > 0.0 ? source_q[index] : source_q[last_decision_index];
      double line_delta = MathAbs(source_line[index] - source_line[last_decision_index]);
      if(q > 0.0 && line_delta >= q * 0.05)
         return true;
   }
   if(ArraySize(source_closes) > index && ArraySize(source_closes) > last_decision_index)
   {
      double q = source_q[index] > 0.0 ? source_q[index] : source_q[last_decision_index];
      if(q > 0.0 && MathAbs(source_closes[index] - source_closes[last_decision_index]) >= q)
         return true;
   }
   return false;
}

bool LimniPairDirectionEvaluateSample(
   const int index,
   const int momentum_reference_index,
   const int previous_raw_direction,
   const bool update_extreme_tracker,
   const datetime &source_times[],
   const double &source_closes[],
   const double &source_q[],
   const double &source_line[],
   const double &source_stoch[],
   const int &source_ma_state[],
   const double pip_size,
   LimniPairDirectionExtremeTracker &extreme_tracker,
   LimniPairDirectionResult &result
)
{
   if(!LimniPairDirectionValidSample(index, source_times, source_closes, source_q, source_line, source_stoch))
   {
      LimniPairDirectionResetResult(result);
      result.reason_code = "invalid_sample";
      return false;
   }

   int trend_state = 0;
   if(ArraySize(source_ma_state) > index)
      trend_state = source_ma_state[index];

   double q = source_q[index];
   double price = source_closes[index];
   double anchor = source_line[index];
   double stoch = source_stoch[index];
   double anchor_distance_q = (price - anchor) / q;

   int ref_index = momentum_reference_index;
   if(ref_index < 0 || ref_index >= index || !LimniPairDirectionValidSample(ref_index, source_times, source_closes, source_q, source_line, source_stoch))
      ref_index = index > 0 ? index - 1 : index;

   double momentum_q = 0.0;
   if(ref_index >= 0 && ref_index < index && LimniPairDirectionValidNumber(source_closes[ref_index]))
      momentum_q = (price - source_closes[ref_index]) / q;

   double trend_state_score = 0.0;
   if(trend_state > 0)
      trend_state_score = 1.0;
   else if(trend_state < 0)
      trend_state_score = -1.0;

   double momentum_score = LimniPairDirectionClamp(momentum_q, -1.0, 1.0);
   double trend_score =
      LIMNI_PAIR_DIRECTION_TREND_STATE_WEIGHT * trend_state_score +
      LIMNI_PAIR_DIRECTION_MOMENTUM_WEIGHT * momentum_score;

   if(update_extreme_tracker)
      LimniPairDirectionUpdateExtremeTracker(anchor_distance_q, stoch, momentum_q, extreme_tracker);

   double exhaustion_score = LimniPairDirectionExhaustionScore(extreme_tracker);
   double raw_score =
      LIMNI_PAIR_DIRECTION_TREND_WEIGHT * trend_score +
      LIMNI_PAIR_DIRECTION_EXHAUSTION_WEIGHT * exhaustion_score;

   int raw_direction = LimniPairDirectionSign(raw_score);
   if(raw_direction == LIMNI_PAIR_DIRECTION_SIDE_NONE)
      raw_direction = LimniPairDirectionFallbackDirection(previous_raw_direction, trend_state, anchor_distance_q);

   double trend_component = LIMNI_PAIR_DIRECTION_TREND_WEIGHT * trend_score;
   double exhaustion_component = LIMNI_PAIR_DIRECTION_EXHAUSTION_WEIGHT * exhaustion_score;
   int setup_type = LIMNI_PAIR_DIRECTION_SETUP_TREND_CONTINUATION;
   if(exhaustion_score != 0.0 &&
      raw_direction == LimniPairDirectionSign(exhaustion_score) &&
      MathAbs(exhaustion_component) >= MathAbs(trend_component))
   {
      setup_type = LIMNI_PAIR_DIRECTION_SETUP_EXHAUSTION_REVERSAL;
   }

   result.valid = true;
   result.formula_id = LimniPairDirectionFormulaId();
   result.formula_hash = LimniPairDirectionFormulaHash();
   result.asof_m1_time = source_times[index];
   result.raw_direction = raw_direction;
   result.raw_score = raw_score;
   result.trend_score = trend_score;
   result.reversion_score = exhaustion_score;
   result.exhaustion_score = exhaustion_score;
   result.confidence = LimniPairDirectionClamp(MathAbs(raw_score), 0.0, 1.0);
   result.q = q;
   result.q_pips = pip_size > 0.0 ? q / pip_size : 0.0;
   result.anchor = anchor;
   result.anchor_distance_q = anchor_distance_q;
   result.stoch = stoch;
   result.trend_state = trend_state;
   result.extreme_state = extreme_tracker.extreme_state;
   result.extreme_age_events = extreme_tracker.extreme_age_events;
   result.max_extension_q = extreme_tracker.max_extension_q;
   result.failed_extension = extreme_tracker.failed_extension;
   result.stoch_reclaim = extreme_tracker.stoch_reclaim;
   result.event_momentum_decay = extreme_tracker.event_momentum_decay;
   result.setup_type = setup_type;
   result.reason_code = "ok";
   return true;
}

bool LimniPairDirectionReplay(
   const datetime &source_times[],
   const double &source_closes[],
   const double &source_q[],
   const double &source_line[],
   const double &source_stoch[],
   const int &source_ma_state[],
   const int &source_trigger[],
   const double pip_size,
   LimniPairDirectionResult &result
)
{
   LimniPairDirectionResetResult(result);

   int source_count = ArraySize(source_times);
   if(source_count <= 0)
   {
      result.reason_code = "empty_source";
      return false;
   }

   int latest_valid_index = -1;
   for(int i = source_count - 1; i >= 0; i--)
   {
      if(LimniPairDirectionValidSample(i, source_times, source_closes, source_q, source_line, source_stoch))
      {
         latest_valid_index = i;
         break;
      }
   }

   if(latest_valid_index < 0)
   {
      result.reason_code = "no_valid_sample";
      return false;
   }

   int confirmed_direction = LIMNI_PAIR_DIRECTION_SIDE_NONE;
   int pending_direction = LIMNI_PAIR_DIRECTION_SIDE_NONE;
   int pending_count = 0;
   int previous_raw_direction = LIMNI_PAIR_DIRECTION_SIDE_NONE;
   int last_decision_index = -1;
   LimniPairDirectionExtremeTracker extreme_tracker;
   LimniPairDirectionResetExtremeTracker(extreme_tracker);
   LimniPairDirectionResult latest_result;
   LimniPairDirectionResetResult(latest_result);

   for(int i = 0; i <= latest_valid_index; i++)
   {
      if(!LimniPairDirectionValidSample(i, source_times, source_closes, source_q, source_line, source_stoch))
         continue;

      bool is_decision_sample = LimniPairDirectionDecisionSample(
         i,
         latest_valid_index,
         last_decision_index,
         source_closes,
         source_q,
         source_line,
         source_ma_state,
         source_trigger
      );

      int momentum_reference_index = last_decision_index >= 0 ? last_decision_index : MathMax(0, i - 1);
      if(!LimniPairDirectionEvaluateSample(
         i,
         momentum_reference_index,
         previous_raw_direction,
         is_decision_sample,
         source_times,
         source_closes,
         source_q,
         source_line,
         source_stoch,
         source_ma_state,
         pip_size,
         extreme_tracker,
         latest_result
      ))
      {
         continue;
      }

      previous_raw_direction = latest_result.raw_direction;

      if(is_decision_sample)
      {
         if(confirmed_direction == LIMNI_PAIR_DIRECTION_SIDE_NONE)
         {
            confirmed_direction = latest_result.raw_direction;
            pending_direction = LIMNI_PAIR_DIRECTION_SIDE_NONE;
            pending_count = 0;
         }
         else if(latest_result.raw_direction == confirmed_direction)
         {
            pending_direction = LIMNI_PAIR_DIRECTION_SIDE_NONE;
            pending_count = 0;
         }
         else if(MathAbs(latest_result.raw_score) >= LIMNI_PAIR_DIRECTION_MIN_FLIP_SCORE)
         {
            if(pending_direction == latest_result.raw_direction)
               pending_count++;
            else
            {
               pending_direction = latest_result.raw_direction;
               pending_count = 1;
            }

            if(pending_count >= LIMNI_PAIR_DIRECTION_CONFIRM_EVENTS)
            {
               confirmed_direction = latest_result.raw_direction;
               pending_direction = LIMNI_PAIR_DIRECTION_SIDE_NONE;
               pending_count = 0;
            }
         }
         else
         {
            pending_direction = LIMNI_PAIR_DIRECTION_SIDE_NONE;
            pending_count = 0;
         }

         last_decision_index = i;
      }
   }

   if(!latest_result.valid)
   {
      result.reason_code = "replay_failed";
      return false;
   }

   result = latest_result;
   if(confirmed_direction == LIMNI_PAIR_DIRECTION_SIDE_NONE)
      confirmed_direction = latest_result.raw_direction;
   result.confirmed_direction = confirmed_direction;
   result.pending_direction = pending_direction;
   result.pending_count = pending_count;
   result.reason_code = "ok";
   return true;
}

#endif // LIMNI_PAIR_DIRECTION_CORE_MQH
