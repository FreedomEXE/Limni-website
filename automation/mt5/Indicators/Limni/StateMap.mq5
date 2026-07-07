//+------------------------------------------------------------------+
//|                                             StateMap.mq5         |
//|                   Limni State Map shared LRMG/q viewer           |
//+------------------------------------------------------------------+
#property copyright "LIMNI LTD"
#property version   "1.54"
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

#include "..\\Include\\LimniVisualRuntimeSnapshot.mqh"

input bool ShowCenterLine = true;

const int STATE_MAP_SCALE_LOOKBACK_DAYS = 0;
const int STATE_MAP_MAX_INITIAL_PROJECT_BARS = 50000;
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

bool g_panel_ready = false;
string g_panel_signature = "";
bool g_panel_minimized = false;
bool g_panel_user_moved = false;
int g_panel_x = -1;
int g_panel_y = -1;
double g_panel_latest_anchor = EMPTY_VALUE;
int g_panel_latest_trend_state = 0;
double g_panel_latest_stoch = EMPTY_VALUE;
int g_panel_latest_copied = 0;
int g_panel_latest_valid_q_day_count = 0;

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
   return StateMapClip(output, 34);
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

bool StateMapHasQStateSnapshot()
{
   return g_qstate_asof > 0;
}

string StateMapPanelStateLabel()
{
   if(g_qstate_label == "FAIL CLOSED")
      return "DATA CHECK";
   return g_qstate_label;
}

string StateMapPanelScoreLabel()
{
   if(!StateMapHasQStateSnapshot())
      return "n/a";
   return StateMapSignedScoreLabel(g_qstate_score);
}

string StateMapPanelConfidenceLabel()
{
   if(!StateMapHasQStateSnapshot())
      return "n/a";
   return DoubleToString(g_qstate_confidence, 2);
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

string StateMapPanelStatusLabel()
{
   if(g_qstate_label == "FAIL CLOSED")
      return "data unavailable";
   string reason = StateMapReasonLabel(g_qstate_reason);
   return reason == "unknown" || reason == "not refreshed" ? "ready" : reason;
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
   bool snapshot_ok = LimniVisualReadStackSnapshot(
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
   );

   if(!snapshot_ok || snapshot_latest < latest_closed_m1)
   {
      string fallback_reason = "";
      if(!LimniVisualBuildStackSnapshot(
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
         fallback_reason
      ))
      {
         StateMapSetQStateFailure(
            fallback_reason == "" ? (snapshot_ok ? "stack_snapshot_stale" : reason) : fallback_reason,
            "Stack snapshot and local visual fallback are unavailable."
         );
         return false;
      }

      int fallback_count = ArraySize(g_source_times);
      if(fallback_count <= 0)
      {
         StateMapSetQStateFailure("stack_fallback_empty", "Local visual fallback returned no closed-M1 bars.");
         return false;
      }
      snapshot_latest = g_source_times[fallback_count - 1];

      ulong write_hash = 0;
      string write_reason = "";
      LimniVisualWriteStackSnapshot(
         _Symbol,
         STATE_MAP_SCALE_LOOKBACK_DAYS,
         g_stack_point,
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
         write_hash,
         write_reason
      );
   }

   g_stack_cache_from = chart_oldest;
   g_stack_latest_closed_m1 = snapshot_latest;
   g_stack_ready = true;
   refreshed = true;
   return true;
}

ulong StateMapPortfolioQStateHash(
   const LimniQStatePairFeatures &pair_features[],
   const double &ccy_scores[]
)
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
         ":" + LimniVisualStamp(pair_features[symbol_id].source_m1_time) +
         ":" + DoubleToString(pair_features[symbol_id].pair_q_score, 6) +
         ":" + DoubleToString(base_score, 6) +
         ":" + DoubleToString(quote_score, 6);
   }
   return LimniQStateHashString(payload);
}

