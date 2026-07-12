/*---------------------------------------------------------
  Gate 108 pure book/snapshot -> telemetry row materializers
---------------------------------------------------------*/
#ifndef __LIMNI_PORTFOLIO_REVMA_DISCOVERY_TELEMETRY_BRIDGE_MQH__
#define __LIMNI_PORTFOLIO_REVMA_DISCOVERY_TELEMETRY_BRIDGE_MQH__

bool LP_RevmaBridgeAgeMinutes(
   const datetime source_m1_time,
   const datetime earlier_m1_time,
   int &age_minutes)
{
   age_minutes = 0;
   if(earlier_m1_time == 0)
      return true;
   long seconds = (long)source_m1_time - (long)earlier_m1_time;
   if(source_m1_time <= 0 || seconds < 0 || seconds / 60 > 2147483647)
      return false;
   age_minutes = (int)(seconds / 60);
   return true;
}

bool LP_RevmaBridgePopulateObservation(
   LP_RevmaDiscoveryTransitionRow &row,
   const LP_RevmaCompletedM1Snapshot &snapshot,
   const int direction,
   const double p0,
   const double c0,
   const double q0,
   const double stress_price,
   const double fill_price,
   const datetime birth_m1_time,
   const datetime initial_history_boundary,
   const datetime last_positive_liquidation_opportunity_m1,
   const int time_underwater_minutes,
   const long unfilled_jump_cells,
   const LP_RevmaDiscoveryMesh &mesh,
   const LP_RevmaCenterSupportState &center,
   const LP_RevmaPathGeometryState &path)
{
   if(!row.valid || !LP_RevmaCompletedM1SnapshotValid(snapshot) ||
      (direction != LP_SIDE_LONG && direction != LP_SIDE_SHORT) ||
      p0 <= 0.0 || c0 <= 0.0 || q0 <= 0.0 || stress_price <= 0.0 ||
      fill_price <= 0.0 || birth_m1_time <= 0 ||
      initial_history_boundary <= 0 ||
      initial_history_boundary > snapshot.source_m1_time ||
      time_underwater_minutes < 0 || unfilled_jump_cells < 0 ||
      !mesh.valid || !center.valid || !path.valid ||
      mesh.broker_tick_size != center.broker_tick_size ||
      mesh.broker_tick_size != path.broker_tick_size ||
      path.last_observation_m1 != snapshot.source_m1_time ||
      center.last_observation_m1 != snapshot.source_m1_time)
      return false;

   row.source_m1_time = snapshot.source_m1_time;
   row.event_time = TimeCurrent() < snapshot.source_m1_time ?
      snapshot.source_m1_time : TimeCurrent();
   row.signal_identity_hash = snapshot.signal_identity_hash;
   row.shared_observation_snapshot_hash = snapshot.snapshot_hash;
   row.strategy_state_identity_hash =
      snapshot.strategy_state_identity_hash;
   row.q_day_count = snapshot.signal.q_days;
   row.q_event_count = snapshot.signal.q_event_count;
   row.reconstruction_epoch = snapshot.signal.reconstruction_epoch;
   row.symbol_id = snapshot.symbol_id;
   row.direction = direction;
   row.p0 = p0;
   row.stress_price = stress_price;
   row.fill_price = fill_price;
   row.current_price = snapshot.decision_price;
   row.c0 = c0;
   row.previous_center = center.previous_center_raw;
   row.current_center = center.current_center_raw;
   row.q0 = q0;
   row.current_q = snapshot.current_q;
   row.q_profile_id = LP_RevmaQProfileId(
      LP_REVMA_DISCOVERY_Q_PROFILE, LP_REVMA_DISCOVERY_MAX_M1_BARS);
   row.q_event_cadence = 1;
   row.current_q_ratio = snapshot.current_q / q0;
   row.discovery_cell_ticks = mesh.discovery_cell_ticks;
   row.discovery_cell_price = mesh.discovery_cell_price;
   row.broker_tick_size = mesh.broker_tick_size;
   row.p0_ticks = center.p0_ticks;
   row.c0_ticks = center.c0_ticks;
   row.previous_center_ticks = center.previous_center_ticks;
   row.current_center_ticks = center.current_center_ticks;
   row.birth_bucket = LP_RevmaDiscoveryBirthBucket(direction,
      row.p0_ticks, row.c0_ticks);
   row.center_alignment = center.applicable ?
      "CENTER_ALIGNED_V1" : "NOT_APPLICABLE_V1";
   row.support0_sign = center.support0_sign;
   row.previous_support_sign = center.previous_support_sign;
   row.current_support_sign = center.current_support_sign;
   row.support0_q = center.support0_q;
   row.current_support_q = center.current_support_q;
   row.revision_q = center.current_revision_q;
   row.center_applicable = center.applicable;
   row.center_latched = row.branch == LP_REVMA_BRANCH_C &&
      center.adverse_adds_frozen;
   row.center_latch_time = row.center_latched ? center.latch_m1_time : 0;
   row.center_update_count = center.center_update_count;
   row.center_observation_index = center.center_observation_count;
   row.center_not_available_count = center.center_not_available_count;
   row.first_center_update_observation_index =
      center.first_center_update_observation_index;
   row.last_center_update_observation_index =
      center.last_center_update_observation_index;
   row.first_center_update_q_event_index =
      center.first_center_update_q_event_index;
   row.last_center_update_q_event_index =
      center.last_center_update_q_event_index;
   row.first_center_update_time = center.first_center_update_m1;
   row.last_center_update_time = center.last_center_update_m1;
   row.cumulative_signed_revision_q =
      center.cumulative_signed_revision_q;
   row.cumulative_absolute_revision_q =
      center.cumulative_absolute_revision_q;
   row.minimum_support_q = center.minimum_support_q;
   row.maximum_support_q = center.maximum_support_q;
   row.regression_sum_x = center.regression_sum_x;
   row.regression_sum_y = center.regression_sum_y;
   row.regression_sum_x2 = center.regression_sum_x2;
   row.regression_sum_xy = center.regression_sum_xy;
   row.blocked_adverse_count = row.branch == LP_REVMA_BRANCH_C ?
      center.adverse_adds_blocked_after_latch : 0;
   row.previous_cell_index = path.previous_cell_index;
   row.current_cell_index = path.current_cell_index;
   row.total_cell_path = path.total_cell_path;
   row.completed_cell_crossings = path.completed_cell_crossings;
   row.unfilled_jump_cells = unfilled_jump_cells;
   row.matched_reversal_crossings = path.matched_reversal_crossings;
   row.adverse_frontier_expansions = path.adverse_frontier_expansions;
   row.favorable_frontier_expansions = path.favorable_frontier_expansions;
   row.max_cell_jump = path.maximum_single_observation_cell_jump;
   row.last_movement_sign = path.last_movement_sign;
   row.minimum_cell_index = path.minimum_cell_index;
   row.maximum_cell_index = path.maximum_cell_index;
   row.new_extreme_count = path.new_extreme_count;
   row.initial_history_boundary = initial_history_boundary;
   row.last_reversal_m1 = path.last_reversal_m1;
   row.last_positive_liquidation_opportunity_m1 =
      last_positive_liquidation_opportunity_m1;
   row.time_underwater_minutes = time_underwater_minutes;
   if(!LP_RevmaBridgeAgeMinutes(snapshot.source_m1_time,
         birth_m1_time, row.grid_age_minutes) ||
      !LP_RevmaBridgeAgeMinutes(snapshot.source_m1_time,
         path.last_reversal_m1,
         row.time_since_last_reversal_minutes) ||
      !LP_RevmaBridgeAgeMinutes(snapshot.source_m1_time,
         last_positive_liquidation_opportunity_m1,
         row.time_since_positive_liquidation_opportunity_minutes))
      return false;
   if(center.center_update_count == 0)
      row.center_staleness_minutes = row.grid_age_minutes;
   else if(!LP_RevmaBridgeAgeMinutes(snapshot.source_m1_time,
      center.last_center_update_m1, row.center_staleness_minutes))
      return false;
   return LP_RevmaDiscoveryBirthBucketValid(row.birth_bucket) &&
      LP_RevmaTelemetryCenterAlignmentValid(row.center_alignment);
}

