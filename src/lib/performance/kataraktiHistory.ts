/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: src/lib/performance/kataraktiHistory.ts
 *
 * Description:
 * Loads Katarakti historical + live weekly snapshots across Core/Lite/V3
 * variants and normalizes them into a shared market snapshot model.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/
import { readFile } from "node:fs/promises";
import path from "node:path";
import { getOrSetRuntimeCache } from "@/lib/runtimeCache";
import { normalizeWeekOpenUtc } from "@/lib/weekAnchor";
import { query } from "@/lib/db";
import { KATARAKTI_SEED_SNAPSHOTS } from "@/lib/performance/kataraktiSeed";
import { getKataraktiStrategyRegistryEntry } from "@/lib/performance/strategyRegistry";

export type KataraktiMarket = "crypto_futures" | "mt5_forex";
export type KataraktiVariant = "core" | "lite" | "v3";

export type KataraktiWeeklySnapshot = {
  weekOpenUtc: string;
  returnPct: number;
  trades: number;
  wins: number;
  losses: number;
  winRatePct: number;
  avgTradePct: number | null;
  profitFactor: number | null;
  staticDrawdownPct: number;
  grossProfitUsd: number;
  grossLossUsd: number;
};

export type KataraktiTradeDetail = {
  weekOpenUtc: string;
  pair: string;
  direction: "LONG" | "SHORT" | "NEUTRAL";
  percent: number | null;
  reason: string[];
};

export type KataraktiMarketSnapshot = {
  market: KataraktiMarket;
  sourcePath: string;
  selectedVariantId: string | null;
  fallbackLabel?: string | null;
  weeks: number;
  weekly: KataraktiWeeklySnapshot[];
  weeklyReturnsPct: number[];
  totalReturnPct: number;
  totalPnlUsd: number;
  totalTrades: number;
  wins: number;
  winRatePct: number;
  tradeWinRatePct: number;
  avgTradePct: number | null;
  profitFactor: number | null;
  maxDrawdownPct: number | null;
  sharpe: number;
  tradeDetailsByWeek: Record<string, KataraktiTradeDetail[]>;
};

export type KataraktiHistoryByMarket = Record<KataraktiMarket, KataraktiMarketSnapshot | null>;

type CryptoWeeklySummaryRow = {
  week_open_utc?: unknown;
  weekly_return_pct?: unknown;
  cumulative_return_pct?: unknown;
  entries?: unknown;
  win_loss?: unknown;
};

type CryptoRunHistoryEntry = {
  weeks?: unknown;
  returns_pct?: Record<string, unknown>;
  max_dd_pct?: Record<string, unknown>;
  trades?: Record<string, unknown>;
};

type Mt5VariantWeeklyRow = {
  week_open_utc?: unknown;
  week_return_pct?: unknown;
  trades?: unknown;
  wins?: unknown;
  losses?: unknown;
  win_rate_pct?: unknown;
};

type Mt5VariantHeadline = {
  start_equity_usd?: unknown;
  total_return_pct?: unknown;
  compounded_return_pct?: unknown;
  max_drawdown_pct?: unknown;
  win_rate_pct?: unknown;
  trades?: unknown;
  avg_trade_return_pct?: unknown;
  risk_adjusted_return?: unknown;
};

type Mt5TradeLogRow = {
  id?: unknown;
  weekOpenUtc?: unknown;
  week_open_utc?: unknown;
  pair?: unknown;
  symbol?: unknown;
  direction?: unknown;
  entrySource?: unknown;
  entry_source?: unknown;
  exitReason?: unknown;
  exit_reason?: unknown;
  exitStep?: unknown;
  exit_step?: unknown;
  entryTimeUtc?: unknown;
  entry_time_utc?: unknown;
  entryTimeMs?: unknown;
  entry_time_ms?: unknown;
  exitTimeMs?: unknown;
  exit_time_ms?: unknown;
  exitTimeUtc?: unknown;
  exit_time_utc?: unknown;
  netPnlUsd?: unknown;
  net_pnl_usd?: unknown;
  returnPctOnEntryEquity?: unknown;
  return_pct_on_entry_equity?: unknown;
};

type Mt5Variant = {
  id?: unknown;
  headline?: Mt5VariantHeadline;
  weekly?: Mt5VariantWeeklyRow[];
  trades?: Mt5TradeLogRow[];
};

type Mt5BacktestReport = {
  config?: {
    starting_equity_usd?: unknown;
  };
  variants?: Mt5Variant[];
};

type LiveBitgetTradeRow = {
  week_open_utc: Date | string;
  symbol: string;
  direction: string;
  entry_price: number | string;
  exit_price: number | string;
  pnl_usd: number | string;
  exit_reason: string | null;
  session_window: string | null;
};

type LiveMt5TradeRow = {
  week_open_utc: Date | string;
  symbol: string;
  direction: string;
  entry_price: number | string;
  exit_price: number | string;
  pnl_pct: number | string | null;
  pnl_usd: number | string;
  exit_reason: string | null;
  exit_step: string | null;
};

type StrategyBacktestRunRow = {
  id: number | string;
  generated_utc: Date | string;
};

type StrategyBacktestWeeklyRow = {
  week_open_utc: Date | string;
  return_pct: number | string;
  trades: number | string;
  wins: number | string;
  losses: number | string;
  stop_hits: number | string;
  drawdown_pct: number | string;
  gross_profit_pct: number | string;
  gross_loss_pct: number | string;
  equity_end_pct: number | string | null;
  pnl_usd: number | string | null;
};

type StrategyBacktestTradeRow = {
  week_open_utc: Date | string;
  symbol: string | null;
  direction: string | null;
  entry_time_utc: Date | string | null;
  exit_time_utc: Date | string | null;
  pnl_pct: number | string | null;
  exit_reason: string | null;
  max_milestone: number | string | null;
  leverage_at_exit: number | string | null;
};

const DEFAULT_STARTING_EQUITY_USD = 100_000;
const DEFAULT_CACHE_TTL_MS = 30_000;
const CRYPTO_WEEKLY_SUMMARY_PATH = "docs/bots/backtest-weekly-summary.json";
const CRYPTO_RUN_HISTORY_PATH = "docs/bots/backtest-run-history.json";
const CRYPTO_TRADE_LOG_PATH = "docs/bots/backtest-trade-log.json";
const DEFAULT_CRYPTO_VARIANT_KEY = "C";
const PINNED_MT5_VARIANT_ID = "tiered__t1t2__weighted";
const MT5_REPORT_CANDIDATES = [
  "reports/katarakti-phase1-backtest-latest-phase2_full_atr_nohard.json",
  "reports/katarakti-phase1-backtest-latest.json",
] as const;
const LITE_PENDING_LABEL = "Lite backtest pending";

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function toInteger(value: unknown): number {
  const parsed = toNumber(value);
  if (parsed === null) return 0;
  return Math.max(0, Math.round(parsed));
}

function getConfiguredStartingEquityUsd(fallback: number) {
  const configured = toNumber(process.env.KATARAKTI_STARTING_EQUITY_USD);
  return configured !== null && configured > 0 ? configured : fallback;
}

function getConfiguredCacheTtlMs() {
  const configured = toNumber(process.env.KATARAKTI_HISTORY_CACHE_TTL_MS);
  if (configured === null || configured < 0) return DEFAULT_CACHE_TTL_MS;
  return Math.floor(configured);
}

function parseWinLoss(value: unknown) {
  if (typeof value !== "string") return { wins: 0, losses: 0 };
  const match = value.trim().match(/^(\d+)\s*\/\s*(\d+)$/);
  if (!match) return { wins: 0, losses: 0 };
  return {
    wins: Number(match[1]) || 0,
    losses: Number(match[2]) || 0,
  };
}

function parseIsoUtc(value: unknown): string | null {
  if (typeof value !== "string" || value.trim().length === 0) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toISOString();
}

function canonicalWeek(weekOpenUtc: string | null): string | null {
  if (!weekOpenUtc) return null;
  return normalizeWeekOpenUtc(weekOpenUtc) ?? weekOpenUtc;
}

function computeProfitFactor(grossProfit: number, grossLoss: number): number | null {
  if (!Number.isFinite(grossProfit) || !Number.isFinite(grossLoss)) return null;
  if (grossLoss > 0) return grossProfit / grossLoss;
  if (grossProfit > 0) return Number.POSITIVE_INFINITY;
  return null;
}

function weightedAverage(items: Array<{ value: number | null; weight: number }>): number | null {
  let weightedSum = 0;
  let totalWeight = 0;
  for (const item of items) {
    if (item.value === null || !Number.isFinite(item.value)) continue;
    if (!Number.isFinite(item.weight) || item.weight <= 0) continue;
    weightedSum += item.value * item.weight;
    totalWeight += item.weight;
  }
  if (totalWeight <= 0) return null;
  return weightedSum / totalWeight;
}

function directionAdjustedReturnPct(direction: string, entryPrice: number, exitPrice: number) {
  if (!Number.isFinite(entryPrice) || !Number.isFinite(exitPrice) || entryPrice <= 0) return 0;
  if (direction === "SHORT") {
    return ((entryPrice - exitPrice) / entryPrice) * 100;
  }
  return ((exitPrice - entryPrice) / entryPrice) * 100;
}

