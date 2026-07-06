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
   if(event_index < 2 || q <= 0.0)
      return 0;

   LimniAgeKtrStage(lower_stage, lower_age);
   LimniAgeKtrStage(upper_stage, upper_age);

   double prior_lo = 0.0;
   double prior_hi = 0.0;
   LimniRecentEventRange(events, event_index, LIMNI_LRMG_KTR_RANGE_EVENT_WINDOW, prior_lo, prior_hi);
   if(prior_hi <= prior_lo)
      return 0;

   double price = events[event_index];

   if(price < prior_lo)
   {
      lower_stage = 1;
      lower_age = 0;
      lower_boundary = prior_lo;
      upper_stage = 0;
      upper_age = 0;
      return 0;
   }

   if(price > prior_hi)
   {
      upper_stage = 1;
      upper_age = 0;
      upper_boundary = prior_hi;
      lower_stage = 0;
      lower_age = 0;
      return 0;
   }

   if(lower_stage == 1 && price > lower_boundary)
   {
      lower_stage = 2;
      lower_age = 0;
   }

   if(upper_stage == 1 && price < upper_boundary)
   {
      upper_stage = 2;
      upper_age = 0;
   }

   if(lower_stage == 2)
   {
      if(price <= lower_boundary - q)
      {
         lower_stage = 1;
         lower_age = 0;
      }
      else if(price >= lower_boundary + q)
      {
         lower_stage = 0;
         lower_age = 0;
         return 1;
      }
   }

   if(upper_stage == 2)
   {
      if(price >= upper_boundary + q)
      {
         upper_stage = 1;
         upper_age = 0;
      }
      else if(price <= upper_boundary - q)
      {
         upper_stage = 0;
         upper_age = 0;
         return -1;
      }
   }

   return 0;
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
               for(int event_index = first_new_event; event_index < closed_event_count; event_index++)
               {
                  double event_line = LimniMedianRecentEvents(closed_events, event_index + 1, LIMNI_LRMG_LINE_EVENT_WINDOW);
                  last_david_state = LimniLrmgDavidState(closed_events[event_index], event_line, q, last_david_state);

                  int ktr_signal = LimniLrmgKataraktiSignal(
                     closed_events,
                     event_index,
                     q,
                     lower_ktr_stage,
                     lower_ktr_age,
                     lower_ktr_boundary,
                     upper_ktr_stage,
                     upper_ktr_age,
                     upper_ktr_boundary
                  );
                  if(ktr_signal != 0)
                     event_trigger = ktr_signal;
               }

               cached_line = LimniMedianRecentEvents(closed_events, closed_event_count, LIMNI_LRMG_LINE_EVENT_WINDOW);
               cached_state_value = (double)last_david_state;
               LimniRecentEventRange(closed_events, closed_event_count, LIMNI_LRMG_STOCH_EVENT_WINDOW, cached_lo, cached_hi);
               out_trigger[i] = event_trigger;
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
   datetime source_from = LimniLrmgSourceStartForChart(chart_oldest, scale_lookback_days);
   datetime latest_closed_m1 = iTime(_Symbol, LIMNI_LRMG_SOURCE_TIMEFRAME, 1);
   if(latest_closed_m1 <= 0)
      latest_closed_m1 = TimeCurrent();

   if(g_limni_stack_cache_valid &&
      g_limni_stack_cache_symbol == _Symbol &&
      g_limni_stack_cache_scale_lookback_days == scale_lookback_days &&
      g_limni_stack_cache_point == point &&
      g_limni_stack_cache_latest_closed_m1 == latest_closed_m1 &&
      source_from >= g_limni_stack_cache_source_from)
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
      day_count,
      valid_q_day_count
   );
   if(!built)
      return false;

   g_limni_stack_cache_valid = true;
   g_limni_stack_cache_symbol = _Symbol;
   g_limni_stack_cache_scale_lookback_days = scale_lookback_days;
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

   return true;
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
