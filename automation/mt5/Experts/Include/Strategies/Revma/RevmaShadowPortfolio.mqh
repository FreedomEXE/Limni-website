/*-----------------------------------------------
  Gate 108 aggregate broker-free U/C shadow books
-----------------------------------------------*/
#ifndef __LIMNI_PORTFOLIO_REVMA_SHADOW_PORTFOLIO_MQH__
#define __LIMNI_PORTFOLIO_REVMA_SHADOW_PORTFOLIO_MQH__

#include "RevmaDiscoveryTypes.mqh"
#include "RevmaCenterSupportPolicy.mqh"
#include "..\\..\\Core\\SymbolUniverse.mqh"

#define LP_REVMA_MINOR_ABS_LIMIT 9000000000000000000

bool LP_RevmaSafeMinorAdd(const long left, const long right, long &result)
{
   result = 0;
   if(left > LP_REVMA_MINOR_ABS_LIMIT || left < -LP_REVMA_MINOR_ABS_LIMIT ||
      right > LP_REVMA_MINOR_ABS_LIMIT || right < -LP_REVMA_MINOR_ABS_LIMIT)
      return false;
   if(right > 0 && left > LP_REVMA_MINOR_ABS_LIMIT - right)
      return false;
   if(right < 0 && left < -LP_REVMA_MINOR_ABS_LIMIT - right)
      return false;
   result = left + right;
   return result <= LP_REVMA_MINOR_ABS_LIMIT && result >= -LP_REVMA_MINOR_ABS_LIMIT;
}

bool LP_RevmaSafeMinorMultiply(const long value, const int multiplier, long &result)
{
   result = 0;
   if(value < 0 || multiplier < 0 ||
      (multiplier > 0 && value > LP_REVMA_MINOR_ABS_LIMIT / multiplier))
      return false;
   result = value * multiplier;
   return result >= 0 && result <= LP_REVMA_MINOR_ABS_LIMIT;
}

bool LP_RevmaMoneyToConservativeMinor(const double money, const double money_quantum, long &minor)
{
   minor = 0;
   if(!MathIsValidNumber(money) || !MathIsValidNumber(money_quantum) || money_quantum <= 0.0)
      return false;
   double scaled = money / money_quantum;
   if(!MathIsValidNumber(scaled) || MathAbs(scaled) > (double)LP_REVMA_MINOR_ABS_LIMIT)
      return false;
   // Floor is conservative for a signed net ledger: it never improves PnL.
   minor = (long)MathFloor(scaled);
   return minor <= LP_REVMA_MINOR_ABS_LIMIT && minor >= -LP_REVMA_MINOR_ABS_LIMIT;
}

bool LP_RevmaMoneyToReferenceMinor(const double money, const double money_quantum,
   long &minor)
{
   minor = 0;
   if(!MathIsValidNumber(money) || !MathIsValidNumber(money_quantum) ||
      money <= 0.0 || money_quantum <= 0.0)
      return false;
   double scaled = money / money_quantum;
   if(!MathIsValidNumber(scaled) || scaled > (double)LP_REVMA_MINOR_ABS_LIMIT)
      return false;
   minor = (long)MathCeil(scaled);
   return minor > 0 && minor <= LP_REVMA_MINOR_ABS_LIMIT;
}

int LP_RevmaShadowIndex(const int branch)
{
   if(branch == LP_REVMA_BRANCH_U)
      return 0;
   if(branch == LP_REVMA_BRANCH_C)
      return 1;
   return -1;
}

struct LP_RevmaShadowGrid
{
   bool valid;
   bool active;
   bool flat;
   int branch;
   int symbol_id;
   int direction;
   ulong branch_grid_id;
   ulong branch_cycle_id;
   long grid_generation;
   ulong shared_origin_id;
   ulong birth_pre_candidate_state_hash;
   ulong birth_matched_snapshot_hash;
   ulong birth_shared_observation_snapshot_hash;
   ulong formula_hash;
   ulong strategy_identity_hash;
   ulong strategy_state_identity_hash;
   datetime birth_m1_time;
   datetime initial_history_boundary;
   datetime last_admission_m1_time;
   ulong last_admission_identity;
   int atom_count;
   int peak_atom_count;
   int adverse_add_count;
   int favorable_add_count;
   bool excursion_completed;
   double total_lots;
   double weighted_entry_price_lots;
   double average_entry_price;
   double minimum_entry_price;
   double maximum_entry_price;
   double birth_p0;
   double birth_stress_price;
   double birth_c0;
   double birth_broker_tick_size;
   long birth_p0_ticks;
   long birth_c0_ticks;
   string birth_bucket;
   string birth_center_alignment;
   double q0;
   long q_cash_minor;
   long peak_q_cash_minor;
   long a_g_candidate_minor;
   long a_g_minor;
   long candidate_reservation_minor;
   long reservation_minor;
   long peak_reservation_minor;
   bool reservation_overrun;
   long reservation_overrun_minor;
   bool reservation_overrun_observed;
   long peak_reservation_overrun_minor;
   long margin_minor;
   long peak_margin_minor;
   long realized_harvest_minor;
   long realized_nonharvest_minor;
   long marked_liquidation_minor;
   long maximum_adverse_excursion_minor;
   int time_underwater_minutes;
   long estimated_close_cost_minor;
   long realized_close_cost_minor;
   int close_owner;
   string terminal_reason;
   datetime close_trigger_m1_time;
   datetime last_mark_m1_time;
   datetime last_local_harvest_evaluation_m1_time;
   datetime last_positive_liquidation_opportunity_m1;
   datetime last_flat_m1_time;
   ulong terminal_event_hash;
   ulong terminal_projection_hash;
   ulong terminal_internal_state_hash;
   datetime terminal_evidence_m1_time;
   bool reentry_requires_identity_transition;
   ulong reentry_identity_at_close;
   ulong reentry_last_observed_identity;
   datetime reentry_last_identity_observation_m1;
   datetime reentry_transition_m1;
   LP_RevmaCenterSupportState center_support;
   LP_RevmaDiscoveryMesh discovery_mesh;
   LP_RevmaPathGeometryState path_geometry;
};

void LP_ResetRevmaShadowGrid(LP_RevmaShadowGrid &grid, const int branch, const int symbol_id)
{
   grid.valid = true;
   grid.active = false;
   grid.flat = true;
   grid.branch = branch;
   grid.symbol_id = symbol_id;
   grid.direction = LP_SIDE_NONE;
   grid.branch_grid_id = 0;
   grid.branch_cycle_id = 0;
   grid.grid_generation = 0;
   grid.shared_origin_id = 0;
   grid.birth_pre_candidate_state_hash = 0;
   grid.birth_matched_snapshot_hash = 0;
   grid.birth_shared_observation_snapshot_hash = 0;
   grid.formula_hash = LP_RevmaDiscoveryFormulaHash();
   grid.strategy_identity_hash = 0;
   grid.strategy_state_identity_hash = 0;
   grid.birth_m1_time = 0;
   grid.initial_history_boundary = 0;
   grid.last_admission_m1_time = 0;
   grid.last_admission_identity = 0;
   grid.atom_count = 0;
   grid.peak_atom_count = 0;
   grid.adverse_add_count = 0;
   grid.favorable_add_count = 0;
   grid.excursion_completed = false;
   grid.total_lots = 0.0;
   grid.weighted_entry_price_lots = 0.0;
   grid.average_entry_price = 0.0;
   grid.minimum_entry_price = 0.0;
   grid.maximum_entry_price = 0.0;
   grid.birth_p0 = 0.0;
   grid.birth_stress_price = 0.0;
   grid.birth_c0 = 0.0;
   grid.birth_broker_tick_size = 0.0;
   grid.birth_p0_ticks = 0;
   grid.birth_c0_ticks = 0;
   grid.birth_bucket = "";
   grid.birth_center_alignment = "";
   grid.q0 = 0.0;
   grid.q_cash_minor = 0;
   grid.peak_q_cash_minor = 0;
   grid.a_g_candidate_minor = 0;
   grid.a_g_minor = 0;
   grid.candidate_reservation_minor = 0;
   grid.reservation_minor = 0;
   grid.peak_reservation_minor = 0;
   grid.reservation_overrun = false;
   grid.reservation_overrun_minor = 0;
   grid.reservation_overrun_observed = false;
   grid.peak_reservation_overrun_minor = 0;
   grid.margin_minor = 0;
   grid.peak_margin_minor = 0;
   grid.realized_harvest_minor = 0;
   grid.realized_nonharvest_minor = 0;
   grid.marked_liquidation_minor = 0;
   grid.maximum_adverse_excursion_minor = 0;
   grid.time_underwater_minutes = 0;
   grid.estimated_close_cost_minor = 0;
   grid.realized_close_cost_minor = 0;
   grid.close_owner = LP_REVMA_DISCOVERY_CLOSE_NONE;
   grid.terminal_reason = "";
   grid.close_trigger_m1_time = 0;
   grid.last_mark_m1_time = 0;
   grid.last_local_harvest_evaluation_m1_time = 0;
   grid.last_positive_liquidation_opportunity_m1 = 0;
   grid.last_flat_m1_time = 0;
   grid.terminal_event_hash = 0;
   grid.terminal_projection_hash = 0;
   grid.terminal_internal_state_hash = 0;
   grid.terminal_evidence_m1_time = 0;
   grid.reentry_requires_identity_transition = false;
   grid.reentry_identity_at_close = 0;
   grid.reentry_last_observed_identity = 0;
   grid.reentry_last_identity_observation_m1 = 0;
   grid.reentry_transition_m1 = 0;
   LP_ResetRevmaCenterSupportState(grid.center_support);
   LP_ResetRevmaDiscoveryMesh(grid.discovery_mesh);
   LP_ResetRevmaPathGeometryState(grid.path_geometry);
}

struct LP_RevmaShadowPortfolioState
{
   bool valid;
   bool initialized;
   bool batch_open;
   bool allocation_complete;
   bool transitions_committed;
   int branch;
   ulong cycle_id;
   datetime batch_m1_time;
   double money_quantum;
   long equity_reference_minor;
   long capital_budget_minor;
   long realized_harvest_minor;
   long realized_nonharvest_minor;
   long realized_cleanup_minor;
   long realized_hard_risk_minor;
   int local_harvest_close_count;
   int cleanup_close_count;
   int hard_risk_close_count;
   long marked_liquidation_minor;
   long estimated_close_cost_minor;
   long realized_close_cost_minor;
   long reservation_minor;
   bool reservation_overrun;
   long reservation_overrun_minor;
   bool capacity_overrun;
   long capacity_overrun_minor;
   long margin_minor;
   long peak_margin_minor;
   long q_cash_minor;
   int atom_count;
   int active_grid_count;
   long currency_q_cash_minor[LP_CCY_COUNT];
   long concentration_q_cash_minor;
   int concentration_currency_id;
   long liquidation_liability_minor;
   long equity_high_water_minor;
   long branch_drawdown_minor;
   long peak_reservation_minor;
   long peak_q_cash_minor;
   int peak_atom_count;
   int peak_active_grid_count;
   long peak_concentration_q_cash_minor;
   int peak_concentration_currency_id;
   long peak_liquidation_liability_minor;
   long maximum_branch_drawdown_minor;
   long run_peak_reservation_minor;
   long run_peak_margin_minor;
   long run_peak_q_cash_minor;
   int run_peak_atom_count;
   int run_peak_active_grid_count;
   long run_peak_concentration_q_cash_minor;
   int run_peak_concentration_currency_id;
   long run_peak_liquidation_liability_minor;
   long run_equity_high_water_minor;
   long run_maximum_branch_drawdown_minor;
   ulong cycle_risk_snapshot_count;
   ulong cycle_risk_snapshot_hash;
   ulong run_risk_snapshot_count;
   ulong run_risk_snapshot_hash;
   datetime last_risk_snapshot_m1_time;
   ulong cycle_candidate_built_count;
   ulong cycle_candidate_decision_count;
   ulong cycle_candidate_admitted_count;
   ulong cycle_candidate_rejected_count;
   ulong cycle_inventory_transition_count;
   ulong run_candidate_built_count;
   ulong run_candidate_decision_count;
   ulong run_candidate_admitted_count;
   ulong run_candidate_rejected_count;
   ulong run_inventory_transition_count;
   string first_infeasibility;
   string latest_infeasibility;
   datetime first_infeasibility_m1_time;
   datetime latest_infeasibility_m1_time;
   long branch_equity_minor;
   int close_owner;
   bool cleanup_shortfall;
   bool hard_risk_latched;
   bool cycle_reset_required;
   datetime cycle_flat_m1_time;
   datetime last_close_authority_evaluation_m1_time;
   ulong batch_hash;
   string invalid_reason;
};

void LP_ResetRevmaShadowPortfolioState(LP_RevmaShadowPortfolioState &portfolio, const int branch)
{
   portfolio.valid = false;
   portfolio.initialized = false;
   portfolio.batch_open = false;
   portfolio.allocation_complete = false;
   portfolio.transitions_committed = false;
   portfolio.branch = branch;
   portfolio.cycle_id = 0;
   portfolio.batch_m1_time = 0;
   portfolio.money_quantum = 0.0;
   portfolio.equity_reference_minor = 0;
   portfolio.capital_budget_minor = 0;
   portfolio.realized_harvest_minor = 0;
   portfolio.realized_nonharvest_minor = 0;
   portfolio.realized_cleanup_minor = 0;
   portfolio.realized_hard_risk_minor = 0;
   portfolio.local_harvest_close_count = 0;
   portfolio.cleanup_close_count = 0;
   portfolio.hard_risk_close_count = 0;
   portfolio.marked_liquidation_minor = 0;
   portfolio.estimated_close_cost_minor = 0;
   portfolio.realized_close_cost_minor = 0;
   portfolio.reservation_minor = 0;
   portfolio.reservation_overrun = false;
   portfolio.reservation_overrun_minor = 0;
   portfolio.capacity_overrun = false;
   portfolio.capacity_overrun_minor = 0;
   portfolio.margin_minor = 0;
   portfolio.peak_margin_minor = 0;
   portfolio.q_cash_minor = 0;
   portfolio.atom_count = 0;
   portfolio.active_grid_count = 0;
   for(int ccy = 0; ccy < LP_CCY_COUNT; ccy++)
      portfolio.currency_q_cash_minor[ccy] = 0;
   portfolio.concentration_q_cash_minor = 0;
   portfolio.concentration_currency_id = -1;
   portfolio.liquidation_liability_minor = 0;
   portfolio.equity_high_water_minor = 0;
   portfolio.branch_drawdown_minor = 0;
   portfolio.peak_reservation_minor = 0;
   portfolio.peak_q_cash_minor = 0;
   portfolio.peak_atom_count = 0;
   portfolio.peak_active_grid_count = 0;
   portfolio.peak_concentration_q_cash_minor = 0;
   portfolio.peak_concentration_currency_id = -1;
   portfolio.peak_liquidation_liability_minor = 0;
   portfolio.maximum_branch_drawdown_minor = 0;
   portfolio.run_peak_reservation_minor = 0;
   portfolio.run_peak_margin_minor = 0;
   portfolio.run_peak_q_cash_minor = 0;
   portfolio.run_peak_atom_count = 0;
   portfolio.run_peak_active_grid_count = 0;
   portfolio.run_peak_concentration_q_cash_minor = 0;
   portfolio.run_peak_concentration_currency_id = -1;
   portfolio.run_peak_liquidation_liability_minor = 0;
   portfolio.run_equity_high_water_minor = 0;
   portfolio.run_maximum_branch_drawdown_minor = 0;
   portfolio.cycle_risk_snapshot_count = 0;
   portfolio.cycle_risk_snapshot_hash = LP_RevmaDiscoveryFormulaHash();
   portfolio.run_risk_snapshot_count = 0;
   portfolio.run_risk_snapshot_hash = LP_RevmaDiscoveryFormulaHash();
   portfolio.last_risk_snapshot_m1_time = 0;
   portfolio.cycle_candidate_built_count = 0;
   portfolio.cycle_candidate_decision_count = 0;
   portfolio.cycle_candidate_admitted_count = 0;
   portfolio.cycle_candidate_rejected_count = 0;
   portfolio.cycle_inventory_transition_count = 0;
   portfolio.run_candidate_built_count = 0;
   portfolio.run_candidate_decision_count = 0;
   portfolio.run_candidate_admitted_count = 0;
   portfolio.run_candidate_rejected_count = 0;
   portfolio.run_inventory_transition_count = 0;
   portfolio.first_infeasibility = "";
   portfolio.latest_infeasibility = "";
   portfolio.first_infeasibility_m1_time = 0;
   portfolio.latest_infeasibility_m1_time = 0;
   portfolio.branch_equity_minor = 0;
   portfolio.close_owner = LP_REVMA_DISCOVERY_CLOSE_NONE;
   portfolio.cleanup_shortfall = false;
   portfolio.hard_risk_latched = false;
   portfolio.cycle_reset_required = false;
   portfolio.cycle_flat_m1_time = 0;
   portfolio.last_close_authority_evaluation_m1_time = 0;
   portfolio.batch_hash = 0;
   portfolio.invalid_reason = "not_initialized";
}

struct LP_RevmaShadowCandidate
{
   bool valid;
   bool birth;
   bool allocated;
   bool committed;
   int decision;
   string decision_reason;
   int branch;
   int symbol_id;
   int direction;
   ulong branch_grid_id;
   long grid_generation;
   ulong candidate_identity;
   datetime source_m1_time;
   double decision_price;
   double stress_price;
   double fill_price;
   double q0;
   int q_event_count;
   double lots;
   long incremental_reservation_minor;
   long committed_reservation_delta_minor;
   long incremental_q_cash_minor;
   long a_g_candidate_minor;
   long a_g_minor;
   long incremental_margin_minor;
   long incremental_liquidation_minor;
   long incremental_close_cost_minor;
   long concentration_q_cash_minor;
   int concentration_currency_id;
   int candidate_type;
   ulong shared_origin_id;
   ulong opportunity_id;
   ulong matched_snapshot_hash;
   ulong shared_observation_snapshot_hash;
   ulong pre_candidate_state_hash;
   ulong strategy_identity_hash;
   ulong strategy_state_identity_hash;
   double p0;
   double c0;
   double broker_tick_size;
   datetime initial_history_boundary;
   bool center_policy_checked;
   bool center_policy_applies;
   bool center_add_authorized;
   string center_policy_reason;
   LP_RevmaCenterSupportState center_support_snapshot;
};

void LP_ResetRevmaShadowCandidate(LP_RevmaShadowCandidate &candidate)
{
   candidate.valid = false;
   candidate.birth = false;
   candidate.allocated = false;
   candidate.committed = false;
   candidate.decision = LP_REVMA_DISCOVERY_DECISION_NONE;
   candidate.decision_reason = "not_evaluated";
   candidate.branch = -1;
   candidate.symbol_id = -1;
   candidate.direction = LP_SIDE_NONE;
   candidate.branch_grid_id = 0;
   candidate.grid_generation = 0;
   candidate.candidate_identity = 0;
   candidate.source_m1_time = 0;
   candidate.decision_price = 0.0;
   candidate.stress_price = 0.0;
   candidate.fill_price = 0.0;
   candidate.q0 = 0.0;
   candidate.q_event_count = 0;
   candidate.lots = 0.0;
   candidate.incremental_reservation_minor = 0;
   candidate.committed_reservation_delta_minor = 0;
   candidate.incremental_q_cash_minor = 0;
   candidate.a_g_candidate_minor = 0;
   candidate.a_g_minor = 0;
   candidate.incremental_margin_minor = 0;
   candidate.incremental_liquidation_minor = 0;
   candidate.incremental_close_cost_minor = 0;
   candidate.concentration_q_cash_minor = 0;
   candidate.concentration_currency_id = -1;
   candidate.candidate_type = LP_REVMA_DISCOVERY_CANDIDATE_NONE;
   candidate.shared_origin_id = 0;
   candidate.opportunity_id = 0;
   candidate.matched_snapshot_hash = 0;
   candidate.shared_observation_snapshot_hash = 0;
   candidate.pre_candidate_state_hash = 0;
   candidate.strategy_identity_hash = 0;
   candidate.strategy_state_identity_hash = 0;
   candidate.p0 = 0.0;
   candidate.c0 = 0.0;
   candidate.broker_tick_size = 0.0;
   candidate.initial_history_boundary = 0;
   candidate.center_policy_checked = false;
   candidate.center_policy_applies = false;
   candidate.center_add_authorized = false;
   candidate.center_policy_reason = "CENTER_POLICY_NOT_CHECKED";
   LP_ResetRevmaCenterSupportState(candidate.center_support_snapshot);
}

class LP_RevmaShadowPortfolio
{
private:
   LP_RevmaShadowGrid m_grids[LP_REVMA_SHADOW_BRANCH_COUNT][LP_SYMBOL_COUNT];
   LP_RevmaShadowPortfolioState m_portfolios[LP_REVMA_SHADOW_BRANCH_COUNT];
   LP_RevmaShadowCandidate m_candidates[LP_REVMA_SHADOW_BRANCH_COUNT][LP_SYMBOL_COUNT];
   int m_candidate_count[LP_REVMA_SHADOW_BRANCH_COUNT];
   long m_grid_generation[LP_REVMA_SHADOW_BRANCH_COUNT][LP_SYMBOL_COUNT];
   bool m_matched_initialization_complete;
   bool m_branch_opportunities_validated[LP_REVMA_SHADOW_BRANCH_COUNT];
   bool m_causal_matching_open;
   bool m_matched_mutation_scope;
   datetime m_first_causal_divergence_m1;
   ulong m_first_causal_divergence_opportunity_id;

   void Invalidate(const int shadow_index, const string reason)
   {
      if(shadow_index < 0 || shadow_index >= LP_REVMA_SHADOW_BRANCH_COUNT)
         return;
      m_portfolios[shadow_index].valid = false;
      m_portfolios[shadow_index].batch_open = false;
      m_portfolios[shadow_index].allocation_complete = false;
      m_portfolios[shadow_index].transitions_committed = false;
      if(m_portfolios[shadow_index].invalid_reason == "" ||
         m_portfolios[shadow_index].invalid_reason == "not_initialized")
         m_portfolios[shadow_index].invalid_reason = reason;
   }

   void InvalidateMatchedBranches(const string reason)
   {
      Invalidate(0, reason);
      Invalidate(1, reason);
      m_matched_mutation_scope = false;
   }

   bool BranchNeutralPortfolioEqual()
   {
      LP_RevmaShadowPortfolioState u = m_portfolios[0];
      LP_RevmaShadowPortfolioState c = m_portfolios[1];
      for(int ccy = 0; ccy < LP_CCY_COUNT; ccy++)
      {
         if(u.currency_q_cash_minor[ccy] !=
            c.currency_q_cash_minor[ccy])
            return false;
      }
      return u.valid == c.valid && u.initialized == c.initialized &&
         u.batch_open == c.batch_open &&
         u.allocation_complete == c.allocation_complete &&
         u.transitions_committed == c.transitions_committed &&
         u.cycle_id == c.cycle_id && u.batch_m1_time == c.batch_m1_time &&
         u.money_quantum == c.money_quantum &&
         u.equity_reference_minor == c.equity_reference_minor &&
         u.capital_budget_minor == c.capital_budget_minor &&
         u.realized_harvest_minor == c.realized_harvest_minor &&
         u.realized_nonharvest_minor == c.realized_nonharvest_minor &&
         u.realized_cleanup_minor == c.realized_cleanup_minor &&
         u.realized_hard_risk_minor == c.realized_hard_risk_minor &&
         u.local_harvest_close_count == c.local_harvest_close_count &&
         u.cleanup_close_count == c.cleanup_close_count &&
         u.hard_risk_close_count == c.hard_risk_close_count &&
         u.marked_liquidation_minor == c.marked_liquidation_minor &&
         u.estimated_close_cost_minor == c.estimated_close_cost_minor &&
         u.realized_close_cost_minor == c.realized_close_cost_minor &&
         u.reservation_minor == c.reservation_minor &&
         u.reservation_overrun == c.reservation_overrun &&
         u.reservation_overrun_minor == c.reservation_overrun_minor &&
         u.capacity_overrun == c.capacity_overrun &&
         u.capacity_overrun_minor == c.capacity_overrun_minor &&
         u.margin_minor == c.margin_minor &&
         u.peak_margin_minor == c.peak_margin_minor &&
         u.q_cash_minor == c.q_cash_minor &&
         u.atom_count == c.atom_count &&
         u.active_grid_count == c.active_grid_count &&
         u.concentration_q_cash_minor ==
            c.concentration_q_cash_minor &&
         u.concentration_currency_id == c.concentration_currency_id &&
         u.liquidation_liability_minor ==
            c.liquidation_liability_minor &&
         u.equity_high_water_minor == c.equity_high_water_minor &&
         u.branch_drawdown_minor == c.branch_drawdown_minor &&
         u.peak_reservation_minor == c.peak_reservation_minor &&
         u.peak_q_cash_minor == c.peak_q_cash_minor &&
         u.peak_atom_count == c.peak_atom_count &&
         u.peak_active_grid_count == c.peak_active_grid_count &&
         u.peak_concentration_q_cash_minor ==
            c.peak_concentration_q_cash_minor &&
         u.peak_concentration_currency_id ==
            c.peak_concentration_currency_id &&
         u.peak_liquidation_liability_minor ==
            c.peak_liquidation_liability_minor &&
         u.maximum_branch_drawdown_minor ==
            c.maximum_branch_drawdown_minor &&
         u.run_peak_reservation_minor == c.run_peak_reservation_minor &&
         u.run_peak_margin_minor == c.run_peak_margin_minor &&
         u.run_peak_q_cash_minor == c.run_peak_q_cash_minor &&
         u.run_peak_atom_count == c.run_peak_atom_count &&
         u.run_peak_active_grid_count == c.run_peak_active_grid_count &&
         u.run_peak_concentration_q_cash_minor ==
            c.run_peak_concentration_q_cash_minor &&
         u.run_peak_concentration_currency_id ==
            c.run_peak_concentration_currency_id &&
         u.run_peak_liquidation_liability_minor ==
            c.run_peak_liquidation_liability_minor &&
         u.run_equity_high_water_minor == c.run_equity_high_water_minor &&
         u.run_maximum_branch_drawdown_minor ==
            c.run_maximum_branch_drawdown_minor &&
         u.cycle_risk_snapshot_count == c.cycle_risk_snapshot_count &&
         u.cycle_risk_snapshot_hash == c.cycle_risk_snapshot_hash &&
         u.run_risk_snapshot_count == c.run_risk_snapshot_count &&
         u.run_risk_snapshot_hash == c.run_risk_snapshot_hash &&
         u.last_risk_snapshot_m1_time == c.last_risk_snapshot_m1_time &&
         u.cycle_candidate_built_count ==
            c.cycle_candidate_built_count &&
         u.cycle_candidate_decision_count ==
            c.cycle_candidate_decision_count &&
         u.cycle_candidate_admitted_count ==
            c.cycle_candidate_admitted_count &&
         u.cycle_candidate_rejected_count ==
            c.cycle_candidate_rejected_count &&
         u.cycle_inventory_transition_count ==
            c.cycle_inventory_transition_count &&
         u.run_candidate_built_count == c.run_candidate_built_count &&
         u.run_candidate_decision_count ==
            c.run_candidate_decision_count &&
         u.run_candidate_admitted_count ==
            c.run_candidate_admitted_count &&
         u.run_candidate_rejected_count ==
            c.run_candidate_rejected_count &&
         u.run_inventory_transition_count ==
            c.run_inventory_transition_count &&
         u.first_infeasibility == c.first_infeasibility &&
         u.latest_infeasibility == c.latest_infeasibility &&
         u.first_infeasibility_m1_time == c.first_infeasibility_m1_time &&
         u.latest_infeasibility_m1_time == c.latest_infeasibility_m1_time &&
         u.branch_equity_minor == c.branch_equity_minor &&
         u.close_owner == c.close_owner &&
         u.cleanup_shortfall == c.cleanup_shortfall &&
         u.hard_risk_latched == c.hard_risk_latched &&
         u.cycle_reset_required == c.cycle_reset_required &&
         u.cycle_flat_m1_time == c.cycle_flat_m1_time &&
         u.last_close_authority_evaluation_m1_time ==
            c.last_close_authority_evaluation_m1_time &&
         u.invalid_reason == c.invalid_reason;
   }

