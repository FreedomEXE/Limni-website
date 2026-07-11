/*-----------------------------------------------
  Revma v001 locked mean-reversion grid strategy
-----------------------------------------------*/
#ifndef __LIMNI_PORTFOLIO_REVMA_GRID_SLEEVE_MQH__
#define __LIMNI_PORTFOLIO_REVMA_GRID_SLEEVE_MQH__

#include "..\\Core\\Types.mqh"
#include "..\\Portfolio\\GridBook.mqh"
#include "..\\Receipts\\ReceiptWriter.mqh"
#include "IntentBus.mqh"
#include "RevmaTypes.mqh"
#include "Revma\\RevmaDiscoveryTypes.mqh"
#include "Revma\\RevmaPathGeometry.mqh"
#include "Revma\\RevmaShadowPortfolio.mqh"
#include "Revma\\RevmaRealPortfolio.mqh"
#include "Revma\\RevmaDiscoveryTelemetry.mqh"
#include "Revma\\RevmaDiscoveryTelemetryBridge.mqh"
#include "Revma\\RevmaGridProtectionManager.mqh"

struct LP_RevmaGridBirthSnapshot
{
   bool valid;
   ulong grid_key;
   datetime source_m1_time;
   int symbol_id;
   int direction;
   int raw_direction;
   int anchor_relation;
   int sleeve;
   int variant_id;
   string add_policy;
   datetime birth_time;
   double q;
   double q_pips;
   double anchor;
   double price;
   double anchor_distance_q;
   double stoch;
   int trend_state;
   double raw_score;
   double trend_score;
   double exhaustion_score;
   double confidence;
   int q_profile;
   int max_m1_bars;
   string q_profile_id;
   string system_id;
   string formula_id;
   ulong formula_hash;
   string pair_direction_formula_id;
   ulong pair_direction_formula_hash;
   int add_sequence;
   int adverse_add_count;
   int favorable_add_count;
};

void LP_ResetRevmaGridBirthSnapshot(LP_RevmaGridBirthSnapshot &birth)
{
   birth.valid = false;
   birth.grid_key = 0;
   birth.source_m1_time = 0;
   birth.symbol_id = -1;
   birth.direction = LP_SIDE_NONE;
   birth.raw_direction = LP_SIDE_NONE;
   birth.anchor_relation = 0;
   birth.sleeve = LP_REVMA_SLEEVE_NONE;
   birth.variant_id = LP_VARIANT_NONE;
   birth.add_policy = "";
   birth.birth_time = 0;
   birth.q = 0.0;
   birth.q_pips = 0.0;
   birth.anchor = 0.0;
   birth.price = 0.0;
   birth.anchor_distance_q = 0.0;
   birth.stoch = EMPTY_VALUE;
   birth.trend_state = 0;
   birth.raw_score = 0.0;
   birth.trend_score = 0.0;
   birth.exhaustion_score = 0.0;
   birth.confidence = 0.0;
   birth.q_profile = LP_REVMA_Q_PROFILE_MEDIUM;
   birth.max_m1_bars = 50000;
   birth.q_profile_id = "";
   birth.system_id = LP_REVMA_SYSTEM_ID;
   birth.formula_id = LP_REVMA_FORMULA_ID;
   birth.formula_hash = LP_RevmaFormulaHash();
   birth.pair_direction_formula_id = LimniPairDirectionFormulaId();
   birth.pair_direction_formula_hash = LimniPairDirectionFormulaHash();
   birth.add_sequence = 0;
   birth.adverse_add_count = 0;
   birth.favorable_add_count = 0;
}

#include "Revma\\RevmaResearchTelemetry.mqh"

struct LP_RevmaPendingLifecycle
{
   bool valid;
   ulong intent_id;
   int event_type;
   ulong grid_key;
   string add_type;
   LP_RevmaSignal signal;
   int position_count_before;
   double lots_before;
   double grid_floating_pnl_before;
};

void LP_ResetRevmaPendingLifecycle(LP_RevmaPendingLifecycle &pending)
{
   pending.valid = false;
   pending.intent_id = 0;
   pending.event_type = LP_RESEARCH_LIFECYCLE_NONE;
   pending.grid_key = 0;
   pending.add_type = "";
   LP_ResetRevmaSignal(pending.signal);
   pending.position_count_before = 0;
   pending.lots_before = 0.0;
   pending.grid_floating_pnl_before = 0.0;
}

struct LP_RevmaGridCloseLatch
{
   bool valid;
   ulong grid_key;
   string close_reason;
   datetime started_at;
   int original_ticket_count;
   int attempted_count;
   int closed_count;
   int remaining_ticket_count;
   int close_cap;
};

void LP_ResetRevmaGridCloseLatch(LP_RevmaGridCloseLatch &latch)
{
   latch.valid = false;
   latch.grid_key = 0;
   latch.close_reason = "";
   latch.started_at = 0;
   latch.original_ticket_count = 0;
   latch.attempted_count = 0;
   latch.closed_count = 0;
   latch.remaining_ticket_count = 0;
   latch.close_cap = 0;
}

class LP_RevmaGridSleeve
{
private:
   ulong m_next_intent_id;
   ulong m_strategy_version_hash;
   ulong m_config_hash;
   LP_RevmaGridBirthSnapshot m_births[];
   int m_birth_count;
   int m_birth_capacity;
   string m_visual_text;
   double m_visual_centerline_price;
   string m_last_divergent_add_text;
   bool m_dashboard_screenshot_requested;
   LP_RevmaGridProtectionManager m_protection_manager;
   LP_RevmaRealPortfolio m_discovery_real_portfolio;
   LP_RevmaShadowPortfolio m_discovery_shadow_portfolio;
   LP_RevmaDiscoveryTelemetry m_discovery_telemetry;
   bool m_discovery_reset_valid;
   bool m_discovery_initialization_attempted;
   bool m_discovery_initialized;
   bool m_discovery_finalized;
   bool m_discovery_valid;
   string m_discovery_invalid_reason;
   datetime m_discovery_last_completed_m1;
   LP_RevmaCompletedM1Snapshot
      m_discovery_last_cohort[LP_SYMBOL_COUNT];
   bool m_discovery_last_cohort_valid;
   ulong m_discovery_last_cohort_hash;
   ulong m_discovery_last_cohort_signal_hash;
   ulong m_discovery_last_cohort_strategy_hash;
   ulong m_discovery_telemetry_cycle_started[
      LP_REVMA_DISCOVERY_BRANCH_COUNT];
   ulong m_discovery_telemetry_cycle_sealed[
      LP_REVMA_DISCOVERY_BRANCH_COUNT];
   ulong m_discovery_first_infeasibility_cycle[
      LP_REVMA_DISCOVERY_BRANCH_COUNT];
   int m_discovery_telemetry_close_owner[
      LP_REVMA_DISCOVERY_BRANCH_COUNT];
   bool m_discovery_telemetry_close_complete[
      LP_REVMA_DISCOVERY_BRANCH_COUNT];
   bool m_discovery_first_divergence_emitted;
   LP_RevmaResearchTelemetry m_research_telemetry;
   bool m_state_loaded;
   bool m_state_persistence_enabled;
   ulong m_last_blocked_birth_hash;
   LP_RevmaPendingLifecycle m_pending_lifecycle[];
   int m_pending_lifecycle_count;
   int m_pending_lifecycle_capacity;
   int m_pending_lifecycle_max_active;
   int m_pending_lifecycle_max_allocated;
   LP_RevmaGridCloseLatch m_close_latches[];
   int m_close_latch_count;
   int m_close_latch_capacity;
   ulong m_persistence_write_count;
   ulong m_persistence_failure_count;
   ulong m_persistence_total_microseconds;
   ulong m_persistence_max_microseconds;
   ulong m_birth_persistence_write_count;
   ulong m_birth_persistence_total_microseconds;
   ulong m_birth_persistence_max_microseconds;
   ulong m_close_latch_persistence_write_count;
   ulong m_close_latch_persistence_total_microseconds;
   ulong m_close_latch_persistence_max_microseconds;
   ulong m_persistence_deferred_mutation_count;
   ulong m_persistence_deferred_maintenance_total_microseconds;
   ulong m_persistence_deferred_maintenance_max_microseconds;
   ulong m_persistence_final_checkpoint_count;
   bool m_birth_persistence_dirty;
   bool m_close_latch_persistence_dirty;
   bool m_birth_persistence_dirty_before_final_checkpoint;
   bool m_close_latch_persistence_dirty_before_final_checkpoint;

   string StateFolder()
   {
      return "LimniPortfolioEA_State";
   }

   string StateFileName()
   {
      return StateFolder() + "\\revma_grid_birth_state_A" +
         (string)AccountInfoInteger(ACCOUNT_LOGIN) +
          "_C" + (string)m_config_hash + ".csv";
   }

   string CloseLatchStateFileName()
   {
      return StateFolder() + "\\revma_grid_close_latch_A" +
         (string)AccountInfoInteger(ACCOUNT_LOGIN) +
         "_C" + (string)m_config_hash + ".csv";
   }

   bool TesterRuntime()
   {
      return LP_IsTesterRuntime();
   }

   string PersistencePolicyName()
   {
      if(!m_state_persistence_enabled)
         return "disabled";
      return TesterRuntime() ? "tester_deferred_final_checkpoint" : "live_immediate_snapshot";
   }

   void ObservePersistenceWrite(const bool birth_snapshot, const ulong elapsed)
   {
      m_persistence_write_count++;
      m_persistence_total_microseconds += elapsed;
      if(elapsed > m_persistence_max_microseconds)
         m_persistence_max_microseconds = elapsed;

      if(birth_snapshot)
      {
         m_birth_persistence_write_count++;
         m_birth_persistence_total_microseconds += elapsed;
         if(elapsed > m_birth_persistence_max_microseconds)
            m_birth_persistence_max_microseconds = elapsed;
         return;
      }

      m_close_latch_persistence_write_count++;
      m_close_latch_persistence_total_microseconds += elapsed;
      if(elapsed > m_close_latch_persistence_max_microseconds)
         m_close_latch_persistence_max_microseconds = elapsed;
   }

   int AnchorRelationFromPrice(const double price, const double anchor)
   {
      if(price == EMPTY_VALUE || anchor == EMPTY_VALUE || price <= 0.0 || anchor <= 0.0)
         return 0;
      if(price > anchor)
         return 1;
      if(price < anchor)
         return -1;
      return 0;
   }

   string AnchorBucketMetadata(const int direction, const int anchor_relation, const string prefix)
   {
      return "|" + prefix + "_anchor_bucket=" + LP_RevmaAnchorBucketName(direction, anchor_relation);
   }

   string StochBucketMetadata(const double stoch, const string prefix)
   {
      return "|" + prefix + "_q_stochastic_raw=" + DoubleToString(stoch, 2) +
         "|" + prefix + "_q_stochastic_bucket=" + LP_RevmaStochasticBucketName(stoch);
   }

   ulong BlockedBirthHash(
      const LP_RevmaSignal &signal,
      const LP_GridInventoryRow &grid,
      const LP_RevmaGridBirthSnapshot &birth
   )
   {
      int active_age_minutes = 0;
      if(birth.valid && birth.birth_time > 0)
         active_age_minutes = (int)MathMax(0, ((long)TimeCurrent() - (long)birth.birth_time) / 60);
      int active_age_bucket = active_age_minutes < 60 ? active_age_minutes / 15 : 4 + active_age_minutes / 60;
      int active_pnl_bucket = (int)MathFloor(grid.floating_pnl / 25.0);
      ulong hash = 1469598103934665603;
      LP_HashMixInt(hash, signal.symbol_id);
      LP_HashMixInt(hash, signal.direction);
      LP_HashMixULong(hash, grid.grid_key);
      LP_HashMixInt(hash, grid.direction);
      LP_HashMixInt(hash, signal.anchor_relation);
      LP_HashMixULong(hash, LP_HashString(LP_RevmaStochasticBucketName(signal.stoch)));
      LP_HashMixInt(hash, active_age_bucket);
      LP_HashMixInt(hash, active_pnl_bucket);
      return hash;
   }

   ulong NextIntentId()
   {
      ulong id = m_next_intent_id;
      m_next_intent_id++;
      return id;
   }

   bool SleeveEnabled(const int sleeve)
   {
      return sleeve == LP_REVMA_SLEEVE_REVERSION;
   }

   string AddPolicyName(const LP_RevmaSignal &signal)
   {
      if(signal.sleeve == LP_REVMA_SLEEVE_REVERSION)
         return signal.direction > 0 ? "reversion_add_lower" : "reversion_add_higher";
      return "none";
   }

   int SleeveFromVariant(const int variant_id)
   {
      if(variant_id == LP_VARIANT_REVMA_REVERSION)
         return LP_REVMA_SLEEVE_REVERSION;
      return LP_REVMA_SLEEVE_NONE;
   }

   string AddPolicyNameFromFrozen(const int sleeve, const int direction)
   {
      if(sleeve == LP_REVMA_SLEEVE_REVERSION)
         return direction > 0 ? "reversion_add_lower" : "reversion_add_higher";
      return "none";
   }

   int FindBirthIndex(const ulong grid_key)
   {
      if(grid_key <= 0)
         return -1;
      for(int i = 0; i < m_birth_count; i++)
      {
         if(m_births[i].valid && m_births[i].grid_key == grid_key)
            return i;
      }
      return -1;
   }

   int FindCloseLatchIndex(const ulong grid_key)
   {
      if(grid_key <= 0)
         return -1;
      for(int i = 0; i < m_close_latch_count; i++)
      {
         if(m_close_latches[i].valid && m_close_latches[i].grid_key == grid_key)
            return i;
      }
      return -1;
   }

   bool FindCloseLatch(const ulong grid_key, LP_RevmaGridCloseLatch &latch)
   {
      LP_ResetRevmaGridCloseLatch(latch);
      int index = FindCloseLatchIndex(grid_key);
      if(index < 0)
         return false;
      latch = m_close_latches[index];
      return latch.valid;
   }

   bool HasCloseLatch(const ulong grid_key)
   {
      return FindCloseLatchIndex(grid_key) >= 0;
   }

   bool RememberBirth(const ulong grid_key, const LP_RevmaSignal &signal, const string add_policy)
   {
      if(grid_key <= 0)
         return false;

      int index = FindBirthIndex(grid_key);
      if(index < 0)
      {
         if(m_birth_count >= m_birth_capacity)
         {
            int next_capacity = m_birth_capacity <= 0 ? 32 :
               m_birth_capacity * 2;
            if(next_capacity <= m_birth_capacity ||
               ArrayResize(m_births, next_capacity) < next_capacity)
               return false;
            m_birth_capacity = next_capacity;
         }
         index = m_birth_count;
         m_birth_count++;
      }

      LP_ResetRevmaGridBirthSnapshot(m_births[index]);
      m_births[index].valid = true;
      m_births[index].grid_key = grid_key;
      m_births[index].source_m1_time = signal.source_m1_time;
      m_births[index].symbol_id = signal.symbol_id;
      m_births[index].direction = signal.direction;
      m_births[index].raw_direction = signal.raw_direction;
      m_births[index].anchor_relation = signal.anchor_relation;
      m_births[index].sleeve = signal.sleeve;
      m_births[index].variant_id = signal.variant_id;
      m_births[index].add_policy = add_policy;
      m_births[index].birth_time = TimeCurrent();
      m_births[index].q = signal.q;
      m_births[index].q_pips = signal.q_pips;
      m_births[index].anchor = signal.anchor;
      m_births[index].price = signal.price;
      m_births[index].anchor_distance_q = signal.anchor_distance_q;
      m_births[index].stoch = signal.stoch;
      m_births[index].trend_state = signal.trend_state;
      m_births[index].raw_score = signal.raw_score;
      m_births[index].trend_score = signal.trend_score;
      m_births[index].exhaustion_score = signal.exhaustion_score;
      m_births[index].confidence = signal.confidence;
      m_births[index].q_profile = signal.q_profile;
      m_births[index].max_m1_bars = signal.max_m1_bars;
      m_births[index].q_profile_id = signal.q_profile_id;
      m_births[index].system_id = signal.system_id;
      m_births[index].formula_id = signal.formula_id;
      m_births[index].formula_hash = signal.formula_hash;
      m_births[index].pair_direction_formula_id = signal.pair_direction_formula_id;
      m_births[index].pair_direction_formula_hash = signal.pair_direction_formula_hash;
      return true;
   }

   bool FindBirth(const ulong grid_key, LP_RevmaGridBirthSnapshot &birth)
   {
      LP_ResetRevmaGridBirthSnapshot(birth);
      int index = FindBirthIndex(grid_key);
      if(index < 0)
         return false;
      birth = m_births[index];
      return birth.valid;
   }

   int FindPendingLifecycleIndex(const ulong intent_id)
   {
      if(intent_id <= 0)
         return -1;
      for(int i = 0; i < m_pending_lifecycle_count; i++)
      {
         if(m_pending_lifecycle[i].valid && m_pending_lifecycle[i].intent_id == intent_id)
            return i;
      }
      return -1;
   }

   bool RememberPendingLifecycle(
      const LP_TradeIntent &intent,
      const LP_RevmaSignal &signal,
      const string add_type,
      const int position_count_before,
      const double lots_before,
      const double grid_floating_pnl_before
   )
   {
      if(intent.research_lifecycle_event == LP_RESEARCH_LIFECYCLE_NONE)
         return true;
      if(intent.intent_id <= 0)
         return false;

      int index = FindPendingLifecycleIndex(intent.intent_id);
      if(index < 0)
      {
         if(m_pending_lifecycle_count >= m_pending_lifecycle_capacity)
         {
            int next_capacity = m_pending_lifecycle_capacity <= 0 ? 32 :
               m_pending_lifecycle_capacity * 2;
            int resized = ArrayResize(m_pending_lifecycle, next_capacity);
            if(resized < next_capacity)
               return false;
            m_pending_lifecycle_capacity = next_capacity;
            if(next_capacity > m_pending_lifecycle_max_allocated)
               m_pending_lifecycle_max_allocated = next_capacity;
         }
         index = m_pending_lifecycle_count;
         m_pending_lifecycle_count++;
         if(m_pending_lifecycle_count > m_pending_lifecycle_max_active)
            m_pending_lifecycle_max_active = m_pending_lifecycle_count;
      }

      LP_ResetRevmaPendingLifecycle(m_pending_lifecycle[index]);
      m_pending_lifecycle[index].valid = true;
      m_pending_lifecycle[index].intent_id = intent.intent_id;
      m_pending_lifecycle[index].event_type = intent.research_lifecycle_event;
      m_pending_lifecycle[index].grid_key = intent.grid_key;
      m_pending_lifecycle[index].add_type = add_type;
      m_pending_lifecycle[index].signal = signal;
      m_pending_lifecycle[index].position_count_before = position_count_before;
      m_pending_lifecycle[index].lots_before = lots_before;
      m_pending_lifecycle[index].grid_floating_pnl_before = grid_floating_pnl_before;
      return true;
   }

   bool TakePendingLifecycle(const ulong intent_id, LP_RevmaPendingLifecycle &pending)
   {
      LP_ResetRevmaPendingLifecycle(pending);
      int index = FindPendingLifecycleIndex(intent_id);
      if(index < 0)
         return false;
      pending = m_pending_lifecycle[index];
      bool valid = pending.valid;
      int last_index = m_pending_lifecycle_count - 1;
      if(index != last_index)
         m_pending_lifecycle[index] = m_pending_lifecycle[last_index];
      LP_ResetRevmaPendingLifecycle(m_pending_lifecycle[last_index]);
      m_pending_lifecycle_count--;
      return valid;
   }

   string ExecutionTruthMetadata(
      const LP_RevmaPendingLifecycle &pending,
      const LP_TradeExecutionResult &execution,
      const string outcome,
      const string payload_contract,
      const string reservation_metadata
   )
   {
      string metadata = "lifecycle_event=" + LP_ResearchLifecycleEventName(pending.event_type) +
         "|execution_outcome=" + outcome +
         "|grid_key=" + (string)pending.grid_key +
         "|symbol=" + pending.signal.symbol +
         "|direction=" + LP_RevmaDirectionName(pending.signal.direction) +
         "|lane_id=" + IntegerToString(LP_LANE_REVMA) +
         "|variant_id=" + IntegerToString(pending.signal.variant_id) +
         "|add_type=" + pending.add_type +
         "|intent_id=" + (string)pending.intent_id +
         "|actual_deal_ticket=" + (string)execution.deal_ticket +
         "|actual_position_ticket=" + (string)execution.position_ticket +
         "|actual_lots=" + DoubleToString(execution.executed_lots, 2) +
         "|actual_price=" + DoubleToString(execution.executed_price, 8) +
         "|partial_fill=" + LP_BoolText(execution.partial_fill) +
         "|position_count_before=" + IntegerToString(pending.position_count_before) +
         "|lots_before=" + DoubleToString(pending.lots_before, 2) +
         "|grid_floating_pnl_before=" + DoubleToString(pending.grid_floating_pnl_before, 2) +
         "|execution_detail=" + execution.detail +
         reservation_metadata;
      if(payload_contract != "inline_v1")
      {
         int candidate_receipt_kind = pending.event_type == LP_RESEARCH_LIFECYCLE_GRID_BIRTH ?
            LP_RECEIPT_REVMA_GRID_BIRTH : LP_RECEIPT_REVMA_GRID_ADD;
         metadata += "|payload_contract=" + payload_contract +
            "|candidate_payload_role=reference" +
            "|candidate_payload_ref_receipt_type=" + LP_ReceiptKindName(candidate_receipt_kind) +
            "|candidate_payload_ref_status=intent_created" +
            "|candidate_payload_ref_intent_id=" + (string)pending.intent_id;
      }
      else
         metadata += "|" + BirthMetadata(pending.signal);
      return metadata;
   }

   void CompactBirths()
   {
      int write_index = 0;
      for(int read_index = 0; read_index < m_birth_count; read_index++)
      {
         if(!m_births[read_index].valid || m_births[read_index].grid_key <= 0)
            continue;
         if(write_index != read_index)
            m_births[write_index] = m_births[read_index];
         write_index++;
      }
      m_birth_count = write_index;
      if(m_birth_capacity < m_birth_count)
         m_birth_capacity = m_birth_count;
   }

   bool PersistBirths(LP_ReceiptWriter &receipts, const string cause, const bool force_write)
   {
      if(!m_state_persistence_enabled)
         return true;

      ulong started_at = GetMicrosecondCount();
      m_birth_persistence_dirty = true;
      CompactBirths();
      if(TesterRuntime() && !force_write)
      {
         ulong elapsed = GetMicrosecondCount() - started_at;
         m_persistence_deferred_mutation_count++;
         m_persistence_deferred_maintenance_total_microseconds += elapsed;
         if(elapsed > m_persistence_deferred_maintenance_max_microseconds)
            m_persistence_deferred_maintenance_max_microseconds = elapsed;
         return true;
      }

      FolderCreate(StateFolder(), FILE_COMMON);
      int handle = FileOpen(StateFileName(), FILE_WRITE | FILE_CSV | FILE_ANSI | FILE_COMMON, ',');
      if(handle == INVALID_HANDLE)
      {
         m_persistence_failure_count++;
         receipts.Write(
            LP_RECEIPT_ERROR,
            "",
            "revma_lifecycle_persistence_failed",
            "cause=" + cause + "|state_file=" + StateFileName() + "|error=" + IntegerToString(GetLastError()),
            LP_LANE_REVMA,
            0,
            0,
            0,
            0,
            0
         );
         Print(LP_EA_NAME, " revma lifecycle persistence failed: ", StateFileName());
         return false;
      }

      if(FileWrite(
         handle,
         "grid_key",
         "config_hash",
         "formula_hash",
         "symbol_id",
         "direction",
         "raw_direction",
         "anchor_relation",
         "sleeve",
         "variant_id",
         "add_policy",
         "birth_time",
         "source_m1_time",
         "q",
         "q_pips",
         "anchor",
         "price",
         "anchor_distance_q",
         "stoch",
         "trend_state",
         "raw_score",
         "trend_score",
         "exhaustion_score",
         "confidence",
         "q_profile",
         "max_m1_bars",
         "q_profile_id",
         "system_id",
         "formula_id",
         "pair_direction_formula_id",
         "pair_direction_formula_hash",
         "add_sequence",
         "adverse_add_count",
         "favorable_add_count"
      ) == 0)
      {
         m_persistence_failure_count++;
         FileClose(handle);
         receipts.Write(LP_RECEIPT_ERROR, "", "revma_lifecycle_persistence_failed", "cause=" + cause + "|stage=write_header|state_file=" + StateFileName() + "|error=" + IntegerToString(GetLastError()), LP_LANE_REVMA, 0, 0, 0, 0, 0);
         Print(LP_EA_NAME, " revma lifecycle persistence header write failed: ", StateFileName());
         return false;
      }

      for(int i = 0; i < m_birth_count; i++)
      {
         if(!m_births[i].valid || m_births[i].grid_key <= 0)
            continue;
         if(FileWrite(
            handle,
            (string)m_births[i].grid_key,
            (string)m_config_hash,
            (string)m_births[i].formula_hash,
            IntegerToString(m_births[i].symbol_id),
            IntegerToString(m_births[i].direction),
            IntegerToString(m_births[i].raw_direction),
            IntegerToString(m_births[i].anchor_relation),
            IntegerToString(m_births[i].sleeve),
            IntegerToString(m_births[i].variant_id),
            m_births[i].add_policy,
            LP_Stamp(m_births[i].birth_time),
            LP_Stamp(m_births[i].source_m1_time),
            DoubleToString(m_births[i].q, 8),
            DoubleToString(m_births[i].q_pips, 2),
            DoubleToString(m_births[i].anchor, 8),
            DoubleToString(m_births[i].price, 8),
            DoubleToString(m_births[i].anchor_distance_q, 8),
            DoubleToString(m_births[i].stoch, 8),
            IntegerToString(m_births[i].trend_state),
            DoubleToString(m_births[i].raw_score, 8),
            DoubleToString(m_births[i].trend_score, 8),
            DoubleToString(m_births[i].exhaustion_score, 8),
            DoubleToString(m_births[i].confidence, 8),
            IntegerToString(m_births[i].q_profile),
            IntegerToString(m_births[i].max_m1_bars),
            m_births[i].q_profile_id,
            m_births[i].system_id,
            m_births[i].formula_id,
            m_births[i].pair_direction_formula_id,
            (string)m_births[i].pair_direction_formula_hash,
            IntegerToString(m_births[i].add_sequence),
            IntegerToString(m_births[i].adverse_add_count),
            IntegerToString(m_births[i].favorable_add_count)
         ) == 0)
         {
            m_persistence_failure_count++;
            FileClose(handle);
            receipts.Write(LP_RECEIPT_ERROR, "", "revma_lifecycle_persistence_failed", "cause=" + cause + "|stage=write_row|grid_key=" + (string)m_births[i].grid_key + "|state_file=" + StateFileName() + "|error=" + IntegerToString(GetLastError()), LP_LANE_REVMA, 0, m_births[i].grid_key, 0, 0, 0);
            Print(LP_EA_NAME, " revma lifecycle persistence row write failed: ", StateFileName());
            return false;
         }
      }

      FileClose(handle);
      ulong elapsed = GetMicrosecondCount() - started_at;
      ObservePersistenceWrite(true, elapsed);
      m_birth_persistence_dirty = false;
      return true;
   }

   bool PersistBirths(LP_ReceiptWriter &receipts, const string cause)
   {
      return PersistBirths(receipts, cause, false);
   }

   void CompactCloseLatches()
   {
      int write_index = 0;
      for(int read_index = 0; read_index < m_close_latch_count; read_index++)
      {
         if(!m_close_latches[read_index].valid || m_close_latches[read_index].grid_key <= 0)
            continue;
         if(write_index != read_index)
            m_close_latches[write_index] = m_close_latches[read_index];
         write_index++;
      }
      m_close_latch_count = write_index;
      if(m_close_latch_capacity < m_close_latch_count)
         m_close_latch_capacity = m_close_latch_count;
   }

   bool PersistCloseLatches(LP_ReceiptWriter &receipts, const string cause, const bool force_write)
   {
      if(!m_state_persistence_enabled)
         return true;

      ulong started_at = GetMicrosecondCount();
      m_close_latch_persistence_dirty = true;
      CompactCloseLatches();
      if(TesterRuntime() && !force_write)
      {
         ulong elapsed = GetMicrosecondCount() - started_at;
         m_persistence_deferred_mutation_count++;
         m_persistence_deferred_maintenance_total_microseconds += elapsed;
         if(elapsed > m_persistence_deferred_maintenance_max_microseconds)
            m_persistence_deferred_maintenance_max_microseconds = elapsed;
         return true;
      }
      FolderCreate(StateFolder(), FILE_COMMON);
      int handle = FileOpen(CloseLatchStateFileName(), FILE_WRITE | FILE_CSV | FILE_ANSI | FILE_COMMON, ',');
      if(handle == INVALID_HANDLE)
      {
         m_persistence_failure_count++;
         receipts.Write(LP_RECEIPT_ERROR, "", "revma_lifecycle_persistence_failed", "cause=" + cause + "|state_file=" + CloseLatchStateFileName() + "|error=" + IntegerToString(GetLastError()), LP_LANE_REVMA, 0, 0, 0, 0, 0);
         return false;
      }

      if(FileWrite(handle, "grid_key", "close_reason", "started_at", "original_ticket_count", "attempted_count", "closed_count", "remaining_ticket_count", "close_cap") == 0)
      {
         m_persistence_failure_count++;
         FileClose(handle);
         receipts.Write(LP_RECEIPT_ERROR, "", "revma_lifecycle_persistence_failed", "cause=" + cause + "|stage=write_close_latch_header|state_file=" + CloseLatchStateFileName() + "|error=" + IntegerToString(GetLastError()), LP_LANE_REVMA, 0, 0, 0, 0, 0);
         return false;
      }

      for(int i = 0; i < m_close_latch_count; i++)
      {
         LP_RevmaGridCloseLatch latch = m_close_latches[i];
         if(!latch.valid || latch.grid_key <= 0)
            continue;
         if(FileWrite(handle, (string)latch.grid_key, latch.close_reason, LP_Stamp(latch.started_at), IntegerToString(latch.original_ticket_count), IntegerToString(latch.attempted_count), IntegerToString(latch.closed_count), IntegerToString(latch.remaining_ticket_count), IntegerToString(latch.close_cap)) == 0)
         {
            m_persistence_failure_count++;
            FileClose(handle);
            receipts.Write(LP_RECEIPT_ERROR, "", "revma_lifecycle_persistence_failed", "cause=" + cause + "|stage=write_close_latch_row|grid_key=" + (string)latch.grid_key + "|state_file=" + CloseLatchStateFileName() + "|error=" + IntegerToString(GetLastError()), LP_LANE_REVMA, 0, latch.grid_key, 0, 0, 0);
            return false;
         }
      }
      FileClose(handle);
      ulong elapsed = GetMicrosecondCount() - started_at;
      ObservePersistenceWrite(false, elapsed);
      m_close_latch_persistence_dirty = false;
      return true;
   }

