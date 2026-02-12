//+------------------------------------------------------------------+
//|                                                LimniTelemetryEA   |
//|                   Telemetry-only EA for manually traded accounts |
//+------------------------------------------------------------------+
#property strict

#define TELEMETRY_ONLY 1

#include "Include/HistoricalReconstruction.mqh"

input bool PushAccountStats = true;
input string PushUrl = "https://limni-website-nine.vercel.app/api/mt5/push";
input string PushToken = "2121";
input int PushIntervalSeconds = 300;
input string AccountLabel = "";
input int ClosedHistoryDays = 30;
input bool IncludeMagicOnlyClosed = false;
input long MagicNumber = 912401;

input bool EnableReconnectReconstruction = true;
input int ReconstructIfOfflineMinutes = 60;
input int ReconstructionMaxDays = 14;
input int ReconstructionTimeoutSeconds = 30;
input int ReconstructionMaxCandlesPerSymbol = 1000;

double g_baselineEquity = 0.0;
double g_weekPeakEquity = 0.0;
double g_maxDrawdownPct = 0.0;
datetime g_weekStartGmt = 0;
datetime g_lastPush = 0;
datetime g_lastTelemetryModeLog = 0;

string g_dataSource = "realtime";
string g_reconstructionStatus = "none";
string g_reconstructionNote = "";
datetime g_reconstructionWindowStart = 0;
datetime g_reconstructionWindowEnd = 0;
int g_reconstructionMarketClosed = 0;
int g_reconstructionTrades = 0;
double g_reconstructionWeekRealized = 0.0;
bool g_reconstructionAttempted = false;

string g_keyPrefix = "";

string Key(const string suffix) { return g_keyPrefix + suffix; }

bool IsUsdDstUtc(datetime nowGmt);
bool IsUsdDstLocal(int year, int mon, int day, int hour);
int NthSunday(int year, int mon, int nth);
datetime GetWeekStartGmt(datetime nowGmt);
void LoadState();
void SaveState();
void ResetWeeklyState();
void UpdateDrawdown();
void RunReconstructionIfNeeded();
void PushStatsIfDue();
bool SendAccountSnapshot();
bool HttpPostJson(const string url, const string payload, string &response);
string BuildAccountPayload();
string BuildPositionsArray();
string BuildClosedPositionsArray();
void GetWeeklyTradeStats(int &tradeCount, double &winRatePct);
string JsonEscape(const string value);
string BoolToJson(bool value);
string FormatIsoUtc(datetime value);
int CountOpenPairs();
double GetTotalLots();

bool PlaceOrderBlocked()
{
  Print("ERROR: Trading disabled in telemetry mode");
  return false;
}

int OnInit()
{
  long login = (long)AccountInfoInteger(ACCOUNT_LOGIN);
  g_keyPrefix = "LimniTelemetry_" + IntegerToString(login) + "_";
  g_weekStartGmt = GetWeekStartGmt(TimeGMT());
  LoadState();
  if(g_baselineEquity <= 0.0)
    g_baselineEquity = AccountInfoDouble(ACCOUNT_BALANCE);
  if(g_weekPeakEquity <= 0.0)
    g_weekPeakEquity = AccountInfoDouble(ACCOUNT_EQUITY);
  RunReconstructionIfNeeded();
  EventSetTimer(10);
  Print("LimniTelemetryEA initialized. TELEMETRY_ONLY mode active.");
  return INIT_SUCCEEDED;
}

void OnDeinit(const int reason)
{
  SaveState();
  EventKillTimer();
}

void OnTimer()
{
  datetime nowGmt = TimeGMT();
  datetime newWeekStart = GetWeekStartGmt(nowGmt);
  if(newWeekStart != g_weekStartGmt)
  {
    g_weekStartGmt = newWeekStart;
    ResetWeeklyState();
    SaveState();
  }

  if(g_lastTelemetryModeLog == 0 || (TimeCurrent() - g_lastTelemetryModeLog) >= 3600)
  {
    g_lastTelemetryModeLog = TimeCurrent();
    Print("Telemetry-only mode active, no trading.");
  }

  UpdateDrawdown();
  PushStatsIfDue();
}

