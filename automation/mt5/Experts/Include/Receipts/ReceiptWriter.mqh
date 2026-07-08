/*-----------------------------------------------
  Central receipt writer
-----------------------------------------------*/
#ifndef __LIMNI_PORTFOLIO_RECEIPT_WRITER_MQH__
#define __LIMNI_PORTFOLIO_RECEIPT_WRITER_MQH__

#include "..\\Core\\BuildInfo.mqh"
#include "..\\Core\\Types.mqh"
#include "ReceiptTypes.mqh"

class LP_ReceiptWriter
{
private:
   int m_handle;
   int m_summary_handle;
   int m_file_scope;
   LP_ReceiptMode m_receipt_mode;
   string m_folder;
   string m_run_id;
   ulong m_event_seq;
   ulong m_config_hash;
   ulong m_symbol_universe_hash;
   bool m_receipts_dirty;
   bool m_summary_dirty;
   ulong m_compact_skipped_rows;
   int m_compact_engine_step_attempts;
   bool m_compact_stop_tp_seen;
   double m_compact_logged_worst_net_open_pct;
   double m_compact_logged_best_net_open_pct;
   int m_compact_logged_max_managed_positions;

   void ResetCompactState()
   {
      m_compact_skipped_rows = 0;
      m_compact_engine_step_attempts = 0;
      m_compact_stop_tp_seen = false;
      m_compact_logged_worst_net_open_pct = 0.0;
      m_compact_logged_best_net_open_pct = 0.0;
      m_compact_logged_max_managed_positions = 0;
   }

   bool Contains(const string haystack, const string needle)
   {
      return StringFind(haystack, needle) >= 0;
   }

   string FieldValue(const string message, const string field)
   {
      string prefix = field + "=";
      int start = StringFind(message, prefix);
      if(start < 0)
         return "";
      start += StringLen(prefix);
      int end = StringFind(message, "|", start);
      if(end < 0)
         end = StringLen(message);
      return StringSubstr(message, start, end - start);
   }

   double FieldDouble(const string message, const string field, bool &ok)
   {
      string value = FieldValue(message, field);
      ok = value != "";
      if(!ok)
         return 0.0;
      return StringToDouble(value);
   }

   int FieldInt(const string message, const string field, bool &ok)
   {
      string value = FieldValue(message, field);
      ok = value != "";
      if(!ok)
         return 0;
      return (int)StringToInteger(value);
   }

   bool IsFailureEvidence(const string status, const string message)
   {
      return Contains(status, "fail") ||
         Contains(status, "reject") ||
         Contains(status, "invalid") ||
         Contains(status, "disabled") ||
         Contains(message, "ok=false") ||
         Contains(message, "TRADE_RETCODE_NO_MONEY") ||
         Contains(message, "retcode=10019") ||
         Contains(message, "TRADE_RETCODE_MARKET_CLOSED") ||
         Contains(message, "retcode=10018") ||
         Contains(message, "no_money") ||
         Contains(message, "margin") ||
         Contains(message, "error");
   }

   bool CompactStopTakeProfitShouldWrite(const string status, const string message)
   {
      if(status != "monitoring")
         return true;

      bool pct_ok = false;
      bool pos_ok = false;
      double net_open_pct = FieldDouble(message, "net_open_pct_after_fees", pct_ok);
      int managed_positions = FieldInt(message, "managed_positions", pos_ok);

      if(!m_compact_stop_tp_seen)
      {
         m_compact_stop_tp_seen = true;
         if(pct_ok)
         {
            m_compact_logged_worst_net_open_pct = net_open_pct;
            m_compact_logged_best_net_open_pct = net_open_pct;
         }
         if(pos_ok)
            m_compact_logged_max_managed_positions = managed_positions;
         return true;
      }

      bool write = false;
      if(pct_ok && net_open_pct <= m_compact_logged_worst_net_open_pct - 0.25)
      {
         m_compact_logged_worst_net_open_pct = net_open_pct;
         write = true;
      }
      if(pct_ok && net_open_pct >= m_compact_logged_best_net_open_pct + 0.25)
      {
         m_compact_logged_best_net_open_pct = net_open_pct;
         write = true;
      }
      if(pos_ok && managed_positions >= m_compact_logged_max_managed_positions + 25)
      {
         m_compact_logged_max_managed_positions = managed_positions;
         write = true;
      }
      return write;
   }

