/*-----------------------------------------------
  LimniPortfolioEA shared contracts
-----------------------------------------------*/
#ifndef __LIMNI_PORTFOLIO_TYPES_MQH__
#define __LIMNI_PORTFOLIO_TYPES_MQH__

enum LP_CcyId
{
   LP_CCY_AUD = 0,
   LP_CCY_CAD = 1,
   LP_CCY_CHF = 2,
   LP_CCY_EUR = 3,
   LP_CCY_GBP = 4,
   LP_CCY_JPY = 5,
   LP_CCY_NZD = 6,
   LP_CCY_USD = 7,
   LP_CCY_COUNT = 8
};

enum LP_SymbolId
{
   LP_SYM_AUDCAD = 0,
   LP_SYM_AUDCHF = 1,
   LP_SYM_AUDJPY = 2,
   LP_SYM_AUDNZD = 3,
   LP_SYM_AUDUSD = 4,
   LP_SYM_CADCHF = 5,
   LP_SYM_CADJPY = 6,
   LP_SYM_CHFJPY = 7,
   LP_SYM_EURAUD = 8,
   LP_SYM_EURCAD = 9,
   LP_SYM_EURCHF = 10,
   LP_SYM_EURGBP = 11,
   LP_SYM_EURJPY = 12,
   LP_SYM_EURNZD = 13,
   LP_SYM_EURUSD = 14,
   LP_SYM_GBPAUD = 15,
   LP_SYM_GBPCAD = 16,
   LP_SYM_GBPCHF = 17,
   LP_SYM_GBPJPY = 18,
   LP_SYM_GBPNZD = 19,
   LP_SYM_GBPUSD = 20,
   LP_SYM_NZDCAD = 21,
   LP_SYM_NZDCHF = 22,
   LP_SYM_NZDJPY = 23,
   LP_SYM_NZDUSD = 24,
   LP_SYM_USDCAD = 25,
   LP_SYM_USDCHF = 26,
   LP_SYM_USDJPY = 27,
   LP_SYMBOL_COUNT = 28
};

enum LP_LaneId
{
   LP_LANE_NONE = 0,
   LP_LANE_TREND_FOLLOW = 1,
   LP_LANE_REVERSAL = 2,
   LP_LANE_REVMA = 3
};

enum LP_VariantId
{
   LP_VARIANT_NONE = 0,
   LP_VARIANT_STRICT = 1,
   LP_VARIANT_LOOSE = 2,
   LP_VARIANT_REVMA_REVERSION = 11
};

enum LP_UniverseMode
{
   LP_UNIVERSE_CURRENT_CHART = 0,
   LP_UNIVERSE_FX28 = 1
};

enum LP_RevmaQProfile
{
   LP_REVMA_Q_PROFILE_FAST = 0,
   LP_REVMA_Q_PROFILE_MEDIUM = 1,
   LP_REVMA_Q_PROFILE_SLOW = 2,
   LP_REVMA_Q_PROFILE_FULL = 3,
   LP_REVMA_Q_PROFILE_CUSTOM = 4
};

enum LP_StopTakeProfitMode
{
   LP_SLTP_DISABLED = 0,
   LP_SLTP_SINGLE_PAIR_Q_AFTER_FEES = 1,
   LP_SLTP_MULTI_CURRENCY_PERCENT_AFTER_FEES = 2,
   LP_SLTP_MULTI_CURRENCY_HWM_TRAIL_AFTER_FEES = 3
};

enum LP_BrokerGridTpSyncMode
{
   LP_BROKER_GRID_TP_SYNC_OFF = 0,
   LP_BROKER_GRID_TP_SYNC_LIVE_ONLY = 1,
   LP_BROKER_GRID_TP_SYNC_TESTER_AND_LIVE = 2
};

enum LP_ReceiptMode
{
   LP_RECEIPT_MODE_OFF = 0,
   LP_RECEIPT_MODE_FULL = 1,
   LP_RECEIPT_MODE_COMPACT_LONG_RUN = 2
};

enum LP_MarketMode
{
   LP_MARKET_UNKNOWN = 0,
   LP_MARKET_TREND_UP = 1,
   LP_MARKET_TREND_DOWN = -1,
   LP_MARKET_RANGE = 2,
   LP_MARKET_TRANSITION = 3,
   LP_MARKET_STRESS = 4
};