bool StateMapBuildLocalQStateSnapshot(
   LimniVisualQStateSnapshot &snapshot,
   string &reason_code
)
{
   LimniVisualResetQStateSnapshot(snapshot);
   reason_code = "";

   int chart_symbol_id = LimniQStateSymbolIdFromBrokerSymbol(_Symbol);
   if(chart_symbol_id < 0)
   {
      reason_code = "chart_symbol_not_in_forced28";
      return false;
   }

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
      double point = 0.0;
      datetime snapshot_latest = 0;
      ulong stack_snapshot_hash = 0;
      string stack_reason = "";
      bool stack_ok = LimniVisualReadStackSnapshot(
         symbol,
         STATE_MAP_SCALE_LOOKBACK_DAYS,
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
         valid_q_day_count,
         point,
         snapshot_latest,
         stack_snapshot_hash,
         stack_reason
      );

      datetime symbol_latest = iTime(symbol, LIMNI_LRMG_SOURCE_TIMEFRAME, 1);
      if(!stack_ok || (symbol_latest > 0 && snapshot_latest < symbol_latest))
      {
         if(!LimniVisualBuildStackSnapshot(
            symbol,
            STATE_MAP_SCALE_LOOKBACK_DAYS,
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
            valid_q_day_count,
            point,
            stack_reason
         ))
         {
            reason_code = "qstate_stack_failed_" + canonical + "_" + stack_reason;
            return false;
         }

         string write_reason = "";
         LimniVisualWriteStackSnapshot(
            symbol,
            STATE_MAP_SCALE_LOOKBACK_DAYS,
            point,
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
            valid_q_day_count,
            stack_snapshot_hash,
            write_reason
         );
      }

      if(!LimniVisualQStateFeaturesFromStack(
         symbol,
         source_times,
         source_closes,
         source_q,
         source_line,
         source_stoch,
         source_ma_state,
         source_trigger,
         copied,
         day_count,
         valid_q_day_count,
         point,
         pair_features[symbol_id]
      ))
      {
         reason_code = "qstate_features_failed_" + canonical + "_" + pair_features[symbol_id].reason_code;
         return false;
      }

      if(portfolio_asof <= 0)
         portfolio_asof = pair_features[symbol_id].source_m1_time;
      else if(pair_features[symbol_id].source_m1_time != portfolio_asof)
      {
         reason_code = "local_qstate_mixed_source_m1";
         return false;
      }

      int base_ccy = -1;
      int quote_ccy = -1;
      LimniQStateBaseQuote(canonical, base_ccy, quote_ccy);
      if(base_ccy < 0 || quote_ccy < 0)
      {
         reason_code = "local_qstate_base_quote_failed_" + canonical;
         return false;
      }

      ccy_sums[base_ccy] += pair_features[symbol_id].pair_q_score;
      ccy_counts[base_ccy]++;
      ccy_sums[quote_ccy] -= pair_features[symbol_id].pair_q_score;
      ccy_counts[quote_ccy]++;
   }

   if(portfolio_asof <= 0)
   {
      reason_code = "local_qstate_asof_missing";
      return false;
   }

   for(int c = 0; c < LIMNI_QSTATE_CCY_COUNT; c++)
   {
      if(ccy_counts[c] > 0)
         ccy_scores[c] = ccy_sums[c] / (double)ccy_counts[c];
   }

   ulong portfolio_hash = StateMapPortfolioQStateHash(pair_features, ccy_scores);
   bool chart_snapshot_found = false;
   for(int symbol_id = 0; symbol_id < LIMNI_QSTATE_SYMBOL_COUNT; symbol_id++)
   {
      string canonical = LimniQStateCanonicalSymbol(symbol_id);
      string broker_symbol = LimniQStateResolveBrokerSymbol(canonical);
      int base_ccy = -1;
      int quote_ccy = -1;
      LimniQStateBaseQuote(canonical, base_ccy, quote_ccy);
      if(base_ccy < 0 || quote_ccy < 0)
      {
         reason_code = "qstate_base_quote_failed_" + canonical;
         return false;
      }

      LimniQStateDirection decision;
      LimniQStateFinalizeDirection(
         pair_features[symbol_id],
         ccy_scores[base_ccy],
         ccy_scores[quote_ccy],
         decision
      );

      LimniVisualQStateSnapshot out_snapshot;
      LimniVisualResetQStateSnapshot(out_snapshot);
      out_snapshot.valid = decision.valid;
      out_snapshot.symbol = broker_symbol;
      out_snapshot.canonical = canonical;
      out_snapshot.formula_id = decision.formula_id;
      out_snapshot.formula_hash = decision.formula_hash;
      out_snapshot.portfolio_asof_m1_time = portfolio_asof;
      out_snapshot.portfolio_valid_pair_count = LIMNI_QSTATE_SYMBOL_COUNT;
      out_snapshot.portfolio_snapshot_hash = portfolio_hash;
      out_snapshot.source_m1_time = decision.source_m1_time;
      out_snapshot.state = decision.state;
      out_snapshot.trade_direction = decision.trade_direction;
      out_snapshot.market_mode = decision.market_mode;
      out_snapshot.pair_q_score = decision.pair_q_score;
      out_snapshot.base_currency_score = decision.base_currency_score;
      out_snapshot.quote_currency_score = decision.quote_currency_score;
      out_snapshot.pair_direction_score = decision.pair_direction_score;
      out_snapshot.confidence = decision.confidence;
      out_snapshot.reason_code = decision.reason_code;
      out_snapshot.detail = "formula_id=" + decision.formula_id +
         "|formula_hash=" + (string)decision.formula_hash +
         "|portfolio_asof_m1_time=" + LimniVisualStamp(portfolio_asof) +
         "|portfolio_valid_pair_count=" + IntegerToString(LIMNI_QSTATE_SYMBOL_COUNT) +
         "|portfolio_snapshot_hash=" + (string)portfolio_hash +
         "|source_m1_time=" + LimniVisualStamp(decision.source_m1_time) +
         "|state=" + IntegerToString(decision.state) +
         "|reason_code=" + decision.reason_code +
         "|pair_q_score=" + DoubleToString(decision.pair_q_score, 6) +
         "|base_currency_score=" + DoubleToString(decision.base_currency_score, 6) +
         "|quote_currency_score=" + DoubleToString(decision.quote_currency_score, 6) +
         "|pair_direction_score=" + DoubleToString(decision.pair_direction_score, 6) +
         "|confidence=" + DoubleToString(decision.confidence, 6);

      string qstate_write_reason = "";
      if(!LimniVisualWriteQStateSnapshot(out_snapshot, qstate_write_reason))
      {
         reason_code = "qstate_write_failed_" + canonical + "_" + qstate_write_reason;
         return false;
      }

      if(symbol_id == chart_symbol_id)
      {
         snapshot = out_snapshot;
         chart_snapshot_found = true;
      }
   }

   if(!chart_snapshot_found || !snapshot.valid)
   {
      reason_code = !chart_snapshot_found ? "chart_qstate_snapshot_missing" : "chart_qstate_snapshot_invalid";
      return false;
   }

   reason_code = "qstate_snapshot_ready";
   return true;
}

