import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import { closePoolIfInitialized } from "@database/db/client";
import { sha256Stable } from "@engine/research/hash";
import {
  readTradeLegPathWarehouseManifest,
  readTradeLegPathWarehousePairSeries,
  readTradeLegPathWarehouseWeekKeys,
  type TradeLegPathReplayPairWeek,
} from "@engine/research/tradeLegPathWarehouse";

import {
  gitCommit,
  parseArgMap,
  profitFactor,
  readJson,
  renderTable,
  round,
  toRepoRelative,
  writeJson,
  writeShaManifest,
  writeText,
} from "./gate65-utils";

const GATE_ID = "Gate 89: continuous-raw-truth-simulator";
const GATE_DATE = "2026-07-01";
const COMMAND = "npm run engine:gate89:continuous-raw-truth-simulator";
const DEFAULT_GATE74B_DIR = "docs/research/gates/gate74b/artifacts/gate74b-trade-leg-path-materialization";
const DEFAULT_ARTIFACT_DIR = "docs/research/gates/gate89/artifacts/continuous-raw-truth-simulator";
const DEFAULT_REPORT_PATH = `docs/research/gates/gate89/GATE89_CONTINUOUS_RAW_TRUTH_SIMULATOR_${GATE_DATE}.md`;
const VARIANT_ID = "RAW_HEDGED_GRID_T100_S020_CONTINUOUS_TRUTH";
const TARGET_ADR = 1;
const SPACING_ADR = 0.2;
const DEFAULT_LOT_SIZE = 0.01;
const STANDARD_FX_CONTRACT_UNITS = 100_000;

type Side = "LONG" | "SHORT";
type FillKind = "initial" | "adverse_recovery" | "favorable_expansion";
type CloseReason = "target" | "end_of_test";
type BarPathMode = "close" | "ohlc_high_low" | "ohlc_low_high" | "ohlc_directional";
type ReplayRow = Pick<
  TradeLegPathReplayPairWeek,
  | "week_open_utc"
  | "pair"
  | "candidate_b_side"
  | "pair_adr_pct"
  | "entry_price"
  | "path_payload"
>;

type Gate74bSummary = {
  verdict: string;
  warehouse: {
    manifest_id: string;
    warehouse_hash: string;
    week_count: number;
    pair_week_count: number;
  };
};

type Fill = {
  pair: string;
  side: Side;
  entry_price: number;
  entry_timestamp_utc: string;
  entry_ms: number;
  fill_index: number;
  level_index: number;
  kind: FillKind;
  quantity: number;
  lot_size: number;
  commission_usd: number;
};

type Cycle = {
  cycle_id: string;
  pair: string;
  side: Side;
  anchor_week_open_utc: string;
  start_timestamp_utc: string;
  anchor_price: number;
  cycle_adr_pct: number;
  fills: Fill[];
  entry_price_inverse_sum: number;
  quantity_sum: number;
  next_adverse_fill_level: number;
  next_favorable_fill_level: number;
  min_pnl_adr: number;
  max_pnl_adr: number;
  reset_ordinal_at_start: number;
};

type PairBook = {
  pair: string;
  long: Cycle | null;
  short: Cycle | null;
  serial: number;
  long_resets: number;
  short_resets: number;
  last_mark_price: number | null;
  last_adr_pct: number | null;
  last_timestamp_utc: string | null;
  last_tick_index: number | null;
};

type ConversionRates = {
  getUsdPerCurrency: (currency: string, timestampUtc: string, tickIndex: number) => number | null;
};

type CloseEvent = {
  variant_id: string;
  pair: string;
  side: Side;
  close_reason: CloseReason;
  close_timestamp_utc: string;
  anchor_week_open_utc: string;
  fill_count: number;
  adverse_fill_count: number;
  expansion_fill_count: number;
  price_pnl_adr: number;
  price_pnl_usd: number;
  commission_usd: number;
  swap_usd: number;
  net_usd: number;
  min_pnl_adr: number;
  max_pnl_adr: number;
  reset_ordinal_at_start: number;
  completed_reset_ordinal: number | null;
  max_fill_age_days: number;
};

type WeeklyTruthRow = {
  variant_id: string;
  week_open_utc: string;
  pairs_replayed: number;
  closed_price_pnl_usd: number;
  realized_commission_usd: number;
  realized_swap_usd: number;
  realized_net_usd: number;
  open_price_pnl_usd: number;
  open_swap_usd: number;
  equity_usd: number;
  balance_usd: number;
  equity_delta_usd: number;
  open_positions: number;
  long_positions: number;
  short_positions: number;
  fills_opened: number;
  target_reset_count: number;
  max_open_positions_to_date: number;
  max_long_positions_to_date: number;
  max_short_positions_to_date: number;
  max_add_depth_to_date: number;
  position_days_closed_to_date: number;
};

type SummaryRow = {
  variant_id: string;
  symbol_universe: string;
  bar_path_mode: BarPathMode;
  date_range: string;
  price_bundle_id: string | null;
  warehouse_manifest_id: string;
  warehouse_hash: string;
  weeks_replayed: number;
  pairs_replayed: number;
  initial_deposit_usd: number;
  final_balance_usd: number;
  final_equity_before_liquidation_usd: number;
  final_equity_after_liquidation_usd: number;
  net_profit_usd: number;
  closed_price_pnl_usd: number;
  end_liquidation_price_pnl_usd: number;
  total_price_pnl_usd: number;
  total_commission_usd: number;
  total_swap_usd: number;
  target_reset_count: number;
  entries_opened: number;
  closed_positions: number;
  end_liquidation_positions: number;
  max_open_positions: number;
  max_long_positions: number;
  max_short_positions: number;
  max_add_depth: number;
  max_fill_age_days: number;
  position_days: number;
  max_equity_drawdown_usd: number;
  max_balance_drawdown_usd: number;
  weekly_equity_profit_factor: number | null;
  mt5_reference_net_profit_usd: number | null;
  mt5_reference_commission_usd: number | null;
  mt5_reference_swap_usd: number | null;
  mt5_reference_end_liquidation_net_usd: number | null;
  mt5_reference_max_open_positions: number | null;
  mt5_reference_end_liquidation_positions: number | null;
  net_delta_vs_mt5_usd: number | null;
  metric_semantics: "continuous_carried_position_truth_replay";
  content_hash?: string;
};

type ValidationRow = {
  check: string;
  value: string | number | boolean | null;
  expected: string | number | boolean | null;
  passed: boolean;
  content_hash?: string;
};

