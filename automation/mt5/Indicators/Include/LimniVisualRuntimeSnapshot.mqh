//+------------------------------------------------------------------+
//|                     LimniVisualRuntimeSnapshot.mqh               |
//|      Common Files snapshot contract for visual LRMG runtime      |
//+------------------------------------------------------------------+
#ifndef LIMNI_VISUAL_RUNTIME_SNAPSHOT_MQH
#define LIMNI_VISUAL_RUNTIME_SNAPSHOT_MQH

#include "LimniQStateCore.mqh"

#define LIMNI_VISUAL_RUNTIME_VERSION "g99za-visual-runtime-snapshot-v001"
#define LIMNI_VISUAL_RUNTIME_FOLDER "LimniVisualRuntime"

struct LimniVisualQStateSnapshot
{
   bool valid;
   string symbol;
   string canonical;
   string formula_id;
   ulong formula_hash;
   datetime portfolio_asof_m1_time;
   int portfolio_valid_pair_count;
   ulong portfolio_snapshot_hash;
   datetime source_m1_time;
   int state;
   int trade_direction;
   int market_mode;
   double pair_q_score;
   double base_currency_score;
   double quote_currency_score;
   double pair_direction_score;
   double confidence;
   string reason_code;
   string detail;
   ulong snapshot_hash;
};

string LimniVisualBoolText(const bool value)
{
   return value ? "true" : "false";
}

bool LimniVisualParseBool(const string value)
{
   return value == "true" || value == "TRUE" || value == "1";
}

string LimniVisualSafePart(const string value)
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
      out = "blank";
   return out;
}

string LimniVisualStamp(const datetime value)
{
   if(value <= 0)
      return "";
   return TimeToString(value, TIME_DATE | TIME_SECONDS);
}

datetime LimniVisualParseTime(const string value)
{
   if(value == "")
      return (datetime)0;
   return StringToTime(value);
}

string LimniVisualDoubleField(const double value, const int digits = 12)
{
   if(value == EMPTY_VALUE || !MathIsValidNumber(value))
      return "EMPTY";
   return DoubleToString(value, digits);
}

double LimniVisualParseDouble(const string value)
{
   if(value == "EMPTY" || value == "")
      return EMPTY_VALUE;
   return StringToDouble(value);
}

void LimniVisualEnsureFolder()
{
   FolderCreate(LIMNI_VISUAL_RUNTIME_FOLDER, FILE_COMMON);
}

string LimniVisualStackSnapshotFile(const string symbol, const int scale_lookback_days)
{
   return LIMNI_VISUAL_RUNTIME_FOLDER + "\\stack_" +
      LimniVisualSafePart(symbol) +
      "_s" + IntegerToString(scale_lookback_days) +
      ".csv";
}

string LimniVisualQStateSnapshotFile(const string symbol)
{
   return LIMNI_VISUAL_RUNTIME_FOLDER + "\\qstate_" +
      LimniVisualSafePart(symbol) +
      ".csv";
}

void LimniVisualDrainCsvLine(const int handle)
{
   while(!FileIsEnding(handle) && !FileIsLineEnding(handle))
      FileReadString(handle);
}

ulong LimniVisualStackSnapshotHash(
   const string symbol,
   const int scale_lookback_days,
   const double point,
   const datetime &source_times[],
   const double &source_closes[],
   const double &source_q[],
   const double &source_line[],
   const double &source_stoch[],
   const int &source_ma_state[],
   const int copied,
   const int day_count,
   const int valid_q_day_count
)
{
   int count = ArraySize(source_times);
   int last = count - 1;
   string payload = LIMNI_VISUAL_RUNTIME_VERSION +
      "|stack|" + symbol +
      "|scale=" + IntegerToString(scale_lookback_days) +
      "|point=" + DoubleToString(point, 12) +
      "|copied=" + IntegerToString(copied) +
      "|days=" + IntegerToString(day_count) +
      "|qdays=" + IntegerToString(valid_q_day_count) +
      "|count=" + IntegerToString(count);
   if(count > 0)
   {
      payload += "|first=" + LimniVisualStamp(source_times[0]) +
         "|last=" + LimniVisualStamp(source_times[last]) +
         "|close=" + DoubleToString(source_closes[last], 12) +
         "|q=" + DoubleToString(source_q[last], 12) +
         "|line=" + DoubleToString(source_line[last], 12) +
         "|stoch=" + DoubleToString(source_stoch[last], 12) +
         "|state=" + IntegerToString(source_ma_state[last]);
   }
   return LimniQStateHashString(payload);
}

