//+------------------------------------------------------------------+
//|                                 LimniQStateCore.mqh              |
//|        Shared closed-M1 q-state v001 formula and state contract  |
//+------------------------------------------------------------------+
#ifndef LIMNI_QSTATE_CORE_MQH
#define LIMNI_QSTATE_CORE_MQH

#include "LimniLRMGStackCore.mqh"

#define LIMNI_QSTATE_SYMBOL_COUNT 28
#define LIMNI_QSTATE_CCY_COUNT 8

#define LIMNI_QSTATE_SIDE_SHORT -1
#define LIMNI_QSTATE_SIDE_NONE 0
#define LIMNI_QSTATE_SIDE_LONG 1

#define LIMNI_QSTATE_PAIR_STATE_STRONG_SHORT -2
#define LIMNI_QSTATE_PAIR_STATE_WEAK_SHORT -1
#define LIMNI_QSTATE_PAIR_STATE_NEUTRAL 0
#define LIMNI_QSTATE_PAIR_STATE_WEAK_LONG 1
#define LIMNI_QSTATE_PAIR_STATE_STRONG_LONG 2
#define LIMNI_QSTATE_PAIR_STATE_STRESS 3

#define LIMNI_QSTATE_MARKET_UNKNOWN 0
#define LIMNI_QSTATE_MARKET_TREND_UP 1
#define LIMNI_QSTATE_MARKET_TREND_DOWN -1
#define LIMNI_QSTATE_MARKET_RANGE 2
#define LIMNI_QSTATE_MARKET_TRANSITION 3
#define LIMNI_QSTATE_MARKET_STRESS 4

#define LIMNI_QSTATE_V001_FORMULA_ID "g99w-qstate-v001"
#define LIMNI_QSTATE_V001_ROLLING_WINDOW_M1 1440
#define LIMNI_QSTATE_V001_MIN_HISTORY_M1 2880
#define LIMNI_QSTATE_V001_HISTORY_M1 4320
#define LIMNI_QSTATE_V001_Z_CLIP 3.0
#define LIMNI_QSTATE_V001_SCALE_LOOKBACK_DAYS 0
#define LIMNI_QSTATE_V001_WEAK_THRESHOLD 0.25
#define LIMNI_QSTATE_V001_STRONG_THRESHOLD 1.00
#define LIMNI_QSTATE_V001_MAX_SPREAD_COST_Q 0.25
#define LIMNI_QSTATE_V001_MIN_Z_SAMPLES 64

struct LimniQStatePairFeatures
{
   bool valid;
   string symbol;
   string formula_id;
   ulong formula_hash;
   datetime source_m1_time;
   int copied_m1;
   int day_count;
   int valid_q_day_count;
   double price;
   double q;
   double anchor;
   double trend_persistence;
   double anchor_displacement;
   double event_direction_persistence;
   double range_position;
   double sweep_resolution;
   double spread_cost_q;
   double pair_q_score;
   double confidence;
   int katarakti_signal;
   int event_count;
   string reason_code;
};

struct LimniQStateDirection
{
   bool valid;
   string formula_id;
   ulong formula_hash;
   datetime source_m1_time;
   double pair_q_score;
   double base_currency_score;
   double quote_currency_score;
   double pair_direction_score;
   int state;
   int trade_direction;
   int market_mode;
   double confidence;
   string reason_code;
};

ulong LimniQStateHashString(const string value)
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

string LimniQStateFormulaId()
{
   return LIMNI_QSTATE_V001_FORMULA_ID;
}

