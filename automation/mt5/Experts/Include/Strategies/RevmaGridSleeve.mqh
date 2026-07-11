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
#include "Revma\\RevmaDiscoveryTelemetry.mqh"
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
   LP_RevmaShadowPortfolio m_discovery_shadow_portfolio;
   LP_RevmaDiscoveryTelemetry m_discovery_telemetry;
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

   void RememberBirth(const ulong grid_key, const LP_RevmaSignal &signal, const string add_policy)
   {
      if(grid_key <= 0)
         return;

      int index = FindBirthIndex(grid_key);
      if(index < 0)
      {
         if(m_birth_count >= m_birth_capacity)
         {
            m_birth_capacity = m_birth_capacity <= 0 ? 32 : m_birth_capacity * 2;
            ArrayResize(m_births, m_birth_capacity);
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

   void RememberPendingLifecycle(
      const LP_TradeIntent &intent,
      const LP_RevmaSignal &signal,
      const string add_type,
      const int position_count_before,
      const double lots_before,
      const double grid_floating_pnl_before
   )
   {
      if(intent.research_lifecycle_event == LP_RESEARCH_LIFECYCLE_NONE || intent.intent_id <= 0)
         return;

      int index = FindPendingLifecycleIndex(intent.intent_id);
      if(index < 0)
      {
         if(m_pending_lifecycle_count >= m_pending_lifecycle_capacity)
         {
            m_pending_lifecycle_capacity = m_pending_lifecycle_capacity <= 0 ? 32 : m_pending_lifecycle_capacity * 2;
            ArrayResize(m_pending_lifecycle, m_pending_lifecycle_capacity);
            if(m_pending_lifecycle_capacity > m_pending_lifecycle_max_allocated)
               m_pending_lifecycle_max_allocated = m_pending_lifecycle_capacity;
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
         return false;

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

   void PersistBirths(LP_ReceiptWriter &receipts, const string cause)
   {
      PersistBirths(receipts, cause, false);
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
         return false;

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

   void PersistCloseLatches(LP_ReceiptWriter &receipts, const string cause)
   {
      PersistCloseLatches(receipts, cause, false);
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
            m_close_latch_capacity = m_close_latch_capacity <= 0 ? 16 : m_close_latch_capacity * 2;
            ArrayResize(m_close_latches, m_close_latch_capacity);
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
      if(started)
         PersistCloseLatches(receipts, "grid_close_latched");
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

   void UpdateCloseLatchProgress(
      const LP_TradePlan &plan,
      const LP_TradeExecutionResult &execution,
      LP_ReceiptWriter &receipts
   )
   {
      if(plan.action != LP_INTENT_CLOSE_GRID || plan.grid_key <= 0)
         return;
      int index = FindCloseLatchIndex(plan.grid_key);
      if(index < 0)
         return;

      LP_RevmaGridCloseLatch latch = m_close_latches[index];
      latch.attempted_count += execution.attempted_positions;
      latch.closed_count += execution.closed_positions;
      latch.remaining_ticket_count = CountLiveGridTickets(plan);
      if(execution.close_limit > 0)
         latch.close_cap = execution.close_limit;
      m_close_latches[index] = latch;
      PersistCloseLatches(receipts, "grid_close_progress");
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
   }

   void ClearCloseLatch(const ulong grid_key, LP_ReceiptWriter &receipts, const string cause)
   {
      int index = FindCloseLatchIndex(grid_key);
      if(index < 0)
         return;
      m_close_latches[index].valid = false;
      PersistCloseLatches(receipts, cause);
   }

   void UpsertBirthSnapshot(const LP_RevmaGridBirthSnapshot &birth)
   {
      if(!birth.valid || birth.grid_key <= 0)
         return;
      int index = FindBirthIndex(birth.grid_key);
      if(index < 0)
      {
         if(m_birth_count >= m_birth_capacity)
         {
            m_birth_capacity = m_birth_capacity <= 0 ? 32 : m_birth_capacity * 2;
            ArrayResize(m_births, m_birth_capacity);
         }
         index = m_birth_count;
         m_birth_count++;
      }
      m_births[index] = birth;
   }

   bool RemoveBirth(const ulong grid_key)
   {
      int index = FindBirthIndex(grid_key);
      if(index < 0)
         return false;
      m_births[index].valid = false;
      return true;
   }

   void RecordAdd(const ulong grid_key, const string add_type, LP_ReceiptWriter &receipts)
   {
      int index = FindBirthIndex(grid_key);
      if(index < 0)
         return;
      m_births[index].add_sequence++;
      if(add_type == "adverse")
         m_births[index].adverse_add_count++;
      else if(add_type == "favorable")
         m_births[index].favorable_add_count++;
      PersistBirths(receipts, "executed_add");
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
      UpsertBirthSnapshot(birth);
      return true;
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
         ClearCloseLatch(removed_key, receipts, "grid_close_flat");
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
      if(removed > 0)
         PersistBirths(receipts, "stale_cleanup");
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
      intent.max_slippage_points = 10.0;
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
      intent.max_slippage_points = 10.0;
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
         BuildGridCloseIntent(symbol, grid, existing_latch.close_reason, latch_metadata, grid.floating_pnl, latched_close_intent);
         bus.Add(latched_close_intent);
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
      StartCloseLatch(grid, terminal_close_reason, config, receipts, started_latch);

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
      BuildGridCloseIntent(symbol, grid, terminal_close_reason, metadata, net_open_money, close_intent);
      bus.Add(close_intent);

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

public:
   void Reset()
   {
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
      m_research_telemetry.Reset();
      ArrayResize(m_births, 0);
      ArrayResize(m_pending_lifecycle, 0);
      ArrayResize(m_close_latches, 0);
   }

   void Configure(const ulong config_hash, const LP_Config &config)
   {
      m_config_hash = config_hash;
      m_state_persistence_enabled = config.persist_revma_lifecycle_state;
   }

   void RecordRiskDecision(
      const LP_TradeIntent &intent,
      const LP_RiskDecision &decision,
      LP_ReceiptWriter &receipts
   )
   {
      if(intent.research_lifecycle_event == LP_RESEARCH_LIFECYCLE_NONE ||
         decision.decision != LP_RISK_REJECT)
         return;

      LP_RevmaPendingLifecycle pending;
      if(!TakePendingLifecycle(intent.intent_id, pending))
         return;

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
   }

   void RecordExecutionOutcome(
      const LP_TradePlan &plan,
      const LP_TradeExecutionResult &execution,
      LP_ReceiptWriter &receipts
   )
   {
      if(plan.research_lifecycle_event == LP_RESEARCH_LIFECYCLE_NONE)
         return;

      LP_RevmaPendingLifecycle pending;
      if(!TakePendingLifecycle(plan.intent_id, pending))
         return;

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
         return;
      }

      if(pending.event_type == LP_RESEARCH_LIFECYCLE_GRID_BIRTH)
      {
         RememberBirth(pending.grid_key, pending.signal, AddPolicyName(pending.signal));
         PersistBirths(receipts, "executed_birth");
         LP_RevmaGridBirthSnapshot birth;
         if(FindBirth(pending.grid_key, birth))
            m_research_telemetry.RecordExecutedBirth(birth, execution);
      }
      else if(pending.event_type == LP_RESEARCH_LIFECYCLE_GRID_ADD)
      {
         RecordAdd(pending.grid_key, pending.add_type, receipts);
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

   void RecordCloseExecution(
      const LP_TradePlan &plan,
      const LP_TradeExecutionResult &execution,
      LP_ReceiptWriter &receipts
   )
   {
      m_research_telemetry.RecordCloseExecution(plan, execution);
      m_research_telemetry.RecordAccountCloseExecution(plan, execution);
      UpdateCloseLatchProgress(plan, execution, receipts);
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
         PersistBirths(receipts, "tester_final_checkpoint", true);
         PersistCloseLatches(receipts, "tester_final_checkpoint", true);
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
           RememberPendingLifecycle(
              add_intent,
              signal,
              add_type,
              active_grid.position_count,
              active_grid.lots,
              active_grid.floating_pnl
           );
           bus.Add(add_intent);
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
      RememberPendingLifecycle(open_intent, signal, "", 0, 0.0, 0.0);
      bus.Add(open_intent);
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
