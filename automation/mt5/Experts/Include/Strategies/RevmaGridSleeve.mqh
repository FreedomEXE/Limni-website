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
   string system_id;
   string formula_id;
   ulong formula_hash;
   string pair_direction_formula_id;
   ulong pair_direction_formula_hash;
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
   birth.system_id = LP_REVMA_SYSTEM_ID;
   birth.formula_id = LP_REVMA_FORMULA_ID;
   birth.formula_hash = LP_RevmaFormulaHash();
   birth.pair_direction_formula_id = LimniPairDirectionFormulaId();
   birth.pair_direction_formula_hash = LimniPairDirectionFormulaHash();
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
   string m_last_divergent_add_text;
   bool m_dashboard_screenshot_requested;

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

   int SleeveFromVariant(const int variant_id)
   {
      if(variant_id == LP_VARIANT_REVMA_CONTINUATION)
         return LP_REVMA_SLEEVE_CONTINUATION;
      if(variant_id == LP_VARIANT_REVMA_REVERSION)
         return LP_REVMA_SLEEVE_REVERSION;
      return LP_REVMA_SLEEVE_NONE;
   }

   string AddPolicyNameFromFrozen(const int sleeve, const int direction)
   {
      if(sleeve == LP_REVMA_SLEEVE_CONTINUATION)
         return direction > 0 ? "continuation_add_higher" : "continuation_add_lower";
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
      const double spacing_q,
      const double spacing_price,
      const double next_add_level
   )
   {
      double distance_from_avg_entry_q = 0.0;
      if(spacing_q > 0.0 && grid.avg_entry_price > 0.0)
         distance_from_avg_entry_q = (signal.price - grid.avg_entry_price) / spacing_q;

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
         "|current_matches_birth_identity=" + LP_BoolText(current_matches) +
         "|existing_positions=" + IntegerToString(grid.position_count) +
         "|existing_lots=" + DoubleToString(grid.lots, 2) +
         "|avg_entry=" + DoubleToString(grid.avg_entry_price, 5) +
         "|min_entry=" + DoubleToString(grid.min_entry_price, 5) +
         "|max_entry=" + DoubleToString(grid.max_entry_price, 5) +
         "|spacing_q=" + DoubleToString(spacing_q, 8) +
         "|spacing_price=" + DoubleToString(spacing_price, 8) +
         "|next_add_level=" + DoubleToString(next_add_level, 5) +
         "|distance_from_avg_entry_q=" + DoubleToString(distance_from_avg_entry_q, 6) +
         "|floating_pnl=" + DoubleToString(grid.floating_pnl, 2) +
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
      const double spacing_q,
      const double spacing_price,
      const double next_add_level
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
         spacing_q,
         spacing_price,
         next_add_level
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
            spacing_q,
            spacing_price,
            next_add_level
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
      intent.stop_take_profit_basis = "";
      intent.priority = action == LP_INTENT_OPEN_GRID ? 60 : 55;
      intent.score = signal.raw_score;
      intent.grid_key = grid_key;
      intent.config_hash = m_config_hash;
      intent.strategy_version_hash = m_strategy_version_hash;
      intent.human_reason = reason;
   }

   double EstimatedCloseFeePriceDistance(
      const string symbol,
      const double lots,
      const LP_Config &config,
      double &fee_money,
      double &money_per_price,
      string &note
   )
   {
      fee_money = 0.0;
      money_per_price = 0.0;
      note = "";

      double abs_lots = MathAbs(lots);
      if(abs_lots <= 0.0 || config.stop_take_profit_close_commission_per_lot <= 0.0)
         return 0.0;

      fee_money = abs_lots * config.stop_take_profit_close_commission_per_lot;
      double tick_size = SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_SIZE);
      double tick_value = SymbolInfoDouble(symbol, SYMBOL_TRADE_TICK_VALUE);
      if(tick_size <= 0.0 || tick_value <= 0.0)
      {
         note = "fee_adjustment_unavailable_symbol_tick_value";
         return 0.0;
      }

      money_per_price = (tick_value / tick_size) * abs_lots;
      if(money_per_price <= 0.0 || !MathIsValidNumber(money_per_price))
      {
         note = "fee_adjustment_unavailable_money_per_price";
         return 0.0;
      }

      double distance = fee_money / money_per_price;
      if(distance <= 0.0 || !MathIsValidNumber(distance))
      {
         note = "fee_adjustment_unavailable_distance";
         return 0.0;
      }
      return distance;
   }

   void ApplyStopTakeProfit(
      const double q_distance_basis,
      const LP_Config &config,
      LP_TradeIntent &intent
   )
   {
      intent.take_profit_distance_price = 0.0;
      intent.stop_loss_distance_price = 0.0;
      intent.stop_take_profit_basis = "";

      if(config.stop_take_profit_mode != LP_SLTP_SINGLE_PAIR_Q_AFTER_FEES)
         return;
      if(config.revma_universe_mode != LP_UNIVERSE_CURRENT_CHART)
         return;
      if(q_distance_basis <= 0.0 || !MathIsValidNumber(q_distance_basis))
         return;

      double fee_money = 0.0;
      double money_per_price = 0.0;
      string fee_note = "";
      double fee_price_distance = EstimatedCloseFeePriceDistance(
         intent.symbol,
         intent.requested_lots,
         config,
         fee_money,
         money_per_price,
         fee_note
      );

      double raw_take_profit_distance = config.take_profit_value > 0.0 ?
         q_distance_basis * config.take_profit_value : 0.0;
      double raw_stop_loss_distance = config.stop_loss_value > 0.0 ?
         q_distance_basis * config.stop_loss_value : 0.0;

      if(raw_take_profit_distance > 0.0)
         intent.take_profit_distance_price = raw_take_profit_distance + fee_price_distance;
      if(raw_stop_loss_distance > 0.0)
      {
         double adjusted_stop_distance = raw_stop_loss_distance - fee_price_distance;
         if(adjusted_stop_distance > 0.0)
            intent.stop_loss_distance_price = adjusted_stop_distance;
         else
            fee_note = fee_note == "" ? "stop_loss_disabled_fee_exceeds_distance" :
               fee_note + ",stop_loss_disabled_fee_exceeds_distance";
      }

      if(raw_take_profit_distance > 0.0 || raw_stop_loss_distance > 0.0)
      {
         intent.stop_take_profit_basis = "single_pair_q_after_fees" +
            "|take_profit_value_q=" + DoubleToString(config.take_profit_value, 4) +
            "|stop_loss_value_q=" + DoubleToString(config.stop_loss_value, 4) +
            "|raw_take_profit_distance_price=" + DoubleToString(raw_take_profit_distance, 8) +
            "|raw_stop_loss_distance_price=" + DoubleToString(raw_stop_loss_distance, 8) +
            "|fee_price_adjustment=" + DoubleToString(fee_price_distance, 8) +
            "|estimated_close_fee_money=" + DoubleToString(fee_money, 2) +
            "|money_per_price=" + DoubleToString(money_per_price, 2) +
            "|close_commission_per_lot=" + DoubleToString(config.stop_take_profit_close_commission_per_lot, 2);
         if(fee_note != "")
            intent.stop_take_profit_basis += "|fee_note=" + fee_note;
      }
   }

   bool FrozenAddHit(
      const string frozen_add_policy,
      const LP_RevmaSignal &signal,
      const LP_GridInventoryRow &grid,
      const double spacing,
      double &next_add_level
   )
   {
      next_add_level = 0.0;
      if(spacing <= 0.0)
         return false;

      if(frozen_add_policy == "continuation_add_higher")
      {
         if(grid.max_entry_price <= 0.0)
            return false;
         next_add_level = grid.max_entry_price + spacing;
         return signal.price >= next_add_level;
      }
      if(frozen_add_policy == "continuation_add_lower")
      {
         if(grid.min_entry_price <= 0.0)
            return false;
         next_add_level = grid.min_entry_price - spacing;
         return signal.price <= next_add_level;
      }
      if(frozen_add_policy == "reversion_add_lower")
      {
         if(grid.min_entry_price <= 0.0)
            return false;
         next_add_level = grid.min_entry_price - spacing;
         return signal.price <= next_add_level;
      }
      if(frozen_add_policy == "reversion_add_higher")
      {
         if(grid.max_entry_price <= 0.0)
            return false;
         next_add_level = grid.max_entry_price + spacing;
         return signal.price >= next_add_level;
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
      const string last_action
   )
   {
      string current_policy = AddPolicyName(signal);
      bool current_matches = has_grid && CurrentMatchesFrozenIdentity(signal, frozen_variant_id, frozen_direction);
      m_visual_text =
         "LIMNI REVMA DASHBOARD\n" +
         "CURRENT SIGNAL\n" +
         " symbol: " + signal.symbol + "\n" +
         " direction: " + LP_RevmaDirectionName(signal.direction) +
            "  sleeve: " + LP_RevmaSleeveName(signal.sleeve) + "\n" +
         " implied add: " + current_policy + "\n" +
         " q profile: " + signal.q_profile_id +
            "  q: " + DoubleToString(signal.q, 8) + "\n" +
         " anchor: " + PriceText(signal.anchor) +
            "  price: " + PriceText(signal.price) + "\n" +
         " stoch: " + DoubleToString(signal.stoch, 2) +
            "  trend: " + IntegerToString(signal.trend_state) + "\n" +
         " variant/formula: V" + IntegerToString(signal.variant_id) +
            " / " + (string)signal.formula_hash + "\n\n" +
         "ACTIVE GRID\n";

      if(!has_grid)
      {
         m_visual_text +=
            " grid: none\n" +
            " last action: " + last_action;
         return;
      }

      string birth_q_profile = birth.valid ? birth.q_profile_id : "missing";
      string birth_anchor = birth.valid ? PriceText(birth.anchor) : "missing";
      string birth_price = birth.valid ? PriceText(birth.price) : "missing";
      string birth_formula = birth.valid ? (string)birth.formula_hash : "missing";
      m_visual_text +=
         " grid_id: " + (string)grid.grid_key +
            "  tickets: " + ShortText(grid.tickets, 42) + "\n" +
         " birth direction: " + LP_RevmaDirectionName(frozen_direction) +
            "  order side: " + LP_RevmaDirectionName(grid.direction) + "\n" +
         " frozen sleeve: " + LP_RevmaSleeveName(frozen_sleeve) + "\n" +
         " frozen add: " + frozen_add_policy + "\n" +
         " birth q profile: " + birth_q_profile + "\n" +
         " birth anchor/price: " + birth_anchor + " / " + birth_price + "\n" +
         " birth variant/formula: V" + IntegerToString(frozen_variant_id) +
            " / " + birth_formula + "\n" +
         " current variant: V" + IntegerToString(signal.variant_id) +
            "  matches birth: " + LP_BoolText(current_matches) + "\n" +
         " next add level: " + PriceText(next_add_level) + "\n" +
         " open positions: " + IntegerToString(grid.position_count) +
            "  lots: " + DoubleToString(grid.lots, 2) + "\n" +
         " last action: " + last_action;

      if(m_last_divergent_add_text != "")
         m_visual_text += "\n\n" + m_last_divergent_add_text;
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
      m_last_divergent_add_text = "";
      m_dashboard_screenshot_requested = false;
      ArrayResize(m_births, 0);
   }

   void Configure(const ulong config_hash)
   {
      m_config_hash = config_hash;
   }

   string VisualDashboardText()
   {
      return m_visual_text;
   }

   bool ConsumeDashboardScreenshotRequest()
   {
      if(!m_dashboard_screenshot_requested)
         return false;
      m_dashboard_screenshot_requested = false;
      return true;
   }

   int Evaluate(
      const LP_RevmaSignal &signal,
      const LP_Config &config,
      LP_GridBook &grid_book,
      LP_ReceiptWriter &receipts,
      LP_IntentBus &bus
   )
   {
      if(!signal.valid)
         return 0;
      if(signal.q <= 0.0 || config.revma_fixed_lots <= 0.0 || config.revma_grid_spacing_q <= 0.0)
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

         int frozen_variant_id = birth_snapshot.valid ? birth_snapshot.variant_id : active_grid.variant_id;
         int frozen_direction = birth_snapshot.valid ? birth_snapshot.direction : active_grid.direction;
         int frozen_sleeve = birth_snapshot.valid ? birth_snapshot.sleeve : SleeveFromVariant(active_grid.variant_id);
         string frozen_add_policy = birth_snapshot.valid ? birth_snapshot.add_policy : AddPolicyNameFromFrozen(frozen_sleeve, frozen_direction);
         double spacing_q = birth_snapshot.valid && birth_snapshot.q > 0.0 ? birth_snapshot.q : signal.q;
         double spacing = spacing_q * config.revma_grid_spacing_q;
         double next_add_level = 0.0;

         if(!SleeveEnabled(config, frozen_sleeve))
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
            UpdateVisualText(signal, true, active_grid, birth_snapshot, frozen_variant_id, frozen_direction, frozen_sleeve, frozen_add_policy, next_add_level, "skip: frozen sleeve disabled");
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
            UpdateVisualText(signal, true, active_grid, birth_snapshot, frozen_variant_id, frozen_direction, frozen_sleeve, frozen_add_policy, next_add_level, "skip: frozen policy unavailable");
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
            UpdateVisualText(signal, true, active_grid, birth_snapshot, frozen_variant_id, frozen_direction, frozen_sleeve, frozen_add_policy, next_add_level, "skip: spacing invalid");
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

         bool add_hit = FrozenAddHit(frozen_add_policy, signal, active_grid, spacing, next_add_level);

         if(!add_hit)
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
            UpdateVisualText(signal, true, active_grid, birth_snapshot, frozen_variant_id, frozen_direction, frozen_sleeve, frozen_add_policy, next_add_level, "skip: spacing not reached");
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
            return 0;
         }

         LP_TradeIntent add_intent;
         string metadata = AddMetadata(
            signal,
            active_grid,
            birth_snapshot,
            frozen_variant_id,
            frozen_direction,
            frozen_sleeve,
            frozen_add_policy,
            spacing_q,
            spacing,
            next_add_level
         );
         BuildIntent(signal, LP_INTENT_ADD_GRID_LEG, active_grid.grid_key, frozen_variant_id, frozen_direction, "revma_grid_add|" + metadata, add_intent);
         add_intent.requested_lots = config.revma_fixed_lots;
         add_intent.expires_at = config.revma_intent_expiry_minutes > 0 ?
            (datetime)((long)TimeCurrent() + (long)config.revma_intent_expiry_minutes * 60) : 0;
         ApplyStopTakeProfit(spacing_q, config, add_intent);
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
         UpdateVisualText(signal, true, active_grid, birth_snapshot, frozen_variant_id, frozen_direction, frozen_sleeve, frozen_add_policy, next_add_level, "add intent emitted");
         receipts.Write(
            LP_RECEIPT_REVMA_GRID_ADD,
            signal.symbol,
            "add_intent",
            metadata,
            LP_LANE_REVMA,
            frozen_variant_id,
            active_grid.grid_key,
            add_intent.intent_id,
            0,
            0
         );
         return 1;
      }

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

      if(!SleeveEnabled(config, signal.sleeve))
         return 0;

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
      RememberBirth(open_intent.grid_key, signal, add_policy);
      string birth = BirthMetadata(signal) +
         "|grid_key=" + (string)open_intent.grid_key +
         "|grid_family=" + IntegerToString(grid_family) +
         "|locked_add_policy=" + add_policy +
         "|add_policy=" + add_policy;
      open_intent.human_reason = "revma_grid_birth|" + birth;
      open_intent.requested_lots = config.revma_fixed_lots;
      open_intent.expires_at = config.revma_intent_expiry_minutes > 0 ?
         (datetime)((long)TimeCurrent() + (long)config.revma_intent_expiry_minutes * 60) : 0;
      ApplyStopTakeProfit(signal.q, config, open_intent);
      bus.Add(open_intent);
      UpdateVisualText(signal, false, active_grid, birth_snapshot, signal.variant_id, signal.direction, signal.sleeve, add_policy, 0.0, "birth intent emitted");
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
