//+------------------------------------------------------------------+
//|                                          LimniLRMGPriceLine.mq5  |
//|            LRMG lagged completed-day q institutional price line  |
//+------------------------------------------------------------------+
#property copyright "LIMNI LTD"
#property version   "2.00"
#property indicator_chart_window
#property indicator_buffers 1
#property indicator_plots 1

#property indicator_label1 "LRMG Price Line"
#property indicator_type1 DRAW_LINE
#property indicator_color1 clrLimeGreen
#property indicator_style1 STYLE_SOLID
#property indicator_width1 2

#include "Include\\LimniRadialMovementGrid.mqh"

#define LRMG_V2_SOURCE_TIMEFRAME PERIOD_M1
#define LRMG_V2_LINE_EVENT_WINDOW 55
#define LRMG_V2_MIN_DAY_BARS 10
#define LRMG_V2_MAX_BRICKS_PER_BAR 200

input int ScaleLookbackDays = 20; // 0 = all prior completed days
input bool ShowDebugComment = false;

struct LrmgDayRecord
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

double V2Buffer[];

datetime g_cachedSourceFrom = 0;
datetime g_cachedSourceToKey = 0;
int g_cachedScaleLookbackDays = -999;
int g_cachedSourceBars = 0;
int g_cachedDayCount = 0;
int g_cachedValidQDays = 0;
datetime g_cachedResolvedStart = 0;
datetime g_cachedResolvedEnd = 0;
datetime g_cachedAnchorTimes[];
double g_cachedAnchorValues[];
bool g_cacheValid = false;

int DayKey(const datetime value)
{
   MqlDateTime parts;
   TimeToStruct(value, parts);
   return parts.year * 10000 + parts.mon * 100 + parts.day;
}

void ChartTimeRange(const datetime &time[], const int rates_total, datetime &oldest, datetime &newest)
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

datetime SourceStartForChart(const datetime chart_oldest)
{
   int horizon = MathMax(0, ScaleLookbackDays);
   if(horizon == 0)
      return (datetime)0;

   int warmup_days = MathMax(14, horizon * 3 + 14);
   long start = (long)chart_oldest - (long)warmup_days * 86400;
   if(start < 0)
      return (datetime)0;

   return (datetime)start;
}

int ChronIndex(const int total, const bool series, const int logical_index)
{
   if(series)
      return total - 1 - logical_index;
   return logical_index;
}

datetime SourceToCacheKey(const datetime source_to)
{
   datetime latest = iTime(_Symbol, LRMG_V2_SOURCE_TIMEFRAME, 1);
   if(latest > 0)
      return latest;

   return source_to;
}

bool CacheMatches(const datetime source_from, const datetime source_to_key)
{
   return g_cacheValid &&
      g_cachedSourceFrom == source_from &&
      g_cachedSourceToKey == source_to_key &&
      g_cachedScaleLookbackDays == ScaleLookbackDays &&
      ArraySize(g_cachedAnchorTimes) > 0 &&
      ArraySize(g_cachedAnchorValues) > 0;
}

void StoreCache(
   const datetime source_from,
   const datetime source_to_key,
   const int source_bars,
   const int day_count,
   const int valid_q_days,
   const datetime resolved_start,
   const datetime resolved_end,
   const datetime &anchor_times[],
   const double &anchor_values[]
)
{
   g_cachedSourceFrom = source_from;
   g_cachedSourceToKey = source_to_key;
   g_cachedScaleLookbackDays = ScaleLookbackDays;
   g_cachedSourceBars = source_bars;
   g_cachedDayCount = day_count;
   g_cachedValidQDays = valid_q_days;
   g_cachedResolvedStart = resolved_start;
   g_cachedResolvedEnd = resolved_end;

   int anchor_count = ArraySize(anchor_times);
   ArrayResize(g_cachedAnchorTimes, anchor_count);
   ArrayResize(g_cachedAnchorValues, anchor_count);
   for(int i = 0; i < anchor_count; i++)
   {
      g_cachedAnchorTimes[i] = anchor_times[i];
      g_cachedAnchorValues[i] = anchor_values[i];
   }

   g_cacheValid = anchor_count > 0;
}

