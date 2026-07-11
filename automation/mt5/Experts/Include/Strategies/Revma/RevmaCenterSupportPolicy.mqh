/*-----------------------------------------------
  Gate 108 signed-center support policy for C only
-----------------------------------------------*/
#ifndef __LIMNI_PORTFOLIO_REVMA_CENTER_SUPPORT_POLICY_MQH__
#define __LIMNI_PORTFOLIO_REVMA_CENTER_SUPPORT_POLICY_MQH__

#include "RevmaPathGeometry.mqh"

struct LP_RevmaCenterSupportState
{
   bool valid;
   bool applicable;
   bool adverse_adds_frozen;
   int direction;
   long p0_ticks;
   long c0_ticks;
   long previous_center_ticks;
   long current_center_ticks;
   int support0_sign;
   int previous_support_sign;
   int current_support_sign;
   double q0;
   double current_q;
   double support0_q;
   double current_support_q;
   double current_revision_q;
   double cumulative_signed_revision_q;
   double cumulative_absolute_revision_q;
   double minimum_support_q;
   double maximum_support_q;
   double regression_sum_x;
   double regression_sum_y;
   double regression_sum_x2;
   double regression_sum_xy;
   int center_update_count;
   int center_not_available_count;
   int adverse_adds_blocked_after_latch;
   datetime birth_m1_time;
   datetime first_center_update_m1;
   datetime last_center_update_m1;
   datetime latch_m1_time;
   string applicability_reason;
   string last_observation_reason;
};

void LP_ResetRevmaCenterSupportState(LP_RevmaCenterSupportState &state)
{
   state.valid = false;
   state.applicable = false;
   state.adverse_adds_frozen = false;
   state.direction = LP_SIDE_NONE;
   state.p0_ticks = 0;
   state.c0_ticks = 0;
   state.previous_center_ticks = 0;
   state.current_center_ticks = 0;
   state.support0_sign = 0;
   state.previous_support_sign = 0;
   state.current_support_sign = 0;
   state.q0 = 0.0;
   state.current_q = 0.0;
   state.support0_q = 0.0;
   state.current_support_q = 0.0;
   state.current_revision_q = 0.0;
   state.cumulative_signed_revision_q = 0.0;
   state.cumulative_absolute_revision_q = 0.0;
   state.minimum_support_q = 0.0;
   state.maximum_support_q = 0.0;
   state.regression_sum_x = 0.0;
   state.regression_sum_y = 0.0;
   state.regression_sum_x2 = 0.0;
   state.regression_sum_xy = 0.0;
   state.center_update_count = 0;
   state.center_not_available_count = 0;
   state.adverse_adds_blocked_after_latch = 0;
   state.birth_m1_time = 0;
   state.first_center_update_m1 = 0;
   state.last_center_update_m1 = 0;
   state.latch_m1_time = 0;
   state.applicability_reason = "NOT_INITIALIZED";
   state.last_observation_reason = "NOT_OBSERVED";
}

int LP_RevmaDirectedSupportSign(const int direction, const long center_ticks, const long p0_ticks)
{
   return LP_RevmaSignLong((long)direction * (center_ticks - p0_ticks));
}

bool LP_RevmaInitializeCenterSupport(
   const int direction,
   const double p0,
   const double c0,
   const double q0,
   const double broker_tick_size,
   const datetime birth_m1_time,
   LP_RevmaCenterSupportState &state
)
{
   LP_ResetRevmaCenterSupportState(state);
   if((direction != LP_SIDE_LONG && direction != LP_SIDE_SHORT) ||
      p0 <= 0.0 || c0 <= 0.0 || q0 <= 0.0 || broker_tick_size <= 0.0 ||
      !MathIsValidNumber(p0) || !MathIsValidNumber(c0) ||
      !MathIsValidNumber(q0) || !MathIsValidNumber(broker_tick_size) ||
      birth_m1_time <= 0)
   {
      state.last_observation_reason = "CENTER_NOT_AVAILABLE";
      return false;
   }
   long p0_ticks = 0;
   long c0_ticks = 0;
   if(!LP_RevmaPriceToTicks(p0, broker_tick_size, p0_ticks) ||
      !LP_RevmaPriceToTicks(c0, broker_tick_size, c0_ticks))
   {
      state.last_observation_reason = "CENTER_NOT_AVAILABLE";
      return false;
   }
   state.valid = true;
   state.direction = direction;
   state.p0_ticks = p0_ticks;
   state.c0_ticks = c0_ticks;
   state.previous_center_ticks = c0_ticks;
   state.current_center_ticks = c0_ticks;
   state.support0_sign = LP_RevmaDirectedSupportSign(direction, c0_ticks, p0_ticks);
   state.previous_support_sign = state.support0_sign;
   state.current_support_sign = state.support0_sign;
   state.q0 = q0;
   state.current_q = q0;
   state.support0_q = (double)direction * (c0 - p0) / q0;
   state.current_support_q = state.support0_q;
   state.minimum_support_q = state.support0_q;
   state.maximum_support_q = state.support0_q;
   state.birth_m1_time = birth_m1_time;
   state.applicable = state.support0_sign > 0;
   state.applicability_reason = state.applicable ?
      "CENTER_ALIGNED_V1" : "NOT_APPLICABLE_V1";
   state.last_observation_reason = "CENTER_SUPPORT_INITIALIZED";
   return true;
}

