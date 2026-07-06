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
   double m_managed_floating_pnl;
   ulong m_snapshot_hash;
   int m_recovery_state;

public:
   void Reset()
   {
      m_dirty = true;
      m_total_positions = 0;
      m_managed_positions = 0;
      m_managed_floating_pnl = 0.0;
      m_snapshot_hash = 0;
      m_recovery_state = LP_RECOVERY_OK;
   }

   void MarkDirty()
   {
      m_dirty = true;
   }

   void Refresh()
   {
      if(!m_dirty)
         return;

      m_total_positions = PositionsTotal();
      m_managed_positions = 0;
      m_managed_floating_pnl = 0.0;
      string hash_payload = "";

      for(int i = 0; i < m_total_positions; i++)
      {
         ulong ticket = PositionGetTicket(i);
         if(ticket == 0)
            continue;
         if(!PositionSelectByTicket(ticket))
            continue;

         long magic = (long)PositionGetInteger(POSITION_MAGIC);
         if(!LP_IsManagedMagic(magic))
            continue;

         m_managed_positions++;
         string symbol = PositionGetString(POSITION_SYMBOL);
         double profit = PositionGetDouble(POSITION_PROFIT) + PositionGetDouble(POSITION_SWAP);
         m_managed_floating_pnl += profit;
         hash_payload += symbol + ":" + (string)magic + ":" + (string)ticket + "|";
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
      state.open_position_count = m_total_positions;
      state.managed_position_count = m_managed_positions;
      state.open_grid_count = 0;
      state.position_snapshot_hash = m_snapshot_hash;
      state.config_hash = config_hash;
      state.recovery_state = m_recovery_state;
   }
};

#endif // __LIMNI_PORTFOLIO_POSITION_INDEX_MQH__
