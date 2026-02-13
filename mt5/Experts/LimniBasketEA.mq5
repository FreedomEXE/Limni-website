//+------------------------------------------------------------------+
//|                                                   LimniBasketEA |
//|                                    COT-based weekly basket EA   |
//+------------------------------------------------------------------+
#property strict

#include <Trade/Trade.mqh>
#include "Include/HistoricalReconstruction.mqh"

input string ApiUrl = "https://limni-website-nine.vercel.app/api/cot/baskets/latest";
input string ApiUrlFallback = "";
input string AssetFilter = "all";
input bool ResetStateOnInit = false;
input int ApiPollIntervalSeconds = 60;
input double BasketLotCapPer100k = 10.0;
input bool ManualMode = false;
enum RiskProfile
{
  RISK_HIGH = 0,
  RISK_LOW = 1,
  RISK_GOD = 2,
  RISK_NORMAL = 3
};
input RiskProfile RiskMode = RISK_HIGH;
input double LowRiskLegScale = 0.10;
input string SymbolAliases = "SPXUSD=SPX500,NDXUSD=NDX100,NIKKEIUSD=JPN225,WTIUSD=USOUSD,BTCUSD=BTCUSD,ETHUSD=ETHUSD";
input bool EnforceAllowedSymbols = false;
input string AllowedSymbols = "EURUSD*,GBPUSD*,USDJPY*,USDCHF*,USDCAD*,AUDUSD*,NZDUSD*,EURGBP*,EURJPY*,EURCHF*,EURAUD*,EURNZD*,EURCAD*,GBPJPY*,GBPCHF*,GBPAUD*,GBPNZD*,GBPCAD*,AUDJPY*,AUDCHF*,AUDCAD*,AUDNZD*,NZDJPY*,NZDCHF*,NZDCAD*,CADJPY*,CADCHF*,CHFJPY*,XAUUSD*,XAGUSD*,WTIUSD*,USOUSD*,SPXUSD*,NDXUSD*,NIKKEIUSD*,SPX500*,NDX100*,JPN225*,BTCUSD*,ETHUSD*";
input double FxLotMultiplier = 1.0;
input double CryptoLotMultiplier = 1.0;
input double CommoditiesLotMultiplier = 1.0;
input double IndicesLotMultiplier = 1.0;
input bool LogSizingDetails = true;
input int SizingLogCooldownSeconds = 300;
input double SizingLogDeviationThresholdPct = 5.0;
input double EquityTrailStartPct = 20.0;
input double EquityTrailOffsetPct = 10.0;
input bool EnableEquityTrail = false;
input bool EnableBasketTakeProfit = true;
input double BasketTakeProfitPct = 6.0;
input double BasketTakeProfitUsd = 0.0;
input bool EnforceStopLoss = true;
input double StopLossRiskPct = 1.0;
input double MaxStopLossRiskPct = 2.0;
input bool AllowNonFullTradeModeForListing = true;
input int MaxOpenPositions = 200;
input int SlippagePoints = 10;
input long MagicNumber = 912401;
input int MaxOrdersPerMinute = 20;
input bool ShowDashboard = true;
input int DashboardCorner = 0;
input int DashboardX = 18;
input int DashboardY = 18;
input int DashboardWidth = 1200;
input int DashboardLineHeight = 32;
input int DashboardPadding = 24;
input int DashboardFontSize = 17;
input int DashboardTitleSize = 22;
input int DashboardAccentWidth = 12;
input int DashboardShadowOffset = 8;
input int DashboardColumnGap = 36;
input int LotMapMaxLines = 22;
input int DashboardUrlMaxLen = 84;
input bool PushAccountStats = true;
input string PushUrl = "https://limni-website-nine.vercel.app/api/mt5/push";
input string PushToken = "2121";
input int PushIntervalSeconds = 30;
input string AccountLabel = "";
input int ClosedHistoryDays = 30;
input bool EnableReconnectReconstruction = true;
input int ReconstructIfOfflineMinutes = 60;
input int ReconstructionMaxDays = 14;
input int ReconstructionTimeoutSeconds = 30;
input int ReconstructionMaxCandlesPerSymbol = 1000;

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
datetime g_lastApiSuccess = 0;
bool g_loadedFromCache = false;

double g_baselineEquity = 0.0;
double g_lockedProfitPct = 0.0;
bool g_trailingActive = false;
bool g_closeRequested = false;
double g_weekPeakEquity = 0.0;
double g_maxDrawdownPct = 0.0;

string g_apiSymbols[];
string g_brokerSymbols[];
int g_directions[];
string g_models[];
string g_assetClasses[];
int g_diagRawA = 0;
int g_diagRawB = 0;
int g_diagRawC = 0;
int g_diagRawD = 0;
int g_diagRawS = 0;
int g_diagAcceptedA = 0;
int g_diagAcceptedB = 0;
int g_diagAcceptedC = 0;
int g_diagAcceptedD = 0;
int g_diagAcceptedS = 0;
int g_diagSkipNotAllowed = 0;
int g_diagSkipUnresolvedSymbol = 0;
int g_diagSkipDuplicateOpen = 0;
int g_diagSkipCryptoNotOpen = 0;
int g_diagSkipNotTradable = 0;
int g_diagSkipInvalidVolume = 0;
int g_diagSkipOrderFailed = 0;
int g_diagSkipMaxPositions = 0;
int g_diagSkipLotCap = 0;
int g_diagSkipRateLimit = 0;

datetime g_orderTimes[];
datetime g_lastPush = 0;
string g_dataSource = "realtime";
string g_reconstructionStatus = "none";
string g_reconstructionNote = "";
datetime g_reconstructionWindowStart = 0;
datetime g_reconstructionWindowEnd = 0;
int g_reconstructionMarketClosed = 0;
int g_reconstructionTrades = 0;
double g_reconstructionWeekRealized = 0.0;
bool g_reconstructionAttempted = false;

CTrade g_trade;

string GV_WEEK_START = "Limni_WeekStart";
string GV_STATE = "Limni_State";
string GV_BASELINE = "Limni_Baseline";
string GV_LOCKED = "Limni_Locked";
string GV_TRAIL = "Limni_TrailActive";
string GV_CLOSE = "Limni_CloseRequested";
string GV_WEEK_PEAK = "Limni_WeekPeak";
string GV_MAX_DD = "Limni_MaxDD";
string GV_LAST_PUSH = "Limni_LastPush";
string CACHE_FILE = "LimniCotCache.json";
string DASH_BG = "LimniDash_bg";
string DASH_SHADOW = "LimniDash_shadow";
string DASH_ACCENT = "LimniDash_accent";
string DASH_DIVIDER = "LimniDash_divider";
string DASH_COL_DIVIDER = "LimniDash_col_divider";
string DASH_TITLE = "LimniDash_title";
string DASH_MAP_TITLE = "LimniDash_map_title";

string g_lastApiError = "";
datetime g_lastApiErrorTime = 0;
string g_dashboardLines[];
string g_dashboardRightLines[];
bool g_dashboardReady = false;
int g_dashWidth = 0;
int g_dashLineHeight = 0;
int g_dashPadding = 0;
int g_dashFontSize = 0;
int g_dashTitleSize = 0;
int g_dashAccentWidth = 0;
int g_dashShadowOffset = 0;
int g_dashColumnGap = 0;
int g_dashLeftWidth = 0;
int g_dashRightWidth = 0;
int g_dashLeftX = 0;
int g_dashRightX = 0;
string g_allowedKeys[];
bool g_allowedKeyPrefixes[];
bool g_allowedKeysReady = false;
string g_logBuffer[100];
int g_logBufferIndex = 0;

// Forward declarations
void PollApiIfDue();
bool FetchApi(string &json);
string BuildApiUrl();
string BuildPushUrl();
bool ParseApiResponse(const string json, bool &allowed, string &reportDate,
                      string &symbols[], int &dirs[], string &models[], string &assetClasses[]);
bool ParsePairsArray(const string json, string &symbols[], int &dirs[], string &models[], string &assetClasses[]);
bool ParsePairsObject(const string json, string &symbols[], int &dirs[], string &models[], string &assetClasses[]);
bool ExtractStringValue(const string json, const string key, string &value);
bool ExtractBoolValue(const string json, const string key, bool &value);
bool ResolveSymbol(const string apiSymbol, string &resolved);
bool IsTradableSymbol(const string symbol);
string NormalizeSymbolKey(const string value);
bool TryResolveAlias(const string apiSymbol, string &resolved);
bool ResolveSymbolByNormalizedKey(const string targetKey, string &resolved, bool requireFull);
void BuildAllowedKeys();
bool IsAllowedSymbol(const string symbol);
bool IsIndexSymbol(const string symbol);
int DirectionFromString(const string value);
string DirectionToString(int dir);
double NormalizeVolume(const string symbol, double volume);
double GetLotForSymbol(const string symbol, const string assetClass);
double GetOneToOneLotForSymbol(const string symbol, const string assetClass);
double CalculateMarginRequired(const string symbol, double lots);
bool ComputeOneToOneLot(const string symbol, const string assetClass, double &targetLot,
                        double &finalLot, double &deviationPct, double &equityPerSymbol,
                        double &marginRequired);
bool ShouldLogSizing(const string symbol, int cooldownSeconds);
void LogSizing(const string symbol, double targetLot, double finalLot,
               double deviationPct, double equityPerSymbol, double marginRequired);
double GetAssetMultiplier(const string assetClass);
double GetBasketLotCap();
double GetTotalBasketLots();
bool HasOpenPositions();
bool HasPositionForModel(const string symbol, const string model);
void UpdateState();
void ManageBasket();
void TryAddPositions();
bool PlaceOrder(const string symbol, int direction, double volume, const string model);
bool CalculateRiskStopLoss(const string symbol, int direction, double volume, double entryPrice, double &stopLoss);
double EstimatePositionRiskUsd(const string symbol, int direction, double volume, double entryPrice, double stopLoss);
bool GetSymbolStats(const string symbol, SymbolStats &stats);
void CloseAllPositions();
bool ClosePositionByTicket(ulong ticket);
void CloseSymbolPositions(const string symbol);
void MarkOrderTimestamp();
int OrdersInLastMinute();
datetime GetWeekStartGmt(datetime nowGmt);
datetime GetCryptoWeekStartGmt(datetime nowGmt);
bool IsUsdDstUtc(datetime nowGmt);
bool IsUsdDstLocal(int year, int mon, int day, int hour);
int NthSunday(int year, int mon, int nth);
void LoadState();
void SaveState();
void LoadApiCache();
void SaveApiCache(const string json);
void ResetState();
void Log(const string message);
void LogTradeError(const string message);
bool ShouldLogIndexSkip(const string symbol, const string reasonKey, int cooldownSeconds);
void LogIndexSkip(const string symbol, const string reason, const string reasonKey);
void LogIndexSkipsForAll(const string reason, const string reasonKey);
void LogMissingIndexPairs(const string &symbols[]);
string TruncateForLog(const string value, int maxLen);
void InitDashboard();
void UpdateDashboard();
void DestroyDashboard();
void SetLabelText(const string name, const string text, color textColor);
string StateToString(EAState state);
string FormatDuration(int seconds);
string FormatTimeValue(datetime value);
string CompactText(const string value, int maxLen);
string EnsureTrailingSlash(const string url);
int CountOpenPositions();
int CountOpenPairs();
int CountSignalsByModel(const string model);
void UpdateDrawdown();
void GetWeeklyTradeStats(int &tradeCount, double &winRatePct);
void PushStatsIfDue();
bool SendAccountSnapshot();
bool HttpPostJson(const string url, const string payload, string &response);
void RunReconstructionIfNeeded();
double GetLegRiskScale();
string RiskModeToString();
void ApplyRiskScale(const string symbol, double scale, double &targetLot, double &finalLot,
                    double &deviationPct, double &equityPerSymbol, double &marginRequired);