enum LP_PairDirectionState
{
   LP_PAIR_STATE_STRONG_SHORT = -2,
   LP_PAIR_STATE_WEAK_SHORT = -1,
   LP_PAIR_STATE_NEUTRAL = 0,
   LP_PAIR_STATE_WEAK_LONG = 1,
   LP_PAIR_STATE_STRONG_LONG = 2,
   LP_PAIR_STATE_STRESS = 3
};

enum LP_Side
{
   LP_SIDE_SHORT = -1,
   LP_SIDE_NONE = 0,
   LP_SIDE_LONG = 1
};

enum LP_IntentAction
{
   LP_INTENT_NONE = 0,
   LP_INTENT_OPEN_GRID = 1,
   LP_INTENT_ADD_GRID_LEG = 2,
   LP_INTENT_REDUCE_GRID = 3,
   LP_INTENT_CLOSE_GRID = 4,
   LP_INTENT_CLOSE_ALL_EA = 5,
   LP_INTENT_SYNC_GRID_TP = 6
};

// Strategy-provided execution capabilities.  The broker layer transports and
// applies these generic capabilities without interpreting strategy meaning.
struct LP_ExecutionContract
{
   bool defer_deal_proof;
   bool exact_lots_required;
   double exact_lots;
   int close_limit_override;
   bool close_identity_filter;
   int close_lane_id;
   int close_variant_id;
};

void LP_ResetExecutionContract(LP_ExecutionContract &contract)
{
   contract.defer_deal_proof = false;
   contract.exact_lots_required = false;
   contract.exact_lots = 0.0;
   contract.close_limit_override = 0;
   contract.close_identity_filter = false;
   contract.close_lane_id = LP_LANE_NONE;
   contract.close_variant_id = LP_VARIANT_NONE;
}

bool LP_ExecutionContractPresent(const LP_ExecutionContract &contract)
{
   return contract.defer_deal_proof ||
      contract.exact_lots_required ||
      contract.close_limit_override > 0 ||
      contract.close_identity_filter;
}

enum LP_ResearchLifecycleEvent
{
   LP_RESEARCH_LIFECYCLE_NONE = 0,
   LP_RESEARCH_LIFECYCLE_GRID_BIRTH = 1,
   LP_RESEARCH_LIFECYCLE_GRID_ADD = 2
};

enum LP_RiskDecisionCode
{
   LP_RISK_REJECT = 0,
   LP_RISK_APPROVE = 1,
   LP_RISK_APPROVE_REDUCED_SIZE = 2,
   LP_RISK_DEFER = 3,
   LP_RISK_CLOSE_ONLY = 4,
   LP_RISK_FORCE_ACCOUNT_CLOSE = 5
};

enum LP_RiskReason
{
   LP_RISK_REASON_NONE = 0,
   LP_RISK_REASON_EXECUTION_DISABLED = 1,
   LP_RISK_REASON_SESSION_BLOCK = 2,
   LP_RISK_REASON_NEWS_BLOCK = 3,
   LP_RISK_REASON_CURRENCY_EXPOSURE = 4,
   LP_RISK_REASON_MARGIN = 5,
   LP_RISK_REASON_SPREAD = 6,
   LP_RISK_REASON_RECOVERY_LOCKED = 7,
   LP_RISK_REASON_DUPLICATE = 8,
   LP_RISK_REASON_NO_STRATEGY = 9,
   LP_RISK_REASON_INVALID_INTENT = 10,
   LP_RISK_REASON_SYMBOL_NOT_TRADABLE = 11,
   LP_RISK_REASON_SIZE_LIMIT = 12
};

enum LP_ExecutionMode
{
   LP_EXECUTION_DISABLED = 0,
   LP_EXECUTION_DRY_RUN = 1,
   LP_EXECUTION_TESTER_ONLY = 2,
   LP_EXECUTION_LIVE_ALLOWED = 3
};

enum LP_NewsGuardMode
{
   LP_NEWS_GUARD_DISABLED = 0,
   LP_NEWS_GUARD_MANUAL_FILE = 1,
   LP_NEWS_GUARD_REQUIRED_FOR_LIVE = 2
};

