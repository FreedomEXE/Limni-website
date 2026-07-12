//+------------------------------------------------------------------+
//|                                      LimniRadialMovementGrid.mq5 |
//|                                      Copyright 2026, LIMNI Ltd.  |
//|                                      Visual review indicator     |
//+------------------------------------------------------------------+
#property copyright "LIMNI LTD"
#property version   "1.00"
#property indicator_chart_window
#property indicator_plots 0

#include "Include\\LimniRadialMovementGrid.mqh"

input ENUM_TIMEFRAMES SourceTimeframe = PERIOD_M1;
input int    LookbackBars = 8000;
input int    BootstrapBars = 720;
input bool   UseClosedBarsOnly = true;

input int    ShellsToDraw = 4;
input int    MaxMarkersToDraw = 140;
input int    MaxCompletedBasinsToDraw = 18;
input bool   DrawCurrentBasinTrace = true;
input bool   DrawCompletedBasinTrace = true;
input bool   DrawProvisionalGeometry = true;
input bool   ShowDebugComment = false;

input bool   BrickStudyView = true; // default visual mode: bricks + median track, no raw shell-cross spam
input int    MaxBricksToDraw = 260;
input int    MedianBrickWindow = 55; // closed-brick median track; 0 = all loaded closed bricks
input double ManualBrickSizePoints = 0.0; // 0 = bootstrap movement radius
input bool   ShowBrickShellGuides = false;
input int    BrickWidthSeconds = 45;
input int    BrickBorderWidth = 1;
input int    BrickPixelWidth = 12;
input int    BrickPixelHeight = 12;
input int    BrickPixelGap = 2;
input int    StudyPanelPadding = 18;
input int    StudyPanelHeader = 74;

input color  CenterColor = clrDeepSkyBlue;
input color  ShellColor = clrSlateGray;
input color  PositiveShellColor = clrTomato;
input color  NegativeShellColor = clrLimeGreen;
input color  ProvisionalColor = clrGold;
input color  BasinTraceColor = clrDodgerBlue;
input color  CompletedBasinColor = clrDarkSlateGray;
input color  CenterMarkerColor = clrWhite;
input color  UpBrickColor = clrLimeGreen;
input color  DownBrickColor = clrTomato;
input color  MedianTrackColor = clrDeepSkyBlue;
input color  StartMarkerColor = clrWhite;
input color  AddMarkerColor = clrGold;
input color  TargetMarkerColor = clrAqua;
input color  StudyBackgroundColor = clrBlack;
input color  StudyGridColor = clrDimGray;
input color  StudyTextColor = clrWhite;
input int    CenterLineWidth = 2;
input int    ShellLineWidth = 1;
input int    MarkerSize = 2;

string PREFIX = "LIMNI_RADIAL_GRID_";

enum LimniRadialEventKind
{
   LRG_EVENT_POSITIVE_SHELL = 1,
   LRG_EVENT_NEGATIVE_SHELL = 2,
   LRG_EVENT_CENTER_CROSS = 3,
   LRG_EVENT_ORBIT_COMPLETE = 4
};

struct LimniRadialEvent
{
   datetime time;
   double   price;
   int      kind;
   int      shell;
   double   z;
};

struct LimniRadialBasinBox
{
   datetime start_time;
   datetime end_time;
   double   high;
   double   low;
   bool     complete;
};

struct LimniStudyBrick
{
   datetime time;
   double   open;
   double   close;
   double   median;
   double   z;
   int      direction;
   int      shell;
   int      event_kind;
   int      depth;
};

enum LimniStudyEventKind
{
   LRG_STUDY_NONE = 0,
   LRG_STUDY_START_LONG = 1,
   LRG_STUDY_START_SHORT = 2,
   LRG_STUDY_ADD_LONG = 3,
   LRG_STUDY_ADD_SHORT = 4,
   LRG_STUDY_TARGET_LONG = 5,
   LRG_STUDY_TARGET_SHORT = 6
};

enum LimniStudyState
{
   LRG_STUDY_INACTIVE = 0,
   LRG_STUDY_LONG_ACTIVE = 1,
   LRG_STUDY_SHORT_ACTIVE = 2
};

