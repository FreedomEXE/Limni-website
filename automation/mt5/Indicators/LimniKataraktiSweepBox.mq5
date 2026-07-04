//+------------------------------------------------------------------+
//|                                      LimniKataraktiSweepBox.mq5  |
//|                                      Copyright 2026, LIMNI Ltd.  |
//|                                      Visual review indicator     |
//+------------------------------------------------------------------+
#property copyright "LIMNI LTD"
#property version   "1.01"
#property indicator_chart_window
#property indicator_plots 0

input int    LookbackBars = 15000; // M1 bars copied for calculation
input int    MaxSignalsToDraw = 80;
input double ChartTimeUtcOffsetHours = 0.0; // chart/server time minus UTC

input double SweepDepthRangeFraction = 0.0833333333; // approx range / 12
input double DisplacementBodyRangeFraction = 0.0833333333;
input double CloseZoneMax = 0.30;
input int    MinSweepPoints = 0;
input int    MinDisplacementBodyPoints = 0;
input bool   UseClosedBarsOnly = true;
input bool   DrawLongSweeps = true;
input bool   DrawShortSweeps = true;
input bool   DrawLabels = false;
input bool   FillBoxes = false;
input bool   ShowDebugComment = false;

input color  LongBoxColor = clrLime;
input color  ShortBoxColor = clrTomato;
input color  LongArrowColor = clrLime;
input color  ShortArrowColor = clrTomato;
input int    BoxLineWidth = 2;
input int    ArrowSize = 2;
input int    MinBoxWidthM1Bars = 6;
input int    MinBoxWidthChartBars = 1;
input int    BoxRightPaddingM1Bars = 2;
input double BoxVerticalPaddingFraction = 0.08;

string PREFIX = "LIMNI_KATARAKTI_SWEEP_BOX_";

int IndexFromLogical(const int rates_total, const bool series, const int logical_index)
{
   if(series)
      return rates_total - 1 - logical_index;
   return logical_index;
}

datetime BarUtc(const datetime t)
{
   return (datetime)(t - (int)MathRound(ChartTimeUtcOffsetHours * 3600.0));
}

datetime UtcToChartTime(const datetime t)
{
   return (datetime)(t + (int)MathRound(ChartTimeUtcOffsetHours * 3600.0));
}

datetime DayStart(const datetime t)
{
   MqlDateTime dt;
   TimeToStruct(t, dt);
   dt.hour = 0;
   dt.min = 0;
   dt.sec = 0;
   return StructToTime(dt);
}

string WindowId(const string name, const datetime day_start_utc)
{
   MqlDateTime dt;
   TimeToStruct(day_start_utc, dt);
   return name + "_" + IntegerToString(dt.year) + "_" +
      IntegerToString(dt.mon) + "_" + IntegerToString(dt.day);
}

string ObjName(const string kind, const int n)
{
   return PREFIX + _Symbol + "_" + EnumToString((ENUM_TIMEFRAMES)_Period) + "_" + kind + "_" + IntegerToString(n);
}

void DeleteObjects()
{
   for(int i = ObjectsTotal(0, 0, -1) - 1; i >= 0; i--)
   {
      string name = ObjectName(0, i, 0, -1);
      if(StringFind(name, PREFIX) == 0)
         ObjectDelete(0, name);
   }
}

bool InWindow(const datetime t_utc, const datetime start_utc, const datetime end_utc)
{
   return t_utc >= start_utc && t_utc < end_utc;
}

bool DisplacementPass(
   const bool is_long,
   const int idx,
   const double &open[],
   const double &high[],
   const double &low[],
   const double &close[],
   const double required_body_price
)
{
   double candle_range = high[idx] - low[idx];
   if(candle_range <= 0.0)
      return false;

   double body = MathAbs(close[idx] - open[idx]);
   bool correct_direction = is_long ? close[idx] > open[idx] : close[idx] < open[idx];
   if(!correct_direction || body + _Point * 0.1 < required_body_price)
      return false;

   double close_zone = is_long
      ? (high[idx] - close[idx]) / candle_range
      : (close[idx] - low[idx]) / candle_range;

   return close_zone <= CloseZoneMax;
}

