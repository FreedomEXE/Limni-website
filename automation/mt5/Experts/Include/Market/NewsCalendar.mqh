/*-----------------------------------------------
  Manual high-impact news calendar guard
-----------------------------------------------*/
#ifndef __LIMNI_PORTFOLIO_NEWS_CALENDAR_MQH__
#define __LIMNI_PORTFOLIO_NEWS_CALENDAR_MQH__

#include "SessionCalendar.mqh"
#include "..\\Core\\SymbolUniverse.mqh"
#include "..\\Receipts\\ReceiptWriter.mqh"

string LP_TrimAscii(const string value)
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

string LP_UpperAscii(const string value)
{
   string out = "";
   for(int i = 0; i < StringLen(value); i++)
   {
      ushort ch = (ushort)StringGetCharacter(value, i);
      if(ch >= 'a' && ch <= 'z')
         ch -= 32;
      out += ShortToString(ch);
   }
   return out;
}

datetime LP_ParseNewsTime(const string raw_time)
{
   string value = LP_TrimAscii(raw_time);
   StringReplace(value, "-", ".");
   StringReplace(value, "T", " ");
   if(StringLen(value) == 16)
      value += ":00";
   return StringToTime(value);
}

int LP_ParseNewsImpact(const string raw_impact)
{
   string impact = LP_UpperAscii(LP_TrimAscii(raw_impact));
   if(impact == "RED" || impact == "HIGH" || impact == "H")
      return 3;
   if(impact == "ORANGE" || impact == "MEDIUM" || impact == "MED" || impact == "M")
      return 2;
   if(impact == "YELLOW" || impact == "LOW" || impact == "L")
      return 1;
   return (int)StringToInteger(impact);
}

class LP_NewsCalendar
{
private:
   LP_NewsEvent m_events[];
   int m_event_count;
   bool m_loaded;
   bool m_required;
   string m_status;
   ulong m_snapshot_hash;

   bool CurrencyMatches(const LP_NewsEvent &event, const LP_SymbolMeta &meta)
   {
      if(event.currency == "ALL")
         return true;
      return event.currency_id == meta.base_ccy || event.currency_id == meta.quote_ccy;
   }

public:
   void Reset()
   {
      ArrayResize(m_events, 0);
      m_event_count = 0;
      m_loaded = false;
      m_required = false;
      m_status = "not_loaded";
      m_snapshot_hash = 0;
   }

   bool Load(const LP_Config &config, LP_ReceiptWriter &receipts)
   {
      Reset();
      m_required = LP_NewsGuardRequiresSource(config);

      if(config.news_guard_mode == LP_NEWS_GUARD_DISABLED)
      {
         m_loaded = true;
         m_status = "disabled";
         WriteReceipt(receipts);
         return true;
      }

      if(StringLen(config.news_calendar_file) <= 0)
      {
         m_status = "news_file_not_configured";
         WriteReceipt(receipts);
         return !m_required;
      }

      int scope = config.export_to_common_files ? FILE_COMMON : 0;
      int handle = FileOpen(config.news_calendar_file, FILE_READ | FILE_CSV | FILE_ANSI | scope, ',');
      if(handle == INVALID_HANDLE)
      {
         m_status = "news_file_open_failed";
         WriteReceipt(receipts);
         return !m_required;
      }

      string hash_payload = config.news_calendar_file;
      while(!FileIsEnding(handle))
      {
         string raw_time = FileReadString(handle);
         if(FileIsEnding(handle) && StringLen(raw_time) <= 0)
            break;

         string raw_currency = FileReadString(handle);
         string raw_impact = FileReadString(handle);
         string raw_title = "";
         if(!FileIsLineEnding(handle) && !FileIsEnding(handle))
            raw_title = FileReadString(handle);

         string marker = LP_UpperAscii(LP_TrimAscii(raw_time));
         if(marker == "TIME" || marker == "SERVER_TIME" || marker == "DATETIME")
            continue;

         LP_NewsEvent event;
         event.server_time = LP_ParseNewsTime(raw_time);
         event.currency = LP_UpperAscii(LP_TrimAscii(raw_currency));
         event.currency_id = event.currency == "ALL" ? -1 : LP_CcyFromCode(event.currency);
         event.impact = LP_ParseNewsImpact(raw_impact);
         event.title = LP_TrimAscii(raw_title);

         if(event.server_time <= 0 || event.impact <= 0)
            continue;
         if(event.currency != "ALL" && event.currency_id < 0)
            continue;

         ArrayResize(m_events, m_event_count + 1, m_event_count + 1);
         m_events[m_event_count] = event;
         m_event_count++;
         hash_payload += "|" + LP_Stamp(event.server_time) + ":" + event.currency + ":" + IntegerToString(event.impact);
      }

      FileClose(handle);
      m_loaded = true;
      m_status = "loaded";
      m_snapshot_hash = LP_HashString(hash_payload);
      WriteReceipt(receipts);
      return true;
   }

   void Apply(
      const datetime server_time,
      const LP_SymbolMeta &meta,
      const LP_Config &config,
      LP_CalendarDecision &decision
   )
   {
      if(config.news_guard_mode == LP_NEWS_GUARD_DISABLED)
         return;

      if(!m_loaded)
      {
         if(m_required)
         {
            decision.news_blocked = true;
            decision.trade_allowed = false;
            decision.reason = m_status;
         }
         return;
      }

      long before_seconds = (long)MathMax(0, config.news_block_before_minutes) * 60;
      long after_seconds = (long)MathMax(0, config.news_block_after_minutes) * 60;

      for(int i = 0; i < m_event_count; i++)
      {
         if(m_events[i].impact < config.news_minimum_impact)
            continue;
         if(!CurrencyMatches(m_events[i], meta))
            continue;

         long delta = (long)server_time - (long)m_events[i].server_time;
         if(delta >= -before_seconds && delta <= after_seconds)
         {
            decision.news_blocked = true;
            decision.trade_allowed = false;
            decision.reason = "news_block:" + m_events[i].currency +
               ":impact=" + IntegerToString(m_events[i].impact) +
               ":time=" + LP_Stamp(m_events[i].server_time);
            return;
         }
      }
   }

   void WriteReceipt(LP_ReceiptWriter &receipts)
   {
      receipts.Write(
         LP_RECEIPT_NEWS_GUARD,
         "",
         m_status,
         "required=" + LP_BoolText(m_required) +
            "|loaded=" + LP_BoolText(m_loaded) +
            "|events=" + IntegerToString(m_event_count) +
            "|snapshot_hash=" + (string)m_snapshot_hash,
         0,
         0,
         0,
         0,
         0,
         0
      );
   }
};

#endif // __LIMNI_PORTFOLIO_NEWS_CALENDAR_MQH__
