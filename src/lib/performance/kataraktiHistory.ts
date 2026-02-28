import { readFile } from "node:fs/promises";
import path from "node:path";
import { getOrSetRuntimeCache } from "@/lib/runtimeCache";
import { normalizeWeekOpenUtc } from "@/lib/weekAnchor";

export type KataraktiMarket = "crypto_futures" | "mt5_forex";

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

export type KataraktiMarketSnapshot = {
  market: KataraktiMarket;
  sourcePath: string;
  selectedVariantId: string | null;
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

function getConfiguredCryptoBacktestStartBalanceUsd() {
  const configured = toNumber(process.env.KATARAKTI_CRYPTO_BACKTEST_START_BALANCE_USD);
  return configured !== null && configured > 0 ? configured : 1_000;
}

type CryptoTradeLogRow = {
  id?: unknown;
  strategy?: unknown;
  week_open_utc?: unknown;
  exit_time_utc?: unknown;
  exitTimeUtc?: unknown;
  pnl_usd?: unknown;
  unlevered_pnl_pct?: unknown;
  balance_after_usd?: unknown;
};

type ParsedCryptoTrade = {
  id: number;
  strategy: string;
  weekOpenUtc: string;
  exitTimeUtc: string | null;
  pnlUsd: number;
  unleveredPnlPct: number | null;
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
    const exitTimeUtc = parseIsoUtc(row.exit_time_utc) ?? parseIsoUtc(row.exitTimeUtc);
    return [{
      id,
      strategy,
      weekOpenUtc,
      exitTimeUtc,
      pnlUsd: toNumber(row.pnl_usd) ?? 0,
      unleveredPnlPct: toNumber(row.unlevered_pnl_pct),
      balanceAfterUsd: toNumber(row.balance_after_usd),
    }];
  });
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
}): Promise<KataraktiWeeklySnapshot[] | null> {
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

  return weekly;
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

async function readJsonFile<T>(relativePath: string): Promise<T | null> {
  try {
    const absolutePath = path.join(process.cwd(), relativePath);
    const raw = await readFile(absolutePath, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
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

  let weekly =
    await buildCryptoWeeklyFromTradeLog({
      variantKey,
      runHistoryWeeks,
    });
  if (!weekly || weekly.length === 0) {
    weekly = buildCryptoWeeklyFromSummary(summaryRows);
  }
  if (!weekly || weekly.length === 0) {
    return null;
  }

  const weeklyReturnsPct = weekly.map((week) => week.returnPct);
  const startingEquityUsd = getConfiguredStartingEquityUsd(DEFAULT_STARTING_EQUITY_USD);
  const totalReturnPct =
    runHistoryReturnPct ??
    weeklyReturnsPct.reduce((sum, value) => sum + value, 0);
  const totalPnlUsd = (totalReturnPct / 100) * startingEquityUsd;

  const totalTrades = weekly.reduce((sum, week) => sum + week.trades, 0);
  const wins = weekly.reduce((sum, week) => sum + week.wins, 0);
  const grossProfitUsd = weekly.reduce((sum, week) => sum + week.grossProfitUsd, 0);
  const grossLossUsd = weekly.reduce((sum, week) => sum + week.grossLossUsd, 0);
  const avgTradePct = weightedAverage(
    weekly.map((week) => ({
      value: week.avgTradePct,
      weight: week.trades,
    })),
  );
  const maxStaticDrawdownPct = weekly.reduce(
    (max, week) => Math.max(max, week.staticDrawdownPct),
    0,
  );
  const maxDrawdownPct =
    maxStaticDrawdownPct > 0
      ? maxStaticDrawdownPct
      : runHistoryDrawdownPct;
  const winRatePct = totalTrades > 0 ? (wins / totalTrades) * 100 : 0;

  return {
    market: "crypto_futures",
    sourcePath: weeklySummaryPath,
    selectedVariantId: variantKey,
    weekly,
    weeks: weeklyReturnsPct.length,
    weeklyReturnsPct,
    totalReturnPct,
    totalPnlUsd,
    totalTrades,
    wins,
    winRatePct,
    tradeWinRatePct: winRatePct,
    avgTradePct,
    profitFactor: computeProfitFactor(grossProfitUsd, grossLossUsd),
    maxDrawdownPct,
    sharpe: computeSharpe(weeklyReturnsPct),
  };
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

async function readMt5ForexSnapshot(): Promise<KataraktiMarketSnapshot | null> {
  const loaded = await readMt5Report();
  if (!loaded) return null;

  const preferredVariantId = process.env.KATARAKTI_MT5_VARIANT_ID?.trim() || PINNED_MT5_VARIANT_ID;
  const selected = pickBestMt5Variant(loaded.report.variants ?? [], preferredVariantId);
  if (!selected) return null;

  const variantWeeklyRows = Array.isArray(selected.weekly) ? selected.weekly : [];
  const parsedWeeklyRows = variantWeeklyRows
    .map((row) => {
      const rawWeek = parseIsoUtc(row.week_open_utc);
      const weekOpenUtc = canonicalWeek(rawWeek);
      const returnPct = toNumber(row.week_return_pct);
      if (!weekOpenUtc || returnPct === null) return null;
      const trades = toInteger(row.trades);
      const wins = toInteger(row.wins);
      const losses = toInteger(row.losses);
      const reportedWinRate = toNumber(row.win_rate_pct);
      return {
        weekOpenUtc,
        returnPct,
        trades,
        wins,
        losses,
        reportedWinRate,
      };
    })
    .filter((row): row is NonNullable<typeof row> => row !== null)
    .sort(
      (left, right) =>
        new Date(left.weekOpenUtc).getTime() - new Date(right.weekOpenUtc).getTime(),
    );

  const tradeLogRows = Array.isArray(selected.trades)
    ? selected.trades
        .map((row) => {
          const weekOpenUtc =
            canonicalWeek(parseIsoUtc(row.weekOpenUtc)) ??
            canonicalWeek(parseIsoUtc(row.week_open_utc));
          if (!weekOpenUtc) return null;
          const netPnlUsd = toNumber(row.netPnlUsd) ?? toNumber(row.net_pnl_usd) ?? 0;
          const returnPctOnEntryEquity =
            toNumber(row.returnPctOnEntryEquity) ??
            toNumber(row.return_pct_on_entry_equity);
          const exitTimeMs =
            toNumber(row.exitTimeMs) ??
            toNumber(row.exit_time_ms);
          const exitTimeUtc =
            parseIsoUtc(row.exitTimeUtc) ??
            parseIsoUtc(row.exit_time_utc);
          return {
            weekOpenUtc,
            netPnlUsd,
            returnPctOnEntryEquity,
            exitTimeMs,
            exitTimeUtc,
          };
        })
        .filter((row): row is NonNullable<typeof row> => row !== null)
    : [];
  const tradesByWeek = tradeLogRows.reduce((map, row) => {
    const list = map.get(row.weekOpenUtc) ?? [];
    list.push(row);
    map.set(row.weekOpenUtc, list);
    return map;
  }, new Map<string, typeof tradeLogRows>());

  const totalReturnPct = toNumber(selected.headline?.total_return_pct) ?? 0;
  const startingEquityUsd =
    getConfiguredStartingEquityUsd(
      toNumber(loaded.report.config?.starting_equity_usd) ?? DEFAULT_STARTING_EQUITY_USD,
    );
  const totalPnlUsd = (totalReturnPct / 100) * startingEquityUsd;

  let weekStartBalance = toNumber(selected.headline?.start_equity_usd) ?? startingEquityUsd;
  const weekly: KataraktiWeeklySnapshot[] = parsedWeeklyRows.map((row) => {
    const weekTrades = tradesByWeek.get(row.weekOpenUtc) ?? [];
    const sortedTrades = [...weekTrades].sort((left, right) => {
      const leftTime =
        left.exitTimeMs ??
        (left.exitTimeUtc ? new Date(left.exitTimeUtc).getTime() : Number.POSITIVE_INFINITY);
      const rightTime =
        right.exitTimeMs ??
        (right.exitTimeUtc ? new Date(right.exitTimeUtc).getTime() : Number.POSITIVE_INFINITY);
      return leftTime - rightTime;
    });
    const computedWins = sortedTrades.filter((trade) => trade.netPnlUsd > 0).length;
    const computedLosses = sortedTrades.filter((trade) => trade.netPnlUsd < 0).length;
    const computedTrades = sortedTrades.length;
    const trades = row.trades > 0 ? row.trades : computedTrades;
    const wins = row.wins > 0 || computedWins === 0 ? row.wins : computedWins;
    const losses = row.losses > 0 || computedLosses === 0 ? row.losses : computedLosses;
    const winRatePct =
      row.reportedWinRate !== null
        ? row.reportedWinRate
        : trades > 0
          ? (wins / trades) * 100
          : 0;

    let minBalance = weekStartBalance;
    let runningBalance = weekStartBalance;
    let grossProfitUsd = 0;
    let grossLossUsd = 0;
    const tradeReturns: number[] = [];
    for (const trade of sortedTrades) {
      runningBalance += trade.netPnlUsd;
      if (runningBalance < minBalance) {
        minBalance = runningBalance;
      }
      if (trade.netPnlUsd > 0) grossProfitUsd += trade.netPnlUsd;
      if (trade.netPnlUsd < 0) grossLossUsd += Math.abs(trade.netPnlUsd);
      if (trade.returnPctOnEntryEquity !== null) {
        tradeReturns.push(trade.returnPctOnEntryEquity);
      }
    }

    const staticDrawdownPct =
      trades > 0
        ? ((weekStartBalance - minBalance) / weekStartBalance) * 100
        : row.returnPct < 0
          ? Math.abs(row.returnPct)
          : 0;

    const avgTradePct =
      tradeReturns.length > 0
        ? tradeReturns.reduce((sum, value) => sum + value, 0) / tradeReturns.length
        : trades > 0
          ? row.returnPct / trades
          : null;

    const week = {
      weekOpenUtc: row.weekOpenUtc,
      returnPct: row.returnPct,
      trades,
      wins,
      losses,
      winRatePct,
      avgTradePct,
      profitFactor: computeProfitFactor(grossProfitUsd, grossLossUsd),
      staticDrawdownPct,
      grossProfitUsd,
      grossLossUsd,
    } satisfies KataraktiWeeklySnapshot;

    weekStartBalance = weekStartBalance * (1 + (row.returnPct / 100));
    return week;
  });

  const weeklyReturnsPct = weekly.map((week) => week.returnPct);
  const winsFromWeeks = weekly.reduce((sum, week) => sum + week.wins, 0);
  const tradesFromWeeks = weekly.reduce((sum, week) => sum + week.trades, 0);
  const headlineTrades = toInteger(selected.headline?.trades);
  const totalTrades = headlineTrades > 0 ? headlineTrades : tradesFromWeeks;
  const headlineWinRate = toNumber(selected.headline?.win_rate_pct);
  const winRatePct = headlineWinRate !== null
    ? headlineWinRate
    : totalTrades > 0
      ? (winsFromWeeks / totalTrades) * 100
      : 0;
  const avgTradePct = weightedAverage(
    weekly.map((week) => ({
      value: week.avgTradePct,
      weight: week.trades,
    })),
  ) ?? toNumber(selected.headline?.avg_trade_return_pct);
  const grossProfitUsd = weekly.reduce((sum, week) => sum + week.grossProfitUsd, 0);
  const grossLossUsd = weekly.reduce((sum, week) => sum + week.grossLossUsd, 0);
  const maxStaticDrawdownPct = weekly.reduce(
    (max, week) => Math.max(max, week.staticDrawdownPct),
    0,
  );
  const headlineMaxDrawdownPct = toNumber(selected.headline?.max_drawdown_pct);
  const maxDrawdownPct =
    maxStaticDrawdownPct > 0
      ? maxStaticDrawdownPct
      : headlineMaxDrawdownPct;

  return {
    market: "mt5_forex",
    sourcePath: loaded.sourcePath,
    selectedVariantId: selected.id ? String(selected.id) : null,
    weekly,
    weeks: weeklyReturnsPct.length,
    weeklyReturnsPct,
    totalReturnPct,
    totalPnlUsd,
    totalTrades,
    wins: winsFromWeeks,
    winRatePct,
    tradeWinRatePct: totalTrades > 0 ? (winsFromWeeks / totalTrades) * 100 : 0,
    avgTradePct,
    profitFactor: computeProfitFactor(grossProfitUsd, grossLossUsd),
    maxDrawdownPct,
    sharpe: computeSharpe(weeklyReturnsPct),
  };
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
