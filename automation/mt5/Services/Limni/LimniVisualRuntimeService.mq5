//+------------------------------------------------------------------+
//|                                  LimniVisualRuntimeService.mq5    |
//|        Non-trading closed-M1 snapshot service for Limni visuals   |
//+------------------------------------------------------------------+
#property copyright "LIMNI LTD"
#property version   "1.00"
#property service

#include "..\\..\\Indicators\\Include\\LimniVisualRuntimeSnapshot.mqh"

input bool UseDefaultFx28Symbols = true;
input string SymbolsCsv = "";
input int TimerSeconds = 1;
input int ScaleLookbackDays = 0;
input bool BuildStackSnapshots = true;
input bool BuildPortfolioQStateSnapshots = true;
input bool PrintStatus = true;

string g_symbols[];
int g_symbol_ids[];
datetime g_last_stack_asof[];
datetime g_last_qstate_asof = 0;
uint g_last_status_ms = 0;

string RuntimeTrim(const string value)
{
   int start = 0;
   int finish = StringLen(value) - 1;
   while(start <= finish && StringGetCharacter(value, start) <= 32)
      start++;
   while(finish >= start && StringGetCharacter(value, finish) <= 32)
      finish--;
   if(finish < start)
      return "";
   return StringSubstr(value, start, finish - start + 1);
}

bool RuntimeAppendSymbol(const string symbol, const int symbol_id)
{
   if(symbol == "")
      return false;
   for(int i = 0; i < ArraySize(g_symbols); i++)
   {
      if(g_symbols[i] == symbol)
         return true;
   }

   int next = ArraySize(g_symbols);
   ArrayResize(g_symbols, next + 1);
   ArrayResize(g_symbol_ids, next + 1);
   ArrayResize(g_last_stack_asof, next + 1);
   g_symbols[next] = symbol;
   g_symbol_ids[next] = symbol_id;
   g_last_stack_asof[next] = 0;
   SymbolSelect(symbol, true);
   return true;
}

void RuntimeLoadSymbols()
{
   ArrayResize(g_symbols, 0);
   ArrayResize(g_symbol_ids, 0);
   ArrayResize(g_last_stack_asof, 0);

   if(UseDefaultFx28Symbols)
   {
      for(int symbol_id = 0; symbol_id < LIMNI_QSTATE_SYMBOL_COUNT; symbol_id++)
      {
         string canonical = LimniQStateCanonicalSymbol(symbol_id);
         string broker_symbol = LimniQStateResolveBrokerSymbol(canonical);
         RuntimeAppendSymbol(broker_symbol, symbol_id);
      }
      return;
   }

   string raw[];
   int count = StringSplit(SymbolsCsv, ',', raw);
   for(int i = 0; i < count; i++)
   {
      string symbol = RuntimeTrim(raw[i]);
      if(symbol == "")
         continue;
      RuntimeAppendSymbol(symbol, LimniQStateSymbolIdFromBrokerSymbol(symbol));
   }
}

ulong RuntimePortfolioQStateHash(
   const LimniQStatePairFeatures &features[],
   const double &ccy_scores[]
)
{
   string payload = LimniQStateFormulaId() + "|" + (string)LimniQStateFormulaHash();
   for(int symbol_id = 0; symbol_id < LIMNI_QSTATE_SYMBOL_COUNT; symbol_id++)
   {
      string canonical = LimniQStateCanonicalSymbol(symbol_id);
      int base_ccy = -1;
      int quote_ccy = -1;
      LimniQStateBaseQuote(canonical, base_ccy, quote_ccy);
      double base_score = base_ccy >= 0 ? ccy_scores[base_ccy] : 0.0;
      double quote_score = quote_ccy >= 0 ? ccy_scores[quote_ccy] : 0.0;
      payload += "|" + IntegerToString(symbol_id) +
         ":" + LimniVisualStamp(features[symbol_id].source_m1_time) +
         ":" + DoubleToString(features[symbol_id].pair_q_score, 6) +
         ":" + DoubleToString(base_score, 6) +
         ":" + DoubleToString(quote_score, 6);
   }
   return LimniQStateHashString(payload);
}

