//+------------------------------------------------------------------+
//|                              LimniLRMGStackCore.mqh              |
//|            Shared LRMG completed-day q stack calculation helpers |
//+------------------------------------------------------------------+
#ifndef LIMNI_LRMG_STACK_CORE_MQH
#define LIMNI_LRMG_STACK_CORE_MQH

#include "LimniRadialMovementGrid.mqh"

#define LIMNI_LRMG_SOURCE_TIMEFRAME PERIOD_M1
#define LIMNI_LRMG_LINE_EVENT_WINDOW 55
#define LIMNI_LRMG_STOCH_EVENT_WINDOW 55
#define LIMNI_LRMG_KTR_RANGE_EVENT_WINDOW 55
#define LIMNI_LRMG_KTR_MAX_SETUP_AGE_EVENTS 8
#define LIMNI_LRMG_DAVID_CONFIRM_Q 1.0
#define LIMNI_LRMG_MIN_DAY_BARS 10
#define LIMNI_LRMG_MAX_BRICKS_PER_BAR 200

#define LIMNI_KTR_SIGNAL_NONE 0
#define LIMNI_KTR_REVERSAL_BUY 1
#define LIMNI_KTR_REVERSAL_SELL -1
#define LIMNI_KTR_CONTINUATION_BUY 2
#define LIMNI_KTR_CONTINUATION_SELL -2

#define LIMNI_KTR_SWEEP_NONE 0
#define LIMNI_KTR_SWEEP_UPPER 1
#define LIMNI_KTR_SWEEP_LOWER -1

#define LIMNI_KTR_RESOLUTION_NONE 0
#define LIMNI_KTR_RESOLUTION_REVERSAL_RECLAIM 1
#define LIMNI_KTR_RESOLUTION_CONTINUATION_HOLD 2
#define LIMNI_KTR_RESOLUTION_FAILED_RECLAIM 3

#define LIMNI_KTR_RELATION_UNKNOWN 0
#define LIMNI_KTR_RELATION_ABOVE 1
#define LIMNI_KTR_RELATION_BELOW -1
#define LIMNI_KTR_RELATION_WITH_TREND 1
#define LIMNI_KTR_RELATION_AGAINST_TREND -1
#define LIMNI_KTR_RELATION_NEUTRAL 0

struct LimniLrmgDayRecord
{
   int      key;
   datetime start_time;
   datetime end_time;
   int      start_index;
   int      end_index;
   int      bar_count;
   bool     complete;
   bool     valid_q;
   double   q_day;
   double   q_effective;
};

struct LimniKataraktiEvent
{
   int signal;
   int sweep_side;
   int resolution;
   int trade_direction;
   int anchor_relation;
   int trend_relation;
   int setup_age;
   double boundary;
   double q_distance;
};

void LimniResetKataraktiEvent(LimniKataraktiEvent &event)
{
   event.signal = LIMNI_KTR_SIGNAL_NONE;
   event.sweep_side = LIMNI_KTR_SWEEP_NONE;
   event.resolution = LIMNI_KTR_RESOLUTION_NONE;
   event.trade_direction = 0;
   event.anchor_relation = LIMNI_KTR_RELATION_UNKNOWN;
   event.trend_relation = LIMNI_KTR_RELATION_UNKNOWN;
   event.setup_age = 0;
   event.boundary = 0.0;
   event.q_distance = 0.0;
}

int LimniKtrTradeDirectionFromSignal(const int signal)
{
   if(signal > 0)
      return 1;
   if(signal < 0)
      return -1;
   return 0;
}

bool LimniKtrIsContinuationSignal(const int signal)
{
   return signal == LIMNI_KTR_CONTINUATION_BUY || signal == LIMNI_KTR_CONTINUATION_SELL;
}

bool LimniKtrIsReversalSignal(const int signal)
{
   return signal == LIMNI_KTR_REVERSAL_BUY || signal == LIMNI_KTR_REVERSAL_SELL;
}

int LimniKtrAnchorRelation(const double price, const double anchor)
{
   if(anchor == EMPTY_VALUE || anchor == 0.0)
      return LIMNI_KTR_RELATION_UNKNOWN;
   if(price > anchor)
      return LIMNI_KTR_RELATION_ABOVE;
   if(price < anchor)
      return LIMNI_KTR_RELATION_BELOW;
   return LIMNI_KTR_RELATION_NEUTRAL;
}

int LimniKtrTrendRelation(const int trade_direction, const int trend_state)
{
   if(trade_direction == 0 || trend_state == 0)
      return LIMNI_KTR_RELATION_NEUTRAL;
   if((trade_direction > 0 && trend_state > 0) || (trade_direction < 0 && trend_state < 0))
      return LIMNI_KTR_RELATION_WITH_TREND;
   return LIMNI_KTR_RELATION_AGAINST_TREND;
}

int LimniSetKataraktiSignal(
   LimniKataraktiEvent &event,
   const int signal,
   const int sweep_side,
   const int resolution,
   const double boundary,
   const double price,
   const double q,
   const int setup_age,
   const double anchor,
   const int trend_state
)
{
   event.signal = signal;
   event.sweep_side = sweep_side;
   event.resolution = resolution;
   event.trade_direction = LimniKtrTradeDirectionFromSignal(signal);
   event.anchor_relation = LimniKtrAnchorRelation(price, anchor);
   event.trend_relation = LimniKtrTrendRelation(event.trade_direction, trend_state);
   event.setup_age = setup_age;
   event.boundary = boundary;
   event.q_distance = q > 0.0 ? MathAbs(price - boundary) / q : 0.0;
   return signal;
}

int LimniLrmgDayKey(const datetime value)
{
   MqlDateTime parts;
   TimeToStruct(value, parts);
   return parts.year * 10000 + parts.mon * 100 + parts.day;
}

datetime LimniLrmgSourceStartForChart(const datetime chart_oldest, const int scale_lookback_days)
{
   int horizon = MathMax(0, scale_lookback_days);
   if(horizon == 0)
      return (datetime)0;

   int warmup_days = MathMax(14, horizon * 3 + 14);
   long start = (long)chart_oldest - (long)warmup_days * 86400;
   if(start < 0)
      return (datetime)0;

   return (datetime)start;
}