bool LP_RevmaObserveCenterSupport(
   const double current_center,
   const double current_q,
   const double broker_tick_size,
   const datetime source_m1_time,
   LP_RevmaCenterSupportState &state
)
{
   if(!state.valid || source_m1_time <= 0 || source_m1_time < state.birth_m1_time)
      return false;
   if(current_center <= 0.0 || current_q <= 0.0 || broker_tick_size <= 0.0 ||
      !MathIsValidNumber(current_center) || !MathIsValidNumber(current_q) ||
      !MathIsValidNumber(broker_tick_size))
   {
      state.center_not_available_count++;
      state.last_observation_reason = "CENTER_NOT_AVAILABLE";
      return true;
   }
   long center_ticks = 0;
   if(!LP_RevmaPriceToTicks(current_center, broker_tick_size, center_ticks))
   {
      state.center_not_available_count++;
      state.last_observation_reason = "CENTER_NOT_AVAILABLE";
      return true;
   }

   int previous_sign = state.current_support_sign;
   int current_sign = LP_RevmaDirectedSupportSign(state.direction, center_ticks, state.p0_ticks);
   state.previous_center_ticks = state.current_center_ticks;
   state.previous_support_sign = previous_sign;
   state.current_center_ticks = center_ticks;
   state.current_support_sign = current_sign;
   state.current_q = current_q;
   double previous_revision_q = state.current_revision_q;
   state.current_support_q = (double)state.direction *
      ((double)(center_ticks - state.p0_ticks) * broker_tick_size) / state.q0;
   state.current_revision_q = (double)state.direction *
      ((double)(center_ticks - state.c0_ticks) * broker_tick_size) / state.q0;
   double revision_delta = state.current_revision_q - previous_revision_q;
   state.cumulative_signed_revision_q += revision_delta;
   state.cumulative_absolute_revision_q += MathAbs(revision_delta);
   if(state.current_support_q < state.minimum_support_q)
      state.minimum_support_q = state.current_support_q;
   if(state.current_support_q > state.maximum_support_q)
      state.maximum_support_q = state.current_support_q;

   if(center_ticks != state.previous_center_ticks)
   {
      state.center_update_count++;
      if(state.first_center_update_m1 <= 0)
         state.first_center_update_m1 = source_m1_time;
      state.last_center_update_m1 = source_m1_time;
      double x = (double)state.center_update_count;
      double y = (double)center_ticks;
      state.regression_sum_x += x;
      state.regression_sum_y += y;
      state.regression_sum_x2 += x * x;
      state.regression_sum_xy += x * y;
   }

   if(state.applicable && !state.adverse_adds_frozen &&
      previous_sign > 0 && current_sign <= 0)
   {
      state.adverse_adds_frozen = true;
      state.latch_m1_time = source_m1_time;
      state.last_observation_reason = "CENTER_SUPPORT_POSITIVE_TO_NONPOSITIVE_LATCHED";
   }
   else
      state.last_observation_reason = state.applicable ?
         "CENTER_SUPPORT_OBSERVED" : "CENTER_MISALIGNED_OBSERVATIONAL_ONLY";
   return true;
}

bool LP_RevmaCenterAuthorizesCandidate(
   const int candidate_type,
   LP_RevmaCenterSupportState &state,
   string &reason
)
{
   reason = "CENTER_POLICY_NOT_APPLICABLE";
   if(!state.valid)
   {
      reason = "CENTER_NOT_AVAILABLE";
      return false;
   }
   if(candidate_type == LP_REVMA_DISCOVERY_CANDIDATE_BIRTH)
   {
      reason = state.applicable ? "CENTER_ALIGNED_BIRTH" : "CENTER_MISALIGNED_BIRTH_OBSERVATIONAL";
      return true;
   }
   if(candidate_type == LP_REVMA_DISCOVERY_CANDIDATE_FAVORABLE_ADD)
   {
      reason = "FAVORABLE_ADD_CENTER_AUTHORITY_FORBIDDEN";
      return true;
   }
   if(candidate_type != LP_REVMA_DISCOVERY_CANDIDATE_ADVERSE_ADD)
   {
      reason = "CENTER_CANDIDATE_TYPE_INVALID";
      return false;
   }
   if(!state.applicable)
   {
      reason = "CENTER_MISALIGNED_ADVERSE_ADD_OBSERVATIONAL";
      return true;
   }
   if(state.adverse_adds_frozen)
   {
      state.adverse_adds_blocked_after_latch++;
      reason = "SIGNED_CENTER_SUPPORT_ADVERSE_ADDS_FROZEN";
      return false;
   }
   reason = "SIGNED_CENTER_SUPPORT_REMAINS_POSITIVE";
   return true;
}

#endif // __LIMNI_PORTFOLIO_REVMA_CENTER_SUPPORT_POLICY_MQH__
