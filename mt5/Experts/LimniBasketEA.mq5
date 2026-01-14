//+------------------------------------------------------------------+
//|                                                   LimniBasketEA |
//|                                    COT-based weekly basket EA   |
//+------------------------------------------------------------------+
#property strict

#include <Trade/Trade.mqh>

input string ApiUrl = "http://127.0.0.1:3001/api/cot/latest";
input int ApiPollIntervalSeconds = 60;
input int AddIntervalMinutes = 60;
input double BasketLotCapPer100k = 10.0;
input double LotSizePerAdd = 0.01;
input double MaxRiskPercent = 1.0;
input double StopLossPercent = 3.0;
input double TrailingStartPct = 1.5;
input double TrailingStepPct = 0.5;
input int SlippagePoints = 10;
input long MagicNumber = 912401;
input int MaxOrdersPerMinute = 20;
input bool ShowDashboard = true;
input int DashboardCorner = 0;
input int DashboardX = 18;
input int DashboardY = 18;
input int DashboardWidth = 360;
input int DashboardLineHeight = 18;
input int DashboardPadding = 10;
input int DashboardFontSize = 10;
input bool PushAccountStats = true;
input string PushUrl = "http://127.0.0.1:3001/api/mt5/push";
input string PushToken = "";
input int PushIntervalSeconds = 30;
input string AccountLabel = "";

enum EAState
{
  STATE_IDLE = 0,
  STATE_READY = 1,
  STATE_ACTIVE = 2,
  STATE_PAUSED = 3,
  STATE_CLOSED = 4
};

struct SymbolStats
{
  double volume;
  double avg_price;
  int direction;
  datetime last_open;
  bool valid;
};

string g_reportDate = "";
bool g_tradingAllowed = false;
bool g_apiOk = false;

EAState g_state = STATE_IDLE;
datetime g_weekStartGmt = 0;
datetime g_lastPoll = 0;

double g_baselineEquity = 0.0;
double g_lockedProfitPct = 0.0;
double g_lastEquityForSl = 0.0;
bool g_trailingActive = false;
bool g_closeRequested = false;
bool g_forceSlUpdate = false;
double g_weekPeakEquity = 0.0;
double g_maxDrawdownPct = 0.0;

string g_apiSymbols[];
string g_brokerSymbols[];
int g_directions[];
datetime g_lastAddTimes[];

datetime g_orderTimes[];
datetime g_lastPush = 0;

CTrade g_trade;

string GV_WEEK_START = "Limni_WeekStart";
string GV_STATE = "Limni_State";
string GV_BASELINE = "Limni_Baseline";
string GV_LOCKED = "Limni_Locked";
string GV_TRAIL = "Limni_TrailActive";
string GV_CLOSE = "Limni_CloseRequested";
string GV_LAST_EQUITY = "Limni_LastEquity";
string GV_WEEK_PEAK = "Limni_WeekPeak";
string GV_MAX_DD = "Limni_MaxDD";
string CACHE_FILE = "LimniCotCache.json";
string DASH_BG = "LimniDash_bg";
string DASH_SHADOW = "LimniDash_shadow";
string DASH_ACCENT = "LimniDash_accent";
string DASH_DIVIDER = "LimniDash_divider";
string DASH_TITLE = "LimniDash_title";

string g_lastApiError = "";
datetime g_lastApiErrorTime = 0;
string g_dashboardLines[];
bool g_dashboardReady = false;

// Forward declarations
void PollApiIfDue();
bool FetchApi(string &json);
bool ParseApiResponse(const string json, bool &allowed, string &reportDate,
                      string &symbols[], int &dirs[]);
bool ParsePairsArray(const string json, string &symbols[], int &dirs[]);
bool ParsePairsObject(const string json, string &symbols[], int &dirs[]);
bool ExtractStringValue(const string json, const string key, string &value);
bool ExtractBoolValue(const string json, const string key, bool &value);
bool ResolveSymbol(const string apiSymbol, string &resolved);
bool IsTradableForex(const string symbol);
int DirectionFromString(const string value);
string DirectionToString(int dir);
double NormalizeVolume(const string symbol, double volume);
double GetBasketLotCap();
double GetTotalBasketLots();
bool HasOpenPositions();
void UpdateState();
void ManageBasket();
void TryAddPositions();
bool PlaceOrder(const string symbol, int direction, double volume);
bool GetSymbolStats(const string symbol, SymbolStats &stats);
bool CalculateStopLoss(const string symbol, const SymbolStats &stats, double &sl);
bool UpdateSymbolStopLoss(const string symbol, const SymbolStats &stats);
void UpdateStopsIfNeeded();
void CloseAllPositions();
bool ClosePositionByTicket(ulong ticket);
void CloseSymbolPositions(const string symbol);
void MarkOrderTimestamp();
int OrdersInLastMinute();
datetime GetWeekStartGmt(datetime nowGmt);
bool IsUsdDstUtc(datetime nowGmt);
bool IsUsdDstLocal(int year, int mon, int day, int hour);
int NthSunday(int year, int mon, int nth);
void LoadState();
void SaveState();
void LoadApiCache();
void SaveApiCache(const string json);
void SyncLastAddTimes();
void Log(const string message);
string TruncateForLog(const string value, int maxLen);
void InitDashboard();
void UpdateDashboard();
void DestroyDashboard();
void SetLabelText(const string name, const string text, color textColor);
string StateToString(EAState state);
string FormatDuration(int seconds);
string FormatTimeValue(datetime value);
int CountOpenPositions();
int CountOpenPairs();
void UpdateDrawdown();
void GetWeeklyTradeStats(int &tradeCount, double &winRatePct);
void PushStatsIfDue();
bool SendAccountSnapshot();
bool HttpPostJson(const string url, const string payload, string &response);
string BuildAccountPayload();
string BuildPositionsArray();
string JsonEscape(const string value);
string BoolToJson(bool value);
string FormatIsoUtc(datetime value);
string AccountStatusToString();
int GetNextAddSeconds();
int GetNextPollSeconds();

//+------------------------------------------------------------------+
int OnInit()
{
  g_trade.SetExpertMagicNumber(MagicNumber);
  g_trade.SetDeviationInPoints(SlippagePoints);

  g_weekStartGmt = GetWeekStartGmt(TimeGMT());
  LoadState();
  LoadApiCache();
  SyncLastAddTimes();
  InitDashboard();

  EventSetTimer(10);
  Log("EA initialized.");
  return INIT_SUCCEEDED;
}

//+------------------------------------------------------------------+
void OnDeinit(const int reason)
{
  SaveState();
  DestroyDashboard();
  EventKillTimer();
}

//+------------------------------------------------------------------+
void OnTimer()
{
  datetime nowGmt = TimeGMT();
  datetime newWeekStart = GetWeekStartGmt(nowGmt);

  if(newWeekStart != g_weekStartGmt)
  {
    g_weekStartGmt = newWeekStart;
    if(!HasOpenPositions())
    {
      g_state = STATE_IDLE;
      g_baselineEquity = 0.0;
      g_lockedProfitPct = 0.0;
      g_trailingActive = false;
      g_closeRequested = false;
      g_forceSlUpdate = true;
      g_weekPeakEquity = 0.0;
      g_maxDrawdownPct = 0.0;
      SaveState();
      Log("New week detected. State reset to IDLE.");
    }
    else
    {
      Log("New week detected but positions still open. Holding state.");
    }
  }

  PollApiIfDue();
  UpdateState();
  ManageBasket();
  UpdateDrawdown();
  if(g_state == STATE_ACTIVE)
    TryAddPositions();
  UpdateDashboard();
  PushStatsIfDue();
}

