//+------------------------------------------------------------------+
//|                                               LimniHedge_V1.mq5 |
//|                                      Manifested by Freedom       |
//|                                                                  |
//|           Change of trend indicator form GFK to new MA developed |
//|            Paramater to decide if we wait for first trend change |
//|Paramaters for SL and TP (the same for the orders type 1 and 3)   |
//+------------------------------------------------------------------+
#property copyright "LIMNI LTD"
#property link      ""
#property description "LimniHedge V1 - Manifested by Freedom"
#property version   "1.00"
#property strict


enum MATypes // 3 types: Forex, Gold and DAX
{
   SMA=0,
   EMA=1,
   SMMA=2,
   LWMA=3,
};


enum MAPrices // 3 types: Forex, Gold and DAX
{
   Close_Price=0,
   Open_Price=1,
   Hight_Price=2,
   Low_Price=3,
   Median_Price=4,
   Typical_Price=5,
   Weighted_Price=6,
};



input string      T0 = "|--------< LimniHedge_V1 >--------|";
input string      T0a = "";
input string      T0b= "Trade Orders settings: ";
input bool        InpUse_Type1_Orders=true;
input bool        InpUse_Type3_Orders=true;
input double      Trade_Lots=0.01;
input double      Orders_TP_Pips=0.0;
input double      Orders_SL_Pips=0.0;

input int         MagicNumber=800;
input bool        WaitForFirstTrendChange=true;
input bool        Alerts_inOrders=true;


input string      T1="";
input string      T1a = "Trend Indicator settings: ";
input string      Indicator_Name ="David_MA_Color_V1f_Updated";
input int         MAPeriod=35;
input MATypes     MAType=LWMA;  //MA Type: 0 SMA, 1 EMA, 2 SMMA, 3 LWMA
input MAPrices    MAPrice=Close_Price; //MA Price: 0 Close, 1 Open, 2 High, 3 Low, 4 Med, 5 Typ, 6 Weight
input bool        UseRSI_Filter=true;
input int         RSIPeriod=9;
input int         RSIOverBought=63;
input int         RSIOverSold=37;

input string      T3="";
input string      T3a = "Trailing Stop settings: ";
input bool         Use_StopLoss=true;
input double       Trail_Start_Pips=20;
input double       Trail_Step_Pips=1;
input double       Trail_Stop_Pips=10;

input string      T4="";
input string      T4a = "Backtest speed settings: ";
input bool        TesterSkipPanel=true;
input bool        TesterCleanupOnNewBarOnly=true;
input bool        TesterTrailOnNewBarOnly=false;
input bool        TesterDisableOrderAlerts=true;
input bool        TesterSuppressInfoLogs=true;

bool Use_Type1_Orders=false;
bool Use_Type3_Orders=false;

int trendHandle=INVALID_HANDLE;




string name_EA="LimniHedge";
string version_EA="V1";

bool Limited_toDemoAccounts=false;
double Lots=0.0;
double TP_inPips=0.0;
double SL_inPips=0.0;
long ticket=0;
int digits_multiplier=10;
bool errors_in_init=false;
string TradeComment="";
bool is_tester_run=false;



string mensaje_TL="";
string mensaje_Ind="";
datetime mytime;

long current_chart_id;
int index_signal_lines=0;
string session_time_id="";


bool result_order_select=false;
string symbolperiod="";


long LastOrderTicket=0;


//--------------------------------------------------------
int inditrend0_dir=0; // 1 for up trend and -1 for down trend of bar 0
int inditrend1_dir=0; // 1 for up trend and -1 for down trend of bar 1
int inditrend2_dir=0; // 1 for up trend and -1 for down trend of bar 2
int inditrend3_dir=0; // 1 for up trend and -1 for down trend of bar 3
int inditrend4_dir=0; // 1 for up trend and -1 for down trend of bar 4

int old_trend_dir=0; // 1 for up trend and -1 for down trend
int current_trend_dir=0; // 1 for up trend and -1 for down trend
int trend_change=0; // 0 no change, 1 changed from down to up, -1 changed from up to down

int limitsize_arrays=1000;
int limitsize_arrays_tot=10000;

long total_orders_mat_type1[10000];  // tickets or all orders type 1
long current_orders_mat_type1[1000][4]; // [Ticket, type (-1 sell, 1 buy), Status, Reserved]
int num_orders_intype1=0;
double maximum_drawdown_type1=0;


long total_orders_mat_type3[10000];  // tickets or all orders type 3
long current_orders_mat_type3[1000][3]; // [Ticket, type (-1 sell, 1 buy), status]
int num_orders_intype3=0;
double maximum_drawdown_type3=0;

datetime lasttradetype1_time=0;
datetime lasttradetype3_time=0;


bool first_trend_change=false;
int num_run=0;

#define OP_BUY  0
#define OP_SELL 1
#define SELECT_BY_POS    0
#define SELECT_BY_TICKET 1
#define MODE_MINLOT      1
#define MODE_STOPLEVEL   2
#define MODE_LOTSTEP     3

struct SelectedOrderCompat
{
   bool     valid;
   bool     open;
   long     ticket;
   string   symbol;
   int      type;
   long     magic;
   double   volume;
   double   open_price;
   double   stop_loss;
   double   take_profit;
   double   profit;
   double   commission;
   double   swap;
   datetime close_time;
   string   comment;
};

SelectedOrderCompat selected_order;

void ResetSelectedOrderCompat()
{
   selected_order.valid=false;
   selected_order.open=false;
   selected_order.ticket=0;
   selected_order.symbol="";
   selected_order.type=-1;
   selected_order.magic=0;
   selected_order.volume=0.0;
   selected_order.open_price=0.0;
   selected_order.stop_loss=0.0;
   selected_order.take_profit=0.0;
   selected_order.profit=0.0;
   selected_order.commission=0.0;
   selected_order.swap=0.0;
   selected_order.close_time=0;
   selected_order.comment="";
}

ENUM_ORDER_TYPE_FILLING GetFillingMode(const string symbol)
{
   int filling=(int)SymbolInfoInteger(symbol,SYMBOL_FILLING_MODE);
   if((filling & SYMBOL_FILLING_FOK)==SYMBOL_FILLING_FOK) return(ORDER_FILLING_FOK);
   if((filling & SYMBOL_FILLING_IOC)==SYMBOL_FILLING_IOC) return(ORDER_FILLING_IOC);
   return(ORDER_FILLING_RETURN);
}

double NormalizePriceCompat(const string symbol,const double price)
{
   if(price<=0.0) return(0.0);
   int digits=(int)SymbolInfoInteger(symbol,SYMBOL_DIGITS);
   return(NormalizeDouble(price,digits));
}

double NormalizeVolumeCompat(const string symbol,const double volume)
{
   double minlot=SymbolInfoDouble(symbol,SYMBOL_VOLUME_MIN);
   double maxlot=SymbolInfoDouble(symbol,SYMBOL_VOLUME_MAX);
   double step=SymbolInfoDouble(symbol,SYMBOL_VOLUME_STEP);
   double result=volume;
   if(step>0.0) result=MathFloor((result/step)+0.0000001)*step;
   if(result<minlot) result=minlot;
   if(result>maxlot) result=maxlot;
   return(NormalizeDouble(result,2));
}

