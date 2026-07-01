/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
#ifndef __LIMNI_RAW_HARVEST_ENGINE_MQH__
#define __LIMNI_RAW_HARVEST_ENGINE_MQH__

const string LIMNI_RAW_HARVEST_BUILD_NAME = "Limni Basket Hedge EA Alpha V3";

struct RawHarvestSymbolState
{
  string symbol;
  long magic;
  double adr;
  datetime adrBarTime;
  int totalFills;
  int totalResets;
  int longNextAdverse;
  int longNextFavorable;
  int shortNextAdverse;
  int shortNextFavorable;
  double longAnchor;
  double shortAnchor;
  string lastAction;
  string lastError;
};

struct RawHarvestPositionSnapshot
{
  int totalCount;
  int longCount;
  int shortCount;
  double longLots;
  double shortLots;
  double openPnl;
  double openSwap;
};

CTrade g_harvestTrade;
RawHarvestSymbolState g_harvestSymbols[];
datetime g_harvestStartedAt = 0;
datetime g_harvestLastDashboard = 0;
double g_harvestPeakEquity = 0.0;
double g_harvestMaxDrawdown = 0.0;
string g_harvestLastAction = "";
string g_harvestLastError = "";

string RH_Timestamp()
{
  return TimeToString(TimeCurrent(), TIME_DATE | TIME_SECONDS);
}

string RH_Trim(const string value)
{
  int first = 0;
  int last = StringLen(value) - 1;
  while(first <= last)
  {
    ushort ch = (ushort)StringGetCharacter(value, first);
    if(ch > 32)
      break;
    first++;
  }
  while(last >= first)
  {
    ushort ch = (ushort)StringGetCharacter(value, last);
    if(ch > 32)
      break;
    last--;
  }
  if(last < first)
    return "";
  return StringSubstr(value, first, last - first + 1);
}

string RH_SafeFilePart(const string value)
{
  string out = "";
  int len = StringLen(value);
  for(int i = 0; i < len; i++)
  {
    ushort ch = (ushort)StringGetCharacter(value, i);
    bool digit = (ch >= '0' && ch <= '9');
    bool upper = (ch >= 'A' && ch <= 'Z');
    bool lower = (ch >= 'a' && ch <= 'z');
    if(digit || upper || lower)
      out += ShortToString(ch);
    else
      out += "_";
  }
  return out == "" ? "symbol" : out;
}

string RH_SideName(const int side)
{
  return side == POSITION_TYPE_BUY ? "LONG" : "SHORT";
}

string RH_SideCode(const int side)
{
  return side == POSITION_TYPE_BUY ? "B" : "S";
}

string RH_ReasonCode(const string reason)
{
  if(reason == "INITIAL")
    return "I";
  if(StringFind(reason, "ADVERSE_L") == 0)
    return "A" + StringSubstr(reason, StringLen("ADVERSE_L"));
  if(StringFind(reason, "FAVORABLE_L") == 0)
    return "F" + StringSubstr(reason, StringLen("FAVORABLE_L"));
  if(reason == "TARGET_RESET")
    return "TR";
  return StringSubstr(reason, 0, 6);
}

string RH_OrderComment(const int index, const int side, const string reason)
{
  return "G84|R|" + RH_SideCode(side) + "|" + RH_ReasonCode(reason);
}

void RH_SetSymbolAction(const int index, const string action)
{
  if(index < 0 || index >= ArraySize(g_harvestSymbols))
    return;
  g_harvestSymbols[index].lastAction = action;
  g_harvestLastAction = g_harvestSymbols[index].symbol + ":" + action;
}

void RH_SetSymbolError(const int index, const string error)
{
  if(index < 0 || index >= ArraySize(g_harvestSymbols))
    return;
  g_harvestSymbols[index].lastError = error;
  g_harvestLastError = g_harvestSymbols[index].symbol + ":" + error;
}

