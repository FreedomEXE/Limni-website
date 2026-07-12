/*-----------------------------------------------
  Managed grid inventory
-----------------------------------------------*/
#ifndef __LIMNI_PORTFOLIO_GRID_BOOK_MQH__
#define __LIMNI_PORTFOLIO_GRID_BOOK_MQH__

#include "..\\Core\\Types.mqh"
#include "..\\Core\\SymbolUniverse.mqh"
#include "..\\Execution\\MagicCodec.mqh"
#include "..\\Receipts\\ReceiptWriter.mqh"
#include "PositionCommissionCache.mqh"

struct LP_GridInventoryRow
{
   ulong grid_key;
   int symbol_id;
   int lane_id;
   int variant_id;
   int direction;
   int grid_family;
   string broker_symbol;
   int trade_calc_mode;
   int leg_start;
   int leg_count;
   int position_count;
   double lots;
   double floating_pnl;
   double price_pnl;
   double swap;
   double commission;
   double avg_entry_price;
   double min_entry_price;
   double max_entry_price;
   string tickets;
};

class LP_GridBook
{
private:
   LP_GridInventoryRow m_rows[];
   int m_open_grid_count;
   int m_grid_position_count;
   double m_grid_lots;
   double m_grid_floating_pnl;
   ulong m_snapshot_hash;
   bool m_structure_consistent;
   ulong m_scan_tickets[];
   int m_scan_row_indices[];
   double m_reprice_scratch[];
   int m_leg_row_indices[];
   double m_leg_open_prices[];
   double m_leg_lots[];
   double m_leg_prefix_lots[];
   double m_leg_prefix_open_lots[];
   int m_leg_count;
   int m_leg_capacity;
   ulong m_leg_allocation_failure_count;
   ulong m_leg_index_build_failure_count;
   ulong m_position_profit_read_count;
   ulong m_position_profit_read_failure_count;
   bool m_build_market_reprice_cache;

   void ResetRow(LP_GridInventoryRow &row)
   {
      row.grid_key = 0;
      row.symbol_id = -1;
      row.lane_id = LP_LANE_NONE;
      row.variant_id = LP_VARIANT_NONE;
      row.direction = LP_SIDE_NONE;
      row.grid_family = 0;
      row.broker_symbol = "";
      row.trade_calc_mode = -1;
      row.leg_start = 0;
      row.leg_count = 0;
      row.position_count = 0;
      row.lots = 0.0;
      row.floating_pnl = 0.0;
      row.price_pnl = 0.0;
      row.swap = 0.0;
      row.commission = 0.0;
      row.avg_entry_price = 0.0;
      row.min_entry_price = 0.0;
      row.max_entry_price = 0.0;
      row.tickets = "";
   }

   int FindRow(const ulong grid_key)
   {
      for(int i = 0; i < m_open_grid_count; i++)
      {
         if(m_rows[i].grid_key == grid_key)
            return i;
      }
      return -1;
   }

   void SwapLegs(const int left, const int right)
   {
      if(left == right)
         return;
      double open_price = m_leg_open_prices[left];
      double lots = m_leg_lots[left];
      m_leg_open_prices[left] = m_leg_open_prices[right];
      m_leg_lots[left] = m_leg_lots[right];
      m_leg_open_prices[right] = open_price;
      m_leg_lots[right] = lots;
   }

   void SortLegRange(const int left, const int right)
   {
      int i = left;
      int j = right;
      double pivot = m_leg_open_prices[(left + right) / 2];
      while(i <= j)
      {
         while(m_leg_open_prices[i] < pivot)
            i++;
         while(m_leg_open_prices[j] > pivot)
            j--;
         if(i <= j)
         {
            SwapLegs(i, j);
            i++;
            j--;
         }
      }
      if(left < j)
         SortLegRange(left, j);
      if(i < right)
         SortLegRange(i, right);
   }

