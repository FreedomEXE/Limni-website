//+------------------------------------------------------------------+
//|                                             StateMap.mq5         |
//|                   Limni pair-state visual viewer                 |
//+------------------------------------------------------------------+
#property copyright "LIMNI LTD"
#property version   "1.63"
#property indicator_chart_window
#property indicator_buffers 3
#property indicator_plots 2

#property indicator_label1 "Price Anchor"
#property indicator_type1 DRAW_LINE
#property indicator_color1 clrLimeGreen
#property indicator_style1 STYLE_SOLID
#property indicator_width1 2

#property indicator_label2 "State Anchor"
#property indicator_type2 DRAW_COLOR_LINE
#property indicator_color2 clrLimeGreen,clrTomato,clrSilver
#property indicator_style2 STYLE_SOLID
#property indicator_width2 3

#include "..\\Include\\LimniLRMGStackCore.mqh"
#include "..\\Include\\LimniPairDirectionCore.mqh"

input bool ShowCenterLine = true;
input int VisualMaxM1Bars = 0; // 0 = all available closed M1 bars

const int STATE_MAP_SCALE_LOOKBACK_DAYS = 0;
const int STATE_MAP_MAX_INCREMENTAL_PROJECT_BARS = 50000;
const int STATE_MAP_PANEL_WIDTH = 460;
const int STATE_MAP_PANEL_HEIGHT = 370;
const int STATE_MAP_PANEL_MINIMIZED_HEIGHT = 68;
const int STATE_MAP_PANEL_RIGHT = 18;
const int STATE_MAP_PANEL_TOP = 22;
const int STATE_MAP_PANEL_PAD = 12;
const int STATE_MAP_HEADER_HEIGHT = 68;
const int STATE_MAP_BLOCK_GAP = 10;
const int STATE_MAP_BLOCK_WIDTH = 213;
const int STATE_MAP_BLOCK_HEIGHT = 62;
const color STATE_MAP_PANEL_BG = C'24,28,38';
const color STATE_MAP_PANEL_BORDER = C'49,63,82';
const color STATE_MAP_TITLE_COLOR = C'151,164,181';
const color STATE_MAP_TEXT_COLOR = C'231,236,243';
const color STATE_MAP_MUTED_COLOR = C'139,152,170';
const color STATE_MAP_LONG_COLOR = C'0,185,108';
const color STATE_MAP_SHORT_COLOR = C'238,72,94';
const color STATE_MAP_NEUTRAL_COLOR = C'83,96,115';
const color STATE_MAP_STRESS_COLOR = C'214,143,51';
const color STATE_MAP_STOCH_LINE = C'33,190,238';
const color STATE_MAP_BLOCK_BG = C'31,37,49';
const color STATE_MAP_BLOCK_BORDER = C'61,74,94';
const color STATE_MAP_BADGE_TEXT_COLOR = clrWhite;

const string STATE_MAP_OBJECT_PREFIX = "Limni_StateMap_";
const string STATE_MAP_PANEL_PREFIX = "Limni_StateMap_Panel_";
const string STATE_MAP_PANEL_DATA_PREFIX = "Limni_StateMap_Panel_Data_";

double PriceAnchorBuffer[];
double StateAnchorBuffer[];
double StateColorBuffer[];

datetime g_stack_cache_from = 0;
datetime g_stack_latest_closed_m1 = 0;
bool g_stack_ready = false;
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
string g_stack_status_reason = "waiting_for_m1";
string g_last_logged_stack_failure_reason = "";

string g_pair_status_detail = "chart-symbol M1 stack";

bool g_panel_ready = false;
string g_panel_signature = "";
bool g_panel_minimized = false;
double g_panel_latest_anchor = EMPTY_VALUE;
int g_panel_latest_trend_state = 0;
double g_panel_latest_stoch = EMPTY_VALUE;
double g_panel_latest_q = EMPTY_VALUE;
int g_panel_latest_copied = 0;
int g_panel_latest_day_count = 0;
int g_panel_latest_valid_q_day_count = 0;
LimniPairDirectionResult g_panel_latest_pair_direction;