bool IsDemoCompat()
{
   return((ENUM_ACCOUNT_TRADE_MODE)AccountInfoInteger(ACCOUNT_TRADE_MODE)==ACCOUNT_TRADE_MODE_DEMO);
}

bool IsExpertEnabledCompat()
{
   return((bool)MQLInfoInteger(MQL_TRADE_ALLOWED) && (bool)TerminalInfoInteger(TERMINAL_TRADE_ALLOWED));
}

string AccountCurrencyCompat()
{
   return(AccountInfoString(ACCOUNT_CURRENCY));
}

double MarketInfoCompat(const string symbol,const int mode)
{
   if(mode==MODE_MINLOT)    return(SymbolInfoDouble(symbol,SYMBOL_VOLUME_MIN));
   if(mode==MODE_LOTSTEP)   return(SymbolInfoDouble(symbol,SYMBOL_VOLUME_STEP));
   if(mode==MODE_STOPLEVEL) return((double)SymbolInfoInteger(symbol,SYMBOL_TRADE_STOPS_LEVEL));
   return(0.0);
}

void RefreshRatesCompat()
{
   MqlTick tick;
   SymbolInfoTick(_Symbol,tick);
}

double BidCompat()
{
   MqlTick tick;
   SymbolInfoTick(_Symbol,tick);
   return(tick.bid);
}

double AskCompat()
{
   MqlTick tick;
   SymbolInfoTick(_Symbol,tick);
   return(tick.ask);
}

datetime BarTime(const int shift)
{
   datetime values[];
   ArraySetAsSeries(values,true);
   if(CopyTime(_Symbol,_Period,shift,1,values)==1) return(values[0]);
   return(0);
}

double BarOpen(const int shift)
{
   double values[];
   ArraySetAsSeries(values,true);
   if(CopyOpen(_Symbol,_Period,shift,1,values)==1) return(values[0]);
   return(0.0);
}

double BarClose(const int shift)
{
   double values[];
   ArraySetAsSeries(values,true);
   if(CopyClose(_Symbol,_Period,shift,1,values)==1) return(values[0]);
   return(0.0);
}

bool IsTesterRun()
{
   return(is_tester_run);
}

bool ShouldSkipPanelUpdate()
{
   return(IsTesterRun() && TesterSkipPanel);
}

bool ShouldRunCleanupThisTick(const bool is_new_bar)
{
   return(!IsTesterRun() || !TesterCleanupOnNewBarOnly || is_new_bar);
}

bool ShouldRunTrailingThisTick(const bool is_new_bar)
{
   return(!IsTesterRun() || !TesterTrailOnNewBarOnly || is_new_bar);
}

bool ShouldSendOrderAlerts()
{
   return(Alerts_inOrders && (!IsTesterRun() || !TesterDisableOrderAlerts));
}

void InfoLog(const string message)
{
   if(IsTesterRun() && TesterSuppressInfoLogs)
      return;

   Print(message);
}

int CreateTrendHandle()
{
   ResetLastError();
   return(iCustom(_Symbol,_Period,Indicator_Name,
                  "<------LIMNI HEDGE MA------>","","MA Settings",
                  MAPeriod,MAType,MAPrice,
                  "","RSI Filter Settings",UseRSI_Filter,RSIPeriod,RSIOverBought,RSIOverSold,
                  "","MA Dots Settings:",3,clrSkyBlue,clrYellow));
}

double GetTrendDownBuffer(const int shift)
{
   if(trendHandle==INVALID_HANDLE) return(EMPTY_VALUE);
   double values[];
   ArraySetAsSeries(values,true);
   if(CopyBuffer(trendHandle,0,shift,1,values)!=1) return(EMPTY_VALUE);
   return(values[0]);
}

bool LoadOpenPositionCompat(const long position_ticket)
{
   if(!PositionSelectByTicket((ulong)position_ticket)) return(false);
   ResetSelectedOrderCompat();
   selected_order.valid=true;
   selected_order.open=true;
   selected_order.ticket=position_ticket;
   selected_order.symbol=PositionGetString(POSITION_SYMBOL);
   selected_order.type=((ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE)==POSITION_TYPE_BUY ? OP_BUY : OP_SELL);
   selected_order.magic=(long)PositionGetInteger(POSITION_MAGIC);
   selected_order.volume=PositionGetDouble(POSITION_VOLUME);
   selected_order.open_price=PositionGetDouble(POSITION_PRICE_OPEN);
   selected_order.stop_loss=PositionGetDouble(POSITION_SL);
   selected_order.take_profit=PositionGetDouble(POSITION_TP);
   selected_order.profit=PositionGetDouble(POSITION_PROFIT);
   selected_order.swap=PositionGetDouble(POSITION_SWAP);
   selected_order.close_time=0;
   selected_order.comment=PositionGetString(POSITION_COMMENT);

   if(HistorySelect(0,TimeCurrent()+86400))
   {
      int deals=HistoryDealsTotal();
      for(int i=0;i<deals;i++)
      {
         ulong deal_ticket=HistoryDealGetTicket(i);
         if((long)HistoryDealGetInteger(deal_ticket,DEAL_POSITION_ID)==position_ticket)
            selected_order.commission+=HistoryDealGetDouble(deal_ticket,DEAL_COMMISSION);
      }
   }
   return(true);
}

bool LoadHistoryPositionCompat(const long position_ticket)
{
   ResetSelectedOrderCompat();
   if(!HistorySelect(0,TimeCurrent()+86400)) return(false);

   bool found=false;
   double in_volume=0.0;
   double out_volume=0.0;
   datetime last_out=0;
   int deals=HistoryDealsTotal();

   for(int i=0;i<deals;i++)
   {
      ulong deal_ticket=HistoryDealGetTicket(i);
      if((long)HistoryDealGetInteger(deal_ticket,DEAL_POSITION_ID)!=position_ticket) continue;

      found=true;
      selected_order.profit+=HistoryDealGetDouble(deal_ticket,DEAL_PROFIT);
      selected_order.commission+=HistoryDealGetDouble(deal_ticket,DEAL_COMMISSION);
      selected_order.swap+=HistoryDealGetDouble(deal_ticket,DEAL_SWAP);
      selected_order.symbol=HistoryDealGetString(deal_ticket,DEAL_SYMBOL);
      selected_order.magic=(long)HistoryDealGetInteger(deal_ticket,DEAL_MAGIC);
      selected_order.comment=HistoryDealGetString(deal_ticket,DEAL_COMMENT);

      ENUM_DEAL_TYPE deal_type=(ENUM_DEAL_TYPE)HistoryDealGetInteger(deal_ticket,DEAL_TYPE);
      if(deal_type==DEAL_TYPE_BUY)  selected_order.type=OP_BUY;
      if(deal_type==DEAL_TYPE_SELL) selected_order.type=OP_SELL;

      ENUM_DEAL_ENTRY entry=(ENUM_DEAL_ENTRY)HistoryDealGetInteger(deal_ticket,DEAL_ENTRY);
      double volume=HistoryDealGetDouble(deal_ticket,DEAL_VOLUME);
      if(entry==DEAL_ENTRY_IN) in_volume+=volume;
      if(entry==DEAL_ENTRY_OUT || entry==DEAL_ENTRY_INOUT)
      {
         out_volume+=volume;
         datetime deal_time=(datetime)HistoryDealGetInteger(deal_ticket,DEAL_TIME);
         if(deal_time>last_out) last_out=deal_time;
      }
   }

   if(!found) return(false);
   selected_order.valid=true;
   selected_order.open=false;
   selected_order.ticket=position_ticket;
   selected_order.volume=MathMax(0.0,in_volume-out_volume);
   selected_order.close_time=(last_out>0 ? last_out : TimeCurrent());
   return(true);
}

