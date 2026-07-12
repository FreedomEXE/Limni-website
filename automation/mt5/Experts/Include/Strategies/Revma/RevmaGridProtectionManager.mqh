/*-----------------------------------------------
  Revma broker-visible grid protection sync
-----------------------------------------------*/
#ifndef __LIMNI_PORTFOLIO_REVMA_GRID_PROTECTION_MANAGER_MQH__
#define __LIMNI_PORTFOLIO_REVMA_GRID_PROTECTION_MANAGER_MQH__

#include "..\\..\\Core\\Types.mqh"
#include "..\\..\\Core\\Config.mqh"
#include "..\\..\\Portfolio\\GridBook.mqh"
#include "..\\..\\Receipts\\ReceiptWriter.mqh"
#include "..\\IntentBus.mqh"
#include "RevmaTypes.mqh"

class LP_RevmaGridProtectionManager
{
private:
   ulong m_ticket_scan_count;

   string PriceText(const double value, const int digits)
   {
      if(value <= 0.0 || !MathIsValidNumber(value))
         return "0";
      return DoubleToString(value, digits);
   }

   double ObservedOpenCommissionFeeMoney(const LP_GridInventoryRow &grid)
   {
      if(grid.commission >= 0.0)
         return 0.0;
      return MathAbs(grid.commission);
   }

   double ConfiguredCloseFeeMoney(const LP_GridInventoryRow &grid, const LP_Config &config)
   {
      if(config.stop_take_profit_close_commission_per_lot <= 0.0)
         return 0.0;
      return MathAbs(grid.lots) * config.stop_take_profit_close_commission_per_lot;
   }

   double GridCloseFeeMoney(
      const LP_GridInventoryRow &grid,
      const LP_Config &config,
      string &fee_source
   )
   {
      double configured_fee = ConfiguredCloseFeeMoney(grid, config);
      double observed_open_fee = ObservedOpenCommissionFeeMoney(grid);
      if(configured_fee > 0.0 && configured_fee >= observed_open_fee)
      {
         fee_source = "configured_per_lot";
         return configured_fee;
      }
      if(observed_open_fee > 0.0)
      {
         fee_source = "observed_open_commission";
         return observed_open_fee;
      }
      if(configured_fee > 0.0)
      {
         fee_source = "configured_per_lot";
         return configured_fee;
      }
      fee_source = "zero";
      return 0.0;
   }

   bool TakeProfitAlreadySynced(
      const string symbol,
      const double current_take_profit,
      const double target_take_profit
   )
   {
      if(current_take_profit <= 0.0 || target_take_profit <= 0.0)
         return false;
      double point = SymbolInfoDouble(symbol, SYMBOL_POINT);
      double tolerance = point > 0.0 ? point * 0.5 : 0.00000001;
      return MathAbs(current_take_profit - target_take_profit) <= tolerance;
   }

   bool PositionDirectionMatchesGrid(const long position_type, const int direction)
   {
      if(direction > 0)
         return position_type == POSITION_TYPE_BUY;
      if(direction < 0)
         return position_type == POSITION_TYPE_SELL;
      return false;
   }

   bool GridTakeProfitNeedsSync(
      const string symbol,
      const LP_GridInventoryRow &grid,
      const double target_take_profit_price,
      int &matched,
      int &unsynced
   )
   {
      matched = 0;
      unsynced = 0;
      if(target_take_profit_price <= 0.0)
         return false;

      ulong tickets[];
      int ticket_count = LP_ParseTicketList(grid.tickets, tickets);
      if(ticket_count <= 0)
         return false;

      long grid_magic = LP_BuildMagic(
         grid.symbol_id,
         grid.lane_id,
         grid.variant_id,
         grid.direction,
         grid.grid_family
      );

      for(int i = 0; i < ticket_count; i++)
      {
         ulong ticket = tickets[i];
         m_ticket_scan_count++;
         if(ticket == 0)
            continue;
         if(!PositionSelectByTicket(ticket))
            continue;
         if(PositionGetString(POSITION_SYMBOL) != symbol)
            continue;
         if((long)PositionGetInteger(POSITION_MAGIC) != grid_magic)
            continue;
         if(!PositionDirectionMatchesGrid((long)PositionGetInteger(POSITION_TYPE), grid.direction))
            continue;

         matched++;
         double current_take_profit = PositionGetDouble(POSITION_TP);
         if(!TakeProfitAlreadySynced(symbol, current_take_profit, target_take_profit_price))
            unsynced++;
      }
      return matched > 0 && unsynced > 0;
   }