void DrawTrigger(
   const int signal_number,
   const bool is_long,
   const int sweep_logical,
   const int displacement_logical,
   const double range_low,
   const double range_high,
   const int rates_total,
   const bool series,
   const datetime &time[],
   const double &high[],
   const double &low[],
   const string session_id
)
{
   int sweep_idx = IndexFromLogical(rates_total, series, sweep_logical);
   int disp_idx = IndexFromLogical(rates_total, series, displacement_logical);

   double top = -DBL_MAX;
   double bottom = DBL_MAX;
   for(int logical = sweep_logical; logical <= displacement_logical; logical++)
   {
      int idx = IndexFromLogical(rates_total, series, logical);
      if(high[idx] > top)
         top = high[idx];
      if(low[idx] < bottom)
         bottom = low[idx];
   }

   double invalidated_edge = is_long ? range_low : range_high;
   if(invalidated_edge > top)
      top = invalidated_edge;
   if(invalidated_edge < bottom)
      bottom = invalidated_edge;

   double box_height = top - bottom;
   double vertical_pad = MathMax(box_height * BoxVerticalPaddingFraction, _Point * 20.0);
   top += vertical_pad;
   bottom -= vertical_pad;

   int chart_seconds = PeriodSeconds((ENUM_TIMEFRAMES)_Period);
   if(chart_seconds <= 0)
      chart_seconds = 60;

   int calc_seconds = PeriodSeconds(PERIOD_M1);
   if(calc_seconds <= 0)
      calc_seconds = 60;

   datetime left_time = time[sweep_idx];
   datetime right_time = (datetime)(time[disp_idx] + calc_seconds * (1 + MathMax(0, BoxRightPaddingM1Bars)));
   datetime min_m1_right = (datetime)(left_time + calc_seconds * MathMax(1, MinBoxWidthM1Bars));
   datetime min_chart_right = (datetime)(left_time + chart_seconds * MathMax(0, MinBoxWidthChartBars));
   if(right_time < min_m1_right)
      right_time = min_m1_right;
   if(right_time < min_chart_right)
      right_time = min_chart_right;

   color box_color = is_long ? LongBoxColor : ShortBoxColor;

   string box_name = ObjName("BOX", signal_number);
   ObjectCreate(0, box_name, OBJ_RECTANGLE, 0, left_time, top, right_time, bottom);
   ObjectSetInteger(0, box_name, OBJPROP_COLOR, box_color);
   ObjectSetInteger(0, box_name, OBJPROP_WIDTH, BoxLineWidth);
   ObjectSetInteger(0, box_name, OBJPROP_STYLE, STYLE_SOLID);
   ObjectSetInteger(0, box_name, OBJPROP_FILL, FillBoxes);
   ObjectSetInteger(0, box_name, OBJPROP_BACK, false);
   ObjectSetInteger(0, box_name, OBJPROP_SELECTABLE, false);
   ObjectSetInteger(0, box_name, OBJPROP_HIDDEN, true);

   string arrow_name = ObjName("ARROW", signal_number);
   double arrow_pad = MathMax((top - bottom) * 0.20, _Point * 20.0);
   double arrow_price = is_long ? bottom - arrow_pad : top + arrow_pad;
   ObjectCreate(0, arrow_name, OBJ_ARROW, 0, time[disp_idx], arrow_price);
   ObjectSetInteger(0, arrow_name, OBJPROP_ARROWCODE, is_long ? 233 : 234);
   ObjectSetInteger(0, arrow_name, OBJPROP_COLOR, is_long ? LongArrowColor : ShortArrowColor);
   ObjectSetInteger(0, arrow_name, OBJPROP_WIDTH, ArrowSize);
   ObjectSetInteger(0, arrow_name, OBJPROP_SELECTABLE, false);
   ObjectSetInteger(0, arrow_name, OBJPROP_HIDDEN, true);

   if(DrawLabels)
   {
      string label_name = ObjName("LABEL", signal_number);
      string side = is_long ? "KTR LONG" : "KTR SHORT";
      double label_price = is_long ? bottom : top;
      ObjectCreate(0, label_name, OBJ_TEXT, 0, right_time, label_price);
      ObjectSetString(0, label_name, OBJPROP_TEXT, side + " " + session_id);
      ObjectSetInteger(0, label_name, OBJPROP_COLOR, box_color);
      ObjectSetInteger(0, label_name, OBJPROP_FONTSIZE, 8);
      ObjectSetInteger(0, label_name, OBJPROP_SELECTABLE, false);
      ObjectSetInteger(0, label_name, OBJPROP_HIDDEN, true);
   }
}

