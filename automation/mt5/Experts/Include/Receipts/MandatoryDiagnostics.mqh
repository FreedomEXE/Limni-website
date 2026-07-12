/*-----------------------------------------------
  Non-optional run evidence for every execution mode
-----------------------------------------------*/
#ifndef __LIMNI_PORTFOLIO_MANDATORY_DIAGNOSTICS_MQH__
#define __LIMNI_PORTFOLIO_MANDATORY_DIAGNOSTICS_MQH__

#include "..\\Core\\BuildInfo.mqh"
#include "..\\Core\\Config.mqh"
#include "..\\Core\\Types.mqh"

#define LP_MANDATORY_DIAGNOSTIC_MAX_EVENTS 4096

class LP_MandatoryDiagnostics
{
private:
   int m_manifest_handle;
   int m_events_handle;
   int m_first_blocker_handle;
   int m_completion_handle;
   string m_folder;
   string m_run_id;
   ulong m_event_sequence;
   ulong m_event_count;
   bool m_open;
   bool m_completed;
   bool m_first_blocker_written;
   bool m_event_overflow_written;
   string m_first_blocker_reason;
   int m_total_signals;
   int m_births;
   int m_adds;
   int m_closes;
   int m_route_attempts;
   int m_broker_mutations;
   int m_quarantine_state;

   void WriteManifestField(const string field, const string value)
   {
      if(m_manifest_handle != INVALID_HANDLE)
         FileWrite(m_manifest_handle, field, value);
   }

   void WriteCompletionField(const string field, const string value)
   {
      if(m_completion_handle != INVALID_HANDLE)
         FileWrite(m_completion_handle, field, value);
   }

public:
   void Reset()
   {
      m_manifest_handle = INVALID_HANDLE;
      m_events_handle = INVALID_HANDLE;
      m_first_blocker_handle = INVALID_HANDLE;
      m_completion_handle = INVALID_HANDLE;
      m_folder = "";
      m_run_id = "";
      m_event_sequence = 0;
      m_event_count = 0;
      m_open = false;
      m_completed = false;
      m_first_blocker_written = false;
      m_event_overflow_written = false;
      m_first_blocker_reason = "";
      m_total_signals = 0;
      m_births = 0;
      m_adds = 0;
      m_closes = 0;
      m_route_attempts = 0;
      m_broker_mutations = 0;
      m_quarantine_state = 0;
   }

