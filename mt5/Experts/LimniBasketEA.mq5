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
input bool ManualMode = false;
enum StrategyProfile
{
  PROFILE_CUSTOM = 0,
  PROFILE_EIGHTCAP = 1,
  PROFILE_5ERS = 2,
  PROFILE_AUTO = 3
};
input StrategyProfile StrategyMode = PROFILE_AUTO;
input bool AutoProfileByBroker = true;
input string EightcapBrokerHints = "eightcap";
input string FiveersBrokerHints = "5ers,the5ers,fiveers,fivepercent,fxify";
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
input double CryptoLotMultiplier = 0.5;
input double CommoditiesLotMultiplier = 0.5;
input double IndicesLotMultiplier = 0.5;
input bool EnableSizingGuard = true;
input double MaxLegMove1PctOfEquity = 1.0;
input double FiveersMaxLegMove1PctOfEquity = 0.25;
input string SymbolMove1PctCapOfEquity = "";
input string FiveersSymbolMove1PctCapOfEquity = "XAUUSD=0.10,XAGUSD=0.10,WTIUSD=0.20";
input bool LogSizingDetails = true;
input int SizingLogCooldownSeconds = 300;
input double SizingLogDeviationThresholdPct = 5.0;
enum SizingToleranceMode
{
  SIZING_STRICT_UNDER_TARGET = 0,
  SIZING_NEAREST_STEP_BOUNDED_OVERSHOOT = 1
};
input SizingToleranceMode SizingTolerance = SIZING_STRICT_UNDER_TARGET;
input double SizingMaxOvershootPct = 5.0;
input double EquityTrailStartPct = 20.0;
input double EquityTrailOffsetPct = 10.0;
input bool EnableEquityTrail = true;
input bool EnableAdaptiveTrail = true;
input double AdaptiveTrailStartMultiplier = 0.65;
input double AdaptiveTrailOffsetFraction = 0.25;
input double AdaptiveTrailMinStartPct = 30.0;
input double AdaptiveTrailMaxStartPct = 130.0;
input double AdaptiveTrailMinOffsetPct = 8.0;
input double AdaptiveTrailMaxOffsetPct = 45.0;
input double AdaptiveTrailAlpha = 0.35;
input bool EnableBasketTakeProfit = true;
input double BasketTakeProfitPct = 6.0;
input double BasketTakeProfitUsd = 0.0;
input int BasketTakeProfitReattachGraceSeconds = 300;
input bool EnableBasketStopLoss = false;
input double BasketStopLossPct = 0.0;
input double EightcapEmergencyStopPct = 30.0;
input double FiveersBasketTakeProfitPct = 6.0;
input double FiveersBasketStopLossPct = 3.0;
input bool EnforceStopLoss = true;
input double StopLossRiskPct = 1.0;
input double MaxStopLossRiskPct = 2.0;
input double FiveersPerTradeRiskPct = 1.98;
input bool AllowNonFullTradeModeForListing = true;
input bool RequireHedgingAccount = true;
input bool EnableWeeklyFlipClose = true;
input bool EnableLoserAddToTarget = true;
input double LoserAddToleranceLots = 0.0;
input int MaxLoserAddsPerSymbol = 2;
input int LoserAddWindowHours = 48;
input bool PreventMidWeekAttach = true;
input int MidWeekAttachGraceHours = 24;
input int MaxOpenPositions = 200;
input int SlippagePoints = 10;
input long MagicNumber = 912401;
input int MaxOrdersPerMinute = 20;
input bool ShowDashboard = true;
enum DashboardMode
{
  DASH_COMPACT = 0,
  DASH_DETAILED = 1
};
input DashboardMode DashboardView = DASH_COMPACT;
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
input string LicenseKey = "";
input int PushIntervalSeconds = 30;
input string AccountLabel = "";
input string ProfileLabelOverride = "";
input string AccountClassLabelOverride = "";
input string UserLabel = "";
input int ClosedHistoryDays = 30;
input bool RequireFullUniverseSizingReady = true;
input int UniverseSizingCheckCooldownSeconds = 60;
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

struct LegSizingResult
{
  bool ok;
  string reasonKey;
  string profile;
  string toleranceMode;
  double targetLot;
  double solvedLotRaw;
  double postClampLot;
  double finalLot;
  double deviationPct;
  double equityPerSymbol;
  double targetRiskUsd;
  double marginRequired;
  double move1pctUsd;
  double move1pctPerLotUsd;
  double move1pctCapUsd;
  double specPrice;
  double specTickSize;
  double specTickValue;
  double specContractSize;
  double specMinLot;
  double specMaxLot;
  double specLotStep;
};

struct SymbolSpecProbe
{
  bool ok;
  string reason;
  double price;
  double bid;
  double ask;
  double last;
  double point;
  double tickSize;
  double tickValue;
  double tickValueProfit;
  double tickValueLoss;
  double contractSize;
  double minLot;
  double maxLot;
  double lotStep;
  int volumeDigits;
  int digits;
  int tradeMode;
  double move1pctPerLotUsd;
};

struct SizingPolicy
{
  string profile;
  double riskScale;
  double moveCapUsd;
  bool strictUnderTarget;
  double maxOvershootPct;
};

string g_reportDate = "";
bool g_tradingAllowed = false;
bool g_apiOk = false;

EAState g_state = STATE_IDLE;
datetime g_weekStartGmt = 0;
datetime g_lastPoll = 0;
datetime g_lastApiSuccess = 0;
datetime g_eaAttachTime = 0;
int g_loserAddCounts[];
bool g_loadedFromCache = false;
string g_lastDataRefreshUtc = "";
string g_trailProfileSource = "";
string g_trailProfileGeneratedUtc = "";
double g_trailProfileStartPct = 0.0;
double g_trailProfileOffsetPct = 0.0;

double g_baselineEquity = 0.0;
double g_lockedProfitPct = 0.0;
bool g_trailingActive = false;
bool g_closeRequested = false;
double g_weekPeakEquity = 0.0;
double g_maxDrawdownPct = 0.0;
double g_adaptivePeakAvgPct = 0.0;
double g_lastWeekPeakPct = 0.0;
double g_adaptivePeakSumPct = 0.0;
int g_adaptivePeakCount = 0;

string g_apiSymbols[];
string g_apiSymbolsRaw[];
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
int g_diagSkipSizingGuard = 0;
int g_diagSkipOrderFailed = 0;
int g_diagSkipMaxVolume = 0;
int g_diagSkipMaxPositions = 0;
int g_diagSkipRateLimit = 0;
int g_diagSkipPendingLegFill = 0;

datetime g_orderTimes[];
datetime g_lastPush = 0;
datetime g_lastStructureWarn = 0;
datetime g_lastUniverseGateWarn = 0;
datetime g_lastUniverseSizingCheck = 0;
bool g_universeSizingReady = false;
string g_universeSizingReason = "";
string g_dataSource = "realtime";
string g_reconstructionStatus = "none";
string g_reconstructionNote = "";
datetime g_reconstructionWindowStart = 0;
datetime g_reconstructionWindowEnd = 0;
int g_reconstructionMarketClosed = 0;
int g_reconstructionTrades = 0;
double g_reconstructionWeekRealized = 0.0;
bool g_reconstructionAttempted = false;
datetime g_basketTpArmedAt = 0;
bool g_basketTpGraceLogged = false;

CTrade g_trade;

string GV_WEEK_START = "WeekStart";
string GV_STATE = "State";
string GV_BASELINE = "Baseline";
string GV_LOCKED = "Locked";
string GV_TRAIL = "TrailActive";
string GV_CLOSE = "CloseRequested";
string GV_WEEK_PEAK = "WeekPeak";
string GV_MAX_DD = "MaxDD";
string GV_LAST_PUSH = "LastPush";
string GV_ADAPTIVE_PEAK_AVG = "AdaptivePeakAvg";
string GV_LAST_WEEK_PEAK = "LastWeekPeak";
string GV_ADAPTIVE_PEAK_SUM = "AdaptivePeakSum";
string GV_ADAPTIVE_PEAK_COUNT = "AdaptivePeakCount";
string CACHE_FILE = "LimniCotCache.json";
string g_scopePrefix = "Limni_";
string g_cacheFile = "LimniCotCache.json";
string DASH_BG = "LimniDash_bg";
string DASH_SHADOW = "LimniDash_shadow";
string DASH_ACCENT = "LimniDash_accent";
string DASH_DIVIDER = "LimniDash_divider";
string DASH_COL_DIVIDER = "LimniDash_col_divider";
string DASH_TITLE = "LimniDash_title";
string DASH_MAP_TITLE = "LimniDash_map_title";

string g_lastApiError = "";
datetime g_lastApiErrorTime = 0;
string g_lastStopLossReason = "";
string g_lastOrderFailureKey = "";
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
bool ExtractNumberValue(const string json, const string key, double &value);
void ApplyTrailProfileFromApi(const string json);
bool ResolveSymbol(const string apiSymbol, string &resolved);
bool IsTradableSymbol(const string symbol);
string NormalizeSymbolKey(const string value);
bool TryResolveAlias(const string apiSymbol, string &resolved);
bool ResolveSymbolByNormalizedKey(const string targetKey, string &resolved, bool requireFull);
bool ResolveSymbolByFamily(const string apiSymbol, string &resolved, bool requireFull);
void BuildAllowedKeys();
bool IsAllowedSymbol(const string symbol);
bool IsIndexSymbol(const string symbol);
int DirectionFromString(const string value);
string DirectionToString(int dir);
double NormalizeVolume(const string symbol, double volume);
double GetLotForSymbol(const string symbol, const string assetClass);
double GetOneToOneLotForSymbol(const string symbol, const string assetClass);
double CalculateMarginRequired(const string symbol, double lots);
double EstimateMove1PctUsdPerLot(const string symbol, double priceHint);
double NormalizeVolumeWithPolicy(const string symbol, double volume, bool strictUnderTarget, double maxOvershootPct, double targetVolume);
bool ProbeSymbolSpec(const string symbol, SymbolSpecProbe &probe);
bool BuildSizingPolicy(const string symbol, const string assetClass, const SymbolSpecProbe &probe, SizingPolicy &policy, double &baseEquity);
bool EvaluateLegSizingLegacy(const string symbol, const string assetClass, LegSizingResult &result);
bool ComputeOneToOneLot(const string symbol, const string assetClass, double &targetLot,
                        double &finalLot, double &deviationPct, double &equityPerSymbol,
                        double &marginRequired);
double ClampVolumeToMax(const string symbol, double desiredVolume, double maxCap);
bool TryGetCsvSymbolDouble(const string csv, const string symbol, double &value);
double GetMove1PctCapUsd(const string symbol, const string assetClass, double baseEquity);
bool EvaluateLegSizing(const string symbol, const string assetClass, LegSizingResult &result);
bool ShouldLogSizing(const string symbol, int cooldownSeconds);
void LogSizing(const string symbol, double targetLot, double finalLot,
               double deviationPct, double equityPerSymbol, double marginRequired);
double GetAssetMultiplier(const string assetClass);
double GetTotalBasketLots();
bool HasOpenPositions();
bool HasPositionForSymbol(const string symbol);
bool HasPositionForModel(const string symbol, const string model);
bool HasMissingPlannedModelsForSymbol(const string symbol);
double GetDirectionalOpenVolume(const string symbol, int direction);
double ClampVolumeToSymbolDirectionLimit(const string symbol, int direction, double desiredVolume);
int GetNetSignalForSymbol(const string symbol);
string GetNetModelForSymbol(const string symbol, int netDirection);
void UpdateState();
void ManageBasket();
void TryAddPositions();
void ReconcilePositionsWithSignals();
bool TryAddToLosingLeg(const string symbol, const string model, int direction, const string assetClass);
double GetOpenVolumeForModelDirection(const string symbol, const string model, int direction, bool &hasLosing);
bool PlaceOrder(const string symbol, int direction, double volume, const string model, const string reasonTag);
bool CalculateRiskStopLoss(const string symbol, int direction, double volume, double entryPrice, double &stopLoss);
bool EnforceBrokerStopDistance(const string symbol, int direction, double entryPrice, double &stopLoss);
bool TryBuildFallbackCompliantStopLoss(const string symbol, int direction, double volume,
                                       double entryPrice, double limitUsd, double minDistance,
                                       double &stopLoss);
double EstimatePositionRiskUsd(const string symbol, int direction, double volume, double entryPrice, double stopLoss);
bool GetSymbolStats(const string symbol, SymbolStats &stats);
void CloseAllPositions();
void CloseAllPositions(const string reasonTag);
bool ClosePositionByTicket(ulong ticket);
bool ClosePositionByTicket(ulong ticket, const string reasonTag);
void CloseSymbolPositions(const string symbol);
void CloseSymbolPositions(const string symbol, const string reasonTag);
string BuildOpenOrderComment(const string model, const string reasonTag);
string BuildCloseOrderComment(const string reasonTag);
string ShortReasonTag(const string reasonTag);
string MarginModeToString();
bool IsHedgingAccount();
bool IsNettingAccount();
bool ShouldRequireHedgingAccount();
bool ShouldRequireNettingAccount();
bool IsAccountStructureAllowed();
double GetOpenSymbolRiskUsd(const string symbol);
string NormalizeModelName(const string value);
bool IsFreshEntryWindow(datetime nowGmt);
bool IsMidWeekAttachBlocked(datetime nowGmt);
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
string FormatDateOnly(datetime value);
string CompactText(const string value, int maxLen);
int EstimateDashMaxChars(int pixelWidth);
string FitDashboardText(const string value, int pixelWidth);
string LeftDashboardText(const string value);
string RightDashboardText(const string value);
string EnsureTrailingSlash(const string url);
string UrlEncode(const string value);
string AppendQueryParam(const string url, const string key, const string value);
int CountOpenPositions();
int CountOpenPairs();
int CountUniquePlannedPairs();
int CountExpectedUniversePairs();
bool HasPlannedSymbol(const string symbol);
string GetMissingUniversePairs();
bool FindAcceptedSymbolIndex(const string apiSymbol, int &indexOut);
bool IsUniverseSizingReady(string &reason);
int CountSignalsByModel(const string model);
int CountOpenPositionsByModel(const string model);
void UpdateDrawdown();
void GetWeeklyTradeStats(int &tradeCount, double &winRatePct);
void PushStatsIfDue();
bool SendAccountSnapshot();
bool HttpPostJson(const string url, const string payload, string &response);
void RunReconstructionIfNeeded();
double GetLegRiskScale();
string RiskModeToString();
string StrategyModeToString();
string GetProfileLabel();
string GetAccountClassLabel();
string GetUserLabel();
StrategyProfile GetEffectiveStrategyMode();
string NormalizeBrokerText(const string value);
bool BrokerMatchesHints(const string hintsCsv);
bool IsFiveersMode();
bool IsEightcapMode();
bool IsBasketTakeProfitEnabled();
double GetEffectiveBasketTakeProfitPct();
bool IsBasketStopLossEnabled();
double GetEffectiveBasketStopLossPct();
bool IsEquityTrailEnabled();
bool IsAdaptiveTrailEnabled();
double GetEffectiveTrailStartPct();
double GetEffectiveTrailOffsetPct();
bool ShouldEnforcePerOrderStopLoss();
void UpdateAdaptivePeakAverageFromWeek();
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
bool IsWaitingForWeeklySnapshot(string &expectedReportDate, int &minutesSinceRelease);
double ProbeMarginCoverageForMode(const string symbol, const string assetClass, double &testLot, double &marginRequired);
void LogBrokerCapability();
string SanitizeScopePart(const string value);
string BuildScopePrefix();
string ScopeKey(const string suffix);
string ScopeCacheFileName(const string baseName);

//+------------------------------------------------------------------+
int OnInit()
{
  g_trade.SetExpertMagicNumber(MagicNumber);
  g_trade.SetDeviationInPoints(SlippagePoints);
  g_scopePrefix = BuildScopePrefix();
  g_cacheFile = ScopeCacheFileName(CACHE_FILE);
  Print(StringFormat("Limni state scope=%s cache=%s", g_scopePrefix, g_cacheFile));
  g_basketTpArmedAt = TimeCurrent();
  g_basketTpGraceLogged = false;
  string configuredMode = "CUSTOM";
  if(StrategyMode == PROFILE_EIGHTCAP)
    configuredMode = "EIGHTCAP";
  else if(StrategyMode == PROFILE_5ERS)
    configuredMode = "5ERS";
  else if(StrategyMode == PROFILE_AUTO)
    configuredMode = "AUTO";
  Log(StringFormat("Strategy mode configured=%s effective=%s broker=%s server=%s",
                   configuredMode,
                   StrategyModeToString(),
                   AccountInfoString(ACCOUNT_COMPANY),
                   AccountInfoString(ACCOUNT_SERVER)));
  Log(StringFormat("Effective guards: TP %.2f%% (%s) | SL %.2f%% (%s) | Trail %s",
                   GetEffectiveBasketTakeProfitPct(),
                   IsBasketTakeProfitEnabled() ? "on" : "off",
                   GetEffectiveBasketStopLossPct(),
                   IsBasketStopLossEnabled() ? "on" : "off",
                   IsEquityTrailEnabled() ? "on" : "off"));
  Log(StringFormat("Per-order stop loss: %s",
                   ShouldEnforcePerOrderStopLoss() ? "on (5ERS required)" : "off"));
  Log(StringFormat("Account structure: %s", MarginModeToString()));

  BuildAllowedKeys();
  LogBrokerCapability();
  g_weekStartGmt = GetWeekStartGmt(TimeGMT());
  g_eaAttachTime = TimeGMT();

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
  if(IsBasketTakeProfitEnabled() && BasketTakeProfitReattachGraceSeconds > 0 && HasOpenPositions())
  {
    g_basketTpArmedAt = TimeCurrent() + BasketTakeProfitReattachGraceSeconds;
    Log(StringFormat("Basket TP grace armed for %d sec after attach (open basket detected).",
                     BasketTakeProfitReattachGraceSeconds));
  }

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

string SanitizeScopePart(const string value)
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
  if(out == "")
    out = "default";
  return out;
}

string BuildScopePrefix()
{
  long login = AccountInfoInteger(ACCOUNT_LOGIN);
  string server = SanitizeScopePart(AccountInfoString(ACCOUNT_SERVER));
  string company = SanitizeScopePart(AccountInfoString(ACCOUNT_COMPANY));
  return StringFormat("Limni_%I64d_%s_%s_", login, server, company);
}