enum LP_RecoveryState
{
   LP_RECOVERY_OK = 0,
   LP_RECOVERY_LOCKED = 1
};

enum LP_PositionGroup
{
   LP_POSITION_GROUP_UNKNOWN = 0,
   LP_POSITION_GROUP_ENTRY = 1,
   LP_POSITION_GROUP_GRID = 2,
   LP_POSITION_GROUP_EXTERNAL = 3
};

enum LP_HarvestStateCode
{
   LP_HARVEST_DISABLED = 0,
   LP_HARVEST_CONFIG_INVALID = 1,
   LP_HARVEST_ARMED_INITIAL_TARGET = 2,
   LP_HARVEST_HWM_ACTIVE = 3,
   LP_HARVEST_SOFT_LOCK_ACTIVE = 4,
   LP_HARVEST_GRID_WINDDOWN_ACTIVE = 5,
   LP_HARVEST_EMERGENCY_LIQUIDATION_ARMED = 6,
   LP_HARVEST_COOLDOWN = 7
};

enum LP_ReceiptKind
{
   LP_RECEIPT_RUN_START = 1,
   LP_RECEIPT_SYMBOL_INIT = 2,
   LP_RECEIPT_ENGINE_STEP = 3,
   LP_RECEIPT_SIGNAL = 4,
   LP_RECEIPT_INTENT = 5,
   LP_RECEIPT_RISK_DECISION = 6,
   LP_RECEIPT_TRADE_PLAN = 7,
   LP_RECEIPT_ORDER_REQUEST = 8,
   LP_RECEIPT_ORDER_RESULT = 9,
   LP_RECEIPT_TRADE_TRANSACTION = 10,
   LP_RECEIPT_ACCOUNT_GOVERNOR = 11,
   LP_RECEIPT_RUN_END = 12,
   LP_RECEIPT_ERROR = 13,
   LP_RECEIPT_POSITION_ATTRIBUTION = 14,
   LP_RECEIPT_HARVEST_STATE = 15,
   LP_RECEIPT_CURRENCY_EXPOSURE = 16,
   LP_RECEIPT_GRID_INVENTORY = 17,
   LP_RECEIPT_NEWS_GUARD = 18,
   LP_RECEIPT_Q_STATE = 19,
   LP_RECEIPT_PORTFOLIO_SELECTOR = 20,
   LP_RECEIPT_PORTFOLIO_Q_STATE = 21,
   LP_RECEIPT_REVMA_SIGNAL = 22,
   LP_RECEIPT_REVMA_GRID_BIRTH = 23,
   LP_RECEIPT_REVMA_GRID_ADD = 24,
   LP_RECEIPT_REVMA_GRID_ADD_SKIP = 25,
   LP_RECEIPT_STOP_TAKE_PROFIT_GUARD = 26,
   LP_RECEIPT_REVMA_REENTRY_GATE = 27,
   LP_RECEIPT_REVMA_GRID_EXIT = 28
};