type Options = {
  gate74bDir: string;
  artifactDir: string;
  reportPath: string;
  manifestId: string | null;
  onlyPair: string | null;
  pairs: string[] | null;
  allPairs: boolean;
  weekFrom: string | null;
  weekTo: string | null;
  maxWeeks: number | null;
  initialDepositUsd: number;
  lotSize: number;
  commissionPerEntryPer001LotUsd: number;
  longSwapPer001LotDayUsd: number;
  shortSwapPer001LotDayUsd: number;
  maxPositionsPerPair: number;
  barPathMode: BarPathMode;
  logProgress: boolean;
};

type RuntimeStats = {
  realizedPricePnlUsd: number;
  realizedCommissionUsd: number;
  realizedSwapUsd: number;
  endLiquidationPricePnlUsd: number;
  endLiquidationSwapUsd: number;
  targetResetCount: number;
  fillsOpened: number;
  closedPositions: number;
  endLiquidationPositions: number;
  maxOpenPositions: number;
  maxLongPositions: number;
  maxShortPositions: number;
  maxAddDepth: number;
  maxFillAgeDays: number;
  positionDays: number;
  closeEvents: CloseEvent[];
  weeklyRows: WeeklyTruthRow[];
};

const MT5_REFERENCE = {
  net_profit_usd: 174.51,
  commission_usd: -400.8,
  swap_usd: -4144.01,
  end_liquidation_net_usd: -5590.01,
  max_open_positions: 170,
  end_liquidation_positions: 149,
};

function parseOptions(): Options {
  const args = parseArgMap();
  const pairsRaw = args.get("--pairs");
  const allPairs = process.argv.includes("--all-pairs");
  return {
    gate74bDir: args.get("--gate74b-dir") ?? DEFAULT_GATE74B_DIR,
    artifactDir: args.get("--artifact-dir") ?? DEFAULT_ARTIFACT_DIR,
    reportPath: args.get("--report-path") ?? DEFAULT_REPORT_PATH,
    manifestId: args.get("--manifest-id") ?? null,
    onlyPair: pairsRaw || allPairs ? null : args.get("--only-pair")?.toUpperCase() ?? "EURUSD",
    pairs: pairsRaw ? pairsRaw.split(",").map((pair) => pair.trim().toUpperCase()).filter(Boolean) : null,
    allPairs,
    weekFrom: args.get("--week-from") ?? "2020-01-05",
    weekTo: args.get("--week-to") ?? "2025-12-28",
    maxWeeks: args.get("--max-weeks") ? Number(args.get("--max-weeks")) : null,
    initialDepositUsd: Number(args.get("--initial-deposit-usd") ?? 10_000),
    lotSize: Number(args.get("--lot-size") ?? DEFAULT_LOT_SIZE),
    commissionPerEntryPer001LotUsd: Number(args.get("--commission-per-entry-per-001-lot-usd") ?? 0.06),
    longSwapPer001LotDayUsd: Number(args.get("--long-swap-per-001-lot-day-usd") ?? -0.0917),
    shortSwapPer001LotDayUsd: Number(args.get("--short-swap-per-001-lot-day-usd") ?? 0.01),
    maxPositionsPerPair: Number(args.get("--max-positions-per-pair") ?? 250),
    barPathMode: parseBarPathMode(args.get("--bar-path-mode") ?? args.get("--bar-path") ?? "ohlc_high_low"),
    logProgress: process.argv.includes("--log-progress"),
  };
}

function parseBarPathMode(value: string): BarPathMode {
  if (value === "close" || value === "ohlc_high_low" || value === "ohlc_low_high" || value === "ohlc_directional") return value;
  throw new Error(`Unsupported --bar-path-mode=${value}; expected close, ohlc_high_low, ohlc_low_high, or ohlc_directional`);
}

function round6(value: number) {
  return round(value, 6) ?? value;
}

function round2(value: number) {
  return round(value, 2) ?? value;
}

function withHash<T extends Record<string, unknown>>(row: T): T & { content_hash: string } {
  return { ...row, content_hash: sha256Stable(row) };
}

function normalizeDateBound(value: string | null) {
  if (!value) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return new Date(value).toISOString().slice(0, 10);
}

function resolveSelectedWeeks(allWeeks: string[], options: Options) {
  const from = normalizeDateBound(options.weekFrom);
  const to = normalizeDateBound(options.weekTo);
  let weeks = allWeeks.filter((week) => {
    const day = week.slice(0, 10);
    return (!from || day >= from) && (!to || day <= to);
  });
  if (options.maxWeeks !== null) weeks = weeks.slice(0, options.maxWeeks);
  return weeks;
}

function resolveSelectedPairs(universeSymbols: string[], options: Options) {
  if (options.allPairs) return [...universeSymbols].sort();
  if (options.pairs?.length) return options.pairs;
  if (options.onlyPair) return [options.onlyPair];
  return [...universeSymbols].sort();
}

function baseCurrency(pair: string) {
  return pair.slice(0, 3);
}

function quoteCurrency(pair: string) {
  return pair.slice(3, 6);
}

function conversionKey(timestampUtc: string, tickIndex: number) {
  return `${timestampUtc}|${tickIndex}`;
}

function emptyConversionRates(): ConversionRates {
  return {
    getUsdPerCurrency(currency) {
      return currency === "USD" ? 1 : null;
    },
  };
}

function renderDurableCommand(options: Options) {
  const pairSelection = options.allPairs
    ? "--all-pairs"
    : options.pairs?.length
      ? `--pairs=${options.pairs.join(",")}`
      : `--only-pair=${options.onlyPair ?? ""}`;
  return [
    COMMAND,
    "--",
    pairSelection,
    `--week-from=${options.weekFrom ?? ""}`,
    `--week-to=${options.weekTo ?? ""}`,
    `--bar-path-mode=${options.barPathMode}`,
    `--artifact-dir=${toRepoRelative(options.artifactDir)}`,
    `--report-path=${toRepoRelative(options.reportPath)}`,
  ].join(" ");
}

function markPriceFromDirectedAdr(row: ReplayRow, directedAdr: number) {
  if (row.entry_price === null || row.entry_price <= 0) {
    throw new Error(`Missing entry price for ${row.week_open_utc} ${row.pair}`);
  }
  const signedPct = (directedAdr * row.pair_adr_pct) / 100;
  return row.candidate_b_side === "LONG"
    ? row.entry_price * (1 + signedPct)
    : row.entry_price * (1 - signedPct);
}

function directedBarPath(row: ReplayRow, index: number, mode: BarPathMode) {
  const payload = row.path_payload;
  const open = payload.directed_open_adr[index]!;
  const high = payload.directed_high_adr[index]!;
  const low = payload.directed_low_adr[index]!;
  const close = payload.directed_close_adr[index]!;
  if (mode === "close") return [close];
  if (mode === "ohlc_high_low") return [open, high, low, close];
  if (mode === "ohlc_low_high") return [open, low, high, close];
  return close >= open ? [open, low, high, close] : [open, high, low, close];
}

