//+------------------------------------------------------------------+
//|                                           LimniSizingAudit.mq5   |
//|   Broker-by-broker sizing audit for EIGHTCAP vs 5ERS profiles    |
//+------------------------------------------------------------------+
#property strict
#property script_show_inputs

input bool UseCacheFile = true;
input string CacheFile = "LimniCotCache.json";
input bool FallbackToMarketWatch = true;
input string SymbolAliases = "SPXUSD=SPX500,NDXUSD=NDX100,NIKKEIUSD=JPN225,WTIUSD=USOUSD,BTCUSD=BTCUSD,ETHUSD=ETHUSD";
input string OutputFile = "LimniSizingAudit.csv";
input bool IncludeHeader = true;

input double FxLotMultiplier = 1.0;
input double CryptoLotMultiplier = 1.0;
input double CommoditiesLotMultiplier = 1.0;
input double IndicesLotMultiplier = 1.0;

input bool EnableSizingGuard = true;
input double MaxLegMove1PctOfEquity = 1.0;
input double FiveersMaxLegMove1PctOfEquity = 0.25;
input string SymbolMove1PctCapOfEquity = "";
input string FiveersSymbolMove1PctCapOfEquity = "XAUUSD=0.10,XAGUSD=0.10,WTIUSD=0.20";
input string SymbolLotCaps = "";
input string FiveersSymbolLotCaps = "XAUUSD=0.50,XAGUSD=0.50,WTIUSD=0.50";

struct SizingRow
{
  bool ok;
  string reason;
  double baseLotRaw;
  double targetLot;
  double finalLot;
  double marginRequired;
  double move1pctUsd;
  double move1pctCapUsd;
  bool lotCapTriggered;
  bool moveCapTriggered;
};

void AddUniqueSymbol(string &list[], const string value)
{
  if(value == "")
    return;
  for(int i = 0; i < ArraySize(list); i++)
  {
    if(list[i] == value)
      return;
  }
  int size = ArraySize(list);
  ArrayResize(list, size + 1);
  list[size] = value;
}

