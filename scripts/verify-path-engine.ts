/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: verify-path-engine.ts
 *
 * Description:
 * Verify the Phase 1 basket path engine against live weekly-close
 * strategy baselines and write a markdown report for review.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { listDataSectionWeeks } from "../src/lib/dataSectionWeeks";
import { getDisplayWeekOpenUtc } from "../src/lib/weekAnchor";
import { getEntryStyle, getStrategy } from "../src/lib/performance/strategyConfig";
import { computeMultiWeekHold, computeWeeklyHold, type WeeklyHoldResult } from "../src/lib/performance/weeklyHoldEngine";
import { buildWeeklyHoldLedger } from "../src/lib/performance/positionLedger";
import { loadPathBars } from "../src/lib/performance/pathBarLoader";
import { computeBasketPath, computeMultiWeekBasketPath, type BasketPathResult } from "../src/lib/performance/basketPathEngine";

type StrategyTarget = {
  id: "dealer" | "selector_frag3" | "agree_3of4";
  label: string;
};

type WeekCoverage = {
  weekOpenUtc: string;
  symbolCount: number;
  symbolsWithBars: number;
  missingBarSymbols: string[];
  totalBars: number;
  activeLegs: number;
};

type StrategyVerification = {
  label: string;
  weeklyCloseTotalPct: number;
  pathTotalPct: number;
  differencePctPoints: number;
  status: "PASS" | "FAIL";
  weeklyCloseDdPct: number;
  pathSummary: ReturnType<typeof computeMultiWeekBasketPath>["summary"];
  weekCoverages: WeekCoverage[];
  weeklyPathResults: BasketPathResult[];
  weeklyCloseWeeks: WeeklyHoldResult[];
};

const TARGETS: StrategyTarget[] = [
  { id: "dealer", label: "Dealer Raw" },
  { id: "selector_frag3", label: "Selector Frag3" },
  { id: "agree_3of4", label: "Agreement" },
];

const PASS_THRESHOLD_PCT_POINTS = 0.5;

