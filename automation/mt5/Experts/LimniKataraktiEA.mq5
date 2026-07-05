//+------------------------------------------------------------------+
//|                                           LimniKataraktiEA.mq5   |
//|                 Simple M1 Strategy Tester validation harness     |
//+------------------------------------------------------------------+
#property copyright "LIMNI LTD"
#property version   "1.00"
#property strict
#property tester_indicator "David_MA_Color_V1f_Updated.ex5"

#include <Trade/Trade.mqh>

enum LimniKataraktiMode
{
   KTR_LOOSE = 0,
   KTR_BALANCED = 1,
   KTR_EXTREME = 2
};

enum LimniDavidDirectionMode
{
   DAVID_OFF = 0,
   DAVID_WITH = 1,
   DAVID_AGAINST = 2
};

enum LimniDavidMaType
{
   DAVID_SMA = 0,
   DAVID_EMA = 1,
   DAVID_SMMA = 2,
   DAVID_LWMA = 3
};

enum LimniDavidMaPrice
{
   DAVID_PRICE_CLOSE = 0,
   DAVID_PRICE_OPEN = 1,
   DAVID_PRICE_HIGH = 2,
   DAVID_PRICE_LOW = 3,
   DAVID_PRICE_MEDIAN = 4,
   DAVID_PRICE_TYPICAL = 5,
   DAVID_PRICE_WEIGHTED = 6
};

enum LimniExecutionPriceMode
{
   EXECUTION_MT5_ORDER_FILL = 0,
   EXECUTION_INTERNAL_BAR_PRICE = 1
};

input string T0 = "|--------< LimniKataraktiEA >--------|";
input bool RequireStrategyTester = true;
input bool PlaceTesterOrders = true;
input LimniExecutionPriceMode ExecutionPriceMode = EXECUTION_MT5_ORDER_FILL;
input double LotSize = 0.01;
input long MagicNumber = 960096;
input int SlippagePoints = 10;

input string T1 = "LRMG";
input int BootstrapBars = 720;
input int MedianBrickWindow = 55;
input int MaxBricksPerBar = 200;

input string T2 = "Stochastic";
input int StochKPeriod = 1000;
input int StochSlowing = 50;
input int StochDPeriod = 100;
input double Oversold = 20.0;
input double Overbought = 80.0;
input bool UseDForFilter = false;

input string T3 = "Katarakti";
input LimniKataraktiMode KataraktiMode = KTR_LOOSE;
input double ChartTimeUtcOffsetHours = 0.0; // broker/chart time minus UTC
input bool EnableLongs = true;
input bool EnableShorts = true;
input int MinSweepPoints = 0;
input int MinDisplacementBodyPoints = 0;

input string T4 = "David Direction";
input LimniDavidDirectionMode DavidMode = DAVID_OFF;
input string DavidIndicatorName = "David_MA_Color_V1f_Updated";
input int DavidMAPeriod = 35;
input LimniDavidMaType DavidMAType = DAVID_LWMA;
input LimniDavidMaPrice DavidMAPrice = DAVID_PRICE_CLOSE;
input bool DavidUseRsiFilter = true;
input int DavidRsiPeriod = 9;
input int DavidRsiOverBought = 63;
input int DavidRsiOverSold = 37;

input string T5 = "Basket";
input int AdrLookbackDays = 10;
input int AdrMinDays = 5;
input double TpAdrUnits = 0.0;
input double SlAdrUnits = 0.0;
input bool EnableGridAdds = true;
input int MaxBasketEntries = 50;
input double GridSpacingAdrUnits = 0.10;
input bool EnableTrailingStop = true;
input double TrailStartAdrUnits = 0.20;
input double TrailDistanceAdrUnits = 0.20;
input bool EnableWeeklyCutoff = false;
input int FridayCutoffHour = 16;
input int FridayCutoffMinute = 0;

input string T6 = "Multi Symbol";
input bool EnableMultiSymbol = false;
input string SymbolsCsv = "";
input bool UseDefaultFx28Symbols = true;
input bool FailIfAnySymbolUnavailable = true;
input bool RequireM1PeriodDriver = false;
input bool UseTimerPump = false;
input int TimerSeconds = 1;
input bool ExportAggregateCsv = true;

input string T7 = "Export";
input bool ExportCsv = true;
input bool ExportToCommonFiles = true;
input string OutputFolder = "LimniKataraktiEA";

CTrade g_trade;
int g_stochHandle = INVALID_HANDLE;
int g_davidHandle = INVALID_HANDLE;
datetime g_lastM1BarTime = 0;

double g_bootstrapPrices[];
int g_bootstrapCount = 0;
bool g_lrmgReady = false;
double g_lrmgQuantum = 0.0;
double g_lrmgBasePrice = 0.0;
int g_lrmgCurrentLevel = 0;
double g_closedBrickLevels[];
int g_closedBrickCount = 0;
double g_lrmgLine = 0.0;

double g_rangeAHigh = 0.0;
double g_rangeALow = 0.0;
double g_rangeBHigh = 0.0;
double g_rangeBLow = 0.0;
double g_entryBHigh = 0.0;
double g_entryBLow = 0.0;
bool g_hasRangeA = false;
bool g_hasRangeB = false;
bool g_hasEntryB = false;
int g_lastKtrDayId = 0;
bool g_lastInRangeA = false;
bool g_lastInRangeB = false;
int g_lastEntryWindow = 0;
int g_longStage = 0;
int g_shortStage = 0;
int g_longAge = 0;
int g_shortAge = 0;

bool g_basketOpen = false;
int g_basketId = 0;
int g_direction = 0;
datetime g_entryTime = 0;
double g_entryAdr = 0.0;
double g_entrySum = 0.0;
double g_avgEntry = 0.0;
double g_entryModeledPrice = 0.0;
double g_entryActualPrice = 0.0;
double g_entryAccountingPrice = 0.0;
double g_lastFillModeledPrice = 0.0;
double g_lastFillActualPrice = 0.0;
double g_lastFillAccountingPrice = 0.0;
double g_nextGridPrice = 0.0;
double g_trailStopPrice = 0.0;
double g_trailExtreme = 0.0;
int g_fillCount = 0;
double g_basketMaeAdr = 0.0;
double g_basketMfeAdr = 0.0;
double g_basketMinOpenAdr = 0.0;
double g_cachedAdr = 0.0;
int g_cachedAdrDayId = 0;
bool g_cachedAdrReady = false;

int g_basketsStarted = 0;
int g_closedBaskets = 0;
int g_wins = 0;
double g_netAdr = 0.0;
double g_terminalMarkedAdr = 0.0;
double g_totalFillCount = 0.0;
int g_maxFillCount = 0;
double g_maxOpenDrawdownAdr = 0.0;
double g_maxAdverseExcursionAdr = 0.0;
long g_totalBasketSeconds = 0;
long g_maxBasketSeconds = 0;
int g_unresolvedBaskets = 0;
int g_weeklyCutoffCloses = 0;
double g_weeklyCutoffNetAdr = 0.0;
int g_longBaskets = 0;
int g_shortBaskets = 0;
double g_longNetAdr = 0.0;
double g_shortNetAdr = 0.0;
double g_bestBasketNetAdr = -DBL_MAX;
double g_worstBasketNetAdr = DBL_MAX;
int g_bestBasketId = 0;
int g_worstBasketId = 0;
int g_sameBarTrailAmbiguousCount = 0;
int g_sameBarTpGridAmbiguousCount = 0;
int g_sameBarSlGridAmbiguousCount = 0;
int g_sameBarTpSlAmbiguousCount = 0;
int g_sameBarTpTrailAmbiguousCount = 0;
int g_sameBarSlTrailAmbiguousCount = 0;
int g_sameBarTrailArmExitCount = 0;
int g_multiGridSameBarCount = 0;

int g_lastDavidDirection = 0;
double g_lastDavidDown = EMPTY_VALUE;
double g_lastDavidUp = EMPTY_VALUE;
int g_entryDavidDirection = 0;

int g_eventsFile = INVALID_HANDLE;
int g_basketsFile = INVALID_HANDLE;
string g_runId = "";
string g_symbol = "";
double g_symbolPoint = 0.0;
int g_symbolDigits = 5;
string g_globalRunId = "";
string g_effectiveSymbolsCsv = "";
string g_symbolSource = "";
int g_aggregateSummaryFile = INVALID_HANDLE;
int g_aggregatePairFile = INVALID_HANDLE;

class KataraktiSymbolState
{
public:
   string symbol;
   double point;
   int digits;
   int stochHandle;
   int davidHandle;
   datetime lastM1BarTime;

   double bootstrapPrices[];
   int bootstrapCount;
   bool lrmgReady;
   double lrmgQuantum;
   double lrmgBasePrice;
   int lrmgCurrentLevel;
   double closedBrickLevels[];
   int closedBrickCount;
   double lrmgLine;

   double rangeAHigh;
   double rangeALow;
   double rangeBHigh;
   double rangeBLow;
   double entryBHigh;
   double entryBLow;
   bool hasRangeA;
   bool hasRangeB;
   bool hasEntryB;
   int lastKtrDayId;
   bool lastInRangeA;
   bool lastInRangeB;
   int lastEntryWindow;
   int longStage;
   int shortStage;
   int longAge;
   int shortAge;

   bool basketOpen;
   int basketId;
   int direction;
   datetime entryTime;
   double entryAdr;
   double entrySum;
   double avgEntry;
   double entryModeledPrice;
   double entryActualPrice;
   double entryAccountingPrice;
   double lastFillModeledPrice;
   double lastFillActualPrice;
   double lastFillAccountingPrice;
   double nextGridPrice;
   double trailStopPrice;
   double trailExtreme;
   int fillCount;
   double basketMaeAdr;
   double basketMfeAdr;
   double basketMinOpenAdr;
   double cachedAdr;
   int cachedAdrDayId;
   bool cachedAdrReady;

   int basketsStarted;
   int closedBaskets;
   int wins;
   double netAdr;
   double terminalMarkedAdr;
   double totalFillCount;
   int maxFillCount;
   double maxOpenDrawdownAdr;
   double maxAdverseExcursionAdr;
   long totalBasketSeconds;
   long maxBasketSeconds;
   int unresolvedBaskets;
   int weeklyCutoffCloses;
   double weeklyCutoffNetAdr;
   int longBaskets;
   int shortBaskets;
   double longNetAdr;
   double shortNetAdr;
   double bestBasketNetAdr;
   double worstBasketNetAdr;
   int bestBasketId;
   int worstBasketId;
   int sameBarTrailAmbiguousCount;
   int sameBarTpGridAmbiguousCount;
   int sameBarSlGridAmbiguousCount;
   int sameBarTpSlAmbiguousCount;
   int sameBarTpTrailAmbiguousCount;
   int sameBarSlTrailAmbiguousCount;
   int sameBarTrailArmExitCount;
   int multiGridSameBarCount;

   int lastDavidDirection;
   double lastDavidDown;
   double lastDavidUp;
   int entryDavidDirection;

   int eventsFile;
   int basketsFile;
   string runId;

