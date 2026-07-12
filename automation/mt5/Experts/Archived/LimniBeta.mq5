//+------------------------------------------------------------------+
//|                                                LimniBeta.mq5     |
//|             Simple Limni indicator scaffold grid test harness    |
//+------------------------------------------------------------------+
#property copyright "LIMNI LTD"
#property version "1.000"
#property strict

#include <Trade/Trade.mqh>
#include "..\\Indicators\\Include\\LimniLRMGStackCore.mqh"

enum LimniBetaEntryMode
{
   Strict = 0,
   Loose = 1
};

enum LimniBetaExitScope
{
   EXIT_GRID = 0,
   EXIT_ACCOUNT = 1
};

input string T0 = "********** LimniBeta **********";
input string T1 = "----- Entry -----";
input LimniBetaEntryMode EntryMode = Strict;
input double StochOS = 10.0; // Trend sell level
input double StochOB = 90.0; // Trend buy level
input int ScaleLookbackDays = 0;
input string T2 = "----- Exit -----";
input LimniBetaExitScope ExitScope = EXIT_GRID;
input double TP = 1.0; // Grid=LRMG units, Account=% balance
input string T3 = "----- Grid -----";
input double Lots = 0.01;
input int Slippage = 10;
input double GridSpacingLrmgUnits = 1.0;
input int GridCap = 50;
input string T4 = "----- Week Boundary Guard -----";
input bool UseWeekBoundaryGuard = true;
input double BrokerToEstOffsetHours = 0.0;
input string T5 = "----- Backtest Integrity -----";
input datetime TradeStartTime = 0; // 0 disables warm-up/no-trade gate

const bool RequireStrategyTester = true;
const bool PlaceTesterOrders = true;
const bool UseFastInternalSignals = true;
const long MagicNumber = 960199;
const ENUM_TIMEFRAMES SignalTimeframe = PERIOD_M1;
const string StateIndicatorName = "Limni\\TrendState";
const string StochIndicatorName = "Limni\\Stochastic";
const bool ExportCsv = true;
const bool ExportToCommonFiles = true;
const string OutputFolder = "LimniBeta";
const int SundayOpenHourEst = 17;
const int FridayCloseHourEst = 17;
const int WeekBoundaryBlockMinutes = 60;

CTrade g_trade;
int g_stateHandle = INVALID_HANDLE;
int g_stochHandle = INVALID_HANDLE;
datetime g_lastBarTime = 0;

bool g_gridOpen = false;
int g_direction = 0;
datetime g_entryTime = 0;
double g_entryQ = 0.0;
double g_entrySum = 0.0;
double g_avgEntry = 0.0;
double g_nextGridPrice = 0.0;
int g_fillCount = 0;
int g_gridId = 0;
double g_gridMfeQ = 0.0;
double g_gridMaeQ = 0.0;

int g_observedState = 0;
int g_triggeredState = 0;

int g_cachedQDayKey = 0;
double g_cachedQ = 0.0;
bool g_cachedQReady = false;

int g_eventsFile = INVALID_HANDLE;
int g_summaryFile = INVALID_HANDLE;
string g_runId = "";

int g_entrySignals = 0;
int g_entriesOpened = 0;
int g_gridAdds = 0;
int g_closedGrids = 0;
int g_closeFailures = 0;
int g_ignoredSignalsSameSide = 0;
int g_ignoredSignalsNoQ = 0;
int g_ignoredSignalsNoCross = 0;
int g_ignoredSignalsExistingState = 0;
int g_weekBoundaryBlockedBars = 0;
int g_weekBoundaryBlockedActions = 0;
int g_maxFillCount = 0;
int g_gridTpCloses = 0;
int g_accountTpCloses = 0;
int g_accountTpNoGridCloses = 0;
double g_closedNetQ = 0.0;
double g_terminalMarkedQ = 0.0;
bool g_accountOpenPctObserved = false;
double g_accountMaxOpenPct = 0.0;
double g_accountMinOpenPct = 0.0;
double g_accountLastOpenMoney = 0.0;
double g_accountLastOpenPct = 0.0;
double g_accountLastBalance = 0.0;

datetime g_fastLastSignalBarTime = 0;
int g_fastCurrentDayKey = 0;
double g_fastCurrentQ = 0.0;
bool g_fastCurrentQReady = false;
datetime g_fastSourceFirstTime = 0;
datetime g_fastSourceLastTime = 0;
int g_fastDayBarCount = 0;
int g_fastDayBarCapacity = 0;
datetime g_fastDayTimes[];
double g_fastDayCloses[];
int g_fastQDayCount = 0;
int g_fastQDayCapacity = 0;
double g_fastQDays[];
int g_fastQReadyBars = 0;
int g_fastQMissingBars = 0;
int g_fastCompletedQDays = 0;
int g_fastQDayFailures = 0;
bool g_fastHasConfirmedEvent = false;
double g_fastBasePrice = 0.0;
double g_fastLastEventPrice = 0.0;
int g_fastCurrentLevel = 0;
double g_fastEvents[];
int g_fastEventCount = 0;
int g_fastEventCapacity = 0;
int g_fastLastDavidState = 0;
int g_fastCachedMetricEventCount = -1;
double g_fastCachedLo = 0.0;
double g_fastCachedHi = 0.0;
double g_fastPreviousBarStoch = EMPTY_VALUE;
bool g_fastPreviousBarStochReady = false;
double g_fastLastBarQ = 0.0;

int g_processedClosedBars = 0;
int g_signalInputReadyBars = 0;
int g_signalInputMissingBars = 0;
int g_tradeEligibleBars = 0;
int g_warmupBlockedBars = 0;
datetime g_firstProcessedBarTime = 0;
datetime g_lastProcessedBarTime = 0;
datetime g_firstTradeEligibleBarTime = 0;
datetime g_lastTradeEligibleBarTime = 0;
datetime g_firstWarmupBlockedBarTime = 0;
datetime g_lastWarmupBlockedBarTime = 0;

int g_qCopyRequests = 0;
int g_qCopyFailures = 0;
int g_qCacheHits = 0;
int g_qReadyBuilds = 0;
int g_qNotReadyBuilds = 0;
int g_qLastCopyError = 0;
int g_qLastCopiedBars = 0;
int g_qMinCopiedBars = 0;
int g_qMaxCopiedBars = 0;
datetime g_qLastSourceFrom = 0;
datetime g_qLastRequestedTo = 0;
datetime g_qLastSourceFirstTime = 0;
datetime g_qLastSourceLastTime = 0;
int g_qLastDayCount = 0;
int g_qLastValidQDays = 0;
int g_qLastSampleCount = 0;
int g_qLastTargetDayIndex = -1;
datetime g_qFirstReadyBarTime = 0;
datetime g_qFirstReadySourceFirstTime = 0;
double g_qLastQ = 0.0;

struct LrmgQDayRecord
{
   int start_index;
   int end_index;
   int bar_count;
   bool complete;
   bool valid_q;
   double q_day;
};

string BoolText(const bool value)
{
   return value ? "true" : "false";
}

string SideName(const int direction)
{
   if(direction > 0)
      return "LONG";
   if(direction < 0)
      return "SHORT";
   return "NONE";
}

string StateName(const int state)
{
   if(state > 0)
      return "GREEN";
   if(state < 0)
      return "RED";
   return "NEUTRAL";
}

string EntryModeName()
{
   if(EntryMode == Loose)
      return "Loose";
   return "Strict";
}

string EntryModeDescription()
{
   if(EntryMode == Loose)
      return "Loose: red state plus Stoch below OS allows sell; green state plus Stoch above OB allows buy while no same-side grid is active.";
   return "Strict: one Stoch OS/OB trend trigger per state leg; repeats are ignored until state changes.";
}