function signedPct(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function fmtWeek(weekOpenUtc: string) {
  return weekOpenUtc.slice(0, 10);
}

async function buildStrategyVerification(
  target: StrategyTarget,
  weeks: string[],
) {
  const strategy = getStrategy(target.id);
  const entryStyle = getEntryStyle("weekly_hold");
  if (!strategy || !entryStyle) {
    throw new Error(`Missing strategy or entry style for ${target.id}`);
  }

  const weeklyClose = await computeMultiWeekHold(strategy, weeks, entryStyle);
  const weeklyPathResults: BasketPathResult[] = [];
  const weekCoverages: WeekCoverage[] = [];
  const weeklyCloseWeeks: WeeklyHoldResult[] = [];

  for (const weekOpenUtc of weeks) {
    const weekResult = await computeWeeklyHold(strategy, weekOpenUtc, entryStyle);
    weeklyCloseWeeks.push(weekResult);

    const ledger = await buildWeeklyHoldLedger(weekResult, { entryStyleId: entryStyle.id });
    const symbols = ledger.legs.map((leg) => leg.symbol);
    const bars = await loadPathBars(symbols, ledger.weekOpenUtc, ledger.weekCloseUtc, "1h");
    const pathResult = computeBasketPath(ledger, bars);
    weeklyPathResults.push(pathResult);

    const missingBarSymbols = Array.from(
      new Set(
        ledger.legs
          .map((leg) => leg.symbol)
          .filter((symbol) => (bars.get(symbol) ?? []).length === 0),
      ),
    ).sort();

    const totalBars = Array.from(bars.values()).reduce((sum, symbolBars) => sum + symbolBars.length, 0);
    const symbolsWithBars = Array.from(bars.values()).filter((symbolBars) => symbolBars.length > 0).length;

    weekCoverages.push({
      weekOpenUtc,
      symbolCount: symbols.length,
      symbolsWithBars,
      missingBarSymbols,
      totalBars,
      activeLegs: ledger.legs.length,
    });
  }

  const multiWeekPath = computeMultiWeekBasketPath(weeklyPathResults);
  const differencePctPoints = multiWeekPath.summary.totalReturnPct - weeklyClose.totalReturnPct;

  return {
    label: target.label,
    weeklyCloseTotalPct: weeklyClose.totalReturnPct,
    pathTotalPct: multiWeekPath.summary.totalReturnPct,
    differencePctPoints,
    status: Math.abs(differencePctPoints) <= PASS_THRESHOLD_PCT_POINTS ? "PASS" : "FAIL",
    weeklyCloseDdPct: weeklyClose.maxDrawdownPct,
    pathSummary: multiWeekPath.summary,
    weekCoverages,
    weeklyPathResults,
    weeklyCloseWeeks,
  } satisfies StrategyVerification;
}

function buildMarkdown(
  weeks: string[],
  results: StrategyVerification[],
) {
  const firstWeek = weeks[0] ? fmtWeek(weeks[weeks.length - 1] ?? weeks[0]) : "n/a";
  const lastWeek = weeks[0] ? fmtWeek(weeks[0]) : "n/a";
  const lines: string[] = [
    "# Path Engine Verification",
    "",
    "- Resolution: `1h`",
    `- Weeks analyzed: ${weeks.length} (${firstWeek} -> ${lastWeek})`,
    `- Verified on: ${new Date().toISOString()}`,
    "",
    "## Return Comparison",
    "",
    "| Strategy | Weekly-Close Total% | Path-Engine Total% | Difference | Status |",
    "| --- | ---: | ---: | ---: | --- |",
    ...results.map((result) =>
      `| ${result.label} | ${signedPct(result.weeklyCloseTotalPct)} | ${signedPct(result.pathTotalPct)} | ${signedPct(result.differencePctPoints)} | ${result.status} |`,
    ),
    "",
    `PASS = absolute difference <= ${PASS_THRESHOLD_PCT_POINTS.toFixed(2)} percentage points.`,
    "",
    "## New Path Metrics",
    "",
    "| Strategy | Total% | Peak% | Max DD% | Giveback% | Recovery% | Max Active |",
    "| --- | ---: | ---: | ---: | ---: | ---: | ---: |",
    ...results.map((result) =>
      `| ${result.label} | ${signedPct(result.pathSummary.totalReturnPct)} | ${signedPct(result.pathSummary.peakPct)} | ${result.pathSummary.maxDrawdownPct.toFixed(2)}% | ${result.pathSummary.peakToCloseGivebackPct.toFixed(2)}% | ${result.pathSummary.troughToCloseRecoveryPct.toFixed(2)}% | ${result.pathSummary.maxActivePositions} |`,
    ),
    "",
    "## Weekly-Close vs Path DD",
    "",
    "| Strategy | Weekly-Close Max DD% | Path Max DD% | Delta |",
    "| --- | ---: | ---: | ---: |",
    ...results.map((result) =>
      `| ${result.label} | ${result.weeklyCloseDdPct.toFixed(2)}% | ${result.pathSummary.maxDrawdownPct.toFixed(2)}% | ${(result.pathSummary.maxDrawdownPct - result.weeklyCloseDdPct).toFixed(2)}% |`,
    ),
    "",
    "## Data Coverage",
    "",
    "| Strategy | Weeks | Total Legs | Legs With H1 Bars | Missing Bar Symbols |",
    "| --- | ---: | ---: | ---: | --- |",
    ...results.map((result) => {
      const totalLegs = result.weekCoverages.reduce((sum, week) => sum + week.activeLegs, 0);
      const totalWithBars = result.weekCoverages.reduce((sum, week) => sum + week.symbolsWithBars, 0);
      const missingSymbols = Array.from(
        new Set(result.weekCoverages.flatMap((week) => week.missingBarSymbols)),
      );
      return `| ${result.label} | ${result.weekCoverages.length} | ${totalLegs} | ${totalWithBars} | ${missingSymbols.length > 0 ? missingSymbols.join(", ") : "—"} |`;
    }),
    "",
  ];

  const dealer = results.find((result) => result.label === "Dealer Raw");
  if (dealer) {
    lines.push("## Per-Week Path Detail (Dealer Raw)", "");
    lines.push("| Week | Weekly-Close% | Path-Engine% | Peak% | Max DD% | H1 Bars | Active Legs |");
    lines.push("| --- | ---: | ---: | ---: | ---: | ---: | ---: |");
    for (let i = 0; i < dealer.weeklyPathResults.length; i += 1) {
      const pathWeek = dealer.weeklyPathResults[i];
      const coverage = dealer.weekCoverages[i];
      const weeklyCloseWeek = dealer.weeklyCloseWeeks[i];
      if (!pathWeek || !coverage || !weeklyCloseWeek) continue;
      lines.push(
        `| ${fmtWeek(pathWeek.weekOpenUtc)} | ${signedPct(weeklyCloseWeek.totalReturnPct)} | ${signedPct(pathWeek.summary.totalReturnPct)} | ${signedPct(pathWeek.summary.peakPct)} | ${pathWeek.summary.maxDrawdownPct.toFixed(2)}% | ${coverage.totalBars} | ${coverage.activeLegs} |`,
      );
    }
    lines.push("");
  }

  return `${lines.join("\n")}\n`;
}

async function main() {
  const allWeeks = await listDataSectionWeeks();
  const currentWeek = getDisplayWeekOpenUtc();
  const realizedWeeks = allWeeks.filter((week) => week !== currentWeek).slice(0, 10);

  if (realizedWeeks.length === 0) {
    throw new Error("No realized weeks found for verification");
  }

  const results: StrategyVerification[] = [];
  for (const target of TARGETS) {
    results.push(await buildStrategyVerification(target, realizedWeeks));
  }

  const markdown = buildMarkdown(realizedWeeks, results);
  const docsDir = join(process.cwd(), "docs");
  mkdirSync(docsDir, { recursive: true });
  const outputPath = join(docsDir, "PATH_ENGINE_VERIFICATION_2026-04-07.md");
  writeFileSync(outputPath, markdown, "utf8");

  console.log(markdown);

  const failed = results.filter((result) => result.status !== "PASS");
  if (failed.length > 0) {
    throw new Error(`Path engine verification failed for: ${failed.map((result) => result.label).join(", ")}`);
  }
}

main().catch((error) => {
  console.error("[verify-path-engine] Failed:", error instanceof Error ? error.stack ?? error.message : error);
  process.exitCode = 1;
});
