import { mkdir, writeFile } from "node:fs/promises";
import { loadEnvConfig } from "@next/env";
import { computeMultiWeekBasketPath, type BasketPathResult } from "@/lib/performance/basketPathEngine";
import { weeklyHoldToSidebarStatsWithPath } from "@/lib/performance/engineAdapter";
import { buildWeeklyHoldLedger } from "@/lib/performance/positionLedger";
import { loadPathBars } from "@/lib/performance/pathBarLoader";
import { CANONICAL_PATH_RESOLUTION } from "@/lib/performance/pathResolution";
import { computeMultiWeekHold, computeWeeklyHold, type WeeklyHoldResult } from "@/lib/performance/weeklyHoldEngine";
import { getBiasSource, getEntryStyle, getRiskOverlay, STRATEGIES } from "@/lib/performance/strategyConfig";
import { listVisibleStrategyBootstrapSelections } from "@/lib/performance/strategySelection";
import { listDataSectionWeeks } from "@/lib/dataSectionWeeks";
import { buildDataWeekOptions } from "@/lib/weekOptions";
import { getDisplayWeekOpenUtc } from "@/lib/weekAnchor";

loadEnvConfig(process.cwd());

function round(value: number | null | undefined, places = 6) {
  return typeof value === "number" && Number.isFinite(value)
    ? Number(value.toFixed(places))
    : null;
}

function formatPct(value: number | null | undefined) {
  const rounded = round(value, 2);
  if (rounded === null) return "-";
  return `${rounded >= 0 ? "+" : ""}${rounded.toFixed(2)}%`;
}

function formatDd(value: number | null | undefined) {
  const rounded = round(value, 2);
  if (rounded === null) return "-";
  return `${rounded.toFixed(2)}%`;
}

function formatRate(value: number | null | undefined) {
  const rounded = round(value, 1);
  if (rounded === null) return "-";
  return `${rounded.toFixed(1)}%`;
}

async function computePath(result: WeeklyHoldResult): Promise<BasketPathResult> {
  const ledger = await buildWeeklyHoldLedger(result);
  const bars = await loadPathBars(
    ledger.legs.map((leg) => leg.symbol),
    ledger.weekOpenUtc,
    ledger.weekCloseUtc,
    CANONICAL_PATH_RESOLUTION,
  );
  const { computeBasketPath } = await import("@/lib/performance/basketPathEngine");
  return computeBasketPath(ledger, bars);
}

async function main() {
  const currentWeekOpenUtc = getDisplayWeekOpenUtc();
  const dataSectionWeeks = await listDataSectionWeeks();
  const weekOptions = buildDataWeekOptions({
    historicalWeeks: dataSectionWeeks,
    currentWeekOpenUtc,
  }) as string[];

  const rows = [];
  for (const selection of listVisibleStrategyBootstrapSelections()) {
    const biasSource = getBiasSource(selection.strategyId);
    const entryStyle = getEntryStyle(selection.f1);
    const riskOverlay = getRiskOverlay(selection.f2);
    if (!biasSource || !entryStyle || !riskOverlay) continue;

    const currentWeek = await computeWeeklyHold(biasSource, currentWeekOpenUtc, entryStyle, riskOverlay);
    const multiWeek = await computeMultiWeekHold(biasSource, weekOptions, entryStyle, riskOverlay);
    const realizedPaths = [];
    for (const weekResult of multiWeek.weeks) {
      if (!weekResult.isRealized) continue;
      realizedPaths.push(await computePath(weekResult));
    }
    const currentPath = await computePath(currentWeek);
    const multiWeekPathSummary = realizedPaths.length > 0
      ? computeMultiWeekBasketPath(realizedPaths).summary
      : null;
    const stats = weeklyHoldToSidebarStatsWithPath(currentWeek, biasSource, {
      multiWeek,
      currentWeekPathSummary: currentPath.summary,
      multiWeekPathSummary,
    });
    const strategy = STRATEGIES.find((item) => item.id === selection.strategyId);

    rows.push({
      strategyId: selection.strategyId,
      strategyLabel: strategy?.label ?? selection.strategyId,
      entryStyleId: selection.f1,
      riskOverlayId: selection.f2,
      label: `${strategy?.label ?? selection.strategyId} / ${entryStyle.label}${riskOverlay.id === "none" ? "" : ` / ${riskOverlay.label}`}`,
      weeks: stats.allTime?.weeks ?? multiWeek.weeks.length,
      returnPct: round(stats.allTime?.totalReturnPct),
      maxDrawdownPct: round(stats.allTime?.maxDrawdownPct),
      weeklyWinRatePct: round(stats.allTime?.weeklyWinRate),
      trades: stats.allTime?.totalTrades ?? multiWeek.totalTrades,
    });
  }

  const generatedAt = new Date().toISOString();
  const outDir = "reports/data-verification/app";
  await mkdir(outDir, { recursive: true });
  const jsonPath = `${outDir}/visible-engine-stats-2026-06-04.json`;
  const mdPath = `${outDir}/visible-engine-stats-2026-06-04.md`;
  await writeFile(jsonPath, JSON.stringify({ generatedAt, currentWeekOpenUtc, weekOptions, rows }, null, 2));
  await writeFile(mdPath, [
    "# Visible Engine Stats Snapshot - 2026-06-04",
    "",
    `Generated: ${generatedAt}`,
    `Current week: ${currentWeekOpenUtc}`,
    `Weeks in scope: ${weekOptions.length}`,
    "",
    "| Configuration | Return | Max DD | Weekly Win Rate | Weeks | Trades |",
    "|---|---:|---:|---:|---:|---:|",
    ...rows.map((row) => [
      row.label,
      formatPct(row.returnPct),
      formatDd(row.maxDrawdownPct),
      formatRate(row.weeklyWinRatePct),
      String(row.weeks),
      String(row.trades),
    ].join(" | ").replace(/^/, "| ").replace(/$/, " |")),
    "",
  ].join("\n"));

  console.log(JSON.stringify({ generatedAt, currentWeekOpenUtc, weekCount: weekOptions.length, rows }, null, 2));
  console.log(`Wrote ${jsonPath}`);
  console.log(`Wrote ${mdPath}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
