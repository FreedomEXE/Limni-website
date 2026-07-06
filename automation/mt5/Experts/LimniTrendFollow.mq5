//+------------------------------------------------------------------+
//|                                           LimniTrendFollow.mq5   |
//|                 Simple M1 Strategy Tester validation harness     |
//+------------------------------------------------------------------+
#property copyright "LIMNI LTD"
#property version   "1.00"
#property strict
#property tester_indicator "David_MA_Color_V1f_Updated.ex5"

#include <Trade/Trade.mqh>

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

enum LimniExitScope
{
   EXIT_PAIR = 0,
   EXIT_ACCOUNT = 1
};

enum LimniStateFlipMode
{
   STATE_FLIP_CLOSE_AND_REVERSE = 0,
   STATE_FLIP_HOLD_EXISTING = 1
};

enum LimniOpposingHedgeMode
{
   HEDGE_LOOSE = 1,
   HEDGE_BALANCED = 2,
   HEDGE_STRICT = 3
};

input string T0 = "LimniTrendFollow";
input bool Longs = true;
input bool Shorts = true;
input double Lots = 0.01;
input int Slippage = 10;
input double GridSpacing = 0.10;

input string T1 = "Exit";
input LimniExitScope ExitScope = EXIT_ACCOUNT;
input double TP = 0.10;
input double SL = 0.0;
input bool Trail = true;
input double TrailStart = 0.20;
input double TrailDistance = 0.20;
input int GridCap = 500;

input string T2 = "Trend State";
input LimniStateFlipMode StateFlipMode = STATE_FLIP_HOLD_EXISTING;
input bool GridAddsRequireTrendAgreement = true;

input string T3 = "Stochastic";
input bool Stochastic = false;
input int K = 1000;
input int Slowing = 100;
input int D = 100;
input double Oversold = 10.0;
input double Overbought = 90.0;
input bool UseD = false;

input string T4 = "LRMG";
input bool LRMG = true;

input string T5 = "David MA";
input LimniDavidDirectionMode David = DAVID_OFF;
input bool RSIFilter = true;
input int RSI = 1000;
input int RSI_OB = 60;
input int RSI_OS = 40;

input string T6 = "Opposing Hedge Lane";
input bool OpposingHedgeLane = true;
input LimniOpposingHedgeMode OpposingHedgeMode = HEDGE_BALANCED;

input string T7 = "Research Speed";
input bool FastResearchMode = true;
input bool ExportDetailedCsv = false;
input bool ExportEntryCandidates = false;
input bool PrintAccountExitLog = false;

const bool RequireStrategyTester = true;
const bool PlaceTesterOrders = true;
const LimniExecutionPriceMode ExecutionPriceMode = EXECUTION_MT5_ORDER_FILL;
const long MagicNumber = 960097;
const long OpposingHedgeMagicNumber = 960098;

const int BootstrapBars = 720;
const int MedianBrickWindow = 55;
const int MaxBricksPerBar = 200;
const int MinSweepPoints = 0;
const int MinDisplacementBodyPoints = 0;

const double ChartTimeUtcOffsetHours = 0.0;

const string LrmgIndicatorName = "LimniLRMGPriceLine";
const ENUM_TIMEFRAMES LrmgSourceTimeframe = PERIOD_M1;

const string DavidIndicatorName = "David_MA_Color_V1f_Updated";
const int DavidMAPeriod = 35;
const LimniDavidMaType DavidMAType = DAVID_LWMA;
const LimniDavidMaPrice DavidMAPrice = DAVID_PRICE_CLOSE;

const int AdrLookbackDays = 10;
const int AdrMinDays = 5;
const bool EnableGridAdds = true;
const bool EnableWeeklyCutoff = false;
const int FridayCutoffHour = 16;
const int FridayCutoffMinute = 0;

const bool EnableMultiSymbol = true;
const string SymbolsCsv = "";
const bool UseDefaultFx28Symbols = true;
const bool FailIfAnySymbolUnavailable = true;
const bool RequireM1PeriodDriver = false;
const bool UseTimerPump = false;
const int TimerSeconds = 1;
const bool ExportAggregateCsv = true;

const bool ExportCsv = true;
const bool ExportToCommonFiles = true;
const string OutputFolder = "LimniTrendFollow";
const double AccountExitCloseCommissionPerLot = 7.00;

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
int g_lastTrendStateDirection = 0;

double g_rescueRangeAHigh = 0.0;
double g_rescueRangeALow = 0.0;
double g_rescueRangeBHigh = 0.0;
double g_rescueRangeBLow = 0.0;
double g_rescueEntryBHigh = 0.0;
double g_rescueEntryBLow = 0.0;
bool g_rescueHasRangeA = false;
bool g_rescueHasRangeB = false;
bool g_rescueHasEntryB = false;
int g_rescueLastKtrDayId = 0;
bool g_rescueLastInRangeA = false;
bool g_rescueLastInRangeB = false;
int g_rescueLastEntryWindow = 0;
int g_rescueLongStage = 0;
int g_rescueShortStage = 0;
int g_rescueLongAge = 0;
int g_rescueShortAge = 0;

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
int g_pairAccountExitCloses = 0;
double g_pairAccountExitNetAdr = 0.0;
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
int g_gridAddsBlockedByTrendCount = 0;

bool g_rescueOpen = false;
int g_rescueId = 0;
int g_rescueDirection = 0;
datetime g_rescueEntryTime = 0;
double g_rescueEntryAdr = 0.0;
double g_rescueEntrySum = 0.0;
double g_rescueAvgEntry = 0.0;
double g_rescueEntryPrice = 0.0;
double g_rescueEntryActualPrice = 0.0;
double g_rescueLots = 0.0;
double g_rescueNextGridPrice = 0.0;
int g_rescueFillCount = 0;
double g_rescueMaeAdr = 0.0;
double g_rescueMfeAdr = 0.0;
int g_rescueTriggers = 0;
int g_rescueOpened = 0;
int g_rescueClosed = 0;
int g_rescueFailed = 0;
int g_rescueUnresolved = 0;
double g_rescueTotalFillCount = 0.0;
int g_rescueMaxFillCount = 0;
int g_rescueGridAdds = 0;
int g_rescueMultiGridSameBarCount = 0;
double g_rescueNetAdr = 0.0;
double g_rescueTerminalMarkedAdr = 0.0;
int g_rescueLongs = 0;
int g_rescueShorts = 0;

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
int g_accountExitFile = INVALID_HANDLE;
int g_aggregateRescueFile = INVALID_HANDLE;
bool g_accountTrailArmed = false;
double g_accountTrailPeakPct = 0.0;
double g_accountTrailStopPct = 0.0;
bool g_accountOpenPctObserved = false;
double g_accountMaxOpenPct = 0.0;
double g_accountMinOpenPct = 0.0;
int g_accountExitCycles = 0;
int g_accountExitBasketsClosed = 0;
double g_accountExitNetAdr = 0.0;
double g_accountExitMoney = 0.0;
double g_accountExitEstimatedCloseFee = 0.0;
double g_accountLastExitGrossOpenMoney = 0.0;
double g_accountLastExitEstimatedCloseFee = 0.0;
double g_accountLastExitNetOpenMoney = 0.0;
double g_accountLastExitOpenMoney = 0.0;
double g_accountLastExitOpenPct = 0.0;
double g_accountLastExitBalance = 0.0;
double g_accountLastExitEquity = 0.0;
double g_accountLastExitProfitTotal = 0.0;
double g_accountLastExitRealizedMoney = 0.0;
int g_accountLastExitPositionsRequested = 0;
int g_accountLastExitPositionsClosed = 0;
int g_accountLastExitPositionsFailed = 0;
int g_accountCloseGroupId = 0;
int g_activeAccountCloseGroupId = 0;
double g_activeAccountPreCloseGrossMoney = 0.0;
double g_activeAccountPreCloseEstimatedCloseFee = 0.0;
double g_activeAccountPreCloseNetMoney = 0.0;
double g_activeAccountPreCloseNetPct = 0.0;
double g_activeAccountPreCloseBalance = 0.0;
double g_activeAccountPreCloseEquity = 0.0;
double g_activeAccountPreCloseProfitTotal = 0.0;
int g_activeAccountPreClosePositions = 0;
string g_accountLastExitReason = "";

class TrendFollowSymbolState
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
   int lastTrendStateDirection;

   double rescueRangeAHigh;
   double rescueRangeALow;
   double rescueRangeBHigh;
   double rescueRangeBLow;
   double rescueEntryBHigh;
   double rescueEntryBLow;
   bool rescueHasRangeA;
   bool rescueHasRangeB;
   bool rescueHasEntryB;
   int rescueLastKtrDayId;
   bool rescueLastInRangeA;
   bool rescueLastInRangeB;
   int rescueLastEntryWindow;
   int rescueLongStage;
   int rescueShortStage;
   int rescueLongAge;
   int rescueShortAge;

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
   int pairAccountExitCloses;
   double pairAccountExitNetAdr;
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
   int gridAddsBlockedByTrendCount;

   bool rescueOpen;
   int rescueId;
   int rescueDirection;
   datetime rescueEntryTime;
   double rescueEntryAdr;
   double rescueEntrySum;
   double rescueAvgEntry;
   double rescueEntryPrice;
   double rescueEntryActualPrice;
   double rescueLots;
   double rescueNextGridPrice;
   int rescueFillCount;
   double rescueMaeAdr;
   double rescueMfeAdr;
   int rescueTriggers;
   int rescueOpened;
   int rescueClosed;
   int rescueFailed;
   int rescueUnresolved;
   double rescueTotalFillCount;
   int rescueMaxFillCount;
   int rescueGridAdds;
   int rescueMultiGridSameBarCount;
   double rescueNetAdr;
   double rescueTerminalMarkedAdr;
   int rescueLongs;
   int rescueShorts;

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
      lastTrendStateDirection = 0;
      rescueRangeAHigh = 0.0;
      rescueRangeALow = 0.0;
      rescueRangeBHigh = 0.0;
      rescueRangeBLow = 0.0;
      rescueEntryBHigh = 0.0;
      rescueEntryBLow = 0.0;
      rescueHasRangeA = false;
      rescueHasRangeB = false;
      rescueHasEntryB = false;
      rescueLastKtrDayId = 0;
      rescueLastInRangeA = false;
      rescueLastInRangeB = false;
      rescueLastEntryWindow = 0;
      rescueLongStage = 0;
      rescueShortStage = 0;
      rescueLongAge = 0;
      rescueShortAge = 0;
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
      pairAccountExitCloses = 0;
      pairAccountExitNetAdr = 0.0;
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
      gridAddsBlockedByTrendCount = 0;
      rescueOpen = false;
      rescueId = 0;
      rescueDirection = 0;
      rescueEntryTime = 0;
      rescueEntryAdr = 0.0;
      rescueEntrySum = 0.0;
      rescueAvgEntry = 0.0;
      rescueEntryPrice = 0.0;
      rescueEntryActualPrice = 0.0;
      rescueLots = 0.0;
      rescueNextGridPrice = 0.0;
      rescueFillCount = 0;
      rescueMaeAdr = 0.0;
      rescueMfeAdr = 0.0;
      rescueTriggers = 0;
      rescueOpened = 0;
      rescueClosed = 0;
      rescueFailed = 0;
      rescueUnresolved = 0;
      rescueTotalFillCount = 0.0;
      rescueMaxFillCount = 0;
      rescueGridAdds = 0;
      rescueMultiGridSameBarCount = 0;
      rescueNetAdr = 0.0;
      rescueTerminalMarkedAdr = 0.0;
      rescueLongs = 0;
      rescueShorts = 0;
      lastDavidDirection = 0;
      lastDavidDown = EMPTY_VALUE;
      lastDavidUp = EMPTY_VALUE;
      entryDavidDirection = 0;
      eventsFile = INVALID_HANDLE;
      basketsFile = INVALID_HANDLE;
      runId = "";
   }
};

TrendFollowSymbolState g_states[];

string SideName(const int direction)
{
   if(direction > 0)
      return "LONG";
   if(direction < 0)
      return "SHORT";
   return "NONE";
}

string TrendStateName(const int direction)
{
   if(direction > 0)
      return "BULLISH";
   if(direction < 0)
      return "BEARISH";
   return "NO_TRADE";
}

string BoolText(const bool value)
{
   return value ? "true" : "false";
}

string StateMachinePresetName()
{
   bool stoch = Stochastic;
   bool lrmg = LRMG;
   LimniDavidDirectionMode david = David;
   string prefix = lrmg ? "LRMG_STATE" : "STATE_DISABLED";

   if(david == DAVID_OFF)
   {
      if(stoch && lrmg)
         return prefix + "_STOCH";
      if(stoch)
         return prefix + "_STOCH_ONLY";
      if(lrmg)
         return prefix;
      return prefix;
   }

   string suffix = david == DAVID_WITH ? "DAVID_WITH" : "DAVID_AGAINST";
   if(stoch && lrmg)
      return prefix + "_STOCH_" + suffix;
   if(stoch)
      return prefix + "_STOCH_" + suffix;
   if(lrmg)
      return prefix + "_" + suffix;
   return prefix + "_" + suffix;
}