string ScopeKey(const string suffix)
{
  return g_scopePrefix + suffix;
}

string ScopeCacheFileName(const string baseName)
{
  return ScopeKey(baseName);
}

//+------------------------------------------------------------------+
void OnTimer()
{
  datetime nowGmt = TimeGMT();
  datetime newWeekStart = GetWeekStartGmt(nowGmt);

  if(newWeekStart != g_weekStartGmt)
  {
    UpdateAdaptivePeakAverageFromWeek();
    g_weekStartGmt = newWeekStart;
    ResetLoserAddCounts();
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
      // New week with open positions (losers from previous week)
      // Update baseline to current balance (after profitable trades closed)
      double newBalance = AccountInfoDouble(ACCOUNT_BALANCE);
      if(newBalance > 0.0)
      {
        g_baselineEquity = newBalance;
        SaveState();
        Log(StringFormat("New week detected with open positions. Baseline updated to %.2f (new balance after profitable closes).", newBalance));
      }
      else
      {
        Log("New week detected but positions still open. Holding state.");
      }
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
  ExtractStringValue(json, "last_refresh_utc", g_lastDataRefreshUtc);
  ApplyTrailProfileFromApi(json);
  g_lastApiError = "";
  g_lastApiErrorTime = 0;

  int count = ArraySize(symbols);
  ArrayResize(g_apiSymbolsRaw, count);
  for(int i = 0; i < count; i++)
  {
    g_apiSymbolsRaw[i] = symbols[i];
    StringToUpper(g_apiSymbolsRaw[i]);
  }
  ArrayResize(g_apiSymbols, 0);
  ArrayResize(g_brokerSymbols, 0);
  ArrayResize(g_directions, 0);
  ArrayResize(g_models, 0);
  ArrayResize(g_assetClasses, 0);

  for(int i = 0; i < count; i++)
  {
    string model = NormalizeModelName(i < ArraySize(models) ? models[i] : "blended");
    AddRawModelCount(model);

    string resolved = "";
    if(!IsAllowedSymbol(symbols[i]))
    {
      AddSkipReason("not_allowed");
      if(IsIndexSymbol(symbols[i]))
        LogTradeError(StringFormat("Index pair %s not in allowed list. Skipped.", symbols[i]));
      Log(StringFormat("Signal %d SKIP not_allowed: symbol=%s model=%s", i, symbols[i], model));
      continue;
    }
    if(!ResolveSymbol(symbols[i], resolved))
    {
      AddSkipReason("unresolved_symbol");
      if(IsIndexSymbol(symbols[i]))
        LogTradeError(StringFormat("Index pair %s not tradable or not found. Skipped.", symbols[i]));
      Log(StringFormat("Signal %d SKIP unresolved: symbol=%s model=%s", i, symbols[i], model));
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
    Log(StringFormat("Signal %d ACCEPTED: symbol=%s->%s model=%s dir=%d asset=%s",
                     i, symbols[i], resolved, model, dirs[i],
                     (i < ArraySize(assetClasses) ? assetClasses[i] : "fx")));
  }

  Log(StringFormat("API ok. trading_allowed=%s, report_date=%s, pairs=%d",
                   g_tradingAllowed ? "true" : "false",
                   g_reportDate,
                   ArraySize(g_apiSymbols)));
  Log(StringFormat("Parsed counts - Raw: A=%d B=%d C=%d D=%d S=%d | Accepted: A=%d B=%d C=%d D=%d S=%d",
                   g_diagRawA, g_diagRawB, g_diagRawC, g_diagRawD, g_diagRawS,
                   g_diagAcceptedA, g_diagAcceptedB, g_diagAcceptedC, g_diagAcceptedD, g_diagAcceptedS));
}

string BuildApiUrl()
{
  string url = ApiUrl;
  if(StringFind(url, "http") != 0)
    return url;
  if(StringFind(url, "asset=") < 0 && AssetFilter != "")
    url = AppendQueryParam(url, "asset", AssetFilter);

  string accountId = IntegerToString((long)AccountInfoInteger(ACCOUNT_LOGIN));
  string server = AccountInfoString(ACCOUNT_SERVER);
  string broker = AccountInfoString(ACCOUNT_COMPANY);

  if(StringFind(url, "account_id=") < 0)
    url = AppendQueryParam(url, "account_id", accountId);
  if(StringFind(url, "server=") < 0 && server != "")
    url = AppendQueryParam(url, "server", server);
  if(StringFind(url, "broker=") < 0 && broker != "")
    url = AppendQueryParam(url, "broker", broker);
  return url;
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
  string accountId = IntegerToString((long)AccountInfoInteger(ACCOUNT_LOGIN));
  string server = AccountInfoString(ACCOUNT_SERVER);
  string broker = AccountInfoString(ACCOUNT_COMPANY);
  request_headers += "x-mt5-account-id: " + accountId + "\r\n";
  if(server != "")
    request_headers += "x-mt5-server: " + server + "\r\n";
  if(broker != "")
    request_headers += "x-mt5-broker: " + broker + "\r\n";
  if(LicenseKey != "")
    request_headers += "x-mt5-license: " + LicenseKey + "\r\n";
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
      int size = ArraySize(symbols);
      ArrayResize(symbols, size + 1);
      ArrayResize(dirs, size + 1);
      ArrayResize(models, size + 1);
      ArrayResize(assetClasses, size + 1);
      symbols[size] = symbol;
      dirs[size] = dir;
      models[size] = NormalizeModelName(model);
      assetClasses[size] = (assetClass == "" ? "fx" : assetClass);
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
      int size = ArraySize(symbols);
      ArrayResize(symbols, size + 1);
      ArrayResize(dirs, size + 1);
      ArrayResize(models, size + 1);
      ArrayResize(assetClasses, size + 1);
      symbols[size] = key;
      dirs[size] = dir;
      models[size] = NormalizeModelName(model);
      assetClasses[size] = (assetClass == "" ? "fx" : assetClass);
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

bool ExtractNumberValue(const string json, const string key, double &value)
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

  int end = start;
  bool hasDigit = false;
  while(end < StringLen(json))
  {
    string ch = StringSubstr(json, end, 1);
    int code = (int)StringGetCharacter(ch, 0);
    bool isDigit = (code >= '0' && code <= '9');
    bool isSign = (ch == "+" || ch == "-");
    bool isDecimal = (ch == ".");
    bool isExponent = (ch == "e" || ch == "E");
    if(!(isDigit || isSign || isDecimal || isExponent))
      break;
    if(isDigit)
      hasDigit = true;
    end++;
  }
  if(end <= start || !hasDigit)
    return false;

  string token = StringSubstr(json, start, end - start);
  value = StringToDouble(token);
  return true;
}

void ApplyTrailProfileFromApi(const string json)
{
  g_trailProfileSource = "";
  g_trailProfileGeneratedUtc = "";
  g_trailProfileStartPct = 0.0;
  g_trailProfileOffsetPct = 0.0;

  ExtractStringValue(json, "trail_profile_source", g_trailProfileSource);
  ExtractStringValue(json, "trail_profile_generated_at_utc", g_trailProfileGeneratedUtc);
  ExtractNumberValue(json, "adaptive_trail_start_pct", g_trailProfileStartPct);
  ExtractNumberValue(json, "adaptive_trail_offset_pct", g_trailProfileOffsetPct);

  double avgPeak = 0.0;
  double peakCountRaw = 0.0;
  double peakSum = 0.0;
  bool hasAvg = ExtractNumberValue(json, "adaptive_avg_peak_pct", avgPeak);
  bool hasCount = ExtractNumberValue(json, "adaptive_peak_count", peakCountRaw);
  bool hasSum = ExtractNumberValue(json, "adaptive_peak_sum_pct", peakSum);
  if(!hasAvg || !hasCount || avgPeak <= 0.0 || peakCountRaw <= 0.0)
    return;

  int peakCount = (int)MathRound(peakCountRaw);
  if(peakCount <= 0)
    return;
  if(!hasSum || peakSum <= 0.0)
    peakSum = avgPeak * peakCount;

  bool changed = false;
  if(MathAbs(g_adaptivePeakAvgPct - avgPeak) > 0.01)
  {
    g_adaptivePeakAvgPct = avgPeak;
    changed = true;
  }
  if(g_adaptivePeakCount != peakCount)
  {
    g_adaptivePeakCount = peakCount;
    changed = true;
  }
  if(MathAbs(g_adaptivePeakSumPct - peakSum) > 0.01)
  {
    g_adaptivePeakSumPct = peakSum;
    changed = true;
  }

  if(changed)
  {
    SaveState();
    Log(StringFormat("Adaptive trail profile synced from API: avg=%.2f weeks=%d start=%.2f offset=%.2f src=%s",
                     g_adaptivePeakAvgPct,
                     g_adaptivePeakCount,
                     g_trailProfileStartPct,
                     g_trailProfileOffsetPct,
                     g_trailProfileSource));
  }
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

  bool requireFull = !AllowNonFullTradeModeForListing;
  if(ResolveSymbolByFamily(target, resolved, requireFull))
  {
    if(!IsAllowedSymbol(resolved))
      return false;
    return true;
  }

  string targetKey = NormalizeSymbolKey(target);
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

bool ResolveSymbolByFamily(const string apiSymbol, string &resolved, bool requireFull)
{
  string apiUpper = apiSymbol;
  StringToUpper(apiUpper);
  string apiKey = NormalizeSymbolKey(apiUpper);
  if(apiKey == "")
    return false;

  int family = 0;
  if(apiKey == "SPXUSD" || StringFind(apiKey, "SPX") >= 0 || StringFind(apiKey, "SP500") >= 0 || StringFind(apiKey, "US500") >= 0)
    family = 1; // S&P 500
  else if(apiKey == "NDXUSD" || StringFind(apiKey, "NDX") >= 0 || StringFind(apiKey, "NAS100") >= 0 || StringFind(apiKey, "US100") >= 0)
    family = 2; // Nasdaq 100
  else if(apiKey == "NIKKEIUSD" || StringFind(apiKey, "NIKKEI") >= 0 || StringFind(apiKey, "JPN225") >= 0 || StringFind(apiKey, "JP225") >= 0)
    family = 3; // Nikkei
  else if(apiKey == "WTIUSD" || StringFind(apiKey, "WTI") >= 0 || StringFind(apiKey, "USOIL") >= 0 || StringFind(apiKey, "USOUSD") >= 0 || StringFind(apiKey, "XTI") >= 0 || StringFind(apiKey, "USCRUDE") >= 0)
    family = 4; // WTI crude
  else
    return false;

  int bestScore = 2147483647;
  string bestSymbol = "";

  for(int pass = 0; pass < 2; pass++)
  {
    int total = SymbolsTotal(pass == 0);
    for(int i = 0; i < total; i++)
    {
      string sym = SymbolName(i, pass == 0);
      if(pass == 1 && !SymbolSelect(sym, true))
        continue;

      if(requireFull && !IsTradableSymbol(sym))
        continue;

      string symUpper = sym;
      StringToUpper(symUpper);
      string symKey = NormalizeSymbolKey(symUpper);
      if(symKey == "")
        continue;

      bool match = false;
      if(family == 1)
      {
        match = (StringFind(symKey, "SPX") >= 0 || StringFind(symKey, "SP500") >= 0 ||
                 StringFind(symKey, "SPX500") >= 0 || StringFind(symKey, "US500") >= 0);
      }
      else if(family == 2)
      {
        match = (StringFind(symKey, "NDX") >= 0 || StringFind(symKey, "NDX100") >= 0 ||
                 StringFind(symKey, "NAS100") >= 0 || StringFind(symKey, "US100") >= 0);
      }
      else if(family == 3)
      {
        match = (StringFind(symKey, "NIKKEI") >= 0 || StringFind(symKey, "NIKKEI225") >= 0 ||
                 StringFind(symKey, "NIK225") >= 0 || StringFind(symKey, "JPN225") >= 0 ||
                 StringFind(symKey, "JP225") >= 0);
      }
      else if(family == 4)
      {
        match = (StringFind(symKey, "WTI") >= 0 || StringFind(symKey, "USOIL") >= 0 ||
                 StringFind(symKey, "USOUSD") >= 0 || StringFind(symKey, "XTI") >= 0 ||
                 StringFind(symKey, "USCRUDE") >= 0 || StringFind(symKey, "CL") >= 0);
      }
      if(!match)
        continue;

      int score = MathAbs(StringLen(symKey) - StringLen(apiKey));
      if(score < bestScore)
      {
        bestScore = score;
        bestSymbol = sym;
      }
    }
  }

  if(bestSymbol == "")
    return false;

  resolved = bestSymbol;
  return true;
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

double NormalizeVolumeWithPolicy(const string symbol, double volume, bool strictUnderTarget, double maxOvershootPct, double targetVolume)
{
  double minVol = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MIN);
  double maxVol = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MAX);
  double step = SymbolInfoDouble(symbol, SYMBOL_VOLUME_STEP);
  if(minVol <= 0.0 || maxVol <= 0.0 || step <= 0.0)
    return 0.0;

  if(volume <= 0.0)
    return 0.0;
  if(volume > maxVol)
    volume = maxVol;

  int digits = (int)MathRound(-MathLog10(step));
  double floorSteps = MathFloor(volume / step + 1e-9);
  double ceilSteps = MathCeil(volume / step - 1e-9);
  double floorVol = NormalizeDouble(floorSteps * step, digits);
  double ceilVol = NormalizeDouble(ceilSteps * step, digits);

  if(floorVol > maxVol)
    floorVol = maxVol;
  if(ceilVol > maxVol)
    ceilVol = maxVol;

  if(floorVol < minVol)
    floorVol = minVol;
  if(ceilVol < minVol)
    ceilVol = minVol;

  if(strictUnderTarget || targetVolume <= 0.0)
    return floorVol;

  double floorDiff = MathAbs(floorVol - volume);
  double ceilDiff = MathAbs(ceilVol - volume);
  double chosen = (ceilDiff < floorDiff ? ceilVol : floorVol);
  if(chosen <= 0.0)
    return floorVol;

  if(chosen > targetVolume + 1e-9)
  {
    double overPct = (chosen - targetVolume) / targetVolume * 100.0;
    double limit = (maxOvershootPct > 0.0 ? maxOvershootPct : 0.0);
    if(overPct > limit + 1e-9)
      chosen = floorVol;
  }
  return chosen;
}

double EstimateMove1PctUsdPerLot(const string symbol, double priceHint)
{
  double refPrice = priceHint;
  if(refPrice <= 0.0)
    refPrice = SymbolInfoDouble(symbol, SYMBOL_BID);
  if(refPrice <= 0.0)
    refPrice = SymbolInfoDouble(symbol, SYMBOL_ASK);
  if(refPrice <= 0.0)
    refPrice = SymbolInfoDouble(symbol, SYMBOL_LAST);
  if(refPrice <= 0.0)
    return 0.0;

  double move = refPrice * 0.01;
  if(move <= 0.0)
    return 0.0;

  double entry = refPrice;
  double take = refPrice + move;
  double pnl = 0.0;
  if(OrderCalcProfit(ORDER_TYPE_BUY, symbol, 1.0, entry, take, pnl))
  {
    double absPnl = MathAbs(pnl);
    if(absPnl > 0.0)
      return absPnl;
  }

  double stop = refPrice - move;
  if(OrderCalcProfit(ORDER_TYPE_SELL, symbol, 1.0, entry, stop, pnl))
  {
    double absPnl = MathAbs(pnl);
    if(absPnl > 0.0)
      return absPnl;
  }
  return 0.0;
}

bool ProbeSymbolSpec(const string symbol, SymbolSpecProbe &probe)
{
  probe.ok = false;
  probe.reason = "";
  probe.price = 0.0;
  probe.bid = SymbolInfoDouble(symbol, SYMBOL_BID);
  probe.ask = SymbolInfoDouble(symbol, SYMBOL_ASK);
  probe.last = SymbolInfoDouble(symbol, SYMBOL_LAST);
  probe.point = SymbolInfoDouble(symbol, SYMBOL_POINT);
  probe.tickSize = SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_SIZE);
  probe.tickValue = SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_VALUE);
  probe.tickValueProfit = SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_VALUE_PROFIT);
  probe.tickValueLoss = SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_VALUE_LOSS);
  probe.contractSize = SymbolInfoDouble(symbol, SYMBOL_TRADE_CONTRACT_SIZE);
  probe.minLot = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MIN);
  probe.maxLot = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MAX);
  probe.lotStep = SymbolInfoDouble(symbol, SYMBOL_VOLUME_STEP);
  probe.digits = (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);
  probe.tradeMode = (int)SymbolInfoInteger(symbol, SYMBOL_TRADE_MODE);
  probe.move1pctPerLotUsd = 0.0;

  probe.price = probe.bid;
  if(probe.price <= 0.0)
    probe.price = probe.ask;
  if(probe.price <= 0.0)
    probe.price = probe.last;

  if(probe.price <= 0.0)
  {
    probe.reason = "probe_price";
    return false;
  }
  if(probe.minLot <= 0.0 || probe.maxLot <= 0.0 || probe.lotStep <= 0.0)
  {
    probe.reason = "probe_volume_spec";
    return false;
  }
  if(probe.tickSize <= 0.0)
  {
    probe.reason = "probe_tick_size";
    return false;
  }

  probe.volumeDigits = (int)MathRound(-MathLog10(probe.lotStep));
  probe.move1pctPerLotUsd = EstimateMove1PctUsdPerLot(symbol, probe.price);
  if(probe.move1pctPerLotUsd <= 0.0)
  {
    // Fallback to legacy tick-value-derived estimate when broker blocks OrderCalcProfit probing.
    double tickValue = probe.tickValueProfit;
    if(tickValue <= 0.0)
      tickValue = probe.tickValue;
    if(tickValue <= 0.0)
    {
      probe.reason = "probe_tick_value";
      return false;
    }
    double ticks = (probe.price * 0.01) / probe.tickSize;
    probe.move1pctPerLotUsd = ticks * tickValue;
    if(probe.move1pctPerLotUsd <= 0.0)
    {
      probe.reason = "probe_move_per_lot";
      return false;
    }
  }

  probe.ok = true;
  return true;
}

