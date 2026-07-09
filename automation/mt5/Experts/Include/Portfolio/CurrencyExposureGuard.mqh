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
   ulong m_snapshot_hash;
   string m_hash_payload;

   void ClearExposure()
   {
      m_managed_positions = 0;
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
      for(int i = 0; i < LP_CCY_COUNT; i++)
      {
         m_reserved_signed_lots[i] = 0.0;
         m_reserved_gross_lots[i] = 0.0;
         m_reserved_grid_long_count[i] = 0;
         m_reserved_grid_short_count[i] = 0;
      }
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

   void AddExposure(const int ccy, const double signed_delta, const bool grid_position)
   {
      if(ccy < 0 || ccy >= LP_CCY_COUNT)
         return;
      m_exposure[ccy].signed_lots += signed_delta;
      m_exposure[ccy].gross_lots += MathAbs(signed_delta);
      if(grid_position)
      {
         m_exposure[ccy].active_grid_count++;
         if(signed_delta > 0.0)
            m_grid_long_count[ccy]++;
         else if(signed_delta < 0.0)
            m_grid_short_count[ccy]++;
      }
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
   }

public:
   void Reset()
   {
      m_enabled = false;
      m_max_signed_lots = 0.0;
      m_max_gross_lots = 0.0;
      m_max_same_direction_grids = 0;
      m_max_managed_positions = 0;
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
      const bool grid_position
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

      AddExposure(base_ccy, direction * lots, grid_position);
      AddExposure(quote_ccy, -direction * lots, grid_position);
      m_managed_positions++;
      m_hash_payload += (string)ticket + ":" + (string)magic + ":" + DoubleToString(lots, 2) + ":" + IntegerToString(direction) + "|";
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
         if(!PositionSelectByTicket(ticket))
            continue;

         long magic = (long)PositionGetInteger(POSITION_MAGIC);
         if(!LP_IsManagedMagic(magic))
            continue;

         LP_MagicParts parts;
         bool decoded = LP_DecodeMagic(magic, parts);
         int symbol_id = decoded ? parts.symbol_id : LP_SymbolIdFromBrokerSymbol(PositionGetString(POSITION_SYMBOL));
         if(symbol_id < 0 || symbol_id >= LP_SYMBOL_COUNT)
            continue;

         long position_type = (long)PositionGetInteger(POSITION_TYPE);
         int direction = position_type == POSITION_TYPE_BUY ? 1 : (position_type == POSITION_TYPE_SELL ? -1 : 0);
         double lots = PositionGetDouble(POSITION_VOLUME);
         bool grid_position = decoded && parts.grid_family > 0;
         AccumulateManagedPosition(ticket, magic, symbol_id, direction, lots, grid_position);
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
         "|reserved_managed_positions=" + IntegerToString(m_reserved_managed_positions);
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

   bool AllowsCandidate(const LP_TradeIntent &intent, string &reason)
   {
      if(!m_enabled)
      {
         reason = "currency_guard_disabled";
         return true;
      }

      if(intent.symbol_id < 0 || intent.symbol_id >= LP_SYMBOL_COUNT || intent.direction == LP_SIDE_NONE || intent.requested_lots <= 0.0)
      {
         reason = "invalid_intent_for_currency_guard";
         return false;
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

      if(m_max_same_direction_grids > 0 &&
         (intent.action == LP_INTENT_OPEN_GRID || intent.action == LP_INTENT_ADD_GRID_LEG))
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

   bool ReserveCandidate(const LP_TradeIntent &intent, string &reason)
   {
      if(!m_enabled)
      {
         reason = "currency_guard_disabled";
         return true;
      }
      if(intent.action != LP_INTENT_OPEN_GRID && intent.action != LP_INTENT_ADD_GRID_LEG)
      {
         reason = "reservation_not_required";
         return true;
      }
      if(!AllowsCandidate(intent, reason))
         return false;

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
      m_reserved_signed_lots[base_ccy] += base_delta;
      m_reserved_signed_lots[quote_ccy] += quote_delta;
      m_reserved_gross_lots[base_ccy] += MathAbs(base_delta);
      m_reserved_gross_lots[quote_ccy] += MathAbs(quote_delta);
      if(base_delta > 0.0)
         m_reserved_grid_long_count[base_ccy]++;
      else if(base_delta < 0.0)
         m_reserved_grid_short_count[base_ccy]++;
      if(quote_delta > 0.0)
         m_reserved_grid_long_count[quote_ccy]++;
      else if(quote_delta < 0.0)
         m_reserved_grid_short_count[quote_ccy]++;
      m_reserved_managed_positions++;
      reason = "currency_guard_reserved";
      return true;
   }
};

#endif // __LIMNI_PORTFOLIO_CURRENCY_EXPOSURE_GUARD_MQH__