   void Reset()
   {
      symbol = "";
      point = 0.0;
      digits = 5;
      stochHandle = INVALID_HANDLE;
      davidHandle = INVALID_HANDLE;
      lastM1BarTime = 0;
      ArrayResize(bootstrapPrices, 0);
      bootstrapCount = 0;
      lrmgReady = false;
      lrmgQuantum = 0.0;
      lrmgBasePrice = 0.0;
      lrmgCurrentLevel = 0;
      ArrayResize(closedBrickLevels, 0);
      closedBrickCount = 0;
      lrmgLine = 0.0;
      rangeAHigh = 0.0;
      rangeALow = 0.0;
      rangeBHigh = 0.0;
      rangeBLow = 0.0;
      entryBHigh = 0.0;
      entryBLow = 0.0;
      hasRangeA = false;
      hasRangeB = false;
      hasEntryB = false;
      lastKtrDayId = 0;
      lastInRangeA = false;
      lastInRangeB = false;
      lastEntryWindow = 0;
      longStage = 0;
      shortStage = 0;
      longAge = 0;
      shortAge = 0;
      basketOpen = false;
      basketId = 0;
      direction = 0;
      entryTime = 0;
      entryAdr = 0.0;
      entrySum = 0.0;
      avgEntry = 0.0;
      entryModeledPrice = 0.0;
      entryActualPrice = 0.0;
      entryAccountingPrice = 0.0;
      lastFillModeledPrice = 0.0;
      lastFillActualPrice = 0.0;
      lastFillAccountingPrice = 0.0;
      nextGridPrice = 0.0;
      trailStopPrice = 0.0;
      trailExtreme = 0.0;
      fillCount = 0;
      basketMaeAdr = 0.0;
      basketMfeAdr = 0.0;
      basketMinOpenAdr = 0.0;
      cachedAdr = 0.0;
      cachedAdrDayId = 0;
      cachedAdrReady = false;
      basketsStarted = 0;
      closedBaskets = 0;
      wins = 0;
      netAdr = 0.0;
      terminalMarkedAdr = 0.0;
      totalFillCount = 0.0;
      maxFillCount = 0;
      maxOpenDrawdownAdr = 0.0;
      maxAdverseExcursionAdr = 0.0;
      totalBasketSeconds = 0;
      maxBasketSeconds = 0;
      unresolvedBaskets = 0;
      weeklyCutoffCloses = 0;
      weeklyCutoffNetAdr = 0.0;
      longBaskets = 0;
      shortBaskets = 0;
      longNetAdr = 0.0;
      shortNetAdr = 0.0;
      bestBasketNetAdr = -DBL_MAX;
      worstBasketNetAdr = DBL_MAX;
      bestBasketId = 0;
      worstBasketId = 0;
      sameBarTrailAmbiguousCount = 0;
      sameBarTpGridAmbiguousCount = 0;
      sameBarSlGridAmbiguousCount = 0;
      sameBarTpSlAmbiguousCount = 0;
      sameBarTpTrailAmbiguousCount = 0;
      sameBarSlTrailAmbiguousCount = 0;
      sameBarTrailArmExitCount = 0;
      multiGridSameBarCount = 0;
      lastDavidDirection = 0;
      lastDavidDown = EMPTY_VALUE;
      lastDavidUp = EMPTY_VALUE;
      entryDavidDirection = 0;
      eventsFile = INVALID_HANDLE;
      basketsFile = INVALID_HANDLE;
      runId = "";
   }
};

KataraktiSymbolState g_states[];

string SideName(const int direction)
{
   if(direction > 0)
      return "LONG";
   if(direction < 0)
      return "SHORT";
   return "NONE";
}

string DavidModeName()
{
   if(DavidMode == DAVID_WITH)
      return "WITH";
   if(DavidMode == DAVID_AGAINST)
      return "AGAINST";
   return "OFF";
}

string ExecutionPriceModeName()
{
   if(ExecutionPriceMode == EXECUTION_INTERNAL_BAR_PRICE)
      return "INTERNAL_BAR_PRICE";
   return "MT5_ORDER_FILL";
}

string DavidDirectionName(const int direction)
{
   if(direction > 0)
      return "UP";
   if(direction < 0)
      return "DOWN";
   return "UNKNOWN";
}

bool IndicatorValueReady(const double value)
{
   return MathIsValidNumber(value) && value != EMPTY_VALUE;
}

string SafePart(string value)
{
   string out = "";
   StringToUpper(value);
   for(int i = 0; i < StringLen(value); i++)
   {
      ushort ch = (ushort)StringGetCharacter(value, i);
      bool ok = (ch >= '0' && ch <= '9') || (ch >= 'A' && ch <= 'Z') || ch == '_';
      out += ok ? ShortToString(ch) : "_";
   }
   return out == "" ? "RUN" : out;
}

string Stamp(const datetime value)
{
   return TimeToString(value, TIME_DATE | TIME_SECONDS);
}

string BuildGlobalRunId()
{
   string modeledTime = SafePart(TimeToString(TimeCurrent(), TIME_DATE | TIME_SECONDS));
   string runtimeId = IntegerToString((long)GetMicrosecondCount());
   string testerTag = ((bool)MQLInfoInteger(MQL_TESTER) || (bool)MQLInfoInteger(MQL_OPTIMIZATION)) ? "TESTER" : "RUNTIME";
   return modeledTime + "_" + testerTag + "_" + runtimeId;
}

string PriceString(const double value)
{
   int digits = g_symbolDigits;
   if(digits < 0)
      digits = 0;
   return DoubleToString(value, digits);
}

string TrimToken(const string value)
{
   int left = 0;
   int right = StringLen(value) - 1;

   while(left <= right)
   {
      ushort ch = (ushort)StringGetCharacter(value, left);
      if(ch != ' ' && ch != '\t' && ch != '\r' && ch != '\n')
         break;
      left++;
   }

   while(right >= left)
   {
      ushort ch = (ushort)StringGetCharacter(value, right);
      if(ch != ' ' && ch != '\t' && ch != '\r' && ch != '\n')
         break;
      right--;
   }

   if(right < left)
      return "";

   return StringSubstr(value, left, right - left + 1);
}

string JoinSymbols(const string &symbols[])
{
   string joined = "";
   int count = ArraySize(symbols);
   for(int i = 0; i < count; i++)
   {
      if(joined != "")
         joined += ";";
      joined += symbols[i];
   }
   return joined;
}

string ReceiptText(const string value)
{
   string safe = value;
   StringReplace(safe, ",", ";");
   return safe;
}

void LoadDefaultFx28Symbols(string &symbols[])
{
   ArrayResize(symbols, 28);
   symbols[0] = "AUDCAD.i";
   symbols[1] = "AUDCHF.i";
   symbols[2] = "AUDJPY.i";
   symbols[3] = "AUDNZD.i";
   symbols[4] = "AUDUSD.i";
   symbols[5] = "CADCHF.i";
   symbols[6] = "CADJPY.i";
   symbols[7] = "CHFJPY.i";
   symbols[8] = "EURAUD.i";
   symbols[9] = "EURCAD.i";
   symbols[10] = "EURCHF.i";
   symbols[11] = "EURGBP.i";
   symbols[12] = "EURJPY.i";
   symbols[13] = "EURNZD.i";
   symbols[14] = "EURUSD.i";
   symbols[15] = "GBPAUD.i";
   symbols[16] = "GBPCAD.i";
   symbols[17] = "GBPCHF.i";
   symbols[18] = "GBPJPY.i";
   symbols[19] = "GBPNZD.i";
   symbols[20] = "GBPUSD.i";
   symbols[21] = "NZDCAD.i";
   symbols[22] = "NZDCHF.i";
   symbols[23] = "NZDJPY.i";
   symbols[24] = "NZDUSD.i";
   symbols[25] = "USDCAD.i";
   symbols[26] = "USDCHF.i";
   symbols[27] = "USDJPY.i";
}

bool AppendSelectedSymbol(string &symbols[], const string requestedSymbol, const string sourceName)
{
   string symbol = TrimToken(requestedSymbol);
   if(symbol == "")
      return true;

   if(!SymbolSelect(symbol, true))
   {
      string message = "LimniKataraktiEA failed to select " + sourceName + " symbol " + symbol + ". error=" + IntegerToString(GetLastError());
      if(FailIfAnySymbolUnavailable)
      {
         Print(message);
         return false;
      }
      Print(message, " Skipping because FailIfAnySymbolUnavailable=false.");
      return true;
   }

   int size = ArraySize(symbols);
   ArrayResize(symbols, size + 1);
   symbols[size] = symbol;
   return true;
}

void LoadState(KataraktiSymbolState &state)
{
   g_symbol = state.symbol;
   g_symbolPoint = state.point;
   g_symbolDigits = state.digits;
   g_stochHandle = state.stochHandle;
   g_davidHandle = state.davidHandle;
   g_lastM1BarTime = state.lastM1BarTime;

   ArrayResize(g_bootstrapPrices, ArraySize(state.bootstrapPrices));
   if(ArraySize(state.bootstrapPrices) > 0)
      ArrayCopy(g_bootstrapPrices, state.bootstrapPrices);
   g_bootstrapCount = state.bootstrapCount;
   g_lrmgReady = state.lrmgReady;
   g_lrmgQuantum = state.lrmgQuantum;
   g_lrmgBasePrice = state.lrmgBasePrice;
   g_lrmgCurrentLevel = state.lrmgCurrentLevel;
   ArrayResize(g_closedBrickLevels, ArraySize(state.closedBrickLevels));
   if(ArraySize(state.closedBrickLevels) > 0)
      ArrayCopy(g_closedBrickLevels, state.closedBrickLevels);
   g_closedBrickCount = state.closedBrickCount;
   g_lrmgLine = state.lrmgLine;

   g_rangeAHigh = state.rangeAHigh;
   g_rangeALow = state.rangeALow;
   g_rangeBHigh = state.rangeBHigh;
   g_rangeBLow = state.rangeBLow;
   g_entryBHigh = state.entryBHigh;
   g_entryBLow = state.entryBLow;
   g_hasRangeA = state.hasRangeA;
   g_hasRangeB = state.hasRangeB;
   g_hasEntryB = state.hasEntryB;
   g_lastKtrDayId = state.lastKtrDayId;
   g_lastInRangeA = state.lastInRangeA;
   g_lastInRangeB = state.lastInRangeB;
   g_lastEntryWindow = state.lastEntryWindow;
   g_longStage = state.longStage;
   g_shortStage = state.shortStage;
   g_longAge = state.longAge;
   g_shortAge = state.shortAge;

   g_basketOpen = state.basketOpen;
   g_basketId = state.basketId;
   g_direction = state.direction;
   g_entryTime = state.entryTime;
   g_entryAdr = state.entryAdr;
   g_entrySum = state.entrySum;
   g_avgEntry = state.avgEntry;
   g_entryModeledPrice = state.entryModeledPrice;
   g_entryActualPrice = state.entryActualPrice;
   g_entryAccountingPrice = state.entryAccountingPrice;
   g_lastFillModeledPrice = state.lastFillModeledPrice;
   g_lastFillActualPrice = state.lastFillActualPrice;
   g_lastFillAccountingPrice = state.lastFillAccountingPrice;
   g_nextGridPrice = state.nextGridPrice;
   g_trailStopPrice = state.trailStopPrice;
   g_trailExtreme = state.trailExtreme;
   g_fillCount = state.fillCount;
   g_basketMaeAdr = state.basketMaeAdr;
   g_basketMfeAdr = state.basketMfeAdr;
   g_basketMinOpenAdr = state.basketMinOpenAdr;
   g_cachedAdr = state.cachedAdr;
   g_cachedAdrDayId = state.cachedAdrDayId;
   g_cachedAdrReady = state.cachedAdrReady;

   g_basketsStarted = state.basketsStarted;
   g_closedBaskets = state.closedBaskets;
   g_wins = state.wins;
   g_netAdr = state.netAdr;
   g_terminalMarkedAdr = state.terminalMarkedAdr;
   g_totalFillCount = state.totalFillCount;
   g_maxFillCount = state.maxFillCount;
   g_maxOpenDrawdownAdr = state.maxOpenDrawdownAdr;
   g_maxAdverseExcursionAdr = state.maxAdverseExcursionAdr;
   g_totalBasketSeconds = state.totalBasketSeconds;
   g_maxBasketSeconds = state.maxBasketSeconds;
   g_unresolvedBaskets = state.unresolvedBaskets;
   g_weeklyCutoffCloses = state.weeklyCutoffCloses;
   g_weeklyCutoffNetAdr = state.weeklyCutoffNetAdr;
   g_longBaskets = state.longBaskets;
   g_shortBaskets = state.shortBaskets;
   g_longNetAdr = state.longNetAdr;
   g_shortNetAdr = state.shortNetAdr;
   g_bestBasketNetAdr = state.bestBasketNetAdr;
   g_worstBasketNetAdr = state.worstBasketNetAdr;
   g_bestBasketId = state.bestBasketId;
   g_worstBasketId = state.worstBasketId;
   g_sameBarTrailAmbiguousCount = state.sameBarTrailAmbiguousCount;
   g_sameBarTpGridAmbiguousCount = state.sameBarTpGridAmbiguousCount;
   g_sameBarSlGridAmbiguousCount = state.sameBarSlGridAmbiguousCount;
   g_sameBarTpSlAmbiguousCount = state.sameBarTpSlAmbiguousCount;
   g_sameBarTpTrailAmbiguousCount = state.sameBarTpTrailAmbiguousCount;
   g_sameBarSlTrailAmbiguousCount = state.sameBarSlTrailAmbiguousCount;
   g_sameBarTrailArmExitCount = state.sameBarTrailArmExitCount;
   g_multiGridSameBarCount = state.multiGridSameBarCount;

   g_lastDavidDirection = state.lastDavidDirection;
   g_lastDavidDown = state.lastDavidDown;
   g_lastDavidUp = state.lastDavidUp;
   g_entryDavidDirection = state.entryDavidDirection;

   g_eventsFile = state.eventsFile;
   g_basketsFile = state.basketsFile;
   g_runId = state.runId;
}

