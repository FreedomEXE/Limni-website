/*-----------------------------------------------
  Gate 108 bounded real execution book (R)
-----------------------------------------------*/
#ifndef __LIMNI_PORTFOLIO_REVMA_REAL_PORTFOLIO_MQH__
#define __LIMNI_PORTFOLIO_REVMA_REAL_PORTFOLIO_MQH__

#include "RevmaDiscoveryValuation.mqh"
#include "RevmaPathGeometry.mqh"
#include "RevmaCenterSupportPolicy.mqh"
#include "..\\..\\Portfolio\\GridBook.mqh"

struct LP_RevmaRealGrid
{
   bool valid;
   bool active;
   bool flat;
   bool close_execution_pending;
   datetime close_staged_source_m1_time;
   bool partial_reconciliation_valuation_stale;
   int symbol_id;
   int direction;
   int sleeve;
   int variant_id;
   ulong broker_grid_key;
   ulong branch_grid_id;
   ulong branch_cycle_id;
   long grid_generation;
   ulong birth_signal_identity_hash;
   ulong birth_matched_snapshot_hash;
   ulong birth_strategy_state_identity_hash;
   ulong last_observed_strategy_state_identity_hash;
   ulong birth_shared_snapshot_hash;
   datetime birth_m1_time;
   datetime initial_history_boundary;
   datetime last_admission_m1_time;
   ulong last_admission_identity;
   int atom_count;
   int peak_atom_count;
   bool atom_slot_active[LP_REVMA_REAL_MAX_ATOMS_PER_GRID];
   ulong atom_position_id[LP_REVMA_REAL_MAX_ATOMS_PER_GRID];
   long atom_open_deal_money_minor[LP_REVMA_REAL_MAX_ATOMS_PER_GRID];
   int adverse_add_count;
   int favorable_add_count;
   double total_lots;
   double weighted_entry_price_lots;
   double average_entry_price;
   double minimum_entry_price;
   double maximum_entry_price;
   double p0;
   double c0;
   double q0;
   double stress_reference_price;
   double broker_tick_size;
   long a_g_candidate_minor;
   long a_g_minor;
   long candidate_reservation_minor;
   long reservation_minor;
   long peak_reservation_minor;
   long q_cash_minor;
   long peak_q_cash_minor;
   long margin_minor;
   long peak_margin_minor;
   long marked_liquidation_minor;
   long estimated_close_cost_minor;
   long partial_realized_closed_atom_minor;
   long realized_all_deals_minor;
   long realized_cost_minor;
   long realized_swap_minor;
   long maximum_adverse_excursion_minor;
   int time_underwater_minutes;
   bool excursion_completed;
   int close_owner;
   string origin_terminal_reason;
   datetime close_trigger_m1_time;
   datetime last_mark_m1_time;
   datetime last_local_harvest_evaluation_m1_time;
   datetime last_positive_liquidation_opportunity_m1;
   datetime last_flat_m1_time;
   bool reentry_requires_identity_transition;
   ulong reentry_identity_at_close;
   ulong reentry_last_observed_identity;
   datetime reentry_last_identity_observation_m1;
   datetime reentry_transition_m1;
   ulong terminal_internal_state_hash;
   ulong terminal_projection_hash;
   ulong terminal_event_hash;
   datetime terminal_evidence_m1_time;
   LP_RevmaCenterSupportState center_support;
   LP_RevmaDiscoveryMesh mesh;
   LP_RevmaPathGeometryState path;
};

void LP_ResetRevmaRealGrid(LP_RevmaRealGrid &grid, const int symbol_id)
{
   ZeroMemory(grid);
   grid.valid = true;
   grid.active = false;
   grid.flat = true;
   grid.symbol_id = symbol_id;
   grid.direction = LP_SIDE_NONE;
   grid.sleeve = LP_REVMA_SLEEVE_NONE;
   grid.variant_id = LP_VARIANT_NONE;
   grid.close_owner = LP_REVMA_DISCOVERY_CLOSE_NONE;
   LP_ResetRevmaCenterSupportState(grid.center_support);
   LP_ResetRevmaDiscoveryMesh(grid.mesh);
   LP_ResetRevmaPathGeometryState(grid.path);
}

struct LP_RevmaRealCandidate
{
   bool valid;
   bool birth;
   bool allocated;
   bool staged;
   bool terminal;
   int decision;
   string decision_reason;
   ulong intent_id;
   int symbol_id;
   int direction;
   int sleeve;
   int variant_id;
   int candidate_type;
   ulong broker_grid_key;
   ulong branch_grid_id;
   ulong branch_cycle_id;
   long grid_generation;
   ulong candidate_identity;
   ulong strategy_state_identity_hash;
   ulong pre_candidate_state_hash;
   ulong matched_snapshot_hash;
   ulong shared_snapshot_hash;
   datetime source_m1_time;
   double p0;
   double c0;
   double q0;
   double stress_price;
   double fill_proxy_price;
   double liquidation_price;
   double broker_tick_size;
   long a_g_candidate_minor;
   long incremental_reservation_minor;
   long incremental_margin_minor;
   long incremental_liquidation_minor;
   long incremental_close_cost_minor;
   long prospective_concentration_q_cash_minor;
   int prospective_concentration_currency_id;
   datetime initial_history_boundary;
   bool execution_committed;
   double actual_fill_price;
   long actual_a_g_minor;
   long actual_incremental_margin_minor;
   long actual_incremental_liquidation_minor;
   long actual_incremental_close_cost_minor;
   long actual_commission_minor;
   long actual_swap_minor;
   ulong telemetry_matched_snapshot_hash;
   ulong telemetry_event_hash;
   LP_RevmaCompletedM1Snapshot snapshot;
};

void LP_ResetRevmaRealCandidate(LP_RevmaRealCandidate &candidate)
{
   ZeroMemory(candidate);
   candidate.valid = false;
   candidate.symbol_id = -1;
   candidate.direction = LP_SIDE_NONE;
   candidate.sleeve = LP_REVMA_SLEEVE_NONE;
   candidate.variant_id = LP_VARIANT_NONE;
   candidate.candidate_type = LP_REVMA_DISCOVERY_CANDIDATE_NONE;
   candidate.decision = LP_REVMA_DISCOVERY_DECISION_NONE;
   candidate.prospective_concentration_currency_id = -1;
   candidate.decision_reason = "not_evaluated";
   LP_ResetRevmaCompletedM1Snapshot(candidate.snapshot);
}

struct LP_RevmaRealPortfolioState
{
   bool valid;
   bool initialized;
   bool batch_open;
   bool allocation_complete;
   bool capacity_overrun;
   bool formula_clean;
   string first_routing_failure;
   string invalid_reason;
   ulong cycle_id;
   datetime batch_m1_time;
   double money_quantum;
   long equity_reference_minor;
   long capital_budget_minor;
   long realized_harvest_minor;
   long realized_nonharvest_minor;
   long realized_cleanup_minor;
   long realized_hard_risk_minor;
   long marked_liquidation_minor;
   long reservation_minor;
   long margin_minor;
   long branch_equity_minor;
   long realized_cost_minor;
   long run_realized_cost_minor;
   int close_owner;
   bool hard_risk_latched;
   bool cleanup_shortfall;
   bool cycle_reset_required;
   datetime cycle_flat_m1_time;
   long confirmed_flat_equity_minor;
   datetime last_close_authority_evaluation_m1_time;
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
   long peak_margin_minor;
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
   ulong run_candidate_diag_invalid_revma_classification_count;
   ulong run_candidate_diag_session_ineligible_count;
   ulong run_candidate_diag_news_ineligible_count;
   ulong run_candidate_diag_reentry_blocked_count;
   ulong run_candidate_diag_already_exposed_capacity_blocked_count;
   ulong run_candidate_diag_other_invariant_failure_count;
   string run_candidate_diag_first_invalid_revma_classification;
   string run_candidate_diag_first_session_ineligible;
   string run_candidate_diag_first_news_ineligible;
   string run_candidate_diag_first_reentry_blocked;
   string run_candidate_diag_first_already_exposed_capacity_blocked;
   string run_candidate_diag_first_other_invariant_failure;
};

void LP_ResetRevmaRealPortfolioState(LP_RevmaRealPortfolioState &state)
{
   ZeroMemory(state);
   state.valid = false;
   state.initialized = false;
   state.invalid_reason = "not_initialized";
   state.formula_clean = true;
   state.close_owner = LP_REVMA_DISCOVERY_CLOSE_NONE;
   state.concentration_currency_id = -1;
   state.peak_concentration_currency_id = -1;
   state.run_peak_concentration_currency_id = -1;
   state.cycle_risk_snapshot_hash = LP_RevmaDiscoveryFormulaHash();
   state.run_risk_snapshot_hash = LP_RevmaDiscoveryFormulaHash();
}

class LP_RevmaRealPortfolio
{
private:
   LP_RevmaRealGrid m_grids[LP_SYMBOL_COUNT];
   LP_RevmaRealCandidate m_candidates[LP_SYMBOL_COUNT];
   LP_RevmaRealPortfolioState m_portfolio;
   long m_grid_generation[LP_SYMBOL_COUNT];
   int m_candidate_count;

   void Invalidate(const string reason)
   {
      m_portfolio.valid = false;
      m_portfolio.batch_open = false;
      m_portfolio.allocation_complete = false;
      if(m_portfolio.invalid_reason == "" ||
         m_portfolio.invalid_reason == "not_initialized")
         m_portfolio.invalid_reason = reason == "" ?
            "real_book_invalid_unspecified" : reason;
   }

   bool RollbackRoutedFillCommit(
      const int symbol_id,
      const int candidate_index,
      const LP_RevmaRealGrid &previous_grid,
      const LP_RevmaRealCandidate &previous_candidate,
      const LP_RevmaRealPortfolioState &previous_portfolio,
      const long previous_generation,
      const string reason)
   {
      if(symbol_id >= 0 && symbol_id < LP_SYMBOL_COUNT)
      {
         m_grids[symbol_id] = previous_grid;
         m_grid_generation[symbol_id] = previous_generation;
      }
      if(candidate_index >= 0 && candidate_index < LP_SYMBOL_COUNT)
         m_candidates[candidate_index] = previous_candidate;
      m_portfolio = previous_portfolio;
      Invalidate(reason);
      return false;
   }

   bool SafeAdd(const long left, const long right, long &result)
   {
      result = 0;
      if(left > LP_REVMA_DISCOVERY_MINOR_ABS_LIMIT ||
         left < -LP_REVMA_DISCOVERY_MINOR_ABS_LIMIT ||
         right > LP_REVMA_DISCOVERY_MINOR_ABS_LIMIT ||
         right < -LP_REVMA_DISCOVERY_MINOR_ABS_LIMIT ||
         (right > 0 &&
          left > LP_REVMA_DISCOVERY_MINOR_ABS_LIMIT - right) ||
         (right < 0 &&
          left < -LP_REVMA_DISCOVERY_MINOR_ABS_LIMIT - right))
         return false;
      result = left + right;
      return true;
   }

   bool SafeMultiply(const long value, const int count, long &result)
   {
      result = 0;
      if(value < 0 || count < 0 ||
         (count > 0 &&
          value > LP_REVMA_DISCOVERY_MINOR_ABS_LIMIT / count))
         return false;
      result = value * count;
      return true;
   }

   int ActiveAtomSlotCount(const LP_RevmaRealGrid &grid)
   {
      int count = 0;
      for(int slot = 0; slot < LP_REVMA_REAL_MAX_ATOMS_PER_GRID; slot++)
      {
         if(grid.atom_slot_active[slot])
         {
            if(grid.atom_position_id[slot] == 0)
               return -1;
            count++;
         }
         else if(grid.atom_position_id[slot] == 0 &&
            grid.atom_open_deal_money_minor[slot] != 0)
            return -1;
      }
      return count;
   }

   bool HasPartialReconciliationValuationStale()
   {
      for(int symbol_id = 0; symbol_id < LP_SYMBOL_COUNT; symbol_id++)
      {
         if(m_grids[symbol_id].partial_reconciliation_valuation_stale)
            return true;
      }
      return false;
   }

   bool Increment(ulong &value)
   {
      if(value >= (ulong)LP_REVMA_DISCOVERY_MINOR_ABS_LIMIT)
         return false;
      value++;
      return true;
   }

   void RecordCandidateDiagnostic(
      ulong &count,
      string &first_example,
      const LP_RevmaCompletedM1Snapshot &snapshot,
      const string reason)
   {
      if(count < (ulong)LP_REVMA_DISCOVERY_MINOR_ABS_LIMIT)
         count++;
      if(first_example == "")
         first_example = "symbol=" + LP_CanonicalSymbol(snapshot.symbol_id) +
            "|source_m1_time=" + LP_Stamp(snapshot.source_m1_time) +
            "|reason=" + reason;
   }

   bool RecordBuilt()
   {
      if(!Increment(m_portfolio.cycle_candidate_built_count) ||
         !Increment(m_portfolio.run_candidate_built_count))
      {
         Invalidate("real_candidate_built_count_overflow");
         return false;
      }
      return true;
   }

   bool RecordDecision(const bool admitted)
   {
      if(!Increment(m_portfolio.cycle_candidate_decision_count) ||
         !Increment(m_portfolio.run_candidate_decision_count) ||
         (admitted &&
          (!Increment(m_portfolio.cycle_candidate_admitted_count) ||
           !Increment(m_portfolio.run_candidate_admitted_count))) ||
         (!admitted &&
          (!Increment(m_portfolio.cycle_candidate_rejected_count) ||
           !Increment(m_portfolio.run_candidate_rejected_count))))
      {
         Invalidate("real_candidate_decision_count_overflow");
         return false;
      }
      return true;
   }

   bool RecordInventoryTransition()
   {
      if(!Increment(m_portfolio.cycle_inventory_transition_count) ||
         !Increment(m_portfolio.run_inventory_transition_count))
      {
         Invalidate("real_inventory_transition_count_overflow");
         return false;
      }
      return true;
   }

   ulong EconomicStateHash(const int symbol_id)
   {
      if(symbol_id < 0 || symbol_id >= LP_SYMBOL_COUNT)
         return 0;
      LP_RevmaRealGrid grid = m_grids[symbol_id];
      ulong hash = LP_HashString("gate108_R_pre_candidate_state_v1");
      LP_HashMixInt(hash, symbol_id);
      LP_HashMixInt(hash, grid.active ? 1 : 0);
      LP_HashMixInt(hash, grid.flat ? 1 : 0);
      LP_HashMixInt(hash, grid.direction);
      LP_HashMixInt(hash, grid.atom_count);
      LP_HashMixULong(hash,
         LP_HashString(DoubleToString(grid.total_lots, 2)));
      LP_HashMixLong(hash, grid.q_cash_minor);
      LP_HashMixLong(hash, grid.reservation_minor);
      LP_HashMixLong(hash, grid.margin_minor);
      LP_HashMixLong(hash, grid.marked_liquidation_minor);
      LP_HashMixInt(hash, grid.close_owner);
      LP_HashMixInt(hash, grid.close_execution_pending ? 1 : 0);
      LP_HashMixLong(hash, (long)grid.close_staged_source_m1_time);
      LP_HashMixInt(hash,
         grid.partial_reconciliation_valuation_stale ? 1 : 0);
      LP_HashMixULong(hash, grid.last_observed_strategy_state_identity_hash);
      LP_HashMixULong(hash, LP_HashString(grid.origin_terminal_reason));
      LP_HashMixLong(hash, m_portfolio.reservation_minor);
      LP_HashMixLong(hash, m_portfolio.margin_minor);
      LP_HashMixLong(hash, m_portfolio.branch_equity_minor);
      LP_HashMixLong(hash, m_portfolio.realized_harvest_minor);
      LP_HashMixLong(hash, m_portfolio.realized_nonharvest_minor);
      LP_HashMixLong(hash, m_portfolio.marked_liquidation_minor);
      LP_HashMixInt(hash, m_portfolio.close_owner);
      LP_HashMixULong(hash, LP_RevmaDiscoveryFormulaHash());
      return hash;
   }

