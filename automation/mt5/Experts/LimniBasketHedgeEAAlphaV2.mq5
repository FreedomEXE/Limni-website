//+------------------------------------------------------------------+
//|                         LimniBasketHedgeEAAlphaV2.mq5            |
//|                Alpha V2 fully hedged grid visual prototype       |
//+------------------------------------------------------------------+
#property strict
#property version "1.000"

#include <Trade/Trade.mqh>
#include "Include/Strategy/WeeklyBoundary.mqh"

enum HedgeGridMode
{
  RAW = 0,
  GRID_CAP = 1
};

enum BoundaryTimeSource
{
  BOUNDARY_TIME_SERVER = 0,
  BOUNDARY_TIME_GMT = 1
};

input HedgeGridMode Mode = RAW;
input string SymbolsCsv = "";
input bool UseCurrentChartSymbolOnly = true;
input double LotSize = 0.01;
input double AdrValue = 0.0;
input double EntryAdrMultiple = 1.0;
input double TargetAdrMultiple = 1.0;
input double SpacingAdrMultiple = 0.2;
input int MaxPositionsPerSymbol = 200;
input bool EnableTrading = true;
input bool AllowLiveTrading = false;
input bool ManualFlattenNow = false;
input long MagicNumberBase = 820820;
input int SlippagePoints = 10;
input int MaxOrdersPerTick = 5;
input BoundaryTimeSource WeekBoundaryTimeSource = BOUNDARY_TIME_SERVER;
input int ServerUtcOffsetHours = 0;
input bool EnableChartVisuals = true;
input int VisualRefreshSeconds = 1;
input int DashboardRefreshSeconds = 1;
input int DashboardMaxSymbols = 28;
input bool CsvLogEnabled = true;

const string BUILD_NAME = "Limni Basket Hedge EA Alpha V2";
const int GRID_CAP_RESET_LIMIT_PER_SIDE_WEEK = 3;

struct SymbolRuntime
{
  string symbol;
  long magic;
  datetime weekStartGmt;
  int longWeeklyResets;
  int shortWeeklyResets;
  int totalResets;
  int totalFills;
  int longNextAdverse;
  int longNextFavorable;
  int shortNextAdverse;
  int shortNextFavorable;
  double longAnchor;
  double shortAnchor;
  datetime priceAnchorWeekStartGmt;
  bool priceAnchorSeeded;
  int priceAnchorTicks;
  double priceAnchorHigh;
  double priceAnchorLow;
  double prevPriceAnchorHigh;
  double prevPriceAnchorLow;
  double longEntryLevel;
  double shortEntryLevel;
  bool capHit;
  string lastAction;
  string lastError;
};

struct PositionSnapshot
{
  int totalCount;
  int longCount;
  int shortCount;
  double longLots;
  double shortLots;
  double openPnl;
  double openSwap;
};

struct ClosedSnapshot
{
  int closedDeals;
  double profit;
  double commission;
  double swap;
};

CTrade g_trade;
SymbolRuntime g_symbols[];
datetime g_startedAt = 0;
datetime g_lastManage = 0;
datetime g_lastDashboard = 0;
datetime g_lastVisual = 0;
double g_peakEquity = 0.0;
double g_maxDrawdown = 0.0;
string g_lastAction = "";
string g_lastError = "";
bool g_hedgingSupported = false;
bool g_tradeGateOk = false;

//+------------------------------------------------------------------+
int OnInit()
{
  g_startedAt = TimeCurrent();
  g_peakEquity = AccountInfoDouble(ACCOUNT_EQUITY);
  g_maxDrawdown = 0.0;
  g_lastAction = "INIT";
  g_lastError = "";

  g_hedgingSupported = IsHedgingAccount();
  if(!g_hedgingSupported)
  {
    g_lastError = "UNSUPPORTED_ACCOUNT_NETTING_ONLY";
    Print(BUILD_NAME + " unsupported account: hedging account required.");
  }

  BuildSymbolList();
  g_trade.SetDeviationInPoints(SlippagePoints);

  for(int i = 0; i < ArraySize(g_symbols); i++)
  {
    LoadSymbolState(i);
    EnsureSymbolSelected(g_symbols[i].symbol);
  }

  EventSetTimer(1);
  UpdateDashboard(true);
  UpdateChartVisuals(true);
  Print(StringFormat("%s initialized. mode=%s symbols=%d", BUILD_NAME, ModeName(), ArraySize(g_symbols)));
  return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
  for(int i = 0; i < ArraySize(g_symbols); i++)
    SaveSymbolState(i);
  EventKillTimer();
  Comment("");
}

//+------------------------------------------------------------------+
void OnTick()
{
  ManageAllSymbols();
}

//+------------------------------------------------------------------+
void OnTimer()
{
  ManageAllSymbols();
  UpdateDashboard(false);
  UpdateChartVisuals(false);
}

//+------------------------------------------------------------------+
void ManageAllSymbols()
{
  UpdateDrawdown();
  g_tradeGateOk = IsTradingAllowedNow();

  int ordersThisTick = 0;
  if(ManualFlattenNow && ArraySize(g_symbols) > 0)
  {
    for(int i = 0; i < ArraySize(g_symbols); i++)
      CloseAllOwnPositionsForSymbol(i, "MANUAL_FLATTEN");
    g_lastAction = "MANUAL_FLATTEN_REQUESTED";
    return;
  }

  for(int i = 0; i < ArraySize(g_symbols); i++)
  {
    CheckWeekBoundary(i);
    RefreshWeeklyPriceAnchor(i);
    RecoverAnchorsIfNeeded(i);

    if(!g_tradeGateOk)
      continue;

    ManageLeg(i, POSITION_TYPE_BUY, ordersThisTick);
    ManageLeg(i, POSITION_TYPE_SELL, ordersThisTick);

    SaveSymbolState(i);
    if(ordersThisTick >= MaxOrdersPerTick)
      break;
  }
}

//+------------------------------------------------------------------+
void ManageLeg(const int index, const int side, int &ordersThisTick)
{
  if(index < 0 || index >= ArraySize(g_symbols))
    return;
  if(MaxOrdersPerTick > 0 && ordersThisTick >= MaxOrdersPerTick)
    return;

  string symbol = g_symbols[index].symbol;
  double adr = GetAdrValue(symbol);
  if(adr <= 0.0)
  {
    SetSymbolError(index, "ADR_UNAVAILABLE");
    return;
  }

  PositionSnapshot snapshot;
  GetPositionSnapshot(symbol, g_symbols[index].magic, snapshot);
  if(MaxPositionsPerSymbol > 0 && snapshot.totalCount >= MaxPositionsPerSymbol)
  {
    if(!g_symbols[index].capHit)
    {
      g_symbols[index].capHit = true;
      SetSymbolAction(index, "SAFETY_CAP_HIT");
      LogSymbolState(index);
    }
    return;
  }
  g_symbols[index].capHit = false;

  ManageCarriedWeekSideCycles(index, side, adr);

  string weekTag = CurrentWeekTag(index);
  PositionSnapshot weekSideSnapshot;
  GetWeekSidePositionSnapshot(symbol, g_symbols[index].magic, side, weekTag, weekSideSnapshot);

  int sideCount = weekSideSnapshot.totalCount;
  int sideWeeklyResets = (side == POSITION_TYPE_BUY ? g_symbols[index].longWeeklyResets : g_symbols[index].shortWeeklyResets);
  if(Mode == GRID_CAP && sideWeeklyResets >= GRID_CAP_RESET_LIMIT_PER_SIDE_WEEK)
    return;

  if(sideCount <= 0)
  {
    if(!IsTradeWindowOpenForSymbol(index))
      return;
    if(!ShouldOpenInitialSide(index, side, adr))
      return;

    if(OpenGridFill(index, side, "INITIAL", ordersThisTick))
    {
      double filled = g_trade.ResultPrice();
      if(filled <= 0.0)
        filled = RequestedEntryPrice(symbol, side);
      SetAnchor(index, side, filled);
      SetNextLevels(index, side, 1, 1);
    }
    return;
  }

  double legAdrPnl = GetWeekSideAdrPnl(symbol, g_symbols[index].magic, side, adr, weekTag);
  if(legAdrPnl >= TargetAdrMultiple)
  {
    if(!IsTradeWindowOpenForSymbol(index))
    {
      SetSymbolAction(index, SideName(side) + "_TARGET_HELD_OUTSIDE_TRADE_WINDOW");
      return;
    }

    int positionsClosed = CloseLegPositionsForWeek(index, side, weekTag, "TARGET_RESET");
    if(positionsClosed > 0)
    {
      IncrementReset(index, side);
      ClearAnchor(index, side);
      LogReset(index, SideName(side) + "_TARGET_RESET", positionsClosed, "LEG_ADR_TARGET_HIT");
      SetSymbolAction(index, SideName(side) + "_TARGET_RESET");
    }
    return;
  }

  double anchor = GetAnchor(index, side);
  if(anchor <= 0.0)
  {
    RecoverAnchorForLeg(index, side);
    anchor = GetAnchor(index, side);
    if(anchor <= 0.0)
      return;
  }

  double mark = MarkPrice(symbol, side);
  if(mark <= 0.0)
    return;

  double directedAdr = (side == POSITION_TYPE_BUY)
    ? (mark - anchor) / adr
    : (anchor - mark) / adr;

  if(!IsTradeWindowOpenForSymbol(index))
    return;

  while(MaxOrdersPerTick <= 0 || ordersThisTick < MaxOrdersPerTick)
  {
    int nextAdverse = GetNextAdverse(index, side);
    if(directedAdr <= -SpacingAdrMultiple * nextAdverse)
    {
      if(!OpenGridFill(index, side, "ADVERSE_RECOVERY_L" + IntegerToString(nextAdverse), ordersThisTick))
        break;
      SetNextAdverse(index, side, nextAdverse + 1);
      continue;
    }
    break;
  }

  while(MaxOrdersPerTick <= 0 || ordersThisTick < MaxOrdersPerTick)
  {
    int nextFavorable = GetNextFavorable(index, side);
    if(directedAdr >= SpacingAdrMultiple * nextFavorable)
    {
      if(!OpenGridFill(index, side, "FAVORABLE_EXPANSION_L" + IntegerToString(nextFavorable), ordersThisTick))
        break;
      SetNextFavorable(index, side, nextFavorable + 1);
      continue;
    }
    break;
  }
}