   bool CompactEngineStepShouldWrite(const string message)
   {
      m_compact_engine_step_attempts++;
      if(m_compact_engine_step_attempts == 1)
         return true;
      if((m_compact_engine_step_attempts % 10000) == 0)
         return true;
      if(!Contains(message, "|intents=0|"))
         return true;
      if(Contains(message, "stop_take_profit_block_new_entries=true"))
         return true;
      if(!Contains(message, "revma_grid_exit_intents=0"))
         return true;
      if(!Contains(message, "revma_grid_tp_sync_intents=0"))
         return true;
      return false;
   }

   bool ShouldWriteCompact(
      const int kind,
      const string status,
      const string message
   )
   {
      if(IsFailureEvidence(status, message))
         return true;

      switch(kind)
      {
         case LP_RECEIPT_RUN_START:
         case LP_RECEIPT_RUN_END:
         case LP_RECEIPT_ERROR:
         case LP_RECEIPT_SYMBOL_INIT:
         case LP_RECEIPT_NEWS_GUARD:
         case LP_RECEIPT_HARVEST_STATE:
         case LP_RECEIPT_POSITION_ATTRIBUTION:
         case LP_RECEIPT_CURRENCY_EXPOSURE:
         case LP_RECEIPT_GRID_INVENTORY:
         case LP_RECEIPT_PORTFOLIO_Q_STATE:
         case LP_RECEIPT_REVMA_SIGNAL:
         case LP_RECEIPT_REVMA_GRID_BIRTH:
         case LP_RECEIPT_REVMA_GRID_ADD:
         case LP_RECEIPT_REVMA_GRID_EXIT:
         case LP_RECEIPT_INTENT:
         case LP_RECEIPT_ORDER_RESULT:
            return true;

         case LP_RECEIPT_STOP_TAKE_PROFIT_GUARD:
            return CompactStopTakeProfitShouldWrite(status, message);

         case LP_RECEIPT_ENGINE_STEP:
            return CompactEngineStepShouldWrite(message);

         case LP_RECEIPT_REVMA_REENTRY_GATE:
            return status == "fresh_state_change_detected" ||
               status == "revma_grid_birth_allowed" ||
               status == "startup_state_observed";

         case LP_RECEIPT_REVMA_GRID_ADD_SKIP:
            return status != "add_skip_spacing_not_reached" &&
               status != "add_skip_no_active_grid_found";

         case LP_RECEIPT_RISK_DECISION:
            return !Contains(message, "decision=1|");

         case LP_RECEIPT_ORDER_REQUEST:
            return status != "open_request" && status != "close_request";

         case LP_RECEIPT_TRADE_PLAN:
         case LP_RECEIPT_TRADE_TRANSACTION:
         case LP_RECEIPT_SIGNAL:
         case LP_RECEIPT_ACCOUNT_GOVERNOR:
         case LP_RECEIPT_Q_STATE:
         case LP_RECEIPT_PORTFOLIO_SELECTOR:
            return false;
      }
      return true;
   }

   bool ShouldWrite(
      const int kind,
      const string status,
      const string message
   )
   {
      if(m_receipt_mode == LP_RECEIPT_MODE_FULL)
         return true;
      return ShouldWriteCompact(kind, status, message);
   }

public:
   void Reset()
   {
      m_handle = INVALID_HANDLE;
      m_summary_handle = INVALID_HANDLE;
      m_file_scope = 0;
      m_receipt_mode = LP_RECEIPT_MODE_FULL;
      m_folder = "";
      m_run_id = "";
      m_event_seq = 0;
      m_config_hash = 0;
      m_symbol_universe_hash = 0;
      m_receipts_dirty = false;
      m_summary_dirty = false;
      ResetCompactState();
   }

   string RunId()
   {
      return m_run_id;
   }