void SaveState(KataraktiSymbolState &state)
{
   state.symbol = g_symbol;
   state.point = g_symbolPoint;
   state.digits = g_symbolDigits;
   state.stochHandle = g_stochHandle;
   state.davidHandle = g_davidHandle;
   state.lastM1BarTime = g_lastM1BarTime;

   ArrayResize(state.bootstrapPrices, ArraySize(g_bootstrapPrices));
   if(ArraySize(g_bootstrapPrices) > 0)
      ArrayCopy(state.bootstrapPrices, g_bootstrapPrices);
   state.bootstrapCount = g_bootstrapCount;
   state.lrmgReady = g_lrmgReady;
   state.lrmgQuantum = g_lrmgQuantum;
   state.lrmgBasePrice = g_lrmgBasePrice;
   state.lrmgCurrentLevel = g_lrmgCurrentLevel;
   ArrayResize(state.closedBrickLevels, ArraySize(g_closedBrickLevels));
   if(ArraySize(g_closedBrickLevels) > 0)
      ArrayCopy(state.closedBrickLevels, g_closedBrickLevels);
   state.closedBrickCount = g_closedBrickCount;
   state.lrmgLine = g_lrmgLine;

   state.rangeAHigh = g_rangeAHigh;
   state.rangeALow = g_rangeALow;
   state.rangeBHigh = g_rangeBHigh;
   state.rangeBLow = g_rangeBLow;
   state.entryBHigh = g_entryBHigh;
   state.entryBLow = g_entryBLow;
   state.hasRangeA = g_hasRangeA;
   state.hasRangeB = g_hasRangeB;
   state.hasEntryB = g_hasEntryB;
   state.lastKtrDayId = g_lastKtrDayId;
   state.lastInRangeA = g_lastInRangeA;
   state.lastInRangeB = g_lastInRangeB;
   state.lastEntryWindow = g_lastEntryWindow;
   state.longStage = g_longStage;
   state.shortStage = g_shortStage;
   state.longAge = g_longAge;
   state.shortAge = g_shortAge;

   state.basketOpen = g_basketOpen;
   state.basketId = g_basketId;
   state.direction = g_direction;
   state.entryTime = g_entryTime;
   state.entryAdr = g_entryAdr;
   state.entrySum = g_entrySum;
   state.avgEntry = g_avgEntry;
   state.entryModeledPrice = g_entryModeledPrice;
   state.entryActualPrice = g_entryActualPrice;
   state.entryAccountingPrice = g_entryAccountingPrice;
   state.lastFillModeledPrice = g_lastFillModeledPrice;
   state.lastFillActualPrice = g_lastFillActualPrice;
   state.lastFillAccountingPrice = g_lastFillAccountingPrice;
   state.nextGridPrice = g_nextGridPrice;
   state.trailStopPrice = g_trailStopPrice;
   state.trailExtreme = g_trailExtreme;
   state.fillCount = g_fillCount;
   state.basketMaeAdr = g_basketMaeAdr;
   state.basketMfeAdr = g_basketMfeAdr;
   state.basketMinOpenAdr = g_basketMinOpenAdr;
   state.cachedAdr = g_cachedAdr;
   state.cachedAdrDayId = g_cachedAdrDayId;
   state.cachedAdrReady = g_cachedAdrReady;

   state.basketsStarted = g_basketsStarted;
   state.closedBaskets = g_closedBaskets;
   state.wins = g_wins;
   state.netAdr = g_netAdr;
   state.terminalMarkedAdr = g_terminalMarkedAdr;
   state.totalFillCount = g_totalFillCount;
   state.maxFillCount = g_maxFillCount;
   state.maxOpenDrawdownAdr = g_maxOpenDrawdownAdr;
   state.maxAdverseExcursionAdr = g_maxAdverseExcursionAdr;
   state.totalBasketSeconds = g_totalBasketSeconds;
   state.maxBasketSeconds = g_maxBasketSeconds;
   state.unresolvedBaskets = g_unresolvedBaskets;
   state.weeklyCutoffCloses = g_weeklyCutoffCloses;
   state.weeklyCutoffNetAdr = g_weeklyCutoffNetAdr;
   state.longBaskets = g_longBaskets;
   state.shortBaskets = g_shortBaskets;
   state.longNetAdr = g_longNetAdr;
   state.shortNetAdr = g_shortNetAdr;
   state.bestBasketNetAdr = g_bestBasketNetAdr;
   state.worstBasketNetAdr = g_worstBasketNetAdr;
   state.bestBasketId = g_bestBasketId;
   state.worstBasketId = g_worstBasketId;
   state.sameBarTrailAmbiguousCount = g_sameBarTrailAmbiguousCount;
   state.sameBarTpGridAmbiguousCount = g_sameBarTpGridAmbiguousCount;
   state.sameBarSlGridAmbiguousCount = g_sameBarSlGridAmbiguousCount;
   state.sameBarTpSlAmbiguousCount = g_sameBarTpSlAmbiguousCount;
   state.sameBarTpTrailAmbiguousCount = g_sameBarTpTrailAmbiguousCount;
   state.sameBarSlTrailAmbiguousCount = g_sameBarSlTrailAmbiguousCount;
   state.sameBarTrailArmExitCount = g_sameBarTrailArmExitCount;
   state.multiGridSameBarCount = g_multiGridSameBarCount;

   state.lastDavidDirection = g_lastDavidDirection;
   state.lastDavidDown = g_lastDavidDown;
   state.lastDavidUp = g_lastDavidUp;
   state.entryDavidDirection = g_entryDavidDirection;

   state.eventsFile = g_eventsFile;
   state.basketsFile = g_basketsFile;
   state.runId = g_runId;
}

double SweepDepthFraction()
{
   if(KataraktiMode == KTR_EXTREME)
      return 0.12;
   if(KataraktiMode == KTR_LOOSE)
      return 0.05;
   return 0.0833333333;
}

double DisplacementBodyFraction()
{
   if(KataraktiMode == KTR_EXTREME)
      return 0.06;
   if(KataraktiMode == KTR_LOOSE)
      return 0.04;
   return 0.0666666667;
}

double CloseZoneMax()
{
   if(KataraktiMode == KTR_EXTREME)
      return 0.18;
   if(KataraktiMode == KTR_LOOSE)
      return 0.40;
   return 0.25;
}

datetime SessionTime(const datetime brokerTime)
{
   return (datetime)(brokerTime - (int)MathRound(ChartTimeUtcOffsetHours * 3600.0));
}

int DayId(const datetime value)
{
   MqlDateTime dt;
   TimeToStruct(value, dt);
   return dt.year * 10000 + dt.mon * 100 + dt.day;
}

int MinuteOfDay(const datetime value)
{
   MqlDateTime dt;
   TimeToStruct(value, dt);
   return dt.hour * 60 + dt.min;
}

bool WeeklyCutoffReached(const datetime brokerTime)
{
   if(!EnableWeeklyCutoff)
      return false;

   MqlDateTime dt;
   TimeToStruct(SessionTime(brokerTime), dt);
   int cutoff = FridayCutoffHour * 60 + FridayCutoffMinute;
   int minute = dt.hour * 60 + dt.min;
   return dt.day_of_week == 5 && minute >= cutoff;
}

bool CanStartNewBasket(const datetime brokerTime)
{
   if(!EnableWeeklyCutoff)
      return true;

   MqlDateTime dt;
   TimeToStruct(SessionTime(brokerTime), dt);
   int cutoff = FridayCutoffHour * 60 + FridayCutoffMinute;
   int minute = dt.hour * 60 + dt.min;
   if(dt.day_of_week == 5 && minute >= cutoff)
      return false;
   if(dt.day_of_week == 6)
      return false;
   return true;
}

double PathMovement(const double &values[], const int count)
{
   double movement = 0.0;
   for(int i = 1; i < count; i++)
      movement += MathAbs(values[i] - values[i - 1]);
   return movement;
}

bool PathBounds(const double &values[], const int count, double &lo, double &hi)
{
   if(count <= 0)
      return false;
   lo = values[0];
   hi = values[0];
   for(int i = 1; i < count; i++)
   {
      lo = MathMin(lo, values[i]);
      hi = MathMax(hi, values[i]);
   }
   return hi > lo;
}

double PathBelowPrice(const double &values[], const int count, const double probe)
{
   double below = 0.0;
   for(int i = 1; i < count; i++)
   {
      double a = values[i - 1];
      double b = values[i];
      double lo = MathMin(a, b);
      double hi = MathMax(a, b);
      double span = hi - lo;
      if(span <= 0.0)
         continue;
      if(probe >= hi)
         below += span;
      else if(probe > lo)
         below += probe - lo;
   }
   return below;
}

double MovementMedian(const double &values[], const int count, const double totalMovement)
{
   double lo = 0.0;
   double hi = 0.0;
   if(!PathBounds(values, count, lo, hi))
      return count > 0 ? values[0] : 0.0;

   double half = totalMovement / 2.0;
   for(int iter = 0; iter < 48; iter++)
   {
      double mid = (lo + hi) / 2.0;
      double below = PathBelowPrice(values, count, mid);
      if(below >= half)
         hi = mid;
      else
         lo = mid;
   }
   return (lo + hi) / 2.0;
}

double MovementRadius(const double &values[], const int count, const double center, const double totalMovement)
{
   if(count <= 1 || totalMovement <= 0.0)
      return 0.0;

   double integral = 0.0;
   for(int i = 1; i < count; i++)
   {
      double a = values[i - 1];
      double b = values[i];
      double lo = MathMin(a, b);
      double hi = MathMax(a, b);
      if(hi <= lo)
         continue;

      double u = hi - center;
      double v = lo - center;
      integral += (u * u * u - v * v * v) / 3.0;
   }

   if(integral <= 0.0)
      return 0.0;
   return MathSqrt(integral / totalMovement);
}

void PushClosedBrickLevel(const double level)
{
   int window = MathMax(1, MedianBrickWindow);
   if(g_closedBrickCount < window)
   {
      ArrayResize(g_closedBrickLevels, g_closedBrickCount + 1);
      g_closedBrickLevels[g_closedBrickCount] = level;
      g_closedBrickCount++;
      return;
   }

   for(int i = 1; i < g_closedBrickCount; i++)
      g_closedBrickLevels[i - 1] = g_closedBrickLevels[i];
   g_closedBrickLevels[g_closedBrickCount - 1] = level;
}

double MedianClosedBrickLevel()
{
   if(g_closedBrickCount <= 0)
      return 0.0;

   double sample[];
   ArrayResize(sample, g_closedBrickCount);
   for(int i = 0; i < g_closedBrickCount; i++)
      sample[i] = g_closedBrickLevels[i];
   ArraySort(sample);

   int mid = g_closedBrickCount / 2;
   if((g_closedBrickCount % 2) == 1)
      return sample[mid];
   return (sample[mid - 1] + sample[mid]) / 2.0;
}

void UpdateLrmg(const double closePrice)
{
   if(!g_lrmgReady)
   {
      int bootstrap = MathMax(50, BootstrapBars);
      ArrayResize(g_bootstrapPrices, g_bootstrapCount + 1);
      g_bootstrapPrices[g_bootstrapCount] = closePrice;
      g_bootstrapCount++;

      if(g_bootstrapCount >= bootstrap)
      {
         double movement = PathMovement(g_bootstrapPrices, g_bootstrapCount);
         double center = MovementMedian(g_bootstrapPrices, g_bootstrapCount, movement);
         double radius = MovementRadius(g_bootstrapPrices, g_bootstrapCount, center, movement);
         if(radius > 0.0 && MathIsValidNumber(radius))
         {
            g_lrmgReady = true;
            g_lrmgQuantum = radius;
            g_lrmgBasePrice = g_bootstrapPrices[0];
            g_lrmgCurrentLevel = 0;
            g_lrmgLine = g_lrmgBasePrice;
         }
      }
      return;
   }

   int guard = 0;
   int maxBricks = MathMax(1, MaxBricksPerBar);
   while(closePrice >= g_lrmgBasePrice + ((double)g_lrmgCurrentLevel + 1.0) * g_lrmgQuantum && guard < maxBricks)
   {
      g_lrmgCurrentLevel++;
      PushClosedBrickLevel((double)g_lrmgCurrentLevel);
      guard++;
   }

   guard = 0;
   while(closePrice <= g_lrmgBasePrice + ((double)g_lrmgCurrentLevel - 1.0) * g_lrmgQuantum && guard < maxBricks)
   {
      g_lrmgCurrentLevel--;
      PushClosedBrickLevel((double)g_lrmgCurrentLevel);
      guard++;
   }

   g_lrmgLine = g_lrmgBasePrice + MedianClosedBrickLevel() * g_lrmgQuantum;
}