bool LP_RevmaBridgeApplyConcurrentRisk(
   LP_RevmaDiscoverySummaryRow &row,
   const LP_RevmaConcurrentBranchRiskState &risk)
{
   if(!row.valid || !LP_RevmaConcurrentBranchRiskStateValid(risk) ||
      row.branch != risk.branch || row.current_atoms != risk.atom_count ||
      row.current_reservation_minor != risk.reservation_minor ||
      row.current_margin_minor != risk.margin_minor ||
      row.liability_minor != risk.marked_liquidation_minor ||
      row.branch_equity_minor != risk.branch_equity_minor)
      return false;
   row.current_q_cash_minor = risk.q_cash_minor;
   row.current_active_grid_count = risk.active_grid_count;
   row.current_concentration_q_cash_minor =
      risk.concentration_q_cash_minor;
   row.current_concentration_currency_id = risk.concentration_currency_id;
   row.current_liquidation_liability_minor =
      risk.liquidation_liability_minor;
   row.equity_high_water_minor = risk.equity_high_water_minor;
   row.branch_drawdown_minor = risk.branch_drawdown_minor;
   row.cycle_peak_reservation_minor =
      risk.cycle_peak_reservation_minor;
   row.cycle_peak_margin_minor = risk.cycle_peak_margin_minor;
   row.cycle_peak_q_cash_minor = risk.cycle_peak_q_cash_minor;
   row.cycle_peak_atom_count = risk.cycle_peak_atom_count;
   row.peak_active_grid_count = risk.cycle_peak_active_grid_count;
   row.peak_concentration_q_cash_minor =
      risk.cycle_peak_concentration_q_cash_minor;
   row.peak_concentration_currency_id =
      risk.cycle_peak_concentration_currency_id;
   row.peak_liquidation_liability_minor =
      risk.cycle_peak_liquidation_liability_minor;
   row.maximum_drawdown_minor = risk.cycle_maximum_drawdown_minor;
   row.cycle_risk_snapshot_count = risk.cycle_risk_snapshot_count;
   row.cycle_risk_snapshot_hash = risk.cycle_risk_snapshot_hash;
   row.cycle_candidate_built_count = risk.cycle_candidate_built_count;
   row.cycle_candidate_decision_count =
      risk.cycle_candidate_decision_count;
   row.cycle_candidate_admitted_count =
      risk.cycle_candidate_admitted_count;
   row.cycle_candidate_rejected_count =
      risk.cycle_candidate_rejected_count;
   row.cycle_inventory_transition_count =
      risk.cycle_inventory_transition_count;
   row.run_peak_reservation_minor = risk.run_peak_reservation_minor;
   row.run_peak_margin_minor = risk.run_peak_margin_minor;
   row.run_peak_q_cash_minor = risk.run_peak_q_cash_minor;
   row.run_peak_atom_count = risk.run_peak_atom_count;
   row.run_peak_active_grid_count = risk.run_peak_active_grid_count;
   row.run_peak_concentration_q_cash_minor =
      risk.run_peak_concentration_q_cash_minor;
   row.run_peak_concentration_currency_id =
      risk.run_peak_concentration_currency_id;
   row.run_peak_liquidation_liability_minor =
      risk.run_peak_liquidation_liability_minor;
   row.run_equity_high_water_minor = risk.run_equity_high_water_minor;
   row.run_maximum_drawdown_minor = risk.run_maximum_drawdown_minor;
   row.run_risk_snapshot_count = risk.run_risk_snapshot_count;
   row.run_risk_snapshot_hash = risk.run_risk_snapshot_hash;
   row.run_candidate_built_count = risk.run_candidate_built_count;
   row.run_candidate_decision_count = risk.run_candidate_decision_count;
   row.run_candidate_admitted_count = risk.run_candidate_admitted_count;
   row.run_candidate_rejected_count = risk.run_candidate_rejected_count;
   row.run_inventory_transition_count = risk.run_inventory_transition_count;
   row.terminal_risk_state_hash = row.summary_type == "run_completion" ?
      risk.state_hash : 0;
   return true;
}

#endif // __LIMNI_PORTFOLIO_REVMA_DISCOVERY_TELEMETRY_BRIDGE_MQH__
