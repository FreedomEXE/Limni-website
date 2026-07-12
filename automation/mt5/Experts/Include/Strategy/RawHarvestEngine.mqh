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
  datetime lastAdrCheck;
  int totalFills;
  int totalResets;
  int longNextAdverse;
  int longNextFavorable;
  int shortNextAdverse;
  int shortNextFavorable;
  double longAnchor;
  double shortAnchor;
  double unitLot;
  double point;
  int digits;
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
  double longAdrPnl;
  double shortAdrPnl;
  datetime longOldestTime;
  datetime shortOldestTime;
  double longOldestPrice;
  double shortOldestPrice;
};

CTrade g_harvestTrade;
RawHarvestSymbolState g_harvestSymbols[];
datetime g_harvestStartedAt = 0;
datetime g_harvestLastDashboard = 0;
datetime g_harvestLastManageAt = 0;
datetime g_harvestLastManageBar = 0;
datetime g_harvestLastDrawdownAt = 0;
double g_harvestPeakEquity = 0.0;
double g_harvestMaxDrawdown = 0.0;
double g_harvestCycleStartEquity = 0.0;
double g_harvestCycleHighEquity = 0.0;
datetime g_harvestLastEquityHwmResetAt = 0;
int g_harvestEquityHwmResetCount = 0;
datetime g_harvestLastEquityLwmResetAt = 0;
int g_harvestEquityLwmResetCount = 0;
datetime g_harvestLastMaxAgeResetAt = 0;
int g_harvestMaxAgeResetCount = 0;
bool g_harvestTrailArmed = false;
bool g_harvestTrailLocked = false;
int g_harvestTrailLockCount = 0;
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
  g_harvestSymbols[size].lastAdrCheck = 0;
  g_harvestSymbols[size].totalFills = 0;
  g_harvestSymbols[size].totalResets = 0;
  g_harvestSymbols[size].longNextAdverse = 1;
  g_harvestSymbols[size].longNextFavorable = 1;
  g_harvestSymbols[size].shortNextAdverse = 1;
  g_harvestSymbols[size].shortNextFavorable = 1;
  g_harvestSymbols[size].longAnchor = 0.0;
  g_harvestSymbols[size].shortAnchor = 0.0;
  g_harvestSymbols[size].unitLot = 0.0;
  g_harvestSymbols[size].point = 0.0;
  g_harvestSymbols[size].digits = 5;
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