bool DisplacementPass(const bool isLong, const MqlRates &bar, const double requiredBody)
{
   double candleRange = bar.high - bar.low;
   if(candleRange <= 0.0)
      return false;

   double body = MathAbs(bar.close - bar.open);
   bool correctDirection = isLong ? bar.close > bar.open : bar.close < bar.open;
   if(!correctDirection || body + g_symbolPoint * 0.1 < requiredBody)
      return false;

   double closeZone = isLong ? (bar.high - bar.close) / candleRange : (bar.close - bar.low) / candleRange;
   return closeZone <= CloseZoneMax();
}

void ResetKataraktiStages()
{
   g_longStage = 0;
   g_shortStage = 0;
   g_longAge = 0;
   g_shortAge = 0;
}

void UpdateKatarakti(const MqlRates &bar, bool &ktrLong, bool &ktrShort)
{
   ktrLong = false;
   ktrShort = false;

   datetime sessionTime = SessionTime(bar.time);
   int tod = MinuteOfDay(sessionTime);
   int dayId = DayId(sessionTime);

   bool inRangeA = tod >= 0 && tod < 13 * 60;
   bool inEntryA = tod >= 13 * 60 && tod < 21 * 60;
   bool inRangeB = tod >= 13 * 60 && tod < 21 * 60;
   bool inEntryB = tod >= 0 && tod < 13 * 60;
   bool newDay = g_lastKtrDayId != 0 && dayId != g_lastKtrDayId;
   bool rangeAStart = inRangeA && !g_lastInRangeA;
   bool rangeBStart = inRangeB && !g_lastInRangeB;

   if(newDay)
   {
      g_entryBHigh = g_rangeBHigh;
      g_entryBLow = g_rangeBLow;
      g_hasEntryB = g_hasRangeB;
      g_hasRangeA = false;
      g_hasRangeB = false;
      g_rangeAHigh = 0.0;
      g_rangeALow = 0.0;
      g_rangeBHigh = 0.0;
      g_rangeBLow = 0.0;
   }

   if(rangeAStart)
   {
      g_hasRangeA = false;
      g_rangeAHigh = 0.0;
      g_rangeALow = 0.0;
   }

   if(rangeBStart)
   {
      g_hasRangeB = false;
      g_rangeBHigh = 0.0;
      g_rangeBLow = 0.0;
   }

   if(inRangeA)
   {
      g_rangeAHigh = !g_hasRangeA ? bar.high : MathMax(g_rangeAHigh, bar.high);
      g_rangeALow = !g_hasRangeA ? bar.low : MathMin(g_rangeALow, bar.low);
      g_hasRangeA = true;
   }

   if(inRangeB)
   {
      g_rangeBHigh = !g_hasRangeB ? bar.high : MathMax(g_rangeBHigh, bar.high);
      g_rangeBLow = !g_hasRangeB ? bar.low : MathMin(g_rangeBLow, bar.low);
      g_hasRangeB = true;
   }

   bool activeEntry = inEntryA || inEntryB;
   int activeWindow = inEntryA ? 1 : (inEntryB ? 2 : 0);
   bool hasActiveRange = inEntryA ? g_hasRangeA : (inEntryB ? g_hasEntryB : false);
   double activeHigh = inEntryA ? g_rangeAHigh : (inEntryB ? g_entryBHigh : 0.0);
   double activeLow = inEntryA ? g_rangeALow : (inEntryB ? g_entryBLow : 0.0);
   bool activeRangeReady = activeEntry && hasActiveRange && activeHigh > activeLow;

   if(!activeEntry || activeWindow != g_lastEntryWindow)
      ResetKataraktiStages();
   g_lastEntryWindow = activeWindow;

   if(activeRangeReady)
   {
      if(g_longStage > 0)
      {
         g_longAge++;
         if(g_longAge > 1)
         {
            g_longStage = 0;
            g_longAge = 0;
         }
      }

      if(g_shortStage > 0)
      {
         g_shortAge++;
         if(g_shortAge > 1)
         {
            g_shortStage = 0;
            g_shortAge = 0;
         }
      }

      double activeRange = activeHigh - activeLow;
      double requiredSweep = MathMax(MinSweepPoints * g_symbolPoint, activeRange * SweepDepthFraction());
      double requiredBody = MathMax(MinDisplacementBodyPoints * g_symbolPoint, activeRange * DisplacementBodyFraction());

      if(bar.low <= activeLow - requiredSweep)
      {
         g_longStage = 1;
         g_longAge = 0;
      }

      if(bar.high >= activeHigh + requiredSweep)
      {
         g_shortStage = 1;
         g_shortAge = 0;
      }

      if(g_longStage == 1 && bar.close > activeLow)
      {
         g_longStage = 2;
         g_longAge = 0;
      }

      if(g_shortStage == 1 && bar.close < activeHigh)
      {
         g_shortStage = 2;
         g_shortAge = 0;
      }

      if(g_longStage == 2 && DisplacementPass(true, bar, requiredBody))
      {
         ktrLong = true;
         g_longStage = 0;
         g_longAge = 0;
      }

      if(g_shortStage == 2 && DisplacementPass(false, bar, requiredBody))
      {
         ktrShort = true;
         g_shortStage = 0;
         g_shortAge = 0;
      }
   }

   g_lastKtrDayId = dayId;
   g_lastInRangeA = inRangeA;
   g_lastInRangeB = inRangeB;
}

bool CurrentAdr(const datetime brokerTime, double &adr)
{
   adr = 0.0;
   int dayId = DayId(brokerTime);
   if(g_cachedAdrReady && g_cachedAdrDayId == dayId && g_cachedAdr > 0.0)
   {
      adr = g_cachedAdr;
      return true;
   }

   MqlRates rates[];
   ArraySetAsSeries(rates, true);
   int lookback = MathMax(1, AdrLookbackDays);
   int copied = CopyRates(g_symbol, PERIOD_D1, 1, lookback, rates);
   if(copied < AdrMinDays)
   {
      g_cachedAdrReady = false;
      g_cachedAdrDayId = dayId;
      g_cachedAdr = 0.0;
      return false;
   }

   double sum = 0.0;
   int used = 0;
   for(int i = 0; i < copied; i++)
   {
      double range = rates[i].high - rates[i].low;
      if(range > 0.0)
      {
         sum += range;
         used++;
      }
   }

   if(used < AdrMinDays)
   {
      g_cachedAdrReady = false;
      g_cachedAdrDayId = dayId;
      g_cachedAdr = 0.0;
      return false;
   }

   adr = sum / used;
   g_cachedAdr = adr;
   g_cachedAdrDayId = dayId;
   g_cachedAdrReady = adr > 0.0;
   return g_cachedAdrReady;
}

bool CurrentStoch(double &value)
{
   value = 0.0;
   if(g_stochHandle == INVALID_HANDLE)
      return false;

   double buffer[];
   ArraySetAsSeries(buffer, true);
   int line = UseDForFilter ? 1 : 0;
   if(CopyBuffer(g_stochHandle, line, 1, 1, buffer) != 1)
      return false;

   if(!MathIsValidNumber(buffer[0]) || buffer[0] == EMPTY_VALUE)
      return false;

   value = buffer[0];
   return true;
}

bool CurrentDavidDirection(int &direction)
{
   direction = 0;
   g_lastDavidDirection = 0;
   g_lastDavidDown = EMPTY_VALUE;
   g_lastDavidUp = EMPTY_VALUE;

   if(DavidMode == DAVID_OFF)
      return true;

   if(g_davidHandle == INVALID_HANDLE)
      return false;

   double downBuffer[];
   double upBuffer[];
   ArraySetAsSeries(downBuffer, true);
   ArraySetAsSeries(upBuffer, true);

   bool copiedDown = CopyBuffer(g_davidHandle, 0, 1, 1, downBuffer) == 1;
   bool copiedUp = CopyBuffer(g_davidHandle, 1, 1, 1, upBuffer) == 1;
   if(copiedDown)
      g_lastDavidDown = downBuffer[0];
   if(copiedUp)
      g_lastDavidUp = upBuffer[0];

   if(copiedDown && IndicatorValueReady(downBuffer[0]))
      direction = -1;
   else if(copiedUp && IndicatorValueReady(upBuffer[0]))
      direction = 1;
   else
      return false;

   g_lastDavidDirection = direction;
   return true;
}

bool DavidAllowsDirection(const int tradeDirection, const int davidDirection)
{
   if(DavidMode == DAVID_OFF)
      return true;
   if(davidDirection == 0)
      return false;
   if(DavidMode == DAVID_WITH)
      return tradeDirection == davidDirection;
   if(DavidMode == DAVID_AGAINST)
      return tradeDirection == -davidDirection;
   return true;
}

void OpenCsvFiles()
{
   if(!ExportCsv)
      return;

   int fileScope = ExportToCommonFiles ? FILE_COMMON : 0;
   FolderCreate(OutputFolder, fileScope);
   if(g_globalRunId == "")
      g_globalRunId = BuildGlobalRunId();
   g_runId = SafePart(g_symbol) + "_" + g_globalRunId;

   string eventsName = OutputFolder + "\\" + g_runId + "_events.csv";
   string basketsName = OutputFolder + "\\" + g_runId + "_baskets.csv";

   g_eventsFile = FileOpen(eventsName, FILE_WRITE | FILE_CSV | FILE_ANSI | fileScope, ',');
   if(g_eventsFile != INVALID_HANDLE)
   {
      FileWrite(
         g_eventsFile,
         "time",
         "symbol",
         "event",
         "side",
         "price",
         "modeled_price",
         "actual_price",
         "accounting_price",
         "execution_price_mode",
         "actual_minus_modeled_price",
         "adr",
         "lrmg_line",
         "stoch",
         "david_mode",
         "david_direction",
         "david_down",
         "david_up",
         "fills",
         "avg_entry",
         "open_adr",
         "net_adr",
         "reason"
       );
       FileFlush(g_eventsFile);
    }

   g_basketsFile = FileOpen(basketsName, FILE_WRITE | FILE_CSV | FILE_ANSI | fileScope, ',');
   if(g_basketsFile != INVALID_HANDLE)
   {
      FileWrite(
         g_basketsFile,
         "basket_id",
         "symbol",
         "side",
         "entry_time",
         "exit_time",
         "david_mode",
         "david_direction_at_entry",
         "entry_adr",
         "fills",
         "avg_entry",
         "exit_price",
         "entry_modeled_price",
         "entry_actual_price",
         "entry_accounting_price",
         "last_fill_modeled_price",
         "last_fill_actual_price",
         "last_fill_accounting_price",
         "exit_modeled_price",
         "exit_actual_price",
         "exit_accounting_price",
         "execution_price_mode",
         "net_adr",
         "mae_adr",
         "mfe_adr",
         "duration_minutes",
         "close_reason"
       );
       FileFlush(g_basketsFile);
    }
}

void CloseCsvFiles()
{
   if(g_eventsFile != INVALID_HANDLE)
   {
      FileFlush(g_eventsFile);
      FileClose(g_eventsFile);
      g_eventsFile = INVALID_HANDLE;
   }

   if(g_basketsFile != INVALID_HANDLE)
   {
      FileFlush(g_basketsFile);
      FileClose(g_basketsFile);
      g_basketsFile = INVALID_HANDLE;
   }
}

void LogEventDetailed(
   const datetime t,
   const string eventName,
   const int side,
   const double price,
   const double adr,
   const double stoch,
   const double openAdr,
   const string reason,
   const bool hasExecutionReceipt,
   const double modeledPrice,
   const double actualPrice,
   const double accountingPrice
)
{
   if(g_eventsFile == INVALID_HANDLE)
      return;

   string modeledPriceText = hasExecutionReceipt ? PriceString(modeledPrice) : "";
   string actualPriceText = hasExecutionReceipt ? PriceString(actualPrice) : "";
   string accountingPriceText = hasExecutionReceipt ? PriceString(accountingPrice) : "";
   string actualMinusModeledText = hasExecutionReceipt ? PriceString(actualPrice - modeledPrice) : "";

   FileWrite(
      g_eventsFile,
      Stamp(t),
      g_symbol,
      eventName,
      SideName(side),
      PriceString(price),
      modeledPriceText,
      actualPriceText,
      accountingPriceText,
      ExecutionPriceModeName(),
      actualMinusModeledText,
      PriceString(adr),
      g_lrmgReady ? PriceString(g_lrmgLine) : "",
      (stoch != EMPTY_VALUE && MathIsValidNumber(stoch)) ? DoubleToString(stoch, 4) : "",
      DavidModeName(),
      DavidDirectionName(g_lastDavidDirection),
      IndicatorValueReady(g_lastDavidDown) ? PriceString(g_lastDavidDown) : "",
      IndicatorValueReady(g_lastDavidUp) ? PriceString(g_lastDavidUp) : "",
      g_fillCount,
      g_basketOpen ? PriceString(g_avgEntry) : "",
      (openAdr != EMPTY_VALUE && MathIsValidNumber(openAdr)) ? DoubleToString(openAdr, 6) : "",
      DoubleToString(g_netAdr, 6),
      reason
   );
}