bool StateMachineUsesStochFilter()
{
   return Stochastic;
}

bool StateMachineUsesLrmgState()
{
   return LRMG;
}

LimniDavidDirectionMode EffectiveDavidMode()
{
   return David;
}

bool StateMachineUsesDavidFilter()
{
   return EffectiveDavidMode() != DAVID_OFF;
}

bool GridAddsEnabled()
{
   return EnableGridAdds && GridCap > 0;
}

bool DetailedCsvEnabled()
{
   return ExportCsv && ExportDetailedCsv && !FastResearchMode;
}

bool EntryCandidateLoggingEnabled()
{
   return DetailedCsvEnabled() && ExportEntryCandidates && !FastResearchMode;
}

bool OpposingHedgeLaneEnabled()
{
   return OpposingHedgeLane;
}

bool StochHandleRequired()
{
   return StateMachineUsesStochFilter() || OpposingHedgeLaneEnabled();
}

bool OpposingHedgeUsesDavidFilter()
{
   return OpposingHedgeLaneEnabled();
}

int OpposingHedgeRequiredEventCount()
{
   if(!OpposingHedgeLaneEnabled())
      return 0;

   int required = (int)OpposingHedgeMode;
   if(required < 1)
      return 1;
   if(required > 3)
      return 3;
   return required;
}

string OpposingHedgeModeName()
{
   if(!OpposingHedgeLaneEnabled())
      return "OFF";
   if(OpposingHedgeMode == HEDGE_LOOSE)
      return "HEDGE_LOOSE_1_OF_3";
   if(OpposingHedgeMode == HEDGE_BALANCED)
      return "HEDGE_BALANCED_2_OF_3";
   if(OpposingHedgeMode == HEDGE_STRICT)
      return "HEDGE_STRICT_3_OF_3";
   return "HEDGE_CUSTOM";
}

string OpposingHedgeLaneName()
{
   if(!OpposingHedgeLaneEnabled())
      return "OFF";
   return OpposingHedgeModeName() + "_KTR_STOCH_DAVID_AGAINST_GRID";
}

bool ManagedMagic(const long magic)
{
   if(magic == MagicNumber)
      return true;
   return OpposingHedgeLaneEnabled() && magic == OpposingHedgeMagicNumber;
}

bool GridAddsAllowedByTrendState(const int trendDirection, const bool trendReady)
{
   if(!GridAddsRequireTrendAgreement)
      return true;
   if(!StateMachineUsesLrmgState())
      return true;
   if(!trendReady || trendDirection == 0)
      return false;
   return trendDirection == g_direction;
}

string DavidModeNameOf(const LimniDavidDirectionMode mode)
{
   if(mode == DAVID_WITH)
      return "WITH";
   if(mode == DAVID_AGAINST)
      return "AGAINST";
   return "OFF";
}

string DavidModeName()
{
   return DavidModeNameOf(EffectiveDavidMode());
}

string ConfiguredDavidModeName()
{
   return DavidModeNameOf(David);
}

string ExecutionPriceModeName()
{
   if(ExecutionPriceMode == EXECUTION_INTERNAL_BAR_PRICE)
      return "INTERNAL_BAR_PRICE";
   return "MT5_ORDER_FILL";
}

string ExitScopeName()
{
   return ExitScope == EXIT_ACCOUNT ? "ACCOUNT" : "PAIR";
}

string ExitUnitName()
{
   return ExitScope == EXIT_ACCOUNT ? "PCT_BALANCE" : "ADR";
}

string StateFlipModeName()
{
   if(StateFlipMode == STATE_FLIP_HOLD_EXISTING)
      return "HOLD_EXISTING";
   return "CLOSE_AND_REVERSE";
}

bool PairExitScope()
{
   return ExitScope == EXIT_PAIR;
}

bool AccountExitScope()
{
   return ExitScope == EXIT_ACCOUNT;
}

bool AccountExitReason(const string reason)
{
   return StringFind(reason, "account_") == 0;
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
      string message = "LimniTrendFollow failed to select " + sourceName + " symbol " + symbol + ". error=" + IntegerToString(GetLastError());
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

void LoadState(TrendFollowSymbolState &state)
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
   g_lastTrendStateDirection = state.lastTrendStateDirection;

   g_rescueRangeAHigh = state.rescueRangeAHigh;
   g_rescueRangeALow = state.rescueRangeALow;
   g_rescueRangeBHigh = state.rescueRangeBHigh;
   g_rescueRangeBLow = state.rescueRangeBLow;
   g_rescueEntryBHigh = state.rescueEntryBHigh;
   g_rescueEntryBLow = state.rescueEntryBLow;
   g_rescueHasRangeA = state.rescueHasRangeA;
   g_rescueHasRangeB = state.rescueHasRangeB;
   g_rescueHasEntryB = state.rescueHasEntryB;
   g_rescueLastKtrDayId = state.rescueLastKtrDayId;
   g_rescueLastInRangeA = state.rescueLastInRangeA;
   g_rescueLastInRangeB = state.rescueLastInRangeB;
   g_rescueLastEntryWindow = state.rescueLastEntryWindow;
   g_rescueLongStage = state.rescueLongStage;
   g_rescueShortStage = state.rescueShortStage;
   g_rescueLongAge = state.rescueLongAge;
   g_rescueShortAge = state.rescueShortAge;

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
   g_pairAccountExitCloses = state.pairAccountExitCloses;
   g_pairAccountExitNetAdr = state.pairAccountExitNetAdr;
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
   g_gridAddsBlockedByTrendCount = state.gridAddsBlockedByTrendCount;

   g_rescueOpen = state.rescueOpen;
   g_rescueId = state.rescueId;
   g_rescueDirection = state.rescueDirection;
   g_rescueEntryTime = state.rescueEntryTime;
   g_rescueEntryAdr = state.rescueEntryAdr;
   g_rescueEntrySum = state.rescueEntrySum;
   g_rescueAvgEntry = state.rescueAvgEntry;
   g_rescueEntryPrice = state.rescueEntryPrice;
   g_rescueEntryActualPrice = state.rescueEntryActualPrice;
   g_rescueLots = state.rescueLots;
   g_rescueNextGridPrice = state.rescueNextGridPrice;
   g_rescueFillCount = state.rescueFillCount;
   g_rescueMaeAdr = state.rescueMaeAdr;
   g_rescueMfeAdr = state.rescueMfeAdr;
   g_rescueTriggers = state.rescueTriggers;
   g_rescueOpened = state.rescueOpened;
   g_rescueClosed = state.rescueClosed;
   g_rescueFailed = state.rescueFailed;
   g_rescueUnresolved = state.rescueUnresolved;
   g_rescueTotalFillCount = state.rescueTotalFillCount;
   g_rescueMaxFillCount = state.rescueMaxFillCount;
   g_rescueGridAdds = state.rescueGridAdds;
   g_rescueMultiGridSameBarCount = state.rescueMultiGridSameBarCount;
   g_rescueNetAdr = state.rescueNetAdr;
   g_rescueTerminalMarkedAdr = state.rescueTerminalMarkedAdr;
   g_rescueLongs = state.rescueLongs;
   g_rescueShorts = state.rescueShorts;

   g_lastDavidDirection = state.lastDavidDirection;
   g_lastDavidDown = state.lastDavidDown;
   g_lastDavidUp = state.lastDavidUp;
   g_entryDavidDirection = state.entryDavidDirection;

   g_eventsFile = state.eventsFile;
   g_basketsFile = state.basketsFile;
   g_runId = state.runId;
}

void SaveState(TrendFollowSymbolState &state)
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
   state.lastTrendStateDirection = g_lastTrendStateDirection;

   state.rescueRangeAHigh = g_rescueRangeAHigh;
   state.rescueRangeALow = g_rescueRangeALow;
   state.rescueRangeBHigh = g_rescueRangeBHigh;
   state.rescueRangeBLow = g_rescueRangeBLow;
   state.rescueEntryBHigh = g_rescueEntryBHigh;
   state.rescueEntryBLow = g_rescueEntryBLow;
   state.rescueHasRangeA = g_rescueHasRangeA;
   state.rescueHasRangeB = g_rescueHasRangeB;
   state.rescueHasEntryB = g_rescueHasEntryB;
   state.rescueLastKtrDayId = g_rescueLastKtrDayId;
   state.rescueLastInRangeA = g_rescueLastInRangeA;
   state.rescueLastInRangeB = g_rescueLastInRangeB;
   state.rescueLastEntryWindow = g_rescueLastEntryWindow;
   state.rescueLongStage = g_rescueLongStage;
   state.rescueShortStage = g_rescueShortStage;
   state.rescueLongAge = g_rescueLongAge;
   state.rescueShortAge = g_rescueShortAge;

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
   state.pairAccountExitCloses = g_pairAccountExitCloses;
   state.pairAccountExitNetAdr = g_pairAccountExitNetAdr;
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
   state.gridAddsBlockedByTrendCount = g_gridAddsBlockedByTrendCount;

   state.rescueOpen = g_rescueOpen;
   state.rescueId = g_rescueId;
   state.rescueDirection = g_rescueDirection;
   state.rescueEntryTime = g_rescueEntryTime;
   state.rescueEntryAdr = g_rescueEntryAdr;
   state.rescueEntrySum = g_rescueEntrySum;
   state.rescueAvgEntry = g_rescueAvgEntry;
   state.rescueEntryPrice = g_rescueEntryPrice;
   state.rescueEntryActualPrice = g_rescueEntryActualPrice;
   state.rescueLots = g_rescueLots;
   state.rescueNextGridPrice = g_rescueNextGridPrice;
   state.rescueFillCount = g_rescueFillCount;
   state.rescueMaeAdr = g_rescueMaeAdr;
   state.rescueMfeAdr = g_rescueMfeAdr;
   state.rescueTriggers = g_rescueTriggers;
   state.rescueOpened = g_rescueOpened;
   state.rescueClosed = g_rescueClosed;
   state.rescueFailed = g_rescueFailed;
   state.rescueUnresolved = g_rescueUnresolved;
   state.rescueTotalFillCount = g_rescueTotalFillCount;
   state.rescueMaxFillCount = g_rescueMaxFillCount;
   state.rescueGridAdds = g_rescueGridAdds;
   state.rescueMultiGridSameBarCount = g_rescueMultiGridSameBarCount;
   state.rescueNetAdr = g_rescueNetAdr;
   state.rescueTerminalMarkedAdr = g_rescueTerminalMarkedAdr;
   state.rescueLongs = g_rescueLongs;
   state.rescueShorts = g_rescueShorts;

   state.lastDavidDirection = g_lastDavidDirection;
   state.lastDavidDown = g_lastDavidDown;
   state.lastDavidUp = g_lastDavidUp;
   state.entryDavidDirection = g_entryDavidDirection;

   state.eventsFile = g_eventsFile;
   state.basketsFile = g_basketsFile;
   state.runId = g_runId;
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

double RescueSweepDepthFraction()
{
   return 0.05;
}

double RescueDisplacementBodyFraction()
{
   return 0.04;
}

double RescueCloseZoneMax()
{
   return 0.40;
}

bool RescueDisplacementPass(const bool isLong, const MqlRates &bar, const double requiredBody)
{
   double candleRange = bar.high - bar.low;
   if(candleRange <= 0.0)
      return false;

   double body = MathAbs(bar.close - bar.open);
   bool correctDirection = isLong ? bar.close > bar.open : bar.close < bar.open;
   if(!correctDirection || body + g_symbolPoint * 0.1 < requiredBody)
      return false;

   double closeZone = isLong ? (bar.high - bar.close) / candleRange : (bar.close - bar.low) / candleRange;
   return closeZone <= RescueCloseZoneMax();
}

void ResetRescueKataraktiStages()
{
   g_rescueLongStage = 0;
   g_rescueShortStage = 0;
   g_rescueLongAge = 0;
   g_rescueShortAge = 0;
}

