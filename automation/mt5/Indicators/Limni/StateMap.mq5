//+------------------------------------------------------------------+
//|                                             StateMap.mq5         |
//|                   Limni pair-state visual viewer                 |
//+------------------------------------------------------------------+
#property copyright "LIMNI LTD"
#property version   "1.64"
#property indicator_chart_window
#property indicator_buffers 3
#property indicator_plots 2

#property indicator_label1 "Price Anchor"
#property indicator_type1 DRAW_LINE
#property indicator_color1 clrLimeGreen
#property indicator_style1 STYLE_SOLID
#property indicator_width1 2

#property indicator_label2 "State Anchor"
#property indicator_type2 DRAW_COLOR_LINE
#property indicator_color2 clrLimeGreen,clrTomato,clrSilver
#property indicator_style2 STYLE_SOLID
#property indicator_width2 3

//====================================================================
// 1. Indicator properties and inputs
//====================================================================

input bool ShowCenterLine = true;
input int VisualMaxM1Bars = 50000;

const int STATE_MAP_PANEL_WIDTH = 460;
const int STATE_MAP_PANEL_HEIGHT = 370;
const int STATE_MAP_PANEL_MINIMIZED_HEIGHT = 68;
const int STATE_MAP_PANEL_RIGHT = 18;
const int STATE_MAP_PANEL_TOP = 22;
const int STATE_MAP_PANEL_PAD = 12;
const int STATE_MAP_HEADER_HEIGHT = 68;
const int STATE_MAP_BLOCK_GAP = 10;
const int STATE_MAP_BLOCK_WIDTH = 213;
const int STATE_MAP_BLOCK_HEIGHT = 62;

const color STATE_MAP_PANEL_BG = C'24,28,38';
const color STATE_MAP_PANEL_BORDER = C'49,63,82';
const color STATE_MAP_TITLE_COLOR = C'151,164,181';
const color STATE_MAP_TEXT_COLOR = C'231,236,243';
const color STATE_MAP_MUTED_COLOR = C'139,152,170';
const color STATE_MAP_LONG_COLOR = C'0,185,108';
const color STATE_MAP_SHORT_COLOR = C'238,72,94';
const color STATE_MAP_NEUTRAL_COLOR = C'83,96,115';
const color STATE_MAP_STRESS_COLOR = C'214,143,51';
const color STATE_MAP_STOCH_LINE = C'33,190,238';
const color STATE_MAP_BLOCK_BG = C'31,37,49';
const color STATE_MAP_BLOCK_BORDER = C'61,74,94';
const color STATE_MAP_BADGE_TEXT_COLOR = clrWhite;

const string STATE_MAP_OBJECT_PREFIX = "Limni_StateMap_";
const string STATE_MAP_PANEL_PREFIX = "Limni_StateMap_Panel_";
const string STATE_MAP_PANEL_DATA_PREFIX = "Limni_StateMap_Panel_Data_";

double PriceAnchorBuffer[];
double StateAnchorBuffer[];
double StateColorBuffer[];

//====================================================================
// 2. Formula constants and small structs
//====================================================================

const int STATE_MAP_SCALE_LOOKBACK_DAYS = 0;
const int STATE_MAP_EVENT_WINDOW = 55;
const int STATE_MAP_MIN_DAY_BARS = 10;
const int STATE_MAP_MAX_BRICKS_PER_BAR = 200;
const double STATE_MAP_TREND_CONFIRM_Q = 1.0;

const int STATE_MAP_SIDE_SHORT = -1;
const int STATE_MAP_SIDE_NONE = 0;
const int STATE_MAP_SIDE_LONG = 1;
const int STATE_MAP_EXTREME_NONE = 0;
const int STATE_MAP_EXTREME_UPPER = 1;
const int STATE_MAP_EXTREME_LOWER = -1;
const int STATE_MAP_DIRECTION_CONFIRM_EVENTS = 5;
const double STATE_MAP_DIRECTION_MIN_FLIP_SCORE = 0.25;
const double STATE_MAP_DIRECTION_TREND_WEIGHT = 0.60;
const double STATE_MAP_DIRECTION_EXHAUSTION_WEIGHT = 0.90;
const double STATE_MAP_DIRECTION_MOMENTUM_WEIGHT = 0.35;
const double STATE_MAP_DIRECTION_TREND_STATE_WEIGHT = 0.65;
const double STATE_MAP_DIRECTION_EXTREME_STOCH_UPPER = 95.0;
const double STATE_MAP_DIRECTION_EXTREME_STOCH_LOWER = 5.0;
const double STATE_MAP_DIRECTION_RECLAIM_STOCH_UPPER = 90.0;
const double STATE_MAP_DIRECTION_RECLAIM_STOCH_LOWER = 10.0;
const double STATE_MAP_DIRECTION_EXTREME_MIN_DISTANCE_Q = 1.0;
const double STATE_MAP_DIRECTION_FAILED_EXTENSION_Q = 0.25;
const double STATE_MAP_DIRECTION_MOMENTUM_DECAY_Q = 0.25;
const int STATE_MAP_DIRECTION_EXHAUSTION_MIN_FAILURES = 2;
const double STATE_MAP_DIRECTION_EXTREME_RESET_DISTANCE_Q = 0.20;
const int STATE_MAP_DIRECTION_EXTREME_MAX_AGE_EVENTS = 55;

struct StateMapDay
{
   int start_index;
   int end_index;
   int bar_count;
   bool complete;
   bool valid_q;
   double q_day;
   double q_effective;
};

struct StateMapDirectionTracker
{
   int extreme_state;
   int extreme_age_events;
   double max_extension_q;
   double previous_momentum_q;
   bool failed_extension;
   bool stoch_reclaim;
   bool event_momentum_decay;
};

struct StateMapDirectionResult
{
   bool valid;
   int raw_direction;
   int confirmed_direction;
   int pending_direction;
   int pending_count;
   double raw_score;
   string reason_code;
};

bool g_cache_ready = false;
datetime g_cache_latest_closed_m1 = 0;
int g_cache_visual_max_m1_bars = -1;
double g_cache_point = 0.0;
datetime g_projected_chart_oldest = 0;
datetime g_projected_chart_newest = 0;

datetime g_source_times[];
double g_source_closes[];
double g_source_q[];
double g_source_anchor[];
double g_source_stoch[];
int g_source_trend[];
int g_source_trigger[];
int g_source_count = 0;
int g_valid_q_day_count = 0;

StateMapDirectionResult g_direction;
string g_data_status = "waiting_for_m1";
string g_data_detail = "chart-symbol M1 stack";
string g_last_logged_failure = "";

string g_panel_signature = "";
bool g_panel_minimized = false;
double g_panel_latest_anchor = EMPTY_VALUE;
int g_panel_latest_trend = 0;
double g_panel_latest_stoch = EMPTY_VALUE;
double g_panel_latest_q = EMPTY_VALUE;
int g_panel_latest_bars = 0;
int g_panel_latest_q_days = 0;
StateMapDirectionResult g_panel_latest_direction;

//====================================================================
// 3. Movement geometry and daily-Q calculation
//====================================================================

int StateMapDayKey(const datetime value)
{
   MqlDateTime parts;
   TimeToStruct(value, parts);
   return parts.year * 10000 + parts.mon * 100 + parts.day;
}

double StateMapMedian(double &values[], const int count)
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

double StateMapPathMovement(const double &prices[], const int start_index, const int end_index)
{
   double movement = 0.0;
   for(int i = start_index + 1; i <= end_index; i++)
      movement += MathAbs(prices[i] - prices[i - 1]);
   return movement;
}

double StateMapPathBelowPrice(
   const double &prices[],
   const int start_index,
   const int end_index,
   const double probe
)
{
   double below = 0.0;
   for(int i = start_index + 1; i <= end_index; i++)
   {
      double lo = MathMin(prices[i - 1], prices[i]);
      double hi = MathMax(prices[i - 1], prices[i]);
      double span = hi - lo;
      if(span <= 0.0)
         continue;
      if(probe >= hi)
         below += span;
      else if(probe > lo)
         below += probe - lo;
   }
   return below;
}

