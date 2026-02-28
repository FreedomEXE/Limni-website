
/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: bitget-v2-backtest.ts
 *
 * Description:
 * Bitget Bot v4 backtest (5 weeks): dual session-window sweeps,
 * handshake entry mode, scaling risk model ablations, and baseline comparison.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DateTime } from "luxon";

import { getPool } from "../src/lib/db";
import { readSnapshotHistory } from "../src/lib/cotStore";
import { derivePairDirectionsByBase } from "../src/lib/cotCompute";
import { PAIRS_BY_ASSET_CLASS } from "../src/lib/cotPairs";
import type { CotSnapshot } from "../src/lib/cotTypes";
import { getAggregatesForWeekStartWithBackfill } from "../src/lib/sentiment/store";
import type { SentimentAggregate } from "../src/lib/sentiment/types";
import { fetchBitgetCandleSeries, fetchBitgetMinuteSeries } from "../src/lib/bitget";
import { getCanonicalWeekOpenUtc } from "../src/lib/weekAnchor";

type SymbolBase = string;
type CoreSymbol = "BTC" | "ETH";
type Direction = "LONG" | "SHORT" | "NEUTRAL";
type Tier = "HIGH" | "MEDIUM" | "NEUTRAL";
type ExitReason = "STOP_LOSS" | "TRAILING_STOP" | "TAKE_PROFIT" | "EOD_CLOSE" | "WEEK_CLOSE" | "BREAKEVEN_STOP";
type Trigger = "RANGE_SWEEP" | "NY_OPEN_BASELINE" | "WEEKLY_BIAS_HOLD";

type EntryMode = "independent" | "handshake";
type RiskModel = "v3_current" | "scaling";
type GateSource = "core_handshake" | "3way_handshake" | "none";

type StrategyKey =
  | "A_handshake_current_risk"
  | "B_independent_scaling_risk"
  | "C_handshake_scaling_risk"
  | "E_handshake_scaling_overnight_funding"
  | "F_handshake_scaling_overnight_oi"
  | "G_handshake_scaling_overnight_funding_oi"
  | "H_handshake_scaling_overnight_funding_reverse"
  | "I_handshake_scaling_overnight_oi_reverse"
  | "J_handshake_scaling_overnight_funding_oi_reverse"
  | "K_3way_handshake_scaling_overnight_alts"
  | "D_v3_baseline_independent_current_risk"
  | "L_weekly_bias_hold_scaling"
  | "daily_ny_open_short";

type SessionWindow =
  | "ASIA_LONDON_RANGE_NY_ENTRY"
  | "US_RANGE_ASIA_LONDON_ENTRY"
  | "NY_OPEN_BASELINE"
  | "WEEKLY_BIAS_HOLD";
type RangeSource = "ASIA+LONDON" | "US" | "NONE";
type EntrySession = "NY" | "ASIA_LONDON" | "WEEKLY";
type SessionGapMode = "baseline" | "extended_ny" | "extended_asia" | "split";

type SessionFilters = {
  mode: SessionGapMode;
  isNySessionCandle: (ts: number) => boolean;
  isAsiaSessionCandle: (ts: number) => boolean;
  isLondonSessionCandle: (ts: number) => boolean;
  isAsiaLondonSessionCandle: (ts: number) => boolean;
  toAsiaRangeDayKey: (ts: number) => string;
  toAsiaLondonEntryDayKey: (ts: number) => string;
};

type Candle = { ts: number; open: number; high: number; low: number; close: number; quoteVolume: number | null };
type DailyRange = { high: number; low: number; locked: boolean };
type FundingPoint = { ts: number; rate: number };
type VariantFilterMode =
  | "none"
  | "funding"
  | "oi"
  | "funding_oi"
  | "funding_reverse"
  | "oi_reverse"
  | "funding_oi_reverse";
type FilterFailReason = "self_fail" | "pair_fail";
type COutcome = "WIN" | "LOSS" | "FLAT" | "MISSING";
type AltEntrySpike = {
  altChangePct4h: number | null;
  btcChangePct4h: number | null;
  relativeSpike: number | null;
  spikeZScore: number | null;
  altAtrPct: number | null;
};

type WeeklyBias = {
  tier: Tier;
  bias: Direction;
  dealer: Direction;
  commercial: Direction;
  sentiment: Direction;
  sentimentSource: "aggregate" | "funding_proxy" | "missing";
  fundingRate: number | null;
  votes: { long: number; short: number; neutral: number };
};

type DaySweepDiagnostics = {
  sweepEvents: number;
  skippedWrongDirection: number;
  skippedNoRejection: number;
  skippedNoDisplacement: number;
  skippedStopTooWide: number;
};

type SignalCandidate = {
  symbol: SymbolBase;
  weekOpenUtc: string;
  dayUtc: string;
  tier: Tier;
  weeklyBias: Direction;
  direction: "LONG" | "SHORT";
  sessionWindow: SessionWindow;
  rangeSource: RangeSource;
  entrySession: EntrySession;
  rangeHigh: number;
  rangeLow: number;
  sweepPrice: number;
  sweepPct: number;
  sweepToEntryBars: number;
  sweepIdx: number;
  confirmIdx: number;
};

type RiskSimulation = {
  exitTs: number;
  exitPrice: number;
  exitReason: ExitReason;
  stopPrice: number;
  stopDistancePct: number;
  atr: number;
  unleveredPnlPct: number;
  rMultiple: number;
  initialLeverage: number;
  pnlLeverage: number;
  maxLeverageReached: number;
  breakevenReached: boolean;
  milestonesHit: number[];
  releaseFractions: Array<{ ts: number; fraction: number }>;
};
type PlannedTrade = {
  strategy: StrategyKey;
  symbol: SymbolBase;
  weekOpenUtc: string;
  dayUtc: string;
  tier: Tier;
  weeklyBias: Direction;
  trigger: Trigger;
  sessionWindow: SessionWindow;
  rangeSource: RangeSource;
  entrySession: EntrySession;
  entryMode: EntryMode;
  riskModel: RiskModel;
  direction: "LONG" | "SHORT";
  entryTs: number;
  entryPrice: number;
  stopPrice: number;
  stopDistancePct: number;
  atr: number;
  sessionRangeHigh: number | null;
  sessionRangeLow: number | null;
  sweepPrice: number | null;
  sweepPct: number | null;
  sweepToEntryBars: number | null;
  exitTs: number;
  exitPrice: number;
  exitReason: ExitReason;
  unleveredPnlPct: number;
  rMultiple: number;
  initialLeverage: number;
  pnlLeverage: number;
  maxLeverageReached: number;
  breakevenReached: boolean;
  milestonesHit: number[];
  releaseFractions: Array<{ ts: number; fraction: number }>;
  allocationPct: number;
  gateSource: GateSource;
  altChangePct4h: number | null;
  btcChangePct4h: number | null;
  relativeSpike: number | null;
  spikeZScore: number | null;
  altAtrPct: number | null;
  handshakePartnerSymbol: SymbolBase | null;
  handshakeDelayMinutes: number | null;
};

type ClosedTrade = {
  id: number;
  strategy: StrategyKey;
  symbol: SymbolBase;
  week_open_utc: string;
  day_utc: string;
  tier: Tier;
  weekly_bias: Direction;
  trigger: Trigger;
  session_window: SessionWindow;
  range_source: RangeSource;
  entry_session: EntrySession;
  entry_mode: EntryMode;
  risk_model: RiskModel;
  direction: "LONG" | "SHORT";
  session_range_high: number | null;
  session_range_low: number | null;
  sweep_price: number | null;
  sweep_pct: number | null;
  sweep_to_entry_bars: number | null;
  gate_source: GateSource;
  alt_change_pct_4h: number | null;
  btc_change_pct_4h: number | null;
  relative_spike: number | null;
  spike_z_score: number | null;
  alt_atr_pct: number | null;
  handshake_partner_symbol: SymbolBase | null;
  handshake_delay_minutes: number | null;
  entry_time_utc: string;
  entry_price: number;
  stop_price: number;
  atr: number;
  stop_distance_pct: number;
  exit_time_utc: string;
  exit_price: number;
  exit_reason: ExitReason;
  unlevered_pnl_pct: number;
  leveraged_pnl_pct: number;
  r_multiple: number;
  initial_leverage: number;
  max_leverage_reached: number;
  breakeven_reached: boolean;
  milestones_hit: number[];
  margin_used_usd: number;
  freed_margin_usd: number;
  pnl_usd: number;
  balance_after_usd: number;
};

type WeekSummary = {
  week_open_utc: string;
  week_label_et: string;
  btc_bias: string;
  eth_bias: string;
  confidence: string;
  entries: number;
  win_loss: string;
  weekly_return_pct: number;
  cumulative_return_pct: number;
};

type StrategyTotals = {
  totalReturnPct: number;
  winRatePct: number;
  avgR: number;
  maxDrawdownPct: number;
  trades: number;
  tradesPerWeek: number;
};

type BacktestOutput = {
  generated_utc: string;
  alt_symbols_source: string;
  alt_symbols_used: string[];
  alt_symbols_by_week: Array<{ week_open_utc: string; source: string; symbols: string[] }>;
  weeks: string[];
  weekly: WeekSummary[];
  trades: ClosedTrade[];
  baseline_comparison: {
    A_handshake_current_risk: StrategyTotals;
    B_independent_scaling_risk: StrategyTotals;
    C_handshake_scaling_risk: StrategyTotals;
    E_handshake_scaling_overnight_funding: StrategyTotals;
    F_handshake_scaling_overnight_oi: StrategyTotals;
    G_handshake_scaling_overnight_funding_oi: StrategyTotals;
    H_handshake_scaling_overnight_funding_reverse: StrategyTotals;
    I_handshake_scaling_overnight_oi_reverse: StrategyTotals;
    J_handshake_scaling_overnight_funding_oi_reverse: StrategyTotals;
    K_3way_handshake_scaling_overnight_alts: StrategyTotals;
    D_v3_baseline_independent_current_risk: StrategyTotals;
    L_weekly_bias_hold_scaling: StrategyTotals;
    daily_ny_open_short: StrategyTotals;
  };
  handshake_diagnostics: {
    triggered: number;
    missed_single: number;
    missed_timing: number;
    trigger_rate_pct: number;
  };
  scaling_milestones: {
    B_independent_scaling_risk: Array<{ milestone: string; times: number; pct_of_trades: number }>;
    C_handshake_scaling_risk: Array<{ milestone: string; times: number; pct_of_trades: number }>;
    E_handshake_scaling_overnight_funding: Array<{ milestone: string; times: number; pct_of_trades: number }>;
    F_handshake_scaling_overnight_oi: Array<{ milestone: string; times: number; pct_of_trades: number }>;
    G_handshake_scaling_overnight_funding_oi: Array<{ milestone: string; times: number; pct_of_trades: number }>;
    H_handshake_scaling_overnight_funding_reverse: Array<{ milestone: string; times: number; pct_of_trades: number }>;
    I_handshake_scaling_overnight_oi_reverse: Array<{ milestone: string; times: number; pct_of_trades: number }>;
    J_handshake_scaling_overnight_funding_oi_reverse: Array<{ milestone: string; times: number; pct_of_trades: number }>;
    K_3way_handshake_scaling_overnight_alts: Array<{ milestone: string; times: number; pct_of_trades: number }>;
    L_weekly_bias_hold_scaling: Array<{ milestone: string; times: number; pct_of_trades: number }>;
  };
  alt_3way_diagnostics: {
    total_core_handshakes: number;
    within_window_by_symbol: Record<SymbolBase, number>;
    missed_window_by_symbol: Record<SymbolBase, number>;
    trigger_rate_by_symbol_pct: Record<SymbolBase, number>;
    missing_or_sparse_weeks: Array<{ week_open_utc: string; symbol: SymbolBase; reason: string }>;
  };
  alt_performance: Array<{
    symbol: SymbolBase;
    signals: number;
    entries: number;
    win_rate_pct: number;
    net_pnl_usd: number;
    avg_unlevered_pnl_pct: number;
  }>;
  alt_session_breakdown: Array<{
    session_window: SessionWindow;
    trades: number;
    win_rate_pct: number;
    total_pnl_usd: number;
    avg_r_multiple: number;
  }>;
  tier1_filter_diagnostics: {
    oi_method: string;
    funding: {
      filtered_count: number;
      removed_wins: number;
      removed_losses: number;
      removed_flats: number;
      rows: Array<{
        symbol: SymbolBase;
        week_open_utc: string;
        day_utc: string;
        session_window: SessionWindow;
        entry_time_utc: string;
        funding_rate: number | null;
        fail_reason: FilterFailReason;
        c_outcome: COutcome;
        c_pnl_usd: number | null;
      }>;
    };
    oi: {
      filtered_count: number;
      removed_wins: number;
      removed_losses: number;
      removed_flats: number;
      rows: Array<{
        symbol: SymbolBase;
        week_open_utc: string;
        day_utc: string;
        session_window: SessionWindow;
        entry_time_utc: string;
        oi_delta_pct: number | null;
        fail_reason: FilterFailReason;
        c_outcome: COutcome;
        c_pnl_usd: number | null;
      }>;
    };
    both: {
      filtered_count: number;
      removed_wins: number;
      removed_losses: number;
      removed_flats: number;
      rows: Array<{
        symbol: SymbolBase;
        week_open_utc: string;
        day_utc: string;
        session_window: SessionWindow;
        entry_time_utc: string;
        funding_rate: number | null;
        oi_delta_pct: number | null;
        fail_reason: FilterFailReason;
        c_outcome: COutcome;
        c_pnl_usd: number | null;
      }>;
    };
    funding_reverse: {
      filtered_count: number;
      removed_wins: number;
      removed_losses: number;
      removed_flats: number;
      rows: Array<{
        symbol: SymbolBase;
        week_open_utc: string;
        day_utc: string;
        session_window: SessionWindow;
        entry_time_utc: string;
        funding_rate: number | null;
        fail_reason: FilterFailReason;
        c_outcome: COutcome;
        c_pnl_usd: number | null;
      }>;
    };
    oi_reverse: {
      filtered_count: number;
      removed_wins: number;
      removed_losses: number;
      removed_flats: number;
      rows: Array<{
        symbol: SymbolBase;
        week_open_utc: string;
        day_utc: string;
        session_window: SessionWindow;
        entry_time_utc: string;
        oi_delta_pct: number | null;
        fail_reason: FilterFailReason;
        c_outcome: COutcome;
        c_pnl_usd: number | null;
      }>;
    };
    both_reverse: {
      filtered_count: number;
      removed_wins: number;
      removed_losses: number;
      removed_flats: number;
      rows: Array<{
        symbol: SymbolBase;
        week_open_utc: string;
        day_utc: string;
        session_window: SessionWindow;
        entry_time_utc: string;
        funding_rate: number | null;
        oi_delta_pct: number | null;
        fail_reason: FilterFailReason;
        c_outcome: COutcome;
        c_pnl_usd: number | null;
      }>;
    };
  };
  metrics_primary: {
    strategy: StrategyKey;
    total_return_pct: number;
    win_rate_pct: number;
    avg_r_multiple: number;
    max_drawdown_pct: number;
    avg_trades_per_week: number;
  };
  day_of_week_breakdown: Array<{ day: string; trades: number; win_rate_pct: number; total_pnl_usd: number; avg_r_multiple: number }>;
  data_coverage: {
    sentiment_missing_weeks: Array<{ week_open_utc: string; symbol: SymbolBase; used_funding_proxy: boolean; funding_rate_used: number | null }>;
    candle_fetch: Array<{ week_open_utc: string; symbol: SymbolBase; m1_rows_existing: number; h1_rows_existing: number; m5_rows_backtest: number; error: string | null }>;
  };
  recommendations: string[];
};

type VariantConfig = {
  key: Exclude<StrategyKey, "daily_ny_open_short">;
  label: string;
  entryMode: EntryMode;
  riskModel: RiskModel;
  scalingHoldOvernight?: boolean;
  filterMode?: VariantFilterMode;
};

const CORE_SYMBOLS: CoreSymbol[] = ["BTC", "ETH"];
const FALLBACK_ALT_SYMBOLS: SymbolBase[] = ["SOL", "DOGE", "XRP", "LINK", "AVAX", "ADA", "ARB"];
let ALT_SYMBOLS: SymbolBase[] = [...FALLBACK_ALT_SYMBOLS];
let ALL_SYMBOLS: SymbolBase[] = [...CORE_SYMBOLS, ...ALT_SYMBOLS];
const SYMBOLS: CoreSymbol[] = CORE_SYMBOLS;
const WEEKS_TO_BACKTEST = 5;
const STARTING_BALANCE_USD = 1000;
const MAX_ENTRIES_PER_SYMBOL_PER_WEEK = 5;
const SWEEP_MIN_PCT = 0.1;
const NEUTRAL_SWEEP_MIN_PCT = 0.3;
const DISPLACEMENT_BODY_MIN_PCT = 0.1;

const STOP_BUFFER_PCT = 0.15;
const ATR_MULTIPLIER = 1.5;
const MAX_STOP_DISTANCE_PCT = 1.5;
const TRAIL_ACTIVATE_PCT = 3;
const TRAIL_OFFSET_PCT = 2;

const SCALING_INITIAL_LEVERAGE = Number(process.env.BACKTEST_SCALING_INITIAL_LEVERAGE ?? "5");
const SCALING_INITIAL_STOP_PCT = 10;
const SCALING_MILESTONES = [1, 2, 3, 4] as const;
const SCALING_LEVERAGE_BY_MILESTONE: Record<(typeof SCALING_MILESTONES)[number], number> = {
  1: 10,
  2: 25,
  3: 50,
  4: 75,
};
const SCALING_RELEASE_FRACTION: Record<(typeof SCALING_MILESTONES)[number], number> = {
  1: 0.5,
  2: 0.3,
  3: 0.1,
  4: 1 / 30,
};

const BASELINE_STOP_PCT = 1.5;
const BASELINE_TP_PCT = 3;

const LEVERAGE_BY_TIER: Record<Tier, number> = { HIGH: 25, MEDIUM: 15, NEUTRAL: 10 };
const ALLOCATION_BY_TIER: Record<Tier, number> = { HIGH: 0.48, MEDIUM: 0.3, NEUTRAL: 0.2 };

const FUNDING_EXTREME_THRESHOLD = 0.0001;
const BITGET_BASE_URL = "https://api.bitget.com";
const BITGET_PRODUCT_TYPE = process.env.BITGET_PRODUCT_TYPE ?? "USDT-FUTURES";

const HANDSHAKE_MAX_DELAY_MINUTES = 60;
const HANDSHAKE_MAX_DELAY_MS = HANDSHAKE_MAX_DELAY_MINUTES * 60_000;
const ALT_HANDSHAKE_WINDOW_MIN = 60;
const ALT_HANDSHAKE_WINDOW_MS = ALT_HANDSHAKE_WINDOW_MIN * 60_000;
const ALT_ALLOCATION_PCT = 0.1;
const MAX_ALT_POSITIONS = 3;
const ALT_FETCH_DELAY_MS = 500;
const MIN_ALT_M5_ROWS_PER_WEEK = 1000;
const FUNDING_NEUTRAL_BAND = 0.00005; // 0.005%
const OI_PROXY_LOOKBACK_BARS = 48; // 4h on M5
const OI_PROXY_CONFIRM_PCT = 2;
const OI_PROXY_REJECT_PCT = -2;

const VARIANT_CONFIGS: VariantConfig[] = [
  {
    key: "A_handshake_current_risk",
    label: "A) Handshake + Current Risk",
    entryMode: "handshake",
    riskModel: "v3_current",
  },
  {
    key: "B_independent_scaling_risk",
    label: "B) Independent + Scaling Risk",
    entryMode: "independent",
    riskModel: "scaling",
  },
  {
    key: "C_handshake_scaling_risk",
    label: "C) Handshake + Scaling + Overnight Hold",
    entryMode: "handshake",
    riskModel: "scaling",
    scalingHoldOvernight: true,
    filterMode: "none",
  },
  {
    key: "E_handshake_scaling_overnight_funding",
    label: "E) Handshake + Scaling + Overnight + Funding Filter",
    entryMode: "handshake",
    riskModel: "scaling",
    scalingHoldOvernight: true,
    filterMode: "funding",
  },
  {
    key: "F_handshake_scaling_overnight_oi",
    label: "F) Handshake + Scaling + Overnight + OI Delta Filter",
    entryMode: "handshake",
    riskModel: "scaling",
    scalingHoldOvernight: true,
    filterMode: "oi",
  },
  {
    key: "G_handshake_scaling_overnight_funding_oi",
    label: "G) Handshake + Scaling + Overnight + Funding + OI",
    entryMode: "handshake",
    riskModel: "scaling",
    scalingHoldOvernight: true,
    filterMode: "funding_oi",
  },
  {
    key: "H_handshake_scaling_overnight_funding_reverse",
    label: "H) Handshake + Scaling + Overnight + Funding Reverse",
    entryMode: "handshake",
    riskModel: "scaling",
    scalingHoldOvernight: true,
    filterMode: "funding_reverse",
  },
  {
    key: "I_handshake_scaling_overnight_oi_reverse",
    label: "I) Handshake + Scaling + Overnight + OI Reverse",
    entryMode: "handshake",
    riskModel: "scaling",
    scalingHoldOvernight: true,
    filterMode: "oi_reverse",
  },
  {
    key: "J_handshake_scaling_overnight_funding_oi_reverse",
    label: "J) Handshake + Scaling + Overnight + Funding + OI Reverse",
    entryMode: "handshake",
    riskModel: "scaling",
    scalingHoldOvernight: true,
    filterMode: "funding_oi_reverse",
  },
  {
    key: "D_v3_baseline_independent_current_risk",
    label: "D) v3 Baseline (Independent + Current Risk)",
    entryMode: "independent",
    riskModel: "v3_current",
  },
];

const ALL_STRATEGY_KEYS: StrategyKey[] = [
  "A_handshake_current_risk",
  "B_independent_scaling_risk",
  "C_handshake_scaling_risk",
  "E_handshake_scaling_overnight_funding",
  "F_handshake_scaling_overnight_oi",
  "G_handshake_scaling_overnight_funding_oi",
  "H_handshake_scaling_overnight_funding_reverse",
  "I_handshake_scaling_overnight_oi_reverse",
  "J_handshake_scaling_overnight_funding_oi_reverse",
  "K_3way_handshake_scaling_overnight_alts",
  "D_v3_baseline_independent_current_risk",
  "L_weekly_bias_hold_scaling",
  "daily_ny_open_short",
];