bool LimniVisualBuildStackSnapshot(
   const string symbol,
   const int scale_lookback_days,
   datetime &source_times[],
   double &source_closes[],
   double &source_q[],
   double &source_line[],
   double &source_stoch[],
   double &source_ma[],
   int &source_ma_state[],
   int &source_trigger[],
   int &copied,
   int &day_count,
   int &valid_q_day_count,
   double &point,
   string &reason_code
)
{
   ArrayResize(source_times, 0);
   ArrayResize(source_closes, 0);
   ArrayResize(source_q, 0);
   ArrayResize(source_line, 0);
   ArrayResize(source_stoch, 0);
   ArrayResize(source_ma, 0);
   ArrayResize(source_ma_state, 0);
   ArrayResize(source_trigger, 0);
   copied = 0;
   day_count = 0;
   valid_q_day_count = 0;
   point = 0.0;
   reason_code = "";

   if(symbol == "" || !SymbolSelect(symbol, true))
   {
      reason_code = "symbol_select_failed";
      return false;
   }

   datetime latest_closed_m1 = iTime(symbol, LIMNI_LRMG_SOURCE_TIMEFRAME, 1);
   if(latest_closed_m1 <= 0)
   {
      reason_code = "latest_closed_m1_missing";
      return false;
   }

   point = SymbolInfoDouble(symbol, SYMBOL_POINT);
   if(point <= 0.0)
      point = _Point;

   MqlRates source_rates[];
   ArraySetAsSeries(source_rates, false);
   ResetLastError();
   copied = CopyRates(symbol, LIMNI_LRMG_SOURCE_TIMEFRAME, (datetime)0, TimeCurrent(), source_rates);
   if(copied < 100)
   {
      reason_code = "insufficient_m1_history";
      return false;
   }

   if(source_rates[0].time > source_rates[copied - 1].time)
   {
      MqlRates ordered[];
      ArrayResize(ordered, copied);
      for(int i = 0; i < copied; i++)
         ordered[i] = source_rates[copied - 1 - i];

      ArrayResize(source_rates, copied);
      for(int i = 0; i < copied; i++)
         source_rates[i] = ordered[i];
   }

   while(copied > 0 && source_rates[copied - 1].time > latest_closed_m1)
   {
      copied--;
      ArrayResize(source_rates, copied);
   }
   if(copied < 100)
   {
      reason_code = "insufficient_closed_m1_history";
      return false;
   }

   int source_trigger_sweep_side[];
   int source_trigger_resolution[];
   int source_trigger_anchor_relation[];
   int source_trigger_trend_relation[];
   int source_trigger_setup_age[];
   double source_trigger_q_distance[];

   if(!LimniBuildStackSeries(
      source_rates,
      copied,
      scale_lookback_days,
      point,
      source_times,
      source_closes,
      source_q,
      source_line,
      source_stoch,
      source_ma,
      source_ma_state,
      source_trigger,
      source_trigger_sweep_side,
      source_trigger_resolution,
      source_trigger_anchor_relation,
      source_trigger_trend_relation,
      source_trigger_setup_age,
      source_trigger_q_distance,
      day_count,
      valid_q_day_count
   ))
   {
      reason_code = "stack_build_failed";
      return false;
   }

   reason_code = "stack_ready";
   return true;
}