int StateMapPanelHeight()
{
   return g_panel_minimized ? STATE_MAP_PANEL_MINIMIZED_HEIGHT : STATE_MAP_PANEL_HEIGHT;
}

int StateMapDefaultPanelX()
{
   return StateMapPanelLeft();
}

int StateMapDefaultPanelY()
{
   return STATE_MAP_PANEL_TOP;
}

void StateMapClampPanelPosition()
{
   int chart_width = (int)ChartGetInteger(0, CHART_WIDTH_IN_PIXELS, 0);
   int chart_height = (int)ChartGetInteger(0, CHART_HEIGHT_IN_PIXELS, 0);
   if(chart_width <= 0)
      chart_width = STATE_MAP_PANEL_WIDTH + STATE_MAP_PANEL_RIGHT + 24;
   if(chart_height <= 0)
      chart_height = STATE_MAP_PANEL_HEIGHT + STATE_MAP_PANEL_TOP + 24;

   int max_x = MathMax(8, chart_width - STATE_MAP_PANEL_WIDTH - 8);
   int max_y = MathMax(8, chart_height - StateMapPanelHeight() - 8);
   g_panel_x = MathMax(8, MathMin(max_x, g_panel_x));
   g_panel_y = MathMax(8, MathMin(max_y, g_panel_y));
}

void StateMapEnsurePanelPosition()
{
   if(g_panel_x < 0 || g_panel_y < 0 || !g_panel_user_moved)
   {
      g_panel_x = StateMapDefaultPanelX();
      g_panel_y = StateMapDefaultPanelY();
   }
   StateMapClampPanelPosition();
}