   bool PersistCloseLatches(LP_ReceiptWriter &receipts, const string cause)
   {
      return PersistCloseLatches(receipts, cause, false);
   }

   bool StartCloseLatch(
      const LP_GridInventoryRow &grid,
      const string close_reason,
      const LP_Config &config,
      LP_ReceiptWriter &receipts,
      LP_RevmaGridCloseLatch &latch
   )
   {
      LP_ResetRevmaGridCloseLatch(latch);
      if(grid.grid_key <= 0 || (close_reason != "grid_tp" && close_reason != "grid_sl"))
         return false;

      int index = FindCloseLatchIndex(grid.grid_key);
      bool started = index < 0;
      if(index < 0)
      {
         if(m_close_latch_count >= m_close_latch_capacity)
         {
            int next_capacity = m_close_latch_capacity <= 0 ? 16 :
               m_close_latch_capacity * 2;
            int resized = ArrayResize(m_close_latches, next_capacity);
            if(resized < next_capacity)
               return false;
            m_close_latch_capacity = next_capacity;
         }
         index = m_close_latch_count;
         m_close_latch_count++;
         LP_ResetRevmaGridCloseLatch(m_close_latches[index]);
         m_close_latches[index].valid = true;
         m_close_latches[index].grid_key = grid.grid_key;
         m_close_latches[index].close_reason = close_reason;
         m_close_latches[index].started_at = TimeCurrent();
         m_close_latches[index].original_ticket_count = grid.position_count;
      }

      m_close_latches[index].remaining_ticket_count = grid.position_count;
      m_close_latches[index].close_cap = config.max_close_positions_per_step;
      latch = m_close_latches[index];
      if(started && !PersistCloseLatches(receipts, "grid_close_latched", false))
         return false;
      return started;
   }

   int CountLiveGridTickets(const LP_TradePlan &plan)
   {
      int remaining = 0;
      for(int i = PositionsTotal() - 1; i >= 0; i--)
      {
         ulong ticket = PositionGetTicket(i);
         if(ticket == 0 || !PositionSelectByTicket(ticket))
            continue;
         if((long)PositionGetInteger(POSITION_MAGIC) != plan.magic)
            continue;
         if(StringLen(plan.symbol) > 0 && PositionGetString(POSITION_SYMBOL) != plan.symbol)
            continue;
         remaining++;
      }
      return remaining;
   }

   bool UpdateCloseLatchProgress(
      const LP_TradePlan &plan,
      const LP_TradeExecutionResult &execution,
      LP_ReceiptWriter &receipts
   )
   {
      if(plan.action != LP_INTENT_CLOSE_GRID || plan.grid_key <= 0)
         return true;
      int index = FindCloseLatchIndex(plan.grid_key);
      if(index < 0)
         return false;

      LP_RevmaGridCloseLatch latch = m_close_latches[index];
      if(execution.attempted_positions < 0 || execution.closed_positions < 0 ||
         latch.attempted_count > 2147483647 - execution.attempted_positions ||
         latch.closed_count > 2147483647 - execution.closed_positions)
         return false;
      latch.attempted_count += execution.attempted_positions;
      latch.closed_count += execution.closed_positions;
      latch.remaining_ticket_count = CountLiveGridTickets(plan);
      if(execution.close_limit > 0)
         latch.close_cap = execution.close_limit;
      m_close_latches[index] = latch;
      if(!PersistCloseLatches(receipts, "grid_close_progress"))
         return false;
      receipts.Write(
         LP_RECEIPT_REVMA_GRID_EXIT,
         plan.symbol,
         "revma_grid_close_progress",
         "grid_key=" + (string)latch.grid_key +
            "|close_reason=" + latch.close_reason +
            "|original_ticket_count=" + IntegerToString(latch.original_ticket_count) +
            "|attempted_count=" + IntegerToString(latch.attempted_count) +
            "|closed_count=" + IntegerToString(latch.closed_count) +
            "|remaining_ticket_count=" + IntegerToString(latch.remaining_ticket_count) +
            "|close_cap=" + IntegerToString(latch.close_cap),
         LP_LANE_REVMA,
         plan.variant_id,
         latch.grid_key,
         plan.intent_id,
         plan.decision_id,
         plan.magic
      );
      return true;
   }

   bool ClearCloseLatch(const ulong grid_key, LP_ReceiptWriter &receipts, const string cause)
   {
      int index = FindCloseLatchIndex(grid_key);
      if(index < 0)
         return true;
      m_close_latches[index].valid = false;
      return PersistCloseLatches(receipts, cause);
   }

   bool UpsertBirthSnapshot(const LP_RevmaGridBirthSnapshot &birth)
   {
      if(!birth.valid || birth.grid_key <= 0)
         return false;
      int index = FindBirthIndex(birth.grid_key);
      if(index < 0)
      {
         if(m_birth_count >= m_birth_capacity)
         {
            int next_capacity = m_birth_capacity <= 0 ? 32 :
               m_birth_capacity * 2;
            if(next_capacity <= m_birth_capacity ||
               ArrayResize(m_births, next_capacity) < next_capacity)
               return false;
            m_birth_capacity = next_capacity;
         }
         index = m_birth_count;
         m_birth_count++;
      }
      m_births[index] = birth;
      return true;
   }

   bool RemoveBirth(const ulong grid_key)
   {
      int index = FindBirthIndex(grid_key);
      if(index < 0)
         return false;
      m_births[index].valid = false;
      return true;
   }

   bool RecordAdd(const ulong grid_key, const string add_type, LP_ReceiptWriter &receipts)
   {
      int index = FindBirthIndex(grid_key);
      if(index < 0)
         return false;
      if(m_births[index].add_sequence >= 2147483647 ||
         (add_type == "adverse" &&
          m_births[index].adverse_add_count >= 2147483647) ||
         (add_type == "favorable" &&
          m_births[index].favorable_add_count >= 2147483647) ||
         (add_type != "adverse" && add_type != "favorable"))
         return false;
      m_births[index].add_sequence++;
      if(add_type == "adverse")
         m_births[index].adverse_add_count++;
      else if(add_type == "favorable")
         m_births[index].favorable_add_count++;
      return PersistBirths(receipts, "executed_add", false);
   }

   bool LoadOnePersistedBirth(
      LP_ReceiptWriter &receipts,
      LP_GridBook &grid_book,
      const string grid_key_text,
      const string config_hash_text,
      const string formula_hash_text,
      const string direction_text,
      const string raw_direction_text,
      const string anchor_relation_text,
      const string sleeve_text,
      const string variant_id_text,
      const string add_policy,
      const string birth_time_text,
      const string source_m1_time_text,
      const string q_text,
      const string q_pips_text,
      const string anchor_text,
      const string price_text,
      const string anchor_distance_q_text,
      const string stoch_text,
      const string trend_state_text,
      const string raw_score_text,
      const string trend_score_text,
      const string exhaustion_score_text,
      const string confidence_text,
      const string q_profile_text,
      const string max_m1_bars_text,
      const string q_profile_id,
      const string system_id,
      const string formula_id,
      const string pair_direction_formula_id,
      const string pair_direction_formula_hash_text,
      const string add_sequence_text,
      const string adverse_add_count_text,
      const string favorable_add_count_text
   )
   {
      ulong grid_key = (ulong)StringToInteger(grid_key_text);
      if(grid_key <= 0)
         return false;

      if(config_hash_text != (string)m_config_hash ||
         formula_hash_text != (string)LP_RevmaFormulaHash())
      {
         receipts.Write(
            LP_RECEIPT_REVMA_GRID_EXIT,
            "",
            "revma_birth_state_fail_closed",
            "reason=hash_mismatch|grid_key=" + grid_key_text +
               "|state_config_hash=" + config_hash_text +
               "|active_config_hash=" + (string)m_config_hash +
               "|state_formula_hash=" + formula_hash_text +
               "|active_formula_hash=" + (string)LP_RevmaFormulaHash(),
            LP_LANE_REVMA,
            0,
            grid_key,
            0,
            0,
            0
         );
         return false;
      }

      LP_GridInventoryRow grid;
      if(!grid_book.FindGridKey(grid_key, grid))
         return false;

      LP_RevmaGridBirthSnapshot birth;
      LP_ResetRevmaGridBirthSnapshot(birth);
      birth.valid = true;
      birth.grid_key = grid_key;
      birth.symbol_id = grid.symbol_id;
      birth.direction = (int)StringToInteger(direction_text);
      birth.raw_direction = (int)StringToInteger(raw_direction_text);
      birth.anchor_relation = (int)StringToInteger(anchor_relation_text);
      birth.sleeve = (int)StringToInteger(sleeve_text);
      birth.variant_id = (int)StringToInteger(variant_id_text);
      birth.add_policy = add_policy;
      birth.birth_time = StringToTime(birth_time_text);
      birth.source_m1_time = StringToTime(source_m1_time_text);
      birth.q = StringToDouble(q_text);
      birth.q_pips = StringToDouble(q_pips_text);
      birth.anchor = StringToDouble(anchor_text);
      birth.price = StringToDouble(price_text);
      birth.anchor_distance_q = StringToDouble(anchor_distance_q_text);
      birth.stoch = StringToDouble(stoch_text);
      birth.trend_state = (int)StringToInteger(trend_state_text);
      birth.raw_score = StringToDouble(raw_score_text);
      birth.trend_score = StringToDouble(trend_score_text);
      birth.exhaustion_score = StringToDouble(exhaustion_score_text);
      birth.confidence = StringToDouble(confidence_text);
      birth.q_profile = (int)StringToInteger(q_profile_text);
      birth.max_m1_bars = (int)StringToInteger(max_m1_bars_text);
      birth.q_profile_id = q_profile_id;
      birth.system_id = system_id;
      birth.formula_id = formula_id;
      birth.formula_hash = LP_RevmaFormulaHash();
      birth.pair_direction_formula_id = pair_direction_formula_id;
      birth.pair_direction_formula_hash = LimniPairDirectionFormulaHash();
      birth.add_sequence = (int)StringToInteger(add_sequence_text);
      birth.adverse_add_count = (int)StringToInteger(adverse_add_count_text);
      birth.favorable_add_count = (int)StringToInteger(favorable_add_count_text);
      return UpsertBirthSnapshot(birth);
   }

   int LoadPersistedCloseLatchesInternal(LP_GridBook &grid_book, LP_ReceiptWriter &receipts)
   {
      if(!m_state_persistence_enabled)
         return 0;

      int handle = FileOpen(CloseLatchStateFileName(), FILE_READ | FILE_CSV | FILE_ANSI | FILE_COMMON, ',');
      if(handle == INVALID_HANDLE)
         return 0;

      int loaded = 0;
      bool header = true;
      while(!FileIsEnding(handle))
      {
         string grid_key_text = FileReadString(handle);
         if(grid_key_text == "" && FileIsEnding(handle))
            break;
         string close_reason = FileReadString(handle);
         string started_at_text = FileReadString(handle);
         string original_ticket_count_text = FileReadString(handle);
         string attempted_count_text = FileReadString(handle);
         string closed_count_text = FileReadString(handle);
         string remaining_ticket_count_text = FileReadString(handle);
         string close_cap_text = FileReadString(handle);
         if(header)
         {
            header = false;
            if(grid_key_text == "grid_key")
               continue;
         }

         ulong grid_key = (ulong)StringToInteger(grid_key_text);
         LP_GridInventoryRow grid;
         if(grid_key <= 0 ||
            (close_reason != "grid_tp" && close_reason != "grid_sl") ||
            !grid_book.FindGridKey(grid_key, grid))
            continue;

         if(m_close_latch_count >= m_close_latch_capacity)
         {
            m_close_latch_capacity = m_close_latch_capacity <= 0 ? 16 : m_close_latch_capacity * 2;
            ArrayResize(m_close_latches, m_close_latch_capacity);
         }
         LP_RevmaGridCloseLatch latch;
         LP_ResetRevmaGridCloseLatch(latch);
         latch.valid = true;
         latch.grid_key = grid_key;
         latch.close_reason = close_reason;
         latch.started_at = StringToTime(started_at_text);
         latch.original_ticket_count = (int)StringToInteger(original_ticket_count_text);
         latch.attempted_count = (int)StringToInteger(attempted_count_text);
         latch.closed_count = (int)StringToInteger(closed_count_text);
         latch.remaining_ticket_count = grid.position_count;
         latch.close_cap = (int)StringToInteger(close_cap_text);
         m_close_latches[m_close_latch_count] = latch;
         m_close_latch_count++;
         loaded++;
      }
      FileClose(handle);

      if(loaded > 0)
      {
         receipts.Write(
            LP_RECEIPT_REVMA_GRID_EXIT,
            "",
            "revma_grid_close_latch_loaded",
            "source=common_file|loaded_latches=" + IntegerToString(loaded) +
               "|state_file=" + CloseLatchStateFileName(),
            LP_LANE_REVMA,
            0,
            0,
            0,
            0,
            0
         );
      }
      return loaded;
   }

   int LoadPersistedBirthsInternal(LP_GridBook &grid_book, LP_ReceiptWriter &receipts)
   {
      m_state_loaded = true;
      if(!m_state_persistence_enabled)
         return 0;

      int handle = FileOpen(StateFileName(), FILE_READ | FILE_CSV | FILE_ANSI | FILE_COMMON, ',');
      if(handle == INVALID_HANDLE)
         return LoadPersistedCloseLatchesInternal(grid_book, receipts);

      int loaded = 0;
      bool header = true;
      while(!FileIsEnding(handle))
      {
         string grid_key_text = FileReadString(handle);
         if(grid_key_text == "" && FileIsEnding(handle))
            break;

         string config_hash_text = FileReadString(handle);
         string formula_hash_text = FileReadString(handle);
         string symbol_id_text = FileReadString(handle);
         string direction_text = FileReadString(handle);
         string raw_direction_text = FileReadString(handle);
         string anchor_relation_text = FileReadString(handle);
         string sleeve_text = FileReadString(handle);
         string variant_id_text = FileReadString(handle);
         string add_policy = FileReadString(handle);
         string birth_time_text = FileReadString(handle);
         string source_m1_time_text = FileReadString(handle);
         string q_text = FileReadString(handle);
         string q_pips_text = FileReadString(handle);
         string anchor_text = FileReadString(handle);
         string price_text = FileReadString(handle);
         string anchor_distance_q_text = FileReadString(handle);
         string stoch_text = FileReadString(handle);
         string trend_state_text = FileReadString(handle);
         string raw_score_text = FileReadString(handle);
         string trend_score_text = FileReadString(handle);
         string exhaustion_score_text = FileReadString(handle);
         string confidence_text = FileReadString(handle);
         string q_profile_text = FileReadString(handle);
         string max_m1_bars_text = FileReadString(handle);
         string q_profile_id = FileReadString(handle);
         string system_id = FileReadString(handle);
         string formula_id = FileReadString(handle);
         string pair_direction_formula_id = FileReadString(handle);
         string pair_direction_formula_hash_text = FileReadString(handle);
         string add_sequence_text = FileReadString(handle);
         string adverse_add_count_text = FileReadString(handle);
         string favorable_add_count_text = FileReadString(handle);

         if(header)
         {
            header = false;
            if(grid_key_text == "grid_key")
               continue;
         }

         if(LoadOnePersistedBirth(
            receipts,
            grid_book,
            grid_key_text,
            config_hash_text,
            formula_hash_text,
            direction_text,
            raw_direction_text,
            anchor_relation_text,
            sleeve_text,
            variant_id_text,
            add_policy,
            birth_time_text,
            source_m1_time_text,
            q_text,
            q_pips_text,
            anchor_text,
            price_text,
            anchor_distance_q_text,
            stoch_text,
            trend_state_text,
            raw_score_text,
            trend_score_text,
            exhaustion_score_text,
            confidence_text,
            q_profile_text,
            max_m1_bars_text,
            q_profile_id,
            system_id,
            formula_id,
            pair_direction_formula_id,
            pair_direction_formula_hash_text,
            add_sequence_text,
            adverse_add_count_text,
            favorable_add_count_text
         ))
         {
            loaded++;
         }
      }

      FileClose(handle);
      if(loaded > 0)
      {
         receipts.Write(
            LP_RECEIPT_REVMA_GRID_BIRTH,
            "",
            "revma_birth_state_loaded",
            "source=common_file|loaded_births=" + IntegerToString(loaded) +
               "|state_file=" + StateFileName(),
            LP_LANE_REVMA,
            0,
            0,
            0,
            0,
            0
         );
      }
      LoadPersistedCloseLatchesInternal(grid_book, receipts);
      return loaded;
   }

   int CleanupClosedBirthsInternal(LP_GridBook &grid_book, LP_ReceiptWriter &receipts)
   {
      int removed = 0;
      for(int i = 0; i < m_birth_count; i++)
      {
         if(!m_births[i].valid || m_births[i].grid_key <= 0)
            continue;
         if(grid_book.HasGridKey(m_births[i].grid_key))
            continue;
         ulong removed_key = m_births[i].grid_key;
         LP_RevmaGridCloseLatch close_latch;
         string terminal_reason = FindCloseLatch(removed_key, close_latch) ?
            close_latch.close_reason : "manual_or_external";
         m_research_telemetry.RecordGridClosed(m_births[i], terminal_reason);
         m_births[i].valid = false;
         if(!ClearCloseLatch(removed_key, receipts, "grid_close_flat"))
            InvalidateDiscovery("close_latch_flat_persistence_failed");
         removed++;
         receipts.Write(
            LP_RECEIPT_REVMA_GRID_EXIT,
            "",
            "revma_birth_state_stale_cleanup",
            "grid_key=" + (string)removed_key + "|reason=open_grid_not_found",
            LP_LANE_REVMA,
            0,
            removed_key,
            0,
            0,
            0
         );
      }
      if(removed > 0 && !PersistBirths(receipts, "stale_cleanup"))
         InvalidateDiscovery("stale_birth_cleanup_persistence_failed");
      return removed;
   }

   string BirthSnapshotMetadata(const LP_RevmaGridBirthSnapshot &birth)
   {
      if(!birth.valid)
         return "|birth_snapshot=missing_in_memory";

      return "|birth_snapshot=in_memory" +
         "|birth_direction=" + LP_RevmaDirectionName(birth.direction) +
         "|birth_raw_direction=" + LP_RevmaDirectionName(birth.raw_direction) +
         "|birth_anchor_location=" + LP_RevmaAnchorRelationName(birth.anchor_relation) +
         "|birth_sleeve=" + LP_RevmaSleeveName(birth.sleeve) +
         "|birth_setup_type=" + LP_RevmaSleeveName(birth.sleeve) +
         "|birth_variant_id=" + IntegerToString(birth.variant_id) +
         "|birth_add_policy=" + birth.add_policy +
         "|birth_q=" + DoubleToString(birth.q, 8) +
         "|birth_q_pips=" + DoubleToString(birth.q_pips, 2) +
         "|birth_anchor=" + DoubleToString(birth.anchor, 5) +
         "|birth_price=" + DoubleToString(birth.price, 5) +
         "|birth_anchor_distance_q=" + DoubleToString(birth.anchor_distance_q, 6) +
         "|birth_stoch=" + DoubleToString(birth.stoch, 2) +
         AnchorBucketMetadata(birth.direction, birth.anchor_relation, "birth") +
         StochBucketMetadata(birth.stoch, "birth") +
         "|birth_trend_state=" + IntegerToString(birth.trend_state) +
         "|birth_raw_score=" + DoubleToString(birth.raw_score, 6) +
         "|birth_trend_score=" + DoubleToString(birth.trend_score, 6) +
         "|birth_exhaustion_score=" + DoubleToString(birth.exhaustion_score, 6) +
         "|birth_confidence=" + DoubleToString(birth.confidence, 6) +
         "|birth_q_profile=" + LP_RevmaQProfileName(birth.q_profile) +
         "|birth_max_m1_bars=" + IntegerToString(birth.max_m1_bars) +
         "|birth_q_profile_id=" + birth.q_profile_id +
         "|birth_system_id=" + birth.system_id +
         "|birth_formula_id=" + birth.formula_id +
         "|birth_formula_hash=" + (string)birth.formula_hash +
         "|birth_pair_direction_formula_id=" + birth.pair_direction_formula_id +
         "|birth_pair_direction_formula_hash=" + (string)birth.pair_direction_formula_hash +
         "|birth_time=" + LP_Stamp(birth.birth_time) +
         "|add_sequence=" + IntegerToString(birth.add_sequence) +
         "|adverse_add_count=" + IntegerToString(birth.adverse_add_count) +
         "|favorable_add_count=" + IntegerToString(birth.favorable_add_count) +
         "|birth_source_m1_time=" + LP_Stamp(birth.source_m1_time);
   }

   string BirthMetadata(const LP_RevmaSignal &signal)
   {
      return "system_id=" + signal.system_id +
         "|system_name=" + LP_REVMA_SYSTEM_NAME +
         "|formula_id=" + signal.formula_id +
         "|formula_hash=" + (string)signal.formula_hash +
         "|pair_direction_formula_id=" + signal.pair_direction_formula_id +
         "|pair_direction_formula_hash=" + (string)signal.pair_direction_formula_hash +
         "|q_profile=" + LP_RevmaQProfileName(signal.q_profile) +
         "|max_m1_bars=" + IntegerToString(signal.max_m1_bars) +
         "|q_profile_id=" + signal.q_profile_id +
         "|direction=" + LP_RevmaDirectionName(signal.direction) +
         "|raw_direction=" + LP_RevmaDirectionName(signal.raw_direction) +
         "|anchor_location=" + LP_RevmaAnchorRelationName(signal.anchor_relation) +
         "|sleeve=" + LP_RevmaSleeveName(signal.sleeve) +
         "|setup_type=" + LP_RevmaSleeveName(signal.sleeve) +
         "|locked_setup_type=" + LP_RevmaSleeveName(signal.sleeve) +
         "|q_at_entry=" + DoubleToString(signal.q, 8) +
         "|q_pips=" + DoubleToString(signal.q_pips, 2) +
         "|entry_anchor=" + DoubleToString(signal.anchor, 5) +
         "|entry_price=" + DoubleToString(signal.price, 5) +
         "|entry_anchor_distance_q=" + DoubleToString(signal.anchor_distance_q, 6) +
         "|entry_stoch=" + DoubleToString(signal.stoch, 2) +
         AnchorBucketMetadata(signal.direction, signal.anchor_relation, "birth") +
         StochBucketMetadata(signal.stoch, "birth") +
         "|entry_trend_state=" + IntegerToString(signal.trend_state) +
         "|entry_raw_score=" + DoubleToString(signal.raw_score, 6) +
         "|entry_trend_score=" + DoubleToString(signal.trend_score, 6) +
         "|entry_exhaustion_score=" + DoubleToString(signal.exhaustion_score, 6) +
         "|entry_confidence=" + DoubleToString(signal.confidence, 6) +
         "|source_m1_time=" + LP_Stamp(signal.source_m1_time);
   }

   string CurrentSignalMetadata(const LP_RevmaSignal &signal)
   {
      return "|current_direction=" + LP_RevmaDirectionName(signal.direction) +
         "|current_raw_direction=" + LP_RevmaDirectionName(signal.raw_direction) +
         "|current_anchor_location=" + LP_RevmaAnchorRelationName(signal.anchor_relation) +
         "|current_sleeve=" + LP_RevmaSleeveName(signal.sleeve) +
         "|current_setup_type=" + LP_RevmaSleeveName(signal.sleeve) +
         "|current_variant_id=" + IntegerToString(signal.variant_id) +
         "|current_formula_id=" + signal.formula_id +
         "|current_formula_hash=" + (string)signal.formula_hash +
         "|current_pair_direction_formula_id=" + signal.pair_direction_formula_id +
         "|current_pair_direction_formula_hash=" + (string)signal.pair_direction_formula_hash +
         "|current_q=" + DoubleToString(signal.q, 8) +
         "|current_q_pips=" + DoubleToString(signal.q_pips, 2) +
         "|current_anchor=" + DoubleToString(signal.anchor, 5) +
         "|current_price=" + DoubleToString(signal.price, 5) +
         "|current_anchor_distance_q=" + DoubleToString(signal.anchor_distance_q, 6) +
         "|current_stoch=" + DoubleToString(signal.stoch, 2) +
         AnchorBucketMetadata(signal.direction, signal.anchor_relation, "current") +
         StochBucketMetadata(signal.stoch, "current") +
         "|current_trend_state=" + IntegerToString(signal.trend_state) +
         "|current_raw_score=" + DoubleToString(signal.raw_score, 6) +
         "|current_trend_score=" + DoubleToString(signal.trend_score, 6) +
         "|current_exhaustion_score=" + DoubleToString(signal.exhaustion_score, 6) +
         "|current_confidence=" + DoubleToString(signal.confidence, 6) +
         "|current_q_profile=" + LP_RevmaQProfileName(signal.q_profile) +
         "|current_max_m1_bars=" + IntegerToString(signal.max_m1_bars) +
         "|current_q_profile_id=" + signal.q_profile_id +
         "|current_source_m1_time=" + LP_Stamp(signal.source_m1_time);
   }

   bool CurrentMatchesFrozenIdentity(
      const LP_RevmaSignal &signal,
      const int frozen_variant_id,
      const int frozen_direction
   )
   {
      return signal.variant_id == frozen_variant_id && signal.direction == frozen_direction;
   }

   string FrozenGridMetadata(
      const LP_RevmaSignal &signal,
      const LP_GridInventoryRow &grid,
      const LP_RevmaGridBirthSnapshot &birth,
      const int frozen_variant_id,
      const int frozen_direction,
      const int frozen_sleeve,
      const string frozen_add_policy,
      const string add_type,
      const double spacing_q,
      const double spacing_price,
      const double next_add_level,
      const double net_open_money_after_fees_before
   )
   {
      double distance_from_avg_entry_q = 0.0;
      if(spacing_q > 0.0 && grid.avg_entry_price > 0.0)
         distance_from_avg_entry_q = (signal.price - grid.avg_entry_price) / spacing_q;
      double spacing_value_q = spacing_q > 0.0 ? spacing_price / spacing_q : 0.0;
      int basket_age_minutes = 0;
      if(birth.valid && birth.birth_time > 0)
         basket_age_minutes = (int)MathMax(0, ((long)TimeCurrent() - (long)birth.birth_time) / 60);

      bool current_matches = CurrentMatchesFrozenIdentity(signal, frozen_variant_id, frozen_direction);
      return "system_id=" + signal.system_id +
         "|system_name=" + LP_REVMA_SYSTEM_NAME +
         "|formula_id=" + signal.formula_id +
         "|formula_hash=" + (string)signal.formula_hash +
         "|pair_direction_formula_id=" + signal.pair_direction_formula_id +
         "|pair_direction_formula_hash=" + (string)signal.pair_direction_formula_hash +
         "|locked_setup_type=" + LP_RevmaSleeveName(frozen_sleeve) +
         "|locked_add_policy=" + frozen_add_policy +
         "|add_policy=" + frozen_add_policy +
         "|existing_grid_key=" + (string)grid.grid_key +
         "|grid_variant_id=" + IntegerToString(grid.variant_id) +
         "|grid_direction=" + LP_RevmaDirectionName(grid.direction) +
         "|grid_order_side=" + LP_RevmaDirectionName(grid.direction) +
         "|grid_tickets=" + grid.tickets +
         "|frozen_variant_id=" + IntegerToString(frozen_variant_id) +
         "|frozen_direction=" + LP_RevmaDirectionName(frozen_direction) +
         "|frozen_sleeve=" + LP_RevmaSleeveName(frozen_sleeve) +
         "|frozen_add_policy=" + frozen_add_policy +
         "|add_type=" + add_type +
         "|add_sequence=" + IntegerToString(birth.valid ? birth.add_sequence + (add_type == "" ? 0 : 1) : 0) +
         "|adverse_add_count=" + IntegerToString(birth.valid ? birth.adverse_add_count + (add_type == "adverse" ? 1 : 0) : 0) +
         "|favorable_add_count=" + IntegerToString(birth.valid ? birth.favorable_add_count + (add_type == "favorable" ? 1 : 0) : 0) +
         "|add_price=" + DoubleToString(signal.price, 5) +
         "|add_q=" + DoubleToString(signal.q, 8) +
         StochBucketMetadata(signal.stoch, "add") +
         AnchorBucketMetadata(signal.direction, signal.anchor_relation, "current") +
         "|basket_age_minutes=" + IntegerToString(basket_age_minutes) +
         "|current_matches_birth_identity=" + LP_BoolText(current_matches) +
         "|existing_positions=" + IntegerToString(grid.position_count) +
         "|existing_lots=" + DoubleToString(grid.lots, 2) +
         "|position_count_before=" + IntegerToString(grid.position_count) +
         "|lots_before=" + DoubleToString(grid.lots, 2) +
         "|avg_entry_before=" + DoubleToString(grid.avg_entry_price, 5) +
         "|min_entry_before=" + DoubleToString(grid.min_entry_price, 5) +
         "|max_entry_before=" + DoubleToString(grid.max_entry_price, 5) +
         "|avg_entry=" + DoubleToString(grid.avg_entry_price, 5) +
         "|min_entry=" + DoubleToString(grid.min_entry_price, 5) +
         "|max_entry=" + DoubleToString(grid.max_entry_price, 5) +
         "|grid_spacing_value_q=" + DoubleToString(spacing_value_q, 4) +
         "|spacing_q=" + DoubleToString(spacing_q, 8) +
         "|spacing_price=" + DoubleToString(spacing_price, 8) +
         "|next_add_level=" + DoubleToString(next_add_level, 5) +
         "|distance_from_avg_entry_q=" + DoubleToString(distance_from_avg_entry_q, 6) +
         "|floating_pnl=" + DoubleToString(grid.floating_pnl, 2) +
         "|grid_floating_pnl_before=" + DoubleToString(grid.floating_pnl, 2) +
         "|net_open_money_after_fees_before=" + DoubleToString(net_open_money_after_fees_before, 2) +
         BirthSnapshotMetadata(birth) +
         CurrentSignalMetadata(signal);
   }

   string AddMetadata(
      const LP_RevmaSignal &signal,
      const LP_GridInventoryRow &grid,
      const LP_RevmaGridBirthSnapshot &birth,
      const int frozen_variant_id,
      const int frozen_direction,
      const int frozen_sleeve,
      const string frozen_add_policy,
      const string add_type,
      const double spacing_q,
      const double spacing_price,
      const double next_add_level,
      const double net_open_money_after_fees_before
   )
   {
      return FrozenGridMetadata(
         signal,
         grid,
         birth,
         frozen_variant_id,
         frozen_direction,
         frozen_sleeve,
         frozen_add_policy,
         add_type,
         spacing_q,
         spacing_price,
         next_add_level,
         net_open_money_after_fees_before
      );
   }

   string AddSkipMetadata(
      const LP_RevmaSignal &signal,
      const LP_GridInventoryRow &grid,
      const LP_RevmaGridBirthSnapshot &birth,
      const int frozen_variant_id,
      const int frozen_direction,
      const int frozen_sleeve,
      const string frozen_add_policy,
      const double spacing_q,
      const double spacing_price,
      const double next_add_level,
      const string skip_reason
   )
   {
      return "skip_reason=" + skip_reason + "|" +
         FrozenGridMetadata(
            signal,
            grid,
            birth,
            frozen_variant_id,
            frozen_direction,
            frozen_sleeve,
            frozen_add_policy,
            "",
            spacing_q,
            spacing_price,
            next_add_level,
            grid.floating_pnl
         );
   }