string BuildAccountPayload();
string BuildPositionsArray();
string BuildClosedPositionsArray();
string BuildLotMapArray();
void ResetPlanningDiagnostics();
void AddRawModelCount(const string model);
void AddAcceptedModelCount(const string model);
void AddSkipReason(const string reasonKey);
string BuildPlanningDiagnosticsJson();
string BuildModelCountJson(bool accepted);
string BuildSkipReasonJson();
string BuildPlannedLegsJson();
string BuildExecutionLegsJson();
string ParseModelFromComment(const string comment);
string ToLongShort(int dir);
double ComputeMove1PctUsd(const string symbol, double lots);
string TradeModeToString();
string JsonEscape(const string value);
string BoolToJson(bool value);
string FormatIsoUtc(datetime value);
string AccountStatusToString();
int GetNextAddSeconds();
int GetNextPollSeconds();
double ProbeMarginCoverageForMode(const string symbol, const string assetClass, double &testLot, double &marginRequired);
void LogBrokerCapability();

//+------------------------------------------------------------------+
int OnInit()
{
  g_trade.SetExpertMagicNumber(MagicNumber);
  g_trade.SetDeviationInPoints(SlippagePoints);

  BuildAllowedKeys();
  LogBrokerCapability();
  g_weekStartGmt = GetWeekStartGmt(TimeGMT());
  if(ResetStateOnInit)
  {
    ResetState();
  }
  else
  {
    LoadState();
    LoadApiCache();
  }
  RunReconstructionIfNeeded();
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
    if(g_lastApiError == "")
    {
      g_lastApiError = "fetch failed";
      g_lastApiErrorTime = TimeCurrent();
    }
    Log("API fetch failed. Pausing new entries.");
    return;
  }

  bool allowed = false;
  string reportDate = "";
  string symbols[];
  int dirs[];
  string models[];
  string assetClasses[];
  ResetPlanningDiagnostics();
  if(!ParseApiResponse(json, allowed, reportDate, symbols, dirs, models, assetClasses))
  {
    g_apiOk = false;
    g_lastApiError = "parse failed";
    g_lastApiErrorTime = TimeCurrent();
    int len = StringLen(json);
    string preview = TruncateForLog(json, 300);
    Log(StringFormat("API parse failed. len=%d preview=%s", len, preview));
    return;
  }

  LogMissingIndexPairs(symbols);

  SaveApiCache(json);
  g_apiOk = true;
  g_tradingAllowed = allowed;
  g_reportDate = reportDate;
  g_lastApiSuccess = TimeCurrent();
  g_loadedFromCache = false;
  g_lastApiError = "";
  g_lastApiErrorTime = 0;

  int count = ArraySize(symbols);
  ArrayResize(g_apiSymbols, 0);
  ArrayResize(g_brokerSymbols, 0);
  ArrayResize(g_directions, 0);
  ArrayResize(g_models, 0);
  ArrayResize(g_assetClasses, 0);

  for(int i = 0; i < count; i++)
  {
    string model = (i < ArraySize(models) ? models[i] : "blended");
    AddRawModelCount(model);

    string resolved = "";
    if(!IsAllowedSymbol(symbols[i]))
    {
      AddSkipReason("not_allowed");
      if(IsIndexSymbol(symbols[i]))
        LogTradeError(StringFormat("Index pair %s not in allowed list. Skipped.", symbols[i]));
      continue;
    }
    if(!ResolveSymbol(symbols[i], resolved))
    {
      AddSkipReason("unresolved_symbol");
      if(IsIndexSymbol(symbols[i]))
        LogTradeError(StringFormat("Index pair %s not tradable or not found. Skipped.", symbols[i]));
      continue;
    }

    int idx = ArraySize(g_apiSymbols);
    ArrayResize(g_apiSymbols, idx + 1);
    ArrayResize(g_brokerSymbols, idx + 1);
    ArrayResize(g_directions, idx + 1);
    ArrayResize(g_models, idx + 1);
    ArrayResize(g_assetClasses, idx + 1);
    g_apiSymbols[idx] = symbols[i];
    g_brokerSymbols[idx] = resolved;
    g_directions[idx] = dirs[i];
    g_models[idx] = model;
    g_assetClasses[idx] = (i < ArraySize(assetClasses) ? assetClasses[i] : "fx");
    AddAcceptedModelCount(model);
  }

  Log(StringFormat("API ok. trading_allowed=%s, report_date=%s, pairs=%d",
                   g_tradingAllowed ? "true" : "false",
                   g_reportDate,
                   ArraySize(g_apiSymbols)));
}

string BuildApiUrl()
{
  string url = ApiUrl;
  if(StringFind(url, "http") != 0)
    return url;
  if(StringFind(url, "asset=") >= 0)
    return url;
  if(AssetFilter == "")
    return url;
  string sep = StringFind(url, "?") >= 0 ? "&" : "?";
  return url + sep + "asset=" + AssetFilter;
}

string BuildPushUrl()
{
  if(PushUrl != "")
    return PushUrl;

  string api = BuildApiUrl();
  int apiIdx = StringFind(api, "/api/");
  if(apiIdx < 0)
    return api;
  string base = StringSubstr(api, 0, apiIdx);
  return base + "/api/mt5/push";
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
                           "Connection: close\r\n"
                           "User-Agent: MT5-LimniBasket/2.1\r\n";
  string url = BuildApiUrl();
  int status = WebRequest("GET", url, request_headers, timeout, data, result, headers);
  if(status == 404)
  {
    string altUrl = EnsureTrailingSlash(url);
    if(altUrl != url)
      status = WebRequest("GET", altUrl, request_headers, timeout, data, result, headers);
    if(status == 404 && ApiUrlFallback != "" && ApiUrlFallback != url)
    {
      string fallbackUrl = ApiUrlFallback;
      status = WebRequest("GET", fallbackUrl, request_headers, timeout, data, result, headers);
      if(status == 404)
      {
        string altFallback = EnsureTrailingSlash(fallbackUrl);
        if(altFallback != fallbackUrl)
          status = WebRequest("GET", altFallback, request_headers, timeout, data, result, headers);
      }
    }
  }
  if(status == -1)
  {
    int err = GetLastError();
    g_lastApiError = StringFormat("webrequest %d", err);
    g_lastApiErrorTime = TimeCurrent();
    Log(StringFormat("WebRequest failed: %d", err));
    return false;
  }

  if(status != 200)
  {
    g_lastApiError = StringFormat("http %d", status);
    g_lastApiErrorTime = TimeCurrent();
    Log(StringFormat("API HTTP status %d (%s)", status, TruncateForLog(url, 120)));
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
                      string &symbols[], int &dirs[], string &models[], string &assetClasses[])
{
  allowed = false;
  reportDate = "";
  ArrayResize(symbols, 0);
  ArrayResize(dirs, 0);
  ArrayResize(models, 0);
  ArrayResize(assetClasses, 0);

  if(!ExtractBoolValue(json, "trading_allowed", allowed))
    return false;
  ExtractStringValue(json, "report_date", reportDate);

  if(!ParsePairsArray(json, symbols, dirs, models, assetClasses))
  {
    if(!ParsePairsObject(json, symbols, dirs, models, assetClasses))
      return false;
  }

  return (ArraySize(symbols) > 0);
}

//+------------------------------------------------------------------+
bool ParsePairsArray(const string json, string &symbols[], int &dirs[], string &models[], string &assetClasses[])
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
    string model = "";
    string assetClass = "";
    ExtractStringValue(obj, "model", model);
    ExtractStringValue(obj, "asset_class", assetClass);
    if(ExtractStringValue(obj, "symbol", symbol) &&
       ExtractStringValue(obj, "direction", direction))
    {
      int dir = DirectionFromString(direction);
      if(dir != 0)
      {
        int size = ArraySize(symbols);
        ArrayResize(symbols, size + 1);
        ArrayResize(dirs, size + 1);
        ArrayResize(models, size + 1);
        ArrayResize(assetClasses, size + 1);
        symbols[size] = symbol;
        dirs[size] = dir;
        models[size] = (model == "" ? "blended" : model);
        assetClasses[size] = (assetClass == "" ? "fx" : assetClass);
      }
    }

    scan = objEnd + 1;
  }

  return (ArraySize(symbols) > 0);
}

