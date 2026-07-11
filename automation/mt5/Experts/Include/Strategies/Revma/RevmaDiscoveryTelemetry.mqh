/*-----------------------------------------------
  Gate 108 dedicated buffered discovery telemetry
-----------------------------------------------*/
#ifndef __LIMNI_PORTFOLIO_REVMA_DISCOVERY_TELEMETRY_MQH__
#define __LIMNI_PORTFOLIO_REVMA_DISCOVERY_TELEMETRY_MQH__

#include "RevmaCenterSupportPolicy.mqh"

enum LP_RevmaDiscoveryTelemetryEvent
{
   LP_REVMA_TELEMETRY_BRANCH_BIRTH = 1,
   LP_REVMA_TELEMETRY_ATOM_ADMISSION = 2,
   LP_REVMA_TELEMETRY_FIRST_DIVERGENCE = 3,
   LP_REVMA_TELEMETRY_CENTER_LATCH = 4,
   LP_REVMA_TELEMETRY_CENTER_BLOCKED_ADVERSE = 5,
   LP_REVMA_TELEMETRY_FAVORABLE_ELIGIBLE_AFTER_LATCH = 6,
   LP_REVMA_TELEMETRY_FIRST_INFEASIBILITY = 7,
   LP_REVMA_TELEMETRY_GRID_CLOSE = 8,
   LP_REVMA_TELEMETRY_CLEANUP_LATCH = 9,
   LP_REVMA_TELEMETRY_CLEANUP_COMPLETE = 10,
   LP_REVMA_TELEMETRY_HARD_RISK_LATCH = 11,
   LP_REVMA_TELEMETRY_HARD_RISK_COMPLETE = 12,
   LP_REVMA_TELEMETRY_CYCLE_CLOSE = 13,
   LP_REVMA_TELEMETRY_FAILURE = 14
};

string LP_RevmaDiscoveryTelemetryEventName(const int event_type)
{
   if(event_type == LP_REVMA_TELEMETRY_BRANCH_BIRTH) return "branch_birth";
   if(event_type == LP_REVMA_TELEMETRY_ATOM_ADMISSION) return "atom_admission";
   if(event_type == LP_REVMA_TELEMETRY_FIRST_DIVERGENCE) return "first_divergence";
   if(event_type == LP_REVMA_TELEMETRY_CENTER_LATCH) return "center_support_latch";
   if(event_type == LP_REVMA_TELEMETRY_CENTER_BLOCKED_ADVERSE) return "center_blocked_adverse";
   if(event_type == LP_REVMA_TELEMETRY_FAVORABLE_ELIGIBLE_AFTER_LATCH) return "favorable_eligible_after_latch";
   if(event_type == LP_REVMA_TELEMETRY_FIRST_INFEASIBILITY) return "first_infeasibility";
   if(event_type == LP_REVMA_TELEMETRY_GRID_CLOSE) return "grid_close";
   if(event_type == LP_REVMA_TELEMETRY_CLEANUP_LATCH) return "cleanup_latch";
   if(event_type == LP_REVMA_TELEMETRY_CLEANUP_COMPLETE) return "cleanup_complete";
   if(event_type == LP_REVMA_TELEMETRY_HARD_RISK_LATCH) return "hard_risk_latch";
   if(event_type == LP_REVMA_TELEMETRY_HARD_RISK_COMPLETE) return "hard_risk_complete";
   if(event_type == LP_REVMA_TELEMETRY_CYCLE_CLOSE) return "cycle_close";
   if(event_type == LP_REVMA_TELEMETRY_FAILURE) return "failure";
   return "invalid_event";
}

bool LP_RevmaDiscoveryTelemetryEventValid(const int event_type)
{
   return event_type >= LP_REVMA_TELEMETRY_BRANCH_BIRTH &&
      event_type <= LP_REVMA_TELEMETRY_FAILURE;
}

string LP_RevmaTelemetryCsv(const string value)
{
   string escaped = value;
   StringReplace(escaped, "\"", "\"\"");
   return "\"" + escaped + "\"";
}

