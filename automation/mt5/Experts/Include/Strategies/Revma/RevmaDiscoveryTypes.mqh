/*-----------------------------------------------
  Gate 108 RevMA Adaptive Grid Discovery contracts
-----------------------------------------------*/
#ifndef __LIMNI_PORTFOLIO_REVMA_DISCOVERY_TYPES_MQH__
#define __LIMNI_PORTFOLIO_REVMA_DISCOVERY_TYPES_MQH__

#include "..\\..\\Core\\BuildInfo.mqh"
#include "..\\..\\Core\\Types.mqh"
#include "..\\RevmaTypes.mqh"

#define LP_REVMA_DISCOVERY_FORMULA_ID "revma-adaptive-grid-discovery-v1"
#define LP_REVMA_DISCOVERY_PROFILE_ID "gate108-core-institutional-v1"
#define LP_REVMA_DISCOVERY_MESH_ID "DISCOVERY_MESH_V1"
#define LP_REVMA_REAL_BRANCH_ID "REAL_EXECUTION_ENVELOPE_V1"
#define LP_REVMA_SHADOW_U_BRANCH_ID "SHADOW_RAW_COUNT_UNCAPPED_V1"
#define LP_REVMA_SHADOW_C_BRANCH_ID "SHADOW_SIGNED_CENTER_SUPPORT_V1"
#define LP_REVMA_DISCOVERY_CAPITAL_BUDGET_NUMERATOR 1
#define LP_REVMA_DISCOVERY_CAPITAL_BUDGET_DENOMINATOR 10
#define LP_REVMA_DISCOVERY_CAPITAL_BUDGET_FRACTION 0.10
#define LP_REVMA_DISCOVERY_CELL_Q_FRACTION 0.10
#define LP_REVMA_DISCOVERY_ATOM_LOTS 0.01
#define LP_REVMA_REAL_MAX_ATOMS_PER_GRID 2
#define LP_REVMA_DISCOVERY_MAX_ADMISSIONS_PER_M1 1
#define LP_REVMA_DISCOVERY_Q_PROFILE LP_REVMA_Q_PROFILE_MEDIUM
#define LP_REVMA_DISCOVERY_MAX_M1_BARS 50000
#define LP_REVMA_DISCOVERY_OUTPUT_FOLDER "LimniPortfolioEA\\Gate108"
#define LP_REVMA_DISCOVERY_BRANCH_COUNT 3
#define LP_REVMA_SHADOW_BRANCH_COUNT 2
#define LP_REVMA_DISCOVERY_TELEMETRY_SCHEMA_ID "gate108-discovery-telemetry-v12"
#define LP_REVMA_DISCOVERY_MINOR_ABS_LIMIT 9000000000000000000
#define LP_REVMA_DISCOVERY_TRANSITION_BUFFER_ROWS 256
#define LP_REVMA_DISCOVERY_TRANSITION_FLUSH_ROWS 64
#define LP_REVMA_DISCOVERY_SUMMARY_BUFFER_ROWS 64
#define LP_REVMA_DISCOVERY_SUMMARY_FLUSH_ROWS 16
#define LP_REVMA_DISCOVERY_MAX_LINE_BYTES 8192
#define LP_REVMA_DISCOVERY_ARTIFACT_BYTE_GUARD 4294967296

enum LP_RevmaDiscoveryBranch
{
   LP_REVMA_BRANCH_R = 0,
   LP_REVMA_BRANCH_U = 1,
   LP_REVMA_BRANCH_C = 2
};

enum LP_RevmaDiscoveryDecision
{
   LP_REVMA_DISCOVERY_DECISION_NONE = 0,
   LP_REVMA_DISCOVERY_DECISION_ADMIT = 1,
   LP_REVMA_DISCOVERY_DECISION_REJECT = 2,
   LP_REVMA_DISCOVERY_DECISION_CLOSE = 3,
   LP_REVMA_DISCOVERY_DECISION_INVALIDATE = 4
};

enum LP_RevmaDiscoveryCloseOwner
{
   LP_REVMA_DISCOVERY_CLOSE_NONE = 0,
   LP_REVMA_DISCOVERY_CLOSE_LOCAL_HARVEST = 1,
   LP_REVMA_DISCOVERY_CLOSE_CLEANUP = 2,
   LP_REVMA_DISCOVERY_CLOSE_HARD_RISK = 3
};

enum LP_RevmaDiscoveryCandidateType
{
   LP_REVMA_DISCOVERY_CANDIDATE_NONE = 0,
   LP_REVMA_DISCOVERY_CANDIDATE_BIRTH = 1,
   LP_REVMA_DISCOVERY_CANDIDATE_ADVERSE_ADD = 2,
   LP_REVMA_DISCOVERY_CANDIDATE_FAVORABLE_ADD = 3
};

