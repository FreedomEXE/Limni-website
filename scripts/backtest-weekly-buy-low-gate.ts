/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: backtest-weekly-buy-low-gate.ts
 *
 * Description:
 * Compare baseline weekly-hold performance against a simple
 * previous-week candle gate for the base weekly systems:
 *   - dealer
 *   - commercial
 *   - sentiment
 *
 * Gate rule:
 *   - LONG only passes if the previous weekly candle closed bearish
 *   - SHORT only passes if the previous weekly candle closed bullish
 *   - otherwise the trade is skipped
 *
 * This is a "buy the dip / sell the rip" overlay for week-start holds.
 *
 * Usage:
 *   npx tsx scripts/backtest-weekly-buy-low-gate.ts
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { DateTime } from "luxon";

import { query } from "../src/lib/db";
import { getCanonicalBasketWeek, filterByModel, nonNeutralSignals, type BaseBasketModel } from "../src/lib/performance/basketSource";
import { getCanonicalWeekOpenUtc } from "../src/lib/weekAnchor";
import { listPerformanceWeeks } from "../src/lib/performanceSnapshots";

loadEnvConfig(process.cwd());

const LOOKBACK_WEEKS = Number(process.env.WEEKLY_BUY_LOW_GATE_WEEKS ?? "52");
const OUTPUT_DIR = path.resolve(process.cwd(), "reports", "weekly-buy-low-gate");
const OUTPUT_PATH = path.join(OUTPUT_DIR, "weekly-buy-low-gate-latest.json");

const STRATEGIES: Array<{ key: BaseBasketModel; label: string }> = [
  { key: "dealer", label: "Dealer" },
  { key: "commercial", label: "Commercial" },
  { key: "sentiment", label: "Sentiment" },
];

type Direction = "LONG" | "SHORT";
type GateReason = "PASS" | "NO_PRIOR_WEEK" | "CHASING_BULLISH_CLOSE" | "CHASING_BEARISH_CLOSE" | "PRIOR_DOJI";

type WeeklyPriceRow = {
  symbol: string;
  period_open_utc: Date;
  open_price: string | number;
  close_price: string | number;
  return_pct: string | number;
};

type PricePoint = {
  symbol: string;
  weekOpenUtc: string;
  openPrice: number;
  closePrice: number;
  returnPct: number;
};

type TradeWeek = {
  weekOpenUtc: string;
  baselineReturnPct: number;
  baselineTrades: number;
  baselineWins: number;
  gatedReturnPct: number;
  gatedTrades: number;
  gatedWins: number;
  skippedTrades: number;
  passedTrades: number;
  gateReasons: Record<GateReason, number>;
};

type MetricSummary = {
  returnPct: number;
  trades: number;
  winRatePct: number;
  avgTradePct: number;
  maxDrawdownPct: number;
  worstWeekPct: number;
  losingWeeks: number;
};

type StrategySummary = {
  strategy: string;
  weeks: number;
  baseline: MetricSummary;
  gated: MetricSummary;
  delta: {
    returnPct: number;
    trades: number;
    winRatePct: number;
    avgTradePct: number;
    maxDrawdownPct: number;
    worstWeekPct: number;
    losingWeeks: number;
  };
  gateActivity: {
    totalSignals: number;
    passedTrades: number;
    skippedTrades: number;
    passRatePct: number;
    skipRatePct: number;
    reasons: Record<GateReason, number>;
  };
  weekly: TradeWeek[];
};