bool OrderSelectCompat(const long selector,const int select_mode)
{
   ResetSelectedOrderCompat();
   if(select_mode==SELECT_BY_POS)
   {
      int total=PositionsTotal();
      if(selector<0 || selector>=total) return(false);
      ulong pos_ticket=PositionGetTicket((int)selector);
      if(pos_ticket==0) return(false);
      return(LoadOpenPositionCompat((long)pos_ticket));
   }

   if(select_mode==SELECT_BY_TICKET)
   {
      if(LoadOpenPositionCompat(selector)) return(true);
      return(LoadHistoryPositionCompat(selector));
   }
   return(false);
}

double OrderProfitCompat()     { return(selected_order.profit); }
double OrderCommissionCompat() { return(selected_order.commission); }
double OrderSwapCompat()       { return(selected_order.swap); }
string OrderCommentCompat()    { return(selected_order.comment); }
datetime OrderCloseTimeCompat(){ return(selected_order.close_time); }
double OrderLotsCompat()       { return(selected_order.volume); }
int OrderTypeCompat()          { return(selected_order.type); }
double OrderOpenPriceCompat()  { return(selected_order.open_price); }
double OrderStopLossCompat()   { return(selected_order.stop_loss); }
double OrderTakeProfitCompat() { return(selected_order.take_profit); }
long OrderTicketCompat()       { return(selected_order.ticket); }
long OrderMagicNumberCompat()  { return(selected_order.magic); }
string OrderSymbolCompat()     { return(selected_order.symbol); }
int PositionsTotalCompat()     { return(PositionsTotal()); }

long FindNewestPositionTicketCompat(const string symbol,const int cmd,const long magic,const string comment,const datetime start_time)
{
   long best_ticket=0;
   datetime best_time=0;
   for(int i=PositionsTotal()-1;i>=0;i--)
   {
      ulong pos_ticket=PositionGetTicket(i);
      if(pos_ticket==0) continue;
      if(!PositionSelectByTicket(pos_ticket)) continue;
      if(PositionGetString(POSITION_SYMBOL)!=symbol) continue;
      if((long)PositionGetInteger(POSITION_MAGIC)!=magic) continue;
      ENUM_POSITION_TYPE ptype=(ENUM_POSITION_TYPE)PositionGetInteger(POSITION_TYPE);
      if((cmd==OP_BUY && ptype!=POSITION_TYPE_BUY) || (cmd==OP_SELL && ptype!=POSITION_TYPE_SELL)) continue;
      datetime ptime=(datetime)PositionGetInteger(POSITION_TIME);
      if(ptime<start_time) continue;
      if(ptime>=best_time)
      {
         best_time=ptime;
         best_ticket=(long)pos_ticket;
      }
   }
   return(best_ticket);
}

long OrderSendCompat(const string symbol,const int cmd,double volume,double price,const int slippage,double sl,double tp,const string comment,const int magic,const datetime expiration,const color arrow_color)
{
   datetime send_time=TimeCurrent()-5;
   MqlTradeRequest request;
   MqlTradeResult result;
   ZeroMemory(request);
   ZeroMemory(result);

   volume=NormalizeVolumeCompat(symbol,volume);
   request.action=TRADE_ACTION_DEAL;
   request.symbol=symbol;
   request.volume=volume;
   request.type=(cmd==OP_BUY ? ORDER_TYPE_BUY : ORDER_TYPE_SELL);
   request.price=(cmd==OP_BUY ? AskCompat() : BidCompat());
   request.sl=NormalizePriceCompat(symbol,sl);
   request.tp=NormalizePriceCompat(symbol,tp);
   request.deviation=slippage;
   request.magic=magic;
   request.comment=comment;
   request.type_time=ORDER_TIME_GTC;
   request.type_filling=GetFillingMode(symbol);

   ResetLastError();
   if(!OrderSend(request,result)) return(-1);
   if(result.retcode!=TRADE_RETCODE_DONE && result.retcode!=TRADE_RETCODE_PLACED && result.retcode!=TRADE_RETCODE_DONE_PARTIAL)
      return(-1);

   long pos_ticket=0;
   if(result.deal>0 && HistorySelect(send_time,TimeCurrent()+86400))
      pos_ticket=(long)HistoryDealGetInteger(result.deal,DEAL_POSITION_ID);
   if(pos_ticket<=0)
      pos_ticket=FindNewestPositionTicketCompat(symbol,cmd,magic,comment,send_time);
   if(pos_ticket<=0 && result.order>0)
      pos_ticket=(long)result.order;
   return(pos_ticket);
}

bool OrderModifyCompat(const long position_ticket,const double open_price,const double sl,const double tp,const datetime expiration)
{
   if(!LoadOpenPositionCompat(position_ticket)) return(false);
   MqlTradeRequest request;
   MqlTradeResult result;
   ZeroMemory(request);
   ZeroMemory(result);
   request.action=TRADE_ACTION_SLTP;
   request.position=(ulong)position_ticket;
   request.symbol=selected_order.symbol;
   request.sl=NormalizePriceCompat(selected_order.symbol,sl);
   request.tp=NormalizePriceCompat(selected_order.symbol,tp);
   request.magic=MagicNumber;
   ResetLastError();
   if(!OrderSend(request,result)) return(false);
   return(result.retcode==TRADE_RETCODE_DONE || result.retcode==TRADE_RETCODE_PLACED);
}

void CompactCurrentOrdersType1()
{
   long temp[][4];
   ArrayResize(temp,limitsize_arrays);
   ArrayInitialize(temp,0);
   int n=0;
   for(int r=0;r<limitsize_arrays;r++)
      if(current_orders_mat_type1[r][0]!=0)
      {
         for(int c=0;c<4;c++) temp[n][c]=current_orders_mat_type1[r][c];
         n++;
      }
   ArrayInitialize(current_orders_mat_type1,0);
   for(int r=0;r<n;r++) for(int c=0;c<4;c++) current_orders_mat_type1[r][c]=temp[r][c];
}

void CompactCurrentOrdersType3()
{
   long temp[][3];
   ArrayResize(temp,limitsize_arrays);
   ArrayInitialize(temp,0);
   int n=0;
   for(int r=0;r<limitsize_arrays;r++)
      if(current_orders_mat_type3[r][0]!=0)
      {
         for(int c=0;c<3;c++) temp[n][c]=current_orders_mat_type3[r][c];
         n++;
      }
   ArrayInitialize(current_orders_mat_type3,0);
   for(int r=0;r<n;r++) for(int c=0;c<3;c++) current_orders_mat_type3[r][c]=temp[r][c];
}