bool RH_IsHedgingAccount()
{
  return (ENUM_ACCOUNT_MARGIN_MODE)AccountInfoInteger(ACCOUNT_MARGIN_MODE) == ACCOUNT_MARGIN_MODE_RETAIL_HEDGING;
}

bool RH_IsTester()
{
  return (bool)MQLInfoInteger(MQL_TESTER);
}

bool RH_TradingAllowedNow()
{
  if(!EnableTrading)
    return false;
  if(!RH_IsTester() && !AllowLiveTrading)
    return false;
  if(!MQLInfoInteger(MQL_TRADE_ALLOWED))
    return false;
  if(!TerminalInfoInteger(TERMINAL_TRADE_ALLOWED))
    return false;
  return true;
}

bool RH_EnsureSymbolSelected(const string symbol)
{
  if(SymbolSelect(symbol, true))
    return true;
  return false;
}

long RH_MagicForSymbol(const string symbol)
{
  int hash = 0;
  for(int i = 0; i < StringLen(symbol); i++)
    hash = (hash * 31 + (int)StringGetCharacter(symbol, i)) % 900000;
  return MagicNumberBase + hash;
}

void RH_AddSymbol(const string rawSymbol)
{
  string symbol = RH_Trim(rawSymbol);
  if(symbol == "")
    return;
  for(int i = 0; i < ArraySize(g_harvestSymbols); i++)
  {
    if(g_harvestSymbols[i].symbol == symbol)
      return;
  }

  int size = ArraySize(g_harvestSymbols);
  ArrayResize(g_harvestSymbols, size + 1);
  g_harvestSymbols[size].symbol = symbol;
  g_harvestSymbols[size].magic = RH_MagicForSymbol(symbol);
  g_harvestSymbols[size].adr = 0.0;
  g_harvestSymbols[size].adrBarTime = 0;
  g_harvestSymbols[size].totalFills = 0;
  g_harvestSymbols[size].totalResets = 0;
  g_harvestSymbols[size].longNextAdverse = 1;
  g_harvestSymbols[size].longNextFavorable = 1;
  g_harvestSymbols[size].shortNextAdverse = 1;
  g_harvestSymbols[size].shortNextFavorable = 1;
  g_harvestSymbols[size].longAnchor = 0.0;
  g_harvestSymbols[size].shortAnchor = 0.0;
  g_harvestSymbols[size].lastAction = "INIT";
  g_harvestSymbols[size].lastError = "";
}

void RH_BuildSymbolList()
{
  ArrayResize(g_harvestSymbols, 0);
  if(UseCurrentChartSymbolOnly || SymbolsCsv == "")
  {
    RH_AddSymbol(_Symbol);
    return;
  }

  string parts[];
  int count = StringSplit(SymbolsCsv, ',', parts);
  for(int i = 0; i < count; i++)
    RH_AddSymbol(parts[i]);

  if(ArraySize(g_harvestSymbols) <= 0)
    RH_AddSymbol(_Symbol);
}

double RH_NormalizeVolume(const string symbol, const double requested)
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

  volume = MathFloor((volume + 0.000000001) / step) * step;
  if(volume < minVol)
    volume = minVol;
  return NormalizeDouble(volume, 8);
}

double RH_RequestedEntryPrice(const string symbol, const int side)
{
  MqlTick tick;
  if(!SymbolInfoTick(symbol, tick))
    return 0.0;
  return side == POSITION_TYPE_BUY ? tick.ask : tick.bid;
}

double RH_MarkPrice(const string symbol, const int side)
{
  MqlTick tick;
  if(!SymbolInfoTick(symbol, tick))
    return 0.0;
  return side == POSITION_TYPE_BUY ? tick.bid : tick.ask;
}