string LP_RevmaTelemetryJoin(string &fields[], const int count)
{
   string line = "";
   for(int i = 0; i < count; i++)
   {
      if(i > 0) line += ",";
      line += fields[i];
   }
   return line;
}

struct LP_RevmaDiscoveryTransitionRow
{
   bool valid;
   int event_type;
   datetime event_time;
   string run_id;
   string source_revision;
   ulong config_hash;
   ulong formula_hash;
   int branch;
   ulong branch_grid_id;
   ulong branch_cycle_id;
   ulong candidate_identity;
   ulong shared_origin_id;
   ulong opportunity_id;
   int symbol_id;
   int direction;
   int candidate_type;
   double p0;
   double stress_price;
   double fill_price;
   double current_price;
   double c0;
   double previous_center;
   double current_center;
   double q0;
   double current_q;
   long discovery_cell_ticks;
   double discovery_cell_price;
   long p0_ticks;
   long c0_ticks;
   long previous_center_ticks;
   long current_center_ticks;
   int support0_sign;
   int previous_support_sign;
   int current_support_sign;
   double support0_q;
   double current_support_q;
   double revision_q;
   bool center_applicable;
   bool center_latched;
   datetime center_latch_time;
   int center_update_count;
   int blocked_adverse_count;
   long previous_cell_index;
   long current_cell_index;
   long total_cell_path;
   long matched_reversal_crossings;
   long adverse_frontier_expansions;
   long favorable_frontier_expansions;
   long max_cell_jump;
   int atoms_before;
   int atoms_after;
   double lots_before;
   double lots_after;
   long reservation_minor;
   long q_cash_minor;
   long harvest_minor;
   long nonharvest_minor;
   long liability_minor;
   long budget_minor;
   long equity_reference_minor;
   int close_owner;
   string decision;
   string reason;
   ulong pre_candidate_state_hash;
   ulong event_hash;
   ulong reconciliation_hash;
};

void LP_ResetRevmaDiscoveryTransitionRow(LP_RevmaDiscoveryTransitionRow &row)
{
   ZeroMemory(row);
   row.valid = false;
   row.branch = -1;
   row.symbol_id = -1;
   row.direction = LP_SIDE_NONE;
   row.decision = "";
   row.reason = "";
}

struct LP_RevmaDiscoverySummaryRow
{
   bool valid;
   string summary_type;
   string run_id;
   string source_revision;
   ulong formula_hash;
   int branch;
   ulong branch_grid_id;
   ulong branch_cycle_id;
   int symbol_id;
   int direction;
   datetime birth_time;
   datetime close_time;
   int peak_atoms;
   double peak_lots;
   long peak_reservation_minor;
   long peak_q_cash_minor;
   long realized_after_cost_minor;
   long marked_after_cost_minor;
   long cost_minor;
   long harvest_minor;
   long nonharvest_minor;
   long liability_minor;
   long budget_minor;
   long equity_reference_minor;
   int close_owner;
   int center_applicable_grids;
   int center_triggered_grids;
   int center_not_triggered_grids;
   int center_not_applicable_grids;
   int center_blocked_adverse_candidates;
   int favorable_eligible_after_latch;
   bool center_latched;
   datetime first_latch_time;
   bool final_flat;
   bool cleanup_shortfall;
   bool broker_contamination;
   bool formula_clean;
   bool reconciliation_clean;
   string first_infeasibility;
   string terminal_reason;
   ulong event_hash;
   ulong reconciliation_hash;
};

void LP_ResetRevmaDiscoverySummaryRow(LP_RevmaDiscoverySummaryRow &row)
{
   ZeroMemory(row);
   row.valid = false;
   row.branch = -1;
   row.symbol_id = -1;
   row.direction = LP_SIDE_NONE;
   row.summary_type = "";
   row.first_infeasibility = "";
   row.terminal_reason = "";
}

