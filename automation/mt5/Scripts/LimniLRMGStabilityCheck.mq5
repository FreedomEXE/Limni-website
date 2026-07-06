//+------------------------------------------------------------------+
//|                                      LimniLRMGStabilityCheck.mq5 |
//|              Compares LRMG price-line stability across q windows |
//+------------------------------------------------------------------+
#property strict
#property version "1.02"
#property script_show_inputs

#include "..\\Indicators\\Include\\LimniRadialMovementGrid.mqh"

input ENUM_TIMEFRAMES SourceTimeframe = PERIOD_M1;
input string AnchorStartDate = "2014.01.01 00:00";
input string EndDate = "";
input int LookbackBars = 0;
input bool UseClosedSourceBarsOnly = true;
input int BaselineBootstrapBars = 720;
input string VariantBootstrapBarsCsv = "1440,4320,10080,43200";
input string PhaseShiftQCsv = "-0.50,-0.25,0.25,0.50";
input string AnchorShiftBarsCsv = "720,1440,4320";
input int MedianBrickWindow = 55;
input int MaxBricksPerBar = 200;
input bool ExportToCommonFiles = true;
input string OutputFolder = "LimniLRMGStability";
input bool WriteDetailCsv = true;
input int DetailEveryNBars = 240;
input bool PrintProgress = true;

bool IsBlank(const string value)
{
   return StringLen(value) == 0;
}

datetime ParseInputDate(const string value, const datetime fallback)
{
   if(IsBlank(value))
      return fallback;

   datetime parsed = StringToTime(value);
   if(parsed <= 0)
      return fallback;

   return parsed;
}

bool SeriesFirstDate(const ENUM_TIMEFRAMES period, datetime &first_date)
{
   long raw = 0;
   if(!SeriesInfoInteger(_Symbol, period, SERIES_FIRSTDATE, raw) || raw <= 0)
      return false;

   first_date = (datetime)raw;
   return true;
}

void ApplyLookbackCap(MqlRates &rates[], int &count)
{
   if(LookbackBars <= 0 || count <= LookbackBars)
      return;

   int capped = MathMax(50, LookbackBars);
   if(count <= capped)
      return;

   MqlRates trimmed[];
   ArrayResize(trimmed, capped);
   int start = count - capped;
   for(int i = 0; i < capped; i++)
      trimmed[i] = rates[start + i];

   ArrayResize(rates, capped);
   for(int i = 0; i < capped; i++)
      rates[i] = trimmed[i];

   count = capped;
}

double MedianBrickLevel(const double &levels[], const int count, const int window)
{
   if(count <= 0)
      return 0.0;

   int start_index = 0;
   if(window > 0)
      start_index = MathMax(0, count - window);

   int sample_count = count - start_index;
   if(sample_count <= 0)
      return 0.0;

   double values[];
   ArrayResize(values, sample_count);
   for(int i = 0; i < sample_count; i++)
      values[i] = levels[start_index + i];

   ArraySort(values);
   int mid = sample_count / 2;
   if((sample_count % 2) == 1)
      return values[mid];

   return (values[mid - 1] + values[mid]) / 2.0;
}

void AppendClosedLevel(double &levels[], int &count, int &capacity, const double level)
{
   if(count >= capacity)
   {
      capacity = capacity <= 0 ? 256 : capacity * 2;
      ArrayResize(levels, capacity);
   }

   levels[count] = level;
   count++;
}