void LogEvent(
   const datetime t,
   const string eventName,
   const int side,
   const double price,
   const double adr,
   const double stoch,
   const double openAdr,
   const string reason
)
{
   LogEventDetailed(t, eventName, side, price, adr, stoch, openAdr, reason, false, 0.0, 0.0, 0.0);
}

bool SendTesterOrder(const int direction, const double modeledPrice, double &actualPrice)
{
   actualPrice = modeledPrice;

   MqlTick tick;
   if(SymbolInfoTick(g_symbol, tick))
      actualPrice = direction > 0 ? tick.ask : tick.bid;

   if(!PlaceTesterOrders)
   {
      actualPrice = modeledPrice;
      return true;
   }

   bool isTester = (bool)MQLInfoInteger(MQL_TESTER) || (bool)MQLInfoInteger(MQL_OPTIMIZATION);
   if(!isTester)
      return false;

   bool ok = direction > 0
      ? g_trade.Buy(LotSize, g_symbol, 0.0, 0.0, 0.0, "LimniKataraktiEA")
      : g_trade.Sell(LotSize, g_symbol, 0.0, 0.0, 0.0, "LimniKataraktiEA");

   if(!ok)
   {
      Print("LimniKataraktiEA order failed retcode=", g_trade.ResultRetcode(), " error=", GetLastError());
      return false;
   }

   double resultPrice = g_trade.ResultPrice();
   if(resultPrice > 0.0)
      actualPrice = resultPrice;
   return true;
}

bool CloseTesterPositions(double &averageClosePrice, int &closedPositions)
{
   averageClosePrice = 0.0;
   closedPositions = 0;
   if(!PlaceTesterOrders)
      return false;

   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0 || !PositionSelectByTicket(ticket))
         continue;
      if(PositionGetString(POSITION_SYMBOL) != g_symbol)
         continue;
      if((long)PositionGetInteger(POSITION_MAGIC) != MagicNumber)
         continue;

      if(!g_trade.PositionClose(ticket))
      {
         Print("LimniKataraktiEA close failed ticket=", ticket, " retcode=", g_trade.ResultRetcode(), " error=", GetLastError());
         continue;
      }

      double resultPrice = g_trade.ResultPrice();
      if(resultPrice > 0.0)
      {
         averageClosePrice += resultPrice;
         closedPositions++;
      }
   }

   if(closedPositions <= 0)
      return false;

   averageClosePrice /= (double)closedPositions;
   return true;
}

double BasketOpenAdrAtPrice(const double price)
{
   if(!g_basketOpen || g_entryAdr <= 0.0 || g_fillCount <= 0)
      return 0.0;

   if(g_direction > 0)
      return (price * g_fillCount - g_entrySum) / g_entryAdr;
   return (g_entrySum - price * g_fillCount) / g_entryAdr;
}

void RecordBasketRow(
   const datetime exitTime,
   const double exitPrice,
   const double exitActualPrice,
   const bool hasExitExecutionReceipt,
   const double closedAdr,
   const string reason
)
{
   if(g_basketsFile == INVALID_HANDLE)
      return;

   long durationSeconds = (long)(exitTime - g_entryTime);
   double exitAccountingPrice = exitPrice;
   FileWrite(
      g_basketsFile,
      g_basketId,
      g_symbol,
      SideName(g_direction),
      Stamp(g_entryTime),
      Stamp(exitTime),
      DavidModeName(),
      DavidDirectionName(g_entryDavidDirection),
      PriceString(g_entryAdr),
      g_fillCount,
      PriceString(g_avgEntry),
      PriceString(exitPrice),
      PriceString(g_entryModeledPrice),
      PriceString(g_entryActualPrice),
      PriceString(g_entryAccountingPrice),
      PriceString(g_lastFillModeledPrice),
      PriceString(g_lastFillActualPrice),
      PriceString(g_lastFillAccountingPrice),
      PriceString(exitPrice),
      hasExitExecutionReceipt ? PriceString(exitActualPrice) : "",
      PriceString(exitAccountingPrice),
      ExecutionPriceModeName(),
      DoubleToString(closedAdr, 6),
      DoubleToString(g_basketMaeAdr, 6),
      DoubleToString(g_basketMfeAdr, 6),
      DoubleToString((double)durationSeconds / 60.0, 2),
      reason
   );
}

void ResetBasket()
{
   g_basketOpen = false;
   g_direction = 0;
   g_entryTime = 0;
   g_entryAdr = 0.0;
   g_entrySum = 0.0;
   g_avgEntry = 0.0;
   g_entryModeledPrice = 0.0;
   g_entryActualPrice = 0.0;
   g_entryAccountingPrice = 0.0;
   g_lastFillModeledPrice = 0.0;
   g_lastFillActualPrice = 0.0;
   g_lastFillAccountingPrice = 0.0;
   g_nextGridPrice = 0.0;
   g_trailStopPrice = 0.0;
   g_trailExtreme = 0.0;
   g_fillCount = 0;
   g_basketMaeAdr = 0.0;
   g_basketMfeAdr = 0.0;
   g_basketMinOpenAdr = 0.0;
   g_entryDavidDirection = 0;
}

bool AddBasketFill(const datetime t, const int direction, const double requestedPrice, const double adr, const string reason)
{
   double modeledFillPrice = requestedPrice;
   double actualFillPrice = modeledFillPrice;
   if(!SendTesterOrder(direction, modeledFillPrice, actualFillPrice))
      return false;

   double accountingFillPrice = ExecutionPriceMode == EXECUTION_INTERNAL_BAR_PRICE ? modeledFillPrice : actualFillPrice;

   if(!g_basketOpen)
   {
      g_basketId++;
      g_basketsStarted++;
      g_basketOpen = true;
      g_direction = direction;
      g_entryTime = t;
      g_entryAdr = adr;
      g_entrySum = 0.0;
      g_fillCount = 0;
      g_entryModeledPrice = modeledFillPrice;
      g_entryActualPrice = actualFillPrice;
      g_entryAccountingPrice = accountingFillPrice;
      g_lastFillModeledPrice = modeledFillPrice;
      g_lastFillActualPrice = actualFillPrice;
      g_lastFillAccountingPrice = accountingFillPrice;
      g_basketMaeAdr = 0.0;
      g_basketMfeAdr = 0.0;
      g_basketMinOpenAdr = 0.0;
      g_entryDavidDirection = g_lastDavidDirection;
      g_trailStopPrice = 0.0;
      g_trailExtreme = 0.0;
   }

   g_entrySum += accountingFillPrice;
   g_fillCount++;
   g_avgEntry = g_entrySum / (double)g_fillCount;
   g_lastFillModeledPrice = modeledFillPrice;
   g_lastFillActualPrice = actualFillPrice;
   g_lastFillAccountingPrice = accountingFillPrice;

   if(EnableGridAdds && g_fillCount < MathMax(1, MaxBasketEntries))
      g_nextGridPrice = g_direction > 0 ? accountingFillPrice - g_entryAdr * GridSpacingAdrUnits : accountingFillPrice + g_entryAdr * GridSpacingAdrUnits;
   else
      g_nextGridPrice = 0.0;

   LogEventDetailed(
      t,
      reason == "entry" ? "ENTRY" : "GRID_ADD",
      direction,
      accountingFillPrice,
      adr,
      EMPTY_VALUE,
      BasketOpenAdrAtPrice(accountingFillPrice),
      reason,
      true,
      modeledFillPrice,
      actualFillPrice,
      accountingFillPrice
   );
   return true;
}

void CloseBasket(const datetime t, const double exitPrice, const string reason)
{
   if(!g_basketOpen)
      return;

   double closedAdr = BasketOpenAdrAtPrice(exitPrice);
   g_netAdr += closedAdr;
   g_closedBaskets++;
   if(closedAdr >= 0.0)
      g_wins++;

   if(g_direction > 0)
   {
      g_longBaskets++;
      g_longNetAdr += closedAdr;
   }
   else if(g_direction < 0)
   {
      g_shortBaskets++;
      g_shortNetAdr += closedAdr;
   }

   if(closedAdr > g_bestBasketNetAdr)
   {
      g_bestBasketNetAdr = closedAdr;
      g_bestBasketId = g_basketId;
   }

   if(closedAdr < g_worstBasketNetAdr)
   {
      g_worstBasketNetAdr = closedAdr;
      g_worstBasketId = g_basketId;
   }

   g_totalFillCount += g_fillCount;
   if(g_fillCount > g_maxFillCount)
      g_maxFillCount = g_fillCount;

   double adverse = -g_basketMaeAdr;
   if(adverse > g_maxAdverseExcursionAdr)
      g_maxAdverseExcursionAdr = adverse;
   if(g_basketMinOpenAdr < g_maxOpenDrawdownAdr)
      g_maxOpenDrawdownAdr = g_basketMinOpenAdr;

   long durationSeconds = (long)(t - g_entryTime);
   g_totalBasketSeconds += durationSeconds;
   if(durationSeconds > g_maxBasketSeconds)
      g_maxBasketSeconds = durationSeconds;

   if(reason == "weekly_cutoff")
   {
      g_weeklyCutoffCloses++;
      g_weeklyCutoffNetAdr += closedAdr;
   }

   double actualExitPrice = exitPrice;
   int actualExitCount = 0;
   bool hasExitExecutionReceipt = false;
   if(PlaceTesterOrders)
      hasExitExecutionReceipt = CloseTesterPositions(actualExitPrice, actualExitCount);
   else
      hasExitExecutionReceipt = true;

   RecordBasketRow(t, exitPrice, actualExitPrice, hasExitExecutionReceipt, closedAdr, reason);
   LogEventDetailed(
      t,
      "EXIT",
      g_direction,
      exitPrice,
      g_entryAdr,
      EMPTY_VALUE,
      closedAdr,
      reason,
      hasExitExecutionReceipt,
      exitPrice,
      actualExitPrice,
      exitPrice
   );
   ResetBasket();
}

void UpdateBasketExcursion(const MqlRates &bar)
{
   if(!g_basketOpen)
      return;

   double worst = g_direction > 0 ? BasketOpenAdrAtPrice(bar.low) : BasketOpenAdrAtPrice(bar.high);
   double best = g_direction > 0 ? BasketOpenAdrAtPrice(bar.high) : BasketOpenAdrAtPrice(bar.low);
   double closeAdr = BasketOpenAdrAtPrice(bar.close);

   if(worst < g_basketMaeAdr)
      g_basketMaeAdr = worst;
   if(best > g_basketMfeAdr)
      g_basketMfeAdr = best;
   if(closeAdr < g_basketMinOpenAdr)
      g_basketMinOpenAdr = closeAdr;
}