class LP_RevmaDiscoveryTelemetry
{
private:
   bool m_initialized;
   bool m_valid;
   string m_invalid_reason;
   int m_transition_handle;
   int m_summary_handle;
   string m_transition_buffer[LP_REVMA_DISCOVERY_TRANSITION_BUFFER_ROWS];
   string m_summary_buffer[LP_REVMA_DISCOVERY_SUMMARY_BUFFER_ROWS];
   int m_transition_count;
   int m_summary_count;
   long m_transition_rows;
   long m_summary_rows;
   long m_transition_bytes;
   long m_summary_bytes;
   long m_transition_flushes;
   long m_summary_flushes;
   int m_center_applicable_grids;
   int m_center_triggered_grids;
   int m_center_not_triggered_grids;
   int m_center_not_applicable_grids;
   int m_center_blocked_adverse_candidates;
   int m_favorable_eligible_after_latch;
   ulong m_center_grid_ids[LP_SYMBOL_COUNT];
   bool m_center_triggered[LP_SYMBOL_COUNT];
   bool m_center_closed[LP_SYMBOL_COUNT];

   void Invalidate(const string reason)
   {
      m_valid = false;
      if(m_invalid_reason == "") m_invalid_reason = reason;
   }

   bool GuardLine(const string line, const bool transition)
   {
      int line_bytes = StringLen(line) + 2;
      if(line_bytes <= 2 || line_bytes > LP_REVMA_DISCOVERY_MAX_LINE_BYTES)
      {
         Invalidate("telemetry_line_byte_guard");
         return false;
      }
      long current_bytes = transition ? m_transition_bytes : m_summary_bytes;
      if(current_bytes > LP_REVMA_DISCOVERY_ARTIFACT_BYTE_GUARD - line_bytes)
      {
         Invalidate("telemetry_artifact_byte_guard");
         return false;
      }
      return true;
   }

   bool FlushTransitionBuffer()
   {
      if(!m_valid || m_transition_handle == INVALID_HANDLE) return false;
      for(int i = 0; i < m_transition_count; i++)
      {
         uint written = FileWriteString(m_transition_handle, m_transition_buffer[i] + "\r\n");
         if(written <= 0)
         {
            Invalidate("transition_artifact_write_failed");
            return false;
         }
         m_transition_bytes += written;
         m_transition_buffer[i] = "";
      }
      FileFlush(m_transition_handle);
      m_transition_count = 0;
      m_transition_flushes++;
      return true;
   }

   bool FlushSummaryBuffer()
   {
      if(!m_valid || m_summary_handle == INVALID_HANDLE) return false;
      for(int i = 0; i < m_summary_count; i++)
      {
         uint written = FileWriteString(m_summary_handle, m_summary_buffer[i] + "\r\n");
         if(written <= 0)
         {
            Invalidate("summary_artifact_write_failed");
            return false;
         }
         m_summary_bytes += written;
         m_summary_buffer[i] = "";
      }
      FileFlush(m_summary_handle);
      m_summary_count = 0;
      m_summary_flushes++;
      return true;
   }

