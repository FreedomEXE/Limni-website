/*-----------------------------------------------
  Gate 108 aggregate broker-free U/C shadow books
-----------------------------------------------*/
#ifndef __LIMNI_PORTFOLIO_REVMA_SHADOW_PORTFOLIO_MQH__
#define __LIMNI_PORTFOLIO_REVMA_SHADOW_PORTFOLIO_MQH__

#include "RevmaDiscoveryTypes.mqh"
#include "RevmaCenterSupportPolicy.mqh"

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

bool LP_RevmaMoneyToConservativeMinor(const double money, const double money_quantum, long &minor)
{
   minor = 0;
   if(!MathIsValidNumber(money) || !MathIsValidNumber(money_quantum) || money_quantum <= 0.0)
      return false;
   double scaled = money / money_quantum;
   if(!MathIsValidNumber(scaled) || MathAbs(scaled) > (double)LP_REVMA_MINOR_ABS_LIMIT)
      return false;
   // Floor is conservative for a signed net ledger: it never improves PnL.
   minor = (long)MathFloor(scaled + 1.0e-10);
   return minor <= LP_REVMA_MINOR_ABS_LIMIT && minor >= -LP_REVMA_MINOR_ABS_LIMIT;
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
   ulong formula_hash;
   datetime birth_m1_time;
   datetime last_admission_m1_time;
   ulong last_admission_identity;
   int atom_count;
   int peak_atom_count;
   double total_lots;
   double weighted_entry_price_lots;
   double average_entry_price;
   double minimum_entry_price;
   double maximum_entry_price;
   double q0;
   long q_cash_minor;
   long reservation_minor;
   long realized_harvest_minor;
   long realized_nonharvest_minor;
   long marked_liquidation_minor;
   long cost_minor;
   int close_owner;
   string terminal_reason;
   LP_RevmaCenterSupportState center_support;
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
   grid.formula_hash = LP_RevmaDiscoveryFormulaHash();
   grid.birth_m1_time = 0;
   grid.last_admission_m1_time = 0;
   grid.last_admission_identity = 0;
   grid.atom_count = 0;
   grid.peak_atom_count = 0;
   grid.total_lots = 0.0;
   grid.weighted_entry_price_lots = 0.0;
   grid.average_entry_price = 0.0;
   grid.minimum_entry_price = 0.0;
   grid.maximum_entry_price = 0.0;
   grid.q0 = 0.0;
   grid.q_cash_minor = 0;
   grid.reservation_minor = 0;
   grid.realized_harvest_minor = 0;
   grid.realized_nonharvest_minor = 0;
   grid.marked_liquidation_minor = 0;
   grid.cost_minor = 0;
   grid.close_owner = LP_REVMA_DISCOVERY_CLOSE_NONE;
   grid.terminal_reason = "";
   LP_ResetRevmaCenterSupportState(grid.center_support);
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
   long marked_liquidation_minor;
   long cost_minor;
   long reservation_minor;
   long branch_equity_minor;
   int close_owner;
   bool cleanup_shortfall;
   bool hard_risk_latched;
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
   portfolio.marked_liquidation_minor = 0;
   portfolio.cost_minor = 0;
   portfolio.reservation_minor = 0;
   portfolio.branch_equity_minor = 0;
   portfolio.close_owner = LP_REVMA_DISCOVERY_CLOSE_NONE;
   portfolio.cleanup_shortfall = false;
   portfolio.hard_risk_latched = false;
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
   ulong candidate_identity;
   datetime source_m1_time;
   double fill_price;
   double q0;
   double lots;
   long incremental_reservation_minor;
   long incremental_q_cash_minor;
   int candidate_type;
   ulong shared_origin_id;
   ulong opportunity_id;
   ulong pre_candidate_state_hash;
   double p0;
   double c0;
   double broker_tick_size;
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
   candidate.candidate_identity = 0;
   candidate.source_m1_time = 0;
   candidate.fill_price = 0.0;
   candidate.q0 = 0.0;
   candidate.lots = 0.0;
   candidate.incremental_reservation_minor = 0;
   candidate.incremental_q_cash_minor = 0;
   candidate.candidate_type = LP_REVMA_DISCOVERY_CANDIDATE_BIRTH;
   candidate.shared_origin_id = 0;
   candidate.opportunity_id = 0;
   candidate.pre_candidate_state_hash = 0;
   candidate.p0 = 0.0;
   candidate.c0 = 0.0;
   candidate.broker_tick_size = 0.0;
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
   bool m_matched_initialization_complete;
   bool m_matched_opportunities_validated;

   void Invalidate(const int shadow_index, const string reason)
   {
      if(shadow_index < 0 || shadow_index >= LP_REVMA_SHADOW_BRANCH_COUNT)
         return;
      m_portfolios[shadow_index].valid = false;
      m_portfolios[shadow_index].batch_open = false;
      m_portfolios[shadow_index].allocation_complete = false;
      m_portfolios[shadow_index].transitions_committed = false;
      m_portfolios[shadow_index].invalid_reason = reason;
   }

   bool ReconcileEquity(const int shadow_index)
   {
      long realized_total = 0;
      long equity_before_mark = 0;
      long equity = 0;
      if(!LP_RevmaSafeMinorAdd(m_portfolios[shadow_index].realized_harvest_minor,
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
      return true;
   }

   bool ReconcileReservation(const int shadow_index)
   {
      long grid_total = 0;
      for(int symbol_id = 0; symbol_id < LP_SYMBOL_COUNT; symbol_id++)
      {
         if(!LP_RevmaSafeMinorAdd(grid_total,
            m_grids[shadow_index][symbol_id].reservation_minor, grid_total))
         {
            Invalidate(shadow_index, "grid_reservation_sum_overflow");
            return false;
         }
      }
      if(grid_total != m_portfolios[shadow_index].reservation_minor ||
         grid_total < 0 || grid_total > m_portfolios[shadow_index].capital_budget_minor)
      {
         Invalidate(shadow_index, "portfolio_grid_reservation_mismatch");
         return false;
      }
      return true;
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

   bool CandidateLess(const LP_RevmaShadowCandidate &left, const LP_RevmaShadowCandidate &right)
   {
      if(left.incremental_reservation_minor != right.incremental_reservation_minor)
         return left.incremental_reservation_minor < right.incremental_reservation_minor;
      if(left.symbol_id != right.symbol_id)
         return left.symbol_id < right.symbol_id;
      return left.candidate_identity < right.candidate_identity;
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
      payload += "|grid_reservation=" + (string)grid.reservation_minor;
      payload += "|portfolio_reservation=" + (string)portfolio.reservation_minor;
      payload += "|portfolio_equity=" + (string)portfolio.branch_equity_minor;
      payload += "|portfolio_H=" + (string)portfolio.realized_harvest_minor;
      payload += "|portfolio_R=" + (string)portfolio.realized_nonharvest_minor;
      payload += "|portfolio_L=" + (string)portfolio.marked_liquidation_minor;
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
         grid.birth_m1_time = candidate.source_m1_time;
         grid.q0 = candidate.q0;
         if(candidate.branch == LP_REVMA_BRANCH_C)
            grid.center_support = candidate.center_support_snapshot;
      }
      else if(!grid.active || grid.branch_grid_id != candidate.branch_grid_id ||
         grid.direction != candidate.direction ||
         candidate.source_m1_time <= grid.last_admission_m1_time)
         return false;

      double new_lots = grid.total_lots + candidate.lots;
      double new_weighted = grid.weighted_entry_price_lots + candidate.fill_price * candidate.lots;
      if(new_lots <= 0.0 || !MathIsValidNumber(new_lots) || !MathIsValidNumber(new_weighted))
         return false;
      long new_grid_reservation = 0;
      long new_grid_q_cash = 0;
      if(!LP_RevmaSafeMinorAdd(grid.reservation_minor, candidate.incremental_reservation_minor, new_grid_reservation) ||
         !LP_RevmaSafeMinorAdd(grid.q_cash_minor, candidate.incremental_q_cash_minor, new_grid_q_cash))
         return false;

      grid.atom_count++;
      if(grid.atom_count > grid.peak_atom_count)
         grid.peak_atom_count = grid.atom_count;
      grid.total_lots = new_lots;
      grid.weighted_entry_price_lots = new_weighted;
      grid.average_entry_price = new_weighted / new_lots;
      if(grid.minimum_entry_price <= 0.0 || candidate.fill_price < grid.minimum_entry_price)
         grid.minimum_entry_price = candidate.fill_price;
      if(grid.maximum_entry_price <= 0.0 || candidate.fill_price > grid.maximum_entry_price)
         grid.maximum_entry_price = candidate.fill_price;
      grid.q_cash_minor = new_grid_q_cash;
      grid.reservation_minor = new_grid_reservation;
      grid.last_admission_m1_time = candidate.source_m1_time;
      grid.last_admission_identity = candidate.candidate_identity;
      if(candidate.branch == LP_REVMA_BRANCH_C)
         grid.center_support = candidate.center_support_snapshot;
      m_grids[shadow_index][candidate.symbol_id] = grid;
      candidate.committed = true;
      candidate.decision = LP_REVMA_DISCOVERY_DECISION_ADMIT;
      candidate.decision_reason = "allocated_and_committed";
      return true;
   }

public:
   LP_RevmaShadowPortfolio()
   {
      m_matched_initialization_complete = false;
      m_matched_opportunities_validated = false;
      for(int shadow_index = 0; shadow_index < LP_REVMA_SHADOW_BRANCH_COUNT; shadow_index++)
      {
         int branch = shadow_index == 0 ? LP_REVMA_BRANCH_U : LP_REVMA_BRANCH_C;
         LP_ResetRevmaShadowPortfolioState(m_portfolios[shadow_index], branch);
         m_candidate_count[shadow_index] = 0;
         for(int symbol_id = 0; symbol_id < LP_SYMBOL_COUNT; symbol_id++)
         {
            LP_ResetRevmaShadowGrid(m_grids[shadow_index][symbol_id], branch, symbol_id);
            LP_ResetRevmaShadowCandidate(m_candidates[shadow_index][symbol_id]);
         }
      }
   }

   bool InitializeBranch(const int branch, const ulong cycle_id, const long equity_reference_minor, const double money_quantum)
   {
      int shadow_index = LP_RevmaShadowIndex(branch);
      if(shadow_index < 0 || cycle_id == 0 || equity_reference_minor <= 0 ||
         money_quantum <= 0.0 || !MathIsValidNumber(money_quantum) ||
         !LP_RevmaDiscoveryCapitalMandateValid())
         return false;
      LP_ResetRevmaShadowPortfolioState(m_portfolios[shadow_index], branch);
      long budget = (long)MathFloor((double)equity_reference_minor *
         LP_REVMA_DISCOVERY_CAPITAL_BUDGET_FRACTION + 1.0e-10);
      if(budget <= 0 || budget >= equity_reference_minor)
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
      m_portfolios[shadow_index].invalid_reason = "";
      m_candidate_count[shadow_index] = 0;
      for(int symbol_id = 0; symbol_id < LP_SYMBOL_COUNT; symbol_id++)
         LP_ResetRevmaShadowGrid(m_grids[shadow_index][symbol_id], branch, symbol_id);
      return true;
   }

   bool InitializeMatchedBranches(const ulong cycle_id, const long equity_reference_minor, const double money_quantum)
   {
      m_matched_initialization_complete = false;
      if(!InitializeBranch(LP_REVMA_BRANCH_U, cycle_id, equity_reference_minor, money_quantum) ||
         !InitializeBranch(LP_REVMA_BRANCH_C, cycle_id, equity_reference_minor, money_quantum))
         return false;
      LP_RevmaShadowPortfolioState u = m_portfolios[LP_RevmaShadowIndex(LP_REVMA_BRANCH_U)];
      LP_RevmaShadowPortfolioState c = m_portfolios[LP_RevmaShadowIndex(LP_REVMA_BRANCH_C)];
      if(u.cycle_id != c.cycle_id || u.money_quantum != c.money_quantum ||
         u.equity_reference_minor != c.equity_reference_minor ||
         u.capital_budget_minor != c.capital_budget_minor ||
         u.reservation_minor != c.reservation_minor ||
         u.branch_equity_minor != c.branch_equity_minor)
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
         !m_matched_initialization_complete ||
         source_m1_time <= m_portfolios[shadow_index].batch_m1_time)
      {
         if(shadow_index >= 0) Invalidate(shadow_index, "closed_m1_batch_begin_invalid");
         return false;
      }
      m_portfolios[shadow_index].batch_open = true;
      m_portfolios[shadow_index].allocation_complete = false;
      m_portfolios[shadow_index].transitions_committed = false;
      m_portfolios[shadow_index].batch_m1_time = source_m1_time;
      m_portfolios[shadow_index].batch_hash = LP_HashString(LP_RevmaDiscoveryBranchId(branch));
      LP_HashMixLong(m_portfolios[shadow_index].batch_hash, (long)source_m1_time);
      m_candidate_count[shadow_index] = 0;
      m_matched_opportunities_validated = false;
      for(int i = 0; i < LP_SYMBOL_COUNT; i++)
         LP_ResetRevmaShadowCandidate(m_candidates[shadow_index][i]);
      return true;
   }

   bool PrepareCenterPolicy(LP_RevmaShadowCandidate &candidate)
   {
      int shadow_index = LP_RevmaShadowIndex(candidate.branch);
      if(shadow_index < 0 || candidate.symbol_id < 0 || candidate.symbol_id >= LP_SYMBOL_COUNT ||
         !candidate.valid || !m_portfolios[shadow_index].valid ||
         candidate.source_m1_time != m_portfolios[shadow_index].batch_m1_time)
      {
         if(shadow_index >= 0) Invalidate(shadow_index, "center_policy_prepare_invariant_failure");
         return false;
      }
      candidate.center_policy_checked = true;
      if(candidate.branch == LP_REVMA_BRANCH_U)
      {
         candidate.center_policy_applies = false;
         candidate.center_add_authorized = true;
         candidate.center_policy_reason = "U_CENTER_AUTHORITY_FORBIDDEN";
         LP_ResetRevmaCenterSupportState(candidate.center_support_snapshot);
         return true;
      }

      if(candidate.birth)
      {
         if(!LP_RevmaInitializeCenterSupport(candidate.direction, candidate.p0, candidate.c0,
            candidate.q0, candidate.broker_tick_size, candidate.source_m1_time,
            candidate.center_support_snapshot))
         {
            candidate.center_policy_reason = "CENTER_NOT_AVAILABLE";
            return false;
         }
      }
      else
      {
         LP_RevmaShadowGrid existing = m_grids[shadow_index][candidate.symbol_id];
         if(!existing.active || !existing.center_support.valid)
         {
            Invalidate(shadow_index, "C_center_state_missing_for_add");
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
      const datetime source_m1_time
   )
   {
      int shadow_index = LP_RevmaShadowIndex(LP_REVMA_BRANCH_C);
      if(symbol_id < 0 || symbol_id >= LP_SYMBOL_COUNT ||
         !m_portfolios[shadow_index].valid || !m_grids[shadow_index][symbol_id].active)
      {
         Invalidate(shadow_index, "C_center_observation_grid_invalid");
         return false;
      }
      LP_RevmaCenterSupportState state = m_grids[shadow_index][symbol_id].center_support;
      if(!LP_RevmaObserveCenterSupport(current_center, current_q, broker_tick_size,
         source_m1_time, state))
      {
         Invalidate(shadow_index, "C_center_observation_state_invalid");
         return false;
      }
      m_grids[shadow_index][symbol_id].center_support = state;
      return true;
   }

   bool AddCandidate(const LP_RevmaShadowCandidate &candidate)
   {
      int shadow_index = LP_RevmaShadowIndex(candidate.branch);
      if(shadow_index < 0 || !m_portfolios[shadow_index].valid || !m_portfolios[shadow_index].batch_open ||
         m_portfolios[shadow_index].allocation_complete || !candidate.valid ||
         candidate.symbol_id < 0 || candidate.symbol_id >= LP_SYMBOL_COUNT ||
         candidate.source_m1_time != m_portfolios[shadow_index].batch_m1_time ||
         candidate.branch_grid_id == 0 || candidate.candidate_identity == 0 ||
         candidate.candidate_identity != LP_RevmaDiscoveryAdmissionIdentity(candidate.branch, candidate.branch_grid_id, candidate.source_m1_time) ||
         (candidate.direction != LP_SIDE_LONG && candidate.direction != LP_SIDE_SHORT) ||
         candidate.fill_price <= 0.0 || !MathIsValidNumber(candidate.fill_price) ||
         candidate.q0 <= 0.0 || !MathIsValidNumber(candidate.q0) ||
         candidate.lots != LP_REVMA_DISCOVERY_ATOM_LOTS ||
         candidate.incremental_reservation_minor <= 0 || candidate.incremental_q_cash_minor <= 0 ||
         !candidate.center_policy_checked || candidate.pre_candidate_state_hash == 0 ||
         candidate.pre_candidate_state_hash != EconomicPreCandidateStateHash(shadow_index, candidate.symbol_id) ||
         (candidate.opportunity_id != 0 && (candidate.shared_origin_id == 0 ||
          candidate.opportunity_id != LP_RevmaDiscoveryOpportunityIdentity(candidate.shared_origin_id,
            candidate.symbol_id, candidate.source_m1_time, candidate.candidate_type))) ||
         (candidate.birth && candidate.candidate_type != LP_REVMA_DISCOVERY_CANDIDATE_BIRTH) ||
         (!candidate.birth && candidate.candidate_type == LP_REVMA_DISCOVERY_CANDIDATE_BIRTH) ||
         (candidate.branch == LP_REVMA_BRANCH_U && (!candidate.center_add_authorized ||
            candidate.center_policy_applies)) ||
         (candidate.branch == LP_REVMA_BRANCH_C && !candidate.center_support_snapshot.valid))
      {
         if(shadow_index >= 0) Invalidate(shadow_index, "shadow_candidate_invariant_failure");
         return false;
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
      LP_RevmaShadowGrid existing = m_grids[shadow_index][candidate.symbol_id];
      if((candidate.birth && existing.active) ||
         (!candidate.birth && (!existing.active || existing.flat ||
          existing.branch_grid_id != candidate.branch_grid_id ||
          existing.direction != candidate.direction ||
          candidate.source_m1_time <= existing.last_admission_m1_time)))
      {
         Invalidate(shadow_index, "candidate_grid_lifecycle_mismatch");
         return false;
      }
      m_candidates[shadow_index][m_candidate_count[shadow_index]] = candidate;
      m_candidate_count[shadow_index]++;
      return true;
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
      m_matched_opportunities_validated = false;
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
            if(candidate.opportunity_id == 0)
               continue;
            bool counterpart_found = false;
            for(int j = 0; j < m_candidate_count[other_index]; j++)
            {
               LP_RevmaShadowCandidate other = m_candidates[other_index][j];
               if(other.opportunity_id != candidate.opportunity_id)
                  continue;
               counterpart_found = other.shared_origin_id == candidate.shared_origin_id &&
                  other.symbol_id == candidate.symbol_id &&
                  other.source_m1_time == candidate.source_m1_time &&
                  other.candidate_type == candidate.candidate_type &&
                  other.pre_candidate_state_hash == candidate.pre_candidate_state_hash;
               break;
            }
            if(!counterpart_found)
            {
               Invalidate(0, "matched_causal_opportunity_not_identical");
               Invalidate(1, "matched_causal_opportunity_not_identical");
               return false;
            }
         }
      }
      m_matched_opportunities_validated = true;
      return true;
   }

   bool SortAndAllocate(const int branch)
   {
      int shadow_index = LP_RevmaShadowIndex(branch);
      if(shadow_index < 0 || !m_portfolios[shadow_index].valid ||
         !m_portfolios[shadow_index].batch_open || m_portfolios[shadow_index].allocation_complete ||
         !m_matched_opportunities_validated)
      {
         if(shadow_index >= 0) Invalidate(shadow_index, "shadow_allocation_state_invalid");
         return false;
      }
      SortCandidates(shadow_index);
      long allocated_reservation = m_portfolios[shadow_index].reservation_minor;
      if(allocated_reservation < 0 ||
         allocated_reservation > m_portfolios[shadow_index].capital_budget_minor)
      {
         Invalidate(shadow_index, "preallocation_reservation_inconsistent");
         return false;
      }
      for(int i = 0; i < m_candidate_count[shadow_index]; i++)
      {
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
            // Policy metadata advances, but inventory, money, reservation,
            // capacity, and admission identity remain untouched.
            m_grids[shadow_index][m_candidates[shadow_index][i].symbol_id].center_support =
               m_candidates[shadow_index][i].center_support_snapshot;
            continue;
         }
         long candidate_total = 0;
         if(!LP_RevmaSafeMinorAdd(allocated_reservation,
            m_candidates[shadow_index][i].incremental_reservation_minor, candidate_total))
         {
            Invalidate(shadow_index, "allocation_reservation_arithmetic_overflow");
            return false;
         }
         if(candidate_total <= m_portfolios[shadow_index].capital_budget_minor)
         {
            m_candidates[shadow_index][i].allocated = true;
            m_candidates[shadow_index][i].decision = LP_REVMA_DISCOVERY_DECISION_ADMIT;
            m_candidates[shadow_index][i].decision_reason = "capacity_allocated";
            allocated_reservation = candidate_total;
         }
         else
         {
            m_candidates[shadow_index][i].allocated = false;
            m_candidates[shadow_index][i].decision = LP_REVMA_DISCOVERY_DECISION_REJECT;
            m_candidates[shadow_index][i].decision_reason = "capital_budget_capacity_exhausted";
         }
      }
      m_portfolios[shadow_index].allocation_complete = true;
      return true;
   }

   bool CommitTransitions(const int branch)
   {
      int shadow_index = LP_RevmaShadowIndex(branch);
      if(shadow_index < 0 || !m_portfolios[shadow_index].valid ||
         !m_portfolios[shadow_index].batch_open || !m_portfolios[shadow_index].allocation_complete ||
         m_portfolios[shadow_index].transitions_committed)
      {
         if(shadow_index >= 0) Invalidate(shadow_index, "shadow_commit_state_invalid");
         return false;
      }
      long committed_reservation = m_portfolios[shadow_index].reservation_minor;
      for(int i = 0; i < m_candidate_count[shadow_index]; i++)
      {
         if(!m_candidates[shadow_index][i].allocated)
            continue;
         long next_reservation = 0;
         if(!LP_RevmaSafeMinorAdd(committed_reservation,
            m_candidates[shadow_index][i].incremental_reservation_minor, next_reservation) ||
            next_reservation > m_portfolios[shadow_index].capital_budget_minor ||
            !ApplyCandidate(shadow_index, m_candidates[shadow_index][i]))
         {
            Invalidate(shadow_index, "shadow_commit_reconciliation_failure");
            return false;
         }
         committed_reservation = next_reservation;
         LP_HashMixULong(m_portfolios[shadow_index].batch_hash, m_candidates[shadow_index][i].candidate_identity);
      }
      m_portfolios[shadow_index].reservation_minor = committed_reservation;
      m_portfolios[shadow_index].transitions_committed = true;
      return ReconcileReservation(shadow_index);
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
      return ReconcileEquity(shadow_index);
   }

   bool SetGridMarkedLiquidation(const int branch, const int symbol_id, const long marked_liquidation_minor, const long cost_minor)
   {
      int shadow_index = LP_RevmaShadowIndex(branch);
      if(shadow_index < 0 || symbol_id < 0 || symbol_id >= LP_SYMBOL_COUNT ||
         !m_portfolios[shadow_index].valid || cost_minor < 0)
      {
         if(shadow_index >= 0) Invalidate(shadow_index, "marked_liquidation_input_invalid");
         return false;
      }
      m_grids[shadow_index][symbol_id].marked_liquidation_minor = marked_liquidation_minor;
      m_grids[shadow_index][symbol_id].cost_minor = cost_minor;
      long branch_mark = 0;
      long branch_cost = 0;
      for(int i = 0; i < LP_SYMBOL_COUNT; i++)
      {
         if(!LP_RevmaSafeMinorAdd(branch_mark, m_grids[shadow_index][i].marked_liquidation_minor, branch_mark) ||
            !LP_RevmaSafeMinorAdd(branch_cost, m_grids[shadow_index][i].cost_minor, branch_cost))
         {
            Invalidate(shadow_index, "marked_liquidation_reconciliation_overflow");
            return false;
         }
      }
      m_portfolios[shadow_index].marked_liquidation_minor = branch_mark;
      m_portfolios[shadow_index].cost_minor = branch_cost;
      return ReconcileEquity(shadow_index);
   }

   bool EvaluateCloseAuthority(const int branch)
   {
      int shadow_index = LP_RevmaShadowIndex(branch);
      if(shadow_index < 0 || !m_portfolios[shadow_index].valid)
         return false;
      long harvest_plus_liability = 0;
      if(!LP_RevmaSafeMinorAdd(m_portfolios[shadow_index].realized_harvest_minor,
         m_portfolios[shadow_index].marked_liquidation_minor, harvest_plus_liability))
      {
         Invalidate(shadow_index, "close_authority_arithmetic_overflow");
         return false;
      }
      if(harvest_plus_liability <= -m_portfolios[shadow_index].capital_budget_minor)
      {
         m_portfolios[shadow_index].close_owner = LP_REVMA_DISCOVERY_CLOSE_HARD_RISK;
         m_portfolios[shadow_index].hard_risk_latched = true;
      }
      else if(m_portfolios[shadow_index].close_owner == LP_REVMA_DISCOVERY_CLOSE_NONE &&
         m_portfolios[shadow_index].realized_harvest_minor > 0 &&
         m_portfolios[shadow_index].marked_liquidation_minor < 0 &&
         harvest_plus_liability >= 0)
         m_portfolios[shadow_index].close_owner = LP_REVMA_DISCOVERY_CLOSE_CLEANUP;
      return true;
   }

   bool CloseGrid(
      const int branch,
      const int symbol_id,
      const int close_owner,
      const long realized_after_cost_minor,
      const long liquidation_cost_minor,
      const string terminal_reason
   )
   {
      int shadow_index = LP_RevmaShadowIndex(branch);
      if(shadow_index < 0 || symbol_id < 0 || symbol_id >= LP_SYMBOL_COUNT ||
         !m_portfolios[shadow_index].valid || !m_grids[shadow_index][symbol_id].active ||
         liquidation_cost_minor < 0 || terminal_reason == "" ||
         (close_owner != LP_REVMA_DISCOVERY_CLOSE_LOCAL_HARVEST &&
          close_owner != LP_REVMA_DISCOVERY_CLOSE_CLEANUP &&
          close_owner != LP_REVMA_DISCOVERY_CLOSE_HARD_RISK))
      {
         if(shadow_index >= 0) Invalidate(shadow_index, "shadow_grid_close_invariant_failure");
         return false;
      }
      if(m_portfolios[shadow_index].close_owner != LP_REVMA_DISCOVERY_CLOSE_NONE &&
         close_owner < m_portfolios[shadow_index].close_owner)
      {
         Invalidate(shadow_index, "shadow_close_owner_deescalation_forbidden");
         return false;
      }

      LP_RevmaShadowGrid grid = m_grids[shadow_index][symbol_id];
      long next_reservation = 0;
      long next_cost = 0;
      long next_realized = 0;
      if(!LP_RevmaSafeMinorAdd(m_portfolios[shadow_index].reservation_minor,
         -grid.reservation_minor, next_reservation) ||
         !LP_RevmaSafeMinorAdd(m_portfolios[shadow_index].cost_minor,
         liquidation_cost_minor, next_cost))
      {
         Invalidate(shadow_index, "shadow_grid_close_arithmetic_overflow");
         return false;
      }
      if(close_owner == LP_REVMA_DISCOVERY_CLOSE_LOCAL_HARVEST)
      {
         if(!LP_RevmaSafeMinorAdd(m_portfolios[shadow_index].realized_harvest_minor,
            realized_after_cost_minor, next_realized))
         {
            Invalidate(shadow_index, "harvest_realized_arithmetic_overflow");
            return false;
         }
         m_portfolios[shadow_index].realized_harvest_minor = next_realized;
         grid.realized_harvest_minor = realized_after_cost_minor;
      }
      else
      {
         if(!LP_RevmaSafeMinorAdd(m_portfolios[shadow_index].realized_nonharvest_minor,
            realized_after_cost_minor, next_realized))
         {
            Invalidate(shadow_index, "nonharvest_realized_arithmetic_overflow");
            return false;
         }
         m_portfolios[shadow_index].realized_nonharvest_minor = next_realized;
         grid.realized_nonharvest_minor = realized_after_cost_minor;
      }
      m_portfolios[shadow_index].reservation_minor = next_reservation;
      m_portfolios[shadow_index].cost_minor = next_cost;
      if(close_owner > m_portfolios[shadow_index].close_owner)
         m_portfolios[shadow_index].close_owner = close_owner;
      if(close_owner == LP_REVMA_DISCOVERY_CLOSE_HARD_RISK)
         m_portfolios[shadow_index].hard_risk_latched = true;

      grid.active = false;
      grid.flat = true;
      grid.atom_count = 0;
      grid.total_lots = 0.0;
      grid.weighted_entry_price_lots = 0.0;
      grid.average_entry_price = 0.0;
      grid.marked_liquidation_minor = 0;
      grid.reservation_minor = 0;
      grid.close_owner = close_owner;
      grid.terminal_reason = terminal_reason;
      grid.cost_minor = liquidation_cost_minor;
      m_grids[shadow_index][symbol_id] = grid;

      long branch_mark = 0;
      for(int i = 0; i < LP_SYMBOL_COUNT; i++)
      {
         if(!LP_RevmaSafeMinorAdd(branch_mark,
            m_grids[shadow_index][i].marked_liquidation_minor, branch_mark))
         {
            Invalidate(shadow_index, "post_close_mark_reconciliation_overflow");
            return false;
         }
      }
      m_portfolios[shadow_index].marked_liquidation_minor = branch_mark;
      return ReconcileReservation(shadow_index) && ReconcileEquity(shadow_index);
   }

   bool CompletePortfolioClose(const int branch)
   {
      int shadow_index = LP_RevmaShadowIndex(branch);
      if(shadow_index < 0 || !m_portfolios[shadow_index].valid ||
         m_portfolios[shadow_index].close_owner == LP_REVMA_DISCOVERY_CLOSE_NONE ||
         !AllGridsFlat(shadow_index) || m_portfolios[shadow_index].reservation_minor != 0)
      {
         if(shadow_index >= 0) Invalidate(shadow_index, "portfolio_close_completion_not_flat");
         return false;
      }
      if(!ReconcileEquity(shadow_index))
         return false;
      if(m_portfolios[shadow_index].close_owner == LP_REVMA_DISCOVERY_CLOSE_CLEANUP &&
         m_portfolios[shadow_index].branch_equity_minor < m_portfolios[shadow_index].equity_reference_minor)
         m_portfolios[shadow_index].cleanup_shortfall = true;
      if(m_portfolios[shadow_index].close_owner != LP_REVMA_DISCOVERY_CLOSE_HARD_RISK)
         m_portfolios[shadow_index].close_owner = LP_REVMA_DISCOVERY_CLOSE_NONE;
      return true;
   }

   bool ReentryEligible(const int branch, const int symbol_id)
   {
      int shadow_index = LP_RevmaShadowIndex(branch);
      if(shadow_index < 0 || symbol_id < 0 || symbol_id >= LP_SYMBOL_COUNT ||
         !m_portfolios[shadow_index].valid || m_portfolios[shadow_index].batch_open ||
         m_portfolios[shadow_index].close_owner != LP_REVMA_DISCOVERY_CLOSE_NONE ||
         m_portfolios[shadow_index].hard_risk_latched)
         return false;
      return !m_grids[shadow_index][symbol_id].active && m_grids[shadow_index][symbol_id].flat;
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
