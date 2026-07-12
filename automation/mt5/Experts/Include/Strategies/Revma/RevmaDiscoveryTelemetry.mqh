/*-----------------------------------------------
  Gate 108 dedicated buffered discovery telemetry
-----------------------------------------------*/
#ifndef __LIMNI_PORTFOLIO_REVMA_DISCOVERY_TELEMETRY_MQH__
#define __LIMNI_PORTFOLIO_REVMA_DISCOVERY_TELEMETRY_MQH__

#include "RevmaCenterSupportPolicy.mqh"

bool LP_RevmaTelemetrySafeMinorAdd(
   const long left,
   const long right,
   long &result)
{
   result = 0;
   if(left > LP_REVMA_GEOMETRY_ABS_LIMIT ||
      left < -LP_REVMA_GEOMETRY_ABS_LIMIT ||
      right > LP_REVMA_GEOMETRY_ABS_LIMIT ||
      right < -LP_REVMA_GEOMETRY_ABS_LIMIT ||
      (right > 0 && left > LP_REVMA_GEOMETRY_ABS_LIMIT - right) ||
      (right < 0 && left < -LP_REVMA_GEOMETRY_ABS_LIMIT - right))
      return false;
   result = left + right;
   return true;
}

bool LP_RevmaTelemetrySafeMinorMultiply(
   const long value,
   const int count,
   long &result)
{
   result = 0;
   if(value < 0 || value > LP_REVMA_GEOMETRY_ABS_LIMIT || count < 0 ||
      (count > 0 && value > LP_REVMA_GEOMETRY_ABS_LIMIT / count))
      return false;
   result = value * count;
   return true;
}

enum LP_RevmaDiscoveryTelemetryEvent
{
   LP_REVMA_TELEMETRY_CYCLE_START = 1,
   LP_REVMA_TELEMETRY_BRANCH_BIRTH = 2,
   LP_REVMA_TELEMETRY_ATOM_ADMISSION = 3,
   LP_REVMA_TELEMETRY_FIRST_DIVERGENCE = 4,
   LP_REVMA_TELEMETRY_CENTER_LATCH = 5,
   LP_REVMA_TELEMETRY_CENTER_BLOCKED_ADVERSE = 6,
   LP_REVMA_TELEMETRY_FAVORABLE_ELIGIBLE_AFTER_LATCH = 7,
   LP_REVMA_TELEMETRY_FIRST_INFEASIBILITY = 8,
   LP_REVMA_TELEMETRY_GRID_CLOSE = 9,
   LP_REVMA_TELEMETRY_CLEANUP_LATCH = 10,
   LP_REVMA_TELEMETRY_CLEANUP_COMPLETE = 11,
   LP_REVMA_TELEMETRY_HARD_RISK_LATCH = 12,
   LP_REVMA_TELEMETRY_HARD_RISK_COMPLETE = 13,
   LP_REVMA_TELEMETRY_CYCLE_CLOSE = 14,
   LP_REVMA_TELEMETRY_FAILURE = 15,
   LP_REVMA_TELEMETRY_RUN_BOUNDARY_UNRESOLVED = 16,
   LP_REVMA_TELEMETRY_GRID_TERMINAL_SNAPSHOT = 17,
   LP_REVMA_TELEMETRY_CANDIDATE_REJECTION = 18
};

string LP_RevmaDiscoveryTelemetryEventName(const int event_type)
{
   if(event_type == LP_REVMA_TELEMETRY_CYCLE_START) return "cycle_start";
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
   if(event_type == LP_REVMA_TELEMETRY_RUN_BOUNDARY_UNRESOLVED)
      return "run_boundary_unresolved";
   if(event_type == LP_REVMA_TELEMETRY_GRID_TERMINAL_SNAPSHOT)
      return "grid_terminal_snapshot";
   if(event_type == LP_REVMA_TELEMETRY_CANDIDATE_REJECTION)
      return "candidate_rejection";
   return "invalid_event";
}

bool LP_RevmaDiscoveryTelemetryEventValid(const int event_type)
{
   return event_type >= LP_REVMA_TELEMETRY_CYCLE_START &&
      event_type <= LP_REVMA_TELEMETRY_CANDIDATE_REJECTION;
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
   ulong sequence;
   datetime event_time;
   datetime source_m1_time;
   string run_id;
   string source_revision;
   string profile_id;
   ulong profile_hash;
   ulong config_hash;
   ulong formula_hash;
   ulong signal_identity_hash;
   int q_day_count;
   long q_event_count;
   ulong reconstruction_epoch;
   int branch;
   ulong branch_grid_id;
   ulong branch_cycle_id;
   ulong account_cycle_id;
   long grid_generation;
   ulong candidate_identity;
   ulong shared_origin_id;
   ulong opportunity_id;
   ulong matched_snapshot_hash;
   ulong shared_observation_snapshot_hash;
   ulong strategy_state_identity_hash;
   int symbol_id;
   int direction;
   int candidate_type;
   string birth_bucket;
   string center_alignment;
   double p0;
   double stress_price;
   double fill_price;
   double current_price;
   double c0;
   double previous_center;
   double current_center;
   double q0;
   double current_q;
   string q_profile_id;
   int q_event_cadence;
   double current_q_ratio;
   long discovery_cell_ticks;
   double discovery_cell_price;
   double broker_tick_size;
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
   int center_observation_index;
   int center_not_available_count;
   int first_center_update_observation_index;
   int last_center_update_observation_index;
   int first_center_update_q_event_index;
   int last_center_update_q_event_index;
   datetime first_center_update_time;
   datetime last_center_update_time;
   int center_staleness_minutes;
   double cumulative_signed_revision_q;
   double cumulative_absolute_revision_q;
   double minimum_support_q;
   double maximum_support_q;
   double regression_sum_x;
   double regression_sum_y;
   double regression_sum_x2;
   double regression_sum_xy;
   int blocked_adverse_count;
   long previous_cell_index;
   long current_cell_index;
   long total_cell_path;
   long completed_cell_crossings;
   long unfilled_jump_cells;
   long matched_reversal_crossings;
   long adverse_frontier_expansions;
   long favorable_frontier_expansions;
   long max_cell_jump;
   int last_movement_sign;
   long minimum_cell_index;
   long maximum_cell_index;
   long new_extreme_count;
   datetime initial_history_boundary;
   datetime last_reversal_m1;
   int time_since_last_reversal_minutes;
   datetime last_positive_liquidation_opportunity_m1;
   int time_since_positive_liquidation_opportunity_minutes;
   int atoms_before;
   int atoms_after;
   double lots_before;
   double lots_after;
   long reservation_minor;
   long q_cash_minor;
   long prospective_reservation_minor;
   long prospective_q_cash_minor;
   long a_g_candidate_minor;
   long a_g_minor;
   bool reservation_overrun;
   long reservation_overrun_minor;
   long margin_minor;
   long incremental_margin_minor;
   long incremental_liquidation_minor;
   long incremental_close_cost_minor;
   long concentration_q_cash_minor;
   int concentration_currency_id;
   long commission_minor;
   long swap_minor;
   long liquidation_cost_minor;
   long maximum_adverse_excursion_minor;
   int grid_age_minutes;
   int time_underwater_minutes;
   double weighted_entry_sum;
   int adverse_add_count;
   int favorable_add_count;
   long harvest_minor;
   long nonharvest_minor;
   long liability_minor;
   long budget_minor;
   long equity_reference_minor;
   int close_owner;
   string decision;
   string reason;
   string grid_terminal_reason;
   ulong pre_candidate_state_hash;
   ulong terminal_internal_state_hash;
   ulong terminal_projection_hash;
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
   row.concentration_currency_id = -1;
   row.decision = "";
   row.reason = "";
}

struct LP_RevmaDiscoverySummaryRow
{
   bool valid;
   string summary_type;
   ulong summary_sequence;
   string run_id;
   string source_revision;
   string profile_id;
   ulong profile_hash;
   ulong config_hash;
   ulong formula_hash;
   int branch;
   ulong branch_grid_id;
   ulong branch_cycle_id;
   ulong account_cycle_id;
   int symbol_id;
   int direction;
   datetime birth_time;
   datetime close_time;
   int peak_atoms;
   double peak_lots;
   int current_atoms;
   double current_lots;
   long current_reservation_minor;
   long current_margin_minor;
   long current_q_cash_minor;
   int current_active_grid_count;
   long current_concentration_q_cash_minor;
   int current_concentration_currency_id;
   long current_liquidation_liability_minor;
   long equity_high_water_minor;
   long branch_drawdown_minor;
   long cycle_peak_reservation_minor;
   long cycle_peak_margin_minor;
   long cycle_peak_q_cash_minor;
   int cycle_peak_atom_count;
   long peak_reservation_minor;
   bool reservation_overrun_observed;
   long peak_reservation_overrun_minor;
   long peak_q_cash_minor;
   long peak_margin_minor;
   int peak_active_grid_count;
   long peak_concentration_q_cash_minor;
   int peak_concentration_currency_id;
   long peak_liquidation_liability_minor;
   long maximum_drawdown_minor;
   ulong cycle_risk_snapshot_count;
   ulong cycle_risk_snapshot_hash;
   ulong cycle_candidate_built_count;
   ulong cycle_candidate_decision_count;
   ulong cycle_candidate_admitted_count;
   ulong cycle_candidate_rejected_count;
   ulong cycle_inventory_transition_count;
   long maximum_adverse_excursion_minor;
   int maximum_age_minutes;
   int time_underwater_minutes;
   long realized_after_cost_minor;
   long marked_after_cost_minor;
   long cost_minor;
   long harvest_minor;
   long nonharvest_minor;
   int local_harvest_close_count;
   int cleanup_close_count;
   int hard_risk_close_count;
   long local_harvest_pnl_minor;
   long cleanup_pnl_minor;
   long hard_risk_pnl_minor;
   long liability_minor;
   long cleanup_funding_minor;
   long managed_cycle_pnl_minor;
   long branch_equity_minor;
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
   bool unresolved_inventory;
   string first_infeasibility;
   string latest_infeasibility;
   datetime latest_infeasibility_m1_time;
   string terminal_reason;
   ulong summary_child_evidence_hash;
   ulong event_hash;
   ulong reconciliation_hash;
   ulong terminal_branch_transition_hash;
   datetime terminal_source_m1_time;
   ulong terminal_grid_state_hash;
   ulong terminal_book_hash;
   ulong terminal_projection_hash;
   ulong terminal_risk_state_hash;
   long run_peak_reservation_minor;
   long run_peak_margin_minor;
   long run_peak_q_cash_minor;
   int run_peak_atom_count;
   int run_peak_active_grid_count;
   long run_peak_concentration_q_cash_minor;
   int run_peak_concentration_currency_id;
   long run_peak_liquidation_liability_minor;
   long run_equity_high_water_minor;
   long run_maximum_drawdown_minor;
   ulong run_risk_snapshot_count;
   ulong run_risk_snapshot_hash;
   ulong run_candidate_built_count;
   ulong run_candidate_decision_count;
   ulong run_candidate_admitted_count;
   ulong run_candidate_rejected_count;
   ulong run_inventory_transition_count;
   ulong writer_branch_transition_rows;
   ulong writer_cycle_candidate_decision_rows;
   ulong writer_cycle_candidate_admitted_rows;
   ulong writer_cycle_candidate_rejected_rows;
   ulong writer_cycle_inventory_transition_rows;
   ulong writer_run_candidate_decision_rows;
   ulong writer_run_candidate_admitted_rows;
   ulong writer_run_candidate_rejected_rows;
   ulong writer_run_inventory_transition_rows;
   long run_elapsed_microseconds;
   long transition_flush_microseconds;
   long transition_flush_max_microseconds;
   long summary_flush_microseconds;
   long summary_flush_max_microseconds;
};

void LP_ResetRevmaDiscoverySummaryRow(LP_RevmaDiscoverySummaryRow &row)
{
   ZeroMemory(row);
   row.valid = false;
   row.branch = -1;
   row.symbol_id = -1;
   row.direction = LP_SIDE_NONE;
   row.current_concentration_currency_id = -1;
   row.peak_concentration_currency_id = -1;
   row.run_peak_concentration_currency_id = -1;
   row.summary_type = "";
   row.first_infeasibility = "";
   row.terminal_reason = "";
}

bool LP_RevmaTelemetryAsciiFieldValid(const string value, const bool allow_empty)
{
   int length = StringLen(value);
   if(length <= 0) return allow_empty;
   for(int i = 0; i < length; i++)
   {
      ushort code = StringGetCharacter(value, i);
      if(code < 32 || code > 126)
         return false;
   }
   return true;
}

bool LP_RevmaTelemetryFileTokenValid(const string value)
{
   int length = StringLen(value);
   if(length <= 0 || length > 96)
      return false;
   for(int i = 0; i < length; i++)
   {
      ushort code = StringGetCharacter(value, i);
      bool valid = (code >= 'A' && code <= 'Z') ||
         (code >= 'a' && code <= 'z') || (code >= '0' && code <= '9') ||
         code == '_' || code == '-';
      if(!valid) return false;
   }
   return true;
}

bool LP_RevmaTelemetryOutputFolderValid(const string value)
{
   return LP_RevmaTelemetryAsciiFieldValid(value, false) &&
      StringFind(value, "..") < 0 && StringFind(value, ":") < 0 &&
      StringFind(value, "*") < 0 && StringFind(value, "?") < 0 &&
      StringFind(value, "\"") < 0 && StringSubstr(value, 0, 1) != "\\" &&
      StringSubstr(value, 0, 1) != "/";
}

bool LP_RevmaTelemetrySummaryTypeValid(const string summary_type)
{
   return summary_type == "grid" || summary_type == "symbol" ||
      summary_type == "cycle" || summary_type == "top_offender" ||
      summary_type == "reconciliation" || summary_type == "run_completion";
}

bool LP_RevmaTelemetryFiniteSummary(const LP_RevmaDiscoverySummaryRow &row)
{
   return MathIsValidNumber(row.peak_lots) &&
      MathIsValidNumber(row.current_lots);
}

bool LP_RevmaTelemetryFiniteTransition(const LP_RevmaDiscoveryTransitionRow &row)
{
   return MathIsValidNumber(row.p0) && MathIsValidNumber(row.stress_price) &&
      MathIsValidNumber(row.fill_price) && MathIsValidNumber(row.current_price) &&
      MathIsValidNumber(row.c0) && MathIsValidNumber(row.previous_center) &&
      MathIsValidNumber(row.current_center) && MathIsValidNumber(row.q0) &&
      MathIsValidNumber(row.current_q) &&
      MathIsValidNumber(row.current_q_ratio) &&
      MathIsValidNumber(row.discovery_cell_price) &&
      MathIsValidNumber(row.broker_tick_size) &&
      MathIsValidNumber(row.support0_q) &&
      MathIsValidNumber(row.current_support_q) &&
      MathIsValidNumber(row.revision_q) &&
      MathIsValidNumber(row.cumulative_signed_revision_q) &&
      MathIsValidNumber(row.cumulative_absolute_revision_q) &&
      MathIsValidNumber(row.minimum_support_q) &&
      MathIsValidNumber(row.maximum_support_q) &&
      MathIsValidNumber(row.regression_sum_x) &&
      MathIsValidNumber(row.regression_sum_y) &&
      MathIsValidNumber(row.regression_sum_x2) &&
      MathIsValidNumber(row.regression_sum_xy) &&
      MathIsValidNumber(row.lots_before) && MathIsValidNumber(row.lots_after) &&
      MathIsValidNumber(row.weighted_entry_sum);
}

bool LP_RevmaTelemetryLotsMatchAtoms(const double lots, const int atoms)
{
   if(!MathIsValidNumber(lots) || lots < 0.0 || atoms < 0)
      return false;
   return NormalizeDouble(lots, 2) ==
      NormalizeDouble((double)atoms * LP_REVMA_DISCOVERY_ATOM_LOTS, 2);
}

bool LP_RevmaTelemetryBirthBucketValid(const string value)
{
   return LP_RevmaDiscoveryBirthBucketValid(value);
}

string LP_RevmaTelemetryExpectedBirthBucket(
   const int direction,
   const long p0_ticks,
   const long c0_ticks)
{
   return LP_RevmaDiscoveryBirthBucket(direction, p0_ticks, c0_ticks);
}

bool LP_RevmaTelemetryCenterAlignmentValid(const string value)
{
   return value == "CENTER_ALIGNED_V1" ||
      value == "NOT_APPLICABLE_V1";
}

bool LP_RevmaTelemetryMeshAndTicksValid(
   const LP_RevmaDiscoveryTransitionRow &row)
{
   LP_RevmaDiscoveryMesh mesh;
   LP_ResetRevmaDiscoveryMesh(mesh);
   long p0_ticks = 0;
   long c0_ticks = 0;
   if(!LP_RevmaBuildDiscoveryMesh(row.q0, row.broker_tick_size, mesh) ||
      !LP_RevmaPriceToTicks(row.p0, row.broker_tick_size, p0_ticks) ||
      !LP_RevmaPriceToTicks(row.c0, row.broker_tick_size, c0_ticks) ||
      row.discovery_cell_ticks != mesh.discovery_cell_ticks ||
      NormalizeDouble(row.discovery_cell_price, 12) !=
         NormalizeDouble(mesh.discovery_cell_price, 12) ||
      row.p0_ticks != p0_ticks || row.c0_ticks != c0_ticks)
      return false;
   if(row.previous_center > 0.0)
   {
      long ticks = 0;
      if(!LP_RevmaPriceToTicks(row.previous_center,
         row.broker_tick_size, ticks) || ticks != row.previous_center_ticks)
         return false;
   }
   if(row.current_center > 0.0)
   {
      long ticks = 0;
      if(!LP_RevmaPriceToTicks(row.current_center,
         row.broker_tick_size, ticks) || ticks != row.current_center_ticks)
         return false;
   }
   return true;
}

bool LP_RevmaTelemetryCenterSnapshotValid(
   const LP_RevmaDiscoveryTransitionRow &row)
{
   if(row.p0 <= 0.0 || row.c0 <= 0.0 || row.previous_center <= 0.0 ||
      row.current_center <= 0.0 || row.q0 <= 0.0)
      return false;
   double expected_support0 = (double)row.direction *
      (row.c0 - row.p0) / row.q0;
   double expected_current_support = (double)row.direction *
      (row.current_center - row.p0) / row.q0;
   double expected_revision = (double)row.direction *
      (row.current_center - row.c0) / row.q0;
   return MathIsValidNumber(expected_support0) &&
      MathIsValidNumber(expected_current_support) &&
      MathIsValidNumber(expected_revision) &&
      NormalizeDouble(row.support0_q, 12) ==
         NormalizeDouble(expected_support0, 12) &&
      NormalizeDouble(row.current_support_q, 12) ==
         NormalizeDouble(expected_current_support, 12) &&
      NormalizeDouble(row.revision_q, 12) ==
         NormalizeDouble(expected_revision, 12) &&
      row.support0_sign == LP_RevmaDirectedSupportSign(
         row.direction, row.c0_ticks, row.p0_ticks) &&
      row.previous_support_sign == LP_RevmaDirectedSupportSign(
         row.direction, row.previous_center_ticks, row.p0_ticks) &&
       row.current_support_sign == LP_RevmaDirectedSupportSign(
          row.direction, row.current_center_ticks, row.p0_ticks);
}

bool LP_RevmaTelemetryTimestampAgeValid(
   const datetime source_m1_time,
   const datetime event_m1_time,
   const int age_minutes)
{
   if(event_m1_time == 0)
      return age_minutes == 0;
   long age_seconds = (long)source_m1_time - (long)event_m1_time;
   return event_m1_time > 0 && age_seconds >= 0 &&
      age_seconds / 60 <= 2147483647 &&
      age_minutes == (int)(age_seconds / 60);
}

bool LP_RevmaTelemetryPathSnapshotValid(
   const LP_RevmaDiscoveryTransitionRow &row)
{
   long frontier_span = 0;
   long frontier_total = 0;
   long latest_delta = 0;
   long current_cell_absolute = 0;
   long doubled_reversal_crossings = 0;
   long reconstructed_total_cell_path = 0;
   long expected_adverse_frontier = 0;
   long expected_favorable_frontier = 0;
   if(row.current_cell_index > LP_REVMA_GEOMETRY_ABS_LIMIT ||
      row.current_cell_index < -LP_REVMA_GEOMETRY_ABS_LIMIT)
      return false;
   current_cell_absolute = row.current_cell_index < 0 ?
      -row.current_cell_index : row.current_cell_index;
   if(!LP_RevmaTelemetrySafeMinorAdd(row.matched_reversal_crossings,
         row.matched_reversal_crossings, doubled_reversal_crossings) ||
      !LP_RevmaTelemetrySafeMinorAdd(current_cell_absolute,
         doubled_reversal_crossings, reconstructed_total_cell_path))
      return false;
   if(row.total_cell_path < 0 || row.completed_cell_crossings < 0 ||
      row.total_cell_path != row.completed_cell_crossings ||
      row.total_cell_path != reconstructed_total_cell_path ||
      row.unfilled_jump_cells < 0 ||
      row.unfilled_jump_cells > row.total_cell_path ||
      row.matched_reversal_crossings < 0 ||
      row.matched_reversal_crossings > row.total_cell_path ||
      row.adverse_frontier_expansions < 0 ||
      row.favorable_frontier_expansions < 0 || row.max_cell_jump < 0 ||
      row.last_movement_sign < -1 || row.last_movement_sign > 1 ||
      row.max_cell_jump > row.total_cell_path ||
      row.new_extreme_count < 0 ||
      row.new_extreme_count > row.total_cell_path ||
      row.minimum_cell_index > 0 || row.maximum_cell_index < 0 ||
      row.minimum_cell_index > row.previous_cell_index ||
      row.previous_cell_index > row.maximum_cell_index ||
      row.minimum_cell_index > row.current_cell_index ||
      row.current_cell_index > row.maximum_cell_index ||
      current_cell_absolute > row.total_cell_path ||
      !LP_RevmaTelemetrySafeMinorAdd(row.maximum_cell_index,
         -row.minimum_cell_index, frontier_span) || frontier_span < 0 ||
      !LP_RevmaTelemetrySafeMinorAdd(row.adverse_frontier_expansions,
         row.favorable_frontier_expansions, frontier_total) ||
      frontier_total != frontier_span ||
      !LP_RevmaTelemetrySafeMinorAdd(row.current_cell_index,
         -row.previous_cell_index, latest_delta) ||
      MathAbs(latest_delta) > row.max_cell_jump)
      return false;
   if(row.direction == LP_SIDE_LONG)
   {
      expected_adverse_frontier = -row.minimum_cell_index;
      expected_favorable_frontier = row.maximum_cell_index;
   }
   else if(row.direction == LP_SIDE_SHORT)
   {
      expected_adverse_frontier = row.maximum_cell_index;
      expected_favorable_frontier = -row.minimum_cell_index;
   }
   else
      return false;
   if(row.adverse_frontier_expansions != expected_adverse_frontier ||
      row.favorable_frontier_expansions != expected_favorable_frontier ||
      (latest_delta != 0 &&
       row.last_movement_sign != LP_RevmaSignLong(latest_delta)) ||
      ((row.matched_reversal_crossings == 0) !=
         (row.last_reversal_m1 == 0)))
      return false;
   if(row.total_cell_path == 0 &&
      (row.previous_cell_index != 0 || row.current_cell_index != 0 ||
       row.minimum_cell_index != 0 || row.maximum_cell_index != 0 ||
       row.unfilled_jump_cells != 0 || row.matched_reversal_crossings != 0 ||
       row.adverse_frontier_expansions != 0 ||
       row.favorable_frontier_expansions != 0 || row.max_cell_jump != 0 ||
       row.last_movement_sign != 0 ||
       row.new_extreme_count != 0 || row.last_reversal_m1 != 0 ||
       row.time_since_last_reversal_minutes != 0))
      return false;
   if(row.total_cell_path > 0 &&
      (row.max_cell_jump < 1 || frontier_span < 1 ||
       row.last_movement_sign == 0 ||
       row.new_extreme_count < 1 ||
       row.new_extreme_count > frontier_span))
      return false;
   return LP_RevmaTelemetryTimestampAgeValid(row.source_m1_time,
      row.last_reversal_m1, row.time_since_last_reversal_minutes);
}

bool LP_RevmaTelemetryCenterEvidenceValid(
   const LP_RevmaDiscoveryTransitionRow &row)
{
   if(!LP_RevmaTelemetryCenterSnapshotValid(row) ||
      row.center_alignment != (row.center_applicable ?
         "CENTER_ALIGNED_V1" : "NOT_APPLICABLE_V1") ||
      row.center_applicable != (row.support0_sign > 0) ||
      row.support0_sign < -1 || row.support0_sign > 1 ||
      row.previous_support_sign < -1 || row.previous_support_sign > 1 ||
      row.current_support_sign < -1 || row.current_support_sign > 1 ||
      row.center_update_count < 0 || row.center_observation_index < 0 ||
      row.center_not_available_count < 0 ||
      row.center_update_count > row.center_observation_index ||
      row.center_not_available_count > row.center_observation_index ||
      (long)row.center_update_count +
         (long)row.center_not_available_count >
            (long)row.center_observation_index ||
      row.blocked_adverse_count < 0 || row.center_staleness_minutes < 0 ||
      row.minimum_support_q > row.maximum_support_q ||
      row.support0_q < row.minimum_support_q ||
      row.support0_q > row.maximum_support_q ||
      row.current_support_q < row.minimum_support_q ||
      row.current_support_q > row.maximum_support_q ||
      row.cumulative_absolute_revision_q < 0.0 ||
      row.cumulative_absolute_revision_q + 0.000000000001 <
         MathAbs(row.cumulative_signed_revision_q) ||
      NormalizeDouble(row.cumulative_signed_revision_q, 12) !=
         NormalizeDouble(row.revision_q, 12) ||
      (row.branch != LP_REVMA_BRANCH_C &&
       (row.center_latched || row.center_latch_time != 0 ||
        row.blocked_adverse_count != 0)) ||
      (!row.center_applicable &&
       (row.center_latched || row.center_latch_time != 0 ||
        row.blocked_adverse_count != 0)) ||
      (row.blocked_adverse_count > 0 && !row.center_latched) ||
      (row.center_applicable && row.current_support_sign <= 0 &&
       row.branch == LP_REVMA_BRANCH_C && !row.center_latched) ||
      (row.center_latched &&
       (row.branch != LP_REVMA_BRANCH_C || !row.center_applicable ||
        row.support0_sign <= 0 || row.center_latch_time <= 0 ||
        row.center_latch_time > row.source_m1_time)))
      return false;
   if(row.center_update_count == 0)
   {
      return row.previous_center_ticks == row.c0_ticks &&
         row.current_center_ticks == row.c0_ticks &&
         NormalizeDouble(row.previous_center, 12) ==
            NormalizeDouble(row.c0, 12) &&
         NormalizeDouble(row.current_center, 12) ==
            NormalizeDouble(row.c0, 12) &&
         row.previous_support_sign == row.support0_sign &&
         row.current_support_sign == row.support0_sign &&
         NormalizeDouble(row.current_support_q, 12) ==
            NormalizeDouble(row.support0_q, 12) &&
         NormalizeDouble(row.revision_q, 12) == 0.0 &&
         NormalizeDouble(row.cumulative_signed_revision_q, 12) == 0.0 &&
         NormalizeDouble(row.cumulative_absolute_revision_q, 12) == 0.0 &&
         NormalizeDouble(row.minimum_support_q, 12) ==
            NormalizeDouble(row.support0_q, 12) &&
         NormalizeDouble(row.maximum_support_q, 12) ==
            NormalizeDouble(row.support0_q, 12) &&
         !row.center_latched && row.center_latch_time == 0 &&
         row.blocked_adverse_count == 0 &&
         row.center_staleness_minutes == row.grid_age_minutes &&
         row.first_center_update_observation_index == 0 &&
         row.last_center_update_observation_index == 0 &&
         row.first_center_update_q_event_index == 0 &&
         row.last_center_update_q_event_index == 0 &&
         row.first_center_update_time == 0 &&
         row.last_center_update_time == 0 &&
         NormalizeDouble(row.regression_sum_x, 12) == 0.0 &&
         NormalizeDouble(row.regression_sum_y, 12) == 0.0 &&
         NormalizeDouble(row.regression_sum_x2, 12) == 0.0 &&
         NormalizeDouble(row.regression_sum_xy, 12) == 0.0;
   }
   long staleness_seconds = (long)row.source_m1_time -
      (long)row.last_center_update_time;
   return row.first_center_update_observation_index > 0 &&
      row.first_center_update_observation_index <=
         row.last_center_update_observation_index &&
      (row.center_update_count == 1 ||
       row.first_center_update_observation_index <
          row.last_center_update_observation_index) &&
      row.last_center_update_observation_index <=
         row.center_observation_index &&
      row.first_center_update_q_event_index > 0 &&
      row.first_center_update_q_event_index <=
         row.last_center_update_q_event_index &&
      row.last_center_update_q_event_index <= row.q_event_count &&
      row.first_center_update_time > 0 &&
      row.first_center_update_time <= row.last_center_update_time &&
      (row.center_update_count == 1 ||
       row.first_center_update_time < row.last_center_update_time) &&
      row.last_center_update_time <= row.source_m1_time &&
      (!row.center_latched ||
       (row.center_latch_time >= row.first_center_update_time &&
        row.center_latch_time <= row.last_center_update_time)) &&
      row.regression_sum_x > 0.0 && row.regression_sum_x2 > 0.0 &&
      staleness_seconds >= 0 && staleness_seconds / 60 <= 2147483647 &&
      row.center_staleness_minutes == (int)(staleness_seconds / 60);
}

bool LP_RevmaTelemetryGridSnapshotEvidenceValid(
   const LP_RevmaDiscoveryTransitionRow &row)
{
   long add_count = 0;
   long current_adverse_excursion = 0;
   if(!LP_RevmaTelemetrySafeMinorAdd((long)row.adverse_add_count,
      (long)row.favorable_add_count, add_count) ||
      row.liability_minor < -LP_REVMA_GEOMETRY_ABS_LIMIT)
      return false;
   if(row.liability_minor < 0)
      current_adverse_excursion = -row.liability_minor;
   return LP_RevmaTelemetryBirthBucketValid(row.birth_bucket) &&
      row.birth_bucket == LP_RevmaTelemetryExpectedBirthBucket(
         row.direction, row.p0_ticks, row.c0_ticks) &&
      LP_RevmaTelemetryCenterAlignmentValid(row.center_alignment) &&
      row.q_profile_id == LP_RevmaQProfileId(
         LP_REVMA_DISCOVERY_Q_PROFILE, LP_REVMA_DISCOVERY_MAX_M1_BARS) &&
      row.p0 > 0.0 && row.current_price > 0.0 && row.c0 > 0.0 &&
      row.q0 > 0.0 && row.current_q > 0.0 &&
      row.discovery_cell_ticks > 0 && row.discovery_cell_price > 0.0 &&
      row.broker_tick_size > 0.0 && LP_RevmaTelemetryMeshAndTicksValid(row) &&
      LP_RevmaTelemetryCenterEvidenceValid(row) &&
      LP_RevmaTelemetryPathSnapshotValid(row) &&
      row.p0_ticks > 0 && row.c0_ticks > 0 &&
      row.a_g_candidate_minor > 0 && row.a_g_minor > 0 &&
      row.reservation_minor > 0 && row.q_cash_minor > 0 &&
      row.prospective_reservation_minor > 0 &&
      row.prospective_q_cash_minor > 0 && row.margin_minor > 0 &&
      row.incremental_margin_minor == 0 &&
      row.liquidation_cost_minor >= 0 &&
      row.maximum_adverse_excursion_minor >=
         current_adverse_excursion &&
      row.initial_history_boundary > 0 &&
      row.initial_history_boundary <= row.source_m1_time &&
      row.grid_age_minutes >= 0 && row.time_underwater_minutes >= 0 &&
      row.time_underwater_minutes <= row.grid_age_minutes &&
      LP_RevmaTelemetryTimestampAgeValid(row.source_m1_time,
         row.last_positive_liquidation_opportunity_m1,
         row.time_since_positive_liquidation_opportunity_minutes) &&
      row.weighted_entry_sum > 0.0 && row.atoms_before >= 1 &&
      row.adverse_add_count >= 0 && row.favorable_add_count >= 0 &&
      add_count == (long)row.atoms_before - 1;
}

