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
   string reason;
   double net_open_pct;
   double gross_open_money;
   double estimated_close_fee;
   double net_open_money;
};

void LP_ResetPortfolioStopTakeProfitDecision(LP_PortfolioStopTakeProfitDecision &decision)
{
   decision.triggered = false;
   decision.reason = "";
   decision.net_open_pct = 0.0;
   decision.gross_open_money = 0.0;
   decision.estimated_close_fee = 0.0;
   decision.net_open_money = 0.0;
}

class LP_PortfolioStopTakeProfitGuard
{
private:
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

public:
   void Reset()
   {
   }

   bool Evaluate(
      const LP_Config &config,
      const LP_PortfolioState &portfolio,
      LP_PortfolioStopTakeProfitDecision &decision
   )
   {
      LP_ResetPortfolioStopTakeProfitDecision(decision);

      if(config.stop_take_profit_mode != LP_SLTP_MULTI_CURRENCY_PERCENT_AFTER_FEES)
         return false;
      if(config.revma_universe_mode != LP_UNIVERSE_FX28)
         return false;
      if(portfolio.managed_position_count <= 0 || portfolio.balance <= 0.0)
         return false;

      decision.gross_open_money = portfolio.ea_floating_pnl;
      decision.estimated_close_fee = EstimatedManagedCloseFee(config);
      decision.net_open_money = decision.gross_open_money - decision.estimated_close_fee;
      decision.net_open_pct = 100.0 * decision.net_open_money / portfolio.balance;

      if(config.take_profit_value > 0.0 && decision.net_open_pct >= config.take_profit_value)
         decision.reason = "take_profit_percent_after_fees";
      if(decision.reason == "" && config.stop_loss_value > 0.0 && decision.net_open_pct <= -config.stop_loss_value)
         decision.reason = "stop_loss_percent_after_fees";

      decision.triggered = decision.reason != "";
      return decision.triggered;
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
      intent.stop_take_profit_basis = "";
      intent.priority = 100;
      intent.score = decision.net_open_pct;
      intent.grid_key = 0;
      intent.config_hash = config_hash;
      intent.strategy_version_hash = LP_HashString("gate99zzc_stop_take_profit_close_all_pct_after_fees");
      intent.human_reason = "stop_take_profit_scope=multi_currency_percent_after_fees" +
         "|reason=" + decision.reason +
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