string LP_RevmaDiscoveryBranchId(const int branch)
{
   if(branch == LP_REVMA_BRANCH_R)
      return LP_REVMA_REAL_BRANCH_ID;
   if(branch == LP_REVMA_BRANCH_U)
      return LP_REVMA_SHADOW_U_BRANCH_ID;
   if(branch == LP_REVMA_BRANCH_C)
      return LP_REVMA_SHADOW_C_BRANCH_ID;
   return "UNKNOWN_DISCOVERY_BRANCH";
}

bool LP_RevmaDiscoveryBranchValid(const int branch)
{
   return branch >= LP_REVMA_BRANCH_R && branch <= LP_REVMA_BRANCH_C;
}

string LP_RevmaDiscoveryBirthBucket(
   const int direction,
   const long p0_ticks,
   const long c0_ticks)
{
   if(direction == LP_SIDE_LONG)
   {
      if(p0_ticks > c0_ticks) return "LONG_ABOVE_CENTER_V1";
      if(p0_ticks < c0_ticks) return "LONG_BELOW_CENTER_V1";
      return "LONG_AT_CENTER_V1";
   }
   if(direction == LP_SIDE_SHORT)
   {
      if(p0_ticks > c0_ticks) return "SHORT_ABOVE_CENTER_V1";
      if(p0_ticks < c0_ticks) return "SHORT_BELOW_CENTER_V1";
      return "SHORT_AT_CENTER_V1";
   }
   return "INVALID_CENTER_BIRTH_BUCKET";
}

bool LP_RevmaDiscoveryBirthBucketValid(const string value)
{
   return value == "LONG_ABOVE_CENTER_V1" ||
      value == "LONG_BELOW_CENTER_V1" ||
      value == "LONG_AT_CENTER_V1" ||
      value == "SHORT_ABOVE_CENTER_V1" ||
      value == "SHORT_BELOW_CENTER_V1" ||
      value == "SHORT_AT_CENTER_V1";
}

bool LP_RevmaDiscoveryCapitalMandateValid()
{
   return LP_REVMA_DISCOVERY_CAPITAL_BUDGET_NUMERATOR == 1 &&
      LP_REVMA_DISCOVERY_CAPITAL_BUDGET_DENOMINATOR == 10 &&
      LP_REVMA_DISCOVERY_CAPITAL_BUDGET_FRACTION == 0.10 &&
      NormalizeDouble(LP_REVMA_DISCOVERY_CAPITAL_BUDGET_FRACTION, 2) ==
         NormalizeDouble((double)LP_REVMA_DISCOVERY_CAPITAL_BUDGET_NUMERATOR /
            (double)LP_REVMA_DISCOVERY_CAPITAL_BUDGET_DENOMINATOR, 2);
}

bool LP_RevmaDiscoveryCapitalBudgetMinor(
   const long equity_reference_minor,
   long &capital_budget_minor)
{
   capital_budget_minor = 0;
   if(!LP_RevmaDiscoveryCapitalMandateValid() || equity_reference_minor <= 0)
      return false;
   capital_budget_minor =
      (equity_reference_minor /
         LP_REVMA_DISCOVERY_CAPITAL_BUDGET_DENOMINATOR) *
            LP_REVMA_DISCOVERY_CAPITAL_BUDGET_NUMERATOR;
   return capital_budget_minor > 0;
}