bool BuildPriceLineWithOverrides(
   const MqlRates &source_rates[],
   const int source_count,
   const int bootstrap_bars,
   const bool use_q_override,
   const double q_override,
   const bool use_base_override,
   const double base_price_override,
   double &line_values[],
   double &brick_size,
   double &base_price,
   int &closed_level_count
)
{
   ArrayResize(line_values, 0);
   brick_size = 0.0;
   base_price = 0.0;
   closed_level_count = 0;

   int safe_bootstrap = MathMax(10, bootstrap_bars);
   if(source_count < 50)
      return false;

   if(use_q_override)
   {
      brick_size = q_override;
   }
   else
   {
      if(source_count < MathMax(50, safe_bootstrap + 5))
         return false;

      int bootstrap_end = MathMin(source_count - 1, safe_bootstrap - 1);
      int bootstrap_count = bootstrap_end + 1;

      datetime calc_time[];
      double calc_close[];
      ArrayResize(calc_time, bootstrap_count);
      ArrayResize(calc_close, bootstrap_count);

      for(int i = 0; i < bootstrap_count; i++)
      {
         calc_time[i] = source_rates[i].time;
         calc_close[i] = source_rates[i].close;
      }

      LimniRadialMap bootstrap;
      if(!LimniComputeMovementMap(calc_time, calc_close, 0, bootstrap_end, true, bootstrap))
         return false;

      brick_size = bootstrap.radius;
   }

   if(brick_size <= 0.0 || !MathIsValidNumber(brick_size))
      return false;

   base_price = use_base_override ? base_price_override : source_rates[0].close;
   int current_level = 0;
   double closed_levels[];
   int closed_capacity = 0;
   int last_median_count = -1;
   double median_level = 0.0;
   int max_bricks = MathMax(1, MaxBricksPerBar);

   ArrayResize(line_values, source_count);

   for(int i = 0; i < source_count; i++)
   {
      int guard = 0;
      while(source_rates[i].close >= base_price + ((double)current_level + 1.0) * brick_size && guard < max_bricks)
      {
         current_level++;
         AppendClosedLevel(closed_levels, closed_level_count, closed_capacity, (double)current_level);
         guard++;
      }

      guard = 0;
      while(source_rates[i].close <= base_price + ((double)current_level - 1.0) * brick_size && guard < max_bricks)
      {
         current_level--;
         AppendClosedLevel(closed_levels, closed_level_count, closed_capacity, (double)current_level);
         guard++;
      }

      if(closed_level_count != last_median_count)
      {
         median_level = MedianBrickLevel(closed_levels, closed_level_count, MedianBrickWindow);
         last_median_count = closed_level_count;
      }

      line_values[i] = base_price + median_level * brick_size;
   }

   return true;
}

bool BuildPriceLineWithBase(
   const MqlRates &source_rates[],
   const int source_count,
   const int bootstrap_bars,
   const bool use_base_override,
   const double base_price_override,
   double &line_values[],
   double &brick_size,
   double &base_price,
   int &closed_level_count
)
{
   return BuildPriceLineWithOverrides(
      source_rates,
      source_count,
      bootstrap_bars,
      false,
      0.0,
      use_base_override,
      base_price_override,
      line_values,
      brick_size,
      base_price,
      closed_level_count
   );
}

bool BuildPriceLine(
   const MqlRates &source_rates[],
   const int source_count,
   const int bootstrap_bars,
   double &line_values[],
   double &brick_size,
   double &base_price,
   int &closed_level_count
)
{
   return BuildPriceLineWithBase(
      source_rates,
      source_count,
      bootstrap_bars,
      false,
      0.0,
      line_values,
      brick_size,
      base_price,
      closed_level_count
   );
}

int PriceSide(const double price, const double line)
{
   double epsilon = _Point * 0.1;
   if(price > line + epsilon)
      return 1;
   if(price < line - epsilon)
      return -1;
   return 0;
}

double PipSize()
{
   if(_Digits == 3 || _Digits == 5)
      return _Point * 10.0;

   return _Point;
}

double PercentileSorted(const double &sorted_values[], const int count, const double fraction)
{
   if(count <= 0)
      return 0.0;

   double bounded = MathMax(0.0, MathMin(1.0, fraction));
   double pos = bounded * (double)(count - 1);
   int lo = (int)MathFloor(pos);
   int hi = (int)MathCeil(pos);

   if(lo == hi)
      return sorted_values[lo];

   double weight = pos - (double)lo;
   return sorted_values[lo] + (sorted_values[hi] - sorted_values[lo]) * weight;
}

string CleanFilePart(const string value)
{
   string output = "";
   int len = StringLen(value);
   for(int i = 0; i < len; i++)
   {
      string ch = StringSubstr(value, i, 1);
      int code = StringGetCharacter(ch, 0);
      bool ok = (code >= 48 && code <= 57) ||
         (code >= 65 && code <= 90) ||
         (code >= 97 && code <= 122) ||
         ch == "_" ||
         ch == "." ||
         ch == "-";
      if(ok)
         output += ch;
   }

   if(output == "")
      output = "value";

   return output;
}

string TimeFileStamp(const datetime value)
{
   string stamp = TimeToString(value, TIME_DATE | TIME_MINUTES);
   StringReplace(stamp, ".", "");
   StringReplace(stamp, ":", "");
   StringReplace(stamp, " ", "_");
   return stamp;
}

string Dbl(const double value, const int digits)
{
   return DoubleToString(value, digits);
}

string BoolStr(const bool value)
{
   return value ? "true" : "false";
}