//+------------------------------------------------------------------+
//| Expert initialization function                                   |
//+------------------------------------------------------------------+
int OnInit()
{
//---
//---
   //Global variables initialization
   session_time_id=DoubleToString(TimeCurrent(),0);
   current_chart_id=ChartID();
   errors_in_init=false;
   is_tester_run=((bool)MQLInfoInteger(MQL_TESTER) || (bool)MQLInfoInteger(MQL_OPTIMIZATION));

   Use_Type1_Orders=InpUse_Type1_Orders;
   Use_Type3_Orders=InpUse_Type3_Orders;

   mytime=BarTime(0);


   if ((_Point == 0.00001) || (_Point == 0.001)) digits_multiplier=10; //5 digits
   else digits_multiplier=1; //4 digits

   if ((StringFind(Symbol(),"XAU",0) >= 0) || (StringFind(Symbol(),"Gold",0) >= 0) || (StringFind(Symbol(),"GOLD",0) >= 0))//Gold detection
   {
      if (_Point==0.1) digits_multiplier=1;
      if (_Point==0.01) digits_multiplier=10;
      if (_Point==0.001) digits_multiplier=100;
   }

   //Foramteamos SL y TP
   if (digits_multiplier==10)
   {
      TP_inPips=NormalizeDouble(Orders_TP_Pips,1);
      SL_inPips=NormalizeDouble(Orders_SL_Pips,1);
   }
   else
   {
      TP_inPips=NormalizeDouble(Orders_TP_Pips,0);
      SL_inPips=NormalizeDouble(Orders_SL_Pips,0);
   }



   // Used to detect the first tick and do initilizations
   num_run=0;


   Lots=Trade_Lots;
   symbolperiod=Symbol() + "_M" + DoubleToString(Period(),0);
   // Check that the converted trend indicator can be loaded.
   trendHandle = CreateTrendHandle();
   if(trendHandle==INVALID_HANDLE) // error
   {
      Alert(name_EA + " "  + symbolperiod + "-> ERROR: the needed indicator "+Indicator_Name+".mq5 was not found or could not be loaded, please copy it in Indicators folder.");
      errors_in_init=true;
   }


   // initial errors checks
   if(Limited_toDemoAccounts==true)
   {
      if (!IsDemoCompat())
      {
         Alert(name_EA + " " + symbolperiod +  "-> ERROR!, your license only allow to run this robot in Demo accounts, please, use a demo account.");
         errors_in_init=true;
      }
   }


   if (!IsExpertEnabledCompat())
   {
      Alert(name_EA + " " + symbolperiod +  "-> ERROR!, Experts are DISABLED!, please, enable it and restart the EA to trade.");
      errors_in_init=true;
   }

   if ((SL_inPips < 0) || (TP_inPips < 0))
   {
      Alert(name_EA + " " + symbolperiod + "-> ERROR: SL/TP values have to be >= 0.");
      errors_in_init=true;
   }

   if (Lots < MarketInfoCompat(Symbol(),MODE_MINLOT))
   {
      Alert(name_EA + " "  + symbolperiod + "-> ERROR: Lotsize value is incorrect (Min Lot size = " + DoubleToString(MarketInfoCompat(Symbol(),MODE_MINLOT),2) + ")");
      errors_in_init=true;
   }


   if(errors_in_init)
   {
      Comment(name_EA + " " + version_EA + " not working: Error in initial load...");
      return(-1);
   }

   //OK so far... here we have loaded right the indicators values in global variables
   //now we manage it to calculate Initial Status, Signals, SL, TP...
   TradeComment=Symbol() + "_" + name_EA;


   ArrayInitialize(total_orders_mat_type1,-1);
   ArrayInitialize(current_orders_mat_type1,0);
   num_orders_intype1=0;
   maximum_drawdown_type1=0;

   ArrayInitialize(total_orders_mat_type3,-1);
   ArrayInitialize(current_orders_mat_type3,0);
   num_orders_intype3=0;
   maximum_drawdown_type3=0;

   lasttradetype1_time=0;
   lasttradetype3_time=0;

   LastOrderTicket=0;

   first_trend_change=false;

   old_trend_dir=0;
   current_trend_dir=0;
   trend_change=0;

   CommentPanel_Update();


//---
   return(INIT_SUCCEEDED);
}




//+------------------------------------------------------------------+
//| Expert deinitialization function                                 |
//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
//---
   if(trendHandle!=INVALID_HANDLE)
   {
      IndicatorRelease(trendHandle);
      trendHandle=INVALID_HANDLE;
   }
   Comment("");
}




