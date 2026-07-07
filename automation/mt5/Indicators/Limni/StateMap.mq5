//+------------------------------------------------------------------+
//|                                             StateMap.mq5         |
//|                   Limni State Map shared LRMG/q viewer           |
//+------------------------------------------------------------------+
#property copyright "LIMNI LTD"
#property version   "1.20"
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

#include "..\\Include\\LimniQStateCore.mqh"

const int STATE_MAP_SCALE_LOOKBACK_DAYS = 0;
const int STATE_MAP_PANEL_WIDTH = 360;
const int STATE_MAP_PANEL_HEIGHT = 132;
const int STATE_MAP_PANEL_RIGHT = 18;
const int STATE_MAP_PANEL_TOP = 22;
const int STATE_MAP_PANEL_PADDING = 16;
const int STATE_MAP_BADGE_TOP = 34;
const int STATE_MAP_BADGE_HEIGHT = 46;
const color STATE_MAP_PANEL_BG = C'12,16,20';
const color STATE_MAP_PANEL_BORDER = C'68,78,88';
const color STATE_MAP_TITLE_COLOR = C'160,174,184';
const color STATE_MAP_TEXT_COLOR = C'224,230,234';
const color STATE_MAP_MUTED_COLOR = C'145,156,166';
const color STATE_MAP_LONG_COLOR = C'31,142,82';
const color STATE_MAP_SHORT_COLOR = C'194,68,54';
const color STATE_MAP_NEUTRAL_COLOR = C'82,92,104';
const color STATE_MAP_STRESS_COLOR = C'198,128,44';
const color STATE_MAP_BADGE_TEXT_COLOR = clrWhite;

const string STATE_MAP_BACKGROUND_NAME = "Limni_StateMap_Background";
const string STATE_MAP_BADGE_NAME = "Limni_StateMap_Badge";
const string STATE_MAP_TITLE_NAME = "Limni_StateMap_Title";
const string STATE_MAP_STATE_NAME = "Limni_StateMap_State";
const string STATE_MAP_META_NAME = "Limni_StateMap_Meta";
const string STATE_MAP_CONTEXT_NAME = "Limni_StateMap_Context";
const string STATE_MAP_SYNC_NAME = "Limni_StateMap_Sync";

double PriceAnchorBuffer[];
double StateAnchorBuffer[];
double StateColorBuffer[];

datetime g_last_qstate_refresh_bar = 0;
string g_qstate_label = "NO TRADE";
string g_qstate_reason = "not_refreshed";
string g_qstate_details = "";
datetime g_qstate_asof = 0;
double g_qstate_score = 0.0;
double g_qstate_confidence = 0.0;
color g_qstate_color = STATE_MAP_NEUTRAL_COLOR;

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
   ObjectDelete(0, STATE_MAP_BACKGROUND_NAME);
   ObjectDelete(0, STATE_MAP_BADGE_NAME);
   ObjectDelete(0, STATE_MAP_TITLE_NAME);
   ObjectDelete(0, STATE_MAP_STATE_NAME);
   ObjectDelete(0, STATE_MAP_META_NAME);
   ObjectDelete(0, STATE_MAP_CONTEXT_NAME);
   ObjectDelete(0, STATE_MAP_SYNC_NAME);
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

void StateMapSetRectangle(
   const string name,
   const int x,
   const int y,
   const int width,
   const int height,
   const color fill_color,
   const color border_color,
   const long z_order
)
{
   if(ObjectFind(0, name) < 0)
      ObjectCreate(0, name, OBJ_RECTANGLE_LABEL, 0, 0, 0);

   ObjectSetInteger(0, name, OBJPROP_CORNER, CORNER_LEFT_UPPER);
   ObjectSetInteger(0, name, OBJPROP_ANCHOR, ANCHOR_LEFT_UPPER);
   ObjectSetInteger(0, name, OBJPROP_XDISTANCE, x);
   ObjectSetInteger(0, name, OBJPROP_YDISTANCE, y);
   ObjectSetInteger(0, name, OBJPROP_XSIZE, width);
   ObjectSetInteger(0, name, OBJPROP_YSIZE, height);
   ObjectSetInteger(0, name, OBJPROP_BGCOLOR, fill_color);
   ObjectSetInteger(0, name, OBJPROP_COLOR, border_color);
   ObjectSetInteger(0, name, OBJPROP_BORDER_TYPE, BORDER_FLAT);
   ObjectSetInteger(0, name, OBJPROP_BACK, false);
   ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
   ObjectSetInteger(0, name, OBJPROP_HIDDEN, true);
   ObjectSetInteger(0, name, OBJPROP_ZORDER, z_order);
}

