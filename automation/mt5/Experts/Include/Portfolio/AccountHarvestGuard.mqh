/*-----------------------------------------------
  Account-level high-watermark harvest governor
-----------------------------------------------*/
#ifndef __LIMNI_PORTFOLIO_ACCOUNT_HARVEST_GUARD_MQH__
#define __LIMNI_PORTFOLIO_ACCOUNT_HARVEST_GUARD_MQH__

#include "..\\Core\\Types.mqh"

class LP_AccountHarvestGuard
{
private:
   bool m_enabled;
   bool m_config_valid;
   double m_target_money;
   double m_trail_money;
   bool m_soft_lock_on_breach;
   bool m_grid_winddown_on_breach;
   bool m_arm_emergency_liquidation;
   bool m_evaluated;
   int m_state;
   double m_high_watermark_money;
   double m_trail_floor_money;

   bool BreachState(const int state)
   {
      return state == LP_HARVEST_SOFT_LOCK_ACTIVE ||
         state == LP_HARVEST_GRID_WINDDOWN_ACTIVE ||
         state == LP_HARVEST_EMERGENCY_LIQUIDATION_ARMED;
   }

public:
   void Reset()
   {
      m_enabled = false;
      m_config_valid = false;
      m_target_money = 0.0;
      m_trail_money = 0.0;
      m_soft_lock_on_breach = true;
      m_grid_winddown_on_breach = true;
      m_arm_emergency_liquidation = false;
      m_evaluated = false;
      m_state = LP_HARVEST_DISABLED;
      m_high_watermark_money = 0.0;
      m_trail_floor_money = 0.0;
   }

   void Configure(const LP_Config &config)
   {
      m_enabled = config.enable_portfolio_harvest_governor;
      m_target_money = config.harvest_initial_target_money;
      m_trail_money = config.harvest_trail_money;
      m_soft_lock_on_breach = config.harvest_soft_lock_on_breach;
      m_grid_winddown_on_breach = config.harvest_grid_winddown_on_breach;
      m_arm_emergency_liquidation = config.harvest_arm_emergency_liquidation;
      m_config_valid = !m_enabled || (m_target_money > 0.0 && m_trail_money > 0.0);
      m_evaluated = false;
      m_state = LP_HARVEST_DISABLED;
      m_high_watermark_money = 0.0;
      m_trail_floor_money = 0.0;
   }

   void Evaluate(const LP_PortfolioState &state, LP_HarvestDecision &decision)
   {
      LP_ResetHarvestDecision(decision);
      decision.asof = state.asof;
      decision.previous_state = m_state;
      decision.enabled = m_enabled;
      decision.config_valid = m_config_valid;
      decision.target_money = m_target_money;
      decision.trail_money = m_trail_money;
      decision.managed_floating_pnl = state.ea_floating_pnl;
      decision.entry_group_floating_pnl = state.entry_group_floating_pnl;
      decision.grid_group_floating_pnl = state.grid_group_floating_pnl;
      decision.managed_position_count = state.managed_position_count;
      decision.entry_group_position_count = state.entry_group_position_count;
      decision.grid_group_position_count = state.grid_group_position_count;

      int next_state = m_state;
      string reason = "tracking_high_watermark";

      if(!m_enabled)
      {
         next_state = LP_HARVEST_DISABLED;
         reason = "harvest_governor_disabled";
         m_high_watermark_money = 0.0;
         m_trail_floor_money = 0.0;
      }
      else if(!m_config_valid)
      {
         next_state = LP_HARVEST_CONFIG_INVALID;
         reason = "invalid_harvest_config_target_or_trail";
         m_high_watermark_money = 0.0;
         m_trail_floor_money = 0.0;
      }
      else
      {
         if(!m_evaluated || m_state == LP_HARVEST_DISABLED || m_state == LP_HARVEST_CONFIG_INVALID)
         {
            next_state = LP_HARVEST_ARMED_INITIAL_TARGET;
            reason = "waiting_for_initial_target";
            m_high_watermark_money = state.ea_floating_pnl;
            m_trail_floor_money = m_high_watermark_money - m_trail_money;
         }

         if(!BreachState(next_state))
         {
            if(state.ea_floating_pnl >= m_target_money)
            {
               next_state = LP_HARVEST_HWM_ACTIVE;
               reason = "initial_target_reached_or_hwm_tracking";
               if(state.ea_floating_pnl > m_high_watermark_money)
                  m_high_watermark_money = state.ea_floating_pnl;
               m_trail_floor_money = m_high_watermark_money - m_trail_money;
            }
            else
            {
               next_state = LP_HARVEST_ARMED_INITIAL_TARGET;
               reason = "waiting_for_initial_target";
            }
         }

         if(next_state == LP_HARVEST_HWM_ACTIVE)
         {
            if(state.ea_floating_pnl > m_high_watermark_money)
            {
               m_high_watermark_money = state.ea_floating_pnl;
               m_trail_floor_money = m_high_watermark_money - m_trail_money;
            }

            if(state.ea_floating_pnl <= m_trail_floor_money)
            {
               bool winddown = m_grid_winddown_on_breach && state.grid_group_position_count > 0;
               bool emergency = m_arm_emergency_liquidation;
               bool soft_lock = m_soft_lock_on_breach || winddown || emergency;

               if(emergency)
               {
                  next_state = LP_HARVEST_EMERGENCY_LIQUIDATION_ARMED;
                  reason = "trail_floor_breached_emergency_liquidation_armed";
               }
               else if(winddown)
               {
                  next_state = LP_HARVEST_GRID_WINDDOWN_ACTIVE;
                  reason = "trail_floor_breached_grid_winddown";
               }
               else if(soft_lock)
               {
                  next_state = LP_HARVEST_SOFT_LOCK_ACTIVE;
                  reason = "trail_floor_breached_soft_lock";
               }
            }
         }
         else if(BreachState(next_state))
         {
            reason = "harvest_breach_state_latched";
         }
      }

      decision.state = next_state;
      decision.high_watermark_money = m_high_watermark_money;
      decision.trail_floor_money = m_trail_floor_money;
      decision.soft_lock_active = next_state == LP_HARVEST_SOFT_LOCK_ACTIVE ||
         next_state == LP_HARVEST_GRID_WINDDOWN_ACTIVE ||
         next_state == LP_HARVEST_EMERGENCY_LIQUIDATION_ARMED;
      decision.grid_winddown_active = next_state == LP_HARVEST_GRID_WINDDOWN_ACTIVE ||
         next_state == LP_HARVEST_EMERGENCY_LIQUIDATION_ARMED;
      decision.emergency_liquidation_armed = next_state == LP_HARVEST_EMERGENCY_LIQUIDATION_ARMED;
      decision.block_new_entries = decision.soft_lock_active || next_state == LP_HARVEST_CONFIG_INVALID;
      decision.reason = reason;
      decision.receipt_required = !m_evaluated || next_state != m_state;

      m_state = next_state;
      m_evaluated = true;
   }

   bool RequiresAccountClose(const LP_PortfolioState &state, string &reason)
   {
      reason = "account_close_execution_disabled_gate99s";
      return false;
   }
};

#endif // __LIMNI_PORTFOLIO_ACCOUNT_HARVEST_GUARD_MQH__