function round(value: number, digits = 6) { return Number(value.toFixed(digits)); }
function toUtcIso(ts: number) { return DateTime.fromMillis(ts, { zone: "utc" }).toISO() ?? new Date(ts).toISOString(); }
function getUtcHour(ts: number) { return DateTime.fromMillis(ts, { zone: "utc" }).hour; }
function getUtcDateKey(ts: number) { return DateTime.fromMillis(ts, { zone: "utc" }).toISODate() ?? ""; }
function shiftUtcDateKey(ts: number, days: number) {
  return DateTime.fromMillis(ts, { zone: "utc" }).plus({ days }).toISODate() ?? getUtcDateKey(ts);
}
function makeSessionFilters(mode: SessionGapMode): SessionFilters {
  const asiaCarryStartHour = mode === "extended_asia"
    ? 21
    : mode === "split"
      ? 23
      : null;
  const isNySessionCandle = (ts: number) => {
    const h = getUtcHour(ts);
    if (mode === "extended_ny") return h >= 13;
    if (mode === "split") return h >= 13 && h < 23;
    return h >= 13 && h < 21;
  };
  const isAsiaSessionCandle = (ts: number) => {
    const h = getUtcHour(ts);
    if (mode === "extended_asia") return h >= 21 || h < 8;
    if (mode === "split") return h >= 23 || h < 8;
    return h >= 0 && h < 8;
  };
  const isLondonSessionCandle = (ts: number) => {
    const h = getUtcHour(ts);
    return h >= 8 && h < 13;
  };
  const isAsiaLondonSessionCandle = (ts: number) => {
    const h = getUtcHour(ts);
    if (mode === "extended_asia") return h >= 21 || h < 13;
    if (mode === "split") return h >= 23 || h < 13;
    return h >= 0 && h < 13;
  };
  const toAsiaRangeDayKey = (ts: number) => {
    if (asiaCarryStartHour === null) return getUtcDateKey(ts);
    const h = getUtcHour(ts);
    return h >= asiaCarryStartHour ? shiftUtcDateKey(ts, 1) : getUtcDateKey(ts);
  };
  const toAsiaLondonEntryDayKey = (ts: number) => {
    if (asiaCarryStartHour === null) return getUtcDateKey(ts);
    const h = getUtcHour(ts);
    return h >= asiaCarryStartHour ? shiftUtcDateKey(ts, 1) : getUtcDateKey(ts);
  };
  return {
    mode,
    isNySessionCandle,
    isAsiaSessionCandle,
    isLondonSessionCandle,
    isAsiaLondonSessionCandle,
    toAsiaRangeDayKey,
    toAsiaLondonEntryDayKey,
  };
}
const BASELINE_SESSION_FILTERS = makeSessionFilters("baseline");
function isNySessionCandle(ts: number) { return BASELINE_SESSION_FILTERS.isNySessionCandle(ts); }
function isAsiaSessionCandle(ts: number) { return BASELINE_SESSION_FILTERS.isAsiaSessionCandle(ts); }
function isLondonSessionCandle(ts: number) { return BASELINE_SESSION_FILTERS.isLondonSessionCandle(ts); }
function isAsiaLondonSessionCandle(ts: number) { return BASELINE_SESSION_FILTERS.isAsiaLondonSessionCandle(ts); }
function isSundayUtc(day: string) { const dt = DateTime.fromISO(day, { zone: "utc" }); return dt.isValid && dt.weekday === 7; }
function weekdayName(day: string) { const dt = DateTime.fromISO(day, { zone: "utc" }); return dt.isValid ? dt.toFormat("cccc") : day; }
function previousUtcDateKey(day: string) {
  const dt = DateTime.fromISO(day, { zone: "utc" });
  return dt.isValid ? dt.minus({ days: 1 }).toISODate() ?? "" : "";
}
function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
function makeSymbolCounter(): Record<SymbolBase, number> {
  return Object.fromEntries(ALL_SYMBOLS.map((symbol) => [symbol, 0])) as Record<SymbolBase, number>;
}
function loadAltSymbolsFromScreener(weekOpens: string[]): {
  defaultSymbols: SymbolBase[];
  allSymbols: SymbolBase[];
  source: string;
  byWeek: Map<string, SymbolBase[]>;
} {
  const fallback = [...FALLBACK_ALT_SYMBOLS];
  const rankingPath = path.join(process.cwd(), "docs", "bots", "alt-pair-rankings.json");
  const weekSet = new Set(weekOpens);
  const byWeek = new Map<string, SymbolBase[]>();
  const sanitize = (rawList: unknown[]) => {
    const normalized = rawList
      .map((raw) => String(raw).trim().toUpperCase())
      .filter((raw) => raw && raw !== "BTC" && raw !== "ETH" && raw !== "MATIC");
    return Array.from(new Set(normalized));
  };

  try {
    const parsed = JSON.parse(readFileSync(rankingPath, "utf8")) as {
      recommendedSymbols?: unknown;
      pairScores?: Array<{ baseCoin?: unknown; tier?: unknown }>;
      weeklyRecommendations?: Array<{ weekOpenUtc?: unknown; recommendedSymbols?: unknown }>;
    };

    for (const row of parsed.weeklyRecommendations ?? []) {
      const weekOpenUtc = String(row.weekOpenUtc ?? "");
      if (!weekSet.has(weekOpenUtc)) continue;
      const recommendedRaw = Array.isArray(row.recommendedSymbols) ? row.recommendedSymbols : [];
      const symbols = sanitize(recommendedRaw);
      if (symbols.length) byWeek.set(weekOpenUtc, symbols);
    }

    const recommended = Array.isArray(parsed.recommendedSymbols)
      ? parsed.recommendedSymbols
      : [];
    const direct = sanitize(recommended);
    if (direct.length) {
      const allSymbols = Array.from(new Set([...direct, ...Array.from(byWeek.values()).flat()]));
      const source = byWeek.size
        ? "docs/bots/alt-pair-rankings.json (recommendedSymbols + weeklyRecommendations)"
        : "docs/bots/alt-pair-rankings.json (recommendedSymbols)";
      return { defaultSymbols: direct, allSymbols, source, byWeek };
    }

    const fromPairs = (parsed.pairScores ?? [])
      .filter((row) => row?.tier === "A" || row?.tier === "B")
      .map((row) => String(row.baseCoin ?? "").trim().toUpperCase())
      .filter((raw) => raw && raw !== "BTC" && raw !== "ETH" && raw !== "MATIC");
    if (fromPairs.length) {
      const defaultSymbols = Array.from(new Set(fromPairs));
      const allSymbols = Array.from(new Set([...defaultSymbols, ...Array.from(byWeek.values()).flat()]));
      const source = byWeek.size
        ? "docs/bots/alt-pair-rankings.json (tier A/B + weeklyRecommendations)"
        : "docs/bots/alt-pair-rankings.json (tier A/B)";
      return { defaultSymbols, allSymbols, source, byWeek };
    }

    if (byWeek.size) {
      const firstWeekList = byWeek.get(weekOpens[0] ?? "") ?? fallback;
      const allSymbols = Array.from(new Set([...firstWeekList, ...Array.from(byWeek.values()).flat()]));
      return {
        defaultSymbols: firstWeekList.length ? firstWeekList : fallback,
        allSymbols,
        source: "docs/bots/alt-pair-rankings.json (weeklyRecommendations only)",
        byWeek,
      };
    }
  } catch {
    // Fall back when screener output is unavailable.
  }
  return { defaultSymbols: fallback, allSymbols: fallback, source: "fallback list", byWeek };
}

function pctMove(entry: number, exit: number, direction: "LONG" | "SHORT") {
  if (!(entry > 0) || !Number.isFinite(exit)) return 0;
  const raw = ((exit - entry) / entry) * 100;
  return direction === "LONG" ? raw : -raw;
}