void ResetWeeklyState()
{
  g_baselineEquity = AccountInfoDouble(ACCOUNT_BALANCE);
  g_weekPeakEquity = AccountInfoDouble(ACCOUNT_EQUITY);
  g_maxDrawdownPct = 0.0;
  g_dataSource = "realtime";
  g_reconstructionStatus = "none";
  g_reconstructionNote = "";
  g_reconstructionWindowStart = 0;
  g_reconstructionWindowEnd = 0;
  g_reconstructionMarketClosed = 0;
  g_reconstructionTrades = 0;
  g_reconstructionWeekRealized = 0.0;
  g_reconstructionAttempted = false;
}

void LoadState()
{
  if(GlobalVariableCheck(Key("WeekStart")) && (datetime)GlobalVariableGet(Key("WeekStart")) == g_weekStartGmt)
  {
    if(GlobalVariableCheck(Key("Baseline")))
      g_baselineEquity = GlobalVariableGet(Key("Baseline"));
    if(GlobalVariableCheck(Key("WeekPeak")))
      g_weekPeakEquity = GlobalVariableGet(Key("WeekPeak"));
    if(GlobalVariableCheck(Key("MaxDD")))
      g_maxDrawdownPct = GlobalVariableGet(Key("MaxDD"));
  }
  if(GlobalVariableCheck(Key("LastPush")))
    g_lastPush = (datetime)GlobalVariableGet(Key("LastPush"));
}

void SaveState()
{
  GlobalVariableSet(Key("WeekStart"), (double)g_weekStartGmt);
  GlobalVariableSet(Key("Baseline"), g_baselineEquity);
  GlobalVariableSet(Key("WeekPeak"), g_weekPeakEquity);
  GlobalVariableSet(Key("MaxDD"), g_maxDrawdownPct);
  GlobalVariableSet(Key("LastPush"), (double)g_lastPush);
}

void UpdateDrawdown()
{
  double equity = AccountInfoDouble(ACCOUNT_EQUITY);
  bool changed = false;
  if(g_weekPeakEquity <= 0.0 || equity > g_weekPeakEquity)
  {
    g_weekPeakEquity = equity;
    changed = true;
  }
  if(g_weekPeakEquity > 0.0)
  {
    double dd = (g_weekPeakEquity - equity) / g_weekPeakEquity * 100.0;
    if(dd > g_maxDrawdownPct)
    {
      g_maxDrawdownPct = dd;
      changed = true;
    }
  }
  if(changed)
    SaveState();
}