bool FindRejectionAndDisplacement(
   const bool is_long,
   const int sweep_logical,
   const int process_to,
   const datetime entry_start_utc,
   const datetime entry_end_utc,
   const double range_low,
   const double range_high,
   const double required_body_price,
   const int rates_total,
   const bool series,
   const datetime &time[],
   const double &open[],
   const double &high[],
   const double &low[],
   const double &close[],
   int &displacement_logical
)
{
   int rejection_logical = -1;
   for(int step = 0; step <= 1; step++)
   {
      int logical = sweep_logical + step;
      if(logical > process_to)
         continue;

      int idx = IndexFromLogical(rates_total, series, logical);
      datetime t_utc = BarUtc(time[idx]);
      if(!InWindow(t_utc, entry_start_utc, entry_end_utc))
         continue;

      bool rejected = is_long ? close[idx] > range_low : close[idx] < range_high;
      if(rejected)
      {
         rejection_logical = logical;
         break;
      }
   }

   if(rejection_logical < 0)
      return false;

   for(int step = 0; step <= 1; step++)
   {
      int logical = rejection_logical + step;
      if(logical > process_to)
         continue;

      int idx = IndexFromLogical(rates_total, series, logical);
      datetime t_utc = BarUtc(time[idx]);
      if(!InWindow(t_utc, entry_start_utc, entry_end_utc))
         continue;

      if(DisplacementPass(is_long, idx, open, high, low, close, required_body_price))
      {
         displacement_logical = logical;
         return true;
      }
   }

   return false;
}

void DetectWindow(
   const string session_id,
   const datetime range_start_utc,
   const datetime range_end_utc,
   const datetime entry_start_utc,
   const datetime entry_end_utc,
   const int start_logical,
   const int process_to,
   const int rates_total,
   const bool series,
   const datetime &time[],
   const double &open[],
   const double &high[],
   const double &low[],
   const double &close[],
   int &signals_drawn
)
{
   double range_high = -DBL_MAX;
   double range_low = DBL_MAX;
   bool has_range = false;

   for(int logical = start_logical; logical <= process_to; logical++)
   {
      int idx = IndexFromLogical(rates_total, series, logical);
      datetime t_utc = BarUtc(time[idx]);
      if(!InWindow(t_utc, range_start_utc, range_end_utc))
         continue;

      if(high[idx] > range_high)
         range_high = high[idx];
      if(low[idx] < range_low)
         range_low = low[idx];
      has_range = true;
   }

   if(!has_range)
      return;

   double range_price = range_high - range_low;
   if(range_price <= 0.0)
      return;

   double min_sweep = MinSweepPoints * _Point;
   double min_body = MinDisplacementBodyPoints * _Point;
   double required_sweep_price = MathMax(min_sweep, range_price * SweepDepthRangeFraction);
   double required_body_price = MathMax(min_body, range_price * DisplacementBodyRangeFraction);

   for(int logical = start_logical; logical <= process_to && signals_drawn < MaxSignalsToDraw; logical++)
   {
      int idx = IndexFromLogical(rates_total, series, logical);
      datetime t_utc = BarUtc(time[idx]);
      if(!InWindow(t_utc, entry_start_utc, entry_end_utc))
         continue;

      if(DrawLongSweeps)
      {
         double down_depth = range_low - low[idx];
         if(down_depth + _Point * 0.1 >= required_sweep_price)
         {
            int displacement_logical = -1;
            if(FindRejectionAndDisplacement(true, logical, process_to, entry_start_utc, entry_end_utc,
               range_low, range_high, required_body_price, rates_total, series, time, open, high, low, close,
               displacement_logical))
            {
               DrawTrigger(signals_drawn, true, logical, displacement_logical, range_low, range_high,
                  rates_total, series, time, high, low, session_id);
               signals_drawn++;
            }
         }
      }

      if(DrawShortSweeps && signals_drawn < MaxSignalsToDraw)
      {
         double up_depth = high[idx] - range_high;
         if(up_depth + _Point * 0.1 >= required_sweep_price)
         {
            int displacement_logical = -1;
            if(FindRejectionAndDisplacement(false, logical, process_to, entry_start_utc, entry_end_utc,
               range_low, range_high, required_body_price, rates_total, series, time, open, high, low, close,
               displacement_logical))
            {
               DrawTrigger(signals_drawn, false, logical, displacement_logical, range_low, range_high,
                  rates_total, series, time, high, low, session_id);
               signals_drawn++;
            }
         }
      }
   }
}