bool LP_RevmaDiscoveryConfigValid(const LP_Config &config, string &reason)
{
   reason = "";
   if(config.execution_mode != LP_EXECUTION_TESTER_ONLY ||
      !config.enable_trading || config.allow_live_trading ||
      !config.enable_open_order_routing || !config.enable_close_execution ||
      !config.enable_account_close_execution ||
      !config.enable_strategy_evaluation || !config.enable_revma_system)
      reason = "gate108_execution_profile_mismatch";
   else if(!config.require_hedging_account || !config.use_timer_watchdog)
      reason = "gate108_account_scheduler_assumptions_mismatch";
   else if(config.news_guard_mode != LP_NEWS_GUARD_DISABLED ||
      !config.use_week_boundary_guard || config.broker_to_est_offset_hours != 0.0 ||
      config.sunday_open_hour_est != 17 || config.friday_close_hour_est != 17 ||
      config.boundary_block_minutes != 60 ||
      config.news_block_before_minutes != 30 ||
      config.news_block_after_minutes != 30)
      reason = "gate108_calendar_profile_mismatch";
   else if(config.receipt_mode != LP_RECEIPT_MODE_OFF)
      reason = "gate108_general_receipts_must_be_off";
   else if(config.enable_qstate_trend_variant ||
      config.enable_portfolio_harvest_governor)
      reason = "gate108_non_revma_authority_enabled";
   else if(config.revma_universe_mode != LP_UNIVERSE_FX28)
      reason = "gate108_requires_fx28";
   else if(!config.require_all_symbols)
      reason = "gate108_requires_all_symbols";
   else if(config.revma_q_profile != LP_REVMA_DISCOVERY_Q_PROFILE ||
      LP_RevmaResolvedMaxM1Bars(config) != LP_REVMA_DISCOVERY_MAX_M1_BARS)
      reason = "gate108_q_profile_mismatch";
   else if(config.revma_fixed_lots != LP_REVMA_DISCOVERY_ATOM_LOTS)
      reason = "gate108_atom_lots_mismatch";
   else if(config.revma_grid_spacing_q != LP_REVMA_DISCOVERY_CELL_Q_FRACTION)
      reason = "gate108_mesh_input_mismatch";
   else if(config.revma_intent_expiry_minutes != 10 ||
      config.revma_show_visual_dashboard ||
      config.revma_dashboard_screenshot_on_divergent_add)
      reason = "gate108_revma_execution_assumptions_mismatch";
   else if(config.persist_revma_lifecycle_state)
      reason = "gate108_per_add_persistence_forbidden";
   else if(config.source_revision != LP_EA_SOURCE_BUNDLE_ID ||
      LP_EA_SOURCE_BUNDLE_ID == "" ||
      LP_EA_SOURCE_BUNDLE_ID == "PENDING_GATE108_SOURCE_BUNDLE")
      reason = "gate108_compiled_source_bundle_identity_mismatch";
   else if(config.stop_take_profit_mode != LP_SLTP_DISABLED ||
      config.broker_grid_tp_sync_mode != LP_BROKER_GRID_TP_SYNC_OFF ||
      config.grid_take_profit_q != 0.0 || config.grid_stop_loss_q != 0.0 ||
      config.account_take_profit_pct != 0.0 || config.account_stop_loss_pct != 0.0 ||
      config.hwm_trail_arm_pct != 0.0 || config.hwm_trail_min_lock_pct != 0.0 ||
      config.hwm_trail_giveback_pct != 0.0 || config.hwm_trail_hard_stop_loss_pct != 0.0)
      reason = "gate108_legacy_exit_authority_must_be_disabled";
   else if(config.enable_currency_exposure_guard)
      reason = "gate108_legacy_currency_guard_must_be_disabled";
   else if(config.max_managed_positions != 200 ||
      config.max_single_order_lots != 1.0 ||
      config.max_close_positions_per_step != 10)
      reason = "gate108_execution_capacity_assumptions_mismatch";
   return reason == "";
}

ulong LP_RevmaDiscoveryProfileHash()
{
   static ulong cached_hash = 0;
   if(cached_hash != 0) return cached_hash;
   string payload = LP_REVMA_DISCOVERY_PROFILE_ID;
   payload += "|universe=FX28|required_all_symbols=true";
   payload += "|execution=tester_trading_router_close_account_close";
   payload += "|hedging=true|timer_watchdog=true|live=false";
   payload += "|calendar=week_boundary_est_17_17_60|news=disabled";
   payload += "|q_profile=" + LP_RevmaQProfileName(LP_REVMA_DISCOVERY_Q_PROFILE);
   payload += "|max_m1_bars=" + IntegerToString(LP_REVMA_DISCOVERY_MAX_M1_BARS);
   payload += "|atom_lots=" + DoubleToString(LP_REVMA_DISCOVERY_ATOM_LOTS, 2);
   payload += "|mesh_q=" + DoubleToString(LP_REVMA_DISCOVERY_CELL_Q_FRACTION, 2);
   payload += "|capital_budget=" +
      DoubleToString(LP_REVMA_DISCOVERY_CAPITAL_BUDGET_FRACTION, 2);
   payload += "|lifecycle_persistence=false|dedicated_telemetry=required";
   payload += "|dedicated_output=common_files_gate108|general_receipts=off";
   payload += "|legacy_grid_tp_sl=false|legacy_account_tp_sl_hwm=false";
   cached_hash = LP_HashString(payload);
   return cached_hash;
}

