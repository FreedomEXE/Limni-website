//+------------------------------------------------------------------+
//|                         LimniKataraktiArchitectureSidecar.mq5    |
//|                         Gate 99A visual event-state sidecar      |
//+------------------------------------------------------------------+
#property copyright "LIMNI LTD"
#property version   "1.00"
#property strict
#property indicator_chart_window
#property indicator_buffers 3
#property indicator_plots 3

#property indicator_label1 "LRMG Event Center"
#property indicator_type1 DRAW_LINE
#property indicator_color1 clrDeepSkyBlue
#property indicator_style1 STYLE_SOLID
#property indicator_width1 2

#property indicator_label2 "LRMG +1Q"
#property indicator_type2 DRAW_LINE
#property indicator_color2 clrDimGray
#property indicator_style2 STYLE_DOT
#property indicator_width2 1

#property indicator_label3 "LRMG -1Q"
#property indicator_type3 DRAW_LINE
#property indicator_color3 clrDimGray
#property indicator_style3 STYLE_DOT
#property indicator_width3 1

#include "Include\\LimniRadialMovementGrid.mqh"

const string DEFAULT_GRAMMAR_VERSION = "G99_VISUAL_EVENT_STATE_V0";
const string EVENT_CLOCK_TYPE = "LRMG_BRICK_CLOSE";
const string OUTPUT_FOLDER = "LimniKataraktiArchitectureSidecar";

input string GrammarVersion = "G99_VISUAL_EVENT_STATE_V0";
input ENUM_TIMEFRAMES SourceTimeframe = PERIOD_M1;
input string StartDate = "2026.01.01 00:00"; // fixed source start; blank = oldest loaded chart bar
input string EndDate = ""; // blank = current server time
input int RequestPaddingDays = 2;
input int LookbackBars = 12000; // latest source-bar cap; 0 = no cap
input int BootstrapBars = 720;
input bool UseClosedSourceBarsOnly = true;
input int MedianBrickWindow = 55;
input int MaxBricksPerBar = 200;
input int MaxEventsToProcess = 2500;

input int StochEvents = 100;
input int StochDSteps = 10;
input double Oversold = 10.0;
input double Overbought = 90.0;
input bool UseDForExhaustion = true;
input int MaxSetupAgeEvents = 8;

input int DavidEventPeriod = 35;
input double DavidFlatToleranceQ = 0.05;

input bool DrawSignalArrows = true;
input bool DrawStateLabels = false;
input int MaxMarkersToDraw = 240;
input bool DrawPanel = false;
input bool ExportReceipts = true;
input bool ExportToCommonFiles = true;
input bool ShowDebugComment = false;

input color LongArrowColor = clrLimeGreen;
input color ShortArrowColor = clrTomato;
input int ArrowSize = 2;
input color SetupColor = clrWhite; // debug text only
input color ArmedColor = clrGold; // debug text only
input color ConfirmedColor = clrLimeGreen; // debug text only
input color InvalidatedColor = clrTomato; // debug text only
input color StaleColor = clrSilver; // debug text only
input color ConflictColor = clrOrange; // debug text only

double CenterBuffer[];
double UpperBuffer[];
double LowerBuffer[];

string PREFIX = "LIMNI_G99A_SIDECAR_";

enum LimniCompositeState
{
   STATE_NONE = 0,
   STATE_SETUP = 1,
   STATE_ARMED = 2,
   STATE_CONFIRMED = 3,
   STATE_INVALIDATED = 4,
   STATE_STALE = 5,
   STATE_CONFLICT = 6
};

enum LimniSide
{
   SIDE_SHORT = -1,
   SIDE_NONE = 0,
   SIDE_LONG = 1
};

enum LimniDavidEventState
{
   DAVID_EVENT_DOWN = -1,
   DAVID_EVENT_FLAT = 0,
   DAVID_EVENT_UP = 1
};

struct LimniVisualEvent
{
   int id;
   datetime time;
   double price;
   double center;
   double quantum;
   double level;
   double median_level;
   string lrmg_side;
   string lrmg_structure;
   double stoch_main;
   double stoch_d;
   int stoch_state;
   int david_state;
   int david_previous_state;
   int david_flip;
};

