//+------------------------------------------------------------------+
//|                                             LimniLoadM1History.mq5 |
//|                 Requests real broker M1 history for current symbol |
//+------------------------------------------------------------------+
#property strict
#property version "1.01"

input string StartDate = "2014.01.01 00:00";
input string EndDate = "";
input int ChunkDays = 30;
input int MaxRetriesPerChunk = 5;
input int RetrySleepMs = 1000;
input int PauseBetweenChunksMs = 250;
input int StopAfterConsecutiveFailedChunks = 3;
input bool ClampStartToServerFirstDate = true;
input bool LoadNewestToOldest = true;
input bool OpenM1Chart = true;
input bool PrintChunkProgress = true;

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

int TerminalMaxHistoryBars()
{
   long max_bars = TerminalInfoInteger(TERMINAL_MAXBARS);
   if(max_bars <= 0)
      return 0;
   if(max_bars > INT_MAX)
      return INT_MAX;
   return (int)max_bars;
}

string ErrorLabel(const int error_code)
{
   switch(error_code)
   {
      case 0:
         return "0/success";
      case ERR_PROGRAM_STOPPED:
         return "4022/program stopped";
      case ERR_HISTORY_NOT_FOUND:
         return "4401/history not found";
      case ERR_HISTORY_TIMEOUT:
         return "4403/history timeout";
      case ERR_HISTORY_BARS_LIMIT:
         return "4404/terminal bars limit";
      case ERR_HISTORY_LOAD_ERRORS:
         return "4405/history load errors";
      default:
         return IntegerToString(error_code);
   }
}

bool SeriesTime(
   const string symbol,
   const ENUM_TIMEFRAMES period,
   const ENUM_SERIES_INFO_INTEGER prop,
   datetime &value
)
{
   long raw = 0;
   ResetLastError();
   if(!SeriesInfoInteger(symbol, period, prop, raw) || raw <= 0)
      return false;

   value = (datetime)raw;
   return true;
}

void PrintSeriesState(const string label, const string symbol)
{
   long first_date = 0;
   long terminal_first_date = 0;
   long server_first_date = 0;
   long synchronized = 0;
   long bars_count = 0;

   bool has_first = SeriesInfoInteger(symbol, PERIOD_M1, SERIES_FIRSTDATE, first_date);
   bool has_terminal_first = SeriesInfoInteger(symbol, PERIOD_M1, SERIES_TERMINAL_FIRSTDATE, terminal_first_date);
   bool has_server_first = SeriesInfoInteger(symbol, PERIOD_M1, SERIES_SERVER_FIRSTDATE, server_first_date);
   bool has_sync = SeriesInfoInteger(symbol, PERIOD_M1, SERIES_SYNCHRONIZED, synchronized);
   bool has_bars_count = SeriesInfoInteger(symbol, PERIOD_M1, SERIES_BARS_COUNT, bars_count);

   Print(
      label,
      " symbol=", symbol,
      " M1 Bars=", Bars(symbol, PERIOD_M1),
      " series_bars=", has_bars_count ? IntegerToString((int)bars_count) : "unknown",
      " first_date=", has_first ? TimeToString((datetime)first_date, TIME_DATE | TIME_MINUTES) : "unknown",
      " terminal_first_date=", has_terminal_first ? TimeToString((datetime)terminal_first_date, TIME_DATE | TIME_MINUTES) : "unknown",
      " server_first_date=", has_server_first ? TimeToString((datetime)server_first_date, TIME_DATE | TIME_MINUTES) : "unknown",
      " terminal_max_bars=", IntegerToString(TerminalMaxHistoryBars()),
      " synchronized=", has_sync ? IntegerToString((int)synchronized) : "unknown"
   );
}

bool WarmupM1Series(const string symbol)
{
   MqlRates rates[];
   ArraySetAsSeries(rates, false);

   int attempts = MathMax(1, MaxRetriesPerChunk);
   for(int attempt = 1; attempt <= attempts; attempt++)
   {
      if(IsStopped())
         return false;

      ResetLastError();
      int copied = CopyRates(symbol, PERIOD_M1, 0, 1, rates);
      int error_code = GetLastError();

      long synchronized = 0;
      bool has_sync = SeriesInfoInteger(symbol, PERIOD_M1, SERIES_SYNCHRONIZED, synchronized);
      if(copied > 0 || (has_sync && synchronized != 0))
         return true;

      if(PrintChunkProgress)
      {
         Print(
            "M1 warmup waiting attempt=", attempt,
            " error=", ErrorLabel(error_code)
         );
      }

      Sleep(MathMax(100, RetrySleepMs));
   }

   return false;
}

int RequestChunk(const string symbol, const datetime from_time, const datetime to_time)
{
   MqlRates rates[];
   ArraySetAsSeries(rates, false);

   int copied = -1;
   int attempts = MathMax(1, MaxRetriesPerChunk);
   for(int attempt = 1; attempt <= attempts; attempt++)
   {
      if(IsStopped())
         return -2;

      ResetLastError();
      copied = CopyRates(symbol, PERIOD_M1, from_time, to_time, rates);
      int error_code = GetLastError();

      if(copied >= 0)
      {
         if(PrintChunkProgress)
         {
            Print(
               "M1 chunk ",
               TimeToString(from_time, TIME_DATE | TIME_MINUTES),
               " -> ",
               TimeToString(to_time, TIME_DATE | TIME_MINUTES),
               " copied=", copied,
               " attempt=", attempt
            );
         }
         return copied;
      }

      if(IsStopped() || error_code == ERR_PROGRAM_STOPPED)
         return -2;

      if(attempt >= attempts)
      {
         Print(
            "M1 chunk failed ",
            TimeToString(from_time, TIME_DATE | TIME_MINUTES),
            " -> ",
            TimeToString(to_time, TIME_DATE | TIME_MINUTES),
            " attempts=", attempts,
            " error=", ErrorLabel(error_code)
         );
      }

      Sleep(MathMax(100, RetrySleepMs));
   }

   return copied;
}

