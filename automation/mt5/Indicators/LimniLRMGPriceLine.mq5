//+------------------------------------------------------------------+
//|                                          LimniLRMGPriceLine.mq5  |
//|                 LRMG closed-brick median anchor on price charts  |
//+------------------------------------------------------------------+
#property copyright "LIMNI LTD"
#property version   "1.04"
#property indicator_chart_window
#property indicator_buffers 1
#property indicator_plots 1

#property indicator_label1 "LRMG Price Anchor"
#property indicator_type1 DRAW_LINE
#property indicator_color1 clrDeepSkyBlue
#property indicator_style1 STYLE_SOLID
#property indicator_width1 2

#include "Include\\LimniRadialMovementGrid.mqh"

input ENUM_TIMEFRAMES SourceTimeframe = PERIOD_M1;
input string AnchorStartDate = "2014.01.01 00:00"; // fixed M1 anchor start; blank = chart oldest bar
input string EndDate = ""; // blank = current server time
input int LookbackBars = 0; // optional safety cap after date-range copy; 0 = no cap
input int BootstrapBars = 720;
input bool UseClosedSourceBarsOnly = true;
input int MedianBrickWindow = 55;
input int MaxBricksPerBar = 200;
input bool ShowDebugComment = false;

double AnchorBuffer[];

bool IsBlank(const string value)
{
   return StringLen(value) == 0;
}