string ExitScopeName()
{
   if(ExitScope == EXIT_ACCOUNT)
      return "ACCOUNT";
   return "GRID";
}

string ExitUnitName()
{
   if(ExitScope == EXIT_ACCOUNT)
      return "PCT_BALANCE";
   return "LRMG";
}

bool GridExitScope()
{
   return ExitScope == EXIT_GRID;
}

bool AccountExitScope()
{
   return ExitScope == EXIT_ACCOUNT;
}

datetime EstBoundaryTime(const datetime serverTime)
{
   return (datetime)((long)serverTime + (long)MathRound(BrokerToEstOffsetHours * 3600.0));
}

bool WeekBoundaryBlocked(const datetime serverTime)
{
   if(!UseWeekBoundaryGuard)
      return false;

   MqlDateTime parts;
   TimeToStruct(EstBoundaryTime(serverTime), parts);
   int minute = parts.hour * 60 + parts.min;
   int sundayStart = SundayOpenHourEst * 60;
   int fridayEnd = FridayCloseHourEst * 60;
   int fridayStart = fridayEnd - WeekBoundaryBlockMinutes;

   if(parts.day_of_week == 0 && minute >= sundayStart && minute < sundayStart + WeekBoundaryBlockMinutes)
      return true;

   if(parts.day_of_week == 5 && minute >= fridayStart && minute < fridayEnd)
      return true;

   return false;
}