bool LP_RevmaTelemetryEconomicInfeasibilityReasonValid(
   const string reason)
{
   return reason ==
         "fill_reconciliation_capacity_overrun_blocks_new_exposure" ||
       reason == "capital_budget_capacity_exhausted" ||
       reason == "projected_equity_exhausted_by_immediate_liability" ||
       reason == "projected_post_liquidation_margin_capacity_exhausted" ||
       reason == "real_execution_two_atom_envelope_exhausted" ||
       reason == "broker_session_closed_before_order_send";
}

bool LP_RevmaTelemetryShadowInfeasibilityReasonValid(
   const string reason)
{
   return reason ==
         "fill_reconciliation_capacity_overrun_blocks_new_exposure" ||
      reason == "capital_budget_capacity_exhausted" ||
      reason == "projected_equity_exhausted_by_immediate_liability" ||
      reason == "projected_post_liquidation_margin_capacity_exhausted";
}

bool LP_RevmaTelemetryGridMoneyEvidenceValid(
   const LP_RevmaDiscoveryTransitionRow &row)
{
   bool admitted_candidate =
      row.event_type == LP_REVMA_TELEMETRY_BRANCH_BIRTH ||
      row.event_type == LP_REVMA_TELEMETRY_ATOM_ADMISSION;
   bool candidate_observation = admitted_candidate ||
      row.event_type == LP_REVMA_TELEMETRY_FIRST_DIVERGENCE ||
      row.event_type == LP_REVMA_TELEMETRY_CENTER_BLOCKED_ADVERSE ||
      row.event_type ==
         LP_REVMA_TELEMETRY_FAVORABLE_ELIGIBLE_AFTER_LATCH ||
      row.event_type == LP_REVMA_TELEMETRY_FIRST_INFEASIBILITY ||
      row.event_type == LP_REVMA_TELEMETRY_CANDIDATE_REJECTION;
   bool terminal_grid = row.event_type == LP_REVMA_TELEMETRY_GRID_CLOSE ||
      row.event_type == LP_REVMA_TELEMETRY_GRID_TERMINAL_SNAPSHOT;
   int current_atoms = terminal_grid ? row.atoms_before :
      (admitted_candidate ? row.atoms_after : row.atoms_before);
   if(current_atoms < 0 || row.a_g_candidate_minor <= 0 ||
      row.a_g_minor <= 0 || row.margin_minor < 0 ||
      row.incremental_margin_minor < 0)
      return false;
   int current_reserved_atoms = current_atoms <= 0 ? 0 :
      (row.branch == LP_REVMA_BRANCH_R ? 2 :
       (current_atoms < 2 ? 2 : current_atoms));
   int prospective_atoms = current_atoms;
   if(candidate_observation)
   {
      if(admitted_candidate)
         prospective_atoms = row.atoms_after;
      else
      {
         if(row.atoms_before >= 2147483647)
            return false;
         prospective_atoms = row.atoms_before + 1;
      }
   }
   int prospective_reserved_atoms = prospective_atoms <= 0 ? 0 :
      (row.branch == LP_REVMA_BRANCH_R ? 2 :
       (prospective_atoms < 2 ? 2 : prospective_atoms));
   long expected_reservation = 0;
   long expected_q_cash = 0;
   long expected_current_candidate_reservation = 0;
   long expected_prospective_reservation = 0;
   long expected_prospective_q_cash = 0;
   if(!LP_RevmaTelemetrySafeMinorMultiply(row.a_g_minor,
         current_reserved_atoms, expected_reservation) ||
      !LP_RevmaTelemetrySafeMinorMultiply(row.a_g_minor,
         current_atoms, expected_q_cash) ||
      !LP_RevmaTelemetrySafeMinorMultiply(row.a_g_candidate_minor,
         current_reserved_atoms, expected_current_candidate_reservation) ||
      !LP_RevmaTelemetrySafeMinorMultiply(row.a_g_candidate_minor,
         prospective_reserved_atoms, expected_prospective_reservation) ||
      !LP_RevmaTelemetrySafeMinorMultiply(row.a_g_candidate_minor,
         prospective_atoms, expected_prospective_q_cash))
      return false;
   bool expected_overrun = expected_reservation >
      expected_current_candidate_reservation;
   long expected_overrun_minor = expected_overrun ?
      expected_reservation - expected_current_candidate_reservation : 0;
   return row.reservation_minor == expected_reservation &&
      row.q_cash_minor == expected_q_cash &&
      row.prospective_reservation_minor ==
         expected_prospective_reservation &&
      row.prospective_q_cash_minor == expected_prospective_q_cash &&
      row.reservation_overrun == expected_overrun &&
      row.reservation_overrun_minor == expected_overrun_minor &&
      ((current_atoms == 0 && row.margin_minor == 0) ||
       (current_atoms > 0 && row.margin_minor > 0)) &&
      ((candidate_observation && row.incremental_margin_minor > 0) ||
      (!candidate_observation && row.incremental_margin_minor == 0));
}

bool LP_RevmaTelemetryTerminalProjectionValid(
   const LP_RevmaDiscoveryTransitionRow &row)
{
   LP_RevmaTerminalGridProjection projection;
   LP_ResetRevmaTerminalGridProjection(projection);
   projection.valid = true;
   projection.branch = row.branch;
   projection.symbol_id = row.symbol_id;
   projection.branch_grid_id = row.branch_grid_id;
   projection.branch_cycle_id = row.branch_cycle_id;
   projection.grid_generation = row.grid_generation;
   projection.direction = row.direction;
   projection.terminal_source_m1_time = row.source_m1_time;
   projection.boundary_class = row.event_type ==
      LP_REVMA_TELEMETRY_GRID_CLOSE ? "confirmed_flat_close" :
      "run_boundary_unresolved";
   projection.atoms_before = row.atoms_before;
   projection.atoms_after = row.atoms_after;
   projection.lots_before = row.lots_before;
   projection.lots_after = row.lots_after;
   projection.reservation_minor = row.reservation_minor;
   projection.q_cash_minor = row.q_cash_minor;
   projection.margin_minor = row.margin_minor;
   projection.harvest_minor = row.harvest_minor;
   projection.nonharvest_minor = row.nonharvest_minor;
   projection.liability_minor = row.liability_minor;
   projection.cost_minor = row.liquidation_cost_minor;
   projection.maximum_adverse_excursion_minor =
      row.maximum_adverse_excursion_minor;
   projection.grid_age_minutes = row.grid_age_minutes;
   projection.time_underwater_minutes = row.time_underwater_minutes;
   projection.close_owner = row.close_owner;
   projection.origin_terminal_reason = row.grid_terminal_reason;
   projection.terminal_internal_state_hash =
      row.terminal_internal_state_hash;
   projection.projection_hash =
      LP_RevmaTerminalGridProjectionIdentity(projection);
   return LP_RevmaTerminalGridProjectionValid(projection) &&
      projection.projection_hash == row.terminal_projection_hash;
}

string LP_RevmaCycleStartEventShapeFailureReason(
   const LP_RevmaDiscoveryTransitionRow &row)
{
   long expected_budget_minor = 0;
   if(!LP_RevmaDiscoveryTelemetryEventValid(row.event_type))
      return "event_type_invalid";
   if(!LP_RevmaDiscoveryBranchValid(row.branch))
      return "branch_invalid";
   if(row.branch_cycle_id == 0)
      return "branch_cycle_id_zero";
   if(row.account_cycle_id == 0)
      return "account_cycle_id_zero";
   if(row.source_m1_time <= 0)
      return "source_m1_time_invalid";
   if(((long)row.source_m1_time % 60) != 0)
      return "source_m1_time_not_minute_aligned";
   if(row.event_time < row.source_m1_time)
      return "event_time_before_source_m1";
   if(row.concentration_q_cash_minor < 0)
      return "concentration_q_cash_negative";
   if((row.concentration_q_cash_minor == 0) !=
      (row.concentration_currency_id == -1))
      return "concentration_currency_zero_pair_mismatch";
   if(row.concentration_currency_id < -1 ||
      row.concentration_currency_id >= LP_CCY_COUNT)
      return "concentration_currency_invalid";
   if(!MathIsValidNumber(row.p0))
      return "p0_not_finite";
   if(!MathIsValidNumber(row.stress_price))
      return "stress_price_not_finite";
   if(!MathIsValidNumber(row.fill_price))
      return "fill_price_not_finite";
   if(!MathIsValidNumber(row.current_price))
      return "current_price_not_finite";
   if(!MathIsValidNumber(row.c0))
      return "c0_not_finite";
   if(!MathIsValidNumber(row.previous_center))
      return "previous_center_not_finite";
   if(!MathIsValidNumber(row.current_center))
      return "current_center_not_finite";
   if(!MathIsValidNumber(row.q0))
      return "q0_not_finite";
   if(!MathIsValidNumber(row.current_q))
      return "current_q_not_finite";
   if(!MathIsValidNumber(row.current_q_ratio))
      return "current_q_ratio_not_finite";
   if(!MathIsValidNumber(row.discovery_cell_price))
      return "discovery_cell_price_not_finite";
   if(!MathIsValidNumber(row.broker_tick_size))
      return "broker_tick_size_not_finite";
   if(!MathIsValidNumber(row.support0_q))
      return "support0_q_not_finite";
   if(!MathIsValidNumber(row.current_support_q))
      return "current_support_q_not_finite";
   if(!MathIsValidNumber(row.revision_q))
      return "revision_q_not_finite";
   if(!MathIsValidNumber(row.cumulative_signed_revision_q))
      return "cumulative_signed_revision_q_not_finite";
   if(!MathIsValidNumber(row.cumulative_absolute_revision_q))
      return "cumulative_absolute_revision_q_not_finite";
   if(!MathIsValidNumber(row.minimum_support_q))
      return "minimum_support_q_not_finite";
   if(!MathIsValidNumber(row.maximum_support_q))
      return "maximum_support_q_not_finite";
   if(!MathIsValidNumber(row.regression_sum_x))
      return "regression_sum_x_not_finite";
   if(!MathIsValidNumber(row.regression_sum_y))
      return "regression_sum_y_not_finite";
   if(!MathIsValidNumber(row.regression_sum_x2))
      return "regression_sum_x2_not_finite";
   if(!MathIsValidNumber(row.regression_sum_xy))
      return "regression_sum_xy_not_finite";
   if(!MathIsValidNumber(row.lots_before))
      return "lots_before_not_finite";
   if(!MathIsValidNumber(row.lots_after))
      return "lots_after_not_finite";
   if(!MathIsValidNumber(row.weighted_entry_sum))
      return "weighted_entry_sum_not_finite";
   if(row.budget_minor <= 0)
      return "budget_minor_nonpositive";
   if(row.equity_reference_minor <= 0)
      return "equity_reference_minor_nonpositive";
   if(!LP_RevmaDiscoveryCapitalBudgetMinor(row.equity_reference_minor,
         expected_budget_minor))
      return "capital_budget_formula_invalid";
   if(row.budget_minor != expected_budget_minor)
      return "budget_minor_formula_mismatch";
   if(row.symbol_id < -1 || row.symbol_id >= LP_SYMBOL_COUNT)
      return "symbol_id_invalid";
   if(row.grid_generation != 0)
      return "cycle_start_grid_generation_nonzero";
   if(row.atoms_before < 0)
      return "atoms_before_negative";
   if(row.atoms_after < 0)
      return "atoms_after_negative";
   if(!LP_RevmaTelemetryLotsMatchAtoms(row.lots_before, row.atoms_before))
      return "lots_before_atom_mismatch";
   if(!LP_RevmaTelemetryLotsMatchAtoms(row.lots_after, row.atoms_after))
      return "lots_after_atom_mismatch";
   if(row.terminal_internal_state_hash != 0)
      return "terminal_internal_state_hash_present";
   if(row.terminal_projection_hash != 0)
      return "terminal_projection_hash_present";
   if(row.grid_terminal_reason != "")
      return "grid_terminal_reason_present";
   if(row.symbol_id != -1)
      return "symbol_id_not_aggregate";
   if(row.branch_grid_id != 0)
      return "branch_grid_id_nonzero";
   if(row.atoms_before != 0)
      return "atoms_before_not_zero";
   if(row.atoms_after != 0)
      return "atoms_after_not_zero";
   if(row.decision != "OPEN")
      return "decision_not_open";
   if(row.reason == "")
      return "reason_empty";
   return "";
}

bool LP_RevmaTelemetryEventShapeValid(const LP_RevmaDiscoveryTransitionRow &row)
{
   if(row.event_type == LP_REVMA_TELEMETRY_CYCLE_START)
      return LP_RevmaCycleStartEventShapeFailureReason(row) == "";
   long expected_budget_minor = 0;
   if(!LP_RevmaDiscoveryTelemetryEventValid(row.event_type) ||
      !LP_RevmaDiscoveryBranchValid(row.branch) ||
       row.branch_cycle_id == 0 || row.account_cycle_id == 0 ||
       row.source_m1_time <= 0 ||
       ((long)row.source_m1_time % 60) != 0 ||
       row.event_time < row.source_m1_time ||
       row.concentration_q_cash_minor < 0 ||
       ((row.concentration_q_cash_minor == 0) !=
        (row.concentration_currency_id == -1)) ||
       row.concentration_currency_id < -1 ||
       row.concentration_currency_id >= LP_CCY_COUNT ||
       !LP_RevmaTelemetryFiniteTransition(row))
      return false;
   if(row.budget_minor <= 0 || row.equity_reference_minor <= 0 ||
      !LP_RevmaDiscoveryCapitalBudgetMinor(row.equity_reference_minor,
         expected_budget_minor) || row.budget_minor != expected_budget_minor)
      return false;
   bool aggregate_branch_event = row.symbol_id == -1 &&
      row.event_type != LP_REVMA_TELEMETRY_FAILURE &&
      row.event_type != LP_REVMA_TELEMETRY_CYCLE_START;
   if(!aggregate_branch_event &&
      row.event_type != LP_REVMA_TELEMETRY_FAILURE &&
      row.event_type != LP_REVMA_TELEMETRY_CYCLE_START &&
      (row.signal_identity_hash == 0 ||
       row.shared_observation_snapshot_hash == 0 ||
       row.strategy_state_identity_hash == 0 ||
       row.q_day_count <= 0 ||
       row.q_event_count <= 0 || row.q_event_count > 2147483647 ||
       row.reconstruction_epoch == 0 ||
       row.q0 <= 0.0 || row.current_q <= 0.0 ||
       NormalizeDouble(row.current_q_ratio, 12) !=
          NormalizeDouble(row.current_q / row.q0, 12)))
      return false;
   if(aggregate_branch_event &&
      (row.signal_identity_hash == 0 ||
       row.shared_observation_snapshot_hash == 0 ||
       row.strategy_state_identity_hash == 0 || row.q_day_count != 0 ||
       row.q_event_count != 0 || row.reconstruction_epoch != 0 ||
       row.q0 != 0.0 || row.current_q != 0.0 ||
       row.current_q_ratio != 0.0))
      return false;
   bool grid_event = row.event_type == LP_REVMA_TELEMETRY_BRANCH_BIRTH ||
      row.event_type == LP_REVMA_TELEMETRY_ATOM_ADMISSION ||
      row.event_type == LP_REVMA_TELEMETRY_FIRST_DIVERGENCE ||
      row.event_type == LP_REVMA_TELEMETRY_CENTER_LATCH ||
      row.event_type == LP_REVMA_TELEMETRY_CENTER_BLOCKED_ADVERSE ||
      row.event_type == LP_REVMA_TELEMETRY_FAVORABLE_ELIGIBLE_AFTER_LATCH ||
      row.event_type == LP_REVMA_TELEMETRY_FIRST_INFEASIBILITY ||
      row.event_type == LP_REVMA_TELEMETRY_GRID_CLOSE ||
      row.event_type == LP_REVMA_TELEMETRY_GRID_TERMINAL_SNAPSHOT ||
      row.event_type == LP_REVMA_TELEMETRY_CANDIDATE_REJECTION;
   if(grid_event && (row.branch_grid_id == 0 || row.symbol_id < 0 ||
      row.symbol_id >= LP_SYMBOL_COUNT ||
      row.grid_generation <= 0 ||
       (row.direction != LP_SIDE_LONG && row.direction != LP_SIDE_SHORT)))
      return false;
   if(grid_event && !LP_RevmaTelemetryGridMoneyEvidenceValid(row))
      return false;
   if(!grid_event && (row.symbol_id < -1 || row.symbol_id >= LP_SYMBOL_COUNT ||
      row.grid_generation != 0))
      return false;
   if(row.atoms_before < 0 || row.atoms_after < 0 ||
      !LP_RevmaTelemetryLotsMatchAtoms(row.lots_before, row.atoms_before) ||
      !LP_RevmaTelemetryLotsMatchAtoms(row.lots_after, row.atoms_after))
      return false;
   bool inventory_unchanged = row.atoms_before == row.atoms_after &&
      row.lots_before == row.lots_after;
   bool candidate_evidence_complete =
      LP_RevmaTelemetryBirthBucketValid(row.birth_bucket) &&
      row.birth_bucket == LP_RevmaTelemetryExpectedBirthBucket(
         row.direction, row.p0_ticks, row.c0_ticks) &&
      LP_RevmaTelemetryCenterAlignmentValid(row.center_alignment) &&
      row.q_profile_id == LP_RevmaQProfileId(
         LP_REVMA_DISCOVERY_Q_PROFILE, LP_REVMA_DISCOVERY_MAX_M1_BARS) &&
      row.center_alignment == (row.center_applicable ?
         "CENTER_ALIGNED_V1" : "NOT_APPLICABLE_V1") &&
      row.center_applicable == (row.support0_sign > 0) &&
      row.p0 > 0.0 && row.stress_price > 0.0 && row.fill_price > 0.0 &&
      row.current_price > 0.0 && row.c0 > 0.0 && row.q0 > 0.0 &&
      row.current_q > 0.0 && row.discovery_cell_ticks > 0 &&
      row.discovery_cell_price > 0.0 && row.broker_tick_size > 0.0 &&
      LP_RevmaTelemetryMeshAndTicksValid(row) &&
      LP_RevmaTelemetryCenterSnapshotValid(row) && row.p0_ticks > 0 &&
      row.c0_ticks > 0 && row.a_g_candidate_minor > 0 &&
      row.a_g_minor > 0 && row.reservation_minor >= 0 &&
      row.q_cash_minor >= 0 && row.prospective_reservation_minor > 0 &&
      row.prospective_q_cash_minor > 0 && row.margin_minor >= 0 &&
      row.incremental_margin_minor > 0 &&
      row.incremental_close_cost_minor >= 0 &&
      row.incremental_liquidation_minor <=
         -row.incremental_close_cost_minor &&
      row.initial_history_boundary > 0 &&
      row.initial_history_boundary <= row.source_m1_time &&
      row.matched_snapshot_hash != 0 &&
      LP_RevmaTelemetryCenterEvidenceValid(row) &&
      LP_RevmaTelemetryPathSnapshotValid(row) &&
      row.grid_age_minutes >= 0 &&
      row.time_underwater_minutes >= 0 &&
      row.time_underwater_minutes <= row.grid_age_minutes &&
      row.time_since_last_reversal_minutes >= 0 &&
      LP_RevmaTelemetryTimestampAgeValid(row.source_m1_time,
         row.last_positive_liquidation_opportunity_m1,
         row.time_since_positive_liquidation_opportunity_minutes);
   bool grid_snapshot_evidence_complete =
      LP_RevmaTelemetryGridSnapshotEvidenceValid(row);
   bool terminal_grid_event =
      row.event_type == LP_REVMA_TELEMETRY_GRID_CLOSE ||
      row.event_type == LP_REVMA_TELEMETRY_GRID_TERMINAL_SNAPSHOT;
   if(terminal_grid_event != (row.terminal_internal_state_hash != 0))
      return false;
   if(terminal_grid_event != (row.terminal_projection_hash != 0) ||
      (terminal_grid_event &&
       !LP_RevmaTelemetryTerminalProjectionValid(row)))
      return false;
   bool terminal_owner_reason_shape =
      LP_RevmaDiscoveryTerminalReasonOwnerConsistent(
         row.grid_terminal_reason, row.close_owner);
   if((terminal_grid_event && !terminal_owner_reason_shape) ||
      (!terminal_grid_event && row.grid_terminal_reason != ""))
      return false;
   if(row.event_type == LP_REVMA_TELEMETRY_CYCLE_START)
      return row.symbol_id == -1 && row.branch_grid_id == 0 &&
         row.atoms_before == 0 && row.atoms_after == 0 &&
         row.budget_minor > 0 && row.equity_reference_minor > 0 &&
         row.decision == "OPEN" && row.reason != "";
   if(row.event_type == LP_REVMA_TELEMETRY_BRANCH_BIRTH)
      return row.signal_identity_hash != 0 && row.candidate_identity != 0 &&
          candidate_evidence_complete &&
          row.candidate_type == LP_REVMA_DISCOVERY_CANDIDATE_BIRTH &&
           ((row.branch == LP_REVMA_BRANCH_R && row.shared_origin_id == 0 &&
             row.opportunity_id == 0) ||
            (row.branch != LP_REVMA_BRANCH_R && row.shared_origin_id != 0)) &&
          row.pre_candidate_state_hash != 0 &&
          row.direction != LP_SIDE_NONE && row.atoms_before == 0 &&
          row.atoms_after == 1 && row.p0 > 0.0 && row.q0 > 0.0 &&
          row.fill_price > 0.0 && row.discovery_cell_ticks > 0 &&
          row.grid_age_minutes == 0 && row.adverse_add_count == 0 &&
          row.favorable_add_count == 0 &&
          row.decision == "ADMIT";
   if(row.event_type == LP_REVMA_TELEMETRY_ATOM_ADMISSION)
      return row.signal_identity_hash != 0 && row.candidate_identity != 0 &&
         candidate_evidence_complete &&
          (row.candidate_type == LP_REVMA_DISCOVERY_CANDIDATE_ADVERSE_ADD ||
           row.candidate_type == LP_REVMA_DISCOVERY_CANDIDATE_FAVORABLE_ADD) &&
          row.atoms_before >= 1 && row.atoms_before < 2147483647 &&
          row.atoms_after == row.atoms_before + 1 &&
          (long)row.adverse_add_count +
             (long)row.favorable_add_count ==
                (long)row.atoms_after - 1 &&
          (row.branch != LP_REVMA_BRANCH_R ||
           row.atoms_after <= LP_REVMA_REAL_MAX_ATOMS_PER_GRID) &&
          !(row.branch == LP_REVMA_BRANCH_C && row.center_latched &&
            row.candidate_type ==
               LP_REVMA_DISCOVERY_CANDIDATE_ADVERSE_ADD) &&
          row.decision == "ADMIT";
   if(row.event_type == LP_REVMA_TELEMETRY_CENTER_LATCH)
      return row.branch == LP_REVMA_BRANCH_C && row.center_applicable &&
         row.center_latched && row.support0_sign > 0 &&
         row.previous_support_sign > 0 && row.current_support_sign <= 0 &&
         grid_snapshot_evidence_complete && row.center_latch_time > 0 &&
         row.center_latch_time == row.source_m1_time &&
         row.previous_center > 0.0 && row.current_center > 0.0 &&
         LP_RevmaTelemetryCenterSnapshotValid(row) &&
         row.support0_q > 0.0 && row.center_observation_index > 0 &&
         inventory_unchanged;
   if(row.event_type == LP_REVMA_TELEMETRY_CENTER_BLOCKED_ADVERSE)
      return row.branch == LP_REVMA_BRANCH_C && row.center_applicable &&
         row.center_latched &&
         candidate_evidence_complete &&
          row.candidate_type == LP_REVMA_DISCOVERY_CANDIDATE_ADVERSE_ADD &&
          row.candidate_identity != 0 && row.decision == "REJECT" &&
          row.reason == "signed_center_support_adverse_adds_frozen" &&
          inventory_unchanged;
   if(row.event_type == LP_REVMA_TELEMETRY_FAVORABLE_ELIGIBLE_AFTER_LATCH)
      return row.branch == LP_REVMA_BRANCH_C && row.center_applicable &&
         row.center_latched &&
         candidate_evidence_complete &&
         row.candidate_type == LP_REVMA_DISCOVERY_CANDIDATE_FAVORABLE_ADD &&
         row.candidate_identity != 0 && row.decision == "ELIGIBLE" &&
         inventory_unchanged;
   if(row.event_type == LP_REVMA_TELEMETRY_FIRST_DIVERGENCE)
      return row.branch == LP_REVMA_BRANCH_C && row.center_applicable &&
         row.center_latched &&
         candidate_evidence_complete &&
         row.candidate_type == LP_REVMA_DISCOVERY_CANDIDATE_ADVERSE_ADD &&
         row.decision == "REJECT" && row.shared_origin_id != 0 &&
         row.opportunity_id != 0 && row.candidate_identity != 0 &&
         inventory_unchanged;
   if(row.event_type == LP_REVMA_TELEMETRY_FIRST_INFEASIBILITY)
      return candidate_evidence_complete && row.candidate_identity != 0 &&
          LP_RevmaDiscoveryCandidateTypeValid(row.candidate_type) &&
           LP_RevmaTelemetryEconomicInfeasibilityReasonValid(row.reason) &&
           row.decision == "REJECT" &&
           inventory_unchanged;
   if(row.event_type == LP_REVMA_TELEMETRY_CANDIDATE_REJECTION)
      return candidate_evidence_complete && row.candidate_identity != 0 &&
         LP_RevmaDiscoveryCandidateTypeValid(row.candidate_type) &&
         ((row.branch == LP_REVMA_BRANCH_R &&
           LP_RevmaTelemetryEconomicInfeasibilityReasonValid(row.reason)) ||
          (row.branch != LP_REVMA_BRANCH_R &&
           LP_RevmaTelemetryShadowInfeasibilityReasonValid(row.reason))) &&
         row.decision == "REJECT" &&
         inventory_unchanged &&
         ((row.candidate_type == LP_REVMA_DISCOVERY_CANDIDATE_BIRTH &&
           row.atoms_before == 0) ||
          (row.candidate_type != LP_REVMA_DISCOVERY_CANDIDATE_BIRTH &&
           row.atoms_before >= 1));
   if(row.event_type == LP_REVMA_TELEMETRY_GRID_CLOSE)
      return row.close_owner >= LP_REVMA_DISCOVERY_CLOSE_LOCAL_HARVEST &&
         row.close_owner <= LP_REVMA_DISCOVERY_CLOSE_HARD_RISK &&
         grid_snapshot_evidence_complete &&
           row.atoms_before >= 1 && row.atoms_after == 0 &&
           row.liability_minor == 0 &&
           row.decision == "CLOSE" && row.reason != "" &&
           row.reason == row.grid_terminal_reason;
   if(row.event_type == LP_REVMA_TELEMETRY_GRID_TERMINAL_SNAPSHOT)
      return grid_snapshot_evidence_complete &&
         row.atoms_after == row.atoms_before &&
         row.decision == "SNAPSHOT" &&
         row.reason == "run_boundary_unresolved_grid_snapshot";
   if(row.event_type == LP_REVMA_TELEMETRY_CLEANUP_LATCH)
      return row.symbol_id == -1 && row.branch_grid_id == 0 &&
         row.close_owner == LP_REVMA_DISCOVERY_CLOSE_CLEANUP &&
         row.decision == "CLOSE" && row.reason != "" && inventory_unchanged;
   if(row.event_type == LP_REVMA_TELEMETRY_CLEANUP_COMPLETE)
      return row.symbol_id == -1 && row.branch_grid_id == 0 &&
         row.close_owner == LP_REVMA_DISCOVERY_CLOSE_CLEANUP &&
         row.atoms_after == 0 && row.decision == "CLOSE" && row.reason != "";
   if(row.event_type == LP_REVMA_TELEMETRY_HARD_RISK_LATCH)
      return row.symbol_id == -1 && row.branch_grid_id == 0 &&
         row.close_owner == LP_REVMA_DISCOVERY_CLOSE_HARD_RISK &&
         row.decision == "CLOSE" && row.reason != "" && inventory_unchanged;
   if(row.event_type == LP_REVMA_TELEMETRY_HARD_RISK_COMPLETE)
      return row.symbol_id == -1 && row.branch_grid_id == 0 &&
         row.close_owner == LP_REVMA_DISCOVERY_CLOSE_HARD_RISK &&
         row.atoms_after == 0 && row.decision == "CLOSE" && row.reason != "";
   if(row.event_type == LP_REVMA_TELEMETRY_CYCLE_CLOSE)
      return row.symbol_id == -1 && row.branch_grid_id == 0 &&
         row.atoms_after == 0 && row.reason != "";
   if(row.event_type == LP_REVMA_TELEMETRY_RUN_BOUNDARY_UNRESOLVED)
      return row.symbol_id == -1 && row.branch_grid_id == 0 &&
         row.atoms_before > 0 && row.atoms_after == row.atoms_before &&
         row.decision == "SNAPSHOT" &&
         row.reason == "run_boundary_unresolved";
   if(row.event_type == LP_REVMA_TELEMETRY_FAILURE)
      return row.reason != "" && row.decision == "INVALIDATE" &&
         inventory_unchanged;
   return false;
}

#define LP_REVMA_TELEMETRY_EVENT_COUNT 18
#define LP_REVMA_TELEMETRY_SYMBOL_SLOTS 29

struct LP_RevmaTelemetryLifecycleState
{
   bool open;
   ulong grid_id;
   ulong cycle_id;
   ulong account_cycle_id;
   long grid_generation;
   ulong shared_origin_id;
   ulong birth_pre_candidate_state_hash;
   ulong birth_matched_snapshot_hash;
   ulong birth_signal_identity_hash;
   datetime birth_m1_time;
   int direction;
   string birth_bucket;
   string center_alignment;
   double p0;
   double stress_price;
   double c0;
   double q0;
   double minimum_entry_price;
   double maximum_entry_price;
   double broker_tick_size;
   long p0_ticks;
   long c0_ticks;
   long discovery_cell_ticks;
   double discovery_cell_price;
   datetime initial_history_boundary;
   datetime last_admission_m1_time;
   ulong last_admission_identity;
   int atoms;
   double lots;
   int adverse_add_count;
   int favorable_add_count;
   int blocked_adverse_count;
   long a_g_candidate_minor;
   long a_g_minor;
   long current_reservation_minor;
   long current_q_cash_minor;
   long current_margin_minor;
   bool center_applicable;
   bool center_triggered;
   bool terminal_snapshot_written;
   datetime terminal_snapshot_m1_time;
   datetime terminal_transition_m1_time;
   ulong terminal_event_hash;
   ulong terminal_projection_hash;
   ulong terminal_internal_state_hash;
   int terminal_atoms_before;
   int terminal_atoms_after;
   double terminal_lots_before;
   double terminal_lots_after;
   long terminal_reservation_minor;
   long terminal_q_cash_minor;
   bool terminal_reservation_overrun;
   long terminal_reservation_overrun_minor;
   long terminal_margin_minor;
   long terminal_harvest_minor;
   long terminal_nonharvest_minor;
   long terminal_liability_minor;
   long terminal_cost_minor;
   long terminal_maximum_adverse_excursion_minor;
   int terminal_grid_age_minutes;
   int terminal_time_underwater_minutes;
   int favorable_eligible_after_latch;
   datetime center_latch_time;
   int terminal_close_owner;
   string terminal_reason;
   bool terminal_summary_written;
};

struct LP_RevmaMatchedOpportunityState
{
   bool active;
   ulong account_cycle_id;
   datetime source_m1_time;
   int candidate_type;
   ulong shared_origin_id;
   ulong opportunity_id;
   ulong pre_candidate_state_hash;
   ulong matched_snapshot_hash;
   ulong signal_identity_hash;
   bool u_seen;
   bool c_seen;
   bool u_admitted;
   bool u_rejected;
   bool c_admitted;
   bool c_rejected;
   bool c_blocked;
   string u_rejection_reason;
   string c_rejection_reason;
   bool divergence_emitted;
};

void LP_ResetRevmaMatchedOpportunityState(
   LP_RevmaMatchedOpportunityState &state)
{
   ZeroMemory(state);
}