ulong LP_RevmaDiscoveryFormulaHash()
{
   static ulong cached_hash = 0;
   if(cached_hash != 0)
      return cached_hash;
   string payload = LP_REVMA_DISCOVERY_FORMULA_ID;
   payload += "|profile=" + LP_REVMA_DISCOVERY_PROFILE_ID;
   payload += "|profile_hash=" + (string)LP_RevmaDiscoveryProfileHash();
   payload += "|source_bundle_algorithm=" + LP_EA_SOURCE_BUNDLE_ALGORITHM;
   payload += "|source_bundle_id=" + LP_EA_SOURCE_BUNDLE_ID;
   payload += "|underlying_revma_formula_hash=" + (string)LP_RevmaFormulaHash();
   payload += "|mesh=" + LP_REVMA_DISCOVERY_MESH_ID;
   payload += "|capital_budget_fraction=" +
      DoubleToString(LP_REVMA_DISCOVERY_CAPITAL_BUDGET_FRACTION, 2);
   payload += "|capital_budget_ratio=" +
      IntegerToString(LP_REVMA_DISCOVERY_CAPITAL_BUDGET_NUMERATOR) + "/" +
      IntegerToString(LP_REVMA_DISCOVERY_CAPITAL_BUDGET_DENOMINATOR);
   payload += "|cell_q_fraction=" +
      DoubleToString(LP_REVMA_DISCOVERY_CELL_Q_FRACTION, 2);
   payload += "|atom_lots=" + DoubleToString(LP_REVMA_DISCOVERY_ATOM_LOTS, 2);
   payload += "|real_max_atoms=" + IntegerToString(LP_REVMA_REAL_MAX_ATOMS_PER_GRID);
   payload += "|max_admissions_per_grid_m1=" +
      IntegerToString(LP_REVMA_DISCOVERY_MAX_ADMISSIONS_PER_M1);
   payload += "|shadow_topology=2x28_one_grid_per_symbol_branch";
   payload += "|allocation=build_all_sort_reservation_symbol_identity_allocate_commit";
   payload += "|add_classifier=completed_m1_decision_ticks_vs_executed_entry_extrema_plus_frozen_cell_v1";
   payload += "|stress_reference=frozen_separate_from_decision_and_fill_v1";
   payload += "|concentration_proxy=phase5_undefined_fail_closed_zero_v1";
   payload += "|money_ledger=signed_integer_minor_currency_units";
   payload += "|money_quantization=gain_floor_liability_floor_budget_floor_reference_ceil";
   payload += "|grid_money_evidence=current_committed_plus_prospective_candidate_checked_v1";
   payload += "|shadow_mae=max_negative_completed_m1_mark_minor_v1";
   payload += "|shadow_underwater=elapsed_minutes_while_previous_completed_m1_mark_negative_v1";
   payload += "|hard_risk_authority=frozen_capital_budget_breach_only_v1";
   payload += "|modeled_margin_insolvency=branch_invalid_no_new_liquidation_authority_v1";
   payload += "|arithmetic_failure=branch_invalid";
   payload += "|center_authority=C_aligned_positive_to_nonpositive_adverse_add_only";
   payload += "|center_candidate_authority=recomputed_full_state_identity_before_admission_v1";
   payload += "|center_missing=no_latch_no_reclassification";
   payload += "|center_misaligned=observational_only";
   payload += "|birth_bucket=direction_plus_tick_normalized_p0_relative_to_c0_v1";
   payload += "|telemetry_schema=" + (string)LP_REVMA_DISCOVERY_TELEMETRY_SCHEMA_ID;
   payload += "|transition_buffer_rows=" +
      IntegerToString(LP_REVMA_DISCOVERY_TRANSITION_BUFFER_ROWS);
   payload += "|transition_flush_rows=" +
      IntegerToString(LP_REVMA_DISCOVERY_TRANSITION_FLUSH_ROWS);
   payload += "|summary_buffer_rows=" +
      IntegerToString(LP_REVMA_DISCOVERY_SUMMARY_BUFFER_ROWS);
   payload += "|summary_flush_rows=" +
      IntegerToString(LP_REVMA_DISCOVERY_SUMMARY_FLUSH_ROWS);
   payload += "|telemetry_max_line_bytes=" +
      IntegerToString(LP_REVMA_DISCOVERY_MAX_LINE_BYTES);
   payload += "|artifact_byte_guard=" +
      (string)LP_REVMA_DISCOVERY_ARTIFACT_BYTE_GUARD;
   payload += "|telemetry_encoding=ansi_ascii_csv_crlf";
   payload += "|telemetry_location=common_files_required";
   payload += "|telemetry_failure=run_invalid_no_silent_drop";
   payload += "|telemetry_completion=R_U_C_reconciliation_and_run_summary_required";
   payload += "|telemetry_cycle_identity=explicit_branch_cycle_start";
   payload += "|branch_cycle_identity=run_local_checked_monotonic_sequence_v1";
   payload += "|account_cycle_identity=run_local_checked_monotonic_sequence_v1";
   payload += "|cycle_capital_identity=frozen_E_ref_and_exact_one_tenth_budget_v1";
   payload += "|candidate_decision_identity=one_terminal_decision_per_grid_completed_m1_v1";
   payload += "|pre_divergence_matched_rejection=exact_canonical_reason_when_both_capacity_reject_v1";
   payload += "|favorable_after_latch_evidence=eligible_then_exact_candidate_decision_v1";
   payload += "|infeasibility_evidence=canonical_rejection_then_writer_linked_first_marker_v1";
   payload += "|R_pre_route_rejection=canonical_capacity_or_two_atom_envelope_only_v1";
   payload += "|R_post_route_broker_rejection=formula_invalid_failure_v1";
   payload += "|telemetry_terminal_boundary=flat_cycle_close_or_per_grid_snapshot_then_unresolved_run_boundary";
   payload += "|telemetry_integrity=writer_owned_header_seeded_transition_and_summary_hash_chains_v1";
   payload += "|summary_reconciliation=terminal_grid_to_symbol_to_cycle_to_run_checked_rollup_v1";
   payload += "|summary_peak_semantics=max_child_grid_scalar_not_concurrent_portfolio_peak_underwater_sum_v1";
   payload += "|portfolio_peak_liability_margin_concentration=phase5_required_before_activation";
   payload += "|terminal_reconciliation=book_v1_plus_terminal_event_set_v2_dual_hash_commit_v1";
   payload += "|terminal_row_state_equivalence=phase5_required_before_activation";
   payload += "|terminal_reason=immutable_origin_separate_from_active_close_owner_v1";
   payload += "|center_regression=x_completed_m1_observation_index_y_revision_q";
   payload += "|cell_quantization=ceil_outward_to_broker_tick";
   payload += "|path_price=closed_m1_structural_decision_price";
   payload += "|completed_m1_time=positive_epoch_aligned_to_60_seconds_v1";
   payload += "|branches=" + (string)LP_REVMA_REAL_BRANCH_ID + "," +
      (string)LP_REVMA_SHADOW_U_BRANCH_ID + "," +
      (string)LP_REVMA_SHADOW_C_BRANCH_ID;
   payload += "|identity_versions=grid_v1_shared_origin_v2_matched_snapshot_v2_opportunity_v2";
   payload += "|shadow_broker_calls=forbidden";
   payload += "|resource_exhaustion=invalidates_not_caps";
   cached_hash = LP_HashString(payload);
   return cached_hash;
}