function loadEnvFromFile() {
  for (const filename of [".env.local", ".env"]) {
    try {
      const text = readFileSync(path.join(process.cwd(), filename), "utf8");
      for (const rawLine of text.split(/\r?\n/)) {
        const line = rawLine.trim();
        if (!line || line.startsWith("#")) continue;
        const eq = line.indexOf("=");
        if (eq <= 0) continue;
        const key = line.slice(0, eq).trim();
        if (!key || process.env[key]) continue;
        let value = line.slice(eq + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
        process.env[key] = value;
      }
    } catch {
      // ignore
    }
  }
}
function getLastCompletedWeekOpens(count: number) {
  const currentWeekOpen = DateTime.fromISO(getCanonicalWeekOpenUtc(), { zone: "utc" });
  if (!currentWeekOpen.isValid) throw new Error("Failed to resolve canonical week anchor.");
  const out: string[] = [];
  for (let i = count; i >= 1; i -= 1) out.push(currentWeekOpen.minus({ weeks: i }).toUTC().toISO() ?? "");
  return out.filter(Boolean);
}

function selectCotSnapshotForWeek(history: CotSnapshot[], weekOpenUtc: string) {
  const weekDate = weekOpenUtc.slice(0, 10);
  const sorted = [...history].sort((a, b) => b.report_date.localeCompare(a.report_date));
  return sorted.find((snap) => snap.report_date <= weekDate) ?? sorted.at(-1) ?? null;
}

function directionFromSentimentAggregate(agg?: SentimentAggregate): Direction {
  if (!agg) return "NEUTRAL";
  if (agg.flip_state === "FLIPPED_UP") return "LONG";
  if (agg.flip_state === "FLIPPED_DOWN") return "SHORT";
  if (agg.flip_state === "FLIPPED_NEUTRAL") return "NEUTRAL";
  if (agg.crowding_state === "CROWDED_LONG") return "SHORT";
  if (agg.crowding_state === "CROWDED_SHORT") return "LONG";
  return "NEUTRAL";
}

function classifyTier(dealer: Direction, commercial: Direction, sentiment: Direction) {
  const dirs = [dealer, commercial, sentiment];
  const long = dirs.filter((d) => d === "LONG").length;
  const short = dirs.filter((d) => d === "SHORT").length;
  const neutral = dirs.length - long - short;
  if (long === 3) return { tier: "HIGH" as Tier, bias: "LONG" as Direction, votes: { long, short, neutral } };
  if (short === 3) return { tier: "HIGH" as Tier, bias: "SHORT" as Direction, votes: { long, short, neutral } };
  if (long >= 2) return { tier: "MEDIUM" as Tier, bias: "LONG" as Direction, votes: { long, short, neutral } };
  if (short >= 2) return { tier: "MEDIUM" as Tier, bias: "SHORT" as Direction, votes: { long, short, neutral } };
  return { tier: "NEUTRAL" as Tier, bias: "NEUTRAL" as Direction, votes: { long, short, neutral } };
}

async function fetchFundingHistory(symbol: SymbolBase): Promise<FundingPoint[]> {
  const out: FundingPoint[] = [];
  const seen = new Set<number>();
  for (let pageNo = 1; pageNo <= 4; pageNo += 1) {
    const url = new URL(`${BITGET_BASE_URL}/api/v2/mix/market/history-fund-rate`);
    url.searchParams.set("symbol", `${symbol}USDT`);
    url.searchParams.set("productType", BITGET_PRODUCT_TYPE);
    url.searchParams.set("pageSize", "200");
    url.searchParams.set("pageNo", String(pageNo));
    const response = await fetch(url.toString(), { cache: "no-store" });
    if (!response.ok) throw new Error(`Funding fetch failed (${response.status}) ${symbol}`);
    const body = (await response.json()) as { code?: string; data?: Array<{ fundingTime?: string; fundingRate?: string }> };
    if (body.code && body.code !== "00000") throw new Error(`Funding API error ${symbol}: ${body.code}`);
    const rows = body.data ?? [];
    for (const row of rows) {
      const ts = Number(row.fundingTime);
      const rate = Number(row.fundingRate);
      if (!Number.isFinite(ts) || !Number.isFinite(rate) || seen.has(ts)) continue;
      seen.add(ts);
      out.push({ ts, rate });
    }
    if (rows.length < 200) break;
  }
  return out.sort((a, b) => a.ts - b.ts);
}

function deriveFundingProxyDirection(history: FundingPoint[], weekOpenUtc: string) {
  if (!history.length) return { direction: "NEUTRAL" as Direction, rate: null as number | null };
  const weekMs = DateTime.fromISO(weekOpenUtc, { zone: "utc" }).toMillis();
  const before = history.filter((r) => r.ts <= weekMs);
  const pick = before.length ? before[before.length - 1] : history[0];
  if (!pick) return { direction: "NEUTRAL" as Direction, rate: null as number | null };
  if (pick.rate > FUNDING_EXTREME_THRESHOLD) return { direction: "SHORT" as Direction, rate: pick.rate };
  if (pick.rate < -FUNDING_EXTREME_THRESHOLD) return { direction: "LONG" as Direction, rate: pick.rate };
  return { direction: "NEUTRAL" as Direction, rate: pick.rate };
}

function getFundingRateAtTs(history: FundingPoint[], ts: number): number | null {
  if (!history.length || !Number.isFinite(ts)) return null;
  let before: FundingPoint | null = null;
  for (const point of history) {
    if (point.ts <= ts) before = point;
    if (point.ts > ts) break;
  }
  if (before) return before.rate;
  return history[0]?.rate ?? null;
}

function findIndexAtOrBeforeTs(candles: Candle[], ts: number): number | null {
  let out: number | null = null;
  for (let i = 0; i < candles.length; i += 1) {
    if (candles[i].ts <= ts) out = i;
    else break;
  }
  return out;
}

function calcLookbackChangePctByIndex(candles: Candle[], index: number, lookbackBars: number): number | null {
  const fromIndex = index - lookbackBars;
  if (fromIndex < 0) return null;
  const from = candles[fromIndex]?.close;
  const to = candles[index]?.close;
  if (!(from && from > 0) || !(to && Number.isFinite(to))) return null;
  return ((to - from) / from) * 100;
}

function calcLookbackChangePctAtTs(candles: Candle[], ts: number, lookbackBars: number): number | null {
  const idx = findIndexAtOrBeforeTs(candles, ts);
  if (idx === null) return null;
  return calcLookbackChangePctByIndex(candles, idx, lookbackBars);
}

function calcAbsLookbackZScore(candles: Candle[], index: number, scopeIndices: number[], lookbackBars: number): number | null {
  const current = calcLookbackChangePctByIndex(candles, index, lookbackBars);
  if (current === null) return null;
  const series: number[] = [];
  for (const idx of scopeIndices) {
    const change = calcLookbackChangePctByIndex(candles, idx, lookbackBars);
    if (change === null) continue;
    series.push(Math.abs(change));
  }
  if (series.length < 10) return null;
  const mean = series.reduce((sum, value) => sum + value, 0) / series.length;
  const variance = series.reduce((sum, value) => sum + (value - mean) ** 2, 0) / series.length;
  const std = Math.sqrt(variance);
  if (!(std > 0)) return 0;
  return (Math.abs(current) - mean) / std;
}

function buildAltEntrySpike(params: {
  altCandles: Candle[];
  altEntryIndex: number;
  altWeekIndices: number[];
  btcCandles: Candle[];
}): AltEntrySpike {
  const { altCandles, altEntryIndex, altWeekIndices, btcCandles } = params;
  const entryTs = altCandles[altEntryIndex]?.ts;
  if (!Number.isFinite(entryTs)) {
    return {
      altChangePct4h: null,
      btcChangePct4h: null,
      relativeSpike: null,
      spikeZScore: null,
      altAtrPct: null,
    };
  }

  const altChangePct4h = calcLookbackChangePctByIndex(altCandles, altEntryIndex, 48);
  const btcChangePct4h = calcLookbackChangePctAtTs(btcCandles, entryTs, 48);
  const relativeSpike = altChangePct4h === null || btcChangePct4h === null || Math.abs(btcChangePct4h) < 1e-9
    ? null
    : Math.abs(altChangePct4h) / Math.abs(btcChangePct4h);
  const spikeZScore = calcAbsLookbackZScore(altCandles, altEntryIndex, altWeekIndices, 48);
  const atr = calcATR(altCandles, 20, altEntryIndex);
  const price = altCandles[altEntryIndex]?.close;
  const altAtrPct = price && price > 0 ? (atr / price) * 100 : null;

  return {
    altChangePct4h,
    btcChangePct4h,
    relativeSpike,
    spikeZScore,
    altAtrPct,
  };
}

// Bitget has no historical OI series in this backtest path, so use a volume-expansion proxy.
// Proxy OI delta = (quoteVolume last 4h - quoteVolume prior 4h) / prior 4h.
function calcOiDeltaProxyPct(candles: Candle[], entryTs: number): number | null {
  const idx = findIndexAtOrBeforeTs(candles, entryTs);
  if (idx === null) return null;
  const recentStart = idx - OI_PROXY_LOOKBACK_BARS + 1;
  const priorStart = recentStart - OI_PROXY_LOOKBACK_BARS;
  const priorEnd = recentStart - 1;
  if (priorStart < 0) return null;

  let recentVol = 0;
  let priorVol = 0;
  for (let i = recentStart; i <= idx; i += 1) recentVol += candles[i].quoteVolume ?? 0;
  for (let i = priorStart; i <= priorEnd; i += 1) priorVol += candles[i].quoteVolume ?? 0;
  if (!(priorVol > 0)) return null;
  return ((recentVol - priorVol) / priorVol) * 100;
}

function passesFundingFilter(direction: "LONG" | "SHORT", fundingRate: number | null) {
  if (fundingRate === null || !Number.isFinite(fundingRate)) return true;
  if (Math.abs(fundingRate) <= FUNDING_NEUTRAL_BAND) return true;
  if (direction === "SHORT") return fundingRate > 0;
  return fundingRate < 0;
}

function passesFundingFilterReverse(direction: "LONG" | "SHORT", fundingRate: number | null) {
  if (fundingRate === null || !Number.isFinite(fundingRate)) return true;
  if (Math.abs(fundingRate) <= FUNDING_NEUTRAL_BAND) return true;
  if (direction === "SHORT") return fundingRate < 0;
  return fundingRate > 0;
}

function passesOiFilter(oiDeltaPct: number | null) {
  if (oiDeltaPct === null || !Number.isFinite(oiDeltaPct)) return true;
  if (oiDeltaPct > OI_PROXY_CONFIRM_PCT) return true;
  if (oiDeltaPct < OI_PROXY_REJECT_PCT) return false;
  return true;
}

function passesOiFilterReverse(oiDeltaPct: number | null) {
  if (oiDeltaPct === null || !Number.isFinite(oiDeltaPct)) return true;
  if (oiDeltaPct < OI_PROXY_REJECT_PCT) return true;
  if (oiDeltaPct > OI_PROXY_CONFIRM_PCT) return false;
  return true;
}

async function fetchRawM1Candles(symbol: SymbolBase, openUtc: DateTime, closeUtc: DateTime): Promise<Candle[]> {
  const out = new Map<number, Candle>();
  let cursor = openUtc.toMillis();
  const closeMs = closeUtc.toMillis();
  const windowMs = 200 * 60_000;

  while (cursor < closeMs) {
    const windowEnd = Math.min(cursor + windowMs, closeMs);
    const url = new URL(`${BITGET_BASE_URL}/api/v2/mix/market/history-candles`);
    url.searchParams.set("symbol", `${symbol}USDT`);
    url.searchParams.set("productType", BITGET_PRODUCT_TYPE);
    url.searchParams.set("granularity", "1m");
    url.searchParams.set("startTime", String(cursor));
    url.searchParams.set("endTime", String(windowEnd));
    url.searchParams.set("limit", "200");
    const response = await fetch(url.toString(), { cache: "no-store" });
    if (!response.ok) throw new Error(`M1 fetch failed (${response.status}) ${symbol}`);
    const body = (await response.json()) as { code?: string; data?: string[][] };
    if (body.code && body.code !== "00000") throw new Error(`M1 API error ${symbol}: ${body.code}`);
    const rows = (body.data ?? [])
      .map((r) => {
        const quote = Number(r[6] ?? r[5]);
        return {
          ts: Number(r[0]),
          open: Number(r[1]),
          high: Number(r[2]),
          low: Number(r[3]),
          close: Number(r[4]),
          quoteVolume: Number.isFinite(quote) ? quote : null,
        };
      })
      .filter((r) => Number.isFinite(r.ts) && Number.isFinite(r.open) && Number.isFinite(r.high) && Number.isFinite(r.low) && Number.isFinite(r.close))
      .filter((r) => r.ts >= cursor && r.ts < windowEnd)
      .sort((a, b) => a.ts - b.ts);
    if (!rows.length) {
      cursor = windowEnd;
      continue;
    }
    for (const row of rows) out.set(row.ts, row);
    cursor = windowEnd;
  }

  return Array.from(out.values()).sort((a, b) => a.ts - b.ts);
}
function aggregateM1ToM5(m1: Candle[]): Candle[] {
  const groups = new Map<number, Candle[]>();
  for (const c of m1) {
    const bucket = Math.floor(c.ts / 300_000) * 300_000;
    if (!groups.has(bucket)) groups.set(bucket, []);
    groups.get(bucket)?.push(c);
  }
  return Array.from(groups.keys()).sort((a, b) => a - b).map((bucket) => {
    const rows = (groups.get(bucket) ?? []).sort((a, b) => a.ts - b.ts);
    return {
      ts: bucket,
      open: rows[0].open,
      high: Math.max(...rows.map((r) => r.high)),
      low: Math.min(...rows.map((r) => r.low)),
      close: rows[rows.length - 1].close,
      quoteVolume: rows.reduce((s, r) => s + (r.quoteVolume ?? 0), 0),
    };
  });
}

function buildDailyRanges(
  candles: Candle[],
  filters: SessionFilters = BASELINE_SESSION_FILTERS,
): Map<string, DailyRange> {
  const dayMap = new Map<string, { asia: Candle[]; london: Candle[] }>();
  for (const candle of candles) {
    const londonDay = getUtcDateKey(candle.ts);
    const asiaDay = filters.toAsiaRangeDayKey(candle.ts);
    if (filters.isAsiaSessionCandle(candle.ts)) {
      if (!dayMap.has(asiaDay)) dayMap.set(asiaDay, { asia: [], london: [] });
      const asiaBucket = dayMap.get(asiaDay);
      if (asiaBucket) asiaBucket.asia.push(candle);
    }
    if (filters.isLondonSessionCandle(candle.ts)) {
      if (!dayMap.has(londonDay)) dayMap.set(londonDay, { asia: [], london: [] });
      const londonBucket = dayMap.get(londonDay);
      if (londonBucket) londonBucket.london.push(candle);
    }
  }
  const ranges = new Map<string, DailyRange>();
  for (const [day, sessions] of dayMap.entries()) {
    if (!sessions.asia.length || !sessions.london.length) continue;
    const asiaHigh = Math.max(...sessions.asia.map((c) => c.high));
    const asiaLow = Math.min(...sessions.asia.map((c) => c.low));
    const londonHigh = Math.max(...sessions.london.map((c) => c.high));
    const londonLow = Math.min(...sessions.london.map((c) => c.low));
    ranges.set(day, { high: Math.max(asiaHigh, londonHigh), low: Math.min(asiaLow, londonLow), locked: true });
  }
  return ranges;
}

function buildUsSessionRanges(
  candles: Candle[],
  filters: SessionFilters = BASELINE_SESSION_FILTERS,
): Map<string, DailyRange> {
  const dayMap = new Map<string, Candle[]>();
  for (const candle of candles) {
    if (!filters.isNySessionCandle(candle.ts)) continue;
    const day = getUtcDateKey(candle.ts);
    if (!dayMap.has(day)) dayMap.set(day, []);
    dayMap.get(day)?.push(candle);
  }
  const ranges = new Map<string, DailyRange>();
  for (const [day, session] of dayMap.entries()) {
    if (!session.length) continue;
    ranges.set(day, {
      high: Math.max(...session.map((c) => c.high)),
      low: Math.min(...session.map((c) => c.low)),
      locked: true,
    });
  }
  return ranges;
}

function calcATR(candles: Candle[], period: number, upToIndex: number) {
  if (upToIndex <= 0) return 0;
  const tr: number[] = [];
  const start = Math.max(1, upToIndex - period + 1);
  for (let i = start; i <= upToIndex; i += 1) {
    const current = candles[i];
    const prev = candles[i - 1];
    if (!current || !prev) continue;
    tr.push(Math.max(current.high - current.low, Math.abs(current.high - prev.close), Math.abs(current.low - prev.close)));
  }
  if (!tr.length) return 0;
  return tr.reduce((s, v) => s + v, 0) / tr.length;
}

function nyCandleIndicesForDay(
  candles: Candle[],
  dayUtc: string,
  filters: SessionFilters = BASELINE_SESSION_FILTERS,
) {
  const idx: number[] = [];
  for (let i = 0; i < candles.length; i += 1) {
    const c = candles[i];
    if (getUtcDateKey(c.ts) !== dayUtc) continue;
    if (!filters.isNySessionCandle(c.ts)) continue;
    idx.push(i);
  }
  return idx;
}

function asiaLondonCandleIndicesForDay(
  candles: Candle[],
  dayUtc: string,
  filters: SessionFilters = BASELINE_SESSION_FILTERS,
) {
  const idx: number[] = [];
  for (let i = 0; i < candles.length; i += 1) {
    const c = candles[i];
    if (filters.toAsiaLondonEntryDayKey(c.ts) !== dayUtc) continue;
    if (!filters.isAsiaLondonSessionCandle(c.ts)) continue;
    idx.push(i);
  }
  return idx;
}

function allowedDirectionsForBias(bias: WeeklyBias) {
  if (bias.tier === "NEUTRAL") return ["LONG", "SHORT"] as Array<"LONG" | "SHORT">;
  if (bias.bias === "LONG") return ["LONG"] as Array<"LONG" | "SHORT">;
  if (bias.bias === "SHORT") return ["SHORT"] as Array<"LONG" | "SHORT">;
  return [] as Array<"LONG" | "SHORT">;
}

function detectSignalForWindow(params: {
  symbol: SymbolBase;
  weekOpenUtc: string;
  dayUtc: string;
  candles: Candle[];
  sessionIndices: number[];
  range: DailyRange;
  bias: WeeklyBias;
  sessionWindow: SessionWindow;
  rangeSource: RangeSource;
  entrySession: EntrySession;
}): { signal: SignalCandidate | null; diagnostics: DaySweepDiagnostics } {
  const { symbol, weekOpenUtc, dayUtc, candles, sessionIndices, range, bias, sessionWindow, rangeSource, entrySession } = params;
  const diagnostics: DaySweepDiagnostics = {
    sweepEvents: 0,
    skippedWrongDirection: 0,
    skippedNoRejection: 0,
    skippedNoDisplacement: 0,
    skippedStopTooWide: 0,
  };
  if (!sessionIndices.length) return { signal: null, diagnostics };

  const allowedDirections = allowedDirectionsForBias(bias);
  if (!allowedDirections.length) return { signal: null, diagnostics };
  const minSweep = bias.tier === "NEUTRAL" ? NEUTRAL_SWEEP_MIN_PCT : SWEEP_MIN_PCT;

  for (let pos = 0; pos < sessionIndices.length; pos += 1) {
    const sweepIdx = sessionIndices[pos];
    const nextIdx = pos + 1 < sessionIndices.length ? sessionIndices[pos + 1] : null;
    const sweepCandle = candles[sweepIdx];

    const upSweepPct = ((sweepCandle.high - range.high) / range.high) * 100;
    const downSweepPct = ((range.low - sweepCandle.low) / range.low) * 100;

    const candidates: Array<{ dir: "LONG" | "SHORT"; sweepPct: number; wick: number }> = [];
    if (upSweepPct >= minSweep) candidates.push({ dir: "SHORT", sweepPct: upSweepPct, wick: sweepCandle.high });
    if (downSweepPct >= minSweep) candidates.push({ dir: "LONG", sweepPct: downSweepPct, wick: sweepCandle.low });

    diagnostics.sweepEvents += candidates.length;
    if (!candidates.length) continue;

    for (const candidate of candidates) {
      if (!allowedDirections.includes(candidate.dir)) {
        diagnostics.skippedWrongDirection += 1;
        continue;
      }

      const confirmChoices: number[] = [sweepIdx];
      if (nextIdx !== null) confirmChoices.push(nextIdx);

      let rejectionIdx: number | null = null;
      for (const ci of confirmChoices) {
        const c = candles[ci];
        if (candidate.dir === "SHORT" && c.close < range.high) {
          rejectionIdx = ci;
          break;
        }
        if (candidate.dir === "LONG" && c.close > range.low) {
          rejectionIdx = ci;
          break;
        }
      }

      if (rejectionIdx === null) {
        diagnostics.skippedNoRejection += 1;
        continue;
      }

      const confirmCandle = candles[rejectionIdx];
      const bodyPct = candidate.dir === "SHORT"
        ? ((confirmCandle.open - confirmCandle.close) / confirmCandle.open) * 100
        : ((confirmCandle.close - confirmCandle.open) / confirmCandle.open) * 100;
      if (bodyPct < DISPLACEMENT_BODY_MIN_PCT) {
        diagnostics.skippedNoDisplacement += 1;
        continue;
      }

      return {
        signal: {
          symbol,
          weekOpenUtc,
          dayUtc,
          tier: bias.tier,
          weeklyBias: bias.bias,
          direction: candidate.dir,
          sessionWindow,
          rangeSource,
          entrySession,
          rangeHigh: range.high,
          rangeLow: range.low,
          sweepPrice: candidate.wick,
          sweepPct: candidate.sweepPct,
          sweepToEntryBars: rejectionIdx - sweepIdx,
          sweepIdx,
          confirmIdx: rejectionIdx,
        },
        diagnostics,
      };
    }
  }

  return { signal: null, diagnostics };
}

function findIndexByTs(candles: Candle[], sessionIndices: number[], ts: number): number | null {
  for (const idx of sessionIndices) {
    if (candles[idx]?.ts === ts) return idx;
  }
  return null;
}
function simulateExitCurrentRisk(
  candles: Candle[],
  sessionIndices: number[],
  entryIndex: number,
  entryPrice: number,
  stopPrice: number,
  direction: "LONG" | "SHORT",
): { exitTs: number; exitPrice: number; exitReason: ExitReason } {
  const entryPos = sessionIndices.findIndex((idx) => idx === entryIndex);
  if (entryPos < 0) {
    const fallback = candles[entryIndex];
    return { exitTs: fallback.ts, exitPrice: fallback.close, exitReason: "EOD_CLOSE" };
  }

  let peakPrice = entryPrice;
  let trailStop: number | null = null;
  const lastIdx = sessionIndices[sessionIndices.length - 1];

  for (let pos = entryPos + 1; pos < sessionIndices.length; pos += 1) {
    const idx = sessionIndices[pos];
    const candle = candles[idx];

    if (direction === "LONG") {
      if (candle.high > peakPrice) peakPrice = candle.high;
      const movePct = pctMove(entryPrice, peakPrice, "LONG");
      if (movePct >= TRAIL_ACTIVATE_PCT) {
        const trailCandidate = peakPrice * (1 - TRAIL_OFFSET_PCT / 100);
        trailStop = trailStop === null ? trailCandidate : Math.max(trailStop, trailCandidate);
      }

      const stopHit = candle.low <= stopPrice;
      const trailHit = trailStop !== null && candle.low <= trailStop;
      if (stopHit || trailHit) {
        const exitPrice = stopHit && trailHit
          ? Math.max(stopPrice, trailStop as number)
          : stopHit
            ? stopPrice
            : (trailStop as number);
        return { exitTs: candle.ts, exitPrice, exitReason: stopHit ? "STOP_LOSS" : "TRAILING_STOP" };
      }
    } else {
      if (candle.low < peakPrice) peakPrice = candle.low;
      const movePct = pctMove(entryPrice, peakPrice, "SHORT");
      if (movePct >= TRAIL_ACTIVATE_PCT) {
        const trailCandidate = peakPrice * (1 + TRAIL_OFFSET_PCT / 100);
        trailStop = trailStop === null ? trailCandidate : Math.min(trailStop, trailCandidate);
      }

      const stopHit = candle.high >= stopPrice;
      const trailHit = trailStop !== null && candle.high >= trailStop;
      if (stopHit || trailHit) {
        const exitPrice = stopHit && trailHit
          ? Math.min(stopPrice, trailStop as number)
          : stopHit
            ? stopPrice
            : (trailStop as number);
        return { exitTs: candle.ts, exitPrice, exitReason: stopHit ? "STOP_LOSS" : "TRAILING_STOP" };
      }
    }
  }

  const eod = candles[lastIdx];
  return { exitTs: eod.ts, exitPrice: eod.close, exitReason: "EOD_CLOSE" };
}

function simulateScalingRisk(
  candles: Candle[],
  exitIndices: number[],
  entryIndex: number,
  entryPrice: number,
  direction: "LONG" | "SHORT",
  noTriggerExitReason: ExitReason = "EOD_CLOSE",
): RiskSimulation {
  const entryPos = exitIndices.findIndex((idx) => idx === entryIndex);
  const initialStop = direction === "LONG"
    ? entryPrice * (1 - SCALING_INITIAL_STOP_PCT / 100)
    : entryPrice * (1 + SCALING_INITIAL_STOP_PCT / 100);

  if (entryPos < 0) {
    const fallback = candles[entryIndex];
    const unlev = pctMove(entryPrice, fallback.close, direction);
    return {
      exitTs: fallback.ts,
      exitPrice: fallback.close,
      exitReason: noTriggerExitReason,
      stopPrice: initialStop,
      stopDistancePct: SCALING_INITIAL_STOP_PCT,
      atr: 0,
      unleveredPnlPct: unlev,
      rMultiple: unlev / SCALING_INITIAL_STOP_PCT,
      initialLeverage: SCALING_INITIAL_LEVERAGE,
      pnlLeverage: SCALING_INITIAL_LEVERAGE,
      maxLeverageReached: SCALING_INITIAL_LEVERAGE,
      breakevenReached: false,
      milestonesHit: [],
      releaseFractions: [],
    };
  }

  let stopPrice = initialStop;
  let maxLev = SCALING_INITIAL_LEVERAGE;
  let breakevenReached = false;
  let trailingOffsetPct: number | null = null;
  let peakFavorable = entryPrice;
  const milestonesHit: number[] = [];
  const releaseFractions: Array<{ ts: number; fraction: number }> = [];

  function favorableMovePct() {
    return direction === "LONG"
      ? ((peakFavorable - entryPrice) / entryPrice) * 100
      : ((entryPrice - peakFavorable) / entryPrice) * 100;
  }

  const lastIdx = exitIndices[exitIndices.length - 1];

  for (let pos = entryPos + 1; pos < exitIndices.length; pos += 1) {
    const idx = exitIndices[pos];
    const candle = candles[idx];

    if (direction === "LONG") {
      if (candle.high > peakFavorable) peakFavorable = candle.high;
    } else {
      if (candle.low < peakFavorable) peakFavorable = candle.low;
    }

    const move = favorableMovePct();

    for (const milestone of SCALING_MILESTONES) {
      if (move < milestone) continue;
      if (milestonesHit.includes(milestone)) continue;
      milestonesHit.push(milestone);
      maxLev = Math.max(maxLev, SCALING_LEVERAGE_BY_MILESTONE[milestone]);
      releaseFractions.push({ ts: candle.ts, fraction: SCALING_RELEASE_FRACTION[milestone] });

      if (milestone >= 2) {
        stopPrice = entryPrice;
        breakevenReached = true;
      }
      if (milestone >= 3) {
        trailingOffsetPct = milestone >= 4 ? 1.0 : 1.5;
      }
    }

    let trailPrice: number | null = null;
    if (trailingOffsetPct !== null) {
      trailPrice = direction === "LONG"
        ? peakFavorable * (1 - trailingOffsetPct / 100)
        : peakFavorable * (1 + trailingOffsetPct / 100);
    }

    if (direction === "LONG") {
      const stopHit = candle.low <= stopPrice;
      const trailHit = trailPrice !== null && candle.low <= trailPrice;
      if (stopHit || trailHit) {
        const exitPrice = stopHit && trailHit
          ? Math.max(stopPrice, trailPrice as number)
          : stopHit
            ? stopPrice
            : (trailPrice as number);
        const exitReason = stopHit
          ? (breakevenReached && Math.abs(stopPrice - entryPrice) / entryPrice < 1e-9 ? "BREAKEVEN_STOP" : "STOP_LOSS")
          : "TRAILING_STOP";
        const unlev = pctMove(entryPrice, exitPrice, direction);
        return {
          exitTs: candle.ts,
          exitPrice,
          exitReason,
          stopPrice: initialStop,
          stopDistancePct: SCALING_INITIAL_STOP_PCT,
          atr: 0,
          unleveredPnlPct: unlev,
          rMultiple: unlev / SCALING_INITIAL_STOP_PCT,
          initialLeverage: SCALING_INITIAL_LEVERAGE,
          pnlLeverage: SCALING_INITIAL_LEVERAGE,
          maxLeverageReached: maxLev,
          breakevenReached,
          milestonesHit: [...milestonesHit].sort((a, b) => a - b),
          releaseFractions,
        };
      }
    } else {
      const stopHit = candle.high >= stopPrice;
      const trailHit = trailPrice !== null && candle.high >= trailPrice;
      if (stopHit || trailHit) {
        const exitPrice = stopHit && trailHit
          ? Math.min(stopPrice, trailPrice as number)
          : stopHit
            ? stopPrice
            : (trailPrice as number);
        const exitReason = stopHit
          ? (breakevenReached && Math.abs(stopPrice - entryPrice) / entryPrice < 1e-9 ? "BREAKEVEN_STOP" : "STOP_LOSS")
          : "TRAILING_STOP";
        const unlev = pctMove(entryPrice, exitPrice, direction);
        return {
          exitTs: candle.ts,
          exitPrice,
          exitReason,
          stopPrice: initialStop,
          stopDistancePct: SCALING_INITIAL_STOP_PCT,
          atr: 0,
          unleveredPnlPct: unlev,
          rMultiple: unlev / SCALING_INITIAL_STOP_PCT,
          initialLeverage: SCALING_INITIAL_LEVERAGE,
          pnlLeverage: SCALING_INITIAL_LEVERAGE,
          maxLeverageReached: maxLev,
          breakevenReached,
          milestonesHit: [...milestonesHit].sort((a, b) => a - b),
          releaseFractions,
        };
      }
    }
  }

  const eodCandle = candles[lastIdx];
  const unlev = pctMove(entryPrice, eodCandle.close, direction);
  return {
    exitTs: eodCandle.ts,
    exitPrice: eodCandle.close,
    exitReason: noTriggerExitReason,
    stopPrice: initialStop,
    stopDistancePct: SCALING_INITIAL_STOP_PCT,
    atr: 0,
    unleveredPnlPct: unlev,
    rMultiple: unlev / SCALING_INITIAL_STOP_PCT,
    initialLeverage: SCALING_INITIAL_LEVERAGE,
    pnlLeverage: SCALING_INITIAL_LEVERAGE,
    maxLeverageReached: maxLev,
    breakevenReached,
    milestonesHit: [...milestonesHit].sort((a, b) => a - b),
    releaseFractions,
  };
}

function planTradeFromSignal(params: {
  strategy: StrategyKey;
  entryMode: EntryMode;
  riskModel: RiskModel;
  signal: SignalCandidate;
  candles: Candle[];
  sessionIndices: number[];
  scalingExitIndices?: number[];
  scalingNoTriggerExitReason?: ExitReason;
  entryTsOverride?: number;
  allocationPctOverride?: number;
  gateSource?: GateSource;
  spikeMeta?: AltEntrySpike | null;
  handshakePartnerSymbol?: SymbolBase | null;
  handshakeDelayMinutes?: number | null;
  diagnostics: DaySweepDiagnostics;
}): PlannedTrade | null {
  const {
    strategy,
    entryMode,
    riskModel,
    signal,
    candles,
    sessionIndices,
    scalingExitIndices,
    scalingNoTriggerExitReason,
    entryTsOverride,
    allocationPctOverride,
    gateSource = "none",
    spikeMeta = null,
    handshakePartnerSymbol = null,
    handshakeDelayMinutes = null,
    diagnostics,
  } = params;

  const entryIdx = entryTsOverride !== undefined
    ? findIndexByTs(candles, sessionIndices, entryTsOverride)
    : signal.confirmIdx;
  if (entryIdx === null || entryIdx < 0) return null;

  const entryCandle = candles[entryIdx];
  const entryPrice = entryCandle.close;
  if (!(entryPrice > 0)) return null;

  let sim: RiskSimulation | null = null;

  if (riskModel === "v3_current") {
    const atr = calcATR(candles, 20, entryIdx);
    const wickStop = signal.direction === "SHORT"
      ? signal.sweepPrice * (1 + STOP_BUFFER_PCT / 100)
      : signal.sweepPrice * (1 - STOP_BUFFER_PCT / 100);
    const atrStop = signal.direction === "SHORT"
      ? entryPrice + ATR_MULTIPLIER * atr
      : entryPrice - ATR_MULTIPLIER * atr;
    const stopPrice = signal.direction === "SHORT" ? Math.max(wickStop, atrStop) : Math.min(wickStop, atrStop);
    const stopDistancePct = (Math.abs(entryPrice - stopPrice) / entryPrice) * 100;
    if (stopDistancePct > MAX_STOP_DISTANCE_PCT) {
      diagnostics.skippedStopTooWide += 1;
      return null;
    }

    const exit = simulateExitCurrentRisk(candles, sessionIndices, entryIdx, entryPrice, stopPrice, signal.direction);
    const unlev = pctMove(entryPrice, exit.exitPrice, signal.direction);
    const baseLev = LEVERAGE_BY_TIER[signal.tier];

    sim = {
      exitTs: exit.exitTs,
      exitPrice: exit.exitPrice,
      exitReason: exit.exitReason,
      stopPrice,
      stopDistancePct,
      atr,
      unleveredPnlPct: unlev,
      rMultiple: stopDistancePct > 0 ? unlev / stopDistancePct : 0,
      initialLeverage: baseLev,
      pnlLeverage: baseLev,
      maxLeverageReached: baseLev,
      breakevenReached: false,
      milestonesHit: [],
      releaseFractions: [],
    };
  } else {
    sim = simulateScalingRisk(
      candles,
      scalingExitIndices ?? sessionIndices,
      entryIdx,
      entryPrice,
      signal.direction,
      scalingNoTriggerExitReason ?? "EOD_CLOSE",
    );
  }

  if (!sim) return null;

  const allocationPct = allocationPctOverride ?? (entryMode === "handshake"
    ? 0.5
    : riskModel === "scaling"
      ? 1.0
      : ALLOCATION_BY_TIER[signal.tier]);

  return {
    strategy,
    symbol: signal.symbol,
    weekOpenUtc: signal.weekOpenUtc,
    dayUtc: signal.dayUtc,
    tier: signal.tier,
    weeklyBias: signal.weeklyBias,
    trigger: "RANGE_SWEEP",
    sessionWindow: signal.sessionWindow,
    rangeSource: signal.rangeSource,
    entrySession: signal.entrySession,
    entryMode,
    riskModel,
    direction: signal.direction,
    entryTs: entryCandle.ts,
    entryPrice,
    stopPrice: sim.stopPrice,
    stopDistancePct: sim.stopDistancePct,
    atr: sim.atr,
    sessionRangeHigh: signal.rangeHigh,
    sessionRangeLow: signal.rangeLow,
    sweepPrice: signal.sweepPrice,
    sweepPct: signal.sweepPct,
    sweepToEntryBars: signal.sweepToEntryBars,
    exitTs: sim.exitTs,
    exitPrice: sim.exitPrice,
    exitReason: sim.exitReason,
    unleveredPnlPct: sim.unleveredPnlPct,
    rMultiple: sim.rMultiple,
    initialLeverage: sim.initialLeverage,
    pnlLeverage: sim.pnlLeverage,
    maxLeverageReached: sim.maxLeverageReached,
    breakevenReached: sim.breakevenReached,
    milestonesHit: sim.milestonesHit,
    releaseFractions: sim.releaseFractions,
    allocationPct,
    gateSource,
    altChangePct4h: spikeMeta?.altChangePct4h ?? null,
    btcChangePct4h: spikeMeta?.btcChangePct4h ?? null,
    relativeSpike: spikeMeta?.relativeSpike ?? null,
    spikeZScore: spikeMeta?.spikeZScore ?? null,
    altAtrPct: spikeMeta?.altAtrPct ?? null,
    handshakePartnerSymbol,
    handshakeDelayMinutes,
  };
}
function planBaselineTradeForDay(params: {
  symbol: SymbolBase;
  weekOpenUtc: string;
  dayUtc: string;
  candles: Candle[];
  nyIndices: number[];
  bias: WeeklyBias;
}): PlannedTrade | null {
  const { symbol, weekOpenUtc, dayUtc, candles, nyIndices, bias } = params;
  if (!nyIndices.length || bias.bias !== "SHORT") return null;

  const entryIdx = nyIndices[0];
  const entryCandle = candles[entryIdx];
  const entryPrice = entryCandle.open;
  if (!(entryPrice > 0)) return null;

  const stopPrice = entryPrice * (1 + BASELINE_STOP_PCT / 100);
  const takeProfit = entryPrice * (1 - BASELINE_TP_PCT / 100);

  let exitTs = entryCandle.ts;
  let exitPrice = entryPrice;
  let exitReason: ExitReason = "EOD_CLOSE";

  for (let pos = 0; pos < nyIndices.length; pos += 1) {
    const idx = nyIndices[pos];
    const candle = candles[idx];
    const stopHit = candle.high >= stopPrice;
    const tpHit = candle.low <= takeProfit;
    if (stopHit || tpHit) {
      if (stopHit) {
        exitTs = candle.ts;
        exitPrice = stopPrice;
        exitReason = "STOP_LOSS";
      } else {
        exitTs = candle.ts;
        exitPrice = takeProfit;
        exitReason = "TAKE_PROFIT";
      }
      break;
    }
    if (pos === nyIndices.length - 1) {
      exitTs = candle.ts;
      exitPrice = candle.close;
      exitReason = "EOD_CLOSE";
    }
  }

  const unleveredPnlPct = pctMove(entryPrice, exitPrice, "SHORT");
  const leverage = LEVERAGE_BY_TIER[bias.tier];

  return {
    strategy: "daily_ny_open_short",
    symbol,
    weekOpenUtc,
    dayUtc,
    tier: bias.tier,
    weeklyBias: bias.bias,
    trigger: "NY_OPEN_BASELINE",
    sessionWindow: "NY_OPEN_BASELINE",
    rangeSource: "NONE",
    entrySession: "NY",
    entryMode: "independent",
    riskModel: "v3_current",
    direction: "SHORT",
    entryTs: entryCandle.ts,
    entryPrice,
    stopPrice,
    stopDistancePct: BASELINE_STOP_PCT,
    atr: 0,
    sessionRangeHigh: null,
    sessionRangeLow: null,
    sweepPrice: null,
    sweepPct: null,
    sweepToEntryBars: null,
    exitTs,
    exitPrice,
    exitReason,
    unleveredPnlPct,
    rMultiple: BASELINE_STOP_PCT > 0 ? unleveredPnlPct / BASELINE_STOP_PCT : 0,
    initialLeverage: leverage,
    pnlLeverage: leverage,
    maxLeverageReached: leverage,
    breakevenReached: false,
    milestonesHit: [],
    releaseFractions: [],
    allocationPct: ALLOCATION_BY_TIER[bias.tier],
    gateSource: "none",
    altChangePct4h: null,
    btcChangePct4h: null,
    relativeSpike: null,
    spikeZScore: null,
    altAtrPct: null,
    handshakePartnerSymbol: null,
    handshakeDelayMinutes: null,
  };
}

function planWeeklyBiasHoldTrade(params: {
  symbol: SymbolBase;
  weekOpenUtc: string;
  candles: Candle[];
  weekIndices: number[];
  bias: WeeklyBias;
}): PlannedTrade | null {
  const { symbol, weekOpenUtc, candles, weekIndices, bias } = params;
  if (bias.bias === "NEUTRAL" || !weekIndices.length) return null;

  const entryIdx = weekIndices[0];
  const entryCandle = candles[entryIdx];
  const entryPrice = entryCandle.open;
  if (!(entryPrice > 0)) return null;

  const direction = bias.bias as "LONG" | "SHORT";
  const sim = simulateScalingRisk(candles, weekIndices, entryIdx, entryPrice, direction, "WEEK_CLOSE");

  return {
    strategy: "L_weekly_bias_hold_scaling",
    symbol,
    weekOpenUtc,
    dayUtc: getUtcDateKey(entryCandle.ts),
    tier: bias.tier,
    weeklyBias: bias.bias,
    trigger: "WEEKLY_BIAS_HOLD",
    sessionWindow: "WEEKLY_BIAS_HOLD",
    rangeSource: "NONE",
    entrySession: "WEEKLY",
    entryMode: "independent",
    riskModel: "scaling",
    direction,
    entryTs: entryCandle.ts,
    entryPrice,
    stopPrice: sim.stopPrice,
    stopDistancePct: sim.stopDistancePct,
    atr: sim.atr,
    sessionRangeHigh: null,
    sessionRangeLow: null,
    sweepPrice: null,
    sweepPct: null,
    sweepToEntryBars: null,
    exitTs: sim.exitTs,
    exitPrice: sim.exitPrice,
    exitReason: sim.exitReason,
    unleveredPnlPct: sim.unleveredPnlPct,
    rMultiple: sim.rMultiple,
    initialLeverage: sim.initialLeverage,
    pnlLeverage: sim.pnlLeverage,
    maxLeverageReached: sim.maxLeverageReached,
    breakevenReached: sim.breakevenReached,
    milestonesHit: sim.milestonesHit,
    releaseFractions: sim.releaseFractions,
    allocationPct: ALLOCATION_BY_TIER[bias.tier],
    gateSource: "none",
    altChangePct4h: null,
    btcChangePct4h: null,
    relativeSpike: null,
    spikeZScore: null,
    altAtrPct: null,
    handshakePartnerSymbol: null,
    handshakeDelayMinutes: null,
  };
}

function executePlannedTrades(
  plans: PlannedTrade[],
  startingBalance: number,
  startTradeId: number,
): { endingBalance: number; nextTradeId: number; closed: ClosedTrade[]; skippedNoBalance: number } {
  type OpenPos = {
    plan: PlannedTrade;
    initialMargin: number;
    reservedMargin: number;
    freedMargin: number;
    pendingReleases: Array<{ ts: number; amount: number }>;
    pnlUsd: number;
  };

  const sorted = [...plans].sort((a, b) => a.entryTs - b.entryTs);
  const open: OpenPos[] = [];
  const closed: ClosedTrade[] = [];
  let balance = startingBalance;
  let tradeId = startTradeId;
  let skippedNoBalance = 0;

  function applyReleases(cutoffTs: number) {
    for (const pos of open) {
      const due = pos.pendingReleases.filter((r) => r.ts <= cutoffTs);
      if (!due.length) continue;
      for (const rel of due) {
        pos.reservedMargin = Math.max(0, pos.reservedMargin - rel.amount);
        pos.freedMargin += rel.amount;
      }
      pos.pendingReleases = pos.pendingReleases.filter((r) => r.ts > cutoffTs);
    }
  }

  function closeMatured(cutoffTs: number) {
    applyReleases(cutoffTs);
    const matured = open.filter((p) => p.plan.exitTs <= cutoffTs).sort((a, b) => a.plan.exitTs - b.plan.exitTs);
    for (const pos of matured) {
      tradeId += 1;
      balance += pos.pnlUsd;
      const levPct = pos.initialMargin > 0 ? (pos.pnlUsd / pos.initialMargin) * 100 : 0;
      closed.push({
        id: tradeId,
        strategy: pos.plan.strategy,
        symbol: pos.plan.symbol,
        week_open_utc: pos.plan.weekOpenUtc,
        day_utc: pos.plan.dayUtc,
        tier: pos.plan.tier,
        weekly_bias: pos.plan.weeklyBias,
        trigger: pos.plan.trigger,
        session_window: pos.plan.sessionWindow,
        range_source: pos.plan.rangeSource,
        entry_session: pos.plan.entrySession,
        entry_mode: pos.plan.entryMode,
        risk_model: pos.plan.riskModel,
        direction: pos.plan.direction,
        session_range_high: pos.plan.sessionRangeHigh,
        session_range_low: pos.plan.sessionRangeLow,
        sweep_price: pos.plan.sweepPrice,
        sweep_pct: pos.plan.sweepPct,
        sweep_to_entry_bars: pos.plan.sweepToEntryBars,
        gate_source: pos.plan.gateSource,
        alt_change_pct_4h: pos.plan.altChangePct4h,
        btc_change_pct_4h: pos.plan.btcChangePct4h,
        relative_spike: pos.plan.relativeSpike,
        spike_z_score: pos.plan.spikeZScore,
        alt_atr_pct: pos.plan.altAtrPct,
        handshake_partner_symbol: pos.plan.handshakePartnerSymbol,
        handshake_delay_minutes: pos.plan.handshakeDelayMinutes,
        entry_time_utc: toUtcIso(pos.plan.entryTs),
        entry_price: round(pos.plan.entryPrice),
        stop_price: round(pos.plan.stopPrice),
        atr: round(pos.plan.atr),
        stop_distance_pct: round(pos.plan.stopDistancePct),
        exit_time_utc: toUtcIso(pos.plan.exitTs),
        exit_price: round(pos.plan.exitPrice),
        exit_reason: pos.plan.exitReason,
        unlevered_pnl_pct: round(pos.plan.unleveredPnlPct),
        leveraged_pnl_pct: round(levPct),
        r_multiple: round(pos.plan.rMultiple),
        initial_leverage: pos.plan.initialLeverage,
        max_leverage_reached: pos.plan.maxLeverageReached,
        breakeven_reached: pos.plan.breakevenReached,
        milestones_hit: pos.plan.milestonesHit,
        margin_used_usd: round(pos.initialMargin),
        freed_margin_usd: round(pos.freedMargin),
        pnl_usd: round(pos.pnlUsd),
        balance_after_usd: round(balance),
      });
    }
    const maturedSet = new Set(matured);
    const openLeft = open.filter((p) => !maturedSet.has(p));
    open.length = 0;
    open.push(...openLeft);
  }

  for (const plan of sorted) {
    closeMatured(plan.entryTs);
    const reserved = open.reduce((s, p) => s + p.reservedMargin, 0);
    const available = Math.max(0, balance - reserved);
    const initialMargin = available * plan.allocationPct;
    if (!(initialMargin > 0)) {
      skippedNoBalance += 1;
      continue;
    }

    const releaseEvents = plan.releaseFractions.map((r) => ({ ts: r.ts, amount: initialMargin * r.fraction }));
    const levPct = plan.unleveredPnlPct * plan.pnlLeverage;
    const rawPnl = initialMargin * (levPct / 100);
    const pnlUsd = Math.max(-initialMargin, rawPnl);

    open.push({
      plan,
      initialMargin,
      reservedMargin: initialMargin,
      freedMargin: 0,
      pendingReleases: releaseEvents,
      pnlUsd,
    });
  }

  closeMatured(Number.POSITIVE_INFINITY);
  return { endingBalance: balance, nextTradeId: tradeId, closed, skippedNoBalance };
}

function computeStrategyTotals(trades: ClosedTrade[], startBalance: number, endBalance: number, maxDrawdownPct: number, weekCount: number): StrategyTotals {
  const wins = trades.filter((t) => t.pnl_usd > 0).length;
  const avgR = trades.length ? trades.reduce((s, t) => s + t.r_multiple, 0) / trades.length : 0;
  return {
    totalReturnPct: startBalance > 0 ? ((endBalance - startBalance) / startBalance) * 100 : 0,
    winRatePct: trades.length ? (wins / trades.length) * 100 : 0,
    avgR,
    maxDrawdownPct,
    trades: trades.length,
    tradesPerWeek: weekCount > 0 ? trades.length / weekCount : 0,
  };
}

function strategyLabel(key: StrategyKey) {
  if (key === "A_handshake_current_risk") return "A) Handshake + Current Risk";
  if (key === "B_independent_scaling_risk") return "B) Independent + Scaling Risk";
  if (key === "C_handshake_scaling_risk") return "C) Handshake + Scaling + Overnight Hold";
  if (key === "E_handshake_scaling_overnight_funding") return "E) Handshake + Scaling + Overnight + Funding Filter";
  if (key === "F_handshake_scaling_overnight_oi") return "F) Handshake + Scaling + Overnight + OI Delta Filter";
  if (key === "G_handshake_scaling_overnight_funding_oi") return "G) Handshake + Scaling + Overnight + Funding + OI";
  if (key === "H_handshake_scaling_overnight_funding_reverse") return "H) Handshake + Scaling + Overnight + Funding Reverse";
  if (key === "I_handshake_scaling_overnight_oi_reverse") return "I) Handshake + Scaling + Overnight + OI Reverse";
  if (key === "J_handshake_scaling_overnight_funding_oi_reverse") return "J) Handshake + Scaling + Overnight + Funding + OI Reverse";
  if (key === "K_3way_handshake_scaling_overnight_alts") return "K) 3-Way Handshake + Scaling + Overnight Hold (Alt Expansion)";
  if (key === "D_v3_baseline_independent_current_risk") return "D) v3 Baseline (Independent + Current Risk)";
  if (key === "L_weekly_bias_hold_scaling") return "L) Weekly Bias Hold (Scaling, No Sweep)";
  return "Daily NY Open Short";
}

function buildCTradeKey(
  weekOpenUtc: string,
  dayUtc: string,
  sessionWindow: SessionWindow,
  symbol: SymbolBase,
  entryTs: number,
) {
  return `${weekOpenUtc}|${dayUtc}|${sessionWindow}|${symbol}|${entryTs}`;
}

function buildMarkdownReport(output: BacktestOutput) {
  const lines: string[] = [];
  lines.push("# Bitget Bot v4 Backtest Results", "", `Generated (UTC): ${output.generated_utc}`);
  lines.push(`Alt Symbol Source: ${output.alt_symbols_source}`);
  lines.push(`Alt Symbols Used: ${output.alt_symbols_used.join(", ") || "none"}`, "");
  lines.push("### Alt Universe By Week", "");
  lines.push("| Week Open UTC | Source | Symbols |");
  lines.push("| --- | --- | --- |");
  for (const row of output.alt_symbols_by_week) {
    lines.push(`| ${row.week_open_utc} | ${row.source} | ${row.symbols.join(", ")} |`);
  }
  lines.push("");

  lines.push("## 1. Week-by-Week Summary", "");
  lines.push("| Week | BTC Bias | ETH Bias | Confidence | Entries | Win/Loss | Weekly Return % | Cumulative % |");
  lines.push("| --- | --- | --- | --- | ---: | ---: | ---: | ---: |");
  for (const row of output.weekly) {
    lines.push(`| ${row.week_label_et} | ${row.btc_bias} | ${row.eth_bias} | ${row.confidence} | ${row.entries} | ${row.win_loss} | ${row.weekly_return_pct.toFixed(2)} | ${row.cumulative_return_pct.toFixed(2)} |`);
  }
  lines.push("");

  lines.push("## 2. Trade Log", "");
  lines.push("| # | Strategy | Symbol | Dir | Day | Window | Gate | Entry Mode | Risk Model | Entry | Stop | Exit | Exit Reason | PnL% | R:R | Init Lev | Max Lev | BE | Milestones | Freed Margin |");
  lines.push("| ---: | --- | --- | --- | --- | --- | --- | --- | --- | ---: | ---: | ---: | --- | ---: | ---: | ---: | ---: | --- | --- | ---: |");
  for (const trade of output.trades) {
    const milestones = trade.milestones_hit.length ? `[${trade.milestones_hit.join(",")}]` : "[]";
    lines.push(`| ${trade.id} | ${strategyLabel(trade.strategy)} | ${trade.symbol} | ${trade.direction} | ${trade.day_utc} | ${trade.session_window} | ${trade.gate_source} | ${trade.entry_mode} | ${trade.risk_model} | ${trade.entry_price.toFixed(2)} | ${trade.stop_price.toFixed(2)} | ${trade.exit_price.toFixed(2)} | ${trade.exit_reason} | ${trade.unlevered_pnl_pct.toFixed(2)} | ${trade.r_multiple.toFixed(2)} | ${trade.initial_leverage}x | ${trade.max_leverage_reached}x | ${trade.breakeven_reached ? "yes" : "no"} | ${milestones} | ${trade.freed_margin_usd.toFixed(2)} |`);
  }
  lines.push("");

  lines.push("## 3. Baseline Comparison", "");
  lines.push("| Strategy | Total Return | Win Rate | Avg R:R | Max DD | Trades | Trades/Week |");
  lines.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: |");
  lines.push(`| A) Handshake + Current Risk | ${output.baseline_comparison.A_handshake_current_risk.totalReturnPct.toFixed(2)}% | ${output.baseline_comparison.A_handshake_current_risk.winRatePct.toFixed(2)}% | ${output.baseline_comparison.A_handshake_current_risk.avgR.toFixed(3)} | ${output.baseline_comparison.A_handshake_current_risk.maxDrawdownPct.toFixed(2)}% | ${output.baseline_comparison.A_handshake_current_risk.trades} | ${output.baseline_comparison.A_handshake_current_risk.tradesPerWeek.toFixed(2)} |`);
  lines.push(`| B) Independent + Scaling Risk | ${output.baseline_comparison.B_independent_scaling_risk.totalReturnPct.toFixed(2)}% | ${output.baseline_comparison.B_independent_scaling_risk.winRatePct.toFixed(2)}% | ${output.baseline_comparison.B_independent_scaling_risk.avgR.toFixed(3)} | ${output.baseline_comparison.B_independent_scaling_risk.maxDrawdownPct.toFixed(2)}% | ${output.baseline_comparison.B_independent_scaling_risk.trades} | ${output.baseline_comparison.B_independent_scaling_risk.tradesPerWeek.toFixed(2)} |`);
  lines.push(`| C) Handshake + Scaling + Overnight Hold | ${output.baseline_comparison.C_handshake_scaling_risk.totalReturnPct.toFixed(2)}% | ${output.baseline_comparison.C_handshake_scaling_risk.winRatePct.toFixed(2)}% | ${output.baseline_comparison.C_handshake_scaling_risk.avgR.toFixed(3)} | ${output.baseline_comparison.C_handshake_scaling_risk.maxDrawdownPct.toFixed(2)}% | ${output.baseline_comparison.C_handshake_scaling_risk.trades} | ${output.baseline_comparison.C_handshake_scaling_risk.tradesPerWeek.toFixed(2)} |`);
  lines.push(`| E) Handshake + Scaling + Overnight + Funding Filter | ${output.baseline_comparison.E_handshake_scaling_overnight_funding.totalReturnPct.toFixed(2)}% | ${output.baseline_comparison.E_handshake_scaling_overnight_funding.winRatePct.toFixed(2)}% | ${output.baseline_comparison.E_handshake_scaling_overnight_funding.avgR.toFixed(3)} | ${output.baseline_comparison.E_handshake_scaling_overnight_funding.maxDrawdownPct.toFixed(2)}% | ${output.baseline_comparison.E_handshake_scaling_overnight_funding.trades} | ${output.baseline_comparison.E_handshake_scaling_overnight_funding.tradesPerWeek.toFixed(2)} |`);
  lines.push(`| F) Handshake + Scaling + Overnight + OI Delta Filter | ${output.baseline_comparison.F_handshake_scaling_overnight_oi.totalReturnPct.toFixed(2)}% | ${output.baseline_comparison.F_handshake_scaling_overnight_oi.winRatePct.toFixed(2)}% | ${output.baseline_comparison.F_handshake_scaling_overnight_oi.avgR.toFixed(3)} | ${output.baseline_comparison.F_handshake_scaling_overnight_oi.maxDrawdownPct.toFixed(2)}% | ${output.baseline_comparison.F_handshake_scaling_overnight_oi.trades} | ${output.baseline_comparison.F_handshake_scaling_overnight_oi.tradesPerWeek.toFixed(2)} |`);
  lines.push(`| G) Handshake + Scaling + Overnight + Funding + OI | ${output.baseline_comparison.G_handshake_scaling_overnight_funding_oi.totalReturnPct.toFixed(2)}% | ${output.baseline_comparison.G_handshake_scaling_overnight_funding_oi.winRatePct.toFixed(2)}% | ${output.baseline_comparison.G_handshake_scaling_overnight_funding_oi.avgR.toFixed(3)} | ${output.baseline_comparison.G_handshake_scaling_overnight_funding_oi.maxDrawdownPct.toFixed(2)}% | ${output.baseline_comparison.G_handshake_scaling_overnight_funding_oi.trades} | ${output.baseline_comparison.G_handshake_scaling_overnight_funding_oi.tradesPerWeek.toFixed(2)} |`);
  lines.push(`| H) Handshake + Scaling + Overnight + Funding Reverse | ${output.baseline_comparison.H_handshake_scaling_overnight_funding_reverse.totalReturnPct.toFixed(2)}% | ${output.baseline_comparison.H_handshake_scaling_overnight_funding_reverse.winRatePct.toFixed(2)}% | ${output.baseline_comparison.H_handshake_scaling_overnight_funding_reverse.avgR.toFixed(3)} | ${output.baseline_comparison.H_handshake_scaling_overnight_funding_reverse.maxDrawdownPct.toFixed(2)}% | ${output.baseline_comparison.H_handshake_scaling_overnight_funding_reverse.trades} | ${output.baseline_comparison.H_handshake_scaling_overnight_funding_reverse.tradesPerWeek.toFixed(2)} |`);
  lines.push(`| I) Handshake + Scaling + Overnight + OI Reverse | ${output.baseline_comparison.I_handshake_scaling_overnight_oi_reverse.totalReturnPct.toFixed(2)}% | ${output.baseline_comparison.I_handshake_scaling_overnight_oi_reverse.winRatePct.toFixed(2)}% | ${output.baseline_comparison.I_handshake_scaling_overnight_oi_reverse.avgR.toFixed(3)} | ${output.baseline_comparison.I_handshake_scaling_overnight_oi_reverse.maxDrawdownPct.toFixed(2)}% | ${output.baseline_comparison.I_handshake_scaling_overnight_oi_reverse.trades} | ${output.baseline_comparison.I_handshake_scaling_overnight_oi_reverse.tradesPerWeek.toFixed(2)} |`);
  lines.push(`| J) Handshake + Scaling + Overnight + Funding + OI Reverse | ${output.baseline_comparison.J_handshake_scaling_overnight_funding_oi_reverse.totalReturnPct.toFixed(2)}% | ${output.baseline_comparison.J_handshake_scaling_overnight_funding_oi_reverse.winRatePct.toFixed(2)}% | ${output.baseline_comparison.J_handshake_scaling_overnight_funding_oi_reverse.avgR.toFixed(3)} | ${output.baseline_comparison.J_handshake_scaling_overnight_funding_oi_reverse.maxDrawdownPct.toFixed(2)}% | ${output.baseline_comparison.J_handshake_scaling_overnight_funding_oi_reverse.trades} | ${output.baseline_comparison.J_handshake_scaling_overnight_funding_oi_reverse.tradesPerWeek.toFixed(2)} |`);
  lines.push(`| K) 3-Way Handshake + Scaling + Overnight Hold (Alt Expansion) | ${output.baseline_comparison.K_3way_handshake_scaling_overnight_alts.totalReturnPct.toFixed(2)}% | ${output.baseline_comparison.K_3way_handshake_scaling_overnight_alts.winRatePct.toFixed(2)}% | ${output.baseline_comparison.K_3way_handshake_scaling_overnight_alts.avgR.toFixed(3)} | ${output.baseline_comparison.K_3way_handshake_scaling_overnight_alts.maxDrawdownPct.toFixed(2)}% | ${output.baseline_comparison.K_3way_handshake_scaling_overnight_alts.trades} | ${output.baseline_comparison.K_3way_handshake_scaling_overnight_alts.tradesPerWeek.toFixed(2)} |`);
  lines.push(`| D) v3 Baseline (Independent + Current Risk) | ${output.baseline_comparison.D_v3_baseline_independent_current_risk.totalReturnPct.toFixed(2)}% | ${output.baseline_comparison.D_v3_baseline_independent_current_risk.winRatePct.toFixed(2)}% | ${output.baseline_comparison.D_v3_baseline_independent_current_risk.avgR.toFixed(3)} | ${output.baseline_comparison.D_v3_baseline_independent_current_risk.maxDrawdownPct.toFixed(2)}% | ${output.baseline_comparison.D_v3_baseline_independent_current_risk.trades} | ${output.baseline_comparison.D_v3_baseline_independent_current_risk.tradesPerWeek.toFixed(2)} |`);
  lines.push(`| L) Weekly Bias Hold (Scaling, No Sweep) | ${output.baseline_comparison.L_weekly_bias_hold_scaling.totalReturnPct.toFixed(2)}% | ${output.baseline_comparison.L_weekly_bias_hold_scaling.winRatePct.toFixed(2)}% | ${output.baseline_comparison.L_weekly_bias_hold_scaling.avgR.toFixed(3)} | ${output.baseline_comparison.L_weekly_bias_hold_scaling.maxDrawdownPct.toFixed(2)}% | ${output.baseline_comparison.L_weekly_bias_hold_scaling.trades} | ${output.baseline_comparison.L_weekly_bias_hold_scaling.tradesPerWeek.toFixed(2)} |`);
  lines.push(`| Daily NY Open Short | ${output.baseline_comparison.daily_ny_open_short.totalReturnPct.toFixed(2)}% | ${output.baseline_comparison.daily_ny_open_short.winRatePct.toFixed(2)}% | ${output.baseline_comparison.daily_ny_open_short.avgR.toFixed(3)} | ${output.baseline_comparison.daily_ny_open_short.maxDrawdownPct.toFixed(2)}% | ${output.baseline_comparison.daily_ny_open_short.trades} | ${output.baseline_comparison.daily_ny_open_short.tradesPerWeek.toFixed(2)} |`);
  lines.push("");

  lines.push("### Handshake Diagnostics", "");
  lines.push(`- Handshake triggered: ${output.handshake_diagnostics.triggered}`);
  lines.push(`- Single-symbol signals (missed handshake): ${output.handshake_diagnostics.missed_single}`);
  lines.push(`- Both signalled but outside 1hr window: ${output.handshake_diagnostics.missed_timing}`);
  lines.push(`- Handshake trigger rate: ${output.handshake_diagnostics.trigger_rate_pct.toFixed(2)}%`);
  lines.push("");

  lines.push("### 3-Way Handshake Diagnostics (Variant K)", "");
  lines.push(`- Total BTC+ETH handshakes that could gate alts: ${output.alt_3way_diagnostics.total_core_handshakes}`);
  lines.push("| Alt | Signals Within 60m | Missed 60m Window | Trigger Rate % (per core handshake) |");
  lines.push("| --- | ---: | ---: | ---: |");
  for (const symbol of output.alt_symbols_used) {
    lines.push(`| ${symbol} | ${output.alt_3way_diagnostics.within_window_by_symbol[symbol]} | ${output.alt_3way_diagnostics.missed_window_by_symbol[symbol]} | ${output.alt_3way_diagnostics.trigger_rate_by_symbol_pct[symbol].toFixed(2)} |`);
  }
  lines.push("");
  if (output.alt_3way_diagnostics.missing_or_sparse_weeks.length) {
    lines.push("| Alt Data Skips | Week Open UTC | Reason |");
    lines.push("| --- | --- | --- |");
    for (const row of output.alt_3way_diagnostics.missing_or_sparse_weeks) {
      lines.push(`| ${row.symbol} | ${row.week_open_utc} | ${row.reason} |`);
    }
    lines.push("");
  }

  lines.push("### Alt Breakdown (Variant K)", "");
  lines.push("| Alt | Signals | Entries | Win Rate % | Net PnL USD | Avg Unlevered PnL % |");
  lines.push("| --- | ---: | ---: | ---: | ---: | ---: |");
  for (const row of output.alt_performance) {
    lines.push(`| ${row.symbol} | ${row.signals} | ${row.entries} | ${row.win_rate_pct.toFixed(2)} | ${row.net_pnl_usd.toFixed(2)} | ${row.avg_unlevered_pnl_pct.toFixed(2)} |`);
  }
  lines.push("");

  lines.push("### Alt Session Window Breakdown (Variant K)", "");
  lines.push("| Session Window | Trades | Win Rate % | Total PnL USD | Avg R |");
  lines.push("| --- | ---: | ---: | ---: | ---: |");
  for (const row of output.alt_session_breakdown) {
    lines.push(`| ${row.session_window} | ${row.trades} | ${row.win_rate_pct.toFixed(2)} | ${row.total_pnl_usd.toFixed(2)} | ${row.avg_r_multiple.toFixed(3)} |`);
  }
  lines.push("");

  const altSpikeTrades = output.trades
    .filter((trade) => trade.strategy === "K_3way_handshake_scaling_overnight_alts" && trade.gate_source === "3way_handshake");
  lines.push("### Alt Spike Analysis at Entry Time", "");
  lines.push("| Symbol | Trade # | 4h Change% | BTC 4h Change% | Relative Spike | Z-Score | PnL% | Hit BE? | Max Milestone |");
  lines.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: | --- | ---: |");
  for (const trade of altSpikeTrades) {
    const maxMilestone = trade.milestones_hit.length ? Math.max(...trade.milestones_hit) : 0;
    lines.push(`| ${trade.symbol} | ${trade.id} | ${trade.alt_change_pct_4h === null ? "n/a" : trade.alt_change_pct_4h.toFixed(2)} | ${trade.btc_change_pct_4h === null ? "n/a" : trade.btc_change_pct_4h.toFixed(2)} | ${trade.relative_spike === null ? "n/a" : trade.relative_spike.toFixed(2)} | ${trade.spike_z_score === null ? "n/a" : trade.spike_z_score.toFixed(2)} | ${trade.unlevered_pnl_pct.toFixed(2)} | ${trade.breakeven_reached ? "yes" : "no"} | ${maxMilestone} |`);
  }
  lines.push("");

  const spikeBuckets = [
    { label: "< 1.0 (moved less than BTC)", min: Number.NEGATIVE_INFINITY, max: 1.0 },
    { label: "1.0 - 1.5", min: 1.0, max: 1.5 },
    { label: "1.5 - 2.0", min: 1.5, max: 2.0 },
    { label: "> 2.0 (moved 2x+ BTC)", min: 2.0, max: Number.POSITIVE_INFINITY },
  ];
  lines.push("### Spike Magnitude vs Outcome", "");
  lines.push("| Relative Spike Bucket | Trades | Win Rate | Avg PnL% | Avg Max Milestone |");
  lines.push("| --- | ---: | ---: | ---: | ---: |");
  for (const bucket of spikeBuckets) {
    const rows = altSpikeTrades.filter((trade) => {
      const spike = trade.relative_spike;
      if (spike === null) return false;
      return spike >= bucket.min && spike < bucket.max;
    });
    const wins = rows.filter((row) => row.pnl_usd > 0).length;
    const avgPnl = rows.length ? rows.reduce((sum, row) => sum + row.unlevered_pnl_pct, 0) / rows.length : 0;
    const avgMilestone = rows.length
      ? rows.reduce((sum, row) => sum + (row.milestones_hit.length ? Math.max(...row.milestones_hit) : 0), 0) / rows.length
      : 0;
    const winRate = rows.length ? (wins / rows.length) * 100 : 0;
    lines.push(`| ${bucket.label} | ${rows.length} | ${winRate.toFixed(2)}% | ${avgPnl.toFixed(2)} | ${avgMilestone.toFixed(2)} |`);
  }
  lines.push("");

  lines.push("### Scaling Milestones", "");
  lines.push("#### B) Independent + Scaling Risk", "");
  lines.push("| Milestone | Times Reached | % of Trades |");
  lines.push("| --- | ---: | ---: |");
  for (const row of output.scaling_milestones.B_independent_scaling_risk) {
    lines.push(`| ${row.milestone} | ${row.times} | ${row.pct_of_trades.toFixed(2)}% |`);
  }
  lines.push("");

  lines.push("#### C) Handshake + Scaling + Overnight Hold", "");
  lines.push("| Milestone | Times Reached | % of Trades |");
  lines.push("| --- | ---: | ---: |");
  for (const row of output.scaling_milestones.C_handshake_scaling_risk) {
    lines.push(`| ${row.milestone} | ${row.times} | ${row.pct_of_trades.toFixed(2)}% |`);
  }
  lines.push("");

  lines.push("#### E) Handshake + Scaling + Overnight + Funding Filter", "");
  lines.push("| Milestone | Times Reached | % of Trades |");
  lines.push("| --- | ---: | ---: |");
  for (const row of output.scaling_milestones.E_handshake_scaling_overnight_funding) {
    lines.push(`| ${row.milestone} | ${row.times} | ${row.pct_of_trades.toFixed(2)}% |`);
  }
  lines.push("");

  lines.push("#### F) Handshake + Scaling + Overnight + OI Delta Filter", "");
  lines.push("| Milestone | Times Reached | % of Trades |");
  lines.push("| --- | ---: | ---: |");
  for (const row of output.scaling_milestones.F_handshake_scaling_overnight_oi) {
    lines.push(`| ${row.milestone} | ${row.times} | ${row.pct_of_trades.toFixed(2)}% |`);
  }
  lines.push("");

  lines.push("#### G) Handshake + Scaling + Overnight + Funding + OI", "");
  lines.push("| Milestone | Times Reached | % of Trades |");
  lines.push("| --- | ---: | ---: |");
  for (const row of output.scaling_milestones.G_handshake_scaling_overnight_funding_oi) {
    lines.push(`| ${row.milestone} | ${row.times} | ${row.pct_of_trades.toFixed(2)}% |`);
  }
  lines.push("");

  lines.push("#### H) Handshake + Scaling + Overnight + Funding Reverse", "");
  lines.push("| Milestone | Times Reached | % of Trades |");
  lines.push("| --- | ---: | ---: |");
  for (const row of output.scaling_milestones.H_handshake_scaling_overnight_funding_reverse) {
    lines.push(`| ${row.milestone} | ${row.times} | ${row.pct_of_trades.toFixed(2)}% |`);
  }
  lines.push("");

  lines.push("#### I) Handshake + Scaling + Overnight + OI Reverse", "");
  lines.push("| Milestone | Times Reached | % of Trades |");
  lines.push("| --- | ---: | ---: |");
  for (const row of output.scaling_milestones.I_handshake_scaling_overnight_oi_reverse) {
    lines.push(`| ${row.milestone} | ${row.times} | ${row.pct_of_trades.toFixed(2)}% |`);
  }
  lines.push("");

  lines.push("#### J) Handshake + Scaling + Overnight + Funding + OI Reverse", "");
  lines.push("| Milestone | Times Reached | % of Trades |");
  lines.push("| --- | ---: | ---: |");
  for (const row of output.scaling_milestones.J_handshake_scaling_overnight_funding_oi_reverse) {
    lines.push(`| ${row.milestone} | ${row.times} | ${row.pct_of_trades.toFixed(2)}% |`);
  }
  lines.push("");

  lines.push("#### K) 3-Way Handshake + Scaling + Overnight Hold (Alt Expansion)", "");
  lines.push("| Milestone | Times Reached | % of Trades |");
  lines.push("| --- | ---: | ---: |");
  for (const row of output.scaling_milestones.K_3way_handshake_scaling_overnight_alts) {
    lines.push(`| ${row.milestone} | ${row.times} | ${row.pct_of_trades.toFixed(2)}% |`);
  }
  lines.push("");

  lines.push("### Tier 1 Filter Diagnostics", "");
  lines.push(`- OI delta method: ${output.tier1_filter_diagnostics.oi_method}`);
  lines.push("");

  lines.push("#### E) Funding Filter Impact vs C", "");
  lines.push(`- Filtered C trades: ${output.tier1_filter_diagnostics.funding.filtered_count}`);
  lines.push(`- Removed winners: ${output.tier1_filter_diagnostics.funding.removed_wins}`);
  lines.push(`- Removed losers: ${output.tier1_filter_diagnostics.funding.removed_losses}`);
  lines.push(`- Removed flats: ${output.tier1_filter_diagnostics.funding.removed_flats}`);
  lines.push("| Symbol | Week Open | Day | Window | Entry UTC | Funding Rate | Fail Reason | C Outcome | C PnL USD |");
  lines.push("| --- | --- | --- | --- | --- | ---: | --- | --- | ---: |");
  for (const row of output.tier1_filter_diagnostics.funding.rows) {
    lines.push(`| ${row.symbol} | ${row.week_open_utc} | ${row.day_utc} | ${row.session_window} | ${row.entry_time_utc} | ${row.funding_rate === null ? "n/a" : row.funding_rate.toFixed(6)} | ${row.fail_reason} | ${row.c_outcome} | ${row.c_pnl_usd === null ? "n/a" : row.c_pnl_usd.toFixed(2)} |`);
  }
  lines.push("");

  lines.push("#### F) OI Delta Filter Impact vs C", "");
  lines.push(`- Filtered C trades: ${output.tier1_filter_diagnostics.oi.filtered_count}`);
  lines.push(`- Removed winners: ${output.tier1_filter_diagnostics.oi.removed_wins}`);
  lines.push(`- Removed losers: ${output.tier1_filter_diagnostics.oi.removed_losses}`);
  lines.push(`- Removed flats: ${output.tier1_filter_diagnostics.oi.removed_flats}`);
  lines.push("| Symbol | Week Open | Day | Window | Entry UTC | OI Delta % | Fail Reason | C Outcome | C PnL USD |");
  lines.push("| --- | --- | --- | --- | --- | ---: | --- | --- | ---: |");
  for (const row of output.tier1_filter_diagnostics.oi.rows) {
    lines.push(`| ${row.symbol} | ${row.week_open_utc} | ${row.day_utc} | ${row.session_window} | ${row.entry_time_utc} | ${row.oi_delta_pct === null ? "n/a" : row.oi_delta_pct.toFixed(2)} | ${row.fail_reason} | ${row.c_outcome} | ${row.c_pnl_usd === null ? "n/a" : row.c_pnl_usd.toFixed(2)} |`);
  }
  lines.push("");

  lines.push("#### G) Funding + OI Combined Filter Impact vs C", "");
  lines.push(`- Filtered C trades: ${output.tier1_filter_diagnostics.both.filtered_count}`);
  lines.push(`- Removed winners: ${output.tier1_filter_diagnostics.both.removed_wins}`);
  lines.push(`- Removed losers: ${output.tier1_filter_diagnostics.both.removed_losses}`);
  lines.push(`- Removed flats: ${output.tier1_filter_diagnostics.both.removed_flats}`);
  lines.push("| Symbol | Week Open | Day | Window | Entry UTC | Funding Rate | OI Delta % | Fail Reason | C Outcome | C PnL USD |");
  lines.push("| --- | --- | --- | --- | --- | ---: | ---: | --- | --- | ---: |");
  for (const row of output.tier1_filter_diagnostics.both.rows) {
    lines.push(`| ${row.symbol} | ${row.week_open_utc} | ${row.day_utc} | ${row.session_window} | ${row.entry_time_utc} | ${row.funding_rate === null ? "n/a" : row.funding_rate.toFixed(6)} | ${row.oi_delta_pct === null ? "n/a" : row.oi_delta_pct.toFixed(2)} | ${row.fail_reason} | ${row.c_outcome} | ${row.c_pnl_usd === null ? "n/a" : row.c_pnl_usd.toFixed(2)} |`);
  }
  lines.push("");

  lines.push("### Tier 1 Reverse Filter Diagnostics", "");

  lines.push("#### H) Funding Reverse Impact vs C", "");
  lines.push(`- Filtered C trades: ${output.tier1_filter_diagnostics.funding_reverse.filtered_count}`);
  lines.push(`- Removed winners: ${output.tier1_filter_diagnostics.funding_reverse.removed_wins}`);
  lines.push(`- Removed losers: ${output.tier1_filter_diagnostics.funding_reverse.removed_losses}`);
  lines.push(`- Removed flats: ${output.tier1_filter_diagnostics.funding_reverse.removed_flats}`);
  lines.push("");

  lines.push("#### I) OI Reverse Impact vs C", "");
  lines.push(`- Filtered C trades: ${output.tier1_filter_diagnostics.oi_reverse.filtered_count}`);
  lines.push(`- Removed winners: ${output.tier1_filter_diagnostics.oi_reverse.removed_wins}`);
  lines.push(`- Removed losers: ${output.tier1_filter_diagnostics.oi_reverse.removed_losses}`);
  lines.push(`- Removed flats: ${output.tier1_filter_diagnostics.oi_reverse.removed_flats}`);
  lines.push("");

  lines.push("#### J) Funding + OI Reverse Impact vs C", "");
  lines.push(`- Filtered C trades: ${output.tier1_filter_diagnostics.both_reverse.filtered_count}`);
  lines.push(`- Removed winners: ${output.tier1_filter_diagnostics.both_reverse.removed_wins}`);
  lines.push(`- Removed losers: ${output.tier1_filter_diagnostics.both_reverse.removed_losses}`);
  lines.push(`- Removed flats: ${output.tier1_filter_diagnostics.both_reverse.removed_flats}`);
  lines.push("");

  lines.push("## 4. Primary Strategy Metrics", "");
  lines.push(`- Primary strategy: ${strategyLabel(output.metrics_primary.strategy)}`);
  lines.push(`- Total return: ${output.metrics_primary.total_return_pct.toFixed(2)}%`);
  lines.push(`- Win rate: ${output.metrics_primary.win_rate_pct.toFixed(2)}%`);
  lines.push(`- Average R:R: ${output.metrics_primary.avg_r_multiple.toFixed(3)}`);
  lines.push(`- Max drawdown: ${output.metrics_primary.max_drawdown_pct.toFixed(2)}%`);
  lines.push(`- Average trades per week: ${output.metrics_primary.avg_trades_per_week.toFixed(2)}`);
  lines.push("");

  lines.push("### Day-of-Week Breakdown (Primary)", "");
  lines.push("| Day | Trades | Win Rate % | Total PnL USD | Avg R |");
  lines.push("| --- | ---: | ---: | ---: | ---: |");
  for (const row of output.day_of_week_breakdown) {
    lines.push(`| ${row.day} | ${row.trades} | ${row.win_rate_pct.toFixed(2)} | ${row.total_pnl_usd.toFixed(2)} | ${row.avg_r_multiple.toFixed(3)} |`);
  }
  lines.push("");

  lines.push("## 5. Recommendations", "");
  for (const r of output.recommendations) lines.push(`- ${r}`);
  lines.push("");

  return lines.join("\n");
}

type SessionGapVariantKey =
  | "A_baseline_gap"
  | "B_extended_ny"
  | "C_extended_asia"
  | "D_split_gap";

type SessionGapVariantSummary = {
  key: SessionGapVariantKey;
  label: string;
  mode: SessionGapMode;
  trades: number;
  winRatePct: number;
  returnPct: number;
  maxDrawdownPct: number;
  avgTradePct: number;
  sharpeLike: number;
};

type SessionGapVariantOutput = {
  generatedUtc: string;
  weeks: string[];
  baselineReference: StrategyTotals;
  baselineRegression: {
    returnDiffPct: number;
    maxDdDiffPct: number;
    tradeCountDiff: number;
    winRateDiffPct: number;
    isMatch: boolean;
  };
  variants: SessionGapVariantSummary[];
  tradesByVariant: Record<SessionGapVariantKey, ClosedTrade[]>;
};

const SESSION_GAP_VARIANTS: Array<{
  key: SessionGapVariantKey;
  label: string;
  mode: SessionGapMode;
}> = [
  { key: "A_baseline_gap", label: "A: Baseline (3h gap)", mode: "baseline" },
  { key: "B_extended_ny", label: "B: Extended NY", mode: "extended_ny" },
  { key: "C_extended_asia", label: "C: Extended Asia", mode: "extended_asia" },
  { key: "D_split_gap", label: "D: Split Gap", mode: "split" },
];

function computeSharpeLike(weeklyReturnsPct: number[]) {
  if (!weeklyReturnsPct.length) return 0;
  const mean = weeklyReturnsPct.reduce((sum, value) => sum + value, 0) / weeklyReturnsPct.length;
  const variance = weeklyReturnsPct.reduce((sum, value) => sum + (value - mean) ** 2, 0) / weeklyReturnsPct.length;
  const std = Math.sqrt(variance);
  if (!(std > 0)) return 0;
  return mean / std;
}

function buildSessionGapVariantsMarkdown(output: SessionGapVariantOutput) {
  const lines: string[] = [];
  lines.push("# Session Gap Variant Comparison", "");
  lines.push(`Generated UTC: ${output.generatedUtc}`);
  lines.push(`Weeks: ${output.weeks.join(", ")}`);
  lines.push("");
  lines.push("| Variant | Trades | Win Rate | Return % | Max DD % | Avg Trade % | Sharpe |");
  lines.push("|---------|--------:|---------:|---------:|---------:|------------:|-------:|");
  for (const row of output.variants) {
    lines.push(`| ${row.label} | ${row.trades} | ${row.winRatePct.toFixed(2)}% | ${row.returnPct.toFixed(2)}% | ${row.maxDrawdownPct.toFixed(2)}% | ${row.avgTradePct.toFixed(2)}% | ${row.sharpeLike.toFixed(3)} |`);
  }
  lines.push("");
  lines.push("## Baseline Regression Check");
  lines.push(`- Reference strategy: C) Handshake + Scaling + Overnight Hold`);
  lines.push(`- Return diff (A - ref): ${output.baselineRegression.returnDiffPct.toFixed(6)}%`);
  lines.push(`- Max DD diff (A - ref): ${output.baselineRegression.maxDdDiffPct.toFixed(6)}%`);
  lines.push(`- Trade count diff (A - ref): ${output.baselineRegression.tradeCountDiff}`);
  lines.push(`- Win rate diff (A - ref): ${output.baselineRegression.winRateDiffPct.toFixed(6)}%`);
  lines.push(`- Match within tolerance: ${output.baselineRegression.isMatch ? "YES" : "NO"}`);
  lines.push("");
  lines.push("## Per-Variant Trade Log", "");
  for (const variant of SESSION_GAP_VARIANTS) {
    lines.push(`### ${variant.label}`, "");
    lines.push("| # | Week | Day | Symbol | Dir | Session | Entry UTC | Exit UTC | Unlev % | Lev % | Exit |");
    lines.push("|---:|---|---|---|---|---|---|---|---:|---:|---|");
    const rows = output.tradesByVariant[variant.key];
    if (!rows.length) {
      lines.push("|  |  |  |  |  |  |  |  |  |  | No trades |");
      lines.push("");
      continue;
    }
    rows.forEach((t, index) => {
      lines.push(`| ${index + 1} | ${t.week_open_utc.slice(0, 10)} | ${t.day_utc} | ${t.symbol} | ${t.direction} | ${t.session_window} | ${t.entry_time_utc} | ${t.exit_time_utc} | ${t.unlevered_pnl_pct.toFixed(2)} | ${t.leveraged_pnl_pct.toFixed(2)} | ${t.exit_reason} |`);
    });
    lines.push("");
  }
  return lines.join("\n");
}

async function runSessionGapVariantComparison(params: {
  weekOpens: string[];
  cotHistory: CotSnapshot[];
  fundingBySymbol: Record<CoreSymbol, FundingPoint[]>;
  baselineReference: StrategyTotals;
}) {
  const { weekOpens, cotHistory, fundingBySymbol, baselineReference } = params;

  type GapVariantState = {
    balance: number;
    peak: number;
    maxDd: number;
    tradeId: number;
    trades: ClosedTrade[];
    weeklyReturnsPct: number[];
  };

  const variantState = {} as Record<SessionGapVariantKey, GapVariantState>;
  for (const variant of SESSION_GAP_VARIANTS) {
    variantState[variant.key] = {
      balance: STARTING_BALANCE_USD,
      peak: STARTING_BALANCE_USD,
      maxDd: 0,
      tradeId: 0,
      trades: [],
      weeklyReturnsPct: [],
    };
  }

  for (const weekOpenUtc of weekOpens) {
    const weekOpen = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
    const weekClose = weekOpen.plus({ weeks: 1 });
    const weekDataOpen = weekOpen.minus({ days: 1 });
    const weekOpenMs = weekOpen.toMillis();
    const weekCloseMs = weekClose.toMillis();

    const cotSnapshot = selectCotSnapshotForWeek(cotHistory, weekOpenUtc);
    if (!cotSnapshot) continue;

    const pairDefs = PAIRS_BY_ASSET_CLASS.crypto;
    const dealerPairs = derivePairDirectionsByBase(cotSnapshot.currencies, pairDefs, "dealer");
    const commercialPairs = derivePairDirectionsByBase(cotSnapshot.currencies, pairDefs, "commercial");

    const sentiment = await getAggregatesForWeekStartWithBackfill(
      weekOpen.toUTC().toISO() ?? weekOpenUtc,
      weekClose.toUTC().toISO() ?? weekOpenUtc,
    );
    const sentimentMap = new Map(sentiment.map((agg) => [String(agg.symbol).toUpperCase(), agg]));

    const biases = {} as Record<CoreSymbol, WeeklyBias>;
    for (const symbol of CORE_SYMBOLS) {
      const dealer = dealerPairs[`${symbol}USD`]?.direction ?? "NEUTRAL";
      const commercial = commercialPairs[`${symbol}USD`]?.direction ?? "NEUTRAL";
      const agg = sentimentMap.get(`${symbol}USD`) ?? sentimentMap.get(symbol) ?? sentimentMap.get(`${symbol}USDT`);
      let sentimentDir = directionFromSentimentAggregate(agg);
      let sentimentSource: WeeklyBias["sentimentSource"] = agg ? "aggregate" : "missing";
      let fundingRate: number | null = null;
      if (!agg) {
        const proxy = deriveFundingProxyDirection(fundingBySymbol[symbol], weekOpenUtc);
        sentimentDir = proxy.direction;
        fundingRate = proxy.rate;
        if (proxy.rate !== null) sentimentSource = "funding_proxy";
      }
      const cls = classifyTier(dealer, commercial, sentimentDir);
      biases[symbol] = {
        tier: cls.tier,
        bias: cls.bias,
        dealer,
        commercial,
        sentiment: sentimentDir,
        sentimentSource,
        fundingRate,
        votes: cls.votes,
      };
    }

    const candlesBySymbol = {} as Record<CoreSymbol, Candle[]>;
    const weekIndicesBySymbol = {} as Record<CoreSymbol, number[]>;
    for (const symbol of CORE_SYMBOLS) {
      const rawM1 = await fetchRawM1Candles(symbol, weekDataOpen, weekClose);
      const m5 = aggregateM1ToM5(rawM1);
      candlesBySymbol[symbol] = m5;
      weekIndicesBySymbol[symbol] = m5
        .map((c, idx) => ({ ts: c.ts, idx }))
        .filter((row) => row.ts >= weekOpenMs && row.ts < weekCloseMs)
        .map((row) => row.idx);
    }

    const rangesByMode = {} as Record<SessionGapMode, {
      asiaLondon: Record<CoreSymbol, Map<string, DailyRange>>;
      us: Record<CoreSymbol, Map<string, DailyRange>>;
      filters: SessionFilters;
    }>;
    for (const variant of SESSION_GAP_VARIANTS) {
      const filters = makeSessionFilters(variant.mode);
      rangesByMode[variant.mode] = {
        filters,
        asiaLondon: {
          BTC: buildDailyRanges(candlesBySymbol.BTC, filters),
          ETH: buildDailyRanges(candlesBySymbol.ETH, filters),
        },
        us: {
          BTC: buildUsSessionRanges(candlesBySymbol.BTC, filters),
          ETH: buildUsSessionRanges(candlesBySymbol.ETH, filters),
        },
      };
    }

    const dateKeys: string[] = [];
    for (let d = weekOpen.startOf("day"); d < weekClose; d = d.plus({ days: 1 })) {
      const key = d.toISODate();
      if (key) dateKeys.push(key);
    }

    const weeklyEntries = {} as Record<SessionGapVariantKey, Record<CoreSymbol, number>>;
    const weekStartBalance = {} as Record<SessionGapVariantKey, number>;
    for (const variant of SESSION_GAP_VARIANTS) {
      weeklyEntries[variant.key] = { BTC: 0, ETH: 0 };
      weekStartBalance[variant.key] = variantState[variant.key].balance;
    }

    for (const dayUtc of dateKeys) {
      if (isSundayUtc(dayUtc)) continue;

      for (const variant of SESSION_GAP_VARIANTS) {
        const modePack = rangesByMode[variant.mode];
        const filters = modePack.filters;
        const plans: PlannedTrade[] = [];
        const sessionDefinitions: Array<{
          sessionWindow: SessionWindow;
          rangeSource: RangeSource;
          entrySession: EntrySession;
          rangeForSymbol: (symbol: CoreSymbol) => DailyRange | undefined;
          sessionIndicesForSymbol: (symbol: CoreSymbol) => number[];
        }> = [
          {
            sessionWindow: "ASIA_LONDON_RANGE_NY_ENTRY",
            rangeSource: "ASIA+LONDON",
            entrySession: "NY",
            rangeForSymbol: (symbol) => modePack.asiaLondon[symbol].get(dayUtc),
            sessionIndicesForSymbol: (symbol) => nyCandleIndicesForDay(candlesBySymbol[symbol], dayUtc, filters),
          },
          {
            sessionWindow: "US_RANGE_ASIA_LONDON_ENTRY",
            rangeSource: "US",
            entrySession: "ASIA_LONDON",
            rangeForSymbol: (symbol) => modePack.us[symbol].get(previousUtcDateKey(dayUtc)),
            sessionIndicesForSymbol: (symbol) => asiaLondonCandleIndicesForDay(candlesBySymbol[symbol], dayUtc, filters),
          },
        ];

        for (const sessionDef of sessionDefinitions) {
          const signalBySymbol = new Map<CoreSymbol, { signal: SignalCandidate; diagnostics: DaySweepDiagnostics; sessionIndices: number[] }>();
          for (const symbol of CORE_SYMBOLS) {
            const candles = candlesBySymbol[symbol];
            const range = sessionDef.rangeForSymbol(symbol);
            const indices = sessionDef.sessionIndicesForSymbol(symbol);
            if (!range?.locked || !indices.length) continue;
            const detected = detectSignalForWindow({
              symbol,
              weekOpenUtc,
              dayUtc,
              candles,
              sessionIndices: indices,
              range,
              bias: biases[symbol],
              sessionWindow: sessionDef.sessionWindow,
              rangeSource: sessionDef.rangeSource,
              entrySession: sessionDef.entrySession,
            });
            if (detected.signal) {
              signalBySymbol.set(symbol, {
                signal: detected.signal,
                diagnostics: detected.diagnostics,
                sessionIndices: indices,
              });
            }
          }

          const btcSignal = signalBySymbol.get("BTC");
          const ethSignal = signalBySymbol.get("ETH");
          if (!btcSignal || !ethSignal) continue;

          const btcTs = candlesBySymbol.BTC[btcSignal.signal.confirmIdx]?.ts;
          const ethTs = candlesBySymbol.ETH[ethSignal.signal.confirmIdx]?.ts;
          if (!Number.isFinite(btcTs) || !Number.isFinite(ethTs)) continue;
          if (Math.abs((btcTs as number) - (ethTs as number)) > HANDSHAKE_MAX_DELAY_MS) continue;
          if (weeklyEntries[variant.key].BTC >= MAX_ENTRIES_PER_SYMBOL_PER_WEEK) continue;
          if (weeklyEntries[variant.key].ETH >= MAX_ENTRIES_PER_SYMBOL_PER_WEEK) continue;

          const entryTs = Math.max(btcTs as number, ethTs as number);
          const delayMinutes = Math.abs((btcTs as number) - (ethTs as number)) / 60_000;
          const btcPlan = planTradeFromSignal({
            strategy: "C_handshake_scaling_risk",
            entryMode: "handshake",
            riskModel: "scaling",
            signal: btcSignal.signal,
            candles: candlesBySymbol.BTC,
            sessionIndices: btcSignal.sessionIndices,
            scalingExitIndices: weekIndicesBySymbol.BTC,
            scalingNoTriggerExitReason: "WEEK_CLOSE",
            entryTsOverride: entryTs,
            gateSource: "core_handshake",
            handshakePartnerSymbol: "ETH",
            handshakeDelayMinutes: delayMinutes,
            diagnostics: btcSignal.diagnostics,
          });
          const ethPlan = planTradeFromSignal({
            strategy: "C_handshake_scaling_risk",
            entryMode: "handshake",
            riskModel: "scaling",
            signal: ethSignal.signal,
            candles: candlesBySymbol.ETH,
            sessionIndices: ethSignal.sessionIndices,
            scalingExitIndices: weekIndicesBySymbol.ETH,
            scalingNoTriggerExitReason: "WEEK_CLOSE",
            entryTsOverride: entryTs,
            gateSource: "core_handshake",
            handshakePartnerSymbol: "BTC",
            handshakeDelayMinutes: delayMinutes,
            diagnostics: ethSignal.diagnostics,
          });
          if (btcPlan && ethPlan) {
            plans.push(btcPlan, ethPlan);
          }
        }

        const exec = executePlannedTrades(plans, variantState[variant.key].balance, variantState[variant.key].tradeId);
        variantState[variant.key].balance = exec.endingBalance;
        variantState[variant.key].tradeId = exec.nextTradeId;
        variantState[variant.key].trades.push(...exec.closed);
        for (const trade of exec.closed) {
          weeklyEntries[variant.key][trade.symbol as CoreSymbol] += 1;
        }
        if (variantState[variant.key].balance > variantState[variant.key].peak) {
          variantState[variant.key].peak = variantState[variant.key].balance;
        } else if (variantState[variant.key].peak > 0) {
          const dd = ((variantState[variant.key].peak - variantState[variant.key].balance) / variantState[variant.key].peak) * 100;
          variantState[variant.key].maxDd = Math.max(variantState[variant.key].maxDd, dd);
        }
      }
    }

    for (const variant of SESSION_GAP_VARIANTS) {
      const startBalance = weekStartBalance[variant.key];
      const endBalance = variantState[variant.key].balance;
      const weeklyReturn = startBalance > 0 ? ((endBalance - startBalance) / startBalance) * 100 : 0;
      variantState[variant.key].weeklyReturnsPct.push(weeklyReturn);
    }
  }

  const variantSummaries: SessionGapVariantSummary[] = SESSION_GAP_VARIANTS.map((variant) => {
    const state = variantState[variant.key];
    const totals = computeStrategyTotals(
      state.trades,
      STARTING_BALANCE_USD,
      state.balance,
      state.maxDd,
      weekOpens.length,
    );
    const avgTradePct = state.trades.length
      ? state.trades.reduce((sum, trade) => sum + trade.leveraged_pnl_pct, 0) / state.trades.length
      : 0;
    return {
      key: variant.key,
      label: variant.label,
      mode: variant.mode,
      trades: totals.trades,
      winRatePct: totals.winRatePct,
      returnPct: totals.totalReturnPct,
      maxDrawdownPct: totals.maxDrawdownPct,
      avgTradePct,
      sharpeLike: computeSharpeLike(state.weeklyReturnsPct),
    };
  });

  const baselineSummary = variantSummaries.find((row) => row.key === "A_baseline_gap");
  if (!baselineSummary) throw new Error("Missing baseline session-gap summary.");

  const regression = {
    returnDiffPct: baselineSummary.returnPct - baselineReference.totalReturnPct,
    maxDdDiffPct: baselineSummary.maxDrawdownPct - baselineReference.maxDrawdownPct,
    tradeCountDiff: baselineSummary.trades - baselineReference.trades,
    winRateDiffPct: baselineSummary.winRatePct - baselineReference.winRatePct,
    isMatch:
      Math.abs(baselineSummary.returnPct - baselineReference.totalReturnPct) < 1e-6
      && Math.abs(baselineSummary.maxDrawdownPct - baselineReference.maxDrawdownPct) < 1e-6
      && Math.abs(baselineSummary.winRatePct - baselineReference.winRatePct) < 1e-6
      && baselineSummary.trades === baselineReference.trades,
  };

  const report: SessionGapVariantOutput = {
    generatedUtc: DateTime.utc().toISO() ?? new Date().toISOString(),
    weeks: weekOpens,
    baselineReference,
    baselineRegression: regression,
    variants: variantSummaries,
    tradesByVariant: {
      A_baseline_gap: variantState.A_baseline_gap.trades,
      B_extended_ny: variantState.B_extended_ny.trades,
      C_extended_asia: variantState.C_extended_asia.trades,
      D_split_gap: variantState.D_split_gap.trades,
    },
  };

  const reportsDir = path.join(process.cwd(), "reports");
  mkdirSync(reportsDir, { recursive: true });
  writeFileSync(
    path.join(reportsDir, "session-gap-variants-latest.md"),
    buildSessionGapVariantsMarkdown(report),
    "utf8",
  );
}

async function main() {
  loadEnvFromFile();
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL missing.");

  const weekOpens = getLastCompletedWeekOpens(WEEKS_TO_BACKTEST);
  const altList = loadAltSymbolsFromScreener(weekOpens);
  ALT_SYMBOLS = [...altList.defaultSymbols];
  ALL_SYMBOLS = [...CORE_SYMBOLS, ...altList.allSymbols];
  console.log(`Variant K alt symbols (${altList.source}): ${altList.allSymbols.join(", ") || "none"}`);
  const cotHistory = await readSnapshotHistory("crypto", 260);
  if (!cotHistory.length) throw new Error("No crypto COT snapshots found.");

  const fundingBySymbol: Record<CoreSymbol, FundingPoint[]> = {
    BTC: await fetchFundingHistory("BTC"),
    ETH: await fetchFundingHistory("ETH"),
  };

  type StrategyState = { balance: number; tradeId: number; peak: number; maxDd: number; trades: ClosedTrade[] };
  const strategyState = {} as Record<StrategyKey, StrategyState>;
  for (const key of ALL_STRATEGY_KEYS) {
    strategyState[key] = {
      balance: STARTING_BALANCE_USD,
      tradeId: 0,
      peak: STARTING_BALANCE_USD,
      maxDd: 0,
      trades: [],
    };
  }

  const weeklyRows: WeekSummary[] = [];
  const sentimentMissingWeeks: BacktestOutput["data_coverage"]["sentiment_missing_weeks"] = [];
  const candleFetchNotes: BacktestOutput["data_coverage"]["candle_fetch"] = [];

  let handshakeTriggered = 0;
  let handshakeMissedSingle = 0;
  let handshakeMissedTiming = 0;

  let primarySweepEvents = 0;
  let primarySkippedWrongDirection = 0;
  let primarySkippedNoRejection = 0;
  let primarySkippedNoDisplacement = 0;
  let primarySkippedStopTooWide = 0;
  let primarySkippedNoBalance = 0;

  let altCoreHandshakeOpportunities = 0;
  const altSignalsBySymbol = makeSymbolCounter();
  const altSignalsWithinWindowBySymbol = makeSymbolCounter();
  const altSignalsMissedWindowBySymbol = makeSymbolCounter();
  const altMissingOrSparseWeeks: Array<{ week_open_utc: string; symbol: SymbolBase; reason: string }> = [];
  const altSymbolsByWeek: Array<{ week_open_utc: string; source: string; symbols: string[] }> = [];

  const filteredFundingRows: Array<{
    key: string;
    symbol: SymbolBase;
    week_open_utc: string;
    day_utc: string;
    session_window: SessionWindow;
    entry_time_utc: string;
    funding_rate: number | null;
    fail_reason: FilterFailReason;
  }> = [];
  const filteredOiRows: Array<{
    key: string;
    symbol: SymbolBase;
    week_open_utc: string;
    day_utc: string;
    session_window: SessionWindow;
    entry_time_utc: string;
    oi_delta_pct: number | null;
    fail_reason: FilterFailReason;
  }> = [];
  const filteredBothRows: Array<{
    key: string;
    symbol: SymbolBase;
    week_open_utc: string;
    day_utc: string;
    session_window: SessionWindow;
    entry_time_utc: string;
    funding_rate: number | null;
    oi_delta_pct: number | null;
    fail_reason: FilterFailReason;
  }> = [];
  const filteredFundingReverseRows: Array<{
    key: string;
    symbol: SymbolBase;
    week_open_utc: string;
    day_utc: string;
    session_window: SessionWindow;
    entry_time_utc: string;
    funding_rate: number | null;
    fail_reason: FilterFailReason;
  }> = [];
  const filteredOiReverseRows: Array<{
    key: string;
    symbol: SymbolBase;
    week_open_utc: string;
    day_utc: string;
    session_window: SessionWindow;
    entry_time_utc: string;
    oi_delta_pct: number | null;
    fail_reason: FilterFailReason;
  }> = [];
  const filteredBothReverseRows: Array<{
    key: string;
    symbol: SymbolBase;
    week_open_utc: string;
    day_utc: string;
    session_window: SessionWindow;
    entry_time_utc: string;
    funding_rate: number | null;
    oi_delta_pct: number | null;
    fail_reason: FilterFailReason;
  }> = [];

  const primaryStrategy: StrategyKey = "D_v3_baseline_independent_current_risk";

  for (const weekOpenUtc of weekOpens) {
    const weekOpen = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
    const weekClose = weekOpen.plus({ weeks: 1 });
    const weekDataOpen = weekOpen.minus({ days: 1 });
    const activeAltSymbols = altList.byWeek.get(weekOpenUtc) ?? ALT_SYMBOLS;
    const activeAltSource = altList.byWeek.has(weekOpenUtc) ? "weekly_recommendation" : "default_recommendation";
    const weekUniverseSymbols = Array.from(new Set<SymbolBase>([...CORE_SYMBOLS, ...activeAltSymbols]));
    altSymbolsByWeek.push({
      week_open_utc: weekOpenUtc,
      source: activeAltSource,
      symbols: activeAltSymbols,
    });

    const cotSnapshot = selectCotSnapshotForWeek(cotHistory, weekOpenUtc);
    if (!cotSnapshot) continue;

    const pairDefs = PAIRS_BY_ASSET_CLASS.crypto;
    const dealerPairs = derivePairDirectionsByBase(cotSnapshot.currencies, pairDefs, "dealer");
    const commercialPairs = derivePairDirectionsByBase(cotSnapshot.currencies, pairDefs, "commercial");

    const sentiment = await getAggregatesForWeekStartWithBackfill(
      weekOpen.toUTC().toISO() ?? weekOpenUtc,
      weekClose.toUTC().toISO() ?? weekOpenUtc,
    );
    const sentimentMap = new Map(sentiment.map((agg) => [String(agg.symbol).toUpperCase(), agg]));

    const biases = {} as Record<SymbolBase, WeeklyBias>;
    for (const symbol of SYMBOLS) {
      const dealer = dealerPairs[`${symbol}USD`]?.direction ?? "NEUTRAL";
      const commercial = commercialPairs[`${symbol}USD`]?.direction ?? "NEUTRAL";
      const agg = sentimentMap.get(`${symbol}USD`) ?? sentimentMap.get(symbol) ?? sentimentMap.get(`${symbol}USDT`);

      let sentimentDir = directionFromSentimentAggregate(agg);
      let sentimentSource: WeeklyBias["sentimentSource"] = agg ? "aggregate" : "missing";
      let fundingRate: number | null = null;
      if (!agg) {
        const proxy = deriveFundingProxyDirection(fundingBySymbol[symbol] ?? [], weekOpenUtc);
        sentimentDir = proxy.direction;
        fundingRate = proxy.rate;
        if (proxy.rate !== null) sentimentSource = "funding_proxy";
        sentimentMissingWeeks.push({
          week_open_utc: weekOpenUtc,
          symbol,
          used_funding_proxy: proxy.rate !== null,
          funding_rate_used: proxy.rate,
        });
      }

      const cls = classifyTier(dealer, commercial, sentimentDir);
      biases[symbol] = {
        tier: cls.tier,
        bias: cls.bias,
        dealer,
        commercial,
        sentiment: sentimentDir,
        sentimentSource,
        fundingRate,
        votes: cls.votes,
      };
    }

    const candlesBySymbol = {} as Record<SymbolBase, Candle[]>;
    const asiaLondonRangesBySymbol = {} as Record<SymbolBase, Map<string, DailyRange>>;
    const usRangesBySymbol = {} as Record<SymbolBase, Map<string, DailyRange>>;
    const weekIndicesBySymbol = {} as Record<SymbolBase, number[]>;
    const weekOpenMs = weekOpen.toMillis();
    const weekCloseMs = weekClose.toMillis();
    for (const symbol of weekUniverseSymbols) {
      try {
        let m1ExistingRows = 0;
        let h1ExistingRows = 0;
        if (symbol === "BTC" || symbol === "ETH") {
          m1ExistingRows = (await fetchBitgetMinuteSeries(symbol, { openUtc: weekOpen, closeUtc: weekClose })).length;
          h1ExistingRows = (await fetchBitgetCandleSeries(symbol, { openUtc: weekOpen, closeUtc: weekClose })).length;
        }
        const rawM1 = await fetchRawM1Candles(symbol, weekDataOpen, weekClose);
        const m5 = aggregateM1ToM5(rawM1);

        if (activeAltSymbols.includes(symbol) && m5.length < MIN_ALT_M5_ROWS_PER_WEEK) {
          candlesBySymbol[symbol] = [];
          asiaLondonRangesBySymbol[symbol] = new Map();
          usRangesBySymbol[symbol] = new Map();
          weekIndicesBySymbol[symbol] = [];
          altMissingOrSparseWeeks.push({
            week_open_utc: weekOpenUtc,
            symbol,
            reason: `sparse_m5_rows_${m5.length}`,
          });
          candleFetchNotes.push({
            week_open_utc: weekOpenUtc,
            symbol,
            m1_rows_existing: m1ExistingRows,
            h1_rows_existing: h1ExistingRows,
            m5_rows_backtest: m5.length,
            error: `Sparse alt data (need >= ${MIN_ALT_M5_ROWS_PER_WEEK} M5 rows)`,
          });
          if (activeAltSymbols.includes(symbol)) await sleep(ALT_FETCH_DELAY_MS);
          continue;
        }

        candlesBySymbol[symbol] = m5;
        asiaLondonRangesBySymbol[symbol] = buildDailyRanges(m5);
        usRangesBySymbol[symbol] = buildUsSessionRanges(m5);
        weekIndicesBySymbol[symbol] = m5
          .map((c, idx) => ({ ts: c.ts, idx }))
          .filter((r) => r.ts >= weekOpenMs && r.ts < weekCloseMs)
          .map((r) => r.idx);
        candleFetchNotes.push({
          week_open_utc: weekOpenUtc,
          symbol,
          m1_rows_existing: m1ExistingRows,
          h1_rows_existing: h1ExistingRows,
          m5_rows_backtest: m5.length,
          error: null,
        });
      } catch (error) {
        candlesBySymbol[symbol] = [];
        asiaLondonRangesBySymbol[symbol] = new Map();
        usRangesBySymbol[symbol] = new Map();
        weekIndicesBySymbol[symbol] = [];
        candleFetchNotes.push({
          week_open_utc: weekOpenUtc,
          symbol,
          m1_rows_existing: 0,
          h1_rows_existing: 0,
          m5_rows_backtest: 0,
          error: String(error),
        });
        if (activeAltSymbols.includes(symbol)) {
          altMissingOrSparseWeeks.push({
            week_open_utc: weekOpenUtc,
            symbol,
            reason: String(error),
          });
        }
      }
      if (activeAltSymbols.includes(symbol)) await sleep(ALT_FETCH_DELAY_MS);
    }

    const dateKeys: string[] = [];
    for (let d = weekOpen.startOf("day"); d < weekClose; d = d.plus({ days: 1 })) {
      const key = d.toISODate();
      if (key) dateKeys.push(key);
    }
    const weekFirstDayKey = dateKeys[0] ?? "";

    const weekStartPrimary = strategyState[primaryStrategy].balance;
    let weekWins = 0;
    let weekLosses = 0;

    const weeklyEntries = {} as Record<StrategyKey, Record<SymbolBase, number>>;
    for (const key of ALL_STRATEGY_KEYS) {
      weeklyEntries[key] = makeSymbolCounter();
    }

    for (const dayUtc of dateKeys) {
      if (isSundayUtc(dayUtc)) continue;

      const plansByStrategy = {} as Record<StrategyKey, PlannedTrade[]>;
      for (const key of ALL_STRATEGY_KEYS) {
        plansByStrategy[key] = [];
      }
      if (dayUtc === weekFirstDayKey) {
        for (const symbol of SYMBOLS) {
          if (weeklyEntries.L_weekly_bias_hold_scaling[symbol] >= 1) continue;
          const candles = candlesBySymbol[symbol];
          if (!candles.length) continue;
          const weekPlan = planWeeklyBiasHoldTrade({
            symbol,
            weekOpenUtc,
            candles,
            weekIndices: weekIndicesBySymbol[symbol],
            bias: biases[symbol],
          });
          if (weekPlan) plansByStrategy.L_weekly_bias_hold_scaling.push(weekPlan);
        }
      }

      const sessionDefinitions: Array<{
        sessionWindow: SessionWindow;
        rangeSource: RangeSource;
        entrySession: EntrySession;
        rangeForSymbol: (symbol: SymbolBase) => DailyRange | undefined;
        sessionIndicesForSymbol: (symbol: SymbolBase) => number[];
      }> = [
        {
          sessionWindow: "ASIA_LONDON_RANGE_NY_ENTRY",
          rangeSource: "ASIA+LONDON",
          entrySession: "NY",
          rangeForSymbol: (symbol) => asiaLondonRangesBySymbol[symbol].get(dayUtc),
          sessionIndicesForSymbol: (symbol) => nyCandleIndicesForDay(candlesBySymbol[symbol], dayUtc),
        },
        {
          sessionWindow: "US_RANGE_ASIA_LONDON_ENTRY",
          rangeSource: "US",
          entrySession: "ASIA_LONDON",
          rangeForSymbol: (symbol) => usRangesBySymbol[symbol].get(previousUtcDateKey(dayUtc)),
          sessionIndicesForSymbol: (symbol) => asiaLondonCandleIndicesForDay(candlesBySymbol[symbol], dayUtc),
        },
      ];

      for (const sessionDef of sessionDefinitions) {
        const signalBySymbol = new Map<SymbolBase, { signal: SignalCandidate; diagnostics: DaySweepDiagnostics; sessionIndices: number[] }>();

        for (const symbol of SYMBOLS) {
          const candles = candlesBySymbol[symbol];
          if (!candles.length) continue;

          const range = sessionDef.rangeForSymbol(symbol);
          const indices = sessionDef.sessionIndicesForSymbol(symbol);
          if (!range?.locked || !indices.length) continue;

          const detected = detectSignalForWindow({
            symbol,
            weekOpenUtc,
            dayUtc,
            candles,
            sessionIndices: indices,
            range,
            bias: biases[symbol],
            sessionWindow: sessionDef.sessionWindow,
            rangeSource: sessionDef.rangeSource,
            entrySession: sessionDef.entrySession,
          });

          primarySweepEvents += detected.diagnostics.sweepEvents;
          primarySkippedWrongDirection += detected.diagnostics.skippedWrongDirection;
          primarySkippedNoRejection += detected.diagnostics.skippedNoRejection;
          primarySkippedNoDisplacement += detected.diagnostics.skippedNoDisplacement;

          if (detected.signal) {
            signalBySymbol.set(symbol, {
              signal: detected.signal,
              diagnostics: detected.diagnostics,
              sessionIndices: indices,
            });
          }
        }

        const btcSignal = signalBySymbol.get("BTC");
        const ethSignal = signalBySymbol.get("ETH");
        let handshakeReady: { entryTs: number; delayMinutes: number; btcConfirmTs: number; ethConfirmTs: number } | null = null;

        if ((btcSignal && !ethSignal) || (!btcSignal && ethSignal)) {
          handshakeMissedSingle += 1;
        } else if (btcSignal && ethSignal) {
          const btcTs = candlesBySymbol.BTC[btcSignal.signal.confirmIdx].ts;
          const ethTs = candlesBySymbol.ETH[ethSignal.signal.confirmIdx].ts;
          const delayMs = Math.abs(btcTs - ethTs);
          if (delayMs <= HANDSHAKE_MAX_DELAY_MS) {
            handshakeTriggered += 1;
            handshakeReady = {
              entryTs: Math.max(btcTs, ethTs),
              delayMinutes: Math.abs(btcTs - ethTs) / 60_000,
              btcConfirmTs: btcTs,
              ethConfirmTs: ethTs,
            };
          } else {
            handshakeMissedTiming += 1;
          }
        }

        for (const variant of VARIANT_CONFIGS) {
          if (variant.entryMode === "independent") {
            for (const symbol of SYMBOLS) {
              if (weeklyEntries[variant.key][symbol] >= MAX_ENTRIES_PER_SYMBOL_PER_WEEK) continue;
              const pack = signalBySymbol.get(symbol);
              if (!pack) continue;

              const plan = planTradeFromSignal({
                strategy: variant.key,
                entryMode: variant.entryMode,
                riskModel: variant.riskModel,
                signal: pack.signal,
                candles: candlesBySymbol[symbol],
                sessionIndices: pack.sessionIndices,
                scalingExitIndices: variant.scalingHoldOvernight ? weekIndicesBySymbol[symbol] : pack.sessionIndices,
                scalingNoTriggerExitReason: variant.scalingHoldOvernight ? "WEEK_CLOSE" : "EOD_CLOSE",
                diagnostics: pack.diagnostics,
              });
              if (!plan) {
                primarySkippedStopTooWide += pack.diagnostics.skippedStopTooWide;
                continue;
              }

              primarySkippedStopTooWide += pack.diagnostics.skippedStopTooWide;
              plansByStrategy[variant.key].push(plan);
            }
          } else {
            if (!handshakeReady || !btcSignal || !ethSignal) continue;
            if (weeklyEntries[variant.key].BTC >= MAX_ENTRIES_PER_SYMBOL_PER_WEEK) continue;
            if (weeklyEntries[variant.key].ETH >= MAX_ENTRIES_PER_SYMBOL_PER_WEEK) continue;

            const entryTs = handshakeReady.entryTs;
            const fundingAtEntry: Record<"BTC" | "ETH", number | null> = {
              BTC: getFundingRateAtTs(fundingBySymbol.BTC ?? [], entryTs),
              ETH: getFundingRateAtTs(fundingBySymbol.ETH ?? [], entryTs),
            };
            const oiDeltaAtEntry: Record<"BTC" | "ETH", number | null> = {
              BTC: calcOiDeltaProxyPct(candlesBySymbol.BTC, entryTs),
              ETH: calcOiDeltaProxyPct(candlesBySymbol.ETH, entryTs),
            };
            const fundingPassBySymbol: Record<"BTC" | "ETH", boolean> = {
              BTC: passesFundingFilter(btcSignal.signal.direction, fundingAtEntry.BTC),
              ETH: passesFundingFilter(ethSignal.signal.direction, fundingAtEntry.ETH),
            };
            const oiPassBySymbol: Record<"BTC" | "ETH", boolean> = {
              BTC: passesOiFilter(oiDeltaAtEntry.BTC),
              ETH: passesOiFilter(oiDeltaAtEntry.ETH),
            };
            const fundingReversePassBySymbol: Record<"BTC" | "ETH", boolean> = {
              BTC: passesFundingFilterReverse(btcSignal.signal.direction, fundingAtEntry.BTC),
              ETH: passesFundingFilterReverse(ethSignal.signal.direction, fundingAtEntry.ETH),
            };
            const oiReversePassBySymbol: Record<"BTC" | "ETH", boolean> = {
              BTC: passesOiFilterReverse(oiDeltaAtEntry.BTC),
              ETH: passesOiFilterReverse(oiDeltaAtEntry.ETH),
            };

            const filterMode = variant.filterMode ?? "none";
            let pairPasses = true;
            if (filterMode === "funding") {
              pairPasses = fundingPassBySymbol.BTC && fundingPassBySymbol.ETH;
            } else if (filterMode === "oi") {
              pairPasses = oiPassBySymbol.BTC && oiPassBySymbol.ETH;
            } else if (filterMode === "funding_oi") {
              pairPasses = fundingPassBySymbol.BTC && fundingPassBySymbol.ETH && oiPassBySymbol.BTC && oiPassBySymbol.ETH;
            } else if (filterMode === "funding_reverse") {
              pairPasses = fundingReversePassBySymbol.BTC && fundingReversePassBySymbol.ETH;
            } else if (filterMode === "oi_reverse") {
              pairPasses = oiReversePassBySymbol.BTC && oiReversePassBySymbol.ETH;
            } else if (filterMode === "funding_oi_reverse") {
              pairPasses = fundingReversePassBySymbol.BTC && fundingReversePassBySymbol.ETH && oiReversePassBySymbol.BTC && oiReversePassBySymbol.ETH;
            }

            if (!pairPasses) {
              const perSymbol = [
                {
                  symbol: "BTC" as const,
                  ownFundingPass: fundingPassBySymbol.BTC,
                  ownOiPass: oiPassBySymbol.BTC,
                  ownFundingReversePass: fundingReversePassBySymbol.BTC,
                  ownOiReversePass: oiReversePassBySymbol.BTC,
                  fundingRate: fundingAtEntry.BTC,
                  oiDeltaPct: oiDeltaAtEntry.BTC,
                },
                {
                  symbol: "ETH" as const,
                  ownFundingPass: fundingPassBySymbol.ETH,
                  ownOiPass: oiPassBySymbol.ETH,
                  ownFundingReversePass: fundingReversePassBySymbol.ETH,
                  ownOiReversePass: oiReversePassBySymbol.ETH,
                  fundingRate: fundingAtEntry.ETH,
                  oiDeltaPct: oiDeltaAtEntry.ETH,
                },
              ];
              for (const row of perSymbol) {
                const key = buildCTradeKey(weekOpenUtc, dayUtc, sessionDef.sessionWindow, row.symbol, entryTs);
                if (filterMode === "funding") {
                  filteredFundingRows.push({
                    key,
                    symbol: row.symbol,
                    week_open_utc: weekOpenUtc,
                    day_utc: dayUtc,
                    session_window: sessionDef.sessionWindow,
                    entry_time_utc: toUtcIso(entryTs),
                    funding_rate: row.fundingRate,
                    fail_reason: row.ownFundingPass ? "pair_fail" : "self_fail",
                  });
                } else if (filterMode === "oi") {
                  filteredOiRows.push({
                    key,
                    symbol: row.symbol,
                    week_open_utc: weekOpenUtc,
                    day_utc: dayUtc,
                    session_window: sessionDef.sessionWindow,
                    entry_time_utc: toUtcIso(entryTs),
                    oi_delta_pct: row.oiDeltaPct,
                    fail_reason: row.ownOiPass ? "pair_fail" : "self_fail",
                  });
                } else if (filterMode === "funding_oi") {
                  const ownPass = row.ownFundingPass && row.ownOiPass;
                  filteredBothRows.push({
                    key,
                    symbol: row.symbol,
                    week_open_utc: weekOpenUtc,
                    day_utc: dayUtc,
                    session_window: sessionDef.sessionWindow,
                    entry_time_utc: toUtcIso(entryTs),
                    funding_rate: row.fundingRate,
                    oi_delta_pct: row.oiDeltaPct,
                    fail_reason: ownPass ? "pair_fail" : "self_fail",
                  });
                } else if (filterMode === "funding_reverse") {
                  filteredFundingReverseRows.push({
                    key,
                    symbol: row.symbol,
                    week_open_utc: weekOpenUtc,
                    day_utc: dayUtc,
                    session_window: sessionDef.sessionWindow,
                    entry_time_utc: toUtcIso(entryTs),
                    funding_rate: row.fundingRate,
                    fail_reason: row.ownFundingReversePass ? "pair_fail" : "self_fail",
                  });
                } else if (filterMode === "oi_reverse") {
                  filteredOiReverseRows.push({
                    key,
                    symbol: row.symbol,
                    week_open_utc: weekOpenUtc,
                    day_utc: dayUtc,
                    session_window: sessionDef.sessionWindow,
                    entry_time_utc: toUtcIso(entryTs),
                    oi_delta_pct: row.oiDeltaPct,
                    fail_reason: row.ownOiReversePass ? "pair_fail" : "self_fail",
                  });
                } else if (filterMode === "funding_oi_reverse") {
                  const ownPass = row.ownFundingReversePass && row.ownOiReversePass;
                  filteredBothReverseRows.push({
                    key,
                    symbol: row.symbol,
                    week_open_utc: weekOpenUtc,
                    day_utc: dayUtc,
                    session_window: sessionDef.sessionWindow,
                    entry_time_utc: toUtcIso(entryTs),
                    funding_rate: row.fundingRate,
                    oi_delta_pct: row.oiDeltaPct,
                    fail_reason: ownPass ? "pair_fail" : "self_fail",
                  });
                }
              }
              continue;
            }

            const btcPlan = planTradeFromSignal({
              strategy: variant.key,
              entryMode: variant.entryMode,
              riskModel: variant.riskModel,
              signal: btcSignal.signal,
              candles: candlesBySymbol.BTC,
              sessionIndices: btcSignal.sessionIndices,
              scalingExitIndices: variant.scalingHoldOvernight ? weekIndicesBySymbol.BTC : btcSignal.sessionIndices,
              scalingNoTriggerExitReason: variant.scalingHoldOvernight ? "WEEK_CLOSE" : "EOD_CLOSE",
              entryTsOverride: handshakeReady.entryTs,
              gateSource: "core_handshake",
              handshakePartnerSymbol: "ETH",
              handshakeDelayMinutes: handshakeReady.delayMinutes,
              diagnostics: btcSignal.diagnostics,
            });

            const ethPlan = planTradeFromSignal({
              strategy: variant.key,
              entryMode: variant.entryMode,
              riskModel: variant.riskModel,
              signal: ethSignal.signal,
              candles: candlesBySymbol.ETH,
              sessionIndices: ethSignal.sessionIndices,
              scalingExitIndices: variant.scalingHoldOvernight ? weekIndicesBySymbol.ETH : ethSignal.sessionIndices,
              scalingNoTriggerExitReason: variant.scalingHoldOvernight ? "WEEK_CLOSE" : "EOD_CLOSE",
              entryTsOverride: handshakeReady.entryTs,
              gateSource: "core_handshake",
              handshakePartnerSymbol: "BTC",
              handshakeDelayMinutes: handshakeReady.delayMinutes,
              diagnostics: ethSignal.diagnostics,
            });

            primarySkippedStopTooWide += btcSignal.diagnostics.skippedStopTooWide + ethSignal.diagnostics.skippedStopTooWide;

            if (btcPlan && ethPlan) {
              plansByStrategy[variant.key].push(btcPlan, ethPlan);
            }
          }
        }

        if (handshakeReady && btcSignal && ethSignal) {
          altCoreHandshakeOpportunities += 1;

          if (
            weeklyEntries.K_3way_handshake_scaling_overnight_alts.BTC < MAX_ENTRIES_PER_SYMBOL_PER_WEEK
            && weeklyEntries.K_3way_handshake_scaling_overnight_alts.ETH < MAX_ENTRIES_PER_SYMBOL_PER_WEEK
          ) {
            const btcPlanK = planTradeFromSignal({
              strategy: "K_3way_handshake_scaling_overnight_alts",
              entryMode: "handshake",
              riskModel: "scaling",
              signal: btcSignal.signal,
              candles: candlesBySymbol.BTC,
              sessionIndices: btcSignal.sessionIndices,
              scalingExitIndices: weekIndicesBySymbol.BTC,
              scalingNoTriggerExitReason: "WEEK_CLOSE",
              entryTsOverride: handshakeReady.entryTs,
              gateSource: "core_handshake",
              handshakePartnerSymbol: "ETH",
              handshakeDelayMinutes: handshakeReady.delayMinutes,
              diagnostics: btcSignal.diagnostics,
            });

            const ethPlanK = planTradeFromSignal({
              strategy: "K_3way_handshake_scaling_overnight_alts",
              entryMode: "handshake",
              riskModel: "scaling",
              signal: ethSignal.signal,
              candles: candlesBySymbol.ETH,
              sessionIndices: ethSignal.sessionIndices,
              scalingExitIndices: weekIndicesBySymbol.ETH,
              scalingNoTriggerExitReason: "WEEK_CLOSE",
              entryTsOverride: handshakeReady.entryTs,
              gateSource: "core_handshake",
              handshakePartnerSymbol: "BTC",
              handshakeDelayMinutes: handshakeReady.delayMinutes,
              diagnostics: ethSignal.diagnostics,
            });

            if (btcPlanK && ethPlanK) {
              plansByStrategy.K_3way_handshake_scaling_overnight_alts.push(btcPlanK, ethPlanK);
            }
          }

          if (biases.BTC.bias !== "NEUTRAL") {
            const altCandidates: PlannedTrade[] = [];
            for (const altSymbol of activeAltSymbols) {
              if (weeklyEntries.K_3way_handshake_scaling_overnight_alts[altSymbol] >= MAX_ENTRIES_PER_SYMBOL_PER_WEEK) continue;

              const candles = candlesBySymbol[altSymbol];
              if (!candles.length) continue;

              const range = sessionDef.rangeForSymbol(altSymbol);
              const indices = sessionDef.sessionIndicesForSymbol(altSymbol);
              if (!range?.locked || !indices.length) continue;

              const detected = detectSignalForWindow({
                symbol: altSymbol,
                weekOpenUtc,
                dayUtc,
                candles,
                sessionIndices: indices,
                range,
                bias: biases.BTC,
                sessionWindow: sessionDef.sessionWindow,
                rangeSource: sessionDef.rangeSource,
                entrySession: sessionDef.entrySession,
              });

              if (!detected.signal) continue;
              altSignalsBySymbol[altSymbol] += 1;

              const altConfirmTs = candles[detected.signal.confirmIdx]?.ts;
              if (!Number.isFinite(altConfirmTs)) continue;

              const startsAfterEth = altConfirmTs >= handshakeReady.ethConfirmTs;
              const insideWindow = startsAfterEth && altConfirmTs <= handshakeReady.ethConfirmTs + ALT_HANDSHAKE_WINDOW_MS;
              if (!insideWindow) {
                altSignalsMissedWindowBySymbol[altSymbol] += 1;
                continue;
              }

              altSignalsWithinWindowBySymbol[altSymbol] += 1;

              const spikeMeta = buildAltEntrySpike({
                altCandles: candles,
                altEntryIndex: detected.signal.confirmIdx,
                altWeekIndices: weekIndicesBySymbol[altSymbol],
                btcCandles: candlesBySymbol.BTC,
              });

              const altPlan = planTradeFromSignal({
                strategy: "K_3way_handshake_scaling_overnight_alts",
                entryMode: "independent",
                riskModel: "scaling",
                signal: detected.signal,
                candles,
                sessionIndices: indices,
                scalingExitIndices: weekIndicesBySymbol[altSymbol],
                scalingNoTriggerExitReason: "WEEK_CLOSE",
                allocationPctOverride: ALT_ALLOCATION_PCT,
                gateSource: "3way_handshake",
                spikeMeta,
                handshakePartnerSymbol: "ETH",
                handshakeDelayMinutes: (altConfirmTs - handshakeReady.ethConfirmTs) / 60_000,
                diagnostics: detected.diagnostics,
              });
              if (altPlan) altCandidates.push(altPlan);
            }

            altCandidates.sort((a, b) => a.entryTs - b.entryTs);
            let added = 0;
            for (const plan of altCandidates) {
              if (added >= MAX_ALT_POSITIONS) break;
              plansByStrategy.K_3way_handshake_scaling_overnight_alts.push(plan);
              added += 1;
            }
          }
        }
      }

      for (const symbol of SYMBOLS) {
        if (weeklyEntries.daily_ny_open_short[symbol] >= MAX_ENTRIES_PER_SYMBOL_PER_WEEK) continue;
        const candles = candlesBySymbol[symbol];
        if (!candles.length) continue;
        const nyIdx = nyCandleIndicesForDay(candles, dayUtc);
        const baselinePlan = planBaselineTradeForDay({
          symbol,
          weekOpenUtc,
          dayUtc,
          candles,
          nyIndices: nyIdx,
          bias: biases[symbol],
        });
        if (baselinePlan) plansByStrategy.daily_ny_open_short.push(baselinePlan);
      }

      for (const key of ALL_STRATEGY_KEYS) {
        const state = strategyState[key];
        const exec = executePlannedTrades(plansByStrategy[key], state.balance, state.tradeId);
        state.balance = exec.endingBalance;
        state.tradeId = exec.nextTradeId;
        state.trades.push(...exec.closed);

        if (key === primaryStrategy) primarySkippedNoBalance += exec.skippedNoBalance;

        for (const t of exec.closed) {
          weeklyEntries[key][t.symbol] += 1;
          if (key === primaryStrategy) {
            if (t.pnl_usd > 0) weekWins += 1;
            else weekLosses += 1;
          }
        }

        if (state.balance > state.peak) state.peak = state.balance;
        else if (state.peak > 0) state.maxDd = Math.max(state.maxDd, ((state.peak - state.balance) / state.peak) * 100);
      }
    }

    const primaryWeekTrades = strategyState[primaryStrategy].trades.filter((t) => t.week_open_utc === weekOpenUtc);
    const weeklyReturnPct = weekStartPrimary > 0 ? ((strategyState[primaryStrategy].balance - weekStartPrimary) / weekStartPrimary) * 100 : 0;
    const cumulativeReturnPct = STARTING_BALANCE_USD > 0 ? ((strategyState[primaryStrategy].balance - STARTING_BALANCE_USD) / STARTING_BALANCE_USD) * 100 : 0;

    weeklyRows.push({
      week_open_utc: weekOpenUtc,
      week_label_et: weekOpen.setZone("America/New_York").toFormat("yyyy-LL-dd HH:mm 'ET'"),
      btc_bias: `${biases.BTC.tier} ${biases.BTC.bias}`,
      eth_bias: `${biases.ETH.tier} ${biases.ETH.bias}`,
      confidence: `BTC ${biases.BTC.votes.long}/${biases.BTC.votes.short}/${biases.BTC.votes.neutral}; ETH ${biases.ETH.votes.long}/${biases.ETH.votes.short}/${biases.ETH.votes.neutral}`,
      entries: primaryWeekTrades.length,
      win_loss: `${weekWins}/${weekLosses}`,
      weekly_return_pct: round(weeklyReturnPct),
      cumulative_return_pct: round(cumulativeReturnPct),
    });
  }

  const allTrades = (Object.values(strategyState).flatMap((s) => s.trades))
    .sort((a, b) => a.entry_time_utc.localeCompare(b.entry_time_utc))
    .map((t, idx) => ({ ...t, id: idx + 1 }));

  const totalsA = computeStrategyTotals(strategyState.A_handshake_current_risk.trades, STARTING_BALANCE_USD, strategyState.A_handshake_current_risk.balance, strategyState.A_handshake_current_risk.maxDd, weekOpens.length);
  const totalsB = computeStrategyTotals(strategyState.B_independent_scaling_risk.trades, STARTING_BALANCE_USD, strategyState.B_independent_scaling_risk.balance, strategyState.B_independent_scaling_risk.maxDd, weekOpens.length);
  const totalsC = computeStrategyTotals(strategyState.C_handshake_scaling_risk.trades, STARTING_BALANCE_USD, strategyState.C_handshake_scaling_risk.balance, strategyState.C_handshake_scaling_risk.maxDd, weekOpens.length);
  const totalsE = computeStrategyTotals(strategyState.E_handshake_scaling_overnight_funding.trades, STARTING_BALANCE_USD, strategyState.E_handshake_scaling_overnight_funding.balance, strategyState.E_handshake_scaling_overnight_funding.maxDd, weekOpens.length);
  const totalsF = computeStrategyTotals(strategyState.F_handshake_scaling_overnight_oi.trades, STARTING_BALANCE_USD, strategyState.F_handshake_scaling_overnight_oi.balance, strategyState.F_handshake_scaling_overnight_oi.maxDd, weekOpens.length);
  const totalsG = computeStrategyTotals(strategyState.G_handshake_scaling_overnight_funding_oi.trades, STARTING_BALANCE_USD, strategyState.G_handshake_scaling_overnight_funding_oi.balance, strategyState.G_handshake_scaling_overnight_funding_oi.maxDd, weekOpens.length);
  const totalsH = computeStrategyTotals(strategyState.H_handshake_scaling_overnight_funding_reverse.trades, STARTING_BALANCE_USD, strategyState.H_handshake_scaling_overnight_funding_reverse.balance, strategyState.H_handshake_scaling_overnight_funding_reverse.maxDd, weekOpens.length);
  const totalsI = computeStrategyTotals(strategyState.I_handshake_scaling_overnight_oi_reverse.trades, STARTING_BALANCE_USD, strategyState.I_handshake_scaling_overnight_oi_reverse.balance, strategyState.I_handshake_scaling_overnight_oi_reverse.maxDd, weekOpens.length);
  const totalsJ = computeStrategyTotals(strategyState.J_handshake_scaling_overnight_funding_oi_reverse.trades, STARTING_BALANCE_USD, strategyState.J_handshake_scaling_overnight_funding_oi_reverse.balance, strategyState.J_handshake_scaling_overnight_funding_oi_reverse.maxDd, weekOpens.length);
  const totalsK = computeStrategyTotals(strategyState.K_3way_handshake_scaling_overnight_alts.trades, STARTING_BALANCE_USD, strategyState.K_3way_handshake_scaling_overnight_alts.balance, strategyState.K_3way_handshake_scaling_overnight_alts.maxDd, weekOpens.length);
  const totalsD = computeStrategyTotals(strategyState.D_v3_baseline_independent_current_risk.trades, STARTING_BALANCE_USD, strategyState.D_v3_baseline_independent_current_risk.balance, strategyState.D_v3_baseline_independent_current_risk.maxDd, weekOpens.length);
  const totalsL = computeStrategyTotals(strategyState.L_weekly_bias_hold_scaling.trades, STARTING_BALANCE_USD, strategyState.L_weekly_bias_hold_scaling.balance, strategyState.L_weekly_bias_hold_scaling.maxDd, weekOpens.length);
  const totalsBaseline = computeStrategyTotals(strategyState.daily_ny_open_short.trades, STARTING_BALANCE_USD, strategyState.daily_ny_open_short.balance, strategyState.daily_ny_open_short.maxDd, weekOpens.length);

  const primaryTrades = strategyState[primaryStrategy].trades;
  const dayOrder = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const dayBreakdown = dayOrder.map((day) => {
    const rows = primaryTrades.filter((t) => weekdayName(t.day_utc) === day);
    const rowWins = rows.filter((t) => t.pnl_usd > 0).length;
    return {
      day,
      trades: rows.length,
      win_rate_pct: rows.length ? (rowWins / rows.length) * 100 : 0,
      total_pnl_usd: rows.reduce((s, t) => s + t.pnl_usd, 0),
      avg_r_multiple: rows.length ? rows.reduce((s, t) => s + t.r_multiple, 0) / rows.length : 0,
    };
  });

  function milestoneRows(strategy: StrategyKey) {
    const rows = strategyState[strategy].trades;
    const denom = rows.length || 1;
    return [
      { milestone: "+1.0% (->10x)", lvl: 1 },
      { milestone: "+2.0% (->25x, breakeven)", lvl: 2 },
      { milestone: "+3.0% (->50x, trailing)", lvl: 3 },
      { milestone: "+4.0% (->75x cap)", lvl: 4 },
    ].map((m) => {
      const times = rows.filter((t) => t.milestones_hit.includes(m.lvl)).length;
      return { milestone: m.milestone, times, pct_of_trades: (times / denom) * 100 };
    });
  }

  const cTradeMap = new Map<string, ClosedTrade>();
  for (const t of strategyState.C_handshake_scaling_risk.trades) {
    const entryTs = Date.parse(t.entry_time_utc);
    if (!Number.isFinite(entryTs)) continue;
    cTradeMap.set(
      buildCTradeKey(t.week_open_utc, t.day_utc, t.session_window, t.symbol, entryTs),
      t,
    );
  }

  function summarizeFilteredRows<T extends {
    key: string;
    symbol: SymbolBase;
    week_open_utc: string;
    day_utc: string;
    session_window: SessionWindow;
    entry_time_utc: string;
    fail_reason: FilterFailReason;
  }>(rows: T[]) {
    const annotated = rows.map((row) => {
      const cTrade = cTradeMap.get(row.key);
      let cOutcome: COutcome = "MISSING";
      if (cTrade) {
        if (cTrade.pnl_usd > 0) cOutcome = "WIN";
        else if (cTrade.pnl_usd < 0) cOutcome = "LOSS";
        else cOutcome = "FLAT";
      }
      return {
        ...row,
        c_outcome: cOutcome,
        c_pnl_usd: cTrade?.pnl_usd ?? null,
      };
    });

    return {
      rows: annotated,
      filtered_count: annotated.length,
      removed_wins: annotated.filter((r) => r.c_outcome === "WIN").length,
      removed_losses: annotated.filter((r) => r.c_outcome === "LOSS").length,
      removed_flats: annotated.filter((r) => r.c_outcome === "FLAT").length,
    };
  }

  const fundingFilterSummary = summarizeFilteredRows(filteredFundingRows);
  const oiFilterSummary = summarizeFilteredRows(filteredOiRows);
  const bothFilterSummary = summarizeFilteredRows(filteredBothRows);
  const fundingReverseFilterSummary = summarizeFilteredRows(filteredFundingReverseRows);
  const oiReverseFilterSummary = summarizeFilteredRows(filteredOiReverseRows);
  const bothReverseFilterSummary = summarizeFilteredRows(filteredBothReverseRows);

  const handshakeOpps = handshakeTriggered + handshakeMissedSingle + handshakeMissedTiming;
  const altTriggerRateBySymbolPct = makeSymbolCounter();
  for (const symbol of altList.allSymbols) {
    altTriggerRateBySymbolPct[symbol] = altCoreHandshakeOpportunities > 0
      ? (altSignalsWithinWindowBySymbol[symbol] / altCoreHandshakeOpportunities) * 100
      : 0;
  }
  const kAltTrades = strategyState.K_3way_handshake_scaling_overnight_alts.trades.filter((t) => altList.allSymbols.includes(t.symbol));
  const altPerformance = altList.allSymbols.map((symbol) => {
    const rows = kAltTrades.filter((t) => t.symbol === symbol);
    const wins = rows.filter((t) => t.pnl_usd > 0).length;
    return {
      symbol,
      signals: altSignalsBySymbol[symbol],
      entries: rows.length,
      win_rate_pct: rows.length ? (wins / rows.length) * 100 : 0,
      net_pnl_usd: rows.reduce((sum, row) => sum + row.pnl_usd, 0),
      avg_unlevered_pnl_pct: rows.length ? rows.reduce((sum, row) => sum + row.unlevered_pnl_pct, 0) / rows.length : 0,
    };
  });
  const altSessionBreakdown = [
    "ASIA_LONDON_RANGE_NY_ENTRY" as SessionWindow,
    "US_RANGE_ASIA_LONDON_ENTRY" as SessionWindow,
  ].map((windowName) => {
    const rows = kAltTrades.filter((t) => t.session_window === windowName);
    const wins = rows.filter((t) => t.pnl_usd > 0).length;
    return {
      session_window: windowName,
      trades: rows.length,
      win_rate_pct: rows.length ? (wins / rows.length) * 100 : 0,
      total_pnl_usd: rows.reduce((sum, row) => sum + row.pnl_usd, 0),
      avg_r_multiple: rows.length ? rows.reduce((sum, row) => sum + row.r_multiple, 0) / rows.length : 0,
    };
  });

  const recommendations: string[] = [];
  if (totalsC.totalReturnPct > totalsD.totalReturnPct) recommendations.push("Handshake + scaling outperformed v3 baseline in this sample.");
  else recommendations.push("Handshake + scaling did not beat v3 baseline; refine entry coupling or risk ladder.");
  if (totalsE.totalReturnPct > totalsC.totalReturnPct) recommendations.push("Funding filter improved C returns in this sample.");
  else recommendations.push("Funding filter did not improve C returns in this sample.");
  if (totalsF.totalReturnPct > totalsC.totalReturnPct) recommendations.push("OI delta filter improved C returns in this sample.");
  else recommendations.push("OI delta filter did not improve C returns in this sample.");
  if (totalsG.totalReturnPct > totalsC.totalReturnPct) recommendations.push("Combined funding + OI filters improved C returns in this sample.");
  else recommendations.push("Combined funding + OI filters did not improve C returns in this sample.");
  if (totalsH.totalReturnPct > totalsC.totalReturnPct) recommendations.push("Funding reverse filter improved C returns in this sample.");
  else recommendations.push("Funding reverse filter did not improve C returns in this sample.");
  if (totalsI.totalReturnPct > totalsC.totalReturnPct) recommendations.push("OI reverse filter improved C returns in this sample.");
  else recommendations.push("OI reverse filter did not improve C returns in this sample.");
  if (totalsJ.totalReturnPct > totalsC.totalReturnPct) recommendations.push("Combined funding + OI reverse filters improved C returns in this sample.");
  else recommendations.push("Combined funding + OI reverse filters did not improve C returns in this sample.");
  if (totalsK.totalReturnPct > totalsC.totalReturnPct) recommendations.push("3-way alt expansion outperformed core C strategy in this sample.");
  else recommendations.push("3-way alt expansion did not outperform core C strategy in this sample.");
  if (totalsL.totalReturnPct > totalsC.totalReturnPct) recommendations.push("Weekly bias hold outperformed C; entry timing edge remains unproven.");
  else recommendations.push("C outperformed weekly bias hold; sweep/handshake timing adds value in this sample.");
  if (totalsA.totalReturnPct > totalsD.totalReturnPct) recommendations.push("Handshake alone added value versus independent current-risk entries.");
  else recommendations.push("Handshake alone did not improve current-risk performance.");
  if (totalsB.totalReturnPct > totalsD.totalReturnPct) recommendations.push("Scaling risk model improved independent entries.");
  else recommendations.push("Scaling model underperformed with independent entries; test narrower initial stop or lower initial leverage.");
  if (handshakeTriggered === 0) recommendations.push("Handshake trigger frequency is too low; widen timing tolerance or refine signal alignment.");
  if (primarySkippedStopTooWide > 0) recommendations.push("Current-risk variants still skip trades on stop width; volatility prefilter may help.");
  recommendations.push("Next risk test: compare 5x vs 2.5x initial leverage for scaling model.");

  const output: BacktestOutput = {
    generated_utc: DateTime.utc().toISO() ?? new Date().toISOString(),
    alt_symbols_source: altList.source,
    alt_symbols_used: altList.allSymbols,
    alt_symbols_by_week: altSymbolsByWeek,
    weeks: weekOpens,
    weekly: weeklyRows,
    trades: allTrades,
    baseline_comparison: {
      A_handshake_current_risk: {
        totalReturnPct: round(totalsA.totalReturnPct),
        winRatePct: round(totalsA.winRatePct),
        avgR: round(totalsA.avgR),
        maxDrawdownPct: round(totalsA.maxDrawdownPct),
        trades: totalsA.trades,
        tradesPerWeek: round(totalsA.tradesPerWeek),
      },
      B_independent_scaling_risk: {
        totalReturnPct: round(totalsB.totalReturnPct),
        winRatePct: round(totalsB.winRatePct),
        avgR: round(totalsB.avgR),
        maxDrawdownPct: round(totalsB.maxDrawdownPct),
        trades: totalsB.trades,
        tradesPerWeek: round(totalsB.tradesPerWeek),
      },
      C_handshake_scaling_risk: {
        totalReturnPct: round(totalsC.totalReturnPct),
        winRatePct: round(totalsC.winRatePct),
        avgR: round(totalsC.avgR),
        maxDrawdownPct: round(totalsC.maxDrawdownPct),
        trades: totalsC.trades,
        tradesPerWeek: round(totalsC.tradesPerWeek),
      },
      E_handshake_scaling_overnight_funding: {
        totalReturnPct: round(totalsE.totalReturnPct),
        winRatePct: round(totalsE.winRatePct),
        avgR: round(totalsE.avgR),
        maxDrawdownPct: round(totalsE.maxDrawdownPct),
        trades: totalsE.trades,
        tradesPerWeek: round(totalsE.tradesPerWeek),
      },
      F_handshake_scaling_overnight_oi: {
        totalReturnPct: round(totalsF.totalReturnPct),
        winRatePct: round(totalsF.winRatePct),
        avgR: round(totalsF.avgR),
        maxDrawdownPct: round(totalsF.maxDrawdownPct),
        trades: totalsF.trades,
        tradesPerWeek: round(totalsF.tradesPerWeek),
      },
      G_handshake_scaling_overnight_funding_oi: {
        totalReturnPct: round(totalsG.totalReturnPct),
        winRatePct: round(totalsG.winRatePct),
        avgR: round(totalsG.avgR),
        maxDrawdownPct: round(totalsG.maxDrawdownPct),
        trades: totalsG.trades,
        tradesPerWeek: round(totalsG.tradesPerWeek),
      },
      H_handshake_scaling_overnight_funding_reverse: {
        totalReturnPct: round(totalsH.totalReturnPct),
        winRatePct: round(totalsH.winRatePct),
        avgR: round(totalsH.avgR),
        maxDrawdownPct: round(totalsH.maxDrawdownPct),
        trades: totalsH.trades,
        tradesPerWeek: round(totalsH.tradesPerWeek),
      },
      I_handshake_scaling_overnight_oi_reverse: {
        totalReturnPct: round(totalsI.totalReturnPct),
        winRatePct: round(totalsI.winRatePct),
        avgR: round(totalsI.avgR),
        maxDrawdownPct: round(totalsI.maxDrawdownPct),
        trades: totalsI.trades,
        tradesPerWeek: round(totalsI.tradesPerWeek),
      },
      J_handshake_scaling_overnight_funding_oi_reverse: {
        totalReturnPct: round(totalsJ.totalReturnPct),
        winRatePct: round(totalsJ.winRatePct),
        avgR: round(totalsJ.avgR),
        maxDrawdownPct: round(totalsJ.maxDrawdownPct),
        trades: totalsJ.trades,
        tradesPerWeek: round(totalsJ.tradesPerWeek),
      },
      K_3way_handshake_scaling_overnight_alts: {
        totalReturnPct: round(totalsK.totalReturnPct),
        winRatePct: round(totalsK.winRatePct),
        avgR: round(totalsK.avgR),
        maxDrawdownPct: round(totalsK.maxDrawdownPct),
        trades: totalsK.trades,
        tradesPerWeek: round(totalsK.tradesPerWeek),
      },
      D_v3_baseline_independent_current_risk: {
        totalReturnPct: round(totalsD.totalReturnPct),
        winRatePct: round(totalsD.winRatePct),
        avgR: round(totalsD.avgR),
        maxDrawdownPct: round(totalsD.maxDrawdownPct),
        trades: totalsD.trades,
        tradesPerWeek: round(totalsD.tradesPerWeek),
      },
      L_weekly_bias_hold_scaling: {
        totalReturnPct: round(totalsL.totalReturnPct),
        winRatePct: round(totalsL.winRatePct),
        avgR: round(totalsL.avgR),
        maxDrawdownPct: round(totalsL.maxDrawdownPct),
        trades: totalsL.trades,
        tradesPerWeek: round(totalsL.tradesPerWeek),
      },
      daily_ny_open_short: {
        totalReturnPct: round(totalsBaseline.totalReturnPct),
        winRatePct: round(totalsBaseline.winRatePct),
        avgR: round(totalsBaseline.avgR),
        maxDrawdownPct: round(totalsBaseline.maxDrawdownPct),
        trades: totalsBaseline.trades,
        tradesPerWeek: round(totalsBaseline.tradesPerWeek),
      },
    },
    handshake_diagnostics: {
      triggered: handshakeTriggered,
      missed_single: handshakeMissedSingle,
      missed_timing: handshakeMissedTiming,
      trigger_rate_pct: handshakeOpps > 0 ? (handshakeTriggered / handshakeOpps) * 100 : 0,
    },
    scaling_milestones: {
      B_independent_scaling_risk: milestoneRows("B_independent_scaling_risk").map((r) => ({
        milestone: r.milestone,
        times: r.times,
        pct_of_trades: round(r.pct_of_trades),
      })),
      C_handshake_scaling_risk: milestoneRows("C_handshake_scaling_risk").map((r) => ({
        milestone: r.milestone,
        times: r.times,
        pct_of_trades: round(r.pct_of_trades),
      })),
      E_handshake_scaling_overnight_funding: milestoneRows("E_handshake_scaling_overnight_funding").map((r) => ({
        milestone: r.milestone,
        times: r.times,
        pct_of_trades: round(r.pct_of_trades),
      })),
      F_handshake_scaling_overnight_oi: milestoneRows("F_handshake_scaling_overnight_oi").map((r) => ({
        milestone: r.milestone,
        times: r.times,
        pct_of_trades: round(r.pct_of_trades),
      })),
      G_handshake_scaling_overnight_funding_oi: milestoneRows("G_handshake_scaling_overnight_funding_oi").map((r) => ({
        milestone: r.milestone,
        times: r.times,
        pct_of_trades: round(r.pct_of_trades),
      })),
      H_handshake_scaling_overnight_funding_reverse: milestoneRows("H_handshake_scaling_overnight_funding_reverse").map((r) => ({
        milestone: r.milestone,
        times: r.times,
        pct_of_trades: round(r.pct_of_trades),
      })),
      I_handshake_scaling_overnight_oi_reverse: milestoneRows("I_handshake_scaling_overnight_oi_reverse").map((r) => ({
        milestone: r.milestone,
        times: r.times,
        pct_of_trades: round(r.pct_of_trades),
      })),
      J_handshake_scaling_overnight_funding_oi_reverse: milestoneRows("J_handshake_scaling_overnight_funding_oi_reverse").map((r) => ({
        milestone: r.milestone,
        times: r.times,
        pct_of_trades: round(r.pct_of_trades),
      })),
      K_3way_handshake_scaling_overnight_alts: milestoneRows("K_3way_handshake_scaling_overnight_alts").map((r) => ({
        milestone: r.milestone,
        times: r.times,
        pct_of_trades: round(r.pct_of_trades),
      })),
      L_weekly_bias_hold_scaling: milestoneRows("L_weekly_bias_hold_scaling").map((r) => ({
        milestone: r.milestone,
        times: r.times,
        pct_of_trades: round(r.pct_of_trades),
      })),
    },
    alt_3way_diagnostics: {
      total_core_handshakes: altCoreHandshakeOpportunities,
      within_window_by_symbol: altSignalsWithinWindowBySymbol,
      missed_window_by_symbol: altSignalsMissedWindowBySymbol,
      trigger_rate_by_symbol_pct: altTriggerRateBySymbolPct,
      missing_or_sparse_weeks: altMissingOrSparseWeeks,
    },
    alt_performance: altPerformance.map((row) => ({
      symbol: row.symbol,
      signals: row.signals,
      entries: row.entries,
      win_rate_pct: round(row.win_rate_pct),
      net_pnl_usd: round(row.net_pnl_usd),
      avg_unlevered_pnl_pct: round(row.avg_unlevered_pnl_pct),
    })),
    alt_session_breakdown: altSessionBreakdown.map((row) => ({
      session_window: row.session_window,
      trades: row.trades,
      win_rate_pct: round(row.win_rate_pct),
      total_pnl_usd: round(row.total_pnl_usd),
      avg_r_multiple: round(row.avg_r_multiple),
    })),
    tier1_filter_diagnostics: {
      oi_method: "Volume-expansion proxy: ((quoteVolume last 4h - prior 4h) / prior 4h) * 100.",
      funding: fundingFilterSummary,
      oi: oiFilterSummary,
      both: bothFilterSummary,
      funding_reverse: fundingReverseFilterSummary,
      oi_reverse: oiReverseFilterSummary,
      both_reverse: bothReverseFilterSummary,
    },
    metrics_primary: {
      strategy: primaryStrategy,
      total_return_pct: round(totalsD.totalReturnPct),
      win_rate_pct: round(totalsD.winRatePct),
      avg_r_multiple: round(totalsD.avgR),
      max_drawdown_pct: round(totalsD.maxDrawdownPct),
      avg_trades_per_week: round(totalsD.tradesPerWeek),
    },
    day_of_week_breakdown: dayBreakdown.map((r) => ({
      day: r.day,
      trades: r.trades,
      win_rate_pct: round(r.win_rate_pct),
      total_pnl_usd: round(r.total_pnl_usd),
      avg_r_multiple: round(r.avg_r_multiple),
    })),
    data_coverage: {
      sentiment_missing_weeks: sentimentMissingWeeks,
      candle_fetch: candleFetchNotes,
    },
    recommendations,
  };

  const docsDir = path.join(process.cwd(), "docs", "bots");
  mkdirSync(docsDir, { recursive: true });
  writeFileSync(path.join(docsDir, "backtest-trade-log.json"), JSON.stringify(output.trades, null, 2), "utf8");
  writeFileSync(path.join(docsDir, "backtest-weekly-summary.json"), JSON.stringify(output.weekly, null, 2), "utf8");
  writeFileSync(path.join(docsDir, "bitget-v2-backtest-results.md"), buildMarkdownReport(output), "utf8");
  await runSessionGapVariantComparison({
    weekOpens,
    cotHistory,
    fundingBySymbol,
    baselineReference: output.baseline_comparison.C_handshake_scaling_risk,
  });

  const historyPath = path.join(docsDir, "backtest-run-history.json");
  type HistoryEntry = {
    generated_utc: string;
    weeks: string[];
    returns_pct: Record<string, number>;
    max_dd_pct: Record<string, number>;
    trades: Record<string, number>;
  };
  let history: HistoryEntry[] = [];
  try {
    const existing = readFileSync(historyPath, "utf8");
    const parsed = JSON.parse(existing) as HistoryEntry[];
    if (Array.isArray(parsed)) history = parsed;
  } catch {
    history = [];
  }
  history.push({
    generated_utc: output.generated_utc,
    weeks: output.weeks,
    returns_pct: {
      A: round(output.baseline_comparison.A_handshake_current_risk.totalReturnPct),
      B: round(output.baseline_comparison.B_independent_scaling_risk.totalReturnPct),
      C: round(output.baseline_comparison.C_handshake_scaling_risk.totalReturnPct),
      E: round(output.baseline_comparison.E_handshake_scaling_overnight_funding.totalReturnPct),
      F: round(output.baseline_comparison.F_handshake_scaling_overnight_oi.totalReturnPct),
      G: round(output.baseline_comparison.G_handshake_scaling_overnight_funding_oi.totalReturnPct),
      H: round(output.baseline_comparison.H_handshake_scaling_overnight_funding_reverse.totalReturnPct),
      I: round(output.baseline_comparison.I_handshake_scaling_overnight_oi_reverse.totalReturnPct),
      J: round(output.baseline_comparison.J_handshake_scaling_overnight_funding_oi_reverse.totalReturnPct),
      K: round(output.baseline_comparison.K_3way_handshake_scaling_overnight_alts.totalReturnPct),
      D: round(output.baseline_comparison.D_v3_baseline_independent_current_risk.totalReturnPct),
      L: round(output.baseline_comparison.L_weekly_bias_hold_scaling.totalReturnPct),
      Daily: round(output.baseline_comparison.daily_ny_open_short.totalReturnPct),
    },
    max_dd_pct: {
      A: round(output.baseline_comparison.A_handshake_current_risk.maxDrawdownPct),
      B: round(output.baseline_comparison.B_independent_scaling_risk.maxDrawdownPct),
      C: round(output.baseline_comparison.C_handshake_scaling_risk.maxDrawdownPct),
      E: round(output.baseline_comparison.E_handshake_scaling_overnight_funding.maxDrawdownPct),
      F: round(output.baseline_comparison.F_handshake_scaling_overnight_oi.maxDrawdownPct),
      G: round(output.baseline_comparison.G_handshake_scaling_overnight_funding_oi.maxDrawdownPct),
      H: round(output.baseline_comparison.H_handshake_scaling_overnight_funding_reverse.maxDrawdownPct),
      I: round(output.baseline_comparison.I_handshake_scaling_overnight_oi_reverse.maxDrawdownPct),
      J: round(output.baseline_comparison.J_handshake_scaling_overnight_funding_oi_reverse.maxDrawdownPct),
      K: round(output.baseline_comparison.K_3way_handshake_scaling_overnight_alts.maxDrawdownPct),
      D: round(output.baseline_comparison.D_v3_baseline_independent_current_risk.maxDrawdownPct),
      L: round(output.baseline_comparison.L_weekly_bias_hold_scaling.maxDrawdownPct),
      Daily: round(output.baseline_comparison.daily_ny_open_short.maxDrawdownPct),
    },
    trades: {
      A: output.baseline_comparison.A_handshake_current_risk.trades,
      B: output.baseline_comparison.B_independent_scaling_risk.trades,
      C: output.baseline_comparison.C_handshake_scaling_risk.trades,
      E: output.baseline_comparison.E_handshake_scaling_overnight_funding.trades,
      F: output.baseline_comparison.F_handshake_scaling_overnight_oi.trades,
      G: output.baseline_comparison.G_handshake_scaling_overnight_funding_oi.trades,
      H: output.baseline_comparison.H_handshake_scaling_overnight_funding_reverse.trades,
      I: output.baseline_comparison.I_handshake_scaling_overnight_oi_reverse.trades,
      J: output.baseline_comparison.J_handshake_scaling_overnight_funding_oi_reverse.trades,
      K: output.baseline_comparison.K_3way_handshake_scaling_overnight_alts.trades,
      D: output.baseline_comparison.D_v3_baseline_independent_current_risk.trades,
      L: output.baseline_comparison.L_weekly_bias_hold_scaling.trades,
      Daily: output.baseline_comparison.daily_ny_open_short.trades,
    },
  });
  writeFileSync(historyPath, JSON.stringify(history, null, 2), "utf8");

  console.log(`Weeks: ${weekOpens.join(", ")}`);
  console.log(`A return: ${output.baseline_comparison.A_handshake_current_risk.totalReturnPct.toFixed(2)}%`);
  console.log(`B return: ${output.baseline_comparison.B_independent_scaling_risk.totalReturnPct.toFixed(2)}%`);
  console.log(`C return: ${output.baseline_comparison.C_handshake_scaling_risk.totalReturnPct.toFixed(2)}%`);
  console.log(`E return: ${output.baseline_comparison.E_handshake_scaling_overnight_funding.totalReturnPct.toFixed(2)}%`);
  console.log(`F return: ${output.baseline_comparison.F_handshake_scaling_overnight_oi.totalReturnPct.toFixed(2)}%`);
  console.log(`G return: ${output.baseline_comparison.G_handshake_scaling_overnight_funding_oi.totalReturnPct.toFixed(2)}%`);
  console.log(`H return: ${output.baseline_comparison.H_handshake_scaling_overnight_funding_reverse.totalReturnPct.toFixed(2)}%`);
  console.log(`I return: ${output.baseline_comparison.I_handshake_scaling_overnight_oi_reverse.totalReturnPct.toFixed(2)}%`);
  console.log(`J return: ${output.baseline_comparison.J_handshake_scaling_overnight_funding_oi_reverse.totalReturnPct.toFixed(2)}%`);
  console.log(`K return: ${output.baseline_comparison.K_3way_handshake_scaling_overnight_alts.totalReturnPct.toFixed(2)}%`);
  console.log(`D return: ${output.baseline_comparison.D_v3_baseline_independent_current_risk.totalReturnPct.toFixed(2)}%`);
  console.log(`L return: ${output.baseline_comparison.L_weekly_bias_hold_scaling.totalReturnPct.toFixed(2)}%`);
  console.log(`Daily NY Open return: ${output.baseline_comparison.daily_ny_open_short.totalReturnPct.toFixed(2)}%`);
  console.log(`Primary diagnostics - sweeps:${primarySweepEvents} wrongDir:${primarySkippedWrongDirection} noReject:${primarySkippedNoRejection} noDisp:${primarySkippedNoDisplacement} stopWide:${primarySkippedStopTooWide} noBal:${primarySkippedNoBalance}`);
}

main()
  .catch((error) => {
    console.error("bitget-v2-backtest failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await getPool().end();
    } catch {
      // ignore
    }
  });