bool RH_RefreshAdr(const int index, const bool force)
{
  if(index < 0 || index >= ArraySize(g_harvestSymbols))
    return false;
  if(AdrValue > 0.0)
  {
    g_harvestSymbols[index].adr = AdrValue;
    return true;
  }

  string symbol = g_harvestSymbols[index].symbol;
  datetime dailyBar = iTime(symbol, PERIOD_D1, 1);
  if(!force && g_harvestSymbols[index].adr > 0.0 && dailyBar == g_harvestSymbols[index].adrBarTime)
    return true;

  MqlRates rates[];
  ArraySetAsSeries(rates, true);
  int lookback = AdrLookbackDays > 0 ? AdrLookbackDays : 14;
  int copied = CopyRates(symbol, PERIOD_D1, 1, lookback, rates);
  if(copied <= 0)
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
  if(used <= 0)
    return false;

  g_harvestSymbols[index].adr = sum / used;
  g_harvestSymbols[index].adrBarTime = dailyBar;
  return true;
}

void RH_GetPositionSnapshot(const string symbol, const long magic, RawHarvestPositionSnapshot &snapshot)
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

int RH_CountSidePositions(const string symbol, const long magic, const int side)
{
  int count = 0;
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
    count++;
  }
  return count;
}

double RH_GetLegAdrPnl(const string symbol, const long magic, const int side, const double adr)
{
  double pnl = 0.0;
  double unitLot = RH_NormalizeVolume(symbol, LotSize);
  if(unitLot <= 0.0 || adr <= 0.0)
    return 0.0;

  double mark = RH_MarkPrice(symbol, side);
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

double RH_GetAnchor(const int index, const int side)
{
  return side == POSITION_TYPE_BUY ? g_harvestSymbols[index].longAnchor : g_harvestSymbols[index].shortAnchor;
}

void RH_SetAnchor(const int index, const int side, const double value)
{
  if(side == POSITION_TYPE_BUY)
    g_harvestSymbols[index].longAnchor = value;
  else
    g_harvestSymbols[index].shortAnchor = value;
}

int RH_GetNextAdverse(const int index, const int side)
{
  return side == POSITION_TYPE_BUY ? g_harvestSymbols[index].longNextAdverse : g_harvestSymbols[index].shortNextAdverse;
}

int RH_GetNextFavorable(const int index, const int side)
{
  return side == POSITION_TYPE_BUY ? g_harvestSymbols[index].longNextFavorable : g_harvestSymbols[index].shortNextFavorable;
}

void RH_SetNextAdverse(const int index, const int side, const int value)
{
  if(side == POSITION_TYPE_BUY)
    g_harvestSymbols[index].longNextAdverse = value;
  else
    g_harvestSymbols[index].shortNextAdverse = value;
}

void RH_SetNextFavorable(const int index, const int side, const int value)
{
  if(side == POSITION_TYPE_BUY)
    g_harvestSymbols[index].longNextFavorable = value;
  else
    g_harvestSymbols[index].shortNextFavorable = value;
}

void RH_ResetLegState(const int index, const int side)
{
  RH_SetAnchor(index, side, 0.0);
  RH_SetNextAdverse(index, side, 1);
  RH_SetNextFavorable(index, side, 1);
}

void RH_RecoverAnchorForLeg(const int index, const int side)
{
  if(RH_GetAnchor(index, side) > 0.0)
    return;

  string symbol = g_harvestSymbols[index].symbol;
  long magic = g_harvestSymbols[index].magic;
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
    RH_SetAnchor(index, side, oldestPrice);
    RH_SetSymbolAction(index, RH_SideName(side) + "_ANCHOR_RECOVERED");
  }
}

int RH_OpenCsv(const string filename, const string header)
{
  int handle = FileOpen(filename, FILE_READ | FILE_WRITE | FILE_CSV | FILE_ANSI, ',');
  if(handle == INVALID_HANDLE)
  {
    g_harvestLastError = "CSV_OPEN_FAILED_" + filename + "_" + IntegerToString(GetLastError());
    return INVALID_HANDLE;
  }
  if(FileSize(handle) == 0)
    FileWriteString(handle, header + "\r\n");
  FileSeek(handle, 0, SEEK_END);
  return handle;
}