void AppendDayRecord(
   LrmgDayRecord &days[],
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

int BuildDayRecords(const MqlRates &source_rates[], const int source_count, LrmgDayRecord &days[])
{
   ArrayResize(days, 0);
   if(source_count <= 0)
      return 0;

   int day_count = 0;
   int day_capacity = 0;
   int active_key = DayKey(source_rates[0].time);
   int start_index = 0;

   for(int i = 1; i < source_count; i++)
   {
      int key = DayKey(source_rates[i].time);
      if(key == active_key)
         continue;

      AppendDayRecord(
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

   AppendDayRecord(
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

double EffectiveQForDay(const LrmgDayRecord &days[], const int day_index)
{
   int horizon = MathMax(0, ScaleLookbackDays);
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

   return MedianValues(samples, sample_count);
}

int ComputeDailyQ(
   LrmgDayRecord &days[],
   const int day_count,
   const datetime &source_times[],
   const double &source_closes[]
)
{
   int valid_count = 0;

   for(int d = 0; d < day_count; d++)
   {
      days[d].complete = (d < day_count - 1);
      days[d].valid_q = false;
      days[d].q_day = 0.0;
      days[d].q_effective = 0.0;

      if(!days[d].complete || days[d].bar_count < LRMG_V2_MIN_DAY_BARS)
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
      days[d].q_effective = EffectiveQForDay(days, d);

   return valid_count;
}

void AppendEventPrice(double &events[], int &count, int &capacity, const double price)
{
   if(count >= capacity)
   {
      capacity = capacity <= 0 ? 256 : capacity * 2;
      ArrayResize(events, capacity);
   }

   events[count] = price;
   count++;
}

double MedianRecentEventPrice(const double &events[], const int count)
{
   if(count <= 0)
      return 0.0;

   int start_index = MathMax(0, count - LRMG_V2_LINE_EVENT_WINDOW);
   int sample_count = count - start_index;
   double samples[];
   ArrayResize(samples, sample_count);

   for(int i = 0; i < sample_count; i++)
      samples[i] = events[start_index + i];

   return MedianValues(samples, sample_count);
}

bool BuildV2Series(
   const MqlRates &source_rates[],
   const int source_count,
   datetime &anchor_times[],
   double &anchor_values[],
   int &day_count,
   int &valid_q_day_count
)
{
   ArrayResize(anchor_times, 0);
   ArrayResize(anchor_values, 0);
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

   LrmgDayRecord days[];
   day_count = BuildDayRecords(source_rates, source_count, days);
   if(day_count <= 1)
      return false;

   valid_q_day_count = ComputeDailyQ(days, day_count, source_times, source_closes);

   ArrayResize(anchor_times, source_count);
   ArrayResize(anchor_values, source_count);
   for(int i = 0; i < source_count; i++)
   {
      anchor_times[i] = source_rates[i].time;
      anchor_values[i] = EMPTY_VALUE;
   }

   bool has_phase = false;
   bool has_confirmed_event = false;
   double base_price = 0.0;
   double last_event_price = 0.0;
   double median_event_price = 0.0;
   int current_level = 0;
   double closed_events[];
   int closed_event_count = 0;
   int closed_event_capacity = 0;
   int last_median_count = -1;

   for(int d = 0; d < day_count; d++)
   {
      double q = days[d].q_effective;
      if(q <= 0.0)
         continue;

      if(has_confirmed_event)
         base_price = last_event_price;
      else
         base_price = source_rates[days[d].start_index].close;

      current_level = 0;
      has_phase = true;

      for(int i = days[d].start_index; i <= days[d].end_index; i++)
      {
         int guard = 0;
         while(source_rates[i].close >= base_price + ((double)current_level + 1.0) * q && guard < LRMG_V2_MAX_BRICKS_PER_BAR)
         {
            current_level++;
            double event_price = base_price + (double)current_level * q;
            AppendEventPrice(closed_events, closed_event_count, closed_event_capacity, event_price);
            last_event_price = event_price;
            has_confirmed_event = true;
            guard++;
         }

         guard = 0;
         while(source_rates[i].close <= base_price + ((double)current_level - 1.0) * q && guard < LRMG_V2_MAX_BRICKS_PER_BAR)
         {
            current_level--;
            double event_price = base_price + (double)current_level * q;
            AppendEventPrice(closed_events, closed_event_count, closed_event_capacity, event_price);
            last_event_price = event_price;
            has_confirmed_event = true;
            guard++;
         }

         if(closed_event_count != last_median_count)
         {
            median_event_price = MedianRecentEventPrice(closed_events, closed_event_count);
            last_median_count = closed_event_count;
         }

         if(closed_event_count > 0)
            anchor_values[i] = median_event_price;
         else if(has_phase)
            anchor_values[i] = base_price;
      }
   }

   return true;
}

void ProjectAnchorsToChart(
   const datetime &time[],
   const int rates_total,
   const bool chart_series,
   const datetime &anchor_times[],
   const double &anchor_values[]
)
{
   int anchor_count = ArraySize(anchor_times);
   if(anchor_count <= 0)
      return;

   int anchor_index = 0;
   for(int logical = 0; logical < rates_total; logical++)
   {
      int idx = ChronIndex(rates_total, chart_series, logical);
      datetime bar_time = time[idx];

      while(anchor_index + 1 < anchor_count && anchor_times[anchor_index + 1] <= bar_time)
         anchor_index++;

      if(anchor_times[anchor_index] <= bar_time && anchor_values[anchor_index] != EMPTY_VALUE)
         V2Buffer[idx] = anchor_values[anchor_index];
   }
}

int OnInit()
{
   SetIndexBuffer(0, V2Buffer, INDICATOR_DATA);
   PlotIndexSetDouble(0, PLOT_EMPTY_VALUE, EMPTY_VALUE);
   IndicatorSetString(INDICATOR_SHORTNAME, "LRMG Price Line");
   IndicatorSetInteger(INDICATOR_DIGITS, _Digits);
   return INIT_SUCCEEDED;
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
   for(int i = 0; i < rates_total; i++)
      V2Buffer[i] = EMPTY_VALUE;

   if(rates_total < 50)
      return rates_total;

   datetime chart_oldest = 0;
   datetime chart_newest = 0;
   ChartTimeRange(time, rates_total, chart_oldest, chart_newest);
   if(chart_oldest <= 0 || chart_newest <= 0)
      return rates_total;

   datetime source_from = SourceStartForChart(chart_oldest);
   datetime source_to = TimeCurrent();
   if(source_to < chart_newest)
      source_to = chart_newest;

   if(source_to <= source_from)
      return rates_total;

   datetime source_to_key = SourceToCacheKey(source_to);
   bool used_cache = CacheMatches(source_from, source_to_key);
   if(used_cache)
   {
      ProjectAnchorsToChart(time, rates_total, ArrayGetAsSeries(time), g_cachedAnchorTimes, g_cachedAnchorValues);

      if(ShowDebugComment)
      {
         Comment(
            "LRMG Price Line\n",
            "q horizon days: ", IntegerToString(MathMax(0, ScaleLookbackDays)), "\n",
            "source: PERIOD_M1, completed broker/server days\n",
            "available start: ", TimeToString(g_cachedResolvedStart, TIME_DATE | TIME_MINUTES), "\n",
            "resolved end: ", TimeToString(g_cachedResolvedEnd, TIME_DATE | TIME_MINUTES), "\n",
            "source bars: ", IntegerToString(g_cachedSourceBars), "\n",
            "days: ", IntegerToString(g_cachedDayCount), " valid q days: ", IntegerToString(g_cachedValidQDays), "\n",
            "cache: hit"
         );
      }

      return rates_total;
   }

   MqlRates source_rates[];
   ArraySetAsSeries(source_rates, false);
   ResetLastError();
   int copied = CopyRates(_Symbol, LRMG_V2_SOURCE_TIMEFRAME, source_from, source_to, source_rates);
   int copy_error = GetLastError();

   if(copied < 100)
   {
      if(ShowDebugComment)
      {
         Comment(
            "LRMG Price Line\n",
            "M1 data unavailable or too short\n",
            "copied: ", IntegerToString(copied), "\n",
            "error: ", IntegerToString(copy_error)
         );
      }
      return rates_total;
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

   if(copied > 1)
   {
      copied--;
      ArrayResize(source_rates, copied);
   }

   datetime anchor_times[];
   double anchor_values[];
   int day_count = 0;
   int valid_q_days = 0;
   if(!BuildV2Series(source_rates, copied, anchor_times, anchor_values, day_count, valid_q_days))
      return rates_total;

   StoreCache(
      source_from,
      source_to_key,
      copied,
      day_count,
      valid_q_days,
      source_rates[0].time,
      source_rates[copied - 1].time,
      anchor_times,
      anchor_values
   );

   ProjectAnchorsToChart(time, rates_total, ArrayGetAsSeries(time), anchor_times, anchor_values);

   if(ShowDebugComment)
   {
      Comment(
         "LRMG Price Line\n",
         "q horizon days: ", IntegerToString(MathMax(0, ScaleLookbackDays)), "\n",
         "source: PERIOD_M1, completed broker/server days\n",
         "available start: ", TimeToString(source_rates[0].time, TIME_DATE | TIME_MINUTES), "\n",
         "resolved end: ", TimeToString(source_rates[copied - 1].time, TIME_DATE | TIME_MINUTES), "\n",
         "source bars: ", IntegerToString(copied), "\n",
         "days: ", IntegerToString(day_count), " valid q days: ", IntegerToString(valid_q_days), "\n",
         "cache: rebuilt"
      );
   }

   return rates_total;
}