string WeekBoundaryDescription()
{
   return "No opens, closes, or grid adds during Sunday 17:00-17:59 EST and Friday 16:00-16:59 EST.";
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

string StampOrBlank(const datetime value)
{
   return value > 0 ? Stamp(value) : "";
}

bool TradeAllowedByTime(const datetime value)
{
   return TradeStartTime <= 0 || value >= TradeStartTime;
}

string BuildRunId()
{
   string modeledTime = SafePart(TimeToString(TimeCurrent(), TIME_DATE | TIME_SECONDS));
   string runtimeId = IntegerToString((long)GetMicrosecondCount());
   string testerTag = ((bool)MQLInfoInteger(MQL_TESTER) || (bool)MQLInfoInteger(MQL_OPTIMIZATION)) ? "TESTER" : "RUNTIME";
   return SafePart(_Symbol) + "_" + modeledTime + "_" + testerTag + "_" + runtimeId;
}

int DayKey(const datetime value)
{
   MqlDateTime parts;
   TimeToStruct(value, parts);
   return parts.year * 10000 + parts.mon * 100 + parts.day;
}

datetime SourceStartForQ(const datetime bar_time)
{
   int horizon = MathMax(0, ScaleLookbackDays);
   if(horizon == 0)
      return (datetime)0;

   int warmupDays = MathMax(14, horizon * 3 + 14);
   long start = (long)bar_time - (long)warmupDays * 86400;
   if(start < 0)
      return (datetime)0;
   return (datetime)start;
}

void FastAppendDayBar(const datetime valueTime, const double valueClose)
{
   if(g_fastDayBarCount >= g_fastDayBarCapacity)
   {
      g_fastDayBarCapacity = g_fastDayBarCapacity <= 0 ? 2048 : g_fastDayBarCapacity * 2;
      ArrayResize(g_fastDayTimes, g_fastDayBarCapacity);
      ArrayResize(g_fastDayCloses, g_fastDayBarCapacity);
   }

   g_fastDayTimes[g_fastDayBarCount] = valueTime;
   g_fastDayCloses[g_fastDayBarCount] = valueClose;
   g_fastDayBarCount++;

   if(g_fastSourceFirstTime <= 0)
      g_fastSourceFirstTime = valueTime;
   g_fastSourceLastTime = valueTime;
}

void FastAppendQDay(const double qDay)
{
   if(qDay <= 0.0 || !MathIsValidNumber(qDay))
      return;

   if(g_fastQDayCount >= g_fastQDayCapacity)
   {
      g_fastQDayCapacity = g_fastQDayCapacity <= 0 ? 256 : g_fastQDayCapacity * 2;
      ArrayResize(g_fastQDays, g_fastQDayCapacity);
   }

   g_fastQDays[g_fastQDayCount] = qDay;
   g_fastQDayCount++;
   g_fastCompletedQDays++;
}

double FastEffectiveQ(int &sampleCount)
{
   sampleCount = 0;
   if(g_fastQDayCount <= 0)
      return 0.0;

   int horizon = MathMax(0, ScaleLookbackDays);
   sampleCount = horizon == 0 || horizon > g_fastQDayCount ? g_fastQDayCount : horizon;
   if(sampleCount <= 0)
      return 0.0;

   double samples[];
   ArrayResize(samples, sampleCount);
   int startIndex = g_fastQDayCount - sampleCount;
   for(int i = 0; i < sampleCount; i++)
      samples[i] = g_fastQDays[startIndex + i];

   return LimniMedianValues(samples, sampleCount);
}

void FastPublishQStats(const datetime barTime, const int sampleCount)
{
   g_qLastSourceFrom = g_fastSourceFirstTime;
   g_qLastRequestedTo = barTime;
   g_qLastSourceFirstTime = g_fastSourceFirstTime;
   g_qLastSourceLastTime = g_fastSourceLastTime;
   g_qLastDayCount = g_fastQDayCount + (g_fastCurrentDayKey != 0 ? 1 : 0);
   g_qLastValidQDays = g_fastQDayCount;
   g_qLastSampleCount = sampleCount;
   g_qLastTargetDayIndex = g_qLastDayCount > 0 ? g_qLastDayCount - 1 : -1;
   g_qLastQ = g_fastCurrentQ;

   if(g_fastCurrentQReady && g_qFirstReadyBarTime <= 0)
   {
      g_qFirstReadyBarTime = barTime;
      g_qFirstReadySourceFirstTime = g_fastSourceFirstTime;
   }
}

void FastFinishCurrentDay()
{
   if(g_fastCurrentDayKey == 0 || g_fastDayBarCount < LIMNI_LRMG_MIN_DAY_BARS)
   {
      if(g_fastCurrentDayKey != 0)
         g_fastQDayFailures++;
      return;
   }

   LimniRadialMap map;
   if(!LimniComputeMovementMap(g_fastDayTimes, g_fastDayCloses, 0, g_fastDayBarCount - 1, false, map))
   {
      g_fastQDayFailures++;
      return;
   }

   if(map.radius <= 0.0 || !MathIsValidNumber(map.radius))
   {
      g_fastQDayFailures++;
      return;
   }

   FastAppendQDay(map.radius);
}

void FastStartDay(const MqlRates &bar)
{
   g_fastCurrentDayKey = DayKey(bar.time);
   g_fastDayBarCount = 0;

   int sampleCount = 0;
   g_fastCurrentQ = FastEffectiveQ(sampleCount);
   g_fastCurrentQReady = g_fastCurrentQ > 0.0 && MathIsValidNumber(g_fastCurrentQ);
   g_fastBasePrice = g_fastHasConfirmedEvent ? g_fastLastEventPrice : bar.close;
   g_fastCurrentLevel = 0;
   FastPublishQStats(bar.time, sampleCount);
}

void FastEnsureDay(const MqlRates &bar)
{
   int barDayKey = DayKey(bar.time);
   if(g_fastCurrentDayKey == 0)
   {
      FastStartDay(bar);
      return;
   }

   if(barDayKey == g_fastCurrentDayKey)
      return;

   FastFinishCurrentDay();
   FastStartDay(bar);
}

void FastAppendEvent(const double eventPrice)
{
   LimniAppendEventPrice(g_fastEvents, g_fastEventCount, g_fastEventCapacity, eventPrice);
   g_fastLastEventPrice = eventPrice;
   g_fastHasConfirmedEvent = true;
}

bool FastStepSignalBar(const MqlRates &bar, int &state, double &stochCurrent)
{
   state = 0;
   stochCurrent = EMPTY_VALUE;
   g_fastLastSignalBarTime = bar.time;
   g_fastLastBarQ = 0.0;

   FastEnsureDay(bar);
   FastAppendDayBar(bar.time, bar.close);
   int sampleCount = 0;
   g_fastCurrentQ = FastEffectiveQ(sampleCount);
   g_fastCurrentQReady = g_fastCurrentQ > 0.0 && MathIsValidNumber(g_fastCurrentQ);
   FastPublishQStats(bar.time, sampleCount);

   if(!g_fastCurrentQReady)
   {
      g_fastQMissingBars++;
      return false;
   }

   g_fastQReadyBars++;
   g_fastLastBarQ = g_fastCurrentQ;

   int guard = 0;
   while(bar.close >= g_fastBasePrice + ((double)g_fastCurrentLevel + 1.0) * g_fastCurrentQ && guard < LIMNI_LRMG_MAX_BRICKS_PER_BAR)
   {
      g_fastCurrentLevel++;
      FastAppendEvent(g_fastBasePrice + (double)g_fastCurrentLevel * g_fastCurrentQ);
      guard++;
   }

   guard = 0;
   while(bar.close <= g_fastBasePrice + ((double)g_fastCurrentLevel - 1.0) * g_fastCurrentQ && guard < LIMNI_LRMG_MAX_BRICKS_PER_BAR)
   {
      g_fastCurrentLevel--;
      FastAppendEvent(g_fastBasePrice + (double)g_fastCurrentLevel * g_fastCurrentQ);
      guard++;
   }

   if(g_fastEventCount <= 0)
      return false;

   if(g_fastCachedMetricEventCount != g_fastEventCount)
   {
      int firstNewEvent = g_fastCachedMetricEventCount < 0 ? 0 : g_fastCachedMetricEventCount;
      for(int eventIndex = firstNewEvent; eventIndex < g_fastEventCount; eventIndex++)
      {
         double eventLine = LimniMedianRecentEvents(g_fastEvents, eventIndex + 1, LIMNI_LRMG_LINE_EVENT_WINDOW);
         g_fastLastDavidState = LimniLrmgDavidState(g_fastEvents[eventIndex], eventLine, g_fastCurrentQ, g_fastLastDavidState);
      }

      LimniRecentEventRange(g_fastEvents, g_fastEventCount, LIMNI_LRMG_STOCH_EVENT_WINDOW, g_fastCachedLo, g_fastCachedHi);
      g_fastCachedMetricEventCount = g_fastEventCount;
   }

   state = g_fastLastDavidState;
   stochCurrent = LimniBoundedStoch(bar.close, g_fastCachedLo, g_fastCachedHi);
   return MathIsValidNumber(stochCurrent) && stochCurrent != EMPTY_VALUE && state != 0;
}

void OpenCsvFiles()
{
   if(!ExportCsv)
      return;

   int fileScope = ExportToCommonFiles ? FILE_COMMON : 0;
   FolderCreate(OutputFolder, fileScope);
   g_runId = BuildRunId();

   string eventsName = OutputFolder + "\\" + g_runId + "_events.csv";
   string summaryName = OutputFolder + "\\" + g_runId + "_summary.csv";

   g_eventsFile = FileOpen(eventsName, FILE_WRITE | FILE_CSV | FILE_ANSI | fileScope, ',');
   if(g_eventsFile != INVALID_HANDLE)
   {
      FileWrite(
         g_eventsFile,
         "time",
         "symbol",
         "event",
         "grid_id",
         "mode",
         "side",
         "state",
         "stoch_previous",
         "stoch_current",
         "q",
         "price",
         "fill_count",
         "avg_entry",
         "next_grid_price",
         "open_q",
         "week_boundary_blocked",
         "reason"
      );
      FileFlush(g_eventsFile);
   }

   g_summaryFile = FileOpen(summaryName, FILE_WRITE | FILE_CSV | FILE_ANSI | fileScope, ',');
}

void LogEvent(
   const datetime t,
   const string eventName,
   const int side,
   const int state,
   const double stochPrevious,
   const double stochCurrent,
   const double q,
   const double price,
   const double openQ,
   const string reason
)
{
   if(g_eventsFile == INVALID_HANDLE)
      return;

   FileWrite(
      g_eventsFile,
      Stamp(t),
      _Symbol,
      eventName,
      g_gridId,
      EntryModeName(),
      SideName(side),
      StateName(state),
      stochPrevious == EMPTY_VALUE ? "" : DoubleToString(stochPrevious, 6),
      stochCurrent == EMPTY_VALUE ? "" : DoubleToString(stochCurrent, 6),
      q > 0.0 ? DoubleToString(q, _Digits) : "",
      DoubleToString(price, _Digits),
      g_fillCount,
      g_avgEntry > 0.0 ? DoubleToString(g_avgEntry, _Digits) : "",
      g_nextGridPrice > 0.0 ? DoubleToString(g_nextGridPrice, _Digits) : "",
      DoubleToString(openQ, 6),
      BoolText(WeekBoundaryBlocked(t)),
      reason
   );
}

void CloseCsvFiles()
{
   if(g_eventsFile != INVALID_HANDLE)
   {
      FileFlush(g_eventsFile);
      FileClose(g_eventsFile);
      g_eventsFile = INVALID_HANDLE;
   }

   if(g_summaryFile != INVALID_HANDLE)
   {
      FileFlush(g_summaryFile);
      FileClose(g_summaryFile);
      g_summaryFile = INVALID_HANDLE;
   }
}

bool IndicatorValueReady(const double value)
{
   return MathIsValidNumber(value) && value != EMPTY_VALUE;
}

bool CopyIndicatorValue(const int handle, const int buffer, const int shift, double &value)
{
   value = EMPTY_VALUE;
   if(handle == INVALID_HANDLE)
      return false;

   double raw[];
   ArraySetAsSeries(raw, true);
   if(CopyBuffer(handle, buffer, shift, 1, raw) != 1)
      return false;
   if(!IndicatorValueReady(raw[0]))
      return false;

   value = raw[0];
   return true;
}

int StateFromValue(const double value)
{
   if(!IndicatorValueReady(value))
      return 0;
   if(value >= 0.5)
      return 1;
   if(value <= -0.5)
      return -1;
   return 0;
}

bool CurrentSignalInputs(const MqlRates &bar, int &state, double &stochCurrent, double &stochPrevious)
{
   state = 0;
   stochCurrent = EMPTY_VALUE;
   stochPrevious = EMPTY_VALUE;

   if(UseFastInternalSignals)
   {
      bool previousReady = g_fastPreviousBarStochReady;
      double previousStoch = g_fastPreviousBarStoch;
      bool currentReady = FastStepSignalBar(bar, state, stochCurrent);

      g_fastPreviousBarStochReady = IndicatorValueReady(stochCurrent);
      g_fastPreviousBarStoch = g_fastPreviousBarStochReady ? stochCurrent : EMPTY_VALUE;

      if(!currentReady || !previousReady)
         return false;

      stochPrevious = previousStoch;
      return state != 0;
   }

   double stateValue = EMPTY_VALUE;
   if(!CopyIndicatorValue(g_stateHandle, 0, 1, stateValue))
      return false;
   if(!CopyIndicatorValue(g_stochHandle, 0, 1, stochCurrent))
      return false;
   if(!CopyIndicatorValue(g_stochHandle, 0, 2, stochPrevious))
      return false;

   state = StateFromValue(stateValue);
   return state != 0;
}

void AppendQDayRecord(
   LrmgQDayRecord &days[],
   int &dayCount,
   int &dayCapacity,
   const int startIndex,
   const int endIndex
)
{
   if(dayCount >= dayCapacity)
   {
      dayCapacity = dayCapacity <= 0 ? 64 : dayCapacity * 2;
      ArrayResize(days, dayCapacity);
   }

   days[dayCount].start_index = startIndex;
   days[dayCount].end_index = endIndex;
   days[dayCount].bar_count = endIndex - startIndex + 1;
   days[dayCount].complete = false;
   days[dayCount].valid_q = false;
   days[dayCount].q_day = 0.0;
   dayCount++;
}

int BuildQDayRecords(const MqlRates &rates[], const int count, LrmgQDayRecord &days[])
{
   ArrayResize(days, 0);
   if(count <= 0)
      return 0;

   int dayCount = 0;
   int dayCapacity = 0;
   int activeKey = DayKey(rates[0].time);
   int startIndex = 0;

   for(int i = 1; i < count; i++)
   {
      int key = DayKey(rates[i].time);
      if(key == activeKey)
         continue;

      AppendQDayRecord(days, dayCount, dayCapacity, startIndex, i - 1);
      activeKey = key;
      startIndex = i;
   }

   AppendQDayRecord(days, dayCount, dayCapacity, startIndex, count - 1);
   ArrayResize(days, dayCount);
   return dayCount;
}

double Median(double &values[], const int count)
{
   if(count <= 0)
      return 0.0;

   ArrayResize(values, count);
   ArraySort(values);
   int mid = count / 2;
   if((count % 2) == 1)
      return values[mid];
   return (values[mid - 1] + values[mid]) / 2.0;
}

double EffectiveQForDay(const LrmgQDayRecord &days[], const int dayIndex, int &sampleCount)
{
   int horizon = MathMax(0, ScaleLookbackDays);
   int sampleLimit = horizon == 0 ? INT_MAX : horizon;
   double samples[];
   sampleCount = 0;
   int sampleCapacity = 0;

   for(int i = dayIndex - 1; i >= 0 && sampleCount < sampleLimit; i--)
   {
      if(!days[i].valid_q || days[i].q_day <= 0.0)
         continue;

      if(sampleCount >= sampleCapacity)
      {
         sampleCapacity = sampleCapacity <= 0 ? 32 : sampleCapacity * 2;
         ArrayResize(samples, sampleCapacity);
      }
      samples[sampleCount] = days[i].q_day;
      sampleCount++;
   }

   return Median(samples, sampleCount);
}

bool CurrentLrmgQ(const datetime barTime, double &q)
{
   q = 0.0;
   if(UseFastInternalSignals && g_fastLastSignalBarTime == barTime && g_fastLastBarQ > 0.0)
   {
      q = g_fastLastBarQ;
      g_cachedQ = q;
      g_cachedQDayKey = DayKey(barTime);
      g_cachedQReady = true;
      g_qCacheHits++;
      g_qLastQ = q;
      return true;
   }

   int targetDay = DayKey(barTime);
   if(g_cachedQReady && g_cachedQDayKey == targetDay && g_cachedQ > 0.0)
   {
      g_qCacheHits++;
      q = g_cachedQ;
      g_qLastQ = q;
      return true;
   }

   datetime sourceFrom = SourceStartForQ(barTime);
   MqlRates rates[];
   ArraySetAsSeries(rates, false);
   ResetLastError();
   g_qCopyRequests++;
   g_qLastSourceFrom = sourceFrom;
   g_qLastRequestedTo = barTime;
   int copied = CopyRates(_Symbol, SignalTimeframe, sourceFrom, barTime, rates);
   g_qLastCopyError = GetLastError();
   g_qLastCopiedBars = copied;
   if(copied > 0)
   {
      if(g_qMinCopiedBars == 0 || copied < g_qMinCopiedBars)
         g_qMinCopiedBars = copied;
      if(copied > g_qMaxCopiedBars)
         g_qMaxCopiedBars = copied;
   }

   if(copied < 100)
   {
      g_qCopyFailures++;
      g_qNotReadyBuilds++;
      g_cachedQReady = false;
      g_cachedQDayKey = targetDay;
      return false;
   }

   if(rates[0].time > rates[copied - 1].time)
   {
      MqlRates ordered[];
      ArrayResize(ordered, copied);
      for(int i = 0; i < copied; i++)
         ordered[i] = rates[copied - 1 - i];
      ArrayResize(rates, copied);
      for(int i = 0; i < copied; i++)
         rates[i] = ordered[i];
   }

   g_qLastSourceFirstTime = rates[0].time;
   g_qLastSourceLastTime = rates[copied - 1].time;

   datetime sourceTimes[];
   double sourceCloses[];
   ArrayResize(sourceTimes, copied);
   ArrayResize(sourceCloses, copied);
   for(int i = 0; i < copied; i++)
   {
      sourceTimes[i] = rates[i].time;
      sourceCloses[i] = rates[i].close;
   }

   LrmgQDayRecord days[];
   int dayCount = BuildQDayRecords(rates, copied, days);
   g_qLastDayCount = dayCount;
   if(dayCount <= 1)
   {
      g_qLastValidQDays = 0;
      g_qLastSampleCount = 0;
      g_qLastTargetDayIndex = -1;
      g_qNotReadyBuilds++;
      g_cachedQReady = false;
      g_cachedQDayKey = targetDay;
      return false;
   }

   int targetDayIndex = -1;
   int validQDays = 0;
   for(int d = 0; d < dayCount; d++)
   {
      days[d].complete = (d < dayCount - 1);
      days[d].valid_q = false;
      days[d].q_day = 0.0;

      if(DayKey(rates[days[d].start_index].time) == targetDay)
         targetDayIndex = d;

      if(!days[d].complete || days[d].bar_count < 10)
         continue;

      LimniRadialMap map;
      if(!LimniComputeMovementMap(sourceTimes, sourceCloses, days[d].start_index, days[d].end_index, false, map))
         continue;

      days[d].q_day = map.radius;
      days[d].valid_q = map.radius > 0.0;
      if(days[d].valid_q)
         validQDays++;
   }

   if(targetDayIndex < 0)
      targetDayIndex = dayCount - 1;

   int sampleCount = 0;
   q = EffectiveQForDay(days, targetDayIndex, sampleCount);
   g_qLastValidQDays = validQDays;
   g_qLastSampleCount = sampleCount;
   g_qLastTargetDayIndex = targetDayIndex;
   g_qLastQ = q;
   g_cachedQ = q;
   g_cachedQDayKey = targetDay;
   g_cachedQReady = q > 0.0 && MathIsValidNumber(q);
   if(g_cachedQReady)
   {
      g_qReadyBuilds++;
      if(g_qFirstReadyBarTime <= 0)
      {
         g_qFirstReadyBarTime = barTime;
         g_qFirstReadySourceFirstTime = g_qLastSourceFirstTime;
      }
   }
   else
   {
      g_qNotReadyBuilds++;
   }
   return g_cachedQReady;
}

bool SendOrder(const int direction, const double lots, const string comment, double &actualPrice)
{
   actualPrice = 0.0;
   MqlTick tick;
   if(SymbolInfoTick(_Symbol, tick))
      actualPrice = direction > 0 ? tick.ask : tick.bid;

   if(!PlaceTesterOrders)
      return true;

   bool ok = direction > 0
      ? g_trade.Buy(lots, _Symbol, 0.0, 0.0, 0.0, comment)
      : g_trade.Sell(lots, _Symbol, 0.0, 0.0, 0.0, comment);

   if(!ok)
   {
      Print("LimniBeta order failed retcode=", g_trade.ResultRetcode(), " error=", GetLastError());
      return false;
   }

   double resultPrice = g_trade.ResultPrice();
   if(resultPrice > 0.0)
      actualPrice = resultPrice;
   return true;
}

bool CloseMagicPositions(double &averageClosePrice, int &closedPositions)
{
   averageClosePrice = 0.0;
   closedPositions = 0;
   bool foundPosition = false;
   bool allClosed = true;

   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0 || !PositionSelectByTicket(ticket))
         continue;
      if(PositionGetString(POSITION_SYMBOL) != _Symbol)
         continue;
      if((long)PositionGetInteger(POSITION_MAGIC) != MagicNumber)
         continue;

      foundPosition = true;
      if(!PlaceTesterOrders)
      {
         closedPositions++;
         continue;
      }

      if(!g_trade.PositionClose(ticket))
      {
         Print("LimniBeta close failed ticket=", ticket, " retcode=", g_trade.ResultRetcode(), " error=", GetLastError());
         allClosed = false;
         continue;
      }

      double resultPrice = g_trade.ResultPrice();
      if(resultPrice > 0.0)
         averageClosePrice += resultPrice;
      closedPositions++;
   }

   if(!foundPosition || !allClosed || closedPositions <= 0)
      return false;

   if(averageClosePrice > 0.0)
      averageClosePrice /= (double)closedPositions;
   return true;
}