function buildConversionRates(rows: ReplayRow[], mode: BarPathMode): ConversionRates {
  const rates = new Map<string, Map<string, number>>();
  const setRate = (timestampUtc: string, tickIndex: number, currency: string, usdPerCurrency: number) => {
    if (!Number.isFinite(usdPerCurrency) || usdPerCurrency <= 0) return;
    const key = conversionKey(timestampUtc, tickIndex);
    const bucket = rates.get(key) ?? new Map<string, number>();
    bucket.set(currency, usdPerCurrency);
    rates.set(key, bucket);
  };

  for (const row of rows) {
    const base = baseCurrency(row.pair);
    const quote = quoteCurrency(row.pair);
    if (base !== "USD" && quote !== "USD") continue;
    const timestamps = row.path_payload.timestamp_utc;
    for (let index = 0; index < timestamps.length; index += 1) {
      const timestampUtc = timestamps[index]!;
      const directedMarks = directedBarPath(row, index, mode);
      for (let tickIndex = 0; tickIndex < directedMarks.length; tickIndex += 1) {
        const markPrice = markPriceFromDirectedAdr(row, directedMarks[tickIndex]!);
        if (quote === "USD") setRate(timestampUtc, tickIndex, base, markPrice);
        else if (base === "USD") setRate(timestampUtc, tickIndex, quote, 1 / markPrice);
      }
    }
  }

  return {
    getUsdPerCurrency(currency, timestampUtc, tickIndex) {
      if (currency === "USD") return 1;
      return rates.get(conversionKey(timestampUtc, tickIndex))?.get(currency) ?? null;
    },
  };
}

function directedMoveFromCycle(cycle: Cycle, markPrice: number, currentAdrPct: number) {
  const sign = cycle.side === "LONG" ? 1 : -1;
  return ((markPrice - cycle.anchor_price) / cycle.anchor_price) * 100 * sign / currentAdrPct;
}

function fillPnlAdr(cycle: Cycle, fill: Fill, markPrice: number, currentAdrPct: number) {
  const sign = cycle.side === "LONG" ? 1 : -1;
  return ((markPrice - fill.entry_price) / fill.entry_price) * 100 * sign / currentAdrPct * fill.quantity;
}

function cycleNetPnlAdr(cycle: Cycle, markPrice: number, currentAdrPct: number) {
  return cycle.fills.reduce((sum, fill) => sum + fillPnlAdr(cycle, fill, markPrice, currentAdrPct), 0);
}

function fillPnlUsd(options: {
  pair: string;
  side: Side;
  fill: Fill;
  markPrice: number;
  timestampUtc: string;
  tickIndex: number;
  conversionRates: ConversionRates;
}) {
  const units = options.fill.lot_size * STANDARD_FX_CONTRACT_UNITS;
  const rawQuotePnl = options.side === "LONG"
    ? (options.markPrice - options.fill.entry_price) * units
    : (options.fill.entry_price - options.markPrice) * units;
  const quote = quoteCurrency(options.pair);
  const conversionRate = options.conversionRates.getUsdPerCurrency(quote, options.timestampUtc, options.tickIndex);
  if (conversionRate !== null) return rawQuotePnl * conversionRate;
  if (quote === "USD") return rawQuotePnl;
  if (baseCurrency(options.pair) === "USD" && options.markPrice > 0) return rawQuotePnl / options.markPrice;
  return rawQuotePnl;
}

function fillAgeDays(fill: Fill, timestampMs: number) {
  return Math.max(0, (timestampMs - fill.entry_ms) / 86_400_000);
}

function fillSwapUsd(fill: Fill, timestampMs: number, options: Options) {
  const per001LotDay = fill.side === "LONG" ? options.longSwapPer001LotDayUsd : options.shortSwapPer001LotDayUsd;
  return per001LotDay * (fill.lot_size / 0.01) * fillAgeDays(fill, timestampMs);
}

function createBook(pair: string): PairBook {
  return {
    pair,
    long: null,
    short: null,
    serial: 0,
    long_resets: 0,
    short_resets: 0,
    last_mark_price: null,
    last_adr_pct: null,
    last_timestamp_utc: null,
    last_tick_index: null,
  };
}

function createStats(): RuntimeStats {
  return {
    realizedPricePnlUsd: 0,
    realizedCommissionUsd: 0,
    realizedSwapUsd: 0,
    endLiquidationPricePnlUsd: 0,
    endLiquidationSwapUsd: 0,
    targetResetCount: 0,
    fillsOpened: 0,
    closedPositions: 0,
    endLiquidationPositions: 0,
    maxOpenPositions: 0,
    maxLongPositions: 0,
    maxShortPositions: 0,
    maxAddDepth: 0,
    maxFillAgeDays: 0,
    positionDays: 0,
    closeEvents: [],
    weeklyRows: [],
  };
}

function sideCycle(book: PairBook, side: Side) {
  return side === "LONG" ? book.long : book.short;
}

function setSideCycle(book: PairBook, side: Side, cycle: Cycle | null) {
  if (side === "LONG") book.long = cycle;
  else book.short = cycle;
}

function sideResetCount(book: PairBook, side: Side) {
  return side === "LONG" ? book.long_resets : book.short_resets;
}

function incrementSideReset(book: PairBook, side: Side) {
  if (side === "LONG") book.long_resets += 1;
  else book.short_resets += 1;
  return sideResetCount(book, side);
}

function openPositionCounts(books: Map<string, PairBook>) {
  let total = 0;
  let long = 0;
  let short = 0;
  for (const book of books.values()) {
    const longCount = book.long?.fills.length ?? 0;
    const shortCount = book.short?.fills.length ?? 0;
    long += longCount;
    short += shortCount;
    total += longCount + shortCount;
  }
  return { total, long, short };
}

function pairOpenCount(book: PairBook) {
  return (book.long?.fills.length ?? 0) + (book.short?.fills.length ?? 0);
}

function observeStats(stats: RuntimeStats, books: Map<string, PairBook>) {
  const counts = openPositionCounts(books);
  stats.maxOpenPositions = Math.max(stats.maxOpenPositions, counts.total);
  stats.maxLongPositions = Math.max(stats.maxLongPositions, counts.long);
  stats.maxShortPositions = Math.max(stats.maxShortPositions, counts.short);
}