//+------------------------------------------------------------------+
void PollApiIfDue()
{
  datetime now = TimeCurrent();
  if(g_lastPoll != 0 && (now - g_lastPoll) < ApiPollIntervalSeconds)
    return;

  g_lastPoll = now;
  string json = "";
  if(!FetchApi(json))
  {
    g_apiOk = false;
    g_lastApiError = "fetch failed";
    g_lastApiErrorTime = TimeCurrent();
    Log("API fetch failed. Pausing new entries.");
    return;
  }

  bool allowed = false;
  string reportDate = "";
  string symbols[];
  int dirs[];
  if(!ParseApiResponse(json, allowed, reportDate, symbols, dirs))
  {
    g_apiOk = false;
    g_lastApiError = "parse failed";
    g_lastApiErrorTime = TimeCurrent();
    int len = StringLen(json);
    string preview = TruncateForLog(json, 300);
    Log(StringFormat("API parse failed. len=%d preview=%s", len, preview));
    return;
  }

  SaveApiCache(json);
  g_apiOk = true;
  g_tradingAllowed = allowed;
  g_reportDate = reportDate;
  g_lastApiError = "";
  g_lastApiErrorTime = 0;

  int count = ArraySize(symbols);
  ArrayResize(g_apiSymbols, 0);
  ArrayResize(g_brokerSymbols, 0);
  ArrayResize(g_directions, 0);
  ArrayResize(g_lastAddTimes, 0);

  for(int i = 0; i < count; i++)
  {
    string resolved = "";
    if(!ResolveSymbol(symbols[i], resolved))
    {
      Log(StringFormat("Symbol %s not tradable or not found. Skipped.", symbols[i]));
      continue;
    }

    int idx = ArraySize(g_apiSymbols);
    ArrayResize(g_apiSymbols, idx + 1);
    ArrayResize(g_brokerSymbols, idx + 1);
    ArrayResize(g_directions, idx + 1);
    ArrayResize(g_lastAddTimes, idx + 1);
    g_apiSymbols[idx] = symbols[i];
    g_brokerSymbols[idx] = resolved;
    g_directions[idx] = dirs[i];
    g_lastAddTimes[idx] = 0;
  }

  SyncLastAddTimes();

  Log(StringFormat("API ok. trading_allowed=%s, report_date=%s, pairs=%d",
                   g_tradingAllowed ? "true" : "false",
                   g_reportDate,
                   ArraySize(g_apiSymbols)));
}
//+------------------------------------------------------------------+
bool FetchApi(string &json)
{
  uchar result[];
  uchar data[];
  string headers;
  ResetLastError();
  int timeout = 8000;
  string request_headers = "Accept: application/json\r\n"
                           "Accept-Encoding: identity\r\n"
                           "Connection: close\r\n";
  int status = WebRequest("GET", ApiUrl, request_headers, timeout, data, result, headers);
  if(status == -1)
  {
    int err = GetLastError();
    Log(StringFormat("WebRequest failed: %d", err));
    return false;
  }

  if(status != 200)
  {
    Log(StringFormat("API HTTP status %d", status));
    return false;
  }

  int size = ArraySize(result);
  if(size <= 0)
    return false;
  json = CharArrayToString(result, 0, size);
  if(StringLen(json) < 500)
    Log(StringFormat("API response small: res=%d headers=%s",
                     size, TruncateForLog(headers, 200)));
  return (StringLen(json) > 0);
}

//+------------------------------------------------------------------+
bool ParseApiResponse(const string json, bool &allowed, string &reportDate,
                      string &symbols[], int &dirs[])
{
  allowed = false;
  reportDate = "";
  ArrayResize(symbols, 0);
  ArrayResize(dirs, 0);

  if(!ExtractBoolValue(json, "trading_allowed", allowed))
    return false;
  ExtractStringValue(json, "report_date", reportDate);

  if(!ParsePairsArray(json, symbols, dirs))
  {
    if(!ParsePairsObject(json, symbols, dirs))
      return false;
  }

  return (ArraySize(symbols) > 0);
}

//+------------------------------------------------------------------+
bool ParsePairsArray(const string json, string &symbols[], int &dirs[])
{
  int keyPos = StringFind(json, "\"pairs\"");
  if(keyPos < 0)
    return false;
  int arrayPos = StringFind(json, "[", keyPos);
  if(arrayPos < 0)
    return false;

  int depth = 0;
  int endPos = -1;
  for(int i = arrayPos; i < StringLen(json); i++)
  {
    string ch = StringSubstr(json, i, 1);
    if(ch == "[")
      depth++;
    if(ch == "]")
    {
      depth--;
      if(depth == 0)
      {
        endPos = i;
        break;
      }
    }
  }
  if(endPos < 0)
    return false;

  string arrayBody = StringSubstr(json, arrayPos + 1, endPos - arrayPos - 1);
  int scan = 0;
  while(true)
  {
    int objStart = StringFind(arrayBody, "{", scan);
    if(objStart < 0)
      break;
    int objDepth = 0;
    int objEnd = -1;
    for(int i = objStart; i < StringLen(arrayBody); i++)
    {
      string ch = StringSubstr(arrayBody, i, 1);
      if(ch == "{")
        objDepth++;
      if(ch == "}")
      {
        objDepth--;
        if(objDepth == 0)
        {
          objEnd = i;
          break;
        }
      }
    }
    if(objEnd < 0)
      break;

    string obj = StringSubstr(arrayBody, objStart, objEnd - objStart + 1);
    string symbol = "";
    string direction = "";
    if(ExtractStringValue(obj, "symbol", symbol) &&
       ExtractStringValue(obj, "direction", direction))
    {
      int dir = DirectionFromString(direction);
      if(dir != 0)
      {
        int size = ArraySize(symbols);
        ArrayResize(symbols, size + 1);
        ArrayResize(dirs, size + 1);
        symbols[size] = symbol;
        dirs[size] = dir;
      }
    }

    scan = objEnd + 1;
  }

  return (ArraySize(symbols) > 0);
}

//+------------------------------------------------------------------+
bool ParsePairsObject(const string json, string &symbols[], int &dirs[])
{
  int keyPos = StringFind(json, "\"pairs\"");
  if(keyPos < 0)
    return false;
  int objPos = StringFind(json, "{", keyPos);
  if(objPos < 0)
    return false;

  int depth = 0;
  int endPos = -1;
  for(int i = objPos; i < StringLen(json); i++)
  {
    string ch = StringSubstr(json, i, 1);
    if(ch == "{")
      depth++;
    if(ch == "}")
    {
      depth--;
      if(depth == 0)
      {
        endPos = i;
        break;
      }
    }
  }
  if(endPos < 0)
    return false;

  string body = StringSubstr(json, objPos + 1, endPos - objPos - 1);
  int scan = 0;
  while(true)
  {
    int keyStart = StringFind(body, "\"", scan);
    if(keyStart < 0)
      break;
    int keyEnd = StringFind(body, "\"", keyStart + 1);
    if(keyEnd < 0)
      break;
    string key = StringSubstr(body, keyStart + 1, keyEnd - keyStart - 1);
    int colon = StringFind(body, ":", keyEnd);
    if(colon < 0)
      break;
    int nestedStart = StringFind(body, "{", colon);
    if(nestedStart < 0)
      break;
    int nestedDepth = 0;
    int nestedEnd = -1;
    for(int i = nestedStart; i < StringLen(body); i++)
    {
      string ch = StringSubstr(body, i, 1);
      if(ch == "{")
        nestedDepth++;
      if(ch == "}")
      {
        nestedDepth--;
        if(nestedDepth == 0)
        {
          nestedEnd = i;
          break;
        }
      }
    }
    if(nestedEnd < 0)
      break;

    string nested = StringSubstr(body, nestedStart, nestedEnd - nestedStart + 1);
    string direction = "";
    if(ExtractStringValue(nested, "direction", direction))
    {
      int dir = DirectionFromString(direction);
      if(dir != 0)
      {
        int size = ArraySize(symbols);
        ArrayResize(symbols, size + 1);
        ArrayResize(dirs, size + 1);
        symbols[size] = key;
        dirs[size] = dir;
      }
    }

    scan = nestedEnd + 1;
  }

  return (ArraySize(symbols) > 0);
}

//+------------------------------------------------------------------+
bool ExtractStringValue(const string json, const string key, string &value)
{
  int pos = StringFind(json, "\"" + key + "\"");
  if(pos < 0)
    return false;
  int colon = StringFind(json, ":", pos);
  if(colon < 0)
    return false;
  int start = StringFind(json, "\"", colon + 1);
  if(start < 0)
    return false;
  int end = StringFind(json, "\"", start + 1);
  if(end < 0)
    return false;
  value = StringSubstr(json, start + 1, end - start - 1);
  return true;
}

//+------------------------------------------------------------------+
bool ExtractBoolValue(const string json, const string key, bool &value)
{
  int pos = StringFind(json, "\"" + key + "\"");
  if(pos < 0)
    return false;
  int colon = StringFind(json, ":", pos);
  if(colon < 0)
    return false;
  int start = colon + 1;
  while(start < StringLen(json))
  {
    string ch = StringSubstr(json, start, 1);
    if(ch != " " && ch != "\n" && ch != "\r" && ch != "\t")
      break;
    start++;
  }
  string tail = StringSubstr(json, start, 5);
  if(StringFind(tail, "true") == 0)
  {
    value = true;
    return true;
  }
  if(StringFind(tail, "false") == 0)
  {
    value = false;
    return true;
  }
  return false;
}

//+------------------------------------------------------------------+
int DirectionFromString(const string value)
{
  string upper = value;
  StringToUpper(upper);
  if(upper == "LONG")
    return 1;
  if(upper == "SHORT")
    return -1;
  return 0;
}

