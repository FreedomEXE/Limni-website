//+------------------------------------------------------------------+
//|                         LimniBasketHedgeEAAlphaV1.mq5            |
//|                Alpha V1 fully hedged grid visual prototype       |
//+------------------------------------------------------------------+
#property strict
#property version "1.000"

#include <Trade/Trade.mqh>

enum HedgeGridMode
{
  NO_LIMIT_RAW = 0,
  L3_RAW = 1
};

input HedgeGridMode Mode = NO_LIMIT_RAW;
input string SymbolsCsv = "";
input bool UseCurrentChartSymbolOnly = true;
input double LotSize = 0.01;
input double AdrValue = 0.0;
input double TargetAdrMultiple = 1.0;
input double SpacingAdrMultiple = 0.2;
input int MaxPositionsPerSymbol = 200;
input bool EnableTrading = true;
input bool AllowLiveTrading = false;
input bool ManualFlattenNow = false;
input long MagicNumberBase = 820820;
input int SlippagePoints = 10;
input int MaxOrdersPerTick = 5;
input int DashboardRefreshSeconds = 1;
input int DashboardMaxSymbols = 28;
input bool CsvLogEnabled = true;

const string BUILD_NAME = "Limni Basket Hedge EA Alpha V1";
const int L3_RESET_LIMIT_PER_SIDE_WEEK = 3;

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

  int sideCount = (side == POSITION_TYPE_BUY ? snapshot.longCount : snapshot.shortCount);
  int sideWeeklyResets = (side == POSITION_TYPE_BUY ? g_symbols[index].longWeeklyResets : g_symbols[index].shortWeeklyResets);
  if(Mode == L3_RAW && sideWeeklyResets >= L3_RESET_LIMIT_PER_SIDE_WEEK)
    return;

  if(sideCount <= 0)
  {
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

  double legAdrPnl = GetLegAdrPnl(symbol, g_symbols[index].magic, side, adr);
  if(legAdrPnl >= TargetAdrMultiple)
  {
    int positionsClosed = CloseLegPositions(index, side, "TARGET_RESET");
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

  string comment = "G82|" + ModeName() + "|" + SideName(side) + "|" + reason;
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
  g_symbols[size].weekStartGmt = GetWeekStartGmt(TimeGMT());
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
  return MagicNumberBase + (Mode == L3_RAW ? 1000000 : 0) + hash;
}

//+------------------------------------------------------------------+
void CheckWeekBoundary(const int index)
{
  datetime currentWeek = GetWeekStartGmt(TimeGMT());
  if(g_symbols[index].weekStartGmt == currentWeek)
    return;

  g_symbols[index].weekStartGmt = currentWeek;
  g_symbols[index].longWeeklyResets = 0;
  g_symbols[index].shortWeeklyResets = 0;
  SetSymbolAction(index, "WEEK_BOUNDARY_RESET");
  LogReset(index, "WEEK_BOUNDARY", 0, "WEEKLY_L3_COUNTER_RESET_NO_FLATTEN");
  SaveSymbolState(index);
}

//+------------------------------------------------------------------+
datetime GetWeekStartGmt(datetime nowGmt)
{
  bool dst = IsUsdDstUtc(nowGmt);
  int offset = dst ? -4 : -5;
  datetime etNow = nowGmt + offset * 3600;
  MqlDateTime et;
  TimeToStruct(etNow, et);
  int daysSinceSunday = et.day_of_week;
  datetime sunday = etNow - daysSinceSunday * 86400;
  MqlDateTime s;
  TimeToStruct(sunday, s);
  s.hour = 19;
  s.min = 0;
  s.sec = 0;
  datetime sundayEt = StructToTime(s);
  if(etNow < sundayEt)
    sundayEt -= 7 * 86400;
  bool dstLocal = IsUsdDstLocal(s.year, s.mon, s.day, s.hour);
  int localOffset = dstLocal ? -4 : -5;
  return sundayEt - localOffset * 3600;
}

//+------------------------------------------------------------------+
bool IsUsdDstUtc(datetime nowGmt)
{
  MqlDateTime dt;
  TimeToStruct(nowGmt, dt);
  int year = dt.year;
  int startDay = NthSunday(year, 3, 2);
  int endDay = NthSunday(year, 11, 1);

  MqlDateTime start;
  start.year = year;
  start.mon = 3;
  start.day = startDay;
  start.hour = 7;
  start.min = 0;
  start.sec = 0;

  MqlDateTime end;
  end.year = year;
  end.mon = 11;
  end.day = endDay;
  end.hour = 6;
  end.min = 0;
  end.sec = 0;

  datetime startUtc = StructToTime(start);
  datetime endUtc = StructToTime(end);
  return nowGmt >= startUtc && nowGmt < endUtc;
}

//+------------------------------------------------------------------+
bool IsUsdDstLocal(int year, int mon, int day, int hour)
{
  int startDay = NthSunday(year, 3, 2);
  int endDay = NthSunday(year, 11, 1);
  if(mon < 3 || mon > 11)
    return false;
  if(mon > 3 && mon < 11)
    return true;
  if(mon == 3)
  {
    if(day > startDay)
      return true;
    if(day < startDay)
      return false;
    return hour >= 2;
  }
  if(mon == 11)
  {
    if(day < endDay)
      return true;
    if(day > endDay)
      return false;
    return hour < 2;
  }
  return false;
}

//+------------------------------------------------------------------+
int NthSunday(int year, int mon, int nth)
{
  int count = 0;
  for(int day = 1; day <= 31; day++)
  {
    MqlDateTime dt;
    dt.year = year;
    dt.mon = mon;
    dt.day = day;
    dt.hour = 0;
    dt.min = 0;
    dt.sec = 0;
    datetime t = StructToTime(dt);
    if(t == 0)
      continue;
    TimeToStruct(t, dt);
    if(dt.day_of_week == 0)
    {
      count++;
      if(count == nth)
        return day;
    }
  }
  return 1;
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
  string filename = "limni_basket_hedge_alpha_v1_account_state_" + ModeName() + ".csv";
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

  string filename = "limni_basket_hedge_alpha_v1_symbol_state_" + SafeFilePart(symbol) + "_" + ModeName() + ".csv";
  int h = OpenCsv(filename,
                  "timestamp,symbol,mode,bid,ask,spread,adr_value,target_distance,spacing_distance,long_count,short_count,long_lots,short_lots,total_position_count,weekly_reset_count,total_reset_count,symbol_closed_pnl,symbol_open_pnl,symbol_commission,symbol_swap,symbol_total_mtm,last_action,last_error");
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
  string filename = "limni_basket_hedge_alpha_v1_fills_" + SafeFilePart(symbol) + "_" + ModeName() + ".csv";
  int h = OpenCsv(filename,
                  "timestamp,symbol,mode,action,side,volume,requested_price,filled_price,bid,ask,spread,order_id,deal_id,position_id,commission,swap,realized_pnl,reason");
  if(h == INVALID_HANDLE)
    return;
  FileWrite(h,
            Timestamp(),
            symbol,
            ModeName(),
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
  string filename = "limni_basket_hedge_alpha_v1_resets_" + SafeFilePart(symbol) + "_" + ModeName() + ".csv";
  int h = OpenCsv(filename,
                  "timestamp,symbol,mode,reset_type,weekly_reset_count,total_reset_count,closed_pnl_at_reset,open_pnl_at_reset,commission_at_reset,swap_at_reset,total_mtm_at_reset,positions_closed,reason");
  if(h == INVALID_HANDLE)
    return;
  FileWrite(h,
            Timestamp(),
            symbol,
            ModeName(),
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
  return Mode == L3_RAW ? "L3_RAW" : "NO_LIMIT_RAW";
}

//+------------------------------------------------------------------+
string SideName(const int side)
{
  return side == POSITION_TYPE_BUY ? "LONG" : "SHORT";
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