ulong LimniQStateFormulaHash()
{
   string payload = LIMNI_QSTATE_V001_FORMULA_ID;
   payload += "|closed_m1_only";
   payload += "|rolling_window_m1=" + IntegerToString(LIMNI_QSTATE_V001_ROLLING_WINDOW_M1);
   payload += "|min_history_m1=" + IntegerToString(LIMNI_QSTATE_V001_MIN_HISTORY_M1);
   payload += "|z_clip=" + DoubleToString(LIMNI_QSTATE_V001_Z_CLIP, 2);
   payload += "|weak=" + DoubleToString(LIMNI_QSTATE_V001_WEAK_THRESHOLD, 2);
   payload += "|strong=" + DoubleToString(LIMNI_QSTATE_V001_STRONG_THRESHOLD, 2);
   payload += "|max_spread_cost_q=" + DoubleToString(LIMNI_QSTATE_V001_MAX_SPREAD_COST_Q, 2);
   payload += "|components=trend,anchor,event_direction,range,sweep,spread_cost";
   return LimniQStateHashString(payload);
}

double LimniQStateClamp(const double value, const double min_value, const double max_value)
{
   if(value < min_value)
      return min_value;
   if(value > max_value)
      return max_value;
   return value;
}

void LimniQStateResetPairFeatures(LimniQStatePairFeatures &features)
{
   features.valid = false;
   features.symbol = "";
   features.formula_id = LimniQStateFormulaId();
   features.formula_hash = LimniQStateFormulaHash();
   features.source_m1_time = 0;
   features.copied_m1 = 0;
   features.day_count = 0;
   features.valid_q_day_count = 0;
   features.price = 0.0;
   features.q = 0.0;
   features.anchor = 0.0;
   features.trend_persistence = 0.0;
   features.anchor_displacement = 0.0;
   features.event_direction_persistence = 0.0;
   features.range_position = 0.0;
   features.sweep_resolution = 0.0;
   features.spread_cost_q = 0.0;
   features.pair_q_score = 0.0;
   features.confidence = 0.0;
   features.katarakti_signal = LIMNI_KTR_SIGNAL_NONE;
   features.event_count = 0;
   features.reason_code = "";
}

void LimniQStateResetDirection(LimniQStateDirection &direction)
{
   direction.valid = false;
   direction.formula_id = LimniQStateFormulaId();
   direction.formula_hash = LimniQStateFormulaHash();
   direction.source_m1_time = 0;
   direction.pair_q_score = 0.0;
   direction.base_currency_score = 0.0;
   direction.quote_currency_score = 0.0;
   direction.pair_direction_score = 0.0;
   direction.state = LIMNI_QSTATE_PAIR_STATE_NEUTRAL;
   direction.trade_direction = LIMNI_QSTATE_SIDE_NONE;
   direction.market_mode = LIMNI_QSTATE_MARKET_UNKNOWN;
   direction.confidence = 0.0;
   direction.reason_code = "";
}

string LimniQStateCanonicalSymbol(const int symbol_id)
{
   switch(symbol_id)
   {
      case 0: return "AUDCAD";
      case 1: return "AUDCHF";
      case 2: return "AUDJPY";
      case 3: return "AUDNZD";
      case 4: return "AUDUSD";
      case 5: return "CADCHF";
      case 6: return "CADJPY";
      case 7: return "CHFJPY";
      case 8: return "EURAUD";
      case 9: return "EURCAD";
      case 10: return "EURCHF";
      case 11: return "EURGBP";
      case 12: return "EURJPY";
      case 13: return "EURNZD";
      case 14: return "EURUSD";
      case 15: return "GBPAUD";
      case 16: return "GBPCAD";
      case 17: return "GBPCHF";
      case 18: return "GBPJPY";
      case 19: return "GBPNZD";
      case 20: return "GBPUSD";
      case 21: return "NZDCAD";
      case 22: return "NZDCHF";
      case 23: return "NZDJPY";
      case 24: return "NZDUSD";
      case 25: return "USDCAD";
      case 26: return "USDCHF";
      case 27: return "USDJPY";
   }
   return "";
}

int LimniQStateCcyFromCode(const string code)
{
   if(code == "AUD") return 0;
   if(code == "CAD") return 1;
   if(code == "CHF") return 2;
   if(code == "EUR") return 3;
   if(code == "GBP") return 4;
   if(code == "JPY") return 5;
   if(code == "NZD") return 6;
   if(code == "USD") return 7;
   return -1;
}

