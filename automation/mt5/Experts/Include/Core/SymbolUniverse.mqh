/*-----------------------------------------------
  Fixed 28 FX pair universe and broker symbol mapping
-----------------------------------------------*/
#ifndef __LIMNI_PORTFOLIO_SYMBOL_UNIVERSE_MQH__
#define __LIMNI_PORTFOLIO_SYMBOL_UNIVERSE_MQH__

#include "Types.mqh"

string LP_CanonicalSymbol(const int symbol_id)
{
   switch(symbol_id)
   {
      case LP_SYM_AUDCAD: return "AUDCAD";
      case LP_SYM_AUDCHF: return "AUDCHF";
      case LP_SYM_AUDJPY: return "AUDJPY";
      case LP_SYM_AUDNZD: return "AUDNZD";
      case LP_SYM_AUDUSD: return "AUDUSD";
      case LP_SYM_CADCHF: return "CADCHF";
      case LP_SYM_CADJPY: return "CADJPY";
      case LP_SYM_CHFJPY: return "CHFJPY";
      case LP_SYM_EURAUD: return "EURAUD";
      case LP_SYM_EURCAD: return "EURCAD";
      case LP_SYM_EURCHF: return "EURCHF";
      case LP_SYM_EURGBP: return "EURGBP";
      case LP_SYM_EURJPY: return "EURJPY";
      case LP_SYM_EURNZD: return "EURNZD";
      case LP_SYM_EURUSD: return "EURUSD";
      case LP_SYM_GBPAUD: return "GBPAUD";
      case LP_SYM_GBPCAD: return "GBPCAD";
      case LP_SYM_GBPCHF: return "GBPCHF";
      case LP_SYM_GBPJPY: return "GBPJPY";
      case LP_SYM_GBPNZD: return "GBPNZD";
      case LP_SYM_GBPUSD: return "GBPUSD";
      case LP_SYM_NZDCAD: return "NZDCAD";
      case LP_SYM_NZDCHF: return "NZDCHF";
      case LP_SYM_NZDJPY: return "NZDJPY";
      case LP_SYM_NZDUSD: return "NZDUSD";
      case LP_SYM_USDCAD: return "USDCAD";
      case LP_SYM_USDCHF: return "USDCHF";
      case LP_SYM_USDJPY: return "USDJPY";
   }
   return "";
}

int LP_CcyFromCode(const string code)
{
   if(code == "AUD") return LP_CCY_AUD;
   if(code == "CAD") return LP_CCY_CAD;
   if(code == "CHF") return LP_CCY_CHF;
   if(code == "EUR") return LP_CCY_EUR;
   if(code == "GBP") return LP_CCY_GBP;
   if(code == "JPY") return LP_CCY_JPY;
   if(code == "NZD") return LP_CCY_NZD;
   if(code == "USD") return LP_CCY_USD;
   return -1;
}

string LP_CcyCode(const int ccy)
{
   switch(ccy)
   {
      case LP_CCY_AUD: return "AUD";
      case LP_CCY_CAD: return "CAD";
      case LP_CCY_CHF: return "CHF";
      case LP_CCY_EUR: return "EUR";
      case LP_CCY_GBP: return "GBP";
      case LP_CCY_JPY: return "JPY";
      case LP_CCY_NZD: return "NZD";
      case LP_CCY_USD: return "USD";
   }
   return "UNK";
}

void LP_CanonicalBaseQuote(const string canonical, int &base_ccy, int &quote_ccy)
{
   base_ccy = -1;
   quote_ccy = -1;
   if(StringLen(canonical) < 6)
      return;
   base_ccy = LP_CcyFromCode(StringSubstr(canonical, 0, 3));
   quote_ccy = LP_CcyFromCode(StringSubstr(canonical, 3, 3));
}

bool LP_SymbolNameMatchesCanonical(const string symbol, const string canonical)
{
   if(StringLen(symbol) < 6)
      return false;
   return StringSubstr(symbol, 0, 6) == canonical;
}

int LP_SymbolIdFromBrokerSymbol(const string symbol)
{
   for(int i = 0; i < LP_SYMBOL_COUNT; i++)
   {
      string canonical = LP_CanonicalSymbol(i);
      if(LP_SymbolNameMatchesCanonical(symbol, canonical))
         return i;
   }
   return -1;
}

string LP_ResolveBrokerSymbol(const string canonical, const string suffix)
{
   string explicitName = canonical + suffix;
   if(SymbolInfoInteger(explicitName, SYMBOL_EXIST))
      return explicitName;

   if(SymbolInfoInteger(canonical, SYMBOL_EXIST))
      return canonical;

   int total = SymbolsTotal(false);
   for(int i = 0; i < total; i++)
   {
      string candidate = SymbolName(i, false);
      if(LP_SymbolNameMatchesCanonical(candidate, canonical))
         return candidate;
   }
   return explicitName;
}

ulong LP_SymbolUniverseHash(const string suffix)
{
   string payload = suffix;
   for(int i = 0; i < LP_SYMBOL_COUNT; i++)
      payload += "|" + LP_CanonicalSymbol(i);
   return LP_HashString(payload);
}

#endif // __LIMNI_PORTFOLIO_SYMBOL_UNIVERSE_MQH__