//+------------------------------------------------------------------+
bool OpenGridFill(const int index, const int side, const string reason, int &ordersThisTick)
{
  string symbol = g_symbols[index].symbol;
  double volume = NormalizeVolume(symbol, LotSize);
  if(volume <= 0.0)
  {
    SetSymbolError(index, "INVALID_VOLUME");
    return false;
  }

  double requested = RequestedEntryPrice(symbol, side);
  if(requested <= 0.0)
  {
    SetSymbolError(index, "NO_MARKET_PRICE");
    return false;
  }

  g_trade.SetExpertMagicNumber(g_symbols[index].magic);
  g_trade.SetTypeFillingBySymbol(symbol);

  string comment = BuildOrderComment(index, side, reason);
  ResetLastError();
  bool ok = false;
  if(side == POSITION_TYPE_BUY)
    ok = g_trade.Buy(volume, symbol, 0.0, 0.0, 0.0, comment);
  else
    ok = g_trade.Sell(volume, symbol, 0.0, 0.0, 0.0, comment);

  if(!ok)
  {
    string err = "ORDER_FAILED_" + IntegerToString((int)g_trade.ResultRetcode()) + "_" + g_trade.ResultRetcodeDescription();
    SetSymbolError(index, err);
    g_lastError = g_symbols[index].symbol + ":" + err;
    LogFill(index, "OPEN_FAILED", side, volume, requested, 0.0, reason);
    return false;
  }

  ordersThisTick++;
  g_symbols[index].totalFills++;
  SetSymbolAction(index, SideName(side) + "_" + reason);
  g_lastAction = symbol + ":" + SideName(side) + "_" + reason;
  LogFill(index, "OPEN", side, volume, requested, g_trade.ResultPrice(), reason);
  LogSymbolState(index);
  return true;
}

//+------------------------------------------------------------------+
int CloseLegPositions(const int index, const int side, const string reason)
{
  ulong tickets[];
  ArrayResize(tickets, 0);
  string symbol = g_symbols[index].symbol;
  long magic = g_symbols[index].magic;

  for(int i = PositionsTotal() - 1; i >= 0; i--)
  {
    ulong ticket = PositionGetTicket(i);
    if(ticket == 0 || !PositionSelectByTicket(ticket))
      continue;
    if(PositionGetString(POSITION_SYMBOL) != symbol)
      continue;
    if((long)PositionGetInteger(POSITION_MAGIC) != magic)
      continue;
    if((int)PositionGetInteger(POSITION_TYPE) != side)
      continue;
    int size = ArraySize(tickets);
    ArrayResize(tickets, size + 1);
    tickets[size] = ticket;
  }

  int closed = 0;
  for(int i = 0; i < ArraySize(tickets); i++)
  {
    g_trade.SetExpertMagicNumber(magic);
    if(g_trade.PositionClose(tickets[i], SlippagePoints))
      closed++;
    else
      SetSymbolError(index, "CLOSE_FAILED_" + IntegerToString((int)g_trade.ResultRetcode()));
  }

  if(closed > 0)
  {
    SetSymbolAction(index, SideName(side) + "_" + reason);
    g_lastAction = symbol + ":" + SideName(side) + "_" + reason;
  }
  return closed;
}

//+------------------------------------------------------------------+
int CloseLegPositionsForWeek(const int index, const int side, const string weekTag, const string reason)
{
  ulong tickets[];
  ArrayResize(tickets, 0);
  string symbol = g_symbols[index].symbol;
  long magic = g_symbols[index].magic;

  for(int i = PositionsTotal() - 1; i >= 0; i--)
  {
    ulong ticket = PositionGetTicket(i);
    if(ticket == 0 || !PositionSelectByTicket(ticket))
      continue;
    if(PositionGetString(POSITION_SYMBOL) != symbol)
      continue;
    if((long)PositionGetInteger(POSITION_MAGIC) != magic)
      continue;
    if((int)PositionGetInteger(POSITION_TYPE) != side)
      continue;
    if(!PositionHasWeekTag(weekTag))
      continue;

    int size = ArraySize(tickets);
    ArrayResize(tickets, size + 1);
    tickets[size] = ticket;
  }

  int closed = 0;
  for(int i = 0; i < ArraySize(tickets); i++)
  {
    g_trade.SetExpertMagicNumber(magic);
    if(g_trade.PositionClose(tickets[i], SlippagePoints))
      closed++;
    else
      SetSymbolError(index, "CLOSE_FAILED_" + IntegerToString((int)g_trade.ResultRetcode()));
  }

  if(closed > 0)
  {
    SetSymbolAction(index, SideName(side) + "_" + reason + "_W" + weekTag);
    g_lastAction = symbol + ":" + SideName(side) + "_" + reason + "_W" + weekTag;
  }
  return closed;
}

//+------------------------------------------------------------------+
void ManageCarriedWeekSideCycles(const int index, const int side, const double adr)
{
  if(!IsTradeWindowOpenForSymbol(index))
    return;

  string currentTag = CurrentWeekTag(index);
  string tags[];
  ArrayResize(tags, 0);
  string symbol = g_symbols[index].symbol;
  long magic = g_symbols[index].magic;

  for(int i = 0; i < PositionsTotal(); i++)
  {
    ulong ticket = PositionGetTicket(i);
    if(ticket == 0 || !PositionSelectByTicket(ticket))
      continue;
    if(PositionGetString(POSITION_SYMBOL) != symbol)
      continue;
    if((long)PositionGetInteger(POSITION_MAGIC) != magic)
      continue;
    if((int)PositionGetInteger(POSITION_TYPE) != side)
      continue;

    string tag = PositionWeekTag();
    if(tag == "" || tag == currentTag)
      continue;
    AddUniqueTag(tags, tag);
  }

  for(int t = 0; t < ArraySize(tags); t++)
  {
    double carriedAdrPnl = GetWeekSideAdrPnl(symbol, magic, side, adr, tags[t]);
    if(carriedAdrPnl < TargetAdrMultiple)
      continue;

    int positionsClosed = CloseLegPositionsForWeek(index, side, tags[t], "CARRY_TARGET_CLOSE");
    if(positionsClosed > 0)
    {
      g_symbols[index].totalResets++;
      LogReset(index, SideName(side) + "_CARRY_TARGET_CLOSE", positionsClosed, "CARRIED_WEEK_LEG_ADR_TARGET_HIT_W" + tags[t]);
      SetSymbolAction(index, SideName(side) + "_CARRY_TARGET_CLOSE_W" + tags[t]);
    }
  }
}

