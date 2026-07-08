/*-----------------------------------------------
  Managed position index and recovery state
-----------------------------------------------*/
#ifndef __LIMNI_PORTFOLIO_POSITION_INDEX_MQH__
#define __LIMNI_PORTFOLIO_POSITION_INDEX_MQH__

#include "..\\Core\\Types.mqh"
#include "..\\Execution\\MagicCodec.mqh"

class LP_PositionIndex
{
private:
   bool m_dirty;
   int m_total_positions;
   int m_managed_positions;
   int m_entry_group_positions;
   int m_grid_group_positions;
   int m_external_positions;
   int m_unknown_managed_positions;
   double m_managed_floating_pnl;
   double m_entry_group_floating_pnl;
   double m_grid_group_floating_pnl;
   double m_external_floating_pnl;
   ulong m_snapshot_hash;
   int m_recovery_state;

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
      m_dirty = true;
      m_total_positions = 0;
      m_managed_positions = 0;
      m_entry_group_positions = 0;
      m_grid_group_positions = 0;
      m_external_positions = 0;
      m_unknown_managed_positions = 0;
      m_managed_floating_pnl = 0.0;
      m_entry_group_floating_pnl = 0.0;
      m_grid_group_floating_pnl = 0.0;
      m_external_floating_pnl = 0.0;
      m_snapshot_hash = 0;
      m_recovery_state = LP_RECOVERY_OK;
   }

   void MarkDirty()
   {
      m_dirty = true;
   }

   void Refresh()
   {
      m_total_positions = PositionsTotal();
      m_managed_positions = 0;
      m_entry_group_positions = 0;
      m_grid_group_positions = 0;
      m_external_positions = 0;
      m_unknown_managed_positions = 0;
      m_managed_floating_pnl = 0.0;
      m_entry_group_floating_pnl = 0.0;
      m_grid_group_floating_pnl = 0.0;
      m_external_floating_pnl = 0.0;
      string hash_payload = "";

      for(int i = 0; i < m_total_positions; i++)
      {
         ulong ticket = PositionGetTicket(i);
         if(ticket == 0)
            continue;
         if(!PositionSelectByTicket(ticket))
            continue;

         long magic = (long)PositionGetInteger(POSITION_MAGIC);
         string symbol = PositionGetString(POSITION_SYMBOL);
         double profit = PositionGetDouble(POSITION_PROFIT) +
            PositionGetDouble(POSITION_SWAP) +
            PositionDealCommission();
         int group = LP_POSITION_GROUP_EXTERNAL;

         if(!LP_IsManagedMagic(magic))
         {
            m_external_positions++;
            m_external_floating_pnl += profit;
         }
         else
         {
            m_managed_positions++;
            m_managed_floating_pnl += profit;

            LP_MagicParts parts;
            if(!LP_DecodeMagic(magic, parts))
            {
               group = LP_POSITION_GROUP_UNKNOWN;
               m_unknown_managed_positions++;
            }
            else if(parts.grid_family > 0)
            {
               group = LP_POSITION_GROUP_GRID;
               m_grid_group_positions++;
               m_grid_group_floating_pnl += profit;
            }
            else
            {
               group = LP_POSITION_GROUP_ENTRY;
               m_entry_group_positions++;
               m_entry_group_floating_pnl += profit;
            }
         }

         hash_payload += symbol + ":" + (string)magic + ":" + (string)ticket + ":" + LP_PositionGroupName(group) + "|";
      }

      m_snapshot_hash = LP_HashString(hash_payload);
      m_recovery_state = LP_RECOVERY_OK;
      m_dirty = false;
   }

   void BuildPortfolioState(const ulong config_hash, LP_PortfolioState &state)
   {
      Refresh();
      state.asof = TimeCurrent();
      state.balance = AccountInfoDouble(ACCOUNT_BALANCE);
      state.equity = AccountInfoDouble(ACCOUNT_EQUITY);
      state.margin = AccountInfoDouble(ACCOUNT_MARGIN);
      state.free_margin = AccountInfoDouble(ACCOUNT_MARGIN_FREE);
      state.ea_floating_pnl = m_managed_floating_pnl;
      state.entry_group_floating_pnl = m_entry_group_floating_pnl;
      state.grid_group_floating_pnl = m_grid_group_floating_pnl;
      state.external_floating_pnl = m_external_floating_pnl;
      state.open_position_count = m_total_positions;
      state.managed_position_count = m_managed_positions;
      state.entry_group_position_count = m_entry_group_positions;
      state.grid_group_position_count = m_grid_group_positions;
      state.external_position_count = m_external_positions;
      state.unknown_managed_position_count = m_unknown_managed_positions;
      state.open_grid_count = 0;
      state.position_snapshot_hash = m_snapshot_hash;
      state.config_hash = config_hash;
      state.recovery_state = m_recovery_state;
   }
};

#endif // __LIMNI_PORTFOLIO_POSITION_INDEX_MQH__