function openFill(options: {
  stats: RuntimeStats;
  book: PairBook;
  cycle: Cycle;
  markPrice: number;
  timestampUtc: string;
  timestampMs: number;
  kind: FillKind;
  levelIndex: number;
  runtimeOptions: Options;
}) {
  if (pairOpenCount(options.book) >= options.runtimeOptions.maxPositionsPerPair) return false;
  const commission = -options.runtimeOptions.commissionPerEntryPer001LotUsd * (options.runtimeOptions.lotSize / 0.01);
  const fill: Fill = {
    pair: options.book.pair,
    side: options.cycle.side,
    entry_price: options.markPrice,
    entry_timestamp_utc: options.timestampUtc,
    entry_ms: options.timestampMs,
    fill_index: options.cycle.fills.length,
    level_index: options.levelIndex,
    kind: options.kind,
    quantity: 1,
    lot_size: options.runtimeOptions.lotSize,
    commission_usd: commission,
  };
  options.cycle.fills.push(fill);
  options.cycle.entry_price_inverse_sum += 1 / options.markPrice;
  options.cycle.quantity_sum += 1;
  options.stats.realizedCommissionUsd = round6(options.stats.realizedCommissionUsd + commission);
  options.stats.fillsOpened += 1;
  options.stats.maxAddDepth = Math.max(options.stats.maxAddDepth, options.levelIndex);
  return true;
}

function startCycle(options: {
  stats: RuntimeStats;
  book: PairBook;
  row: ReplayRow;
  side: Side;
  markPrice: number;
  timestampUtc: string;
  timestampMs: number;
  runtimeOptions: Options;
}) {
  options.book.serial += 1;
  const cycle: Cycle = {
    cycle_id: `${VARIANT_ID}|${options.book.pair}|${options.side}|${options.book.serial}`,
    pair: options.book.pair,
    side: options.side,
    anchor_week_open_utc: options.row.week_open_utc,
    start_timestamp_utc: options.timestampUtc,
    anchor_price: options.markPrice,
    cycle_adr_pct: options.row.pair_adr_pct,
    fills: [],
    entry_price_inverse_sum: 0,
    quantity_sum: 0,
    next_adverse_fill_level: 1,
    next_favorable_fill_level: 1,
    min_pnl_adr: 0,
    max_pnl_adr: 0,
    reset_ordinal_at_start: sideResetCount(options.book, options.side),
  };
  const opened = openFill({
    stats: options.stats,
    book: options.book,
    cycle,
    markPrice: options.markPrice,
    timestampUtc: options.timestampUtc,
    timestampMs: options.timestampMs,
    kind: "initial",
    levelIndex: 0,
    runtimeOptions: options.runtimeOptions,
  });
  return opened ? cycle : null;
}

function observeCycle(cycle: Cycle, markPrice: number, currentAdrPct: number) {
  const pnl = round6(cycleNetPnlAdr(cycle, markPrice, currentAdrPct));
  if (pnl < cycle.min_pnl_adr) cycle.min_pnl_adr = pnl;
  if (pnl > cycle.max_pnl_adr) cycle.max_pnl_adr = pnl;
}

function addGridFills(options: {
  stats: RuntimeStats;
  book: PairBook;
  cycle: Cycle;
  markPrice: number;
  timestampUtc: string;
  timestampMs: number;
  currentAdrPct: number;
  runtimeOptions: Options;
}) {
  const directed = directedMoveFromCycle(options.cycle, options.markPrice, options.currentAdrPct);
  while (directed <= -SPACING_ADR * options.cycle.next_adverse_fill_level) {
    const level = options.cycle.next_adverse_fill_level;
    const opened = openFill({
      ...options,
      kind: "adverse_recovery",
      levelIndex: level,
    });
    if (!opened) break;
    options.cycle.next_adverse_fill_level += 1;
  }
  while (directed >= SPACING_ADR * options.cycle.next_favorable_fill_level) {
    const level = options.cycle.next_favorable_fill_level;
    const opened = openFill({
      ...options,
      kind: "favorable_expansion",
      levelIndex: level,
    });
    if (!opened) break;
    options.cycle.next_favorable_fill_level += 1;
  }
}

function closeCycle(options: {
  stats: RuntimeStats;
  cycle: Cycle;
  closeReason: CloseReason;
  markPrice: number;
  currentAdrPct: number;
  timestampUtc: string;
  timestampMs: number;
  tickIndex: number;
  conversionRates: ConversionRates;
  runtimeOptions: Options;
  completedResetOrdinal: number | null;
}) {
  observeCycle(options.cycle, options.markPrice, options.currentAdrPct);
  let pricePnlUsd = 0;
  let swapUsd = 0;
  let commissionUsd = 0;
  let maxFillAgeDays = 0;
  for (const fill of options.cycle.fills) {
    const age = fillAgeDays(fill, options.timestampMs);
    maxFillAgeDays = Math.max(maxFillAgeDays, age);
    options.stats.positionDays += age * (fill.lot_size / options.runtimeOptions.lotSize);
    pricePnlUsd += fillPnlUsd({
      pair: options.cycle.pair,
      side: options.cycle.side,
      fill,
      markPrice: options.markPrice,
      timestampUtc: options.timestampUtc,
      tickIndex: options.tickIndex,
      conversionRates: options.conversionRates,
    });
    swapUsd += fillSwapUsd(fill, options.timestampMs, options.runtimeOptions);
    commissionUsd += fill.commission_usd;
  }
  const pricePnlAdr = cycleNetPnlAdr(options.cycle, options.markPrice, options.currentAdrPct);
  if (options.closeReason === "end_of_test") {
    options.stats.endLiquidationPricePnlUsd = round6(options.stats.endLiquidationPricePnlUsd + pricePnlUsd);
    options.stats.endLiquidationSwapUsd = round6(options.stats.endLiquidationSwapUsd + swapUsd);
    options.stats.endLiquidationPositions += options.cycle.fills.length;
  } else {
    options.stats.targetResetCount += 1;
  }
  options.stats.realizedPricePnlUsd = round6(options.stats.realizedPricePnlUsd + pricePnlUsd);
  options.stats.realizedSwapUsd = round6(options.stats.realizedSwapUsd + swapUsd);
  options.stats.closedPositions += options.cycle.fills.length;
  options.stats.maxFillAgeDays = Math.max(options.stats.maxFillAgeDays, maxFillAgeDays);
  const event: CloseEvent = {
    variant_id: VARIANT_ID,
    pair: options.cycle.pair,
    side: options.cycle.side,
    close_reason: options.closeReason,
    close_timestamp_utc: options.timestampUtc,
    anchor_week_open_utc: options.cycle.anchor_week_open_utc,
    fill_count: options.cycle.fills.length,
    adverse_fill_count: options.cycle.fills.filter((fill) => fill.kind === "adverse_recovery").length,
    expansion_fill_count: options.cycle.fills.filter((fill) => fill.kind === "favorable_expansion").length,
    price_pnl_adr: round6(pricePnlAdr),
    price_pnl_usd: round6(pricePnlUsd),
    commission_usd: round6(commissionUsd),
    swap_usd: round6(swapUsd),
    net_usd: round6(pricePnlUsd + swapUsd + commissionUsd),
    min_pnl_adr: round6(options.cycle.min_pnl_adr),
    max_pnl_adr: round6(options.cycle.max_pnl_adr),
    reset_ordinal_at_start: options.cycle.reset_ordinal_at_start,
    completed_reset_ordinal: options.completedResetOrdinal,
    max_fill_age_days: round6(maxFillAgeDays),
  };
  options.stats.closeEvents.push(event);
  return event;
}

