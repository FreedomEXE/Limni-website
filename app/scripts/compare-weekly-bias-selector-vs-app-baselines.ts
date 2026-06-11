/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: compare-weekly-bias-selector-vs-app-baselines.ts
 *
 * Description:
 * Apples-to-apples comparison helper for weekly bias context research.
 *
 * It compares:
 *   - selector policy results from the latest selector report
 *   - canonical app weekly-hold baselines from computeMultiWeekHold()
 *
 * Two windows are included:
 *   1. The app's default sidebar week set
 *   2. The selector's exact fully-closed week set
 *
 * Usage:
 *   npx tsx scripts/compare-weekly-bias-selector-vs-app-baselines.ts
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { loadEnvConfig } from "@next/env";

import { computeMultiWeekHold, type MultiWeekResult } from "../src/lib/performance/weeklyHoldEngine";
import { getStrategy } from "../src/lib/performance/strategyConfig";
import { listDataSectionWeeks } from "../src/lib/dataSectionWeeks";
import { buildDataWeekOptions } from "../src/lib/weekOptions";
import { getDisplayWeekOpenUtc } from "../src/lib/weekAnchor";

loadEnvConfig(process.cwd());

const SELECTOR_REPORT_PATH = path.resolve(
  process.cwd(),
  "reports",
  "weekly-bias-context",
  "weekly-bias-context-selector-latest.json",
);
const OUTPUT_DIR = path.resolve(process.cwd(), "app", "reports", "weekly-bias-context");
const OUTPUT_PATH = path.join(OUTPUT_DIR, "weekly-bias-vs-app-baselines-latest.json");

type SelectorWeekly = {
  weekOpenUtc: string;
  returnPct: number;
};

type SelectorSummary = {
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
  weekly: SelectorWeekly[];
};

type SelectorReport = {
  generatedUtc: string;
  assumptions: {
    analyzedWeeks: number;
    note?: string;
  };
  ranked: SelectorSummary[];
};

function round(value: number, decimals = 2) {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
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

async function computeCanonical(strategyId: string, weeks: string[]) {
  const strategy = getStrategy(strategyId);
  if (!strategy) {
    throw new Error(`Unknown strategy: ${strategyId}`);
  }
  return computeMultiWeekHold(strategy, weeks);
}

async function main() {
  const selectorReport = JSON.parse(
    readFileSync(SELECTOR_REPORT_PATH, "utf8"),
  ) as SelectorReport;

  if (!selectorReport.ranked.length) {
    throw new Error("Selector report has no ranked summaries.");
  }

  const selectorWeeks = selectorReport.ranked[0]!.weekly.map((week) => week.weekOpenUtc);

  const historicalWeeks = await listDataSectionWeeks();
  const currentWeekOpenUtc = getDisplayWeekOpenUtc();
  const appWeekOptions = buildDataWeekOptions({
    historicalWeeks,
    currentWeekOpenUtc,
  }).filter((week): week is string => week !== "all");

  const strategyIds = ["dealer", "commercial", "sentiment", "tiered_v3", "agree_2of3"] as const;

  const appDefaultEntries = await Promise.all(
    strategyIds.map(async (strategyId) => [strategyId, summarizeMultiWeek(await computeCanonical(strategyId, appWeekOptions))] as const),
  );

  const selectorWindowEntries = await Promise.all(
    strategyIds.map(async (strategyId) => [strategyId, summarizeMultiWeek(await computeCanonical(strategyId, selectorWeeks))] as const),
  );

  const selectorByPolicy = Object.fromEntries(
    selectorReport.ranked.map((summary) => [
      summary.policy,
      {
        policy: summary.policy,
        weeks: summary.weeks,
        trades: summary.trades,
        returnPct: round(summary.returnPct),
        winRatePct: round(summary.winRatePct),
        maxDrawdownPct: round(summary.maxDrawdownPct),
        worstWeekPct: round(summary.worstWeekPct),
        losingWeeks: summary.losingWeeks,
        longCount: summary.longCount,
        shortCount: summary.shortCount,
      },
    ]),
  );

  const report = {
    generatedUtc: new Date().toISOString(),
    sourceReports: {
      selectorReportPath: SELECTOR_REPORT_PATH,
    },
    windows: {
      appDefault: {
        weeks: appWeekOptions,
        count: appWeekOptions.length,
      },
      selectorClosed: {
        weeks: selectorWeeks,
        count: selectorWeeks.length,
      },
    },
    selectorReportAssumptions: selectorReport.assumptions,
    appCanonicalBaselines: {
      appDefaultWindow: Object.fromEntries(appDefaultEntries),
      selectorClosedWindow: Object.fromEntries(selectorWindowEntries),
    },
    selectorSummariesOnSelectorWindow: selectorByPolicy,
  };

  mkdirSync(OUTPUT_DIR, { recursive: true });
  writeFileSync(OUTPUT_PATH, JSON.stringify(report, null, 2), "utf8");

  console.log(`Weekly bias selector vs app baselines report: ${OUTPUT_PATH}`);
  console.log(`App default window: ${appWeekOptions.length} weeks`);
  for (const [strategyId, summary] of appDefaultEntries) {
    console.log(
      `app/${strategyId}: ${summary.returnPct >= 0 ? "+" : ""}${summary.returnPct.toFixed(2)}% | DD ${summary.maxDrawdownPct.toFixed(2)}% | trades ${summary.trades}`,
    );
  }

  console.log(`Selector closed window: ${selectorWeeks.length} weeks`);
  for (const [strategyId, summary] of selectorWindowEntries) {
    console.log(
      `closed/${strategyId}: ${summary.returnPct >= 0 ? "+" : ""}${summary.returnPct.toFixed(2)}% | DD ${summary.maxDrawdownPct.toFixed(2)}% | trades ${summary.trades}`,
    );
  }

  const selectorLeader = selectorReport.ranked[0]!;
  console.log(
    `selector/${selectorLeader.policy}: ${selectorLeader.returnPct >= 0 ? "+" : ""}${selectorLeader.returnPct.toFixed(2)}% | DD ${selectorLeader.maxDrawdownPct.toFixed(2)}% | trades ${selectorLeader.trades}`,
  );
}

main().catch((error) => {
  console.error("Weekly bias selector vs app baselines comparison failed:", error);
  process.exit(1);
});