//+------------------------------------------------------------------+
void AddUniqueTag(string &tags[], const string tag)
{
  for(int i = 0; i < ArraySize(tags); i++)
  {
    if(tags[i] == tag)
      return;
  }
  int size = ArraySize(tags);
  ArrayResize(tags, size + 1);
  tags[size] = tag;
}

//+------------------------------------------------------------------+
string PositionWeekTag()
{
  string comment = PositionGetString(POSITION_COMMENT);
  string parts[];
  int count = StringSplit(comment, '|', parts);
  if(count < 5)
    return "";
  if(parts[0] != "G82C")
    return "";
  return parts[3];
}

//+------------------------------------------------------------------+
void CloseAllOwnPositionsForSymbol(const int index, const string reason)
{
  CloseLegPositions(index, POSITION_TYPE_BUY, reason);
  CloseLegPositions(index, POSITION_TYPE_SELL, reason);
  LogReset(index, reason, 0, reason);
}

//+------------------------------------------------------------------+
bool IsTradingAllowedNow()
{
  if(!EnableTrading)
  {
    g_lastError = "TRADING_DISABLED_BY_INPUT";
    return false;
  }
  if(!g_hedgingSupported)
  {
    g_lastError = "HEDGING_ACCOUNT_REQUIRED";
    return false;
  }
  if(!MQLInfoInteger(MQL_TESTER) && !AllowLiveTrading)
  {
    g_lastError = "LIVE_TRADING_BLOCKED_ALLOW_LIVE_FALSE";
    return false;
  }
  if(!TerminalInfoInteger(TERMINAL_TRADE_ALLOWED))
  {
    g_lastError = "TERMINAL_TRADE_NOT_ALLOWED";
    return false;
  }
  if(!MQLInfoInteger(MQL_TRADE_ALLOWED))
  {
    g_lastError = "EA_TRADE_NOT_ALLOWED";
    return false;
  }
  g_lastError = "";
  return true;
}

//+------------------------------------------------------------------+
bool IsHedgingAccount()
{
  long mode = AccountInfoInteger(ACCOUNT_MARGIN_MODE);
  return mode == ACCOUNT_MARGIN_MODE_RETAIL_HEDGING;
}

//+------------------------------------------------------------------+
void BuildSymbolList()
{
  ArrayResize(g_symbols, 0);

  if(UseCurrentChartSymbolOnly || SymbolsCsv == "")
  {
    AddSymbol(_Symbol);
    return;
  }

  string parts[];
  int count = StringSplit(SymbolsCsv, ',', parts);
  for(int i = 0; i < count; i++)
  {
    string symbol = parts[i];
    StringTrimLeft(symbol);
    StringTrimRight(symbol);
    if(symbol != "")
      AddSymbol(symbol);
  }

  if(ArraySize(g_symbols) == 0)
    AddSymbol(_Symbol);
}

//+------------------------------------------------------------------+
void AddSymbol(const string symbol)
{
  string clean = symbol;
  StringTrimLeft(clean);
  StringTrimRight(clean);
  if(clean == "")
    return;

  for(int i = 0; i < ArraySize(g_symbols); i++)
  {
    if(g_symbols[i].symbol == clean)
      return;
  }

  int size = ArraySize(g_symbols);
  ArrayResize(g_symbols, size + 1);
  g_symbols[size].symbol = clean;
  g_symbols[size].magic = MagicForSymbol(clean);
  g_symbols[size].weekStartGmt = LimniGetWeekStartGmt(BoundaryNowGmt());
  g_symbols[size].longWeeklyResets = 0;
  g_symbols[size].shortWeeklyResets = 0;
  g_symbols[size].totalResets = 0;
  g_symbols[size].totalFills = 0;
  g_symbols[size].longNextAdverse = 1;
  g_symbols[size].longNextFavorable = 1;
  g_symbols[size].shortNextAdverse = 1;
  g_symbols[size].shortNextFavorable = 1;
  g_symbols[size].longAnchor = 0.0;
  g_symbols[size].shortAnchor = 0.0;
  ResetWeeklyPriceAnchor(size, g_symbols[size].weekStartGmt);
  g_symbols[size].capHit = false;
  g_symbols[size].lastAction = "INIT";
  g_symbols[size].lastError = "";
}

//+------------------------------------------------------------------+
bool EnsureSymbolSelected(const string symbol)
{
  if(SymbolSelect(symbol, true))
    return true;
  g_lastError = "SYMBOL_SELECT_FAILED_" + symbol;
  return false;
}

//+------------------------------------------------------------------+
long MagicForSymbol(const string symbol)
{
  long hash = 0;
  for(int i = 0; i < StringLen(symbol); i++)
    hash = (hash * 131 + StringGetCharacter(symbol, i)) % 900000;
  return MagicNumberBase + (Mode == GRID_CAP ? 1000000 : 0) + hash;
}

//+------------------------------------------------------------------+
void CheckWeekBoundary(const int index)
{
  datetime currentWeek = LimniGetWeekStartGmt(BoundaryNowGmt());
  if(g_symbols[index].weekStartGmt == currentWeek)
    return;

  g_symbols[index].weekStartGmt = currentWeek;
  g_symbols[index].longWeeklyResets = 0;
  g_symbols[index].shortWeeklyResets = 0;
  ResetWeeklyPriceAnchor(index, currentWeek);
  SetSymbolAction(index, "WEEK_BOUNDARY_RESET");
  LogReset(index, "WEEK_BOUNDARY", 0, "WEEKLY_L3_COUNTER_RESET_NO_FLATTEN");
  SaveSymbolState(index);
}

//+------------------------------------------------------------------+
datetime BoundaryNowGmt()
{
  if(WeekBoundaryTimeSource == BOUNDARY_TIME_GMT)
    return TimeGMT();
  return TimeCurrent() - ServerUtcOffsetHours * 3600;
}

//+------------------------------------------------------------------+
bool IsEntryWindowOpenForSymbol(const int index)
{
  return IsTradeWindowOpenForSymbol(index);
}

//+------------------------------------------------------------------+
bool IsActionWindowOpenForSymbol(const int index)
{
  return IsTradeWindowOpenForSymbol(index);
}

//+------------------------------------------------------------------+
bool IsTradeWindowOpenForSymbol(const int index)
{
  return LimniIsTradeWindowOpen(BoundaryNowGmt(), g_symbols[index].weekStartGmt);
}

//+------------------------------------------------------------------+
void ResetWeeklyPriceAnchor(const int index, const datetime weekStartGmt)
{
  g_symbols[index].priceAnchorWeekStartGmt = weekStartGmt;
  g_symbols[index].priceAnchorSeeded = false;
  g_symbols[index].priceAnchorTicks = 0;
  g_symbols[index].priceAnchorHigh = 0.0;
  g_symbols[index].priceAnchorLow = 0.0;
  g_symbols[index].prevPriceAnchorHigh = 0.0;
  g_symbols[index].prevPriceAnchorLow = 0.0;
  g_symbols[index].longEntryLevel = 0.0;
  g_symbols[index].shortEntryLevel = 0.0;
  ClearAnchor(index, POSITION_TYPE_BUY);
  ClearAnchor(index, POSITION_TYPE_SELL);
}

