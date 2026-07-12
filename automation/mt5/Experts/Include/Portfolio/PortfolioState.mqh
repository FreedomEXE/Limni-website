/*-----------------------------------------------
  Portfolio state helpers
-----------------------------------------------*/
#ifndef __LIMNI_PORTFOLIO_PORTFOLIO_STATE_MQH__
#define __LIMNI_PORTFOLIO_PORTFOLIO_STATE_MQH__

#include "..\\Core\\Types.mqh"

bool LP_HedgingAccount()
{
   return (ENUM_ACCOUNT_MARGIN_MODE)AccountInfoInteger(ACCOUNT_MARGIN_MODE) == ACCOUNT_MARGIN_MODE_RETAIL_HEDGING;
}

#endif // __LIMNI_PORTFOLIO_PORTFOLIO_STATE_MQH__