void LP_ResetRevmaTelemetryLifecycleState(
   LP_RevmaTelemetryLifecycleState &state)
{
   ZeroMemory(state);
}

struct LP_RevmaTelemetrySummaryLedger
{
   bool valid;
   int grid_count;
   int peak_atoms;
   int peak_direction;
   double peak_lots;
   int current_atoms;
   double current_lots;
   long current_reservation_minor;
   long current_margin_minor;
   long peak_reservation_minor;
   bool reservation_overrun_observed;
   long peak_reservation_overrun_minor;
   long peak_q_cash_minor;
   long peak_margin_minor;
   long maximum_adverse_excursion_minor;
   int maximum_age_minutes;
   int time_underwater_minutes;
   long harvest_minor;
   long nonharvest_minor;
   long liability_minor;
   long cost_minor;
   int local_harvest_close_count;
   int cleanup_close_count;
   int hard_risk_close_count;
   long local_harvest_pnl_minor;
   long cleanup_pnl_minor;
   long hard_risk_pnl_minor;
   int center_applicable_grids;
   int center_triggered_grids;
   int center_not_triggered_grids;
   int center_not_applicable_grids;
   int center_blocked_adverse_candidates;
   int favorable_eligible_after_latch;
   bool center_latched;
   datetime first_latch_time;
   ulong child_evidence_hash;
};

void LP_ResetRevmaTelemetrySummaryLedger(
   LP_RevmaTelemetrySummaryLedger &ledger)
{
   ZeroMemory(ledger);
   ledger.valid = true;
   ledger.child_evidence_hash = LP_HashString(
      "gate108_summary_child_evidence_set_v1");
}

class LP_RevmaDiscoveryTelemetry
{
private:
   bool m_initialized;
   bool m_valid;
   string m_invalid_reason;
   int m_transition_handle;
   int m_summary_handle;
   int m_manifest_handle;
   bool m_ever_initialized;
   string m_run_id;
   string m_source_revision;
   string m_profile_id;
   ulong m_config_hash;
   ulong m_profile_hash;
   ulong m_formula_hash;
   string m_transition_buffer[LP_REVMA_DISCOVERY_TRANSITION_BUFFER_ROWS];
   string m_summary_buffer[LP_REVMA_DISCOVERY_SUMMARY_BUFFER_ROWS];
   ulong m_transition_row_hash_buffer[LP_REVMA_DISCOVERY_TRANSITION_BUFFER_ROWS];
   ulong m_transition_chain_hash_buffer[LP_REVMA_DISCOVERY_TRANSITION_BUFFER_ROWS];
   ulong m_summary_row_hash_buffer[LP_REVMA_DISCOVERY_SUMMARY_BUFFER_ROWS];
   ulong m_summary_chain_hash_buffer[LP_REVMA_DISCOVERY_SUMMARY_BUFFER_ROWS];
   long m_transition_line_bytes[LP_REVMA_DISCOVERY_TRANSITION_BUFFER_ROWS];
   long m_summary_line_bytes[LP_REVMA_DISCOVERY_SUMMARY_BUFFER_ROWS];
   int m_transition_count;
   int m_summary_count;
   long m_transition_rows;
   long m_summary_rows;
   long m_transition_bytes;
   long m_summary_bytes;
   long m_manifest_bytes;
   ulong m_manifest_row_hash;
   bool m_manifest_pending_written;
   ulong m_manifest_sequence;
   ulong m_manifest_chain_hash;
   ulong m_run_started_microseconds;
   long m_transition_pending_bytes;
   long m_summary_pending_bytes;
   long m_transition_committed_rows;
   long m_summary_committed_rows;
   ulong m_next_sequence;
   ulong m_next_summary_sequence;
   ulong m_appended_transition_chain_hash;
   ulong m_committed_transition_chain_hash;
   ulong m_appended_summary_chain_hash;
   ulong m_committed_summary_chain_hash;
   long m_transition_flush_microseconds;
   long m_transition_flush_max_microseconds;
   long m_summary_flush_microseconds;
   long m_summary_flush_max_microseconds;
   long m_transition_flushes;
   long m_summary_flushes;
   datetime m_last_source_m1_time;
   datetime m_registered_cohort_source_m1_time;
   ulong m_registered_cohort_snapshot_hash;
   ulong m_registered_cohort_signal_hash;
   ulong m_registered_cohort_strategy_hash;
   datetime m_initial_history_boundary[LP_SYMBOL_COUNT];
   LP_RevmaTelemetryLifecycleState
      m_lifecycle[LP_REVMA_DISCOVERY_BRANCH_COUNT][LP_SYMBOL_COUNT];
   LP_RevmaTelemetrySummaryLedger
      m_symbol_summary_ledger[LP_REVMA_DISCOVERY_BRANCH_COUNT][LP_SYMBOL_COUNT];
   LP_RevmaTelemetrySummaryLedger
      m_branch_summary_ledger[LP_REVMA_DISCOVERY_BRANCH_COUNT];
   datetime m_last_logical_event_m1[LP_REVMA_DISCOVERY_BRANCH_COUNT]
      [LP_REVMA_TELEMETRY_SYMBOL_SLOTS][LP_REVMA_TELEMETRY_EVENT_COUNT + 1];
   bool m_causal_matching_closed;
   ulong m_first_divergence_opportunity_id;
   LP_RevmaMatchedOpportunityState
      m_matched_opportunity[LP_SYMBOL_COUNT];
   ulong m_branch_cycle_id[LP_REVMA_DISCOVERY_BRANCH_COUNT];
   ulong m_branch_account_cycle_id[LP_REVMA_DISCOVERY_BRANCH_COUNT];
   long m_branch_equity_reference_minor[LP_REVMA_DISCOVERY_BRANCH_COUNT];
   long m_branch_budget_minor[LP_REVMA_DISCOVERY_BRANCH_COUNT];
   ulong m_branch_cycle_summary_id[LP_REVMA_DISCOVERY_BRANCH_COUNT];
   bool m_branch_cycle_sealed[LP_REVMA_DISCOVERY_BRANCH_COUNT];
   bool m_branch_run_sealed[LP_REVMA_DISCOVERY_BRANCH_COUNT];
   ulong m_branch_transition_chain[LP_REVMA_DISCOVERY_BRANCH_COUNT];
   ulong m_run_completion_bound_chain[LP_REVMA_DISCOVERY_BRANCH_COUNT];
   ulong m_branch_terminal_book_hash[LP_REVMA_DISCOVERY_BRANCH_COUNT];
   ulong m_branch_terminal_grid_state_hash[LP_REVMA_DISCOVERY_BRANCH_COUNT];
   bool m_branch_run_final_flat[LP_REVMA_DISCOVERY_BRANCH_COUNT];
   datetime m_branch_terminal_boundary_m1[LP_REVMA_DISCOVERY_BRANCH_COUNT];
   bool m_symbol_summary_written[LP_REVMA_DISCOVERY_BRANCH_COUNT][LP_SYMBOL_COUNT];
   bool m_top_offender_summary_written[LP_REVMA_DISCOVERY_BRANCH_COUNT][LP_SYMBOL_COUNT];
   long m_grid_generation[LP_REVMA_DISCOVERY_BRANCH_COUNT][LP_SYMBOL_COUNT];
   bool m_cycle_event_seen[LP_REVMA_DISCOVERY_BRANCH_COUNT]
      [LP_REVMA_TELEMETRY_EVENT_COUNT + 1];
   bool m_branch_reconciliation_summary[LP_REVMA_DISCOVERY_BRANCH_COUNT];
   bool m_branch_reconciliation_clean[LP_REVMA_DISCOVERY_BRANCH_COUNT];
   bool m_branch_run_completion_summary[LP_REVMA_DISCOVERY_BRANCH_COUNT];
   bool m_branch_run_formula_clean[LP_REVMA_DISCOVERY_BRANCH_COUNT];
   long m_branch_cleanup_funding_minor[LP_REVMA_DISCOVERY_BRANCH_COUNT];
   int m_branch_close_owner[LP_REVMA_DISCOVERY_BRANCH_COUNT];
   bool m_branch_cleanup_shortfall[LP_REVMA_DISCOVERY_BRANCH_COUNT];
   bool m_branch_cycle_broker_contamination[LP_REVMA_DISCOVERY_BRANCH_COUNT];
   bool m_branch_cycle_formula_clean[LP_REVMA_DISCOVERY_BRANCH_COUNT];
   bool m_branch_cycle_reconciliation_clean[LP_REVMA_DISCOVERY_BRANCH_COUNT];
   string m_branch_terminal_reason[LP_REVMA_DISCOVERY_BRANCH_COUNT];
   string m_branch_first_infeasibility[LP_REVMA_DISCOVERY_BRANCH_COUNT];
   string m_branch_latest_infeasibility[LP_REVMA_DISCOVERY_BRANCH_COUNT];
   datetime m_branch_latest_infeasibility_m1[LP_REVMA_DISCOVERY_BRANCH_COUNT];
   ulong m_first_infeasibility_grid_id[LP_REVMA_DISCOVERY_BRANCH_COUNT];
   long m_first_infeasibility_grid_generation[LP_REVMA_DISCOVERY_BRANCH_COUNT];
   int m_first_infeasibility_symbol_id[LP_REVMA_DISCOVERY_BRANCH_COUNT];
   int m_first_infeasibility_candidate_type[LP_REVMA_DISCOVERY_BRANCH_COUNT];
   ulong m_first_infeasibility_candidate_id[LP_REVMA_DISCOVERY_BRANCH_COUNT];
   datetime m_first_infeasibility_source_m1[LP_REVMA_DISCOVERY_BRANCH_COUNT];
   ulong m_first_infeasibility_pre_state_hash[LP_REVMA_DISCOVERY_BRANCH_COUNT];
   ulong m_first_infeasibility_snapshot_hash[LP_REVMA_DISCOVERY_BRANCH_COUNT];
   datetime m_last_candidate_decision_m1[LP_REVMA_DISCOVERY_BRANCH_COUNT]
      [LP_SYMBOL_COUNT];
   ulong m_last_candidate_decision_id[LP_REVMA_DISCOVERY_BRANCH_COUNT]
      [LP_SYMBOL_COUNT];
   bool m_pending_favorable_decision[LP_REVMA_DISCOVERY_BRANCH_COUNT]
      [LP_SYMBOL_COUNT];
   ulong m_pending_favorable_candidate_id[LP_REVMA_DISCOVERY_BRANCH_COUNT]
      [LP_SYMBOL_COUNT];
   datetime m_pending_favorable_source_m1[LP_REVMA_DISCOVERY_BRANCH_COUNT]
      [LP_SYMBOL_COUNT];
   ulong m_pending_favorable_grid_id[LP_REVMA_DISCOVERY_BRANCH_COUNT]
      [LP_SYMBOL_COUNT];
   ulong m_pending_favorable_pre_state_hash[LP_REVMA_DISCOVERY_BRANCH_COUNT]
      [LP_SYMBOL_COUNT];
   ulong m_pending_favorable_snapshot_hash[LP_REVMA_DISCOVERY_BRANCH_COUNT]
      [LP_SYMBOL_COUNT];
   int m_failure_event_count;
   bool m_external_failure_latched;
   string m_external_failure_reason;
   int m_center_applicable_grids;
   int m_center_triggered_grids;
   int m_center_not_triggered_grids;
   int m_center_not_applicable_grids;
   int m_center_blocked_adverse_candidates;
   int m_favorable_eligible_after_latch;
   datetime m_first_center_latch_time;
   ulong m_center_grid_ids[LP_SYMBOL_COUNT];
   bool m_center_triggered[LP_SYMBOL_COUNT];
   bool m_center_closed[LP_SYMBOL_COUNT];
   bool m_center_applicable[LP_SYMBOL_COUNT];
   ulong m_center_cycle_id;
   int m_cycle_center_applicable_grids;
   int m_cycle_center_triggered_grids;
   int m_cycle_center_not_triggered_grids;
   int m_cycle_center_not_applicable_grids;
   int m_cycle_center_blocked_adverse_candidates;
   int m_cycle_favorable_eligible_after_latch;
   datetime m_cycle_first_center_latch_time;
   ulong m_writer_branch_transition_rows[LP_REVMA_DISCOVERY_BRANCH_COUNT];
   ulong m_writer_cycle_candidate_decision_rows[LP_REVMA_DISCOVERY_BRANCH_COUNT];
   ulong m_writer_cycle_candidate_admitted_rows[LP_REVMA_DISCOVERY_BRANCH_COUNT];
   ulong m_writer_cycle_candidate_rejected_rows[LP_REVMA_DISCOVERY_BRANCH_COUNT];
   ulong m_writer_cycle_inventory_transition_rows[LP_REVMA_DISCOVERY_BRANCH_COUNT];
   ulong m_writer_run_candidate_decision_rows[LP_REVMA_DISCOVERY_BRANCH_COUNT];
   ulong m_writer_run_candidate_admitted_rows[LP_REVMA_DISCOVERY_BRANCH_COUNT];
   ulong m_writer_run_candidate_rejected_rows[LP_REVMA_DISCOVERY_BRANCH_COUNT];
   ulong m_writer_run_inventory_transition_rows[LP_REVMA_DISCOVERY_BRANCH_COUNT];

   void ResetState()
   {
      m_initialized = false;
      m_valid = false;
      m_invalid_reason = "not_initialized";
      m_transition_handle = INVALID_HANDLE;
      m_summary_handle = INVALID_HANDLE;
      m_manifest_handle = INVALID_HANDLE;
      m_ever_initialized = false;
      m_run_id = "";
      m_source_revision = "";
      m_profile_id = "";
      m_config_hash = 0;
      m_profile_hash = 0;
      m_formula_hash = 0;
      m_transition_count = 0;
      m_summary_count = 0;
      m_transition_rows = 0;
      m_summary_rows = 0;
      m_transition_bytes = 0;
      m_summary_bytes = 0;
      m_manifest_bytes = 0;
      m_manifest_row_hash = 0;
      m_manifest_pending_written = false;
      m_manifest_sequence = 0;
      m_manifest_chain_hash = 0;
      m_run_started_microseconds = 0;
      m_transition_pending_bytes = 0;
      m_summary_pending_bytes = 0;
      m_transition_committed_rows = 0;
      m_summary_committed_rows = 0;
      m_next_sequence = 1;
      m_next_summary_sequence = 1;
      m_appended_transition_chain_hash = 0;
      m_committed_transition_chain_hash = 0;
      m_appended_summary_chain_hash = 0;
      m_committed_summary_chain_hash = 0;
      m_transition_flush_microseconds = 0;
      m_transition_flush_max_microseconds = 0;
      m_summary_flush_microseconds = 0;
      m_summary_flush_max_microseconds = 0;
      m_transition_flushes = 0;
      m_summary_flushes = 0;
      m_last_source_m1_time = 0;
      m_registered_cohort_source_m1_time = 0;
      m_registered_cohort_snapshot_hash = 0;
      m_registered_cohort_signal_hash = 0;
      m_registered_cohort_strategy_hash = 0;
      m_causal_matching_closed = false;
      m_first_divergence_opportunity_id = 0;
      m_failure_event_count = 0;
      m_external_failure_latched = false;
      m_external_failure_reason = "";
      m_center_applicable_grids = 0;
      m_center_triggered_grids = 0;
      m_center_not_triggered_grids = 0;
      m_center_not_applicable_grids = 0;
      m_center_blocked_adverse_candidates = 0;
      m_favorable_eligible_after_latch = 0;
      m_first_center_latch_time = 0;
      m_center_cycle_id = 0;
      m_cycle_center_applicable_grids = 0;
      m_cycle_center_triggered_grids = 0;
      m_cycle_center_not_triggered_grids = 0;
      m_cycle_center_not_applicable_grids = 0;
      m_cycle_center_blocked_adverse_candidates = 0;
      m_cycle_favorable_eligible_after_latch = 0;
      m_cycle_first_center_latch_time = 0;
      for(int i = 0; i < LP_REVMA_DISCOVERY_TRANSITION_BUFFER_ROWS; i++)
      {
         m_transition_buffer[i] = "";
         m_transition_row_hash_buffer[i] = 0;
         m_transition_chain_hash_buffer[i] = 0;
         m_transition_line_bytes[i] = 0;
      }
      for(int i = 0; i < LP_REVMA_DISCOVERY_SUMMARY_BUFFER_ROWS; i++)
      {
         m_summary_buffer[i] = "";
         m_summary_row_hash_buffer[i] = 0;
         m_summary_chain_hash_buffer[i] = 0;
         m_summary_line_bytes[i] = 0;
      }
      for(int symbol_id = 0; symbol_id < LP_SYMBOL_COUNT; symbol_id++)
      {
         LP_ResetRevmaMatchedOpportunityState(
            m_matched_opportunity[symbol_id]);
         m_initial_history_boundary[symbol_id] = 0;
         m_center_grid_ids[symbol_id] = 0;
         m_center_triggered[symbol_id] = false;
         m_center_closed[symbol_id] = false;
         m_center_applicable[symbol_id] = false;
      }
      for(int branch = 0; branch < LP_REVMA_DISCOVERY_BRANCH_COUNT; branch++)
      {
         m_branch_cycle_id[branch] = 0;
         m_writer_branch_transition_rows[branch] = 0;
         m_writer_cycle_candidate_decision_rows[branch] = 0;
         m_writer_cycle_candidate_admitted_rows[branch] = 0;
         m_writer_cycle_candidate_rejected_rows[branch] = 0;
         m_writer_cycle_inventory_transition_rows[branch] = 0;
         m_writer_run_candidate_decision_rows[branch] = 0;
         m_writer_run_candidate_admitted_rows[branch] = 0;
         m_writer_run_candidate_rejected_rows[branch] = 0;
         m_writer_run_inventory_transition_rows[branch] = 0;
         m_branch_account_cycle_id[branch] = 0;
         m_branch_equity_reference_minor[branch] = 0;
         m_branch_budget_minor[branch] = 0;
         m_branch_cycle_summary_id[branch] = 0;
         m_branch_cycle_sealed[branch] = false;
         m_branch_run_sealed[branch] = false;
         m_branch_transition_chain[branch] = 0;
         m_run_completion_bound_chain[branch] = 0;
         m_branch_terminal_book_hash[branch] = 0;
         m_branch_terminal_grid_state_hash[branch] = 0;
         m_branch_run_final_flat[branch] = false;
         m_branch_terminal_boundary_m1[branch] = 0;
         m_branch_reconciliation_summary[branch] = false;
         m_branch_reconciliation_clean[branch] = false;
         m_branch_run_completion_summary[branch] = false;
         m_branch_run_formula_clean[branch] = false;
         m_branch_cleanup_funding_minor[branch] = 0;
         m_branch_close_owner[branch] = LP_REVMA_DISCOVERY_CLOSE_NONE;
         m_branch_cleanup_shortfall[branch] = false;
         m_branch_cycle_broker_contamination[branch] = false;
         m_branch_cycle_formula_clean[branch] = false;
         m_branch_cycle_reconciliation_clean[branch] = false;
         m_branch_terminal_reason[branch] = "";
         m_branch_first_infeasibility[branch] = "";
         m_branch_latest_infeasibility[branch] = "";
         m_branch_latest_infeasibility_m1[branch] = 0;
         m_first_infeasibility_grid_id[branch] = 0;
         m_first_infeasibility_grid_generation[branch] = 0;
         m_first_infeasibility_symbol_id[branch] = -1;
         m_first_infeasibility_candidate_type[branch] =
            LP_REVMA_DISCOVERY_CANDIDATE_NONE;
         m_first_infeasibility_candidate_id[branch] = 0;
         m_first_infeasibility_source_m1[branch] = 0;
         m_first_infeasibility_pre_state_hash[branch] = 0;
         m_first_infeasibility_snapshot_hash[branch] = 0;
         LP_ResetRevmaTelemetrySummaryLedger(
            m_branch_summary_ledger[branch]);
         for(int event_type = 0;
            event_type <= LP_REVMA_TELEMETRY_EVENT_COUNT; event_type++)
            m_cycle_event_seen[branch][event_type] = false;
         for(int symbol_id = 0; symbol_id < LP_SYMBOL_COUNT; symbol_id++)
         {
            m_symbol_summary_written[branch][symbol_id] = false;
            m_top_offender_summary_written[branch][symbol_id] = false;
            m_grid_generation[branch][symbol_id] = 0;
            m_last_candidate_decision_m1[branch][symbol_id] = 0;
            m_last_candidate_decision_id[branch][symbol_id] = 0;
            m_pending_favorable_decision[branch][symbol_id] = false;
            m_pending_favorable_candidate_id[branch][symbol_id] = 0;
            m_pending_favorable_source_m1[branch][symbol_id] = 0;
            m_pending_favorable_grid_id[branch][symbol_id] = 0;
            m_pending_favorable_pre_state_hash[branch][symbol_id] = 0;
            m_pending_favorable_snapshot_hash[branch][symbol_id] = 0;
            LP_ResetRevmaTelemetryLifecycleState(m_lifecycle[branch][symbol_id]);
            LP_ResetRevmaTelemetrySummaryLedger(
               m_symbol_summary_ledger[branch][symbol_id]);
         }
         for(int slot = 0; slot < LP_REVMA_TELEMETRY_SYMBOL_SLOTS; slot++)
         {
            for(int event_type = 0;
               event_type <= LP_REVMA_TELEMETRY_EVENT_COUNT; event_type++)
               m_last_logical_event_m1[branch][slot][event_type] = 0;
         }
      }
   }

   void Invalidate(const string reason)
   {
      m_valid = false;
      if(m_invalid_reason == "" || m_invalid_reason == "not_initialized")
         m_invalid_reason = reason;
   }

   bool IncrementWriterCounter(ulong &counter)
   {
      if(counter >= (ulong)LP_REVMA_DISCOVERY_MINOR_ABS_LIMIT)
         return false;
      counter++;
      return true;
   }

   bool ApplyWriterTransitionCounts(
      const LP_RevmaDiscoveryTransitionRow &row)
   {
      int branch = row.branch;
      if(!LP_RevmaDiscoveryBranchValid(branch) ||
         !IncrementWriterCounter(m_writer_branch_transition_rows[branch]))
         return false;
      if(row.event_type == LP_REVMA_TELEMETRY_CYCLE_START)
      {
         m_writer_cycle_candidate_decision_rows[branch] = 0;
         m_writer_cycle_candidate_admitted_rows[branch] = 0;
         m_writer_cycle_candidate_rejected_rows[branch] = 0;
         m_writer_cycle_inventory_transition_rows[branch] = 0;
         return true;
      }
      bool admitted = row.event_type == LP_REVMA_TELEMETRY_BRANCH_BIRTH ||
         row.event_type == LP_REVMA_TELEMETRY_ATOM_ADMISSION;
      bool rejected = row.event_type ==
            LP_REVMA_TELEMETRY_CENTER_BLOCKED_ADVERSE ||
         row.event_type == LP_REVMA_TELEMETRY_CANDIDATE_REJECTION;
      if(admitted || rejected)
      {
         if(!IncrementWriterCounter(
               m_writer_cycle_candidate_decision_rows[branch]) ||
            !IncrementWriterCounter(
               m_writer_run_candidate_decision_rows[branch]))
            return false;
         if(admitted)
         {
            if(!IncrementWriterCounter(
                  m_writer_cycle_candidate_admitted_rows[branch]) ||
               !IncrementWriterCounter(
                  m_writer_run_candidate_admitted_rows[branch]))
               return false;
         }
         else if(!IncrementWriterCounter(
               m_writer_cycle_candidate_rejected_rows[branch]) ||
            !IncrementWriterCounter(
               m_writer_run_candidate_rejected_rows[branch]))
            return false;
      }
      if(admitted || row.event_type == LP_REVMA_TELEMETRY_GRID_CLOSE)
      {
         if(!IncrementWriterCounter(
               m_writer_cycle_inventory_transition_rows[branch]) ||
            !IncrementWriterCounter(
               m_writer_run_inventory_transition_rows[branch]))
            return false;
      }
      return true;
   }

   int EventSymbolSlot(const int symbol_id)
   {
      return symbol_id < 0 ? 0 : symbol_id + 1;
   }

   bool TerminalCandidateDecisionEvent(const int event_type)
   {
      return event_type == LP_REVMA_TELEMETRY_BRANCH_BIRTH ||
         event_type == LP_REVMA_TELEMETRY_ATOM_ADMISSION ||
         event_type == LP_REVMA_TELEMETRY_CENTER_BLOCKED_ADVERSE ||
         event_type == LP_REVMA_TELEMETRY_CANDIDATE_REJECTION;
   }

   bool BranchHasPendingFavorableDecision(const int branch)
   {
      for(int symbol_id = 0; symbol_id < LP_SYMBOL_COUNT; symbol_id++)
      {
         if(m_pending_favorable_decision[branch][symbol_id])
            return true;
      }
      return false;
   }

   bool MatchesFirstInfeasibilitySignature(
      const LP_RevmaDiscoveryTransitionRow &row)
   {
      return m_branch_first_infeasibility[row.branch] != "" &&
         row.reason == m_branch_first_infeasibility[row.branch] &&
         row.branch_grid_id == m_first_infeasibility_grid_id[row.branch] &&
         row.grid_generation ==
            m_first_infeasibility_grid_generation[row.branch] &&
         row.symbol_id == m_first_infeasibility_symbol_id[row.branch] &&
         row.candidate_type ==
            m_first_infeasibility_candidate_type[row.branch] &&
         row.candidate_identity ==
            m_first_infeasibility_candidate_id[row.branch] &&
         row.source_m1_time ==
            m_first_infeasibility_source_m1[row.branch] &&
         row.pre_candidate_state_hash ==
            m_first_infeasibility_pre_state_hash[row.branch] &&
         row.matched_snapshot_hash ==
         m_first_infeasibility_snapshot_hash[row.branch];
   }

   bool MatchesPendingFavorableDecision(
      const LP_RevmaDiscoveryTransitionRow &row)
   {
      return row.symbol_id >= 0 && row.symbol_id < LP_SYMBOL_COUNT &&
         m_pending_favorable_decision[row.branch][row.symbol_id] &&
         row.candidate_type ==
            LP_REVMA_DISCOVERY_CANDIDATE_FAVORABLE_ADD &&
         row.candidate_identity ==
            m_pending_favorable_candidate_id[row.branch][row.symbol_id] &&
         row.source_m1_time ==
            m_pending_favorable_source_m1[row.branch][row.symbol_id] &&
         row.branch_grid_id ==
            m_pending_favorable_grid_id[row.branch][row.symbol_id] &&
         row.pre_candidate_state_hash ==
            m_pending_favorable_pre_state_hash[row.branch][row.symbol_id] &&
         row.matched_snapshot_hash ==
         m_pending_favorable_snapshot_hash[row.branch][row.symbol_id];
   }

   bool AddClassificationMatchesLifecycle(
      const LP_RevmaDiscoveryTransitionRow &row,
      const LP_RevmaTelemetryLifecycleState &state)
   {
      if(row.candidate_type == LP_REVMA_DISCOVERY_CANDIDATE_BIRTH)
         return row.current_price == row.p0;
      if(!state.open || state.minimum_entry_price <= 0.0 ||
         state.maximum_entry_price <= 0.0 ||
         state.discovery_cell_ticks <= 0)
         return false;
      long decision_ticks = 0;
      long minimum_ticks = 0;
      long maximum_ticks = 0;
      if(!LP_RevmaPriceToTicks(row.current_price, state.broker_tick_size,
            decision_ticks) ||
         !LP_RevmaPriceToTicks(state.minimum_entry_price,
            state.broker_tick_size, minimum_ticks) ||
         !LP_RevmaPriceToTicks(state.maximum_entry_price,
            state.broker_tick_size, maximum_ticks) ||
         minimum_ticks > maximum_ticks ||
         maximum_ticks > LP_REVMA_GEOMETRY_ABS_LIMIT -
            state.discovery_cell_ticks)
         return false;
      long lower_ticks = minimum_ticks > state.discovery_cell_ticks ?
         minimum_ticks - state.discovery_cell_ticks : 0;
      long upper_ticks = maximum_ticks + state.discovery_cell_ticks;
      bool adverse = row.direction == LP_SIDE_LONG ?
         (lower_ticks > 0 && decision_ticks <= lower_ticks) :
         decision_ticks >= upper_ticks;
      bool favorable = row.direction == LP_SIDE_LONG ?
         decision_ticks >= upper_ticks :
         (lower_ticks > 0 && decision_ticks <= lower_ticks);
      int expected_type = adverse ?
         LP_REVMA_DISCOVERY_CANDIDATE_ADVERSE_ADD :
         (favorable ? LP_REVMA_DISCOVERY_CANDIDATE_FAVORABLE_ADD :
          LP_REVMA_DISCOVERY_CANDIDATE_NONE);
      return expected_type != LP_REVMA_DISCOVERY_CANDIDATE_NONE &&
         row.candidate_type == expected_type;
   }

   bool BranchHasOpenGrid(const int branch)
   {
      for(int symbol_id = 0; symbol_id < LP_SYMBOL_COUNT; symbol_id++)
      {
         if(m_lifecycle[branch][symbol_id].open)
            return true;
      }
      return false;
   }

   bool BranchOpenGridTerminalSnapshotsComplete(
      const int branch,
      const datetime source_m1_time)
   {
      if(source_m1_time <= 0)
         return false;
      for(int symbol_id = 0; symbol_id < LP_SYMBOL_COUNT; symbol_id++)
      {
         LP_RevmaTelemetryLifecycleState state =
            m_lifecycle[branch][symbol_id];
         if(state.open &&
            (!state.terminal_snapshot_written ||
             state.terminal_snapshot_m1_time != source_m1_time))
            return false;
      }
      return true;
   }

   ulong BranchTerminalGridEvidenceHash(
      const int branch,
      const ulong cycle_id,
      const datetime terminal_source_m1_time)
   {
      if(!LP_RevmaDiscoveryBranchValid(branch) || cycle_id == 0 ||
         terminal_source_m1_time <= 0)
         return 0;
      ulong hash = LP_RevmaTerminalGridEventSetSeed(branch, cycle_id,
         terminal_source_m1_time);
      for(int symbol_id = 0; symbol_id < LP_SYMBOL_COUNT; symbol_id++)
      {
         LP_RevmaTelemetryLifecycleState state =
            m_lifecycle[branch][symbol_id];
         if(state.grid_id == 0 || state.cycle_id != cycle_id)
         {
            if(!LP_RevmaTerminalGridEventSetMix(hash, symbol_id,
               0, 0, 0, 0, 0))
               return 0;
            continue;
         }
          if(state.terminal_transition_m1_time <= 0 ||
             state.terminal_transition_m1_time > terminal_source_m1_time ||
             state.terminal_projection_hash == 0 ||
             state.terminal_internal_state_hash == 0 ||
             state.terminal_event_hash == 0 ||
            (state.open &&
             state.terminal_transition_m1_time != terminal_source_m1_time))
            return 0;
         if(!LP_RevmaTerminalGridEventSetMix(hash, symbol_id, state.grid_id,
            state.terminal_transition_m1_time,
            state.terminal_projection_hash,
            state.terminal_internal_state_hash, state.terminal_event_hash))
            return 0;
      }
      return LP_RevmaTerminalGridEventSetFinalize(hash);
   }

   bool BranchGridSummariesComplete(const int branch)
   {
      for(int symbol_id = 0; symbol_id < LP_SYMBOL_COUNT; symbol_id++)
      {
         LP_RevmaTelemetryLifecycleState state =
            m_lifecycle[branch][symbol_id];
         if(state.grid_id != 0 && !state.terminal_summary_written)
            return false;
      }
      return true;
   }

   bool BranchSymbolSummariesComplete(const int branch)
   {
      for(int symbol_id = 0; symbol_id < LP_SYMBOL_COUNT; symbol_id++)
      {
         if(!m_symbol_summary_written[branch][symbol_id])
            return false;
      }
      return true;
   }

   bool BranchTopOffenderSummaryComplete(const int branch)
   {
      for(int symbol_id = 0; symbol_id < LP_SYMBOL_COUNT; symbol_id++)
      {
         if(m_top_offender_summary_written[branch][symbol_id])
            return true;
      }
      return false;
   }

