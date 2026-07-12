//+------------------------------------------------------------------+
//|                                             Katarakti.mq5        |
//|             LRMG Katarakti sweep-resolution markers              |
//+------------------------------------------------------------------+
#property copyright "LIMNI LTD"
#property version   "1.20"
#property indicator_chart_window
#property indicator_buffers 4
#property indicator_plots 4

#property indicator_label1 "Katarakti Reversal Buy"
#property indicator_type1 DRAW_ARROW
#property indicator_color1 clrLimeGreen
#property indicator_width1 2

#property indicator_label2 "Katarakti Reversal Sell"
#property indicator_type2 DRAW_ARROW
#property indicator_color2 clrTomato
#property indicator_width2 2

#property indicator_label3 "Katarakti Continuation Buy"
#property indicator_type3 DRAW_ARROW
#property indicator_color3 clrDeepSkyBlue
#property indicator_width3 2

#property indicator_label4 "Katarakti Continuation Sell"
#property indicator_type4 DRAW_ARROW
#property indicator_color4 clrOrange
#property indicator_width4 2

#include "..\\Include\\LimniLRMGStackCore.mqh"

input int ScaleLookbackDays = 0; // 0 = all prior completed days
input bool ShowDebugComment = false;

double KtrReversalBuyBuffer[];
double KtrReversalSellBuffer[];
double KtrContinuationBuyBuffer[];
double KtrContinuationSellBuffer[];

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
   return LimniLoadCachedStackSeriesDetailed(
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

void ProjectTriggersToChart(
   const datetime &time[],
   const int rates_total,
   const bool chart_series,
   const datetime &source_times[],
   const double &source_closes[],
   const double &source_q[],
   const int &source_trigger[],
   double &reversal_buy_buffer[],
   double &reversal_sell_buffer[],
   double &continuation_buy_buffer[],
   double &continuation_sell_buffer[]
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
      double continuation_offset = MathMax(q * 0.65, _Point * 8.0);

      if(source_trigger[i] == LIMNI_KTR_REVERSAL_BUY)
         reversal_buy_buffer[chart_idx] = source_closes[i] - offset;
      else if(source_trigger[i] == LIMNI_KTR_REVERSAL_SELL)
         reversal_sell_buffer[chart_idx] = source_closes[i] + offset;
      else if(source_trigger[i] == LIMNI_KTR_CONTINUATION_BUY)
         continuation_buy_buffer[chart_idx] = source_closes[i] - continuation_offset;
      else if(source_trigger[i] == LIMNI_KTR_CONTINUATION_SELL)
         continuation_sell_buffer[chart_idx] = source_closes[i] + continuation_offset;
   }
}

int OnInit()
{
   SetIndexBuffer(0, KtrReversalBuyBuffer, INDICATOR_DATA);
   SetIndexBuffer(1, KtrReversalSellBuffer, INDICATOR_DATA);
   SetIndexBuffer(2, KtrContinuationBuyBuffer, INDICATOR_DATA);
   SetIndexBuffer(3, KtrContinuationSellBuffer, INDICATOR_DATA);
   PlotIndexSetDouble(0, PLOT_EMPTY_VALUE, EMPTY_VALUE);
   PlotIndexSetDouble(1, PLOT_EMPTY_VALUE, EMPTY_VALUE);
   PlotIndexSetDouble(2, PLOT_EMPTY_VALUE, EMPTY_VALUE);
   PlotIndexSetDouble(3, PLOT_EMPTY_VALUE, EMPTY_VALUE);
   PlotIndexSetInteger(0, PLOT_ARROW, 233);
   PlotIndexSetInteger(1, PLOT_ARROW, 234);
   PlotIndexSetInteger(2, PLOT_ARROW, 241);
   PlotIndexSetInteger(3, PLOT_ARROW, 242);
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
      LimniClearDoubleBuffer(KtrReversalBuyBuffer, rates_total);
      LimniClearDoubleBuffer(KtrReversalSellBuffer, rates_total);
      LimniClearDoubleBuffer(KtrContinuationBuyBuffer, rates_total);
      LimniClearDoubleBuffer(KtrContinuationSellBuffer, rates_total);
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
   int source_trigger_sweep_side[];
   int source_trigger_resolution[];
   int source_trigger_anchor_relation[];
   int source_trigger_trend_relation[];
   int source_trigger_setup_age[];
   double source_trigger_q_distance[];
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
      source_trigger_sweep_side,
      source_trigger_resolution,
      source_trigger_anchor_relation,
      source_trigger_trend_relation,
      source_trigger_setup_age,
      source_trigger_q_distance,
      copied,
      day_count,
      valid_q_day_count
   ))
   {
      return rates_total;
   }

   double next_reversal_buy_buffer[];
   double next_reversal_sell_buffer[];
   double next_continuation_buy_buffer[];
   double next_continuation_sell_buffer[];
   ArrayResize(next_reversal_buy_buffer, rates_total);
   ArrayResize(next_reversal_sell_buffer, rates_total);
   ArrayResize(next_continuation_buy_buffer, rates_total);
   ArrayResize(next_continuation_sell_buffer, rates_total);
   LimniClearDoubleBuffer(next_reversal_buy_buffer, rates_total);
   LimniClearDoubleBuffer(next_reversal_sell_buffer, rates_total);
   LimniClearDoubleBuffer(next_continuation_buy_buffer, rates_total);
   LimniClearDoubleBuffer(next_continuation_sell_buffer, rates_total);

   ProjectTriggersToChart(
      time,
      rates_total,
      ArrayGetAsSeries(time),
      source_times,
      source_closes,
      source_q,
      source_trigger,
      next_reversal_buy_buffer,
      next_reversal_sell_buffer,
      next_continuation_buy_buffer,
      next_continuation_sell_buffer
   );
   LimniCopyDoubleBuffer(next_reversal_buy_buffer, KtrReversalBuyBuffer, rates_total);
   LimniCopyDoubleBuffer(next_reversal_sell_buffer, KtrReversalSellBuffer, rates_total);
   LimniCopyDoubleBuffer(next_continuation_buy_buffer, KtrContinuationBuyBuffer, rates_total);
   LimniCopyDoubleBuffer(next_continuation_sell_buffer, KtrContinuationSellBuffer, rates_total);

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