void ManageBasketOnBar(const MqlRates &bar)
{
   if(!g_basketOpen || g_entryAdr <= 0.0)
      return;

   UpdateBasketExcursion(bar);

   if(WeeklyCutoffReached(bar.time))
   {
      CloseBasket(bar.time, bar.close, "weekly_cutoff");
      return;
   }

   bool trailWasArmed = g_trailStopPrice > 0.0;
   if(EnableTrailingStop && TrailDistanceAdrUnits > 0.0)
   {
      if(g_direction > 0)
      {
         if(bar.high >= g_avgEntry + g_entryAdr * TrailStartAdrUnits)
         {
            if(g_trailExtreme <= 0.0 || bar.high > g_trailExtreme)
               g_trailExtreme = bar.high;
            g_trailStopPrice = g_trailExtreme - g_entryAdr * TrailDistanceAdrUnits;
         }
      }
      else
      {
         if(bar.low <= g_avgEntry - g_entryAdr * TrailStartAdrUnits)
         {
            if(g_trailExtreme <= 0.0 || bar.low < g_trailExtreme)
               g_trailExtreme = bar.low;
            g_trailStopPrice = g_trailExtreme + g_entryAdr * TrailDistanceAdrUnits;
         }
      }
   }
   bool trailArmedThisBar = !trailWasArmed && g_trailStopPrice > 0.0;

   bool tpTouched = false;
   bool slTouched = false;
   bool trailTouched = false;
   double tpPrice = 0.0;
   double slPrice = 0.0;
   double exitPrice = 0.0;
   string reason = "";

   if(TpAdrUnits > 0.0)
   {
      tpPrice = g_direction > 0 ? g_avgEntry + g_entryAdr * TpAdrUnits : g_avgEntry - g_entryAdr * TpAdrUnits;
      tpTouched = g_direction > 0 ? bar.high >= tpPrice : bar.low <= tpPrice;
      if(tpTouched)
      {
         exitPrice = tpPrice;
         reason = "tp";
      }
   }

   if(SlAdrUnits > 0.0)
   {
      slPrice = g_direction > 0 ? g_avgEntry - g_entryAdr * SlAdrUnits : g_avgEntry + g_entryAdr * SlAdrUnits;
      slTouched = g_direction > 0 ? bar.low <= slPrice : bar.high >= slPrice;
      if(reason == "" && slTouched)
      {
         exitPrice = slPrice;
         reason = "sl";
      }
   }

   if(g_trailStopPrice > 0.0)
   {
      trailTouched = g_direction > 0 ? bar.low <= g_trailStopPrice : bar.high >= g_trailStopPrice;
      if(reason == "" && trailTouched)
      {
         exitPrice = g_trailStopPrice;
         reason = "trail";
      }
   }

   if(reason != "")
   {
      bool adverseGridAlsoHit = EnableGridAdds && g_nextGridPrice > 0.0 && g_fillCount < MathMax(1, MaxBasketEntries)
         && (g_direction > 0 ? bar.low <= g_nextGridPrice : bar.high >= g_nextGridPrice);
      if(tpTouched && slTouched)
         g_sameBarTpSlAmbiguousCount++;
      if(reason == "tp" && trailTouched)
         g_sameBarTpTrailAmbiguousCount++;
      if(reason == "sl" && trailTouched)
         g_sameBarSlTrailAmbiguousCount++;
      if(reason == "tp" && adverseGridAlsoHit)
         g_sameBarTpGridAmbiguousCount++;
      if(reason == "sl" && adverseGridAlsoHit)
         g_sameBarSlGridAmbiguousCount++;
      if(reason == "trail" && adverseGridAlsoHit)
         g_sameBarTrailAmbiguousCount++;
      if(reason == "trail" && trailArmedThisBar)
         g_sameBarTrailArmExitCount++;
      CloseBasket(bar.time, exitPrice, reason);
      return;
   }

   if(EnableGridAdds && g_nextGridPrice > 0.0 && g_fillCount < MathMax(1, MaxBasketEntries))
   {
      double step = g_entryAdr * GridSpacingAdrUnits;
      int guard = 0;
      int fillsThisBar = 0;
      while(g_basketOpen && g_fillCount < MathMax(1, MaxBasketEntries) && g_nextGridPrice > 0.0 && guard < MaxBasketEntries)
      {
         bool hit = g_direction > 0 ? bar.low <= g_nextGridPrice : bar.high >= g_nextGridPrice;
         if(!hit)
            break;

         double gridPrice = g_nextGridPrice;
         if(!AddBasketFill(bar.time, g_direction, gridPrice, g_entryAdr, "grid_add"))
            break;

         if(g_fillCount < MathMax(1, MaxBasketEntries))
            g_nextGridPrice = g_direction > 0 ? gridPrice - step : gridPrice + step;
         else
            g_nextGridPrice = 0.0;
         guard++;
         fillsThisBar++;
      }
      if(fillsThisBar > 1)
         g_multiGridSameBarCount++;
   }
}

void ProcessClosedM1Bar(const MqlRates &bar)
{
   ManageBasketOnBar(bar);

   UpdateLrmg(bar.close);
   bool ktrLong = false;
   bool ktrShort = false;
   UpdateKatarakti(bar, ktrLong, ktrShort);

   double adr = 0.0;
   double stoch = 0.0;
   int davidDirection = 0;
   bool stochReady = CurrentStoch(stoch);
   bool davidReady = CurrentDavidDirection(davidDirection);
   bool belowLrmg = g_lrmgReady && bar.close < g_lrmgLine;
   bool aboveLrmg = g_lrmgReady && bar.close > g_lrmgLine;

   bool buyRawSignal = EnableLongs && ktrLong && belowLrmg && stochReady && stoch <= Oversold;
   bool sellRawSignal = EnableShorts && ktrShort && aboveLrmg && stochReady && stoch >= Overbought;
   bool buySignal = buyRawSignal && davidReady && DavidAllowsDirection(1, davidDirection);
   bool sellSignal = sellRawSignal && davidReady && DavidAllowsDirection(-1, davidDirection);
   bool rawSignal = buyRawSignal || sellRawSignal;
   bool adrReady = rawSignal ? CurrentAdr(bar.time, adr) : false;

   if(buyRawSignal && adrReady)
      LogEvent(bar.time, buySignal ? "BUY_SIGNAL" : "BUY_BLOCKED_DAVID", 1, bar.close, adr, stoch, 0.0, buySignal ? "signal" : "david_blocked");
   if(sellRawSignal && adrReady)
      LogEvent(bar.time, sellSignal ? "SELL_SIGNAL" : "SELL_BLOCKED_DAVID", -1, bar.close, adr, stoch, 0.0, sellSignal ? "signal" : "david_blocked");

   if(g_basketOpen || !adrReady || !CanStartNewBasket(bar.time))
      return;

   if(buySignal)
      AddBasketFill(bar.time, 1, bar.close, adr, "entry");
   else if(sellSignal)
      AddBasketFill(bar.time, -1, bar.close, adr, "entry");
}

void WriteSummary()
{
   if(!ExportCsv)
      return;

   int fileScope = ExportToCommonFiles ? FILE_COMMON : 0;
   FolderCreate(OutputFolder, fileScope);
   string summaryName = OutputFolder + "\\" + g_runId + "_summary.csv";
   int handle = FileOpen(summaryName, FILE_WRITE | FILE_CSV | FILE_ANSI | fileScope, ',');
   if(handle == INVALID_HANDLE)
      return;

   double winRate = g_closedBaskets > 0 ? (double)g_wins * 100.0 / (double)g_closedBaskets : 0.0;
   double avgFills = g_closedBaskets > 0 ? g_totalFillCount / (double)g_closedBaskets : 0.0;
   double avgMinutes = g_closedBaskets > 0 ? ((double)g_totalBasketSeconds / 60.0) / (double)g_closedBaskets : 0.0;
   double maxMinutes = (double)g_maxBasketSeconds / 60.0;
   double closedPlusMarked = g_netAdr + g_terminalMarkedAdr;

   FileWrite(handle, "metric", "value");
   FileWrite(handle, "symbol", g_symbol);
   FileWrite(handle, "run_id", g_runId);
   FileWrite(handle, "global_run_id", g_globalRunId);
   FileWrite(handle, "symbol_point", DoubleToString(g_symbolPoint, 12));
   FileWrite(handle, "symbol_digits", g_symbolDigits);
   FileWrite(handle, "closed_baskets", g_closedBaskets);
   FileWrite(handle, "closed_net_adr", DoubleToString(g_netAdr, 6));
   FileWrite(handle, "terminal_marked_adr", DoubleToString(g_terminalMarkedAdr, 6));
   FileWrite(handle, "closed_plus_marked_net_adr", DoubleToString(closedPlusMarked, 6));
   FileWrite(handle, "net_adr", DoubleToString(g_netAdr, 6));
   FileWrite(handle, "win_rate_pct", DoubleToString(winRate, 4));
   FileWrite(handle, "max_open_drawdown_adr", DoubleToString(g_maxOpenDrawdownAdr, 6));
   FileWrite(handle, "max_adverse_excursion_adr", DoubleToString(g_maxAdverseExcursionAdr, 6));
   FileWrite(handle, "max_basket_fill_count", g_maxFillCount);
   FileWrite(handle, "average_fill_count", DoubleToString(avgFills, 4));
   FileWrite(handle, "max_time_in_basket_minutes", DoubleToString(maxMinutes, 2));
   FileWrite(handle, "average_time_in_basket_minutes", DoubleToString(avgMinutes, 2));
   FileWrite(handle, "unresolved_open_baskets_at_end", g_unresolvedBaskets);
   FileWrite(handle, "pair_contribution_net_adr", DoubleToString(g_netAdr, 6));
   FileWrite(handle, "long_baskets", g_longBaskets);
   FileWrite(handle, "short_baskets", g_shortBaskets);
   FileWrite(handle, "long_net_adr", DoubleToString(g_longNetAdr, 6));
   FileWrite(handle, "short_net_adr", DoubleToString(g_shortNetAdr, 6));
   FileWrite(handle, "best_basket_net_adr", g_bestBasketId > 0 ? DoubleToString(g_bestBasketNetAdr, 6) : "");
   FileWrite(handle, "best_basket_symbol", g_bestBasketId > 0 ? g_symbol : "");
   FileWrite(handle, "best_basket_id", g_bestBasketId);
   FileWrite(handle, "worst_basket_net_adr", g_worstBasketId > 0 ? DoubleToString(g_worstBasketNetAdr, 6) : "");
   FileWrite(handle, "worst_basket_symbol", g_worstBasketId > 0 ? g_symbol : "");
   FileWrite(handle, "worst_basket_id", g_worstBasketId);
   FileWrite(handle, "same_bar_trail_ambiguous_count", g_sameBarTrailAmbiguousCount);
   FileWrite(handle, "same_bar_tp_grid_ambiguous_count", g_sameBarTpGridAmbiguousCount);
   FileWrite(handle, "same_bar_sl_grid_ambiguous_count", g_sameBarSlGridAmbiguousCount);
   FileWrite(handle, "same_bar_tp_sl_ambiguous_count", g_sameBarTpSlAmbiguousCount);
   FileWrite(handle, "same_bar_tp_trail_ambiguous_count", g_sameBarTpTrailAmbiguousCount);
   FileWrite(handle, "same_bar_sl_trail_ambiguous_count", g_sameBarSlTrailAmbiguousCount);
   FileWrite(handle, "same_bar_trail_arm_exit_count", g_sameBarTrailArmExitCount);
   FileWrite(handle, "multi_grid_same_bar_count", g_multiGridSameBarCount);
   FileWrite(handle, "weekly_cutoff_closes", g_weeklyCutoffCloses);
   FileWrite(handle, "weekly_cutoff_net_adr", DoubleToString(g_weeklyCutoffNetAdr, 6));
   FileWrite(handle, "lrmg_bootstrap_bars", BootstrapBars);
   FileWrite(handle, "lrmg_median_brick_window", MedianBrickWindow);
   FileWrite(handle, "lrmg_max_bricks_per_bar", MaxBricksPerBar);
   FileWrite(handle, "stoch_k_period", StochKPeriod);
   FileWrite(handle, "stoch_slowing", StochSlowing);
   FileWrite(handle, "stoch_d_period", StochDPeriod);
   FileWrite(handle, "stoch_oversold", DoubleToString(Oversold, 4));
   FileWrite(handle, "stoch_overbought", DoubleToString(Overbought, 4));
   FileWrite(handle, "stoch_use_d_for_filter", UseDForFilter ? "true" : "false");
   FileWrite(handle, "katarakti_mode", (int)KataraktiMode);
   FileWrite(handle, "chart_time_utc_offset_hours", DoubleToString(ChartTimeUtcOffsetHours, 4));
   FileWrite(handle, "enable_longs", EnableLongs ? "true" : "false");
   FileWrite(handle, "enable_shorts", EnableShorts ? "true" : "false");
   FileWrite(handle, "adr_lookback_days", AdrLookbackDays);
   FileWrite(handle, "adr_min_days", AdrMinDays);
   FileWrite(handle, "tp_adr_units", DoubleToString(TpAdrUnits, 6));
   FileWrite(handle, "sl_adr_units", DoubleToString(SlAdrUnits, 6));
   FileWrite(handle, "enable_grid_adds", EnableGridAdds ? "true" : "false");
   FileWrite(handle, "max_basket_entries", MaxBasketEntries);
   FileWrite(handle, "grid_spacing_adr_units", DoubleToString(GridSpacingAdrUnits, 6));
   FileWrite(handle, "enable_trailing_stop", EnableTrailingStop ? "true" : "false");
   FileWrite(handle, "trail_start_adr_units", DoubleToString(TrailStartAdrUnits, 6));
   FileWrite(handle, "trail_distance_adr_units", DoubleToString(TrailDistanceAdrUnits, 6));
   FileWrite(handle, "enable_weekly_cutoff", EnableWeeklyCutoff ? "true" : "false");
   FileWrite(handle, "friday_cutoff_hour", FridayCutoffHour);
   FileWrite(handle, "friday_cutoff_minute", FridayCutoffMinute);
   FileWrite(handle, "david_mode", DavidModeName());
   FileWrite(handle, "david_indicator", DavidIndicatorName);
   FileWrite(handle, "david_ma_period", DavidMAPeriod);
   FileWrite(handle, "david_ma_type", (int)DavidMAType);
   FileWrite(handle, "david_ma_price", (int)DavidMAPrice);
   FileWrite(handle, "david_rsi_filter", DavidUseRsiFilter ? "true" : "false");
   FileWrite(handle, "david_rsi_period", DavidRsiPeriod);
   FileWrite(handle, "david_rsi_overbought", DavidRsiOverBought);
   FileWrite(handle, "david_rsi_oversold", DavidRsiOverSold);
   FileWrite(handle, "enable_multi_symbol", EnableMultiSymbol ? "true" : "false");
   FileWrite(handle, "symbols_csv", ReceiptText(SymbolsCsv));
   FileWrite(handle, "use_default_fx28_symbols", UseDefaultFx28Symbols ? "true" : "false");
   FileWrite(handle, "symbols_source", g_symbolSource);
   FileWrite(handle, "effective_symbols_csv", ReceiptText(g_effectiveSymbolsCsv));
   FileWrite(handle, "timer_seconds", MathMax(1, TimerSeconds));
   FileWrite(handle, "output_folder", OutputFolder);
   FileWrite(handle, "place_tester_orders", PlaceTesterOrders ? "true" : "false");
   FileWrite(handle, "execution_price_mode", ExecutionPriceModeName());
   FileWrite(handle, "require_strategy_tester", RequireStrategyTester ? "true" : "false");
   FileClose(handle);
}