function normalizeDirection(value: unknown): "LONG" | "SHORT" | "NEUTRAL" {
  if (value === "LONG" || value === "SHORT" || value === "NEUTRAL") {
    return value;
  }
  return "NEUTRAL";
}

function normalizePairLabel(value: unknown, fallback: string) {
  if (typeof value !== "string") return fallback;
  const trimmed = value.trim().toUpperCase();
  if (!trimmed) return fallback;
  if (trimmed.includes("USD")) return trimmed;
  if (trimmed.length <= 6) return `${trimmed}USD`;
  return trimmed;
}

function buildReasonList(items: Array<string | null | undefined>) {
  return items
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
}

function sortWeeksAsc<T extends { weekOpenUtc: string }>(rows: T[]) {
  return [...rows].sort(
    (left, right) =>
      new Date(left.weekOpenUtc).getTime() - new Date(right.weekOpenUtc).getTime(),
  );
}

async function safeQuery<T>(sql: string, params?: readonly unknown[]): Promise<T[]> {
  try {
    return await query<T>(sql, params);
  } catch {
    return [];
  }
}

function buildWeeklyFromLiveTrades(
  rows: Array<{
    weekOpenUtc: string;
    returnPct: number;
    pnlUsd: number;
  }>,
): KataraktiWeeklySnapshot[] {
  const byWeek = new Map<string, Array<{ returnPct: number; pnlUsd: number }>>();
  for (const row of rows) {
    const weekRows = byWeek.get(row.weekOpenUtc) ?? [];
    weekRows.push({ returnPct: row.returnPct, pnlUsd: row.pnlUsd });
    byWeek.set(row.weekOpenUtc, weekRows);
  }

  return sortWeeksAsc(
    Array.from(byWeek.entries()).map(([weekOpenUtc, trades]) => {
      let runningPct = 0;
      let minRunningPct = 0;
      let grossProfit = 0;
      let grossLoss = 0;
      let wins = 0;
      let losses = 0;
      for (const trade of trades) {
        runningPct += trade.returnPct;
        if (runningPct < minRunningPct) {
          minRunningPct = runningPct;
        }
        if (trade.returnPct > 0) {
          wins += 1;
          grossProfit += trade.returnPct;
        } else if (trade.returnPct < 0) {
          losses += 1;
          grossLoss += Math.abs(trade.returnPct);
        }
      }

      const returnPct = trades.reduce((sum, trade) => sum + trade.returnPct, 0);
      const tradeCount = trades.length;
      return {
        weekOpenUtc,
        returnPct,
        trades: tradeCount,
        wins,
        losses,
        winRatePct: tradeCount > 0 ? (wins / tradeCount) * 100 : 0,
        avgTradePct: tradeCount > 0 ? returnPct / tradeCount : null,
        profitFactor: computeProfitFactor(grossProfit, grossLoss),
        staticDrawdownPct: Math.abs(minRunningPct),
        grossProfitUsd: grossProfit,
        grossLossUsd: grossLoss,
      } satisfies KataraktiWeeklySnapshot;
    }),
  );
}

type LiveTradeRow = {
  weekOpenUtc: string;
  pair: string;
  direction: "LONG" | "SHORT" | "NEUTRAL";
  percent: number | null;
  reason: string[];
};

function buildTradeDetailsByWeek(rows: LiveTradeRow[]) {
  const byWeek = new Map<string, KataraktiTradeDetail[]>();
  for (const row of rows) {
    const list = byWeek.get(row.weekOpenUtc) ?? [];
    list.push({
      weekOpenUtc: row.weekOpenUtc,
      pair: row.pair,
      direction: row.direction,
      percent: row.percent,
      reason: row.reason,
    });
    byWeek.set(row.weekOpenUtc, list);
  }
  return Object.fromEntries(byWeek.entries());
}

function buildSeedWeeklySnapshots(market: KataraktiMarket): KataraktiWeeklySnapshot[] {
  const seed = KATARAKTI_SEED_SNAPSHOTS[market];
  return sortWeeksAsc(
    seed.weekly.map((row) => {
      const grossProfit = row.returnPct > 0 ? row.returnPct : 0;
      const grossLoss = row.returnPct < 0 ? Math.abs(row.returnPct) : 0;
      return {
        weekOpenUtc: row.weekOpenUtc,
        returnPct: row.returnPct,
        trades: row.trades,
        wins: row.wins,
        losses: row.losses,
        winRatePct: row.trades > 0 ? (row.wins / row.trades) * 100 : 0,
        avgTradePct: row.trades > 0 ? row.returnPct / row.trades : null,
        profitFactor: computeProfitFactor(grossProfit, grossLoss),
        staticDrawdownPct: row.staticDrawdownPct,
        grossProfitUsd: grossProfit,
        grossLossUsd: grossLoss,
      } satisfies KataraktiWeeklySnapshot;
    }),
  );
}

function toSnapshotFromWeekly(options: {
  market: KataraktiMarket;
  sourcePath: string;
  selectedVariantId: string | null;
  fallbackLabel?: string | null;
  weekly: KataraktiWeeklySnapshot[];
  tradeDetailsByWeek?: Record<string, KataraktiTradeDetail[]>;
  totalReturnPctOverride?: number | null;
  maxDrawdownOverride?: number | null;
  startingEquityUsdOverride?: number | null;
}) {
  const weekly = sortWeeksAsc(options.weekly);
  if (weekly.length === 0) return null;
  const weeklyReturnsPct = weekly.map((week) => week.returnPct);
  const totalReturnPct =
    options.totalReturnPctOverride ?? weeklyReturnsPct.reduce((sum, value) => sum + value, 0);
  const startingEquityUsd = options.startingEquityUsdOverride ?? getConfiguredStartingEquityUsd(DEFAULT_STARTING_EQUITY_USD);
  const totalPnlUsd = (totalReturnPct / 100) * startingEquityUsd;
  const totalTrades = weekly.reduce((sum, week) => sum + week.trades, 0);
  const wins = weekly.reduce((sum, week) => sum + week.wins, 0);
  const grossProfit = weekly.reduce((sum, week) => sum + week.grossProfitUsd, 0);
  const grossLoss = weekly.reduce((sum, week) => sum + week.grossLossUsd, 0);
  const worstWeekDrawdown = computeWorstWeekDrawdownFromWeeklyReturns(weeklyReturnsPct);
  const computedMaxDrawdown = weekly.reduce(
    (max, week) => Math.max(max, week.staticDrawdownPct),
    0,
  );
  const overrideMaxDrawdown = options.maxDrawdownOverride ?? 0;
  const maxDrawdownCandidate = Math.max(
    computedMaxDrawdown,
    worstWeekDrawdown,
    overrideMaxDrawdown,
  );
  const maxDrawdownPct = maxDrawdownCandidate > 0 ? maxDrawdownCandidate : 0;
  const winRatePct = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;
  const tradeDetailsByWeek = Object.fromEntries(
    Object.entries(options.tradeDetailsByWeek ?? {})
      .flatMap(([weekOpenUtc, details]) => {
        const canonical = canonicalWeek(parseIsoUtc(weekOpenUtc));
        if (!canonical || !Array.isArray(details) || details.length === 0) {
          return [];
        }
        const normalizedDetails = details
          .map((detail) => ({
            weekOpenUtc: canonical,
            pair: typeof detail.pair === "string" && detail.pair.trim().length > 0
              ? detail.pair.trim()
              : "TRADE",
            direction: normalizeDirection(detail.direction),
            percent: detail.percent,
            reason: buildReasonList(detail.reason),
          }))
          .filter((detail) => Number.isFinite(detail.percent ?? 0) || detail.reason.length > 0);
        if (normalizedDetails.length === 0) {
          return [];
        }
        return [[canonical, normalizedDetails] as const];
      }),
  );
  return {
    market: options.market,
    sourcePath: options.sourcePath,
    selectedVariantId: options.selectedVariantId,
    fallbackLabel: options.fallbackLabel ?? null,
    weekly,
    weeks: weekly.length,
    weeklyReturnsPct,
    totalReturnPct,
    totalPnlUsd,
    totalTrades,
    wins,
    winRatePct,
    tradeWinRatePct: winRatePct,
    avgTradePct: weightedAverage(
      weekly.map((week) => ({
        value: week.avgTradePct,
        weight: week.trades,
      })),
    ),
    profitFactor: computeProfitFactor(grossProfit, grossLoss),
    maxDrawdownPct,
    sharpe: computeSharpe(weeklyReturnsPct),
    tradeDetailsByWeek,
  } satisfies KataraktiMarketSnapshot;
}