   int BranchCurrentAtoms(const int branch)
   {
      int atoms = 0;
      for(int symbol_id = 0; symbol_id < LP_SYMBOL_COUNT; symbol_id++)
      {
         int grid_atoms = m_lifecycle[branch][symbol_id].atoms;
         if(grid_atoms < 0 || atoms > 2147483647 - grid_atoms)
            return -1;
         atoms += grid_atoms;
      }
      return atoms;
   }

   double BranchCurrentLots(const int branch)
   {
      double lots = 0.0;
      for(int symbol_id = 0; symbol_id < LP_SYMBOL_COUNT; symbol_id++)
         lots += m_lifecycle[branch][symbol_id].lots;
      return NormalizeDouble(lots, 2);
   }

   void InitializeSummaryLedgerIdentity(
      LP_RevmaTelemetrySummaryLedger &ledger,
      const int branch,
      const ulong cycle_id,
      const int scope_symbol_id)
   {
      LP_ResetRevmaTelemetrySummaryLedger(ledger);
      LP_HashMixInt(ledger.child_evidence_hash, branch);
      LP_HashMixULong(ledger.child_evidence_hash, cycle_id);
      LP_HashMixInt(ledger.child_evidence_hash, scope_symbol_id);
   }

   ulong FinalSummaryLedgerEvidenceHash(
      const LP_RevmaTelemetrySummaryLedger &ledger)
   {
      if(!ledger.valid || ledger.child_evidence_hash == 0)
         return 0;
      ulong hash = ledger.child_evidence_hash;
      LP_HashMixInt(hash, ledger.grid_count);
      LP_HashMixULong(hash, m_formula_hash);
      return hash;
   }

   bool SafeSummaryIntAdd(const int left, const int right, int &result)
   {
      result = 0;
      if(left < 0 || right < 0 || left > 2147483647 - right)
         return false;
      result = left + right;
      return true;
   }

   bool AccumulateGridSummary(
      const LP_RevmaDiscoverySummaryRow &row,
      LP_RevmaTelemetrySummaryLedger &ledger)
   {
      if(!ledger.valid || row.summary_type != "grid" ||
         row.branch_grid_id == 0 || row.summary_child_evidence_hash == 0)
         return false;
      LP_RevmaTelemetrySummaryLedger next = ledger;
      if(!SafeSummaryIntAdd(next.grid_count, 1, next.grid_count) ||
         !SafeSummaryIntAdd(next.current_atoms, row.current_atoms,
            next.current_atoms) ||
         !SafeSummaryIntAdd(next.time_underwater_minutes,
            row.time_underwater_minutes, next.time_underwater_minutes) ||
         !SafeSummaryIntAdd(next.local_harvest_close_count,
            row.local_harvest_close_count,
            next.local_harvest_close_count) ||
         !SafeSummaryIntAdd(next.cleanup_close_count,
            row.cleanup_close_count, next.cleanup_close_count) ||
         !SafeSummaryIntAdd(next.hard_risk_close_count,
            row.hard_risk_close_count, next.hard_risk_close_count) ||
         !SafeSummaryIntAdd(next.center_applicable_grids,
            row.center_applicable_grids, next.center_applicable_grids) ||
         !SafeSummaryIntAdd(next.center_triggered_grids,
            row.center_triggered_grids, next.center_triggered_grids) ||
         !SafeSummaryIntAdd(next.center_not_triggered_grids,
            row.center_not_triggered_grids,
            next.center_not_triggered_grids) ||
         !SafeSummaryIntAdd(next.center_not_applicable_grids,
            row.center_not_applicable_grids,
            next.center_not_applicable_grids) ||
         !SafeSummaryIntAdd(next.center_blocked_adverse_candidates,
            row.center_blocked_adverse_candidates,
            next.center_blocked_adverse_candidates) ||
         !SafeSummaryIntAdd(next.favorable_eligible_after_latch,
            row.favorable_eligible_after_latch,
            next.favorable_eligible_after_latch) ||
         !LP_RevmaTelemetrySafeMinorAdd(next.current_reservation_minor,
            row.current_reservation_minor,
            next.current_reservation_minor) ||
         !LP_RevmaTelemetrySafeMinorAdd(next.current_margin_minor,
            row.current_margin_minor, next.current_margin_minor) ||
         !LP_RevmaTelemetrySafeMinorAdd(next.harvest_minor,
            row.harvest_minor, next.harvest_minor) ||
         !LP_RevmaTelemetrySafeMinorAdd(next.nonharvest_minor,
            row.nonharvest_minor, next.nonharvest_minor) ||
         !LP_RevmaTelemetrySafeMinorAdd(next.liability_minor,
            row.liability_minor, next.liability_minor) ||
         !LP_RevmaTelemetrySafeMinorAdd(next.cost_minor,
            row.cost_minor, next.cost_minor) ||
         !LP_RevmaTelemetrySafeMinorAdd(next.local_harvest_pnl_minor,
            row.local_harvest_pnl_minor,
            next.local_harvest_pnl_minor) ||
         !LP_RevmaTelemetrySafeMinorAdd(next.cleanup_pnl_minor,
            row.cleanup_pnl_minor, next.cleanup_pnl_minor) ||
         !LP_RevmaTelemetrySafeMinorAdd(next.hard_risk_pnl_minor,
            row.hard_risk_pnl_minor, next.hard_risk_pnl_minor))
         return false;
      double current_lots = NormalizeDouble(
         next.current_lots + row.current_lots, 2);
      if(!MathIsValidNumber(current_lots) ||
         !LP_RevmaTelemetryLotsMatchAtoms(current_lots,
            next.current_atoms))
         return false;
      next.current_lots = current_lots;
      if(row.peak_atoms > next.peak_atoms)
      {
         next.peak_atoms = row.peak_atoms;
         next.peak_lots = row.peak_lots;
         next.peak_direction = row.direction;
      }
      if(row.peak_reservation_minor > next.peak_reservation_minor)
         next.peak_reservation_minor = row.peak_reservation_minor;
      if(row.peak_reservation_overrun_minor >
         next.peak_reservation_overrun_minor)
         next.peak_reservation_overrun_minor =
            row.peak_reservation_overrun_minor;
      if(row.peak_q_cash_minor > next.peak_q_cash_minor)
         next.peak_q_cash_minor = row.peak_q_cash_minor;
      if(row.peak_margin_minor > next.peak_margin_minor)
         next.peak_margin_minor = row.peak_margin_minor;
      if(row.maximum_adverse_excursion_minor >
         next.maximum_adverse_excursion_minor)
         next.maximum_adverse_excursion_minor =
            row.maximum_adverse_excursion_minor;
      if(row.maximum_age_minutes > next.maximum_age_minutes)
         next.maximum_age_minutes = row.maximum_age_minutes;
      next.reservation_overrun_observed =
         next.reservation_overrun_observed ||
         row.reservation_overrun_observed;
      next.center_latched = next.center_latched || row.center_latched;
      if(row.first_latch_time > 0 &&
         (next.first_latch_time == 0 ||
          row.first_latch_time < next.first_latch_time))
         next.first_latch_time = row.first_latch_time;
      LP_HashMixULong(next.child_evidence_hash, row.branch_grid_id);
      LP_HashMixULong(next.child_evidence_hash,
         row.summary_child_evidence_hash);
      if(next.child_evidence_hash == 0)
         return false;
      ledger = next;
      return true;
   }

   bool SummaryMatchesLedger(
      const LP_RevmaDiscoverySummaryRow &row,
      const LP_RevmaTelemetrySummaryLedger &ledger,
      const bool compare_center_counters)
   {
      return ledger.valid && row.peak_atoms == ledger.peak_atoms &&
         row.peak_lots == ledger.peak_lots &&
         row.current_atoms == ledger.current_atoms &&
         row.current_lots == ledger.current_lots &&
         row.current_reservation_minor ==
            ledger.current_reservation_minor &&
         row.current_margin_minor == ledger.current_margin_minor &&
         row.peak_reservation_minor == ledger.peak_reservation_minor &&
         row.reservation_overrun_observed ==
            ledger.reservation_overrun_observed &&
         row.peak_reservation_overrun_minor ==
            ledger.peak_reservation_overrun_minor &&
         row.peak_q_cash_minor == ledger.peak_q_cash_minor &&
         row.peak_margin_minor == ledger.peak_margin_minor &&
         row.maximum_adverse_excursion_minor ==
            ledger.maximum_adverse_excursion_minor &&
         row.maximum_age_minutes == ledger.maximum_age_minutes &&
         row.time_underwater_minutes == ledger.time_underwater_minutes &&
         row.harvest_minor == ledger.harvest_minor &&
         row.nonharvest_minor == ledger.nonharvest_minor &&
         row.liability_minor == ledger.liability_minor &&
         row.cost_minor == ledger.cost_minor &&
         row.local_harvest_close_count ==
            ledger.local_harvest_close_count &&
         row.cleanup_close_count == ledger.cleanup_close_count &&
         row.hard_risk_close_count == ledger.hard_risk_close_count &&
         row.local_harvest_pnl_minor ==
            ledger.local_harvest_pnl_minor &&
         row.cleanup_pnl_minor == ledger.cleanup_pnl_minor &&
         row.hard_risk_pnl_minor == ledger.hard_risk_pnl_minor &&
         (!compare_center_counters ||
          (row.center_applicable_grids == ledger.center_applicable_grids &&
           row.center_triggered_grids == ledger.center_triggered_grids &&
           row.center_not_triggered_grids ==
              ledger.center_not_triggered_grids &&
           row.center_not_applicable_grids ==
              ledger.center_not_applicable_grids &&
           row.center_blocked_adverse_candidates ==
              ledger.center_blocked_adverse_candidates &&
           row.favorable_eligible_after_latch ==
              ledger.favorable_eligible_after_latch &&
           row.center_latched == ledger.center_latched &&
           row.first_latch_time == ledger.first_latch_time)) &&
         row.summary_child_evidence_hash ==
            FinalSummaryLedgerEvidenceHash(ledger);
   }

   int ExpectedTopOffenderSymbolId(const int branch)
   {
      int selected = -1;
      long selected_adverse = -1;
      int selected_peak_atoms = -1;
      for(int symbol_id = 0; symbol_id < LP_SYMBOL_COUNT; symbol_id++)
      {
         LP_RevmaTelemetrySummaryLedger ledger =
            m_symbol_summary_ledger[branch][symbol_id];
         if(ledger.grid_count <= 0)
            continue;
         if(selected < 0 ||
            ledger.maximum_adverse_excursion_minor > selected_adverse ||
            (ledger.maximum_adverse_excursion_minor == selected_adverse &&
             ledger.peak_atoms > selected_peak_atoms))
         {
            selected = symbol_id;
            selected_adverse = ledger.maximum_adverse_excursion_minor;
            selected_peak_atoms = ledger.peak_atoms;
         }
      }
      return selected;
   }

   bool GridSummaryMatchesTerminal(
      const LP_RevmaDiscoverySummaryRow &row,
      const LP_RevmaTelemetryLifecycleState &state)
   {
      if(state.terminal_event_hash == 0 ||
         state.terminal_internal_state_hash == 0 ||
         state.terminal_atoms_before < 1 ||
         state.terminal_liability_minor < -LP_REVMA_GEOMETRY_ABS_LIMIT ||
         state.terminal_maximum_adverse_excursion_minor < 0 ||
         !LP_RevmaDiscoveryTerminalReasonOwnerConsistent(
            state.terminal_reason, state.terminal_close_owner))
         return false;
      long terminal_adverse = state.terminal_liability_minor < 0 ?
         -state.terminal_liability_minor : 0;
      bool closed = !state.open;
      int expected_local = closed && state.terminal_reason ==
         "grid_harvest" ? 1 : 0;
      int expected_cleanup = closed && state.terminal_reason ==
         "account_cleanup" ? 1 : 0;
      int expected_risk = closed && state.terminal_reason ==
         "account_risk" ? 1 : 0;
      int expected_applicable = row.branch == LP_REVMA_BRANCH_C &&
         state.center_applicable ? 1 : 0;
      int expected_triggered = expected_applicable > 0 &&
         state.center_triggered ? 1 : 0;
      int expected_not_triggered = expected_applicable > 0 &&
         !state.center_triggered ? 1 : 0;
      int expected_not_applicable = row.branch == LP_REVMA_BRANCH_C &&
         !state.center_applicable ? 1 : 0;
      return row.summary_child_evidence_hash == state.terminal_event_hash &&
         row.terminal_grid_state_hash ==
            state.terminal_internal_state_hash &&
         row.terminal_book_hash == 0 &&
         row.terminal_source_m1_time == 0 &&
         row.peak_atoms == state.terminal_atoms_before &&
         row.peak_lots == state.terminal_lots_before &&
         row.current_atoms == state.terminal_atoms_after &&
         row.current_lots == state.terminal_lots_after &&
         row.current_reservation_minor ==
            (closed ? 0 : state.terminal_reservation_minor) &&
         row.current_margin_minor ==
            (closed ? 0 : state.terminal_margin_minor) &&
         row.peak_reservation_minor ==
            state.terminal_reservation_minor &&
         row.reservation_overrun_observed ==
            state.terminal_reservation_overrun &&
         row.peak_reservation_overrun_minor ==
            state.terminal_reservation_overrun_minor &&
         row.peak_q_cash_minor == state.terminal_q_cash_minor &&
         row.peak_margin_minor == state.terminal_margin_minor &&
         state.terminal_maximum_adverse_excursion_minor >= terminal_adverse &&
         row.maximum_adverse_excursion_minor ==
            state.terminal_maximum_adverse_excursion_minor &&
         row.maximum_age_minutes == state.terminal_grid_age_minutes &&
         row.time_underwater_minutes ==
            state.terminal_time_underwater_minutes &&
         row.harvest_minor == state.terminal_harvest_minor &&
         row.nonharvest_minor == state.terminal_nonharvest_minor &&
         row.liability_minor == state.terminal_liability_minor &&
         row.cost_minor == state.terminal_cost_minor &&
         row.local_harvest_close_count == expected_local &&
         row.cleanup_close_count == expected_cleanup &&
         row.hard_risk_close_count == expected_risk &&
          row.local_harvest_pnl_minor ==
             (expected_local > 0 ? state.terminal_harvest_minor : 0) &&
          row.cleanup_pnl_minor ==
             (expected_cleanup > 0 ? state.terminal_nonharvest_minor : 0) &&
          row.hard_risk_pnl_minor ==
             (expected_risk > 0 ? state.terminal_nonharvest_minor : 0) &&
         row.cleanup_funding_minor == 0 &&
         row.center_applicable_grids == expected_applicable &&
         row.center_triggered_grids == expected_triggered &&
         row.center_not_triggered_grids == expected_not_triggered &&
         row.center_not_applicable_grids == expected_not_applicable &&
         row.center_blocked_adverse_candidates ==
            state.blocked_adverse_count &&
         row.favorable_eligible_after_latch ==
            state.favorable_eligible_after_latch &&
         row.center_latched == state.center_triggered &&
         row.first_latch_time == state.center_latch_time &&
         row.final_flat == closed &&
         !row.cleanup_shortfall && !row.broker_contamination &&
         row.formula_clean && row.reconciliation_clean &&
         row.unresolved_inventory == state.open &&
         row.first_infeasibility == "" &&
         row.latest_infeasibility == "" &&
         row.latest_infeasibility_m1_time == 0;
   }

   void CaptureTerminalLifecycleEvidence(
      const LP_RevmaDiscoveryTransitionRow &row)
   {
      LP_RevmaTelemetryLifecycleState state =
         m_lifecycle[row.branch][row.symbol_id];
      state.terminal_event_hash = row.event_hash;
      state.terminal_projection_hash = row.terminal_projection_hash;
      state.terminal_internal_state_hash =
         row.terminal_internal_state_hash;
      state.terminal_atoms_before = row.atoms_before;
      state.terminal_atoms_after = row.atoms_after;
      state.terminal_lots_before = row.lots_before;
      state.terminal_lots_after = row.lots_after;
      state.terminal_reservation_minor = row.reservation_minor;
      state.terminal_q_cash_minor = row.q_cash_minor;
      state.terminal_reservation_overrun = row.reservation_overrun;
      state.terminal_reservation_overrun_minor =
         row.reservation_overrun_minor;
      state.terminal_margin_minor = row.margin_minor;
      state.terminal_harvest_minor = row.harvest_minor;
      state.terminal_nonharvest_minor = row.nonharvest_minor;
      state.terminal_liability_minor = row.liability_minor;
      state.terminal_cost_minor = row.liquidation_cost_minor;
      state.terminal_maximum_adverse_excursion_minor =
         row.maximum_adverse_excursion_minor;
      state.terminal_grid_age_minutes = row.grid_age_minutes;
      state.terminal_time_underwater_minutes =
         row.time_underwater_minutes;
      m_lifecycle[row.branch][row.symbol_id] = state;
   }

   bool CausalCandidateEvent(const int event_type)
   {
      return event_type == LP_REVMA_TELEMETRY_BRANCH_BIRTH ||
         event_type == LP_REVMA_TELEMETRY_ATOM_ADMISSION ||
         event_type == LP_REVMA_TELEMETRY_CENTER_BLOCKED_ADVERSE ||
         event_type == LP_REVMA_TELEMETRY_CANDIDATE_REJECTION;
   }

   ulong ExpectedMatchedSnapshotHash(
      const LP_RevmaDiscoveryTransitionRow &row)
   {
      if(row.discovery_cell_ticks <= 0)
         return 0;
      return LP_RevmaDiscoveryMatchedSnapshotIdentity(
         row.symbol_id, row.source_m1_time, row.direction,
         row.candidate_type, row.pre_candidate_state_hash,
         row.signal_identity_hash, (int)row.q_event_count,
         row.q0, row.current_price, row.stress_price, row.fill_price,
         row.p0, row.c0, row.broker_tick_size,
         row.a_g_candidate_minor, row.a_g_minor,
         row.incremental_margin_minor,
         row.incremental_liquidation_minor,
         row.incremental_close_cost_minor);
   }

   bool ValidateCausalState(const LP_RevmaDiscoveryTransitionRow &row)
   {
      bool candidate_event = CausalCandidateEvent(row.event_type);
      bool divergence_event = row.event_type ==
         LP_REVMA_TELEMETRY_FIRST_DIVERGENCE;
      if(!candidate_event && !divergence_event)
      {
         if(row.opportunity_id != 0)
            return false;
         if(row.branch == LP_REVMA_BRANCH_R)
            return row.shared_origin_id == 0;
         return row.branch == LP_REVMA_BRANCH_U ||
            row.branch == LP_REVMA_BRANCH_C;
      }
      if(row.branch == LP_REVMA_BRANCH_R)
         return candidate_event && row.shared_origin_id == 0 &&
            row.opportunity_id == 0 && row.matched_snapshot_hash != 0 &&
            row.matched_snapshot_hash == ExpectedMatchedSnapshotHash(row);
      if(row.branch != LP_REVMA_BRANCH_U && row.branch != LP_REVMA_BRANCH_C)
         return false;
      if(row.matched_snapshot_hash == 0 ||
         row.matched_snapshot_hash != ExpectedMatchedSnapshotHash(row))
         return false;
      LP_RevmaTelemetryLifecycleState lifecycle =
         m_lifecycle[row.branch][row.symbol_id];
      bool birth_opportunity =
         row.event_type == LP_REVMA_TELEMETRY_BRANCH_BIRTH ||
         (row.event_type == LP_REVMA_TELEMETRY_CANDIDATE_REJECTION &&
          row.candidate_type == LP_REVMA_DISCOVERY_CANDIDATE_BIRTH);
      ulong expected_origin = birth_opportunity ?
         LP_RevmaDiscoverySharedOriginIdentity(row.symbol_id,
            row.source_m1_time, row.pre_candidate_state_hash,
            row.matched_snapshot_hash) : lifecycle.shared_origin_id;
      ulong expected_opportunity = LP_RevmaDiscoveryOpportunityIdentity(
         expected_origin, row.symbol_id, row.source_m1_time,
         row.candidate_type, row.pre_candidate_state_hash,
         row.matched_snapshot_hash);
      if(expected_origin == 0 || row.shared_origin_id != expected_origin)
         return false;
      if(m_causal_matching_closed)
         return candidate_event && row.opportunity_id == 0;
      if(expected_opportunity == 0 ||
         row.opportunity_id != expected_opportunity)
         return false;

      LP_RevmaMatchedOpportunityState pair =
         m_matched_opportunity[row.symbol_id];
      if(divergence_event)
      {
         return pair.active && pair.u_seen && pair.c_seen &&
            pair.u_admitted && pair.c_blocked && !pair.divergence_emitted &&
            pair.account_cycle_id == row.account_cycle_id &&
            pair.source_m1_time == row.source_m1_time &&
            pair.candidate_type == row.candidate_type &&
            pair.shared_origin_id == row.shared_origin_id &&
            pair.opportunity_id == row.opportunity_id &&
            pair.pre_candidate_state_hash == row.pre_candidate_state_hash &&
            pair.matched_snapshot_hash == row.matched_snapshot_hash &&
            pair.signal_identity_hash == row.signal_identity_hash;
      }
      if(pair.active)
      {
         if(pair.account_cycle_id != row.account_cycle_id ||
            pair.source_m1_time != row.source_m1_time ||
            pair.candidate_type != row.candidate_type ||
            pair.shared_origin_id != row.shared_origin_id ||
            pair.opportunity_id != row.opportunity_id ||
            pair.pre_candidate_state_hash != row.pre_candidate_state_hash ||
            pair.matched_snapshot_hash != row.matched_snapshot_hash ||
            pair.signal_identity_hash != row.signal_identity_hash)
            return false;
         if((row.branch == LP_REVMA_BRANCH_U && pair.u_seen) ||
             (row.branch == LP_REVMA_BRANCH_C && pair.c_seen))
            return false;
         bool other_seen = row.branch == LP_REVMA_BRANCH_U ?
            pair.c_seen : pair.u_seen;
         if(other_seen)
         {
            bool incoming_admitted =
               row.event_type == LP_REVMA_TELEMETRY_BRANCH_BIRTH ||
               row.event_type == LP_REVMA_TELEMETRY_ATOM_ADMISSION;
            bool incoming_rejected = row.event_type ==
               LP_REVMA_TELEMETRY_CANDIDATE_REJECTION;
            bool incoming_blocked = row.event_type ==
               LP_REVMA_TELEMETRY_CENTER_BLOCKED_ADVERSE;
            bool u_admitted = row.branch == LP_REVMA_BRANCH_U ?
               incoming_admitted : pair.u_admitted;
            bool u_rejected = row.branch == LP_REVMA_BRANCH_U ?
               incoming_rejected : pair.u_rejected;
            bool c_admitted = row.branch == LP_REVMA_BRANCH_C ?
               incoming_admitted : pair.c_admitted;
            bool c_rejected = row.branch == LP_REVMA_BRANCH_C ?
               incoming_rejected : pair.c_rejected;
            bool c_blocked = row.branch == LP_REVMA_BRANCH_C ?
               incoming_blocked : pair.c_blocked;
            string u_rejection_reason = row.branch == LP_REVMA_BRANCH_U ?
               row.reason : pair.u_rejection_reason;
            string c_rejection_reason = row.branch == LP_REVMA_BRANCH_C ?
               row.reason : pair.c_rejection_reason;
            bool authorized_divergence = u_admitted && c_blocked;
            bool matched_admission = u_admitted && c_admitted;
            bool matched_no_admission = u_rejected &&
               (c_rejected || c_blocked);
            if(!authorized_divergence && !matched_admission &&
               !matched_no_admission)
               return false;
            if(u_rejected && c_rejected &&
               u_rejection_reason != c_rejection_reason)
               return false;
         }
      }
      return true;
   }

   void ApplyCausalState(const LP_RevmaDiscoveryTransitionRow &row)
   {
      if(row.shared_origin_id == 0 || row.symbol_id < 0)
         return;
      if(row.event_type == LP_REVMA_TELEMETRY_FIRST_DIVERGENCE)
      {
         m_matched_opportunity[row.symbol_id].divergence_emitted = true;
         m_causal_matching_closed = true;
         m_first_divergence_opportunity_id = row.opportunity_id;
         LP_ResetRevmaMatchedOpportunityState(
            m_matched_opportunity[row.symbol_id]);
         return;
      }
      if(m_causal_matching_closed)
         return;
      if(!CausalCandidateEvent(row.event_type))
         return;
      LP_RevmaMatchedOpportunityState pair =
         m_matched_opportunity[row.symbol_id];
      if(!pair.active)
      {
         LP_ResetRevmaMatchedOpportunityState(pair);
         pair.active = true;
         pair.account_cycle_id = row.account_cycle_id;
         pair.source_m1_time = row.source_m1_time;
         pair.candidate_type = row.candidate_type;
         pair.shared_origin_id = row.shared_origin_id;
         pair.opportunity_id = row.opportunity_id;
         pair.pre_candidate_state_hash = row.pre_candidate_state_hash;
         pair.matched_snapshot_hash = row.matched_snapshot_hash;
         pair.signal_identity_hash = row.signal_identity_hash;
      }
      if(row.branch == LP_REVMA_BRANCH_U)
      {
         pair.u_seen = true;
         pair.u_admitted = row.event_type == LP_REVMA_TELEMETRY_BRANCH_BIRTH ||
            row.event_type == LP_REVMA_TELEMETRY_ATOM_ADMISSION;
         pair.u_rejected = row.event_type ==
            LP_REVMA_TELEMETRY_CANDIDATE_REJECTION;
         pair.u_rejection_reason = pair.u_rejected ? row.reason : "";
      }
      else
      {
         pair.c_seen = true;
         pair.c_admitted = row.event_type == LP_REVMA_TELEMETRY_BRANCH_BIRTH ||
            row.event_type == LP_REVMA_TELEMETRY_ATOM_ADMISSION;
         pair.c_rejected = row.event_type ==
            LP_REVMA_TELEMETRY_CANDIDATE_REJECTION;
         pair.c_blocked = row.event_type ==
            LP_REVMA_TELEMETRY_CENTER_BLOCKED_ADVERSE;
         pair.c_rejection_reason = pair.c_rejected ? row.reason : "";
      }
      if(pair.u_seen && pair.c_seen)
      {
         bool authorized_divergence = pair.u_admitted && pair.c_blocked;
         if(!authorized_divergence)
            LP_ResetRevmaMatchedOpportunityState(pair);
      }
      m_matched_opportunity[row.symbol_id] = pair;
   }

   string CycleStartTransitionStateFailureReason(
      const LP_RevmaDiscoveryTransitionRow &row)
   {
      if(m_branch_run_sealed[row.branch])
         return "branch_run_sealed";
      if(m_branch_terminal_boundary_m1[row.branch] > 0 &&
         m_cycle_event_seen[row.branch]
            [LP_REVMA_TELEMETRY_RUN_BOUNDARY_UNRESOLVED])
         return "terminal_boundary_unresolved";
      if(m_branch_terminal_boundary_m1[row.branch] > 0 &&
         row.source_m1_time <= m_branch_terminal_boundary_m1[row.branch])
         return "source_m1_not_after_terminal_boundary";
      if(m_last_source_m1_time > 0 &&
         row.source_m1_time < m_last_source_m1_time)
         return "source_m1_regressed";
      int slot = EventSymbolSlot(row.symbol_id);
      if(slot < 0 || slot >= LP_REVMA_TELEMETRY_SYMBOL_SLOTS)
         return "logical_event_slot_invalid";
      if(m_last_logical_event_m1[row.branch][slot][row.event_type] >=
         row.source_m1_time)
         return "logical_event_repeated_or_regressed";
      if(m_branch_cycle_id[row.branch] == 0)
      {
         if(row.branch_cycle_id != 1)
            return "initial_branch_cycle_id_invalid";
         if(row.account_cycle_id != 1)
            return "initial_account_cycle_id_invalid";
      }
      else
      {
         if(m_branch_cycle_id[row.branch] >=
               (ulong)LP_REVMA_GEOMETRY_ABS_LIMIT)
            return "branch_cycle_id_limit_reached";
         if(m_branch_account_cycle_id[row.branch] >=
               (ulong)LP_REVMA_GEOMETRY_ABS_LIMIT)
            return "account_cycle_id_limit_reached";
         if(row.branch_cycle_id != m_branch_cycle_id[row.branch] + 1)
            return "next_branch_cycle_id_invalid";
         if(row.account_cycle_id !=
               m_branch_account_cycle_id[row.branch] + 1)
            return "next_account_cycle_id_invalid";
         if(BranchHasOpenGrid(row.branch))
            return "prior_cycle_grid_open";
         if(BranchHasPendingFavorableDecision(row.branch))
            return "prior_cycle_favorable_decision_pending";
         if(!m_branch_cycle_sealed[row.branch])
            return "prior_cycle_not_sealed";
         if(m_branch_cycle_summary_id[row.branch] !=
               m_branch_cycle_id[row.branch])
            return "prior_cycle_summary_missing";
         if(!m_branch_reconciliation_summary[row.branch])
            return "prior_cycle_reconciliation_summary_missing";
         if(!m_branch_reconciliation_clean[row.branch])
            return "prior_cycle_reconciliation_unclean";
         if(!m_cycle_event_seen[row.branch]
               [LP_REVMA_TELEMETRY_CYCLE_CLOSE])
            return "prior_cycle_close_missing";
         if(m_cycle_event_seen[row.branch]
               [LP_REVMA_TELEMETRY_RUN_BOUNDARY_UNRESOLVED])
            return "prior_cycle_boundary_unresolved";
         if(m_branch_run_sealed[row.branch])
            return "branch_run_sealed";
      }
      if(!m_causal_matching_closed &&
         (row.branch == LP_REVMA_BRANCH_U ||
          row.branch == LP_REVMA_BRANCH_C))
      {
         int other_branch = row.branch == LP_REVMA_BRANCH_U ?
            LP_REVMA_BRANCH_C : LP_REVMA_BRANCH_U;
         bool other_is_previous =
            m_branch_cycle_id[other_branch] + 1 == row.branch_cycle_id &&
            m_branch_account_cycle_id[other_branch] + 1 ==
               row.account_cycle_id;
         bool other_is_same =
            m_branch_cycle_id[other_branch] == row.branch_cycle_id &&
            m_branch_account_cycle_id[other_branch] ==
               row.account_cycle_id &&
            m_branch_equity_reference_minor[other_branch] ==
               row.equity_reference_minor &&
            m_branch_budget_minor[other_branch] == row.budget_minor;
         if(!other_is_previous && !other_is_same)
            return "other_branch_cycle_linkage_invalid";
      }
      if(row.opportunity_id != 0)
         return "causal_opportunity_present";
      if(row.branch == LP_REVMA_BRANCH_R)
      {
         if(row.shared_origin_id != 0)
            return "causal_shared_origin_present";
         return "";
      }
      if(row.branch != LP_REVMA_BRANCH_U && row.branch != LP_REVMA_BRANCH_C)
         return "causal_branch_invalid";
      return "";
   }