//+------------------------------------------------------------------+
bool ParsePairsObject(const string json, string &symbols[], int &dirs[], string &models[], string &assetClasses[])
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
    string model = "";
    string assetClass = "";
    ExtractStringValue(nested, "model", model);
    ExtractStringValue(nested, "asset_class", assetClass);
    if(ExtractStringValue(nested, "direction", direction))
    {
      int dir = DirectionFromString(direction);
      if(dir != 0)
      {
        int size = ArraySize(symbols);
        ArrayResize(symbols, size + 1);
        ArrayResize(dirs, size + 1);
        ArrayResize(models, size + 1);
        ArrayResize(assetClasses, size + 1);
        symbols[size] = key;
        dirs[size] = dir;
        models[size] = (model == "" ? "blended" : model);
        assetClasses[size] = (assetClass == "" ? "fx" : assetClass);
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
  if(TryResolveAlias(target, resolved))
  {
    if(!IsAllowedSymbol(resolved))
      return false;
    return true;
  }
  if(SymbolSelect(target, true) && IsTradableSymbol(target))
  {
    resolved = target;
    if(!IsAllowedSymbol(resolved))
      return false;
    return true;
  }
  if(AllowNonFullTradeModeForListing && SymbolSelect(target, true))
  {
    resolved = target;
    if(!IsAllowedSymbol(resolved))
      return false;
    return true;
  }

  string targetKey = NormalizeSymbolKey(target);
  bool requireFull = !AllowNonFullTradeModeForListing;
  if(ResolveSymbolByNormalizedKey(targetKey, resolved, requireFull))
  {
    if(!IsAllowedSymbol(resolved))
      return false;
    return true;
  }

  return false;
}

void BuildAllowedKeys()
{
  if(!EnforceAllowedSymbols || g_allowedKeysReady)
    return;
  ArrayResize(g_allowedKeys, 0);
  ArrayResize(g_allowedKeyPrefixes, 0);
  if(AllowedSymbols == "")
  {
    g_allowedKeysReady = true;
    return;
  }
  string raw = AllowedSymbols;
  StringReplace(raw, " ", "");
  int start = 0;
  while(start < StringLen(raw))
  {
    int comma = StringFind(raw, ",", start);
    if(comma < 0)
      comma = StringLen(raw);
    string token = StringSubstr(raw, start, comma - start);
    if(token != "")
    {
      bool prefix = false;
      int tokenLen = StringLen(token);
      if(tokenLen > 0 && StringSubstr(token, tokenLen - 1, 1) == "*")
      {
        prefix = true;
        token = StringSubstr(token, 0, tokenLen - 1);
      }
      StringToUpper(token);
      string key = NormalizeSymbolKey(token);
      if(key != "")
      {
        int size = ArraySize(g_allowedKeys);
        ArrayResize(g_allowedKeys, size + 1);
        ArrayResize(g_allowedKeyPrefixes, size + 1);
        g_allowedKeys[size] = key;
        g_allowedKeyPrefixes[size] = prefix;
      }
    }
    start = comma + 1;
  }
  g_allowedKeysReady = true;
}

bool IsAllowedSymbol(const string symbol)
{
  if(!EnforceAllowedSymbols)
    return true;
  BuildAllowedKeys();
  if(ArraySize(g_allowedKeys) == 0)
    return true;
  string upper = symbol;
  StringToUpper(upper);
  string key = NormalizeSymbolKey(upper);
  if(key == "")
    return false;
  for(int i = 0; i < ArraySize(g_allowedKeys); i++)
  {
    string allowed = g_allowedKeys[i];
    if(allowed == "")
      continue;
    if(key == allowed)
      return true;
    if(g_allowedKeyPrefixes[i] && StringFind(key, allowed) == 0)
      return true;
  }
  return false;
}

bool IsIndexSymbol(const string symbol)
{
  string upper = symbol;
  StringToUpper(upper);
  string key = NormalizeSymbolKey(upper);
  return (StringFind(key, "SPX") >= 0 ||
          StringFind(key, "SP500") >= 0 ||
          StringFind(key, "SPX500") >= 0 ||
          StringFind(key, "US500") >= 0 ||
          StringFind(key, "NDX") >= 0 ||
          StringFind(key, "NDX100") >= 0 ||
          StringFind(key, "NAS100") >= 0 ||
          StringFind(key, "US100") >= 0 ||
          StringFind(key, "NIKKEI") >= 0 ||
          StringFind(key, "NIKKEI225") >= 0 ||
          StringFind(key, "NIK225") >= 0 ||
          StringFind(key, "JPN225") >= 0 ||
          StringFind(key, "JP225") >= 0);
}

string NormalizeSymbolKey(const string value)
{
  string out = "";
  int len = StringLen(value);
  for(int i = 0; i < len; i++)
  {
    string ch = StringSubstr(value, i, 1);
    int code = StringGetCharacter(ch, 0);
    if((code >= 48 && code <= 57) || (code >= 65 && code <= 90))
      out += ch;
  }
  return out;
}

bool TryResolveAlias(const string apiSymbol, string &resolved)
{
  if(SymbolAliases == "")
    return false;
  string aliases = SymbolAliases;
  StringReplace(aliases, " ", "");
  int start = 0;
  while(start < StringLen(aliases))
  {
    int comma = StringFind(aliases, ",", start);
    if(comma < 0)
      comma = StringLen(aliases);
    string pair = StringSubstr(aliases, start, comma - start);
    int eq = StringFind(pair, "=");
    if(eq > 0)
    {
      string key = StringSubstr(pair, 0, eq);
      string val = StringSubstr(pair, eq + 1);
      StringToUpper(key);
      if(key == apiSymbol)
      {
        string candidate = val;
        if(SymbolSelect(candidate, true) && IsTradableSymbol(candidate))
        {
          resolved = candidate;
          return true;
        }
        if(AllowNonFullTradeModeForListing && SymbolSelect(candidate, true))
        {
          resolved = candidate;
          return true;
        }
        string candidateKey = NormalizeSymbolKey(candidate);
        bool requireFull = !AllowNonFullTradeModeForListing;
        if(ResolveSymbolByNormalizedKey(candidateKey, resolved, requireFull))
          return true;
      }
    }
    start = comma + 1;
  }
  return false;
}

bool ResolveSymbolByNormalizedKey(const string targetKey, string &resolved, bool requireFull)
{
  if(targetKey == "")
    return false;
  int bestScore = 2147483647;
  string bestSymbol = "";

  int total = SymbolsTotal(true);
  for(int i = 0; i < total; i++)
  {
    string sym = SymbolName(i, true);
    string symUpper = sym;
    StringToUpper(symUpper);
    string symKey = NormalizeSymbolKey(symUpper);
    if(symKey == "")
      continue;
    if(StringFind(symKey, targetKey) < 0 && StringFind(targetKey, symKey) < 0)
      continue;
    if(requireFull && !IsTradableSymbol(sym))
      continue;

    int score = MathAbs(StringLen(symKey) - StringLen(targetKey));
    if(score < bestScore)
    {
      bestScore = score;
      bestSymbol = sym;
    }
  }

  total = SymbolsTotal(false);
  for(int i = 0; i < total; i++)
  {
    string sym = SymbolName(i, false);
    string symUpper = sym;
    StringToUpper(symUpper);
    string symKey = NormalizeSymbolKey(symUpper);
    if(symKey == "")
      continue;
    if(StringFind(symKey, targetKey) < 0 && StringFind(targetKey, symKey) < 0)
      continue;
    if(!SymbolSelect(sym, true))
      continue;
    if(requireFull && !IsTradableSymbol(sym))
      continue;

    int score = MathAbs(StringLen(symKey) - StringLen(targetKey));
    if(score < bestScore)
    {
      bestScore = score;
      bestSymbol = sym;
    }
  }

  if(bestSymbol != "")
  {
    resolved = bestSymbol;
    return true;
  }
  return false;
}

//+------------------------------------------------------------------+
bool IsTradableSymbol(const string symbol)
{
  if((int)SymbolInfoInteger(symbol, SYMBOL_TRADE_MODE) != SYMBOL_TRADE_MODE_FULL)
    return false;
  return true;
}
//+------------------------------------------------------------------+
double NormalizeVolume(const string symbol, double volume)
{
  double minVol = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MIN);
  double maxVol = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MAX);
  double step = SymbolInfoDouble(symbol, SYMBOL_VOLUME_STEP);

  // Validate symbol info
  if(minVol <= 0.0 || maxVol <= 0.0 || step <= 0.0)
  {
    Print("ERROR: Invalid volume specs for ", symbol, " - min:", minVol, " max:", maxVol, " step:", step);
    return 0.0;
  }

  if(volume < minVol)
    volume = minVol;
  if(volume > maxVol)
    volume = maxVol;

  double steps = MathFloor(volume / step + 1e-9);
  double normalized = steps * step;
  int digits = (int)MathRound(-MathLog10(step));
  normalized = NormalizeDouble(normalized, digits);

  // Final validation
  if(normalized < minVol)
    normalized = minVol;

  return normalized;
}

double GetLotForSymbol(const string symbol, const string assetClass)
{
  return GetOneToOneLotForSymbol(symbol, assetClass);
}

double GetOneToOneLotForSymbol(const string symbol, const string assetClass)
{
  double targetLot = 0.0;
  double finalLot = 0.0;
  double deviationPct = 0.0;
  double equityPerSymbol = 0.0;
  double marginRequired = 0.0;
  if(!ComputeOneToOneLot(symbol, assetClass, targetLot, finalLot, deviationPct,
                         equityPerSymbol, marginRequired))
    return 0.0;
  ApplyRiskScale(symbol, GetLegRiskScale(), targetLot, finalLot, deviationPct, equityPerSymbol, marginRequired);
  return finalLot;
}

double GetLegRiskScale()
{
  if(RiskMode == RISK_NORMAL)
    return 0.25;
  if(RiskMode == RISK_LOW)
  {
    if(LowRiskLegScale <= 0.0)
      return 0.0;
    return LowRiskLegScale;
  }
  // Legacy HIGH remains 1.0x (God semantics). Explicit GOD is also 1.0x.
  return 1.0;
}

string RiskModeToString()
{
  if(RiskMode == RISK_LOW)
    return "LOW";
  if(RiskMode == RISK_NORMAL)
    return "NORMAL";
  if(RiskMode == RISK_GOD)
    return "GOD";
  return "HIGH_LEGACY";
}

double ProbeMarginCoverageForMode(const string symbol, const string assetClass, double &testLot, double &marginRequired)
{
  testLot = 0.0;
  marginRequired = 0.0;

  double targetLot = 0.0;
  double finalLot = 0.0;
  double deviationPct = 0.0;
  double equityPerSymbol = 0.0;
  if(!ComputeOneToOneLot(symbol, assetClass, targetLot, finalLot, deviationPct, equityPerSymbol, marginRequired))
    return -1.0;

  testLot = finalLot;
  if(testLot <= 0.0)
    return -2.0;

  double price = SymbolInfoDouble(symbol, SYMBOL_ASK);
  if(price <= 0.0)
    price = SymbolInfoDouble(symbol, SYMBOL_BID);
  if(price <= 0.0)
    price = SymbolInfoDouble(symbol, SYMBOL_LAST);
  if(price <= 0.0)
    return -3.0;

  if(!OrderCalcMargin(ORDER_TYPE_BUY, symbol, testLot, price, marginRequired))
    return -4.0;
  if(marginRequired <= 0.0)
    return -5.0;

  double freeMargin = AccountInfoDouble(ACCOUNT_MARGIN_FREE);
  if(freeMargin <= 0.0)
    return 0.0;
  return freeMargin / marginRequired;
}

void LogBrokerCapability()
{
  string broker = AccountInfoString(ACCOUNT_COMPANY);
  long leverage = AccountInfoInteger(ACCOUNT_LEVERAGE);
  Log(StringFormat("Broker capability probe | Broker=%s | Leverage=1:%d | RiskMode=%s",
                   broker, (int)leverage, RiskModeToString()));

  string probeSymbols[2];
  string probeAssetClasses[2];
  probeSymbols[0] = "EURUSD";
  probeSymbols[1] = "XAUUSD";
  probeAssetClasses[0] = "fx";
  probeAssetClasses[1] = "commodities";

  for(int i = 0; i < 2; i++)
  {
    string resolved = "";
    if(!ResolveSymbol(probeSymbols[i], resolved))
    {
      Log(StringFormat("Broker capability probe skipped %s (symbol unavailable)", probeSymbols[i]));
      continue;
    }

    double testLot = 0.0;
    double marginRequired = 0.0;
    double coverage = ProbeMarginCoverageForMode(resolved, probeAssetClasses[i], testLot, marginRequired);
    if(coverage < 0.0)
    {
      Log(StringFormat("Broker capability probe failed %s code=%.0f", resolved, coverage));
      continue;
    }

    string capability = "LOW_ONLY";
    if(coverage >= 4.0)
      capability = "GOD_OK";
    else if(coverage >= 1.0)
      capability = "HIGH_OK";
    else if(coverage >= 0.5)
      capability = "NORMAL_OK";

    Log(StringFormat("Capability %s lot=%.4f margin=%.2f free=%.2f coverage=%.2f -> %s",
                     resolved,
                     testLot,
                     marginRequired,
                     AccountInfoDouble(ACCOUNT_MARGIN_FREE),
                     coverage,
                     capability));
  }
}

void ApplyRiskScale(const string symbol, double scale, double &targetLot, double &finalLot,
                    double &deviationPct, double &equityPerSymbol, double &marginRequired)
{
  if(scale <= 0.0)
  {
    targetLot = 0.0;
    finalLot = 0.0;
    deviationPct = 0.0;
    equityPerSymbol = 0.0;
    marginRequired = 0.0;
    return;
  }
  if(MathAbs(scale - 1.0) < 1e-9)
    return;

  targetLot *= scale;
  equityPerSymbol *= scale;
  finalLot = NormalizeVolume(symbol, finalLot * scale);
  marginRequired = CalculateMarginRequired(symbol, finalLot);
  if(targetLot > 0.0)
    deviationPct = (finalLot - targetLot) / targetLot * 100.0;
  else
    deviationPct = 0.0;
}

double CalculateMarginRequired(const string symbol, double lots)
{
  if(lots <= 0.0)
    return 0.0;
  double price = SymbolInfoDouble(symbol, SYMBOL_ASK);
  if(price <= 0.0)
    price = SymbolInfoDouble(symbol, SYMBOL_BID);
  if(price <= 0.0)
    price = SymbolInfoDouble(symbol, SYMBOL_LAST);
  if(price <= 0.0)
    return 0.0;
  double margin = 0.0;
  if(!OrderCalcMargin(ORDER_TYPE_BUY, symbol, lots, price, margin))
    return 0.0;
  return margin;
}

bool ComputeOneToOneLot(const string symbol, const string assetClass, double &targetLot,
                        double &finalLot, double &deviationPct, double &equityPerSymbol,
                        double &marginRequired)
{
  targetLot = 0.0;
  finalLot = 0.0;
  deviationPct = 0.0;
  equityPerSymbol = 0.0;
  marginRequired = 0.0;

  double price = SymbolInfoDouble(symbol, SYMBOL_BID);
  if(price <= 0.0)
    price = SymbolInfoDouble(symbol, SYMBOL_ASK);
  if(price <= 0.0)
    price = SymbolInfoDouble(symbol, SYMBOL_LAST);

  double tickSize = SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_SIZE);
  double tickValue = SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_VALUE_PROFIT);
  if(tickValue <= 0.0)
    tickValue = SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_VALUE);

  if(price <= 0.0 || tickSize <= 0.0 || tickValue <= 0.0)
    return false;

  double baseEquity = g_baselineEquity;
  if(baseEquity <= 0.0)
    baseEquity = AccountInfoDouble(ACCOUNT_BALANCE);
  equityPerSymbol = baseEquity;

  double baseLot = equityPerSymbol * tickSize / (price * tickValue);
  double multiplier = GetAssetMultiplier(assetClass);
  targetLot = baseLot * multiplier;
  if(targetLot <= 0.0)
    return false;

  marginRequired = CalculateMarginRequired(symbol, targetLot);
  finalLot = NormalizeVolume(symbol, targetLot);
  if(finalLot <= 0.0)
    return false;

  if(targetLot > 0.0)
    deviationPct = (finalLot - targetLot) / targetLot * 100.0;
  return true;
}