   void BuildLegIndex()
   {
      if(m_leg_count != m_grid_position_count)
      {
         m_structure_consistent = false;
         m_leg_index_build_failure_count++;
         return;
      }

      int cursor[];
      if(ArrayResize(cursor, m_open_grid_count) != m_open_grid_count)
      {
         m_structure_consistent = false;
         m_leg_allocation_failure_count++;
         return;
      }
      int next_start = 0;
      for(int row = 0; row < m_open_grid_count; row++)
      {
         cursor[row] = 0;
         m_rows[row].leg_start = next_start;
         m_rows[row].leg_count = m_rows[row].position_count;
         next_start += m_rows[row].position_count;
      }
      if(next_start != m_leg_count)
      {
         m_structure_consistent = false;
         m_leg_index_build_failure_count++;
         return;
      }

      int grouped_rows[];
      double grouped_open_prices[];
      double grouped_lots[];
      if(ArrayResize(grouped_rows, m_leg_count) != m_leg_count ||
         ArrayResize(grouped_open_prices, m_leg_count) != m_leg_count ||
         ArrayResize(grouped_lots, m_leg_count) != m_leg_count)
      {
         m_structure_consistent = false;
         m_leg_allocation_failure_count++;
         return;
      }
      for(int leg = 0; leg < m_leg_count; leg++)
      {
         int row = m_leg_row_indices[leg];
         if(row < 0 || row >= m_open_grid_count)
         {
            m_structure_consistent = false;
            m_leg_index_build_failure_count++;
            return;
         }
         if(cursor[row] >= m_rows[row].position_count)
         {
            m_structure_consistent = false;
            m_leg_index_build_failure_count++;
            return;
         }
         int destination = m_rows[row].leg_start + cursor[row];
         if(destination < 0 || destination >= m_leg_count)
         {
            m_structure_consistent = false;
            m_leg_index_build_failure_count++;
            return;
         }
         cursor[row]++;
         grouped_rows[destination] = row;
         grouped_open_prices[destination] = m_leg_open_prices[leg];
         grouped_lots[destination] = m_leg_lots[leg];
      }

      if(ArrayResize(m_leg_prefix_lots, m_leg_count, m_leg_capacity) != m_leg_count ||
         ArrayResize(m_leg_prefix_open_lots, m_leg_count, m_leg_capacity) != m_leg_count)
      {
         m_structure_consistent = false;
         m_leg_allocation_failure_count++;
         return;
      }
      for(int leg = 0; leg < m_leg_count; leg++)
      {
         m_leg_row_indices[leg] = grouped_rows[leg];
         m_leg_open_prices[leg] = grouped_open_prices[leg];
         m_leg_lots[leg] = grouped_lots[leg];
      }

      for(int row = 0; row < m_open_grid_count; row++)
      {
         if(cursor[row] != m_rows[row].position_count)
         {
            m_structure_consistent = false;
            m_leg_index_build_failure_count++;
            return;
         }
         int start = m_rows[row].leg_start;
         int end = start + m_rows[row].leg_count;
         if(end - start > 1)
            SortLegRange(start, end - 1);
         double cumulative_lots = 0.0;
         double cumulative_open_lots = 0.0;
         for(int leg = start; leg < end; leg++)
         {
            cumulative_lots += m_leg_lots[leg];
            cumulative_open_lots += m_leg_open_prices[leg] * m_leg_lots[leg];
            m_leg_prefix_lots[leg] = cumulative_lots;
            m_leg_prefix_open_lots[leg] = cumulative_open_lots;
         }
      }

      if(ArrayResize(m_reprice_scratch, m_open_grid_count, m_open_grid_count) != m_open_grid_count)
      {
         m_structure_consistent = false;
         m_leg_allocation_failure_count++;
      }
   }

   int LowerBoundOpenPrice(const LP_GridInventoryRow &row, const double price)
   {
      int left = row.leg_start;
      int right = row.leg_start + row.leg_count;
      while(left < right)
      {
         int middle = left + (right - left) / 2;
         if(m_leg_open_prices[middle] < price)
            left = middle + 1;
         else
            right = middle;
      }
      return left;
   }

   int UpperBoundOpenPrice(const LP_GridInventoryRow &row, const double price)
   {
      int left = row.leg_start;
      int right = row.leg_start + row.leg_count;
      while(left < right)
      {
         int middle = left + (right - left) / 2;
         if(m_leg_open_prices[middle] <= price)
            left = middle + 1;
         else
            right = middle;
      }
      return left;
   }

   void LegRangeTotals(
      const LP_GridInventoryRow &row,
      const int begin,
      const int end,
      double &lots,
      double &open_lots
   )
   {
      lots = 0.0;
      open_lots = 0.0;
      if(begin >= end)
         return;
      int last = end - 1;
      lots = m_leg_prefix_lots[last];
      open_lots = m_leg_prefix_open_lots[last];
      if(begin > row.leg_start)
      {
         lots -= m_leg_prefix_lots[begin - 1];
         open_lots -= m_leg_prefix_open_lots[begin - 1];
      }
   }

