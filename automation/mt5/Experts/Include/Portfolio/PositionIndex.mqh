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
   bool m_tester_cache_active;
   bool m_tester_cache_blocked_until_checkpoint;
   long m_last_exact_scan_day_key;
   ulong m_exact_full_scan_count;
   ulong m_cached_market_reprice_count;
   ulong m_cache_validation_count;
   ulong m_cache_validation_pass_count;
   ulong m_cache_validation_failure_count;
   ulong m_cache_runtime_fallback_count;
   ulong m_cache_structural_checkpoint_count;
   ulong m_cache_daily_checkpoint_count;
   ulong m_cache_invalidation_count;
   double m_cache_max_validation_difference;
   string m_cache_last_reason;
   int m_cache_structure_mismatch_positions;
   double m_cache_validation_tolerance;

   long DayKey(const datetime value)
   {
      MqlDateTime parts;
      if(value <= 0 || !TimeToStruct(value, parts))
         return 0;
      return (long)parts.year * 1000 + parts.day_of_year;
   }

   double AccountMoneyQuantum()
   {
      int digits = (int)AccountInfoInteger(ACCOUNT_CURRENCY_DIGITS);
      if(digits < 0)
         digits = 0;
      else if(digits > 8)
         digits = 8;
      return MathPow(10.0, -digits);
   }

   void FillPortfolioState(
      const ulong config_hash,
      LP_PortfolioState &state,
      const int open_grid_count
   )
   {
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
      state.open_grid_count = open_grid_count;
      state.position_snapshot_hash = m_snapshot_hash;
      state.config_hash = config_hash;
      state.recovery_state = m_recovery_state;
   }

   bool TesterCacheOwnershipEligible(LP_GridBook &grid_book, string &reason)
   {
      if(!LP_HedgingAccount())
      {
         reason = "hedging_account_required_for_tester_cache";
         return false;
      }
      if(m_cache_structure_mismatch_positions > 0)
      {
         reason = "position_identity_mismatch_requires_exact_scan|count=" +
            IntegerToString(m_cache_structure_mismatch_positions);
         return false;
      }
      if(!grid_book.StructureConsistent())
      {
         reason = "grid_market_reprice_structure_inconsistent_requires_exact_scan";
         return false;
      }
      if(m_external_positions > 0)
      {
         reason = "external_positions_require_exact_scan";
         return false;
      }
      if(m_unknown_managed_positions > 0)
      {
         reason = "unknown_managed_positions_require_exact_scan";
         return false;
      }
      if(m_entry_group_positions > 0)
      {
         reason = "entry_group_positions_require_exact_scan";
         return false;
      }
      if(m_total_positions != m_managed_positions ||
         m_grid_group_positions != m_managed_positions ||
         grid_book.GridPositionCount() != m_grid_group_positions)
      {
         reason = "grid_topology_count_mismatch_requires_exact_scan";
         return false;
      }
      reason = "tester_grid_topology_owned";
      return true;
   }

   bool ValidateTesterMarketReprice(LP_GridBook &grid_book, string &reason)
   {
      m_cache_validation_count++;
      if(!TesterCacheOwnershipEligible(grid_book, reason))
      {
         m_cache_validation_failure_count++;
         return false;
      }

      // Repricing may differ only by floating-point noise. Any economically
      // visible fraction of the account-money quantum forces exact scans.
      double tolerance = MathMax(0.00000001, AccountMoneyQuantum() * 0.0001);
      m_cache_validation_tolerance = tolerance;
      double max_difference = 0.0;
      bool valid = grid_book.ValidateMarketReprice(tolerance, max_difference, reason);
      if(max_difference > m_cache_max_validation_difference)
         m_cache_max_validation_difference = max_difference;
      if(valid)
      {
         m_cache_validation_pass_count++;
         reason = "tester_grid_market_reprice_validated|max_difference=" +
            DoubleToString(max_difference, 8) +
            "|tolerance=" + DoubleToString(tolerance, 8);
         return true;
      }
      m_cache_validation_failure_count++;
      return false;
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
      m_tester_cache_active = false;
      m_tester_cache_blocked_until_checkpoint = false;
      m_last_exact_scan_day_key = 0;
      m_exact_full_scan_count = 0;
      m_cached_market_reprice_count = 0;
      m_cache_validation_count = 0;
      m_cache_validation_pass_count = 0;
      m_cache_validation_failure_count = 0;
      m_cache_runtime_fallback_count = 0;
      m_cache_structural_checkpoint_count = 0;
      m_cache_daily_checkpoint_count = 0;
      m_cache_invalidation_count = 0;
      m_cache_max_validation_difference = 0.0;
      m_cache_last_reason = "not_initialized";
      m_cache_structure_mismatch_positions = 0;
      m_cache_validation_tolerance = 0.0;
   }

   void MarkDirty()
   {
      if(!m_dirty)
         m_cache_invalidation_count++;
      m_dirty = true;
      m_tester_cache_active = false;
      m_tester_cache_blocked_until_checkpoint = false;
      m_cache_last_reason = "structure_marked_dirty";
   }

   void Refresh(LP_PositionCommissionCache &commission_cache)
   {
      commission_cache.MarkExactRefresh();
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
      m_cache_structure_mismatch_positions = 0;
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
      commission_cache.MarkExactRefresh();
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
      m_cache_structure_mismatch_positions = 0;
      ulong snapshot_hash = 1469598103934665603;
      bool build_tester_cache = LP_IsTesterRuntime();
      grid_book.BeginRefresh(build_tester_cache);
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
         bool managed_magic = decoded_magic;
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
            if(build_tester_cache)
            {
               int actual_direction = position_type == POSITION_TYPE_BUY ? 1 :
                  (position_type == POSITION_TYPE_SELL ? -1 : 0);
               int actual_symbol_id = LP_SymbolIdFromBrokerSymbol(position_symbol);
               if(actual_direction != parts.direction || actual_symbol_id != parts.symbol_id)
                  m_cache_structure_mismatch_positions++;
            }
            grid_book.AccumulateSelectedPosition(
               parts,
               ticket,
               position_symbol,
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
      m_exact_full_scan_count++;
      FillPortfolioState(config_hash, state, 0);
   }

   void BuildPortfolioStateAndGridBook(
      const ulong config_hash,
      LP_PortfolioState &state,
      LP_GridBook &grid_book,
      LP_PositionCommissionCache &commission_cache,
      LP_CurrencyExposureGuard &currency_guard
   )
   {
      bool tester_runtime = LP_IsTesterRuntime();
      long current_day_key = DayKey(TimeCurrent());
      bool daily_checkpoint_due = tester_runtime &&
         m_last_exact_scan_day_key > 0 &&
         current_day_key > 0 &&
         current_day_key != m_last_exact_scan_day_key;
      bool positions_total_changed = PositionsTotal() != m_total_positions;
      bool structural_checkpoint_due = m_dirty || positions_total_changed;
      bool runtime_reprice_failed = false;

      // Live runtime retains the exact per-position scan on every refresh.
      // In Strategy Tester only, a validated all-grid topology can be valued
      // from at most two broker profit calculations per grid (separate
      // winner/loser conversion sides) until structure or the server day
      // changes. Any ambiguity falls through to the exact scan.
      if(tester_runtime && m_tester_cache_active &&
         !daily_checkpoint_due && !structural_checkpoint_due)
      {
         string reprice_reason = "";
         if(grid_book.GridPositionCount() == m_grid_group_positions &&
            grid_book.RepriceFromMarket(reprice_reason))
         {
            m_managed_floating_pnl = grid_book.GridFloatingPnl();
            m_grid_group_floating_pnl = m_managed_floating_pnl;
            m_entry_group_floating_pnl = 0.0;
            m_external_floating_pnl = 0.0;
            m_cached_market_reprice_count++;
            m_cache_last_reason = reprice_reason;
            FillPortfolioState(config_hash, state, grid_book.OpenGridCount());
            return;
         }

         runtime_reprice_failed = true;
         m_tester_cache_active = false;
         m_tester_cache_blocked_until_checkpoint = true;
         m_cache_runtime_fallback_count++;
         m_cache_last_reason = reprice_reason == "" ?
            "grid_market_reprice_topology_mismatch" : reprice_reason;
      }

      if(tester_runtime && !m_tester_cache_active &&
         !structural_checkpoint_due && !daily_checkpoint_due &&
         !runtime_reprice_failed)
         m_cache_runtime_fallback_count++;

      Refresh(commission_cache, grid_book, currency_guard);
      m_exact_full_scan_count++;
      if(tester_runtime)
      {
         if(structural_checkpoint_due)
            m_cache_structural_checkpoint_count++;
         if(daily_checkpoint_due)
            m_cache_daily_checkpoint_count++;
         if(current_day_key > 0)
            m_last_exact_scan_day_key = current_day_key;

         bool validation_checkpoint = structural_checkpoint_due ||
            daily_checkpoint_due ||
            (!m_tester_cache_blocked_until_checkpoint && !runtime_reprice_failed);
         if(validation_checkpoint)
         {
            string validation_reason = "";
            bool validation_ok = ValidateTesterMarketReprice(grid_book, validation_reason);
            m_tester_cache_active = validation_ok;
            m_tester_cache_blocked_until_checkpoint = !validation_ok;
            m_cache_last_reason = validation_reason;
         }
      }
      FillPortfolioState(config_hash, state, grid_book.OpenGridCount());
   }

   bool TesterCacheActive()
   {
      return m_tester_cache_active;
   }

   ulong ExactFullScanCount()
   {
      return m_exact_full_scan_count;
   }

   ulong CachedMarketRepriceCount()
   {
      return m_cached_market_reprice_count;
   }

   ulong CacheValidationCount()
   {
      return m_cache_validation_count;
   }

   ulong CacheValidationPassCount()
   {
      return m_cache_validation_pass_count;
   }

   ulong CacheValidationFailureCount()
   {
      return m_cache_validation_failure_count;
   }

   ulong CacheRuntimeFallbackCount()
   {
      return m_cache_runtime_fallback_count;
   }

   ulong CacheStructuralCheckpointCount()
   {
      return m_cache_structural_checkpoint_count;
   }

   ulong CacheDailyCheckpointCount()
   {
      return m_cache_daily_checkpoint_count;
   }

   ulong CacheInvalidationCount()
   {
      return m_cache_invalidation_count;
   }

   double CacheMaxValidationDifference()
   {
      return m_cache_max_validation_difference;
   }

   double CacheValidationTolerance()
   {
      return m_cache_validation_tolerance;
   }

   int CacheStructureMismatchPositions()
   {
      return m_cache_structure_mismatch_positions;
   }

   string CacheLastReason()
   {
      return m_cache_last_reason;
   }
};

#endif // __LIMNI_PORTFOLIO_POSITION_INDEX_MQH__