   ulong TerminalGridInternalStateHash(
      const LP_RevmaRealGrid &grid,
      const datetime terminal_m1_time,
      const string boundary_class)
   {
      if(!grid.valid || grid.branch_grid_id == 0 ||
         grid.branch_cycle_id == 0 || terminal_m1_time <= 0 ||
         grid.partial_reconciliation_valuation_stale ||
         !LP_RevmaDiscoveryTerminalReasonOwnerConsistent(
            grid.origin_terminal_reason, grid.close_owner) ||
         (boundary_class != "confirmed_flat_close" &&
          boundary_class != "run_boundary_unresolved") ||
         (grid.close_execution_pending !=
          (grid.close_staged_source_m1_time > 0)) ||
         (grid.close_staged_source_m1_time > terminal_m1_time) ||
         (grid.active && boundary_class != "run_boundary_unresolved") ||
         (!grid.active && (!grid.flat ||
          boundary_class != "confirmed_flat_close" ||
          grid.close_staged_source_m1_time != 0)))
         return 0;
      ulong hash = LP_HashString("gate108_R_terminal_grid_internal_v4");
      LP_HashMixInt(hash, grid.symbol_id);
      LP_HashMixULong(hash, grid.branch_grid_id);
      LP_HashMixULong(hash, grid.branch_cycle_id);
      LP_HashMixLong(hash, grid.grid_generation);
      LP_HashMixInt(hash, grid.direction);
      LP_HashMixInt(hash, grid.sleeve);
      LP_HashMixInt(hash, grid.variant_id);
      LP_HashMixLong(hash, (long)terminal_m1_time);
      LP_HashMixULong(hash, LP_HashString(boundary_class));
      LP_HashMixULong(hash, grid.birth_signal_identity_hash);
      LP_HashMixULong(hash, grid.birth_matched_snapshot_hash);
      LP_HashMixULong(hash, grid.birth_strategy_state_identity_hash);
      LP_HashMixULong(hash, grid.birth_shared_snapshot_hash);
      LP_HashMixLong(hash, (long)grid.birth_m1_time);
      LP_HashMixLong(hash, (long)grid.last_admission_m1_time);
      LP_HashMixInt(hash, grid.atom_count);
      LP_HashMixInt(hash, grid.peak_atom_count);
      LP_HashMixLong(hash, grid.peak_reservation_minor);
      LP_HashMixLong(hash, grid.peak_q_cash_minor);
      LP_HashMixLong(hash, grid.peak_margin_minor);
      LP_HashMixLong(hash, grid.realized_all_deals_minor);
      LP_HashMixLong(hash, grid.realized_cost_minor);
      LP_HashMixLong(hash, grid.realized_swap_minor);
      LP_HashMixLong(hash, grid.marked_liquidation_minor);
      LP_HashMixLong(hash, grid.maximum_adverse_excursion_minor);
      LP_HashMixInt(hash, grid.time_underwater_minutes);
      LP_HashMixInt(hash, grid.close_owner);
      LP_HashMixULong(hash, LP_HashString(grid.origin_terminal_reason));
      LP_HashMixLong(hash, (long)grid.close_trigger_m1_time);
      LP_HashMixInt(hash, grid.close_execution_pending ? 1 : 0);
      LP_HashMixLong(hash, (long)grid.close_staged_source_m1_time);
      for(int slot = 0; slot < LP_REVMA_REAL_MAX_ATOMS_PER_GRID; slot++)
      {
         LP_HashMixInt(hash, grid.atom_slot_active[slot] ? 1 : 0);
         LP_HashMixULong(hash, grid.atom_position_id[slot]);
         LP_HashMixLong(hash, grid.atom_open_deal_money_minor[slot]);
      }
      LP_HashMixULong(hash, LP_RevmaDiscoveryFormulaHash());
      return hash;
   }

   bool ReconcileMoney(const bool refresh_derived_views = false)
   {
      long reservation = 0;
      long margin = 0;
      long mark = 0;
      long q_cash = 0;
      int atoms = 0;
      int active_grids = 0;
      for(int symbol_id = 0; symbol_id < LP_SYMBOL_COUNT; symbol_id++)
      {
         LP_RevmaRealGrid grid = m_grids[symbol_id];
         int active_atom_slots = ActiveAtomSlotCount(grid);
         if(active_atom_slots < 0)
            return false;
         if(grid.close_execution_pending !=
               (grid.close_staged_source_m1_time > 0) ||
            (grid.close_staged_source_m1_time > 0 &&
             (grid.close_owner == LP_REVMA_DISCOVERY_CLOSE_NONE ||
              grid.close_staged_source_m1_time != grid.last_mark_m1_time)))
            return false;
         if(!grid.active)
         {
            if(!grid.flat || grid.atom_count != 0 || grid.total_lots != 0.0 ||
               grid.reservation_minor != 0 || grid.margin_minor != 0 ||
               grid.q_cash_minor != 0 || grid.marked_liquidation_minor != 0 ||
               active_atom_slots != 0)
               return false;
            continue;
         }
         if(grid.flat || grid.atom_count < 1 ||
            grid.atom_count > LP_REVMA_REAL_MAX_ATOMS_PER_GRID ||
            active_atom_slots != grid.atom_count ||
            NormalizeDouble(grid.total_lots, 2) != NormalizeDouble(
               (double)grid.atom_count * LP_REVMA_DISCOVERY_ATOM_LOTS, 2) ||
            grid.reservation_minor <= 0 || grid.margin_minor <= 0 ||
            grid.q_cash_minor != grid.a_g_minor * grid.atom_count ||
            !SafeAdd(reservation, grid.reservation_minor, reservation) ||
            !SafeAdd(margin, grid.margin_minor, margin) ||
            !SafeAdd(mark, grid.marked_liquidation_minor, mark) ||
            !SafeAdd(q_cash, grid.q_cash_minor, q_cash) ||
            atoms > 2147483647 - grid.atom_count)
            return false;
         atoms += grid.atom_count;
         active_grids++;
      }
      long realized = 0;
      long expected_equity = 0;
      if(!SafeAdd(m_portfolio.realized_harvest_minor,
            m_portfolio.realized_nonharvest_minor, realized) ||
         !SafeAdd(m_portfolio.equity_reference_minor, realized,
            expected_equity) ||
         !SafeAdd(expected_equity, mark, expected_equity))
         return false;
      bool authoritative_ledgers_clean =
         reservation == m_portfolio.reservation_minor &&
         margin == m_portfolio.margin_minor &&
         mark == m_portfolio.marked_liquidation_minor &&
         expected_equity >= 0;
      if(!authoritative_ledgers_clean)
         return false;
      if(refresh_derived_views)
      {
         m_portfolio.q_cash_minor = q_cash;
         m_portfolio.atom_count = atoms;
         m_portfolio.active_grid_count = active_grids;
         m_portfolio.branch_equity_minor = expected_equity;
         return true;
      }
      return m_portfolio.q_cash_minor == q_cash &&
         m_portfolio.atom_count == atoms &&
         m_portfolio.active_grid_count == active_grids &&
         m_portfolio.branch_equity_minor == expected_equity;
   }

   bool ObserveConcurrentRisk(
      const datetime source_m1_time,
      const string boundary)
   {
      if(!m_portfolio.valid || source_m1_time <= 0 ||
         ((long)source_m1_time % 60) != 0 || boundary == "" ||
         HasPartialReconciliationValuationStale() ||
         !ReconcileMoney())
         return false;
      long currency_q_cash[LP_CCY_COUNT];
      for(int ccy = 0; ccy < LP_CCY_COUNT; ccy++)
         currency_q_cash[ccy] = 0;
      for(int symbol_id = 0; symbol_id < LP_SYMBOL_COUNT; symbol_id++)
      {
         LP_RevmaRealGrid grid = m_grids[symbol_id];
         if(!grid.active)
            continue;
         if(grid.last_mark_m1_time != source_m1_time ||
            grid.path.last_observation_m1 != source_m1_time ||
            !grid.center_support.valid ||
            grid.center_support.last_observation_m1 != source_m1_time)
            return false;
         int base_ccy = -1;
         int quote_ccy = -1;
         LP_CanonicalBaseQuote(LP_CanonicalSymbol(symbol_id), base_ccy,
            quote_ccy);
         if(base_ccy < 0 || quote_ccy < 0 || base_ccy == quote_ccy ||
            !SafeAdd(currency_q_cash[base_ccy], grid.q_cash_minor,
               currency_q_cash[base_ccy]) ||
            !SafeAdd(currency_q_cash[quote_ccy], grid.q_cash_minor,
               currency_q_cash[quote_ccy]))
            return false;
      }
      long concentration = 0;
      int concentration_ccy = -1;
      for(int ccy = 0; ccy < LP_CCY_COUNT; ccy++)
      {
         m_portfolio.currency_q_cash_minor[ccy] = currency_q_cash[ccy];
         if(currency_q_cash[ccy] > concentration)
         {
            concentration = currency_q_cash[ccy];
            concentration_ccy = ccy;
         }
      }
      long liability = m_portfolio.marked_liquidation_minor < 0 ?
         -m_portfolio.marked_liquidation_minor : 0;
      if(m_portfolio.equity_high_water_minor <
         m_portfolio.branch_equity_minor)
         m_portfolio.equity_high_water_minor =
            m_portfolio.branch_equity_minor;
      if(m_portfolio.run_equity_high_water_minor <
         m_portfolio.branch_equity_minor)
         m_portfolio.run_equity_high_water_minor =
            m_portfolio.branch_equity_minor;
      long drawdown = m_portfolio.equity_high_water_minor -
         m_portfolio.branch_equity_minor;
      long run_drawdown = m_portfolio.run_equity_high_water_minor -
         m_portfolio.branch_equity_minor;
      if(drawdown < 0 || run_drawdown < 0)
         return false;
      m_portfolio.concentration_q_cash_minor = concentration;
      m_portfolio.concentration_currency_id = concentration_ccy;
      m_portfolio.liquidation_liability_minor = liability;
      m_portfolio.branch_drawdown_minor = drawdown;
#define LP_R_PEAK(field,value) if((value)>m_portfolio.field) m_portfolio.field=(value)
      LP_R_PEAK(peak_reservation_minor, m_portfolio.reservation_minor);
      LP_R_PEAK(peak_margin_minor, m_portfolio.margin_minor);
      LP_R_PEAK(peak_q_cash_minor, m_portfolio.q_cash_minor);
      LP_R_PEAK(peak_atom_count, m_portfolio.atom_count);
      LP_R_PEAK(peak_active_grid_count, m_portfolio.active_grid_count);
      if(concentration > m_portfolio.peak_concentration_q_cash_minor)
      {
         m_portfolio.peak_concentration_q_cash_minor = concentration;
         m_portfolio.peak_concentration_currency_id = concentration_ccy;
      }
      LP_R_PEAK(peak_liquidation_liability_minor, liability);
      LP_R_PEAK(maximum_branch_drawdown_minor, drawdown);
      LP_R_PEAK(run_peak_reservation_minor, m_portfolio.reservation_minor);
      LP_R_PEAK(run_peak_margin_minor, m_portfolio.margin_minor);
      LP_R_PEAK(run_peak_q_cash_minor, m_portfolio.q_cash_minor);
      LP_R_PEAK(run_peak_atom_count, m_portfolio.atom_count);
      LP_R_PEAK(run_peak_active_grid_count, m_portfolio.active_grid_count);
      if(concentration > m_portfolio.run_peak_concentration_q_cash_minor)
      {
         m_portfolio.run_peak_concentration_q_cash_minor = concentration;
         m_portfolio.run_peak_concentration_currency_id = concentration_ccy;
      }
      LP_R_PEAK(run_peak_liquidation_liability_minor, liability);
      LP_R_PEAK(run_maximum_branch_drawdown_minor, run_drawdown);
#undef LP_R_PEAK
      if(!Increment(m_portfolio.cycle_risk_snapshot_count) ||
         !Increment(m_portfolio.run_risk_snapshot_count))
         return false;
      ulong cycle_hash = m_portfolio.cycle_risk_snapshot_hash;
      ulong run_hash = m_portfolio.run_risk_snapshot_hash;
      LP_HashMixULong(cycle_hash, LP_HashString(boundary));
      LP_HashMixULong(run_hash, LP_HashString(boundary));
      LP_HashMixLong(cycle_hash, (long)source_m1_time);
      LP_HashMixLong(run_hash, (long)source_m1_time);
      LP_HashMixLong(cycle_hash, m_portfolio.reservation_minor);
      LP_HashMixLong(run_hash, m_portfolio.reservation_minor);
      LP_HashMixLong(cycle_hash, m_portfolio.margin_minor);
      LP_HashMixLong(run_hash, m_portfolio.margin_minor);
      LP_HashMixLong(cycle_hash, m_portfolio.q_cash_minor);
      LP_HashMixLong(run_hash, m_portfolio.q_cash_minor);
      LP_HashMixInt(cycle_hash, m_portfolio.atom_count);
      LP_HashMixInt(run_hash, m_portfolio.atom_count);
      LP_HashMixInt(cycle_hash, m_portfolio.active_grid_count);
      LP_HashMixInt(run_hash, m_portfolio.active_grid_count);
      LP_HashMixLong(cycle_hash, concentration);
      LP_HashMixLong(run_hash, concentration);
      LP_HashMixLong(cycle_hash, liability);
      LP_HashMixLong(run_hash, liability);
      LP_HashMixLong(cycle_hash, drawdown);
      LP_HashMixLong(run_hash, run_drawdown);
      if(cycle_hash == 0 || run_hash == 0)
         return false;
      m_portfolio.cycle_risk_snapshot_hash = cycle_hash;
      m_portfolio.run_risk_snapshot_hash = run_hash;
      m_portfolio.last_risk_snapshot_m1_time = source_m1_time;
      return true;
   }

   bool CandidateLess(
      const LP_RevmaRealCandidate &left,
      const LP_RevmaRealCandidate &right)
   {
      if(left.incremental_reservation_minor !=
         right.incremental_reservation_minor)
         return left.incremental_reservation_minor <
            right.incremental_reservation_minor;
      if(left.symbol_id != right.symbol_id)
         return left.symbol_id < right.symbol_id;
      return left.candidate_identity < right.candidate_identity;
   }

   void SortCandidates()
   {
      for(int i = 1; i < m_candidate_count; i++)
      {
         LP_RevmaRealCandidate value = m_candidates[i];
         int j = i - 1;
         while(j >= 0 && CandidateLess(value, m_candidates[j]))
         {
            m_candidates[j + 1] = m_candidates[j];
            j--;
         }
         m_candidates[j + 1] = value;
      }
   }

