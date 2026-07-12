//+------------------------------------------------------------------+
//|                                      QStateDirection.mq5         |
//|        Gate 99Y closed-M1 q-state direction viewer               |
//+------------------------------------------------------------------+
#property copyright "LIMNI LTD"
#property version   "1.10"
#property indicator_chart_window
#property indicator_buffers 1
#property indicator_plots 1

#property indicator_label1 "Q State Direction"
#property indicator_type1 DRAW_NONE

#include "..\\Include\\LimniQStateCore.mqh"

input bool ShowLabels = true;
input bool ShowBackground = false;
input int LabelFontSize = 32;
input int LabelRightPadding = 24;
input int LabelTopPadding = 28;
input color LongColor = clrLimeGreen;
input color ShortColor = clrTomato;
input color NoTradeColor = clrSilver;
input color StressColor = clrOrange;
input color BackgroundColor = clrBlack;
input bool ShowDetails = false;
input bool ShowDebugComment = false;

double DummyBuffer[];

const string QSTATE_LABEL_NAME = "Limni_QStateDirection_Label";
const string QSTATE_BACKGROUND_NAME = "Limni_QStateDirection_Background";

datetime g_last_refresh_bar = 0;
string g_last_text = "NO TRADE";
color g_last_color = clrSilver;
string g_last_details = "";

void QStateDeleteObjects()
{
   ObjectDelete(0, QSTATE_LABEL_NAME);
   ObjectDelete(0, QSTATE_BACKGROUND_NAME);
}

void QStateEnsureBackground()
{
   if(!ShowBackground)
   {
      ObjectDelete(0, QSTATE_BACKGROUND_NAME);
      return;
   }

   if(ObjectFind(0, QSTATE_BACKGROUND_NAME) < 0)
      ObjectCreate(0, QSTATE_BACKGROUND_NAME, OBJ_RECTANGLE_LABEL, 0, 0, 0);

   int height = ShowDetails ? 138 : 62;
   ObjectSetInteger(0, QSTATE_BACKGROUND_NAME, OBJPROP_CORNER, CORNER_RIGHT_UPPER);
   ObjectSetInteger(0, QSTATE_BACKGROUND_NAME, OBJPROP_ANCHOR, ANCHOR_RIGHT_UPPER);
   ObjectSetInteger(0, QSTATE_BACKGROUND_NAME, OBJPROP_XDISTANCE, MathMax(0, LabelRightPadding - 10));
   ObjectSetInteger(0, QSTATE_BACKGROUND_NAME, OBJPROP_YDISTANCE, MathMax(0, LabelTopPadding - 8));
   ObjectSetInteger(0, QSTATE_BACKGROUND_NAME, OBJPROP_XSIZE, 330);
   ObjectSetInteger(0, QSTATE_BACKGROUND_NAME, OBJPROP_YSIZE, height);
   ObjectSetInteger(0, QSTATE_BACKGROUND_NAME, OBJPROP_BGCOLOR, BackgroundColor);
   ObjectSetInteger(0, QSTATE_BACKGROUND_NAME, OBJPROP_COLOR, BackgroundColor);
   ObjectSetInteger(0, QSTATE_BACKGROUND_NAME, OBJPROP_BACK, false);
   ObjectSetInteger(0, QSTATE_BACKGROUND_NAME, OBJPROP_SELECTABLE, false);
   ObjectSetInteger(0, QSTATE_BACKGROUND_NAME, OBJPROP_HIDDEN, true);
}

void QStateEnsureLabel()
{
   if(!ShowLabels)
   {
      QStateDeleteObjects();
      return;
   }

   QStateEnsureBackground();

   if(ObjectFind(0, QSTATE_LABEL_NAME) < 0)
      ObjectCreate(0, QSTATE_LABEL_NAME, OBJ_LABEL, 0, 0, 0);

   ObjectSetInteger(0, QSTATE_LABEL_NAME, OBJPROP_CORNER, CORNER_RIGHT_UPPER);
   ObjectSetInteger(0, QSTATE_LABEL_NAME, OBJPROP_ANCHOR, ANCHOR_RIGHT_UPPER);
   ObjectSetInteger(0, QSTATE_LABEL_NAME, OBJPROP_XDISTANCE, LabelRightPadding);
   ObjectSetInteger(0, QSTATE_LABEL_NAME, OBJPROP_YDISTANCE, LabelTopPadding);
   ObjectSetInteger(0, QSTATE_LABEL_NAME, OBJPROP_FONTSIZE, LabelFontSize);
   ObjectSetInteger(0, QSTATE_LABEL_NAME, OBJPROP_SELECTABLE, false);
   ObjectSetInteger(0, QSTATE_LABEL_NAME, OBJPROP_HIDDEN, true);
   ObjectSetString(0, QSTATE_LABEL_NAME, OBJPROP_FONT, "Arial Black");
}