double OpenQAtPrice(const double price)
{
   if(!g_gridOpen || g_entryQ <= 0.0 || g_fillCount <= 0)
      return 0.0;

   if(g_direction > 0)
      return (price * g_fillCount - g_entrySum) / g_entryQ;
   return (g_entrySum - price * g_fillCount) / g_entryQ;
}

double GridTpPrice()
{
   if(!g_gridOpen || g_entryQ <= 0.0 || g_direction == 0)
      return 0.0;

   double targetDistance = g_entryQ * MathMax(0.0, TP);
   if(targetDistance <= 0.0)
      return 0.0;

   return g_direction > 0 ? g_avgEntry + targetDistance : g_avgEntry - targetDistance;
}

bool AccountOpenSnapshot(
   double &openMoney,
   double &openPct,
   int &positionsCount,
   double &balance,
   double &equity,
   double &profitTotal
)
{
   openMoney = 0.0;
   openPct = 0.0;
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
      if(PositionGetString(POSITION_SYMBOL) != _Symbol)
         continue;
      if((long)PositionGetInteger(POSITION_MAGIC) != MagicNumber)
         continue;

      openMoney += PositionGetDouble(POSITION_PROFIT) + PositionGetDouble(POSITION_SWAP);
      positionsCount++;
   }

   openPct = 100.0 * openMoney / balance;
   return true;
}

