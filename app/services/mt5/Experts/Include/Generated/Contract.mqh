/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
// AUTO-GENERATED FROM contracts/mt5_event_contract.json - DO NOT EDIT MANUALLY
#ifndef __LIMNI_CONTRACT_MQH__
#define __LIMNI_CONTRACT_MQH__

// REASON_CODE
static const string LIMNI_REASON_CODE_BASKET_TP = "basket_tp";
static const string LIMNI_REASON_CODE_BASKET_SL = "basket_sl";
static const string LIMNI_REASON_CODE_TRAIL_LOCK = "trail_lock";
static const string LIMNI_REASON_CODE_FRIDAY_WINNER_CLOSE = "friday_winner_close";
static const string LIMNI_REASON_CODE_FRIDAY_PROP_CLOSE = "friday_prop_close";
static const string LIMNI_REASON_CODE_SUNDAY_CRYPTO_CLOSE = "sunday_crypto_close";
static const string LIMNI_REASON_CODE_SUNDAY_ROLLOVER_REOPEN = "sunday_rollover_reopen";
static const string LIMNI_REASON_CODE_SWAP_GUARD_CLOSE = "swap_guard_close";
static const string LIMNI_REASON_CODE_DAILY_FLAT_CLOSE = "daily_flat_close";
static const string LIMNI_REASON_CODE_DAILY_REOPEN = "daily_reopen";
static const string LIMNI_REASON_CODE_WEEKLY_FLIP = "weekly_flip";
static const string LIMNI_REASON_CODE_ADDED_LOSER = "added_loser";
static const string LIMNI_REASON_CODE_MANUAL = "manual";
static const string LIMNI_REASON_CODE_SIGNAL = "signal";
static const string LIMNI_REASON_CODE_GENERIC = "generic";
static const string LIMNI_REASON_CODE_NOT_ALLOWED = "not_allowed";
static const string LIMNI_REASON_CODE_UNRESOLVED_SYMBOL = "unresolved_symbol";
static const string LIMNI_REASON_CODE_DUPLICATE_OPEN = "duplicate_open";
static const string LIMNI_REASON_CODE_CRYPTO_NOT_OPEN = "crypto_not_open";
static const string LIMNI_REASON_CODE_NOT_TRADABLE = "not_tradable";
static const string LIMNI_REASON_CODE_INVALID_VOLUME = "invalid_volume";
static const string LIMNI_REASON_CODE_SIZING_GUARD = "sizing_guard";
static const string LIMNI_REASON_CODE_ORDER_FAILED = "order_failed";
static const string LIMNI_REASON_CODE_MAX_VOLUME_REACHED = "max_volume_reached";
static const string LIMNI_REASON_CODE_MAX_POSITIONS = "max_positions";
static const string LIMNI_REASON_CODE_RATE_LIMIT = "rate_limit";
static const string LIMNI_REASON_CODE_PENDING_LEG_FILL = "pending_leg_fill";
static const string LIMNI_REASON_CODE_ENTRY_WINDOW_CLOSED = "entry_window_closed";
static const string LIMNI_REASON_CODE_ADD_WINDOW_CLOSED = "add_window_closed";
static const string LIMNI_REASON_CODE_MAX_LOSER_ADDS = "max_loser_adds";
static const string LIMNI_REASON_CODE_RECONCILE_KEEP = "reconcile_keep";
static const string LIMNI_REASON_CODE_RECONCILE_CLOSE = "reconcile_close";
static const string LIMNI_REASON_CODE_KILL_SWITCH = "kill_switch";
static const string LIMNI_REASON_CODE_RISK_CAPITAL_SOURCE = "risk_capital_source";
static const string LIMNI_REASON_CODE_COMPLIANCE_SL_BASIS = "compliance_sl_basis";

// EVENT_TYPE
static const string LIMNI_EVENT_TYPE_DECISION = "decision";
static const string LIMNI_EVENT_TYPE_LIFECYCLE = "lifecycle";
static const string LIMNI_EVENT_TYPE_HEALTH = "health";
static const string LIMNI_EVENT_TYPE_ERROR = "error";

// STATE_KEY
static const string LIMNI_STATE_KEY_BASELINE_EQUITY = "baseline_equity";
static const string LIMNI_STATE_KEY_TRAILING_ACTIVE = "trailing_active";
static const string LIMNI_STATE_KEY_WEEK_START_GMT = "week_start_gmt";
static const string LIMNI_STATE_KEY_REPORT_DATE = "report_date";
static const string LIMNI_STATE_KEY_BASKET_STATE = "basket_state";
static const string LIMNI_STATE_KEY_TRADING_ALLOWED = "trading_allowed";
static const string LIMNI_STATE_KEY_LAST_SYNC_UTC = "last_sync_utc";
static const string LIMNI_STATE_KEY_LAST_API_ERROR = "last_api_error";
static const string LIMNI_STATE_KEY_DATA_SOURCE = "data_source";
static const string LIMNI_STATE_KEY_RECONSTRUCTION_STATUS = "reconstruction_status";
static const string LIMNI_STATE_KEY_RISK_CAPITAL_USD = "risk_capital_usd";
static const string LIMNI_STATE_KEY_POLICY_VERSION = "policy_version";
static const string LIMNI_STATE_KEY_CONTRACT_VERSION = "contract_version";

#endif // __LIMNI_CONTRACT_MQH__