bool LimniVisualWriteStackSnapshot(
   const string symbol,
   const int scale_lookback_days,
   const double point,
   const datetime &source_times[],
   const double &source_closes[],
   const double &source_q[],
   const double &source_line[],
   const double &source_stoch[],
   const double &source_ma[],
   const int &source_ma_state[],
   const int &source_trigger[],
   const int copied,
   const int day_count,
   const int valid_q_day_count,
   ulong &snapshot_hash,
   string &reason_code
)
{
   LimniVisualEnsureFolder();
   snapshot_hash = LimniVisualStackSnapshotHash(
      symbol,
      scale_lookback_days,
      point,
      source_times,
      source_closes,
      source_q,
      source_line,
      source_stoch,
      source_ma_state,
      copied,
      day_count,
      valid_q_day_count
   );

   string file_name = LimniVisualStackSnapshotFile(symbol, scale_lookback_days);
   int handle = FileOpen(file_name, FILE_WRITE | FILE_CSV | FILE_ANSI | FILE_COMMON, ',');
   if(handle == INVALID_HANDLE)
   {
      reason_code = "stack_snapshot_open_failed";
      return false;
   }

   int count = ArraySize(source_times);
   FileWrite(handle, "meta", "version", LIMNI_VISUAL_RUNTIME_VERSION);
   FileWrite(handle, "meta", "kind", "stack");
   FileWrite(handle, "meta", "symbol", symbol);
   FileWrite(handle, "meta", "scale_lookback_days", scale_lookback_days);
   FileWrite(handle, "meta", "point", DoubleToString(point, 12));
   FileWrite(handle, "meta", "latest_closed_m1", count > 0 ? LimniVisualStamp(source_times[count - 1]) : "");
   FileWrite(handle, "meta", "copied", copied);
   FileWrite(handle, "meta", "day_count", day_count);
   FileWrite(handle, "meta", "valid_q_day_count", valid_q_day_count);
   FileWrite(handle, "meta", "bar_count", count);
   FileWrite(handle, "meta", "snapshot_hash", (string)snapshot_hash);
   FileWrite(handle, "bar", "time", "close", "q", "line", "stoch", "ma", "ma_state", "trigger");
   for(int i = 0; i < count; i++)
   {
      FileWrite(
         handle,
         "bar",
         LimniVisualStamp(source_times[i]),
         LimniVisualDoubleField(source_closes[i], 12),
         LimniVisualDoubleField(source_q[i], 12),
         LimniVisualDoubleField(source_line[i], 12),
         LimniVisualDoubleField(source_stoch[i], 8),
         LimniVisualDoubleField(source_ma[i], 8),
         source_ma_state[i],
         source_trigger[i]
      );
   }
   FileFlush(handle);
   FileClose(handle);
   reason_code = "stack_snapshot_written";
   return true;
}