struct LP_Config
{
   LP_ExecutionMode execution_mode;
   LP_NewsGuardMode news_guard_mode;
   bool enable_trading;
   bool allow_live_trading;
   bool enable_open_order_routing;
   bool enable_close_execution;
   bool enable_account_close_execution;
   bool enable_strategy_evaluation;
   bool require_hedging_account;
   bool require_all_symbols;
   bool use_timer_watchdog;
   int timer_watchdog_seconds;
   bool persist_revma_lifecycle_state;
   string source_revision;
   bool use_week_boundary_guard;
   double broker_to_est_offset_hours;
   int sunday_open_hour_est;
   int friday_close_hour_est;
   int boundary_block_minutes;
   int news_block_before_minutes;
   int news_block_after_minutes;
   string broker_symbol_suffix;
   string output_folder;
   string news_calendar_file;
   bool export_to_common_files;
   LP_ReceiptMode receipt_mode;
   bool enable_portfolio_harvest_governor;
   double harvest_initial_target_money;
   double harvest_trail_money;
   bool harvest_soft_lock_on_breach;
   bool harvest_grid_winddown_on_breach;
   bool harvest_arm_emergency_liquidation;
   bool enable_currency_exposure_guard;
   bool enable_qstate_trend_variant;
   bool enable_revma_system;
   bool enable_kyma_system;
   bool enable_katarakti_system;
   LP_UniverseMode revma_universe_mode;
   LP_RevmaQProfile revma_q_profile;
   int revma_max_m1_bars;
   double revma_fixed_lots;
   double revma_grid_spacing_q;
   int revma_intent_expiry_minutes;
   bool revma_show_visual_dashboard;
   int revma_dashboard_refresh_seconds;
   bool revma_dashboard_screenshot_on_divergent_add;
   LP_StopTakeProfitMode stop_take_profit_mode;
   LP_BrokerGridTpSyncMode broker_grid_tp_sync_mode;
   double grid_take_profit_q;
   double grid_stop_loss_q;
   double account_take_profit_pct;
   double account_stop_loss_pct;
   double stop_take_profit_close_commission_per_lot;
   double hwm_trail_arm_pct;
   double hwm_trail_min_lock_pct;
   double hwm_trail_giveback_pct;
   bool hwm_trail_block_new_entries_when_armed;
   double hwm_trail_hard_stop_loss_pct;
   double max_currency_signed_lots;
   double max_currency_gross_lots;
   int max_same_direction_grids_per_currency;
   int max_managed_positions;
   double max_single_order_lots;
   int max_close_positions_per_step;
   int news_minimum_impact;
   int qstate_scale_lookback_days;
   double qstate_fixed_lots;
   double qstate_grid_spacing_q;
   int qstate_grid_cap;
   double qstate_weak_threshold;
   double qstate_strong_threshold;
   double qstate_max_spread_cost_q;
   int qstate_intent_expiry_minutes;
   bool qstate_reentry_next_day_after_harvest;
};

struct LP_SymbolMeta
{
   int symbol_id;
   string canonical_symbol;
   string broker_symbol;
   int base_ccy;
   int quote_ccy;
   int digits;
   double point;
   double tick_size;
   double tick_value;
   double contract_size;
   double min_lot;
   double max_lot;
   double lot_step;
   int trade_mode;
   int spread_points;
   bool selected;
   bool synchronized;
   bool tradable;
};

struct LP_TickSnapshot
{
   string symbol;
   datetime time;
   double bid;
   double ask;
   int spread_points;
   bool valid;
};

struct LP_BarClockState
{
   int symbol_id;
   string symbol;
   datetime last_bar_time;
   double close;
   bool new_bar;
   bool synchronized;
};

struct LP_SignalSnapshot
{
   int symbol_id;
   string symbol;
   int lane_id;
   int variant_id;
   datetime source_bar_time;
   datetime source_m1_time;
   datetime portfolio_asof_m1_time;
   int direction;
   int market_mode;
   int pair_state;
   string formula_id;
   ulong formula_hash;
   double score;
   double price;
   double q;
   double anchor;
   double trend_persistence;
   double anchor_displacement;
   double event_direction_persistence;
   double range_position;
   double sweep_resolution;
   double spread_cost_q;
   double pair_q_score;
   double base_currency_score;
   double quote_currency_score;
   double pair_direction_score;
   double confidence;
   int katarakti_signal;
   int event_count;
   bool valid;
   bool session_allowed;
   bool news_allowed;
   bool receipt_required;
   ulong feature_hash;
   ulong portfolio_snapshot_hash;
   int portfolio_valid_pair_count;
   string reason_code;
   string reason;
};

struct LP_PortfolioQStateSnapshot
{
   datetime asof_m1_time;
   int valid_pair_count;
   int expected_pair_count;
   ulong snapshot_hash;
   bool valid;
   string reason_code;
   string detail;
};

struct LP_TradeIntent
{
   bool gate108;
   int discovery_branch;
   ulong discovery_branch_grid_id;
   ulong discovery_candidate_identity;
   ulong discovery_shared_snapshot_hash;
   ulong discovery_matched_snapshot_hash;
   ulong discovery_pre_candidate_state_hash;
   datetime discovery_source_m1_time;
   int discovery_close_owner;
   string discovery_origin_terminal_reason;
   ulong intent_id;
   int symbol_id;
   string symbol;
   int lane_id;
   int variant_id;
   int action;
   int direction;
   datetime emitted_at;
   datetime source_bar_time;
   datetime expires_at;
   double requested_lots;
   double max_slippage_points;
   double take_profit_distance_price;
   double stop_loss_distance_price;
   double target_take_profit_price;
   double target_stop_loss_price;
   string stop_take_profit_basis;
   int priority;
   double score;
   ulong grid_key;
   string grid_tickets;
   int expected_grid_ticket_count;
   int research_lifecycle_event;
   string research_add_type;
   string close_reason;
   ulong config_hash;
   ulong strategy_version_hash;
   string human_reason;
   LP_ExecutionContract execution_contract;
};