ulong LP_RevmaDiscoveryOpportunityIdentity(
   const ulong shared_origin_id,
   const int symbol_id,
   const datetime source_m1_time,
   const int candidate_type,
   const ulong pre_candidate_state_hash,
   const ulong matched_snapshot_hash
)
{
   if(shared_origin_id == 0 || symbol_id < 0 ||
      symbol_id >= LP_SYMBOL_COUNT || source_m1_time <= 0 ||
      !LP_RevmaDiscoveryCandidateTypeValid(candidate_type) ||
      pre_candidate_state_hash == 0 || matched_snapshot_hash == 0)
      return 0;
   ulong hash = LP_HashString("gate108_opportunity_v2");
   LP_HashMixULong(hash, shared_origin_id);
   LP_HashMixInt(hash, symbol_id);
   LP_HashMixLong(hash, (long)source_m1_time);
   LP_HashMixInt(hash, candidate_type);
   LP_HashMixULong(hash, pre_candidate_state_hash);
   LP_HashMixULong(hash, matched_snapshot_hash);
   LP_HashMixULong(hash, LP_RevmaDiscoveryFormulaHash());
   return hash;
}

ulong LP_RevmaDiscoverySharedOriginIdentity(
   const int symbol_id,
   const datetime birth_source_m1_time,
   const ulong birth_pre_candidate_state_hash,
   const ulong birth_matched_snapshot_hash
)
{
   if(symbol_id < 0 || symbol_id >= LP_SYMBOL_COUNT ||
      birth_source_m1_time <= 0 || birth_pre_candidate_state_hash == 0 ||
      birth_matched_snapshot_hash == 0)
      return 0;
   ulong hash = LP_HashString("gate108_shared_origin_v2");
   LP_HashMixInt(hash, symbol_id);
   LP_HashMixLong(hash, (long)birth_source_m1_time);
   LP_HashMixULong(hash, birth_pre_candidate_state_hash);
   LP_HashMixULong(hash, birth_matched_snapshot_hash);
   LP_HashMixULong(hash, LP_RevmaDiscoveryFormulaHash());
   return hash;
}

