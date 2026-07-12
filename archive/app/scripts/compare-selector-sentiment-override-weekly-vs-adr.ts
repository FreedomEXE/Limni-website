/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: compare-selector-sentiment-override-weekly-vs-adr.ts
 *
 * Description:
 * Compares the current weekly-bias selector leader as:
 *   1. pure weekly hold
 *   2. ADR pullback-filtered intraday strategy
 *
 * Also includes canonical app ADR variants on the same closed-week window
 * for context.
 *
 * Usage:
 *   npx tsx scripts/compare-selector-sentiment-override-weekly-vs-adr.ts
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { loadEnvConfig } from "@next/env";

import { query } from "../src/lib/db";
import { computeMultiWeekHold, type MultiWeekResult } from "../src/lib/performance/weeklyHoldEngine";
import { getIntradayFilter, getStrategy } from "../src/lib/performance/strategyConfig";

loadEnvConfig(process.cwd());

const POLICY_ID = "selector_sentiment_context_override";
const SELECTOR_REPORT_PATH = path.resolve(
  process.cwd(),
  "reports",
  "weekly-bias-context",
  "weekly-bias-context-selector-latest.json",
);
const OUTPUT_DIR = path.resolve(process.cwd(), "app", "reports", "weekly-bias-context");
const OUTPUT_PATH = path.join(OUTPUT_DIR, "selector-sentiment-override-weekly-vs-adr-latest.json");

type PolicyTrade = {
  pair: string;
  weekOpenUtc: string;
  direction: "LONG" | "SHORT";
  returnPct: number;
  score: number;
};

type PolicyWeek = {
  weekOpenUtc: string;
  returnPct: number;
  wins: number;
  losses: number;
  longs: number;
  shorts: number;
  trades: PolicyTrade[];
};

type PolicySummary = {
  policy: string;
  trades: number;
  weeks: number;
  returnPct: number;
  winRatePct: number;
  avgTradePct: number;
  maxDrawdownPct: number;
  worstWeekPct: number;
  losingWeeks: number;
  longCount: number;
  shortCount: number;
  weekly: PolicyWeek[];
};

type SelectorReport = {
  ranked: PolicySummary[];
};

type TradeRow = {
  symbol: string;
  direction: string;
  entry_price: string | null;
  exit_price: string | null;
  pnl_pct: string | null;
  exit_reason: string | null;
  entry_time_utc: string | null;
  exit_time_utc: string | null;
  metadata: Record<string, unknown> | null;
};

type WeeklyPriceRow = {
  symbol: string;
  close_price: string;
};

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function computeMaxDrawdown(weeklyReturns: number[]) {
  let equity = 0;
  let peak = 0;
  let maxDrawdown = 0;
  for (const value of weeklyReturns) {
    equity += value;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.min(maxDrawdown, equity - peak);
  }
  return maxDrawdown;
}

async function delay(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(label: string, work: () => Promise<T>, maxAttempts = 4): Promise<T> {
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      return await work();
    } catch (error) {
      lastError = error;
      const message = error instanceof Error ? error.message : String(error);
      const retryable =
        message.includes("Connection terminated unexpectedly") ||
        message.includes("ECONNRESET") ||
        message.includes("timeout") ||
        message.includes("Failed to fetch");
      if (!retryable || attempt === maxAttempts) {
        throw error;
      }
      console.warn(`[retry] ${label} failed on attempt ${attempt}/${maxAttempts}: ${message}`);
      await delay(750 * attempt);
    }
  }
  throw lastError instanceof Error ? lastError : new Error(`${label} failed`);
}

function summarizeMultiWeek(result: MultiWeekResult) {
  return {
    strategy: result.biasSourceId,
    weeks: result.weeks.length,
    trades: result.totalTrades,
    returnPct: round(result.totalReturnPct),
    winRatePct: round(result.winRate),
    maxDrawdownPct: round(result.maxDrawdownPct),
    weekly: result.weeks.map((week) => ({
      weekOpenUtc: week.weekOpenUtc,
      returnPct: round(week.totalReturnPct),
      trades: week.tradeCount,
      winRatePct: round(week.winRate),
    })),
  };
}