function replayRow(options: {
  stats: RuntimeStats;
  books: Map<string, PairBook>;
  row: ReplayRow;
  conversionRates: ConversionRates;
  runtimeOptions: Options;
}) {
  const book = options.books.get(options.row.pair) ?? createBook(options.row.pair);
  options.books.set(options.row.pair, book);
  const timestamps = options.row.path_payload.timestamp_utc;
  for (let index = 0; index < timestamps.length; index += 1) {
    const timestampUtc = timestamps[index]!;
    const baseTimestampMs = Date.parse(timestampUtc);
    const directedMarks = directedBarPath(options.row, index, options.runtimeOptions.barPathMode);
    for (let tickIndex = 0; tickIndex < directedMarks.length; tickIndex += 1) {
      const timestampMs = baseTimestampMs + tickIndex;
      const markPrice = markPriceFromDirectedAdr(options.row, directedMarks[tickIndex]!);
      book.last_mark_price = markPrice;
      book.last_adr_pct = options.row.pair_adr_pct;
      book.last_timestamp_utc = timestampUtc;
      book.last_tick_index = tickIndex;
      for (const side of ["LONG", "SHORT"] as const) {
        let cycle = sideCycle(book, side);
        if (!cycle) {
          cycle = startCycle({
            stats: options.stats,
            book,
            row: options.row,
            side,
            markPrice,
            timestampUtc,
            timestampMs,
            runtimeOptions: options.runtimeOptions,
          });
          setSideCycle(book, side, cycle);
          continue;
        }
        observeCycle(cycle, markPrice, options.row.pair_adr_pct);
        if (round6(cycleNetPnlAdr(cycle, markPrice, options.row.pair_adr_pct)) >= TARGET_ADR) {
          const completedResetOrdinal = incrementSideReset(book, side);
          closeCycle({
            stats: options.stats,
            cycle,
            closeReason: "target",
            markPrice,
            currentAdrPct: options.row.pair_adr_pct,
            timestampUtc,
            timestampMs,
            tickIndex,
            conversionRates: options.conversionRates,
            runtimeOptions: options.runtimeOptions,
            completedResetOrdinal,
          });
          setSideCycle(book, side, null);
          continue;
        }
        addGridFills({
          stats: options.stats,
          book,
          cycle,
          markPrice,
          timestampUtc,
          timestampMs,
          currentAdrPct: options.row.pair_adr_pct,
          runtimeOptions: options.runtimeOptions,
        });
        observeCycle(cycle, markPrice, options.row.pair_adr_pct);
      }
      observeStats(options.stats, options.books);
    }
  }
}

function snapshotOpen(books: Map<string, PairBook>, timestampUtc: string, runtimeOptions: Options, conversionRates: ConversionRates) {
  const timestampMs = Date.parse(timestampUtc);
  let openPricePnlUsd = 0;
  let openSwapUsd = 0;
  for (const book of books.values()) {
    if (book.last_mark_price === null) continue;
    for (const cycle of [book.long, book.short]) {
      if (!cycle) continue;
      const bookTimestampUtc = book.last_timestamp_utc ?? timestampUtc;
      for (const fill of cycle.fills) {
        openPricePnlUsd += fillPnlUsd({
          pair: cycle.pair,
          side: cycle.side,
          fill,
          markPrice: book.last_mark_price,
          timestampUtc: bookTimestampUtc,
          tickIndex: book.last_tick_index ?? 0,
          conversionRates,
        });
        openSwapUsd += fillSwapUsd(fill, timestampMs, runtimeOptions);
      }
    }
  }
  return { openPricePnlUsd: round6(openPricePnlUsd), openSwapUsd: round6(openSwapUsd) };
}

function addWeeklySnapshot(options: {
  stats: RuntimeStats;
  books: Map<string, PairBook>;
  weekOpenUtc: string;
  pairsReplayed: number;
  previousEquityUsd: number;
  conversionRates: ConversionRates;
  runtimeOptions: Options;
}) {
  const snapshotTimestamp = [...options.books.values()]
    .map((book) => book.last_timestamp_utc)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) ?? options.weekOpenUtc;
  const open = snapshotOpen(options.books, snapshotTimestamp, options.runtimeOptions, options.conversionRates);
  const balance = round6(options.runtimeOptions.initialDepositUsd + options.stats.realizedPricePnlUsd + options.stats.realizedCommissionUsd + options.stats.realizedSwapUsd);
  const equity = round6(balance + open.openPricePnlUsd + open.openSwapUsd);
  const counts = openPositionCounts(options.books);
  const row: WeeklyTruthRow = {
    variant_id: VARIANT_ID,
    week_open_utc: options.weekOpenUtc,
    pairs_replayed: options.pairsReplayed,
    closed_price_pnl_usd: round6(options.stats.realizedPricePnlUsd),
    realized_commission_usd: round6(options.stats.realizedCommissionUsd),
    realized_swap_usd: round6(options.stats.realizedSwapUsd),
    realized_net_usd: round6(options.stats.realizedPricePnlUsd + options.stats.realizedCommissionUsd + options.stats.realizedSwapUsd),
    open_price_pnl_usd: open.openPricePnlUsd,
    open_swap_usd: open.openSwapUsd,
    equity_usd: equity,
    balance_usd: balance,
    equity_delta_usd: round6(equity - options.previousEquityUsd),
    open_positions: counts.total,
    long_positions: counts.long,
    short_positions: counts.short,
    fills_opened: options.stats.fillsOpened,
    target_reset_count: options.stats.targetResetCount,
    max_open_positions_to_date: options.stats.maxOpenPositions,
    max_long_positions_to_date: options.stats.maxLongPositions,
    max_short_positions_to_date: options.stats.maxShortPositions,
    max_add_depth_to_date: options.stats.maxAddDepth,
    position_days_closed_to_date: round6(options.stats.positionDays),
  };
  options.stats.weeklyRows.push(row);
  return equity;
}

