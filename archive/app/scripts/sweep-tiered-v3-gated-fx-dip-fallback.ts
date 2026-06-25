/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: sweep-tiered-v3-gated-fx-dip-fallback.ts
 *
 * Description:
 * Runs a first-pass fallback-only FX dip-entry sweep for the locked
 * weekly flagship using canonical daily high/low bars as the current
 * path proxy.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { DateTime } from "luxon";
import { Client } from "pg";

function loadEnvFileIntoProcess(filePath: string) {
  if (!existsSync(filePath)) return;
  const lines = readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex <= 0) continue;
    const key = trimmed.slice(0, eqIndex).trim();
    const value = trimmed.slice(eqIndex + 1);
    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

const REPO_ROOT = path.resolve(__dirname, "..");
loadEnvFileIntoProcess(path.join(REPO_ROOT, ".env"));
loadEnvFileIntoProcess(path.join(REPO_ROOT, ".env.local"));

const TARGET_SYSTEM = "tiered_v3_gated";
const TARGET_STRATEGY_NAME = "Tiered V3 Net Hold Gated";
const THRESHOLDS_PCT = [0.5, 0.75, 1.0, 1.25, 1.5] as const;

type TradeDirection = "LONG" | "SHORT";
type AssetClass = "fx" | "indices" | "crypto" | "commodities";

type NettedPairRow = {
  symbol: string;
  assetClass: AssetClass;
  direction: TradeDirection;
  tierWeight: number;
  returnPct: number;
  positionContributionPct: number;
};

type WeeklyReturnRow = {
  weekOpenUtc: string;
  returnPct: number;
  trades: number;
  wins: number;
  losses: number;
  drawdownPct: number;
  grossProfitPct: number;
  grossLossPct: number;
  breakdown: {
    nettedPairs: NettedPairRow[];
  };
};

type FlagshipSystemRow = {
  system: string;
  strategyName: string;
  weeks: number;
  weeklyReturns: WeeklyReturnRow[];
  simpleReturnPct: number;
  compoundedReturnPct: number;
  maxDrawdownSimplePct: number;
  maxDrawdownPct: number;
  totalTrades: number;
  totalWins: number;
  totalLosses: number;
  winRatePct: number;
};

type CanonicalReport = {
  generated_utc: string;
  canonical_weeks: string[];
  composite_systems_gated: FlagshipSystemRow[];
};

type WeeklyPriceRow = {
  open_price: number | string;
  close_price: number | string;
};

type DailyPriceRow = {
  period_open_utc: Date;
  high_price: number | string | null;
  low_price: number | string | null;
};

type ThresholdWeekSummary = {
  weekOpenUtc: string;
  returnPct: number;
  trades: number;
  wins: number;
  losses: number;
  fxTrades: number;
  fxTriggered: number;
  fxDeltaContributionPct: number;
};

type ThresholdSummary = {
  thresholdPct: number;
  mode: "fallback";
  fxTrades: number;
  fxTriggered: number;
  fillRatePct: number;
  postFillMae: {
    avgWorstMaePct: number;
    medianWorstMaePct: number;
    worstWorstMaePct: number;
    hitMinus050Count: number;
    hitMinus050Pct: number;
    hitMinus100Count: number;
    hitMinus100Pct: number;
  };
  avgTriggeredImprovementReturnPct: number;
  avgTriggeredImprovementContributionPct: number;
  simpleReturnPct: number;
  compoundedReturnPct: number;
  maxDrawdownSimplePct: number;
  weeklyWinRatePct: number;
  tradeWinRatePct: number;
  totalTrades: number;
  totalWins: number;
  totalLosses: number;
  deltaVsBaseline: {
    simpleReturnPct: number;
    compoundedReturnPct: number;
    maxDrawdownSimplePct: number;
    weeklyWinRatePct: number;
    tradeWinRatePct: number;
  };
  weekly: ThresholdWeekSummary[];
};