   string TransitionLine(const LP_RevmaDiscoveryTransitionRow &row)
   {
      string f[68];
      int n = 0;
      f[n++] = LP_RevmaTelemetryCsv(LP_REVMA_DISCOVERY_TELEMETRY_SCHEMA_ID);
      f[n++] = LP_RevmaTelemetryCsv(LP_RevmaDiscoveryTelemetryEventName(row.event_type));
      f[n++] = (string)row.event_time;
      f[n++] = LP_RevmaTelemetryCsv(row.run_id);
      f[n++] = LP_RevmaTelemetryCsv(row.source_revision);
      f[n++] = (string)row.config_hash;
      f[n++] = (string)row.formula_hash;
      f[n++] = LP_RevmaTelemetryCsv(LP_RevmaDiscoveryBranchId(row.branch));
      f[n++] = (string)row.branch_grid_id;
      f[n++] = (string)row.branch_cycle_id;
      f[n++] = (string)row.candidate_identity;
      f[n++] = (string)row.shared_origin_id;
      f[n++] = (string)row.opportunity_id;
      f[n++] = IntegerToString(row.symbol_id);
      f[n++] = IntegerToString(row.direction);
      f[n++] = IntegerToString(row.candidate_type);
      f[n++] = DoubleToString(row.p0, 12);
      f[n++] = DoubleToString(row.stress_price, 12);
      f[n++] = DoubleToString(row.fill_price, 12);
      f[n++] = DoubleToString(row.current_price, 12);
      f[n++] = DoubleToString(row.c0, 12);
      f[n++] = DoubleToString(row.previous_center, 12);
      f[n++] = DoubleToString(row.current_center, 12);
      f[n++] = DoubleToString(row.q0, 12);
      f[n++] = DoubleToString(row.current_q, 12);
      f[n++] = (string)row.discovery_cell_ticks;
      f[n++] = DoubleToString(row.discovery_cell_price, 12);
      f[n++] = (string)row.p0_ticks;
      f[n++] = (string)row.c0_ticks;
      f[n++] = (string)row.previous_center_ticks;
      f[n++] = (string)row.current_center_ticks;
      f[n++] = IntegerToString(row.support0_sign);
      f[n++] = IntegerToString(row.previous_support_sign);
      f[n++] = IntegerToString(row.current_support_sign);
      f[n++] = DoubleToString(row.support0_q, 12);
      f[n++] = DoubleToString(row.current_support_q, 12);
      f[n++] = DoubleToString(row.revision_q, 12);
      f[n++] = IntegerToString(row.center_applicable ? 1 : 0);
      f[n++] = IntegerToString(row.center_latched ? 1 : 0);
      f[n++] = (string)row.center_latch_time;
      f[n++] = IntegerToString(row.center_update_count);
      f[n++] = IntegerToString(row.blocked_adverse_count);
      f[n++] = (string)row.previous_cell_index;
      f[n++] = (string)row.current_cell_index;
      f[n++] = (string)row.total_cell_path;
      f[n++] = (string)row.matched_reversal_crossings;
      f[n++] = (string)row.adverse_frontier_expansions;
      f[n++] = (string)row.favorable_frontier_expansions;
      f[n++] = (string)row.max_cell_jump;
      f[n++] = IntegerToString(row.atoms_before);
      f[n++] = IntegerToString(row.atoms_after);
      f[n++] = DoubleToString(row.lots_before, 2);
      f[n++] = DoubleToString(row.lots_after, 2);
      f[n++] = (string)row.reservation_minor;
      f[n++] = (string)row.q_cash_minor;
      f[n++] = (string)row.harvest_minor;
      f[n++] = (string)row.nonharvest_minor;
      f[n++] = (string)row.liability_minor;
      f[n++] = (string)row.budget_minor;
      f[n++] = (string)row.equity_reference_minor;
      f[n++] = IntegerToString(row.close_owner);
      f[n++] = LP_RevmaTelemetryCsv(row.decision);
      f[n++] = LP_RevmaTelemetryCsv(row.reason);
      f[n++] = (string)row.pre_candidate_state_hash;
      f[n++] = (string)row.event_hash;
      f[n++] = (string)row.reconciliation_hash;
      return LP_RevmaTelemetryJoin(f, n);
   }