void RuntimeWriteQStateFailure(const string reason, const string detail)
{
   for(int symbol_id = 0; symbol_id < LIMNI_QSTATE_SYMBOL_COUNT; symbol_id++)
   {
      string canonical = LimniQStateCanonicalSymbol(symbol_id);
      string broker_symbol = LimniQStateResolveBrokerSymbol(canonical);
      LimniVisualQStateSnapshot snapshot;
      LimniVisualResetQStateSnapshot(snapshot);
      snapshot.symbol = broker_symbol;
      snapshot.canonical = canonical;
      snapshot.valid = false;
      snapshot.reason_code = reason;
      snapshot.detail = detail;
      string write_reason = "";
      LimniVisualWriteQStateSnapshot(snapshot, write_reason);
   }
}

bool RuntimeBuildStackForIndex(const int index)
{
   string symbol = g_symbols[index];
   datetime latest_closed_m1 = iTime(symbol, LIMNI_LRMG_SOURCE_TIMEFRAME, 1);
   if(latest_closed_m1 <= 0)
      return false;

   if(g_last_stack_asof[index] == latest_closed_m1)
      return true;

   datetime source_times[];
   double source_closes[];
   double source_q[];
   double source_line[];
   double source_stoch[];
   double source_ma[];
   int source_ma_state[];
   int source_trigger[];
   int copied = 0;
   int day_count = 0;
   int valid_q_day_count = 0;
   double point = 0.0;
   string reason = "";

   if(!LimniVisualBuildStackSnapshot(
      symbol,
      ScaleLookbackDays,
      source_times,
      source_closes,
      source_q,
      source_line,
      source_stoch,
      source_ma,
      source_ma_state,
      source_trigger,
      copied,
      day_count,
      valid_q_day_count,
      point,
      reason
   ))
   {
      Print("LimniVisualRuntimeService stack build failed: ", symbol, " reason=", reason);
      return false;
   }

   ulong snapshot_hash = 0;
   if(!LimniVisualWriteStackSnapshot(
      symbol,
      ScaleLookbackDays,
      point,
      source_times,
      source_closes,
      source_q,
      source_line,
      source_stoch,
      source_ma,
      source_ma_state,
      source_trigger,
      copied,
      day_count,
      valid_q_day_count,
      snapshot_hash,
      reason
   ))
   {
      Print("LimniVisualRuntimeService stack write failed: ", symbol, " reason=", reason);
      return false;
   }

   g_last_stack_asof[index] = latest_closed_m1;
   return true;
}

