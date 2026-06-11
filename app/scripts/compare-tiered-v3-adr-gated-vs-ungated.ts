/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: compare-tiered-v3-adr-gated-vs-ungated.ts
 *
 * Description:
 * Compares Tiered V3 vs Tiered V3 Gated using fallback ADR pullback
 * entries with the current provisional intraday threshold map.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { Client } from "pg";

import { getCanonicalWeekWindow } from "../src/lib/canonicalPriceWindows";
import type { AssetClass } from "../src/lib/cotMarkets";
import { getIntradayAdrThreshold } from "../src/lib/flagship/intradayThresholds";

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

const ADR_LOOKBACK_DAYS = 10;
const ADR_MIN_REQUIRED_DAYS = 5;

type TradeDirection = "LONG" | "SHORT";

type NettedPairRow = {
  symbol: string;
  assetClass: AssetClass;
  direction: TradeDirection;
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
  breakdown: {
    nettedPairs: NettedPairRow[];
  };
};

type SystemRow = {
  system: string;
  strategyName: string;
  isGated: boolean;
  weeklyReturns: WeeklyReturnRow[];
};

type CanonicalReport = {
  composite_systems: SystemRow[];
  composite_systems_gated: SystemRow[];
};

type WeeklyPriceRow = {
  open_price: number | string;
  close_price: number | string;
};

type DailyPriceRow = {
  open_price: number | string;
  high_price: number | string | null;
  low_price: number | string | null;
};

type AdrWindow = {
  adrPct: number;
  barsUsed: number;
};

