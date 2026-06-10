import { existsSync, writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { listVisibleStrategyBootstrapSelections } from "../src/lib/performance/strategySelection";
import { getBiasSource, getEntryStyle, getRiskOverlay } from "../src/lib/performance/strategyConfig";
import { computeMultiWeekHold, computeWeeklyHold } from "../src/lib/performance/weeklyHoldEngine";
import { getDisplayWeekOpenUtc } from "../src/lib/weekAnchor";
import { listDataSectionWeeks } from "../src/lib/dataSectionWeeks";
import { buildDataWeekOptions } from "../src/lib/weekOptions";
import { buildWeeklyHoldLedger } from "../src/lib/performance/positionLedger";
import { loadPathBars } from "../src/lib/performance/pathBarLoader";
import { computeBasketPath, computeMultiWeekBasketPath, type BasketPathResult } from "../src/lib/performance/basketPathEngine";
import { CANONICAL_PATH_RESOLUTION } from "../src/lib/performance/pathResolution";

function loadEnvFile(path: string) {
  if (!existsSync(path)) return;
  for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    if (process.env[key] != null) continue;
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith("\"") && value.endsWith("\"")) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

loadEnvFile(resolve(process.cwd(), ".env.local"));
loadEnvFile(resolve(process.cwd(), ".env"));

function round(value: number | null | undefined, places = 2) {
  return typeof value === "number" && Number.isFinite(value) ? Number(value.toFixed(places)) : null;
}

function fmt(value: number | null | undefined, places = 2) {
  const rounded = round(value, places);
  if (rounded === null) return "-";
  return `${rounded >= 0 ? "+" : ""}${rounded.toFixed(places)}%`;
}

function fmtPlain(value: number | null | undefined, places = 2) {
  const rounded = round(value, places);
  if (rounded === null) return "-";
  return rounded.toFixed(places);
}

function computeSharpe(weeklyReturns: number[]) {
  if (weeklyReturns.length <= 1) return 0;
  const avg = weeklyReturns.reduce((sum, value) => sum + value, 0) / weeklyReturns.length;
  const variance = weeklyReturns.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (weeklyReturns.length - 1);
  const std = Math.sqrt(variance);
  return std > 0 ? avg / std : 0;
}

function computeProfitFactor(weeklyReturns: number[]) {
  const grossProfit = weeklyReturns.filter((value) => value > 0).reduce((sum, value) => sum + value, 0);
  const grossLoss = Math.abs(weeklyReturns.filter((value) => value < 0).reduce((sum, value) => sum + value, 0));
  if (grossLoss > 0) return grossProfit / grossLoss;
  return grossProfit > 0 ? Number.POSITIVE_INFINITY : null;
}

async function computePath(result: Awaited<ReturnType<typeof computeWeeklyHold>>, returnMode: "normalized" | "raw") {
  const ledger = await buildWeeklyHoldLedger(result, { entryStyleId: result.entryStyleId });
  const bars = await loadPathBars(
    ledger.legs.map((leg) => leg.symbol),
    ledger.weekOpenUtc,
    ledger.weekCloseUtc,
    CANONICAL_PATH_RESOLUTION,
  );
  return computeBasketPath(ledger, bars, { returnMode });
}

async function main() {
  const currentWeekOpenUtc = getDisplayWeekOpenUtc();
  const historicalWeeks = await listDataSectionWeeks();
  const weekOptions = buildDataWeekOptions({ historicalWeeks, currentWeekOpenUtc }) as string[];
  const closedWeekOptions = weekOptions.filter((week) => week !== currentWeekOpenUtc);
  const selections = listVisibleStrategyBootstrapSelections();
  const rows = [];

  for (const selection of selections) {
    const biasSource = getBiasSource(selection.strategyId);
    const entryStyle = getEntryStyle(selection.f1);
    const riskOverlay = getRiskOverlay(selection.f2);
    if (!biasSource || !entryStyle || !riskOverlay) continue;

    const multiWeek = await computeMultiWeekHold(biasSource, closedWeekOptions, entryStyle, riskOverlay);
    const normalizedPaths: BasketPathResult[] = [];
    const rawPaths: BasketPathResult[] = [];
    for (const weekResult of multiWeek.weeks) {
      normalizedPaths.push(await computePath(weekResult, "normalized"));
      rawPaths.push(await computePath(weekResult, "raw"));
    }
    const normalizedMultiPath = computeMultiWeekBasketPath(normalizedPaths);
    const rawMultiPath = computeMultiWeekBasketPath(rawPaths);
    const weeklyReturns = multiWeek.weeks.map((week) => week.totalReturnPct);
    const weeklyWins = multiWeek.weeks.filter((week) => week.totalReturnPct > 0).length;
    const rawWeeklyReturns = multiWeek.weeks.map((week) => week.rawTotalReturnPct ?? week.totalReturnPct);

    rows.push({
      systemId: selection.strategyId,
      system: biasSource.label,
      executionId: `${selection.f1}:${selection.f2}`,
      execution: `${entryStyle.label}${riskOverlay.id === "none" ? "" : ` + ${riskOverlay.label}`}`,
      weeks: multiWeek.weeks.length,
      trades: multiWeek.totalTrades,
      normalizedReturnPct: multiWeek.totalReturnPct,
      normalizedPathDdPct: normalizedMultiPath.summary.maxDrawdownPct,
      rawReturnPct: rawWeeklyReturns.reduce((sum, value) => sum + value, 0),
      rawPathDdPct: rawMultiPath.summary.maxDrawdownPct,
      weeklyWinRatePct: multiWeek.weeks.length > 0 ? (weeklyWins / multiWeek.weeks.length) * 100 : 0,
      sharpe: computeSharpe(weeklyReturns),
      profitFactor: computeProfitFactor(weeklyReturns),
      maxActivePositions: normalizedMultiPath.summary.maxActivePositions,
      finalBalancePct: normalizedMultiPath.points.at(-1)?.balancePct ?? normalizedMultiPath.summary.totalReturnPct,
      finalEquityPct: normalizedMultiPath.points.at(-1)?.equityPct ?? normalizedMultiPath.summary.totalReturnPct,
    });
  }

  const order = ["tandem", "tiered_4w", "agree_3of4", "selector"];
  const executionOrder = ["weekly_hold:none", "adr_grid:pair_fill_cap", "adr_grid:none"];
  rows.sort((a, b) => {
    const systemDelta = order.indexOf(a.systemId) - order.indexOf(b.systemId);
    if (systemDelta !== 0) return systemDelta;
    return executionOrder.indexOf(a.executionId) - executionOrder.indexOf(b.executionId);
  });

  const markdown = [
    `# Corrected Path Metrics`,
    ``,
    `Generated: ${new Date().toISOString()}`,
    `Weeks: ${closedWeekOptions.length} closed weeks (${closedWeekOptions[0]} through ${closedWeekOptions.at(-1)})`,
    ``,
    `| System | Execution | Weeks | Trades | ADR norm P/L | Path DD | Raw P/L | Raw Path DD | Weekly win | Sharpe | PF | Max active |`,
    `|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|`,
    ...rows.map((row) => `| ${row.system} | ${row.execution} | ${row.weeks} | ${row.trades} | ${fmt(row.normalizedReturnPct)} | ${fmtPlain(row.normalizedPathDdPct)}% | ${fmt(row.rawReturnPct)} | ${fmtPlain(row.rawPathDdPct)}% | ${fmtPlain(row.weeklyWinRatePct)}% | ${fmtPlain(row.sharpe)} | ${row.profitFactor === null ? "-" : fmtPlain(row.profitFactor)} | ${row.maxActivePositions} |`),
    ``,
    `Notes: Path DD uses corrected adverse synchronized path DD. Balance/equity are equal at final closed-week endpoints unless a path still has open positions.`,
  ].join("\n");

  mkdirSync(resolve(process.cwd(), "reports"), { recursive: true });
  writeFileSync(resolve(process.cwd(), "reports", "corrected-path-metrics-2026-06-03.md"), markdown);
  console.log(markdown);
  console.log("\nJSON");
  console.log(JSON.stringify(rows.map((row) => ({
    ...row,
    normalizedReturnPct: round(row.normalizedReturnPct, 6),
    normalizedPathDdPct: round(row.normalizedPathDdPct, 6),
    rawReturnPct: round(row.rawReturnPct, 6),
    rawPathDdPct: round(row.rawPathDdPct, 6),
    weeklyWinRatePct: round(row.weeklyWinRatePct, 6),
    sharpe: round(row.sharpe, 6),
    profitFactor: round(row.profitFactor, 6),
    finalBalancePct: round(row.finalBalancePct, 6),
    finalEquityPct: round(row.finalEquityPct, 6),
  })), null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