   string NoActiveGridAddSkipMetadata(
      const LP_RevmaSignal &signal,
      const string skip_reason
   )
   {
      return "skip_reason=" + skip_reason +
         "|add_lookup=no_active_grid_found" +
         "|current_implied_add_policy=" + AddPolicyName(signal) +
         CurrentSignalMetadata(signal);
   }

   void BuildIntent(
      const LP_RevmaSignal &signal,
      const int action,
      const ulong grid_key,
      const int variant_id,
      const int direction,
      const string reason,
      LP_TradeIntent &intent
   )
   {
      intent.intent_id = NextIntentId();
      intent.symbol_id = signal.symbol_id;
      intent.symbol = signal.symbol;
      intent.lane_id = LP_LANE_REVMA;
      intent.variant_id = variant_id;
      intent.action = action;
      intent.direction = direction;
      intent.emitted_at = TimeCurrent();
      intent.source_bar_time = signal.source_m1_time;
      intent.expires_at = 0;
      intent.requested_lots = 0.0;
      intent.max_slippage_points =
         (double)LP_REVMA_DISCOVERY_MAX_SLIPPAGE_POINTS;
      intent.take_profit_distance_price = 0.0;
      intent.stop_loss_distance_price = 0.0;
      intent.target_take_profit_price = 0.0;
      intent.target_stop_loss_price = 0.0;
      intent.stop_take_profit_basis = "";
      intent.priority = action == LP_INTENT_OPEN_GRID ? 60 : 55;
      intent.score = signal.raw_score;
      intent.grid_key = grid_key;
      intent.grid_tickets = "";
      intent.expected_grid_ticket_count = 0;
      intent.research_lifecycle_event = LP_RESEARCH_LIFECYCLE_NONE;
      intent.research_add_type = "";
      intent.close_reason = "";
      intent.config_hash = m_config_hash;
      intent.strategy_version_hash = m_strategy_version_hash;
      intent.human_reason = reason;
   }

   bool AddHit(
      const LP_RevmaSignal &signal,
      const LP_GridInventoryRow &grid,
      const double spacing,
      double &next_add_level,
      string &add_type
   )
   {
      next_add_level = 0.0;
      add_type = "";
      if(spacing <= 0.0)
         return false;

      if(grid.direction > 0)
      {
         if(grid.min_entry_price <= 0.0)
            return false;
         double adverse_level = grid.min_entry_price - spacing;
         if(signal.price <= adverse_level)
         {
            next_add_level = adverse_level;
            add_type = "adverse";
            return true;
         }
         if(grid.max_entry_price <= 0.0)
            return false;
         double favorable_level = grid.max_entry_price + spacing;
         if(signal.price >= favorable_level)
         {
            next_add_level = favorable_level;
            add_type = "favorable";
            return true;
         }
      }
      if(grid.direction < 0)
      {
         if(grid.max_entry_price <= 0.0)
            return false;
         double adverse_level = grid.max_entry_price + spacing;
         if(signal.price >= adverse_level)
         {
            next_add_level = adverse_level;
            add_type = "adverse";
            return true;
         }
         if(grid.min_entry_price <= 0.0)
            return false;
         double favorable_level = grid.min_entry_price - spacing;
         if(signal.price <= favorable_level)
         {
            next_add_level = favorable_level;
            add_type = "favorable";
            return true;
         }
      }
      return false;
   }

   string ShortText(const string value, const int max_len)
   {
      if(max_len <= 0 || StringLen(value) <= max_len)
         return value;
      if(max_len <= 3)
         return StringSubstr(value, 0, max_len);
      return StringSubstr(value, 0, max_len - 3) + "...";
   }

   string PriceText(const double value)
   {
      if(value <= 0.0 || !MathIsValidNumber(value))
         return "n/a";
      return DoubleToString(value, 5);
   }

   string DashboardCleanText(const string value)
   {
      string out = value;
      StringReplace(out, "\r", " ");
      StringReplace(out, "\n", " | ");
      return out;
   }

   string DashboardPadRight(const string value, const int width)
   {
      string out = ShortText(DashboardCleanText(value), width);
      while(StringLen(out) < width)
         out += " ";
      return out;
   }

   string DashboardBorder()
   {
      return "+------------------------------------------------------+\n";
   }

   string DashboardTitle(const string title)
   {
      return "| " + DashboardPadRight(title, 52) + " |\n";
   }

   string DashboardRow(const string label, const string value)
   {
      return "| " + DashboardPadRight(label, 12) + " | " + DashboardPadRight(value, 35) + " |\n";
   }

   string DashboardSection(const string title)
   {
      return DashboardBorder() + DashboardTitle(title) + DashboardBorder();
   }

   string BrokerTakeProfitText(
      const string symbol,
      const LP_GridInventoryRow &grid,
      const LP_RevmaGridBirthSnapshot &birth,
      const LP_Config &config
   )
   {
      int grid_sleeve = birth.valid ? birth.sleeve : SleeveFromVariant(grid.variant_id);
      double take_profit_q = LP_RevmaTakeProfitQForSleeve(config, grid_sleeve);
      if(take_profit_q <= 0.0)
         return "off";
      if(!birth.valid || birth.q <= 0.0)
         return "waiting birth q";
      if(grid.avg_entry_price <= 0.0 || grid.lots <= 0.0)
         return "waiting grid";

      double money_per_price = 0.0;
      string note = "";
      if(!MoneyPerPriceDistance(symbol, grid.lots, money_per_price, note))
         return "n/a " + note;

      int digits = 5;
      if(SymbolInfoInteger(symbol, SYMBOL_EXIST))
         digits = (int)SymbolInfoInteger(symbol, SYMBOL_DIGITS);

      double target_money = birth.q * take_profit_q * money_per_price;
      string fee_source = "";
      double required_money = target_money + GridCloseFeeMoney(grid, config, fee_source) - grid.swap - grid.commission;
      double distance = required_money / money_per_price;
      if(distance <= 0.0 || !MathIsValidNumber(distance))
         return "n/a distance";

      double target_tp = 0.0;
      if(grid.direction > 0)
         target_tp = NormalizeDouble(grid.avg_entry_price + distance, digits);
      else if(grid.direction < 0)
         target_tp = NormalizeDouble(grid.avg_entry_price - distance, digits);
      else
         return "n/a direction";

      return DoubleToString(target_tp, digits);
   }

