/*-----------------------------------------------
  Revma executed-lifecycle research telemetry
-----------------------------------------------*/
#ifndef __LIMNI_PORTFOLIO_REVMA_RESEARCH_TELEMETRY_MQH__
#define __LIMNI_PORTFOLIO_REVMA_RESEARCH_TELEMETRY_MQH__

struct LP_RevmaTelemetryGrid
{
   bool valid;
   bool closed;
   ulong grid_key;
   int symbol_id;
   int direction;
   int variant_id;
   datetime birth_time;
   datetime last_add_time;
   datetime close_time;
   double birth_price;
   ulong birth_deal_ticket;
   ulong birth_position_ticket;
   double birth_executed_lots;
   double birth_q;
   double birth_anchor_distance_q;
   double birth_stoch;
   int birth_anchor_relation;
   string birth_anchor_bucket;
   string birth_stoch_bucket;
   int add_count;
   int adverse_add_count;
   int favorable_add_count;
   int max_position_count;
   int max_grid_depth;
   double worst_floating_pnl;
   double best_floating_pnl;
   double last_floating_pnl;
   double realized_profit;
   double realized_swap;
   double realized_commission;
   string position_tickets;
   string last_add_type;
   string close_reason;
   string current_anchor_bucket;
   string current_stoch_bucket;
   int current_direction;
   double current_q;
   double current_stoch;
   int current_position_count;
   int last_add_position_count_before;
   ulong last_add_deal_ticket;
   ulong last_add_position_ticket;
   double last_add_executed_lots;
   double last_add_executed_price;
};

void LP_ResetRevmaTelemetryGrid(LP_RevmaTelemetryGrid &row)
{
   row.valid = false;
   row.closed = false;
   row.grid_key = 0;
   row.symbol_id = -1;
   row.direction = LP_SIDE_NONE;
   row.variant_id = LP_VARIANT_NONE;
   row.birth_time = 0;
   row.last_add_time = 0;
   row.close_time = 0;
   row.birth_price = 0.0;
   row.birth_deal_ticket = 0;
   row.birth_position_ticket = 0;
   row.birth_executed_lots = 0.0;
   row.birth_q = 0.0;
   row.birth_anchor_distance_q = 0.0;
   row.birth_stoch = EMPTY_VALUE;
   row.birth_anchor_relation = 0;
   row.birth_anchor_bucket = "UNKNOWN_Q_ANCHOR_LOCATION";
   row.birth_stoch_bucket = "STOCH_UNKNOWN";
   row.add_count = 0;
   row.adverse_add_count = 0;
   row.favorable_add_count = 0;
   row.max_position_count = 0;
   row.max_grid_depth = 0;
   row.worst_floating_pnl = 0.0;
   row.best_floating_pnl = 0.0;
   row.last_floating_pnl = 0.0;
   row.realized_profit = 0.0;
   row.realized_swap = 0.0;
   row.realized_commission = 0.0;
   row.position_tickets = "";
   row.last_add_type = "";
   row.close_reason = "";
   row.current_anchor_bucket = "UNKNOWN_Q_ANCHOR_LOCATION";
   row.current_stoch_bucket = "STOCH_UNKNOWN";
   row.current_direction = LP_SIDE_NONE;
   row.current_q = 0.0;
   row.current_stoch = EMPTY_VALUE;
   row.current_position_count = 0;
   row.last_add_position_count_before = 0;
   row.last_add_deal_ticket = 0;
   row.last_add_position_ticket = 0;
   row.last_add_executed_lots = 0.0;
   row.last_add_executed_price = 0.0;
}

string LP_RevmaTelemetryAppendSymbol(const string symbols, const string symbol)
{
   if(symbols == "")
      return symbol;
   string token = "|" + symbol + "|";
   if(StringFind("|" + symbols + "|", token) >= 0)
      return symbols;
   return symbols + "|" + symbol;
}

struct LP_RevmaTelemetryBucket
{
   string symbol;
   string direction;
   string birth_anchor_bucket;
   string birth_stoch_bucket;
   string close_status;
   int grid_count;
   int closed_count;
   int open_at_end_count;
   double total_realized_pnl;
   double total_floating_pnl_end;
   double total_time_to_close_minutes;
   int time_to_close_count;
   int total_add_count;
   int total_adverse_add_count;
   int total_favorable_add_count;
   int max_position_count;
   double worst_floating_loss;
   double best_floating_profit;
};