   bool CalculateLegRangeProfit(
      const LP_GridInventoryRow &row,
      const int begin,
      const int end,
      const double close_price,
      double &profit,
      string &reason
   )
   {
      profit = 0.0;
      if(begin >= end)
         return true;
      double lots = 0.0;
      double open_lots = 0.0;
      LegRangeTotals(row, begin, end, lots, open_lots);
      if(lots <= 0.0 || open_lots <= 0.0)
      {
         reason = "grid_market_reprice_partition_invalid";
         return false;
      }
      double average_open_price = open_lots / lots;
      ENUM_ORDER_TYPE order_type = row.direction > 0 ? ORDER_TYPE_BUY : ORDER_TYPE_SELL;
      ResetLastError();
      if(!OrderCalcProfit(
         order_type,
         row.broker_symbol,
         lots,
         average_open_price,
         close_price,
         profit
      ))
      {
         reason = "grid_market_reprice_order_calc_failed|symbol=" + row.broker_symbol +
            "|error=" + IntegerToString(GetLastError());
         return false;
      }
      if(!MathIsValidNumber(profit))
      {
         reason = "grid_market_reprice_partition_result_invalid|symbol=" +
            row.broker_symbol;
         return false;
      }
      return true;
   }

   bool CalculateRowMarketPricePnl(
      const LP_GridInventoryRow &row,
      double &price_pnl,
      string &reason
   )
   {
      price_pnl = 0.0;
      reason = "";
      if(row.position_count <= 0 || row.lots <= 0.0 || row.avg_entry_price <= 0.0)
      {
         reason = "grid_market_reprice_static_values_invalid";
         return false;
      }
      if(row.leg_count != row.position_count || row.leg_start < 0 ||
         row.leg_start + row.leg_count > m_leg_count)
      {
         reason = "grid_market_reprice_leg_index_invalid";
         return false;
      }
      if(row.broker_symbol == "")
      {
         reason = "grid_market_reprice_symbol_missing";
         return false;
      }
      if(row.trade_calc_mode != SYMBOL_CALC_MODE_FOREX &&
         row.trade_calc_mode != SYMBOL_CALC_MODE_FOREX_NO_LEVERAGE)
      {
         reason = "grid_market_reprice_unsupported_calc_mode|symbol=" +
            row.broker_symbol +
            "|calc_mode=" + IntegerToString(row.trade_calc_mode);
         return false;
      }

      MqlTick tick;
      if(!SymbolInfoTick(row.broker_symbol, tick))
      {
         reason = "grid_market_reprice_tick_unavailable|symbol=" + row.broker_symbol;
         return false;
      }
      double close_price = row.direction > 0 ? tick.bid :
         (row.direction < 0 ? tick.ask : 0.0);
      if(close_price <= 0.0)
      {
         reason = "grid_market_reprice_close_price_invalid|symbol=" + row.broker_symbol;
         return false;
      }

      int lower = LowerBoundOpenPrice(row, close_price);
      int upper = UpperBoundOpenPrice(row, close_price);
      int start = row.leg_start;
      int end = row.leg_start + row.leg_count;
      double lower_profit = 0.0;
      double upper_profit = 0.0;
      string partition_reason = "";
      if(!CalculateLegRangeProfit(
            row,
            start,
            lower,
            close_price,
            lower_profit,
            partition_reason
         ) ||
         !CalculateLegRangeProfit(
            row,
            upper,
            end,
            close_price,
            upper_profit,
            partition_reason
         ))
      {
         reason = partition_reason == "" ?
            "grid_market_reprice_partition_failed" : partition_reason;
         return false;
      }
      price_pnl = lower_profit + upper_profit;
      if(!MathIsValidNumber(price_pnl))
      {
         reason = "grid_market_reprice_result_invalid|symbol=" + row.broker_symbol;
         return false;
      }
      return true;
   }

