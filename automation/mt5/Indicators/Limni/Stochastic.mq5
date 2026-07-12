//+------------------------------------------------------------------+
//|                                             Stochastic.mq5       |
//|             LRMG event-range stochastic oscillator               |
//+------------------------------------------------------------------+
#property copyright "LIMNI LTD"
#property version   "1.16"
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
input int VisualMaxM1Bars = 0; // 0 = all available closed M1 bars
input bool ShowDebugComment = false;

const int STOCHASTIC_MAX_INCREMENTAL_PROJECT_BARS = 50000;

double StochBuffer[];

datetime g_stack_cache_from = 0;
datetime g_stack_latest_closed_m1 = 0;
bool g_stack_ready = false;
int g_stack_scale_lookback_days = -999;
int g_stack_visual_max_m1_bars = -999;
double g_stack_point = 0.0;
datetime g_projected_chart_oldest = 0;
datetime g_projected_chart_newest = 0;
datetime g_source_times[];
double g_source_closes[];
double g_source_q[];
double g_source_line[];
double g_source_stoch[];
double g_source_ma[];
int g_source_ma_state[];
int g_source_trigger[];
int g_stack_copied = 0;
int g_stack_day_count = 0;
int g_stack_valid_q_day_count = 0;
uint g_last_debug_update_ms = 0;
string g_stack_failure_reason = "";
string g_last_logged_stack_failure_reason = "";

datetime LatestClosedM1()
{
   datetime latest_closed_m1 = iTime(_Symbol, PERIOD_M1, 1);
   if(latest_closed_m1 <= 0)
      latest_closed_m1 = TimeCurrent();
   return latest_closed_m1;
}

bool EnsureStackCache(
   const datetime chart_oldest,
   const datetime chart_newest,
   bool &refreshed
)
{
   refreshed = false;
   datetime latest_closed_m1 = LatestClosedM1();
   if(g_stack_ready &&
      g_stack_scale_lookback_days == ScaleLookbackDays &&
      g_stack_visual_max_m1_bars == MathMax(0, VisualMaxM1Bars) &&
      g_stack_point == _Point &&
      g_stack_latest_closed_m1 == latest_closed_m1 &&
      LimniSourceSeriesCoversChart(g_source_times, chart_oldest))
   {
      return true;
   }

   int visual_max_m1_bars = MathMax(0, VisualMaxM1Bars);
   double direct_point = _Point;
   if(direct_point <= 0.0)
      direct_point = SymbolInfoDouble(_Symbol, SYMBOL_POINT);

   string reason = "";
   bool stack_ok = LimniLoadVisualStackSeries(
      chart_oldest,
      chart_newest,
      ScaleLookbackDays,
      visual_max_m1_bars,
      direct_point,
      g_source_times,
      g_source_closes,
      g_source_q,
      g_source_line,
      g_source_stoch,
      g_source_ma,
      g_source_ma_state,
      g_source_trigger,
      g_stack_copied,
      g_stack_day_count,
      g_stack_valid_q_day_count,
      reason
   );
   if(!stack_ok || ArraySize(g_source_times) <= 0)
   {
      g_stack_failure_reason = reason == "" ? "visual_stack_empty" : reason;
      if(g_stack_failure_reason != g_last_logged_stack_failure_reason)
      {
         Print("Limni Stochastic visual stack unavailable: ", g_stack_failure_reason);
         g_last_logged_stack_failure_reason = g_stack_failure_reason;
      }
      if(ShowDebugComment)
         Comment("Stochastic\n", g_stack_failure_reason);
      if(g_stack_ready && ArraySize(g_source_times) > 0)
         return true;
      return false;
   }

   datetime snapshot_latest = g_source_times[ArraySize(g_source_times) - 1];
   g_stack_cache_from = chart_oldest;
   g_stack_latest_closed_m1 = snapshot_latest;
   g_stack_scale_lookback_days = ScaleLookbackDays;
   g_stack_visual_max_m1_bars = visual_max_m1_bars;
   g_stack_point = direct_point;
   g_stack_ready = true;
   g_stack_failure_reason = "";
   refreshed = true;
   return true;
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
   LimniChartTimeRangeFast(time, rates_total, chart_oldest, chart_newest);
   if(chart_oldest <= 0 || chart_newest <= 0)
      return rates_total;

   bool refreshed = false;
   if(!EnsureStackCache(
      chart_oldest,
      chart_newest,
      refreshed
   ))
   {
      return 0;
   }

   int limit = refreshed ?
      rates_total :
      LimniStableProjectionLimit(
         rates_total,
         prev_calculated,
         chart_oldest,
         chart_newest,
         g_projected_chart_oldest,
         g_projected_chart_newest,
         STOCHASTIC_MAX_INCREMENTAL_PROJECT_BARS
      );
   if(limit == rates_total)
      LimniClearDoubleBuffer(StochBuffer, rates_total);

   LimniProjectDoubleToChartLimit(
      time,
      rates_total,
      ArrayGetAsSeries(time),
      g_source_times,
      g_source_stoch,
      StochBuffer,
      limit
   );
   g_projected_chart_oldest = chart_oldest;
   g_projected_chart_newest = chart_newest;

   if(ShowDebugComment)
   {
      uint now = GetTickCount();
      if(refreshed || g_last_debug_update_ms == 0 || now - g_last_debug_update_ms >= 1000)
      {
         Comment(
            "Stochastic\n",
            "q horizon days: ", IntegerToString(MathMax(0, ScaleLookbackDays)), "\n",
            "visual max M1 bars: ", IntegerToString(MathMax(0, VisualMaxM1Bars)), "\n",
            "source bars: ", IntegerToString(g_stack_copied), "\n",
            "days: ", IntegerToString(g_stack_day_count),
            " valid q days: ", IntegerToString(g_stack_valid_q_day_count)
         );
         g_last_debug_update_ms = now;
      }
   }

   return rates_total;
}