bool LimniVisualReadStackSnapshot(
   const string symbol,
   const int scale_lookback_days,
   datetime &source_times[],
   double &source_closes[],
   double &source_q[],
   double &source_line[],
   double &source_stoch[],
   double &source_ma[],
   int &source_ma_state[],
   int &source_trigger[],
   int &copied,
   int &day_count,
   int &valid_q_day_count,
   double &point,
   datetime &latest_closed_m1,
   ulong &snapshot_hash,
   string &reason_code
)
{
   ArrayResize(source_times, 0);
   ArrayResize(source_closes, 0);
   ArrayResize(source_q, 0);
   ArrayResize(source_line, 0);
   ArrayResize(source_stoch, 0);
   ArrayResize(source_ma, 0);
   ArrayResize(source_ma_state, 0);
   ArrayResize(source_trigger, 0);
   copied = 0;
   day_count = 0;
   valid_q_day_count = 0;
   point = 0.0;
   latest_closed_m1 = 0;
   snapshot_hash = 0;
   reason_code = "";

   string file_name = LimniVisualStackSnapshotFile(symbol, scale_lookback_days);
   int handle = FileOpen(file_name, FILE_READ | FILE_CSV | FILE_ANSI | FILE_COMMON, ',');
   if(handle == INVALID_HANDLE)
   {
      reason_code = "stack_snapshot_missing";
      return false;
   }

   int count = 0;
   while(!FileIsEnding(handle))
   {
      string record = FileReadString(handle);
      if(FileIsEnding(handle) && record == "")
         break;

      if(record == "meta")
      {
         string key = FileReadString(handle);
         string value = FileReadString(handle);
         if(key == "version" && value != LIMNI_VISUAL_RUNTIME_VERSION)
         {
            reason_code = "stack_snapshot_version_mismatch";
            FileClose(handle);
            return false;
         }
         else if(key == "point")
            point = StringToDouble(value);
         else if(key == "latest_closed_m1")
            latest_closed_m1 = LimniVisualParseTime(value);
         else if(key == "copied")
            copied = (int)StringToInteger(value);
         else if(key == "day_count")
            day_count = (int)StringToInteger(value);
         else if(key == "valid_q_day_count")
            valid_q_day_count = (int)StringToInteger(value);
         else if(key == "snapshot_hash")
            snapshot_hash = (ulong)StringToInteger(value);
         LimniVisualDrainCsvLine(handle);
      }
      else if(record == "bar")
      {
         string raw_time = FileReadString(handle);
         if(raw_time == "time")
         {
            LimniVisualDrainCsvLine(handle);
            continue;
         }

         ArrayResize(source_times, count + 1);
         ArrayResize(source_closes, count + 1);
         ArrayResize(source_q, count + 1);
         ArrayResize(source_line, count + 1);
         ArrayResize(source_stoch, count + 1);
         ArrayResize(source_ma, count + 1);
         ArrayResize(source_ma_state, count + 1);
         ArrayResize(source_trigger, count + 1);

         source_times[count] = LimniVisualParseTime(raw_time);
         source_closes[count] = LimniVisualParseDouble(FileReadString(handle));
         source_q[count] = LimniVisualParseDouble(FileReadString(handle));
         source_line[count] = LimniVisualParseDouble(FileReadString(handle));
         source_stoch[count] = LimniVisualParseDouble(FileReadString(handle));
         source_ma[count] = LimniVisualParseDouble(FileReadString(handle));
         source_ma_state[count] = (int)StringToInteger(FileReadString(handle));
         source_trigger[count] = (int)StringToInteger(FileReadString(handle));
         count++;
         LimniVisualDrainCsvLine(handle);
      }
      else
      {
         LimniVisualDrainCsvLine(handle);
      }
   }

   FileClose(handle);
   if(count <= 0 || latest_closed_m1 <= 0)
   {
      reason_code = "stack_snapshot_empty";
      return false;
   }

   if(copied <= 0)
      copied = count;
   reason_code = "stack_snapshot_read";
   return true;
}

