//+------------------------------------------------------------------+
//|                                             LimniLRMGZSpace.mq5  |
//|       LRMG study surface: x = real time, y = median distance     |
//+------------------------------------------------------------------+
#property copyright "LIMNI LTD"
#property version   "1.00"
#property indicator_separate_window
#property indicator_buffers 5
#property indicator_plots 1

#property indicator_label1 ""
#property indicator_type1 DRAW_COLOR_CANDLES
#property indicator_color1 clrLime, clrTomato
#property indicator_width1 2

#include "Include\\LimniRadialMovementGrid.mqh"

const int LRMG_MEDIAN_BRICK_WINDOW = 55;
const string LRMG_PREFIX = "LIMNI_LRMG_ZSPACE_";

double ZOpenBuffer[];
double ZHighBuffer[];
double ZLowBuffer[];
double ZCloseBuffer[];
double ZColorBuffer[];

int ChronIndex(const int total, const bool series, const int logical_index)
{
   if(series)
      return total - 1 - logical_index;
   return logical_index;
}

double MedianBrickLevel(const double &levels[], const int end_index)
{
   int start = MathMax(0, end_index - LRMG_MEDIAN_BRICK_WINDOW + 1);
   int count = end_index - start + 1;
   if(count <= 0)
      return 0.0;

   double values[];
   ArrayResize(values, count);
   for(int i = 0; i < count; i++)
      values[i] = levels[start + i];

   ArraySort(values);
   int mid = count / 2;
   if((count % 2) == 1)
      return values[mid];

   return (values[mid - 1] + values[mid]) / 2.0;
}

void AppendLevel(double &levels[], int &count, const double level)
{
   ArrayResize(levels, count + 1);
   levels[count] = level;
   count++;
}

void SetZCandle(
   const int idx,
   const double z_open,
   const double z_high,
   const double z_low,
   const double z_close
)
{
   ZOpenBuffer[idx] = z_open;
   ZHighBuffer[idx] = z_high;
   ZLowBuffer[idx] = z_low;
   ZCloseBuffer[idx] = z_close;

   ZColorBuffer[idx] = ZCloseBuffer[idx] >= ZOpenBuffer[idx] ? 0.0 : 1.0;
}

void DeleteObjects()
{
   for(int i = ObjectsTotal(0, 0, -1) - 1; i >= 0; i--)
   {
      string name = ObjectName(0, i, 0, -1);
      if(StringFind(name, LRMG_PREFIX) == 0)
         ObjectDelete(0, name);
   }
}

void UpdateScale()
{
   double max_abs = 3.5;
   int total = ArraySize(ZOpenBuffer);

   for(int i = 0; i < total; i++)
   {
      if(ZOpenBuffer[i] == EMPTY_VALUE)
         continue;

      max_abs = MathMax(max_abs, MathAbs(ZOpenBuffer[i]));
      max_abs = MathMax(max_abs, MathAbs(ZHighBuffer[i]));
      max_abs = MathMax(max_abs, MathAbs(ZLowBuffer[i]));
      max_abs = MathMax(max_abs, MathAbs(ZCloseBuffer[i]));
   }

   max_abs = MathCeil(max_abs + 0.5);
   IndicatorSetDouble(INDICATOR_MINIMUM, -max_abs);
   IndicatorSetDouble(INDICATOR_MAXIMUM, max_abs);
}

void ConfigureLevels()
{
   IndicatorSetInteger(INDICATOR_LEVELS, 7);
   double levels[7] = {-3.0, -2.0, -1.0, 0.0, 1.0, 2.0, 3.0};
   for(int i = 0; i < 7; i++)
   {
      IndicatorSetDouble(INDICATOR_LEVELVALUE, i, levels[i]);
      IndicatorSetInteger(INDICATOR_LEVELSTYLE, i, i == 3 ? STYLE_SOLID : STYLE_DOT);
      IndicatorSetInteger(INDICATOR_LEVELWIDTH, i, i == 3 ? 2 : 1);
      IndicatorSetInteger(INDICATOR_LEVELCOLOR, i, i == 3 ? clrDeepSkyBlue : clrDimGray);
   }
}