bool ExtractSymbolsFromJson(const string json, string &symbols[])
{
  ArrayResize(symbols, 0);
  int pos = 0;
  int len = StringLen(json);
  while(pos < len)
  {
    int key = StringFind(json, "\"symbol\"", pos);
    if(key < 0)
      break;
    int colon = StringFind(json, ":", key);
    if(colon < 0)
      break;
    int start = StringFind(json, "\"", colon + 1);
    if(start < 0)
      break;
    int end = StringFind(json, "\"", start + 1);
    if(end < 0)
      break;
    string symbol = StringSubstr(json, start + 1, end - start - 1);
    AddUniqueSymbol(symbols, symbol);
    pos = end + 1;
  }
  return (ArraySize(symbols) > 0);
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

bool ResolveSymbolByNormalizedKey(const string targetKey, string &resolved)
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

bool TryResolveAlias(const string apiSymbol, const string aliases, string &resolved)
{
  if(aliases == "")
    return false;
  string clean = aliases;
  StringReplace(clean, " ", "");
  int start = 0;
  while(start < StringLen(clean))
  {
    int comma = StringFind(clean, ",", start);
    if(comma < 0)
      comma = StringLen(clean);
    string pair = StringSubstr(clean, start, comma - start);
    int eq = StringFind(pair, "=");
    if(eq > 0)
    {
      string key = StringSubstr(pair, 0, eq);
      string val = StringSubstr(pair, eq + 1);
      StringToUpper(key);
      if(key == apiSymbol)
      {
        string candidate = val;
        if(SymbolSelect(candidate, true))
        {
          resolved = candidate;
          return true;
        }
        string candidateKey = NormalizeSymbolKey(candidate);
        if(ResolveSymbolByNormalizedKey(candidateKey, resolved))
          return true;
      }
    }
    start = comma + 1;
  }
  return false;
}

bool ResolveSymbol(const string apiSymbol, const string aliases, string &resolved)
{
  string target = apiSymbol;
  StringToUpper(target);
  if(TryResolveAlias(target, aliases, resolved))
    return true;
  if(SymbolSelect(target, true))
  {
    resolved = target;
    return true;
  }
  string targetKey = NormalizeSymbolKey(target);
  if(ResolveSymbolByNormalizedKey(targetKey, resolved))
    return true;
  return false;
}

string DetectAssetClass(const string apiSymbol)
{
  string key = NormalizeSymbolKey(apiSymbol);
  if(StringFind(key, "BTC") >= 0 || StringFind(key, "ETH") >= 0)
    return "crypto";
  if(StringFind(key, "XAU") >= 0 || StringFind(key, "XAG") >= 0 ||
     StringFind(key, "WTI") >= 0 || StringFind(key, "USOIL") >= 0 || StringFind(key, "USCRUDE") >= 0)
    return "commodities";
  if(StringFind(key, "SPX") >= 0 || StringFind(key, "SP500") >= 0 || StringFind(key, "US500") >= 0 ||
     StringFind(key, "NDX") >= 0 || StringFind(key, "NAS100") >= 0 || StringFind(key, "US100") >= 0 ||
     StringFind(key, "NIKKEI") >= 0 || StringFind(key, "JPN225") >= 0 || StringFind(key, "JP225") >= 0)
    return "indices";
  return "fx";
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

double NormalizeVolume(const string symbol, double volume)
{
  double minVol = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MIN);
  double maxVol = SymbolInfoDouble(symbol, SYMBOL_VOLUME_MAX);
  double step = SymbolInfoDouble(symbol, SYMBOL_VOLUME_STEP);
  if(minVol <= 0.0 || maxVol <= 0.0 || step <= 0.0)
    return 0.0;

  if(volume < minVol)
    volume = minVol;
  if(volume > maxVol)
    volume = maxVol;

  double steps = MathFloor(volume / step + 1e-9);
  double normalized = steps * step;
  int digits = (int)MathRound(-MathLog10(step));
  normalized = NormalizeDouble(normalized, digits);
  if(normalized < minVol)
    normalized = minVol;
  return normalized;
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
  {
    normalized -= step;
    if(normalized < minVol)
      return 0.0;
    normalized = NormalizeDouble(normalized, digits);
  }
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

double GetSymbolLotCap(const string symbol, bool isFiveers)
{
  double cap = 0.0;
  double parsed = 0.0;
  if(TryGetCsvSymbolDouble(SymbolLotCaps, symbol, parsed) && parsed > 0.0)
    cap = parsed;
  if(isFiveers && TryGetCsvSymbolDouble(FiveersSymbolLotCaps, symbol, parsed) && parsed > 0.0)
  {
    if(cap <= 0.0 || parsed < cap)
      cap = parsed;
  }
  return cap;
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

double GetMove1PctCapUsd(const string symbol, double baseEquity, bool isFiveers)
{
  if(!EnableSizingGuard || baseEquity <= 0.0)
    return 0.0;

  double pct = isFiveers ? FiveersMaxLegMove1PctOfEquity : MaxLegMove1PctOfEquity;
  double parsed = 0.0;
  if(TryGetCsvSymbolDouble(SymbolMove1PctCapOfEquity, symbol, parsed) && parsed > 0.0)
    pct = parsed;
  if(isFiveers && TryGetCsvSymbolDouble(FiveersSymbolMove1PctCapOfEquity, symbol, parsed) && parsed > 0.0)
    pct = parsed;

  if(pct <= 0.0)
    return 0.0;
  return baseEquity * pct / 100.0;
}

bool EvaluateSizing(const string symbol, const string assetClass, double baseEquity, bool isFiveers, SizingRow &row)
{
  row.ok = false;
  row.reason = "";
  row.baseLotRaw = 0.0;
  row.targetLot = 0.0;
  row.finalLot = 0.0;
  row.marginRequired = 0.0;
  row.move1pctUsd = 0.0;
  row.move1pctCapUsd = 0.0;
  row.lotCapTriggered = false;
  row.moveCapTriggered = false;

  double price = SymbolInfoDouble(symbol, SYMBOL_BID);
  if(price <= 0.0)
    price = SymbolInfoDouble(symbol, SYMBOL_ASK);
  if(price <= 0.0)
    price = SymbolInfoDouble(symbol, SYMBOL_LAST);

  double tickSize = SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_SIZE);
  double tickValue = SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_VALUE_PROFIT);
  if(tickValue <= 0.0)
    tickValue = SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_VALUE);

  if(price <= 0.0 || tickSize <= 0.0 || tickValue <= 0.0 || baseEquity <= 0.0)
  {
    row.reason = "invalid_market_specs";
    return false;
  }

  row.baseLotRaw = baseEquity * tickSize / (price * tickValue);
  double multiplier = GetAssetMultiplier(assetClass);
  row.targetLot = row.baseLotRaw * multiplier;
  if(row.targetLot <= 0.0)
  {
    row.reason = "target_zero";
    return false;
  }

  double riskScale = isFiveers ? 0.10 : 1.0;
  row.targetLot *= riskScale;
  row.finalLot = NormalizeVolume(symbol, row.targetLot);
  if(row.finalLot <= 0.0)
  {
    row.reason = "normalize_failed";
    return false;
  }

  if(EnableSizingGuard)
  {
    double lotCap = GetSymbolLotCap(symbol, isFiveers);
    if(lotCap > 0.0 && row.finalLot > lotCap + 1e-9)
    {
      double capped = ClampVolumeToMax(symbol, row.finalLot, lotCap);
      if(capped <= 0.0)
      {
        row.reason = "symbol_lot_cap";
        return false;
      }
      row.finalLot = capped;
      row.lotCapTriggered = true;
    }

    row.move1pctUsd = ComputeMove1PctUsd(symbol, row.finalLot);
    row.move1pctCapUsd = GetMove1PctCapUsd(symbol, baseEquity, isFiveers);
    if(row.move1pctCapUsd > 0.0 && row.move1pctUsd > row.move1pctCapUsd + 1e-9)
    {
      double ratio = row.move1pctCapUsd / row.move1pctUsd;
      double adjusted = row.finalLot * ratio;
      double capped = ClampVolumeToMax(symbol, adjusted, row.finalLot);
      if(capped <= 0.0)
      {
        row.reason = "move1pct_cap";
        return false;
      }
      row.finalLot = capped;
      row.move1pctUsd = ComputeMove1PctUsd(symbol, row.finalLot);
      row.moveCapTriggered = true;
    }
  }
  else
  {
    row.move1pctUsd = ComputeMove1PctUsd(symbol, row.finalLot);
  }

  row.marginRequired = CalculateMarginRequired(symbol, row.finalLot);
  row.ok = (row.finalLot > 0.0);
  return row.ok;
}

