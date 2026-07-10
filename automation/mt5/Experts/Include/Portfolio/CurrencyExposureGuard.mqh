/*-----------------------------------------------
  Currency-token exposure guard
-----------------------------------------------*/
#ifndef __LIMNI_PORTFOLIO_CURRENCY_EXPOSURE_GUARD_MQH__
#define __LIMNI_PORTFOLIO_CURRENCY_EXPOSURE_GUARD_MQH__

#include "..\\Core\\Types.mqh"
#include "..\\Core\\SymbolUniverse.mqh"
#include "..\\Execution\\MagicCodec.mqh"
#include "..\\Receipts\\ReceiptWriter.mqh"

class LP_CurrencyExposureGuard
{
private:
   LP_CurrencyExposure m_exposure[LP_CCY_COUNT];
   int m_grid_long_count[LP_CCY_COUNT];
   int m_grid_short_count[LP_CCY_COUNT];
   bool m_enabled;
   double m_max_signed_lots;
   double m_max_gross_lots;
   int m_max_same_direction_grids;
   int m_max_managed_positions;
   int m_managed_positions;
   int m_reserved_managed_positions;
   double m_reserved_signed_lots[LP_CCY_COUNT];
   double m_reserved_gross_lots[LP_CCY_COUNT];
   int m_reserved_grid_long_count[LP_CCY_COUNT];
   int m_reserved_grid_short_count[LP_CCY_COUNT];
   ulong m_active_grid_keys[];
   int m_active_grid_count;
   int m_active_grid_capacity;
   ulong m_reserved_grid_keys[];
   int m_reserved_grid_count;
   int m_reserved_grid_capacity;
   int m_reused_grid_leg_count;
   bool m_grid_identity_degraded;
   bool m_grid_identity_allocation_degraded;
   ulong m_grid_identity_allocation_failure_count;
   int m_grid_identity_mismatch_positions;
   ulong m_grid_identity_mismatch_transition_count;
   ulong m_snapshot_hash;
   string m_hash_payload;

   void ClearExposure()
   {
      m_managed_positions = 0;
      m_active_grid_count = 0;
      m_reused_grid_leg_count = 0;
      m_grid_identity_mismatch_positions = 0;
      for(int i = 0; i < LP_CCY_COUNT; i++)
      {
         m_exposure[i].ccy = i;
         m_exposure[i].signed_lots = 0.0;
         m_exposure[i].gross_lots = 0.0;
         m_exposure[i].active_grid_count = 0;
         m_exposure[i].same_direction_grid_count = 0;
         m_grid_long_count[i] = 0;
         m_grid_short_count[i] = 0;
      }
   }

   void ClearReservations()
   {
      m_reserved_managed_positions = 0;
      m_reserved_grid_count = 0;
      for(int i = 0; i < LP_CCY_COUNT; i++)
      {
         m_reserved_signed_lots[i] = 0.0;
         m_reserved_gross_lots[i] = 0.0;
         m_reserved_grid_long_count[i] = 0;
         m_reserved_grid_short_count[i] = 0;
      }
   }

   bool HasActiveGridKey(const ulong grid_key)
   {
      if(grid_key == 0)
         return false;
      for(int i = 0; i < m_active_grid_count; i++)
      {
         if(m_active_grid_keys[i] == grid_key)
            return true;
      }
      return false;
   }

   bool HasReservedGridKey(const ulong grid_key)
   {
      if(grid_key == 0)
         return false;
      for(int i = 0; i < m_reserved_grid_count; i++)
      {
         if(m_reserved_grid_keys[i] == grid_key)
            return true;
      }
      return false;
   }

   bool EnsureActiveGridCapacity(const int required_count)
   {
      if(required_count <= m_active_grid_capacity)
         return true;
      int requested_capacity = m_active_grid_capacity <= 0 ? 32 : m_active_grid_capacity * 2;
      while(requested_capacity < required_count)
         requested_capacity *= 2;
      if(ArrayResize(m_active_grid_keys, requested_capacity, requested_capacity) != requested_capacity)
      {
         if(!m_grid_identity_allocation_degraded)
            m_grid_identity_allocation_failure_count++;
         m_grid_identity_allocation_degraded = true;
         m_grid_identity_degraded = true;
         return false;
      }
      m_active_grid_capacity = requested_capacity;
      return true;
   }

