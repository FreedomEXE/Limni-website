/*-----------------------------------------------
  Portfolio stop/take-profit guard
-----------------------------------------------*/
#ifndef __LIMNI_PORTFOLIO_STOP_TAKE_PROFIT_GUARD_MQH__
#define __LIMNI_PORTFOLIO_STOP_TAKE_PROFIT_GUARD_MQH__

#include "..\\Core\\Types.mqh"
#include "..\\Core\\Config.mqh"
#include "..\\Execution\\MagicCodec.mqh"
#include "..\\Receipts\\ReceiptWriter.mqh"
#include "PortfolioState.mqh"
#include "..\\Strategies\\IntentBus.mqh"

struct LP_PortfolioStopTakeProfitDecision
{
   bool triggered;
   bool liquidation_active;
   bool newly_triggered;
   bool block_new_entries;
   bool close_required;
   bool hwm_mode;
   bool hwm_cycle_active;
   bool hwm_armed;
   bool hwm_floor_raised;
   bool hwm_cycle_reset_flat;
   string reason;
   double net_open_pct;
   double gross_open_money;
   double estimated_close_fee;
   double net_open_money;
   double liquidation_trigger_net_open_pct;
   datetime liquidation_started_at;
   int hwm_cycle_id;
   double hwm_cycle_hwm_pct;
   double hwm_cycle_floor_pct;
};

void LP_ResetPortfolioStopTakeProfitDecision(LP_PortfolioStopTakeProfitDecision &decision)
{
   decision.triggered = false;
   decision.liquidation_active = false;
   decision.newly_triggered = false;
   decision.block_new_entries = false;
   decision.close_required = false;
   decision.hwm_mode = false;
   decision.hwm_cycle_active = false;
   decision.hwm_armed = false;
   decision.hwm_floor_raised = false;
   decision.hwm_cycle_reset_flat = false;
   decision.reason = "";
   decision.net_open_pct = 0.0;
   decision.gross_open_money = 0.0;
   decision.estimated_close_fee = 0.0;
   decision.net_open_money = 0.0;
   decision.liquidation_trigger_net_open_pct = 0.0;
   decision.liquidation_started_at = 0;
   decision.hwm_cycle_id = 0;
   decision.hwm_cycle_hwm_pct = 0.0;
   decision.hwm_cycle_floor_pct = 0.0;
}

class LP_PortfolioStopTakeProfitGuard
{
private:
   bool m_liquidation_active;
   string m_liquidation_reason;
   double m_liquidation_trigger_net_open_pct;
   datetime m_liquidation_started_at;
   ulong m_last_monitor_receipt_hash;
   int m_hwm_cycle_id;
   bool m_hwm_cycle_active;
   bool m_hwm_armed;
   bool m_hwm_cycle_had_positions;
   double m_hwm_cycle_hwm_pct;
   double m_hwm_cycle_floor_pct;

   void ClearLiquidation()
   {
      m_liquidation_active = false;
      m_liquidation_reason = "";
      m_liquidation_trigger_net_open_pct = 0.0;
      m_liquidation_started_at = 0;
      m_last_monitor_receipt_hash = 0;
   }

   void ClearHwmCycle()
   {
      m_hwm_cycle_active = false;
      m_hwm_armed = false;
      m_hwm_cycle_had_positions = false;
      m_hwm_cycle_hwm_pct = 0.0;
      m_hwm_cycle_floor_pct = 0.0;
   }

   double EstimatedManagedCloseFee(const LP_Config &config)
   {
      double estimated_fee = 0.0;
      if(config.stop_take_profit_close_commission_per_lot <= 0.0)
         return 0.0;

      for(int i = 0; i < PositionsTotal(); i++)
      {
         ulong ticket = PositionGetTicket(i);
         if(ticket == 0)
            continue;
         if(!PositionSelectByTicket(ticket))
            continue;
         long magic = (long)PositionGetInteger(POSITION_MAGIC);
         if(!LP_IsManagedMagic(magic))
            continue;
         double lots = MathAbs(PositionGetDouble(POSITION_VOLUME));
         estimated_fee += lots * config.stop_take_profit_close_commission_per_lot;
      }
      return estimated_fee;
   }

