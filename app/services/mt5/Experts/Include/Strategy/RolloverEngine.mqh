/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
#ifndef __LIMNI_ROLLOVER_ENGINE_MQH__
#define __LIMNI_ROLLOVER_ENGINE_MQH__

datetime GetNextNyRolloverGmt(datetime nowGmt)
{
  bool dstNow = IsUsdDstUtc(nowGmt);
  int nowOffset = dstNow ? -4 : -5;
  datetime etNow = nowGmt + nowOffset * 3600;

  MqlDateTime etStruct;
  TimeToStruct(etNow, etStruct);
  etStruct.hour = 17;
  etStruct.min = 0;
  etStruct.sec = 0;
  datetime rolloverEt = StructToTime(etStruct);
  if(etNow >= rolloverEt)
    rolloverEt += 86400;

  MqlDateTime rolloverStruct;
  TimeToStruct(rolloverEt, rolloverStruct);
  bool dstRollover = IsUsdDstLocal(rolloverStruct.year, rolloverStruct.mon, rolloverStruct.day, rolloverStruct.hour);
  int rolloverOffset = dstRollover ? -4 : -5;
  datetime rolloverUtc = rolloverEt - rolloverOffset * 3600;
  return rolloverUtc;
}

int SecondsToNextNyRollover(datetime nowGmt)
{
  datetime rolloverUtc = GetNextNyRolloverGmt(nowGmt);
  if(rolloverUtc <= 0)
    return -1;
  int seconds = (int)(rolloverUtc - nowGmt);
  if(seconds < 0)
    return 0;
  return seconds;
}

bool EnforceFiveersSwapFlatWindow(datetime nowGmt)
{
  if(!IsSwapGuardEnabled())
    return false;

  int flatMinutes = FiveersSwapFlatMinutesBeforeRollover;
  if(flatMinutes <= 0)
    return false;

  int secondsToRollover = SecondsToNextNyRollover(nowGmt);
  if(secondsToRollover < 0 || secondsToRollover > flatMinutes * 60)
    return false;

  bool closedAny = false;
  int total = PositionsTotal();
  for(int i = total - 1; i >= 0; i--)
  {
    ulong ticket = PositionGetTicket(i);
    if(ticket == 0)
      continue;
    if(!PositionSelectByTicket(ticket))
      continue;
    if((long)PositionGetInteger(POSITION_MAGIC) != MagicNumber)
      continue;

    string symbol = PositionGetString(POSITION_SYMBOL);
    if(!IsFiveersSwapGuardSymbol(symbol))
      continue;

    if(!ClosePositionByTicket(ticket, "swap_guard_close"))
    {
      LogTradeError(StringFormat("5ERS swap guard close failed %s ticket=%llu", symbol, ticket));
      continue;
    }

    closedAny = true;
    Log(StringFormat("5ERS swap guard closed %s ticket=%llu before NY rollover.", symbol, ticket));
  }

  return closedAny;
}

bool IsDailyFlatReopenEnabled()
{
  return (IsFiveersMode() && EnableFiveersDailyFlatReopen);
}

string GetAssetClassForSymbol(const string symbol)
{
  for(int i = 0; i < ArraySize(g_brokerSymbols); i++)
  {
    if(g_brokerSymbols[i] == symbol)
    {
      if(i < ArraySize(g_assetClasses))
        return g_assetClasses[i];
      return "fx";
    }
  }
  return "fx";
}

datetime ConvertEtToGmt(int hourEt, int minuteEt, datetime nowGmt)
{
  bool dstNow = IsUsdDstUtc(nowGmt);
  int nowOffset = dstNow ? -4 : -5;
  datetime etNow = nowGmt + nowOffset * 3600;

  MqlDateTime etStruct;
  TimeToStruct(etNow, etStruct);
  etStruct.hour = hourEt;
  etStruct.min = minuteEt;
  etStruct.sec = 0;
  datetime targetEt = StructToTime(etStruct);

  MqlDateTime targetStruct;
  TimeToStruct(targetEt, targetStruct);
  bool dstTarget = IsUsdDstLocal(targetStruct.year, targetStruct.mon, targetStruct.day, targetStruct.hour);
  int targetOffset = dstTarget ? -4 : -5;
  datetime targetGmt = targetEt - targetOffset * 3600;
  return targetGmt;
}

datetime ConvertGmtToEt(datetime valueGmt)
{
  if(valueGmt <= 0)
    return 0;
  bool dst = IsUsdDstUtc(valueGmt);
  int offset = dst ? -4 : -5;
  return valueGmt + offset * 3600;
}