void LP_ResetTradeIntent(LP_TradeIntent &intent)
{
   ZeroMemory(intent);
   intent.gate108 = false;
   intent.discovery_branch = -1;
   intent.discovery_close_owner = 0;
   intent.symbol_id = -1;
   intent.lane_id = LP_LANE_NONE;
   intent.variant_id = LP_VARIANT_NONE;
   intent.action = LP_INTENT_NONE;
   intent.direction = LP_SIDE_NONE;
   LP_ResetExecutionContract(intent.execution_contract);
}

struct LP_RiskDecision
{
   ulong decision_id;
   ulong intent_id;
   int decision;
   int reason;
   double approved_lots;
   double rejected_lots;
   bool allow_new_order;
   bool allow_reduce;
   bool allow_close;
   string explanation;
   ulong portfolio_snapshot_hash;
   ulong config_hash;
   datetime decided_at;
};

struct LP_TradePlan
{
   bool gate108;
   int discovery_branch;
   ulong discovery_branch_grid_id;
   ulong discovery_candidate_identity;
   ulong discovery_shared_snapshot_hash;
   ulong discovery_matched_snapshot_hash;
   ulong discovery_pre_candidate_state_hash;
   datetime discovery_source_m1_time;
   int discovery_close_owner;
   string discovery_origin_terminal_reason;
   ulong plan_id;
   ulong decision_id;
   ulong intent_id;
   int symbol_id;
   string symbol;
   int lane_id;
   int variant_id;
   int action;
   int direction;
   double lots;
   double max_slippage_points;
   double take_profit_distance_price;
   double stop_loss_distance_price;
   double target_take_profit_price;
   double target_stop_loss_price;
   string stop_take_profit_basis;
   long magic;
   ulong grid_key;
   string grid_tickets;
   int expected_grid_ticket_count;
   int research_lifecycle_event;
   string research_add_type;
   string close_reason;
   string reservation_status;
   string reservation_reason;
   string comment;
   string reason;
   bool executable;
   LP_ExecutionContract execution_contract;
};

#define LP_MAX_EXECUTION_DEAL_TICKETS 32

struct LP_TradeExecutionResult
{
   bool accepted;
   bool partial_fill;
   bool broker_rejected;
   bool order_send_attempted;
   bool session_open;
   string session_outcome;
   int action;
   uint retcode;
   ulong order_ticket;
   ulong deal_ticket;
   ulong position_ticket;
   bool deal_set_complete;
   bool deal_linkage_clean;
   int deal_count;
   ulong deal_set_hash;
   ulong first_deal_ticket;
   ulong last_deal_ticket;
   ulong canonical_deal_tickets[LP_MAX_EXECUTION_DEAL_TICKETS];
   double requested_lots;
   double executed_lots;
   double executed_price;
   double realized_profit;
   double realized_swap;
   double realized_commission;
   double realized_fee;
   int matched_positions;
   int attempted_positions;
   int closed_positions;
   int failed_positions;
   int close_limit;
   string detail;
};

void LP_ResetTradeExecutionResult(LP_TradeExecutionResult &result)
{
   result.accepted = false;
   result.partial_fill = false;
   result.broker_rejected = false;
   result.order_send_attempted = false;
   result.session_open = false;
   result.session_outcome = "not_evaluated";
   result.action = LP_INTENT_NONE;
   result.retcode = 0;
   result.order_ticket = 0;
   result.deal_ticket = 0;
   result.position_ticket = 0;
   result.deal_set_complete = false;
   result.deal_linkage_clean = false;
   result.deal_count = 0;
   result.deal_set_hash = 0;
   result.first_deal_ticket = 0;
   result.last_deal_ticket = 0;
   result.requested_lots = 0.0;
   result.executed_lots = 0.0;
   result.executed_price = 0.0;
   result.realized_profit = 0.0;
   result.realized_swap = 0.0;
   result.realized_commission = 0.0;
   result.realized_fee = 0.0;
   result.matched_positions = 0;
   result.attempted_positions = 0;
   result.closed_positions = 0;
   result.failed_positions = 0;
   result.close_limit = 0;
   result.detail = "";
}

