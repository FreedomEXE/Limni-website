/*-----------------------------------------------
  Execution retcode helpers
-----------------------------------------------*/
#ifndef __LIMNI_PORTFOLIO_RETCODE_CLASSIFIER_MQH__
#define __LIMNI_PORTFOLIO_RETCODE_CLASSIFIER_MQH__

string LP_RetcodeName(const uint retcode)
{
   if(retcode == TRADE_RETCODE_DONE)
      return "TRADE_RETCODE_DONE";
   if(retcode == TRADE_RETCODE_PLACED)
      return "TRADE_RETCODE_PLACED";
   if(retcode == TRADE_RETCODE_REJECT)
      return "TRADE_RETCODE_REJECT";
   if(retcode == TRADE_RETCODE_INVALID)
      return "TRADE_RETCODE_INVALID";
   if(retcode == TRADE_RETCODE_MARKET_CLOSED)
      return "TRADE_RETCODE_MARKET_CLOSED";
   if(retcode == TRADE_RETCODE_NO_MONEY)
      return "TRADE_RETCODE_NO_MONEY";
   return "TRADE_RETCODE_" + IntegerToString((int)retcode);
}

#endif // __LIMNI_PORTFOLIO_RETCODE_CLASSIFIER_MQH__
