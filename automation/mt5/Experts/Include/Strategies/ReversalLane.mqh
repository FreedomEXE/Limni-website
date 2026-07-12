/*-----------------------------------------------
  Reversal strategy lane stub
-----------------------------------------------*/
#ifndef __LIMNI_PORTFOLIO_REVERSAL_LANE_MQH__
#define __LIMNI_PORTFOLIO_REVERSAL_LANE_MQH__

#include "..\\Core\\Types.mqh"
#include "IntentBus.mqh"

class LP_ReversalLane
{
public:
   void Reset()
   {
   }

   int Evaluate(const LP_SignalSnapshot &snapshot, LP_IntentBus &bus)
   {
      if(!snapshot.valid)
         return 0;
      // Gate 99N deliberately emits no trade intents.
      return 0;
   }
};

#endif // __LIMNI_PORTFOLIO_REVERSAL_LANE_MQH__