struct LP_BrokerExecutionIntegrity
{
   int successful_order_results;
   int failed_order_results;
   int broker_rejection_count;
   int no_money_count;
   int market_closed_count;
   int session_blocked_open_count;
   int session_deferred_close_count;
   int session_blocked_modify_count;
   int session_metadata_failure_count;
   datetime first_no_money_time;
   datetime last_no_money_time;
   datetime first_broker_rejection_time;
   datetime last_broker_rejection_time;
   datetime first_session_block_time;
   datetime last_session_block_time;
};

void LP_ResetBrokerExecutionIntegrity(LP_BrokerExecutionIntegrity &integrity)
{
   integrity.successful_order_results = 0;
   integrity.failed_order_results = 0;
   integrity.broker_rejection_count = 0;
   integrity.no_money_count = 0;
   integrity.market_closed_count = 0;
   integrity.session_blocked_open_count = 0;
   integrity.session_deferred_close_count = 0;
   integrity.session_blocked_modify_count = 0;
   integrity.session_metadata_failure_count = 0;
   integrity.first_no_money_time = 0;
   integrity.last_no_money_time = 0;
   integrity.first_broker_rejection_time = 0;
   integrity.last_broker_rejection_time = 0;
   integrity.first_session_block_time = 0;
   integrity.last_session_block_time = 0;
}

struct LP_PortfolioState
{
   datetime asof;
   double balance;
   double equity;
   double margin;
   double free_margin;
   double ea_floating_pnl;
   double entry_group_floating_pnl;
   double grid_group_floating_pnl;
   double external_floating_pnl;
   int open_position_count;
   int managed_position_count;
   int entry_group_position_count;
   int grid_group_position_count;
   int external_position_count;
   int unknown_managed_position_count;
   int open_grid_count;
   ulong position_snapshot_hash;
   ulong config_hash;
   int recovery_state;
};

struct LP_HarvestDecision
{
   datetime asof;
   int previous_state;
   int state;
   bool enabled;
   bool config_valid;
   bool block_new_entries;
   bool soft_lock_active;
   bool grid_winddown_active;
   bool emergency_liquidation_armed;
   bool receipt_required;
   double target_money;
   double trail_money;
   double managed_floating_pnl;
   double entry_group_floating_pnl;
   double grid_group_floating_pnl;
   double high_watermark_money;
   double trail_floor_money;
   int managed_position_count;
   int entry_group_position_count;
   int grid_group_position_count;
   string reason;
};

struct LP_CurrencyExposure
{
   int ccy;
   double signed_lots;
   double gross_lots;
   int active_grid_count;
   int same_direction_grid_count;
};

struct LP_NewsEvent
{
   datetime server_time;
   string currency;
   int currency_id;
   int impact;
   string title;
};

string LP_BoolText(const bool value)
{
   return value ? "true" : "false";
}

string LP_UniverseDisplayName(const LP_UniverseMode mode)
{
   if(mode == LP_UNIVERSE_CURRENT_CHART)
      return "Single Pair";
   return "FX28 Portfolio";
}

string LP_RunClassification(const LP_UniverseMode mode)
{
   if(mode == LP_UNIVERSE_CURRENT_CHART)
      return "SINGLE_PAIR_MECHANICS";
   return "FX28_PORTFOLIO_RESEARCH";
}

string LP_ActiveSystemsText(
   const bool enable_revma,
   const bool enable_kyma,
   const bool enable_katarakti
)
{
   string active = "";
   if(enable_revma)
      active = "Revma";
   if(enable_kyma)
      active += active == "" ? "Kyma" : ", Kyma";
   if(enable_katarakti)
      active += active == "" ? "Katarakti" : ", Katarakti";
   return active == "" ? "None" : active;
}