void StateMapDeleteObjects()
{
   int total = ObjectsTotal(0, 0, -1);
   for(int index = total - 1; index >= 0; index--)
   {
      string name = ObjectName(0, index, 0, -1);
      if(StringFind(name, STATE_MAP_OBJECT_PREFIX) == 0)
         ObjectDelete(0, name);
   }
}

void StateMapDeleteObjectGroup(const string prefix)
{
   int total = ObjectsTotal(0, 0, -1);
   for(int index = total - 1; index >= 0; index--)
   {
      string name = ObjectName(0, index, 0, -1);
      if(StringFind(name, prefix) == 0)
         ObjectDelete(0, name);
   }
}

int StateMapPanelLeft()
{
   int chart_width = (int)ChartGetInteger(0, CHART_WIDTH_IN_PIXELS, 0);
   if(chart_width <= 0)
      return STATE_MAP_PANEL_RIGHT;
   return MathMax(12, chart_width - STATE_MAP_PANEL_WIDTH - STATE_MAP_PANEL_RIGHT);
}

int StateMapPanelHeight()
{
   return g_panel_minimized ? STATE_MAP_PANEL_MINIMIZED_HEIGHT : STATE_MAP_PANEL_HEIGHT;
}

int StateMapPanelX(const int local_x)
{
   return StateMapPanelLeft() + local_x;
}

int StateMapPanelY(const int local_y)
{
   return STATE_MAP_PANEL_TOP + local_y;
}

string StateMapClip(const string value, const int max_len)
{
   if(max_len <= 0 || StringLen(value) <= max_len)
      return value;
   if(max_len <= 3)
      return StringSubstr(value, 0, max_len);
   return StringSubstr(value, 0, max_len - 3) + "...";
}

int StateMapNthSundayDay(const int year, const int month, const int nth)
{
   MqlDateTime first;
   ZeroMemory(first);
   first.year = year;
   first.mon = month;
   first.day = 1;
   datetime first_time = StructToTime(first);

   MqlDateTime first_parts;
   TimeToStruct(first_time, first_parts);
   int days_until_sunday = (7 - first_parts.day_of_week) % 7;
   int safe_nth = nth < 1 ? 1 : nth;
   return 1 + days_until_sunday + ((safe_nth - 1) * 7);
}

bool StateMapTorontoDstActive(const datetime utc_value)
{
   if(utc_value <= 0)
      return false;

   MqlDateTime parts;
   TimeToStruct(utc_value, parts);

   MqlDateTime dst_start;
   ZeroMemory(dst_start);
   dst_start.year = parts.year;
   dst_start.mon = 3;
   dst_start.day = StateMapNthSundayDay(parts.year, 3, 2);
   dst_start.hour = 7; // Toronto DST starts at 02:00 EST, which is 07:00 UTC.

   MqlDateTime dst_end;
   ZeroMemory(dst_end);
   dst_end.year = parts.year;
   dst_end.mon = 11;
   dst_end.day = StateMapNthSundayDay(parts.year, 11, 1);
   dst_end.hour = 6; // Toronto DST ends at 02:00 EDT, which is 06:00 UTC.

   datetime start_utc = StructToTime(dst_start);
   datetime end_utc = StructToTime(dst_end);
   return utc_value >= start_utc && utc_value < end_utc;
}

datetime StateMapBrokerTimeToUtc(const datetime broker_value)
{
   datetime broker_now = TimeTradeServer();
   if(broker_now <= 0)
      broker_now = TimeCurrent();

   datetime utc_now = TimeGMT();
   if(broker_now <= 0 || utc_now <= 0)
      return broker_value;

   int broker_offset_seconds = (int)(broker_now - utc_now);
   if(MathAbs((double)broker_offset_seconds) > 18.0 * 60.0 * 60.0)
      return broker_value;

   return broker_value - broker_offset_seconds;
}

datetime StateMapUtcToToronto(const datetime utc_value)
{
   int offset_seconds = StateMapTorontoDstActive(utc_value) ? -4 * 60 * 60 : -5 * 60 * 60;
   return utc_value + offset_seconds;
}

string StateMapTimeLabel(const datetime value)
{
   if(value <= 0)
      return "syncing";

   datetime toronto_value = StateMapUtcToToronto(StateMapBrokerTimeToUtc(value));
   MqlDateTime parts;
   TimeToStruct(toronto_value, parts);

   int hour_12 = parts.hour % 12;
   if(hour_12 == 0)
      hour_12 = 12;
   string suffix = parts.hour >= 12 ? "pm" : "am";
   return StringFormat("%d:%02d %s", hour_12, parts.min, suffix);
}