void UpdateRescueKatarakti(const MqlRates &bar, bool &ktrLong, bool &ktrShort)
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
   bool newDay = g_rescueLastKtrDayId != 0 && dayId != g_rescueLastKtrDayId;
   bool rangeAStart = inRangeA && !g_rescueLastInRangeA;
   bool rangeBStart = inRangeB && !g_rescueLastInRangeB;

   if(newDay)
   {
      g_rescueEntryBHigh = g_rescueRangeBHigh;
      g_rescueEntryBLow = g_rescueRangeBLow;
      g_rescueHasEntryB = g_rescueHasRangeB;
      g_rescueHasRangeA = false;
      g_rescueHasRangeB = false;
      g_rescueRangeAHigh = 0.0;
      g_rescueRangeALow = 0.0;
      g_rescueRangeBHigh = 0.0;
      g_rescueRangeBLow = 0.0;
   }

   if(rangeAStart)
   {
      g_rescueHasRangeA = false;
      g_rescueRangeAHigh = 0.0;
      g_rescueRangeALow = 0.0;
   }

   if(rangeBStart)
   {
      g_rescueHasRangeB = false;
      g_rescueRangeBHigh = 0.0;
      g_rescueRangeBLow = 0.0;
   }

   if(inRangeA)
   {
      g_rescueRangeAHigh = !g_rescueHasRangeA ? bar.high : MathMax(g_rescueRangeAHigh, bar.high);
      g_rescueRangeALow = !g_rescueHasRangeA ? bar.low : MathMin(g_rescueRangeALow, bar.low);
      g_rescueHasRangeA = true;
   }

   if(inRangeB)
   {
      g_rescueRangeBHigh = !g_rescueHasRangeB ? bar.high : MathMax(g_rescueRangeBHigh, bar.high);
      g_rescueRangeBLow = !g_rescueHasRangeB ? bar.low : MathMin(g_rescueRangeBLow, bar.low);
      g_rescueHasRangeB = true;
   }

   bool activeEntry = inEntryA || inEntryB;
   int activeWindow = inEntryA ? 1 : (inEntryB ? 2 : 0);
   bool hasActiveRange = inEntryA ? g_rescueHasRangeA : (inEntryB ? g_rescueHasEntryB : false);
   double activeHigh = inEntryA ? g_rescueRangeAHigh : (inEntryB ? g_rescueEntryBHigh : 0.0);
   double activeLow = inEntryA ? g_rescueRangeALow : (inEntryB ? g_rescueEntryBLow : 0.0);
   bool activeRangeReady = activeEntry && hasActiveRange && activeHigh > activeLow;

   if(!activeEntry || activeWindow != g_rescueLastEntryWindow)
      ResetRescueKataraktiStages();
   g_rescueLastEntryWindow = activeWindow;

   if(activeRangeReady)
   {
      if(g_rescueLongStage > 0)
      {
         g_rescueLongAge++;
         if(g_rescueLongAge > 1)
         {
            g_rescueLongStage = 0;
            g_rescueLongAge = 0;
         }
      }

      if(g_rescueShortStage > 0)
      {
         g_rescueShortAge++;
         if(g_rescueShortAge > 1)
         {
            g_rescueShortStage = 0;
            g_rescueShortAge = 0;
         }
      }

      double activeRange = activeHigh - activeLow;
      double requiredSweep = MathMax(MinSweepPoints * g_symbolPoint, activeRange * RescueSweepDepthFraction());
      double requiredBody = MathMax(MinDisplacementBodyPoints * g_symbolPoint, activeRange * RescueDisplacementBodyFraction());

      if(bar.low <= activeLow - requiredSweep)
      {
         g_rescueLongStage = 1;
         g_rescueLongAge = 0;
      }

      if(bar.high >= activeHigh + requiredSweep)
      {
         g_rescueShortStage = 1;
         g_rescueShortAge = 0;
      }

      if(g_rescueLongStage == 1 && bar.close > activeLow)
      {
         g_rescueLongStage = 2;
         g_rescueLongAge = 0;
      }

      if(g_rescueShortStage == 1 && bar.close < activeHigh)
      {
         g_rescueShortStage = 2;
         g_rescueShortAge = 0;
      }

      if(g_rescueLongStage == 2 && RescueDisplacementPass(true, bar, requiredBody))
      {
         ktrLong = true;
         g_rescueLongStage = 0;
         g_rescueLongAge = 0;
      }

      if(g_rescueShortStage == 2 && RescueDisplacementPass(false, bar, requiredBody))
      {
         ktrShort = true;
         g_rescueShortStage = 0;
         g_rescueShortAge = 0;
      }
   }

   g_rescueLastKtrDayId = dayId;
   g_rescueLastInRangeA = inRangeA;
   g_rescueLastInRangeB = inRangeB;
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
   for(int iter = 0; iter < 64; iter++)
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

