//+------------------------------------------------------------------+
//|                                                TrendState.mq5    |
//|               LRMG event-based trend-state ribbon                |
//+------------------------------------------------------------------+
#property copyright "LIMNI LTD"
#property version   "1.10"
#property indicator_separate_window
#property indicator_buffers 2
#property indicator_plots 1
#property indicator_minimum -1.2
#property indicator_maximum 1.2

#property indicator_label1 "Trend State"
#property indicator_type1 DRAW_COLOR_HISTOGRAM
#property indicator_color1 clrLimeGreen,clrTomato,clrSilver
#property indicator_style1 STYLE_SOLID
#property indicator_width1 4

#include "..\\Include\\LimniLRMGStackCore.mqh"

input int ScaleLookbackDays = 0; // 0 = all prior completed days
input bool ShowDebugComment = false;

double StateBuffer[];
double StateColorBuffer[];

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

void ProjectStateColorToChart(
   const datetime &time[],
   const int rates_total,
   const bool chart_series,
   const datetime &source_times[],
   const int &source_state[],
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

      if(source_times[source_index] <= bar_time)
      {
         if(source_state[source_index] > 0)
            target_buffer[idx] = 0.0;
         else if(source_state[source_index] < 0)
            target_buffer[idx] = 1.0;
         else
            target_buffer[idx] = 2.0;
      }
   }
}

int OnInit()
{
   SetIndexBuffer(0, StateBuffer, INDICATOR_DATA);
   SetIndexBuffer(1, StateColorBuffer, INDICATOR_COLOR_INDEX);
   PlotIndexSetDouble(0, PLOT_EMPTY_VALUE, EMPTY_VALUE);
   IndicatorSetString(INDICATOR_SHORTNAME, "Trend State");
   IndicatorSetInteger(INDICATOR_DIGITS, 0);
   IndicatorSetInteger(INDICATOR_LEVELS, 3);
   IndicatorSetDouble(INDICATOR_LEVELVALUE, 0, 1.0);
   IndicatorSetDouble(INDICATOR_LEVELVALUE, 1, 0.0);
   IndicatorSetDouble(INDICATOR_LEVELVALUE, 2, -1.0);
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
      LimniClearDoubleBuffer(StateBuffer, rates_total);
      LimniFillDoubleBuffer(StateColorBuffer, rates_total, 2.0);
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

   bool chart_series = ArrayGetAsSeries(time);
   double next_state_buffer[];
   double next_color_buffer[];
   ArrayResize(next_state_buffer, rates_total);
   ArrayResize(next_color_buffer, rates_total);
   LimniClearDoubleBuffer(next_state_buffer, rates_total);
   LimniFillDoubleBuffer(next_color_buffer, rates_total, 2.0);
   LimniProjectDoubleToChart(time, rates_total, chart_series, source_times, source_ma, next_state_buffer);
   ProjectStateColorToChart(time, rates_total, chart_series, source_times, source_ma_state, next_color_buffer);
   LimniCopyDoubleBuffer(next_state_buffer, StateBuffer, rates_total);
   LimniCopyDoubleBuffer(next_color_buffer, StateColorBuffer, rates_total);

   if(ShowDebugComment)
   {
      Comment(
         "Trend State\n",
         "q horizon days: ", IntegerToString(MathMax(0, ScaleLookbackDays)), "\n",
         "source bars: ", IntegerToString(copied), "\n",
         "days: ", IntegerToString(day_count), " valid q days: ", IntegerToString(valid_q_day_count)
      );
   }

   return rates_total;
}