datetime ParseInputDate(const string value, const datetime fallback)
{
   if(IsBlank(value))
      return fallback;

   datetime parsed = StringToTime(value);
   if(parsed <= 0)
      return fallback;

   return parsed;
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

bool SeriesFirstDate(const ENUM_TIMEFRAMES period, datetime &first_date)
{
   long raw = 0;
   if(!SeriesInfoInteger(_Symbol, period, SERIES_FIRSTDATE, raw) || raw <= 0)
      return false;

   first_date = (datetime)raw;
   return true;
}

void ApplyLookbackCap(MqlRates &rates[], int &count)
{
   if(LookbackBars <= 0 || count <= LookbackBars)
      return;

   int capped = MathMax(50, LookbackBars);
   if(count <= capped)
      return;

   MqlRates trimmed[];
   ArrayResize(trimmed, capped);
   int start = count - capped;
   for(int i = 0; i < capped; i++)
      trimmed[i] = rates[start + i];

   ArrayResize(rates, capped);
   for(int i = 0; i < capped; i++)
      rates[i] = trimmed[i];

   count = capped;
}

int ChronIndex(const int total, const bool series, const int logical_index)
{
   if(series)
      return total - 1 - logical_index;
   return logical_index;
}

double MedianBrickLevel(const double &levels[], const int count, const int window)
{
   if(count <= 0)
      return 0.0;

   int start_index = 0;
   if(window > 0)
      start_index = MathMax(0, count - window);

   int sample_count = count - start_index;
   if(sample_count <= 0)
      return 0.0;

   double values[];
   ArrayResize(values, sample_count);
   for(int i = 0; i < sample_count; i++)
      values[i] = levels[start_index + i];

   ArraySort(values);
   int mid = sample_count / 2;
   if((sample_count % 2) == 1)
      return values[mid];

   return (values[mid - 1] + values[mid]) / 2.0;
}

void AppendClosedLevel(double &levels[], int &count, const double level)
{
   ArrayResize(levels, count + 1);
   levels[count] = level;
   count++;
}

bool BuildAnchorSeries(
   const MqlRates &source_rates[],
   const int source_count,
   datetime &anchor_times[],
   double &anchor_values[]
)
{
   ArrayResize(anchor_times, 0);
   ArrayResize(anchor_values, 0);

   if(source_count < MathMax(50, BootstrapBars + 5))
      return false;

   datetime calc_time[];
   double calc_close[];
   ArrayResize(calc_time, source_count);
   ArrayResize(calc_close, source_count);

   for(int i = 0; i < source_count; i++)
   {
      calc_time[i] = source_rates[i].time;
      calc_close[i] = source_rates[i].close;
   }

   int bootstrap_end = MathMin(source_count - 1, MathMax(10, BootstrapBars) - 1);
   LimniRadialMap bootstrap;
   if(!LimniComputeMovementMap(calc_time, calc_close, 0, bootstrap_end, true, bootstrap))
      return false;

   double q = bootstrap.radius;
   if(q <= 0.0)
      return false;

   double base_price = source_rates[0].close;
   int current_level = 0;
   double closed_levels[];
   int closed_level_count = 0;
   int max_bricks = MathMax(1, MaxBricksPerBar);

   ArrayResize(anchor_times, source_count);
   ArrayResize(anchor_values, source_count);

   for(int i = 0; i < source_count; i++)
   {
      int guard = 0;
      while(source_rates[i].close >= base_price + ((double)current_level + 1.0) * q && guard < max_bricks)
      {
         current_level++;
         AppendClosedLevel(closed_levels, closed_level_count, (double)current_level);
         guard++;
      }

      guard = 0;
      while(source_rates[i].close <= base_price + ((double)current_level - 1.0) * q && guard < max_bricks)
      {
         current_level--;
         AppendClosedLevel(closed_levels, closed_level_count, (double)current_level);
         guard++;
      }

      double median_level = MedianBrickLevel(closed_levels, closed_level_count, MedianBrickWindow);
      anchor_times[i] = source_rates[i].time;
      anchor_values[i] = base_price + median_level * q;
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

      if(anchor_times[anchor_index] <= bar_time)
         AnchorBuffer[idx] = anchor_values[anchor_index];
   }
}

int OnInit()
{
   SetIndexBuffer(0, AnchorBuffer, INDICATOR_DATA);
   PlotIndexSetDouble(0, PLOT_EMPTY_VALUE, EMPTY_VALUE);
   IndicatorSetString(INDICATOR_SHORTNAME, "LRMG Price Anchor");
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
      AnchorBuffer[i] = EMPTY_VALUE;

   if(rates_total < 50)
      return rates_total;

   ENUM_TIMEFRAMES source_period = SourceTimeframe;
   if(source_period == PERIOD_CURRENT)
      source_period = PERIOD_M1;

   datetime chart_oldest = 0;
   datetime chart_newest = 0;
   ChartTimeRange(time, rates_total, chart_oldest, chart_newest);
   if(chart_oldest <= 0 || chart_newest <= 0)
      return rates_total;

   datetime source_from = ParseInputDate(AnchorStartDate, chart_oldest);
   datetime source_to = ParseInputDate(EndDate, TimeCurrent());
   if(source_to < chart_newest)
      source_to = chart_newest;

   datetime local_first = 0;
   if(SeriesFirstDate(source_period, local_first) && local_first > source_from)
      source_from = local_first;

   if(source_to <= source_from)
      return rates_total;

   MqlRates source_rates[];
   ArraySetAsSeries(source_rates, false);
   ResetLastError();
   int copied = CopyRates(_Symbol, source_period, source_from, source_to, source_rates);
   int copy_error = GetLastError();
   if(copied < 50)
   {
      if(ShowDebugComment)
      {
         Comment(
            "LRMG Price Anchor\n",
            "M1/date-range data unavailable or too short\n",
            "requested: ", TimeToString(source_from, TIME_DATE | TIME_MINUTES),
            " -> ", TimeToString(source_to, TIME_DATE | TIME_MINUTES), "\n",
            "copied: ", IntegerToString(copied), "\n",
            "error: ", IntegerToString(copy_error), "\n",
            "terminal max bars: ", IntegerToString((int)TerminalInfoInteger(TERMINAL_MAXBARS))
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

   ApplyLookbackCap(source_rates, copied);

   if(UseClosedSourceBarsOnly && copied > 1)
      copied--;

   datetime anchor_times[];
   double anchor_values[];
   if(!BuildAnchorSeries(source_rates, copied, anchor_times, anchor_values))
      return rates_total;

   bool chart_series = ArrayGetAsSeries(time);
   ProjectAnchorsToChart(time, rates_total, chart_series, anchor_times, anchor_values);

   if(ShowDebugComment)
   {
      Comment(
         "LRMG Price Anchor\n",
         "calculation: ", EnumToString(source_period), "\n",
         "anchor start: ", TimeToString(source_rates[0].time, TIME_DATE | TIME_MINUTES), "\n",
         "anchor end: ", TimeToString(source_rates[copied - 1].time, TIME_DATE | TIME_MINUTES), "\n",
         "copied source bars: ", IntegerToString(copied), "\n",
         "chart oldest: ", TimeToString(chart_oldest, TIME_DATE | TIME_MINUTES), "\n",
         "chart newest: ", TimeToString(chart_newest, TIME_DATE | TIME_MINUTES), "\n",
         "terminal max bars: ", IntegerToString((int)TerminalInfoInteger(TERMINAL_MAXBARS))
      );
   }

   return rates_total;
}