string StateMapReasonLabel(const string reason)
{
   string output = reason == "" ? "unknown" : reason;
   StringReplace(output, "_", " ");
   return StateMapClip(output, 34);
}

string StateMapSignedValueLabel(const double value, const int digits = 2)
{
   if(value == EMPTY_VALUE || !MathIsValidNumber(value))
      return "n/a";
   if(value > 0.0)
      return "+" + DoubleToString(value, digits);
   return DoubleToString(value, digits);
}

double StateMapPipSize()
{
   double point = _Point;
   if(point <= 0.0)
      point = SymbolInfoDouble(_Symbol, SYMBOL_POINT);
   if(point <= 0.0)
      return 0.0;

   int digits = (int)SymbolInfoInteger(_Symbol, SYMBOL_DIGITS);
   if(digits == 5 || digits == 3)
      return point * 10.0;
   if(digits == 4 || digits == 2)
      return point;

   double pip = point * 10.0;
   if(pip > point && pip < 1.0)
      return pip;
   return point;
}

string StateMapPipsLabel(const double value)
{
   if(value == EMPTY_VALUE || !MathIsValidNumber(value))
      return "n/a";

   double pip_size = StateMapPipSize();
   if(pip_size <= 0.0)
      return StateMapSignedValueLabel(value, 4);

   double pips = value / pip_size;
   int digits = MathAbs(pips) < 1.0 ? 2 : 1;
   return DoubleToString(pips, digits) + " pips";
}

string StateMapDirectionLabel(const LimniPairDirectionResult &direction)
{
   if(!direction.valid)
      return "WAITING";
   if(direction.confirmed_direction > 0)
      return "LONG";
   if(direction.confirmed_direction < 0)
      return "SHORT";
   return "WAITING";
}

color StateMapDirectionColor(const LimniPairDirectionResult &direction)
{
   if(!direction.valid)
      return STATE_MAP_STRESS_COLOR;
   if(direction.confirmed_direction > 0)
      return STATE_MAP_LONG_COLOR;
   if(direction.confirmed_direction < 0)
      return STATE_MAP_SHORT_COLOR;
   return STATE_MAP_STRESS_COLOR;
}

bool StateMapHasVisualData(
   const double latest_anchor,
   const double latest_stoch,
   const int copied
)
{
   if(copied <= 0)
      return false;
   if(latest_anchor == EMPTY_VALUE || !MathIsValidNumber(latest_anchor))
      return false;
   if(latest_stoch == EMPTY_VALUE || !MathIsValidNumber(latest_stoch))
      return false;
   return true;
}

string StateMapTrendLabel(const int state)
{
   if(state > 0)
      return "UP";
   if(state < 0)
      return "DOWN";
   return "NEUTRAL";
}

string StateMapStochZoneLabel(const double value)
{
   if(value == EMPTY_VALUE || !MathIsValidNumber(value))
      return "waiting";
   if(value >= 80.0)
      return "upper zone";
   if(value <= 20.0)
      return "lower zone";
   return "mid zone";
}

color StateMapTrendColor(const int state)
{
   if(state > 0)
      return STATE_MAP_LONG_COLOR;
   if(state < 0)
      return STATE_MAP_SHORT_COLOR;
   return STATE_MAP_MUTED_COLOR;
}

void StateMapSetVisualReady()
{
   g_stack_status_reason = "pair_stack_ready";
   g_pair_status_detail = "chart-symbol M1";
}

void StateMapSetVisualFailure(const string reason)
{
   g_stack_status_reason = reason == "" ? "visual_stack_unavailable" : reason;
   g_pair_status_detail = "check M1 source";
}

datetime StateMapLatestClosedM1()
{
   datetime latest_closed_m1 = iTime(_Symbol, PERIOD_M1, 1);
   if(latest_closed_m1 <= 0)
      latest_closed_m1 = TimeCurrent();
   return latest_closed_m1;
}