   bool EnsureReservedGridCapacity(const int required_count)
   {
      if(required_count <= m_reserved_grid_capacity)
         return true;
      int requested_capacity = m_reserved_grid_capacity <= 0 ? 32 : m_reserved_grid_capacity * 2;
      while(requested_capacity < required_count)
         requested_capacity *= 2;
      if(ArrayResize(m_reserved_grid_keys, requested_capacity, requested_capacity) != requested_capacity)
      {
         if(!m_grid_identity_allocation_degraded)
            m_grid_identity_allocation_failure_count++;
         m_grid_identity_allocation_degraded = true;
         m_grid_identity_degraded = true;
         return false;
      }
      m_reserved_grid_capacity = requested_capacity;
      return true;
   }

   bool RegisterActiveGridKey(const ulong grid_key, bool &is_new_grid)
   {
      is_new_grid = false;
      if(grid_key == 0)
         return true;
      if(HasActiveGridKey(grid_key))
      {
         m_reused_grid_leg_count++;
         return true;
      }
      if(!EnsureActiveGridCapacity(m_active_grid_count + 1))
         return false;
      m_active_grid_keys[m_active_grid_count] = grid_key;
      m_active_grid_count++;
      is_new_grid = true;
      return true;
   }

   bool RegisterReservedGridKey(const ulong grid_key, bool &is_new_grid)
   {
      is_new_grid = false;
      if(grid_key == 0 || HasActiveGridKey(grid_key) || HasReservedGridKey(grid_key))
         return true;
      if(!EnsureReservedGridCapacity(m_reserved_grid_count + 1))
         return false;
      m_reserved_grid_keys[m_reserved_grid_count] = grid_key;
      m_reserved_grid_count++;
      is_new_grid = true;
      return true;
   }

   int CandidateGridDirectionCount(const int ccy, const double delta)
   {
      if(ccy < 0 || ccy >= LP_CCY_COUNT)
         return 0;
      if(delta > 0.0)
         return m_grid_long_count[ccy] + m_reserved_grid_long_count[ccy];
      if(delta < 0.0)
         return m_grid_short_count[ccy] + m_reserved_grid_short_count[ccy];
      return 0;
   }

   void AddLotExposure(const int ccy, const double signed_delta)
   {
      if(ccy < 0 || ccy >= LP_CCY_COUNT)
         return;
      m_exposure[ccy].signed_lots += signed_delta;
      m_exposure[ccy].gross_lots += MathAbs(signed_delta);
   }

   void AddGridExposure(const int ccy, const double direction_delta)
   {
      if(ccy < 0 || ccy >= LP_CCY_COUNT)
         return;
      m_exposure[ccy].active_grid_count++;
      if(direction_delta > 0.0)
         m_grid_long_count[ccy]++;
      else if(direction_delta < 0.0)
         m_grid_short_count[ccy]++;
   }

   void AppendCurrencyHash()
   {
      for(int c = 0; c < LP_CCY_COUNT; c++)
      {
         m_exposure[c].same_direction_grid_count = MathMax(m_grid_long_count[c], m_grid_short_count[c]);
         m_hash_payload += LP_CcyCode(c) + ":" +
            DoubleToString(m_exposure[c].signed_lots, 2) + ":" +
            DoubleToString(m_exposure[c].gross_lots, 2) + ":" +
            IntegerToString(m_grid_long_count[c]) + ":" +
            IntegerToString(m_grid_short_count[c]) + "|";
      }
      m_hash_payload += "grid_count_basis=distinct_grid_key" +
         "|grid_identity_degraded=" + LP_BoolText(m_grid_identity_degraded) +
         "|grid_identity_allocation_degraded=" + LP_BoolText(m_grid_identity_allocation_degraded) +
         "|grid_identity_allocation_failures=" + (string)m_grid_identity_allocation_failure_count +
         "|grid_identity_mismatch_positions=" + IntegerToString(m_grid_identity_mismatch_positions) +
         "|grid_identity_mismatch_transitions=" + (string)m_grid_identity_mismatch_transition_count + "|";
   }

public:
   void Reset()
   {
      m_enabled = false;
      m_max_signed_lots = 0.0;
      m_max_gross_lots = 0.0;
      m_max_same_direction_grids = 0;
      m_max_managed_positions = 0;
      ArrayResize(m_active_grid_keys, 0);
      ArrayResize(m_reserved_grid_keys, 0);
      m_active_grid_count = 0;
      m_active_grid_capacity = 0;
      m_reserved_grid_count = 0;
      m_reserved_grid_capacity = 0;
      m_reused_grid_leg_count = 0;
      m_grid_identity_degraded = false;
      m_grid_identity_allocation_degraded = false;
      m_grid_identity_allocation_failure_count = 0;
      m_grid_identity_mismatch_positions = 0;
      m_grid_identity_mismatch_transition_count = 0;
      m_snapshot_hash = 0;
      ClearExposure();
      ClearReservations();
   }