bool AddUniqueWindow(int &windows[], const int value)
{
   if(value < 10)
      return false;

   for(int i = 0; i < ArraySize(windows); i++)
   {
      if(windows[i] == value)
         return false;
   }

   int size = ArraySize(windows);
   ArrayResize(windows, size + 1);
   windows[size] = value;
   return true;
}

void ParseVariantWindows(int &windows[])
{
   ArrayResize(windows, 0);
   AddUniqueWindow(windows, BaselineBootstrapBars);

   string parts[];
   int part_count = StringSplit(VariantBootstrapBarsCsv, (ushort)',', parts);
   for(int i = 0; i < part_count; i++)
   {
      string token = parts[i];
      StringTrimLeft(token);
      StringTrimRight(token);

      int value = (int)StringToInteger(token);
      AddUniqueWindow(windows, value);
   }
}

bool AddUniquePositiveInt(int &values[], const int value)
{
   if(value <= 0)
      return false;

   for(int i = 0; i < ArraySize(values); i++)
   {
      if(values[i] == value)
         return false;
   }

   int size = ArraySize(values);
   ArrayResize(values, size + 1);
   values[size] = value;
   return true;
}

void ParseAnchorShiftBars(int &values[])
{
   ArrayResize(values, 0);

   string parts[];
   int part_count = StringSplit(AnchorShiftBarsCsv, (ushort)',', parts);
   for(int i = 0; i < part_count; i++)
   {
      string token = parts[i];
      StringTrimLeft(token);
      StringTrimRight(token);

      int value = (int)StringToInteger(token);
      AddUniquePositiveInt(values, value);
   }
}

bool AddUniqueDouble(double &values[], const double value)
{
   if(!MathIsValidNumber(value) || MathAbs(value) <= 0.000001)
      return false;

   for(int i = 0; i < ArraySize(values); i++)
   {
      if(MathAbs(values[i] - value) <= 0.000001)
         return false;
   }

   int size = ArraySize(values);
   ArrayResize(values, size + 1);
   values[size] = value;
   return true;
}

void ParsePhaseShifts(double &values[])
{
   ArrayResize(values, 0);

   string parts[];
   int part_count = StringSplit(PhaseShiftQCsv, (ushort)',', parts);
   for(int i = 0; i < part_count; i++)
   {
      string token = parts[i];
      StringTrimLeft(token);
      StringTrimRight(token);

      double value = StringToDouble(token);
      AddUniqueDouble(values, value);
   }
}

bool CopyShiftedRates(
   const MqlRates &source_rates[],
   const int source_count,
   const int start_index,
   MqlRates &shifted_rates[],
   int &shifted_count
)
{
   ArrayResize(shifted_rates, 0);
   shifted_count = 0;

   if(start_index <= 0 || start_index >= source_count)
      return false;

   shifted_count = source_count - start_index;
   ArrayResize(shifted_rates, shifted_count);
   for(int i = 0; i < shifted_count; i++)
      shifted_rates[i] = source_rates[start_index + i];

   return shifted_count >= MathMax(50, BaselineBootstrapBars + 5);
}

int DayKey(const datetime value)
{
   MqlDateTime parts;
   TimeToStruct(value, parts);
   return parts.year * 10000 + parts.mon * 100 + parts.day;
}

void AppendDouble(double &values[], int &count, int &capacity, const double value)
{
   if(count >= capacity)
   {
      capacity = capacity <= 0 ? 32 : capacity * 2;
      ArrayResize(values, capacity);
   }

   values[count] = value;
   count++;
}

double MedianValue(double &values[], const int count)
{
   if(count <= 0)
      return 0.0;

   ArrayResize(values, count);
   ArraySort(values);

   int mid = count / 2;
   if((count % 2) == 1)
      return values[mid];

   return (values[mid - 1] + values[mid]) / 2.0;
}

void BootstrapDiagnostics(
   const MqlRates &source_rates[],
   const int source_count,
   const int bootstrap_bars,
   double &path_movement,
   double &median_daily_movement
)
{
   path_movement = 0.0;
   median_daily_movement = 0.0;

   int safe_bootstrap = MathMax(10, bootstrap_bars);
   int end_index = MathMin(source_count - 1, safe_bootstrap - 1);
   if(end_index <= 0)
      return;

   double daily_values[];
   int daily_count = 0;
   int daily_capacity = 0;
   int active_day = DayKey(source_rates[1].time);
   double active_day_movement = 0.0;

   for(int i = 1; i <= end_index; i++)
   {
      double movement = MathAbs(source_rates[i].close - source_rates[i - 1].close);
      path_movement += movement;

      int day = DayKey(source_rates[i].time);
      if(day != active_day)
      {
         if(active_day_movement > 0.0)
            AppendDouble(daily_values, daily_count, daily_capacity, active_day_movement);

         active_day = day;
         active_day_movement = 0.0;
      }

      active_day_movement += movement;
   }

   if(active_day_movement > 0.0)
      AppendDouble(daily_values, daily_count, daily_capacity, active_day_movement);

   median_daily_movement = MedianValue(daily_values, daily_count);
}