   bool ReadCachedPositionProfits(string &reason)
   {
      reason = "";
      if(!m_structure_consistent || m_leg_count != m_grid_position_count ||
         PositionsTotal() != m_leg_count ||
         ArraySize(m_reprice_scratch) < m_open_grid_count)
      {
         m_position_profit_read_failure_count++;
         reason = "grid_position_profit_topology_invalid" +
            "|positions_total=" + IntegerToString(PositionsTotal()) +
            "|cached_positions=" + IntegerToString(m_leg_count) +
            "|grid_positions=" + IntegerToString(m_grid_position_count) +
            "|open_grids=" + IntegerToString(m_open_grid_count);
         return false;
      }

      for(int row = 0; row < m_open_grid_count; row++)
         m_reprice_scratch[row] = 0.0;

      for(int position_index = 0; position_index < m_leg_count; position_index++)
      {
         ulong expected_ticket = m_scan_tickets[position_index];
         ulong actual_ticket = PositionGetTicket(position_index);
         if(expected_ticket == 0 || actual_ticket == 0 || actual_ticket != expected_ticket)
         {
            m_position_profit_read_failure_count++;
            reason = "grid_position_profit_order_changed" +
               "|position_index=" + IntegerToString(position_index) +
               "|expected_ticket=" + (string)expected_ticket +
               "|actual_ticket=" + (string)actual_ticket;
            return false;
         }

         int row_index = m_scan_row_indices[position_index];
         if(row_index < 0 || row_index >= m_open_grid_count)
         {
            m_position_profit_read_failure_count++;
            reason = "grid_position_profit_row_index_invalid" +
               "|position_index=" + IntegerToString(position_index) +
               "|row_index=" + IntegerToString(row_index) +
               "|ticket=" + (string)actual_ticket;
            return false;
         }

         double position_profit = PositionGetDouble(POSITION_PROFIT);
         if(!MathIsValidNumber(position_profit))
         {
            m_position_profit_read_failure_count++;
            reason = "grid_position_profit_value_invalid" +
               "|position_index=" + IntegerToString(position_index) +
               "|grid_key=" + (string)m_rows[row_index].grid_key +
               "|ticket=" + (string)actual_ticket;
            return false;
         }
         m_reprice_scratch[row_index] += position_profit;
         m_position_profit_read_count++;
      }
      reason = "grid_position_profit_read_pass";
      return true;
   }

   void BuildCachedPositionIndex()
   {
      if(m_leg_count != m_grid_position_count)
      {
         m_structure_consistent = false;
         m_leg_index_build_failure_count++;
         return;
      }

      int row_position_counts[];
      if(ArrayResize(row_position_counts, m_open_grid_count) != m_open_grid_count ||
         ArrayResize(m_reprice_scratch, m_open_grid_count, m_open_grid_count) != m_open_grid_count)
      {
         m_structure_consistent = false;
         m_leg_allocation_failure_count++;
         return;
      }
      for(int row = 0; row < m_open_grid_count; row++)
         row_position_counts[row] = 0;
      for(int position_index = 0; position_index < m_leg_count; position_index++)
      {
         int row_index = m_scan_row_indices[position_index];
         if(m_scan_tickets[position_index] == 0 || row_index < 0 || row_index >= m_open_grid_count)
         {
            m_structure_consistent = false;
            m_leg_index_build_failure_count++;
            return;
         }
         row_position_counts[row_index]++;
      }
      for(int row = 0; row < m_open_grid_count; row++)
      {
         if(row_position_counts[row] != m_rows[row].position_count)
         {
            m_structure_consistent = false;
            m_leg_index_build_failure_count++;
            return;
         }
      }
   }

public:
   void Reset()
   {
      ArrayResize(m_rows, 0);
      ArrayResize(m_scan_tickets, 0);
      ArrayResize(m_scan_row_indices, 0);
      ArrayResize(m_reprice_scratch, 0);
      ArrayResize(m_leg_row_indices, 0);
      ArrayResize(m_leg_open_prices, 0);
      ArrayResize(m_leg_lots, 0);
      ArrayResize(m_leg_prefix_lots, 0);
      ArrayResize(m_leg_prefix_open_lots, 0);
      m_open_grid_count = 0;
      m_grid_position_count = 0;
      m_grid_lots = 0.0;
      m_grid_floating_pnl = 0.0;
      m_snapshot_hash = 0;
      m_structure_consistent = true;
      m_leg_count = 0;
      m_leg_capacity = 0;
      m_leg_allocation_failure_count = 0;
      m_leg_index_build_failure_count = 0;
      m_position_profit_read_count = 0;
      m_position_profit_read_failure_count = 0;
      m_build_market_reprice_cache = false;
   }

   void BeginRefresh()
   {
      BeginRefresh(false);
   }