   ulong MonitoringHash(const LP_Config &config, const LP_PortfolioState &portfolio, const LP_PortfolioStopTakeProfitDecision &decision)
   {
      ulong hash = 1469598103934665603;
      LP_HashMixInt(hash, portfolio.managed_position_count);
      LP_HashMixLong(hash, (long)MathRound(decision.net_open_pct * 10000.0));
      LP_HashMixLong(hash, (long)MathRound(decision.net_open_money * 100.0));
      LP_HashMixLong(hash, (long)MathRound(config.account_take_profit_pct * 10000.0));
      LP_HashMixLong(hash, (long)MathRound(config.account_stop_loss_pct * 10000.0));
      LP_HashMixInt(hash, m_liquidation_active ? 1 : 0);
      LP_HashMixInt(hash, m_hwm_armed ? 1 : 0);
      LP_HashMixLong(hash, (long)MathRound(m_hwm_cycle_hwm_pct * 10000.0));
      LP_HashMixLong(hash, (long)MathRound(m_hwm_cycle_floor_pct * 10000.0));
      return hash;
   }

   void FillNetOpenDecision(const LP_Config &config, const LP_PortfolioState &portfolio, LP_PortfolioStopTakeProfitDecision &decision)
   {
      decision.gross_open_money = portfolio.ea_floating_pnl;
      decision.estimated_close_fee = EstimatedManagedCloseFee(config);
      decision.net_open_money = decision.gross_open_money - decision.estimated_close_fee;
      decision.net_open_pct = 100.0 * decision.net_open_money / portfolio.balance;
   }

   void FillLiquidationDecision(LP_PortfolioStopTakeProfitDecision &decision)
   {
      decision.reason = m_liquidation_reason;
      decision.triggered = true;
      decision.liquidation_active = true;
      decision.close_required = true;
      decision.block_new_entries = true;
      decision.liquidation_trigger_net_open_pct = m_liquidation_trigger_net_open_pct;
      decision.liquidation_started_at = m_liquidation_started_at;
   }

   void FillHwmDecisionState(LP_PortfolioStopTakeProfitDecision &decision)
   {
      decision.hwm_mode = true;
      decision.hwm_cycle_id = m_hwm_cycle_id;
      decision.hwm_cycle_active = m_hwm_cycle_active;
      decision.hwm_armed = m_hwm_armed;
      decision.hwm_cycle_hwm_pct = m_hwm_cycle_hwm_pct;
      decision.hwm_cycle_floor_pct = m_hwm_cycle_floor_pct;
   }

public:
   void Reset()
   {
      ClearLiquidation();
      m_hwm_cycle_id = 0;
      ClearHwmCycle();
   }

