//+------------------------------------------------------------------+
//|                                             StateMap.mq5         |
//|                   Limni State Map shared LRMG/q viewer           |
//+------------------------------------------------------------------+
#property copyright "LIMNI LTD"
#property version   "1.00"
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
const string STATE_MAP_PANEL_NAME = "Limni_StateMap_Panel";
const string STATE_MAP_BACKGROUND_NAME = "Limni_StateMap_Background";

input bool ShowPriceAnchor = true;
input bool ShowTrendState = true;
input bool ShowStochastic = true;
input bool ShowQStateDirection = true;
input bool ShowQStateDetails = true;
input bool ShowPanel = true;
input bool ShowBackground = false;
input int PanelFontSize = 11;
input int PanelRightPadding = 18;
input int PanelTopPadding = 24;
input color LongColor = clrLimeGreen;
input color ShortColor = clrTomato;
input color NeutralColor = clrSilver;
input color StressColor = clrOrange;
input color BackgroundColor = clrBlack;
input bool ShowDebugComment = false;

double PriceAnchorBuffer[];
double StateAnchorBuffer[];
double StateColorBuffer[];

datetime g_last_qstate_refresh_bar = 0;
string g_qstate_label = "NO TRADE";
string g_qstate_details = "";
string g_qstate_reason = "not_refreshed";
datetime g_qstate_asof = 0;
double g_qstate_score = 0.0;
double g_qstate_confidence = 0.0;
color g_qstate_color = clrSilver;

void StateMapSetQStateFailure(const string reason, const string details)
{
   g_qstate_label = "FAIL CLOSED";
   g_qstate_color = NeutralColor;
   g_qstate_reason = reason;
   g_qstate_asof = 0;
   g_qstate_score = 0.0;
   g_qstate_confidence = 0.0;
   g_qstate_details = details;
}

void StateMapDeleteObjects()
{
   ObjectDelete(0, STATE_MAP_PANEL_NAME);
   ObjectDelete(0, STATE_MAP_BACKGROUND_NAME);
}

void StateMapEnsureBackground()
{
   if(!ShowBackground || !ShowPanel)
   {
      ObjectDelete(0, STATE_MAP_BACKGROUND_NAME);
      return;
   }

   if(ObjectFind(0, STATE_MAP_BACKGROUND_NAME) < 0)
      ObjectCreate(0, STATE_MAP_BACKGROUND_NAME, OBJ_RECTANGLE_LABEL, 0, 0, 0);

   ObjectSetInteger(0, STATE_MAP_BACKGROUND_NAME, OBJPROP_CORNER, CORNER_RIGHT_UPPER);
   ObjectSetInteger(0, STATE_MAP_BACKGROUND_NAME, OBJPROP_ANCHOR, ANCHOR_RIGHT_UPPER);
   ObjectSetInteger(0, STATE_MAP_BACKGROUND_NAME, OBJPROP_XDISTANCE, MathMax(0, PanelRightPadding - 10));
   ObjectSetInteger(0, STATE_MAP_BACKGROUND_NAME, OBJPROP_YDISTANCE, MathMax(0, PanelTopPadding - 8));
   ObjectSetInteger(0, STATE_MAP_BACKGROUND_NAME, OBJPROP_XSIZE, 420);
   ObjectSetInteger(0, STATE_MAP_BACKGROUND_NAME, OBJPROP_YSIZE, 146);
   ObjectSetInteger(0, STATE_MAP_BACKGROUND_NAME, OBJPROP_BGCOLOR, BackgroundColor);
   ObjectSetInteger(0, STATE_MAP_BACKGROUND_NAME, OBJPROP_COLOR, BackgroundColor);
   ObjectSetInteger(0, STATE_MAP_BACKGROUND_NAME, OBJPROP_BACK, false);
   ObjectSetInteger(0, STATE_MAP_BACKGROUND_NAME, OBJPROP_SELECTABLE, false);
   ObjectSetInteger(0, STATE_MAP_BACKGROUND_NAME, OBJPROP_HIDDEN, true);
}

void StateMapEnsurePanel()
{
   if(!ShowPanel)
   {
      StateMapDeleteObjects();
      return;
   }

   StateMapEnsureBackground();

   if(ObjectFind(0, STATE_MAP_PANEL_NAME) < 0)
      ObjectCreate(0, STATE_MAP_PANEL_NAME, OBJ_LABEL, 0, 0, 0);

   ObjectSetInteger(0, STATE_MAP_PANEL_NAME, OBJPROP_CORNER, CORNER_RIGHT_UPPER);
   ObjectSetInteger(0, STATE_MAP_PANEL_NAME, OBJPROP_ANCHOR, ANCHOR_RIGHT_UPPER);
   ObjectSetInteger(0, STATE_MAP_PANEL_NAME, OBJPROP_XDISTANCE, PanelRightPadding);
   ObjectSetInteger(0, STATE_MAP_PANEL_NAME, OBJPROP_YDISTANCE, PanelTopPadding);
   ObjectSetInteger(0, STATE_MAP_PANEL_NAME, OBJPROP_FONTSIZE, PanelFontSize);
   ObjectSetInteger(0, STATE_MAP_PANEL_NAME, OBJPROP_SELECTABLE, false);
   ObjectSetInteger(0, STATE_MAP_PANEL_NAME, OBJPROP_HIDDEN, true);
   ObjectSetString(0, STATE_MAP_PANEL_NAME, OBJPROP_FONT, "Consolas");
}