   bool BranchNeutralGridEqual(const int symbol_id)
   {
      if(symbol_id < 0 || symbol_id >= LP_SYMBOL_COUNT)
         return false;
      LP_RevmaShadowGrid u = m_grids[0][symbol_id];
      LP_RevmaShadowGrid c = m_grids[1][symbol_id];
      return u.valid == c.valid && u.active == c.active && u.flat == c.flat &&
         u.symbol_id == c.symbol_id && u.direction == c.direction &&
         u.branch_cycle_id == c.branch_cycle_id &&
         u.grid_generation == c.grid_generation &&
         u.shared_origin_id == c.shared_origin_id &&
         u.birth_pre_candidate_state_hash == c.birth_pre_candidate_state_hash &&
         u.birth_matched_snapshot_hash == c.birth_matched_snapshot_hash &&
         u.birth_shared_observation_snapshot_hash ==
            c.birth_shared_observation_snapshot_hash &&
         u.formula_hash == c.formula_hash &&
         u.strategy_identity_hash == c.strategy_identity_hash &&
         u.strategy_state_identity_hash ==
            c.strategy_state_identity_hash &&
         u.birth_m1_time == c.birth_m1_time &&
         u.last_admission_m1_time == c.last_admission_m1_time &&
         u.atom_count == c.atom_count &&
         u.peak_atom_count == c.peak_atom_count &&
         u.adverse_add_count == c.adverse_add_count &&
         u.favorable_add_count == c.favorable_add_count &&
         u.excursion_completed == c.excursion_completed &&
         u.total_lots == c.total_lots &&
         u.weighted_entry_price_lots == c.weighted_entry_price_lots &&
         u.average_entry_price == c.average_entry_price &&
         u.minimum_entry_price == c.minimum_entry_price &&
         u.maximum_entry_price == c.maximum_entry_price &&
         u.birth_p0 == c.birth_p0 &&
         u.birth_stress_price == c.birth_stress_price &&
         u.birth_c0 == c.birth_c0 &&
         u.birth_broker_tick_size == c.birth_broker_tick_size &&
         u.birth_p0_ticks == c.birth_p0_ticks &&
         u.birth_c0_ticks == c.birth_c0_ticks &&
         u.birth_bucket == c.birth_bucket &&
         u.birth_center_alignment == c.birth_center_alignment &&
         u.q0 == c.q0 && u.q_cash_minor == c.q_cash_minor &&
         u.peak_q_cash_minor == c.peak_q_cash_minor &&
         u.a_g_candidate_minor == c.a_g_candidate_minor &&
         u.a_g_minor == c.a_g_minor &&
          u.candidate_reservation_minor == c.candidate_reservation_minor &&
          u.reservation_minor == c.reservation_minor &&
          u.peak_reservation_minor == c.peak_reservation_minor &&
         u.reservation_overrun == c.reservation_overrun &&
         u.reservation_overrun_minor == c.reservation_overrun_minor &&
         u.reservation_overrun_observed == c.reservation_overrun_observed &&
         u.peak_reservation_overrun_minor ==
            c.peak_reservation_overrun_minor &&
         u.margin_minor == c.margin_minor &&
         u.peak_margin_minor == c.peak_margin_minor &&
         u.realized_harvest_minor == c.realized_harvest_minor &&
         u.realized_nonharvest_minor == c.realized_nonharvest_minor &&
          u.marked_liquidation_minor == c.marked_liquidation_minor &&
          u.maximum_adverse_excursion_minor ==
             c.maximum_adverse_excursion_minor &&
          u.time_underwater_minutes == c.time_underwater_minutes &&
         u.estimated_close_cost_minor == c.estimated_close_cost_minor &&
         u.realized_close_cost_minor == c.realized_close_cost_minor &&
         u.close_owner == c.close_owner &&
         u.terminal_reason == c.terminal_reason &&
         u.close_trigger_m1_time == c.close_trigger_m1_time &&
         u.last_mark_m1_time == c.last_mark_m1_time &&
         u.last_local_harvest_evaluation_m1_time ==
            c.last_local_harvest_evaluation_m1_time &&
         u.last_flat_m1_time == c.last_flat_m1_time &&
          ((u.terminal_event_hash != 0) ==
             (c.terminal_event_hash != 0)) &&
          ((u.terminal_projection_hash != 0) ==
             (c.terminal_projection_hash != 0)) &&
          ((u.terminal_internal_state_hash != 0) ==
             (c.terminal_internal_state_hash != 0)) &&
          u.terminal_evidence_m1_time == c.terminal_evidence_m1_time &&
         u.reentry_requires_identity_transition ==
            c.reentry_requires_identity_transition &&
         u.reentry_identity_at_close == c.reentry_identity_at_close &&
         u.reentry_last_observed_identity ==
            c.reentry_last_observed_identity &&
         u.reentry_last_identity_observation_m1 ==
            c.reentry_last_identity_observation_m1 &&
         u.reentry_transition_m1 == c.reentry_transition_m1 &&
         u.discovery_mesh.valid == c.discovery_mesh.valid &&
         u.discovery_mesh.q0 == c.discovery_mesh.q0 &&
         u.discovery_mesh.broker_tick_size ==
            c.discovery_mesh.broker_tick_size &&
         u.discovery_mesh.discovery_cell_ticks ==
            c.discovery_mesh.discovery_cell_ticks &&
         u.discovery_mesh.discovery_cell_price ==
            c.discovery_mesh.discovery_cell_price &&
         u.path_geometry.valid == c.path_geometry.valid &&
         u.path_geometry.p0_ticks == c.path_geometry.p0_ticks &&
         u.path_geometry.cell_ticks == c.path_geometry.cell_ticks &&
         u.path_geometry.broker_tick_size ==
            c.path_geometry.broker_tick_size &&
         u.path_geometry.previous_cell_index ==
            c.path_geometry.previous_cell_index &&
         u.path_geometry.current_cell_index ==
            c.path_geometry.current_cell_index &&
         u.path_geometry.minimum_cell_index ==
            c.path_geometry.minimum_cell_index &&
         u.path_geometry.maximum_cell_index ==
            c.path_geometry.maximum_cell_index &&
         u.path_geometry.total_cell_path == c.path_geometry.total_cell_path &&
         u.path_geometry.completed_cell_crossings ==
            c.path_geometry.completed_cell_crossings &&
         u.path_geometry.matched_reversal_crossings ==
            c.path_geometry.matched_reversal_crossings &&
         u.path_geometry.adverse_frontier_expansions ==
            c.path_geometry.adverse_frontier_expansions &&
         u.path_geometry.favorable_frontier_expansions ==
            c.path_geometry.favorable_frontier_expansions &&
         u.path_geometry.new_extreme_count ==
            c.path_geometry.new_extreme_count &&
         u.path_geometry.maximum_single_observation_cell_jump ==
            c.path_geometry.maximum_single_observation_cell_jump &&
         u.path_geometry.last_movement_sign ==
            c.path_geometry.last_movement_sign &&
         u.path_geometry.last_observation_m1 ==
            c.path_geometry.last_observation_m1 &&
         u.path_geometry.last_reversal_m1 == c.path_geometry.last_reversal_m1;
   }

   bool FullPreDivergenceParity()
   {
      if(!BranchNeutralPortfolioEqual())
         return false;
      for(int symbol_id = 0; symbol_id < LP_SYMBOL_COUNT; symbol_id++)
      {
         if(!BranchNeutralGridEqual(symbol_id))
            return false;
      }
      return true;
   }

   bool BeginMatchedMutationScope()
   {
      if(!m_causal_matching_open || m_matched_mutation_scope)
      {
         InvalidateMatchedBranches("matched_mutation_scope_begin_invalid");
         return false;
      }
      m_matched_mutation_scope = true;
      return true;
   }

   bool EndMatchedMutationScope(
      const bool operation_ok,
      const int symbol_id,
      const bool full_branch_check)
   {
      if(!m_matched_mutation_scope)
      {
         InvalidateMatchedBranches("matched_mutation_scope_end_missing");
         return false;
      }
      m_matched_mutation_scope = false;
      bool parity_ok = full_branch_check ? FullPreDivergenceParity() :
         (BranchNeutralPortfolioEqual() && BranchNeutralGridEqual(symbol_id));
      if(!operation_ok || !parity_ok)
      {
         InvalidateMatchedBranches("unauthorized_pre_divergence_state_mismatch");
         return false;
      }
      return true;
   }

   bool IndividualMutationAuthorized()
   {
      if(!m_causal_matching_open || m_matched_mutation_scope)
         return true;
      InvalidateMatchedBranches("pre_divergence_mutation_requires_matched_wrapper");
      return false;
   }

   bool ReconcileEquity(const int shadow_index)
   {
      long attributed_nonharvest = 0;
      long realized_total = 0;
      long equity_before_mark = 0;
      long equity = 0;
      if(!LP_RevmaSafeMinorAdd(m_portfolios[shadow_index].realized_cleanup_minor,
         m_portfolios[shadow_index].realized_hard_risk_minor,
         attributed_nonharvest) ||
         attributed_nonharvest !=
            m_portfolios[shadow_index].realized_nonharvest_minor ||
         !LP_RevmaSafeMinorAdd(m_portfolios[shadow_index].realized_harvest_minor,
         m_portfolios[shadow_index].realized_nonharvest_minor, realized_total) ||
         !LP_RevmaSafeMinorAdd(m_portfolios[shadow_index].equity_reference_minor,
         realized_total, equity_before_mark) ||
         !LP_RevmaSafeMinorAdd(equity_before_mark,
         m_portfolios[shadow_index].marked_liquidation_minor, equity))
      {
         Invalidate(shadow_index, "branch_equity_arithmetic_overflow");
         return false;
      }
      m_portfolios[shadow_index].branch_equity_minor = equity;
      if(equity < 0)
      {
         Invalidate(shadow_index, "branch_equity_negative");
         return false;
      }
      return true;
   }

   bool ReconcileReservation(const int shadow_index)
   {
      long grid_total = 0;
      long overrun_total = 0;
      for(int symbol_id = 0; symbol_id < LP_SYMBOL_COUNT; symbol_id++)
      {
         LP_RevmaShadowGrid grid = m_grids[shadow_index][symbol_id];
         long expected_candidate_reservation = 0;
         long expected_committed_reservation = 0;
         if(grid.branch_grid_id != 0)
         {
            int reservation_atoms = grid.peak_atom_count < 2 ?
               2 : grid.peak_atom_count;
            if(grid.a_g_candidate_minor <= 0 || grid.a_g_minor <= 0 ||
               !LP_RevmaSafeMinorMultiply(grid.a_g_candidate_minor,
                  reservation_atoms, expected_candidate_reservation) ||
               !LP_RevmaSafeMinorMultiply(grid.a_g_minor,
                  reservation_atoms, expected_committed_reservation) ||
               grid.peak_reservation_minor !=
                  expected_committed_reservation ||
               (grid.active &&
                (grid.candidate_reservation_minor !=
                    expected_candidate_reservation ||
                 grid.reservation_minor !=
                    expected_committed_reservation)))
            {
               Invalidate(shadow_index,
                  "grid_frozen_Ag_reservation_formula_mismatch");
               return false;
            }
         }
         long grid_overrun = grid.reservation_minor > grid.candidate_reservation_minor ?
            grid.reservation_minor - grid.candidate_reservation_minor : 0;
         if(!LP_RevmaSafeMinorAdd(grid_total,
            grid.reservation_minor, grid_total) ||
            !LP_RevmaSafeMinorAdd(overrun_total, grid_overrun, overrun_total))
         {
            Invalidate(shadow_index, "grid_reservation_sum_overflow");
            return false;
         }
         if(grid.candidate_reservation_minor < 0 ||
            (grid.candidate_reservation_minor > grid.reservation_minor &&
             grid.reservation_overrun) ||
            grid.reservation_overrun != (grid_overrun > 0) ||
            grid.reservation_overrun_minor != grid_overrun)
         {
            Invalidate(shadow_index, "grid_fill_reservation_reconciliation_mismatch");
            return false;
         }
      }
      long expected_capacity_overrun = grid_total > m_portfolios[shadow_index].capital_budget_minor ?
         grid_total - m_portfolios[shadow_index].capital_budget_minor : 0;
      if(grid_total != m_portfolios[shadow_index].reservation_minor || grid_total < 0 ||
         m_portfolios[shadow_index].reservation_overrun != (overrun_total > 0) ||
         m_portfolios[shadow_index].reservation_overrun_minor != overrun_total ||
         m_portfolios[shadow_index].capacity_overrun != (expected_capacity_overrun > 0) ||
         m_portfolios[shadow_index].capacity_overrun_minor != expected_capacity_overrun)
      {
         Invalidate(shadow_index, "portfolio_grid_reservation_mismatch");
         return false;
      }
      return true;
   }

   bool ReconcileMargin(const int shadow_index)
   {
      long grid_total = 0;
      for(int symbol_id = 0; symbol_id < LP_SYMBOL_COUNT; symbol_id++)
      {
         if(!LP_RevmaSafeMinorAdd(grid_total,
            m_grids[shadow_index][symbol_id].margin_minor, grid_total))
         {
            Invalidate(shadow_index, "grid_margin_sum_overflow");
            return false;
         }
      }
      if(grid_total != m_portfolios[shadow_index].margin_minor || grid_total < 0)
      {
         Invalidate(shadow_index, "portfolio_grid_margin_mismatch");
         return false;
      }
      return true;
   }

   bool ModeledMarginSolvent(const int shadow_index)
   {
      return shadow_index >= 0 &&
         shadow_index < LP_REVMA_SHADOW_BRANCH_COUNT &&
         m_portfolios[shadow_index].valid &&
         m_portfolios[shadow_index].margin_minor >= 0 &&
         m_portfolios[shadow_index].branch_equity_minor >= 0 &&
         m_portfolios[shadow_index].margin_minor <=
            m_portfolios[shadow_index].branch_equity_minor;
   }

   bool ReconcileGridInventory(const int shadow_index)
   {
      for(int symbol_id = 0; symbol_id < LP_SYMBOL_COUNT; symbol_id++)
      {
         LP_RevmaShadowGrid grid = m_grids[shadow_index][symbol_id];
         long expected_q_cash = 0;
         if(grid.branch != m_portfolios[shadow_index].branch ||
             grid.symbol_id != symbol_id ||
             grid.adverse_add_count < 0 || grid.favorable_add_count < 0 ||
             grid.peak_atom_count < 0 ||
             grid.peak_reservation_minor < 0 ||
             grid.maximum_adverse_excursion_minor < 0 ||
             grid.time_underwater_minutes < 0 ||
             grid.marked_liquidation_minor > LP_REVMA_MINOR_ABS_LIMIT ||
             grid.marked_liquidation_minor < -LP_REVMA_MINOR_ABS_LIMIT ||
             (grid.marked_liquidation_minor < 0 &&
              grid.maximum_adverse_excursion_minor <
                 -grid.marked_liquidation_minor) ||
            (grid.branch_grid_id == 0 &&
             (grid.peak_atom_count != 0 || grid.adverse_add_count != 0 ||
               grid.favorable_add_count != 0 ||
               grid.peak_reservation_minor != 0 ||
               grid.maximum_adverse_excursion_minor != 0 ||
               grid.time_underwater_minutes != 0)) ||
            (grid.branch_grid_id != 0 &&
             (grid.peak_atom_count <= 0 ||
              (long)grid.adverse_add_count +
                 (long)grid.favorable_add_count !=
                    (long)grid.peak_atom_count - 1)))
         {
            Invalidate(shadow_index, "grid_add_count_reconciliation_mismatch");
            return false;
         }
         if(grid.branch_grid_id != 0 &&
            (grid.formula_hash != LP_RevmaDiscoveryFormulaHash() ||
             grid.birth_p0 <= 0.0 || grid.birth_c0 <= 0.0 ||
             grid.birth_broker_tick_size <= 0.0 || grid.birth_p0_ticks <= 0 ||
             grid.birth_c0_ticks <= 0 || grid.q0 <= 0.0 ||
             !LP_RevmaDiscoveryBirthBucketValid(grid.birth_bucket) ||
             grid.birth_bucket != LP_RevmaDiscoveryBirthBucket(
                grid.direction, grid.birth_p0_ticks, grid.birth_c0_ticks) ||
             grid.birth_center_alignment !=
                (LP_RevmaDirectedSupportSign(grid.direction,
                   grid.birth_c0_ticks, grid.birth_p0_ticks) > 0 ?
                      "CENTER_ALIGNED_V1" : "NOT_APPLICABLE_V1") ||
             !grid.discovery_mesh.valid || !grid.path_geometry.valid ||
             grid.discovery_mesh.q0 != grid.q0 ||
             grid.discovery_mesh.broker_tick_size !=
                grid.birth_broker_tick_size ||
             grid.path_geometry.p0_ticks != grid.birth_p0_ticks ||
             grid.path_geometry.cell_ticks !=
                grid.discovery_mesh.discovery_cell_ticks ||
             grid.path_geometry.broker_tick_size !=
                grid.birth_broker_tick_size ||
             (grid.branch == LP_REVMA_BRANCH_U && grid.center_support.valid) ||
             (grid.branch == LP_REVMA_BRANCH_C &&
              (!grid.center_support.valid ||
               grid.center_support.direction != grid.direction ||
               grid.center_support.p0_ticks != grid.birth_p0_ticks ||
               grid.center_support.c0_ticks != grid.birth_c0_ticks ||
               grid.center_support.p0_raw != grid.birth_p0 ||
               grid.center_support.c0_raw != grid.birth_c0 ||
               grid.center_support.q0 != grid.q0 ||
               grid.center_support.broker_tick_size !=
                  grid.birth_broker_tick_size))))
         {
            Invalidate(shadow_index, "grid_immutable_birth_state_mismatch");
            return false;
         }
         if(grid.active)
         {
            if(grid.flat || grid.atom_count <= 0 ||
               !LP_RevmaSafeMinorMultiply(grid.a_g_minor,
                  grid.atom_count, expected_q_cash) ||
                grid.q_cash_minor != expected_q_cash ||
                grid.peak_q_cash_minor < grid.q_cash_minor ||
                grid.peak_reservation_minor < grid.reservation_minor ||
               NormalizeDouble(grid.total_lots, 2) != NormalizeDouble(
                  (double)grid.atom_count * LP_REVMA_DISCOVERY_ATOM_LOTS, 2))
            {
               Invalidate(shadow_index, "active_grid_inventory_reconciliation_mismatch");
               return false;
            }
         }
         else if(!grid.flat || grid.atom_count != 0 || grid.total_lots != 0.0 ||
            grid.q_cash_minor != 0 || grid.reservation_minor != 0 ||
            grid.candidate_reservation_minor != 0 || grid.margin_minor != 0 ||
            grid.marked_liquidation_minor != 0 ||
            grid.estimated_close_cost_minor != 0)
         {
            Invalidate(shadow_index, "flat_grid_inventory_reconciliation_mismatch");
            return false;
         }
      }
      return true;
   }

   bool ReconcileMarkAndCost(const int shadow_index)
   {
      long mark_total = 0;
      long cost_total = 0;
      for(int symbol_id = 0; symbol_id < LP_SYMBOL_COUNT; symbol_id++)
      {
         LP_RevmaShadowGrid grid = m_grids[shadow_index][symbol_id];
         if(grid.estimated_close_cost_minor < 0 ||
            (grid.active && grid.last_mark_m1_time <
               grid.last_admission_m1_time) ||
            !LP_RevmaSafeMinorAdd(mark_total,
               grid.marked_liquidation_minor, mark_total) ||
            !LP_RevmaSafeMinorAdd(cost_total,
               grid.estimated_close_cost_minor, cost_total))
         {
            Invalidate(shadow_index, "grid_mark_cost_reconciliation_overflow");
            return false;
         }
      }
      if(mark_total != m_portfolios[shadow_index].marked_liquidation_minor ||
         cost_total !=
            m_portfolios[shadow_index].estimated_close_cost_minor)
      {
         Invalidate(shadow_index, "portfolio_grid_mark_cost_mismatch");
         return false;
      }
      return true;
   }

   bool IncrementEvidenceCounter(ulong &counter)
   {
      if(counter >= (ulong)LP_REVMA_MINOR_ABS_LIMIT)
         return false;
      counter++;
      return true;
   }

   bool RecordCandidateBuilt(const int shadow_index)
   {
      if(!IncrementEvidenceCounter(
            m_portfolios[shadow_index].cycle_candidate_built_count) ||
         !IncrementEvidenceCounter(
            m_portfolios[shadow_index].run_candidate_built_count))
      {
         Invalidate(shadow_index, "candidate_built_count_overflow");
         return false;
      }
      return true;
   }

   bool RecordCandidateDecisions(const int shadow_index)
   {
      ulong admitted = 0;
      ulong rejected = 0;
      for(int i = 0; i < m_candidate_count[shadow_index]; i++)
      {
         if(m_candidates[shadow_index][i].decision ==
            LP_REVMA_DISCOVERY_DECISION_ADMIT)
            admitted++;
         else if(m_candidates[shadow_index][i].decision ==
            LP_REVMA_DISCOVERY_DECISION_REJECT)
            rejected++;
         else
         {
            Invalidate(shadow_index,
               "candidate_without_terminal_allocation_decision");
            return false;
         }
      }
      ulong decisions = admitted + rejected;
      if(decisions != (ulong)m_candidate_count[shadow_index] ||
         m_portfolios[shadow_index].cycle_candidate_decision_count >
            (ulong)LP_REVMA_MINOR_ABS_LIMIT - decisions ||
         m_portfolios[shadow_index].run_candidate_decision_count >
            (ulong)LP_REVMA_MINOR_ABS_LIMIT - decisions ||
         m_portfolios[shadow_index].cycle_candidate_admitted_count >
            (ulong)LP_REVMA_MINOR_ABS_LIMIT - admitted ||
         m_portfolios[shadow_index].run_candidate_admitted_count >
            (ulong)LP_REVMA_MINOR_ABS_LIMIT - admitted ||
         m_portfolios[shadow_index].cycle_candidate_rejected_count >
            (ulong)LP_REVMA_MINOR_ABS_LIMIT - rejected ||
         m_portfolios[shadow_index].run_candidate_rejected_count >
            (ulong)LP_REVMA_MINOR_ABS_LIMIT - rejected)
      {
         Invalidate(shadow_index, "candidate_decision_count_overflow");
         return false;
      }
      m_portfolios[shadow_index].cycle_candidate_decision_count += decisions;
      m_portfolios[shadow_index].run_candidate_decision_count += decisions;
      m_portfolios[shadow_index].cycle_candidate_admitted_count += admitted;
      m_portfolios[shadow_index].run_candidate_admitted_count += admitted;
      m_portfolios[shadow_index].cycle_candidate_rejected_count += rejected;
      m_portfolios[shadow_index].run_candidate_rejected_count += rejected;
      return true;
   }

   bool RecordInventoryTransition(const int shadow_index)
   {
      if(!IncrementEvidenceCounter(
            m_portfolios[shadow_index].cycle_inventory_transition_count) ||
         !IncrementEvidenceCounter(
            m_portfolios[shadow_index].run_inventory_transition_count))
      {
         Invalidate(shadow_index, "inventory_transition_count_overflow");
         return false;
      }
      return true;
   }

