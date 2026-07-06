/*-----------------------------------------------
  Pair-order-safe portfolio intent selector
-----------------------------------------------*/
#ifndef __LIMNI_PORTFOLIO_INTENT_SELECTOR_MQH__
#define __LIMNI_PORTFOLIO_INTENT_SELECTOR_MQH__

#include "..\\Core\\Types.mqh"
#include "..\\Core\\SymbolUniverse.mqh"
#include "..\\Portfolio\\GridBook.mqh"
#include "..\\Receipts\\ReceiptWriter.mqh"

class LP_PortfolioIntentSelector
{
private:
   int m_selected_ids[LP_SYMBOL_COUNT];
   int m_selected_count;
   int m_candidate_count;
   string m_summary;

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

   double RankScore(const LP_SignalSnapshot &snapshot, const bool existing_grid)
   {
      double score = MathAbs(snapshot.pair_direction_score);
      score += MathAbs(snapshot.pair_q_score) * 0.25;
      score -= snapshot.spread_cost_q * 0.50;
      if(existing_grid)
         score += 5.0;
      return score;
   }

   void SwapInt(int &values[], const int a, const int b)
   {
      int tmp = values[a];
      values[a] = values[b];
      values[b] = tmp;
   }

   void SwapDouble(double &values[], const int a, const int b)
   {
      double tmp = values[a];
      values[a] = values[b];
      values[b] = tmp;
   }

   void SwapBool(bool &values[], const int a, const int b)
   {
      bool tmp = values[a];
      values[a] = values[b];
      values[b] = tmp;
   }

   bool CurrencySlotAvailable(
      const int base_ccy,
      const int quote_ccy,
      const int direction,
      const int cap,
      const int &long_counts[],
      const int &short_counts[]
   )
   {
      if(base_ccy < 0 || quote_ccy < 0)
         return false;

      if(direction > 0)
      {
         if(long_counts[base_ccy] >= cap)
            return false;
         if(short_counts[quote_ccy] >= cap)
            return false;
      }
      else if(direction < 0)
      {
         if(short_counts[base_ccy] >= cap)
            return false;
         if(long_counts[quote_ccy] >= cap)
            return false;
      }
      else
      {
         return false;
      }
      return true;
   }

   void AddCurrencySlot(
      const int base_ccy,
      const int quote_ccy,
      const int direction,
      int &long_counts[],
      int &short_counts[]
   )
   {
      if(direction > 0)
      {
         long_counts[base_ccy]++;
         short_counts[quote_ccy]++;
      }
      else if(direction < 0)
      {
         short_counts[base_ccy]++;
         long_counts[quote_ccy]++;
      }
   }

public:
   void Reset()
   {
      m_selected_count = 0;
      m_candidate_count = 0;
      m_summary = "not_selected";
      for(int i = 0; i < LP_SYMBOL_COUNT; i++)
         m_selected_ids[i] = -1;
   }

