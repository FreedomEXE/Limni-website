/*-----------------------------------------------
  Per-run open-position commission cache
-----------------------------------------------*/
#ifndef __LIMNI_PORTFOLIO_POSITION_COMMISSION_CACHE_MQH__
#define __LIMNI_PORTFOLIO_POSITION_COMMISSION_CACHE_MQH__

class LP_PositionCommissionCache
{
private:
   long m_position_ids[];
   double m_commissions[];
   int m_seen_generation[];
   int m_count;
   int m_generation;

   int FindIndex(const long position_id)
   {
      for(int i = 0; i < m_count; i++)
      {
         if(m_position_ids[i] == position_id)
            return i;
      }
      return -1;
   }

   double ReadSelectedPositionCommission()
   {
      long position_id = (long)PositionGetInteger(POSITION_IDENTIFIER);
      if(position_id <= 0)
         return 0.0;
      if(!HistorySelectByPosition(position_id))
         return 0.0;

      double commission = 0.0;
      int deals = HistoryDealsTotal();
      for(int i = 0; i < deals; i++)
      {
         ulong deal = HistoryDealGetTicket(i);
         if(deal == 0)
            continue;
         commission += HistoryDealGetDouble(deal, DEAL_COMMISSION);
      }
      return commission;
   }

public:
   void Reset()
   {
      ArrayResize(m_position_ids, 0);
      ArrayResize(m_commissions, 0);
      ArrayResize(m_seen_generation, 0);
      m_count = 0;
      m_generation = 0;
   }

   void BeginRefresh()
   {
      m_generation++;
      if(m_generation <= 0)
         m_generation = 1;
   }

   double CommissionForSelectedPosition()
   {
      long position_id = (long)PositionGetInteger(POSITION_IDENTIFIER);
      if(position_id <= 0)
         return 0.0;

      int index = FindIndex(position_id);
      if(index >= 0)
      {
         m_seen_generation[index] = m_generation;
         return m_commissions[index];
      }

      double commission = ReadSelectedPositionCommission();
      index = m_count;
      m_count++;
      ArrayResize(m_position_ids, m_count, m_count);
      ArrayResize(m_commissions, m_count, m_count);
      ArrayResize(m_seen_generation, m_count, m_count);
      m_position_ids[index] = position_id;
      m_commissions[index] = commission;
      m_seen_generation[index] = m_generation;
      return commission;
   }

   void EndRefresh()
   {
      int write_index = 0;
      for(int read_index = 0; read_index < m_count; read_index++)
      {
         if(m_seen_generation[read_index] != m_generation)
            continue;

         if(write_index != read_index)
         {
            m_position_ids[write_index] = m_position_ids[read_index];
            m_commissions[write_index] = m_commissions[read_index];
            m_seen_generation[write_index] = m_seen_generation[read_index];
         }
         write_index++;
      }

      m_count = write_index;
      ArrayResize(m_position_ids, m_count, m_count);
      ArrayResize(m_commissions, m_count, m_count);
      ArrayResize(m_seen_generation, m_count, m_count);
   }
};

#endif // __LIMNI_PORTFOLIO_POSITION_COMMISSION_CACHE_MQH__