   bool ValidateTransitionState(
      const LP_RevmaDiscoveryTransitionRow &row,
      string &failure_reason)
   {
      failure_reason = "";
      if(row.event_type == LP_REVMA_TELEMETRY_CYCLE_START)
      {
         failure_reason = CycleStartTransitionStateFailureReason(row);
         return failure_reason == "";
      }
      if(m_branch_run_sealed[row.branch])
         return false;
      if(m_branch_terminal_boundary_m1[row.branch] > 0 &&
         (row.event_type != LP_REVMA_TELEMETRY_CYCLE_START ||
          m_cycle_event_seen[row.branch]
             [LP_REVMA_TELEMETRY_RUN_BOUNDARY_UNRESOLVED] ||
          row.source_m1_time <= m_branch_terminal_boundary_m1[row.branch]))
         return false;
      if(m_last_source_m1_time > 0 &&
         row.source_m1_time < m_last_source_m1_time)
         return false;
      int slot = EventSymbolSlot(row.symbol_id);
      if(slot < 0 || slot >= LP_REVMA_TELEMETRY_SYMBOL_SLOTS ||
         m_last_logical_event_m1[row.branch][slot][row.event_type] >=
            row.source_m1_time)
         return false;
      if(row.event_type == LP_REVMA_TELEMETRY_CYCLE_START)
      {
         if(m_branch_cycle_id[row.branch] == 0)
         {
            if(row.branch_cycle_id != 1 || row.account_cycle_id != 1)
               return false;
         }
         else
         {
            if(m_branch_cycle_id[row.branch] >=
                  (ulong)LP_REVMA_GEOMETRY_ABS_LIMIT ||
               m_branch_account_cycle_id[row.branch] >=
                  (ulong)LP_REVMA_GEOMETRY_ABS_LIMIT ||
               row.branch_cycle_id != m_branch_cycle_id[row.branch] + 1 ||
               row.account_cycle_id !=
                  m_branch_account_cycle_id[row.branch] + 1 ||
               BranchHasOpenGrid(row.branch) ||
               BranchHasPendingFavorableDecision(row.branch) ||
               !m_branch_cycle_sealed[row.branch] ||
               m_branch_cycle_summary_id[row.branch] !=
                  m_branch_cycle_id[row.branch] ||
               !m_branch_reconciliation_summary[row.branch] ||
               !m_branch_reconciliation_clean[row.branch] ||
               !m_cycle_event_seen[row.branch]
                  [LP_REVMA_TELEMETRY_CYCLE_CLOSE] ||
               m_cycle_event_seen[row.branch]
                  [LP_REVMA_TELEMETRY_RUN_BOUNDARY_UNRESOLVED] ||
               m_branch_run_sealed[row.branch])
               return false;
         }
      }
      else
      {
         if(m_branch_cycle_id[row.branch] == 0 ||
            row.branch_cycle_id != m_branch_cycle_id[row.branch] ||
            row.account_cycle_id != m_branch_account_cycle_id[row.branch] ||
            row.equity_reference_minor !=
               m_branch_equity_reference_minor[row.branch] ||
            row.budget_minor != m_branch_budget_minor[row.branch] ||
            m_branch_cycle_sealed[row.branch])
            return false;
      }
      if(!m_causal_matching_closed &&
         (row.branch == LP_REVMA_BRANCH_U ||
          row.branch == LP_REVMA_BRANCH_C))
      {
         int other_branch = row.branch == LP_REVMA_BRANCH_U ?
            LP_REVMA_BRANCH_C : LP_REVMA_BRANCH_U;
         if(row.event_type == LP_REVMA_TELEMETRY_CYCLE_START)
         {
            bool other_is_previous =
               m_branch_cycle_id[other_branch] + 1 == row.branch_cycle_id &&
               m_branch_account_cycle_id[other_branch] + 1 ==
                  row.account_cycle_id;
            bool other_is_same =
               m_branch_cycle_id[other_branch] == row.branch_cycle_id &&
               m_branch_account_cycle_id[other_branch] ==
                  row.account_cycle_id &&
               m_branch_equity_reference_minor[other_branch] ==
                  row.equity_reference_minor &&
               m_branch_budget_minor[other_branch] == row.budget_minor;
            if(!other_is_previous && !other_is_same)
               return false;
         }
         else if(m_branch_cycle_id[other_branch] != row.branch_cycle_id ||
            m_branch_account_cycle_id[other_branch] != row.account_cycle_id ||
            m_branch_equity_reference_minor[other_branch] !=
               row.equity_reference_minor ||
            m_branch_budget_minor[other_branch] != row.budget_minor)
            return false;
      }
      bool one_shot_cycle_event =
         row.event_type == LP_REVMA_TELEMETRY_FIRST_INFEASIBILITY ||
         row.event_type == LP_REVMA_TELEMETRY_CLEANUP_LATCH ||
         row.event_type == LP_REVMA_TELEMETRY_CLEANUP_COMPLETE ||
         row.event_type == LP_REVMA_TELEMETRY_HARD_RISK_LATCH ||
         row.event_type == LP_REVMA_TELEMETRY_HARD_RISK_COMPLETE ||
         row.event_type == LP_REVMA_TELEMETRY_CYCLE_CLOSE ||
         row.event_type == LP_REVMA_TELEMETRY_RUN_BOUNDARY_UNRESOLVED;
      if(one_shot_cycle_event &&
         m_cycle_event_seen[row.branch][row.event_type])
         return false;
      if((row.event_type == LP_REVMA_TELEMETRY_CYCLE_CLOSE ||
          row.event_type == LP_REVMA_TELEMETRY_RUN_BOUNDARY_UNRESOLVED) &&
         BranchHasPendingFavorableDecision(row.branch))
         return false;
      if(row.event_type == LP_REVMA_TELEMETRY_FIRST_INFEASIBILITY &&
         (!MatchesFirstInfeasibilitySignature(row) ||
          !m_cycle_event_seen[row.branch]
             [LP_REVMA_TELEMETRY_CANDIDATE_REJECTION]))
         return false;
      bool terminal_candidate_decision =
         TerminalCandidateDecisionEvent(row.event_type);
      bool classified_candidate_observation = terminal_candidate_decision ||
         row.event_type == LP_REVMA_TELEMETRY_FIRST_DIVERGENCE ||
         row.event_type ==
            LP_REVMA_TELEMETRY_FAVORABLE_ELIGIBLE_AFTER_LATCH ||
         row.event_type == LP_REVMA_TELEMETRY_FIRST_INFEASIBILITY;
      if(classified_candidate_observation &&
         !AddClassificationMatchesLifecycle(row,
            m_lifecycle[row.branch][row.symbol_id]))
         return false;
      if(terminal_candidate_decision)
      {
         if(row.symbol_id < 0 || row.symbol_id >= LP_SYMBOL_COUNT ||
            row.source_m1_time <=
               m_last_candidate_decision_m1[row.branch][row.symbol_id] ||
            row.candidate_identity ==
               m_last_candidate_decision_id[row.branch][row.symbol_id])
            return false;
         LP_RevmaTelemetryLifecycleState candidate_state =
            m_lifecycle[row.branch][row.symbol_id];
         bool pending_favorable =
            m_pending_favorable_decision[row.branch][row.symbol_id];
         bool latched_c_add = row.branch == LP_REVMA_BRANCH_C &&
            candidate_state.open && candidate_state.center_triggered &&
            row.candidate_type != LP_REVMA_DISCOVERY_CANDIDATE_BIRTH;
         if(pending_favorable != MatchesPendingFavorableDecision(row) ||
            (latched_c_add && row.candidate_type ==
               LP_REVMA_DISCOVERY_CANDIDATE_FAVORABLE_ADD &&
             !pending_favorable) ||
            (latched_c_add && row.candidate_type ==
               LP_REVMA_DISCOVERY_CANDIDATE_ADVERSE_ADD &&
             row.event_type !=
                LP_REVMA_TELEMETRY_CENTER_BLOCKED_ADVERSE))
            return false;
      }
      if(row.event_type ==
         LP_REVMA_TELEMETRY_FAVORABLE_ELIGIBLE_AFTER_LATCH)
      {
         if(row.symbol_id < 0 || row.symbol_id >= LP_SYMBOL_COUNT ||
            m_pending_favorable_decision[row.branch][row.symbol_id] ||
            row.source_m1_time <=
               m_last_candidate_decision_m1[row.branch][row.symbol_id])
            return false;
      }
      if(row.event_type == LP_REVMA_TELEMETRY_BRANCH_BIRTH &&
         row.branch == LP_REVMA_BRANCH_C &&
         ((row.center_applicable &&
           (m_center_applicable_grids >= 2147483647 ||
            m_cycle_center_applicable_grids >= 2147483647)) ||
          (!row.center_applicable &&
           (m_center_not_applicable_grids >= 2147483647 ||
            m_cycle_center_not_applicable_grids >= 2147483647))))
         return false;
      if(row.event_type == LP_REVMA_TELEMETRY_CENTER_LATCH &&
         (m_center_triggered_grids >= 2147483647 ||
          m_cycle_center_triggered_grids >= 2147483647))
         return false;
      if(row.event_type == LP_REVMA_TELEMETRY_CENTER_BLOCKED_ADVERSE &&
         (m_center_blocked_adverse_candidates >= 2147483647 ||
          m_cycle_center_blocked_adverse_candidates >= 2147483647))
         return false;
      if(row.event_type ==
         LP_REVMA_TELEMETRY_FAVORABLE_ELIGIBLE_AFTER_LATCH &&
         (m_favorable_eligible_after_latch >= 2147483647 ||
          m_cycle_favorable_eligible_after_latch >= 2147483647))
         return false;
      if(row.event_type == LP_REVMA_TELEMETRY_GRID_CLOSE &&
         row.branch == LP_REVMA_BRANCH_C &&
         m_center_applicable[row.symbol_id] &&
         !m_center_triggered[row.symbol_id] &&
         (m_center_not_triggered_grids >= 2147483647 ||
          m_cycle_center_not_triggered_grids >= 2147483647))
         return false;
      if(row.symbol_id >= 0 && row.branch_grid_id != 0 &&
         (row.initial_history_boundary <= 0 ||
          (m_initial_history_boundary[row.symbol_id] != 0 &&
           row.initial_history_boundary !=
              m_initial_history_boundary[row.symbol_id])))
         return false;
      int branch_atoms = BranchCurrentAtoms(row.branch);
      bool branch_flat = branch_atoms == 0 &&
         !BranchHasOpenGrid(row.branch);
      long lifecycle_cycle_mark = 0;
      bool lifecycle_mark_valid = LP_RevmaTelemetrySafeMinorAdd(
         row.harvest_minor, row.nonharvest_minor,
         lifecycle_cycle_mark) &&
         LP_RevmaTelemetrySafeMinorAdd(lifecycle_cycle_mark,
            row.liability_minor, lifecycle_cycle_mark);
      if(row.event_type == LP_REVMA_TELEMETRY_CLEANUP_LATCH &&
         (m_cycle_event_seen[row.branch]
            [LP_REVMA_TELEMETRY_HARD_RISK_LATCH] ||
          branch_atoms <= 0 ||
          row.atoms_before != branch_atoms ||
          row.atoms_after != branch_atoms || row.harvest_minor <= 0 ||
          row.nonharvest_minor != 0 || row.liability_minor >= 0 ||
          !lifecycle_mark_valid || lifecycle_cycle_mark < 0))
         return false;
      bool exact_already_flat_hard_risk_latch = branch_flat &&
         branch_atoms == 0 && row.atoms_before == 0 && row.atoms_after == 0 &&
         row.reservation_minor == 0 && row.q_cash_minor == 0 &&
         row.margin_minor == 0 && row.liability_minor == 0;
      if(row.event_type == LP_REVMA_TELEMETRY_HARD_RISK_LATCH &&
         ((branch_atoms <= 0 && !exact_already_flat_hard_risk_latch) ||
          row.atoms_before != branch_atoms ||
          row.atoms_after != branch_atoms || !lifecycle_mark_valid ||
          lifecycle_cycle_mark > -row.budget_minor))
         return false;
      if(row.event_type == LP_REVMA_TELEMETRY_CLEANUP_COMPLETE &&
         (!m_cycle_event_seen[row.branch]
            [LP_REVMA_TELEMETRY_CLEANUP_LATCH] ||
          m_cycle_event_seen[row.branch]
            [LP_REVMA_TELEMETRY_HARD_RISK_LATCH] ||
          !branch_flat || row.atoms_before != 0 || row.atoms_after != 0 ||
          !lifecycle_mark_valid ||
          lifecycle_cycle_mark <= -row.budget_minor))
         return false;
      if(row.event_type == LP_REVMA_TELEMETRY_HARD_RISK_COMPLETE &&
         (!m_cycle_event_seen[row.branch]
            [LP_REVMA_TELEMETRY_HARD_RISK_LATCH] ||
          !branch_flat || row.atoms_before != 0 || row.atoms_after != 0))
         return false;
      if(row.event_type == LP_REVMA_TELEMETRY_CYCLE_CLOSE)
      {
         bool hard_path = m_cycle_event_seen[row.branch]
            [LP_REVMA_TELEMETRY_HARD_RISK_LATCH];
         bool cleanup_path = m_cycle_event_seen[row.branch]
            [LP_REVMA_TELEMETRY_CLEANUP_LATCH];
         string expected_terminal_reason =
            m_branch_close_owner[row.branch] ==
               LP_REVMA_DISCOVERY_CLOSE_HARD_RISK ? "account_risk" :
            (m_branch_close_owner[row.branch] ==
               LP_REVMA_DISCOVERY_CLOSE_CLEANUP ? "account_cleanup" :
             "cycle_flat");
         if(!branch_flat || row.atoms_before != 0 || row.atoms_after != 0 ||
            row.close_owner != m_branch_close_owner[row.branch] ||
            row.reason != expected_terminal_reason ||
            ((m_branch_first_infeasibility[row.branch] != "") !=
             m_cycle_event_seen[row.branch]
                [LP_REVMA_TELEMETRY_FIRST_INFEASIBILITY]) ||
            (hard_path && !m_cycle_event_seen[row.branch]
               [LP_REVMA_TELEMETRY_HARD_RISK_COMPLETE]) ||
            (!hard_path && cleanup_path &&
             !m_cycle_event_seen[row.branch]
               [LP_REVMA_TELEMETRY_CLEANUP_COMPLETE]))
            return false;
      }
      if(row.event_type == LP_REVMA_TELEMETRY_RUN_BOUNDARY_UNRESOLVED &&
           (branch_flat || branch_atoms <= 0 ||
            row.atoms_before != branch_atoms ||
            row.atoms_after != branch_atoms ||
            row.close_owner != m_branch_close_owner[row.branch] ||
            ((m_branch_first_infeasibility[row.branch] != "") !=
             m_cycle_event_seen[row.branch]
                [LP_REVMA_TELEMETRY_FIRST_INFEASIBILITY]) ||
            m_cycle_event_seen[row.branch][LP_REVMA_TELEMETRY_CYCLE_CLOSE] ||
           !BranchOpenGridTerminalSnapshotsComplete(
              row.branch, row.source_m1_time)))
          return false;
      if(!ValidateCausalState(row))
         return false;

      if(row.event_type == LP_REVMA_TELEMETRY_FIRST_INFEASIBILITY)
         return true;

      bool birth_decision =
         row.event_type == LP_REVMA_TELEMETRY_BRANCH_BIRTH ||
         (row.event_type == LP_REVMA_TELEMETRY_CANDIDATE_REJECTION &&
          row.candidate_type == LP_REVMA_DISCOVERY_CANDIDATE_BIRTH);
      if(birth_decision)
      {
         LP_RevmaTelemetryLifecycleState state =
            m_lifecycle[row.branch][row.symbol_id];
         if(m_grid_generation[row.branch][row.symbol_id] >=
            LP_REVMA_GEOMETRY_ABS_LIMIT)
            return false;
         long expected_generation =
            m_grid_generation[row.branch][row.symbol_id] + 1;
         ulong expected_grid_id = LP_RevmaDiscoveryGridIdentity(
            row.branch, row.symbol_id, expected_generation,
            row.branch_cycle_id, row.source_m1_time,
            row.signal_identity_hash);
         return !state.open &&
            (state.grid_id == 0 || state.terminal_summary_written) &&
            expected_generation > 0 &&
            row.grid_generation == expected_generation &&
            row.branch_grid_id == expected_grid_id;
      }
      if(row.symbol_id >= 0 && row.branch_grid_id != 0)
      {
         LP_RevmaTelemetryLifecycleState state =
            m_lifecycle[row.branch][row.symbol_id];
         if(!state.open || state.grid_id != row.branch_grid_id ||
             state.cycle_id != row.branch_cycle_id ||
             state.account_cycle_id != row.account_cycle_id ||
             state.grid_generation != row.grid_generation ||
             state.terminal_summary_written ||
             state.terminal_snapshot_written ||
             row.direction != state.direction ||
             row.shared_origin_id != state.shared_origin_id ||
              row.birth_bucket != state.birth_bucket ||
              row.center_alignment != state.center_alignment ||
              row.p0 != state.p0 ||
              row.stress_price != state.stress_price ||
              row.c0 != state.c0 ||
              row.q0 != state.q0 ||
              row.a_g_candidate_minor != state.a_g_candidate_minor ||
              row.a_g_minor != state.a_g_minor ||
             row.broker_tick_size != state.broker_tick_size ||
             row.p0_ticks != state.p0_ticks || row.c0_ticks != state.c0_ticks ||
             row.discovery_cell_ticks != state.discovery_cell_ticks ||
             row.discovery_cell_price != state.discovery_cell_price ||
             row.initial_history_boundary != state.initial_history_boundary ||
             row.center_applicable != state.center_applicable ||
             (row.event_type != LP_REVMA_TELEMETRY_ATOM_ADMISSION &&
              (row.adverse_add_count != state.adverse_add_count ||
               row.favorable_add_count != state.favorable_add_count)) ||
             (row.event_type != LP_REVMA_TELEMETRY_CENTER_LATCH &&
              row.center_latched != state.center_triggered) ||
             (row.event_type != LP_REVMA_TELEMETRY_CENTER_BLOCKED_ADVERSE &&
              row.blocked_adverse_count != state.blocked_adverse_count) ||
             row.source_m1_time < state.birth_m1_time ||
             (long)row.source_m1_time - (long)state.birth_m1_time >
                (long)2147483647 * 60 ||
             row.grid_age_minutes != (int)(((long)row.source_m1_time -
                (long)state.birth_m1_time) / 60))
             return false;
          if(row.event_type == LP_REVMA_TELEMETRY_ATOM_ADMISSION)
          {
             bool adverse_add = row.candidate_type ==
                LP_REVMA_DISCOVERY_CANDIDATE_ADVERSE_ADD;
             return row.atoms_before == state.atoms &&
                row.lots_before == state.lots &&
                row.source_m1_time > state.last_admission_m1_time &&
                row.candidate_identity != state.last_admission_identity &&
                state.adverse_add_count < 2147483647 &&
                state.favorable_add_count < 2147483647 &&
                row.adverse_add_count == state.adverse_add_count +
                   (adverse_add ? 1 : 0) &&
                row.favorable_add_count == state.favorable_add_count +
                   (adverse_add ? 0 : 1);
          }
          if(row.event_type == LP_REVMA_TELEMETRY_GRID_CLOSE)
             return row.atoms_before == state.atoms &&
                row.lots_before == state.lots;
           if(row.event_type == LP_REVMA_TELEMETRY_GRID_TERMINAL_SNAPSHOT)
              return row.atoms_before == state.atoms &&
                row.atoms_after == state.atoms &&
                 row.lots_before == state.lots && row.lots_after == state.lots;
          if(row.event_type == LP_REVMA_TELEMETRY_CANDIDATE_REJECTION)
             return row.atoms_before == state.atoms &&
                row.atoms_after == state.atoms &&
                row.lots_before == state.lots && row.lots_after == state.lots;
         if(row.event_type == LP_REVMA_TELEMETRY_CENTER_LATCH)
            return row.branch == LP_REVMA_BRANCH_C &&
               state.center_applicable && !state.center_triggered;
          if(row.event_type == LP_REVMA_TELEMETRY_CENTER_BLOCKED_ADVERSE ||
             row.event_type == LP_REVMA_TELEMETRY_FAVORABLE_ELIGIBLE_AFTER_LATCH)
          {
             if(row.branch != LP_REVMA_BRANCH_C || !state.center_applicable ||
                !state.center_triggered)
                return false;
              if(row.event_type == LP_REVMA_TELEMETRY_CENTER_BLOCKED_ADVERSE)
                 return state.blocked_adverse_count < 2147483647 &&
                    row.blocked_adverse_count ==
                       state.blocked_adverse_count + 1;
              return state.favorable_eligible_after_latch < 2147483647 &&
                 row.blocked_adverse_count == state.blocked_adverse_count;
          }
         if(row.event_type == LP_REVMA_TELEMETRY_FIRST_DIVERGENCE)
            return state.center_applicable && state.center_triggered &&
               !m_causal_matching_closed;
      }
      return true;
   }

   void ApplyTransitionState(const LP_RevmaDiscoveryTransitionRow &row)
   {
      m_last_source_m1_time = row.source_m1_time;
      int slot = EventSymbolSlot(row.symbol_id);
      m_last_logical_event_m1[row.branch][slot][row.event_type] =
         row.source_m1_time;
      if(row.symbol_id >= 0 && row.branch_grid_id != 0 &&
         m_initial_history_boundary[row.symbol_id] == 0)
         m_initial_history_boundary[row.symbol_id] =
            row.initial_history_boundary;
      if(m_branch_cycle_id[row.branch] != row.branch_cycle_id)
      {
         m_branch_cycle_id[row.branch] = row.branch_cycle_id;
         m_branch_account_cycle_id[row.branch] = row.account_cycle_id;
         m_branch_equity_reference_minor[row.branch] =
            row.equity_reference_minor;
         m_branch_budget_minor[row.branch] = row.budget_minor;
         m_branch_cycle_summary_id[row.branch] = 0;
         m_branch_cycle_sealed[row.branch] = false;
         m_branch_reconciliation_summary[row.branch] = false;
         m_branch_reconciliation_clean[row.branch] = false;
         m_branch_run_completion_summary[row.branch] = false;
         m_branch_run_formula_clean[row.branch] = false;
         m_branch_cleanup_funding_minor[row.branch] = 0;
         m_branch_close_owner[row.branch] =
            LP_REVMA_DISCOVERY_CLOSE_NONE;
         m_branch_cleanup_shortfall[row.branch] = false;
         m_branch_cycle_broker_contamination[row.branch] = false;
         m_branch_cycle_formula_clean[row.branch] = false;
         m_branch_cycle_reconciliation_clean[row.branch] = false;
         m_branch_terminal_reason[row.branch] = "";
         m_branch_first_infeasibility[row.branch] = "";
         m_branch_latest_infeasibility[row.branch] = "";
         m_branch_latest_infeasibility_m1[row.branch] = 0;
         m_first_infeasibility_grid_id[row.branch] = 0;
         m_first_infeasibility_grid_generation[row.branch] = 0;
         m_first_infeasibility_symbol_id[row.branch] = -1;
         m_first_infeasibility_candidate_type[row.branch] =
            LP_REVMA_DISCOVERY_CANDIDATE_NONE;
         m_first_infeasibility_candidate_id[row.branch] = 0;
         m_first_infeasibility_source_m1[row.branch] = 0;
         m_first_infeasibility_pre_state_hash[row.branch] = 0;
         m_first_infeasibility_snapshot_hash[row.branch] = 0;
         m_branch_terminal_boundary_m1[row.branch] = 0;
         InitializeSummaryLedgerIdentity(
            m_branch_summary_ledger[row.branch], row.branch,
            row.branch_cycle_id, -1);
         for(int event_type = 0;
            event_type <= LP_REVMA_TELEMETRY_EVENT_COUNT; event_type++)
            m_cycle_event_seen[row.branch][event_type] = false;
         for(int symbol_id = 0; symbol_id < LP_SYMBOL_COUNT; symbol_id++)
         {
            m_symbol_summary_written[row.branch][symbol_id] = false;
            m_top_offender_summary_written[row.branch][symbol_id] = false;
            m_last_candidate_decision_m1[row.branch][symbol_id] = 0;
            m_last_candidate_decision_id[row.branch][symbol_id] = 0;
            m_pending_favorable_decision[row.branch][symbol_id] = false;
            m_pending_favorable_candidate_id[row.branch][symbol_id] = 0;
            m_pending_favorable_source_m1[row.branch][symbol_id] = 0;
            m_pending_favorable_grid_id[row.branch][symbol_id] = 0;
            m_pending_favorable_pre_state_hash[row.branch][symbol_id] = 0;
            m_pending_favorable_snapshot_hash[row.branch][symbol_id] = 0;
            InitializeSummaryLedgerIdentity(
               m_symbol_summary_ledger[row.branch][symbol_id], row.branch,
               row.branch_cycle_id, symbol_id);
         }
         if(row.branch == LP_REVMA_BRANCH_C)
         {
            m_center_cycle_id = row.branch_cycle_id;
            m_cycle_center_applicable_grids = 0;
            m_cycle_center_triggered_grids = 0;
            m_cycle_center_not_triggered_grids = 0;
            m_cycle_center_not_applicable_grids = 0;
            m_cycle_center_blocked_adverse_candidates = 0;
            m_cycle_favorable_eligible_after_latch = 0;
            m_cycle_first_center_latch_time = 0;
         }
      }
      if(TerminalCandidateDecisionEvent(row.event_type))
      {
         m_last_candidate_decision_m1[row.branch][row.symbol_id] =
            row.source_m1_time;
         m_last_candidate_decision_id[row.branch][row.symbol_id] =
            row.candidate_identity;
         if(m_pending_favorable_decision[row.branch][row.symbol_id])
         {
            m_pending_favorable_decision[row.branch][row.symbol_id] = false;
            m_pending_favorable_candidate_id[row.branch][row.symbol_id] = 0;
            m_pending_favorable_source_m1[row.branch][row.symbol_id] = 0;
            m_pending_favorable_grid_id[row.branch][row.symbol_id] = 0;
            m_pending_favorable_pre_state_hash[row.branch][row.symbol_id] = 0;
            m_pending_favorable_snapshot_hash[row.branch][row.symbol_id] = 0;
         }
         if(row.event_type == LP_REVMA_TELEMETRY_CANDIDATE_REJECTION)
         {
            if(m_branch_first_infeasibility[row.branch] == "")
            {
               m_branch_first_infeasibility[row.branch] = row.reason;
               m_first_infeasibility_grid_id[row.branch] =
                  row.branch_grid_id;
               m_first_infeasibility_grid_generation[row.branch] =
                  row.grid_generation;
               m_first_infeasibility_symbol_id[row.branch] = row.symbol_id;
               m_first_infeasibility_candidate_type[row.branch] =
                  row.candidate_type;
               m_first_infeasibility_candidate_id[row.branch] =
                  row.candidate_identity;
               m_first_infeasibility_source_m1[row.branch] =
                  row.source_m1_time;
               m_first_infeasibility_pre_state_hash[row.branch] =
                  row.pre_candidate_state_hash;
               m_first_infeasibility_snapshot_hash[row.branch] =
                  row.matched_snapshot_hash;
            }
            m_branch_latest_infeasibility[row.branch] = row.reason;
            m_branch_latest_infeasibility_m1[row.branch] =
               row.source_m1_time;
         }
      }
      if(row.event_type == LP_REVMA_TELEMETRY_BRANCH_BIRTH)
      {
         LP_RevmaTelemetryLifecycleState state;
         LP_ResetRevmaTelemetryLifecycleState(state);
         state.open = true;
         state.grid_id = row.branch_grid_id;
         state.cycle_id = row.branch_cycle_id;
         state.account_cycle_id = row.account_cycle_id;
         state.grid_generation = row.grid_generation;
         state.shared_origin_id = row.shared_origin_id;
         state.birth_pre_candidate_state_hash =
            row.pre_candidate_state_hash;
         state.birth_matched_snapshot_hash = row.matched_snapshot_hash;
          state.birth_signal_identity_hash = row.signal_identity_hash;
          state.birth_m1_time = row.source_m1_time;
          state.direction = row.direction;
          state.birth_bucket = row.birth_bucket;
          state.center_alignment = row.center_alignment;
          state.p0 = row.p0;
          state.stress_price = row.stress_price;
          state.c0 = row.c0;
          state.q0 = row.q0;
          state.minimum_entry_price = row.fill_price;
          state.maximum_entry_price = row.fill_price;
          state.broker_tick_size = row.broker_tick_size;
          state.p0_ticks = row.p0_ticks;
          state.c0_ticks = row.c0_ticks;
          state.discovery_cell_ticks = row.discovery_cell_ticks;
          state.discovery_cell_price = row.discovery_cell_price;
          state.initial_history_boundary = row.initial_history_boundary;
          state.last_admission_m1_time = row.source_m1_time;
         state.last_admission_identity = row.candidate_identity;
          state.atoms = row.atoms_after;
          state.lots = row.lots_after;
          state.adverse_add_count = 0;
          state.favorable_add_count = 0;
          state.blocked_adverse_count = 0;
          state.a_g_candidate_minor = row.a_g_candidate_minor;
          state.a_g_minor = row.a_g_minor;
          state.current_reservation_minor = row.reservation_minor;
          state.current_q_cash_minor = row.q_cash_minor;
          state.current_margin_minor = row.margin_minor;
          state.center_applicable = row.center_applicable;
         m_lifecycle[row.branch][row.symbol_id] = state;
         m_grid_generation[row.branch][row.symbol_id] =
            row.grid_generation;
         if(row.branch == LP_REVMA_BRANCH_C)
         {
            m_center_grid_ids[row.symbol_id] = row.branch_grid_id;
            m_center_triggered[row.symbol_id] = false;
            m_center_closed[row.symbol_id] = false;
            m_center_applicable[row.symbol_id] = row.center_applicable;
            if(row.center_applicable)
            {
               m_center_applicable_grids++;
               m_cycle_center_applicable_grids++;
            }
            else
            {
               m_center_not_applicable_grids++;
               m_cycle_center_not_applicable_grids++;
            }
         }
      }
      else if(row.event_type == LP_REVMA_TELEMETRY_ATOM_ADMISSION)
      {
         m_lifecycle[row.branch][row.symbol_id].atoms = row.atoms_after;
         m_lifecycle[row.branch][row.symbol_id].lots = row.lots_after;
         m_lifecycle[row.branch][row.symbol_id].last_admission_m1_time =
            row.source_m1_time;
          m_lifecycle[row.branch][row.symbol_id].last_admission_identity =
             row.candidate_identity;
          m_lifecycle[row.branch][row.symbol_id].adverse_add_count =
             row.adverse_add_count;
           m_lifecycle[row.branch][row.symbol_id].favorable_add_count =
              row.favorable_add_count;
           if(row.fill_price <
              m_lifecycle[row.branch][row.symbol_id].minimum_entry_price)
              m_lifecycle[row.branch][row.symbol_id].minimum_entry_price =
                 row.fill_price;
           if(row.fill_price >
              m_lifecycle[row.branch][row.symbol_id].maximum_entry_price)
              m_lifecycle[row.branch][row.symbol_id].maximum_entry_price =
                 row.fill_price;
      }
      else if(row.event_type == LP_REVMA_TELEMETRY_CENTER_LATCH)
      {
         m_lifecycle[row.branch][row.symbol_id].center_triggered = true;
         m_lifecycle[row.branch][row.symbol_id].center_latch_time =
            row.center_latch_time;
         m_center_triggered[row.symbol_id] = true;
         m_center_triggered_grids++;
         m_cycle_center_triggered_grids++;
         if(m_first_center_latch_time == 0 ||
            row.center_latch_time < m_first_center_latch_time)
            m_first_center_latch_time = row.center_latch_time;
         if(m_cycle_first_center_latch_time == 0 ||
            row.center_latch_time < m_cycle_first_center_latch_time)
            m_cycle_first_center_latch_time = row.center_latch_time;
      }
      else if(row.event_type == LP_REVMA_TELEMETRY_CENTER_BLOCKED_ADVERSE)
      {
          m_lifecycle[row.branch][row.symbol_id].blocked_adverse_count =
             row.blocked_adverse_count;
          m_center_blocked_adverse_candidates++;
         m_cycle_center_blocked_adverse_candidates++;
      }
      else if(row.event_type == LP_REVMA_TELEMETRY_FAVORABLE_ELIGIBLE_AFTER_LATCH)
      {
         m_pending_favorable_decision[row.branch][row.symbol_id] = true;
         m_pending_favorable_candidate_id[row.branch][row.symbol_id] =
            row.candidate_identity;
         m_pending_favorable_source_m1[row.branch][row.symbol_id] =
            row.source_m1_time;
         m_pending_favorable_grid_id[row.branch][row.symbol_id] =
            row.branch_grid_id;
         m_pending_favorable_pre_state_hash[row.branch][row.symbol_id] =
            row.pre_candidate_state_hash;
         m_pending_favorable_snapshot_hash[row.branch][row.symbol_id] =
            row.matched_snapshot_hash;
         m_lifecycle[row.branch][row.symbol_id]
            .favorable_eligible_after_latch++;
         m_favorable_eligible_after_latch++;
         m_cycle_favorable_eligible_after_latch++;
      }
      else if(row.event_type == LP_REVMA_TELEMETRY_GRID_CLOSE)
      {
         CaptureTerminalLifecycleEvidence(row);
         m_lifecycle[row.branch][row.symbol_id].terminal_transition_m1_time =
            row.source_m1_time;
         m_lifecycle[row.branch][row.symbol_id].terminal_event_hash =
            row.event_hash;
         m_lifecycle[row.branch][row.symbol_id].terminal_internal_state_hash =
            row.terminal_internal_state_hash;
         m_lifecycle[row.branch][row.symbol_id].terminal_close_owner =
            row.close_owner;
         m_lifecycle[row.branch][row.symbol_id].terminal_reason =
            row.grid_terminal_reason;
         m_lifecycle[row.branch][row.symbol_id].open = false;
         m_lifecycle[row.branch][row.symbol_id].atoms = 0;
         m_lifecycle[row.branch][row.symbol_id].lots = 0.0;
         if(row.branch == LP_REVMA_BRANCH_C)
         {
            m_center_closed[row.symbol_id] = true;
            if(m_center_applicable[row.symbol_id] &&
               !m_center_triggered[row.symbol_id])
            {
               m_center_not_triggered_grids++;
               m_cycle_center_not_triggered_grids++;
            }
          }
      }
      else if(row.event_type == LP_REVMA_TELEMETRY_GRID_TERMINAL_SNAPSHOT)
      {
         CaptureTerminalLifecycleEvidence(row);
         m_lifecycle[row.branch][row.symbol_id].terminal_snapshot_written = true;
         m_lifecycle[row.branch][row.symbol_id].terminal_snapshot_m1_time =
            row.source_m1_time;
         m_lifecycle[row.branch][row.symbol_id].terminal_transition_m1_time =
            row.source_m1_time;
         m_lifecycle[row.branch][row.symbol_id].terminal_event_hash =
            row.event_hash;
         m_lifecycle[row.branch][row.symbol_id].terminal_internal_state_hash =
            row.terminal_internal_state_hash;
         m_lifecycle[row.branch][row.symbol_id].terminal_close_owner =
            row.close_owner;
         m_lifecycle[row.branch][row.symbol_id].terminal_reason =
            row.grid_terminal_reason;
      }
      else if(row.event_type == LP_REVMA_TELEMETRY_CLEANUP_LATCH)
      {
         m_branch_cleanup_funding_minor[row.branch] = row.harvest_minor;
         m_branch_close_owner[row.branch] =
            LP_REVMA_DISCOVERY_CLOSE_CLEANUP;
      }
      else if(row.event_type == LP_REVMA_TELEMETRY_HARD_RISK_LATCH)
         m_branch_close_owner[row.branch] =
            LP_REVMA_DISCOVERY_CLOSE_HARD_RISK;
      else if(row.event_type == LP_REVMA_TELEMETRY_CYCLE_CLOSE ||
         row.event_type == LP_REVMA_TELEMETRY_RUN_BOUNDARY_UNRESOLVED)
      {
         m_branch_terminal_boundary_m1[row.branch] = row.source_m1_time;
         m_branch_terminal_reason[row.branch] = row.reason;
      }
      else if(row.event_type == LP_REVMA_TELEMETRY_FAILURE)
         m_failure_event_count++;
      if(row.symbol_id >= 0 && row.symbol_id < LP_SYMBOL_COUNT &&
         row.branch_grid_id != 0 &&
         m_lifecycle[row.branch][row.symbol_id].grid_id ==
            row.branch_grid_id)
      {
         if(row.event_type == LP_REVMA_TELEMETRY_GRID_CLOSE)
         {
            m_lifecycle[row.branch][row.symbol_id]
               .current_reservation_minor = 0;
            m_lifecycle[row.branch][row.symbol_id].current_q_cash_minor = 0;
            m_lifecycle[row.branch][row.symbol_id].current_margin_minor = 0;
         }
         else
         {
            m_lifecycle[row.branch][row.symbol_id]
               .current_reservation_minor = row.reservation_minor;
            m_lifecycle[row.branch][row.symbol_id].current_q_cash_minor =
               row.q_cash_minor;
            m_lifecycle[row.branch][row.symbol_id].current_margin_minor =
               row.margin_minor;
         }
      }
      m_cycle_event_seen[row.branch][row.event_type] = true;
      ApplyCausalState(row);
   }