void UpdateAccountOpenPctStats(const double openPct, const int positionsCount)
{
   if(positionsCount <= 0)
      return;

   if(!g_accountOpenPctObserved)
   {
      g_accountOpenPctObserved = true;
      g_accountMaxOpenPct = openPct;
      g_accountMinOpenPct = openPct;
      return;
   }

   if(openPct > g_accountMaxOpenPct)
      g_accountMaxOpenPct = openPct;
   if(openPct < g_accountMinOpenPct)
      g_accountMinOpenPct = openPct;
}

void UpdateGridExcursion(const MqlRates &bar)
{
   if(!g_gridOpen || g_entryQ <= 0.0)
      return;

   double worst = g_direction > 0 ? OpenQAtPrice(bar.low) : OpenQAtPrice(bar.high);
   double best = g_direction > 0 ? OpenQAtPrice(bar.high) : OpenQAtPrice(bar.low);
   if(worst < g_gridMaeQ)
      g_gridMaeQ = worst;
   if(best > g_gridMfeQ)
      g_gridMfeQ = best;
}

void ResetGrid()
{
   g_gridOpen = false;
   g_direction = 0;
   g_entryTime = 0;
   g_entryQ = 0.0;
   g_entrySum = 0.0;
   g_avgEntry = 0.0;
   g_nextGridPrice = 0.0;
   g_fillCount = 0;
   g_gridMfeQ = 0.0;
   g_gridMaeQ = 0.0;
}

bool AddGridFill(const datetime t, const int direction, const double requestedPrice, const double q, const string reason, const int state, const double stochPrevious, const double stochCurrent)
{
   if(WeekBoundaryBlocked(t))
   {
      g_weekBoundaryBlockedActions++;
      LogEvent(t, "FILL_BLOCKED_WEEK_BOUNDARY", direction, state, stochPrevious, stochCurrent, q, requestedPrice, OpenQAtPrice(requestedPrice), reason);
      return false;
   }

   double actualPrice = requestedPrice;
   if(!SendOrder(direction, Lots, "LimniLRMGGrid", actualPrice))
      return false;

   double fillPrice = actualPrice > 0.0 ? actualPrice : requestedPrice;
   if(!g_gridOpen)
   {
      g_gridId++;
      g_gridOpen = true;
      g_direction = direction;
      g_entryTime = t;
      g_entryQ = q;
      g_entrySum = 0.0;
      g_fillCount = 0;
      g_gridMfeQ = 0.0;
      g_gridMaeQ = 0.0;
      g_entriesOpened++;
   }
   else
   {
      g_gridAdds++;
   }

   g_entrySum += fillPrice;
   g_fillCount++;
   if(g_fillCount > g_maxFillCount)
      g_maxFillCount = g_fillCount;
   g_avgEntry = g_entrySum / (double)g_fillCount;

   double step = q * MathMax(0.0, GridSpacingLrmgUnits);
   if(step > 0.0 && g_fillCount < MathMax(1, GridCap))
      g_nextGridPrice = direction > 0 ? fillPrice - step : fillPrice + step;
   else
      g_nextGridPrice = 0.0;

   LogEvent(t, reason == "entry" ? "ENTRY" : "GRID_ADD", direction, state, stochPrevious, stochCurrent, q, fillPrice, OpenQAtPrice(fillPrice), reason);
   return true;
}

double CloseGrid(const datetime t, const double requestedPrice, const string reason, const int state, const double stochPrevious, const double stochCurrent)
{
   if(!g_gridOpen)
      return 0.0;

   if(WeekBoundaryBlocked(t))
   {
      g_weekBoundaryBlockedActions++;
      LogEvent(t, "CLOSE_BLOCKED_WEEK_BOUNDARY", g_direction, state, stochPrevious, stochCurrent, g_entryQ, requestedPrice, OpenQAtPrice(requestedPrice), reason);
      return 0.0;
   }

   double closePrice = requestedPrice;
   int closedPositions = 0;
   if(!CloseMagicPositions(closePrice, closedPositions))
   {
      g_closeFailures++;
      LogEvent(t, "CLOSE_FAILED", g_direction, state, stochPrevious, stochCurrent, g_entryQ, requestedPrice, OpenQAtPrice(requestedPrice), reason);
      return 0.0;
   }

   if(closePrice <= 0.0)
      closePrice = requestedPrice;

   double closedQ = OpenQAtPrice(closePrice);
   g_closedNetQ += closedQ;
   g_closedGrids++;
   LogEvent(t, "CLOSE", g_direction, state, stochPrevious, stochCurrent, g_entryQ, closePrice, closedQ, reason);
   ResetGrid();
   return closedQ;
}

bool ManageGridTp(const MqlRates &bar, const int state, const double stochPrevious, const double stochCurrent)
{
   if(!GridExitScope() || TP <= 0.0 || !g_gridOpen || g_entryQ <= 0.0)
      return false;

   double tpPrice = GridTpPrice();
   if(tpPrice <= 0.0)
      return false;

   bool touched = g_direction > 0 ? bar.high >= tpPrice : bar.low <= tpPrice;
   if(!touched)
      return false;

   double closedQ = CloseGrid(bar.time, tpPrice, "grid_tp", state, stochPrevious, stochCurrent);
   if(closedQ != 0.0 || !g_gridOpen)
      g_gridTpCloses++;
   return !g_gridOpen;
}