int StateMapPanelX(const int local_x)
{
   StateMapEnsurePanelPosition();
   return g_panel_x + local_x;
}

int StateMapPanelY(const int local_y)
{
   StateMapEnsurePanelPosition();
   return g_panel_y + local_y;
}

void StateMapDrawRect(
   const string name,
   const int x,
   const int y,
   const int width,
   const int height,
   const color fill,
   const color border,
   const int z_order,
   const bool selectable = false
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
   ObjectSetInteger(0, name, OBJPROP_SELECTABLE, selectable);
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
   const string font_name = "Segoe UI",
   const bool selectable = false
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
   ObjectSetInteger(0, name, OBJPROP_SELECTABLE, selectable);
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
   const int copied,
   const int valid_q_day_count
)
{
   if(!StateMapCreateDialog())
      return;

   StateMapEnsurePanelPosition();
   g_panel_latest_anchor = latest_anchor;
   g_panel_latest_trend_state = latest_trend_state;
   g_panel_latest_stoch = latest_stoch;
   g_panel_latest_copied = copied;
   g_panel_latest_valid_q_day_count = valid_q_day_count;

   string stoch_value = latest_stoch == EMPTY_VALUE ? "n/a" : DoubleToString(latest_stoch, 1);
   string anchor_value = latest_anchor == EMPTY_VALUE ? "n/a" : DoubleToString(latest_anchor, _Digits);
   string bars_value = IntegerToString(copied);
   string q_days_value = IntegerToString(valid_q_day_count);
   string reason_value = StateMapReasonLabel(g_qstate_reason);
   string m1_label = g_qstate_asof > 0 ? StateMapTimeLabel(g_qstate_asof) : StateMapTimeLabel(g_stack_latest_closed_m1);
   string score_value = StateMapPanelScoreLabel();
   string confidence_value = StateMapPanelConfidenceLabel();
   string trend_value = StateMapTrendLabel(latest_trend_state);
   string state_value = StateMapPanelStateLabel();
   string status_value = StateMapPanelStatusLabel();
   string center_detail = ShowCenterLine ? "center line on" : "center line off";
   string stoch_detail = StateMapStochZoneLabel(latest_stoch);

   string signature =
      IntegerToString(g_panel_x) + "|" +
      IntegerToString(g_panel_y) + "|" +
      (g_panel_minimized ? "min" : "full") + "|" +
      state_value + "|" +
      status_value + "|" +
      reason_value + "|" +
      IntegerToString((int)g_qstate_asof) + "|" +
      DoubleToString(g_qstate_score, 4) + "|" +
      DoubleToString(g_qstate_confidence, 4) + "|" +
      IntegerToString(latest_trend_state) + "|" +
      stoch_value + "|" +
      anchor_value + "|" +
      bars_value + "|" +
      q_days_value + "|" +
      center_detail + "|" +
      stoch_detail;

   if(signature == g_panel_signature)
      return;

   StateMapDrawRect(STATE_MAP_PANEL_PREFIX + "Body", g_panel_x, g_panel_y, STATE_MAP_PANEL_WIDTH, StateMapPanelHeight(), STATE_MAP_PANEL_BG, STATE_MAP_PANEL_BORDER, 30);
   StateMapDrawRect(STATE_MAP_PANEL_PREFIX + "Header", g_panel_x, g_panel_y, STATE_MAP_PANEL_WIDTH, STATE_MAP_HEADER_HEIGHT, g_qstate_color, g_qstate_color, 42, true);
   StateMapDrawText(STATE_MAP_PANEL_PREFIX + "Title", "LIMNI STATE MAP", g_panel_x + 18, g_panel_y + 10, STATE_MAP_TITLE_COLOR, 8, 44, "Segoe UI Semibold", true);
   StateMapDrawText(STATE_MAP_PANEL_PREFIX + "State", state_value, g_panel_x + 18, g_panel_y + 32, STATE_MAP_BADGE_TEXT_COLOR, StringLen(state_value) > 11 ? 15 : 18, 44, "Segoe UI Semibold", true);
   StateMapDrawButton(STATE_MAP_PANEL_PREFIX + "Minimize", g_panel_minimized ? "+" : "-", g_panel_x + STATE_MAP_PANEL_WIDTH - 42, g_panel_y + 18, 26, 26, C'17,22,31', STATE_MAP_TEXT_COLOR, 46);

   if(g_panel_minimized)
   {
      ObjectSetString(0, STATE_MAP_PANEL_PREFIX + "Minimize", OBJPROP_TEXT, "+");
      StateMapDeletePanelData();
      g_panel_signature = signature;
      return;
   }

   ObjectSetString(0, STATE_MAP_PANEL_PREFIX + "Minimize", OBJPROP_TEXT, "-");

   int left_x = STATE_MAP_PANEL_PAD;
   int right_x = STATE_MAP_PANEL_PAD + STATE_MAP_BLOCK_WIDTH + STATE_MAP_BLOCK_GAP;
   int row_1 = STATE_MAP_HEADER_HEIGHT + STATE_MAP_PANEL_PAD;
   int row_2 = row_1 + STATE_MAP_BLOCK_HEIGHT + STATE_MAP_BLOCK_GAP;
   int row_3 = row_2 + STATE_MAP_BLOCK_HEIGHT + STATE_MAP_BLOCK_GAP;
   int row_4 = row_3 + STATE_MAP_BLOCK_HEIGHT + STATE_MAP_BLOCK_GAP;

   StateMapDrawPanelBlock(
      "Signal",
      "SIGNAL",
      state_value,
      status_value,
      left_x,
      row_1,
      STATE_MAP_BLOCK_WIDTH,
      STATE_MAP_BLOCK_HEIGHT,
      g_qstate_color
   );
   StateMapDrawPanelBlock(
      "AsOf",
      "AS-OF",
      m1_label,
      "closed M1",
      right_x,
      row_1,
      STATE_MAP_BLOCK_WIDTH,
      STATE_MAP_BLOCK_HEIGHT,
      STATE_MAP_NEUTRAL_COLOR
   );
   StateMapDrawPanelBlock(
      "Score",
      "SCORE",
      score_value,
      "direction",
      left_x,
      row_2,
      STATE_MAP_BLOCK_WIDTH,
      STATE_MAP_BLOCK_HEIGHT,
      StateMapHasQStateSnapshot() ? StateMapSignedValueColor(g_qstate_score) : STATE_MAP_NEUTRAL_COLOR
   );
   StateMapDrawPanelBlock(
      "Confidence",
      "CONFIDENCE",
      confidence_value,
      "q-state",
      right_x,
      row_2,
      STATE_MAP_BLOCK_WIDTH,
      STATE_MAP_BLOCK_HEIGHT,
      STATE_MAP_NEUTRAL_COLOR
   );
   StateMapDrawPanelBlock(
      "Trend",
      "TREND",
      trend_value,
      center_detail,
      left_x,
      row_3,
      STATE_MAP_BLOCK_WIDTH,
      STATE_MAP_BLOCK_HEIGHT,
      StateMapTrendColor(latest_trend_state)
   );
   StateMapDrawPanelBlock(
      "Stochastic",
      "STOCHASTIC",
      stoch_value,
      stoch_detail,
      right_x,
      row_3,
      STATE_MAP_BLOCK_WIDTH,
      STATE_MAP_BLOCK_HEIGHT,
      STATE_MAP_STOCH_LINE
   );
   StateMapDrawPanelBlock(
      "Anchor",
      "ANCHOR",
      anchor_value,
      "center price",
      left_x,
      row_4,
      STATE_MAP_BLOCK_WIDTH,
      STATE_MAP_BLOCK_HEIGHT,
      STATE_MAP_STOCH_LINE
   );
   StateMapDrawPanelBlock(
      "Bars",
      "BARS",
      bars_value,
      "q-days " + q_days_value,
      right_x,
      row_4,
      STATE_MAP_BLOCK_WIDTH,
      STATE_MAP_BLOCK_HEIGHT,
      STATE_MAP_STRESS_COLOR
   );

   g_panel_signature = signature;
}