string DirectionToString(int dir)
{
  return dir > 0 ? "LONG" : "SHORT";
}

//+------------------------------------------------------------------+
bool ResolveSymbol(const string apiSymbol, string &resolved)
{
  string target = apiSymbol;
  StringToUpper(target);
  if(SymbolSelect(target, true) && IsTradableForex(target))
  {
    resolved = target;
    return true;
  }

  int total = SymbolsTotal(true);
  for(int i = 0; i < total; i++)
  {
    string sym = SymbolName(i, true);
    string symUpper = sym;
    StringToUpper(symUpper);
    if(StringFind(symUpper, target) < 0)
      continue;
    if(!IsTradableForex(sym))
      continue;
    string base = SymbolInfoString(sym, SYMBOL_CURRENCY_BASE);
    string quote = SymbolInfoString(sym, SYMBOL_CURRENCY_PROFIT);
    if(base == StringSubstr(target, 0, 3) && quote == StringSubstr(target, 3, 3))
    {
      resolved = sym;
      return true;
    }
  }

  total = SymbolsTotal(false);
  for(int i = 0; i < total; i++)
  {
    string sym = SymbolName(i, false);
    string symUpper = sym;
    StringToUpper(symUpper);
    if(StringFind(symUpper, target) < 0)
      continue;
    if(!SymbolSelect(sym, true))
      continue;
    if(!IsTradableForex(sym))
      continue;
    string base = SymbolInfoString(sym, SYMBOL_CURRENCY_BASE);
    string quote = SymbolInfoString(sym, SYMBOL_CURRENCY_PROFIT);
    if(base == StringSubstr(target, 0, 3) && quote == StringSubstr(target, 3, 3))
    {
      resolved = sym;
      return true;
    }
  }

  return false;
}

//+------------------------------------------------------------------+
bool IsTradableForex(const string symbol)
{
  if((int)SymbolInfoInteger(symbol, SYMBOL_TRADE_MODE) != SYMBOL_TRADE_MODE_FULL)
    return false;
  int calcMode = (int)SymbolInfoInteger(symbol, SYMBOL_TRADE_CALC_MODE);
  if(calcMode != SYMBOL_CALC_MODE_FOREX && calcMode != SYMBOL_CALC_MODE_FOREX_NO_LEVERAGE)
    return false;
  return true;
}
//+------------------------------------------------------------------+
double NormalizeVolume(const string symbol, double volume)
{
  double minVol = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MIN);
  double maxVol = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MAX);
  double step = SymbolInfoDouble(symbol, SYMBOL_VOLUME_STEP);
  if(volume < minVol)
    return 0.0;
  if(volume > maxVol)
    volume = maxVol;

  double steps = MathFloor(volume / step + 1e-9);
  double normalized = steps * step;
  int digits = (int)MathRound(-MathLog10(step));
  return NormalizeDouble(normalized, digits);
}

//+------------------------------------------------------------------+
double GetBasketLotCap()
{
  double equity = AccountInfoDouble(ACCOUNT_EQUITY);
  return BasketLotCapPer100k * (equity / 100000.0);
}

double GetTotalBasketLots()
{
  double total = 0.0;
  int count = PositionsTotal();
  for(int i = 0; i < count; i++)
  {
    ulong ticket = PositionGetTicket(i);
    if(ticket == 0)
      continue;
    if(!PositionSelectByTicket(ticket))
      continue;
    if((long)PositionGetInteger(POSITION_MAGIC) != MagicNumber)
      continue;
    total += PositionGetDouble(POSITION_VOLUME);
  }
  return total;
}

bool HasOpenPositions()
{
  int count = PositionsTotal();
  for(int i = 0; i < count; i++)
  {
    ulong ticket = PositionGetTicket(i);
    if(ticket == 0)
      continue;
    if(!PositionSelectByTicket(ticket))
      continue;
    if((long)PositionGetInteger(POSITION_MAGIC) != MagicNumber)
      continue;
    return true;
  }
  return false;
}

//+------------------------------------------------------------------+
void UpdateState()
{
  datetime nowGmt = TimeGMT();
  bool afterStart = (nowGmt >= g_weekStartGmt);
  bool hasPositions = HasOpenPositions();

  if(!afterStart && !hasPositions && g_state != STATE_IDLE)
  {
    g_state = STATE_IDLE;
    Log("State -> IDLE (before Sunday open).");
  }

  if(afterStart && g_state == STATE_IDLE && !hasPositions)
  {
    g_state = STATE_READY;
    Log("State -> READY (Sunday open reached).");
  }

  if(g_state == STATE_READY)
  {
    if(g_apiOk && g_tradingAllowed)
    {
      g_state = STATE_ACTIVE;
      g_baselineEquity = AccountInfoDouble(ACCOUNT_EQUITY);
      g_lockedProfitPct = 0.0;
      g_trailingActive = false;
      g_closeRequested = false;
      g_lastEquityForSl = g_baselineEquity;
      g_forceSlUpdate = true;
      SaveState();
      Log("State -> ACTIVE (API allows trading).");
    }
  }

  if(g_state == STATE_ACTIVE)
  {
    if(!g_apiOk || !g_tradingAllowed)
    {
      g_state = STATE_PAUSED;
      Log("State -> PAUSED (API failure or trading not allowed).");
    }
  }

  if(g_state == STATE_PAUSED)
  {
    if(g_apiOk && g_tradingAllowed)
    {
      g_state = STATE_ACTIVE;
      Log("State -> ACTIVE (API recovered).");
    }
  }

  if(g_state == STATE_CLOSED && !afterStart)
  {
    g_state = STATE_IDLE;
    Log("State -> IDLE (new week not started).");
  }
}

//+------------------------------------------------------------------+
void ManageBasket()
{
  if(!HasOpenPositions())
  {
    if(g_closeRequested)
    {
      g_closeRequested = false;
      g_lockedProfitPct = 0.0;
      g_trailingActive = false;
      g_baselineEquity = 0.0;
      g_state = STATE_CLOSED;
      SaveState();
      Log("All positions closed. State -> CLOSED.");
    }
    return;
  }

  double equity = AccountInfoDouble(ACCOUNT_EQUITY);
  if(g_baselineEquity <= 0.0)
    g_baselineEquity = equity;

  double profitPct = (equity - g_baselineEquity) / g_baselineEquity * 100.0;
  bool wasTrailing = g_trailingActive;

  if(profitPct >= TrailingStartPct)
  {
    g_trailingActive = true;
    if(!wasTrailing)
      Log(StringFormat("Trailing activated at %.2f%%", profitPct));
    double steps = MathFloor((profitPct - TrailingStartPct) / TrailingStepPct);
    double lockStart = TrailingStartPct - TrailingStepPct;
    double newLocked = lockStart + steps * TrailingStepPct;
    if(newLocked > g_lockedProfitPct)
    {
      g_lockedProfitPct = newLocked;
      SaveState();
      Log(StringFormat("Trailing lock updated: %.2f%%", g_lockedProfitPct));
    }
  }

  if(g_trailingActive && g_lockedProfitPct > 0.0 && profitPct <= g_lockedProfitPct)
  {
    g_closeRequested = true;
    SaveState();
    Log(StringFormat("Basket hit lock %.2f%%. Closing all positions.", g_lockedProfitPct));
    CloseAllPositions();
  }

  UpdateStopsIfNeeded();
}
//+------------------------------------------------------------------+
void TryAddPositions()
{
  if(!g_apiOk || !g_tradingAllowed)
    return;

  double cap = GetBasketLotCap();
  double totalLots = GetTotalBasketLots();
  datetime now = TimeCurrent();

  for(int i = 0; i < ArraySize(g_brokerSymbols); i++)
  {
    string symbol = g_brokerSymbols[i];
    int direction = g_directions[i];
    if(symbol == "" || direction == 0)
      continue;

    if(totalLots + LotSizePerAdd > cap)
      return;

    datetime lastAdd = g_lastAddTimes[i];
    if(lastAdd > 0 && (now - lastAdd) < AddIntervalMinutes * 60)
      continue;

    if(OrdersInLastMinute() >= MaxOrdersPerMinute)
    {
      Log("Order rate limit reached. Skipping adds.");
      return;
    }

    double vol = NormalizeVolume(symbol, LotSizePerAdd);
    if(vol <= 0.0)
    {
      Log(StringFormat("Volume %.2f not valid for %s", LotSizePerAdd, symbol));
      continue;
    }

    if(!PlaceOrder(symbol, direction, vol))
      continue;

    totalLots += vol;
    g_lastAddTimes[i] = now;
    GlobalVariableSet("Limni_LastAdd_" + symbol, (double)now);
    MarkOrderTimestamp();
    g_forceSlUpdate = true;
  }
}

