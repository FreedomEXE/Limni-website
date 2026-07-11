/*-----------------------------------------------
  Gate 108 RevMA Adaptive Grid Discovery contracts
-----------------------------------------------*/
#ifndef __LIMNI_PORTFOLIO_REVMA_DISCOVERY_TYPES_MQH__
#define __LIMNI_PORTFOLIO_REVMA_DISCOVERY_TYPES_MQH__

#include "..\\..\\Core\\Types.mqh"
#include "..\\RevmaTypes.mqh"

#define LP_REVMA_DISCOVERY_FORMULA_ID "revma-adaptive-grid-discovery-v1"
#define LP_REVMA_DISCOVERY_PROFILE_ID "gate108-core-institutional-v1"
#define LP_REVMA_DISCOVERY_MESH_ID "DISCOVERY_MESH_V1"
#define LP_REVMA_REAL_BRANCH_ID "REAL_EXECUTION_ENVELOPE_V1"
#define LP_REVMA_SHADOW_U_BRANCH_ID "SHADOW_RAW_COUNT_UNCAPPED_V1"
#define LP_REVMA_SHADOW_C_BRANCH_ID "SHADOW_SIGNED_CENTER_SUPPORT_V1"
#define LP_REVMA_DISCOVERY_CAPITAL_BUDGET_FRACTION 0.10
#define LP_REVMA_DISCOVERY_CELL_Q_FRACTION 0.10
#define LP_REVMA_DISCOVERY_ATOM_LOTS 0.01
#define LP_REVMA_REAL_MAX_ATOMS_PER_GRID 2
#define LP_REVMA_DISCOVERY_MAX_ADMISSIONS_PER_M1 1
#define LP_REVMA_DISCOVERY_BRANCH_COUNT 3
#define LP_REVMA_SHADOW_BRANCH_COUNT 2

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
   LP_REVMA_DISCOVERY_CANDIDATE_BIRTH = 0,
   LP_REVMA_DISCOVERY_CANDIDATE_ADVERSE_ADD = 1,
   LP_REVMA_DISCOVERY_CANDIDATE_FAVORABLE_ADD = 2
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

bool LP_RevmaDiscoveryCapitalMandateValid()
{
   return LP_REVMA_DISCOVERY_CAPITAL_BUDGET_FRACTION > 0.0 &&
      LP_REVMA_DISCOVERY_CAPITAL_BUDGET_FRACTION < 1.0;
}

ulong LP_RevmaDiscoveryFormulaHash()
{
   static ulong cached_hash = 0;
   if(cached_hash != 0)
      return cached_hash;
   string payload = LP_REVMA_DISCOVERY_FORMULA_ID;
   payload += "|profile=" + LP_REVMA_DISCOVERY_PROFILE_ID;
   payload += "|underlying_revma_formula_hash=" + (string)LP_RevmaFormulaHash();
   payload += "|mesh=" + LP_REVMA_DISCOVERY_MESH_ID;
   payload += "|capital_budget_fraction=0.10";
   payload += "|cell_q_fraction=0.10";
   payload += "|atom_lots=0.01";
   payload += "|real_max_atoms=2";
   payload += "|max_admissions_per_grid_m1=1";
   payload += "|shadow_topology=2x28_one_grid_per_symbol_branch";
   payload += "|allocation=build_all_sort_reservation_symbol_identity_allocate_commit";
   payload += "|money_ledger=signed_integer_minor_currency_units";
   payload += "|arithmetic_failure=branch_invalid";
   payload += "|center_authority=C_aligned_positive_to_nonpositive_adverse_add_only";
   payload += "|center_missing=no_latch_no_reclassification";
   payload += "|center_misaligned=observational_only";
   payload += "|cell_quantization=ceil_outward_to_broker_tick";
   payload += "|path_price=closed_m1_structural_decision_price";
   payload += "|branches=R,U,C";
   payload += "|shadow_broker_calls=forbidden";
   payload += "|resource_exhaustion=invalidates_not_caps";
   cached_hash = LP_HashString(payload);
   return cached_hash;
}

ulong LP_RevmaDiscoveryOpportunityIdentity(
   const ulong shared_origin_id,
   const int symbol_id,
   const datetime source_m1_time,
   const int candidate_type
)
{
   ulong hash = shared_origin_id;
   LP_HashMixInt(hash, symbol_id);
   LP_HashMixLong(hash, (long)source_m1_time);
   LP_HashMixInt(hash, candidate_type);
   LP_HashMixULong(hash, LP_RevmaDiscoveryFormulaHash());
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