   bool ReentryEligible(
      const LP_RevmaRealGrid &grid,
      const datetime source_m1_time,
      const ulong strategy_state_identity)
   {
      if(grid.active || !grid.flat || source_m1_time <= grid.last_flat_m1_time)
         return false;
      if(grid.branch_grid_id == 0)
         return true;
      if(!grid.reentry_requires_identity_transition)
         return source_m1_time > grid.close_trigger_m1_time;
      return grid.reentry_transition_m1 > grid.last_flat_m1_time &&
         strategy_state_identity != grid.reentry_identity_at_close;
   }

   int FindCandidateByIntent(const ulong intent_id)
   {
      if(intent_id == 0)
         return -1;
      for(int i = 0; i < m_candidate_count; i++)
      {
         if(m_candidates[i].intent_id == intent_id)
            return i;
      }
      return -1;
   }

   bool RejectCandidate(const int index, const string reason)
   {
      if(index < 0 || index >= m_candidate_count || reason == "" ||
         m_candidates[index].terminal)
         return false;
      m_candidates[index].allocated = false;
      m_candidates[index].terminal = true;
      m_candidates[index].decision = LP_REVMA_DISCOVERY_DECISION_REJECT;
      m_candidates[index].decision_reason = reason;
      if(reason == "real_execution_two_atom_envelope_exhausted" ||
         reason == "fill_reconciliation_capacity_overrun_blocks_new_exposure" ||
         reason == "capital_budget_capacity_exhausted")
         RecordCandidateDiagnostic(
            m_portfolio.run_candidate_diag_already_exposed_capacity_blocked_count,
            m_portfolio.run_candidate_diag_first_already_exposed_capacity_blocked,
            m_candidates[index].snapshot, reason);
      return RecordDecision(false);
   }

   bool ActualFillValuation(
      const LP_RevmaRealCandidate &candidate,
      const double fill_price,
      long &a_g_minor,
      long &margin_minor,
      long &immediate_minor)
   {
      a_g_minor = 0;
      margin_minor = 0;
      immediate_minor = 0;
      if(fill_price <= 0.0 || candidate.q0 <= 0.0)
         return false;
      ENUM_ORDER_TYPE order_type = candidate.direction == LP_SIDE_LONG ?
         ORDER_TYPE_BUY : ORDER_TYPE_SELL;
      double adverse = candidate.direction == LP_SIDE_LONG ?
         fill_price - candidate.q0 : fill_price + candidate.q0;
      double q_profit = 0.0;
      double margin = 0.0;
      double liquidation = 0.0;
      if(adverse <= 0.0 ||
         !OrderCalcProfit(order_type, candidate.snapshot.broker_symbol,
            LP_REVMA_DISCOVERY_ATOM_LOTS, fill_price, adverse, q_profit) ||
         !OrderCalcMargin(order_type, candidate.snapshot.broker_symbol,
            LP_REVMA_DISCOVERY_ATOM_LOTS, fill_price, margin) ||
         !OrderCalcProfit(order_type, candidate.snapshot.broker_symbol,
            LP_REVMA_DISCOVERY_ATOM_LOTS, fill_price,
            candidate.liquidation_price, liquidation) ||
         q_profit >= 0.0 || margin <= 0.0 || liquidation > 0.0 ||
         !LP_RevmaDiscoveryMoneyBurdenToMinor(-q_profit,
            m_portfolio.money_quantum, a_g_minor) || a_g_minor <= 0 ||
         !LP_RevmaDiscoveryMoneyBurdenToMinor(margin,
            m_portfolio.money_quantum, margin_minor) || margin_minor <= 0 ||
         !LP_RevmaDiscoveryMoneyToSignedMinor(liquidation,
            m_portfolio.money_quantum, immediate_minor))
         return false;
      return true;
   }

public:
   LP_RevmaRealPortfolio()
   {
      Reset();
   }

   void Reset()
   {
      LP_ResetRevmaRealPortfolioState(m_portfolio);
      m_candidate_count = 0;
      for(int symbol_id = 0; symbol_id < LP_SYMBOL_COUNT; symbol_id++)
      {
         LP_ResetRevmaRealGrid(m_grids[symbol_id], symbol_id);
         LP_ResetRevmaRealCandidate(m_candidates[symbol_id]);
         m_grid_generation[symbol_id] = 0;
      }
   }

   bool Initialize(
      const long equity_reference_minor,
      const double money_quantum)
   {
      if(m_portfolio.initialized || equity_reference_minor <= 0 ||
         money_quantum <= 0.0 ||
         !LP_RevmaDiscoveryCapitalMandateValid())
         return false;
      long budget = 0;
      if(!LP_RevmaDiscoveryCapitalBudgetMinor(equity_reference_minor,
         budget))
         return false;
      LP_ResetRevmaRealPortfolioState(m_portfolio);
      m_portfolio.valid = true;
      m_portfolio.initialized = true;
      m_portfolio.invalid_reason = "";
      m_portfolio.cycle_id = 1;
      m_portfolio.money_quantum = money_quantum;
      m_portfolio.equity_reference_minor = equity_reference_minor;
      m_portfolio.capital_budget_minor = budget;
      m_portfolio.branch_equity_minor = equity_reference_minor;
      m_portfolio.equity_high_water_minor = equity_reference_minor;
      m_portfolio.run_equity_high_water_minor = equity_reference_minor;
      m_portfolio.confirmed_flat_equity_minor = equity_reference_minor;
      return true;
   }

   bool BeginNextCycle(
      const ulong next_cycle_id,
      const long confirmed_equity_minor,
      const datetime source_m1_time)
   {
      if(!m_portfolio.valid || !m_portfolio.initialized ||
         m_portfolio.batch_open || !m_portfolio.cycle_reset_required ||
         m_portfolio.active_grid_count != 0 ||
         m_portfolio.atom_count != 0 || m_portfolio.reservation_minor != 0 ||
         m_portfolio.margin_minor != 0 ||
         m_portfolio.marked_liquidation_minor != 0 ||
         source_m1_time <= m_portfolio.cycle_flat_m1_time ||
         confirmed_equity_minor != m_portfolio.branch_equity_minor ||
         confirmed_equity_minor !=
            m_portfolio.confirmed_flat_equity_minor ||
         m_portfolio.cycle_id >=
            (ulong)LP_REVMA_DISCOVERY_MINOR_ABS_LIMIT ||
         next_cycle_id != m_portfolio.cycle_id + 1)
      {
         Invalidate("real_next_cycle_boundary_invalid");
         return false;
      }
      long next_budget = 0;
      if(!LP_RevmaDiscoveryCapitalBudgetMinor(confirmed_equity_minor,
            next_budget))
      {
         Invalidate("real_next_cycle_budget_invalid");
         return false;
      }
      m_portfolio.cycle_id = next_cycle_id;
      m_portfolio.equity_reference_minor = confirmed_equity_minor;
      m_portfolio.capital_budget_minor = next_budget;
      m_portfolio.realized_harvest_minor = 0;
      m_portfolio.realized_nonharvest_minor = 0;
      m_portfolio.realized_cleanup_minor = 0;
      m_portfolio.realized_hard_risk_minor = 0;
      m_portfolio.realized_cost_minor = 0;
      m_portfolio.marked_liquidation_minor = 0;
      m_portfolio.reservation_minor = 0;
      m_portfolio.margin_minor = 0;
      m_portfolio.branch_equity_minor = confirmed_equity_minor;
      m_portfolio.close_owner = LP_REVMA_DISCOVERY_CLOSE_NONE;
      m_portfolio.hard_risk_latched = false;
      m_portfolio.cleanup_shortfall = false;
      m_portfolio.capacity_overrun = false;
      m_portfolio.cycle_reset_required = false;
      m_portfolio.cycle_flat_m1_time = 0;
      m_portfolio.confirmed_flat_equity_minor =
         confirmed_equity_minor;
      m_portfolio.last_close_authority_evaluation_m1_time = 0;
      m_portfolio.q_cash_minor = 0;
      m_portfolio.atom_count = 0;
      m_portfolio.active_grid_count = 0;
      for(int ccy = 0; ccy < LP_CCY_COUNT; ccy++)
         m_portfolio.currency_q_cash_minor[ccy] = 0;
      m_portfolio.concentration_q_cash_minor = 0;
      m_portfolio.concentration_currency_id = -1;
      m_portfolio.liquidation_liability_minor = 0;
      m_portfolio.equity_high_water_minor = confirmed_equity_minor;
      m_portfolio.branch_drawdown_minor = 0;
      m_portfolio.peak_reservation_minor = 0;
      m_portfolio.peak_margin_minor = 0;
      m_portfolio.peak_q_cash_minor = 0;
      m_portfolio.peak_atom_count = 0;
      m_portfolio.peak_active_grid_count = 0;
      m_portfolio.peak_concentration_q_cash_minor = 0;
      m_portfolio.peak_concentration_currency_id = -1;
      m_portfolio.peak_liquidation_liability_minor = 0;
      m_portfolio.maximum_branch_drawdown_minor = 0;
      m_portfolio.cycle_risk_snapshot_count = 0;
      m_portfolio.cycle_risk_snapshot_hash =
         LP_RevmaDiscoveryFormulaHash();
      m_portfolio.cycle_candidate_built_count = 0;
      m_portfolio.cycle_candidate_decision_count = 0;
      m_portfolio.cycle_candidate_admitted_count = 0;
      m_portfolio.cycle_candidate_rejected_count = 0;
      m_portfolio.cycle_inventory_transition_count = 0;
      m_candidate_count = 0;
      for(int i = 0; i < LP_SYMBOL_COUNT; i++)
         LP_ResetRevmaRealCandidate(m_candidates[i]);
      return ReconcileMoney();
   }

   bool ObserveCompletedM1(
      const LP_RevmaCompletedM1Snapshot &snapshot,
      LP_GridBook &grid_book)
   {
      if(!m_portfolio.valid || m_portfolio.batch_open ||
         !LP_RevmaCompletedM1SnapshotValid(snapshot))
      {
         Invalidate("real_observation_input_invalid");
         return false;
      }
      LP_RevmaRealGrid grid = m_grids[snapshot.symbol_id];
      if(!grid.active)
      {
         if(grid.reentry_requires_identity_transition &&
            snapshot.source_m1_time >
               grid.reentry_last_identity_observation_m1)
         {
            grid.reentry_last_observed_identity =
               snapshot.strategy_state_identity_hash;
            grid.reentry_last_identity_observation_m1 =
               snapshot.source_m1_time;
            if(snapshot.strategy_state_identity_hash !=
               grid.reentry_identity_at_close &&
               grid.reentry_transition_m1 == 0)
               grid.reentry_transition_m1 = snapshot.source_m1_time;
            m_grids[snapshot.symbol_id] = grid;
         }
         return true;
      }
      grid.last_observed_strategy_state_identity_hash =
         snapshot.strategy_state_identity_hash;
      LP_GridInventoryRow row;
      if(!grid_book.FindSymbolLaneGrid(snapshot.symbol_id, LP_LANE_REVMA,
            row) || row.grid_key != grid.broker_grid_key ||
         row.direction != grid.direction || row.variant_id != grid.variant_id ||
         row.position_count < 1 ||
         row.position_count > LP_REVMA_REAL_MAX_ATOMS_PER_GRID ||
         NormalizeDouble(row.lots, 2) != NormalizeDouble(
            (double)row.position_count * LP_REVMA_DISCOVERY_ATOM_LOTS, 2))
      {
         Invalidate("real_inventory_envelope_or_identity_mismatch");
         return false;
      }
      if(!LP_RevmaObserveCompletedM1Path(snapshot.decision_price,
         grid.broker_tick_size, grid.direction, snapshot.source_m1_time,
         grid.path))
      {
         Invalidate("real_path_observation_failed");
         return false;
      }
      if(!grid.center_support.valid ||
         !LP_RevmaObserveCenterSupport(snapshot.center,
            snapshot.current_q, snapshot.broker_tick_size,
            snapshot.signal.q_event_count, snapshot.source_m1_time,
            grid.center_support))
      {
         Invalidate("real_center_diagnostic_observation_failed");
         return false;
      }
      grid.center_support.adverse_adds_frozen = false;
      grid.center_support.latch_m1_time = 0;
      grid.center_support.adverse_adds_blocked_after_latch = 0;
      grid.center_support.last_blocked_candidate_identity = 0;
      grid.center_support.last_blocked_candidate_m1 = 0;
      if(MathAbs(grid.path.current_cell_index) >= 1)
         grid.excursion_completed = true;
      double snapshot_open_price = 0.0;
      double snapshot_liquidation_price = 0.0;
      double snapshot_slope = 0.0;
      long snapshot_a_g = 0;
      long snapshot_margin = 0;
      long snapshot_immediate = 0;
      if(!LP_RevmaSnapshotDirectionValues(snapshot, grid.direction,
            snapshot_open_price, snapshot_liquidation_price,
            snapshot_a_g, snapshot_margin, snapshot_immediate,
            snapshot_slope))
      {
         Invalidate("real_shared_snapshot_mark_valuation_failed");
         return false;
      }
      double shared_price_mark = (double)grid.direction *
         (snapshot_liquidation_price - row.avg_entry_price) *
         snapshot_slope * (double)row.position_count;
      long open_mark = 0;
      long posted_swap_commission = 0;
      long complete_mark = 0;
      if(!LP_RevmaDiscoveryMoneyToSignedMinor(shared_price_mark,
            m_portfolio.money_quantum, open_mark) ||
         !LP_RevmaDiscoveryMoneyToSignedMinor(row.swap + row.commission,
            m_portfolio.money_quantum, posted_swap_commission) ||
         !SafeAdd(open_mark, posted_swap_commission, complete_mark) ||
         !SafeAdd(complete_mark,
            grid.partial_realized_closed_atom_minor,
            complete_mark))
      {
         Invalidate("real_mark_minor_reconciliation_failed");
         return false;
      }
      long elapsed_seconds = grid.last_mark_m1_time > 0 ?
         (long)snapshot.source_m1_time - (long)grid.last_mark_m1_time : 0;
      if(elapsed_seconds < 0 || elapsed_seconds / 60 > 2147483647 ||
         (grid.marked_liquidation_minor < 0 &&
          grid.time_underwater_minutes >
             2147483647 - (int)(elapsed_seconds / 60)))
      {
         Invalidate("real_underwater_clock_overflow");
         return false;
      }
      if(grid.marked_liquidation_minor < 0)
         grid.time_underwater_minutes += (int)(elapsed_seconds / 60);
      long mark_delta = 0;
      long current_margin = 0;
      long margin_delta = 0;
      if(!SafeAdd(complete_mark, -grid.marked_liquidation_minor,
            mark_delta) ||
         !SafeMultiply(snapshot_margin, row.position_count,
            current_margin) ||
         !SafeAdd(current_margin, -grid.margin_minor, margin_delta) ||
         !SafeAdd(m_portfolio.marked_liquidation_minor,
            mark_delta, m_portfolio.marked_liquidation_minor) ||
         !SafeAdd(m_portfolio.margin_minor, margin_delta,
            m_portfolio.margin_minor))
      {
         Invalidate("real_portfolio_mark_margin_delta_overflow");
         return false;
      }
      grid.atom_count = row.position_count;
      grid.total_lots = row.lots;
      grid.average_entry_price = row.avg_entry_price;
      grid.weighted_entry_price_lots = row.avg_entry_price * row.lots;
      grid.minimum_entry_price = row.min_entry_price;
      grid.maximum_entry_price = row.max_entry_price;
      grid.q_cash_minor = grid.a_g_minor * grid.atom_count;
      grid.margin_minor = current_margin;
      grid.marked_liquidation_minor = complete_mark;
      if(complete_mark > 0)
         grid.last_positive_liquidation_opportunity_m1 =
            snapshot.source_m1_time;
      if(complete_mark < 0 && -complete_mark >
         grid.maximum_adverse_excursion_minor)
         grid.maximum_adverse_excursion_minor = -complete_mark;
      grid.last_mark_m1_time = snapshot.source_m1_time;
      grid.partial_reconciliation_valuation_stale = false;
      m_grids[snapshot.symbol_id] = grid;
      return ReconcileMoney(true);
   }

