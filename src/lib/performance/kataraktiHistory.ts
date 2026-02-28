import { readFile } from "node:fs/promises";
import path from "node:path";
import { getOrSetRuntimeCache } from "@/lib/runtimeCache";

export type KataraktiMarket = "crypto_futures" | "mt5_forex";

export type KataraktiMarketSnapshot = {
  market: KataraktiMarket;
  sourcePath: string;
  selectedVariantId: string | null;
  weeks: number;
  weeklyReturnsPct: number[];
  totalReturnPct: number;
  totalPnlUsd: number;
  totalTrades: number;
  wins: number;
  winRatePct: number;
  maxDrawdownPct: number | null;
  sharpe: number;
};

export type KataraktiHistoryByMarket = Record<KataraktiMarket, KataraktiMarketSnapshot | null>;

type CryptoWeeklySummaryRow = {
  weekly_return_pct?: unknown;
  cumulative_return_pct?: unknown;
  entries?: unknown;
  win_loss?: unknown;
};

type CryptoRunHistoryEntry = {
  returns_pct?: Record<string, unknown>;
  max_dd_pct?: Record<string, unknown>;
  trades?: Record<string, unknown>;
};

type Mt5VariantWeeklyRow = {
  week_return_pct?: unknown;
  trades?: unknown;
  wins?: unknown;
  losses?: unknown;
  win_rate_pct?: unknown;
};

type Mt5VariantHeadline = {
  total_return_pct?: unknown;
  max_drawdown_pct?: unknown;
  win_rate_pct?: unknown;
  trades?: unknown;
  risk_adjusted_return?: unknown;
};

type Mt5Variant = {
  id?: unknown;
  headline?: Mt5VariantHeadline;
  weekly?: Mt5VariantWeeklyRow[];
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
const DEFAULT_CRYPTO_VARIANT_KEY = "D";
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

function normalizeWeeklyReturns(rows: unknown[]): number[] {
  return rows
    .map((value) => toNumber(value))
    .filter((value): value is number => value !== null);
}

async function readCryptoFuturesSnapshot(): Promise<KataraktiMarketSnapshot | null> {
  const weeklySummaryPath = process.env.KATARAKTI_CRYPTO_WEEKLY_PATH?.trim() || CRYPTO_WEEKLY_SUMMARY_PATH;
  const weeklyRows = await readJsonFile<CryptoWeeklySummaryRow[]>(weeklySummaryPath);
  if (!Array.isArray(weeklyRows) || weeklyRows.length === 0) {
    return null;
  }

  const weeklyReturnsPct = normalizeWeeklyReturns(
    weeklyRows.map((row) => row.weekly_return_pct),
  );
  if (weeklyReturnsPct.length === 0) {
    return null;
  }

  const cumulativeReturnPct = toNumber(weeklyRows[weeklyRows.length - 1]?.cumulative_return_pct);
  const totalReturnPct =
    cumulativeReturnPct ?? weeklyReturnsPct.reduce((sum, value) => sum + value, 0);

  const totalTrades = weeklyRows.reduce((sum, row) => sum + toInteger(row.entries), 0);
  const winsFromRows = weeklyRows.reduce((sum, row) => sum + parseWinLoss(row.win_loss).wins, 0);
  const lossesFromRows = weeklyRows.reduce((sum, row) => sum + parseWinLoss(row.win_loss).losses, 0);

  const runHistoryPath = process.env.KATARAKTI_CRYPTO_RUN_HISTORY_PATH?.trim() || CRYPTO_RUN_HISTORY_PATH;
  const runHistory = await readJsonFile<CryptoRunHistoryEntry[]>(runHistoryPath);
  const latestRun = Array.isArray(runHistory) && runHistory.length > 0
    ? runHistory[runHistory.length - 1]
    : null;
  const variantKey = process.env.KATARAKTI_CRYPTO_VARIANT_KEY?.trim() || DEFAULT_CRYPTO_VARIANT_KEY;
  const maxDrawdownPct = latestRun?.max_dd_pct ? toNumber(latestRun.max_dd_pct[variantKey]) : null;

  const startingEquityUsd = getConfiguredStartingEquityUsd(DEFAULT_STARTING_EQUITY_USD);
  const totalPnlUsd = (totalReturnPct / 100) * startingEquityUsd;

  const inferredTrades = winsFromRows + lossesFromRows;
  const resolvedTrades = totalTrades > 0 ? totalTrades : inferredTrades;
  const winRatePct = resolvedTrades > 0 ? (winsFromRows / resolvedTrades) * 100 : 0;

  return {
    market: "crypto_futures",
    sourcePath: weeklySummaryPath,
    selectedVariantId: variantKey,
    weeks: weeklyReturnsPct.length,
    weeklyReturnsPct,
    totalReturnPct,
    totalPnlUsd,
    totalTrades: resolvedTrades,
    wins: winsFromRows,
    winRatePct,
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

  const weeklyRows = Array.isArray(selected.weekly) ? selected.weekly : [];
  const weeklyReturnsPct = normalizeWeeklyReturns(
    weeklyRows.map((row) => row.week_return_pct),
  );

  const winsFromWeeks = weeklyRows.reduce((sum, row) => sum + toInteger(row.wins), 0);
  const tradesFromWeeks = weeklyRows.reduce((sum, row) => sum + toInteger(row.trades), 0);
  const headlineTrades = toInteger(selected.headline?.trades);
  const totalTrades = headlineTrades > 0 ? headlineTrades : tradesFromWeeks;
  const totalReturnPct = toNumber(selected.headline?.total_return_pct) ?? 0;

  const startingEquityUsd =
    getConfiguredStartingEquityUsd(
      toNumber(loaded.report.config?.starting_equity_usd) ?? DEFAULT_STARTING_EQUITY_USD,
    );
  const totalPnlUsd = (totalReturnPct / 100) * startingEquityUsd;

  const headlineWinRate = toNumber(selected.headline?.win_rate_pct);
  const winRatePct =
    headlineWinRate !== null
      ? headlineWinRate
      : totalTrades > 0
        ? (winsFromWeeks / totalTrades) * 100
        : 0;

  return {
    market: "mt5_forex",
    sourcePath: loaded.sourcePath,
    selectedVariantId: selected.id ? String(selected.id) : null,
    weeks: weeklyReturnsPct.length,
    weeklyReturnsPct,
    totalReturnPct,
    totalPnlUsd,
    totalTrades,
    wins: winsFromWeeks,
    winRatePct,
    maxDrawdownPct: toNumber(selected.headline?.max_drawdown_pct),
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