   bool Evaluate(const LP_Config &config, const LP_PortfolioState &portfolio, LP_PortfolioStopTakeProfitDecision &decision)
   {
      LP_ResetPortfolioStopTakeProfitDecision(decision);
      const bool fixed_percent_mode = config.stop_take_profit_mode == LP_SLTP_MULTI_CURRENCY_PERCENT_AFTER_FEES;
      const bool hwm_mode = config.stop_take_profit_mode == LP_SLTP_MULTI_CURRENCY_HWM_TRAIL_AFTER_FEES;
      if(!fixed_percent_mode && !hwm_mode)
      {
         ClearLiquidation();
         ClearHwmCycle();
         return false;
      }
      if(config.revma_universe_mode != LP_UNIVERSE_FX28)
      {
         ClearLiquidation();
         ClearHwmCycle();
         return false;
      }
      if(portfolio.managed_position_count <= 0)
      {
         if(hwm_mode && m_hwm_cycle_had_positions)
         {
            decision.hwm_mode = true;
            decision.hwm_cycle_reset_flat = true;
            decision.hwm_cycle_id = m_hwm_cycle_id;
            decision.hwm_cycle_hwm_pct = m_hwm_cycle_hwm_pct;
            decision.hwm_cycle_floor_pct = m_hwm_cycle_floor_pct;
            decision.reason = "hwm_cycle_reset_flat";
         }
         ClearLiquidation();
         ClearHwmCycle();
         return false;
      }
      if(portfolio.balance <= 0.0)
         return false;

      FillNetOpenDecision(config, portfolio, decision);
      if(hwm_mode)
      {
         if(!m_hwm_cycle_active)
         {
            m_hwm_cycle_id++;
            m_hwm_cycle_active = true;
            m_hwm_cycle_had_positions = true;
            m_hwm_armed = false;
            m_hwm_cycle_hwm_pct = decision.net_open_pct;
            m_hwm_cycle_floor_pct = 0.0;
            decision.newly_triggered = true;
            decision.reason = "hwm_cycle_started";
         }
         else if(decision.net_open_pct > m_hwm_cycle_hwm_pct)
            m_hwm_cycle_hwm_pct = decision.net_open_pct;

         if(config.hwm_trail_hard_stop_loss_pct > 0.0 && decision.net_open_pct <= -config.hwm_trail_hard_stop_loss_pct)
         {
            m_liquidation_active = true;
            m_liquidation_reason = "hard_stop_loss_breached";
            m_liquidation_trigger_net_open_pct = decision.net_open_pct;
            m_liquidation_started_at = portfolio.asof;
            decision.newly_triggered = true;
         }
         else if(!m_hwm_armed && decision.net_open_pct >= config.hwm_trail_arm_pct)
         {
            m_hwm_armed = true;
            m_hwm_cycle_floor_pct = MathMax(config.hwm_trail_min_lock_pct, m_hwm_cycle_hwm_pct - config.hwm_trail_giveback_pct);
            decision.newly_triggered = true;
            decision.reason = "hwm_armed";
         }
         else if(m_hwm_armed)
         {
            double next_floor = MathMax(m_hwm_cycle_floor_pct, MathMax(config.hwm_trail_min_lock_pct, m_hwm_cycle_hwm_pct - config.hwm_trail_giveback_pct));
            if(next_floor > m_hwm_cycle_floor_pct)
            {
               m_hwm_cycle_floor_pct = next_floor;
               decision.hwm_floor_raised = true;
               decision.reason = "hwm_floor_raised";
            }
         }

         if(!m_liquidation_active && m_hwm_armed && decision.net_open_pct <= m_hwm_cycle_floor_pct)
         {
            m_liquidation_active = true;
            m_liquidation_reason = "hwm_trail_floor_breach";
            m_liquidation_trigger_net_open_pct = decision.net_open_pct;
            m_liquidation_started_at = portfolio.asof;
            decision.newly_triggered = true;
            decision.reason = "hwm_trail_floor_breach";
         }

         FillHwmDecisionState(decision);
         if(m_liquidation_active)
            FillLiquidationDecision(decision);
         else
         {
            decision.block_new_entries = m_hwm_armed && config.hwm_trail_block_new_entries_when_armed;
            decision.close_required = false;
            if(decision.reason == "")
               decision.reason = m_hwm_armed ? "hwm_monitoring_armed" : "hwm_monitoring";
         }
         return decision.block_new_entries;
      }

      string trigger_reason = "";
      if(!m_liquidation_active)
      {
         if(config.account_take_profit_pct > 0.0 && decision.net_open_pct >= config.account_take_profit_pct)
            trigger_reason = "take_profit_percent_after_fees";
         if(trigger_reason == "" && config.account_stop_loss_pct > 0.0 && decision.net_open_pct <= -config.account_stop_loss_pct)
            trigger_reason = "stop_loss_percent_after_fees";
         if(trigger_reason != "")
         {
            m_liquidation_active = true;
            m_liquidation_reason = trigger_reason;
            m_liquidation_trigger_net_open_pct = decision.net_open_pct;
            m_liquidation_started_at = portfolio.asof;
            decision.newly_triggered = true;
            m_last_monitor_receipt_hash = 0;
         }
      }
      if(m_liquidation_active)
      {
         FillLiquidationDecision(decision);
         return true;
      }
      return false;
   }

