//+------------------------------------------------------------------+
//|                                         LimniLRMGCreateChart.mq5 |
//|                    Builds a synthetic LRMG brick chart symbol    |
//+------------------------------------------------------------------+
#property strict

#include "..\\Indicators\\Include\\LimniRadialMovementGrid.mqh"

input int  SourceM1LookbackBars = 12000;
input int  BootstrapM1Bars = 720;
input bool UseClosedM1BarsOnly = true;
input int  MedianBrickWindow = 55;
input int  MaxGeneratedBricks = 20000;

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

datetime M1OpenTime(const datetime value)
{
   long raw = (long)value;
   return (datetime)(raw - raw % 60);
}

datetime NextBrickTime(const datetime event_time, const datetime last_time)
{
   datetime brick_time = M1OpenTime(event_time);
   if(brick_time <= last_time)
      brick_time = (datetime)(last_time + 60);

   return brick_time;
}

double MedianBrickLevel(const double &levels[], const int count, const int window)
{
   if(count <= 0)
      return 0.0;

   int start_index = 0;
   if(window > 0)
      start_index = MathMax(0, count - window);

   int sample_count = count - start_index;
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

bool AppendBrickRate(
   MqlRates &rates[],
   double &median_levels[],
   double &closed_levels[],
   int &rate_count,
   int &closed_level_count,
   datetime &last_rate_time,
   const datetime event_time,
   const int open_level,
   const int close_level,
   const long tick_volume,
   const int spread
)
{
   if(MaxGeneratedBricks > 0 && rate_count >= MaxGeneratedBricks)
      return false;

   datetime rate_time = NextBrickTime(event_time, last_rate_time);
   double open_value = (double)open_level;
   double close_value = (double)close_level;
   double high_value = MathMax(open_value, close_value);
   double low_value = MathMin(open_value, close_value);

   ArrayResize(rates, rate_count + 1);
   ArrayResize(median_levels, rate_count + 1);
   ArrayResize(closed_levels, closed_level_count + 1);

   closed_levels[closed_level_count] = close_value;
   closed_level_count++;

   rates[rate_count].time = rate_time;
   rates[rate_count].open = open_value;
   rates[rate_count].high = high_value;
   rates[rate_count].low = low_value;
   rates[rate_count].close = close_value;
   rates[rate_count].tick_volume = tick_volume;
   rates[rate_count].spread = spread;
   rates[rate_count].real_volume = 0;

   median_levels[rate_count] = MedianBrickLevel(closed_levels, closed_level_count, MedianBrickWindow);
   last_rate_time = rate_time;
   rate_count++;
   return true;
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

   CustomSymbolSetString(custom_symbol, SYMBOL_DESCRIPTION, "Limni Radial Movement Grid equal-brick M1 chart from " + source_symbol);
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

   int bootstrap_end = MathMin(copied - 1, MathMax(10, BootstrapM1Bars) - 1);
   LimniRadialMap bootstrap;
   if(!LimniComputeMovementMap(times, closes, 0, bootstrap_end, true, bootstrap))
      return false;

   brick_size = bootstrap.radius;
   if(brick_size <= 0.0)
      return false;

   double base_price = source[0].close;
   int current_level = 0;
   double closed_levels[];
   datetime last_rate_time = 0;

   for(int i = 1; i < copied; i++)
   {
      bool keep_building = true;
      int guard = 0;
      while(source[i].close >= base_price + ((double)current_level + 1.0) * brick_size && guard < 200)
      {
         int next_level = current_level + 1;
         keep_building = AppendBrickRate(
            out_rates,
            median_levels,
            closed_levels,
            out_count,
            brick_close_count,
            last_rate_time,
            source[i].time,
            current_level,
            next_level,
            source[i].tick_volume,
            source[i].spread
         );
         current_level++;
         guard++;
         if(!keep_building)
            break;
      }

      if(!keep_building)
         break;

      guard = 0;
      while(source[i].close <= base_price + ((double)current_level - 1.0) * brick_size && guard < 200)
      {
         int next_level = current_level - 1;
         keep_building = AppendBrickRate(
            out_rates,
            median_levels,
            closed_levels,
            out_count,
            brick_close_count,
            last_rate_time,
            source[i].time,
            current_level,
            next_level,
            source[i].tick_volume,
            source[i].spread
         );
         current_level--;
         guard++;
         if(!keep_building)
            break;
      }

      if(!keep_building)
         break;
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
   ENUM_TIMEFRAMES launch_period = (ENUM_TIMEFRAMES)_Period;
   ENUM_TIMEFRAMES source_period = PERIOD_M1;

   int bars = Bars(source_symbol, PERIOD_M1);
   if(bars < 50)
   {
      Print("LRMG: not enough M1 history for ", source_symbol);
      return;
   }

   int requested_bars = MathMin(bars, MathMax(50, SourceM1LookbackBars));
   MqlRates source_rates[];
   ArraySetAsSeries(source_rates, false);
   int copied = CopyRates(source_symbol, PERIOD_M1, 0, requested_bars, source_rates);
   if(copied < 50)
   {
      Print("LRMG: M1 CopyRates failed/short for ", source_symbol, " copied=", copied);
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

   if(UseClosedM1BarsOnly && copied > 1)
      copied--;

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

   string custom_symbol = CleanSymbolName(source_symbol) + "_LRMG_M1";
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
   long chart_id = ChartOpen(custom_symbol, PERIOD_M1);
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
      " source_period=", EnumToString(source_period),
      " launch_period=", EnumToString(launch_period),
      " source_m1_bars=", copied,
      " brick_bars=", lrmg_count,
      " brick_closes=", brick_close_count,
      " raw_Q=", DoubleToString(brick_size, (int)SymbolInfoInteger(source_symbol, SYMBOL_DIGITS)),
      " chart_id=", chart_id
   );
}