//+------------------------------------------------------------------+
bool PlaceOrder(const string symbol, int direction, double volume)
{
  SymbolStats stats;
  bool hasStats = GetSymbolStats(symbol, stats);
  if(hasStats && stats.valid && stats.direction != direction)
  {
    Log(StringFormat("Mixed directions on %s. Skipping add.", symbol));
    return false;
  }

  double price = direction > 0 ? SymbolInfoDouble(symbol, SYMBOL_ASK)
                               : SymbolInfoDouble(symbol, SYMBOL_BID);

  SymbolStats entryStats;
  entryStats.avg_price = price;
  entryStats.direction = direction;
  entryStats.valid = true;

  double sl = 0.0;
  if(!CalculateStopLoss(symbol, entryStats, sl))
  {
    Log(StringFormat("Cannot set SL within risk for %s. Order skipped.", symbol));
    return false;
  }

  string comment = "LimniBasket " + g_reportDate;
  bool result = false;
  if(direction > 0)
    result = g_trade.Buy(volume, symbol, price, sl, 0.0, comment);
  else
    result = g_trade.Sell(volume, symbol, price, sl, 0.0, comment);

  if(!result)
  {
    Log(StringFormat("Order failed %s %s vol=%.2f. Error=%d",
                     symbol, DirectionToString(direction), volume, GetLastError()));
    return false;
  }

  Log(StringFormat("Order placed %s %s vol=%.2f", symbol, DirectionToString(direction), volume));
  SymbolStats actual;
  if(GetSymbolStats(symbol, actual))
    UpdateSymbolStopLoss(symbol, actual);
  else
    UpdateSymbolStopLoss(symbol, entryStats);
  return true;
}
//+------------------------------------------------------------------+
bool GetSymbolStats(const string symbol, SymbolStats &stats)
{
  stats.volume = 0.0;
  stats.avg_price = 0.0;
  stats.direction = 0;
  stats.last_open = 0;
  stats.valid = false;

  int count = PositionsTotal();
  for(int i = 0; i < count; i++)
  {
    ulong ticket = PositionGetTicket(i);
    if(ticket == 0)
      continue;
    if(!PositionSelectByTicket(ticket))
      continue;
    if((long)PositionGetInteger(POSITION_MAGIC) != MagicNumber)
      continue;
    if(PositionGetString(POSITION_SYMBOL) != symbol)
      continue;

    int type = (int)PositionGetInteger(POSITION_TYPE);
    int dir = (type == POSITION_TYPE_BUY) ? 1 : -1;
    if(stats.direction != 0 && stats.direction != dir)
    {
      stats.valid = false;
      return false;
    }

    double vol = PositionGetDouble(POSITION_VOLUME);
    double price = PositionGetDouble(POSITION_PRICE_OPEN);
    double totalVol = stats.volume + vol;
    stats.avg_price = (stats.avg_price * stats.volume + price * vol) / totalVol;
    stats.volume = totalVol;
    stats.direction = dir;
    datetime openTime = (datetime)PositionGetInteger(POSITION_TIME);
    if(openTime > stats.last_open)
      stats.last_open = openTime;
  }

  stats.valid = (stats.volume > 0.0);
  return stats.valid;
}

//+------------------------------------------------------------------+
bool CalculateStopLoss(const string symbol, const SymbolStats &stats, double &sl)
{
  sl = 0.0;
  if(!stats.valid || stats.direction == 0)
    return false;

  int digits = (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);
  double point = SymbolInfoDouble(symbol, SYMBOL_POINT);
  double bid = SymbolInfoDouble(symbol, SYMBOL_BID);
  double ask = SymbolInfoDouble(symbol, SYMBOL_ASK);
  if(stats.avg_price <= 0.0)
    return false;

  // Simple percentage-based stop loss
  double stopPct = StopLossPercent / 100.0;
  if(stopPct <= 0.0 || stopPct >= 1.0)
    return false;

  sl = stats.direction > 0 ? stats.avg_price * (1.0 - stopPct)
                           : stats.avg_price * (1.0 + stopPct);
  if(stats.direction > 0 && sl <= 0.0)
    sl = point;
  sl = NormalizeDouble(sl, digits);

  double minStop = SymbolInfoInteger(symbol, SYMBOL_TRADE_STOPS_LEVEL) * point;
  if(minStop > 0.0)
  {
    if(stats.direction > 0 && (bid - sl) < minStop)
      return false;
    if(stats.direction < 0 && (sl - ask) < minStop)
      return false;
  }

  return true;
}

//+------------------------------------------------------------------+
bool UpdateSymbolStopLoss(const string symbol, const SymbolStats &stats)
{
  double point = SymbolInfoDouble(symbol, SYMBOL_POINT);
  int count = PositionsTotal();
  for(int i = 0; i < count; i++)
  {
    ulong ticket = PositionGetTicket(i);
    if(ticket == 0)
      continue;
    if(!PositionSelectByTicket(ticket))
      continue;
    if((long)PositionGetInteger(POSITION_MAGIC) != MagicNumber)
      continue;
    if(PositionGetString(POSITION_SYMBOL) != symbol)
      continue;
    int type = (int)PositionGetInteger(POSITION_TYPE);
    int dir = (type == POSITION_TYPE_BUY) ? 1 : -1;
    double entry = PositionGetDouble(POSITION_PRICE_OPEN);

    SymbolStats entryStats;
    entryStats.avg_price = entry;
    entryStats.direction = dir;
    entryStats.valid = true;

    double sl = 0.0;
    if(!CalculateStopLoss(symbol, entryStats, sl))
      return false;
    double currentSl = PositionGetDouble(POSITION_SL);
    if(MathAbs(currentSl - sl) < point * 0.5)
      continue;

    MqlTradeRequest req;
    MqlTradeResult res;
    ZeroMemory(req);
    ZeroMemory(res);
    req.action = TRADE_ACTION_SLTP;
    req.position = ticket;
    req.symbol = symbol;
    req.sl = sl;
    req.tp = 0.0;
    if(!OrderSend(req, res))
    {
      Log(StringFormat("SL update failed %s ticket=%llu err=%d",
                       symbol, ticket, GetLastError()));
    }
  }

  return true;
}

//+------------------------------------------------------------------+
void UpdateStopsIfNeeded()
{
  if(!HasOpenPositions())
    return;

  double equity = AccountInfoDouble(ACCOUNT_EQUITY);
  bool equityChanged = false;
  if(g_lastEquityForSl <= 0.0)
    equityChanged = true;
  else
  {
    double diffPct = MathAbs(equity - g_lastEquityForSl) / g_lastEquityForSl * 100.0;
    if(diffPct >= 0.1)
      equityChanged = true;
  }

  if(!equityChanged && !g_forceSlUpdate)
    return;

  for(int i = 0; i < ArraySize(g_brokerSymbols); i++)
  {
    string symbol = g_brokerSymbols[i];
    SymbolStats stats;
    if(GetSymbolStats(symbol, stats))
    {
      if(!UpdateSymbolStopLoss(symbol, stats))
      {
        Log(StringFormat("Risk SL not possible for %s. Closing symbol positions.", symbol));
        CloseSymbolPositions(symbol);
      }
    }
  }

  g_lastEquityForSl = equity;
  g_forceSlUpdate = false;
  SaveState();
  Log("Stop losses recalculated.");
}
//+------------------------------------------------------------------+
void CloseAllPositions()
{
  int count = PositionsTotal();
  for(int i = count - 1; i >= 0; i--)
  {
    ulong ticket = PositionGetTicket(i);
    if(ticket == 0)
      continue;
    if(!PositionSelectByTicket(ticket))
      continue;
    if((long)PositionGetInteger(POSITION_MAGIC) != MagicNumber)
      continue;
    ClosePositionByTicket(ticket);
  }
}

void CloseSymbolPositions(const string symbol)
{
  int count = PositionsTotal();
  for(int i = count - 1; i >= 0; i--)
  {
    ulong ticket = PositionGetTicket(i);
    if(ticket == 0)
      continue;
    if(!PositionSelectByTicket(ticket))
      continue;
    if((long)PositionGetInteger(POSITION_MAGIC) != MagicNumber)
      continue;
    if(PositionGetString(POSITION_SYMBOL) != symbol)
      continue;
    ClosePositionByTicket(ticket);
  }
}