function fmtPct(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

function maxDrawdownFromWeekly(weekly: number[]) {
  let equity = 0;
  let peak = 0;
  let maxDd = 0;
  for (const value of weekly) {
    equity += value;
    peak = Math.max(peak, equity);
    maxDd = Math.min(maxDd, equity - peak);
  }
  return maxDd;
}

function summarizeMetric(weekly: TradeWeek[], mode: "baseline" | "gated"): MetricSummary {
  const returns = weekly.map((row) => mode === "baseline" ? row.baselineReturnPct : row.gatedReturnPct);
  const trades = weekly.reduce((sum, row) => sum + (mode === "baseline" ? row.baselineTrades : row.gatedTrades), 0);
  const wins = weekly.reduce((sum, row) => sum + (mode === "baseline" ? row.baselineWins : row.gatedWins), 0);
  const losingWeeks = returns.filter((value) => value < 0).length;
  const totalReturn = returns.reduce((sum, value) => sum + value, 0);

  return {
    returnPct: round(totalReturn),
    trades,
    winRatePct: round(trades > 0 ? (wins / trades) * 100 : 0),
    avgTradePct: round(trades > 0 ? totalReturn / trades : 0),
    maxDrawdownPct: round(maxDrawdownFromWeekly(returns)),
    worstWeekPct: round(returns.reduce((min, value) => Math.min(min, value), 0)),
    losingWeeks,
  };
}

function evaluateGate(direction: Direction, previousWeek: PricePoint | null): GateReason {
  if (!previousWeek) return "NO_PRIOR_WEEK";
  if (previousWeek.closePrice === previousWeek.openPrice) return "PRIOR_DOJI";
  const priorBullish = previousWeek.closePrice > previousWeek.openPrice;
  const priorBearish = previousWeek.closePrice < previousWeek.openPrice;
  if (direction === "LONG") {
    return priorBearish ? "PASS" : "CHASING_BULLISH_CLOSE";
  }
  return priorBullish ? "PASS" : "CHASING_BEARISH_CLOSE";
}

function emptyReasons(): Record<GateReason, number> {
  return {
    PASS: 0,
    NO_PRIOR_WEEK: 0,
    CHASING_BULLISH_CLOSE: 0,
    CHASING_BEARISH_CLOSE: 0,
    PRIOR_DOJI: 0,
  };
}

async function loadWeeklyPriceHistory() {
  const rows = await query<WeeklyPriceRow>(
    `SELECT symbol, period_open_utc, open_price, close_price, return_pct
       FROM pair_period_returns
      WHERE period_type = 'weekly'
      ORDER BY symbol ASC, period_open_utc ASC`,
    [],
  );

  const currentBySymbolWeek = new Map<string, PricePoint>();
  const previousBySymbolWeek = new Map<string, PricePoint | null>();
  const bySymbol = new Map<string, PricePoint[]>();

  for (const raw of rows) {
    const point: PricePoint = {
      symbol: raw.symbol.toUpperCase(),
      weekOpenUtc: raw.period_open_utc.toISOString(),
      openPrice: Number(raw.open_price),
      closePrice: Number(raw.close_price),
      returnPct: Number(raw.return_pct),
    };
    const list = bySymbol.get(point.symbol) ?? [];
    list.push(point);
    bySymbol.set(point.symbol, list);
  }

  for (const [symbol, history] of bySymbol.entries()) {
    for (let i = 0; i < history.length; i += 1) {
      const current = history[i]!;
      const previous = i > 0 ? history[i - 1]! : null;
      currentBySymbolWeek.set(`${symbol}|${current.weekOpenUtc}`, current);
      previousBySymbolWeek.set(`${symbol}|${current.weekOpenUtc}`, previous);
    }
  }

  return { currentBySymbolWeek, previousBySymbolWeek };
}

async function main() {
  const currentWeekOpenUtc = getCanonicalWeekOpenUtc(DateTime.utc());
  const rawWeeks = await listPerformanceWeeks(Math.max(LOOKBACK_WEEKS + 8, 24));
  const closedWeeks = rawWeeks
    .filter((week) => week !== currentWeekOpenUtc)
    .sort((a, b) => Date.parse(a) - Date.parse(b))
    .slice(-LOOKBACK_WEEKS);

  if (closedWeeks.length === 0) {
    throw new Error("No closed performance weeks found.");
  }

  const { currentBySymbolWeek, previousBySymbolWeek } = await loadWeeklyPriceHistory();
  const strategyWeeks = new Map<BaseBasketModel, TradeWeek[]>(
    STRATEGIES.map((strategy) => [strategy.key, []]),
  );

  for (const weekOpenUtc of closedWeeks) {
    const basketWeek = await getCanonicalBasketWeek(weekOpenUtc);

    for (const strategy of STRATEGIES) {
      const signals = nonNeutralSignals(filterByModel(basketWeek, strategy.key));
      const weekResult: TradeWeek = {
        weekOpenUtc,
        baselineReturnPct: 0,
        baselineTrades: 0,
        baselineWins: 0,
        gatedReturnPct: 0,
        gatedTrades: 0,
        gatedWins: 0,
        skippedTrades: 0,
        passedTrades: 0,
        gateReasons: emptyReasons(),
      };

      for (const signal of signals) {
        if (signal.direction !== "LONG" && signal.direction !== "SHORT") continue;
        const priceKey = `${signal.symbol.toUpperCase()}|${weekOpenUtc}`;
        const currentWeek = currentBySymbolWeek.get(priceKey);
        if (!currentWeek) continue;

        const directedReturn = signal.direction === "LONG" ? currentWeek.returnPct : -currentWeek.returnPct;
        weekResult.baselineTrades += 1;
        weekResult.baselineReturnPct += directedReturn;
        if (directedReturn > 0) {
          weekResult.baselineWins += 1;
        }

        const previousWeek = previousBySymbolWeek.get(priceKey) ?? null;
        const reason = evaluateGate(signal.direction, previousWeek);
        weekResult.gateReasons[reason] += 1;

        if (reason === "PASS") {
          weekResult.gatedTrades += 1;
          weekResult.gatedReturnPct += directedReturn;
          weekResult.passedTrades += 1;
          if (directedReturn > 0) {
            weekResult.gatedWins += 1;
          }
        } else {
          weekResult.skippedTrades += 1;
        }
      }

      weekResult.baselineReturnPct = round(weekResult.baselineReturnPct);
      weekResult.gatedReturnPct = round(weekResult.gatedReturnPct);
      strategyWeeks.get(strategy.key)!.push(weekResult);
    }
  }

  for (const strategy of STRATEGIES) {
    const filtered = strategyWeeks.get(strategy.key)!.filter((week) => week.baselineTrades > 0);
    strategyWeeks.set(strategy.key, filtered);
  }

  const analyzedWeeks = strategyWeeks.get(STRATEGIES[0]!.key)?.length ?? 0;
  const summaries: StrategySummary[] = STRATEGIES.map((strategy) => {
    const weekly = strategyWeeks.get(strategy.key)!;
    const baseline = summarizeMetric(weekly, "baseline");
    const gated = summarizeMetric(weekly, "gated");
    const reasons = emptyReasons();

    let totalSignals = 0;
    let passedTrades = 0;
    let skippedTrades = 0;
    for (const week of weekly) {
      totalSignals += week.baselineTrades;
      passedTrades += week.passedTrades;
      skippedTrades += week.skippedTrades;
      for (const [reason, count] of Object.entries(week.gateReasons) as Array<[GateReason, number]>) {
        reasons[reason] += count;
      }
    }

    return {
      strategy: strategy.label,
      weeks: weekly.length,
      baseline,
      gated,
      delta: {
        returnPct: round(gated.returnPct - baseline.returnPct),
        trades: gated.trades - baseline.trades,
        winRatePct: round(gated.winRatePct - baseline.winRatePct),
        avgTradePct: round(gated.avgTradePct - baseline.avgTradePct),
        maxDrawdownPct: round(gated.maxDrawdownPct - baseline.maxDrawdownPct),
        worstWeekPct: round(gated.worstWeekPct - baseline.worstWeekPct),
        losingWeeks: gated.losingWeeks - baseline.losingWeeks,
      },
      gateActivity: {
        totalSignals,
        passedTrades,
        skippedTrades,
        passRatePct: round(totalSignals > 0 ? (passedTrades / totalSignals) * 100 : 0),
        skipRatePct: round(totalSignals > 0 ? (skippedTrades / totalSignals) * 100 : 0),
        reasons,
      },
      weekly,
    };
  });

  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(
    OUTPUT_PATH,
    JSON.stringify(
      {
        generatedUtc: new Date().toISOString(),
        lookbackWeeksRequested: closedWeeks.length,
        analyzedWeeks,
        weekRange: {
          first: closedWeeks[0],
          last: closedWeeks[closedWeeks.length - 1],
        },
        rule: {
          long: "previous weekly candle must close bearish",
          short: "previous weekly candle must close bullish",
          doji: "skip",
        },
        strategies: summaries,
      },
      null,
      2,
    ),
    "utf8",
  );

  console.log(`Weekly buy-low gate comparison (${analyzedWeeks} analyzed weeks, ${closedWeeks.length} requested)`);
  console.log(`Report: ${OUTPUT_PATH}`);
  for (const summary of summaries) {
    console.log(
      [
        `${summary.strategy}:`,
        `baseline ${fmtPct(summary.baseline.returnPct)} / DD ${fmtPct(summary.baseline.maxDrawdownPct)}`,
        `gated ${fmtPct(summary.gated.returnPct)} / DD ${fmtPct(summary.gated.maxDrawdownPct)}`,
        `delta ${fmtPct(summary.delta.returnPct)}`,
        `skip ${summary.gateActivity.skipRatePct.toFixed(1)}%`,
      ].join(" | "),
    );
  }
}

main()
  .catch((error) => {
    console.error("Weekly buy-low gate comparison failed:", error);
    process.exit(1);
  });
