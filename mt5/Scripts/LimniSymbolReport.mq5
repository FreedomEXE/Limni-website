//+------------------------------------------------------------------+
//|                                            LimniSymbolReport.mq5 |
//|                     Dump symbol specs + 1:1 sizing reference    |
//+------------------------------------------------------------------+
#property strict
#property script_show_inputs

input bool UseCacheFile = true;
input string CacheFile = "LimniCotCache.json";
input bool FallbackToMarketWatch = true;
input string SymbolAliases = "SPXUSD=SPX500,NDXUSD=NDX100,NIKKEIUSD=JPN225,WTIUSD=USOUSD,BTCUSD=BTCUSD,ETHUSD=ETHUSD";
input bool WriteCsv = true;
input string OutputFile = "LimniSymbolReport.csv";
input bool IncludeHeader = true;

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

string SafeStr(const string value)
{
  if(value == "")
    return "--";
  return value;
}

string Dbl(const double value, const int digits)
{
  return DoubleToString(value, digits);
}

void DumpSymbol(const string apiSymbol, const string brokerSymbol, const double equity, const int handle)
{
  if(!SymbolSelect(brokerSymbol, true))
  {
    Print("Symbol not found: ", apiSymbol, " -> ", brokerSymbol);
    return;
  }

  double price = SymbolInfoDouble(brokerSymbol, SYMBOL_BID);
  if(price <= 0.0)
    price = SymbolInfoDouble(brokerSymbol, SYMBOL_ASK);
  if(price <= 0.0)
    price = SymbolInfoDouble(brokerSymbol, SYMBOL_LAST);

  double tickSize = SymbolInfoDouble(brokerSymbol, SYMBOL_TRADE_TICK_SIZE);
  double tickValue = SymbolInfoDouble(brokerSymbol, SYMBOL_TRADE_TICK_VALUE_PROFIT);
  if(tickValue <= 0.0)
    tickValue = SymbolInfoDouble(brokerSymbol, SYMBOL_TRADE_TICK_VALUE);
  double contractSize = SymbolInfoDouble(brokerSymbol, SYMBOL_TRADE_CONTRACT_SIZE);
  string profitCurrency = SymbolInfoString(brokerSymbol, SYMBOL_CURRENCY_PROFIT);
  int digits = (int)SymbolInfoInteger(brokerSymbol, SYMBOL_DIGITS);
  double minVol = SymbolInfoDouble(brokerSymbol, SYMBOL_VOLUME_MIN);
  double maxVol = SymbolInfoDouble(brokerSymbol, SYMBOL_VOLUME_MAX);
  double step = SymbolInfoDouble(brokerSymbol, SYMBOL_VOLUME_STEP);
  double marginInitial = SymbolInfoDouble(brokerSymbol, SYMBOL_MARGIN_INITIAL);
  int tradeMode = (int)SymbolInfoInteger(brokerSymbol, SYMBOL_TRADE_MODE);

  double lot1pct = 0.0;
  if(price > 0.0 && tickSize > 0.0 && tickValue > 0.0)
  {
    lot1pct = equity * tickSize / (price * tickValue);
  }
  double lot1pctNorm = lot1pct;
  if(step > 0.0 && minVol > 0.0)
  {
    double steps = MathFloor(lot1pctNorm / step + 1e-9);
    lot1pctNorm = steps * step;
    int volDigits = (int)MathRound(-MathLog10(step));
    lot1pctNorm = NormalizeDouble(lot1pctNorm, volDigits);
    if(lot1pctNorm < minVol)
      lot1pctNorm = minVol;
  }

  string line =
    apiSymbol + "," +
    brokerSymbol + "," +
    Dbl(price, digits) + "," +
    Dbl(tickSize, 10) + "," +
    Dbl(tickValue, 8) + "," +
    Dbl(contractSize, 2) + "," +
    SafeStr(profitCurrency) + "," +
    IntegerToString(digits) + "," +
    Dbl(minVol, 4) + "," +
    Dbl(maxVol, 2) + "," +
    Dbl(step, 6) + "," +
    Dbl(lot1pct, 6) + "," +
    Dbl(lot1pctNorm, 6) + "," +
    Dbl(marginInitial, 2) + "," +
    IntegerToString(tradeMode);

  Print(line);
  if(handle != INVALID_HANDLE)
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
    {
      string sym = SymbolName(i, true);
      AddUniqueSymbol(symbols, sym);
    }
  }

  if(ArraySize(symbols) == 0)
  {
    Print("No symbols found. Ensure cache exists or enable Market Watch fallback.");
    return;
  }

  int outHandle = INVALID_HANDLE;
  if(WriteCsv)
  {
    outHandle = FileOpen(OutputFile, FILE_WRITE | FILE_TXT | FILE_COMMON);
    if(outHandle == INVALID_HANDLE)
    {
      Print("Failed to open output file: ", OutputFile);
    }
    else if(IncludeHeader)
    {
      string header = "api_symbol,broker_symbol,price,tick_size,tick_value,contract_size,profit_currency,digits,min_vol,max_vol,step,lot_1pct_raw,lot_1pct_norm,margin_initial,trade_mode";
      FileWriteString(outHandle, header + "\r\n");
    }
  }

  double equity = AccountInfoDouble(ACCOUNT_EQUITY);
  Print("Equity used for sizing: ", DoubleToString(equity, 2));

  for(int i = 0; i < ArraySize(symbols); i++)
  {
    string apiSymbol = symbols[i];
    string resolved = "";
    if(!ResolveSymbol(apiSymbol, SymbolAliases, resolved))
    {
      Print("Symbol resolve failed: ", apiSymbol);
      continue;
    }
    DumpSymbol(apiSymbol, resolved, equity, outHandle);
  }

  if(outHandle != INVALID_HANDLE)
    FileClose(outHandle);

  Print("Done. Symbols processed: ", ArraySize(symbols));
}