async function main() {
  const selectorReport = JSON.parse(readFileSync(SELECTOR_REPORT_PATH, "utf8")) as SelectorReport;
  const selectorSummary = selectorReport.ranked.find((summary) => summary.policy === POLICY_ID);
  if (!selectorSummary) {
    throw new Error(`Policy ${POLICY_ID} not found in selector report.`);
  }

  const weeks = selectorSummary.weekly.map((week) => week.weekOpenUtc);
  const selectorDirectionMap = new Map<string, "LONG" | "SHORT">();
  for (const week of selectorSummary.weekly) {
    for (const trade of week.trades) {
      selectorDirectionMap.set(`${trade.pair.toUpperCase()}|${week.weekOpenUtc}`, trade.direction);
    }
  }

  const runRows = await withRetry("adr run lookup", () =>
    query<{ id: string }>(
      `SELECT id FROM strategy_backtest_runs
       WHERE bot_id = 'adr-forward' AND variant = 'fresh-start'
         AND market = 'multi-asset' AND config_key = 'default'
       LIMIT 1`,
      [],
    ),
  );
  if (runRows.length === 0) {
    throw new Error("No ADR backtest run found.");
  }
  const runId = Number(runRows[0]!.id);

  const selectorAdrWeekly: Array<{
    weekOpenUtc: string;
    returnPct: number;
    trades: number;
    winRatePct: number;
  }> = [];
  let selectorAdrTotalReturn = 0;
  let selectorAdrTradeCount = 0;
  let selectorAdrWins = 0;

  for (const weekOpenUtc of weeks) {
    const tradeRows = await withRetry(`adr trades ${weekOpenUtc}`, () =>
      query<TradeRow>(
        `SELECT symbol, direction, entry_price, exit_price, pnl_pct, exit_reason,
                entry_time_utc::text, exit_time_utc::text, metadata
           FROM strategy_backtest_trades
          WHERE run_id = $1
            AND week_open_utc = $2::timestamptz
          ORDER BY entry_time_utc ASC NULLS LAST`,
        [runId, weekOpenUtc],
      ),
    );

    const closeRows = await withRetry(`weekly closes ${weekOpenUtc}`, () =>
      query<WeeklyPriceRow>(
        `SELECT symbol, close_price
           FROM pair_period_returns
          WHERE period_type = 'weekly'
            AND period_open_utc = $1::timestamptz`,
        [weekOpenUtc],
      ),
    );
    const closeMap = new Map<string, number>();
    for (const row of closeRows) {
      closeMap.set(row.symbol.toUpperCase(), Number(row.close_price));
    }

    let weekReturn = 0;
    let weekTrades = 0;
    let weekWins = 0;

    for (const row of tradeRows) {
      const symbol = row.symbol.toUpperCase();
      const approvedDirection = selectorDirectionMap.get(`${symbol}|${weekOpenUtc}`);
      if (!approvedDirection || approvedDirection !== row.direction) continue;

      const entryPrice = row.entry_price ? Number(row.entry_price) : 0;
      let exitPrice = row.exit_price ? Number(row.exit_price) : entryPrice;
      let pnlPct = row.pnl_pct ? Number(row.pnl_pct) : 0;

      if (row.exit_reason === "active" && entryPrice > 0) {
        const weekClosePrice = closeMap.get(symbol);
        if (weekClosePrice) {
          exitPrice = weekClosePrice;
          const rawReturn = ((weekClosePrice - entryPrice) / entryPrice) * 100;
          pnlPct = row.direction === "SHORT" ? -rawReturn : rawReturn;
        }
      }

      weekTrades += 1;
      weekReturn += pnlPct;
      if (pnlPct > 0) weekWins += 1;
    }

    selectorAdrWeekly.push({
      weekOpenUtc,
      returnPct: round(weekReturn),
      trades: weekTrades,
      winRatePct: round(weekTrades > 0 ? (weekWins / weekTrades) * 100 : 0),
    });
    selectorAdrTotalReturn += weekReturn;
    selectorAdrTradeCount += weekTrades;
    selectorAdrWins += weekWins;
  }

  const selectorAdrWeeklyReturns = selectorAdrWeekly.map((week) => week.returnPct);
  const selectorAdrSummary = {
    policy: `${POLICY_ID}_adr_pullback`,
    weeks: selectorAdrWeekly.length,
    trades: selectorAdrTradeCount,
    returnPct: round(selectorAdrTotalReturn),
    winRatePct: round(selectorAdrTradeCount > 0 ? (selectorAdrWins / selectorAdrTradeCount) * 100 : 0),
    maxDrawdownPct: round(computeMaxDrawdown(selectorAdrWeeklyReturns)),
    worstWeekPct: round(selectorAdrWeeklyReturns.reduce((min, value) => Math.min(min, value), 0)),
    losingWeeks: selectorAdrWeeklyReturns.filter((value) => value < 0).length,
    weekly: selectorAdrWeekly,
  };

  const intradayFilter = getIntradayFilter("adr_pullback");
  if (!intradayFilter) {
    throw new Error("ADR pullback intraday filter not found.");
  }

  const canonicalAdrComparisons: Array<[string, ReturnType<typeof summarizeMultiWeek>]> = [];
  for (const strategyId of ["sentiment", "tiered_v3", "agree_2of3", "dealer"]) {
    const strategy = getStrategy(strategyId);
    if (!strategy) {
      throw new Error(`Missing strategy ${strategyId}`);
    }
    const result = await withRetry(`canonical ADR ${strategyId}`, () =>
      computeMultiWeekHold(strategy, weeks, intradayFilter),
    );
    canonicalAdrComparisons.push([strategyId, summarizeMultiWeek(result)]);
  }

  const report = {
    generatedUtc: new Date().toISOString(),
    methodology: {
      weeklyHoldSource: SELECTOR_REPORT_PATH,
      adrTradeSource: "strategy_backtest_trades via canonical adr-forward fresh-start run",
      note: "Selector directions are fixed from the weekly selector report, then filtered through the same ADR trade rows the app uses for canonical ADR performance.",
      policy: POLICY_ID,
      weeks,
    },
    selectorWeeklyHold: {
      policy: selectorSummary.policy,
      weeks: selectorSummary.weeks,
      trades: selectorSummary.trades,
      returnPct: round(selectorSummary.returnPct),
      winRatePct: round(selectorSummary.winRatePct),
      maxDrawdownPct: round(selectorSummary.maxDrawdownPct),
      worstWeekPct: round(selectorSummary.worstWeekPct),
      losingWeeks: selectorSummary.losingWeeks,
    },
    selectorAdrPullback: selectorAdrSummary,
    canonicalAdrComparisons: Object.fromEntries(canonicalAdrComparisons),
  };

  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(OUTPUT_PATH, JSON.stringify(report, null, 2), "utf8");

  console.log(`Selector weekly vs ADR comparison: ${OUTPUT_PATH}`);
  console.log(
    `selector weekly hold: +${round(selectorSummary.returnPct).toFixed(2)}% | DD ${round(selectorSummary.maxDrawdownPct).toFixed(2)}% | trades ${selectorSummary.trades}`,
  );
  console.log(
    `selector ADR pullback: ${selectorAdrSummary.returnPct >= 0 ? "+" : ""}${selectorAdrSummary.returnPct.toFixed(2)}% | DD ${selectorAdrSummary.maxDrawdownPct.toFixed(2)}% | trades ${selectorAdrSummary.trades}`,
  );
  for (const [strategyId, summary] of canonicalAdrComparisons) {
    console.log(
      `canonical ADR/${strategyId}: ${summary.returnPct >= 0 ? "+" : ""}${summary.returnPct.toFixed(2)}% | DD ${summary.maxDrawdownPct.toFixed(2)}% | trades ${summary.trades}`,
    );
  }
}

main().catch((error) => {
  console.error("Selector weekly vs ADR comparison failed:", error);
  process.exit(1);
});
