//+------------------------------------------------------------------+
//|                                         LimniLRMGCreateChart.mq5 |
//|                    Builds a synthetic LRMG brick chart symbol    |
//+------------------------------------------------------------------+
#property strict

#include "..\\Indicators\\Include\\LimniRadialMovementGrid.mqh"

string CleanSymbolName(const string value)
{
   string output = "";
   int len = StringLen(value);
   for(int i = 0; i < len; i++)
   {
      string ch = StringSubstr(value, i, 1);
      int code = StringGetCharacter(ch, 0);
      bool ok = (code >= 48 && code <= 57) ||
         (code >= 65 && code <= 90) ||
         (code >= 97 && code <= 122) ||
         ch == "_" ||
         ch == ".";
      if(ok)
         output += ch;
   }
   if(output == "")
      output = "SYMBOL";
   return output;
}

datetime NextBrickTime(const datetime start_time, const int brick_index)
{
   return (datetime)(start_time + brick_index * 60);
}

string PeriodSuffix(const ENUM_TIMEFRAMES period)
{
   string value = EnumToString(period);
   StringReplace(value, "PERIOD_", "");
   return value;
}

double MedianRateClose(const MqlRates &rates[], const int start_index, const int end_index)
{
   int count = end_index - start_index + 1;
   if(count <= 0)
      return 0.0;

   double values[];
   ArrayResize(values, count);
   for(int i = 0; i < count; i++)
      values[i] = rates[start_index + i].close;

   ArraySort(values);
   int mid = count / 2;
   if((count % 2) == 1)
      return values[mid];

   return (values[mid - 1] + values[mid]) / 2.0;
}

void SetMappedRate(
   MqlRates &rates[],
   const int index,
   const datetime rate_time,
   const double z_open,
   const double z_high,
   const double z_low,
   const double z_close,
   const long tick_volume,
   const int spread
)
{
   rates[index].time = rate_time;
   rates[index].open = z_open;
   rates[index].close = z_close;
   rates[index].high = MathMax(MathMax(z_open, z_close), z_high);
   rates[index].low = MathMin(MathMin(z_open, z_close), z_low);
   rates[index].tick_volume = tick_volume;
   rates[index].spread = spread;
   rates[index].real_volume = 0;
}

bool EnsureCustomSymbol(const string custom_symbol, const string source_symbol)
{
   ResetLastError();
   if(!CustomSymbolCreate(custom_symbol, "Limni\\LRMG", source_symbol))
   {
      long is_custom = 0;
      if(!SymbolInfoInteger(custom_symbol, SYMBOL_CUSTOM, is_custom) || is_custom == 0)
      {
         Print("LRMG custom symbol create failed: ", custom_symbol, " error=", GetLastError());
         return false;
      }
   }

   CustomSymbolSetString(custom_symbol, SYMBOL_DESCRIPTION, "Limni Radial Movement Grid synthetic brick chart from " + source_symbol);
   CustomSymbolSetInteger(custom_symbol, SYMBOL_DIGITS, 2);
   CustomSymbolSetDouble(custom_symbol, SYMBOL_POINT, 0.01);
   CustomSymbolSetDouble(custom_symbol, SYMBOL_TRADE_TICK_SIZE, 0.01);
   CustomSymbolSetDouble(custom_symbol, SYMBOL_TRADE_TICK_VALUE, 1.0);
   CustomSymbolSetDouble(custom_symbol, SYMBOL_TRADE_CONTRACT_SIZE, 1.0);
   CustomSymbolSetInteger(custom_symbol, SYMBOL_CHART_MODE, SYMBOL_CHART_MODE_BID);
   SymbolSelect(custom_symbol, true);
   return true;
}