bool ClosePositionByTicket(ulong ticket)
{
  if(!PositionSelectByTicket(ticket))
    return false;

  string symbol = PositionGetString(POSITION_SYMBOL);
  double volume = PositionGetDouble(POSITION_VOLUME);
  int type = (int)PositionGetInteger(POSITION_TYPE);
  double price = (type == POSITION_TYPE_BUY) ? SymbolInfoDouble(symbol, SYMBOL_BID)
                                             : SymbolInfoDouble(symbol, SYMBOL_ASK);

  MqlTradeRequest req;
  MqlTradeResult res;
  ZeroMemory(req);
  ZeroMemory(res);
  req.action = TRADE_ACTION_DEAL;
  req.position = ticket;
  req.symbol = symbol;
  req.volume = volume;
  req.magic = MagicNumber;
  req.deviation = SlippagePoints;
  req.type = (type == POSITION_TYPE_BUY) ? ORDER_TYPE_SELL : ORDER_TYPE_BUY;
  req.price = price;
  req.comment = "LimniClose";

  if(!OrderSend(req, res))
  {
    Log(StringFormat("Close failed %s ticket=%llu err=%d", symbol, ticket, GetLastError()));
    return false;
  }

  return true;
}

//+------------------------------------------------------------------+
void MarkOrderTimestamp()
{
  int size = ArraySize(g_orderTimes);
  ArrayResize(g_orderTimes, size + 1);
  g_orderTimes[size] = TimeCurrent();
}

int OrdersInLastMinute()
{
  datetime now = TimeCurrent();
  int count = 0;
  for(int i = ArraySize(g_orderTimes) - 1; i >= 0; i--)
  {
    if(now - g_orderTimes[i] <= 60)
      count++;
  }
  return count;
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
  MqlDateTime sundayStruct;
  TimeToStruct(sunday, sundayStruct);
  sundayStruct.hour = 19;
  sundayStruct.min = 0;
  sundayStruct.sec = 0;
  datetime sundayEt = StructToTime(sundayStruct);

  bool dstLocal = IsUsdDstLocal(sundayStruct.year, sundayStruct.mon,
                                sundayStruct.day, sundayStruct.hour);
  int localOffset = dstLocal ? -4 : -5;
  datetime sundayUtc = sundayEt - localOffset * 3600;
  return sundayUtc;
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
  return (nowGmt >= startUtc && nowGmt < endUtc);
}

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
    return (hour >= 2);
  }
  if(mon == 11)
  {
    if(day < endDay)
      return true;
    if(day > endDay)
      return false;
    return (hour < 2);
  }
  return false;
}

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
void LoadState()
{
  if(GlobalVariableCheck(GV_WEEK_START))
  {
    datetime storedWeek = (datetime)GlobalVariableGet(GV_WEEK_START);
    if(storedWeek == g_weekStartGmt)
    {
      g_state = (EAState)(int)GlobalVariableGet(GV_STATE);
      g_baselineEquity = GlobalVariableGet(GV_BASELINE);
      g_lockedProfitPct = GlobalVariableGet(GV_LOCKED);
      g_trailingActive = (GlobalVariableGet(GV_TRAIL) > 0.5);
      g_closeRequested = (GlobalVariableGet(GV_CLOSE) > 0.5);
      g_lastEquityForSl = GlobalVariableGet(GV_LAST_EQUITY);
      if(GlobalVariableCheck(GV_WEEK_PEAK))
        g_weekPeakEquity = GlobalVariableGet(GV_WEEK_PEAK);
      if(GlobalVariableCheck(GV_MAX_DD))
        g_maxDrawdownPct = GlobalVariableGet(GV_MAX_DD);
      return;
    }
  }

  g_state = STATE_IDLE;
  g_baselineEquity = 0.0;
  g_lockedProfitPct = 0.0;
  g_trailingActive = false;
  g_closeRequested = false;
  g_lastEquityForSl = 0.0;
  g_weekPeakEquity = 0.0;
  g_maxDrawdownPct = 0.0;
}

void SaveState()
{
  GlobalVariableSet(GV_WEEK_START, (double)g_weekStartGmt);
  GlobalVariableSet(GV_STATE, (double)g_state);
  GlobalVariableSet(GV_BASELINE, g_baselineEquity);
  GlobalVariableSet(GV_LOCKED, g_lockedProfitPct);
  GlobalVariableSet(GV_TRAIL, g_trailingActive ? 1.0 : 0.0);
  GlobalVariableSet(GV_CLOSE, g_closeRequested ? 1.0 : 0.0);
  GlobalVariableSet(GV_LAST_EQUITY, g_lastEquityForSl);
  GlobalVariableSet(GV_WEEK_PEAK, g_weekPeakEquity);
  GlobalVariableSet(GV_MAX_DD, g_maxDrawdownPct);
}

void LoadApiCache()
{
  int handle = FileOpen(CACHE_FILE, FILE_READ | FILE_TXT | FILE_COMMON);
  if(handle == INVALID_HANDLE)
    return;
  string json = FileReadString(handle);
  FileClose(handle);
  if(StringLen(json) == 0)
    return;

  bool allowed = false;
  string reportDate = "";
  string symbols[];
  int dirs[];
  if(ParseApiResponse(json, allowed, reportDate, symbols, dirs))
  {
    g_apiOk = true;
    g_tradingAllowed = allowed;
    g_reportDate = reportDate;
    int count = ArraySize(symbols);
    ArrayResize(g_apiSymbols, count);
    ArrayResize(g_directions, count);
    ArrayResize(g_brokerSymbols, count);
    ArrayResize(g_lastAddTimes, count);
    for(int i = 0; i < count; i++)
    {
      string resolved = "";
      g_apiSymbols[i] = symbols[i];
      g_directions[i] = dirs[i];
      if(ResolveSymbol(symbols[i], resolved))
        g_brokerSymbols[i] = resolved;
      g_lastAddTimes[i] = 0;
    }
    Log("Loaded cached API response.");
  }
}

void SaveApiCache(const string json)
{
  int handle = FileOpen(CACHE_FILE, FILE_WRITE | FILE_TXT | FILE_COMMON);
  if(handle == INVALID_HANDLE)
    return;
  FileWriteString(handle, json);
  FileClose(handle);
}

void SyncLastAddTimes()
{
  for(int i = 0; i < ArraySize(g_brokerSymbols); i++)
  {
    string symbol = g_brokerSymbols[i];
    datetime stored = 0;
    string key = "Limni_LastAdd_" + symbol;
    if(GlobalVariableCheck(key))
      stored = (datetime)GlobalVariableGet(key);

    SymbolStats stats;
    datetime latestOpen = 0;
    if(GetSymbolStats(symbol, stats))
      latestOpen = stats.last_open;

    if(latestOpen > stored)
      stored = latestOpen;

    g_lastAddTimes[i] = stored;
  }
}

void Log(const string message)
{
  Print(TimeToString(TimeCurrent(), TIME_DATE | TIME_SECONDS), " | ", message);
}

string TruncateForLog(const string value, int maxLen)
{
  if(StringLen(value) <= maxLen)
    return value;
  return StringSubstr(value, 0, maxLen) + "...";
}