//+------------------------------------------------------------------+
void RefreshWeeklyPriceAnchor(const int index)
{
  if(index < 0 || index >= ArraySize(g_symbols))
    return;

  string symbol = g_symbols[index].symbol;
  MqlTick tick;
  if(!SymbolInfoTick(symbol, tick))
    return;

  datetime nowGmt = BoundaryNowGmt();
  if(nowGmt < g_symbols[index].weekStartGmt)
    return;
  if(!IsTradeWindowOpenForSymbol(index))
    return;

  double high = MathMax(tick.bid, tick.ask);
  double low = MathMin(tick.bid, tick.ask);
  if(high <= 0.0 || low <= 0.0)
    return;

  if(g_symbols[index].priceAnchorWeekStartGmt != g_symbols[index].weekStartGmt)
    ResetWeeklyPriceAnchor(index, g_symbols[index].weekStartGmt);

  if(!g_symbols[index].priceAnchorSeeded)
  {
    g_symbols[index].priceAnchorHigh = high;
    g_symbols[index].priceAnchorLow = low;
    g_symbols[index].prevPriceAnchorHigh = high;
    g_symbols[index].prevPriceAnchorLow = low;
    g_symbols[index].priceAnchorTicks = 0;
    g_symbols[index].priceAnchorSeeded = true;
    SetSymbolAction(index, "WEEK_PRICE_ANCHOR_SEEDED");
    return;
  }

  g_symbols[index].prevPriceAnchorHigh = g_symbols[index].priceAnchorHigh;
  g_symbols[index].prevPriceAnchorLow = g_symbols[index].priceAnchorLow;
  g_symbols[index].priceAnchorHigh = MathMax(g_symbols[index].priceAnchorHigh, high);
  g_symbols[index].priceAnchorLow = MathMin(g_symbols[index].priceAnchorLow, low);
  g_symbols[index].priceAnchorTicks++;

  double adr = GetAdrValue(symbol);
  if(adr > 0.0 && PriceAnchorReady(index))
  {
    g_symbols[index].longEntryLevel = g_symbols[index].prevPriceAnchorHigh - adr * EntryAdrMultiple;
    g_symbols[index].shortEntryLevel = g_symbols[index].prevPriceAnchorLow + adr * EntryAdrMultiple;
  }
}

//+------------------------------------------------------------------+
bool PriceAnchorReady(const int index)
{
  return g_symbols[index].priceAnchorSeeded &&
         g_symbols[index].priceAnchorTicks >= 1 &&
         g_symbols[index].prevPriceAnchorHigh > 0.0 &&
         g_symbols[index].prevPriceAnchorLow > 0.0;
}

//+------------------------------------------------------------------+
bool ShouldOpenInitialSide(const int index, const int side, const double adr)
{
  if(adr <= 0.0 || !PriceAnchorReady(index))
    return false;

  string symbol = g_symbols[index].symbol;
  double trigger = RequestedEntryPrice(symbol, side);
  if(trigger <= 0.0)
    return false;

  double entry = (side == POSITION_TYPE_BUY ? g_symbols[index].longEntryLevel : g_symbols[index].shortEntryLevel);
  if(entry <= 0.0)
    return false;

  if(side == POSITION_TYPE_BUY)
    return trigger <= entry;
  return trigger >= entry;
}

//+------------------------------------------------------------------+
double GetAdrValue(const string symbol)
{
  if(AdrValue > 0.0)
    return AdrValue;

  MqlRates rates[];
  ArraySetAsSeries(rates, true);
  int copied = CopyRates(symbol, PERIOD_D1, 1, 14, rates);
  if(copied <= 0)
    return 0.0;

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
  return used > 0 ? sum / used : 0.0;
}

//+------------------------------------------------------------------+
double MarkPrice(const string symbol, const int side)
{
  MqlTick tick;
  if(!SymbolInfoTick(symbol, tick))
    return 0.0;
  if(side == POSITION_TYPE_BUY)
    return tick.bid;
  return tick.ask;
}

//+------------------------------------------------------------------+
double RequestedEntryPrice(const string symbol, const int side)
{
  MqlTick tick;
  if(!SymbolInfoTick(symbol, tick))
    return 0.0;
  if(side == POSITION_TYPE_BUY)
    return tick.ask;
  return tick.bid;
}

//+------------------------------------------------------------------+
double NormalizeVolume(const string symbol, const double requested)
{
  double minVol = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MIN);
  double maxVol = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MAX);
  double step = SymbolInfoDouble(symbol, SYMBOL_VOLUME_STEP);
  if(step <= 0.0)
    step = 0.01;
  double volume = requested;
  if(volume < minVol)
    volume = minVol;
  if(maxVol > 0.0 && volume > maxVol)
    volume = maxVol;
  volume = MathFloor(volume / step) * step;
  if(volume < minVol)
    volume = minVol;
  return NormalizeDouble(volume, 2);
}

//+------------------------------------------------------------------+
void GetPositionSnapshot(const string symbol, const long magic, PositionSnapshot &snapshot)
{
  snapshot.totalCount = 0;
  snapshot.longCount = 0;
  snapshot.shortCount = 0;
  snapshot.longLots = 0.0;
  snapshot.shortLots = 0.0;
  snapshot.openPnl = 0.0;
  snapshot.openSwap = 0.0;

  for(int i = 0; i < PositionsTotal(); i++)
  {
    ulong ticket = PositionGetTicket(i);
    if(ticket == 0 || !PositionSelectByTicket(ticket))
      continue;
    if(PositionGetString(POSITION_SYMBOL) != symbol)
      continue;
    if((long)PositionGetInteger(POSITION_MAGIC) != magic)
      continue;

    int type = (int)PositionGetInteger(POSITION_TYPE);
    double volume = PositionGetDouble(POSITION_VOLUME);
    double profit = PositionGetDouble(POSITION_PROFIT);
    double swap = PositionGetDouble(POSITION_SWAP);
    snapshot.totalCount++;
    snapshot.openPnl += profit + swap;
    snapshot.openSwap += swap;
    if(type == POSITION_TYPE_BUY)
    {
      snapshot.longCount++;
      snapshot.longLots += volume;
    }
    else if(type == POSITION_TYPE_SELL)
    {
      snapshot.shortCount++;
      snapshot.shortLots += volume;
    }
  }
}

//+------------------------------------------------------------------+
bool PositionHasWeekTag(const string weekTag)
{
  if(weekTag == "")
    return false;
  return PositionWeekTag() == weekTag;
}

//+------------------------------------------------------------------+
void GetWeekSidePositionSnapshot(const string symbol, const long magic, const int side, const string weekTag, PositionSnapshot &snapshot)
{
  snapshot.totalCount = 0;
  snapshot.longCount = 0;
  snapshot.shortCount = 0;
  snapshot.longLots = 0.0;
  snapshot.shortLots = 0.0;
  snapshot.openPnl = 0.0;
  snapshot.openSwap = 0.0;

  for(int i = 0; i < PositionsTotal(); i++)
  {
    ulong ticket = PositionGetTicket(i);
    if(ticket == 0 || !PositionSelectByTicket(ticket))
      continue;
    if(PositionGetString(POSITION_SYMBOL) != symbol)
      continue;
    if((long)PositionGetInteger(POSITION_MAGIC) != magic)
      continue;
    if((int)PositionGetInteger(POSITION_TYPE) != side)
      continue;
    if(!PositionHasWeekTag(weekTag))
      continue;

    double volume = PositionGetDouble(POSITION_VOLUME);
    double profit = PositionGetDouble(POSITION_PROFIT);
    double swap = PositionGetDouble(POSITION_SWAP);
    snapshot.totalCount++;
    snapshot.openPnl += profit + swap;
    snapshot.openSwap += swap;
    if(side == POSITION_TYPE_BUY)
    {
      snapshot.longCount++;
      snapshot.longLots += volume;
    }
    else
    {
      snapshot.shortCount++;
      snapshot.shortLots += volume;
    }
  }
}

//+------------------------------------------------------------------+
double GetLegAdrPnl(const string symbol, const long magic, const int side, const double adr)
{
  double pnl = 0.0;
  double unitLot = NormalizeVolume(symbol, LotSize);
  if(unitLot <= 0.0 || adr <= 0.0)
    return 0.0;

  double mark = MarkPrice(symbol, side);
  if(mark <= 0.0)
    return 0.0;

  for(int i = 0; i < PositionsTotal(); i++)
  {
    ulong ticket = PositionGetTicket(i);
    if(ticket == 0 || !PositionSelectByTicket(ticket))
      continue;
    if(PositionGetString(POSITION_SYMBOL) != symbol)
      continue;
    if((long)PositionGetInteger(POSITION_MAGIC) != magic)
      continue;
    if((int)PositionGetInteger(POSITION_TYPE) != side)
      continue;

    double open = PositionGetDouble(POSITION_PRICE_OPEN);
    double volume = PositionGetDouble(POSITION_VOLUME);
    double units = volume / unitLot;
    if(side == POSITION_TYPE_BUY)
      pnl += ((mark - open) / adr) * units;
    else
      pnl += ((open - mark) / adr) * units;
  }
  return pnl;
}