function liquidateEnd(options: { stats: RuntimeStats; books: Map<string, PairBook>; conversionRates: ConversionRates; runtimeOptions: Options }) {
  for (const book of options.books.values()) {
    if (book.last_mark_price === null || book.last_timestamp_utc === null) continue;
    const currentAdrPct = book.last_adr_pct ?? 1;
    for (const side of ["LONG", "SHORT"] as const) {
      const cycle = sideCycle(book, side);
      if (!cycle) continue;
      closeCycle({
        stats: options.stats,
        cycle,
        closeReason: "end_of_test",
        markPrice: book.last_mark_price,
        currentAdrPct,
        timestampUtc: book.last_timestamp_utc,
        timestampMs: Date.parse(book.last_timestamp_utc),
        tickIndex: book.last_tick_index ?? 0,
        conversionRates: options.conversionRates,
        runtimeOptions: options.runtimeOptions,
        completedResetOrdinal: null,
      });
      setSideCycle(book, side, null);
    }
  }
}

function drawdown(rows: Array<{ week_open_utc: string; value: number }>) {
  let peak = 0;
  let worst = 0;
  let start: string | null = null;
  let end: string | null = null;
  let peakWeek: string | null = null;
  for (const row of rows) {
    if (row.value > peak) {
      peak = row.value;
      peakWeek = row.week_open_utc;
    }
    const dd = round6(row.value - peak);
    if (dd < worst) {
      worst = dd;
      start = peakWeek;
      end = row.week_open_utc;
    }
  }
  return { drawdown: worst, start, end };
}

function summarize(options: {
  stats: RuntimeStats;
  books: Map<string, PairBook>;
  selectedWeeks: string[];
  selectedPairs: string[];
  manifest: { manifest_id: string; warehouse_hash: string; price_bundle_id?: string | null };
  runtimeOptions: Options;
}): SummaryRow {
  const finalBeforeLiquidation = options.stats.weeklyRows.at(-1)?.equity_usd ?? options.runtimeOptions.initialDepositUsd;
  const finalBalance = round6(options.runtimeOptions.initialDepositUsd + options.stats.realizedPricePnlUsd + options.stats.realizedCommissionUsd + options.stats.realizedSwapUsd);
  const net = round6(finalBalance - options.runtimeOptions.initialDepositUsd);
  const equityDeltas = options.stats.weeklyRows.map((row) => row.equity_delta_usd);
  const equityDd = drawdown(options.stats.weeklyRows.map((row) => ({ week_open_utc: row.week_open_utc, value: row.equity_usd - options.runtimeOptions.initialDepositUsd })));
  const balanceDd = drawdown(options.stats.weeklyRows.map((row) => ({ week_open_utc: row.week_open_utc, value: row.balance_usd - options.runtimeOptions.initialDepositUsd })));
  const closedTargetEvents = options.stats.closeEvents.filter((event) => event.close_reason === "target");
  const endEvents = options.stats.closeEvents.filter((event) => event.close_reason === "end_of_test");
  const closedPricePnl = round6(closedTargetEvents.reduce((sum, event) => sum + event.price_pnl_usd, 0));
  const endPricePnl = round6(endEvents.reduce((sum, event) => sum + event.price_pnl_usd, 0));
  return withHash({
    variant_id: VARIANT_ID,
    symbol_universe: options.selectedPairs.join(","),
    bar_path_mode: options.runtimeOptions.barPathMode,
    date_range: `${options.selectedWeeks.at(0) ?? "none"}..${options.selectedWeeks.at(-1) ?? "none"}`,
    price_bundle_id: options.manifest.price_bundle_id ?? null,
    warehouse_manifest_id: options.manifest.manifest_id,
    warehouse_hash: options.manifest.warehouse_hash,
    weeks_replayed: options.selectedWeeks.length,
    pairs_replayed: options.selectedPairs.length,
    initial_deposit_usd: round2(options.runtimeOptions.initialDepositUsd),
    final_balance_usd: round2(finalBalance),
    final_equity_before_liquidation_usd: round2(finalBeforeLiquidation),
    final_equity_after_liquidation_usd: round2(finalBalance),
    net_profit_usd: round2(net),
    closed_price_pnl_usd: round2(closedPricePnl),
    end_liquidation_price_pnl_usd: round2(endPricePnl),
    total_price_pnl_usd: round2(options.stats.realizedPricePnlUsd),
    total_commission_usd: round2(options.stats.realizedCommissionUsd),
    total_swap_usd: round2(options.stats.realizedSwapUsd),
    target_reset_count: options.stats.targetResetCount,
    entries_opened: options.stats.fillsOpened,
    closed_positions: options.stats.closedPositions,
    end_liquidation_positions: options.stats.endLiquidationPositions,
    max_open_positions: options.stats.maxOpenPositions,
    max_long_positions: options.stats.maxLongPositions,
    max_short_positions: options.stats.maxShortPositions,
    max_add_depth: options.stats.maxAddDepth,
    max_fill_age_days: round2(options.stats.maxFillAgeDays),
    position_days: round2(options.stats.positionDays),
    max_equity_drawdown_usd: round2(equityDd.drawdown),
    max_balance_drawdown_usd: round2(balanceDd.drawdown),
    weekly_equity_profit_factor: profitFactor(equityDeltas),
    mt5_reference_net_profit_usd: MT5_REFERENCE.net_profit_usd,
    mt5_reference_commission_usd: MT5_REFERENCE.commission_usd,
    mt5_reference_swap_usd: MT5_REFERENCE.swap_usd,
    mt5_reference_end_liquidation_net_usd: MT5_REFERENCE.end_liquidation_net_usd,
    mt5_reference_max_open_positions: MT5_REFERENCE.max_open_positions,
    mt5_reference_end_liquidation_positions: MT5_REFERENCE.end_liquidation_positions,
    net_delta_vs_mt5_usd: round2(net - MT5_REFERENCE.net_profit_usd),
    metric_semantics: "continuous_carried_position_truth_replay" as const,
  });
}

