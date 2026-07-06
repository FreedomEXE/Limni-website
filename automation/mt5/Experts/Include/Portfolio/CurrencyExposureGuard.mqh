/*-----------------------------------------------
  Currency-token exposure guard skeleton
-----------------------------------------------*/
#ifndef __LIMNI_PORTFOLIO_CURRENCY_EXPOSURE_GUARD_MQH__
#define __LIMNI_PORTFOLIO_CURRENCY_EXPOSURE_GUARD_MQH__

#include "..\\Core\\Types.mqh"

class LP_CurrencyExposureGuard
{
private:
   LP_CurrencyExposure m_exposure[LP_CCY_COUNT];

public:
   void Reset()
   {
      for(int i = 0; i < LP_CCY_COUNT; i++)
      {
         m_exposure[i].ccy = i;
         m_exposure[i].signed_lots = 0.0;
         m_exposure[i].gross_lots = 0.0;
         m_exposure[i].active_grid_count = 0;
         m_exposure[i].same_direction_grid_count = 0;
      }
   }

   bool AllowsCandidate(const LP_TradeIntent &intent, string &reason)
   {
      reason = "gate99n_guard_log_only";
      return true;
   }
};

#endif // __LIMNI_PORTFOLIO_CURRENCY_EXPOSURE_GUARD_MQH__