void LimniQStateBaseQuote(const string canonical, int &base_ccy, int &quote_ccy)
{
   base_ccy = -1;
   quote_ccy = -1;
   if(StringLen(canonical) < 6)
      return;
   base_ccy = LimniQStateCcyFromCode(StringSubstr(canonical, 0, 3));
   quote_ccy = LimniQStateCcyFromCode(StringSubstr(canonical, 3, 3));
}

bool LimniQStateSymbolNameMatchesCanonical(const string symbol, const string canonical)
{
   if(StringLen(symbol) < 6)
      return false;
   return StringSubstr(symbol, 0, 6) == canonical;
}

int LimniQStateSymbolIdFromBrokerSymbol(const string symbol)
{
   for(int i = 0; i < LIMNI_QSTATE_SYMBOL_COUNT; i++)
   {
      if(LimniQStateSymbolNameMatchesCanonical(symbol, LimniQStateCanonicalSymbol(i)))
         return i;
   }
   return -1;
}

string LimniQStateResolveBrokerSymbol(const string canonical)
{
   if(SymbolInfoInteger(canonical, SYMBOL_EXIST))
      return canonical;

   int total = SymbolsTotal(false);
   for(int i = 0; i < total; i++)
   {
      string candidate = SymbolName(i, false);
      if(LimniQStateSymbolNameMatchesCanonical(candidate, canonical))
         return candidate;
   }
   return canonical;
}

double LimniQStateSweepResolutionScore(const int signal)
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

int LimniQStateLastTrigger(const int &source_trigger[], const int index)
{
   for(int i = index; i >= 0; i--)
   {
      if(source_trigger[i] != LIMNI_KTR_SIGNAL_NONE)
         return source_trigger[i];
   }
   return LIMNI_KTR_SIGNAL_NONE;
}

double LimniQStateRecentCloseDirectionPersistence(const double &source_closes[], const int index)
{
   if(index < 1)
      return 0.0;

   int start_index = MathMax(1, index - 7);
   int count = 0;
   double sum = 0.0;
   for(int i = start_index; i <= index; i++)
   {
      double delta = source_closes[i] - source_closes[i - 1];
      if(delta > 0.0)
         sum += 1.0;
      else if(delta < 0.0)
         sum -= 1.0;
      count++;
   }

   if(count <= 0)
      return 0.0;
   return LimniQStateClamp(sum / (double)count, -1.0, 1.0);
}

double LimniQStateTrendPersistence(const int &source_ma_state[], const int index)
{
   if(index < 0)
      return 0.0;

   int state = source_ma_state[index];
   if(state == 0)
      return 0.0;

   int age = 0;
   for(int i = index; i >= 0 && source_ma_state[i] == state; i--)
   {
      age++;
      if(age >= 3)
         break;
   }
   return (double)state * LimniQStateClamp((double)age / 3.0, 0.0, 1.0);
}

double LimniQStateRollingZ(const double &values[], const int index)
{
   if(index <= 0)
      return 0.0;

   int start_index = MathMax(0, index - LIMNI_QSTATE_V001_ROLLING_WINDOW_M1);
   int count = 0;
   double sum = 0.0;
   for(int i = start_index; i < index; i++)
   {
      if(!MathIsValidNumber(values[i]) || values[i] == EMPTY_VALUE)
         continue;
      sum += values[i];
      count++;
   }

   if(count < LIMNI_QSTATE_V001_MIN_Z_SAMPLES)
      return 0.0;

   double mean = sum / (double)count;
   double variance = 0.0;
   for(int i = start_index; i < index; i++)
   {
      if(!MathIsValidNumber(values[i]) || values[i] == EMPTY_VALUE)
         continue;
      double delta = values[i] - mean;
      variance += delta * delta;
   }

   double stddev = MathSqrt(variance / (double)count);
   if(stddev <= 0.000000001 || !MathIsValidNumber(stddev))
      return 0.0;

   double z = (values[index] - mean) / stddev;
   z = LimniQStateClamp(z, -LIMNI_QSTATE_V001_Z_CLIP, LIMNI_QSTATE_V001_Z_CLIP);
   return z / LIMNI_QSTATE_V001_Z_CLIP;
}

