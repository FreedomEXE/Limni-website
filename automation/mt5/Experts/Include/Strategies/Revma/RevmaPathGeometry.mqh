/*-----------------------------------------------
  Gate 108 policy-neutral completed-M1 path geometry
-----------------------------------------------*/
#ifndef __LIMNI_PORTFOLIO_REVMA_PATH_GEOMETRY_MQH__
#define __LIMNI_PORTFOLIO_REVMA_PATH_GEOMETRY_MQH__

#include "RevmaDiscoveryTypes.mqh"

#define LP_REVMA_GEOMETRY_ABS_LIMIT 9000000000000000000

bool LP_RevmaSafeGeometryAdd(const long left, const long right, long &result)
{
   result = 0;
   if(left > LP_REVMA_GEOMETRY_ABS_LIMIT || left < -LP_REVMA_GEOMETRY_ABS_LIMIT ||
      right > LP_REVMA_GEOMETRY_ABS_LIMIT || right < -LP_REVMA_GEOMETRY_ABS_LIMIT ||
      (right > 0 && left > LP_REVMA_GEOMETRY_ABS_LIMIT - right) ||
      (right < 0 && left < -LP_REVMA_GEOMETRY_ABS_LIMIT - right))
      return false;
   result = left + right;
   return true;
}

int LP_RevmaSignLong(const long value)
{
   if(value > 0) return 1;
   if(value < 0) return -1;
   return 0;
}

bool LP_RevmaBuildDiscoveryMesh(const double q0, const double broker_tick_size, LP_RevmaDiscoveryMesh &mesh)
{
   LP_ResetRevmaDiscoveryMesh(mesh);
   if(q0 <= 0.0 || broker_tick_size <= 0.0 || !MathIsValidNumber(q0) || !MathIsValidNumber(broker_tick_size))
      return false;
   double raw_cell = LP_REVMA_DISCOVERY_CELL_Q_FRACTION * q0;
   double raw_ticks = raw_cell / broker_tick_size;
   if(raw_cell <= 0.0 || raw_ticks <= 0.0 || !MathIsValidNumber(raw_ticks) ||
      raw_ticks > (double)LP_REVMA_GEOMETRY_ABS_LIMIT)
      return false;
   long cell_ticks = (long)MathCeil(raw_ticks);
   double cell_price = (double)cell_ticks * broker_tick_size;
   if(cell_ticks <= 0 || cell_price <= 0.0 || !MathIsValidNumber(cell_price))
      return false;
   mesh.valid = true;
   mesh.q0 = q0;
   mesh.broker_tick_size = broker_tick_size;
   mesh.discovery_cell_ticks = cell_ticks;
   mesh.discovery_cell_price = cell_price;
   return true;
}

bool LP_RevmaPriceToTicks(const double price, const double broker_tick_size, long &price_ticks)
{
   price_ticks = 0;
   if(price <= 0.0 || broker_tick_size <= 0.0 || !MathIsValidNumber(price) || !MathIsValidNumber(broker_tick_size))
      return false;
   double raw_ticks = price / broker_tick_size;
   if(!MathIsValidNumber(raw_ticks) ||
      raw_ticks > (double)LP_REVMA_GEOMETRY_ABS_LIMIT)
      return false;
   price_ticks = (long)MathRound(raw_ticks);
   return price_ticks > 0;
}

bool LP_RevmaCompletedCellIndex(
   const long p0_ticks,
   const long current_ticks,
   const long cell_ticks,
   long &cell_index
)
{
   cell_index = 0;
   if(cell_ticks <= 0)
      return false;
   long displacement = 0;
   if(!LP_RevmaSafeGeometryAdd(current_ticks, -p0_ticks, displacement))
      return false;
   long magnitude = MathAbs(displacement) / cell_ticks;
   cell_index = displacement < 0 ? -magnitude : magnitude;
   return true;
}

bool LP_RevmaInitializePathGeometry(const double p0, const LP_RevmaDiscoveryMesh &mesh, const datetime source_m1_time, LP_RevmaPathGeometryState &state)
{
   LP_ResetRevmaPathGeometryState(state);
   if(!mesh.valid || source_m1_time <= 0)
      return false;
   long p0_ticks = 0;
   if(!LP_RevmaPriceToTicks(p0, mesh.broker_tick_size, p0_ticks))
      return false;
   state.valid = true;
   state.p0_ticks = p0_ticks;
   state.cell_ticks = mesh.discovery_cell_ticks;
   state.broker_tick_size = mesh.broker_tick_size;
   state.last_observation_m1 = source_m1_time;
   return true;
}