//+------------------------------------------------------------------+
//| Expert tick function                                             |
//+------------------------------------------------------------------+
void OnTick()
{
//---

   datetime current_bar_time=BarTime(0);
   bool is_new_bar=(mytime!=current_bar_time);

   if(ShouldRunTrailingThisTick(is_new_bar))
      TrailingStop();

   //if there was errors in the init section we don't want to execute anything
   if(errors_in_init)
   {
      Comment(name_EA + " " + version_EA + " not working: Error in initial load...");
      return;
   }


   //we need to not use the first tick to avoid some problem whe initial load in renko bars
   num_run++;
   if(num_run<=2)
   {
      if(num_run==1) return; //first tick descarted because when we start the MT4 with charts with the EA loaded some times execute the first tick when there is not
      mytime=current_bar_time;
      is_new_bar=false;
   }   // End init of time info

   // In tester mode this can be deferred to the new-bar path because entries
   // only evaluate once per bar.
   if(ShouldRunCleanupThisTick(is_new_bar))
      CheckClosedTradesSLTP_UpdateOrdersArrays();


   // new bar
   if(is_new_bar)
   {
      mytime=current_bar_time;

      // Loadinng indicator values
      int myMAType=MAType;
      int myMAPrice=MAPrice;

      double inditrend0_buf0 = GetTrendDownBuffer(0); // if value!= EMPTY_VALUE then trend is down, else is up

      double inditrend1_buf0 = GetTrendDownBuffer(1); // if value!= EMPTY_VALUE then trend is down, else is up

      double inditrend2_buf0 = GetTrendDownBuffer(2); // if value!= EMPTY_VALUE then trend is down, else is up

      double inditrend3_buf0 = GetTrendDownBuffer(3); // if value!= EMPTY_VALUE then trend is down, else is up

      double inditrend4_buf0 = GetTrendDownBuffer(4); // if value!= EMPTY_VALUE then trend is down, else is up

      inditrend0_dir=0; // 1 for up trend and -1 for down trend
      inditrend1_dir=0; // 1 for up trend and -1 for down trend
      inditrend2_dir=0; // 1 for up trend and -1 for down trend
      inditrend3_dir=0; // 1 for up trend and -1 for down trend
      inditrend4_dir=0; // 1 for up trend and -1 for down trend

      if (inditrend0_buf0 != EMPTY_VALUE) inditrend0_dir=-1;
      else inditrend0_dir=1;

      if (inditrend1_buf0 != EMPTY_VALUE) inditrend1_dir=-1;
      else inditrend1_dir=1;

      if (inditrend2_buf0 != EMPTY_VALUE) inditrend2_dir=-1;
      else inditrend2_dir=1;

      if (inditrend3_buf0 != EMPTY_VALUE) inditrend3_dir=-1;
      else inditrend3_dir=1;

      if (inditrend4_buf0 != EMPTY_VALUE) inditrend4_dir=-1;
      else inditrend4_dir=1;

      current_trend_dir=inditrend1_dir;

      //Print("Bar3_dir: " + IntegerToString(inditrend3_dir) + " Bar2_dir: " + IntegerToString(inditrend2_dir) +" Bar1_dir: " + IntegerToString(inditrend1_dir) +" Bar0_dir: " + IntegerToString(inditrend0_dir));

      // waiting for fisrt trend change to start to open trades.
      if(WaitForFirstTrendChange==true)
      {
         if(first_trend_change==false)
         {
            if (((inditrend2_dir==-1) && (inditrend1_dir==1)) || ((inditrend2_dir==1) && (inditrend1_dir==-1))) // trend change
            {
               if((inditrend2_dir==-1) && (inditrend1_dir==1))
               {
                  old_trend_dir=-1;
                  current_trend_dir=1;
               }
               if((inditrend2_dir==1) && (inditrend1_dir==-1))
               {
                  old_trend_dir=1;
                  current_trend_dir=-1;
               }

               InfoLog(name_EA + " " + symbolperiod +  "-> First trend change, starting to trade...");
               first_trend_change=true; // in next new bars we dont need to check for the first trend change because it is already done
            }
            else
            {
               return;
            }
         }
      }
      else // not need to wait until first trend change
      {
         old_trend_dir=inditrend2_dir;
      }



      //detect the direction of trend change
      trend_change=0;
      if ((old_trend_dir==-1) && (current_trend_dir==1))
      {
         trend_change=1;
         old_trend_dir=1;
         InfoLog("Trend changes from down to up");
      }
      if ((old_trend_dir==1) && (current_trend_dir==-1))
      {
         trend_change=-1;
         old_trend_dir=-1;
         InfoLog("Trend changes from up to down");
      }


      // Manage signal combinations for the surviving order types (1 and 3)------------------------------------
      int current_type3candle_combination=0; //change in type 3 logic from 3 bars to 4
      current_type3candle_combination=check_type3candles_combinations();
      //Print("current_candle_combination:" + IntegerToString(current_candle_combination));

      // Exit management by staged position reduction removed in LimniHedge V1.




      // Manage opening trades of the different type (1 and 3)--------------------------------------------------
      // Open trades type 1------------------------------------------------------------------------------------

      // Buy trade Type 1
      if((Use_Type1_Orders==true) && (lasttradetype1_time != current_bar_time))
      {
         if (trend_change==1) // buy signal
         {
            // send buy order
            if(ShouldSendOrderAlerts()) Alert(name_EA + " " + symbolperiod +  "-> new Buy order Type 1");
            InfoLog(name_EA + " " + symbolperiod +  "-> new Buy order Type 1");

            if (send_buy_directSLTP(Trade_Lots * 4,SL_inPips,TP_inPips)==0)
            {
               return;  // if error
            }
            else
            {
               // if all is ok with buy order we generate the info for next possible martingale trade
               AddOrder_toType1_Array(ticket,1,4);
               num_orders_intype1++;
               LastOrderTicket=ticket;
               lasttradetype1_time = current_bar_time;
            }

            CommentPanel_Update();


         } // END buy trade type 1

         // Sell trade Type 1
         if (trend_change==-1) // sell signal
         {
            // send buy order
            if(ShouldSendOrderAlerts()) Alert(name_EA + " " + symbolperiod +  "-> new Sell order Type 1");
            InfoLog(name_EA + " " + symbolperiod +  "-> new Sell order Type 1");

            if (send_sell_directSLTP(Trade_Lots * 4,SL_inPips,TP_inPips)==0)
            {
               return;  // if error
            }
            else
            {
               // if all is ok with buy order we generate the info for next possible martingale trade
               AddOrder_toType1_Array(ticket,-1,4);
               num_orders_intype1++;
               LastOrderTicket=ticket;
               lasttradetype1_time = current_bar_time;
            }

            CommentPanel_Update();


         } // END Sell trade type 1

      }  // END managing Open Type 1 orders

      // Open trades type 3------------------------------------------------------------------------------------

      if((Use_Type3_Orders==true) && (lasttradetype3_time != current_bar_time))
      {
         // Buy trade Type 3 when while down trend and 3 up bars
         if ((inditrend4_dir==-1) && (inditrend3_dir==-1) && (inditrend2_dir==-1) && (inditrend1_dir==-1) && (current_type3candle_combination == 4)) // Buy trade Type 3 when while down trend and 4 up bars
         {
            // send buy order
            if(ShouldSendOrderAlerts()) Alert(name_EA + " " + symbolperiod +  "-> new Buy order Type 3");
            InfoLog(name_EA + " " + symbolperiod +  "-> new Buy order Type 3");

            if (send_buy_directSLTP(Trade_Lots * 2,SL_inPips,TP_inPips)==0)
            {
               return;  // if error
            }
            else
            {
               // if all is ok with buy order we generate the info for next possible martingale trade
               AddOrder_toType3_Array(ticket,1,2);
               num_orders_intype3++;
               LastOrderTicket=ticket;
               lasttradetype3_time = current_bar_time;
            }

            CommentPanel_Update();


         } // END buy trade type 3 when while down trend and 3 up bars


         // Sell trade Type 3 when while up trend and 3 down bars
         if ((inditrend4_dir==1) && (inditrend3_dir==1) && (inditrend2_dir==1) && (inditrend1_dir==1) && (current_type3candle_combination == -4)) // Sell trade Type 3 when while up trend and 4 down bars
         {
            // send buy order
            if(ShouldSendOrderAlerts()) Alert(name_EA + " " + symbolperiod +  "-> new Sell order Type 3");
            InfoLog(name_EA + " " + symbolperiod +  "-> new Sell order Type 3");

            if (send_sell_directSLTP(Trade_Lots * 2,SL_inPips,TP_inPips)==0)
            {
               return;  // if error
            }
            else
            {
               // if all is ok with buy order we generate the info for next possible martingale trade
               AddOrder_toType3_Array(ticket,-1,2);
               num_orders_intype3++;
               LastOrderTicket=ticket;
               lasttradetype3_time = current_bar_time;
            }

            CommentPanel_Update();


         } // END Sell trade type 3 when while up trend and 3 down bars

      }  // END managing Open Type 3 orders


   } // END NEW BAR


   CommentPanel_Update();

}
//+------------------------------------------------------------------+



//-----------------------------------CHECK BAR COMBINARIONS-------------------------------------------------------------
//-----------------------------------CHECK BAR COMBINARIONS-------------------------------------------------------------
//-----------------------------------CHECK BAR COMBINARIONS-------------------------------------------------------------
//-----------------------------------CHECK BAR COMBINARIONS-------------------------------------------------------------

// return how was the last candles:
// 1 if the combinarion was bear-bull
// 2 if the combinarion was bear-bull-bull
// 3 if the combinarion was bear-bull-bull-bull
// 4 if the combinarion was bear-bull-bull-bull-bull
// 5 if the combinarion was bull-bull-bull-bull-bull
// -1 if the combinarion was bull-bear
// -2 if the combinarion was bull-bear-bear
// -3 if the combinarion was bull-bear-bear-bear
// -4 if the combinarion was bull-bear-bear-bear-bear
// -5 if the combinarion was bear-bear-bear-bear-bear