bool LimniQStateLoadClosedM1Rates(
   const string symbol,
   MqlRates &rates[],
   int &copied,
   datetime &latest_closed_m1,
   string &reason_code
)
{
   ArrayResize(rates, 0);
   copied = 0;
   latest_closed_m1 = 0;
   reason_code = "";

   if(symbol == "" || !SymbolSelect(symbol, true))
   {
      reason_code = "symbol_select_failed";
      return false;
   }

   latest_closed_m1 = iTime(symbol, PERIOD_M1, 1);
   if(latest_closed_m1 <= 0)
   {
      reason_code = "latest_closed_m1_missing";
      return false;
   }

   MqlRates raw[];
   ArraySetAsSeries(raw, true);
   int needed = LIMNI_QSTATE_V001_HISTORY_M1 + 10;
   ResetLastError();
   copied = CopyRates(symbol, PERIOD_M1, 1, needed, raw);
   if(copied < LIMNI_QSTATE_V001_MIN_HISTORY_M1)
   {
      reason_code = "insufficient_closed_m1_history";
      return false;
   }

   ArrayResize(rates, copied);
   for(int i = 0; i < copied; i++)
      rates[i] = raw[copied - 1 - i];

   if(rates[copied - 1].time != latest_closed_m1)
      latest_closed_m1 = rates[copied - 1].time;

   return true;
}

