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
   string m_folder;
   string m_run_id;
   ulong m_event_seq;
   ulong m_config_hash;
   ulong m_symbol_universe_hash;

public:
   void Reset()
   {
      m_handle = INVALID_HANDLE;
      m_summary_handle = INVALID_HANDLE;
      m_file_scope = 0;
      m_folder = "";
      m_run_id = "";
      m_event_seq = 0;
      m_config_hash = 0;
      m_symbol_universe_hash = 0;
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
      m_folder = config.output_folder;
      FolderCreate(m_folder, m_file_scope);
      m_run_id = LP_EA_NAME + "_" + LP_SafePart(AccountInfoString(ACCOUNT_SERVER)) + "_" + IntegerToString((int)TimeLocal());

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
      }

      if(m_summary_handle != INVALID_HANDLE)
         FileWrite(m_summary_handle, "metric", "value");

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
   }

   void Summary(const string metric, const string value)
   {
      if(m_summary_handle == INVALID_HANDLE)
         return;
      FileWrite(m_summary_handle, metric, value);
   }

   void Flush()
   {
      if(m_handle != INVALID_HANDLE)
         FileFlush(m_handle);
      if(m_summary_handle != INVALID_HANDLE)
         FileFlush(m_summary_handle);
   }

   void Close()
   {
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