bool StateMapPathBounds(
   const double &prices[],
   const int start_index,
   const int end_index,
   double &minimum,
   double &maximum
)
{
   if(end_index < start_index)
      return false;

   minimum = prices[start_index];
   maximum = prices[start_index];
   for(int i = start_index + 1; i <= end_index; i++)
   {
      if(prices[i] < minimum)
         minimum = prices[i];
      if(prices[i] > maximum)
         maximum = prices[i];
   }
   return maximum > minimum;
}

double StateMapMovementMedian(
   const double &prices[],
   const int start_index,
   const int end_index,
   const double movement
)
{
   double lo = 0.0;
   double hi = 0.0;
   if(!StateMapPathBounds(prices, start_index, end_index, lo, hi))
      return prices[start_index];

   double half = movement / 2.0;
   for(int iteration = 0; iteration < 64; iteration++)
   {
      double mid = (lo + hi) / 2.0;
      if(StateMapPathBelowPrice(prices, start_index, end_index, mid) >= half)
         hi = mid;
      else
         lo = mid;
   }
   return (lo + hi) / 2.0;
}

double StateMapMovementRadius(
   const double &prices[],
   const int start_index,
   const int end_index,
   const double center,
   const double movement
)
{
   if(movement <= 0.0 || end_index <= start_index)
      return 0.0;

   double integral = 0.0;
   for(int i = start_index + 1; i <= end_index; i++)
   {
      double lo = MathMin(prices[i - 1], prices[i]);
      double hi = MathMax(prices[i - 1], prices[i]);
      if(hi <= lo)
         continue;

      double upper = hi - center;
      double lower = lo - center;
      integral += (upper * upper * upper - lower * lower * lower) / 3.0;
   }

   if(integral <= 0.0)
      return 0.0;
   return MathSqrt(integral / movement);
}

double StateMapDailyQ(
   const double &prices[],
   const int start_index,
   const int end_index
)
{
   if(start_index < 0 || end_index <= start_index)
      return 0.0;

   double movement = StateMapPathMovement(prices, start_index, end_index);
   if(movement <= 0.0)
      return 0.0;

   double center = StateMapMovementMedian(prices, start_index, end_index, movement);
   double radius = StateMapMovementRadius(prices, start_index, end_index, center, movement);
   if(radius <= 0.0 || !MathIsValidNumber(radius))
      return 0.0;
   return radius;
}

int StateMapBuildDays(const MqlRates &rates[], const int source_count, StateMapDay &days[])
{
   ArrayResize(days, 0);
   if(source_count <= 0)
      return 0;

   ArrayResize(days, source_count);
   int day_count = 0;
   int active_key = StateMapDayKey(rates[0].time);
   int start_index = 0;

   for(int i = 1; i < source_count; i++)
   {
      int key = StateMapDayKey(rates[i].time);
      if(key == active_key)
         continue;

      days[day_count].start_index = start_index;
      days[day_count].end_index = i - 1;
      days[day_count].bar_count = i - start_index;
      day_count++;
      active_key = key;
      start_index = i;
   }

   days[day_count].start_index = start_index;
   days[day_count].end_index = source_count - 1;
   days[day_count].bar_count = source_count - start_index;
   day_count++;

   ArrayResize(days, day_count);
   return day_count;
}

double StateMapEffectiveQForDay(
   const StateMapDay &days[],
   const int day_index,
   const int scale_lookback_days
)
{
   int sample_limit = scale_lookback_days <= 0 ? day_index : MathMin(day_index, scale_lookback_days);
   double samples[];
   ArrayResize(samples, sample_limit);
   int sample_count = 0;

   for(int i = day_index - 1; i >= 0 && sample_count < sample_limit; i--)
   {
      if(!days[i].valid_q || days[i].q_day <= 0.0)
         continue;
      samples[sample_count] = days[i].q_day;
      sample_count++;
   }

   return StateMapMedian(samples, sample_count);
}

int StateMapCalculateDailyQ(
   StateMapDay &days[],
   const int day_count,
   const double &closes[]
)
{
   int valid_count = 0;
   for(int d = 0; d < day_count; d++)
   {
      days[d].complete = (d < day_count - 1);
      days[d].valid_q = false;
      days[d].q_day = 0.0;
      days[d].q_effective = 0.0;

      if(!days[d].complete || days[d].bar_count < STATE_MAP_MIN_DAY_BARS)
         continue;

      days[d].q_day = StateMapDailyQ(closes, days[d].start_index, days[d].end_index);
      days[d].valid_q = days[d].q_day > 0.0;
      if(days[d].valid_q)
         valid_count++;
   }

   for(int d = 0; d < day_count; d++)
      days[d].q_effective = StateMapEffectiveQForDay(days, d, STATE_MAP_SCALE_LOOKBACK_DAYS);

   return valid_count;
}

//====================================================================
// 4. LRMG event, anchor, trend and stochastic calculation
//====================================================================

void StateMapAppendEvent(double &events[], int &count, int &capacity, const double price)
{
   if(count >= capacity)
   {
      capacity = capacity <= 0 ? 256 : capacity * 2;
      ArrayResize(events, capacity);
   }
   events[count] = price;
   count++;
}

double StateMapRecentEventMedian(const double &events[], const int count)
{
   if(count <= 0)
      return 0.0;

   int start_index = MathMax(0, count - STATE_MAP_EVENT_WINDOW);
   int sample_count = count - start_index;
   double samples[];
   ArrayResize(samples, sample_count);
   for(int i = 0; i < sample_count; i++)
      samples[i] = events[start_index + i];
   return StateMapMedian(samples, sample_count);
}

void StateMapRecentEventRange(
   const double &events[],
   const int count,
   double &lo,
   double &hi
)
{
   lo = 0.0;
   hi = 0.0;
   if(count <= 0)
      return;

   int start_index = MathMax(0, count - STATE_MAP_EVENT_WINDOW);
   lo = events[start_index];
   hi = events[start_index];
   for(int i = start_index + 1; i < count; i++)
   {
      if(events[i] < lo)
         lo = events[i];
      if(events[i] > hi)
         hi = events[i];
   }
}

double StateMapBoundedStochastic(const double price, const double lo, const double hi)
{
   double span = hi - lo;
   if(span <= 0.0)
      return EMPTY_VALUE;

   double value = 100.0 * (price - lo) / span;
   if(value < 0.0)
      return 0.0;
   if(value > 100.0)
      return 100.0;
   return value;
}

int StateMapTrendState(
   const double event_price,
   const double anchor,
   const double q,
   const int previous_state
)
{
   if(anchor == EMPTY_VALUE || q <= 0.0)
      return previous_state;

   double distance_q = (event_price - anchor) / q;
   if(distance_q >= STATE_MAP_TREND_CONFIRM_Q)
      return 1;
   if(distance_q <= -STATE_MAP_TREND_CONFIRM_Q)
      return -1;
   return previous_state;
}