bool BuildLrmgRates(
   const MqlRates &source[],
   const int copied,
   MqlRates &out_rates[],
   int &out_count,
   double &brick_size,
   int &brick_close_count,
   double &median_levels[]
)
{
   ArrayResize(out_rates, 0);
   ArrayResize(median_levels, 0);
   out_count = 0;
   brick_size = 0.0;
   brick_close_count = 0;

   if(copied < 50)
      return false;

   datetime times[];
   double closes[];
   ArrayResize(times, copied);
   ArrayResize(closes, copied);

   for(int i = 0; i < copied; i++)
   {
      times[i] = source[i].time;
      closes[i] = source[i].close;
   }

   LimniRadialMap bootstrap;
   if(!LimniComputeMovementMap(times, closes, 0, copied - 1, true, bootstrap))
      return false;

   brick_size = bootstrap.radius;
   if(brick_size <= 0.0)
      return false;

   double base_price = source[0].close;
   int current_level = 0;
   double brick_levels[];

   ArrayResize(out_rates, copied);
   ArrayResize(median_levels, copied);
   out_count = copied;

   for(int i = 0; i < copied; i++)
   {
      int guard = 0;
      while(source[i].close >= base_price + ((double)current_level + 1.0) * brick_size && guard < 200)
      {
         double close_level = (double)(current_level + 1);
         ArrayResize(brick_levels, brick_close_count + 1);
         brick_levels[brick_close_count] = close_level;
         brick_close_count++;
         current_level++;
         guard++;
      }

      guard = 0;
      while(source[i].close <= base_price + ((double)current_level - 1.0) * brick_size && guard < 200)
      {
         double close_level = (double)(current_level - 1);
         ArrayResize(brick_levels, brick_close_count + 1);
         brick_levels[brick_close_count] = close_level;
         brick_close_count++;
         current_level--;
         guard++;
      }

      double median_level = 0.0;
      if(brick_close_count > 0)
      {
         int start = MathMax(0, brick_close_count - 55);
         int count = brick_close_count - start;
         double values[];
         ArrayResize(values, count);
         for(int j = 0; j < count; j++)
            values[j] = brick_levels[start + j];

         ArraySort(values);
         int mid = count / 2;
         median_level = (count % 2) == 1 ? values[mid] : (values[mid - 1] + values[mid]) / 2.0;
      }

      median_levels[i] = median_level;

      double z_open = (source[i].open - base_price) / brick_size;
      double z_high = (source[i].high - base_price) / brick_size;
      double z_low = (source[i].low - base_price) / brick_size;
      double z_close = (source[i].close - base_price) / brick_size;

      SetMappedRate(
         out_rates,
         i,
         source[i].time,
         z_open,
         z_high,
         z_low,
         z_close,
         source[i].tick_volume,
         source[i].spread
      );
   }

   return out_count > 0;
}

void ConfigureLrmgChart(const long chart_id)
{
   if(chart_id <= 0)
      return;

   ChartSetInteger(chart_id, CHART_MODE, CHART_CANDLES);
   ChartSetInteger(chart_id, CHART_SHOW_VOLUMES, CHART_VOLUME_HIDE);
   ChartSetInteger(chart_id, CHART_SHOW_OHLC, false);
   ChartSetInteger(chart_id, CHART_SHOW_BID_LINE, false);
   ChartSetInteger(chart_id, CHART_SHOW_ASK_LINE, false);
   ChartSetInteger(chart_id, CHART_SHOW_LAST_LINE, false);
   ChartSetInteger(chart_id, CHART_SHOW_TRADE_LEVELS, false);
   ChartSetInteger(chart_id, CHART_COLOR_BACKGROUND, clrBlack);
   ChartSetInteger(chart_id, CHART_COLOR_FOREGROUND, clrSilver);
   ChartSetInteger(chart_id, CHART_COLOR_GRID, clrDimGray);
   ChartSetInteger(chart_id, CHART_COLOR_CHART_UP, clrLime);
   ChartSetInteger(chart_id, CHART_COLOR_CHART_DOWN, clrTomato);
   ChartSetInteger(chart_id, CHART_COLOR_CANDLE_BULL, clrLime);
   ChartSetInteger(chart_id, CHART_COLOR_CANDLE_BEAR, clrTomato);
   ChartSetInteger(chart_id, CHART_SHIFT, true);
}

void DrawShellLine(const long chart_id, const string suffix, const double level, const color line_color, const int style, const int width)
{
   string name = "LRMG_SHELL_" + suffix;
   if(ObjectFind(chart_id, name) < 0)
      ObjectCreate(chart_id, name, OBJ_HLINE, 0, 0, level);

   ObjectSetDouble(chart_id, name, OBJPROP_PRICE, level);
   ObjectSetInteger(chart_id, name, OBJPROP_COLOR, line_color);
   ObjectSetInteger(chart_id, name, OBJPROP_STYLE, style);
   ObjectSetInteger(chart_id, name, OBJPROP_WIDTH, width);
   ObjectSetInteger(chart_id, name, OBJPROP_SELECTABLE, false);
   ObjectSetInteger(chart_id, name, OBJPROP_HIDDEN, true);
}

void DrawShellGrid(const long chart_id)
{
   if(chart_id <= 0)
      return;

   DrawShellLine(chart_id, "BASE", 0.0, clrDimGray, STYLE_DOT, 1);
}