   void WriteReceipt(const LP_Config &config, LP_ReceiptWriter &receipts, const LP_PortfolioState &portfolio, const string status, const LP_PortfolioStopTakeProfitDecision &decision)
   {
      string scope = decision.hwm_mode ? "multi_currency_hwm_trail_after_fees" : "multi_currency_percent_after_fees";
      receipts.Write(
         LP_RECEIPT_STOP_TAKE_PROFIT_GUARD,
         "",
         status,
         "scope=" + scope +
            "|reason=" + decision.reason +
            "|liquidation_active=" + LP_BoolText(decision.liquidation_active) +
            "|newly_triggered=" + LP_BoolText(decision.newly_triggered) +
            "|block_new_entries=" + LP_BoolText(decision.block_new_entries) +
            "|close_required=" + LP_BoolText(decision.close_required) +
            "|liquidation_started_at=" + LP_Stamp(decision.liquidation_started_at) +
            "|liquidation_trigger_net_open_pct=" + DoubleToString(decision.liquidation_trigger_net_open_pct, 6) +
            "|net_open_pct_after_fees=" + DoubleToString(decision.net_open_pct, 6) +
            "|gross_open_money=" + DoubleToString(decision.gross_open_money, 2) +
            "|estimated_close_fee=" + DoubleToString(decision.estimated_close_fee, 2) +
            "|net_open_money_after_fees=" + DoubleToString(decision.net_open_money, 2) +
            "|account_take_profit_pct=" + DoubleToString(config.account_take_profit_pct, 4) +
            "|account_stop_loss_pct=" + DoubleToString(config.account_stop_loss_pct, 4) +
            "|hwm_cycle_id=" + IntegerToString(decision.hwm_cycle_id) +
            "|hwm_cycle_active=" + LP_BoolText(decision.hwm_cycle_active) +
            "|hwm_armed=" + LP_BoolText(decision.hwm_armed) +
            "|hwm_cycle_hwm_pct=" + DoubleToString(decision.hwm_cycle_hwm_pct, 6) +
            "|hwm_cycle_floor_pct=" + DoubleToString(decision.hwm_cycle_floor_pct, 6) +
            "|hwm_arm_pct=" + DoubleToString(config.hwm_trail_arm_pct, 4) +
            "|hwm_min_lock_pct=" + DoubleToString(config.hwm_trail_min_lock_pct, 4) +
            "|hwm_giveback_pct=" + DoubleToString(config.hwm_trail_giveback_pct, 4) +
            "|hwm_hard_stop_loss_pct=" + DoubleToString(config.hwm_trail_hard_stop_loss_pct, 4) +
            "|close_commission_per_lot=" + DoubleToString(config.stop_take_profit_close_commission_per_lot, 2) +
            "|managed_positions=" + IntegerToString(portfolio.managed_position_count) +
            "|open_grids=" + IntegerToString(portfolio.open_grid_count) +
            "|managed_floating_pnl=" + DoubleToString(portfolio.ea_floating_pnl, 2) +
            "|balance=" + DoubleToString(portfolio.balance, 2),
         LP_LANE_NONE,
         LP_VARIANT_NONE,
         0,
         0,
         0,
         0
      );
   }

   void WriteMonitoringReceipt(const LP_Config &config, LP_ReceiptWriter &receipts, const LP_PortfolioState &portfolio, const LP_PortfolioStopTakeProfitDecision &decision)
   {
      if(config.stop_take_profit_mode != LP_SLTP_MULTI_CURRENCY_PERCENT_AFTER_FEES &&
         config.stop_take_profit_mode != LP_SLTP_MULTI_CURRENCY_HWM_TRAIL_AFTER_FEES)
         return;
      if(config.revma_universe_mode != LP_UNIVERSE_FX28)
         return;
      if(portfolio.managed_position_count <= 0 || portfolio.balance <= 0.0)
         return;
      ulong monitor_hash = MonitoringHash(config, portfolio, decision);
      if(monitor_hash == m_last_monitor_receipt_hash)
         return;
      m_last_monitor_receipt_hash = monitor_hash;
      WriteReceipt(config, receipts, portfolio, decision.hwm_mode ? "hwm_monitoring" : "monitoring", decision);
   }