//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
int check_type3candles_combinations()
{
   if ((check_candle(2)==-1) && (check_candle(1)==1)) return(1);
   if ((check_candle(3)==-1) && (check_candle(2)==1) && (check_candle(1)==1)) return(2);
   if ((check_candle(4)==-1) && (check_candle(3)==1) && (check_candle(2)==1) && (check_candle(1)==1)) return(3);
   if ((check_candle(5)==-1) && (check_candle(4)==1) && (check_candle(3)==1) && (check_candle(2)==1) && (check_candle(1)==1)) return(4);
   if ((check_candle(5)==1)  && (check_candle(4)==1) && (check_candle(3)==1) && (check_candle(2)==1) && (check_candle(1)==1)) return(5);

   if ((check_candle(2)==1) && (check_candle(1)==-1)) return(-1);
   if ((check_candle(3)==1) && (check_candle(2)==-1) && (check_candle(1)==-1)) return(-2);
   if ((check_candle(4)==1) && (check_candle(3)==-1) && (check_candle(2)==-1) && (check_candle(1)==-1)) return(-3);
   if ((check_candle(5)==1) && (check_candle(4)==-1) && (check_candle(3)==-1) && (check_candle(2)==-1) && (check_candle(1)==-1)) return(-4);
   if ((check_candle(5)==-1) && (check_candle(4)==-1) && (check_candle(3)==-1) && (check_candle(2)==-1) && (check_candle(1)==-1)) return(-5);

   return(0);
}



//return uif the indicated candle is a bull(1) or bear(-1) or doji(0)
int check_candle(int num_candle_tocheck)
{
   if (BarClose(num_candle_tocheck) > BarOpen(num_candle_tocheck)) return(1);
   if (BarClose(num_candle_tocheck) == BarOpen(num_candle_tocheck)) return(0);
   return(-1);
}

//-----------------------------------ARRAY OF LEVELS CALCULATIONS-------------------------------------------------------
//-----------------------------------ARRAY OF LEVELS CALCULATIONS-------------------------------------------------------
//-----------------------------------ARRAY OF LEVELS CALCULATIONS-------------------------------------------------------
//-----------------------------------ARRAY OF LEVELS CALCULATIONS-------------------------------------------------------



//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
void AddOrder_toType1_Array(long ticket_order_number, int type_oforder, int status_oforder)
{

   int r=0;
   for (r=0; r<limitsize_arrays_tot; r++)
   {
      if (total_orders_mat_type1[r]==-1)
      {
         total_orders_mat_type1[r]=ticket_order_number;
         break;
      }
   }
   for (r=0; r<limitsize_arrays; r++)
   {
      if (current_orders_mat_type1[r][0]==0)
      {
         current_orders_mat_type1[r][0]=ticket_order_number;
         current_orders_mat_type1[r][1]=type_oforder;
         current_orders_mat_type1[r][2]=status_oforder;
         current_orders_mat_type1[r][3]=0; // reserved legacy status slot
         break;
      }
   }
}



//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
void AddOrder_toType3_Array(long ticket_order_number, int type_oforder, int status_oforder)
{

   int r=0;
   for (r=0; r<limitsize_arrays_tot; r++)
   {
      if (total_orders_mat_type3[r]==-1)
      {
         total_orders_mat_type3[r]=ticket_order_number;
         break;
      }
   }
   for (r=0; r<limitsize_arrays; r++)
   {
      if (current_orders_mat_type3[r][0]==0)
      {
         current_orders_mat_type3[r][0]=ticket_order_number;
         current_orders_mat_type3[r][1]=type_oforder;
         current_orders_mat_type3[r][2]=status_oforder;
         break;
      }
   }
}




//-----------------------------------PANEL INFORMATION -----------------------------------------------------------------
//-----------------------------------PANEL INFORMATION -----------------------------------------------------------------
//-----------------------------------PANEL INFORMATION -----------------------------------------------------------------
//-----------------------------------PANEL INFORMATION -----------------------------------------------------------------


//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
void CommentPanel_Update()
{
   if(ShouldSkipPanelUpdate())
      return;

   string alert_onoff_text;
   if (Alerts_inOrders==true) alert_onoff_text="On";
   else alert_onoff_text="Off";

   string waitforfirst_onoff_text;
   if (WaitForFirstTrendChange==true) waitforfirst_onoff_text="On";
   else waitforfirst_onoff_text="Off";

   string money_currency=AccountCurrencyCompat();

   string mensaje_Orders="\n";
   mensaje_Orders= mensaje_Orders + " Trade Lot: " + DoubleToString(Trade_Lots,2);
   mensaje_Orders= mensaje_Orders + " | TP Pips: " + DoubleToString(TP_inPips,1)  + " | SL Pips: " + DoubleToString(SL_inPips,1);

   double profit_type1=profit_orders_type1();
   if(profit_type1 < maximum_drawdown_type1) maximum_drawdown_type1=profit_type1;

   double profit_type3=profit_orders_type3();
   if(profit_type3 < maximum_drawdown_type3) maximum_drawdown_type3=profit_type3;

   mensaje_Ind="\n-------------------------------------------------------------------------";
   if(Use_Type1_Orders==true) mensaje_Ind=mensaje_Ind+ "\n Orders Type #1: ACTIVATED";
   else mensaje_Ind=mensaje_Ind+ "\n Orders Type #1: OFF";
   mensaje_Ind=mensaje_Ind+ "\n Nº Orders Type #1: " + IntegerToString(num_orders_intype1);
   mensaje_Ind=mensaje_Ind+ "\n Total Profit in Orders Type #1: " + DoubleToString(profit_type1,2) + " " + money_currency;

   if(Use_Type3_Orders==true) mensaje_Ind=mensaje_Ind+ "\n\n Orders Type #3: ACTIVATED";
   else mensaje_Ind=mensaje_Ind+ "\n\n Orders Type #3: OFF";
   mensaje_Ind=mensaje_Ind+ "\n Nº Orders Type #3: " + IntegerToString(num_orders_intype3);
   mensaje_Ind=mensaje_Ind+ "\n Total Profit in Orders Type #3: " + DoubleToString(profit_type3,2) + " " + money_currency;

   mensaje_Ind=mensaje_Ind+ "\n-------------------------------------------------------------------------";
   mensaje_Ind=mensaje_Ind+ "\n TOTAL PROFIT IN ALL ORDERS: " + DoubleToString((profit_type1 + profit_type3),2) + " " + money_currency;
   mensaje_Ind=mensaje_Ind+ "\n-------------------------------------------------------------------------";


   Comment(name_EA + " " + version_EA + " working..." + "\n-------------------------------------------------------------------------" + mensaje_Orders + "\n Wait Trend Change: "+ waitforfirst_onoff_text+ " | Alert in Signals: " + alert_onoff_text + "" + mensaje_Ind);
}




//----------------------------------------ORDERS MANAGMENT-----------------------------------------------------
//----------------------------------------ORDERS MANAGMENT-----------------------------------------------------
//----------------------------------------ORDERS MANAGMENT-----------------------------------------------------
//----------------------------------------ORDERS MANAGMENT-----------------------------------------------------
//----------------------------------------ORDERS MANAGMENT-----------------------------------------------------





bool TicketSeenEarlierType1(const int upto,const long ticket_to_check)
{
   for(int i=0;i<upto;i++) if(total_orders_mat_type1[i]==ticket_to_check) return(true);
   return(false);
}

bool TicketSeenEarlierType3(const int upto,const long ticket_to_check)
{
   for(int i=0;i<upto;i++) if(total_orders_mat_type3[i]==ticket_to_check) return(true);
   return(false);
}