   void BeginRefresh(const bool build_market_reprice_cache)
   {
      m_open_grid_count = 0;
      m_grid_position_count = 0;
      m_grid_lots = 0.0;
      m_grid_floating_pnl = 0.0;
      m_structure_consistent = true;
      m_leg_count = 0;
      m_build_market_reprice_cache = build_market_reprice_cache;
   }

   void AccumulateSelectedPosition(
      const LP_MagicParts &parts,
      const ulong ticket,
      const double lots,
      const double open_price,
      const double price_pnl,
      const double swap,
      const double commission
   )
   {
      if(parts.grid_family <= 0)
         return;

      ulong key = LP_BuildGridKeyFromParts(parts);
      int row_index = FindRow(key);
      if(row_index < 0)
      {
         row_index = m_open_grid_count;
         m_open_grid_count++;
         ArrayResize(m_rows, m_open_grid_count, m_open_grid_count);
         ResetRow(m_rows[row_index]);
         m_rows[row_index].grid_key = key;
         m_rows[row_index].symbol_id = parts.symbol_id;
         m_rows[row_index].lane_id = parts.lane_id;
         m_rows[row_index].variant_id = parts.variant_id;
         m_rows[row_index].direction = parts.direction;
         m_rows[row_index].grid_family = parts.grid_family;
      }

      bool valid_leg = true;
      if(m_build_market_reprice_cache)
         valid_leg = ticket > 0 && lots > 0.0 && open_price > 0.0 &&
            MathIsValidNumber(lots) && MathIsValidNumber(open_price);
      if(m_build_market_reprice_cache && !valid_leg)
         m_structure_consistent = false;
      if(m_build_market_reprice_cache && valid_leg && m_leg_count >= m_leg_capacity)
      {
         int requested_capacity = m_leg_capacity <= 0 ? 64 : m_leg_capacity * 2;
         if(ArrayResize(m_scan_tickets, requested_capacity, requested_capacity) != requested_capacity ||
            ArrayResize(m_scan_row_indices, requested_capacity, requested_capacity) != requested_capacity)
         {
            m_structure_consistent = false;
            m_leg_allocation_failure_count++;
         }
         else
            m_leg_capacity = requested_capacity;
      }
      if(m_build_market_reprice_cache && valid_leg && m_leg_count < m_leg_capacity)
      {
         m_scan_tickets[m_leg_count] = ticket;
         m_scan_row_indices[m_leg_count] = row_index;
         m_leg_count++;
      }

      double pnl = price_pnl + swap + commission;
      m_rows[row_index].position_count++;
      double previous_lots = m_rows[row_index].lots;
      m_rows[row_index].lots += lots;
      if(m_rows[row_index].lots > 0.0)
         m_rows[row_index].avg_entry_price = (m_rows[row_index].avg_entry_price * previous_lots + open_price * lots) / m_rows[row_index].lots;
      if(m_rows[row_index].min_entry_price <= 0.0 || open_price < m_rows[row_index].min_entry_price)
         m_rows[row_index].min_entry_price = open_price;
      if(open_price > m_rows[row_index].max_entry_price)
         m_rows[row_index].max_entry_price = open_price;
      string ticket_text = (string)ticket;
      if(m_rows[row_index].tickets == "")
         m_rows[row_index].tickets = ticket_text;
      else
         m_rows[row_index].tickets += ";" + ticket_text;
      m_rows[row_index].floating_pnl += pnl;
      m_rows[row_index].price_pnl += price_pnl;
      m_rows[row_index].swap += swap;
      m_rows[row_index].commission += commission;
      m_grid_position_count++;
      m_grid_lots += lots;
      m_grid_floating_pnl += pnl;
   }

   void EndRefresh()
   {
      if(m_build_market_reprice_cache)
         BuildCachedPositionIndex();
      ulong snapshot_hash = 1469598103934665603;
      for(int row = 0; row < m_open_grid_count; row++)
      {
         LP_HashMixULong(snapshot_hash, m_rows[row].grid_key);
         LP_HashMixInt(snapshot_hash, m_rows[row].position_count);
         LP_HashMixInt(snapshot_hash, (int)MathRound(m_rows[row].lots * 100.0));
      }

      m_snapshot_hash = snapshot_hash;
   }