class LP_RevmaResearchTelemetry
{
private:
   LP_RevmaTelemetryGrid m_rows[];
   int m_count;
   int m_capacity;

   int FindIndex(const ulong grid_key)
   {
      for(int i = 0; i < m_count; i++)
      {
         if(m_rows[i].valid && m_rows[i].grid_key == grid_key)
            return i;
      }
      return -1;
   }

   int EnsureIndex(const ulong grid_key)
   {
      int index = FindIndex(grid_key);
      if(index >= 0)
         return index;
      if(m_count >= m_capacity)
      {
         m_capacity = m_capacity <= 0 ? 32 : m_capacity * 2;
         ArrayResize(m_rows, m_capacity);
      }
      index = m_count;
      m_count++;
      LP_ResetRevmaTelemetryGrid(m_rows[index]);
      m_rows[index].valid = true;
      m_rows[index].grid_key = grid_key;
      return index;
   }

   void UpdatePath(LP_RevmaTelemetryGrid &row, const LP_GridInventoryRow &grid)
   {
      row.position_tickets = grid.tickets;
      row.current_position_count = grid.position_count;
      row.last_floating_pnl = grid.floating_pnl;
      if(row.max_position_count <= 0 || grid.position_count > row.max_position_count)
         row.max_position_count = grid.position_count;
      row.max_grid_depth = MathMax(row.max_grid_depth, MathMax(0, grid.position_count - 1));
      if(row.worst_floating_pnl == 0.0 || grid.floating_pnl < row.worst_floating_pnl)
         row.worst_floating_pnl = grid.floating_pnl;
      if(row.best_floating_pnl == 0.0 || grid.floating_pnl > row.best_floating_pnl)
         row.best_floating_pnl = grid.floating_pnl;
   }

   int FindBucket(LP_RevmaTelemetryBucket &buckets[], const LP_RevmaTelemetryGrid &row, const string close_status)
   {
      string symbol = LP_CanonicalSymbol(row.symbol_id);
      string direction = LP_RevmaDirectionName(row.direction);
      for(int i = 0; i < ArraySize(buckets); i++)
      {
         if(buckets[i].symbol == symbol &&
            buckets[i].direction == direction &&
            buckets[i].birth_anchor_bucket == row.birth_anchor_bucket &&
            buckets[i].birth_stoch_bucket == row.birth_stoch_bucket &&
            buckets[i].close_status == close_status)
            return i;
      }
      int index = ArraySize(buckets);
      ArrayResize(buckets, index + 1, index + 1);
      buckets[index].symbol = symbol;
      buckets[index].direction = direction;
      buckets[index].birth_anchor_bucket = row.birth_anchor_bucket;
      buckets[index].birth_stoch_bucket = row.birth_stoch_bucket;
      buckets[index].close_status = close_status;
      buckets[index].grid_count = 0;
      buckets[index].closed_count = 0;
      buckets[index].open_at_end_count = 0;
      buckets[index].total_realized_pnl = 0.0;
      buckets[index].total_floating_pnl_end = 0.0;
      buckets[index].total_time_to_close_minutes = 0.0;
      buckets[index].time_to_close_count = 0;
      buckets[index].total_add_count = 0;
      buckets[index].total_adverse_add_count = 0;
      buckets[index].total_favorable_add_count = 0;
      buckets[index].max_position_count = 0;
      buckets[index].worst_floating_loss = 0.0;
      buckets[index].best_floating_profit = 0.0;
      return index;
   }