double ComputeMove1PctUsd(const string symbol, double lots)
{
  if(lots <= 0.0)
    return 0.0;
  double price = SymbolInfoDouble(symbol, SYMBOL_BID);
  if(price <= 0.0)
    price = SymbolInfoDouble(symbol, SYMBOL_ASK);
  if(price <= 0.0)
    price = SymbolInfoDouble(symbol, SYMBOL_LAST);
  double tickSize = SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_SIZE);
  double tickValue = SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_VALUE_PROFIT);
  if(tickValue <= 0.0)
    tickValue = SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_VALUE);
  if(price <= 0.0 || tickSize <= 0.0 || tickValue <= 0.0)
    return 0.0;
  double ticks = (price * 0.01) / tickSize;
  return ticks * tickValue * lots;
}

bool ShouldLogSizing(const string symbol, int cooldownSeconds)
{
  string key = "Limni_Size_" + symbol;
  datetime now = TimeCurrent();
  if(GlobalVariableCheck(key))
  {
    datetime last = (datetime)GlobalVariableGet(key);
    if(last > 0 && (now - last) < cooldownSeconds)
      return false;
  }
  GlobalVariableSet(key, (double)now);
  return true;
}

void LogSizing(const string symbol, double targetLot, double finalLot,
               double deviationPct, double equityPerSymbol, double marginRequired)
{
  Log(StringFormat("Sizing %s target=%.4f final=%.4f dev=%+.2f%% slice=%.2f margin=%.2f",
                   symbol, targetLot, finalLot, deviationPct, equityPerSymbol, marginRequired));
}

double GetAssetMultiplier(const string assetClass)
{
  string normalized = assetClass;
  StringToLower(normalized);
  if(normalized == "crypto")
    return CryptoLotMultiplier;
  if(normalized == "commodities")
    return CommoditiesLotMultiplier;
  if(normalized == "indices")
    return IndicesLotMultiplier;
  return FxLotMultiplier;
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

bool HasPositionForModel(const string symbol, const string model)
{
  int count = PositionsTotal();
  string tag = "LimniBasket " + model;
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
    string comment = PositionGetString(POSITION_COMMENT);
    if(StringFind(comment, tag) >= 0)
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
      g_baselineEquity = AccountInfoDouble(ACCOUNT_BALANCE);
      g_lockedProfitPct = 0.0;
      g_trailingActive = false;
      g_closeRequested = false;
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
  if(ManualMode)
    return;
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
  double profitUsd = equity - g_baselineEquity;
  bool wasTrailing = g_trailingActive;

  bool basketTpHitPct = (EnableBasketTakeProfit && BasketTakeProfitPct > 0.0 && profitPct >= BasketTakeProfitPct);
  bool basketTpHitUsd = (EnableBasketTakeProfit && BasketTakeProfitUsd > 0.0 && profitUsd >= BasketTakeProfitUsd);
  if((basketTpHitPct || basketTpHitUsd) && !g_closeRequested)
  {
    g_closeRequested = true;
    SaveState();
    Log(StringFormat("Basket TP hit (pnl=%.2f%% / %.2f USD). Closing all positions.", profitPct, profitUsd));
    CloseAllPositions();
    return;
  }

  if(EnableEquityTrail && profitPct >= EquityTrailStartPct)
  {
    g_trailingActive = true;
    if(!wasTrailing)
      Log(StringFormat("Equity trail activated at %.2f%%", profitPct));

    double peakProfitPct = (g_weekPeakEquity - g_baselineEquity) / g_baselineEquity * 100.0;
    double newLocked = peakProfitPct - EquityTrailOffsetPct;
    if(newLocked > g_lockedProfitPct)
    {
      g_lockedProfitPct = newLocked;
      SaveState();
      Log(StringFormat("Equity trail lock updated: %.2f%%", g_lockedProfitPct));
    }
  }
  if(!EnableEquityTrail)
  {
    g_trailingActive = false;
    g_lockedProfitPct = 0.0;
  }

  if(g_trailingActive && g_lockedProfitPct > 0.0 && profitPct <= g_lockedProfitPct)
  {
    g_closeRequested = true;
    SaveState();
    Log(StringFormat("Equity trail hit %.2f%%. Closing all positions and pausing.", g_lockedProfitPct));
    CloseAllPositions();
  }
}
//+------------------------------------------------------------------+
void TryAddPositions()
{
  if(ManualMode)
    return;
  if(!g_apiOk || !g_tradingAllowed || g_closeRequested)
    return;

  double cap = GetBasketLotCap();
  double totalLots = GetTotalBasketLots();
  datetime nowGmt = TimeGMT();
  datetime cryptoStartGmt = GetCryptoWeekStartGmt(nowGmt);
  int openPositions = CountOpenPositions();

  if(openPositions >= MaxOpenPositions)
  {
    AddSkipReason("max_positions");
    LogIndexSkipsForAll("max open positions reached", "max_positions");
    return;
  }

  if(totalLots >= cap)
  {
    AddSkipReason("lot_cap");
    LogIndexSkipsForAll("basket lot cap reached", "lot_cap");
    return;
  }

  if(OrdersInLastMinute() >= MaxOrdersPerMinute)
  {
    AddSkipReason("rate_limit");
    LogIndexSkipsForAll("order rate limit reached", "rate_limit");
    LogTradeError("Order rate limit reached. Skipping adds.");
    return;
  }

  for(int i = 0; i < ArraySize(g_brokerSymbols); i++)
  {
    string symbol = g_brokerSymbols[i];
    int direction = g_directions[i];
    if(symbol == "" || direction == 0)
      continue;

    string model = (i < ArraySize(g_models) ? g_models[i] : "blended");
    if(HasPositionForModel(symbol, model))
    {
      AddSkipReason("duplicate_open");
      continue;
    }

    string assetClass = (i < ArraySize(g_assetClasses) ? g_assetClasses[i] : "fx");
    string normalizedClass = assetClass;
    StringToLower(normalizedClass);
    if(normalizedClass == "crypto" && nowGmt < cryptoStartGmt)
    {
      AddSkipReason("crypto_not_open");
      continue;
    }
    if(!IsTradableSymbol(symbol))
    {
      AddSkipReason("not_tradable");
      int tradeMode = (int)SymbolInfoInteger(symbol, SYMBOL_TRADE_MODE);
      if(IsIndexSymbol(symbol))
        LogIndexSkip(symbol, StringFormat("not tradable (trade_mode=%d)", tradeMode), "not_tradable");
      LogTradeError(StringFormat("%s not tradable - trade_mode=%d (need FULL=4)", symbol, tradeMode));
      continue;
    }
    double targetLot = 0.0;
    double finalLot = 0.0;
    double deviationPct = 0.0;
    double equityPerSymbol = 0.0;
    double marginRequired = 0.0;
    bool ok = ComputeOneToOneLot(symbol, assetClass, targetLot, finalLot,
                                 deviationPct, equityPerSymbol, marginRequired);
    if(ok)
      ApplyRiskScale(symbol, GetLegRiskScale(), targetLot, finalLot, deviationPct, equityPerSymbol, marginRequired);
    double vol = finalLot;
    if(vol <= 0.0)
    {
      AddSkipReason("invalid_volume");
      if(IsIndexSymbol(symbol))
        LogIndexSkip(symbol, StringFormat("invalid volume %.2f", vol), "invalid_volume");
      LogTradeError(StringFormat("%s invalid volume=%.2f", symbol, vol));
      continue;
    }
    if((totalLots + vol) > cap)
    {
      AddSkipReason("lot_cap");
      LogTradeError(StringFormat("Lot cap reached %.2f/%.2f. Skipping %s %.2f lots.",
                                 totalLots, cap, symbol, vol));
      continue;
    }
    if(openPositions >= MaxOpenPositions)
    {
      AddSkipReason("max_positions");
      LogTradeError(StringFormat("Max open positions reached %d. Stopping adds.", MaxOpenPositions));
      break;
    }
    if(OrdersInLastMinute() >= MaxOrdersPerMinute)
    {
      AddSkipReason("rate_limit");
      LogTradeError(StringFormat("Order rate limit reached %d/min. Stopping adds.", MaxOrdersPerMinute));
      break;
    }
    if(LogSizingDetails && ok && ShouldLogSizing(symbol, SizingLogCooldownSeconds))
    {
      if(MathAbs(deviationPct) >= SizingLogDeviationThresholdPct)
        LogSizing(symbol, targetLot, finalLot, deviationPct, equityPerSymbol, marginRequired);
    }

    if(!PlaceOrder(symbol, direction, vol, model))
    {
      AddSkipReason("order_failed");
      if(IsIndexSymbol(symbol))
        LogIndexSkip(symbol, "order send failed", "order_failed");
      continue;
    }

    totalLots += vol;
    openPositions++;
    MarkOrderTimestamp();
  }
}

//+------------------------------------------------------------------+
bool PlaceOrder(const string symbol, int direction, double volume, const string model)
{
  double price = direction > 0 ? SymbolInfoDouble(symbol, SYMBOL_ASK)
                               : SymbolInfoDouble(symbol, SYMBOL_BID);
  double stopLoss = 0.0;
  if(EnforceStopLoss)
  {
    if(!CalculateRiskStopLoss(symbol, direction, volume, price, stopLoss))
    {
      LogTradeError(StringFormat("Order blocked %s %s vol=%.2f (unable to set compliant SL)",
                                 symbol, DirectionToString(direction), volume));
      return false;
    }
  }

  string comment = "LimniBasket " + model + " " + g_reportDate;
  bool result = false;
  if(direction > 0)
    result = g_trade.Buy(volume, symbol, price, stopLoss, 0.0, comment);
  else
    result = g_trade.Sell(volume, symbol, price, stopLoss, 0.0, comment);

  if(!result)
  {
    int errorCode = GetLastError();
    LogTradeError(StringFormat("Order failed %s %s vol=%.2f code=%d",
                               symbol, DirectionToString(direction), volume, errorCode));
    return false;
  }
  return true;
}

bool CalculateRiskStopLoss(const string symbol, int direction, double volume, double entryPrice, double &stopLoss)
{
  stopLoss = 0.0;
  if(direction == 0 || volume <= 0.0 || entryPrice <= 0.0)
    return false;

  double balance = AccountInfoDouble(ACCOUNT_BALANCE);
  if(balance <= 0.0)
    return false;

  double maxRiskPct = MaxStopLossRiskPct;
  if(maxRiskPct <= 0.0)
    maxRiskPct = 2.0;
  double requestedRiskPct = StopLossRiskPct;
  if(requestedRiskPct <= 0.0)
    return false;
  if(requestedRiskPct > maxRiskPct)
    requestedRiskPct = maxRiskPct;

  double tickSize = SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_SIZE);
  double tickValue = SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_VALUE_PROFIT);
  if(tickValue <= 0.0)
    tickValue = SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_VALUE);
  if(tickSize <= 0.0 || tickValue <= 0.0)
    return false;

  double point = SymbolInfoDouble(symbol, SYMBOL_POINT);
  int stopLevelPts = (int)SymbolInfoInteger(symbol, SYMBOL_TRADE_STOPS_LEVEL);
  double minDistance = 0.0;
  if(point > 0.0 && stopLevelPts > 0)
    minDistance = point * stopLevelPts;

  double riskUsd = balance * requestedRiskPct / 100.0;
  if(riskUsd <= 0.0)
    return false;

  double maxAllowedUsd = balance * maxRiskPct / 100.0;
  double priceDistance = (riskUsd / (tickValue * volume)) * tickSize;
  if(priceDistance <= 0.0)
    return false;

  if(priceDistance < minDistance)
    priceDistance = minDistance;

  int digits = (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);
  for(int attempt = 0; attempt < 3; attempt++)
  {
    double rawStop = (direction > 0) ? (entryPrice - priceDistance)
                                     : (entryPrice + priceDistance);
    stopLoss = NormalizeDouble(rawStop, digits);
    if((direction > 0 && stopLoss >= entryPrice) || (direction < 0 && stopLoss <= entryPrice))
      return false;

    double actualRisk = EstimatePositionRiskUsd(symbol, direction, volume, entryPrice, stopLoss);
    if(actualRisk < 0.0)
      return false;
    if(actualRisk <= maxAllowedUsd * 1.001)
      return true;

    double adjust = maxAllowedUsd / actualRisk;
    if(adjust <= 0.0 || adjust >= 1.0)
      return false;
    priceDistance *= (adjust * 0.995);
    if(priceDistance < minDistance)
    {
      priceDistance = minDistance;
      break;
    }
  }

  double rawFinalStop = (direction > 0) ? (entryPrice - priceDistance)
                                        : (entryPrice + priceDistance);
  stopLoss = NormalizeDouble(rawFinalStop, digits);
  double finalRisk = EstimatePositionRiskUsd(symbol, direction, volume, entryPrice, stopLoss);
  if(finalRisk < 0.0)
    return false;
  return (finalRisk <= maxAllowedUsd * 1.001);
}