bool StateMapEnsureStackCache(
   const datetime chart_oldest,
   const datetime chart_newest,
   bool &refreshed
)
{
   refreshed = false;
   datetime latest_closed_m1 = StateMapLatestClosedM1();
   int visual_max_m1_bars = MathMax(0, VisualMaxM1Bars);

   if(g_stack_ready &&
      g_stack_visual_max_m1_bars == visual_max_m1_bars &&
      g_stack_point == _Point &&
      g_stack_latest_closed_m1 == latest_closed_m1 &&
      LimniSourceSeriesCoversChart(g_source_times, chart_oldest))
   {
      StateMapSetVisualReady();
      return true;
   }

   double direct_point = _Point;
   if(direct_point <= 0.0)
      direct_point = SymbolInfoDouble(_Symbol, SYMBOL_POINT);

   string reason = "";
   bool stack_ok = LimniLoadVisualStackSeries(
      chart_oldest,
      chart_newest,
      STATE_MAP_SCALE_LOOKBACK_DAYS,
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
      StateMapSetVisualFailure(reason == "" ? "visual_stack_empty" : reason);
      if(g_stack_status_reason != g_last_logged_stack_failure_reason)
      {
         Print("Limni StateMap visual stack unavailable: ", g_stack_status_reason);
         g_last_logged_stack_failure_reason = g_stack_status_reason;
      }
      if(g_stack_ready && ArraySize(g_source_times) > 0)
         return true;
      return false;
   }

   g_stack_cache_from = chart_oldest;
   g_stack_latest_closed_m1 = g_source_times[ArraySize(g_source_times) - 1];
   g_stack_visual_max_m1_bars = visual_max_m1_bars;
   g_stack_point = direct_point;
   g_stack_ready = true;
   StateMapSetVisualReady();
   refreshed = true;
   return true;
}

void StateMapDrawRect(
   const string name,
   const int x,
   const int y,
   const int width,
   const int height,
   const color fill,
   const color border,
   const int z_order
)
{
   if(ObjectFind(0, name) < 0)
      ObjectCreate(0, name, OBJ_RECTANGLE_LABEL, 0, 0, 0);

   ObjectSetInteger(0, name, OBJPROP_CORNER, CORNER_LEFT_UPPER);
   ObjectSetInteger(0, name, OBJPROP_XDISTANCE, x);
   ObjectSetInteger(0, name, OBJPROP_YDISTANCE, y);
   ObjectSetInteger(0, name, OBJPROP_XSIZE, MathMax(1, width));
   ObjectSetInteger(0, name, OBJPROP_YSIZE, MathMax(1, height));
   ObjectSetInteger(0, name, OBJPROP_BGCOLOR, fill);
   ObjectSetInteger(0, name, OBJPROP_COLOR, border);
   ObjectSetInteger(0, name, OBJPROP_BACK, false);
   ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
   ObjectSetInteger(0, name, OBJPROP_SELECTED, false);
   ObjectSetInteger(0, name, OBJPROP_HIDDEN, true);
   ObjectSetInteger(0, name, OBJPROP_ZORDER, z_order);
}

void StateMapDrawText(
   const string name,
   const string text,
   const int x,
   const int y,
   const color text_color,
   const int font_size,
   const int z_order,
   const string font_name = "Segoe UI"
)
{
   if(ObjectFind(0, name) < 0)
      ObjectCreate(0, name, OBJ_LABEL, 0, 0, 0);

   ObjectSetInteger(0, name, OBJPROP_CORNER, CORNER_LEFT_UPPER);
   ObjectSetInteger(0, name, OBJPROP_XDISTANCE, x);
   ObjectSetInteger(0, name, OBJPROP_YDISTANCE, y);
   ObjectSetInteger(0, name, OBJPROP_COLOR, text_color);
   ObjectSetInteger(0, name, OBJPROP_FONTSIZE, font_size);
   ObjectSetString(0, name, OBJPROP_FONT, font_name);
   ObjectSetString(0, name, OBJPROP_TEXT, text);
   ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
   ObjectSetInteger(0, name, OBJPROP_SELECTED, false);
   ObjectSetInteger(0, name, OBJPROP_HIDDEN, true);
   ObjectSetInteger(0, name, OBJPROP_ZORDER, z_order);
}