   bool EvaluateCloseAuthority(const datetime source_m1_time)
   {
      if(!m_portfolio.valid || m_portfolio.batch_open || source_m1_time <= 0 ||
         source_m1_time <=
            m_portfolio.last_close_authority_evaluation_m1_time ||
         !ObserveConcurrentRisk(source_m1_time,
            "completed_m1_mark_before_close_authority"))
      {
         Invalidate("real_close_authority_preflight_failed");
         return false;
      }
      long harvest_plus_liability = 0;
      long risk_mark = 0;
      if(!SafeAdd(m_portfolio.realized_harvest_minor,
            m_portfolio.marked_liquidation_minor,
            harvest_plus_liability))
      {
         Invalidate("real_close_authority_arithmetic_overflow");
         return false;
      }
      risk_mark = harvest_plus_liability;
      if((m_portfolio.close_owner == LP_REVMA_DISCOVERY_CLOSE_CLEANUP ||
          m_portfolio.close_owner == LP_REVMA_DISCOVERY_CLOSE_HARD_RISK) &&
         !SafeAdd(risk_mark, m_portfolio.realized_nonharvest_minor,
            risk_mark))
      {
         Invalidate("real_cleanup_risk_escalation_overflow");
         return false;
      }
      int next_owner = m_portfolio.close_owner;
      if(risk_mark <= -m_portfolio.capital_budget_minor)
         next_owner = LP_REVMA_DISCOVERY_CLOSE_HARD_RISK;
      else if(next_owner == LP_REVMA_DISCOVERY_CLOSE_NONE &&
         m_portfolio.realized_harvest_minor > 0 &&
         m_portfolio.marked_liquidation_minor < 0 &&
         harvest_plus_liability >= 0)
         next_owner = LP_REVMA_DISCOVERY_CLOSE_CLEANUP;
      if(next_owner != m_portfolio.close_owner)
      {
         if(m_portfolio.close_owner == LP_REVMA_DISCOVERY_CLOSE_HARD_RISK ||
            (m_portfolio.close_owner != LP_REVMA_DISCOVERY_CLOSE_NONE &&
             next_owner != LP_REVMA_DISCOVERY_CLOSE_HARD_RISK))
         {
            Invalidate("real_close_authority_deescalation_forbidden");
            return false;
         }
         for(int symbol_id = 0; symbol_id < LP_SYMBOL_COUNT; symbol_id++)
         {
            if(!m_grids[symbol_id].active)
               continue;
            if(!LP_RevmaDiscoveryTerminalReasonOwnerConsistent(
                  m_grids[symbol_id].origin_terminal_reason,
                  m_grids[symbol_id].close_owner) ||
               (m_grids[symbol_id].origin_terminal_reason != "" &&
                m_grids[symbol_id].close_trigger_m1_time <= 0))
            {
               Invalidate("real_origin_reason_owner_preflight_failed");
               return false;
            }
         }
         m_portfolio.close_owner = next_owner;
         if(next_owner == LP_REVMA_DISCOVERY_CLOSE_HARD_RISK)
            m_portfolio.hard_risk_latched = true;
         for(int symbol_id = 0; symbol_id < LP_SYMBOL_COUNT; symbol_id++)
         {
            if(!m_grids[symbol_id].active)
               continue;
            if(m_grids[symbol_id].origin_terminal_reason == "")
            {
               m_grids[symbol_id].origin_terminal_reason =
                  next_owner == LP_REVMA_DISCOVERY_CLOSE_CLEANUP ?
                     "account_cleanup" : "account_risk";
               m_grids[symbol_id].close_trigger_m1_time = source_m1_time;
            }
            m_grids[symbol_id].close_owner = next_owner;
         }
      }
      m_portfolio.last_close_authority_evaluation_m1_time = source_m1_time;
      return true;
   }

   bool EvaluateLocalHarvest(
      const int symbol_id,
      const datetime source_m1_time)
   {
      if(!m_portfolio.valid || symbol_id < 0 ||
         symbol_id >= LP_SYMBOL_COUNT ||
         m_portfolio.last_close_authority_evaluation_m1_time !=
            source_m1_time)
         return false;
      LP_RevmaRealGrid grid = m_grids[symbol_id];
      if(!grid.active)
         return true;
      if(grid.last_mark_m1_time != source_m1_time)
         return false;
      grid.last_local_harvest_evaluation_m1_time = source_m1_time;
      if(m_portfolio.close_owner == LP_REVMA_DISCOVERY_CLOSE_NONE &&
         grid.close_owner == LP_REVMA_DISCOVERY_CLOSE_NONE &&
         grid.excursion_completed && grid.marked_liquidation_minor >= 1)
      {
         grid.close_owner = LP_REVMA_DISCOVERY_CLOSE_LOCAL_HARVEST;
         grid.origin_terminal_reason = "grid_harvest";
         grid.close_trigger_m1_time = source_m1_time;
      }
      m_grids[symbol_id] = grid;
      return true;
   }

   bool BeginClosedM1Batch(const datetime source_m1_time)
   {
      if(!m_portfolio.valid || m_portfolio.batch_open ||
         m_portfolio.close_owner != LP_REVMA_DISCOVERY_CLOSE_NONE ||
         m_portfolio.last_close_authority_evaluation_m1_time !=
            source_m1_time || source_m1_time <= m_portfolio.batch_m1_time)
         return false;
      for(int symbol_id = 0; symbol_id < LP_SYMBOL_COUNT; symbol_id++)
      {
         if(m_grids[symbol_id].active &&
            (m_grids[symbol_id].last_mark_m1_time != source_m1_time ||
             m_grids[symbol_id].last_local_harvest_evaluation_m1_time !=
                source_m1_time))
            return false;
      }
      m_portfolio.batch_open = true;
      m_portfolio.allocation_complete = false;
      m_portfolio.batch_m1_time = source_m1_time;
      m_candidate_count = 0;
      for(int i = 0; i < LP_SYMBOL_COUNT; i++)
         LP_ResetRevmaRealCandidate(m_candidates[i]);
      return true;
   }

   bool BuildCandidate(const LP_RevmaCompletedM1Snapshot &snapshot)
   {
      if(!m_portfolio.valid || !m_portfolio.batch_open ||
         m_portfolio.allocation_complete ||
         snapshot.source_m1_time != m_portfolio.batch_m1_time ||
         !LP_RevmaCompletedM1SnapshotValid(snapshot))
      {
         RecordCandidateDiagnostic(
            m_portfolio.run_candidate_diag_other_invariant_failure_count,
            m_portfolio.run_candidate_diag_first_other_invariant_failure,
            snapshot, "build_input_invalid");
         return false;
      }
      LP_RevmaRealGrid grid = m_grids[snapshot.symbol_id];
      bool birth = !grid.active;
      int direction = birth ? snapshot.direction : grid.direction;
      int candidate_type = LP_REVMA_DISCOVERY_CANDIDATE_NONE;
      if(birth)
      {
         if(!snapshot.birth_eligible)
         {
            RecordCandidateDiagnostic(
               m_portfolio.run_candidate_diag_invalid_revma_classification_count,
               m_portfolio.run_candidate_diag_first_invalid_revma_classification,
               snapshot, "birth_eligible_false");
            return true;
         }
         if(!snapshot.session_allowed)
         {
            RecordCandidateDiagnostic(
               m_portfolio.run_candidate_diag_session_ineligible_count,
               m_portfolio.run_candidate_diag_first_session_ineligible,
               snapshot, "session_allowed_false");
            return true;
         }
         if(!snapshot.news_allowed)
         {
            RecordCandidateDiagnostic(
               m_portfolio.run_candidate_diag_news_ineligible_count,
               m_portfolio.run_candidate_diag_first_news_ineligible,
               snapshot, "news_allowed_false");
            return true;
         }
         if(!ReentryEligible(grid, snapshot.source_m1_time,
               snapshot.strategy_state_identity_hash))
         {
            RecordCandidateDiagnostic(
               m_portfolio.run_candidate_diag_reentry_blocked_count,
               m_portfolio.run_candidate_diag_first_reentry_blocked,
               snapshot, "reentry_ineligible");
            return true;
         }
         candidate_type = LP_REVMA_DISCOVERY_CANDIDATE_BIRTH;
      }
      else
      {
         if(grid.close_owner != LP_REVMA_DISCOVERY_CLOSE_NONE)
         {
            RecordCandidateDiagnostic(
               m_portfolio.run_candidate_diag_already_exposed_capacity_blocked_count,
               m_portfolio.run_candidate_diag_first_already_exposed_capacity_blocked,
               snapshot, "active_grid_close_owner");
            return true;
         }
         long decision_ticks = 0;
         long minimum_ticks = 0;
         long maximum_ticks = 0;
         if(!LP_RevmaPriceToTicks(snapshot.decision_price,
               grid.broker_tick_size, decision_ticks) ||
            !LP_RevmaPriceToTicks(grid.minimum_entry_price,
               grid.broker_tick_size, minimum_ticks) ||
            !LP_RevmaPriceToTicks(grid.maximum_entry_price,
               grid.broker_tick_size, maximum_ticks))
         {
            RecordCandidateDiagnostic(
               m_portfolio.run_candidate_diag_other_invariant_failure_count,
               m_portfolio.run_candidate_diag_first_other_invariant_failure,
               snapshot, "price_to_ticks_failed");
            return false;
         }
         long lower = minimum_ticks > grid.mesh.discovery_cell_ticks ?
            minimum_ticks - grid.mesh.discovery_cell_ticks : 0;
         long upper = maximum_ticks + grid.mesh.discovery_cell_ticks;
         bool adverse = direction == LP_SIDE_LONG ?
            (lower > 0 && decision_ticks <= lower) : decision_ticks >= upper;
         bool favorable = direction == LP_SIDE_LONG ?
            decision_ticks >= upper : (lower > 0 && decision_ticks <= lower);
         if(!adverse && !favorable)
         {
            RecordCandidateDiagnostic(
               m_portfolio.run_candidate_diag_already_exposed_capacity_blocked_count,
               m_portfolio.run_candidate_diag_first_already_exposed_capacity_blocked,
               snapshot, "active_grid_not_at_add_boundary");
            return true;
         }
         candidate_type = adverse ?
            LP_REVMA_DISCOVERY_CANDIDATE_ADVERSE_ADD :
            LP_REVMA_DISCOVERY_CANDIDATE_FAVORABLE_ADD;
      }
      if(m_candidate_count >= LP_SYMBOL_COUNT)
      {
         RecordCandidateDiagnostic(
            m_portfolio.run_candidate_diag_other_invariant_failure_count,
            m_portfolio.run_candidate_diag_first_other_invariant_failure,
            snapshot, "real_candidate_capacity_exhausted");
         Invalidate("real_candidate_capacity_exhausted");
         return false;
      }
      LP_RevmaRealCandidate candidate;
      LP_ResetRevmaRealCandidate(candidate);
      candidate.valid = true;
      candidate.birth = birth;
      candidate.symbol_id = snapshot.symbol_id;
      candidate.direction = direction;
      candidate.sleeve = birth ? snapshot.sleeve : grid.sleeve;
      candidate.variant_id = birth ? snapshot.variant_id : grid.variant_id;
      candidate.candidate_type = candidate_type;
      candidate.branch_cycle_id = m_portfolio.cycle_id;
      candidate.grid_generation = birth ?
         m_grid_generation[snapshot.symbol_id] + 1 : grid.grid_generation;
      candidate.pre_candidate_state_hash =
         EconomicStateHash(snapshot.symbol_id);
      candidate.branch_grid_id = LP_RevmaDiscoveryGridIdentity(
         LP_REVMA_BRANCH_R, snapshot.symbol_id, candidate.grid_generation,
         m_portfolio.cycle_id,
         birth ? snapshot.source_m1_time : grid.birth_m1_time,
         birth ? snapshot.signal_identity_hash :
            grid.birth_signal_identity_hash);
      candidate.candidate_identity = LP_RevmaDiscoveryAdmissionIdentity(
         LP_REVMA_BRANCH_R, candidate.branch_grid_id,
         snapshot.source_m1_time);
      int grid_family = (int)(candidate.branch_grid_id % 9000) + 1;
      candidate.broker_grid_key = birth ? LP_BuildGridKey(
         snapshot.symbol_id, LP_LANE_REVMA, candidate.variant_id,
         direction, grid_family) : grid.broker_grid_key;
      candidate.source_m1_time = snapshot.source_m1_time;
      candidate.strategy_state_identity_hash =
         snapshot.strategy_state_identity_hash;
      candidate.p0 = birth ? snapshot.decision_price : grid.p0;
      candidate.c0 = birth ? snapshot.center : grid.c0;
      candidate.q0 = birth ? snapshot.birth_q : grid.q0;
      candidate.stress_price = birth ?
         snapshot.stress_reference_price : grid.stress_reference_price;
      candidate.broker_tick_size = birth ?
         snapshot.broker_tick_size : grid.broker_tick_size;
      candidate.initial_history_boundary = birth ?
         snapshot.initial_history_boundary : grid.initial_history_boundary;
      long snapshot_a_g = 0;
      double slope = 0.0;
      if(!LP_RevmaSnapshotDirectionValues(snapshot, direction,
            candidate.fill_proxy_price, candidate.liquidation_price,
            snapshot_a_g, candidate.incremental_margin_minor,
            candidate.incremental_liquidation_minor, slope))
      {
         RecordCandidateDiagnostic(
            m_portfolio.run_candidate_diag_other_invariant_failure_count,
            m_portfolio.run_candidate_diag_first_other_invariant_failure,
            snapshot, "snapshot_direction_values_invalid");
         return false;
      }
      candidate.a_g_candidate_minor = birth ? snapshot_a_g :
         grid.a_g_candidate_minor;
      candidate.incremental_close_cost_minor = 0;
      candidate.incremental_reservation_minor = 0;
      if(birth && !SafeMultiply(candidate.a_g_candidate_minor, 2,
         candidate.incremental_reservation_minor))
      {
         RecordCandidateDiagnostic(
            m_portfolio.run_candidate_diag_other_invariant_failure_count,
            m_portfolio.run_candidate_diag_first_other_invariant_failure,
            snapshot, "birth_reservation_overflow");
         return false;
      }
      candidate.shared_snapshot_hash = snapshot.snapshot_hash;
      candidate.snapshot = snapshot;
      candidate.matched_snapshot_hash =
         LP_RevmaDiscoveryMatchedSnapshotIdentity(
            candidate.symbol_id, candidate.source_m1_time,
            candidate.direction, candidate.candidate_type,
            candidate.pre_candidate_state_hash,
            snapshot.signal_identity_hash, snapshot.signal.q_event_count,
            candidate.q0, snapshot.decision_price,
            candidate.stress_price, candidate.fill_proxy_price,
            candidate.p0, candidate.c0, candidate.broker_tick_size,
            candidate.a_g_candidate_minor,
            birth ? snapshot_a_g : grid.a_g_minor,
            candidate.incremental_margin_minor,
            candidate.incremental_liquidation_minor,
            candidate.incremental_close_cost_minor);
      if(candidate.branch_grid_id == 0 || candidate.broker_grid_key == 0 ||
         candidate.candidate_identity == 0 ||
          candidate.pre_candidate_state_hash == 0 ||
          candidate.strategy_state_identity_hash == 0 ||
         candidate.initial_history_boundary <= 0 ||
         candidate.initial_history_boundary > candidate.source_m1_time ||
         candidate.matched_snapshot_hash == 0)
      {
         RecordCandidateDiagnostic(
            m_portfolio.run_candidate_diag_other_invariant_failure_count,
            m_portfolio.run_candidate_diag_first_other_invariant_failure,
            snapshot, "candidate_identity_invalid");
         return false;
      }
      m_candidates[m_candidate_count++] = candidate;
      return RecordBuilt();
   }

