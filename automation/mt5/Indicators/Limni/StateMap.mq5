//+------------------------------------------------------------------+
//|                                             StateMap.mq5         |
//|                   Limni State Map shared LRMG/q viewer           |
//+------------------------------------------------------------------+
#property copyright "LIMNI LTD"
#property version   "1.50"
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

#include <Controls\Label.mqh>
#include <Controls\Panel.mqh>
#include "..\\Include\\LimniVisualRuntimeSnapshot.mqh"

const int STATE_MAP_SCALE_LOOKBACK_DAYS = 0;
const int STATE_MAP_MAX_INITIAL_PROJECT_BARS = 50000;
const int STATE_MAP_PANEL_WIDTH = 280;
const int STATE_MAP_PANEL_HEIGHT = 195;
const int STATE_MAP_PANEL_RIGHT = 18;
const int STATE_MAP_PANEL_TOP = 22;
const int STATE_MAP_HEADER_TOP = 0;
const int STATE_MAP_HEADER_BOTTOM = 50;
const int STATE_MAP_ROW_TOP = 65;
const int STATE_MAP_ROW_GAP = 25;
const int STATE_MAP_LABEL_COL_1 = 15;
const int STATE_MAP_VALUE_COL_1 = 85;
const int STATE_MAP_LABEL_COL_2 = 150;
const int STATE_MAP_VALUE_COL_2 = 210;
const color STATE_MAP_PANEL_BG = C'24,28,38';
const color STATE_MAP_PANEL_BORDER = C'49,63,82';
const color STATE_MAP_TITLE_COLOR = C'151,164,181';
const color STATE_MAP_TEXT_COLOR = C'231,236,243';
const color STATE_MAP_MUTED_COLOR = C'139,152,170';
const color STATE_MAP_LONG_COLOR = C'0,185,108';
const color STATE_MAP_SHORT_COLOR = C'238,72,94';
const color STATE_MAP_NEUTRAL_COLOR = C'83,96,115';
const color STATE_MAP_STRESS_COLOR = C'214,143,51';
const color STATE_MAP_BADGE_TEXT_COLOR = clrWhite;

const string STATE_MAP_OBJECT_PREFIX = "Limni_StateMap_";

double PriceAnchorBuffer[];
double StateAnchorBuffer[];
double StateColorBuffer[];

datetime g_stack_cache_from = 0;
datetime g_stack_latest_closed_m1 = 0;
bool g_stack_ready = false;
double g_stack_point = 0.0;
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

datetime g_last_qstate_refresh_bar = 0;
string g_qstate_label = "NO TRADE";
string g_qstate_reason = "not_refreshed";
string g_qstate_details = "";
datetime g_qstate_asof = 0;
double g_qstate_score = 0.0;
double g_qstate_confidence = 0.0;
color g_qstate_color = STATE_MAP_NEUTRAL_COLOR;

CPanel g_panel_body;
CPanel g_panel_header;
CLabel g_panel_title;
CLabel g_panel_state;
CLabel g_label_m1;
CLabel g_value_m1;
CLabel g_label_score;
CLabel g_value_score;
CLabel g_label_conf;
CLabel g_value_conf;
CLabel g_label_trend;
CLabel g_value_trend;
CLabel g_label_reason;
CLabel g_value_reason;
CLabel g_label_stoch;
CLabel g_value_stoch;
CLabel g_label_anchor;
CLabel g_value_anchor;
CLabel g_label_bars;
CLabel g_value_bars;
bool g_panel_ready = false;
string g_panel_signature = "";

void StateMapSetQStateFailure(const string reason, const string details)
{
   g_qstate_label = "FAIL CLOSED";
   g_qstate_color = STATE_MAP_STRESS_COLOR;
   g_qstate_reason = reason == "" ? "qstate_unavailable" : reason;
   g_qstate_asof = 0;
   g_qstate_score = 0.0;
   g_qstate_confidence = 0.0;
   g_qstate_details = details;
}

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

int StateMapPanelLeft()
{
   int chart_width = (int)ChartGetInteger(0, CHART_WIDTH_IN_PIXELS, 0);
   if(chart_width <= 0)
      return STATE_MAP_PANEL_RIGHT;
   return MathMax(12, chart_width - STATE_MAP_PANEL_WIDTH - STATE_MAP_PANEL_RIGHT);
}

string StateMapClip(const string value, const int max_len)
{
   if(max_len <= 0 || StringLen(value) <= max_len)
      return value;
   if(max_len <= 3)
      return StringSubstr(value, 0, max_len);
   return StringSubstr(value, 0, max_len - 3) + "...";
}