string Dbl(const double value, const int digits)
{
  return DoubleToString(value, digits);
}

void WriteAuditRow(const int handle, const string apiSymbol, const string brokerSymbol, const string assetClass,
                   const int tradeMode, const SizingRow &eightcap, const SizingRow &fiveers)
{
  double deltaAbs = fiveers.finalLot - eightcap.finalLot;
  double deltaPct = 0.0;
  if(eightcap.finalLot > 0.0)
    deltaPct = (deltaAbs / eightcap.finalLot) * 100.0;

  string line =
    apiSymbol + "," +
    brokerSymbol + "," +
    assetClass + "," +
    IntegerToString(tradeMode) + "," +
    (eightcap.ok ? "1" : "0") + "," +
    eightcap.reason + "," +
    Dbl(eightcap.baseLotRaw, 6) + "," +
    Dbl(eightcap.targetLot, 6) + "," +
    Dbl(eightcap.finalLot, 6) + "," +
    Dbl(eightcap.marginRequired, 2) + "," +
    Dbl(eightcap.move1pctUsd, 2) + "," +
    Dbl(eightcap.move1pctCapUsd, 2) + "," +
    (eightcap.lotCapTriggered ? "1" : "0") + "," +
    (eightcap.moveCapTriggered ? "1" : "0") + "," +
    (fiveers.ok ? "1" : "0") + "," +
    fiveers.reason + "," +
    Dbl(fiveers.baseLotRaw, 6) + "," +
    Dbl(fiveers.targetLot, 6) + "," +
    Dbl(fiveers.finalLot, 6) + "," +
    Dbl(fiveers.marginRequired, 2) + "," +
    Dbl(fiveers.move1pctUsd, 2) + "," +
    Dbl(fiveers.move1pctCapUsd, 2) + "," +
    (fiveers.lotCapTriggered ? "1" : "0") + "," +
    (fiveers.moveCapTriggered ? "1" : "0") + "," +
    Dbl(deltaAbs, 6) + "," +
    Dbl(deltaPct, 2);

  Print(line);
  FileWriteString(handle, line + "\r\n");
}