   bool SummaryConcurrentRiskState(
      const LP_RevmaDiscoverySummaryRow &row,
      LP_RevmaConcurrentBranchRiskState &state)
   {
      LP_ResetRevmaConcurrentBranchRiskState(state);
      state.valid = true;
      state.branch = row.branch;
      state.source_m1_time = row.terminal_source_m1_time;
      state.reservation_minor = row.current_reservation_minor;
      state.margin_minor = row.current_margin_minor;
      state.q_cash_minor = row.current_q_cash_minor;
      state.atom_count = row.current_atoms;
      state.active_grid_count = row.current_active_grid_count;
      state.concentration_q_cash_minor =
         row.current_concentration_q_cash_minor;
      state.concentration_currency_id =
         row.current_concentration_currency_id;
      state.marked_liquidation_minor = row.liability_minor;
      state.liquidation_liability_minor =
         row.current_liquidation_liability_minor;
      state.branch_equity_minor = row.branch_equity_minor;
      state.equity_high_water_minor = row.equity_high_water_minor;
      state.branch_drawdown_minor = row.branch_drawdown_minor;
      state.cycle_peak_reservation_minor =
         row.cycle_peak_reservation_minor;
      state.cycle_peak_margin_minor = row.cycle_peak_margin_minor;
      state.cycle_peak_q_cash_minor = row.cycle_peak_q_cash_minor;
      state.cycle_peak_atom_count = row.cycle_peak_atom_count;
      state.cycle_peak_active_grid_count = row.peak_active_grid_count;
      state.cycle_peak_concentration_q_cash_minor =
         row.peak_concentration_q_cash_minor;
      state.cycle_peak_concentration_currency_id =
         row.peak_concentration_currency_id;
      state.cycle_peak_liquidation_liability_minor =
         row.peak_liquidation_liability_minor;
      state.cycle_maximum_drawdown_minor = row.maximum_drawdown_minor;
      state.run_peak_reservation_minor = row.run_peak_reservation_minor;
      state.run_peak_margin_minor = row.run_peak_margin_minor;
      state.run_peak_q_cash_minor = row.run_peak_q_cash_minor;
      state.run_peak_atom_count = row.run_peak_atom_count;
      state.run_peak_active_grid_count = row.run_peak_active_grid_count;
      state.run_peak_concentration_q_cash_minor =
         row.run_peak_concentration_q_cash_minor;
      state.run_peak_concentration_currency_id =
         row.run_peak_concentration_currency_id;
      state.run_peak_liquidation_liability_minor =
         row.run_peak_liquidation_liability_minor;
      state.run_equity_high_water_minor = row.run_equity_high_water_minor;
      state.run_maximum_drawdown_minor = row.run_maximum_drawdown_minor;
      state.cycle_risk_snapshot_count = row.cycle_risk_snapshot_count;
      state.cycle_risk_snapshot_hash = row.cycle_risk_snapshot_hash;
      state.run_risk_snapshot_count = row.run_risk_snapshot_count;
      state.run_risk_snapshot_hash = row.run_risk_snapshot_hash;
      state.cycle_candidate_built_count = row.cycle_candidate_built_count;
      state.cycle_candidate_decision_count =
         row.cycle_candidate_decision_count;
      state.cycle_candidate_admitted_count =
         row.cycle_candidate_admitted_count;
      state.cycle_candidate_rejected_count =
         row.cycle_candidate_rejected_count;
      state.cycle_inventory_transition_count =
         row.cycle_inventory_transition_count;
      state.run_candidate_built_count = row.run_candidate_built_count;
      state.run_candidate_decision_count = row.run_candidate_decision_count;
      state.run_candidate_admitted_count = row.run_candidate_admitted_count;
      state.run_candidate_rejected_count = row.run_candidate_rejected_count;
      state.run_inventory_transition_count =
         row.run_inventory_transition_count;
      state.state_hash = LP_RevmaConcurrentBranchRiskIdentity(state);
      return state.state_hash != 0 &&
         state.state_hash == row.terminal_risk_state_hash &&
         LP_RevmaConcurrentBranchRiskStateValid(state);
   }

   bool ValidateSummaryState(const LP_RevmaDiscoverySummaryRow &row)
   {
      long expected_realized = 0;
      long expected_managed = 0;
      long expected_equity = 0;
      long expected_owner_nonharvest = 0;
      long expected_budget_minor = 0;
      bool aggregate_money_scope = row.summary_type == "cycle" ||
         row.summary_type == "reconciliation" ||
         row.summary_type == "run_completion";
      if(row.branch_cycle_id == 0 || row.account_cycle_id == 0 ||
          m_branch_run_sealed[row.branch] ||
          m_branch_cycle_id[row.branch] != row.branch_cycle_id ||
          m_branch_account_cycle_id[row.branch] != row.account_cycle_id ||
          row.equity_reference_minor !=
             m_branch_equity_reference_minor[row.branch] ||
          row.budget_minor != m_branch_budget_minor[row.branch] ||
         row.current_atoms < 0 || row.peak_atoms < row.current_atoms ||
         !LP_RevmaTelemetryLotsMatchAtoms(row.current_lots,
            row.current_atoms) ||
         !LP_RevmaTelemetryLotsMatchAtoms(row.peak_lots, row.peak_atoms) ||
         row.peak_lots < row.current_lots ||
         row.current_reservation_minor < 0 || row.current_margin_minor < 0 ||
         row.peak_reservation_minor < row.current_reservation_minor ||
         row.peak_margin_minor < row.current_margin_minor ||
         row.peak_q_cash_minor < 0 ||
         row.peak_reservation_overrun_minor < 0 ||
         row.maximum_adverse_excursion_minor < 0 ||
         row.maximum_age_minutes < 0 || row.time_underwater_minutes < 0 ||
         row.local_harvest_close_count < 0 || row.cleanup_close_count < 0 ||
         row.hard_risk_close_count < 0 ||
         row.cost_minor < 0 ||
         row.marked_after_cost_minor != row.liability_minor ||
         row.local_harvest_pnl_minor != row.harvest_minor ||
         !LP_RevmaTelemetrySafeMinorAdd(row.cleanup_pnl_minor,
            row.hard_risk_pnl_minor, expected_owner_nonharvest) ||
         expected_owner_nonharvest != row.nonharvest_minor ||
         (row.local_harvest_close_count == 0 &&
          row.local_harvest_pnl_minor != 0) ||
         (row.cleanup_close_count == 0 && row.cleanup_pnl_minor != 0) ||
         (row.hard_risk_close_count == 0 && row.hard_risk_pnl_minor != 0) ||
         row.budget_minor <= 0 || row.equity_reference_minor <= 0 ||
         !LP_RevmaDiscoveryCapitalBudgetMinor(row.equity_reference_minor,
            expected_budget_minor) || row.budget_minor != expected_budget_minor ||
         !LP_RevmaTelemetrySafeMinorAdd(row.harvest_minor, row.nonharvest_minor,
            expected_realized) ||
         expected_realized != row.realized_after_cost_minor ||
         !LP_RevmaTelemetrySafeMinorAdd(expected_realized, row.liability_minor,
            expected_managed) ||
         expected_managed != row.managed_cycle_pnl_minor ||
         !LP_RevmaTelemetrySafeMinorAdd(row.equity_reference_minor,
            expected_managed, expected_equity) ||
         expected_equity != row.branch_equity_minor ||
         row.cleanup_funding_minor != (aggregate_money_scope ?
            m_branch_cleanup_funding_minor[row.branch] : 0) ||
         row.cleanup_funding_minor < 0 ||
         row.unresolved_inventory != !row.final_flat ||
         (row.formula_clean && (!row.reconciliation_clean ||
          row.broker_contamination)) ||
         (row.latest_infeasibility == "" &&
          row.latest_infeasibility_m1_time != 0) ||
         (row.latest_infeasibility != "" &&
           row.latest_infeasibility_m1_time <= 0) ||
         (row.summary_type != "grid" &&
          row.summary_type != "run_completion" &&
          (row.terminal_source_m1_time != 0 ||
           row.terminal_grid_state_hash != 0 ||
           row.terminal_book_hash != 0 ||
           row.terminal_projection_hash != 0 ||
           row.terminal_risk_state_hash != 0)) ||
         (row.summary_type == "grid" &&
          (row.terminal_projection_hash == 0 ||
           row.terminal_risk_state_hash != 0)) ||
         (row.summary_type == "run_completion" &&
          (row.terminal_projection_hash != 0 ||
           row.terminal_risk_state_hash == 0)) ||
          (row.terminal_reason == "" &&
           !(row.summary_type == "grid" && !row.final_flat)))
          return false;
      bool aggregate_integrity_scope = row.summary_type == "cycle" ||
         row.summary_type == "reconciliation" ||
         row.summary_type == "run_completion";
      if(aggregate_integrity_scope)
      {
         bool expected_cleanup_shortfall = row.final_flat &&
            row.close_owner == LP_REVMA_DISCOVERY_CLOSE_CLEANUP &&
            row.branch_equity_minor <
               m_branch_equity_reference_minor[row.branch];
         if(row.first_infeasibility !=
               m_branch_first_infeasibility[row.branch] ||
            row.latest_infeasibility !=
               m_branch_latest_infeasibility[row.branch] ||
            row.latest_infeasibility_m1_time !=
               m_branch_latest_infeasibility_m1[row.branch] ||
            row.terminal_reason != m_branch_terminal_reason[row.branch] ||
            row.cleanup_shortfall != expected_cleanup_shortfall)
            return false;
         if(row.summary_type != "cycle" &&
            (row.cleanup_shortfall !=
                m_branch_cleanup_shortfall[row.branch] ||
             row.broker_contamination !=
                m_branch_cycle_broker_contamination[row.branch] ||
             row.formula_clean !=
                m_branch_cycle_formula_clean[row.branch] ||
             row.reconciliation_clean !=
                m_branch_cycle_reconciliation_clean[row.branch]))
            return false;
      }
      else if(row.cleanup_shortfall || row.broker_contamination ||
         !row.formula_clean || !row.reconciliation_clean ||
         row.first_infeasibility != "" ||
         row.latest_infeasibility != "" ||
         row.latest_infeasibility_m1_time != 0)
         return false;
      if(m_branch_reconciliation_summary[row.branch] &&
         row.summary_type != "run_completion")
         return false;
      if(m_branch_cycle_sealed[row.branch] &&
         row.summary_type != "reconciliation" &&
         row.summary_type != "run_completion")
         return false;
      if(row.summary_type == "grid")
      {
         if(row.symbol_id < 0 || row.symbol_id >= LP_SYMBOL_COUNT ||
            row.branch_grid_id == 0 ||
            (row.direction != LP_SIDE_LONG &&
             row.direction != LP_SIDE_SHORT))
            return false;
          LP_RevmaTelemetryLifecycleState state =
             m_lifecycle[row.branch][row.symbol_id];
          if(state.grid_id != row.branch_grid_id ||
             state.cycle_id != row.branch_cycle_id ||
             state.terminal_summary_written || row.final_flat == state.open ||
             row.direction != state.direction ||
             row.birth_time != state.birth_m1_time ||
             row.close_owner != state.terminal_close_owner ||
             row.terminal_reason != state.terminal_reason ||
             row.terminal_projection_hash !=
                state.terminal_projection_hash ||
              !GridSummaryMatchesTerminal(row, state))
              return false;
           LP_RevmaTelemetrySummaryLedger symbol_projection =
              m_symbol_summary_ledger[row.branch][row.symbol_id];
           LP_RevmaTelemetrySummaryLedger branch_projection =
              m_branch_summary_ledger[row.branch];
           if(!AccumulateGridSummary(row, symbol_projection) ||
              !AccumulateGridSummary(row, branch_projection))
              return false;
          if(row.final_flat)
             return !state.terminal_snapshot_written &&
                state.terminal_transition_m1_time > 0 &&
                row.close_time == state.terminal_transition_m1_time &&
                row.current_atoms == 0 && row.current_lots == 0.0;
          return state.terminal_snapshot_written &&
             state.terminal_snapshot_m1_time ==
                m_branch_terminal_boundary_m1[row.branch] &&
             state.terminal_transition_m1_time ==
                m_branch_terminal_boundary_m1[row.branch] &&
             row.close_time == 0 &&
             row.current_atoms == state.atoms && row.current_lots == state.lots;
      }
      if(row.summary_type == "symbol")
      {
         if(row.symbol_id < 0 || row.symbol_id >= LP_SYMBOL_COUNT ||
            row.branch_grid_id != 0 ||
            row.close_owner != LP_REVMA_DISCOVERY_CLOSE_NONE ||
            (row.peak_atoms > 0 && row.direction != LP_SIDE_LONG &&
             row.direction != LP_SIDE_SHORT) ||
            (row.peak_atoms == 0 && row.direction != LP_SIDE_NONE))
            return false;
         return !m_symbol_summary_written[row.branch][row.symbol_id] &&
            m_branch_terminal_boundary_m1[row.branch] > 0 &&
            row.direction ==
               m_symbol_summary_ledger[row.branch][row.symbol_id]
                  .peak_direction &&
            row.final_flat == (row.current_atoms == 0) &&
            SummaryMatchesLedger(row,
               m_symbol_summary_ledger[row.branch][row.symbol_id], true);
      }
      if(row.summary_type == "top_offender")
      {
         if(BranchTopOffenderSummaryComplete(row.branch))
            return false;
         if(row.close_owner != LP_REVMA_DISCOVERY_CLOSE_NONE)
            return false;
         if(m_branch_terminal_boundary_m1[row.branch] <= 0 ||
            !BranchGridSummariesComplete(row.branch) ||
            !BranchSymbolSummariesComplete(row.branch))
            return false;
         int expected_symbol = ExpectedTopOffenderSymbolId(row.branch);
         if(expected_symbol < 0)
            return row.symbol_id == -1 && row.direction == LP_SIDE_NONE &&
               SummaryMatchesLedger(row,
                  m_branch_summary_ledger[row.branch], true);
         return row.symbol_id == expected_symbol &&
            row.direction == m_symbol_summary_ledger[row.branch]
               [expected_symbol].peak_direction &&
            SummaryMatchesLedger(row,
               m_symbol_summary_ledger[row.branch][expected_symbol], true);
      }
      if(row.symbol_id != -1 || row.branch_grid_id != 0)
         return false;
      if(row.direction != LP_SIDE_NONE)
         return false;
      if(row.close_owner != m_branch_close_owner[row.branch])
         return false;
      if((row.summary_type == "cycle" || row.summary_type == "reconciliation" ||
          row.summary_type == "run_completion") &&
         (row.current_atoms != BranchCurrentAtoms(row.branch) ||
          NormalizeDouble(row.current_lots, 2) != BranchCurrentLots(row.branch) ||
          row.final_flat != !BranchHasOpenGrid(row.branch)))
         return false;
      if(row.summary_type == "cycle")
         return !m_branch_cycle_sealed[row.branch] &&
            ((row.final_flat && m_cycle_event_seen[row.branch]
               [LP_REVMA_TELEMETRY_CYCLE_CLOSE]) ||
             (!row.final_flat && m_cycle_event_seen[row.branch]
               [LP_REVMA_TELEMETRY_RUN_BOUNDARY_UNRESOLVED])) &&
             BranchGridSummariesComplete(row.branch) &&
             BranchSymbolSummariesComplete(row.branch) &&
             BranchTopOffenderSummaryComplete(row.branch) &&
              SummaryMatchesLedger(row,
                 m_branch_summary_ledger[row.branch], true);
      if(row.summary_type == "reconciliation")
         return !m_branch_reconciliation_summary[row.branch] &&
            m_branch_cycle_sealed[row.branch] &&
             m_branch_cycle_summary_id[row.branch] == row.branch_cycle_id &&
             BranchGridSummariesComplete(row.branch) &&
              SummaryMatchesLedger(row,
                 m_branch_summary_ledger[row.branch], true);
      if(row.summary_type == "run_completion")
      {
         ulong expected_terminal_grid_evidence_hash =
            BranchTerminalGridEvidenceHash(row.branch, row.branch_cycle_id,
               row.terminal_source_m1_time);
         LP_RevmaConcurrentBranchRiskState terminal_risk;
         bool risk_state_clean = SummaryConcurrentRiskState(row,
            terminal_risk);
         ulong expected_terminal_book_hash =
            LP_RevmaDiscoveryTerminalBookIdentity(
               row.branch, row.branch_cycle_id,
               row.terminal_source_m1_time, row.final_flat,
               row.current_atoms, row.current_lots,
               row.equity_reference_minor, row.budget_minor,
               row.harvest_minor, row.nonharvest_minor,
               row.liability_minor, row.cost_minor,
               row.current_reservation_minor, row.current_margin_minor,
               row.branch_equity_minor, row.close_owner,
               row.cleanup_shortfall,
               row.close_owner == LP_REVMA_DISCOVERY_CLOSE_HARD_RISK,
               terminal_risk,
               row.terminal_grid_state_hash);
         return !m_branch_run_completion_summary[row.branch] &&
            risk_state_clean &&
            row.cycle_candidate_built_count ==
               row.writer_cycle_candidate_decision_rows &&
            row.cycle_candidate_decision_count ==
               row.writer_cycle_candidate_decision_rows &&
            row.cycle_candidate_admitted_count ==
               row.writer_cycle_candidate_admitted_rows &&
            row.cycle_candidate_rejected_count ==
               row.writer_cycle_candidate_rejected_rows &&
            row.cycle_inventory_transition_count ==
               row.writer_cycle_inventory_transition_rows &&
            row.run_candidate_built_count ==
               row.writer_run_candidate_decision_rows &&
            row.run_candidate_decision_count ==
               row.writer_run_candidate_decision_rows &&
            row.run_candidate_admitted_count ==
               row.writer_run_candidate_admitted_rows &&
            row.run_candidate_rejected_count ==
               row.writer_run_candidate_rejected_rows &&
            row.run_inventory_transition_count ==
               row.writer_run_inventory_transition_rows &&
            row.writer_branch_transition_rows ==
               m_writer_branch_transition_rows[row.branch] &&
            m_branch_reconciliation_summary[row.branch] &&
            m_branch_reconciliation_clean[row.branch] &&
            m_branch_cycle_sealed[row.branch] &&
            row.terminal_branch_transition_hash ==
               m_branch_transition_chain[row.branch] &&
             row.terminal_source_m1_time ==
                m_branch_terminal_boundary_m1[row.branch] &&
             expected_terminal_grid_evidence_hash != 0 &&
             row.terminal_grid_state_hash ==
                expected_terminal_grid_evidence_hash &&
             expected_terminal_book_hash != 0 &&
            row.terminal_book_hash == expected_terminal_book_hash &&
            BranchGridSummariesComplete(row.branch) &&
            SummaryMatchesLedger(row,
               m_branch_summary_ledger[row.branch], false);
      }
      return false;
   }

   void ApplySummaryState(const LP_RevmaDiscoverySummaryRow &row)
   {
      if(row.summary_type == "grid")
      {
         if(!AccumulateGridSummary(row,
               m_symbol_summary_ledger[row.branch][row.symbol_id]) ||
            !AccumulateGridSummary(row,
               m_branch_summary_ledger[row.branch]))
         {
            Invalidate("summary_rollup_commit_failure");
            return;
         }
         m_lifecycle[row.branch][row.symbol_id].terminal_summary_written = true;
      }
      else if(row.summary_type == "symbol")
         m_symbol_summary_written[row.branch][row.symbol_id] = true;
      else if(row.summary_type == "top_offender")
      {
         int offender_slot = row.symbol_id < 0 ? 0 : row.symbol_id;
         m_top_offender_summary_written[row.branch][offender_slot] = true;
      }
      else if(row.summary_type == "cycle")
      {
         m_branch_cycle_summary_id[row.branch] = row.branch_cycle_id;
         m_branch_cycle_sealed[row.branch] = true;
         m_branch_cleanup_shortfall[row.branch] = row.cleanup_shortfall;
         m_branch_cycle_broker_contamination[row.branch] =
            row.broker_contamination;
         m_branch_cycle_formula_clean[row.branch] = row.formula_clean;
         m_branch_cycle_reconciliation_clean[row.branch] =
            row.reconciliation_clean;
      }
      else if(row.summary_type == "reconciliation")
      {
         m_branch_reconciliation_summary[row.branch] = true;
         m_branch_reconciliation_clean[row.branch] = row.reconciliation_clean;
      }
      else if(row.summary_type == "run_completion")
      {
         m_branch_run_completion_summary[row.branch] = true;
         m_branch_run_formula_clean[row.branch] = row.formula_clean &&
            row.reconciliation_clean;
         m_run_completion_bound_chain[row.branch] =
            row.terminal_branch_transition_hash;
         m_branch_terminal_book_hash[row.branch] = row.terminal_book_hash;
         m_branch_terminal_grid_state_hash[row.branch] =
            row.terminal_grid_state_hash;
         m_branch_run_final_flat[row.branch] = row.final_flat;
         m_branch_run_sealed[row.branch] = true;
      }
   }

   int UnresolvedCenterNotTriggeredCount(const ulong cycle_id)
   {
      int count = 0;
      for(int symbol_id = 0; symbol_id < LP_SYMBOL_COUNT; symbol_id++)
      {
         LP_RevmaTelemetryLifecycleState state =
            m_lifecycle[LP_REVMA_BRANCH_C][symbol_id];
         if(state.open && state.cycle_id == cycle_id &&
            state.center_applicable && !state.center_triggered)
            count++;
      }
      return count;
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
      long pending_bytes = transition ? m_transition_pending_bytes : m_summary_pending_bytes;
      if(current_bytes > LP_REVMA_DISCOVERY_ARTIFACT_BYTE_GUARD - pending_bytes - line_bytes)
      {
         Invalidate("telemetry_artifact_byte_guard");
         return false;
      }
      return true;
   }

   bool FlushTransitionBuffer()
   {
      if(!m_valid || m_transition_handle == INVALID_HANDLE) return false;
      ulong started_at = GetMicrosecondCount();
      for(int i = 0; i < m_transition_count; i++)
      {
         uint written = FileWriteString(m_transition_handle, m_transition_buffer[i] + "\r\n");
         if((long)written != m_transition_line_bytes[i])
         {
            Invalidate("transition_artifact_write_failed");
            return false;
         }
         m_transition_bytes += written;
         m_transition_pending_bytes -= m_transition_line_bytes[i];
         m_transition_committed_rows++;
         m_committed_transition_chain_hash = m_transition_chain_hash_buffer[i];
         m_transition_buffer[i] = "";
         m_transition_row_hash_buffer[i] = 0;
         m_transition_chain_hash_buffer[i] = 0;
         m_transition_line_bytes[i] = 0;
      }
      FileFlush(m_transition_handle);
      if(FileTell(m_transition_handle) != m_transition_bytes)
      {
         Invalidate("transition_artifact_file_position_mismatch");
         return false;
      }
      m_transition_count = 0;
      m_transition_flushes++;
      long elapsed = (long)(GetMicrosecondCount() - started_at);
      m_transition_flush_microseconds += elapsed;
      if(elapsed > m_transition_flush_max_microseconds)
         m_transition_flush_max_microseconds = elapsed;
      return true;
   }

   bool FlushSummaryBuffer()
   {
      if(!m_valid || m_summary_handle == INVALID_HANDLE) return false;
      ulong started_at = GetMicrosecondCount();
      for(int i = 0; i < m_summary_count; i++)
      {
         uint written = FileWriteString(m_summary_handle, m_summary_buffer[i] + "\r\n");
         if((long)written != m_summary_line_bytes[i])
         {
            Invalidate("summary_artifact_write_failed");
            return false;
         }
         m_summary_bytes += written;
         m_summary_pending_bytes -= m_summary_line_bytes[i];
         m_summary_committed_rows++;
         m_committed_summary_chain_hash = m_summary_chain_hash_buffer[i];
         m_summary_buffer[i] = "";
         m_summary_row_hash_buffer[i] = 0;
         m_summary_chain_hash_buffer[i] = 0;
         m_summary_line_bytes[i] = 0;
      }
      FileFlush(m_summary_handle);
      if(FileTell(m_summary_handle) != m_summary_bytes)
      {
         Invalidate("summary_artifact_file_position_mismatch");
         return false;
      }
      m_summary_count = 0;
      m_summary_flushes++;
      long elapsed = (long)(GetMicrosecondCount() - started_at);
      m_summary_flush_microseconds += elapsed;
      if(elapsed > m_summary_flush_max_microseconds)
         m_summary_flush_max_microseconds = elapsed;
      return true;
   }