double EstimatePositionRiskUsd(const string symbol, int direction, double volume, double entryPrice, double stopLoss)
{
  ENUM_ORDER_TYPE type = (direction > 0 ? ORDER_TYPE_BUY : ORDER_TYPE_SELL);
  double pnl = 0.0;
  if(!OrderCalcProfit(type, symbol, volume, entryPrice, stopLoss, pnl))
    return -1.0;
  if(pnl >= 0.0)
    return 0.0;
  return -pnl;
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

// Crypto week starts at Sunday 19:00 ET, aligned with FX session open.
datetime GetCryptoWeekStartGmt(datetime nowGmt)
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
      if(GlobalVariableCheck(GV_WEEK_PEAK))
        g_weekPeakEquity = GlobalVariableGet(GV_WEEK_PEAK);
      if(GlobalVariableCheck(GV_MAX_DD))
        g_maxDrawdownPct = GlobalVariableGet(GV_MAX_DD);
      if(GlobalVariableCheck(GV_LAST_PUSH))
        g_lastPush = (datetime)GlobalVariableGet(GV_LAST_PUSH);
      return;
    }
  }

  g_state = STATE_IDLE;
  g_baselineEquity = 0.0;
  g_lockedProfitPct = 0.0;
  g_trailingActive = false;
  g_closeRequested = false;
  g_weekPeakEquity = 0.0;
  g_maxDrawdownPct = 0.0;
  if(GlobalVariableCheck(GV_LAST_PUSH))
    g_lastPush = (datetime)GlobalVariableGet(GV_LAST_PUSH);
  else
    g_lastPush = 0;
}