bool LimniQStateBuildPairFeatures(const string symbol, LimniQStatePairFeatures &features)
{
   LimniQStateResetPairFeatures(features);
   features.symbol = symbol;

   MqlRates rates[];
   int copied = 0;
   datetime latest_closed_m1 = 0;
   string load_reason = "";
   if(!LimniQStateLoadClosedM1Rates(symbol, rates, copied, latest_closed_m1, load_reason))
   {
      features.reason_code = load_reason;
      return false;
   }

   datetime source_times[];
   double source_closes[];
   double source_q[];
   double source_line[];
   double source_stoch[];
   double source_ma[];
   int source_ma_state[];
   int source_trigger[];
   int source_trigger_sweep_side[];
   int source_trigger_resolution[];
   int source_trigger_anchor_relation[];
   int source_trigger_trend_relation[];
   int source_trigger_setup_age[];
   double source_trigger_q_distance[];
   int day_count = 0;
   int valid_q_day_count = 0;

   double point = SymbolInfoDouble(symbol, SYMBOL_POINT);
   if(point <= 0.0)
      point = _Point;

   if(!LimniBuildStackSeries(
      rates,
      copied,
      LIMNI_QSTATE_V001_SCALE_LOOKBACK_DAYS,
      point,
      source_times,
      source_closes,
      source_q,
      source_line,
      source_stoch,
      source_ma,
      source_ma_state,
      source_trigger,
      source_trigger_sweep_side,
      source_trigger_resolution,
      source_trigger_anchor_relation,
      source_trigger_trend_relation,
      source_trigger_setup_age,
      source_trigger_q_distance,
      day_count,
      valid_q_day_count
   ))
   {
      features.reason_code = "stack_build_failed";
      return false;
   }

   int source_count = ArraySize(source_times);
   int index = -1;
   for(int i = source_count - 1; i >= 0; i--)
   {
      if(source_q[i] > 0.0 && source_line[i] != EMPTY_VALUE)
      {
         index = i;
         break;
      }
   }

   if(index < 0)
   {
      features.reason_code = "qstate_pair_features_not_ready";
      return false;
   }

   double trend_raw[];
   double anchor_raw[];
   double event_raw[];
   double range_raw[];
   double sweep_raw[];
   ArrayResize(trend_raw, source_count);
   ArrayResize(anchor_raw, source_count);
   ArrayResize(event_raw, source_count);
   ArrayResize(range_raw, source_count);
   ArrayResize(sweep_raw, source_count);

   int trigger_count = 0;
   int last_trigger = LIMNI_KTR_SIGNAL_NONE;
   int last_trigger_at_index = LIMNI_KTR_SIGNAL_NONE;
   for(int i = 0; i < source_count; i++)
   {
      double q = source_q[i];
      trend_raw[i] = LimniQStateTrendPersistence(source_ma_state, i);
      anchor_raw[i] = (q > 0.0 && source_line[i] != EMPTY_VALUE) ?
         LimniQStateClamp((source_closes[i] - source_line[i]) / q, -1.0, 1.0) : 0.0;
      event_raw[i] = LimniQStateRecentCloseDirectionPersistence(source_closes, i);
      range_raw[i] = source_stoch[i] == EMPTY_VALUE ? 0.0 :
         LimniQStateClamp((source_stoch[i] - 50.0) / 50.0, -1.0, 1.0);
      if(source_trigger[i] != LIMNI_KTR_SIGNAL_NONE)
      {
         last_trigger = source_trigger[i];
         trigger_count++;
      }
      sweep_raw[i] = LimniQStateSweepResolutionScore(last_trigger);
      if(i == index)
         last_trigger_at_index = last_trigger;
   }

   double q = source_q[index];
   double spread_points = (double)SymbolInfoInteger(symbol, SYMBOL_SPREAD);
   double spread_cost_q = q > 0.0 ? (spread_points * point) / q : 0.0;

   double trend_persistence = LimniQStateRollingZ(trend_raw, index);
   double anchor_displacement = LimniQStateRollingZ(anchor_raw, index);
   double event_direction_persistence = LimniQStateRollingZ(event_raw, index);
   double range_position = LimniQStateRollingZ(range_raw, index);
   double sweep_resolution = LimniQStateRollingZ(sweep_raw, index);
   double raw_score = trend_persistence +
      anchor_displacement +
      event_direction_persistence +
      range_position +
      sweep_resolution;

   double pair_score = raw_score;
   if(pair_score > 0.0)
      pair_score = MathMax(0.0, pair_score - spread_cost_q);
   else if(pair_score < 0.0)
      pair_score = MathMin(0.0, pair_score + spread_cost_q);

   if(!MathIsValidNumber(pair_score))
   {
      features.reason_code = "pair_score_invalid";
      return false;
   }

   features.valid = true;
   features.source_m1_time = source_times[index];
   features.copied_m1 = copied;
   features.day_count = day_count;
   features.valid_q_day_count = valid_q_day_count;
   features.price = source_closes[index];
   features.q = q;
   features.anchor = source_line[index];
   features.trend_persistence = trend_persistence;
   features.anchor_displacement = anchor_displacement;
   features.event_direction_persistence = event_direction_persistence;
   features.range_position = range_position;
   features.sweep_resolution = sweep_resolution;
   features.spread_cost_q = spread_cost_q;
   features.pair_q_score = pair_score;
   features.confidence = LimniQStateClamp(MathAbs(pair_score) / LIMNI_QSTATE_V001_STRONG_THRESHOLD, 0.0, 1.0);
   features.katarakti_signal = last_trigger_at_index;
   features.event_count = trigger_count;
   features.reason_code = "qstate_pair_features_ready";
   return true;
}

int LimniQStatePairStateFromScore(const double score, const double spread_cost_q)
{
   if(spread_cost_q > LIMNI_QSTATE_V001_MAX_SPREAD_COST_Q)
      return LIMNI_QSTATE_PAIR_STATE_STRESS;
   if(score >= LIMNI_QSTATE_V001_STRONG_THRESHOLD)
      return LIMNI_QSTATE_PAIR_STATE_STRONG_LONG;
   if(score >= LIMNI_QSTATE_V001_WEAK_THRESHOLD)
      return LIMNI_QSTATE_PAIR_STATE_WEAK_LONG;
   if(score <= -LIMNI_QSTATE_V001_STRONG_THRESHOLD)
      return LIMNI_QSTATE_PAIR_STATE_STRONG_SHORT;
   if(score <= -LIMNI_QSTATE_V001_WEAK_THRESHOLD)
      return LIMNI_QSTATE_PAIR_STATE_WEAK_SHORT;
   return LIMNI_QSTATE_PAIR_STATE_NEUTRAL;
}

