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

class LP_RevmaGridSleeve
{
private:
   ulong m_next_intent_id;
   ulong m_strategy_version_hash;
   ulong m_config_hash;

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

   string BirthMetadata(const LP_RevmaSignal &signal)
   {
      return "system_id=" + signal.system_id +
         "|system_name=" + LP_REVMA_SYSTEM_NAME +
         "|formula_id=" + signal.formula_id +
         "|formula_hash=" + (string)signal.formula_hash +
         "|pair_direction_formula_id=" + signal.pair_direction_formula_id +
         "|pair_direction_formula_hash=" + (string)signal.pair_direction_formula_hash +
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

   string AddMetadata(const LP_RevmaSignal &signal, const LP_GridInventoryRow &grid, const string add_policy)
   {
      double distance_from_entry_q = 0.0;
      if(signal.q > 0.0 && grid.avg_entry_price > 0.0)
         distance_from_entry_q = (signal.price - grid.avg_entry_price) / signal.q;

      return BirthMetadata(signal) +
         "|add_policy=" + add_policy +
         "|existing_grid_key=" + (string)grid.grid_key +
         "|existing_positions=" + IntegerToString(grid.position_count) +
         "|existing_lots=" + DoubleToString(grid.lots, 2) +
         "|avg_entry=" + DoubleToString(grid.avg_entry_price, 5) +
         "|min_entry=" + DoubleToString(grid.min_entry_price, 5) +
         "|max_entry=" + DoubleToString(grid.max_entry_price, 5) +
         "|distance_from_entry_q=" + DoubleToString(distance_from_entry_q, 6) +
         "|floating_pnl=" + DoubleToString(grid.floating_pnl, 2);
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
         string metadata = AddMetadata(signal, same_grid, add_policy);
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
      string birth = BirthMetadata(signal) +
         "|add_policy=" + (signal.sleeve == LP_REVMA_SLEEVE_CONTINUATION ?
            (signal.direction > 0 ? "continuation_add_higher" : "continuation_add_lower") :
            (signal.direction > 0 ? "reversion_add_lower" : "reversion_add_higher"));
      BuildIntent(signal, LP_INTENT_OPEN_GRID, 0, "revma_grid_birth|" + birth, open_intent);
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
         0,
         open_intent.intent_id,
         0,
         0
      );
      return 1;
   }
};

#endif // __LIMNI_PORTFOLIO_REVMA_GRID_SLEEVE_MQH__
