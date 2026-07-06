//+------------------------------------------------------------------+
//|                                             Stochastic.mq5       |
//|             LRMG event-range stochastic oscillator               |
//+------------------------------------------------------------------+
#property copyright "LIMNI LTD"
#property version   "1.00"
#property indicator_separate_window
#property indicator_buffers 1
#property indicator_plots 1
#property indicator_minimum 0
#property indicator_maximum 100
#property indicator_level1 20
#property indicator_level2 80

#property indicator_label1 "Stochastic"
#property indicator_type1 DRAW_LINE
#property indicator_color1 clrDeepSkyBlue
#property indicator_style1 STYLE_SOLID
#property indicator_width1 2

#include "..\\Include\\LimniLRMGStackCore.mqh"

input int ScaleLookbackDays = 0; // 0 = all prior completed days
input bool ShowDebugComment = false;

double StochBuffer[];

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

int OnInit()
{
   SetIndexBuffer(0, StochBuffer, INDICATOR_DATA);
   PlotIndexSetDouble(0, PLOT_EMPTY_VALUE, EMPTY_VALUE);
   IndicatorSetString(INDICATOR_SHORTNAME, "Stochastic");
   IndicatorSetInteger(INDICATOR_DIGITS, 2);
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
      LimniClearDoubleBuffer(StochBuffer, rates_total);

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

   double next_buffer[];
   ArrayResize(next_buffer, rates_total);
   LimniClearDoubleBuffer(next_buffer, rates_total);
   LimniProjectDoubleToChart(time, rates_total, ArrayGetAsSeries(time), source_times, source_stoch, next_buffer);
   LimniCopyDoubleBuffer(next_buffer, StochBuffer, rates_total);

   if(ShowDebugComment)
   {
      Comment(
         "Stochastic\n",
         "q horizon days: ", IntegerToString(MathMax(0, ScaleLookbackDays)), "\n",
         "source bars: ", IntegerToString(copied), "\n",
         "days: ", IntegerToString(day_count), " valid q days: ", IntegerToString(valid_q_day_count)
      );
   }

   return rates_total;
}