bool ShouldExecuteDailyClose(datetime nowGmt)
{
  if(!IsDailyFlatReopenEnabled())
    return false;
  if(!HasOpenPositions())
    return false;

  // Evaluate calendar windows in ET (not GMT) to avoid accidental Sunday evening triggers.
  datetime nowEt = ConvertGmtToEt(nowGmt);
  if(nowEt <= 0)
    return false;
  MqlDateTime etStruct;
  TimeToStruct(nowEt, etStruct);
  if(etStruct.day_of_week == 0 || etStruct.day_of_week == 6)
    return false;

  datetime closeTimeGmt = ConvertEtToGmt(FiveersDailyCloseHourEt, FiveersDailyCloseMinuteEt, nowGmt);
  datetime reopenTimeGmt = ConvertEtToGmt(FiveersDailyReopenHourEt, FiveersDailyReopenMinuteEt, nowGmt);

  MqlDateTime nowEtStruct, lastCloseEtStruct;
  TimeToStruct(nowEt, nowEtStruct);
  datetime lastCloseEt = ConvertGmtToEt(g_lastDailyClose);
  TimeToStruct(lastCloseEt, lastCloseEtStruct);

  bool alreadyClosedToday = (lastCloseEtStruct.year == nowEtStruct.year &&
                              lastCloseEtStruct.mon == nowEtStruct.mon &&
                              lastCloseEtStruct.day == nowEtStruct.day);
  if(alreadyClosedToday)
    return false;

  if(nowGmt < closeTimeGmt)
    return false;
  // Do not execute the daily close once the reopen window has already started.
  if(nowGmt >= reopenTimeGmt)
    return false;

  return true;
}

bool ExecuteDailyClose(datetime nowGmt)
{
  if(!HasOpenPositions())
  {
    g_lastDailyClose = nowGmt;
    g_dailyFlatActive = true;
    SaveState();
    return false;
  }

  ArrayResize(g_dailyClosedPositions, 0);
  int total = PositionsTotal();
  int closedCount = 0;

  for(int i = total - 1; i >= 0; i--)
  {
    ulong ticket = PositionGetTicket(i);
    if(ticket == 0)
      continue;
    if(!PositionSelectByTicket(ticket))
      continue;
    if((long)PositionGetInteger(POSITION_MAGIC) != MagicNumber)
      continue;

    string symbol = PositionGetString(POSITION_SYMBOL);
    string comment = PositionGetString(POSITION_COMMENT);
    int type = (int)PositionGetInteger(POSITION_TYPE);
    int direction = (type == POSITION_TYPE_BUY ? 1 : -1);

    string model = "";
    string assetClass = "";
    int commentLen = StringLen(comment);
    int basketIdx = StringFind(comment, "LimniBasket");
    if(basketIdx >= 0)
    {
      int modelStart = basketIdx + StringLen("LimniBasket");
      if(modelStart < commentLen)
      {
        int spaceIdx = StringFind(comment, " ", modelStart);
        if(spaceIdx > modelStart)
          model = StringSubstr(comment, modelStart, spaceIdx - modelStart);
        else
          model = StringSubstr(comment, modelStart);
      }
    }

    StringTrimLeft(model);
    StringTrimRight(model);
    if(model == "")
      model = "unknown";

    assetClass = GetAssetClassForSymbol(symbol);

    if(!ClosePositionByTicket(ticket, "daily_flat_close"))
    {
      LogTradeError(StringFormat("5ERS daily flat close failed %s ticket=%llu", symbol, ticket));
      continue;
    }

    // Only cache if close succeeded
    int idx = ArraySize(g_dailyClosedPositions);
    ArrayResize(g_dailyClosedPositions, idx + 1);
    g_dailyClosedPositions[idx].symbol = symbol;
    g_dailyClosedPositions[idx].direction = direction;
    g_dailyClosedPositions[idx].model = model;
    g_dailyClosedPositions[idx].assetClass = assetClass;

    closedCount++;
  }

  g_lastDailyClose = nowGmt;
  g_dailyFlatActive = true;
  // Clear stale rate-limit timestamps so post-reopen reconciliation can continue immediately.
  ArrayResize(g_orderTimes, 0);
  SaveState();
  Log(StringFormat("5ERS daily flat executed at %.0f ET. Closed %d positions for reopen at %.0f ET.",
                   (double)FiveersDailyCloseHourEt + FiveersDailyCloseMinuteEt / 60.0,
                   closedCount,
                   (double)FiveersDailyReopenHourEt + FiveersDailyReopenMinuteEt / 60.0));
  return (closedCount > 0);
}