ulong LP_RevmaDiscoveryMatchedSnapshotIdentity(
   const int symbol_id,
   const datetime source_m1_time,
   const int direction,
   const int candidate_type,
   const ulong pre_candidate_state_hash,
   const ulong signal_identity_hash,
   const int q_event_count,
   const double q0,
   const double decision_price,
   const double stress_price,
   const double fill_price,
   const double p0,
   const double c0,
   const double broker_tick_size,
   const long a_g_candidate_minor,
   const long a_g_minor,
   const long margin_minor,
   const long immediate_liquidation_minor,
   const long immediate_close_cost_minor
)
{
   if(symbol_id < 0 || symbol_id >= LP_SYMBOL_COUNT ||
      source_m1_time <= 0 ||
      (direction != LP_SIDE_LONG && direction != LP_SIDE_SHORT) ||
      !LP_RevmaDiscoveryCandidateTypeValid(candidate_type) ||
      pre_candidate_state_hash == 0 || signal_identity_hash == 0 ||
       q_event_count <= 0 || q0 <= 0.0 || decision_price <= 0.0 ||
       stress_price <= 0.0 || fill_price <= 0.0 ||
      p0 <= 0.0 || c0 <= 0.0 ||
      broker_tick_size <= 0.0 || a_g_candidate_minor <= 0 ||
      a_g_minor <= 0 || margin_minor <= 0 ||
      immediate_close_cost_minor < 0 ||
      immediate_close_cost_minor > LP_REVMA_DISCOVERY_MINOR_ABS_LIMIT ||
      immediate_liquidation_minor > LP_REVMA_DISCOVERY_MINOR_ABS_LIMIT ||
      immediate_liquidation_minor < -LP_REVMA_DISCOVERY_MINOR_ABS_LIMIT ||
      immediate_liquidation_minor > -immediate_close_cost_minor ||
       !MathIsValidNumber(q0) || !MathIsValidNumber(decision_price) ||
       !MathIsValidNumber(stress_price) || !MathIsValidNumber(fill_price) ||
      !MathIsValidNumber(p0) ||
      !MathIsValidNumber(c0) || !MathIsValidNumber(broker_tick_size))
      return 0;
   ulong hash = LP_HashString("gate108_matched_snapshot_v2");
   LP_HashMixInt(hash, symbol_id);
   LP_HashMixLong(hash, (long)source_m1_time);
   LP_HashMixInt(hash, direction);
   LP_HashMixInt(hash, candidate_type);
   LP_HashMixULong(hash, pre_candidate_state_hash);
   LP_HashMixULong(hash, signal_identity_hash);
   LP_HashMixInt(hash, q_event_count);
   LP_HashMixULong(hash, LP_HashString(DoubleToString(q0, 12)));
   LP_HashMixULong(hash,
      LP_HashString(DoubleToString(decision_price, 12)));
   LP_HashMixULong(hash,
      LP_HashString(DoubleToString(stress_price, 12)));
   LP_HashMixULong(hash, LP_HashString(DoubleToString(fill_price, 12)));
   LP_HashMixULong(hash, LP_HashString(DoubleToString(p0, 12)));
   LP_HashMixULong(hash, LP_HashString(DoubleToString(c0, 12)));
   LP_HashMixULong(hash, LP_HashString(DoubleToString(broker_tick_size, 12)));
   LP_HashMixLong(hash, a_g_candidate_minor);
   LP_HashMixLong(hash, a_g_minor);
   LP_HashMixLong(hash, margin_minor);
   LP_HashMixLong(hash, immediate_liquidation_minor);
   LP_HashMixLong(hash, immediate_close_cost_minor);
   LP_HashMixULong(hash, LP_RevmaDiscoveryFormulaHash());
   return hash;
}

ulong LP_RevmaDiscoveryGridIdentity(
   const int branch,
   const int symbol_id,
   const long grid_generation,
   const ulong branch_cycle_id,
   const datetime birth_source_m1_time,
   const ulong signal_identity_hash
)
{
   if(!LP_RevmaDiscoveryBranchValid(branch) || symbol_id < 0 ||
      symbol_id >= LP_SYMBOL_COUNT || grid_generation <= 0 ||
      branch_cycle_id == 0 || birth_source_m1_time <= 0 ||
      signal_identity_hash == 0)
      return 0;
   ulong hash = LP_HashString("gate108_grid_identity_v1");
   LP_HashMixULong(hash, LP_HashString(LP_RevmaDiscoveryBranchId(branch)));
   LP_HashMixInt(hash, symbol_id);
   LP_HashMixLong(hash, grid_generation);
   LP_HashMixULong(hash, branch_cycle_id);
   LP_HashMixLong(hash, (long)birth_source_m1_time);
   LP_HashMixULong(hash, signal_identity_hash);
   LP_HashMixULong(hash, LP_RevmaDiscoveryFormulaHash());
   return hash;
}