   string SummaryLine(const LP_RevmaDiscoverySummaryRow &row)
   {
      string f[45];
      int n = 0;
      f[n++] = LP_RevmaTelemetryCsv(LP_REVMA_DISCOVERY_TELEMETRY_SCHEMA_ID);
      f[n++] = LP_RevmaTelemetryCsv(row.summary_type);
      f[n++] = LP_RevmaTelemetryCsv(row.run_id);
      f[n++] = LP_RevmaTelemetryCsv(row.source_revision);
      f[n++] = (string)row.formula_hash;
      f[n++] = LP_RevmaTelemetryCsv(LP_RevmaDiscoveryBranchId(row.branch));
      f[n++] = (string)row.branch_grid_id;
      f[n++] = (string)row.branch_cycle_id;
      f[n++] = IntegerToString(row.symbol_id);
      f[n++] = IntegerToString(row.direction);
      f[n++] = (string)row.birth_time;
      f[n++] = (string)row.close_time;
      f[n++] = IntegerToString(row.peak_atoms);
      f[n++] = DoubleToString(row.peak_lots, 2);
      f[n++] = (string)row.peak_reservation_minor;
      f[n++] = (string)row.peak_q_cash_minor;
      f[n++] = (string)row.realized_after_cost_minor;
      f[n++] = (string)row.marked_after_cost_minor;
      f[n++] = (string)row.cost_minor;
      f[n++] = (string)row.harvest_minor;
      f[n++] = (string)row.nonharvest_minor;
      f[n++] = (string)row.liability_minor;
      f[n++] = (string)row.budget_minor;
      f[n++] = (string)row.equity_reference_minor;
      f[n++] = IntegerToString(row.close_owner);
      f[n++] = IntegerToString(row.center_applicable_grids);
      f[n++] = IntegerToString(row.center_triggered_grids);
      f[n++] = IntegerToString(row.center_not_triggered_grids);
      f[n++] = IntegerToString(row.center_not_applicable_grids);
      f[n++] = IntegerToString(row.center_blocked_adverse_candidates);
      f[n++] = IntegerToString(row.favorable_eligible_after_latch);
      f[n++] = IntegerToString(row.center_latched ? 1 : 0);
      f[n++] = (string)row.first_latch_time;
      f[n++] = IntegerToString(row.final_flat ? 1 : 0);
      f[n++] = IntegerToString(row.cleanup_shortfall ? 1 : 0);
      f[n++] = IntegerToString(row.broker_contamination ? 1 : 0);
      f[n++] = IntegerToString(row.formula_clean ? 1 : 0);
      f[n++] = IntegerToString(row.reconciliation_clean ? 1 : 0);
      f[n++] = LP_RevmaTelemetryCsv(row.first_infeasibility);
      f[n++] = LP_RevmaTelemetryCsv(row.terminal_reason);
      f[n++] = (string)row.event_hash;
      f[n++] = (string)row.reconciliation_hash;
      f[n++] = (string)m_transition_rows;
      f[n++] = (string)m_transition_bytes;
      return LP_RevmaTelemetryJoin(f, n);
   }

public:
   LP_RevmaDiscoveryTelemetry()
   {
      m_initialized = false;
      m_valid = false;
      m_invalid_reason = "not_initialized";
      m_transition_handle = INVALID_HANDLE;
      m_summary_handle = INVALID_HANDLE;
      m_transition_count = 0;
      m_summary_count = 0;
      m_transition_rows = 0;
      m_summary_rows = 0;
      m_transition_bytes = 0;
      m_summary_bytes = 0;
      m_transition_flushes = 0;
      m_summary_flushes = 0;
      m_center_applicable_grids = 0;
      m_center_triggered_grids = 0;
      m_center_not_triggered_grids = 0;
      m_center_not_applicable_grids = 0;
      m_center_blocked_adverse_candidates = 0;
      m_favorable_eligible_after_latch = 0;
      for(int i = 0; i < LP_SYMBOL_COUNT; i++)
      {
         m_center_grid_ids[i] = 0;
         m_center_triggered[i] = false;
         m_center_closed[i] = false;
      }
   }

