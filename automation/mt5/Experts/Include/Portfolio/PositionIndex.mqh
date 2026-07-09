/*-----------------------------------------------
  Managed position index and recovery state
-----------------------------------------------*/
#ifndef __LIMNI_PORTFOLIO_POSITION_INDEX_MQH__
#define __LIMNI_PORTFOLIO_POSITION_INDEX_MQH__

#include "..\\Core\\Types.mqh"
#include "..\\Execution\\MagicCodec.mqh"
#include "PositionCommissionCache.mqh"
#include "GridBook.mqh"
#include "CurrencyExposureGuard.mqh"

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

   void Refresh(LP_PositionCommissionCache &commission_cache)
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
      ulong snapshot_hash = 1469598103934665603;

      for(int i = 0; i < m_total_positions; i++)
      {
         ulong ticket = PositionGetTicket(i);
         if(ticket == 0)
            continue;
         if(!PositionSelectByTicket(ticket))
            continue;

         long magic = (long)PositionGetInteger(POSITION_MAGIC);
         double profit = PositionGetDouble(POSITION_PROFIT) +
            PositionGetDouble(POSITION_SWAP) +
            commission_cache.CommissionForSelectedPosition();
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

         LP_HashMixULong(snapshot_hash, ticket);
         LP_HashMixLong(snapshot_hash, magic);
         LP_HashMixInt(snapshot_hash, group);
      }

      m_snapshot_hash = snapshot_hash;
      m_recovery_state = LP_RECOVERY_OK;
      m_dirty = false;
   }

   void Refresh(
      LP_PositionCommissionCache &commission_cache,
      LP_GridBook &grid_book,
      LP_CurrencyExposureGuard &currency_guard
   )
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
      ulong snapshot_hash = 1469598103934665603;
      grid_book.BeginRefresh();
      currency_guard.BeginRefresh();

      for(int i = 0; i < m_total_positions; i++)
      {
         ulong ticket = PositionGetTicket(i);
         if(ticket == 0)
            continue;
         if(!PositionSelectByTicket(ticket))
            continue;

         long magic = (long)PositionGetInteger(POSITION_MAGIC);
         LP_MagicParts parts;
         bool decoded_magic = LP_DecodeMagic(magic, parts);
         bool managed_magic = LP_IsManagedMagic(magic);
         string position_symbol = PositionGetString(POSITION_SYMBOL);
         long position_type = (long)PositionGetInteger(POSITION_TYPE);
         double lots = PositionGetDouble(POSITION_VOLUME);
         double open_price = PositionGetDouble(POSITION_PRICE_OPEN);
         double price_pnl = PositionGetDouble(POSITION_PROFIT);
         double swap = PositionGetDouble(POSITION_SWAP);
         double commission = commission_cache.CommissionForSelectedPosition();
         double profit = price_pnl + swap + commission;
         int group = LP_POSITION_GROUP_EXTERNAL;

         if(!managed_magic)
         {
            m_external_positions++;
            m_external_floating_pnl += profit;
         }
         else
         {
            m_managed_positions++;
            m_managed_floating_pnl += profit;

            if(!decoded_magic)
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

         if(decoded_magic)
         {
            grid_book.AccumulateSelectedPosition(
               parts,
               ticket,
               lots,
               open_price,
               price_pnl,
               swap,
               commission
            );
         }

         if(managed_magic)
         {
            int direction = position_type == POSITION_TYPE_BUY ? 1 :
               (position_type == POSITION_TYPE_SELL ? -1 : 0);
            int symbol_id = decoded_magic ? parts.symbol_id : LP_SymbolIdFromBrokerSymbol(position_symbol);
            bool grid_position = decoded_magic && parts.grid_family > 0;
            currency_guard.AccumulateManagedPosition(ticket, magic, symbol_id, direction, lots, grid_position);
         }

         LP_HashMixULong(snapshot_hash, ticket);
         LP_HashMixLong(snapshot_hash, magic);
         LP_HashMixInt(snapshot_hash, group);
      }

      grid_book.EndRefresh();
      currency_guard.EndRefresh();
      m_snapshot_hash = snapshot_hash;
      m_recovery_state = LP_RECOVERY_OK;
      m_dirty = false;
   }

   void BuildPortfolioState(
      const ulong config_hash,
      LP_PortfolioState &state,
      LP_PositionCommissionCache &commission_cache
   )
   {
      Refresh(commission_cache);
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

   void BuildPortfolioStateAndGridBook(
      const ulong config_hash,
      LP_PortfolioState &state,
      LP_GridBook &grid_book,
      LP_PositionCommissionCache &commission_cache,
      LP_CurrencyExposureGuard &currency_guard
   )
   {
      Refresh(commission_cache, grid_book, currency_guard);
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
      state.open_grid_count = grid_book.OpenGridCount();
      state.position_snapshot_hash = m_snapshot_hash;
      state.config_hash = config_hash;
      state.recovery_state = m_recovery_state;
   }
};

#endif // __LIMNI_PORTFOLIO_POSITION_INDEX_MQH__