bool LimniVisualQStateFeaturesFromStack(
   const string symbol,
   const datetime &source_times[],
   const double &source_closes[],
   const double &source_q[],
   const double &source_line[],
   const double &source_stoch[],
   const int &source_ma_state[],
   const int &source_trigger[],
   const int copied,
   const int day_count,
   const int valid_q_day_count,
   const double point,
   LimniQStatePairFeatures &features
)
{
   LimniQStateResetPairFeatures(features);
   features.symbol = symbol;

   int source_count = ArraySize(source_times);
   if(source_count <= 0)
   {
      features.reason_code = "stack_snapshot_empty";
      return false;
   }

   int index = -1;
   for(int i = source_count - 1; i >= 0; i--)
   {
      if(source_q[i] > 0.0 && source_line[i] != EMPTY_VALUE)
      {
         index = i;
         break;
      }
   }

   if(index < 0)
   {
      features.reason_code = "qstate_pair_features_not_ready";
      return false;
   }

   double trend_raw[];
   double anchor_raw[];
   double event_raw[];
   double range_raw[];
   double sweep_raw[];
   ArrayResize(trend_raw, source_count);
   ArrayResize(anchor_raw, source_count);
   ArrayResize(event_raw, source_count);
   ArrayResize(range_raw, source_count);
   ArrayResize(sweep_raw, source_count);

   int trigger_count = 0;
   int last_trigger = LIMNI_KTR_SIGNAL_NONE;
   int last_trigger_at_index = LIMNI_KTR_SIGNAL_NONE;
   for(int i = 0; i < source_count; i++)
   {
      double q = source_q[i];
      trend_raw[i] = LimniQStateTrendPersistence(source_ma_state, i);
      anchor_raw[i] = (q > 0.0 && source_line[i] != EMPTY_VALUE) ?
         LimniQStateClamp((source_closes[i] - source_line[i]) / q, -1.0, 1.0) : 0.0;
      event_raw[i] = LimniQStateRecentCloseDirectionPersistence(source_closes, i);
      range_raw[i] = source_stoch[i] == EMPTY_VALUE ? 0.0 :
         LimniQStateClamp((source_stoch[i] - 50.0) / 50.0, -1.0, 1.0);
      if(source_trigger[i] != LIMNI_KTR_SIGNAL_NONE)
      {
         last_trigger = source_trigger[i];
         trigger_count++;
      }
      sweep_raw[i] = LimniQStateSweepResolutionScore(last_trigger);
      if(i == index)
         last_trigger_at_index = last_trigger;
   }

   double q = source_q[index];
   double symbol_point = point > 0.0 ? point : SymbolInfoDouble(symbol, SYMBOL_POINT);
   if(symbol_point <= 0.0)
      symbol_point = _Point;
   double spread_points = (double)SymbolInfoInteger(symbol, SYMBOL_SPREAD);
   double spread_cost_q = q > 0.0 ? (spread_points * symbol_point) / q : 0.0;

   double trend_persistence = LimniQStateRollingZ(trend_raw, index);
   double anchor_displacement = LimniQStateRollingZ(anchor_raw, index);
   double event_direction_persistence = LimniQStateRollingZ(event_raw, index);
   double range_position = LimniQStateRollingZ(range_raw, index);
   double sweep_resolution = LimniQStateRollingZ(sweep_raw, index);
   double raw_score = trend_persistence +
      anchor_displacement +
      event_direction_persistence +
      range_position +
      sweep_resolution;

   double pair_score = raw_score;
   if(pair_score > 0.0)
      pair_score = MathMax(0.0, pair_score - spread_cost_q);
   else if(pair_score < 0.0)
      pair_score = MathMin(0.0, pair_score + spread_cost_q);

   if(!MathIsValidNumber(pair_score))
   {
      features.reason_code = "pair_score_invalid";
      return false;
   }

   features.valid = true;
   features.source_m1_time = source_times[index];
   features.copied_m1 = copied > 0 ? copied : source_count;
   features.day_count = day_count;
   features.valid_q_day_count = valid_q_day_count;
   features.price = source_closes[index];
   features.q = q;
   features.anchor = source_line[index];
   features.trend_persistence = trend_persistence;
   features.anchor_displacement = anchor_displacement;
   features.event_direction_persistence = event_direction_persistence;
   features.range_position = range_position;
   features.sweep_resolution = sweep_resolution;
   features.spread_cost_q = spread_cost_q;
   features.pair_q_score = pair_score;
   features.confidence = LimniQStateClamp(MathAbs(pair_score) / LIMNI_QSTATE_V001_STRONG_THRESHOLD, 0.0, 1.0);
   features.katarakti_signal = last_trigger_at_index;
   features.event_count = trigger_count;
   features.reason_code = "qstate_pair_features_ready";
   return true;
}

void LimniVisualResetQStateSnapshot(LimniVisualQStateSnapshot &snapshot)
{
   snapshot.valid = false;
   snapshot.symbol = "";
   snapshot.canonical = "";
   snapshot.formula_id = LimniQStateFormulaId();
   snapshot.formula_hash = LimniQStateFormulaHash();
   snapshot.portfolio_asof_m1_time = 0;
   snapshot.portfolio_valid_pair_count = 0;
   snapshot.portfolio_snapshot_hash = 0;
   snapshot.source_m1_time = 0;
   snapshot.state = LIMNI_QSTATE_PAIR_STATE_NEUTRAL;
   snapshot.trade_direction = LIMNI_QSTATE_SIDE_NONE;
   snapshot.market_mode = LIMNI_QSTATE_MARKET_UNKNOWN;
   snapshot.pair_q_score = 0.0;
   snapshot.base_currency_score = 0.0;
   snapshot.quote_currency_score = 0.0;
   snapshot.pair_direction_score = 0.0;
   snapshot.confidence = 0.0;
   snapshot.reason_code = "not_loaded";
   snapshot.detail = "";
   snapshot.snapshot_hash = 0;
}