void StateMapDrawButton(
   const string name,
   const string text,
   const int x,
   const int y,
   const int width,
   const int height,
   const color bg,
   const color text_color,
   const int z_order
)
{
   if(ObjectFind(0, name) < 0)
      ObjectCreate(0, name, OBJ_BUTTON, 0, 0, 0);

   ObjectSetInteger(0, name, OBJPROP_CORNER, CORNER_LEFT_UPPER);
   ObjectSetInteger(0, name, OBJPROP_XDISTANCE, x);
   ObjectSetInteger(0, name, OBJPROP_YDISTANCE, y);
   ObjectSetInteger(0, name, OBJPROP_XSIZE, MathMax(1, width));
   ObjectSetInteger(0, name, OBJPROP_YSIZE, MathMax(1, height));
   ObjectSetInteger(0, name, OBJPROP_BGCOLOR, bg);
   ObjectSetInteger(0, name, OBJPROP_COLOR, text_color);
   ObjectSetInteger(0, name, OBJPROP_FONTSIZE, 10);
   ObjectSetString(0, name, OBJPROP_FONT, "Segoe UI Semibold");
   ObjectSetString(0, name, OBJPROP_TEXT, text);
   ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
   ObjectSetInteger(0, name, OBJPROP_SELECTED, false);
   ObjectSetInteger(0, name, OBJPROP_STATE, false);
   ObjectSetInteger(0, name, OBJPROP_HIDDEN, true);
   ObjectSetInteger(0, name, OBJPROP_ZORDER, z_order);
}

void StateMapDeletePanelData()
{
   StateMapDeleteObjectGroup(STATE_MAP_PANEL_DATA_PREFIX);
}

void StateMapDrawPanelBlock(
   const string suffix,
   const string title,
   const string value,
   const string detail,
   const int local_x,
   const int local_y,
   const int width,
   const int height,
   const color accent
)
{
   string prefix = STATE_MAP_PANEL_DATA_PREFIX + suffix;
   int x = StateMapPanelX(local_x);
   int y = StateMapPanelY(local_y);
   StateMapDrawRect(prefix + "_Bg", x, y, width, height, STATE_MAP_BLOCK_BG, STATE_MAP_BLOCK_BORDER, 36);
   StateMapDrawRect(prefix + "_Accent", x, y, width, 3, accent, accent, 37);
   StateMapDrawText(prefix + "_Title", title, x + 12, y + 10, STATE_MAP_MUTED_COLOR, 8, 38, "Segoe UI Semibold");
   StateMapDrawText(prefix + "_Value", StateMapClip(value, 24), x + 12, y + 27, STATE_MAP_TEXT_COLOR, 12, 39, "Segoe UI Semibold");
   StateMapDrawText(prefix + "_Detail", StateMapClip(detail, 28), x + 12, y + 47, STATE_MAP_MUTED_COLOR, 8, 39, "Segoe UI");
}

bool StateMapCreateDialog()
{
   g_panel_ready = true;
   return true;
}