void RunReconstructionIfNeeded()
{
  if(!EnableReconnectReconstruction)
    return;
  datetime lastPushUtc = 0;
  if(GlobalVariableCheck(Key("LastPush")))
    lastPushUtc = (datetime)GlobalVariableGet(Key("LastPush"));
  if(lastPushUtc <= 0)
    return;

  datetime nowUtc = TimeGMT();
  int offlineSeconds = (int)(nowUtc - lastPushUtc);
  if(offlineSeconds < ReconstructIfOfflineMinutes * 60)
    return;

  HRSettings settings;
  HR_DefaultSettings(settings);
  settings.maxDays = ReconstructionMaxDays;
  settings.timeoutSeconds = ReconstructionTimeoutSeconds;
  settings.maxCandlesPerSymbol = ReconstructionMaxCandlesPerSymbol;
  settings.includeMagicOnly = IncludeMagicOnlyClosed;
  settings.magicNumber = MagicNumber;
  settings.weekStartUtc = g_weekStartGmt;

  HROutcome outcome;
  double peak = g_weekPeakEquity;
  double maxDd = g_maxDrawdownPct;
  double reconstructedPnl = 0.0;
  int reconstructedTrades = 0;
  bool ok = HR_RunReconstruction(
    settings,
    lastPushUtc,
    nowUtc,
    g_baselineEquity,
    AccountInfoDouble(ACCOUNT_BALANCE),
    peak,
    maxDd,
    reconstructedPnl,
    reconstructedTrades,
    outcome
  );

  g_reconstructionAttempted = true;
  g_dataSource = "reconstructed";
  g_reconstructionStatus = "failed";
  g_reconstructionNote = outcome.note;
  g_reconstructionWindowStart = outcome.windowStartUtc;
  g_reconstructionWindowEnd = outcome.windowEndUtc;
  g_reconstructionMarketClosed = outcome.marketClosedSegments;
  g_reconstructionTrades = reconstructedTrades;
  g_reconstructionWeekRealized = reconstructedPnl;

  if(ok)
  {
    g_weekPeakEquity = peak;
    g_maxDrawdownPct = maxDd;
    g_reconstructionStatus = outcome.partial ? "partial" : "full";
  }

  g_lastPush = 0;
  SaveState();
}

void PushStatsIfDue()
{
  if(!PushAccountStats || PushUrl == "")
    return;
  datetime now = TimeCurrent();
  if(g_lastPush != 0 && (now - g_lastPush) < PushIntervalSeconds)
    return;
  if(!SendAccountSnapshot())
    return;
  g_lastPush = now;
  GlobalVariableSet(Key("LastPush"), (double)g_lastPush);
  if(g_dataSource == "reconstructed")
    g_dataSource = "realtime";
}

bool SendAccountSnapshot()
{
  string payload = BuildAccountPayload();
  if(payload == "")
    return false;
  string response = "";
  return HttpPostJson(PushUrl, payload, response);
}

bool HttpPostJson(const string url, const string payload, string &response)
{
  uchar result[];
  uchar data[];
  string headers;
  string request_headers = "Content-Type: application/json\r\n"
                           "User-Agent: MT5-LimniTelemetry/1.0\r\n";
  if(PushToken != "")
    request_headers += "x-mt5-token: " + PushToken + "\r\n";

  int len = StringToCharArray(payload, data, 0, WHOLE_ARRAY, CP_UTF8);
  if(len > 0 && data[len - 1] == 0)
    ArrayResize(data, len - 1);

  int status = WebRequest("POST", url, request_headers, 8000, data, result, headers);
  if(status != 200)
  {
    Print(StringFormat("Telemetry push failed HTTP=%d err=%d", status, GetLastError()));
    return false;
  }
  int size = ArraySize(result);
  if(size > 0)
    response = CharArrayToString(result, 0, size);
  return true;
}

