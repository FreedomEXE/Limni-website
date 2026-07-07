//+------------------------------------------------------------------+
//|                                             StateMap.mq5         |
//|                   Limni State Map shared LRMG/q viewer           |
//+------------------------------------------------------------------+
#property copyright "LIMNI LTD"
#property version   "1.41"
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

#include <Controls\Dialog.mqh>
#include <Controls\Label.mqh>
#include <Controls\Panel.mqh>
#include "..\\Include\\LimniQStateCore.mqh"

const int STATE_MAP_SCALE_LOOKBACK_DAYS = 0;
const int STATE_MAP_MAX_INITIAL_PROJECT_BARS = 50000;
const int STATE_MAP_PANEL_WIDTH = 396;
const int STATE_MAP_PANEL_HEIGHT = 272;
const int STATE_MAP_PANEL_RIGHT = 18;
const int STATE_MAP_PANEL_TOP = 22;
const int STATE_MAP_BODY_LEFT = 10;
const int STATE_MAP_BODY_TOP = 8;
const int STATE_MAP_BODY_RIGHT = 386;
const int STATE_MAP_BODY_BOTTOM = 246;
const int STATE_MAP_HEADER_LEFT = 18;
const int STATE_MAP_HEADER_TOP = 16;
const int STATE_MAP_HEADER_RIGHT = 378;
const int STATE_MAP_HEADER_BOTTOM = 84;
const int STATE_MAP_COLUMN_LEFT = 24;
const int STATE_MAP_COLUMN_RIGHT = 210;
const int STATE_MAP_ROW_TOP = 102;
const int STATE_MAP_ROW_GAP = 34;
const color STATE_MAP_PANEL_BG = C'8,13,21';
const color STATE_MAP_PANEL_BORDER = C'49,63,82';
const color STATE_MAP_TITLE_COLOR = C'151,164,181';
const color STATE_MAP_TEXT_COLOR = C'231,236,243';
const color STATE_MAP_MUTED_COLOR = C'139,152,170';
const color STATE_MAP_SEPARATOR_COLOR = C'35,47,64';
const color STATE_MAP_LONG_COLOR = C'0,185,108';
const color STATE_MAP_SHORT_COLOR = C'238,72,94';
const color STATE_MAP_NEUTRAL_COLOR = C'83,96,115';
const color STATE_MAP_STRESS_COLOR = C'214,143,51';
const color STATE_MAP_BADGE_TEXT_COLOR = clrWhite;

const string STATE_MAP_OBJECT_PREFIX = "Limni_StateMap_";
const string STATE_MAP_DIALOG_NAME = "Limni_StateMap_Dialog";

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

CAppDialog g_state_dialog;
CPanel g_panel_body;
CPanel g_panel_header;
CPanel g_panel_rule;
CPanel g_panel_column_rule;
CLabel g_panel_title;
CLabel g_panel_state;
CLabel g_panel_reason_line;
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
   return StateMapClip(output, 26);
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

color StateMapQStateColor(const LimniQStateDirection &decision)
{
   if(decision.state == LIMNI_QSTATE_PAIR_STATE_STRESS)
      return STATE_MAP_STRESS_COLOR;
   if(decision.trade_direction == LIMNI_QSTATE_SIDE_LONG)
      return STATE_MAP_LONG_COLOR;
   if(decision.trade_direction == LIMNI_QSTATE_SIDE_SHORT)
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
   datetime source_from = LimniLrmgSourceStartForChart(chart_oldest, STATE_MAP_SCALE_LOOKBACK_DAYS);

   if(g_stack_ready &&
      g_stack_point == _Point &&
      g_stack_latest_closed_m1 == latest_closed_m1 &&
      source_from >= g_stack_cache_from)
   {
      return true;
   }

   if(!LimniLoadCachedStackSeries(
      chart_oldest,
      chart_newest,
      STATE_MAP_SCALE_LOOKBACK_DAYS,
      _Point,
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
      g_stack_valid_q_day_count
   ))
   {
      return false;
   }

   g_stack_cache_from = source_from;
   g_stack_latest_closed_m1 = latest_closed_m1;
   g_stack_point = _Point;
   g_stack_ready = true;
   refreshed = true;
   return true;
}

bool StateMapCreatePanel(CPanel &panel, const string suffix, const int x1, const int y1, const int x2, const int y2, const color bg, const color border)
{
   if(!panel.Create(0, STATE_MAP_OBJECT_PREFIX + suffix, 0, x1, y1, x2, y2))
      return false;
   panel.ColorBackground(bg);
   panel.ColorBorder(border);
   panel.BorderType(BORDER_FLAT);
   return g_state_dialog.Add(panel);
}