function appendLiveWeeks(options: {
  market: KataraktiMarket;
  base: KataraktiMarketSnapshot | null;
  live: KataraktiWeeklySnapshot[];
  liveTradeDetailsByWeek?: Record<string, KataraktiTradeDetail[]>;
}) {
  const baseWeeks = options.base ? sortWeeksAsc(options.base.weekly) : [];
  const liveWeeks = sortWeeksAsc(options.live);
  if (baseWeeks.length === 0 && liveWeeks.length === 0) {
    return null;
  }

  // Live should override overlapping backfill weeks so forward-tested trades
  // are visible immediately, including the same week as the latest backfill.
  const mergedByWeek = new Map<string, KataraktiWeeklySnapshot>();
  for (const week of baseWeeks) mergedByWeek.set(week.weekOpenUtc, week);
  for (const week of liveWeeks) mergedByWeek.set(week.weekOpenUtc, week);
  const mergedWeekly = sortWeeksAsc(Array.from(mergedByWeek.values()));
  const mergedSource = options.base
    ? liveWeeks.length > 0
      ? `${options.base.sourcePath}+db:live`
      : options.base.sourcePath
    : liveWeeks.length > 0
      ? "db:live"
      : "db:sim";
  const liveWeeksSet = new Set(liveWeeks.map((week) => week.weekOpenUtc));
  const filteredLiveTradeDetailsByWeek = Object.fromEntries(
    Object.entries(options.liveTradeDetailsByWeek ?? {}).filter(([week]) => liveWeeksSet.has(week)),
  );
  const mergedTradeDetailsByWeek = {
    ...(options.base?.tradeDetailsByWeek ?? {}),
    ...filteredLiveTradeDetailsByWeek,
  };

  return toSnapshotFromWeekly({
    market: options.market,
    sourcePath: mergedSource,
    selectedVariantId: options.base?.selectedVariantId ?? null,
    fallbackLabel: options.base?.fallbackLabel ?? null,
    weekly: mergedWeekly,
    tradeDetailsByWeek: mergedTradeDetailsByWeek,
    totalReturnPctOverride: null,
    maxDrawdownOverride: null,
    startingEquityUsdOverride: null,
  });
}

function getConfiguredCryptoBacktestStartBalanceUsd() {
  const configured = toNumber(process.env.KATARAKTI_CRYPTO_BACKTEST_START_BALANCE_USD);
  return configured !== null && configured > 0 ? configured : 1_000;
}

type CryptoTradeLogRow = {
  id?: unknown;
  strategy?: unknown;
  symbol?: unknown;
  direction?: unknown;
  trigger?: unknown;
  exit_reason?: unknown;
  entry_time_utc?: unknown;
  week_open_utc?: unknown;
  exit_time_utc?: unknown;
  exitTimeUtc?: unknown;
  entry_price?: unknown;
  exit_price?: unknown;
  pnl_usd?: unknown;
  unlevered_pnl_pct?: unknown;
  balance_after_usd?: unknown;
};

type ParsedCryptoTrade = {
  id: number;
  strategy: string;
  symbol: string;
  direction: "LONG" | "SHORT" | "NEUTRAL";
  trigger: string | null;
  exitReason: string | null;
  entryTimeUtc: string | null;
  weekOpenUtc: string;
  exitTimeUtc: string | null;
  pnlUsd: number;
  unleveredPnlPct: number | null;
  returnPct: number | null;
  balanceAfterUsd: number | null;
};

function parseCryptoTradeRows(rows: unknown[]): ParsedCryptoTrade[] {
  return rows.flatMap((raw) => {
    if (!raw || typeof raw !== "object") return [];
    const row = raw as CryptoTradeLogRow;
    const strategy = typeof row.strategy === "string" ? row.strategy.trim() : "";
    if (!strategy) return [];
    const weekOpenUtc = canonicalWeek(parseIsoUtc(row.week_open_utc));
    if (!weekOpenUtc) return [];
    const id = toInteger(row.id);
    const symbol = normalizePairLabel(row.symbol, `TRADE_${id || "X"}`);
    const direction = normalizeDirection(row.direction);
    const trigger = typeof row.trigger === "string" ? row.trigger.trim() : null;
    const exitReason = typeof row.exit_reason === "string" ? row.exit_reason.trim() : null;
    const entryTimeUtc = parseIsoUtc(row.entry_time_utc);
    const exitTimeUtc = parseIsoUtc(row.exit_time_utc) ?? parseIsoUtc(row.exitTimeUtc);
    const unleveredPnlPct = toNumber(row.unlevered_pnl_pct);
    const entryPrice = toNumber(row.entry_price);
    const exitPrice = toNumber(row.exit_price);
    const returnPct =
      unleveredPnlPct ??
      (entryPrice !== null && exitPrice !== null
        ? directionAdjustedReturnPct(direction, entryPrice, exitPrice)
        : null);
    return [{
      id,
      strategy,
      symbol,
      direction,
      trigger,
      exitReason,
      entryTimeUtc,
      weekOpenUtc,
      exitTimeUtc,
      pnlUsd: toNumber(row.pnl_usd) ?? 0,
      unleveredPnlPct,
      returnPct,
      balanceAfterUsd: toNumber(row.balance_after_usd),
    }];
  });
}

function buildCryptoTradeDetailsByWeek(
  trades: ParsedCryptoTrade[],
): Record<string, KataraktiTradeDetail[]> {
  const sorted = [...trades].sort((left, right) => {
    const leftTime = left.exitTimeUtc
      ? new Date(left.exitTimeUtc).getTime()
      : left.entryTimeUtc
        ? new Date(left.entryTimeUtc).getTime()
        : Number.POSITIVE_INFINITY;
    const rightTime = right.exitTimeUtc
      ? new Date(right.exitTimeUtc).getTime()
      : right.entryTimeUtc
        ? new Date(right.entryTimeUtc).getTime()
        : Number.POSITIVE_INFINITY;
    if (leftTime !== rightTime) return leftTime - rightTime;
    return left.id - right.id;
  });
  const byWeek = new Map<string, KataraktiTradeDetail[]>();
  for (const trade of sorted) {
    const details = byWeek.get(trade.weekOpenUtc) ?? [];
    details.push({
      weekOpenUtc: trade.weekOpenUtc,
      pair: trade.symbol,
      direction: trade.direction,
      percent: trade.returnPct,
      reason: buildReasonList([
        `Strategy ${trade.strategy}`,
        trade.trigger ? `Trigger ${trade.trigger}` : null,
        trade.exitReason ? `Exit ${trade.exitReason}` : null,
      ]),
    });
    byWeek.set(trade.weekOpenUtc, details);
  }
  return Object.fromEntries(byWeek.entries());
}

function resolveCryptoStrategyName(trades: ParsedCryptoTrade[], variantKey: string): string | null {
  const override = process.env.KATARAKTI_CRYPTO_STRATEGY_NAME?.trim();
  const strategies = Array.from(new Set(trades.map((trade) => trade.strategy)));
  if (strategies.length === 0) return null;
  if (override) {
    const exact = strategies.find((strategy) => strategy === override);
    if (exact) return exact;
    const lower = strategies.find((strategy) => strategy.toLowerCase() === override.toLowerCase());
    if (lower) return lower;
  }

  if (variantKey.length > 0) {
    const normalized = variantKey.trim().toUpperCase();
    const prefix = normalized.length === 1 ? `${normalized}_` : normalized;
    const byPrefix = strategies.find((strategy) => strategy.toUpperCase().startsWith(prefix));
    if (byPrefix) return byPrefix;
  }
  return null;
}

function inferCryptoStartBalanceUsd(
  trades: ParsedCryptoTrade[],
  fallback: number,
) {
  const sorted = [...trades].sort((left, right) => {
    const leftTime = left.exitTimeUtc ? new Date(left.exitTimeUtc).getTime() : Number.POSITIVE_INFINITY;
    const rightTime = right.exitTimeUtc ? new Date(right.exitTimeUtc).getTime() : Number.POSITIVE_INFINITY;
    if (leftTime !== rightTime) return leftTime - rightTime;
    return left.id - right.id;
  });

  const firstWithBalance = sorted.find(
    (trade) => trade.balanceAfterUsd !== null && Number.isFinite(trade.balanceAfterUsd),
  );
  if (!firstWithBalance || firstWithBalance.balanceAfterUsd === null) return fallback;
  const inferred = firstWithBalance.balanceAfterUsd - firstWithBalance.pnlUsd;
  return Number.isFinite(inferred) && inferred > 0 ? inferred : fallback;
}

function buildStaticDrawdownPctFromTradePnl(
  weekStartBalance: number,
  trades: ParsedCryptoTrade[],
) {
  if (!Number.isFinite(weekStartBalance) || weekStartBalance <= 0 || trades.length === 0) {
    return 0;
  }
  let runningBalance = weekStartBalance;
  let minBalance = weekStartBalance;
  const sorted = [...trades].sort((left, right) => {
    const leftTime = left.exitTimeUtc ? new Date(left.exitTimeUtc).getTime() : Number.POSITIVE_INFINITY;
    const rightTime = right.exitTimeUtc ? new Date(right.exitTimeUtc).getTime() : Number.POSITIVE_INFINITY;
    if (leftTime !== rightTime) return leftTime - rightTime;
    return left.id - right.id;
  });
  for (const trade of sorted) {
    runningBalance += trade.pnlUsd;
    if (runningBalance < minBalance) {
      minBalance = runningBalance;
    }
  }
  return ((weekStartBalance - minBalance) / weekStartBalance) * 100;
}