bool StateMapBuildFormula(
   const MqlRates &rates[],
   const int source_count,
   datetime &times[],
   double &closes[],
   double &q_series[],
   double &anchor_series[],
   double &stoch_series[],
   int &trend_series[],
   int &trigger_series[],
   int &valid_q_day_count
)
{
   ArrayResize(times, 0);
   ArrayResize(closes, 0);
   ArrayResize(q_series, 0);
   ArrayResize(anchor_series, 0);
   ArrayResize(stoch_series, 0);
   ArrayResize(trend_series, 0);
   ArrayResize(trigger_series, 0);
   valid_q_day_count = 0;

   if(source_count < 100)
      return false;

   ArrayResize(times, source_count);
   ArrayResize(closes, source_count);
   for(int i = 0; i < source_count; i++)
   {
      times[i] = rates[i].time;
      closes[i] = rates[i].close;
   }

   StateMapDay days[];
   int day_count = StateMapBuildDays(rates, source_count, days);
   if(day_count <= 1)
      return false;

   valid_q_day_count = StateMapCalculateDailyQ(days, day_count, closes);

   ArrayResize(q_series, source_count);
   ArrayResize(anchor_series, source_count);
   ArrayResize(stoch_series, source_count);
   ArrayResize(trend_series, source_count);
   ArrayResize(trigger_series, source_count);
   for(int i = 0; i < source_count; i++)
   {
      q_series[i] = 0.0;
      anchor_series[i] = EMPTY_VALUE;
      stoch_series[i] = EMPTY_VALUE;
      trend_series[i] = 0;
      trigger_series[i] = 0;
   }

   bool has_confirmed_event = false;
   double base_price = 0.0;
   double last_event_price = 0.0;
   int current_level = 0;
   double events[];
   int event_count = 0;
   int event_capacity = 0;
   int trend_state = 0;
   double cached_anchor = EMPTY_VALUE;
   double cached_lo = 0.0;
   double cached_hi = 0.0;

   for(int d = 0; d < day_count; d++)
   {
      double q = days[d].q_effective;
      if(q <= 0.0)
         continue;

      base_price = has_confirmed_event ? last_event_price : rates[days[d].start_index].close;
      current_level = 0;

      for(int i = days[d].start_index; i <= days[d].end_index; i++)
      {
         int first_new_event = event_count;
         int bar_trigger = 0;
         int guard = 0;

         while(rates[i].close >= base_price + ((double)current_level + 1.0) * q &&
               guard < STATE_MAP_MAX_BRICKS_PER_BAR)
         {
            current_level++;
            last_event_price = base_price + (double)current_level * q;
            StateMapAppendEvent(events, event_count, event_capacity, last_event_price);
            has_confirmed_event = true;
            bar_trigger = 1;
            guard++;
         }

         guard = 0;
         while(rates[i].close <= base_price + ((double)current_level - 1.0) * q &&
               guard < STATE_MAP_MAX_BRICKS_PER_BAR)
         {
            current_level--;
            last_event_price = base_price + (double)current_level * q;
            StateMapAppendEvent(events, event_count, event_capacity, last_event_price);
            has_confirmed_event = true;
            bar_trigger = -1;
            guard++;
         }

         q_series[i] = q;
         trigger_series[i] = bar_trigger;

         if(event_count > first_new_event)
         {
            for(int event_index = first_new_event; event_index < event_count; event_index++)
            {
               double event_anchor = StateMapRecentEventMedian(events, event_index + 1);
               trend_state = StateMapTrendState(events[event_index], event_anchor, q, trend_state);
            }
            cached_anchor = StateMapRecentEventMedian(events, event_count);
            StateMapRecentEventRange(events, event_count, cached_lo, cached_hi);
         }

         if(event_count > 0)
         {
            anchor_series[i] = cached_anchor;
            trend_series[i] = trend_state;
            stoch_series[i] = StateMapBoundedStochastic(rates[i].close, cached_lo, cached_hi);
         }
         else
         {
            anchor_series[i] = base_price;
         }
      }
   }

   return true;
}

//====================================================================
// 5. Pair-direction calculation
//====================================================================

void StateMapResetDirection(StateMapDirectionResult &result)
{
   result.valid = false;
   result.raw_direction = STATE_MAP_SIDE_NONE;
   result.confirmed_direction = STATE_MAP_SIDE_NONE;
   result.pending_direction = STATE_MAP_SIDE_NONE;
   result.pending_count = 0;
   result.raw_score = 0.0;
   result.reason_code = "not_evaluated";
}

void StateMapResetDirectionTracker(StateMapDirectionTracker &tracker)
{
   tracker.extreme_state = STATE_MAP_EXTREME_NONE;
   tracker.extreme_age_events = 0;
   tracker.max_extension_q = 0.0;
   tracker.previous_momentum_q = 0.0;
   tracker.failed_extension = false;
   tracker.stoch_reclaim = false;
   tracker.event_momentum_decay = false;
}

double StateMapClamp(const double value, const double minimum, const double maximum)
{
   if(value < minimum)
      return minimum;
   if(value > maximum)
      return maximum;
   return value;
}

int StateMapSign(const double value)
{
   if(value > 0.0)
      return STATE_MAP_SIDE_LONG;
   if(value < 0.0)
      return STATE_MAP_SIDE_SHORT;
   return STATE_MAP_SIDE_NONE;
}

bool StateMapValidNumber(const double value)
{
   return value != EMPTY_VALUE && MathIsValidNumber(value);
}

bool StateMapValidDirectionSample(const int index)
{
   int count = ArraySize(g_source_times);
   if(index < 0 || index >= count)
      return false;
   if(ArraySize(g_source_closes) <= index ||
      ArraySize(g_source_q) <= index ||
      ArraySize(g_source_anchor) <= index ||
      ArraySize(g_source_stoch) <= index)
   {
      return false;
   }
   if(g_source_times[index] <= 0 || !StateMapValidNumber(g_source_closes[index]))
      return false;
   if(g_source_q[index] <= 0.0 || !MathIsValidNumber(g_source_q[index]))
      return false;
   if(!StateMapValidNumber(g_source_anchor[index]) || !StateMapValidNumber(g_source_stoch[index]))
      return false;
   return true;
}

int StateMapFallbackDirection(
   const int previous_direction,
   const int trend_state,
   const double anchor_distance_q
)
{
   if(previous_direction != STATE_MAP_SIDE_NONE)
      return previous_direction;
   if(trend_state > 0)
      return STATE_MAP_SIDE_LONG;
   if(trend_state < 0)
      return STATE_MAP_SIDE_SHORT;
   if(anchor_distance_q > 0.0)
      return STATE_MAP_SIDE_LONG;
   return STATE_MAP_SIDE_SHORT;
}

int StateMapSampleExtreme(const double anchor_distance_q, const double stoch)
{
   if(anchor_distance_q >= STATE_MAP_DIRECTION_EXTREME_MIN_DISTANCE_Q &&
      stoch >= STATE_MAP_DIRECTION_EXTREME_STOCH_UPPER)
   {
      return STATE_MAP_EXTREME_UPPER;
   }
   if(anchor_distance_q <= -STATE_MAP_DIRECTION_EXTREME_MIN_DISTANCE_Q &&
      stoch <= STATE_MAP_DIRECTION_EXTREME_STOCH_LOWER)
   {
      return STATE_MAP_EXTREME_LOWER;
   }
   return STATE_MAP_EXTREME_NONE;
}

void StateMapStartExtreme(
   StateMapDirectionTracker &tracker,
   const int extreme_state,
   const double extension_q,
   const double momentum_q
)
{
   StateMapResetDirectionTracker(tracker);
   tracker.extreme_state = extreme_state;
   tracker.extreme_age_events = 1;
   tracker.max_extension_q = extension_q;
   tracker.previous_momentum_q = momentum_q;
}

void StateMapUpdateExtreme(
   const double anchor_distance_q,
   const double stoch,
   const double momentum_q,
   StateMapDirectionTracker &tracker
)
{
   int sample_extreme = StateMapSampleExtreme(anchor_distance_q, stoch);
   if(sample_extreme != STATE_MAP_EXTREME_NONE && sample_extreme != tracker.extreme_state)
   {
      StateMapStartExtreme(tracker, sample_extreme, anchor_distance_q, momentum_q);
      return;
   }

   if(tracker.extreme_state == STATE_MAP_EXTREME_NONE)
      return;

   tracker.extreme_age_events++;
   if(MathAbs(anchor_distance_q) <= STATE_MAP_DIRECTION_EXTREME_RESET_DISTANCE_Q ||
      tracker.extreme_age_events > STATE_MAP_DIRECTION_EXTREME_MAX_AGE_EVENTS)
   {
      StateMapResetDirectionTracker(tracker);
      return;
   }

   if(tracker.extreme_state == STATE_MAP_EXTREME_UPPER)
   {
      if(anchor_distance_q > tracker.max_extension_q)
         tracker.max_extension_q = anchor_distance_q;
      if(anchor_distance_q <= tracker.max_extension_q - STATE_MAP_DIRECTION_FAILED_EXTENSION_Q)
         tracker.failed_extension = true;
      if(stoch <= STATE_MAP_DIRECTION_RECLAIM_STOCH_UPPER)
         tracker.stoch_reclaim = true;
      if(tracker.previous_momentum_q > 0.0 &&
         (momentum_q <= 0.0 ||
          tracker.previous_momentum_q - momentum_q >= STATE_MAP_DIRECTION_MOMENTUM_DECAY_Q))
      {
         tracker.event_momentum_decay = true;
      }
   }
   else if(tracker.extreme_state == STATE_MAP_EXTREME_LOWER)
   {
      if(anchor_distance_q < tracker.max_extension_q)
         tracker.max_extension_q = anchor_distance_q;
      if(anchor_distance_q >= tracker.max_extension_q + STATE_MAP_DIRECTION_FAILED_EXTENSION_Q)
         tracker.failed_extension = true;
      if(stoch >= STATE_MAP_DIRECTION_RECLAIM_STOCH_LOWER)
         tracker.stoch_reclaim = true;
      if(tracker.previous_momentum_q < 0.0 &&
         (momentum_q >= 0.0 ||
          momentum_q - tracker.previous_momentum_q >= STATE_MAP_DIRECTION_MOMENTUM_DECAY_Q))
      {
         tracker.event_momentum_decay = true;
      }
   }

   tracker.previous_momentum_q = momentum_q;
}

