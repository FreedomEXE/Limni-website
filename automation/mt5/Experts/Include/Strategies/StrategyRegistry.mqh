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
   }

   void SetEnabled(const bool enabled)
   {
      m_enabled = enabled;
   }

   int EvaluateAll(const LP_SignalSnapshot &snapshot, LP_IntentBus &bus)
   {
      if(!m_enabled)
         return 0;

      int emitted = 0;
      emitted += m_trend_follow.Evaluate(snapshot, bus);
      emitted += m_reversal.Evaluate(snapshot, bus);
      return emitted;
   }
};

#endif // __LIMNI_PORTFOLIO_STRATEGY_REGISTRY_MQH__
