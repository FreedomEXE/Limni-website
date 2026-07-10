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
   string position_identifiers;
   string last_add_type;
   string close_reason;
   string close_execution_owner;
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
   row.position_identifiers = "";
   row.last_add_type = "";
   row.close_reason = "";
   row.close_execution_owner = "";
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

string LP_RevmaTelemetryAppendIdentifier(const string identifiers, const ulong identifier)
{
   if(identifier == 0)
      return identifiers;
   string text = (string)identifier;
   if(StringFind("|" + identifiers + "|", "|" + text + "|") >= 0)
      return identifiers;
   return identifiers == "" ? text : identifiers + "|" + text;
}

struct LP_RevmaTelemetryReconciliation
{
   double managed_account_realized_pnl;
   double grid_outcome_realized_pnl;
   double difference;
   int matched_deal_count;
   int unmatched_deal_count;
   int unmatched_position_count;
   int ownership_mismatch_deal_count;
   int ownership_mismatch_position_count;
   bool formula_clean_pnl_reconciled;
};

void LP_ResetRevmaTelemetryReconciliation(LP_RevmaTelemetryReconciliation &reconciliation)
{
   reconciliation.managed_account_realized_pnl = 0.0;
   reconciliation.grid_outcome_realized_pnl = 0.0;
   reconciliation.difference = 0.0;
   reconciliation.matched_deal_count = 0;
   reconciliation.unmatched_deal_count = 0;
   reconciliation.unmatched_position_count = 0;
   reconciliation.ownership_mismatch_deal_count = 0;
   reconciliation.ownership_mismatch_position_count = 0;
   reconciliation.formula_clean_pnl_reconciled = false;
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
   datetime m_started_at;

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

   int ParsePositionIdentifiers(const string text, ulong &identifiers[])
   {
      ArrayResize(identifiers, 0);
      int start = 0;
      int length = StringLen(text);
      while(start < length)
      {
         int end = StringFind(text, "|", start);
         if(end < 0)
            end = length;
         string part = StringSubstr(text, start, end - start);
         ulong identifier = (ulong)StringToInteger(part);
         if(identifier > 0)
         {
            int count = ArraySize(identifiers);
            ArrayResize(identifiers, count + 1, count + 1);
            identifiers[count] = identifier;
         }
         start = end + 1;
      }
      return ArraySize(identifiers);
   }

   int FindTicketIndex(const ulong &tickets[], const ulong ticket)
   {
      for(int i = 0; i < ArraySize(tickets); i++)
      {
         if(tickets[i] == ticket)
            return i;
      }
      return -1;
   }

   bool ContainsTicket(const ulong &tickets[], const ulong ticket)
   {
      return FindTicketIndex(tickets, ticket) >= 0;
   }

   void AppendTicket(ulong &tickets[], const ulong ticket)
   {
      if(ticket == 0 || ContainsTicket(tickets, ticket))
         return;
      int count = ArraySize(tickets);
      ArrayResize(tickets, count + 1, count + 1);
      tickets[count] = ticket;
   }

   string ArtifactRelativeBase(const LP_Config &config, LP_ReceiptWriter &receipts)
   {
      string run_id = receipts.RunId();
      int keep = 12;
      if(StringLen(run_id) > keep)
         run_id = StringSubstr(run_id, StringLen(run_id) - keep);
      return config.output_folder + "\\T" + run_id;
   }

   string ArtifactFullPath(const string relative_path, const LP_Config &config)
   {
      string root = config.export_to_common_files ?
         TerminalInfoString(TERMINAL_COMMONDATA_PATH) + "\\Files\\" :
         TerminalInfoString(TERMINAL_DATA_PATH) + "\\MQL5\\Files\\";
      return root + relative_path;
   }

   string ArtifactScopeName(const LP_Config &config)
   {
      return config.export_to_common_files ? "common_files" : "terminal_files";
   }

   void WriteArtifactFailure(
      LP_ReceiptWriter &receipts,
      const LP_Config &config,
      const string artifact,
      const string relative_path,
      const int error,
      const int attempted_rows,
      const string stage
   )
   {
      receipts.Write(
         LP_RECEIPT_ERROR,
         "",
         "revma_telemetry_output_failed",
         "artifact=" + artifact +
            "|stage=" + stage +
            "|full_path=" + ArtifactFullPath(relative_path, config) +
            "|scope=" + ArtifactScopeName(config) +
            "|error=" + IntegerToString(error) +
            "|attempted_rows=" + IntegerToString(attempted_rows),
         LP_LANE_REVMA,
         0,
         0,
         0,
         0,
         0
      );
   }

   void ReconcileRealizedPnl(
      LP_RevmaTelemetryReconciliation &reconciliation,
      const int unmatched_handle,
      int &unmatched_attempted_rows,
      bool &unmatched_write_failed,
      int &unmatched_write_error
   )
   {
      LP_ResetRevmaTelemetryReconciliation(reconciliation);
      unmatched_attempted_rows = 0;
      unmatched_write_failed = false;
      unmatched_write_error = 0;
      ulong matched_deal_tickets[];
      long matched_deal_expected_magics[];
      ulong unmatched_position_identifiers[];
      ulong ownership_mismatch_position_identifiers[];
      ArrayResize(matched_deal_tickets, 0);
      ArrayResize(matched_deal_expected_magics, 0);
      ArrayResize(unmatched_position_identifiers, 0);
      ArrayResize(ownership_mismatch_position_identifiers, 0);

      for(int row_index = 0; row_index < m_count; row_index++)
      {
         if(!m_rows[row_index].valid)
            continue;
         m_rows[row_index].realized_profit = 0.0;
         m_rows[row_index].realized_swap = 0.0;
         m_rows[row_index].realized_commission = 0.0;
         long expected_magic = LP_BuildMagic(
            m_rows[row_index].symbol_id,
            LP_LANE_REVMA,
            m_rows[row_index].variant_id,
            m_rows[row_index].direction,
            (int)(m_rows[row_index].grid_key % 10000)
         );
         ulong identifiers[];
         int identifier_count = ParsePositionIdentifiers(m_rows[row_index].position_identifiers, identifiers);
         for(int identifier_index = 0; identifier_index < identifier_count; identifier_index++)
         {
            if(!HistorySelectByPosition((long)identifiers[identifier_index]))
               continue;
            int deal_count = HistoryDealsTotal();
            for(int deal_index = 0; deal_index < deal_count; deal_index++)
            {
               ulong deal_ticket = HistoryDealGetTicket(deal_index);
               if(deal_ticket == 0 || ContainsTicket(matched_deal_tickets, deal_ticket))
                  continue;
               long entry = HistoryDealGetInteger(deal_ticket, DEAL_ENTRY);
               if(entry != DEAL_ENTRY_IN && entry != DEAL_ENTRY_OUT &&
                  entry != DEAL_ENTRY_INOUT && entry != DEAL_ENTRY_OUT_BY)
                  continue;
               m_rows[row_index].realized_profit += HistoryDealGetDouble(deal_ticket, DEAL_PROFIT);
               m_rows[row_index].realized_swap += HistoryDealGetDouble(deal_ticket, DEAL_SWAP);
               m_rows[row_index].realized_commission += HistoryDealGetDouble(deal_ticket, DEAL_COMMISSION);
               if(FindTicketIndex(matched_deal_tickets, deal_ticket) < 0)
               {
                  int matched_count = ArraySize(matched_deal_tickets);
                  ArrayResize(matched_deal_tickets, matched_count + 1, matched_count + 1);
                  ArrayResize(matched_deal_expected_magics, matched_count + 1, matched_count + 1);
                  matched_deal_tickets[matched_count] = deal_ticket;
                  matched_deal_expected_magics[matched_count] = expected_magic;
               }
            }
         }
      }

      datetime from = m_started_at;
      if(from <= 0)
         from = TimeCurrent();
      if(!HistorySelect(from, TimeCurrent()))
      {
         reconciliation.unmatched_deal_count = 1;
         reconciliation.unmatched_position_count = 1;
         reconciliation.difference = 0.0;
         return;
      }

      int history_deal_count = HistoryDealsTotal();
      for(int deal_index = 0; deal_index < history_deal_count; deal_index++)
      {
         ulong deal_ticket = HistoryDealGetTicket(deal_index);
         if(deal_ticket == 0)
            continue;
         long entry = HistoryDealGetInteger(deal_ticket, DEAL_ENTRY);
         if(entry != DEAL_ENTRY_IN && entry != DEAL_ENTRY_OUT &&
            entry != DEAL_ENTRY_INOUT && entry != DEAL_ENTRY_OUT_BY)
            continue;
         long magic = HistoryDealGetInteger(deal_ticket, DEAL_MAGIC);
         LP_MagicParts parts;
         int matched_deal_index = FindTicketIndex(matched_deal_tickets, deal_ticket);
         bool matched_position_deal = matched_deal_index >= 0;
         long expected_magic = matched_position_deal ? matched_deal_expected_magics[matched_deal_index] : 0;
         bool valid_revma_owner = LP_DecodeMagic(magic, parts) && parts.lane_id == LP_LANE_REVMA;
         bool exact_grid_owner = !matched_position_deal || (valid_revma_owner && magic == expected_magic);
         double pnl = HistoryDealGetDouble(deal_ticket, DEAL_PROFIT) +
            HistoryDealGetDouble(deal_ticket, DEAL_SWAP) +
            HistoryDealGetDouble(deal_ticket, DEAL_COMMISSION);
         if(!valid_revma_owner || !exact_grid_owner)
         {
            if(!matched_position_deal)
               continue;
            reconciliation.ownership_mismatch_deal_count++;
            ulong position_identifier = (ulong)HistoryDealGetInteger(deal_ticket, DEAL_POSITION_ID);
            if(!ContainsTicket(ownership_mismatch_position_identifiers, position_identifier))
            {
               AppendTicket(ownership_mismatch_position_identifiers, position_identifier);
               reconciliation.ownership_mismatch_position_count++;
            }
            string expected_grid_key = "0";
            LP_MagicParts expected_parts;
            if(matched_position_deal && LP_DecodeMagic(expected_magic, expected_parts))
               expected_grid_key = (string)LP_BuildGridKeyFromParts(expected_parts);
            unmatched_attempted_rows++;
            if(unmatched_handle != INVALID_HANDLE &&
               FileWrite(
                  unmatched_handle,
                  (string)deal_ticket,
                  (string)position_identifier,
                  (string)magic,
                  HistoryDealGetString(deal_ticket, DEAL_SYMBOL),
                  expected_grid_key,
                  DoubleToString(pnl, 2),
                  "matched_position_identifier_deal_magic_mismatch|expected_magic=" + (string)expected_magic
               ) == 0)
            {
               unmatched_write_failed = true;
               unmatched_write_error = GetLastError();
            }
            continue;
         }

         reconciliation.managed_account_realized_pnl += pnl;
         if(matched_position_deal)
         {
            reconciliation.matched_deal_count++;
            continue;
         }

         reconciliation.unmatched_deal_count++;
         ulong position_identifier = (ulong)HistoryDealGetInteger(deal_ticket, DEAL_POSITION_ID);
         if(!ContainsTicket(unmatched_position_identifiers, position_identifier))
         {
            AppendTicket(unmatched_position_identifiers, position_identifier);
            reconciliation.unmatched_position_count++;
         }
         unmatched_attempted_rows++;
         if(unmatched_handle != INVALID_HANDLE &&
            FileWrite(unmatched_handle, (string)deal_ticket, (string)position_identifier, (string)magic, LP_CanonicalSymbol(parts.symbol_id), (string)LP_BuildGridKeyFromParts(parts), DoubleToString(pnl, 2), "no_executed_birth_or_add_position_identifier_match") == 0)
         {
            unmatched_write_failed = true;
            unmatched_write_error = GetLastError();
         }
      }

      for(int row_index = 0; row_index < m_count; row_index++)
      {
         if(!m_rows[row_index].valid)
            continue;
         reconciliation.grid_outcome_realized_pnl += m_rows[row_index].realized_profit +
            m_rows[row_index].realized_swap + m_rows[row_index].realized_commission;
      }
      reconciliation.difference = reconciliation.managed_account_realized_pnl - reconciliation.grid_outcome_realized_pnl;
      reconciliation.formula_clean_pnl_reconciled = reconciliation.unmatched_deal_count == 0 &&
         reconciliation.unmatched_position_count == 0 &&
         reconciliation.ownership_mismatch_deal_count == 0 &&
         reconciliation.ownership_mismatch_position_count == 0 &&
         MathAbs(reconciliation.difference) <= 0.01;
   }

   double OffenderSeverity(const LP_RevmaTelemetryGrid &row, const string metric, const datetime asof)
   {
      if(metric == "max_position_count") return (double)row.max_position_count;
      if(metric == "adverse_add_count") return (double)row.adverse_add_count;
      if(metric == "favorable_add_count") return (double)row.favorable_add_count;
      if(metric == "worst_floating_pnl") return MathMax(0.0, -row.worst_floating_pnl);
      if(metric == "age_minutes")
         return row.birth_time > 0 ? (double)MathMax(0, ((long)asof - (long)row.birth_time) / 60) : 0.0;
      return 0.0;
   }

   int WriteTopOffenders(
      const int handle,
      const string metric,
      const datetime asof,
      bool &write_failed,
      int &write_error
   )
   {
      bool selected[];
      ArrayResize(selected, m_count);
      for(int i = 0; i < m_count; i++) selected[i] = false;
      int attempted = 0;
      for(int rank = 1; rank <= 5; rank++)
      {
         int best_index = -1;
         double best_score = 0.0;
         for(int i = 0; i < m_count; i++)
         {
            if(!m_rows[i].valid || selected[i])
               continue;
            double score = OffenderSeverity(m_rows[i], metric, asof);
            if(best_index < 0 || score > best_score)
            {
               best_index = i;
               best_score = score;
            }
         }
         if(best_index < 0 || best_score <= 0.0)
            break;
         LP_RevmaTelemetryGrid row = m_rows[best_index];
         int age_minutes = row.birth_time > 0 ? (int)MathMax(0, ((long)asof - (long)row.birth_time) / 60) : -1;
         attempted++;
         if(FileWrite(handle, metric, IntegerToString(rank), (string)row.grid_key, LP_CanonicalSymbol(row.symbol_id), LP_RevmaDirectionName(row.direction), IntegerToString(row.max_position_count), IntegerToString(row.adverse_add_count), IntegerToString(row.favorable_add_count), DoubleToString(row.worst_floating_pnl, 2), IntegerToString(age_minutes), row.closed ? row.close_reason : "test_end_open") == 0)
         {
            write_failed = true;
            write_error = GetLastError();
            break;
         }
         selected[best_index] = true;
      }
      return attempted;
   }

public:
   void Reset()
   {
      ArrayResize(m_rows, 0);
      m_count = 0;
      m_capacity = 0;
      m_started_at = TimeCurrent();
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
       row.position_identifiers = LP_RevmaTelemetryAppendIdentifier(row.position_identifiers, execution.position_ticket);
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
       row.position_identifiers = LP_RevmaTelemetryAppendIdentifier(row.position_identifiers, execution.position_ticket);
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
      if(plan.action != LP_INTENT_CLOSE_GRID || plan.grid_key <= 0 ||
         (execution.closed_positions <= 0 && !execution.partial_fill && execution.executed_lots <= 0.0))
         return;
      int index = FindIndex(plan.grid_key);
      if(index < 0)
         return;
      if(m_rows[index].close_reason == "")
         m_rows[index].close_reason = plan.close_reason == "" ? "unknown_error" : plan.close_reason;
      m_rows[index].close_execution_owner = "grid_close";
      m_rows[index].realized_profit += execution.realized_profit;
      m_rows[index].realized_swap += execution.realized_swap;
      m_rows[index].realized_commission += execution.realized_commission;
   }

   void RecordAccountCloseExecution(const LP_TradePlan &plan, const LP_TradeExecutionResult &execution)
   {
      if(plan.action != LP_INTENT_CLOSE_ALL_EA ||
         (execution.closed_positions <= 0 && !execution.partial_fill && execution.executed_lots <= 0.0))
         return;
      string reason = plan.close_reason == "" ? "account_tp" : plan.close_reason;
      for(int i = 0; i < m_count; i++)
      {
         if(m_rows[i].valid && !m_rows[i].closed)
         {
            m_rows[i].close_execution_owner = reason;
            if(m_rows[i].close_reason == "")
               m_rows[i].close_reason = reason;
         }
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
      m_rows[index] = row;
   }

   void Finalize(
      const LP_Config &config,
      const LP_BrokerExecutionIntegrity &broker_integrity,
      LP_ReceiptWriter &receipts
   )
   {
      if(!receipts.OutputEnabled())
         return;

      int scope = config.export_to_common_files ? FILE_COMMON : 0;
      string base = ArtifactRelativeBase(config, receipts);
      string unmatched_path = base + "_revma_reconciliation_unmatched.csv";
      int unmatched_handle = FileOpen(unmatched_path, FILE_WRITE | FILE_CSV | FILE_ANSI | scope, ',');
      bool unmatched_header_ok = unmatched_handle != INVALID_HANDLE;
      if(unmatched_header_ok && FileWrite(unmatched_handle, "deal_ticket", "position_identifier", "magic", "symbol", "grid_key", "realized_pnl", "reason") == 0)
      {
         int error = GetLastError();
         FileClose(unmatched_handle);
         unmatched_handle = INVALID_HANDLE;
         unmatched_header_ok = false;
         WriteArtifactFailure(receipts, config, "reconciliation_unmatched", unmatched_path, error, 0, "write_header");
      }
      else if(!unmatched_header_ok)
      {
         WriteArtifactFailure(receipts, config, "reconciliation_unmatched", unmatched_path, GetLastError(), 0, "open");
      }

      LP_RevmaTelemetryReconciliation reconciliation;
      int unmatched_attempted_rows = 0;
      bool unmatched_write_failed = false;
      int unmatched_write_error = 0;
      ReconcileRealizedPnl(reconciliation, unmatched_handle, unmatched_attempted_rows, unmatched_write_failed, unmatched_write_error);
      if(unmatched_handle != INVALID_HANDLE)
         FileClose(unmatched_handle);
      if(unmatched_write_failed)
         WriteArtifactFailure(receipts, config, "reconciliation_unmatched", unmatched_path, unmatched_write_error, unmatched_attempted_rows, "write_row");

      bool formula_clean = reconciliation.formula_clean_pnl_reconciled &&
         broker_integrity.no_money_count == 0 &&
         broker_integrity.broker_rejection_count == 0 &&
         broker_integrity.session_metadata_failure_count == 0;
      string formula_clean_reason = "";
      if(!reconciliation.formula_clean_pnl_reconciled)
         formula_clean_reason = "pnl_reconciliation_unresolved";
      if(reconciliation.ownership_mismatch_deal_count > 0)
         formula_clean_reason += (formula_clean_reason == "" ? "" : "+") + "deal_ownership_mismatch";
      if(broker_integrity.no_money_count > 0)
         formula_clean_reason += (formula_clean_reason == "" ? "" : "+") + "broker_rejection_capacity_contamination";
      if(broker_integrity.broker_rejection_count > 0)
         formula_clean_reason += (formula_clean_reason == "" ? "" : "+") + "broker_rejection_contamination";
      if(broker_integrity.session_metadata_failure_count > 0)
         formula_clean_reason += (formula_clean_reason == "" ? "" : "+") + "trade_session_metadata_unavailable";
      if(formula_clean_reason == "")
         formula_clean_reason = formula_clean ? "clean" : "unknown_formula_integrity_failure";

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
      int max_positions_per_grid = 0;
      int max_adverse_add_depth = 0;
      int max_favorable_add_depth = 0;
      int test_end_open_count = 0;
      int grid_tp_count = 0;
      int grid_sl_count = 0;
      int account_tp_count = 0;
      int account_hwm_count = 0;
      double worst_floating_pnl_grid = 0.0;
      bool worst_floating_grid_seen = false;
      double adverse_total_outcome = 0.0;
      double favorable_total_outcome = 0.0;
      string adverse_symbols = "";
      string favorable_symbols = "";
      datetime asof = TimeCurrent();

      string grid_path = base + "_revma_grid_outcomes.csv";
      int grid_handle = FileOpen(grid_path, FILE_WRITE | FILE_CSV | FILE_ANSI | scope, ',');
      bool grid_write_enabled = grid_handle != INVALID_HANDLE;
      if(grid_write_enabled && FileWrite(grid_handle, "grid_id", "symbol", "direction", "birth_time", "birth_price", "birth_q", "birth_anchor_bucket", "birth_q_stochastic_bucket", "birth_deal_ticket", "birth_position_identifier", "position_identifiers", "birth_executed_lots", "add_count", "adverse_add_count", "favorable_add_count", "max_position_count", "max_grid_depth", "worst_floating_pnl", "best_floating_pnl", "last_floating_pnl", "close_status", "close_execution_owner", "outcome_class", "stale_inventory", "close_time", "age_minutes", "realized_pnl", "realized_swap", "realized_commission", "current_anchor_bucket", "current_q", "current_q_stochastic_bucket", "current_q_stochastic", "current_direction", "current_matches_birth_direction", "current_position_count", "last_add_type", "last_add_position_count_before", "last_add_deal_ticket", "last_add_position_identifier", "last_add_executed_lots", "last_add_executed_price", "time_since_last_add_minutes") == 0)
      {
         int error = GetLastError();
         FileClose(grid_handle);
         grid_handle = INVALID_HANDLE;
         grid_write_enabled = false;
         WriteArtifactFailure(receipts, config, "grid_outcomes", grid_path, error, 0, "write_header");
      }
      else if(!grid_write_enabled)
      {
         WriteArtifactFailure(receipts, config, "grid_outcomes", grid_path, GetLastError(), 0, "open");
      }

      int valid_grid_rows = 0;
      int grid_attempted_rows = 0;
      bool grid_write_failed = false;
      int grid_write_error = 0;
      for(int i = 0; i < m_count; i++)
      {
         if(!m_rows[i].valid)
            continue;
         LP_RevmaTelemetryGrid row = m_rows[i];
         valid_grid_rows++;
         bool closed = row.closed;
         string close_status = closed ? (row.close_reason == "" ? "unknown_error" : row.close_reason) : "test_end_open";
         double total_realized = row.realized_profit + row.realized_swap + row.realized_commission;
         string outcome_class = closed ? (total_realized >= 0.0 ? "closed_winner" : "closed_loser") : "open_at_end";
         int age_minutes = row.birth_time > 0 ? (int)MathMax(0, ((long)(closed ? row.close_time : asof) - (long)row.birth_time) / 60) : -1;
         int since_last_add = row.last_add_time > 0 ? (int)MathMax(0, ((long)asof - (long)row.last_add_time) / 60) : -1;
         if(grid_write_enabled)
         {
            grid_attempted_rows++;
            if(FileWrite(grid_handle, (string)row.grid_key, LP_CanonicalSymbol(row.symbol_id), LP_RevmaDirectionName(row.direction), LP_Stamp(row.birth_time), DoubleToString(row.birth_price, 8), DoubleToString(row.birth_q, 8), row.birth_anchor_bucket, row.birth_stoch_bucket, (string)row.birth_deal_ticket, (string)row.birth_position_ticket, row.position_identifiers, DoubleToString(row.birth_executed_lots, 2), IntegerToString(row.add_count), IntegerToString(row.adverse_add_count), IntegerToString(row.favorable_add_count), IntegerToString(row.max_position_count), IntegerToString(row.max_grid_depth), DoubleToString(row.worst_floating_pnl, 2), DoubleToString(row.best_floating_pnl, 2), DoubleToString(row.last_floating_pnl, 2), close_status, row.close_execution_owner, outcome_class, LP_BoolText(!closed), LP_Stamp(row.close_time), IntegerToString(age_minutes), DoubleToString(row.realized_profit, 2), DoubleToString(row.realized_swap, 2), DoubleToString(row.realized_commission, 2), row.current_anchor_bucket, DoubleToString(row.current_q, 8), row.current_stoch_bucket, DoubleToString(row.current_stoch, 2), LP_RevmaDirectionName(row.current_direction), LP_BoolText(row.current_direction == row.direction), IntegerToString(row.current_position_count), row.last_add_type, IntegerToString(row.last_add_position_count_before), (string)row.last_add_deal_ticket, (string)row.last_add_position_ticket, DoubleToString(row.last_add_executed_lots, 2), DoubleToString(row.last_add_executed_price, 8), IntegerToString(since_last_add)) == 0)
            {
               grid_write_failed = true;
               grid_write_error = GetLastError();
               grid_write_enabled = false;
            }
         }
         int bucket_index = FindBucket(buckets, row, close_status);
         AccumulateBucket(buckets[bucket_index], row, closed, asof);
         adverse_adds += row.adverse_add_count;
         favorable_adds += row.favorable_add_count;
         max_positions_per_grid = MathMax(max_positions_per_grid, row.max_position_count);
         max_adverse_add_depth = MathMax(max_adverse_add_depth, row.adverse_add_count);
         max_favorable_add_depth = MathMax(max_favorable_add_depth, row.favorable_add_count);
         if(!worst_floating_grid_seen || row.worst_floating_pnl < worst_floating_pnl_grid)
         {
            worst_floating_pnl_grid = row.worst_floating_pnl;
            worst_floating_grid_seen = true;
         }
         if(close_status == "grid_tp") grid_tp_count++;
         else if(close_status == "grid_sl") grid_sl_count++;
         else if(close_status == "account_tp") account_tp_count++;
         else if(close_status == "account_hwm") account_hwm_count++;
         else if(close_status == "test_end_open") test_end_open_count++;
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
      if(grid_handle != INVALID_HANDLE)
         FileClose(grid_handle);
      if(grid_write_failed)
         WriteArtifactFailure(receipts, config, "grid_outcomes", grid_path, grid_write_error, grid_attempted_rows, "write_row");

      string bucket_path = base + "_revma_bucket_summary.csv";
      int bucket_handle = FileOpen(bucket_path, FILE_WRITE | FILE_CSV | FILE_ANSI | scope, ',');
      if(bucket_handle == INVALID_HANDLE)
      {
         WriteArtifactFailure(receipts, config, "bucket_summary", bucket_path, GetLastError(), 0, "open");
      }
      else if(FileWrite(bucket_handle, "symbol", "direction", "birth_anchor_bucket", "birth_q_stochastic_bucket", "close_status", "grid_count", "closed_count", "open_at_end_count", "total_realized_pnl", "total_floating_pnl_end", "avg_time_to_close_minutes", "avg_add_count", "adverse_add_count", "favorable_add_count", "max_position_count", "worst_floating_loss", "best_floating_profit") == 0)
      {
         int error = GetLastError();
         FileClose(bucket_handle);
         WriteArtifactFailure(receipts, config, "bucket_summary", bucket_path, error, 0, "write_header");
      }
      else
      {
         int attempted_rows = 0;
         bool write_failed = false;
         int write_error = 0;
         for(int i = 0; i < ArraySize(buckets); i++)
         {
            LP_RevmaTelemetryBucket bucket = buckets[i];
            double avg_close = bucket.time_to_close_count > 0 ? bucket.total_time_to_close_minutes / bucket.time_to_close_count : 0.0;
            double avg_add = bucket.grid_count > 0 ? (double)bucket.total_add_count / bucket.grid_count : 0.0;
            attempted_rows++;
            if(FileWrite(bucket_handle, bucket.symbol, bucket.direction, bucket.birth_anchor_bucket, bucket.birth_stoch_bucket, bucket.close_status, IntegerToString(bucket.grid_count), IntegerToString(bucket.closed_count), IntegerToString(bucket.open_at_end_count), DoubleToString(bucket.total_realized_pnl, 2), DoubleToString(bucket.total_floating_pnl_end, 2), DoubleToString(avg_close, 2), DoubleToString(avg_add, 4), IntegerToString(bucket.total_adverse_add_count), IntegerToString(bucket.total_favorable_add_count), IntegerToString(bucket.max_position_count), DoubleToString(bucket.worst_floating_loss, 2), DoubleToString(bucket.best_floating_profit, 2)) == 0)
            {
               write_failed = true;
               write_error = GetLastError();
               break;
            }
         }
         FileClose(bucket_handle);
         if(write_failed)
            WriteArtifactFailure(receipts, config, "bucket_summary", bucket_path, write_error, attempted_rows, "write_row");
      }

      string add_path = base + "_revma_add_type_summary.csv";
      int add_handle = FileOpen(add_path, FILE_WRITE | FILE_CSV | FILE_ANSI | scope, ',');
      if(add_handle == INVALID_HANDLE)
      {
         WriteArtifactFailure(receipts, config, "add_type_summary", add_path, GetLastError(), 0, "open");
      }
      else if(FileWrite(add_handle, "add_type", "count", "symbols_affected", "grids_affected", "open_at_end_count", "closed_winner_count", "closed_loser_count", "average_grid_outcome_after_add") == 0)
      {
         int error = GetLastError();
         FileClose(add_handle);
         WriteArtifactFailure(receipts, config, "add_type_summary", add_path, error, 0, "write_header");
      }
      else
      {
         bool write_failed = FileWrite(add_handle, "adverse", IntegerToString(adverse_adds), adverse_symbols, IntegerToString(adverse_grids), IntegerToString(adverse_open_at_end), IntegerToString(adverse_closed_winners), IntegerToString(adverse_closed_losers), DoubleToString(adverse_grids > 0 ? adverse_total_outcome / adverse_grids : 0.0, 2)) == 0;
         if(!write_failed)
            write_failed = FileWrite(add_handle, "favorable", IntegerToString(favorable_adds), favorable_symbols, IntegerToString(favorable_grids), IntegerToString(favorable_open_at_end), IntegerToString(favorable_closed_winners), IntegerToString(favorable_closed_losers), DoubleToString(favorable_grids > 0 ? favorable_total_outcome / favorable_grids : 0.0, 2)) == 0;
         int error = write_failed ? GetLastError() : 0;
         FileClose(add_handle);
         if(write_failed)
            WriteArtifactFailure(receipts, config, "add_type_summary", add_path, error, 2, "write_row");
      }

      string reconciliation_path = base + "_revma_reconciliation_summary.csv";
      int reconciliation_handle = FileOpen(reconciliation_path, FILE_WRITE | FILE_CSV | FILE_ANSI | scope, ',');
      if(reconciliation_handle == INVALID_HANDLE)
      {
         WriteArtifactFailure(receipts, config, "reconciliation_summary", reconciliation_path, GetLastError(), 0, "open");
      }
      else if(FileWrite(reconciliation_handle, "managed_account_realized_pnl", "grid_outcome_realized_pnl", "difference", "matched_deal_count", "unmatched_deal_count", "unmatched_position_count", "ownership_mismatch_deal_count", "ownership_mismatch_position_count", "formula_clean_pnl_reconciled", "formula_clean", "formula_clean_reason") == 0)
      {
         int error = GetLastError();
         FileClose(reconciliation_handle);
         WriteArtifactFailure(receipts, config, "reconciliation_summary", reconciliation_path, error, 0, "write_header");
      }
      else
      {
         bool write_failed = FileWrite(reconciliation_handle, DoubleToString(reconciliation.managed_account_realized_pnl, 2), DoubleToString(reconciliation.grid_outcome_realized_pnl, 2), DoubleToString(reconciliation.difference, 2), IntegerToString(reconciliation.matched_deal_count), IntegerToString(reconciliation.unmatched_deal_count), IntegerToString(reconciliation.unmatched_position_count), IntegerToString(reconciliation.ownership_mismatch_deal_count), IntegerToString(reconciliation.ownership_mismatch_position_count), LP_BoolText(reconciliation.formula_clean_pnl_reconciled), LP_BoolText(formula_clean), formula_clean_reason) == 0;
         int error = write_failed ? GetLastError() : 0;
         FileClose(reconciliation_handle);
         if(write_failed)
            WriteArtifactFailure(receipts, config, "reconciliation_summary", reconciliation_path, error, 1, "write_row");
      }

      string capacity_path = base + "_revma_capacity_pathology.csv";
      int capacity_handle = FileOpen(capacity_path, FILE_WRITE | FILE_CSV | FILE_ANSI | scope, ',');
      if(capacity_handle == INVALID_HANDLE)
      {
         WriteArtifactFailure(receipts, config, "capacity_pathology", capacity_path, GetLastError(), 0, "open");
      }
      else if(FileWrite(capacity_handle, "metric", "rank", "grid_key", "symbol", "direction", "max_position_count", "adverse_add_count", "favorable_add_count", "worst_floating_pnl", "age_minutes", "close_status") == 0)
      {
         int error = GetLastError();
         FileClose(capacity_handle);
         WriteArtifactFailure(receipts, config, "capacity_pathology", capacity_path, error, 0, "write_header");
      }
      else
      {
         int attempted_rows = 0;
         bool write_failed = false;
         int write_error = 0;
         attempted_rows += WriteTopOffenders(capacity_handle, "max_position_count", asof, write_failed, write_error);
         if(!write_failed) attempted_rows += WriteTopOffenders(capacity_handle, "adverse_add_count", asof, write_failed, write_error);
         if(!write_failed) attempted_rows += WriteTopOffenders(capacity_handle, "favorable_add_count", asof, write_failed, write_error);
         if(!write_failed) attempted_rows += WriteTopOffenders(capacity_handle, "worst_floating_pnl", asof, write_failed, write_error);
         if(!write_failed) attempted_rows += WriteTopOffenders(capacity_handle, "age_minutes", asof, write_failed, write_error);
         FileClose(capacity_handle);
         if(write_failed)
            WriteArtifactFailure(receipts, config, "capacity_pathology", capacity_path, write_error, attempted_rows, "write_row");
      }

      receipts.Summary("revma_telemetry_grid_rows", IntegerToString(valid_grid_rows));
      receipts.Summary("revma_telemetry_bucket_rows", IntegerToString(ArraySize(buckets)));
      receipts.Summary("revma_telemetry_adverse_adds", IntegerToString(adverse_adds));
      receipts.Summary("revma_telemetry_favorable_adds", IntegerToString(favorable_adds));
      receipts.Summary("max_positions_per_grid", IntegerToString(max_positions_per_grid));
      receipts.Summary("max_adverse_add_depth", IntegerToString(max_adverse_add_depth));
      receipts.Summary("max_favorable_add_depth", IntegerToString(max_favorable_add_depth));
      receipts.Summary("worst_floating_pnl_grid", DoubleToString(worst_floating_grid_seen ? worst_floating_pnl_grid : 0.0, 2));
      receipts.Summary("grids_ended_open", IntegerToString(test_end_open_count));
      receipts.Summary("grids_closed_grid_tp", IntegerToString(grid_tp_count));
      receipts.Summary("grids_closed_grid_sl", IntegerToString(grid_sl_count));
      receipts.Summary("grids_closed_account_tp", IntegerToString(account_tp_count));
      receipts.Summary("grids_closed_account_hwm", IntegerToString(account_hwm_count));
      receipts.Summary("grids_closed_test_end_open", IntegerToString(test_end_open_count));
      receipts.Summary("managed_account_realized_pnl", DoubleToString(reconciliation.managed_account_realized_pnl, 2));
      receipts.Summary("grid_outcome_realized_pnl", DoubleToString(reconciliation.grid_outcome_realized_pnl, 2));
      receipts.Summary("reconciliation_difference", DoubleToString(reconciliation.difference, 2));
      receipts.Summary("matched_deal_count", IntegerToString(reconciliation.matched_deal_count));
      receipts.Summary("unmatched_deal_count", IntegerToString(reconciliation.unmatched_deal_count));
      receipts.Summary("unmatched_position_count", IntegerToString(reconciliation.unmatched_position_count));
      receipts.Summary("ownership_mismatch_deal_count", IntegerToString(reconciliation.ownership_mismatch_deal_count));
      receipts.Summary("ownership_mismatch_position_count", IntegerToString(reconciliation.ownership_mismatch_position_count));
      receipts.Summary("formula_clean_pnl_reconciled", LP_BoolText(reconciliation.formula_clean_pnl_reconciled));
      receipts.Summary("successful_order_results", IntegerToString(broker_integrity.successful_order_results));
      receipts.Summary("failed_order_results", IntegerToString(broker_integrity.failed_order_results));
      receipts.Summary("broker_rejection_count", IntegerToString(broker_integrity.broker_rejection_count));
      receipts.Summary("no_money_count", IntegerToString(broker_integrity.no_money_count));
      receipts.Summary("market_closed_count", IntegerToString(broker_integrity.market_closed_count));
      receipts.Summary("session_blocked_open_count", IntegerToString(broker_integrity.session_blocked_open_count));
      receipts.Summary("session_deferred_close_count", IntegerToString(broker_integrity.session_deferred_close_count));
      receipts.Summary("session_blocked_modify_count", IntegerToString(broker_integrity.session_blocked_modify_count));
      receipts.Summary("session_metadata_failure_count", IntegerToString(broker_integrity.session_metadata_failure_count));
      receipts.Summary("first_no_money_timestamp", LP_Stamp(broker_integrity.first_no_money_time));
      receipts.Summary("last_no_money_timestamp", LP_Stamp(broker_integrity.last_no_money_time));
      receipts.Summary("first_broker_rejection_timestamp", LP_Stamp(broker_integrity.first_broker_rejection_time));
      receipts.Summary("last_broker_rejection_timestamp", LP_Stamp(broker_integrity.last_broker_rejection_time));
      receipts.Summary("first_session_block_timestamp", LP_Stamp(broker_integrity.first_session_block_time));
      receipts.Summary("last_session_block_timestamp", LP_Stamp(broker_integrity.last_session_block_time));
      receipts.Summary("formula_clean", LP_BoolText(formula_clean));
      receipts.Summary("formula_clean_reason", formula_clean_reason);
   }
};

#endif // __LIMNI_PORTFOLIO_REVMA_RESEARCH_TELEMETRY_MQH__