ulong LimniVisualQStateSnapshotHash(const LimniVisualQStateSnapshot &snapshot)
{
   string payload = LIMNI_VISUAL_RUNTIME_VERSION +
      "|qstate|" + snapshot.symbol +
      "|canonical=" + snapshot.canonical +
      "|formula=" + snapshot.formula_id +
      "|" + (string)snapshot.formula_hash +
      "|asof=" + LimniVisualStamp(snapshot.portfolio_asof_m1_time) +
      "|portfolio_hash=" + (string)snapshot.portfolio_snapshot_hash +
      "|source=" + LimniVisualStamp(snapshot.source_m1_time) +
      "|state=" + IntegerToString(snapshot.state) +
      "|direction=" + IntegerToString(snapshot.trade_direction) +
      "|score=" + DoubleToString(snapshot.pair_direction_score, 6) +
      "|confidence=" + DoubleToString(snapshot.confidence, 6) +
      "|reason=" + snapshot.reason_code;
   return LimniQStateHashString(payload);
}

bool LimniVisualWriteQStateSnapshot(
   LimniVisualQStateSnapshot &snapshot,
   string &reason_code
)
{
   LimniVisualEnsureFolder();
   snapshot.snapshot_hash = LimniVisualQStateSnapshotHash(snapshot);
   string file_name = LimniVisualQStateSnapshotFile(snapshot.symbol);
   int handle = FileOpen(file_name, FILE_WRITE | FILE_CSV | FILE_ANSI | FILE_COMMON, ',');
   if(handle == INVALID_HANDLE)
   {
      reason_code = "qstate_snapshot_open_failed";
      return false;
   }

   FileWrite(handle, "meta", "version", LIMNI_VISUAL_RUNTIME_VERSION);
   FileWrite(handle, "meta", "kind", "qstate");
   FileWrite(handle, "meta", "valid", LimniVisualBoolText(snapshot.valid));
   FileWrite(handle, "meta", "symbol", snapshot.symbol);
   FileWrite(handle, "meta", "canonical", snapshot.canonical);
   FileWrite(handle, "meta", "formula_id", snapshot.formula_id);
   FileWrite(handle, "meta", "formula_hash", (string)snapshot.formula_hash);
   FileWrite(handle, "meta", "portfolio_asof_m1_time", LimniVisualStamp(snapshot.portfolio_asof_m1_time));
   FileWrite(handle, "meta", "portfolio_valid_pair_count", snapshot.portfolio_valid_pair_count);
   FileWrite(handle, "meta", "portfolio_snapshot_hash", (string)snapshot.portfolio_snapshot_hash);
   FileWrite(handle, "meta", "source_m1_time", LimniVisualStamp(snapshot.source_m1_time));
   FileWrite(handle, "meta", "state", snapshot.state);
   FileWrite(handle, "meta", "trade_direction", snapshot.trade_direction);
   FileWrite(handle, "meta", "market_mode", snapshot.market_mode);
   FileWrite(handle, "meta", "pair_q_score", DoubleToString(snapshot.pair_q_score, 6));
   FileWrite(handle, "meta", "base_currency_score", DoubleToString(snapshot.base_currency_score, 6));
   FileWrite(handle, "meta", "quote_currency_score", DoubleToString(snapshot.quote_currency_score, 6));
   FileWrite(handle, "meta", "pair_direction_score", DoubleToString(snapshot.pair_direction_score, 6));
   FileWrite(handle, "meta", "confidence", DoubleToString(snapshot.confidence, 6));
   FileWrite(handle, "meta", "reason_code", snapshot.reason_code);
   FileWrite(handle, "meta", "detail", snapshot.detail);
   FileWrite(handle, "meta", "snapshot_hash", (string)snapshot.snapshot_hash);
   FileFlush(handle);
   FileClose(handle);
   reason_code = "qstate_snapshot_written";
   return true;
}