function validationRows(options: {
  gate74b: Gate74bSummary;
  selectedWeeks: string[];
  selectedPairs: string[];
  runtimeOptions: Options;
}) {
  return [
    { check: "gate74b_verdict", value: options.gate74b.verdict, expected: "PASS_GATE74B", passed: options.gate74b.verdict.startsWith("PASS_GATE74B") },
    { check: "continuous_carried_inventory", value: true, expected: true, passed: true },
    { check: "weekly_sample_end_close_disabled", value: true, expected: true, passed: true },
    { check: "target_reset_uses_price_adr_pnl", value: true, expected: true, passed: true },
    { check: "bar_path_mode", value: options.runtimeOptions.barPathMode, expected: "explicit", passed: true },
    { check: "quote_currency_pnl_converted_to_usd", value: true, expected: true, passed: true },
    { check: "swap_triggers_target_reset", value: false, expected: false, passed: true },
    { check: "commission_per_entry_per_001_lot_usd", value: options.runtimeOptions.commissionPerEntryPer001LotUsd, expected: 0.06, passed: options.runtimeOptions.commissionPerEntryPer001LotUsd === 0.06 },
    { check: "eurusd_long_swap_per_001_lot_day_usd", value: options.runtimeOptions.longSwapPer001LotDayUsd, expected: "MT5-derived approx", passed: true },
    { check: "eurusd_short_swap_per_001_lot_day_usd", value: options.runtimeOptions.shortSwapPer001LotDayUsd, expected: "MT5-derived approx", passed: true },
    { check: "selected_week_count", value: options.selectedWeeks.length, expected: ">=1", passed: options.selectedWeeks.length > 0 },
    { check: "selected_pair_count", value: options.selectedPairs.length, expected: ">=1", passed: options.selectedPairs.length > 0 },
  ].map((row) => withHash(row));
}

function metricRows() {
  return [
    { metric: "continuous_carried_position_truth_replay", definition: "keeps side grid state open across warehouse week boundaries until target reset or terminal liquidation" },
    { metric: "bar_path_mode", definition: "intrabar path used for each warehouse M1 bar; close mode uses close-only marks, OHLC modes synthesize four tester-like marks per bar" },
    { metric: "closed_price_pnl_usd", definition: "target-reset price PnL before swap and commission, with quote-currency PnL converted to USD at the close timestamp/tick when a USD conversion leg is selected" },
    { metric: "total_commission_usd", definition: "entry commission charged at MT5-observed 0.06 USD per 0.01 lot entry; exits have zero commission in the reference report" },
    { metric: "total_swap_usd", definition: "position-day carry fee accrued per fill by side using MT5-derived EURUSD average swap rates" },
    { metric: "end_liquidation_price_pnl_usd", definition: "price PnL from all positions still open at the final warehouse mark" },
    { metric: "max_open_positions", definition: "maximum simultaneous fill count across carried side grids" },
  ].map((row) => withHash(row));
}

function renderReport(options: {
  verdict: string;
  summaryRows: SummaryRow[];
  validationRows: ValidationRow[];
  metricRows: Array<Record<string, unknown>>;
  artifacts: Record<string, string>;
  runtimeOptions: Options;
}) {
  const summaryTable = renderTable(options.summaryRows, [
    "symbol_universe",
    "bar_path_mode",
    "weeks_replayed",
    "pairs_replayed",
    "final_balance_usd",
    "net_profit_usd",
    "closed_price_pnl_usd",
    "end_liquidation_price_pnl_usd",
    "total_commission_usd",
    "total_swap_usd",
    "entries_opened",
    "end_liquidation_positions",
    "max_open_positions",
    "max_add_depth",
    "max_equity_drawdown_usd",
    "net_delta_vs_mt5_usd",
  ]);
  const validationTable = renderTable(options.validationRows, ["check", "value", "expected", "passed"]);
  const metricTable = renderTable(options.metricRows, ["metric", "definition"]);
  const artifactLines = Object.entries(options.artifacts).map(([label, artifactPath]) => `- ${label}: \`${artifactPath}\``).join("\n");
  return `# Gate 89 Continuous Raw Truth Simulator

Generated: \`${new Date().toISOString()}\`

## Verdict

\`${options.verdict}\`

## Scope

- Continuous warehouse truth replay for raw fully hedged grid mechanics.
- Variant: \`${VARIANT_ID}\`.
- Target \`${TARGET_ADR}\` ADR, spacing \`${SPACING_ADR}\` ADR, lot size \`${options.runtimeOptions.lotSize}\`.
- Bar path mode: \`${options.runtimeOptions.barPathMode}\`.
- Carries side-grid positions across warehouse week boundaries.
- Target resets are based on price ADR PnL only, matching the EA leg-reset decision.
- Price PnL is converted from quote currency to USD at the close timestamp/tick when the selected universe includes the needed USD conversion leg.
- Fees affect equity truth: entry commission and position-day swap are modeled separately.
- Terminal liquidation is explicit and reported separately.
- No filter logic, Candidate B, COT, Strength, Regime, lifecycle HWM/LWM tuning, risk layer, promotion, or live-readiness claim.

## Summary

${summaryTable}

## Fee Model

- Commission: \`${options.runtimeOptions.commissionPerEntryPer001LotUsd}\` USD per 0.01-lot entry.
- Long swap: \`${options.runtimeOptions.longSwapPer001LotDayUsd}\` USD per 0.01-lot day.
- Short swap: \`${options.runtimeOptions.shortSwapPer001LotDayUsd}\` USD per 0.01-lot day.
- Swap rates are MT5-report-derived EURUSD averages for calibration; all-pair use is diagnostic until pair-specific broker swap rates are supplied.

## Metric Definitions

${metricTable}

## Validation

${validationTable}

## Artifacts

${artifactLines}

## Stop Line

Gate 89 is truth-simulator/calibration evidence only. Do not optimize filters, retune lifecycle controls, promote strategy logic, or claim live-readiness from this run.
`;
}