bool BuildSizingPolicy(const string symbol, const string assetClass, const SymbolSpecProbe &probe, SizingPolicy &policy, double &baseEquity)
{
  baseEquity = g_baselineEquity;
  if(baseEquity <= 0.0)
    baseEquity = AccountInfoDouble(ACCOUNT_BALANCE);
  if(baseEquity <= 0.0)
    baseEquity = AccountInfoDouble(ACCOUNT_EQUITY);
  if(baseEquity <= 0.0)
    return false;

  policy.profile = StrategyModeToString();
  policy.riskScale = GetLegRiskScale();
  policy.moveCapUsd = GetMove1PctCapUsd(symbol, assetClass, baseEquity);
  policy.strictUnderTarget = (SizingTolerance == SIZING_STRICT_UNDER_TARGET);
  policy.maxOvershootPct = SizingMaxOvershootPct;
  if(policy.maxOvershootPct < 0.0)
    policy.maxOvershootPct = 0.0;

  if(probe.tradeMode != SYMBOL_TRADE_MODE_FULL && !AllowNonFullTradeModeForListing)
    return false;
  return true;
}

double GetLotForSymbol(const string symbol, const string assetClass)
{
  return GetOneToOneLotForSymbol(symbol, assetClass);
}

double GetOneToOneLotForSymbol(const string symbol, const string assetClass)
{
  LegSizingResult sizing;
  if(!EvaluateLegSizing(symbol, assetClass, sizing))
    return 0.0;
  return sizing.finalLot;
}

double GetLegRiskScale()
{
  if(IsFiveersMode())
    return 0.10;
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
  if(IsFiveersMode())
    return "Low";
  if(RiskMode == RISK_HIGH)
    return "God Mode";
  if(RiskMode == RISK_LOW)
    return "Low";
  if(RiskMode == RISK_NORMAL)
    return "Normal";
  if(RiskMode == RISK_GOD)
    return "God Mode";
  return "Custom";
}

string StrategyModeToString()
{
  StrategyProfile mode = GetEffectiveStrategyMode();
  if(mode == PROFILE_EIGHTCAP)
    return "EIGHTCAP";
  if(mode == PROFILE_5ERS)
    return "5ERS";
  if(mode == PROFILE_AUTO)
    return "AUTO";
  return "CUSTOM";
}

string GetProfileLabel()
{
  if(ProfileLabelOverride != "")
    return ProfileLabelOverride;
  return StrategyModeToString();
}

string GetAccountClassLabel()
{
  if(AccountClassLabelOverride != "")
    return AccountClassLabelOverride;

  StrategyProfile mode = GetEffectiveStrategyMode();
  if(mode == PROFILE_5ERS)
    return "Prop Account";
  return "Broker Account";
}

string GetUserLabel()
{
  if(UserLabel != "")
    return UserLabel;
  if(AccountLabel != "")
    return AccountLabel;

  string accountName = AccountInfoString(ACCOUNT_NAME);
  if(accountName != "")
    return accountName;

  return IntegerToString((long)AccountInfoInteger(ACCOUNT_LOGIN));
}

StrategyProfile GetEffectiveStrategyMode()
{
  if(StrategyMode == PROFILE_EIGHTCAP || StrategyMode == PROFILE_5ERS || StrategyMode == PROFILE_CUSTOM)
    return StrategyMode;
  if(!AutoProfileByBroker)
    return PROFILE_CUSTOM;
  if(BrokerMatchesHints(FiveersBrokerHints))
    return PROFILE_5ERS;
  if(BrokerMatchesHints(EightcapBrokerHints))
    return PROFILE_EIGHTCAP;
  return PROFILE_CUSTOM;
}

string NormalizeBrokerText(const string value)
{
  string out = value;
  StringToLower(out);
  StringReplace(out, " ", "");
  StringReplace(out, "-", "");
  StringReplace(out, "_", "");
  StringReplace(out, ".", "");
  StringReplace(out, ",", "");
  return out;
}

bool BrokerMatchesHints(const string hintsCsv)
{
  string haystack = NormalizeBrokerText(AccountInfoString(ACCOUNT_COMPANY) + "|" + AccountInfoString(ACCOUNT_SERVER));
  string csv = hintsCsv;
  int start = 0;
  while(start < StringLen(csv))
  {
    int comma = StringFind(csv, ",", start);
    if(comma < 0)
      comma = StringLen(csv);
    string token = StringSubstr(csv, start, comma - start);
    token = NormalizeBrokerText(token);
    if(token != "" && StringFind(haystack, token) >= 0)
      return true;
    start = comma + 1;
  }
  return false;
}

bool IsFiveersMode()
{
  return (GetEffectiveStrategyMode() == PROFILE_5ERS);
}

bool IsEightcapMode()
{
  return (GetEffectiveStrategyMode() == PROFILE_EIGHTCAP);
}

string ShortReasonTag(const string reasonTag)
{
  string tag = reasonTag;
  StringToLower(tag);
  if(tag == "basket_tp")
    return "basket_tp";
  if(tag == "basket_sl")
    return "basket_sl";
  if(tag == "trail_lock")
    return "trail_lock";
  if(tag == "weekly_flip")
    return "weekly_flip";
  if(tag == "added_loser")
    return "added_loser";
  if(tag == "manual")
    return "manual";
  if(tag == "signal")
    return "signal";
  return "generic";
}

string BuildOpenOrderComment(const string model, const string reasonTag)
{
  string normalizedModel = NormalizeModelName(model);
  string s = StringFormat("LimniBasket %s %s %s", normalizedModel, ShortReasonTag(reasonTag), g_reportDate);
  return CompactText(s, 31);
}

string BuildCloseOrderComment(const string reasonTag)
{
  string s = StringFormat("LimniClose %s", ShortReasonTag(reasonTag));
  return CompactText(s, 31);
}

string MarginModeToString()
{
  int mode = (int)AccountInfoInteger(ACCOUNT_MARGIN_MODE);
  if(mode == ACCOUNT_MARGIN_MODE_RETAIL_HEDGING)
    return "HEDGED";
  if(mode == ACCOUNT_MARGIN_MODE_RETAIL_NETTING || mode == ACCOUNT_MARGIN_MODE_EXCHANGE)
    return "NET";
  return "UNKNOWN";
}

bool IsHedgingAccount()
{
  return ((int)AccountInfoInteger(ACCOUNT_MARGIN_MODE) == ACCOUNT_MARGIN_MODE_RETAIL_HEDGING);
}

bool IsNettingAccount()
{
  int mode = (int)AccountInfoInteger(ACCOUNT_MARGIN_MODE);
  return (mode == ACCOUNT_MARGIN_MODE_RETAIL_NETTING || mode == ACCOUNT_MARGIN_MODE_EXCHANGE);
}

bool ShouldRequireHedgingAccount()
{
  // 5ERS enforces net-only execution. Other profiles follow the input flag.
  if(IsFiveersMode())
    return false;
  return RequireHedgingAccount;
}

bool ShouldRequireNettingAccount()
{
  return IsFiveersMode();
}

bool IsAccountStructureAllowed()
{
  if(ShouldRequireNettingAccount())
    return IsNettingAccount();
  if(ShouldRequireHedgingAccount())
    return IsHedgingAccount();
  return true;
}

bool IsBasketTakeProfitEnabled()
{
  if(IsFiveersMode())
    return true;
  if(IsEightcapMode())
    return false;
  return EnableBasketTakeProfit;
}

double GetEffectiveBasketTakeProfitPct()
{
  if(IsFiveersMode())
    return FiveersBasketTakeProfitPct;
  if(IsEightcapMode())
    return 0.0;
  return BasketTakeProfitPct;
}

bool IsBasketStopLossEnabled()
{
  if(IsFiveersMode())
    return true;
  if(IsEightcapMode())
    return (EightcapEmergencyStopPct > 0.0);
  return EnableBasketStopLoss;
}

double GetEffectiveBasketStopLossPct()
{
  if(IsFiveersMode())
    return FiveersBasketStopLossPct;
  if(IsEightcapMode())
    return EightcapEmergencyStopPct;
  return BasketStopLossPct;
}

bool IsAdaptiveTrailEnabled()
{
  if(IsFiveersMode())
    return false;
  if(IsEightcapMode())
    return true;
  return EnableAdaptiveTrail;
}

bool IsEquityTrailEnabled()
{
  if(IsFiveersMode())
    return false;
  if(IsEightcapMode())
    return true;
  return EnableEquityTrail;
}

double GetEffectiveTrailStartPct()
{
  if(!IsEquityTrailEnabled())
    return 0.0;

  if(!IsAdaptiveTrailEnabled())
    return EquityTrailStartPct;

  // No adaptive history yet: fall back to configured static trail settings.
  bool hasAdaptiveHistory = (g_adaptivePeakCount > 0 && g_adaptivePeakAvgPct > 0.0);
  if(!hasAdaptiveHistory)
    return MathMax(0.0, EquityTrailStartPct);

  double raw = g_adaptivePeakAvgPct * AdaptiveTrailStartMultiplier;
  double minStart = AdaptiveTrailMinStartPct;
  double maxStart = AdaptiveTrailMaxStartPct;
  if(minStart <= 0.0)
    minStart = 30.0;
  if(maxStart < minStart)
    maxStart = minStart;
  return MathMax(minStart, MathMin(raw, maxStart));
}

double GetEffectiveTrailOffsetPct()
{
  if(!IsEquityTrailEnabled())
    return 0.0;

  if(!IsAdaptiveTrailEnabled())
    return EquityTrailOffsetPct;

  bool hasAdaptiveHistory = (g_adaptivePeakCount > 0 && g_adaptivePeakAvgPct > 0.0);
  if(!hasAdaptiveHistory)
    return MathMax(0.0, EquityTrailOffsetPct);

  double start = GetEffectiveTrailStartPct();
  double raw = start * AdaptiveTrailOffsetFraction;
  double minOffset = AdaptiveTrailMinOffsetPct;
  double maxOffset = AdaptiveTrailMaxOffsetPct;
  if(minOffset <= 0.0)
    minOffset = 8.0;
  if(maxOffset < minOffset)
    maxOffset = minOffset;
  return MathMax(minOffset, MathMin(raw, maxOffset));
}

bool ShouldEnforcePerOrderStopLoss()
{
  // Broker rule: per-order SL is mandatory only for 5ers mode.
  return IsFiveersMode();
}

void UpdateAdaptivePeakAverageFromWeek()
{
  if(!IsAdaptiveTrailEnabled())
    return;
  if(g_baselineEquity <= 0.0 || g_weekPeakEquity <= 0.0)
    return;
  if(g_weekPeakEquity <= g_baselineEquity)
    return;

  double peakPct = (g_weekPeakEquity - g_baselineEquity) / g_baselineEquity * 100.0;
  if(peakPct <= 0.0)
    return;

  g_lastWeekPeakPct = peakPct;
  if(g_adaptivePeakCount < 0)
    g_adaptivePeakCount = 0;
  if(g_adaptivePeakSumPct < 0.0)
    g_adaptivePeakSumPct = 0.0;
  g_adaptivePeakCount++;
  g_adaptivePeakSumPct += peakPct;
  if(g_adaptivePeakCount > 0)
    g_adaptivePeakAvgPct = g_adaptivePeakSumPct / (double)g_adaptivePeakCount;
  else
    g_adaptivePeakAvgPct = 0.0;

  SaveState();
  Log(StringFormat("Adaptive peak updated: last=%.2f%% avg=%.2f%% weeks=%d",
                   g_lastWeekPeakPct, g_adaptivePeakAvgPct, g_adaptivePeakCount));
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

double ClampVolumeToMax(const string symbol, double desiredVolume, double maxCap)
{
  if(desiredVolume <= 0.0 || maxCap <= 0.0)
    return 0.0;

  double minVol = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MIN);
  double step = SymbolInfoDouble(symbol, SYMBOL_VOLUME_STEP);
  if(minVol <= 0.0 || step <= 0.0)
    return 0.0;
  if(maxCap < minVol)
    return 0.0;

  double capped = MathMin(desiredVolume, maxCap);
  if(capped < minVol)
    return 0.0;

  double steps = MathFloor(capped / step + 1e-9);
  double normalized = steps * step;
  int digits = (int)MathRound(-MathLog10(step));
  normalized = NormalizeDouble(normalized, digits);
  if(normalized < minVol)
    return 0.0;
  if(normalized > maxCap + 1e-9)
    normalized = ClampVolumeToMax(symbol, normalized - step, maxCap);
  return normalized;
}

bool TryGetCsvSymbolDouble(const string csv, const string symbol, double &value)
{
  value = 0.0;
  if(csv == "" || symbol == "")
    return false;

  string target = NormalizeSymbolKey(symbol);
  if(target == "")
    return false;

  string raw = csv;
  StringReplace(raw, " ", "");
  int start = 0;
  while(start < StringLen(raw))
  {
    int comma = StringFind(raw, ",", start);
    if(comma < 0)
      comma = StringLen(raw);
    string token = StringSubstr(raw, start, comma - start);
    int eq = StringFind(token, "=");
    if(eq > 0)
    {
      string key = StringSubstr(token, 0, eq);
      string rawVal = StringSubstr(token, eq + 1);
      StringToUpper(key);
      string normKey = NormalizeSymbolKey(key);
      if(normKey != "" && (normKey == target || StringFind(target, normKey) == 0 || StringFind(normKey, target) == 0))
      {
        double parsed = StringToDouble(rawVal);
        if(parsed > 0.0)
        {
          value = parsed;
          return true;
        }
      }
    }
    start = comma + 1;
  }
  return false;
}

double GetMove1PctCapUsd(const string symbol, const string assetClass, double baseEquity)
{
  if(!EnableSizingGuard || baseEquity <= 0.0)
    return 0.0;

  double pct = IsFiveersMode() ? FiveersMaxLegMove1PctOfEquity : MaxLegMove1PctOfEquity;
  double parsed = 0.0;
  if(TryGetCsvSymbolDouble(SymbolMove1PctCapOfEquity, symbol, parsed) && parsed > 0.0)
    pct = parsed;
  if(IsFiveersMode() && TryGetCsvSymbolDouble(FiveersSymbolMove1PctCapOfEquity, symbol, parsed) && parsed > 0.0)
    pct = parsed;
  if(pct <= 0.0)
    return 0.0;
  return baseEquity * pct / 100.0;
}

bool EvaluateLegSizingLegacy(const string symbol, const string assetClass, LegSizingResult &result)
{
  result.ok = false;
  result.reasonKey = "";
  result.profile = "EIGHTCAP";
  result.toleranceMode = "strict_under_target";
  result.targetLot = 0.0;
  result.solvedLotRaw = 0.0;
  result.postClampLot = 0.0;
  result.finalLot = 0.0;
  result.deviationPct = 0.0;
  result.equityPerSymbol = 0.0;
  result.targetRiskUsd = 0.0;
  result.marginRequired = 0.0;
  result.move1pctUsd = 0.0;
  result.move1pctPerLotUsd = 0.0;
  result.move1pctCapUsd = 0.0;
  result.specPrice = 0.0;
  result.specTickSize = 0.0;
  result.specTickValue = 0.0;
  result.specContractSize = 0.0;
  result.specMinLot = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MIN);
  result.specMaxLot = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MAX);
  result.specLotStep = SymbolInfoDouble(symbol, SYMBOL_VOLUME_STEP);

  if(!ComputeOneToOneLot(symbol, assetClass, result.targetLot, result.finalLot,
                         result.deviationPct, result.equityPerSymbol, result.marginRequired))
  {
    result.reasonKey = "compute_failed";
    return false;
  }

  ApplyRiskScale(symbol, GetLegRiskScale(), result.targetLot, result.finalLot,
                 result.deviationPct, result.equityPerSymbol, result.marginRequired);
  if(result.finalLot <= 0.0)
  {
    result.reasonKey = "risk_scale_zero";
    return false;
  }

  if(EnableSizingGuard)
  {
    result.move1pctUsd = ComputeMove1PctUsd(symbol, result.finalLot);
    result.move1pctCapUsd = GetMove1PctCapUsd(symbol, assetClass, result.equityPerSymbol);
    if(result.move1pctCapUsd > 0.0 && result.move1pctUsd > result.move1pctCapUsd + 1e-9)
    {
      double ratio = result.move1pctCapUsd / result.move1pctUsd;
      double adjusted = result.finalLot * ratio;
      result.finalLot = ClampVolumeToMax(symbol, adjusted, result.finalLot);
      if(result.finalLot <= 0.0)
      {
        result.reasonKey = "move1pct_cap";
        return false;
      }
      result.move1pctUsd = ComputeMove1PctUsd(symbol, result.finalLot);
    }
  }
  else
  {
    result.move1pctUsd = ComputeMove1PctUsd(symbol, result.finalLot);
  }

  result.marginRequired = CalculateMarginRequired(symbol, result.finalLot);
  if(result.targetLot > 0.0)
    result.deviationPct = (result.finalLot - result.targetLot) / result.targetLot * 100.0;
  else
    result.deviationPct = 0.0;
  result.solvedLotRaw = result.targetLot;
  result.postClampLot = result.finalLot;
  if(result.finalLot > 0.0)
    result.move1pctPerLotUsd = result.move1pctUsd / result.finalLot;
  result.ok = (result.finalLot > 0.0);
  if(!result.ok && result.reasonKey == "")
    result.reasonKey = "invalid_volume";
  return result.ok;
}