   void Configure(const LP_Config &config)
   {
      m_enabled = config.enable_currency_exposure_guard;
      m_max_signed_lots = config.max_currency_signed_lots;
      m_max_gross_lots = config.max_currency_gross_lots;
      m_max_same_direction_grids = config.max_same_direction_grids_per_currency;
      m_max_managed_positions = config.max_managed_positions;
   }

   void BeginRefresh()
   {
      ClearExposure();
      ClearReservations();
      m_hash_payload = "";
   }

   void BeginIntentBatch()
   {
      ClearReservations();
   }

   void AccumulateManagedPosition(
      const ulong ticket,
      const long magic,
      const int symbol_id,
      const int direction,
      const double lots,
      const ulong grid_key
   )
   {
      if(symbol_id < 0 || symbol_id >= LP_SYMBOL_COUNT)
         return;
      if(direction != 1 && direction != -1)
         return;
      if(lots <= 0.0)
         return;

      int base_ccy = -1;
      int quote_ccy = -1;
      LP_CanonicalBaseQuote(LP_CanonicalSymbol(symbol_id), base_ccy, quote_ccy);

      AddLotExposure(base_ccy, direction * lots);
      AddLotExposure(quote_ccy, -direction * lots);
      if(grid_key > 0)
      {
         bool is_new_grid = false;
         if(RegisterActiveGridKey(grid_key, is_new_grid) && is_new_grid)
         {
            AddGridExposure(base_ccy, direction);
            AddGridExposure(quote_ccy, -direction);
            m_hash_payload += "grid=" + (string)grid_key + "|";
         }
      }
      m_managed_positions++;
      m_hash_payload += (string)ticket + ":" + (string)magic + ":" + DoubleToString(lots, 2) + ":" + IntegerToString(direction) + "|";
   }

   void MarkGridIdentityMismatch()
   {
      m_grid_identity_mismatch_positions++;
      if(!m_grid_identity_degraded)
         m_grid_identity_mismatch_transition_count++;
      m_grid_identity_degraded = true;
   }

   void EndRefresh()
   {
      AppendCurrencyHash();
      m_snapshot_hash = LP_HashString(m_hash_payload);
   }

   void Refresh()
   {
      BeginRefresh();

      int total = PositionsTotal();
      for(int i = 0; i < total; i++)
      {
         ulong ticket = PositionGetTicket(i);
         if(ticket == 0)
            continue;

         long magic = (long)PositionGetInteger(POSITION_MAGIC);
         if(!LP_IsManagedMagic(magic))
            continue;

         LP_MagicParts parts;
         bool decoded = LP_DecodeMagic(magic, parts);
         string broker_symbol = PositionGetString(POSITION_SYMBOL);
         int actual_symbol_id = LP_SymbolIdFromBrokerSymbol(broker_symbol);
         int symbol_id = actual_symbol_id >= 0 ? actual_symbol_id :
            (decoded ? parts.symbol_id : actual_symbol_id);
         if(symbol_id < 0 || symbol_id >= LP_SYMBOL_COUNT)
            continue;

         long position_type = (long)PositionGetInteger(POSITION_TYPE);
         int direction = position_type == POSITION_TYPE_BUY ? 1 : (position_type == POSITION_TYPE_SELL ? -1 : 0);
         if(decoded && (actual_symbol_id != parts.symbol_id || direction != parts.direction))
            MarkGridIdentityMismatch();
         double lots = PositionGetDouble(POSITION_VOLUME);
         ulong grid_key = decoded && parts.grid_family > 0 ? LP_BuildGridKeyFromParts(parts) : 0;
         AccumulateManagedPosition(ticket, magic, symbol_id, direction, lots, grid_key);
      }

      EndRefresh();
   }

   ulong SnapshotHash()
   {
      return m_snapshot_hash;
   }