   bool Open(const LP_Config &config, const ulong config_hash, const ulong symbol_universe_hash)
   {
      Reset();
      m_config_hash = config_hash;
      m_symbol_universe_hash = symbol_universe_hash;
      m_file_scope = config.export_to_common_files ? FILE_COMMON : 0;
      m_receipt_mode = config.receipt_mode;
      m_folder = config.output_folder;
      FolderCreate(m_folder, m_file_scope);
      string run_stamp = LP_SafePart(LP_Stamp(TimeLocal()) + "_R" + IntegerToString((long)GetTickCount()));
      m_run_id = "LPEA_" + run_stamp;

      string receipt_name = m_folder + "\\" + m_run_id + "_receipts.csv";
      string summary_name = m_folder + "\\" + m_run_id + "_summary.csv";
      m_handle = FileOpen(receipt_name, FILE_WRITE | FILE_CSV | FILE_ANSI | m_file_scope, ',');
      m_summary_handle = FileOpen(summary_name, FILE_WRITE | FILE_CSV | FILE_ANSI | m_file_scope, ',');

      if(m_handle != INVALID_HANDLE)
      {
         FileWrite(
            m_handle,
            "run_id",
            "ea_name",
            "ea_version",
            "build_gate",
            "config_hash",
            "symbol_universe_hash",
            "server_time",
            "local_time",
            "event_seq",
            "receipt_type",
            "symbol",
            "strategy_id",
            "variant_id",
            "grid_id",
            "intent_id",
            "decision_id",
            "magic",
            "status",
            "message"
         );
         m_receipts_dirty = true;
      }

      if(m_summary_handle != INVALID_HANDLE)
      {
         FileWrite(m_summary_handle, "metric", "value");
         m_summary_dirty = true;
      }

      return m_handle != INVALID_HANDLE && m_summary_handle != INVALID_HANDLE;
   }

   void Write(
      const int kind,
      const string symbol,
      const string status,
      const string message,
      const int strategy_id,
      const int variant_id,
      const ulong grid_id,
      const ulong intent_id,
      const ulong decision_id,
      const long magic
   )
   {
      if(m_handle == INVALID_HANDLE)
         return;
      if(!ShouldWrite(kind, status, message))
      {
         m_compact_skipped_rows++;
         return;
      }
      m_event_seq++;
      FileWrite(
         m_handle,
         m_run_id,
         LP_EA_NAME,
         LP_EA_VERSION,
         LP_BUILD_GATE,
         (string)m_config_hash,
         (string)m_symbol_universe_hash,
         LP_Stamp(TimeCurrent()),
         LP_Stamp(TimeLocal()),
         (string)m_event_seq,
         LP_ReceiptKindName(kind),
         symbol,
         strategy_id,
         variant_id,
         (string)grid_id,
         (string)intent_id,
         (string)decision_id,
         (string)magic,
         status,
         message
      );
      m_receipts_dirty = true;
   }

   void Summary(const string metric, const string value)
   {
      if(m_summary_handle == INVALID_HANDLE)
         return;
      FileWrite(m_summary_handle, metric, value);
      m_summary_dirty = true;
   }

   void Flush()
   {
      if(m_handle != INVALID_HANDLE && m_receipts_dirty)
      {
         FileFlush(m_handle);
         m_receipts_dirty = false;
      }
      if(m_summary_handle != INVALID_HANDLE && m_summary_dirty)
      {
         FileFlush(m_summary_handle);
         m_summary_dirty = false;
      }
   }

   void Close()
   {
      if(m_summary_handle != INVALID_HANDLE)
      {
         FileWrite(m_summary_handle, "compact_receipt_rows_skipped", (string)m_compact_skipped_rows);
         m_summary_dirty = true;
      }
      Flush();
      if(m_handle != INVALID_HANDLE)
      {
         FileClose(m_handle);
         m_handle = INVALID_HANDLE;
      }
      if(m_summary_handle != INVALID_HANDLE)
      {
         FileClose(m_summary_handle);
         m_summary_handle = INVALID_HANDLE;
      }
   }
};

#endif // __LIMNI_PORTFOLIO_RECEIPT_WRITER_MQH__
