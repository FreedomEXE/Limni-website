//+------------------------------------------------------------------+
//|                                           LimniKataraktiEA.mq5   |
//|                 Simple M1 Strategy Tester validation harness     |
//+------------------------------------------------------------------+
#property copyright "LIMNI LTD"
#property version   "1.00"
#property strict

#include <Trade/Trade.mqh>

enum LimniKataraktiMode
{
   KTR_LOOSE = 0,
   KTR_BALANCED = 1,
   KTR_EXTREME = 2
};

input string T0 = "|--------< LimniKataraktiEA >--------|";
input bool RequireStrategyTester = true;
input bool PlaceTesterOrders = true;
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

input string T4 = "Basket";
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

input string T5 = "Export";
input bool ExportCsv = true;
input bool ExportToCommonFiles = true;
input string OutputFolder = "LimniKataraktiEA";

CTrade g_trade;
int g_stochHandle = INVALID_HANDLE;
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
double g_nextGridPrice = 0.0;
double g_trailStopPrice = 0.0;
double g_trailExtreme = 0.0;
int g_fillCount = 0;
double g_basketMaeAdr = 0.0;
double g_basketMfeAdr = 0.0;
double g_basketMinOpenAdr = 0.0;

int g_basketsStarted = 0;
int g_closedBaskets = 0;
int g_wins = 0;
double g_netAdr = 0.0;
double g_totalFillCount = 0.0;
int g_maxFillCount = 0;
double g_maxOpenDrawdownAdr = 0.0;
double g_maxAdverseExcursionAdr = 0.0;
long g_totalBasketSeconds = 0;
int g_unresolvedBaskets = 0;
int g_weeklyCutoffCloses = 0;
double g_weeklyCutoffNetAdr = 0.0;

int g_eventsFile = INVALID_HANDLE;
int g_basketsFile = INVALID_HANDLE;
string g_runId = "";

string SideName(const int direction)
{
   if(direction > 0)
      return "LONG";
   if(direction < 0)
      return "SHORT";
   return "NONE";
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
   if(!correctDirection || body + _Point * 0.1 < requiredBody)
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
      double requiredSweep = MathMax(MinSweepPoints * _Point, activeRange * SweepDepthFraction());
      double requiredBody = MathMax(MinDisplacementBodyPoints * _Point, activeRange * DisplacementBodyFraction());

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

bool CurrentAdr(double &adr)
{
   adr = 0.0;
   MqlRates rates[];
   ArraySetAsSeries(rates, true);
   int lookback = MathMax(1, AdrLookbackDays);
   int copied = CopyRates(_Symbol, PERIOD_D1, 1, lookback, rates);
   if(copied < AdrMinDays)
      return false;

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
      return false;

   adr = sum / used;
   return adr > 0.0;
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

void OpenCsvFiles()
{
   if(!ExportCsv)
      return;

   int fileScope = ExportToCommonFiles ? FILE_COMMON : 0;
   FolderCreate(OutputFolder, fileScope);
   g_runId = SafePart(_Symbol) + "_" + SafePart(TimeToString(TimeLocal(), TIME_DATE | TIME_SECONDS));

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
         "adr",
         "lrmg_line",
         "stoch",
         "fills",
         "avg_entry",
         "open_adr",
         "net_adr",
         "reason"
      );
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
         "entry_adr",
         "fills",
         "avg_entry",
         "exit_price",
         "net_adr",
         "mae_adr",
         "mfe_adr",
         "duration_minutes",
         "close_reason"
      );
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
   if(g_eventsFile == INVALID_HANDLE)
      return;

   FileWrite(
      g_eventsFile,
      Stamp(t),
      _Symbol,
      eventName,
      SideName(side),
      DoubleToString(price, _Digits),
      DoubleToString(adr, _Digits),
      g_lrmgReady ? DoubleToString(g_lrmgLine, _Digits) : "",
      (stoch != EMPTY_VALUE && MathIsValidNumber(stoch)) ? DoubleToString(stoch, 4) : "",
      g_fillCount,
      g_basketOpen ? DoubleToString(g_avgEntry, _Digits) : "",
      (openAdr != EMPTY_VALUE && MathIsValidNumber(openAdr)) ? DoubleToString(openAdr, 6) : "",
      DoubleToString(g_netAdr, 6),
      reason
   );
}

