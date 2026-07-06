/*-----------------------------------------------
  Strategy registry
-----------------------------------------------*/
#ifndef __LIMNI_PORTFOLIO_STRATEGY_REGISTRY_MQH__
#define __LIMNI_PORTFOLIO_STRATEGY_REGISTRY_MQH__

#include "..\\Core\\Types.mqh"
#include "IntentBus.mqh"
#include "TrendFollowLane.mqh"
#include "ReversalLane.mqh"

class LP_StrategyRegistry
{
private:
   LP_TrendFollowLane m_trend_follow;
   LP_ReversalLane m_reversal;
   bool m_enabled;

public:
   void Reset()
   {
      m_enabled = false;
      m_trend_follow.Reset();
   }

   void SetEnabled(const bool enabled)
   {
      m_enabled = enabled;
   }

   void Configure(const ulong config_hash)
   {
      m_trend_follow.Configure(config_hash);
   }

   int EvaluateAll(
      const LP_SignalSnapshot &snapshot,
      const LP_Config &config,
      LP_GridBook &grid_book,
      LP_IntentBus &bus
   )
   {
      if(!m_enabled)
         return 0;

      int emitted = 0;
      emitted += m_trend_follow.Evaluate(snapshot, config, grid_book, bus);
      emitted += m_reversal.Evaluate(snapshot, bus);
      return emitted;
   }
};

#endif // __LIMNI_PORTFOLIO_STRATEGY_REGISTRY_MQH__