   bool SortAndAllocate()
   {
      if(!m_portfolio.valid || !m_portfolio.batch_open ||
         m_portfolio.allocation_complete)
         return false;
      SortCandidates();
      long projected_reservation = m_portfolio.reservation_minor;
      long projected_currency_q_cash[LP_CCY_COUNT];
      for(int ccy = 0; ccy < LP_CCY_COUNT; ccy++)
         projected_currency_q_cash[ccy] =
            m_portfolio.currency_q_cash_minor[ccy];
      for(int i = 0; i < m_candidate_count; i++)
      {
         LP_RevmaRealGrid grid = m_grids[m_candidates[i].symbol_id];
         int base_ccy = -1;
         int quote_ccy = -1;
         LP_CanonicalBaseQuote(
            LP_CanonicalSymbol(m_candidates[i].symbol_id),
            base_ccy, quote_ccy);
         long prospective_base = 0;
         long prospective_quote = 0;
         if(base_ccy < 0 || base_ccy >= LP_CCY_COUNT ||
            quote_ccy < 0 || quote_ccy >= LP_CCY_COUNT ||
            base_ccy == quote_ccy ||
            !SafeAdd(projected_currency_q_cash[base_ccy],
               m_candidates[i].a_g_candidate_minor, prospective_base) ||
            !SafeAdd(projected_currency_q_cash[quote_ccy],
               m_candidates[i].a_g_candidate_minor, prospective_quote))
         {
            Invalidate("real_candidate_concentration_projection_failed");
            return false;
         }
         long prospective_concentration = 0;
         int prospective_concentration_ccy = -1;
         for(int ccy = 0; ccy < LP_CCY_COUNT; ccy++)
         {
            long value = ccy == base_ccy ? prospective_base :
               (ccy == quote_ccy ? prospective_quote :
                projected_currency_q_cash[ccy]);
            if(value > prospective_concentration)
            {
               prospective_concentration = value;
               prospective_concentration_ccy = ccy;
            }
         }
         m_candidates[i].prospective_concentration_q_cash_minor =
            prospective_concentration;
         m_candidates[i].prospective_concentration_currency_id =
            prospective_concentration_ccy;
         if(!m_candidates[i].birth &&
            grid.atom_count >= LP_REVMA_REAL_MAX_ATOMS_PER_GRID)
         {
            if(!RejectCandidate(i,
               "real_execution_two_atom_envelope_exhausted"))
               return false;
            continue;
         }
         long prospective = 0;
         if(m_portfolio.capacity_overrun ||
            !SafeAdd(projected_reservation,
               m_candidates[i].incremental_reservation_minor, prospective) ||
            prospective > m_portfolio.capital_budget_minor)
         {
            if(!RejectCandidate(i, m_portfolio.capacity_overrun ?
               "fill_reconciliation_capacity_overrun_blocks_new_exposure" :
               "capital_budget_capacity_exhausted"))
               return false;
            continue;
         }
         m_candidates[i].allocated = true;
         m_candidates[i].decision_reason = "capacity_allocated_pending_route";
         projected_reservation = prospective;
         projected_currency_q_cash[base_ccy] = prospective_base;
         projected_currency_q_cash[quote_ccy] = prospective_quote;
      }
      m_portfolio.allocation_complete = true;
      return true;
   }

   bool GetNextRoutableCandidate(LP_RevmaRealCandidate &candidate)
   {
      LP_ResetRevmaRealCandidate(candidate);
      if(!m_portfolio.valid || !m_portfolio.allocation_complete)
         return false;
      for(int i = 0; i < m_candidate_count; i++)
      {
         if(m_candidates[i].allocated && !m_candidates[i].staged &&
            !m_candidates[i].terminal)
         {
            if(m_portfolio.capacity_overrun)
            {
               if(!RejectCandidate(i,
                  "fill_reconciliation_capacity_overrun_blocks_new_exposure"))
                  return false;
               continue;
            }
            candidate = m_candidates[i];
            return true;
         }
      }
      return false;
   }

   bool StageCandidate(const ulong candidate_identity, const ulong intent_id)
   {
      if(candidate_identity == 0 || intent_id == 0)
         return false;
      for(int i = 0; i < m_candidate_count; i++)
      {
         if(m_candidates[i].candidate_identity != candidate_identity)
            continue;
         if(!m_candidates[i].allocated || m_candidates[i].staged ||
            m_candidates[i].terminal)
            return false;
         m_candidates[i].staged = true;
         m_candidates[i].intent_id = intent_id;
         return true;
      }
      return false;
   }

   bool AuthorizeBeforeRoute(
      const LP_TradeIntent &intent,
      bool &authorized)
   {
      authorized = false;
      if(!intent.gate108)
      {
         authorized = true;
         return true;
      }
      if(intent.discovery_branch != LP_REVMA_BRANCH_R)
      {
         Invalidate("real_pre_route_non_r_gate108_branch");
         return false;
      }
      if(intent.action != LP_INTENT_OPEN_GRID &&
         intent.action != LP_INTENT_ADD_GRID_LEG)
      {
         if(intent.action != LP_INTENT_CLOSE_GRID || intent.symbol_id < 0 ||
            intent.symbol_id >= LP_SYMBOL_COUNT)
         {
            Invalidate("real_pre_route_action_not_authorized");
            return false;
         }
         LP_RevmaRealGrid close_grid = m_grids[intent.symbol_id];
         if(!close_grid.active || !close_grid.close_execution_pending ||
            close_grid.broker_grid_key != intent.grid_key ||
            close_grid.branch_grid_id !=
               intent.discovery_branch_grid_id ||
            close_grid.birth_shared_snapshot_hash !=
               intent.discovery_shared_snapshot_hash ||
            close_grid.close_owner != intent.discovery_close_owner ||
            close_grid.origin_terminal_reason !=
               intent.discovery_origin_terminal_reason ||
            intent.discovery_source_m1_time <= 0 ||
            intent.discovery_source_m1_time !=
               close_grid.close_staged_source_m1_time ||
            intent.discovery_source_m1_time !=
               close_grid.last_mark_m1_time)
         {
            Invalidate("real_pre_route_close_identity_mismatch");
            return false;
         }
         authorized = true;
         return true;
      }
      int index = FindCandidateByIntent(intent.intent_id);
      if(index < 0)
      {
         Invalidate("real_pre_route_candidate_missing");
         return false;
      }
      LP_RevmaRealCandidate candidate = m_candidates[index];
      int expected_action = candidate.birth ? LP_INTENT_OPEN_GRID :
         LP_INTENT_ADD_GRID_LEG;
      if(!candidate.valid || !candidate.allocated || !candidate.staged ||
         candidate.terminal || candidate.intent_id != intent.intent_id ||
         intent.action != expected_action ||
         intent.symbol_id != candidate.symbol_id ||
         intent.lane_id != LP_LANE_REVMA ||
         intent.variant_id != candidate.variant_id ||
         intent.direction != candidate.direction ||
         intent.grid_key != candidate.broker_grid_key ||
         NormalizeDouble(intent.requested_lots, 2) !=
            LP_REVMA_DISCOVERY_ATOM_LOTS ||
         (int)MathRound(intent.max_slippage_points) !=
            LP_REVMA_DISCOVERY_MAX_SLIPPAGE_POINTS ||
         candidate.candidate_identity !=
             intent.discovery_candidate_identity ||
         candidate.branch_grid_id != intent.discovery_branch_grid_id ||
         candidate.shared_snapshot_hash !=
             intent.discovery_shared_snapshot_hash ||
         candidate.matched_snapshot_hash !=
            intent.discovery_matched_snapshot_hash ||
         candidate.pre_candidate_state_hash !=
            intent.discovery_pre_candidate_state_hash ||
         candidate.source_m1_time != intent.discovery_source_m1_time)
      {
         Invalidate("real_pre_route_candidate_identity_mismatch");
         return false;
      }
      if(m_candidates[index].terminal)
         return true;
      if(m_portfolio.capacity_overrun)
         return RejectCandidate(index,
            "fill_reconciliation_capacity_overrun_blocks_new_exposure");
      authorized = true;
      return true;
   }