//+------------------------------------------------------------------+
double GetWeekSideAdrPnl(const string symbol, const long magic, const int side, const double adr, const string weekTag)
{
  double pnl = 0.0;
  double unitLot = NormalizeVolume(symbol, LotSize);
  if(unitLot <= 0.0 || adr <= 0.0)
    return 0.0;

  double mark = MarkPrice(symbol, side);
  if(mark <= 0.0)
    return 0.0;

  for(int i = 0; i < PositionsTotal(); i++)
  {
    ulong ticket = PositionGetTicket(i);
    if(ticket == 0 || !PositionSelectByTicket(ticket))
      continue;
    if(PositionGetString(POSITION_SYMBOL) != symbol)
      continue;
    if((long)PositionGetInteger(POSITION_MAGIC) != magic)
      continue;
    if((int)PositionGetInteger(POSITION_TYPE) != side)
      continue;
    if(!PositionHasWeekTag(weekTag))
      continue;

    double open = PositionGetDouble(POSITION_PRICE_OPEN);
    double volume = PositionGetDouble(POSITION_VOLUME);
    double units = volume / unitLot;
    if(side == POSITION_TYPE_BUY)
      pnl += ((mark - open) / adr) * units;
    else
      pnl += ((open - mark) / adr) * units;
  }
  return pnl;
}

//+------------------------------------------------------------------+
void GetClosedSnapshot(const string symbolFilter, const long magicFilter, ClosedSnapshot &snapshot)
{
  snapshot.closedDeals = 0;
  snapshot.profit = 0.0;
  snapshot.commission = 0.0;
  snapshot.swap = 0.0;

  datetime from = g_startedAt > 0 ? g_startedAt - 60 : TimeCurrent() - 86400;
  datetime to = TimeCurrent();
  if(!HistorySelect(from, to))
    return;

  for(int i = 0; i < HistoryDealsTotal(); i++)
  {
    ulong deal = HistoryDealGetTicket(i);
    if(deal == 0)
      continue;
    int entry = (int)HistoryDealGetInteger(deal, DEAL_ENTRY);
    if(entry != DEAL_ENTRY_OUT && entry != DEAL_ENTRY_OUT_BY)
      continue;
    string symbol = HistoryDealGetString(deal, DEAL_SYMBOL);
    long magic = (long)HistoryDealGetInteger(deal, DEAL_MAGIC);
    if(symbolFilter != "" && symbol != symbolFilter)
      continue;
    if(magicFilter != -1 && magic != magicFilter)
      continue;
    if(magicFilter == -1 && !IsManagedMagic(magic))
      continue;

    snapshot.closedDeals++;
    snapshot.profit += HistoryDealGetDouble(deal, DEAL_PROFIT);
    snapshot.commission += HistoryDealGetDouble(deal, DEAL_COMMISSION);
    snapshot.swap += HistoryDealGetDouble(deal, DEAL_SWAP);
  }
}

//+------------------------------------------------------------------+
bool IsManagedMagic(const long magic)
{
  for(int i = 0; i < ArraySize(g_symbols); i++)
  {
    if(g_symbols[i].magic == magic)
      return true;
  }
  return false;
}

//+------------------------------------------------------------------+
void RecoverAnchorsIfNeeded(const int index)
{
  RecoverAnchorForLeg(index, POSITION_TYPE_BUY);
  RecoverAnchorForLeg(index, POSITION_TYPE_SELL);
}

//+------------------------------------------------------------------+
void RecoverAnchorForLeg(const int index, const int side)
{
  if(GetAnchor(index, side) > 0.0)
    return;

  string symbol = g_symbols[index].symbol;
  long magic = g_symbols[index].magic;
  string weekTag = CurrentWeekTag(index);
  datetime oldestTime = 0;
  double oldestPrice = 0.0;

  for(int i = 0; i < PositionsTotal(); i++)
  {
    ulong ticket = PositionGetTicket(i);
    if(ticket == 0 || !PositionSelectByTicket(ticket))
      continue;
    if(PositionGetString(POSITION_SYMBOL) != symbol)
      continue;
    if((long)PositionGetInteger(POSITION_MAGIC) != magic)
      continue;
    if((int)PositionGetInteger(POSITION_TYPE) != side)
      continue;
    if(!PositionHasWeekTag(weekTag))
      continue;

    datetime openTime = (datetime)PositionGetInteger(POSITION_TIME);
    if(oldestTime == 0 || openTime < oldestTime)
    {
      oldestTime = openTime;
      oldestPrice = PositionGetDouble(POSITION_PRICE_OPEN);
    }
  }

  if(oldestPrice > 0.0)
  {
    SetAnchor(index, side, oldestPrice);
    SetNextLevels(index, side, MathMax(1, GetNextAdverse(index, side)), MathMax(1, GetNextFavorable(index, side)));
    SetSymbolAction(index, SideName(side) + "_ANCHOR_RECOVERED");
  }
}

//+------------------------------------------------------------------+
void IncrementReset(const int index, const int side)
{
  if(side == POSITION_TYPE_BUY)
    g_symbols[index].longWeeklyResets++;
  else
    g_symbols[index].shortWeeklyResets++;
  g_symbols[index].totalResets++;
}

//+------------------------------------------------------------------+
double GetAnchor(const int index, const int side)
{
  return side == POSITION_TYPE_BUY ? g_symbols[index].longAnchor : g_symbols[index].shortAnchor;
}

//+------------------------------------------------------------------+
void SetAnchor(const int index, const int side, const double value)
{
  if(side == POSITION_TYPE_BUY)
    g_symbols[index].longAnchor = value;
  else
    g_symbols[index].shortAnchor = value;
}

//+------------------------------------------------------------------+
void ClearAnchor(const int index, const int side)
{
  SetAnchor(index, side, 0.0);
  SetNextLevels(index, side, 1, 1);
}

//+------------------------------------------------------------------+
int GetNextAdverse(const int index, const int side)
{
  return side == POSITION_TYPE_BUY ? g_symbols[index].longNextAdverse : g_symbols[index].shortNextAdverse;
}

//+------------------------------------------------------------------+
int GetNextFavorable(const int index, const int side)
{
  return side == POSITION_TYPE_BUY ? g_symbols[index].longNextFavorable : g_symbols[index].shortNextFavorable;
}

//+------------------------------------------------------------------+
void SetNextAdverse(const int index, const int side, const int value)
{
  if(side == POSITION_TYPE_BUY)
    g_symbols[index].longNextAdverse = value;
  else
    g_symbols[index].shortNextAdverse = value;
}

//+------------------------------------------------------------------+
void SetNextFavorable(const int index, const int side, const int value)
{
  if(side == POSITION_TYPE_BUY)
    g_symbols[index].longNextFavorable = value;
  else
    g_symbols[index].shortNextFavorable = value;
}

//+------------------------------------------------------------------+
void SetNextLevels(const int index, const int side, const int adverse, const int favorable)
{
  SetNextAdverse(index, side, adverse);
  SetNextFavorable(index, side, favorable);
}

//+------------------------------------------------------------------+
void SetSymbolAction(const int index, const string action)
{
  g_symbols[index].lastAction = action;
  g_lastAction = g_symbols[index].symbol + ":" + action;
}

//+------------------------------------------------------------------+
void SetSymbolError(const int index, const string error)
{
  g_symbols[index].lastError = error;
  g_lastError = g_symbols[index].symbol + ":" + error;
}

//+------------------------------------------------------------------+
void UpdateDrawdown()
{
  double equity = AccountInfoDouble(ACCOUNT_EQUITY);
  if(g_peakEquity <= 0.0 || equity > g_peakEquity)
    g_peakEquity = equity;
  double drawdown = equity - g_peakEquity;
  if(drawdown < g_maxDrawdown)
    g_maxDrawdown = drawdown;
}