bool StateMapRefreshQState()
{
   datetime latest_closed_m1 = StateMapLatestClosedM1();
   LimniVisualQStateSnapshot snapshot;
   string reason = "";
   bool snapshot_ok = LimniVisualReadQStateSnapshot(_Symbol, snapshot, reason);
   if(snapshot_ok && snapshot.valid && snapshot.portfolio_asof_m1_time >= latest_closed_m1)
   {
      g_qstate_label = LimniQStateDirectionLabel(snapshot.trade_direction);
      g_qstate_color = StateMapQStateColor(snapshot.state, snapshot.trade_direction);
      g_qstate_reason = snapshot.reason_code;
      g_qstate_asof = snapshot.portfolio_asof_m1_time;
      g_qstate_score = snapshot.pair_direction_score;
      g_qstate_confidence = snapshot.confidence;
      g_qstate_details = snapshot.detail;
      return true;
   }

   string local_reason = "";
   if(!StateMapBuildLocalQStateSnapshot(snapshot, local_reason))
   {
      StateMapSetQStateFailure(
         local_reason == "" ? (reason == "" ? "qstate_unavailable" : reason) : local_reason,
         "service snapshot unavailable and local all-28 q-state fallback failed"
      );
      return false;
   }

   string write_reason = "";
   LimniVisualWriteQStateSnapshot(snapshot, write_reason);

   g_qstate_label = LimniQStateDirectionLabel(snapshot.trade_direction);
   g_qstate_color = StateMapQStateColor(snapshot.state, snapshot.trade_direction);
   g_qstate_reason = snapshot.reason_code;
   g_qstate_asof = snapshot.portfolio_asof_m1_time;
   g_qstate_score = snapshot.pair_direction_score;
   g_qstate_confidence = snapshot.confidence;
   g_qstate_details = snapshot.detail;
   return true;
}