bool EvaluateLegSizing(const string symbol, const string assetClass, LegSizingResult &result)
{
  if(IsEightcapMode())
    return EvaluateLegSizingLegacy(symbol, assetClass, result);

  result.ok = false;
  result.reasonKey = "";
  result.profile = StrategyModeToString();
  result.toleranceMode = (SizingTolerance == SIZING_STRICT_UNDER_TARGET
                          ? "strict_under_target"
                          : "nearest_step_bounded_overshoot");
  result.targetLot = 0.0;
  result.solvedLotRaw = 0.0;
  result.postClampLot = 0.0;
  result.finalLot = 0.0;
  result.deviationPct = 0.0;
  result.equityPerSymbol = 0.0;
  result.targetRiskUsd = 0.0;
  result.marginRequired = 0.0;
  result.move1pctUsd = 0.0;
  result.move1pctPerLotUsd = 0.0;
  result.move1pctCapUsd = 0.0;
  result.specPrice = 0.0;
  result.specTickSize = 0.0;
  result.specTickValue = 0.0;
  result.specContractSize = 0.0;
  result.specMinLot = 0.0;
  result.specMaxLot = 0.0;
  result.specLotStep = 0.0;

  SymbolSpecProbe probe;
  if(!ProbeSymbolSpec(symbol, probe))
  {
    result.reasonKey = (probe.reason != "" ? probe.reason : "probe_failed");
    return false;
  }

  result.specPrice = probe.price;
  result.specTickSize = probe.tickSize;
  result.specTickValue = (probe.tickValueProfit > 0.0 ? probe.tickValueProfit : probe.tickValue);
  result.specContractSize = probe.contractSize;
  result.specMinLot = probe.minLot;
  result.specMaxLot = probe.maxLot;
  result.specLotStep = probe.lotStep;
  result.move1pctPerLotUsd = probe.move1pctPerLotUsd;

  SizingPolicy policy;
  double baseEquity = 0.0;
  if(!BuildSizingPolicy(symbol, assetClass, probe, policy, baseEquity))
  {
    result.reasonKey = "policy_invalid";
    return false;
  }
  result.profile = policy.profile;
  result.equityPerSymbol = baseEquity;

  double multiplier = GetAssetMultiplier(assetClass);
  result.targetRiskUsd = baseEquity * 0.01 * multiplier * policy.riskScale;
  if(result.targetRiskUsd <= 0.0 || result.move1pctPerLotUsd <= 0.0)
  {
    result.reasonKey = "risk_target_zero";
    return false;
  }

  result.solvedLotRaw = result.targetRiskUsd / result.move1pctPerLotUsd;
  result.targetLot = result.solvedLotRaw;
  if(result.solvedLotRaw <= 0.0)
  {
    result.reasonKey = "solve_zero";
    return false;
  }

  double hardMax = probe.maxLot;
  if(hardMax < probe.minLot)
  {
    result.reasonKey = "broker_max_below_min";
    return false;
  }

  double preClamp = MathMin(result.solvedLotRaw, hardMax);
  result.postClampLot = NormalizeVolumeWithPolicy(symbol, preClamp, policy.strictUnderTarget, policy.maxOvershootPct, result.solvedLotRaw);
  if(result.postClampLot <= 0.0)
  {
    result.reasonKey = "normalize_failed";
    return false;
  }

  result.finalLot = result.postClampLot;
  result.move1pctUsd = result.finalLot * result.move1pctPerLotUsd;
  result.move1pctCapUsd = policy.moveCapUsd;

  if(result.move1pctCapUsd > 0.0 && result.move1pctUsd > result.move1pctCapUsd + 1e-9)
  {
    double moveCapLot = result.move1pctCapUsd / result.move1pctPerLotUsd;
    double reducedCap = MathMin(result.finalLot, moveCapLot);
    double adjusted = NormalizeVolumeWithPolicy(symbol, reducedCap, true, policy.maxOvershootPct, moveCapLot);
    if(adjusted <= 0.0)
    {
      result.reasonKey = "move1pct_cap";
      return false;
    }
    result.finalLot = adjusted;
    result.move1pctUsd = result.finalLot * result.move1pctPerLotUsd;
  }

  result.marginRequired = CalculateMarginRequired(symbol, result.finalLot);
  if(result.targetLot > 0.0)
    result.deviationPct = (result.finalLot - result.targetLot) / result.targetLot * 100.0;
  else
    result.deviationPct = 0.0;

  result.ok = (result.finalLot > 0.0);
  if(!result.ok)
    result.reasonKey = "invalid_volume";
  return result.ok;
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
  string key = ScopeKey("Size_" + symbol);
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

bool HasPositionForSymbol(const string symbol)
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
    if(PositionGetString(POSITION_SYMBOL) != symbol)
      continue;
    return true;
  }
  return false;
}

bool HasPositionForModel(const string symbol, const string model)
{
  int count = PositionsTotal();
  string targetModel = NormalizeModelName(model);
  string tag = "LimniBasket " + targetModel;
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
    // In strict net mode (5ERS), only one symbol position is allowed regardless of model tag/comment.
    if(IsFiveersMode())
      return true;
    string comment = PositionGetString(POSITION_COMMENT);
    if(StringFind(comment, tag) >= 0)
      return true;
  }
  return false;
}

bool HasMissingPlannedModelsForSymbol(const string symbol)
{
  if(symbol == "")
    return false;
  if(IsFiveersMode())
    return false;

  string checkedModels[];
  ArrayResize(checkedModels, 0);

  for(int i = 0; i < ArraySize(g_brokerSymbols); i++)
  {
    if(g_brokerSymbols[i] != symbol)
      continue;

    string plannedModel = NormalizeModelName(i < ArraySize(g_models) ? g_models[i] : "blended");
    bool alreadyChecked = false;
    for(int m = 0; m < ArraySize(checkedModels); m++)
    {
      if(checkedModels[m] == plannedModel)
      {
        alreadyChecked = true;
        break;
      }
    }
    if(alreadyChecked)
      continue;

    int size = ArraySize(checkedModels);
    ArrayResize(checkedModels, size + 1);
    checkedModels[size] = plannedModel;

    if(!HasPositionForModel(symbol, plannedModel))
      return true;
  }

  return false;
}

int GetNetSignalForSymbol(const string symbol)
{
  int net = 0;
  for(int i = 0; i < ArraySize(g_brokerSymbols); i++)
  {
    if(g_brokerSymbols[i] != symbol)
      continue;
    if(i >= ArraySize(g_directions))
      continue;
    int dir = g_directions[i];
    if(dir > 0)
      net += 1;
    else if(dir < 0)
      net -= 1;
  }
  return net;
}

string GetNetModelForSymbol(const string symbol, int netDirection)
{
  string fallback = "blended";
  string firstMatch = "";
  bool hasDirectionalMatch = false;
  int targetDir = (netDirection > 0 ? 1 : -1);

  for(int i = 0; i < ArraySize(g_brokerSymbols); i++)
  {
    if(g_brokerSymbols[i] != symbol)
      continue;

    string model = NormalizeModelName(i < ArraySize(g_models) ? g_models[i] : "blended");
    int dir = (i < ArraySize(g_directions) ? g_directions[i] : 0);
    if(firstMatch == "")
      firstMatch = model;

    if(dir != targetDir)
      continue;
    hasDirectionalMatch = true;
    if(model == "blended")
      return model;
    if(fallback == "blended")
      fallback = model;
  }

  if(hasDirectionalMatch)
    return fallback;
  if(firstMatch != "")
    return firstMatch;
  return "blended";
}

string NormalizeModelName(const string value)
{
  string normalized = value;
  StringTrimLeft(normalized);
  StringTrimRight(normalized);
  StringToLower(normalized);
  if(normalized == "")
    return "blended";
  if(normalized == "anti_kythera" || normalized == "anti-kythera")
    return "antikythera";
  if(normalized == "dealers")
    return "dealer";
  if(normalized == "commercials")
    return "commercial";
  return normalized;
}

bool IsFreshEntryWindow(datetime nowGmt)
{
  if(nowGmt < g_weekStartGmt)
    return false;
  int hoursSinceWeekStart = (int)((nowGmt - g_weekStartGmt) / 3600);
  return (hoursSinceWeekStart <= MidWeekAttachGraceHours);
}

bool IsMidWeekAttachBlocked(datetime nowGmt)
{
  if(!PreventMidWeekAttach)
    return false;
  if(nowGmt < g_weekStartGmt)
    return false;
  if(IsFreshEntryWindow(nowGmt))
    return false;
  return (g_eaAttachTime >= g_weekStartGmt);
}

//+------------------------------------------------------------------+
void UpdateState()
{
  datetime nowGmt = TimeGMT();
  bool afterStart = (nowGmt >= g_weekStartGmt);
  bool hasPositions = HasOpenPositions();

  // Re-attach safety: if positions already exist, keep state aligned so management/add logic can run.
  if(hasPositions)
  {
    if(g_baselineEquity <= 0.0)
      g_baselineEquity = AccountInfoDouble(ACCOUNT_BALANCE);

    if(g_apiOk && g_tradingAllowed)
    {
      if(g_state != STATE_ACTIVE)
      {
        g_state = STATE_ACTIVE;
        g_basketTpArmedAt = TimeCurrent();
        g_basketTpGraceLogged = false;
        SaveState();
        Log("State -> ACTIVE (open positions detected on attach).");
      }
    }
    else
    {
      if(g_state != STATE_PAUSED)
      {
        g_state = STATE_PAUSED;
        SaveState();
        Log("State -> PAUSED (open positions with API disallowed/unavailable).");
      }
    }
    return;
  }

  if(!hasPositions && IsMidWeekAttachBlocked(nowGmt))
  {
    if(g_state != STATE_IDLE)
    {
      g_state = STATE_IDLE;
      SaveState();
    }
    return;
  }

  if(!afterStart && !hasPositions && g_state != STATE_IDLE)
  {
    g_state = STATE_IDLE;
    Log("State -> IDLE (before Sunday open).");
  }

  if(afterStart && g_state == STATE_IDLE && !hasPositions)
  {
    if(PreventMidWeekAttach && !IsFreshEntryWindow(nowGmt))
    {
      return;
    }

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
      g_basketTpArmedAt = TimeCurrent();
      g_basketTpGraceLogged = false;
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
      g_basketTpArmedAt = TimeCurrent();
      g_basketTpGraceLogged = false;
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
    g_baselineEquity = AccountInfoDouble(ACCOUNT_BALANCE);

  double profitPct = (equity - g_baselineEquity) / g_baselineEquity * 100.0;
  double profitUsd = equity - g_baselineEquity;
  bool wasTrailing = g_trailingActive;
  bool basketTpEnabled = IsBasketTakeProfitEnabled();
  double basketTpPct = GetEffectiveBasketTakeProfitPct();
  bool basketSlEnabled = IsBasketStopLossEnabled();
  double basketSlPct = GetEffectiveBasketStopLossPct();
  bool trailEnabled = IsEquityTrailEnabled();
  double trailStartPct = GetEffectiveTrailStartPct();
  double trailOffsetPct = GetEffectiveTrailOffsetPct();
  datetime now = TimeCurrent();
  bool basketTpArmed = (now >= g_basketTpArmedAt);
  if(!basketTpArmed && !g_basketTpGraceLogged)
  {
    int left = (int)(g_basketTpArmedAt - now);
    if(left < 0)
      left = 0;
    Log(StringFormat("Basket TP grace active (%d sec remaining).", left));
    g_basketTpGraceLogged = true;
  }
  if(basketTpArmed)
    g_basketTpGraceLogged = false;

  bool basketSlHitPct = (basketSlEnabled && basketSlPct > 0.0 && profitPct <= -basketSlPct);
  if(basketSlHitPct && !g_closeRequested)
  {
    g_closeRequested = true;
    SaveState();
    Log(StringFormat("Basket SL hit (pnl=%.2f%% / %.2f USD). Closing all positions.", profitPct, profitUsd));
    CloseAllPositions("basket_sl");
    return;
  }

  bool basketTpHitPct = (basketTpEnabled && basketTpArmed &&
                         basketTpPct > 0.0 && profitPct >= basketTpPct);
  bool basketTpHitUsd = (basketTpEnabled && basketTpArmed &&
                         BasketTakeProfitUsd > 0.0 && profitUsd >= BasketTakeProfitUsd);
  if((basketTpHitPct || basketTpHitUsd) && !g_closeRequested)
  {
    g_closeRequested = true;
    SaveState();
    Log(StringFormat("Basket TP hit (pnl=%.2f%% / %.2f USD). Closing all positions.", profitPct, profitUsd));
    CloseAllPositions("basket_tp");
    return;
  }

  if(trailEnabled && trailStartPct > 0.0 && profitPct >= trailStartPct)
  {
    g_trailingActive = true;
    if(!wasTrailing)
      Log(StringFormat("Equity trail activated at %.2f%%", profitPct));

    double peakProfitPct = (g_weekPeakEquity - g_baselineEquity) / g_baselineEquity * 100.0;
    double newLocked = peakProfitPct - trailOffsetPct;
    if(newLocked > g_lockedProfitPct)
    {
      g_lockedProfitPct = newLocked;
      SaveState();
      Log(StringFormat("Equity trail lock updated: %.2f%%", g_lockedProfitPct));
    }
  }
  if(!trailEnabled)
  {
    g_trailingActive = false;
    g_lockedProfitPct = 0.0;
  }

  if(g_trailingActive && g_lockedProfitPct > 0.0 && profitPct <= g_lockedProfitPct)
  {
    g_closeRequested = true;
    SaveState();
    Log(StringFormat("Equity trail hit %.2f%%. Closing all positions and pausing.", g_lockedProfitPct));
    CloseAllPositions("trail_lock");
  }
}
//+------------------------------------------------------------------+
void TryAddPositions()
{
  if(ManualMode)
    return;
  if(!g_apiOk || !g_tradingAllowed || g_closeRequested)
    return;
  if(!IsAccountStructureAllowed())
  {
    if(IsFiveersMode())
    {
      // Some servers report hedged mode even when user policy requires net behavior.
      // Continue in 5ERS with strict one-position-per-symbol guards instead of hard-blocking.
      datetime nowWarn = TimeCurrent();
      if(g_lastStructureWarn == 0 || (nowWarn - g_lastStructureWarn) >= 300)
      {
        LogTradeError(StringFormat("Account structure reports %s in 5ERS mode. Continuing with strict symbol-net enforcement.",
                                   MarginModeToString()));
        g_lastStructureWarn = nowWarn;
      }
    }
    else
    {
      LogTradeError(StringFormat("Account structure mismatch for mode %s (account=%s). Blocking new entries.",
                                 StrategyModeToString(), MarginModeToString()));
      return;
    }
  }

  string universeReason = "";
  if(!IsUniverseSizingReady(universeReason))
  {
    datetime nowWarn = TimeCurrent();
    if(g_lastUniverseGateWarn == 0 || (nowWarn - g_lastUniverseGateWarn) >= 60)
    {
      LogTradeError(StringFormat(
        "Universe/sizing gate blocked new entries: %s (require_all=%s, expected=%d, planned=%d, missing=%s)",
        universeReason,
        RequireFullUniverseSizingReady ? "true" : "false",
        CountExpectedUniversePairs(),
        CountUniquePlannedPairs(),
        GetMissingUniversePairs()
      ));
      g_lastUniverseGateWarn = nowWarn;
    }
    return;
  }

  datetime nowGmt = TimeGMT();
  if(IsMidWeekAttachBlocked(nowGmt))
    return;

  ReconcilePositionsWithSignals();

  double totalLots = GetTotalBasketLots();
  datetime cryptoStartGmt = GetCryptoWeekStartGmt(nowGmt);
  int openPositions = CountOpenPositions();

  Log(StringFormat("TryAddPositions start: %d signals in queue, %d positions open",
                   ArraySize(g_brokerSymbols), openPositions));

  if(openPositions >= MaxOpenPositions)
  {
    AddSkipReason("max_positions");
    LogIndexSkipsForAll("max open positions reached", "max_positions");
    return;
  }

  if(OrdersInLastMinute() >= MaxOrdersPerMinute)
  {
    AddSkipReason("rate_limit");
    LogIndexSkipsForAll("order rate limit reached", "rate_limit");
    LogTradeError("Order rate limit reached. Skipping adds.");
    return;
  }

  // 5ERS strict netting: only one order attempt per symbol per pass.
  string seenSymbols[];
  ArrayResize(seenSymbols, 0);

  for(int i = 0; i < ArraySize(g_brokerSymbols); i++)
  {
    string symbol = g_brokerSymbols[i];
    int direction = g_directions[i];
    if(symbol == "" || direction == 0)
    {
      Log(StringFormat("TryAdd %d SKIP: empty symbol or zero direction", i));
      continue;
    }

    string assetClass = (i < ArraySize(g_assetClasses) ? g_assetClasses[i] : "fx");
    string model = NormalizeModelName(i < ArraySize(g_models) ? g_models[i] : "blended");
    Log(StringFormat("TryAdd %d: symbol=%s model=%s dir=%d asset=%s", i, symbol, model, direction, assetClass));

    if(IsFiveersMode())
    {
      bool alreadySeen = false;
      for(int s = 0; s < ArraySize(seenSymbols); s++)
      {
        if(seenSymbols[s] == symbol)
        {
          alreadySeen = true;
          break;
        }
      }
      if(alreadySeen)
      {
        AddSkipReason("duplicate_open");
        Log(StringFormat("TryAdd %d SKIP: symbol %s already processed this pass (5ERS net mode)", i, symbol));
        continue;
      }
      int seenSize = ArraySize(seenSymbols);
      ArrayResize(seenSymbols, seenSize + 1);
      seenSymbols[seenSize] = symbol;

      int netSignal = GetNetSignalForSymbol(symbol);
      if(netSignal == 0)
      {
        Log(StringFormat("TryAdd %d SKIP: symbol %s net signal is flat in 5ERS mode", i, symbol));
        continue;
      }
      direction = (netSignal > 0 ? 1 : -1);
      model = GetNetModelForSymbol(symbol, direction);
      Log(StringFormat("TryAdd %d 5ERS net: symbol=%s net=%d dir=%d model=%s",
                       i, symbol, netSignal, direction, model));
    }

    if(IsFiveersMode() && HasPositionForSymbol(symbol))
    {
      AddSkipReason("duplicate_open");
      Log(StringFormat("TryAdd %d SKIP: 5ERS net mode allows one live position per symbol (%s already open)", i, symbol));
      continue;
    }

    if(HasPositionForModel(symbol, model))
    {
      if(HasMissingPlannedModelsForSymbol(symbol))
      {
        AddSkipReason("pending_leg_fill");
        Log(StringFormat("TryAdd %d SKIP: defer loser add for %s %s (planned legs still missing)",
                         i, symbol, model));
        continue;
      }
      Log(StringFormat("TryAdd %d: position exists, trying loser add", i));
      if(TryAddToLosingLeg(symbol, model, direction, assetClass))
      {
        totalLots = GetTotalBasketLots();
        openPositions = CountOpenPositions();
      }
      else
      {
        AddSkipReason("duplicate_open");
      }
      continue;
    }

    Log(StringFormat("TryAdd %d: no position exists, will attempt to open", i));

    if(PreventMidWeekAttach && !IsFreshEntryWindow(nowGmt))
    {
      AddSkipReason("entry_window_closed");
      continue;
    }

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
    LegSizingResult sizing;
    bool ok = EvaluateLegSizing(symbol, assetClass, sizing);
    double vol = sizing.finalLot;
    if(IsFiveersMode())
    {
      int netSignal = GetNetSignalForSymbol(symbol);
      int netMagnitude = MathAbs(netSignal);
      if(netMagnitude <= 0)
      {
        Log(StringFormat("TryAdd %d SKIP: symbol %s net magnitude is zero in 5ERS mode", i, symbol));
        continue;
      }
      double scaled = vol * netMagnitude;
      vol = NormalizeVolumeWithPolicy(symbol, scaled, true, SizingMaxOvershootPct, scaled);
      if(vol > 0.0)
      {
        Log(StringFormat("TryAdd %d 5ERS net sizing: symbol=%s base=%.4f net=%d final=%.4f",
                         i, symbol, sizing.finalLot, netMagnitude, vol));
      }
    }
    if(vol <= 0.0)
    {
      AddSkipReason("sizing_guard");
      if(IsIndexSymbol(symbol))
        LogIndexSkip(symbol, StringFormat("sizing blocked (%s) volume %.2f", sizing.reasonKey, vol), "sizing_guard");
      LogTradeError(StringFormat("%s sizing blocked (%s) volume=%.2f", symbol, sizing.reasonKey, vol));
      continue;
    }

    // Respect broker max directional symbol volume (prevents ret=10034 "limit volume").
    double limitedVol = ClampVolumeToSymbolDirectionLimit(symbol, direction, vol);
    if(limitedVol <= 0.0)
    {
      AddSkipReason("max_volume_reached");
      double symbolLimit = SymbolInfoDouble(symbol, SYMBOL_VOLUME_LIMIT);
      double usedDirVol = GetDirectionalOpenVolume(symbol, direction);
      LogTradeError(StringFormat("%s max volume reached pre-send (limit=%.2f used_dir=%.2f req=%.4f)",
                                 symbol, symbolLimit, usedDirVol, vol));
      continue;
    }
    if(limitedVol + 1e-9 < vol)
    {
      Log(StringFormat("TryAdd %d volume clamp by symbol limit: %s %.4f -> %.4f",
                       i, symbol, vol, limitedVol));
      vol = limitedVol;
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
      if(MathAbs(sizing.deviationPct) >= SizingLogDeviationThresholdPct)
        LogSizing(symbol, sizing.targetLot, sizing.finalLot, sizing.deviationPct, sizing.equityPerSymbol, sizing.marginRequired);
    }

    if(!PlaceOrder(symbol, direction, vol, model, "signal"))
    {
      string failKey = g_lastOrderFailureKey;
      if(failKey == "")
        failKey = "order_failed";
      AddSkipReason(failKey);
      if(IsIndexSymbol(symbol))
        LogIndexSkip(symbol, "order send failed", "order_failed");
      Log(StringFormat("TryAdd %d FAILED: PlaceOrder failed for %s %s", i, symbol, model));
      continue;
    }

    Log(StringFormat("TryAdd %d SUCCESS: Opened %s %s %.4f lots", i, symbol, model, vol));
    totalLots += vol;
    openPositions++;
    MarkOrderTimestamp();
  }
}

//+------------------------------------------------------------------+
void ReconcilePositionsWithSignals()
{
  if(!EnableWeeklyFlipClose)
    return;

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
    string model = ParseModelFromComment(PositionGetString(POSITION_COMMENT));
    int currentDir = ((int)PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY ? 1 : -1);

    if(IsFiveersMode())
    {
      int netSignal = GetNetSignalForSymbol(symbol);
      int wantedDir = 0;
      bool found = (netSignal != 0);
      if(found)
        wantedDir = (netSignal > 0 ? 1 : -1);

      if(!found || wantedDir != currentDir)
      {
        if(!ClosePositionByTicket(ticket, "weekly_flip"))
          LogTradeError(StringFormat("Flip close failed %s net=%d ticket=%llu", symbol, netSignal, ticket));
        else
          Log(StringFormat("Closed weekly flip %s net=%d ticket=%llu", symbol, netSignal, ticket));
      }
      continue;
    }

    if(model == "" || model == "unknown")
      continue;
    StringToLower(model);

    int wantedDir = 0;
    bool found = false;
    for(int j = 0; j < ArraySize(g_brokerSymbols); j++)
    {
      if(g_brokerSymbols[j] != symbol)
        continue;
      string wantedModel = (j < ArraySize(g_models) ? g_models[j] : "blended");
      StringToLower(wantedModel);
      if(wantedModel != model)
        continue;
      wantedDir = g_directions[j];
      found = true;
      break;
    }

    if(!found || wantedDir == 0 || wantedDir != currentDir)
    {
      if(!ClosePositionByTicket(ticket, "weekly_flip"))
        LogTradeError(StringFormat("Flip close failed %s model=%s ticket=%llu", symbol, model, ticket));
      else
        Log(StringFormat("Closed weekly flip %s model=%s ticket=%llu", symbol, model, ticket));
    }
  }
}