   void AccumulateBucket(LP_RevmaTelemetryBucket &bucket, const LP_RevmaTelemetryGrid &row, const bool closed, const datetime asof)
   {
      bucket.grid_count++;
      if(closed)
      {
         bucket.closed_count++;
         bucket.total_realized_pnl += row.realized_profit + row.realized_swap + row.realized_commission;
         if(row.close_time > row.birth_time && row.birth_time > 0)
         {
            bucket.total_time_to_close_minutes += (double)((long)row.close_time - (long)row.birth_time) / 60.0;
            bucket.time_to_close_count++;
         }
      }
      else
      {
         bucket.open_at_end_count++;
         bucket.total_floating_pnl_end += row.last_floating_pnl;
      }
      bucket.total_add_count += row.add_count;
      bucket.total_adverse_add_count += row.adverse_add_count;
      bucket.total_favorable_add_count += row.favorable_add_count;
      bucket.max_position_count = MathMax(bucket.max_position_count, row.max_position_count);
      if(bucket.worst_floating_loss == 0.0 || row.worst_floating_pnl < bucket.worst_floating_loss)
         bucket.worst_floating_loss = row.worst_floating_pnl;
      if(bucket.best_floating_profit == 0.0 || row.best_floating_pnl > bucket.best_floating_profit)
         bucket.best_floating_profit = row.best_floating_pnl;
   }

public:
   void Reset()
   {
      ArrayResize(m_rows, 0);
      m_count = 0;
      m_capacity = 0;
   }

   void RecordExecutedBirth(const LP_RevmaGridBirthSnapshot &birth, const LP_TradeExecutionResult &execution)
   {
      if(!birth.valid || birth.grid_key <= 0)
         return;
      int index = EnsureIndex(birth.grid_key);
      LP_RevmaTelemetryGrid row = m_rows[index];
      row.closed = false;
      row.symbol_id = birth.symbol_id;
      row.direction = birth.direction;
      row.variant_id = birth.variant_id;
      row.birth_time = birth.birth_time;
      row.birth_price = execution.executed_price > 0.0 ? execution.executed_price : birth.price;
      row.birth_deal_ticket = execution.deal_ticket;
      row.birth_position_ticket = execution.position_ticket;
      row.birth_executed_lots = execution.executed_lots;
      row.birth_q = birth.q;
      row.birth_anchor_distance_q = birth.anchor_distance_q;
      row.birth_stoch = birth.stoch;
      row.birth_anchor_relation = birth.anchor_relation;
      row.birth_anchor_bucket = LP_RevmaAnchorBucketName(birth.direction, birth.anchor_relation);
      row.birth_stoch_bucket = LP_RevmaStochasticBucketName(birth.stoch);
      row.current_anchor_bucket = row.birth_anchor_bucket;
      row.current_stoch_bucket = row.birth_stoch_bucket;
      row.current_direction = birth.direction;
      row.current_q = birth.q;
      row.current_stoch = birth.stoch;
      row.current_position_count = MathMax(1, row.current_position_count);
      row.max_position_count = MathMax(1, row.max_position_count);
      m_rows[index] = row;
   }

   void RecordExecutedAdd(
      const ulong grid_key,
      const string add_type,
      const int position_count_before,
      const LP_TradeExecutionResult &execution
   )
   {
      int index = FindIndex(grid_key);
      if(index < 0)
         return;
      LP_RevmaTelemetryGrid row = m_rows[index];
      row.add_count++;
      if(add_type == "adverse")
         row.adverse_add_count++;
      else if(add_type == "favorable")
         row.favorable_add_count++;
      row.last_add_type = add_type;
      row.last_add_time = TimeCurrent();
      row.last_add_position_count_before = position_count_before;
      row.last_add_deal_ticket = execution.deal_ticket;
      row.last_add_position_ticket = execution.position_ticket;
      row.last_add_executed_lots = execution.executed_lots;
      row.last_add_executed_price = execution.executed_price;
      m_rows[index] = row;
   }

   void ObserveGrid(const LP_GridInventoryRow &grid)
   {
      int index = FindIndex(grid.grid_key);
      if(index < 0)
         return;
      LP_RevmaTelemetryGrid row = m_rows[index];
      UpdatePath(row, grid);
      m_rows[index] = row;
   }

   void ObserveGridSignal(const ulong grid_key, const LP_RevmaSignal &signal)
   {
      int index = FindIndex(grid_key);
      if(index < 0)
         return;
      m_rows[index].current_anchor_bucket = LP_RevmaAnchorBucketName(signal.direction, signal.anchor_relation);
      m_rows[index].current_stoch_bucket = LP_RevmaStochasticBucketName(signal.stoch);
      m_rows[index].current_direction = signal.direction;
      m_rows[index].current_q = signal.q;
      m_rows[index].current_stoch = signal.stoch;
   }