bool RH_RefreshSymbolSpec(const int index)
{
  if(index < 0 || index >= ArraySize(g_harvestSymbols))
    return false;

  string symbol = g_harvestSymbols[index].symbol;
  g_harvestSymbols[index].unitLot = RH_NormalizeVolume(symbol, LotSize);
  g_harvestSymbols[index].point = SymbolInfoDouble(symbol, SYMBOL_POINT);
  g_harvestSymbols[index].digits = (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);

  if(g_harvestSymbols[index].unitLot <= 0.0)
  {
    RH_SetSymbolError(index, "INVALID_UNIT_LOT");
    return false;
  }
  return true;
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
  datetime now = TimeCurrent();
  if(!force &&
     AdrRefreshSeconds > 0 &&
     g_harvestSymbols[index].adr > 0.0 &&
     g_harvestSymbols[index].lastAdrCheck > 0 &&
     now - g_harvestSymbols[index].lastAdrCheck < AdrRefreshSeconds)
    return true;

  g_harvestSymbols[index].lastAdrCheck = now;
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
  snapshot.longAdrPnl = 0.0;
  snapshot.shortAdrPnl = 0.0;
  snapshot.longOldestTime = 0;
  snapshot.shortOldestTime = 0;
  snapshot.longOldestPrice = 0.0;
  snapshot.shortOldestPrice = 0.0;

  int stateIndex = -1;
  for(int s = 0; s < ArraySize(g_harvestSymbols); s++)
  {
    if(g_harvestSymbols[s].symbol == symbol && g_harvestSymbols[s].magic == magic)
    {
      stateIndex = s;
      break;
    }
  }

  double adr = stateIndex >= 0 ? g_harvestSymbols[stateIndex].adr : 0.0;
  double unitLot = stateIndex >= 0 ? g_harvestSymbols[stateIndex].unitLot : RH_NormalizeVolume(symbol, LotSize);
  MqlTick tick;
  bool hasTick = SymbolInfoTick(symbol, tick);

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
    double open = PositionGetDouble(POSITION_PRICE_OPEN);
    datetime openTime = (datetime)PositionGetInteger(POSITION_TIME);
    snapshot.totalCount++;
    snapshot.openPnl += profit + swap;
    snapshot.openSwap += swap;
    if(type == POSITION_TYPE_BUY)
    {
      snapshot.longCount++;
      snapshot.longLots += volume;
      if(snapshot.longOldestTime == 0 || openTime < snapshot.longOldestTime)
      {
        snapshot.longOldestTime = openTime;
        snapshot.longOldestPrice = open;
      }
      if(hasTick && adr > 0.0 && unitLot > 0.0)
        snapshot.longAdrPnl += ((tick.bid - open) / adr) * (volume / unitLot);
    }
    else if(type == POSITION_TYPE_SELL)
    {
      snapshot.shortCount++;
      snapshot.shortLots += volume;
      if(snapshot.shortOldestTime == 0 || openTime < snapshot.shortOldestTime)
      {
        snapshot.shortOldestTime = openTime;
        snapshot.shortOldestPrice = open;
      }
      if(hasTick && adr > 0.0 && unitLot > 0.0)
        snapshot.shortAdrPnl += ((open - tick.ask) / adr) * (volume / unitLot);
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

void RH_RecoverAnchorFromSnapshot(const int index, const int side, const RawHarvestPositionSnapshot &snapshot)
{
  if(RH_GetAnchor(index, side) > 0.0)
    return;

  double oldestPrice = side == POSITION_TYPE_BUY ? snapshot.longOldestPrice : snapshot.shortOldestPrice;
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

void RH_GetBasketSnapshot(int &totalPositions,
                          int &longPositions,
                          int &shortPositions,
                          double &openPnl,
                          double &openSwap,
                          int &totalFills,
                          int &totalLegResets)
{
  totalPositions = 0;
  longPositions = 0;
  shortPositions = 0;
  openPnl = 0.0;
  openSwap = 0.0;
  totalFills = 0;
  totalLegResets = 0;

  for(int i = 0; i < ArraySize(g_harvestSymbols); i++)
  {
    RawHarvestPositionSnapshot snapshot;
    RH_GetPositionSnapshot(g_harvestSymbols[i].symbol, g_harvestSymbols[i].magic, snapshot);
    totalPositions += snapshot.totalCount;
    longPositions += snapshot.longCount;
    shortPositions += snapshot.shortCount;
    openPnl += snapshot.openPnl;
    openSwap += snapshot.openSwap;
    totalFills += g_harvestSymbols[i].totalFills;
    totalLegResets += g_harvestSymbols[i].totalResets;
  }
}

datetime RH_OldestManagedPositionTime()
{
  datetime oldest = 0;
  for(int i = 0; i < ArraySize(g_harvestSymbols); i++)
  {
    RawHarvestPositionSnapshot snapshot;
    RH_GetPositionSnapshot(g_harvestSymbols[i].symbol, g_harvestSymbols[i].magic, snapshot);
    if(snapshot.longOldestTime > 0 && (oldest == 0 || snapshot.longOldestTime < oldest))
      oldest = snapshot.longOldestTime;
    if(snapshot.shortOldestTime > 0 && (oldest == 0 || snapshot.shortOldestTime < oldest))
      oldest = snapshot.shortOldestTime;
  }
  return oldest;
}

void RH_LogEquityHwmReset(const string reason,
                          const double cycleStartEquity,
                          const double triggerEquity,
                          const double postCloseEquity,
                          const int positionsBefore,
                          const int longPositionsBefore,
                          const int shortPositionsBefore,
                          const double openPnlBefore,
                          const double openSwapBefore,
                          const int positionsClosed,
                          const int totalFills,
                          const int totalLegResets)
{
  if(!CsvLogEnabled && !EquityHwmCsvLogEnabled)
    return;

  int h = RH_OpenCsv("limni_basket_hedge_alpha_v3_equity_hwm_resets.csv",
                     "timestamp,reset_count,reason,cycle_start_equity,trigger_equity,post_close_equity,target_money,cycle_profit_at_trigger,positions_before,long_positions_before,short_positions_before,open_pnl_before,open_swap_before,positions_closed,symbols,total_fills,total_leg_resets,max_drawdown");
  if(h == INVALID_HANDLE)
    return;

  FileWrite(h,
            RH_Timestamp(),
            g_harvestEquityHwmResetCount,
            reason,
            cycleStartEquity,
            triggerEquity,
            postCloseEquity,
            EquityHwmResetTargetMoney,
            triggerEquity - cycleStartEquity,
            positionsBefore,
            longPositionsBefore,
            shortPositionsBefore,
            openPnlBefore,
            openSwapBefore,
            positionsClosed,
            ArraySize(g_harvestSymbols),
            totalFills,
            totalLegResets,
            g_harvestMaxDrawdown);
  FileClose(h);
}

void RH_LogLifecycleReset(const string reason,
                          const int resetCount,
                          const double cycleStartEquity,
                          const double triggerEquity,
                          const double postCloseEquity,
                          const int positionsBefore,
                          const int longPositionsBefore,
                          const int shortPositionsBefore,
                          const double openPnlBefore,
                          const double openSwapBefore,
                          const int positionsClosed,
                          const int totalFills,
                          const int totalLegResets,
                          const datetime oldestPositionTime)
{
  if(!CsvLogEnabled && !EquityHwmCsvLogEnabled)
    return;

  int h = RH_OpenCsv("limni_basket_hedge_alpha_v3_lifecycle_resets.csv",
                     "timestamp,reset_count,reason,cycle_start_equity,trigger_equity,post_close_equity,cycle_pnl_at_trigger,positions_before,long_positions_before,short_positions_before,open_pnl_before,open_swap_before,positions_closed,symbols,total_fills,total_leg_resets,oldest_position_time,max_drawdown");
  if(h == INVALID_HANDLE)
    return;

  FileWrite(h,
            RH_Timestamp(),
            resetCount,
            reason,
            cycleStartEquity,
            triggerEquity,
            postCloseEquity,
            triggerEquity - cycleStartEquity,
            positionsBefore,
            longPositionsBefore,
            shortPositionsBefore,
            openPnlBefore,
            openSwapBefore,
            positionsClosed,
            ArraySize(g_harvestSymbols),
            totalFills,
            totalLegResets,
            oldestPositionTime > 0 ? TimeToString(oldestPositionTime, TIME_DATE | TIME_SECONDS) : "",
            g_harvestMaxDrawdown);
  FileClose(h);
}

void RH_LogTrailLock(const string reason,
                     const double cycleStartEquity,
                     const double peakEquity,
                     const double triggerEquity,
                     const int positionsBefore,
                     const int longPositionsBefore,
                     const int shortPositionsBefore,
                     const double openPnlBefore,
                     const double openSwapBefore,
                     const int totalFills,
                     const int totalLegResets)
{
  if(!CsvLogEnabled && !EquityHwmCsvLogEnabled)
    return;

  int h = RH_OpenCsv("limni_basket_hedge_alpha_v3_trailing_locks.csv",
                     "timestamp,lock_count,reason,cycle_start_equity,cycle_peak_equity,trigger_equity,activation_money,giveback_money,positions_before,long_positions_before,short_positions_before,open_pnl_before,open_swap_before,symbols,total_fills,total_leg_resets,max_drawdown");
  if(h == INVALID_HANDLE)
    return;

  FileWrite(h,
            RH_Timestamp(),
            g_harvestTrailLockCount,
            reason,
            cycleStartEquity,
            peakEquity,
            triggerEquity,
            EquityTrailActivationMoney,
            EquityTrailGivebackMoney,
            positionsBefore,
            longPositionsBefore,
            shortPositionsBefore,
            openPnlBefore,
            openSwapBefore,
            ArraySize(g_harvestSymbols),
            totalFills,
            totalLegResets,
            g_harvestMaxDrawdown);
  FileClose(h);
}

bool RH_OpenGridFill(const int index, const int side, const string reason, int &ordersThisTick)
{
  string symbol = g_harvestSymbols[index].symbol;
  double volume = g_harvestSymbols[index].unitLot > 0.0 ? g_harvestSymbols[index].unitLot : RH_NormalizeVolume(symbol, LotSize);
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

int RH_CloseAllOwnPositionsForSymbol(const int index, const string reason)
{
  int closed = 0;
  closed += RH_CloseLegPositions(index, POSITION_TYPE_BUY, reason);
  closed += RH_CloseLegPositions(index, POSITION_TYPE_SELL, reason);
  return closed;
}

void RH_ResetAllLegStates()
{
  for(int i = 0; i < ArraySize(g_harvestSymbols); i++)
  {
    RH_ResetLegState(i, POSITION_TYPE_BUY);
    RH_ResetLegState(i, POSITION_TYPE_SELL);
  }
}

int RH_CloseAllManagedPositions(const string reason)
{
  int closed = 0;
  for(int i = 0; i < ArraySize(g_harvestSymbols); i++)
    closed += RH_CloseAllOwnPositionsForSymbol(i, reason);
  return closed;
}

void RH_ResetCycleState(const double equity)
{
  RH_ResetAllLegStates();
  g_harvestCycleStartEquity = equity;
  g_harvestCycleHighEquity = equity;
  g_harvestTrailArmed = false;
  g_harvestTrailLocked = false;
}

int RH_ResetCounterForReason(const string reason)
{
  if(reason == "EQUITY_HWM_RESET")
  {
    g_harvestEquityHwmResetCount++;
    return g_harvestEquityHwmResetCount;
  }
  if(reason == "EQUITY_LWM_RESET")
  {
    g_harvestEquityLwmResetCount++;
    return g_harvestEquityLwmResetCount;
  }
  if(reason == "MAX_AGE_RESET")
  {
    g_harvestMaxAgeResetCount++;
    return g_harvestMaxAgeResetCount;
  }
  return 0;
}

bool RH_CloseAndRestartCycle(const string reason)
{
  double triggerEquity = AccountInfoDouble(ACCOUNT_EQUITY);
  double cycleStartEquity = g_harvestCycleStartEquity > 0.0 ? g_harvestCycleStartEquity : triggerEquity;
  int positionsBefore = 0;
  int longPositionsBefore = 0;
  int shortPositionsBefore = 0;
  int totalFills = 0;
  int totalLegResets = 0;
  double openPnlBefore = 0.0;
  double openSwapBefore = 0.0;
  RH_GetBasketSnapshot(positionsBefore,
                       longPositionsBefore,
                       shortPositionsBefore,
                       openPnlBefore,
                       openSwapBefore,
                       totalFills,
                       totalLegResets);

  if(positionsBefore <= 0)
  {
    RH_ResetCycleState(triggerEquity);
    g_harvestLastAction = reason + "_NO_POSITIONS";
    return false;
  }

  datetime oldestPositionTime = RH_OldestManagedPositionTime();
  int closed = RH_CloseAllManagedPositions(reason);
  if(closed <= 0)
  {
    g_harvestLastAction = reason + "_CLOSE_FAILED";
    return false;
  }

  int resetCount = RH_ResetCounterForReason(reason);
  double postCloseEquity = AccountInfoDouble(ACCOUNT_EQUITY);
  RH_ResetCycleState(postCloseEquity);
  g_harvestLastAction = reason + "_" + IntegerToString(resetCount);

  RH_LogLifecycleReset(reason,
                       resetCount,
                       cycleStartEquity,
                       triggerEquity,
                       postCloseEquity,
                       positionsBefore,
                       longPositionsBefore,
                       shortPositionsBefore,
                       openPnlBefore,
                       openSwapBefore,
                       closed,
                       totalFills,
                       totalLegResets,
                       oldestPositionTime);

  if(reason == "EQUITY_HWM_RESET")
  {
    RH_LogEquityHwmReset(reason,
                         cycleStartEquity,
                         triggerEquity,
                         postCloseEquity,
                         positionsBefore,
                         longPositionsBefore,
                         shortPositionsBefore,
                         openPnlBefore,
                         openSwapBefore,
                         closed,
                         totalFills,
                         totalLegResets);
  }
  return true;
}

void RH_UpdateDrawdown()
{
  datetime now = TimeCurrent();
  if(DrawdownRefreshSeconds > 0 &&
     g_harvestLastDrawdownAt > 0 &&
     now - g_harvestLastDrawdownAt < DrawdownRefreshSeconds)
    return;

  g_harvestLastDrawdownAt = now;
  double equity = AccountInfoDouble(ACCOUNT_EQUITY);
  if(g_harvestPeakEquity <= 0.0 || equity > g_harvestPeakEquity)
    g_harvestPeakEquity = equity;

  double drawdown = equity - g_harvestPeakEquity;
  if(drawdown < g_harvestMaxDrawdown)
    g_harvestMaxDrawdown = drawdown;
}

bool RH_CheckEquityHwmReset()
{
  if(!EquityHwmResetEnabled || EquityHwmResetTargetMoney <= 0.0)
    return false;

  datetime now = TimeCurrent();
  if(EquityHwmResetCooldownSeconds > 0 &&
     g_harvestLastEquityHwmResetAt > 0 &&
     now - g_harvestLastEquityHwmResetAt < EquityHwmResetCooldownSeconds)
    return false;

  double equity = AccountInfoDouble(ACCOUNT_EQUITY);
  if(g_harvestCycleStartEquity <= 0.0)
    g_harvestCycleStartEquity = equity;
  if(g_harvestCycleHighEquity <= 0.0 || equity > g_harvestCycleHighEquity)
    g_harvestCycleHighEquity = equity;

  double cycleStartEquity = g_harvestCycleStartEquity;
  double cycleProfit = equity - cycleStartEquity;
  if(cycleProfit < EquityHwmResetTargetMoney)
    return false;

  if(RH_CloseAndRestartCycle("EQUITY_HWM_RESET"))
  {
    g_harvestLastEquityHwmResetAt = now;
    return true;
  }
  return false;
}

bool RH_CheckEquityLwmReset()
{
  if(!EquityLwmResetEnabled || EquityLwmLossLimitMoney <= 0.0)
    return false;

  datetime now = TimeCurrent();
  if(EquityLwmResetCooldownSeconds > 0 &&
     g_harvestLastEquityLwmResetAt > 0 &&
     now - g_harvestLastEquityLwmResetAt < EquityLwmResetCooldownSeconds)
    return false;

  double equity = AccountInfoDouble(ACCOUNT_EQUITY);
  if(g_harvestCycleStartEquity <= 0.0)
    g_harvestCycleStartEquity = equity;
  if(g_harvestCycleHighEquity <= 0.0 || equity > g_harvestCycleHighEquity)
    g_harvestCycleHighEquity = equity;

  double cycleLoss = g_harvestCycleStartEquity - equity;
  if(cycleLoss < EquityLwmLossLimitMoney)
    return false;

  if(RH_CloseAndRestartCycle("EQUITY_LWM_RESET"))
  {
    g_harvestLastEquityLwmResetAt = now;
    return true;
  }
  return false;
}

bool RH_CheckMaxAgeReset()
{
  if(!MaxAgeResetEnabled || MaxAgeDays <= 0)
    return false;

  datetime oldest = RH_OldestManagedPositionTime();
  if(oldest <= 0)
    return false;

  datetime now = TimeCurrent();
  if(g_harvestLastMaxAgeResetAt > 0 &&
     now - g_harvestLastMaxAgeResetAt < 60)
    return false;

  long maxAgeSeconds = (long)MaxAgeDays * 86400;
  if(now - oldest < maxAgeSeconds)
    return false;

  if(RH_CloseAndRestartCycle("MAX_AGE_RESET"))
  {
    g_harvestLastMaxAgeResetAt = now;
    return true;
  }
  return false;
}

bool RH_TrailLockBlocksNewAdds()
{
  return EquityTrailLockEnabled && g_harvestTrailLocked;
}

bool RH_UnlockTrailLockWhenFlat()
{
  if(!EquityTrailLockEnabled || !EquityTrailUnlockWhenFlat || !g_harvestTrailLocked)
    return false;

  int totalPositions = 0;
  int longPositions = 0;
  int shortPositions = 0;
  int totalFills = 0;
  int totalLegResets = 0;
  double openPnl = 0.0;
  double openSwap = 0.0;
  RH_GetBasketSnapshot(totalPositions,
                       longPositions,
                       shortPositions,
                       openPnl,
                       openSwap,
                       totalFills,
                       totalLegResets);

  if(totalPositions > 0)
    return false;

  double equity = AccountInfoDouble(ACCOUNT_EQUITY);
  RH_LogTrailLock("EQUITY_TRAIL_UNLOCK_FLAT",
                  g_harvestCycleStartEquity,
                  g_harvestCycleHighEquity,
                  equity,
                  totalPositions,
                  longPositions,
                  shortPositions,
                  openPnl,
                  openSwap,
                  totalFills,
                  totalLegResets);
  RH_ResetCycleState(equity);
  g_harvestLastAction = "TRAIL_UNLOCK_FLAT";
  return true;
}

void RH_UpdateEquityTrailLock()
{
  if(!EquityTrailLockEnabled || EquityTrailActivationMoney <= 0.0 || EquityTrailGivebackMoney <= 0.0)
    return;
  if(g_harvestTrailLocked)
    return;

  double equity = AccountInfoDouble(ACCOUNT_EQUITY);
  if(g_harvestCycleStartEquity <= 0.0)
    g_harvestCycleStartEquity = equity;
  if(g_harvestCycleHighEquity <= 0.0 || equity > g_harvestCycleHighEquity)
    g_harvestCycleHighEquity = equity;

  double cycleProfit = equity - g_harvestCycleStartEquity;
  if(!g_harvestTrailArmed)
  {
    if(cycleProfit >= EquityTrailActivationMoney)
    {
      g_harvestTrailArmed = true;
      g_harvestCycleHighEquity = equity;
      g_harvestLastAction = "TRAIL_LOCK_ARMED";
    }
    return;
  }

  if(equity > g_harvestCycleHighEquity)
    g_harvestCycleHighEquity = equity;

  if(g_harvestCycleHighEquity - equity < EquityTrailGivebackMoney)
    return;

  int positionsBefore = 0;
  int longPositionsBefore = 0;
  int shortPositionsBefore = 0;
  int totalFills = 0;
  int totalLegResets = 0;
  double openPnlBefore = 0.0;
  double openSwapBefore = 0.0;
  RH_GetBasketSnapshot(positionsBefore,
                       longPositionsBefore,
                       shortPositionsBefore,
                       openPnlBefore,
                       openSwapBefore,
                       totalFills,
                       totalLegResets);

  g_harvestTrailLocked = true;
  g_harvestTrailLockCount++;
  g_harvestLastAction = "TRAIL_LOCK_" + IntegerToString(g_harvestTrailLockCount);
  RH_LogTrailLock("EQUITY_TRAIL_LOCK",
                  g_harvestCycleStartEquity,
                  g_harvestCycleHighEquity,
                  equity,
                  positionsBefore,
                  longPositionsBefore,
                  shortPositionsBefore,
                  openPnlBefore,
                  openSwapBefore,
                  totalFills,
                  totalLegResets);
}

bool RH_ShouldRunManageCycle()
{
  if(!RH_IsTester())
    return true;

  datetime now = TimeCurrent();
  if(TesterMinSecondsBetweenManage > 0 &&
     g_harvestLastManageAt > 0 &&
     now - g_harvestLastManageAt < TesterMinSecondsBetweenManage)
    return false;

  ENUM_TIMEFRAMES cadenceFrame = PERIOD_CURRENT;
  if(TesterCadence == RH_CADENCE_NEW_M1_BAR)
    cadenceFrame = PERIOD_M1;
  else if(TesterCadence == RH_CADENCE_NEW_M5_BAR)
    cadenceFrame = PERIOD_M5;

  if(cadenceFrame != PERIOD_CURRENT)
  {
    datetime barTime = iTime(_Symbol, cadenceFrame, 0);
    if(barTime > 0 && barTime == g_harvestLastManageBar)
      return false;
    if(barTime > 0)
      g_harvestLastManageBar = barTime;
  }

  g_harvestLastManageAt = now;
  return true;
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
    if(RH_TrailLockBlocksNewAdds())
    {
      RH_SetSymbolAction(index, "TRAIL_LOCK_NO_INITIAL");
      return;
    }

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

  double legAdrPnl = side == POSITION_TYPE_BUY ? allPositions.longAdrPnl : allPositions.shortAdrPnl;
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

  RH_RecoverAnchorFromSnapshot(index, side, allPositions);
  double anchor = RH_GetAnchor(index, side);
  if(anchor <= 0.0)
    return;

  if(RH_TrailLockBlocksNewAdds())
  {
    RH_SetSymbolAction(index, "TRAIL_LOCK_NO_ADD");
    return;
  }

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
  if(EquityHwmResetEnabled || EquityLwmResetEnabled || MaxAgeResetEnabled || EquityTrailLockEnabled)
  {
    text += "Lifecycle HWM " + IntegerToString(g_harvestEquityHwmResetCount) +
            " LWM " + IntegerToString(g_harvestEquityLwmResetCount) +
            " Age " + IntegerToString(g_harvestMaxAgeResetCount) +
            " Trail " + (g_harvestTrailLocked ? "LOCKED" : (g_harvestTrailArmed ? "ARMED" : "OFF")) + "\n";
    text += "Cycle " + DoubleToString(g_harvestCycleStartEquity, 2) +
            " High " + DoubleToString(g_harvestCycleHighEquity, 2) + "\n";
  }
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
  if(!RH_ShouldRunManageCycle())
    return;

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

  if(RH_CheckEquityLwmReset())
  {
    RH_UpdateDashboard(true);
    return;
  }

  if(RH_CheckEquityHwmReset())
  {
    RH_UpdateDashboard(true);
    return;
  }

  if(RH_CheckMaxAgeReset())
  {
    RH_UpdateDashboard(true);
    return;
  }

  bool trailUnlocked = RH_UnlockTrailLockWhenFlat();
  RH_UpdateEquityTrailLock();

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

  RH_UpdateDashboard(trailUnlocked);
}

int RH_OnInit()
{
  g_harvestStartedAt = TimeCurrent();
  g_harvestLastManageAt = 0;
  g_harvestLastManageBar = 0;
  g_harvestLastDrawdownAt = 0;
  g_harvestPeakEquity = AccountInfoDouble(ACCOUNT_EQUITY);
  g_harvestMaxDrawdown = 0.0;
  g_harvestCycleStartEquity = AccountInfoDouble(ACCOUNT_EQUITY);
  g_harvestCycleHighEquity = g_harvestCycleStartEquity;
  g_harvestLastEquityHwmResetAt = 0;
  g_harvestEquityHwmResetCount = 0;
  g_harvestLastEquityLwmResetAt = 0;
  g_harvestEquityLwmResetCount = 0;
  g_harvestLastMaxAgeResetAt = 0;
  g_harvestMaxAgeResetCount = 0;
  g_harvestTrailArmed = false;
  g_harvestTrailLocked = false;
  g_harvestTrailLockCount = 0;
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
    RH_RefreshSymbolSpec(i);
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