string LP_SafePart(const string value)
{
   string out = "";
   int len = StringLen(value);
   for(int i = 0; i < len; i++)
   {
      ushort ch = (ushort)StringGetCharacter(value, i);
      bool digit = (ch >= '0' && ch <= '9');
      bool upper = (ch >= 'A' && ch <= 'Z');
      bool lower = (ch >= 'a' && ch <= 'z');
      if(digit || upper || lower)
         out += ShortToString(ch);
      else
         out += "_";
   }
   if(out == "")
      out = "blank";
   return out;
}

string LP_Stamp(const datetime value)
{
   if(value <= 0)
      return "";
   return TimeToString(value, TIME_DATE | TIME_SECONDS);
}

string LP_ExecutionModeName(const LP_ExecutionMode mode)
{
   if(mode == LP_EXECUTION_DRY_RUN)
      return "Dry Run";
   if(mode == LP_EXECUTION_TESTER_ONLY)
      return "Tester";
   if(mode == LP_EXECUTION_LIVE_ALLOWED)
      return "Live";
   return "Disabled";
}

string LP_NewsGuardModeName(const LP_NewsGuardMode mode)
{
   if(mode == LP_NEWS_GUARD_MANUAL_FILE)
      return "NEWS_GUARD_MANUAL_FILE";
   if(mode == LP_NEWS_GUARD_REQUIRED_FOR_LIVE)
      return "NEWS_GUARD_REQUIRED_FOR_LIVE";
   return "NEWS_GUARD_DISABLED";
}

bool LP_IsTesterRuntime()
{
   return (bool)MQLInfoInteger(MQL_TESTER) || (bool)MQLInfoInteger(MQL_OPTIMIZATION);
}

string LP_StopTakeProfitModeName(const LP_StopTakeProfitMode mode)
{
   if(mode == LP_SLTP_SINGLE_PAIR_Q_AFTER_FEES)
      return "SINGLE_PAIR_Q_AFTER_FEES";
   if(mode == LP_SLTP_MULTI_CURRENCY_PERCENT_AFTER_FEES)
      return "MULTI_CURRENCY_PERCENT_AFTER_FEES";
   if(mode == LP_SLTP_MULTI_CURRENCY_HWM_TRAIL_AFTER_FEES)
      return "MULTI_CURRENCY_HWM_TRAIL_AFTER_FEES";
   return "DISABLED";
}

string LP_BrokerGridTpSyncModeName(const LP_BrokerGridTpSyncMode mode)
{
   if(mode == LP_BROKER_GRID_TP_SYNC_LIVE_ONLY)
      return "LIVE_ONLY";
   if(mode == LP_BROKER_GRID_TP_SYNC_TESTER_AND_LIVE)
      return "TESTER_AND_LIVE";
   return "OFF";
}

string LP_ResearchLifecycleEventName(const int event)
{
   if(event == LP_RESEARCH_LIFECYCLE_GRID_BIRTH)
      return "grid_birth";
   if(event == LP_RESEARCH_LIFECYCLE_GRID_ADD)
      return "grid_add";
   return "none";
}

bool LP_BrokerGridTpSyncEnabledForRuntime(const LP_BrokerGridTpSyncMode mode)
{
   if(mode == LP_BROKER_GRID_TP_SYNC_OFF)
      return false;
   if(mode == LP_BROKER_GRID_TP_SYNC_TESTER_AND_LIVE)
      return true;
   return !LP_IsTesterRuntime();
}

string LP_ReceiptModeName(const LP_ReceiptMode mode)
{
   if(mode == LP_RECEIPT_MODE_OFF)
      return "OFF";
   if(mode == LP_RECEIPT_MODE_COMPACT_LONG_RUN)
      return "COMPACT_LONG_RUN";
   return "FULL";
}

string LP_PositionGroupName(const int group)
{
   if(group == LP_POSITION_GROUP_ENTRY)
      return "entry";
   if(group == LP_POSITION_GROUP_GRID)
      return "grid";
   if(group == LP_POSITION_GROUP_EXTERNAL)
      return "external";
   return "unknown";
}