   string SummaryMessage()
   {
      string message = "enabled=" + LP_BoolText(m_enabled) +
         "|managed_positions=" + IntegerToString(m_managed_positions) +
         "|reserved_managed_positions=" + IntegerToString(m_reserved_managed_positions) +
         "|active_distinct_grids=" + IntegerToString(m_active_grid_count) +
         "|reserved_distinct_grids=" + IntegerToString(m_reserved_grid_count) +
         "|reused_grid_legs=" + IntegerToString(m_reused_grid_leg_count) +
         "|grid_count_basis=distinct_grid_key" +
         "|grid_identity_degraded=" + LP_BoolText(m_grid_identity_degraded) +
         "|grid_identity_allocation_degraded=" + LP_BoolText(m_grid_identity_allocation_degraded) +
         "|grid_identity_allocation_failures=" + (string)m_grid_identity_allocation_failure_count +
         "|grid_identity_mismatch_positions=" + IntegerToString(m_grid_identity_mismatch_positions) +
         "|grid_identity_mismatch_transitions=" + (string)m_grid_identity_mismatch_transition_count;
      for(int i = 0; i < LP_CCY_COUNT; i++)
      {
         message += "|" + LP_CcyCode(i) +
            ":signed=" + DoubleToString(m_exposure[i].signed_lots, 2) +
            ":gross=" + DoubleToString(m_exposure[i].gross_lots, 2) +
            ":grid_long=" + IntegerToString(m_grid_long_count[i]) +
            ":grid_short=" + IntegerToString(m_grid_short_count[i]);
      }
      return message;
   }