bool SendTesterOrder(const int direction, double &fillPrice)
{
   MqlTick tick;
   if(!SymbolInfoTick(_Symbol, tick))
      return false;

   fillPrice = direction > 0 ? tick.ask : tick.bid;
   if(!PlaceTesterOrders)
      return true;

   bool isTester = (bool)MQLInfoInteger(MQL_TESTER) || (bool)MQLInfoInteger(MQL_OPTIMIZATION);
   if(!isTester)
      return false;

   bool ok = direction > 0
      ? g_trade.Buy(LotSize, _Symbol, 0.0, 0.0, 0.0, "LimniKataraktiEA")
      : g_trade.Sell(LotSize, _Symbol, 0.0, 0.0, 0.0, "LimniKataraktiEA");

   if(!ok)
   {
      Print("LimniKataraktiEA order failed retcode=", g_trade.ResultRetcode(), " error=", GetLastError());
      return false;
   }

   double resultPrice = g_trade.ResultPrice();
   if(resultPrice > 0.0)
      fillPrice = resultPrice;
   return true;
}

void CloseTesterPositions()
{
   if(!PlaceTesterOrders)
      return;

   for(int i = PositionsTotal() - 1; i >= 0; i--)
   {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0 || !PositionSelectByTicket(ticket))
         continue;
      if(PositionGetString(POSITION_SYMBOL) != _Symbol)
         continue;
      if((long)PositionGetInteger(POSITION_MAGIC) != MagicNumber)
         continue;

      if(!g_trade.PositionClose(ticket))
         Print("LimniKataraktiEA close failed ticket=", ticket, " retcode=", g_trade.ResultRetcode(), " error=", GetLastError());
   }
}

double BasketOpenAdrAtPrice(const double price)
{
   if(!g_basketOpen || g_entryAdr <= 0.0 || g_fillCount <= 0)
      return 0.0;

   if(g_direction > 0)
      return (price * g_fillCount - g_entrySum) / g_entryAdr;
   return (g_entrySum - price * g_fillCount) / g_entryAdr;
}