bool BuildSymbolList(string &symbols[])
{
   ArrayResize(symbols, 0);
   g_effectiveSymbolsCsv = "";
   g_symbolSource = "";

   string rawCsv = TrimToken(SymbolsCsv);
   if(!EnableMultiSymbol)
   {
      ArrayResize(symbols, 1);
      symbols[0] = _Symbol;
      if(!SymbolSelect(symbols[0], true))
      {
         Print("LimniKataraktiEA failed to select driver symbol ", symbols[0], ". error=", GetLastError());
         return false;
      }
      g_symbolSource = "driver";
      g_effectiveSymbolsCsv = JoinSymbols(symbols);
      return true;
   }

   if(rawCsv != "")
   {
      string parts[];
      int rawCount = StringSplit(rawCsv, (ushort)',', parts);
      if(rawCount <= 0)
      {
         Print("LimniKataraktiEA SymbolsCsv did not parse any symbols.");
         return false;
      }

      for(int i = 0; i < rawCount; i++)
      {
         string symbol = TrimToken(parts[i]);
         if(symbol == "")
         {
            Print("LimniKataraktiEA rejected empty token in SymbolsCsv.");
            return false;
         }

         if(!AppendSelectedSymbol(symbols, symbol, "SymbolsCsv"))
            return false;
      }

      if(ArraySize(symbols) <= 0)
      {
         Print("LimniKataraktiEA has no symbols after SymbolsCsv selection.");
         return false;
      }

      g_symbolSource = "symbols_csv";
      g_effectiveSymbolsCsv = JoinSymbols(symbols);
      return true;
   }

   if(UseDefaultFx28Symbols)
   {
      string defaults[];
      LoadDefaultFx28Symbols(defaults);
      int defaultCount = ArraySize(defaults);
      for(int i = 0; i < defaultCount; i++)
      {
         if(!AppendSelectedSymbol(symbols, defaults[i], "default_fx28"))
            return false;
      }

      if(ArraySize(symbols) <= 0)
      {
         Print("LimniKataraktiEA has no symbols after default FX28 selection.");
         return false;
      }

      g_symbolSource = "default_fx28";
      g_effectiveSymbolsCsv = JoinSymbols(symbols);
      Print("LimniKataraktiEA using default FX28 symbols. count=", ArraySize(symbols), " symbols=", g_effectiveSymbolsCsv);
      return true;
   }

   int marketWatchCount = SymbolsTotal(true);
   for(int i = 0; i < marketWatchCount; i++)
   {
      if(!AppendSelectedSymbol(symbols, SymbolName(i, true), "Market Watch"))
         return false;
   }

   if(ArraySize(symbols) <= 0)
   {
      Print("LimniKataraktiEA has no visible Market Watch symbols. Set SymbolsCsv, enable UseDefaultFx28Symbols, or show the target symbols in Market Watch.");
      return false;
   }

   g_symbolSource = "market_watch";
   g_effectiveSymbolsCsv = JoinSymbols(symbols);
   Print("LimniKataraktiEA using visible Market Watch symbols. count=", ArraySize(symbols), " symbols=", g_effectiveSymbolsCsv);
   return true;
}

bool InitializeState(KataraktiSymbolState &state, const string symbol)
{
   state.Reset();
   state.symbol = symbol;
   LoadState(state);

   g_symbolPoint = SymbolInfoDouble(g_symbol, SYMBOL_POINT);
   g_symbolDigits = (int)SymbolInfoInteger(g_symbol, SYMBOL_DIGITS);
   if(g_symbolPoint <= 0.0 || g_symbolDigits < 0)
   {
      Print("LimniKataraktiEA failed to read symbol specs for ", g_symbol, ". point=", DoubleToString(g_symbolPoint, 12), " digits=", g_symbolDigits, " error=", GetLastError());
      return false;
   }

   g_stochHandle = iStochastic(g_symbol, PERIOD_M1, StochKPeriod, StochDPeriod, StochSlowing, MODE_SMA, STO_LOWHIGH);
   if(g_stochHandle == INVALID_HANDLE)
   {
      Print("LimniKataraktiEA failed to create M1 stochastic handle for ", g_symbol, ". error=", GetLastError());
      return false;
   }

   if(DavidMode != DAVID_OFF)
   {
      ResetLastError();
      g_davidHandle = iCustom(
         g_symbol,
         PERIOD_M1,
         DavidIndicatorName,
         "<------LIMNI HEDGE MA------>",
         "",
         "MA Settings",
         DavidMAPeriod,
         DavidMAType,
         DavidMAPrice,
         "",
         "RSI Filter Settings",
         DavidUseRsiFilter,
         DavidRsiPeriod,
         DavidRsiOverBought,
         DavidRsiOverSold,
         "",
         "MA Dots Settings:",
         3,
         clrSkyBlue,
         clrYellow
      );

      if(g_davidHandle == INVALID_HANDLE)
      {
         Print("LimniKataraktiEA failed to create M1 David MA handle for ", DavidIndicatorName, " on ", g_symbol, ". error=", GetLastError());
         return false;
      }
   }

   OpenCsvFiles();
   SaveState(state);
   return true;
}

void ReleaseStateHandles(KataraktiSymbolState &state)
{
   if(state.stochHandle != INVALID_HANDLE)
   {
      IndicatorRelease(state.stochHandle);
      state.stochHandle = INVALID_HANDLE;
   }

   if(state.davidHandle != INVALID_HANDLE)
   {
      IndicatorRelease(state.davidHandle);
      state.davidHandle = INVALID_HANDLE;
   }
}

bool LatestMarkPrice(double &price)
{
   price = 0.0;
   MqlTick tick;
   if(SymbolInfoTick(g_symbol, tick))
   {
      if(g_direction > 0 && tick.bid > 0.0)
      {
         price = tick.bid;
         return true;
      }
      if(g_direction < 0 && tick.ask > 0.0)
      {
         price = tick.ask;
         return true;
      }
      if(tick.last > 0.0)
      {
         price = tick.last;
         return true;
      }
      if(tick.bid > 0.0)
      {
         price = tick.bid;
         return true;
      }
      if(tick.ask > 0.0)
      {
         price = tick.ask;
         return true;
      }
   }

   MqlRates rates[];
   ArraySetAsSeries(rates, true);
   if(CopyRates(g_symbol, PERIOD_M1, 0, 1, rates) == 1 && rates[0].close > 0.0)
   {
      price = rates[0].close;
      return true;
   }

   return false;
}

void MarkOpenBasketAtEnd()
{
   if(!g_basketOpen)
      return;

   double endPrice = 0.0;
   if(!LatestMarkPrice(endPrice))
      endPrice = g_avgEntry;

   g_unresolvedBaskets = 1;
   g_terminalMarkedAdr = BasketOpenAdrAtPrice(endPrice);
   RecordBasketRow(TimeCurrent(), endPrice, endPrice, true, g_terminalMarkedAdr, "open_end");
   LogEventDetailed(TimeCurrent(), "OPEN_END", g_direction, endPrice, g_entryAdr, EMPTY_VALUE, g_terminalMarkedAdr, "terminal_mark", true, endPrice, endPrice, endPrice);
}

void OpenAggregateCsvFiles()
{
   if(!ExportCsv || !ExportAggregateCsv)
      return;

   int fileScope = ExportToCommonFiles ? FILE_COMMON : 0;
   FolderCreate(OutputFolder, fileScope);
   if(g_globalRunId == "")
      g_globalRunId = BuildGlobalRunId();

   string summaryName = OutputFolder + "\\" + g_globalRunId + "_aggregate_summary.csv";
   string pairName = OutputFolder + "\\" + g_globalRunId + "_aggregate_pair_contribution.csv";

   g_aggregateSummaryFile = FileOpen(summaryName, FILE_WRITE | FILE_CSV | FILE_ANSI | fileScope, ',');
   if(g_aggregateSummaryFile != INVALID_HANDLE)
   {
      FileWrite(
         g_aggregateSummaryFile,
         "run_id",
         "symbols_count",
         "symbols_source",
         "symbols_csv",
         "closed_baskets_total",
         "closed_net_adr_total",
         "terminal_marked_adr_total",
         "closed_plus_marked_net_adr_total",
         "win_rate_pct_total",
         "max_open_drawdown_adr_worst",
         "max_adverse_excursion_adr_worst",
         "max_basket_fill_count_worst",
         "average_fill_count_total",
         "max_time_in_basket_minutes_worst",
         "average_time_in_basket_minutes_total",
         "unresolved_open_baskets_at_end_total",
         "long_baskets_total",
         "short_baskets_total",
         "long_net_adr_total",
         "short_net_adr_total",
         "best_basket_net_adr",
         "best_basket_symbol",
         "best_basket_id",
         "worst_basket_net_adr",
         "worst_basket_symbol",
         "worst_basket_id",
         "same_bar_trail_ambiguous_count",
         "same_bar_tp_grid_ambiguous_count",
         "same_bar_sl_grid_ambiguous_count",
         "same_bar_tp_sl_ambiguous_count",
         "same_bar_tp_trail_ambiguous_count",
         "same_bar_sl_trail_ambiguous_count",
         "same_bar_trail_arm_exit_count",
         "multi_grid_same_bar_count",
         "weekly_cutoff_closes_total",
         "weekly_cutoff_net_adr_total",
         "place_tester_orders",
         "execution_price_mode",
         "require_strategy_tester",
         "enable_multi_symbol",
         "timer_seconds",
         "output_folder"
       );
       FileFlush(g_aggregateSummaryFile);
    }

   g_aggregatePairFile = FileOpen(pairName, FILE_WRITE | FILE_CSV | FILE_ANSI | fileScope, ',');
   if(g_aggregatePairFile != INVALID_HANDLE)
   {
      FileWrite(
         g_aggregatePairFile,
          "run_id",
          "symbol",
          "symbol_point",
          "symbol_digits",
          "execution_price_mode",
          "closed_baskets",
         "closed_net_adr",
         "terminal_marked_adr",
         "closed_plus_marked_net_adr",
         "win_rate_pct",
         "max_open_drawdown_adr",
         "max_adverse_excursion_adr",
         "max_basket_fill_count",
         "average_fill_count",
         "max_time_in_basket_minutes",
         "average_time_in_basket_minutes",
         "unresolved_open_baskets_at_end",
         "long_baskets",
         "short_baskets",
         "long_net_adr",
         "short_net_adr",
         "same_bar_trail_ambiguous_count",
         "same_bar_tp_grid_ambiguous_count",
         "same_bar_sl_grid_ambiguous_count",
         "same_bar_tp_sl_ambiguous_count",
         "same_bar_tp_trail_ambiguous_count",
         "same_bar_sl_trail_ambiguous_count",
         "same_bar_trail_arm_exit_count",
         "multi_grid_same_bar_count",
         "weekly_cutoff_closes",
         "weekly_cutoff_net_adr"
       );
       FileFlush(g_aggregatePairFile);
    }
}