bool LP_RevmaObserveCompletedM1Path(const double structural_price, const double broker_tick_size, const int grid_direction, const datetime source_m1_time, LP_RevmaPathGeometryState &state)
{
   if(!state.valid || state.cell_ticks <= 0 ||
      broker_tick_size != state.broker_tick_size ||
      (grid_direction != LP_SIDE_LONG && grid_direction != LP_SIDE_SHORT) ||
      source_m1_time <= state.last_observation_m1)
      return false;
   long current_ticks = 0;
   if(!LP_RevmaPriceToTicks(structural_price, broker_tick_size, current_ticks))
      return false;
   long previous = state.current_cell_index;
   long current = 0;
   long delta = 0;
   if(!LP_RevmaCompletedCellIndex(state.p0_ticks, current_ticks,
      state.cell_ticks, current) ||
      !LP_RevmaSafeGeometryAdd(current, -previous, delta))
      return false;
   long jump = MathAbs(delta);
   int movement_sign = LP_RevmaSignLong(delta);
   if(jump <= 0)
   {
      state.previous_cell_index = previous;
      state.current_cell_index = current;
      state.last_observation_m1 = source_m1_time;
      return true;
   }
   long new_total_cell_path = 0;
   long new_completed_cell_crossings = 0;
   long new_matched_reversal_crossings = state.matched_reversal_crossings;
   long new_adverse_frontier_expansions = state.adverse_frontier_expansions;
   long new_favorable_frontier_expansions = state.favorable_frontier_expansions;
   long new_extreme_count = state.new_extreme_count;
   if(!LP_RevmaSafeGeometryAdd(state.total_cell_path, jump,
      new_total_cell_path) ||
      !LP_RevmaSafeGeometryAdd(state.completed_cell_crossings, jump,
      new_completed_cell_crossings))
      return false;
   long prior_distance = MathAbs(previous);
   long current_distance = MathAbs(current);
   long reversal_increment = 0;
   int previous_sign = LP_RevmaSignLong(previous);
   int current_sign = LP_RevmaSignLong(current);
   if(previous_sign != 0 && current_sign != 0 && previous_sign != current_sign)
      reversal_increment = prior_distance;
   else if(current_distance < prior_distance)
      reversal_increment = prior_distance - current_distance;
   if(!LP_RevmaSafeGeometryAdd(state.matched_reversal_crossings,
      reversal_increment, new_matched_reversal_crossings))
      return false;
   long new_maximum_cell_index = state.maximum_cell_index;
   long new_minimum_cell_index = state.minimum_cell_index;
   if(current > state.maximum_cell_index)
   {
      long expansion = 0;
      if(!LP_RevmaSafeGeometryAdd(current, -state.maximum_cell_index,
         expansion)) return false;
      if(grid_direction == LP_SIDE_LONG)
      {
         if(!LP_RevmaSafeGeometryAdd(new_favorable_frontier_expansions,
            expansion, new_favorable_frontier_expansions)) return false;
      }
      else if(!LP_RevmaSafeGeometryAdd(new_adverse_frontier_expansions,
         expansion, new_adverse_frontier_expansions)) return false;
      new_maximum_cell_index = current;
      if(!LP_RevmaSafeGeometryAdd(new_extreme_count, 1, new_extreme_count))
         return false;
   }
   if(current < state.minimum_cell_index)
   {
      long expansion = 0;
      if(!LP_RevmaSafeGeometryAdd(state.minimum_cell_index, -current,
         expansion)) return false;
      if(grid_direction == LP_SIDE_LONG)
      {
         if(!LP_RevmaSafeGeometryAdd(new_adverse_frontier_expansions,
            expansion, new_adverse_frontier_expansions)) return false;
      }
      else if(!LP_RevmaSafeGeometryAdd(new_favorable_frontier_expansions,
         expansion, new_favorable_frontier_expansions)) return false;
      new_minimum_cell_index = current;
      if(!LP_RevmaSafeGeometryAdd(new_extreme_count, 1, new_extreme_count))
         return false;
   }
   state.previous_cell_index = previous;
   state.current_cell_index = current;
   state.last_observation_m1 = source_m1_time;
   state.total_cell_path = new_total_cell_path;
   state.completed_cell_crossings = new_completed_cell_crossings;
   state.matched_reversal_crossings = new_matched_reversal_crossings;
   state.adverse_frontier_expansions = new_adverse_frontier_expansions;
   state.favorable_frontier_expansions = new_favorable_frontier_expansions;
   state.maximum_cell_index = new_maximum_cell_index;
   state.minimum_cell_index = new_minimum_cell_index;
   state.new_extreme_count = new_extreme_count;
   if(jump > state.maximum_single_observation_cell_jump)
      state.maximum_single_observation_cell_jump = jump;
   if(state.last_movement_sign != 0 && movement_sign != state.last_movement_sign)
      state.last_reversal_m1 = source_m1_time;
   state.last_movement_sign = movement_sign;
   return true;
}

double LP_RevmaCkIdealizedScore(const LP_RevmaPathGeometryState &state)
{
   return (double)state.total_cell_path - (double)state.current_cell_index * (double)state.current_cell_index;
}

long LP_RevmaReversiblePath(const LP_RevmaPathGeometryState &state)
{
   return state.total_cell_path - MathAbs(state.current_cell_index);
}

double LP_RevmaTrendEfficiency(const LP_RevmaPathGeometryState &state)
{
   long denominator = state.total_cell_path > 0 ? state.total_cell_path : 1;
   return (double)MathAbs(state.current_cell_index) / (double)denominator;
}

#endif // __LIMNI_PORTFOLIO_REVMA_PATH_GEOMETRY_MQH__