//+------------------------------------------------------------------+
void InitDashboard()
{
  if(!ShowDashboard)
    return;

  const int lineCount = 10;
  ArrayResize(g_dashboardLines, lineCount);
  for(int i = 0; i < lineCount; i++)
    g_dashboardLines[i] = StringFormat("LimniDash_line_%d", i);

  int headerHeight = DashboardLineHeight + 10;
  int height = DashboardPadding * 2 + headerHeight + lineCount * DashboardLineHeight;
  int accentWidth = 5;
  int contentX = DashboardX + DashboardPadding + accentWidth;
  int contentWidth = DashboardWidth - (DashboardPadding * 2) - accentWidth;

  if(ObjectFind(0, DASH_SHADOW) < 0)
  {
    ObjectCreate(0, DASH_SHADOW, OBJ_RECTANGLE_LABEL, 0, 0, 0);
    ObjectSetInteger(0, DASH_SHADOW, OBJPROP_CORNER, DashboardCorner);
    ObjectSetInteger(0, DASH_SHADOW, OBJPROP_XDISTANCE, DashboardX + 4);
    ObjectSetInteger(0, DASH_SHADOW, OBJPROP_YDISTANCE, DashboardY + 4);
    ObjectSetInteger(0, DASH_SHADOW, OBJPROP_XSIZE, DashboardWidth);
    ObjectSetInteger(0, DASH_SHADOW, OBJPROP_YSIZE, height);
    ObjectSetInteger(0, DASH_SHADOW, OBJPROP_COLOR, C'203,213,225');
    ObjectSetInteger(0, DASH_SHADOW, OBJPROP_BGCOLOR, C'203,213,225');
    ObjectSetInteger(0, DASH_SHADOW, OBJPROP_BORDER_TYPE, BORDER_FLAT);
    ObjectSetInteger(0, DASH_SHADOW, OBJPROP_BACK, true);
    ObjectSetInteger(0, DASH_SHADOW, OBJPROP_SELECTABLE, false);
    ObjectSetInteger(0, DASH_SHADOW, OBJPROP_HIDDEN, true);
  }

  if(ObjectFind(0, DASH_BG) < 0)
  {
    ObjectCreate(0, DASH_BG, OBJ_RECTANGLE_LABEL, 0, 0, 0);
    ObjectSetInteger(0, DASH_BG, OBJPROP_CORNER, DashboardCorner);
    ObjectSetInteger(0, DASH_BG, OBJPROP_XDISTANCE, DashboardX);
    ObjectSetInteger(0, DASH_BG, OBJPROP_YDISTANCE, DashboardY);
    ObjectSetInteger(0, DASH_BG, OBJPROP_XSIZE, DashboardWidth);
    ObjectSetInteger(0, DASH_BG, OBJPROP_YSIZE, height);
    ObjectSetInteger(0, DASH_BG, OBJPROP_COLOR, C'226,232,240');
    ObjectSetInteger(0, DASH_BG, OBJPROP_BGCOLOR, C'255,255,255');
    ObjectSetInteger(0, DASH_BG, OBJPROP_BORDER_TYPE, BORDER_FLAT);
    ObjectSetInteger(0, DASH_BG, OBJPROP_BACK, true);
    ObjectSetInteger(0, DASH_BG, OBJPROP_SELECTABLE, false);
    ObjectSetInteger(0, DASH_BG, OBJPROP_HIDDEN, true);
  }

  if(ObjectFind(0, DASH_ACCENT) < 0)
  {
    ObjectCreate(0, DASH_ACCENT, OBJ_RECTANGLE_LABEL, 0, 0, 0);
    ObjectSetInteger(0, DASH_ACCENT, OBJPROP_CORNER, DashboardCorner);
    ObjectSetInteger(0, DASH_ACCENT, OBJPROP_XDISTANCE, DashboardX);
    ObjectSetInteger(0, DASH_ACCENT, OBJPROP_YDISTANCE, DashboardY);
    ObjectSetInteger(0, DASH_ACCENT, OBJPROP_XSIZE, accentWidth);
    ObjectSetInteger(0, DASH_ACCENT, OBJPROP_YSIZE, height);
    ObjectSetInteger(0, DASH_ACCENT, OBJPROP_COLOR, C'20,184,166');
    ObjectSetInteger(0, DASH_ACCENT, OBJPROP_BGCOLOR, C'20,184,166');
    ObjectSetInteger(0, DASH_ACCENT, OBJPROP_BORDER_TYPE, BORDER_FLAT);
    ObjectSetInteger(0, DASH_ACCENT, OBJPROP_BACK, false);
    ObjectSetInteger(0, DASH_ACCENT, OBJPROP_SELECTABLE, false);
    ObjectSetInteger(0, DASH_ACCENT, OBJPROP_HIDDEN, true);
  }

  if(ObjectFind(0, DASH_DIVIDER) < 0)
  {
    ObjectCreate(0, DASH_DIVIDER, OBJ_RECTANGLE_LABEL, 0, 0, 0);
    ObjectSetInteger(0, DASH_DIVIDER, OBJPROP_CORNER, DashboardCorner);
    ObjectSetInteger(0, DASH_DIVIDER, OBJPROP_XDISTANCE, contentX);
    ObjectSetInteger(0, DASH_DIVIDER, OBJPROP_YDISTANCE, DashboardY + DashboardPadding + headerHeight - 4);
    ObjectSetInteger(0, DASH_DIVIDER, OBJPROP_XSIZE, contentWidth);
    ObjectSetInteger(0, DASH_DIVIDER, OBJPROP_YSIZE, 1);
    ObjectSetInteger(0, DASH_DIVIDER, OBJPROP_COLOR, C'226,232,240');
    ObjectSetInteger(0, DASH_DIVIDER, OBJPROP_BGCOLOR, C'226,232,240');
    ObjectSetInteger(0, DASH_DIVIDER, OBJPROP_BORDER_TYPE, BORDER_FLAT);
    ObjectSetInteger(0, DASH_DIVIDER, OBJPROP_BACK, false);
    ObjectSetInteger(0, DASH_DIVIDER, OBJPROP_SELECTABLE, false);
    ObjectSetInteger(0, DASH_DIVIDER, OBJPROP_HIDDEN, true);
  }

  if(ObjectFind(0, DASH_TITLE) < 0)
  {
    ObjectCreate(0, DASH_TITLE, OBJ_LABEL, 0, 0, 0);
    ObjectSetInteger(0, DASH_TITLE, OBJPROP_CORNER, DashboardCorner);
    ObjectSetInteger(0, DASH_TITLE, OBJPROP_XDISTANCE, contentX);
    ObjectSetInteger(0, DASH_TITLE, OBJPROP_YDISTANCE, DashboardY + DashboardPadding + 1);
    ObjectSetInteger(0, DASH_TITLE, OBJPROP_FONTSIZE, DashboardFontSize + 3);
    ObjectSetString(0, DASH_TITLE, OBJPROP_FONT, "Segoe UI Semibold");
    ObjectSetInteger(0, DASH_TITLE, OBJPROP_SELECTABLE, false);
    ObjectSetInteger(0, DASH_TITLE, OBJPROP_HIDDEN, true);
  }

  for(int i = 0; i < lineCount; i++)
  {
    const string name = g_dashboardLines[i];
    if(ObjectFind(0, name) >= 0)
      continue;
    ObjectCreate(0, name, OBJ_LABEL, 0, 0, 0);
    ObjectSetInteger(0, name, OBJPROP_CORNER, DashboardCorner);
    ObjectSetInteger(0, name, OBJPROP_XDISTANCE, contentX);
    ObjectSetInteger(
      0,
      name,
      OBJPROP_YDISTANCE,
      DashboardY + DashboardPadding + headerHeight + i * DashboardLineHeight
    );
    ObjectSetInteger(0, name, OBJPROP_FONTSIZE, DashboardFontSize);
    ObjectSetString(0, name, OBJPROP_FONT, "Segoe UI");
    ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
    ObjectSetInteger(0, name, OBJPROP_HIDDEN, true);
  }

  g_dashboardReady = true;
  UpdateDashboard();
}

//+------------------------------------------------------------------+
void DestroyDashboard()
{
  if(!g_dashboardReady)
    return;
  ObjectDelete(0, DASH_SHADOW);
  ObjectDelete(0, DASH_BG);
  ObjectDelete(0, DASH_ACCENT);
  ObjectDelete(0, DASH_DIVIDER);
  ObjectDelete(0, DASH_TITLE);
  for(int i = 0; i < ArraySize(g_dashboardLines); i++)
    ObjectDelete(0, g_dashboardLines[i]);
  g_dashboardReady = false;
}