   bool RecordExecution(
      const LP_TradePlan &plan,
      const LP_TradeExecutionResult &execution)
   {
      int index = FindCandidateByIntent(plan.intent_id);
      if(index < 0)
      {
         Invalidate("real_routed_candidate_missing");
         return false;
      }
      LP_RevmaRealCandidate candidate = m_candidates[index];
      if(!plan.gate108 || plan.discovery_branch != LP_REVMA_BRANCH_R ||
         plan.discovery_candidate_identity != candidate.candidate_identity ||
         plan.discovery_branch_grid_id != candidate.branch_grid_id ||
          plan.discovery_shared_snapshot_hash !=
             candidate.shared_snapshot_hash ||
          plan.discovery_matched_snapshot_hash !=
             candidate.matched_snapshot_hash ||
          plan.discovery_pre_candidate_state_hash !=
             candidate.pre_candidate_state_hash ||
          plan.discovery_source_m1_time != candidate.source_m1_time ||
          plan.symbol_id != candidate.symbol_id ||
          plan.lane_id != LP_LANE_REVMA ||
          plan.variant_id != candidate.variant_id ||
          plan.direction != candidate.direction ||
          plan.grid_key != candidate.broker_grid_key ||
          plan.action != (candidate.birth ? LP_INTENT_OPEN_GRID :
             LP_INTENT_ADD_GRID_LEG) ||
          NormalizeDouble(plan.lots, 2) != LP_REVMA_DISCOVERY_ATOM_LOTS ||
          (int)MathRound(plan.max_slippage_points) !=
             LP_REVMA_DISCOVERY_MAX_SLIPPAGE_POINTS)
      {
         Invalidate("real_routed_plan_identity_mismatch");
         return false;
      }
      if(!execution.order_send_attempted && !execution.session_open &&
         (execution.session_outcome ==
            "trade_session_closed_no_interval" ||
          execution.session_outcome ==
            "trade_session_closed_before_order_send"))
         return RejectCandidate(index,
            "broker_session_closed_before_order_send");
      bool exact_fill = execution.accepted && !execution.partial_fill &&
         !execution.broker_rejected && execution.order_send_attempted &&
         execution.session_open && execution.deal_set_complete &&
         execution.deal_linkage_clean && execution.deal_count > 0 &&
         execution.deal_set_hash != 0 &&
         NormalizeDouble(execution.executed_lots, 2) ==
            LP_REVMA_DISCOVERY_ATOM_LOTS && execution.executed_price > 0.0;
      bool possible_broker_mutation = execution.executed_lots > 0.0 ||
         execution.deal_ticket > 0 || execution.position_ticket > 0 ||
         execution.partial_fill || execution.retcode == TRADE_RETCODE_PLACED ||
         (execution.order_send_attempted && execution.order_ticket > 0);
      if(!exact_fill && execution.order_send_attempted)
      {
         m_portfolio.formula_clean = false;
         if(m_portfolio.first_routing_failure == "")
            m_portfolio.first_routing_failure =
               (possible_broker_mutation ?
                "broker_execution_ambiguous_after_order_send:" :
                "broker_zero_fill_rejection_after_order_send:") +
               IntegerToString((int)execution.retcode);
         Invalidate(possible_broker_mutation ?
            "real_post_send_execution_ambiguous_requires_reconciliation" :
            "real_post_send_zero_fill_rejection");
         return false;
      }
      if(!exact_fill)
      {
         Invalidate("real_routed_execution_not_exact_atom");
         return false;
      }
      LP_RevmaRealGrid previous_grid = m_grids[candidate.symbol_id];
      LP_RevmaRealCandidate previous_candidate = m_candidates[index];
      LP_RevmaRealPortfolioState previous_portfolio = m_portfolio;
      long previous_generation = m_grid_generation[candidate.symbol_id];
      LP_RevmaRealGrid grid = previous_grid;
      LP_RevmaRealCandidate next_candidate = previous_candidate;
      LP_RevmaRealPortfolioState next_portfolio = previous_portfolio;
      long actual_a_g = 0;
      long actual_margin = 0;
      long actual_mark = 0;
      if(!ActualFillValuation(candidate, execution.executed_price,
            actual_a_g, actual_margin, actual_mark))
      {
         Invalidate("real_actual_fill_valuation_failed");
         return false;
      }
      long deal_money = 0;
      long commission_fee = 0;
      long cost_burden = 0;
      long swap_minor = 0;
      if(!LP_RevmaDiscoveryMoneyToSignedMinor(
            execution.realized_profit + execution.realized_swap +
            execution.realized_commission + execution.realized_fee,
            m_portfolio.money_quantum, deal_money) ||
         !LP_RevmaDiscoveryMoneyToSignedMinor(
            execution.realized_commission + execution.realized_fee,
            m_portfolio.money_quantum, commission_fee) ||
         !LP_RevmaDiscoveryMoneyBurdenToMinor(MathMax(0.0,
            -(execution.realized_commission + execution.realized_fee)),
            m_portfolio.money_quantum, cost_burden) ||
         !LP_RevmaDiscoveryMoneyToSignedMinor(execution.realized_swap,
            m_portfolio.money_quantum, swap_minor))
      {
         Invalidate("real_open_deal_money_conversion_failed");
         return false;
      }
      if(candidate.birth)
      {
         if(grid.active || grid.atom_count != 0)
         {
            Invalidate("real_birth_post_fill_state_not_flat");
            return false;
         }
         LP_ResetRevmaRealGrid(grid, candidate.symbol_id);
         grid.active = true;
         grid.flat = false;
         grid.direction = candidate.direction;
         grid.sleeve = candidate.sleeve;
         grid.variant_id = candidate.variant_id;
         grid.broker_grid_key = candidate.broker_grid_key;
         grid.branch_grid_id = candidate.branch_grid_id;
         grid.branch_cycle_id = candidate.branch_cycle_id;
         grid.grid_generation = candidate.grid_generation;
         grid.birth_signal_identity_hash =
            candidate.snapshot.signal_identity_hash;
         grid.birth_strategy_state_identity_hash =
            candidate.strategy_state_identity_hash;
         grid.last_observed_strategy_state_identity_hash =
            candidate.strategy_state_identity_hash;
         grid.birth_shared_snapshot_hash = candidate.shared_snapshot_hash;
         grid.birth_m1_time = candidate.source_m1_time;
         grid.initial_history_boundary = candidate.initial_history_boundary;
         grid.p0 = candidate.p0;
         grid.c0 = candidate.c0;
         grid.q0 = candidate.q0;
         grid.stress_reference_price = candidate.stress_price;
         grid.broker_tick_size = candidate.broker_tick_size;
         grid.a_g_candidate_minor = candidate.a_g_candidate_minor;
         grid.a_g_minor = actual_a_g;
         if(!LP_RevmaBuildDiscoveryMesh(grid.q0, grid.broker_tick_size,
               grid.mesh) ||
            !LP_RevmaInitializePathGeometry(grid.p0, grid.mesh,
               candidate.source_m1_time, grid.path) ||
            !LP_RevmaInitializeCenterSupport(candidate.direction,
               candidate.p0, candidate.c0, candidate.q0,
               candidate.broker_tick_size,
               candidate.snapshot.signal.q_event_count,
               candidate.source_m1_time, grid.center_support))
         {
            Invalidate("real_birth_post_fill_geometry_failed");
            return false;
         }
      }
      else if(!grid.active || grid.atom_count != 1 ||
         grid.branch_grid_id != candidate.branch_grid_id ||
         grid.broker_grid_key != candidate.broker_grid_key)
      {
         Invalidate("real_add_pre_fill_envelope_mismatch");
         return false;
      }
      long next_reservation = grid.reservation_minor;
      long candidate_reservation = grid.candidate_reservation_minor;
      if(candidate.birth &&
         (!SafeMultiply(actual_a_g, 2, next_reservation) ||
          !SafeMultiply(candidate.a_g_candidate_minor, 2,
             candidate_reservation)))
      {
         Invalidate("real_birth_post_fill_reservation_overflow");
         return false;
      }
      long next_margin = 0;
      long next_mark = 0;
      long actual_complete_mark = 0;
      long next_deals = 0;
      if(!SafeAdd(actual_mark, commission_fee, actual_complete_mark) ||
         !SafeAdd(grid.margin_minor, actual_margin, next_margin) ||
         !SafeAdd(grid.marked_liquidation_minor, actual_mark, next_mark) ||
         !SafeAdd(next_mark, commission_fee, next_mark) ||
         !SafeAdd(grid.realized_all_deals_minor, deal_money, next_deals))
      {
         Invalidate("real_post_fill_grid_ledger_overflow");
         return false;
      }
      int atom_slot = candidate.birth ? 0 : 1;
      if(atom_slot < 0 || atom_slot >= LP_REVMA_REAL_MAX_ATOMS_PER_GRID ||
         execution.position_ticket == 0 ||
         grid.atom_slot_active[atom_slot] ||
         grid.atom_position_id[atom_slot] != 0)
      {
         Invalidate("real_post_fill_atom_position_identity_mismatch");
         return false;
      }
      grid.atom_slot_active[atom_slot] = true;
      grid.atom_position_id[atom_slot] = execution.position_ticket;
      grid.atom_open_deal_money_minor[atom_slot] = deal_money;
      grid.atom_count++;
      grid.peak_atom_count = MathMax(grid.peak_atom_count, grid.atom_count);
      if(grid.atom_count > LP_REVMA_REAL_MAX_ATOMS_PER_GRID)
      {
         Invalidate("real_post_fill_two_atom_invariant_breached");
         return false;
      }
      if(!candidate.birth && candidate.candidate_type ==
         LP_REVMA_DISCOVERY_CANDIDATE_ADVERSE_ADD)
         grid.adverse_add_count++;
      else if(!candidate.birth)
         grid.favorable_add_count++;
      grid.total_lots += LP_REVMA_DISCOVERY_ATOM_LOTS;
      grid.weighted_entry_price_lots += execution.executed_price *
         LP_REVMA_DISCOVERY_ATOM_LOTS;
      grid.average_entry_price = grid.weighted_entry_price_lots /
         grid.total_lots;
      if(grid.minimum_entry_price <= 0.0 ||
         execution.executed_price < grid.minimum_entry_price)
         grid.minimum_entry_price = execution.executed_price;
      if(execution.executed_price > grid.maximum_entry_price)
         grid.maximum_entry_price = execution.executed_price;
      grid.candidate_reservation_minor = candidate_reservation;
      grid.reservation_minor = next_reservation;
      grid.q_cash_minor = grid.a_g_minor * grid.atom_count;
      grid.margin_minor = next_margin;
      grid.marked_liquidation_minor = next_mark;
      if(next_mark > 0)
         grid.last_positive_liquidation_opportunity_m1 =
            candidate.source_m1_time;
      grid.realized_all_deals_minor = next_deals;
      if(!SafeAdd(grid.realized_cost_minor, cost_burden,
            grid.realized_cost_minor) ||
         !SafeAdd(grid.realized_swap_minor, swap_minor,
            grid.realized_swap_minor) ||
         !SafeAdd(next_portfolio.realized_cost_minor, cost_burden,
            next_portfolio.realized_cost_minor) ||
         !SafeAdd(next_portfolio.run_realized_cost_minor, cost_burden,
            next_portfolio.run_realized_cost_minor))
      {
         Invalidate("real_post_fill_cost_ledger_overflow");
         return false;
      }
      grid.last_admission_m1_time = candidate.source_m1_time;
      grid.last_admission_identity = candidate.candidate_identity;
      grid.last_mark_m1_time = candidate.source_m1_time;
      if(grid.reservation_minor > grid.peak_reservation_minor)
         grid.peak_reservation_minor = grid.reservation_minor;
      if(grid.q_cash_minor > grid.peak_q_cash_minor)
         grid.peak_q_cash_minor = grid.q_cash_minor;
      if(grid.margin_minor > grid.peak_margin_minor)
         grid.peak_margin_minor = grid.margin_minor;
      long reservation_delta = 0;
      if(!SafeAdd(next_reservation,
            -m_grids[candidate.symbol_id].reservation_minor,
            reservation_delta) ||
         !SafeAdd(next_portfolio.reservation_minor, reservation_delta,
            next_portfolio.reservation_minor) ||
         !SafeAdd(next_portfolio.margin_minor, actual_margin,
            next_portfolio.margin_minor) ||
         !SafeAdd(next_portfolio.marked_liquidation_minor,
             actual_complete_mark,
             next_portfolio.marked_liquidation_minor))
      {
         Invalidate("real_post_fill_portfolio_ledger_overflow");
         return false;
      }
      if(next_portfolio.reservation_minor >
         next_portfolio.capital_budget_minor)
         next_portfolio.capacity_overrun = true;
      next_candidate.terminal = true;
      next_candidate.decision = LP_REVMA_DISCOVERY_DECISION_ADMIT;
      next_candidate.decision_reason = "exact_fill_committed";
      next_candidate.execution_committed = true;
      next_candidate.actual_fill_price = execution.executed_price;
      // A_g is a grid-level post-birth fill freeze.  Later atoms retain the
      // already reconciled grid stress unit; their exact fill liability and
      // costs are recorded independently below.
      long telemetry_a_g = candidate.birth ? actual_a_g : grid.a_g_minor;
      next_candidate.actual_a_g_minor = telemetry_a_g;
      next_candidate.actual_incremental_margin_minor = actual_margin;
      next_candidate.actual_incremental_liquidation_minor =
         actual_complete_mark;
      next_candidate.actual_incremental_close_cost_minor = cost_burden;
      next_candidate.actual_commission_minor = commission_fee;
      next_candidate.actual_swap_minor = swap_minor;
      next_candidate.telemetry_matched_snapshot_hash =
         LP_RevmaDiscoveryMatchedSnapshotIdentity(
            candidate.symbol_id, candidate.source_m1_time,
            candidate.direction, candidate.candidate_type,
            candidate.pre_candidate_state_hash,
            candidate.snapshot.signal_identity_hash,
            candidate.snapshot.signal.q_event_count, candidate.q0,
            candidate.snapshot.decision_price, candidate.stress_price,
            execution.executed_price, candidate.p0, candidate.c0,
            candidate.broker_tick_size, candidate.a_g_candidate_minor,
             telemetry_a_g, actual_margin, actual_complete_mark, cost_burden);
      if(next_candidate.telemetry_matched_snapshot_hash == 0)
      {
         Invalidate("real_post_fill_telemetry_identity_failed");
         return false;
      }
      if(candidate.birth)
         grid.birth_matched_snapshot_hash =
            next_candidate.telemetry_matched_snapshot_hash;
      m_grids[candidate.symbol_id] = grid;
      m_portfolio = next_portfolio;
      m_candidates[index] = next_candidate;
      if(candidate.birth)
         m_grid_generation[candidate.symbol_id] = candidate.grid_generation;
      if(!ReconcileMoney(true) || !RecordDecision(true) ||
         !RecordInventoryTransition() ||
         !ObserveConcurrentRisk(candidate.source_m1_time,
            "real_exact_fill_committed"))
         return RollbackRoutedFillCommit(candidate.symbol_id, index,
            previous_grid, previous_candidate, previous_portfolio,
            previous_generation, "real_exact_fill_atomic_commit_failed");
      m_candidates[index].prospective_concentration_q_cash_minor =
         m_portfolio.concentration_q_cash_minor;
      m_candidates[index].prospective_concentration_currency_id =
         m_portfolio.concentration_currency_id;
      return true;
   }

   bool EndClosedM1Batch()
   {
      if(!m_portfolio.valid || !m_portfolio.batch_open ||
         !m_portfolio.allocation_complete)
         return false;
      for(int i = 0; i < m_candidate_count; i++)
      {
         if(!m_candidates[i].terminal ||
            m_candidates[i].telemetry_event_hash == 0)
            return false;
      }
      if(m_portfolio.cycle_candidate_built_count !=
            m_portfolio.cycle_candidate_decision_count ||
         m_portfolio.cycle_candidate_admitted_count +
            m_portfolio.cycle_candidate_rejected_count !=
               m_portfolio.cycle_candidate_decision_count)
      {
         Invalidate("real_candidate_batch_count_reconciliation_failed");
         return false;
      }
      m_portfolio.batch_open = false;
      return ReconcileMoney();
   }

   bool GridCloseRequired(
      const int symbol_id,
      LP_RevmaRealGrid &grid)
   {
      LP_ResetRevmaRealGrid(grid, symbol_id);
      if(symbol_id < 0 || symbol_id >= LP_SYMBOL_COUNT ||
         !m_portfolio.valid || !m_grids[symbol_id].active ||
         m_grids[symbol_id].close_owner ==
            LP_REVMA_DISCOVERY_CLOSE_NONE ||
         m_grids[symbol_id].close_execution_pending)
         return false;
      grid = m_grids[symbol_id];
      return true;
   }

   bool CloseWorkActive()
   {
      if(!m_portfolio.valid)
         return false;
      for(int symbol_id = 0; symbol_id < LP_SYMBOL_COUNT; symbol_id++)
      {
         if(m_grids[symbol_id].active &&
            m_grids[symbol_id].close_owner !=
               LP_REVMA_DISCOVERY_CLOSE_NONE)
            return true;
      }
      return false;
   }

   bool StageGridClose(
      const int symbol_id,
      const datetime source_m1_time)
   {
      if(!m_portfolio.valid || m_portfolio.batch_open ||
         m_portfolio.cycle_reset_required ||
         symbol_id < 0 || symbol_id >= LP_SYMBOL_COUNT ||
         source_m1_time <= 0 || ((long)source_m1_time % 60) != 0 ||
         !m_grids[symbol_id].active ||
         m_grids[symbol_id].close_owner == LP_REVMA_DISCOVERY_CLOSE_NONE ||
         !LP_RevmaDiscoveryTerminalReasonOwnerConsistent(
            m_grids[symbol_id].origin_terminal_reason,
            m_grids[symbol_id].close_owner) ||
         m_grids[symbol_id].close_trigger_m1_time <= 0 ||
         m_grids[symbol_id].close_trigger_m1_time > source_m1_time ||
         m_grids[symbol_id].last_mark_m1_time != source_m1_time ||
         m_portfolio.last_close_authority_evaluation_m1_time !=
            source_m1_time ||
         m_grids[symbol_id].close_execution_pending ||
         m_grids[symbol_id].close_staged_source_m1_time != 0)
      {
         Invalidate("real_close_stage_provenance_invalid");
         return false;
      }
      m_grids[symbol_id].close_execution_pending = true;
      m_grids[symbol_id].close_staged_source_m1_time = source_m1_time;
      return true;
   }