void RH_LogFill(const int index, const string action, const int side, const double volume, const double requestedPrice, const double filledPrice, const string reason)
{
  if(!CsvLogEnabled)
    return;

  string symbol = g_harvestSymbols[index].symbol;
  MqlTick tick;
  SymbolInfoTick(symbol, tick);
  double point = SymbolInfoDouble(symbol, SYMBOL_POINT);
  double spread = point > 0.0 ? (tick.ask - tick.bid) / point : 0.0;
  string filename = "limni_basket_hedge_alpha_v3_fills_" + RH_SafeFilePart(symbol) + ".csv";
  int h = RH_OpenCsv(filename,
                     "timestamp,symbol,action,side,volume,requested_price,filled_price,bid,ask,spread_points,adr,target_multiple,spacing_multiple,reason,order_id,deal_id,retcode,last_error");
  if(h == INVALID_HANDLE)
    return;

  FileWrite(h,
            RH_Timestamp(),
            symbol,
            action,
            RH_SideName(side),
            volume,
            requestedPrice,
            filledPrice,
            tick.bid,
            tick.ask,
            spread,
            g_harvestSymbols[index].adr,
            TargetAdrMultiple,
            SpacingAdrMultiple,
            reason,
            (long)g_harvestTrade.ResultOrder(),
            (long)g_harvestTrade.ResultDeal(),
            (int)g_harvestTrade.ResultRetcode(),
            g_harvestSymbols[index].lastError);
  FileClose(h);
}

void RH_LogReset(const int index, const int side, const int positionsClosed, const double legAdrPnl, const string reason)
{
  if(!CsvLogEnabled)
    return;

  string symbol = g_harvestSymbols[index].symbol;
  RawHarvestPositionSnapshot snapshot;
  RH_GetPositionSnapshot(symbol, g_harvestSymbols[index].magic, snapshot);
  string filename = "limni_basket_hedge_alpha_v3_resets_" + RH_SafeFilePart(symbol) + ".csv";
  int h = RH_OpenCsv(filename,
                     "timestamp,symbol,side,positions_closed,leg_adr_pnl,total_positions,long_positions,short_positions,open_pnl,total_fills,total_resets,reason");
  if(h == INVALID_HANDLE)
    return;

  FileWrite(h,
            RH_Timestamp(),
            symbol,
            RH_SideName(side),
            positionsClosed,
            legAdrPnl,
            snapshot.totalCount,
            snapshot.longCount,
            snapshot.shortCount,
            snapshot.openPnl,
            g_harvestSymbols[index].totalFills,
            g_harvestSymbols[index].totalResets,
            reason);
  FileClose(h);
}

bool RH_OpenGridFill(const int index, const int side, const string reason, int &ordersThisTick)
{
  string symbol = g_harvestSymbols[index].symbol;
  double volume = RH_NormalizeVolume(symbol, LotSize);
  if(volume <= 0.0)
  {
    RH_SetSymbolError(index, "INVALID_VOLUME");
    return false;
  }

  double requested = RH_RequestedEntryPrice(symbol, side);
  if(requested <= 0.0)
  {
    RH_SetSymbolError(index, "NO_MARKET_PRICE");
    return false;
  }

  g_harvestTrade.SetExpertMagicNumber(g_harvestSymbols[index].magic);
  g_harvestTrade.SetTypeFillingBySymbol(symbol);

  string comment = RH_OrderComment(index, side, reason);
  bool ok = false;
  ResetLastError();
  if(side == POSITION_TYPE_BUY)
    ok = g_harvestTrade.Buy(volume, symbol, 0.0, 0.0, 0.0, comment);
  else
    ok = g_harvestTrade.Sell(volume, symbol, 0.0, 0.0, 0.0, comment);

  if(!ok)
  {
    string err = "ORDER_FAILED_" + IntegerToString((int)g_harvestTrade.ResultRetcode()) + "_" + g_harvestTrade.ResultRetcodeDescription();
    RH_SetSymbolError(index, err);
    RH_LogFill(index, "OPEN_FAILED", side, volume, requested, 0.0, reason);
    return false;
  }

  double filled = g_harvestTrade.ResultPrice();
  if(filled <= 0.0)
    filled = requested;

  ordersThisTick++;
  g_harvestSymbols[index].totalFills++;
  RH_SetSymbolAction(index, RH_SideName(side) + "_" + reason);
  RH_LogFill(index, "OPEN", side, volume, requested, filled, reason);
  return true;
}