//+------------------------------------------------------------------+
void UpdateDashboard()
{
  if(!ShowDashboard || !g_dashboardReady)
    return;

  datetime now = TimeCurrent();
  int totalPairs = ArraySize(g_brokerSymbols);
  int openPairs = CountOpenPairs();
  int openPositions = CountOpenPositions();
  double totalLots = GetTotalBasketLots();

  color textColor = C'15,23,42';
  color dimColor = C'100,116,139';
  color goodColor = C'34,197,94';
  color warnColor = C'245,158,11';
  color badColor = C'239,68,68';

  string stateText = StateToString(g_state);
  color stateColor = dimColor;
  if(g_state == STATE_ACTIVE)
    stateColor = goodColor;
  else if(g_state == STATE_READY)
    stateColor = C'56,189,248';
  else if(g_state == STATE_PAUSED)
    stateColor = warnColor;

  string apiLine = StringFormat("API: %s | Allowed: %s",
                                g_apiOk ? "OK" : "Fail",
                                g_tradingAllowed ? "Yes" : "No");
  color apiColor = badColor;
  if(g_apiOk && g_tradingAllowed)
    apiColor = goodColor;
  else if(g_apiOk)
    apiColor = warnColor;

  string reportText = (g_reportDate == "" ? "--" : g_reportDate);
  string pairsLine = StringFormat("Pairs: %d   Open pairs: %d", totalPairs, openPairs);
  string positionLine = StringFormat("Positions: %d   Lots: %.2f", openPositions, totalLots);
  string equityLine = StringFormat("Equity: %.2f   Balance: %.2f",
                                   AccountInfoDouble(ACCOUNT_EQUITY),
                                   AccountInfoDouble(ACCOUNT_BALANCE));

  string pnlText = "--";
  double pnlPct = 0.0;
  color pnlColor = dimColor;
  if(g_baselineEquity > 0.0)
  {
    pnlPct = (AccountInfoDouble(ACCOUNT_EQUITY) - g_baselineEquity) / g_baselineEquity * 100.0;
    pnlText = StringFormat("%+.2f%%", pnlPct);
    pnlColor = (pnlPct >= 0.0 ? goodColor : badColor);
  }
  string pnlLine = StringFormat("PnL: %s   Locked: %.2f%%", pnlText, g_lockedProfitPct);

  string ddLine = StringFormat("Max DD: %.2f%%", g_maxDrawdownPct);
  color ddColor = (g_maxDrawdownPct <= 0.0 ? goodColor : badColor);

  string nextAddText = "n/a";
  if(g_state == STATE_ACTIVE && totalPairs > 0)
  {
    datetime earliest = 0;
    bool found = false;
    for(int i = 0; i < totalPairs; i++)
    {
      if(g_brokerSymbols[i] == "")
        continue;
      datetime lastAdd = g_lastAddTimes[i];
      datetime candidate = (lastAdd == 0 ? now : lastAdd + AddIntervalMinutes * 60);
      if(!found || candidate < earliest)
      {
        earliest = candidate;
        found = true;
      }
    }
    if(found)
    {
      int seconds = (int)(earliest - now);
      nextAddText = (seconds <= 0 ? "now" : FormatDuration(seconds));
    }
  }
  string nextAddLine = StringFormat("Next add: %s   Interval: %dm", nextAddText, AddIntervalMinutes);

  int pollRemaining = ApiPollIntervalSeconds;
  if(g_lastPoll > 0)
  {
    pollRemaining = ApiPollIntervalSeconds - (int)(now - g_lastPoll);
    if(pollRemaining < 0)
      pollRemaining = 0;
  }
  string pollLine = StringFormat("Next poll: %s", FormatDuration(pollRemaining));

  string errorText = "none";
  color errorColor = dimColor;
  if(g_lastApiError != "")
  {
    errorText = g_lastApiError;
    if(g_lastApiErrorTime > 0)
      errorText += " " + FormatTimeValue(g_lastApiErrorTime);
    errorColor = badColor;
  }
  string errorLine = StringFormat("Last error: %s", errorText);

  SetLabelText(DASH_TITLE, "Limni Basket EA", C'15,23,42');
  SetLabelText(g_dashboardLines[0], StringFormat("State: %s", stateText), stateColor);
  SetLabelText(g_dashboardLines[1], apiLine, apiColor);
  SetLabelText(g_dashboardLines[2], StringFormat("Report date: %s", reportText), dimColor);
  SetLabelText(g_dashboardLines[3], pairsLine, textColor);
  SetLabelText(g_dashboardLines[4], positionLine, textColor);
  SetLabelText(g_dashboardLines[5], equityLine, textColor);
  SetLabelText(g_dashboardLines[6], pnlLine, pnlColor);
  SetLabelText(g_dashboardLines[7], ddLine, ddColor);
  SetLabelText(g_dashboardLines[8], nextAddLine, dimColor);
  SetLabelText(g_dashboardLines[9], pollLine + "   |   " + errorLine, errorColor);
}

//+------------------------------------------------------------------+
void SetLabelText(const string name, const string text, color textColor)
{
  if(ObjectFind(0, name) < 0)
    return;
  ObjectSetString(0, name, OBJPROP_TEXT, text);
  ObjectSetInteger(0, name, OBJPROP_COLOR, textColor);
}

//+------------------------------------------------------------------+
string StateToString(EAState state)
{
  if(state == STATE_IDLE)
    return "IDLE";
  if(state == STATE_READY)
    return "READY";
  if(state == STATE_ACTIVE)
    return "ACTIVE";
  if(state == STATE_PAUSED)
    return "PAUSED";
  if(state == STATE_CLOSED)
    return "CLOSED";
  return "UNKNOWN";
}

//+------------------------------------------------------------------+
string FormatDuration(int seconds)
{
  if(seconds < 0)
    seconds = 0;
  int hours = seconds / 3600;
  int minutes = (seconds % 3600) / 60;
  int secs = seconds % 60;
  return StringFormat("%02d:%02d:%02d", hours, minutes, secs);
}

//+------------------------------------------------------------------+
string FormatTimeValue(datetime value)
{
  if(value <= 0)
    return "--";
  return TimeToString(value, TIME_DATE | TIME_SECONDS);
}

//+------------------------------------------------------------------+
int CountOpenPositions()
{
  int count = 0;
  int total = PositionsTotal();
  for(int i = 0; i < total; i++)
  {
    ulong ticket = PositionGetTicket(i);
    if(ticket == 0)
      continue;
    if(!PositionSelectByTicket(ticket))
      continue;
    if((long)PositionGetInteger(POSITION_MAGIC) != MagicNumber)
      continue;
    count++;
  }
  return count;
}

//+------------------------------------------------------------------+
int CountOpenPairs()
{
  int count = 0;
  for(int i = 0; i < ArraySize(g_brokerSymbols); i++)
  {
    string symbol = g_brokerSymbols[i];
    if(symbol == "")
      continue;
    SymbolStats stats;
    if(GetSymbolStats(symbol, stats))
      count++;
  }
  return count;
}

//+------------------------------------------------------------------+
void UpdateDrawdown()
{
  double equity = AccountInfoDouble(ACCOUNT_EQUITY);
  if(equity <= 0.0)
    return;

  bool changed = false;
  if(g_weekPeakEquity <= 0.0)
  {
    g_weekPeakEquity = equity;
    changed = true;
  }
  if(equity > g_weekPeakEquity)
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

//+------------------------------------------------------------------+
void PushStatsIfDue()
{
  if(!PushAccountStats || PushUrl == "")
    return;

  datetime now = TimeCurrent();
  if(g_lastPush != 0 && (now - g_lastPush) < PushIntervalSeconds)
    return;

  g_lastPush = now;
  if(!SendAccountSnapshot())
  {
    Log("Account snapshot push failed.");
  }
}

//+------------------------------------------------------------------+
bool SendAccountSnapshot()
{
  string payload = BuildAccountPayload();
  if(payload == "")
    return false;
  string response = "";
  if(!HttpPostJson(PushUrl, payload, response))
    return false;
  return true;
}

//+------------------------------------------------------------------+
bool HttpPostJson(const string url, const string payload, string &response)
{
  uchar result[];
  uchar data[];
  string headers;
  string request_headers = "Content-Type: application/json\r\n";
  if(PushToken != "")
    request_headers += "x-admin-token: " + PushToken + "\r\n";

  int len = StringToCharArray(payload, data, 0, WHOLE_ARRAY, CP_UTF8);
  if(len > 0 && data[len - 1] == 0)
    ArrayResize(data, len - 1);

  ResetLastError();
  int timeout = 8000;
  int status = WebRequest("POST", url, request_headers, timeout, data, result, headers);
  if(status == -1)
  {
    Log(StringFormat("Snapshot WebRequest failed: %d", GetLastError()));
    return false;
  }
  if(status != 200)
  {
    Log(StringFormat("Snapshot HTTP status %d", status));
    return false;
  }

  int size = ArraySize(result);
  if(size > 0)
    response = CharArrayToString(result, 0, size);
  return true;
}

//+------------------------------------------------------------------+
void GetWeeklyTradeStats(int &tradeCount, double &winRatePct)
{
  tradeCount = 0;
  winRatePct = 0.0;

  datetime from = g_weekStartGmt;
  datetime to = TimeCurrent();
  if(from <= 0 || to <= from)
    return;
  if(!HistorySelect(from, to))
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
    if((long)HistoryDealGetInteger(ticket, DEAL_MAGIC) != MagicNumber)
      continue;
    int entry = (int)HistoryDealGetInteger(ticket, DEAL_ENTRY);
    if(entry != DEAL_ENTRY_OUT)
      continue;

    long posId = (long)HistoryDealGetInteger(ticket, DEAL_POSITION_ID);
    double profit = HistoryDealGetDouble(ticket, DEAL_PROFIT);
    profit += HistoryDealGetDouble(ticket, DEAL_SWAP);
    profit += HistoryDealGetDouble(ticket, DEAL_COMMISSION);

    int idx = -1;
    for(int j = 0; j < ArraySize(posIds); j++)
    {
      if(posIds[j] == posId)
      {
        idx = j;
        break;
      }
    }

    if(idx < 0)
    {
      int size = ArraySize(posIds);
      ArrayResize(posIds, size + 1);
      ArrayResize(posProfits, size + 1);
      posIds[size] = posId;
      posProfits[size] = profit;
    }
    else
    {
      posProfits[idx] += profit;
    }
  }

  tradeCount = ArraySize(posIds);
  if(tradeCount == 0)
    return;

  int wins = 0;
  for(int i = 0; i < tradeCount; i++)
  {
    if(posProfits[i] > 0.0)
      wins++;
  }
  winRatePct = (double)wins / tradeCount * 100.0;
}