string BuildAccountPayload()
{
  string accountId = IntegerToString((long)AccountInfoInteger(ACCOUNT_LOGIN));
  string label = AccountLabel;
  if(label == "")
    label = AccountInfoString(ACCOUNT_NAME);
  if(label == "")
    label = accountId;

  double equity = AccountInfoDouble(ACCOUNT_EQUITY);
  double balance = AccountInfoDouble(ACCOUNT_BALANCE);
  double margin = AccountInfoDouble(ACCOUNT_MARGIN);
  double freeMargin = AccountInfoDouble(ACCOUNT_MARGIN_FREE);
  int openPositions = PositionsTotal();
  int openPairs = CountOpenPairs();
  double totalLots = GetTotalLots();
  double pnlPct = 0.0;
  if(g_baselineEquity > 0.0)
    pnlPct = (equity - g_baselineEquity) / g_baselineEquity * 100.0;
  int tradeCount = 0;
  double winRate = 0.0;
  GetWeeklyTradeStats(tradeCount, winRate);
  if(g_reconstructionAttempted && g_reconstructionTrades > tradeCount)
    tradeCount = g_reconstructionTrades;

  string payload = "{";
  payload += "\"account_id\":\"" + JsonEscape(accountId) + "\",";
  payload += "\"label\":\"" + JsonEscape(label) + "\",";
  payload += "\"broker\":\"" + JsonEscape(AccountInfoString(ACCOUNT_COMPANY)) + "\",";
  payload += "\"server\":\"" + JsonEscape(AccountInfoString(ACCOUNT_SERVER)) + "\",";
  payload += "\"status\":\"LIVE\",";
  payload += "\"trade_mode\":\"MANUAL\",";
  payload += "\"currency\":\"" + JsonEscape(AccountInfoString(ACCOUNT_CURRENCY)) + "\",";
  payload += "\"equity\":" + DoubleToString(equity, 2) + ",";
  payload += "\"balance\":" + DoubleToString(balance, 2) + ",";
  payload += "\"margin\":" + DoubleToString(margin, 2) + ",";
  payload += "\"free_margin\":" + DoubleToString(freeMargin, 2) + ",";
  payload += "\"basket_state\":\"TELEMETRY\",";
  payload += "\"open_positions\":" + IntegerToString(openPositions) + ",";
  payload += "\"open_pairs\":" + IntegerToString(openPairs) + ",";
  payload += "\"total_lots\":" + DoubleToString(totalLots, 2) + ",";
  payload += "\"baseline_equity\":" + DoubleToString(g_baselineEquity, 2) + ",";
  payload += "\"locked_profit_pct\":0,";
  payload += "\"basket_pnl_pct\":" + DoubleToString(pnlPct, 2) + ",";
  payload += "\"weekly_pnl_pct\":" + DoubleToString(pnlPct, 2) + ",";
  payload += "\"risk_used_pct\":0,";
  payload += "\"trade_count_week\":" + IntegerToString(tradeCount) + ",";
  payload += "\"win_rate_pct\":" + DoubleToString(winRate, 2) + ",";
  payload += "\"max_drawdown_pct\":" + DoubleToString(g_maxDrawdownPct, 2) + ",";
  payload += "\"report_date\":\"\",";
  payload += "\"api_ok\":true,";
  payload += "\"trading_allowed\":false,";
  payload += "\"last_api_error\":\"\",";
  payload += "\"next_add_seconds\":-1,";
  payload += "\"next_poll_seconds\":-1,";
  payload += "\"last_sync_utc\":\"" + FormatIsoUtc(TimeGMT()) + "\",";
  payload += "\"data_source\":\"" + JsonEscape(g_dataSource) + "\",";
  payload += "\"reconstruction_status\":\"" + JsonEscape(g_reconstructionStatus) + "\",";
  payload += "\"reconstruction_note\":\"" + JsonEscape(g_reconstructionNote) + "\",";
  payload += "\"reconstruction_window_start_utc\":\"" + JsonEscape(FormatIsoUtc(g_reconstructionWindowStart)) + "\",";
  payload += "\"reconstruction_window_end_utc\":\"" + JsonEscape(FormatIsoUtc(g_reconstructionWindowEnd)) + "\",";
  payload += "\"reconstruction_market_closed_segments\":" + IntegerToString(g_reconstructionMarketClosed) + ",";
  payload += "\"reconstruction_trades\":" + IntegerToString(g_reconstructionTrades) + ",";
  payload += "\"reconstruction_week_realized\":" + DoubleToString(g_reconstructionWeekRealized, 2) + ",";
  payload += "\"positions\":" + BuildPositionsArray() + ",";
  payload += "\"closed_positions\":" + BuildClosedPositionsArray() + ",";
  payload += "\"lot_map\":[],";
  payload += "\"lot_map_updated_utc\":\"" + FormatIsoUtc(TimeGMT()) + "\",";
  payload += "\"recent_logs\":[\"Telemetry-only mode active\"]";
  payload += "}";
  return payload;
}

