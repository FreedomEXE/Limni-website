//+------------------------------------------------------------------+
//|                                      LimniLRMGStudyOverlay.mq5   |
//|                 Closed-brick median spine for LRMG custom charts |
//+------------------------------------------------------------------+
#property copyright "LIMNI LTD"
#property version   "1.00"
#property indicator_chart_window
#property indicator_buffers 1
#property indicator_plots 1

#property indicator_label1 "Closed-brick median spine"
#property indicator_type1 DRAW_LINE
#property indicator_color1 clrDeepSkyBlue
#property indicator_style1 STYLE_SOLID
#property indicator_width1 2

const int LRMG_MEDIAN_BRICK_WINDOW = 55;
double MedianBuffer[];

string PREFIX = "LIMNI_LRMG_OVERLAY_";

int IndexFromLogical(const int total, const bool series, const int logical_index)
{
   if(series)
      return total - 1 - logical_index;
   return logical_index;
}

double MedianClose(
   const double &close[],
   const int total,
   const bool series,
   const int start_logical,
   const int end_logical
)
{
   int count = end_logical - start_logical + 1;
   if(count <= 0)
      return EMPTY_VALUE;

   double values[];
   ArrayResize(values, count);
   for(int i = 0; i < count; i++)
   {
      int idx = IndexFromLogical(total, series, start_logical + i);
      values[i] = close[idx];
   }

   ArraySort(values);
   int mid = count / 2;
   if((count % 2) == 1)
      return values[mid];

   return (values[mid - 1] + values[mid]) / 2.0;
}

void DrawOverlayLabel()
{
   string name = PREFIX + "LABEL";
   if(ObjectFind(0, name) < 0)
      ObjectCreate(0, name, OBJ_LABEL, 0, 0, 0);

   ObjectSetInteger(0, name, OBJPROP_CORNER, CORNER_LEFT_UPPER);
   ObjectSetInteger(0, name, OBJPROP_XDISTANCE, 12);
   ObjectSetInteger(0, name, OBJPROP_YDISTANCE, 38);
   ObjectSetInteger(0, name, OBJPROP_COLOR, clrDeepSkyBlue);
   ObjectSetInteger(0, name, OBJPROP_FONTSIZE, 8);
   ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
   ObjectSetInteger(0, name, OBJPROP_HIDDEN, true);
   ObjectSetString(0, name, OBJPROP_TEXT, "cyan = closed-brick median spine; body height 1.00 = one LRMG Q");
}

int OnInit()
{
   SetIndexBuffer(0, MedianBuffer, INDICATOR_DATA);
   IndicatorSetString(INDICATOR_SHORTNAME, "LRMG Closed-Brick Median Spine");
   PlotIndexSetDouble(0, PLOT_EMPTY_VALUE, EMPTY_VALUE);
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
   for(int i = ObjectsTotal(0, 0, -1) - 1; i >= 0; i--)
   {
      string name = ObjectName(0, i, 0, -1);
      if(StringFind(name, PREFIX) == 0)
         ObjectDelete(0, name);
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
   if(rates_total <= 0)
      return rates_total;

   bool series = ArrayGetAsSeries(close);

   for(int logical = 0; logical < rates_total; logical++)
   {
      int idx = IndexFromLogical(rates_total, series, logical);
      int start = MathMax(0, logical - LRMG_MEDIAN_BRICK_WINDOW + 1);
      MedianBuffer[idx] = MedianClose(close, rates_total, series, start, logical);
   }

   DrawOverlayLabel();
   return rates_total;
}