   void Refresh(LP_PositionCommissionCache &commission_cache)
   {
      BeginRefresh();

      int total = PositionsTotal();
      for(int i = 0; i < total; i++)
      {
         ulong ticket = PositionGetTicket(i);
         if(ticket == 0)
            continue;

         long magic = (long)PositionGetInteger(POSITION_MAGIC);
         LP_MagicParts parts;
         if(!LP_DecodeMagic(magic, parts))
            continue;
         double lots = PositionGetDouble(POSITION_VOLUME);
         double open_price = PositionGetDouble(POSITION_PRICE_OPEN);
         double price_pnl = PositionGetDouble(POSITION_PROFIT);
         double swap = PositionGetDouble(POSITION_SWAP);
         double commission = commission_cache.CommissionForSelectedPosition();
         AccumulateSelectedPosition(parts, ticket, lots, open_price, price_pnl, swap, commission);
      }

      EndRefresh();
   }

   int OpenGridCount()
   {
      return m_open_grid_count;
   }

   ulong SnapshotHash()
   {
      return m_snapshot_hash;
   }

   double GridFloatingPnl()
   {
      return m_grid_floating_pnl;
   }

   int GridPositionCount()
   {
      return m_grid_position_count;
   }

   bool StructureConsistent()
   {
      return m_structure_consistent;
   }

   ulong LegAllocationFailureCount()
   {
      return m_leg_allocation_failure_count;
   }

   ulong LegIndexBuildFailureCount()
   {
      return m_leg_index_build_failure_count;
   }

   ulong PositionProfitReadCount()
   {
      return m_position_profit_read_count;
   }

   ulong PositionProfitReadFailureCount()
   {
      return m_position_profit_read_failure_count;
   }

   bool ValidateMarketReprice(
      const double tolerance,
      double &max_difference,
      string &reason
   )
   {
      max_difference = 0.0;
      reason = "grid_position_profit_validation_pass";
      string read_reason = "";
      if(!ReadCachedPositionProfits(read_reason))
      {
         reason = read_reason;
         return false;
      }
      double exact_total = 0.0;
      double calculated_total = 0.0;
      for(int i = 0; i < m_open_grid_count; i++)
      {
         double calculated_price_pnl = m_reprice_scratch[i];
         double difference = MathAbs(calculated_price_pnl - m_rows[i].price_pnl);
         exact_total += m_rows[i].price_pnl;
         calculated_total += calculated_price_pnl;
         if(difference > max_difference)
            max_difference = difference;
         if(difference > tolerance)
         {
            reason = "grid_position_profit_parity_mismatch|grid_key=" +
               (string)m_rows[i].grid_key +
               "|exact_price_pnl=" + DoubleToString(m_rows[i].price_pnl, 8) +
               "|calculated_price_pnl=" + DoubleToString(calculated_price_pnl, 8) +
               "|difference=" + DoubleToString(difference, 8) +
               "|tolerance=" + DoubleToString(tolerance, 8);
            return false;
         }
      }
      double total_difference = MathAbs(calculated_total - exact_total);
      if(total_difference > max_difference)
         max_difference = total_difference;
      if(total_difference > tolerance)
      {
         reason = "grid_position_profit_account_parity_mismatch" +
            "|exact_price_pnl=" + DoubleToString(exact_total, 8) +
            "|calculated_price_pnl=" + DoubleToString(calculated_total, 8) +
            "|difference=" + DoubleToString(total_difference, 8) +
            "|tolerance=" + DoubleToString(tolerance, 8);
         return false;
      }
      return true;
   }

   bool RepriceFromMarket(string &reason)
   {
      if(!ReadCachedPositionProfits(reason))
         return false;
      double grid_floating_pnl = 0.0;
      for(int i = 0; i < m_open_grid_count; i++)
      {
         double calculated_price_pnl = m_reprice_scratch[i];
         m_rows[i].price_pnl = calculated_price_pnl;
         m_rows[i].floating_pnl = calculated_price_pnl +
            m_rows[i].swap + m_rows[i].commission;
         grid_floating_pnl += m_rows[i].floating_pnl;
      }
      m_grid_floating_pnl = grid_floating_pnl;
      reason = "grid_position_profit_reprice_pass";
      return true;
   }

   bool GetGrid(const int index, LP_GridInventoryRow &row)
   {
      ResetRow(row);
      if(index < 0 || index >= m_open_grid_count)
         return false;
      row = m_rows[index];
      return true;
   }