   bool ReconcileAndObserveConcurrentRisk(
      const int shadow_index,
      const datetime source_m1_time,
      const string boundary_class)
   {
      if(shadow_index < 0 || shadow_index >= LP_REVMA_SHADOW_BRANCH_COUNT ||
         !m_portfolios[shadow_index].valid || source_m1_time <= 0 ||
         ((long)source_m1_time % 60) != 0 || boundary_class == "" ||
         !ReconcileReservation(shadow_index) ||
         !ReconcileMargin(shadow_index) ||
         !ReconcileGridInventory(shadow_index) ||
         !ReconcileMarkAndCost(shadow_index) ||
         !ReconcileEquity(shadow_index))
      {
         if(shadow_index >= 0 &&
            shadow_index < LP_REVMA_SHADOW_BRANCH_COUNT)
            Invalidate(shadow_index,
               "concurrent_risk_preflight_reconciliation_failed");
         return false;
      }
      long q_cash = 0;
      long reservation = 0;
      long margin = 0;
      long mark = 0;
      long cost = 0;
      int atoms = 0;
      int active_grids = 0;
      long currency_q_cash[LP_CCY_COUNT];
      for(int ccy = 0; ccy < LP_CCY_COUNT; ccy++)
         currency_q_cash[ccy] = 0;
      for(int symbol_id = 0; symbol_id < LP_SYMBOL_COUNT; symbol_id++)
      {
         LP_RevmaShadowGrid grid = m_grids[shadow_index][symbol_id];
         if(!grid.active)
            continue;
         if(grid.last_mark_m1_time != source_m1_time ||
            !grid.path_geometry.valid ||
            grid.path_geometry.last_observation_m1 != source_m1_time ||
            (grid.branch == LP_REVMA_BRANCH_C &&
             (!grid.center_support.valid ||
              grid.center_support.last_observation_m1 != source_m1_time)) ||
            grid.q_cash_minor <= 0 || grid.atom_count <= 0 ||
            active_grids >= LP_SYMBOL_COUNT ||
            atoms > 2147483647 - grid.atom_count ||
            !LP_RevmaSafeMinorAdd(q_cash, grid.q_cash_minor, q_cash) ||
            !LP_RevmaSafeMinorAdd(reservation, grid.reservation_minor,
               reservation) ||
            !LP_RevmaSafeMinorAdd(margin, grid.margin_minor, margin) ||
            !LP_RevmaSafeMinorAdd(mark, grid.marked_liquidation_minor,
               mark) ||
            !LP_RevmaSafeMinorAdd(cost, grid.estimated_close_cost_minor,
               cost))
         {
            Invalidate(shadow_index,
               "concurrent_risk_grid_or_clock_inconsistent");
            return false;
         }
         int base_ccy = -1;
         int quote_ccy = -1;
         LP_CanonicalBaseQuote(LP_CanonicalSymbol(symbol_id), base_ccy,
            quote_ccy);
         if(base_ccy < 0 || base_ccy >= LP_CCY_COUNT || quote_ccy < 0 ||
            quote_ccy >= LP_CCY_COUNT || base_ccy == quote_ccy ||
            !LP_RevmaSafeMinorAdd(currency_q_cash[base_ccy],
               grid.q_cash_minor, currency_q_cash[base_ccy]) ||
            !LP_RevmaSafeMinorAdd(currency_q_cash[quote_ccy],
               grid.q_cash_minor, currency_q_cash[quote_ccy]))
         {
            Invalidate(shadow_index,
               "concurrent_currency_concentration_reconciliation_failed");
            return false;
         }
         atoms += grid.atom_count;
         active_grids++;
      }
      if(reservation != m_portfolios[shadow_index].reservation_minor ||
         margin != m_portfolios[shadow_index].margin_minor ||
         mark != m_portfolios[shadow_index].marked_liquidation_minor ||
         cost != m_portfolios[shadow_index].estimated_close_cost_minor)
      {
         Invalidate(shadow_index,
            "concurrent_risk_live_ledger_mismatch");
         return false;
      }
      long concentration = 0;
      int concentration_ccy = -1;
      for(int ccy = 0; ccy < LP_CCY_COUNT; ccy++)
      {
         if(currency_q_cash[ccy] > concentration)
         {
            concentration = currency_q_cash[ccy];
            concentration_ccy = ccy;
         }
      }
      long liability = mark < 0 ? -mark : 0;
      long equity = m_portfolios[shadow_index].branch_equity_minor;
      if(m_portfolios[shadow_index].equity_high_water_minor < equity)
         m_portfolios[shadow_index].equity_high_water_minor = equity;
      if(m_portfolios[shadow_index].run_equity_high_water_minor < equity)
         m_portfolios[shadow_index].run_equity_high_water_minor = equity;
      long drawdown = 0;
      long run_drawdown = 0;
      if(!LP_RevmaSafeMinorAdd(
            m_portfolios[shadow_index].equity_high_water_minor, -equity,
            drawdown) || drawdown < 0 ||
         !LP_RevmaSafeMinorAdd(
            m_portfolios[shadow_index].run_equity_high_water_minor, -equity,
            run_drawdown) || run_drawdown < 0)
      {
         Invalidate(shadow_index,
            "concurrent_drawdown_arithmetic_failure");
         return false;
      }
      m_portfolios[shadow_index].q_cash_minor = q_cash;
      m_portfolios[shadow_index].atom_count = atoms;
      m_portfolios[shadow_index].active_grid_count = active_grids;
      for(int ccy = 0; ccy < LP_CCY_COUNT; ccy++)
         m_portfolios[shadow_index].currency_q_cash_minor[ccy] =
            currency_q_cash[ccy];
      m_portfolios[shadow_index].concentration_q_cash_minor = concentration;
      m_portfolios[shadow_index].concentration_currency_id =
         concentration_ccy;
      m_portfolios[shadow_index].liquidation_liability_minor = liability;
      m_portfolios[shadow_index].branch_drawdown_minor = drawdown;

      if(reservation > m_portfolios[shadow_index].peak_reservation_minor)
         m_portfolios[shadow_index].peak_reservation_minor = reservation;
      if(margin > m_portfolios[shadow_index].peak_margin_minor)
         m_portfolios[shadow_index].peak_margin_minor = margin;
      if(q_cash > m_portfolios[shadow_index].peak_q_cash_minor)
         m_portfolios[shadow_index].peak_q_cash_minor = q_cash;
      if(atoms > m_portfolios[shadow_index].peak_atom_count)
         m_portfolios[shadow_index].peak_atom_count = atoms;
      if(active_grids > m_portfolios[shadow_index].peak_active_grid_count)
         m_portfolios[shadow_index].peak_active_grid_count = active_grids;
      if(concentration >
         m_portfolios[shadow_index].peak_concentration_q_cash_minor)
      {
         m_portfolios[shadow_index].peak_concentration_q_cash_minor =
            concentration;
         m_portfolios[shadow_index].peak_concentration_currency_id =
            concentration_ccy;
      }
      if(liability >
         m_portfolios[shadow_index].peak_liquidation_liability_minor)
         m_portfolios[shadow_index].peak_liquidation_liability_minor =
            liability;
      if(drawdown >
         m_portfolios[shadow_index].maximum_branch_drawdown_minor)
         m_portfolios[shadow_index].maximum_branch_drawdown_minor = drawdown;

      if(reservation > m_portfolios[shadow_index].run_peak_reservation_minor)
         m_portfolios[shadow_index].run_peak_reservation_minor = reservation;
      if(margin > m_portfolios[shadow_index].run_peak_margin_minor)
         m_portfolios[shadow_index].run_peak_margin_minor = margin;
      if(q_cash > m_portfolios[shadow_index].run_peak_q_cash_minor)
         m_portfolios[shadow_index].run_peak_q_cash_minor = q_cash;
      if(atoms > m_portfolios[shadow_index].run_peak_atom_count)
         m_portfolios[shadow_index].run_peak_atom_count = atoms;
      if(active_grids >
         m_portfolios[shadow_index].run_peak_active_grid_count)
         m_portfolios[shadow_index].run_peak_active_grid_count = active_grids;
      if(concentration >
         m_portfolios[shadow_index].run_peak_concentration_q_cash_minor)
      {
         m_portfolios[shadow_index].run_peak_concentration_q_cash_minor =
            concentration;
         m_portfolios[shadow_index].run_peak_concentration_currency_id =
            concentration_ccy;
      }
      if(liability >
         m_portfolios[shadow_index].run_peak_liquidation_liability_minor)
         m_portfolios[shadow_index].run_peak_liquidation_liability_minor =
            liability;
      if(run_drawdown >
         m_portfolios[shadow_index].run_maximum_branch_drawdown_minor)
         m_portfolios[shadow_index].run_maximum_branch_drawdown_minor =
            run_drawdown;

      if(!IncrementEvidenceCounter(
            m_portfolios[shadow_index].cycle_risk_snapshot_count) ||
         !IncrementEvidenceCounter(
            m_portfolios[shadow_index].run_risk_snapshot_count))
      {
         Invalidate(shadow_index, "risk_snapshot_count_overflow");
         return false;
      }
      ulong cycle_hash = m_portfolios[shadow_index].cycle_risk_snapshot_hash;
      ulong run_hash = m_portfolios[shadow_index].run_risk_snapshot_hash;
      LP_HashMixULong(cycle_hash, LP_HashString(boundary_class));
      LP_HashMixULong(run_hash, LP_HashString(boundary_class));
      LP_HashMixLong(cycle_hash, (long)source_m1_time);
      LP_HashMixLong(run_hash, (long)source_m1_time);
      LP_HashMixLong(cycle_hash, reservation);
      LP_HashMixLong(run_hash, reservation);
      LP_HashMixLong(cycle_hash, margin);
      LP_HashMixLong(run_hash, margin);
      LP_HashMixLong(cycle_hash, q_cash);
      LP_HashMixLong(run_hash, q_cash);
      LP_HashMixInt(cycle_hash, atoms);
      LP_HashMixInt(run_hash, atoms);
      LP_HashMixInt(cycle_hash, active_grids);
      LP_HashMixInt(run_hash, active_grids);
      LP_HashMixLong(cycle_hash, concentration);
      LP_HashMixLong(run_hash, concentration);
      LP_HashMixInt(cycle_hash, concentration_ccy);
      LP_HashMixInt(run_hash, concentration_ccy);
      LP_HashMixLong(cycle_hash, liability);
      LP_HashMixLong(run_hash, liability);
      LP_HashMixLong(cycle_hash, drawdown);
      LP_HashMixLong(run_hash, run_drawdown);
      LP_HashMixLong(cycle_hash, equity);
      LP_HashMixLong(run_hash, equity);
      for(int ccy = 0; ccy < LP_CCY_COUNT; ccy++)
      {
         LP_HashMixLong(cycle_hash, currency_q_cash[ccy]);
         LP_HashMixLong(run_hash, currency_q_cash[ccy]);
      }
      if(cycle_hash == 0 || run_hash == 0)
      {
         Invalidate(shadow_index, "risk_snapshot_hash_zero");
         return false;
      }
      m_portfolios[shadow_index].cycle_risk_snapshot_hash = cycle_hash;
      m_portfolios[shadow_index].run_risk_snapshot_hash = run_hash;
      m_portfolios[shadow_index].last_risk_snapshot_m1_time = source_m1_time;
      return true;
   }

   void RecordInfeasibility(
      const int shadow_index,
      const string reason,
      const datetime source_m1_time
   )
   {
      if(m_portfolios[shadow_index].first_infeasibility == "")
      {
         m_portfolios[shadow_index].first_infeasibility = reason;
         m_portfolios[shadow_index].first_infeasibility_m1_time = source_m1_time;
      }
      m_portfolios[shadow_index].latest_infeasibility = reason;
      m_portfolios[shadow_index].latest_infeasibility_m1_time = source_m1_time;
   }

   void UpdateReservationReconciliation(const int shadow_index)
   {
      long fill_overrun = 0;
      for(int symbol_id = 0; symbol_id < LP_SYMBOL_COUNT; symbol_id++)
      {
         long grid_overrun = m_grids[shadow_index][symbol_id].reservation_minor >
            m_grids[shadow_index][symbol_id].candidate_reservation_minor ?
            m_grids[shadow_index][symbol_id].reservation_minor -
               m_grids[shadow_index][symbol_id].candidate_reservation_minor : 0;
         if(!LP_RevmaSafeMinorAdd(fill_overrun, grid_overrun, fill_overrun))
         {
            Invalidate(shadow_index, "reservation_overrun_sum_overflow");
            return;
         }
      }
      long capacity_overrun = m_portfolios[shadow_index].reservation_minor >
         m_portfolios[shadow_index].capital_budget_minor ?
         m_portfolios[shadow_index].reservation_minor -
            m_portfolios[shadow_index].capital_budget_minor : 0;
      m_portfolios[shadow_index].reservation_overrun = fill_overrun > 0;
      m_portfolios[shadow_index].reservation_overrun_minor = fill_overrun;
      m_portfolios[shadow_index].capacity_overrun = capacity_overrun > 0;
      m_portfolios[shadow_index].capacity_overrun_minor = capacity_overrun;
   }

   bool AllGridsFlat(const int shadow_index)
   {
      for(int symbol_id = 0; symbol_id < LP_SYMBOL_COUNT; symbol_id++)
      {
         if(m_grids[shadow_index][symbol_id].active || !m_grids[shadow_index][symbol_id].flat)
            return false;
      }
      return true;
   }

   bool UpdateCausalDivergenceAfterBothBatches()
   {
      if(!m_causal_matching_open)
         return true;
      if(m_portfolios[0].batch_open || m_portfolios[1].batch_open ||
         !m_portfolios[0].transitions_committed ||
         !m_portfolios[1].transitions_committed ||
         m_portfolios[0].batch_m1_time != m_portfolios[1].batch_m1_time)
         return true;
      for(int i = 0; i < m_candidate_count[0]; i++)
      {
         LP_RevmaShadowCandidate u = m_candidates[0][i];
         if(u.opportunity_id == 0)
            continue;
         bool counterpart_found = false;
         for(int j = 0; j < m_candidate_count[1]; j++)
         {
            LP_RevmaShadowCandidate c = m_candidates[1][j];
            if(c.opportunity_id != u.opportunity_id)
               continue;
            counterpart_found = true;
            if(u.committed != c.committed)
            {
               bool authorized_center_divergence = u.committed &&
                  !c.committed &&
                  u.candidate_type ==
                     LP_REVMA_DISCOVERY_CANDIDATE_ADVERSE_ADD &&
                  c.candidate_type ==
                     LP_REVMA_DISCOVERY_CANDIDATE_ADVERSE_ADD &&
                  u.center_add_authorized &&
                  !u.center_policy_applies &&
                  c.center_policy_checked &&
                  c.center_policy_applies &&
                  !c.center_add_authorized &&
                  c.center_support_snapshot.valid &&
                  c.center_support_snapshot.applicable &&
                  c.center_support_snapshot.adverse_adds_frozen &&
                  u.decision == LP_REVMA_DISCOVERY_DECISION_ADMIT &&
                  c.decision == LP_REVMA_DISCOVERY_DECISION_REJECT &&
                  c.decision_reason ==
                     "signed_center_support_adverse_adds_frozen";
               if(!authorized_center_divergence)
               {
                  InvalidateMatchedBranches(
                     "unauthorized_U_C_commit_divergence_shape");
                  return false;
               }
               m_causal_matching_open = false;
               m_first_causal_divergence_m1 =
                  m_portfolios[0].batch_m1_time;
               m_first_causal_divergence_opportunity_id = u.opportunity_id;
            }
            break;
         }
         if(!counterpart_found)
         {
            Invalidate(0, "matched_opportunity_commit_counterpart_missing");
            Invalidate(1, "matched_opportunity_commit_counterpart_missing");
            return false;
         }
         if(!m_causal_matching_open)
            break;
      }
      if(m_causal_matching_open && !FullPreDivergenceParity())
      {
         InvalidateMatchedBranches(
            "pre_divergence_post_batch_state_mismatch");
         return false;
      }
      return true;
   }

   bool ReentryEligibleInternal(
      const int shadow_index,
      const int symbol_id,
      const datetime source_m1_time,
      const ulong current_strategy_identity_hash
   )
   {
      LP_RevmaShadowGrid grid = m_grids[shadow_index][symbol_id];
      if(!m_portfolios[shadow_index].valid ||
         m_portfolios[shadow_index].close_owner != LP_REVMA_DISCOVERY_CLOSE_NONE ||
         m_portfolios[shadow_index].hard_risk_latched ||
         m_portfolios[shadow_index].cycle_reset_required ||
         source_m1_time <= grid.last_flat_m1_time ||
         source_m1_time <= grid.close_trigger_m1_time ||
         current_strategy_identity_hash == 0 || grid.active || !grid.flat)
         return false;
      if(grid.reentry_requires_identity_transition &&
         (grid.reentry_last_identity_observation_m1 != source_m1_time ||
          current_strategy_identity_hash != grid.reentry_last_observed_identity ||
          current_strategy_identity_hash == grid.reentry_identity_at_close ||
          grid.reentry_transition_m1 <= grid.last_flat_m1_time ||
          grid.reentry_transition_m1 > source_m1_time))
         return false;
      return true;
   }

   bool LatchPortfolioCloseAuthority(
      const int shadow_index,
      const int close_owner,
      const datetime source_m1_time
   )
   {
      if((close_owner != LP_REVMA_DISCOVERY_CLOSE_CLEANUP &&
          close_owner != LP_REVMA_DISCOVERY_CLOSE_HARD_RISK) ||
         source_m1_time <= 0 ||
         close_owner < m_portfolios[shadow_index].close_owner)
         return false;
      for(int symbol_id = 0; symbol_id < LP_SYMBOL_COUNT; symbol_id++)
      {
         LP_RevmaShadowGrid grid = m_grids[shadow_index][symbol_id];
         if(grid.active &&
            (!LP_RevmaDiscoveryTerminalReasonOwnerConsistent(
                grid.terminal_reason, grid.close_owner) ||
             (grid.terminal_reason != "" &&
              grid.close_trigger_m1_time <= 0)))
            return false;
      }
      m_portfolios[shadow_index].close_owner = close_owner;
      if(close_owner == LP_REVMA_DISCOVERY_CLOSE_HARD_RISK)
         m_portfolios[shadow_index].hard_risk_latched = true;
      for(int symbol_id = 0; symbol_id < LP_SYMBOL_COUNT; symbol_id++)
      {
         LP_RevmaShadowGrid grid = m_grids[shadow_index][symbol_id];
         if(!grid.active)
            continue;
         if(grid.terminal_reason == "")
         {
            grid.terminal_reason = close_owner == LP_REVMA_DISCOVERY_CLOSE_CLEANUP ?
               "account_cleanup" : "account_risk";
            grid.close_trigger_m1_time = source_m1_time;
         }
         grid.close_owner = close_owner;
         m_grids[shadow_index][symbol_id] = grid;
      }
      return true;
   }

   bool CandidateLess(const LP_RevmaShadowCandidate &left, const LP_RevmaShadowCandidate &right)
   {
      if(left.incremental_reservation_minor != right.incremental_reservation_minor)
         return left.incremental_reservation_minor < right.incremental_reservation_minor;
      if(left.symbol_id != right.symbol_id)
         return left.symbol_id < right.symbol_id;
      return left.candidate_identity < right.candidate_identity;
   }

   bool MatchedCandidateSnapshotsEqual(
      const LP_RevmaShadowCandidate &left,
      const LP_RevmaShadowCandidate &right
   )
   {
      return left.symbol_id == right.symbol_id &&
         left.source_m1_time == right.source_m1_time &&
         left.candidate_type == right.candidate_type &&
         left.pre_candidate_state_hash == right.pre_candidate_state_hash &&
         left.direction == right.direction &&
         left.decision_price == right.decision_price &&
         left.stress_price == right.stress_price &&
         left.fill_price == right.fill_price &&
         left.q0 == right.q0 && left.q_event_count == right.q_event_count &&
         left.p0 == right.p0 && left.c0 == right.c0 &&
         left.broker_tick_size == right.broker_tick_size &&
         left.matched_snapshot_hash == right.matched_snapshot_hash &&
         left.shared_observation_snapshot_hash ==
            right.shared_observation_snapshot_hash &&
         left.incremental_reservation_minor == right.incremental_reservation_minor &&
         left.a_g_candidate_minor == right.a_g_candidate_minor &&
         left.a_g_minor == right.a_g_minor &&
         left.strategy_identity_hash == right.strategy_identity_hash &&
         left.strategy_state_identity_hash ==
            right.strategy_state_identity_hash &&
         left.incremental_margin_minor == right.incremental_margin_minor &&
         left.incremental_liquidation_minor ==
            right.incremental_liquidation_minor &&
         left.incremental_close_cost_minor ==
            right.incremental_close_cost_minor;
   }

   bool NormalizeCandidateReservation(
      const int shadow_index,
      const LP_RevmaShadowCandidate &candidate_input,
      LP_RevmaShadowCandidate &normalized
   )
   {
      normalized = candidate_input;
      LP_RevmaShadowGrid grid = m_grids[shadow_index][candidate_input.symbol_id];
      long candidate_a_g = candidate_input.a_g_candidate_minor;
      long fill_a_g = candidate_input.a_g_minor;
      int next_peak_atoms = 1;
      if(!candidate_input.birth)
      {
         if(!grid.active || grid.a_g_candidate_minor <= 0 || grid.a_g_minor <= 0)
            return false;
         candidate_a_g = grid.a_g_candidate_minor;
         fill_a_g = grid.a_g_minor;
         if(grid.peak_atom_count >= 2147483647)
            return false;
         next_peak_atoms = grid.peak_atom_count + 1;
      }
      if(candidate_a_g <= 0 || fill_a_g <= 0)
         return false;

      long admission_delta = 0;
      long committed_delta = 0;
      if(candidate_input.birth)
      {
         if(!LP_RevmaSafeMinorMultiply(candidate_a_g, 2, admission_delta) ||
            !LP_RevmaSafeMinorMultiply(fill_a_g, 2, committed_delta))
            return false;
      }
      else if(next_peak_atoms > 2)
      {
         admission_delta = candidate_a_g;
         committed_delta = fill_a_g;
      }
      normalized.a_g_candidate_minor = candidate_a_g;
      normalized.a_g_minor = fill_a_g;
      normalized.incremental_reservation_minor = admission_delta;
      normalized.committed_reservation_delta_minor = committed_delta;
      normalized.incremental_q_cash_minor = fill_a_g;
      return true;
   }

   void TerminalHashMixBool(ulong &hash, const bool value)
   {
      LP_HashMixInt(hash, value ? 1 : 0);
   }

   void TerminalHashMixDouble(ulong &hash, const double value)
   {
      LP_HashMixULong(hash, LP_HashString(DoubleToString(value, 12)));
   }

   void TerminalHashMixText(ulong &hash, const string value)
   {
      LP_HashMixULong(hash, LP_HashString(value));
   }