int LimniChronIndex(const int total, const bool series, const int logical_index)
{
   if(series)
      return total - 1 - logical_index;
   return logical_index;
}

void LimniChartTimeRange(const datetime &time[], const int rates_total, datetime &oldest, datetime &newest)
{
   oldest = 0;
   newest = 0;

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

void LimniChartTimeRangeFast(const datetime &time[], const int rates_total, datetime &oldest, datetime &newest)
{
   oldest = 0;
   newest = 0;
   if(rates_total <= 0)
      return;

   bool chart_series = ArrayGetAsSeries(time);
   newest = chart_series ? time[0] : time[rates_total - 1];
   oldest = chart_series ? time[rates_total - 1] : time[0];

   if(oldest <= 0 || newest <= 0)
      LimniChartTimeRange(time, rates_total, oldest, newest);
}

double LimniMedianValues(double &values[], const int count)
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

void LimniAppendDayRecord(
   LimniLrmgDayRecord &days[],
   int &day_count,
   int &day_capacity,
   const int key,
   const datetime start_time,
   const datetime end_time,
   const int start_index,
   const int end_index
)
{
   if(day_count >= day_capacity)
   {
      day_capacity = day_capacity <= 0 ? 64 : day_capacity * 2;
      ArrayResize(days, day_capacity);
   }

   days[day_count].key = key;
   days[day_count].start_time = start_time;
   days[day_count].end_time = end_time;
   days[day_count].start_index = start_index;
   days[day_count].end_index = end_index;
   days[day_count].bar_count = end_index - start_index + 1;
   days[day_count].complete = false;
   days[day_count].valid_q = false;
   days[day_count].q_day = 0.0;
   days[day_count].q_effective = 0.0;
   day_count++;
}

int LimniBuildDayRecords(const MqlRates &source_rates[], const int source_count, LimniLrmgDayRecord &days[])
{
   ArrayResize(days, 0);
   if(source_count <= 0)
      return 0;

   int day_count = 0;
   int day_capacity = 0;
   int active_key = LimniLrmgDayKey(source_rates[0].time);
   int start_index = 0;

   for(int i = 1; i < source_count; i++)
   {
      int key = LimniLrmgDayKey(source_rates[i].time);
      if(key == active_key)
         continue;

      LimniAppendDayRecord(
         days,
         day_count,
         day_capacity,
         active_key,
         source_rates[start_index].time,
         source_rates[i - 1].time,
         start_index,
         i - 1
      );

      active_key = key;
      start_index = i;
   }

   LimniAppendDayRecord(
      days,
      day_count,
      day_capacity,
      active_key,
      source_rates[start_index].time,
      source_rates[source_count - 1].time,
      start_index,
      source_count - 1
   );

   ArrayResize(days, day_count);
   return day_count;
}

double LimniEffectiveQForDay(
   const LimniLrmgDayRecord &days[],
   const int day_index,
   const int scale_lookback_days
)
{
   int horizon = MathMax(0, scale_lookback_days);
   int sample_limit = horizon == 0 ? INT_MAX : horizon;
   double samples[];
   int sample_count = 0;
   int sample_capacity = 0;

   for(int i = day_index - 1; i >= 0 && sample_count < sample_limit; i--)
   {
      if(!days[i].valid_q || days[i].q_day <= 0.0)
         continue;

      if(sample_count >= sample_capacity)
      {
         sample_capacity = sample_capacity <= 0 ? 32 : sample_capacity * 2;
         ArrayResize(samples, sample_capacity);
      }

      samples[sample_count] = days[i].q_day;
      sample_count++;
   }

   return LimniMedianValues(samples, sample_count);
}

int LimniComputeDailyQ(
   LimniLrmgDayRecord &days[],
   const int day_count,
   const datetime &source_times[],
   const double &source_closes[],
   const int scale_lookback_days
)
{
   int valid_count = 0;

   for(int d = 0; d < day_count; d++)
   {
      days[d].complete = (d < day_count - 1);
      days[d].valid_q = false;
      days[d].q_day = 0.0;
      days[d].q_effective = 0.0;

      if(!days[d].complete || days[d].bar_count < LIMNI_LRMG_MIN_DAY_BARS)
         continue;

      LimniRadialMap day_map;
      if(!LimniComputeMovementMap(
         source_times,
         source_closes,
         days[d].start_index,
         days[d].end_index,
         false,
         day_map
      ))
      {
         continue;
      }

      days[d].q_day = day_map.radius;
      days[d].valid_q = day_map.radius > 0.0;
      if(days[d].valid_q)
         valid_count++;
   }

   for(int d = 0; d < day_count; d++)
      days[d].q_effective = LimniEffectiveQForDay(days, d, scale_lookback_days);

   return valid_count;
}

void LimniAppendEventPrice(double &events[], int &count, int &capacity, const double price)
{
   if(count >= capacity)
   {
      capacity = capacity <= 0 ? 256 : capacity * 2;
      ArrayResize(events, capacity);
   }

   events[count] = price;
   count++;
}

double LimniMedianRecentEvents(const double &events[], const int count, const int window)
{
   if(count <= 0)
      return 0.0;

   int start_index = MathMax(0, count - MathMax(1, window));
   int sample_count = count - start_index;
   double samples[];
   ArrayResize(samples, sample_count);

   for(int i = 0; i < sample_count; i++)
      samples[i] = events[start_index + i];

   return LimniMedianValues(samples, sample_count);
}

void LimniRecentEventRange(
   const double &events[],
   const int count,
   const int window,
   double &lo,
   double &hi
)
{
   lo = 0.0;
   hi = 0.0;
   if(count <= 0)
      return;

   int start_index = MathMax(0, count - MathMax(2, window));
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

double LimniBoundedStoch(const double price, const double lo, const double hi)
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

void LimniBuildLrmgMovementTriggerSeries(
   const datetime &source_times[],
   const double &source_closes[],
   const double &source_q[],
   int &out_trigger[]
)
{
   int count = ArraySize(source_times);
   ArrayResize(out_trigger, count);
   if(count <= 0 || ArraySize(source_closes) < count || ArraySize(source_q) < count)
      return;

   bool has_confirmed_event = false;
   double base_price = 0.0;
   double last_event_price = 0.0;
   int current_level = 0;
   int day_key = 0;

   for(int i = 0; i < count; i++)
   {
      out_trigger[i] = 0;
      if(source_times[i] <= 0 || !MathIsValidNumber(source_closes[i]))
         continue;

      int current_day_key = LimniLrmgDayKey(source_times[i]);
      if(day_key == 0 || current_day_key != day_key)
      {
         day_key = current_day_key;
         base_price = has_confirmed_event ? last_event_price : source_closes[i];
         current_level = 0;
      }

      double q = source_q[i];
      if(q <= 0.0 || !MathIsValidNumber(q))
         continue;

      int trigger = 0;
      int guard = 0;
      while(source_closes[i] >= base_price + ((double)current_level + 1.0) * q && guard < LIMNI_LRMG_MAX_BRICKS_PER_BAR)
      {
         current_level++;
         last_event_price = base_price + (double)current_level * q;
         has_confirmed_event = true;
         trigger = 1;
         guard++;
      }

      guard = 0;
      while(source_closes[i] <= base_price + ((double)current_level - 1.0) * q && guard < LIMNI_LRMG_MAX_BRICKS_PER_BAR)
      {
         current_level--;
         last_event_price = base_price + (double)current_level * q;
         has_confirmed_event = true;
         trigger = -1;
         guard++;
      }

      out_trigger[i] = trigger;
   }
}

int LimniLrmgDavidState(
   const double event_price,
   const double reference_line,
   const double q,
   const int previous_state
)
{
   if(reference_line == EMPTY_VALUE || q <= 0.0)
      return previous_state;

   double z = (event_price - reference_line) / q;
   if(z >= LIMNI_LRMG_DAVID_CONFIRM_Q)
      return 1;
   if(z <= -LIMNI_LRMG_DAVID_CONFIRM_Q)
      return -1;
   return previous_state;
}

void LimniAgeKtrStage(int &stage, int &age)
{
   if(stage <= 0)
      return;

   age++;
   if(age > LIMNI_LRMG_KTR_MAX_SETUP_AGE_EVENTS)
   {
      stage = 0;
      age = 0;
   }
}

int LimniLrmgKataraktiClassify(
   const double &events[],
   const int event_index,
   const double q,
   const double anchor,
   const int trend_state,
   int &lower_stage,
   int &lower_age,
   double &lower_boundary,
   int &upper_stage,
   int &upper_age,
   double &upper_boundary,
   LimniKataraktiEvent &event
)
{
   LimniResetKataraktiEvent(event);

   if(event_index < 2 || q <= 0.0)
      return LIMNI_KTR_SIGNAL_NONE;

   LimniAgeKtrStage(lower_stage, lower_age);
   LimniAgeKtrStage(upper_stage, upper_age);

   double prior_lo = 0.0;
   double prior_hi = 0.0;
   LimniRecentEventRange(events, event_index, LIMNI_LRMG_KTR_RANGE_EVENT_WINDOW, prior_lo, prior_hi);
   if(prior_hi <= prior_lo)
      return LIMNI_KTR_SIGNAL_NONE;

   double price = events[event_index];

   if(lower_stage == 1)
   {
      if(price > lower_boundary)
      {
         lower_stage = 2;
         lower_age = 0;
      }
      else if(price <= lower_boundary - q)
      {
         int setup_age = lower_age;
         double boundary = lower_boundary;
         lower_stage = 0;
         lower_age = 0;
         return LimniSetKataraktiSignal(
            event,
            LIMNI_KTR_CONTINUATION_SELL,
            LIMNI_KTR_SWEEP_LOWER,
            LIMNI_KTR_RESOLUTION_CONTINUATION_HOLD,
            boundary,
            price,
            q,
            setup_age,
            anchor,
            trend_state
         );
      }
   }

   if(upper_stage == 1)
   {
      if(price < upper_boundary)
      {
         upper_stage = 2;
         upper_age = 0;
      }
      else if(price >= upper_boundary + q)
      {
         int setup_age = upper_age;
         double boundary = upper_boundary;
         upper_stage = 0;
         upper_age = 0;
         return LimniSetKataraktiSignal(
            event,
            LIMNI_KTR_CONTINUATION_BUY,
            LIMNI_KTR_SWEEP_UPPER,
            LIMNI_KTR_RESOLUTION_CONTINUATION_HOLD,
            boundary,
            price,
            q,
            setup_age,
            anchor,
            trend_state
         );
      }
   }

   if(lower_stage == 2)
   {
      if(price <= lower_boundary - q)
      {
         int setup_age = lower_age;
         double boundary = lower_boundary;
         lower_stage = 0;
         lower_age = 0;
         return LimniSetKataraktiSignal(
            event,
            LIMNI_KTR_CONTINUATION_SELL,
            LIMNI_KTR_SWEEP_LOWER,
            LIMNI_KTR_RESOLUTION_FAILED_RECLAIM,
            boundary,
            price,
            q,
            setup_age,
            anchor,
            trend_state
         );
      }
      else if(price >= lower_boundary + q)
      {
         int setup_age = lower_age;
         double boundary = lower_boundary;
         lower_stage = 0;
         lower_age = 0;
         return LimniSetKataraktiSignal(
            event,
            LIMNI_KTR_REVERSAL_BUY,
            LIMNI_KTR_SWEEP_LOWER,
            LIMNI_KTR_RESOLUTION_REVERSAL_RECLAIM,
            boundary,
            price,
            q,
            setup_age,
            anchor,
            trend_state
         );
      }
   }

   if(upper_stage == 2)
   {
      if(price >= upper_boundary + q)
      {
         int setup_age = upper_age;
         double boundary = upper_boundary;
         upper_stage = 0;
         upper_age = 0;
         return LimniSetKataraktiSignal(
            event,
            LIMNI_KTR_CONTINUATION_BUY,
            LIMNI_KTR_SWEEP_UPPER,
            LIMNI_KTR_RESOLUTION_FAILED_RECLAIM,
            boundary,
            price,
            q,
            setup_age,
            anchor,
            trend_state
         );
      }
      else if(price <= upper_boundary - q)
      {
         int setup_age = upper_age;
         double boundary = upper_boundary;
         upper_stage = 0;
         upper_age = 0;
         return LimniSetKataraktiSignal(
            event,
            LIMNI_KTR_REVERSAL_SELL,
            LIMNI_KTR_SWEEP_UPPER,
            LIMNI_KTR_RESOLUTION_REVERSAL_RECLAIM,
            boundary,
            price,
            q,
            setup_age,
            anchor,
            trend_state
         );
      }
   }

   if(price < prior_lo)
   {
      lower_stage = 1;
      lower_age = 0;
      lower_boundary = prior_lo;
      upper_stage = 0;
      upper_age = 0;
      return LIMNI_KTR_SIGNAL_NONE;
   }

   if(price > prior_hi)
   {
      upper_stage = 1;
      upper_age = 0;
      upper_boundary = prior_hi;
      lower_stage = 0;
      lower_age = 0;
      return LIMNI_KTR_SIGNAL_NONE;
   }

   return LIMNI_KTR_SIGNAL_NONE;
}

int LimniLrmgKataraktiSignal(
   const double &events[],
   const int event_index,
   const double q,
   int &lower_stage,
   int &lower_age,
   double &lower_boundary,
   int &upper_stage,
   int &upper_age,
   double &upper_boundary
)
{
   LimniKataraktiEvent event;
   return LimniLrmgKataraktiClassify(
      events,
      event_index,
      q,
      EMPTY_VALUE,
      0,
      lower_stage,
      lower_age,
      lower_boundary,
      upper_stage,
      upper_age,
      upper_boundary,
      event
   );
}

void LimniCopyDatetimeArray(const datetime &source[], datetime &target[])
{
   int count = ArraySize(source);
   ArrayResize(target, count);
   for(int i = 0; i < count; i++)
      target[i] = source[i];
}

void LimniCopyDoubleArray(const double &source[], double &target[])
{
   int count = ArraySize(source);
   ArrayResize(target, count);
   for(int i = 0; i < count; i++)
      target[i] = source[i];
}

void LimniCopyIntArray(const int &source[], int &target[])
{
   int count = ArraySize(source);
   ArrayResize(target, count);
   for(int i = 0; i < count; i++)
      target[i] = source[i];
}

void LimniClearDoubleBuffer(double &buffer[], const int rates_total)
{
   for(int i = 0; i < rates_total; i++)
      buffer[i] = EMPTY_VALUE;
}

void LimniFillDoubleBuffer(double &buffer[], const int rates_total, const double value)
{
   for(int i = 0; i < rates_total; i++)
      buffer[i] = value;
}

void LimniCopyDoubleBuffer(const double &source[], double &target[], const int rates_total)
{
   for(int i = 0; i < rates_total; i++)
      target[i] = source[i];
}

int LimniChangedBarLimit(const int rates_total, const int prev_calculated, const int max_initial_bars = 20000)
{
   if(rates_total <= 0)
      return 0;

   int limit = rates_total - prev_calculated;
   if(prev_calculated > 0)
      limit++;
   else if(max_initial_bars > 0)
      limit = MathMin(rates_total, max_initial_bars);

   if(limit < 1)
      limit = 1;
   if(limit > rates_total)
      limit = rates_total;

   return limit;
}

bool LimniSourceSeriesCoversChart(const datetime &source_times[], const datetime chart_oldest)
{
   if(chart_oldest <= 0)
      return true;

   int source_count = ArraySize(source_times);
   if(source_count <= 0)
      return false;

   return source_times[0] <= chart_oldest;
}

int LimniStableProjectionLimit(
   const int rates_total,
   const int prev_calculated,
   const datetime chart_oldest,
   const datetime chart_newest,
   const datetime previous_chart_oldest,
   const datetime previous_chart_newest,
   const int max_incremental_bars = 20000
)
{
   if(rates_total <= 0)
      return 0;

   bool needs_full_projection =
      prev_calculated <= 0 ||
      prev_calculated > rates_total ||
      chart_oldest <= 0 ||
      chart_newest <= 0 ||
      previous_chart_oldest <= 0 ||
      previous_chart_newest <= 0 ||
      chart_oldest < previous_chart_oldest ||
      chart_newest < previous_chart_newest;

   if(needs_full_projection)
      return rates_total;

   return LimniChangedBarLimit(rates_total, prev_calculated, max_incremental_bars);
}

int LimniRecentChartIndex(const int rates_total, const bool chart_series, const int recent_offset)
{
   return chart_series ? recent_offset : rates_total - 1 - recent_offset;
}

int LimniSourceIndexAtOrBefore(const datetime &source_times[], const datetime value)
{
   int source_count = ArraySize(source_times);
   if(source_count <= 0 || value <= 0)
      return -1;
   if(value < source_times[0])
      return -1;
   if(value >= source_times[source_count - 1])
      return source_count - 1;

   int lo = 0;
   int hi = source_count - 1;
   while(lo <= hi)
   {
      int mid = (lo + hi) / 2;
      if(source_times[mid] <= value)
         lo = mid + 1;
      else
         hi = mid - 1;
   }

   return hi;
}

void LimniProjectDoubleToChartLimit(
   const datetime &time[],
   const int rates_total,
   const bool chart_series,
   const datetime &source_times[],
   const double &source_values[],
   double &target_buffer[],
   const int limit
)
{
   int source_count = ArraySize(source_times);
   if(source_count <= 0 || rates_total <= 0)
      return;

   int safe_limit = MathMin(MathMax(0, limit), rates_total);
   for(int recent = safe_limit - 1; recent >= 0; recent--)
   {
      int idx = LimniRecentChartIndex(rates_total, chart_series, recent);
      int source_index = LimniSourceIndexAtOrBefore(source_times, time[idx]);
      if(source_index >= 0 && source_values[source_index] != EMPTY_VALUE)
         target_buffer[idx] = source_values[source_index];
      else
         target_buffer[idx] = EMPTY_VALUE;
   }
}

bool LimniBuildStackSeries(
   const MqlRates &source_rates[],
   const int source_count,
   const int scale_lookback_days,
   const double point,
   datetime &out_times[],
   double &out_closes[],
   double &out_q[],
   double &out_line[],
   double &out_stoch[],
   double &out_ma[],
   int &out_ma_state[],
   int &out_trigger[],
   int &out_trigger_sweep_side[],
   int &out_trigger_resolution[],
   int &out_trigger_anchor_relation[],
   int &out_trigger_trend_relation[],
   int &out_trigger_setup_age[],
   double &out_trigger_q_distance[],
   int &day_count,
   int &valid_q_day_count
)
{
   ArrayResize(out_times, 0);
   ArrayResize(out_closes, 0);
   ArrayResize(out_q, 0);
   ArrayResize(out_line, 0);
   ArrayResize(out_stoch, 0);
   ArrayResize(out_ma, 0);
   ArrayResize(out_ma_state, 0);
   ArrayResize(out_trigger, 0);
   ArrayResize(out_trigger_sweep_side, 0);
   ArrayResize(out_trigger_resolution, 0);
   ArrayResize(out_trigger_anchor_relation, 0);
   ArrayResize(out_trigger_trend_relation, 0);
   ArrayResize(out_trigger_setup_age, 0);
   ArrayResize(out_trigger_q_distance, 0);
   day_count = 0;
   valid_q_day_count = 0;

   if(source_count < 100)
      return false;

   datetime source_times[];
   double source_closes[];
   ArrayResize(source_times, source_count);
   ArrayResize(source_closes, source_count);
   for(int i = 0; i < source_count; i++)
   {
      source_times[i] = source_rates[i].time;
      source_closes[i] = source_rates[i].close;
   }

   LimniLrmgDayRecord days[];
   day_count = LimniBuildDayRecords(source_rates, source_count, days);
   if(day_count <= 1)
      return false;

   valid_q_day_count = LimniComputeDailyQ(days, day_count, source_times, source_closes, scale_lookback_days);

   ArrayResize(out_times, source_count);
   ArrayResize(out_closes, source_count);
   ArrayResize(out_q, source_count);
   ArrayResize(out_line, source_count);
   ArrayResize(out_stoch, source_count);
   ArrayResize(out_ma, source_count);
   ArrayResize(out_ma_state, source_count);
   ArrayResize(out_trigger, source_count);
   ArrayResize(out_trigger_sweep_side, source_count);
   ArrayResize(out_trigger_resolution, source_count);
   ArrayResize(out_trigger_anchor_relation, source_count);
   ArrayResize(out_trigger_trend_relation, source_count);
   ArrayResize(out_trigger_setup_age, source_count);
   ArrayResize(out_trigger_q_distance, source_count);

   for(int i = 0; i < source_count; i++)
   {
      out_times[i] = source_rates[i].time;
      out_closes[i] = source_rates[i].close;
      out_q[i] = 0.0;
      out_line[i] = EMPTY_VALUE;
      out_stoch[i] = EMPTY_VALUE;
      out_ma[i] = EMPTY_VALUE;
      out_ma_state[i] = 0;
      out_trigger[i] = 0;
      out_trigger_sweep_side[i] = LIMNI_KTR_SWEEP_NONE;
      out_trigger_resolution[i] = LIMNI_KTR_RESOLUTION_NONE;
      out_trigger_anchor_relation[i] = LIMNI_KTR_RELATION_UNKNOWN;
      out_trigger_trend_relation[i] = LIMNI_KTR_RELATION_UNKNOWN;
      out_trigger_setup_age[i] = 0;
      out_trigger_q_distance[i] = 0.0;
   }

   bool has_confirmed_event = false;
   double base_price = 0.0;
   double last_event_price = 0.0;
   int current_level = 0;
   double closed_events[];
   int closed_event_count = 0;
   int closed_event_capacity = 0;
   int last_david_state = 0;
   int lower_ktr_stage = 0;
   int lower_ktr_age = 0;
   double lower_ktr_boundary = 0.0;
   int upper_ktr_stage = 0;
   int upper_ktr_age = 0;
   double upper_ktr_boundary = 0.0;
   int cached_metric_event_count = -1;
   double cached_line = EMPTY_VALUE;
   double cached_state_value = EMPTY_VALUE;
   double cached_lo = 0.0;
   double cached_hi = 0.0;

   for(int d = 0; d < day_count; d++)
   {
      double q = days[d].q_effective;
      if(q <= 0.0)
         continue;

      base_price = has_confirmed_event ? last_event_price : source_rates[days[d].start_index].close;
      current_level = 0;

      for(int i = days[d].start_index; i <= days[d].end_index; i++)
      {
         int guard = 0;
         while(source_rates[i].close >= base_price + ((double)current_level + 1.0) * q && guard < LIMNI_LRMG_MAX_BRICKS_PER_BAR)
         {
            current_level++;
            double event_price = base_price + (double)current_level * q;
            LimniAppendEventPrice(closed_events, closed_event_count, closed_event_capacity, event_price);
            last_event_price = event_price;
            has_confirmed_event = true;
            guard++;
         }

         guard = 0;
         while(source_rates[i].close <= base_price + ((double)current_level - 1.0) * q && guard < LIMNI_LRMG_MAX_BRICKS_PER_BAR)
         {
            current_level--;
            double event_price = base_price + (double)current_level * q;
            LimniAppendEventPrice(closed_events, closed_event_count, closed_event_capacity, event_price);
            last_event_price = event_price;
            has_confirmed_event = true;
            guard++;
         }

         out_q[i] = q;

         if(closed_event_count > 0)
         {
            if(cached_metric_event_count != closed_event_count)
            {
               int first_new_event = cached_metric_event_count < 0 ? 0 : cached_metric_event_count;
               int event_trigger = 0;
               int event_sweep_side = LIMNI_KTR_SWEEP_NONE;
               int event_resolution = LIMNI_KTR_RESOLUTION_NONE;
               int event_anchor_relation = LIMNI_KTR_RELATION_UNKNOWN;
               int event_trend_relation = LIMNI_KTR_RELATION_UNKNOWN;
               int event_setup_age = 0;
               double event_q_distance = 0.0;
               for(int event_index = first_new_event; event_index < closed_event_count; event_index++)
               {
                  double event_line = LimniMedianRecentEvents(closed_events, event_index + 1, LIMNI_LRMG_LINE_EVENT_WINDOW);
                  last_david_state = LimniLrmgDavidState(closed_events[event_index], event_line, q, last_david_state);

                  LimniKataraktiEvent ktr_event;
                  int ktr_signal = LimniLrmgKataraktiClassify(
                     closed_events,
                     event_index,
                     q,
                     event_line,
                     last_david_state,
                     lower_ktr_stage,
                     lower_ktr_age,
                     lower_ktr_boundary,
                     upper_ktr_stage,
                     upper_ktr_age,
                     upper_ktr_boundary,
                     ktr_event
                  );
                  if(ktr_signal != 0)
                  {
                     event_trigger = ktr_signal;
                     event_sweep_side = ktr_event.sweep_side;
                     event_resolution = ktr_event.resolution;
                     event_anchor_relation = ktr_event.anchor_relation;
                     event_trend_relation = ktr_event.trend_relation;
                     event_setup_age = ktr_event.setup_age;
                     event_q_distance = ktr_event.q_distance;
                  }
               }

               cached_line = LimniMedianRecentEvents(closed_events, closed_event_count, LIMNI_LRMG_LINE_EVENT_WINDOW);
               cached_state_value = (double)last_david_state;
               LimniRecentEventRange(closed_events, closed_event_count, LIMNI_LRMG_STOCH_EVENT_WINDOW, cached_lo, cached_hi);
               out_trigger[i] = event_trigger;
               out_trigger_sweep_side[i] = event_sweep_side;
               out_trigger_resolution[i] = event_resolution;
               out_trigger_anchor_relation[i] = event_anchor_relation;
               out_trigger_trend_relation[i] = event_trend_relation;
               out_trigger_setup_age[i] = event_setup_age;
               out_trigger_q_distance[i] = event_q_distance;
               cached_metric_event_count = closed_event_count;
            }

            out_line[i] = cached_line;
            out_ma[i] = cached_state_value;
            out_ma_state[i] = last_david_state;
            out_stoch[i] = LimniBoundedStoch(source_rates[i].close, cached_lo, cached_hi);
         }
         else
         {
            out_line[i] = base_price;
         }
      }
   }

   return true;
}

bool g_limni_stack_cache_valid = false;
string g_limni_stack_cache_symbol = "";
int g_limni_stack_cache_scale_lookback_days = -999;
int g_limni_stack_cache_visual_max_m1_bars = 0;
double g_limni_stack_cache_point = 0.0;
datetime g_limni_stack_cache_source_from = 0;
datetime g_limni_stack_cache_latest_closed_m1 = 0;
int g_limni_stack_cache_copied = 0;
int g_limni_stack_cache_day_count = 0;
int g_limni_stack_cache_valid_q_day_count = 0;
datetime g_limni_stack_cache_times[];
double g_limni_stack_cache_closes[];
double g_limni_stack_cache_q[];
double g_limni_stack_cache_line[];
double g_limni_stack_cache_stoch[];
double g_limni_stack_cache_ma[];
int g_limni_stack_cache_ma_state[];
int g_limni_stack_cache_trigger[];
int g_limni_stack_cache_trigger_sweep_side[];
int g_limni_stack_cache_trigger_resolution[];
int g_limni_stack_cache_trigger_anchor_relation[];
int g_limni_stack_cache_trigger_trend_relation[];
int g_limni_stack_cache_trigger_setup_age[];
double g_limni_stack_cache_trigger_q_distance[];

void LimniExportCachedStack(
   datetime &source_times[],
   double &source_closes[],
   double &source_q[],
   double &source_line[],
   double &source_stoch[],
   double &source_ma[],
   int &source_ma_state[],
   int &source_trigger[],
   int &copied,
   int &day_count,
   int &valid_q_day_count
)
{
   LimniCopyDatetimeArray(g_limni_stack_cache_times, source_times);
   LimniCopyDoubleArray(g_limni_stack_cache_closes, source_closes);
   LimniCopyDoubleArray(g_limni_stack_cache_q, source_q);
   LimniCopyDoubleArray(g_limni_stack_cache_line, source_line);
   LimniCopyDoubleArray(g_limni_stack_cache_stoch, source_stoch);
   LimniCopyDoubleArray(g_limni_stack_cache_ma, source_ma);
   LimniCopyIntArray(g_limni_stack_cache_ma_state, source_ma_state);
   LimniCopyIntArray(g_limni_stack_cache_trigger, source_trigger);
   copied = g_limni_stack_cache_copied;
   day_count = g_limni_stack_cache_day_count;
   valid_q_day_count = g_limni_stack_cache_valid_q_day_count;
}

void LimniExportCachedStackDetailed(
   datetime &source_times[],
   double &source_closes[],
   double &source_q[],
   double &source_line[],
   double &source_stoch[],
   double &source_ma[],
   int &source_ma_state[],
   int &source_trigger[],
   int &source_trigger_sweep_side[],
   int &source_trigger_resolution[],
   int &source_trigger_anchor_relation[],
   int &source_trigger_trend_relation[],
   int &source_trigger_setup_age[],
   double &source_trigger_q_distance[],
   int &copied,
   int &day_count,
   int &valid_q_day_count
)
{
   LimniExportCachedStack(
      source_times,
      source_closes,
      source_q,
      source_line,
      source_stoch,
      source_ma,
      source_ma_state,
      source_trigger,
      copied,
      day_count,
      valid_q_day_count
   );
   LimniCopyIntArray(g_limni_stack_cache_trigger_sweep_side, source_trigger_sweep_side);
   LimniCopyIntArray(g_limni_stack_cache_trigger_resolution, source_trigger_resolution);
   LimniCopyIntArray(g_limni_stack_cache_trigger_anchor_relation, source_trigger_anchor_relation);
   LimniCopyIntArray(g_limni_stack_cache_trigger_trend_relation, source_trigger_trend_relation);
   LimniCopyIntArray(g_limni_stack_cache_trigger_setup_age, source_trigger_setup_age);
   LimniCopyDoubleArray(g_limni_stack_cache_trigger_q_distance, source_trigger_q_distance);
}

bool LimniLoadCachedStackSeriesDetailed(
   const datetime chart_oldest,
   const datetime chart_newest,
   const int scale_lookback_days,
   const double point,
   datetime &source_times[],
   double &source_closes[],
   double &source_q[],
   double &source_line[],
   double &source_stoch[],
   double &source_ma[],
   int &source_ma_state[],
   int &source_trigger[],
   int &source_trigger_sweep_side[],
   int &source_trigger_resolution[],
   int &source_trigger_anchor_relation[],
   int &source_trigger_trend_relation[],
   int &source_trigger_setup_age[],
   double &source_trigger_q_distance[],
   int &copied,
   int &day_count,
   int &valid_q_day_count
)
{
   datetime source_from = LimniLrmgSourceStartForChart(chart_oldest, scale_lookback_days);
   datetime latest_closed_m1 = iTime(_Symbol, LIMNI_LRMG_SOURCE_TIMEFRAME, 1);
   if(latest_closed_m1 <= 0)
      latest_closed_m1 = TimeCurrent();

   if(g_limni_stack_cache_valid &&
      g_limni_stack_cache_symbol == _Symbol &&
      g_limni_stack_cache_scale_lookback_days == scale_lookback_days &&
      g_limni_stack_cache_visual_max_m1_bars == 0 &&
      g_limni_stack_cache_point == point &&
      g_limni_stack_cache_latest_closed_m1 == latest_closed_m1 &&
      source_from >= g_limni_stack_cache_source_from)
   {
      LimniExportCachedStackDetailed(
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
         copied,
         day_count,
         valid_q_day_count
      );
      return true;
   }

   datetime source_to = TimeCurrent();
   if(source_to < chart_newest)
      source_to = chart_newest;

   MqlRates source_rates[];
   ArraySetAsSeries(source_rates, false);
   ResetLastError();
   copied = CopyRates(_Symbol, LIMNI_LRMG_SOURCE_TIMEFRAME, source_from, source_to, source_rates);
   if(copied < 100)
      return false;

   if(source_rates[0].time > source_rates[copied - 1].time)
   {
      MqlRates ordered[];
      ArrayResize(ordered, copied);
      for(int i = 0; i < copied; i++)
         ordered[i] = source_rates[copied - 1 - i];

      ArrayResize(source_rates, copied);
      for(int i = 0; i < copied; i++)
         source_rates[i] = ordered[i];
   }

   if(copied > 1)
   {
      copied--;
      ArrayResize(source_rates, copied);
   }

   bool built = LimniBuildStackSeries(
      source_rates,
      copied,
      scale_lookback_days,
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
   );
   if(!built)
      return false;

   g_limni_stack_cache_valid = true;
   g_limni_stack_cache_symbol = _Symbol;
   g_limni_stack_cache_scale_lookback_days = scale_lookback_days;
   g_limni_stack_cache_visual_max_m1_bars = 0;
   g_limni_stack_cache_point = point;
   g_limni_stack_cache_source_from = source_from;
   g_limni_stack_cache_latest_closed_m1 = latest_closed_m1;
   g_limni_stack_cache_copied = copied;
   g_limni_stack_cache_day_count = day_count;
   g_limni_stack_cache_valid_q_day_count = valid_q_day_count;
   LimniCopyDatetimeArray(source_times, g_limni_stack_cache_times);
   LimniCopyDoubleArray(source_closes, g_limni_stack_cache_closes);
   LimniCopyDoubleArray(source_q, g_limni_stack_cache_q);
   LimniCopyDoubleArray(source_line, g_limni_stack_cache_line);
   LimniCopyDoubleArray(source_stoch, g_limni_stack_cache_stoch);
   LimniCopyDoubleArray(source_ma, g_limni_stack_cache_ma);
   LimniCopyIntArray(source_ma_state, g_limni_stack_cache_ma_state);
   LimniCopyIntArray(source_trigger, g_limni_stack_cache_trigger);
   LimniCopyIntArray(source_trigger_sweep_side, g_limni_stack_cache_trigger_sweep_side);
   LimniCopyIntArray(source_trigger_resolution, g_limni_stack_cache_trigger_resolution);
   LimniCopyIntArray(source_trigger_anchor_relation, g_limni_stack_cache_trigger_anchor_relation);
   LimniCopyIntArray(source_trigger_trend_relation, g_limni_stack_cache_trigger_trend_relation);
   LimniCopyIntArray(source_trigger_setup_age, g_limni_stack_cache_trigger_setup_age);
   LimniCopyDoubleArray(source_trigger_q_distance, g_limni_stack_cache_trigger_q_distance);

   return true;
}

bool LimniLoadVisualStackSeries(
   const datetime chart_oldest,
   const datetime chart_newest,
   const int scale_lookback_days,
   const int visual_max_m1_bars,
   const double point,
   datetime &source_times[],
   double &source_closes[],
   double &source_q[],
   double &source_line[],
   double &source_stoch[],
   double &source_ma[],
   int &source_ma_state[],
   int &source_trigger[],
   int &copied,
   int &day_count,
   int &valid_q_day_count,
   string &reason_code
)
{
   reason_code = "";
   int max_m1_bars = MathMax(0, visual_max_m1_bars);
   datetime source_from = max_m1_bars > 0 ? (datetime)0 : LimniLrmgSourceStartForChart(chart_oldest, scale_lookback_days);
   datetime latest_closed_m1 = iTime(_Symbol, LIMNI_LRMG_SOURCE_TIMEFRAME, 1);
   if(latest_closed_m1 <= 0)
   {
      reason_code = "latest_closed_m1_missing";
      return false;
   }

   if(g_limni_stack_cache_valid &&
      g_limni_stack_cache_symbol == _Symbol &&
      g_limni_stack_cache_scale_lookback_days == scale_lookback_days &&
      g_limni_stack_cache_visual_max_m1_bars == max_m1_bars &&
      g_limni_stack_cache_point == point &&
      g_limni_stack_cache_latest_closed_m1 == latest_closed_m1 &&
      (max_m1_bars > 0 || source_from >= g_limni_stack_cache_source_from))
   {
      LimniExportCachedStack(
         source_times,
         source_closes,
         source_q,
         source_line,
         source_stoch,
         source_ma,
         source_ma_state,
         source_trigger,
         copied,
         day_count,
         valid_q_day_count
      );
      reason_code = "cache_ready";
      return true;
   }

   MqlRates source_rates[];
   ArraySetAsSeries(source_rates, false);
   ResetLastError();
   if(max_m1_bars > 0)
      copied = CopyRates(_Symbol, LIMNI_LRMG_SOURCE_TIMEFRAME, 1, max_m1_bars, source_rates);
   else
   {
      datetime source_to = TimeCurrent();
      if(source_to < chart_newest)
         source_to = chart_newest;
      copied = CopyRates(_Symbol, LIMNI_LRMG_SOURCE_TIMEFRAME, source_from, source_to, source_rates);
   }

   if(copied <= 0)
   {
      reason_code = "copyrates_failed_" + IntegerToString(GetLastError());
      return false;
   }
   if(copied < 100)
   {
      reason_code = "insufficient_m1_history";
      return false;
   }

   if(source_rates[0].time > source_rates[copied - 1].time)
   {
      MqlRates ordered[];
      ArrayResize(ordered, copied);
      for(int i = 0; i < copied; i++)
         ordered[i] = source_rates[copied - 1 - i];

      ArrayResize(source_rates, copied);
      for(int i = 0; i < copied; i++)
         source_rates[i] = ordered[i];
   }

   while(copied > 0 && source_rates[copied - 1].time > latest_closed_m1)
   {
      copied--;
      ArrayResize(source_rates, copied);
   }
   if(copied < 100)
   {
      reason_code = "insufficient_closed_m1_history";
      return false;
   }

   int source_trigger_sweep_side[];
   int source_trigger_resolution[];
   int source_trigger_anchor_relation[];
   int source_trigger_trend_relation[];
   int source_trigger_setup_age[];
   double source_trigger_q_distance[];
   datetime built_times[];
   double built_closes[];
   double built_q[];
   double built_line[];
   double built_stoch[];
   double built_ma[];
   int built_ma_state[];
   int built_trigger[];

   bool built = LimniBuildStackSeries(
      source_rates,
      copied,
      scale_lookback_days,
      point,
      built_times,
      built_closes,
      built_q,
      built_line,
      built_stoch,
      built_ma,
      built_ma_state,
      built_trigger,
      source_trigger_sweep_side,
      source_trigger_resolution,
      source_trigger_anchor_relation,
      source_trigger_trend_relation,
      source_trigger_setup_age,
      source_trigger_q_distance,
      day_count,
      valid_q_day_count
   );
   if(!built)
   {
      reason_code = "stack_build_failed";
      return false;
   }

   LimniCopyDatetimeArray(built_times, source_times);
   LimniCopyDoubleArray(built_closes, source_closes);
   LimniCopyDoubleArray(built_q, source_q);
   LimniCopyDoubleArray(built_line, source_line);
   LimniCopyDoubleArray(built_stoch, source_stoch);
   LimniCopyDoubleArray(built_ma, source_ma);
   LimniCopyIntArray(built_ma_state, source_ma_state);
   LimniCopyIntArray(built_trigger, source_trigger);

   g_limni_stack_cache_valid = true;
   g_limni_stack_cache_symbol = _Symbol;
   g_limni_stack_cache_scale_lookback_days = scale_lookback_days;
   g_limni_stack_cache_visual_max_m1_bars = max_m1_bars;
   g_limni_stack_cache_point = point;
   g_limni_stack_cache_source_from = ArraySize(source_times) > 0 ? source_times[0] : source_from;
   g_limni_stack_cache_latest_closed_m1 = latest_closed_m1;
   g_limni_stack_cache_copied = copied;
   g_limni_stack_cache_day_count = day_count;
   g_limni_stack_cache_valid_q_day_count = valid_q_day_count;
   LimniCopyDatetimeArray(source_times, g_limni_stack_cache_times);
   LimniCopyDoubleArray(source_closes, g_limni_stack_cache_closes);
   LimniCopyDoubleArray(source_q, g_limni_stack_cache_q);
   LimniCopyDoubleArray(source_line, g_limni_stack_cache_line);
   LimniCopyDoubleArray(source_stoch, g_limni_stack_cache_stoch);
   LimniCopyDoubleArray(source_ma, g_limni_stack_cache_ma);
   LimniCopyIntArray(source_ma_state, g_limni_stack_cache_ma_state);
   LimniCopyIntArray(source_trigger, g_limni_stack_cache_trigger);
   LimniCopyIntArray(source_trigger_sweep_side, g_limni_stack_cache_trigger_sweep_side);
   LimniCopyIntArray(source_trigger_resolution, g_limni_stack_cache_trigger_resolution);
   LimniCopyIntArray(source_trigger_anchor_relation, g_limni_stack_cache_trigger_anchor_relation);
   LimniCopyIntArray(source_trigger_trend_relation, g_limni_stack_cache_trigger_trend_relation);
   LimniCopyIntArray(source_trigger_setup_age, g_limni_stack_cache_trigger_setup_age);
   LimniCopyDoubleArray(source_trigger_q_distance, g_limni_stack_cache_trigger_q_distance);

   reason_code = "stack_ready";
   return true;
}

bool LimniLoadCachedStackSeries(
   const datetime chart_oldest,
   const datetime chart_newest,
   const int scale_lookback_days,
   const double point,
   datetime &source_times[],
   double &source_closes[],
   double &source_q[],
   double &source_line[],
   double &source_stoch[],
   double &source_ma[],
   int &source_ma_state[],
   int &source_trigger[],
   int &copied,
   int &day_count,
   int &valid_q_day_count
)
{
   int source_trigger_sweep_side[];
   int source_trigger_resolution[];
   int source_trigger_anchor_relation[];
   int source_trigger_trend_relation[];
   int source_trigger_setup_age[];
   double source_trigger_q_distance[];

   return LimniLoadCachedStackSeriesDetailed(
      chart_oldest,
      chart_newest,
      scale_lookback_days,
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
      copied,
      day_count,
      valid_q_day_count
   );
}

void LimniProjectDoubleToChart(
   const datetime &time[],
   const int rates_total,
   const bool chart_series,
   const datetime &source_times[],
   const double &source_values[],
   double &target_buffer[]
)
{
   int source_count = ArraySize(source_times);
   if(source_count <= 0)
      return;

   int source_index = 0;
   for(int logical = 0; logical < rates_total; logical++)
   {
      int idx = LimniChronIndex(rates_total, chart_series, logical);
      datetime bar_time = time[idx];

      while(source_index + 1 < source_count && source_times[source_index + 1] <= bar_time)
         source_index++;

      if(source_times[source_index] <= bar_time && source_values[source_index] != EMPTY_VALUE)
         target_buffer[idx] = source_values[source_index];
   }
}

#endif