   void AddCloseIntent(const LP_Config &config, const ulong config_hash, const ulong intent_id, const LP_PortfolioState &portfolio, const LP_PortfolioStopTakeProfitDecision &decision, LP_IntentBus &bus, LP_ReceiptWriter &receipts)
   {
      LP_TradeIntent intent;
      intent.intent_id = intent_id;
      intent.symbol_id = -1;
      intent.symbol = "";
      intent.lane_id = LP_LANE_NONE;
      intent.variant_id = LP_VARIANT_NONE;
      intent.action = LP_INTENT_CLOSE_ALL_EA;
      intent.direction = LP_SIDE_NONE;
      intent.emitted_at = TimeCurrent();
      intent.source_bar_time = portfolio.asof;
      intent.expires_at = 0;
      intent.requested_lots = 0.0;
      intent.max_slippage_points = 10.0;
      intent.take_profit_distance_price = 0.0;
      intent.stop_loss_distance_price = 0.0;
      intent.target_take_profit_price = 0.0;
      intent.target_stop_loss_price = 0.0;
      intent.stop_take_profit_basis = decision.hwm_mode ? "multi_currency_hwm_trail_after_fees" : "multi_currency_percent_after_fees";
      intent.priority = 100;
      intent.score = decision.net_open_pct;
      intent.grid_key = 0;
      intent.grid_tickets = "";
      intent.expected_grid_ticket_count = 0;
      intent.research_lifecycle_event = LP_RESEARCH_LIFECYCLE_NONE;
      intent.research_add_type = "";
      intent.close_reason = decision.hwm_mode ? "account_hwm" : "account_tp";
      intent.config_hash = config_hash;
      intent.strategy_version_hash = decision.hwm_mode ? LP_HashString("gate105_hwm_trail_after_fees") : LP_HashString("gate102_stop_take_profit_close_all_pct_latched");
      intent.human_reason = "stop_take_profit_scope=" + intent.stop_take_profit_basis +
         "|reason=" + decision.reason +
         "|liquidation_active=" + LP_BoolText(decision.liquidation_active) +
         "|newly_triggered=" + LP_BoolText(decision.newly_triggered) +
         "|block_new_entries=" + LP_BoolText(decision.block_new_entries) +
         "|close_required=" + LP_BoolText(decision.close_required) +
         "|liquidation_started_at=" + LP_Stamp(decision.liquidation_started_at) +
         "|liquidation_trigger_net_open_pct=" + DoubleToString(decision.liquidation_trigger_net_open_pct, 6) +
         "|net_open_pct_after_fees=" + DoubleToString(decision.net_open_pct, 6) +
         "|gross_open_money=" + DoubleToString(decision.gross_open_money, 2) +
         "|estimated_close_fee=" + DoubleToString(decision.estimated_close_fee, 2) +
         "|net_open_money_after_fees=" + DoubleToString(decision.net_open_money, 2) +
         "|hwm_cycle_id=" + IntegerToString(decision.hwm_cycle_id) +
         "|hwm_cycle_hwm_pct=" + DoubleToString(decision.hwm_cycle_hwm_pct, 6) +
         "|hwm_cycle_floor_pct=" + DoubleToString(decision.hwm_cycle_floor_pct, 6) +
         "|managed_positions=" + IntegerToString(portfolio.managed_position_count);
      bus.Add(intent);
      WriteReceipt(config, receipts, portfolio, "account_exit_intent", decision);
   }
};

#endif // __LIMNI_PORTFOLIO_STOP_TAKE_PROFIT_GUARD_MQH__