ulong LP_RevmaDiscoveryTerminalBookIdentity(
   const int branch,
   const ulong branch_cycle_id,
   const datetime terminal_source_m1_time,
   const bool final_flat,
   const int current_atoms,
   const double current_lots,
   const long equity_reference_minor,
   const long budget_minor,
   const long harvest_minor,
   const long nonharvest_minor,
   const long liability_minor,
   const long cost_minor,
   const long reservation_minor,
   const long margin_minor,
   const long branch_equity_minor,
   const int close_owner,
   const bool cleanup_shortfall,
   const ulong terminal_grid_state_hash
)
{
   long expected_budget_minor = 0;
   if(!LP_RevmaDiscoveryBranchValid(branch) || branch_cycle_id == 0 ||
      terminal_source_m1_time <= 0 ||
      current_atoms < 0 || !MathIsValidNumber(current_lots) ||
      NormalizeDouble(current_lots, 2) != NormalizeDouble(
         (double)current_atoms * LP_REVMA_DISCOVERY_ATOM_LOTS, 2) ||
      equity_reference_minor <= 0 || budget_minor <= 0 ||
      !LP_RevmaDiscoveryCapitalBudgetMinor(equity_reference_minor,
         expected_budget_minor) || budget_minor != expected_budget_minor ||
      cost_minor < 0 ||
      reservation_minor < 0 || margin_minor < 0 ||
      close_owner < LP_REVMA_DISCOVERY_CLOSE_NONE ||
      close_owner > LP_REVMA_DISCOVERY_CLOSE_HARD_RISK ||
      terminal_grid_state_hash == 0 ||
      (final_flat && (current_atoms != 0 || current_lots != 0.0 ||
       reservation_minor != 0 || margin_minor != 0 || liability_minor != 0)))
      return 0;
   ulong hash = LP_HashString("gate108_terminal_book_identity_v1");
   LP_HashMixULong(hash, LP_HashString(LP_RevmaDiscoveryBranchId(branch)));
   LP_HashMixULong(hash, branch_cycle_id);
   LP_HashMixLong(hash, (long)terminal_source_m1_time);
   LP_HashMixInt(hash, final_flat ? 1 : 0);
   LP_HashMixInt(hash, current_atoms);
   LP_HashMixULong(hash, LP_HashString(DoubleToString(current_lots, 2)));
   LP_HashMixLong(hash, equity_reference_minor);
   LP_HashMixLong(hash, budget_minor);
   LP_HashMixLong(hash, harvest_minor);
   LP_HashMixLong(hash, nonharvest_minor);
   LP_HashMixLong(hash, liability_minor);
   LP_HashMixLong(hash, cost_minor);
   LP_HashMixLong(hash, reservation_minor);
   LP_HashMixLong(hash, margin_minor);
   LP_HashMixLong(hash, branch_equity_minor);
   LP_HashMixInt(hash, close_owner);
   LP_HashMixInt(hash, cleanup_shortfall ? 1 : 0);
   LP_HashMixULong(hash, terminal_grid_state_hash);
   LP_HashMixULong(hash, LP_RevmaDiscoveryFormulaHash());
   return hash;
}

ulong LP_RevmaTerminalGridEventSetSeed(
   const int branch,
   const ulong cycle_id,
   const datetime terminal_source_m1_time)
{
   if(!LP_RevmaDiscoveryBranchValid(branch) || cycle_id == 0 ||
      terminal_source_m1_time <= 0)
      return 0;
   ulong hash = LP_HashString("gate108_terminal_grid_event_set_v2");
   LP_HashMixULong(hash, LP_HashString(LP_RevmaDiscoveryBranchId(branch)));
   LP_HashMixULong(hash, cycle_id);
   LP_HashMixLong(hash, (long)terminal_source_m1_time);
   return hash;
}

bool LP_RevmaTerminalGridEventSetMix(
   ulong &hash,
   const int symbol_id,
   const ulong branch_grid_id,
   const datetime terminal_event_m1_time,
   const ulong terminal_internal_state_hash,
   const ulong terminal_event_hash)
{
   if(hash == 0 || symbol_id < 0 || symbol_id >= LP_SYMBOL_COUNT ||
       ((branch_grid_id == 0) !=
        (terminal_event_m1_time == 0 &&
         terminal_internal_state_hash == 0 && terminal_event_hash == 0)) ||
       (branch_grid_id != 0 &&
        (terminal_event_m1_time <= 0 ||
         terminal_internal_state_hash == 0 || terminal_event_hash == 0)))
      return false;
   LP_HashMixInt(hash, symbol_id);
   LP_HashMixULong(hash, branch_grid_id);
   LP_HashMixLong(hash, (long)terminal_event_m1_time);
   LP_HashMixULong(hash, terminal_internal_state_hash);
   LP_HashMixULong(hash, terminal_event_hash);
   return hash != 0;
}

ulong LP_RevmaTerminalGridEventSetFinalize(ulong hash)
{
   if(hash == 0) return 0;
   LP_HashMixULong(hash, LP_RevmaDiscoveryFormulaHash());
   return hash;
}

bool LP_RevmaDiscoveryCandidateTypeValid(const int candidate_type)
{
   return candidate_type == LP_REVMA_DISCOVERY_CANDIDATE_BIRTH ||
      candidate_type == LP_REVMA_DISCOVERY_CANDIDATE_ADVERSE_ADD ||
      candidate_type == LP_REVMA_DISCOVERY_CANDIDATE_FAVORABLE_ADD;
}