void StateMapRenderPanel(
   const double latest_anchor,
   const int latest_trend_state,
   const double latest_stoch,
   const int copied,
   const int valid_q_day_count
)
{
   StateMapUpdatePanel(latest_anchor, latest_trend_state, latest_stoch, copied, valid_q_day_count);
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

bool StateMapPanelDragOffset(const string name, int &local_x, int &local_y)
{
   local_x = 0;
   local_y = 0;
   if(name == STATE_MAP_PANEL_PREFIX + "Header")
      return true;
   if(name == STATE_MAP_PANEL_PREFIX + "Title")
   {
      local_x = 18;
      local_y = 10;
      return true;
   }
   if(name == STATE_MAP_PANEL_PREFIX + "State")
   {
      local_x = 18;
      local_y = 32;
      return true;
   }
   return false;
}

void StateMapRefreshPanelFromStored()
{
   g_panel_signature = "";
   StateMapUpdatePanel(
      g_panel_latest_anchor,
      g_panel_latest_trend_state,
      g_panel_latest_stoch,
      g_panel_latest_copied,
      g_panel_latest_valid_q_day_count
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
      StateMapClampPanelPosition();
      StateMapRefreshPanelFromStored();
      return;
   }

   if(id == CHARTEVENT_OBJECT_DRAG)
   {
      int local_x = 0;
      int local_y = 0;
      if(!StateMapPanelDragOffset(sparam, local_x, local_y))
         return;

      g_panel_x = (int)ObjectGetInteger(0, sparam, OBJPROP_XDISTANCE) - local_x;
      g_panel_y = (int)ObjectGetInteger(0, sparam, OBJPROP_YDISTANCE) - local_y;
      g_panel_user_moved = true;
      StateMapClampPanelPosition();
      StateMapRefreshPanelFromStored();
      return;
   }

   if(id == CHARTEVENT_CHART_CHANGE)
   {
      if(!g_panel_user_moved)
      {
         g_panel_x = -1;
         g_panel_y = -1;
      }
      else
         StateMapClampPanelPosition();
      StateMapRefreshPanelFromStored();
   }
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
   {
      g_panel_signature = "";
   }

   bool chart_series = ArrayGetAsSeries(time);
   int limit = LimniChangedBarLimit(rates_total, prev_calculated, STATE_MAP_MAX_INITIAL_PROJECT_BARS);
   if(ShowCenterLine)
   {
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