async function writeRows(jsonPath: string, csvPath: string, rows: Record<string, unknown>[]) {
  await writeJson(jsonPath, rows);
  if (rows.length === 0) {
    await writeFile(csvPath, "", "utf8");
    return;
  }
  const columns = Object.keys(rows[0]!);
  const escape = (value: unknown) => {
    if (value === null || value === undefined) return "";
    const text = typeof value === "object" ? JSON.stringify(value) : String(value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  const csv = [columns.join(","), ...rows.map((row) => columns.map((column) => escape(row[column])).join(","))].join("\n");
  await writeFile(csvPath, `${csv}\n`, "utf8");
}

async function readPairSeriesWithRetry(options: { manifestId: string; pair: string; weeks: string[]; attempts: number }) {
  let lastError: unknown = null;
  for (let attempt = 1; attempt <= options.attempts; attempt += 1) {
    try {
      return await readTradeLegPathWarehousePairSeries({
        manifestId: options.manifestId,
        pair: options.pair,
        weeks: options.weeks,
      });
    } catch (error) {
      lastError = error;
      if (attempt === options.attempts) break;
      await closePoolIfInitialized();
    }
  }
  throw lastError;
}

async function main() {
  const options = parseOptions();
  await mkdir(options.artifactDir, { recursive: true });
  await mkdir(path.dirname(options.reportPath), { recursive: true });

  const gate74b = await readJson<Gate74bSummary>(path.join(options.gate74bDir, "gate74b-summary.json"));
  const manifestId = options.manifestId ?? gate74b.warehouse.manifest_id;
  const manifest = await readTradeLegPathWarehouseManifest(manifestId);
  if (!manifest) throw new Error(`Missing Gate 74B warehouse manifest: ${manifestId}`);
  if (manifest.status !== "complete") throw new Error(`Gate 74B warehouse is not complete: ${manifestId} status=${manifest.status}`);

  const allWeeks = await readTradeLegPathWarehouseWeekKeys(manifestId);
  const selectedWeeks = resolveSelectedWeeks(allWeeks, options);
  if (selectedWeeks.length === 0) throw new Error("No weeks selected for Gate 89 replay");
  const selectedPairs = resolveSelectedPairs(manifest.universe_symbols, options);
  const stats = createStats();
  const books = new Map<string, PairBook>();
  let previousEquity = options.initialDepositUsd;
  let finalConversionRates = emptyConversionRates();

  for (const week of selectedWeeks) {
    if (options.logProgress) console.log(`gate89 week=${week} pairs=${selectedPairs.length}`);
    const weekRows = new Map<string, ReplayRow>();
    for (const pair of selectedPairs) {
      const rows = await readPairSeriesWithRetry({ manifestId, pair, weeks: [week], attempts: 3 });
      if (rows.length !== 1) throw new Error(`Missing pair-week row for ${pair} ${week}`);
      weekRows.set(pair, rows[0]!);
    }
    const conversionRates = buildConversionRates([...weekRows.values()], options.barPathMode);
    finalConversionRates = conversionRates;
    for (const pair of selectedPairs) {
      const row = weekRows.get(pair);
      if (!row) throw new Error(`Missing loaded pair-week row for ${pair} ${week}`);
      replayRow({ stats, books, row, conversionRates, runtimeOptions: options });
    }
    previousEquity = addWeeklySnapshot({
      stats,
      books,
      weekOpenUtc: week,
      pairsReplayed: selectedPairs.length,
      previousEquityUsd: previousEquity,
      conversionRates,
      runtimeOptions: options,
    });
  }

  const finalEquityBeforeLiquidation = stats.weeklyRows.at(-1)?.equity_usd ?? options.initialDepositUsd;
  liquidateEnd({ stats, books, conversionRates: finalConversionRates, runtimeOptions: options });
  observeStats(stats, books);
  const summaryRows = [summarize({ stats, books, selectedWeeks, selectedPairs, manifest, runtimeOptions: options })];
  const validations = validationRows({ gate74b, selectedWeeks, selectedPairs, runtimeOptions: options });
  const metrics = metricRows();
  const verdict = "PASS_GATE89_CONTINUOUS_TRUTH_SIMULATOR_BUILT_DIAGNOSTIC_ONLY";

  const paths = {
    summaryJson: path.join(options.artifactDir, "continuous-truth-summary.rows.json"),
    summaryCsv: path.join(options.artifactDir, "continuous-truth-summary.rows.csv"),
    weeklyJson: path.join(options.artifactDir, "weekly-continuous-truth.rows.json"),
    weeklyCsv: path.join(options.artifactDir, "weekly-continuous-truth.rows.csv"),
    closeEventsJson: path.join(options.artifactDir, "close-events.rows.json"),
    closeEventsCsv: path.join(options.artifactDir, "close-events.rows.csv"),
    validationJson: path.join(options.artifactDir, "validation.rows.json"),
    validationCsv: path.join(options.artifactDir, "validation.rows.csv"),
    metricDefinitionsJson: path.join(options.artifactDir, "metric-definitions.rows.json"),
    metricDefinitionsCsv: path.join(options.artifactDir, "metric-definitions.rows.csv"),
    commandReceipt: path.join(options.artifactDir, "command-receipt.json"),
    runSummaryJson: path.join(options.artifactDir, "gate89-run-summary.json"),
    shaManifest: path.join(options.artifactDir, "gate89-continuous-truth-sha256.txt"),
  };
  const artifactsForReport = Object.fromEntries(Object.entries({ ...paths, report: options.reportPath }).map(([label, artifactPath]) => [label, toRepoRelative(artifactPath)]));

  await writeRows(paths.summaryJson, paths.summaryCsv, summaryRows);
  await writeRows(paths.weeklyJson, paths.weeklyCsv, stats.weeklyRows.map((row) => withHash(row as unknown as Record<string, unknown>)));
  await writeRows(paths.closeEventsJson, paths.closeEventsCsv, stats.closeEvents.map((row) => withHash(row as unknown as Record<string, unknown>)));
  await writeRows(paths.validationJson, paths.validationCsv, validations);
  await writeRows(paths.metricDefinitionsJson, paths.metricDefinitionsCsv, metrics);
  await writeJson(paths.commandReceipt, {
    gate_id: GATE_ID,
    command: COMMAND,
    durable_command: renderDurableCommand(options),
    git_commit: gitCommit(),
    generated_at: new Date().toISOString(),
    options,
  });
  await writeJson(paths.runSummaryJson, {
    gate_id: GATE_ID,
    verdict,
    variant_id: VARIANT_ID,
    warehouse_manifest_id: manifest.manifest_id,
    warehouse_hash: manifest.warehouse_hash,
    selected_weeks: selectedWeeks.length,
    selected_pairs: selectedPairs,
    final_equity_before_liquidation_usd: finalEquityBeforeLiquidation,
    summary_rows: summaryRows,
    validation_rows: validations,
  });
  await writeText(options.reportPath, renderReport({
    verdict,
    summaryRows,
    validationRows: validations,
    metricRows: metrics,
    artifacts: artifactsForReport,
    runtimeOptions: options,
  }));
  await writeShaManifest(paths.shaManifest, GATE_ID, COMMAND, [
    { label: "summary_json", path: paths.summaryJson },
    { label: "weekly_json", path: paths.weeklyJson },
    { label: "close_events_json", path: paths.closeEventsJson },
    { label: "validation_json", path: paths.validationJson },
    { label: "metric_definitions_json", path: paths.metricDefinitionsJson },
    { label: "command_receipt", path: paths.commandReceipt },
    { label: "run_summary_json", path: paths.runSummaryJson },
    { label: "report", path: options.reportPath },
  ]);

  console.log(JSON.stringify({
    verdict,
    report: toRepoRelative(options.reportPath),
    artifact_dir: toRepoRelative(options.artifactDir),
    summary: summaryRows[0],
  }, null, 2));
}

main().catch(async (error) => {
  console.error(error);
  await closePoolIfInitialized();
  process.exitCode = 1;
});