double GetOpenVolumeForModelDirection(const string symbol, const string model, int direction, bool &hasLosing)
{
  hasLosing = false;
  string targetModel = model;
  StringToLower(targetModel);
  double totalVol = 0.0;
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
    if(PositionGetString(POSITION_SYMBOL) != symbol)
      continue;
    string parsed = ParseModelFromComment(PositionGetString(POSITION_COMMENT));
    StringToLower(parsed);
    if(parsed != targetModel)
      continue;

    int dir = ((int)PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY ? 1 : -1);
    if(dir != direction)
      continue;

    totalVol += PositionGetDouble(POSITION_VOLUME);
    double pnl = PositionGetDouble(POSITION_PROFIT) + PositionGetDouble(POSITION_SWAP);
    if(pnl < 0.0)
      hasLosing = true;
  }
  return totalVol;
}

int GetLoserAddCountForSymbol(const string symbol)
{
  for(int i = 0; i < ArraySize(g_brokerSymbols); i++)
  {
    if(g_brokerSymbols[i] == symbol && i < ArraySize(g_loserAddCounts))
      return g_loserAddCounts[i];
  }
  return 0;
}

void IncrementLoserAddCount(const string symbol)
{
  for(int i = 0; i < ArraySize(g_brokerSymbols); i++)
  {
    if(g_brokerSymbols[i] == symbol)
    {
      if(ArraySize(g_loserAddCounts) <= i)
        ArrayResize(g_loserAddCounts, i + 1);
      g_loserAddCounts[i]++;
      return;
    }
  }
}

void ResetLoserAddCounts()
{
  ArrayResize(g_loserAddCounts, 0);
}

bool TryAddToLosingLeg(const string symbol, const string model, int direction, const string assetClass)
{
  // 5ERS requires strict net behavior: one live position per symbol, no stacking adds.
  if(IsFiveersMode())
    return false;
  if(!EnableLoserAddToTarget)
    return false;
  if(direction == 0)
    return false;
  if(!IsTradableSymbol(symbol))
    return false;

  // Only add within X hours of week start (after profitable trades close)
  datetime nowGmt = TimeGMT();
  if(IsMidWeekAttachBlocked(nowGmt))
    return false;

  int hoursSinceWeekStart = (int)((nowGmt - g_weekStartGmt) / 3600);
  if(hoursSinceWeekStart < 0 || hoursSinceWeekStart > LoserAddWindowHours)
  {
    AddSkipReason("add_window_closed");
    return false;
  }

  // Check max loser adds limit
  int addCount = GetLoserAddCountForSymbol(symbol);
  if(addCount >= MaxLoserAddsPerSymbol)
  {
    AddSkipReason("max_loser_adds");
    return false;
  }

  bool hasLosing = false;
  double currentVol = GetOpenVolumeForModelDirection(symbol, model, direction, hasLosing);
  if(currentVol <= 0.0 || !hasLosing)
    return false;

  LegSizingResult sizing;
  if(!EvaluateLegSizing(symbol, assetClass, sizing) || sizing.finalLot <= 0.0)
  {
    AddSkipReason("sizing_guard");
    return false;
  }

  double tolerance = LoserAddToleranceLots;
  double step = SymbolInfoDouble(symbol, SYMBOL_VOLUME_STEP);
  if(step > 0.0 && tolerance < step * 0.5)
    tolerance = step * 0.5;

  // Only add when the losing leg is smaller than its balance-based target size.
  double deficit = sizing.finalLot - currentVol;
  if(deficit <= tolerance)
    return false;

  double minVol = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MIN);
  if(minVol <= 0.0)
    return false;
  if(deficit < minVol)
    return false;

  double addVol = NormalizeVolume(symbol, deficit);
  if(addVol <= 0.0)
    return false;

  if(OrdersInLastMinute() >= MaxOrdersPerMinute)
  {
    AddSkipReason("rate_limit");
    return false;
  }
  int openPositions = CountOpenPositions();
  if(openPositions >= MaxOpenPositions)
  {
    AddSkipReason("max_positions");
    return false;
  }

  if(!PlaceOrder(symbol, direction, addVol, model, "added_loser"))
  {
    AddSkipReason("order_failed");
    return false;
  }

  IncrementLoserAddCount(symbol);
  MarkOrderTimestamp();
  Log(StringFormat("Added to losing leg %s model=%s current=%.2f target=%.2f add=%.2f (count=%d/%d)",
                   symbol, model, currentVol, sizing.finalLot, addVol, addCount + 1, MaxLoserAddsPerSymbol));
  return true;
}

//+------------------------------------------------------------------+
bool PlaceOrder(const string symbol, int direction, double volume, const string model, const string reasonTag)
{
  g_lastOrderFailureKey = "";
  double price = direction > 0 ? SymbolInfoDouble(symbol, SYMBOL_ASK)
                               : SymbolInfoDouble(symbol, SYMBOL_BID);
  double stopLoss = 0.0;
  if(ShouldEnforcePerOrderStopLoss())
  {
    if(!CalculateRiskStopLoss(symbol, direction, volume, price, stopLoss))
    {
      string reason = (g_lastStopLossReason == "" ? "unknown" : g_lastStopLossReason);
      g_lastOrderFailureKey = "order_failed";
      LogTradeError(StringFormat("Order blocked %s %s vol=%.2f (unable to set compliant SL: %s)",
                                 symbol, DirectionToString(direction), volume, reason));
      return false;
    }
  }

  string comment = BuildOpenOrderComment(model, reasonTag);
  bool result = false;
  if(direction > 0)
    result = g_trade.Buy(volume, symbol, price, stopLoss, 0.0, comment);
  else
    result = g_trade.Sell(volume, symbol, price, stopLoss, 0.0, comment);

  if(!result)
  {
    int errorCode = GetLastError();
    long retcode = g_trade.ResultRetcode();
    string retDesc = g_trade.ResultRetcodeDescription();
    string retComment = g_trade.ResultComment();
    string retDescLower = retDesc;
    StringToLower(retDescLower);
    string retCommentLower = retComment;
    StringToLower(retCommentLower);
    bool limitVolume = (retcode == TRADE_RETCODE_LIMIT_VOLUME ||
                        StringFind(retDescLower, "limit volume") >= 0 ||
                        StringFind(retCommentLower, "limit volume") >= 0);
    g_lastOrderFailureKey = (limitVolume ? "max_volume_reached" : "order_failed");
    double marginNeed = CalculateMarginRequired(symbol, volume);
    double freeMargin = AccountInfoDouble(ACCOUNT_MARGIN_FREE);
    LogTradeError(StringFormat("Order failed %s %s vol=%.2f code=%d ret=%I64d desc=%s comment=%s free=%.2f need=%.2f reason=%s",
                               symbol, DirectionToString(direction), volume, errorCode, retcode,
                               retDesc, retComment, freeMargin, marginNeed, g_lastOrderFailureKey));
    if(limitVolume)
    {
      double symbolLimit = SymbolInfoDouble(symbol, SYMBOL_VOLUME_LIMIT);
      double usedDirVol = GetDirectionalOpenVolume(symbol, direction);
      LogTradeError(StringFormat("%s max volume reached (limit=%.2f used_dir=%.2f req=%.2f)",
                                 symbol, symbolLimit, usedDirVol, volume));
    }
    return false;
  }

  // 5ers compliance: Ensure minimum delay between orders to prevent same-millisecond execution
  Sleep(100); // 100ms delay between orders

  return true;
}

double GetOpenSymbolRiskUsd(const string symbol)
{
  double totalRiskUsd = 0.0;
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
    if(PositionGetString(POSITION_SYMBOL) != symbol)
      continue;

    int dir = ((int)PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY ? 1 : -1);
    double vol = PositionGetDouble(POSITION_VOLUME);
    double entry = PositionGetDouble(POSITION_PRICE_OPEN);
    double sl = PositionGetDouble(POSITION_SL);
    if(vol <= 0.0 || entry <= 0.0 || sl <= 0.0)
      return DBL_MAX;

    double riskUsd = EstimatePositionRiskUsd(symbol, dir, vol, entry, sl);
    if(riskUsd < 0.0)
      return DBL_MAX;
    totalRiskUsd += riskUsd;
  }
  return totalRiskUsd;
}

bool CalculateRiskStopLoss(const string symbol, int direction, double volume, double entryPrice, double &stopLoss)
{
  g_lastStopLossReason = "";
  stopLoss = 0.0;
  if(direction == 0 || volume <= 0.0 || entryPrice <= 0.0)
  {
    g_lastStopLossReason = "invalid_inputs";
    return false;
  }

  double balance = AccountInfoDouble(ACCOUNT_BALANCE);
  if(balance <= 0.0)
  {
    g_lastStopLossReason = "balance_zero";
    return false;
  }

  double maxRiskPct = MaxStopLossRiskPct;
  if(IsFiveersMode())
    maxRiskPct = 2.0;
  if(maxRiskPct <= 0.0)
    maxRiskPct = 2.0;
  double requestedRiskPct = StopLossRiskPct;
  if(IsFiveersMode())
  {
    requestedRiskPct = FiveersPerTradeRiskPct;
    if(requestedRiskPct <= 0.0)
      requestedRiskPct = maxRiskPct * 0.99;
  }
  if(requestedRiskPct <= 0.0)
  {
    g_lastStopLossReason = "requested_risk_zero";
    return false;
  }
  if(IsFiveersMode() && requestedRiskPct >= maxRiskPct)
    requestedRiskPct = maxRiskPct * 0.99;
  if(requestedRiskPct > maxRiskPct)
    requestedRiskPct = maxRiskPct;

  double tickSize = SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_SIZE);
  double tickValue = SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_VALUE_PROFIT);
  if(tickValue <= 0.0)
    tickValue = SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_VALUE);
  if(tickSize <= 0.0 || tickValue <= 0.0)
  {
    g_lastStopLossReason = "tick_spec_unavailable";
    return false;
  }

  double point = SymbolInfoDouble(symbol, SYMBOL_POINT);
  int stopLevelPts = (int)SymbolInfoInteger(symbol, SYMBOL_TRADE_STOPS_LEVEL);
  int freezeLevelPts = (int)SymbolInfoInteger(symbol, SYMBOL_TRADE_FREEZE_LEVEL);
  double minDistance = 0.0;
  int requiredLevelPts = MathMax(stopLevelPts, freezeLevelPts);
  if(point > 0.0 && requiredLevelPts > 0)
    minDistance = point * requiredLevelPts;

  double riskUsd = balance * requestedRiskPct / 100.0;
  if(riskUsd <= 0.0)
  {
    g_lastStopLossReason = "risk_usd_zero";
    return false;
  }

  double maxAllowedUsd = balance * maxRiskPct / 100.0;
  double limitUsd = maxAllowedUsd;
  if(IsFiveersMode())
  {
    double existingRiskUsd = GetOpenSymbolRiskUsd(symbol);
    if(existingRiskUsd >= DBL_MAX)
    {
      g_lastStopLossReason = "existing_symbol_risk_unknown";
      return false;
    }
    limitUsd = maxAllowedUsd - existingRiskUsd;
    if(limitUsd <= 0.0)
    {
      g_lastStopLossReason = "symbol_risk_limit_exhausted";
      return false;
    }
    if(riskUsd > limitUsd)
      riskUsd = limitUsd;
  }

  double priceDistance = (riskUsd / (tickValue * volume)) * tickSize;
  if(priceDistance <= 0.0)
  {
    g_lastStopLossReason = "price_distance_zero";
    return false;
  }

  int digits = (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);
  double minPositivePrice = point;
  if(minPositivePrice <= 0.0)
    minPositivePrice = tickSize;
  if(minPositivePrice <= 0.0)
    minPositivePrice = 1e-6;
  double maxBuyDistance = 0.0;
  if(direction > 0)
  {
    maxBuyDistance = entryPrice - minPositivePrice;
    if(maxBuyDistance <= 0.0)
    {
      g_lastStopLossReason = "buy_sl_price_floor";
      return false;
    }
    if(minDistance > maxBuyDistance + 1e-9)
    {
      g_lastStopLossReason = "broker_min_distance_exceeds_buy_price";
      return false;
    }
    if(priceDistance > maxBuyDistance)
      priceDistance = maxBuyDistance;
  }

  if(priceDistance < minDistance)
    priceDistance = minDistance;

  for(int attempt = 0; attempt < 3; attempt++)
  {
    if(direction > 0 && priceDistance > maxBuyDistance)
      priceDistance = maxBuyDistance;
    double rawStop = (direction > 0) ? (entryPrice - priceDistance)
                                     : (entryPrice + priceDistance);
    if(direction > 0 && rawStop <= minPositivePrice)
      rawStop = minPositivePrice;
    stopLoss = NormalizeDouble(rawStop, digits);
    if((direction > 0 && stopLoss >= entryPrice) || (direction < 0 && stopLoss <= entryPrice))
      return false;
    if(!EnforceBrokerStopDistance(symbol, direction, entryPrice, stopLoss))
      break;

    double actualRisk = EstimatePositionRiskUsd(symbol, direction, volume, entryPrice, stopLoss);
    if(actualRisk < 0.0)
      break;
    if(actualRisk <= limitUsd * 1.001)
      return true;

    double adjust = limitUsd / actualRisk;
    if(adjust <= 0.0 || adjust >= 1.0)
      break;
    priceDistance *= (adjust * 0.995);
    if(direction > 0 && priceDistance > maxBuyDistance)
      priceDistance = maxBuyDistance;
    if(priceDistance < minDistance)
    {
      priceDistance = minDistance;
      break;
    }
  }

  double rawFinalStop = (direction > 0) ? (entryPrice - priceDistance)
                                        : (entryPrice + priceDistance);
  if(direction > 0 && rawFinalStop <= minPositivePrice)
    rawFinalStop = minPositivePrice;
  stopLoss = NormalizeDouble(rawFinalStop, digits);
  if(!EnforceBrokerStopDistance(symbol, direction, entryPrice, stopLoss))
  {
    if(g_lastStopLossReason == "")
      g_lastStopLossReason = "broker_distance_invalid";
    return false;
  }
  double finalRisk = EstimatePositionRiskUsd(symbol, direction, volume, entryPrice, stopLoss);
  if(finalRisk >= 0.0 && finalRisk <= limitUsd * 1.001)
  {
    g_lastStopLossReason = "";
    return true;
  }

  // Fallback for symbols where risk-sized SL math can become invalid (e.g. very small lots on CFDs):
  // place the nearest broker-compliant SL and keep strict max-risk enforcement.
  bool ok = TryBuildFallbackCompliantStopLoss(symbol, direction, volume, entryPrice, limitUsd, minDistance, stopLoss);
  if(!ok && g_lastStopLossReason == "")
    g_lastStopLossReason = "fallback_failed_or_risk_limit";
  if(ok)
    g_lastStopLossReason = "";
  return ok;
}