   void WriteReceipt(LP_ReceiptWriter &receipts)
   {
      receipts.Write(
         LP_RECEIPT_CURRENCY_EXPOSURE,
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

   bool AllowsCandidate(
      const LP_TradeIntent &intent,
      const ulong resolved_grid_key,
      string &reason
   )
   {
      if(m_grid_identity_degraded)
      {
         reason = "currency_grid_identity_degraded";
         return false;
      }

      if(intent.symbol_id < 0 || intent.symbol_id >= LP_SYMBOL_COUNT || intent.direction == LP_SIDE_NONE || intent.requested_lots <= 0.0)
      {
         reason = "invalid_intent_for_currency_guard";
         return false;
      }

      if((intent.action == LP_INTENT_OPEN_GRID || intent.action == LP_INTENT_ADD_GRID_LEG) && resolved_grid_key == 0)
      {
         reason = "currency_grid_identity_missing";
         return false;
      }

      if(intent.action == LP_INTENT_OPEN_GRID &&
         (HasActiveGridKey(resolved_grid_key) || HasReservedGridKey(resolved_grid_key)))
      {
         reason = "open_grid_identity_already_active_or_reserved";
         return false;
      }

      if(intent.action == LP_INTENT_ADD_GRID_LEG &&
         !HasActiveGridKey(resolved_grid_key))
      {
         reason = "add_grid_identity_not_active";
         return false;
      }

      if(!m_enabled)
      {
         reason = "currency_guard_disabled_identity_valid";
         return true;
      }

      if(m_max_managed_positions > 0 && m_managed_positions + m_reserved_managed_positions >= m_max_managed_positions &&
         (intent.action == LP_INTENT_OPEN_GRID || intent.action == LP_INTENT_ADD_GRID_LEG))
      {
         reason = "max_managed_positions";
         return false;
      }

      int base_ccy = -1;
      int quote_ccy = -1;
      LP_CanonicalBaseQuote(LP_CanonicalSymbol(intent.symbol_id), base_ccy, quote_ccy);
      if(base_ccy < 0 || quote_ccy < 0)
      {
         reason = "symbol_currency_unresolved";
         return false;
      }

      double base_delta = intent.direction * intent.requested_lots;
      double quote_delta = -intent.direction * intent.requested_lots;
      double base_signed_after = m_exposure[base_ccy].signed_lots + m_reserved_signed_lots[base_ccy] + base_delta;
      double quote_signed_after = m_exposure[quote_ccy].signed_lots + m_reserved_signed_lots[quote_ccy] + quote_delta;
      double base_gross_after = m_exposure[base_ccy].gross_lots + m_reserved_gross_lots[base_ccy] + MathAbs(base_delta);
      double quote_gross_after = m_exposure[quote_ccy].gross_lots + m_reserved_gross_lots[quote_ccy] + MathAbs(quote_delta);

      if(m_max_signed_lots > 0.0 &&
         (MathAbs(base_signed_after) > m_max_signed_lots || MathAbs(quote_signed_after) > m_max_signed_lots))
      {
         reason = "currency_signed_lot_limit";
         return false;
      }

      if(m_max_gross_lots > 0.0 &&
         (base_gross_after > m_max_gross_lots || quote_gross_after > m_max_gross_lots))
      {
         reason = "currency_gross_lot_limit";
         return false;
      }

      bool opens_distinct_grid = intent.action == LP_INTENT_OPEN_GRID &&
         !HasActiveGridKey(resolved_grid_key) &&
         !HasReservedGridKey(resolved_grid_key);
      if(m_max_same_direction_grids > 0 && opens_distinct_grid)
      {
         int base_same = CandidateGridDirectionCount(base_ccy, base_delta) + 1;
         int quote_same = CandidateGridDirectionCount(quote_ccy, quote_delta) + 1;
         if(base_same > m_max_same_direction_grids || quote_same > m_max_same_direction_grids)
         {
            reason = "same_direction_currency_grid_limit";
            return false;
         }
      }

      reason = "currency_guard_pass";
      return true;
   }

   bool ReserveCandidate(
      const LP_TradeIntent &intent,
      const ulong resolved_grid_key,
      string &reason
   )
   {
      if(intent.action != LP_INTENT_OPEN_GRID && intent.action != LP_INTENT_ADD_GRID_LEG)
      {
         reason = "reservation_not_required";
         return true;
      }
      if(!AllowsCandidate(intent, resolved_grid_key, reason))
         return false;
      if(!m_enabled)
      {
         bool identity_reserved = false;
         if(intent.action == LP_INTENT_OPEN_GRID &&
            !RegisterReservedGridKey(resolved_grid_key, identity_reserved))
         {
            reason = "currency_guard_disabled_identity_reservation_failed";
            return false;
         }
         reason = "currency_guard_disabled_identity_valid" +
            "|grid_identity_reserved=" + LP_BoolText(identity_reserved) +
            "|resolved_grid_key=" + (string)resolved_grid_key;
         return true;
      }

      int base_ccy = -1;
      int quote_ccy = -1;
      LP_CanonicalBaseQuote(LP_CanonicalSymbol(intent.symbol_id), base_ccy, quote_ccy);
      if(base_ccy < 0 || quote_ccy < 0)
      {
         reason = "symbol_currency_unresolved";
         return false;
      }

      double base_delta = intent.direction * intent.requested_lots;
      double quote_delta = -intent.direction * intent.requested_lots;
      bool reserves_distinct_grid = false;
      if(intent.action == LP_INTENT_OPEN_GRID &&
         !RegisterReservedGridKey(resolved_grid_key, reserves_distinct_grid))
      {
         reason = "currency_grid_reservation_identity_failed";
         return false;
      }
      m_reserved_signed_lots[base_ccy] += base_delta;
      m_reserved_signed_lots[quote_ccy] += quote_delta;
      m_reserved_gross_lots[base_ccy] += MathAbs(base_delta);
      m_reserved_gross_lots[quote_ccy] += MathAbs(quote_delta);
      if(reserves_distinct_grid)
      {
         if(base_delta > 0.0)
            m_reserved_grid_long_count[base_ccy]++;
         else if(base_delta < 0.0)
            m_reserved_grid_short_count[base_ccy]++;
         if(quote_delta > 0.0)
            m_reserved_grid_long_count[quote_ccy]++;
         else if(quote_delta < 0.0)
            m_reserved_grid_short_count[quote_ccy]++;
      }
      m_reserved_managed_positions++;
      reason = "currency_guard_reserved" +
         "|reservation_scope=" +
         (intent.action == LP_INTENT_OPEN_GRID ? "open_grid" : "add_grid_leg") +
         "|grid_slot_reserved=" + LP_BoolText(reserves_distinct_grid) +
         "|lot_exposure_reserved=true" +
         "|managed_position_slot_reserved=true" +
         "|resolved_grid_key=" + (string)resolved_grid_key;
      return true;
   }
};

#endif // __LIMNI_PORTFOLIO_CURRENCY_EXPOSURE_GUARD_MQH__