async function buildCryptoWeeklyFromTradeLog(options: {
  variantKey: string;
  runHistoryWeeks: string[];
}): Promise<{
  weekly: KataraktiWeeklySnapshot[];
  tradeDetailsByWeek: Record<string, KataraktiTradeDetail[]>;
} | null> {
  const tradeLogPath = process.env.KATARAKTI_CRYPTO_TRADE_LOG_PATH?.trim() || CRYPTO_TRADE_LOG_PATH;
  const rawRows = await readJsonFile<unknown[]>(tradeLogPath);
  if (!Array.isArray(rawRows) || rawRows.length === 0) {
    return null;
  }
  const parsedTrades = parseCryptoTradeRows(rawRows);
  if (parsedTrades.length === 0) {
    return null;
  }

  const strategyName = resolveCryptoStrategyName(parsedTrades, options.variantKey);
  if (!strategyName) {
    return null;
  }
  const strategyTrades = parsedTrades.filter((trade) => trade.strategy === strategyName);
  if (strategyTrades.length === 0) {
    return null;
  }

  const tradeWeeks = Array.from(new Set(strategyTrades.map((trade) => trade.weekOpenUtc)));
  const hintedWeeks = options.runHistoryWeeks
    .map((week) => canonicalWeek(parseIsoUtc(week)))
    .filter((week): week is string => Boolean(week));
  const weeks = Array.from(new Set([...hintedWeeks, ...tradeWeeks])).sort(
    (left, right) => new Date(left).getTime() - new Date(right).getTime(),
  );
  if (weeks.length === 0) {
    return null;
  }

  const startBalanceFallback = getConfiguredCryptoBacktestStartBalanceUsd();
  let weekStartBalance = inferCryptoStartBalanceUsd(strategyTrades, startBalanceFallback);
  const weekly: KataraktiWeeklySnapshot[] = [];

  for (const weekOpenUtc of weeks) {
    const weekTrades = strategyTrades.filter((trade) => trade.weekOpenUtc === weekOpenUtc);
    const weekPnlUsd = weekTrades.reduce((sum, trade) => sum + trade.pnlUsd, 0);
    const returnPct =
      weekStartBalance > 0 ? (weekPnlUsd / weekStartBalance) * 100 : 0;
    const trades = weekTrades.length;
    const wins = weekTrades.filter((trade) => trade.pnlUsd > 0).length;
    const losses = weekTrades.filter((trade) => trade.pnlUsd < 0).length;
    const winRatePct = trades > 0 ? (wins / trades) * 100 : 0;
    const grossProfitUsd = weekTrades
      .filter((trade) => trade.pnlUsd > 0)
      .reduce((sum, trade) => sum + trade.pnlUsd, 0);
    const grossLossUsd = Math.abs(
      weekTrades
        .filter((trade) => trade.pnlUsd < 0)
        .reduce((sum, trade) => sum + trade.pnlUsd, 0),
    );
    const unleveredReturns = weekTrades
      .map((trade) => trade.unleveredPnlPct)
      .filter((value): value is number => value !== null);
    const avgTradePct =
      unleveredReturns.length > 0
        ? unleveredReturns.reduce((sum, value) => sum + value, 0) / unleveredReturns.length
        : null;
    const staticDrawdownPct =
      trades > 0
        ? buildStaticDrawdownPctFromTradePnl(weekStartBalance, weekTrades)
        : 0;

    weekly.push({
      weekOpenUtc,
      returnPct,
      trades,
      wins,
      losses,
      winRatePct,
      avgTradePct,
      profitFactor: computeProfitFactor(grossProfitUsd, grossLossUsd),
      staticDrawdownPct,
      grossProfitUsd,
      grossLossUsd,
    });

    weekStartBalance += weekPnlUsd;
  }

  return {
    weekly,
    tradeDetailsByWeek: buildCryptoTradeDetailsByWeek(strategyTrades),
  };
}

function buildCryptoWeeklyFromSummary(rows: CryptoWeeklySummaryRow[]): KataraktiWeeklySnapshot[] {
  const weekly = rows.flatMap((row) => {
    const weekOpenUtc = canonicalWeek(parseIsoUtc(row.week_open_utc));
    const returnPct = toNumber(row.weekly_return_pct);
    if (!weekOpenUtc || returnPct === null) return [];
    const { wins, losses } = parseWinLoss(row.win_loss);
    const trades = toInteger(row.entries) || (wins + losses);
    const staticDrawdownPct = returnPct < 0 ? Math.abs(returnPct) : 0;
    const grossProfitUsd = returnPct > 0 ? returnPct : 0;
    const grossLossUsd = returnPct < 0 ? Math.abs(returnPct) : 0;
    return [{
      weekOpenUtc,
      returnPct,
      trades,
      wins,
      losses,
      winRatePct: trades > 0 ? (wins / trades) * 100 : 0,
      avgTradePct: trades > 0 ? returnPct / trades : null,
      profitFactor: computeProfitFactor(grossProfitUsd, grossLossUsd),
      staticDrawdownPct,
      grossProfitUsd,
      grossLossUsd,
    } satisfies KataraktiWeeklySnapshot];
  });

  return weekly.sort(
    (left, right) =>
      new Date(left.weekOpenUtc).getTime() - new Date(right.weekOpenUtc).getTime(),
  );
}

function computeSharpe(weeklyReturnsPct: number[]) {
  const weeks = weeklyReturnsPct.length;
  if (weeks <= 1) return 0;
  const mean = weeklyReturnsPct.reduce((sum, value) => sum + value, 0) / weeks;
  if (mean === 0) return 0;
  const variance =
    weeklyReturnsPct.reduce((sum, value) => {
      const diff = value - mean;
      return sum + diff * diff;
    }, 0) / (weeks - 1);
  const stdDev = Math.sqrt(variance);
  return stdDev > 0 ? mean / stdDev : 0;
}

function computeWorstWeekDrawdownFromWeeklyReturns(weeklyReturnsPct: number[]) {
  if (weeklyReturnsPct.length === 0) return 0;
  return weeklyReturnsPct.reduce((maxLoss, weekReturn) => {
    if (!Number.isFinite(weekReturn) || weekReturn >= 0) return maxLoss;
    return Math.max(maxLoss, Math.abs(weekReturn));
  }, 0);
}