void StateMapSetLabel(
   const string name,
   const string text,
   const color text_color,
   const int font_size,
   const int x,
   const int y,
   const string font_name,
   const ENUM_ANCHOR_POINT anchor,
   const long z_order
)
{
   if(ObjectFind(0, name) < 0)
      ObjectCreate(0, name, OBJ_LABEL, 0, 0, 0);

   ObjectSetInteger(0, name, OBJPROP_CORNER, CORNER_LEFT_UPPER);
   ObjectSetInteger(0, name, OBJPROP_ANCHOR, anchor);
   ObjectSetInteger(0, name, OBJPROP_XDISTANCE, x);
   ObjectSetInteger(0, name, OBJPROP_YDISTANCE, y);
   ObjectSetInteger(0, name, OBJPROP_FONTSIZE, font_size);
   ObjectSetInteger(0, name, OBJPROP_COLOR, text_color);
   ObjectSetInteger(0, name, OBJPROP_BACK, false);
   ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
   ObjectSetInteger(0, name, OBJPROP_HIDDEN, true);
   ObjectSetInteger(0, name, OBJPROP_ZORDER, z_order);
   ObjectSetString(0, name, OBJPROP_FONT, font_name);
   ObjectSetString(0, name, OBJPROP_TEXT, text);
}

void StateMapEnsurePanelBackground()
{
   const int panel_left = StateMapPanelLeft();
   StateMapSetRectangle(
      STATE_MAP_BACKGROUND_NAME,
      panel_left,
      STATE_MAP_PANEL_TOP,
      STATE_MAP_PANEL_WIDTH,
      STATE_MAP_PANEL_HEIGHT,
      STATE_MAP_PANEL_BG,
      STATE_MAP_PANEL_BORDER,
      80
   );
   StateMapSetRectangle(
      STATE_MAP_BADGE_NAME,
      panel_left + STATE_MAP_PANEL_PADDING,
      STATE_MAP_PANEL_TOP + STATE_MAP_BADGE_TOP,
      STATE_MAP_PANEL_WIDTH - (STATE_MAP_PANEL_PADDING * 2),
      STATE_MAP_BADGE_HEIGHT,
      g_qstate_color,
      g_qstate_color,
      90
   );
}

