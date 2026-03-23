/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: ingest-katarakti-core-backtests.ts
 *
 * Description:
 * Normalizes the currently selected Katarakti core CFD and core crypto
 * backtest variants into strategy_backtest_runs so the Performance page
 * can move away from mixed legacy file/seed/live sources.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import fs from "node:fs";
import path from "node:path";

import { persistStrategyBacktestSnapshot } from "../src/lib/performance/strategyBacktestIngestion";

type CfdCoreTrade = {
  weekOpenUtc: string;
  assetClass?: string;
  pair: string;
  direction: string;
  entryTimeUtc?: string;
  exitTimeUtc?: string;
  entryPrice?: number;
  exitPrice?: number;
  netPnlUsd?: number;
  returnPctOnEntryEquity?: number;
  exitReason?: string;
  exitStep?: string;
  sessionName?: string;
  biasSystem?: string;
};

type CfdCoreWeekly = {
  week_open_utc: string;
  starting_equity_usd: number;
  ending_equity_usd: number;
  week_return_pct: number;
  trades: number;
  wins: number;
  losses: number;
};

type CfdCoreVariant = {
  id: string;
  bias_system?: string;
  neutral_mode?: string;
  headline?: {
    total_return_pct?: number;
    max_drawdown_pct?: number;
    win_rate_pct?: number;
    trades?: number;
  };
  weekly: CfdCoreWeekly[];
  trades: CfdCoreTrade[];
};

type CfdCoreReport = {
  generated_utc?: string;
  config?: {
    weeks?: string[];
    starting_equity_usd?: number;
    entry_mode?: string;
    exit_mode?: string;
    lock_style?: string;
    correlation_lookback_hours?: number | null;
  };
  variants?: CfdCoreVariant[];
};

type CryptoRunHistoryEntry = {
  generated_utc?: string;
  weeks?: string[];
  returns_pct?: Record<string, number>;
  max_dd_pct?: Record<string, number>;
  trades?: Record<string, number>;
};

type CryptoTrade = {
  id?: number;
  strategy: string;
  symbol: string;
  week_open_utc: string;
  direction: string;
  entry_time_utc?: string;
  exit_time_utc?: string;
  entry_price?: number;
  exit_price?: number;
  exit_reason?: string;
  pnl_usd?: number;
  balance_after_usd?: number;
  max_leverage_reached?: number;
  milestones_hit?: number[];
  session_window?: string;
  trigger?: string;
};

type BacktestWeeklyRow = {
  weekOpenUtc: string;
  returnPct: number;
  trades: number;
  wins: number;
  losses: number;
  stopHits: number;
  drawdownPct: number;
  grossProfitPct: number;
  grossLossPct: number;
  equityEndPct: number | null;
  pnlUsd: number | null;
};

type BacktestTradeRow = {
  weekOpenUtc: string;
  symbol: string;
  direction: string;
  entryTimeUtc?: string | null;
  exitTimeUtc?: string | null;
  entryPrice?: number | null;
  exitPrice?: number | null;
  pnlPct?: number | null;
  pnlUsd?: number | null;
  exitReason?: string | null;
  maxMilestone?: number | null;
  leverageAtExit?: number | null;
  metadata?: Record<string, unknown> | null;
};

const REPO_ROOT = path.resolve(__dirname, "..");
const CFD_REPORT_PATH =
  process.env.KATARAKTI_CORE_CFD_REPORT_PATH?.trim()
  || path.join(REPO_ROOT, "reports", "katarakti-phase1-backtest-latest-phase2_full_atr_nohard.json");
const CFD_VARIANT_ID =
  process.env.KATARAKTI_CORE_CFD_VARIANT_ID?.trim()
  || "tiered__t1t2__weighted";

const CRYPTO_RUN_HISTORY_PATH =
  process.env.KATARAKTI_CORE_CRYPTO_RUN_HISTORY_PATH?.trim()
  || path.join(REPO_ROOT, "docs", "bots", "backtest-run-history.json");