bool OpenOutputFiles(
   const ENUM_TIMEFRAMES source_period,
   string &summary_file,
   string &detail_file,
   int &summary_handle,
   int &detail_handle
)
{
   int file_scope = ExportToCommonFiles ? FILE_COMMON : 0;
   FolderCreate(OutputFolder, file_scope);

   string base_name = OutputFolder + "\\" +
      CleanFilePart(_Symbol) + "_" +
      CleanFilePart(EnumToString(source_period)) + "_lrmg_stability_" +
      TimeFileStamp(TimeCurrent());

   summary_file = base_name + "_summary.csv";
   detail_file = base_name + "_detail.csv";

   summary_handle = FileOpen(summary_file, FILE_WRITE | FILE_CSV | FILE_ANSI | file_scope, ',');
   if(summary_handle == INVALID_HANDLE)
   {
      Print("LRMG stability summary FileOpen failed: ", summary_file, " error=", GetLastError());
      return false;
   }

   FileWrite(
      summary_handle,
      "symbol",
      "broker_company",
      "source_timeframe",
      "comparison_type",
      "anchor_shift_bars",
      "phase_shift_q",
      "history_shortfall",
      "institutional_audit",
      "diagnostic_audit",
      "anchor_requested",
      "reference_anchor_resolved",
      "candidate_anchor_resolved",
      "end_resolved",
      "comparison_bars",
      "source_bars",
      "terminal_max_bars",
      "baseline_bootstrap_bars",
      "variant_bootstrap_bars",
      "median_brick_window",
      "baseline_q",
      "variant_q",
      "q_change_pct",
      "baseline_q_per_source_bar",
      "variant_q_per_source_bar",
      "baseline_q_pct_price",
      "variant_q_pct_price",
      "baseline_q_pct_bootstrap_movement",
      "variant_q_pct_bootstrap_movement",
      "baseline_q_pct_median_daily_movement",
      "variant_q_pct_median_daily_movement",
      "baseline_base_price",
      "variant_base_price",
      "base_delta_in_q",
      "baseline_closed_bricks",
      "variant_closed_bricks",
      "mean_abs_pips",
      "max_abs_pips",
      "p50_abs_pips",
      "p95_abs_pips",
      "p99_abs_pips",
      "mean_abs_q",
      "max_abs_q",
      "p50_abs_q",
      "p95_abs_q",
      "p99_abs_q",
      "side_disagreement_pct"
   );

   detail_handle = INVALID_HANDLE;
   if(WriteDetailCsv)
   {
      detail_handle = FileOpen(detail_file, FILE_WRITE | FILE_CSV | FILE_ANSI | file_scope, ',');
      if(detail_handle == INVALID_HANDLE)
      {
         Print("LRMG stability detail FileOpen failed: ", detail_file, " error=", GetLastError());
         FileClose(summary_handle);
         summary_handle = INVALID_HANDLE;
         return false;
      }

      FileWrite(
         detail_handle,
         "symbol",
         "broker_company",
         "source_timeframe",
         "comparison_type",
         "anchor_shift_bars",
         "phase_shift_q",
         "history_shortfall",
         "source_time",
         "source_close",
         "baseline_bootstrap_bars",
         "variant_bootstrap_bars",
         "baseline_line",
         "variant_line",
         "diff_pips",
         "abs_line_distance_q",
         "baseline_side",
         "variant_side"
      );
   }

   return true;
}