string StateMapTimeLabel(const datetime value)
{
   if(value <= 0)
      return "syncing";
   MqlDateTime parts;
   TimeToStruct(value, parts);
   return StringFormat("%02d-%02d %02d:%02d", parts.mon, parts.day, parts.hour, parts.min);
}

string StateMapReasonLabel(const string reason)
{
   string output = reason == "" ? "unknown" : reason;
   StringReplace(output, "_", " ");
   return StateMapClip(output, 12);
}

string StateMapSignedScoreLabel(const double value)
{
   if(value > 0.0)
      return "+" + DoubleToString(value, 2);
   return DoubleToString(value, 2);
}

string StateMapTrendLabel(const int state)
{
   if(state > 0)
      return "UP";
   if(state < 0)
      return "DOWN";
   return "NEUTRAL";
}

color StateMapTrendColor(const int state)
{
   if(state > 0)
      return STATE_MAP_LONG_COLOR;
   if(state < 0)
      return STATE_MAP_SHORT_COLOR;
   return STATE_MAP_MUTED_COLOR;
}

color StateMapQStateColor(const int state, const int trade_direction)
{
   if(state == LIMNI_QSTATE_PAIR_STATE_STRESS)
      return STATE_MAP_STRESS_COLOR;
   if(trade_direction == LIMNI_QSTATE_SIDE_LONG)
      return STATE_MAP_LONG_COLOR;
   if(trade_direction == LIMNI_QSTATE_SIDE_SHORT)
      return STATE_MAP_SHORT_COLOR;
   return STATE_MAP_NEUTRAL_COLOR;
}

color StateMapSignedValueColor(const double value)
{
   if(value > 0.0)
      return STATE_MAP_LONG_COLOR;
   if(value < 0.0)
      return STATE_MAP_SHORT_COLOR;
   return STATE_MAP_TEXT_COLOR;
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

   if(g_stack_ready &&
      g_stack_point == _Point &&
      g_stack_latest_closed_m1 == latest_closed_m1)
   {
      return true;
   }

   datetime snapshot_latest = 0;
   ulong snapshot_hash = 0;
   string reason = "";
   if(!LimniVisualReadStackSnapshot(
      _Symbol,
      STATE_MAP_SCALE_LOOKBACK_DAYS,
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
      g_stack_point,
      snapshot_latest,
      snapshot_hash,
      reason
   ))
   {
      StateMapSetQStateFailure(reason, "Start LimniVisualRuntimeService and wait for a closed-M1 snapshot.");
      return false;
   }

   g_stack_cache_from = chart_oldest;
   g_stack_latest_closed_m1 = snapshot_latest;
   g_stack_ready = true;
   refreshed = true;
   return true;
}

int StateMapPanelAbsX(const int local_x)
{
   return StateMapPanelLeft() + local_x;
}

int StateMapPanelAbsY(const int local_y)
{
   return STATE_MAP_PANEL_TOP + local_y;
}

bool StateMapCreatePanel(CPanel &panel, const string suffix, const int x1, const int y1, const int x2, const int y2, const color bg, const color border)
{
   if(!panel.Create(0, STATE_MAP_OBJECT_PREFIX + suffix, 0, StateMapPanelAbsX(x1), StateMapPanelAbsY(y1), StateMapPanelAbsX(x2), StateMapPanelAbsY(y2)))
      return false;
   panel.ColorBackground(bg);
   panel.ColorBorder(border);
   panel.BorderType(BORDER_FLAT);
   return true;
}

bool StateMapCreateLabel(CLabel &label, const string suffix, const string text, const int x1, const int y1, const int x2, const int y2, const color text_color, const int font_size, const string font_name)
{
   if(!label.Create(0, STATE_MAP_OBJECT_PREFIX + suffix, 0, StateMapPanelAbsX(x1), StateMapPanelAbsY(y1), StateMapPanelAbsX(x2), StateMapPanelAbsY(y2)))
      return false;
   label.Text(text);
   label.Color(text_color);
   label.Font(font_name);
   label.FontSize(font_size);
   return true;
}

bool StateMapCreateStatLabels(CLabel &tag, CLabel &value, const string suffix, const string caption, const int label_x, const int value_x, const int y)
{
   if(!StateMapCreateLabel(tag, suffix + "_Tag", caption, label_x, y, label_x + 62, y + 17, STATE_MAP_MUTED_COLOR, 8, "Segoe UI"))
      return false;
   return StateMapCreateLabel(value, suffix + "_Value", "", value_x, y, value_x + 66, y + 18, STATE_MAP_TEXT_COLOR, 9, "Segoe UI Semibold");
}