string StateMapTrendLabel(const int state)
{
   if(state > 0)
      return "trend_up";
   if(state < 0)
      return "trend_down";
   return "neutral";
}

color StateMapQStateColor(const LimniQStateDirection &decision)
{
   if(decision.state == LIMNI_QSTATE_PAIR_STATE_STRESS)
      return StressColor;
   if(decision.trade_direction == LIMNI_QSTATE_SIDE_LONG)
      return LongColor;
   if(decision.trade_direction == LIMNI_QSTATE_SIDE_SHORT)
      return ShortColor;
   return NeutralColor;
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
   const int day_count,
   const int valid_q_day_count
)
{
   if(!ShowPanel)
      return;

   StateMapEnsurePanel();

   string text = "Limni State Map";
   if(ShowQStateDirection)
   {
      text += "\nQState: " + g_qstate_label + " | " + g_qstate_reason;
      if(ShowQStateDetails)
      {
         text += "\nScore: " + DoubleToString(g_qstate_score, 3) +
            " Conf: " + DoubleToString(g_qstate_confidence, 2);
         if(g_qstate_asof > 0)
            text += " AsOf: " + TimeToString(g_qstate_asof, TIME_MINUTES);
      }
   }
   if(ShowTrendState)
      text += "\nTrend: " + StateMapTrendLabel(latest_trend_state);
   if(ShowStochastic)
      text += "\nStoch: " + (latest_stoch == EMPTY_VALUE ? "n/a" : DoubleToString(latest_stoch, 2));
   if(ShowPriceAnchor)
      text += "\nAnchor: " + (latest_anchor == EMPTY_VALUE ? "n/a" : DoubleToString(latest_anchor, _Digits));
   text += "\nM1 bars: " + IntegerToString(copied) +
      " days: " + IntegerToString(day_count) +
      " q-days: " + IntegerToString(valid_q_day_count);

   ObjectSetString(0, STATE_MAP_PANEL_NAME, OBJPROP_TEXT, text);
   ObjectSetInteger(0, STATE_MAP_PANEL_NAME, OBJPROP_COLOR, ShowQStateDirection ? g_qstate_color : NeutralColor);
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
   StateMapRenderPanel(EMPTY_VALUE, 0, EMPTY_VALUE, 0, 0, 0);
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
   StateMapDeleteObjects();
   if(ShowDebugComment)
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

   if(ShowPriceAnchor)
      LimniProjectDoubleToChart(time, rates_total, chart_series, source_times, source_line, next_price_anchor);

   if(ShowTrendState)
   {
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
   }

   LimniCopyDoubleBuffer(next_price_anchor, PriceAnchorBuffer, rates_total);
   LimniCopyDoubleBuffer(next_state_anchor, StateAnchorBuffer, rates_total);
   LimniCopyDoubleBuffer(next_state_color, StateColorBuffer, rates_total);

   datetime latest_closed_m1 = iTime(_Symbol, PERIOD_M1, 1);
   if(latest_closed_m1 <= 0)
      latest_closed_m1 = TimeCurrent();
   if(ShowQStateDirection && (prev_calculated <= 0 || latest_closed_m1 != g_last_qstate_refresh_bar))
   {
      StateMapRefreshQState();
      g_last_qstate_refresh_bar = latest_closed_m1;
   }

   int latest_source_index = ArraySize(source_times) - 1;
   double latest_anchor = latest_source_index >= 0 ? source_line[latest_source_index] : EMPTY_VALUE;
   int latest_trend_state = latest_source_index >= 0 ? source_ma_state[latest_source_index] : 0;
   double latest_stoch = latest_source_index >= 0 ? source_stoch[latest_source_index] : EMPTY_VALUE;

   StateMapRenderPanel(
      latest_anchor,
      latest_trend_state,
      latest_stoch,
      copied,
      day_count,
      valid_q_day_count
   );

   if(ShowDebugComment)
   {
      Comment(
         "Limni State Map\n",
         "qstate: ", g_qstate_label, "\n",
         g_qstate_details, "\n",
         "source bars: ", IntegerToString(copied), "\n",
         "days: ", IntegerToString(day_count), " valid q days: ", IntegerToString(valid_q_day_count)
      );
   }

   return rates_total;
}