   ulong TerminalGridInternalStateHash(
      const LP_RevmaShadowGrid &grid,
      const datetime terminal_m1_time,
      const string boundary_class)
   {
      if(terminal_m1_time <= 0 || boundary_class == "" ||
         !LP_RevmaDiscoveryTerminalReasonOwnerConsistent(
            grid.terminal_reason, grid.close_owner))
         return 0;
      ulong hash = LP_HashString("gate108_shadow_grid_internal_terminal_state_v1");
      TerminalHashMixText(hash, boundary_class);
      LP_HashMixLong(hash, (long)terminal_m1_time);
      TerminalHashMixBool(hash, grid.valid);
      TerminalHashMixBool(hash, grid.active);
      TerminalHashMixBool(hash, grid.flat);
      LP_HashMixInt(hash, grid.branch);
      LP_HashMixInt(hash, grid.symbol_id);
      LP_HashMixInt(hash, grid.direction);
      LP_HashMixULong(hash, grid.branch_grid_id);
      LP_HashMixULong(hash, grid.branch_cycle_id);
      LP_HashMixLong(hash, grid.grid_generation);
      LP_HashMixULong(hash, grid.shared_origin_id);
      LP_HashMixULong(hash, grid.birth_pre_candidate_state_hash);
      LP_HashMixULong(hash, grid.birth_matched_snapshot_hash);
      LP_HashMixULong(hash, grid.birth_shared_observation_snapshot_hash);
      LP_HashMixULong(hash, grid.formula_hash);
      LP_HashMixULong(hash, grid.strategy_identity_hash);
      LP_HashMixULong(hash, grid.strategy_state_identity_hash);
      LP_HashMixLong(hash, (long)grid.birth_m1_time);
      LP_HashMixLong(hash, (long)grid.last_admission_m1_time);
      LP_HashMixULong(hash, grid.last_admission_identity);
      LP_HashMixInt(hash, grid.atom_count);
      LP_HashMixInt(hash, grid.peak_atom_count);
      LP_HashMixInt(hash, grid.adverse_add_count);
      LP_HashMixInt(hash, grid.favorable_add_count);
      TerminalHashMixBool(hash, grid.excursion_completed);
      TerminalHashMixDouble(hash, grid.total_lots);
      TerminalHashMixDouble(hash, grid.weighted_entry_price_lots);
      TerminalHashMixDouble(hash, grid.average_entry_price);
      TerminalHashMixDouble(hash, grid.minimum_entry_price);
      TerminalHashMixDouble(hash, grid.maximum_entry_price);
      TerminalHashMixDouble(hash, grid.birth_p0);
      TerminalHashMixDouble(hash, grid.birth_stress_price);
      TerminalHashMixDouble(hash, grid.birth_c0);
      TerminalHashMixDouble(hash, grid.birth_broker_tick_size);
      LP_HashMixLong(hash, grid.birth_p0_ticks);
      LP_HashMixLong(hash, grid.birth_c0_ticks);
      TerminalHashMixText(hash, grid.birth_bucket);
      TerminalHashMixText(hash, grid.birth_center_alignment);
      TerminalHashMixDouble(hash, grid.q0);
      LP_HashMixLong(hash, grid.q_cash_minor);
      LP_HashMixLong(hash, grid.peak_q_cash_minor);
      LP_HashMixLong(hash, grid.a_g_candidate_minor);
      LP_HashMixLong(hash, grid.a_g_minor);
      LP_HashMixLong(hash, grid.candidate_reservation_minor);
      LP_HashMixLong(hash, grid.reservation_minor);
      LP_HashMixLong(hash, grid.peak_reservation_minor);
      TerminalHashMixBool(hash, grid.reservation_overrun);
      LP_HashMixLong(hash, grid.reservation_overrun_minor);
      TerminalHashMixBool(hash, grid.reservation_overrun_observed);
      LP_HashMixLong(hash, grid.peak_reservation_overrun_minor);
      LP_HashMixLong(hash, grid.margin_minor);
      LP_HashMixLong(hash, grid.peak_margin_minor);
      LP_HashMixLong(hash, grid.realized_harvest_minor);
      LP_HashMixLong(hash, grid.realized_nonharvest_minor);
      LP_HashMixLong(hash, grid.marked_liquidation_minor);
      LP_HashMixLong(hash, grid.maximum_adverse_excursion_minor);
      LP_HashMixInt(hash, grid.time_underwater_minutes);
      LP_HashMixLong(hash, grid.estimated_close_cost_minor);
      LP_HashMixLong(hash, grid.realized_close_cost_minor);
      LP_HashMixInt(hash, grid.close_owner);
      TerminalHashMixText(hash, grid.terminal_reason);
      LP_HashMixLong(hash, (long)grid.close_trigger_m1_time);
      LP_HashMixLong(hash, (long)grid.last_mark_m1_time);
      LP_HashMixLong(hash,
         (long)grid.last_local_harvest_evaluation_m1_time);
      LP_HashMixLong(hash, (long)grid.last_flat_m1_time);
      TerminalHashMixBool(hash, grid.reentry_requires_identity_transition);
      LP_HashMixULong(hash, grid.reentry_identity_at_close);
      LP_HashMixULong(hash, grid.reentry_last_observed_identity);
      LP_HashMixLong(hash, (long)grid.reentry_last_identity_observation_m1);
      LP_HashMixLong(hash, (long)grid.reentry_transition_m1);

      TerminalHashMixBool(hash, grid.discovery_mesh.valid);
      TerminalHashMixDouble(hash, grid.discovery_mesh.q0);
      TerminalHashMixDouble(hash, grid.discovery_mesh.broker_tick_size);
      LP_HashMixLong(hash, grid.discovery_mesh.discovery_cell_ticks);
      TerminalHashMixDouble(hash, grid.discovery_mesh.discovery_cell_price);

      TerminalHashMixBool(hash, grid.path_geometry.valid);
      LP_HashMixLong(hash, grid.path_geometry.p0_ticks);
      LP_HashMixLong(hash, grid.path_geometry.cell_ticks);
      TerminalHashMixDouble(hash, grid.path_geometry.broker_tick_size);
      LP_HashMixLong(hash, grid.path_geometry.previous_cell_index);
      LP_HashMixLong(hash, grid.path_geometry.current_cell_index);
      LP_HashMixLong(hash, grid.path_geometry.minimum_cell_index);
      LP_HashMixLong(hash, grid.path_geometry.maximum_cell_index);
      LP_HashMixLong(hash, grid.path_geometry.total_cell_path);
      LP_HashMixLong(hash, grid.path_geometry.completed_cell_crossings);
      LP_HashMixLong(hash, grid.path_geometry.matched_reversal_crossings);
      LP_HashMixLong(hash, grid.path_geometry.adverse_frontier_expansions);
      LP_HashMixLong(hash, grid.path_geometry.favorable_frontier_expansions);
      LP_HashMixLong(hash, grid.path_geometry.new_extreme_count);
      LP_HashMixLong(hash,
         grid.path_geometry.maximum_single_observation_cell_jump);
      LP_HashMixInt(hash, grid.path_geometry.last_movement_sign);
      LP_HashMixLong(hash, (long)grid.path_geometry.last_observation_m1);
      LP_HashMixLong(hash, (long)grid.path_geometry.last_reversal_m1);

      TerminalHashMixBool(hash, grid.center_support.valid);
      TerminalHashMixBool(hash, grid.center_support.applicable);
      TerminalHashMixBool(hash, grid.center_support.adverse_adds_frozen);
      LP_HashMixInt(hash, grid.center_support.direction);
      LP_HashMixLong(hash, grid.center_support.p0_ticks);
      LP_HashMixLong(hash, grid.center_support.c0_ticks);
      LP_HashMixLong(hash, grid.center_support.previous_center_ticks);
      LP_HashMixLong(hash, grid.center_support.current_center_ticks);
      TerminalHashMixDouble(hash, grid.center_support.p0_raw);
      TerminalHashMixDouble(hash, grid.center_support.c0_raw);
      TerminalHashMixDouble(hash, grid.center_support.previous_center_raw);
      TerminalHashMixDouble(hash, grid.center_support.current_center_raw);
      LP_HashMixInt(hash, grid.center_support.support0_sign);
      LP_HashMixInt(hash, grid.center_support.previous_support_sign);
      LP_HashMixInt(hash, grid.center_support.current_support_sign);
      TerminalHashMixDouble(hash, grid.center_support.q0);
      TerminalHashMixDouble(hash, grid.center_support.current_q);
      TerminalHashMixDouble(hash, grid.center_support.broker_tick_size);
      TerminalHashMixDouble(hash, grid.center_support.support0_q);
      TerminalHashMixDouble(hash, grid.center_support.current_support_q);
      TerminalHashMixDouble(hash, grid.center_support.current_revision_q);
      TerminalHashMixDouble(hash,
         grid.center_support.cumulative_signed_revision_q);
      TerminalHashMixDouble(hash,
         grid.center_support.cumulative_absolute_revision_q);
      TerminalHashMixDouble(hash, grid.center_support.minimum_support_q);
      TerminalHashMixDouble(hash, grid.center_support.maximum_support_q);
      TerminalHashMixDouble(hash, grid.center_support.regression_sum_x);
      TerminalHashMixDouble(hash, grid.center_support.regression_sum_y);
      TerminalHashMixDouble(hash, grid.center_support.regression_sum_x2);
      TerminalHashMixDouble(hash, grid.center_support.regression_sum_xy);
      LP_HashMixInt(hash, grid.center_support.center_update_count);
      LP_HashMixInt(hash, grid.center_support.center_observation_count);
      LP_HashMixInt(hash, grid.center_support.center_not_available_count);
      LP_HashMixInt(hash,
         grid.center_support.adverse_adds_blocked_after_latch);
      LP_HashMixULong(hash,
         grid.center_support.last_blocked_candidate_identity);
      LP_HashMixLong(hash,
         (long)grid.center_support.last_blocked_candidate_m1);
      LP_HashMixInt(hash, grid.center_support.birth_q_event_index);
      LP_HashMixInt(hash, grid.center_support.current_q_event_index);
      LP_HashMixInt(hash,
         grid.center_support.first_center_update_q_event_index);
      LP_HashMixInt(hash,
         grid.center_support.last_center_update_q_event_index);
      LP_HashMixLong(hash, (long)grid.center_support.birth_m1_time);
      LP_HashMixLong(hash,
         (long)grid.center_support.first_center_update_m1);
      LP_HashMixLong(hash,
         (long)grid.center_support.last_center_update_m1);
      LP_HashMixInt(hash,
         grid.center_support.first_center_update_observation_index);
      LP_HashMixInt(hash,
         grid.center_support.last_center_update_observation_index);
      LP_HashMixLong(hash, (long)grid.center_support.latch_m1_time);
      LP_HashMixLong(hash,
         (long)grid.center_support.last_observation_m1);
      TerminalHashMixText(hash,
         grid.center_support.applicability_reason);
      TerminalHashMixText(hash,
         grid.center_support.last_observation_reason);
      LP_HashMixULong(hash, LP_RevmaDiscoveryFormulaHash());
      return hash;
   }

   ulong EconomicPreCandidateStateHash(const int shadow_index, const int symbol_id)
   {
      LP_RevmaShadowGrid grid = m_grids[shadow_index][symbol_id];
      LP_RevmaShadowPortfolioState portfolio = m_portfolios[shadow_index];
      string payload = "gate108_pre_candidate_economic_state_v1";
      payload += "|symbol=" + IntegerToString(symbol_id);
      payload += "|active=" + IntegerToString(grid.active ? 1 : 0);
      payload += "|flat=" + IntegerToString(grid.flat ? 1 : 0);
      payload += "|direction=" + IntegerToString(grid.direction);
      payload += "|atoms=" + IntegerToString(grid.atom_count);
      payload += "|lots=" + DoubleToString(grid.total_lots, 8);
      payload += "|weighted=" + DoubleToString(grid.weighted_entry_price_lots, 12);
      payload += "|q0=" + DoubleToString(grid.q0, 12);
      payload += "|grid_q_cash=" + (string)grid.q_cash_minor;
      payload += "|grid_candidate_reservation=" + (string)grid.candidate_reservation_minor;
      payload += "|grid_reservation=" + (string)grid.reservation_minor;
      payload += "|grid_mark=" + (string)grid.marked_liquidation_minor;
      payload += "|grid_close_owner=" + IntegerToString(grid.close_owner);
      payload += "|grid_terminal=" + grid.terminal_reason;
      payload += "|grid_reentry_transition=" +
         IntegerToString(grid.reentry_requires_identity_transition ? 1 : 0);
      payload += "|portfolio_reservation=" + (string)portfolio.reservation_minor;
      payload += "|portfolio_margin=" + (string)portfolio.margin_minor;
      payload += "|portfolio_equity=" + (string)portfolio.branch_equity_minor;
      payload += "|portfolio_H=" + (string)portfolio.realized_harvest_minor;
      payload += "|portfolio_R=" + (string)portfolio.realized_nonharvest_minor;
      payload += "|portfolio_L=" + (string)portfolio.marked_liquidation_minor;
      payload += "|birth_shared_observation=" +
         (string)grid.birth_shared_observation_snapshot_hash;
      payload += "|close_owner=" + IntegerToString(portfolio.close_owner);
      return LP_HashString(payload);
   }

   void SortCandidates(const int shadow_index)
   {
      int count = m_candidate_count[shadow_index];
      for(int i = 1; i < count; i++)
      {
         LP_RevmaShadowCandidate value = m_candidates[shadow_index][i];
         int j = i - 1;
         while(j >= 0 && CandidateLess(value, m_candidates[shadow_index][j]))
         {
            m_candidates[shadow_index][j + 1] = m_candidates[shadow_index][j];
            j--;
         }
         m_candidates[shadow_index][j + 1] = value;
      }
   }

   bool ApplyCandidate(const int shadow_index, LP_RevmaShadowCandidate &candidate)
   {
      LP_RevmaShadowGrid grid = m_grids[shadow_index][candidate.symbol_id];
      bool adverse_add = !candidate.birth && candidate.candidate_type ==
         LP_REVMA_DISCOVERY_CANDIDATE_ADVERSE_ADD;
      bool favorable_add = !candidate.birth && candidate.candidate_type ==
         LP_REVMA_DISCOVERY_CANDIDATE_FAVORABLE_ADD;
      if(grid.atom_count >= 2147483647 || grid.peak_atom_count >= 2147483647 ||
         (!candidate.birth && !adverse_add && !favorable_add) ||
         (adverse_add && grid.adverse_add_count >= 2147483647) ||
         (favorable_add && grid.favorable_add_count >= 2147483647))
         return false;
      if(candidate.birth)
      {
         if(grid.active)
            return false;
         LP_ResetRevmaShadowGrid(grid, candidate.branch, candidate.symbol_id);
         grid.active = true;
         grid.flat = false;
         grid.direction = candidate.direction;
         grid.branch_grid_id = candidate.branch_grid_id;
         grid.branch_cycle_id = m_portfolios[shadow_index].cycle_id;
         grid.grid_generation = candidate.grid_generation;
         grid.shared_origin_id = candidate.shared_origin_id;
         grid.birth_pre_candidate_state_hash =
            candidate.pre_candidate_state_hash;
         grid.birth_matched_snapshot_hash = candidate.matched_snapshot_hash;
         grid.birth_shared_observation_snapshot_hash =
            candidate.shared_observation_snapshot_hash;
         grid.birth_m1_time = candidate.source_m1_time;
         grid.initial_history_boundary = candidate.initial_history_boundary;
         grid.q0 = candidate.q0;
         grid.strategy_identity_hash = candidate.strategy_identity_hash;
         grid.strategy_state_identity_hash =
            candidate.strategy_state_identity_hash;
         if(!LP_RevmaBuildDiscoveryMesh(candidate.q0, candidate.broker_tick_size,
            grid.discovery_mesh) ||
            !LP_RevmaInitializePathGeometry(candidate.p0, grid.discovery_mesh,
            candidate.source_m1_time, grid.path_geometry))
            return false;
         long c0_ticks = 0;
         if(!LP_RevmaPriceToTicks(candidate.c0, candidate.broker_tick_size,
            c0_ticks))
            return false;
         grid.birth_p0 = candidate.p0;
         grid.birth_stress_price = candidate.stress_price;
         grid.birth_c0 = candidate.c0;
         grid.birth_broker_tick_size = candidate.broker_tick_size;
         grid.birth_p0_ticks = grid.path_geometry.p0_ticks;
         grid.birth_c0_ticks = c0_ticks;
         grid.birth_bucket = LP_RevmaDiscoveryBirthBucket(
            candidate.direction, grid.birth_p0_ticks, grid.birth_c0_ticks);
         int birth_support_sign = LP_RevmaDirectedSupportSign(
            candidate.direction, grid.birth_c0_ticks, grid.birth_p0_ticks);
         grid.birth_center_alignment = birth_support_sign > 0 ?
            "CENTER_ALIGNED_V1" : "NOT_APPLICABLE_V1";
         if(!LP_RevmaDiscoveryBirthBucketValid(grid.birth_bucket))
            return false;
         grid.a_g_candidate_minor = candidate.a_g_candidate_minor;
         grid.a_g_minor = candidate.a_g_minor;
         grid.center_support = candidate.center_support_snapshot;
      }
      else if(!grid.active || grid.branch_grid_id != candidate.branch_grid_id ||
         grid.direction != candidate.direction ||
         grid.birth_p0 != candidate.p0 ||
         grid.birth_stress_price != candidate.stress_price ||
         grid.birth_c0 != candidate.c0 ||
         grid.q0 != candidate.q0 ||
         grid.birth_broker_tick_size != candidate.broker_tick_size ||
         candidate.source_m1_time <= grid.last_admission_m1_time)
         return false;

      double new_lots = grid.total_lots + candidate.lots;
      double new_weighted = grid.weighted_entry_price_lots + candidate.fill_price * candidate.lots;
      if(new_lots <= 0.0 || !MathIsValidNumber(new_lots) || !MathIsValidNumber(new_weighted))
         return false;
      long new_grid_reservation = 0;
      long new_grid_candidate_reservation = 0;
      long new_grid_q_cash = 0;
      long new_grid_margin = 0;
      long new_grid_mark = 0;
      long new_grid_close_cost = 0;
      long new_portfolio_mark = 0;
      long new_portfolio_close_cost = 0;
      if(!LP_RevmaSafeMinorAdd(grid.reservation_minor, candidate.committed_reservation_delta_minor, new_grid_reservation) ||
         !LP_RevmaSafeMinorAdd(grid.candidate_reservation_minor,
            candidate.incremental_reservation_minor, new_grid_candidate_reservation) ||
         !LP_RevmaSafeMinorAdd(grid.q_cash_minor, candidate.incremental_q_cash_minor, new_grid_q_cash) ||
         !LP_RevmaSafeMinorAdd(grid.margin_minor, candidate.incremental_margin_minor, new_grid_margin) ||
         !LP_RevmaSafeMinorAdd(grid.marked_liquidation_minor,
            candidate.incremental_liquidation_minor, new_grid_mark) ||
         !LP_RevmaSafeMinorAdd(grid.estimated_close_cost_minor,
            candidate.incremental_close_cost_minor, new_grid_close_cost) ||
         !LP_RevmaSafeMinorAdd(
            m_portfolios[shadow_index].marked_liquidation_minor,
            candidate.incremental_liquidation_minor, new_portfolio_mark) ||
         !LP_RevmaSafeMinorAdd(
            m_portfolios[shadow_index].estimated_close_cost_minor,
            candidate.incremental_close_cost_minor,
            new_portfolio_close_cost))
         return false;

      grid.atom_count++;
      if(grid.atom_count > grid.peak_atom_count)
         grid.peak_atom_count = grid.atom_count;
      if(adverse_add)
         grid.adverse_add_count++;
      else if(favorable_add)
         grid.favorable_add_count++;
      grid.total_lots = new_lots;
      grid.weighted_entry_price_lots = new_weighted;
      grid.average_entry_price = new_weighted / new_lots;
      if(grid.minimum_entry_price <= 0.0 || candidate.fill_price < grid.minimum_entry_price)
         grid.minimum_entry_price = candidate.fill_price;
      if(grid.maximum_entry_price <= 0.0 || candidate.fill_price > grid.maximum_entry_price)
         grid.maximum_entry_price = candidate.fill_price;
      grid.q_cash_minor = new_grid_q_cash;
      if(new_grid_q_cash > grid.peak_q_cash_minor)
         grid.peak_q_cash_minor = new_grid_q_cash;
      grid.candidate_reservation_minor = new_grid_candidate_reservation;
      grid.reservation_minor = new_grid_reservation;
      if(new_grid_reservation > grid.peak_reservation_minor)
         grid.peak_reservation_minor = new_grid_reservation;
      grid.reservation_overrun = new_grid_reservation > new_grid_candidate_reservation;
      grid.reservation_overrun_minor = grid.reservation_overrun ?
         new_grid_reservation - new_grid_candidate_reservation : 0;
      if(grid.reservation_overrun)
         grid.reservation_overrun_observed = true;
      if(grid.reservation_overrun_minor > grid.peak_reservation_overrun_minor)
         grid.peak_reservation_overrun_minor = grid.reservation_overrun_minor;
      grid.margin_minor = new_grid_margin;
         grid.marked_liquidation_minor = new_grid_mark;
      if(new_grid_mark > 0)
         grid.last_positive_liquidation_opportunity_m1 =
            candidate.source_m1_time;
      if(new_grid_mark < 0 && -new_grid_mark >
         grid.maximum_adverse_excursion_minor)
         grid.maximum_adverse_excursion_minor = -new_grid_mark;
      grid.estimated_close_cost_minor = new_grid_close_cost;
      grid.last_mark_m1_time = candidate.source_m1_time;
      if(new_grid_margin > grid.peak_margin_minor)
         grid.peak_margin_minor = new_grid_margin;
      grid.last_admission_m1_time = candidate.source_m1_time;
      grid.last_admission_identity = candidate.candidate_identity;
      if(candidate.branch == LP_REVMA_BRANCH_C)
         grid.center_support = candidate.center_support_snapshot;
      m_grids[shadow_index][candidate.symbol_id] = grid;
      m_portfolios[shadow_index].marked_liquidation_minor =
         new_portfolio_mark;
      m_portfolios[shadow_index].estimated_close_cost_minor =
         new_portfolio_close_cost;
      if(candidate.birth)
         m_grid_generation[shadow_index][candidate.symbol_id] =
            candidate.grid_generation;
      candidate.committed = true;
      candidate.decision = LP_REVMA_DISCOVERY_DECISION_ADMIT;
      candidate.decision_reason = "allocated_and_committed";
      return true;
   }

public:
   LP_RevmaShadowPortfolio()
   {
      m_matched_initialization_complete = false;
      for(int branch_index = 0;
         branch_index < LP_REVMA_SHADOW_BRANCH_COUNT; branch_index++)
         m_branch_opportunities_validated[branch_index] = false;
      m_causal_matching_open = true;
      m_matched_mutation_scope = false;
      m_first_causal_divergence_m1 = 0;
      m_first_causal_divergence_opportunity_id = 0;
      for(int shadow_index = 0; shadow_index < LP_REVMA_SHADOW_BRANCH_COUNT; shadow_index++)
      {
         int branch = shadow_index == 0 ? LP_REVMA_BRANCH_U : LP_REVMA_BRANCH_C;
         LP_ResetRevmaShadowPortfolioState(m_portfolios[shadow_index], branch);
         m_candidate_count[shadow_index] = 0;
         for(int symbol_id = 0; symbol_id < LP_SYMBOL_COUNT; symbol_id++)
         {
            m_grid_generation[shadow_index][symbol_id] = 0;
            LP_ResetRevmaShadowGrid(m_grids[shadow_index][symbol_id], branch, symbol_id);
            LP_ResetRevmaShadowCandidate(m_candidates[shadow_index][symbol_id]);
         }
      }
   }

   bool ResetForNewRun()
   {
      if(!CanResetForNewRun())
         return false;
      m_matched_initialization_complete = false;
      for(int branch_index = 0;
         branch_index < LP_REVMA_SHADOW_BRANCH_COUNT; branch_index++)
         m_branch_opportunities_validated[branch_index] = false;
      m_causal_matching_open = true;
      m_matched_mutation_scope = false;
      m_first_causal_divergence_m1 = 0;
      m_first_causal_divergence_opportunity_id = 0;
      for(int shadow_index = 0; shadow_index < LP_REVMA_SHADOW_BRANCH_COUNT;
         shadow_index++)
      {
         int branch = shadow_index == 0 ? LP_REVMA_BRANCH_U : LP_REVMA_BRANCH_C;
         LP_ResetRevmaShadowPortfolioState(m_portfolios[shadow_index], branch);
         m_candidate_count[shadow_index] = 0;
         for(int symbol_id = 0; symbol_id < LP_SYMBOL_COUNT; symbol_id++)
         {
            m_grid_generation[shadow_index][symbol_id] = 0;
            LP_ResetRevmaShadowGrid(m_grids[shadow_index][symbol_id], branch,
               symbol_id);
            LP_ResetRevmaShadowCandidate(
               m_candidates[shadow_index][symbol_id]);
         }
      }
      return true;
   }

   bool CanResetForNewRun()
   {
      if(m_matched_mutation_scope)
         return false;
      for(int shadow_index = 0; shadow_index < LP_REVMA_SHADOW_BRANCH_COUNT;
         shadow_index++)
      {
         if(m_portfolios[shadow_index].batch_open ||
            (m_portfolios[shadow_index].initialized &&
             (!AllGridsFlat(shadow_index) ||
              m_portfolios[shadow_index].reservation_minor != 0 ||
              m_portfolios[shadow_index].margin_minor != 0 ||
              m_portfolios[shadow_index].marked_liquidation_minor != 0 ||
              m_portfolios[shadow_index].estimated_close_cost_minor != 0)))
            return false;
      }
      return true;
   }

private:
   bool InitializeBranchInternal(const int branch, const ulong cycle_id, const long equity_reference_minor, const double money_quantum)
   {
      int shadow_index = LP_RevmaShadowIndex(branch);
      if(shadow_index < 0 || cycle_id == 0 || equity_reference_minor <= 0 ||
         money_quantum <= 0.0 || !MathIsValidNumber(money_quantum) ||
         !LP_RevmaDiscoveryCapitalMandateValid() ||
         m_portfolios[shadow_index].initialized)
         return false;
      LP_ResetRevmaShadowPortfolioState(m_portfolios[shadow_index], branch);
      long budget = 0;
      if(!LP_RevmaDiscoveryCapitalBudgetMinor(equity_reference_minor, budget) ||
         budget >= equity_reference_minor)
      {
         Invalidate(shadow_index, "capital_budget_minor_invalid");
         return false;
      }
      m_portfolios[shadow_index].valid = true;
      m_portfolios[shadow_index].initialized = true;
      m_portfolios[shadow_index].cycle_id = cycle_id;
      m_portfolios[shadow_index].money_quantum = money_quantum;
      m_portfolios[shadow_index].equity_reference_minor = equity_reference_minor;
      m_portfolios[shadow_index].capital_budget_minor = budget;
      m_portfolios[shadow_index].branch_equity_minor = equity_reference_minor;
      m_portfolios[shadow_index].equity_high_water_minor =
         equity_reference_minor;
      m_portfolios[shadow_index].run_equity_high_water_minor =
         equity_reference_minor;
      m_portfolios[shadow_index].invalid_reason = "";
      m_candidate_count[shadow_index] = 0;
      for(int symbol_id = 0; symbol_id < LP_SYMBOL_COUNT; symbol_id++)
         LP_ResetRevmaShadowGrid(m_grids[shadow_index][symbol_id], branch, symbol_id);
      return true;
   }

public:
   bool InitializeMatchedBranches(const ulong cycle_id, const long equity_reference_minor, const double money_quantum)
   {
      m_matched_initialization_complete = false;
      if(m_portfolios[0].initialized || m_portfolios[1].initialized)
         return false;
      bool u_initialized = InitializeBranchInternal(LP_REVMA_BRANCH_U, cycle_id,
         equity_reference_minor, money_quantum);
      bool c_initialized = u_initialized &&
         InitializeBranchInternal(LP_REVMA_BRANCH_C, cycle_id,
            equity_reference_minor, money_quantum);
      if(!u_initialized || !c_initialized)
      {
         Invalidate(0, "matched_initialization_transaction_failed");
         Invalidate(1, "matched_initialization_transaction_failed");
         return false;
      }
      LP_RevmaShadowPortfolioState u = m_portfolios[LP_RevmaShadowIndex(LP_REVMA_BRANCH_U)];
      LP_RevmaShadowPortfolioState c = m_portfolios[LP_RevmaShadowIndex(LP_REVMA_BRANCH_C)];
      if(u.cycle_id != c.cycle_id || u.money_quantum != c.money_quantum ||
         u.equity_reference_minor != c.equity_reference_minor ||
         u.capital_budget_minor != c.capital_budget_minor ||
         u.reservation_minor != c.reservation_minor ||
         u.branch_equity_minor != c.branch_equity_minor ||
         !FullPreDivergenceParity())
      {
         Invalidate(0, "matched_initialization_U_C_mismatch");
         Invalidate(1, "matched_initialization_U_C_mismatch");
         return false;
      }
      m_matched_initialization_complete = true;
      return true;
   }