   string SummaryMessage()
   {
      string message = "open_grids=" + IntegerToString(m_open_grid_count) +
         "|grid_positions=" + IntegerToString(m_grid_position_count) +
         "|grid_lots=" + DoubleToString(m_grid_lots, 2) +
         "|grid_pnl=" + DoubleToString(m_grid_floating_pnl, 2);

      for(int i = 0; i < m_open_grid_count; i++)
      {
         message += "|grid=" + (string)m_rows[i].grid_key +
            ":symbol=" + LP_CanonicalSymbol(m_rows[i].symbol_id) +
            ":lane=" + IntegerToString(m_rows[i].lane_id) +
            ":variant=" + IntegerToString(m_rows[i].variant_id) +
            ":direction=" + IntegerToString(m_rows[i].direction) +
            ":family=" + IntegerToString(m_rows[i].grid_family) +
            ":positions=" + IntegerToString(m_rows[i].position_count) +
            ":lots=" + DoubleToString(m_rows[i].lots, 2) +
            ":avg_entry=" + DoubleToString(m_rows[i].avg_entry_price, 5) +
            ":min_entry=" + DoubleToString(m_rows[i].min_entry_price, 5) +
            ":max_entry=" + DoubleToString(m_rows[i].max_entry_price, 5) +
            ":tickets=" + m_rows[i].tickets +
            ":pnl=" + DoubleToString(m_rows[i].floating_pnl, 2) +
            ":price_pnl=" + DoubleToString(m_rows[i].price_pnl, 2) +
            ":swap=" + DoubleToString(m_rows[i].swap, 2) +
            ":commission=" + DoubleToString(m_rows[i].commission, 2);
      }
      return message;
   }

   bool FindGrid(
      const int symbol_id,
      const int lane_id,
      const int variant_id,
      const int direction,
      LP_GridInventoryRow &row
   )
   {
      ResetRow(row);
      for(int i = 0; i < m_open_grid_count; i++)
      {
         if(m_rows[i].symbol_id == symbol_id &&
            m_rows[i].lane_id == lane_id &&
            m_rows[i].variant_id == variant_id &&
            m_rows[i].direction == direction)
         {
            row = m_rows[i];
            return true;
         }
      }
      return false;
   }

   bool FindGridKey(const ulong grid_key, LP_GridInventoryRow &row)
   {
      ResetRow(row);
      if(grid_key <= 0)
         return false;
      for(int i = 0; i < m_open_grid_count; i++)
      {
         if(m_rows[i].grid_key == grid_key)
         {
            row = m_rows[i];
            return true;
         }
      }
      return false;
   }

   bool HasGridKey(const ulong grid_key)
   {
      if(grid_key <= 0)
         return false;
      for(int i = 0; i < m_open_grid_count; i++)
      {
         if(m_rows[i].grid_key == grid_key)
            return true;
      }
      return false;
   }

   bool HasSymbolLaneGrid(const int symbol_id, const int lane_id, const int variant_id)
   {
      for(int i = 0; i < m_open_grid_count; i++)
      {
         if(m_rows[i].symbol_id == symbol_id &&
            m_rows[i].lane_id == lane_id &&
            m_rows[i].variant_id == variant_id)
            return true;
      }
      return false;
   }

   bool FindSymbolLaneGrid(
      const int symbol_id,
      const int lane_id,
      LP_GridInventoryRow &row
   )
   {
      ResetRow(row);
      for(int i = 0; i < m_open_grid_count; i++)
      {
         if(m_rows[i].symbol_id == symbol_id &&
            m_rows[i].lane_id == lane_id)
         {
            row = m_rows[i];
            return true;
         }
      }
      return false;
   }

   bool HasSymbolAnyLaneGrid(const int symbol_id, const int lane_id)
   {
      for(int i = 0; i < m_open_grid_count; i++)
      {
         if(m_rows[i].symbol_id == symbol_id &&
            m_rows[i].lane_id == lane_id)
            return true;
      }
      return false;
   }

   void WriteReceipt(LP_ReceiptWriter &receipts)
   {
      receipts.Write(
         LP_RECEIPT_GRID_INVENTORY,
         "",
         "snapshot",
         SummaryMessage() + "|snapshot_hash=" + (string)m_snapshot_hash,
         0,
         0,
         0,
         0,
         0,
         0
      );
   }
};

#endif // __LIMNI_PORTFOLIO_GRID_BOOK_MQH__