   bool RecordCloseExecution(
      const LP_TradePlan &plan,
      const LP_TradeExecutionResult &execution)
   {
      if(!plan.gate108 || plan.discovery_branch != LP_REVMA_BRANCH_R ||
         plan.action != LP_INTENT_CLOSE_GRID)
         return true;
      int symbol_id = plan.symbol_id;
      if(symbol_id < 0 || symbol_id >= LP_SYMBOL_COUNT ||
         !m_grids[symbol_id].active ||
         m_grids[symbol_id].broker_grid_key != plan.grid_key ||
         m_grids[symbol_id].branch_grid_id !=
            plan.discovery_branch_grid_id ||
         !m_grids[symbol_id].close_execution_pending ||
         m_grids[symbol_id].close_staged_source_m1_time <= 0 ||
         plan.discovery_source_m1_time !=
            m_grids[symbol_id].close_staged_source_m1_time ||
         m_grids[symbol_id].last_mark_m1_time !=
            m_grids[symbol_id].close_staged_source_m1_time ||
         plan.discovery_close_owner != m_grids[symbol_id].close_owner ||
         plan.discovery_origin_terminal_reason !=
            m_grids[symbol_id].origin_terminal_reason)
      {
         Invalidate("real_close_execution_invariant_failure");
         return false;
      }
      if(!execution.order_send_attempted && !execution.session_open &&
         execution.session_outcome ==
            "trade_session_metadata_unavailable")
      {
         m_portfolio.formula_clean = false;
         if(m_portfolio.first_routing_failure == "")
            m_portfolio.first_routing_failure =
               "trade_session_metadata_unavailable";
         Invalidate("real_close_session_metadata_unavailable");
         return false;
      }
      if(!execution.order_send_attempted && !execution.session_open &&
         execution.session_outcome ==
            "trade_session_closed_before_order_send")
      {
         m_grids[symbol_id].close_execution_pending = false;
         m_grids[symbol_id].close_staged_source_m1_time = 0;
         return true;
      }
      long all_deal_money = 0;
      long close_cost_burden = 0;
      long close_swap_minor = 0;
      bool confirmed_deal_set = execution.deal_set_complete &&
         execution.deal_linkage_clean && execution.deal_count > 0 &&
         execution.deal_set_hash != 0 && execution.executed_lots > 0.0;
      bool possible_broker_mutation = execution.executed_lots > 0.0 ||
         execution.deal_ticket > 0 || execution.position_ticket > 0 ||
         execution.order_ticket > 0 || execution.partial_fill ||
         execution.retcode == TRADE_RETCODE_PLACED;
      if(possible_broker_mutation && !confirmed_deal_set)
      {
         Invalidate("real_close_execution_ambiguous_requires_quarantine");
         return false;
      }
      int closed_atom_slot = -1;
      if(confirmed_deal_set)
      {
         for(int slot = 0; slot < LP_REVMA_REAL_MAX_ATOMS_PER_GRID; slot++)
         {
            if(m_grids[symbol_id].atom_slot_active[slot] &&
               m_grids[symbol_id].atom_position_id[slot] ==
                  execution.position_ticket)
            {
               if(closed_atom_slot >= 0)
               {
                  Invalidate("real_close_atom_position_identity_duplicate");
                  return false;
               }
               closed_atom_slot = slot;
            }
         }
         if(closed_atom_slot < 0)
         {
            Invalidate("real_close_atom_position_identity_missing");
            return false;
         }
      }
      bool exact_closed_atom = confirmed_deal_set && execution.accepted &&
         !execution.partial_fill && execution.closed_positions == 1 &&
         execution.failed_positions == 0 &&
         NormalizeDouble(execution.executed_lots, 2) ==
            LP_REVMA_DISCOVERY_ATOM_LOTS;
      long next_grid_all_deals = m_grids[symbol_id].realized_all_deals_minor;
      long next_grid_closed_atom_money =
         m_grids[symbol_id].partial_realized_closed_atom_minor;
      long next_grid_cost = m_grids[symbol_id].realized_cost_minor;
      long next_grid_swap = m_grids[symbol_id].realized_swap_minor;
      long next_portfolio_cost = m_portfolio.realized_cost_minor;
      long next_run_cost = m_portfolio.run_realized_cost_minor;
      long closed_atom_money = 0;
      if(confirmed_deal_set &&
         (!LP_RevmaDiscoveryMoneyToSignedMinor(
            execution.realized_profit + execution.realized_swap +
            execution.realized_commission + execution.realized_fee,
            m_portfolio.money_quantum, all_deal_money) ||
         !LP_RevmaDiscoveryMoneyBurdenToMinor(MathMax(0.0,
            -(execution.realized_commission + execution.realized_fee)),
            m_portfolio.money_quantum, close_cost_burden) ||
         !LP_RevmaDiscoveryMoneyToSignedMinor(execution.realized_swap,
            m_portfolio.money_quantum, close_swap_minor) ||
         !SafeAdd(next_grid_all_deals, all_deal_money,
            next_grid_all_deals) ||
         (exact_closed_atom &&
          (!SafeAdd(m_grids[symbol_id].atom_open_deal_money_minor[
               closed_atom_slot], all_deal_money, closed_atom_money) ||
           !SafeAdd(next_grid_closed_atom_money, closed_atom_money,
               next_grid_closed_atom_money))) ||
         !SafeAdd(next_grid_cost, close_cost_burden, next_grid_cost) ||
         !SafeAdd(next_grid_swap, close_swap_minor, next_grid_swap) ||
         !SafeAdd(next_portfolio_cost, close_cost_burden,
            next_portfolio_cost) ||
         !SafeAdd(next_run_cost, close_cost_burden, next_run_cost)))
      {
         Invalidate("real_close_deal_money_overflow");
         return false;
      }
      if(confirmed_deal_set)
      {
         m_grids[symbol_id].realized_all_deals_minor = next_grid_all_deals;
         m_grids[symbol_id].partial_realized_closed_atom_minor =
            next_grid_closed_atom_money;
         m_grids[symbol_id].realized_cost_minor = next_grid_cost;
         m_grids[symbol_id].realized_swap_minor = next_grid_swap;
         m_portfolio.realized_cost_minor = next_portfolio_cost;
         m_portfolio.run_realized_cost_minor = next_run_cost;
         if(exact_closed_atom)
            m_grids[symbol_id].atom_slot_active[closed_atom_slot] = false;
      }
      bool routing_unclean = execution.partial_fill ||
         execution.failed_positions > 0 ||
         (execution.order_send_attempted && !execution.accepted) ||
         (confirmed_deal_set && !exact_closed_atom);
      if(routing_unclean)
      {
         m_portfolio.formula_clean = false;
         if(m_portfolio.first_routing_failure == "")
            m_portfolio.first_routing_failure =
               "close_execution_not_exact:" +
               IntegerToString((int)execution.retcode);
         if(confirmed_deal_set)
         {
            Invalidate("real_close_nonexact_fill_requires_quarantine");
            return false;
         }
      }
      if(execution.closed_positions <= 0 &&
         execution.session_outcome != "no_matching_position")
      {
         m_grids[symbol_id].close_execution_pending = false;
         m_grids[symbol_id].close_staged_source_m1_time = 0;
      }
      return true;
   }

   bool ReconcileConfirmedFlat(
      LP_GridBook &grid_book,
      const datetime source_m1_time,
      const long actual_account_equity_minor)
   {
      if(!m_portfolio.valid || source_m1_time <= 0 ||
         actual_account_equity_minor <= 0)
         return false;
      bool changed = false;
      bool partial_reconciliation = false;
      for(int symbol_id = 0; symbol_id < LP_SYMBOL_COUNT; symbol_id++)
      {
         LP_RevmaRealGrid grid = m_grids[symbol_id];
         if(!grid.active || !grid.close_execution_pending)
            continue;
         if(grid.close_staged_source_m1_time <= 0 ||
            grid.close_staged_source_m1_time > source_m1_time ||
            grid.close_staged_source_m1_time != grid.last_mark_m1_time)
         {
            Invalidate("real_close_reconciliation_provenance_invalid");
            return false;
         }
         LP_GridInventoryRow row;
         if(grid_book.FindSymbolLaneGrid(symbol_id, LP_LANE_REVMA, row))
         {
            if(row.grid_key != grid.broker_grid_key ||
               row.direction != grid.direction ||
               row.variant_id != grid.variant_id ||
               row.position_count < 1 ||
               row.position_count > grid.atom_count ||
               row.position_count > LP_REVMA_REAL_MAX_ATOMS_PER_GRID ||
               ActiveAtomSlotCount(grid) != row.position_count ||
               NormalizeDouble(row.lots, 2) != NormalizeDouble(
                  (double)row.position_count *
                     LP_REVMA_DISCOVERY_ATOM_LOTS, 2))
            {
               Invalidate("real_partial_close_inventory_mismatch");
               return false;
            }
            grid.close_execution_pending = false;
            grid.close_staged_source_m1_time = 0;
            grid.atom_count = row.position_count;
            grid.total_lots = row.lots;
            grid.weighted_entry_price_lots = row.avg_entry_price * row.lots;
            grid.average_entry_price = row.avg_entry_price;
            grid.minimum_entry_price = row.min_entry_price;
            grid.maximum_entry_price = row.max_entry_price;
            if(!SafeMultiply(grid.a_g_minor, grid.atom_count,
                  grid.q_cash_minor))
            {
               Invalidate("real_partial_close_q_cash_overflow");
               return false;
            }
            grid.partial_reconciliation_valuation_stale = true;
            m_grids[symbol_id] = grid;
            changed = true;
            partial_reconciliation = true;
            continue;
         }
         if(ActiveAtomSlotCount(grid) != 0)
         {
            Invalidate("real_confirmed_flat_atom_position_state_mismatch");
            return false;
         }
         long final_money = grid.realized_all_deals_minor;
         long next_reservation = 0;
         long next_margin = 0;
         long next_mark = 0;
         long next_harvest = m_portfolio.realized_harvest_minor;
         long next_nonharvest = m_portfolio.realized_nonharvest_minor;
         long next_cleanup = m_portfolio.realized_cleanup_minor;
         long next_hard_risk = m_portfolio.realized_hard_risk_minor;
         if(!SafeAdd(m_portfolio.reservation_minor,
               -grid.reservation_minor, next_reservation) ||
            !SafeAdd(m_portfolio.margin_minor, -grid.margin_minor,
               next_margin) ||
            !SafeAdd(m_portfolio.marked_liquidation_minor,
               -grid.marked_liquidation_minor, next_mark))
            return false;
         if(!LP_RevmaDiscoveryTerminalReasonOwnerConsistent(
               grid.origin_terminal_reason, grid.close_owner) ||
            grid.close_trigger_m1_time <= 0 ||
            grid.close_trigger_m1_time > source_m1_time)
         {
            Invalidate("real_terminal_reason_owner_inconsistent");
            return false;
         }
         bool origin_harvest =
            grid.origin_terminal_reason == "grid_harvest";
         bool origin_cleanup =
            grid.origin_terminal_reason == "account_cleanup";
         bool origin_hard_risk =
            grid.origin_terminal_reason == "account_risk";
         if((origin_harvest && (!grid.excursion_completed ||
                !SafeAdd(next_harvest, final_money, next_harvest))) ||
            (!origin_harvest &&
             !SafeAdd(next_nonharvest, final_money, next_nonharvest)) ||
            (origin_cleanup &&
             !SafeAdd(next_cleanup, final_money, next_cleanup)) ||
            (origin_hard_risk &&
             !SafeAdd(next_hard_risk, final_money, next_hard_risk)))
         {
            Invalidate("real_terminal_owner_ledger_overflow");
            return false;
         }
         m_portfolio.realized_harvest_minor = next_harvest;
         m_portfolio.realized_nonharvest_minor = next_nonharvest;
         m_portfolio.realized_cleanup_minor = next_cleanup;
         m_portfolio.realized_hard_risk_minor = next_hard_risk;
         m_portfolio.reservation_minor = next_reservation;
         m_portfolio.margin_minor = next_margin;
         m_portfolio.marked_liquidation_minor = next_mark;
         grid.active = false;
         grid.flat = true;
         grid.close_execution_pending = false;
         grid.close_staged_source_m1_time = 0;
         grid.partial_reconciliation_valuation_stale = false;
         grid.atom_count = 0;
         grid.total_lots = 0.0;
         grid.weighted_entry_price_lots = 0.0;
         grid.average_entry_price = 0.0;
         grid.reservation_minor = 0;
         grid.candidate_reservation_minor = 0;
         grid.q_cash_minor = 0;
         grid.margin_minor = 0;
         grid.marked_liquidation_minor = 0;
         grid.last_flat_m1_time = source_m1_time;
         grid.reentry_requires_identity_transition =
            grid.close_owner == LP_REVMA_DISCOVERY_CLOSE_CLEANUP ||
            grid.close_owner == LP_REVMA_DISCOVERY_CLOSE_HARD_RISK;
         grid.reentry_identity_at_close =
            grid.last_observed_strategy_state_identity_hash;
         if(grid.reentry_requires_identity_transition &&
            grid.reentry_identity_at_close == 0)
            return false;
         grid.reentry_last_observed_identity =
            grid.reentry_identity_at_close;
         grid.reentry_last_identity_observation_m1 = source_m1_time;
         grid.reentry_transition_m1 = 0;
         grid.terminal_internal_state_hash =
            TerminalGridInternalStateHash(grid, source_m1_time,
               "confirmed_flat_close");
         if(grid.terminal_internal_state_hash == 0)
            return false;
         m_grids[symbol_id] = grid;
         changed = true;
         if(!RecordInventoryTransition())
            return false;
      }
      if(changed && !ReconcileMoney(true))
         return false;
      if(m_portfolio.active_grid_count == 0)
      {
         if(actual_account_equity_minor !=
               m_portfolio.branch_equity_minor)
         {
            Invalidate("real_flat_account_equity_ledger_mismatch");
            return false;
         }
         m_portfolio.confirmed_flat_equity_minor =
            actual_account_equity_minor;
      }
      int settled_owner_before = m_portfolio.close_owner;
      if(settled_owner_before == LP_REVMA_DISCOVERY_CLOSE_CLEANUP &&
         m_portfolio.active_grid_count == 0)
      {
         if(m_portfolio.hard_risk_latched)
         {
            Invalidate("real_flat_cleanup_owner_latch_inconsistent");
            return false;
         }
         long settled_managed_cycle_pnl = 0;
         if(!SafeAdd(m_portfolio.realized_harvest_minor,
               m_portfolio.realized_nonharvest_minor,
               settled_managed_cycle_pnl))
         {
            Invalidate("real_flat_settlement_risk_overflow");
            return false;
         }
         if(settled_managed_cycle_pnl <=
            -m_portfolio.capital_budget_minor)
         {
            m_portfolio.close_owner = LP_REVMA_DISCOVERY_CLOSE_HARD_RISK;
            m_portfolio.hard_risk_latched = true;
         }
      }
      if((m_portfolio.close_owner ==
            LP_REVMA_DISCOVERY_CLOSE_HARD_RISK) !=
         m_portfolio.hard_risk_latched)
      {
         Invalidate("real_flat_close_owner_latch_inconsistent");
         return false;
      }
      if(m_portfolio.close_owner != LP_REVMA_DISCOVERY_CLOSE_NONE &&
         m_portfolio.active_grid_count == 0)
      {
         if(!m_portfolio.cycle_reset_required)
         {
            m_portfolio.cycle_reset_required = true;
            m_portfolio.cycle_flat_m1_time = source_m1_time;
         }
         if(m_portfolio.close_owner == LP_REVMA_DISCOVERY_CLOSE_CLEANUP &&
            m_portfolio.branch_equity_minor <
             m_portfolio.equity_reference_minor)
            m_portfolio.cleanup_shortfall = true;
      }
      if(!changed)
         return true;
      // A 2->1 broker reconciliation deliberately preserves the last
      // completed-M1 mark and margin until the next shared valuation cohort.
      // Do not publish a mixed snapshot containing the new atom topology and
      // the previous two-atom valuation.
      if(partial_reconciliation)
         return true;
      return ObserveConcurrentRisk(source_m1_time,
         "real_confirmed_flat_reconciliation");
   }

   bool ReconcileBrokerInventoryBijection(LP_GridBook &grid_book)
   {
      if(!m_portfolio.valid || !grid_book.StructureConsistent())
         return false;
      bool seen[LP_SYMBOL_COUNT];
      for(int symbol_id = 0; symbol_id < LP_SYMBOL_COUNT; symbol_id++)
         seen[symbol_id] = false;
      for(int i = 0; i < grid_book.OpenGridCount(); i++)
      {
         LP_GridInventoryRow row;
         if(!grid_book.GetGrid(i, row) || row.lane_id != LP_LANE_REVMA ||
            row.symbol_id < 0 || row.symbol_id >= LP_SYMBOL_COUNT ||
            seen[row.symbol_id])
         {
            Invalidate("real_broker_inventory_row_not_bijective");
            return false;
         }
         LP_RevmaRealGrid grid = m_grids[row.symbol_id];
         if(!grid.active || grid.flat ||
            grid.broker_grid_key != row.grid_key ||
            grid.symbol_id != row.symbol_id ||
            grid.variant_id != row.variant_id ||
            grid.direction != row.direction ||
            grid.atom_count != row.position_count ||
            ActiveAtomSlotCount(grid) != row.position_count ||
            grid.atom_count < 1 ||
            grid.atom_count > LP_REVMA_REAL_MAX_ATOMS_PER_GRID ||
            NormalizeDouble(grid.total_lots, 2) !=
               NormalizeDouble(row.lots, 2) ||
            NormalizeDouble(row.lots, 2) != NormalizeDouble(
               (double)row.position_count * LP_REVMA_DISCOVERY_ATOM_LOTS, 2) ||
            NormalizeDouble(grid.average_entry_price, 8) !=
               NormalizeDouble(row.avg_entry_price, 8) ||
            NormalizeDouble(grid.minimum_entry_price, 8) !=
               NormalizeDouble(row.min_entry_price, 8) ||
            NormalizeDouble(grid.maximum_entry_price, 8) !=
               NormalizeDouble(row.max_entry_price, 8))
         {
            Invalidate("real_broker_inventory_row_state_mismatch");
            return false;
         }
         seen[row.symbol_id] = true;
      }
      for(int symbol_id = 0; symbol_id < LP_SYMBOL_COUNT; symbol_id++)
      {
         if(m_grids[symbol_id].active != seen[symbol_id])
         {
            Invalidate("real_internal_broker_inventory_bijection_mismatch");
            return false;
         }
      }
      return true;
   }

