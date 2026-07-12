/*-----------------------------------------------
  Lightweight tick cache
-----------------------------------------------*/
#ifndef __LIMNI_PORTFOLIO_TICK_BAR_CACHE_MQH__
#define __LIMNI_PORTFOLIO_TICK_BAR_CACHE_MQH__

#include "..\\Core\\Types.mqh"

class LP_TickBarCache
{
public:
   bool RefreshTick(const string symbol, LP_TickSnapshot &snapshot)
   {
      snapshot.symbol = symbol;
      snapshot.time = 0;
      snapshot.bid = 0.0;
      snapshot.ask = 0.0;
      snapshot.spread_points = 0;
      snapshot.valid = false;

      MqlTick tick;
      if(!SymbolInfoTick(symbol, tick))
         return false;

      snapshot.time = tick.time;
      snapshot.bid = tick.bid;
      snapshot.ask = tick.ask;
      double point = SymbolInfoDouble(symbol, SYMBOL_POINT);
      if(point > 0.0 && tick.ask > 0.0 && tick.bid > 0.0)
         snapshot.spread_points = (int)MathRound((tick.ask - tick.bid) / point);
      snapshot.valid = tick.bid > 0.0 && tick.ask > 0.0;
      return snapshot.valid;
   }
};

#endif // __LIMNI_PORTFOLIO_TICK_BAR_CACHE_MQH__
