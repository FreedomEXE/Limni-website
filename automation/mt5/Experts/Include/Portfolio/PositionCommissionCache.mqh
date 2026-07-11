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
   bool m_valid[];
   int m_count;
   int m_capacity;
   int m_generation;
   long m_hash_keys[];
   int m_hash_indices[];
   int m_hash_capacity;
   ulong m_cache_hit_count;
   ulong m_cache_miss_count;
   ulong m_history_read_count;
   ulong m_targeted_invalidation_count;
   ulong m_full_invalidation_count;
   ulong m_allocation_failure_count;
   bool m_exact_refresh_active;

   int HashSlot(const long position_id, const int capacity)
   {
      if(position_id <= 0 || capacity <= 0)
         return 0;
      ulong mixed = (ulong)position_id;
      mixed ^= mixed >> 33;
      mixed ^= mixed >> 17;
      mixed ^= mixed >> 9;
      return (int)(mixed % (ulong)capacity);
   }

   int HashCapacityForEntries(const int entries)
   {
      int capacity = 32;
      long target = (long)MathMax(1, entries) * 2;
      while((long)capacity < target && capacity <= 536870912)
         capacity *= 2;
      return capacity;
   }

   bool InsertHash(const long position_id, const int index)
   {
      if(position_id <= 0 || index < 0 || m_hash_capacity <= 0)
         return false;
      int slot = HashSlot(position_id, m_hash_capacity);
      for(int probe = 0; probe < m_hash_capacity; probe++)
      {
         if(m_hash_keys[slot] == 0 || m_hash_keys[slot] == position_id)
         {
            m_hash_keys[slot] = position_id;
            m_hash_indices[slot] = index;
            return true;
         }
         slot++;
         if(slot >= m_hash_capacity)
            slot = 0;
      }
      return false;
   }

   bool RebuildHash()
   {
      int requested_capacity = HashCapacityForEntries(m_count);
      if(ArrayResize(m_hash_keys, requested_capacity) != requested_capacity ||
         ArrayResize(m_hash_indices, requested_capacity) != requested_capacity)
      {
         m_hash_capacity = 0;
         m_allocation_failure_count++;
         return false;
      }
      m_hash_capacity = requested_capacity;
      for(int i = 0; i < m_hash_capacity; i++)
      {
         m_hash_keys[i] = 0;
         m_hash_indices[i] = -1;
      }

      for(int index = 0; index < m_count; index++)
         InsertHash(m_position_ids[index], index);
      return true;
   }

   void EnsureHashCapacity(const int desired_entries)
   {
      if(m_hash_capacity <= 0 ||
         (long)desired_entries * 10 >= (long)m_hash_capacity * 7)
         RebuildHash();
   }

   int FindIndex(const long position_id)
   {
      if(position_id <= 0)
         return -1;
      if(m_hash_capacity <= 0)
      {
         for(int i = 0; i < m_count; i++)
         {
            if(m_position_ids[i] == position_id)
               return i;
         }
         return -1;
      }
      int slot = HashSlot(position_id, m_hash_capacity);
      for(int probe = 0; probe < m_hash_capacity; probe++)
      {
         long indexed_id = m_hash_keys[slot];
         if(indexed_id == 0)
            return -1;
         if(indexed_id == position_id)
         {
            int index = m_hash_indices[slot];
            if(index >= 0 && index < m_count && m_position_ids[index] == position_id)
               return index;
            return -1;
         }
         slot++;
         if(slot >= m_hash_capacity)
            slot = 0;
      }
      return -1;
   }

   double ReadSelectedPositionCommission()
   {
      m_history_read_count++;
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
         commission += HistoryDealGetDouble(deal, DEAL_FEE);
      }
      return commission;
   }