int LP_ParseTicketList(const string ticket_list, ulong &tickets[])
{
   ArrayResize(tickets, 0);
   if(ticket_list == "")
      return 0;

   string parts[];
   int raw_count = StringSplit(ticket_list, ';', parts);
   if(raw_count <= 0)
      return 0;

   int valid_count = 0;
   for(int i = 0; i < raw_count; i++)
   {
      ulong ticket = (ulong)StringToInteger(parts[i]);
      if(ticket == 0)
         continue;
      ArrayResize(tickets, valid_count + 1, valid_count + 1);
      tickets[valid_count] = ticket;
      valid_count++;
   }
   return valid_count;
}

string LP_HarvestStateName(const int state)
{
   if(state == LP_HARVEST_CONFIG_INVALID)
      return "config_invalid";
   if(state == LP_HARVEST_ARMED_INITIAL_TARGET)
      return "armed_initial_target";
   if(state == LP_HARVEST_HWM_ACTIVE)
      return "hwm_active";
   if(state == LP_HARVEST_SOFT_LOCK_ACTIVE)
      return "soft_lock_active";
   if(state == LP_HARVEST_GRID_WINDDOWN_ACTIVE)
      return "grid_winddown_active";
   if(state == LP_HARVEST_EMERGENCY_LIQUIDATION_ARMED)
      return "emergency_liquidation_armed";
   if(state == LP_HARVEST_COOLDOWN)
      return "cooldown";
   return "disabled";
}

string LP_MarketModeName(const int mode)
{
   if(mode == LP_MARKET_TREND_UP)
      return "trend_up";
   if(mode == LP_MARKET_TREND_DOWN)
      return "trend_down";
   if(mode == LP_MARKET_RANGE)
      return "range";
   if(mode == LP_MARKET_TRANSITION)
      return "transition";
   if(mode == LP_MARKET_STRESS)
      return "stress";
   return "unknown";
}

string LP_PairStateName(const int state)
{
   if(state == LP_PAIR_STATE_STRONG_LONG)
      return "strong_long";
   if(state == LP_PAIR_STATE_WEAK_LONG)
      return "weak_long";
   if(state == LP_PAIR_STATE_WEAK_SHORT)
      return "weak_short";
   if(state == LP_PAIR_STATE_STRONG_SHORT)
      return "strong_short";
   if(state == LP_PAIR_STATE_STRESS)
      return "stress_no_new_risk";
   return "neutral";
}

void LP_ResetHarvestDecision(LP_HarvestDecision &decision)
{
   decision.asof = 0;
   decision.previous_state = LP_HARVEST_DISABLED;
   decision.state = LP_HARVEST_DISABLED;
   decision.enabled = false;
   decision.config_valid = false;
   decision.block_new_entries = false;
   decision.soft_lock_active = false;
   decision.grid_winddown_active = false;
   decision.emergency_liquidation_armed = false;
   decision.receipt_required = false;
   decision.target_money = 0.0;
   decision.trail_money = 0.0;
   decision.managed_floating_pnl = 0.0;
   decision.entry_group_floating_pnl = 0.0;
   decision.grid_group_floating_pnl = 0.0;
   decision.high_watermark_money = 0.0;
   decision.trail_floor_money = 0.0;
   decision.managed_position_count = 0;
   decision.entry_group_position_count = 0;
   decision.grid_group_position_count = 0;
   decision.reason = "";
}

void LP_ResetPortfolioQStateSnapshot(LP_PortfolioQStateSnapshot &snapshot)
{
   snapshot.asof_m1_time = 0;
   snapshot.valid_pair_count = 0;
   snapshot.expected_pair_count = LP_SYMBOL_COUNT;
   snapshot.snapshot_hash = 0;
   snapshot.valid = false;
   snapshot.reason_code = "";
   snapshot.detail = "";
}

ulong LP_HashString(const string value)
{
   ulong hash = 1469598103934665603;
   int len = StringLen(value);
   for(int i = 0; i < len; i++)
   {
      hash ^= (ulong)StringGetCharacter(value, i);
      hash *= 1099511628211;
   }
   return hash;
}

void LP_HashMixULong(ulong &hash, const ulong value)
{
   hash ^= value;
   hash *= 1099511628211;
}

void LP_HashMixLong(ulong &hash, const long value)
{
   LP_HashMixULong(hash, (ulong)value);
}

void LP_HashMixInt(ulong &hash, const int value)
{
   LP_HashMixULong(hash, (ulong)value);
}

#endif // __LIMNI_PORTFOLIO_TYPES_MQH__