void StateMapUpdatePanel(
   const double latest_anchor,
   const int latest_trend_state,
   const double latest_stoch,
   const double latest_q,
   const int copied,
   const int day_count,
   const int valid_q_day_count,
   LimniPairDirectionResult &pair_direction
)
{
   if(!StateMapCreateDialog())
      return;

   g_panel_latest_anchor = latest_anchor;
   g_panel_latest_trend_state = latest_trend_state;
   g_panel_latest_stoch = latest_stoch;
   g_panel_latest_q = latest_q;
   g_panel_latest_copied = copied;
   g_panel_latest_day_count = day_count;
   g_panel_latest_valid_q_day_count = valid_q_day_count;
   g_panel_latest_pair_direction = pair_direction;

   bool data_ready = StateMapHasVisualData(latest_anchor, latest_stoch, copied);
   string direction_value = StateMapDirectionLabel(pair_direction);
   color direction_color = StateMapDirectionColor(pair_direction);
   string header_direction = "DIRECTION: " + direction_value;

   string stoch_value = latest_stoch == EMPTY_VALUE ? "n/a" : DoubleToString(latest_stoch, 1);
   string q_value = StateMapPipsLabel(latest_q);
   string anchor_value = latest_anchor == EMPTY_VALUE ? "n/a" : DoubleToString(latest_anchor, _Digits);
   string bars_value = IntegerToString(copied);
   string q_days_value = IntegerToString(valid_q_day_count);
   string reason_value = StateMapReasonLabel(g_stack_status_reason);
   string m1_label = StateMapTimeLabel(g_stack_latest_closed_m1);
   string trend_value = StateMapTrendLabel(latest_trend_state);
   string center_detail = ShowCenterLine ? "center line on" : "center line off";
   string stoch_detail = StateMapStochZoneLabel(latest_stoch);
   string data_detail = g_pair_status_detail;

   string signature =
      IntegerToString(StateMapPanelLeft()) + "|" +
      (g_panel_minimized ? "min" : "full") + "|" +
      header_direction + "|" +
      reason_value + "|" +
      data_detail + "|" +
      m1_label + "|" +
      IntegerToString(latest_trend_state) + "|" +
      direction_value + "|" +
      DoubleToString(pair_direction.raw_score, 4) + "|" +
      IntegerToString(pair_direction.pending_direction) + "|" +
      IntegerToString(pair_direction.pending_count) + "|" +
      stoch_value + "|" +
      q_value + "|" +
      anchor_value + "|" +
      bars_value + "|" +
      q_days_value;

   if(signature == g_panel_signature)
      return;

   int panel_x = StateMapPanelLeft();
   int panel_y = STATE_MAP_PANEL_TOP;
   StateMapDrawRect(STATE_MAP_PANEL_PREFIX + "Body", panel_x, panel_y, STATE_MAP_PANEL_WIDTH, StateMapPanelHeight(), STATE_MAP_PANEL_BG, STATE_MAP_PANEL_BORDER, 30);
   StateMapDrawRect(STATE_MAP_PANEL_PREFIX + "Header", panel_x, panel_y, STATE_MAP_PANEL_WIDTH, STATE_MAP_HEADER_HEIGHT, direction_color, direction_color, 42);
   StateMapDrawText(STATE_MAP_PANEL_PREFIX + "Title", "LIMNI STATE MAP", panel_x + 18, panel_y + 10, STATE_MAP_TITLE_COLOR, 8, 44, "Segoe UI Semibold");
   StateMapDrawText(STATE_MAP_PANEL_PREFIX + "State", header_direction, panel_x + 18, panel_y + 32, STATE_MAP_BADGE_TEXT_COLOR, StringLen(header_direction) > 16 ? 14 : 16, 44, "Segoe UI Semibold");
   StateMapDrawButton(STATE_MAP_PANEL_PREFIX + "Minimize", g_panel_minimized ? "+" : "-", panel_x + STATE_MAP_PANEL_WIDTH - 42, panel_y + 18, 26, 26, C'17,22,31', STATE_MAP_TEXT_COLOR, 46);

   if(g_panel_minimized)
   {
      StateMapDeletePanelData();
      g_panel_signature = signature;
      return;
   }

   int left_x = STATE_MAP_PANEL_PAD;
   int right_x = STATE_MAP_PANEL_PAD + STATE_MAP_BLOCK_WIDTH + STATE_MAP_BLOCK_GAP;
   int row_1 = STATE_MAP_HEADER_HEIGHT + STATE_MAP_PANEL_PAD;
   int row_2 = row_1 + STATE_MAP_BLOCK_HEIGHT + STATE_MAP_BLOCK_GAP;
   int row_3 = row_2 + STATE_MAP_BLOCK_HEIGHT + STATE_MAP_BLOCK_GAP;
   int row_4 = row_3 + STATE_MAP_BLOCK_HEIGHT + STATE_MAP_BLOCK_GAP;

   StateMapDrawPanelBlock("Direction", "DIRECTION", direction_value, pair_direction.valid ? "confirmed core" : pair_direction.reason_code, left_x, row_1, STATE_MAP_BLOCK_WIDTH, STATE_MAP_BLOCK_HEIGHT, direction_color);
   StateMapDrawPanelBlock("Q", "Q SIZE", q_value, "q-days " + q_days_value, right_x, row_1, STATE_MAP_BLOCK_WIDTH, STATE_MAP_BLOCK_HEIGHT, STATE_MAP_NEUTRAL_COLOR);
   StateMapDrawPanelBlock("Trend", "TREND", trend_value, center_detail, left_x, row_2, STATE_MAP_BLOCK_WIDTH, STATE_MAP_BLOCK_HEIGHT, StateMapTrendColor(latest_trend_state));
   StateMapDrawPanelBlock("Stochastic", "STOCHASTIC", stoch_value, stoch_detail, right_x, row_2, STATE_MAP_BLOCK_WIDTH, STATE_MAP_BLOCK_HEIGHT, STATE_MAP_STOCH_LINE);
   StateMapDrawPanelBlock("Anchor", "ANCHOR", anchor_value, "center price", left_x, row_3, STATE_MAP_BLOCK_WIDTH, STATE_MAP_BLOCK_HEIGHT, STATE_MAP_STOCH_LINE);
   StateMapDrawPanelBlock("Status", "DATA", reason_value, data_detail, right_x, row_3, STATE_MAP_BLOCK_WIDTH, STATE_MAP_BLOCK_HEIGHT, data_ready ? STATE_MAP_LONG_COLOR : STATE_MAP_STRESS_COLOR);
   StateMapDrawPanelBlock("Bars", "BARS", bars_value, "q-days " + q_days_value, left_x, row_4, STATE_MAP_BLOCK_WIDTH, STATE_MAP_BLOCK_HEIGHT, STATE_MAP_NEUTRAL_COLOR);
   StateMapDrawPanelBlock("AsOf", "AS-OF", m1_label, "Toronto", right_x, row_4, STATE_MAP_BLOCK_WIDTH, STATE_MAP_BLOCK_HEIGHT, STATE_MAP_NEUTRAL_COLOR);

   g_panel_signature = signature;
}