   bool BeginClosedM1Batch(const int branch, const datetime source_m1_time)
   {
      int shadow_index = LP_RevmaShadowIndex(branch);
      if(shadow_index < 0 || !m_portfolios[shadow_index].valid ||
         !m_portfolios[shadow_index].initialized || m_portfolios[shadow_index].batch_open ||
         !m_matched_initialization_complete || m_matched_mutation_scope ||
         m_portfolios[shadow_index].last_close_authority_evaluation_m1_time !=
            source_m1_time ||
         m_portfolios[shadow_index].close_owner !=
            LP_REVMA_DISCOVERY_CLOSE_NONE ||
         m_portfolios[shadow_index].hard_risk_latched ||
         m_portfolios[shadow_index].cycle_reset_required ||
         source_m1_time <= m_portfolios[shadow_index].batch_m1_time)
      {
         if(shadow_index >= 0) Invalidate(shadow_index, "closed_m1_batch_begin_invalid");
         return false;
      }
      for(int symbol_id = 0; symbol_id < LP_SYMBOL_COUNT; symbol_id++)
      {
         LP_RevmaShadowGrid grid = m_grids[shadow_index][symbol_id];
         if(!grid.active)
            continue;
         bool skipped_eligible_harvest =
            grid.close_owner == LP_REVMA_DISCOVERY_CLOSE_NONE &&
            grid.excursion_completed && grid.marked_liquidation_minor >= 1;
         if(grid.last_mark_m1_time != source_m1_time ||
            grid.last_local_harvest_evaluation_m1_time != source_m1_time ||
            skipped_eligible_harvest)
         {
            Invalidate(shadow_index,
               "local_harvest_evaluation_precedence_not_proven");
            return false;
         }
      }
      m_portfolios[shadow_index].batch_open = true;
      m_portfolios[shadow_index].allocation_complete = false;
      m_portfolios[shadow_index].transitions_committed = false;
      m_portfolios[shadow_index].batch_m1_time = source_m1_time;
      m_portfolios[shadow_index].batch_hash = LP_HashString(LP_RevmaDiscoveryBranchId(branch));
      LP_HashMixLong(m_portfolios[shadow_index].batch_hash, (long)source_m1_time);
      m_candidate_count[shadow_index] = 0;
      m_branch_opportunities_validated[shadow_index] = false;
      for(int i = 0; i < LP_SYMBOL_COUNT; i++)
         LP_ResetRevmaShadowCandidate(m_candidates[shadow_index][i]);
      return true;
   }

private:
   ulong CenterSupportStateHash(const LP_RevmaCenterSupportState &state)
   {
      ulong hash = LP_HashString("gate108_center_support_state_v1");
      TerminalHashMixBool(hash, state.valid);
      TerminalHashMixBool(hash, state.applicable);
      TerminalHashMixBool(hash, state.adverse_adds_frozen);
      LP_HashMixInt(hash, state.direction);
      LP_HashMixLong(hash, state.p0_ticks);
      LP_HashMixLong(hash, state.c0_ticks);
      LP_HashMixLong(hash, state.previous_center_ticks);
      LP_HashMixLong(hash, state.current_center_ticks);
      TerminalHashMixDouble(hash, state.p0_raw);
      TerminalHashMixDouble(hash, state.c0_raw);
      TerminalHashMixDouble(hash, state.previous_center_raw);
      TerminalHashMixDouble(hash, state.current_center_raw);
      LP_HashMixInt(hash, state.support0_sign);
      LP_HashMixInt(hash, state.previous_support_sign);
      LP_HashMixInt(hash, state.current_support_sign);
      TerminalHashMixDouble(hash, state.q0);
      TerminalHashMixDouble(hash, state.current_q);
      TerminalHashMixDouble(hash, state.broker_tick_size);
      TerminalHashMixDouble(hash, state.support0_q);
      TerminalHashMixDouble(hash, state.current_support_q);
      TerminalHashMixDouble(hash, state.current_revision_q);
      TerminalHashMixDouble(hash, state.cumulative_signed_revision_q);
      TerminalHashMixDouble(hash, state.cumulative_absolute_revision_q);
      TerminalHashMixDouble(hash, state.minimum_support_q);
      TerminalHashMixDouble(hash, state.maximum_support_q);
      TerminalHashMixDouble(hash, state.regression_sum_x);
      TerminalHashMixDouble(hash, state.regression_sum_y);
      TerminalHashMixDouble(hash, state.regression_sum_x2);
      TerminalHashMixDouble(hash, state.regression_sum_xy);
      LP_HashMixInt(hash, state.center_update_count);
      LP_HashMixInt(hash, state.center_observation_count);
      LP_HashMixInt(hash, state.center_not_available_count);
      LP_HashMixInt(hash, state.adverse_adds_blocked_after_latch);
      LP_HashMixULong(hash, state.last_blocked_candidate_identity);
      LP_HashMixLong(hash, (long)state.last_blocked_candidate_m1);
      LP_HashMixInt(hash, state.birth_q_event_index);
      LP_HashMixInt(hash, state.current_q_event_index);
      LP_HashMixInt(hash, state.first_center_update_q_event_index);
      LP_HashMixInt(hash, state.last_center_update_q_event_index);
      LP_HashMixLong(hash, (long)state.birth_m1_time);
      LP_HashMixLong(hash, (long)state.first_center_update_m1);
      LP_HashMixLong(hash, (long)state.last_center_update_m1);
      LP_HashMixInt(hash, state.first_center_update_observation_index);
      LP_HashMixInt(hash, state.last_center_update_observation_index);
      LP_HashMixLong(hash, (long)state.latch_m1_time);
      LP_HashMixLong(hash, (long)state.last_observation_m1);
      TerminalHashMixText(hash, state.applicability_reason);
      TerminalHashMixText(hash, state.last_observation_reason);
      return hash;
   }

public:
   bool PrepareCenterPolicy(LP_RevmaShadowCandidate &candidate)
   {
      int shadow_index = LP_RevmaShadowIndex(candidate.branch);
      if(shadow_index < 0 || candidate.symbol_id < 0 || candidate.symbol_id >= LP_SYMBOL_COUNT ||
         !candidate.valid || !m_portfolios[shadow_index].valid ||
         !LP_RevmaDiscoveryCandidateTypeValid(candidate.candidate_type) ||
         candidate.source_m1_time != m_portfolios[shadow_index].batch_m1_time)
      {
         if(shadow_index >= 0) Invalidate(shadow_index, "center_policy_prepare_invariant_failure");
         return false;
      }
      candidate.center_policy_checked = true;
      if(candidate.branch == LP_REVMA_BRANCH_U)
      {
         if(candidate.birth)
         {
            if(!LP_RevmaInitializeCenterSupport(candidate.direction,
                  candidate.p0, candidate.c0, candidate.q0,
                  candidate.broker_tick_size, candidate.q_event_count,
                  candidate.source_m1_time,
                  candidate.center_support_snapshot))
               return false;
         }
         else
         {
            LP_RevmaShadowGrid existing =
               m_grids[shadow_index][candidate.symbol_id];
            if(!existing.active || !existing.center_support.valid ||
               existing.center_support.last_observation_m1 !=
                  candidate.source_m1_time)
               return false;
            candidate.center_support_snapshot = existing.center_support;
         }
         candidate.center_policy_applies = false;
         candidate.center_add_authorized = true;
         candidate.center_policy_reason = "U_CENTER_AUTHORITY_FORBIDDEN";
         return true;
      }

      if(candidate.birth)
      {
         if(!LP_RevmaInitializeCenterSupport(candidate.direction, candidate.p0, candidate.c0,
            candidate.q0, candidate.broker_tick_size, candidate.q_event_count,
            candidate.source_m1_time,
            candidate.center_support_snapshot))
         {
            candidate.center_policy_reason = "CENTER_NOT_AVAILABLE";
            return false;
         }
      }
      else
      {
         LP_RevmaShadowGrid existing = m_grids[shadow_index][candidate.symbol_id];
         if(!existing.active || !existing.center_support.valid ||
            existing.center_support.last_observation_m1 !=
               candidate.source_m1_time)
         {
            Invalidate(shadow_index,
               "C_center_state_missing_or_stale_for_add");
            return false;
         }
         candidate.center_support_snapshot = existing.center_support;
      }
      candidate.center_policy_applies = candidate.center_support_snapshot.applicable;
      candidate.center_add_authorized = LP_RevmaCenterAuthorizesCandidate(
         candidate.candidate_type,
         candidate.center_support_snapshot,
         candidate.center_policy_reason
      );
      return candidate.center_support_snapshot.valid;
   }

   bool ObserveCGridCenter(
      const int symbol_id,
      const double current_center,
      const double current_q,
      const double broker_tick_size,
      const int current_q_event_count,
      const datetime source_m1_time
   )
   {
      int shadow_index = LP_RevmaShadowIndex(LP_REVMA_BRANCH_C);
      if(symbol_id < 0 || symbol_id >= LP_SYMBOL_COUNT ||
         !m_portfolios[shadow_index].valid || m_portfolios[shadow_index].batch_open ||
         !m_grids[shadow_index][symbol_id].active)
      {
         Invalidate(shadow_index, "C_center_observation_grid_invalid");
         return false;
      }
      LP_RevmaCenterSupportState state = m_grids[shadow_index][symbol_id].center_support;
      if(!LP_RevmaObserveCenterSupport(current_center, current_q, broker_tick_size,
         current_q_event_count, source_m1_time, state))
      {
         Invalidate(shadow_index, "C_center_observation_state_invalid");
         return false;
      }
      m_grids[shadow_index][symbol_id].center_support = state;
      return true;
   }

   bool ObserveUGridCenter(
      const int symbol_id,
      const double current_center,
      const double current_q,
      const double broker_tick_size,
      const int current_q_event_count,
      const datetime source_m1_time)
   {
      int shadow_index = LP_RevmaShadowIndex(LP_REVMA_BRANCH_U);
      if(!IndividualMutationAuthorized() || symbol_id < 0 ||
         symbol_id >= LP_SYMBOL_COUNT ||
         !m_portfolios[shadow_index].valid ||
         m_portfolios[shadow_index].batch_open ||
         !m_grids[shadow_index][symbol_id].active)
         return false;
      LP_RevmaCenterSupportState state =
         m_grids[shadow_index][symbol_id].center_support;
      if(!LP_RevmaObserveCenterSupport(current_center, current_q,
            broker_tick_size, current_q_event_count, source_m1_time, state))
         return false;
      // U records policy-neutral center diagnostics only. The signed-center
      // latch is trading authority exclusive to C.
      state.adverse_adds_frozen = false;
      state.latch_m1_time = 0;
      state.adverse_adds_blocked_after_latch = 0;
      state.last_blocked_candidate_identity = 0;
      state.last_blocked_candidate_m1 = 0;
      m_grids[shadow_index][symbol_id].center_support = state;
      return true;
   }

   bool ObserveMatchedGridCenters(
      const int symbol_id,
      const double current_center,
      const double current_q,
      const double broker_tick_size,
      const int current_q_event_count,
      const datetime source_m1_time)
   {
      if(!BeginMatchedMutationScope())
         return false;
      bool u_ok = ObserveUGridCenter(symbol_id, current_center, current_q,
         broker_tick_size, current_q_event_count, source_m1_time);
      bool c_ok = u_ok && ObserveCGridCenter(symbol_id, current_center,
         current_q, broker_tick_size, current_q_event_count,
         source_m1_time);
      return EndMatchedMutationScope(u_ok && c_ok, symbol_id, false);
   }

   bool ObserveMatchedCGridCenter(
      const int symbol_id,
      const double current_center,
      const double current_q,
      const double broker_tick_size,
      const int current_q_event_count,
      const datetime source_m1_time)
   {
      if(!m_causal_matching_open)
         return ObserveCGridCenter(symbol_id, current_center, current_q,
            broker_tick_size, current_q_event_count, source_m1_time);
      if(!BeginMatchedMutationScope())
         return false;
      bool operation_ok = ObserveCGridCenter(symbol_id, current_center,
         current_q, broker_tick_size, current_q_event_count,
         source_m1_time);
      return EndMatchedMutationScope(operation_ok, symbol_id, true);
   }

   bool AddCandidate(const LP_RevmaShadowCandidate &candidate)
   {
      int shadow_index = LP_RevmaShadowIndex(candidate.branch);
      if(shadow_index < 0 || candidate.symbol_id < 0 ||
          candidate.symbol_id >= LP_SYMBOL_COUNT)
         return false;
      if(candidate.incremental_close_cost_minor < 0 ||
         candidate.incremental_close_cost_minor > LP_REVMA_MINOR_ABS_LIMIT ||
         candidate.incremental_liquidation_minor > LP_REVMA_MINOR_ABS_LIMIT ||
         candidate.incremental_liquidation_minor < -LP_REVMA_MINOR_ABS_LIMIT)
      {
         Invalidate(shadow_index, "candidate_immediate_liability_bounds_invalid");
         return false;
      }
      LP_RevmaShadowCandidate canonical_policy = candidate;
      if(!PrepareCenterPolicy(canonical_policy))
      {
         Invalidate(shadow_index, "candidate_center_policy_recompute_failed");
         return false;
      }
      ulong supplied_center_state_hash = CenterSupportStateHash(
         candidate.center_support_snapshot);
      ulong canonical_center_state_hash = CenterSupportStateHash(
         canonical_policy.center_support_snapshot);
      bool center_policy_identity_match = candidate.center_policy_checked &&
         canonical_policy.center_policy_checked &&
         candidate.center_policy_applies ==
            canonical_policy.center_policy_applies &&
         candidate.center_add_authorized ==
            canonical_policy.center_add_authorized &&
         candidate.center_policy_reason ==
            canonical_policy.center_policy_reason &&
         supplied_center_state_hash != 0 &&
         supplied_center_state_hash == canonical_center_state_hash;
      ulong expected_snapshot = LP_RevmaDiscoveryMatchedSnapshotIdentity(
         candidate.symbol_id, candidate.source_m1_time, candidate.direction,
         candidate.candidate_type, candidate.pre_candidate_state_hash,
         candidate.strategy_identity_hash, candidate.q_event_count,
         candidate.q0, candidate.decision_price, candidate.stress_price,
         candidate.fill_price, candidate.p0, candidate.c0,
         candidate.broker_tick_size, candidate.a_g_candidate_minor,
         candidate.a_g_minor, candidate.incremental_margin_minor,
         candidate.incremental_liquidation_minor,
         candidate.incremental_close_cost_minor);
      LP_RevmaShadowGrid existing =
         m_grids[shadow_index][candidate.symbol_id];
      long expected_generation = existing.grid_generation;
      if(candidate.birth)
      {
         if(m_grid_generation[shadow_index][candidate.symbol_id] >=
            LP_REVMA_MINOR_ABS_LIMIT)
         {
            Invalidate(shadow_index, "grid_generation_overflow");
            return false;
         }
         expected_generation =
            m_grid_generation[shadow_index][candidate.symbol_id] + 1;
      }
      ulong expected_grid_id = LP_RevmaDiscoveryGridIdentity(
         candidate.branch, candidate.symbol_id, expected_generation,
         m_portfolios[shadow_index].cycle_id,
         candidate.birth ? candidate.source_m1_time : existing.birth_m1_time,
         candidate.birth ? candidate.strategy_identity_hash :
            existing.strategy_identity_hash);
      ulong expected_origin = 0;
      if(candidate.birth)
         expected_origin = LP_RevmaDiscoverySharedOriginIdentity(
            candidate.symbol_id, candidate.source_m1_time,
            candidate.pre_candidate_state_hash, candidate.matched_snapshot_hash);
      else
         expected_origin = existing.shared_origin_id;
      ulong expected_opportunity = m_causal_matching_open ?
         LP_RevmaDiscoveryOpportunityIdentity(expected_origin,
            candidate.symbol_id, candidate.source_m1_time,
            candidate.candidate_type, candidate.pre_candidate_state_hash,
            candidate.matched_snapshot_hash) : 0;
      if(!m_portfolios[shadow_index].valid || !m_portfolios[shadow_index].batch_open ||
         m_portfolios[shadow_index].allocation_complete || !candidate.valid ||
         candidate.source_m1_time != m_portfolios[shadow_index].batch_m1_time ||
         candidate.branch_grid_id == 0 || candidate.candidate_identity == 0 ||
         candidate.candidate_identity != LP_RevmaDiscoveryAdmissionIdentity(candidate.branch, candidate.branch_grid_id, candidate.source_m1_time) ||
         candidate.grid_generation != expected_generation ||
         candidate.branch_grid_id != expected_grid_id ||
         (candidate.direction != LP_SIDE_LONG && candidate.direction != LP_SIDE_SHORT) ||
         candidate.decision_price <= 0.0 ||
         !MathIsValidNumber(candidate.decision_price) ||
         candidate.stress_price <= 0.0 ||
         !MathIsValidNumber(candidate.stress_price) ||
         candidate.fill_price <= 0.0 || !MathIsValidNumber(candidate.fill_price) ||
         candidate.q0 <= 0.0 || !MathIsValidNumber(candidate.q0) ||
         candidate.q_event_count <= 0 ||
         candidate.lots != LP_REVMA_DISCOVERY_ATOM_LOTS ||
         candidate.a_g_candidate_minor <= 0 || candidate.a_g_minor <= 0 ||
         candidate.incremental_margin_minor <= 0 ||
         candidate.incremental_close_cost_minor < 0 ||
          candidate.incremental_liquidation_minor >
             -candidate.incremental_close_cost_minor ||
          candidate.concentration_q_cash_minor != 0 ||
          candidate.concentration_currency_id != -1 ||
          candidate.initial_history_boundary <= 0 ||
          candidate.initial_history_boundary > candidate.source_m1_time ||
         candidate.strategy_identity_hash == 0 ||
         candidate.strategy_state_identity_hash == 0 ||
         !LP_RevmaDiscoveryCandidateTypeValid(candidate.candidate_type) ||
         !center_policy_identity_match ||
         candidate.pre_candidate_state_hash == 0 ||
         candidate.pre_candidate_state_hash != EconomicPreCandidateStateHash(shadow_index, candidate.symbol_id) ||
         candidate.matched_snapshot_hash == 0 ||
         candidate.matched_snapshot_hash != expected_snapshot ||
         candidate.shared_observation_snapshot_hash == 0 ||
         (candidate.shared_origin_id != expected_origin) ||
         (m_causal_matching_open &&
          candidate.opportunity_id != expected_opportunity) ||
         (!m_causal_matching_open && candidate.opportunity_id != 0) ||
         (candidate.birth && candidate.candidate_type != LP_REVMA_DISCOVERY_CANDIDATE_BIRTH) ||
         (!candidate.birth && candidate.candidate_type == LP_REVMA_DISCOVERY_CANDIDATE_BIRTH) ||
         (candidate.birth && candidate.decision_price != candidate.p0) ||
         (!candidate.birth &&
           (candidate.a_g_candidate_minor != existing.a_g_candidate_minor ||
            candidate.a_g_minor != existing.a_g_minor ||
            candidate.stress_price != existing.birth_stress_price)) ||
         (candidate.branch == LP_REVMA_BRANCH_U && (!candidate.center_add_authorized ||
            candidate.center_policy_applies)) ||
         (candidate.branch == LP_REVMA_BRANCH_C &&
          (!candidate.center_support_snapshot.valid ||
           candidate.center_support_snapshot.last_observation_m1 !=
              candidate.source_m1_time)))
      {
         if(shadow_index >= 0) Invalidate(shadow_index, "shadow_candidate_invariant_failure");
         return false;
      }
      if(!candidate.birth)
      {
         long decision_ticks = 0;
         long minimum_entry_ticks = 0;
         long maximum_entry_ticks = 0;
         long cell_ticks = existing.discovery_mesh.discovery_cell_ticks;
         if(cell_ticks <= 0 ||
            !LP_RevmaPriceToTicks(candidate.decision_price,
               existing.birth_broker_tick_size, decision_ticks) ||
            !LP_RevmaPriceToTicks(existing.minimum_entry_price,
               existing.birth_broker_tick_size, minimum_entry_ticks) ||
            !LP_RevmaPriceToTicks(existing.maximum_entry_price,
               existing.birth_broker_tick_size, maximum_entry_ticks) ||
            minimum_entry_ticks > maximum_entry_ticks ||
            maximum_entry_ticks > LP_REVMA_GEOMETRY_ABS_LIMIT - cell_ticks)
         {
            Invalidate(shadow_index,
               "candidate_decision_price_geometry_invalid");
            return false;
         }
         long lower_threshold_ticks = minimum_entry_ticks > cell_ticks ?
            minimum_entry_ticks - cell_ticks : 0;
         long upper_threshold_ticks = maximum_entry_ticks + cell_ticks;
         bool adverse_threshold = candidate.direction == LP_SIDE_LONG ?
            (lower_threshold_ticks > 0 &&
             decision_ticks <= lower_threshold_ticks) :
            decision_ticks >= upper_threshold_ticks;
         bool favorable_threshold = candidate.direction == LP_SIDE_LONG ?
            decision_ticks >= upper_threshold_ticks :
            (lower_threshold_ticks > 0 &&
             decision_ticks <= lower_threshold_ticks);
         int expected_candidate_type = adverse_threshold ?
            LP_REVMA_DISCOVERY_CANDIDATE_ADVERSE_ADD :
            (favorable_threshold ?
             LP_REVMA_DISCOVERY_CANDIDATE_FAVORABLE_ADD :
             LP_REVMA_DISCOVERY_CANDIDATE_NONE);
         if(expected_candidate_type == LP_REVMA_DISCOVERY_CANDIDATE_NONE ||
            candidate.candidate_type != expected_candidate_type)
         {
            Invalidate(shadow_index,
               "candidate_add_threshold_or_classification_invalid");
            return false;
         }
      }
      for(int i = 0; i < m_candidate_count[shadow_index]; i++)
      {
         if(m_candidates[shadow_index][i].symbol_id == candidate.symbol_id ||
            m_candidates[shadow_index][i].candidate_identity == candidate.candidate_identity)
         {
            Invalidate(shadow_index, "duplicate_symbol_or_admission_identity_in_batch");
            return false;
         }
      }
      if(m_candidate_count[shadow_index] >= LP_SYMBOL_COUNT)
      {
         Invalidate(shadow_index, "shadow_candidate_capacity_exhausted");
         return false;
      }
      if(m_branch_opportunities_validated[shadow_index] ||
         m_portfolios[shadow_index].close_owner != LP_REVMA_DISCOVERY_CLOSE_NONE ||
         m_portfolios[shadow_index].hard_risk_latched)
      {
         Invalidate(shadow_index, "candidate_added_after_batch_seal_or_close_authority");
         return false;
      }
         if((candidate.birth && (existing.active ||
            !ReentryEligibleInternal(shadow_index, candidate.symbol_id,
               candidate.source_m1_time,
               candidate.strategy_state_identity_hash))) ||
         (!candidate.birth && (!existing.active || existing.flat ||
          existing.branch_grid_id != candidate.branch_grid_id ||
          existing.direction != candidate.direction ||
          existing.close_owner != LP_REVMA_DISCOVERY_CLOSE_NONE ||
          candidate.source_m1_time <= existing.last_admission_m1_time)))
      {
         Invalidate(shadow_index, "candidate_grid_lifecycle_mismatch");
         return false;
      }
      LP_RevmaShadowCandidate normalized;
      LP_ResetRevmaShadowCandidate(normalized);
      if(!NormalizeCandidateReservation(shadow_index, candidate, normalized))
      {
         Invalidate(shadow_index, "candidate_reservation_formula_invalid");
         return false;
      }
      m_candidates[shadow_index][m_candidate_count[shadow_index]] = normalized;
      m_candidate_count[shadow_index]++;
      return RecordCandidateBuilt(shadow_index);
   }

   ulong PreCandidateStateHash(const int branch, const int symbol_id)
   {
      int shadow_index = LP_RevmaShadowIndex(branch);
      if(shadow_index < 0 || symbol_id < 0 || symbol_id >= LP_SYMBOL_COUNT ||
         !m_portfolios[shadow_index].valid)
         return 0;
      return EconomicPreCandidateStateHash(shadow_index, symbol_id);
   }

   bool ValidateMatchedOpportunities()
   {
      if(!m_causal_matching_open)
         return false;
      m_branch_opportunities_validated[0] = false;
      m_branch_opportunities_validated[1] = false;
      if(!m_portfolios[0].valid || !m_portfolios[1].valid ||
         !m_portfolios[0].batch_open || !m_portfolios[1].batch_open ||
         m_portfolios[0].batch_m1_time != m_portfolios[1].batch_m1_time)
      {
         Invalidate(0, "matched_opportunity_batch_mismatch");
         Invalidate(1, "matched_opportunity_batch_mismatch");
         return false;
      }
      for(int branch_index = 0; branch_index < LP_REVMA_SHADOW_BRANCH_COUNT; branch_index++)
      {
         int other_index = branch_index == 0 ? 1 : 0;
         for(int i = 0; i < m_candidate_count[branch_index]; i++)
         {
            LP_RevmaShadowCandidate candidate = m_candidates[branch_index][i];
            ulong other_pre_candidate_state_hash =
               EconomicPreCandidateStateHash(other_index, candidate.symbol_id);
            bool branch_states_identical = candidate.pre_candidate_state_hash ==
               other_pre_candidate_state_hash;
            bool counterpart_found = false;
            bool counterpart_identical = false;
            for(int j = 0; j < m_candidate_count[other_index]; j++)
            {
               LP_RevmaShadowCandidate other = m_candidates[other_index][j];
               if(other.symbol_id != candidate.symbol_id ||
                  other.source_m1_time != candidate.source_m1_time ||
                  other.candidate_type != candidate.candidate_type)
                  continue;
               counterpart_found = true;
               bool snapshots_equal = MatchedCandidateSnapshotsEqual(candidate, other);
               counterpart_identical = false;
               if(snapshots_equal)
               {
                  LP_RevmaShadowGrid candidate_grid =
                     m_grids[branch_index][candidate.symbol_id];
                  LP_RevmaShadowGrid other_grid =
                     m_grids[other_index][candidate.symbol_id];
                  ulong expected_origin = candidate.birth ?
                     LP_RevmaDiscoverySharedOriginIdentity(
                        candidate.symbol_id, candidate.source_m1_time,
                        candidate.pre_candidate_state_hash,
                        candidate.matched_snapshot_hash) :
                     candidate_grid.shared_origin_id;
                  ulong expected_opportunity = LP_RevmaDiscoveryOpportunityIdentity(
                     expected_origin,
                     candidate.symbol_id,
                     candidate.source_m1_time,
                     candidate.candidate_type,
                     candidate.pre_candidate_state_hash,
                     candidate.matched_snapshot_hash
                  );
                  counterpart_identical = candidate.shared_origin_id == expected_origin &&
                     other.shared_origin_id == expected_origin &&
                     candidate.opportunity_id == expected_opportunity &&
                     other.opportunity_id == expected_opportunity &&
                     (candidate.birth ||
                      (expected_origin != 0 &&
                       other_grid.shared_origin_id == expected_origin));
               }
               else
                  counterpart_identical = candidate.shared_origin_id == 0 &&
                     candidate.opportunity_id == 0 &&
                     other.shared_origin_id == 0 && other.opportunity_id == 0;
               break;
            }
            if((counterpart_found && !counterpart_identical) ||
               (!counterpart_found && branch_states_identical) ||
               (!counterpart_found && !branch_states_identical &&
                  (candidate.shared_origin_id != 0 || candidate.opportunity_id != 0)))
            {
               Invalidate(0, "matched_causal_opportunity_not_identical");
               Invalidate(1, "matched_causal_opportunity_not_identical");
               return false;
            }
         }
      }
      m_branch_opportunities_validated[0] = true;
      m_branch_opportunities_validated[1] = true;
      return true;
   }