bool LimniVisualReadQStateSnapshot(
   const string symbol,
   LimniVisualQStateSnapshot &snapshot,
   string &reason_code
)
{
   LimniVisualResetQStateSnapshot(snapshot);
   reason_code = "";

   string file_name = LimniVisualQStateSnapshotFile(symbol);
   int handle = FileOpen(file_name, FILE_READ | FILE_CSV | FILE_ANSI | FILE_COMMON, ',');
   if(handle == INVALID_HANDLE)
   {
      reason_code = "qstate_snapshot_missing";
      snapshot.reason_code = reason_code;
      return false;
   }

   while(!FileIsEnding(handle))
   {
      string record = FileReadString(handle);
      if(FileIsEnding(handle) && record == "")
         break;

      if(record != "meta")
      {
         LimniVisualDrainCsvLine(handle);
         continue;
      }

      string key = FileReadString(handle);
      string value = FileReadString(handle);
      if(key == "version" && value != LIMNI_VISUAL_RUNTIME_VERSION)
      {
         reason_code = "qstate_snapshot_version_mismatch";
         snapshot.reason_code = reason_code;
         FileClose(handle);
         return false;
      }
      else if(key == "valid")
         snapshot.valid = LimniVisualParseBool(value);
      else if(key == "symbol")
         snapshot.symbol = value;
      else if(key == "canonical")
         snapshot.canonical = value;
      else if(key == "formula_id")
         snapshot.formula_id = value;
      else if(key == "formula_hash")
         snapshot.formula_hash = (ulong)StringToInteger(value);
      else if(key == "portfolio_asof_m1_time")
         snapshot.portfolio_asof_m1_time = LimniVisualParseTime(value);
      else if(key == "portfolio_valid_pair_count")
         snapshot.portfolio_valid_pair_count = (int)StringToInteger(value);
      else if(key == "portfolio_snapshot_hash")
         snapshot.portfolio_snapshot_hash = (ulong)StringToInteger(value);
      else if(key == "source_m1_time")
         snapshot.source_m1_time = LimniVisualParseTime(value);
      else if(key == "state")
         snapshot.state = (int)StringToInteger(value);
      else if(key == "trade_direction")
         snapshot.trade_direction = (int)StringToInteger(value);
      else if(key == "market_mode")
         snapshot.market_mode = (int)StringToInteger(value);
      else if(key == "pair_q_score")
         snapshot.pair_q_score = StringToDouble(value);
      else if(key == "base_currency_score")
         snapshot.base_currency_score = StringToDouble(value);
      else if(key == "quote_currency_score")
         snapshot.quote_currency_score = StringToDouble(value);
      else if(key == "pair_direction_score")
         snapshot.pair_direction_score = StringToDouble(value);
      else if(key == "confidence")
         snapshot.confidence = StringToDouble(value);
      else if(key == "reason_code")
         snapshot.reason_code = value;
      else if(key == "detail")
         snapshot.detail = value;
      else if(key == "snapshot_hash")
         snapshot.snapshot_hash = (ulong)StringToInteger(value);
      LimniVisualDrainCsvLine(handle);
   }

   FileClose(handle);
   if(snapshot.symbol == "")
      snapshot.symbol = symbol;
   if(snapshot.snapshot_hash == 0)
      snapshot.snapshot_hash = LimniVisualQStateSnapshotHash(snapshot);
   reason_code = snapshot.valid ? "qstate_snapshot_read" : snapshot.reason_code;
   return snapshot.valid;
}

#endif // LIMNI_VISUAL_RUNTIME_SNAPSHOT_MQH