void StateMapRenderPanel(
   const double latest_anchor,
   const int latest_trend_state,
   const double latest_stoch,
   const double latest_q,
   const int copied,
   const int day_count,
   const int valid_q_day_count,
   LimniPairDirectionResult &pair_direction
)
{
   StateMapUpdatePanel(latest_anchor, latest_trend_state, latest_stoch, latest_q, copied, day_count, valid_q_day_count, pair_direction);
}

int OnInit()
{
   SetIndexBuffer(0, PriceAnchorBuffer, INDICATOR_DATA);
   SetIndexBuffer(1, StateAnchorBuffer, INDICATOR_DATA);
   SetIndexBuffer(2, StateColorBuffer, INDICATOR_COLOR_INDEX);
   PlotIndexSetDouble(0, PLOT_EMPTY_VALUE, EMPTY_VALUE);
   PlotIndexSetDouble(1, PLOT_EMPTY_VALUE, EMPTY_VALUE);
   IndicatorSetString(INDICATOR_SHORTNAME, "Limni State Map");
   IndicatorSetInteger(INDICATOR_DIGITS, _Digits);
   StateMapDeleteObjects();
   StateMapCreateDialog();
   LimniPairDirectionResetResult(g_panel_latest_pair_direction);
   StateMapRenderPanel(EMPTY_VALUE, 0, EMPTY_VALUE, EMPTY_VALUE, 0, 0, 0, g_panel_latest_pair_direction);
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
   StateMapDeleteObjects();
   g_panel_ready = false;
   g_panel_signature = "";
}

void StateMapRefreshPanelFromStored()
{
   g_panel_signature = "";
   StateMapUpdatePanel(
      g_panel_latest_anchor,
      g_panel_latest_trend_state,
      g_panel_latest_stoch,
      g_panel_latest_q,
      g_panel_latest_copied,
      g_panel_latest_day_count,
      g_panel_latest_valid_q_day_count,
      g_panel_latest_pair_direction
   );
}