   void RecordCloseExecution(const LP_TradePlan &plan, const LP_TradeExecutionResult &execution)
   {
      if(plan.action != LP_INTENT_CLOSE_GRID || plan.grid_key <= 0 || !execution.accepted)
         return;
      int index = FindIndex(plan.grid_key);
      if(index < 0)
         return;
      m_rows[index].close_reason = plan.close_reason == "" ? "unknown_error" : plan.close_reason;
      m_rows[index].realized_profit += execution.realized_profit;
      m_rows[index].realized_swap += execution.realized_swap;
      m_rows[index].realized_commission += execution.realized_commission;
   }

   void RecordAccountCloseExecution(const LP_TradePlan &plan, const LP_TradeExecutionResult &execution)
   {
      if(plan.action != LP_INTENT_CLOSE_ALL_EA || !execution.accepted)
         return;
      string reason = plan.close_reason == "" ? "account_tp" : plan.close_reason;
      for(int i = 0; i < m_count; i++)
      {
         if(m_rows[i].valid && !m_rows[i].closed)
            m_rows[i].close_reason = reason;
      }
   }

   void RecordGridClosed(const LP_RevmaGridBirthSnapshot &birth, const string fallback_reason)
   {
      int index = FindIndex(birth.grid_key);
      if(index < 0)
         return;
      LP_RevmaTelemetryGrid row = m_rows[index];
      row.closed = true;
      row.close_time = TimeCurrent();
      row.current_position_count = 0;
      if(row.close_reason == "")
         row.close_reason = fallback_reason;

      ulong tickets[];
      int ticket_count = LP_ParseTicketList(row.position_tickets, tickets);
      if(ticket_count <= 0)
         return;
      double realized_profit = 0.0;
      double realized_swap = 0.0;
      double realized_commission = 0.0;
      for(int i = 0; i < ticket_count; i++)
      {
         if(tickets[i] == 0 || !HistorySelectByPosition((long)tickets[i]))
            continue;
         int deals = HistoryDealsTotal();
         for(int deal_index = 0; deal_index < deals; deal_index++)
         {
            ulong deal = HistoryDealGetTicket(deal_index);
            if(deal == 0)
               continue;
            long entry = HistoryDealGetInteger(deal, DEAL_ENTRY);
            if(entry != DEAL_ENTRY_OUT && entry != DEAL_ENTRY_OUT_BY)
               continue;
            realized_profit += HistoryDealGetDouble(deal, DEAL_PROFIT);
            realized_swap += HistoryDealGetDouble(deal, DEAL_SWAP);
            realized_commission += HistoryDealGetDouble(deal, DEAL_COMMISSION);
         }
      }
      row.realized_profit = realized_profit;
      row.realized_swap = realized_swap;
      row.realized_commission = realized_commission;
      m_rows[index] = row;
   }