string StateMapTrendLabel(const int state)
{
   if(state > 0)
      return "Trend up";
   if(state < 0)
      return "Trend down";
   return "Trend neutral";
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
   const int latest_trend_state,
   const double latest_stoch
)
{
   StateMapEnsurePanelBackground();

   const int panel_left = StateMapPanelLeft();
   const int content_left = panel_left + STATE_MAP_PANEL_PADDING;
   const int content_center = panel_left + (STATE_MAP_PANEL_WIDTH / 2);
   const int title_y = STATE_MAP_PANEL_TOP + 12;
   const int badge_center_y = STATE_MAP_PANEL_TOP + STATE_MAP_BADGE_TOP + (STATE_MAP_BADGE_HEIGHT / 2);
   const int meta_y = STATE_MAP_PANEL_TOP + 90;
   const int context_y = STATE_MAP_PANEL_TOP + 110;

   string meta = "M1 ";
   if(g_qstate_asof > 0)
      meta += TimeToString(g_qstate_asof, TIME_MINUTES);
   else
      meta += "syncing";
   meta += "   Score " + DoubleToString(g_qstate_score, 2) +
      "   Conf " + DoubleToString(g_qstate_confidence, 2);

   string context = StateMapTrendLabel(latest_trend_state) +
      "   Stoch " + (latest_stoch == EMPTY_VALUE ? "n/a" : DoubleToString(latest_stoch, 1)) +
      "   " + StateMapClip(g_qstate_reason, 24);

   int state_font_size = StringLen(g_qstate_label) > 8 ? 21 : 25;

   StateMapSetLabel(STATE_MAP_TITLE_NAME, "LIMNI STATE MAP", STATE_MAP_TITLE_COLOR, 10, content_left, title_y, "Arial", ANCHOR_LEFT_UPPER, 100);
   StateMapSetLabel(STATE_MAP_STATE_NAME, g_qstate_label, STATE_MAP_BADGE_TEXT_COLOR, state_font_size, content_center, badge_center_y + 1, "Arial Black", ANCHOR_CENTER, 110);
   StateMapSetLabel(STATE_MAP_META_NAME, meta, STATE_MAP_TEXT_COLOR, 9, content_left, meta_y, "Consolas", ANCHOR_LEFT_UPPER, 100);
   StateMapSetLabel(STATE_MAP_CONTEXT_NAME, context, STATE_MAP_MUTED_COLOR, 9, content_left, context_y, "Consolas", ANCHOR_LEFT_UPPER, 100);
   ObjectDelete(0, STATE_MAP_SYNC_NAME);
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
   StateMapRenderPanel(0, EMPTY_VALUE);
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
   StateMapDeleteObjects();
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
   LimniChartTimeRange(time, rates_total, chart_oldest, chart_newest);
   if(chart_oldest <= 0 || chart_newest <= 0)
      return rates_total;

   datetime source_times[];
   double source_closes[];
   double source_q[];
   double source_line[];
   double source_stoch[];
   double source_ma[];
   int source_ma_state[];
   int source_trigger[];
   int copied = 0;
   int day_count = 0;
   int valid_q_day_count = 0;

   if(!LimniLoadCachedStackSeries(
      chart_oldest,
      chart_newest,
      STATE_MAP_SCALE_LOOKBACK_DAYS,
      _Point,
      source_times,
      source_closes,
      source_q,
      source_line,
      source_stoch,
      source_ma,
      source_ma_state,
      source_trigger,
      copied,
      day_count,
      valid_q_day_count
   ))
   {
      return rates_total;
   }

   bool chart_series = ArrayGetAsSeries(time);
   double next_price_anchor[];
   double next_state_anchor[];
   double next_state_color[];
   ArrayResize(next_price_anchor, rates_total);
   ArrayResize(next_state_anchor, rates_total);
   ArrayResize(next_state_color, rates_total);
   LimniClearDoubleBuffer(next_price_anchor, rates_total);
   LimniClearDoubleBuffer(next_state_anchor, rates_total);
   LimniFillDoubleBuffer(next_state_color, rates_total, 2.0);

   LimniProjectDoubleToChart(time, rates_total, chart_series, source_times, source_line, next_price_anchor);

   int source_count = ArraySize(source_times);
   int source_index = 0;
   for(int logical = 0; logical < rates_total; logical++)
   {
      int idx = LimniChronIndex(rates_total, chart_series, logical);
      datetime bar_time = time[idx];
      while(source_index + 1 < source_count && source_times[source_index + 1] <= bar_time)
         source_index++;

      if(source_count > 0 && source_times[source_index] <= bar_time && source_line[source_index] != EMPTY_VALUE)
      {
         next_state_anchor[idx] = source_line[source_index];
         if(source_ma_state[source_index] > 0)
            next_state_color[idx] = 0.0;
         else if(source_ma_state[source_index] < 0)
            next_state_color[idx] = 1.0;
         else
            next_state_color[idx] = 2.0;
      }
   }

   LimniCopyDoubleBuffer(next_price_anchor, PriceAnchorBuffer, rates_total);
   LimniCopyDoubleBuffer(next_state_anchor, StateAnchorBuffer, rates_total);
   LimniCopyDoubleBuffer(next_state_color, StateColorBuffer, rates_total);

   datetime latest_closed_m1 = iTime(_Symbol, PERIOD_M1, 1);
   if(latest_closed_m1 <= 0)
      latest_closed_m1 = TimeCurrent();
   if(prev_calculated <= 0 || latest_closed_m1 != g_last_qstate_refresh_bar)
   {
      StateMapRefreshQState();
      g_last_qstate_refresh_bar = latest_closed_m1;
   }

   int latest_source_index = ArraySize(source_times) - 1;
   int latest_trend_state = latest_source_index >= 0 ? source_ma_state[latest_source_index] : 0;
   double latest_stoch = latest_source_index >= 0 ? source_stoch[latest_source_index] : EMPTY_VALUE;

   StateMapRenderPanel(
      latest_trend_state,
      latest_stoch
   );

   return rates_total;
}