//+------------------------------------------------------------------+
string BuildAccountPayload()
{
  string accountId = IntegerToString((long)AccountInfoInteger(ACCOUNT_LOGIN));
  string label = AccountLabel;
  if(label == "")
    label = AccountInfoString(ACCOUNT_NAME);
  if(label == "")
    label = accountId;
  string broker = AccountInfoString(ACCOUNT_COMPANY);
  string server = AccountInfoString(ACCOUNT_SERVER);
  string currency = AccountInfoString(ACCOUNT_CURRENCY);
  double equity = AccountInfoDouble(ACCOUNT_EQUITY);
  double balance = AccountInfoDouble(ACCOUNT_BALANCE);
  double margin = AccountInfoDouble(ACCOUNT_MARGIN);
  double freeMargin = AccountInfoDouble(ACCOUNT_FREEMARGIN);
  int openPositions = CountOpenPositions();
  int openPairs = CountOpenPairs();
  double totalLots = GetTotalBasketLots();
  double pnlPct = 0.0;
  if(g_baselineEquity > 0.0)
    pnlPct = (equity - g_baselineEquity) / g_baselineEquity * 100.0;
  double riskUsed = openPairs * MaxRiskPercent;
  int nextAddSeconds = GetNextAddSeconds();
  int nextPollSeconds = GetNextPollSeconds();
  int tradeCount = 0;
  double winRate = 0.0;
  GetWeeklyTradeStats(tradeCount, winRate);

  string payload = "{";
  payload += "\"account_id\":\"" + JsonEscape(accountId) + "\",";
  payload += "\"label\":\"" + JsonEscape(label) + "\",";
  payload += "\"broker\":\"" + JsonEscape(broker) + "\",";
  payload += "\"server\":\"" + JsonEscape(server) + "\",";
  payload += "\"status\":\"" + JsonEscape(AccountStatusToString()) + "\",";
  payload += "\"currency\":\"" + JsonEscape(currency) + "\",";
  payload += "\"equity\":" + DoubleToString(equity, 2) + ",";
  payload += "\"balance\":" + DoubleToString(balance, 2) + ",";
  payload += "\"margin\":" + DoubleToString(margin, 2) + ",";
  payload += "\"free_margin\":" + DoubleToString(freeMargin, 2) + ",";
  payload += "\"basket_state\":\"" + JsonEscape(StateToString(g_state)) + "\",";
  payload += "\"open_positions\":" + IntegerToString(openPositions) + ",";
  payload += "\"open_pairs\":" + IntegerToString(openPairs) + ",";
  payload += "\"total_lots\":" + DoubleToString(totalLots, 2) + ",";
  payload += "\"baseline_equity\":" + DoubleToString(g_baselineEquity, 2) + ",";
  payload += "\"locked_profit_pct\":" + DoubleToString(g_lockedProfitPct, 2) + ",";
  payload += "\"basket_pnl_pct\":" + DoubleToString(pnlPct, 2) + ",";
  payload += "\"weekly_pnl_pct\":" + DoubleToString(pnlPct, 2) + ",";
  payload += "\"risk_used_pct\":" + DoubleToString(riskUsed, 2) + ",";
  payload += "\"trade_count_week\":" + IntegerToString(tradeCount) + ",";
  payload += "\"win_rate_pct\":" + DoubleToString(winRate, 2) + ",";
  payload += "\"max_drawdown_pct\":" + DoubleToString(g_maxDrawdownPct, 2) + ",";
  payload += "\"report_date\":\"" + JsonEscape(g_reportDate) + "\",";
  payload += "\"api_ok\":" + BoolToJson(g_apiOk) + ",";
  payload += "\"trading_allowed\":" + BoolToJson(g_tradingAllowed) + ",";
  payload += "\"last_api_error\":\"" + JsonEscape(g_lastApiError) + "\",";
  payload += "\"next_add_seconds\":" + IntegerToString(nextAddSeconds) + ",";
  payload += "\"next_poll_seconds\":" + IntegerToString(nextPollSeconds) + ",";
  payload += "\"last_sync_utc\":\"" + FormatIsoUtc(TimeGMT()) + "\",";
  payload += "\"positions\":" + BuildPositionsArray();
  payload += "}";
  return payload;
}

//+------------------------------------------------------------------+
string BuildPositionsArray()
{
  string result = "[";
  int total = PositionsTotal();
  bool firstPos = true;

  for(int i = 0; i < total; i++)
  {
    ulong ticket = PositionGetTicket(i);
    if(ticket == 0)
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
    double commission = 0.0;
    datetime openTime = (datetime)PositionGetInteger(POSITION_TIME);
    long magic = PositionGetInteger(POSITION_MAGIC);
    string comment = PositionGetString(POSITION_COMMENT);

    string typeStr = (posType == POSITION_TYPE_BUY) ? "BUY" : "SELL";

    if(!firstPos)
      result += ",";
    firstPos = false;

    result += "{";
    result += "\"ticket\":" + IntegerToString((long)ticket) + ",";
    result += "\"symbol\":\"" + JsonEscape(symbol) + "\",";
    result += "\"type\":\"" + typeStr + "\",";
    result += "\"lots\":" + DoubleToString(lots, 2) + ",";
    result += "\"open_price\":" + DoubleToString(openPrice, 5) + ",";
    result += "\"current_price\":" + DoubleToString(currentPrice, 5) + ",";
    result += "\"stop_loss\":" + DoubleToString(stopLoss, 5) + ",";
    result += "\"take_profit\":" + DoubleToString(takeProfit, 5) + ",";
    result += "\"profit\":" + DoubleToString(profit, 2) + ",";
    result += "\"swap\":" + DoubleToString(swap, 2) + ",";
    result += "\"commission\":" + DoubleToString(commission, 2) + ",";
    result += "\"open_time\":\"" + FormatIsoUtc(openTime) + "\",";
    result += "\"magic_number\":" + IntegerToString((int)magic) + ",";
    result += "\"comment\":\"" + JsonEscape(comment) + "\"";
    result += "}";
  }

  result += "]";
  return result;
}

//+------------------------------------------------------------------+
string JsonEscape(const string value)
{
  string out = value;
  StringReplace(out, "\\", "\\\\");
  StringReplace(out, "\"", "\\\"");
  return out;
}

//+------------------------------------------------------------------+
string BoolToJson(bool value)
{
  return value ? "true" : "false";
}

//+------------------------------------------------------------------+
string FormatIsoUtc(datetime value)
{
  MqlDateTime dt;
  TimeToStruct(value, dt);
  return StringFormat("%04d-%02d-%02dT%02d:%02d:%02dZ",
                      dt.year, dt.mon, dt.day, dt.hour, dt.min, dt.sec);
}

//+------------------------------------------------------------------+
string AccountStatusToString()
{
  int mode = (int)AccountInfoInteger(ACCOUNT_TRADE_MODE);
  if(mode == ACCOUNT_TRADE_MODE_REAL)
    return "LIVE";
  if(mode == ACCOUNT_TRADE_MODE_DEMO)
    return "DEMO";
  return "PAUSED";
}

//+------------------------------------------------------------------+
int GetNextAddSeconds()
{
  if(g_state != STATE_ACTIVE || ArraySize(g_brokerSymbols) == 0)
    return -1;

  datetime now = TimeCurrent();
  datetime earliest = 0;
  bool found = false;
  for(int i = 0; i < ArraySize(g_brokerSymbols); i++)
  {
    if(g_brokerSymbols[i] == "")
      continue;
    datetime lastAdd = g_lastAddTimes[i];
    datetime candidate = (lastAdd == 0 ? now : lastAdd + AddIntervalMinutes * 60);
    if(!found || candidate < earliest)
    {
      earliest = candidate;
      found = true;
    }
  }
  if(!found)
    return -1;
  return (int)(earliest - now);
}

//+------------------------------------------------------------------+
int GetNextPollSeconds()
{
  datetime now = TimeCurrent();
  if(g_lastPoll == 0)
    return ApiPollIntervalSeconds;
  int remaining = ApiPollIntervalSeconds - (int)(now - g_lastPoll);
  if(remaining < 0)
    remaining = 0;
  return remaining;
}