   void Finalize(const LP_Config &config, LP_ReceiptWriter &receipts)
   {
      if(!receipts.OutputEnabled())
         return;

      int scope = config.export_to_common_files ? FILE_COMMON : 0;
      string base = config.output_folder + "\\" + receipts.RunId();
      int grid_handle = FileOpen(base + "_revma_grid_outcomes.csv", FILE_WRITE | FILE_CSV | FILE_ANSI | scope, ',');
      if(grid_handle == INVALID_HANDLE)
      {
         receipts.Write(LP_RECEIPT_ERROR, "", "revma_telemetry_output_failed", "artifact=grid_outcomes|error=" + IntegerToString(GetLastError()), LP_LANE_REVMA, 0, 0, 0, 0, 0);
         return;
      }
      FileWrite(grid_handle, "grid_id", "symbol", "direction", "birth_time", "birth_price", "birth_q", "birth_anchor_bucket", "birth_q_stochastic_bucket", "birth_deal_ticket", "birth_position_ticket", "birth_executed_lots", "add_count", "adverse_add_count", "favorable_add_count", "max_position_count", "max_grid_depth", "worst_floating_pnl", "best_floating_pnl", "last_floating_pnl", "close_status", "outcome_class", "stale_inventory", "close_time", "age_minutes", "realized_pnl", "realized_swap", "realized_commission", "current_anchor_bucket", "current_q", "current_q_stochastic_bucket", "current_q_stochastic", "current_direction", "current_matches_birth_direction", "current_position_count", "last_add_type", "last_add_position_count_before", "last_add_deal_ticket", "last_add_position_ticket", "last_add_executed_lots", "last_add_executed_price", "time_since_last_add_minutes");

      LP_RevmaTelemetryBucket buckets[];
      ArrayResize(buckets, 0);
      int adverse_adds = 0;
      int favorable_adds = 0;
      int adverse_grids = 0;
      int favorable_grids = 0;
      int adverse_open_at_end = 0;
      int favorable_open_at_end = 0;
      int adverse_closed_winners = 0;
      int favorable_closed_winners = 0;
      int adverse_closed_losers = 0;
      int favorable_closed_losers = 0;
      double adverse_total_outcome = 0.0;
      double favorable_total_outcome = 0.0;
      string adverse_symbols = "";
      string favorable_symbols = "";
      datetime asof = TimeCurrent();
      for(int i = 0; i < m_count; i++)
      {
         if(!m_rows[i].valid)
            continue;
         LP_RevmaTelemetryGrid row = m_rows[i];
         bool closed = row.closed;
         string close_status = closed ? (row.close_reason == "" ? "unknown_error" : row.close_reason) : "test_end_open";
         double total_realized = row.realized_profit + row.realized_swap + row.realized_commission;
         string outcome_class = closed ? (total_realized >= 0.0 ? "closed_winner" : "closed_loser") : "open_at_end";
         int age_minutes = row.birth_time > 0 ? (int)MathMax(0, ((long)(closed ? row.close_time : asof) - (long)row.birth_time) / 60) : -1;
         int since_last_add = row.last_add_time > 0 ? (int)MathMax(0, ((long)asof - (long)row.last_add_time) / 60) : -1;
         FileWrite(grid_handle, (string)row.grid_key, LP_CanonicalSymbol(row.symbol_id), LP_RevmaDirectionName(row.direction), LP_Stamp(row.birth_time), DoubleToString(row.birth_price, 8), DoubleToString(row.birth_q, 8), row.birth_anchor_bucket, row.birth_stoch_bucket, (string)row.birth_deal_ticket, (string)row.birth_position_ticket, DoubleToString(row.birth_executed_lots, 2), IntegerToString(row.add_count), IntegerToString(row.adverse_add_count), IntegerToString(row.favorable_add_count), IntegerToString(row.max_position_count), IntegerToString(row.max_grid_depth), DoubleToString(row.worst_floating_pnl, 2), DoubleToString(row.best_floating_pnl, 2), DoubleToString(row.last_floating_pnl, 2), close_status, outcome_class, LP_BoolText(!closed), LP_Stamp(row.close_time), IntegerToString(age_minutes), DoubleToString(row.realized_profit, 2), DoubleToString(row.realized_swap, 2), DoubleToString(row.realized_commission, 2), row.current_anchor_bucket, DoubleToString(row.current_q, 8), row.current_stoch_bucket, DoubleToString(row.current_stoch, 2), LP_RevmaDirectionName(row.current_direction), LP_BoolText(row.current_direction == row.direction), IntegerToString(row.current_position_count), row.last_add_type, IntegerToString(row.last_add_position_count_before), (string)row.last_add_deal_ticket, (string)row.last_add_position_ticket, DoubleToString(row.last_add_executed_lots, 2), DoubleToString(row.last_add_executed_price, 8), IntegerToString(since_last_add));
         int bucket_index = FindBucket(buckets, row, close_status);
         AccumulateBucket(buckets[bucket_index], row, closed, asof);
         adverse_adds += row.adverse_add_count;
         favorable_adds += row.favorable_add_count;
         string symbol = LP_CanonicalSymbol(row.symbol_id);
         if(row.adverse_add_count > 0)
         {
            adverse_grids++;
            adverse_symbols = LP_RevmaTelemetryAppendSymbol(adverse_symbols, symbol);
            adverse_total_outcome += closed ? total_realized : row.last_floating_pnl;
            if(!closed) adverse_open_at_end++;
            else if(total_realized >= 0.0) adverse_closed_winners++;
            else adverse_closed_losers++;
         }
         if(row.favorable_add_count > 0)
         {
            favorable_grids++;
            favorable_symbols = LP_RevmaTelemetryAppendSymbol(favorable_symbols, symbol);
            favorable_total_outcome += closed ? total_realized : row.last_floating_pnl;
            if(!closed) favorable_open_at_end++;
            else if(total_realized >= 0.0) favorable_closed_winners++;
            else favorable_closed_losers++;
         }
      }
      FileClose(grid_handle);

      int bucket_handle = FileOpen(base + "_revma_bucket_summary.csv", FILE_WRITE | FILE_CSV | FILE_ANSI | scope, ',');
      if(bucket_handle != INVALID_HANDLE)
      {
         FileWrite(bucket_handle, "symbol", "direction", "birth_anchor_bucket", "birth_q_stochastic_bucket", "close_status", "grid_count", "closed_count", "open_at_end_count", "total_realized_pnl", "total_floating_pnl_end", "avg_time_to_close_minutes", "avg_add_count", "adverse_add_count", "favorable_add_count", "max_position_count", "worst_floating_loss", "best_floating_profit");
         for(int i = 0; i < ArraySize(buckets); i++)
         {
            LP_RevmaTelemetryBucket bucket = buckets[i];
            double avg_close = bucket.time_to_close_count > 0 ? bucket.total_time_to_close_minutes / bucket.time_to_close_count : 0.0;
            double avg_add = bucket.grid_count > 0 ? (double)bucket.total_add_count / bucket.grid_count : 0.0;
            FileWrite(bucket_handle, bucket.symbol, bucket.direction, bucket.birth_anchor_bucket, bucket.birth_stoch_bucket, bucket.close_status, IntegerToString(bucket.grid_count), IntegerToString(bucket.closed_count), IntegerToString(bucket.open_at_end_count), DoubleToString(bucket.total_realized_pnl, 2), DoubleToString(bucket.total_floating_pnl_end, 2), DoubleToString(avg_close, 2), DoubleToString(avg_add, 4), IntegerToString(bucket.total_adverse_add_count), IntegerToString(bucket.total_favorable_add_count), IntegerToString(bucket.max_position_count), DoubleToString(bucket.worst_floating_loss, 2), DoubleToString(bucket.best_floating_profit, 2));
         }
         FileClose(bucket_handle);
      }
      else
      {
         receipts.Write(LP_RECEIPT_ERROR, "", "revma_telemetry_output_failed", "artifact=bucket_summary|error=" + IntegerToString(GetLastError()), LP_LANE_REVMA, 0, 0, 0, 0, 0);
      }

      int add_handle = FileOpen(base + "_revma_add_type_summary.csv", FILE_WRITE | FILE_CSV | FILE_ANSI | scope, ',');
      if(add_handle != INVALID_HANDLE)
      {
         FileWrite(add_handle, "add_type", "count", "symbols_affected", "grids_affected", "open_at_end_count", "closed_winner_count", "closed_loser_count", "average_grid_outcome_after_add");
         FileWrite(add_handle, "adverse", IntegerToString(adverse_adds), adverse_symbols, IntegerToString(adverse_grids), IntegerToString(adverse_open_at_end), IntegerToString(adverse_closed_winners), IntegerToString(adverse_closed_losers), DoubleToString(adverse_grids > 0 ? adverse_total_outcome / adverse_grids : 0.0, 2));
         FileWrite(add_handle, "favorable", IntegerToString(favorable_adds), favorable_symbols, IntegerToString(favorable_grids), IntegerToString(favorable_open_at_end), IntegerToString(favorable_closed_winners), IntegerToString(favorable_closed_losers), DoubleToString(favorable_grids > 0 ? favorable_total_outcome / favorable_grids : 0.0, 2));
         FileClose(add_handle);
      }
      else
      {
         receipts.Write(LP_RECEIPT_ERROR, "", "revma_telemetry_output_failed", "artifact=add_type_summary|error=" + IntegerToString(GetLastError()), LP_LANE_REVMA, 0, 0, 0, 0, 0);
      }

      receipts.Summary("revma_telemetry_grid_rows", IntegerToString(m_count));
      receipts.Summary("revma_telemetry_bucket_rows", IntegerToString(ArraySize(buckets)));
      receipts.Summary("revma_telemetry_adverse_adds", IntegerToString(adverse_adds));
      receipts.Summary("revma_telemetry_favorable_adds", IntegerToString(favorable_adds));
   }
};

#endif // __LIMNI_PORTFOLIO_REVMA_RESEARCH_TELEMETRY_MQH__