   bool GetConcurrentRiskState(
      const datetime source_m1_time,
      LP_RevmaConcurrentBranchRiskState &state)
   {
      LP_ResetRevmaConcurrentBranchRiskState(state);
      if(!m_portfolio.valid || m_portfolio.last_risk_snapshot_m1_time !=
         source_m1_time || HasPartialReconciliationValuationStale())
         return false;
      state.branch = LP_REVMA_BRANCH_R;
      state.source_m1_time = source_m1_time;
      state.reservation_minor = m_portfolio.reservation_minor;
      state.margin_minor = m_portfolio.margin_minor;
      state.q_cash_minor = m_portfolio.q_cash_minor;
      state.atom_count = m_portfolio.atom_count;
      state.active_grid_count = m_portfolio.active_grid_count;
      state.concentration_q_cash_minor =
         m_portfolio.concentration_q_cash_minor;
      state.concentration_currency_id = m_portfolio.concentration_currency_id;
      state.marked_liquidation_minor = m_portfolio.marked_liquidation_minor;
      state.liquidation_liability_minor =
         m_portfolio.liquidation_liability_minor;
      state.branch_equity_minor = m_portfolio.branch_equity_minor;
      state.equity_high_water_minor = m_portfolio.equity_high_water_minor;
      state.branch_drawdown_minor = m_portfolio.branch_drawdown_minor;
      state.cycle_peak_reservation_minor =
         m_portfolio.peak_reservation_minor;
      state.cycle_peak_margin_minor = m_portfolio.peak_margin_minor;
      state.cycle_peak_q_cash_minor = m_portfolio.peak_q_cash_minor;
      state.cycle_peak_atom_count = m_portfolio.peak_atom_count;
      state.cycle_peak_active_grid_count =
         m_portfolio.peak_active_grid_count;
      state.cycle_peak_concentration_q_cash_minor =
         m_portfolio.peak_concentration_q_cash_minor;
      state.cycle_peak_concentration_currency_id =
         m_portfolio.peak_concentration_currency_id;
      state.cycle_peak_liquidation_liability_minor =
         m_portfolio.peak_liquidation_liability_minor;
      state.cycle_maximum_drawdown_minor =
         m_portfolio.maximum_branch_drawdown_minor;
      state.run_peak_reservation_minor =
         m_portfolio.run_peak_reservation_minor;
      state.run_peak_margin_minor = m_portfolio.run_peak_margin_minor;
      state.run_peak_q_cash_minor = m_portfolio.run_peak_q_cash_minor;
      state.run_peak_atom_count = m_portfolio.run_peak_atom_count;
      state.run_peak_active_grid_count =
         m_portfolio.run_peak_active_grid_count;
      state.run_peak_concentration_q_cash_minor =
         m_portfolio.run_peak_concentration_q_cash_minor;
      state.run_peak_concentration_currency_id =
         m_portfolio.run_peak_concentration_currency_id;
      state.run_peak_liquidation_liability_minor =
         m_portfolio.run_peak_liquidation_liability_minor;
      state.run_equity_high_water_minor =
         m_portfolio.run_equity_high_water_minor;
      state.run_maximum_drawdown_minor =
         m_portfolio.run_maximum_branch_drawdown_minor;
      state.cycle_risk_snapshot_count =
         m_portfolio.cycle_risk_snapshot_count;
      state.cycle_risk_snapshot_hash = m_portfolio.cycle_risk_snapshot_hash;
      state.run_risk_snapshot_count = m_portfolio.run_risk_snapshot_count;
      state.run_risk_snapshot_hash = m_portfolio.run_risk_snapshot_hash;
      state.cycle_candidate_built_count =
         m_portfolio.cycle_candidate_built_count;
      state.cycle_candidate_decision_count =
         m_portfolio.cycle_candidate_decision_count;
      state.cycle_candidate_admitted_count =
         m_portfolio.cycle_candidate_admitted_count;
      state.cycle_candidate_rejected_count =
         m_portfolio.cycle_candidate_rejected_count;
      state.cycle_inventory_transition_count =
         m_portfolio.cycle_inventory_transition_count;
      state.run_candidate_built_count =
         m_portfolio.run_candidate_built_count;
      state.run_candidate_decision_count =
         m_portfolio.run_candidate_decision_count;
      state.run_candidate_admitted_count =
         m_portfolio.run_candidate_admitted_count;
      state.run_candidate_rejected_count =
         m_portfolio.run_candidate_rejected_count;
      state.run_inventory_transition_count =
         m_portfolio.run_inventory_transition_count;
      state.state_hash = LP_RevmaConcurrentBranchRiskIdentity(state);
      state.valid = state.state_hash != 0;
      return LP_RevmaConcurrentBranchRiskStateValid(state);
   }

   bool BuildTerminalGridProjection(
      const int symbol_id,
      const datetime terminal_event_m1_time,
      LP_RevmaTerminalGridProjection &projection)
   {
      LP_ResetRevmaTerminalGridProjection(projection);
      if(symbol_id < 0 || symbol_id >= LP_SYMBOL_COUNT ||
         !m_portfolio.valid || terminal_event_m1_time <= 0)
         return false;
      LP_RevmaRealGrid grid = m_grids[symbol_id];
      if(grid.branch_grid_id == 0 || grid.branch_cycle_id == 0)
         return false;
      ulong internal_hash = grid.active ?
         TerminalGridInternalStateHash(grid, terminal_event_m1_time,
            "run_boundary_unresolved") :
         grid.terminal_internal_state_hash;
      long age_seconds = (long)terminal_event_m1_time -
         (long)grid.birth_m1_time;
      if(internal_hash == 0 || age_seconds < 0 ||
         age_seconds / 60 > 2147483647 ||
         (grid.active && (grid.last_mark_m1_time != terminal_event_m1_time ||
          grid.path.last_observation_m1 != terminal_event_m1_time ||
          grid.center_support.last_observation_m1 != terminal_event_m1_time)) ||
         (!grid.active && grid.last_flat_m1_time != terminal_event_m1_time))
         return false;
      projection.valid = true;
      projection.branch = LP_REVMA_BRANCH_R;
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
      projection.harvest_minor = !grid.active &&
         grid.origin_terminal_reason == "grid_harvest" ?
          grid.realized_all_deals_minor : 0;
      projection.nonharvest_minor = !grid.active &&
         grid.origin_terminal_reason != "grid_harvest" ?
          grid.realized_all_deals_minor : 0;
      projection.liability_minor = grid.active ?
         grid.marked_liquidation_minor : 0;
      projection.cost_minor = grid.realized_cost_minor;
      projection.maximum_adverse_excursion_minor =
         grid.maximum_adverse_excursion_minor;
      projection.grid_age_minutes = (int)(age_seconds / 60);
      projection.time_underwater_minutes = grid.time_underwater_minutes;
      projection.close_owner = grid.close_owner;
      projection.origin_terminal_reason = grid.origin_terminal_reason;
      projection.terminal_internal_state_hash = internal_hash;
      projection.projection_hash =
         LP_RevmaTerminalGridProjectionIdentity(projection);
      projection.valid = projection.projection_hash != 0;
      return LP_RevmaTerminalGridProjectionValid(projection);
   }

   bool BindTerminalEvidenceEvent(
      const int symbol_id,
      const datetime terminal_event_m1_time,
      const ulong terminal_projection_hash,
      const ulong terminal_internal_state_hash,
      const ulong terminal_event_hash)
   {
      if(symbol_id < 0 || symbol_id >= LP_SYMBOL_COUNT ||
         terminal_projection_hash == 0 ||
         terminal_internal_state_hash == 0 || terminal_event_hash == 0)
         return false;
      LP_RevmaRealGrid grid = m_grids[symbol_id];
      LP_RevmaTerminalGridProjection expected;
      LP_ResetRevmaTerminalGridProjection(expected);
      if(grid.terminal_event_hash != 0 ||
         grid.terminal_projection_hash != 0 ||
         grid.terminal_evidence_m1_time != 0 ||
         !BuildTerminalGridProjection(symbol_id, terminal_event_m1_time,
            expected) ||
         expected.projection_hash != terminal_projection_hash ||
         expected.terminal_internal_state_hash !=
            terminal_internal_state_hash)
         return false;
      grid.terminal_projection_hash = terminal_projection_hash;
      grid.terminal_internal_state_hash = terminal_internal_state_hash;
      grid.terminal_event_hash = terminal_event_hash;
      grid.terminal_evidence_m1_time = terminal_event_m1_time;
      m_grids[symbol_id] = grid;
      return true;
   }

   bool BranchTerminalReconciled(
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
      if(!m_portfolio.valid || m_portfolio.batch_open ||
         expected_terminal_m1_time <= 0 ||
         HasPartialReconciliationValuationStale() || !ReconcileMoney())
         return false;
      if(m_portfolio.last_risk_snapshot_m1_time !=
            expected_terminal_m1_time &&
         !ObserveConcurrentRisk(expected_terminal_m1_time,
            "terminal_reconciliation"))
         return false;
      final_flat = m_portfolio.active_grid_count == 0;
      if(final_flat && (m_portfolio.atom_count != 0 ||
         m_portfolio.reservation_minor != 0 || m_portfolio.margin_minor != 0 ||
         m_portfolio.marked_liquidation_minor != 0))
         return false;
      ulong evidence_hash = LP_RevmaTerminalGridEventSetSeed(
         LP_REVMA_BRANCH_R, m_portfolio.cycle_id,
         expected_terminal_m1_time);
      for(int symbol_id = 0; symbol_id < LP_SYMBOL_COUNT; symbol_id++)
      {
         LP_RevmaRealGrid grid = m_grids[symbol_id];
         if(grid.branch_grid_id == 0 ||
            grid.branch_cycle_id != m_portfolio.cycle_id)
         {
            if(!LP_RevmaTerminalGridEventSetMix(evidence_hash, symbol_id,
                  0, 0, 0, 0, 0))
               return false;
            continue;
         }
         if(grid.terminal_event_hash == 0 ||
            grid.terminal_projection_hash == 0 ||
            grid.terminal_internal_state_hash == 0 ||
            grid.terminal_evidence_m1_time <= 0 ||
            grid.terminal_evidence_m1_time > expected_terminal_m1_time ||
            (grid.active && grid.terminal_evidence_m1_time !=
               expected_terminal_m1_time) ||
            !LP_RevmaTerminalGridEventSetMix(evidence_hash, symbol_id,
               grid.branch_grid_id, grid.terminal_evidence_m1_time,
               grid.terminal_projection_hash,
               grid.terminal_internal_state_hash,
               grid.terminal_event_hash))
            return false;
      }
      terminal_grid_state_hash =
         LP_RevmaTerminalGridEventSetFinalize(evidence_hash);
      if(terminal_grid_state_hash == 0 ||
         !GetConcurrentRiskState(expected_terminal_m1_time, terminal_risk))
         return false;
      terminal_book_hash = LP_RevmaDiscoveryTerminalBookIdentity(
         LP_REVMA_BRANCH_R, m_portfolio.cycle_id,
         expected_terminal_m1_time, final_flat, m_portfolio.atom_count,
         NormalizeDouble((double)m_portfolio.atom_count *
            LP_REVMA_DISCOVERY_ATOM_LOTS, 2),
         m_portfolio.equity_reference_minor,
         m_portfolio.capital_budget_minor,
         m_portfolio.realized_harvest_minor,
         m_portfolio.realized_nonharvest_minor,
         m_portfolio.marked_liquidation_minor,
         m_portfolio.realized_cost_minor,
         m_portfolio.reservation_minor, m_portfolio.margin_minor,
         m_portfolio.branch_equity_minor, m_portfolio.close_owner,
         m_portfolio.cleanup_shortfall, m_portfolio.hard_risk_latched,
         terminal_risk, terminal_grid_state_hash);
      return terminal_book_hash != 0;
   }

   bool GetGrid(const int symbol_id, LP_RevmaRealGrid &grid)
   {
      if(symbol_id < 0 || symbol_id >= LP_SYMBOL_COUNT)
         return false;
      grid = m_grids[symbol_id];
      return true;
   }

   bool GetCandidate(const int index, LP_RevmaRealCandidate &candidate)
   {
      if(index < 0 || index >= m_candidate_count)
         return false;
      candidate = m_candidates[index];
      return true;
   }
   bool GetCandidateByIntent(const ulong intent_id,
      LP_RevmaRealCandidate &candidate)
   {
      int index = FindCandidateByIntent(intent_id);
      if(index < 0)
         return false;
      candidate = m_candidates[index];
      return true;
   }
   bool BindCandidateTelemetryEvent(
      const ulong candidate_identity,
      const ulong telemetry_event_hash)
   {
      if(candidate_identity == 0 || telemetry_event_hash == 0)
         return false;
      for(int i = 0; i < m_candidate_count; i++)
      {
         if(m_candidates[i].candidate_identity != candidate_identity)
            continue;
         if(!m_candidates[i].valid || !m_candidates[i].terminal ||
            m_candidates[i].telemetry_event_hash != 0)
            return false;
         m_candidates[i].telemetry_event_hash = telemetry_event_hash;
         return true;
      }
      return false;
   }
   bool GetPortfolio(LP_RevmaRealPortfolioState &portfolio)
   {
      portfolio = m_portfolio;
      return m_portfolio.initialized;
   }

   int CandidateCount() { return m_candidate_count; }
   bool Valid() { return m_portfolio.valid; }
   string InvalidReason() { return m_portfolio.invalid_reason; }
   bool BatchOpen() { return m_portfolio.batch_open; }
   bool CycleResetRequired() { return m_portfolio.cycle_reset_required; }
   int CloseOwner() { return m_portfolio.close_owner; }
   long EquityReferenceMinor() { return m_portfolio.equity_reference_minor; }
   long BudgetMinor() { return m_portfolio.capital_budget_minor; }
   long HarvestMinor() { return m_portfolio.realized_harvest_minor; }
   long NonharvestMinor() { return m_portfolio.realized_nonharvest_minor; }
   long MarkedMinor() { return m_portfolio.marked_liquidation_minor; }
   long BranchEquityMinor() { return m_portfolio.branch_equity_minor; }
   bool FormulaClean() { return m_portfolio.formula_clean; }
   string FirstRoutingFailure() { return m_portfolio.first_routing_failure; }
   ulong CycleId() { return m_portfolio.cycle_id; }
};

#endif // __LIMNI_PORTFOLIO_REVMA_REAL_PORTFOLIO_MQH__