bool StateMapCreateLabel(CLabel &label, const string suffix, const string text, const int x1, const int y1, const int x2, const int y2, const color text_color, const int font_size, const string font_name)
{
   if(!label.Create(0, STATE_MAP_OBJECT_PREFIX + suffix, 0, x1, y1, x2, y2))
      return false;
   label.Text(text);
   label.Color(text_color);
   label.Font(font_name);
   label.FontSize(font_size);
   return g_state_dialog.Add(label);
}

bool StateMapCreateStatLabels(CLabel &tag, CLabel &value, const string suffix, const string caption, const int x, const int y)
{
   if(!StateMapCreateLabel(tag, suffix + "_Tag", caption, x, y, x + 154, y + 13, STATE_MAP_MUTED_COLOR, 7, "Segoe UI Semibold"))
      return false;
   return StateMapCreateLabel(value, suffix + "_Value", "", x, y + 13, x + 160, y + 31, STATE_MAP_TEXT_COLOR, 10, "Segoe UI Semibold");
}

bool StateMapCreateDialog()
{
   if(g_panel_ready)
      return true;

   int panel_left = StateMapPanelLeft();
   if(!g_state_dialog.Create(
      0,
      STATE_MAP_DIALOG_NAME,
      0,
      panel_left,
      STATE_MAP_PANEL_TOP,
      panel_left + STATE_MAP_PANEL_WIDTH,
      STATE_MAP_PANEL_TOP + STATE_MAP_PANEL_HEIGHT
   ))
   {
      return false;
   }

   g_state_dialog.Caption("Limni State Map");

   if(!StateMapCreatePanel(g_panel_body, "Body", STATE_MAP_BODY_LEFT, STATE_MAP_BODY_TOP, STATE_MAP_BODY_RIGHT, STATE_MAP_BODY_BOTTOM, STATE_MAP_PANEL_BG, STATE_MAP_PANEL_BORDER))
      return false;
   if(!StateMapCreatePanel(g_panel_header, "Header", STATE_MAP_HEADER_LEFT, STATE_MAP_HEADER_TOP, STATE_MAP_HEADER_RIGHT, STATE_MAP_HEADER_BOTTOM, STATE_MAP_NEUTRAL_COLOR, STATE_MAP_NEUTRAL_COLOR))
      return false;
   if(!StateMapCreatePanel(g_panel_rule, "Rule", 24, 94, 372, 95, STATE_MAP_SEPARATOR_COLOR, STATE_MAP_SEPARATOR_COLOR))
      return false;
   if(!StateMapCreatePanel(g_panel_column_rule, "ColumnRule", 196, 106, 197, 228, STATE_MAP_SEPARATOR_COLOR, STATE_MAP_SEPARATOR_COLOR))
      return false;

   if(!StateMapCreateLabel(g_panel_title, "Title", "LIMNI STATE MAP", 30, 22, 210, 38, STATE_MAP_TITLE_COLOR, 8, "Segoe UI Semibold"))
      return false;
   if(!StateMapCreateLabel(g_panel_state, "State", "NO TRADE", 30, 36, 370, 64, STATE_MAP_BADGE_TEXT_COLOR, 20, "Segoe UI Semibold"))
      return false;
   if(!StateMapCreateLabel(g_panel_reason_line, "ReasonLine", "reason: syncing", 30, 64, 370, 78, C'215,222,232', 8, "Segoe UI"))
      return false;

   if(!StateMapCreateStatLabels(g_label_m1, g_value_m1, "M1", "M1 AS-OF", STATE_MAP_COLUMN_LEFT, STATE_MAP_ROW_TOP))
      return false;
   if(!StateMapCreateStatLabels(g_label_score, g_value_score, "Score", "SCORE", STATE_MAP_COLUMN_LEFT, STATE_MAP_ROW_TOP + STATE_MAP_ROW_GAP))
      return false;
   if(!StateMapCreateStatLabels(g_label_conf, g_value_conf, "Conf", "CONF", STATE_MAP_COLUMN_LEFT, STATE_MAP_ROW_TOP + STATE_MAP_ROW_GAP * 2))
      return false;
   if(!StateMapCreateStatLabels(g_label_trend, g_value_trend, "Trend", "TREND", STATE_MAP_COLUMN_LEFT, STATE_MAP_ROW_TOP + STATE_MAP_ROW_GAP * 3))
      return false;

   if(!StateMapCreateStatLabels(g_label_reason, g_value_reason, "Reason", "REASON", STATE_MAP_COLUMN_RIGHT, STATE_MAP_ROW_TOP))
      return false;
   if(!StateMapCreateStatLabels(g_label_stoch, g_value_stoch, "Stoch", "STOCH", STATE_MAP_COLUMN_RIGHT, STATE_MAP_ROW_TOP + STATE_MAP_ROW_GAP))
      return false;
   if(!StateMapCreateStatLabels(g_label_anchor, g_value_anchor, "Anchor", "ANCHOR", STATE_MAP_COLUMN_RIGHT, STATE_MAP_ROW_TOP + STATE_MAP_ROW_GAP * 2))
      return false;
   if(!StateMapCreateStatLabels(g_label_bars, g_value_bars, "Bars", "BARS / QDAYS", STATE_MAP_COLUMN_RIGHT, STATE_MAP_ROW_TOP + STATE_MAP_ROW_GAP * 3))
      return false;

   if(!g_state_dialog.Run())
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
   g_panel_state.FontSize(StringLen(g_qstate_label) > 10 ? 18 : 20);
   g_panel_reason_line.Text("reason: " + reason_value);

   StateMapPanelSetValue(g_value_m1, StateMapTimeLabel(g_qstate_asof), STATE_MAP_TEXT_COLOR);
   StateMapPanelSetValue(g_value_score, DoubleToString(g_qstate_score, 2), StateMapSignedValueColor(g_qstate_score));
   StateMapPanelSetValue(g_value_conf, DoubleToString(g_qstate_confidence, 2), STATE_MAP_TEXT_COLOR);
   StateMapPanelSetValue(g_value_trend, StateMapTrendLabel(latest_trend_state), StateMapTrendColor(latest_trend_state));
   StateMapPanelSetValue(g_value_reason, reason_value, STATE_MAP_TEXT_COLOR, StringLen(reason_value) > 16 ? 8 : 10);
   StateMapPanelSetValue(g_value_stoch, stoch_value, STATE_MAP_TEXT_COLOR);
   StateMapPanelSetValue(g_value_anchor, anchor_value, STATE_MAP_TEXT_COLOR);
   StateMapPanelSetValue(g_value_bars, bars_value, STATE_MAP_TEXT_COLOR, StringLen(bars_value) > 14 ? 8 : 10);

   g_panel_signature = signature;
}

