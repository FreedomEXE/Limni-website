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
   string reason;
   double net_open_pct;
   double gross_open_money;
   double estimated_close_fee;
   double net_open_money;
   double liquidation_trigger_net_open_pct;
   datetime liquidation_started_at;
};

void LP_ResetPortfolioStopTakeProfitDecision(LP_PortfolioStopTakeProfitDecision &decision)
{
   decision.triggered = false;
   decision.liquidation_active = false;
   decision.newly_triggered = false;
   decision.reason = "";
   decision.net_open_pct = 0.0;
   decision.gross_open_money = 0.0;
   decision.estimated_close_fee = 0.0;
   decision.net_open_money = 0.0;
   decision.liquidation_trigger_net_open_pct = 0.0;
   decision.liquidation_started_at = 0;
}

class LP_PortfolioStopTakeProfitGuard
{
private:
   bool m_liquidation_active;
   string m_liquidation_reason;
   double m_liquidation_trigger_net_open_pct;
   datetime m_liquidation_started_at;
   ulong m_last_monitor_receipt_hash;

   void ClearLiquidation()
   {
      m_liquidation_active = false;
      m_liquidation_reason = "";
      m_liquidation_trigger_net_open_pct = 0.0;
      m_liquidation_started_at = 0;
      m_last_monitor_receipt_hash = 0;
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

   ulong MonitoringHash(
      const LP_Config &config,
      const LP_PortfolioState &portfolio,
      const LP_PortfolioStopTakeProfitDecision &decision
   )
   {
      ulong hash = 1469598103934665603;
      LP_HashMixInt(hash, portfolio.managed_position_count);
      LP_HashMixLong(hash, (long)MathRound(decision.net_open_pct * 10000.0));
      LP_HashMixLong(hash, (long)MathRound(decision.net_open_money * 100.0));
      LP_HashMixLong(hash, (long)MathRound(config.take_profit_value * 10000.0));
      LP_HashMixLong(hash, (long)MathRound(config.stop_loss_value * 10000.0));
      LP_HashMixInt(hash, m_liquidation_active ? 1 : 0);
      return hash;
   }

public:
   void Reset()
   {
      ClearLiquidation();
   }

   bool Evaluate(
      const LP_Config &config,
      const LP_PortfolioState &portfolio,
      LP_PortfolioStopTakeProfitDecision &decision
   )
   {
      LP_ResetPortfolioStopTakeProfitDecision(decision);

      if(config.stop_take_profit_mode != LP_SLTP_MULTI_CURRENCY_PERCENT_AFTER_FEES)
      {
         ClearLiquidation();
         return false;
      }
      if(config.revma_universe_mode != LP_UNIVERSE_FX28)
      {
         ClearLiquidation();
         return false;
      }
      if(portfolio.managed_position_count <= 0)
      {
         ClearLiquidation();
         return false;
      }
      if(portfolio.balance <= 0.0)
         return false;

      decision.gross_open_money = portfolio.ea_floating_pnl;
      decision.estimated_close_fee = EstimatedManagedCloseFee(config);
      decision.net_open_money = decision.gross_open_money - decision.estimated_close_fee;
      decision.net_open_pct = 100.0 * decision.net_open_money / portfolio.balance;

      string trigger_reason = "";
      if(!m_liquidation_active)
      {
         if(config.take_profit_value > 0.0 && decision.net_open_pct >= config.take_profit_value)
            trigger_reason = "take_profit_percent_after_fees";
         if(trigger_reason == "" && config.stop_loss_value > 0.0 && decision.net_open_pct <= -config.stop_loss_value)
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
         decision.reason = m_liquidation_reason;
         decision.triggered = true;
         decision.liquidation_active = true;
         decision.liquidation_trigger_net_open_pct = m_liquidation_trigger_net_open_pct;
         decision.liquidation_started_at = m_liquidation_started_at;
         return true;
      }

      return false;
   }

   void WriteReceipt(
      const LP_Config &config,
      LP_ReceiptWriter &receipts,
      const LP_PortfolioState &portfolio,
      const string status,
      const LP_PortfolioStopTakeProfitDecision &decision
   )
   {
      receipts.Write(
         LP_RECEIPT_STOP_TAKE_PROFIT_GUARD,
         "",
         status,
         "scope=multi_currency_percent_after_fees" +
            "|reason=" + decision.reason +
            "|liquidation_active=" + LP_BoolText(decision.liquidation_active) +
            "|newly_triggered=" + LP_BoolText(decision.newly_triggered) +
            "|liquidation_started_at=" + LP_Stamp(decision.liquidation_started_at) +
            "|liquidation_trigger_net_open_pct=" + DoubleToString(decision.liquidation_trigger_net_open_pct, 6) +
            "|net_open_pct_after_fees=" + DoubleToString(decision.net_open_pct, 6) +
            "|gross_open_money=" + DoubleToString(decision.gross_open_money, 2) +
            "|estimated_close_fee=" + DoubleToString(decision.estimated_close_fee, 2) +
            "|net_open_money_after_fees=" + DoubleToString(decision.net_open_money, 2) +
            "|take_profit_value_pct=" + DoubleToString(config.take_profit_value, 4) +
            "|stop_loss_value_pct=" + DoubleToString(config.stop_loss_value, 4) +
            "|close_commission_per_lot=" + DoubleToString(config.stop_take_profit_close_commission_per_lot, 2) +
            "|managed_positions=" + IntegerToString(portfolio.managed_position_count) +
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

   void WriteMonitoringReceipt(
      const LP_Config &config,
      LP_ReceiptWriter &receipts,
      const LP_PortfolioState &portfolio,
      const LP_PortfolioStopTakeProfitDecision &decision
   )
   {
      if(config.stop_take_profit_mode != LP_SLTP_MULTI_CURRENCY_PERCENT_AFTER_FEES)
         return;
      if(config.revma_universe_mode != LP_UNIVERSE_FX28)
         return;
      if(portfolio.managed_position_count <= 0 || portfolio.balance <= 0.0)
         return;

      ulong monitor_hash = MonitoringHash(config, portfolio, decision);
      if(monitor_hash == m_last_monitor_receipt_hash)
         return;

      m_last_monitor_receipt_hash = monitor_hash;
      WriteReceipt(config, receipts, portfolio, "monitoring", decision);
   }

   void AddCloseIntent(
      const LP_Config &config,
      const ulong config_hash,
      const ulong intent_id,
      const LP_PortfolioState &portfolio,
      const LP_PortfolioStopTakeProfitDecision &decision,
      LP_IntentBus &bus,
      LP_ReceiptWriter &receipts
   )
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
      intent.stop_take_profit_basis = "multi_currency_percent_after_fees";
      intent.priority = 100;
      intent.score = decision.net_open_pct;
      intent.grid_key = 0;
      intent.config_hash = config_hash;
      intent.strategy_version_hash = LP_HashString("gate102_stop_take_profit_close_all_pct_latched");
      intent.human_reason = "stop_take_profit_scope=multi_currency_percent_after_fees" +
         "|reason=" + decision.reason +
         "|liquidation_active=" + LP_BoolText(decision.liquidation_active) +
         "|newly_triggered=" + LP_BoolText(decision.newly_triggered) +
         "|liquidation_started_at=" + LP_Stamp(decision.liquidation_started_at) +
         "|liquidation_trigger_net_open_pct=" + DoubleToString(decision.liquidation_trigger_net_open_pct, 6) +
         "|net_open_pct_after_fees=" + DoubleToString(decision.net_open_pct, 6) +
         "|gross_open_money=" + DoubleToString(decision.gross_open_money, 2) +
         "|estimated_close_fee=" + DoubleToString(decision.estimated_close_fee, 2) +
         "|net_open_money_after_fees=" + DoubleToString(decision.net_open_money, 2) +
         "|take_profit_value_pct=" + DoubleToString(config.take_profit_value, 4) +
         "|stop_loss_value_pct=" + DoubleToString(config.stop_loss_value, 4) +
         "|managed_positions=" + IntegerToString(portfolio.managed_position_count);
      bus.Add(intent);
      WriteReceipt(config, receipts, portfolio, "account_exit_intent", decision);
   }
};

#endif // __LIMNI_PORTFOLIO_STOP_TAKE_PROFIT_GUARD_MQH__