void WriteComparison(
   const int summary_handle,
   const int detail_handle,
   const MqlRates &source_rates[],
   const int reference_start_index,
   const int comparison_count,
   const ENUM_TIMEFRAMES source_period,
   const string comparison_type,
   const int anchor_shift_bars,
   const double phase_shift_q,
   const bool history_shortfall,
   const bool institutional_audit,
   const bool diagnostic_audit,
   const datetime anchor_requested,
   const datetime candidate_anchor_resolved,
   const double &baseline_line[],
   const int baseline_bootstrap,
   const double baseline_q,
   const double baseline_bootstrap_movement,
   const double baseline_median_daily_movement,
   const double baseline_base,
   const int baseline_bricks,
   const double &variant_line[],
   const int variant_bootstrap,
   const double variant_q,
   const double variant_bootstrap_movement,
   const double variant_median_daily_movement,
   const double variant_base,
   const int variant_bricks
)
{
   double pip = PipSize();
   double abs_diffs[];
   double abs_diffs_q[];
   ArrayResize(abs_diffs, comparison_count);
   ArrayResize(abs_diffs_q, comparison_count);

   double sum_abs = 0.0;
   double sum_abs_q = 0.0;
   double max_abs = 0.0;
   double max_abs_q = 0.0;
   int side_disagreements = 0;
   int sample_count = 0;
   int detail_stride = MathMax(1, DetailEveryNBars);

   for(int i = 0; i < comparison_count; i++)
   {
      int ref_index = reference_start_index + i;
      double diff_price = variant_line[i] - baseline_line[ref_index];
      double diff_pips = diff_price / pip;
      double abs_pips = MathAbs(diff_pips);
      double abs_q = baseline_q > 0.0 ? MathAbs(diff_price) / baseline_q : 0.0;

      abs_diffs[sample_count] = abs_pips;
      abs_diffs_q[sample_count] = abs_q;
      sample_count++;

      sum_abs += abs_pips;
      sum_abs_q += abs_q;
      if(abs_pips > max_abs)
         max_abs = abs_pips;
      if(abs_q > max_abs_q)
         max_abs_q = abs_q;

      int baseline_side = PriceSide(source_rates[ref_index].close, baseline_line[ref_index]);
      int variant_side = PriceSide(source_rates[ref_index].close, variant_line[i]);
      if(baseline_side != variant_side)
         side_disagreements++;

      if(detail_handle != INVALID_HANDLE && (i % detail_stride) == 0)
      {
         FileWrite(
            detail_handle,
            _Symbol,
            AccountInfoString(ACCOUNT_COMPANY),
            EnumToString(source_period),
            comparison_type,
            anchor_shift_bars,
            Dbl(phase_shift_q, 4),
            BoolStr(history_shortfall),
            TimeToString(source_rates[ref_index].time, TIME_DATE | TIME_MINUTES),
            Dbl(source_rates[ref_index].close, _Digits),
            baseline_bootstrap,
            variant_bootstrap,
            Dbl(baseline_line[ref_index], _Digits),
            Dbl(variant_line[i], _Digits),
            Dbl(diff_pips, 3),
            Dbl(abs_q, 6),
            baseline_side,
            variant_side
         );
      }
   }

   ArrayResize(abs_diffs, sample_count);
   ArrayResize(abs_diffs_q, sample_count);
   ArraySort(abs_diffs);
   ArraySort(abs_diffs_q);

   double mean_abs = sample_count > 0 ? sum_abs / (double)sample_count : 0.0;
   double mean_abs_q = sample_count > 0 ? sum_abs_q / (double)sample_count : 0.0;
   double p50 = PercentileSorted(abs_diffs, sample_count, 0.50);
   double p95 = PercentileSorted(abs_diffs, sample_count, 0.95);
   double p99 = PercentileSorted(abs_diffs, sample_count, 0.99);
   double p50_q = PercentileSorted(abs_diffs_q, sample_count, 0.50);
   double p95_q = PercentileSorted(abs_diffs_q, sample_count, 0.95);
   double p99_q = PercentileSorted(abs_diffs_q, sample_count, 0.99);
   double side_pct = sample_count > 0 ? 100.0 * (double)side_disagreements / (double)sample_count : 0.0;
   double q_change_pct = baseline_q != 0.0 ? 100.0 * (variant_q - baseline_q) / baseline_q : 0.0;
   double base_delta_q = baseline_q != 0.0 ? (variant_base - baseline_base) / baseline_q : 0.0;
   double baseline_q_per_bar = baseline_bootstrap > 0 ? baseline_q / (double)baseline_bootstrap : 0.0;
   double variant_q_per_bar = variant_bootstrap > 0 ? variant_q / (double)variant_bootstrap : 0.0;
   double baseline_q_pct_price = baseline_base != 0.0 ? 100.0 * baseline_q / baseline_base : 0.0;
   double variant_q_pct_price = variant_base != 0.0 ? 100.0 * variant_q / variant_base : 0.0;
   double baseline_q_pct_movement = baseline_bootstrap_movement > 0.0 ? 100.0 * baseline_q / baseline_bootstrap_movement : 0.0;
   double variant_q_pct_movement = variant_bootstrap_movement > 0.0 ? 100.0 * variant_q / variant_bootstrap_movement : 0.0;
   double baseline_q_pct_daily = baseline_median_daily_movement > 0.0 ? 100.0 * baseline_q / baseline_median_daily_movement : 0.0;
   double variant_q_pct_daily = variant_median_daily_movement > 0.0 ? 100.0 * variant_q / variant_median_daily_movement : 0.0;

   FileWrite(
      summary_handle,
      _Symbol,
      AccountInfoString(ACCOUNT_COMPANY),
      EnumToString(source_period),
      comparison_type,
      anchor_shift_bars,
      Dbl(phase_shift_q, 4),
      BoolStr(history_shortfall),
      BoolStr(institutional_audit),
      BoolStr(diagnostic_audit),
      TimeToString(anchor_requested, TIME_DATE | TIME_MINUTES),
      TimeToString(source_rates[0].time, TIME_DATE | TIME_MINUTES),
      TimeToString(candidate_anchor_resolved, TIME_DATE | TIME_MINUTES),
      TimeToString(source_rates[reference_start_index + comparison_count - 1].time, TIME_DATE | TIME_MINUTES),
      comparison_count,
      ArraySize(source_rates),
      (int)TerminalInfoInteger(TERMINAL_MAXBARS),
      baseline_bootstrap,
      variant_bootstrap,
      MedianBrickWindow,
      Dbl(baseline_q, _Digits + 2),
      Dbl(variant_q, _Digits + 2),
      Dbl(q_change_pct, 4),
      Dbl(baseline_q_per_bar, _Digits + 8),
      Dbl(variant_q_per_bar, _Digits + 8),
      Dbl(baseline_q_pct_price, 6),
      Dbl(variant_q_pct_price, 6),
      Dbl(baseline_q_pct_movement, 6),
      Dbl(variant_q_pct_movement, 6),
      Dbl(baseline_q_pct_daily, 6),
      Dbl(variant_q_pct_daily, 6),
      Dbl(baseline_base, _Digits),
      Dbl(variant_base, _Digits),
      Dbl(base_delta_q, 6),
      baseline_bricks,
      variant_bricks,
      Dbl(mean_abs, 3),
      Dbl(max_abs, 3),
      Dbl(p50, 3),
      Dbl(p95, 3),
      Dbl(p99, 3),
      Dbl(mean_abs_q, 6),
      Dbl(max_abs_q, 6),
      Dbl(p50_q, 6),
      Dbl(p95_q, 6),
      Dbl(p99_q, 6),
      Dbl(side_pct, 4)
   );
}