void RecordBasketRow(const datetime exitTime, const double exitPrice, const double closedAdr, const string reason)
{
   if(g_basketsFile == INVALID_HANDLE)
      return;

   long durationSeconds = (long)(exitTime - g_entryTime);
   FileWrite(
      g_basketsFile,
      g_basketId,
      _Symbol,
      SideName(g_direction),
      Stamp(g_entryTime),
      Stamp(exitTime),
      DoubleToString(g_entryAdr, _Digits),
      g_fillCount,
      DoubleToString(g_avgEntry, _Digits),
      DoubleToString(exitPrice, _Digits),
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
   g_nextGridPrice = 0.0;
   g_trailStopPrice = 0.0;
   g_trailExtreme = 0.0;
   g_fillCount = 0;
   g_basketMaeAdr = 0.0;
   g_basketMfeAdr = 0.0;
   g_basketMinOpenAdr = 0.0;
}

bool AddBasketFill(const datetime t, const int direction, const double requestedPrice, const double adr, const string reason)
{
   double fillPrice = requestedPrice;
   if(!SendTesterOrder(direction, fillPrice))
      return false;

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
      g_basketMaeAdr = 0.0;
      g_basketMfeAdr = 0.0;
      g_basketMinOpenAdr = 0.0;
      g_trailStopPrice = 0.0;
      g_trailExtreme = 0.0;
   }

   g_entrySum += fillPrice;
   g_fillCount++;
   g_avgEntry = g_entrySum / (double)g_fillCount;

   if(EnableGridAdds && g_fillCount < MathMax(1, MaxBasketEntries))
      g_nextGridPrice = g_direction > 0 ? fillPrice - g_entryAdr * GridSpacingAdrUnits : fillPrice + g_entryAdr * GridSpacingAdrUnits;
   else
      g_nextGridPrice = 0.0;

   LogEvent(t, reason == "entry" ? "ENTRY" : "GRID_ADD", direction, fillPrice, adr, EMPTY_VALUE, BasketOpenAdrAtPrice(fillPrice), reason);
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

   g_totalFillCount += g_fillCount;
   if(g_fillCount > g_maxFillCount)
      g_maxFillCount = g_fillCount;

   double adverse = -g_basketMaeAdr;
   if(adverse > g_maxAdverseExcursionAdr)
      g_maxAdverseExcursionAdr = adverse;
   if(g_basketMinOpenAdr < g_maxOpenDrawdownAdr)
      g_maxOpenDrawdownAdr = g_basketMinOpenAdr;

   g_totalBasketSeconds += (long)(t - g_entryTime);

   if(reason == "weekly_cutoff")
   {
      g_weeklyCutoffCloses++;
      g_weeklyCutoffNetAdr += closedAdr;
   }

   CloseTesterPositions();
   RecordBasketRow(t, exitPrice, closedAdr, reason);
   LogEvent(t, "EXIT", g_direction, exitPrice, g_entryAdr, EMPTY_VALUE, closedAdr, reason);
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

   bool tpHit = false;
   bool slHit = false;
   bool trailHit = false;
   double exitPrice = 0.0;
   string reason = "";

   if(TpAdrUnits > 0.0)
   {
      double tp = g_direction > 0 ? g_avgEntry + g_entryAdr * TpAdrUnits : g_avgEntry - g_entryAdr * TpAdrUnits;
      tpHit = g_direction > 0 ? bar.high >= tp : bar.low <= tp;
      if(tpHit)
      {
         exitPrice = tp;
         reason = "tp";
      }
   }

   if(!tpHit && SlAdrUnits > 0.0)
   {
      double sl = g_direction > 0 ? g_avgEntry - g_entryAdr * SlAdrUnits : g_avgEntry + g_entryAdr * SlAdrUnits;
      slHit = g_direction > 0 ? bar.low <= sl : bar.high >= sl;
      if(slHit)
      {
         exitPrice = sl;
         reason = "sl";
      }
   }

   if(!tpHit && !slHit && g_trailStopPrice > 0.0)
   {
      trailHit = g_direction > 0 ? bar.low <= g_trailStopPrice : bar.high >= g_trailStopPrice;
      if(trailHit)
      {
         exitPrice = g_trailStopPrice;
         reason = "trail";
      }
   }

   if(reason != "")
   {
      CloseBasket(bar.time, exitPrice, reason);
      return;
   }

   if(EnableGridAdds && g_nextGridPrice > 0.0 && g_fillCount < MathMax(1, MaxBasketEntries))
   {
      double step = g_entryAdr * GridSpacingAdrUnits;
      int guard = 0;
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
      }
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
   bool adrReady = CurrentAdr(adr);
   bool stochReady = CurrentStoch(stoch);
   bool belowLrmg = g_lrmgReady && bar.close < g_lrmgLine;
   bool aboveLrmg = g_lrmgReady && bar.close > g_lrmgLine;

   bool buySignal = EnableLongs && ktrLong && belowLrmg && stochReady && stoch <= Oversold;
   bool sellSignal = EnableShorts && ktrShort && aboveLrmg && stochReady && stoch >= Overbought;

   if((buySignal || sellSignal) && adrReady)
      LogEvent(bar.time, buySignal ? "BUY_SIGNAL" : "SELL_SIGNAL", buySignal ? 1 : -1, bar.close, adr, stoch, 0.0, "signal");

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

   FileWrite(handle, "metric", "value");
   FileWrite(handle, "symbol", _Symbol);
   FileWrite(handle, "run_id", g_runId);
   FileWrite(handle, "closed_baskets", g_closedBaskets);
   FileWrite(handle, "net_adr", DoubleToString(g_netAdr, 6));
   FileWrite(handle, "win_rate_pct", DoubleToString(winRate, 4));
   FileWrite(handle, "max_open_drawdown_adr", DoubleToString(g_maxOpenDrawdownAdr, 6));
   FileWrite(handle, "max_adverse_excursion_adr", DoubleToString(g_maxAdverseExcursionAdr, 6));
   FileWrite(handle, "max_basket_fill_count", g_maxFillCount);
   FileWrite(handle, "average_fill_count", DoubleToString(avgFills, 4));
   FileWrite(handle, "average_time_in_basket_minutes", DoubleToString(avgMinutes, 2));
   FileWrite(handle, "unresolved_open_baskets_at_end", g_unresolvedBaskets);
   FileWrite(handle, "pair_contribution_net_adr", DoubleToString(g_netAdr, 6));
   FileWrite(handle, "weekly_cutoff_closes", g_weeklyCutoffCloses);
   FileWrite(handle, "weekly_cutoff_net_adr", DoubleToString(g_weeklyCutoffNetAdr, 6));
   FileWrite(handle, "place_tester_orders", PlaceTesterOrders ? "true" : "false");
   FileClose(handle);
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
      Print("LimniKataraktiEA: chart period is ", EnumToString((ENUM_TIMEFRAMES)_Period), ". Logic still reads closed M1 bars directly.");

   g_trade.SetExpertMagicNumber(MagicNumber);
   g_trade.SetDeviationInPoints(SlippagePoints);

   g_stochHandle = iStochastic(_Symbol, PERIOD_M1, StochKPeriod, StochDPeriod, StochSlowing, MODE_SMA, STO_LOWHIGH);
   if(g_stochHandle == INVALID_HANDLE)
   {
      Print("LimniKataraktiEA failed to create M1 stochastic handle. error=", GetLastError());
      return INIT_FAILED;
   }

   OpenCsvFiles();
   Print("LimniKataraktiEA initialized on ", _Symbol, ". Run on M1 Strategy Tester for the intended validation path. CSV run_id=", g_runId);
   return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
   if(g_basketOpen)
   {
      double endPrice = SymbolInfoDouble(_Symbol, SYMBOL_BID);
      g_unresolvedBaskets = 1;
      RecordBasketRow(TimeCurrent(), endPrice, BasketOpenAdrAtPrice(endPrice), "open_end");
   }

   WriteSummary();
   CloseCsvFiles();

   if(g_stochHandle != INVALID_HANDLE)
   {
      IndicatorRelease(g_stochHandle);
      g_stochHandle = INVALID_HANDLE;
   }

   Print(
      "LimniKataraktiEA finished. symbol=", _Symbol,
      " closed_baskets=", g_closedBaskets,
      " net_adr=", DoubleToString(g_netAdr, 6),
      " win_rate=", g_closedBaskets > 0 ? DoubleToString((double)g_wins * 100.0 / (double)g_closedBaskets, 2) : "0.00",
      "% unresolved=", g_unresolvedBaskets,
      " run_id=", g_runId
   );
}

void OnTick()
{
   MqlRates rates[];
   ArraySetAsSeries(rates, true);
   if(CopyRates(_Symbol, PERIOD_M1, 1, 1, rates) != 1)
      return;

   if(rates[0].time <= 0 || rates[0].time == g_lastM1BarTime)
      return;

   g_lastM1BarTime = rates[0].time;
   ProcessClosedM1Bar(rates[0]);
}
//+------------------------------------------------------------------+