int RH_CloseLegPositions(const int index, const int side, const string reason)
{
  ulong tickets[];
  ArrayResize(tickets, 0);
  string symbol = g_harvestSymbols[index].symbol;
  long magic = g_harvestSymbols[index].magic;

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
  g_harvestTrade.SetExpertMagicNumber(magic);
  for(int t = 0; t < ArraySize(tickets); t++)
  {
    if(g_harvestTrade.PositionClose(tickets[t], SlippagePoints))
      closed++;
    else
      RH_SetSymbolError(index, "CLOSE_FAILED_" + IntegerToString((int)g_harvestTrade.ResultRetcode()));
  }

  if(closed > 0)
    RH_SetSymbolAction(index, RH_SideName(side) + "_" + reason);
  return closed;
}

void RH_CloseAllOwnPositionsForSymbol(const int index, const string reason)
{
  RH_CloseLegPositions(index, POSITION_TYPE_BUY, reason);
  RH_CloseLegPositions(index, POSITION_TYPE_SELL, reason);
}

void RH_UpdateDrawdown()
{
  double equity = AccountInfoDouble(ACCOUNT_EQUITY);
  if(g_harvestPeakEquity <= 0.0 || equity > g_harvestPeakEquity)
    g_harvestPeakEquity = equity;

  double drawdown = equity - g_harvestPeakEquity;
  if(drawdown < g_harvestMaxDrawdown)
    g_harvestMaxDrawdown = drawdown;
}

void RH_ManageLeg(const int index, const int side, int &ordersThisTick)
{
  if(MaxOrdersPerTick > 0 && ordersThisTick >= MaxOrdersPerTick)
    return;

  string symbol = g_harvestSymbols[index].symbol;
  long magic = g_harvestSymbols[index].magic;
  double adr = g_harvestSymbols[index].adr;
  if(adr <= 0.0)
  {
    RH_SetSymbolError(index, "ADR_UNAVAILABLE");
    return;
  }

  RawHarvestPositionSnapshot allPositions;
  RH_GetPositionSnapshot(symbol, magic, allPositions);
  if(MaxPositionsPerSymbol > 0 && allPositions.totalCount >= MaxPositionsPerSymbol)
  {
    RH_SetSymbolAction(index, "MAX_POSITIONS_HIT");
    return;
  }

  int sideCount = side == POSITION_TYPE_BUY ? allPositions.longCount : allPositions.shortCount;
  if(sideCount <= 0)
  {
    if(RH_OpenGridFill(index, side, "INITIAL", ordersThisTick))
    {
      double filled = g_harvestTrade.ResultPrice();
      if(filled <= 0.0)
        filled = RH_RequestedEntryPrice(symbol, side);
      RH_SetAnchor(index, side, filled);
      RH_SetNextAdverse(index, side, 1);
      RH_SetNextFavorable(index, side, 1);
    }
    return;
  }

  double legAdrPnl = RH_GetLegAdrPnl(symbol, magic, side, adr);
  if(legAdrPnl >= TargetAdrMultiple)
  {
    int closed = RH_CloseLegPositions(index, side, "TARGET_RESET");
    if(closed > 0)
    {
      g_harvestSymbols[index].totalResets++;
      RH_LogReset(index, side, closed, legAdrPnl, "TARGET_RESET");
      RH_ResetLegState(index, side);
    }
    return;
  }

  RH_RecoverAnchorForLeg(index, side);
  double anchor = RH_GetAnchor(index, side);
  if(anchor <= 0.0)
    return;

  double mark = RH_MarkPrice(symbol, side);
  if(mark <= 0.0)
    return;

  double directedAdr = side == POSITION_TYPE_BUY ? (mark - anchor) / adr : (anchor - mark) / adr;

  while(MaxOrdersPerTick <= 0 || ordersThisTick < MaxOrdersPerTick)
  {
    int nextAdverse = RH_GetNextAdverse(index, side);
    if(directedAdr > -SpacingAdrMultiple * nextAdverse)
      break;
    if(!RH_OpenGridFill(index, side, "ADVERSE_L" + IntegerToString(nextAdverse), ordersThisTick))
      break;
    RH_SetNextAdverse(index, side, nextAdverse + 1);
  }

  while(MaxOrdersPerTick <= 0 || ordersThisTick < MaxOrdersPerTick)
  {
    int nextFavorable = RH_GetNextFavorable(index, side);
    if(directedAdr < SpacingAdrMultiple * nextFavorable)
      break;
    if(!RH_OpenGridFill(index, side, "FAVORABLE_L" + IntegerToString(nextFavorable), ordersThisTick))
      break;
    RH_SetNextFavorable(index, side, nextFavorable + 1);
  }
}

