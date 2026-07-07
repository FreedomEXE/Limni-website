/*-----------------------------------------------
  Revma v001 locked grid-sleeve strategy
-----------------------------------------------*/
#ifndef __LIMNI_PORTFOLIO_REVMA_GRID_SLEEVE_MQH__
#define __LIMNI_PORTFOLIO_REVMA_GRID_SLEEVE_MQH__

#include "..\\Core\\Types.mqh"
#include "..\\Portfolio\\GridBook.mqh"
#include "..\\Receipts\\ReceiptWriter.mqh"
#include "IntentBus.mqh"
#include "RevmaTypes.mqh"

struct LP_RevmaGridBirthSnapshot
{
   bool valid;
   ulong grid_key;
   datetime source_m1_time;
   int direction;
   int raw_direction;
   int anchor_relation;
   int sleeve;
   int variant_id;
   string add_policy;
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
};

void LP_ResetRevmaGridBirthSnapshot(LP_RevmaGridBirthSnapshot &birth)
{
   birth.valid = false;
   birth.grid_key = 0;
   birth.source_m1_time = 0;
   birth.direction = LP_SIDE_NONE;
   birth.raw_direction = LP_SIDE_NONE;
   birth.anchor_relation = 0;
   birth.sleeve = LP_REVMA_SLEEVE_NONE;
   birth.variant_id = LP_VARIANT_NONE;
   birth.add_policy = "";
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

   ulong NextIntentId()
   {
      ulong id = m_next_intent_id;
      m_next_intent_id++;
      return id;
   }

   bool SleeveEnabled(const LP_Config &config, const int sleeve)
   {
      if(sleeve == LP_REVMA_SLEEVE_CONTINUATION)
         return config.revma_enable_continuation_sleeve;
      if(sleeve == LP_REVMA_SLEEVE_REVERSION)
         return config.revma_enable_reversion_sleeve;
      return false;
   }

   string AddPolicyName(const LP_RevmaSignal &signal)
   {
      if(signal.sleeve == LP_REVMA_SLEEVE_CONTINUATION)
         return signal.direction > 0 ? "continuation_add_higher" : "continuation_add_lower";
      if(signal.sleeve == LP_REVMA_SLEEVE_REVERSION)
         return signal.direction > 0 ? "reversion_add_lower" : "reversion_add_higher";
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
      m_births[index].direction = signal.direction;
      m_births[index].raw_direction = signal.raw_direction;
      m_births[index].anchor_relation = signal.anchor_relation;
      m_births[index].sleeve = signal.sleeve;
      m_births[index].variant_id = signal.variant_id;
      m_births[index].add_policy = add_policy;
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

   string BirthSnapshotMetadata(const LP_RevmaGridBirthSnapshot &birth)
   {
      if(!birth.valid)
         return "|birth_snapshot=missing_in_memory";

      return "|birth_snapshot=in_memory" +
         "|birth_direction=" + LP_RevmaDirectionName(birth.direction) +
         "|birth_raw_direction=" + LP_RevmaDirectionName(birth.raw_direction) +
         "|birth_anchor_location=" + LP_RevmaAnchorRelationName(birth.anchor_relation) +
         "|birth_sleeve=" + LP_RevmaSleeveName(birth.sleeve) +
         "|birth_variant_id=" + IntegerToString(birth.variant_id) +
         "|birth_add_policy=" + birth.add_policy +
         "|birth_q=" + DoubleToString(birth.q, 8) +
         "|birth_q_pips=" + DoubleToString(birth.q_pips, 2) +
         "|birth_anchor=" + DoubleToString(birth.anchor, 5) +
         "|birth_price=" + DoubleToString(birth.price, 5) +
         "|birth_anchor_distance_q=" + DoubleToString(birth.anchor_distance_q, 6) +
         "|birth_stoch=" + DoubleToString(birth.stoch, 2) +
         "|birth_trend_state=" + IntegerToString(birth.trend_state) +
         "|birth_raw_score=" + DoubleToString(birth.raw_score, 6) +
         "|birth_trend_score=" + DoubleToString(birth.trend_score, 6) +
         "|birth_exhaustion_score=" + DoubleToString(birth.exhaustion_score, 6) +
         "|birth_confidence=" + DoubleToString(birth.confidence, 6) +
         "|birth_q_profile=" + LP_RevmaQProfileName(birth.q_profile) +
         "|birth_max_m1_bars=" + IntegerToString(birth.max_m1_bars) +
         "|birth_q_profile_id=" + birth.q_profile_id +
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
         "|q_at_entry=" + DoubleToString(signal.q, 8) +
         "|q_pips=" + DoubleToString(signal.q_pips, 2) +
         "|entry_anchor=" + DoubleToString(signal.anchor, 5) +
         "|entry_price=" + DoubleToString(signal.price, 5) +
         "|entry_anchor_distance_q=" + DoubleToString(signal.anchor_distance_q, 6) +
         "|entry_stoch=" + DoubleToString(signal.stoch, 2) +
         "|entry_trend_state=" + IntegerToString(signal.trend_state) +
         "|entry_raw_score=" + DoubleToString(signal.raw_score, 6) +
         "|entry_trend_score=" + DoubleToString(signal.trend_score, 6) +
         "|entry_exhaustion_score=" + DoubleToString(signal.exhaustion_score, 6) +
         "|entry_confidence=" + DoubleToString(signal.confidence, 6) +
         "|source_m1_time=" + LP_Stamp(signal.source_m1_time);
   }

   string AddMetadata(
      const LP_RevmaSignal &signal,
      const LP_GridInventoryRow &grid,
      const string add_policy,
      const LP_RevmaGridBirthSnapshot &birth
   )
   {
      double distance_from_avg_entry_q = 0.0;
      if(signal.q > 0.0 && grid.avg_entry_price > 0.0)
         distance_from_avg_entry_q = (signal.price - grid.avg_entry_price) / signal.q;

      return "system_id=" + signal.system_id +
         "|system_name=" + LP_REVMA_SYSTEM_NAME +
         "|formula_id=" + signal.formula_id +
         "|formula_hash=" + (string)signal.formula_hash +
         "|pair_direction_formula_id=" + signal.pair_direction_formula_id +
         "|pair_direction_formula_hash=" + (string)signal.pair_direction_formula_hash +
         "|add_policy=" + add_policy +
         "|existing_grid_key=" + (string)grid.grid_key +
         "|grid_variant_id=" + IntegerToString(grid.variant_id) +
         "|grid_direction=" + LP_RevmaDirectionName(grid.direction) +
         "|existing_positions=" + IntegerToString(grid.position_count) +
         "|existing_lots=" + DoubleToString(grid.lots, 2) +
         "|avg_entry=" + DoubleToString(grid.avg_entry_price, 5) +
         "|min_entry=" + DoubleToString(grid.min_entry_price, 5) +
         "|max_entry=" + DoubleToString(grid.max_entry_price, 5) +
         "|distance_from_avg_entry_q=" + DoubleToString(distance_from_avg_entry_q, 6) +
         "|floating_pnl=" + DoubleToString(grid.floating_pnl, 2) +
         BirthSnapshotMetadata(birth) +
         "|current_direction=" + LP_RevmaDirectionName(signal.direction) +
         "|current_raw_direction=" + LP_RevmaDirectionName(signal.raw_direction) +
         "|current_anchor_location=" + LP_RevmaAnchorRelationName(signal.anchor_relation) +
         "|current_sleeve=" + LP_RevmaSleeveName(signal.sleeve) +
         "|current_q=" + DoubleToString(signal.q, 8) +
         "|current_q_pips=" + DoubleToString(signal.q_pips, 2) +
         "|current_anchor=" + DoubleToString(signal.anchor, 5) +
         "|current_price=" + DoubleToString(signal.price, 5) +
         "|current_anchor_distance_q=" + DoubleToString(signal.anchor_distance_q, 6) +
         "|current_stoch=" + DoubleToString(signal.stoch, 2) +
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

   void BuildIntent(
      const LP_RevmaSignal &signal,
      const int action,
      const ulong grid_key,
      const string reason,
      LP_TradeIntent &intent
   )
   {
      intent.intent_id = NextIntentId();
      intent.symbol_id = signal.symbol_id;
      intent.symbol = signal.symbol;
      intent.lane_id = LP_LANE_REVMA;
      intent.variant_id = signal.variant_id;
      intent.action = action;
      intent.direction = signal.direction;
      intent.emitted_at = TimeCurrent();
      intent.source_bar_time = signal.source_m1_time;
      intent.expires_at = 0;
      intent.requested_lots = 0.0;
      intent.max_slippage_points = 10.0;
      intent.priority = action == LP_INTENT_OPEN_GRID ? 60 : 55;
      intent.score = signal.raw_score;
      intent.grid_key = grid_key;
      intent.config_hash = m_config_hash;
      intent.strategy_version_hash = m_strategy_version_hash;
      intent.human_reason = reason;
   }

   bool ContinuationAddHit(const LP_RevmaSignal &signal, const LP_GridInventoryRow &grid, const double spacing)
   {
      if(signal.direction > 0 && grid.max_entry_price > 0.0)
         return signal.price >= grid.max_entry_price + spacing;
      if(signal.direction < 0 && grid.min_entry_price > 0.0)
         return signal.price <= grid.min_entry_price - spacing;
      return false;
   }

   bool ReversionAddHit(const LP_RevmaSignal &signal, const LP_GridInventoryRow &grid, const double spacing)
   {
      if(signal.direction > 0 && grid.min_entry_price > 0.0)
         return signal.price <= grid.min_entry_price - spacing;
      if(signal.direction < 0 && grid.max_entry_price > 0.0)
         return signal.price >= grid.max_entry_price + spacing;
      return false;
   }

public:
   void Reset()
   {
      m_next_intent_id = 990300000001;
      m_strategy_version_hash = LP_RevmaFormulaHash();
      m_config_hash = 0;
      m_birth_count = 0;
      m_birth_capacity = 0;
      ArrayResize(m_births, 0);
   }

   void Configure(const ulong config_hash)
   {
      m_config_hash = config_hash;
   }

   int Evaluate(
      const LP_RevmaSignal &signal,
      const LP_Config &config,
      LP_GridBook &grid_book,
      LP_ReceiptWriter &receipts,
      LP_IntentBus &bus
   )
   {
      if(!config.enable_revma_system || !signal.valid)
         return 0;
      if(signal.q <= 0.0 || config.revma_fixed_lots <= 0.0 || config.revma_grid_spacing_q <= 0.0)
         return 0;
      if(!SleeveEnabled(config, signal.sleeve))
         return 0;

      LP_GridInventoryRow same_grid;
      bool has_same_grid = grid_book.FindGrid(
         signal.symbol_id,
         LP_LANE_REVMA,
         signal.variant_id,
         signal.direction,
         same_grid
      );

      if(has_same_grid)
      {
         double spacing = signal.q * config.revma_grid_spacing_q;
         if(spacing <= 0.0)
            return 0;

         string add_policy = "";
         bool add_hit = false;
         if(signal.sleeve == LP_REVMA_SLEEVE_CONTINUATION)
         {
            add_policy = signal.direction > 0 ? "continuation_add_higher" : "continuation_add_lower";
            add_hit = ContinuationAddHit(signal, same_grid, spacing);
         }
         else if(signal.sleeve == LP_REVMA_SLEEVE_REVERSION)
         {
            add_policy = signal.direction > 0 ? "reversion_add_lower" : "reversion_add_higher";
            add_hit = ReversionAddHit(signal, same_grid, spacing);
         }

         if(!add_hit)
            return 0;

         LP_TradeIntent add_intent;
         LP_RevmaGridBirthSnapshot birth_snapshot;
         FindBirth(same_grid.grid_key, birth_snapshot);
         string metadata = AddMetadata(signal, same_grid, add_policy, birth_snapshot);
         BuildIntent(signal, LP_INTENT_ADD_GRID_LEG, same_grid.grid_key, "revma_grid_add|" + metadata, add_intent);
         add_intent.requested_lots = config.revma_fixed_lots;
         add_intent.expires_at = config.revma_intent_expiry_minutes > 0 ?
            (datetime)((long)TimeCurrent() + (long)config.revma_intent_expiry_minutes * 60) : 0;
         bus.Add(add_intent);
         receipts.Write(
            LP_RECEIPT_REVMA_GRID_ADD,
            signal.symbol,
            "add_intent",
            metadata,
            LP_LANE_REVMA,
            signal.variant_id,
            same_grid.grid_key,
            add_intent.intent_id,
            0,
            0
         );
         return 1;
      }

      if(grid_book.HasSymbolAnyLaneGrid(signal.symbol_id, LP_LANE_REVMA))
         return 0;

      LP_TradeIntent open_intent;
      BuildIntent(signal, LP_INTENT_OPEN_GRID, 0, "", open_intent);
      int grid_family = (int)(open_intent.intent_id % 9000) + 1;
      open_intent.grid_key = LP_BuildGridKey(
         signal.symbol_id,
         LP_LANE_REVMA,
         signal.variant_id,
         signal.direction,
         grid_family
      );
      string add_policy = AddPolicyName(signal);
      RememberBirth(open_intent.grid_key, signal, add_policy);
      string birth = BirthMetadata(signal) +
         "|grid_key=" + (string)open_intent.grid_key +
         "|grid_family=" + IntegerToString(grid_family) +
         "|add_policy=" + add_policy;
      open_intent.human_reason = "revma_grid_birth|" + birth;
      open_intent.requested_lots = config.revma_fixed_lots;
      open_intent.expires_at = config.revma_intent_expiry_minutes > 0 ?
         (datetime)((long)TimeCurrent() + (long)config.revma_intent_expiry_minutes * 60) : 0;
      bus.Add(open_intent);
      receipts.Write(
         LP_RECEIPT_REVMA_GRID_BIRTH,
         signal.symbol,
         "birth_intent",
         birth,
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
