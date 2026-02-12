//+------------------------------------------------------------------+
//|                                    HistoricalReconstruction.mqh   |
//|    Reconstructs key telemetry metrics after EA reconnect gaps.    |
//+------------------------------------------------------------------+
#ifndef __LIMNI_HISTORICAL_RECONSTRUCTION_MQH__
#define __LIMNI_HISTORICAL_RECONSTRUCTION_MQH__

struct HRSettings
{
  int maxDays;
  int timeoutSeconds;
  int maxCandlesPerSymbol;
  ENUM_TIMEFRAMES timeframe;
  bool includeMagicOnly;
  long magicNumber;
  datetime weekStartUtc;
};

struct HROutcome
{
  bool attempted;
  bool completed;
  bool partial;
  bool failed;
  bool positionSetChanged;
  datetime windowStartUtc;
  datetime windowEndUtc;
  int symbolsProcessed;
  int positionsProcessed;
  int marketClosedSegments;
  int candlesProcessed;
  int dealsProcessed;
  int tradesCount;
  double realizedWeekPnl;
  double peakEquityCandidate;
  double troughEquityCandidate;
  double mergedPeakEquity;
  double mergedMaxDrawdownPct;
  string note;
};

void HR_DefaultSettings(HRSettings &settings)
{
  settings.maxDays = 14;
  settings.timeoutSeconds = 30;
  settings.maxCandlesPerSymbol = 1000;
  settings.timeframe = PERIOD_M5;
  settings.includeMagicOnly = true;
  settings.magicNumber = 0;
  settings.weekStartUtc = 0;
}

void HR_InitOutcome(HROutcome &outcome)
{
  outcome.attempted = false;
  outcome.completed = false;
  outcome.partial = false;
  outcome.failed = false;
  outcome.positionSetChanged = false;
  outcome.windowStartUtc = 0;
  outcome.windowEndUtc = 0;
  outcome.symbolsProcessed = 0;
  outcome.positionsProcessed = 0;
  outcome.marketClosedSegments = 0;
  outcome.candlesProcessed = 0;
  outcome.dealsProcessed = 0;
  outcome.tradesCount = 0;
  outcome.realizedWeekPnl = 0.0;
  outcome.peakEquityCandidate = 0.0;
  outcome.troughEquityCandidate = 0.0;
  outcome.mergedPeakEquity = 0.0;
  outcome.mergedMaxDrawdownPct = 0.0;
  outcome.note = "";
}

bool HR_StringExists(const string &list[], const string value)
{
  for(int i = 0; i < ArraySize(list); i++)
  {
    if(list[i] == value)
      return true;
  }
  return false;
}

void HR_AddUniqueString(string &list[], const string value)
{
  if(value == "")
    return;
  if(HR_StringExists(list, value))
    return;
  int size = ArraySize(list);
  ArrayResize(list, size + 1);
  list[size] = value;
}

bool HR_IsTimedOut(uint startedAt, int timeoutSeconds)
{
  if(timeoutSeconds <= 0)
    return false;
  uint elapsed = (uint)(GetTickCount() - startedAt);
  return elapsed >= (uint)(timeoutSeconds * 1000);
}

bool HR_CalcProfit(ENUM_ORDER_TYPE orderType, const string symbol, double volume, double openPrice, double closePrice, double &profit)
{
  profit = 0.0;
  ResetLastError();
  if(OrderCalcProfit(orderType, symbol, volume, openPrice, closePrice, profit))
    return true;

  double contractSize = SymbolInfoDouble(symbol, SYMBOL_TRADE_CONTRACT_SIZE);
  if(contractSize <= 0.0)
    return false;

  double delta = closePrice - openPrice;
  if(orderType == ORDER_TYPE_SELL)
    delta = openPrice - closePrice;
  profit = delta * volume * contractSize;
  return true;
}