int OnInit()
{
   DeleteObjects();
   IndicatorSetString(INDICATOR_SHORTNAME, "Limni Katarakti Sweep Box");
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
   DeleteObjects();
   Comment("");
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
   MqlRates m1_rates[];
   ArraySetAsSeries(m1_rates, false);
   int requested_bars = MathMax(LookbackBars, 100);
   int copied = CopyRates(_Symbol, PERIOD_M1, 0, requested_bars, m1_rates);
   if(copied < 50)
   {
      if(ShowDebugComment)
      {
         Comment(
            "Limni Katarakti Sweep Box\n",
            "M1 data unavailable or too short\n",
            "copied M1 bars: ", IntegerToString(copied)
         );
      }
      return rates_total;
   }

   datetime calc_time[];
   double calc_open[];
   double calc_high[];
   double calc_low[];
   double calc_close[];
   ArrayResize(calc_time, copied);
   ArrayResize(calc_open, copied);
   ArrayResize(calc_high, copied);
   ArrayResize(calc_low, copied);
   ArrayResize(calc_close, copied);

   for(int i = 0; i < copied; i++)
   {
      calc_time[i] = m1_rates[i].time;
      calc_open[i] = m1_rates[i].open;
      calc_high[i] = m1_rates[i].high;
      calc_low[i] = m1_rates[i].low;
      calc_close[i] = m1_rates[i].close;
   }

   int calc_total = copied;
   bool series = calc_time[0] > calc_time[calc_total - 1];
   int process_to = calc_total - 1;
   if(UseClosedBarsOnly)
      process_to--;

   if(process_to < 20)
      return rates_total;

   int start_logical = MathMax(0, process_to - LookbackBars);
   int first_idx = IndexFromLogical(calc_total, series, start_logical);
   int last_idx = IndexFromLogical(calc_total, series, process_to);

   datetime first_utc = BarUtc(calc_time[first_idx]);
   datetime last_utc = BarUtc(calc_time[last_idx]);
   datetime day_start = DayStart(first_utc) - 86400;
   datetime day_end = DayStart(last_utc) + 86400;

   DeleteObjects();

   int signals_drawn = 0;
   for(datetime day = day_start; day <= day_end && signals_drawn < MaxSignalsToDraw; day += 86400)
   {
      DetectWindow(
         WindowId("ny", day),
         day,
         day + 13 * 3600,
         day + 13 * 3600,
         day + 21 * 3600,
         start_logical,
         process_to,
         calc_total,
         series,
         calc_time, calc_open, calc_high, calc_low, calc_close,
         signals_drawn
      );

      DetectWindow(
         WindowId("asia_london", day + 86400),
         day + 13 * 3600,
         day + 21 * 3600,
         day + 86400,
         day + 86400 + 13 * 3600,
         start_logical,
         process_to,
         calc_total,
         series,
         calc_time, calc_open, calc_high, calc_low, calc_close,
         signals_drawn
      );
   }

   if(ShowDebugComment)
   {
      Comment(
         "Limni Katarakti Sweep Box\n",
         "signals: ", IntegerToString(signals_drawn), "\n",
         "calculation: M1\n",
         "copied M1 bars: ", IntegerToString(copied), "\n",
         "lookback M1 bars: ", IntegerToString(LookbackBars), "\n",
         "chart UTC offset hours: ", DoubleToString(ChartTimeUtcOffsetHours, 2)
      );
   }

   return rates_total;
}