bool EnforceBrokerStopDistance(const string symbol, int direction, double entryPrice, double &stopLoss)
{
  if(direction == 0 || entryPrice <= 0.0 || stopLoss <= 0.0)
  {
    if(g_lastStopLossReason == "")
      g_lastStopLossReason = "distance_invalid_inputs";
    return false;
  }

  double point = SymbolInfoDouble(symbol, SYMBOL_POINT);
  int stopLevelPts = (int)SymbolInfoInteger(symbol, SYMBOL_TRADE_STOPS_LEVEL);
  int freezeLevelPts = (int)SymbolInfoInteger(symbol, SYMBOL_TRADE_FREEZE_LEVEL);
  int requiredLevelPts = MathMax(stopLevelPts, freezeLevelPts);
  if(point <= 0.0 || requiredLevelPts <= 0)
    return true;

  // Small extra padding avoids edge rejections caused by rounding/spread movement.
  double minDistance = point * (requiredLevelPts + 1);
  int digits = (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);
  double bid = SymbolInfoDouble(symbol, SYMBOL_BID);
  double ask = SymbolInfoDouble(symbol, SYMBOL_ASK);

  if(direction > 0)
  {
    double ref = (bid > 0.0 ? bid : entryPrice);
    double maxAllowed = ref - minDistance;
    if(stopLoss > maxAllowed)
      stopLoss = NormalizeDouble(maxAllowed, digits);
    if(stopLoss <= 0.0)
    {
      if(g_lastStopLossReason == "")
        g_lastStopLossReason = "buy_stop_non_positive";
      return false;
    }
    if(stopLoss >= entryPrice)
    {
      if(g_lastStopLossReason == "")
        g_lastStopLossReason = "stop_not_below_entry";
      return false;
    }
  }
  else
  {
    double ref = (ask > 0.0 ? ask : entryPrice);
    double minAllowed = ref + minDistance;
    if(stopLoss < minAllowed)
      stopLoss = NormalizeDouble(minAllowed, digits);
    if(stopLoss <= entryPrice)
    {
      if(g_lastStopLossReason == "")
        g_lastStopLossReason = "stop_not_above_entry";
      return false;
    }
  }

  return (stopLoss > 0.0);
}

bool TryBuildFallbackCompliantStopLoss(const string symbol, int direction, double volume,
                                       double entryPrice, double limitUsd, double minDistance,
                                       double &stopLoss)
{
  stopLoss = 0.0;
  if(direction == 0 || volume <= 0.0 || entryPrice <= 0.0 || limitUsd <= 0.0)
  {
    if(g_lastStopLossReason == "")
      g_lastStopLossReason = "fallback_invalid_inputs";
    return false;
  }

  double tickSize = SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_SIZE);
  if(tickSize <= 0.0)
    tickSize = SymbolInfoDouble(symbol, SYMBOL_POINT);
  if(tickSize <= 0.0)
  {
    if(g_lastStopLossReason == "")
      g_lastStopLossReason = "fallback_tick_spec_unavailable";
    return false;
  }

  double distance = minDistance;
  if(distance <= 0.0)
    distance = tickSize;

  double minPositivePrice = SymbolInfoDouble(symbol, SYMBOL_POINT);
  if(minPositivePrice <= 0.0)
    minPositivePrice = tickSize;
  if(minPositivePrice <= 0.0)
    minPositivePrice = 1e-6;

  if(direction > 0)
  {
    double maxBuyDistance = entryPrice - minPositivePrice;
    if(maxBuyDistance <= 0.0)
    {
      if(g_lastStopLossReason == "")
        g_lastStopLossReason = "fallback_buy_sl_price_floor";
      return false;
    }
    if(distance > maxBuyDistance)
      distance = maxBuyDistance;
  }

  int digits = (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);
  double rawStop = (direction > 0) ? (entryPrice - distance)
                                   : (entryPrice + distance);
  if(direction > 0 && rawStop <= minPositivePrice)
    rawStop = minPositivePrice;
  stopLoss = NormalizeDouble(rawStop, digits);
  if((direction > 0 && stopLoss >= entryPrice) || (direction < 0 && stopLoss <= entryPrice))
  {
    if(g_lastStopLossReason == "")
      g_lastStopLossReason = "fallback_stop_side_invalid";
    return false;
  }
  if(!EnforceBrokerStopDistance(symbol, direction, entryPrice, stopLoss))
    return false;

  double riskUsd = EstimatePositionRiskUsd(symbol, direction, volume, entryPrice, stopLoss);
  if(riskUsd < 0.0)
  {
    if(g_lastStopLossReason == "")
      g_lastStopLossReason = "fallback_risk_probe_failed";
    return false;
  }
  if(riskUsd > limitUsd * 1.001)
  {
    if(g_lastStopLossReason == "")
      g_lastStopLossReason = "fallback_risk_exceeds_limit";
    return false;
  }
  return true;
}

double EstimatePositionRiskUsd(const string symbol, int direction, double volume, double entryPrice, double stopLoss)
{
  ENUM_ORDER_TYPE type = (direction > 0 ? ORDER_TYPE_BUY : ORDER_TYPE_SELL);
  double pnl = 0.0;
  if(!OrderCalcProfit(type, symbol, volume, entryPrice, stopLoss, pnl))
  {
    // Some CFD brokers reject profit probing for synthetic symbols; fall back to tick-value estimate.
    double tickSize = SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_SIZE);
    if(tickSize <= 0.0)
      tickSize = SymbolInfoDouble(symbol, SYMBOL_POINT);
    double tickValue = SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_VALUE_PROFIT);
    if(tickValue <= 0.0)
      tickValue = SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_VALUE);
    if(tickSize <= 0.0 || tickValue <= 0.0)
      return -1.0;

    double distance = MathAbs(entryPrice - stopLoss);
    if(distance <= 0.0)
      return 0.0;
    double ticks = distance / tickSize;
    return ticks * tickValue * volume;
  }
  if(pnl >= 0.0)
    return 0.0;
  return -pnl;
}

double GetDirectionalOpenVolume(const string symbol, int direction)
{
  if(symbol == "" || direction == 0)
    return 0.0;
  double used = 0.0;
  int total = PositionsTotal();
  for(int i = 0; i < total; i++)
  {
    ulong ticket = PositionGetTicket(i);
    if(ticket == 0)
      continue;
    if(!PositionSelectByTicket(ticket))
      continue;
    if(PositionGetString(POSITION_SYMBOL) != symbol)
      continue;
    int dir = ((int)PositionGetInteger(POSITION_TYPE) == POSITION_TYPE_BUY ? 1 : -1);
    if(dir != direction)
      continue;
    used += PositionGetDouble(POSITION_VOLUME);
  }
  return used;
}

double ClampVolumeToSymbolDirectionLimit(const string symbol, int direction, double desiredVolume)
{
  if(desiredVolume <= 0.0 || direction == 0)
    return 0.0;

  double limitVol = SymbolInfoDouble(symbol, SYMBOL_VOLUME_LIMIT);
  if(limitVol <= 0.0)
    return desiredVolume;

  double used = GetDirectionalOpenVolume(symbol, direction);
  double available = limitVol - used;
  if(available <= 0.0)
    return 0.0;

  double capped = MathMin(desiredVolume, available);
  return NormalizeVolumeWithPolicy(symbol, capped, true, SizingMaxOvershootPct, capped);
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
  CloseAllPositions("manual");
}

void CloseAllPositions(const string reasonTag)
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
    ClosePositionByTicket(ticket, reasonTag);
  }
}

void CloseSymbolPositions(const string symbol)
{
  CloseSymbolPositions(symbol, "manual");
}

void CloseSymbolPositions(const string symbol, const string reasonTag)
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
    ClosePositionByTicket(ticket, reasonTag);
  }
}

bool ClosePositionByTicket(ulong ticket)
{
  return ClosePositionByTicket(ticket, "manual");
}

bool ClosePositionByTicket(ulong ticket, const string reasonTag)
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
  req.comment = BuildCloseOrderComment(reasonTag);

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
  g_adaptivePeakAvgPct = 0.0;
  g_lastWeekPeakPct = 0.0;
  g_adaptivePeakSumPct = 0.0;
  g_adaptivePeakCount = 0;
  bool hasScopedAdaptive = false;
  if(GlobalVariableCheck(ScopeKey(GV_ADAPTIVE_PEAK_AVG)))
  {
    g_adaptivePeakAvgPct = GlobalVariableGet(ScopeKey(GV_ADAPTIVE_PEAK_AVG));
    hasScopedAdaptive = true;
  }
  if(GlobalVariableCheck(ScopeKey(GV_LAST_WEEK_PEAK)))
  {
    g_lastWeekPeakPct = GlobalVariableGet(ScopeKey(GV_LAST_WEEK_PEAK));
    hasScopedAdaptive = true;
  }
  if(GlobalVariableCheck(ScopeKey(GV_ADAPTIVE_PEAK_SUM)))
  {
    g_adaptivePeakSumPct = GlobalVariableGet(ScopeKey(GV_ADAPTIVE_PEAK_SUM));
    hasScopedAdaptive = true;
  }
  if(GlobalVariableCheck(ScopeKey(GV_ADAPTIVE_PEAK_COUNT)))
  {
    g_adaptivePeakCount = (int)GlobalVariableGet(ScopeKey(GV_ADAPTIVE_PEAK_COUNT));
    hasScopedAdaptive = true;
  }

  // One-time compatibility migration from older non-account-scoped keys.
  if(!hasScopedAdaptive)
  {
    bool migrated = false;
    string legacyPrefix = "Limni_";
    string legacyAvgKey = legacyPrefix + GV_ADAPTIVE_PEAK_AVG;
    string legacyLastKey = legacyPrefix + GV_LAST_WEEK_PEAK;
    string legacySumKey = legacyPrefix + GV_ADAPTIVE_PEAK_SUM;
    string legacyCountKey = legacyPrefix + GV_ADAPTIVE_PEAK_COUNT;

    if(GlobalVariableCheck(legacyAvgKey))
    {
      g_adaptivePeakAvgPct = GlobalVariableGet(legacyAvgKey);
      migrated = true;
    }
    if(GlobalVariableCheck(legacyLastKey))
    {
      g_lastWeekPeakPct = GlobalVariableGet(legacyLastKey);
      migrated = true;
    }
    if(GlobalVariableCheck(legacySumKey))
    {
      g_adaptivePeakSumPct = GlobalVariableGet(legacySumKey);
      migrated = true;
    }
    if(GlobalVariableCheck(legacyCountKey))
    {
      g_adaptivePeakCount = (int)GlobalVariableGet(legacyCountKey);
      migrated = true;
    }

    if(!migrated)
    {
      if(GlobalVariableCheck(GV_ADAPTIVE_PEAK_AVG))
      {
        g_adaptivePeakAvgPct = GlobalVariableGet(GV_ADAPTIVE_PEAK_AVG);
        migrated = true;
      }
      if(GlobalVariableCheck(GV_LAST_WEEK_PEAK))
      {
        g_lastWeekPeakPct = GlobalVariableGet(GV_LAST_WEEK_PEAK);
        migrated = true;
      }
      if(GlobalVariableCheck(GV_ADAPTIVE_PEAK_SUM))
      {
        g_adaptivePeakSumPct = GlobalVariableGet(GV_ADAPTIVE_PEAK_SUM);
        migrated = true;
      }
      if(GlobalVariableCheck(GV_ADAPTIVE_PEAK_COUNT))
      {
        g_adaptivePeakCount = (int)GlobalVariableGet(GV_ADAPTIVE_PEAK_COUNT);
        migrated = true;
      }
    }

    if(migrated)
    {
      if(g_adaptivePeakCount <= 0 && g_adaptivePeakAvgPct > 0.0)
      {
        g_adaptivePeakCount = 1;
        g_adaptivePeakSumPct = g_adaptivePeakAvgPct;
      }
      SaveState();
      Log(StringFormat("Migrated adaptive peak history from legacy scope: avg=%.2f weeks=%d",
                       g_adaptivePeakAvgPct, g_adaptivePeakCount));
    }
  }

  if(g_adaptivePeakCount <= 0 && g_adaptivePeakAvgPct > 0.0)
  {
    // Backward compatibility with older state that only stored average.
    g_adaptivePeakCount = 1;
    g_adaptivePeakSumPct = g_adaptivePeakAvgPct;
  }

  if(GlobalVariableCheck(ScopeKey(GV_WEEK_START)))
  {
    datetime storedWeek = (datetime)GlobalVariableGet(ScopeKey(GV_WEEK_START));
    if(storedWeek == g_weekStartGmt)
    {
      g_state = (EAState)(int)GlobalVariableGet(ScopeKey(GV_STATE));
      g_baselineEquity = GlobalVariableGet(ScopeKey(GV_BASELINE));
      g_lockedProfitPct = GlobalVariableGet(ScopeKey(GV_LOCKED));
      g_trailingActive = (GlobalVariableGet(ScopeKey(GV_TRAIL)) > 0.5);
      g_closeRequested = (GlobalVariableGet(ScopeKey(GV_CLOSE)) > 0.5);
      if(GlobalVariableCheck(ScopeKey(GV_WEEK_PEAK)))
        g_weekPeakEquity = GlobalVariableGet(ScopeKey(GV_WEEK_PEAK));
      if(GlobalVariableCheck(ScopeKey(GV_MAX_DD)))
        g_maxDrawdownPct = GlobalVariableGet(ScopeKey(GV_MAX_DD));
      if(GlobalVariableCheck(ScopeKey(GV_LAST_PUSH)))
        g_lastPush = (datetime)GlobalVariableGet(ScopeKey(GV_LAST_PUSH));
      double balanceNow = AccountInfoDouble(ACCOUNT_BALANCE);
      if(balanceNow > 0.0 && (g_baselineEquity <= 0.0 || g_baselineEquity < (balanceNow * 0.25) || g_baselineEquity > (balanceNow * 4.0)))
      {
        Log(StringFormat("Baseline sanity reset %.2f -> %.2f", g_baselineEquity, balanceNow));
        g_baselineEquity = balanceNow;
        g_lockedProfitPct = 0.0;
        g_trailingActive = false;
        SaveState();
      }
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
  if(GlobalVariableCheck(ScopeKey(GV_LAST_PUSH)))
    g_lastPush = (datetime)GlobalVariableGet(ScopeKey(GV_LAST_PUSH));
  else
    g_lastPush = 0;
}

void SaveState()
{
  GlobalVariableSet(ScopeKey(GV_WEEK_START), (double)g_weekStartGmt);
  GlobalVariableSet(ScopeKey(GV_STATE), (double)g_state);
  GlobalVariableSet(ScopeKey(GV_BASELINE), g_baselineEquity);
  GlobalVariableSet(ScopeKey(GV_LOCKED), g_lockedProfitPct);
  GlobalVariableSet(ScopeKey(GV_TRAIL), g_trailingActive ? 1.0 : 0.0);
  GlobalVariableSet(ScopeKey(GV_CLOSE), g_closeRequested ? 1.0 : 0.0);
  GlobalVariableSet(ScopeKey(GV_WEEK_PEAK), g_weekPeakEquity);
  GlobalVariableSet(ScopeKey(GV_MAX_DD), g_maxDrawdownPct);
  GlobalVariableSet(ScopeKey(GV_LAST_PUSH), (double)g_lastPush);
  GlobalVariableSet(ScopeKey(GV_ADAPTIVE_PEAK_AVG), g_adaptivePeakAvgPct);
  GlobalVariableSet(ScopeKey(GV_LAST_WEEK_PEAK), g_lastWeekPeakPct);
  GlobalVariableSet(ScopeKey(GV_ADAPTIVE_PEAK_SUM), g_adaptivePeakSumPct);
  GlobalVariableSet(ScopeKey(GV_ADAPTIVE_PEAK_COUNT), (double)g_adaptivePeakCount);
}

void LoadApiCache()
{
  int handle = FileOpen(g_cacheFile, FILE_READ | FILE_TXT | FILE_COMMON);
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
    ExtractStringValue(json, "last_refresh_utc", g_lastDataRefreshUtc);
    ApplyTrailProfileFromApi(json);
    int count = ArraySize(symbols);
    ArrayResize(g_apiSymbolsRaw, count);
    for(int k = 0; k < count; k++)
    {
      g_apiSymbolsRaw[k] = symbols[k];
      StringToUpper(g_apiSymbolsRaw[k]);
    }
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
      g_models[i] = NormalizeModelName(i < ArraySize(models) ? models[i] : "blended");
      g_assetClasses[i] = (i < ArraySize(assetClasses) ? assetClasses[i] : "fx");
      if(ResolveSymbol(symbols[i], resolved))
        g_brokerSymbols[i] = resolved;
    }
    Log("Loaded cached API response.");
  }
}