int OnInit()
{
   SetIndexBuffer(0, ZOpenBuffer, INDICATOR_DATA);
   SetIndexBuffer(1, ZHighBuffer, INDICATOR_DATA);
   SetIndexBuffer(2, ZLowBuffer, INDICATOR_DATA);
   SetIndexBuffer(3, ZCloseBuffer, INDICATOR_DATA);
   SetIndexBuffer(4, ZColorBuffer, INDICATOR_COLOR_INDEX);

   PlotIndexSetDouble(0, PLOT_EMPTY_VALUE, EMPTY_VALUE);
   PlotIndexSetString(0, PLOT_LABEL, "");
   IndicatorSetString(INDICATOR_SHORTNAME, "");
   IndicatorSetInteger(INDICATOR_DIGITS, 2);
   ConfigureLevels();
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
   DeleteObjects();
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
      ZOpenBuffer[i] = EMPTY_VALUE;
      ZHighBuffer[i] = EMPTY_VALUE;
      ZLowBuffer[i] = EMPTY_VALUE;
      ZCloseBuffer[i] = EMPTY_VALUE;
      ZColorBuffer[i] = 0.0;
   }

   if(rates_total < 50)
      return rates_total;

   bool series = ArrayGetAsSeries(close);

   datetime chron_time[];
   double chron_open[];
   double chron_high[];
   double chron_low[];
   double chron_close[];
   ArrayResize(chron_time, rates_total);
   ArrayResize(chron_open, rates_total);
   ArrayResize(chron_high, rates_total);
   ArrayResize(chron_low, rates_total);
   ArrayResize(chron_close, rates_total);

   for(int logical = 0; logical < rates_total; logical++)
   {
      int idx = ChronIndex(rates_total, series, logical);
      chron_time[logical] = time[idx];
      chron_open[logical] = open[idx];
      chron_high[logical] = high[idx];
      chron_low[logical] = low[idx];
      chron_close[logical] = close[idx];
   }

   LimniRadialMap bootstrap;
   if(!LimniComputeMovementMap(chron_time, chron_close, 0, rates_total - 1, true, bootstrap))
      return rates_total;

   double q = bootstrap.radius;
   if(q <= 0.0)
      return rates_total;

   double base = chron_close[0];
   int level = 0;
   double brick_levels[];
   int brick_count = 0;

   for(int logical = 0; logical < rates_total; logical++)
   {
      int idx = ChronIndex(rates_total, series, logical);

      int guard = 0;
      while(chron_close[logical] >= base + ((double)level + 1.0) * q && guard < 200)
      {
         double close_level = (double)(level + 1);
         AppendLevel(brick_levels, brick_count, close_level);
         level++;
         guard++;
      }

      guard = 0;
      while(chron_close[logical] <= base + ((double)level - 1.0) * q && guard < 200)
      {
         double close_level = (double)(level - 1);
         AppendLevel(brick_levels, brick_count, close_level);
         level--;
         guard++;
      }

      double median_level = brick_count > 0 ? MedianBrickLevel(brick_levels, brick_count - 1) : 0.0;
      double z_open = (chron_open[logical] - base) / q - median_level;
      double z_close = (chron_close[logical] - base) / q - median_level;
      double z_high_raw = (chron_high[logical] - base) / q - median_level;
      double z_low_raw = (chron_low[logical] - base) / q - median_level;
      double z_high = MathMax(MathMax(z_open, z_close), z_high_raw);
      double z_low = MathMin(MathMin(z_open, z_close), z_low_raw);

      SetZCandle(idx, z_open, z_high, z_low, z_close);
   }

   UpdateScale();
   return rates_total;
}