   bool Initialize(const string output_folder, const bool common_files)
   {
      if(m_initialized || output_folder == "" ||
         LP_RevmaDiscoveryFormulaHash() == 0)
         return false;
      int flags = FILE_WRITE | FILE_TXT | FILE_ANSI | FILE_SHARE_READ;
      if(common_files) flags |= FILE_COMMON;
      m_transition_handle = FileOpen(output_folder + "\\gate108_discovery_transitions.csv", flags);
      if(m_transition_handle == INVALID_HANDLE)
      {
         Invalidate("transition_artifact_open_failed");
         return false;
      }
      m_summary_handle = FileOpen(output_folder + "\\gate108_discovery_summaries.csv", flags);
      if(m_summary_handle == INVALID_HANDLE)
      {
         FileClose(m_transition_handle);
         m_transition_handle = INVALID_HANDLE;
         Invalidate("summary_artifact_open_failed");
         return false;
      }
      m_valid = true;
      m_initialized = true;
      m_invalid_reason = "";
      string transition_header = "schema_id,event_type,event_time,run_id,source_revision,config_hash,formula_hash,branch_id,branch_grid_id,branch_cycle_id,candidate_identity,shared_origin_id,opportunity_id,symbol_id,direction,candidate_type,p0,stress_price,fill_price,current_price,c0,previous_center,current_center,q0,current_q,discovery_cell_ticks,discovery_cell_price,p0_ticks,c0_ticks,previous_center_ticks,current_center_ticks,support0_sign,previous_support_sign,current_support_sign,support0_q,current_support_q,revision_q,center_applicable,center_latched,center_latch_time,center_update_count,blocked_adverse_count,previous_cell_index,current_cell_index,total_cell_path,matched_reversal_crossings,adverse_frontier_expansions,favorable_frontier_expansions,max_cell_jump,atoms_before,atoms_after,lots_before,lots_after,reservation_minor,q_cash_minor,harvest_minor,nonharvest_minor,liability_minor,budget_minor,equity_reference_minor,close_owner,decision,reason,pre_candidate_state_hash,event_hash,reconciliation_hash";
      string summary_header = "schema_id,summary_type,run_id,source_revision,formula_hash,branch_id,branch_grid_id,branch_cycle_id,symbol_id,direction,birth_time,close_time,peak_atoms,peak_lots,peak_reservation_minor,peak_q_cash_minor,realized_after_cost_minor,marked_after_cost_minor,cost_minor,harvest_minor,nonharvest_minor,liability_minor,budget_minor,equity_reference_minor,close_owner,center_applicable_grids,center_triggered_grids,center_not_triggered_grids,center_not_applicable_grids,center_blocked_adverse_candidates,favorable_eligible_after_latch,center_latched,first_latch_time,final_flat,cleanup_shortfall,broker_contamination,formula_clean,reconciliation_clean,first_infeasibility,terminal_reason,event_hash,reconciliation_hash,transition_rows,transition_bytes";
      if(!GuardLine(transition_header, true) || !GuardLine(summary_header, false) ||
         FileWriteString(m_transition_handle, transition_header + "\r\n") <= 0 ||
         FileWriteString(m_summary_handle, summary_header + "\r\n") <= 0)
      {
         Invalidate("telemetry_header_write_failed");
         return false;
      }
      m_transition_bytes += StringLen(transition_header) + 2;
      m_summary_bytes += StringLen(summary_header) + 2;
      FileFlush(m_transition_handle);
      FileFlush(m_summary_handle);
      return true;
   }

   bool AppendTransition(const LP_RevmaDiscoveryTransitionRow &row)
   {
      if(!m_initialized || !m_valid || !row.valid ||
         !LP_RevmaDiscoveryTelemetryEventValid(row.event_type) ||
         row.event_time <= 0 || row.run_id == "" || row.source_revision == "" ||
         row.formula_hash != LP_RevmaDiscoveryFormulaHash() ||
         !LP_RevmaDiscoveryBranchValid(row.branch) || row.symbol_id < 0 ||
         row.symbol_id >= LP_SYMBOL_COUNT)
      {
         Invalidate("transition_row_invariant_failure");
         return false;
      }
      string line = TransitionLine(row);
      if(!GuardLine(line, true)) return false;
      if(m_transition_count >= LP_REVMA_DISCOVERY_TRANSITION_BUFFER_ROWS)
      {
         Invalidate("transition_buffer_resource_guard");
         return false;
      }
      m_transition_buffer[m_transition_count++] = line;
      m_transition_rows++;
      if(row.event_type == LP_REVMA_TELEMETRY_CENTER_BLOCKED_ADVERSE)
         m_center_blocked_adverse_candidates++;
      if(row.event_type == LP_REVMA_TELEMETRY_FAVORABLE_ELIGIBLE_AFTER_LATCH)
         m_favorable_eligible_after_latch++;
      if(m_transition_count >= LP_REVMA_DISCOVERY_TRANSITION_FLUSH_ROWS)
         return FlushTransitionBuffer();
      return true;
   }