bool ManageAccountTp(const MqlRates &bar, const int state, const double stochPrevious, const double stochCurrent)
{
   if(!AccountExitScope() || TP <= 0.0)
      return false;

   double openMoney = 0.0;
   double openPct = 0.0;
   double balance = 0.0;
   double equity = 0.0;
   double profitTotal = 0.0;
   int positionsCount = 0;
   if(!AccountOpenSnapshot(openMoney, openPct, positionsCount, balance, equity, profitTotal))
      return false;

   g_accountLastOpenMoney = openMoney;
   g_accountLastOpenPct = openPct;
   g_accountLastBalance = balance;

   if(positionsCount <= 0)
      return false;

   UpdateAccountOpenPctStats(openPct, positionsCount);

   if(openPct < TP)
      return false;

   string reason = "account_tp_pct=" + DoubleToString(openPct, 6);
   if(!g_gridOpen)
   {
      g_accountTpNoGridCloses++;
      LogEvent(bar.time, "ACCOUNT_TP_NO_GRID", 0, state, stochPrevious, stochCurrent, g_entryQ, bar.close, 0.0, reason);
      return true;
   }

   double closedQ = CloseGrid(bar.time, bar.close, "account_tp", state, stochPrevious, stochCurrent);
   if(closedQ != 0.0 || !g_gridOpen)
      g_accountTpCloses++;
   return !g_gridOpen;
}

void ManageGridAdds(const MqlRates &bar, const int state, const double stochPrevious, const double stochCurrent)
{
   if(!g_gridOpen || g_entryQ <= 0.0 || g_nextGridPrice <= 0.0)
      return;

   UpdateGridExcursion(bar);

   if(WeekBoundaryBlocked(bar.time))
   {
      g_weekBoundaryBlockedActions++;
      LogEvent(bar.time, "GRID_ADD_BLOCKED_WEEK_BOUNDARY", g_direction, state, stochPrevious, stochCurrent, g_entryQ, g_nextGridPrice, OpenQAtPrice(bar.close), "week_boundary");
      return;
   }

   double step = g_entryQ * MathMax(0.0, GridSpacingLrmgUnits);
   if(step <= 0.0)
      return;

   int guard = 0;
   while(g_gridOpen && g_fillCount < MathMax(1, GridCap) && guard < MathMax(1, GridCap))
   {
      bool hit = g_direction > 0 ? bar.low <= g_nextGridPrice : bar.high >= g_nextGridPrice;
      if(!hit)
         break;

      double gridPrice = g_nextGridPrice;
      if(!AddGridFill(bar.time, g_direction, gridPrice, g_entryQ, "grid_add", state, stochPrevious, stochCurrent))
         break;

      if(g_fillCount < MathMax(1, GridCap))
         g_nextGridPrice = g_direction > 0 ? gridPrice - step : gridPrice + step;
      else
         g_nextGridPrice = 0.0;
      guard++;
   }
}

bool CrossedDown(const double previous, const double current, const double level)
{
   return IndicatorValueReady(previous) && IndicatorValueReady(current) && previous >= level && current < level;
}

bool CrossedUp(const double previous, const double current, const double level)
{
   return IndicatorValueReady(previous) && IndicatorValueReady(current) && previous <= level && current > level;
}

int SignalDirection(const int state, const double stochPrevious, const double stochCurrent, string &reason)
{
   reason = "";
   if(state == 0)
      return 0;

   if(EntryMode == Strict)
   {
      if(state != g_observedState)
      {
         g_observedState = state;
         g_triggeredState = 0;
      }

      if(g_triggeredState == state)
      {
         g_ignoredSignalsExistingState++;
         reason = "state_already_triggered";
         return 0;
      }

      if(state < 0 && CrossedDown(stochPrevious, stochCurrent, StochOS))
      {
         reason = "strict_red_state_first_cross_below_os";
         return -1;
      }

      if(state > 0 && CrossedUp(stochPrevious, stochCurrent, StochOB))
      {
         reason = "strict_green_state_first_cross_above_ob";
         return 1;
      }

      g_ignoredSignalsNoCross++;
      reason = "strict_waiting_for_os_ob_cross";
      return 0;
   }

   if(state < 0 && stochCurrent < StochOS)
   {
      reason = "loose_red_state_stoch_below_os";
      return -1;
   }

   if(state > 0 && stochCurrent > StochOB)
   {
      reason = "loose_green_state_stoch_above_ob";
      return 1;
   }

   reason = "loose_condition_not_met";
   return 0;
}

void HandleEntrySignal(const MqlRates &bar, const int signalDirection, const int state, const double stochPrevious, const double stochCurrent, const double q, const string reason)
{
   if(signalDirection == 0)
      return;

   if(WeekBoundaryBlocked(bar.time))
   {
      g_weekBoundaryBlockedActions++;
      LogEvent(bar.time, "SIGNAL_BLOCKED_WEEK_BOUNDARY", signalDirection, state, stochPrevious, stochCurrent, q, bar.close, g_gridOpen ? OpenQAtPrice(bar.close) : 0.0, reason);
      return;
   }

   g_entrySignals++;

   if(q <= 0.0)
   {
      g_ignoredSignalsNoQ++;
      LogEvent(bar.time, "SIGNAL_BLOCKED_NO_Q", signalDirection, state, stochPrevious, stochCurrent, q, bar.close, 0.0, reason);
      return;
   }

   if(g_gridOpen && g_direction == signalDirection)
   {
      g_ignoredSignalsSameSide++;
      LogEvent(bar.time, "SIGNAL_IGNORED_SAME_SIDE_GRID", signalDirection, state, stochPrevious, stochCurrent, q, bar.close, OpenQAtPrice(bar.close), reason);
      if(EntryMode == Strict)
         g_triggeredState = state;
      return;
   }

   if(g_gridOpen && g_direction != signalDirection)
   {
      if(CloseGrid(bar.time, bar.close, "opposite_signal", state, stochPrevious, stochCurrent) == 0.0 && g_gridOpen)
         return;
   }

   if(AddGridFill(bar.time, signalDirection, bar.close, q, "entry", state, stochPrevious, stochCurrent) && EntryMode == Strict)
      g_triggeredState = state;
}

void ProcessClosedM1Bar(const MqlRates &bar)
{
   g_processedClosedBars++;
   if(g_firstProcessedBarTime <= 0)
      g_firstProcessedBarTime = bar.time;
   g_lastProcessedBarTime = bar.time;

   int state = 0;
   double stochCurrent = EMPTY_VALUE;
   double stochPrevious = EMPTY_VALUE;
   if(!CurrentSignalInputs(bar, state, stochCurrent, stochPrevious))
   {
      g_signalInputMissingBars++;
      return;
   }

   g_signalInputReadyBars++;

   if(!TradeAllowedByTime(bar.time))
   {
      g_warmupBlockedBars++;
      if(g_firstWarmupBlockedBarTime <= 0)
         g_firstWarmupBlockedBarTime = bar.time;
      g_lastWarmupBlockedBarTime = bar.time;
      if(g_gridOpen)
         UpdateGridExcursion(bar);
      return;
   }

   g_tradeEligibleBars++;
   if(g_firstTradeEligibleBarTime <= 0)
      g_firstTradeEligibleBarTime = bar.time;
   g_lastTradeEligibleBarTime = bar.time;

   if(WeekBoundaryBlocked(bar.time))
   {
      g_weekBoundaryBlockedBars++;
      if(g_gridOpen)
         UpdateGridExcursion(bar);
      LogEvent(bar.time, "WEEK_BOUNDARY_NO_TRADE", 0, state, stochPrevious, stochCurrent, g_entryQ, bar.close, g_gridOpen ? OpenQAtPrice(bar.close) : 0.0, "week_boundary");
      return;
   }

   if(g_gridOpen)
      UpdateGridExcursion(bar);

   if(ManageAccountTp(bar, state, stochPrevious, stochCurrent))
      return;

   if(ManageGridTp(bar, state, stochPrevious, stochCurrent))
      return;

   ManageGridAdds(bar, state, stochPrevious, stochCurrent);

   string reason = "";
   int signalDirection = SignalDirection(state, stochPrevious, stochCurrent, reason);
   if(signalDirection == 0)
      return;

   double q = 0.0;
   CurrentLrmgQ(bar.time, q);
   HandleEntrySignal(bar, signalDirection, state, stochPrevious, stochCurrent, q, reason);
}

