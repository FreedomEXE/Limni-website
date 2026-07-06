/*-----------------------------------------------
  Symbol metadata cache
-----------------------------------------------*/
#ifndef __LIMNI_PORTFOLIO_SYMBOL_SPEC_CACHE_MQH__
#define __LIMNI_PORTFOLIO_SYMBOL_SPEC_CACHE_MQH__

#include "..\\Core\\Types.mqh"
#include "..\\Core\\SymbolUniverse.mqh"
#include "..\\Receipts\\ReceiptWriter.mqh"

class LP_SymbolSpecCache
{
private:
   LP_SymbolMeta m_symbols[LP_SYMBOL_COUNT];
   int m_valid_count;

public:
   void Reset()
   {
      m_valid_count = 0;
      for(int i = 0; i < LP_SYMBOL_COUNT; i++)
      {
         m_symbols[i].symbol_id = i;
         m_symbols[i].canonical_symbol = LP_CanonicalSymbol(i);
         m_symbols[i].broker_symbol = "";
         m_symbols[i].base_ccy = -1;
         m_symbols[i].quote_ccy = -1;
         m_symbols[i].digits = 0;
         m_symbols[i].point = 0.0;
         m_symbols[i].tick_size = 0.0;
         m_symbols[i].tick_value = 0.0;
         m_symbols[i].contract_size = 0.0;
         m_symbols[i].min_lot = 0.0;
         m_symbols[i].max_lot = 0.0;
         m_symbols[i].lot_step = 0.0;
         m_symbols[i].trade_mode = 0;
         m_symbols[i].spread_points = 0;
         m_symbols[i].selected = false;
         m_symbols[i].synchronized = false;
         m_symbols[i].tradable = false;
      }
   }

   bool Load(const LP_Config &config, LP_ReceiptWriter &receipts)
   {
      Reset();
      bool all_ok = true;
      for(int i = 0; i < LP_SYMBOL_COUNT; i++)
      {
         string canonical = LP_CanonicalSymbol(i);
         string broker = LP_ResolveBrokerSymbol(canonical, config.broker_symbol_suffix);

         int base_ccy = -1;
         int quote_ccy = -1;
         LP_CanonicalBaseQuote(canonical, base_ccy, quote_ccy);

         bool selected = SymbolSelect(broker, true);
         bool exists = (bool)SymbolInfoInteger(broker, SYMBOL_EXIST);
         bool synchronized = selected && (bool)SeriesInfoInteger(broker, PERIOD_M1, SERIES_SYNCHRONIZED);

         m_symbols[i].symbol_id = i;
         m_symbols[i].canonical_symbol = canonical;
         m_symbols[i].broker_symbol = broker;
         m_symbols[i].base_ccy = base_ccy;
         m_symbols[i].quote_ccy = quote_ccy;
         m_symbols[i].selected = selected;
         m_symbols[i].synchronized = synchronized;
         m_symbols[i].digits = exists ? (int)SymbolInfoInteger(broker, SYMBOL_DIGITS) : 0;
         m_symbols[i].point = exists ? SymbolInfoDouble(broker, SYMBOL_POINT) : 0.0;
         m_symbols[i].tick_size = exists ? SymbolInfoDouble(broker, SYMBOL_TRADE_TICK_SIZE) : 0.0;
         m_symbols[i].tick_value = exists ? SymbolInfoDouble(broker, SYMBOL_TRADE_TICK_VALUE) : 0.0;
         m_symbols[i].contract_size = exists ? SymbolInfoDouble(broker, SYMBOL_TRADE_CONTRACT_SIZE) : 0.0;
         m_symbols[i].min_lot = exists ? SymbolInfoDouble(broker, SYMBOL_VOLUME_MIN) : 0.0;
         m_symbols[i].max_lot = exists ? SymbolInfoDouble(broker, SYMBOL_VOLUME_MAX) : 0.0;
         m_symbols[i].lot_step = exists ? SymbolInfoDouble(broker, SYMBOL_VOLUME_STEP) : 0.0;
         m_symbols[i].trade_mode = exists ? (int)SymbolInfoInteger(broker, SYMBOL_TRADE_MODE) : 0;
         m_symbols[i].spread_points = exists ? (int)SymbolInfoInteger(broker, SYMBOL_SPREAD) : 0;
         m_symbols[i].tradable = exists && selected && m_symbols[i].trade_mode != SYMBOL_TRADE_MODE_DISABLED;

         string detail = "canonical=" + canonical +
            "|broker=" + broker +
            "|selected=" + LP_BoolText(selected) +
            "|synchronized=" + LP_BoolText(synchronized) +
            "|tradable=" + LP_BoolText(m_symbols[i].tradable) +
            "|digits=" + IntegerToString(m_symbols[i].digits) +
            "|point=" + DoubleToString(m_symbols[i].point, 10) +
            "|tick_size=" + DoubleToString(m_symbols[i].tick_size, 10) +
            "|contract_size=" + DoubleToString(m_symbols[i].contract_size, 2) +
            "|min_lot=" + DoubleToString(m_symbols[i].min_lot, 2) +
            "|lot_step=" + DoubleToString(m_symbols[i].lot_step, 2);
         receipts.Write(LP_RECEIPT_SYMBOL_INIT, broker, "symbol_init", detail, 0, 0, 0, 0, 0, 0);

         if(!m_symbols[i].tradable)
            all_ok = false;
         else
            m_valid_count++;
      }
      return all_ok || !config.require_all_symbols;
   }

   int Count()
   {
      return LP_SYMBOL_COUNT;
   }

   int ValidCount()
   {
      return m_valid_count;
   }

   bool Get(const int index, LP_SymbolMeta &meta)
   {
      if(index < 0 || index >= LP_SYMBOL_COUNT)
         return false;
      meta = m_symbols[index];
      return true;
   }
};

#endif // __LIMNI_PORTFOLIO_SYMBOL_SPEC_CACHE_MQH__