   bool AppendSummary(LP_RevmaDiscoverySummaryRow &row)
   {
      if(!m_initialized || !m_valid || !row.valid || row.summary_type == "" ||
         row.run_id == "" || row.source_revision == "" ||
         row.formula_hash != LP_RevmaDiscoveryFormulaHash() ||
         !LP_RevmaDiscoveryBranchValid(row.branch))
      {
         Invalidate("summary_row_invariant_failure");
         return false;
      }
      row.center_applicable_grids = m_center_applicable_grids;
      row.center_triggered_grids = m_center_triggered_grids;
      row.center_not_triggered_grids = m_center_not_triggered_grids;
      row.center_not_applicable_grids = m_center_not_applicable_grids;
      row.center_blocked_adverse_candidates = m_center_blocked_adverse_candidates;
      row.favorable_eligible_after_latch = m_favorable_eligible_after_latch;
      string line = SummaryLine(row);
      if(!GuardLine(line, false)) return false;
      if(m_summary_count >= LP_REVMA_DISCOVERY_SUMMARY_BUFFER_ROWS)
      {
         Invalidate("summary_buffer_resource_guard");
         return false;
      }
      m_summary_buffer[m_summary_count++] = line;
      m_summary_rows++;
      if(m_summary_count >= LP_REVMA_DISCOVERY_SUMMARY_FLUSH_ROWS)
         return FlushSummaryBuffer();
      return true;
   }

   bool ObserveCenterGridBirth(const int symbol_id, const ulong grid_id, const bool applicable)
   {
      if(!m_valid || symbol_id < 0 || symbol_id >= LP_SYMBOL_COUNT || grid_id == 0)
      {
         Invalidate("center_birth_counter_invariant_failure");
         return false;
      }
      if(m_center_grid_ids[symbol_id] == grid_id) return true;
      m_center_grid_ids[symbol_id] = grid_id;
      m_center_triggered[symbol_id] = false;
      m_center_closed[symbol_id] = false;
      if(applicable) m_center_applicable_grids++;
      else m_center_not_applicable_grids++;
      return true;
   }

   bool ObserveCenterLatch(const int symbol_id, const ulong grid_id)
   {
      if(!m_valid || symbol_id < 0 || symbol_id >= LP_SYMBOL_COUNT ||
         m_center_grid_ids[symbol_id] != grid_id || m_center_triggered[symbol_id])
      {
         Invalidate("center_latch_counter_invariant_failure");
         return false;
      }
      m_center_triggered[symbol_id] = true;
      m_center_triggered_grids++;
      return true;
   }

   bool ObserveCenterGridClose(const int symbol_id, const ulong grid_id)
   {
      if(!m_valid || symbol_id < 0 || symbol_id >= LP_SYMBOL_COUNT ||
         m_center_grid_ids[symbol_id] != grid_id || m_center_closed[symbol_id])
      {
         Invalidate("center_close_counter_invariant_failure");
         return false;
      }
      m_center_closed[symbol_id] = true;
      if(!m_center_triggered[symbol_id]) m_center_not_triggered_grids++;
      return true;
   }

   bool Finalize()
   {
      if(!m_initialized || !m_valid) return false;
      bool ok = FlushTransitionBuffer() && FlushSummaryBuffer();
      if(m_transition_handle != INVALID_HANDLE) FileClose(m_transition_handle);
      if(m_summary_handle != INVALID_HANDLE) FileClose(m_summary_handle);
      m_transition_handle = INVALID_HANDLE;
      m_summary_handle = INVALID_HANDLE;
      m_initialized = false;
      return ok && m_valid;
   }

   bool Valid() { return m_valid; }
   string InvalidReason() { return m_invalid_reason; }
   long TransitionRows() { return m_transition_rows; }
   long SummaryRows() { return m_summary_rows; }
   long TransitionBytes() { return m_transition_bytes; }
   long SummaryBytes() { return m_summary_bytes; }
   long TransitionFlushes() { return m_transition_flushes; }
   long SummaryFlushes() { return m_summary_flushes; }
};

#endif // __LIMNI_PORTFOLIO_REVMA_DISCOVERY_TELEMETRY_MQH__