bool LatestClosedM1Bar(MqlRates &bar)
{
   MqlRates rates[];
   ArraySetAsSeries(rates, true);
   if(CopyRates(_Symbol, SignalTimeframe, 1, 1, rates) != 1)
      return false;
   if(rates[0].time <= 0)
      return false;
   bar = rates[0];
   return true;
}

void MarkOpenGridAtEnd()
{
   if(!g_gridOpen)
      return;

   double mark = g_avgEntry;
   MqlTick tick;
   if(SymbolInfoTick(_Symbol, tick))
   {
      if(g_direction > 0 && tick.bid > 0.0)
         mark = tick.bid;
      else if(g_direction < 0 && tick.ask > 0.0)
         mark = tick.ask;
   }

   g_terminalMarkedQ = OpenQAtPrice(mark);
   LogEvent(TimeCurrent(), "OPEN_END", g_direction, g_observedState, EMPTY_VALUE, EMPTY_VALUE, g_entryQ, mark, g_terminalMarkedQ, "terminal_mark");
}

void WriteSummary()
{
   if(g_summaryFile == INVALID_HANDLE)
      return;

   FileWrite(g_summaryFile, "metric", "value");
   FileWrite(g_summaryFile, "symbol", _Symbol);
   FileWrite(g_summaryFile, "run_id", g_runId);
   FileWrite(g_summaryFile, "ea", "LimniBeta");
   FileWrite(g_summaryFile, "diagnostic_only", "true");
   FileWrite(g_summaryFile, "diagnostic_reason", "MT5 terminal history; no canonical price_bundle_id declared.");
   FileWrite(g_summaryFile, "price_bundle_id", "");
   FileWrite(g_summaryFile, "price_source", "mt5_terminal_history");
   FileWrite(g_summaryFile, "signal_source", UseFastInternalSignals ? "FAST_INTERNAL" : "ICUSTOM_INDICATORS");
   FileWrite(g_summaryFile, "fast_internal_signals", BoolText(UseFastInternalSignals));
   FileWrite(g_summaryFile, "source_timeframe", "PERIOD_M1");
   FileWrite(g_summaryFile, "closed_bar_only", "true");
   FileWrite(g_summaryFile, "state_shift", 1);
   FileWrite(g_summaryFile, "stoch_current_shift", 1);
   FileWrite(g_summaryFile, "stoch_previous_shift", 2);
   FileWrite(g_summaryFile, "q_uses_prior_completed_days", "true");
   FileWrite(g_summaryFile, "tester_mode", BoolText((bool)MQLInfoInteger(MQL_TESTER)));
   FileWrite(g_summaryFile, "optimization_mode", BoolText((bool)MQLInfoInteger(MQL_OPTIMIZATION)));
   FileWrite(g_summaryFile, "entry_mode", EntryModeName());
   FileWrite(g_summaryFile, "entry_description", EntryModeDescription());
   FileWrite(g_summaryFile, "scale_lookback_days", ScaleLookbackDays);
   FileWrite(g_summaryFile, "stoch_os", DoubleToString(StochOS, 2));
   FileWrite(g_summaryFile, "stoch_ob", DoubleToString(StochOB, 2));
   FileWrite(g_summaryFile, "exit_scope", ExitScopeName());
   FileWrite(g_summaryFile, "exit_unit", ExitUnitName());
   FileWrite(g_summaryFile, "tp", DoubleToString(TP, 6));
   FileWrite(g_summaryFile, "grid_tp_lrmg_units", GridExitScope() ? DoubleToString(TP, 6) : "");
   FileWrite(g_summaryFile, "account_tp_pct", AccountExitScope() ? DoubleToString(TP, 6) : "");
   FileWrite(g_summaryFile, "grid_spacing_lrmg_units", DoubleToString(GridSpacingLrmgUnits, 6));
   FileWrite(g_summaryFile, "grid_cap", GridCap);
   FileWrite(g_summaryFile, "week_boundary_guard_enabled", BoolText(UseWeekBoundaryGuard));
   FileWrite(g_summaryFile, "broker_to_est_offset_hours", DoubleToString(BrokerToEstOffsetHours, 2));
   FileWrite(g_summaryFile, "week_boundary_description", WeekBoundaryDescription());
   FileWrite(g_summaryFile, "trade_start_time", StampOrBlank(TradeStartTime));
   FileWrite(g_summaryFile, "warmup_gate_enabled", BoolText(TradeStartTime > 0));
   FileWrite(g_summaryFile, "warmup_blocked_bars", g_warmupBlockedBars);
   FileWrite(g_summaryFile, "first_warmup_blocked_bar_time", StampOrBlank(g_firstWarmupBlockedBarTime));
   FileWrite(g_summaryFile, "last_warmup_blocked_bar_time", StampOrBlank(g_lastWarmupBlockedBarTime));
   FileWrite(g_summaryFile, "lots", DoubleToString(Lots, 4));
   FileWrite(g_summaryFile, "processed_closed_bars", g_processedClosedBars);
   FileWrite(g_summaryFile, "signal_input_ready_bars", g_signalInputReadyBars);
   FileWrite(g_summaryFile, "signal_input_missing_bars", g_signalInputMissingBars);
   FileWrite(g_summaryFile, "trade_eligible_bars", g_tradeEligibleBars);
   FileWrite(g_summaryFile, "first_processed_bar_time", StampOrBlank(g_firstProcessedBarTime));
   FileWrite(g_summaryFile, "last_processed_bar_time", StampOrBlank(g_lastProcessedBarTime));
   FileWrite(g_summaryFile, "first_trade_eligible_bar_time", StampOrBlank(g_firstTradeEligibleBarTime));
   FileWrite(g_summaryFile, "last_trade_eligible_bar_time", StampOrBlank(g_lastTradeEligibleBarTime));
   FileWrite(g_summaryFile, "q_copy_requests", g_qCopyRequests);
   FileWrite(g_summaryFile, "q_copy_failures", g_qCopyFailures);
   FileWrite(g_summaryFile, "q_cache_hits", g_qCacheHits);
   FileWrite(g_summaryFile, "q_ready_builds", g_qReadyBuilds);
   FileWrite(g_summaryFile, "q_not_ready_builds", g_qNotReadyBuilds);
   FileWrite(g_summaryFile, "q_last_copy_error", g_qLastCopyError);
   FileWrite(g_summaryFile, "q_last_copied_bars", g_qLastCopiedBars);
   FileWrite(g_summaryFile, "q_min_copied_bars", g_qMinCopiedBars > 0 ? IntegerToString(g_qMinCopiedBars) : "");
   FileWrite(g_summaryFile, "q_max_copied_bars", g_qMaxCopiedBars > 0 ? IntegerToString(g_qMaxCopiedBars) : "");
   FileWrite(g_summaryFile, "q_last_source_from", StampOrBlank(g_qLastSourceFrom));
   FileWrite(g_summaryFile, "q_last_requested_to", StampOrBlank(g_qLastRequestedTo));
   FileWrite(g_summaryFile, "q_last_source_first_time", StampOrBlank(g_qLastSourceFirstTime));
   FileWrite(g_summaryFile, "q_last_source_last_time", StampOrBlank(g_qLastSourceLastTime));
   FileWrite(g_summaryFile, "q_last_day_count", g_qLastDayCount);
   FileWrite(g_summaryFile, "q_last_valid_q_days", g_qLastValidQDays);
   FileWrite(g_summaryFile, "q_last_sample_count", g_qLastSampleCount);
   FileWrite(g_summaryFile, "q_last_target_day_index", g_qLastTargetDayIndex);
   FileWrite(g_summaryFile, "q_first_ready_bar_time", StampOrBlank(g_qFirstReadyBarTime));
   FileWrite(g_summaryFile, "q_first_ready_source_first_time", StampOrBlank(g_qFirstReadySourceFirstTime));
   FileWrite(g_summaryFile, "q_last_q", g_qLastQ > 0.0 ? DoubleToString(g_qLastQ, _Digits) : "");
   FileWrite(g_summaryFile, "fast_q_ready_bars", g_fastQReadyBars);
   FileWrite(g_summaryFile, "fast_q_missing_bars", g_fastQMissingBars);
   FileWrite(g_summaryFile, "fast_completed_q_days", g_fastCompletedQDays);
   FileWrite(g_summaryFile, "fast_q_day_failures", g_fastQDayFailures);
   FileWrite(g_summaryFile, "fast_event_count", g_fastEventCount);
   FileWrite(g_summaryFile, "closed_grids", g_closedGrids);
   FileWrite(g_summaryFile, "entries_opened", g_entriesOpened);
   FileWrite(g_summaryFile, "entry_signals", g_entrySignals);
   FileWrite(g_summaryFile, "grid_adds", g_gridAdds);
   FileWrite(g_summaryFile, "grid_tp_closes", g_gridTpCloses);
   FileWrite(g_summaryFile, "account_tp_closes", g_accountTpCloses);
   FileWrite(g_summaryFile, "account_tp_no_grid_closes", g_accountTpNoGridCloses);
   FileWrite(g_summaryFile, "account_open_pct_max", g_accountOpenPctObserved ? DoubleToString(g_accountMaxOpenPct, 6) : "");
   FileWrite(g_summaryFile, "account_open_pct_min", g_accountOpenPctObserved ? DoubleToString(g_accountMinOpenPct, 6) : "");
   FileWrite(g_summaryFile, "account_last_open_money", DoubleToString(g_accountLastOpenMoney, 2));
   FileWrite(g_summaryFile, "account_last_open_pct", DoubleToString(g_accountLastOpenPct, 6));
   FileWrite(g_summaryFile, "account_last_balance", DoubleToString(g_accountLastBalance, 2));
   FileWrite(g_summaryFile, "max_fill_count", g_maxFillCount);
   FileWrite(g_summaryFile, "closed_net_q", DoubleToString(g_closedNetQ, 6));
   FileWrite(g_summaryFile, "terminal_marked_q", DoubleToString(g_terminalMarkedQ, 6));
   FileWrite(g_summaryFile, "closed_plus_marked_q", DoubleToString(g_closedNetQ + g_terminalMarkedQ, 6));
   FileWrite(g_summaryFile, "ignored_signals_same_side", g_ignoredSignalsSameSide);
   FileWrite(g_summaryFile, "ignored_signals_no_q", g_ignoredSignalsNoQ);
   FileWrite(g_summaryFile, "ignored_signals_no_cross", g_ignoredSignalsNoCross);
   FileWrite(g_summaryFile, "ignored_signals_existing_state", g_ignoredSignalsExistingState);
   FileWrite(g_summaryFile, "week_boundary_blocked_bars", g_weekBoundaryBlockedBars);
   FileWrite(g_summaryFile, "week_boundary_blocked_actions", g_weekBoundaryBlockedActions);
   FileWrite(g_summaryFile, "close_failures", g_closeFailures);
   FileWrite(g_summaryFile, "open_grid_at_end", BoolText(g_gridOpen));
   FileWrite(g_summaryFile, "open_grid_side", SideName(g_direction));
   FileWrite(g_summaryFile, "open_grid_fill_count", g_fillCount);
   FileWrite(g_summaryFile, "open_grid_mfe_q", DoubleToString(g_gridMfeQ, 6));
   FileWrite(g_summaryFile, "open_grid_mae_q", DoubleToString(g_gridMaeQ, 6));
   FileFlush(g_summaryFile);
}

