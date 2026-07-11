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
   double p0_raw;
   double c0_raw;
   double previous_center_raw;
   double current_center_raw;
   int support0_sign;
   int previous_support_sign;
   int current_support_sign;
   double q0;
   double current_q;
   double broker_tick_size;
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
   int center_observation_count;
   int center_not_available_count;
   int adverse_adds_blocked_after_latch;
   ulong last_blocked_candidate_identity;
   datetime last_blocked_candidate_m1;
   int birth_q_event_index;
   int current_q_event_index;
   int first_center_update_q_event_index;
   int last_center_update_q_event_index;
   datetime birth_m1_time;
   datetime first_center_update_m1;
   datetime last_center_update_m1;
   int first_center_update_observation_index;
   int last_center_update_observation_index;
   datetime latch_m1_time;
   datetime last_observation_m1;
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
   state.p0_raw = 0.0;
   state.c0_raw = 0.0;
   state.previous_center_raw = 0.0;
   state.current_center_raw = 0.0;
   state.support0_sign = 0;
   state.previous_support_sign = 0;
   state.current_support_sign = 0;
   state.q0 = 0.0;
   state.current_q = 0.0;
   state.broker_tick_size = 0.0;
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
   state.center_observation_count = 0;
   state.center_not_available_count = 0;
   state.adverse_adds_blocked_after_latch = 0;
   state.last_blocked_candidate_identity = 0;
   state.last_blocked_candidate_m1 = 0;
   state.birth_q_event_index = 0;
   state.current_q_event_index = 0;
   state.first_center_update_q_event_index = 0;
   state.last_center_update_q_event_index = 0;
   state.birth_m1_time = 0;
   state.first_center_update_m1 = 0;
   state.last_center_update_m1 = 0;
   state.first_center_update_observation_index = 0;
   state.last_center_update_observation_index = 0;
   state.latch_m1_time = 0;
   state.last_observation_m1 = 0;
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
   const int birth_q_event_index,
   const datetime birth_m1_time,
   LP_RevmaCenterSupportState &state
)
{
   LP_ResetRevmaCenterSupportState(state);
   if((direction != LP_SIDE_LONG && direction != LP_SIDE_SHORT) ||
      p0 <= 0.0 || c0 <= 0.0 || q0 <= 0.0 || broker_tick_size <= 0.0 ||
      !MathIsValidNumber(p0) || !MathIsValidNumber(c0) ||
      !MathIsValidNumber(q0) || !MathIsValidNumber(broker_tick_size) ||
      birth_q_event_index <= 0 || birth_m1_time <= 0)
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
   double support0_q = (double)direction * (c0 - p0) / q0;
   if(!MathIsValidNumber(support0_q))
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
   state.p0_raw = p0;
   state.c0_raw = c0;
   state.previous_center_raw = c0;
   state.current_center_raw = c0;
   state.support0_sign = LP_RevmaDirectedSupportSign(direction, c0_ticks, p0_ticks);
   state.previous_support_sign = state.support0_sign;
   state.current_support_sign = state.support0_sign;
   state.q0 = q0;
   state.current_q = q0;
   state.broker_tick_size = broker_tick_size;
   state.support0_q = support0_q;
   state.current_support_q = state.support0_q;
   state.minimum_support_q = state.support0_q;
   state.maximum_support_q = state.support0_q;
   state.birth_m1_time = birth_m1_time;
   state.birth_q_event_index = birth_q_event_index;
   state.current_q_event_index = birth_q_event_index;
   state.last_observation_m1 = birth_m1_time;
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
   const int current_q_event_index,
   const datetime source_m1_time,
   LP_RevmaCenterSupportState &state
)
{
   if(!state.valid || source_m1_time <= state.last_observation_m1 ||
      broker_tick_size != state.broker_tick_size || current_q <= 0.0 ||
      !MathIsValidNumber(current_q) || broker_tick_size <= 0.0 ||
      !MathIsValidNumber(broker_tick_size) ||
      current_q_event_index < state.current_q_event_index)
      return false;
   if(state.center_observation_count >= 2147483647 ||
      state.center_not_available_count >= 2147483647 ||
      state.center_update_count >= 2147483647)
      return false;
   LP_RevmaCenterSupportState next = state;
   next.last_observation_m1 = source_m1_time;
   next.center_observation_count++;
   next.current_q = current_q;
   next.current_q_event_index = current_q_event_index;
   if(current_center <= 0.0 || !MathIsValidNumber(current_center))
   {
      next.center_not_available_count++;
      next.last_observation_reason = "CENTER_NOT_AVAILABLE";
      state = next;
      return true;
   }
   long center_ticks = 0;
   if(!LP_RevmaPriceToTicks(current_center, broker_tick_size, center_ticks))
   {
      next.center_not_available_count++;
      next.last_observation_reason = "CENTER_NOT_AVAILABLE";
      state = next;
      return true;
   }

   int previous_sign = next.current_support_sign;
   int current_sign = LP_RevmaDirectedSupportSign(next.direction, center_ticks, next.p0_ticks);
   next.previous_center_ticks = next.current_center_ticks;
   next.previous_support_sign = previous_sign;
   next.previous_center_raw = next.current_center_raw;
   next.current_center_ticks = center_ticks;
   next.current_center_raw = current_center;
   next.current_support_sign = current_sign;
   double previous_revision_q = next.current_revision_q;
   next.current_support_q = (double)next.direction *
      (current_center - next.p0_raw) / next.q0;
   next.current_revision_q = (double)next.direction *
      (current_center - next.c0_raw) / next.q0;
   double revision_delta = next.current_revision_q - previous_revision_q;
   next.cumulative_signed_revision_q += revision_delta;
   next.cumulative_absolute_revision_q += MathAbs(revision_delta);
   if(!MathIsValidNumber(next.current_support_q) ||
      !MathIsValidNumber(next.current_revision_q) ||
      !MathIsValidNumber(revision_delta) ||
      !MathIsValidNumber(next.cumulative_signed_revision_q) ||
      !MathIsValidNumber(next.cumulative_absolute_revision_q))
      return false;
   if(next.current_support_q < next.minimum_support_q)
      next.minimum_support_q = next.current_support_q;
   if(next.current_support_q > next.maximum_support_q)
      next.maximum_support_q = next.current_support_q;

   if(current_center != next.previous_center_raw)
   {
      next.center_update_count++;
      if(next.first_center_update_m1 <= 0)
      {
         next.first_center_update_m1 = source_m1_time;
         next.first_center_update_observation_index =
            next.center_observation_count;
         next.first_center_update_q_event_index = current_q_event_index;
      }
      next.last_center_update_m1 = source_m1_time;
      next.last_center_update_observation_index =
         next.center_observation_count;
      next.last_center_update_q_event_index = current_q_event_index;
      double x = (double)next.center_observation_count;
      double y = next.current_revision_q;
      next.regression_sum_x += x;
      next.regression_sum_y += y;
      next.regression_sum_x2 += x * x;
      next.regression_sum_xy += x * y;
      if(!MathIsValidNumber(next.regression_sum_x) ||
         !MathIsValidNumber(next.regression_sum_y) ||
         !MathIsValidNumber(next.regression_sum_x2) ||
         !MathIsValidNumber(next.regression_sum_xy))
         return false;
   }

   if(next.applicable && !next.adverse_adds_frozen &&
      previous_sign > 0 && current_sign <= 0)
   {
      next.adverse_adds_frozen = true;
      next.latch_m1_time = source_m1_time;
      next.last_observation_reason = "CENTER_SUPPORT_POSITIVE_TO_NONPOSITIVE_LATCHED";
   }
   else
      next.last_observation_reason = next.applicable ?
         "CENTER_SUPPORT_OBSERVED" : "CENTER_MISALIGNED_OBSERVATIONAL_ONLY";
   state = next;
   return true;
}

bool LP_RevmaCenterAuthorizesCandidate(
   const int candidate_type,
   const LP_RevmaCenterSupportState &state,
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
      reason = "SIGNED_CENTER_SUPPORT_ADVERSE_ADDS_FROZEN";
      return false;
   }
   reason = "SIGNED_CENTER_SUPPORT_REMAINS_POSITIVE";
   return true;
}

bool LP_RevmaRecordCenterBlocked(
   const ulong candidate_identity,
   const datetime source_m1_time,
   LP_RevmaCenterSupportState &state
)
{
   if(!state.valid || !state.applicable || !state.adverse_adds_frozen ||
      candidate_identity == 0 || source_m1_time <= 0 ||
      source_m1_time < state.latch_m1_time ||
      state.adverse_adds_blocked_after_latch >= 2147483647 ||
      source_m1_time <= state.last_blocked_candidate_m1 ||
      candidate_identity == state.last_blocked_candidate_identity)
      return false;
   state.adverse_adds_blocked_after_latch++;
   state.last_blocked_candidate_identity = candidate_identity;
   state.last_blocked_candidate_m1 = source_m1_time;
   return true;
}

#endif // __LIMNI_PORTFOLIO_REVMA_CENTER_SUPPORT_POLICY_MQH__