bool RuntimeBuildPortfolioQState()
{
   if(!UseDefaultFx28Symbols)
      return true;

   datetime latest_closed_m1 = 0;
   bool latest_ready = true;
   for(int symbol_id = 0; symbol_id < LIMNI_QSTATE_SYMBOL_COUNT; symbol_id++)
   {
      string canonical = LimniQStateCanonicalSymbol(symbol_id);
      string broker_symbol = LimniQStateResolveBrokerSymbol(canonical);
      datetime symbol_latest = iTime(broker_symbol, PERIOD_M1, 1);
      if(symbol_latest <= 0)
      {
         latest_ready = false;
         break;
      }
      if(latest_closed_m1 <= 0)
         latest_closed_m1 = symbol_latest;
      else if(symbol_latest != latest_closed_m1)
      {
         latest_ready = false;
         break;
      }
   }

   if(!latest_ready || latest_closed_m1 <= 0)
   {
      RuntimeWriteQStateFailure("portfolio_latest_m1_unavailable", "service could not align all 28 latest closed M1 bars");
      return false;
   }
   if(g_last_qstate_asof == latest_closed_m1)
      return true;

   LimniQStatePairFeatures pair_features[LIMNI_QSTATE_SYMBOL_COUNT];
   double ccy_sums[LIMNI_QSTATE_CCY_COUNT];
   int ccy_counts[LIMNI_QSTATE_CCY_COUNT];
   double ccy_scores[LIMNI_QSTATE_CCY_COUNT];
   datetime portfolio_asof = 0;

   for(int i = 0; i < LIMNI_QSTATE_SYMBOL_COUNT; i++)
      LimniQStateResetPairFeatures(pair_features[i]);
   for(int c = 0; c < LIMNI_QSTATE_CCY_COUNT; c++)
   {
      ccy_sums[c] = 0.0;
      ccy_counts[c] = 0;
      ccy_scores[c] = 0.0;
   }

   for(int symbol_id = 0; symbol_id < LIMNI_QSTATE_SYMBOL_COUNT; symbol_id++)
   {
      string canonical = LimniQStateCanonicalSymbol(symbol_id);
      string symbol = LimniQStateResolveBrokerSymbol(canonical);
      datetime source_times[];
      double source_closes[];
      double source_q[];
      double source_line[];
      double source_stoch[];
      double source_ma[];
      int source_ma_state[];
      int source_trigger[];
      int copied = 0;
      int day_count = 0;
      int valid_q_day_count = 0;
      double point = 0.0;
      datetime snapshot_latest = 0;
      ulong snapshot_hash = 0;
      string read_reason = "";
      if(!LimniVisualReadStackSnapshot(
         symbol,
         ScaleLookbackDays,
         source_times,
         source_closes,
         source_q,
         source_line,
         source_stoch,
         source_ma,
         source_ma_state,
         source_trigger,
         copied,
         day_count,
         valid_q_day_count,
         point,
         snapshot_latest,
         snapshot_hash,
         read_reason
      ))
      {
         RuntimeWriteQStateFailure(
            read_reason,
            "symbol=" + symbol +
            "|formula_id=" + LimniQStateFormulaId() +
            "|formula_hash=" + (string)LimniQStateFormulaHash()
         );
         return false;
      }

      if(!LimniVisualQStateFeaturesFromStack(
         symbol,
         source_times,
         source_closes,
         source_q,
         source_line,
         source_stoch,
         source_ma_state,
         source_trigger,
         copied,
         day_count,
         valid_q_day_count,
         point,
         pair_features[symbol_id]
      ))
      {
         RuntimeWriteQStateFailure(
            pair_features[symbol_id].reason_code,
            "symbol=" + symbol +
            "|formula_id=" + LimniQStateFormulaId() +
            "|formula_hash=" + (string)LimniQStateFormulaHash()
         );
         return false;
      }

      if(portfolio_asof <= 0)
         portfolio_asof = pair_features[symbol_id].source_m1_time;
      else if(pair_features[symbol_id].source_m1_time != portfolio_asof)
      {
         RuntimeWriteQStateFailure(
            "mixed_source_m1_time",
            "symbol=" + symbol +
            "|expected=" + LimniVisualStamp(portfolio_asof) +
            "|actual=" + LimniVisualStamp(pair_features[symbol_id].source_m1_time) +
            "|formula_id=" + LimniQStateFormulaId() +
            "|formula_hash=" + (string)LimniQStateFormulaHash()
         );
         return false;
      }

      int base_ccy = -1;
      int quote_ccy = -1;
      LimniQStateBaseQuote(canonical, base_ccy, quote_ccy);
      if(base_ccy < 0 || quote_ccy < 0)
         continue;
      ccy_sums[base_ccy] += pair_features[symbol_id].pair_q_score;
      ccy_counts[base_ccy]++;
      ccy_sums[quote_ccy] -= pair_features[symbol_id].pair_q_score;
      ccy_counts[quote_ccy]++;
   }

   for(int c = 0; c < LIMNI_QSTATE_CCY_COUNT; c++)
   {
      if(ccy_counts[c] > 0)
         ccy_scores[c] = ccy_sums[c] / (double)ccy_counts[c];
   }

   ulong portfolio_hash = RuntimePortfolioQStateHash(pair_features, ccy_scores);
   for(int symbol_id = 0; symbol_id < LIMNI_QSTATE_SYMBOL_COUNT; symbol_id++)
   {
      string canonical = LimniQStateCanonicalSymbol(symbol_id);
      string broker_symbol = LimniQStateResolveBrokerSymbol(canonical);
      int base_ccy = -1;
      int quote_ccy = -1;
      LimniQStateBaseQuote(canonical, base_ccy, quote_ccy);
      if(base_ccy < 0 || quote_ccy < 0)
         continue;

      LimniQStateDirection decision;
      LimniQStateFinalizeDirection(
         pair_features[symbol_id],
         ccy_scores[base_ccy],
         ccy_scores[quote_ccy],
         decision
      );

      LimniVisualQStateSnapshot snapshot;
      LimniVisualResetQStateSnapshot(snapshot);
      snapshot.valid = decision.valid;
      snapshot.symbol = broker_symbol;
      snapshot.canonical = canonical;
      snapshot.formula_id = decision.formula_id;
      snapshot.formula_hash = decision.formula_hash;
      snapshot.portfolio_asof_m1_time = portfolio_asof;
      snapshot.portfolio_valid_pair_count = LIMNI_QSTATE_SYMBOL_COUNT;
      snapshot.portfolio_snapshot_hash = portfolio_hash;
      snapshot.source_m1_time = decision.source_m1_time;
      snapshot.state = decision.state;
      snapshot.trade_direction = decision.trade_direction;
      snapshot.market_mode = decision.market_mode;
      snapshot.pair_q_score = decision.pair_q_score;
      snapshot.base_currency_score = decision.base_currency_score;
      snapshot.quote_currency_score = decision.quote_currency_score;
      snapshot.pair_direction_score = decision.pair_direction_score;
      snapshot.confidence = decision.confidence;
      snapshot.reason_code = decision.reason_code;
      snapshot.detail = "formula_id=" + decision.formula_id +
         "|formula_hash=" + (string)decision.formula_hash +
         "|portfolio_asof_m1_time=" + LimniVisualStamp(portfolio_asof) +
         "|portfolio_valid_pair_count=" + IntegerToString(LIMNI_QSTATE_SYMBOL_COUNT) +
         "|portfolio_snapshot_hash=" + (string)portfolio_hash +
         "|source_m1_time=" + LimniVisualStamp(decision.source_m1_time) +
         "|state=" + IntegerToString(decision.state) +
         "|reason_code=" + decision.reason_code +
         "|pair_q_score=" + DoubleToString(decision.pair_q_score, 6) +
         "|base_currency_score=" + DoubleToString(decision.base_currency_score, 6) +
         "|quote_currency_score=" + DoubleToString(decision.quote_currency_score, 6) +
         "|pair_direction_score=" + DoubleToString(decision.pair_direction_score, 6) +
         "|confidence=" + DoubleToString(decision.confidence, 6);

      string write_reason = "";
      if(!LimniVisualWriteQStateSnapshot(snapshot, write_reason))
      {
         Print("LimniVisualRuntimeService qstate write failed: ", broker_symbol, " reason=", write_reason);
         return false;
      }
   }

   g_last_qstate_asof = latest_closed_m1;
   return true;
}