bool ShouldExecuteDailyReopen(datetime nowGmt)
{
  if(!IsDailyFlatReopenEnabled())
    return false;
  if(!g_dailyFlatActive)
    return false;

  datetime nowEt = ConvertGmtToEt(nowGmt);
  if(nowEt <= 0)
    return false;
  MqlDateTime nowEtStruct;
  TimeToStruct(nowEt, nowEtStruct);

  datetime reopenTimeGmt = ConvertEtToGmt(FiveersDailyReopenHourEt, FiveersDailyReopenMinuteEt, nowGmt);

  datetime lastReopenEt = ConvertGmtToEt(g_lastDailyReopen);
  MqlDateTime lastReopenEtStruct;
  TimeToStruct(lastReopenEt, lastReopenEtStruct);

  bool alreadyReopenedToday = (lastReopenEtStruct.year == nowEtStruct.year &&
                                lastReopenEtStruct.mon == nowEtStruct.mon &&
                                lastReopenEtStruct.day == nowEtStruct.day);
  if(alreadyReopenedToday)
    return false;

  if(nowGmt < reopenTimeGmt)
    return false;

  // Reopen only on the same ET day as the flat close.
  datetime lastCloseEt = ConvertGmtToEt(g_lastDailyClose);
  MqlDateTime lastCloseEtStruct;
  TimeToStruct(lastCloseEt, lastCloseEtStruct);
  bool hasSameDayClose = (lastCloseEtStruct.year == nowEtStruct.year &&
                          lastCloseEtStruct.mon == nowEtStruct.mon &&
                          lastCloseEtStruct.day == nowEtStruct.day);
  if(!hasSameDayClose)
    return false;

  double balance = AccountInfoDouble(ACCOUNT_BALANCE);
  if(g_weekStartBalance > 0.0)
  {
    double weekProfitPct = ((balance - g_weekStartBalance) / g_weekStartBalance) * 100.0;
    if(weekProfitPct >= FiveersDailyTargetPct)
    {
      Log(StringFormat("5ERS daily reopen skipped: week target hit (%.2f%% >= %.2f%%)", weekProfitPct, FiveersDailyTargetPct));
      g_dailyFlatActive = false;
      SaveState();
      return false;
    }
  }

  return true;
}

bool IsTerminalAutoTradingEnabled()
{
  return (TerminalInfoInteger(TERMINAL_TRADE_ALLOWED) != 0 &&
          MQLInfoInteger(MQL_TRADE_ALLOWED) != 0);
}

bool ExecuteDailyReopen(datetime nowGmt)
{
  if(!IsTerminalAutoTradingEnabled())
  {
    datetime nowWarn = TimeCurrent();
    if(g_lastAutoTradingWarn == 0 || (nowWarn - g_lastAutoTradingWarn) >= 60)
    {
      LogTradeError("AutoTrading disabled by client/terminal. Daily reopen deferred until enabled.");
      g_lastAutoTradingWarn = nowWarn;
    }
    return false;
  }

  if(ArraySize(g_dailyClosedPositions) == 0)
  {
    g_lastDailyReopen = nowGmt;
    g_dailyFlatActive = false;
    SaveState();
    Log("5ERS daily reopen: no cached positions to reopen.");
    return false;
  }

  double balance = AccountInfoDouble(ACCOUNT_BALANCE);
  int reopenedCount = 0;
  int failedCount = 0;

  for(int i = 0; i < ArraySize(g_dailyClosedPositions); i++)
  {
    string symbol = g_dailyClosedPositions[i].symbol;
    int direction = g_dailyClosedPositions[i].direction;
    string model = g_dailyClosedPositions[i].model;
    string assetClass = g_dailyClosedPositions[i].assetClass;

    LegSizingResult sizing;
    if(!EvaluateLegSizing(symbol, assetClass, sizing))
    {
      failedCount++;
      continue;
    }

    if(sizing.finalLot <= 0.0)
    {
      failedCount++;
      continue;
    }

    if(!PlaceOrder(symbol, direction, sizing.finalLot, model, "daily_reopen"))
    {
      failedCount++;
      continue;
    }

    reopenedCount++;
  }

  g_lastDailyReopen = nowGmt;
  g_dailyFlatActive = false;
  ArrayResize(g_dailyClosedPositions, 0);
  ArrayResize(g_orderTimes, 0);
  SaveState();

  Log(StringFormat("5ERS daily reopen executed at %.0f ET. Reopened %d/%d positions (balance %.2f).",
                   (double)FiveersDailyReopenHourEt + FiveersDailyReopenMinuteEt / 60.0,
                   reopenedCount,
                   reopenedCount + failedCount,
                   balance));
  return (reopenedCount > 0);
}

bool IsSundayCryptoCarrySymbol(const string symbol)
{
  string upper = symbol;
  StringToUpper(upper);
  string key = NormalizeSymbolKey(upper);
  if(key == "")
    return false;
  if(StringFind(key, "BTCUSD") >= 0)
    return true;
  if(StringFind(key, "ETHUSD") >= 0)
    return true;
  return false;
}

#endif // __LIMNI_ROLLOVER_ENGINE_MQH__
