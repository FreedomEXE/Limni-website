/*-----------------------------------------------
  Broker-declared trade-session admission
-----------------------------------------------*/
#ifndef __LIMNI_PORTFOLIO_TRADE_SESSION_ADMISSION_MQH__
#define __LIMNI_PORTFOLIO_TRADE_SESSION_ADMISSION_MQH__

#include "..\\Core\\Types.mqh"

bool LP_TradeSessionContainsProbe(const long probe_seconds, const long raw_from, const long raw_to)
{
   if(raw_from < 0 || raw_to < 0 || raw_from == raw_to)
      return false;
   long normalized_to = raw_to < raw_from ? raw_to + 86400 : raw_to;
   return probe_seconds >= raw_from && probe_seconds < normalized_to;
}

bool LP_ProbeTradeSessionDay(
   const string symbol,
   const ENUM_DAY_OF_WEEK day_of_week,
   const long probe_seconds,
   const bool previous_day_probe,
   int &session_count,
   int &query_error,
   string &matched_interval
)
{
   session_count = 0;
   query_error = 0;
   matched_interval = "";
   for(uint session_index = 0; session_index < 32; session_index++)
   {
      datetime session_from = 0;
      datetime session_to = 0;
      ResetLastError();
      if(!SymbolInfoSessionTrade(symbol, day_of_week, session_index, session_from, session_to))
      {
         int error = GetLastError();
         if(error != 0 && error != ERR_MARKET_SESSION_INDEX)
            query_error = error;
         break;
      }

      session_count++;
      long raw_from = (long)session_from;
      long raw_to = (long)session_to;
      long normalized_to = raw_to < raw_from ? raw_to + 86400 : raw_to;
      if(previous_day_probe && normalized_to <= 86400)
         continue;
      if(LP_TradeSessionContainsProbe(probe_seconds, raw_from, raw_to))
      {
         matched_interval = "session_index=" + IntegerToString((int)session_index) +
            "|session_from_second=" + (string)raw_from +
            "|session_to_second=" + (string)raw_to +
            "|session_previous_day=" + LP_BoolText(previous_day_probe);
         return true;
      }
   }
   return false;
}

bool LP_IsTradeSessionOpen(
   const string symbol,
   const datetime server_now,
   string &block_reason,
   string &detail,
   bool &metadata_unavailable
)
{
   block_reason = "";
   detail = "";
   metadata_unavailable = false;
   if(StringLen(symbol) <= 0 || !SymbolInfoInteger(symbol, SYMBOL_EXIST) || server_now <= 0)
   {
      metadata_unavailable = true;
      block_reason = "trade_session_metadata_unavailable";
      detail = "symbol_or_server_time_unavailable=true|symbol=" + symbol +
         "|server_time=" + (string)server_now;
      return false;
   }

   MqlDateTime parts;
   if(!TimeToStruct(server_now, parts))
   {
      metadata_unavailable = true;
      block_reason = "trade_session_metadata_unavailable";
      detail = "server_time_parse_failed=true|server_time=" + (string)server_now;
      return false;
   }

   long second = (long)parts.hour * 3600 + (long)parts.min * 60 + (long)parts.sec;
   int current_count = 0;
   int previous_count = 0;
   int current_error = 0;
   int previous_error = 0;
   string matched_interval = "";
   bool open = LP_ProbeTradeSessionDay(
      symbol,
      (ENUM_DAY_OF_WEEK)parts.day_of_week,
      second,
      false,
      current_count,
      current_error,
      matched_interval
   );
   if(!open)
      open = LP_ProbeTradeSessionDay(
         symbol,
         (ENUM_DAY_OF_WEEK)((parts.day_of_week + 6) % 7),
         second + 86400,
         true,
         previous_count,
         previous_error,
         matched_interval
      );

   metadata_unavailable = current_error != 0 || previous_error != 0;
   detail = "symbol=" + symbol +
      "|server_time=" + LP_Stamp(server_now) +
      "|server_day=" + IntegerToString(parts.day_of_week) +
      "|server_second=" + (string)second +
      "|current_session_count=" + IntegerToString(current_count) +
      "|previous_session_count=" + IntegerToString(previous_count) +
      "|current_query_error=" + IntegerToString(current_error) +
      "|previous_query_error=" + IntegerToString(previous_error);
   if(open)
   {
      detail += "|" + matched_interval;
      return true;
   }

   block_reason = metadata_unavailable ?
      "trade_session_metadata_unavailable" : "trade_session_closed_no_interval";
   return false;
}

#endif // __LIMNI_PORTFOLIO_TRADE_SESSION_ADMISSION_MQH__