string ObjName(const string kind, const int index)
{
   return PREFIX + _Symbol + "_" + EnumToString(SourceTimeframe) + "_" + kind + "_" + IntegerToString(index);
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

void AddEvent(
   LimniRadialEvent &events[],
   int &event_count,
   const datetime event_time,
   const double price,
   const int kind,
   const int shell,
   const double z
)
{
   ArrayResize(events, event_count + 1);
   events[event_count].time = event_time;
   events[event_count].price = price;
   events[event_count].kind = kind;
   events[event_count].shell = shell;
   events[event_count].z = z;
   event_count++;
}

void AddBasinBox(
   LimniRadialBasinBox &boxes[],
   int &box_count,
   const datetime start_time,
   const datetime end_time,
   const double high,
   const double low,
   const bool complete
)
{
   ArrayResize(boxes, box_count + 1);
   boxes[box_count].start_time = start_time;
   boxes[box_count].end_time = end_time;
   boxes[box_count].high = high;
   boxes[box_count].low = low;
   boxes[box_count].complete = complete;
   box_count++;
}

void RangeForIndices(
   const double &high[],
   const double &low[],
   const int start_index,
   const int end_index,
   double &range_high,
   double &range_low
)
{
   range_high = -1.0e100;
   range_low = 1.0e100;

   for(int i = start_index; i <= end_index; i++)
   {
      if(high[i] > range_high)
         range_high = high[i];
      if(low[i] < range_low)
         range_low = low[i];
   }
}

void DrawHLine(
   const string name,
   const double price,
   const color line_color,
   const ENUM_LINE_STYLE style,
   const int width,
   const bool back
)
{
   if(ObjectFind(0, name) < 0)
      ObjectCreate(0, name, OBJ_HLINE, 0, 0, price);

   ObjectSetDouble(0, name, OBJPROP_PRICE, price);
   ObjectSetInteger(0, name, OBJPROP_COLOR, line_color);
   ObjectSetInteger(0, name, OBJPROP_STYLE, style);
   ObjectSetInteger(0, name, OBJPROP_WIDTH, width);
   ObjectSetInteger(0, name, OBJPROP_BACK, back);
   ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
   ObjectSetInteger(0, name, OBJPROP_HIDDEN, true);
}

void DrawTextLabel(
   const string name,
   const string text,
   const int x,
   const int y,
   const color text_color,
   const int font_size
)
{
   if(ObjectFind(0, name) < 0)
      ObjectCreate(0, name, OBJ_LABEL, 0, 0, 0);

   ObjectSetInteger(0, name, OBJPROP_CORNER, CORNER_LEFT_UPPER);
   ObjectSetInteger(0, name, OBJPROP_XDISTANCE, x);
   ObjectSetInteger(0, name, OBJPROP_YDISTANCE, y);
   ObjectSetInteger(0, name, OBJPROP_COLOR, text_color);
   ObjectSetInteger(0, name, OBJPROP_FONTSIZE, font_size);
   ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
   ObjectSetInteger(0, name, OBJPROP_HIDDEN, true);
   ObjectSetString(0, name, OBJPROP_TEXT, text);
}

void DrawBasinRectangle(
   const string name,
   const datetime start_time,
   const datetime end_time,
   const double top,
   const double bottom,
   const color rect_color,
   const ENUM_LINE_STYLE style,
   const bool fill
)
{
   if(start_time <= 0 || end_time <= start_time || top <= bottom)
      return;

   if(ObjectFind(0, name) < 0)
      ObjectCreate(0, name, OBJ_RECTANGLE, 0, start_time, top, end_time, bottom);

   ObjectSetInteger(0, name, OBJPROP_TIME, 0, start_time);
   ObjectSetDouble(0, name, OBJPROP_PRICE, 0, top);
   ObjectSetInteger(0, name, OBJPROP_TIME, 1, end_time);
   ObjectSetDouble(0, name, OBJPROP_PRICE, 1, bottom);
   ObjectSetInteger(0, name, OBJPROP_COLOR, rect_color);
   ObjectSetInteger(0, name, OBJPROP_STYLE, style);
   ObjectSetInteger(0, name, OBJPROP_WIDTH, 1);
   ObjectSetInteger(0, name, OBJPROP_FILL, fill);
   ObjectSetInteger(0, name, OBJPROP_BACK, true);
   ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
   ObjectSetInteger(0, name, OBJPROP_HIDDEN, true);
}

void DrawEventMarker(const LimniRadialEvent &event, const int draw_index)
{
   string name = ObjName("EVENT", draw_index);
   int arrow_code = 159;
   color marker_color = CenterMarkerColor;
   double price = event.price;

   if(event.kind == LRG_EVENT_POSITIVE_SHELL)
   {
      arrow_code = 234;
      marker_color = PositiveShellColor;
      price = event.price + _Point * 20.0;
   }
   else if(event.kind == LRG_EVENT_NEGATIVE_SHELL)
   {
      arrow_code = 233;
      marker_color = NegativeShellColor;
      price = event.price - _Point * 20.0;
   }
   else if(event.kind == LRG_EVENT_ORBIT_COMPLETE)
   {
      arrow_code = 159;
      marker_color = ProvisionalColor;
   }

   if(ObjectFind(0, name) < 0)
      ObjectCreate(0, name, OBJ_ARROW, 0, event.time, price);

   ObjectSetInteger(0, name, OBJPROP_TIME, event.time);
   ObjectSetDouble(0, name, OBJPROP_PRICE, price);
   ObjectSetInteger(0, name, OBJPROP_ARROWCODE, arrow_code);
   ObjectSetInteger(0, name, OBJPROP_COLOR, marker_color);
   ObjectSetInteger(0, name, OBJPROP_WIDTH, MarkerSize);
   ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
   ObjectSetInteger(0, name, OBJPROP_HIDDEN, true);
}

void DrawOfficialMap(const LimniRadialMap &map)
{
   if(!map.valid)
      return;

   DrawHLine(ObjName("CENTER", 0), map.center, CenterColor, STYLE_SOLID, CenterLineWidth, false);

   int shells = MathMax(1, ShellsToDraw);
   for(int k = 1; k <= shells; k++)
   {
      DrawHLine(ObjName("SHELL_POS", k), map.center + map.radius * k, ShellColor, STYLE_DOT, ShellLineWidth, true);
      DrawHLine(ObjName("SHELL_NEG", k), map.center - map.radius * k, ShellColor, STYLE_DOT, ShellLineWidth, true);
   }
}

void DrawProvisionalMap(const LimniRadialMap &map)
{
   if(!map.valid)
      return;

   DrawHLine(ObjName("PROV_CENTER", 0), map.center, ProvisionalColor, STYLE_DASH, 1, true);
   DrawHLine(ObjName("PROV_POS", 1), map.center + map.radius, ProvisionalColor, STYLE_DASHDOT, 1, true);
   DrawHLine(ObjName("PROV_NEG", 1), map.center - map.radius, ProvisionalColor, STYLE_DASHDOT, 1, true);
}

string StateLabel(const bool orbit_active, const bool touched_positive, const bool touched_negative, const double live_z)
{
   if(orbit_active && touched_positive && touched_negative)
      return "FULL ORBIT PENDING CENTER";
   if(live_z >= 1.0)
      return "POSITIVE EXCURSION";
   if(live_z <= -1.0)
      return "NEGATIVE EXCURSION";
   return "CENTERED";
}

void DrawPanel(
   const LimniRadialMap &map,
   const double live_z,
   const string state,
   const int event_count,
   const int completed_basin_count,
   const int copied_bars,
   const int processed_bars
)
{
   string source = EnumToString(SourceTimeframe);
   string map_type = map.bootstrap ? "BOOTSTRAP" : "FROZEN ORBIT";
   string text = StringFormat(
      "Limni Radial Movement Grid\n"
      "state: %s\n"
      "map: %s\n"
      "C: %s\n"
      "Q: %s\n"
      "z: %.3f\n"
      "movement: %s\n"
      "completed basins: %d\n"
      "events: %d\n"
      "source: %s  copied: %d  processed: %d",
      state,
      map_type,
      DoubleToString(map.center, _Digits),
      DoubleToString(map.radius, _Digits),
      live_z,
      DoubleToString(map.movement, _Digits),
      completed_basin_count,
      event_count,
      source,
      copied_bars,
      processed_bars
   );

   DrawTextLabel(ObjName("PANEL", 0), text, 12, 20, clrWhite, 10);
}

double MedianOfStudyBricks(const LimniStudyBrick &bricks[], const int end_index, const int window)
{
   int start_index = 0;
   if(window > 0)
      start_index = MathMax(0, end_index - window + 1);

   int count = end_index - start_index + 1;
   if(count <= 0)
      return 0.0;

   double values[];
   ArrayResize(values, count);
   for(int i = 0; i < count; i++)
      values[i] = bricks[start_index + i].close;

   ArraySort(values);

   int mid = count / 2;
   if((count % 2) == 1)
      return values[mid];

   return (values[mid - 1] + values[mid]) / 2.0;
}

int ShellFromZ(const double z)
{
   int shell = (int)MathFloor(MathAbs(z) + 1.0e-9);
   if(shell == 0)
      return 0;
   return z < 0.0 ? -shell : shell;
}

void AppendStudyBrick(
   LimniStudyBrick &bricks[],
   int &brick_count,
   datetime &last_brick_time,
   const datetime raw_time,
   const double open_price,
   const double close_price
)
{
   datetime brick_time = raw_time;
   if(brick_time <= last_brick_time)
      brick_time = (datetime)(last_brick_time + 1);

   ArrayResize(bricks, brick_count + 1);
   bricks[brick_count].time = brick_time;
   bricks[brick_count].open = open_price;
   bricks[brick_count].close = close_price;
   bricks[brick_count].median = 0.0;
   bricks[brick_count].z = 0.0;
   bricks[brick_count].direction = close_price >= open_price ? 1 : -1;
   bricks[brick_count].shell = 0;
   bricks[brick_count].event_kind = LRG_STUDY_NONE;
   bricks[brick_count].depth = 0;

   last_brick_time = brick_time;
   brick_count++;
}

void BuildStudyBricks(
   const datetime &calc_time[],
   const double &calc_close[],
   const int start_index,
   const int end_index,
   const double brick_size,
   LimniStudyBrick &bricks[],
   int &brick_count
)
{
   ArrayResize(bricks, 0);
   brick_count = 0;

   if(brick_size <= 0.0 || end_index <= start_index)
      return;

   double anchor = calc_close[start_index];
   datetime last_brick_time = calc_time[start_index];

   for(int i = start_index + 1; i <= end_index; i++)
   {
      double price = calc_close[i];
      int guard = 0;

      while(price >= anchor + brick_size && guard < 200)
      {
         double next_close = anchor + brick_size;
         AppendStudyBrick(bricks, brick_count, last_brick_time, calc_time[i], anchor, next_close);
         anchor = next_close;
         guard++;
      }

      guard = 0;
      while(price <= anchor - brick_size && guard < 200)
      {
         double next_close = anchor - brick_size;
         AppendStudyBrick(bricks, brick_count, last_brick_time, calc_time[i], anchor, next_close);
         anchor = next_close;
         guard++;
      }
   }
}

void AnnotateStudyBricks(LimniStudyBrick &bricks[], const int brick_count, const double brick_size)
{
   if(brick_count <= 0 || brick_size <= 0.0)
      return;

   int state = LRG_STUDY_INACTIVE;
   int depth = 0;

   for(int i = 0; i < brick_count; i++)
   {
      double median = MedianOfStudyBricks(bricks, i, MedianBrickWindow);
      double z = (bricks[i].close - median) / brick_size;
      int shell = ShellFromZ(z);

      bricks[i].median = median;
      bricks[i].z = z;
      bricks[i].shell = shell;
      bricks[i].event_kind = LRG_STUDY_NONE;
      bricks[i].depth = depth;

      if(state == LRG_STUDY_INACTIVE)
      {
         if(shell <= -1)
         {
            state = LRG_STUDY_LONG_ACTIVE;
            depth = 1;
            bricks[i].event_kind = LRG_STUDY_START_LONG;
            bricks[i].depth = depth;
         }
         else if(shell >= 1)
         {
            state = LRG_STUDY_SHORT_ACTIVE;
            depth = 1;
            bricks[i].event_kind = LRG_STUDY_START_SHORT;
            bricks[i].depth = depth;
         }
      }
      else if(state == LRG_STUDY_LONG_ACTIVE)
      {
         if(shell == 0)
         {
            bricks[i].event_kind = LRG_STUDY_TARGET_LONG;
            bricks[i].depth = depth;
            state = LRG_STUDY_INACTIVE;
            depth = 0;
         }
         else if(shell < 0 && MathAbs(shell) > depth)
         {
            depth = MathAbs(shell);
            bricks[i].event_kind = LRG_STUDY_ADD_LONG;
            bricks[i].depth = depth;
         }
      }
      else if(state == LRG_STUDY_SHORT_ACTIVE)
      {
         if(shell == 0)
         {
            bricks[i].event_kind = LRG_STUDY_TARGET_SHORT;
            bricks[i].depth = depth;
            state = LRG_STUDY_INACTIVE;
            depth = 0;
         }
         else if(shell > 0 && shell > depth)
         {
            depth = shell;
            bricks[i].event_kind = LRG_STUDY_ADD_SHORT;
            bricks[i].depth = depth;
         }
      }
   }
}

string StudyStateText(const LimniStudyBrick &bricks[], const int brick_count)
{
   if(brick_count <= 0)
      return "NO BRICKS";

   int state = LRG_STUDY_INACTIVE;
   int depth = 0;

   for(int i = 0; i < brick_count; i++)
   {
      int event_kind = bricks[i].event_kind;
      if(event_kind == LRG_STUDY_START_LONG)
      {
         state = LRG_STUDY_LONG_ACTIVE;
         depth = 1;
      }
      else if(event_kind == LRG_STUDY_START_SHORT)
      {
         state = LRG_STUDY_SHORT_ACTIVE;
         depth = 1;
      }
      else if(event_kind == LRG_STUDY_ADD_LONG || event_kind == LRG_STUDY_ADD_SHORT)
      {
         depth = bricks[i].depth;
      }
      else if(event_kind == LRG_STUDY_TARGET_LONG || event_kind == LRG_STUDY_TARGET_SHORT)
      {
         state = LRG_STUDY_INACTIVE;
         depth = 0;
      }
   }

   if(state == LRG_STUDY_LONG_ACTIVE)
      return "LONG ACTIVE | depth " + IntegerToString(depth);
   if(state == LRG_STUDY_SHORT_ACTIVE)
      return "SHORT ACTIVE | depth " + IntegerToString(depth);
   return "INACTIVE";
}

string EventText(const int event_kind, const int depth)
{
   if(event_kind == LRG_STUDY_START_LONG)
      return "L";
   if(event_kind == LRG_STUDY_START_SHORT)
      return "S";
   if(event_kind == LRG_STUDY_ADD_LONG || event_kind == LRG_STUDY_ADD_SHORT)
      return "A" + IntegerToString(depth);
   if(event_kind == LRG_STUDY_TARGET_LONG || event_kind == LRG_STUDY_TARGET_SHORT)
      return "T";
   return "";
}

color EventColor(const int event_kind)
{
   if(event_kind == LRG_STUDY_ADD_LONG || event_kind == LRG_STUDY_ADD_SHORT)
      return AddMarkerColor;
   if(event_kind == LRG_STUDY_TARGET_LONG || event_kind == LRG_STUDY_TARGET_SHORT)
      return TargetMarkerColor;
   return StartMarkerColor;
}

void DrawPixelRect(
   const string name,
   const int x,
   const int y,
   const int w,
   const int h,
   const color fill_color,
   const color border_color,
   const int z_order
)
{
   if(ObjectFind(0, name) < 0)
      ObjectCreate(0, name, OBJ_RECTANGLE_LABEL, 0, 0, 0);

   ObjectSetInteger(0, name, OBJPROP_CORNER, CORNER_LEFT_UPPER);
   ObjectSetInteger(0, name, OBJPROP_XDISTANCE, x);
   ObjectSetInteger(0, name, OBJPROP_YDISTANCE, y);
   ObjectSetInteger(0, name, OBJPROP_XSIZE, MathMax(1, w));
   ObjectSetInteger(0, name, OBJPROP_YSIZE, MathMax(1, h));
   ObjectSetInteger(0, name, OBJPROP_BGCOLOR, fill_color);
   ObjectSetInteger(0, name, OBJPROP_COLOR, border_color);
   ObjectSetInteger(0, name, OBJPROP_BACK, false);
   ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
   ObjectSetInteger(0, name, OBJPROP_HIDDEN, true);
   ObjectSetInteger(0, name, OBJPROP_ZORDER, z_order);
}

void DrawPixelText(
   const string name,
   const string text,
   const int x,
   const int y,
   const color text_color,
   const int font_size,
   const int z_order
)
{
   if(ObjectFind(0, name) < 0)
      ObjectCreate(0, name, OBJ_LABEL, 0, 0, 0);

   ObjectSetInteger(0, name, OBJPROP_CORNER, CORNER_LEFT_UPPER);
   ObjectSetInteger(0, name, OBJPROP_XDISTANCE, x);
   ObjectSetInteger(0, name, OBJPROP_YDISTANCE, y);
   ObjectSetInteger(0, name, OBJPROP_COLOR, text_color);
   ObjectSetInteger(0, name, OBJPROP_FONTSIZE, font_size);
   ObjectSetString(0, name, OBJPROP_TEXT, text);
   ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
   ObjectSetInteger(0, name, OBJPROP_HIDDEN, true);
   ObjectSetInteger(0, name, OBJPROP_ZORDER, z_order);
}

double StudyUnit(const double price, const double reference_price, const double brick_size)
{
   if(brick_size <= 0.0)
      return 0.0;
   return (price - reference_price) / brick_size;
}

int StudyY(const double unit, const double max_unit, const int plot_top, const int brick_px)
{
   return plot_top + (int)MathRound((max_unit - unit) * brick_px);
}

void VisibleStudyRange(
   const LimniStudyBrick &bricks[],
   const int start_index,
   const int end_index,
   const double reference_price,
   const double brick_size,
   double &min_unit,
   double &max_unit
)
{
   min_unit = 1.0e100;
   max_unit = -1.0e100;

   for(int i = start_index; i <= end_index; i++)
   {
      double open_unit = StudyUnit(bricks[i].open, reference_price, brick_size);
      double close_unit = StudyUnit(bricks[i].close, reference_price, brick_size);
      double median_unit = StudyUnit(bricks[i].median, reference_price, brick_size);

      min_unit = MathMin(min_unit, MathMin(MathMin(open_unit, close_unit), median_unit));
      max_unit = MathMax(max_unit, MathMax(MathMax(open_unit, close_unit), median_unit));
   }

   if(min_unit > max_unit)
   {
      min_unit = -4.0;
      max_unit = 4.0;
   }

   min_unit = MathFloor(min_unit) - 2.0;
   max_unit = MathCeil(max_unit) + 2.0;
}

void DrawStudyPixelBrick(
   const LimniStudyBrick &brick,
   const int draw_index,
   const int x,
   const int plot_top,
   const double reference_price,
   const double max_unit,
   const double brick_size,
   const int brick_w,
   const int brick_h
)
{
   double top_unit = MathMax(
      StudyUnit(brick.open, reference_price, brick_size),
      StudyUnit(brick.close, reference_price, brick_size)
   );
   int y = StudyY(top_unit, max_unit, plot_top, brick_h);

   color brick_color = brick.direction >= 0 ? UpBrickColor : DownBrickColor;
   DrawPixelRect(
      ObjName("PX_BRICK", draw_index),
      x,
      y,
      brick_w,
      brick_h,
      brick_color,
      brick_color,
      20
   );
}

void DrawStudyPixelMedian(
   const LimniStudyBrick &brick,
   const int draw_index,
   const int x,
   const int plot_top,
   const double reference_price,
   const double max_unit,
   const double brick_size,
   const int step_w,
   const int brick_h
)
{
   double median_unit = StudyUnit(brick.median, reference_price, brick_size);
   int y = StudyY(median_unit, max_unit, plot_top, brick_h);
   DrawPixelRect(
      ObjName("PX_MEDIAN", draw_index),
      x,
      y,
      step_w,
      2,
      MedianTrackColor,
      MedianTrackColor,
      30
   );
}

void DrawStudyPixelEvent(
   const LimniStudyBrick &brick,
   const int draw_index,
   const int x,
   const int plot_top,
   const double reference_price,
   const double max_unit,
   const double brick_size,
   const int brick_w,
   const int brick_h
)
{
   if(brick.event_kind == LRG_STUDY_NONE)
      return;

   string text = EventText(brick.event_kind, brick.depth);
   if(text == "")
      return;

   double close_unit = StudyUnit(brick.close, reference_price, brick_size);
   int y = StudyY(close_unit, max_unit, plot_top, brick_h);
   int label_y = y - 16;

   if(brick.event_kind == LRG_STUDY_START_LONG || brick.event_kind == LRG_STUDY_ADD_LONG)
      label_y = y + brick_h + 2;
   else if(brick.event_kind == LRG_STUDY_TARGET_LONG || brick.event_kind == LRG_STUDY_TARGET_SHORT)
      label_y = y - 7;

   DrawPixelText(
      ObjName("PX_EVENT", draw_index),
      text,
      x + brick_w / 2 - 4,
      label_y,
      EventColor(brick.event_kind),
      8,
      40
   );
}

void DrawStudyPixelGuides(
   const int left,
   const int right,
   const int plot_top,
   const double min_unit,
   const double max_unit,
   const int brick_h
)
{
   if(!ShowBrickShellGuides)
      return;

   for(int unit = (int)MathCeil(min_unit); unit <= (int)MathFloor(max_unit); unit++)
   {
      if(unit == 0)
         continue;
      int y = StudyY((double)unit, max_unit, plot_top, brick_h);
      DrawPixelRect(
         ObjName("PX_GUIDE", unit + 100),
         left,
         y,
         MathMax(1, right - left),
         1,
         StudyGridColor,
         StudyGridColor,
         5
      );
   }
}

void DrawStudyPixelPanel(
   const LimniStudyBrick &bricks[],
   const int brick_count,
   const double brick_size,
   const bool bootstrap_size,
   const int copied_bars,
   const int x,
   const int y
)
{
   if(brick_count <= 0)
      return;

   LimniStudyBrick last = bricks[brick_count - 1];
   string state = StudyStateText(bricks, brick_count);
   string brick_source = bootstrap_size ? "bootstrap Q" : "manual";

   string text = StringFormat(
      "LRMG Brick Study | %s | z %.2f | shell %d | Q %s %s | bricks %d | %s",
      state,
      last.z,
      last.shell,
      DoubleToString(brick_size, _Digits),
      brick_source,
      brick_count,
      EnumToString(SourceTimeframe)
   );

   DrawPixelText(ObjName("PX_PANEL", 0), text, x, y, StudyTextColor, 10, 60);
   DrawPixelText(
      ObjName("PX_PANEL_SUB", 0),
      "equal visual bricks | median uses closed bricks only | pips are source units, not visual units",
      x,
      y + 18,
      clrSilver,
      8,
      60
   );
}

void DrawBrickStudyView(
   const datetime &calc_time[],
   const double &calc_close[],
   const int start_index,
   const int process_end,
   const int copied_bars
)
{
   DeleteObjects();

   int chart_w = (int)ChartGetInteger(0, CHART_WIDTH_IN_PIXELS, 0);
   int chart_h = (int)ChartGetInteger(0, CHART_HEIGHT_IN_PIXELS, 0);
   if(chart_w <= 0)
      chart_w = 1600;
   if(chart_h <= 0)
      chart_h = 900;

   DrawPixelRect(
      ObjName("PX_BACKGROUND", 0),
      0,
      0,
      chart_w,
      chart_h,
      StudyBackgroundColor,
      StudyBackgroundColor,
      0
   );

   int bootstrap_end = MathMin(process_end - 1, start_index + MathMax(10, BootstrapBars) - 1);
   LimniRadialMap bootstrap_map;
   bool map_ok = LimniComputeMovementMap(calc_time, calc_close, start_index, bootstrap_end, true, bootstrap_map);

   double brick_size = ManualBrickSizePoints > 0.0 ? ManualBrickSizePoints * _Point : (map_ok ? bootstrap_map.radius : 0.0);
   bool bootstrap_size = ManualBrickSizePoints <= 0.0;

   if(brick_size <= 0.0)
   {
      DrawPixelText(ObjName("PX_PANEL", 0), "LRMG Brick Study | no valid brick size", 14, 18, StudyTextColor, 10, 60);
      return;
   }

   LimniStudyBrick bricks[];
   int brick_count = 0;
   BuildStudyBricks(calc_time, calc_close, start_index, process_end, brick_size, bricks, brick_count);

   if(brick_count <= 0)
   {
      DrawPixelText(ObjName("PX_PANEL", 0), "LRMG Brick Study | no closed movement bricks yet", 14, 18, StudyTextColor, 10, 60);
      return;
   }

   AnnotateStudyBricks(bricks, brick_count, brick_size);

   int pad = MathMax(4, StudyPanelPadding);
   int header = MathMax(42, StudyPanelHeader);
   int brick_w = MathMax(4, BrickPixelWidth);
   int brick_h = MathMax(4, BrickPixelHeight);
   int gap = MathMax(0, BrickPixelGap);
   int step_w = brick_w + gap;
   int plot_left = pad;
   int plot_top = header;
   int plot_right = chart_w - pad;
   int capacity = MathMax(10, (plot_right - plot_left) / MathMax(1, step_w));
   int draw_count = MathMin(MathMax(10, MaxBricksToDraw), capacity);
   int draw_start = MathMax(0, brick_count - draw_count);
   int draw_end = brick_count - 1;

   double reference_price = bricks[draw_end].median;
   double min_unit = 0.0;
   double max_unit = 0.0;
   VisibleStudyRange(bricks, draw_start, draw_end, reference_price, brick_size, min_unit, max_unit);

   int needed_h = (int)MathRound((max_unit - min_unit + 1.0) * brick_h);
   int available_h = MathMax(120, chart_h - plot_top - pad);
   if(needed_h > available_h)
   {
      brick_h = MathMax(3, available_h / (int)MathMax(1.0, max_unit - min_unit + 1.0));
      needed_h = (int)MathRound((max_unit - min_unit + 1.0) * brick_h);
   }

   int plot_bottom = MathMin(chart_h - pad, plot_top + needed_h);
   DrawPixelRect(
      ObjName("PX_PLOT_BG", 0),
      plot_left - 4,
      plot_top - 4,
      MathMax(1, plot_right - plot_left + 8),
      MathMax(1, plot_bottom - plot_top + 8),
      StudyBackgroundColor,
      clrDimGray,
      1
   );

   DrawStudyPixelGuides(plot_left, plot_right, plot_top, min_unit, max_unit, brick_h);

   int draw_index = 0;
   for(int i = draw_start; i <= draw_end; i++)
   {
      int x = plot_left + draw_index * step_w;
      DrawStudyPixelBrick(bricks[i], draw_index, x, plot_top, reference_price, max_unit, brick_size, brick_w, brick_h);
      DrawStudyPixelMedian(bricks[i], draw_index, x, plot_top, reference_price, max_unit, brick_size, step_w, brick_h);
      DrawStudyPixelEvent(bricks[i], draw_index, x, plot_top, reference_price, max_unit, brick_size, brick_w, brick_h);
      draw_index++;
   }

   DrawStudyPixelPanel(bricks, brick_count, brick_size, bootstrap_size, copied_bars, pad, 14);
}

int OnInit()
{
   DeleteObjects();
   IndicatorSetString(INDICATOR_SHORTNAME, "Limni Radial Movement Grid");
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
   int requested_bars = MathMax(LookbackBars + BootstrapBars + 100, 200);

   MqlRates source_rates[];
   ArraySetAsSeries(source_rates, false);
   int copied = CopyRates(_Symbol, SourceTimeframe, 0, requested_bars, source_rates);
   if(copied < MathMax(50, BootstrapBars + 5))
   {
      DeleteObjects();
      if(ShowDebugComment)
      {
         Comment(
            "Limni Radial Movement Grid\n",
            "source data unavailable or too short\n",
            "copied bars: ", IntegerToString(copied), "\n",
            "bootstrap bars: ", IntegerToString(BootstrapBars)
         );
      }
      return rates_total;
   }

   bool source_series = source_rates[0].time > source_rates[copied - 1].time;

   datetime calc_time[];
   double calc_close[];
   double calc_high[];
   double calc_low[];
   ArrayResize(calc_time, copied);
   ArrayResize(calc_close, copied);
   ArrayResize(calc_high, copied);
   ArrayResize(calc_low, copied);

   for(int logical = 0; logical < copied; logical++)
   {
      int idx = source_series ? copied - 1 - logical : logical;
      calc_time[logical] = source_rates[idx].time;
      calc_close[logical] = source_rates[idx].close;
      calc_high[logical] = source_rates[idx].high;
      calc_low[logical] = source_rates[idx].low;
   }

   int process_end = copied - 1;
   if(UseClosedBarsOnly)
      process_end--;

   if(process_end < BootstrapBars + 5)
      return rates_total;

   int lookback = MathMax(LookbackBars, BootstrapBars + 20);
   int start_index = MathMax(0, process_end - lookback + 1);
   if(BrickStudyView)
   {
      DrawBrickStudyView(calc_time, calc_close, start_index, process_end, copied);
      ChartRedraw(0);
      return rates_total;
   }

   int bootstrap_end = MathMin(process_end - 1, start_index + MathMax(10, BootstrapBars) - 1);

   LimniRadialMap official_map;
   if(!LimniComputeMovementMap(calc_time, calc_close, start_index, bootstrap_end, true, official_map))
   {
      DeleteObjects();
      if(ShowDebugComment)
         Comment("Limni Radial Movement Grid\nbootstrap map invalid");
      return rates_total;
   }

   LimniRadialEvent events[];
   int event_count = 0;
   LimniRadialBasinBox completed_boxes[];
   int completed_box_count = 0;

   bool orbit_active = false;
   bool touched_positive = false;
   bool touched_negative = false;
   int orbit_start = -1;

   double previous_z = LimniZ(calc_close[bootstrap_end], official_map);
   int shells_to_track = MathMax(1, ShellsToDraw);

   for(int i = bootstrap_end + 1; i <= process_end; i++)
   {
      double z = LimniZ(calc_close[i], official_map);

      if(!orbit_active && MathAbs(z) >= 1.0)
      {
         orbit_active = true;
         orbit_start = i;
         touched_positive = z >= 1.0;
         touched_negative = z <= -1.0;
      }

      if(orbit_active)
      {
         if(z >= 1.0)
            touched_positive = true;
         if(z <= -1.0)
            touched_negative = true;
      }

      for(int shell = 1; shell <= shells_to_track; shell++)
      {
         if(previous_z < shell && z >= shell)
            AddEvent(events, event_count, calc_time[i], calc_close[i], LRG_EVENT_POSITIVE_SHELL, shell, z);
         if(previous_z > -shell && z <= -shell)
            AddEvent(events, event_count, calc_time[i], calc_close[i], LRG_EVENT_NEGATIVE_SHELL, -shell, z);
      }

      if(LimniCrossedCenter(previous_z, z))
      {
         AddEvent(events, event_count, calc_time[i], calc_close[i], LRG_EVENT_CENTER_CROSS, 0, z);

         if(orbit_active && touched_positive && touched_negative && orbit_start >= 0 && i > orbit_start)
         {
            double basin_high = 0.0;
            double basin_low = 0.0;
            RangeForIndices(calc_high, calc_low, orbit_start, i, basin_high, basin_low);
            AddBasinBox(completed_boxes, completed_box_count, calc_time[orbit_start], calc_time[i], basin_high, basin_low, true);
            AddEvent(events, event_count, calc_time[i], calc_close[i], LRG_EVENT_ORBIT_COMPLETE, 0, z);

            LimniRadialMap next_map;
            if(LimniComputeMovementMap(calc_time, calc_close, orbit_start, i, false, next_map))
               official_map = next_map;

            orbit_active = false;
            touched_positive = false;
            touched_negative = false;
            orbit_start = -1;
            z = LimniZ(calc_close[i], official_map);
         }
      }

      previous_z = z;
   }

   double live_z = LimniZ(calc_close[process_end], official_map);
   string state = StateLabel(orbit_active, touched_positive, touched_negative, live_z);

   DeleteObjects();

   DrawOfficialMap(official_map);

   if(DrawCompletedBasinTrace)
   {
      int first_box = MathMax(0, completed_box_count - MathMax(0, MaxCompletedBasinsToDraw));
      int draw_index = 0;
      for(int b = first_box; b < completed_box_count; b++)
      {
         DrawBasinRectangle(
            ObjName("COMPLETED_BASIN", draw_index),
            completed_boxes[b].start_time,
            completed_boxes[b].end_time,
            completed_boxes[b].high,
            completed_boxes[b].low,
            CompletedBasinColor,
            STYLE_DOT,
            false
         );
         draw_index++;
      }
   }

   if(DrawCurrentBasinTrace && orbit_active && orbit_start >= 0)
   {
      double current_high = 0.0;
      double current_low = 0.0;
      RangeForIndices(calc_high, calc_low, orbit_start, process_end, current_high, current_low);
      DrawBasinRectangle(
         ObjName("CURRENT_BASIN", 0),
         calc_time[orbit_start],
         calc_time[process_end],
         current_high,
         current_low,
         BasinTraceColor,
         STYLE_DASH,
         false
      );
   }

   if(DrawProvisionalGeometry && orbit_active && orbit_start >= 0 && process_end > orbit_start + 1)
   {
      LimniRadialMap provisional_map;
      if(LimniComputeMovementMap(calc_time, calc_close, orbit_start, process_end, true, provisional_map))
         DrawProvisionalMap(provisional_map);
   }

   int first_event = MathMax(0, event_count - MathMax(0, MaxMarkersToDraw));
   int marker_index = 0;
   for(int e = first_event; e < event_count; e++)
   {
      DrawEventMarker(events[e], marker_index);
      marker_index++;
   }

   DrawPanel(official_map, live_z, state, event_count, completed_box_count, copied, process_end - start_index + 1);

   if(ShowDebugComment)
   {
      Comment(
         "Limni Radial Movement Grid\n",
         "state: ", state, "\n",
         "official map: ", official_map.bootstrap ? "bootstrap" : "frozen orbit", "\n",
         "C: ", DoubleToString(official_map.center, _Digits), "\n",
         "Q: ", DoubleToString(official_map.radius, _Digits), "\n",
         "z: ", DoubleToString(live_z, 3), "\n",
         "events: ", IntegerToString(event_count), "\n",
         "completed basins: ", IntegerToString(completed_box_count)
      );
   }

   ChartRedraw(0);
   return rates_total;
}