//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
double profit_orders_type1()
{
   double beneficio=0.0;
   bool order_toseeprofit=false;
   int r=0;
   for (r=0; r<limitsize_arrays_tot; r++)
   {
      if (total_orders_mat_type1[r]==-1)
      {
         break;
      }
      if(TicketSeenEarlierType1(r,total_orders_mat_type1[r])) continue;
      order_toseeprofit= OrderSelectCompat(total_orders_mat_type1[r], SELECT_BY_TICKET);
      if(order_toseeprofit)
         beneficio= beneficio + OrderProfitCompat() + OrderCommissionCompat() + OrderSwapCompat();

   }
   return(beneficio);
}



//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
double profit_orders_type3()
{
   double beneficio=0.0;
   bool order_toseeprofit=false;
   int r=0;
   for (r=0; r<limitsize_arrays_tot; r++)
   {
      if (total_orders_mat_type3[r]==-1)
      {
         break;
      }
      if(TicketSeenEarlierType3(r,total_orders_mat_type3[r])) continue;
      order_toseeprofit= OrderSelectCompat(total_orders_mat_type3[r], SELECT_BY_TICKET);
      if(order_toseeprofit)
         beneficio= beneficio + OrderProfitCompat() + OrderCommissionCompat() + OrderSwapCompat();

   }
   return(beneficio);
}


//This function check all active orders in arrays of types and if one is closed by SL or TP then the function eliminates it from arrays
void CheckClosedTradesSLTP_UpdateOrdersArrays()
{
   int r;

   //Check orders type 1
   bool order_closed_bySLTP=false;
   for (r=0; r<limitsize_arrays; r++)
   {
      if (current_orders_mat_type1[r][0]!=0)
      {
         result_order_select=OrderSelectCompat(current_orders_mat_type1[r][0], SELECT_BY_TICKET);

         //initial check to be sure that the trade is not already closed by SL or TP
         if(OrderCloseTimeCompat()!=0) // order already closed by SL or TP - > we need to empty that order in array
         {
            order_closed_bySLTP=true;
            current_orders_mat_type1[r][0]=0;
            current_orders_mat_type1[r][1]=0;
            current_orders_mat_type1[r][2]=0;
            current_orders_mat_type1[r][3]=0;
         }
      }
      else break;
   }
   if(order_closed_bySLTP==true) CompactCurrentOrdersType1();


   //Check orders type 3
   order_closed_bySLTP=false;
   for (r=0; r<limitsize_arrays; r++)
   {
      if (current_orders_mat_type3[r][0]!=0)
      {
         result_order_select=OrderSelectCompat(current_orders_mat_type3[r][0], SELECT_BY_TICKET);

         //initial check to be sure that the trade is not already closed by SL or TP
         if(OrderCloseTimeCompat()!=0) // order already closed by SL or TP - > we need to empty that order in array
         {
            order_closed_bySLTP=true;
            current_orders_mat_type3[r][0]=0;
            current_orders_mat_type3[r][1]=0;
            current_orders_mat_type3[r][2]=0;
         }
      }
      else break;
   }
   if(order_closed_bySLTP==true) CompactCurrentOrdersType3();


}



//this sell function send the sell order with SL and TP included in only one step, no open the trade and later add SL and TP
//0 error
//1 buy done well
int send_buy_directSLTP(double tam_lot,double SL_Pips, double TP_Pips)
{
   int error_code;
   string OrdComment= TradeComment;
   //Comprobamos errores

   if ((SL_Pips < 0) || (TP_Pips < 0))
   {
      Print(name_EA + " " + Symbol() + "_M" + DoubleToString(Period(),0) + " Error opening BUY Order, SL/TP values are incorrect.");
      Alert(name_EA + " " + Symbol() + "_M" + DoubleToString(Period(),0) + "-> ERROR: BUY Order can not be OPENED, SL/TP values are incorrect.");
      return(0);
   }

   //comprobamos que is el SL es > 0 este sea mayor que el SL minimo.
   double Min_Dist=MarketInfoCompat(Symbol(),MODE_STOPLEVEL);
   if ((SL_Pips > 0) && ((SL_Pips * digits_multiplier) < Min_Dist))
   {
      SL_Pips=(Min_Dist * 1.0)/(digits_multiplier * 1.0);
      Print(name_EA + " " + Symbol() + "_M" + DoubleToString(Period(),0) + " Warning, The minimum SL is " + DoubleToString(SL_Pips,1) + " pips, we use this SL in all orders.");
      Alert(name_EA + " " + Symbol() + "_M" + DoubleToString(Period(),0) + "-> Warning, The minimum SL is " + DoubleToString(SL_Pips,1) + " pips, we use this SL in all orders.");
   }



   if (tam_lot < MarketInfoCompat(Symbol(),MODE_MINLOT))
   {
      Print(name_EA + " " + Symbol() + "_M" + DoubleToString(Period(),0) + " Error opening BUY Order, Lotsize value is incorrect (Min Lot size = " + DoubleToString(MarketInfoCompat(Symbol(),MODE_MINLOT),3) + ")");
      Alert(name_EA + " " + Symbol() + "_M" + DoubleToString(Period(),0) + "-> ERROR: BUY Order can not be OPENED, Lotsize value is incorrect (Min Lot size = " + DoubleToString(MarketInfoCompat(Symbol(),MODE_MINLOT),3) + ")");
      return(0);
   }

   // si todo esta bien abrimos operaciones, lo intentamos en caso de error el numero de veces indicado en intentos_max
   int intentos_max=3;
   int act_iterac=0;

   double SL_multiply=1.0;
   double TP_multiply=1.0;

   if(TP_Pips <= 0) TP_multiply=0;
   if(SL_Pips <= 0) SL_multiply=0;



   RefreshRatesCompat();
   ticket=OrderSendCompat(Symbol(),OP_BUY,tam_lot,AskCompat(),50,SL_multiply * (AskCompat() - (_Point * SL_Pips * digits_multiplier)), TP_multiply * (AskCompat() + (_Point * TP_Pips * digits_multiplier)),OrdComment,MagicNumber,0,clrGreen);
   while((ticket==-1) && (act_iterac < intentos_max))
   {
      error_code=GetLastError();
      Print(name_EA + " " + Symbol() + "_M" + DoubleToString(Period(),0) + " Error (SB)opening BUY Order = " + DoubleToString(error_code,0) + " (Attempt:" + DoubleToString((act_iterac + 1),0)+"/" + DoubleToString(intentos_max,0) +")");
      Alert(name_EA + " " + Symbol() + "_M" + DoubleToString(Period(),0) + "-> ERROR(SB): BUY Order can not be OPENED, error code " + DoubleToString(error_code,0) + " (Attempt:" + DoubleToString((act_iterac + 1),0)+"/" + DoubleToString(intentos_max,0) +")");
      Sleep(2000);
      RefreshRatesCompat();
      ticket=OrderSendCompat(Symbol(),OP_BUY,tam_lot,AskCompat(),50,SL_multiply * (AskCompat() - (_Point * SL_Pips * digits_multiplier)), TP_multiply * (AskCompat() + (_Point * TP_Pips * digits_multiplier)),OrdComment,MagicNumber,0,clrGreen);
      act_iterac=act_iterac+1;
   }

   if(ticket>0)
   {
      InfoLog(name_EA + " " + Symbol() + "_M" + DoubleToString(Period(),0) + " BUY order " + DoubleToString(ticket,0) + " opened correctly with SL and TP");
      return(1);
   }
   else return(0);
}


