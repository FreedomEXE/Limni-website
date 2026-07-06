/*-----------------------------------------------
  Intent bus: strategies write here, risk reads here
-----------------------------------------------*/
#ifndef __LIMNI_PORTFOLIO_INTENT_BUS_MQH__
#define __LIMNI_PORTFOLIO_INTENT_BUS_MQH__

#include "..\\Core\\Types.mqh"

class LP_IntentBus
{
private:
   LP_TradeIntent m_intents[];
   int m_count;
   int m_capacity;

public:
   void Reset()
   {
      ArrayResize(m_intents, 0);
      m_count = 0;
      m_capacity = 0;
   }

   void Clear()
   {
      m_count = 0;
   }

   bool Add(const LP_TradeIntent &intent)
   {
      if(m_count >= m_capacity)
      {
         m_capacity = m_capacity <= 0 ? 16 : m_capacity * 2;
         ArrayResize(m_intents, m_capacity, m_capacity);
      }
      m_intents[m_count] = intent;
      m_count++;
      return true;
   }

   int Count()
   {
      return m_count;
   }

   bool Get(const int index, LP_TradeIntent &intent)
   {
      if(index < 0 || index >= m_count)
         return false;
      intent = m_intents[index];
      return true;
   }
};

#endif // __LIMNI_PORTFOLIO_INTENT_BUS_MQH__