//+------------------------------------------------------------------+
void UpdateDashboard(const bool force)
{
  datetime now = TimeCurrent();
  if(!force && DashboardRefreshSeconds > 0 && g_lastDashboard != 0 && (now - g_lastDashboard) < DashboardRefreshSeconds)
    return;
  g_lastDashboard = now;

  string text = BuildDashboardText();
  Comment(text);
  if(CsvLogEnabled)
  {
    LogAccountState();
    for(int i = 0; i < ArraySize(g_symbols); i++)
      LogSymbolState(i);
  }
}

//+------------------------------------------------------------------+
void UpdateChartVisuals(const bool force)
{
  if(!EnableChartVisuals)
    return;

  datetime now = TimeCurrent();
  if(!force && VisualRefreshSeconds > 0 && g_lastVisual != 0 && (now - g_lastVisual) < VisualRefreshSeconds)
    return;
  g_lastVisual = now;

  for(int i = 0; i < ArraySize(g_symbols); i++)
  {
    if(g_symbols[i].symbol != _Symbol)
      continue;

    string prefix = "LimniG82C_" + SafeFilePart(g_symbols[i].symbol) + "_";
    DrawHLine(prefix + "AnchorHigh", g_symbols[i].priceAnchorHigh, clrSlateGray, STYLE_DOT, 1);
    DrawHLine(prefix + "AnchorLow", g_symbols[i].priceAnchorLow, clrSlateGray, STYLE_DOT, 1);
    DrawHLine(prefix + "LongEntry", g_symbols[i].longEntryLevel, clrLimeGreen, STYLE_SOLID, 2);
    DrawHLine(prefix + "ShortEntry", g_symbols[i].shortEntryLevel, clrTomato, STYLE_SOLID, 2);
  }
}

//+------------------------------------------------------------------+
void DrawHLine(const string name, const double price, const color lineColor, const ENUM_LINE_STYLE style, const int width)
{
  if(price <= 0.0)
    return;

  if(ObjectFind(0, name) < 0)
    ObjectCreate(0, name, OBJ_HLINE, 0, 0, price);
  ObjectSetDouble(0, name, OBJPROP_PRICE, price);
  ObjectSetInteger(0, name, OBJPROP_COLOR, lineColor);
  ObjectSetInteger(0, name, OBJPROP_STYLE, style);
  ObjectSetInteger(0, name, OBJPROP_WIDTH, width);
  ObjectSetInteger(0, name, OBJPROP_BACK, false);
}

//+------------------------------------------------------------------+
string BuildDashboardText()
{
  ClosedSnapshot closedAll;
  GetClosedSnapshot("", -1, closedAll);

  int totalPositions = 0;
  int totalLong = 0;
  int totalShort = 0;
  int totalFills = 0;
  int totalResets = 0;
  double openPnl = 0.0;
  double openSwap = 0.0;

  for(int i = 0; i < ArraySize(g_symbols); i++)
  {
    PositionSnapshot snapshot;
    GetPositionSnapshot(g_symbols[i].symbol, g_symbols[i].magic, snapshot);
    totalPositions += snapshot.totalCount;
    totalLong += snapshot.longCount;
    totalShort += snapshot.shortCount;
    openPnl += snapshot.openPnl;
    openSwap += snapshot.openSwap;
    totalFills += g_symbols[i].totalFills;
    totalResets += g_symbols[i].totalResets;
  }

  double balance = AccountInfoDouble(ACCOUNT_BALANCE);
  double equity = AccountInfoDouble(ACCOUNT_EQUITY);
  double freeMargin = AccountInfoDouble(ACCOUNT_MARGIN_FREE);
  double marginLevel = AccountInfoDouble(ACCOUNT_MARGIN_LEVEL);
  double closedNet = closedAll.profit + closedAll.commission + closedAll.swap;
  double totalMtm = closedNet + openPnl;
  double currentDrawdown = equity - g_peakEquity;

  string text = "";
  text += BUILD_NAME + "\n";
  text += "Mode: " + ModeName() +
          " | Symbols: " + IntegerToString(ArraySize(g_symbols)) +
          " | Trading: " + (g_tradeGateOk ? "ON" : "BLOCKED") +
          " | HedgeAcct: " + (g_hedgingSupported ? "YES" : "NO") + "\n";
  text += "Balance " + Money(balance) +
          " | Equity " + Money(equity) +
          " | OpenPnL " + Money(openPnl) +
          " | ClosedEA " + Money(closedNet) +
          " | TotalMTM " + Money(totalMtm) + "\n";
  text += "DD " + Money(currentDrawdown) +
          " | MaxDD " + Money(g_maxDrawdown) +
          " | FreeMargin " + Money(freeMargin) +
          " | MarginLevel " + DoubleToString(marginLevel, 2) + "%\n";
  text += "Positions " + IntegerToString(totalPositions) +
          " | Long " + IntegerToString(totalLong) +
          " | Short " + IntegerToString(totalShort) +
          " | Fills " + IntegerToString(totalFills) +
          " | Resets " + IntegerToString(totalResets) + "\n";
  text += "LastAction: " + g_lastAction + "\n";
  text += "LastError: " + g_lastError + "\n";
  text += "----------------------------------------------------------------\n";

  int shown = 0;
  for(int i = 0; i < ArraySize(g_symbols); i++)
  {
    if(DashboardMaxSymbols > 0 && shown >= DashboardMaxSymbols)
    {
      text += "... " + IntegerToString(ArraySize(g_symbols) - shown) + " more symbols\n";
      break;
    }
    shown++;
    text += BuildSymbolDashboardLine(i);
  }

  return text;
}

//+------------------------------------------------------------------+
string BuildSymbolDashboardLine(const int index)
{
  string symbol = g_symbols[index].symbol;
  PositionSnapshot positions;
  ClosedSnapshot closed;
  GetPositionSnapshot(symbol, g_symbols[index].magic, positions);
  GetClosedSnapshot(symbol, g_symbols[index].magic, closed);

  MqlTick tick;
  SymbolInfoTick(symbol, tick);
  double point = SymbolInfoDouble(symbol, SYMBOL_POINT);
  double spread = point > 0.0 ? (tick.ask - tick.bid) / point : 0.0;
  double adr = GetAdrValue(symbol);
  double targetDistance = adr * TargetAdrMultiple;
  double spacingDistance = adr * SpacingAdrMultiple;
  double closedNet = closed.profit + closed.commission + closed.swap;
  double totalMtm = closedNet + positions.openPnl;

  string line = "";
  line += symbol +
          " | bid " + Price(symbol, tick.bid) +
          " ask " + Price(symbol, tick.ask) +
          " spread " + DoubleToString(spread, 1) + "\n";
  line += "  ADR " + Price(symbol, adr) +
          " | target " + Price(symbol, targetDistance) +
          " | spacing " + Price(symbol, spacingDistance) +
          " | magic " + IntegerToString((int)g_symbols[index].magic) + "\n";
  line += "  Week " + CurrentWeekTag(index) +
          " | TradeWin " + (IsTradeWindowOpenForSymbol(index) ? "OPEN" : "CLOSED") + "\n";
  line += "  Anchor H " + Price(symbol, g_symbols[index].priceAnchorHigh) +
          " L " + Price(symbol, g_symbols[index].priceAnchorLow) +
          " | LEntry " + Price(symbol, g_symbols[index].longEntryLevel) +
          " | SEntry " + Price(symbol, g_symbols[index].shortEntryLevel) + "\n";
  line += "  L " + IntegerToString(positions.longCount) + "/" + Lots(positions.longLots) +
          " WReset " + IntegerToString(g_symbols[index].longWeeklyResets) +
          " | S " + IntegerToString(positions.shortCount) + "/" + Lots(positions.shortLots) +
          " WReset " + IntegerToString(g_symbols[index].shortWeeklyResets) + "\n";
  line += "  Open " + Money(positions.openPnl) +
          " | Closed " + Money(closedNet) +
          " | MTM " + Money(totalMtm) +
          " | Swap " + Money(positions.openSwap + closed.swap) +
          " | Comm " + Money(closed.commission) + "\n";
  line += "  TotalReset " + IntegerToString(g_symbols[index].totalResets) +
          " | Fills " + IntegerToString(g_symbols[index].totalFills) +
          " | " + g_symbols[index].lastAction +
          " | " + g_symbols[index].lastError + "\n";
  return line;
}