   bool MoneyPerPriceDistance(
      const string symbol,
      const double lots,
      double &money_per_price,
      string &note
   )
   {
      money_per_price = 0.0;
      note = "";
      double tick_value = SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_VALUE);
      double tick_size = SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_SIZE);
      double abs_lots = MathAbs(lots);
      if(abs_lots <= 0.0)
      {
         note = "lots_invalid";
         return false;
      }
      if(tick_value <= 0.0 || tick_size <= 0.0)
      {
         note = "tick_value_or_size_unavailable";
         return false;
      }

      money_per_price = (tick_value / tick_size) * abs_lots;
      if(money_per_price <= 0.0 || !MathIsValidNumber(money_per_price))
      {
         note = "money_per_price_invalid";
         return false;
      }
      return true;
   }

   bool BuildTakeProfitTarget(
      const string symbol,
      const LP_GridInventoryRow &grid,
      const LP_Config &config,
      const double q_basis,
      const int grid_sleeve,
      double &target_take_profit_price,
      double &money_per_price,
      double &grid_take_profit_q,
      double &take_profit_money,
      double &estimated_close_fee,
      string &estimated_close_fee_source,
      double &required_gross_money,
      string &note
   )
   {
      target_take_profit_price = 0.0;
      money_per_price = 0.0;
      grid_take_profit_q = 0.0;
      take_profit_money = 0.0;
      estimated_close_fee = 0.0;
      estimated_close_fee_source = "";
      required_gross_money = 0.0;
      note = "";

      grid_take_profit_q = LP_RevmaTakeProfitQForSleeve(config, grid_sleeve);
      if(grid_take_profit_q <= 0.0)
      {
         note = "take_profit_disabled";
         return false;
      }
      if(grid.lane_id != LP_LANE_REVMA || grid.position_count <= 0 || grid.lots <= 0.0)
      {
         note = "grid_not_active_revma";
         return false;
      }
      if(q_basis <= 0.0)
      {
         note = "q_basis_missing";
         return false;
      }
      if(grid.avg_entry_price <= 0.0)
      {
         note = "avg_entry_missing";
         return false;
      }
      if(!MoneyPerPriceDistance(symbol, grid.lots, money_per_price, note))
         return false;

      int digits = 5;
      if(SymbolInfoInteger(symbol, SYMBOL_EXIST))
         digits = (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);

      take_profit_money = q_basis * grid_take_profit_q * money_per_price;
      estimated_close_fee = GridCloseFeeMoney(grid, config, estimated_close_fee_source);
      required_gross_money = take_profit_money + estimated_close_fee - grid.swap - grid.commission;
      double price_distance = required_gross_money / money_per_price;
      if(price_distance <= 0.0 || !MathIsValidNumber(price_distance))
      {
         note = "price_distance_invalid";
         return false;
      }

      if(grid.direction > 0)
         target_take_profit_price = NormalizeDouble(grid.avg_entry_price + price_distance, digits);
      else if(grid.direction < 0)
         target_take_profit_price = NormalizeDouble(grid.avg_entry_price - price_distance, digits);
      else
      {
         note = "grid_direction_invalid";
         return false;
      }

      if(target_take_profit_price <= 0.0 || !MathIsValidNumber(target_take_profit_price))
      {
         note = "target_take_profit_invalid";
         return false;
      }

      return true;
   }