void RH_UpdateDashboard(const bool force)
{
  if(!DashboardEnabled)
    return;

  datetime now = TimeCurrent();
  if(!force && DashboardRefreshSeconds > 0 && now - g_harvestLastDashboard < DashboardRefreshSeconds)
    return;
  g_harvestLastDashboard = now;

  int totalPositions = 0;
  int totalLong = 0;
  int totalShort = 0;
  int totalFills = 0;
  int totalResets = 0;
  double openPnl = 0.0;

  for(int i = 0; i < ArraySize(g_harvestSymbols); i++)
  {
    RawHarvestPositionSnapshot snapshot;
    RH_GetPositionSnapshot(g_harvestSymbols[i].symbol, g_harvestSymbols[i].magic, snapshot);
    totalPositions += snapshot.totalCount;
    totalLong += snapshot.longCount;
    totalShort += snapshot.shortCount;
    openPnl += snapshot.openPnl;
    totalFills += g_harvestSymbols[i].totalFills;
    totalResets += g_harvestSymbols[i].totalResets;
  }

  string text = LIMNI_RAW_HARVEST_BUILD_NAME + "\n";
  text += "Symbols " + IntegerToString(ArraySize(g_harvestSymbols)) +
          " | Trading " + (RH_TradingAllowedNow() ? "ON" : "OFF") +
          " | Target " + DoubleToString(TargetAdrMultiple, 2) +
          " | Spacing " + DoubleToString(SpacingAdrMultiple, 2) + "\n";
  text += "Positions " + IntegerToString(totalPositions) +
          " L" + IntegerToString(totalLong) +
          " S" + IntegerToString(totalShort) +
          " | Fills " + IntegerToString(totalFills) +
          " | Resets " + IntegerToString(totalResets) + "\n";
  text += "Open PnL " + DoubleToString(openPnl, 2) +
          " | Max DD " + DoubleToString(g_harvestMaxDrawdown, 2) + "\n";
  text += "Last " + g_harvestLastAction + "\n";
  if(g_harvestLastError != "")
    text += "Error " + g_harvestLastError + "\n";

  int shown = 0;
  for(int i = 0; i < ArraySize(g_harvestSymbols); i++)
  {
    if(DashboardMaxSymbols > 0 && shown >= DashboardMaxSymbols)
      break;
    RawHarvestPositionSnapshot snapshot;
    RH_GetPositionSnapshot(g_harvestSymbols[i].symbol, g_harvestSymbols[i].magic, snapshot);
    text += g_harvestSymbols[i].symbol +
            " ADR " + DoubleToString(g_harvestSymbols[i].adr, (int)SymbolInfoInteger(g_harvestSymbols[i].symbol, SYMBOL_DIGITS)) +
            " L" + IntegerToString(snapshot.longCount) +
            " S" + IntegerToString(snapshot.shortCount) +
            " A:" + DoubleToString(g_harvestSymbols[i].longAnchor, (int)SymbolInfoInteger(g_harvestSymbols[i].symbol, SYMBOL_DIGITS)) +
            "/" + DoubleToString(g_harvestSymbols[i].shortAnchor, (int)SymbolInfoInteger(g_harvestSymbols[i].symbol, SYMBOL_DIGITS)) +
            "\n";
    shown++;
  }

  Comment(text);
}