void OnChartEvent(
   const int id,
   const long &lparam,
   const double &dparam,
   const string &sparam
)
{
   if(id == CHARTEVENT_OBJECT_CLICK && sparam == STATE_MAP_PANEL_PREFIX + "Minimize")
   {
      g_panel_minimized = !g_panel_minimized;
      ObjectSetInteger(0, STATE_MAP_PANEL_PREFIX + "Minimize", OBJPROP_STATE, false);
      StateMapRefreshPanelFromStored();
      return;
   }

   if(id == CHARTEVENT_CHART_CHANGE)
      StateMapRefreshPanelFromStored();
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
      LimniClearDoubleBuffer(PriceAnchorBuffer, rates_total);
      LimniClearDoubleBuffer(StateAnchorBuffer, rates_total);
      LimniFillDoubleBuffer(StateColorBuffer, rates_total, 2.0);
   }

   datetime chart_oldest = 0;
   datetime chart_newest = 0;
   LimniChartTimeRangeFast(time, rates_total, chart_oldest, chart_newest);
   if(chart_oldest <= 0 || chart_newest <= 0)
      return rates_total;

   bool stack_refreshed = false;
   if(!StateMapEnsureStackCache(chart_oldest, chart_newest, stack_refreshed))
   {
      LimniPairDirectionResetResult(g_panel_latest_pair_direction);
      StateMapRenderPanel(EMPTY_VALUE, 0, EMPTY_VALUE, EMPTY_VALUE, 0, 0, 0, g_panel_latest_pair_direction);
      return 0;
   }
   if(stack_refreshed)
      g_panel_signature = "";

   bool chart_series = ArrayGetAsSeries(time);
   int limit = stack_refreshed ?
      rates_total :
      LimniStableProjectionLimit(
         rates_total,
         prev_calculated,
         chart_oldest,
         chart_newest,
         g_projected_chart_oldest,
         g_projected_chart_newest,
         STATE_MAP_MAX_INCREMENTAL_PROJECT_BARS
      );
   if(limit == rates_total)
   {
      LimniClearDoubleBuffer(PriceAnchorBuffer, rates_total);
      LimniClearDoubleBuffer(StateAnchorBuffer, rates_total);
      LimniFillDoubleBuffer(StateColorBuffer, rates_total, 2.0);
   }

   if(ShowCenterLine)
   {
      LimniProjectDoubleToChartLimit(time, rates_total, chart_series, g_source_times, g_source_line, PriceAnchorBuffer, limit);

      for(int recent = limit - 1; recent >= 0; recent--)
      {
         int idx = LimniRecentChartIndex(rates_total, chart_series, recent);
         int source_index = LimniSourceIndexAtOrBefore(g_source_times, time[idx]);
         if(source_index >= 0 && g_source_line[source_index] != EMPTY_VALUE)
         {
            StateAnchorBuffer[idx] = g_source_line[source_index];
            if(g_source_ma_state[source_index] > 0)
               StateColorBuffer[idx] = 0.0;
            else if(g_source_ma_state[source_index] < 0)
               StateColorBuffer[idx] = 1.0;
            else
               StateColorBuffer[idx] = 2.0;
         }
         else
         {
            StateAnchorBuffer[idx] = EMPTY_VALUE;
            StateColorBuffer[idx] = 2.0;
         }
      }
   }
   else
   {
      for(int recent = limit - 1; recent >= 0; recent--)
      {
         int idx = LimniRecentChartIndex(rates_total, chart_series, recent);
         PriceAnchorBuffer[idx] = EMPTY_VALUE;
         StateAnchorBuffer[idx] = EMPTY_VALUE;
         StateColorBuffer[idx] = 2.0;
      }
   }

   g_projected_chart_oldest = chart_oldest;
   g_projected_chart_newest = chart_newest;

   int latest_source_index = ArraySize(g_source_times) - 1;
   double latest_anchor = latest_source_index >= 0 ? g_source_line[latest_source_index] : EMPTY_VALUE;
   int latest_trend_state = latest_source_index >= 0 ? g_source_ma_state[latest_source_index] : 0;
   double latest_stoch = latest_source_index >= 0 ? g_source_stoch[latest_source_index] : EMPTY_VALUE;
   double latest_q = latest_source_index >= 0 ? g_source_q[latest_source_index] : EMPTY_VALUE;
   LimniPairDirectionResult pair_direction;
   LimniPairDirectionReplay(
      g_source_times,
      g_source_closes,
      g_source_q,
      g_source_line,
      g_source_stoch,
      g_source_ma_state,
      g_source_trigger,
      StateMapPipSize(),
      pair_direction
   );

   StateMapRenderPanel(
      latest_anchor,
      latest_trend_state,
      latest_stoch,
      latest_q,
      g_stack_copied,
      g_stack_day_count,
      g_stack_valid_q_day_count,
      pair_direction
   );

   return rates_total;
}
