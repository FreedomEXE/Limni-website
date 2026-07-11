/*-----------------------------------------------
  Gate 108 policy-neutral completed-M1 path geometry
-----------------------------------------------*/
#ifndef __LIMNI_PORTFOLIO_REVMA_PATH_GEOMETRY_MQH__
#define __LIMNI_PORTFOLIO_REVMA_PATH_GEOMETRY_MQH__

#include "RevmaDiscoveryTypes.mqh"

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
   if(raw_cell <= 0.0 || raw_ticks <= 0.0 || !MathIsValidNumber(raw_ticks))
      return false;
   long cell_ticks = (long)MathCeil(raw_ticks - 1.0e-12);
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
   if(!MathIsValidNumber(raw_ticks))
      return false;
   price_ticks = (long)MathRound(raw_ticks);
   return price_ticks > 0;
}

long LP_RevmaCompletedCellIndex(const long p0_ticks, const long current_ticks, const long cell_ticks)
{
   if(cell_ticks <= 0)
      return 0;
   long displacement = current_ticks - p0_ticks;
   long magnitude = MathAbs(displacement) / cell_ticks;
   return displacement < 0 ? -magnitude : magnitude;
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
   state.last_observation_m1 = source_m1_time;
   return true;
}

bool LP_RevmaObserveCompletedM1Path(const double structural_price, const double broker_tick_size, const int grid_direction, const datetime source_m1_time, LP_RevmaPathGeometryState &state)
{
   if(!state.valid || state.cell_ticks <= 0 || (grid_direction != LP_SIDE_LONG && grid_direction != LP_SIDE_SHORT) || source_m1_time <= state.last_observation_m1)
      return false;
   long current_ticks = 0;
   if(!LP_RevmaPriceToTicks(structural_price, broker_tick_size, current_ticks))
      return false;
   long previous = state.current_cell_index;
   long current = LP_RevmaCompletedCellIndex(state.p0_ticks, current_ticks, state.cell_ticks);
   long delta = current - previous;
   long jump = MathAbs(delta);
   int movement_sign = LP_RevmaSignLong(delta);
   state.previous_cell_index = previous;
   state.current_cell_index = current;
   state.last_observation_m1 = source_m1_time;
   if(jump <= 0)
      return true;
   state.total_cell_path += jump;
   state.completed_cell_crossings += jump;
   if(jump > state.maximum_single_observation_cell_jump)
      state.maximum_single_observation_cell_jump = jump;
   long prior_distance = MathAbs(previous);
   long current_distance = MathAbs(current);
   if(current_distance < prior_distance)
      state.matched_reversal_crossings += prior_distance - current_distance;
   else if(LP_RevmaSignLong(previous) != 0 && LP_RevmaSignLong(current) != 0 && LP_RevmaSignLong(previous) != LP_RevmaSignLong(current))
      state.matched_reversal_crossings += prior_distance;
   if(state.last_movement_sign != 0 && movement_sign != state.last_movement_sign)
      state.last_reversal_m1 = source_m1_time;
   state.last_movement_sign = movement_sign;
   if(current > state.maximum_cell_index)
   {
      long expansion = current - state.maximum_cell_index;
      if(grid_direction == LP_SIDE_LONG) state.favorable_frontier_expansions += expansion;
      else state.adverse_frontier_expansions += expansion;
      state.maximum_cell_index = current;
      state.new_extreme_count++;
   }
   if(current < state.minimum_cell_index)
   {
      long expansion = state.minimum_cell_index - current;
      if(grid_direction == LP_SIDE_LONG) state.adverse_frontier_expansions += expansion;
      else state.favorable_frontier_expansions += expansion;
      state.minimum_cell_index = current;
      state.new_extreme_count++;
   }
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