   string TransitionLine(const LP_RevmaDiscoveryTransitionRow &row)
   {
      string f[170];
      int n = 0;
      f[n++] = LP_RevmaTelemetryCsv(LP_REVMA_DISCOVERY_TELEMETRY_SCHEMA_ID);
      f[n++] = LP_RevmaTelemetryCsv(LP_RevmaDiscoveryTelemetryEventName(row.event_type));
      f[n++] = (string)row.sequence;
      f[n++] = (string)row.event_time;
      f[n++] = (string)row.source_m1_time;
      f[n++] = LP_RevmaTelemetryCsv(row.run_id);
      f[n++] = LP_RevmaTelemetryCsv(row.source_revision);
      f[n++] = LP_RevmaTelemetryCsv(row.profile_id);
      f[n++] = (string)row.profile_hash;
      f[n++] = (string)row.config_hash;
      f[n++] = (string)row.formula_hash;
      f[n++] = (string)row.signal_identity_hash;
      f[n++] = IntegerToString(row.q_day_count);
      f[n++] = (string)row.q_event_count;
      f[n++] = (string)row.reconstruction_epoch;
      f[n++] = LP_RevmaTelemetryCsv(LP_RevmaDiscoveryBranchId(row.branch));
      f[n++] = (string)row.branch_grid_id;
      f[n++] = (string)row.branch_cycle_id;
      f[n++] = (string)row.account_cycle_id;
      f[n++] = (string)row.grid_generation;
      f[n++] = (string)row.candidate_identity;
      f[n++] = (string)row.shared_origin_id;
      f[n++] = (string)row.opportunity_id;
      f[n++] = (string)row.matched_snapshot_hash;
      f[n++] = (string)row.shared_observation_snapshot_hash;
      f[n++] = (string)row.strategy_state_identity_hash;
      f[n++] = IntegerToString(row.symbol_id);
      f[n++] = IntegerToString(row.direction);
      f[n++] = IntegerToString(row.candidate_type);
      f[n++] = LP_RevmaTelemetryCsv(row.birth_bucket);
      f[n++] = LP_RevmaTelemetryCsv(row.center_alignment);
      f[n++] = DoubleToString(row.p0, 12);
      f[n++] = DoubleToString(row.stress_price, 12);
      f[n++] = DoubleToString(row.fill_price, 12);
      f[n++] = DoubleToString(row.current_price, 12);
      f[n++] = DoubleToString(row.c0, 12);
      f[n++] = DoubleToString(row.previous_center, 12);
      f[n++] = DoubleToString(row.current_center, 12);
      f[n++] = DoubleToString(row.q0, 12);
      f[n++] = DoubleToString(row.current_q, 12);
      f[n++] = LP_RevmaTelemetryCsv(row.q_profile_id);
      f[n++] = IntegerToString(row.q_event_cadence);
      f[n++] = DoubleToString(row.current_q_ratio, 12);
      f[n++] = (string)row.discovery_cell_ticks;
      f[n++] = DoubleToString(row.discovery_cell_price, 12);
      f[n++] = DoubleToString(row.broker_tick_size, 12);
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
      f[n++] = IntegerToString(row.center_observation_index);
      f[n++] = IntegerToString(row.center_not_available_count);
      f[n++] = IntegerToString(row.first_center_update_observation_index);
      f[n++] = IntegerToString(row.last_center_update_observation_index);
      f[n++] = IntegerToString(row.first_center_update_q_event_index);
      f[n++] = IntegerToString(row.last_center_update_q_event_index);
      f[n++] = (string)row.first_center_update_time;
      f[n++] = (string)row.last_center_update_time;
      f[n++] = IntegerToString(row.center_staleness_minutes);
      f[n++] = DoubleToString(row.cumulative_signed_revision_q, 12);
      f[n++] = DoubleToString(row.cumulative_absolute_revision_q, 12);
      f[n++] = DoubleToString(row.minimum_support_q, 12);
      f[n++] = DoubleToString(row.maximum_support_q, 12);
      f[n++] = DoubleToString(row.regression_sum_x, 12);
      f[n++] = DoubleToString(row.regression_sum_y, 12);
      f[n++] = DoubleToString(row.regression_sum_x2, 12);
      f[n++] = DoubleToString(row.regression_sum_xy, 12);
      f[n++] = IntegerToString(row.blocked_adverse_count);
      f[n++] = (string)row.previous_cell_index;
      f[n++] = (string)row.current_cell_index;
      f[n++] = (string)row.total_cell_path;
      f[n++] = (string)row.completed_cell_crossings;
      f[n++] = (string)row.unfilled_jump_cells;
      f[n++] = (string)row.matched_reversal_crossings;
      f[n++] = (string)row.adverse_frontier_expansions;
      f[n++] = (string)row.favorable_frontier_expansions;
      f[n++] = (string)row.max_cell_jump;
      f[n++] = IntegerToString(row.last_movement_sign);
      f[n++] = (string)row.minimum_cell_index;
      f[n++] = (string)row.maximum_cell_index;
      f[n++] = (string)row.new_extreme_count;
      f[n++] = (string)row.initial_history_boundary;
      f[n++] = (string)row.last_reversal_m1;
      f[n++] = IntegerToString(row.time_since_last_reversal_minutes);
      f[n++] = (string)row.last_positive_liquidation_opportunity_m1;
      f[n++] = IntegerToString(
         row.time_since_positive_liquidation_opportunity_minutes);
      f[n++] = IntegerToString(row.atoms_before);
      f[n++] = IntegerToString(row.atoms_after);
      f[n++] = DoubleToString(row.lots_before, 2);
      f[n++] = DoubleToString(row.lots_after, 2);
      f[n++] = (string)row.reservation_minor;
      f[n++] = (string)row.q_cash_minor;
      f[n++] = (string)row.prospective_reservation_minor;
      f[n++] = (string)row.prospective_q_cash_minor;
      f[n++] = (string)row.a_g_candidate_minor;
      f[n++] = (string)row.a_g_minor;
      f[n++] = IntegerToString(row.reservation_overrun ? 1 : 0);
      f[n++] = (string)row.reservation_overrun_minor;
      f[n++] = (string)row.margin_minor;
      f[n++] = (string)row.incremental_margin_minor;
      f[n++] = (string)row.incremental_liquidation_minor;
      f[n++] = (string)row.incremental_close_cost_minor;
      f[n++] = (string)row.concentration_q_cash_minor;
      f[n++] = IntegerToString(row.concentration_currency_id);
      f[n++] = (string)row.commission_minor;
      f[n++] = (string)row.swap_minor;
      f[n++] = (string)row.liquidation_cost_minor;
      f[n++] = (string)row.maximum_adverse_excursion_minor;
      f[n++] = IntegerToString(row.grid_age_minutes);
      f[n++] = IntegerToString(row.time_underwater_minutes);
      f[n++] = DoubleToString(row.weighted_entry_sum, 12);
      f[n++] = IntegerToString(row.adverse_add_count);
      f[n++] = IntegerToString(row.favorable_add_count);
      f[n++] = (string)row.harvest_minor;
      f[n++] = (string)row.nonharvest_minor;
      f[n++] = (string)row.liability_minor;
      f[n++] = (string)row.budget_minor;
      f[n++] = (string)row.equity_reference_minor;
      f[n++] = IntegerToString(row.close_owner);
      f[n++] = LP_RevmaTelemetryCsv(row.decision);
      f[n++] = LP_RevmaTelemetryCsv(row.reason);
      f[n++] = LP_RevmaTelemetryCsv(row.grid_terminal_reason);
      f[n++] = (string)row.pre_candidate_state_hash;
      f[n++] = (string)row.terminal_internal_state_hash;
      f[n++] = (string)row.terminal_projection_hash;
      f[n++] = (string)row.event_hash;
      f[n++] = (string)row.reconciliation_hash;
      return LP_RevmaTelemetryJoin(f, n);
   }

   string SummaryLine(const LP_RevmaDiscoverySummaryRow &row)
   {
      string f[160];
      int n = 0;
      f[n++] = LP_RevmaTelemetryCsv(LP_REVMA_DISCOVERY_TELEMETRY_SCHEMA_ID);
      f[n++] = LP_RevmaTelemetryCsv(row.summary_type);
      f[n++] = (string)row.summary_sequence;
      f[n++] = LP_RevmaTelemetryCsv(row.run_id);
      f[n++] = LP_RevmaTelemetryCsv(row.source_revision);
      f[n++] = LP_RevmaTelemetryCsv(row.profile_id);
      f[n++] = (string)row.profile_hash;
      f[n++] = (string)row.config_hash;
      f[n++] = (string)row.formula_hash;
      f[n++] = LP_RevmaTelemetryCsv(LP_RevmaDiscoveryBranchId(row.branch));
      f[n++] = (string)row.branch_grid_id;
      f[n++] = (string)row.branch_cycle_id;
      f[n++] = (string)row.account_cycle_id;
      f[n++] = IntegerToString(row.symbol_id);
      f[n++] = IntegerToString(row.direction);
      f[n++] = (string)row.birth_time;
      f[n++] = (string)row.close_time;
      f[n++] = IntegerToString(row.peak_atoms);
      f[n++] = DoubleToString(row.peak_lots, 2);
      f[n++] = IntegerToString(row.current_atoms);
      f[n++] = DoubleToString(row.current_lots, 2);
      f[n++] = (string)row.current_reservation_minor;
      f[n++] = (string)row.current_margin_minor;
      f[n++] = (string)row.peak_reservation_minor;
      f[n++] = IntegerToString(row.reservation_overrun_observed ? 1 : 0);
      f[n++] = (string)row.peak_reservation_overrun_minor;
      f[n++] = (string)row.peak_q_cash_minor;
      f[n++] = (string)row.peak_margin_minor;
      f[n++] = (string)row.maximum_adverse_excursion_minor;
      f[n++] = IntegerToString(row.maximum_age_minutes);
      f[n++] = IntegerToString(row.time_underwater_minutes);
      f[n++] = (string)row.realized_after_cost_minor;
      f[n++] = (string)row.marked_after_cost_minor;
      f[n++] = (string)row.cost_minor;
      f[n++] = (string)row.harvest_minor;
      f[n++] = (string)row.nonharvest_minor;
      f[n++] = IntegerToString(row.local_harvest_close_count);
      f[n++] = IntegerToString(row.cleanup_close_count);
      f[n++] = IntegerToString(row.hard_risk_close_count);
      f[n++] = (string)row.local_harvest_pnl_minor;
      f[n++] = (string)row.cleanup_pnl_minor;
      f[n++] = (string)row.hard_risk_pnl_minor;
      f[n++] = (string)row.liability_minor;
      f[n++] = (string)row.cleanup_funding_minor;
      f[n++] = (string)row.managed_cycle_pnl_minor;
      f[n++] = (string)row.branch_equity_minor;
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
      f[n++] = IntegerToString(row.unresolved_inventory ? 1 : 0);
      f[n++] = LP_RevmaTelemetryCsv(row.first_infeasibility);
      f[n++] = LP_RevmaTelemetryCsv(row.latest_infeasibility);
      f[n++] = (string)row.latest_infeasibility_m1_time;
      f[n++] = LP_RevmaTelemetryCsv(row.terminal_reason);
      f[n++] = (string)row.summary_child_evidence_hash;
      f[n++] = (string)row.event_hash;
      f[n++] = (string)row.reconciliation_hash;
      f[n++] = (string)row.terminal_branch_transition_hash;
      f[n++] = (string)row.terminal_source_m1_time;
      f[n++] = (string)row.terminal_grid_state_hash;
      f[n++] = (string)row.terminal_book_hash;
      f[n++] = (string)row.run_elapsed_microseconds;
      f[n++] = (string)m_transition_rows;
      f[n++] = (string)m_transition_bytes;
      f[n++] = (string)m_transition_committed_rows;
      f[n++] = (string)(m_summary_rows + 1);
      f[n++] = (string)m_summary_committed_rows;
      f[n++] = (string)m_appended_transition_chain_hash;
      f[n++] = (string)m_committed_transition_chain_hash;
      f[n++] = (string)m_appended_summary_chain_hash;
      f[n++] = (string)m_committed_summary_chain_hash;
      f[n++] = (string)row.transition_flush_microseconds;
      f[n++] = (string)row.transition_flush_max_microseconds;
      f[n++] = (string)row.summary_flush_microseconds;
      f[n++] = (string)row.summary_flush_max_microseconds;
      f[n++] = (string)row.current_q_cash_minor;
      f[n++] = IntegerToString(row.current_active_grid_count);
      f[n++] = (string)row.current_concentration_q_cash_minor;
      f[n++] = IntegerToString(row.current_concentration_currency_id);
      f[n++] = (string)row.current_liquidation_liability_minor;
      f[n++] = (string)row.equity_high_water_minor;
      f[n++] = (string)row.branch_drawdown_minor;
      f[n++] = (string)row.cycle_peak_reservation_minor;
      f[n++] = (string)row.cycle_peak_margin_minor;
      f[n++] = (string)row.cycle_peak_q_cash_minor;
      f[n++] = IntegerToString(row.cycle_peak_atom_count);
      f[n++] = IntegerToString(row.peak_active_grid_count);
      f[n++] = (string)row.peak_concentration_q_cash_minor;
      f[n++] = IntegerToString(row.peak_concentration_currency_id);
      f[n++] = (string)row.peak_liquidation_liability_minor;
      f[n++] = (string)row.maximum_drawdown_minor;
      f[n++] = (string)row.cycle_risk_snapshot_count;
      f[n++] = (string)row.cycle_risk_snapshot_hash;
      f[n++] = (string)row.cycle_candidate_built_count;
      f[n++] = (string)row.cycle_candidate_decision_count;
      f[n++] = (string)row.cycle_candidate_admitted_count;
      f[n++] = (string)row.cycle_candidate_rejected_count;
      f[n++] = (string)row.cycle_inventory_transition_count;
      f[n++] = (string)row.terminal_projection_hash;
      f[n++] = (string)row.terminal_risk_state_hash;
      f[n++] = (string)row.run_peak_reservation_minor;
      f[n++] = (string)row.run_peak_margin_minor;
      f[n++] = (string)row.run_peak_q_cash_minor;
      f[n++] = IntegerToString(row.run_peak_atom_count);
      f[n++] = IntegerToString(row.run_peak_active_grid_count);
      f[n++] = (string)row.run_peak_concentration_q_cash_minor;
      f[n++] = IntegerToString(row.run_peak_concentration_currency_id);
      f[n++] = (string)row.run_peak_liquidation_liability_minor;
      f[n++] = (string)row.run_equity_high_water_minor;
      f[n++] = (string)row.run_maximum_drawdown_minor;
      f[n++] = (string)row.run_risk_snapshot_count;
      f[n++] = (string)row.run_risk_snapshot_hash;
      f[n++] = (string)row.run_candidate_built_count;
      f[n++] = (string)row.run_candidate_decision_count;
      f[n++] = (string)row.run_candidate_admitted_count;
      f[n++] = (string)row.run_candidate_rejected_count;
      f[n++] = (string)row.run_inventory_transition_count;
      f[n++] = (string)row.writer_branch_transition_rows;
      f[n++] = (string)row.writer_cycle_candidate_decision_rows;
      f[n++] = (string)row.writer_cycle_candidate_admitted_rows;
      f[n++] = (string)row.writer_cycle_candidate_rejected_rows;
      f[n++] = (string)row.writer_cycle_inventory_transition_rows;
      f[n++] = (string)row.writer_run_candidate_decision_rows;
      f[n++] = (string)row.writer_run_candidate_admitted_rows;
      f[n++] = (string)row.writer_run_candidate_rejected_rows;
      f[n++] = (string)row.writer_run_inventory_transition_rows;
      return LP_RevmaTelemetryJoin(f, n);
   }

   bool WriteManifestStatus(
      const bool complete,
      const string reason,
      const long transition_file_size,
      const long summary_file_size
   )
   {
      if(m_manifest_handle == INVALID_HANDLE ||
         !LP_RevmaTelemetryAsciiFieldValid(reason, complete) ||
         m_manifest_sequence >= 2)
         return false;
      ulong sequence = m_manifest_sequence + 1;
      long elapsed = m_run_started_microseconds > 0 ?
         (long)(GetMicrosecondCount() - m_run_started_microseconds) : 0;
      string base =
         LP_RevmaTelemetryCsv(LP_REVMA_DISCOVERY_TELEMETRY_SCHEMA_ID) + "," +
         (string)sequence + "," + LP_RevmaTelemetryCsv(m_run_id) + "," +
         LP_RevmaTelemetryCsv(m_source_revision) + "," +
         LP_RevmaTelemetryCsv(m_profile_id) + "," +
         (string)m_profile_hash + "," + (string)m_config_hash + "," +
         (string)m_formula_hash + "," + IntegerToString(complete ? 1 : 0) + "," +
         LP_RevmaTelemetryCsv(reason) + "," +
         (string)m_transition_rows + "," +
         (string)m_transition_committed_rows + "," +
         (string)m_transition_bytes + "," +
         (string)transition_file_size + "," +
         (string)m_summary_rows + "," +
         (string)m_summary_committed_rows + "," +
         (string)m_summary_bytes + "," +
         (string)summary_file_size + "," +
         (string)m_appended_transition_chain_hash + "," +
         (string)m_committed_transition_chain_hash + "," +
         (string)m_appended_summary_chain_hash + "," +
         (string)m_committed_summary_chain_hash + "," +
         (string)m_transition_flushes + "," +
         (string)m_summary_flushes + "," +
         (string)m_transition_flush_microseconds + "," +
         (string)m_transition_flush_max_microseconds + "," +
         (string)m_summary_flush_microseconds + "," +
         (string)m_summary_flush_max_microseconds + "," +
         IntegerToString(m_failure_event_count) + "," +
         (string)(m_next_sequence - 1) + "," +
         (string)(m_next_summary_sequence - 1) + "," +
         (string)elapsed + "," + (string)m_manifest_chain_hash;
      ulong row_hash = LP_HashString(base);
      ulong chain_hash = m_manifest_chain_hash;
      LP_HashMixULong(chain_hash, sequence);
      LP_HashMixULong(chain_hash, row_hash);
      string line = base + "," + (string)row_hash + "," +
         (string)chain_hash;
      if(row_hash == 0 || chain_hash == 0 ||
         StringLen(line) + 2 > LP_REVMA_DISCOVERY_MAX_LINE_BYTES)
         return false;
      uint written = FileWriteString(m_manifest_handle, line + "\r\n");
      FileFlush(m_manifest_handle);
      if((long)written != StringLen(line) + 2)
         return false;
      m_manifest_bytes += written;
      if(FileTell(m_manifest_handle) != m_manifest_bytes ||
         (long)FileSize(m_manifest_handle) != m_manifest_bytes)
         return false;
      m_manifest_sequence = sequence;
      m_manifest_row_hash = row_hash;
      m_manifest_chain_hash = chain_hash;
      return true;
   }

public:
   LP_RevmaDiscoveryTelemetry()
   {
      ResetState();
   }

   bool CanResetForNewRun()
   {
      return !m_initialized &&
         m_transition_handle == INVALID_HANDLE &&
         m_summary_handle == INVALID_HANDLE &&
         m_manifest_handle == INVALID_HANDLE;
   }

   bool ResetForNewRun()
   {
      if(!CanResetForNewRun())
         return false;
      ResetState();
      return true;
   }

   bool RegisterCompletedM1CohortIdentity(
      const datetime source_m1_time,
      const ulong cohort_snapshot_hash,
      const ulong cohort_signal_hash,
      const ulong cohort_strategy_hash)
   {
      if(!m_initialized || !m_valid || source_m1_time <= 0 ||
         ((long)source_m1_time % 60) != 0 ||
         source_m1_time <= m_registered_cohort_source_m1_time ||
         cohort_snapshot_hash == 0 || cohort_signal_hash == 0 ||
         cohort_strategy_hash == 0)
      {
         Invalidate("completed_m1_cohort_identity_registration_failed");
         return false;
      }
      m_registered_cohort_source_m1_time = source_m1_time;
      m_registered_cohort_snapshot_hash = cohort_snapshot_hash;
      m_registered_cohort_signal_hash = cohort_signal_hash;
      m_registered_cohort_strategy_hash = cohort_strategy_hash;
      return true;
   }

   bool SeedTransitionRow(LP_RevmaDiscoveryTransitionRow &row)
   {
      LP_ResetRevmaDiscoveryTransitionRow(row);
      if(!m_initialized || !m_valid)
         return false;
      row.valid = true;
      row.run_id = m_run_id;
      row.source_revision = m_source_revision;
      row.profile_id = m_profile_id;
      row.profile_hash = m_profile_hash;
      row.config_hash = m_config_hash;
      row.formula_hash = m_formula_hash;
      return true;
   }

   bool SeedSummaryRow(
      const string summary_type,
      const int branch,
      LP_RevmaDiscoverySummaryRow &row)
   {
      LP_ResetRevmaDiscoverySummaryRow(row);
      if(!m_initialized || !m_valid ||
         !LP_RevmaTelemetrySummaryTypeValid(summary_type) ||
         !LP_RevmaDiscoveryBranchValid(branch) ||
         m_branch_cycle_id[branch] == 0)
         return false;
      row.valid = true;
      row.summary_type = summary_type;
      row.run_id = m_run_id;
      row.source_revision = m_source_revision;
      row.profile_id = m_profile_id;
      row.profile_hash = m_profile_hash;
      row.config_hash = m_config_hash;
      row.formula_hash = m_formula_hash;
      row.branch = branch;
      row.branch_cycle_id = m_branch_cycle_id[branch];
      row.account_cycle_id = m_branch_account_cycle_id[branch];
      row.equity_reference_minor =
         m_branch_equity_reference_minor[branch];
      row.budget_minor = m_branch_budget_minor[branch];
      row.formula_clean = true;
      row.reconciliation_clean = true;
      return true;
   }

   bool BuildGridSummaryBase(
      const int branch,
      const int symbol_id,
      LP_RevmaDiscoverySummaryRow &row)
   {
      if(symbol_id < 0 || symbol_id >= LP_SYMBOL_COUNT ||
         !SeedSummaryRow("grid", branch, row))
         return false;
      LP_RevmaTelemetryLifecycleState state =
         m_lifecycle[branch][symbol_id];
      if(state.grid_id == 0 || state.cycle_id != row.branch_cycle_id ||
         state.terminal_event_hash == 0 ||
         state.terminal_projection_hash == 0 ||
         state.terminal_internal_state_hash == 0 ||
         state.terminal_summary_written)
         return false;
      row.branch_grid_id = state.grid_id;
      row.symbol_id = symbol_id;
      row.direction = state.direction;
      row.birth_time = state.birth_m1_time;
      row.close_time = state.open ? 0 :
         state.terminal_transition_m1_time;
      row.peak_atoms = state.terminal_atoms_before;
      row.peak_lots = state.terminal_lots_before;
      row.current_atoms = state.terminal_atoms_after;
      row.current_lots = state.terminal_lots_after;
      row.current_reservation_minor = state.open ?
         state.terminal_reservation_minor : 0;
      row.current_margin_minor = state.open ?
         state.terminal_margin_minor : 0;
      row.current_q_cash_minor = state.open ?
         state.terminal_q_cash_minor : 0;
      row.current_active_grid_count = state.open ? 1 : 0;
      row.current_liquidation_liability_minor = state.open &&
         state.terminal_liability_minor < 0 ?
            -state.terminal_liability_minor : 0;
      row.peak_reservation_minor = state.terminal_reservation_minor;
      row.reservation_overrun_observed =
         state.terminal_reservation_overrun;
      row.peak_reservation_overrun_minor =
         state.terminal_reservation_overrun_minor;
      row.peak_q_cash_minor = state.terminal_q_cash_minor;
      row.peak_margin_minor = state.terminal_margin_minor;
      row.peak_active_grid_count = 1;
      row.peak_liquidation_liability_minor =
         state.terminal_maximum_adverse_excursion_minor;
      row.maximum_adverse_excursion_minor =
         state.terminal_maximum_adverse_excursion_minor;
      row.maximum_age_minutes = state.terminal_grid_age_minutes;
      row.time_underwater_minutes =
         state.terminal_time_underwater_minutes;
      row.harvest_minor = state.terminal_harvest_minor;
      row.nonharvest_minor = state.terminal_nonharvest_minor;
      row.liability_minor = state.terminal_liability_minor;
      row.cost_minor = state.terminal_cost_minor;
      if(!LP_RevmaTelemetrySafeMinorAdd(row.harvest_minor,
            row.nonharvest_minor, row.realized_after_cost_minor) ||
         !LP_RevmaTelemetrySafeMinorAdd(row.realized_after_cost_minor,
            row.liability_minor, row.managed_cycle_pnl_minor) ||
         !LP_RevmaTelemetrySafeMinorAdd(row.equity_reference_minor,
            row.managed_cycle_pnl_minor, row.branch_equity_minor))
         return false;
      row.marked_after_cost_minor = row.liability_minor;
      row.close_owner = state.terminal_close_owner;
      row.local_harvest_close_count = !state.open &&
         state.terminal_reason == "grid_harvest" ? 1 : 0;
      row.cleanup_close_count = !state.open &&
         state.terminal_reason == "account_cleanup" ? 1 : 0;
      row.hard_risk_close_count = !state.open &&
         state.terminal_reason == "account_risk" ? 1 : 0;
      row.local_harvest_pnl_minor =
         row.local_harvest_close_count > 0 ? row.harvest_minor : 0;
      row.cleanup_pnl_minor = row.cleanup_close_count > 0 ?
         row.nonharvest_minor : 0;
      row.hard_risk_pnl_minor = row.hard_risk_close_count > 0 ?
         row.nonharvest_minor : 0;
      row.center_applicable_grids = branch == LP_REVMA_BRANCH_C &&
         state.center_applicable ? 1 : 0;
      row.center_triggered_grids = row.center_applicable_grids > 0 &&
         state.center_triggered ? 1 : 0;
      row.center_not_triggered_grids = row.center_applicable_grids > 0 &&
         !state.center_triggered ? 1 : 0;
      row.center_not_applicable_grids = branch == LP_REVMA_BRANCH_C &&
         !state.center_applicable ? 1 : 0;
      row.center_blocked_adverse_candidates = state.blocked_adverse_count;
      row.favorable_eligible_after_latch =
         state.favorable_eligible_after_latch;
      row.center_latched = state.center_triggered;
      row.first_latch_time = state.center_latch_time;
      row.final_flat = !state.open;
      row.unresolved_inventory = state.open;
      row.terminal_reason = state.terminal_reason;
      row.summary_child_evidence_hash = state.terminal_event_hash;
      row.terminal_grid_state_hash =
         state.terminal_internal_state_hash;
      row.terminal_projection_hash = state.terminal_projection_hash;
      return true;
   }

   bool BuildRollupSummaryBase(
      const string summary_type,
      const int branch,
      const int requested_symbol_id,
      LP_RevmaDiscoverySummaryRow &row)
   {
      if(summary_type == "grid" ||
         !SeedSummaryRow(summary_type, branch, row))
         return false;
      LP_RevmaTelemetrySummaryLedger ledger;
      LP_ResetRevmaTelemetrySummaryLedger(ledger);
      bool aggregate = summary_type == "cycle" ||
         summary_type == "reconciliation" ||
         summary_type == "run_completion";
      if(summary_type == "symbol")
      {
         if(requested_symbol_id < 0 ||
            requested_symbol_id >= LP_SYMBOL_COUNT)
            return false;
         row.symbol_id = requested_symbol_id;
         ledger = m_symbol_summary_ledger[branch][requested_symbol_id];
      }
      else if(summary_type == "top_offender")
      {
         int offender = ExpectedTopOffenderSymbolId(branch);
         row.symbol_id = offender;
         ledger = offender < 0 ? m_branch_summary_ledger[branch] :
            m_symbol_summary_ledger[branch][offender];
      }
      else
      {
         row.symbol_id = -1;
         ledger = m_branch_summary_ledger[branch];
      }
      if(!ledger.valid)
         return false;
      row.direction = ledger.peak_direction;
      if(ledger.peak_atoms == 0)
         row.direction = LP_SIDE_NONE;
      row.peak_atoms = ledger.peak_atoms;
      row.peak_lots = ledger.peak_lots;
      row.current_atoms = ledger.current_atoms;
      row.current_lots = ledger.current_lots;
      row.current_reservation_minor = ledger.current_reservation_minor;
      row.current_margin_minor = ledger.current_margin_minor;
      row.peak_reservation_minor = ledger.peak_reservation_minor;
      row.reservation_overrun_observed =
         ledger.reservation_overrun_observed;
      row.peak_reservation_overrun_minor =
         ledger.peak_reservation_overrun_minor;
      row.peak_q_cash_minor = ledger.peak_q_cash_minor;
      row.peak_margin_minor = ledger.peak_margin_minor;
      row.maximum_adverse_excursion_minor =
         ledger.maximum_adverse_excursion_minor;
      row.maximum_age_minutes = ledger.maximum_age_minutes;
      row.time_underwater_minutes = ledger.time_underwater_minutes;
      row.harvest_minor = ledger.harvest_minor;
      row.nonharvest_minor = ledger.nonharvest_minor;
      row.liability_minor = ledger.liability_minor;
      row.cost_minor = ledger.cost_minor;
      row.local_harvest_close_count = ledger.local_harvest_close_count;
      row.cleanup_close_count = ledger.cleanup_close_count;
      row.hard_risk_close_count = ledger.hard_risk_close_count;
      row.local_harvest_pnl_minor = ledger.local_harvest_pnl_minor;
      row.cleanup_pnl_minor = ledger.cleanup_pnl_minor;
      row.hard_risk_pnl_minor = ledger.hard_risk_pnl_minor;
      row.center_applicable_grids = ledger.center_applicable_grids;
      row.center_triggered_grids = ledger.center_triggered_grids;
      row.center_not_triggered_grids =
         ledger.center_not_triggered_grids;
      row.center_not_applicable_grids =
         ledger.center_not_applicable_grids;
      row.center_blocked_adverse_candidates =
         ledger.center_blocked_adverse_candidates;
      row.favorable_eligible_after_latch =
         ledger.favorable_eligible_after_latch;
      row.center_latched = ledger.center_latched;
      row.first_latch_time = ledger.first_latch_time;
      row.summary_child_evidence_hash =
         FinalSummaryLedgerEvidenceHash(ledger);
      if(row.summary_child_evidence_hash == 0 ||
         !LP_RevmaTelemetrySafeMinorAdd(row.harvest_minor,
            row.nonharvest_minor, row.realized_after_cost_minor) ||
         !LP_RevmaTelemetrySafeMinorAdd(row.realized_after_cost_minor,
            row.liability_minor, row.managed_cycle_pnl_minor) ||
         !LP_RevmaTelemetrySafeMinorAdd(row.equity_reference_minor,
            row.managed_cycle_pnl_minor, row.branch_equity_minor))
         return false;
      row.marked_after_cost_minor = row.liability_minor;
      row.final_flat = row.current_atoms == 0;
      row.unresolved_inventory = !row.final_flat;
      row.close_owner = aggregate ? m_branch_close_owner[branch] :
         LP_REVMA_DISCOVERY_CLOSE_NONE;
      row.first_infeasibility = aggregate ?
         m_branch_first_infeasibility[branch] : "";
      row.latest_infeasibility = aggregate ?
         m_branch_latest_infeasibility[branch] : "";
      row.latest_infeasibility_m1_time = aggregate ?
         m_branch_latest_infeasibility_m1[branch] : 0;
      row.terminal_reason = aggregate ?
         m_branch_terminal_reason[branch] : "scope_complete";
      return true;
   }