   bool Open(const LP_Config &config, const ulong config_hash,
      const ulong symbol_universe_hash)
   {
      Reset();
      string stamp = LP_SafePart(LP_Stamp(TimeLocal()) + "_R" +
         IntegerToString((long)GetTickCount()));
      m_run_id = "LPEA_" + stamp;
      m_folder = "LimniPortfolioEA\\" + m_run_id;

      FolderCreate("LimniPortfolioEA", FILE_COMMON);
      FolderCreate(m_folder, FILE_COMMON);
      m_manifest_handle = FileOpen(m_folder + "\\run_manifest.csv",
         FILE_WRITE | FILE_CSV | FILE_ANSI | FILE_COMMON, ',');
      m_events_handle = FileOpen(m_folder + "\\events.csv",
         FILE_WRITE | FILE_CSV | FILE_ANSI | FILE_COMMON, ',');
      m_first_blocker_handle = FileOpen(m_folder + "\\first_blocker.txt",
         FILE_WRITE | FILE_TXT | FILE_ANSI | FILE_COMMON);
      m_completion_handle = FileOpen(m_folder + "\\completion.csv",
         FILE_WRITE | FILE_CSV | FILE_ANSI | FILE_COMMON, ',');

      if(m_manifest_handle == INVALID_HANDLE ||
         m_events_handle == INVALID_HANDLE ||
         m_first_blocker_handle == INVALID_HANDLE ||
         m_completion_handle == INVALID_HANDLE)
      {
         Print(LP_EA_NAME,
            " mandatory diagnostics open failed: folder=", m_folder,
            " error=", IntegerToString(GetLastError()));
         Close();
         return false;
      }

      FileWrite(m_manifest_handle, "field", "value");
      WriteManifestField("run_id", m_run_id);
      WriteManifestField("ea_name", LP_EA_NAME);
      WriteManifestField("ea_version", LP_EA_VERSION);
      WriteManifestField("build_gate", LP_BUILD_GATE);
      WriteManifestField("source_bundle_id", config.source_revision);
      WriteManifestField("ex5_build_identity", LP_EA_VERSION + "|" +
         LP_BUILD_GATE);
      WriteManifestField("config_hash", (string)config_hash);
      WriteManifestField("symbol_universe_hash", (string)symbol_universe_hash);
      WriteManifestField("active_systems", LP_ActiveSystemsText(
         config.enable_revma_system, config.enable_kyma_system,
         config.enable_katarakti_system));
      WriteManifestField("universe_mode",
         LP_UniverseDisplayName(config.revma_universe_mode));
      WriteManifestField("execution_mode",
         LP_ExecutionModeName(config.execution_mode));
      WriteManifestField("chart_symbol", _Symbol);
      WriteManifestField("timeframe", IntegerToString((int)_Period));
      WriteManifestField("account_currency",
         AccountInfoString(ACCOUNT_CURRENCY));
      WriteManifestField("initial_balance",
         DoubleToString(AccountInfoDouble(ACCOUNT_BALANCE), 2));
      WriteManifestField("initial_equity",
         DoubleToString(AccountInfoDouble(ACCOUNT_EQUITY), 2));
      WriteManifestField("broker_symbol_suffix", config.broker_symbol_suffix);
      WriteManifestField("formula_profile_identity",
         LP_REVMA_FORMULA_ID + "|" + LP_RevmaConfigQProfileId(config));
      WriteManifestField("formula_hash", (string)LP_RevmaFormulaHash());
      WriteManifestField("pair_direction_formula_id",
         LimniPairDirectionFormulaId());
      WriteManifestField("startup_time", LP_Stamp(TimeCurrent()));

      FileWrite(m_events_handle, "seq", "server_time", "stage", "symbol",
         "source_m1", "transaction_type", "intent_id", "order_ticket",
         "deal_ticket", "position_id", "reason", "detail");
      FileWrite(m_completion_handle, "field", "value");
      FileFlush(m_manifest_handle);
      FileFlush(m_events_handle);
      FileFlush(m_first_blocker_handle);
      FileFlush(m_completion_handle);
      m_open = true;
      Print(LP_EA_NAME, " mandatory diagnostics initialized | run_id=",
         m_run_id, " | common_folder=", m_folder);
      return true;
   }

   string RunId()
   {
      return m_run_id;
   }

   string Folder()
   {
      return m_folder;
   }

   bool Opened()
   {
      return m_open;
   }

   bool FirstBlocker(
      const string stage,
      const string symbol,
      const datetime source_m1,
      const string transaction_type,
      const ulong intent_id,
      const ulong order_ticket,
      const ulong deal_ticket,
      const ulong position_id,
      const string reason)
   {
      if(!m_open || m_first_blocker_written ||
         m_first_blocker_handle == INVALID_HANDLE)
         return m_first_blocker_written;
      FileWriteString(m_first_blocker_handle, "stage=" + stage + "\r\n");
      FileWriteString(m_first_blocker_handle, "symbol=" + symbol + "\r\n");
      FileWriteString(m_first_blocker_handle, "source_m1=" +
         LP_Stamp(source_m1) + "\r\n");
      FileWriteString(m_first_blocker_handle, "server_time=" +
         LP_Stamp(TimeCurrent()) + "\r\n");
      FileWriteString(m_first_blocker_handle, "transaction_type=" +
         transaction_type + "\r\n");
      FileWriteString(m_first_blocker_handle, "intent_id=" +
         (string)intent_id + "\r\n");
      FileWriteString(m_first_blocker_handle, "order_ticket=" +
         (string)order_ticket + "\r\n");
      FileWriteString(m_first_blocker_handle, "deal_ticket=" +
         (string)deal_ticket + "\r\n");
      FileWriteString(m_first_blocker_handle, "position_id=" +
         (string)position_id + "\r\n");
      FileWriteString(m_first_blocker_handle, "reason=" + reason + "\r\n");
      FileFlush(m_first_blocker_handle);
      m_first_blocker_written = true;
      m_first_blocker_reason = reason;
      return true;
   }