void QStateRenderLabel(const string text, const color text_color)
{
   if(!ShowLabels)
      return;

   QStateEnsureLabel();
   ObjectSetString(0, QSTATE_LABEL_NAME, OBJPROP_TEXT, text);
   ObjectSetInteger(0, QSTATE_LABEL_NAME, OBJPROP_COLOR, text_color);
}

color QStateColorForDecision(const LimniQStateDirection &decision)
{
   if(decision.state == LIMNI_QSTATE_PAIR_STATE_STRESS)
      return StressColor;
   if(decision.trade_direction == LIMNI_QSTATE_SIDE_LONG)
      return LongColor;
   if(decision.trade_direction == LIMNI_QSTATE_SIDE_SHORT)
      return ShortColor;
   return NoTradeColor;
}

bool QStateRefreshDecision()
{
   bool available[LIMNI_QSTATE_SYMBOL_COUNT];
   LimniQStatePairFeatures pair_features[LIMNI_QSTATE_SYMBOL_COUNT];
   double ccy_sums[LIMNI_QSTATE_CCY_COUNT];
   int ccy_counts[LIMNI_QSTATE_CCY_COUNT];
   double ccy_scores[LIMNI_QSTATE_CCY_COUNT];
   int valid_pairs = 0;

   for(int i = 0; i < LIMNI_QSTATE_SYMBOL_COUNT; i++)
   {
      available[i] = false;
      LimniQStateResetPairFeatures(pair_features[i]);
   }

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
         continue;

      int base_ccy = -1;
      int quote_ccy = -1;
      LimniQStateBaseQuote(canonical, base_ccy, quote_ccy);
      if(base_ccy < 0 || quote_ccy < 0)
         continue;

      available[symbol_id] = true;
      valid_pairs++;
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
   if(chart_symbol_id < 0 || !available[chart_symbol_id])
   {
      g_last_text = "NO TRADE";
      g_last_color = NoTradeColor;
      g_last_details = "reason=no_valid_qstate|formula_id=" + LimniQStateFormulaId() +
         "|formula_hash=" + (string)LimniQStateFormulaHash() +
         "|valid_pairs=" + IntegerToString(valid_pairs);
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

   g_last_text = LimniQStateDirectionLabel(decision.trade_direction);
   g_last_color = QStateColorForDecision(decision);
   g_last_details = "formula_id=" + decision.formula_id +
      "|formula_hash=" + (string)decision.formula_hash +
      "|source_m1_time=" + TimeToString(decision.source_m1_time, TIME_DATE | TIME_SECONDS) +
      "|symbol=" + _Symbol +
      "|state=" + IntegerToString(decision.state) +
      "|reason_code=" + decision.reason_code +
      "|pair_q_score=" + DoubleToString(decision.pair_q_score, 6) +
      "|base_currency_score=" + DoubleToString(decision.base_currency_score, 6) +
      "|quote_currency_score=" + DoubleToString(decision.quote_currency_score, 6) +
      "|pair_direction_score=" + DoubleToString(decision.pair_direction_score, 6) +
      "|confidence=" + DoubleToString(decision.confidence, 6) +
      "|valid_pairs=" + IntegerToString(valid_pairs);
   return decision.valid;
}

int OnInit()
{
   SetIndexBuffer(0, DummyBuffer, INDICATOR_DATA);
   PlotIndexSetDouble(0, PLOT_EMPTY_VALUE, EMPTY_VALUE);
   IndicatorSetString(INDICATOR_SHORTNAME, "Q State Direction");
   IndicatorSetInteger(INDICATOR_DIGITS, 0);
   QStateRenderLabel("NO TRADE", NoTradeColor);
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
   QStateDeleteObjects();
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
      LimniClearDoubleBuffer(DummyBuffer, rates_total);

   datetime latest_closed_m1 = iTime(_Symbol, PERIOD_M1, 1);
   if(latest_closed_m1 <= 0)
      latest_closed_m1 = TimeCurrent();

   if(prev_calculated <= 0 || latest_closed_m1 != g_last_refresh_bar)
   {
      QStateRefreshDecision();
      g_last_refresh_bar = latest_closed_m1;
   }

   string label_text = ShowDetails ? g_last_text + "\n" + g_last_details : g_last_text;
   QStateRenderLabel(label_text, g_last_color);

   if(ShowDebugComment)
   {
      Comment(
         "Q State Direction\n",
         g_last_text, "\n",
         g_last_details
      );
   }

   return rates_total;
}
