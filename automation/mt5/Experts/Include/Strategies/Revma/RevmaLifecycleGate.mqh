/*-----------------------------------------------
  Revma lifecycle/reentry gate
-----------------------------------------------*/
#ifndef __LIMNI_PORTFOLIO_REVMA_LIFECYCLE_GATE_MQH__
#define __LIMNI_PORTFOLIO_REVMA_LIFECYCLE_GATE_MQH__

#include "..\\..\\Core\\Types.mqh"
#include "..\\..\\Receipts\\ReceiptWriter.mqh"
#include "..\\RevmaTypes.mqh"

class LP_RevmaLifecycleGate
{
private:
   bool m_observed[LP_SYMBOL_COUNT];
   bool m_last_has_active_grid[LP_SYMBOL_COUNT];
   bool m_post_flat_waiting[LP_SYMBOL_COUNT];
   int m_observed_direction[LP_SYMBOL_COUNT];
   int m_observed_sleeve[LP_SYMBOL_COUNT];
   int m_observed_variant[LP_SYMBOL_COUNT];
   datetime m_observed_source_m1_time[LP_SYMBOL_COUNT];

   string ObservedStateText(const int symbol_id)
   {
      if(symbol_id < 0 || symbol_id >= LP_SYMBOL_COUNT || !m_observed[symbol_id])
         return "observed=false";
      return "observed=true" +
         "|observed_direction=" + LP_RevmaDirectionName(m_observed_direction[symbol_id]) +
         "|observed_sleeve=" + LP_RevmaSleeveName(m_observed_sleeve[symbol_id]) +
         "|observed_variant_id=" + IntegerToString(m_observed_variant[symbol_id]) +
         "|observed_source_m1_time=" + LP_Stamp(m_observed_source_m1_time[symbol_id]);
   }

   string Detail(
      const LP_RevmaSignal &signal,
      const bool has_active_grid,
      const string reason
   )
   {
      return "system_id=" + LP_REVMA_SYSTEM_ID +
         "|source_m1_time=" + LP_Stamp(signal.source_m1_time) +
         "|direction=" + LP_RevmaDirectionName(signal.direction) +
         "|sleeve=" + LP_RevmaSleeveName(signal.sleeve) +
         "|variant_id=" + IntegerToString(signal.variant_id) +
         "|q_profile_id=" + signal.q_profile_id +
         "|has_active_grid=" + LP_BoolText(has_active_grid) +
         "|post_harvest_waiting=" + LP_BoolText(m_post_flat_waiting[signal.symbol_id]) +
         "|" + ObservedStateText(signal.symbol_id) +
         "|reason=" + reason;
   }

   void RecordObservedState(const LP_RevmaSignal &signal)
   {
      int symbol_id = signal.symbol_id;
      if(symbol_id < 0 || symbol_id >= LP_SYMBOL_COUNT)
         return;
      m_observed[symbol_id] = true;
      m_observed_direction[symbol_id] = signal.direction;
      m_observed_sleeve[symbol_id] = signal.sleeve;
      m_observed_variant[symbol_id] = signal.variant_id;
      m_observed_source_m1_time[symbol_id] = signal.source_m1_time;
   }

   bool IdentityChanged(const LP_RevmaSignal &signal)
   {
      int symbol_id = signal.symbol_id;
      if(symbol_id < 0 || symbol_id >= LP_SYMBOL_COUNT || !m_observed[symbol_id])
         return false;
      return signal.direction != m_observed_direction[symbol_id] ||
         signal.sleeve != m_observed_sleeve[symbol_id] ||
         signal.variant_id != m_observed_variant[symbol_id];
   }

public:
   void Reset()
   {
      for(int i = 0; i < LP_SYMBOL_COUNT; i++)
      {
         m_observed[i] = false;
         m_last_has_active_grid[i] = false;
         m_post_flat_waiting[i] = false;
         m_observed_direction[i] = LP_SIDE_NONE;
         m_observed_sleeve[i] = LP_REVMA_SLEEVE_NONE;
         m_observed_variant[i] = LP_VARIANT_NONE;
         m_observed_source_m1_time[i] = 0;
      }
   }

   void WriteReceipt(
      LP_ReceiptWriter &receipts,
      const LP_RevmaSignal &signal,
      const string status,
      const string reason,
      const bool has_active_grid
   )
   {
      if(!receipts.ShouldBuildKnownCompactReceipt(LP_RECEIPT_REVMA_REENTRY_GATE, status))
         return;

      receipts.Write(
         LP_RECEIPT_REVMA_REENTRY_GATE,
         signal.symbol,
         status,
         Detail(signal, has_active_grid, reason),
         LP_LANE_REVMA,
         signal.variant_id,
         0,
         0,
         0,
         0
      );
   }

   bool Evaluate(
      const LP_RevmaSignal &signal,
      const bool has_active_grid,
      LP_ReceiptWriter &receipts,
      bool &birth_allowed
   )
   {
      birth_allowed = false;
      int symbol_id = signal.symbol_id;
      if(symbol_id < 0 || symbol_id >= LP_SYMBOL_COUNT)
         return false;

      if(has_active_grid)
      {
         if(!m_observed[symbol_id])
         {
            WriteReceipt(receipts, signal, "startup_state_observed", "existing_grid_attached", true);
            RecordObservedState(signal);
         }
         m_last_has_active_grid[symbol_id] = true;
         m_post_flat_waiting[symbol_id] = false;
         return true;
      }

      if(!m_observed[symbol_id])
      {
         WriteReceipt(receipts, signal, "startup_state_observed", "flat_attach_observe_current_state", false);
         RecordObservedState(signal);
         WriteReceipt(receipts, signal, "birth_blocked_waiting_for_fresh_state", "startup_current_state_not_birth_event", false);
         m_last_has_active_grid[symbol_id] = false;
         return false;
      }

      if(m_last_has_active_grid[symbol_id])
      {
         RecordObservedState(signal);
         m_last_has_active_grid[symbol_id] = false;
         m_post_flat_waiting[symbol_id] = true;
         WriteReceipt(receipts, signal, "post_harvest_reentry_blocked", "grid_transitioned_flat_waiting_for_fresh_state", false);
         return false;
      }

      if(IdentityChanged(signal))
      {
         WriteReceipt(receipts, signal, "fresh_state_change_detected", "current_identity_differs_from_observed_state", false);
         RecordObservedState(signal);
         m_post_flat_waiting[symbol_id] = false;
         birth_allowed = true;
         return true;
      }

      if(m_post_flat_waiting[symbol_id])
         WriteReceipt(receipts, signal, "post_harvest_reentry_blocked", "same_state_after_flat_close", false);
      else
         WriteReceipt(receipts, signal, "birth_blocked_waiting_for_fresh_state", "same_state_as_startup_observation", false);
      return false;
   }
};

#endif // __LIMNI_PORTFOLIO_REVMA_LIFECYCLE_GATE_MQH__