int LimniQStateMarketModeFromState(const int state, const double local_pair_score)
{
   if(state == LIMNI_QSTATE_PAIR_STATE_STRESS)
      return LIMNI_QSTATE_MARKET_STRESS;
   if(state == LIMNI_QSTATE_PAIR_STATE_STRONG_LONG || state == LIMNI_QSTATE_PAIR_STATE_WEAK_LONG)
      return LIMNI_QSTATE_MARKET_TREND_UP;
   if(state == LIMNI_QSTATE_PAIR_STATE_STRONG_SHORT || state == LIMNI_QSTATE_PAIR_STATE_WEAK_SHORT)
      return LIMNI_QSTATE_MARKET_TREND_DOWN;
   if(MathAbs(local_pair_score) < LIMNI_QSTATE_V001_WEAK_THRESHOLD)
      return LIMNI_QSTATE_MARKET_RANGE;
   return LIMNI_QSTATE_MARKET_TRANSITION;
}

int LimniQStateTradeDirectionFromState(const int state)
{
   if(state == LIMNI_QSTATE_PAIR_STATE_STRONG_LONG)
      return LIMNI_QSTATE_SIDE_LONG;
   if(state == LIMNI_QSTATE_PAIR_STATE_STRONG_SHORT)
      return LIMNI_QSTATE_SIDE_SHORT;
   return LIMNI_QSTATE_SIDE_NONE;
}

string LimniQStateReasonFromState(const int state)
{
   if(state == LIMNI_QSTATE_PAIR_STATE_STRESS)
      return "stress_no_new_risk";
   if(state == LIMNI_QSTATE_PAIR_STATE_STRONG_LONG)
      return "strong_long";
   if(state == LIMNI_QSTATE_PAIR_STATE_STRONG_SHORT)
      return "strong_short";
   if(state == LIMNI_QSTATE_PAIR_STATE_WEAK_LONG)
      return "weak_long_hold_only";
   if(state == LIMNI_QSTATE_PAIR_STATE_WEAK_SHORT)
      return "weak_short_hold_only";
   return "neutral_no_trade";
}

void LimniQStateFinalizeDirection(
   const LimniQStatePairFeatures &features,
   const double base_currency_score,
   const double quote_currency_score,
   LimniQStateDirection &direction
)
{
   LimniQStateResetDirection(direction);
   direction.valid = features.valid;
   direction.formula_id = features.formula_id;
   direction.formula_hash = features.formula_hash;
   direction.source_m1_time = features.source_m1_time;
   direction.pair_q_score = features.pair_q_score;
   direction.base_currency_score = base_currency_score;
   direction.quote_currency_score = quote_currency_score;
   direction.pair_direction_score = base_currency_score - quote_currency_score;
   direction.state = LimniQStatePairStateFromScore(direction.pair_direction_score, features.spread_cost_q);
   direction.trade_direction = LimniQStateTradeDirectionFromState(direction.state);
   direction.market_mode = LimniQStateMarketModeFromState(direction.state, features.pair_q_score);
   direction.confidence = LimniQStateClamp(MathAbs(direction.pair_direction_score) / LIMNI_QSTATE_V001_STRONG_THRESHOLD, 0.0, 1.0);
   direction.reason_code = LimniQStateReasonFromState(direction.state);
}

string LimniQStateDirectionLabel(const int trade_direction)
{
   if(trade_direction == LIMNI_QSTATE_SIDE_LONG)
      return "LONG";
   if(trade_direction == LIMNI_QSTATE_SIDE_SHORT)
      return "SHORT";
   return "NO TRADE";
}

#endif // LIMNI_QSTATE_CORE_MQH