void DrawLrmgInfoLabel(
   const long chart_id,
   const string custom_symbol,
   const string source_symbol,
   const double brick_size,
   const int source_bars,
   const int brick_count
)
{
   if(chart_id <= 0)
      return;

   int digits = (int)SymbolInfoInteger(source_symbol, SYMBOL_DIGITS);
   double point = SymbolInfoDouble(source_symbol, SYMBOL_POINT);
   double points = point > 0.0 ? brick_size / point : 0.0;

   string text = StringFormat(
      "%s | source %s | 1 brick = Q %s raw price = %.1f points | y-axis unit 1.00 = one LRMG brick | source bars %d | bricks %d",
      custom_symbol,
      source_symbol,
      DoubleToString(brick_size, digits),
      points,
      source_bars,
      brick_count
   );

   string name = "LRMG_INFO_LABEL";
   if(ObjectFind(chart_id, name) < 0)
      ObjectCreate(chart_id, name, OBJ_LABEL, 0, 0, 0);

   ObjectSetInteger(chart_id, name, OBJPROP_CORNER, CORNER_LEFT_UPPER);
   ObjectSetInteger(chart_id, name, OBJPROP_XDISTANCE, 12);
   ObjectSetInteger(chart_id, name, OBJPROP_YDISTANCE, 18);
   ObjectSetInteger(chart_id, name, OBJPROP_COLOR, clrWhite);
   ObjectSetInteger(chart_id, name, OBJPROP_FONTSIZE, 9);
   ObjectSetInteger(chart_id, name, OBJPROP_SELECTABLE, false);
   ObjectSetInteger(chart_id, name, OBJPROP_HIDDEN, true);
   ObjectSetString(chart_id, name, OBJPROP_TEXT, text);
}

void DeleteLrmgChartObjects(const long chart_id)
{
   if(chart_id <= 0)
      return;

   for(int i = ObjectsTotal(chart_id, 0, -1) - 1; i >= 0; i--)
   {
      string name = ObjectName(chart_id, i, 0, -1);
      if(StringFind(name, "LRMG_") == 0)
         ObjectDelete(chart_id, name);
   }
}

void DrawClosedBrickMedianSpine(const long chart_id, const MqlRates &rates[], const int count)
{
   if(chart_id <= 0 || count < 2)
      return;

   const int window = 55;
   double previous_median = MedianRateClose(rates, 0, 0);

   for(int i = 1; i < count; i++)
   {
      int start = MathMax(0, i - window + 1);
      double median = MedianRateClose(rates, start, i);
      string name = "LRMG_MEDIAN_SEG_" + IntegerToString(i);

      if(ObjectFind(chart_id, name) < 0)
         ObjectCreate(chart_id, name, OBJ_TREND, 0, rates[i - 1].time, previous_median, rates[i].time, median);

      ObjectSetInteger(chart_id, name, OBJPROP_TIME, 0, rates[i - 1].time);
      ObjectSetDouble(chart_id, name, OBJPROP_PRICE, 0, previous_median);
      ObjectSetInteger(chart_id, name, OBJPROP_TIME, 1, rates[i].time);
      ObjectSetDouble(chart_id, name, OBJPROP_PRICE, 1, median);
      ObjectSetInteger(chart_id, name, OBJPROP_COLOR, clrDeepSkyBlue);
      ObjectSetInteger(chart_id, name, OBJPROP_WIDTH, 2);
      ObjectSetInteger(chart_id, name, OBJPROP_STYLE, STYLE_SOLID);
      ObjectSetInteger(chart_id, name, OBJPROP_RAY_RIGHT, false);
      ObjectSetInteger(chart_id, name, OBJPROP_SELECTABLE, false);
      ObjectSetInteger(chart_id, name, OBJPROP_HIDDEN, true);

      previous_median = median;
   }
}

void DrawMedianInfoLabel(const long chart_id)
{
   if(chart_id <= 0)
      return;

   string name = "LRMG_MEDIAN_LABEL";
   if(ObjectFind(chart_id, name) < 0)
      ObjectCreate(chart_id, name, OBJ_LABEL, 0, 0, 0);

   ObjectSetInteger(chart_id, name, OBJPROP_CORNER, CORNER_LEFT_UPPER);
   ObjectSetInteger(chart_id, name, OBJPROP_XDISTANCE, 12);
   ObjectSetInteger(chart_id, name, OBJPROP_YDISTANCE, 36);
   ObjectSetInteger(chart_id, name, OBJPROP_COLOR, clrDeepSkyBlue);
   ObjectSetInteger(chart_id, name, OBJPROP_FONTSIZE, 8);
   ObjectSetInteger(chart_id, name, OBJPROP_SELECTABLE, false);
   ObjectSetInteger(chart_id, name, OBJPROP_HIDDEN, true);
   ObjectSetString(chart_id, name, OBJPROP_TEXT, "cyan spine = closed-brick median; y-axis 1.00 = one LRMG Q");
}