   bool MoneyPerPriceDistance(
      const string symbol,
      const double lots,
      double &money_per_price,
      string &note
   )
   {
      money_per_price = 0.0;
      note = "";
      double abs_lots = MathAbs(lots);
      if(abs_lots <= 0.0)
      {
         note = "grid_lots_invalid";
         return false;
      }

      double tick_size = SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_SIZE);
      double tick_value = SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_VALUE);
      if(tick_size <= 0.0 || tick_value <= 0.0)
      {
         note = "symbol_tick_value_unavailable";
         return false;
      }

      money_per_price = (tick_value / tick_size) * abs_lots;
      if(money_per_price <= 0.0 || !MathIsValidNumber(money_per_price))
      {
         note = "money_per_price_invalid";
         return false;
      }
      return true;
   }

   double ObservedOpenCommissionFeeMoney(const LP_GridInventoryRow &grid)
   {
      if(grid.commission >= 0.0)
         return 0.0;
      return MathAbs(grid.commission);
   }

   double ConfiguredCloseFeeMoney(const LP_GridInventoryRow &grid, const LP_Config &config)
   {
      if(config.stop_take_profit_close_commission_per_lot <= 0.0)
         return 0.0;
      return MathAbs(grid.lots) * config.stop_take_profit_close_commission_per_lot;
   }

   double GridCloseFeeMoney(
      const LP_GridInventoryRow &grid,
      const LP_Config &config,
      string &fee_source
   )
   {
      double configured_fee = ConfiguredCloseFeeMoney(grid, config);
      double observed_open_fee = ObservedOpenCommissionFeeMoney(grid);
      if(configured_fee > 0.0 && configured_fee >= observed_open_fee)
      {
         fee_source = "configured_per_lot";
         return configured_fee;
      }
      if(observed_open_fee > 0.0)
      {
         fee_source = "observed_open_commission";
         return observed_open_fee;
      }
      if(configured_fee > 0.0)
      {
         fee_source = "configured_per_lot";
         return configured_fee;
      }
      fee_source = "zero";
      return 0.0;
   }

   string BasketExitVisualText(
      const string symbol,
      const LP_GridInventoryRow &grid,
      const LP_RevmaGridBirthSnapshot &birth,
      const LP_Config &config
   )
   {
      if(config.revma_universe_mode != LP_UNIVERSE_CURRENT_CHART)
         return "";

      double q_basis = birth.valid && birth.q > 0.0 ? birth.q : 0.0;
      if(q_basis <= 0.0)
         return " basket exit: waiting for birth q\n";

      double money_per_price = 0.0;
      string note = "";
      if(!MoneyPerPriceDistance(symbol, grid.lots, money_per_price, note))
         return " basket exit: unavailable (" + note + ")\n";

      string close_fee_source = "";
      double close_fee = GridCloseFeeMoney(grid, config, close_fee_source);
      double net_open_money = grid.floating_pnl - close_fee;
      int grid_sleeve = birth.valid ? birth.sleeve : SleeveFromVariant(grid.variant_id);
      double take_profit_q = LP_RevmaTakeProfitQForSleeve(config, grid_sleeve);
      double stop_loss_q = LP_RevmaStopLossQForSleeve(config, grid_sleeve);
      double take_profit_money = take_profit_q > 0.0 ?
         q_basis * take_profit_q * money_per_price : 0.0;
      double stop_loss_money = stop_loss_q > 0.0 ?
         q_basis * stop_loss_q * money_per_price : 0.0;

      return " avg entry: " + PriceText(grid.avg_entry_price) +
            "  pnl: " + DoubleToString(grid.floating_pnl, 2) + "\n" +
         " basket net: " + DoubleToString(net_open_money, 2) +
            "  tp: " + DoubleToString(take_profit_money, 2) +
            "  sl: " + DoubleToString(stop_loss_money, 2) + "\n";
   }

   string BasketExitMetadata(
      const string symbol,
      const LP_GridInventoryRow &grid,
      const LP_RevmaGridBirthSnapshot &birth,
      const LP_Config &config,
      const string reason,
      const double q_basis,
      const double money_per_price,
      const double gross_open_money,
      const double estimated_close_fee,
      const string estimated_close_fee_source,
      const double net_open_money,
      const int grid_sleeve,
      const double take_profit_q,
      const double stop_loss_q,
      const double take_profit_money,
      const double stop_loss_money
   )
   {
      return "scope=revma_grid_q_after_fees" +
         "|reason=" + reason +
         "|symbol=" + symbol +
         "|grid_key=" + (string)grid.grid_key +
         "|grid_variant_id=" + IntegerToString(grid.variant_id) +
         "|grid_sleeve=" + LP_RevmaSleeveName(grid_sleeve) +
         "|grid_direction=" + LP_RevmaDirectionName(grid.direction) +
         "|grid_family=" + IntegerToString(grid.grid_family) +
         "|grid_positions=" + IntegerToString(grid.position_count) +
         "|grid_lots=" + DoubleToString(grid.lots, 2) +
         "|grid_tickets=" + grid.tickets +
         "|avg_entry=" + DoubleToString(grid.avg_entry_price, 5) +
         "|min_entry=" + DoubleToString(grid.min_entry_price, 5) +
         "|max_entry=" + DoubleToString(grid.max_entry_price, 5) +
         "|q_basis=" + DoubleToString(q_basis, 8) +
         "|grid_take_profit_q=" + DoubleToString(take_profit_q, 4) +
         "|grid_stop_loss_q=" + DoubleToString(stop_loss_q, 4) +
         "|money_per_price=" + DoubleToString(money_per_price, 2) +
         "|gross_open_money=" + DoubleToString(gross_open_money, 2) +
         "|price_pnl=" + DoubleToString(grid.price_pnl, 2) +
         "|swap=" + DoubleToString(grid.swap, 2) +
         "|commission=" + DoubleToString(grid.commission, 2) +
         "|estimated_close_fee=" + DoubleToString(estimated_close_fee, 2) +
         "|estimated_close_fee_source=" + estimated_close_fee_source +
         "|observed_open_commission_fee=" + DoubleToString(ObservedOpenCommissionFeeMoney(grid), 2) +
         "|net_open_money_after_fees=" + DoubleToString(net_open_money, 2) +
         "|take_profit_target_money_after_fees=" + DoubleToString(take_profit_money, 2) +
         "|stop_loss_target_money_after_fees=" + DoubleToString(stop_loss_money, 2) +
         "|close_commission_per_lot=" + DoubleToString(config.stop_take_profit_close_commission_per_lot, 2) +
         BirthSnapshotMetadata(birth);
   }

   void BuildGridCloseIntent(
      const string symbol,
      const LP_GridInventoryRow &grid,
      const string terminal_close_reason,
      const string metadata,
      const double score,
      LP_TradeIntent &intent
   )
   {
      intent.intent_id = NextIntentId();
      intent.symbol_id = grid.symbol_id;
      intent.symbol = symbol;
      intent.lane_id = LP_LANE_REVMA;
      intent.variant_id = grid.variant_id;
      intent.action = LP_INTENT_CLOSE_GRID;
      intent.direction = grid.direction;
      intent.emitted_at = TimeCurrent();
      intent.source_bar_time = TimeCurrent();
      intent.expires_at = 0;
      intent.requested_lots = 0.0;
      intent.max_slippage_points =
         (double)LP_REVMA_DISCOVERY_MAX_SLIPPAGE_POINTS;
      intent.take_profit_distance_price = 0.0;
      intent.stop_loss_distance_price = 0.0;
      intent.target_take_profit_price = 0.0;
      intent.target_stop_loss_price = 0.0;
      intent.stop_take_profit_basis = "";
      intent.priority = 95;
      intent.score = score;
      intent.grid_key = grid.grid_key;
      intent.grid_tickets = grid.tickets;
      intent.expected_grid_ticket_count = grid.position_count;
      intent.research_lifecycle_event = LP_RESEARCH_LIFECYCLE_NONE;
      intent.research_add_type = "";
      intent.close_reason = terminal_close_reason;
      intent.config_hash = m_config_hash;
      intent.strategy_version_hash = LP_HashString("gate99zze_revma_grid_summed_sltp");
      intent.human_reason = "revma_grid_basket_exit|" + metadata;
   }

   bool QueueGridExitIfTriggered(
      const LP_GridInventoryRow &grid,
      const LP_Config &config,
      LP_ReceiptWriter &receipts,
      LP_IntentBus &bus
   )
   {
      if(grid.lane_id != LP_LANE_REVMA || grid.position_count <= 0 || grid.lots <= 0.0)
         return false;

      LP_RevmaGridBirthSnapshot birth;
      if(!FindBirth(grid.grid_key, birth))
         return false;
      if(!birth.valid || birth.q <= 0.0)
         return false;

      string symbol = LP_ResolveBrokerSymbol(LP_CanonicalSymbol(grid.symbol_id), config.broker_symbol_suffix);
      LP_RevmaGridCloseLatch existing_latch;
      if(FindCloseLatch(grid.grid_key, existing_latch))
      {
         string latch_metadata =
            "scope=revma_grid_close_latch" +
            "|grid_key=" + (string)grid.grid_key +
            "|grid_positions=" + IntegerToString(grid.position_count) +
            "|grid_tickets=" + grid.tickets +
            "|close_reason=" + existing_latch.close_reason +
            "|close_latched=true" +
            "|original_ticket_count=" + IntegerToString(existing_latch.original_ticket_count) +
            "|attempted_count=" + IntegerToString(existing_latch.attempted_count) +
            "|closed_count=" + IntegerToString(existing_latch.closed_count) +
            "|remaining_ticket_count=" + IntegerToString(grid.position_count) +
            "|close_cap=" + IntegerToString(existing_latch.close_cap);
         LP_TradeIntent latched_close_intent;
         LP_ResetTradeIntent(latched_close_intent);
         BuildGridCloseIntent(symbol, grid, existing_latch.close_reason, latch_metadata, grid.floating_pnl, latched_close_intent);
         if(!bus.Add(latched_close_intent))
         {
            InvalidateDiscovery("latched_grid_close_intent_allocation_failed");
            receipts.Write(LP_RECEIPT_ERROR, symbol,
               "gate108_intent_bus_allocation_failed",
               "action=latched_grid_close|grid_key=" + (string)grid.grid_key,
               LP_LANE_REVMA, grid.variant_id, grid.grid_key,
               latched_close_intent.intent_id, 0, 0);
            return false;
         }
         receipts.Write(
            LP_RECEIPT_REVMA_GRID_EXIT,
            symbol,
            "revma_grid_close_latched",
            latch_metadata + "|intent_id=" + (string)latched_close_intent.intent_id,
            LP_LANE_REVMA,
            grid.variant_id,
            grid.grid_key,
            latched_close_intent.intent_id,
            0,
            0
         );
         return true;
      }

      double money_per_price = 0.0;
      string money_note = "";
      if(!MoneyPerPriceDistance(symbol, grid.lots, money_per_price, money_note))
      {
         receipts.Write(
            LP_RECEIPT_REVMA_GRID_EXIT,
            symbol,
            "basket_exit_unavailable",
            "scope=revma_grid_q_after_fees|reason=" + money_note +
               "|grid_key=" + (string)grid.grid_key +
               "|grid_positions=" + IntegerToString(grid.position_count) +
               "|grid_lots=" + DoubleToString(grid.lots, 2),
            LP_LANE_REVMA,
            grid.variant_id,
            grid.grid_key,
            0,
            0,
            0
         );
         return false;
      }

      double q_basis = birth.q;
      int grid_sleeve = birth.sleeve;
      double take_profit_q = LP_RevmaTakeProfitQForSleeve(config, grid_sleeve);
      double stop_loss_q = LP_RevmaStopLossQForSleeve(config, grid_sleeve);
      double take_profit_money = take_profit_q > 0.0 ?
         q_basis * take_profit_q * money_per_price : 0.0;
      double stop_loss_money = stop_loss_q > 0.0 ?
         q_basis * stop_loss_q * money_per_price : 0.0;
      double gross_open_money = grid.floating_pnl;
      string estimated_close_fee_source = "";
      double estimated_close_fee = GridCloseFeeMoney(grid, config, estimated_close_fee_source);
      double net_open_money = gross_open_money - estimated_close_fee;

      string reason = "";
      string status = "";
      if(take_profit_money > 0.0 && net_open_money >= take_profit_money)
      {
         reason = "take_profit_grid_q_after_fees";
         status = "revma_basket_tp_reached";
      }
      if(reason == "" && stop_loss_money > 0.0 && net_open_money <= -stop_loss_money)
      {
         reason = "stop_loss_grid_q_after_fees";
         status = "revma_basket_sl_reached";
      }
      if(reason == "")
         return false;

      string terminal_close_reason = reason == "take_profit_grid_q_after_fees" ? "grid_tp" : "grid_sl";
      LP_RevmaGridCloseLatch started_latch;
      if(!StartCloseLatch(grid, terminal_close_reason, config, receipts, started_latch))
      {
         InvalidateDiscovery("revma_grid_close_latch_failed");
         receipts.Write(LP_RECEIPT_ERROR, symbol,
            "revma_grid_close_latch_failed",
            "grid_key=" + (string)grid.grid_key + "|reason=" + terminal_close_reason,
            LP_LANE_REVMA, grid.variant_id, grid.grid_key, 0, 0, 0);
         return false;
      }

      string metadata = BasketExitMetadata(
         symbol,
         grid,
         birth,
         config,
         reason,
         q_basis,
         money_per_price,
         gross_open_money,
         estimated_close_fee,
         estimated_close_fee_source,
         net_open_money,
         grid_sleeve,
         take_profit_q,
         stop_loss_q,
         take_profit_money,
         stop_loss_money
       );
      metadata += "|close_latched=true" +
         "|original_ticket_count=" + IntegerToString(started_latch.original_ticket_count) +
         "|attempted_count=" + IntegerToString(started_latch.attempted_count) +
         "|closed_count=" + IntegerToString(started_latch.closed_count) +
         "|remaining_ticket_count=" + IntegerToString(started_latch.remaining_ticket_count) +
         "|close_cap=" + IntegerToString(started_latch.close_cap);

      LP_TradeIntent close_intent;
      LP_ResetTradeIntent(close_intent);
      BuildGridCloseIntent(symbol, grid, terminal_close_reason, metadata, net_open_money, close_intent);
      if(!bus.Add(close_intent))
      {
         InvalidateDiscovery("grid_close_intent_allocation_failed");
         receipts.Write(LP_RECEIPT_ERROR, symbol,
            "gate108_intent_bus_allocation_failed",
            "action=grid_close|grid_key=" + (string)grid.grid_key,
            LP_LANE_REVMA, grid.variant_id, grid.grid_key,
            close_intent.intent_id, 0, 0);
         return false;
      }

      receipts.Write(
         LP_RECEIPT_REVMA_GRID_EXIT,
         symbol,
         status,
         metadata,
         LP_LANE_REVMA,
         grid.variant_id,
         grid.grid_key,
         close_intent.intent_id,
         0,
         0
      );
      receipts.Write(
         LP_RECEIPT_REVMA_GRID_EXIT,
         symbol,
         "revma_grid_close_intent",
         metadata + "|intent_id=" + (string)close_intent.intent_id,
         LP_LANE_REVMA,
         grid.variant_id,
         grid.grid_key,
         close_intent.intent_id,
         0,
         0
      );
      return true;
   }

   void UpdateVisualText(
      const LP_RevmaSignal &signal,
      const bool has_grid,
      const LP_GridInventoryRow &grid,
      const LP_RevmaGridBirthSnapshot &birth,
      const int frozen_variant_id,
      const int frozen_direction,
      const int frozen_sleeve,
      const string frozen_add_policy,
      const double next_add_level,
      const string last_action,
      const LP_Config &config
   )
   {
      if(!config.revma_show_visual_dashboard && !config.revma_dashboard_screenshot_on_divergent_add)
      {
         m_visual_centerline_price = signal.anchor;
         return;
      }

      string current_policy = AddPolicyName(signal);
      bool current_matches = has_grid && CurrentMatchesFrozenIdentity(signal, frozen_variant_id, frozen_direction);
      int display_direction = has_grid ? frozen_direction : signal.direction;
      string status = has_grid ? "ACTIVE" : "WAITING";
      string display_sleeve = has_grid ? LP_RevmaSleeveName(frozen_sleeve) : LP_RevmaSleeveName(signal.sleeve);
      string display_policy = has_grid ? frozen_add_policy : current_policy;
      string state_line = LP_RevmaDirectionName(display_direction) + " / " + status;
      string relation_line = LP_RevmaAnchorRelationName(signal.anchor_relation) +
         " / " + DoubleToString(signal.anchor_distance_q, 2) + "q";
      string anchor_bucket = LP_RevmaAnchorBucketName(signal.direction, signal.anchor_relation);
      string stoch_bucket = LP_RevmaStochasticBucketName(signal.stoch);
      int display_sleeve_id = has_grid ? frozen_sleeve : signal.sleeve;
      double spacing_value_q = LP_RevmaGridSpacingQForSleeve(config, display_sleeve_id);
      double take_profit_q = LP_RevmaTakeProfitQForSleeve(config, display_sleeve_id);
      double stop_loss_q = LP_RevmaStopLossQForSleeve(config, display_sleeve_id);
      string birth_identity = current_matches ? "OK" : "CURRENT DIFFERS";

      m_visual_centerline_price = signal.anchor;

      m_visual_text = DashboardSection("LIMNI REVMA");
      m_visual_text += DashboardRow("STATE", state_line);
      m_visual_text += DashboardRow("SETUP", display_sleeve);
      m_visual_text += DashboardRow("ACTION", last_action);
      m_visual_text += DashboardSection("CENTERLINE");
      m_visual_text += DashboardRow("SYMBOL", signal.symbol);
      m_visual_text += DashboardRow("CENTER", PriceText(signal.anchor));
      m_visual_text += DashboardRow("PRICE", PriceText(signal.price));
      m_visual_text += DashboardRow("RELATION", relation_line);
      m_visual_text += DashboardRow("ANCHOR", anchor_bucket);
      m_visual_text += DashboardRow("STOCH", DoubleToString(signal.stoch, 2) + " " + stoch_bucket);
      m_visual_text += DashboardRow("Q", DoubleToString(signal.q, 8));

      if(!has_grid)
      {
         m_visual_text += DashboardSection("GRID");
         m_visual_text += DashboardRow("POSITIONS", "0");
         m_visual_text += DashboardRow("ADD MODEL", "ADVERSE + FAVORABLE");
         m_visual_text += DashboardRow("ADD MODE", display_policy);
         m_visual_text += DashboardRow("SPACING Q", DoubleToString(spacing_value_q, 2));
         m_visual_text += DashboardRow("TP/SL Q", DoubleToString(take_profit_q, 2) + " / " + DoubleToString(stop_loss_q, 2));
         return;
      }

      m_visual_text += DashboardSection("GRID");
      m_visual_text += DashboardRow("POSITIONS", IntegerToString(grid.position_count));
      m_visual_text += DashboardRow("LOTS", DoubleToString(grid.lots, 2));
      m_visual_text += DashboardRow("AVG ENTRY", PriceText(grid.avg_entry_price));
      m_visual_text += DashboardRow("PNL", DoubleToString(grid.floating_pnl, 2));
      m_visual_text += DashboardRow("TP", BrokerTakeProfitText(signal.symbol, grid, birth, config));
      m_visual_text += DashboardRow("NEXT ADD", PriceText(next_add_level));
      m_visual_text += DashboardRow("ADD MODEL", "ADVERSE + FAVORABLE");
      m_visual_text += DashboardRow("ADD MODE", display_policy);
      m_visual_text += DashboardRow("ADD COUNT", "A " + IntegerToString(birth.valid ? birth.adverse_add_count : 0) +
         " / F " + IntegerToString(birth.valid ? birth.favorable_add_count : 0));
      m_visual_text += DashboardRow("SPACING Q", DoubleToString(spacing_value_q, 2));
      m_visual_text += DashboardRow("TP/SL Q", DoubleToString(take_profit_q, 2) + " / " + DoubleToString(stop_loss_q, 2));
      m_visual_text += DashboardRow("BIRTH ID", birth_identity);

      if(m_last_divergent_add_text != "")
      {
         m_visual_text += DashboardSection("NOTE");
         m_visual_text += DashboardRow("DIVERGE", m_last_divergent_add_text);
      }
   }

   bool BuildShadowCandidateFromSnapshot(
      const int branch,
      const LP_RevmaCompletedM1Snapshot &snapshot,
      LP_RevmaShadowCandidate &candidate,
      bool &candidate_available)
   {
      LP_ResetRevmaShadowCandidate(candidate);
      candidate_available = false;
      if(!LP_RevmaCompletedM1SnapshotValid(snapshot) ||
         (branch != LP_REVMA_BRANCH_U && branch != LP_REVMA_BRANCH_C))
         return false;
      LP_RevmaShadowGrid grid;
      if(!m_discovery_shadow_portfolio.GetGrid(branch, snapshot.symbol_id,
            grid))
         return false;
      bool birth = !grid.active;
      int direction = birth ? snapshot.direction : grid.direction;
      int candidate_type = LP_REVMA_DISCOVERY_CANDIDATE_NONE;
      if(birth)
      {
         if(!snapshot.birth_eligible || !snapshot.session_allowed ||
            !snapshot.news_allowed ||
            !m_discovery_shadow_portfolio.ReentryEligible(branch,
               snapshot.symbol_id, snapshot.source_m1_time,
               snapshot.strategy_state_identity_hash))
            return true;
         candidate_type = LP_REVMA_DISCOVERY_CANDIDATE_BIRTH;
      }
      else
      {
         if(grid.close_owner != LP_REVMA_DISCOVERY_CLOSE_NONE)
            return true;
         long decision_ticks = 0;
         long minimum_ticks = 0;
         long maximum_ticks = 0;
         if(!LP_RevmaPriceToTicks(snapshot.decision_price,
               grid.birth_broker_tick_size, decision_ticks) ||
            !LP_RevmaPriceToTicks(grid.minimum_entry_price,
               grid.birth_broker_tick_size, minimum_ticks) ||
            !LP_RevmaPriceToTicks(grid.maximum_entry_price,
               grid.birth_broker_tick_size, maximum_ticks) ||
            maximum_ticks > LP_REVMA_GEOMETRY_ABS_LIMIT -
               grid.discovery_mesh.discovery_cell_ticks)
            return false;
         long lower = minimum_ticks > grid.discovery_mesh.discovery_cell_ticks ?
            minimum_ticks - grid.discovery_mesh.discovery_cell_ticks : 0;
         long upper = maximum_ticks + grid.discovery_mesh.discovery_cell_ticks;
         bool adverse = direction == LP_SIDE_LONG ?
            (lower > 0 && decision_ticks <= lower) : decision_ticks >= upper;
         bool favorable = direction == LP_SIDE_LONG ?
            decision_ticks >= upper : (lower > 0 && decision_ticks <= lower);
         if(!adverse && !favorable)
            return true;
         candidate_type = adverse ?
            LP_REVMA_DISCOVERY_CANDIDATE_ADVERSE_ADD :
            LP_REVMA_DISCOVERY_CANDIDATE_FAVORABLE_ADD;
      }
      candidate.valid = true;
      candidate.birth = birth;
      candidate.branch = branch;
      candidate.symbol_id = snapshot.symbol_id;
      candidate.direction = direction;
      candidate.candidate_type = candidate_type;
      candidate.source_m1_time = snapshot.source_m1_time;
      candidate.grid_generation = birth ?
         m_discovery_shadow_portfolio.NextGridGeneration(branch,
            snapshot.symbol_id) : grid.grid_generation;
      candidate.pre_candidate_state_hash =
         m_discovery_shadow_portfolio.PreCandidateStateHash(branch,
            snapshot.symbol_id);
      candidate.strategy_identity_hash = birth ?
         snapshot.signal_identity_hash : grid.strategy_identity_hash;
      candidate.strategy_state_identity_hash =
         snapshot.strategy_state_identity_hash;
      LP_RevmaShadowPortfolioState portfolio;
      if(!m_discovery_shadow_portfolio.GetPortfolio(branch, portfolio))
         return false;
      candidate.branch_grid_id = LP_RevmaDiscoveryGridIdentity(branch,
         snapshot.symbol_id, candidate.grid_generation, portfolio.cycle_id,
         birth ? snapshot.source_m1_time : grid.birth_m1_time,
         candidate.strategy_identity_hash);
      candidate.candidate_identity = LP_RevmaDiscoveryAdmissionIdentity(
         branch, candidate.branch_grid_id, snapshot.source_m1_time);
      candidate.decision_price = snapshot.decision_price;
      candidate.p0 = birth ? snapshot.decision_price : grid.birth_p0;
      candidate.c0 = birth ? snapshot.center : grid.birth_c0;
      candidate.q0 = birth ? snapshot.birth_q : grid.q0;
      candidate.q_event_count = snapshot.signal.q_event_count;
      candidate.stress_price = birth ? snapshot.stress_reference_price :
         grid.birth_stress_price;
      candidate.broker_tick_size = birth ? snapshot.broker_tick_size :
         grid.birth_broker_tick_size;
      candidate.initial_history_boundary = birth ?
         snapshot.initial_history_boundary : grid.initial_history_boundary;
      double slope = 0.0;
      double liquidation_price = 0.0;
      long snapshot_a_g = 0;
      if(!LP_RevmaSnapshotDirectionValues(snapshot, direction,
            candidate.fill_price, liquidation_price,
            snapshot_a_g, candidate.incremental_margin_minor,
            candidate.incremental_liquidation_minor, slope))
         return false;
      // Add reservation and q-cash remain frozen to the grid's birth A_g;
      // NormalizeCandidateReservation inside the book recomputes the exact
      // deltas and rejects caller authority.
      candidate.a_g_candidate_minor = birth ? snapshot_a_g :
         grid.a_g_candidate_minor;
      candidate.a_g_minor = birth ? snapshot_a_g : grid.a_g_minor;
      if(!birth)
         candidate.stress_price = grid.birth_stress_price;
      candidate.incremental_close_cost_minor =
         snapshot.immediate_close_cost_minor;
      candidate.lots = LP_REVMA_DISCOVERY_ATOM_LOTS;
      candidate.shared_observation_snapshot_hash = snapshot.snapshot_hash;
      candidate.matched_snapshot_hash =
         LP_RevmaDiscoveryMatchedSnapshotIdentity(
            candidate.symbol_id, candidate.source_m1_time,
            candidate.direction, candidate.candidate_type,
            candidate.pre_candidate_state_hash,
            candidate.strategy_identity_hash, candidate.q_event_count,
            candidate.q0, candidate.decision_price,
            candidate.stress_price, candidate.fill_price,
            candidate.p0, candidate.c0, candidate.broker_tick_size,
            candidate.a_g_candidate_minor, candidate.a_g_minor,
            candidate.incremental_margin_minor,
            candidate.incremental_liquidation_minor,
            candidate.incremental_close_cost_minor);
      if(birth)
         candidate.shared_origin_id = LP_RevmaDiscoverySharedOriginIdentity(
            candidate.symbol_id, candidate.source_m1_time,
            candidate.pre_candidate_state_hash,
            candidate.matched_snapshot_hash);
      else
         candidate.shared_origin_id = grid.shared_origin_id;
      candidate.opportunity_id =
         m_discovery_shadow_portfolio.CausalMatchingOpen() ?
         LP_RevmaDiscoveryOpportunityIdentity(candidate.shared_origin_id,
            candidate.symbol_id, candidate.source_m1_time,
            candidate.candidate_type, candidate.pre_candidate_state_hash,
            candidate.matched_snapshot_hash) : 0;
      if(candidate.branch_grid_id == 0 || candidate.candidate_identity == 0 ||
         candidate.pre_candidate_state_hash == 0 ||
         candidate.matched_snapshot_hash == 0 ||
         candidate.shared_origin_id == 0 ||
         !m_discovery_shadow_portfolio.PrepareCenterPolicy(candidate))
         return false;
      candidate_available = true;
      return true;
   }

   bool MarkDiscoveryShadows(
      LP_RevmaCompletedM1Snapshot &snapshots[],
      const int snapshot_count,
      const datetime source_m1_time)
   {
      bool matched = m_discovery_shadow_portfolio.CausalMatchingOpen();
      for(int i = 0; i < snapshot_count; i++)
      {
         LP_RevmaCompletedM1Snapshot snapshot = snapshots[i];
         LP_RevmaShadowGrid u_grid;
         LP_RevmaShadowGrid c_grid;
         if(!m_discovery_shadow_portfolio.GetGrid(LP_REVMA_BRANCH_U,
               snapshot.symbol_id, u_grid) ||
            !m_discovery_shadow_portfolio.GetGrid(LP_REVMA_BRANCH_C,
               snapshot.symbol_id, c_grid))
            return false;
         if(matched && u_grid.active != c_grid.active)
            return false;
         if(matched && !u_grid.active && !c_grid.active &&
            (u_grid.reentry_requires_identity_transition ||
             c_grid.reentry_requires_identity_transition))
         {
            if(u_grid.reentry_requires_identity_transition !=
                  c_grid.reentry_requires_identity_transition ||
               !m_discovery_shadow_portfolio.
                  ObserveMatchedFlatReentryIdentity(snapshot.symbol_id,
                     source_m1_time,
                     snapshot.strategy_state_identity_hash))
               return false;
         }
         else if(!matched)
         {
            if(!u_grid.active &&
               u_grid.reentry_requires_identity_transition &&
               !m_discovery_shadow_portfolio.ObserveFlatReentryIdentity(
                  LP_REVMA_BRANCH_U, snapshot.symbol_id, source_m1_time,
                  snapshot.strategy_state_identity_hash))
               return false;
            if(!c_grid.active &&
               c_grid.reentry_requires_identity_transition &&
               !m_discovery_shadow_portfolio.ObserveFlatReentryIdentity(
                  LP_REVMA_BRANCH_C, snapshot.symbol_id, source_m1_time,
                  snapshot.strategy_state_identity_hash))
               return false;
         }
         if(matched && u_grid.active)
         {
            double open_price = 0.0;
            double liquidation_price = 0.0;
            double slope = 0.0;
            long a_g = 0;
            long margin = 0;
            long immediate = 0;
            if(!LP_RevmaSnapshotDirectionValues(snapshot, u_grid.direction,
                  open_price, liquidation_price, a_g, margin, immediate,
                  slope) ||
               !m_discovery_shadow_portfolio.ObserveMatchedGridPath(
                  snapshot.symbol_id, snapshot.decision_price,
                  source_m1_time) ||
               !m_discovery_shadow_portfolio.ObserveMatchedGridCenters(
                  snapshot.symbol_id, snapshot.center, snapshot.current_q,
                  snapshot.broker_tick_size, snapshot.signal.q_event_count,
                  source_m1_time))
               return false;
            double mark_money = (double)u_grid.direction *
               (liquidation_price - u_grid.average_entry_price) * slope *
               (double)u_grid.atom_count;
            long mark_minor = 0;
            if(!LP_RevmaDiscoveryMoneyToSignedMinor(mark_money,
                  snapshot.money_quantum, mark_minor) ||
               !m_discovery_shadow_portfolio.SetMatchedGridMarkedLiquidation(
                  snapshot.symbol_id, source_m1_time, mark_minor, 0))
               return false;
         }
         else if(!matched)
         {
            for(int branch = LP_REVMA_BRANCH_U;
               branch <= LP_REVMA_BRANCH_C; branch++)
            {
               LP_RevmaShadowGrid grid = branch == LP_REVMA_BRANCH_U ?
                  u_grid : c_grid;
               if(!grid.active)
                  continue;
               double open_price = 0.0;
               double liquidation_price = 0.0;
               double slope = 0.0;
               long a_g = 0;
               long margin = 0;
               long immediate = 0;
               if(!LP_RevmaSnapshotDirectionValues(snapshot, grid.direction,
                     open_price, liquidation_price, a_g, margin, immediate,
                     slope) ||
                  !m_discovery_shadow_portfolio.ObserveGridPath(branch,
                     snapshot.symbol_id, snapshot.decision_price,
                     source_m1_time))
                  return false;
               if((branch == LP_REVMA_BRANCH_C &&
                   !m_discovery_shadow_portfolio.ObserveCGridCenter(
                      snapshot.symbol_id, snapshot.center,
                      snapshot.current_q, snapshot.broker_tick_size,
                      snapshot.signal.q_event_count, source_m1_time)) ||
                  (branch == LP_REVMA_BRANCH_U &&
                   !m_discovery_shadow_portfolio.ObserveUGridCenter(
                      snapshot.symbol_id, snapshot.center,
                      snapshot.current_q, snapshot.broker_tick_size,
                      snapshot.signal.q_event_count, source_m1_time)))
                  return false;
               double mark_money = (double)grid.direction *
                  (liquidation_price - grid.average_entry_price) * slope *
                  (double)grid.atom_count;
               long mark_minor = 0;
               if(!LP_RevmaDiscoveryMoneyToSignedMinor(mark_money,
                     snapshot.money_quantum, mark_minor) ||
                  !m_discovery_shadow_portfolio.SetGridMarkedLiquidation(
                     branch, snapshot.symbol_id, source_m1_time,
                     mark_minor, 0))
                  return false;
            }
         }
      }
      return true;
   }

   bool EvaluateAndCloseDiscoveryShadows(
      LP_RevmaCompletedM1Snapshot &snapshots[],
      const int snapshot_count,
      const datetime source_m1_time)
   {
      bool matched = m_discovery_shadow_portfolio.CausalMatchingOpen();
      LP_RevmaShadowPortfolioState u_before_authority;
      LP_RevmaShadowPortfolioState c_before_authority;
      if(!m_discovery_shadow_portfolio.GetPortfolio(LP_REVMA_BRANCH_U,
            u_before_authority) ||
         !m_discovery_shadow_portfolio.GetPortfolio(LP_REVMA_BRANCH_C,
            c_before_authority))
         return false;
      if(matched)
      {
         if(!m_discovery_shadow_portfolio.EvaluateMatchedCloseAuthority(
               source_m1_time))
            return false;
      }
      else if(!m_discovery_shadow_portfolio.EvaluateCloseAuthority(
            LP_REVMA_BRANCH_U, source_m1_time) ||
         !m_discovery_shadow_portfolio.EvaluateCloseAuthority(
            LP_REVMA_BRANCH_C, source_m1_time))
         return false;
      LP_RevmaShadowPortfolioState u_after_authority;
      LP_RevmaShadowPortfolioState c_after_authority;
      if(!m_discovery_shadow_portfolio.GetPortfolio(LP_REVMA_BRANCH_U,
            u_after_authority) ||
         !m_discovery_shadow_portfolio.GetPortfolio(LP_REVMA_BRANCH_C,
            c_after_authority) ||
         !AppendDiscoveryPortfolioAuthority(LP_REVMA_BRANCH_U,
            u_after_authority.cycle_id,
            u_after_authority.equity_reference_minor,
            u_after_authority.capital_budget_minor,
            u_after_authority.atom_count,
            u_after_authority.reservation_minor,
            u_after_authority.q_cash_minor,
            u_after_authority.margin_minor,
            u_after_authority.marked_liquidation_minor,
            u_after_authority.realized_harvest_minor,
            u_after_authority.realized_nonharvest_minor,
            u_after_authority.concentration_q_cash_minor,
            u_after_authority.concentration_currency_id,
            u_before_authority.close_owner,
            u_after_authority.close_owner, source_m1_time) ||
         !AppendDiscoveryPortfolioAuthority(LP_REVMA_BRANCH_C,
            c_after_authority.cycle_id,
            c_after_authority.equity_reference_minor,
            c_after_authority.capital_budget_minor,
            c_after_authority.atom_count,
            c_after_authority.reservation_minor,
            c_after_authority.q_cash_minor,
            c_after_authority.margin_minor,
            c_after_authority.marked_liquidation_minor,
            c_after_authority.realized_harvest_minor,
            c_after_authority.realized_nonharvest_minor,
            c_after_authority.concentration_q_cash_minor,
            c_after_authority.concentration_currency_id,
            c_before_authority.close_owner,
            c_after_authority.close_owner, source_m1_time))
         return false;
      for(int i = 0; i < snapshot_count; i++)
      {
         bool u_latched = false;
         bool c_latched = false;
         if(matched)
         {
            bool matched_latched = false;
            if(!m_discovery_shadow_portfolio.EvaluateMatchedLocalHarvest(
                  snapshots[i].symbol_id, source_m1_time,
                  matched_latched))
               return false;
            u_latched = matched_latched;
            c_latched = matched_latched;
         }
         else if(!m_discovery_shadow_portfolio.EvaluateLocalHarvest(
               LP_REVMA_BRANCH_U, snapshots[i].symbol_id,
               source_m1_time, u_latched) ||
            !m_discovery_shadow_portfolio.EvaluateLocalHarvest(
               LP_REVMA_BRANCH_C, snapshots[i].symbol_id,
               source_m1_time, c_latched))
            return false;
      }
      for(int i = 0; i < snapshot_count; i++)
      {
         int symbol_id = snapshots[i].symbol_id;
         LP_RevmaShadowGrid u_grid;
         LP_RevmaShadowGrid c_grid;
         if(!m_discovery_shadow_portfolio.GetGrid(LP_REVMA_BRANCH_U,
               symbol_id, u_grid) ||
            !m_discovery_shadow_portfolio.GetGrid(LP_REVMA_BRANCH_C,
               symbol_id, c_grid))
            return false;
         if(matched && u_grid.active && c_grid.active &&
            u_grid.close_owner != LP_REVMA_DISCOVERY_CLOSE_NONE)
         {
             if(u_grid.close_owner != c_grid.close_owner ||
                u_grid.terminal_reason != c_grid.terminal_reason ||
                !m_discovery_shadow_portfolio.CloseMatchedGrid(symbol_id,
                   u_grid.close_owner, source_m1_time,
                   snapshots[i].strategy_state_identity_hash,
                   u_grid.terminal_reason) ||
                !EmitMatchedShadowGridTerminals(u_grid, c_grid,
                   LP_REVMA_TELEMETRY_GRID_CLOSE))
                return false;
         }
         else if(!matched)
         {
             if(u_grid.active &&
                u_grid.close_owner != LP_REVMA_DISCOVERY_CLOSE_NONE)
             {
                if(!m_discovery_shadow_portfolio.CloseGrid(
                      LP_REVMA_BRANCH_U, symbol_id, u_grid.close_owner,
                      source_m1_time,
                      snapshots[i].strategy_state_identity_hash,
                      u_grid.terminal_reason) ||
                   !EmitShadowGridTerminal(LP_REVMA_BRANCH_U, u_grid,
                      LP_REVMA_TELEMETRY_GRID_CLOSE))
                   return false;
             }
             if(c_grid.active &&
                c_grid.close_owner != LP_REVMA_DISCOVERY_CLOSE_NONE)
             {
                if(!m_discovery_shadow_portfolio.CloseGrid(
                      LP_REVMA_BRANCH_C, symbol_id, c_grid.close_owner,
                      source_m1_time,
                      snapshots[i].strategy_state_identity_hash,
                      c_grid.terminal_reason) ||
                   !EmitShadowGridTerminal(LP_REVMA_BRANCH_C, c_grid,
                      LP_REVMA_TELEMETRY_GRID_CLOSE))
                   return false;
             }
         }
      }
      LP_RevmaShadowPortfolioState u_portfolio;
      LP_RevmaShadowPortfolioState c_portfolio;
      if(!m_discovery_shadow_portfolio.GetPortfolio(LP_REVMA_BRANCH_U,
            u_portfolio) ||
         !m_discovery_shadow_portfolio.GetPortfolio(LP_REVMA_BRANCH_C,
            c_portfolio))
         return false;
      if(matched && u_portfolio.close_owner !=
            LP_REVMA_DISCOVERY_CLOSE_NONE &&
         u_portfolio.reservation_minor == 0 &&
         c_portfolio.reservation_minor == 0)
      {
         int close_owner = u_portfolio.close_owner;
         if(close_owner != c_portfolio.close_owner ||
            !m_discovery_shadow_portfolio.CompleteMatchedPortfolioClose() ||
            !m_discovery_shadow_portfolio.GetPortfolio(LP_REVMA_BRANCH_U,
               u_portfolio) ||
            !m_discovery_shadow_portfolio.GetPortfolio(LP_REVMA_BRANCH_C,
               c_portfolio) ||
            !AppendDiscoveryPortfolioAuthorityComplete(
               LP_REVMA_BRANCH_U, u_portfolio.cycle_id,
               u_portfolio.equity_reference_minor,
               u_portfolio.capital_budget_minor,
               u_portfolio.realized_harvest_minor,
               u_portfolio.realized_nonharvest_minor, close_owner,
               source_m1_time) ||
            !AppendDiscoveryPortfolioAuthorityComplete(
               LP_REVMA_BRANCH_C, c_portfolio.cycle_id,
               c_portfolio.equity_reference_minor,
               c_portfolio.capital_budget_minor,
               c_portfolio.realized_harvest_minor,
               c_portfolio.realized_nonharvest_minor, close_owner,
               source_m1_time))
            return false;
      }
      else if(!matched)
      {
         if(u_portfolio.close_owner != LP_REVMA_DISCOVERY_CLOSE_NONE &&
             u_portfolio.reservation_minor == 0 &&
             (!m_discovery_shadow_portfolio.CompletePortfolioClose(
                LP_REVMA_BRANCH_U) ||
              !m_discovery_shadow_portfolio.GetPortfolio(
                 LP_REVMA_BRANCH_U, u_portfolio) ||
              !AppendDiscoveryPortfolioAuthorityComplete(
                 LP_REVMA_BRANCH_U, u_portfolio.cycle_id,
                 u_portfolio.equity_reference_minor,
                 u_portfolio.capital_budget_minor,
                 u_portfolio.realized_harvest_minor,
                 u_portfolio.realized_nonharvest_minor,
                 u_portfolio.close_owner, source_m1_time)))
            return false;
         if(c_portfolio.close_owner != LP_REVMA_DISCOVERY_CLOSE_NONE &&
             c_portfolio.reservation_minor == 0 &&
             (!m_discovery_shadow_portfolio.CompletePortfolioClose(
                LP_REVMA_BRANCH_C) ||
              !m_discovery_shadow_portfolio.GetPortfolio(
                 LP_REVMA_BRANCH_C, c_portfolio) ||
              !AppendDiscoveryPortfolioAuthorityComplete(
                 LP_REVMA_BRANCH_C, c_portfolio.cycle_id,
                 c_portfolio.equity_reference_minor,
                 c_portfolio.capital_budget_minor,
                 c_portfolio.realized_harvest_minor,
                 c_portfolio.realized_nonharvest_minor,
                 c_portfolio.close_owner, source_m1_time)))
            return false;
      }
      return true;
   }

   bool BuildDiscoveryPortfolioTransition(
      const int branch,
      const ulong cycle_id,
      const long equity_reference_minor,
      const long budget_minor,
      const int atom_count,
      const long reservation_minor,
      const long q_cash_minor,
      const long margin_minor,
      const long marked_liquidation_minor,
      const long harvest_minor,
      const long nonharvest_minor,
      const long concentration_q_cash_minor,
      const int concentration_currency_id,
      const int close_owner,
      const datetime source_m1_time,
      const int event_type,
      const string decision,
      const string reason,
      LP_RevmaDiscoveryTransitionRow &row)
   {
      if(!m_discovery_last_cohort_valid ||
         !LP_RevmaDiscoveryBranchValid(branch) || cycle_id == 0 ||
         equity_reference_minor <= 0 || budget_minor <= 0 ||
         atom_count < 0 || reservation_minor < 0 || q_cash_minor < 0 ||
         margin_minor < 0 || concentration_q_cash_minor < 0 ||
         ((concentration_q_cash_minor == 0) !=
          (concentration_currency_id == -1)) ||
         concentration_currency_id < -1 ||
         concentration_currency_id >= LP_CCY_COUNT ||
         source_m1_time <= 0 ||
         m_discovery_last_cohort[0].source_m1_time != source_m1_time ||
         m_discovery_last_cohort_hash == 0 ||
         m_discovery_last_cohort_signal_hash == 0 ||
         m_discovery_last_cohort_strategy_hash == 0 ||
         !m_discovery_telemetry.SeedTransitionRow(row))
         return false;
      row.event_type = event_type;
      row.event_time = TimeCurrent() < source_m1_time ?
         source_m1_time : TimeCurrent();
      row.source_m1_time = source_m1_time;
      row.signal_identity_hash = m_discovery_last_cohort_signal_hash;
      row.shared_observation_snapshot_hash = m_discovery_last_cohort_hash;
      row.strategy_state_identity_hash =
         m_discovery_last_cohort_strategy_hash;
      row.branch = branch;
      row.branch_cycle_id = cycle_id;
      row.account_cycle_id = cycle_id;
      row.symbol_id = -1;
      row.direction = LP_SIDE_NONE;
      row.atoms_before = atom_count;
      row.atoms_after = atom_count;
      row.lots_before = NormalizeDouble((double)atom_count *
         LP_REVMA_DISCOVERY_ATOM_LOTS, 2);
      row.lots_after = row.lots_before;
      row.reservation_minor = reservation_minor;
      row.q_cash_minor = q_cash_minor;
      row.margin_minor = margin_minor;
      row.concentration_q_cash_minor = concentration_q_cash_minor;
      row.concentration_currency_id = concentration_currency_id;
      row.harvest_minor = harvest_minor;
      row.nonharvest_minor = nonharvest_minor;
      row.liability_minor = marked_liquidation_minor;
      if(marked_liquidation_minor < 0)
         row.maximum_adverse_excursion_minor = -marked_liquidation_minor;
      row.budget_minor = budget_minor;
      row.equity_reference_minor = equity_reference_minor;
      row.close_owner = close_owner;
      row.decision = decision;
      row.reason = reason;
      return true;
   }

   bool AppendDiscoveryPortfolioAuthority(
      const int branch,
      const ulong cycle_id,
      const long equity_reference_minor,
      const long budget_minor,
      const int atom_count,
      const long reservation_minor,
      const long q_cash_minor,
      const long margin_minor,
      const long marked_liquidation_minor,
      const long harvest_minor,
      const long nonharvest_minor,
      const long concentration_q_cash_minor,
      const int concentration_currency_id,
      const int previous_close_owner,
      const int current_close_owner,
      const datetime source_m1_time)
   {
      if(!LP_RevmaDiscoveryBranchValid(branch))
         return false;
      if(current_close_owner == previous_close_owner)
         return current_close_owner == LP_REVMA_DISCOVERY_CLOSE_NONE ||
            m_discovery_telemetry_close_owner[branch] == current_close_owner;
      if(m_discovery_telemetry_close_owner[branch] !=
            previous_close_owner ||
         m_discovery_telemetry_close_complete[branch])
         return false;
      int event_type = LP_REVMA_TELEMETRY_FAILURE;
      string reason = "";
      if(current_close_owner == LP_REVMA_DISCOVERY_CLOSE_CLEANUP &&
         previous_close_owner == LP_REVMA_DISCOVERY_CLOSE_NONE)
      {
         event_type = LP_REVMA_TELEMETRY_CLEANUP_LATCH;
         reason = "account_cleanup";
      }
      else if(current_close_owner == LP_REVMA_DISCOVERY_CLOSE_HARD_RISK &&
         previous_close_owner != LP_REVMA_DISCOVERY_CLOSE_HARD_RISK)
      {
         event_type = LP_REVMA_TELEMETRY_HARD_RISK_LATCH;
         reason = "account_risk";
      }
      else
         return false;
      LP_RevmaDiscoveryTransitionRow row;
      if(!BuildDiscoveryPortfolioTransition(branch, cycle_id,
            equity_reference_minor, budget_minor, atom_count,
            reservation_minor, q_cash_minor, margin_minor,
            marked_liquidation_minor, harvest_minor, nonharvest_minor,
            concentration_q_cash_minor, concentration_currency_id,
            current_close_owner, source_m1_time, event_type, "CLOSE",
            reason, row))
         return false;
      ulong event_hash = 0;
      if(!m_discovery_telemetry.AppendTransition(row, event_hash) ||
         event_hash == 0)
         return false;
      m_discovery_telemetry_close_owner[branch] = current_close_owner;
      m_discovery_telemetry_close_complete[branch] = false;
      return true;
   }

   bool AppendDiscoveryPortfolioAuthorityComplete(
      const int branch,
      const ulong cycle_id,
      const long equity_reference_minor,
      const long budget_minor,
      const long harvest_minor,
      const long nonharvest_minor,
      const int close_owner,
      const datetime source_m1_time)
   {
      if(m_discovery_telemetry_close_complete[branch])
         return m_discovery_telemetry_close_owner[branch] == close_owner;
      int event_type = close_owner == LP_REVMA_DISCOVERY_CLOSE_CLEANUP ?
         LP_REVMA_TELEMETRY_CLEANUP_COMPLETE :
         (close_owner == LP_REVMA_DISCOVERY_CLOSE_HARD_RISK ?
          LP_REVMA_TELEMETRY_HARD_RISK_COMPLETE : LP_REVMA_TELEMETRY_FAILURE);
      if(event_type == LP_REVMA_TELEMETRY_FAILURE ||
         m_discovery_telemetry_close_owner[branch] != close_owner)
         return false;
      LP_RevmaDiscoveryTransitionRow row;
      if(!BuildDiscoveryPortfolioTransition(branch, cycle_id,
            equity_reference_minor, budget_minor, 0, 0, 0, 0, 0,
            harvest_minor, nonharvest_minor, 0, -1, close_owner,
            source_m1_time, event_type, "CLOSE",
            close_owner == LP_REVMA_DISCOVERY_CLOSE_CLEANUP ?
               "account_cleanup_complete" : "account_risk_complete", row))
         return false;
      ulong event_hash = 0;
      if(!m_discovery_telemetry.AppendTransition(row, event_hash) ||
         event_hash == 0)
         return false;
      m_discovery_telemetry_close_complete[branch] = true;
      return true;
   }

   bool BuildShadowGridTransition(
      const int branch,
      const LP_RevmaShadowGrid &observation_grid,
      const int event_type,
      LP_RevmaDiscoveryTransitionRow &row,
      LP_RevmaTerminalGridProjection &projection)
   {
      LP_ResetRevmaTerminalGridProjection(projection);
      if(!m_discovery_last_cohort_valid ||
         (branch != LP_REVMA_BRANCH_U && branch != LP_REVMA_BRANCH_C) ||
         observation_grid.symbol_id < 0 ||
         observation_grid.symbol_id >= LP_SYMBOL_COUNT ||
         observation_grid.branch != branch ||
         observation_grid.branch_grid_id == 0 ||
         observation_grid.average_entry_price <= 0.0 ||
         observation_grid.weighted_entry_price_lots <= 0.0 ||
         !m_discovery_telemetry.SeedTransitionRow(row))
         return false;
      LP_RevmaCompletedM1Snapshot snapshot =
         m_discovery_last_cohort[observation_grid.symbol_id];
      if(snapshot.source_m1_time <= 0 ||
         snapshot.source_m1_time != observation_grid.last_mark_m1_time)
         return false;
      row.branch = branch;
      long unfilled_jump = MathAbs(
         observation_grid.path_geometry.current_cell_index -
         observation_grid.path_geometry.previous_cell_index);
      if(!LP_RevmaBridgePopulateObservation(row, snapshot,
            observation_grid.direction, observation_grid.birth_p0,
            observation_grid.birth_c0, observation_grid.q0,
            observation_grid.birth_stress_price,
            observation_grid.average_entry_price,
            observation_grid.birth_m1_time,
            observation_grid.initial_history_boundary,
            observation_grid.last_positive_liquidation_opportunity_m1,
            observation_grid.time_underwater_minutes, unfilled_jump,
            observation_grid.discovery_mesh,
            observation_grid.center_support,
            observation_grid.path_geometry))
         return false;
      bool terminal_event = event_type == LP_REVMA_TELEMETRY_GRID_CLOSE ||
         event_type == LP_REVMA_TELEMETRY_GRID_TERMINAL_SNAPSHOT;
      if(terminal_event &&
         !m_discovery_shadow_portfolio.BuildTerminalGridProjection(branch,
            observation_grid.symbol_id, snapshot.source_m1_time, projection))
         return false;
      LP_RevmaShadowPortfolioState portfolio;
      if(!m_discovery_shadow_portfolio.GetPortfolio(branch, portfolio))
         return false;
      row.event_type = event_type;
      row.branch_grid_id = observation_grid.branch_grid_id;
      row.branch_cycle_id = observation_grid.branch_cycle_id;
      row.account_cycle_id = observation_grid.branch_cycle_id;
      row.grid_generation = observation_grid.grid_generation;
      row.shared_origin_id = observation_grid.shared_origin_id;
      row.matched_snapshot_hash =
         observation_grid.birth_matched_snapshot_hash;
      row.pre_candidate_state_hash =
         observation_grid.birth_pre_candidate_state_hash;
      row.a_g_candidate_minor = observation_grid.a_g_candidate_minor;
      row.a_g_minor = observation_grid.a_g_minor;
      row.adverse_add_count = observation_grid.adverse_add_count;
      row.favorable_add_count = observation_grid.favorable_add_count;
      row.weighted_entry_sum =
         observation_grid.weighted_entry_price_lots;
      row.maximum_adverse_excursion_minor =
         observation_grid.maximum_adverse_excursion_minor;
      row.atoms_before = terminal_event ? projection.atoms_before :
         observation_grid.atom_count;
      row.atoms_after = terminal_event ? projection.atoms_after :
         observation_grid.atom_count;
      row.lots_before = terminal_event ? projection.lots_before :
         observation_grid.total_lots;
      row.lots_after = terminal_event ? projection.lots_after :
         observation_grid.total_lots;
      row.reservation_minor = terminal_event ? projection.reservation_minor :
         observation_grid.reservation_minor;
      row.q_cash_minor = terminal_event ? projection.q_cash_minor :
         observation_grid.q_cash_minor;
      row.margin_minor = terminal_event ? projection.margin_minor :
         observation_grid.margin_minor;
      row.harvest_minor = terminal_event ? projection.harvest_minor :
         observation_grid.realized_harvest_minor;
      row.nonharvest_minor = terminal_event ? projection.nonharvest_minor :
         observation_grid.realized_nonharvest_minor;
      row.liability_minor = terminal_event ? projection.liability_minor :
         observation_grid.marked_liquidation_minor;
      row.liquidation_cost_minor = terminal_event ? projection.cost_minor :
         observation_grid.estimated_close_cost_minor;
      if(terminal_event)
      {
         row.maximum_adverse_excursion_minor =
            projection.maximum_adverse_excursion_minor;
         row.grid_age_minutes = projection.grid_age_minutes;
         row.time_underwater_minutes = projection.time_underwater_minutes;
         row.close_owner = projection.close_owner;
         row.grid_terminal_reason = projection.origin_terminal_reason;
         row.terminal_internal_state_hash =
            projection.terminal_internal_state_hash;
         row.terminal_projection_hash = projection.projection_hash;
      }
      else
         row.close_owner = observation_grid.close_owner;
      int current_atoms = row.atoms_before;
      int reserved_atoms = current_atoms <= 0 ? 0 :
         (current_atoms < 2 ? 2 : current_atoms);
      long expected_reservation = 0;
      long expected_q_cash = 0;
      long candidate_current_reservation = 0;
      if(!LP_RevmaTelemetrySafeMinorMultiply(row.a_g_minor,
            reserved_atoms, expected_reservation) ||
         !LP_RevmaTelemetrySafeMinorMultiply(row.a_g_minor,
            current_atoms, expected_q_cash) ||
         !LP_RevmaTelemetrySafeMinorMultiply(row.a_g_candidate_minor,
            reserved_atoms, candidate_current_reservation) ||
         row.reservation_minor != expected_reservation ||
         row.q_cash_minor != expected_q_cash)
         return false;
      row.prospective_reservation_minor = candidate_current_reservation;
      if(!LP_RevmaTelemetrySafeMinorMultiply(row.a_g_candidate_minor,
            current_atoms, row.prospective_q_cash_minor))
         return false;
      row.reservation_overrun = row.reservation_minor >
         candidate_current_reservation;
      row.reservation_overrun_minor = row.reservation_overrun ?
         row.reservation_minor - candidate_current_reservation : 0;
      row.budget_minor = portfolio.capital_budget_minor;
      row.equity_reference_minor = portfolio.equity_reference_minor;
      row.decision = event_type == LP_REVMA_TELEMETRY_GRID_CLOSE ?
         "CLOSE" : (event_type ==
            LP_REVMA_TELEMETRY_GRID_TERMINAL_SNAPSHOT ? "SNAPSHOT" :
            "LATCH");
      row.reason = event_type == LP_REVMA_TELEMETRY_GRID_CLOSE ?
         row.grid_terminal_reason : (event_type ==
            LP_REVMA_TELEMETRY_GRID_TERMINAL_SNAPSHOT ?
            "run_boundary_unresolved_grid_snapshot" :
            "signed_center_support_positive_to_nonpositive");
      return true;
   }

   bool AppendDiscoveryGridSummary(const int branch, const int symbol_id)
   {
      LP_RevmaDiscoverySummaryRow summary;
      return m_discovery_telemetry.BuildGridSummaryBase(branch, symbol_id,
         summary) && m_discovery_telemetry.AppendSummary(summary);
   }

   bool EmitShadowGridTerminal(
      const int branch,
      const LP_RevmaShadowGrid &observation_grid,
      const int event_type)
   {
      LP_RevmaDiscoveryTransitionRow row;
      LP_RevmaTerminalGridProjection projection;
      if(!BuildShadowGridTransition(branch, observation_grid, event_type,
            row, projection))
         return false;
      ulong event_hash = 0;
      if(!m_discovery_telemetry.AppendTransition(row, event_hash) ||
         event_hash == 0 ||
         !m_discovery_shadow_portfolio.BindTerminalEvidenceEvent(branch,
            observation_grid.symbol_id, observation_grid.branch_grid_id,
            row.source_m1_time, projection.projection_hash,
            projection.terminal_internal_state_hash, event_hash) ||
         (event_type == LP_REVMA_TELEMETRY_GRID_CLOSE &&
          !AppendDiscoveryGridSummary(branch, observation_grid.symbol_id)))
         return false;
      return true;
   }

   bool EmitMatchedShadowGridTerminals(
      const LP_RevmaShadowGrid &u_observation_grid,
      const LP_RevmaShadowGrid &c_observation_grid,
      const int event_type)
   {
      if(u_observation_grid.symbol_id != c_observation_grid.symbol_id ||
         u_observation_grid.branch_grid_id == 0 ||
         c_observation_grid.branch_grid_id == 0)
         return false;
      LP_RevmaDiscoveryTransitionRow u_row;
      LP_RevmaDiscoveryTransitionRow c_row;
      LP_RevmaTerminalGridProjection u_projection;
      LP_RevmaTerminalGridProjection c_projection;
      if(!BuildShadowGridTransition(LP_REVMA_BRANCH_U,
            u_observation_grid, event_type, u_row, u_projection) ||
         !BuildShadowGridTransition(LP_REVMA_BRANCH_C,
            c_observation_grid, event_type, c_row, c_projection))
         return false;
      ulong u_event_hash = 0;
      ulong c_event_hash = 0;
      if(!m_discovery_telemetry.AppendTransition(u_row, u_event_hash) ||
         u_event_hash == 0 ||
         !m_discovery_telemetry.AppendTransition(c_row, c_event_hash) ||
         c_event_hash == 0 ||
         !m_discovery_shadow_portfolio.BindMatchedTerminalEvidenceEvents(
            u_observation_grid.symbol_id, u_row.source_m1_time,
            u_projection.projection_hash,
            u_projection.terminal_internal_state_hash, u_event_hash,
            c_projection.projection_hash,
            c_projection.terminal_internal_state_hash, c_event_hash) ||
         (event_type == LP_REVMA_TELEMETRY_GRID_CLOSE &&
          (!AppendDiscoveryGridSummary(LP_REVMA_BRANCH_U,
              u_observation_grid.symbol_id) ||
           !AppendDiscoveryGridSummary(LP_REVMA_BRANCH_C,
              c_observation_grid.symbol_id))))
         return false;
      return true;
   }

   bool EmitShadowCenterLatch(const LP_RevmaShadowGrid &grid)
   {
      LP_RevmaDiscoveryTransitionRow row;
      LP_RevmaTerminalGridProjection projection;
      if(!grid.active || !grid.center_support.adverse_adds_frozen ||
         !BuildShadowGridTransition(LP_REVMA_BRANCH_C, grid,
            LP_REVMA_TELEMETRY_CENTER_LATCH, row, projection))
         return false;
      ulong event_hash = 0;
      return m_discovery_telemetry.AppendTransition(row, event_hash) &&
         event_hash != 0;
   }

   bool CacheDiscoveryCohort(
      LP_RevmaCompletedM1Snapshot &snapshots[],
      const int snapshot_count,
      const datetime source_m1_time)
   {
      m_discovery_last_cohort_valid = false;
      m_discovery_last_cohort_hash = 0;
      m_discovery_last_cohort_signal_hash = 0;
      m_discovery_last_cohort_strategy_hash = 0;
      if(snapshot_count != LP_SYMBOL_COUNT || source_m1_time <= 0)
         return false;
      bool seen[LP_SYMBOL_COUNT];
      LP_RevmaCompletedM1Snapshot staged[LP_SYMBOL_COUNT];
      for(int i = 0; i < LP_SYMBOL_COUNT; i++) seen[i] = false;
      for(int i = 0; i < snapshot_count; i++)
      {
         int symbol_id = snapshots[i].symbol_id;
         if(!LP_RevmaCompletedM1SnapshotValid(snapshots[i]) ||
            snapshots[i].source_m1_time != source_m1_time ||
            symbol_id < 0 || symbol_id >= LP_SYMBOL_COUNT || seen[symbol_id])
            return false;
         staged[symbol_id] = snapshots[i];
         seen[symbol_id] = true;
      }
      for(int symbol_id = 0; symbol_id < LP_SYMBOL_COUNT; symbol_id++)
      {
         if(!seen[symbol_id])
            return false;
      }
      ulong cohort_hash = LP_HashString(
         "gate108_fx28_completed_m1_cohort_v1");
      ulong signal_hash = LP_HashString(
         "gate108_fx28_signal_identity_set_v1");
      ulong strategy_hash = LP_HashString(
         "gate108_fx28_strategy_state_identity_set_v1");
      LP_HashMixLong(cohort_hash, (long)source_m1_time);
      LP_HashMixLong(signal_hash, (long)source_m1_time);
      LP_HashMixLong(strategy_hash, (long)source_m1_time);
      for(int symbol_id = 0; symbol_id < LP_SYMBOL_COUNT; symbol_id++)
      {
         LP_HashMixInt(cohort_hash, symbol_id);
         LP_HashMixULong(cohort_hash, staged[symbol_id].snapshot_hash);
         LP_HashMixInt(signal_hash, symbol_id);
         LP_HashMixULong(signal_hash,
            staged[symbol_id].signal_identity_hash);
         LP_HashMixInt(strategy_hash, symbol_id);
         LP_HashMixULong(strategy_hash,
            staged[symbol_id].strategy_state_identity_hash);
      }
      if(cohort_hash == 0 || signal_hash == 0 || strategy_hash == 0)
         return false;
      for(int symbol_id = 0; symbol_id < LP_SYMBOL_COUNT; symbol_id++)
         m_discovery_last_cohort[symbol_id] = staged[symbol_id];
      m_discovery_last_cohort_hash = cohort_hash;
      m_discovery_last_cohort_signal_hash = signal_hash;
      m_discovery_last_cohort_strategy_hash = strategy_hash;
      if(!m_discovery_telemetry.RegisterCompletedM1CohortIdentity(
            source_m1_time, cohort_hash, signal_hash, strategy_hash))
         return false;
      m_discovery_last_cohort_valid = true;
      return true;
   }

   bool EmitDiscoveryCycleStart(
      const int branch,
      const ulong cycle_id,
      const long equity_reference_minor,
      const long budget_minor,
      const datetime source_m1_time)
   {
      if(!LP_RevmaDiscoveryBranchValid(branch) || cycle_id == 0 ||
         source_m1_time <= 0 || equity_reference_minor <= 0 ||
         budget_minor <= 0)
         return false;
      if(m_discovery_telemetry_cycle_started[branch] == cycle_id)
         return true;
      if(m_discovery_telemetry_cycle_sealed[branch] >=
            (ulong)LP_REVMA_GEOMETRY_ABS_LIMIT ||
         cycle_id != m_discovery_telemetry_cycle_sealed[branch] + 1 ||
         (m_discovery_telemetry_cycle_started[branch] != 0 &&
          m_discovery_telemetry_cycle_started[branch] !=
             m_discovery_telemetry_cycle_sealed[branch]))
         return false;
      LP_RevmaDiscoveryTransitionRow row;
      if(!m_discovery_telemetry.SeedTransitionRow(row))
         return false;
      row.event_type = LP_REVMA_TELEMETRY_CYCLE_START;
      row.event_time = TimeCurrent() < source_m1_time ?
         source_m1_time : TimeCurrent();
      row.source_m1_time = source_m1_time;
      row.branch = branch;
      row.branch_cycle_id = cycle_id;
      row.account_cycle_id = cycle_id;
      row.symbol_id = -1;
      row.direction = LP_SIDE_NONE;
      row.equity_reference_minor = equity_reference_minor;
      row.budget_minor = budget_minor;
      row.decision = "OPEN";
      row.reason = cycle_id == 1 ? "run_cycle_start" :
         "confirmed_flat_next_cycle_start";
      ulong event_hash = 0;
      if(!m_discovery_telemetry.AppendTransition(row, event_hash) ||
         event_hash == 0)
         return false;
      m_discovery_telemetry_cycle_started[branch] = cycle_id;
      m_discovery_telemetry_close_owner[branch] =
         LP_REVMA_DISCOVERY_CLOSE_NONE;
      m_discovery_telemetry_close_complete[branch] = false;
      return true;
   }

   bool BuildShadowCandidateTransition(
      const LP_RevmaShadowCandidate &candidate,
      const int event_type,
      const string decision,
      const string reason,
      LP_RevmaDiscoveryTransitionRow &row)
   {
      LP_RevmaShadowPortfolioState portfolio;
      LP_RevmaShadowGrid grid;
      if(!m_discovery_last_cohort_valid || candidate.symbol_id < 0 ||
         candidate.symbol_id >= LP_SYMBOL_COUNT ||
         !m_discovery_shadow_portfolio.GetPortfolio(candidate.branch,
            portfolio) ||
         !m_discovery_shadow_portfolio.GetGrid(candidate.branch,
            candidate.symbol_id, grid) ||
         m_discovery_last_cohort[candidate.symbol_id].source_m1_time !=
             candidate.source_m1_time ||
         m_discovery_last_cohort[candidate.symbol_id].snapshot_hash !=
            candidate.shared_observation_snapshot_hash ||
         m_discovery_last_cohort[candidate.symbol_id].
            strategy_state_identity_hash !=
               candidate.strategy_state_identity_hash ||
         m_discovery_last_cohort[candidate.symbol_id].
            initial_history_boundary != candidate.initial_history_boundary ||
         !m_discovery_telemetry.SeedTransitionRow(row))
         return false;
      LP_RevmaCompletedM1Snapshot snapshot =
         m_discovery_last_cohort[candidate.symbol_id];
      bool terminal_admission = event_type ==
            LP_REVMA_TELEMETRY_BRANCH_BIRTH ||
         event_type == LP_REVMA_TELEMETRY_ATOM_ADMISSION;
      bool observation_before_admission = event_type ==
         LP_REVMA_TELEMETRY_FAVORABLE_ELIGIBLE_AFTER_LATCH;
      int current_atoms = grid.active ? grid.atom_count : 0;
      if(observation_before_admission && candidate.committed)
         current_atoms--;
      if(current_atoms < 0)
         return false;
      int atoms_before = terminal_admission ? current_atoms - 1 :
         current_atoms;
      int atoms_after = terminal_admission ? current_atoms : current_atoms;
      if(atoms_before < 0)
         return false;

      LP_RevmaDiscoveryMesh mesh;
      LP_RevmaPathGeometryState path;
      LP_RevmaCenterSupportState center =
         candidate.center_support_snapshot;
      LP_ResetRevmaDiscoveryMesh(mesh);
      LP_ResetRevmaPathGeometryState(path);
      bool use_committed_grid = grid.branch_grid_id ==
            candidate.branch_grid_id &&
         (grid.active || grid.last_flat_m1_time == candidate.source_m1_time);
      if(use_committed_grid)
      {
         mesh = grid.discovery_mesh;
         path = grid.path_geometry;
      }
      else if(!candidate.birth ||
         !LP_RevmaBuildDiscoveryMesh(candidate.q0,
            candidate.broker_tick_size, mesh) ||
         !LP_RevmaInitializePathGeometry(candidate.p0, mesh,
            candidate.source_m1_time, path))
         return false;
      long latest_jump = MathAbs(path.current_cell_index -
         path.previous_cell_index);
      long unfilled_jump = terminal_admission && latest_jump > 0 ?
         latest_jump - 1 : latest_jump;
      datetime positive_m1 = use_committed_grid ?
         grid.last_positive_liquidation_opportunity_m1 : 0;
      int underwater = use_committed_grid ? grid.time_underwater_minutes : 0;
      datetime birth_time = candidate.birth ? candidate.source_m1_time :
         grid.birth_m1_time;
      datetime initial_history = candidate.initial_history_boundary;
      // The bridge derives branch-specific C authority fields.  Identity must
      // therefore be present before observation materialization.
      row.branch = candidate.branch;
      if(!LP_RevmaBridgePopulateObservation(row, snapshot,
            candidate.direction, candidate.p0, candidate.c0, candidate.q0,
            candidate.stress_price, candidate.fill_price, birth_time,
            initial_history, positive_m1, underwater, unfilled_jump,
            mesh, center, path))
         return false;

      row.event_type = event_type;
      row.branch_grid_id = candidate.branch_grid_id;
      row.branch_cycle_id = portfolio.cycle_id;
      row.account_cycle_id = portfolio.cycle_id;
      row.grid_generation = candidate.grid_generation;
      row.candidate_identity = candidate.candidate_identity;
      row.shared_origin_id = candidate.shared_origin_id;
      row.opportunity_id = (event_type ==
            LP_REVMA_TELEMETRY_FAVORABLE_ELIGIBLE_AFTER_LATCH ||
         event_type == LP_REVMA_TELEMETRY_FIRST_INFEASIBILITY) ? 0 :
            candidate.opportunity_id;
      row.matched_snapshot_hash = candidate.matched_snapshot_hash;
      row.pre_candidate_state_hash = candidate.pre_candidate_state_hash;
      row.candidate_type = candidate.candidate_type;
      row.atoms_before = atoms_before;
      row.atoms_after = atoms_after;
      row.lots_before = NormalizeDouble((double)atoms_before *
         LP_REVMA_DISCOVERY_ATOM_LOTS, 2);
      row.lots_after = NormalizeDouble((double)atoms_after *
         LP_REVMA_DISCOVERY_ATOM_LOTS, 2);
      long current_reservation = use_committed_grid ?
         grid.reservation_minor : 0;
      long current_q_cash = use_committed_grid ? grid.q_cash_minor : 0;
      long current_margin = use_committed_grid ? grid.margin_minor : 0;
      long current_mark = use_committed_grid ?
         grid.marked_liquidation_minor : 0;
      long current_cost = use_committed_grid ?
         grid.estimated_close_cost_minor : 0;
      int adverse_count = use_committed_grid ? grid.adverse_add_count : 0;
      int favorable_count = use_committed_grid ? grid.favorable_add_count : 0;
      double weighted_entry = use_committed_grid ?
         grid.weighted_entry_price_lots : candidate.fill_price *
            LP_REVMA_DISCOVERY_ATOM_LOTS;
      if(observation_before_admission && candidate.committed)
      {
         if(!LP_RevmaTelemetrySafeMinorAdd(current_reservation,
               -candidate.committed_reservation_delta_minor,
               current_reservation) ||
            !LP_RevmaTelemetrySafeMinorAdd(current_q_cash,
               -candidate.incremental_q_cash_minor, current_q_cash) ||
            !LP_RevmaTelemetrySafeMinorAdd(current_margin,
               -candidate.incremental_margin_minor, current_margin) ||
            !LP_RevmaTelemetrySafeMinorAdd(current_mark,
               -candidate.incremental_liquidation_minor, current_mark) ||
            !LP_RevmaTelemetrySafeMinorAdd(current_cost,
               -candidate.incremental_close_cost_minor, current_cost))
            return false;
         weighted_entry -= candidate.fill_price * candidate.lots;
         if(candidate.candidate_type ==
               LP_REVMA_DISCOVERY_CANDIDATE_ADVERSE_ADD)
            adverse_count--;
         else
            favorable_count--;
      }
      int reserved_atoms = current_atoms <= 0 ? 0 :
         (current_atoms < 2 ? 2 : current_atoms);
      int prospective_atoms = terminal_admission ? atoms_after :
         atoms_before + 1;
      int prospective_reserved_atoms = prospective_atoms < 2 ? 2 :
         prospective_atoms;
      long candidate_current_reservation = 0;
      if(!LP_RevmaTelemetrySafeMinorMultiply(candidate.a_g_candidate_minor,
            reserved_atoms, candidate_current_reservation) ||
         !LP_RevmaTelemetrySafeMinorMultiply(candidate.a_g_candidate_minor,
            prospective_reserved_atoms,
            row.prospective_reservation_minor) ||
         !LP_RevmaTelemetrySafeMinorMultiply(candidate.a_g_candidate_minor,
            prospective_atoms, row.prospective_q_cash_minor))
         return false;
      row.reservation_minor = current_reservation;
      row.q_cash_minor = current_q_cash;
      row.a_g_candidate_minor = candidate.a_g_candidate_minor;
      row.a_g_minor = candidate.a_g_minor;
      row.reservation_overrun = current_reservation >
         candidate_current_reservation;
      row.reservation_overrun_minor = row.reservation_overrun ?
         current_reservation - candidate_current_reservation : 0;
      row.margin_minor = current_margin;
      row.incremental_margin_minor = candidate.incremental_margin_minor;
      row.incremental_liquidation_minor =
         candidate.incremental_liquidation_minor;
      row.incremental_close_cost_minor =
         candidate.incremental_close_cost_minor;
      row.concentration_q_cash_minor =
         candidate.concentration_q_cash_minor;
      row.concentration_currency_id =
         candidate.concentration_currency_id;
      row.liquidation_cost_minor = current_cost;
      row.maximum_adverse_excursion_minor = use_committed_grid ?
         grid.maximum_adverse_excursion_minor : 0;
      row.weighted_entry_sum = weighted_entry;
      row.adverse_add_count = adverse_count;
      row.favorable_add_count = favorable_count;
      row.harvest_minor = use_committed_grid ?
         grid.realized_harvest_minor : 0;
      row.nonharvest_minor = use_committed_grid ?
         grid.realized_nonharvest_minor : 0;
      row.liability_minor = current_mark;
      row.budget_minor = portfolio.capital_budget_minor;
      row.equity_reference_minor = portfolio.equity_reference_minor;
      row.close_owner = use_committed_grid ? grid.close_owner :
         LP_REVMA_DISCOVERY_CLOSE_NONE;
      row.decision = decision;
      row.reason = reason;
      return true;
   }

   bool EmitShadowCandidateTransitions(const int branch)
   {
      LP_RevmaShadowPortfolioState portfolio;
      if((branch != LP_REVMA_BRANCH_U && branch != LP_REVMA_BRANCH_C) ||
         !m_discovery_shadow_portfolio.GetPortfolio(branch, portfolio) ||
         portfolio.cycle_id == 0 ||
         m_discovery_telemetry_cycle_started[branch] != portfolio.cycle_id ||
         m_discovery_telemetry_cycle_sealed[branch] >= portfolio.cycle_id)
         return false;
      int count = m_discovery_shadow_portfolio.CandidateCount(branch);
      for(int i = 0; i < count; i++)
      {
         LP_RevmaShadowCandidate candidate;
         if(!m_discovery_shadow_portfolio.GetCandidate(branch, i,
               candidate) || !candidate.valid ||
            (candidate.decision != LP_REVMA_DISCOVERY_DECISION_ADMIT &&
             candidate.decision != LP_REVMA_DISCOVERY_DECISION_REJECT))
            return false;
         if(branch == LP_REVMA_BRANCH_C &&
            candidate.center_support_snapshot.adverse_adds_frozen &&
            candidate.candidate_type ==
               LP_REVMA_DISCOVERY_CANDIDATE_FAVORABLE_ADD)
         {
            LP_RevmaDiscoveryTransitionRow eligible;
            if(!BuildShadowCandidateTransition(candidate,
                  LP_REVMA_TELEMETRY_FAVORABLE_ELIGIBLE_AFTER_LATCH,
                  "ELIGIBLE", "signed_center_support_favorable_add_eligible",
                  eligible))
               return false;
            ulong eligible_hash = 0;
            if(!m_discovery_telemetry.AppendTransition(eligible,
                  eligible_hash) || eligible_hash == 0)
               return false;
         }
         int event_type = candidate.decision ==
               LP_REVMA_DISCOVERY_DECISION_ADMIT ?
            (candidate.birth ? LP_REVMA_TELEMETRY_BRANCH_BIRTH :
             LP_REVMA_TELEMETRY_ATOM_ADMISSION) :
            (candidate.decision_reason ==
               "signed_center_support_adverse_adds_frozen" ?
             LP_REVMA_TELEMETRY_CENTER_BLOCKED_ADVERSE :
             LP_REVMA_TELEMETRY_CANDIDATE_REJECTION);
         LP_RevmaDiscoveryTransitionRow terminal;
         if(!BuildShadowCandidateTransition(candidate, event_type,
               candidate.decision == LP_REVMA_DISCOVERY_DECISION_ADMIT ?
                  "ADMIT" : "REJECT",
               candidate.decision == LP_REVMA_DISCOVERY_DECISION_ADMIT ?
                  "formula_admission" : candidate.decision_reason,
               terminal))
            return false;
         ulong terminal_hash = 0;
         if(!m_discovery_telemetry.AppendTransition(terminal,
               terminal_hash) || terminal_hash == 0)
            return false;
         if(candidate.decision == LP_REVMA_DISCOVERY_DECISION_REJECT &&
            candidate.decision_reason !=
               "signed_center_support_adverse_adds_frozen" &&
            m_discovery_first_infeasibility_cycle[branch] !=
               terminal.branch_cycle_id)
         {
            LP_RevmaDiscoveryTransitionRow marker = terminal;
            marker.event_type = LP_REVMA_TELEMETRY_FIRST_INFEASIBILITY;
            marker.sequence = 0;
            marker.event_hash = 0;
            marker.reconciliation_hash = 0;
            marker.opportunity_id = 0;
            ulong marker_hash = 0;
            if(!m_discovery_telemetry.AppendTransition(marker,
                  marker_hash) || marker_hash == 0)
               return false;
            m_discovery_first_infeasibility_cycle[branch] =
               terminal.branch_cycle_id;
         }
         if(!m_discovery_first_divergence_emitted &&
            branch == LP_REVMA_BRANCH_C &&
            event_type == LP_REVMA_TELEMETRY_CENTER_BLOCKED_ADVERSE &&
            candidate.opportunity_id != 0 &&
            candidate.opportunity_id == m_discovery_shadow_portfolio.
               FirstCausalDivergenceOpportunityId())
         {
            LP_RevmaDiscoveryTransitionRow divergence = terminal;
            divergence.event_type = LP_REVMA_TELEMETRY_FIRST_DIVERGENCE;
            divergence.sequence = 0;
            divergence.event_hash = 0;
            divergence.reconciliation_hash = 0;
            ulong divergence_hash = 0;
            if(!m_discovery_telemetry.AppendTransition(divergence,
                  divergence_hash) || divergence_hash == 0)
               return false;
            m_discovery_first_divergence_emitted = true;
         }
      }
      return true;
   }

   bool BuildRealCandidateTransition(
      const LP_RevmaRealCandidate &candidate,
      LP_RevmaDiscoveryTransitionRow &row)
   {
      if(!candidate.valid || !candidate.terminal ||
         (candidate.decision != LP_REVMA_DISCOVERY_DECISION_ADMIT &&
          candidate.decision != LP_REVMA_DISCOVERY_DECISION_REJECT) ||
         !LP_RevmaCompletedM1SnapshotValid(candidate.snapshot) ||
         candidate.snapshot.source_m1_time != candidate.source_m1_time ||
         candidate.snapshot.snapshot_hash != candidate.shared_snapshot_hash ||
         candidate.snapshot.strategy_state_identity_hash !=
            candidate.strategy_state_identity_hash ||
         candidate.initial_history_boundary !=
            candidate.snapshot.initial_history_boundary ||
         !m_discovery_telemetry.SeedTransitionRow(row))
         return false;
      LP_RevmaRealPortfolioState portfolio;
      LP_RevmaRealGrid grid;
      if(!m_discovery_real_portfolio.GetPortfolio(portfolio) ||
         !m_discovery_real_portfolio.GetGrid(candidate.symbol_id, grid))
         return false;
      bool admitted = candidate.decision ==
         LP_REVMA_DISCOVERY_DECISION_ADMIT;
      bool use_grid = grid.active &&
         grid.branch_grid_id == candidate.branch_grid_id &&
         grid.grid_generation == candidate.grid_generation;
      if(admitted != candidate.execution_committed ||
         (admitted && !use_grid))
         return false;
      LP_RevmaDiscoveryMesh mesh;
      LP_RevmaPathGeometryState path;
      LP_RevmaCenterSupportState center;
      LP_ResetRevmaDiscoveryMesh(mesh);
      LP_ResetRevmaPathGeometryState(path);
      LP_ResetRevmaCenterSupportState(center);
      double p0 = candidate.p0;
      double c0 = candidate.c0;
      double q0 = candidate.q0;
      double stress_price = candidate.stress_price;
      double fill_price = admitted ? candidate.actual_fill_price :
         candidate.fill_proxy_price;
      datetime birth_time = candidate.birth ? candidate.source_m1_time :
         grid.birth_m1_time;
      datetime initial_history = candidate.initial_history_boundary;
      datetime positive_m1 = 0;
      int underwater = 0;
      double weighted_entry = 0.0;
      int current_atoms = use_grid ? grid.atom_count : 0;
      int adverse_count = use_grid ? grid.adverse_add_count : 0;
      int favorable_count = use_grid ? grid.favorable_add_count : 0;
      if(use_grid)
      {
         p0 = grid.p0;
         c0 = grid.c0;
         q0 = grid.q0;
         stress_price = grid.stress_reference_price;
         birth_time = grid.birth_m1_time;
         initial_history = grid.initial_history_boundary;
         positive_m1 = grid.last_positive_liquidation_opportunity_m1;
         underwater = grid.time_underwater_minutes;
         weighted_entry = grid.weighted_entry_price_lots;
         mesh = grid.mesh;
         path = grid.path;
         center = grid.center_support;
      }
      else
      {
         if(!candidate.birth ||
            !LP_RevmaBuildDiscoveryMesh(q0, candidate.broker_tick_size,
               mesh) ||
            !LP_RevmaInitializePathGeometry(p0, mesh,
               candidate.source_m1_time, path) ||
            !LP_RevmaInitializeCenterSupport(candidate.direction, p0, c0,
               q0, candidate.broker_tick_size,
               candidate.snapshot.signal.q_event_count,
               candidate.source_m1_time, center))
            return false;
      }
      row.branch = LP_REVMA_BRANCH_R;
      long latest_jump = MathAbs(path.current_cell_index -
         path.previous_cell_index);
      long unfilled_jump = admitted && latest_jump > 0 ?
         latest_jump - 1 : latest_jump;
      if(!LP_RevmaBridgePopulateObservation(row, candidate.snapshot,
            candidate.direction, p0, c0, q0, stress_price, fill_price,
            birth_time, initial_history, positive_m1, underwater,
            unfilled_jump, mesh, center, path))
         return false;
      row.event_type = admitted ?
         (candidate.birth ? LP_REVMA_TELEMETRY_BRANCH_BIRTH :
          LP_REVMA_TELEMETRY_ATOM_ADMISSION) :
         LP_REVMA_TELEMETRY_CANDIDATE_REJECTION;
      row.branch_grid_id = candidate.branch_grid_id;
      row.branch_cycle_id = candidate.branch_cycle_id;
      row.account_cycle_id = candidate.branch_cycle_id;
      row.grid_generation = candidate.grid_generation;
      row.candidate_identity = candidate.candidate_identity;
      row.matched_snapshot_hash = admitted ?
         candidate.telemetry_matched_snapshot_hash :
         candidate.matched_snapshot_hash;
      row.pre_candidate_state_hash = candidate.pre_candidate_state_hash;
      row.candidate_type = candidate.candidate_type;
      row.atoms_before = admitted ? current_atoms - 1 : current_atoms;
      row.atoms_after = admitted ? current_atoms : current_atoms;
      if(row.atoms_before < 0)
         return false;
      row.lots_before = NormalizeDouble((double)row.atoms_before *
         LP_REVMA_DISCOVERY_ATOM_LOTS, 2);
      row.lots_after = NormalizeDouble((double)row.atoms_after *
         LP_REVMA_DISCOVERY_ATOM_LOTS, 2);
      long current_a_g = use_grid ? grid.a_g_minor :
         candidate.a_g_candidate_minor;
      row.a_g_candidate_minor = candidate.a_g_candidate_minor;
      row.a_g_minor = admitted ? candidate.actual_a_g_minor : current_a_g;
      int current_reserved_atoms = current_atoms <= 0 ? 0 : 2;
      int prospective_atoms = admitted ? row.atoms_after :
         row.atoms_before + 1;
      int prospective_reserved_atoms = prospective_atoms <= 0 ? 0 : 2;
      long candidate_current_reservation = 0;
      if(!LP_RevmaTelemetrySafeMinorMultiply(row.a_g_minor,
            current_reserved_atoms, row.reservation_minor) ||
         !LP_RevmaTelemetrySafeMinorMultiply(row.a_g_minor,
            current_atoms, row.q_cash_minor) ||
         !LP_RevmaTelemetrySafeMinorMultiply(row.a_g_candidate_minor,
            current_reserved_atoms, candidate_current_reservation) ||
         !LP_RevmaTelemetrySafeMinorMultiply(row.a_g_candidate_minor,
            prospective_reserved_atoms,
            row.prospective_reservation_minor) ||
         !LP_RevmaTelemetrySafeMinorMultiply(row.a_g_candidate_minor,
            prospective_atoms, row.prospective_q_cash_minor))
         return false;
      if(use_grid && (row.reservation_minor != grid.reservation_minor ||
         row.q_cash_minor != grid.q_cash_minor))
         return false;
      row.reservation_overrun = row.reservation_minor >
         candidate_current_reservation;
      row.reservation_overrun_minor = row.reservation_overrun ?
         row.reservation_minor - candidate_current_reservation : 0;
      row.margin_minor = use_grid ? grid.margin_minor : 0;
      row.incremental_margin_minor = admitted ?
         candidate.actual_incremental_margin_minor :
         candidate.incremental_margin_minor;
      row.incremental_liquidation_minor = admitted ?
         candidate.actual_incremental_liquidation_minor :
         candidate.incremental_liquidation_minor;
      row.incremental_close_cost_minor = admitted ?
         candidate.actual_incremental_close_cost_minor :
         candidate.incremental_close_cost_minor;
      row.concentration_q_cash_minor =
         candidate.prospective_concentration_q_cash_minor;
      row.concentration_currency_id =
         candidate.prospective_concentration_currency_id;
      row.commission_minor = admitted ? candidate.actual_commission_minor : 0;
      row.swap_minor = admitted ? candidate.actual_swap_minor : 0;
      row.liquidation_cost_minor = use_grid ? grid.realized_cost_minor : 0;
      row.maximum_adverse_excursion_minor = use_grid ?
         grid.maximum_adverse_excursion_minor : 0;
      row.weighted_entry_sum = use_grid ? weighted_entry :
         (candidate.birth ? 0.0 : weighted_entry);
      row.adverse_add_count = adverse_count;
      row.favorable_add_count = favorable_count;
      row.harvest_minor = 0;
      row.nonharvest_minor = 0;
      row.liability_minor = use_grid ? grid.marked_liquidation_minor : 0;
      row.budget_minor = portfolio.capital_budget_minor;
      row.equity_reference_minor = portfolio.equity_reference_minor;
      row.close_owner = use_grid ? grid.close_owner :
         LP_REVMA_DISCOVERY_CLOSE_NONE;
      row.decision = admitted ? "ADMIT" : "REJECT";
      row.reason = admitted ? "formula_admission_exact_fill" :
         candidate.decision_reason;
      return true;
   }

   bool EmitPendingShadowFirstDivergence()
   {
      if(m_discovery_first_divergence_emitted)
         return true;
      ulong opportunity_id = m_discovery_shadow_portfolio.
         FirstCausalDivergenceOpportunityId();
      if(opportunity_id == 0)
         return true;
      int count = m_discovery_shadow_portfolio.CandidateCount(
         LP_REVMA_BRANCH_C);
      for(int i = 0; i < count; i++)
      {
         LP_RevmaShadowCandidate candidate;
         if(!m_discovery_shadow_portfolio.GetCandidate(LP_REVMA_BRANCH_C,
               i, candidate))
            return false;
         if(candidate.opportunity_id != opportunity_id)
            continue;
         if(candidate.decision != LP_REVMA_DISCOVERY_DECISION_REJECT ||
            candidate.decision_reason !=
               "signed_center_support_adverse_adds_frozen")
            return false;
         LP_RevmaDiscoveryTransitionRow row;
         if(!BuildShadowCandidateTransition(candidate,
               LP_REVMA_TELEMETRY_FIRST_DIVERGENCE, "REJECT",
               candidate.decision_reason, row))
            return false;
         ulong event_hash = 0;
         if(!m_discovery_telemetry.AppendTransition(row, event_hash) ||
            event_hash == 0)
            return false;
         m_discovery_first_divergence_emitted = true;
         return true;
      }
      return false;
   }

   bool EmitPendingRealCandidateTransitions()
   {
      int count = m_discovery_real_portfolio.CandidateCount();
      for(int i = 0; i < count; i++)
      {
         LP_RevmaRealCandidate candidate;
         if(!m_discovery_real_portfolio.GetCandidate(i, candidate))
            return false;
         if(!candidate.terminal || candidate.telemetry_event_hash != 0)
            continue;
         LP_RevmaDiscoveryTransitionRow row;
         if(!BuildRealCandidateTransition(candidate, row))
            return false;
         ulong event_hash = 0;
         if(!m_discovery_telemetry.AppendTransition(row, event_hash) ||
            event_hash == 0 ||
            !m_discovery_real_portfolio.BindCandidateTelemetryEvent(
               candidate.candidate_identity, event_hash))
            return false;
         if(candidate.decision == LP_REVMA_DISCOVERY_DECISION_REJECT &&
            m_discovery_first_infeasibility_cycle[LP_REVMA_BRANCH_R] !=
               row.branch_cycle_id)
         {
            LP_RevmaDiscoveryTransitionRow marker = row;
            marker.event_type = LP_REVMA_TELEMETRY_FIRST_INFEASIBILITY;
            marker.sequence = 0;
            marker.event_hash = 0;
            marker.reconciliation_hash = 0;
            ulong marker_hash = 0;
            if(!m_discovery_telemetry.AppendTransition(marker, marker_hash) ||
               marker_hash == 0)
               return false;
            m_discovery_first_infeasibility_cycle[LP_REVMA_BRANCH_R] =
               row.branch_cycle_id;
         }
      }
      return true;
   }

   bool EmitRealGridTerminal(
      const LP_RevmaRealGrid &observation_grid,
      const int event_type)
   {
      if(!m_discovery_last_cohort_valid ||
         observation_grid.symbol_id < 0 ||
         observation_grid.symbol_id >= LP_SYMBOL_COUNT ||
         observation_grid.branch_grid_id == 0 ||
         observation_grid.average_entry_price <= 0.0 ||
         observation_grid.weighted_entry_price_lots <= 0.0)
         return false;
      LP_RevmaCompletedM1Snapshot snapshot =
         m_discovery_last_cohort[observation_grid.symbol_id];
      if(snapshot.source_m1_time != observation_grid.last_mark_m1_time)
         return false;
      LP_RevmaTerminalGridProjection projection;
      if(!m_discovery_real_portfolio.BuildTerminalGridProjection(
            observation_grid.symbol_id, snapshot.source_m1_time,
            projection))
         return false;
      LP_RevmaDiscoveryTransitionRow row;
      if(!m_discovery_telemetry.SeedTransitionRow(row))
         return false;
      row.branch = LP_REVMA_BRANCH_R;
      long unfilled_jump = MathAbs(observation_grid.path.current_cell_index -
         observation_grid.path.previous_cell_index);
      if(!LP_RevmaBridgePopulateObservation(row, snapshot,
            observation_grid.direction, observation_grid.p0,
            observation_grid.c0, observation_grid.q0,
            observation_grid.stress_reference_price,
            observation_grid.average_entry_price,
            observation_grid.birth_m1_time,
            observation_grid.initial_history_boundary,
            observation_grid.last_positive_liquidation_opportunity_m1,
            observation_grid.time_underwater_minutes, unfilled_jump,
            observation_grid.mesh, observation_grid.center_support,
            observation_grid.path))
         return false;
      LP_RevmaRealPortfolioState portfolio;
      if(!m_discovery_real_portfolio.GetPortfolio(portfolio))
         return false;
      row.event_type = event_type;
      row.branch_grid_id = observation_grid.branch_grid_id;
      row.branch_cycle_id = observation_grid.branch_cycle_id;
      row.account_cycle_id = observation_grid.branch_cycle_id;
      row.grid_generation = observation_grid.grid_generation;
      row.matched_snapshot_hash =
         observation_grid.birth_matched_snapshot_hash;
      row.a_g_candidate_minor = observation_grid.a_g_candidate_minor;
      row.a_g_minor = observation_grid.a_g_minor;
      row.atoms_before = projection.atoms_before;
      row.atoms_after = projection.atoms_after;
      row.lots_before = projection.lots_before;
      row.lots_after = projection.lots_after;
      row.reservation_minor = projection.reservation_minor;
      row.q_cash_minor = projection.q_cash_minor;
      int reserved_atoms = row.atoms_before <= 0 ? 0 : 2;
      long expected_reservation = 0;
      long expected_q_cash = 0;
      long candidate_current_reservation = 0;
      if(!LP_RevmaTelemetrySafeMinorMultiply(row.a_g_minor,
            reserved_atoms, expected_reservation) ||
         !LP_RevmaTelemetrySafeMinorMultiply(row.a_g_minor,
            row.atoms_before, expected_q_cash) ||
         !LP_RevmaTelemetrySafeMinorMultiply(row.a_g_candidate_minor,
            reserved_atoms, candidate_current_reservation) ||
         row.reservation_minor != expected_reservation ||
         row.q_cash_minor != expected_q_cash)
         return false;
      row.prospective_reservation_minor = candidate_current_reservation;
      if(!LP_RevmaTelemetrySafeMinorMultiply(row.a_g_candidate_minor,
            row.atoms_before, row.prospective_q_cash_minor))
         return false;
      row.reservation_overrun = row.reservation_minor >
         candidate_current_reservation;
      row.reservation_overrun_minor = row.reservation_overrun ?
         row.reservation_minor - candidate_current_reservation : 0;
      row.margin_minor = projection.margin_minor;
      row.liquidation_cost_minor = projection.cost_minor;
      row.maximum_adverse_excursion_minor =
         projection.maximum_adverse_excursion_minor;
      row.grid_age_minutes = projection.grid_age_minutes;
      row.time_underwater_minutes = projection.time_underwater_minutes;
      row.weighted_entry_sum =
         observation_grid.weighted_entry_price_lots;
      row.adverse_add_count = observation_grid.adverse_add_count;
      row.favorable_add_count = observation_grid.favorable_add_count;
      row.harvest_minor = projection.harvest_minor;
      row.nonharvest_minor = projection.nonharvest_minor;
      row.liability_minor = projection.liability_minor;
      row.budget_minor = portfolio.capital_budget_minor;
      row.equity_reference_minor = portfolio.equity_reference_minor;
      row.close_owner = projection.close_owner;
      row.grid_terminal_reason = projection.origin_terminal_reason;
      row.terminal_internal_state_hash =
         projection.terminal_internal_state_hash;
      row.terminal_projection_hash = projection.projection_hash;
      row.decision = event_type == LP_REVMA_TELEMETRY_GRID_CLOSE ?
         "CLOSE" : "SNAPSHOT";
      row.reason = event_type == LP_REVMA_TELEMETRY_GRID_CLOSE ?
         row.grid_terminal_reason :
         "run_boundary_unresolved_grid_snapshot";
      ulong event_hash = 0;
      if(!m_discovery_telemetry.AppendTransition(row, event_hash) ||
         event_hash == 0 ||
         !m_discovery_real_portfolio.BindTerminalEvidenceEvent(
            observation_grid.symbol_id, row.source_m1_time,
            projection.projection_hash,
            projection.terminal_internal_state_hash, event_hash) ||
         (event_type == LP_REVMA_TELEMETRY_GRID_CLOSE &&
          !AppendDiscoveryGridSummary(LP_REVMA_BRANCH_R,
             observation_grid.symbol_id)))
         return false;
      return true;
   }

   bool SealDiscoveryBranchCycle(
      const int branch,
      const datetime terminal_m1_time,
      const LP_RevmaConcurrentBranchRiskState &risk,
      const bool expected_final_flat,
      const bool formula_clean,
      const bool reconciliation_clean,
      const bool broker_contamination,
      const bool cleanup_shortfall)
   {
      if(!LP_RevmaDiscoveryBranchValid(branch) || terminal_m1_time <= 0 ||
         !LP_RevmaConcurrentBranchRiskStateValid(risk) ||
         risk.branch != branch || risk.source_m1_time != terminal_m1_time)
         return false;
      if(m_discovery_telemetry_cycle_sealed[branch] ==
            m_discovery_telemetry_cycle_started[branch])
         return m_discovery_telemetry_cycle_sealed[branch] != 0;
      ulong cycle_id = 0;
      long equity_reference_minor = 0;
      long budget_minor = 0;
      long harvest_minor = 0;
      long nonharvest_minor = 0;
      int portfolio_atom_count = 0;
      int portfolio_active_grid_count = 0;
      long portfolio_reservation_minor = 0;
      long portfolio_q_cash_minor = 0;
      long portfolio_margin_minor = 0;
      long portfolio_marked_liquidation_minor = 0;
      long portfolio_branch_equity_minor = 0;
      long portfolio_concentration_q_cash_minor = 0;
      int portfolio_concentration_currency_id = -1;
      int close_owner = LP_REVMA_DISCOVERY_CLOSE_NONE;
      bool final_flat = false;
      if(branch == LP_REVMA_BRANCH_R)
      {
         LP_RevmaRealPortfolioState portfolio;
         if(!m_discovery_real_portfolio.GetPortfolio(portfolio))
            return false;
         cycle_id = portfolio.cycle_id;
         equity_reference_minor = portfolio.equity_reference_minor;
         budget_minor = portfolio.capital_budget_minor;
         harvest_minor = portfolio.realized_harvest_minor;
         nonharvest_minor = portfolio.realized_nonharvest_minor;
         portfolio_atom_count = portfolio.atom_count;
         portfolio_active_grid_count = portfolio.active_grid_count;
         portfolio_reservation_minor = portfolio.reservation_minor;
         portfolio_q_cash_minor = portfolio.q_cash_minor;
         portfolio_margin_minor = portfolio.margin_minor;
         portfolio_marked_liquidation_minor =
            portfolio.marked_liquidation_minor;
         portfolio_branch_equity_minor = portfolio.branch_equity_minor;
         portfolio_concentration_q_cash_minor =
            portfolio.concentration_q_cash_minor;
         portfolio_concentration_currency_id =
            portfolio.concentration_currency_id;
         close_owner = portfolio.close_owner;
         final_flat = portfolio.active_grid_count == 0;
      }
      else
      {
         LP_RevmaShadowPortfolioState portfolio;
         if(!m_discovery_shadow_portfolio.GetPortfolio(branch, portfolio))
            return false;
         cycle_id = portfolio.cycle_id;
         equity_reference_minor = portfolio.equity_reference_minor;
         budget_minor = portfolio.capital_budget_minor;
         harvest_minor = portfolio.realized_harvest_minor;
         nonharvest_minor = portfolio.realized_nonharvest_minor;
         portfolio_atom_count = portfolio.atom_count;
         portfolio_active_grid_count = portfolio.active_grid_count;
         portfolio_reservation_minor = portfolio.reservation_minor;
         portfolio_q_cash_minor = portfolio.q_cash_minor;
         portfolio_margin_minor = portfolio.margin_minor;
         portfolio_marked_liquidation_minor =
            portfolio.marked_liquidation_minor;
         portfolio_branch_equity_minor = portfolio.branch_equity_minor;
         portfolio_concentration_q_cash_minor =
            portfolio.concentration_q_cash_minor;
         portfolio_concentration_currency_id =
            portfolio.concentration_currency_id;
         close_owner = portfolio.close_owner;
         final_flat = portfolio.active_grid_count == 0;
      }
      if(cycle_id == 0 || expected_final_flat != final_flat ||
         m_discovery_telemetry_cycle_started[branch] != cycle_id ||
         m_discovery_telemetry_cycle_sealed[branch] >= cycle_id ||
         risk.atom_count != portfolio_atom_count ||
         risk.active_grid_count != portfolio_active_grid_count ||
         risk.reservation_minor != portfolio_reservation_minor ||
         risk.q_cash_minor != portfolio_q_cash_minor ||
         risk.margin_minor != portfolio_margin_minor ||
         risk.marked_liquidation_minor !=
            portfolio_marked_liquidation_minor ||
         risk.branch_equity_minor != portfolio_branch_equity_minor ||
         risk.concentration_q_cash_minor !=
            portfolio_concentration_q_cash_minor ||
         risk.concentration_currency_id !=
            portfolio_concentration_currency_id ||
         (final_flat && (risk.reservation_minor != 0 ||
          risk.margin_minor != 0 || risk.q_cash_minor != 0 ||
          risk.active_grid_count != 0)))
         return false;
      if(final_flat && close_owner != LP_REVMA_DISCOVERY_CLOSE_NONE &&
         !m_discovery_telemetry_close_complete[branch] &&
         !AppendDiscoveryPortfolioAuthorityComplete(branch, cycle_id,
            equity_reference_minor, budget_minor, harvest_minor,
            nonharvest_minor, close_owner, terminal_m1_time))
         return false;
      LP_RevmaDiscoveryTransitionRow boundary;
      if(!BuildDiscoveryPortfolioTransition(branch, cycle_id,
            equity_reference_minor, budget_minor, risk.atom_count,
            risk.reservation_minor, risk.q_cash_minor, risk.margin_minor,
            risk.marked_liquidation_minor, harvest_minor, nonharvest_minor,
            risk.concentration_q_cash_minor,
            risk.concentration_currency_id, close_owner,
            terminal_m1_time,
            final_flat ? LP_REVMA_TELEMETRY_CYCLE_CLOSE :
               LP_REVMA_TELEMETRY_RUN_BOUNDARY_UNRESOLVED,
            final_flat ? "CLOSE" : "SNAPSHOT",
            final_flat ?
               (close_owner == LP_REVMA_DISCOVERY_CLOSE_HARD_RISK ?
                  "account_risk" :
                (close_owner == LP_REVMA_DISCOVERY_CLOSE_CLEANUP ?
                   "account_cleanup" : "cycle_flat")) :
               "run_boundary_unresolved", boundary))
         return false;
      ulong boundary_hash = 0;
      if(!m_discovery_telemetry.AppendTransition(boundary, boundary_hash) ||
         boundary_hash == 0)
         return false;

      if(!final_flat)
      {
         for(int symbol_id = 0; symbol_id < LP_SYMBOL_COUNT; symbol_id++)
         {
            bool active = false;
            if(branch == LP_REVMA_BRANCH_R)
            {
               LP_RevmaRealGrid grid;
               if(!m_discovery_real_portfolio.GetGrid(symbol_id, grid))
                  return false;
               active = grid.active && grid.branch_cycle_id == cycle_id;
            }
            else
            {
               LP_RevmaShadowGrid grid;
               if(!m_discovery_shadow_portfolio.GetGrid(branch, symbol_id,
                     grid))
                  return false;
               active = grid.active && grid.branch_cycle_id == cycle_id;
            }
            if(active && !AppendDiscoveryGridSummary(branch, symbol_id))
               return false;
         }
      }
      for(int symbol_id = 0; symbol_id < LP_SYMBOL_COUNT; symbol_id++)
      {
         LP_RevmaDiscoverySummaryRow symbol_summary;
         if(!m_discovery_telemetry.BuildRollupSummaryBase("symbol", branch,
               symbol_id, symbol_summary) ||
            !m_discovery_telemetry.AppendSummary(symbol_summary))
            return false;
      }
      LP_RevmaDiscoverySummaryRow top_summary;
      if(!m_discovery_telemetry.BuildRollupSummaryBase("top_offender",
            branch, -1, top_summary) ||
         !m_discovery_telemetry.AppendSummary(top_summary))
         return false;
      LP_RevmaDiscoverySummaryRow cycle_summary;
      if(!m_discovery_telemetry.BuildRollupSummaryBase("cycle", branch, -1,
            cycle_summary))
         return false;
      cycle_summary.cleanup_shortfall = cleanup_shortfall;
      cycle_summary.broker_contamination = broker_contamination;
      cycle_summary.formula_clean = formula_clean;
      cycle_summary.reconciliation_clean = reconciliation_clean;
      if(!LP_RevmaBridgeApplyConcurrentRisk(cycle_summary, risk) ||
         !m_discovery_telemetry.AppendSummary(cycle_summary))
         return false;
      LP_RevmaDiscoverySummaryRow reconciliation_summary;
      if(!m_discovery_telemetry.BuildRollupSummaryBase("reconciliation",
            branch, -1, reconciliation_summary))
         return false;
      reconciliation_summary.cleanup_shortfall = cleanup_shortfall;
      reconciliation_summary.broker_contamination = broker_contamination;
      reconciliation_summary.formula_clean = formula_clean;
      reconciliation_summary.reconciliation_clean = reconciliation_clean;
      if(!LP_RevmaBridgeApplyConcurrentRisk(reconciliation_summary, risk) ||
         !m_discovery_telemetry.AppendSummary(reconciliation_summary))
         return false;
      m_discovery_telemetry_cycle_sealed[branch] = cycle_id;
      return true;
   }

   bool AppendDiscoveryRunCompletion(
      const int branch,
      const datetime terminal_m1_time,
      const bool final_flat,
      const ulong terminal_grid_state_hash,
      const LP_RevmaConcurrentBranchRiskState &terminal_risk,
      const ulong terminal_book_hash,
      const bool formula_clean,
      const bool reconciliation_clean,
      const bool broker_contamination,
      const bool cleanup_shortfall)
   {
      LP_RevmaDiscoverySummaryRow summary;
      if(terminal_m1_time <= 0 || terminal_grid_state_hash == 0 ||
         terminal_book_hash == 0 ||
         !m_discovery_telemetry.BuildRollupSummaryBase("run_completion",
            branch, -1, summary))
         return false;
      summary.terminal_source_m1_time = terminal_m1_time;
      summary.terminal_grid_state_hash = terminal_grid_state_hash;
      summary.terminal_book_hash = terminal_book_hash;
      summary.final_flat = final_flat;
      summary.unresolved_inventory = !final_flat;
      summary.cleanup_shortfall = cleanup_shortfall;
      summary.broker_contamination = broker_contamination;
      summary.formula_clean = formula_clean;
      summary.reconciliation_clean = reconciliation_clean;
      if(!LP_RevmaBridgeApplyConcurrentRisk(summary, terminal_risk) ||
         !m_discovery_telemetry.AppendSummary(summary))
         return false;
      return true;
   }

   bool EmitDiscoveryOpenGridTerminalSnapshots(
      const datetime terminal_m1_time)
   {
      if(!m_discovery_last_cohort_valid || terminal_m1_time <= 0)
         return false;
      for(int symbol_id = 0; symbol_id < LP_SYMBOL_COUNT; symbol_id++)
      {
         LP_RevmaRealGrid grid;
         if(!m_discovery_real_portfolio.GetGrid(symbol_id, grid))
            return false;
         if(grid.active && grid.terminal_event_hash == 0 &&
            !EmitRealGridTerminal(grid,
               LP_REVMA_TELEMETRY_GRID_TERMINAL_SNAPSHOT))
            return false;
      }
      bool matched = m_discovery_shadow_portfolio.CausalMatchingOpen();
      for(int symbol_id = 0; symbol_id < LP_SYMBOL_COUNT; symbol_id++)
      {
         LP_RevmaShadowGrid u_grid;
         LP_RevmaShadowGrid c_grid;
         if(!m_discovery_shadow_portfolio.GetGrid(LP_REVMA_BRANCH_U,
               symbol_id, u_grid) ||
            !m_discovery_shadow_portfolio.GetGrid(LP_REVMA_BRANCH_C,
               symbol_id, c_grid))
            return false;
         if(matched)
         {
            if(u_grid.active != c_grid.active)
               return false;
            if(u_grid.active && (u_grid.terminal_event_hash != 0 ||
               c_grid.terminal_event_hash != 0 ||
               !EmitMatchedShadowGridTerminals(u_grid, c_grid,
                  LP_REVMA_TELEMETRY_GRID_TERMINAL_SNAPSHOT)))
               return false;
         }
         else
         {
            if(u_grid.active && u_grid.terminal_event_hash == 0 &&
               !EmitShadowGridTerminal(LP_REVMA_BRANCH_U, u_grid,
                  LP_REVMA_TELEMETRY_GRID_TERMINAL_SNAPSHOT))
               return false;
            if(c_grid.active && c_grid.terminal_event_hash == 0 &&
               !EmitShadowGridTerminal(LP_REVMA_BRANCH_C, c_grid,
                  LP_REVMA_TELEMETRY_GRID_TERMINAL_SNAPSHOT))
               return false;
         }
      }
      return true;
   }

   bool SealDiscoveryFlatCycleBeforeReset(const int branch)
   {
      LP_RevmaConcurrentBranchRiskState risk;
      LP_ResetRevmaConcurrentBranchRiskState(risk);
      datetime terminal_m1_time = 0;
      bool formula_clean = true;
      bool cleanup_shortfall = false;
      if(branch == LP_REVMA_BRANCH_R)
      {
         LP_RevmaRealPortfolioState portfolio;
         if(!m_discovery_real_portfolio.GetPortfolio(portfolio) ||
            !portfolio.cycle_reset_required ||
            portfolio.active_grid_count != 0 ||
            portfolio.cycle_flat_m1_time <= 0 ||
            !m_discovery_real_portfolio.GetConcurrentRiskState(
               portfolio.cycle_flat_m1_time, risk))
            return false;
         terminal_m1_time = portfolio.cycle_flat_m1_time;
         formula_clean = portfolio.formula_clean;
         cleanup_shortfall = portfolio.cleanup_shortfall;
      }
      else
      {
         LP_RevmaShadowPortfolioState portfolio;
         if(!m_discovery_shadow_portfolio.GetPortfolio(branch, portfolio) ||
            !portfolio.cycle_reset_required ||
            portfolio.active_grid_count != 0 ||
            portfolio.cycle_flat_m1_time <= 0 ||
            !m_discovery_shadow_portfolio.GetConcurrentRiskState(branch,
               portfolio.cycle_flat_m1_time, risk))
            return false;
         terminal_m1_time = portfolio.cycle_flat_m1_time;
         cleanup_shortfall = portfolio.cleanup_shortfall;
      }
      return SealDiscoveryBranchCycle(branch, terminal_m1_time, risk, true,
         formula_clean, true, false, cleanup_shortfall);
   }