void RH_ManageAllSymbols()
{
  RH_UpdateDrawdown();

  if(ManualFlattenNow)
  {
    for(int i = 0; i < ArraySize(g_harvestSymbols); i++)
      RH_CloseAllOwnPositionsForSymbol(i, "MANUAL_FLATTEN");
    g_harvestLastAction = "MANUAL_FLATTEN_REQUESTED";
    RH_UpdateDashboard(true);
    return;
  }

  if(!RH_TradingAllowedNow())
  {
    RH_UpdateDashboard(false);
    return;
  }

  int ordersThisTick = 0;
  for(int i = 0; i < ArraySize(g_harvestSymbols); i++)
  {
    if(!RH_RefreshAdr(i, false))
    {
      RH_SetSymbolError(i, "ADR_UNAVAILABLE");
      continue;
    }

    RH_ManageLeg(i, POSITION_TYPE_BUY, ordersThisTick);
    RH_ManageLeg(i, POSITION_TYPE_SELL, ordersThisTick);

    if(MaxOrdersPerTick > 0 && ordersThisTick >= MaxOrdersPerTick)
      break;
  }

  RH_UpdateDashboard(false);
}

int RH_OnInit()
{
  g_harvestStartedAt = TimeCurrent();
  g_harvestPeakEquity = AccountInfoDouble(ACCOUNT_EQUITY);
  g_harvestMaxDrawdown = 0.0;
  g_harvestLastAction = "INIT";
  g_harvestLastError = "";

  if(!RH_IsHedgingAccount())
  {
    Print(LIMNI_RAW_HARVEST_BUILD_NAME + " requires a hedging account.");
    return INIT_FAILED;
  }

  RH_BuildSymbolList();
  if(ArraySize(g_harvestSymbols) <= 0)
  {
    Print(LIMNI_RAW_HARVEST_BUILD_NAME + " has no symbols to manage.");
    return INIT_FAILED;
  }

  g_harvestTrade.SetDeviationInPoints(SlippagePoints);

  for(int i = 0; i < ArraySize(g_harvestSymbols); i++)
  {
    if(!RH_EnsureSymbolSelected(g_harvestSymbols[i].symbol))
      RH_SetSymbolError(i, "SYMBOL_SELECT_FAILED");
    RH_RefreshAdr(i, true);
    RH_RecoverAnchorForLeg(i, POSITION_TYPE_BUY);
    RH_RecoverAnchorForLeg(i, POSITION_TYPE_SELL);
  }

  if(EnableTimer)
    EventSetTimer(MathMax(1, TimerSeconds));

  RH_UpdateDashboard(true);
  Print(StringFormat("%s initialized. symbols=%d target=%.2f spacing=%.2f", LIMNI_RAW_HARVEST_BUILD_NAME, ArraySize(g_harvestSymbols), TargetAdrMultiple, SpacingAdrMultiple));
  return INIT_SUCCEEDED;
}

void RH_OnDeinit()
{
  if(EnableTimer)
    EventKillTimer();
  Comment("");
}

#endif // __LIMNI_RAW_HARVEST_ENGINE_MQH__