string BuildPositionsArray()
{
  string result = "[";
  bool firstPos = true;
  int total = PositionsTotal();
  for(int i = 0; i < total; i++)
  {
    ulong ticket = PositionGetTicket(i);
    if(ticket == 0 || !PositionSelectByTicket(ticket))
      continue;
    string symbol = PositionGetString(POSITION_SYMBOL);
    long posType = PositionGetInteger(POSITION_TYPE);
    double lots = PositionGetDouble(POSITION_VOLUME);
    double openPrice = PositionGetDouble(POSITION_PRICE_OPEN);
    double currentPrice = PositionGetDouble(POSITION_PRICE_CURRENT);
    double stopLoss = PositionGetDouble(POSITION_SL);
    double takeProfit = PositionGetDouble(POSITION_TP);
    double profit = PositionGetDouble(POSITION_PROFIT);
    double swap = PositionGetDouble(POSITION_SWAP);
    datetime openTime = (datetime)PositionGetInteger(POSITION_TIME);
    long magic = PositionGetInteger(POSITION_MAGIC);
    string comment = PositionGetString(POSITION_COMMENT);
    if(!firstPos) result += ",";
    firstPos = false;
    result += "{";
    result += "\"ticket\":" + IntegerToString((long)ticket) + ",";
    result += "\"symbol\":\"" + JsonEscape(symbol) + "\",";
    result += "\"type\":\"" + (posType == POSITION_TYPE_BUY ? "BUY" : "SELL") + "\",";
    result += "\"lots\":" + DoubleToString(lots, 2) + ",";
    result += "\"open_price\":" + DoubleToString(openPrice, 5) + ",";
    result += "\"current_price\":" + DoubleToString(currentPrice, 5) + ",";
    result += "\"stop_loss\":" + DoubleToString(stopLoss, 5) + ",";
    result += "\"take_profit\":" + DoubleToString(takeProfit, 5) + ",";
    result += "\"profit\":" + DoubleToString(profit, 2) + ",";
    result += "\"swap\":" + DoubleToString(swap, 2) + ",";
    result += "\"commission\":0,";
    result += "\"open_time\":\"" + FormatIsoUtc(openTime) + "\",";
    result += "\"magic_number\":" + IntegerToString((int)magic) + ",";
    result += "\"comment\":\"" + JsonEscape(comment) + "\"";
    result += "}";
  }
  result += "]";
  return result;
}

string BuildClosedPositionsArray()
{
  datetime from = TimeGMT() - (ClosedHistoryDays * 86400);
  datetime to = TimeGMT();
  if(!HistorySelect(from, to))
    return "[]";

  string result = "[";
  bool first = true;
  int deals = HistoryDealsTotal();
  for(int i = 0; i < deals; i++)
  {
    ulong dealTicket = HistoryDealGetTicket(i);
    if(dealTicket == 0)
      continue;
    if(IncludeMagicOnlyClosed && (long)HistoryDealGetInteger(dealTicket, DEAL_MAGIC) != MagicNumber)
      continue;
    int entry = (int)HistoryDealGetInteger(dealTicket, DEAL_ENTRY);
    if(entry != DEAL_ENTRY_OUT)
      continue;
    string symbol = HistoryDealGetString(dealTicket, DEAL_SYMBOL);
    int type = (int)HistoryDealGetInteger(dealTicket, DEAL_TYPE);
    double volume = HistoryDealGetDouble(dealTicket, DEAL_VOLUME);
    double price = HistoryDealGetDouble(dealTicket, DEAL_PRICE);
    double profit = HistoryDealGetDouble(dealTicket, DEAL_PROFIT);
    double swap = HistoryDealGetDouble(dealTicket, DEAL_SWAP);
    double commission = HistoryDealGetDouble(dealTicket, DEAL_COMMISSION);
    datetime closeTime = (datetime)HistoryDealGetInteger(dealTicket, DEAL_TIME);
    datetime openTime = closeTime;
    string comment = HistoryDealGetString(dealTicket, DEAL_COMMENT);
    long magic = (long)HistoryDealGetInteger(dealTicket, DEAL_MAGIC);
    if(!first) result += ",";
    first = false;
    result += "{";
    result += "\"ticket\":" + IntegerToString((long)dealTicket) + ",";
    result += "\"symbol\":\"" + JsonEscape(symbol) + "\",";
    result += "\"type\":\"" + (type == DEAL_TYPE_BUY ? "BUY" : "SELL") + "\",";
    result += "\"lots\":" + DoubleToString(volume, 2) + ",";
    result += "\"open_price\":" + DoubleToString(price, 5) + ",";
    result += "\"close_price\":" + DoubleToString(price, 5) + ",";
    result += "\"profit\":" + DoubleToString(profit, 2) + ",";
    result += "\"swap\":" + DoubleToString(swap, 2) + ",";
    result += "\"commission\":" + DoubleToString(commission, 2) + ",";
    result += "\"open_time\":\"" + FormatIsoUtc(openTime) + "\",";
    result += "\"close_time\":\"" + FormatIsoUtc(closeTime) + "\",";
    result += "\"magic_number\":" + IntegerToString((int)magic) + ",";
    result += "\"comment\":\"" + JsonEscape(comment) + "\"";
    result += "}";
  }
  result += "]";
  return result;
}