   bool ValidateBranchOpportunities(const int branch)
   {
      int shadow_index = LP_RevmaShadowIndex(branch);
      if(shadow_index < 0)
         return false;
      if(m_causal_matching_open)
         return ValidateMatchedOpportunities();
      if(!m_portfolios[shadow_index].valid ||
         !m_portfolios[shadow_index].batch_open ||
         m_branch_opportunities_validated[shadow_index])
      {
         if(shadow_index >= 0)
            Invalidate(shadow_index,
               "post_divergence_branch_validation_state_invalid");
         return false;
      }
      for(int i = 0; i < m_candidate_count[shadow_index]; i++)
      {
         if(m_candidates[shadow_index][i].shared_origin_id == 0 ||
            m_candidates[shadow_index][i].opportunity_id != 0)
         {
            Invalidate(shadow_index,
               "post_divergence_grid_lineage_or_opportunity_invalid");
            return false;
         }
      }
      m_branch_opportunities_validated[shadow_index] = true;
      return true;
   }

   bool SortAndAllocate(const int branch)
   {
      int shadow_index = LP_RevmaShadowIndex(branch);
      if(shadow_index < 0 || !m_portfolios[shadow_index].valid ||
         !m_portfolios[shadow_index].batch_open || m_portfolios[shadow_index].allocation_complete ||
         !m_branch_opportunities_validated[shadow_index] ||
         m_portfolios[shadow_index].close_owner != LP_REVMA_DISCOVERY_CLOSE_NONE ||
         m_portfolios[shadow_index].hard_risk_latched)
      {
         if(shadow_index >= 0) Invalidate(shadow_index, "shadow_allocation_state_invalid");
         return false;
      }
      SortCandidates(shadow_index);
      long projected_committed_reservation = m_portfolios[shadow_index].reservation_minor;
      long allocated_margin = m_portfolios[shadow_index].margin_minor;
      long projected_equity = m_portfolios[shadow_index].branch_equity_minor;
      long projected_currency_q_cash[LP_CCY_COUNT];
      for(int ccy = 0; ccy < LP_CCY_COUNT; ccy++)
         projected_currency_q_cash[ccy] =
            m_portfolios[shadow_index].currency_q_cash_minor[ccy];
      if(projected_committed_reservation < 0 || allocated_margin < 0 ||
         projected_equity > LP_REVMA_MINOR_ABS_LIMIT ||
         projected_equity < -LP_REVMA_MINOR_ABS_LIMIT)
      {
         Invalidate(shadow_index, "preallocation_ledger_bounds_inconsistent");
         return false;
      }
      for(int i = 0; i < m_candidate_count[shadow_index]; i++)
      {
         int candidate_base_ccy = -1;
         int candidate_quote_ccy = -1;
         LP_CanonicalBaseQuote(
            LP_CanonicalSymbol(m_candidates[shadow_index][i].symbol_id),
            candidate_base_ccy, candidate_quote_ccy);
         long prospective_base = 0;
         long prospective_quote = 0;
         if(candidate_base_ccy < 0 || candidate_base_ccy >= LP_CCY_COUNT ||
            candidate_quote_ccy < 0 ||
            candidate_quote_ccy >= LP_CCY_COUNT ||
            candidate_base_ccy == candidate_quote_ccy ||
            !LP_RevmaSafeMinorAdd(
               projected_currency_q_cash[candidate_base_ccy],
               m_candidates[shadow_index][i].incremental_q_cash_minor,
               prospective_base) ||
            !LP_RevmaSafeMinorAdd(
               projected_currency_q_cash[candidate_quote_ccy],
               m_candidates[shadow_index][i].incremental_q_cash_minor,
               prospective_quote))
         {
            Invalidate(shadow_index,
               "candidate_concentration_projection_failed");
            return false;
         }
         long prospective_concentration = 0;
         int prospective_concentration_ccy = -1;
         for(int ccy = 0; ccy < LP_CCY_COUNT; ccy++)
         {
            long value = ccy == candidate_base_ccy ? prospective_base :
               (ccy == candidate_quote_ccy ? prospective_quote :
                projected_currency_q_cash[ccy]);
            if(value > prospective_concentration)
            {
               prospective_concentration = value;
               prospective_concentration_ccy = ccy;
            }
         }
         m_candidates[shadow_index][i].concentration_q_cash_minor =
            prospective_concentration;
         m_candidates[shadow_index][i].concentration_currency_id =
            prospective_concentration_ccy;
         LP_HashMixLong(m_portfolios[shadow_index].batch_hash,
            prospective_concentration);
         LP_HashMixInt(m_portfolios[shadow_index].batch_hash,
            prospective_concentration_ccy);
         if(m_portfolios[shadow_index].capacity_overrun ||
            projected_committed_reservation >
               m_portfolios[shadow_index].capital_budget_minor)
         {
            m_candidates[shadow_index][i].allocated = false;
            m_candidates[shadow_index][i].decision = LP_REVMA_DISCOVERY_DECISION_REJECT;
            m_candidates[shadow_index][i].decision_reason =
               "fill_reconciliation_capacity_overrun_blocks_new_exposure";
            RecordInfeasibility(shadow_index,
               m_candidates[shadow_index][i].decision_reason,
               m_candidates[shadow_index][i].source_m1_time);
            LP_HashMixULong(m_portfolios[shadow_index].batch_hash,
               m_candidates[shadow_index][i].candidate_identity);
            LP_HashMixInt(m_portfolios[shadow_index].batch_hash,
               m_candidates[shadow_index][i].decision);
            continue;
         }
         if(!m_candidates[shadow_index][i].center_add_authorized)
         {
            if(m_candidates[shadow_index][i].branch != LP_REVMA_BRANCH_C ||
               m_candidates[shadow_index][i].candidate_type != LP_REVMA_DISCOVERY_CANDIDATE_ADVERSE_ADD ||
               !m_candidates[shadow_index][i].center_policy_applies ||
               !m_candidates[shadow_index][i].center_support_snapshot.adverse_adds_frozen)
            {
               Invalidate(shadow_index, "unauthorized_center_rejection_shape");
               return false;
            }
            m_candidates[shadow_index][i].allocated = false;
            m_candidates[shadow_index][i].decision = LP_REVMA_DISCOVERY_DECISION_REJECT;
            m_candidates[shadow_index][i].decision_reason = "signed_center_support_adverse_adds_frozen";
            if(!LP_RevmaRecordCenterBlocked(
               m_candidates[shadow_index][i].candidate_identity,
               m_candidates[shadow_index][i].source_m1_time,
               m_candidates[shadow_index][i].center_support_snapshot))
            {
               Invalidate(shadow_index, "center_blocked_candidate_record_failed");
               return false;
            }
            // Policy metadata advances, but inventory, money, reservation,
            // capacity, and admission identity remain untouched.
            m_grids[shadow_index][m_candidates[shadow_index][i].symbol_id].center_support =
               m_candidates[shadow_index][i].center_support_snapshot;
            LP_HashMixULong(m_portfolios[shadow_index].batch_hash,
               m_candidates[shadow_index][i].candidate_identity);
            LP_HashMixInt(m_portfolios[shadow_index].batch_hash,
               m_candidates[shadow_index][i].decision);
            continue;
         }
         long candidate_total = 0;
         long candidate_committed_total = 0;
         long candidate_margin_total = 0;
         long candidate_projected_equity = 0;
         if(!LP_RevmaSafeMinorAdd(projected_committed_reservation,
            m_candidates[shadow_index][i].incremental_reservation_minor, candidate_total) ||
            !LP_RevmaSafeMinorAdd(projected_committed_reservation,
            m_candidates[shadow_index][i].committed_reservation_delta_minor,
            candidate_committed_total) ||
            !LP_RevmaSafeMinorAdd(allocated_margin,
            m_candidates[shadow_index][i].incremental_margin_minor,
            candidate_margin_total) ||
            !LP_RevmaSafeMinorAdd(projected_equity,
            m_candidates[shadow_index][i].incremental_liquidation_minor,
            candidate_projected_equity))
         {
            Invalidate(shadow_index, "allocation_capacity_or_equity_arithmetic_overflow");
            return false;
         }
         if(candidate_total <= m_portfolios[shadow_index].capital_budget_minor &&
            candidate_projected_equity >= 0 &&
            candidate_margin_total <= candidate_projected_equity)
         {
            m_candidates[shadow_index][i].allocated = true;
            m_candidates[shadow_index][i].decision = LP_REVMA_DISCOVERY_DECISION_ADMIT;
            m_candidates[shadow_index][i].decision_reason = "capacity_allocated";
            projected_committed_reservation = candidate_committed_total;
            allocated_margin = candidate_margin_total;
            projected_equity = candidate_projected_equity;
            projected_currency_q_cash[candidate_base_ccy] =
               prospective_base;
            projected_currency_q_cash[candidate_quote_ccy] =
               prospective_quote;
         }
         else
         {
            m_candidates[shadow_index][i].allocated = false;
            m_candidates[shadow_index][i].decision = LP_REVMA_DISCOVERY_DECISION_REJECT;
            m_candidates[shadow_index][i].decision_reason =
               candidate_total > m_portfolios[shadow_index].capital_budget_minor ?
               "capital_budget_capacity_exhausted" :
               (candidate_projected_equity < 0 ?
                "projected_equity_exhausted_by_immediate_liability" :
                "projected_post_liquidation_margin_capacity_exhausted");
            RecordInfeasibility(shadow_index,
               m_candidates[shadow_index][i].decision_reason,
               m_candidates[shadow_index][i].source_m1_time);
         }
         LP_HashMixULong(m_portfolios[shadow_index].batch_hash,
            m_candidates[shadow_index][i].candidate_identity);
         LP_HashMixInt(m_portfolios[shadow_index].batch_hash,
            m_candidates[shadow_index][i].decision);
      }
      LP_HashMixULong(m_portfolios[shadow_index].batch_hash,
         LP_HashString("gate108_all_candidate_decisions_v1"));
      for(int decision_index = 0;
         decision_index < m_candidate_count[shadow_index]; decision_index++)
      {
         LP_RevmaShadowCandidate decided = m_candidates[shadow_index][decision_index];
         LP_HashMixULong(m_portfolios[shadow_index].batch_hash, decided.candidate_identity);
         LP_HashMixInt(m_portfolios[shadow_index].batch_hash, decided.decision);
         LP_HashMixLong(m_portfolios[shadow_index].batch_hash,
            decided.incremental_reservation_minor);
         LP_HashMixLong(m_portfolios[shadow_index].batch_hash,
            decided.committed_reservation_delta_minor);
         LP_HashMixLong(m_portfolios[shadow_index].batch_hash,
            decided.incremental_margin_minor);
         LP_HashMixULong(m_portfolios[shadow_index].batch_hash,
            LP_HashString(decided.decision_reason));
      }
      if(!RecordCandidateDecisions(shadow_index))
         return false;
      m_portfolios[shadow_index].allocation_complete = true;
      return true;
   }

   bool CommitTransitions(const int branch)
   {
      int shadow_index = LP_RevmaShadowIndex(branch);
      if(shadow_index < 0 || !m_portfolios[shadow_index].valid ||
         !m_portfolios[shadow_index].batch_open || !m_portfolios[shadow_index].allocation_complete ||
         m_portfolios[shadow_index].transitions_committed ||
         m_portfolios[shadow_index].close_owner != LP_REVMA_DISCOVERY_CLOSE_NONE ||
         m_portfolios[shadow_index].hard_risk_latched)
      {
         if(shadow_index >= 0) Invalidate(shadow_index, "shadow_commit_state_invalid");
         return false;
      }
      long committed_reservation = m_portfolios[shadow_index].reservation_minor;
      long committed_margin = m_portfolios[shadow_index].margin_minor;
      long committed_projected_equity =
         m_portfolios[shadow_index].branch_equity_minor;
      for(int i = 0; i < m_candidate_count[shadow_index]; i++)
      {
         if(!m_candidates[shadow_index][i].allocated)
            continue;
         long next_reservation = 0;
         long next_margin = 0;
         long next_equity = 0;
         if(!LP_RevmaSafeMinorAdd(committed_reservation,
            m_candidates[shadow_index][i].committed_reservation_delta_minor, next_reservation) ||
            !LP_RevmaSafeMinorAdd(committed_margin,
            m_candidates[shadow_index][i].incremental_margin_minor, next_margin) ||
            !LP_RevmaSafeMinorAdd(committed_projected_equity,
            m_candidates[shadow_index][i].incremental_liquidation_minor,
            next_equity) || next_equity < 0 || next_margin > next_equity ||
            !ApplyCandidate(shadow_index, m_candidates[shadow_index][i]))
         {
            Invalidate(shadow_index, "shadow_commit_reconciliation_failure");
            return false;
         }
         long actual_currency_q_cash[LP_CCY_COUNT];
         for(int ccy = 0; ccy < LP_CCY_COUNT; ccy++)
            actual_currency_q_cash[ccy] = 0;
         for(int symbol_id = 0; symbol_id < LP_SYMBOL_COUNT; symbol_id++)
         {
            LP_RevmaShadowGrid concentration_grid =
               m_grids[shadow_index][symbol_id];
            if(!concentration_grid.active)
               continue;
            int base_ccy = -1;
            int quote_ccy = -1;
            LP_CanonicalBaseQuote(LP_CanonicalSymbol(symbol_id), base_ccy,
               quote_ccy);
            if(base_ccy < 0 || base_ccy >= LP_CCY_COUNT || quote_ccy < 0 ||
               quote_ccy >= LP_CCY_COUNT || base_ccy == quote_ccy ||
               !LP_RevmaSafeMinorAdd(actual_currency_q_cash[base_ccy],
                  concentration_grid.q_cash_minor,
                  actual_currency_q_cash[base_ccy]) ||
               !LP_RevmaSafeMinorAdd(actual_currency_q_cash[quote_ccy],
                  concentration_grid.q_cash_minor,
                  actual_currency_q_cash[quote_ccy]))
            {
               Invalidate(shadow_index,
                  "committed_concentration_reconciliation_failed");
               return false;
            }
         }
         long actual_concentration = 0;
         for(int ccy = 0; ccy < LP_CCY_COUNT; ccy++)
         {
            if(actual_currency_q_cash[ccy] > actual_concentration)
               actual_concentration = actual_currency_q_cash[ccy];
         }
         if(actual_concentration !=
            m_candidates[shadow_index][i].concentration_q_cash_minor)
         {
            Invalidate(shadow_index,
               "projected_committed_concentration_mismatch");
            return false;
         }
         committed_reservation = next_reservation;
         committed_margin = next_margin;
         committed_projected_equity = next_equity;
         if(!RecordInventoryTransition(shadow_index))
            return false;
      }
      m_portfolios[shadow_index].reservation_minor = committed_reservation;
      m_portfolios[shadow_index].margin_minor = committed_margin;
      if(committed_margin > m_portfolios[shadow_index].peak_margin_minor)
         m_portfolios[shadow_index].peak_margin_minor = committed_margin;
      UpdateReservationReconciliation(shadow_index);
      if(!m_portfolios[shadow_index].valid)
         return false;
      bool reconciled = ReconcileReservation(shadow_index) &&
         ReconcileMargin(shadow_index) &&
         ReconcileGridInventory(shadow_index) &&
         ReconcileMarkAndCost(shadow_index) && ReconcileEquity(shadow_index);
      if(!reconciled ||
         m_portfolios[shadow_index].branch_equity_minor !=
            committed_projected_equity ||
         m_portfolios[shadow_index].margin_minor != committed_margin)
      {
         Invalidate(shadow_index,
            "shadow_commit_projected_equity_reconciliation_failure");
         return false;
      }
      if(!ReconcileAndObserveConcurrentRisk(shadow_index,
         m_portfolios[shadow_index].batch_m1_time,
         "candidate_batch_committed"))
         return false;
      m_portfolios[shadow_index].transitions_committed = true;
      return true;
   }

   bool EndClosedM1Batch(const int branch)
   {
      int shadow_index = LP_RevmaShadowIndex(branch);
      if(shadow_index < 0 || !m_portfolios[shadow_index].valid ||
         !m_portfolios[shadow_index].batch_open || !m_portfolios[shadow_index].allocation_complete ||
         !m_portfolios[shadow_index].transitions_committed)
      {
         if(shadow_index >= 0) Invalidate(shadow_index, "shadow_batch_end_reconciliation_failure");
         return false;
      }
      m_portfolios[shadow_index].batch_open = false;
      return ReconcileGridInventory(shadow_index) &&
         ReconcileMarkAndCost(shadow_index) && ReconcileEquity(shadow_index) &&
         UpdateCausalDivergenceAfterBothBatches();
   }

   bool SetGridMarkedLiquidation(
      const int branch,
      const int symbol_id,
      const datetime source_m1_time,
      const long marked_liquidation_minor,
      const long estimated_close_cost_minor
   )
   {
      int shadow_index = LP_RevmaShadowIndex(branch);
      if(!IndividualMutationAuthorized())
         return false;
      if(shadow_index < 0 || symbol_id < 0 || symbol_id >= LP_SYMBOL_COUNT ||
         !m_portfolios[shadow_index].valid || estimated_close_cost_minor < 0 ||
         estimated_close_cost_minor > LP_REVMA_MINOR_ABS_LIMIT ||
         marked_liquidation_minor > LP_REVMA_MINOR_ABS_LIMIT ||
         marked_liquidation_minor < -LP_REVMA_MINOR_ABS_LIMIT ||
         !m_grids[shadow_index][symbol_id].active ||
         m_grids[shadow_index][symbol_id].flat ||
         source_m1_time <=
            m_grids[shadow_index][symbol_id].last_admission_m1_time ||
         source_m1_time !=
            m_grids[shadow_index][symbol_id].path_geometry.last_observation_m1 ||
         source_m1_time <= m_grids[shadow_index][symbol_id].last_mark_m1_time ||
         m_portfolios[shadow_index].batch_open)
      {
         if(shadow_index >= 0) Invalidate(shadow_index, "marked_liquidation_input_invalid");
         return false;
      }
      LP_RevmaShadowGrid grid = m_grids[shadow_index][symbol_id];
      long elapsed_seconds = (long)source_m1_time -
         (long)grid.last_mark_m1_time;
      if(elapsed_seconds < 0 || elapsed_seconds / 60 > 2147483647)
      {
         Invalidate(shadow_index, "underwater_elapsed_time_overflow");
         return false;
      }
      int elapsed_minutes = (int)(elapsed_seconds / 60);
      if(grid.marked_liquidation_minor < 0 &&
         grid.time_underwater_minutes > 2147483647 - elapsed_minutes)
      {
         Invalidate(shadow_index, "underwater_duration_overflow");
         return false;
      }
      if(grid.marked_liquidation_minor < 0)
         grid.time_underwater_minutes += elapsed_minutes;
      grid.marked_liquidation_minor = marked_liquidation_minor;
      if(marked_liquidation_minor > 0)
         grid.last_positive_liquidation_opportunity_m1 = source_m1_time;
      if(marked_liquidation_minor < 0 && -marked_liquidation_minor >
         grid.maximum_adverse_excursion_minor)
         grid.maximum_adverse_excursion_minor =
            -marked_liquidation_minor;
      grid.estimated_close_cost_minor = estimated_close_cost_minor;
      grid.last_mark_m1_time = source_m1_time;
      m_grids[shadow_index][symbol_id] = grid;
      long branch_mark = 0;
      long branch_cost = 0;
      for(int i = 0; i < LP_SYMBOL_COUNT; i++)
      {
         if(!LP_RevmaSafeMinorAdd(branch_mark, m_grids[shadow_index][i].marked_liquidation_minor, branch_mark) ||
            !LP_RevmaSafeMinorAdd(branch_cost,
               m_grids[shadow_index][i].estimated_close_cost_minor, branch_cost))
         {
            Invalidate(shadow_index, "marked_liquidation_reconciliation_overflow");
            return false;
         }
      }
      m_portfolios[shadow_index].marked_liquidation_minor = branch_mark;
      m_portfolios[shadow_index].estimated_close_cost_minor = branch_cost;
      return ReconcileMarkAndCost(shadow_index) &&
         ReconcileEquity(shadow_index);
   }

   bool ObserveGridPath(
      const int branch,
      const int symbol_id,
      const double structural_price,
      const datetime source_m1_time
   )
   {
      int shadow_index = LP_RevmaShadowIndex(branch);
      if(!IndividualMutationAuthorized())
         return false;
      if(shadow_index < 0 || symbol_id < 0 || symbol_id >= LP_SYMBOL_COUNT ||
         !m_portfolios[shadow_index].valid || m_portfolios[shadow_index].batch_open ||
         !m_grids[shadow_index][symbol_id].active)
         return false;
      LP_RevmaShadowGrid grid = m_grids[shadow_index][symbol_id];
      if(!LP_RevmaObserveCompletedM1Path(structural_price,
         grid.discovery_mesh.broker_tick_size, grid.direction,
         source_m1_time, grid.path_geometry))
      {
         Invalidate(shadow_index, "shadow_path_observation_invalid");
         return false;
      }
      if(MathAbs(grid.path_geometry.current_cell_index) >= 1)
         grid.excursion_completed = true;
      m_grids[shadow_index][symbol_id] = grid;
      return true;
   }

   bool EvaluateLocalHarvest(
      const int branch,
      const int symbol_id,
      const datetime source_m1_time,
      bool &latched
   )
   {
      latched = false;
      int shadow_index = LP_RevmaShadowIndex(branch);
      if(!IndividualMutationAuthorized())
         return false;
      if(shadow_index < 0 || symbol_id < 0 || symbol_id >= LP_SYMBOL_COUNT ||
         !m_portfolios[shadow_index].valid || m_portfolios[shadow_index].batch_open ||
         source_m1_time <= 0)
         return false;
      LP_RevmaShadowGrid grid = m_grids[shadow_index][symbol_id];
      if(!grid.active)
         return true;
      if(m_portfolios[shadow_index].last_close_authority_evaluation_m1_time !=
         source_m1_time)
      {
         Invalidate(shadow_index, "local_harvest_close_authority_precedence_missing");
         return false;
      }
      if(grid.last_mark_m1_time != source_m1_time)
      {
         Invalidate(shadow_index, "local_harvest_mark_snapshot_mismatch");
         return false;
      }
      grid.last_local_harvest_evaluation_m1_time = source_m1_time;
      if(grid.close_owner == LP_REVMA_DISCOVERY_CLOSE_LOCAL_HARVEST)
      {
         m_grids[shadow_index][symbol_id] = grid;
         latched = true;
         return true;
      }
      if(m_portfolios[shadow_index].close_owner !=
            LP_REVMA_DISCOVERY_CLOSE_NONE ||
         grid.close_owner != LP_REVMA_DISCOVERY_CLOSE_NONE)
      {
         m_grids[shadow_index][symbol_id] = grid;
         return true;
      }
      if(!grid.excursion_completed || grid.marked_liquidation_minor < 1)
      {
         m_grids[shadow_index][symbol_id] = grid;
         return true;
      }
      grid.close_owner = LP_REVMA_DISCOVERY_CLOSE_LOCAL_HARVEST;
      grid.terminal_reason = "grid_harvest";
      grid.close_trigger_m1_time = source_m1_time;
      m_grids[shadow_index][symbol_id] = grid;
      latched = true;
      return true;
   }