   bool Initialize(
      const string output_folder,
      const bool common_files,
      const string run_id,
      const string source_revision,
      const ulong config_hash,
      const string profile_id
   )
   {
      if(m_initialized || m_ever_initialized)
      {
         Invalidate("telemetry_initialize_reentry_forbidden");
         return false;
      }
      if(!common_files || output_folder != LP_REVMA_DISCOVERY_OUTPUT_FOLDER ||
         !LP_RevmaTelemetryOutputFolderValid(output_folder))
      {
         Invalidate("telemetry_common_files_profile_mismatch");
         return false;
      }
      if(run_id == "" || !LP_RevmaTelemetryFileTokenValid(run_id))
      {
         Invalidate("telemetry_run_id_invalid");
         return false;
      }
      if(source_revision == "" ||
         source_revision != LP_EA_SOURCE_BUNDLE_ID ||
         !LP_RevmaTelemetryAsciiFieldValid(source_revision, false))
      {
         Invalidate("telemetry_source_revision_invalid");
         return false;
      }
      if(config_hash == 0 || profile_id != LP_REVMA_DISCOVERY_PROFILE_ID ||
         !LP_RevmaTelemetryAsciiFieldValid(profile_id, false) ||
         LP_RevmaDiscoveryFormulaHash() == 0)
      {
         Invalidate("telemetry_formula_profile_identity_invalid");
         return false;
      }
      m_ever_initialized = true;
      m_run_started_microseconds = GetMicrosecondCount();
      m_run_id = run_id;
      m_source_revision = source_revision;
      m_profile_id = profile_id;
      m_profile_hash = LP_RevmaDiscoveryProfileHash();
      m_config_hash = config_hash;
      m_formula_hash = LP_RevmaDiscoveryFormulaHash();
      m_appended_transition_chain_hash = m_formula_hash;
      m_committed_transition_chain_hash = m_formula_hash;
      m_appended_summary_chain_hash = m_formula_hash;
      m_committed_summary_chain_hash = m_formula_hash;
      for(int branch = 0; branch < LP_REVMA_DISCOVERY_BRANCH_COUNT; branch++)
         m_branch_transition_chain[branch] = m_formula_hash;
      int flags = FILE_WRITE | FILE_TXT | FILE_ANSI | FILE_SHARE_READ;
      flags |= FILE_COMMON;
      FolderCreate(output_folder, FILE_COMMON);
      string transition_path = output_folder + "\\gate108_" + run_id + "_transitions.csv";
      string summary_path = output_folder + "\\gate108_" + run_id + "_summaries.csv";
      string manifest_path = output_folder + "\\gate108_" + run_id + "_completion.csv";
      int exists_flags = FILE_COMMON;
      if(FileIsExist(transition_path, exists_flags) ||
         FileIsExist(summary_path, exists_flags) ||
         FileIsExist(manifest_path, exists_flags))
      {
         Invalidate("telemetry_run_artifact_already_exists");
         return false;
      }
      m_transition_handle = FileOpen(transition_path, flags);
      if(m_transition_handle == INVALID_HANDLE)
      {
         Invalidate("transition_artifact_open_failed");
         return false;
      }
      m_summary_handle = FileOpen(summary_path, flags);
      if(m_summary_handle == INVALID_HANDLE)
      {
         FileClose(m_transition_handle);
         m_transition_handle = INVALID_HANDLE;
         Invalidate("summary_artifact_open_failed");
         return false;
      }
      m_manifest_handle = FileOpen(manifest_path, flags);
      if(m_manifest_handle == INVALID_HANDLE)
      {
         FileClose(m_transition_handle);
         FileClose(m_summary_handle);
         m_transition_handle = INVALID_HANDLE;
         m_summary_handle = INVALID_HANDLE;
         Invalidate("completion_manifest_open_failed");
         return false;
      }
      m_valid = true;
      m_initialized = true;
      m_invalid_reason = "";
      string transition_header = "schema_id,event_type,sequence,event_time,source_m1_time,run_id,source_revision,profile_id,profile_hash,config_hash,formula_hash,signal_identity_hash,q_day_count,q_event_count,reconstruction_epoch,branch_id,branch_grid_id,branch_cycle_id,account_cycle_id,grid_generation,candidate_identity,shared_origin_id,opportunity_id,matched_snapshot_hash,shared_observation_snapshot_hash,strategy_state_identity_hash,symbol_id,direction,candidate_type,birth_bucket,center_alignment,p0,stress_price,fill_price,current_price,c0,previous_center,current_center,q0,current_q,q_profile_id,q_event_cadence,current_q_ratio,discovery_cell_ticks,discovery_cell_price,broker_tick_size,p0_ticks,c0_ticks,previous_center_ticks,current_center_ticks,support0_sign,previous_support_sign,current_support_sign,support0_q,current_support_q,revision_q,center_applicable,center_latched,center_latch_time,center_update_count,center_observation_index,center_not_available_count,first_center_update_observation_index,last_center_update_observation_index,first_center_update_q_event_index,last_center_update_q_event_index,first_center_update_time,last_center_update_time,center_staleness_minutes,cumulative_signed_revision_q,cumulative_absolute_revision_q,minimum_support_q,maximum_support_q,regression_sum_x,regression_sum_y,regression_sum_x2,regression_sum_xy,blocked_adverse_count,previous_cell_index,current_cell_index,total_cell_path,completed_cell_crossings,unfilled_jump_cells,matched_reversal_crossings,adverse_frontier_expansions,favorable_frontier_expansions,max_cell_jump,last_movement_sign,minimum_cell_index,maximum_cell_index,new_extreme_count,initial_history_boundary,last_reversal_m1,time_since_last_reversal_minutes,last_positive_liquidation_opportunity_m1,time_since_positive_liquidation_opportunity_minutes,atoms_before,atoms_after,lots_before,lots_after,reservation_minor,q_cash_minor,prospective_reservation_minor,prospective_q_cash_minor,a_g_candidate_minor,a_g_minor,reservation_overrun,reservation_overrun_minor,margin_minor,incremental_margin_minor,incremental_liquidation_minor,incremental_close_cost_minor,concentration_q_cash_minor,concentration_currency_id,commission_minor,swap_minor,liquidation_cost_minor,maximum_adverse_excursion_minor,grid_age_minutes,time_underwater_minutes,weighted_entry_sum,adverse_add_count,favorable_add_count,harvest_minor,nonharvest_minor,liability_minor,budget_minor,equity_reference_minor,close_owner,decision,reason,grid_terminal_reason,pre_candidate_state_hash,terminal_internal_state_hash,terminal_projection_hash,event_hash,reconciliation_hash";
      string summary_header = "schema_id,summary_type,summary_sequence,run_id,source_revision,profile_id,profile_hash,config_hash,formula_hash,branch_id,branch_grid_id,branch_cycle_id,account_cycle_id,symbol_id,direction,birth_time,close_time,peak_atoms,peak_lots,current_atoms,current_lots,current_reservation_minor,current_margin_minor,peak_reservation_minor,reservation_overrun_observed,peak_reservation_overrun_minor,peak_q_cash_minor,peak_margin_minor,maximum_adverse_excursion_minor,maximum_age_minutes,time_underwater_minutes,realized_after_cost_minor,marked_after_cost_minor,cost_minor,harvest_minor,nonharvest_minor,local_harvest_close_count,cleanup_close_count,hard_risk_close_count,local_harvest_pnl_minor,cleanup_pnl_minor,hard_risk_pnl_minor,liability_minor,cleanup_funding_minor,managed_cycle_pnl_minor,branch_equity_minor,budget_minor,equity_reference_minor,close_owner,center_applicable_grids,center_triggered_grids,center_not_triggered_grids,center_not_applicable_grids,center_blocked_adverse_candidates,favorable_eligible_after_latch,center_latched,first_latch_time,final_flat,cleanup_shortfall,broker_contamination,formula_clean,reconciliation_clean,unresolved_inventory,first_infeasibility,latest_infeasibility,latest_infeasibility_m1_time,terminal_reason,summary_child_evidence_hash,event_hash,reconciliation_hash,terminal_branch_transition_hash,terminal_source_m1_time,terminal_grid_state_hash,terminal_book_hash,run_elapsed_microseconds,transition_rows,transition_bytes,transition_committed_rows,summary_rows,summary_committed_rows,appended_transition_chain_hash,committed_transition_chain_hash,appended_summary_chain_hash,committed_summary_chain_hash,transition_flush_microseconds,transition_flush_max_microseconds,summary_flush_microseconds,summary_flush_max_microseconds,current_q_cash_minor,current_active_grid_count,current_concentration_q_cash_minor,current_concentration_currency_id,current_liquidation_liability_minor,equity_high_water_minor,branch_drawdown_minor,cycle_peak_reservation_minor,cycle_peak_margin_minor,cycle_peak_q_cash_minor,cycle_peak_atom_count,peak_active_grid_count,peak_concentration_q_cash_minor,peak_concentration_currency_id,peak_liquidation_liability_minor,maximum_drawdown_minor,cycle_risk_snapshot_count,cycle_risk_snapshot_hash,cycle_candidate_built_count,cycle_candidate_decision_count,cycle_candidate_admitted_count,cycle_candidate_rejected_count,cycle_inventory_transition_count,terminal_projection_hash,terminal_risk_state_hash,run_peak_reservation_minor,run_peak_margin_minor,run_peak_q_cash_minor,run_peak_atom_count,run_peak_active_grid_count,run_peak_concentration_q_cash_minor,run_peak_concentration_currency_id,run_peak_liquidation_liability_minor,run_equity_high_water_minor,run_maximum_drawdown_minor,run_risk_snapshot_count,run_risk_snapshot_hash,run_candidate_built_count,run_candidate_decision_count,run_candidate_admitted_count,run_candidate_rejected_count,run_inventory_transition_count,writer_branch_transition_rows,writer_cycle_candidate_decision_rows,writer_cycle_candidate_admitted_rows,writer_cycle_candidate_rejected_rows,writer_cycle_inventory_transition_rows,writer_run_candidate_decision_rows,writer_run_candidate_admitted_rows,writer_run_candidate_rejected_rows,writer_run_inventory_transition_rows";
      string manifest_header = "schema_id,manifest_sequence,run_id,source_revision,profile_id,profile_hash,config_hash,formula_hash,complete,invalid_reason,transition_attempted_rows,transition_committed_rows,transition_bytes,transition_file_size,summary_attempted_rows,summary_committed_rows,summary_bytes,summary_file_size,appended_transition_chain_hash,committed_transition_chain_hash,appended_summary_chain_hash,committed_summary_chain_hash,transition_flushes,summary_flushes,transition_flush_microseconds,transition_flush_max_microseconds,summary_flush_microseconds,summary_flush_max_microseconds,failure_events,last_transition_sequence,last_summary_sequence,run_elapsed_microseconds,previous_manifest_chain_hash,manifest_row_hash,manifest_chain_hash";
      if(!GuardLine(transition_header, true) || !GuardLine(summary_header, false) ||
         StringLen(manifest_header) + 2 > LP_REVMA_DISCOVERY_MAX_LINE_BYTES)
      {
         Invalidate("telemetry_header_guard_failed");
         FileClose(m_transition_handle);
         FileClose(m_summary_handle);
         FileClose(m_manifest_handle);
         m_transition_handle = INVALID_HANDLE;
         m_summary_handle = INVALID_HANDLE;
         m_manifest_handle = INVALID_HANDLE;
         m_initialized = false;
         return false;
      }
      uint transition_header_written = FileWriteString(m_transition_handle, transition_header + "\r\n");
      uint summary_header_written = FileWriteString(m_summary_handle, summary_header + "\r\n");
      uint manifest_header_written = FileWriteString(m_manifest_handle, manifest_header + "\r\n");
      if((long)transition_header_written != StringLen(transition_header) + 2 ||
         (long)summary_header_written != StringLen(summary_header) + 2 ||
         (long)manifest_header_written != StringLen(manifest_header) + 2)
      {
         Invalidate("telemetry_header_write_failed");
         FileClose(m_transition_handle);
         FileClose(m_summary_handle);
         FileClose(m_manifest_handle);
         m_transition_handle = INVALID_HANDLE;
         m_summary_handle = INVALID_HANDLE;
         m_manifest_handle = INVALID_HANDLE;
         m_initialized = false;
         return false;
      }
      m_transition_bytes += transition_header_written;
      m_summary_bytes += summary_header_written;
      m_manifest_bytes += manifest_header_written;
      FileFlush(m_transition_handle);
      FileFlush(m_summary_handle);
      FileFlush(m_manifest_handle);
      if(FileTell(m_transition_handle) != m_transition_bytes ||
         FileTell(m_summary_handle) != m_summary_bytes ||
         FileTell(m_manifest_handle) != m_manifest_bytes ||
         (long)FileSize(m_transition_handle) != m_transition_bytes ||
         (long)FileSize(m_summary_handle) != m_summary_bytes ||
         (long)FileSize(m_manifest_handle) != m_manifest_bytes)
      {
         Invalidate("telemetry_header_physical_reconciliation_failed");
         FileClose(m_transition_handle);
         FileClose(m_summary_handle);
         FileClose(m_manifest_handle);
         m_transition_handle = INVALID_HANDLE;
         m_summary_handle = INVALID_HANDLE;
         m_manifest_handle = INVALID_HANDLE;
         m_initialized = false;
         return false;
      }
      m_appended_transition_chain_hash = LP_HashString(transition_header);
      m_committed_transition_chain_hash =
         m_appended_transition_chain_hash;
      m_appended_summary_chain_hash = LP_HashString(summary_header);
      m_committed_summary_chain_hash = m_appended_summary_chain_hash;
      m_manifest_chain_hash = LP_HashString(manifest_header);
      if(m_appended_transition_chain_hash == 0 ||
         m_appended_summary_chain_hash == 0 ||
         m_manifest_chain_hash == 0 ||
         !WriteManifestStatus(false, "completion_pending",
            m_transition_bytes, m_summary_bytes))
      {
         Invalidate("completion_pending_manifest_write_failed");
         FileClose(m_transition_handle);
         FileClose(m_summary_handle);
         FileClose(m_manifest_handle);
         m_transition_handle = INVALID_HANDLE;
         m_summary_handle = INVALID_HANDLE;
         m_manifest_handle = INVALID_HANDLE;
         m_initialized = false;
         return false;
      }
      m_manifest_pending_written = true;
      return true;
   }

   bool AppendTransition(
      const LP_RevmaDiscoveryTransitionRow &row,
      ulong &appended_event_hash)
   {
      appended_event_hash = 0;
      bool aggregate_branch_event = row.symbol_id == -1 &&
         row.event_type != LP_REVMA_TELEMETRY_FAILURE &&
         row.event_type != LP_REVMA_TELEMETRY_CYCLE_START;
      if(!m_initialized)
      {
         Invalidate("transition_telemetry_not_initialized");
         return false;
      }
      if(!m_valid)
      {
         Invalidate("transition_telemetry_invalid");
         return false;
      }
      if(!row.valid)
      {
         Invalidate("transition_row_invalid");
         return false;
      }
      if(row.event_time <= 0)
      {
         Invalidate("transition_event_time_invalid");
         return false;
      }
      if(row.run_id != m_run_id)
      {
         Invalidate("transition_run_id_mismatch");
         return false;
      }
      if(row.source_revision != m_source_revision)
      {
         Invalidate("transition_source_revision_mismatch");
         return false;
      }
      if(row.profile_id != m_profile_id)
      {
         Invalidate("transition_profile_id_mismatch");
         return false;
      }
      if(row.profile_hash != m_profile_hash)
      {
         Invalidate("transition_profile_hash_mismatch");
         return false;
      }
      if(row.config_hash != m_config_hash)
      {
         Invalidate("transition_config_hash_mismatch");
         return false;
      }
      if(row.formula_hash != m_formula_hash)
      {
         Invalidate("transition_formula_hash_mismatch");
         return false;
      }
      if(row.symbol_id < -1 || row.symbol_id >= LP_SYMBOL_COUNT)
      {
         Invalidate("transition_symbol_id_invalid");
         return false;
      }
      if(row.sequence != 0)
      {
         Invalidate("transition_sequence_not_zero_before_materialization");
         return false;
      }
      if(row.event_hash != 0)
      {
         Invalidate("transition_event_hash_not_zero_before_materialization");
         return false;
      }
      if(row.reconciliation_hash != 0)
      {
         Invalidate("transition_reconciliation_hash_not_zero_before_materialization");
         return false;
      }
      if(!LP_RevmaTelemetryAsciiFieldValid(row.run_id, false))
      {
         Invalidate("transition_ascii_run_id_invalid");
         return false;
      }
      if(!LP_RevmaTelemetryAsciiFieldValid(row.source_revision, false))
      {
         Invalidate("transition_ascii_source_revision_invalid");
         return false;
      }
      if(!LP_RevmaTelemetryAsciiFieldValid(row.profile_id, false))
      {
         Invalidate("transition_ascii_profile_id_invalid");
         return false;
      }
      if(!LP_RevmaTelemetryAsciiFieldValid(row.birth_bucket, true))
      {
         Invalidate("transition_ascii_birth_bucket_invalid");
         return false;
      }
      if(!LP_RevmaTelemetryAsciiFieldValid(row.center_alignment, true))
      {
         Invalidate("transition_ascii_center_alignment_invalid");
         return false;
      }
      if(!LP_RevmaTelemetryAsciiFieldValid(row.q_profile_id, true))
      {
         Invalidate("transition_ascii_q_profile_id_invalid");
         return false;
      }
      if(!LP_RevmaTelemetryAsciiFieldValid(row.decision, true))
      {
         Invalidate("transition_ascii_decision_invalid");
         return false;
      }
      if(!LP_RevmaTelemetryAsciiFieldValid(row.reason, true))
      {
         Invalidate("transition_ascii_reason_invalid");
         return false;
      }
      if(!LP_RevmaTelemetryAsciiFieldValid(row.grid_terminal_reason, true))
      {
         Invalidate("transition_ascii_grid_terminal_reason_invalid");
         return false;
      }
      if(row.event_type == LP_REVMA_TELEMETRY_CYCLE_START)
      {
         string cycle_start_shape_reason =
            LP_RevmaCycleStartEventShapeFailureReason(row);
         if(cycle_start_shape_reason != "")
         {
            Invalidate("transition_cycle_start_event_shape_" +
               cycle_start_shape_reason);
            return false;
         }
      }
      else if(!LP_RevmaTelemetryEventShapeValid(row))
      {
         Invalidate("transition_event_shape_invalid");
         return false;
      }
      if(aggregate_branch_event &&
         row.source_m1_time != m_registered_cohort_source_m1_time)
      {
         Invalidate("transition_cohort_source_m1_mismatch");
         return false;
      }
      if(aggregate_branch_event &&
         row.shared_observation_snapshot_hash !=
            m_registered_cohort_snapshot_hash)
      {
         Invalidate("transition_cohort_snapshot_hash_mismatch");
         return false;
      }
      if(aggregate_branch_event &&
         row.signal_identity_hash != m_registered_cohort_signal_hash)
      {
         Invalidate("transition_cohort_signal_hash_mismatch");
         return false;
      }
      if(aggregate_branch_event &&
         row.strategy_state_identity_hash !=
            m_registered_cohort_strategy_hash)
      {
         Invalidate("transition_cohort_strategy_hash_mismatch");
         return false;
      }
      string transition_state_reason = "";
      if(!ValidateTransitionState(row, transition_state_reason))
      {
         if(row.event_type == LP_REVMA_TELEMETRY_CYCLE_START &&
            transition_state_reason != "")
            Invalidate("transition_cycle_start_state_" +
               transition_state_reason);
         else
            Invalidate("transition_state_invalid");
         return false;
      }
      if(row.candidate_identity != 0 &&
         row.candidate_identity != LP_RevmaDiscoveryAdmissionIdentity(
            row.branch, row.branch_grid_id, row.source_m1_time))
      {
         Invalidate("transition_candidate_identity_invalid");
         return false;
      }
      if(row.opportunity_id != 0 &&
         row.opportunity_id != LP_RevmaDiscoveryOpportunityIdentity(
            row.shared_origin_id, row.symbol_id, row.source_m1_time,
            row.candidate_type, row.pre_candidate_state_hash,
            row.matched_snapshot_hash))
      {
         Invalidate("transition_opportunity_identity_invalid");
         return false;
      }
      LP_RevmaDiscoveryTransitionRow materialized = row;
      materialized.sequence = m_next_sequence;
      string canonical = TransitionLine(materialized);
      ulong row_hash = LP_HashString(canonical);
      if(row_hash == 0)
      {
         Invalidate("transition_row_hash_zero");
         return false;
      }
      ulong chain_hash = m_appended_transition_chain_hash;
      LP_HashMixULong(chain_hash, materialized.sequence);
      LP_HashMixULong(chain_hash, row_hash);
      if(chain_hash == 0)
      {
         Invalidate("transition_chain_hash_zero");
         return false;
      }
      materialized.event_hash = row_hash;
      materialized.reconciliation_hash = chain_hash;
      string line = TransitionLine(materialized);
      if(!GuardLine(line, true))
      {
         Invalidate("transition_line_guard_failed");
         return false;
      }
      if(m_transition_count >= LP_REVMA_DISCOVERY_TRANSITION_BUFFER_ROWS)
      {
         Invalidate("transition_buffer_resource_guard");
         return false;
      }
      long line_bytes = StringLen(line) + 2;
      int buffer_index = m_transition_count;
      m_transition_buffer[buffer_index] = line;
      m_transition_row_hash_buffer[buffer_index] = row_hash;
      m_transition_chain_hash_buffer[buffer_index] = chain_hash;
      m_transition_line_bytes[buffer_index] = line_bytes;
      m_transition_count++;
      m_transition_pending_bytes += line_bytes;
      m_transition_rows++;
      m_next_sequence++;
      m_appended_transition_chain_hash = chain_hash;
      m_branch_transition_chain[materialized.branch] = chain_hash;
      if(!ApplyWriterTransitionCounts(materialized))
      {
         Invalidate("telemetry_writer_transition_count_overflow");
         return false;
      }
      ApplyTransitionState(materialized);
      if(m_transition_count >= LP_REVMA_DISCOVERY_TRANSITION_FLUSH_ROWS)
      {
         if(!FlushTransitionBuffer()) return false;
      }
      appended_event_hash = row_hash;
      return true;
   }

   bool AppendSummary(LP_RevmaDiscoverySummaryRow &row)
   {
      if(LP_RevmaDiscoveryBranchValid(row.branch))
      {
         row.account_cycle_id = m_branch_account_cycle_id[row.branch];
         row.writer_branch_transition_rows =
            m_writer_branch_transition_rows[row.branch];
         row.writer_cycle_candidate_decision_rows =
            m_writer_cycle_candidate_decision_rows[row.branch];
         row.writer_cycle_candidate_admitted_rows =
            m_writer_cycle_candidate_admitted_rows[row.branch];
         row.writer_cycle_candidate_rejected_rows =
            m_writer_cycle_candidate_rejected_rows[row.branch];
         row.writer_cycle_inventory_transition_rows =
            m_writer_cycle_inventory_transition_rows[row.branch];
         row.writer_run_candidate_decision_rows =
            m_writer_run_candidate_decision_rows[row.branch];
         row.writer_run_candidate_admitted_rows =
            m_writer_run_candidate_admitted_rows[row.branch];
         row.writer_run_candidate_rejected_rows =
            m_writer_run_candidate_rejected_rows[row.branch];
         row.writer_run_inventory_transition_rows =
            m_writer_run_inventory_transition_rows[row.branch];
         bool aggregate_money_scope = row.summary_type == "cycle" ||
            row.summary_type == "reconciliation" ||
            row.summary_type == "run_completion";
         row.cleanup_funding_minor = aggregate_money_scope ?
            m_branch_cleanup_funding_minor[row.branch] : 0;
         if(row.summary_type == "run_completion")
            row.terminal_source_m1_time =
               m_branch_terminal_boundary_m1[row.branch];
         row.terminal_branch_transition_hash =
            m_branch_transition_chain[row.branch];
         row.run_elapsed_microseconds = m_run_started_microseconds > 0 ?
            (long)(GetMicrosecondCount() - m_run_started_microseconds) : 0;
         bool c_cycle = row.branch == LP_REVMA_BRANCH_C &&
            row.summary_type == "cycle";
         bool c_reconciliation = row.branch == LP_REVMA_BRANCH_C &&
            row.summary_type == "reconciliation";
         bool c_completion = row.branch == LP_REVMA_BRANCH_C &&
            row.summary_type == "run_completion";
         if(c_cycle || c_reconciliation || c_completion)
         {
            int unresolved_not_triggered =
               UnresolvedCenterNotTriggeredCount(row.branch_cycle_id);
            bool cycle_scope = c_cycle || c_reconciliation;
            row.center_applicable_grids = cycle_scope ?
               m_cycle_center_applicable_grids : m_center_applicable_grids;
            row.center_triggered_grids = cycle_scope ?
               m_cycle_center_triggered_grids : m_center_triggered_grids;
            row.center_not_triggered_grids = cycle_scope ?
               m_cycle_center_not_triggered_grids +
                   unresolved_not_triggered :
               m_center_not_triggered_grids + unresolved_not_triggered;
            row.center_not_applicable_grids = cycle_scope ?
               m_cycle_center_not_applicable_grids :
               m_center_not_applicable_grids;
            row.center_blocked_adverse_candidates = cycle_scope ?
               m_cycle_center_blocked_adverse_candidates :
               m_center_blocked_adverse_candidates;
            row.favorable_eligible_after_latch = cycle_scope ?
               m_cycle_favorable_eligible_after_latch :
               m_favorable_eligible_after_latch;
            row.center_latched = row.center_triggered_grids > 0;
            row.first_latch_time = cycle_scope ?
               m_cycle_first_center_latch_time :
               m_first_center_latch_time;
            if(row.center_applicable_grids !=
               row.center_triggered_grids +
                  row.center_not_triggered_grids)
            {
               Invalidate("center_counter_partition_mismatch");
               return false;
            }
         }
      }
      if(!m_initialized || !m_valid || !row.valid ||
         !LP_RevmaTelemetrySummaryTypeValid(row.summary_type) ||
         row.run_id != m_run_id || row.source_revision != m_source_revision ||
         row.profile_id != m_profile_id || row.config_hash != m_config_hash ||
         row.profile_hash != m_profile_hash || row.formula_hash != m_formula_hash ||
         !LP_RevmaDiscoveryBranchValid(row.branch) ||
         row.summary_sequence != 0 || row.event_hash != 0 ||
         row.reconciliation_hash != 0 || !LP_RevmaTelemetryFiniteSummary(row) ||
         !LP_RevmaTelemetryAsciiFieldValid(row.summary_type, false) ||
         !LP_RevmaTelemetryAsciiFieldValid(row.first_infeasibility, true) ||
         !LP_RevmaTelemetryAsciiFieldValid(row.latest_infeasibility, true) ||
         !LP_RevmaTelemetryAsciiFieldValid(row.terminal_reason, false) ||
         !ValidateSummaryState(row))
      {
         Invalidate("summary_row_invariant_failure");
         return false;
      }
      if(!FlushTransitionBuffer())
         return false;
      row.transition_flush_microseconds = m_transition_flush_microseconds;
      row.transition_flush_max_microseconds = m_transition_flush_max_microseconds;
      row.summary_flush_microseconds = m_summary_flush_microseconds;
      row.summary_flush_max_microseconds = m_summary_flush_max_microseconds;
      row.summary_sequence = m_next_summary_sequence;
      string canonical = SummaryLine(row);
      ulong row_hash = LP_HashString(canonical);
      if(row_hash == 0)
      {
         Invalidate("summary_row_hash_zero");
         return false;
      }
      ulong chain_hash = m_appended_summary_chain_hash;
      LP_HashMixULong(chain_hash, row.summary_sequence);
      LP_HashMixULong(chain_hash, row_hash);
      LP_HashMixULong(chain_hash, m_committed_transition_chain_hash);
      if(chain_hash == 0)
      {
         Invalidate("summary_chain_hash_zero");
         return false;
      }
      row.event_hash = row_hash;
      row.reconciliation_hash = chain_hash;
      string line = SummaryLine(row);
      if(!GuardLine(line, false)) return false;
      if(m_summary_count >= LP_REVMA_DISCOVERY_SUMMARY_BUFFER_ROWS)
      {
         Invalidate("summary_buffer_resource_guard");
         return false;
      }
      long line_bytes = StringLen(line) + 2;
      int buffer_index = m_summary_count;
      m_summary_buffer[buffer_index] = line;
      m_summary_row_hash_buffer[buffer_index] = row_hash;
      m_summary_chain_hash_buffer[buffer_index] = chain_hash;
      m_summary_line_bytes[buffer_index] = line_bytes;
      m_summary_count++;
      m_summary_pending_bytes += line_bytes;
      m_summary_rows++;
      m_next_summary_sequence++;
      m_appended_summary_chain_hash = chain_hash;
      ApplySummaryState(row);
      if(!m_valid)
         return false;
      if(m_summary_count >= LP_REVMA_DISCOVERY_SUMMARY_FLUSH_ROWS)
         return FlushSummaryBuffer();
      return true;
   }

   bool LatchFailure(const string reason)
   {
      if(!m_initialized || !m_valid ||
         !LP_RevmaTelemetryAsciiFieldValid(reason, false) ||
         StringLen(reason) > 256)
         return false;
      if(!m_external_failure_latched)
      {
         m_external_failure_latched = true;
         m_external_failure_reason = reason;
      }
      return true;
   }

   bool Finalize()
   {
      if(!m_initialized && m_transition_handle == INVALID_HANDLE &&
         m_summary_handle == INVALID_HANDLE && m_manifest_handle == INVALID_HANDLE)
         return false;
      bool flush_ok = m_valid;
      if(flush_ok) flush_ok = FlushTransitionBuffer() && FlushSummaryBuffer();
      bool required_evidence = m_transition_rows > 0 && m_summary_rows > 0 &&
         m_failure_event_count == 0 && !m_external_failure_latched &&
         m_manifest_pending_written && m_manifest_sequence == 1;
      for(int symbol_id = 0; symbol_id < LP_SYMBOL_COUNT; symbol_id++)
         required_evidence = required_evidence &&
            !m_matched_opportunity[symbol_id].active;
      for(int branch = 0; branch < LP_REVMA_DISCOVERY_BRANCH_COUNT; branch++)
      {
         required_evidence = required_evidence &&
            m_branch_cycle_id[branch] != 0 &&
            m_branch_cycle_summary_id[branch] == m_branch_cycle_id[branch] &&
            m_branch_reconciliation_summary[branch] &&
            m_branch_reconciliation_clean[branch] &&
            m_branch_run_completion_summary[branch] &&
            m_branch_run_formula_clean[branch] &&
             m_branch_run_sealed[branch] &&
             m_run_completion_bound_chain[branch] ==
                m_branch_transition_chain[branch] &&
             BranchOpenGridTerminalSnapshotsComplete(branch,
                m_branch_terminal_boundary_m1[branch]) &&
             BranchGridSummariesComplete(branch);
      }
      if(!required_evidence && m_valid)
         Invalidate(m_external_failure_latched ? m_external_failure_reason :
            "telemetry_required_terminal_evidence_missing");
      long transition_file_size = m_transition_handle != INVALID_HANDLE ?
         (long)FileSize(m_transition_handle) : -1;
      long summary_file_size = m_summary_handle != INVALID_HANDLE ?
         (long)FileSize(m_summary_handle) : -1;
      bool reconciled = flush_ok && m_transition_pending_bytes == 0 &&
         m_summary_pending_bytes == 0 &&
         m_transition_committed_rows == m_transition_rows &&
         m_summary_committed_rows == m_summary_rows &&
         m_committed_transition_chain_hash == m_appended_transition_chain_hash &&
         m_committed_summary_chain_hash == m_appended_summary_chain_hash &&
         transition_file_size == m_transition_bytes &&
         summary_file_size == m_summary_bytes;
      if(!reconciled && m_valid)
         Invalidate("telemetry_final_reconciliation_failure");
      bool complete = m_valid && reconciled && required_evidence;
      bool manifest_ok = false;
      if(m_manifest_handle != INVALID_HANDLE)
      {
         string final_reason = complete ? "" : m_invalid_reason;
         if(!complete && final_reason == "")
            final_reason = "telemetry_incomplete_unspecified";
         manifest_ok = m_manifest_pending_written &&
            WriteManifestStatus(complete, final_reason,
               transition_file_size, summary_file_size) &&
            m_manifest_sequence == 2;
         if(!manifest_ok)
            Invalidate("completion_manifest_write_or_size_failure");
      }
      if(m_transition_handle != INVALID_HANDLE) FileClose(m_transition_handle);
      if(m_summary_handle != INVALID_HANDLE) FileClose(m_summary_handle);
      if(m_manifest_handle != INVALID_HANDLE) FileClose(m_manifest_handle);
      m_transition_handle = INVALID_HANDLE;
      m_summary_handle = INVALID_HANDLE;
      m_manifest_handle = INVALID_HANDLE;
      m_initialized = false;
      return complete && manifest_ok && m_valid;
   }

   void AbortAndClose(const string reason)
   {
      string canonical_reason = reason;
      if(!LP_RevmaTelemetryAsciiFieldValid(canonical_reason, false) ||
         StringLen(canonical_reason) > 256)
         canonical_reason = "telemetry_abort_reason_invalid";
      if(m_valid) Invalidate(canonical_reason);
      Finalize();
   }

   bool Valid() { return m_valid && !m_external_failure_latched; }
   bool BranchTerminalReady(const int branch)
   {
      return LP_RevmaDiscoveryBranchValid(branch) &&
         m_branch_run_sealed[branch] &&
         m_branch_run_completion_summary[branch] &&
         m_branch_run_formula_clean[branch] &&
         m_branch_run_final_flat[branch] == !BranchHasOpenGrid(branch) &&
         (m_branch_run_final_flat[branch] ==
            (BranchCurrentAtoms(branch) == 0)) &&
          m_branch_terminal_grid_state_hash[branch] != 0 &&
          m_branch_terminal_book_hash[branch] != 0 &&
          m_branch_terminal_boundary_m1[branch] > 0 &&
          BranchOpenGridTerminalSnapshotsComplete(branch,
             m_branch_terminal_boundary_m1[branch]) &&
          m_run_completion_bound_chain[branch] ==
             m_branch_transition_chain[branch];
   }
   ulong BranchTerminalBookHash(const int branch)
   {
      return LP_RevmaDiscoveryBranchValid(branch) ?
         m_branch_terminal_book_hash[branch] : 0;
   }
   ulong BranchTerminalGridStateHash(const int branch)
   {
      return LP_RevmaDiscoveryBranchValid(branch) ?
          m_branch_terminal_grid_state_hash[branch] : 0;
   }
   ulong CurrentBranchTerminalGridEvidenceHash(const int branch)
   {
      if(!LP_RevmaDiscoveryBranchValid(branch)) return 0;
      return BranchTerminalGridEvidenceHash(branch,
         m_branch_cycle_id[branch], m_branch_terminal_boundary_m1[branch]);
   }
   ulong ExpectedSymbolSummaryEvidenceHash(
      const int branch,
      const int symbol_id)
   {
      if(!LP_RevmaDiscoveryBranchValid(branch) || symbol_id < 0 ||
         symbol_id >= LP_SYMBOL_COUNT)
         return 0;
      return FinalSummaryLedgerEvidenceHash(
         m_symbol_summary_ledger[branch][symbol_id]);
   }
   ulong ExpectedBranchSummaryEvidenceHash(const int branch)
   {
      if(!LP_RevmaDiscoveryBranchValid(branch))
         return 0;
      return FinalSummaryLedgerEvidenceHash(
         m_branch_summary_ledger[branch]);
   }
   bool BranchTerminalFinalFlat(const int branch)
   {
      return LP_RevmaDiscoveryBranchValid(branch) &&
         m_branch_run_final_flat[branch];
   }
   datetime BranchTerminalBoundaryM1(const int branch)
   {
      return LP_RevmaDiscoveryBranchValid(branch) ?
         m_branch_terminal_boundary_m1[branch] : 0;
   }
   string InvalidReason()
   {
      return m_external_failure_latched ? m_external_failure_reason :
         m_invalid_reason;
   }
   long TransitionRows() { return m_transition_rows; }
   long SummaryRows() { return m_summary_rows; }
   long TransitionBytes() { return m_transition_bytes; }
   long SummaryBytes() { return m_summary_bytes; }
   long TransitionFlushes() { return m_transition_flushes; }
   long SummaryFlushes() { return m_summary_flushes; }
};

#endif // __LIMNI_PORTFOLIO_REVMA_DISCOVERY_TELEMETRY_MQH__