public:
   bool ReconcileDiscoveryRealConfirmedFlat(
      LP_GridBook &grid_book,
      const long actual_account_equity_minor)
   {
      if(!m_discovery_initialized || m_discovery_last_completed_m1 <= 0)
         return true;
      LP_RevmaRealPortfolioState portfolio_before;
      if(!m_discovery_real_portfolio.GetPortfolio(portfolio_before))
         return false;
      LP_RevmaRealGrid before[LP_SYMBOL_COUNT];
      for(int symbol_id = 0; symbol_id < LP_SYMBOL_COUNT; symbol_id++)
      {
         if(!m_discovery_real_portfolio.GetGrid(symbol_id,
               before[symbol_id]))
            return false;
      }
      if(!m_discovery_real_portfolio.ReconcileConfirmedFlat(grid_book,
            m_discovery_last_completed_m1,
            actual_account_equity_minor) ||
         !m_discovery_real_portfolio.ReconcileBrokerInventoryBijection(
            grid_book))
      {
         InvalidateDiscovery(
            m_discovery_real_portfolio.InvalidReason());
         return false;
      }
      int newly_flat_grid_count = 0;
      for(int symbol_id = 0; symbol_id < LP_SYMBOL_COUNT; symbol_id++)
      {
         LP_RevmaRealGrid after;
         if(!m_discovery_real_portfolio.GetGrid(symbol_id, after))
            return false;
         if(before[symbol_id].active && !after.active &&
            after.terminal_event_hash == 0 &&
            !EmitRealGridTerminal(before[symbol_id],
               LP_REVMA_TELEMETRY_GRID_CLOSE))
         {
            InvalidateDiscovery("real_terminal_close_telemetry_failed");
            return false;
         }
         if(before[symbol_id].active && !after.active)
            newly_flat_grid_count++;
      }
      LP_RevmaRealPortfolioState portfolio_after;
      if(!m_discovery_real_portfolio.GetPortfolio(portfolio_after))
         return false;
      if(portfolio_after.close_owner != portfolio_before.close_owner &&
         (portfolio_before.close_owner !=
             LP_REVMA_DISCOVERY_CLOSE_CLEANUP ||
          portfolio_after.close_owner !=
             LP_REVMA_DISCOVERY_CLOSE_HARD_RISK ||
          newly_flat_grid_count <= 0 ||
          !portfolio_after.hard_risk_latched ||
          portfolio_after.active_grid_count != 0 ||
          portfolio_after.atom_count != 0 ||
          portfolio_after.reservation_minor != 0 ||
          portfolio_after.q_cash_minor != 0 ||
          portfolio_after.margin_minor != 0 ||
          portfolio_after.marked_liquidation_minor != 0 ||
          portfolio_after.concentration_q_cash_minor != 0 ||
          portfolio_after.concentration_currency_id != -1 ||
          !AppendDiscoveryPortfolioAuthority(LP_REVMA_BRANCH_R,
             portfolio_after.cycle_id,
             portfolio_after.equity_reference_minor,
             portfolio_after.capital_budget_minor,
             portfolio_after.atom_count,
             portfolio_after.reservation_minor,
             portfolio_after.q_cash_minor,
             portfolio_after.margin_minor,
             portfolio_after.marked_liquidation_minor,
             portfolio_after.realized_harvest_minor,
             portfolio_after.realized_nonharvest_minor,
             portfolio_after.concentration_q_cash_minor,
             portfolio_after.concentration_currency_id,
             portfolio_before.close_owner,
             portfolio_after.close_owner,
             m_discovery_last_completed_m1)))
      {
         InvalidateDiscovery("real_flat_risk_escalation_telemetry_failed");
         return false;
      }
      if(portfolio_after.close_owner != LP_REVMA_DISCOVERY_CLOSE_NONE &&
         portfolio_after.active_grid_count == 0 &&
         portfolio_after.cycle_reset_required &&
         !m_discovery_telemetry_close_complete[LP_REVMA_BRANCH_R] &&
         !AppendDiscoveryPortfolioAuthorityComplete(LP_REVMA_BRANCH_R,
            portfolio_after.cycle_id,
            portfolio_after.equity_reference_minor,
            portfolio_after.capital_budget_minor,
            portfolio_after.realized_harvest_minor,
            portfolio_after.realized_nonharvest_minor,
            portfolio_after.close_owner,
            m_discovery_last_completed_m1))
      {
         InvalidateDiscovery("real_close_authority_completion_telemetry_failed");
         return false;
      }
      return true;
   }

   int ContinueDiscoveryRealCloses(
      LP_GridBook &grid_book,
      LP_IntentBus &bus,
      const datetime staging_source_m1_time)
   {
      if(!m_discovery_initialized || !m_discovery_valid)
         return 0;
      if(!m_discovery_real_portfolio.CloseWorkActive())
         return 0;
      datetime effective_source_m1_time = staging_source_m1_time > 0 ?
         staging_source_m1_time : m_discovery_last_completed_m1;
      if(effective_source_m1_time <= 0 ||
         ((long)effective_source_m1_time % 60) != 0 ||
         !m_discovery_last_cohort_valid ||
         m_discovery_last_cohort[0].source_m1_time !=
            effective_source_m1_time)
      {
         InvalidateDiscovery("real_close_stage_cohort_provenance_invalid");
         return 0;
      }
      int emitted = 0;
      for(int symbol_id = 0; symbol_id < LP_SYMBOL_COUNT; symbol_id++)
      {
         LP_RevmaRealGrid real_grid;
         if(!m_discovery_real_portfolio.GridCloseRequired(symbol_id,
               real_grid))
            continue;
         LP_GridInventoryRow grid;
         if(!grid_book.FindSymbolLaneGrid(symbol_id, LP_LANE_REVMA, grid) ||
            grid.grid_key != real_grid.broker_grid_key)
         {
            InvalidateDiscovery("real_close_grid_inventory_missing");
            return emitted;
         }
         LP_TradeIntent intent;
         LP_ResetTradeIntent(intent);
         BuildGridCloseIntent(grid.broker_symbol, grid,
            real_grid.origin_terminal_reason,
            "gate108_R_close_owner=" +
               IntegerToString(real_grid.close_owner),
            grid.floating_pnl, intent);
         intent.gate108 = true;
         intent.discovery_branch = LP_REVMA_BRANCH_R;
         intent.discovery_branch_grid_id = real_grid.branch_grid_id;
         intent.discovery_shared_snapshot_hash =
            real_grid.birth_shared_snapshot_hash;
         intent.discovery_source_m1_time =
            effective_source_m1_time;
         intent.discovery_close_owner = real_grid.close_owner;
         intent.discovery_origin_terminal_reason =
            real_grid.origin_terminal_reason;
         if(!bus.Add(intent) ||
            !m_discovery_real_portfolio.StageGridClose(symbol_id,
               effective_source_m1_time))
         {
            InvalidateDiscovery("real_close_intent_stage_failed");
            return emitted;
         }
         emitted++;
      }
      return emitted;
   }

   int ProcessDiscoveryCompletedM1Batch(
      LP_RevmaCompletedM1Snapshot &snapshots[],
      const int snapshot_count,
      LP_GridBook &grid_book,
      LP_IntentBus &bus)
   {
      if(!m_discovery_initialized || !m_discovery_valid ||
         snapshot_count != LP_SYMBOL_COUNT)
         return 0;
      datetime source_m1_time = snapshots[0].source_m1_time;
      bool seen[LP_SYMBOL_COUNT];
      for(int i = 0; i < LP_SYMBOL_COUNT; i++) seen[i] = false;
      for(int i = 0; i < snapshot_count; i++)
      {
         if(!LP_RevmaCompletedM1SnapshotValid(snapshots[i]) ||
            snapshots[i].source_m1_time != source_m1_time ||
            snapshots[i].symbol_id < 0 ||
            snapshots[i].symbol_id >= LP_SYMBOL_COUNT ||
            seen[snapshots[i].symbol_id])
         {
            InvalidateDiscovery("shared_completed_m1_cohort_invalid");
            return 0;
         }
         seen[snapshots[i].symbol_id] = true;
      }
      LP_RevmaShadowPortfolioState cycle_u;
      LP_RevmaShadowPortfolioState cycle_c;
      if(!m_discovery_shadow_portfolio.GetPortfolio(LP_REVMA_BRANCH_U,
            cycle_u) ||
         !m_discovery_shadow_portfolio.GetPortfolio(LP_REVMA_BRANCH_C,
            cycle_c))
      {
         InvalidateDiscovery("shadow_cycle_state_unavailable");
         return 0;
      }
      if(cycle_u.cycle_reset_required || cycle_c.cycle_reset_required)
      {
         if((cycle_u.cycle_reset_required &&
             !SealDiscoveryFlatCycleBeforeReset(LP_REVMA_BRANCH_U)) ||
            (cycle_c.cycle_reset_required &&
             !SealDiscoveryFlatCycleBeforeReset(LP_REVMA_BRANCH_C)))
         {
            InvalidateDiscovery("shadow_prior_cycle_telemetry_seal_failed");
            return 0;
         }
         bool cycle_ok = false;
         if(m_discovery_shadow_portfolio.CausalMatchingOpen())
         {
            cycle_ok = cycle_u.cycle_reset_required &&
               cycle_c.cycle_reset_required &&
               m_discovery_shadow_portfolio.BeginMatchedNextCycle(
                  cycle_u.cycle_id + 1, cycle_u.branch_equity_minor,
                  source_m1_time);
         }
         else
         {
            bool u_ok = !cycle_u.cycle_reset_required ||
               m_discovery_shadow_portfolio.BeginNextCycle(
                  LP_REVMA_BRANCH_U, cycle_u.cycle_id + 1,
                  cycle_u.branch_equity_minor, source_m1_time);
            bool c_ok = !cycle_c.cycle_reset_required ||
               m_discovery_shadow_portfolio.BeginNextCycle(
                  LP_REVMA_BRANCH_C, cycle_c.cycle_id + 1,
                  cycle_c.branch_equity_minor, source_m1_time);
            cycle_ok = u_ok && c_ok;
         }
         if(!cycle_ok)
         {
            InvalidateDiscovery("shadow_next_cycle_boundary_failed");
            return 0;
         }
      }
      if(m_discovery_real_portfolio.CycleResetRequired() &&
         (!SealDiscoveryFlatCycleBeforeReset(LP_REVMA_BRANCH_R) ||
          !m_discovery_real_portfolio.BeginNextCycle(
             m_discovery_real_portfolio.CycleId() + 1,
             m_discovery_real_portfolio.BranchEquityMinor(),
             source_m1_time)))
      {
         InvalidateDiscovery(
            m_discovery_real_portfolio.InvalidReason());
         return 0;
      }
      LP_RevmaRealPortfolioState cycle_r;
      if(!CacheDiscoveryCohort(snapshots, snapshot_count, source_m1_time) ||
         !m_discovery_real_portfolio.GetPortfolio(cycle_r) ||
         !m_discovery_shadow_portfolio.GetPortfolio(LP_REVMA_BRANCH_U,
            cycle_u) ||
         !m_discovery_shadow_portfolio.GetPortfolio(LP_REVMA_BRANCH_C,
            cycle_c) ||
         !EmitDiscoveryCycleStart(LP_REVMA_BRANCH_R, cycle_r.cycle_id,
            cycle_r.equity_reference_minor, cycle_r.capital_budget_minor,
            source_m1_time) ||
         !EmitDiscoveryCycleStart(LP_REVMA_BRANCH_U, cycle_u.cycle_id,
            cycle_u.equity_reference_minor, cycle_u.capital_budget_minor,
            source_m1_time) ||
         !EmitDiscoveryCycleStart(LP_REVMA_BRANCH_C, cycle_c.cycle_id,
            cycle_c.equity_reference_minor, cycle_c.capital_budget_minor,
            source_m1_time))
      {
         InvalidateDiscovery("discovery_cycle_start_or_cohort_cache_failed");
         return 0;
      }
      bool c_latched_before[LP_SYMBOL_COUNT];
      for(int symbol_id = 0; symbol_id < LP_SYMBOL_COUNT; symbol_id++)
      {
         LP_RevmaShadowGrid c_grid;
         if(!m_discovery_shadow_portfolio.GetGrid(LP_REVMA_BRANCH_C,
               symbol_id, c_grid))
         {
            InvalidateDiscovery("center_pre_mark_state_unavailable");
            return 0;
         }
         c_latched_before[symbol_id] = c_grid.active &&
            c_grid.center_support.adverse_adds_frozen;
      }
      for(int i = 0; i < snapshot_count; i++)
      {
         if(!m_discovery_real_portfolio.ObserveCompletedM1(snapshots[i],
               grid_book))
         {
            InvalidateDiscovery(
               m_discovery_real_portfolio.InvalidReason());
            return 0;
         }
      }
      if(!MarkDiscoveryShadows(snapshots, snapshot_count, source_m1_time))
      {
         InvalidateDiscovery("discovery_shadow_mark_failed");
         return 0;
      }
      for(int symbol_id = 0; symbol_id < LP_SYMBOL_COUNT; symbol_id++)
      {
         LP_RevmaShadowGrid c_grid;
         if(!m_discovery_shadow_portfolio.GetGrid(LP_REVMA_BRANCH_C,
               symbol_id, c_grid) ||
            (!c_latched_before[symbol_id] && c_grid.active &&
             c_grid.center_support.adverse_adds_frozen &&
             !EmitShadowCenterLatch(c_grid)))
         {
            InvalidateDiscovery("center_latch_telemetry_failed");
            return 0;
         }
      }
      LP_RevmaRealPortfolioState real_before_authority;
      LP_RevmaRealPortfolioState real_after_authority;
      if(!m_discovery_real_portfolio.GetPortfolio(real_before_authority) ||
         !m_discovery_real_portfolio.EvaluateCloseAuthority(
            source_m1_time) ||
         !m_discovery_real_portfolio.GetPortfolio(real_after_authority) ||
         !AppendDiscoveryPortfolioAuthority(LP_REVMA_BRANCH_R,
            real_after_authority.cycle_id,
            real_after_authority.equity_reference_minor,
            real_after_authority.capital_budget_minor,
            real_after_authority.atom_count,
            real_after_authority.reservation_minor,
            real_after_authority.q_cash_minor,
            real_after_authority.margin_minor,
            real_after_authority.marked_liquidation_minor,
            real_after_authority.realized_harvest_minor,
            real_after_authority.realized_nonharvest_minor,
            real_after_authority.concentration_q_cash_minor,
            real_after_authority.concentration_currency_id,
            real_before_authority.close_owner,
            real_after_authority.close_owner, source_m1_time) ||
         !EvaluateAndCloseDiscoveryShadows(snapshots, snapshot_count,
            source_m1_time))
      {
         InvalidateDiscovery("discovery_close_authority_lifecycle_failed");
         return 0;
      }
      for(int i = 0; i < snapshot_count; i++)
      {
         if(!m_discovery_real_portfolio.EvaluateLocalHarvest(
            snapshots[i].symbol_id, source_m1_time))
         {
            InvalidateDiscovery("real_local_harvest_evaluation_failed");
            return 0;
         }
      }

      // A close authority latched by this completed-M1 observation owns the
      // routing prefix. No new R exposure is staged behind it in the same
      // batch; the next completed-M1 cohort may reconsider admissions after
      // broker inventory has reconciled.
      int emitted = ContinueDiscoveryRealCloses(grid_book, bus,
         source_m1_time);
      bool real_close_priority =
         m_discovery_real_portfolio.CloseWorkActive();
      if(emitted > 0 && !real_close_priority)
      {
         InvalidateDiscovery("real_close_staging_priority_mismatch");
         return 0;
      }

      bool shadow_batches = true;
      LP_RevmaShadowPortfolioState u_portfolio;
      LP_RevmaShadowPortfolioState c_portfolio;
      if(!m_discovery_shadow_portfolio.GetPortfolio(LP_REVMA_BRANCH_U,
            u_portfolio) ||
         !m_discovery_shadow_portfolio.GetPortfolio(LP_REVMA_BRANCH_C,
            c_portfolio))
         shadow_batches = false;
      bool branch_batch_open[LP_REVMA_SHADOW_BRANCH_COUNT];
      branch_batch_open[0] = false;
      branch_batch_open[1] = false;
      if(shadow_batches)
      {
         for(int branch = LP_REVMA_BRANCH_U;
            branch <= LP_REVMA_BRANCH_C && shadow_batches; branch++)
         {
            int branch_index = LP_RevmaShadowIndex(branch);
            LP_RevmaShadowPortfolioState state =
               branch == LP_REVMA_BRANCH_U ? u_portfolio : c_portfolio;
            if(state.close_owner != LP_REVMA_DISCOVERY_CLOSE_NONE)
               continue;
            branch_batch_open[branch_index] =
               m_discovery_shadow_portfolio.BeginClosedM1Batch(
                  branch, source_m1_time);
            shadow_batches = branch_batch_open[branch_index];
         }
         for(int i = 0; i < snapshot_count && shadow_batches; i++)
         {
            for(int branch = LP_REVMA_BRANCH_U;
               branch <= LP_REVMA_BRANCH_C; branch++)
            {
               if(!branch_batch_open[LP_RevmaShadowIndex(branch)])
                  continue;
               LP_RevmaShadowCandidate candidate;
               bool available = false;
               if(!BuildShadowCandidateFromSnapshot(branch, snapshots[i],
                     candidate, available) ||
                  (available &&
                   !m_discovery_shadow_portfolio.AddCandidate(candidate)))
               {
                  shadow_batches = false;
                  break;
               }
            }
         }
         if(shadow_batches)
         {
            for(int branch = LP_REVMA_BRANCH_U;
               branch <= LP_REVMA_BRANCH_C && shadow_batches; branch++)
            {
               if(!branch_batch_open[LP_RevmaShadowIndex(branch)])
                  continue;
               shadow_batches =
                  m_discovery_shadow_portfolio.ValidateBranchOpportunities(
                     branch) &&
                  m_discovery_shadow_portfolio.SortAndAllocate(branch) &&
                   m_discovery_shadow_portfolio.CommitTransitions(branch);
            }
            for(int branch = LP_REVMA_BRANCH_U;
               branch <= LP_REVMA_BRANCH_C && shadow_batches; branch++)
            {
               if(!branch_batch_open[LP_RevmaShadowIndex(branch)])
                  continue;
               shadow_batches = EmitShadowCandidateTransitions(branch);
            }
            for(int branch = LP_REVMA_BRANCH_U;
               branch <= LP_REVMA_BRANCH_C && shadow_batches; branch++)
            {
               if(!branch_batch_open[LP_RevmaShadowIndex(branch)])
                  continue;
               shadow_batches =
                  m_discovery_shadow_portfolio.EndClosedM1Batch(branch);
            }
            if(shadow_batches)
               shadow_batches = EmitPendingShadowFirstDivergence();
         }
      }
      if(!shadow_batches)
      {
         InvalidateDiscovery("shadow_batch_schedule_failed");
         return 0;
      }

      if(!real_close_priority &&
         m_discovery_real_portfolio.CloseOwner() ==
         LP_REVMA_DISCOVERY_CLOSE_NONE)
      {
         if(!m_discovery_real_portfolio.BeginClosedM1Batch(source_m1_time))
         {
            InvalidateDiscovery("real_batch_begin_failed");
            return 0;
         }
         for(int i = 0; i < snapshot_count; i++)
         {
            if(!m_discovery_real_portfolio.BuildCandidate(snapshots[i]))
            {
               InvalidateDiscovery("real_candidate_build_failed");
               return emitted;
            }
         }
         if(!m_discovery_real_portfolio.SortAndAllocate())
         {
            InvalidateDiscovery("real_candidate_allocation_failed");
            return emitted;
         }
         if(!EmitPendingRealCandidateTransitions())
         {
            InvalidateDiscovery("real_allocation_rejection_telemetry_failed");
            return emitted;
         }
         LP_RevmaRealCandidate candidate;
         while(m_discovery_real_portfolio.GetNextRoutableCandidate(candidate))
         {
            LP_TradeIntent intent;
            LP_ResetTradeIntent(intent);
            BuildIntent(candidate.snapshot.signal,
               candidate.birth ? LP_INTENT_OPEN_GRID :
                  LP_INTENT_ADD_GRID_LEG,
               candidate.broker_grid_key, candidate.variant_id,
               candidate.direction, "gate108_R_formula_candidate", intent);
            intent.requested_lots = LP_REVMA_DISCOVERY_ATOM_LOTS;
            intent.expires_at = (datetime)((long)TimeCurrent() + 600);
            intent.gate108 = true;
            intent.discovery_branch = LP_REVMA_BRANCH_R;
            intent.discovery_branch_grid_id = candidate.branch_grid_id;
            intent.discovery_candidate_identity =
               candidate.candidate_identity;
            intent.discovery_shared_snapshot_hash =
               candidate.shared_snapshot_hash;
            intent.discovery_matched_snapshot_hash =
               candidate.matched_snapshot_hash;
            intent.discovery_pre_candidate_state_hash =
               candidate.pre_candidate_state_hash;
            intent.discovery_source_m1_time = candidate.source_m1_time;
            if(!bus.Add(intent) ||
               !m_discovery_real_portfolio.StageCandidate(
                  candidate.candidate_identity, intent.intent_id))
            {
               InvalidateDiscovery("real_candidate_intent_stage_failed");
               return emitted;
            }
            emitted++;
         }
         if(!EmitPendingRealCandidateTransitions())
         {
            InvalidateDiscovery("real_pre_stage_rejection_telemetry_failed");
            return emitted;
         }
      }
      m_discovery_last_completed_m1 = source_m1_time;
      return emitted;
   }

   bool EndDiscoveryRealBatch()
   {
      if(!m_discovery_real_portfolio.BatchOpen())
         return true;
      if(!m_discovery_real_portfolio.EndClosedM1Batch())
      {
         InvalidateDiscovery(
            m_discovery_real_portfolio.InvalidReason());
         return false;
      }
      return true;
   }

   bool AuthorizeDiscoveryRealIntentBeforeRoute(
      const LP_TradeIntent &intent,
      bool &authorized)
   {
      if(!m_discovery_real_portfolio.AuthorizeBeforeRoute(intent,
            authorized))
      {
         InvalidateDiscovery(
            m_discovery_real_portfolio.InvalidReason());
         return false;
      }
      if(intent.gate108 && !authorized &&
         !EmitPendingRealCandidateTransitions())
      {
         InvalidateDiscovery("real_pre_route_rejection_telemetry_failed");
         return false;
      }
      return true;
   }

   bool CanResetDiscoveryForNewRun()
   {
      return m_discovery_shadow_portfolio.CanResetForNewRun() &&
         m_discovery_telemetry.CanResetForNewRun();
   }

   bool Reset()
   {
      if(!CanResetDiscoveryForNewRun())
      {
         m_discovery_reset_valid = false;
         m_discovery_valid = false;
         m_discovery_invalid_reason = "discovery_reset_preflight_failed";
         return false;
      }
      m_next_intent_id = 990300000001;
      m_strategy_version_hash = LP_RevmaFormulaHash();
      m_config_hash = 0;
      m_birth_count = 0;
      m_birth_capacity = 0;
      m_visual_text = "";
      m_visual_centerline_price = 0.0;
      m_last_divergent_add_text = "";
      m_dashboard_screenshot_requested = false;
      m_state_loaded = false;
      m_state_persistence_enabled = true;
      m_last_blocked_birth_hash = 0;
      m_pending_lifecycle_count = 0;
      m_pending_lifecycle_capacity = 0;
      m_pending_lifecycle_max_active = 0;
      m_pending_lifecycle_max_allocated = 0;
      m_close_latch_count = 0;
      m_close_latch_capacity = 0;
      m_persistence_write_count = 0;
      m_persistence_failure_count = 0;
      m_persistence_total_microseconds = 0;
      m_persistence_max_microseconds = 0;
      m_birth_persistence_write_count = 0;
      m_birth_persistence_total_microseconds = 0;
      m_birth_persistence_max_microseconds = 0;
      m_close_latch_persistence_write_count = 0;
      m_close_latch_persistence_total_microseconds = 0;
      m_close_latch_persistence_max_microseconds = 0;
      m_persistence_deferred_mutation_count = 0;
      m_persistence_deferred_maintenance_total_microseconds = 0;
      m_persistence_deferred_maintenance_max_microseconds = 0;
      m_persistence_final_checkpoint_count = 0;
      m_birth_persistence_dirty = false;
      m_close_latch_persistence_dirty = false;
      m_birth_persistence_dirty_before_final_checkpoint = false;
      m_close_latch_persistence_dirty_before_final_checkpoint = false;
      m_protection_manager.Reset();
      m_discovery_real_portfolio.Reset();
      m_research_telemetry.Reset();
      bool shadow_reset = m_discovery_shadow_portfolio.ResetForNewRun();
      bool telemetry_reset = m_discovery_telemetry.ResetForNewRun();
      m_discovery_reset_valid = shadow_reset && telemetry_reset;
      m_discovery_initialization_attempted = false;
      m_discovery_initialized = false;
      m_discovery_finalized = false;
      m_discovery_valid = m_discovery_reset_valid;
      m_discovery_invalid_reason = m_discovery_reset_valid ? "" :
         "discovery_reset_failed";
      m_discovery_last_completed_m1 = 0;
      m_discovery_last_cohort_valid = false;
      m_discovery_last_cohort_hash = 0;
      m_discovery_last_cohort_signal_hash = 0;
      m_discovery_last_cohort_strategy_hash = 0;
      m_discovery_first_divergence_emitted = false;
      for(int branch = 0; branch < LP_REVMA_DISCOVERY_BRANCH_COUNT;
         branch++)
      {
         m_discovery_telemetry_cycle_started[branch] = 0;
         m_discovery_telemetry_cycle_sealed[branch] = 0;
         m_discovery_first_infeasibility_cycle[branch] = 0;
         m_discovery_telemetry_close_owner[branch] =
            LP_REVMA_DISCOVERY_CLOSE_NONE;
         m_discovery_telemetry_close_complete[branch] = false;
      }
      for(int symbol_id = 0; symbol_id < LP_SYMBOL_COUNT; symbol_id++)
         LP_ResetRevmaCompletedM1Snapshot(
            m_discovery_last_cohort[symbol_id]);
      ArrayResize(m_births, 0);
      ArrayResize(m_pending_lifecycle, 0);
      ArrayResize(m_close_latches, 0);
      return m_discovery_reset_valid;
   }

   void Configure(const ulong config_hash, const LP_Config &config)
   {
      m_config_hash = config_hash;
      m_state_persistence_enabled = config.persist_revma_lifecycle_state;
   }

   bool InitializeDiscovery(
      const LP_Config &config,
      const string run_id,
      const long equity_reference_minor,
      const double money_quantum
   )
   {
      string profile_reason = "";
      if(!m_discovery_reset_valid || m_discovery_initialized ||
         m_discovery_finalized || m_discovery_initialization_attempted)
      {
         m_discovery_valid = false;
         m_discovery_invalid_reason = "discovery_initialize_state_invalid";
         return false;
      }
      m_discovery_initialization_attempted = true;
      ulong actual_config_hash = LP_ConfigHash(config);
      if(actual_config_hash == 0 || m_config_hash != actual_config_hash)
      {
         m_discovery_valid = false;
         m_discovery_invalid_reason = "discovery_config_hash_mismatch";
         return false;
      }
      if(!LP_RevmaDiscoveryConfigValid(config, profile_reason))
      {
         m_discovery_valid = false;
         m_discovery_invalid_reason = "discovery_profile_invalid:" + profile_reason;
         return false;
      }
      ulong cycle_id = 1;
      if(cycle_id == 0 ||
         !m_discovery_real_portfolio.Initialize(
            equity_reference_minor, money_quantum) ||
         !m_discovery_shadow_portfolio.InitializeMatchedBranches(
            cycle_id, equity_reference_minor, money_quantum))
      {
         m_discovery_real_portfolio.Reset();
         m_discovery_valid = false;
         m_discovery_invalid_reason =
            "discovery_branch_initialization_failed";
         return false;
      }
      if(!m_discovery_telemetry.Initialize(
         LP_REVMA_DISCOVERY_OUTPUT_FOLDER,
         true,
         run_id,
         config.source_revision,
         m_config_hash,
         LP_REVMA_DISCOVERY_PROFILE_ID
      ))
      {
         string telemetry_reason = m_discovery_telemetry.InvalidReason();
         bool shadow_cleanup =
            m_discovery_shadow_portfolio.ResetForNewRun();
         m_discovery_real_portfolio.Reset();
         bool telemetry_cleanup = m_discovery_telemetry.ResetForNewRun();
         m_discovery_reset_valid = shadow_cleanup && telemetry_cleanup;
         m_discovery_valid = false;
         m_discovery_invalid_reason =
            "discovery_telemetry_initialization_failed:" + telemetry_reason +
            (m_discovery_reset_valid ? "" : ":cleanup_failed");
         return false;
      }
      m_discovery_initialized = true;
      m_discovery_valid = true;
      m_discovery_invalid_reason = "";
      return true;
   }

   bool FinalizeDiscovery()
   {
      if(!m_discovery_initialized || m_discovery_finalized)
         return false;
      datetime terminal_completed_m1_time = m_discovery_last_completed_m1;
      bool real_final_flat = false;
      bool u_final_flat = false;
      bool c_final_flat = false;
      ulong real_terminal_grid_state_hash = 0;
      ulong u_terminal_grid_state_hash = 0;
      ulong c_terminal_grid_state_hash = 0;
      ulong real_terminal_book_hash = 0;
      ulong u_terminal_book_hash = 0;
      ulong c_terminal_book_hash = 0;
      LP_RevmaConcurrentBranchRiskState real_terminal_risk;
      LP_RevmaConcurrentBranchRiskState u_terminal_risk;
      LP_RevmaConcurrentBranchRiskState c_terminal_risk;
      LP_ResetRevmaConcurrentBranchRiskState(real_terminal_risk);
      LP_ResetRevmaConcurrentBranchRiskState(u_terminal_risk);
      LP_ResetRevmaConcurrentBranchRiskState(c_terminal_risk);
      bool terminal_ok = m_discovery_valid &&
         terminal_completed_m1_time > 0 &&
         m_discovery_last_cohort_valid &&
         m_discovery_last_cohort[0].source_m1_time ==
            terminal_completed_m1_time;
      if(terminal_ok)
         terminal_ok = EmitDiscoveryOpenGridTerminalSnapshots(
            terminal_completed_m1_time);
      if(terminal_ok)
         terminal_ok = m_discovery_real_portfolio.BranchTerminalReconciled(
               terminal_completed_m1_time, real_final_flat,
               real_terminal_grid_state_hash, real_terminal_risk,
               real_terminal_book_hash) &&
            m_discovery_shadow_portfolio.MatchedBranchesTerminalReconciled(
               terminal_completed_m1_time, u_final_flat,
               u_terminal_grid_state_hash, u_terminal_risk,
               u_terminal_book_hash, c_final_flat,
               c_terminal_grid_state_hash, c_terminal_risk,
               c_terminal_book_hash);
      LP_RevmaRealPortfolioState real_portfolio;
      LP_RevmaShadowPortfolioState u_portfolio;
      LP_RevmaShadowPortfolioState c_portfolio;
      if(terminal_ok)
         terminal_ok = m_discovery_real_portfolio.GetPortfolio(
               real_portfolio) &&
            m_discovery_shadow_portfolio.GetPortfolio(LP_REVMA_BRANCH_U,
               u_portfolio) &&
            m_discovery_shadow_portfolio.GetPortfolio(LP_REVMA_BRANCH_C,
               c_portfolio);
      if(terminal_ok)
         terminal_ok = SealDiscoveryBranchCycle(LP_REVMA_BRANCH_R,
               terminal_completed_m1_time, real_terminal_risk,
               real_final_flat, real_portfolio.formula_clean, true, false,
               real_portfolio.cleanup_shortfall) &&
            SealDiscoveryBranchCycle(LP_REVMA_BRANCH_U,
               terminal_completed_m1_time, u_terminal_risk, u_final_flat,
               true, true, false, u_portfolio.cleanup_shortfall) &&
            SealDiscoveryBranchCycle(LP_REVMA_BRANCH_C,
               terminal_completed_m1_time, c_terminal_risk, c_final_flat,
               true, true, false, c_portfolio.cleanup_shortfall);
      if(terminal_ok)
         terminal_ok = AppendDiscoveryRunCompletion(LP_REVMA_BRANCH_R,
               terminal_completed_m1_time, real_final_flat,
               real_terminal_grid_state_hash, real_terminal_risk,
               real_terminal_book_hash, real_portfolio.formula_clean,
               true, false, real_portfolio.cleanup_shortfall) &&
            AppendDiscoveryRunCompletion(LP_REVMA_BRANCH_U,
               terminal_completed_m1_time, u_final_flat,
               u_terminal_grid_state_hash, u_terminal_risk,
               u_terminal_book_hash, true, true, false,
               u_portfolio.cleanup_shortfall) &&
            AppendDiscoveryRunCompletion(LP_REVMA_BRANCH_C,
               terminal_completed_m1_time, c_final_flat,
               c_terminal_grid_state_hash, c_terminal_risk,
               c_terminal_book_hash, true, true, false,
               c_portfolio.cleanup_shortfall);
      if(terminal_ok)
      {
         terminal_ok = m_pending_lifecycle_count == 0 &&
            !HasLatchedGridClose() &&
            m_discovery_telemetry.BranchTerminalReady(LP_REVMA_BRANCH_R) &&
            m_discovery_telemetry.BranchTerminalReady(LP_REVMA_BRANCH_U) &&
            m_discovery_telemetry.BranchTerminalReady(LP_REVMA_BRANCH_C) &&
            m_discovery_telemetry.BranchTerminalBoundaryM1(
               LP_REVMA_BRANCH_R) == terminal_completed_m1_time &&
            m_discovery_telemetry.BranchTerminalBoundaryM1(
               LP_REVMA_BRANCH_U) == terminal_completed_m1_time &&
            m_discovery_telemetry.BranchTerminalBoundaryM1(
               LP_REVMA_BRANCH_C) == terminal_completed_m1_time &&
            m_discovery_telemetry.BranchTerminalBookHash(
               LP_REVMA_BRANCH_R) == real_terminal_book_hash &&
            m_discovery_telemetry.BranchTerminalGridStateHash(
               LP_REVMA_BRANCH_R) == real_terminal_grid_state_hash &&
            m_discovery_telemetry.CurrentBranchTerminalGridEvidenceHash(
               LP_REVMA_BRANCH_R) == real_terminal_grid_state_hash &&
            m_discovery_telemetry.BranchTerminalFinalFlat(
               LP_REVMA_BRANCH_R) == real_final_flat &&
            m_discovery_telemetry.BranchTerminalBookHash(
               LP_REVMA_BRANCH_U) == u_terminal_book_hash &&
            m_discovery_telemetry.BranchTerminalGridStateHash(
               LP_REVMA_BRANCH_U) == u_terminal_grid_state_hash &&
            m_discovery_telemetry.CurrentBranchTerminalGridEvidenceHash(
               LP_REVMA_BRANCH_U) == u_terminal_grid_state_hash &&
            m_discovery_telemetry.BranchTerminalFinalFlat(
               LP_REVMA_BRANCH_U) == u_final_flat &&
            m_discovery_telemetry.BranchTerminalBookHash(
               LP_REVMA_BRANCH_C) == c_terminal_book_hash &&
            m_discovery_telemetry.BranchTerminalGridStateHash(
               LP_REVMA_BRANCH_C) == c_terminal_grid_state_hash &&
            m_discovery_telemetry.CurrentBranchTerminalGridEvidenceHash(
               LP_REVMA_BRANCH_C) == c_terminal_grid_state_hash &&
            m_discovery_telemetry.BranchTerminalFinalFlat(
               LP_REVMA_BRANCH_C) == c_final_flat;
      }
      if(!terminal_ok)
         InvalidateDiscovery("discovery_terminal_reconciliation_failed");
      bool telemetry_ok = m_discovery_telemetry.Finalize();
      m_discovery_finalized = true;
      m_discovery_valid = m_discovery_valid && terminal_ok && telemetry_ok;
      if(!m_discovery_valid && m_discovery_invalid_reason == "")
         m_discovery_invalid_reason = m_discovery_telemetry.InvalidReason();
      return m_discovery_valid;
   }

   void InvalidateDiscovery(const string reason)
   {
      if(!m_discovery_valid)
         return;
      m_discovery_valid = false;
      m_discovery_invalid_reason = reason == "" ?
         "discovery_invalid_unspecified" : reason;
      if(m_discovery_initialized && !m_discovery_finalized)
         m_discovery_telemetry.LatchFailure(m_discovery_invalid_reason);
   }

   bool DiscoveryTelemetryValid()
   {
      return m_discovery_valid &&
         m_discovery_real_portfolio.Valid() &&
         m_discovery_shadow_portfolio.BranchValid(LP_REVMA_BRANCH_U) &&
         m_discovery_shadow_portfolio.BranchValid(LP_REVMA_BRANCH_C) &&
         m_discovery_telemetry.Valid();
   }

   bool DiscoveryInitialized() { return m_discovery_initialized; }
   bool DiscoveryFaultLatched() { return !m_discovery_valid; }

   bool DiscoveryOperationalValid()
   {
      return m_discovery_initialized && !m_discovery_finalized &&
         DiscoveryTelemetryValid();
   }

   bool DiscoveryCompletionValid()
   {
      return m_discovery_initialized && m_discovery_finalized &&
         m_discovery_valid;
   }

   string DiscoveryTelemetryInvalidReason()
   {
      if(m_discovery_invalid_reason != "")
         return m_discovery_invalid_reason;
      if(!m_discovery_real_portfolio.Valid())
         return "R:" + m_discovery_real_portfolio.InvalidReason();
      if(!m_discovery_shadow_portfolio.BranchValid(LP_REVMA_BRANCH_U))
         return "U:" + m_discovery_shadow_portfolio.BranchInvalidReason(
            LP_REVMA_BRANCH_U);
      if(!m_discovery_shadow_portfolio.BranchValid(LP_REVMA_BRANCH_C))
         return "C:" + m_discovery_shadow_portfolio.BranchInvalidReason(
            LP_REVMA_BRANCH_C);
      return m_discovery_telemetry.InvalidReason();
   }

   bool RecordRiskDecision(
      const LP_TradeIntent &intent,
      const LP_RiskDecision &decision,
      LP_ReceiptWriter &receipts
   )
   {
      if(intent.gate108 && decision.decision == LP_RISK_REJECT)
      {
         InvalidateDiscovery("gate108_risk_boundary_rejection:" +
            IntegerToString(decision.reason) + ":" +
            (decision.explanation == "" ? "unspecified" :
             decision.explanation));
         return false;
      }
      if(intent.research_lifecycle_event == LP_RESEARCH_LIFECYCLE_NONE ||
         decision.decision != LP_RISK_REJECT)
         return true;

      LP_RevmaPendingLifecycle pending;
      if(!TakePendingLifecycle(intent.intent_id, pending))
      {
         InvalidateDiscovery("risk_rejection_lifecycle_link_missing");
         return false;
      }

      int receipt_kind = pending.event_type == LP_RESEARCH_LIFECYCLE_GRID_BIRTH ?
         LP_RECEIPT_REVMA_GRID_BIRTH : LP_RECEIPT_REVMA_GRID_ADD;
      LP_TradeExecutionResult execution;
      LP_ResetTradeExecutionResult(execution);
      execution.detail = "risk_reason=" + IntegerToString(decision.reason) +
         "|risk_explanation=" + decision.explanation;
      receipts.Write(
         receipt_kind,
         pending.signal.symbol,
         "risk_rejected",
         ExecutionTruthMetadata(
            pending,
            execution,
            "risk_rejected",
            receipts.PayloadContract(),
            ""
         ),
         LP_LANE_REVMA,
         pending.signal.variant_id,
         pending.grid_key,
         pending.intent_id,
         decision.decision_id,
         0
      );
      return true;
   }

   bool RecordExecutionOutcome(
      const LP_TradePlan &plan,
      const LP_TradeExecutionResult &execution,
      LP_ReceiptWriter &receipts
   )
   {
      if(plan.gate108 &&
         (plan.action == LP_INTENT_OPEN_GRID ||
          plan.action == LP_INTENT_ADD_GRID_LEG))
      {
         if(!m_discovery_real_portfolio.RecordExecution(plan, execution))
         {
            InvalidateDiscovery(
               m_discovery_real_portfolio.InvalidReason());
            return false;
         }
         if(!EmitPendingRealCandidateTransitions())
         {
            InvalidateDiscovery("real_execution_transition_telemetry_failed");
            return false;
         }
         return true;
      }
      if(plan.research_lifecycle_event == LP_RESEARCH_LIFECYCLE_NONE)
         return true;

      LP_RevmaPendingLifecycle pending;
      if(!TakePendingLifecycle(plan.intent_id, pending))
      {
         InvalidateDiscovery("executed_lifecycle_pending_record_missing");
         return false;
      }

      int receipt_kind = pending.event_type == LP_RESEARCH_LIFECYCLE_GRID_BIRTH ?
         LP_RECEIPT_REVMA_GRID_BIRTH : LP_RECEIPT_REVMA_GRID_ADD;
      if(!execution.accepted)
      {
         string rejection_outcome = execution.broker_rejected ? "broker_rejected" : "router_rejected";
         receipts.Write(
            receipt_kind,
            pending.signal.symbol,
            rejection_outcome,
            ExecutionTruthMetadata(
               pending,
               execution,
               rejection_outcome,
               receipts.PayloadContract(),
               "|risk_reservation_status=" + plan.reservation_status +
                  "|reservation_reason=" + plan.reservation_reason
            ),
            LP_LANE_REVMA,
            pending.signal.variant_id,
            pending.grid_key,
            pending.intent_id,
            plan.decision_id,
            plan.magic
         );
         return true;
      }

      if(pending.event_type == LP_RESEARCH_LIFECYCLE_GRID_BIRTH)
      {
         if(!RememberBirth(pending.grid_key, pending.signal,
               AddPolicyName(pending.signal)) ||
            !PersistBirths(receipts, "executed_birth"))
         {
            InvalidateDiscovery("executed_birth_snapshot_allocation_or_persistence_failed");
            return false;
         }
         LP_RevmaGridBirthSnapshot birth;
         if(!FindBirth(pending.grid_key, birth))
         {
            InvalidateDiscovery("executed_birth_snapshot_missing_after_commit");
            return false;
         }
         m_research_telemetry.RecordExecutedBirth(birth, execution);
      }
      else if(pending.event_type == LP_RESEARCH_LIFECYCLE_GRID_ADD)
      {
         if(!RecordAdd(pending.grid_key, pending.add_type, receipts))
         {
            InvalidateDiscovery("executed_add_snapshot_update_failed");
            return false;
         }
         m_research_telemetry.RecordExecutedAdd(
            pending.grid_key,
            pending.add_type,
            pending.position_count_before,
            execution
         );
      }

      string outcome = execution.partial_fill ? "partial_fill" : "executed_fill";
      receipts.Write(
         receipt_kind,
         pending.signal.symbol,
         outcome,
         ExecutionTruthMetadata(
            pending,
            execution,
            outcome,
            receipts.PayloadContract(),
            "|risk_reservation_status=" + plan.reservation_status +
               "|reservation_reason=" + plan.reservation_reason
         ),
         LP_LANE_REVMA,
         pending.signal.variant_id,
         pending.grid_key,
         pending.intent_id,
         plan.decision_id,
         plan.magic
      );
      return true;
   }

   int LoadPersistedBirths(LP_GridBook &grid_book, LP_ReceiptWriter &receipts)
   {
      if(m_state_loaded)
         return 0;
      return LoadPersistedBirthsInternal(grid_book, receipts);
   }

   int CleanupClosedBirths(LP_GridBook &grid_book, LP_ReceiptWriter &receipts)
   {
      return CleanupClosedBirthsInternal(grid_book, receipts);
   }

   void ObserveGridPath(LP_GridBook &grid_book)
   {
      for(int i = 0; i < grid_book.OpenGridCount(); i++)
      {
         LP_GridInventoryRow grid;
         if(!grid_book.GetGrid(i, grid))
            continue;
         if(grid.lane_id == LP_LANE_REVMA)
            m_research_telemetry.ObserveGrid(grid);
      }
   }

   bool RecordCloseExecution(
      const LP_TradePlan &plan,
      const LP_TradeExecutionResult &execution,
      LP_ReceiptWriter &receipts
   )
   {
      if(plan.gate108 && plan.action == LP_INTENT_CLOSE_GRID)
      {
         if(!m_discovery_real_portfolio.RecordCloseExecution(plan,
               execution))
         {
            InvalidateDiscovery(
               m_discovery_real_portfolio.InvalidReason());
            return false;
         }
         return true;
      }
      m_research_telemetry.RecordCloseExecution(plan, execution);
      m_research_telemetry.RecordAccountCloseExecution(plan, execution);
      if(!UpdateCloseLatchProgress(plan, execution, receipts))
      {
         InvalidateDiscovery("close_latch_progress_reconciliation_failed");
         return false;
      }
      return true;
   }

   bool HasLatchedGridClose()
   {
      for(int i = 0; i < m_close_latch_count; i++)
      {
         if(m_close_latches[i].valid && m_close_latches[i].grid_key > 0)
            return true;
      }
      return false;
   }

   void FinalizeResearchTelemetry(
      const LP_Config &config,
      const LP_BrokerExecutionIntegrity &broker_integrity,
      LP_ReceiptWriter &receipts
   )
   {
      if(m_state_persistence_enabled && TesterRuntime())
      {
         m_birth_persistence_dirty_before_final_checkpoint = m_birth_persistence_dirty;
         m_close_latch_persistence_dirty_before_final_checkpoint = m_close_latch_persistence_dirty;
         bool births_ok = PersistBirths(receipts,
            "tester_final_checkpoint", true);
         bool latches_ok = PersistCloseLatches(receipts,
            "tester_final_checkpoint", true);
         if(!births_ok || !latches_ok)
            InvalidateDiscovery("final_lifecycle_persistence_checkpoint_failed");
         m_persistence_final_checkpoint_count++;
      }

      m_research_telemetry.Finalize(config, broker_integrity, receipts);
      receipts.Summary("revma_pending_lifecycle_max_active", IntegerToString(m_pending_lifecycle_max_active));
      receipts.Summary("revma_pending_lifecycle_max_allocated", IntegerToString(m_pending_lifecycle_max_allocated));
      receipts.Summary("revma_lifecycle_persistence_policy", PersistencePolicyName());
      receipts.Summary("revma_lifecycle_persistence_deferred_mutations", (string)m_persistence_deferred_mutation_count);
      receipts.Summary("revma_lifecycle_persistence_deferred_maintenance_total_microseconds", (string)m_persistence_deferred_maintenance_total_microseconds);
      receipts.Summary("revma_lifecycle_persistence_deferred_maintenance_max_microseconds", (string)m_persistence_deferred_maintenance_max_microseconds);
      receipts.Summary("revma_lifecycle_persistence_final_checkpoints", (string)m_persistence_final_checkpoint_count);
      receipts.Summary("revma_lifecycle_birth_dirty_before_final_checkpoint", LP_BoolText(m_birth_persistence_dirty_before_final_checkpoint));
      receipts.Summary("revma_lifecycle_close_latch_dirty_before_final_checkpoint", LP_BoolText(m_close_latch_persistence_dirty_before_final_checkpoint));
      receipts.Summary("revma_lifecycle_birth_dirty_after_final_checkpoint", LP_BoolText(m_birth_persistence_dirty));
      receipts.Summary("revma_lifecycle_close_latch_dirty_after_final_checkpoint", LP_BoolText(m_close_latch_persistence_dirty));
      receipts.Summary("revma_lifecycle_birth_snapshot_writes", (string)m_birth_persistence_write_count);
      receipts.Summary("revma_lifecycle_birth_snapshot_total_microseconds", (string)m_birth_persistence_total_microseconds);
      receipts.Summary("revma_lifecycle_birth_snapshot_max_microseconds", (string)m_birth_persistence_max_microseconds);
      receipts.Summary("revma_lifecycle_close_latch_snapshot_writes", (string)m_close_latch_persistence_write_count);
      receipts.Summary("revma_lifecycle_close_latch_snapshot_total_microseconds", (string)m_close_latch_persistence_total_microseconds);
      receipts.Summary("revma_lifecycle_close_latch_snapshot_max_microseconds", (string)m_close_latch_persistence_max_microseconds);
      receipts.Summary("revma_lifecycle_persistence_failures", (string)m_persistence_failure_count);
   }

   ulong LifecyclePersistenceWriteCount()
   {
      return m_persistence_write_count;
   }

   ulong LifecyclePersistenceTotalMicroseconds()
   {
      return m_persistence_total_microseconds;
   }

   ulong LifecyclePersistenceMaxMicroseconds()
   {
      return m_persistence_max_microseconds;
   }

   string VisualDashboardText()
   {
      return m_visual_text;
   }

   double VisualDashboardCenterlinePrice()
   {
      return m_visual_centerline_price;
   }

   bool ConsumeDashboardScreenshotRequest()
   {
      if(!m_dashboard_screenshot_requested)
         return false;
      m_dashboard_screenshot_requested = false;
      return true;
   }

   ulong BrokerTpSyncTicketScanCount()
   {
      return m_protection_manager.TicketScanCount();
   }

   int SyncGridTakeProfits(
      const LP_Config &config,
      LP_GridBook &grid_book,
      LP_ReceiptWriter &receipts,
      LP_IntentBus &bus
   )
   {
      if(!LP_RevmaAnySleeveTakeProfitEnabled(config))
         return 0;
      if(!LP_BrokerGridTpSyncEnabledForRuntime(config.broker_grid_tp_sync_mode))
         return 0;

      int emitted = 0;
      for(int i = 0; i < grid_book.OpenGridCount(); i++)
      {
         LP_GridInventoryRow grid;
         if(!grid_book.GetGrid(i, grid))
            continue;
         if(grid.lane_id != LP_LANE_REVMA || grid.position_count <= 0 || grid.lots <= 0.0)
            continue;

         LP_RevmaGridBirthSnapshot birth;
         if(!FindBirth(grid.grid_key, birth))
            continue;
         if(!birth.valid || birth.q <= 0.0)
            continue;
         int grid_sleeve = birth.sleeve;
         if(LP_RevmaTakeProfitQForSleeve(config, grid_sleeve) <= 0.0)
            continue;

         string symbol = LP_ResolveBrokerSymbol(LP_CanonicalSymbol(grid.symbol_id), config.broker_symbol_suffix);
         if(m_protection_manager.QueueGridTakeProfitSync(
            symbol,
            grid,
            config,
            birth.q,
            grid_sleeve,
            BirthSnapshotMetadata(birth),
            NextIntentId(),
            m_config_hash,
            receipts,
            bus
         ))
         {
            emitted++;
         }
      }
      return emitted;
   }

   int EvaluateGridExits(
      const LP_Config &config,
      LP_GridBook &grid_book,
      LP_ReceiptWriter &receipts,
      LP_IntentBus &bus
   )
   {
      if(!LP_RevmaAnySleeveStopTakeProfitEnabled(config))
         return 0;

      int emitted = 0;
      for(int i = 0; i < grid_book.OpenGridCount(); i++)
      {
         LP_GridInventoryRow grid;
         if(!grid_book.GetGrid(i, grid))
            continue;
         if(QueueGridExitIfTriggered(grid, config, receipts, bus))
            emitted++;
      }
      return emitted;
   }

   int Evaluate(
      const LP_RevmaSignal &signal,
      const LP_Config &config,
      LP_GridBook &grid_book,
      LP_ReceiptWriter &receipts,
      LP_IntentBus &bus,
      const bool birth_allowed
   )
   {
      if(!signal.valid)
         return 0;
      if(signal.q <= 0.0 || config.revma_fixed_lots <= 0.0)
         return 0;

      LP_GridInventoryRow active_grid;
      bool has_active_grid = grid_book.FindSymbolLaneGrid(
         signal.symbol_id,
         LP_LANE_REVMA,
         active_grid
      );
      LP_RevmaGridBirthSnapshot birth_snapshot;
      LP_ResetRevmaGridBirthSnapshot(birth_snapshot);

        if(has_active_grid)
        {
           FindBirth(active_grid.grid_key, birth_snapshot);
           m_research_telemetry.ObserveGridSignal(active_grid.grid_key, signal);

          LP_RevmaGridCloseLatch close_latch;
          if(FindCloseLatch(active_grid.grid_key, close_latch))
          {
             UpdateVisualText(signal, true, active_grid, birth_snapshot, active_grid.variant_id, active_grid.direction, SleeveFromVariant(active_grid.variant_id), "none", 0.0, "add blocked: " + close_latch.close_reason, config);
             return 0;
          }

          int frozen_variant_id = birth_snapshot.valid ? birth_snapshot.variant_id : active_grid.variant_id;
         int frozen_direction = birth_snapshot.valid ? birth_snapshot.direction : active_grid.direction;
         int frozen_sleeve = birth_snapshot.valid ? birth_snapshot.sleeve : SleeveFromVariant(active_grid.variant_id);
         string frozen_add_policy = birth_snapshot.valid ? birth_snapshot.add_policy : AddPolicyNameFromFrozen(frozen_sleeve, frozen_direction);
         double spacing_q = birth_snapshot.valid && birth_snapshot.q > 0.0 ? birth_snapshot.q : signal.q;
         double spacing_config_q = LP_RevmaGridSpacingQForSleeve(config, frozen_sleeve);
         double spacing = spacing_q * spacing_config_q;
         double next_add_level = 0.0;

         if(signal.direction != LP_SIDE_NONE && signal.direction != active_grid.direction)
         {
            ulong blocked_hash = BlockedBirthHash(signal, active_grid, birth_snapshot);
            if(blocked_hash != m_last_blocked_birth_hash)
            {
               m_last_blocked_birth_hash = blocked_hash;
               int active_age_minutes = 0;
               if(birth_snapshot.valid && birth_snapshot.birth_time > 0)
                  active_age_minutes = (int)MathMax(0, ((long)TimeCurrent() - (long)birth_snapshot.birth_time) / 60);
               receipts.Write(
                  LP_RECEIPT_REVMA_GRID_BIRTH,
                  signal.symbol,
                  "birth_candidate_blocked_active_grid",
                  "symbol=" + signal.symbol +
                     "|lane_id=" + IntegerToString(LP_LANE_REVMA) +
                     "|candidate_direction=" + LP_RevmaDirectionName(signal.direction) +
                     "|active_grid_key=" + (string)active_grid.grid_key +
                     "|active_grid_direction=" + LP_RevmaDirectionName(active_grid.direction) +
                     AnchorBucketMetadata(signal.direction, signal.anchor_relation, "candidate_q") +
                     StochBucketMetadata(signal.stoch, "candidate") +
                     "|active_grid_age_minutes=" + IntegerToString(active_age_minutes) +
                     "|active_grid_floating_pnl=" + DoubleToString(active_grid.floating_pnl, 2) +
                     "|reason=ACTIVE_GRID_SYMBOL_LANE_CONTRACT",
                  LP_LANE_REVMA,
                  signal.variant_id,
                  active_grid.grid_key,
                  0,
                  0,
                  0
               );
            }
         }

         if(!SleeveEnabled(frozen_sleeve))
         {
            string metadata = AddSkipMetadata(
               signal,
               active_grid,
               birth_snapshot,
               frozen_variant_id,
               frozen_direction,
               frozen_sleeve,
               frozen_add_policy,
               spacing_q,
               spacing,
               next_add_level,
               "other_reason_frozen_sleeve_disabled"
            );
             UpdateVisualText(signal, true, active_grid, birth_snapshot, frozen_variant_id, frozen_direction, frozen_sleeve, frozen_add_policy, next_add_level, "skip: frozen sleeve disabled", config);
            receipts.Write(
               LP_RECEIPT_REVMA_GRID_ADD_SKIP,
               signal.symbol,
               "add_skip_other_reason",
               metadata,
               LP_LANE_REVMA,
               frozen_variant_id,
               active_grid.grid_key,
               0,
               0,
               0
            );
            return 0;
         }

         if(frozen_add_policy == "none" || frozen_sleeve == LP_REVMA_SLEEVE_NONE || frozen_direction == LP_SIDE_NONE)
         {
            string metadata = AddSkipMetadata(
               signal,
               active_grid,
               birth_snapshot,
               frozen_variant_id,
               frozen_direction,
               frozen_sleeve,
               frozen_add_policy,
               spacing_q,
               spacing,
               next_add_level,
               "other_reason_frozen_policy_unavailable"
            );
             UpdateVisualText(signal, true, active_grid, birth_snapshot, frozen_variant_id, frozen_direction, frozen_sleeve, frozen_add_policy, next_add_level, "skip: frozen policy unavailable", config);
            receipts.Write(
               LP_RECEIPT_REVMA_GRID_ADD_SKIP,
               signal.symbol,
               "add_skip_other_reason",
               metadata,
               LP_LANE_REVMA,
               frozen_variant_id,
               active_grid.grid_key,
               0,
               0,
               0
            );
            return 0;
         }

         if(spacing <= 0.0)
         {
            string metadata = AddSkipMetadata(
               signal,
               active_grid,
               birth_snapshot,
               frozen_variant_id,
               frozen_direction,
               frozen_sleeve,
               frozen_add_policy,
               spacing_q,
               spacing,
               next_add_level,
               "other_reason_spacing_invalid"
            );
             UpdateVisualText(signal, true, active_grid, birth_snapshot, frozen_variant_id, frozen_direction, frozen_sleeve, frozen_add_policy, next_add_level, "skip: spacing invalid", config);
            receipts.Write(
               LP_RECEIPT_REVMA_GRID_ADD_SKIP,
               signal.symbol,
               "add_skip_other_reason",
               metadata,
               LP_LANE_REVMA,
               frozen_variant_id,
               active_grid.grid_key,
               0,
               0,
               0
            );
            return 0;
         }

         string add_type = "";
         bool add_hit = AddHit(signal, active_grid, spacing, next_add_level, add_type);

         if(!add_hit)
         {
             UpdateVisualText(signal, true, active_grid, birth_snapshot, frozen_variant_id, frozen_direction, frozen_sleeve, frozen_add_policy, next_add_level, "skip: spacing not reached", config);
            if(receipts.ShouldBuildKnownCompactReceipt(LP_RECEIPT_REVMA_GRID_ADD_SKIP, "add_skip_spacing_not_reached"))
            {
               string metadata = AddSkipMetadata(
                  signal,
                  active_grid,
                  birth_snapshot,
                  frozen_variant_id,
                  frozen_direction,
                  frozen_sleeve,
                  frozen_add_policy,
                  spacing_q,
                  spacing,
                  next_add_level,
                  "grid_found_but_add_spacing_not_reached"
               );
               receipts.Write(
                  LP_RECEIPT_REVMA_GRID_ADD_SKIP,
                  signal.symbol,
                  "add_skip_spacing_not_reached",
                  metadata,
                  LP_LANE_REVMA,
                  frozen_variant_id,
                  active_grid.grid_key,
                  0,
                  0,
                  0
               );
            }
            return 0;
         }

         LP_TradeIntent add_intent;
         LP_ResetTradeIntent(add_intent);
         string add_fee_source = "";
         double net_open_money_after_fees_before = active_grid.floating_pnl - GridCloseFeeMoney(active_grid, config, add_fee_source);
         string metadata = AddMetadata(
            signal,
            active_grid,
            birth_snapshot,
            frozen_variant_id,
            frozen_direction,
            frozen_sleeve,
            frozen_add_policy,
            add_type,
            spacing_q,
            spacing,
            next_add_level,
            net_open_money_after_fees_before
         );
          BuildIntent(signal, LP_INTENT_ADD_GRID_LEG, active_grid.grid_key, frozen_variant_id, frozen_direction, "revma_grid_add|" + metadata, add_intent);
          add_intent.requested_lots = config.revma_fixed_lots;
          add_intent.research_lifecycle_event = LP_RESEARCH_LIFECYCLE_GRID_ADD;
          add_intent.research_add_type = add_type;
          add_intent.expires_at = config.revma_intent_expiry_minutes > 0 ?
             (datetime)((long)TimeCurrent() + (long)config.revma_intent_expiry_minutes * 60) : 0;
           if(!RememberPendingLifecycle(
              add_intent,
              signal,
              add_type,
              active_grid.position_count,
              active_grid.lots,
              active_grid.floating_pnl
           ))
           {
              InvalidateDiscovery("pending_add_lifecycle_allocation_failed");
              receipts.Write(LP_RECEIPT_ERROR, signal.symbol,
                 "gate108_pending_lifecycle_allocation_failed",
                 "action=add|grid_key=" + (string)active_grid.grid_key,
                 LP_LANE_REVMA, frozen_variant_id, active_grid.grid_key,
                 add_intent.intent_id, 0, 0);
              return 0;
           }
           if(!bus.Add(add_intent))
           {
              InvalidateDiscovery("add_intent_bus_allocation_failed");
              LP_RevmaPendingLifecycle discarded;
              TakePendingLifecycle(add_intent.intent_id, discarded);
              receipts.Write(LP_RECEIPT_ERROR, signal.symbol,
                 "gate108_intent_bus_allocation_failed",
                 "action=add|grid_key=" + (string)active_grid.grid_key,
                 LP_LANE_REVMA, frozen_variant_id, active_grid.grid_key,
                 add_intent.intent_id, 0, 0);
              return 0;
           }
         if(!CurrentMatchesFrozenIdentity(signal, frozen_variant_id, frozen_direction))
         {
            m_last_divergent_add_text =
               "LAST DIVERGENT ADD\n" +
               " time: " + LP_Stamp(signal.source_m1_time) + "\n" +
               " frozen: " + LP_RevmaDirectionName(frozen_direction) +
                  " / " + LP_RevmaSleeveName(frozen_sleeve) +
                  " / V" + IntegerToString(frozen_variant_id) + "\n" +
                " current: " + LP_RevmaDirectionName(signal.direction) +
                   " / " + LP_RevmaSleeveName(signal.sleeve) +
                   " / V" + IntegerToString(signal.variant_id) + "\n" +
                " add policy: " + frozen_add_policy + "\n" +
                " next level: " + PriceText(next_add_level) + "\n" +
                " receipt: current_matches_birth_identity=false";
            m_dashboard_screenshot_requested = true;
          }
          UpdateVisualText(signal, true, active_grid, birth_snapshot, frozen_variant_id, frozen_direction, frozen_sleeve, frozen_add_policy, next_add_level, "add intent emitted", config);
         string add_candidate_payload = metadata;
         if(receipts.CompactLongRunMode())
            add_candidate_payload += "|payload_contract=" + receipts.PayloadContract() +
               "|candidate_payload_role=canonical";
         receipts.Write(
             LP_RECEIPT_REVMA_GRID_ADD,
             signal.symbol,
            "intent_created",
            add_candidate_payload,
            LP_LANE_REVMA,
            frozen_variant_id,
            active_grid.grid_key,
            add_intent.intent_id,
            0,
            0
         );
          return 1;
      }

      if(receipts.ShouldBuildKnownCompactReceipt(LP_RECEIPT_REVMA_GRID_ADD_SKIP, "add_skip_no_active_grid_found"))
      {
         receipts.Write(
            LP_RECEIPT_REVMA_GRID_ADD_SKIP,
            signal.symbol,
            "add_skip_no_active_grid_found",
            NoActiveGridAddSkipMetadata(signal, "no_active_grid_found"),
            LP_LANE_REVMA,
            signal.variant_id,
            0,
            0,
            0,
            0
         );
      }

      if(!SleeveEnabled(signal.sleeve))
         return 0;

      if(!birth_allowed)
      {
         UpdateVisualText(signal, false, active_grid, birth_snapshot, signal.variant_id, signal.direction, signal.sleeve, AddPolicyName(signal), 0.0, "birth blocked: waiting for fresh state", config);
         if(receipts.ShouldBuildKnownCompactReceipt(LP_RECEIPT_REVMA_REENTRY_GATE, "birth_blocked_waiting_for_fresh_state"))
         {
            receipts.Write(
               LP_RECEIPT_REVMA_REENTRY_GATE,
               signal.symbol,
               "birth_blocked_waiting_for_fresh_state",
               NoActiveGridAddSkipMetadata(signal, "birth_gate_denied"),
               LP_LANE_REVMA,
               signal.variant_id,
               0,
               0,
               0,
               0
            );
         }
         return 0;
      }

      LP_TradeIntent open_intent;
      LP_ResetTradeIntent(open_intent);
      BuildIntent(signal, LP_INTENT_OPEN_GRID, 0, signal.variant_id, signal.direction, "", open_intent);
      int grid_family = (int)(open_intent.intent_id % 9000) + 1;
      open_intent.grid_key = LP_BuildGridKey(
         signal.symbol_id,
         LP_LANE_REVMA,
         signal.variant_id,
         signal.direction,
         grid_family
      );
      string add_policy = AddPolicyName(signal);
      open_intent.research_lifecycle_event = LP_RESEARCH_LIFECYCLE_GRID_BIRTH;
      open_intent.research_add_type = "";
      string birth = BirthMetadata(signal) +
         "|grid_key=" + (string)open_intent.grid_key +
         "|grid_family=" + IntegerToString(grid_family) +
         "|locked_add_policy=" + add_policy +
         "|add_policy=" + add_policy;
      open_intent.human_reason = "revma_grid_birth|" + birth;
      open_intent.requested_lots = config.revma_fixed_lots;
      open_intent.expires_at = config.revma_intent_expiry_minutes > 0 ?
         (datetime)((long)TimeCurrent() + (long)config.revma_intent_expiry_minutes * 60) : 0;
      if(!RememberPendingLifecycle(open_intent, signal, "", 0, 0.0, 0.0))
      {
         InvalidateDiscovery("pending_birth_lifecycle_allocation_failed");
         receipts.Write(LP_RECEIPT_ERROR, signal.symbol,
            "gate108_pending_lifecycle_allocation_failed",
            "action=birth|grid_key=" + (string)open_intent.grid_key,
            LP_LANE_REVMA, signal.variant_id, open_intent.grid_key,
            open_intent.intent_id, 0, 0);
         return 0;
      }
      if(!bus.Add(open_intent))
      {
         InvalidateDiscovery("birth_intent_bus_allocation_failed");
         LP_RevmaPendingLifecycle discarded;
         TakePendingLifecycle(open_intent.intent_id, discarded);
         receipts.Write(LP_RECEIPT_ERROR, signal.symbol,
            "gate108_intent_bus_allocation_failed",
            "action=birth|grid_key=" + (string)open_intent.grid_key,
            LP_LANE_REVMA, signal.variant_id, open_intent.grid_key,
            open_intent.intent_id, 0, 0);
         return 0;
      }
      UpdateVisualText(signal, false, active_grid, birth_snapshot, signal.variant_id, signal.direction, signal.sleeve, add_policy, 0.0, "birth intent emitted", config);
      string birth_candidate_payload = birth;
      if(receipts.CompactLongRunMode())
         birth_candidate_payload += "|payload_contract=" + receipts.PayloadContract() +
            "|candidate_payload_role=canonical";
      receipts.Write(
         LP_RECEIPT_REVMA_GRID_BIRTH,
         signal.symbol,
         "intent_created",
         birth_candidate_payload,
         LP_LANE_REVMA,
         signal.variant_id,
         open_intent.grid_key,
         open_intent.intent_id,
         0,
         0
      );
      return 1;
   }
};

#endif // __LIMNI_PORTFOLIO_REVMA_GRID_SLEEVE_MQH__