void GetWeeklyTradeStats(int &tradeCount, double &winRatePct)
{
  tradeCount = 0;
  winRatePct = 0.0;
  if(!HistorySelect(g_weekStartGmt, TimeCurrent()))
    return;
  long posIds[];
  double posProfits[];
  ArrayResize(posIds, 0);
  ArrayResize(posProfits, 0);
  int deals = HistoryDealsTotal();
  for(int i = 0; i < deals; i++)
  {
    ulong ticket = HistoryDealGetTicket(i);
    if(ticket == 0)
      continue;
    if(IncludeMagicOnlyClosed && (long)HistoryDealGetInteger(ticket, DEAL_MAGIC) != MagicNumber)
      continue;
    int entry = (int)HistoryDealGetInteger(ticket, DEAL_ENTRY);
    if(entry != DEAL_ENTRY_OUT)
      continue;
    long posId = (long)HistoryDealGetInteger(ticket, DEAL_POSITION_ID);
    double net = HistoryDealGetDouble(ticket, DEAL_PROFIT) +
                 HistoryDealGetDouble(ticket, DEAL_SWAP) +
                 HistoryDealGetDouble(ticket, DEAL_COMMISSION);
    int idx = -1;
    for(int j = 0; j < ArraySize(posIds); j++)
    {
      if(posIds[j] == posId) { idx = j; break; }
    }
    if(idx < 0)
    {
      int size = ArraySize(posIds);
      ArrayResize(posIds, size + 1);
      ArrayResize(posProfits, size + 1);
      posIds[size] = posId;
      posProfits[size] = net;
    }
    else
      posProfits[idx] += net;
  }
  tradeCount = ArraySize(posIds);
  if(tradeCount <= 0)
    return;
  int wins = 0;
  for(int i = 0; i < tradeCount; i++)
  {
    if(posProfits[i] > 0.0)
      wins++;
  }
  winRatePct = (double)wins / tradeCount * 100.0;
}

int CountOpenPairs()
{
  string symbols[];
  ArrayResize(symbols, 0);
  int total = PositionsTotal();
  for(int i = 0; i < total; i++)
  {
    ulong ticket = PositionGetTicket(i);
    if(ticket == 0 || !PositionSelectByTicket(ticket))
      continue;
    string symbol = PositionGetString(POSITION_SYMBOL);
    if(!HR_StringExists(symbols, symbol))
    {
      int size = ArraySize(symbols);
      ArrayResize(symbols, size + 1);
      symbols[size] = symbol;
    }
  }
  return ArraySize(symbols);
}