//this sell function send the sell order with SL and TP included in only one step, no open the trade and later add SL and TP
//0 error
//1 sell done well
int send_sell_directSLTP(double tam_lot,double SL_Pips, double TP_Pips)
{
   int error_code;
   string OrdComment= TradeComment;
   //Comprobamos errores

   if ((SL_Pips < 0) || (TP_Pips < 0))
   {
      Print(name_EA + " " + Symbol() + "_M" + DoubleToString(Period(),0) + " Error opening SELL Order, SL/TP values are incorrect.");
      Alert(name_EA + " " + Symbol() + "_M" + DoubleToString(Period(),0) + "-> ERROR: SELL Order can not be OPENED, SL/TP values are incorrect.");
      return(0);
   }

   //comprobamos que is el SL es > 0 este sea mayor que el SL minimo.
   double Min_Dist=MarketInfoCompat(Symbol(),MODE_STOPLEVEL);
   if ((SL_Pips > 0) && ((SL_Pips * digits_multiplier) < Min_Dist))
   {
      SL_Pips=(Min_Dist * 1.0)/(digits_multiplier * 1.0);
      Print(name_EA + " " + Symbol() + "_M" + DoubleToString(Period(),0) + " Warning, The minimum SL is " + DoubleToString(SL_Pips,1) + " pips, we use this SL in all orders.");
      Alert(name_EA + " " + Symbol() + "_M" + DoubleToString(Period(),0) + "-> Warning, The minimum SL is " + DoubleToString(SL_Pips,1) + " pips, we use this SL in all orders.");
   }



   if (tam_lot < MarketInfoCompat(Symbol(),MODE_MINLOT))
   {
      Print(name_EA + " " + Symbol() + "_M" + DoubleToString(Period(),0) + " Error opening SELL Order, Lotsize value is incorrect (Min Lot size = " + DoubleToString(MarketInfoCompat(Symbol(),MODE_MINLOT),3) + ")");
      Alert(name_EA + " " + Symbol() + "_M" + DoubleToString(Period(),0) + "-> ERROR: SELL Order can not be OPENED, Lotsize value is incorrect (Min Lot size = " + DoubleToString(MarketInfoCompat(Symbol(),MODE_MINLOT),3) + ")");
      return(0);
   }

   // si todo esta bien abrimos operaciones, lo intentamos en caso de error el numero de veces indicado en intentos_max
   int intentos_max=3;
   int act_iterac=0;

   double SL_multiply=1.0;
   double TP_multiply=1.0;

   if(TP_Pips <= 0) TP_multiply=0;
   if(SL_Pips <= 0) SL_multiply=0;



   RefreshRatesCompat();
   ticket=OrderSendCompat(Symbol(),OP_SELL,tam_lot,BidCompat(),50,SL_multiply * (BidCompat() + (_Point * SL_Pips * digits_multiplier)), TP_multiply * (BidCompat() - (_Point * TP_Pips * digits_multiplier)),OrdComment,MagicNumber,0,clrRed);
   while((ticket==-1) && (act_iterac < intentos_max))
   {
      error_code=GetLastError();
      Print(name_EA + " " + Symbol() + "_M" + DoubleToString(Period(),0) + " Error (SS)opening SELL Order = " + DoubleToString(error_code,0) + " (Attempt:" + DoubleToString((act_iterac + 1),0)+"/" + DoubleToString(intentos_max,0) +")");
      Alert(name_EA + " " + Symbol() + "_M" + DoubleToString(Period(),0) + "-> ERROR(SS): SELL Order can not be OPENED, error code " + DoubleToString(error_code,0) + " (Attempt:" + DoubleToString((act_iterac + 1),0)+"/" + DoubleToString(intentos_max,0) +")");
      Sleep(2000);
      RefreshRatesCompat();
      ticket=OrderSendCompat(Symbol(),OP_SELL,tam_lot,BidCompat(),50,SL_multiply * (BidCompat() + (_Point * SL_Pips * digits_multiplier)), TP_multiply * (BidCompat() - (_Point * TP_Pips * digits_multiplier)),OrdComment,MagicNumber,0,clrRed);
      act_iterac=act_iterac+1;
   }

   if(ticket>0)
   {
      InfoLog(name_EA + " " + Symbol() + "_M" + DoubleToString(Period(),0) + " SELL order " + DoubleToString(ticket,0) + " opened correctly with SL and TP");
      return(1);
   }
   else return(0);
}








//-----------------------------------GLOBAL------------------------------------------------------------------------------
//-----------------------------------GLOBAL------------------------------------------------------------------------------
//-----------------------------------GLOBAL------------------------------------------------------------------------------
//-----------------------------------GLOBAL------------------------------------------------------------------------------


//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
string Convert_Numbers_to_TwoDigits(int number_toconvert)
{
   string temp_text="";

   if(number_toconvert < 10) temp_text="0" + DoubleToString(number_toconvert,0);
   else temp_text=DoubleToString(number_toconvert,0);

   return(temp_text);
}

//+------------------------------------------------------------------+
//|                                                                  |
//+------------------------------------------------------------------+
void TrailingStop()
{
   if(!Use_StopLoss)    return;
   double newSL=0;
   int res;
   for(int i=PositionsTotalCompat()-1; i>=0; i--)
   {
      if(OrderSelectCompat(i,SELECT_BY_POS))
      {
         if(OrderMagicNumberCompat()==MagicNumber && OrderSymbolCompat()==_Symbol)
         {
            if(OrderTypeCompat()==OP_BUY)
            {
               if(BidCompat()-OrderOpenPriceCompat() >= (_Point * Trail_Start_Pips * digits_multiplier))
               {
                  if((BidCompat()-OrderStopLossCompat() >(_Point * Trail_Step_Pips * digits_multiplier)) || OrderStopLossCompat()==0)
                  {
                     newSL=BidCompat()-(_Point * Trail_Stop_Pips * digits_multiplier);
                     if(NormalizeDouble(newSL,_Digits)>NormalizeDouble(OrderStopLossCompat(),_Digits) || OrderStopLossCompat()==0)
                     {
                        res=OrderModifyCompat(OrderTicketCompat(),OrderOpenPriceCompat(),newSL,OrderTakeProfitCompat(),0);
                     }
                  }
               }
            }
            if(OrderTypeCompat()==OP_SELL)
            {
               if(OrderOpenPriceCompat()-AskCompat() >= (_Point * Trail_Start_Pips * digits_multiplier))
               {
                  if((OrderStopLossCompat()-AskCompat() >(_Point * Trail_Step_Pips * digits_multiplier)) || OrderStopLossCompat()==0)
                  {
                     newSL=AskCompat()+(_Point * Trail_Stop_Pips * digits_multiplier);
                     if(NormalizeDouble(newSL,_Digits)<NormalizeDouble(OrderStopLossCompat(),_Digits) || OrderStopLossCompat()==0)
                     {
                        res=OrderModifyCompat(OrderTicketCompat(),OrderOpenPriceCompat(),newSL,OrderTakeProfitCompat(),0);
                     }
                  }
               }
            }
         }
      }
   }
}
//+------------------------------------------------------------------+