public:
   void Reset()
   {
      m_ticket_scan_count = 0;
   }

   ulong TicketScanCount()
   {
      return m_ticket_scan_count;
   }

   bool QueueGridTakeProfitSync(
      const string symbol,
      const LP_GridInventoryRow &grid,
      const LP_Config &config,
      const double q_basis,
      const int grid_sleeve,
      const string birth_metadata,
      const ulong intent_id,
      const ulong config_hash,
      LP_ReceiptWriter &receipts,
      LP_IntentBus &bus
   )
   {
      double target_take_profit_price = 0.0;
      double money_per_price = 0.0;
      double grid_take_profit_q = 0.0;
      double take_profit_money = 0.0;
      double estimated_close_fee = 0.0;
      string estimated_close_fee_source = "";
      double required_gross_money = 0.0;
      string note = "";
      if(!BuildTakeProfitTarget(
         symbol,
         grid,
         config,
         q_basis,
         grid_sleeve,
         target_take_profit_price,
         money_per_price,
         grid_take_profit_q,
         take_profit_money,
         estimated_close_fee,
         estimated_close_fee_source,
         required_gross_money,
         note
      ))
      {
         if(note != "take_profit_disabled" &&
            note != "grid_not_active_revma")
         {
            receipts.Write(
               LP_RECEIPT_REVMA_GRID_EXIT,
               symbol,
               "broker_tp_sync_unavailable",
               "scope=single_pair_grid_broker_tp|reason=" + note +
                  "|grid_key=" + (string)grid.grid_key +
                  "|grid_positions=" + IntegerToString(grid.position_count) +
                  "|grid_lots=" + DoubleToString(grid.lots, 2) +
                  birth_metadata,
               LP_LANE_REVMA,
               grid.variant_id,
               grid.grid_key,
               0,
               0,
               0
            );
         }
         return false;
      }

      int digits = 5;
      if(SymbolInfoInteger(symbol, SYMBOL_EXIST))
         digits = (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);

      if(!LP_BrokerGridTpSyncEnabledForRuntime(config.broker_grid_tp_sync_mode))
         return false;

      int matched = 0;
      int unsynced = 0;
      if(!GridTakeProfitNeedsSync(symbol, grid, target_take_profit_price, matched, unsynced))
         return false;

      string metadata = "scope=single_pair_grid_broker_tp" +
         "|reason=sync_grid_take_profit" +
         "|broker_grid_tp_sync_mode=" + LP_BrokerGridTpSyncModeName(config.broker_grid_tp_sync_mode) +
         "|symbol=" + symbol +
         "|grid_key=" + (string)grid.grid_key +
         "|grid_variant_id=" + IntegerToString(grid.variant_id) +
         "|grid_sleeve=" + LP_RevmaSleeveName(grid_sleeve) +
         "|grid_direction=" + LP_RevmaDirectionName(grid.direction) +
         "|grid_family=" + IntegerToString(grid.grid_family) +
         "|grid_positions=" + IntegerToString(grid.position_count) +
         "|grid_tickets_expected=" + IntegerToString(grid.position_count) +
         "|grid_tickets_matched=" + IntegerToString(matched) +
         "|grid_tickets_unsynced=" + IntegerToString(unsynced) +
         "|grid_lots=" + DoubleToString(grid.lots, 2) +
         "|grid_tickets=" + grid.tickets +
         "|avg_entry=" + PriceText(grid.avg_entry_price, digits) +
         "|q_basis=" + DoubleToString(q_basis, 8) +
         "|grid_take_profit_q=" + DoubleToString(grid_take_profit_q, 4) +
         "|money_per_price=" + DoubleToString(money_per_price, 2) +
         "|current_price_pnl=" + DoubleToString(grid.price_pnl, 2) +
         "|current_swap=" + DoubleToString(grid.swap, 2) +
         "|current_commission=" + DoubleToString(grid.commission, 2) +
         "|current_net_floating_pnl=" + DoubleToString(grid.floating_pnl, 2) +
         "|take_profit_target_money_after_fees=" + DoubleToString(take_profit_money, 2) +
         "|estimated_close_fee=" + DoubleToString(estimated_close_fee, 2) +
         "|estimated_close_fee_source=" + estimated_close_fee_source +
         "|observed_open_commission_fee=" + DoubleToString(ObservedOpenCommissionFeeMoney(grid), 2) +
         "|required_gross_money=" + DoubleToString(required_gross_money, 2) +
         "|target_take_profit_price=" + PriceText(target_take_profit_price, digits) +
         "|close_commission_per_lot=" + DoubleToString(config.stop_take_profit_close_commission_per_lot, 2) +
         birth_metadata;

      LP_TradeIntent intent;
      LP_ResetTradeIntent(intent);
      intent.intent_id = intent_id;
      intent.symbol_id = grid.symbol_id;
      intent.symbol = symbol;
      intent.lane_id = LP_LANE_REVMA;
      intent.variant_id = grid.variant_id;
      intent.action = LP_INTENT_SYNC_GRID_TP;
      intent.direction = grid.direction;
      intent.emitted_at = TimeCurrent();
      intent.source_bar_time = TimeCurrent();
      intent.expires_at = 0;
      intent.requested_lots = 0.0;
      intent.max_slippage_points = 10.0;
      intent.take_profit_distance_price = 0.0;
      intent.stop_loss_distance_price = 0.0;
      intent.target_take_profit_price = target_take_profit_price;
      intent.target_stop_loss_price = 0.0;
      intent.stop_take_profit_basis = "single_pair_grid_broker_tp";
      intent.priority = 90;
      intent.score = target_take_profit_price;
      intent.grid_key = grid.grid_key;
      intent.grid_tickets = grid.tickets;
      intent.expected_grid_ticket_count = grid.position_count;
      intent.research_lifecycle_event = LP_RESEARCH_LIFECYCLE_NONE;
      intent.research_add_type = "";
      intent.close_reason = "";
      intent.config_hash = config_hash;
      intent.strategy_version_hash = LP_HashString("gate99zzg_revma_grid_broker_tp_sync");
      intent.human_reason = "revma_grid_broker_tp_sync|" + metadata;
      if(!bus.Add(intent))
      {
         receipts.Write(LP_RECEIPT_ERROR, symbol,
            "intent_bus_allocation_failed",
            "action=broker_tp_sync|grid_key=" + (string)grid.grid_key,
            LP_LANE_REVMA, grid.variant_id, grid.grid_key,
            intent.intent_id, 0, 0);
         return false;
      }

      receipts.Write(
         LP_RECEIPT_REVMA_GRID_EXIT,
         symbol,
         "broker_tp_sync_intent",
         metadata,
         LP_LANE_REVMA,
         grid.variant_id,
         grid.grid_key,
         intent.intent_id,
         0,
         0
      );
      return true;
   }
};

#endif // __LIMNI_PORTFOLIO_REVMA_GRID_PROTECTION_MANAGER_MQH__