double GetTotalLots()
{
  double lots = 0.0;
  int total = PositionsTotal();
  for(int i = 0; i < total; i++)
  {
    ulong ticket = PositionGetTicket(i);
    if(ticket == 0 || !PositionSelectByTicket(ticket))
      continue;
    lots += PositionGetDouble(POSITION_VOLUME);
  }
  return lots;
}

datetime GetWeekStartGmt(datetime nowGmt)
{
  bool dst = IsUsdDstUtc(nowGmt);
  int offset = dst ? -4 : -5;
  datetime etNow = nowGmt + offset * 3600;
  MqlDateTime et;
  TimeToStruct(etNow, et);
  int daysSinceSunday = et.day_of_week;
  datetime sunday = etNow - daysSinceSunday * 86400;
  MqlDateTime sundayStruct;
  TimeToStruct(sunday, sundayStruct);
  sundayStruct.hour = 19;
  sundayStruct.min = 0;
  sundayStruct.sec = 0;
  datetime sundayEt = StructToTime(sundayStruct);
  bool dstLocal = IsUsdDstLocal(sundayStruct.year, sundayStruct.mon, sundayStruct.day, sundayStruct.hour);
  int localOffset = dstLocal ? -4 : -5;
  return sundayEt - localOffset * 3600;
}

bool IsUsdDstUtc(datetime nowGmt)
{
  MqlDateTime dt;
  TimeToStruct(nowGmt, dt);
  int year = dt.year;
  int startDay = NthSunday(year, 3, 2);
  int endDay = NthSunday(year, 11, 1);

  MqlDateTime start;
  start.year = year; start.mon = 3; start.day = startDay;
  start.hour = 7; start.min = 0; start.sec = 0;
  MqlDateTime end;
  end.year = year; end.mon = 11; end.day = endDay;
  end.hour = 6; end.min = 0; end.sec = 0;
  datetime startUtc = StructToTime(start);
  datetime endUtc = StructToTime(end);
  return (nowGmt >= startUtc && nowGmt < endUtc);
}

bool IsUsdDstLocal(int year, int mon, int day, int hour)
{
  int startDay = NthSunday(year, 3, 2);
  int endDay = NthSunday(year, 11, 1);
  if(mon < 3 || mon > 11) return false;
  if(mon > 3 && mon < 11) return true;
  if(mon == 3)
  {
    if(day > startDay) return true;
    if(day < startDay) return false;
    return hour >= 2;
  }
  if(mon == 11)
  {
    if(day < endDay) return true;
    if(day > endDay) return false;
    return hour < 2;
  }
  return false;
}

int NthSunday(int year, int mon, int nth)
{
  int count = 0;
  for(int day = 1; day <= 31; day++)
  {
    MqlDateTime dt;
    dt.year = year; dt.mon = mon; dt.day = day;
    dt.hour = 0; dt.min = 0; dt.sec = 0;
    datetime t = StructToTime(dt);
    if(t == 0) continue;
    TimeToStruct(t, dt);
    if(dt.day_of_week == 0)
    {
      count++;
      if(count == nth) return day;
    }
  }
  return 1;
}

string JsonEscape(const string value)
{
  string out = value;
  StringReplace(out, "\\", "\\\\");
  StringReplace(out, "\"", "\\\"");
  StringReplace(out, "\r", "\\r");
  StringReplace(out, "\n", "\\n");
  StringReplace(out, "\t", "\\t");
  return out;
}

string BoolToJson(bool value)
{
  return value ? "true" : "false";
}

string FormatIsoUtc(datetime value)
{
  MqlDateTime dt;
  TimeToStruct(value, dt);
  return StringFormat("%04d-%02d-%02dT%02d:%02d:%02dZ",
                      dt.year, dt.mon, dt.day, dt.hour, dt.min, dt.sec);
}