//+------------------------------------------------------------------+
void LogAccountState()
{
  ClosedSnapshot closedAll;
  GetClosedSnapshot("", -1, closedAll);

  int totalPositions = 0;
  int totalLong = 0;
  int totalShort = 0;
  int totalFills = 0;
  int totalResets = 0;
  double openPnl = 0.0;

  for(int i = 0; i < ArraySize(g_symbols); i++)
  {
    PositionSnapshot snapshot;
    GetPositionSnapshot(g_symbols[i].symbol, g_symbols[i].magic, snapshot);
    totalPositions += snapshot.totalCount;
    totalLong += snapshot.longCount;
    totalShort += snapshot.shortCount;
    openPnl += snapshot.openPnl;
    totalFills += g_symbols[i].totalFills;
    totalResets += g_symbols[i].totalResets;
  }

  double closedNet = closedAll.profit + closedAll.commission + closedAll.swap;
  double totalMtm = closedNet + openPnl;
  string filename = "limni_basket_hedge_alpha_v2_account_state_" + ModeName() + ".csv";
  int h = OpenCsv(filename,
                  "timestamp,mode,enabled_symbols,balance,equity,open_pnl,closed_pnl_ea,commission_ea,swap_ea,total_mtm_ea,current_drawdown,max_drawdown,free_margin,margin_level,total_positions,long_positions,short_positions,total_fills,total_resets,last_action,last_error");
  if(h == INVALID_HANDLE)
    return;
  FileWrite(h,
            Timestamp(),
            ModeName(),
            ArraySize(g_symbols),
            AccountInfoDouble(ACCOUNT_BALANCE),
            AccountInfoDouble(ACCOUNT_EQUITY),
            openPnl,
            closedNet,
            closedAll.commission,
            closedAll.swap,
            totalMtm,
            AccountInfoDouble(ACCOUNT_EQUITY) - g_peakEquity,
            g_maxDrawdown,
            AccountInfoDouble(ACCOUNT_MARGIN_FREE),
            AccountInfoDouble(ACCOUNT_MARGIN_LEVEL),
            totalPositions,
            totalLong,
            totalShort,
            totalFills,
            totalResets,
            g_lastAction,
            g_lastError);
  FileClose(h);
}

//+------------------------------------------------------------------+
void LogSymbolState(const int index)
{
  if(!CsvLogEnabled)
    return;
  string symbol = g_symbols[index].symbol;
  PositionSnapshot positions;
  ClosedSnapshot closed;
  GetPositionSnapshot(symbol, g_symbols[index].magic, positions);
  GetClosedSnapshot(symbol, g_symbols[index].magic, closed);

  MqlTick tick;
  SymbolInfoTick(symbol, tick);
  double point = SymbolInfoDouble(symbol, SYMBOL_POINT);
  double spread = point > 0.0 ? (tick.ask - tick.bid) / point : 0.0;
  double adr = GetAdrValue(symbol);
  double closedNet = closed.profit + closed.commission + closed.swap;

  string filename = "limni_basket_hedge_alpha_v2_symbol_state_" + SafeFilePart(symbol) + "_" + ModeName() + ".csv";
  int h = OpenCsv(filename,
                  "timestamp,symbol,mode,bid,ask,spread,adr_value,target_distance,spacing_distance,week_tag,boundary_now_gmt,trade_window_open,anchor_high,anchor_low,long_entry_level,short_entry_level,long_count,short_count,long_lots,short_lots,total_position_count,weekly_reset_count,total_reset_count,symbol_closed_pnl,symbol_open_pnl,symbol_commission,symbol_swap,symbol_total_mtm,last_action,last_error");
  if(h == INVALID_HANDLE)
    return;
  FileWrite(h,
            Timestamp(),
            symbol,
            ModeName(),
            tick.bid,
            tick.ask,
            spread,
            adr,
            adr * TargetAdrMultiple,
            adr * SpacingAdrMultiple,
            CurrentWeekTag(index),
            TimeToString(BoundaryNowGmt(), TIME_DATE | TIME_SECONDS),
            IsTradeWindowOpenForSymbol(index) ? 1 : 0,
            g_symbols[index].priceAnchorHigh,
            g_symbols[index].priceAnchorLow,
            g_symbols[index].longEntryLevel,
            g_symbols[index].shortEntryLevel,
            positions.longCount,
            positions.shortCount,
            positions.longLots,
            positions.shortLots,
            positions.totalCount,
            g_symbols[index].longWeeklyResets + g_symbols[index].shortWeeklyResets,
            g_symbols[index].totalResets,
            closedNet,
            positions.openPnl,
            closed.commission,
            positions.openSwap + closed.swap,
            closedNet + positions.openPnl,
            g_symbols[index].lastAction,
            g_symbols[index].lastError);
  FileClose(h);
}

//+------------------------------------------------------------------+
void LogFill(const int index, const string action, const int side, const double volume, const double requestedPrice, const double filledPrice, const string reason)
{
  if(!CsvLogEnabled)
    return;
  string symbol = g_symbols[index].symbol;
  MqlTick tick;
  SymbolInfoTick(symbol, tick);
  double point = SymbolInfoDouble(symbol, SYMBOL_POINT);
  double spread = point > 0.0 ? (tick.ask - tick.bid) / point : 0.0;
  string filename = "limni_basket_hedge_alpha_v2_fills_" + SafeFilePart(symbol) + "_" + ModeName() + ".csv";
  int h = OpenCsv(filename,
                  "timestamp,symbol,mode,week_tag,order_comment,action,side,volume,requested_price,filled_price,bid,ask,spread,order_id,deal_id,position_id,commission,swap,realized_pnl,reason");
  if(h == INVALID_HANDLE)
    return;
  FileWrite(h,
            Timestamp(),
            symbol,
            ModeName(),
            CurrentWeekTag(index),
            BuildOrderComment(index, side, reason),
            action,
            SideName(side),
            volume,
            requestedPrice,
            filledPrice,
            tick.bid,
            tick.ask,
            spread,
            (long)g_trade.ResultOrder(),
            (long)g_trade.ResultDeal(),
            0,
            0.0,
            0.0,
            0.0,
            reason);
  FileClose(h);
}

//+------------------------------------------------------------------+
void LogReset(const int index, const string resetType, const int positionsClosed, const string reason)
{
  if(!CsvLogEnabled)
    return;
  string symbol = g_symbols[index].symbol;
  PositionSnapshot positions;
  ClosedSnapshot closed;
  GetPositionSnapshot(symbol, g_symbols[index].magic, positions);
  GetClosedSnapshot(symbol, g_symbols[index].magic, closed);
  double closedNet = closed.profit + closed.commission + closed.swap;
  string filename = "limni_basket_hedge_alpha_v2_resets_" + SafeFilePart(symbol) + "_" + ModeName() + ".csv";
  int h = OpenCsv(filename,
                  "timestamp,symbol,mode,week_tag,reset_type,weekly_reset_count,total_reset_count,closed_pnl_at_reset,open_pnl_at_reset,commission_at_reset,swap_at_reset,total_mtm_at_reset,positions_closed,reason");
  if(h == INVALID_HANDLE)
    return;
  FileWrite(h,
            Timestamp(),
            symbol,
            ModeName(),
            CurrentWeekTag(index),
            resetType,
            g_symbols[index].longWeeklyResets + g_symbols[index].shortWeeklyResets,
            g_symbols[index].totalResets,
            closedNet,
            positions.openPnl,
            closed.commission,
            positions.openSwap + closed.swap,
            closedNet + positions.openPnl,
            positionsClosed,
            reason);
  FileClose(h);
}

//+------------------------------------------------------------------+
int OpenCsv(const string filename, const string header)
{
  int handle = FileOpen(filename, FILE_READ | FILE_WRITE | FILE_CSV | FILE_ANSI, ',');
  if(handle == INVALID_HANDLE)
  {
    g_lastError = "CSV_OPEN_FAILED_" + filename + "_" + IntegerToString(GetLastError());
    return INVALID_HANDLE;
  }
  if(FileSize(handle) == 0)
    FileWriteString(handle, header + "\r\n");
  FileSeek(handle, 0, SEEK_END);
  return handle;
}