type SystemResult = {
  system: string;
  strategyName: string;
  simpleReturnPct: number;
  baselineSimpleReturnPct: number;
  deltaVsBaselinePct: number;
  maxDrawdownSimplePct: number;
  triggeredTrades: number;
  totalTrades: number;
  fillRatePct: number;
  weeklyWinRatePct: number;
  tradeWinRatePct: number;
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

function computeReturnPct(direction: TradeDirection, entryPrice: number, exitPrice: number) {
  return direction === "LONG"
    ? ((exitPrice / entryPrice) - 1) * 100
    : ((entryPrice / exitPrice) - 1) * 100;
}

function computeSimpleMaxDrawdown(weeklyReturns: number[]) {
  let equity = 0;
  let peak = 0;
  let maxDrawdown = 0;
  for (const value of weeklyReturns) {
    equity += value;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, peak - equity);
  }
  return maxDrawdown;
}

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is required.");
  }

  const report = loadCanonicalReport();
  const systems = [
    ...report.composite_systems,
    ...report.composite_systems_gated,
  ].filter((row) => row.system === "tiered_v3" || row.system === "tiered_v3_gated");

  if (systems.length !== 2) {
    throw new Error("Expected tiered_v3 and tiered_v3_gated in canonical report.");
  }

  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL.includes("render.com") ? { rejectUnauthorized: false } : false,
  });
  await client.connect();

  const weeklyPriceCache = new Map<string, { openPrice: number; closePrice: number }>();
  const dailyPriceCache = new Map<string, Array<{ highPrice: number | null; lowPrice: number | null }>>();
  const adrCache = new Map<string, AdrWindow | null>();

  async function getWeeklyPrices(symbol: string, weekOpenUtc: string) {
    const cacheKey = `${symbol}|${weekOpenUtc}|weekly`;
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
      throw new Error(`Missing weekly return row for ${symbol} ${weekOpenUtc}`);
    }
    const mapped = {
      openPrice: toFinite(result.rows[0]?.open_price),
      closePrice: toFinite(result.rows[0]?.close_price),
    };
    weeklyPriceCache.set(cacheKey, mapped);
    return mapped;
  }

  async function getDailyBars(symbol: string, assetClass: AssetClass, weekOpenUtc: string) {
    const cacheKey = `${symbol}|${assetClass}|${weekOpenUtc}|daily`;
    const cached = dailyPriceCache.get(cacheKey);
    if (cached) return cached;
    const window = getCanonicalWeekWindow(weekOpenUtc, assetClass);
    const result = await client.query<DailyPriceRow>(
      `SELECT high_price, low_price
         FROM pair_period_returns
        WHERE symbol = $1
          AND period_type = 'daily'
          AND period_open_utc >= $2::timestamptz
          AND period_open_utc < $3::timestamptz
        ORDER BY period_open_utc ASC`,
      [symbol, window.openUtc.toISO(), window.closeUtc.toISO()],
    );
    const mapped = result.rows.map((row) => ({
      highPrice: row.high_price === null ? null : toFinite(row.high_price),
      lowPrice: row.low_price === null ? null : toFinite(row.low_price),
    }));
    dailyPriceCache.set(cacheKey, mapped);
    return mapped;
  }

  async function getAdrWindow(symbol: string, assetClass: AssetClass, weekOpenUtc: string) {
    const cacheKey = `${symbol}|${assetClass}|${weekOpenUtc}|adr`;
    if (adrCache.has(cacheKey)) {
      return adrCache.get(cacheKey) ?? null;
    }
    const window = getCanonicalWeekWindow(weekOpenUtc, assetClass);
    const result = await client.query<DailyPriceRow>(
      `SELECT open_price, high_price, low_price
         FROM pair_period_returns
        WHERE symbol = $1
          AND period_type = 'daily'
          AND period_open_utc < $2::timestamptz
        ORDER BY period_open_utc DESC
        LIMIT $3`,
      [symbol, window.openUtc.toISO(), ADR_LOOKBACK_DAYS],
    );
    const validRanges = result.rows
      .map((row) => {
        const openPrice = toFinite(row.open_price);
        const highPrice = row.high_price === null ? null : toFinite(row.high_price);
        const lowPrice = row.low_price === null ? null : toFinite(row.low_price);
        if (openPrice <= 0 || highPrice === null || lowPrice === null) {
          return null;
        }
        return ((highPrice - lowPrice) / openPrice) * 100;
      })
      .filter((value): value is number => value !== null && Number.isFinite(value));

    if (validRanges.length < ADR_MIN_REQUIRED_DAYS) {
      adrCache.set(cacheKey, null);
      return null;
    }

    const mapped = {
      adrPct: validRanges.reduce((sum, value) => sum + value, 0) / validRanges.length,
      barsUsed: validRanges.length,
    };
    adrCache.set(cacheKey, mapped);
    return mapped;
  }

  const results: SystemResult[] = [];

  for (const system of systems) {
    const weeklyReturns: number[] = [];
    let triggeredTrades = 0;
    let totalTrades = 0;
    let winningTrades = 0;
    let winningWeeks = 0;

    for (const week of system.weeklyReturns) {
      let weekReturn = 0;

      for (const pair of week.breakdown.nettedPairs) {
        totalTrades += 1;
        const adrThreshold = getIntradayAdrThreshold(pair.assetClass);
        const adr = await getAdrWindow(pair.symbol, pair.assetClass, week.weekOpenUtc);
        const weeklyPrices = await getWeeklyPrices(pair.symbol, week.weekOpenUtc);
        const dailyBars = await getDailyBars(pair.symbol, pair.assetClass, week.weekOpenUtc);

        let entryPrice = weeklyPrices.openPrice;
        if (adr) {
          const thresholdPct = adr.adrPct * adrThreshold.adrMultiplier;
          const triggerPrice =
            pair.direction === "LONG"
              ? weeklyPrices.openPrice * (1 - thresholdPct / 100)
              : weeklyPrices.openPrice * (1 + thresholdPct / 100);
          const triggered = pair.direction === "LONG"
            ? dailyBars.some((row) => row.lowPrice !== null && row.lowPrice <= triggerPrice)
            : dailyBars.some((row) => row.highPrice !== null && row.highPrice >= triggerPrice);
          if (triggered) {
            entryPrice = triggerPrice;
            triggeredTrades += 1;
          }
        }

        const newReturnPct = computeReturnPct(pair.direction, entryPrice, weeklyPrices.closePrice);
        const contributionFactor =
          Math.abs(pair.returnPct) > 1e-9
            ? pair.positionContributionPct / pair.returnPct
            : 1;
        const newContributionPct = newReturnPct * contributionFactor;
        if (newContributionPct > 0) {
          winningTrades += 1;
        }
        weekReturn += newContributionPct;
      }

      weeklyReturns.push(weekReturn);
      if (weekReturn > 0) {
        winningWeeks += 1;
      }
    }

    const simpleReturnPct = weeklyReturns.reduce((sum, value) => sum + value, 0);
    const baselineSimpleReturnPct = system.weeklyReturns.reduce((sum, week) => sum + week.returnPct, 0);

    results.push({
      system: system.system,
      strategyName: system.strategyName,
      simpleReturnPct: round(simpleReturnPct, 4),
      baselineSimpleReturnPct: round(baselineSimpleReturnPct, 4),
      deltaVsBaselinePct: round(simpleReturnPct - baselineSimpleReturnPct, 4),
      maxDrawdownSimplePct: round(computeSimpleMaxDrawdown(weeklyReturns), 4),
      triggeredTrades,
      totalTrades,
      fillRatePct: round(totalTrades > 0 ? (triggeredTrades / totalTrades) * 100 : 0, 4),
      weeklyWinRatePct: round(weeklyReturns.length > 0 ? (winningWeeks / weeklyReturns.length) * 100 : 0, 4),
      tradeWinRatePct: round(totalTrades > 0 ? (winningTrades / totalTrades) * 100 : 0, 4),
    });
  }

  await client.end();

  const output = {
    generatedUtc: new Date().toISOString(),
    methodology: {
      mode: "fallback_only",
      thresholds: {
        fx: "1.50 ADR",
        indices: "0.75 ADR",
        crypto: "1.50 ADR",
        commodities: "1.00 ADR",
      },
      pathAssumption: "canonical_daily_high_low_proxy_for_zone_touch",
      systemsCompared: results.map((row) => row.system),
    },
    results,
  };

  const jsonPath = path.join(REPO_ROOT, "reports", "tiered-v3-adr-gated-vs-ungated.json");
  const mdPath = path.join(REPO_ROOT, "reports", "tiered-v3-adr-gated-vs-ungated.md");
  writeFileSync(jsonPath, JSON.stringify(output, null, 2));
  writeFileSync(
    mdPath,
    [
      "# Tiered V3 ADR Gated vs Ungated",
      "",
      "| System | ADR Return | Baseline Return | Delta | Max DD Simple | Triggered | Total | Fill Rate | Weekly Win | Trade Win |",
      "| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |",
      ...results.map((row) =>
        `| ${row.strategyName} | ${row.simpleReturnPct.toFixed(2)}% | ${row.baselineSimpleReturnPct.toFixed(2)}% | ${row.deltaVsBaselinePct >= 0 ? "+" : ""}${row.deltaVsBaselinePct.toFixed(2)}% | ${row.maxDrawdownSimplePct.toFixed(2)}% | ${row.triggeredTrades} | ${row.totalTrades} | ${row.fillRatePct.toFixed(2)}% | ${row.weeklyWinRatePct.toFixed(2)}% | ${row.tradeWinRatePct.toFixed(2)}% |`,
      ),
      "",
    ].join("\n"),
  );

  console.log(JSON.stringify(output, null, 2));
}

main().catch((error) => {
  console.error("compare-tiered-v3-adr-gated-vs-ungated failed:", error);
  process.exitCode = 1;
});