void DrawMovingMedianSpine(
   const long chart_id,
   const MqlRates &rates[],
   const double &median_levels[],
   const int count
)
{
   if(chart_id <= 0 || count < 2)
      return;

   for(int i = 1; i < count; i++)
   {
      string name = "LRMG_MEDIAN_SEG_" + IntegerToString(i);

      if(ObjectFind(chart_id, name) < 0)
         ObjectCreate(chart_id, name, OBJ_TREND, 0, rates[i - 1].time, median_levels[i - 1], rates[i].time, median_levels[i]);

      ObjectSetInteger(chart_id, name, OBJPROP_TIME, 0, rates[i - 1].time);
      ObjectSetDouble(chart_id, name, OBJPROP_PRICE, 0, median_levels[i - 1]);
      ObjectSetInteger(chart_id, name, OBJPROP_TIME, 1, rates[i].time);
      ObjectSetDouble(chart_id, name, OBJPROP_PRICE, 1, median_levels[i]);
      ObjectSetInteger(chart_id, name, OBJPROP_COLOR, clrDeepSkyBlue);
      ObjectSetInteger(chart_id, name, OBJPROP_WIDTH, 2);
      ObjectSetInteger(chart_id, name, OBJPROP_STYLE, STYLE_SOLID);
      ObjectSetInteger(chart_id, name, OBJPROP_RAY_RIGHT, false);
      ObjectSetInteger(chart_id, name, OBJPROP_SELECTABLE, false);
      ObjectSetInteger(chart_id, name, OBJPROP_HIDDEN, true);
   }
}

void OnStart()
{
   string source_symbol = _Symbol;
   ENUM_TIMEFRAMES source_period = (ENUM_TIMEFRAMES)_Period;

   int bars = Bars(source_symbol, source_period);
   if(bars < 50)
   {
      Print("LRMG: not enough chart history for ", source_symbol, " ", EnumToString(source_period));
      return;
   }

   MqlRates source_rates[];
   ArraySetAsSeries(source_rates, false);
   int copied = CopyRates(source_symbol, source_period, 0, bars, source_rates);
   if(copied < 50)
   {
      Print("LRMG: CopyRates failed/short for ", source_symbol, " copied=", copied);
      return;
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

   MqlRates lrmg_rates[];
   double median_levels[];
   int lrmg_count = 0;
   double brick_size = 0.0;
   int brick_close_count = 0;
   if(!BuildLrmgRates(source_rates, copied, lrmg_rates, lrmg_count, brick_size, brick_close_count, median_levels))
   {
      Print("LRMG: failed to build mapped rates for ", source_symbol);
      return;
   }

   string custom_symbol = CleanSymbolName(source_symbol) + "_LRMG_" + PeriodSuffix(source_period);
   if(!EnsureCustomSymbol(custom_symbol, source_symbol))
      return;

   datetime from_time = lrmg_rates[0].time;
   datetime to_time = lrmg_rates[lrmg_count - 1].time;
   CustomRatesDelete(custom_symbol, 0, LONG_MAX);

   ResetLastError();
   int replaced = CustomRatesReplace(custom_symbol, from_time, to_time, lrmg_rates);
   if(replaced <= 0)
   {
      Print("LRMG: CustomRatesReplace failed for ", custom_symbol, " error=", GetLastError());
      return;
   }

   SymbolSelect(custom_symbol, true);
   long chart_id = ChartOpen(custom_symbol, source_period);
   ConfigureLrmgChart(chart_id);
   Sleep(300);
   DeleteLrmgChartObjects(chart_id);
   DrawMovingMedianSpine(chart_id, lrmg_rates, median_levels, lrmg_count);
   ChartNavigate(chart_id, CHART_END, 0);
   ChartRedraw(chart_id);

   Print(
      "LRMG custom chart built: ",
      custom_symbol,
      " source=", source_symbol,
      " period=", EnumToString(source_period),
      " source_bars=", copied,
      " mapped_bars=", lrmg_count,
      " brick_closes=", brick_close_count,
      " raw_Q=", DoubleToString(brick_size, (int)SymbolInfoInteger(source_symbol, SYMBOL_DIGITS)),
      " chart_id=", chart_id
   );
}