void ApplyLrmgClose(const double closePrice)
{
   if(!g_lrmgReady)
      return;

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

void InitializeLrmgFromCollectedBars()
{
   int sourceCount = g_bootstrapCount;
   if(sourceCount < MathMax(50, BootstrapBars + 5))
      return;

   int bootstrapEnd = MathMin(sourceCount - 1, MathMax(10, BootstrapBars) - 1);
   int bootstrapCount = bootstrapEnd + 1;
   double movement = PathMovement(g_bootstrapPrices, bootstrapCount);
   double center = MovementMedian(g_bootstrapPrices, bootstrapCount, movement);
   double radius = MovementRadius(g_bootstrapPrices, bootstrapCount, center, movement);
   if(radius <= 0.0 || !MathIsValidNumber(radius))
      return;

   g_lrmgReady = true;
   g_lrmgQuantum = radius;
   g_lrmgBasePrice = g_bootstrapPrices[0];
   g_lrmgCurrentLevel = 0;
   g_lrmgLine = g_lrmgBasePrice;
   ArrayResize(g_closedBrickLevels, 0);
   g_closedBrickCount = 0;

   for(int i = 0; i < sourceCount; i++)
      ApplyLrmgClose(g_bootstrapPrices[i]);

   ArrayResize(g_bootstrapPrices, 0);
   g_bootstrapCount = 0;
}

void UpdateLrmg(const double closePrice)
{
   if(!g_lrmgReady)
   {
      ArrayResize(g_bootstrapPrices, g_bootstrapCount + 1);
      g_bootstrapPrices[g_bootstrapCount] = closePrice;
      g_bootstrapCount++;
      InitializeLrmgFromCollectedBars();
      return;
   }

   ApplyLrmgClose(closePrice);
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
   int line = UseD ? 1 : 0;
   if(CopyBuffer(g_stochHandle, line, 1, 1, buffer) != 1)
      return false;

   if(!MathIsValidNumber(buffer[0]) || buffer[0] == EMPTY_VALUE)
      return false;

   value = buffer[0];
   return true;
}

bool CurrentLrmgLine(const double closePrice, double &line)
{
   line = 0.0;
   if(!LRMG)
      return false;

   UpdateLrmg(closePrice);
   if(!g_lrmgReady || !MathIsValidNumber(g_lrmgLine) || g_lrmgLine <= 0.0)
      return false;

   line = g_lrmgLine;
   return true;
}

bool CurrentDavidRawDirection(int &direction)
{
   direction = 0;
   g_lastDavidDirection = 0;
   g_lastDavidDown = EMPTY_VALUE;
   g_lastDavidUp = EMPTY_VALUE;

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

bool CurrentDavidDirection(int &direction)
{
   direction = 0;
   if(EffectiveDavidMode() == DAVID_OFF)
      return true;
   return CurrentDavidRawDirection(direction);
}

bool DavidAllowsDirection(const int tradeDirection, const int davidDirection)
{
   LimniDavidDirectionMode davidMode = EffectiveDavidMode();
   if(davidMode == DAVID_OFF)
      return true;
   if(davidDirection == 0)
      return false;
   if(davidMode == DAVID_WITH)
      return tradeDirection == davidDirection;
   if(davidMode == DAVID_AGAINST)
      return tradeDirection == -davidDirection;
   return true;
}

bool DavidAgainstAllowsDirection(const int tradeDirection, const int davidDirection)
{
   if(davidDirection == 0)
      return false;
   return tradeDirection == -davidDirection;
}

void OpenCsvFiles()
{
   int fileScope = ExportToCommonFiles ? FILE_COMMON : 0;
   FolderCreate(OutputFolder, fileScope);
   if(g_globalRunId == "")
      g_globalRunId = BuildGlobalRunId();
   g_runId = SafePart(g_symbol) + "_" + g_globalRunId;

   if(!DetailedCsvEnabled())
      return;

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
           "reason",
           "state_machine_preset",
             "effective_david_mode",
            "configured_david_mode",
            "exit_scope",
            "exit_unit",
            "account_close_group_id",
            "account_open_gross_money_magic",
            "account_estimated_close_fee_magic",
            "account_open_net_money_magic",
            "account_open_net_pct_magic",
            "account_balance",
            "account_equity",
            "account_profit_total",
            "account_positions_count_magic",
            "account_trail_peak_pct",
            "account_trail_stop_pct",
            "state_source",
            "state_flip_mode",
          "stoch_filter_enabled",
          "lrmg_state_enabled",
          "david_filter_enabled",
          "trend_state_ready",
          "trend_state",
          "state_flip",
          "stoch_ready",
          "stoch_pass",
          "lrmg_ready",
          "lrmg_pass",
          "david_ready",
          "david_pass",
          "side_enabled",
          "adr_ready",
          "existing_basket_block",
          "start_window_block",
          "final_decision",
          "block_reason"
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
          "close_reason",
          "exit_scope",
          "exit_unit",
          "account_close_group_id",
          "account_pre_close_gross_money_magic",
          "account_pre_close_estimated_close_fee_magic",
          "account_pre_close_net_money_magic",
          "account_pre_close_net_pct_magic",
          "account_pre_close_balance",
          "account_pre_close_equity",
          "account_pre_close_profit_total",
          "account_pre_close_positions_magic"
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

void WriteEventRow(
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
   const double accountingPrice,
   const string trendStateReady,
   const string trendState,
   const string stateFlip,
   const string stochReady,
   const string stochPass,
   const string lrmgReady,
   const string lrmgPass,
   const string davidReady,
   const string davidPass,
   const string sideEnabled,
   const string adrReady,
   const string existingBasketBlock,
   const string startWindowBlock,
   const string finalDecision,
   const string blockReason
)
{
   if(g_eventsFile == INVALID_HANDLE)
      return;

   string modeledPriceText = hasExecutionReceipt ? PriceString(modeledPrice) : "";
   string actualPriceText = hasExecutionReceipt ? PriceString(actualPrice) : "";
   string accountingPriceText = hasExecutionReceipt ? PriceString(accountingPrice) : "";
   string actualMinusModeledText = hasExecutionReceipt ? PriceString(actualPrice - modeledPrice) : "";
   bool accountCloseContext = g_activeAccountCloseGroupId > 0 && AccountExitReason(reason);
   string accountCloseGroupText = accountCloseContext ? IntegerToString(g_activeAccountCloseGroupId) : "";
   string accountPositionsText = accountCloseContext ? IntegerToString(g_activeAccountPreClosePositions) : "";

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
      reason,
      StateMachinePresetName(),
      DavidModeName(),
      ConfiguredDavidModeName(),
      ExitScopeName(),
      ExitUnitName(),
      accountCloseGroupText,
      accountCloseContext ? DoubleToString(g_activeAccountPreCloseGrossMoney, 2) : "",
      accountCloseContext ? DoubleToString(g_activeAccountPreCloseEstimatedCloseFee, 2) : "",
      accountCloseContext ? DoubleToString(g_activeAccountPreCloseNetMoney, 2) : "",
      accountCloseContext ? DoubleToString(g_activeAccountPreCloseNetPct, 6) : "",
      accountCloseContext ? DoubleToString(g_activeAccountPreCloseBalance, 2) : "",
      accountCloseContext ? DoubleToString(g_activeAccountPreCloseEquity, 2) : "",
      accountCloseContext ? DoubleToString(g_activeAccountPreCloseProfitTotal, 2) : "",
      accountPositionsText,
      accountCloseContext && g_accountTrailArmed ? DoubleToString(g_accountTrailPeakPct, 6) : "",
      accountCloseContext && g_accountTrailArmed ? DoubleToString(g_accountTrailStopPct, 6) : "",
      (LRMG ? "LRMG" : "DISABLED"),
      StateFlipModeName(),
      BoolText(StateMachineUsesStochFilter()),
      BoolText(StateMachineUsesLrmgState()),
      BoolText(StateMachineUsesDavidFilter()),
      trendStateReady,
      trendState,
      stateFlip,
      stochReady,
      stochPass,
      lrmgReady,
      lrmgPass,
      davidReady,
      davidPass,
      sideEnabled,
      adrReady,
      existingBasketBlock,
      startWindowBlock,
      finalDecision,
      blockReason
   );
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
   WriteEventRow(
      t,
      eventName,
      side,
      price,
      adr,
      stoch,
      openAdr,
      reason,
      hasExecutionReceipt,
      modeledPrice,
      actualPrice,
      accountingPrice,
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      ""
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

string EntryCandidateEventName(const int side, const string blockReason)
{
   string prefix = side > 0 ? "BUY" : "SELL";
   if(blockReason == "accepted")
      return prefix + "_SIGNAL";
   if(blockReason == "blocked_side")
      return prefix + "_BLOCKED_SIDE";
   if(blockReason == "blocked_stoch")
      return prefix + "_BLOCKED_STOCH";
   if(blockReason == "blocked_lrmg")
      return prefix + "_BLOCKED_LRMG";
   if(blockReason == "blocked_david")
      return prefix + "_BLOCKED_DAVID";
   if(blockReason == "blocked_adr")
      return prefix + "_BLOCKED_ADR";
   if(blockReason == "blocked_existing_basket")
      return prefix + "_BLOCKED_EXISTING_BASKET";
   if(blockReason == "blocked_held_existing_basket")
      return prefix + "_BLOCKED_HELD_EXISTING_BASKET";
   if(blockReason == "blocked_start_window")
      return prefix + "_BLOCKED_START_WINDOW";
   if(blockReason == "blocked_opposite_signal")
      return prefix + "_BLOCKED_OPPOSITE_SIGNAL";
   return prefix + "_BLOCKED";
}

string EntryBlockReason(
   const bool sideEnabled,
   const bool stochPass,
   const bool lrmgPass,
   const bool davidPass,
   const bool adrReady,
   const bool basketOpen,
   const bool canStart
)
{
   if(!sideEnabled)
      return "blocked_side";
   if(!stochPass)
      return "blocked_stoch";
   if(!lrmgPass)
      return "blocked_lrmg";
   if(!davidPass)
      return "blocked_david";
   if(!adrReady)
      return "blocked_adr";
   if(basketOpen)
      return "blocked_existing_basket";
   if(!canStart)
      return "blocked_start_window";
   return "accepted";
}

void LogEntryCandidate(
   const datetime t,
   const int side,
   const double price,
   const double adr,
   const bool adrReady,
   const double stoch,
   const string trendState,
   const bool stateFlip,
   const bool stochReady,
   const bool stochPass,
   const bool lrmgPass,
   const bool davidReady,
   const bool davidPass,
   const bool sideEnabled,
   const bool basketOpen,
   const bool canStart,
   const string blockReason
)
{
   if(!EntryCandidateLoggingEnabled())
      return;

   string decision = blockReason == "accepted" ? "accepted" : "blocked";
   string reason = blockReason == "accepted" ? "signal" : blockReason;
   WriteEventRow(
      t,
      EntryCandidateEventName(side, blockReason),
      side,
      price,
      adr,
      stoch,
      EMPTY_VALUE,
      reason,
      false,
      0.0,
      0.0,
      0.0,
      "true",
      trendState,
      BoolText(stateFlip),
      BoolText(stochReady),
      BoolText(stochPass),
      BoolText(g_lrmgReady),
      BoolText(lrmgPass),
      BoolText(davidReady),
      BoolText(davidPass),
      BoolText(sideEnabled),
      BoolText(adrReady),
      BoolText(basketOpen),
      BoolText(!canStart),
      decision,
      blockReason
   );
}

int VolumeDigitsFromStep(const double step)
{
   if(step <= 0.0)
      return 2;

   double scaled = step;
   for(int digits = 0; digits <= 8; digits++)
   {
      if(MathAbs(scaled - MathRound(scaled)) < 0.00000001)
         return digits;
      scaled *= 10.0;
   }
   return 8;
}

double NormalizeOrderVolume(const double requestedVolume)
{
   double minVolume = SymbolInfoDouble(g_symbol, SYMBOL_VOLUME_MIN);
   double maxVolume = SymbolInfoDouble(g_symbol, SYMBOL_VOLUME_MAX);
   double step = SymbolInfoDouble(g_symbol, SYMBOL_VOLUME_STEP);
   if(minVolume <= 0.0)
      minVolume = Lots;
   if(maxVolume <= 0.0)
      maxVolume = requestedVolume;
   if(step <= 0.0)
      step = minVolume;

   double volume = MathMax(minVolume, MathMin(requestedVolume, maxVolume));
   volume = MathFloor(volume / step + 0.0000001) * step;
   if(volume < minVolume)
      volume = minVolume;

   return NormalizeDouble(volume, VolumeDigitsFromStep(step));
}

bool SendTesterOrder(const int direction, const double modeledPrice, const double volume, const long magic, const string comment, double &actualPrice)
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

   g_trade.SetExpertMagicNumber(magic);
   bool ok = direction > 0
      ? g_trade.Buy(volume, g_symbol, 0.0, 0.0, 0.0, comment)
      : g_trade.Sell(volume, g_symbol, 0.0, 0.0, 0.0, comment);
   g_trade.SetExpertMagicNumber(MagicNumber);

   if(!ok)
   {
      Print("LimniTrendFollow order failed retcode=", g_trade.ResultRetcode(), " error=", GetLastError());
      return false;
   }

   double resultPrice = g_trade.ResultPrice();
   if(resultPrice > 0.0)
      actualPrice = resultPrice;
   return true;
}

bool CloseTesterPositionsForMagic(const long magic, double &averageClosePrice, int &closedPositions)
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
      if((long)PositionGetInteger(POSITION_MAGIC) != magic)
         continue;

      if(!g_trade.PositionClose(ticket))
      {
         Print("LimniTrendFollow close failed ticket=", ticket, " retcode=", g_trade.ResultRetcode(), " error=", GetLastError());
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

double RescueOpenAdrAtPrice(const double price)
{
   if(!g_rescueOpen || g_rescueEntryAdr <= 0.0 || g_rescueDirection == 0 || g_rescueFillCount <= 0)
      return 0.0;

   if(g_rescueDirection > 0)
      return (price * g_rescueFillCount - g_rescueEntrySum) / g_rescueEntryAdr;
   return (g_rescueEntrySum - price * g_rescueFillCount) / g_rescueEntryAdr;
}

void UpdateRescueExcursion(const MqlRates &bar)
{
   if(!g_rescueOpen)
      return;

   double worst = g_rescueDirection > 0 ? RescueOpenAdrAtPrice(bar.low) : RescueOpenAdrAtPrice(bar.high);
   double best = g_rescueDirection > 0 ? RescueOpenAdrAtPrice(bar.high) : RescueOpenAdrAtPrice(bar.low);
   if(worst < g_rescueMaeAdr)
      g_rescueMaeAdr = worst;
   if(best > g_rescueMfeAdr)
      g_rescueMfeAdr = best;
}

bool LatestMarkPriceForDirection(const int direction, double &price)
{
   price = 0.0;
   MqlTick tick;
   if(SymbolInfoTick(g_symbol, tick))
   {
      if(direction > 0 && tick.bid > 0.0)
      {
         price = tick.bid;
         return true;
      }
      if(direction < 0 && tick.ask > 0.0)
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

void ResetRescueHedge()
{
   g_rescueOpen = false;
   g_rescueDirection = 0;
   g_rescueEntryTime = 0;
   g_rescueEntryAdr = 0.0;
   g_rescueEntrySum = 0.0;
   g_rescueAvgEntry = 0.0;
   g_rescueEntryPrice = 0.0;
   g_rescueEntryActualPrice = 0.0;
   g_rescueLots = 0.0;
   g_rescueNextGridPrice = 0.0;
   g_rescueFillCount = 0;
   g_rescueMaeAdr = 0.0;
   g_rescueMfeAdr = 0.0;
}

bool AddOpposingHedgeFill(const datetime t, const int direction, const double requestedPrice, const double adr, const string reason)
{
   if(adr <= 0.0)
      return false;
   if(g_rescueOpen && g_rescueDirection != direction)
      return false;

   double hedgeLots = NormalizeOrderVolume(Lots);
   if(hedgeLots <= 0.0)
      return false;

   double actualPrice = requestedPrice;
   if(!SendTesterOrder(direction, requestedPrice, hedgeLots, OpposingHedgeMagicNumber, "LimniTrendFollowHedge", actualPrice))
   {
      g_rescueFailed++;
      return false;
   }

   double accountingPrice = ExecutionPriceMode == EXECUTION_INTERNAL_BAR_PRICE ? requestedPrice : actualPrice;
   bool firstFill = !g_rescueOpen;
   if(firstFill)
   {
      g_rescueId++;
      g_rescueTriggers++;
      g_rescueOpened++;
      g_rescueOpen = true;
      g_rescueDirection = direction;
      g_rescueEntryTime = t;
      g_rescueEntryAdr = adr;
      g_rescueEntrySum = 0.0;
      g_rescueAvgEntry = 0.0;
      g_rescueEntryPrice = accountingPrice;
      g_rescueEntryActualPrice = actualPrice;
      g_rescueLots = 0.0;
      g_rescueNextGridPrice = 0.0;
      g_rescueFillCount = 0;
      g_rescueMaeAdr = 0.0;
      g_rescueMfeAdr = 0.0;
      if(direction > 0)
         g_rescueLongs++;
      else if(direction < 0)
         g_rescueShorts++;
   }

   if(!g_rescueOpen || g_rescueDirection != direction)
      return false;

   g_rescueEntrySum += accountingPrice;
   g_rescueFillCount++;
   g_rescueLots += hedgeLots;
   g_rescueAvgEntry = g_rescueEntrySum / (double)g_rescueFillCount;
   if(!firstFill)
      g_rescueGridAdds++;

   if(GridAddsEnabled() && g_rescueFillCount < MathMax(1, GridCap))
      g_rescueNextGridPrice = g_rescueDirection > 0 ? accountingPrice - g_rescueEntryAdr * GridSpacing : accountingPrice + g_rescueEntryAdr * GridSpacing;
   else
      g_rescueNextGridPrice = 0.0;

   LogEventDetailed(
      t,
      firstFill ? "HEDGE_ENTRY" : "HEDGE_GRID_ADD",
      direction,
      accountingPrice,
      adr,
      EMPTY_VALUE,
      RescueOpenAdrAtPrice(accountingPrice),
      reason,
      true,
      requestedPrice,
      actualPrice,
      accountingPrice
   );
   return true;
}

double CloseRescueHedge(const datetime t, double exitPrice, const string reason)
{
   if(!g_rescueOpen)
      return 0.0;

   if(exitPrice <= 0.0 && !LatestMarkPriceForDirection(g_rescueDirection, exitPrice))
      exitPrice = g_rescueEntryPrice;

   double actualExitPrice = exitPrice;
   int actualExitCount = 0;
   bool hasExitExecutionReceipt = false;
   int expectedExitCount = g_rescueFillCount;
   if(PlaceTesterOrders)
      hasExitExecutionReceipt = CloseTesterPositionsForMagic(OpposingHedgeMagicNumber, actualExitPrice, actualExitCount);
   else
      hasExitExecutionReceipt = true;

   if(PlaceTesterOrders && (!hasExitExecutionReceipt || actualExitCount < expectedExitCount))
   {
      Print("LimniTrendFollow hedge close execution incomplete. symbol=", g_symbol, " hedge_id=", g_rescueId, " reason=", reason, " expected_positions=", expectedExitCount, " closed_positions=", actualExitCount, " retcode=", g_trade.ResultRetcode(), " error=", GetLastError());
      g_rescueFailed++;
      return 0.0;
   }

   double closedAdr = RescueOpenAdrAtPrice(exitPrice);
   g_rescueNetAdr += closedAdr;
   g_rescueClosed++;
   g_rescueTotalFillCount += g_rescueFillCount;
   if(g_rescueFillCount > g_rescueMaxFillCount)
      g_rescueMaxFillCount = g_rescueFillCount;
   LogEventDetailed(
      t,
      "HEDGE_EXIT",
      g_rescueDirection,
      exitPrice,
      g_rescueEntryAdr,
      EMPTY_VALUE,
      closedAdr,
      reason,
      hasExitExecutionReceipt,
      exitPrice,
      actualExitPrice,
      exitPrice
   );
   ResetRescueHedge();
   return closedAdr;
}

void ManageOpposingHedgeOnBar(const MqlRates &bar)
{
   if(!g_rescueOpen || g_rescueEntryAdr <= 0.0)
      return;

   UpdateRescueExcursion(bar);

   if(GridAddsEnabled() && g_rescueNextGridPrice > 0.0 && g_rescueFillCount < MathMax(1, GridCap))
   {
      double step = g_rescueEntryAdr * GridSpacing;
      int guard = 0;
      int fillsThisBar = 0;
      while(g_rescueOpen && g_rescueFillCount < MathMax(1, GridCap) && g_rescueNextGridPrice > 0.0 && guard < GridCap)
      {
         bool hit = g_rescueDirection > 0 ? bar.low <= g_rescueNextGridPrice : bar.high >= g_rescueNextGridPrice;
         if(!hit)
            break;

         double gridPrice = g_rescueNextGridPrice;
         if(!AddOpposingHedgeFill(bar.time, g_rescueDirection, gridPrice, g_rescueEntryAdr, "hedge_grid_add"))
            break;

         if(g_rescueFillCount < MathMax(1, GridCap))
            g_rescueNextGridPrice = g_rescueDirection > 0 ? gridPrice - step : gridPrice + step;
         else
            g_rescueNextGridPrice = 0.0;
         guard++;
         fillsThisBar++;
      }
      if(fillsThisBar > 1)
         g_rescueMultiGridSameBarCount++;
   }
}

bool TryOpenOpposingHedge(
   const MqlRates &bar,
   const double adr,
   const bool adrReady,
   const double stoch,
   const bool stochReady,
   const int davidDirection,
   const bool davidReady,
   const bool ktrLong,
   const bool ktrShort
)
{
   if(!OpposingHedgeLaneEnabled() || !g_basketOpen || g_rescueOpen)
      return false;
   if(g_direction == 0 || !adrReady)
      return false;

   int hedgeDirection = -g_direction;
   bool ktrPass = hedgeDirection > 0 ? ktrLong : ktrShort;
   bool stochPass = hedgeDirection > 0 ? (stochReady && stoch <= Oversold) : (stochReady && stoch >= Overbought);
   bool davidPass = davidReady && DavidAgainstAllowsDirection(hedgeDirection, davidDirection);
   bool sideEnabled = hedgeDirection > 0 ? Longs : Shorts;
   int eventCount = 0;
   if(ktrPass)
      eventCount++;
   if(stochPass)
      eventCount++;
   if(davidPass)
      eventCount++;

   if(!sideEnabled || eventCount < OpposingHedgeRequiredEventCount())
      return false;

   string reason = "hedge_entry_" + OpposingHedgeModeName() + "_" + IntegerToString(eventCount) + "_events";
   return AddOpposingHedgeFill(bar.time, hedgeDirection, bar.close, adr, reason);
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
   bool accountCloseContext = g_activeAccountCloseGroupId > 0 && AccountExitReason(reason);
   string accountCloseGroupText = accountCloseContext ? IntegerToString(g_activeAccountCloseGroupId) : "";
   string accountPositionsText = accountCloseContext ? IntegerToString(g_activeAccountPreClosePositions) : "";
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
      reason,
      ExitScopeName(),
      ExitUnitName(),
      accountCloseGroupText,
      accountCloseContext ? DoubleToString(g_activeAccountPreCloseGrossMoney, 2) : "",
      accountCloseContext ? DoubleToString(g_activeAccountPreCloseEstimatedCloseFee, 2) : "",
      accountCloseContext ? DoubleToString(g_activeAccountPreCloseNetMoney, 2) : "",
      accountCloseContext ? DoubleToString(g_activeAccountPreCloseNetPct, 6) : "",
      accountCloseContext ? DoubleToString(g_activeAccountPreCloseBalance, 2) : "",
      accountCloseContext ? DoubleToString(g_activeAccountPreCloseEquity, 2) : "",
      accountCloseContext ? DoubleToString(g_activeAccountPreCloseProfitTotal, 2) : "",
      accountPositionsText
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
   if(!SendTesterOrder(direction, modeledFillPrice, Lots, MagicNumber, "LimniTrendFollow", actualFillPrice))
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

   if(GridAddsEnabled() && g_fillCount < MathMax(1, GridCap))
      g_nextGridPrice = g_direction > 0 ? accountingFillPrice - g_entryAdr * GridSpacing : accountingFillPrice + g_entryAdr * GridSpacing;
   else
      g_nextGridPrice = 0.0;

   LogEventDetailed(
      t,
      reason == "grid_add" ? "GRID_ADD" : "ENTRY",
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

double CloseBasket(const datetime t, const double exitPrice, const string reason)
{
   if(!g_basketOpen)
      return 0.0;

   double actualExitPrice = exitPrice;
   int actualExitCount = 0;
   bool hasExitExecutionReceipt = false;
   int expectedExitCount = g_fillCount;
   if(PlaceTesterOrders)
   {
      hasExitExecutionReceipt = CloseTesterPositionsForMagic(MagicNumber, actualExitPrice, actualExitCount);
      if(!hasExitExecutionReceipt || actualExitCount < expectedExitCount)
      {
         Print(
            "LimniTrendFollow basket close execution incomplete. symbol=", g_symbol,
            " basket_id=", g_basketId,
            " reason=", reason,
            " expected_positions=", expectedExitCount,
            " closed_positions=", actualExitCount,
            " retcode=", g_trade.ResultRetcode(),
            " error=", GetLastError()
         );
         LogEventDetailed(
            t,
            "EXIT_BLOCKED",
            g_direction,
            exitPrice,
            g_entryAdr,
            EMPTY_VALUE,
            BasketOpenAdrAtPrice(exitPrice),
            reason + "_execution_incomplete",
            hasExitExecutionReceipt,
            exitPrice,
            actualExitPrice,
            exitPrice
         );
         return 0.0;
      }
   }
   else
      hasExitExecutionReceipt = true;

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
   if(AccountExitReason(reason))
   {
      g_pairAccountExitCloses++;
      g_pairAccountExitNetAdr += closedAdr;
   }

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
   if(g_rescueOpen)
      CloseRescueHedge(t, 0.0, reason + "_hedge");
   ResetBasket();
   return closedAdr;
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

void ManageBasketOnBar(const MqlRates &bar, const int trendDirection, const bool trendReady)
{
   if(!g_basketOpen || g_entryAdr <= 0.0)
      return;

   UpdateBasketExcursion(bar);

   if(WeeklyCutoffReached(bar.time))
   {
      CloseBasket(bar.time, bar.close, "weekly_cutoff");
      return;
   }

   bool pairExitActive = PairExitScope();
   bool trailWasArmed = pairExitActive && g_trailStopPrice > 0.0;
   if(pairExitActive && Trail && TrailDistance > 0.0)
   {
      if(g_direction > 0)
      {
         if(bar.high >= g_avgEntry + g_entryAdr * TrailStart)
         {
            if(g_trailExtreme <= 0.0 || bar.high > g_trailExtreme)
               g_trailExtreme = bar.high;
            g_trailStopPrice = g_trailExtreme - g_entryAdr * TrailDistance;
         }
      }
      else
      {
         if(bar.low <= g_avgEntry - g_entryAdr * TrailStart)
         {
            if(g_trailExtreme <= 0.0 || bar.low < g_trailExtreme)
               g_trailExtreme = bar.low;
            g_trailStopPrice = g_trailExtreme + g_entryAdr * TrailDistance;
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

   if(pairExitActive && TP > 0.0)
   {
      tpPrice = g_direction > 0 ? g_avgEntry + g_entryAdr * TP : g_avgEntry - g_entryAdr * TP;
      tpTouched = g_direction > 0 ? bar.high >= tpPrice : bar.low <= tpPrice;
      if(tpTouched)
      {
         exitPrice = tpPrice;
         reason = "tp";
      }
   }

   if(pairExitActive && SL > 0.0)
   {
      slPrice = g_direction > 0 ? g_avgEntry - g_entryAdr * SL : g_avgEntry + g_entryAdr * SL;
      slTouched = g_direction > 0 ? bar.low <= slPrice : bar.high >= slPrice;
      if(reason == "" && slTouched)
      {
         exitPrice = slPrice;
         reason = "sl";
      }
   }

   if(pairExitActive && g_trailStopPrice > 0.0)
   {
      trailTouched = g_direction > 0 ? bar.low <= g_trailStopPrice : bar.high >= g_trailStopPrice;
      if(reason == "" && trailTouched)
      {
         exitPrice = g_trailStopPrice;
         reason = "trail";
      }
   }

   if(pairExitActive && reason != "")
   {
      bool adverseGridAlsoHit = GridAddsEnabled() && GridAddsAllowedByTrendState(trendDirection, trendReady)
         && g_nextGridPrice > 0.0 && g_fillCount < MathMax(1, GridCap)
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

   if(GridAddsEnabled() && g_nextGridPrice > 0.0 && g_fillCount < MathMax(1, GridCap))
   {
      if(!GridAddsAllowedByTrendState(trendDirection, trendReady))
      {
         bool blockedHit = g_direction > 0 ? bar.low <= g_nextGridPrice : bar.high >= g_nextGridPrice;
         if(blockedHit)
            g_gridAddsBlockedByTrendCount++;
         return;
      }

      double step = g_entryAdr * GridSpacing;
      int guard = 0;
      int fillsThisBar = 0;
      while(g_basketOpen && g_fillCount < MathMax(1, GridCap) && g_nextGridPrice > 0.0 && guard < GridCap)
      {
         bool hit = g_direction > 0 ? bar.low <= g_nextGridPrice : bar.high >= g_nextGridPrice;
         if(!hit)
            break;

         double gridPrice = g_nextGridPrice;
         if(!AddBasketFill(bar.time, g_direction, gridPrice, g_entryAdr, "grid_add"))
            break;

         if(g_fillCount < MathMax(1, GridCap))
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

double StateBasketOpenAdrAtPrice(TrendFollowSymbolState &state, const double price)
{
   if(!state.basketOpen || state.entryAdr <= 0.0 || state.fillCount <= 0)
      return 0.0;

   if(state.direction > 0)
      return (price * state.fillCount - state.entrySum) / state.entryAdr;
   return (state.entrySum - price * state.fillCount) / state.entryAdr;
}

bool LatestMarkPriceForState(TrendFollowSymbolState &state, double &price)
{
   price = 0.0;
   if(!state.basketOpen || state.direction == 0)
      return false;

   MqlTick tick;
   if(SymbolInfoTick(state.symbol, tick))
   {
      if(state.direction > 0 && tick.bid > 0.0)
      {
         price = tick.bid;
         return true;
      }
      if(state.direction < 0 && tick.ask > 0.0)
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
   if(CopyRates(state.symbol, PERIOD_M1, 0, 1, rates) == 1 && rates[0].close > 0.0)
   {
      price = rates[0].close;
      return true;
   }

   return false;
}

bool AccountOpenSnapshot(
   double &grossOpenMoney,
   double &estimatedCloseFee,
   double &netOpenMoney,
   double &netOpenPct,
   int &positionsCount,
   double &balance,
   double &equity,
   double &profitTotal
)
{
   grossOpenMoney = 0.0;
   estimatedCloseFee = 0.0;
   netOpenMoney = 0.0;
   netOpenPct = 0.0;
   positionsCount = 0;
   balance = AccountInfoDouble(ACCOUNT_BALANCE);
   equity = AccountInfoDouble(ACCOUNT_EQUITY);
   profitTotal = AccountInfoDouble(ACCOUNT_PROFIT);

   if(balance <= 0.0)
      return false;

   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0 || !PositionSelectByTicket(ticket))
         continue;
      if(!ManagedMagic((long)PositionGetInteger(POSITION_MAGIC)))
         continue;

      grossOpenMoney += PositionGetDouble(POSITION_PROFIT) + PositionGetDouble(POSITION_SWAP);
      estimatedCloseFee += MathAbs(PositionGetDouble(POSITION_VOLUME)) * AccountExitCloseCommissionPerLot;
      positionsCount++;
   }

   netOpenMoney = grossOpenMoney - estimatedCloseFee;
   netOpenPct = 100.0 * netOpenMoney / balance;
   return true;
}

void UpdateAccountOpenPctStats(const double openPct, const int positionsCount)
{
   if(positionsCount <= 0)
      return;

   if(!g_accountOpenPctObserved)
   {
      g_accountMaxOpenPct = openPct;
      g_accountMinOpenPct = openPct;
      g_accountOpenPctObserved = true;
      return;
   }

   if(openPct > g_accountMaxOpenPct)
      g_accountMaxOpenPct = openPct;
   if(openPct < g_accountMinOpenPct)
      g_accountMinOpenPct = openPct;
}

void ResetAccountTrail()
{
   g_accountTrailArmed = false;
   g_accountTrailPeakPct = 0.0;
   g_accountTrailStopPct = 0.0;
}

int CloseAllOpenBaskets(const datetime t, const string reason, double &closedAdrTotal)
{
   closedAdrTotal = 0.0;
   int closedBaskets = 0;
   int count = ArraySize(g_states);

   for(int i = 0; i < count; i++)
   {
      if(!g_states[i].basketOpen && !g_states[i].rescueOpen)
         continue;

      LoadState(g_states[i]);

      double closedAdr = 0.0;
      if(g_basketOpen)
      {
         double markPrice = 0.0;
         if(!LatestMarkPriceForState(g_states[i], markPrice))
            markPrice = g_avgEntry;
         closedAdr = CloseBasket(t, markPrice, reason);
         if(g_basketOpen)
         {
            SaveState(g_states[i]);
            continue;
         }
         closedAdrTotal += closedAdr;
         closedBaskets++;
      }

      if(!g_basketOpen && g_rescueOpen)
         CloseRescueHedge(t, 0.0, reason + "_orphan_hedge");

      SaveState(g_states[i]);
   }

   return closedBaskets;
}

void WriteAccountExitRow(
   const datetime t,
   const string reason,
   const int groupId,
   const double preBalance,
   const double preEquity,
   const double preProfitTotal,
   const int prePositions,
   const double preGrossOpenMoney,
   const double preEstimatedCloseFee,
   const double preNetOpenMoney,
   const double preNetOpenPct,
   const int closedBaskets,
   const double closedAdrTotal,
   const double postBalance,
   const double postEquity,
   const double postProfitTotal,
   const int postPositions,
   const double postGrossOpenMoney,
   const double postEstimatedCloseFee,
   const double postNetOpenMoney,
   const double postNetOpenPct,
   const double realizedGroupMoney,
   const int closedPositions,
   const int failedPositions
)
{
   if(g_accountExitFile == INVALID_HANDLE)
      return;

   FileWrite(
      g_accountExitFile,
      g_globalRunId,
      Stamp(t),
      groupId,
      reason,
      ExitScopeName(),
      ExitUnitName(),
      DoubleToString(TP, 6),
      DoubleToString(SL, 6),
      Trail ? "true" : "false",
      DoubleToString(TrailStart, 6),
      DoubleToString(TrailDistance, 6),
      g_accountTrailArmed ? DoubleToString(g_accountTrailPeakPct, 6) : "",
      g_accountTrailArmed ? DoubleToString(g_accountTrailStopPct, 6) : "",
      DoubleToString(preBalance, 2),
      DoubleToString(preEquity, 2),
      DoubleToString(preProfitTotal, 2),
      prePositions,
      DoubleToString(preGrossOpenMoney, 2),
      DoubleToString(preEstimatedCloseFee, 2),
      DoubleToString(preNetOpenMoney, 2),
      DoubleToString(preNetOpenPct, 6),
      closedBaskets,
      DoubleToString(closedAdrTotal, 6),
      DoubleToString(postBalance, 2),
      DoubleToString(postEquity, 2),
      DoubleToString(postProfitTotal, 2),
      postPositions,
      DoubleToString(postGrossOpenMoney, 2),
      DoubleToString(postEstimatedCloseFee, 2),
      DoubleToString(postNetOpenMoney, 2),
      DoubleToString(postNetOpenPct, 6),
      DoubleToString(realizedGroupMoney, 2),
      DoubleToString(realizedGroupMoney - preNetOpenMoney, 2),
      closedPositions,
      failedPositions,
      DoubleToString(AccountExitCloseCommissionPerLot, 2)
   );
   if(!FastResearchMode)
      FileFlush(g_accountExitFile);
}

void ManageAccountExit(const datetime t)
{
   if(!AccountExitScope())
      return;

   double grossOpenMoney = 0.0;
   double estimatedCloseFee = 0.0;
   double netOpenMoney = 0.0;
   double netOpenPct = 0.0;
   double balance = 0.0;
   double equity = 0.0;
   double profitTotal = 0.0;
   int magicPositions = 0;
   if(!AccountOpenSnapshot(grossOpenMoney, estimatedCloseFee, netOpenMoney, netOpenPct, magicPositions, balance, equity, profitTotal))
      return;

   if(magicPositions <= 0)
   {
      ResetAccountTrail();
      return;
   }

   UpdateAccountOpenPctStats(netOpenPct, magicPositions);

   string reason = "";
   if(TP > 0.0 && netOpenPct >= TP)
      reason = "account_tp";
   if(reason == "" && SL > 0.0 && netOpenPct <= -SL)
      reason = "account_sl";

   if(Trail && TrailDistance > 0.0)
   {
      if(!g_accountTrailArmed && netOpenPct >= TrailStart)
      {
         g_accountTrailArmed = true;
         g_accountTrailPeakPct = netOpenPct;
         g_accountTrailStopPct = g_accountTrailPeakPct - TrailDistance;
      }
      if(g_accountTrailArmed)
      {
         if(netOpenPct > g_accountTrailPeakPct)
         {
            g_accountTrailPeakPct = netOpenPct;
            g_accountTrailStopPct = g_accountTrailPeakPct - TrailDistance;
         }
         if(reason == "" && netOpenPct <= g_accountTrailStopPct)
            reason = "account_trail";
      }
   }

   if(reason == "")
      return;

   g_accountCloseGroupId++;
   g_activeAccountCloseGroupId = g_accountCloseGroupId;
   g_activeAccountPreCloseGrossMoney = grossOpenMoney;
   g_activeAccountPreCloseEstimatedCloseFee = estimatedCloseFee;
   g_activeAccountPreCloseNetMoney = netOpenMoney;
   g_activeAccountPreCloseNetPct = netOpenPct;
   g_activeAccountPreCloseBalance = balance;
   g_activeAccountPreCloseEquity = equity;
   g_activeAccountPreCloseProfitTotal = profitTotal;
   g_activeAccountPreClosePositions = magicPositions;

   double closedAdrTotal = 0.0;
   int closedBaskets = CloseAllOpenBaskets(t, reason, closedAdrTotal);
   if(closedBaskets <= 0)
   {
      Print("LimniTrendFollow account exit fired but no tracked baskets closed. reason=", reason, " positions=", magicPositions);
      g_activeAccountCloseGroupId = 0;
      return;
   }

   double postGrossOpenMoney = 0.0;
   double postEstimatedCloseFee = 0.0;
   double postNetOpenMoney = 0.0;
   double postNetOpenPct = 0.0;
   double postBalance = 0.0;
   double postEquity = 0.0;
   double postProfitTotal = 0.0;
   int postPositions = 0;
   AccountOpenSnapshot(postGrossOpenMoney, postEstimatedCloseFee, postNetOpenMoney, postNetOpenPct, postPositions, postBalance, postEquity, postProfitTotal);

   double realizedGroupMoney = postBalance - balance;
   int closedPositions = magicPositions - postPositions;
   if(closedPositions < 0)
      closedPositions = 0;

   g_accountExitCycles++;
   g_accountExitBasketsClosed += closedBaskets;
   g_accountExitNetAdr += closedAdrTotal;
   g_accountExitMoney += realizedGroupMoney;
   g_accountExitEstimatedCloseFee += estimatedCloseFee;
   g_accountLastExitGrossOpenMoney = grossOpenMoney;
   g_accountLastExitEstimatedCloseFee = estimatedCloseFee;
   g_accountLastExitNetOpenMoney = netOpenMoney;
   g_accountLastExitOpenMoney = netOpenMoney;
   g_accountLastExitOpenPct = netOpenPct;
   g_accountLastExitBalance = balance;
   g_accountLastExitEquity = equity;
   g_accountLastExitProfitTotal = profitTotal;
   g_accountLastExitRealizedMoney = realizedGroupMoney;
   g_accountLastExitPositionsRequested = magicPositions;
   g_accountLastExitPositionsClosed = closedPositions;
   g_accountLastExitPositionsFailed = postPositions;
   g_accountLastExitReason = reason;

   WriteAccountExitRow(
      t,
      reason,
      g_accountCloseGroupId,
      balance,
      equity,
      profitTotal,
      magicPositions,
      grossOpenMoney,
      estimatedCloseFee,
      netOpenMoney,
      netOpenPct,
      closedBaskets,
      closedAdrTotal,
      postBalance,
      postEquity,
      postProfitTotal,
      postPositions,
      postGrossOpenMoney,
      postEstimatedCloseFee,
      postNetOpenMoney,
      postNetOpenPct,
      realizedGroupMoney,
      closedPositions,
      postPositions
   );

   if(PrintAccountExitLog && !FastResearchMode)
   {
      Print(
         "LimniTrendFollow account exit. reason=", reason,
         " gross_open_money=", DoubleToString(grossOpenMoney, 2),
         " estimated_close_fee=", DoubleToString(estimatedCloseFee, 2),
         " net_open_money=", DoubleToString(netOpenMoney, 2),
         " net_open_pct=", DoubleToString(netOpenPct, 6),
         " closed_baskets=", closedBaskets,
         " closed_adr=", DoubleToString(closedAdrTotal, 6),
         " realized_money=", DoubleToString(realizedGroupMoney, 2),
         " positions_requested=", magicPositions,
         " positions_failed=", postPositions
      );
   }
   if(postPositions > 0)
      Print("LimniTrendFollow account exit left open magic positions. count=", postPositions);

   ResetAccountTrail();
   g_activeAccountCloseGroupId = 0;
}

void ProcessClosedM1Bar(const MqlRates &bar)
{
   bool useStochFilter = StateMachineUsesStochFilter();
   bool useLrmgState = StateMachineUsesLrmgState();
   bool useDavidFilter = StateMachineUsesDavidFilter();

   double lrmgLine = 0.0;
   bool lrmgReady = CurrentLrmgLine(bar.close, lrmgLine);
   bool hedgeKtrLong = false;
   bool hedgeKtrShort = false;
   if(OpposingHedgeLaneEnabled())
      UpdateRescueKatarakti(bar, hedgeKtrLong, hedgeKtrShort);

   int desiredDirection = 0;
   if(useLrmgState && lrmgReady)
   {
      if(bar.close > lrmgLine)
         desiredDirection = 1;
      else if(bar.close < lrmgLine)
         desiredDirection = -1;
   }

   ManageBasketOnBar(bar, desiredDirection, useLrmgState && lrmgReady && desiredDirection != 0);
   ManageOpposingHedgeOnBar(bar);

   double adr = 0.0;
   double stoch = 0.0;
   int davidDirection = 0;
   bool hedgeCanOpen = OpposingHedgeLaneEnabled() && g_basketOpen && !g_rescueOpen;
   bool needStoch = useStochFilter || hedgeCanOpen;
   bool needDavid = useDavidFilter || hedgeCanOpen;
   bool stochReady = needStoch ? CurrentStoch(stoch) : false;
   bool davidReady = needDavid ? CurrentDavidRawDirection(davidDirection) : CurrentDavidDirection(davidDirection);
   bool adrReady = CurrentAdr(bar.time, adr);

   if(hedgeCanOpen)
      TryOpenOpposingHedge(bar, adr, adrReady, stoch, stochReady, davidDirection, davidReady, hedgeKtrLong, hedgeKtrShort);

   if(desiredDirection == 0)
      return;

   bool stateChanged = desiredDirection != g_lastTrendStateDirection;
   g_lastTrendStateDirection = desiredDirection;

   if(g_basketOpen && g_direction == desiredDirection)
      return;

   bool canStart = CanStartNewBasket(bar.time);
   bool stateFlip = g_basketOpen && g_direction != desiredDirection;
   bool sideEnabled = desiredDirection > 0 ? Longs : Shorts;

   bool stochPass = !useStochFilter || (desiredDirection > 0 ? (stochReady && stoch <= Oversold) : (stochReady && stoch >= Overbought));
   bool lrmgPass = useLrmgState && lrmgReady;
   bool davidPass = !useDavidFilter || (davidReady && DavidAllowsDirection(desiredDirection, davidDirection));
   bool holdExisting = stateFlip && StateFlipMode == STATE_FLIP_HOLD_EXISTING;

   if(holdExisting && !stateChanged)
      return;

   string blockReason = holdExisting
      ? "blocked_held_existing_basket"
      : EntryBlockReason(sideEnabled, stochPass, lrmgPass, davidPass, adrReady, false, canStart);

   LogEntryCandidate(
      bar.time,
      desiredDirection,
      bar.close,
      adr,
      adrReady,
      stoch,
      TrendStateName(desiredDirection),
      stateFlip,
      stochReady,
      stochPass,
      lrmgPass,
      davidReady,
      davidPass,
      sideEnabled,
      holdExisting,
      canStart,
      blockReason
   );

   if(holdExisting)
      return;

   if(stateFlip)
   {
      CloseBasket(bar.time, bar.close, "state_flip");
      if(g_basketOpen)
         return;
   }

   if(blockReason == "accepted")
      AddBasketFill(bar.time, desiredDirection, bar.close, adr, stateFlip ? "state_flip_entry" : "entry");
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
   double hedgeClosedPlusMarked = g_rescueNetAdr + g_rescueTerminalMarkedAdr;
   double avgHedgeFills = g_rescueClosed > 0 ? g_rescueTotalFillCount / (double)g_rescueClosed : 0.0;

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
   FileWrite(handle, "grid_adds_require_trend_agreement", GridAddsRequireTrendAgreement ? "true" : "false");
   FileWrite(handle, "grid_adds_blocked_by_trend_count", g_gridAddsBlockedByTrendCount);
   FileWrite(handle, "weekly_cutoff_closes", g_weeklyCutoffCloses);
   FileWrite(handle, "weekly_cutoff_net_adr", DoubleToString(g_weeklyCutoffNetAdr, 6));
   FileWrite(handle, "account_exit_closes", g_pairAccountExitCloses);
   FileWrite(handle, "account_exit_net_adr", DoubleToString(g_pairAccountExitNetAdr, 6));
   FileWrite(handle, "account_exit_money", DoubleToString(g_accountExitMoney, 2));
   FileWrite(handle, "account_exit_estimated_close_fee", DoubleToString(g_accountExitEstimatedCloseFee, 2));
   FileWrite(handle, "account_exit_close_commission_per_lot", DoubleToString(AccountExitCloseCommissionPerLot, 2));
   FileWrite(handle, "account_exit_trigger_money_basis", "gross_profit_plus_swap_minus_estimated_close_fee");
   FileWrite(handle, "opposing_hedge_enabled", BoolText(OpposingHedgeLaneEnabled()));
   FileWrite(handle, "opposing_hedge_mode", OpposingHedgeModeName());
   FileWrite(handle, "opposing_hedge_required_events", OpposingHedgeRequiredEventCount());
   FileWrite(handle, "opposing_hedge_preset", OpposingHedgeLaneName());
   FileWrite(handle, "opposing_hedge_magic_number", OpposingHedgeMagicNumber);
   FileWrite(handle, "hedge_triggers", g_rescueTriggers);
   FileWrite(handle, "hedge_entries", g_rescueOpened);
   FileWrite(handle, "hedge_grid_adds", g_rescueGridAdds);
   FileWrite(handle, "hedge_closed", g_rescueClosed);
   FileWrite(handle, "hedge_failed", g_rescueFailed);
   FileWrite(handle, "hedge_unresolved_at_end", g_rescueUnresolved);
   FileWrite(handle, "hedge_closed_net_adr", DoubleToString(g_rescueNetAdr, 6));
   FileWrite(handle, "hedge_terminal_marked_adr", DoubleToString(g_rescueTerminalMarkedAdr, 6));
   FileWrite(handle, "hedge_closed_plus_marked_net_adr", DoubleToString(hedgeClosedPlusMarked, 6));
   FileWrite(handle, "hedge_max_fill_count", g_rescueMaxFillCount);
   FileWrite(handle, "hedge_average_fill_count", DoubleToString(avgHedgeFills, 4));
   FileWrite(handle, "hedge_multi_grid_same_bar_count", g_rescueMultiGridSameBarCount);
   FileWrite(handle, "hedge_long_baskets", g_rescueLongs);
   FileWrite(handle, "hedge_short_baskets", g_rescueShorts);
   FileWrite(handle, "lrmg_bootstrap_bars", BootstrapBars);
   FileWrite(handle, "lrmg_median_brick_window", MedianBrickWindow);
   FileWrite(handle, "lrmg_max_bricks_per_bar", MaxBricksPerBar);
   FileWrite(handle, "stoch_k_period", K);
   FileWrite(handle, "stoch_slowing", Slowing);
   FileWrite(handle, "stoch_d_period", D);
   FileWrite(handle, "stoch_oversold", DoubleToString(Oversold, 4));
   FileWrite(handle, "stoch_overbought", DoubleToString(Overbought, 4));
   FileWrite(handle, "stoch_use_d_for_filter", UseD ? "true" : "false");
   FileWrite(handle, "state_source", (LRMG ? "LRMG" : "DISABLED"));
   FileWrite(handle, "state_flip_mode", StateFlipModeName());
   FileWrite(handle, "state_machine_preset", StateMachinePresetName());
   FileWrite(handle, "state_machine_stoch_filter_enabled", BoolText(StateMachineUsesStochFilter()));
   FileWrite(handle, "state_machine_lrmg_state_enabled", BoolText(StateMachineUsesLrmgState()));
   FileWrite(handle, "state_machine_david_filter_enabled", BoolText(StateMachineUsesDavidFilter()));
   FileWrite(handle, "lrmg_engine", "internal_point_in_time_price_line");
   FileWrite(handle, "lrmg_reference_indicator", LrmgIndicatorName);
   FileWrite(handle, "lrmg_source_timeframe", EnumToString(LrmgSourceTimeframe));
   FileWrite(handle, "lrmg_anchor_mode", "chart_oldest_point_in_time");
   FileWrite(handle, "lrmg_update_mode", "closed_m1_incremental");
   FileWrite(handle, "lrmg_min_source_bars", MathMax(50, BootstrapBars + 5));
   FileWrite(handle, "effective_david_mode", DavidModeName());
   FileWrite(handle, "configured_david_mode", ConfiguredDavidModeName());
   FileWrite(handle, "chart_time_utc_offset_hours", DoubleToString(ChartTimeUtcOffsetHours, 4));
   FileWrite(handle, "enable_longs", Longs ? "true" : "false");
   FileWrite(handle, "enable_shorts", Shorts ? "true" : "false");
   FileWrite(handle, "adr_lookback_days", AdrLookbackDays);
   FileWrite(handle, "adr_min_days", AdrMinDays);
   FileWrite(handle, "exit_scope", ExitScopeName());
   FileWrite(handle, "exit_unit", ExitUnitName());
   FileWrite(handle, "tp_value", DoubleToString(TP, 6));
   FileWrite(handle, "sl_value", DoubleToString(SL, 6));
   FileWrite(handle, "tp_adr_units", DoubleToString(TP, 6));
   FileWrite(handle, "sl_adr_units", DoubleToString(SL, 6));
   FileWrite(handle, "enable_grid_adds", GridAddsEnabled() ? "true" : "false");
   FileWrite(handle, "grid_adds_require_trend_agreement", GridAddsRequireTrendAgreement ? "true" : "false");
   FileWrite(handle, "max_basket_entries", GridCap);
   FileWrite(handle, "grid_spacing_adr_units", DoubleToString(GridSpacing, 6));
   FileWrite(handle, "enable_trailing_stop", Trail ? "true" : "false");
   FileWrite(handle, "trail_start_value", DoubleToString(TrailStart, 6));
   FileWrite(handle, "trail_distance_value", DoubleToString(TrailDistance, 6));
   FileWrite(handle, "trail_start_adr_units", DoubleToString(TrailStart, 6));
   FileWrite(handle, "trail_distance_adr_units", DoubleToString(TrailDistance, 6));
   FileWrite(handle, "enable_weekly_cutoff", EnableWeeklyCutoff ? "true" : "false");
   FileWrite(handle, "friday_cutoff_hour", FridayCutoffHour);
   FileWrite(handle, "friday_cutoff_minute", FridayCutoffMinute);
   FileWrite(handle, "david_mode", DavidModeName());
   FileWrite(handle, "david_indicator", DavidIndicatorName);
   FileWrite(handle, "david_ma_period", DavidMAPeriod);
   FileWrite(handle, "david_ma_type", (int)DavidMAType);
   FileWrite(handle, "david_ma_price", (int)DavidMAPrice);
   FileWrite(handle, "david_rsi_filter", RSIFilter ? "true" : "false");
   FileWrite(handle, "david_rsi_period", RSI);
   FileWrite(handle, "david_rsi_overbought", RSI_OB);
   FileWrite(handle, "david_rsi_oversold", RSI_OS);
   FileWrite(handle, "enable_multi_symbol", EnableMultiSymbol ? "true" : "false");
   FileWrite(handle, "symbols_csv", ReceiptText(SymbolsCsv));
   FileWrite(handle, "use_default_fx28_symbols", UseDefaultFx28Symbols ? "true" : "false");
   FileWrite(handle, "symbols_source", g_symbolSource);
   FileWrite(handle, "effective_symbols_csv", ReceiptText(g_effectiveSymbolsCsv));
   FileWrite(handle, "timer_seconds", MathMax(1, TimerSeconds));
   FileWrite(handle, "output_folder", OutputFolder);
   FileWrite(handle, "fast_research_mode", BoolText(FastResearchMode));
   FileWrite(handle, "export_detailed_csv", BoolText(ExportDetailedCsv));
   FileWrite(handle, "export_entry_candidates", BoolText(ExportEntryCandidates));
   FileWrite(handle, "print_account_exit_log", BoolText(PrintAccountExitLog));
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
         Print("LimniTrendFollow failed to select driver symbol ", symbols[0], ". error=", GetLastError());
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
         Print("LimniTrendFollow SymbolsCsv did not parse any symbols.");
         return false;
      }

      for(int i = 0; i < rawCount; i++)
      {
         string symbol = TrimToken(parts[i]);
         if(symbol == "")
         {
            Print("LimniTrendFollow rejected empty token in SymbolsCsv.");
            return false;
         }

         if(!AppendSelectedSymbol(symbols, symbol, "SymbolsCsv"))
            return false;
      }

      if(ArraySize(symbols) <= 0)
      {
         Print("LimniTrendFollow has no symbols after SymbolsCsv selection.");
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
         Print("LimniTrendFollow has no symbols after default FX28 selection.");
         return false;
      }

      g_symbolSource = "default_fx28";
      g_effectiveSymbolsCsv = JoinSymbols(symbols);
      Print("LimniTrendFollow using default FX28 symbols. count=", ArraySize(symbols), " symbols=", g_effectiveSymbolsCsv);
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
      Print("LimniTrendFollow has no visible Market Watch symbols. Set SymbolsCsv, enable UseDefaultFx28Symbols, or show the target symbols in Market Watch.");
      return false;
   }

   g_symbolSource = "market_watch";
   g_effectiveSymbolsCsv = JoinSymbols(symbols);
   Print("LimniTrendFollow using visible Market Watch symbols. count=", ArraySize(symbols), " symbols=", g_effectiveSymbolsCsv);
   return true;
}

bool InitializeState(TrendFollowSymbolState &state, const string symbol)
{
   state.Reset();
   state.symbol = symbol;
   LoadState(state);

   g_symbolPoint = SymbolInfoDouble(g_symbol, SYMBOL_POINT);
   g_symbolDigits = (int)SymbolInfoInteger(g_symbol, SYMBOL_DIGITS);
   if(g_symbolPoint <= 0.0 || g_symbolDigits < 0)
   {
      Print("LimniTrendFollow failed to read symbol specs for ", g_symbol, ". point=", DoubleToString(g_symbolPoint, 12), " digits=", g_symbolDigits, " error=", GetLastError());
      return false;
   }

   if(StochHandleRequired())
   {
      g_stochHandle = iStochastic(g_symbol, PERIOD_M1, K, D, Slowing, MODE_SMA, STO_LOWHIGH);
      if(g_stochHandle == INVALID_HANDLE)
      {
         Print("LimniTrendFollow failed to create M1 stochastic handle for ", g_symbol, ". error=", GetLastError());
         return false;
      }
   }

   if(EffectiveDavidMode() != DAVID_OFF || OpposingHedgeUsesDavidFilter())
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
         RSIFilter,
         RSI,
         RSI_OB,
         RSI_OS,
         "",
         "MA Dots Settings:",
         3,
         clrSkyBlue,
         clrYellow
      );

      if(g_davidHandle == INVALID_HANDLE)
      {
         Print("LimniTrendFollow failed to create M1 David MA handle for ", DavidIndicatorName, " on ", g_symbol, ". error=", GetLastError());
         return false;
      }
   }

   OpenCsvFiles();
   SaveState(state);
   return true;
}

void ReleaseStateHandles(TrendFollowSymbolState &state)
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
   return LatestMarkPriceForDirection(g_direction, price);
}

void MarkOpenBasketAtEnd()
{
   if(g_basketOpen)
   {
      double endPrice = 0.0;
      if(!LatestMarkPrice(endPrice))
         endPrice = g_avgEntry;

      g_unresolvedBaskets = 1;
      g_terminalMarkedAdr = BasketOpenAdrAtPrice(endPrice);
      RecordBasketRow(TimeCurrent(), endPrice, endPrice, true, g_terminalMarkedAdr, "open_end");
      LogEventDetailed(TimeCurrent(), "OPEN_END", g_direction, endPrice, g_entryAdr, EMPTY_VALUE, g_terminalMarkedAdr, "terminal_mark", true, endPrice, endPrice, endPrice);
   }

   if(g_rescueOpen)
   {
      double rescueEndPrice = 0.0;
      if(!LatestMarkPriceForDirection(g_rescueDirection, rescueEndPrice))
         rescueEndPrice = g_rescueEntryPrice;

      g_rescueUnresolved = 1;
      g_rescueTerminalMarkedAdr = RescueOpenAdrAtPrice(rescueEndPrice);
      LogEventDetailed(TimeCurrent(), "HEDGE_OPEN_END", g_rescueDirection, rescueEndPrice, g_rescueEntryAdr, EMPTY_VALUE, g_rescueTerminalMarkedAdr, "terminal_mark_hedge", true, rescueEndPrice, rescueEndPrice, rescueEndPrice);
   }
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
   string accountExitName = OutputFolder + "\\" + g_globalRunId + "_account_exits.csv";
   string hedgeName = OutputFolder + "\\" + g_globalRunId + "_aggregate_opposing_hedge.csv";

   g_aggregateSummaryFile = FileOpen(summaryName, FILE_WRITE | FILE_CSV | FILE_ANSI | fileScope, ',');
   if(g_aggregateSummaryFile != INVALID_HANDLE)
   {
      FileWrite(
         g_aggregateSummaryFile,
         "run_id",
          "symbols_count",
          "symbols_source",
           "symbols_csv",
            "state_machine_preset",
            "effective_david_mode",
            "configured_david_mode",
             "exit_scope",
             "exit_unit",
             "state_source",
             "state_flip_mode",
          "stoch_filter_enabled",
          "lrmg_state_enabled",
          "david_filter_enabled",
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
         "grid_adds_blocked_by_trend_count",
         "weekly_cutoff_closes_total",
         "weekly_cutoff_net_adr_total",
         "account_exit_cycles",
         "account_exit_baskets_closed_total",
         "account_exit_money_total",
         "account_last_exit_reason",
         "account_last_exit_net_open_pct",
         "account_last_exit_realized_money",
         "account_last_exit_positions_failed",
         "account_open_pct_max",
         "account_open_pct_min",
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
           "state_machine_preset",
           "effective_david_mode",
            "configured_david_mode",
             "exit_scope",
             "exit_unit",
             "state_source",
             "state_flip_mode",
            "stoch_filter_enabled",
           "lrmg_state_enabled",
           "david_filter_enabled",
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
         "grid_adds_blocked_by_trend_count",
         "weekly_cutoff_closes",
         "weekly_cutoff_net_adr",
         "account_exit_closes",
         "account_exit_net_adr"
       );
       FileFlush(g_aggregatePairFile);
    }

   g_accountExitFile = FileOpen(accountExitName, FILE_WRITE | FILE_CSV | FILE_ANSI | fileScope, ',');
   if(g_accountExitFile != INVALID_HANDLE)
   {
      FileWrite(
         g_accountExitFile,
         "run_id",
         "time",
         "account_close_group_id",
         "reason",
         "exit_scope",
         "exit_unit",
         "target_tp",
         "target_sl",
         "trail_enabled",
         "trail_start",
         "trail_distance",
         "trail_peak_pct",
         "trail_stop_pct",
         "pre_balance",
         "pre_equity",
         "pre_account_profit_total",
         "pre_positions_magic",
         "pre_gross_open_money_magic",
         "pre_estimated_close_fee_magic",
         "pre_net_open_money_magic",
         "pre_net_open_pct_magic",
         "closed_baskets",
         "closed_net_adr",
         "post_balance",
         "post_equity",
         "post_account_profit_total",
         "post_positions_magic",
         "post_gross_open_money_magic",
         "post_estimated_close_fee_magic",
         "post_net_open_money_magic",
         "post_net_open_pct_magic",
         "realized_money",
         "realized_minus_expected_net_money",
         "positions_closed",
         "positions_failed",
         "close_commission_per_lot"
      );
      FileFlush(g_accountExitFile);
   }

   g_aggregateRescueFile = FileOpen(hedgeName, FILE_WRITE | FILE_CSV | FILE_ANSI | fileScope, ',');
   if(g_aggregateRescueFile != INVALID_HANDLE)
   {
      FileWrite(
         g_aggregateRescueFile,
         "run_id",
         "row_type",
          "symbol",
          "opposing_hedge_enabled",
          "opposing_hedge_mode",
          "opposing_hedge_required_events",
          "opposing_hedge_preset",
          "opposing_hedge_magic_number",
          "hedge_triggers",
          "hedge_entries",
          "hedge_grid_adds",
          "hedge_closed",
          "hedge_failed",
          "hedge_unresolved_at_end",
          "hedge_closed_net_adr",
          "hedge_terminal_marked_adr",
          "hedge_closed_plus_marked_net_adr",
          "hedge_max_fill_count",
          "hedge_average_fill_count",
          "hedge_multi_grid_same_bar_count",
          "hedge_long_baskets",
          "hedge_short_baskets"
      );
      FileFlush(g_aggregateRescueFile);
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
   int gridAddsBlockedByTrend = 0;
   int rescueTriggers = 0;
   int rescueOpened = 0;
   int rescueClosed = 0;
   int rescueFailed = 0;
   int rescueUnresolved = 0;
   double rescueNet = 0.0;
   double rescueTerminalNet = 0.0;
   double rescueTotalFills = 0.0;
   int rescueMaxFills = 0;
   int rescueGridAdds = 0;
   int rescueMultiGridSameBar = 0;
   int rescueLongs = 0;
   int rescueShorts = 0;
   double bestNet = -DBL_MAX;
   double worstNet = DBL_MAX;
   string bestSymbol = "";
   string worstSymbol = "";
   int bestId = 0;
   int worstId = 0;

   for(int i = 0; i < count; i++)
   {
      double closedPlus = g_states[i].netAdr + g_states[i].terminalMarkedAdr;
      double rescueClosedPlus = g_states[i].rescueNetAdr + g_states[i].rescueTerminalMarkedAdr;
      double rescueAvgFills = g_states[i].rescueClosed > 0 ? g_states[i].rescueTotalFillCount / (double)g_states[i].rescueClosed : 0.0;
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
      gridAddsBlockedByTrend += g_states[i].gridAddsBlockedByTrendCount;
      rescueTriggers += g_states[i].rescueTriggers;
      rescueOpened += g_states[i].rescueOpened;
      rescueClosed += g_states[i].rescueClosed;
      rescueFailed += g_states[i].rescueFailed;
      rescueUnresolved += g_states[i].rescueUnresolved;
      rescueNet += g_states[i].rescueNetAdr;
      rescueTerminalNet += g_states[i].rescueTerminalMarkedAdr;
      rescueTotalFills += g_states[i].rescueTotalFillCount;
      if(g_states[i].rescueMaxFillCount > rescueMaxFills)
         rescueMaxFills = g_states[i].rescueMaxFillCount;
      rescueGridAdds += g_states[i].rescueGridAdds;
      rescueMultiGridSameBar += g_states[i].rescueMultiGridSameBarCount;
      rescueLongs += g_states[i].rescueLongs;
      rescueShorts += g_states[i].rescueShorts;

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
             StateMachinePresetName(),
             DavidModeName(),
             ConfiguredDavidModeName(),
              ExitScopeName(),
              ExitUnitName(),
              (LRMG ? "LRMG" : "DISABLED"),
              StateFlipModeName(),
              BoolText(StateMachineUsesStochFilter()),
             BoolText(StateMachineUsesLrmgState()),
             BoolText(StateMachineUsesDavidFilter()),
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
            g_states[i].gridAddsBlockedByTrendCount,
            g_states[i].weeklyCutoffCloses,
            DoubleToString(g_states[i].weeklyCutoffNetAdr, 6),
            g_states[i].pairAccountExitCloses,
            DoubleToString(g_states[i].pairAccountExitNetAdr, 6)
         );
      }

      if(g_aggregateRescueFile != INVALID_HANDLE)
      {
         FileWrite(
            g_aggregateRescueFile,
            g_globalRunId,
            "pair",
            g_states[i].symbol,
            BoolText(OpposingHedgeLaneEnabled()),
            OpposingHedgeModeName(),
            OpposingHedgeRequiredEventCount(),
            OpposingHedgeLaneName(),
            OpposingHedgeMagicNumber,
            g_states[i].rescueTriggers,
            g_states[i].rescueOpened,
            g_states[i].rescueGridAdds,
            g_states[i].rescueClosed,
            g_states[i].rescueFailed,
            g_states[i].rescueUnresolved,
            DoubleToString(g_states[i].rescueNetAdr, 6),
            DoubleToString(g_states[i].rescueTerminalMarkedAdr, 6),
            DoubleToString(rescueClosedPlus, 6),
            g_states[i].rescueMaxFillCount,
            DoubleToString(rescueAvgFills, 4),
            g_states[i].rescueMultiGridSameBarCount,
            g_states[i].rescueLongs,
            g_states[i].rescueShorts
         );
      }
   }

   if(g_aggregateRescueFile != INVALID_HANDLE)
   {
      double rescueClosedPlusMarked = rescueNet + rescueTerminalNet;
      double rescueAvgFillsTotal = rescueClosed > 0 ? rescueTotalFills / (double)rescueClosed : 0.0;
      FileWrite(
         g_aggregateRescueFile,
         g_globalRunId,
         "total",
         "ALL",
         BoolText(OpposingHedgeLaneEnabled()),
         OpposingHedgeModeName(),
         OpposingHedgeRequiredEventCount(),
         OpposingHedgeLaneName(),
         OpposingHedgeMagicNumber,
         rescueTriggers,
         rescueOpened,
         rescueGridAdds,
         rescueClosed,
         rescueFailed,
         rescueUnresolved,
         DoubleToString(rescueNet, 6),
         DoubleToString(rescueTerminalNet, 6),
         DoubleToString(rescueClosedPlusMarked, 6),
         rescueMaxFills,
         DoubleToString(rescueAvgFillsTotal, 4),
         rescueMultiGridSameBar,
         rescueLongs,
         rescueShorts
      );
      FileFlush(g_aggregateRescueFile);
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
         StateMachinePresetName(),
         DavidModeName(),
         ConfiguredDavidModeName(),
          ExitScopeName(),
          ExitUnitName(),
          (LRMG ? "LRMG" : "DISABLED"),
          StateFlipModeName(),
          BoolText(StateMachineUsesStochFilter()),
          BoolText(StateMachineUsesLrmgState()),
          BoolText(StateMachineUsesDavidFilter()),
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
         gridAddsBlockedByTrend,
         weeklyCutoffCloses,
         DoubleToString(weeklyCutoffNet, 6),
         g_accountExitCycles,
         g_accountExitBasketsClosed,
         DoubleToString(g_accountExitMoney, 2),
         g_accountLastExitReason,
         g_accountLastExitReason == "" ? "" : DoubleToString(g_accountLastExitOpenPct, 6),
         g_accountLastExitReason == "" ? "" : DoubleToString(g_accountLastExitRealizedMoney, 2),
         g_accountLastExitReason == "" ? "" : IntegerToString(g_accountLastExitPositionsFailed),
         g_accountOpenPctObserved ? DoubleToString(g_accountMaxOpenPct, 6) : "",
         g_accountOpenPctObserved ? DoubleToString(g_accountMinOpenPct, 6) : "",
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
   if(g_aggregateRescueFile != INVALID_HANDLE)
   {
      FileFlush(g_aggregateRescueFile);
      FileClose(g_aggregateRescueFile);
      g_aggregateRescueFile = INVALID_HANDLE;
   }

   if(g_accountExitFile != INVALID_HANDLE)
   {
      FileFlush(g_accountExitFile);
      FileClose(g_accountExitFile);
      g_accountExitFile = INVALID_HANDLE;
   }

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
   bool processedAny = false;
   datetime latestProcessedBar = 0;
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
      processedAny = true;
      if(rates[0].time > latestProcessedBar)
         latestProcessedBar = rates[0].time;
      SaveState(g_states[i]);
   }

   if(processedAny)
      ManageAccountExit(latestProcessedBar > 0 ? latestProcessedBar : TimeCurrent());
}

int OnInit()
{
   bool isTester = (bool)MQLInfoInteger(MQL_TESTER) || (bool)MQLInfoInteger(MQL_OPTIMIZATION);
   if(RequireStrategyTester && !isTester)
   {
      Print("LimniTrendFollow is tester-only by default. Run it in MT5 Strategy Tester, preferably on M1.");
      return INIT_FAILED;
   }

   if(_Period != PERIOD_M1)
   {
      Print("LimniTrendFollow: chart period is ", EnumToString((ENUM_TIMEFRAMES)_Period), ". Logic still reads closed M1 bars directly.");
      if(RequireM1PeriodDriver)
         return INIT_FAILED;
   }

   if(OpposingHedgeLaneEnabled() && !AccountExitScope())
   {
      Print("LimniTrendFollow opposing hedge lane requires ExitScope=ACCOUNT so the primary and hedge books close together.");
      return INIT_FAILED;
   }

   if(OpposingHedgeLaneEnabled() && PlaceTesterOrders && (ENUM_ACCOUNT_MARGIN_MODE)AccountInfoInteger(ACCOUNT_MARGIN_MODE) != ACCOUNT_MARGIN_MODE_RETAIL_HEDGING)
   {
      Print("LimniTrendFollow opposing hedge lane requires a hedging account. Netting mode would alter the primary basket instead of opening a hedge.");
      return INIT_FAILED;
   }

   g_trade.SetExpertMagicNumber(MagicNumber);
   g_trade.SetDeviationInPoints(Slippage);
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
      "LimniTrendFollow initialized. symbols=", count,
      " driver=", _Symbol,
      " StateMachine=", StateMachinePresetName(),
      " OpposingHedge=", OpposingHedgeLaneName(),
      " ExitScope=", ExitScopeName(),
      " DavidMode=", DavidModeName(),
      " FastResearchMode=", BoolText(FastResearchMode),
      " DetailedCsv=", BoolText(DetailedCsvEnabled()),
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
      "LimniTrendFollow finished. symbols=", count,
      " state_machine=", StateMachinePresetName(),
      " opposing_hedge=", OpposingHedgeLaneName(),
      " exit_scope=", ExitScopeName(),
      " david_mode=", DavidModeName(),
      " fast_research_mode=", BoolText(FastResearchMode),
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