   void Select(
      const LP_SignalSnapshot &snapshots[],
      const bool &available[],
      const LP_Config &config,
      LP_GridBook &grid_book
   )
   {
      Reset();

      int candidate_ids[LP_SYMBOL_COUNT];
      int candidate_dirs[LP_SYMBOL_COUNT];
      bool candidate_existing_grid[LP_SYMBOL_COUNT];
      double candidate_scores[LP_SYMBOL_COUNT];

      for(int i = 0; i < LP_SYMBOL_COUNT; i++)
      {
         candidate_ids[i] = -1;
         candidate_dirs[i] = LP_SIDE_NONE;
         candidate_existing_grid[i] = false;
         candidate_scores[i] = 0.0;
      }

      for(int symbol_id = 0; symbol_id < LP_SYMBOL_COUNT; symbol_id++)
      {
         if(!available[symbol_id] || !snapshots[symbol_id].valid)
            continue;
         if(!snapshots[symbol_id].session_allowed || !snapshots[symbol_id].news_allowed)
            continue;
         if(snapshots[symbol_id].market_mode == LP_MARKET_STRESS || snapshots[symbol_id].pair_state == LP_PAIR_STATE_STRESS)
            continue;
         if(snapshots[symbol_id].q <= 0.0 || config.qstate_fixed_lots <= 0.0 || config.qstate_grid_spacing_q <= 0.0)
            continue;

         int direction = LP_SIDE_NONE;
         if(!StrongDirection(snapshots[symbol_id], direction))
            continue;

         LP_GridInventoryRow same_grid;
         bool has_same_grid = grid_book.FindGrid(
            symbol_id,
            LP_LANE_TREND_FOLLOW,
            LP_VARIANT_STRICT,
            direction,
            same_grid
         );
         bool has_any_lane_grid = grid_book.HasSymbolLaneGrid(symbol_id, LP_LANE_TREND_FOLLOW, LP_VARIANT_STRICT);
         if(has_any_lane_grid && !has_same_grid)
            continue;

         candidate_ids[m_candidate_count] = symbol_id;
         candidate_dirs[m_candidate_count] = direction;
         candidate_existing_grid[m_candidate_count] = has_same_grid;
         candidate_scores[m_candidate_count] = RankScore(snapshots[symbol_id], has_same_grid);
         m_candidate_count++;
      }

      for(int a = 0; a < m_candidate_count; a++)
      {
         for(int b = a + 1; b < m_candidate_count; b++)
         {
            if(candidate_scores[b] <= candidate_scores[a])
               continue;

            SwapDouble(candidate_scores, a, b);
            SwapInt(candidate_ids, a, b);
            SwapInt(candidate_dirs, a, b);
            SwapBool(candidate_existing_grid, a, b);
         }
      }

      int cap = MathMax(1, config.max_same_direction_grids_per_currency);
      int long_counts[LP_CCY_COUNT];
      int short_counts[LP_CCY_COUNT];
      for(int c = 0; c < LP_CCY_COUNT; c++)
      {
         long_counts[c] = 0;
         short_counts[c] = 0;
      }

      m_summary = "variant_id=g99w-qstate-v001|candidates=" + IntegerToString(m_candidate_count) +
         "|currency_pending_cap=" + IntegerToString(cap);

      for(int i = 0; i < m_candidate_count; i++)
      {
         int symbol_id = candidate_ids[i];
         string canonical = LP_CanonicalSymbol(symbol_id);
         int base_ccy = -1;
         int quote_ccy = -1;
         LP_CanonicalBaseQuote(canonical, base_ccy, quote_ccy);
         if(!CurrencySlotAvailable(base_ccy, quote_ccy, candidate_dirs[i], cap, long_counts, short_counts))
            continue;

         m_selected_ids[m_selected_count] = symbol_id;
         m_selected_count++;
         AddCurrencySlot(base_ccy, quote_ccy, candidate_dirs[i], long_counts, short_counts);

         m_summary += "|selected=" + canonical +
            ":dir=" + IntegerToString(candidate_dirs[i]) +
            ":rank=" + DoubleToString(candidate_scores[i], 6) +
            ":existing_grid=" + LP_BoolText(candidate_existing_grid[i]);
      }

      m_summary += "|selected_count=" + IntegerToString(m_selected_count);
   }

   int Count()
   {
      return m_selected_count;
   }

   int SymbolIdAt(const int index)
   {
      if(index < 0 || index >= m_selected_count)
         return -1;
      return m_selected_ids[index];
   }

   string Summary()
   {
      return m_summary;
   }

   void WriteReceipt(LP_ReceiptWriter &receipts)
   {
      receipts.Write(
         LP_RECEIPT_PORTFOLIO_SELECTOR,
         "",
         "selected_ranked_subset",
         m_summary,
         LP_LANE_TREND_FOLLOW,
         LP_VARIANT_STRICT,
         0,
         0,
         0,
         0
      );
   }
};

#endif // __LIMNI_PORTFOLIO_INTENT_SELECTOR_MQH__