void SaveApiCache(const string json)
{
  int handle = FileOpen(g_cacheFile, FILE_WRITE | FILE_TXT | FILE_COMMON);
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
  g_adaptivePeakAvgPct = 0.0;
  g_lastWeekPeakPct = 0.0;
  g_adaptivePeakSumPct = 0.0;
  g_adaptivePeakCount = 0;
  g_lastApiSuccess = 0;
  g_loadedFromCache = false;
  g_reportDate = "";
  g_tradingAllowed = false;
  g_apiOk = false;
  g_lastApiError = "";
  g_lastApiErrorTime = 0;
  g_lastDataRefreshUtc = "";
  ArrayResize(g_apiSymbolsRaw, 0);

  GlobalVariableDel(ScopeKey(GV_WEEK_START));
  GlobalVariableDel(ScopeKey(GV_STATE));
  GlobalVariableDel(ScopeKey(GV_BASELINE));
  GlobalVariableDel(ScopeKey(GV_LOCKED));
  GlobalVariableDel(ScopeKey(GV_TRAIL));
  GlobalVariableDel(ScopeKey(GV_CLOSE));
  GlobalVariableDel(ScopeKey(GV_WEEK_PEAK));
  GlobalVariableDel(ScopeKey(GV_MAX_DD));
  GlobalVariableDel(ScopeKey(GV_LAST_PUSH));
  GlobalVariableDel(ScopeKey(GV_ADAPTIVE_PEAK_AVG));
  GlobalVariableDel(ScopeKey(GV_LAST_WEEK_PEAK));
  GlobalVariableDel(ScopeKey(GV_ADAPTIVE_PEAK_SUM));
  GlobalVariableDel(ScopeKey(GV_ADAPTIVE_PEAK_COUNT));

  FileDelete(g_cacheFile, FILE_COMMON);
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
  string key = ScopeKey("Skip_" + symbol + "_" + reasonKey);
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

  int minWidth = (DashboardView == DASH_COMPACT ? 960 : 1100);
  g_dashWidth = MathMax(DashboardWidth, minWidth);
  bool compactDash = (DashboardView == DASH_COMPACT);
  g_dashLineHeight = MathMax(DashboardLineHeight, (compactDash ? 38 : 30));
  g_dashPadding = compactDash ? MathMax(DashboardPadding, 26) : MathMax(DashboardPadding, 20);
  g_dashFontSize = compactDash ? MathMax(15, DashboardFontSize - 1) : MathMax(DashboardFontSize, 16);
  g_dashTitleSize = compactDash ? MathMax(18, DashboardTitleSize - 2) : MathMax(DashboardTitleSize, 20);
  g_dashAccentWidth = MathMax(DashboardAccentWidth, 10);
  g_dashShadowOffset = MathMax(DashboardShadowOffset, 6);
  g_dashColumnGap = MathMax(DashboardColumnGap, 12);

  int lineCount = (DashboardView == DASH_COMPACT ? 24 : 20);
  int mapLines = (DashboardView == DASH_COMPACT ? 0 : MathMax(6, LotMapMaxLines));
  ArrayResize(g_dashboardLines, lineCount);
  for(int i = 0; i < lineCount; i++)
    g_dashboardLines[i] = StringFormat("LimniDash_line_%d", i);
  ArrayResize(g_dashboardRightLines, mapLines);
  for(int i = 0; i < mapLines; i++)
    g_dashboardRightLines[i] = StringFormat("LimniDash_map_%d", i);

  int headerHeight = g_dashLineHeight + (compactDash ? 18 : 12);
  int rows = lineCount > mapLines ? lineCount : mapLines;
  int height = g_dashPadding * 2 + headerHeight + rows * g_dashLineHeight;
  int accentWidth = g_dashAccentWidth;
  int contentX = DashboardX + g_dashPadding + accentWidth;
  int contentWidth = g_dashWidth - (g_dashPadding * 2) - accentWidth;
  if(DashboardView == DASH_COMPACT)
  {
    g_dashLeftWidth = contentWidth;
    g_dashRightWidth = 0;
    g_dashLeftX = contentX;
    g_dashRightX = contentX;
  }
  else
  {
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
  }

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

  if(DashboardView == DASH_COMPACT)
  {
    ObjectDelete(0, DASH_COL_DIVIDER);
  }
  else if(ObjectFind(0, DASH_COL_DIVIDER) < 0)
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
    ObjectSetString(0, DASH_TITLE, OBJPROP_FONT, compactDash ? "Consolas" : "Segoe UI Semibold");
    ObjectSetInteger(0, DASH_TITLE, OBJPROP_SELECTABLE, false);
    ObjectSetInteger(0, DASH_TITLE, OBJPROP_HIDDEN, true);
  }

  if(compactDash)
  {
    ObjectDelete(0, DASH_MAP_TITLE);
  }
  else if(ObjectFind(0, DASH_MAP_TITLE) < 0)
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
    ObjectSetString(0, name, OBJPROP_FONT, compactDash ? "Consolas" : "Segoe UI");
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
  int totalLegs = ArraySize(g_brokerSymbols);
  int totalPairs = CountUniquePlannedPairs();
  int expectedPairs = CountExpectedUniversePairs();
  string missingPairs = GetMissingUniversePairs();
  string universeGateReason = "";
  bool universeGateReady = IsUniverseSizingReady(universeGateReason);
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

  string reportText = (g_reportDate == "" ? "--" : g_reportDate);
  string refreshText = (g_lastDataRefreshUtc == "" ? "--" : g_lastDataRefreshUtc);
  string expectedReportDate = "";
  int waitMinutes = 0;
  bool waitingSnapshot = IsWaitingForWeeklySnapshot(expectedReportDate, waitMinutes);
  bool hasPlanLoaded = (totalLegs > 0);
  bool showWaitingSnapshot = (waitingSnapshot && !hasPlanLoaded);
  string snapshotLine = "Snapshot: no plan loaded";
  if(showWaitingSnapshot)
    snapshotLine = StringFormat("Snapshot: waiting for weekly update (expected %s, +%d min)", expectedReportDate, waitMinutes);
  else if(hasPlanLoaded)
    snapshotLine = StringFormat("Snapshot: ready (%s) pending Sunday open", reportText);
  else
    snapshotLine = StringFormat("Snapshot: current (%s)", reportText);
  string cacheLine = g_loadedFromCache ? "Cache: Yes" : "Cache: No";
  if(g_lastApiSuccess > 0)
  {
    int age = (int)(now - g_lastApiSuccess);
    cacheLine = StringFormat("Last API: %s ago", FormatDuration(age));
    if(g_loadedFromCache)
      cacheLine += " (cache)";
  }

  string brokerLine = StringFormat("Broker: %s",
                                   CompactText(AccountInfoString(ACCOUNT_COMPANY), 18));
  string serverLine = StringFormat("Server: %s", CompactText(AccountInfoString(ACCOUNT_SERVER), 18));
  string profileLabel = GetProfileLabel();
  string accountClassLabel = GetAccountClassLabel();
  string userLabel = GetUserLabel();
  string structureLine = StringFormat("Exec: %s", MarginModeToString());
  string weekLine = StringFormat("Week start: %s  |  Asset: %s",
                                 FormatTimeValue(g_weekStartGmt),
                                 AssetFilter == "" ? "--" : AssetFilter);
  string pairsLine = StringFormat("Pairs: %d/%d  |  Legs: %d  |  Open pairs: %d",
                                  totalPairs, expectedPairs, totalLegs, openPairs);
  string positionLine = StringFormat("Pos:%d Lots:%.2f OPM:%d",
                                     openPositions, totalLots, OrdersInLastMinute());
  string equityLine = StringFormat("Eq:%.2f Bal:%.2f Free:%.2f",
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
  string pnlLine = StringFormat("PnL:%s Locked:%.2f%% Trail:%s", pnlText, g_lockedProfitPct, trailText);

  string ddLine = StringFormat("Max DD: %.2f%%", g_maxDrawdownPct);
  color ddColor = (g_maxDrawdownPct <= 0.0 ? goodColor : badColor);

  double baseEquity = g_baselineEquity > 0.0 ? g_baselineEquity : AccountInfoDouble(ACCOUNT_BALANCE);
  double legScale = GetLegRiskScale();
  string lotLine = StringFormat("Sizing: 1:1 x %.2f (%s)  |  Base: %.2f", legScale, RiskModeToString(), baseEquity);
  string multLine = StringFormat("Mult: FX %.2f  Crypto %.2f  Cmds %.2f  Ind %.2f",
                                 FxLotMultiplier, CryptoLotMultiplier, CommoditiesLotMultiplier, IndicesLotMultiplier);
  string trailLine = "Trail off";
  if(IsEquityTrailEnabled())
  {
    trailLine = StringFormat("Trail %.1f/%.1f", GetEffectiveTrailStartPct(), GetEffectiveTrailOffsetPct());
    if(IsAdaptiveTrailEnabled())
    {
      if(g_adaptivePeakCount > 0 && g_adaptivePeakAvgPct > 0.0)
        trailLine += StringFormat(" avg %.1f", g_adaptivePeakAvgPct);
      else
        trailLine += " avg n/a";
    }
  }
  string basketGuardLine = StringFormat("TP %.1f %s | SL %.1f %s",
                                        GetEffectiveBasketTakeProfitPct(), IsBasketTakeProfitEnabled() ? "on" : "off",
                                        GetEffectiveBasketStopLossPct(), IsBasketStopLossEnabled() ? "on" : "off");

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

  string plannedModelLine = StringFormat("Planned basket A%d B%d D%d C%d S%d",
                                         CountSignalsByModel("antikythera"),
                                         CountSignalsByModel("blended"),
                                         CountSignalsByModel("dealer"),
                                         CountSignalsByModel("commercial"),
                                         CountSignalsByModel("sentiment"));
  string lotsLine = StringFormat("Lots used:%.2f", totalLots);
  string peakLine = g_weekPeakEquity > 0.0
                      ? StringFormat("Peak equity: %.2f", g_weekPeakEquity)
                      : "Peak equity: --";
  bool compact = (DashboardView == DASH_COMPACT);
  int usedLeft = 0;

  color headingColor = C'15,118,110';

  SetLabelText(DASH_TITLE, "Limni Basket EA | " + userLabel, C'15,23,42');
  if(compact)
  {
    SetLabelText(DASH_TITLE, "[ LIMNI_BASKET_EA | " + userLabel + " ]", C'15,23,42');
    SetLabelText(g_dashboardLines[0], "+----------------------------------------------------------+", dimColor);
    SetLabelText(g_dashboardLines[1], "| STATUS                                                   |", headingColor);
    SetLabelText(g_dashboardLines[2], StringFormat("| state=%s trading=%s api=%s",
                                                    stateText,
                                                    g_tradingAllowed ? "allowed" : "blocked",
                                                    g_apiOk ? "ok" : "fail"), stateColor);
    SetLabelText(g_dashboardLines[3], StringFormat("| %s | %s", brokerLine, serverLine), dimColor);
    SetLabelText(g_dashboardLines[4], StringFormat("| %s | class=%s profile=%s",
                                                    structureLine,
                                                    accountClassLabel,
                                                    profileLabel), dimColor);
    SetLabelText(g_dashboardLines[5], "| user=" + userLabel + " | " + basketGuardLine + " | " + trailLine, dimColor);
    SetLabelText(g_dashboardLines[6], "+----------------------------------------------------------+", dimColor);

    SetLabelText(g_dashboardLines[7], "| SYNC                                                     |", headingColor);
    SetLabelText(g_dashboardLines[8], "| " + CompactText(snapshotLine, 58), showWaitingSnapshot ? warnColor : dimColor);
    SetLabelText(g_dashboardLines[9], StringFormat("| %s | poll=%s",
                                                    CompactText(cacheLine, 30),
                                                    FormatDuration(pollRemaining)),
                 showWaitingSnapshot ? warnColor : dimColor);
    SetLabelText(g_dashboardLines[10], "+----------------------------------------------------------+", dimColor);

    SetLabelText(g_dashboardLines[11], "| ACCOUNT                                                  |", headingColor);
    SetLabelText(g_dashboardLines[12], "| " + equityLine, textColor);
    SetLabelText(g_dashboardLines[13], "| " + pnlLine + " | " + ddLine, pnlColor);
    SetLabelText(g_dashboardLines[14], "+----------------------------------------------------------+", dimColor);

    SetLabelText(g_dashboardLines[15], "| POSITIONS                                                |", headingColor);
    SetLabelText(g_dashboardLines[16], "| " + positionLine + " | " + lotsLine, textColor);
    SetLabelText(g_dashboardLines[17], "| " + plannedModelLine, dimColor);
    SetLabelText(g_dashboardLines[18], "+----------------------------------------------------------+", dimColor);

    SetLabelText(g_dashboardLines[19], "| CHECKS                                                   |", headingColor);
    string alertLine = (g_lastApiError == "" ? "Alerts: none" : "Alerts: " + errorText);
    if(!universeGateReady)
    {
      if(alertLine == "Alerts: none")
        alertLine = "Alerts: universe gate " + universeGateReason;
      else
        alertLine = alertLine + " | universe gate " + universeGateReason;
    }
    if(showWaitingSnapshot)
    {
      if(alertLine == "Alerts: none")
        alertLine = "Alerts: waiting for new weekly snapshot";
      else
        alertLine = alertLine + " | waiting for weekly snapshot";
    }
    SetLabelText(g_dashboardLines[20], "| " + alertLine, errorColor);
    SetLabelText(g_dashboardLines[21], StringFormat("| pairs=%d/%d legs=%d open_pairs=%d", totalPairs, expectedPairs, totalLegs, openPairs), dimColor);
    SetLabelText(g_dashboardLines[22], "| " + CompactText(StringFormat("report=%s refresh=%s miss=%s",
                                                    reportText, refreshText,
                                                    missingPairs == "none" ? "none" : CompactText(missingPairs, 18)), 58), errorColor);
    SetLabelText(g_dashboardLines[23], "+----------------------------------------------------------+", dimColor);
    usedLeft = 24;
  }
  else
  {
    SetLabelText(DASH_MAP_TITLE, "LOT MAP", headingColor);
    SetLabelText(g_dashboardLines[0], "SYSTEM", headingColor);
    SetLabelText(g_dashboardLines[1], StringFormat("State: %s  |  Trading: %s", stateText, g_tradingAllowed ? "Allowed" : "Blocked"), stateColor);
    SetLabelText(g_dashboardLines[2], apiLine, apiColor);
    SetLabelText(g_dashboardLines[3], brokerLine, dimColor);
    SetLabelText(g_dashboardLines[4], cacheLine, dimColor);
    SetLabelText(g_dashboardLines[5], snapshotLine, showWaitingSnapshot ? warnColor : dimColor);
    SetLabelText(g_dashboardLines[6], weekLine + StringFormat("  |  %s  |  Class: %s  |  Profile: %s  |  User: %s  |  Mode: %s",
                                                               structureLine, accountClassLabel, profileLabel, userLabel, RiskModeToString()), dimColor);

    SetLabelText(g_dashboardLines[7], "POSITIONS", headingColor);
    SetLabelText(g_dashboardLines[8], pairsLine, textColor);
    SetLabelText(g_dashboardLines[9], positionLine, textColor);
    SetLabelText(g_dashboardLines[10], lotsLine, textColor);
    SetLabelText(g_dashboardLines[11], plannedModelLine + "  |  " + basketGuardLine, dimColor);

    SetLabelText(g_dashboardLines[12], "ACCOUNT", headingColor);
    SetLabelText(g_dashboardLines[13], equityLine, textColor);
    SetLabelText(g_dashboardLines[14], pnlLine, pnlColor);
    SetLabelText(g_dashboardLines[15], ddLine + "  |  " + peakLine, ddColor);

    SetLabelText(g_dashboardLines[16], "SIZING", headingColor);
    SetLabelText(g_dashboardLines[17], lotLine, dimColor);
    SetLabelText(g_dashboardLines[18], multLine + "  |  " + trailLine, dimColor);
    string detailedErrorLine = pollLine + "  |  " + errorLine;
    if(!universeGateReady)
      detailedErrorLine += "  |  universe gate: " + universeGateReason;
    SetLabelText(g_dashboardLines[19], detailedErrorLine, errorColor);
    usedLeft = 20;
  }

  for(int i = usedLeft; i < ArraySize(g_dashboardLines); i++)
    SetLabelText(g_dashboardLines[i], " ", dimColor);

  int mapCount = ArraySize(g_dashboardRightLines);
  if(compact)
  {
    for(int i = 0; i < mapCount; i++)
      SetLabelText(g_dashboardRightLines[i], " ", dimColor);
  }
  else
  {
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
}

//+------------------------------------------------------------------+
void SetLabelText(const string name, const string text, color textColor)
{
  if(ObjectFind(0, name) < 0)
    return;
  string finalText = text;
  if(StringFind(name, "LimniDash_line_") == 0 || name == DASH_TITLE)
    finalText = LeftDashboardText(text);
  else if(StringFind(name, "LimniDash_map_") == 0 || name == DASH_MAP_TITLE)
    finalText = RightDashboardText(text);
  ObjectSetString(0, name, OBJPROP_TEXT, finalText);
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

string FormatDateOnly(datetime value)
{
  if(value <= 0)
    return "--";
  MqlDateTime dt;
  TimeToStruct(value, dt);
  return StringFormat("%04d-%02d-%02d", dt.year, dt.mon, dt.day);
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

int EstimateDashMaxChars(int pixelWidth)
{
  int fontSize = (g_dashFontSize > 0 ? g_dashFontSize : 16);
  int charWidth = (int)MathRound((double)fontSize * 0.58);
  if(charWidth < 7)
    charWidth = 7;
  int maxChars = pixelWidth / charWidth;
  if(maxChars < 10)
    maxChars = 10;
  return maxChars;
}

string FitDashboardText(const string value, int pixelWidth)
{
  return CompactText(value, EstimateDashMaxChars(pixelWidth));
}

string LeftDashboardText(const string value)
{
  int width = g_dashLeftWidth - 10;
  if(width <= 0)
    width = 620;
  return FitDashboardText(value, width);
}

string RightDashboardText(const string value)
{
  int width = g_dashRightWidth - 10;
  if(width <= 0)
    width = 300;
  return FitDashboardText(value, width);
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

string UrlEncode(const string value)
{
  string out = "";
  int len = StringLen(value);
  for(int i = 0; i < len; i++)
  {
    ushort ch = (ushort)StringGetCharacter(value, i);
    bool isDigit = (ch >= '0' && ch <= '9');
    bool isUpper = (ch >= 'A' && ch <= 'Z');
    bool isLower = (ch >= 'a' && ch <= 'z');
    if(isDigit || isUpper || isLower || ch == '-' || ch == '_' || ch == '.' || ch == '~')
    {
      out += ShortToString(ch);
    }
    else if(ch == ' ')
    {
      out += "%20";
    }
    else
    {
      out += StringFormat("%%%02X", (int)ch);
    }
  }
  return out;
}

string AppendQueryParam(const string url, const string key, const string value)
{
  string sep = (StringFind(url, "?") >= 0 ? "&" : "?");
  return url + sep + key + "=" + UrlEncode(value);
}

bool IsWaitingForWeeklySnapshot(string &expectedReportDate, int &minutesSinceRelease)
{
  expectedReportDate = "";
  minutesSinceRelease = 0;

  datetime nowGmt = TimeGMT();
  bool dst = IsUsdDstUtc(nowGmt);
  int offset = dst ? -4 : -5;
  datetime etNow = nowGmt + offset * 3600;
  MqlDateTime et;
  TimeToStruct(etNow, et);

  int daysSinceSunday = et.day_of_week;
  datetime sundayEt = etNow - daysSinceSunday * 86400;
  MqlDateTime sunday;
  TimeToStruct(sundayEt, sunday);

  datetime fridayBaseEt = sundayEt + 5 * 86400;
  MqlDateTime friday;
  TimeToStruct(fridayBaseEt, friday);
  friday.hour = 15;
  friday.min = 30;
  friday.sec = 0;
  datetime fridayReleaseEt = StructToTime(friday);
  if(fridayReleaseEt <= 0)
    return false;
  MqlDateTime fridayLocal;
  TimeToStruct(fridayReleaseEt, fridayLocal);
  bool fridayDst = IsUsdDstLocal(fridayLocal.year, fridayLocal.mon, fridayLocal.day, fridayLocal.hour);
  int fridayOffset = fridayDst ? -4 : -5;
  datetime fridayReleaseUtc = fridayReleaseEt - fridayOffset * 3600;

  datetime tuesdayBaseEt = sundayEt + 2 * 86400;
  MqlDateTime tuesday;
  TimeToStruct(tuesdayBaseEt, tuesday);
  tuesday.hour = 0;
  tuesday.min = 0;
  tuesday.sec = 0;
  expectedReportDate = FormatDateOnly(StructToTime(tuesday));
  if(expectedReportDate == "--")
    expectedReportDate = "";

  if(nowGmt < fridayReleaseUtc)
    return false;
  minutesSinceRelease = (int)((nowGmt - fridayReleaseUtc) / 60);
  if(minutesSinceRelease < 0)
    minutesSinceRelease = 0;

  if(expectedReportDate == "")
    return false;
  if(g_reportDate >= expectedReportDate)
    return false;
  return true;
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
  string seen[];
  ArrayResize(seen, 0);
  int count = 0;
  for(int i = 0; i < ArraySize(g_brokerSymbols); i++)
  {
    string symbol = g_brokerSymbols[i];
    if(symbol == "")
      continue;
    bool already = false;
    for(int j = 0; j < ArraySize(seen); j++)
    {
      if(seen[j] == symbol)
      {
        already = true;
        break;
      }
    }
    if(already)
      continue;
    SymbolStats stats;
    if(GetSymbolStats(symbol, stats))
      count++;
    int seenSize = ArraySize(seen);
    ArrayResize(seen, seenSize + 1);
    seen[seenSize] = symbol;
  }
  return count;
}

int CountUniquePlannedPairs()
{
  string seen[];
  ArrayResize(seen, 0);
  for(int i = 0; i < ArraySize(g_apiSymbolsRaw); i++)
  {
    string symbol = g_apiSymbolsRaw[i];
    if(symbol == "")
      continue;
    StringToUpper(symbol);
    bool exists = false;
    for(int j = 0; j < ArraySize(seen); j++)
    {
      if(seen[j] == symbol)
      {
        exists = true;
        break;
      }
    }
    if(exists)
      continue;
    int size = ArraySize(seen);
    ArrayResize(seen, size + 1);
    seen[size] = symbol;
  }
  return ArraySize(seen);
}

int CountExpectedUniversePairs()
{
  string mode = AssetFilter;
  StringToLower(mode);
  if(mode == "fx")
    return 28;
  if(mode == "indices")
    return 3;
  if(mode == "crypto")
    return 2;
  if(mode == "commodities")
    return 3;
  return 36;
}

bool HasPlannedSymbol(const string symbol)
{
  string target = symbol;
  StringToUpper(target);
  for(int i = 0; i < ArraySize(g_apiSymbolsRaw); i++)
  {
    string current = g_apiSymbolsRaw[i];
    StringToUpper(current);
    if(current == target)
      return true;
  }
  return false;
}

string GetMissingUniversePairs()
{
  string mode = AssetFilter;
  StringToLower(mode);

  string fxPairs[28] = {"EURUSD","GBPUSD","AUDUSD","NZDUSD","USDJPY","USDCHF","USDCAD","EURGBP",
                        "EURJPY","EURCHF","EURAUD","EURNZD","EURCAD","GBPJPY","GBPCHF","GBPAUD",
                        "GBPNZD","GBPCAD","AUDJPY","AUDCHF","AUDCAD","AUDNZD","NZDJPY","NZDCHF",
                        "NZDCAD","CADJPY","CADCHF","CHFJPY"};
  string indexPairs[3] = {"SPXUSD","NDXUSD","NIKKEIUSD"};
  string cryptoPairs[2] = {"BTCUSD","ETHUSD"};
  string commodityPairs[3] = {"XAUUSD","XAGUSD","WTIUSD"};

  string missing = "";
  if(mode == "fx" || mode == "all" || mode == "")
  {
    for(int i = 0; i < 28; i++)
    {
      if(HasPlannedSymbol(fxPairs[i]))
        continue;
      if(missing != "")
        missing += ",";
      missing += fxPairs[i];
    }
  }
  if(mode == "indices" || mode == "all" || mode == "")
  {
    for(int i = 0; i < 3; i++)
    {
      if(HasPlannedSymbol(indexPairs[i]))
        continue;
      if(missing != "")
        missing += ",";
      missing += indexPairs[i];
    }
  }
  if(mode == "crypto" || mode == "all" || mode == "")
  {
    for(int i = 0; i < 2; i++)
    {
      if(HasPlannedSymbol(cryptoPairs[i]))
        continue;
      if(missing != "")
        missing += ",";
      missing += cryptoPairs[i];
    }
  }
  if(mode == "commodities" || mode == "all" || mode == "")
  {
    for(int i = 0; i < 3; i++)
    {
      if(HasPlannedSymbol(commodityPairs[i]))
        continue;
      if(missing != "")
        missing += ",";
      missing += commodityPairs[i];
    }
  }

  if(missing == "")
    return "none";
  return missing;
}

bool FindAcceptedSymbolIndex(const string apiSymbol, int &indexOut)
{
  indexOut = -1;
  string target = apiSymbol;
  StringToUpper(target);

  for(int i = 0; i < ArraySize(g_apiSymbols); i++)
  {
    string current = g_apiSymbols[i];
    StringToUpper(current);
    if(current == target)
    {
      indexOut = i;
      return true;
    }
  }
  return false;
}

bool IsUniverseSizingReady(string &reason)
{
  reason = "disabled";
  if(!RequireFullUniverseSizingReady)
    return true;

  int cooldown = UniverseSizingCheckCooldownSeconds;
  if(cooldown < 5)
    cooldown = 5;

  datetime now = TimeCurrent();
  if(g_lastUniverseSizingCheck != 0 && (now - g_lastUniverseSizingCheck) < cooldown)
  {
    reason = g_universeSizingReason;
    return g_universeSizingReady;
  }

  g_lastUniverseSizingCheck = now;
  g_universeSizingReady = false;
  g_universeSizingReason = "unknown";

  string mode = AssetFilter;
  StringToLower(mode);
  if(mode != "" && mode != "all")
  {
    g_universeSizingReason = "asset_filter_not_all";
    reason = g_universeSizingReason;
    return false;
  }

  string fxPairs[28] = {"EURUSD","GBPUSD","AUDUSD","NZDUSD","USDJPY","USDCHF","USDCAD","EURGBP",
                        "EURJPY","EURCHF","EURAUD","EURNZD","EURCAD","GBPJPY","GBPCHF","GBPAUD",
                        "GBPNZD","GBPCAD","AUDJPY","AUDCHF","AUDCAD","AUDNZD","NZDJPY","NZDCHF",
                        "NZDCAD","CADJPY","CADCHF","CHFJPY"};
  string indexPairs[3] = {"SPXUSD","NDXUSD","NIKKEIUSD"};
  string cryptoPairs[2] = {"BTCUSD","ETHUSD"};
  string commodityPairs[3] = {"XAUUSD","XAGUSD","WTIUSD"};

  string universe[36];
  int u = 0;
  for(int i = 0; i < 28; i++) universe[u++] = fxPairs[i];
  for(int i = 0; i < 3; i++) universe[u++] = indexPairs[i];
  for(int i = 0; i < 2; i++) universe[u++] = cryptoPairs[i];
  for(int i = 0; i < 3; i++) universe[u++] = commodityPairs[i];

  for(int i = 0; i < 36; i++)
  {
    string apiSymbol = universe[i];
    int idx = -1;
    if(!FindAcceptedSymbolIndex(apiSymbol, idx))
    {
      g_universeSizingReason = "missing_or_unresolved_" + apiSymbol;
      reason = g_universeSizingReason;
      return false;
    }

    string brokerSymbol = (idx < ArraySize(g_brokerSymbols) ? g_brokerSymbols[idx] : "");
    if(brokerSymbol == "")
    {
      g_universeSizingReason = "broker_symbol_empty_" + apiSymbol;
      reason = g_universeSizingReason;
      return false;
    }

    if(!IsTradableSymbol(brokerSymbol))
    {
      g_universeSizingReason = "not_tradable_" + brokerSymbol;
      reason = g_universeSizingReason;
      return false;
    }

    string assetClass = (idx < ArraySize(g_assetClasses) ? g_assetClasses[idx] : "fx");
    LegSizingResult sizing;
    if(!EvaluateLegSizing(brokerSymbol, assetClass, sizing) || sizing.finalLot <= 0.0)
    {
      g_universeSizingReason = "sizing_failed_" + brokerSymbol;
      reason = g_universeSizingReason;
      return false;
    }
  }

  g_universeSizingReady = true;
  g_universeSizingReason = "ok";
  reason = g_universeSizingReason;
  return true;
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

int CountOpenPositionsByModel(const string model)
{
  string target = model;
  StringToLower(target);
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
    string parsed = ParseModelFromComment(PositionGetString(POSITION_COMMENT));
    if(parsed == target)
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
  if(GlobalVariableCheck(ScopeKey(GV_LAST_PUSH)))
    lastPushUtc = (datetime)GlobalVariableGet(ScopeKey(GV_LAST_PUSH));
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
  GlobalVariableSet(ScopeKey(GV_LAST_PUSH), (double)g_lastPush);

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
  string accountId = IntegerToString((long)AccountInfoInteger(ACCOUNT_LOGIN));
  if(PushToken != "")
    request_headers += "x-mt5-token: " + PushToken + "\r\n";
  request_headers += "x-mt5-account-id: " + accountId + "\r\n";
  if(LicenseKey != "")
    request_headers += "x-mt5-license: " + LicenseKey + "\r\n";

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
  g_diagSkipSizingGuard = 0;
  g_diagSkipOrderFailed = 0;
  g_diagSkipMaxVolume = 0;
  g_diagSkipMaxPositions = 0;
  g_diagSkipRateLimit = 0;
  g_diagSkipPendingLegFill = 0;
}

void AddRawModelCount(const string model)
{
  string key = NormalizeModelName(model);
  if(key == "antikythera") g_diagRawA++;
  else if(key == "blended") g_diagRawB++;
  else if(key == "commercial") g_diagRawC++;
  else if(key == "dealer") g_diagRawD++;
  else if(key == "sentiment") g_diagRawS++;
}

void AddAcceptedModelCount(const string model)
{
  string key = NormalizeModelName(model);
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
  else if(key == "sizing_guard") g_diagSkipSizingGuard++;
  else if(key == "order_failed") g_diagSkipOrderFailed++;
  else if(key == "max_volume_reached") g_diagSkipMaxVolume++;
  else if(key == "max_positions") g_diagSkipMaxPositions++;
  else if(key == "rate_limit") g_diagSkipRateLimit++;
  else if(key == "pending_leg_fill") g_diagSkipPendingLegFill++;
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
  return NormalizeModelName(model);
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
  result += "\"sizing_guard\":" + IntegerToString(g_diagSkipSizingGuard) + ",";
  result += "\"order_failed\":" + IntegerToString(g_diagSkipOrderFailed) + ",";
  result += "\"max_volume_reached\":" + IntegerToString(g_diagSkipMaxVolume) + ",";
  result += "\"max_positions\":" + IntegerToString(g_diagSkipMaxPositions) + ",";
  result += "\"rate_limit\":" + IntegerToString(g_diagSkipRateLimit) + ",";
  result += "\"pending_leg_fill\":" + IntegerToString(g_diagSkipPendingLegFill);
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
    LegSizingResult sizing;
    bool ok = EvaluateLegSizing(symbol, assetClass, sizing);

    if(!firstRow)
      result += ",";
    firstRow = false;

    string model = (i < ArraySize(g_models) ? g_models[i] : "blended");
    result += "{";
    result += "\"symbol\":\"" + JsonEscape(symbol) + "\",";
    result += "\"model\":\"" + JsonEscape(model) + "\",";
    result += "\"direction\":\"" + ToLongShort(direction) + "\",";
    result += "\"units\":" + DoubleToString(ok ? sizing.finalLot : 0.0, 4) + ",";
    result += "\"target_units\":" + DoubleToString(sizing.targetLot, 4) + ",";
    result += "\"target_risk_usd\":" + DoubleToString(sizing.targetRiskUsd, 2) + ",";
    result += "\"move_1pct_usd\":" + DoubleToString(ok ? sizing.move1pctUsd : 0.0, 2) + ",";
    result += "\"sizing_profile\":\"" + JsonEscape(sizing.profile) + "\",";
    result += "\"sizing_status\":\"" + JsonEscape(ok ? "sized" : "unsized") + "\",";
    result += "\"sizing_reason\":\"" + JsonEscape(ok ? "" : sizing.reasonKey) + "\"";
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
  bool capacityLimited = (g_diagSkipMaxPositions > 0 || g_diagSkipRateLimit > 0 ||
                          g_diagSkipNotTradable > 0 || g_diagSkipInvalidVolume > 0 || g_diagSkipSizingGuard > 0 ||
                          g_diagSkipMaxVolume > 0 || g_diagSkipOrderFailed > 0);
  string reason = "";
  if(g_diagSkipMaxPositions > 0) reason = "max_positions";
  else if(g_diagSkipRateLimit > 0) reason = "rate_limit";
  else if(g_diagSkipNotTradable > 0) reason = "not_tradable";
  else if(g_diagSkipInvalidVolume > 0) reason = "invalid_volume";
  else if(g_diagSkipSizingGuard > 0) reason = "sizing_guard";
  else if(g_diagSkipMaxVolume > 0) reason = "max_volume_reached";
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
  payload += "\"license_key\":\"" + JsonEscape(LicenseKey) + "\",";
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
    LegSizingResult sizing;
    bool ok = EvaluateLegSizing(symbol, assetClass, sizing);

    if(!firstRow)
      result += ",";
    firstRow = false;

    result += "{";
    result += "\"symbol\":\"" + JsonEscape(symbol) + "\",";
    result += "\"asset_class\":\"" + JsonEscape(assetClass) + "\",";
    result += "\"lot\":" + DoubleToString(ok ? sizing.finalLot : 0.0, 4) + ",";
    result += "\"target_lot\":" + DoubleToString(sizing.targetLot, 4) + ",";
    result += "\"solved_lot_raw\":" + DoubleToString(sizing.solvedLotRaw, 4) + ",";
    result += "\"post_clamp_lot\":" + DoubleToString(sizing.postClampLot, 4) + ",";
    result += "\"deviation_pct\":" + DoubleToString(sizing.deviationPct, 2) + ",";
    result += "\"target_risk_usd\":" + DoubleToString(sizing.targetRiskUsd, 2) + ",";
    result += "\"margin_required\":" + DoubleToString(sizing.marginRequired, 2) + ",";
    result += "\"move_1pct_usd\":" + DoubleToString(ok ? sizing.move1pctUsd : 0.0, 2) + ",";
    result += "\"move_1pct_per_lot_usd\":" + DoubleToString(sizing.move1pctPerLotUsd, 2) + ",";
    result += "\"move_1pct_cap_usd\":" + DoubleToString(sizing.move1pctCapUsd, 2) + ",";
    result += "\"sizing_profile\":\"" + JsonEscape(sizing.profile) + "\",";
    result += "\"sizing_tolerance\":\"" + JsonEscape(sizing.toleranceMode) + "\",";
    result += "\"spec_price\":" + DoubleToString(sizing.specPrice, 5) + ",";
    result += "\"spec_tick_size\":" + DoubleToString(sizing.specTickSize, 8) + ",";
    result += "\"spec_tick_value\":" + DoubleToString(sizing.specTickValue, 8) + ",";
    result += "\"spec_contract_size\":" + DoubleToString(sizing.specContractSize, 4) + ",";
    result += "\"spec_volume_min\":" + DoubleToString(sizing.specMinLot, 4) + ",";
    result += "\"spec_volume_max\":" + DoubleToString(sizing.specMaxLot, 4) + ",";
    result += "\"spec_volume_step\":" + DoubleToString(sizing.specLotStep, 6) + ",";
    result += "\"sizing_status\":\"" + JsonEscape(ok ? "sized" : "unsized") + "\",";
    result += "\"sizing_reason\":\"" + JsonEscape(ok ? "" : sizing.reasonKey) + "\"";
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
