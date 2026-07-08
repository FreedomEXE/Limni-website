/*-----------------------------------------------
  Managed grid inventory
-----------------------------------------------*/
#ifndef __LIMNI_PORTFOLIO_GRID_BOOK_MQH__
#define __LIMNI_PORTFOLIO_GRID_BOOK_MQH__

#include "..\\Core\\Types.mqh"
#include "..\\Core\\SymbolUniverse.mqh"
#include "..\\Execution\\MagicCodec.mqh"
#include "..\\Receipts\\ReceiptWriter.mqh"

struct LP_GridInventoryRow
{
   ulong grid_key;
   int symbol_id;
   int lane_id;
   int variant_id;
   int direction;
   int grid_family;
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

   void ResetRow(LP_GridInventoryRow &row)
   {
      row.grid_key = 0;
      row.symbol_id = -1;
      row.lane_id = LP_LANE_NONE;
      row.variant_id = LP_VARIANT_NONE;
      row.direction = LP_SIDE_NONE;
      row.grid_family = 0;
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

   double PositionDealCommission()
   {
      long position_id = (long)PositionGetInteger(POSITION_IDENTIFIER);
      if(position_id <= 0)
         return 0.0;
      if(!HistorySelectByPosition(position_id))
         return 0.0;

      double commission = 0.0;
      int deals = HistoryDealsTotal();
      for(int i = 0; i < deals; i++)
      {
         ulong deal = HistoryDealGetTicket(i);
         if(deal == 0)
            continue;
         commission += HistoryDealGetDouble(deal, DEAL_COMMISSION);
      }
      return commission;
   }

public:
   void Reset()
   {
      ArrayResize(m_rows, 0);
      m_open_grid_count = 0;
      m_grid_position_count = 0;
      m_grid_lots = 0.0;
      m_grid_floating_pnl = 0.0;
      m_snapshot_hash = 0;
   }

   void Refresh()
   {
      m_open_grid_count = 0;
      m_grid_position_count = 0;
      m_grid_lots = 0.0;
      m_grid_floating_pnl = 0.0;
      string hash_payload = "";

      int total = PositionsTotal();
      for(int i = 0; i < total; i++)
      {
         ulong ticket = PositionGetTicket(i);
         if(ticket == 0)
            continue;
         if(!PositionSelectByTicket(ticket))
            continue;

         long magic = (long)PositionGetInteger(POSITION_MAGIC);
         LP_MagicParts parts;
         if(!LP_DecodeMagic(magic, parts))
            continue;
         if(parts.grid_family <= 0)
            continue;

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

         double lots = PositionGetDouble(POSITION_VOLUME);
         double open_price = PositionGetDouble(POSITION_PRICE_OPEN);
         double price_pnl = PositionGetDouble(POSITION_PROFIT);
         double swap = PositionGetDouble(POSITION_SWAP);
         double commission = PositionDealCommission();
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
         m_rows[row_index].floating_pnl += pnl;
         m_rows[row_index].price_pnl += price_pnl;
         m_rows[row_index].swap += swap;
         m_rows[row_index].commission += commission;
         if(m_rows[row_index].tickets == "")
            m_rows[row_index].tickets = (string)ticket;
         else if(StringLen(m_rows[row_index].tickets) < 180)
            m_rows[row_index].tickets += ";" + (string)ticket;
         m_grid_position_count++;
         m_grid_lots += lots;
         m_grid_floating_pnl += pnl;
      }

      for(int row = 0; row < m_open_grid_count; row++)
      {
         hash_payload += (string)m_rows[row].grid_key + ":" +
            IntegerToString(m_rows[row].position_count) + ":" +
            DoubleToString(m_rows[row].lots, 2) + "|";
      }

      m_snapshot_hash = LP_HashString(hash_payload);
   }

   int OpenGridCount()
   {
      return m_open_grid_count;
   }

   ulong SnapshotHash()
   {
      return m_snapshot_hash;
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
