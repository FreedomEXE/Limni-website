/*-----------------------------------------------
  Account-level TP/trail/emergency-close guard skeleton
-----------------------------------------------*/
#ifndef __LIMNI_PORTFOLIO_ACCOUNT_HARVEST_GUARD_MQH__
#define __LIMNI_PORTFOLIO_ACCOUNT_HARVEST_GUARD_MQH__

#include "..\\Core\\Types.mqh"

class LP_AccountHarvestGuard
{
public:
   void Reset()
   {
   }

   bool RequiresAccountClose(const LP_PortfolioState &state, string &reason)
   {
      reason = "account_harvest_disabled_gate99n";
      return false;
   }
};

#endif // __LIMNI_PORTFOLIO_ACCOUNT_HARVEST_GUARD_MQH__