public:
   void Reset()
   {
      ArrayResize(m_position_ids, 0);
      ArrayResize(m_commissions, 0);
      ArrayResize(m_seen_generation, 0);
      ArrayResize(m_valid, 0);
      ArrayResize(m_hash_keys, 0);
      ArrayResize(m_hash_indices, 0);
      m_count = 0;
      m_capacity = 0;
      m_generation = 0;
      m_hash_capacity = 0;
      m_cache_hit_count = 0;
      m_cache_miss_count = 0;
      m_history_read_count = 0;
      m_targeted_invalidation_count = 0;
      m_full_invalidation_count = 0;
      m_allocation_failure_count = 0;
      m_exact_refresh_active = false;
   }

   void BeginRefresh()
   {
      m_generation++;
      if(m_generation <= 0)
         m_generation = 1;
      m_exact_refresh_active = false;
   }

   void MarkExactRefresh()
   {
      m_exact_refresh_active = true;
   }

   double CommissionForSelectedPosition()
   {
      long position_id = (long)PositionGetInteger(POSITION_IDENTIFIER);
      if(position_id <= 0)
         return 0.0;

      int index = FindIndex(position_id);
      if(index >= 0 && m_valid[index])
      {
         m_cache_hit_count++;
         m_seen_generation[index] = m_generation;
         return m_commissions[index];
      }

      m_cache_miss_count++;
      double commission = ReadSelectedPositionCommission();
      bool inserted = false;
      if(index < 0)
      {
         index = m_count;
         int requested_count = m_count + 1;
         int requested_capacity = m_capacity;
         if(requested_count > requested_capacity)
            requested_capacity = requested_capacity <= 0 ? 32 : requested_capacity * 2;
         if(ArrayResize(m_position_ids, requested_count, requested_capacity) != requested_count ||
            ArrayResize(m_commissions, requested_count, requested_capacity) != requested_count ||
            ArrayResize(m_seen_generation, requested_count, requested_capacity) != requested_count ||
            ArrayResize(m_valid, requested_count, requested_capacity) != requested_count)
         {
            m_allocation_failure_count++;
            return commission;
         }
         m_count = requested_count;
         m_capacity = requested_capacity;
         inserted = true;
      }
      m_position_ids[index] = position_id;
      m_commissions[index] = commission;
      m_seen_generation[index] = m_generation;
      m_valid[index] = true;
      if(inserted)
      {
         EnsureHashCapacity(m_count);
         if(!InsertHash(position_id, index))
            RebuildHash();
      }
      return commission;
   }

   void Invalidate(const long position_id)
   {
      if(position_id <= 0)
         return;
      int index = FindIndex(position_id);
      if(index < 0 || !m_valid[index])
         return;
      m_valid[index] = false;
      m_targeted_invalidation_count++;
   }

   void InvalidateAll()
   {
      for(int i = 0; i < m_count; i++)
         m_valid[i] = false;
      m_full_invalidation_count++;
   }

   void EndRefresh()
   {
      if(!m_exact_refresh_active)
         return;
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
            m_valid[write_index] = m_valid[read_index];
         }
         write_index++;
      }

      m_count = write_index;
      if(ArrayResize(m_position_ids, m_count, m_capacity) != m_count ||
         ArrayResize(m_commissions, m_count, m_capacity) != m_count ||
         ArrayResize(m_seen_generation, m_count, m_capacity) != m_count ||
         ArrayResize(m_valid, m_count, m_capacity) != m_count)
         m_allocation_failure_count++;
      RebuildHash();
   }

   ulong CacheHitCount()
   {
      return m_cache_hit_count;
   }

   ulong CacheMissCount()
   {
      return m_cache_miss_count;
   }

   ulong HistoryReadCount()
   {
      return m_history_read_count;
   }

   ulong TargetedInvalidationCount()
   {
      return m_targeted_invalidation_count;
   }

   ulong FullInvalidationCount()
   {
      return m_full_invalidation_count;
   }

   ulong AllocationFailureCount()
   {
      return m_allocation_failure_count;
   }
};

#endif // __LIMNI_PORTFOLIO_POSITION_COMMISSION_CACHE_MQH__