ulong StateMapPortfolioQStateHash(const LimniQStatePairFeatures &features[], const double &ccy_scores[])
{
   string payload = LimniQStateFormulaId() + "|" + (string)LimniQStateFormulaHash();
   for(int symbol_id = 0; symbol_id < LIMNI_QSTATE_SYMBOL_COUNT; symbol_id++)
   {
      string canonical = LimniQStateCanonicalSymbol(symbol_id);
      int base_ccy = -1;
      int quote_ccy = -1;
      LimniQStateBaseQuote(canonical, base_ccy, quote_ccy);
      double base_score = base_ccy >= 0 ? ccy_scores[base_ccy] : 0.0;
      double quote_score = quote_ccy >= 0 ? ccy_scores[quote_ccy] : 0.0;
      payload += "|" + IntegerToString(symbol_id) +
         ":" + TimeToString(features[symbol_id].source_m1_time, TIME_DATE | TIME_SECONDS) +
         ":" + DoubleToString(features[symbol_id].pair_q_score, 6) +
         ":" + DoubleToString(base_score, 6) +
         ":" + DoubleToString(quote_score, 6);
   }
   return LimniQStateHashString(payload);
}

bool StateMapRefreshQState()
{
   LimniQStatePairFeatures pair_features[LIMNI_QSTATE_SYMBOL_COUNT];
   double ccy_sums[LIMNI_QSTATE_CCY_COUNT];
   int ccy_counts[LIMNI_QSTATE_CCY_COUNT];
   double ccy_scores[LIMNI_QSTATE_CCY_COUNT];
   datetime portfolio_asof = 0;

   for(int i = 0; i < LIMNI_QSTATE_SYMBOL_COUNT; i++)
      LimniQStateResetPairFeatures(pair_features[i]);

   for(int c = 0; c < LIMNI_QSTATE_CCY_COUNT; c++)
   {
      ccy_sums[c] = 0.0;
      ccy_counts[c] = 0;
      ccy_scores[c] = 0.0;
   }

   for(int symbol_id = 0; symbol_id < LIMNI_QSTATE_SYMBOL_COUNT; symbol_id++)
   {
      string canonical = LimniQStateCanonicalSymbol(symbol_id);
      string symbol = LimniQStateResolveBrokerSymbol(canonical);
      if(!LimniQStateBuildPairFeatures(symbol, pair_features[symbol_id]))
      {
         StateMapSetQStateFailure(
            pair_features[symbol_id].reason_code,
            "reason=" + pair_features[symbol_id].reason_code +
            "|symbol=" + symbol +
            "|formula_id=" + LimniQStateFormulaId() +
            "|formula_hash=" + (string)LimniQStateFormulaHash()
         );
         return false;
      }

      if(portfolio_asof <= 0)
         portfolio_asof = pair_features[symbol_id].source_m1_time;
      else if(pair_features[symbol_id].source_m1_time != portfolio_asof)
      {
         StateMapSetQStateFailure(
            "mixed_source_m1_time",
            "reason=mixed_source_m1_time" +
            "|symbol=" + symbol +
            "|expected=" + TimeToString(portfolio_asof, TIME_DATE | TIME_SECONDS) +
            "|actual=" + TimeToString(pair_features[symbol_id].source_m1_time, TIME_DATE | TIME_SECONDS) +
            "|formula_id=" + LimniQStateFormulaId() +
            "|formula_hash=" + (string)LimniQStateFormulaHash()
         );
         return false;
      }

      int base_ccy = -1;
      int quote_ccy = -1;
      LimniQStateBaseQuote(canonical, base_ccy, quote_ccy);
      if(base_ccy < 0 || quote_ccy < 0)
         continue;

      ccy_sums[base_ccy] += pair_features[symbol_id].pair_q_score;
      ccy_counts[base_ccy]++;
      ccy_sums[quote_ccy] -= pair_features[symbol_id].pair_q_score;
      ccy_counts[quote_ccy]++;
   }

   for(int c = 0; c < LIMNI_QSTATE_CCY_COUNT; c++)
   {
      if(ccy_counts[c] > 0)
         ccy_scores[c] = ccy_sums[c] / (double)ccy_counts[c];
   }

   int chart_symbol_id = LimniQStateSymbolIdFromBrokerSymbol(_Symbol);
   if(chart_symbol_id < 0)
   {
      StateMapSetQStateFailure(
         "chart_symbol_not_in_universe",
         "reason=chart_symbol_not_in_universe|symbol=" + _Symbol
      );
      return false;
   }

   string chart_canonical = LimniQStateCanonicalSymbol(chart_symbol_id);
   int base_ccy = -1;
   int quote_ccy = -1;
   LimniQStateBaseQuote(chart_canonical, base_ccy, quote_ccy);
   if(base_ccy < 0 || quote_ccy < 0)
      return false;

   LimniQStateDirection decision;
   LimniQStateFinalizeDirection(
      pair_features[chart_symbol_id],
      ccy_scores[base_ccy],
      ccy_scores[quote_ccy],
      decision
   );

   ulong portfolio_hash = StateMapPortfolioQStateHash(pair_features, ccy_scores);
   g_qstate_label = LimniQStateDirectionLabel(decision.trade_direction);
   g_qstate_color = StateMapQStateColor(decision);
   g_qstate_reason = decision.reason_code;
   g_qstate_asof = portfolio_asof;
   g_qstate_score = decision.pair_direction_score;
   g_qstate_confidence = decision.confidence;
   g_qstate_details = "formula_id=" + decision.formula_id +
      "|formula_hash=" + (string)decision.formula_hash +
      "|portfolio_asof_m1_time=" + TimeToString(portfolio_asof, TIME_DATE | TIME_SECONDS) +
      "|portfolio_valid_pair_count=" + IntegerToString(LIMNI_QSTATE_SYMBOL_COUNT) +
      "|portfolio_snapshot_hash=" + (string)portfolio_hash +
      "|source_m1_time=" + TimeToString(decision.source_m1_time, TIME_DATE | TIME_SECONDS) +
      "|state=" + IntegerToString(decision.state) +
      "|reason_code=" + decision.reason_code +
      "|pair_q_score=" + DoubleToString(decision.pair_q_score, 6) +
      "|base_currency_score=" + DoubleToString(decision.base_currency_score, 6) +
      "|quote_currency_score=" + DoubleToString(decision.quote_currency_score, 6) +
      "|pair_direction_score=" + DoubleToString(decision.pair_direction_score, 6) +
      "|confidence=" + DoubleToString(decision.confidence, 6);
   return decision.valid;
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
   if(g_panel_ready)
      g_state_dialog.Destroy(reason);
   g_panel_ready = false;
   g_panel_signature = "";
}

void OnChartEvent(
   const int id,
   const long &lparam,
   const double &dparam,
   const string &sparam
)
{
   if(g_panel_ready)
      g_state_dialog.ChartEvent(id, lparam, dparam, sparam);
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
      StateMapRefreshQState();
      g_last_qstate_refresh_bar = latest_closed_m1;
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
