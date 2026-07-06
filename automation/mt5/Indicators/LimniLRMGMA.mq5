//+------------------------------------------------------------------+
//|                                                LimniLRMGMA.mq5   |
//|               LRMG event-price moving state line                 |
//+------------------------------------------------------------------+
#property copyright "LIMNI LTD"
#property version   "1.00"
#property indicator_chart_window
#property indicator_buffers 2
#property indicator_plots 1

#property indicator_label1 "LRMG MA"
#property indicator_type1 DRAW_COLOR_LINE
#property indicator_color1 clrLimeGreen,clrTomato,clrSilver
#property indicator_style1 STYLE_SOLID
#property indicator_width1 2

#include "Include\\LimniLRMGStackCore.mqh"

input int ScaleLookbackDays = 20; // 0 = all prior completed days
input bool ShowDebugComment = false;

double MaBuffer[];
double MaColorBuffer[];

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

void ProjectMaColorToChart(
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
   SetIndexBuffer(0, MaBuffer, INDICATOR_DATA);
   SetIndexBuffer(1, MaColorBuffer, INDICATOR_COLOR_INDEX);
   PlotIndexSetDouble(0, PLOT_EMPTY_VALUE, EMPTY_VALUE);
   IndicatorSetString(INDICATOR_SHORTNAME, "LRMG MA");
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
   {
      MaBuffer[i] = EMPTY_VALUE;
      MaColorBuffer[i] = 2.0;
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
   LimniProjectDoubleToChart(time, rates_total, chart_series, source_times, source_ma, MaBuffer);
   ProjectMaColorToChart(time, rates_total, chart_series, source_times, source_ma_state, MaColorBuffer);

   if(ShowDebugComment)
   {
      Comment(
         "LRMG MA\n",
         "q horizon days: ", IntegerToString(MathMax(0, ScaleLookbackDays)), "\n",
         "source bars: ", IntegerToString(copied), "\n",
         "days: ", IntegerToString(day_count), " valid q days: ", IntegerToString(valid_q_day_count)
      );
   }

   return rates_total;
}