//+------------------------------------------------------------------+
void LoadSymbolState(const int index)
{
  string key = StateKey(index, "");
  if(GlobalVariableCheck(key + "WeekStart"))
  {
    g_symbols[index].weekStartGmt = (datetime)GlobalVariableGet(key + "WeekStart");
    g_symbols[index].longWeeklyResets = (int)GlobalVariableGet(key + "LongWeeklyResets");
    g_symbols[index].shortWeeklyResets = (int)GlobalVariableGet(key + "ShortWeeklyResets");
    g_symbols[index].totalResets = (int)GlobalVariableGet(key + "TotalResets");
    g_symbols[index].totalFills = (int)GlobalVariableGet(key + "TotalFills");
    g_symbols[index].longAnchor = GlobalVariableGet(key + "LongAnchor");
    g_symbols[index].shortAnchor = GlobalVariableGet(key + "ShortAnchor");
    g_symbols[index].longNextAdverse = MathMax(1, (int)GlobalVariableGet(key + "LongNextAdverse"));
    g_symbols[index].longNextFavorable = MathMax(1, (int)GlobalVariableGet(key + "LongNextFavorable"));
    g_symbols[index].shortNextAdverse = MathMax(1, (int)GlobalVariableGet(key + "ShortNextAdverse"));
    g_symbols[index].shortNextFavorable = MathMax(1, (int)GlobalVariableGet(key + "ShortNextFavorable"));
    if(GlobalVariableCheck(key + "PriceAnchorWeekStart"))
    {
      g_symbols[index].priceAnchorWeekStartGmt = (datetime)GlobalVariableGet(key + "PriceAnchorWeekStart");
      g_symbols[index].priceAnchorSeeded = GlobalVariableGet(key + "PriceAnchorSeeded") > 0.0;
      g_symbols[index].priceAnchorTicks = (int)GlobalVariableGet(key + "PriceAnchorTicks");
      g_symbols[index].priceAnchorHigh = GlobalVariableGet(key + "PriceAnchorHigh");
      g_symbols[index].priceAnchorLow = GlobalVariableGet(key + "PriceAnchorLow");
      g_symbols[index].prevPriceAnchorHigh = GlobalVariableGet(key + "PrevPriceAnchorHigh");
      g_symbols[index].prevPriceAnchorLow = GlobalVariableGet(key + "PrevPriceAnchorLow");
      g_symbols[index].longEntryLevel = GlobalVariableGet(key + "LongEntryLevel");
      g_symbols[index].shortEntryLevel = GlobalVariableGet(key + "ShortEntryLevel");
    }
    else
    {
      ResetWeeklyPriceAnchor(index, g_symbols[index].weekStartGmt);
    }
  }
  CheckWeekBoundary(index);
}

//+------------------------------------------------------------------+
void SaveSymbolState(const int index)
{
  string key = StateKey(index, "");
  GlobalVariableSet(key + "WeekStart", (double)g_symbols[index].weekStartGmt);
  GlobalVariableSet(key + "LongWeeklyResets", g_symbols[index].longWeeklyResets);
  GlobalVariableSet(key + "ShortWeeklyResets", g_symbols[index].shortWeeklyResets);
  GlobalVariableSet(key + "TotalResets", g_symbols[index].totalResets);
  GlobalVariableSet(key + "TotalFills", g_symbols[index].totalFills);
  GlobalVariableSet(key + "LongAnchor", g_symbols[index].longAnchor);
  GlobalVariableSet(key + "ShortAnchor", g_symbols[index].shortAnchor);
  GlobalVariableSet(key + "LongNextAdverse", g_symbols[index].longNextAdverse);
  GlobalVariableSet(key + "LongNextFavorable", g_symbols[index].longNextFavorable);
  GlobalVariableSet(key + "ShortNextAdverse", g_symbols[index].shortNextAdverse);
  GlobalVariableSet(key + "ShortNextFavorable", g_symbols[index].shortNextFavorable);
  GlobalVariableSet(key + "PriceAnchorWeekStart", (double)g_symbols[index].priceAnchorWeekStartGmt);
  GlobalVariableSet(key + "PriceAnchorSeeded", g_symbols[index].priceAnchorSeeded ? 1.0 : 0.0);
  GlobalVariableSet(key + "PriceAnchorTicks", g_symbols[index].priceAnchorTicks);
  GlobalVariableSet(key + "PriceAnchorHigh", g_symbols[index].priceAnchorHigh);
  GlobalVariableSet(key + "PriceAnchorLow", g_symbols[index].priceAnchorLow);
  GlobalVariableSet(key + "PrevPriceAnchorHigh", g_symbols[index].prevPriceAnchorHigh);
  GlobalVariableSet(key + "PrevPriceAnchorLow", g_symbols[index].prevPriceAnchorLow);
  GlobalVariableSet(key + "LongEntryLevel", g_symbols[index].longEntryLevel);
  GlobalVariableSet(key + "ShortEntryLevel", g_symbols[index].shortEntryLevel);
}

//+------------------------------------------------------------------+
string StateKey(const int index, const string suffix)
{
  return "G82." + IntegerToString((long)AccountInfoInteger(ACCOUNT_LOGIN)) + "." +
         SafeFilePart(g_symbols[index].symbol) + "." +
         IntegerToString((int)g_symbols[index].magic) + "." + suffix;
}

//+------------------------------------------------------------------+
string ModeName()
{
  return Mode == GRID_CAP ? "GRID_CAP" : "RAW";
}

//+------------------------------------------------------------------+
string ModeCode()
{
  return Mode == GRID_CAP ? "G" : "R";
}

//+------------------------------------------------------------------+
string SideName(const int side)
{
  return side == POSITION_TYPE_BUY ? "LONG" : "SHORT";
}

//+------------------------------------------------------------------+
string SideCode(const int side)
{
  return side == POSITION_TYPE_BUY ? "B" : "S";
}

//+------------------------------------------------------------------+
string ReasonCode(const string reason)
{
  if(reason == "INITIAL")
    return "I";
  int adversePrefix = StringLen("ADVERSE_RECOVERY_L");
  if(StringFind(reason, "ADVERSE_RECOVERY_L") == 0)
    return "A" + StringSubstr(reason, adversePrefix);
  int favorablePrefix = StringLen("FAVORABLE_EXPANSION_L");
  if(StringFind(reason, "FAVORABLE_EXPANSION_L") == 0)
    return "F" + StringSubstr(reason, favorablePrefix);
  if(reason == "TARGET_RESET")
    return "TR";
  return StringSubstr(reason, 0, 4);
}

//+------------------------------------------------------------------+
string CurrentWeekTag(const int index)
{
  return LimniCompactWeekTag(g_symbols[index].weekStartGmt);
}

//+------------------------------------------------------------------+
string BuildOrderComment(const int index, const int side, const string reason)
{
  return "G82C|" + ModeCode() + "|" + SideCode(side) + "|" + CurrentWeekTag(index) + "|" + ReasonCode(reason);
}

//+------------------------------------------------------------------+
string Timestamp()
{
  return TimeToString(TimeCurrent(), TIME_DATE | TIME_SECONDS);
}

//+------------------------------------------------------------------+
string Money(const double value)
{
  return DoubleToString(value, 2);
}

//+------------------------------------------------------------------+
string Lots(const double value)
{
  return DoubleToString(value, 2);
}

//+------------------------------------------------------------------+
string Price(const string symbol, const double value)
{
  int digits = (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);
  if(value <= 0.0)
    return "0";
  return DoubleToString(value, digits);
}

//+------------------------------------------------------------------+
string SafeFilePart(string value)
{
  StringReplace(value, "\\", "_");
  StringReplace(value, "/", "_");
  StringReplace(value, ":", "_");
  StringReplace(value, "*", "_");
  StringReplace(value, "?", "_");
  StringReplace(value, "\"", "_");
  StringReplace(value, "<", "_");
  StringReplace(value, ">", "_");
  StringReplace(value, "|", "_");
  StringReplace(value, " ", "_");
  return value;
}