void OnStart()
{
  string symbols[];
  ArrayResize(symbols, 0);

  if(UseCacheFile)
  {
    int cacheHandle = FileOpen(CacheFile, FILE_READ | FILE_TXT | FILE_COMMON);
    if(cacheHandle != INVALID_HANDLE)
    {
      string json = FileReadString(cacheHandle);
      FileClose(cacheHandle);
      ExtractSymbolsFromJson(json, symbols);
    }
  }

  if(ArraySize(symbols) == 0 && FallbackToMarketWatch)
  {
    int total = SymbolsTotal(true);
    for(int i = 0; i < total; i++)
      AddUniqueSymbol(symbols, SymbolName(i, true));
  }

  if(ArraySize(symbols) == 0)
  {
    Print("No symbols found. Ensure cache exists or enable Market Watch fallback.");
    return;
  }

  int outHandle = FileOpen(OutputFile, FILE_WRITE | FILE_TXT | FILE_COMMON);
  if(outHandle == INVALID_HANDLE)
  {
    Print("Failed to open output file: ", OutputFile);
    return;
  }

  if(IncludeHeader)
  {
    string header = "api_symbol,broker_symbol,asset_class,trade_mode,eightcap_ok,eightcap_reason,eightcap_base_lot_raw,eightcap_target_lot,eightcap_final_lot,eightcap_margin,eightcap_move1pct_usd,eightcap_move1pct_cap_usd,eightcap_lot_cap_hit,eightcap_move_cap_hit,fiveers_ok,fiveers_reason,fiveers_base_lot_raw,fiveers_target_lot,fiveers_final_lot,fiveers_margin,fiveers_move1pct_usd,fiveers_move1pct_cap_usd,fiveers_lot_cap_hit,fiveers_move_cap_hit,delta_lot_abs,delta_lot_pct";
    FileWriteString(outHandle, header + "\r\n");
  }

  double equity = AccountInfoDouble(ACCOUNT_EQUITY);
  Print("Sizing audit equity: ", DoubleToString(equity, 2));
  Print("Broker: ", AccountInfoString(ACCOUNT_COMPANY), " | Server: ", AccountInfoString(ACCOUNT_SERVER));

  int processed = 0;
  int unresolved = 0;
  for(int i = 0; i < ArraySize(symbols); i++)
  {
    string apiSymbol = symbols[i];
    string resolved = "";
    if(!ResolveSymbol(apiSymbol, SymbolAliases, resolved))
    {
      unresolved++;
      Print("Resolve failed: ", apiSymbol);
      continue;
    }

    string assetClass = DetectAssetClass(apiSymbol);
    int tradeMode = (int)SymbolInfoInteger(resolved, SYMBOL_TRADE_MODE);

    SizingRow eightcap;
    SizingRow fiveers;
    EvaluateSizing(resolved, assetClass, equity, false, eightcap);
    EvaluateSizing(resolved, assetClass, equity, true, fiveers);

    WriteAuditRow(outHandle, apiSymbol, resolved, assetClass, tradeMode, eightcap, fiveers);
    processed++;
  }

  FileClose(outHandle);

  Print("Sizing audit complete. processed=", processed, " unresolved=", unresolved, " output=", OutputFile);
}