void CountChunkResult(
   const int copied,
   int &total_copied,
   int &empty_chunks,
   int &failed_chunks,
   int &stopped_chunks,
   int &consecutive_failed_chunks
)
{
   if(copied > 0)
   {
      total_copied += copied;
      consecutive_failed_chunks = 0;
   }
   else if(copied == 0)
   {
      empty_chunks++;
      consecutive_failed_chunks = 0;
   }
   else if(copied == -2)
   {
      stopped_chunks++;
   }
   else
   {
      failed_chunks++;
      consecutive_failed_chunks++;
   }
}

void OnStart()
{
   string symbol = _Symbol;
   SymbolSelect(symbol, true);

   if(OpenM1Chart)
      ChartOpen(symbol, PERIOD_M1);

   datetime from_time = ParseInputDate(StartDate, D'2014.01.01 00:00');
   datetime to_time = ParseInputDate(EndDate, TimeCurrent());

   if(to_time <= from_time)
   {
      Print("LimniLoadM1History: invalid date range");
      return;
   }

   WarmupM1Series(symbol);
   PrintSeriesState("Before load", symbol);

   if(ClampStartToServerFirstDate)
   {
      datetime server_first = 0;
      if(SeriesTime(symbol, PERIOD_M1, SERIES_SERVER_FIRSTDATE, server_first) && server_first > from_time)
      {
         Print(
            "LimniLoadM1History: clamping start to broker/server M1 first date ",
            TimeToString(server_first, TIME_DATE | TIME_MINUTES),
            " from requested ",
            TimeToString(from_time, TIME_DATE | TIME_MINUTES)
         );
         from_time = server_first;
      }
   }

   if(to_time <= from_time)
   {
      Print("LimniLoadM1History: no M1 range to request after server-date clamp");
      return;
   }

   int chunk_days = MathMax(1, ChunkDays);
   long chunk_seconds = (long)chunk_days * 86400;
   int total_copied = 0;
   int chunks = 0;
   int empty_chunks = 0;
   int failed_chunks = 0;
   int stopped_chunks = 0;
   int consecutive_failed_chunks = 0;
   int stop_after_failed = MathMax(1, StopAfterConsecutiveFailedChunks);

   if(LoadNewestToOldest)
   {
      for(datetime chunk_end = to_time; chunk_end >= from_time && !IsStopped();)
      {
         long proposed_start = (long)chunk_end - chunk_seconds + 60;
         if(proposed_start < (long)from_time)
            proposed_start = (long)from_time;

         datetime chunk_start = (datetime)proposed_start;
         int copied = RequestChunk(symbol, chunk_start, chunk_end);
         chunks++;

         CountChunkResult(copied, total_copied, empty_chunks, failed_chunks, stopped_chunks, consecutive_failed_chunks);
         if(copied == -2)
            break;

         if(consecutive_failed_chunks >= stop_after_failed)
         {
            Print(
               "LimniLoadM1History: stopping after consecutive failed M1 chunks=",
               consecutive_failed_chunks,
               ". This usually means the requested range is outside broker history or terminal Max bars."
            );
            break;
         }

         if(chunk_start <= from_time)
            break;

         Sleep(MathMax(0, PauseBetweenChunksMs));
         chunk_end = (datetime)(chunk_start - 60);
      }
   }
   else
   {
      for(datetime chunk_start = from_time; chunk_start < to_time && !IsStopped();)
      {
         long proposed_end = (long)chunk_start + chunk_seconds - 60;
         if(proposed_end > (long)to_time)
            proposed_end = (long)to_time;

         datetime chunk_end = (datetime)proposed_end;
         int copied = RequestChunk(symbol, chunk_start, chunk_end);
         chunks++;

         CountChunkResult(copied, total_copied, empty_chunks, failed_chunks, stopped_chunks, consecutive_failed_chunks);
         if(copied == -2)
            break;

         if(consecutive_failed_chunks >= stop_after_failed)
         {
            Print(
               "LimniLoadM1History: stopping after consecutive failed M1 chunks=",
               consecutive_failed_chunks,
               ". This usually means the requested range is outside broker history or terminal Max bars."
            );
            break;
         }

         Sleep(MathMax(0, PauseBetweenChunksMs));
         chunk_start = (datetime)(chunk_end + 60);
      }
   }

   PrintSeriesState("After load", symbol);
   Print(
      "LimniLoadM1History complete symbol=", symbol,
      " requested=", TimeToString(from_time, TIME_DATE | TIME_MINUTES),
      " -> ", TimeToString(to_time, TIME_DATE | TIME_MINUTES),
      " chunks=", chunks,
      " copied_total=", total_copied,
      " empty_chunks=", empty_chunks,
      " failed_chunks=", failed_chunks,
      " stopped_chunks=", stopped_chunks
   );
}