void RuntimeTick()
{
   int stack_ok = 0;
   if(BuildStackSnapshots)
   {
      for(int i = 0; i < ArraySize(g_symbols); i++)
      {
         if(RuntimeBuildStackForIndex(i))
            stack_ok++;
      }
   }

   bool qstate_ok = true;
   if(BuildPortfolioQStateSnapshots)
      qstate_ok = RuntimeBuildPortfolioQState();

   if(PrintStatus)
   {
      uint now = GetTickCount();
      if(g_last_status_ms == 0 || now - g_last_status_ms >= 30000)
      {
         Print(
            "LimniVisualRuntimeService status: symbols=",
            ArraySize(g_symbols),
            " stack_ok=",
            stack_ok,
            " qstate_ok=",
            LimniVisualBoolText(qstate_ok),
            " qstate_asof=",
            LimniVisualStamp(g_last_qstate_asof)
         );
         g_last_status_ms = now;
      }
   }
}

void OnStart()
{
   LimniVisualEnsureFolder();
   RuntimeLoadSymbols();
   Print(
      "LimniVisualRuntimeService started: symbols=",
      ArraySize(g_symbols),
      " scale_lookback_days=",
      ScaleLookbackDays,
      " timer_seconds=",
      MathMax(1, TimerSeconds)
   );

   while(!IsStopped())
   {
      RuntimeTick();
      Sleep(MathMax(1, TimerSeconds) * 1000);
   }

   Print("LimniVisualRuntimeService stopped");
}