struct LimniReceiptRow
{
   int event_id;
   datetime time;
   double price;
   double center;
   double quantum;
   string lrmg_side;
   string lrmg_structure;
   double stoch_main;
   double stoch_d;
   string stoch_state;
   int stoch_age;
   string david_state;
   string david_previous_state;
   string david_flip;
   string composite_state;
   string side;
   string reason_code;
};

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

int ChronIndex(const int total, const bool series, const int logical_index)
{
   if(series)
      return total - 1 - logical_index;
   return logical_index;
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

void AppendClosedLevel(double &levels[], int &count, const double level)
{
   ArrayResize(levels, count + 1);
   levels[count] = level;
   count++;
}

double MedianBrickLevel(const double &levels[], const int count, const int window)
{
   if(count <= 0)
      return 0.0;

   int start_index = 0;
   if(window > 0)
      start_index = MathMax(0, count - window);

   int sample_count = count - start_index;
   if(sample_count <= 0)
      return 0.0;

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

string PriceText(const double value)
{
   if(!MathIsValidNumber(value) || value == EMPTY_VALUE)
      return "";
   return DoubleToString(value, _Digits);
}

string NumberText(const double value, const int digits = 6)
{
   if(!MathIsValidNumber(value) || value == EMPTY_VALUE)
      return "";
   return DoubleToString(value, digits);
}

string Stamp(const datetime value)
{
   return TimeToString(value, TIME_DATE | TIME_MINUTES | TIME_SECONDS);
}

string SafePart(string value)
{
   StringReplace(value, "\\", "_");
   StringReplace(value, "/", "_");
   StringReplace(value, ":", "_");
   StringReplace(value, " ", "_");
   StringReplace(value, ".", "_");
   return value;
}

string ConfigHash()
{
   string key = GrammarVersion + "|" +
      EnumToString(SourceTimeframe) + "|" +
      IntegerToString(BootstrapBars) + "|" +
      IntegerToString(MedianBrickWindow) + "|" +
      IntegerToString(StochEvents) + "|" +
      IntegerToString(StochDSteps) + "|" +
      DoubleToString(Oversold, 4) + "|" +
      DoubleToString(Overbought, 4) + "|" +
      (UseDForExhaustion ? "D" : "MAIN") + "|" +
      IntegerToString(MaxSetupAgeEvents) + "|" +
      IntegerToString(DavidEventPeriod) + "|" +
      DoubleToString(DavidFlatToleranceQ, 4) + "|" +
      StartDate + "|" +
      EndDate + "|" +
      IntegerToString(LookbackBars);

   uint hash = 2166136261;
   for(int i = 0; i < StringLen(key); i++)
   {
      hash = hash ^ (uint)StringGetCharacter(key, i);
      hash = hash * 16777619;
   }

   return StringFormat("%08X", hash);
}

string CompositeName(const int state)
{
   if(state == STATE_SETUP)
      return "SETUP";
   if(state == STATE_ARMED)
      return "ARMED";
   if(state == STATE_CONFIRMED)
      return "CONFIRMED";
   if(state == STATE_INVALIDATED)
      return "INVALIDATED";
   if(state == STATE_STALE)
      return "STALE";
   if(state == STATE_CONFLICT)
      return "CONFLICT";
   return "NONE";
}

string SideName(const int side)
{
   if(side == SIDE_LONG)
      return "LONG";
   if(side == SIDE_SHORT)
      return "SHORT";
   return "NONE";
}

string StochStateName(const int state)
{
   if(state == SIDE_LONG)
      return "STOCH_OVERSOLD";
   if(state == SIDE_SHORT)
      return "STOCH_OVERBOUGHT";
   return "STOCH_NEUTRAL";
}

string DavidStateName(const int state)
{
   if(state == DAVID_EVENT_UP)
      return "DAVID_EVENT_UP";
   if(state == DAVID_EVENT_DOWN)
      return "DAVID_EVENT_DOWN";
   return "DAVID_EVENT_FLAT";
}

string DavidFlipName(const int flip)
{
   if(flip == DAVID_EVENT_UP)
      return "DAVID_FLIP_UP";
   if(flip == DAVID_EVENT_DOWN)
      return "DAVID_FLIP_DOWN";
   return "NONE";
}

color StateColor(const string state)
{
   if(state == "SETUP")
      return SetupColor;
   if(state == "ARMED")
      return ArmedColor;
   if(state == "CONFIRMED")
      return ConfirmedColor;
   if(state == "INVALIDATED")
      return InvalidatedColor;
   if(state == "STALE")
      return StaleColor;
   if(state == "CONFLICT")
      return ConflictColor;
   return clrWhite;
}

string ObjName(const string kind, const int index)
{
   return PREFIX + _Symbol + "_" + EnumToString((ENUM_TIMEFRAMES)_Period) + "_" + kind + "_" + IntegerToString(index);
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

void AppendEvent(
   LimniVisualEvent &events[],
   int &event_count,
   const datetime event_time,
   const double price,
   const double center,
   const double quantum,
   const double level,
   const double median_level
)
{
   if(MaxEventsToProcess > 0 && event_count >= MaxEventsToProcess)
      return;

   ArrayResize(events, event_count + 1);
   events[event_count].id = event_count + 1;
   events[event_count].time = event_time;
   events[event_count].price = price;
   events[event_count].center = center;
   events[event_count].quantum = quantum;
   events[event_count].level = level;
   events[event_count].median_level = median_level;
   events[event_count].lrmg_side = "LRMG_SIDE_CENTER";
   events[event_count].lrmg_structure = "LRMG_STRUCTURE_CENTER";
   events[event_count].stoch_main = EMPTY_VALUE;
   events[event_count].stoch_d = EMPTY_VALUE;
   events[event_count].stoch_state = SIDE_NONE;
   events[event_count].david_state = DAVID_EVENT_FLAT;
   events[event_count].david_previous_state = DAVID_EVENT_FLAT;
   events[event_count].david_flip = SIDE_NONE;
   event_count++;
}

bool BuildLrmgEvents(
   const MqlRates &source_rates[],
   const int source_count,
   LimniVisualEvent &events[],
   int &event_count
)
{
   ArrayResize(events, 0);
   event_count = 0;

   if(source_count < MathMax(50, BootstrapBars + 5))
      return false;

   datetime calc_time[];
   double calc_close[];
   ArrayResize(calc_time, source_count);
   ArrayResize(calc_close, source_count);

   for(int i = 0; i < source_count; i++)
   {
      calc_time[i] = source_rates[i].time;
      calc_close[i] = source_rates[i].close;
   }

   int bootstrap_end = MathMin(source_count - 1, MathMax(10, BootstrapBars) - 1);
   LimniRadialMap bootstrap;
   if(!LimniComputeMovementMap(calc_time, calc_close, 0, bootstrap_end, true, bootstrap))
      return false;

   double quantum = bootstrap.radius;
   if(quantum <= 0.0 || !MathIsValidNumber(quantum))
      return false;

   double base_price = source_rates[0].close;
   int current_level = 0;
   int max_bricks = MathMax(1, MaxBricksPerBar);
   double closed_levels[];
   int closed_level_count = 0;

   for(int i = 0; i < source_count; i++)
   {
      int guard = 0;
      while(source_rates[i].close >= base_price + ((double)current_level + 1.0) * quantum && guard < max_bricks)
      {
         current_level++;
         AppendClosedLevel(closed_levels, closed_level_count, (double)current_level);
         double median_level = MedianBrickLevel(closed_levels, closed_level_count, MedianBrickWindow);
         AppendEvent(events, event_count, source_rates[i].time, base_price + (double)current_level * quantum,
            base_price + median_level * quantum, quantum, (double)current_level, median_level);
         guard++;
      }

      guard = 0;
      while(source_rates[i].close <= base_price + ((double)current_level - 1.0) * quantum && guard < max_bricks)
      {
         current_level--;
         AppendClosedLevel(closed_levels, closed_level_count, (double)current_level);
         double median_level = MedianBrickLevel(closed_levels, closed_level_count, MedianBrickWindow);
         AppendEvent(events, event_count, source_rates[i].time, base_price + (double)current_level * quantum,
            base_price + median_level * quantum, quantum, (double)current_level, median_level);
         guard++;
      }
   }

   return event_count > 0;
}

double EventLwma(const LimniVisualEvent &events[], const int index, const int period)
{
   int p = MathMax(1, period);
   if(index + 1 < p)
      return EMPTY_VALUE;

   double weighted_sum = 0.0;
   double weight_sum = 0.0;
   int start = index - p + 1;
   for(int i = start; i <= index; i++)
   {
      double weight = (double)(i - start + 1);
      weighted_sum += events[i].price * weight;
      weight_sum += weight;
   }

   if(weight_sum <= 0.0)
      return EMPTY_VALUE;

   return weighted_sum / weight_sum;
}

void AnnotateEvents(LimniVisualEvent &events[], const int event_count)
{
   double main_values[];
   ArrayResize(main_values, event_count);
   for(int i = 0; i < event_count; i++)
      main_values[i] = EMPTY_VALUE;

   for(int i = 0; i < event_count; i++)
   {
      double q_distance = events[i].quantum > 0.0 ? (events[i].price - events[i].center) / events[i].quantum : 0.0;
      if(q_distance > 0.10)
      {
         events[i].lrmg_side = "LRMG_SIDE_ABOVE";
         events[i].lrmg_structure = "LRMG_STRUCTURE_ABOVE_CENTER";
      }
      else if(q_distance < -0.10)
      {
         events[i].lrmg_side = "LRMG_SIDE_BELOW";
         events[i].lrmg_structure = "LRMG_STRUCTURE_BELOW_CENTER";
      }
      else
      {
         events[i].lrmg_side = "LRMG_SIDE_CENTER";
         events[i].lrmg_structure = "LRMG_STRUCTURE_CENTER";
      }

      int stoch_start = MathMax(0, i - MathMax(1, StochEvents) + 1);
      double lo = events[stoch_start].price;
      double hi = events[stoch_start].price;
      for(int j = stoch_start; j <= i; j++)
      {
         lo = MathMin(lo, events[j].price);
         hi = MathMax(hi, events[j].price);
      }

      if(hi > lo)
         main_values[i] = 100.0 * (events[i].price - lo) / (hi - lo);

      events[i].stoch_main = main_values[i];

      double d_sum = 0.0;
      int d_count = 0;
      int d_start = MathMax(0, i - MathMax(1, StochDSteps) + 1);
      for(int j = d_start; j <= i; j++)
      {
         if(main_values[j] != EMPTY_VALUE && MathIsValidNumber(main_values[j]))
         {
            d_sum += main_values[j];
            d_count++;
         }
      }

      if(d_count > 0)
         events[i].stoch_d = d_sum / (double)d_count;

      double stoch_probe = UseDForExhaustion ? events[i].stoch_d : events[i].stoch_main;
      if(stoch_probe != EMPTY_VALUE && MathIsValidNumber(stoch_probe))
      {
         if(stoch_probe <= Oversold)
            events[i].stoch_state = SIDE_LONG;
         else if(stoch_probe >= Overbought)
            events[i].stoch_state = SIDE_SHORT;
         else
            events[i].stoch_state = SIDE_NONE;
      }

      double current_ma = EventLwma(events, i, DavidEventPeriod);
      double previous_ma = i > 0 ? EventLwma(events, i - 1, DavidEventPeriod) : EMPTY_VALUE;
      int previous_state = i > 0 ? events[i - 1].david_state : DAVID_EVENT_FLAT;
      events[i].david_previous_state = previous_state;

      if(current_ma != EMPTY_VALUE && previous_ma != EMPTY_VALUE && events[i].quantum > 0.0)
      {
         double slope_q = (current_ma - previous_ma) / events[i].quantum;
         if(slope_q > DavidFlatToleranceQ)
            events[i].david_state = DAVID_EVENT_UP;
         else if(slope_q < -DavidFlatToleranceQ)
            events[i].david_state = DAVID_EVENT_DOWN;
         else
            events[i].david_state = DAVID_EVENT_FLAT;
      }

      if(previous_state != DAVID_EVENT_FLAT &&
         events[i].david_state != DAVID_EVENT_FLAT &&
         previous_state != events[i].david_state)
      {
         events[i].david_flip = events[i].david_state;
      }
   }
}

void AddReceipt(
   LimniReceiptRow &rows[],
   int &row_count,
   const LimniVisualEvent &event,
   const int composite_state,
   const int side,
   const string reason_code,
   const int stoch_age
)
{
   ArrayResize(rows, row_count + 1);
   rows[row_count].event_id = event.id;
   rows[row_count].time = event.time;
   rows[row_count].price = event.price;
   rows[row_count].center = event.center;
   rows[row_count].quantum = event.quantum;
   rows[row_count].lrmg_side = event.lrmg_side;
   rows[row_count].lrmg_structure = event.lrmg_structure;
   rows[row_count].stoch_main = event.stoch_main;
   rows[row_count].stoch_d = event.stoch_d;
   rows[row_count].stoch_state = StochStateName(event.stoch_state);
   rows[row_count].stoch_age = stoch_age;
   rows[row_count].david_state = DavidStateName(event.david_state);
   rows[row_count].david_previous_state = DavidStateName(event.david_previous_state);
   rows[row_count].david_flip = DavidFlipName(event.david_flip);
   rows[row_count].composite_state = CompositeName(composite_state);
   rows[row_count].side = SideName(side);
   rows[row_count].reason_code = reason_code;
   row_count++;
}

void BuildCompositeReceipts(
   const LimniVisualEvent &events[],
   const int event_count,
   LimniReceiptRow &rows[],
   int &row_count
)
{
   ArrayResize(rows, 0);
   row_count = 0;

   bool long_active = false;
   bool short_active = false;
   bool long_armed = false;
   bool short_armed = false;
   int long_start_event = -1;
   int short_start_event = -1;

   for(int i = 0; i < event_count; i++)
   {
      const LimniVisualEvent event = events[i];

      if(long_active && short_active)
      {
         AddReceipt(rows, row_count, event, STATE_CONFLICT, SIDE_NONE, "FAIL_SEQUENCE_ORDER_INVALID", 0);
         long_active = false;
         short_active = false;
         long_armed = false;
         short_armed = false;
      }

      if(event.stoch_state == SIDE_LONG && !long_active)
      {
         long_active = true;
         long_armed = false;
         long_start_event = i;
         AddReceipt(rows, row_count, event, STATE_SETUP, SIDE_LONG, "STOCH_OVERSOLD_ENTER", 0);
      }
      else if(event.stoch_state == SIDE_SHORT && !short_active)
      {
         short_active = true;
         short_armed = false;
         short_start_event = i;
         AddReceipt(rows, row_count, event, STATE_SETUP, SIDE_SHORT, "STOCH_OVERBOUGHT_ENTER", 0);
      }

      if(long_active)
      {
         int age = i - long_start_event;
         if(age > MaxSetupAgeEvents)
         {
            AddReceipt(rows, row_count, event, STATE_STALE, SIDE_LONG, "FAIL_SIGNAL_STALE", age);
            long_active = false;
            long_armed = false;
         }
         else if(event.lrmg_side == "LRMG_SIDE_ABOVE")
         {
            AddReceipt(rows, row_count, event, STATE_INVALIDATED, SIDE_LONG, "FAIL_LRMG_SIDE_CONFLICT", age);
            long_active = false;
            long_armed = false;
         }
         else
         {
            if(!long_armed && event.lrmg_side == "LRMG_SIDE_BELOW")
            {
               long_armed = true;
               AddReceipt(rows, row_count, event, STATE_ARMED, SIDE_LONG, "LRMG_LONG_ARMED", age);
            }

            if(long_armed && event.david_flip == DAVID_EVENT_UP)
            {
               AddReceipt(rows, row_count, event, STATE_CONFIRMED, SIDE_LONG, "DAVID_FLIP_UP_CONFIRMED", age);
               long_active = false;
               long_armed = false;
            }
            else if(long_armed && event.david_flip == DAVID_EVENT_DOWN)
            {
               AddReceipt(rows, row_count, event, STATE_INVALIDATED, SIDE_LONG, "FAIL_DAVID_WRONG_DIRECTION", age);
               long_active = false;
               long_armed = false;
            }
         }
      }

      if(short_active)
      {
         int age = i - short_start_event;
         if(age > MaxSetupAgeEvents)
         {
            AddReceipt(rows, row_count, event, STATE_STALE, SIDE_SHORT, "FAIL_SIGNAL_STALE", age);
            short_active = false;
            short_armed = false;
         }
         else if(event.lrmg_side == "LRMG_SIDE_BELOW")
         {
            AddReceipt(rows, row_count, event, STATE_INVALIDATED, SIDE_SHORT, "FAIL_LRMG_SIDE_CONFLICT", age);
            short_active = false;
            short_armed = false;
         }
         else
         {
            if(!short_armed && event.lrmg_side == "LRMG_SIDE_ABOVE")
            {
               short_armed = true;
               AddReceipt(rows, row_count, event, STATE_ARMED, SIDE_SHORT, "LRMG_SHORT_ARMED", age);
            }

            if(short_armed && event.david_flip == DAVID_EVENT_DOWN)
            {
               AddReceipt(rows, row_count, event, STATE_CONFIRMED, SIDE_SHORT, "DAVID_FLIP_DOWN_CONFIRMED", age);
               short_active = false;
               short_armed = false;
            }
            else if(short_armed && event.david_flip == DAVID_EVENT_UP)
            {
               AddReceipt(rows, row_count, event, STATE_INVALIDATED, SIDE_SHORT, "FAIL_DAVID_WRONG_DIRECTION", age);
               short_active = false;
               short_armed = false;
            }
         }
      }
   }
}

void ProjectBandsToChart(
   const datetime &time[],
   const int rates_total,
   const bool chart_series,
   const LimniVisualEvent &events[],
   const int event_count
)
{
   if(event_count <= 0)
      return;

   int event_index = 0;
   for(int logical = 0; logical < rates_total; logical++)
   {
      int idx = ChronIndex(rates_total, chart_series, logical);
      datetime bar_time = time[idx];

      while(event_index + 1 < event_count && events[event_index + 1].time <= bar_time)
         event_index++;

      if(events[event_index].time <= bar_time)
      {
         CenterBuffer[idx] = events[event_index].center;
         UpperBuffer[idx] = events[event_index].center + events[event_index].quantum;
         LowerBuffer[idx] = events[event_index].center - events[event_index].quantum;
      }
   }
}

void DrawReceiptLabel(const LimniReceiptRow &row, const int draw_index)
{
   double q = row.quantum > 0.0 ? row.quantum : _Point * 100.0;
   double y = row.price;
   if(row.side == "LONG")
      y = row.price - q * 0.55;
   else if(row.side == "SHORT")
      y = row.price + q * 0.55;

   if(DrawSignalArrows && row.composite_state == "CONFIRMED" && (row.side == "LONG" || row.side == "SHORT"))
   {
      string arrow_name = ObjName("ARROW", draw_index);
      ObjectCreate(0, arrow_name, OBJ_ARROW, 0, row.time, y);
      ObjectSetInteger(0, arrow_name, OBJPROP_ARROWCODE, row.side == "LONG" ? 233 : 234);
      ObjectSetInteger(0, arrow_name, OBJPROP_COLOR, row.side == "LONG" ? LongArrowColor : ShortArrowColor);
      ObjectSetInteger(0, arrow_name, OBJPROP_WIDTH, ArrowSize);
      ObjectSetInteger(0, arrow_name, OBJPROP_SELECTABLE, false);
      ObjectSetInteger(0, arrow_name, OBJPROP_BACK, false);
   }

   if(!DrawStateLabels)
      return;

   string name = ObjName("STATE", draw_index);
   ObjectCreate(0, name, OBJ_TEXT, 0, row.time, y);
   ObjectSetString(0, name, OBJPROP_TEXT, row.side + " " + row.composite_state);
   ObjectSetString(0, name, OBJPROP_FONT, "Arial");
   ObjectSetInteger(0, name, OBJPROP_FONTSIZE, 8);
   ObjectSetInteger(0, name, OBJPROP_COLOR, StateColor(row.composite_state));
   ObjectSetInteger(0, name, OBJPROP_ANCHOR, ANCHOR_CENTER);
   ObjectSetInteger(0, name, OBJPROP_BACK, false);
}

void DrawStatusPanel(
   const int event_count,
   const int row_count,
   const string latest_state,
   const string latest_reason,
   const string hash
)
{
   if(!DrawPanel)
      return;

   string name = ObjName("PANEL", 0);
   ObjectCreate(0, name, OBJ_LABEL, 0, 0, 0);
   ObjectSetInteger(0, name, OBJPROP_CORNER, CORNER_LEFT_UPPER);
   ObjectSetInteger(0, name, OBJPROP_XDISTANCE, 12);
   ObjectSetInteger(0, name, OBJPROP_YDISTANCE, 18);
   ObjectSetInteger(0, name, OBJPROP_COLOR, clrWhite);
   ObjectSetInteger(0, name, OBJPROP_FONTSIZE, 9);
   ObjectSetString(0, name, OBJPROP_FONT, "Consolas");

   string text = "Gate 99A Visual State Sidecar\n" +
      "grammar=" + GrammarVersion + "\n" +
      "clock=" + EVENT_CLOCK_TYPE + "\n" +
      "events=" + IntegerToString(event_count) + " receipts=" + IntegerToString(row_count) + "\n" +
      "latest=" + latest_state + "\n" +
      "reason=" + latest_reason + "\n" +
      "config=" + hash;

   ObjectSetString(0, name, OBJPROP_TEXT, text);
}

void DrawReceipts(const LimniReceiptRow &rows[], const int row_count, const int event_count, const string hash)
{
   DeleteObjects();

   int start = 0;
   if(MaxMarkersToDraw > 0 && row_count > MaxMarkersToDraw)
      start = row_count - MaxMarkersToDraw;

   int draw_index = 0;
   for(int i = start; i < row_count; i++)
   {
      DrawReceiptLabel(rows[i], draw_index);
      draw_index++;
   }

   string latest_state = row_count > 0 ? rows[row_count - 1].composite_state : "NONE";
   string latest_reason = row_count > 0 ? rows[row_count - 1].reason_code : "NO_RECEIPTS";
   DrawStatusPanel(event_count, row_count, latest_state, latest_reason, hash);
}

void WriteReceipts(const LimniReceiptRow &rows[], const int row_count, const string hash)
{
   if(!ExportReceipts)
      return;

   int file_scope = ExportToCommonFiles ? FILE_COMMON : 0;
   FolderCreate(OUTPUT_FOLDER, file_scope);
   string file_name = OUTPUT_FOLDER + "\\" + SafePart(_Symbol) + "_" +
      SafePart(EnumToString((ENUM_TIMEFRAMES)_Period)) + "_gate99a_event_state.csv";

   int handle = FileOpen(file_name, FILE_WRITE | FILE_CSV | FILE_ANSI | file_scope, ',');
   if(handle == INVALID_HANDLE)
      return;

   FileWrite(
      handle,
      "event_id",
      "timestamp",
      "symbol",
      "display_timeframe",
      "event_clock_type",
      "event_price",
      "lrmg_center",
      "lrmg_quantum",
      "lrmg_side",
      "lrmg_structure",
      "stoch_main",
      "stoch_d",
      "stoch_state",
      "stoch_exhaustion_age_events",
      "david_state",
      "david_previous_state",
      "david_flip",
      "composite_state",
      "side",
      "reason_code",
      "grammar_version",
      "config_hash"
   );

   for(int i = 0; i < row_count; i++)
   {
      FileWrite(
         handle,
         rows[i].event_id,
         Stamp(rows[i].time),
         _Symbol,
         EnumToString((ENUM_TIMEFRAMES)_Period),
         EVENT_CLOCK_TYPE,
         PriceText(rows[i].price),
         PriceText(rows[i].center),
         NumberText(rows[i].quantum, 8),
         rows[i].lrmg_side,
         rows[i].lrmg_structure,
         NumberText(rows[i].stoch_main, 4),
         NumberText(rows[i].stoch_d, 4),
         rows[i].stoch_state,
         rows[i].stoch_age,
         rows[i].david_state,
         rows[i].david_previous_state,
         rows[i].david_flip,
         rows[i].composite_state,
         rows[i].side,
         rows[i].reason_code,
         GrammarVersion,
         hash
      );
   }

   FileFlush(handle);
   FileClose(handle);
}

int OnInit()
{
   SetIndexBuffer(0, CenterBuffer, INDICATOR_DATA);
   SetIndexBuffer(1, UpperBuffer, INDICATOR_DATA);
   SetIndexBuffer(2, LowerBuffer, INDICATOR_DATA);
   PlotIndexSetDouble(0, PLOT_EMPTY_VALUE, EMPTY_VALUE);
   PlotIndexSetDouble(1, PLOT_EMPTY_VALUE, EMPTY_VALUE);
   PlotIndexSetDouble(2, PLOT_EMPTY_VALUE, EMPTY_VALUE);
   IndicatorSetString(INDICATOR_SHORTNAME, "Limni Katarakti Architecture Sidecar");
   IndicatorSetInteger(INDICATOR_DIGITS, _Digits);
   DeleteObjects();
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
   for(int i = 0; i < rates_total; i++)
   {
      CenterBuffer[i] = EMPTY_VALUE;
      UpperBuffer[i] = EMPTY_VALUE;
      LowerBuffer[i] = EMPTY_VALUE;
   }

   if(rates_total < 50)
      return rates_total;

   ENUM_TIMEFRAMES source_period = SourceTimeframe;
   if(source_period == PERIOD_CURRENT)
      source_period = PERIOD_M1;

   datetime chart_oldest = 0;
   datetime chart_newest = 0;
   ChartTimeRange(time, rates_total, chart_oldest, chart_newest);
   if(chart_oldest <= 0 || chart_newest <= 0)
      return rates_total;

   int padding_days = MathMax(0, RequestPaddingDays);
   datetime fallback_start = (datetime)(chart_oldest - (long)padding_days * 86400);
   datetime fallback_end = TimeCurrent();
   if(fallback_end <= 0)
      fallback_end = (datetime)(chart_newest + (long)MathMax(1, padding_days) * 86400);
   datetime request_start = ParseInputDate(StartDate, fallback_start);
   datetime request_end = ParseInputDate(EndDate, fallback_end);
   if(request_end < chart_newest)
      request_end = chart_newest;

   datetime local_first = 0;
   if(SeriesFirstDate(source_period, local_first) && local_first > request_start)
      request_start = local_first;

   if(request_end <= request_start)
      return rates_total;

   MqlRates source_rates[];
   ArraySetAsSeries(source_rates, false);
   ResetLastError();
   int copied = CopyRates(_Symbol, source_period, request_start, request_end, source_rates);
   int copy_error = GetLastError();
   if(copied < 50)
   {
      if(ShowDebugComment)
      {
         Comment(
            "Limni Katarakti Architecture Sidecar\n",
            "source data unavailable or too short\n",
            "requested: ", TimeToString(request_start, TIME_DATE | TIME_MINUTES),
            " -> ", TimeToString(request_end, TIME_DATE | TIME_MINUTES), "\n",
            "copied: ", IntegerToString(copied), "\n",
            "error: ", IntegerToString(copy_error)
         );
      }
      return rates_total;
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

   ApplyLookbackCap(source_rates, copied);
   if(UseClosedSourceBarsOnly && copied > 1)
      copied--;

   LimniVisualEvent events[];
   int event_count = 0;
   if(!BuildLrmgEvents(source_rates, copied, events, event_count))
      return rates_total;

   AnnotateEvents(events, event_count);

   LimniReceiptRow rows[];
   int row_count = 0;
   BuildCompositeReceipts(events, event_count, rows, row_count);

   bool chart_series = ArrayGetAsSeries(time);
   ProjectBandsToChart(time, rates_total, chart_series, events, event_count);

   string hash = ConfigHash();
   DrawReceipts(rows, row_count, event_count, hash);
   WriteReceipts(rows, row_count, hash);

   if(ShowDebugComment)
   {
      Comment(
         "Limni Katarakti Architecture Sidecar\n",
         "grammar: ", GrammarVersion, "\n",
         "clock: ", EVENT_CLOCK_TYPE, "\n",
         "source: ", EnumToString(source_period), "\n",
         "events: ", IntegerToString(event_count), "\n",
         "receipts: ", IntegerToString(row_count), "\n",
         "config: ", hash
      );
   }

   return rates_total;
}
