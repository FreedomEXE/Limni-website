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
#include "Revma\\RevmaGridProtectionManager.mqh"

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
   double m_visual_centerline_price;
   string m_last_divergent_add_text;
   bool m_dashboard_screenshot_requested;
   LP_RevmaGridProtectionManager m_protection_manager;

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

   bool ContinuationAddHasReachableTarget(
      const LP_Config &config,
      const int sleeve,
      string &reason
   )
   {
      reason = "";
      if(sleeve != LP_REVMA_SLEEVE_CONTINUATION)
         return true;
      if(config.stop_take_profit_mode != LP_SLTP_SINGLE_PAIR_Q_AFTER_FEES)
         return true;

      double take_profit_q = LP_RevmaTakeProfitQForSleeve(config, sleeve);
      double spacing_q = LP_RevmaGridSpacingQForSleeve(config, sleeve);
      if(take_profit_q > 0.0 && spacing_q > 0.0 && take_profit_q <= spacing_q)
      {
         reason = "continuation_tp_not_above_grid_spacing";
         return false;
      }
      return true;
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
      double spacing_value_q = spacing_q > 0.0 ? spacing_price / spacing_q : 0.0;

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
         "|grid_spacing_value_q=" + DoubleToString(spacing_value_q, 4) +
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
      intent.target_take_profit_price = 0.0;
      intent.target_stop_loss_price = 0.0;
      intent.stop_take_profit_basis = "";
      intent.priority = action == LP_INTENT_OPEN_GRID ? 60 : 55;
      intent.score = signal.raw_score;
      intent.grid_key = grid_key;
      intent.config_hash = m_config_hash;
      intent.strategy_version_hash = m_strategy_version_hash;
      intent.human_reason = reason;
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
      if(config.stop_take_profit_mode != LP_SLTP_SINGLE_PAIR_Q_AFTER_FEES)
         return "off";
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
      if(config.stop_take_profit_mode != LP_SLTP_SINGLE_PAIR_Q_AFTER_FEES)
         return "";
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
      return "scope=single_pair_grid_q_after_fees" +
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
         "|take_profit_value_q=" + DoubleToString(take_profit_q, 4) +
         "|stop_loss_value_q=" + DoubleToString(stop_loss_q, 4) +
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
      const string reason,
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
      double money_per_price = 0.0;
      string money_note = "";
      if(!MoneyPerPriceDistance(symbol, grid.lots, money_per_price, money_note))
      {
         receipts.Write(
            LP_RECEIPT_REVMA_GRID_EXIT,
            symbol,
            "basket_exit_unavailable",
            "scope=single_pair_grid_q_after_fees|reason=" + money_note +
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

      LP_TradeIntent close_intent;
      BuildGridCloseIntent(symbol, grid, reason, metadata, net_open_money, close_intent);
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
      string current_policy = AddPolicyName(signal);
      bool current_matches = has_grid && CurrentMatchesFrozenIdentity(signal, frozen_variant_id, frozen_direction);
      int display_direction = has_grid ? frozen_direction : signal.direction;
      string status = has_grid ? "ACTIVE" : "WAITING";
      string display_sleeve = has_grid ? LP_RevmaSleeveName(frozen_sleeve) : LP_RevmaSleeveName(signal.sleeve);
      string display_policy = has_grid ? frozen_add_policy : current_policy;
      string state_line = LP_RevmaDirectionName(display_direction) + " / " + status;
      string relation_line = LP_RevmaAnchorRelationName(signal.anchor_relation) +
         " / " + DoubleToString(signal.anchor_distance_q, 2) + "q";
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
      m_visual_text += DashboardRow("Q", DoubleToString(signal.q, 8));

      if(!has_grid)
      {
         m_visual_text += DashboardSection("GRID");
         m_visual_text += DashboardRow("POSITIONS", "0");
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
      m_visual_text += DashboardRow("ADD MODE", display_policy);
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
      m_protection_manager.Reset();
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

   int SyncGridTakeProfits(
      const LP_Config &config,
      LP_GridBook &grid_book,
      LP_ReceiptWriter &receipts,
      LP_IntentBus &bus
   )
   {
      if(config.stop_take_profit_mode != LP_SLTP_SINGLE_PAIR_Q_AFTER_FEES)
         return 0;
      if(config.revma_universe_mode != LP_UNIVERSE_CURRENT_CHART)
         return 0;
      if(!LP_RevmaAnySleeveTakeProfitEnabled(config))
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
      if(config.stop_take_profit_mode != LP_SLTP_SINGLE_PAIR_Q_AFTER_FEES)
         return 0;
      if(config.revma_universe_mode != LP_UNIVERSE_CURRENT_CHART)
         return 0;
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

         int frozen_variant_id = birth_snapshot.valid ? birth_snapshot.variant_id : active_grid.variant_id;
         int frozen_direction = birth_snapshot.valid ? birth_snapshot.direction : active_grid.direction;
         int frozen_sleeve = birth_snapshot.valid ? birth_snapshot.sleeve : SleeveFromVariant(active_grid.variant_id);
         string frozen_add_policy = birth_snapshot.valid ? birth_snapshot.add_policy : AddPolicyNameFromFrozen(frozen_sleeve, frozen_direction);
         double spacing_q = birth_snapshot.valid && birth_snapshot.q > 0.0 ? birth_snapshot.q : signal.q;
         double spacing_config_q = LP_RevmaGridSpacingQForSleeve(config, frozen_sleeve);
         double spacing = spacing_q * spacing_config_q;
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

         string target_guard_reason = "";
         if(!ContinuationAddHasReachableTarget(config, frozen_sleeve, target_guard_reason))
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
               target_guard_reason
            );
             UpdateVisualText(signal, true, active_grid, birth_snapshot, frozen_variant_id, frozen_direction, frozen_sleeve, frozen_add_policy, next_add_level, "skip: continuation tp <= spacing", config);
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
             UpdateVisualText(signal, true, active_grid, birth_snapshot, frozen_variant_id, frozen_direction, frozen_sleeve, frozen_add_policy, next_add_level, "skip: spacing not reached", config);
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

      if(!birth_allowed)
      {
         UpdateVisualText(signal, false, active_grid, birth_snapshot, signal.variant_id, signal.direction, signal.sleeve, AddPolicyName(signal), 0.0, "birth blocked: waiting for fresh state", config);
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
      bus.Add(open_intent);
      UpdateVisualText(signal, false, active_grid, birth_snapshot, signal.variant_id, signal.direction, signal.sleeve, add_policy, 0.0, "birth intent emitted", config);
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