   bool EvaluateCloseAuthority(const int branch, const datetime source_m1_time)
   {
      int shadow_index = LP_RevmaShadowIndex(branch);
      if(!IndividualMutationAuthorized())
         return false;
      if(shadow_index < 0 || !m_portfolios[shadow_index].valid ||
         m_portfolios[shadow_index].batch_open || source_m1_time <= 0 ||
         source_m1_time <=
            m_portfolios[shadow_index].last_close_authority_evaluation_m1_time)
         return false;
      for(int symbol_id = 0; symbol_id < LP_SYMBOL_COUNT; symbol_id++)
      {
         if(m_grids[shadow_index][symbol_id].active &&
            m_grids[shadow_index][symbol_id].last_mark_m1_time != source_m1_time)
         {
            Invalidate(shadow_index, "portfolio_liability_snapshot_mismatch");
            return false;
         }
      }
      if(!ReconcileAndObserveConcurrentRisk(shadow_index, source_m1_time,
         "completed_m1_mark_before_close_authority"))
         return false;
      long harvest_plus_liability = 0;
      if(!LP_RevmaSafeMinorAdd(m_portfolios[shadow_index].realized_harvest_minor,
         m_portfolios[shadow_index].marked_liquidation_minor, harvest_plus_liability))
      {
         Invalidate(shadow_index, "close_authority_arithmetic_overflow");
         return false;
      }
      long risk_cycle_mark = harvest_plus_liability;
      if((m_portfolios[shadow_index].close_owner ==
             LP_REVMA_DISCOVERY_CLOSE_CLEANUP ||
          m_portfolios[shadow_index].close_owner ==
             LP_REVMA_DISCOVERY_CLOSE_HARD_RISK) &&
         !LP_RevmaSafeMinorAdd(risk_cycle_mark,
         m_portfolios[shadow_index].realized_nonharvest_minor, risk_cycle_mark))
      {
         Invalidate(shadow_index, "cleanup_risk_escalation_arithmetic_overflow");
         return false;
      }
      bool modeled_margin_insolvent = !ModeledMarginSolvent(shadow_index);
      if(modeled_margin_insolvent)
      {
         RecordInfeasibility(shadow_index, "modeled_margin_insolvency",
            source_m1_time);
         Invalidate(shadow_index, "modeled_margin_insolvency");
         return false;
      }
      if(risk_cycle_mark <= -m_portfolios[shadow_index].capital_budget_minor)
      {
         if(!LatchPortfolioCloseAuthority(shadow_index,
            LP_REVMA_DISCOVERY_CLOSE_HARD_RISK, source_m1_time))
         {
            Invalidate(shadow_index, "hard_risk_authority_latch_failed");
            return false;
         }
      }
      else if(m_portfolios[shadow_index].close_owner == LP_REVMA_DISCOVERY_CLOSE_NONE &&
         m_portfolios[shadow_index].realized_harvest_minor > 0 &&
         m_portfolios[shadow_index].marked_liquidation_minor < 0 &&
         harvest_plus_liability >= 0)
      {
         if(!LatchPortfolioCloseAuthority(shadow_index,
            LP_REVMA_DISCOVERY_CLOSE_CLEANUP, source_m1_time))
         {
            Invalidate(shadow_index, "cleanup_authority_latch_failed");
            return false;
         }
      }
      m_portfolios[shadow_index].last_close_authority_evaluation_m1_time =
         source_m1_time;
      return true;
   }

   bool CloseGrid(
      const int branch,
      const int symbol_id,
      const int close_owner,
      const datetime confirmed_flat_m1_time,
      const ulong close_strategy_identity_hash,
      const string terminal_reason
   )
   {
      int shadow_index = LP_RevmaShadowIndex(branch);
      if(!IndividualMutationAuthorized())
         return false;
      if(shadow_index < 0 || symbol_id < 0 || symbol_id >= LP_SYMBOL_COUNT ||
         !m_portfolios[shadow_index].valid || !m_grids[shadow_index][symbol_id].active ||
         m_portfolios[shadow_index].batch_open || confirmed_flat_m1_time <= 0 ||
         close_strategy_identity_hash == 0 || terminal_reason == "" ||
         (close_owner != LP_REVMA_DISCOVERY_CLOSE_LOCAL_HARVEST &&
          close_owner != LP_REVMA_DISCOVERY_CLOSE_CLEANUP &&
          close_owner != LP_REVMA_DISCOVERY_CLOSE_HARD_RISK))
      {
         if(shadow_index >= 0) Invalidate(shadow_index, "shadow_grid_close_invariant_failure");
         return false;
      }
      LP_RevmaShadowGrid grid = m_grids[shadow_index][symbol_id];
      if(grid.close_owner != close_owner || grid.terminal_reason == "" ||
         grid.terminal_reason != terminal_reason || grid.close_trigger_m1_time <= 0 ||
         !LP_RevmaDiscoveryTerminalReasonOwnerConsistent(
            grid.terminal_reason, grid.close_owner) ||
         ((close_owner == LP_REVMA_DISCOVERY_CLOSE_LOCAL_HARVEST) !=
          (m_portfolios[shadow_index].close_owner ==
             LP_REVMA_DISCOVERY_CLOSE_NONE)) ||
         (close_owner >= LP_REVMA_DISCOVERY_CLOSE_CLEANUP &&
          m_portfolios[shadow_index].close_owner != close_owner) ||
         confirmed_flat_m1_time < grid.close_trigger_m1_time ||
         confirmed_flat_m1_time < grid.birth_m1_time ||
         confirmed_flat_m1_time < grid.last_admission_m1_time ||
         confirmed_flat_m1_time != grid.last_mark_m1_time ||
         confirmed_flat_m1_time != grid.path_geometry.last_observation_m1 ||
         (branch == LP_REVMA_BRANCH_C &&
          confirmed_flat_m1_time != grid.center_support.last_observation_m1))
      {
         Invalidate(shadow_index, "shadow_grid_close_linkage_or_chronology_invalid");
         return false;
      }
      long next_reservation = 0;
      long next_margin = 0;
      long next_harvest = m_portfolios[shadow_index].realized_harvest_minor;
      long next_nonharvest =
         m_portfolios[shadow_index].realized_nonharvest_minor;
      long next_realized_cost = 0;
      long next_cleanup = m_portfolios[shadow_index].realized_cleanup_minor;
      long next_hard_risk =
         m_portfolios[shadow_index].realized_hard_risk_minor;
      long expected_branch_mark = 0;
      long expected_estimated_cost = 0;
      long total_cost_before = 0;
      long total_cost_after = 0;
      long realized_after_cost_minor = grid.marked_liquidation_minor;
      long liquidation_cost_minor = grid.estimated_close_cost_minor;
      long equity_before_close =
         m_portfolios[shadow_index].branch_equity_minor;
      if(!LP_RevmaSafeMinorAdd(m_portfolios[shadow_index].reservation_minor,
         -grid.reservation_minor, next_reservation) ||
         !LP_RevmaSafeMinorAdd(m_portfolios[shadow_index].margin_minor,
         -grid.margin_minor, next_margin) ||
         !LP_RevmaSafeMinorAdd(m_portfolios[shadow_index].realized_close_cost_minor,
         liquidation_cost_minor, next_realized_cost) ||
         !LP_RevmaSafeMinorAdd(m_portfolios[shadow_index].marked_liquidation_minor,
         -grid.marked_liquidation_minor, expected_branch_mark) ||
         !LP_RevmaSafeMinorAdd(m_portfolios[shadow_index].estimated_close_cost_minor,
         -grid.estimated_close_cost_minor, expected_estimated_cost) ||
         !LP_RevmaSafeMinorAdd(m_portfolios[shadow_index].estimated_close_cost_minor,
         m_portfolios[shadow_index].realized_close_cost_minor,
         total_cost_before))
      {
         Invalidate(shadow_index, "shadow_grid_close_arithmetic_overflow");
         return false;
      }
      bool origin_harvest = grid.terminal_reason == "grid_harvest";
      bool origin_cleanup = grid.terminal_reason == "account_cleanup";
      bool origin_hard_risk = grid.terminal_reason == "account_risk";
      if((origin_harvest && (!grid.excursion_completed ||
            !LP_RevmaSafeMinorAdd(next_harvest,
               realized_after_cost_minor, next_harvest))) ||
         (!origin_harvest &&
          !LP_RevmaSafeMinorAdd(next_nonharvest,
             realized_after_cost_minor, next_nonharvest)) ||
         (origin_cleanup &&
          !LP_RevmaSafeMinorAdd(next_cleanup,
             realized_after_cost_minor, next_cleanup)) ||
         (origin_hard_risk &&
          !LP_RevmaSafeMinorAdd(next_hard_risk,
             realized_after_cost_minor, next_hard_risk)) ||
         (origin_harvest &&
          m_portfolios[shadow_index].local_harvest_close_count >= 2147483647) ||
         (origin_cleanup &&
          m_portfolios[shadow_index].cleanup_close_count >= 2147483647) ||
         (origin_hard_risk &&
          m_portfolios[shadow_index].hard_risk_close_count >= 2147483647))
      {
         Invalidate(shadow_index, "shadow_terminal_owner_ledger_invalid");
         return false;
      }
      m_portfolios[shadow_index].realized_harvest_minor = next_harvest;
      m_portfolios[shadow_index].realized_nonharvest_minor = next_nonharvest;
      m_portfolios[shadow_index].realized_cleanup_minor = next_cleanup;
      m_portfolios[shadow_index].realized_hard_risk_minor = next_hard_risk;
      if(origin_harvest)
      {
         m_portfolios[shadow_index].local_harvest_close_count++;
         grid.realized_harvest_minor = realized_after_cost_minor;
      }
      else
      {
         grid.realized_nonharvest_minor = realized_after_cost_minor;
      }
      if(origin_cleanup)
         m_portfolios[shadow_index].cleanup_close_count++;
      else if(origin_hard_risk)
         m_portfolios[shadow_index].hard_risk_close_count++;
      m_portfolios[shadow_index].reservation_minor = next_reservation;
      m_portfolios[shadow_index].margin_minor = next_margin;
      m_portfolios[shadow_index].realized_close_cost_minor = next_realized_cost;

      grid.active = false;
      grid.flat = true;
      grid.atom_count = 0;
      grid.total_lots = 0.0;
      grid.weighted_entry_price_lots = 0.0;
      grid.average_entry_price = 0.0;
      grid.q_cash_minor = 0;
      grid.marked_liquidation_minor = 0;
      grid.candidate_reservation_minor = 0;
      grid.reservation_minor = 0;
      grid.reservation_overrun = false;
      grid.reservation_overrun_minor = 0;
      grid.margin_minor = 0;
      grid.last_flat_m1_time = confirmed_flat_m1_time;
      grid.reentry_requires_identity_transition =
         close_owner == LP_REVMA_DISCOVERY_CLOSE_CLEANUP ||
         close_owner == LP_REVMA_DISCOVERY_CLOSE_HARD_RISK;
      grid.reentry_identity_at_close = close_strategy_identity_hash;
      grid.reentry_last_observed_identity = close_strategy_identity_hash;
      grid.reentry_last_identity_observation_m1 = confirmed_flat_m1_time;
      grid.reentry_transition_m1 = 0;
      grid.estimated_close_cost_minor = 0;
      grid.realized_close_cost_minor = liquidation_cost_minor;
      grid.terminal_internal_state_hash = TerminalGridInternalStateHash(
         grid, confirmed_flat_m1_time, "grid_close_final");
      if(grid.terminal_internal_state_hash == 0)
      {
         Invalidate(shadow_index, "terminal_internal_state_hash_zero");
         return false;
      }
      m_grids[shadow_index][symbol_id] = grid;

      long branch_mark = 0;
      long branch_cost = 0;
      for(int i = 0; i < LP_SYMBOL_COUNT; i++)
      {
         if(!LP_RevmaSafeMinorAdd(branch_mark,
            m_grids[shadow_index][i].marked_liquidation_minor, branch_mark) ||
            !LP_RevmaSafeMinorAdd(branch_cost,
            m_grids[shadow_index][i].estimated_close_cost_minor, branch_cost))
         {
            Invalidate(shadow_index, "post_close_mark_reconciliation_overflow");
            return false;
         }
      }
      m_portfolios[shadow_index].marked_liquidation_minor = branch_mark;
      m_portfolios[shadow_index].estimated_close_cost_minor = branch_cost;
      UpdateReservationReconciliation(shadow_index);
      if(!m_portfolios[shadow_index].valid)
         return false;
      if(!ReconcileReservation(shadow_index) || !ReconcileMargin(shadow_index) ||
         !ReconcileGridInventory(shadow_index) ||
         !ReconcileMarkAndCost(shadow_index) || !ReconcileEquity(shadow_index) ||
         branch_mark != expected_branch_mark ||
         branch_cost != expected_estimated_cost ||
         next_realized_cost != m_portfolios[shadow_index].realized_close_cost_minor ||
         !LP_RevmaSafeMinorAdd(m_portfolios[shadow_index].estimated_close_cost_minor,
            m_portfolios[shadow_index].realized_close_cost_minor,
            total_cost_after) ||
         total_cost_after != total_cost_before ||
         m_portfolios[shadow_index].branch_equity_minor != equity_before_close)
      {
         Invalidate(shadow_index, "shadow_close_money_conservation_failure");
         return false;
      }
      if(!RecordInventoryTransition(shadow_index) ||
         !ReconcileAndObserveConcurrentRisk(shadow_index,
            confirmed_flat_m1_time, "grid_close_confirmed"))
         return false;
      return true;
   }

   bool CompletePortfolioClose(const int branch)
   {
      int shadow_index = LP_RevmaShadowIndex(branch);
      if(!IndividualMutationAuthorized())
         return false;
      if(shadow_index < 0 || !m_portfolios[shadow_index].valid ||
         m_portfolios[shadow_index].close_owner == LP_REVMA_DISCOVERY_CLOSE_NONE ||
         m_portfolios[shadow_index].batch_open ||
         !AllGridsFlat(shadow_index) || m_portfolios[shadow_index].reservation_minor != 0 ||
         m_portfolios[shadow_index].margin_minor != 0 ||
         m_portfolios[shadow_index].marked_liquidation_minor != 0 ||
         m_portfolios[shadow_index].estimated_close_cost_minor != 0)
      {
         if(shadow_index >= 0) Invalidate(shadow_index, "portfolio_close_completion_not_flat");
         return false;
      }
      UpdateReservationReconciliation(shadow_index);
      if(!m_portfolios[shadow_index].valid ||
         !ReconcileReservation(shadow_index) || !ReconcileMargin(shadow_index) ||
         !ReconcileGridInventory(shadow_index) ||
         !ReconcileMarkAndCost(shadow_index) || !ReconcileEquity(shadow_index))
         return false;
      if(m_portfolios[shadow_index].close_owner == LP_REVMA_DISCOVERY_CLOSE_CLEANUP &&
         m_portfolios[shadow_index].branch_equity_minor < m_portfolios[shadow_index].equity_reference_minor)
         m_portfolios[shadow_index].cleanup_shortfall = true;
      m_portfolios[shadow_index].cycle_reset_required = true;
      m_portfolios[shadow_index].cycle_flat_m1_time = 0;
      for(int i = 0; i < LP_SYMBOL_COUNT; i++)
      {
         if(m_grids[shadow_index][i].last_flat_m1_time >
            m_portfolios[shadow_index].cycle_flat_m1_time)
            m_portfolios[shadow_index].cycle_flat_m1_time =
               m_grids[shadow_index][i].last_flat_m1_time;
      }
      return true;
   }

   bool BeginNextCycle(
      const int branch,
      const ulong next_cycle_id,
      const long confirmed_equity_minor,
      const datetime source_m1_time
   )
   {
      int shadow_index = LP_RevmaShadowIndex(branch);
      if(!IndividualMutationAuthorized())
         return false;
      if(shadow_index < 0 || !m_portfolios[shadow_index].valid ||
         !m_portfolios[shadow_index].cycle_reset_required ||
         !AllGridsFlat(shadow_index) || m_portfolios[shadow_index].reservation_minor != 0 ||
         m_portfolios[shadow_index].margin_minor != 0 ||
         m_portfolios[shadow_index].marked_liquidation_minor != 0 ||
         m_portfolios[shadow_index].estimated_close_cost_minor != 0 ||
         m_portfolios[shadow_index].cycle_id >=
            (ulong)LP_REVMA_MINOR_ABS_LIMIT ||
         next_cycle_id != m_portfolios[shadow_index].cycle_id + 1 ||
         source_m1_time <= m_portfolios[shadow_index].cycle_flat_m1_time ||
         confirmed_equity_minor != m_portfolios[shadow_index].branch_equity_minor)
      {
         if(shadow_index >= 0) Invalidate(shadow_index, "next_cycle_boundary_invalid");
         return false;
      }
      long next_budget = 0;
      if(!LP_RevmaDiscoveryCapitalBudgetMinor(confirmed_equity_minor,
         next_budget))
      {
         Invalidate(shadow_index, "next_cycle_budget_invalid");
         return false;
      }
      m_portfolios[shadow_index].cycle_id = next_cycle_id;
      m_portfolios[shadow_index].equity_reference_minor = confirmed_equity_minor;
      m_portfolios[shadow_index].capital_budget_minor = next_budget;
      m_portfolios[shadow_index].realized_harvest_minor = 0;
      m_portfolios[shadow_index].realized_nonharvest_minor = 0;
      m_portfolios[shadow_index].realized_cleanup_minor = 0;
      m_portfolios[shadow_index].realized_hard_risk_minor = 0;
      m_portfolios[shadow_index].local_harvest_close_count = 0;
      m_portfolios[shadow_index].cleanup_close_count = 0;
      m_portfolios[shadow_index].hard_risk_close_count = 0;
      m_portfolios[shadow_index].marked_liquidation_minor = 0;
      m_portfolios[shadow_index].estimated_close_cost_minor = 0;
      m_portfolios[shadow_index].realized_close_cost_minor = 0;
      m_portfolios[shadow_index].peak_margin_minor = 0;
      m_portfolios[shadow_index].q_cash_minor = 0;
      m_portfolios[shadow_index].atom_count = 0;
      m_portfolios[shadow_index].active_grid_count = 0;
      for(int ccy = 0; ccy < LP_CCY_COUNT; ccy++)
         m_portfolios[shadow_index].currency_q_cash_minor[ccy] = 0;
      m_portfolios[shadow_index].concentration_q_cash_minor = 0;
      m_portfolios[shadow_index].concentration_currency_id = -1;
      m_portfolios[shadow_index].liquidation_liability_minor = 0;
      m_portfolios[shadow_index].equity_high_water_minor =
         confirmed_equity_minor;
      m_portfolios[shadow_index].branch_drawdown_minor = 0;
      m_portfolios[shadow_index].peak_reservation_minor = 0;
      m_portfolios[shadow_index].peak_q_cash_minor = 0;
      m_portfolios[shadow_index].peak_atom_count = 0;
      m_portfolios[shadow_index].peak_active_grid_count = 0;
      m_portfolios[shadow_index].peak_concentration_q_cash_minor = 0;
      m_portfolios[shadow_index].peak_concentration_currency_id = -1;
      m_portfolios[shadow_index].peak_liquidation_liability_minor = 0;
      m_portfolios[shadow_index].maximum_branch_drawdown_minor = 0;
      m_portfolios[shadow_index].cycle_risk_snapshot_count = 0;
      m_portfolios[shadow_index].cycle_risk_snapshot_hash =
         LP_RevmaDiscoveryFormulaHash();
      m_portfolios[shadow_index].last_risk_snapshot_m1_time = 0;
      m_portfolios[shadow_index].cycle_candidate_built_count = 0;
      m_portfolios[shadow_index].cycle_candidate_decision_count = 0;
      m_portfolios[shadow_index].cycle_candidate_admitted_count = 0;
      m_portfolios[shadow_index].cycle_candidate_rejected_count = 0;
      m_portfolios[shadow_index].cycle_inventory_transition_count = 0;
      m_portfolios[shadow_index].reservation_overrun = false;
      m_portfolios[shadow_index].reservation_overrun_minor = 0;
      m_portfolios[shadow_index].capacity_overrun = false;
      m_portfolios[shadow_index].capacity_overrun_minor = 0;
      m_portfolios[shadow_index].first_infeasibility = "";
      m_portfolios[shadow_index].latest_infeasibility = "";
      m_portfolios[shadow_index].first_infeasibility_m1_time = 0;
      m_portfolios[shadow_index].latest_infeasibility_m1_time = 0;
      m_portfolios[shadow_index].close_owner = LP_REVMA_DISCOVERY_CLOSE_NONE;
      m_portfolios[shadow_index].hard_risk_latched = false;
      m_portfolios[shadow_index].cycle_reset_required = false;
      m_portfolios[shadow_index].cycle_flat_m1_time = 0;
      m_portfolios[shadow_index].cleanup_shortfall = false;
      m_portfolios[shadow_index].last_close_authority_evaluation_m1_time = 0;
      return ReconcileEquity(shadow_index);
   }

   bool ObserveFlatReentryIdentity(
      const int branch,
      const int symbol_id,
      const datetime source_m1_time,
      const ulong current_strategy_identity_hash
   )
   {
      int shadow_index = LP_RevmaShadowIndex(branch);
      if(!IndividualMutationAuthorized())
         return false;
      if(shadow_index < 0 || symbol_id < 0 || symbol_id >= LP_SYMBOL_COUNT ||
         !m_portfolios[shadow_index].valid ||
         !m_grids[shadow_index][symbol_id].flat ||
         m_grids[shadow_index][symbol_id].active ||
         !m_grids[shadow_index][symbol_id].reentry_requires_identity_transition ||
         current_strategy_identity_hash == 0 ||
         source_m1_time <=
            m_grids[shadow_index][symbol_id].reentry_last_identity_observation_m1)
         return false;
      LP_RevmaShadowGrid grid = m_grids[shadow_index][symbol_id];
      grid.reentry_last_observed_identity = current_strategy_identity_hash;
      grid.reentry_last_identity_observation_m1 = source_m1_time;
      if(current_strategy_identity_hash != grid.reentry_identity_at_close)
      {
         if(grid.reentry_transition_m1 == 0)
            grid.reentry_transition_m1 = source_m1_time;
      }
      else
         grid.reentry_transition_m1 = 0;
      m_grids[shadow_index][symbol_id] = grid;
      return true;
   }

   bool SetMatchedGridMarkedLiquidation(
      const int symbol_id,
      const datetime source_m1_time,
      const long marked_liquidation_minor,
      const long estimated_close_cost_minor)
   {
      if(!BeginMatchedMutationScope()) return false;
      bool u_ok = SetGridMarkedLiquidation(LP_REVMA_BRANCH_U, symbol_id,
         source_m1_time, marked_liquidation_minor,
         estimated_close_cost_minor);
      bool c_ok = u_ok && SetGridMarkedLiquidation(LP_REVMA_BRANCH_C,
         symbol_id, source_m1_time, marked_liquidation_minor,
         estimated_close_cost_minor);
      return EndMatchedMutationScope(u_ok && c_ok, symbol_id, false);
   }

   bool ObserveMatchedGridPath(
      const int symbol_id,
      const double structural_price,
      const datetime source_m1_time)
   {
      if(!BeginMatchedMutationScope()) return false;
      bool u_ok = ObserveGridPath(LP_REVMA_BRANCH_U, symbol_id,
         structural_price, source_m1_time);
      bool c_ok = u_ok && ObserveGridPath(LP_REVMA_BRANCH_C, symbol_id,
         structural_price, source_m1_time);
      return EndMatchedMutationScope(u_ok && c_ok, symbol_id, false);
   }

   bool EvaluateMatchedLocalHarvest(
      const int symbol_id,
      const datetime source_m1_time,
      bool &latched)
   {
      latched = false;
      if(!BeginMatchedMutationScope()) return false;
      bool u_latched = false;
      bool c_latched = false;
      bool u_ok = EvaluateLocalHarvest(LP_REVMA_BRANCH_U, symbol_id,
         source_m1_time, u_latched);
      bool c_ok = u_ok && EvaluateLocalHarvest(LP_REVMA_BRANCH_C, symbol_id,
         source_m1_time, c_latched);
      bool matched = u_ok && c_ok && u_latched == c_latched;
      bool scope_ok = EndMatchedMutationScope(matched, symbol_id, false);
      latched = scope_ok && u_latched;
      return scope_ok;
   }

   bool EvaluateMatchedCloseAuthority(const datetime source_m1_time)
   {
      if(!BeginMatchedMutationScope()) return false;
      bool u_ok = EvaluateCloseAuthority(LP_REVMA_BRANCH_U, source_m1_time);
      bool c_ok = u_ok && EvaluateCloseAuthority(LP_REVMA_BRANCH_C,
         source_m1_time);
      return EndMatchedMutationScope(u_ok && c_ok, -1, true);
   }

   bool CloseMatchedGrid(
      const int symbol_id,
      const int close_owner,
      const datetime confirmed_flat_m1_time,
      const ulong close_strategy_identity_hash,
      const string terminal_reason)
   {
      if(!BeginMatchedMutationScope()) return false;
      bool u_ok = CloseGrid(LP_REVMA_BRANCH_U, symbol_id, close_owner,
         confirmed_flat_m1_time, close_strategy_identity_hash,
         terminal_reason);
      bool c_ok = u_ok && CloseGrid(LP_REVMA_BRANCH_C, symbol_id, close_owner,
         confirmed_flat_m1_time, close_strategy_identity_hash,
         terminal_reason);
      return EndMatchedMutationScope(u_ok && c_ok, symbol_id, false);
   }

   bool CompleteMatchedPortfolioClose()
   {
      if(!BeginMatchedMutationScope()) return false;
      bool u_ok = CompletePortfolioClose(LP_REVMA_BRANCH_U);
      bool c_ok = u_ok && CompletePortfolioClose(LP_REVMA_BRANCH_C);
      return EndMatchedMutationScope(u_ok && c_ok, -1, true);
   }

   bool BeginMatchedNextCycle(
      const ulong next_cycle_id,
      const long confirmed_equity_minor,
      const datetime source_m1_time)
   {
      if(!BeginMatchedMutationScope()) return false;
      bool u_ok = BeginNextCycle(LP_REVMA_BRANCH_U, next_cycle_id,
         confirmed_equity_minor, source_m1_time);
      bool c_ok = u_ok && BeginNextCycle(LP_REVMA_BRANCH_C, next_cycle_id,
         confirmed_equity_minor, source_m1_time);
      return EndMatchedMutationScope(u_ok && c_ok, -1, true);
   }

   bool ObserveMatchedFlatReentryIdentity(
      const int symbol_id,
      const datetime source_m1_time,
      const ulong current_strategy_identity_hash)
   {
      if(!BeginMatchedMutationScope()) return false;
      bool u_ok = ObserveFlatReentryIdentity(LP_REVMA_BRANCH_U, symbol_id,
         source_m1_time, current_strategy_identity_hash);
      bool c_ok = u_ok && ObserveFlatReentryIdentity(LP_REVMA_BRANCH_C,
         symbol_id, source_m1_time, current_strategy_identity_hash);
      return EndMatchedMutationScope(u_ok && c_ok, symbol_id, false);
   }