double StateMapExhaustionScore(const StateMapDirectionTracker &tracker)
{
   if(tracker.extreme_state == STATE_MAP_EXTREME_NONE)
      return 0.0;

   int failures = 0;
   if(tracker.failed_extension)
      failures++;
   if(tracker.stoch_reclaim)
      failures++;
   if(tracker.event_momentum_decay)
      failures++;
   if(failures < STATE_MAP_DIRECTION_EXHAUSTION_MIN_FAILURES)
      return 0.0;

   double distance_strength = StateMapClamp(MathAbs(tracker.max_extension_q) / 2.0, 0.0, 1.0);
   double failure_strength = StateMapClamp((double)failures / 3.0, 0.0, 1.0);
   double strength = StateMapClamp(0.70 * failure_strength + 0.30 * distance_strength, 0.0, 1.0);

   if(tracker.extreme_state == STATE_MAP_EXTREME_UPPER)
      return -strength;
   if(tracker.extreme_state == STATE_MAP_EXTREME_LOWER)
      return strength;
   return 0.0;
}

bool StateMapDirectionDecisionSample(
   const int index,
   const int latest_index,
   const int last_decision_index
)
{
   if(last_decision_index < 0 || index == latest_index)
      return true;
   if(g_source_trend[index] != g_source_trend[last_decision_index])
      return true;
   if(g_source_trigger[index] != 0)
      return true;

   double q = g_source_q[index] > 0.0 ? g_source_q[index] : g_source_q[last_decision_index];
   if(q > 0.0 && MathAbs(g_source_anchor[index] - g_source_anchor[last_decision_index]) >= q * 0.05)
      return true;
   if(q > 0.0 && MathAbs(g_source_closes[index] - g_source_closes[last_decision_index]) >= q)
      return true;
   return false;
}

bool StateMapEvaluateDirectionSample(
   const int index,
   const int momentum_reference_index,
   const int previous_raw_direction,
   const bool update_extreme,
   StateMapDirectionTracker &tracker,
   StateMapDirectionResult &result
)
{
   if(!StateMapValidDirectionSample(index))
   {
      StateMapResetDirection(result);
      result.reason_code = "invalid_sample";
      return false;
   }

   double q = g_source_q[index];
   double anchor_distance_q = (g_source_closes[index] - g_source_anchor[index]) / q;
   double momentum_q = 0.0;
   int reference_index = momentum_reference_index;
   if(reference_index < 0 || reference_index >= index || !StateMapValidDirectionSample(reference_index))
      reference_index = index > 0 ? index - 1 : index;
   if(reference_index >= 0 && reference_index < index &&
      StateMapValidDirectionSample(reference_index) &&
      g_source_times[reference_index] < g_source_times[index])
   {
      momentum_q = (g_source_closes[index] - g_source_closes[reference_index]) / q;
   }

   double trend_state_score = 0.0;
   if(g_source_trend[index] > 0)
      trend_state_score = 1.0;
   else if(g_source_trend[index] < 0)
      trend_state_score = -1.0;

   double momentum_score = StateMapClamp(momentum_q, -1.0, 1.0);
   double trend_score =
      STATE_MAP_DIRECTION_TREND_STATE_WEIGHT * trend_state_score +
      STATE_MAP_DIRECTION_MOMENTUM_WEIGHT * momentum_score;

   if(update_extreme)
      StateMapUpdateExtreme(anchor_distance_q, g_source_stoch[index], momentum_q, tracker);

   double raw_score =
      STATE_MAP_DIRECTION_TREND_WEIGHT * trend_score +
      STATE_MAP_DIRECTION_EXHAUSTION_WEIGHT * StateMapExhaustionScore(tracker);
   int raw_direction = StateMapSign(raw_score);
   if(raw_direction == STATE_MAP_SIDE_NONE)
      raw_direction = StateMapFallbackDirection(previous_raw_direction, g_source_trend[index], anchor_distance_q);

   result.valid = true;
   result.raw_direction = raw_direction;
   result.raw_score = raw_score;
   result.reason_code = "ok";
   return true;
}