void SaveState()
{
  GlobalVariableSet(GV_WEEK_START, (double)g_weekStartGmt);
  GlobalVariableSet(GV_STATE, (double)g_state);
  GlobalVariableSet(GV_BASELINE, g_baselineEquity);
  GlobalVariableSet(GV_LOCKED, g_lockedProfitPct);
  GlobalVariableSet(GV_TRAIL, g_trailingActive ? 1.0 : 0.0);
  GlobalVariableSet(GV_CLOSE, g_closeRequested ? 1.0 : 0.0);
  GlobalVariableSet(GV_WEEK_PEAK, g_weekPeakEquity);
  GlobalVariableSet(GV_MAX_DD, g_maxDrawdownPct);
  GlobalVariableSet(GV_LAST_PUSH, (double)g_lastPush);
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
  string models[];
  string assetClasses[];
  if(ParseApiResponse(json, allowed, reportDate, symbols, dirs, models, assetClasses))
  {
    g_apiOk = true;
    g_tradingAllowed = allowed;
    g_reportDate = reportDate;
    g_lastApiSuccess = TimeCurrent();
    g_loadedFromCache = true;
    int count = ArraySize(symbols);
    ArrayResize(g_apiSymbols, count);
    ArrayResize(g_directions, count);
    ArrayResize(g_brokerSymbols, count);
    ArrayResize(g_models, count);
    ArrayResize(g_assetClasses, count);
    for(int i = 0; i < count; i++)
    {
      string resolved = "";
      g_apiSymbols[i] = symbols[i];
      g_directions[i] = dirs[i];
      g_models[i] = (i < ArraySize(models) ? models[i] : "blended");
      g_assetClasses[i] = (i < ArraySize(assetClasses) ? assetClasses[i] : "fx");
      if(ResolveSymbol(symbols[i], resolved))
        g_brokerSymbols[i] = resolved;
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

void ResetState()
{
  g_state = STATE_IDLE;
  g_baselineEquity = 0.0;
  g_lockedProfitPct = 0.0;
  g_trailingActive = false;
  g_closeRequested = false;
  g_weekPeakEquity = 0.0;
  g_maxDrawdownPct = 0.0;
  g_lastApiSuccess = 0;
  g_loadedFromCache = false;
  g_reportDate = "";
  g_tradingAllowed = false;
  g_apiOk = false;
  g_lastApiError = "";
  g_lastApiErrorTime = 0;

  GlobalVariableDel(GV_WEEK_START);
  GlobalVariableDel(GV_STATE);
  GlobalVariableDel(GV_BASELINE);
  GlobalVariableDel(GV_LOCKED);
  GlobalVariableDel(GV_TRAIL);
  GlobalVariableDel(GV_CLOSE);
  GlobalVariableDel(GV_WEEK_PEAK);
  GlobalVariableDel(GV_MAX_DD);

  FileDelete(CACHE_FILE, FILE_COMMON);
  Log("State reset on init.");
}

void Log(const string message)
{
  string timestamped = TimeToString(TimeCurrent(), TIME_DATE | TIME_SECONDS) + " | " + message;
  Print(timestamped);

  // Add to circular buffer for website push
  g_logBuffer[g_logBufferIndex] = timestamped;
  g_logBufferIndex = (g_logBufferIndex + 1) % 100;
}

void LogTradeError(const string message)
{
  Log("TRADE ERROR: " + message);
}

bool ShouldLogIndexSkip(const string symbol, const string reasonKey, int cooldownSeconds)
{
  string key = "Limni_Skip_" + symbol + "_" + reasonKey;
  datetime now = TimeCurrent();
  if(GlobalVariableCheck(key))
  {
    datetime last = (datetime)GlobalVariableGet(key);
    if(last > 0 && (now - last) < cooldownSeconds)
      return false;
  }
  GlobalVariableSet(key, (double)now);
  return true;
}

void LogIndexSkip(const string symbol, const string reason, const string reasonKey)
{
  if(!IsIndexSymbol(symbol))
    return;
  if(!ShouldLogIndexSkip(symbol, reasonKey, 300))
    return;
  LogTradeError(StringFormat("Index %s skipped: %s", symbol, reason));
}

void LogIndexSkipsForAll(const string reason, const string reasonKey)
{
  for(int i = 0; i < ArraySize(g_brokerSymbols); i++)
  {
    string symbol = g_brokerSymbols[i];
    if(symbol == "")
      continue;
    if(IsIndexSymbol(symbol))
      LogIndexSkip(symbol, reason, reasonKey);
  }
}

void LogMissingIndexPairs(const string &symbols[])
{
  bool hasSpx = false;
  bool hasNdx = false;
  bool hasNikkei = false;

  for(int i = 0; i < ArraySize(symbols); i++)
  {
    string sym = symbols[i];
    StringToUpper(sym);
    string key = NormalizeSymbolKey(sym);
    if(StringFind(key, "SPX") >= 0 ||
       StringFind(key, "SP500") >= 0 ||
       StringFind(key, "SPX500") >= 0 ||
       StringFind(key, "US500") >= 0)
      hasSpx = true;
    if(StringFind(key, "NDX") >= 0 ||
       StringFind(key, "NDX100") >= 0 ||
       StringFind(key, "NAS100") >= 0 ||
       StringFind(key, "US100") >= 0)
      hasNdx = true;
    if(StringFind(key, "NIKKEI") >= 0 ||
       StringFind(key, "NIKKEI225") >= 0 ||
       StringFind(key, "NIK225") >= 0 ||
       StringFind(key, "JPN225") >= 0 ||
       StringFind(key, "JP225") >= 0)
      hasNikkei = true;
  }

  if(!hasSpx)
    LogTradeError("Index pair SPX missing from API response.");
  if(!hasNdx)
    LogTradeError("Index pair NDX missing from API response.");
  if(!hasNikkei)
    LogTradeError("Index pair NIKKEI missing from API response.");
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

  DestroyDashboard();

  g_dashWidth = MathMax(DashboardWidth, 1100);
  g_dashLineHeight = MathMax(DashboardLineHeight, 30);
  g_dashPadding = MathMax(DashboardPadding, 20);
  g_dashFontSize = MathMax(DashboardFontSize, 16);
  g_dashTitleSize = MathMax(DashboardTitleSize, 20);
  g_dashAccentWidth = MathMax(DashboardAccentWidth, 10);
  g_dashShadowOffset = MathMax(DashboardShadowOffset, 6);
  g_dashColumnGap = MathMax(DashboardColumnGap, 12);

  const int lineCount = 20;
  const int mapLines = MathMax(6, LotMapMaxLines);
  ArrayResize(g_dashboardLines, lineCount);
  for(int i = 0; i < lineCount; i++)
    g_dashboardLines[i] = StringFormat("LimniDash_line_%d", i);
  ArrayResize(g_dashboardRightLines, mapLines);
  for(int i = 0; i < mapLines; i++)
    g_dashboardRightLines[i] = StringFormat("LimniDash_map_%d", i);

  int headerHeight = g_dashLineHeight + 12;
  int rows = lineCount > mapLines ? lineCount : mapLines;
  int height = g_dashPadding * 2 + headerHeight + rows * g_dashLineHeight;
  int accentWidth = g_dashAccentWidth;
  int contentX = DashboardX + g_dashPadding + accentWidth;
  int contentWidth = g_dashWidth - (g_dashPadding * 2) - accentWidth;
  g_dashLeftWidth = (contentWidth - g_dashColumnGap) * 2 / 3;
  if(g_dashLeftWidth < 520)
    g_dashLeftWidth = 520;
  g_dashRightWidth = contentWidth - g_dashLeftWidth - g_dashColumnGap;
  if(g_dashRightWidth < 240)
  {
    g_dashRightWidth = 240;
    g_dashLeftWidth = contentWidth - g_dashRightWidth - g_dashColumnGap;
  }
  g_dashLeftX = contentX;
  g_dashRightX = contentX + g_dashLeftWidth + g_dashColumnGap;

  if(ObjectFind(0, DASH_SHADOW) < 0)
  {
    ObjectCreate(0, DASH_SHADOW, OBJ_RECTANGLE_LABEL, 0, 0, 0);
    ObjectSetInteger(0, DASH_SHADOW, OBJPROP_CORNER, DashboardCorner);
    ObjectSetInteger(0, DASH_SHADOW, OBJPROP_XDISTANCE, DashboardX + g_dashShadowOffset);
    ObjectSetInteger(0, DASH_SHADOW, OBJPROP_YDISTANCE, DashboardY + g_dashShadowOffset);
    ObjectSetInteger(0, DASH_SHADOW, OBJPROP_XSIZE, g_dashWidth);
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
    ObjectSetInteger(0, DASH_BG, OBJPROP_XSIZE, g_dashWidth);
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
    ObjectSetInteger(0, DASH_DIVIDER, OBJPROP_XDISTANCE, g_dashLeftX);
    ObjectSetInteger(0, DASH_DIVIDER, OBJPROP_YDISTANCE, DashboardY + g_dashPadding + headerHeight - 6);
    ObjectSetInteger(0, DASH_DIVIDER, OBJPROP_XSIZE, g_dashLeftWidth);
    ObjectSetInteger(0, DASH_DIVIDER, OBJPROP_YSIZE, 1);
    ObjectSetInteger(0, DASH_DIVIDER, OBJPROP_COLOR, C'226,232,240');
    ObjectSetInteger(0, DASH_DIVIDER, OBJPROP_BGCOLOR, C'226,232,240');
    ObjectSetInteger(0, DASH_DIVIDER, OBJPROP_BORDER_TYPE, BORDER_FLAT);
    ObjectSetInteger(0, DASH_DIVIDER, OBJPROP_BACK, false);
    ObjectSetInteger(0, DASH_DIVIDER, OBJPROP_SELECTABLE, false);
    ObjectSetInteger(0, DASH_DIVIDER, OBJPROP_HIDDEN, true);
  }

  if(ObjectFind(0, DASH_COL_DIVIDER) < 0)
  {
    ObjectCreate(0, DASH_COL_DIVIDER, OBJ_RECTANGLE_LABEL, 0, 0, 0);
    ObjectSetInteger(0, DASH_COL_DIVIDER, OBJPROP_CORNER, DashboardCorner);
    ObjectSetInteger(0, DASH_COL_DIVIDER, OBJPROP_XDISTANCE, g_dashRightX - (g_dashColumnGap / 2));
    ObjectSetInteger(0, DASH_COL_DIVIDER, OBJPROP_YDISTANCE, DashboardY + g_dashPadding + headerHeight - 6);
    ObjectSetInteger(0, DASH_COL_DIVIDER, OBJPROP_XSIZE, 1);
    ObjectSetInteger(0, DASH_COL_DIVIDER, OBJPROP_YSIZE, height - headerHeight);
    ObjectSetInteger(0, DASH_COL_DIVIDER, OBJPROP_COLOR, C'226,232,240');
    ObjectSetInteger(0, DASH_COL_DIVIDER, OBJPROP_BGCOLOR, C'226,232,240');
    ObjectSetInteger(0, DASH_COL_DIVIDER, OBJPROP_BORDER_TYPE, BORDER_FLAT);
    ObjectSetInteger(0, DASH_COL_DIVIDER, OBJPROP_BACK, false);
    ObjectSetInteger(0, DASH_COL_DIVIDER, OBJPROP_SELECTABLE, false);
    ObjectSetInteger(0, DASH_COL_DIVIDER, OBJPROP_HIDDEN, true);
  }

  if(ObjectFind(0, DASH_TITLE) < 0)
  {
    ObjectCreate(0, DASH_TITLE, OBJ_LABEL, 0, 0, 0);
    ObjectSetInteger(0, DASH_TITLE, OBJPROP_CORNER, DashboardCorner);
    ObjectSetInteger(0, DASH_TITLE, OBJPROP_XDISTANCE, g_dashLeftX);
    ObjectSetInteger(0, DASH_TITLE, OBJPROP_YDISTANCE, DashboardY + g_dashPadding + 1);
    ObjectSetInteger(0, DASH_TITLE, OBJPROP_FONTSIZE, g_dashTitleSize);
    ObjectSetString(0, DASH_TITLE, OBJPROP_FONT, "Segoe UI Semibold");
    ObjectSetInteger(0, DASH_TITLE, OBJPROP_SELECTABLE, false);
    ObjectSetInteger(0, DASH_TITLE, OBJPROP_HIDDEN, true);
  }

  if(ObjectFind(0, DASH_MAP_TITLE) < 0)
  {
    ObjectCreate(0, DASH_MAP_TITLE, OBJ_LABEL, 0, 0, 0);
    ObjectSetInteger(0, DASH_MAP_TITLE, OBJPROP_CORNER, DashboardCorner);
    ObjectSetInteger(0, DASH_MAP_TITLE, OBJPROP_XDISTANCE, g_dashRightX);
    ObjectSetInteger(0, DASH_MAP_TITLE, OBJPROP_YDISTANCE, DashboardY + g_dashPadding + 1);
    ObjectSetInteger(0, DASH_MAP_TITLE, OBJPROP_FONTSIZE, g_dashTitleSize - 2);
    ObjectSetString(0, DASH_MAP_TITLE, OBJPROP_FONT, "Segoe UI Semibold");
    ObjectSetInteger(0, DASH_MAP_TITLE, OBJPROP_SELECTABLE, false);
    ObjectSetInteger(0, DASH_MAP_TITLE, OBJPROP_HIDDEN, true);
  }

  for(int i = 0; i < lineCount; i++)
  {
    const string name = g_dashboardLines[i];
    if(ObjectFind(0, name) >= 0)
      continue;
    ObjectCreate(0, name, OBJ_LABEL, 0, 0, 0);
    ObjectSetInteger(0, name, OBJPROP_CORNER, DashboardCorner);
    ObjectSetInteger(0, name, OBJPROP_XDISTANCE, g_dashLeftX);
    ObjectSetInteger(
      0,
      name,
      OBJPROP_YDISTANCE,
      DashboardY + g_dashPadding + headerHeight + i * g_dashLineHeight
    );
    ObjectSetInteger(0, name, OBJPROP_FONTSIZE, g_dashFontSize);
    ObjectSetString(0, name, OBJPROP_FONT, "Segoe UI");
    ObjectSetInteger(0, name, OBJPROP_SELECTABLE, false);
    ObjectSetInteger(0, name, OBJPROP_HIDDEN, true);
  }

  for(int i = 0; i < mapLines; i++)
  {
    const string name = g_dashboardRightLines[i];
    if(ObjectFind(0, name) >= 0)
      continue;
    ObjectCreate(0, name, OBJ_LABEL, 0, 0, 0);
    ObjectSetInteger(0, name, OBJPROP_CORNER, DashboardCorner);
    ObjectSetInteger(0, name, OBJPROP_XDISTANCE, g_dashRightX);
    ObjectSetInteger(
      0,
      name,
      OBJPROP_YDISTANCE,
      DashboardY + g_dashPadding + headerHeight + i * g_dashLineHeight
    );
    ObjectSetInteger(0, name, OBJPROP_FONTSIZE, g_dashFontSize);
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
  ObjectDelete(0, DASH_SHADOW);
  ObjectDelete(0, DASH_BG);
  ObjectDelete(0, DASH_ACCENT);
  ObjectDelete(0, DASH_DIVIDER);
  ObjectDelete(0, DASH_COL_DIVIDER);
  ObjectDelete(0, DASH_TITLE);
  ObjectDelete(0, DASH_MAP_TITLE);
  for(int i = 0; i < ArraySize(g_dashboardLines); i++)
    ObjectDelete(0, g_dashboardLines[i]);
  for(int i = 0; i < ArraySize(g_dashboardRightLines); i++)
    ObjectDelete(0, g_dashboardRightLines[i]);
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

  string apiLine = StringFormat("API: %s  |  Allowed: %s",
                                g_apiOk ? "OK" : "Fail",
                                g_tradingAllowed ? "Yes" : "No");
  color apiColor = badColor;
  if(g_apiOk && g_tradingAllowed)
    apiColor = goodColor;
  else if(g_apiOk)
    apiColor = warnColor;

  string urlLine = "URL: " + CompactText(BuildApiUrl(), DashboardUrlMaxLen);
  string reportText = (g_reportDate == "" ? "--" : g_reportDate);
  string cacheLine = g_loadedFromCache ? "Cache: Yes" : "Cache: No";
  if(g_lastApiSuccess > 0)
  {
    int age = (int)(now - g_lastApiSuccess);
    cacheLine = StringFormat("Last API: %s ago", FormatDuration(age));
    if(g_loadedFromCache)
      cacheLine += " (cache)";
  }

  string weekLine = StringFormat("Week start: %s  |  Asset: %s",
                                 FormatTimeValue(g_weekStartGmt),
                                 AssetFilter == "" ? "--" : AssetFilter);
  string pairsLine = StringFormat("Pairs: %d  |  Open pairs: %d", totalPairs, openPairs);
  string positionLine = StringFormat("Positions: %d  |  Lots: %.2f  |  Orders/min: %d",
                                     openPositions, totalLots, OrdersInLastMinute());
  string equityLine = StringFormat("Equity: %.2f  |  Balance: %.2f  |  Free: %.2f",
                                   AccountInfoDouble(ACCOUNT_EQUITY),
                                   AccountInfoDouble(ACCOUNT_BALANCE),
                                   AccountInfoDouble(ACCOUNT_MARGIN_FREE));

  string pnlText = "--";
  double pnlPct = 0.0;
  color pnlColor = dimColor;
  if(g_baselineEquity > 0.0)
  {
    pnlPct = (AccountInfoDouble(ACCOUNT_EQUITY) - g_baselineEquity) / g_baselineEquity * 100.0;
    pnlText = StringFormat("%+.2f%%", pnlPct);
    pnlColor = (pnlPct >= 0.0 ? goodColor : badColor);
  }
  string trailText = g_trailingActive ? "On" : "Off";
  string pnlLine = StringFormat("PnL: %s  |  Locked: %.2f%%  |  Trail: %s", pnlText, g_lockedProfitPct, trailText);

  string ddLine = StringFormat("Max DD: %.2f%%", g_maxDrawdownPct);
  color ddColor = (g_maxDrawdownPct <= 0.0 ? goodColor : badColor);

  double baseEquity = g_baselineEquity > 0.0 ? g_baselineEquity : AccountInfoDouble(ACCOUNT_BALANCE);
  double legScale = GetLegRiskScale();
  string lotLine = StringFormat("Sizing: 1:1 x %.2f (%s)  |  Base: %.2f", legScale, RiskModeToString(), baseEquity);
  string multLine = StringFormat("Mult: FX %.2f  Crypto %.2f  Cmds %.2f  Ind %.2f",
                                 FxLotMultiplier, CryptoLotMultiplier, CommoditiesLotMultiplier, IndicesLotMultiplier);

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

  double capLots = GetBasketLotCap();
  string modelLine = StringFormat("Models: A %d  B %d  D %d  C %d  S %d",
                                  CountSignalsByModel("antikythera"),
                                  CountSignalsByModel("blended"),
                                  CountSignalsByModel("dealer"),
                                  CountSignalsByModel("commercial"),
                                  CountSignalsByModel("sentiment"));
  string capLine = StringFormat("Lot cap: %.2f  |  Total lots: %.2f", capLots, totalLots);
  string peakLine = g_weekPeakEquity > 0.0
                      ? StringFormat("Peak equity: %.2f", g_weekPeakEquity)
                      : "Peak equity: --";

  color headingColor = C'15,118,110';

  SetLabelText(DASH_TITLE, "Limni Basket EA", C'15,23,42');
  SetLabelText(DASH_MAP_TITLE, "LOT MAP", headingColor);
  SetLabelText(g_dashboardLines[0], "SYSTEM", headingColor);
  SetLabelText(g_dashboardLines[1], StringFormat("State: %s  |  Trading: %s", stateText, g_tradingAllowed ? "Allowed" : "Blocked"), stateColor);
  SetLabelText(g_dashboardLines[2], apiLine, apiColor);
  SetLabelText(g_dashboardLines[3], urlLine, dimColor);
  SetLabelText(g_dashboardLines[4], cacheLine, dimColor);
  SetLabelText(g_dashboardLines[5], StringFormat("Report: %s", reportText), dimColor);
  SetLabelText(g_dashboardLines[6], weekLine, dimColor);

  SetLabelText(g_dashboardLines[7], "POSITIONS", headingColor);
  SetLabelText(g_dashboardLines[8], pairsLine, textColor);
  SetLabelText(g_dashboardLines[9], positionLine, textColor);
  SetLabelText(g_dashboardLines[10], capLine, textColor);
  SetLabelText(g_dashboardLines[11], modelLine, dimColor);

  SetLabelText(g_dashboardLines[12], "ACCOUNT", headingColor);
  SetLabelText(g_dashboardLines[13], equityLine, textColor);
  SetLabelText(g_dashboardLines[14], pnlLine, pnlColor);
  SetLabelText(g_dashboardLines[15], ddLine + "  |  " + peakLine, ddColor);

  SetLabelText(g_dashboardLines[16], "SIZING", headingColor);
  SetLabelText(g_dashboardLines[17], lotLine, dimColor);
  SetLabelText(g_dashboardLines[18], multLine, dimColor);
  SetLabelText(g_dashboardLines[19], pollLine + "  |  " + errorLine, errorColor);

  int mapCount = ArraySize(g_dashboardRightLines);
  int totalSymbols = ArraySize(g_brokerSymbols);
  bool hasOverflow = (totalSymbols > mapCount);
  int displayCount = totalSymbols;
  if(hasOverflow && mapCount > 1)
    displayCount = mapCount - 1;
  else
    displayCount = MathMin(displayCount, mapCount);

  for(int i = 0; i < mapCount; i++)
  {
    if(i < displayCount)
    {
      string symbol = g_brokerSymbols[i];
      if(symbol == "")
      {
        SetLabelText(g_dashboardRightLines[i], "--", dimColor);
        continue;
      }
      string assetClass = (i < ArraySize(g_assetClasses) ? g_assetClasses[i] : "fx");
      double lot = GetLotForSymbol(symbol, assetClass);
      SetLabelText(g_dashboardRightLines[i],
                   StringFormat("%-10s  %s  %.2f", symbol, CompactText(assetClass, 8), lot),
                   textColor);
    }
    else if(i == mapCount - 1 && hasOverflow)
    {
      int remaining = totalSymbols - displayCount;
      SetLabelText(g_dashboardRightLines[i], StringFormat("... +%d more", remaining), dimColor);
    }
    else
    {
      SetLabelText(g_dashboardRightLines[i], " ", dimColor);
    }
  }
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

string CompactText(const string value, int maxLen)
{
  if(maxLen <= 3)
    return value;
  int len = StringLen(value);
  if(len <= maxLen)
    return value;
  return StringSubstr(value, 0, maxLen - 3) + "...";
}

string EnsureTrailingSlash(const string url)
{
  int qpos = StringFind(url, "?");
  string base = url;
  string query = "";
  if(qpos >= 0)
  {
    base = StringSubstr(url, 0, qpos);
    query = StringSubstr(url, qpos);
  }
  if(StringLen(base) > 0 && StringSubstr(base, StringLen(base) - 1, 1) != "/")
    base += "/";
  return base + query;
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

int CountSignalsByModel(const string model)
{
  int count = 0;
  for(int i = 0; i < ArraySize(g_models); i++)
  {
    if(g_models[i] == model)
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
void RunReconstructionIfNeeded()
{
  if(!EnableReconnectReconstruction)
    return;

  datetime lastPushUtc = 0;
  if(GlobalVariableCheck(GV_LAST_PUSH))
    lastPushUtc = (datetime)GlobalVariableGet(GV_LAST_PUSH);
  if(lastPushUtc <= 0)
    return;

  datetime nowUtc = TimeGMT();
  if(nowUtc <= lastPushUtc)
    return;

  int offlineSeconds = (int)(nowUtc - lastPushUtc);
  if(offlineSeconds < ReconstructIfOfflineMinutes * 60)
    return;

  HRSettings settings;
  HR_DefaultSettings(settings);
  settings.maxDays = ReconstructionMaxDays;
  settings.timeoutSeconds = ReconstructionTimeoutSeconds;
  settings.maxCandlesPerSymbol = ReconstructionMaxCandlesPerSymbol;
  settings.timeframe = PERIOD_M5;
  settings.includeMagicOnly = true;
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
    SaveState();
    Log(StringFormat(
      "Reconstruction complete (%s). offline=%d sec symbols=%d trades=%d realized=%.2f",
      g_reconstructionStatus,
      offlineSeconds,
      outcome.symbolsProcessed,
      reconstructedTrades,
      reconstructedPnl
    ));
  }
  else
  {
    Log(StringFormat(
      "Reconstruction failed. offline=%d sec note=%s",
      offlineSeconds,
      outcome.note
    ));
  }

  // Force an immediate push carrying reconstructed metadata.
  g_lastPush = 0;
}

//+------------------------------------------------------------------+
void PushStatsIfDue()
{
  if(!PushAccountStats || PushUrl == "")
    return;

  datetime now = TimeCurrent();
  if(g_lastPush != 0 && (now - g_lastPush) < PushIntervalSeconds)
    return;

  if(!SendAccountSnapshot())
  {
    Log("Account snapshot push failed.");
    return;
  }

  g_lastPush = now;
  GlobalVariableSet(GV_LAST_PUSH, (double)g_lastPush);

  if(g_dataSource == "reconstructed")
    g_dataSource = "realtime";
}

//+------------------------------------------------------------------+
bool SendAccountSnapshot()
{
  string payload = BuildAccountPayload();
  if(payload == "")
    return false;
  string response = "";
  string url = BuildPushUrl();
  if(!HttpPostJson(url, payload, response))
    return false;
  return true;
}

//+------------------------------------------------------------------+
bool HttpPostJson(const string url, const string payload, string &response)
{
  uchar result[];
  uchar data[];
  string headers;
  string request_headers = "Content-Type: application/json\r\n"
                           "User-Agent: MT5-LimniBasket/2.1\r\n";
  if(PushToken != "")
    request_headers += "x-mt5-token: " + PushToken + "\r\n";

  int len = StringToCharArray(payload, data, 0, WHOLE_ARRAY, CP_UTF8);
  if(len > 0 && data[len - 1] == 0)
    ArrayResize(data, len - 1);

  ResetLastError();
  int timeout = 8000;
  int status = WebRequest("POST", url, request_headers, timeout, data, result, headers);
  if(status == 404)
  {
    string altUrl = EnsureTrailingSlash(url);
    if(altUrl != url)
      status = WebRequest("POST", altUrl, request_headers, timeout, data, result, headers);
  }
  if(status == -1)
  {
    Log(StringFormat("Snapshot WebRequest failed: %d", GetLastError()));
    return false;
  }
  if(status != 200)
  {
    Log(StringFormat("Snapshot HTTP status %d (%s)", status, TruncateForLog(url, 120)));
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

void ResetPlanningDiagnostics()
{
  g_diagRawA = 0;
  g_diagRawB = 0;
  g_diagRawC = 0;
  g_diagRawD = 0;
  g_diagRawS = 0;
  g_diagAcceptedA = 0;
  g_diagAcceptedB = 0;
  g_diagAcceptedC = 0;
  g_diagAcceptedD = 0;
  g_diagAcceptedS = 0;
  g_diagSkipNotAllowed = 0;
  g_diagSkipUnresolvedSymbol = 0;
  g_diagSkipDuplicateOpen = 0;
  g_diagSkipCryptoNotOpen = 0;
  g_diagSkipNotTradable = 0;
  g_diagSkipInvalidVolume = 0;
  g_diagSkipOrderFailed = 0;
  g_diagSkipMaxPositions = 0;
  g_diagSkipLotCap = 0;
  g_diagSkipRateLimit = 0;
}

void AddRawModelCount(const string model)
{
  string key = model;
  StringToLower(key);
  if(key == "antikythera") g_diagRawA++;
  else if(key == "blended") g_diagRawB++;
  else if(key == "commercial") g_diagRawC++;
  else if(key == "dealer") g_diagRawD++;
  else if(key == "sentiment") g_diagRawS++;
}

void AddAcceptedModelCount(const string model)
{
  string key = model;
  StringToLower(key);
  if(key == "antikythera") g_diagAcceptedA++;
  else if(key == "blended") g_diagAcceptedB++;
  else if(key == "commercial") g_diagAcceptedC++;
  else if(key == "dealer") g_diagAcceptedD++;
  else if(key == "sentiment") g_diagAcceptedS++;
}

void AddSkipReason(const string reasonKey)
{
  string key = reasonKey;
  StringToLower(key);
  if(key == "not_allowed") g_diagSkipNotAllowed++;
  else if(key == "unresolved_symbol") g_diagSkipUnresolvedSymbol++;
  else if(key == "duplicate_open") g_diagSkipDuplicateOpen++;
  else if(key == "crypto_not_open") g_diagSkipCryptoNotOpen++;
  else if(key == "not_tradable") g_diagSkipNotTradable++;
  else if(key == "invalid_volume") g_diagSkipInvalidVolume++;
  else if(key == "order_failed") g_diagSkipOrderFailed++;
  else if(key == "max_positions") g_diagSkipMaxPositions++;
  else if(key == "lot_cap") g_diagSkipLotCap++;
  else if(key == "rate_limit") g_diagSkipRateLimit++;
}

string ToLongShort(int dir)
{
  return dir > 0 ? "LONG" : "SHORT";
}

string ParseModelFromComment(const string comment)
{
  int idx = StringFind(comment, "LimniBasket ");
  if(idx < 0)
    return "unknown";
  string rest = StringSubstr(comment, idx + StringLen("LimniBasket "));
  int spaceIdx = StringFind(rest, " ");
  string model = spaceIdx > 0 ? StringSubstr(rest, 0, spaceIdx) : rest;
  if(model == "")
    return "unknown";
  StringToLower(model);
  return model;
}

string BuildModelCountJson(bool accepted)
{
  string result = "{";
  result += "\"antikythera\":" + IntegerToString(accepted ? g_diagAcceptedA : g_diagRawA) + ",";
  result += "\"blended\":" + IntegerToString(accepted ? g_diagAcceptedB : g_diagRawB) + ",";
  result += "\"commercial\":" + IntegerToString(accepted ? g_diagAcceptedC : g_diagRawC) + ",";
  result += "\"dealer\":" + IntegerToString(accepted ? g_diagAcceptedD : g_diagRawD) + ",";
  result += "\"sentiment\":" + IntegerToString(accepted ? g_diagAcceptedS : g_diagRawS);
  result += "}";
  return result;
}

string BuildSkipReasonJson()
{
  string result = "{";
  result += "\"not_allowed\":" + IntegerToString(g_diagSkipNotAllowed) + ",";
  result += "\"unresolved_symbol\":" + IntegerToString(g_diagSkipUnresolvedSymbol) + ",";
  result += "\"duplicate_open\":" + IntegerToString(g_diagSkipDuplicateOpen) + ",";
  result += "\"crypto_not_open\":" + IntegerToString(g_diagSkipCryptoNotOpen) + ",";
  result += "\"not_tradable\":" + IntegerToString(g_diagSkipNotTradable) + ",";
  result += "\"invalid_volume\":" + IntegerToString(g_diagSkipInvalidVolume) + ",";
  result += "\"order_failed\":" + IntegerToString(g_diagSkipOrderFailed) + ",";
  result += "\"max_positions\":" + IntegerToString(g_diagSkipMaxPositions) + ",";
  result += "\"lot_cap\":" + IntegerToString(g_diagSkipLotCap) + ",";
  result += "\"rate_limit\":" + IntegerToString(g_diagSkipRateLimit);
  result += "}";
  return result;
}

string BuildPlannedLegsJson()
{
  string result = "[";
  bool firstRow = true;
  int total = ArraySize(g_brokerSymbols);
  for(int i = 0; i < total; i++)
  {
    string symbol = g_brokerSymbols[i];
    int direction = g_directions[i];
    if(symbol == "" || direction == 0)
      continue;

    string assetClass = (i < ArraySize(g_assetClasses) ? g_assetClasses[i] : "fx");
    double targetLot = 0.0;
    double finalLot = 0.0;
    double deviationPct = 0.0;
    double equityPerSymbol = 0.0;
    double marginRequired = 0.0;
    bool ok = ComputeOneToOneLot(symbol, assetClass, targetLot, finalLot, deviationPct, equityPerSymbol, marginRequired);
    if(ok)
      ApplyRiskScale(symbol, GetLegRiskScale(), targetLot, finalLot, deviationPct, equityPerSymbol, marginRequired);
    if(!ok || finalLot <= 0.0)
      continue;

    if(!firstRow)
      result += ",";
    firstRow = false;

    string model = (i < ArraySize(g_models) ? g_models[i] : "blended");
    result += "{";
    result += "\"symbol\":\"" + JsonEscape(symbol) + "\",";
    result += "\"model\":\"" + JsonEscape(model) + "\",";
    result += "\"direction\":\"" + ToLongShort(direction) + "\",";
    result += "\"units\":" + DoubleToString(finalLot, 4);
    result += "}";
  }
  result += "]";
  return result;
}

string BuildExecutionLegsJson()
{
  string result = "[";
  bool firstRow = true;
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

    string symbol = PositionGetString(POSITION_SYMBOL);
    long posType = PositionGetInteger(POSITION_TYPE);
    int dir = (posType == POSITION_TYPE_BUY) ? 1 : -1;
    double lots = PositionGetDouble(POSITION_VOLUME);
    string model = ParseModelFromComment(PositionGetString(POSITION_COMMENT));

    if(!firstRow)
      result += ",";
    firstRow = false;

    result += "{";
    result += "\"symbol\":\"" + JsonEscape(symbol) + "\",";
    result += "\"model\":\"" + JsonEscape(model) + "\",";
    result += "\"direction\":\"" + ToLongShort(dir) + "\",";
    result += "\"units\":" + DoubleToString(lots, 4) + ",";
    result += "\"position_id\":" + IntegerToString((int)ticket);
    result += "}";
  }
  result += "]";
  return result;
}

string BuildPlanningDiagnosticsJson()
{
  bool capacityLimited = (g_diagSkipMaxPositions > 0 || g_diagSkipLotCap > 0 || g_diagSkipRateLimit > 0 ||
                          g_diagSkipNotTradable > 0 || g_diagSkipInvalidVolume > 0 || g_diagSkipOrderFailed > 0);
  string reason = "";
  if(g_diagSkipMaxPositions > 0) reason = "max_positions";
  else if(g_diagSkipLotCap > 0) reason = "lot_cap";
  else if(g_diagSkipRateLimit > 0) reason = "rate_limit";
  else if(g_diagSkipNotTradable > 0) reason = "not_tradable";
  else if(g_diagSkipInvalidVolume > 0) reason = "invalid_volume";
  else if(g_diagSkipOrderFailed > 0) reason = "order_failed";

  string result = "{";
  result += "\"signals_raw_count_by_model\":" + BuildModelCountJson(false) + ",";
  result += "\"signals_accepted_count_by_model\":" + BuildModelCountJson(true) + ",";
  result += "\"signals_skipped_count_by_reason\":" + BuildSkipReasonJson() + ",";
  result += "\"planned_legs\":" + BuildPlannedLegsJson() + ",";
  result += "\"execution_legs\":" + BuildExecutionLegsJson() + ",";
  result += "\"capacity_limited\":" + BoolToJson(capacityLimited) + ",";
  result += "\"capacity_limit_reason\":\"" + JsonEscape(reason) + "\"";
  result += "}";
  return result;
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
  double freeMargin = AccountInfoDouble(ACCOUNT_MARGIN_FREE);
  int openPositions = CountOpenPositions();
  int openPairs = CountOpenPairs();
  double totalLots = GetTotalBasketLots();
  double pnlPct = 0.0;
  if(g_baselineEquity > 0.0)
    pnlPct = (equity - g_baselineEquity) / g_baselineEquity * 100.0;
  double riskUsed = 0.0;
  int nextAddSeconds = GetNextAddSeconds();
  int nextPollSeconds = GetNextPollSeconds();
  int tradeCount = 0;
  double winRate = 0.0;
  GetWeeklyTradeStats(tradeCount, winRate);
  if(g_reconstructionAttempted && g_reconstructionTrades > tradeCount)
    tradeCount = g_reconstructionTrades;

  string payload = "{";
  payload += "\"account_id\":\"" + JsonEscape(accountId) + "\",";
  payload += "\"label\":\"" + JsonEscape(label) + "\",";
  payload += "\"broker\":\"" + JsonEscape(broker) + "\",";
  payload += "\"server\":\"" + JsonEscape(server) + "\",";
  payload += "\"status\":\"" + JsonEscape(AccountStatusToString()) + "\",";
  payload += "\"trade_mode\":\"" + JsonEscape(TradeModeToString()) + "\",";
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
  payload += "\"lot_map\":" + BuildLotMapArray() + ",";
  payload += "\"lot_map_updated_utc\":\"" + FormatIsoUtc(TimeGMT()) + "\",";
  payload += "\"planning_diagnostics\":" + BuildPlanningDiagnosticsJson() + ",";

  // Add recent logs
  payload += "\"recent_logs\":[";
  bool firstLog = true;
  for(int i = 0; i < 100; i++)
  {
    int idx = (g_logBufferIndex + i) % 100;
    if(g_logBuffer[idx] != "")
    {
      if(!firstLog)
        payload += ",";
      payload += "\"" + JsonEscape(g_logBuffer[idx]) + "\"";
      firstLog = false;
    }
  }
  payload += "]";

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

    // Get broker specs for this symbol
    double minVol = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MIN);
    double maxVol = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MAX);
    double volStep = SymbolInfoDouble(symbol, SYMBOL_VOLUME_STEP);

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
    result += "\"comment\":\"" + JsonEscape(comment) + "\",";
    result += "\"min_volume\":" + DoubleToString(minVol, 2) + ",";
    result += "\"max_volume\":" + DoubleToString(maxVol, 2) + ",";
    result += "\"volume_step\":" + DoubleToString(volStep, 2);
    result += "}";
  }

  result += "]";
  return result;
}

//+------------------------------------------------------------------+
string BuildClosedPositionsArray()
{
  datetime from = TimeGMT() - (ClosedHistoryDays * 86400);
  datetime to = TimeGMT();
  if(!HistorySelect(from, to))
    return "[]";

  long posIds[];
  double posProfit[];
  double posSwap[];
  double posCommission[];
  double posVolume[];
  double posOpenPrice[];
  double posClosePrice[];
  datetime posOpenTime[];
  datetime posCloseTime[];
  string posSymbol[];
  int posType[];
  long posMagic[];
  string posComment[];

  ArrayResize(posIds, 0);
  int deals = HistoryDealsTotal();
  for(int i = 0; i < deals; i++)
  {
    ulong dealTicket = HistoryDealGetTicket(i);
    if(dealTicket == 0)
      continue;
    if((long)HistoryDealGetInteger(dealTicket, DEAL_MAGIC) != MagicNumber)
      continue;

    long posId = (long)HistoryDealGetInteger(dealTicket, DEAL_POSITION_ID);
    int entry = (int)HistoryDealGetInteger(dealTicket, DEAL_ENTRY);
    int type = (int)HistoryDealGetInteger(dealTicket, DEAL_TYPE);
    double price = HistoryDealGetDouble(dealTicket, DEAL_PRICE);
    double volume = HistoryDealGetDouble(dealTicket, DEAL_VOLUME);
    double profit = HistoryDealGetDouble(dealTicket, DEAL_PROFIT);
    double swap = HistoryDealGetDouble(dealTicket, DEAL_SWAP);
    double commission = HistoryDealGetDouble(dealTicket, DEAL_COMMISSION);
    datetime time = (datetime)HistoryDealGetInteger(dealTicket, DEAL_TIME);
    long magic = (long)HistoryDealGetInteger(dealTicket, DEAL_MAGIC);
    string comment = HistoryDealGetString(dealTicket, DEAL_COMMENT);

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
      ArrayResize(posProfit, size + 1);
      ArrayResize(posSwap, size + 1);
      ArrayResize(posCommission, size + 1);
      ArrayResize(posVolume, size + 1);
      ArrayResize(posOpenPrice, size + 1);
      ArrayResize(posClosePrice, size + 1);
      ArrayResize(posOpenTime, size + 1);
      ArrayResize(posCloseTime, size + 1);
      ArrayResize(posSymbol, size + 1);
      ArrayResize(posType, size + 1);
      ArrayResize(posMagic, size + 1);
      ArrayResize(posComment, size + 1);
      posIds[size] = posId;
      posProfit[size] = 0.0;
      posSwap[size] = 0.0;
      posCommission[size] = 0.0;
      posVolume[size] = 0.0;
      posOpenPrice[size] = 0.0;
      posClosePrice[size] = 0.0;
      posOpenTime[size] = 0;
      posCloseTime[size] = 0;
      posSymbol[size] = HistoryDealGetString(dealTicket, DEAL_SYMBOL);
      posType[size] = 0;
      posMagic[size] = magic;
      posComment[size] = comment;
      idx = size;
    }

    if(entry == DEAL_ENTRY_IN)
    {
      if(posOpenTime[idx] == 0 || time < posOpenTime[idx])
      {
        posOpenTime[idx] = time;
        posOpenPrice[idx] = price;
        posType[idx] = type;
        if(posSymbol[idx] == "")
          posSymbol[idx] = HistoryDealGetString(dealTicket, DEAL_SYMBOL);
      }
    }
    if(entry == DEAL_ENTRY_OUT || entry == DEAL_ENTRY_OUT_BY)
    {
      posProfit[idx] += profit;
      posSwap[idx] += swap;
      posCommission[idx] += commission;
      posVolume[idx] += volume;
      if(posType[idx] == 0)
        posType[idx] = type;
      if(time > posCloseTime[idx])
      {
        posCloseTime[idx] = time;
        posClosePrice[idx] = price;
        posComment[idx] = comment;
        if(posSymbol[idx] == "")
          posSymbol[idx] = HistoryDealGetString(dealTicket, DEAL_SYMBOL);
      }
    }
  }

  string result = "[";
  bool first = true;
  for(int i = 0; i < ArraySize(posIds); i++)
  {
    if(posCloseTime[i] == 0 || posVolume[i] <= 0.0)
      continue;

    string symbol = posSymbol[i];
    if(symbol == "")
      symbol = "UNKNOWN";
    string typeStr = (posType[i] == DEAL_TYPE_BUY ? "BUY" : "SELL");

    if(!first)
      result += ",";
    first = false;

    result += "{";
    result += "\"ticket\":" + IntegerToString((int)posIds[i]) + ",";
    result += "\"symbol\":\"" + JsonEscape(symbol) + "\",";
    result += "\"type\":\"" + typeStr + "\",";
    result += "\"lots\":" + DoubleToString(posVolume[i], 2) + ",";
    result += "\"open_price\":" + DoubleToString(posOpenPrice[i], 5) + ",";
    result += "\"close_price\":" + DoubleToString(posClosePrice[i], 5) + ",";
    result += "\"profit\":" + DoubleToString(posProfit[i], 2) + ",";
    result += "\"swap\":" + DoubleToString(posSwap[i], 2) + ",";
    result += "\"commission\":" + DoubleToString(posCommission[i], 2) + ",";
    result += "\"open_time\":\"" + FormatIsoUtc(posOpenTime[i]) + "\",";
    result += "\"close_time\":\"" + FormatIsoUtc(posCloseTime[i]) + "\",";
    result += "\"magic_number\":" + IntegerToString((int)posMagic[i]) + ",";
    result += "\"comment\":\"" + JsonEscape(posComment[i]) + "\"";
    result += "}";
  }

  result += "]";
  return result;
}

//+------------------------------------------------------------------+
string BuildLotMapArray()
{
  string result = "[";
  bool firstRow = true;
  int total = ArraySize(g_brokerSymbols);
  for(int i = 0; i < total; i++)
  {
    string symbol = g_brokerSymbols[i];
    if(symbol == "")
      continue;
    string assetClass = (i < ArraySize(g_assetClasses) ? g_assetClasses[i] : "fx");
    double targetLot = 0.0;
    double finalLot = 0.0;
    double deviationPct = 0.0;
    double equityPerSymbol = 0.0;
    double marginRequired = 0.0;
    if(!ComputeOneToOneLot(symbol, assetClass, targetLot, finalLot, deviationPct, equityPerSymbol, marginRequired))
      continue;
    ApplyRiskScale(symbol, GetLegRiskScale(), targetLot, finalLot, deviationPct, equityPerSymbol, marginRequired);
    double move1pct = ComputeMove1PctUsd(symbol, finalLot);

    if(!firstRow)
      result += ",";
    firstRow = false;

    result += "{";
    result += "\"symbol\":\"" + JsonEscape(symbol) + "\",";
    result += "\"asset_class\":\"" + JsonEscape(assetClass) + "\",";
    result += "\"lot\":" + DoubleToString(finalLot, 4) + ",";
    result += "\"target_lot\":" + DoubleToString(targetLot, 4) + ",";
    result += "\"deviation_pct\":" + DoubleToString(deviationPct, 2) + ",";
    result += "\"margin_required\":" + DoubleToString(marginRequired, 2) + ",";
    result += "\"move_1pct_usd\":" + DoubleToString(move1pct, 2);
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
string TradeModeToString()
{
  return ManualMode ? "MANUAL" : "AUTO";
}

//+------------------------------------------------------------------+
int GetNextAddSeconds()
{
  return -1;
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