bool StateMapCreateDialog()
{
   if(g_panel_ready)
      return true;

   if(!StateMapCreatePanel(g_panel_body, "Body", 0, 0, STATE_MAP_PANEL_WIDTH, STATE_MAP_PANEL_HEIGHT, STATE_MAP_PANEL_BG, STATE_MAP_PANEL_BORDER))
      return false;
   if(!StateMapCreatePanel(g_panel_header, "Header", 0, STATE_MAP_HEADER_TOP, STATE_MAP_PANEL_WIDTH, STATE_MAP_HEADER_BOTTOM, STATE_MAP_NEUTRAL_COLOR, STATE_MAP_NEUTRAL_COLOR))
      return false;

   if(!StateMapCreateLabel(g_panel_title, "Title", "LIMNI STATE MAP", 15, 7, 180, 22, STATE_MAP_TITLE_COLOR, 8, "Segoe UI Semibold"))
      return false;
   if(!StateMapCreateLabel(g_panel_state, "State", "NO TRADE", 15, 22, 270, 47, STATE_MAP_BADGE_TEXT_COLOR, 16, "Segoe UI Semibold"))
      return false;

   if(!StateMapCreateStatLabels(g_label_m1, g_value_m1, "M1", "M1", STATE_MAP_LABEL_COL_1, STATE_MAP_VALUE_COL_1, STATE_MAP_ROW_TOP))
      return false;
   if(!StateMapCreateStatLabels(g_label_score, g_value_score, "Score", "SCORE", STATE_MAP_LABEL_COL_2, STATE_MAP_VALUE_COL_2, STATE_MAP_ROW_TOP))
      return false;
   if(!StateMapCreateStatLabels(g_label_conf, g_value_conf, "Conf", "CONF", STATE_MAP_LABEL_COL_1, STATE_MAP_VALUE_COL_1, STATE_MAP_ROW_TOP + STATE_MAP_ROW_GAP))
      return false;
   if(!StateMapCreateStatLabels(g_label_trend, g_value_trend, "Trend", "TREND", STATE_MAP_LABEL_COL_2, STATE_MAP_VALUE_COL_2, STATE_MAP_ROW_TOP + STATE_MAP_ROW_GAP))
      return false;
   if(!StateMapCreateStatLabels(g_label_reason, g_value_reason, "Reason", "REASON", STATE_MAP_LABEL_COL_1, STATE_MAP_VALUE_COL_1, STATE_MAP_ROW_TOP + STATE_MAP_ROW_GAP * 2))
      return false;
   if(!StateMapCreateStatLabels(g_label_stoch, g_value_stoch, "Stoch", "STOCH", STATE_MAP_LABEL_COL_2, STATE_MAP_VALUE_COL_2, STATE_MAP_ROW_TOP + STATE_MAP_ROW_GAP * 2))
      return false;
   if(!StateMapCreateStatLabels(g_label_anchor, g_value_anchor, "Anchor", "ANCHOR", STATE_MAP_LABEL_COL_1, STATE_MAP_VALUE_COL_1, STATE_MAP_ROW_TOP + STATE_MAP_ROW_GAP * 3))
      return false;
   if(!StateMapCreateStatLabels(g_label_bars, g_value_bars, "Bars", "BARS", STATE_MAP_LABEL_COL_2, STATE_MAP_VALUE_COL_2, STATE_MAP_ROW_TOP + STATE_MAP_ROW_GAP * 3))
      return false;

   g_panel_ready = true;
   return true;
}

void StateMapPanelSetValue(CLabel &label, const string value, const color text_color, const int font_size = 10)
{
   label.Text(value);
   label.Color(text_color);
   label.FontSize(font_size);
}