void WriteAggregateCsvRows()
{
   int count = ArraySize(g_states);
   double closedNet = 0.0;
   double terminalNet = 0.0;
   int closedBaskets = 0;
   int wins = 0;
   double totalFills = 0.0;
   long totalSeconds = 0;
   long maxSeconds = 0;
   int unresolved = 0;
   int maxFills = 0;
   double worstOpenDrawdown = 0.0;
   double worstMae = 0.0;
   int longBaskets = 0;
   int shortBaskets = 0;
   double longNet = 0.0;
   double shortNet = 0.0;
   int weeklyCutoffCloses = 0;
   double weeklyCutoffNet = 0.0;
   int sameBarTrailAmbiguous = 0;
   int sameBarTpGridAmbiguous = 0;
   int sameBarSlGridAmbiguous = 0;
   int sameBarTpSlAmbiguous = 0;
   int sameBarTpTrailAmbiguous = 0;
   int sameBarSlTrailAmbiguous = 0;
   int sameBarTrailArmExit = 0;
   int multiGridSameBar = 0;
   double bestNet = -DBL_MAX;
   double worstNet = DBL_MAX;
   string bestSymbol = "";
   string worstSymbol = "";
   int bestId = 0;
   int worstId = 0;

   for(int i = 0; i < count; i++)
   {
      double closedPlus = g_states[i].netAdr + g_states[i].terminalMarkedAdr;
      double winRate = g_states[i].closedBaskets > 0 ? (double)g_states[i].wins * 100.0 / (double)g_states[i].closedBaskets : 0.0;
      double avgFills = g_states[i].closedBaskets > 0 ? g_states[i].totalFillCount / (double)g_states[i].closedBaskets : 0.0;
      double avgMinutes = g_states[i].closedBaskets > 0 ? ((double)g_states[i].totalBasketSeconds / 60.0) / (double)g_states[i].closedBaskets : 0.0;
      double maxMinutes = (double)g_states[i].maxBasketSeconds / 60.0;

      closedNet += g_states[i].netAdr;
      terminalNet += g_states[i].terminalMarkedAdr;
      closedBaskets += g_states[i].closedBaskets;
      wins += g_states[i].wins;
      totalFills += g_states[i].totalFillCount;
      totalSeconds += g_states[i].totalBasketSeconds;
      if(g_states[i].maxBasketSeconds > maxSeconds)
         maxSeconds = g_states[i].maxBasketSeconds;
      unresolved += g_states[i].unresolvedBaskets;
      if(g_states[i].maxFillCount > maxFills)
         maxFills = g_states[i].maxFillCount;
      if(g_states[i].maxOpenDrawdownAdr < worstOpenDrawdown)
         worstOpenDrawdown = g_states[i].maxOpenDrawdownAdr;
      if(g_states[i].maxAdverseExcursionAdr > worstMae)
         worstMae = g_states[i].maxAdverseExcursionAdr;
      longBaskets += g_states[i].longBaskets;
      shortBaskets += g_states[i].shortBaskets;
      longNet += g_states[i].longNetAdr;
      shortNet += g_states[i].shortNetAdr;
      weeklyCutoffCloses += g_states[i].weeklyCutoffCloses;
      weeklyCutoffNet += g_states[i].weeklyCutoffNetAdr;
      sameBarTrailAmbiguous += g_states[i].sameBarTrailAmbiguousCount;
      sameBarTpGridAmbiguous += g_states[i].sameBarTpGridAmbiguousCount;
      sameBarSlGridAmbiguous += g_states[i].sameBarSlGridAmbiguousCount;
      sameBarTpSlAmbiguous += g_states[i].sameBarTpSlAmbiguousCount;
      sameBarTpTrailAmbiguous += g_states[i].sameBarTpTrailAmbiguousCount;
      sameBarSlTrailAmbiguous += g_states[i].sameBarSlTrailAmbiguousCount;
      sameBarTrailArmExit += g_states[i].sameBarTrailArmExitCount;
      multiGridSameBar += g_states[i].multiGridSameBarCount;

      if(g_states[i].bestBasketId > 0 && g_states[i].bestBasketNetAdr > bestNet)
      {
         bestNet = g_states[i].bestBasketNetAdr;
         bestSymbol = g_states[i].symbol;
         bestId = g_states[i].bestBasketId;
      }
      if(g_states[i].worstBasketId > 0 && g_states[i].worstBasketNetAdr < worstNet)
      {
         worstNet = g_states[i].worstBasketNetAdr;
         worstSymbol = g_states[i].symbol;
         worstId = g_states[i].worstBasketId;
      }

      if(g_aggregatePairFile != INVALID_HANDLE)
      {
         FileWrite(
            g_aggregatePairFile,
            g_globalRunId,
            g_states[i].symbol,
            DoubleToString(g_states[i].point, 12),
            g_states[i].digits,
            ExecutionPriceModeName(),
            g_states[i].closedBaskets,
            DoubleToString(g_states[i].netAdr, 6),
            DoubleToString(g_states[i].terminalMarkedAdr, 6),
            DoubleToString(closedPlus, 6),
            DoubleToString(winRate, 4),
            DoubleToString(g_states[i].maxOpenDrawdownAdr, 6),
            DoubleToString(g_states[i].maxAdverseExcursionAdr, 6),
            g_states[i].maxFillCount,
            DoubleToString(avgFills, 4),
            DoubleToString(maxMinutes, 2),
            DoubleToString(avgMinutes, 2),
            g_states[i].unresolvedBaskets,
            g_states[i].longBaskets,
            g_states[i].shortBaskets,
            DoubleToString(g_states[i].longNetAdr, 6),
            DoubleToString(g_states[i].shortNetAdr, 6),
            g_states[i].sameBarTrailAmbiguousCount,
            g_states[i].sameBarTpGridAmbiguousCount,
            g_states[i].sameBarSlGridAmbiguousCount,
            g_states[i].sameBarTpSlAmbiguousCount,
            g_states[i].sameBarTpTrailAmbiguousCount,
            g_states[i].sameBarSlTrailAmbiguousCount,
            g_states[i].sameBarTrailArmExitCount,
            g_states[i].multiGridSameBarCount,
            g_states[i].weeklyCutoffCloses,
            DoubleToString(g_states[i].weeklyCutoffNetAdr, 6)
         );
      }
   }

   if(g_aggregateSummaryFile != INVALID_HANDLE)
   {
      double closedPlusMarked = closedNet + terminalNet;
      double winRateTotal = closedBaskets > 0 ? (double)wins * 100.0 / (double)closedBaskets : 0.0;
      double avgFillTotal = closedBaskets > 0 ? totalFills / (double)closedBaskets : 0.0;
      double avgMinutesTotal = closedBaskets > 0 ? ((double)totalSeconds / 60.0) / (double)closedBaskets : 0.0;
      double maxMinutesWorst = (double)maxSeconds / 60.0;
      FileWrite(
         g_aggregateSummaryFile,
         g_globalRunId,
         count,
         g_symbolSource,
         ReceiptText(g_effectiveSymbolsCsv),
         closedBaskets,
         DoubleToString(closedNet, 6),
         DoubleToString(terminalNet, 6),
         DoubleToString(closedPlusMarked, 6),
         DoubleToString(winRateTotal, 4),
         DoubleToString(worstOpenDrawdown, 6),
         DoubleToString(worstMae, 6),
         maxFills,
         DoubleToString(avgFillTotal, 4),
         DoubleToString(maxMinutesWorst, 2),
         DoubleToString(avgMinutesTotal, 2),
         unresolved,
         longBaskets,
         shortBaskets,
         DoubleToString(longNet, 6),
         DoubleToString(shortNet, 6),
         bestId > 0 ? DoubleToString(bestNet, 6) : "",
         bestSymbol,
         bestId,
         worstId > 0 ? DoubleToString(worstNet, 6) : "",
         worstSymbol,
         worstId,
         sameBarTrailAmbiguous,
         sameBarTpGridAmbiguous,
         sameBarSlGridAmbiguous,
         sameBarTpSlAmbiguous,
         sameBarTpTrailAmbiguous,
         sameBarSlTrailAmbiguous,
         sameBarTrailArmExit,
         multiGridSameBar,
         weeklyCutoffCloses,
         DoubleToString(weeklyCutoffNet, 6),
         PlaceTesterOrders ? "true" : "false",
         ExecutionPriceModeName(),
         RequireStrategyTester ? "true" : "false",
         EnableMultiSymbol ? "true" : "false",
         MathMax(1, TimerSeconds),
         OutputFolder
      );
   }
}

void CloseAggregateCsvFiles()
{
   if(g_aggregatePairFile != INVALID_HANDLE)
   {
      FileFlush(g_aggregatePairFile);
      FileClose(g_aggregatePairFile);
      g_aggregatePairFile = INVALID_HANDLE;
   }

   if(g_aggregateSummaryFile != INVALID_HANDLE)
   {
      FileFlush(g_aggregateSummaryFile);
      FileClose(g_aggregateSummaryFile);
      g_aggregateSummaryFile = INVALID_HANDLE;
   }
}

void ProcessAllSymbols()
{
   int count = ArraySize(g_states);
   for(int i = 0; i < count; i++)
   {
      LoadState(g_states[i]);

      MqlRates rates[];
      ArraySetAsSeries(rates, true);
      if(CopyRates(g_symbol, PERIOD_M1, 1, 1, rates) != 1)
      {
         SaveState(g_states[i]);
         continue;
      }

      if(rates[0].time <= 0 || rates[0].time == g_lastM1BarTime)
      {
         SaveState(g_states[i]);
         continue;
      }

      g_lastM1BarTime = rates[0].time;
      ProcessClosedM1Bar(rates[0]);
      SaveState(g_states[i]);
   }
}

int OnInit()
{
   bool isTester = (bool)MQLInfoInteger(MQL_TESTER) || (bool)MQLInfoInteger(MQL_OPTIMIZATION);
   if(RequireStrategyTester && !isTester)
   {
      Print("LimniKataraktiEA is tester-only by default. Run it in MT5 Strategy Tester, preferably on M1.");
      return INIT_FAILED;
   }

   if(_Period != PERIOD_M1)
   {
      Print("LimniKataraktiEA: chart period is ", EnumToString((ENUM_TIMEFRAMES)_Period), ". Logic still reads closed M1 bars directly.");
      if(RequireM1PeriodDriver)
         return INIT_FAILED;
   }

   g_trade.SetExpertMagicNumber(MagicNumber);
   g_trade.SetDeviationInPoints(SlippagePoints);
   g_globalRunId = BuildGlobalRunId();

   string symbols[];
   if(!BuildSymbolList(symbols))
      return INIT_FAILED;

   int count = ArraySize(symbols);
   ArrayResize(g_states, count);
   for(int i = 0; i < count; i++)
   {
      if(!InitializeState(g_states[i], symbols[i]))
      {
         for(int j = 0; j <= i; j++)
            ReleaseStateHandles(g_states[j]);
         return INIT_FAILED;
      }
   }

   OpenAggregateCsvFiles();
   if(UseTimerPump)
      EventSetTimer(MathMax(1, TimerSeconds));

   Print(
      "LimniKataraktiEA initialized. symbols=", count,
      " driver=", _Symbol,
      " DavidMode=", DavidModeName(),
      " multi=", EnableMultiSymbol ? "true" : "false",
      " run_id=", g_globalRunId
   );
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
   if(UseTimerPump)
      EventKillTimer();

   int count = ArraySize(g_states);
   for(int i = 0; i < count; i++)
   {
      LoadState(g_states[i]);
      MarkOpenBasketAtEnd();
      WriteSummary();
      CloseCsvFiles();
      SaveState(g_states[i]);
      ReleaseStateHandles(g_states[i]);
   }

   WriteAggregateCsvRows();
   CloseAggregateCsvFiles();

   Print(
      "LimniKataraktiEA finished. symbols=", count,
      " david_mode=", DavidModeName(),
      " run_id=", g_globalRunId
   );
}

void OnTick()
{
   ProcessAllSymbols();
}

void OnTimer()
{
   if(UseTimerPump)
      ProcessAllSymbols();
}
//+------------------------------------------------------------------+
