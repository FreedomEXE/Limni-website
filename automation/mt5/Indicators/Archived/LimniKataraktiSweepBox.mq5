//+------------------------------------------------------------------+
//|                                      LimniKataraktiSweepBox.mq5  |
//|                                      Copyright 2026, LIMNI Ltd.  |
//|                                      Visual review indicator     |
//+------------------------------------------------------------------+
#property copyright "LIMNI LTD"
#property version   "1.04"
#property indicator_chart_window
#property indicator_plots 0

input string StartDate = ""; // blank = oldest loaded chart bar
input string EndDate = ""; // blank = newest loaded chart bar
input int    RequestPaddingDays = 2;
input int    LookbackBars = 0; // optional safety cap after date-range copy; 0 = no cap
input int    MaxSignalsToDraw = 0; // 0 = draw all detected signals
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

bool IsBlank(const string value)
{
   return StringLen(value) == 0;
}

datetime ParseInputDate(const string value, const datetime fallback)
{
   if(IsBlank(value))
      return fallback;

   datetime parsed = StringToTime(value);
   if(parsed <= 0)
      return fallback;

   return parsed;
}

int TerminalMaxHistoryBars()
{
   long max_bars = TerminalInfoInteger(TERMINAL_MAXBARS);
   if(max_bars <= 0)
      return 1000000;
   if(max_bars > INT_MAX)
      return INT_MAX;
   return (int)max_bars;
}

void ChartTimeRange(const datetime &time[], const int rates_total, datetime &oldest, datetime &newest)
{
   oldest = 0;
   newest = 0;

   for(int i = 0; i < rates_total; i++)
   {
      if(time[i] <= 0)
         continue;

      if(oldest == 0 || time[i] < oldest)
         oldest = time[i];
      if(newest == 0 || time[i] > newest)
         newest = time[i];
   }
}

bool SeriesFirstDate(const ENUM_TIMEFRAMES period, datetime &first_date)
{
   long raw = 0;
   if(!SeriesInfoInteger(_Symbol, period, SERIES_FIRSTDATE, raw) || raw <= 0)
      return false;

   first_date = (datetime)raw;
   return true;
}

void ApplyLookbackCap(MqlRates &rates[], int &count)
{
   if(LookbackBars <= 0 || count <= LookbackBars)
      return;

   int capped = MathMax(100, LookbackBars);
   if(count <= capped)
      return;

   MqlRates trimmed[];
   ArrayResize(trimmed, capped);
   int start = count - capped;
   for(int i = 0; i < capped; i++)
      trimmed[i] = rates[start + i];

   ArrayResize(rates, capped);
   for(int i = 0; i < capped; i++)
      rates[i] = trimmed[i];

   count = capped;
}

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

bool SignalLimitReached(const int signals_drawn)
{
   return MaxSignalsToDraw > 0 && signals_drawn >= MaxSignalsToDraw;
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

   for(int logical = start_logical; logical <= process_to && !SignalLimitReached(signals_drawn); logical++)
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

      if(DrawShortSweeps && !SignalLimitReached(signals_drawn))
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
   int available_m1_bars = Bars(_Symbol, PERIOD_M1);

   datetime chart_oldest = 0;
   datetime chart_newest = 0;
   ChartTimeRange(time, rates_total, chart_oldest, chart_newest);
   if(chart_oldest <= 0 || chart_newest <= 0)
      return rates_total;

   int padding_days = MathMax(0, RequestPaddingDays);
   datetime fallback_start = (datetime)(chart_oldest - (long)padding_days * 86400);
   datetime fallback_end = (datetime)(chart_newest + (long)MathMax(1, padding_days) * 86400);
   datetime request_start = ParseInputDate(StartDate, fallback_start);
   datetime request_end = ParseInputDate(EndDate, fallback_end);
   if(request_end < chart_newest)
      request_end = chart_newest;

   datetime local_m1_first = 0;
   if(SeriesFirstDate(PERIOD_M1, local_m1_first) && local_m1_first > request_start)
      request_start = local_m1_first;

   if(request_end <= request_start)
      return rates_total;

   ResetLastError();
   int copied = CopyRates(_Symbol, PERIOD_M1, request_start, request_end, m1_rates);
   int copy_error = GetLastError();
   if(copied < 50)
   {
      if(ShowDebugComment)
      {
         Comment(
            "Limni Katarakti Sweep Box\n",
            "M1 date-range data unavailable or too short\n",
            "requested: ", TimeToString(request_start, TIME_DATE | TIME_MINUTES),
            " -> ", TimeToString(request_end, TIME_DATE | TIME_MINUTES), "\n",
            "copied M1 bars: ", IntegerToString(copied), "\n",
            "error: ", IntegerToString(copy_error), "\n",
            "terminal max bars: ", IntegerToString(TerminalMaxHistoryBars())
         );
      }
      return rates_total;
   }

   if(m1_rates[0].time > m1_rates[copied - 1].time)
   {
      MqlRates ordered[];
      ArrayResize(ordered, copied);
      for(int i = 0; i < copied; i++)
         ordered[i] = m1_rates[copied - 1 - i];

      ArrayResize(m1_rates, copied);
      for(int i = 0; i < copied; i++)
         m1_rates[i] = ordered[i];
   }

   ApplyLookbackCap(m1_rates, copied);

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

   int effective_lookback = LookbackBars <= 0 ? copied : MathMin(LookbackBars, copied);
   int start_logical = MathMax(0, process_to - effective_lookback + 1);
   int first_idx = IndexFromLogical(calc_total, series, start_logical);
   int last_idx = IndexFromLogical(calc_total, series, process_to);

   datetime first_utc = BarUtc(calc_time[first_idx]);
   datetime last_utc = BarUtc(calc_time[last_idx]);
   datetime day_start = DayStart(first_utc) - 86400;
   datetime day_end = DayStart(last_utc) + 86400;

   DeleteObjects();

   int signals_drawn = 0;
   for(datetime day = day_start; day <= day_end && !SignalLimitReached(signals_drawn); day += 86400)
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
         "available M1 bars: ", IntegerToString(available_m1_bars), "\n",
         "requested: ", TimeToString(request_start, TIME_DATE | TIME_MINUTES),
         " -> ", TimeToString(request_end, TIME_DATE | TIME_MINUTES), "\n",
         "copied M1 bars: ", IntegerToString(copied), "\n",
         "lookback M1 bars: ", LookbackBars <= 0 ? "date range" : IntegerToString(LookbackBars), "\n",
         "max signals: ", MaxSignalsToDraw <= 0 ? "all detected" : IntegerToString(MaxSignalsToDraw), "\n",
         "terminal max bars: ", IntegerToString(TerminalMaxHistoryBars()), "\n",
         "chart UTC offset hours: ", DoubleToString(ChartTimeUtcOffsetHours, 2)
      );
   }

   return rates_total;
}