int OnInit()
{
   bool isTester = (bool)MQLInfoInteger(MQL_TESTER) || (bool)MQLInfoInteger(MQL_OPTIMIZATION);
   if(RequireStrategyTester && !isTester)
   {
      Print("LimniBeta is tester-only by default.");
      return INIT_FAILED;
   }

   if(GridCap < 1)
   {
      Print("LimniBeta requires GridCap >= 1.");
      return INIT_FAILED;
   }

   if(TP < 0.0)
   {
      Print("LimniBeta requires TP >= 0. Use TP=0 to disable the selected exit scope.");
      return INIT_FAILED;
   }

   if(StochOS < 0.0 || StochOB > 100.0 || StochOS >= StochOB)
   {
      Print("LimniBeta requires 0 <= StochOS < StochOB <= 100.");
      return INIT_FAILED;
   }

   g_trade.SetExpertMagicNumber(MagicNumber);
   g_trade.SetDeviationInPoints(Slippage);

   if(!UseFastInternalSignals)
   {
      g_stateHandle = iCustom(_Symbol, SignalTimeframe, StateIndicatorName, ScaleLookbackDays, false);
      if(g_stateHandle == INVALID_HANDLE)
      {
         Print("Failed to create state handle for ", StateIndicatorName, ". error=", GetLastError());
         return INIT_FAILED;
      }

      g_stochHandle = iCustom(_Symbol, SignalTimeframe, StochIndicatorName, ScaleLookbackDays, false);
      if(g_stochHandle == INVALID_HANDLE)
      {
         Print("Failed to create Stochastic handle for ", StochIndicatorName, ". error=", GetLastError());
         return INIT_FAILED;
      }
   }

   OpenCsvFiles();

   Print(
      "LimniBeta initialized. symbol=", _Symbol,
      " mode=", EntryModeName(),
      " description=", EntryModeDescription(),
      " scale_days=", ScaleLookbackDays,
      " stoch_os=", DoubleToString(StochOS, 2),
      " stoch_ob=", DoubleToString(StochOB, 2),
      " exit_scope=", ExitScopeName(),
      " exit_unit=", ExitUnitName(),
      " tp=", DoubleToString(TP, 6),
      " grid_spacing_lrmg_units=", DoubleToString(GridSpacingLrmgUnits, 3),
      " grid_cap=", GridCap,
      " week_boundary_guard=", BoolText(UseWeekBoundaryGuard),
      " broker_to_est_offset_hours=", DoubleToString(BrokerToEstOffsetHours, 2),
      " trade_start_time=", StampOrBlank(TradeStartTime),
      " run_id=", g_runId
   );
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
   MarkOpenGridAtEnd();
   WriteSummary();
   CloseCsvFiles();

   if(g_stateHandle != INVALID_HANDLE)
   {
      IndicatorRelease(g_stateHandle);
      g_stateHandle = INVALID_HANDLE;
   }

   if(g_stochHandle != INVALID_HANDLE)
   {
      IndicatorRelease(g_stochHandle);
      g_stochHandle = INVALID_HANDLE;
   }

   Print(
      "LimniBeta finished. symbol=", _Symbol,
      " mode=", EntryModeName(),
      " closed_plus_marked_q=", DoubleToString(g_closedNetQ + g_terminalMarkedQ, 6),
      " run_id=", g_runId
   );
}

void OnTick()
{
   MqlRates bar;
   if(!LatestClosedM1Bar(bar))
      return;

   if(bar.time == g_lastBarTime)
      return;

   g_lastBarTime = bar.time;
   ProcessClosedM1Bar(bar);
}
//+------------------------------------------------------------------+