   void Event(
      const string stage,
      const string symbol,
      const datetime source_m1,
      const int transaction_type,
      const ulong intent_id,
      const ulong order_ticket,
      const ulong deal_ticket,
      const ulong position_id,
      const string reason,
      const string detail,
      const bool broker_mutation)
   {
      if(!m_open || m_completed || m_events_handle == INVALID_HANDLE)
         return;
      if(stage == "signal_created")
         m_total_signals++;
      else if(stage == "birth_committed")
         m_births++;
      else if(stage == "add_committed")
         m_adds++;
      else if(stage == "close_committed")
         m_closes++;
      else if(stage == "route_attempt")
         m_route_attempts++;
      if(broker_mutation)
         m_broker_mutations++;
      if(stage == "quarantine_start")
         m_quarantine_state = 1;
      else if(stage == "confirmed_flat")
         m_quarantine_state = 2;

      if(m_event_count >= LP_MANDATORY_DIAGNOSTIC_MAX_EVENTS)
      {
         if(!m_event_overflow_written)
         {
            m_event_sequence++;
            FileWrite(m_events_handle, (string)m_event_sequence,
               LP_Stamp(TimeCurrent()), "event_overflow", "", "", "0",
               "0", "0", "0", "0", "mandatory_event_bound_reached", "");
            FileFlush(m_events_handle);
            m_event_overflow_written = true;
         }
         return;
      }
      m_event_sequence++;
      m_event_count++;
      FileWrite(m_events_handle, (string)m_event_sequence,
         LP_Stamp(TimeCurrent()), stage, symbol, LP_Stamp(source_m1),
         IntegerToString(transaction_type), (string)intent_id,
         (string)order_ticket, (string)deal_ticket, (string)position_id,
         reason, detail);
      FileFlush(m_events_handle);
   }

   void Complete(
      const string status,
      const string reason,
      const int final_positions,
      const int final_orders,
      const double final_balance,
      const double final_equity,
      const bool fully_reconciled)
   {
      if(!m_open || m_completed || m_completion_handle == INVALID_HANDLE)
         return;
      Event("completion", "", 0, 0, 0, 0, 0, 0, reason,
         "status=" + status, false);
      WriteCompletionField("status", status);
      WriteCompletionField("first_blocker", m_first_blocker_written ?
         m_first_blocker_reason : "none");
      WriteCompletionField("total_signals", IntegerToString(m_total_signals));
      WriteCompletionField("births", IntegerToString(m_births));
      WriteCompletionField("adds", IntegerToString(m_adds));
      WriteCompletionField("closes", IntegerToString(m_closes));
      WriteCompletionField("route_attempts", IntegerToString(m_route_attempts));
      WriteCompletionField("broker_mutations",
         IntegerToString(m_broker_mutations));
      WriteCompletionField("quarantine_state",
         IntegerToString(m_quarantine_state));
      WriteCompletionField("final_positions", IntegerToString(final_positions));
      WriteCompletionField("final_orders", IntegerToString(final_orders));
      WriteCompletionField("final_balance", DoubleToString(final_balance, 2));
      WriteCompletionField("final_equity", DoubleToString(final_equity, 2));
      WriteCompletionField("fully_reconciled", LP_BoolText(fully_reconciled));
      WriteCompletionField("run_id", m_run_id);
      WriteCompletionField("common_folder", m_folder);
      WriteCompletionField("completion_time", LP_Stamp(TimeCurrent()));
      FileFlush(m_completion_handle);
      m_completed = true;
      Print(LP_EA_NAME, " mandatory diagnostics completed | run_id=", m_run_id,
         " | common_folder=", m_folder, " | status=", status);
   }

   void Close()
   {
      if(m_manifest_handle != INVALID_HANDLE)
      {
         FileFlush(m_manifest_handle);
         FileClose(m_manifest_handle);
         m_manifest_handle = INVALID_HANDLE;
      }
      if(m_events_handle != INVALID_HANDLE)
      {
         FileFlush(m_events_handle);
         FileClose(m_events_handle);
         m_events_handle = INVALID_HANDLE;
      }
      if(m_first_blocker_handle != INVALID_HANDLE)
      {
         FileFlush(m_first_blocker_handle);
         FileClose(m_first_blocker_handle);
         m_first_blocker_handle = INVALID_HANDLE;
      }
      if(m_completion_handle != INVALID_HANDLE)
      {
         FileFlush(m_completion_handle);
         FileClose(m_completion_handle);
         m_completion_handle = INVALID_HANDLE;
      }
      m_open = false;
   }
};

#endif // __LIMNI_PORTFOLIO_MANDATORY_DIAGNOSTICS_MQH__