bool HR_RunReconstruction(const HRSettings &settings,
                         datetime offlineStartUtc,
                         datetime offlineEndUtc,
                         double baselineEquity,
                         double balanceNow,
                         double &ioWeekPeakEquity,
                         double &ioMaxDrawdownPct,
                         double &outWeekRealizedPnl,
                         int &outWeekTradeCount,
                         HROutcome &outcome)
{
  HR_InitOutcome(outcome);
  outWeekRealizedPnl = 0.0;
  outWeekTradeCount = 0;

  if(offlineEndUtc <= offlineStartUtc)
  {
    outcome.failed = true;
    outcome.note = "invalid window";
    return false;
  }

  outcome.attempted = true;
  outcome.windowEndUtc = offlineEndUtc;

  datetime effectiveStart = offlineStartUtc;
  if(settings.maxDays > 0)
  {
    datetime maxStart = offlineEndUtc - settings.maxDays * 86400;
    if(effectiveStart < maxStart)
    {
      effectiveStart = maxStart;
      outcome.partial = true;
      outcome.note = "window clipped";
    }
  }
  outcome.windowStartUtc = effectiveStart;

  string symbols[];
  ArrayResize(symbols, 0);
  int totalPositions = PositionsTotal();
  for(int i = 0; i < totalPositions; i++)
  {
    ulong ticket = PositionGetTicket(i);
    if(ticket == 0 || !PositionSelectByTicket(ticket))
      continue;
    if(settings.includeMagicOnly)
    {
      long magic = PositionGetInteger(POSITION_MAGIC);
      if(magic != settings.magicNumber)
        continue;
    }
    string symbol = PositionGetString(POSITION_SYMBOL);
    HR_AddUniqueString(symbols, symbol);
    outcome.positionsProcessed++;
  }

  uint startedAt = GetTickCount();
  double aggregateBestOpenPnl = 0.0;
  double aggregateWorstOpenPnl = 0.0;

  for(int s = 0; s < ArraySize(symbols); s++)
  {
    if(HR_IsTimedOut(startedAt, settings.timeoutSeconds))
    {
      outcome.partial = true;
      outcome.note = "timeout";
      break;
    }

    string symbol = symbols[s];
    MqlRates rates[];
    int copied = CopyRates(symbol, settings.timeframe, effectiveStart, offlineEndUtc, rates);
    if(copied <= 0)
    {
      outcome.marketClosedSegments++;
      continue;
    }

    int bars = copied;
    if(settings.maxCandlesPerSymbol > 0 && bars > settings.maxCandlesPerSymbol)
    {
      bars = settings.maxCandlesPerSymbol;
      outcome.partial = true;
    }

    double lowMin = rates[0].low;
    double highMax = rates[0].high;
    for(int i = 0; i < bars; i++)
    {
      if(rates[i].low < lowMin)
        lowMin = rates[i].low;
      if(rates[i].high > highMax)
        highMax = rates[i].high;
    }

    outcome.candlesProcessed += bars;

    double symbolBest = 0.0;
    double symbolWorst = 0.0;
    for(int i = 0; i < totalPositions; i++)
    {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0 || !PositionSelectByTicket(ticket))
        continue;
      if(PositionGetString(POSITION_SYMBOL) != symbol)
        continue;
      if(settings.includeMagicOnly)
      {
        long magic = PositionGetInteger(POSITION_MAGIC);
        if(magic != settings.magicNumber)
          continue;
      }

      long posType = PositionGetInteger(POSITION_TYPE);
      double volume = PositionGetDouble(POSITION_VOLUME);
      double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
      if(volume <= 0.0 || openPrice <= 0.0)
        continue;

      double bestPrice = (posType == POSITION_TYPE_BUY ? highMax : lowMin);
      double worstPrice = (posType == POSITION_TYPE_BUY ? lowMin : highMax);
      ENUM_ORDER_TYPE orderType = (posType == POSITION_TYPE_SELL ? ORDER_TYPE_SELL : ORDER_TYPE_BUY);

      double profitBest = 0.0;
      double profitWorst = 0.0;
      if(!HR_CalcProfit(orderType, symbol, volume, openPrice, bestPrice, profitBest))
        profitBest = 0.0;
      if(!HR_CalcProfit(orderType, symbol, volume, openPrice, worstPrice, profitWorst))
        profitWorst = 0.0;

      symbolBest += profitBest;
      symbolWorst += profitWorst;
    }

    aggregateBestOpenPnl += symbolBest;
    aggregateWorstOpenPnl += symbolWorst;
    outcome.symbolsProcessed++;
  }

  outcome.peakEquityCandidate = balanceNow + aggregateBestOpenPnl;
  outcome.troughEquityCandidate = balanceNow + aggregateWorstOpenPnl;

  double mergedPeak = ioWeekPeakEquity;
  if(mergedPeak <= 0.0)
  {
    mergedPeak = baselineEquity > 0.0 ? baselineEquity : balanceNow;
  }
  if(outcome.peakEquityCandidate > mergedPeak)
    mergedPeak = outcome.peakEquityCandidate;
  if(balanceNow > mergedPeak)
    mergedPeak = balanceNow;

  double trough = outcome.troughEquityCandidate;
  if(trough <= 0.0)
    trough = balanceNow;

  double mergedDd = ioMaxDrawdownPct;
  if(mergedPeak > 0.0)
  {
    double dd = (mergedPeak - trough) / mergedPeak * 100.0;
    if(dd > mergedDd)
      mergedDd = dd;
  }

  ioWeekPeakEquity = mergedPeak;
  ioMaxDrawdownPct = mergedDd;
  outcome.mergedPeakEquity = mergedPeak;
  outcome.mergedMaxDrawdownPct = mergedDd;

  datetime historyFrom = (settings.weekStartUtc > 0 ? settings.weekStartUtc : effectiveStart);
  if(historyFrom < effectiveStart)
    historyFrom = effectiveStart;
  if(!HistorySelect(historyFrom, offlineEndUtc))
  {
    outcome.failed = true;
    outcome.note = "history select failed";
    return false;
  }

  long tradePosIds[];
  ArrayResize(tradePosIds, 0);
  int deals = HistoryDealsTotal();
  for(int i = 0; i < deals; i++)
  {
    if(HR_IsTimedOut(startedAt, settings.timeoutSeconds))
    {
      outcome.partial = true;
      outcome.note = "timeout history";
      break;
    }

    ulong dealTicket = HistoryDealGetTicket(i);
    if(dealTicket == 0)
      continue;
    if(settings.includeMagicOnly)
    {
      long magic = (long)HistoryDealGetInteger(dealTicket, DEAL_MAGIC);
      if(magic != settings.magicNumber)
        continue;
    }

    int entry = (int)HistoryDealGetInteger(dealTicket, DEAL_ENTRY);
    if(entry == DEAL_ENTRY_IN || entry == DEAL_ENTRY_INOUT)
      outcome.positionSetChanged = true;
    if(entry != DEAL_ENTRY_OUT)
      continue;

    double profit = HistoryDealGetDouble(dealTicket, DEAL_PROFIT);
    profit += HistoryDealGetDouble(dealTicket, DEAL_SWAP);
    profit += HistoryDealGetDouble(dealTicket, DEAL_COMMISSION);
    outWeekRealizedPnl += profit;
    outcome.dealsProcessed++;

    long posId = (long)HistoryDealGetInteger(dealTicket, DEAL_POSITION_ID);
    bool seen = false;
    for(int j = 0; j < ArraySize(tradePosIds); j++)
    {
      if(tradePosIds[j] == posId)
      {
        seen = true;
        break;
      }
    }
    if(!seen)
    {
      int size = ArraySize(tradePosIds);
      ArrayResize(tradePosIds, size + 1);
      tradePosIds[size] = posId;
    }
  }

  outWeekTradeCount = ArraySize(tradePosIds);
  outcome.tradesCount = outWeekTradeCount;
  outcome.realizedWeekPnl = outWeekRealizedPnl;
  outcome.completed = !outcome.failed;
  return outcome.completed;
}

#endif // __LIMNI_HISTORICAL_RECONSTRUCTION_MQH__