async function readJsonFile<T>(relativePath: string): Promise<T | null> {
  try {
    const absolutePath = path.join(process.cwd(), relativePath);
    const raw = await readFile(absolutePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

async function readFirstJsonCandidate<T>(paths: readonly string[]) {
  for (const candidate of paths) {
    const parsed = await readJsonFile<T>(candidate);
    if (parsed !== null) {
      return { parsed, sourcePath: candidate };
    }
  }
  return null;
}

type SimpleBacktestTradeRow = {
  symbol?: unknown;
  direction?: unknown;
  entry_time_utc?: unknown;
  exit_time_utc?: unknown;
  pnl_pct?: unknown;
  pnl_usd?: unknown;
  exit_reason?: unknown;
  max_milestone?: unknown;
  leverage_at_exit?: unknown;
};

type SimpleBacktestWeeklyRow = {
  week_open_utc?: unknown;
  trades?: unknown;
  wins?: unknown;
  losses?: unknown;
  pnl_pct?: unknown;
  pnl_usd?: unknown;
  max_drawdown_pct?: unknown;
};

type SimpleBacktestSummary = {
  total_return_pct?: unknown;
  max_drawdown_pct?: unknown;
};

type SimpleBacktestMeta = {
  botId?: unknown;
  offsetPct?: unknown;
};

type SimpleBacktestReport = {
  meta?: SimpleBacktestMeta;
  weekly?: SimpleBacktestWeeklyRow[];
  summary?: SimpleBacktestSummary;
  trades?: SimpleBacktestTradeRow[];
};

function buildTradeDetailsFromSimpleBacktestTrades(
  trades: SimpleBacktestTradeRow[],
): Record<string, KataraktiTradeDetail[]> {
  const byWeek = new Map<string, KataraktiTradeDetail[]>();
  const parsed = trades.flatMap((rawTrade, index) => {
    const entryTimeUtc = parseIsoUtc(rawTrade.entry_time_utc);
    const weekOpenUtc = canonicalWeek(entryTimeUtc);
    if (!weekOpenUtc) return [];
    const pair = normalizePairLabel(rawTrade.symbol, `TRADE_${index + 1}`);
    const direction = normalizeDirection(rawTrade.direction);
    const percent = toNumber(rawTrade.pnl_pct);
    const exitReason = typeof rawTrade.exit_reason === "string" ? rawTrade.exit_reason : null;
    const milestone = toNumber(rawTrade.max_milestone);
    const leverage = toNumber(rawTrade.leverage_at_exit);
    const entrySortMs = entryTimeUtc ? new Date(entryTimeUtc).getTime() : Number.POSITIVE_INFINITY;
    return [{
      weekOpenUtc,
      entrySortMs,
      detail: {
        weekOpenUtc,
        pair,
        direction,
        percent,
        reason: buildReasonList([
          exitReason ? `Exit ${exitReason}` : null,
          milestone !== null ? `Milestone ${Math.round(milestone)}` : null,
          leverage !== null ? `Lev ${leverage}x` : null,
        ]),
      } satisfies KataraktiTradeDetail,
    }];
  });

  for (const row of parsed.sort((a, b) => a.entrySortMs - b.entrySortMs)) {
    const list = byWeek.get(row.weekOpenUtc) ?? [];
    list.push(row.detail);
    byWeek.set(row.weekOpenUtc, list);
  }
  return Object.fromEntries(byWeek.entries());
}

function parseSimpleBacktestSnapshot(options: {
  market: KataraktiMarket;
  sourcePath: string;
  selectedVariantId: string;
  report: SimpleBacktestReport;
}): KataraktiMarketSnapshot | null {
  const reportWeekly = Array.isArray(options.report.weekly) ? options.report.weekly : [];
  const reportTrades = Array.isArray(options.report.trades) ? options.report.trades : [];
  const tradeDetailsByWeek = buildTradeDetailsFromSimpleBacktestTrades(reportTrades);

  const weekly = sortWeeksAsc(
    reportWeekly.flatMap((raw) => {
      const weekOpenUtc = canonicalWeek(parseIsoUtc(raw.week_open_utc));
      if (!weekOpenUtc) return [];
      const returnPct = toNumber(raw.pnl_pct) ?? 0;
      const trades = toInteger(raw.trades);
      const wins = toInteger(raw.wins);
      const losses = toInteger(raw.losses);
      const weekTrades = (tradeDetailsByWeek[weekOpenUtc] ?? [])
        .map((detail) => detail.percent)
        .filter((value): value is number => value !== null && Number.isFinite(value));
      const grossProfit = weekTrades.filter((value) => value > 0).reduce((sum, value) => sum + value, 0);
      const grossLoss = Math.abs(weekTrades.filter((value) => value < 0).reduce((sum, value) => sum + value, 0));
      const avgTradePct = weekTrades.length > 0
        ? weekTrades.reduce((sum, value) => sum + value, 0) / weekTrades.length
        : trades > 0
          ? returnPct / trades
          : null;
      return [{
        weekOpenUtc,
        returnPct,
        trades,
        wins,
        losses,
        winRatePct: trades > 0 ? (wins / trades) * 100 : 0,
        avgTradePct,
        profitFactor: computeProfitFactor(grossProfit, grossLoss),
        staticDrawdownPct: toNumber(raw.max_drawdown_pct) ?? (returnPct < 0 ? Math.abs(returnPct) : 0),
        grossProfitUsd: grossProfit,
        grossLossUsd: grossLoss,
      } satisfies KataraktiWeeklySnapshot];
    }),
  );

  if (weekly.length === 0) return null;
  const summaryTotalReturn = toNumber(options.report.summary?.total_return_pct);
  const summaryMaxDd = toNumber(options.report.summary?.max_drawdown_pct);
  return toSnapshotFromWeekly({
    market: options.market,
    sourcePath: options.sourcePath,
    selectedVariantId: options.selectedVariantId,
    weekly,
    tradeDetailsByWeek,
    totalReturnPctOverride: summaryTotalReturn,
    maxDrawdownOverride: summaryMaxDd,
    startingEquityUsdOverride: null,
  });
}

async function readFirstValidSimpleBacktestSnapshot(options: {
  market: KataraktiMarket;
  selectedVariantId: string;
  candidatePaths: readonly string[];
}) {
  for (const candidatePath of options.candidatePaths) {
    const report = await readJsonFile<SimpleBacktestReport>(candidatePath);
    if (!report) continue;
    const snapshot = parseSimpleBacktestSnapshot({
      market: options.market,
      sourcePath: candidatePath,
      selectedVariantId: options.selectedVariantId,
      report,
    });
    if (snapshot) {
      return snapshot;
    }
  }
  return null;
}

function buildTradeDetailsFromBacktestStoreTrades(
  trades: StrategyBacktestTradeRow[],
): Record<string, KataraktiTradeDetail[]> {
  const parsed = trades.flatMap((trade, index) => {
    const weekOpenUtc = canonicalWeek(
      trade.week_open_utc instanceof Date
        ? trade.week_open_utc.toISOString()
        : parseIsoUtc(trade.week_open_utc),
    );
    if (!weekOpenUtc) return [];
    const entryIso = trade.entry_time_utc instanceof Date
      ? trade.entry_time_utc.toISOString()
      : parseIsoUtc(trade.entry_time_utc);
    const exitIso = trade.exit_time_utc instanceof Date
      ? trade.exit_time_utc.toISOString()
      : parseIsoUtc(trade.exit_time_utc);
    const sortTs =
      (exitIso ? new Date(exitIso).getTime() : null) ??
      (entryIso ? new Date(entryIso).getTime() : null) ??
      Number.POSITIVE_INFINITY;
    const milestone = toNumber(trade.max_milestone);
    const leverage = toNumber(trade.leverage_at_exit);
    return [{
      weekOpenUtc,
      sortTs,
      detail: {
        weekOpenUtc,
        pair: normalizePairLabel(trade.symbol, `TRADE_${index + 1}`),
        direction: normalizeDirection(trade.direction),
        percent: toNumber(trade.pnl_pct),
        reason: buildReasonList([
          typeof trade.exit_reason === "string" ? `Exit ${trade.exit_reason}` : null,
          milestone !== null ? `Milestone ${Math.round(milestone)}` : null,
          leverage !== null ? `Lev ${leverage}x` : null,
        ]),
      } satisfies KataraktiTradeDetail,
    }];
  });
  const byWeek = new Map<string, Array<{ sortTs: number; detail: KataraktiTradeDetail }>>();
  for (const row of parsed) {
    const list = byWeek.get(row.weekOpenUtc) ?? [];
    list.push({ sortTs: row.sortTs, detail: row.detail });
    byWeek.set(row.weekOpenUtc, list);
  }
  return Object.fromEntries(
    Array.from(byWeek.entries()).map(([weekOpenUtc, rows]) => [
      weekOpenUtc,
      rows
        .sort((left, right) => left.sortTs - right.sortTs)
        .map((row) => row.detail),
    ]),
  );
}

async function readBacktestStoreSnapshot(options: {
  market: KataraktiMarket;
  variant: KataraktiVariant;
  selectedVariantId: string;
  botId: string;
  configKey?: string | null;
}): Promise<KataraktiMarketSnapshot | null> {
  const runQueryBase =
    `SELECT id, generated_utc
     FROM strategy_backtest_runs
     WHERE bot_id = $1
       AND variant = $2
       AND market = $3`;
  const runRows = options.configKey
    ? await safeQuery<StrategyBacktestRunRow>(
        `${runQueryBase}
         AND config_key = $4
         ORDER BY generated_utc DESC, id DESC
         LIMIT 1`,
        [options.botId, options.variant, options.market, options.configKey],
      )
    : await safeQuery<StrategyBacktestRunRow>(
        `${runQueryBase}
         ORDER BY generated_utc DESC, id DESC
         LIMIT 1`,
        [options.botId, options.variant, options.market],
      );
  const runId = toInteger(runRows[0]?.id);
  if (runId <= 0) return null;

  const weeklyRows = await safeQuery<StrategyBacktestWeeklyRow>(
    `SELECT
       week_open_utc,
       return_pct,
       trades,
       wins,
       losses,
       stop_hits,
       drawdown_pct,
       gross_profit_pct,
       gross_loss_pct,
       equity_end_pct,
       pnl_usd
     FROM strategy_backtest_weekly
     WHERE run_id = $1
     ORDER BY week_open_utc ASC`,
    [runId],
  );
  if (weeklyRows.length === 0) return null;

  const tradeRows = await safeQuery<StrategyBacktestTradeRow>(
    `SELECT
       week_open_utc,
       symbol,
       direction,
       entry_time_utc,
       exit_time_utc,
       pnl_pct,
       exit_reason,
       max_milestone,
       leverage_at_exit
     FROM strategy_backtest_trades
     WHERE run_id = $1
     ORDER BY COALESCE(exit_time_utc, entry_time_utc) ASC, id ASC`,
    [runId],
  );
  const tradeDetailsByWeek = buildTradeDetailsFromBacktestStoreTrades(tradeRows);

  const weekly = sortWeeksAsc(
    weeklyRows.flatMap((row) => {
      const weekOpenUtc = canonicalWeek(
        row.week_open_utc instanceof Date
          ? row.week_open_utc.toISOString()
          : parseIsoUtc(row.week_open_utc),
      );
      const returnPct = toNumber(row.return_pct);
      if (!weekOpenUtc || returnPct === null) return [];
      const tradeReturns = (tradeDetailsByWeek[weekOpenUtc] ?? [])
        .map((trade) => trade.percent)
        .filter((value): value is number => value !== null && Number.isFinite(value));
      const trades = toInteger(row.trades) || tradeReturns.length;
      const fallbackWins = tradeReturns.filter((value) => value > 0).length;
      const fallbackLosses = tradeReturns.filter((value) => value < 0).length;
      const wins = toInteger(row.wins) || fallbackWins;
      const losses = toInteger(row.losses) || fallbackLosses;
      const grossProfit = toNumber(row.gross_profit_pct) ?? tradeReturns
        .filter((value) => value > 0)
        .reduce((sum, value) => sum + value, 0);
      const grossLoss = toNumber(row.gross_loss_pct) ?? Math.abs(
        tradeReturns
          .filter((value) => value < 0)
          .reduce((sum, value) => sum + value, 0),
      );
      const avgTradePct = tradeReturns.length > 0
        ? tradeReturns.reduce((sum, value) => sum + value, 0) / tradeReturns.length
        : trades > 0
          ? returnPct / trades
          : null;
      return [{
        weekOpenUtc,
        returnPct,
        trades,
        wins,
        losses,
        winRatePct: trades > 0 ? (wins / trades) * 100 : 0,
        avgTradePct,
        profitFactor: computeProfitFactor(grossProfit, grossLoss),
        staticDrawdownPct: toNumber(row.drawdown_pct) ?? (returnPct < 0 ? Math.abs(returnPct) : 0),
        grossProfitUsd: grossProfit,
        grossLossUsd: grossLoss,
      } satisfies KataraktiWeeklySnapshot];
    }),
  );
  if (weekly.length === 0) return null;

  return toSnapshotFromWeekly({
    market: options.market,
    sourcePath: `db:strategy_backtest_runs:${runId}`,
    selectedVariantId: options.selectedVariantId,
    weekly,
    tradeDetailsByWeek,
    totalReturnPctOverride: null,
    maxDrawdownOverride: null,
    startingEquityUsdOverride: null,
  });
}

function resolveRegistryCandidatePaths(options: {
  preferredEnvVar?: string;
  candidates?: readonly string[];
}) {
  const preferred = options.preferredEnvVar
    ? process.env[options.preferredEnvVar]?.trim()
    : null;
  const out = new Set<string>();
  if (preferred) out.add(preferred);
  for (const candidate of options.candidates ?? []) {
    if (candidate && candidate.trim().length > 0) out.add(candidate);
  }
  return Array.from(out);
}

function resolveRegistryFallbackLabel(options: {
  pendingLabel?: string | null;
  hasDbBackfill: boolean;
  hasFileBackfill: boolean;
  hasLiveData: boolean;
}) {
  if (options.hasDbBackfill) return null;
  if (options.hasFileBackfill) return "Using file fallback — migrate backtest to DB";
  if (options.hasLiveData) {
    return options.pendingLabel ?? LITE_PENDING_LABEL;
  }
  return options.pendingLabel ?? null;
}

async function readRegistryDbFirstSnapshot(options: {
  variant: KataraktiVariant;
  market: KataraktiMarket;
}) {
  const entry = getKataraktiStrategyRegistryEntry(options.variant, options.market);
  if (!entry || entry.mode !== "db_first" || !entry.backtestBotId || !entry.selectedVariantId) {
    return null;
  }

  const configuredKey = entry.backtestConfigKeyEnvVar
    ? process.env[entry.backtestConfigKeyEnvVar]?.trim() ?? null
    : null;
  const dbSnapshot = await readBacktestStoreSnapshot({
    market: options.market,
    variant: options.variant,
    selectedVariantId: entry.selectedVariantId,
    botId: entry.backtestBotId,
    configKey: configuredKey,
  });

  const candidatePaths = resolveRegistryCandidatePaths({
    preferredEnvVar: entry.fileFallback?.preferredEnvVar,
    candidates: entry.fileFallback?.candidates,
  });
  const fileSnapshot =
    dbSnapshot === null && candidatePaths.length > 0
      ? await readFirstValidSimpleBacktestSnapshot({
          market: options.market,
          selectedVariantId: entry.selectedVariantId,
          candidatePaths,
        })
      : null;
  const base = dbSnapshot ?? fileSnapshot;

  let live = { weekly: [] as KataraktiWeeklySnapshot[], tradeDetailsByWeek: {} as Record<string, KataraktiTradeDetail[]> };
  if (entry.live?.botId) {
    live = options.market === "crypto_futures"
      ? await readLiveCryptoWeeklyFromDb({
          botId: entry.live.botId,
          dryRunOnly: entry.live.dryRunOnly ?? false,
        })
      : await readLiveMt5WeeklyFromDb(entry.live.botId);
  }

  const merged = appendLiveWeeks({
    market: options.market,
    base,
    live: live.weekly,
    liveTradeDetailsByWeek: live.tradeDetailsByWeek,
  });
  if (!merged) return null;

  const fallbackLabel = resolveRegistryFallbackLabel({
    pendingLabel: entry.pendingLabel,
    hasDbBackfill: Boolean(dbSnapshot),
    hasFileBackfill: Boolean(fileSnapshot),
    hasLiveData: live.weekly.length > 0,
  });
  const sourcePath = live.weekly.length > 0 && entry.live?.botId
    ? `${merged.sourcePath}+db:live:${entry.live.botId}`
    : merged.sourcePath;
  return {
    ...merged,
    selectedVariantId: entry.selectedVariantId,
    fallbackLabel,
    sourcePath,
  } satisfies KataraktiMarketSnapshot;
}

type SimWeeklyRow = {
  week_open_utc: Date | string;
  return_pct: number | string;
  trades: number | string;
  wins: number | string;
  losses: number | string;
  static_drawdown_pct: number | string;
  gross_profit_pct: number | string;
  gross_loss_pct: number | string;
};

async function readSimWeeklyFromDb(market: KataraktiMarket): Promise<KataraktiWeeklySnapshot[]> {
  const rows = await safeQuery<SimWeeklyRow>(
    `SELECT
       week_open_utc,
       return_pct,
       trades,
       wins,
       losses,
       static_drawdown_pct,
       gross_profit_pct,
       gross_loss_pct
     FROM katarakti_sim_weekly
     WHERE market = $1
     ORDER BY week_open_utc ASC`,
    [market],
  );

  if (rows.length === 0) return [];
  return sortWeeksAsc(
    rows.flatMap((row) => {
      const weekOpenUtc = canonicalWeek(
        row.week_open_utc instanceof Date
          ? row.week_open_utc.toISOString()
          : parseIsoUtc(row.week_open_utc),
      );
      if (!weekOpenUtc) return [];
      const returnPct = toNumber(row.return_pct) ?? 0;
      const trades = toInteger(row.trades);
      const wins = toInteger(row.wins);
      const losses = toInteger(row.losses);
      const grossProfitPct = toNumber(row.gross_profit_pct) ?? (returnPct > 0 ? returnPct : 0);
      const grossLossPct = toNumber(row.gross_loss_pct) ?? (returnPct < 0 ? Math.abs(returnPct) : 0);
      return [{
        weekOpenUtc,
        returnPct,
        trades,
        wins,
        losses,
        winRatePct: trades > 0 ? (wins / trades) * 100 : 0,
        avgTradePct: trades > 0 ? returnPct / trades : null,
        profitFactor: computeProfitFactor(grossProfitPct, grossLossPct),
        staticDrawdownPct: toNumber(row.static_drawdown_pct) ?? 0,
        grossProfitUsd: grossProfitPct,
        grossLossUsd: grossLossPct,
      } satisfies KataraktiWeeklySnapshot];
    }),
  );
}

function mergeSimAndLiveWeekly(
  sim: KataraktiWeeklySnapshot[],
  live: KataraktiWeeklySnapshot[],
): KataraktiWeeklySnapshot[] {
  const simByWeek = new Map(sim.map((week) => [week.weekOpenUtc, week]));
  const merged = [...sim];
  for (const liveWeek of live) {
    if (!simByWeek.has(liveWeek.weekOpenUtc)) {
      merged.push(liveWeek);
    }
  }
  return sortWeeksAsc(merged);
}

async function readLiveCryptoWeeklyFromDb(options?: {
  botId?: string;
  dryRunOnly?: boolean;
}): Promise<{
  weekly: KataraktiWeeklySnapshot[];
  tradeDetailsByWeek: Record<string, KataraktiTradeDetail[]>;
}> {
  const botId = options?.botId ?? "bitget_perp_v2";
  const dryRunOnly = options?.dryRunOnly ?? true;
  const dryRunClause = dryRunOnly
    ? "\n       AND COALESCE(LOWER(metadata->>'dryRun'), 'false') = 'true'"
    : "";
  const rows = await safeQuery<LiveBitgetTradeRow>(
    `SELECT
       DATE_TRUNC('week', COALESCE(exit_time_utc, entry_time_utc))::timestamptz AS week_open_utc,
       symbol,
       direction,
       entry_price,
       exit_price,
       COALESCE(pnl_usd, 0)::double precision AS pnl_usd,
       exit_reason,
       session_window
     FROM bitget_bot_trades
     WHERE bot_id = $1
       AND exit_time_utc IS NOT NULL${dryRunClause}
     ORDER BY COALESCE(exit_time_utc, entry_time_utc) ASC, id ASC`,
    [botId],
  );

  if (rows.length === 0) {
    return { weekly: [], tradeDetailsByWeek: {} };
  }
  const normalizedRows = rows.flatMap((row) => {
    const weekOpenUtc = canonicalWeek(
      row.week_open_utc instanceof Date
        ? row.week_open_utc.toISOString()
        : parseIsoUtc(row.week_open_utc),
    );
    if (!weekOpenUtc) return [];
    const entryPrice = toNumber(row.entry_price) ?? 0;
    const exitPrice = toNumber(row.exit_price) ?? 0;
    const direction = normalizeDirection(row.direction);
    const returnPct = directionAdjustedReturnPct(direction, entryPrice, exitPrice);
    return [{
      weekOpenUtc,
      pair: normalizePairLabel(row.symbol, "CRYPTO"),
      direction,
      returnPct,
      pnlUsd: toNumber(row.pnl_usd) ?? 0,
      reason: buildReasonList([
        row.exit_reason ? `Exit ${row.exit_reason}` : null,
        row.session_window ? `Session ${row.session_window}` : null,
      ]),
    }];
  });
  return {
    weekly: buildWeeklyFromLiveTrades(
      normalizedRows.map((row) => ({
        weekOpenUtc: row.weekOpenUtc,
        returnPct: row.returnPct,
        pnlUsd: row.pnlUsd,
      })),
    ),
    tradeDetailsByWeek: buildTradeDetailsByWeek(
      normalizedRows.map((row) => ({
        weekOpenUtc: row.weekOpenUtc,
        pair: row.pair,
        direction: row.direction,
        percent: row.returnPct,
        reason: row.reason,
      })),
    ),
  };
}

async function readLiveMt5WeeklyFromDb(botId = "katarakti_v1"): Promise<{
  weekly: KataraktiWeeklySnapshot[];
  tradeDetailsByWeek: Record<string, KataraktiTradeDetail[]>;
}> {
  const rows = await safeQuery<LiveMt5TradeRow>(
    `SELECT
       DATE_TRUNC('week', COALESCE(week_anchor::timestamptz, exit_time_utc, entry_time_utc))::timestamptz AS week_open_utc,
       symbol,
       direction,
       entry_price,
       exit_price,
       pnl_pct,
       COALESCE(pnl_usd, 0)::double precision AS pnl_usd,
       exit_reason,
       exit_step
     FROM katarakti_trades
     WHERE bot_id = $1
       AND exit_time_utc IS NOT NULL
     ORDER BY COALESCE(exit_time_utc, entry_time_utc) ASC, id ASC`,
    [botId],
  );

  if (rows.length === 0) {
    return { weekly: [], tradeDetailsByWeek: {} };
  }
  const normalizedRows = rows.flatMap((row) => {
    const weekOpenUtc = canonicalWeek(
      row.week_open_utc instanceof Date
        ? row.week_open_utc.toISOString()
        : parseIsoUtc(row.week_open_utc),
    );
    if (!weekOpenUtc) return [];
    const direction = normalizeDirection(row.direction);
    const pnlPct = toNumber(row.pnl_pct);
    const entryPrice = toNumber(row.entry_price) ?? 0;
    const exitPrice = toNumber(row.exit_price) ?? 0;
    const returnPct =
      pnlPct !== null
        ? pnlPct
        : directionAdjustedReturnPct(direction, entryPrice, exitPrice);
    return [{
      weekOpenUtc,
      pair: normalizePairLabel(row.symbol, "FX"),
      direction,
      returnPct,
      pnlUsd: toNumber(row.pnl_usd) ?? 0,
      reason: buildReasonList([
        row.exit_reason ? `Exit ${row.exit_reason}` : null,
        row.exit_step ? `Step ${row.exit_step}` : null,
      ]),
    }];
  });
  return {
    weekly: buildWeeklyFromLiveTrades(
      normalizedRows.map((row) => ({
        weekOpenUtc: row.weekOpenUtc,
        returnPct: row.returnPct,
        pnlUsd: row.pnlUsd,
      })),
    ),
    tradeDetailsByWeek: buildTradeDetailsByWeek(
      normalizedRows.map((row) => ({
        weekOpenUtc: row.weekOpenUtc,
        pair: row.pair,
        direction: row.direction,
        percent: row.returnPct,
        reason: row.reason,
      })),
    ),
  };
}

async function readCryptoFuturesSnapshot(): Promise<KataraktiMarketSnapshot | null> {
  const weeklySummaryPath = process.env.KATARAKTI_CRYPTO_WEEKLY_PATH?.trim() || CRYPTO_WEEKLY_SUMMARY_PATH;
  const weeklyRows = await readJsonFile<CryptoWeeklySummaryRow[]>(weeklySummaryPath);
  const summaryRows = Array.isArray(weeklyRows) ? weeklyRows : [];

  const runHistoryPath = process.env.KATARAKTI_CRYPTO_RUN_HISTORY_PATH?.trim() || CRYPTO_RUN_HISTORY_PATH;
  const runHistory = await readJsonFile<CryptoRunHistoryEntry[]>(runHistoryPath);
  const latestRun = Array.isArray(runHistory) && runHistory.length > 0
    ? runHistory[runHistory.length - 1]
    : null;
  const variantKey = process.env.KATARAKTI_CRYPTO_VARIANT_KEY?.trim() || DEFAULT_CRYPTO_VARIANT_KEY;
  const runHistoryWeeks = Array.isArray(latestRun?.weeks)
    ? latestRun?.weeks
        .map((value) => (typeof value === "string" ? value : null))
        .filter((value): value is string => value !== null)
    : [];
  const runHistoryReturnPct = latestRun?.returns_pct
    ? toNumber(latestRun.returns_pct[variantKey])
    : null;
  const runHistoryDrawdownPct = latestRun?.max_dd_pct
    ? toNumber(latestRun.max_dd_pct[variantKey])
    : null;

  const tradeLogSnapshot = await buildCryptoWeeklyFromTradeLog({
    variantKey,
    runHistoryWeeks,
  });
  let weeklyFromFiles = tradeLogSnapshot?.weekly ?? null;
  let tradeDetailsByWeekFromFiles = tradeLogSnapshot?.tradeDetailsByWeek ?? {};
  if (!weeklyFromFiles || weeklyFromFiles.length === 0) {
    weeklyFromFiles = buildCryptoWeeklyFromSummary(summaryRows);
    tradeDetailsByWeekFromFiles = {};
  }

  const fileSnapshot =
    weeklyFromFiles && weeklyFromFiles.length > 0
      ? toSnapshotFromWeekly({
          market: "crypto_futures",
          sourcePath: weeklySummaryPath,
          selectedVariantId: variantKey,
          weekly: weeklyFromFiles,
          tradeDetailsByWeek: tradeDetailsByWeekFromFiles,
          totalReturnPctOverride: runHistoryReturnPct,
          maxDrawdownOverride: runHistoryDrawdownPct,
          startingEquityUsdOverride: null,
        })
      : null;

  const seed = KATARAKTI_SEED_SNAPSHOTS.crypto_futures;
  const seedSnapshot = toSnapshotFromWeekly({
    market: "crypto_futures",
    sourcePath: seed.sourceLabel,
    selectedVariantId: seed.selectedVariantId,
    weekly: buildSeedWeeklySnapshots("crypto_futures"),
    totalReturnPctOverride: seed.totalReturnPct,
    maxDrawdownOverride: seed.maxDrawdownPct,
    startingEquityUsdOverride: seed.startingEquityUsd,
  });

  const base = fileSnapshot ?? seedSnapshot;
  const [simWeekly, liveSnapshot] = await Promise.all([
    readSimWeeklyFromDb("crypto_futures"),
    readLiveCryptoWeeklyFromDb(),
  ]);
  const mergedWeekly = mergeSimAndLiveWeekly(simWeekly, liveSnapshot.weekly);
  return appendLiveWeeks({
    market: "crypto_futures",
    base,
    live: mergedWeekly,
    liveTradeDetailsByWeek: liveSnapshot.tradeDetailsByWeek,
  });
}

async function readV3LiqSweepSnapshot(): Promise<KataraktiMarketSnapshot | null> {
  return readRegistryDbFirstSnapshot({
    variant: "v3",
    market: "crypto_futures",
  });
}

async function readLiteCryptoSnapshotFromReport(): Promise<KataraktiMarketSnapshot | null> {
  return readRegistryDbFirstSnapshot({
    variant: "lite",
    market: "crypto_futures",
  });
}

async function readLiteMt5SnapshotFromReport(): Promise<KataraktiMarketSnapshot | null> {
  return readRegistryDbFirstSnapshot({
    variant: "lite",
    market: "mt5_forex",
  });
}

function pickBestMt5Variant(
  variants: Mt5Variant[],
  preferredVariantId: string | null,
) {
  if (preferredVariantId) {
    const matched = variants.find((variant) => String(variant.id ?? "") === preferredVariantId);
    if (matched) return matched;
  }

  return [...variants]
    .sort((left, right) => {
      const leftRiskAdjusted = toNumber(left.headline?.risk_adjusted_return) ?? Number.NEGATIVE_INFINITY;
      const rightRiskAdjusted = toNumber(right.headline?.risk_adjusted_return) ?? Number.NEGATIVE_INFINITY;
      if (rightRiskAdjusted !== leftRiskAdjusted) {
        return rightRiskAdjusted - leftRiskAdjusted;
      }

      const leftReturn = toNumber(left.headline?.total_return_pct) ?? Number.NEGATIVE_INFINITY;
      const rightReturn = toNumber(right.headline?.total_return_pct) ?? Number.NEGATIVE_INFINITY;
      return rightReturn - leftReturn;
    })[0];
}

async function readMt5Report() {
  const preferredPath = process.env.KATARAKTI_MT5_REPORT_PATH?.trim();
  const candidatePaths = preferredPath
    ? [preferredPath, ...MT5_REPORT_CANDIDATES]
    : [...MT5_REPORT_CANDIDATES];

  for (const candidate of candidatePaths) {
    const report = await readJsonFile<Mt5BacktestReport>(candidate);
    if (report?.variants && report.variants.length > 0) {
      return { report, sourcePath: candidate };
    }
  }
  return null;
}

function buildMt5TradeDetailsByWeek(
  trades: Mt5TradeLogRow[],
): Record<string, KataraktiTradeDetail[]> {
  const parsed = trades.flatMap((trade, index) => {
    const rawWeek = parseIsoUtc(trade.weekOpenUtc) ?? parseIsoUtc(trade.week_open_utc);
    const weekOpenUtc = canonicalWeek(rawWeek);
    if (!weekOpenUtc) {
      return [];
    }
    const pair = normalizePairLabel(
      trade.pair ?? trade.symbol,
      `TRADE_${toInteger(trade.id) || index + 1}`,
    );
    const direction = normalizeDirection(trade.direction);
    const percent =
      toNumber(trade.returnPctOnEntryEquity) ??
      toNumber(trade.return_pct_on_entry_equity);
    const entryTimeMs = toNumber(trade.entryTimeMs) ?? toNumber(trade.entry_time_ms);
    const exitTimeMs = toNumber(trade.exitTimeMs) ?? toNumber(trade.exit_time_ms);
    const entryTimeUtc = parseIsoUtc(trade.entryTimeUtc) ?? parseIsoUtc(trade.entry_time_utc);
    const exitTimeUtc = parseIsoUtc(trade.exitTimeUtc) ?? parseIsoUtc(trade.exit_time_utc);
    const sortTimeMs =
      (exitTimeMs && Number.isFinite(exitTimeMs) ? exitTimeMs : null) ??
      (entryTimeMs && Number.isFinite(entryTimeMs) ? entryTimeMs : null) ??
      (exitTimeUtc ? new Date(exitTimeUtc).getTime() : null) ??
      (entryTimeUtc ? new Date(entryTimeUtc).getTime() : null) ??
      Number.POSITIVE_INFINITY;
    return [{
      weekOpenUtc,
      sortTimeMs,
      detail: {
        weekOpenUtc,
        pair,
        direction,
        percent,
        reason: buildReasonList([
          typeof trade.entrySource === "string"
            ? `Source ${trade.entrySource}`
            : typeof trade.entry_source === "string"
              ? `Source ${trade.entry_source}`
              : null,
          typeof trade.exitReason === "string"
            ? `Exit ${trade.exitReason}`
            : typeof trade.exit_reason === "string"
              ? `Exit ${trade.exit_reason}`
              : null,
          typeof trade.exitStep === "string"
            ? `Step ${trade.exitStep}`
            : typeof trade.exit_step === "string"
              ? `Step ${trade.exit_step}`
              : null,
        ]),
      } satisfies KataraktiTradeDetail,
    }];
  });

  const grouped = new Map<string, Array<{ sortTimeMs: number; detail: KataraktiTradeDetail }>>();
  for (const row of parsed) {
    const items = grouped.get(row.weekOpenUtc) ?? [];
    items.push({ sortTimeMs: row.sortTimeMs, detail: row.detail });
    grouped.set(row.weekOpenUtc, items);
  }

  const ordered = Array.from(grouped.entries()).map(([weekOpenUtc, items]) => [
    weekOpenUtc,
    items
      .sort((left, right) => left.sortTimeMs - right.sortTimeMs)
      .map((item) => item.detail),
  ] as const);
  return Object.fromEntries(ordered);
}

async function readMt5ForexSnapshot(): Promise<KataraktiMarketSnapshot | null> {
  const loaded = await readMt5Report();
  const preferredVariantId = process.env.KATARAKTI_MT5_VARIANT_ID?.trim() || PINNED_MT5_VARIANT_ID;

  let fileSnapshot: KataraktiMarketSnapshot | null = null;
  if (loaded) {
    const selected = pickBestMt5Variant(loaded.report.variants ?? [], preferredVariantId);
    if (selected) {
      const variantWeeklyRows = Array.isArray(selected.weekly) ? selected.weekly : [];
      const weeklyFromFiles = variantWeeklyRows
        .map((row) => {
          const rawWeek = parseIsoUtc(row.week_open_utc);
          const weekOpenUtc = canonicalWeek(rawWeek);
          const returnPct = toNumber(row.week_return_pct);
          if (!weekOpenUtc || returnPct === null) return null;
          const trades = toInteger(row.trades);
          const wins = toInteger(row.wins);
          const losses = toInteger(row.losses);
          const grossProfit = returnPct > 0 ? returnPct : 0;
          const grossLoss = returnPct < 0 ? Math.abs(returnPct) : 0;
          return {
            weekOpenUtc,
            returnPct,
            trades,
            wins,
            losses,
            winRatePct: trades > 0 ? (wins / trades) * 100 : 0,
            avgTradePct: trades > 0 ? returnPct / trades : null,
            profitFactor: computeProfitFactor(grossProfit, grossLoss),
            staticDrawdownPct: returnPct < 0 ? Math.abs(returnPct) : 0,
            grossProfitUsd: grossProfit,
            grossLossUsd: grossLoss,
          } satisfies KataraktiWeeklySnapshot;
        })
        .filter((row): row is KataraktiWeeklySnapshot => row !== null);

      const headlineTotalReturn = toNumber(selected.headline?.total_return_pct);
      const headlineMaxDd = toNumber(selected.headline?.max_drawdown_pct);
      const reportStartingEquity = toNumber(loaded.report.config?.starting_equity_usd);
      const tradeDetailsByWeek = buildMt5TradeDetailsByWeek(
        Array.isArray(selected.trades) ? selected.trades : [],
      );
      fileSnapshot = toSnapshotFromWeekly({
        market: "mt5_forex",
        sourcePath: loaded.sourcePath,
        selectedVariantId: selected.id ? String(selected.id) : preferredVariantId,
        weekly: weeklyFromFiles,
        tradeDetailsByWeek,
        totalReturnPctOverride: headlineTotalReturn,
        maxDrawdownOverride: headlineMaxDd,
        startingEquityUsdOverride: reportStartingEquity,
      });
    }
  }

  const seed = KATARAKTI_SEED_SNAPSHOTS.mt5_forex;
  const seedSnapshot = toSnapshotFromWeekly({
    market: "mt5_forex",
    sourcePath: seed.sourceLabel,
    selectedVariantId: preferredVariantId || seed.selectedVariantId,
    weekly: buildSeedWeeklySnapshots("mt5_forex"),
    totalReturnPctOverride: seed.totalReturnPct,
    maxDrawdownOverride: seed.maxDrawdownPct,
    startingEquityUsdOverride: seed.startingEquityUsd,
  });

  const base = fileSnapshot ?? seedSnapshot;
  const [simWeekly, liveSnapshot] = await Promise.all([
    readSimWeeklyFromDb("mt5_forex"),
    readLiveMt5WeeklyFromDb(),
  ]);
  const mergedWeekly = mergeSimAndLiveWeekly(simWeekly, liveSnapshot.weekly);
  return appendLiveWeeks({
    market: "mt5_forex",
    base,
    live: mergedWeekly,
    liveTradeDetailsByWeek: liveSnapshot.tradeDetailsByWeek,
  });
}

async function readLiteCryptoFuturesSnapshot(): Promise<KataraktiMarketSnapshot | null> {
  return readLiteCryptoSnapshotFromReport();
}

async function readLiteMt5ForexSnapshot(): Promise<KataraktiMarketSnapshot | null> {
  return readLiteMt5SnapshotFromReport();
}

export async function readKataraktiMarketSnapshots(): Promise<KataraktiHistoryByMarket> {
  return getOrSetRuntimeCache(
    "performance:kataraktiHistory:markets",
    getConfiguredCacheTtlMs(),
    async () => ({
      crypto_futures: await readCryptoFuturesSnapshot(),
      mt5_forex: await readMt5ForexSnapshot(),
    }),
  );
}

export async function readKataraktiMarketSnapshotsByVariant(
  variant: KataraktiVariant,
): Promise<KataraktiHistoryByMarket> {
  if (variant === "core") {
    return readKataraktiMarketSnapshots();
  }
  if (variant === "v3") {
    return getOrSetRuntimeCache(
      "performance:kataraktiHistory:markets:v3",
      getConfiguredCacheTtlMs(),
      async () => ({
        crypto_futures: await readV3LiqSweepSnapshot(),
        mt5_forex: null,
      }),
    );
  }
  return getOrSetRuntimeCache(
    "performance:kataraktiHistory:markets:lite",
    getConfiguredCacheTtlMs(),
    async () => ({
      crypto_futures: await readLiteCryptoFuturesSnapshot(),
      mt5_forex: await readLiteMt5ForexSnapshot(),
    }),
  );
}
