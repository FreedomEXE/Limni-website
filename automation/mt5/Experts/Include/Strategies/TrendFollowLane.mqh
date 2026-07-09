/*-----------------------------------------------
  Gate 99W q-state currency trend lane
-----------------------------------------------*/
#ifndef __LIMNI_PORTFOLIO_TREND_FOLLOW_LANE_MQH__
#define __LIMNI_PORTFOLIO_TREND_FOLLOW_LANE_MQH__

#include "..\\Core\\Types.mqh"
#include "..\\Portfolio\\GridBook.mqh"
#include "IntentBus.mqh"

class LP_TrendFollowLane
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

   bool StrongDirection(const LP_SignalSnapshot &snapshot, int &direction)
   {
      direction = LP_SIDE_NONE;
      if(snapshot.pair_state == LP_PAIR_STATE_STRONG_LONG)
      {
         direction = LP_SIDE_LONG;
         return true;
      }
      if(snapshot.pair_state == LP_PAIR_STATE_STRONG_SHORT)
      {
         direction = LP_SIDE_SHORT;
         return true;
      }
      return false;
   }

   void BuildIntent(
      const LP_SignalSnapshot &snapshot,
      const LP_Config &config,
      const int action,
      const int direction,
      const ulong grid_key,
      const string reason,
      LP_TradeIntent &intent
   )
   {
      intent.intent_id = NextIntentId();
      intent.symbol_id = snapshot.symbol_id;
      intent.symbol = snapshot.symbol;
      intent.lane_id = LP_LANE_TREND_FOLLOW;
      intent.variant_id = LP_VARIANT_STRICT;
      intent.action = action;
      intent.direction = direction;
      intent.emitted_at = TimeCurrent();
      intent.source_bar_time = snapshot.source_bar_time;
      intent.expires_at = config.qstate_intent_expiry_minutes > 0 ?
         (datetime)((long)TimeCurrent() + (long)config.qstate_intent_expiry_minutes * 60) : 0;
      intent.requested_lots = config.qstate_fixed_lots;
      intent.max_slippage_points = 10.0;
      intent.take_profit_distance_price = 0.0;
      intent.stop_loss_distance_price = 0.0;
      intent.target_take_profit_price = 0.0;
      intent.target_stop_loss_price = 0.0;
      intent.stop_take_profit_basis = "";
      intent.priority = action == LP_INTENT_OPEN_GRID ? 50 : 40;
      intent.score = snapshot.pair_direction_score;
      intent.grid_key = grid_key;
      intent.grid_tickets = "";
      intent.expected_grid_ticket_count = 0;
      intent.research_lifecycle_event = LP_RESEARCH_LIFECYCLE_NONE;
      intent.research_add_type = "";
      intent.close_reason = "";
      intent.config_hash = m_config_hash;
      intent.strategy_version_hash = m_strategy_version_hash;
      intent.human_reason = reason +
         "|variant_id=g99w-qstate-v001" +
         "|formula_id=" + snapshot.formula_id +
         "|formula_hash=" + (string)snapshot.formula_hash +
         "|pair_state=" + LP_PairStateName(snapshot.pair_state) +
         "|market_mode=" + LP_MarketModeName(snapshot.market_mode) +
         "|pair_q_score=" + DoubleToString(snapshot.pair_q_score, 6) +
         "|pair_direction_score=" + DoubleToString(snapshot.pair_direction_score, 6) +
         "|q=" + DoubleToString(snapshot.q, 8);
   }

public:
   void Reset()
   {
      m_next_intent_id = 990000000001;
      m_strategy_version_hash = LP_HashString("g99w-qstate-v001|q_currency_state_trend|grid_spacing_1q|fixed_lot_0_01");
      m_config_hash = 0;
   }

   void Configure(const ulong config_hash)
   {
      m_config_hash = config_hash;
   }

   int Evaluate(
      const LP_SignalSnapshot &snapshot,
      const LP_Config &config,
      LP_GridBook &grid_book,
      LP_IntentBus &bus
   )
   {
      if(!config.enable_qstate_trend_variant)
         return 0;
      if(!snapshot.valid || !snapshot.session_allowed || !snapshot.news_allowed)
         return 0;
      if(snapshot.market_mode == LP_MARKET_STRESS || snapshot.pair_state == LP_PAIR_STATE_STRESS)
         return 0;
      if(snapshot.q <= 0.0 || config.qstate_fixed_lots <= 0.0 || config.qstate_grid_spacing_q <= 0.0)
         return 0;

      int direction = LP_SIDE_NONE;
      if(!StrongDirection(snapshot, direction))
         return 0;

      LP_GridInventoryRow same_grid;
      bool has_same_grid = grid_book.FindGrid(
         snapshot.symbol_id,
         LP_LANE_TREND_FOLLOW,
         LP_VARIANT_STRICT,
         direction,
         same_grid
      );

      if(has_same_grid)
      {
         int cap = MathMax(1, config.qstate_grid_cap);
         if(same_grid.position_count >= cap)
            return 0;

         double spacing = snapshot.q * config.qstate_grid_spacing_q;
         if(spacing <= 0.0)
            return 0;

         bool adverse_hit = false;
         if(direction > 0 && same_grid.min_entry_price > 0.0)
            adverse_hit = snapshot.price <= same_grid.min_entry_price - spacing;
         else if(direction < 0 && same_grid.max_entry_price > 0.0)
            adverse_hit = snapshot.price >= same_grid.max_entry_price + spacing;

         if(!adverse_hit)
            return 0;

         LP_TradeIntent add_intent;
         BuildIntent(
            snapshot,
            config,
            LP_INTENT_ADD_GRID_LEG,
            direction,
            same_grid.grid_key,
            "qstate_adverse_add_1q",
            add_intent
         );
         bus.Add(add_intent);
         return 1;
      }

      if(grid_book.HasSymbolLaneGrid(snapshot.symbol_id, LP_LANE_TREND_FOLLOW, LP_VARIANT_STRICT))
         return 0;

      LP_TradeIntent open_intent;
      BuildIntent(
         snapshot,
         config,
         LP_INTENT_OPEN_GRID,
         direction,
         0,
         "qstate_strong_direction_open",
         open_intent
      );
      bus.Add(open_intent);
      return 1;
   }
};

#endif // __LIMNI_PORTFOLIO_TREND_FOLLOW_LANE_MQH__