   bool ReentryEligible(
      const int branch,
      const int symbol_id,
      const datetime source_m1_time,
      const ulong current_strategy_identity_hash
   )
   {
      int shadow_index = LP_RevmaShadowIndex(branch);
      if(shadow_index < 0 || symbol_id < 0 || symbol_id >= LP_SYMBOL_COUNT)
         return false;
      return ReentryEligibleInternal(shadow_index, symbol_id, source_m1_time,
         current_strategy_identity_hash);
   }

   bool GetTerminalInternalStateHash(
      const int branch,
      const int symbol_id,
      const datetime terminal_event_m1_time,
      ulong &terminal_internal_state_hash)
   {
      terminal_internal_state_hash = 0;
      int shadow_index = LP_RevmaShadowIndex(branch);
      if(shadow_index < 0 || symbol_id < 0 || symbol_id >= LP_SYMBOL_COUNT ||
         !m_portfolios[shadow_index].valid || terminal_event_m1_time <= 0)
         return false;
      LP_RevmaShadowGrid grid = m_grids[shadow_index][symbol_id];
      if(grid.branch_grid_id == 0 ||
         grid.branch_cycle_id != m_portfolios[shadow_index].cycle_id)
         return false;
      if(grid.active)
      {
         if(terminal_event_m1_time != grid.last_mark_m1_time ||
            terminal_event_m1_time !=
               grid.path_geometry.last_observation_m1 ||
            (branch == LP_REVMA_BRANCH_C &&
             terminal_event_m1_time !=
                grid.center_support.last_observation_m1))
            return false;
         terminal_internal_state_hash = TerminalGridInternalStateHash(
            grid, terminal_event_m1_time, "run_boundary_unresolved");
      }
      else
      {
         if(!grid.flat || terminal_event_m1_time != grid.last_flat_m1_time)
            return false;
         terminal_internal_state_hash = grid.terminal_internal_state_hash;
      }
      return terminal_internal_state_hash != 0;
   }

   bool BuildTerminalGridProjection(
      const int branch,
      const int symbol_id,
      const datetime terminal_event_m1_time,
      LP_RevmaTerminalGridProjection &projection)
   {
      LP_ResetRevmaTerminalGridProjection(projection);
      int shadow_index = LP_RevmaShadowIndex(branch);
      if(shadow_index < 0 || symbol_id < 0 ||
         symbol_id >= LP_SYMBOL_COUNT ||
         !m_portfolios[shadow_index].valid || terminal_event_m1_time <= 0)
         return false;
      LP_RevmaShadowGrid grid = m_grids[shadow_index][symbol_id];
      if(grid.branch_grid_id == 0 || grid.branch_cycle_id == 0)
         return false;
      ulong internal_hash = 0;
      if(!GetTerminalInternalStateHash(branch, symbol_id,
            terminal_event_m1_time, internal_hash))
         return false;
      long age_seconds = (long)terminal_event_m1_time -
         (long)grid.birth_m1_time;
      if(age_seconds < 0 || age_seconds / 60 > 2147483647)
         return false;
      projection.branch = branch;
      projection.symbol_id = symbol_id;
      projection.branch_grid_id = grid.branch_grid_id;
      projection.branch_cycle_id = grid.branch_cycle_id;
      projection.grid_generation = grid.grid_generation;
      projection.direction = grid.direction;
      projection.terminal_source_m1_time = terminal_event_m1_time;
      projection.boundary_class = grid.active ?
         "run_boundary_unresolved" : "confirmed_flat_close";
      projection.atoms_before = grid.active ?
         grid.atom_count : grid.peak_atom_count;
      projection.atoms_after = grid.active ? grid.atom_count : 0;
      projection.lots_before = NormalizeDouble(
         (double)projection.atoms_before *
            LP_REVMA_DISCOVERY_ATOM_LOTS, 2);
      projection.lots_after = NormalizeDouble(
         (double)projection.atoms_after *
            LP_REVMA_DISCOVERY_ATOM_LOTS, 2);
      projection.reservation_minor = grid.active ?
         grid.reservation_minor : grid.peak_reservation_minor;
      projection.q_cash_minor = grid.active ?
         grid.q_cash_minor : grid.peak_q_cash_minor;
      projection.margin_minor = grid.active ?
         grid.margin_minor : grid.peak_margin_minor;
      projection.harvest_minor = grid.realized_harvest_minor;
      projection.nonharvest_minor = grid.realized_nonharvest_minor;
      projection.liability_minor = grid.active ?
         grid.marked_liquidation_minor : 0;
      projection.cost_minor = grid.active ?
         grid.estimated_close_cost_minor : grid.realized_close_cost_minor;
      projection.maximum_adverse_excursion_minor =
         grid.maximum_adverse_excursion_minor;
      projection.grid_age_minutes = (int)(age_seconds / 60);
      projection.time_underwater_minutes = grid.time_underwater_minutes;
      projection.close_owner = grid.close_owner;
      projection.origin_terminal_reason = grid.terminal_reason;
      projection.terminal_internal_state_hash = internal_hash;
      projection.projection_hash =
         LP_RevmaTerminalGridProjectionIdentity(projection);
      projection.valid = projection.projection_hash != 0;
      return LP_RevmaTerminalGridProjectionValid(projection);
   }

   bool BindTerminalEvidenceEvent(
      const int branch,
      const int symbol_id,
      const ulong branch_grid_id,
      const datetime terminal_event_m1_time,
      const ulong terminal_projection_hash,
      const ulong terminal_internal_state_hash,
      const ulong terminal_event_hash)
   {
      int shadow_index = LP_RevmaShadowIndex(branch);
      if(!IndividualMutationAuthorized())
         return false;
      if(shadow_index < 0 || symbol_id < 0 || symbol_id >= LP_SYMBOL_COUNT ||
         !m_portfolios[shadow_index].valid ||
         m_portfolios[shadow_index].batch_open || branch_grid_id == 0 ||
         terminal_event_m1_time <= 0 || terminal_projection_hash == 0 ||
         terminal_internal_state_hash == 0 ||
         terminal_event_hash == 0)
      {
         if(shadow_index >= 0)
            Invalidate(shadow_index, "terminal_evidence_bind_input_invalid");
         return false;
      }
      LP_RevmaShadowGrid grid = m_grids[shadow_index][symbol_id];
      LP_RevmaTerminalGridProjection expected_projection;
      LP_ResetRevmaTerminalGridProjection(expected_projection);
      ulong expected_internal_state_hash = 0;
      if(grid.active)
         expected_internal_state_hash = TerminalGridInternalStateHash(
            grid, terminal_event_m1_time, "run_boundary_unresolved");
      else
         expected_internal_state_hash = grid.terminal_internal_state_hash;
      if(grid.branch_grid_id != branch_grid_id ||
         grid.branch_cycle_id != m_portfolios[shadow_index].cycle_id ||
         grid.terminal_event_hash != 0 ||
         grid.terminal_projection_hash != 0 ||
         expected_internal_state_hash == 0 ||
         terminal_internal_state_hash != expected_internal_state_hash ||
         !BuildTerminalGridProjection(branch, symbol_id,
            terminal_event_m1_time, expected_projection) ||
         expected_projection.projection_hash !=
            terminal_projection_hash ||
         grid.terminal_evidence_m1_time != 0 ||
         (grid.active &&
          (terminal_event_m1_time != grid.last_mark_m1_time ||
           terminal_event_m1_time != grid.path_geometry.last_observation_m1 ||
           (branch == LP_REVMA_BRANCH_C &&
            terminal_event_m1_time !=
               grid.center_support.last_observation_m1))) ||
         (!grid.active &&
          (!grid.flat || terminal_event_m1_time != grid.last_flat_m1_time ||
           grid.terminal_reason == "")))
      {
         Invalidate(shadow_index, "terminal_evidence_bind_state_mismatch");
         return false;
      }
      grid.terminal_event_hash = terminal_event_hash;
      grid.terminal_projection_hash = terminal_projection_hash;
      grid.terminal_internal_state_hash = terminal_internal_state_hash;
      grid.terminal_evidence_m1_time = terminal_event_m1_time;
      m_grids[shadow_index][symbol_id] = grid;
      return true;
   }

   bool BindMatchedTerminalEvidenceEvents(
      const int symbol_id,
      const datetime terminal_event_m1_time,
      const ulong u_terminal_projection_hash,
      const ulong u_terminal_internal_state_hash,
      const ulong u_terminal_event_hash,
      const ulong c_terminal_projection_hash,
      const ulong c_terminal_internal_state_hash,
      const ulong c_terminal_event_hash)
   {
      if(symbol_id < 0 || symbol_id >= LP_SYMBOL_COUNT ||
         u_terminal_projection_hash == 0 ||
         u_terminal_internal_state_hash == 0 ||
         c_terminal_projection_hash == 0 ||
         c_terminal_internal_state_hash == 0 ||
         u_terminal_event_hash == 0 || c_terminal_event_hash == 0 ||
         !BeginMatchedMutationScope())
         return false;
      ulong u_grid_id = m_grids[0][symbol_id].branch_grid_id;
      ulong c_grid_id = m_grids[1][symbol_id].branch_grid_id;
      bool u_ok = BindTerminalEvidenceEvent(LP_REVMA_BRANCH_U, symbol_id,
         u_grid_id, terminal_event_m1_time,
         u_terminal_projection_hash, u_terminal_internal_state_hash,
         u_terminal_event_hash);
      bool c_ok = u_ok && BindTerminalEvidenceEvent(LP_REVMA_BRANCH_C,
         symbol_id, c_grid_id, terminal_event_m1_time,
         c_terminal_projection_hash, c_terminal_internal_state_hash,
         c_terminal_event_hash);
      return EndMatchedMutationScope(u_ok && c_ok, symbol_id, false);
   }

   bool GetGrid(const int branch, const int symbol_id, LP_RevmaShadowGrid &grid)
   {
      int shadow_index = LP_RevmaShadowIndex(branch);
      if(shadow_index < 0 || symbol_id < 0 || symbol_id >= LP_SYMBOL_COUNT)
         return false;
      grid = m_grids[shadow_index][symbol_id];
      return true;
   }

   bool GetPortfolio(const int branch, LP_RevmaShadowPortfolioState &portfolio)
   {
      int shadow_index = LP_RevmaShadowIndex(branch);
      if(shadow_index < 0)
         return false;
      portfolio = m_portfolios[shadow_index];
      return true;
   }

   bool GetConcurrentRiskState(
      const int branch,
      const datetime expected_source_m1_time,
      LP_RevmaConcurrentBranchRiskState &state)
   {
      LP_ResetRevmaConcurrentBranchRiskState(state);
      int shadow_index = LP_RevmaShadowIndex(branch);
      if(shadow_index < 0 || !m_portfolios[shadow_index].valid ||
         expected_source_m1_time <= 0 ||
         m_portfolios[shadow_index].last_risk_snapshot_m1_time !=
            expected_source_m1_time)
         return false;
      LP_RevmaShadowPortfolioState p = m_portfolios[shadow_index];
      state.branch = branch;
      state.source_m1_time = expected_source_m1_time;
      state.reservation_minor = p.reservation_minor;
      state.margin_minor = p.margin_minor;
      state.q_cash_minor = p.q_cash_minor;
      state.atom_count = p.atom_count;
      state.active_grid_count = p.active_grid_count;
      state.concentration_q_cash_minor = p.concentration_q_cash_minor;
      state.concentration_currency_id = p.concentration_currency_id;
      state.marked_liquidation_minor = p.marked_liquidation_minor;
      state.liquidation_liability_minor = p.liquidation_liability_minor;
      state.branch_equity_minor = p.branch_equity_minor;
      state.equity_high_water_minor = p.equity_high_water_minor;
      state.branch_drawdown_minor = p.branch_drawdown_minor;
      state.cycle_peak_reservation_minor = p.peak_reservation_minor;
      state.cycle_peak_margin_minor = p.peak_margin_minor;
      state.cycle_peak_q_cash_minor = p.peak_q_cash_minor;
      state.cycle_peak_atom_count = p.peak_atom_count;
      state.cycle_peak_active_grid_count = p.peak_active_grid_count;
      state.cycle_peak_concentration_q_cash_minor =
         p.peak_concentration_q_cash_minor;
      state.cycle_peak_concentration_currency_id =
         p.peak_concentration_currency_id;
      state.cycle_peak_liquidation_liability_minor =
         p.peak_liquidation_liability_minor;
      state.cycle_maximum_drawdown_minor =
         p.maximum_branch_drawdown_minor;
      state.run_peak_reservation_minor = p.run_peak_reservation_minor;
      state.run_peak_margin_minor = p.run_peak_margin_minor;
      state.run_peak_q_cash_minor = p.run_peak_q_cash_minor;
      state.run_peak_atom_count = p.run_peak_atom_count;
      state.run_peak_active_grid_count = p.run_peak_active_grid_count;
      state.run_peak_concentration_q_cash_minor =
         p.run_peak_concentration_q_cash_minor;
      state.run_peak_concentration_currency_id =
         p.run_peak_concentration_currency_id;
      state.run_peak_liquidation_liability_minor =
         p.run_peak_liquidation_liability_minor;
      state.run_equity_high_water_minor = p.run_equity_high_water_minor;
      state.run_maximum_drawdown_minor =
         p.run_maximum_branch_drawdown_minor;
      state.cycle_risk_snapshot_count = p.cycle_risk_snapshot_count;
      state.cycle_risk_snapshot_hash = p.cycle_risk_snapshot_hash;
      state.run_risk_snapshot_count = p.run_risk_snapshot_count;
      state.run_risk_snapshot_hash = p.run_risk_snapshot_hash;
      state.cycle_candidate_built_count = p.cycle_candidate_built_count;
      state.cycle_candidate_decision_count =
         p.cycle_candidate_decision_count;
      state.cycle_candidate_admitted_count =
         p.cycle_candidate_admitted_count;
      state.cycle_candidate_rejected_count =
         p.cycle_candidate_rejected_count;
      state.cycle_inventory_transition_count =
         p.cycle_inventory_transition_count;
      state.run_candidate_built_count = p.run_candidate_built_count;
      state.run_candidate_decision_count = p.run_candidate_decision_count;
      state.run_candidate_admitted_count = p.run_candidate_admitted_count;
      state.run_candidate_rejected_count = p.run_candidate_rejected_count;
      state.run_inventory_transition_count = p.run_inventory_transition_count;
      state.state_hash = LP_RevmaConcurrentBranchRiskIdentity(state);
      state.valid = state.state_hash != 0;
      return LP_RevmaConcurrentBranchRiskStateValid(state);
   }

   bool ReconcileBranch(const int branch)
   {
      int shadow_index = LP_RevmaShadowIndex(branch);
      if(!IndividualMutationAuthorized())
         return false;
      if(shadow_index < 0 || !m_portfolios[shadow_index].valid)
         return false;
      UpdateReservationReconciliation(shadow_index);
      return m_portfolios[shadow_index].valid &&
         ReconcileReservation(shadow_index) && ReconcileMargin(shadow_index) &&
         ReconcileGridInventory(shadow_index) &&
         ReconcileMarkAndCost(shadow_index) && ReconcileEquity(shadow_index) &&
         ModeledMarginSolvent(shadow_index);
   }

   bool BranchTerminalReconciled(
      const int branch,
      const datetime expected_terminal_m1_time,
      bool &final_flat,
      ulong &terminal_grid_state_hash,
      LP_RevmaConcurrentBranchRiskState &terminal_risk,
      ulong &terminal_book_hash)
   {
      final_flat = false;
      terminal_grid_state_hash = 0;
      terminal_book_hash = 0;
      LP_ResetRevmaConcurrentBranchRiskState(terminal_risk);
      int shadow_index = LP_RevmaShadowIndex(branch);
      if(shadow_index < 0 || !m_portfolios[shadow_index].initialized ||
         !m_portfolios[shadow_index].valid ||
         (m_causal_matching_open && !FullPreDivergenceParity()) ||
         expected_terminal_m1_time <= 0 ||
         expected_terminal_m1_time <
            m_portfolios[shadow_index].batch_m1_time ||
         m_portfolios[shadow_index].batch_open || !ReconcileBranch(branch))
         return false;
      if(m_portfolios[shadow_index].last_risk_snapshot_m1_time !=
            expected_terminal_m1_time &&
         !ReconcileAndObserveConcurrentRisk(shadow_index,
            expected_terminal_m1_time, "terminal_reconciliation"))
         return false;
      final_flat = AllGridsFlat(shadow_index);
      datetime terminal_mark_m1 = expected_terminal_m1_time;
      if(final_flat)
      {
         if(m_portfolios[shadow_index].reservation_minor != 0 ||
            m_portfolios[shadow_index].margin_minor != 0 ||
            m_portfolios[shadow_index].marked_liquidation_minor != 0 ||
            m_portfolios[shadow_index].estimated_close_cost_minor != 0)
            return false;
         if(m_portfolios[shadow_index].close_owner !=
            LP_REVMA_DISCOVERY_CLOSE_NONE)
         {
            if(!m_portfolios[shadow_index].cycle_reset_required ||
               m_portfolios[shadow_index].cycle_flat_m1_time <= 0)
               return false;
         }
         else if(m_portfolios[shadow_index].cycle_reset_required)
            return false;
         for(int symbol_id = 0; symbol_id < LP_SYMBOL_COUNT; symbol_id++)
         {
            if(m_grids[shadow_index][symbol_id].last_flat_m1_time >
               expected_terminal_m1_time)
               return false;
         }
      }
      else
      {
         if(m_portfolios[shadow_index].cycle_reset_required)
            return false;
         for(int symbol_id = 0; symbol_id < LP_SYMBOL_COUNT; symbol_id++)
         {
            LP_RevmaShadowGrid grid =
               m_grids[shadow_index][symbol_id];
            if(!grid.active)
               continue;
            if(grid.last_mark_m1_time <= 0 || !grid.path_geometry.valid ||
               grid.path_geometry.last_observation_m1 !=
                  expected_terminal_m1_time ||
               (branch == LP_REVMA_BRANCH_C &&
                (!grid.center_support.valid ||
                 grid.center_support.last_observation_m1 !=
                    expected_terminal_m1_time)))
               return false;
            if(grid.last_mark_m1_time != expected_terminal_m1_time)
               return false;
         }
      }

      LP_RevmaShadowPortfolioState portfolio =
         m_portfolios[shadow_index];
      ulong terminal_evidence_hash = LP_RevmaTerminalGridEventSetSeed(
         branch, portfolio.cycle_id, expected_terminal_m1_time);
      for(int symbol_id = 0; symbol_id < LP_SYMBOL_COUNT; symbol_id++)
      {
         LP_RevmaShadowGrid evidence_grid =
            m_grids[shadow_index][symbol_id];
         if(evidence_grid.branch_grid_id == 0 ||
            evidence_grid.branch_cycle_id != portfolio.cycle_id)
         {
            if(!LP_RevmaTerminalGridEventSetMix(terminal_evidence_hash,
               symbol_id, 0, 0, 0, 0, 0))
               return false;
            continue;
         }
          if(evidence_grid.terminal_event_hash == 0 ||
             evidence_grid.terminal_projection_hash == 0 ||
             evidence_grid.terminal_internal_state_hash == 0 ||
             evidence_grid.terminal_evidence_m1_time <= 0 ||
            evidence_grid.terminal_evidence_m1_time >
               expected_terminal_m1_time ||
             (evidence_grid.active &&
              evidence_grid.terminal_evidence_m1_time !=
                 expected_terminal_m1_time) ||
             (evidence_grid.active &&
              evidence_grid.terminal_internal_state_hash !=
                 TerminalGridInternalStateHash(evidence_grid,
                    expected_terminal_m1_time,
                    "run_boundary_unresolved")) ||
             !LP_RevmaTerminalGridEventSetMix(terminal_evidence_hash,
                symbol_id, evidence_grid.branch_grid_id,
                evidence_grid.terminal_evidence_m1_time,
                evidence_grid.terminal_projection_hash,
                evidence_grid.terminal_internal_state_hash,
                evidence_grid.terminal_event_hash))
            return false;
      }
      terminal_grid_state_hash =
         LP_RevmaTerminalGridEventSetFinalize(terminal_evidence_hash);
      long total_cost_minor = 0;
      int current_atoms = 0;
      double current_lots = 0.0;
      if(terminal_grid_state_hash == 0 ||
         !GetConcurrentRiskState(branch, expected_terminal_m1_time,
            terminal_risk) ||
         !LP_RevmaSafeMinorAdd(portfolio.estimated_close_cost_minor,
            portfolio.realized_close_cost_minor, total_cost_minor))
         return false;
      for(int symbol_id = 0; symbol_id < LP_SYMBOL_COUNT; symbol_id++)
      {
         if(m_grids[shadow_index][symbol_id].atom_count < 0 ||
            current_atoms > 2147483647 -
               m_grids[shadow_index][symbol_id].atom_count)
            return false;
         current_atoms += m_grids[shadow_index][symbol_id].atom_count;
         current_lots += m_grids[shadow_index][symbol_id].total_lots;
      }
      if(!MathIsValidNumber(current_lots))
         return false;
      current_lots = NormalizeDouble(current_lots, 2);
      terminal_book_hash = LP_RevmaDiscoveryTerminalBookIdentity(
         branch, portfolio.cycle_id, expected_terminal_m1_time,
         final_flat, current_atoms, current_lots,
         portfolio.equity_reference_minor, portfolio.capital_budget_minor,
         portfolio.realized_harvest_minor,
         portfolio.realized_nonharvest_minor,
         portfolio.marked_liquidation_minor, total_cost_minor,
         portfolio.reservation_minor, portfolio.margin_minor,
         portfolio.branch_equity_minor, portfolio.close_owner,
         portfolio.cleanup_shortfall, portfolio.hard_risk_latched,
         terminal_risk, terminal_grid_state_hash);
      return terminal_book_hash != 0;
   }

   bool MatchedBranchesTerminalReconciled(
      const datetime expected_terminal_m1_time,
      bool &u_final_flat,
      ulong &u_terminal_grid_state_hash,
      LP_RevmaConcurrentBranchRiskState &u_terminal_risk,
      ulong &u_terminal_book_hash,
      bool &c_final_flat,
      ulong &c_terminal_grid_state_hash,
      LP_RevmaConcurrentBranchRiskState &c_terminal_risk,
      ulong &c_terminal_book_hash)
   {
      u_final_flat = false;
      c_final_flat = false;
      u_terminal_grid_state_hash = 0;
      c_terminal_grid_state_hash = 0;
      u_terminal_book_hash = 0;
      c_terminal_book_hash = 0;
      LP_ResetRevmaConcurrentBranchRiskState(u_terminal_risk);
      LP_ResetRevmaConcurrentBranchRiskState(c_terminal_risk);
      if(!m_causal_matching_open)
      {
         bool u_ok = BranchTerminalReconciled(LP_REVMA_BRANCH_U,
            expected_terminal_m1_time, u_final_flat,
            u_terminal_grid_state_hash, u_terminal_risk,
            u_terminal_book_hash);
         bool c_ok = u_ok && BranchTerminalReconciled(LP_REVMA_BRANCH_C,
            expected_terminal_m1_time, c_final_flat,
            c_terminal_grid_state_hash, c_terminal_risk,
            c_terminal_book_hash);
         return u_ok && c_ok;
      }
      if(!BeginMatchedMutationScope()) return false;
      bool u_ok = BranchTerminalReconciled(LP_REVMA_BRANCH_U,
         expected_terminal_m1_time, u_final_flat,
         u_terminal_grid_state_hash, u_terminal_risk,
         u_terminal_book_hash);
      bool c_ok = u_ok && BranchTerminalReconciled(LP_REVMA_BRANCH_C,
         expected_terminal_m1_time, c_final_flat,
         c_terminal_grid_state_hash, c_terminal_risk,
         c_terminal_book_hash);
      return EndMatchedMutationScope(u_ok && c_ok, -1, true);
   }

   long NextGridGeneration(const int branch, const int symbol_id)
   {
      int shadow_index = LP_RevmaShadowIndex(branch);
      if(shadow_index < 0 || symbol_id < 0 || symbol_id >= LP_SYMBOL_COUNT ||
         m_grid_generation[shadow_index][symbol_id] >=
            LP_REVMA_MINOR_ABS_LIMIT)
         return 0;
      return m_grid_generation[shadow_index][symbol_id] + 1;
   }

   bool CausalMatchingOpen() { return m_causal_matching_open; }
   datetime FirstCausalDivergenceM1()
   {
      return m_first_causal_divergence_m1;
   }
   ulong FirstCausalDivergenceOpportunityId()
   {
      return m_first_causal_divergence_opportunity_id;
   }

   bool BranchValid(const int branch)
   {
      int shadow_index = LP_RevmaShadowIndex(branch);
      return shadow_index >= 0 && m_portfolios[shadow_index].valid;
   }

   string BranchInvalidReason(const int branch)
   {
      int shadow_index = LP_RevmaShadowIndex(branch);
      return shadow_index >= 0 ? m_portfolios[shadow_index].invalid_reason :
         "invalid_shadow_branch";
   }

   int CandidateCount(const int branch)
   {
      int shadow_index = LP_RevmaShadowIndex(branch);
      return shadow_index >= 0 ? m_candidate_count[shadow_index] : 0;
   }

   bool GetCandidate(const int branch, const int index, LP_RevmaShadowCandidate &candidate)
   {
      int shadow_index = LP_RevmaShadowIndex(branch);
      if(shadow_index < 0 || index < 0 || index >= m_candidate_count[shadow_index])
         return false;
      candidate = m_candidates[shadow_index][index];
      return true;
   }
};

#endif // __LIMNI_PORTFOLIO_REVMA_SHADOW_PORTFOLIO_MQH__