bool StateMapReplayDirection(StateMapDirectionResult &result)
{
   StateMapResetDirection(result);

   int source_count = ArraySize(g_source_times);
   if(source_count <= 0)
   {
      result.reason_code = "empty_source";
      return false;
   }

   int latest_valid_index = -1;
   for(int i = source_count - 1; i >= 0; i--)
   {
      if(StateMapValidDirectionSample(i))
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

   int confirmed_direction = STATE_MAP_SIDE_NONE;
   int pending_direction = STATE_MAP_SIDE_NONE;
   int pending_count = 0;
   int previous_raw_direction = STATE_MAP_SIDE_NONE;
   int last_decision_index = -1;
   StateMapDirectionTracker tracker;
   StateMapResetDirectionTracker(tracker);
   StateMapDirectionResult latest_result;
   StateMapResetDirection(latest_result);

   for(int i = 0; i <= latest_valid_index; i++)
   {
      if(!StateMapValidDirectionSample(i))
         continue;

      bool decision_sample = StateMapDirectionDecisionSample(i, latest_valid_index, last_decision_index);
      int momentum_reference_index = last_decision_index >= 0 ? last_decision_index : MathMax(0, i - 1);
      if(!StateMapEvaluateDirectionSample(
         i,
         momentum_reference_index,
         previous_raw_direction,
         decision_sample,
         tracker,
         latest_result
      ))
      {
         continue;
      }

      previous_raw_direction = latest_result.raw_direction;
      if(!decision_sample)
         continue;

      if(confirmed_direction == STATE_MAP_SIDE_NONE)
      {
         confirmed_direction = latest_result.raw_direction;
         pending_direction = STATE_MAP_SIDE_NONE;
         pending_count = 0;
      }
      else if(latest_result.raw_direction == confirmed_direction)
      {
         pending_direction = STATE_MAP_SIDE_NONE;
         pending_count = 0;
      }
      else if(MathAbs(latest_result.raw_score) >= STATE_MAP_DIRECTION_MIN_FLIP_SCORE)
      {
         if(pending_direction == latest_result.raw_direction)
            pending_count++;
         else
         {
            pending_direction = latest_result.raw_direction;
            pending_count = 1;
         }

         if(pending_count >= STATE_MAP_DIRECTION_CONFIRM_EVENTS)
         {
            confirmed_direction = latest_result.raw_direction;
            pending_direction = STATE_MAP_SIDE_NONE;
            pending_count = 0;
         }
      }
      else
      {
         pending_direction = STATE_MAP_SIDE_NONE;
         pending_count = 0;
      }

      last_decision_index = i;
   }

   if(!latest_result.valid)
   {
      result.reason_code = "replay_failed";
      return false;
   }

   result = latest_result;
   if(confirmed_direction == STATE_MAP_SIDE_NONE)
      confirmed_direction = latest_result.raw_direction;
   result.confirmed_direction = confirmed_direction;
   result.pending_direction = pending_direction;
   result.pending_count = pending_count;
   result.reason_code = "ok";
   return true;
}

//====================================================================
// 6. M1 loading and simple cache
//====================================================================

void StateMapSetDataReady()
{
   g_data_status = "pair_stack_ready";
   g_data_detail = "chart-symbol M1";
}

void StateMapSetDataFailure(const string reason)
{
   g_data_status = reason == "" ? "visual_stack_unavailable" : reason;
   g_data_detail = "check M1 source";
}

bool StateMapLoadClosedM1(
   const datetime chart_newest,
   MqlRates &rates[],
   int &copied,
   string &reason
)
{
   reason = "";
   copied = 0;
   ArrayResize(rates, 0);
   ArraySetAsSeries(rates, false);

   datetime latest_closed_m1 = iTime(_Symbol, PERIOD_M1, 1);
   if(latest_closed_m1 <= 0)
   {
      reason = "latest_closed_m1_missing";
      return false;
   }

   int max_bars = MathMax(0, VisualMaxM1Bars);
   ResetLastError();
   if(max_bars > 0)
   {
      copied = CopyRates(_Symbol, PERIOD_M1, 1, max_bars, rates);
   }
   else
   {
      datetime source_to = TimeCurrent();
      if(source_to < chart_newest)
         source_to = chart_newest;
      copied = CopyRates(_Symbol, PERIOD_M1, (datetime)0, source_to, rates);
   }

   if(copied <= 0)
   {
      reason = "copyrates_failed_" + IntegerToString(GetLastError());
      return false;
   }

   if(rates[0].time > rates[copied - 1].time)
   {
      MqlRates ordered[];
      ArrayResize(ordered, copied);
      for(int i = 0; i < copied; i++)
         ordered[i] = rates[copied - 1 - i];
      ArrayResize(rates, copied);
      for(int i = 0; i < copied; i++)
         rates[i] = ordered[i];
   }

   while(copied > 0 && rates[copied - 1].time > latest_closed_m1)
      copied--;
   ArrayResize(rates, copied);

   if(copied < 100)
   {
      reason = "insufficient_closed_m1_history";
      return false;
   }
   return true;
}

bool StateMapEnsureCache(const datetime chart_newest, bool &refreshed)
{
   refreshed = false;
   datetime latest_closed_m1 = iTime(_Symbol, PERIOD_M1, 1);
   int max_bars = MathMax(0, VisualMaxM1Bars);
   double point = _Point;
   if(point <= 0.0)
      point = SymbolInfoDouble(_Symbol, SYMBOL_POINT);

   if(g_cache_ready &&
      latest_closed_m1 > 0 &&
      g_cache_latest_closed_m1 == latest_closed_m1 &&
      g_cache_visual_max_m1_bars == max_bars &&
      g_cache_point == point)
   {
      StateMapSetDataReady();
      return true;
   }

   MqlRates rates[];
   int copied = 0;
   string reason = "";
   if(!StateMapLoadClosedM1(chart_newest, rates, copied, reason))
   {
      StateMapSetDataFailure(reason);
      if(g_data_status != g_last_logged_failure)
      {
         Print("Limni StateMap M1 source unavailable: ", g_data_status);
         g_last_logged_failure = g_data_status;
      }
      return g_cache_ready && ArraySize(g_source_times) > 0;
   }

   int valid_q_days = 0;
   if(!StateMapBuildFormula(
      rates,
      copied,
      g_source_times,
      g_source_closes,
      g_source_q,
      g_source_anchor,
      g_source_stoch,
      g_source_trend,
      g_source_trigger,
      valid_q_days
   ))
   {
      StateMapSetDataFailure("stack_build_failed");
      if(g_data_status != g_last_logged_failure)
      {
         Print("Limni StateMap formula unavailable: ", g_data_status);
         g_last_logged_failure = g_data_status;
      }
      return g_cache_ready && ArraySize(g_source_times) > 0;
   }

   StateMapReplayDirection(g_direction);
   g_source_count = copied;
   g_valid_q_day_count = valid_q_days;
   g_cache_latest_closed_m1 = g_source_times[ArraySize(g_source_times) - 1];
   g_cache_visual_max_m1_bars = max_bars;
   g_cache_point = point;
   g_cache_ready = true;
   StateMapSetDataReady();
   refreshed = true;
   return true;
}

//====================================================================
// 7. Chart-buffer projection
//====================================================================

void StateMapClearBuffer(double &buffer[], const int count, const double value)
{
   for(int i = 0; i < count; i++)
      buffer[i] = value;
}

void StateMapChartTimeRange(
   const datetime &time[],
   const int rates_total,
   datetime &oldest,
   datetime &newest
)
{
   oldest = 0;
   newest = 0;
   if(rates_total <= 0)
      return;

   bool series = ArrayGetAsSeries(time);
   newest = series ? time[0] : time[rates_total - 1];
   oldest = series ? time[rates_total - 1] : time[0];
   if(oldest > 0 && newest > 0)
      return;

   for(int i = 0; i < rates_total; i++)
   {
      if(time[i] <= 0)
         continue;
      if(oldest == 0 || time[i] < oldest)
         oldest = time[i];
      if(newest == 0 || time[i] > newest)
         newest = time[i];
   }
}

int StateMapProjectionLimit(
   const int rates_total,
   const int prev_calculated,
   const datetime chart_oldest,
   const datetime chart_newest
)
{
   bool full_projection =
      prev_calculated <= 0 ||
      prev_calculated > rates_total ||
      chart_oldest <= 0 ||
      chart_newest <= 0 ||
      g_projected_chart_oldest <= 0 ||
      g_projected_chart_newest <= 0 ||
      chart_oldest < g_projected_chart_oldest ||
      chart_newest < g_projected_chart_newest;
   if(full_projection)
      return rates_total;

   int limit = rates_total - prev_calculated;
   if(prev_calculated > 0)
      limit++;
   if(limit < 1)
      limit = 1;
   if(limit > rates_total)
      limit = rates_total;
   return limit;
}

int StateMapSourceIndexAtOrBefore(const datetime value)
{
   int count = ArraySize(g_source_times);
   if(count <= 0 || value <= 0 || value < g_source_times[0])
      return -1;
   if(value >= g_source_times[count - 1])
      return count - 1;

   int lo = 0;
   int hi = count - 1;
   while(lo <= hi)
   {
      int mid = (lo + hi) / 2;
      if(g_source_times[mid] <= value)
         lo = mid + 1;
      else
         hi = mid - 1;
   }
   return hi;
}

void StateMapProjectToChart(
   const datetime &time[],
   const int rates_total,
   const bool chart_series,
   const int limit
)
{
   int safe_limit = MathMin(MathMax(0, limit), rates_total);
   for(int recent = safe_limit - 1; recent >= 0; recent--)
   {
      int chart_index = chart_series ? recent : rates_total - 1 - recent;
      if(!ShowCenterLine)
      {
         PriceAnchorBuffer[chart_index] = EMPTY_VALUE;
         StateAnchorBuffer[chart_index] = EMPTY_VALUE;
         StateColorBuffer[chart_index] = 2.0;
         continue;
      }

      int source_index = StateMapSourceIndexAtOrBefore(time[chart_index]);
      if(source_index < 0 || g_source_anchor[source_index] == EMPTY_VALUE)
      {
         PriceAnchorBuffer[chart_index] = EMPTY_VALUE;
         StateAnchorBuffer[chart_index] = EMPTY_VALUE;
         StateColorBuffer[chart_index] = 2.0;
         continue;
      }

      PriceAnchorBuffer[chart_index] = g_source_anchor[source_index];
      StateAnchorBuffer[chart_index] = g_source_anchor[source_index];
      if(g_source_trend[source_index] > 0)
         StateColorBuffer[chart_index] = 0.0;
      else if(g_source_trend[source_index] < 0)
         StateColorBuffer[chart_index] = 1.0;
      else
         StateColorBuffer[chart_index] = 2.0;
   }
}

//====================================================================
// 8. Panel and visual rendering
//====================================================================

void StateMapDeleteObjects()
{
   int total = ObjectsTotal(0, 0, -1);
   for(int index = total - 1; index >= 0; index--)
   {
      string name = ObjectName(0, index, 0, -1);
      if(StringFind(name, STATE_MAP_OBJECT_PREFIX) == 0)
         ObjectDelete(0, name);
   }
}

void StateMapDeleteObjectGroup(const string prefix)
{
   int total = ObjectsTotal(0, 0, -1);
   for(int index = total - 1; index >= 0; index--)
   {
      string name = ObjectName(0, index, 0, -1);
      if(StringFind(name, prefix) == 0)
         ObjectDelete(0, name);
   }
}

int StateMapPanelLeft()
{
   int chart_width = (int)ChartGetInteger(0, CHART_WIDTH_IN_PIXELS, 0);
   if(chart_width <= 0)
      return STATE_MAP_PANEL_RIGHT;
   return MathMax(12, chart_width - STATE_MAP_PANEL_WIDTH - STATE_MAP_PANEL_RIGHT);
}

int StateMapPanelHeight()
{
   return g_panel_minimized ? STATE_MAP_PANEL_MINIMIZED_HEIGHT : STATE_MAP_PANEL_HEIGHT;
}

int StateMapPanelX(const int local_x)
{
   return StateMapPanelLeft() + local_x;
}

int StateMapPanelY(const int local_y)
{
   return STATE_MAP_PANEL_TOP + local_y;
}

string StateMapClip(const string value, const int max_len)
{
   if(max_len <= 0 || StringLen(value) <= max_len)
      return value;
   if(max_len <= 3)
      return StringSubstr(value, 0, max_len);
   return StringSubstr(value, 0, max_len - 3) + "...";
}

int StateMapNthSundayDay(const int year, const int month, const int nth)
{
   MqlDateTime first;
   ZeroMemory(first);
   first.year = year;
   first.mon = month;
   first.day = 1;
   datetime first_time = StructToTime(first);

   MqlDateTime parts;
   TimeToStruct(first_time, parts);
   int days_until_sunday = (7 - parts.day_of_week) % 7;
   int safe_nth = nth < 1 ? 1 : nth;
   return 1 + days_until_sunday + ((safe_nth - 1) * 7);
}

bool StateMapTorontoDstActive(const datetime utc_value)
{
   if(utc_value <= 0)
      return false;

   MqlDateTime parts;
   TimeToStruct(utc_value, parts);

   MqlDateTime dst_start;
   ZeroMemory(dst_start);
   dst_start.year = parts.year;
   dst_start.mon = 3;
   dst_start.day = StateMapNthSundayDay(parts.year, 3, 2);
   dst_start.hour = 7;

   MqlDateTime dst_end;
   ZeroMemory(dst_end);
   dst_end.year = parts.year;
   dst_end.mon = 11;
   dst_end.day = StateMapNthSundayDay(parts.year, 11, 1);
   dst_end.hour = 6;

   datetime start_utc = StructToTime(dst_start);
   datetime end_utc = StructToTime(dst_end);
   return utc_value >= start_utc && utc_value < end_utc;
}

datetime StateMapBrokerTimeToUtc(const datetime broker_value)
{
   datetime broker_now = TimeTradeServer();
   if(broker_now <= 0)
      broker_now = TimeCurrent();

   datetime utc_now = TimeGMT();
   if(broker_now <= 0 || utc_now <= 0)
      return broker_value;

   int offset_seconds = (int)(broker_now - utc_now);
   if(MathAbs((double)offset_seconds) > 18.0 * 60.0 * 60.0)
      return broker_value;
   return broker_value - offset_seconds;
}

datetime StateMapUtcToToronto(const datetime utc_value)
{
   int offset_seconds = StateMapTorontoDstActive(utc_value) ? -4 * 60 * 60 : -5 * 60 * 60;
   return utc_value + offset_seconds;
}

string StateMapTimeLabel(const datetime value)
{
   if(value <= 0)
      return "syncing";

   datetime toronto_value = StateMapUtcToToronto(StateMapBrokerTimeToUtc(value));
   MqlDateTime parts;
   TimeToStruct(toronto_value, parts);
   int hour_12 = parts.hour % 12;
   if(hour_12 == 0)
      hour_12 = 12;
   string suffix = parts.hour >= 12 ? "pm" : "am";
   return StringFormat("%d:%02d %s", hour_12, parts.min, suffix);
}

string StateMapReasonLabel(const string reason)
{
   string output = reason == "" ? "unknown" : reason;
   StringReplace(output, "_", " ");
   return StateMapClip(output, 34);
}

double StateMapPipSize()
{
   double point = _Point;
   if(point <= 0.0)
      point = SymbolInfoDouble(_Symbol, SYMBOL_POINT);
   if(point <= 0.0)
      return 0.0;

   int digits = (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS);
   if(digits == 5 || digits == 3)
      return point * 10.0;
   if(digits == 4 || digits == 2)
      return point;

   double pip = point * 10.0;
   if(pip > point && pip < 1.0)
      return pip;
   return point;
}

string StateMapSignedValueLabel(const double value, const int digits = 2)
{
   if(value == EMPTY_VALUE || !MathIsValidNumber(value))
      return "n/a";
   if(value > 0.0)
      return "+" + DoubleToString(value, digits);
   return DoubleToString(value, digits);
}

string StateMapPipsLabel(const double value)
{
   if(value == EMPTY_VALUE || !MathIsValidNumber(value))
      return "n/a";

   double pip_size = StateMapPipSize();
   if(pip_size <= 0.0)
      return StateMapSignedValueLabel(value, 4);

   double pips = value / pip_size;
   int digits = MathAbs(pips) < 1.0 ? 2 : 1;
   return DoubleToString(pips, digits) + " pips";
}

string StateMapDirectionLabel(const StateMapDirectionResult &direction)
{
   if(!direction.valid)
      return "WAITING";
   if(direction.confirmed_direction > 0)
      return "LONG";
   if(direction.confirmed_direction < 0)
      return "SHORT";
   return "WAITING";
}

color StateMapDirectionColor(const StateMapDirectionResult &direction)
{
   if(!direction.valid)
      return STATE_MAP_STRESS_COLOR;
   if(direction.confirmed_direction > 0)
      return STATE_MAP_LONG_COLOR;
   if(direction.confirmed_direction < 0)
      return STATE_MAP_SHORT_COLOR;
   return STATE_MAP_STRESS_COLOR;
}

string StateMapTrendLabel(const int state)
{
   if(state > 0)
      return "UP";
   if(state < 0)
      return "DOWN";
   return "NEUTRAL";
}

color StateMapTrendColor(const int state)
{
   if(state > 0)
      return STATE_MAP_LONG_COLOR;
   if(state < 0)
      return STATE_MAP_SHORT_COLOR;
   return STATE_MAP_MUTED_COLOR;
}

string StateMapStochZoneLabel(const double value)
{
   if(value == EMPTY_VALUE || !MathIsValidNumber(value))
      return "waiting";
   if(value >= 80.0)
      return "upper zone";
   if(value <= 20.0)
      return "lower zone";
   return "mid zone";
}

bool StateMapHasVisualData(const double anchor, const double stoch, const int bars)
{
   return bars > 0 &&
      anchor != EMPTY_VALUE && MathIsValidNumber(anchor) &&
      stoch != EMPTY_VALUE && MathIsValidNumber(stoch);
}

void StateMapDrawRect(
   const string name,
   const int x,
   const int y,
   const int width,
   const int height,
   const color fill,
   const color border,
   const int z_order
)
{
   if(ObjectFind(0, name) < 0)
      ObjectCreate(0, name, OBJ_RECTANGLE_LABEL, 0, 0, 0);
   ObjectSetInteger(0, name, OBJPROP_CORNER, CORNER_LEFT_UPPER);
   ObjectSetInteger(0, name, OBJPROP_XDISTANCE, x);
   ObjectSetInteger(0, name, OBJPROP_YDISTANCE, y);
   ObjectSetInteger(0, name, OBJPROP_XSIZE, MathMax(1, width));
   ObjectSetInteger(0, name, OBJPROP_YSIZE, MathMax(1, height));
   ObjectSetInteger(0, name, OBJPROP_BGCOLOR, fill);
   ObjectSetInteger(0, name, OBJPROP_COLOR, border);
   ObjectSetInteger(0, name, OBJPROP_BACK, false);
   ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
   ObjectSetInteger(0, name, OBJPROP_SELECTED, false);
   ObjectSetInteger(0, name, OBJPROP_HIDDEN, true);
   ObjectSetInteger(0, name, OBJPROP_ZORDER, z_order);
}

void StateMapDrawText(
   const string name,
   const string text,
   const int x,
   const int y,
   const color text_color,
   const int font_size,
   const int z_order,
   const string font_name = "Segoe UI"
)
{
   if(ObjectFind(0, name) < 0)
      ObjectCreate(0, name, OBJ_LABEL, 0, 0, 0);
   ObjectSetInteger(0, name, OBJPROP_CORNER, CORNER_LEFT_UPPER);
   ObjectSetInteger(0, name, OBJPROP_XDISTANCE, x);
   ObjectSetInteger(0, name, OBJPROP_YDISTANCE, y);
   ObjectSetInteger(0, name, OBJPROP_COLOR, text_color);
   ObjectSetInteger(0, name, OBJPROP_FONTSIZE, font_size);
   ObjectSetString(0, name, OBJPROP_FONT, font_name);
   ObjectSetString(0, name, OBJPROP_TEXT, text);
   ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
   ObjectSetInteger(0, name, OBJPROP_SELECTED, false);
   ObjectSetInteger(0, name, OBJPROP_HIDDEN, true);
   ObjectSetInteger(0, name, OBJPROP_ZORDER, z_order);
}

void StateMapDrawButton(
   const string name,
   const string text,
   const int x,
   const int y,
   const int width,
   const int height,
   const color bg,
   const color text_color,
   const int z_order
)
{
   if(ObjectFind(0, name) < 0)
      ObjectCreate(0, name, OBJ_BUTTON, 0, 0, 0);
   ObjectSetInteger(0, name, OBJPROP_CORNER, CORNER_LEFT_UPPER);
   ObjectSetInteger(0, name, OBJPROP_XDISTANCE, x);
   ObjectSetInteger(0, name, OBJPROP_YDISTANCE, y);
   ObjectSetInteger(0, name, OBJPROP_XSIZE, MathMax(1, width));
   ObjectSetInteger(0, name, OBJPROP_YSIZE, MathMax(1, height));
   ObjectSetInteger(0, name, OBJPROP_BGCOLOR, bg);
   ObjectSetInteger(0, name, OBJPROP_COLOR, text_color);
   ObjectSetInteger(0, name, OBJPROP_FONTSIZE, 10);
   ObjectSetString(0, name, OBJPROP_FONT, "Segoe UI Semibold");
   ObjectSetString(0, name, OBJPROP_TEXT, text);
   ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
   ObjectSetInteger(0, name, OBJPROP_SELECTED, false);
   ObjectSetInteger(0, name, OBJPROP_STATE, false);
   ObjectSetInteger(0, name, OBJPROP_HIDDEN, true);
   ObjectSetInteger(0, name, OBJPROP_ZORDER, z_order);
}

void StateMapDrawPanelBlock(
   const string suffix,
   const string title,
   const string value,
   const string detail,
   const int local_x,
   const int local_y,
   const int width,
   const int height,
   const color accent
)
{
   string prefix = STATE_MAP_PANEL_DATA_PREFIX + suffix;
   int x = StateMapPanelX(local_x);
   int y = StateMapPanelY(local_y);
   StateMapDrawRect(prefix + "_Bg", x, y, width, height, STATE_MAP_BLOCK_BG, STATE_MAP_BLOCK_BORDER, 36);
   StateMapDrawRect(prefix + "_Accent", x, y, width, 3, accent, accent, 37);
   StateMapDrawText(prefix + "_Title", title, x + 12, y + 10, STATE_MAP_MUTED_COLOR, 8, 38, "Segoe UI Semibold");
   StateMapDrawText(prefix + "_Value", StateMapClip(value, 24), x + 12, y + 27, STATE_MAP_TEXT_COLOR, 12, 39, "Segoe UI Semibold");
   StateMapDrawText(prefix + "_Detail", StateMapClip(detail, 28), x + 12, y + 47, STATE_MAP_MUTED_COLOR, 8, 39, "Segoe UI");
}

void StateMapUpdatePanel(
   const double latest_anchor,
   const int latest_trend,
   const double latest_stoch,
   const double latest_q,
   const int bars,
   const int q_days,
   StateMapDirectionResult &direction
)
{
   g_panel_latest_anchor = latest_anchor;
   g_panel_latest_trend = latest_trend;
   g_panel_latest_stoch = latest_stoch;
   g_panel_latest_q = latest_q;
   g_panel_latest_bars = bars;
   g_panel_latest_q_days = q_days;
   g_panel_latest_direction = direction;

   bool data_ready = StateMapHasVisualData(latest_anchor, latest_stoch, bars);
   string direction_value = StateMapDirectionLabel(direction);
   color direction_color = StateMapDirectionColor(direction);
   string header_direction = "DIRECTION: " + direction_value;
   string stoch_value = latest_stoch == EMPTY_VALUE ? "n/a" : DoubleToString(latest_stoch, 1);
   string q_value = StateMapPipsLabel(latest_q);
   string anchor_value = latest_anchor == EMPTY_VALUE ? "n/a" : DoubleToString(latest_anchor, _Digits);
   string bars_value = IntegerToString(bars);
   string q_days_value = IntegerToString(q_days);
   string reason_value = StateMapReasonLabel(g_data_status);
   string m1_label = StateMapTimeLabel(g_cache_latest_closed_m1);
   string trend_value = StateMapTrendLabel(latest_trend);
   string center_detail = ShowCenterLine ? "center line on" : "center line off";
   string stoch_detail = StateMapStochZoneLabel(latest_stoch);

   string signature =
      IntegerToString(StateMapPanelLeft()) + "|" +
      (g_panel_minimized ? "min" : "full") + "|" +
      header_direction + "|" + reason_value + "|" + g_data_detail + "|" + m1_label + "|" +
      IntegerToString(latest_trend) + "|" + direction_value + "|" +
      DoubleToString(direction.raw_score, 4) + "|" +
      IntegerToString(direction.pending_direction) + "|" +
      IntegerToString(direction.pending_count) + "|" +
      stoch_value + "|" + q_value + "|" + anchor_value + "|" + bars_value + "|" + q_days_value;
   if(signature == g_panel_signature)
      return;

   int panel_x = StateMapPanelLeft();
   int panel_y = STATE_MAP_PANEL_TOP;
   StateMapDrawRect(STATE_MAP_PANEL_PREFIX + "Body", panel_x, panel_y, STATE_MAP_PANEL_WIDTH, StateMapPanelHeight(), STATE_MAP_PANEL_BG, STATE_MAP_PANEL_BORDER, 30);
   StateMapDrawRect(STATE_MAP_PANEL_PREFIX + "Header", panel_x, panel_y, STATE_MAP_PANEL_WIDTH, STATE_MAP_HEADER_HEIGHT, direction_color, direction_color, 42);
   StateMapDrawText(STATE_MAP_PANEL_PREFIX + "Title", "LIMNI STATE MAP", panel_x + 18, panel_y + 10, STATE_MAP_TITLE_COLOR, 8, 44, "Segoe UI Semibold");
   StateMapDrawText(STATE_MAP_PANEL_PREFIX + "State", header_direction, panel_x + 18, panel_y + 32, STATE_MAP_BADGE_TEXT_COLOR, StringLen(header_direction) > 16 ? 14 : 16, 44, "Segoe UI Semibold");
   StateMapDrawButton(STATE_MAP_PANEL_PREFIX + "Minimize", g_panel_minimized ? "+" : "-", panel_x + STATE_MAP_PANEL_WIDTH - 42, panel_y + 18, 26, 26, C'17,22,31', STATE_MAP_TEXT_COLOR, 46);

   if(g_panel_minimized)
   {
      StateMapDeleteObjectGroup(STATE_MAP_PANEL_DATA_PREFIX);
      g_panel_signature = signature;
      return;
   }

   int left_x = STATE_MAP_PANEL_PAD;
   int right_x = STATE_MAP_PANEL_PAD + STATE_MAP_BLOCK_WIDTH + STATE_MAP_BLOCK_GAP;
   int row_1 = STATE_MAP_HEADER_HEIGHT + STATE_MAP_PANEL_PAD;
   int row_2 = row_1 + STATE_MAP_BLOCK_HEIGHT + STATE_MAP_BLOCK_GAP;
   int row_3 = row_2 + STATE_MAP_BLOCK_HEIGHT + STATE_MAP_BLOCK_GAP;
   int row_4 = row_3 + STATE_MAP_BLOCK_HEIGHT + STATE_MAP_BLOCK_GAP;

   StateMapDrawPanelBlock("Direction", "DIRECTION", direction_value, direction.valid ? "confirmed core" : direction.reason_code, left_x, row_1, STATE_MAP_BLOCK_WIDTH, STATE_MAP_BLOCK_HEIGHT, direction_color);
   StateMapDrawPanelBlock("Q", "Q SIZE", q_value, "q-days " + q_days_value, right_x, row_1, STATE_MAP_BLOCK_WIDTH, STATE_MAP_BLOCK_HEIGHT, STATE_MAP_NEUTRAL_COLOR);
   StateMapDrawPanelBlock("Trend", "TREND", trend_value, center_detail, left_x, row_2, STATE_MAP_BLOCK_WIDTH, STATE_MAP_BLOCK_HEIGHT, StateMapTrendColor(latest_trend));
   StateMapDrawPanelBlock("Stochastic", "STOCHASTIC", stoch_value, stoch_detail, right_x, row_2, STATE_MAP_BLOCK_WIDTH, STATE_MAP_BLOCK_HEIGHT, STATE_MAP_STOCH_LINE);
   StateMapDrawPanelBlock("Anchor", "ANCHOR", anchor_value, "center price", left_x, row_3, STATE_MAP_BLOCK_WIDTH, STATE_MAP_BLOCK_HEIGHT, STATE_MAP_STOCH_LINE);
   StateMapDrawPanelBlock("Status", "DATA", reason_value, g_data_detail, right_x, row_3, STATE_MAP_BLOCK_WIDTH, STATE_MAP_BLOCK_HEIGHT, data_ready ? STATE_MAP_LONG_COLOR : STATE_MAP_STRESS_COLOR);
   StateMapDrawPanelBlock("Bars", "BARS", bars_value, "q-days " + q_days_value, left_x, row_4, STATE_MAP_BLOCK_WIDTH, STATE_MAP_BLOCK_HEIGHT, STATE_MAP_NEUTRAL_COLOR);
   StateMapDrawPanelBlock("AsOf", "AS-OF", m1_label, "Toronto", right_x, row_4, STATE_MAP_BLOCK_WIDTH, STATE_MAP_BLOCK_HEIGHT, STATE_MAP_NEUTRAL_COLOR);

   g_panel_signature = signature;
}

void StateMapRefreshPanel()
{
   g_panel_signature = "";
   StateMapUpdatePanel(
      g_panel_latest_anchor,
      g_panel_latest_trend,
      g_panel_latest_stoch,
      g_panel_latest_q,
      g_panel_latest_bars,
      g_panel_latest_q_days,
      g_panel_latest_direction
   );
}

//====================================================================
// 9. OnInit / OnCalculate / OnChartEvent
//====================================================================

int OnInit()
{
   SetIndexBuffer(0, PriceAnchorBuffer, INDICATOR_DATA);
   SetIndexBuffer(1, StateAnchorBuffer, INDICATOR_DATA);
   SetIndexBuffer(2, StateColorBuffer, INDICATOR_COLOR_INDEX);
   PlotIndexSetDouble(0, PLOT_EMPTY_VALUE, EMPTY_VALUE);
   PlotIndexSetDouble(1, PLOT_EMPTY_VALUE, EMPTY_VALUE);
   IndicatorSetString(INDICATOR_SHORTNAME, "Limni State Map");
   IndicatorSetInteger(INDICATOR_DIGITS, _Digits);

   StateMapDeleteObjects();
   StateMapResetDirection(g_direction);
   StateMapResetDirection(g_panel_latest_direction);
   StateMapUpdatePanel(EMPTY_VALUE, 0, EMPTY_VALUE, EMPTY_VALUE, 0, 0, g_panel_latest_direction);
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
   StateMapDeleteObjects();
   g_panel_signature = "";
}

void OnChartEvent(
   const int id,
   const long &lparam,
   const double &dparam,
   const string &sparam
)
{
   if(id == CHARTEVENT_OBJECT_CLICK && sparam == STATE_MAP_PANEL_PREFIX + "Minimize")
   {
      g_panel_minimized = !g_panel_minimized;
      ObjectSetInteger(0, STATE_MAP_PANEL_PREFIX + "Minimize", OBJPROP_STATE, false);
      StateMapRefreshPanel();
      return;
   }

   if(id == CHARTEVENT_CHART_CHANGE)
      StateMapRefreshPanel();
}

int OnCalculate(
   const int rates_total,
   const int prev_calculated,
   const datetime &time[],
   const double &open[],
   const double &high[],
   const double &low[],
   const double &close[],
   const long &tick_volume[],
   const long &volume[],
   const int &spread[]
)
{
   if(prev_calculated <= 0)
   {
      StateMapClearBuffer(PriceAnchorBuffer, rates_total, EMPTY_VALUE);
      StateMapClearBuffer(StateAnchorBuffer, rates_total, EMPTY_VALUE);
      StateMapClearBuffer(StateColorBuffer, rates_total, 2.0);
   }

   datetime chart_oldest = 0;
   datetime chart_newest = 0;
   StateMapChartTimeRange(time, rates_total, chart_oldest, chart_newest);
   if(chart_oldest <= 0 || chart_newest <= 0)
      return rates_total;

   bool refreshed = false;
   if(!StateMapEnsureCache(chart_newest, refreshed))
   {
      StateMapResetDirection(g_panel_latest_direction);
      StateMapUpdatePanel(EMPTY_VALUE, 0, EMPTY_VALUE, EMPTY_VALUE, 0, 0, g_panel_latest_direction);
      return 0;
   }
   if(refreshed)
      g_panel_signature = "";

   int limit = refreshed ? rates_total : StateMapProjectionLimit(rates_total, prev_calculated, chart_oldest, chart_newest);
   if(limit == rates_total)
   {
      StateMapClearBuffer(PriceAnchorBuffer, rates_total, EMPTY_VALUE);
      StateMapClearBuffer(StateAnchorBuffer, rates_total, EMPTY_VALUE);
      StateMapClearBuffer(StateColorBuffer, rates_total, 2.0);
   }

   StateMapProjectToChart(time, rates_total, ArrayGetAsSeries(time), limit);
   g_projected_chart_oldest = chart_oldest;
   g_projected_chart_newest = chart_newest;

   int latest = ArraySize(g_source_times) - 1;
   double latest_anchor = latest >= 0 ? g_source_anchor[latest] : EMPTY_VALUE;
   int latest_trend = latest >= 0 ? g_source_trend[latest] : 0;
   double latest_stoch = latest >= 0 ? g_source_stoch[latest] : EMPTY_VALUE;
   double latest_q = latest >= 0 ? g_source_q[latest] : EMPTY_VALUE;
   StateMapUpdatePanel(
      latest_anchor,
      latest_trend,
      latest_stoch,
      latest_q,
      g_source_count,
      g_valid_q_day_count,
      g_direction
   );

   return rates_total;
}
