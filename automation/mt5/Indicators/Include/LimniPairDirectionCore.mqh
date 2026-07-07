//+------------------------------------------------------------------+
//|                         LimniPairDirectionCore.mqh               |
//|       Shared closed-M1 pair-direction v001 formula and latch     |
//+------------------------------------------------------------------+
#ifndef LIMNI_PAIR_DIRECTION_CORE_MQH
#define LIMNI_PAIR_DIRECTION_CORE_MQH

#define LIMNI_PAIR_DIRECTION_V001_FORMULA_ID "g99zu-pair-direction-v001"
#define LIMNI_PAIR_DIRECTION_SIDE_SHORT -1
#define LIMNI_PAIR_DIRECTION_SIDE_NONE 0
#define LIMNI_PAIR_DIRECTION_SIDE_LONG 1
#define LIMNI_PAIR_DIRECTION_CONFIRM_EVENTS 5
#define LIMNI_PAIR_DIRECTION_MIN_FLIP_SCORE 0.25
#define LIMNI_PAIR_DIRECTION_TREND_WEIGHT 0.50
#define LIMNI_PAIR_DIRECTION_REVERSION_WEIGHT 0.50
#define LIMNI_PAIR_DIRECTION_MOMENTUM_WEIGHT 0.35
#define LIMNI_PAIR_DIRECTION_TREND_STATE_WEIGHT 0.65
#define LIMNI_PAIR_DIRECTION_ANCHOR_REVERSION_WEIGHT 0.70
#define LIMNI_PAIR_DIRECTION_STOCH_REVERSION_WEIGHT 0.30

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
   double confidence;
   double q;
   double q_pips;
   double anchor;
   double anchor_distance_q;
   double stoch;
   int trend_state;
   string reason_code;
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
   payload += "|weights=trend_0_50,reversion_0_50";
   payload += "|trend=state_0_65,momentum_0_35";
   payload += "|reversion=anchor_0_70,stoch_0_30";
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
   result.confidence = 0.0;
   result.q = 0.0;
   result.q_pips = 0.0;
   result.anchor = 0.0;
   result.anchor_distance_q = 0.0;
   result.stoch = EMPTY_VALUE;
   result.trend_state = 0;
   result.reason_code = "not_evaluated";
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
   const datetime &source_times[],
   const double &source_closes[],
   const double &source_q[],
   const double &source_line[],
   const double &source_stoch[],
   const int &source_ma_state[],
   const double pip_size,
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

   double anchor_reversion = -LimniPairDirectionClamp(anchor_distance_q / 2.0, -1.0, 1.0);
   double stoch_reversion = -LimniPairDirectionClamp((stoch - 50.0) / 50.0, -1.0, 1.0);
   double reversion_score =
      LIMNI_PAIR_DIRECTION_ANCHOR_REVERSION_WEIGHT * anchor_reversion +
      LIMNI_PAIR_DIRECTION_STOCH_REVERSION_WEIGHT * stoch_reversion;

   double raw_score =
      LIMNI_PAIR_DIRECTION_TREND_WEIGHT * trend_score +
      LIMNI_PAIR_DIRECTION_REVERSION_WEIGHT * reversion_score;

   int raw_direction = LimniPairDirectionSign(raw_score);
   if(raw_direction == LIMNI_PAIR_DIRECTION_SIDE_NONE)
      raw_direction = LimniPairDirectionFallbackDirection(previous_raw_direction, trend_state, anchor_distance_q);

   result.valid = true;
   result.formula_id = LimniPairDirectionFormulaId();
   result.formula_hash = LimniPairDirectionFormulaHash();
   result.asof_m1_time = source_times[index];
   result.raw_direction = raw_direction;
   result.raw_score = raw_score;
   result.trend_score = trend_score;
   result.reversion_score = reversion_score;
   result.confidence = LimniPairDirectionClamp(MathAbs(raw_score), 0.0, 1.0);
   result.q = q;
   result.q_pips = pip_size > 0.0 ? q / pip_size : 0.0;
   result.anchor = anchor;
   result.anchor_distance_q = anchor_distance_q;
   result.stoch = stoch;
   result.trend_state = trend_state;
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
         source_times,
         source_closes,
         source_q,
         source_line,
         source_stoch,
         source_ma_state,
         pip_size,
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