const CRYPTO_TRADE_LOG_PATH =
  process.env.KATARAKTI_CORE_CRYPTO_TRADE_LOG_PATH?.trim()
  || path.join(REPO_ROOT, "docs", "bots", "backtest-trade-log.json");
const CRYPTO_STRATEGY_KEY =
  process.env.KATARAKTI_CORE_CRYPTO_STRATEGY_KEY?.trim()
  || "C_handshake_scaling_risk";
const CRYPTO_RUN_HISTORY_KEY =
  process.env.KATARAKTI_CORE_CRYPTO_RUN_HISTORY_KEY?.trim()
  || "C";
const CRYPTO_START_EQUITY_USD = Number(process.env.KATARAKTI_CORE_CRYPTO_START_EQUITY_USD ?? "1000");

function readJsonFile<T>(filePath: string): T {
  return JSON.parse(fs.readFileSync(filePath, "utf8")) as T;
}

function safeNumber(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function safeString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function buildGrossRowsFromTradePcts(tradePcts: number[]) {
  const grossProfitPct = tradePcts.filter((value) => value > 0).reduce((sum, value) => sum + value, 0);
  const grossLossPct = Math.abs(tradePcts.filter((value) => value < 0).reduce((sum, value) => sum + value, 0));
  return {
    grossProfitPct,
    grossLossPct,
  };
}

function mapCfdCoreRows(report: CfdCoreReport) {
  const variant = report.variants?.find((row) => row.id === CFD_VARIANT_ID);
  if (!variant) {
    throw new Error(`CFD core variant ${CFD_VARIANT_ID} not found in ${CFD_REPORT_PATH}`);
  }
  const startEquityUsd = safeNumber(report.config?.starting_equity_usd, 100000);
  const tradesByWeek = new Map<string, CfdCoreTrade[]>();
  for (const trade of variant.trades ?? []) {
    const weekOpenUtc = safeString(trade.weekOpenUtc);
    if (!weekOpenUtc) continue;
    const rows = tradesByWeek.get(weekOpenUtc) ?? [];
    rows.push(trade);
    tradesByWeek.set(weekOpenUtc, rows);
  }

  const weekly: BacktestWeeklyRow[] = (variant.weekly ?? []).map((row) => {
    const weekTrades = tradesByWeek.get(row.week_open_utc) ?? [];
    const tradePcts = weekTrades.map((trade) => safeNumber(trade.returnPctOnEntryEquity));
    const { grossProfitPct, grossLossPct } = buildGrossRowsFromTradePcts(tradePcts);
    return {
      weekOpenUtc: row.week_open_utc,
      returnPct: safeNumber(row.week_return_pct),
      trades: safeNumber(row.trades),
      wins: safeNumber(row.wins),
      losses: safeNumber(row.losses),
      stopHits: weekTrades.filter((trade) => safeString(trade.exitReason) === "hard_sl").length,
      drawdownPct: Math.max(0, Math.abs(Math.min(0, safeNumber(row.week_return_pct)))),
      grossProfitPct,
      grossLossPct,
      equityEndPct: startEquityUsd > 0
        ? ((safeNumber(row.ending_equity_usd) - startEquityUsd) / startEquityUsd) * 100
        : null,
      pnlUsd: safeNumber(row.ending_equity_usd) - safeNumber(row.starting_equity_usd),
    };
  });

  const trades: BacktestTradeRow[] = (variant.trades ?? []).map((trade) => ({
    weekOpenUtc: trade.weekOpenUtc,
    symbol: trade.pair,
    direction: trade.direction,
    entryTimeUtc: trade.entryTimeUtc ?? null,
    exitTimeUtc: trade.exitTimeUtc ?? null,
    entryPrice: trade.entryPrice ?? null,
    exitPrice: trade.exitPrice ?? null,
    pnlPct: trade.returnPctOnEntryEquity ?? null,
    pnlUsd: trade.netPnlUsd ?? null,
    exitReason: trade.exitReason ?? null,
    maxMilestone: null,
    leverageAtExit: null,
    metadata: {
      assetClass: trade.assetClass ?? null,
      pair: trade.pair,
      sessionName: trade.sessionName ?? null,
      biasSystem: trade.biasSystem ?? variant.bias_system ?? null,
      exitStep: trade.exitStep ?? null,
      selectedVariantId: variant.id,
    },
  }));

  return {
    variant,
    startEquityUsd,
    weekly,
    trades,
  };
}

function computeWeekDrawdownPct(startBalance: number, balancesAfterTrade: number[]) {
  let peak = startBalance;
  let maxDdPct = 0;
  for (const balance of balancesAfterTrade) {
    peak = Math.max(peak, balance);
    if (peak > 0) {
      const ddPct = ((peak - balance) / peak) * 100;
      maxDdPct = Math.max(maxDdPct, ddPct);
    }
  }
  return maxDdPct;
}

function mapCryptoCoreRows(runHistory: CryptoRunHistoryEntry[], tradeLog: CryptoTrade[]) {
  const latestRun = [...runHistory].reverse().find((row) => Array.isArray(row.weeks));
  const weekOrder = latestRun?.weeks ?? [];
  const filteredTrades = tradeLog
    .filter((trade) => trade.strategy === CRYPTO_STRATEGY_KEY)
    .sort((left, right) => safeNumber(left.id) - safeNumber(right.id));

  const tradesByWeek = new Map<string, CryptoTrade[]>();
  for (const trade of filteredTrades) {
    const weekOpenUtc = safeString(trade.week_open_utc);
    if (!weekOpenUtc) continue;
    const rows = tradesByWeek.get(weekOpenUtc) ?? [];
    rows.push(trade);
    tradesByWeek.set(weekOpenUtc, rows);
  }

  let balance = CRYPTO_START_EQUITY_USD;
  const weekly: BacktestWeeklyRow[] = [];
  const trades: BacktestTradeRow[] = [];

  for (const weekOpenUtc of weekOrder) {
    const weekTrades = tradesByWeek.get(weekOpenUtc) ?? [];
    const weekStartBalance = balance;
    const balancePath: number[] = [];
    let weekGrossProfitUsd = 0;
    let weekGrossLossUsd = 0;

    for (const trade of weekTrades) {
      const pnlUsd = safeNumber(trade.pnl_usd);
      const accountReturnPct = weekStartBalance > 0 ? (pnlUsd / balance) * 100 : 0;
      balance += pnlUsd;
      balancePath.push(balance);
      if (pnlUsd > 0) weekGrossProfitUsd += pnlUsd;
      if (pnlUsd < 0) weekGrossLossUsd += Math.abs(pnlUsd);

      const milestoneList = Array.isArray(trade.milestones_hit)
        ? trade.milestones_hit.filter((value) => typeof value === "number" && Number.isFinite(value))
        : [];

      trades.push({
        weekOpenUtc,
        symbol: trade.symbol,
        direction: trade.direction,
        entryTimeUtc: trade.entry_time_utc ?? null,
        exitTimeUtc: trade.exit_time_utc ?? null,
        entryPrice: trade.entry_price ?? null,
        exitPrice: trade.exit_price ?? null,
        pnlPct: accountReturnPct,
        pnlUsd,
        exitReason: trade.exit_reason ?? null,
        maxMilestone: milestoneList.length > 0 ? Math.max(...milestoneList) : null,
        leverageAtExit: trade.max_leverage_reached ?? null,
        metadata: {
          strategy: trade.strategy,
          sessionWindow: trade.session_window ?? null,
          trigger: trade.trigger ?? null,
          selectedVariantId: "core",
        },
      });
    }

    const weekEndBalance = weekTrades.length > 0 ? balance : weekStartBalance;
    const pnlUsd = weekEndBalance - weekStartBalance;
    weekly.push({
      weekOpenUtc,
      returnPct: weekStartBalance > 0 ? (pnlUsd / weekStartBalance) * 100 : 0,
      trades: weekTrades.length,
      wins: weekTrades.filter((trade) => safeNumber(trade.pnl_usd) > 0).length,
      losses: weekTrades.filter((trade) => safeNumber(trade.pnl_usd) < 0).length,
      stopHits: weekTrades.filter((trade) => safeString(trade.exit_reason) === "STOP_LOSS").length,
      drawdownPct: computeWeekDrawdownPct(weekStartBalance, balancePath),
      grossProfitPct: weekStartBalance > 0 ? (weekGrossProfitUsd / weekStartBalance) * 100 : 0,
      grossLossPct: weekStartBalance > 0 ? (weekGrossLossUsd / weekStartBalance) * 100 : 0,
      equityEndPct: CRYPTO_START_EQUITY_USD > 0
        ? ((weekEndBalance - CRYPTO_START_EQUITY_USD) / CRYPTO_START_EQUITY_USD) * 100
        : null,
      pnlUsd,
    });
  }

  return {
    latestRun,
    weekly,
    trades,
  };
}

async function main() {
  const cfdReport = readJsonFile<CfdCoreReport>(CFD_REPORT_PATH);
  const cfdRows = mapCfdCoreRows(cfdReport);
  await persistStrategyBacktestSnapshot({
    context: "core cfd ingest",
    snapshot: {
      run: {
        botId: "katarakti_v1",
        variant: "core",
        market: "mt5_forex",
        strategyName: "Katarakti Core (CFD)",
        backtestWeeks: cfdRows.weekly.length,
        generatedUtc: cfdReport.generated_utc ?? null,
        configJson: {
          selectedVariantId: cfdRows.variant.id,
          biasSystem: cfdRows.variant.bias_system ?? null,
          neutralMode: cfdRows.variant.neutral_mode ?? null,
          weeks: cfdReport.config?.weeks ?? [],
          entryMode: cfdReport.config?.entry_mode ?? null,
          exitMode: cfdReport.config?.exit_mode ?? null,
          lockStyle: cfdReport.config?.lock_style ?? null,
          sourceReportPath: path.relative(REPO_ROOT, CFD_REPORT_PATH),
        },
      },
      weekly: cfdRows.weekly,
      trades: cfdRows.trades,
    },
  });

  const cryptoRunHistory = readJsonFile<CryptoRunHistoryEntry[]>(CRYPTO_RUN_HISTORY_PATH);
  const cryptoTradeLog = readJsonFile<CryptoTrade[]>(CRYPTO_TRADE_LOG_PATH);
  const cryptoRows = mapCryptoCoreRows(cryptoRunHistory, cryptoTradeLog);
  await persistStrategyBacktestSnapshot({
    context: "core crypto ingest",
    snapshot: {
      run: {
        botId: "bitget_perp_v2",
        variant: "core",
        market: "crypto_futures",
        strategyName: "Katarakti Core (Crypto Futures)",
        backtestWeeks: cryptoRows.weekly.length,
        generatedUtc: cryptoRows.latestRun?.generated_utc ?? null,
        configJson: {
          selectedVariantId: CRYPTO_RUN_HISTORY_KEY,
          selectedStrategyKey: CRYPTO_STRATEGY_KEY,
          weeks: cryptoRows.latestRun?.weeks ?? [],
          sourceRunHistoryPath: path.relative(REPO_ROOT, CRYPTO_RUN_HISTORY_PATH),
          sourceTradeLogPath: path.relative(REPO_ROOT, CRYPTO_TRADE_LOG_PATH),
        },
      },
      weekly: cryptoRows.weekly,
      trades: cryptoRows.trades,
    },
  });
}

main().catch((error) => {
  console.error("ingest-katarakti-core-backtests failed:", error);
  process.exitCode = 1;
});