ulong LP_RevmaDiscoverySignalIdentity(const LP_RevmaSignal &signal)
{
   if(!signal.valid || signal.symbol_id < 0 ||
      signal.symbol_id >= LP_SYMBOL_COUNT || signal.source_m1_time <= 0 ||
      signal.formula_hash == 0 || signal.reconstruction_epoch == 0)
      return 0;
   ulong hash = LP_HashString("gate108_shared_signal_snapshot_v1");
   LP_HashMixInt(hash, signal.symbol_id);
   LP_HashMixLong(hash, (long)signal.source_m1_time);
   LP_HashMixInt(hash, signal.direction);
   LP_HashMixInt(hash, signal.sleeve);
   LP_HashMixInt(hash, signal.variant_id);
   LP_HashMixULong(hash, signal.formula_hash);
   LP_HashMixULong(hash, signal.reconstruction_epoch);
   LP_HashMixInt(hash, signal.q_days);
   LP_HashMixInt(hash, signal.q_event_count);
   LP_HashMixULong(hash, LP_HashString(DoubleToString(signal.price, 12)));
   LP_HashMixULong(hash, LP_HashString(DoubleToString(signal.q, 12)));
   LP_HashMixULong(hash, LP_HashString(DoubleToString(signal.anchor, 12)));
   return hash;
}

ulong LP_RevmaDiscoveryAdmissionIdentity(const int branch, const ulong branch_grid_id, const datetime source_m1_time)
{
   ulong hash = LP_HashString(LP_RevmaDiscoveryBranchId(branch));
   LP_HashMixULong(hash, branch_grid_id);
   LP_HashMixLong(hash, (long)source_m1_time);
   LP_HashMixULong(hash, LP_RevmaDiscoveryFormulaHash());
   return hash;
}

struct LP_RevmaDiscoveryIdentity
{
   bool valid;
   int branch;
   ulong branch_grid_id;
   ulong branch_cycle_id;
   int symbol_id;
   int direction;
   datetime source_m1_time;
   string formula_id;
   ulong formula_hash;
   string profile_id;
   string branch_id;
};

void LP_ResetRevmaDiscoveryIdentity(LP_RevmaDiscoveryIdentity &identity)
{
   identity.valid = false;
   identity.branch = -1;
   identity.branch_grid_id = 0;
   identity.branch_cycle_id = 0;
   identity.symbol_id = -1;
   identity.direction = LP_SIDE_NONE;
   identity.source_m1_time = 0;
   identity.formula_id = LP_REVMA_DISCOVERY_FORMULA_ID;
   identity.formula_hash = LP_RevmaDiscoveryFormulaHash();
   identity.profile_id = LP_REVMA_DISCOVERY_PROFILE_ID;
   identity.branch_id = "UNKNOWN_DISCOVERY_BRANCH";
}

struct LP_RevmaDiscoveryMesh
{
   bool valid;
   double q0;
   double broker_tick_size;
   long discovery_cell_ticks;
   double discovery_cell_price;
};

void LP_ResetRevmaDiscoveryMesh(LP_RevmaDiscoveryMesh &mesh)
{
   mesh.valid = false;
   mesh.q0 = 0.0;
   mesh.broker_tick_size = 0.0;
   mesh.discovery_cell_ticks = 0;
   mesh.discovery_cell_price = 0.0;
}

struct LP_RevmaPathGeometryState
{
   bool valid;
   long p0_ticks;
   long cell_ticks;
   double broker_tick_size;
   long previous_cell_index;
   long current_cell_index;
   long minimum_cell_index;
   long maximum_cell_index;
   long total_cell_path;
   long completed_cell_crossings;
   long matched_reversal_crossings;
   long adverse_frontier_expansions;
   long favorable_frontier_expansions;
   long new_extreme_count;
   long maximum_single_observation_cell_jump;
   int last_movement_sign;
   datetime last_observation_m1;
   datetime last_reversal_m1;
};

void LP_ResetRevmaPathGeometryState(LP_RevmaPathGeometryState &state)
{
   state.valid = false;
   state.p0_ticks = 0;
   state.cell_ticks = 0;
   state.broker_tick_size = 0.0;
   state.previous_cell_index = 0;
   state.current_cell_index = 0;
   state.minimum_cell_index = 0;
   state.maximum_cell_index = 0;
   state.total_cell_path = 0;
   state.completed_cell_crossings = 0;
   state.matched_reversal_crossings = 0;
   state.adverse_frontier_expansions = 0;
   state.favorable_frontier_expansions = 0;
   state.new_extreme_count = 0;
   state.maximum_single_observation_cell_jump = 0;
   state.last_movement_sign = 0;
   state.last_observation_m1 = 0;
   state.last_reversal_m1 = 0;
}

#endif // __LIMNI_PORTFOLIO_REVMA_DISCOVERY_TYPES_MQH__