void OnStart()
{
   ENUM_TIMEFRAMES source_period = SourceTimeframe;
   if(source_period == PERIOD_CURRENT)
      source_period = PERIOD_M1;

   datetime first_available = 0;
   SeriesFirstDate(source_period, first_available);
   datetime fallback_from = first_available > 0 ? first_available : (datetime)(TimeCurrent() - 86400 * 365);
   datetime source_from = ParseInputDate(AnchorStartDate, fallback_from);
   datetime source_to = ParseInputDate(EndDate, TimeCurrent());
   datetime requested_anchor = source_from;

   if(first_available > 0 && first_available > source_from)
      source_from = first_available;

   if(source_to <= source_from)
   {
      Print("LRMG stability stopped: source_to <= source_from");
      return;
   }

   if(PrintProgress)
   {
      Print(
         "LRMG stability copy request symbol=", _Symbol,
         " timeframe=", EnumToString(source_period),
         " from=", TimeToString(source_from, TIME_DATE | TIME_MINUTES),
         " to=", TimeToString(source_to, TIME_DATE | TIME_MINUTES)
      );
   }

   MqlRates source_rates[];
   ArraySetAsSeries(source_rates, false);
   ResetLastError();
   int copied = CopyRates(_Symbol, source_period, source_from, source_to, source_rates);
   int copy_error = GetLastError();

   if(copied < 50)
   {
      Print("LRMG stability stopped: insufficient source bars copied=", copied, " error=", copy_error);
      return;
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

   ApplyLookbackCap(source_rates, copied);

   if(UseClosedSourceBarsOnly && copied > 1)
   {
      copied--;
      ArrayResize(source_rates, copied);
   }

   int source_seconds = PeriodSeconds(source_period);
   if(source_seconds <= 0)
      source_seconds = 60;
   bool history_shortfall = source_rates[0].time > (datetime)(requested_anchor + source_seconds);
   bool institutional_audit = !history_shortfall;
   bool diagnostic_audit = history_shortfall;

   int windows[];
   ParseVariantWindows(windows);

   double phase_shifts[];
   ParsePhaseShifts(phase_shifts);

   int anchor_shifts[];
   ParseAnchorShiftBars(anchor_shifts);

   double baseline_line[];
   double baseline_q = 0.0;
   double baseline_base = 0.0;
   int baseline_bricks = 0;
   if(!BuildPriceLine(
      source_rates,
      copied,
      BaselineBootstrapBars,
      baseline_line,
      baseline_q,
      baseline_base,
      baseline_bricks
   ))
   {
      Print("LRMG stability stopped: baseline build failed for bootstrap=", BaselineBootstrapBars);
      return;
   }

   double baseline_bootstrap_movement = 0.0;
   double baseline_median_daily_movement = 0.0;
   BootstrapDiagnostics(
      source_rates,
      copied,
      BaselineBootstrapBars,
      baseline_bootstrap_movement,
      baseline_median_daily_movement
   );

   string summary_file = "";
   string detail_file = "";
   int summary_handle = INVALID_HANDLE;
   int detail_handle = INVALID_HANDLE;
   if(!OpenOutputFiles(source_period, summary_file, detail_file, summary_handle, detail_handle))
      return;

   for(int w = 0; w < ArraySize(windows); w++)
   {
      int variant_bootstrap = windows[w];
      double variant_line[];
      double variant_q = 0.0;
      double variant_base = 0.0;
      int variant_bricks = 0;

      if(variant_bootstrap == BaselineBootstrapBars)
      {
         WriteComparison(
            summary_handle,
            detail_handle,
            source_rates,
            0,
            copied,
            source_period,
            "reference",
            0,
            0.0,
            history_shortfall,
            institutional_audit,
            diagnostic_audit,
            requested_anchor,
            source_rates[0].time,
            baseline_line,
            BaselineBootstrapBars,
            baseline_q,
            baseline_bootstrap_movement,
            baseline_median_daily_movement,
            baseline_base,
            baseline_bricks,
            baseline_line,
            variant_bootstrap,
            baseline_q,
            baseline_bootstrap_movement,
            baseline_median_daily_movement,
            baseline_base,
            baseline_bricks
         );
         continue;
      }

      if(PrintProgress)
         Print("LRMG stability building variant bootstrap=", variant_bootstrap);

      if(!BuildPriceLineWithBase(
         source_rates,
         copied,
         variant_bootstrap,
         true,
         baseline_base,
         variant_line,
         variant_q,
         variant_base,
         variant_bricks
      ))
      {
         Print("LRMG stability skipped variant build failure bootstrap=", variant_bootstrap);
         continue;
      }

      double variant_bootstrap_movement = 0.0;
      double variant_median_daily_movement = 0.0;
      BootstrapDiagnostics(
         source_rates,
         copied,
         variant_bootstrap,
         variant_bootstrap_movement,
         variant_median_daily_movement
      );

      WriteComparison(
         summary_handle,
         detail_handle,
         source_rates,
         0,
         copied,
         source_period,
         "scale_q_window_base_held",
         0,
         0.0,
         history_shortfall,
         institutional_audit,
         diagnostic_audit,
         requested_anchor,
         source_rates[0].time,
         baseline_line,
         BaselineBootstrapBars,
         baseline_q,
         baseline_bootstrap_movement,
         baseline_median_daily_movement,
         baseline_base,
         baseline_bricks,
         variant_line,
         variant_bootstrap,
         variant_q,
         variant_bootstrap_movement,
         variant_median_daily_movement,
         variant_base,
         variant_bricks
      );
   }

   for(int p = 0; p < ArraySize(phase_shifts); p++)
   {
      double phase_shift = phase_shifts[p];
      double phase_base = baseline_base + phase_shift * baseline_q;
      double phase_line[];
      double phase_q = 0.0;
      double returned_base = 0.0;
      int phase_bricks = 0;

      if(PrintProgress)
         Print("LRMG stability building phase shift q=", DoubleToString(phase_shift, 4));

      if(!BuildPriceLineWithBase(
         source_rates,
         copied,
         BaselineBootstrapBars,
         true,
         phase_base,
         phase_line,
         phase_q,
         returned_base,
         phase_bricks
      ))
      {
         Print("LRMG stability skipped phase build failure shift_q=", DoubleToString(phase_shift, 4));
         continue;
      }

      WriteComparison(
         summary_handle,
         detail_handle,
         source_rates,
         0,
         copied,
         source_period,
         "phase_base_shift_q_held",
         0,
         phase_shift,
         history_shortfall,
         institutional_audit,
         diagnostic_audit,
         requested_anchor,
         source_rates[0].time,
         baseline_line,
         BaselineBootstrapBars,
         baseline_q,
         baseline_bootstrap_movement,
         baseline_median_daily_movement,
         baseline_base,
         baseline_bricks,
         phase_line,
         BaselineBootstrapBars,
         phase_q,
         baseline_bootstrap_movement,
         baseline_median_daily_movement,
         returned_base,
         phase_bricks
      );
   }

   for(int a = 0; a < ArraySize(anchor_shifts); a++)
   {
      int anchor_shift = anchor_shifts[a];
      MqlRates shifted_rates[];
      int shifted_count = 0;

      if(!CopyShiftedRates(source_rates, copied, anchor_shift, shifted_rates, shifted_count))
      {
         Print("LRMG stability skipped anchor shift bars=", anchor_shift, " insufficient overlap");
         continue;
      }

      double shifted_line[];
      double shifted_q = 0.0;
      double shifted_base = 0.0;
      int shifted_bricks = 0;

      if(PrintProgress)
         Print("LRMG stability building anchor shift bars=", anchor_shift);

      if(!BuildPriceLine(
         shifted_rates,
         shifted_count,
         BaselineBootstrapBars,
         shifted_line,
         shifted_q,
         shifted_base,
         shifted_bricks
      ))
      {
         Print("LRMG stability skipped anchor build failure bars=", anchor_shift);
         continue;
      }

      double shifted_bootstrap_movement = 0.0;
      double shifted_median_daily_movement = 0.0;
      BootstrapDiagnostics(
         shifted_rates,
         shifted_count,
         BaselineBootstrapBars,
         shifted_bootstrap_movement,
         shifted_median_daily_movement
      );

      WriteComparison(
         summary_handle,
         detail_handle,
         source_rates,
         anchor_shift,
         shifted_count,
         source_period,
         "anchor_shift_q_and_base",
         anchor_shift,
         0.0,
         history_shortfall,
         institutional_audit,
         diagnostic_audit,
         requested_anchor,
         shifted_rates[0].time,
         baseline_line,
         BaselineBootstrapBars,
         baseline_q,
         baseline_bootstrap_movement,
         baseline_median_daily_movement,
         baseline_base,
         baseline_bricks,
         shifted_line,
         BaselineBootstrapBars,
         shifted_q,
         shifted_bootstrap_movement,
         shifted_median_daily_movement,
         shifted_base,
         shifted_bricks
      );

      double shifted_fixed_q_line[];
      double shifted_fixed_q = 0.0;
      double shifted_fixed_q_base = 0.0;
      int shifted_fixed_q_bricks = 0;

      if(!BuildPriceLineWithOverrides(
         shifted_rates,
         shifted_count,
         BaselineBootstrapBars,
         true,
         baseline_q,
         false,
         0.0,
         shifted_fixed_q_line,
         shifted_fixed_q,
         shifted_fixed_q_base,
         shifted_fixed_q_bricks
      ))
      {
         Print("LRMG stability skipped anchor fixed-q build failure bars=", anchor_shift);
         continue;
      }

      WriteComparison(
         summary_handle,
         detail_handle,
         source_rates,
         anchor_shift,
         shifted_count,
         source_period,
         "anchor_shift_base_only_q_held",
         anchor_shift,
         0.0,
         history_shortfall,
         institutional_audit,
         diagnostic_audit,
         requested_anchor,
         shifted_rates[0].time,
         baseline_line,
         BaselineBootstrapBars,
         baseline_q,
         baseline_bootstrap_movement,
         baseline_median_daily_movement,
         baseline_base,
         baseline_bricks,
         shifted_fixed_q_line,
         BaselineBootstrapBars,
         shifted_fixed_q,
         shifted_bootstrap_movement,
         shifted_median_daily_movement,
         shifted_fixed_q_base,
         shifted_fixed_q_bricks
      );
   }

   FileClose(summary_handle);
   if(detail_handle != INVALID_HANDLE)
      FileClose(detail_handle);

   Print("LRMG stability complete. Summary CSV: ", ExportToCommonFiles ? "Common\\Files\\" : "MQL5\\Files\\", summary_file);
   if(WriteDetailCsv)
      Print("LRMG stability detail CSV: ", ExportToCommonFiles ? "Common\\Files\\" : "MQL5\\Files\\", detail_file);
}