function round(value: number, places = 4) {
  if (!Number.isFinite(value)) return 0;
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function toFinite(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function loadCanonicalReport(): CanonicalReport {
  const reportPath = path.join(REPO_ROOT, "reports", "comprehensive-reconstruction.json");
  return JSON.parse(readFileSync(reportPath, "utf8")) as CanonicalReport;
}

function findTargetSystem(report: CanonicalReport) {
  const system = report.composite_systems_gated.find((entry) => entry.system === TARGET_SYSTEM);
  if (!system) {
    throw new Error(`System ${TARGET_SYSTEM} not found in canonical report.`);
  }
  return system;
}

function getFxWeekWindow(weekOpenUtc: string) {
  const weekOpen = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
  if (!weekOpen.isValid) {
    throw new Error(`Invalid week open: ${weekOpenUtc}`);
  }
  return {
    openUtc: weekOpen.minus({ hours: 2 }).toISO(),
    closeUtc: weekOpen.plus({ hours: 118 }).toISO(),
  };
}

function compoundReturns(returns: number[]) {
  let equity = 1;
  for (const value of returns) {
    equity *= 1 + value / 100;
  }
  return (equity - 1) * 100;
}

function standardDeviation(values: number[]) {
  if (values.length <= 1) return 0;
  const average = values.reduce((sum, value) => sum + value, 0) / values.length;
  const variance =
    values.reduce((sum, value) => sum + (value - average) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function computeWeeklyWinRate(returns: number[]) {
  if (returns.length === 0) return 0;
  const wins = returns.filter((value) => value > 0).length;
  return (wins / returns.length) * 100;
}

function median(values: number[]) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((left, right) => left - right);
  const midpoint = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 0) {
    return (sorted[midpoint - 1]! + sorted[midpoint]!) / 2;
  }
  return sorted[midpoint]!;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required.");
  }

  const report = loadCanonicalReport();
  const system = findTargetSystem(report);
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes("render.com") ? { rejectUnauthorized: false } : false,
  });
  await client.connect();

  const weeklyPriceCache = new Map<string, { openPrice: number; closePrice: number }>();
  const dailyPriceCache = new Map<string, Array<{ highPrice: number | null; lowPrice: number | null }>>();

  async function getWeeklyPrices(symbol: string, weekOpenUtc: string) {
    const cacheKey = `${symbol}|${weekOpenUtc}`;
    const cached = weeklyPriceCache.get(cacheKey);
    if (cached) return cached;
    const result = await client.query<WeeklyPriceRow>(
      `SELECT open_price, close_price
         FROM pair_period_returns
        WHERE symbol = $1
          AND period_type = 'weekly'
          AND period_open_utc = $2::timestamptz
        LIMIT 1`,
      [symbol, weekOpenUtc],
    );
    if (result.rowCount === 0) {
      throw new Error(`Missing weekly pair_period_returns row for ${symbol} ${weekOpenUtc}`);
    }
    const mapped = {
      openPrice: toFinite(result.rows[0]?.open_price),
      closePrice: toFinite(result.rows[0]?.close_price),
    };
    weeklyPriceCache.set(cacheKey, mapped);
    return mapped;
  }

  async function getDailyBars(symbol: string, weekOpenUtc: string) {
    const cacheKey = `${symbol}|${weekOpenUtc}`;
    const cached = dailyPriceCache.get(cacheKey);
    if (cached) return cached;
    const window = getFxWeekWindow(weekOpenUtc);
    const result = await client.query<DailyPriceRow>(
      `SELECT period_open_utc, high_price, low_price
         FROM pair_period_returns
        WHERE symbol = $1
          AND period_type = 'daily'
          AND period_open_utc >= $2::timestamptz
          AND period_open_utc < $3::timestamptz
        ORDER BY period_open_utc ASC`,
      [symbol, window.openUtc, window.closeUtc],
    );
    const mapped = result.rows.map((row) => ({
      highPrice: row.high_price === null ? null : toFinite(row.high_price),
      lowPrice: row.low_price === null ? null : toFinite(row.low_price),
    }));
    dailyPriceCache.set(cacheKey, mapped);
    return mapped;
  }

  const baselineWeeklyReturns = system.weeklyReturns.map((week) => week.returnPct);
  const baselineWeeklyWinRate = computeWeeklyWinRate(baselineWeeklyReturns);
  const baselineTradeWinRate =
    system.totalTrades > 0 ? (system.totalWins / system.totalTrades) * 100 : 0;

  const summaries: ThresholdSummary[] = [];

  for (const thresholdPct of THRESHOLDS_PCT) {
    const weeklySummaries: ThresholdWeekSummary[] = [];
    let totalFxTrades = 0;
    let totalFxTriggered = 0;
    let triggeredHitMinus050Count = 0;
    let triggeredHitMinus100Count = 0;
    const worstMaePcts: number[] = [];
    let totalImprovementReturnPct = 0;
    let totalImprovementContributionPct = 0;
    let totalTrades = 0;
    let totalWins = 0;
    let totalLosses = 0;

    for (const week of system.weeklyReturns) {
      let weekReturnPct = 0;
      let weekTrades = 0;
      let weekWins = 0;
      let weekLosses = 0;
      let weekFxTrades = 0;
      let weekFxTriggered = 0;
      let weekFxDeltaContributionPct = 0;

      for (const pair of week.breakdown.nettedPairs) {
        const baselineReturnPct = pair.returnPct;
        const baselineContributionPct = pair.positionContributionPct;
        let activeReturnPct = baselineReturnPct;
        let activeContributionPct = baselineContributionPct;

        if (pair.assetClass === "fx") {
          totalFxTrades += 1;
          weekFxTrades += 1;
          const weeklyPrices = await getWeeklyPrices(pair.symbol, week.weekOpenUtc);
          const dailyBars = await getDailyBars(pair.symbol, week.weekOpenUtc);
          const entryPrice =
            pair.direction === "LONG"
              ? weeklyPrices.openPrice * (1 - thresholdPct / 100)
              : weeklyPrices.openPrice * (1 + thresholdPct / 100);
          const touched = dailyBars.some((bar) =>
            pair.direction === "LONG"
              ? bar.lowPrice !== null && bar.lowPrice <= entryPrice
              : bar.highPrice !== null && bar.highPrice >= entryPrice,
          );

          if (touched) {
            let worstMaePct = 0;
            for (const bar of dailyBars) {
              let adversePct = 0;
              if (pair.direction === "LONG") {
                if (bar.lowPrice !== null) {
                  adversePct = ((bar.lowPrice / entryPrice) - 1) * 100;
                }
              } else if (bar.highPrice !== null) {
                adversePct = ((entryPrice / bar.highPrice) - 1) * 100;
              }
              if (adversePct < worstMaePct) {
                worstMaePct = adversePct;
              }
            }
            activeReturnPct =
              pair.direction === "LONG"
                ? ((weeklyPrices.closePrice / entryPrice) - 1) * 100
                : ((entryPrice / weeklyPrices.closePrice) - 1) * 100;
            activeContributionPct = activeReturnPct * pair.tierWeight;
            totalFxTriggered += 1;
            weekFxTriggered += 1;
            worstMaePcts.push(worstMaePct);
            if (worstMaePct <= -0.5) {
              triggeredHitMinus050Count += 1;
            }
            if (worstMaePct <= -1.0) {
              triggeredHitMinus100Count += 1;
            }
            totalImprovementReturnPct += activeReturnPct - baselineReturnPct;
            totalImprovementContributionPct += activeContributionPct - baselineContributionPct;
            weekFxDeltaContributionPct += activeContributionPct - baselineContributionPct;
          }
        }

        weekReturnPct += activeContributionPct;
        weekTrades += 1;
        if (activeContributionPct > 0) {
          weekWins += 1;
        } else if (activeContributionPct < 0) {
          weekLosses += 1;
        }
      }

      totalTrades += weekTrades;
      totalWins += weekWins;
      totalLosses += weekLosses;
      weeklySummaries.push({
        weekOpenUtc: week.weekOpenUtc,
        returnPct: round(weekReturnPct, 6),
        trades: weekTrades,
        wins: weekWins,
        losses: weekLosses,
        fxTrades: weekFxTrades,
        fxTriggered: weekFxTriggered,
        fxDeltaContributionPct: round(weekFxDeltaContributionPct, 6),
      });
    }

    const weeklyReturns = weeklySummaries.map((row) => row.returnPct);
    const simpleReturnPct = weeklyReturns.reduce((sum, value) => sum + value, 0);
    const compoundedReturnPct = compoundReturns(weeklyReturns);
    const maxDrawdownSimplePct = Math.max(0, ...weeklyReturns.map((value) => Math.max(0, -value)));
    const weeklyWinRatePct = computeWeeklyWinRate(weeklyReturns);
    const tradeWinRatePct = totalTrades > 0 ? (totalWins / totalTrades) * 100 : 0;
    const fillRatePct = totalFxTrades > 0 ? (totalFxTriggered / totalFxTrades) * 100 : 0;
    const avgWorstMaePct =
      worstMaePcts.length > 0
        ? worstMaePcts.reduce((sum, value) => sum + value, 0) / worstMaePcts.length
        : 0;
    const medianWorstMaePct = median(worstMaePcts);
    const worstWorstMaePct = worstMaePcts.length > 0 ? Math.min(...worstMaePcts) : 0;

    summaries.push({
      thresholdPct,
      mode: "fallback",
      fxTrades: totalFxTrades,
      fxTriggered: totalFxTriggered,
      fillRatePct: round(fillRatePct, 4),
      postFillMae: {
        avgWorstMaePct: round(avgWorstMaePct, 4),
        medianWorstMaePct: round(medianWorstMaePct, 4),
        worstWorstMaePct: round(worstWorstMaePct, 4),
        hitMinus050Count: triggeredHitMinus050Count,
        hitMinus050Pct:
          totalFxTriggered > 0 ? round((triggeredHitMinus050Count / totalFxTriggered) * 100, 4) : 0,
        hitMinus100Count: triggeredHitMinus100Count,
        hitMinus100Pct:
          totalFxTriggered > 0 ? round((triggeredHitMinus100Count / totalFxTriggered) * 100, 4) : 0,
      },
      avgTriggeredImprovementReturnPct: totalFxTriggered > 0 ? round(totalImprovementReturnPct / totalFxTriggered, 4) : 0,
      avgTriggeredImprovementContributionPct:
        totalFxTriggered > 0 ? round(totalImprovementContributionPct / totalFxTriggered, 4) : 0,
      simpleReturnPct: round(simpleReturnPct, 6),
      compoundedReturnPct: round(compoundedReturnPct, 6),
      maxDrawdownSimplePct: round(maxDrawdownSimplePct, 6),
      weeklyWinRatePct: round(weeklyWinRatePct, 4),
      tradeWinRatePct: round(tradeWinRatePct, 4),
      totalTrades,
      totalWins,
      totalLosses,
      deltaVsBaseline: {
        simpleReturnPct: round(simpleReturnPct - system.simpleReturnPct, 6),
        compoundedReturnPct: round(compoundedReturnPct - system.compoundedReturnPct, 6),
        maxDrawdownSimplePct: round(maxDrawdownSimplePct - system.maxDrawdownSimplePct, 6),
        weeklyWinRatePct: round(weeklyWinRatePct - baselineWeeklyWinRate, 4),
        tradeWinRatePct: round(tradeWinRatePct - baselineTradeWinRate, 4),
      },
      weekly: weeklySummaries,
    });
  }

  await client.end();

  const bestBySimpleReturn = [...summaries].sort((left, right) => right.simpleReturnPct - left.simpleReturnPct)[0] ?? null;
  const bestByDrawdownAdjusted = [...summaries].sort((left, right) => {
    const leftScore = left.maxDrawdownSimplePct > 0 ? left.simpleReturnPct / left.maxDrawdownSimplePct : left.simpleReturnPct;
    const rightScore = right.maxDrawdownSimplePct > 0 ? right.simpleReturnPct / right.maxDrawdownSimplePct : right.simpleReturnPct;
    return rightScore - leftScore;
  })[0] ?? null;

  const output = {
    generatedUtc: new Date().toISOString(),
    methodology: {
      mode: "fallback_only",
      targetSystem: TARGET_SYSTEM,
      targetStrategyName: TARGET_STRATEGY_NAME,
      targetAssetClass: "fx",
      thresholdsPct: [...THRESHOLDS_PCT],
      pathAssumption:
        "canonical_daily_high_low_proxy_for_fx; lower-timeframe FX bars are not yet stored canonically",
      executionRule:
        "LONG waits for -threshold% dip from weekly open; SHORT waits for +threshold% rally from weekly open; if not touched, fallback to original week-open entry",
    },
    baseline: {
      simpleReturnPct: round(system.simpleReturnPct, 6),
      compoundedReturnPct: round(system.compoundedReturnPct, 6),
      maxDrawdownSimplePct: round(system.maxDrawdownSimplePct, 6),
      weeklyWinRatePct: round(baselineWeeklyWinRate, 4),
      tradeWinRatePct: round(baselineTradeWinRate, 4),
      totalTrades: system.totalTrades,
      totalWins: system.totalWins,
      totalLosses: system.totalLosses,
      fxTrades: system.weeklyReturns.reduce(
        (sum, week) => sum + week.breakdown.nettedPairs.filter((pair) => pair.assetClass === "fx").length,
        0,
      ),
    },
    results: summaries,
    leaderboards: {
      bestBySimpleReturn,
      bestByReturnPerDrawdown: bestByDrawdownAdjusted,
    },
  };

  const reportsDir = path.join(REPO_ROOT, "reports");
  mkdirSync(reportsDir, { recursive: true });
  const jsonPath = path.join(reportsDir, "tiered-v3-gated-fx-dip-fallback-sweep.json");
  writeFileSync(jsonPath, `${JSON.stringify(output, null, 2)}\n`, "utf8");

  const lines = [
    "# Tiered V3 Gated FX Dip Fallback Sweep",
    "",
    `Generated: ${output.generatedUtc}`,
    "",
    "Methodology:",
    `- System: ${TARGET_STRATEGY_NAME}`,
    "- Asset class: FX only",
    "- Mode: fallback only",
    "- Path assumption: canonical daily high/low proxy for FX",
    "- Rule: if dip/rally threshold is touched, enter at threshold; otherwise keep original week-open entry",
    "",
    "Baseline:",
    `- Simple return: ${output.baseline.simpleReturnPct.toFixed(2)}%`,
    `- Max DD simple: ${output.baseline.maxDrawdownSimplePct.toFixed(2)}%`,
    `- Weekly win rate: ${output.baseline.weeklyWinRatePct.toFixed(2)}%`,
    `- Trade win rate: ${output.baseline.tradeWinRatePct.toFixed(2)}%`,
    `- FX trades: ${output.baseline.fxTrades}`,
    "",
    "Results:",
    "",
    "| Threshold | Fill Rate | Simple Return | Delta vs Baseline | Max DD | Trade Win | Post-Fill <= -1% | Avg Worst MAE |",
    "|---|---:|---:|---:|---:|---:|---:|---:|",
    ...summaries.map((row) =>
      `| ${row.thresholdPct.toFixed(2)}% | ${row.fillRatePct.toFixed(2)}% | ${row.simpleReturnPct.toFixed(2)}% | ${row.deltaVsBaseline.simpleReturnPct >= 0 ? "+" : ""}${row.deltaVsBaseline.simpleReturnPct.toFixed(2)}% | ${row.maxDrawdownSimplePct.toFixed(2)}% | ${row.tradeWinRatePct.toFixed(2)}% | ${row.postFillMae.hitMinus100Pct.toFixed(2)}% | ${row.postFillMae.avgWorstMaePct.toFixed(2)}% |`,
    ),
    "",
    "Leaders:",
    `- Best by simple return: ${bestBySimpleReturn ? `${bestBySimpleReturn.thresholdPct.toFixed(2)}% (${bestBySimpleReturn.simpleReturnPct.toFixed(2)}%)` : "n/a"}`,
    `- Best by return/drawdown: ${bestByDrawdownAdjusted ? `${bestByDrawdownAdjusted.thresholdPct.toFixed(2)}%` : "n/a"}`,
    "",
    `JSON: ${path.relative(REPO_ROOT, jsonPath)}`,
  ];

  const mdPath = path.join(reportsDir, "tiered-v3-gated-fx-dip-fallback-sweep.md");
  writeFileSync(mdPath, `${lines.join("\n")}\n`, "utf8");

  console.log(lines.join("\n"));
}

main().catch((error) => {
  console.error("sweep-tiered-v3-gated-fx-dip-fallback failed:", error);
  process.exitCode = 1;
});