void StateMapUpdateDialog(
   const double latest_anchor,
   const int latest_trend_state,
   const double latest_stoch,
   const int copied,
   const int valid_q_day_count
)
{
   if(!StateMapCreateDialog())
      return;

   string stoch_value = latest_stoch == EMPTY_VALUE ? "n/a" : DoubleToString(latest_stoch, 1);
   string anchor_value = latest_anchor == EMPTY_VALUE ? "n/a" : DoubleToString(latest_anchor, _Digits);
   string bars_value = IntegerToString(copied) + " / " + IntegerToString(valid_q_day_count);
   string reason_value = StateMapReasonLabel(g_qstate_reason);
   string signature = g_qstate_label +
      "|" + reason_value +
      "|" + IntegerToString((int)g_qstate_asof) +
      "|" + DoubleToString(g_qstate_score, 4) +
      "|" + DoubleToString(g_qstate_confidence, 4) +
      "|" + IntegerToString(latest_trend_state) +
      "|" + stoch_value +
      "|" + anchor_value +
      "|" + bars_value;

   if(signature == g_panel_signature)
      return;

   g_panel_header.ColorBackground(g_qstate_color);
   g_panel_header.ColorBorder(g_qstate_color);
   g_panel_state.Text(g_qstate_label);
   g_panel_state.Color(STATE_MAP_BADGE_TEXT_COLOR);
   g_panel_state.FontSize(StringLen(g_qstate_label) > 10 ? 14 : 16);

   StateMapPanelSetValue(g_value_m1, StateMapTimeLabel(g_qstate_asof), STATE_MAP_TEXT_COLOR);
   StateMapPanelSetValue(g_value_score, StateMapSignedScoreLabel(g_qstate_score), StateMapSignedValueColor(g_qstate_score));
   StateMapPanelSetValue(g_value_conf, DoubleToString(g_qstate_confidence, 2), STATE_MAP_TEXT_COLOR);
   StateMapPanelSetValue(g_value_trend, StateMapTrendLabel(latest_trend_state), StateMapTrendColor(latest_trend_state));
   StateMapPanelSetValue(g_value_reason, reason_value, STATE_MAP_TEXT_COLOR, 8);
   StateMapPanelSetValue(g_value_stoch, stoch_value, STATE_MAP_TEXT_COLOR);
   StateMapPanelSetValue(g_value_anchor, anchor_value, STATE_MAP_TEXT_COLOR);
   StateMapPanelSetValue(g_value_bars, bars_value, STATE_MAP_TEXT_COLOR, StringLen(bars_value) > 14 ? 8 : 10);

   g_panel_signature = signature;
}

bool StateMapRefreshQState()
{
   LimniVisualQStateSnapshot snapshot;
   string reason = "";
   if(!LimniVisualReadQStateSnapshot(_Symbol, snapshot, reason))
   {
      StateMapSetQStateFailure(
         reason == "" ? snapshot.reason_code : reason,
         snapshot.detail == "" ? "Start LimniVisualRuntimeService and wait for a portfolio q-state snapshot." : snapshot.detail
      );
      return false;
   }

   g_qstate_label = LimniQStateDirectionLabel(snapshot.trade_direction);
   g_qstate_color = StateMapQStateColor(snapshot.state, snapshot.trade_direction);
   g_qstate_reason = snapshot.reason_code;
   g_qstate_asof = snapshot.portfolio_asof_m1_time;
   g_qstate_score = snapshot.pair_direction_score;
   g_qstate_confidence = snapshot.confidence;
   g_qstate_details = snapshot.detail;
   return snapshot.valid;
}

void StateMapRenderPanel(
   const double latest_anchor,
   const int latest_trend_state,
   const double latest_stoch,
   const int copied,
   const int valid_q_day_count
)
{
   StateMapUpdateDialog(latest_anchor, latest_trend_state, latest_stoch, copied, valid_q_day_count);
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
   StateMapRenderPanel(EMPTY_VALUE, 0, EMPTY_VALUE, 0, 0);
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
   StateMapDeleteObjects();
   g_panel_ready = false;
   g_panel_signature = "";
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
   if(!StateMapEnsureStackCache(
      chart_oldest,
      chart_newest,
      stack_refreshed
   ))
   {
      StateMapRenderPanel(EMPTY_VALUE, 0, EMPTY_VALUE, 0, 0);
      return rates_total;
   }
   if(stack_refreshed)
      g_panel_signature = "";

   bool chart_series = ArrayGetAsSeries(time);
   int limit = LimniChangedBarLimit(rates_total, prev_calculated, STATE_MAP_MAX_INITIAL_PROJECT_BARS);
   LimniProjectDoubleToChartLimit(
      time,
      rates_total,
      chart_series,
      g_source_times,
      g_source_line,
      PriceAnchorBuffer,
      limit
   );

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

   datetime latest_closed_m1 = StateMapLatestClosedM1();
   if(prev_calculated <= 0 || latest_closed_m1 != g_last_qstate_refresh_bar)
   {
      if(StateMapRefreshQState())
         g_last_qstate_refresh_bar = latest_closed_m1;
      else
         g_panel_signature = "";
   }

   int latest_source_index = ArraySize(g_source_times) - 1;
   double latest_anchor = latest_source_index >= 0 ? g_source_line[latest_source_index] : EMPTY_VALUE;
   int latest_trend_state = latest_source_index >= 0 ? g_source_ma_state[latest_source_index] : 0;
   double latest_stoch = latest_source_index >= 0 ? g_source_stoch[latest_source_index] : EMPTY_VALUE;

   StateMapRenderPanel(
      latest_anchor,
      latest_trend_state,
      latest_stoch,
      g_stack_copied,
      g_stack_valid_q_day_count
   );

   return rates_total;
}
