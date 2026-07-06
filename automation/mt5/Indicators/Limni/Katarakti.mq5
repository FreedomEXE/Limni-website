//+------------------------------------------------------------------+
//|                                             Katarakti.mq5        |
//|             LRMG Katarakti-style sweep/reclaim markers           |
//+------------------------------------------------------------------+
#property copyright "LIMNI LTD"
#property version   "1.10"
#property indicator_chart_window
#property indicator_buffers 2
#property indicator_plots 2

#property indicator_label1 "Katarakti Up"
#property indicator_type1 DRAW_ARROW
#property indicator_color1 clrLimeGreen
#property indicator_width1 2

#property indicator_label2 "Katarakti Down"
#property indicator_type2 DRAW_ARROW
#property indicator_color2 clrTomato
#property indicator_width2 2

#include "..\\Include\\LimniLRMGStackCore.mqh"

input int ScaleLookbackDays = 0; // 0 = all prior completed days
input bool ShowDebugComment = false;

double KtrUpBuffer[];
double KtrDownBuffer[];

bool LoadStackSeries(
   const datetime chart_oldest,
   const datetime chart_newest,
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
   return LimniLoadCachedStackSeries(
      chart_oldest,
      chart_newest,
      ScaleLookbackDays,
      _Point,
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
}

void ProjectTriggersToChart(
   const datetime &time[],
   const int rates_total,
   const bool chart_series,
   const datetime &source_times[],
   const double &source_closes[],
   const double &source_q[],
   const int &source_trigger[],
   double &up_buffer[],
   double &down_buffer[]
)
{
   int source_count = ArraySize(source_times);
   if(source_count <= 0)
      return;

   int chart_logical = 0;
   int chart_idx = LimniChronIndex(rates_total, chart_series, chart_logical);

   for(int i = 0; i < source_count; i++)
   {
      if(source_trigger[i] == 0)
         continue;

      datetime source_time = source_times[i];
      while(chart_logical + 1 < rates_total)
      {
         int next_idx = LimniChronIndex(rates_total, chart_series, chart_logical + 1);
         if(time[next_idx] > source_time)
            break;

         chart_logical++;
         chart_idx = next_idx;
      }

      if(time[chart_idx] > source_time)
         continue;

      double q = source_q[i] > 0.0 ? source_q[i] : _Point * 10.0;
      double offset = MathMax(q * 0.35, _Point * 5.0);

      if(source_trigger[i] > 0)
         up_buffer[chart_idx] = source_closes[i] - offset;
      else if(source_trigger[i] < 0)
         down_buffer[chart_idx] = source_closes[i] + offset;
   }
}

int OnInit()
{
   SetIndexBuffer(0, KtrUpBuffer, INDICATOR_DATA);
   SetIndexBuffer(1, KtrDownBuffer, INDICATOR_DATA);
   PlotIndexSetDouble(0, PLOT_EMPTY_VALUE, EMPTY_VALUE);
   PlotIndexSetDouble(1, PLOT_EMPTY_VALUE, EMPTY_VALUE);
   PlotIndexSetInteger(0, PLOT_ARROW, 233);
   PlotIndexSetInteger(1, PLOT_ARROW, 234);
   IndicatorSetString(INDICATOR_SHORTNAME, "Katarakti");
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
   if(prev_calculated <= 0)
   {
      LimniClearDoubleBuffer(KtrUpBuffer, rates_total);
      LimniClearDoubleBuffer(KtrDownBuffer, rates_total);
   }

   datetime chart_oldest = 0;
   datetime chart_newest = 0;
   LimniChartTimeRange(time, rates_total, chart_oldest, chart_newest);
   if(chart_oldest <= 0 || chart_newest <= 0)
      return rates_total;

   datetime source_times[];
   double source_closes[];
   double source_q[];
   double source_line[];
   double source_stoch[];
   double source_ma[];
   int source_ma_state[];
   int source_trigger[];
   int copied = 0;
   int day_count = 0;
   int valid_q_day_count = 0;

   if(!LoadStackSeries(
      chart_oldest,
      chart_newest,
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
   ))
   {
      return rates_total;
   }

   double next_up_buffer[];
   double next_down_buffer[];
   ArrayResize(next_up_buffer, rates_total);
   ArrayResize(next_down_buffer, rates_total);
   LimniClearDoubleBuffer(next_up_buffer, rates_total);
   LimniClearDoubleBuffer(next_down_buffer, rates_total);

   ProjectTriggersToChart(
      time,
      rates_total,
      ArrayGetAsSeries(time),
      source_times,
      source_closes,
      source_q,
      source_trigger,
      next_up_buffer,
      next_down_buffer
   );
   LimniCopyDoubleBuffer(next_up_buffer, KtrUpBuffer, rates_total);
   LimniCopyDoubleBuffer(next_down_buffer, KtrDownBuffer, rates_total);

   if(ShowDebugComment)
   {
      Comment(
         "Katarakti\n",
         "q horizon days: ", IntegerToString(MathMax(0, ScaleLookbackDays)), "\n",
         "source bars: ", IntegerToString(copied), "\n",
         "days: ", IntegerToString(day_count), " valid q days: ", IntegerToString(valid_q_day_count)
      );
   }

   return rates_total;
}
