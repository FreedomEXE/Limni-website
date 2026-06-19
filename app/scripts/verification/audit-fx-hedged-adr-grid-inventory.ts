/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: audit-fx-hedged-adr-grid-inventory.ts
 *
 * Description:
 * Gate 36 research-only autopsy for a hedged FX ADR Grid receipt.
 * Joins inventory stress, COT Faces, strength, and realised FX rotation.
 * Sentiment is intentionally excluded.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { DateTime } from "luxon";
import { getPool } from "@/lib/db";
import { readCanonicalStrengthDirections, readCanonicalStrengthDirectionsAtCutoff } from "@/lib/strength/canonicalDirection";
import { readWeeklyPairStrengths, readWeeklyPairStrengthsAtCutoff } from "@/lib/strength/weeklyStrength";
import { buildBaseWeek, type SourceRuleId } from "./export-weekly-hold-fixed-band-sweep";

loadEnvConfig(process.cwd());

type Direction = "LONG" | "SHORT";
type SourceDirection = Direction | "NEUTRAL" | "MISSING";
type ExitReason = "grid_tp" | "grid_reset" | "week_close";

type HedgeReceipt = {
  generatedAtUtc?: string;
  scope: {
    gate?: string;
    weekOpenUtc: string;
    weekLabel: string;
    expectedPairs: string[];
    executionWindowOpenUtc: string;
    entryCutoffUtc: string;
    executionWindowCloseUtc: string;
    grid?: {
      spacingAdr?: number;
    };
  };
  summaries: {
    combinedAdr: PathSummary;
    combinedRawPct: PathSummary;
    listedLongAdr: PathSummary;
    listedShortAdr: PathSummary;
    fills: {
      total: number;
      long: number;
      short: number;
      tp: number;
      reset: number;
      weekClose: number;
    };
  };
  pairSummaries: PairSummary[];
  trades: TradeRow[];
  path: PathPoint[];
};

type PathSummary = {
  final: number;
  peak: number;
  trough: number;
  maxDrawdown: number;
  maxDrawdownTimeUtc: string | null;
  maxActiveFills: number;
  maxActiveAdrExposure: number;
};

type PairSummary = {
  symbol: string;
  pairAdrPct: number;
  longFills: number;
  shortFills: number;
  totalFills: number;
  longTp: number;
  shortTp: number;
  totalTp: number;
  longReset: number;
  shortReset: number;
  totalReset: number;
  longWeekClose: number;
  shortWeekClose: number;
  totalWeekClose: number;
  longRawPct: number;
  shortRawPct: number;
  hedgedRawPct: number;
  longAdr: number;
  shortAdr: number;
  hedgedAdr: number;
  maxMaeAdr: number;
};

type TradeRow = {
  symbol: string;
  direction: Direction;
  fillSeq: number;
  levelIndex: number;
  levelSide: "favorable" | "continuation";
  entryTimeUtc: string;
  exitTimeUtc: string;
  exitReason: ExitReason;
  entryPrice: number;
  exitPrice: number;
  tpPrice: number;
  pairAdrPct: number;
  rawReturnPct: number;
  adrReturn: number;
  maeRawPct: number;
  maeAdr: number;
};

type PathPoint = {
  tsUtc: string;
  combinedRawPct: number;
  combinedAdr: number;
  listedLongRawPct: number;
  listedLongAdr: number;
  listedShortRawPct: number;
  listedShortAdr: number;
  activeFills: number;
  activeLongFills: number;
  activeShortFills: number;
  activeAdrExposure: number;
};

type SourceRuleSnapshot = {
  direction: SourceDirection;
  tier: string | null;
  reason: string | null;
};

type StrengthSnapshot = {
  direction: SourceDirection;
  compositeDirection: SourceDirection;
  compositeScore: number | null;
  canonicalDirection: SourceDirection;
  canonicalBranch: string | null;
  availableWindows: number;
  latestSnapshotUtc: string | null;
  windowSummary: string;
};

type PairAutopsyRow = {
  symbol: string;
  base: string;
  quote: string;
  weeklyReturnPct: number | null;
  loserSide: Direction;
  winnerSide: Direction;
  hedgedAdr: number;
  longAdr: number;
  shortAdr: number;
  longWeekCloseAdr: number;
  shortWeekCloseAdr: number;
  weekCloseAdr: number;
  weekCloseFills: number;
  gridBias: "UP_AGAINST_SHORT" | "DOWN_AGAINST_LONG" | "MIXED";
  cotFaces: SourceRuleSnapshot;
  cotFacesCommercialDeltaContrarian: SourceRuleSnapshot;
  strengthOpen: StrengthSnapshot;
  strengthCutoff: StrengthSnapshot;
  cotFacesRead: SourceRead;
  cotFacesCommercialDeltaContrarianRead: SourceRead;
  strengthOpenRead: SourceRead;
  strengthCutoffRead: SourceRead;
};

type SourceRead = "warned" | "fed_loser" | "neutral_or_missing" | "mixed";

type SourceSideSummary = {
  sourceId: string;
  rows: number;
  directionalRows: number;
  selectedAdr: number;
  oppositeAdr: number;
  selectedMinusOppositeAdr: number;
  selectedWeekCloseAdr: number;
  oppositeWeekCloseAdr: number;
  selectedBetterPairs: number;
  oppositeBetterPairs: number;
  neutralOrMissingPairs: number;
  warnedPairs: number;
  fedLoserPairs: number;
};

type InventorySnapshot = {
  label: string;
  tsUtc: string;
  path: PathPoint | null;
  activeFills: number;
  activeLongFills: number;
  activeShortFills: number;
  activeAdrExposure: number;
  eventualAdrReturn: number;
  eventualWeekCloseAdr: number;
  eventualResetAdr: number;
  eventualTpAdr: number;
  averageAgeHours: number | null;
  maxAgeHours: number | null;
  topPairs: Array<{
    symbol: string;
    activeFills: number;
    activeLongFills: number;
    activeShortFills: number;
    eventualAdrReturn: number;
    eventualWeekCloseAdr: number;
    weekCloseFills: number;
    averageAgeHours: number | null;
  }>;
};

type CurrencyFlowRow = {
  currency: string;
  realisedScore: number;
  realisedPairs: number;
  cotFacesVoteScore: number;
  strengthOpenScore: number;
};

function argValue(name: string): string | null {
  const direct = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (direct) return direct.slice(name.length + 3);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

function round(value: number | null | undefined, places = 6) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  const factor = 10 ** places;
  return Math.round(value * factor) / factor;
}

function signed(value: number | null | undefined, places = 2, suffix = "") {
  if (typeof value !== "number" || !Number.isFinite(value)) return "-";
  return `${value >= 0 ? "+" : ""}${value.toFixed(places)}${suffix}`;
}

function csvEscape(value: unknown) {
  if (value === null || value === undefined) return "";
  const text = String(value);
  return /[",\r\n]/.test(text) ? `"${text.replaceAll("\"", "\"\"")}"` : text;
}

function toUtcMs(value: string) {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function hoursBetween(fromUtc: string, toUtc: string) {
  return (toUtcMs(toUtc) - toUtcMs(fromUtc)) / 3_600_000;
}

function pairBaseQuote(symbol: string) {
  const upper = symbol.toUpperCase();
  return { base: upper.slice(0, 3), quote: upper.slice(3, 6) };
}

function normalizeSourceDirection(direction: unknown): SourceDirection {
  if (direction === "LONG" || direction === "SHORT" || direction === "NEUTRAL" || direction === "MISSING") {
    return direction;
  }
  return "MISSING";
}

function sourceRead(direction: SourceDirection, winnerSide: Direction, loserSide: Direction): SourceRead {
  if (direction === winnerSide) return "warned";
  if (direction === loserSide) return "fed_loser";
  if (direction === "LONG" || direction === "SHORT") return "mixed";
  return "neutral_or_missing";
}

function sideAdr(pair: PairSummary, side: Direction) {
  return side === "LONG" ? pair.longAdr : pair.shortAdr;
}

function sideWeekCloseAdr(trades: TradeRow[], symbol: string, side: Direction) {
  return trades
    .filter((trade) => trade.symbol === symbol && trade.direction === side && trade.exitReason === "week_close")
    .reduce((sum, trade) => sum + trade.adrReturn, 0);
}

function nearestPathPoint(pathPoints: PathPoint[], tsUtc: string) {
  if (pathPoints.length === 0) return null;
  const target = toUtcMs(tsUtc);
  return [...pathPoints].sort((left, right) =>
    Math.abs(toUtcMs(left.tsUtc) - target) - Math.abs(toUtcMs(right.tsUtc) - target))[0] ?? null;
}

function maxPathPoint(pathPoints: PathPoint[], field: keyof PathPoint) {
  return [...pathPoints].sort((left, right) => Number(right[field] ?? 0) - Number(left[field] ?? 0))[0] ?? null;
}

function activeTradesAt(trades: TradeRow[], tsUtc: string) {
  const ts = toUtcMs(tsUtc);
  return trades.filter((trade) => toUtcMs(trade.entryTimeUtc) <= ts && toUtcMs(trade.exitTimeUtc) > ts);
}

function inventorySnapshot(options: {
  label: string;
  tsUtc: string;
  trades: TradeRow[];
  pathPoints: PathPoint[];
  gridSpacingAdr: number;
}): InventorySnapshot {
  const pathPoint = nearestPathPoint(options.pathPoints, options.tsUtc);
  const active = activeTradesAt(options.trades, options.tsUtc);
  const bySymbol = new Map<string, TradeRow[]>();
  for (const trade of active) {
    const rows = bySymbol.get(trade.symbol) ?? [];
    rows.push(trade);
    bySymbol.set(trade.symbol, rows);
  }
  const ages = active.map((trade) => hoursBetween(trade.entryTimeUtc, options.tsUtc)).filter((value) => Number.isFinite(value));
  const sumExit = (reason: ExitReason) =>
    active.filter((trade) => trade.exitReason === reason).reduce((sum, trade) => sum + trade.adrReturn, 0);

  return {
    label: options.label,
    tsUtc: pathPoint?.tsUtc ?? options.tsUtc,
    path: pathPoint,
    activeFills: active.length,
    activeLongFills: active.filter((trade) => trade.direction === "LONG").length,
    activeShortFills: active.filter((trade) => trade.direction === "SHORT").length,
    activeAdrExposure: round(active.length * options.gridSpacingAdr, 6) ?? active.length * options.gridSpacingAdr,
    eventualAdrReturn: round(active.reduce((sum, trade) => sum + trade.adrReturn, 0), 6) ?? 0,
    eventualWeekCloseAdr: round(sumExit("week_close"), 6) ?? 0,
    eventualResetAdr: round(sumExit("grid_reset"), 6) ?? 0,
    eventualTpAdr: round(sumExit("grid_tp"), 6) ?? 0,
    averageAgeHours: ages.length > 0 ? round(ages.reduce((sum, value) => sum + value, 0) / ages.length, 2) : null,
    maxAgeHours: ages.length > 0 ? round(Math.max(...ages), 2) : null,
    topPairs: [...bySymbol.entries()]
      .map(([symbol, rows]) => {
        const rowAges = rows
          .map((trade) => hoursBetween(trade.entryTimeUtc, options.tsUtc))
          .filter((value) => Number.isFinite(value));
        return {
          symbol,
          activeFills: rows.length,
          activeLongFills: rows.filter((trade) => trade.direction === "LONG").length,
          activeShortFills: rows.filter((trade) => trade.direction === "SHORT").length,
          eventualAdrReturn: round(rows.reduce((sum, trade) => sum + trade.adrReturn, 0), 6) ?? 0,
          eventualWeekCloseAdr: round(
            rows.filter((trade) => trade.exitReason === "week_close").reduce((sum, trade) => sum + trade.adrReturn, 0),
            6,
          ) ?? 0,
          weekCloseFills: rows.filter((trade) => trade.exitReason === "week_close").length,
          averageAgeHours: rowAges.length > 0 ? round(rowAges.reduce((sum, value) => sum + value, 0) / rowAges.length, 2) : null,
        };
      })
      .sort((left, right) =>
        right.activeFills - left.activeFills || left.eventualAdrReturn - right.eventualAdrReturn)
      .slice(0, 10),
  };
}

function buildStrengthSnapshot(options: {
  compositeDirection: SourceDirection;
  compositeScore: number | null;
  canonicalDirection: SourceDirection;
  canonicalBranch: string | null;
  availableWindows: number;
  latestSnapshotUtc: string | null;
  windows: Array<{ window: string; direction: SourceDirection; signedSpread: number | null; available: boolean }>;
}): StrengthSnapshot {
  return {
    direction: options.canonicalDirection === "LONG" || options.canonicalDirection === "SHORT"
      ? options.canonicalDirection
      : options.compositeDirection,
    compositeDirection: options.compositeDirection,
    compositeScore: options.compositeScore,
    canonicalDirection: options.canonicalDirection,
    canonicalBranch: options.canonicalBranch,
    availableWindows: options.availableWindows,
    latestSnapshotUtc: options.latestSnapshotUtc,
    windowSummary: options.windows
      .map((row) => `${row.window}:${row.available ? row.direction : "missing"}:${row.signedSpread === null ? "-" : signed(row.signedSpread, 1)}`)
      .join("; "),
  };
}

function summarizeSourceSides(rows: PairAutopsyRow[], sourceId: keyof Pick<
  PairAutopsyRow,
  "cotFaces" | "cotFacesCommercialDeltaContrarian" | "strengthOpen" | "strengthCutoff"
>): SourceSideSummary {
  let selectedAdr = 0;
  let oppositeAdr = 0;
  let selectedWeekCloseAdr = 0;
  let oppositeWeekCloseAdr = 0;
  let directionalRows = 0;
  let selectedBetterPairs = 0;
  let oppositeBetterPairs = 0;
  let neutralOrMissingPairs = 0;
  let warnedPairs = 0;
  let fedLoserPairs = 0;

  for (const row of rows) {
    const item = row[sourceId] as SourceRuleSnapshot | StrengthSnapshot;
    const direction = item.direction;
    if (direction !== "LONG" && direction !== "SHORT") {
      neutralOrMissingPairs += 1;
      continue;
    }
    directionalRows += 1;
    const selected = direction === "LONG" ? row.longAdr : row.shortAdr;
    const opposite = direction === "LONG" ? row.shortAdr : row.longAdr;
    selectedAdr += selected;
    oppositeAdr += opposite;
    selectedWeekCloseAdr += direction === "LONG" ? row.longWeekCloseAdr : row.shortWeekCloseAdr;
    oppositeWeekCloseAdr += direction === "LONG" ? row.shortWeekCloseAdr : row.longWeekCloseAdr;
    if (selected > opposite) selectedBetterPairs += 1;
    else if (opposite > selected) oppositeBetterPairs += 1;
    const read = sourceRead(direction, row.winnerSide, row.loserSide);
    if (read === "warned") warnedPairs += 1;
    if (read === "fed_loser") fedLoserPairs += 1;
  }

  return {
    sourceId,
    rows: rows.length,
    directionalRows,
    selectedAdr: round(selectedAdr, 6) ?? 0,
    oppositeAdr: round(oppositeAdr, 6) ?? 0,
    selectedMinusOppositeAdr: round(selectedAdr - oppositeAdr, 6) ?? 0,
    selectedWeekCloseAdr: round(selectedWeekCloseAdr, 6) ?? 0,
    oppositeWeekCloseAdr: round(oppositeWeekCloseAdr, 6) ?? 0,
    selectedBetterPairs,
    oppositeBetterPairs,
    neutralOrMissingPairs,
    warnedPairs,
    fedLoserPairs,
  };
}

function addCurrencyVote(scores: Map<string, CurrencyFlowRow>, currency: string, field: "cotFacesVoteScore" | "strengthOpenScore", value: number) {
  const row = scores.get(currency) ?? {
    currency,
    realisedScore: 0,
    realisedPairs: 0,
    cotFacesVoteScore: 0,
    strengthOpenScore: 0,
  };
  row[field] += value;
  scores.set(currency, row);
}

function buildCurrencyFlow(rows: PairAutopsyRow[]): CurrencyFlowRow[] {
  const scores = new Map<string, CurrencyFlowRow>();
  for (const row of rows) {
    for (const currency of [row.base, row.quote]) {
      if (!scores.has(currency)) {
        scores.set(currency, {
          currency,
          realisedScore: 0,
          realisedPairs: 0,
          cotFacesVoteScore: 0,
          strengthOpenScore: 0,
        });
      }
    }
    const score = scores.get(row.base)!;
    if (row.weeklyReturnPct !== null) {
      score.realisedScore += row.weeklyReturnPct;
      score.realisedPairs += 1;
      const quoteScore = scores.get(row.quote)!;
      quoteScore.realisedScore -= row.weeklyReturnPct;
      quoteScore.realisedPairs += 1;
    }

    if (row.cotFaces.direction === "LONG") {
      addCurrencyVote(scores, row.base, "cotFacesVoteScore", 1);
      addCurrencyVote(scores, row.quote, "cotFacesVoteScore", -1);
    } else if (row.cotFaces.direction === "SHORT") {
      addCurrencyVote(scores, row.base, "cotFacesVoteScore", -1);
      addCurrencyVote(scores, row.quote, "cotFacesVoteScore", 1);
    }

    if (row.strengthOpen.direction === "LONG") {
      addCurrencyVote(scores, row.base, "strengthOpenScore", 1);
      addCurrencyVote(scores, row.quote, "strengthOpenScore", -1);
    } else if (row.strengthOpen.direction === "SHORT") {
      addCurrencyVote(scores, row.base, "strengthOpenScore", -1);
      addCurrencyVote(scores, row.quote, "strengthOpenScore", 1);
    }
  }

  return [...scores.values()]
    .map((row) => ({
      ...row,
      realisedScore: round(row.realisedScore, 6) ?? 0,
    }))
    .sort((left, right) => right.realisedScore - left.realisedScore);
}

function riskProxy(currencyFlow: CurrencyFlowRow[]) {
  const byCurrency = new Map(currencyFlow.map((row) => [row.currency, row]));
  const avg = (currencies: string[], field: keyof Pick<CurrencyFlowRow, "realisedScore" | "cotFacesVoteScore" | "strengthOpenScore">) => {
    const rows = currencies.map((currency) => byCurrency.get(currency)).filter((row): row is CurrencyFlowRow => Boolean(row));
    if (rows.length === 0) return null;
    return round(rows.reduce((sum, row) => sum + Number(row[field] ?? 0), 0) / rows.length, 6);
  };
  const riskCurrencies = ["AUD", "NZD", "CAD"];
  const havenCurrencies = ["USD", "JPY", "CHF"];
  const realisedRisk = avg(riskCurrencies, "realisedScore");
  const realisedHaven = avg(havenCurrencies, "realisedScore");
  const cotRisk = avg(riskCurrencies, "cotFacesVoteScore");
  const cotHaven = avg(havenCurrencies, "cotFacesVoteScore");
  const strengthRisk = avg(riskCurrencies, "strengthOpenScore");
  const strengthHaven = avg(havenCurrencies, "strengthOpenScore");
  return {
    note: "FX-relative proxy: AUD/NZD/CAD average minus USD/JPY/CHF average. It is not aggregate FX inflow.",
    realisedRiskSensitiveAverage: realisedRisk,
    realisedHavenAverage: realisedHaven,
    realisedRiskMinusHaven: realisedRisk !== null && realisedHaven !== null ? round(realisedRisk - realisedHaven, 6) : null,
    cotFacesRiskMinusHaven: cotRisk !== null && cotHaven !== null ? round(cotRisk - cotHaven, 6) : null,
    strengthOpenRiskMinusHaven: strengthRisk !== null && strengthHaven !== null ? round(strengthRisk - strengthHaven, 6) : null,
  };
}

function rowsToCsv(rows: PairAutopsyRow[]) {
  const columns: Array<keyof PairAutopsyRow | string> = [
    "symbol",
    "weeklyReturnPct",
    "loserSide",
    "winnerSide",
    "hedgedAdr",
    "longAdr",
    "shortAdr",
    "weekCloseAdr",
    "weekCloseFills",
    "cotFacesDirection",
    "cotFacesRead",
    "cotFacesCommercialDeltaContrarianDirection",
    "cotFacesCommercialDeltaContrarianRead",
    "strengthOpenDirection",
    "strengthOpenRead",
    "strengthCutoffDirection",
    "strengthCutoffRead",
  ];
  return [
    columns.join(","),
    ...rows.map((row) => columns.map((column) => {
      if (column === "cotFacesDirection") return csvEscape(row.cotFaces.direction);
      if (column === "cotFacesCommercialDeltaContrarianDirection") return csvEscape(row.cotFacesCommercialDeltaContrarian.direction);
      if (column === "strengthOpenDirection") return csvEscape(row.strengthOpen.direction);
      if (column === "strengthCutoffDirection") return csvEscape(row.strengthCutoff.direction);
      return csvEscape(row[column as keyof PairAutopsyRow]);
    }).join(",")),
  ].join("\n");
}

function buildMarkdown(options: {
  generatedAtUtc: string;
  receiptPath: string;
  receipt: HedgeReceipt;
  sourceSummaries: SourceSideSummary[];
  inventorySnapshots: InventorySnapshot[];
  rows: PairAutopsyRow[];
  currencyFlow: CurrencyFlowRow[];
  riskProxy: ReturnType<typeof riskProxy>;
  jsonPath: string;
  csvPath: string;
}) {
  const receipt = options.receipt;
  const worstRows = [...options.rows].sort((left, right) => left.hedgedAdr - right.hedgedAdr).slice(0, 12);
  const worstWeekClose = [...options.rows].sort((left, right) => left.weekCloseAdr - right.weekCloseAdr).slice(0, 12);
  const topCurrency = options.currencyFlow.slice(0, 4);
  const bottomCurrency = [...options.currencyFlow].slice(-4).reverse();
  const lines = [
    "# Gate 36 FX Hedged ADR Grid Inventory Autopsy",
    "",
    `Generated: ${options.generatedAtUtc}`,
    "",
    "## Scope",
    "",
    `- Source receipt: ${options.receiptPath}`,
    `- Displayed week: ${receipt.scope.weekLabel}`,
    `- Logical week open: ${receipt.scope.weekOpenUtc}`,
    `- Entry cutoff: ${receipt.scope.entryCutoffUtc}`,
    "- Purpose: inventory, COT Faces, strength, and realised currency-flow diagnostics only.",
    "- Sentiment: excluded because the stored sample is too short for this gate.",
    "- Caveat: realised currency flow is ex-post path context, not a pre-entry signal.",
    "",
    "## Basket Stress",
    "",
    `- Combined ADR final/DD: ${signed(receipt.summaries.combinedAdr.final, 4)} / ${signed(receipt.summaries.combinedAdr.maxDrawdown, 4)} at ${receipt.summaries.combinedAdr.maxDrawdownTimeUtc ?? "-"}`,
    `- Fills TP/reset/week-close: ${receipt.summaries.fills.tp}/${receipt.summaries.fills.reset}/${receipt.summaries.fills.weekClose}`,
    `- LONG/SHORT ADR final: ${signed(receipt.summaries.listedLongAdr.final, 4)} / ${signed(receipt.summaries.listedShortAdr.final, 4)}`,
    `- Max active fills/exposure: ${receipt.summaries.combinedAdr.maxActiveFills} / ${signed(receipt.summaries.combinedAdr.maxActiveAdrExposure, 2)} ADR-fill units`,
    "",
    "## Selected Side Versus Opposite Side",
    "",
    "| Source | Directional Pairs | Selected ADR | Opposite ADR | Edge | Selected WC ADR | Opposite WC ADR | Selected Better | Opp Better | Warned | Fed Loser | Neutral/Missing |",
    "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ...options.sourceSummaries.map((row) =>
      `| ${row.sourceId} | ${row.directionalRows}/${row.rows} | ${signed(row.selectedAdr, 2)} | ${signed(row.oppositeAdr, 2)} | ${signed(row.selectedMinusOppositeAdr, 2)} | ${signed(row.selectedWeekCloseAdr, 2)} | ${signed(row.oppositeWeekCloseAdr, 2)} | ${row.selectedBetterPairs} | ${row.oppositeBetterPairs} | ${row.warnedPairs} | ${row.fedLoserPairs} | ${row.neutralOrMissingPairs} |`),
    "",
    "## Inventory Snapshots",
    "",
    "| Label | Time | Marked ADR | Active | Long | Short | Exposure | Future ADR Of Active | Future Week-Close ADR | Avg Age H | Max Age H |",
    "|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|",
    ...options.inventorySnapshots.map((row) =>
      `| ${row.label} | ${row.tsUtc} | ${signed(row.path?.combinedAdr, 2)} | ${row.activeFills} | ${row.activeLongFills} | ${row.activeShortFills} | ${signed(row.activeAdrExposure, 2)} | ${signed(row.eventualAdrReturn, 2)} | ${signed(row.eventualWeekCloseAdr, 2)} | ${row.averageAgeHours ?? "-"} | ${row.maxAgeHours ?? "-"} |`),
    "",
    "## Worst Hedged Pairs",
    "",
    "| Pair | Weekly % | Grid Bias | Hedged ADR | Long ADR | Short ADR | WC ADR | COT Faces | COT Read | Strength Open | Strength Read | Strength Cutoff |",
    "|---|---:|---|---:|---:|---:|---:|---|---|---|---|---|",
    ...worstRows.map((row) =>
      `| ${row.symbol} | ${signed(row.weeklyReturnPct, 3, "%")} | ${row.gridBias} | ${signed(row.hedgedAdr, 2)} | ${signed(row.longAdr, 2)} | ${signed(row.shortAdr, 2)} | ${signed(row.weekCloseAdr, 2)} | ${row.cotFaces.direction} | ${row.cotFacesRead} | ${row.strengthOpen.direction} | ${row.strengthOpenRead} | ${row.strengthCutoff.direction} |`),
    "",
    "## Worst Week-Close Inventory",
    "",
    "| Pair | WC Fills | WC ADR | Winner | Loser | COT Faces | Strength Open | Strength Cutoff |",
    "|---|---:|---:|---|---|---|---|---|",
    ...worstWeekClose.map((row) =>
      `| ${row.symbol} | ${row.weekCloseFills} | ${signed(row.weekCloseAdr, 2)} | ${row.winnerSide} | ${row.loserSide} | ${row.cotFaces.direction} (${row.cotFacesRead}) | ${row.strengthOpen.direction} (${row.strengthOpenRead}) | ${row.strengthCutoff.direction} (${row.strengthCutoffRead}) |`),
    "",
    "## Realised FX Rotation",
    "",
    "| Currency | Realised Score | COT Faces Vote | Strength Open Vote |",
    "|---|---:|---:|---:|",
    ...[...topCurrency, ...bottomCurrency].map((row) =>
      `| ${row.currency} | ${signed(row.realisedScore, 3)} | ${signed(row.cotFacesVoteScore, 0)} | ${signed(row.strengthOpenScore, 0)} |`),
    "",
    "## Risk Proxy",
    "",
    `- ${options.riskProxy.note}`,
    `- Realised risk-sensitive minus haven: ${signed(options.riskProxy.realisedRiskMinusHaven, 3)}`,
    `- COT Faces risk-sensitive minus haven vote: ${signed(options.riskProxy.cotFacesRiskMinusHaven, 3)}`,
    `- Strength-open risk-sensitive minus haven vote: ${signed(options.riskProxy.strengthOpenRiskMinusHaven, 3)}`,
    "",
    "## Files",
    "",
    `- JSON: ${options.jsonPath}`,
    `- CSV: ${options.csvPath}`,
    "",
  ];
  return lines.join("\n");
}

async function main() {
  const receiptPathArg = argValue("receipt");
  if (!receiptPathArg) throw new Error("--receipt is required.");
  const receiptPath = path.resolve(process.cwd(), receiptPathArg);
  const outDir = path.resolve(
    process.cwd(),
    argValue("out-dir") ?? "app/reports/data-verification/fx-hedged-adr-grid-inventory",
  );
  const receipt = JSON.parse(await readFile(receiptPath, "utf8")) as HedgeReceipt;
  const weekOpenUtc = receipt.scope.weekOpenUtc;
  const expectedPairs = receipt.scope.expectedPairs.map((pair) => pair.toUpperCase());
  const sourceRuleIds: SourceRuleId[] = ["cot_faces_v1_forced", "cot_faces_v1_commercial_delta_contrarian"];
  const baseWeek = await buildBaseWeek({
    weekOpenUtc,
    assetClass: "fx",
    expectedPairs,
    sourceRuleIds,
  });
  const [strengthOpenRows, strengthCutoffRows, canonicalOpenRows, canonicalCutoffRows] = await Promise.all([
    readWeeklyPairStrengths(weekOpenUtc),
    readWeeklyPairStrengthsAtCutoff(receipt.scope.entryCutoffUtc),
    readCanonicalStrengthDirections(weekOpenUtc),
    readCanonicalStrengthDirectionsAtCutoff(weekOpenUtc, receipt.scope.entryCutoffUtc),
  ]);

  const baseBySymbol = new Map(baseWeek.rows.map((row) => [row.symbol.toUpperCase(), row]));
  const strengthOpenBySymbol = new Map(strengthOpenRows.map((row) => [row.pair.toUpperCase(), row]));
  const strengthCutoffBySymbol = new Map(strengthCutoffRows.map((row) => [row.pair.toUpperCase(), row]));
  const canonicalOpenBySymbol = new Map(canonicalOpenRows.map((row) => [row.pair.toUpperCase(), row]));
  const canonicalCutoffBySymbol = new Map(canonicalCutoffRows.map((row) => [row.pair.toUpperCase(), row]));

  const rows: PairAutopsyRow[] = receipt.pairSummaries.map((pair) => {
    const symbol = pair.symbol.toUpperCase();
    const { base, quote } = pairBaseQuote(symbol);
    const baseRow = baseBySymbol.get(symbol);
    const weeklyReturnPct = baseRow?.entryPrice && baseRow.weekClosePrice
      ? round(((baseRow.weekClosePrice - baseRow.entryPrice) / baseRow.entryPrice) * 100, 6)
      : null;
    const loserSide: Direction = pair.longAdr <= pair.shortAdr ? "LONG" : "SHORT";
    const winnerSide: Direction = loserSide === "LONG" ? "SHORT" : "LONG";
    const cotFaces = baseRow?.sourceRuleDecisions.cot_faces_v1_forced;
    const cotFacesCommercial = baseRow?.sourceRuleDecisions.cot_faces_v1_commercial_delta_contrarian;
    const strengthOpen = strengthOpenBySymbol.get(symbol);
    const strengthCutoff = strengthCutoffBySymbol.get(symbol);
    const canonicalOpen = canonicalOpenBySymbol.get(symbol);
    const canonicalCutoff = canonicalCutoffBySymbol.get(symbol);
    const longWeekCloseAdr = sideWeekCloseAdr(receipt.trades, symbol, "LONG");
    const shortWeekCloseAdr = sideWeekCloseAdr(receipt.trades, symbol, "SHORT");
    const cotSnapshot: SourceRuleSnapshot = {
      direction: normalizeSourceDirection(cotFaces?.direction),
      tier: cotFaces?.tier ?? null,
      reason: cotFaces?.reason ?? null,
    };
    const cotCommercialSnapshot: SourceRuleSnapshot = {
      direction: normalizeSourceDirection(cotFacesCommercial?.direction),
      tier: cotFacesCommercial?.tier ?? null,
      reason: cotFacesCommercial?.reason ?? null,
    };
    const openStrengthSnapshot = buildStrengthSnapshot({
      compositeDirection: normalizeSourceDirection(strengthOpen?.compositeDirection),
      compositeScore: strengthOpen?.compositeScore ?? null,
      canonicalDirection: normalizeSourceDirection(canonicalOpen?.direction),
      canonicalBranch: canonicalOpen?.fallbackBranch ?? null,
      availableWindows: strengthOpen?.availableWindows ?? 0,
      latestSnapshotUtc: strengthOpen?.latestSnapshotUtc ?? canonicalOpen?.latestSnapshotUtc ?? null,
      windows: (strengthOpen?.windows ?? []).map((windowRow) => ({
        window: windowRow.window,
        direction: normalizeSourceDirection(windowRow.direction),
        signedSpread: windowRow.signedSpread,
        available: windowRow.available,
      })),
    });
    const cutoffStrengthSnapshot = buildStrengthSnapshot({
      compositeDirection: normalizeSourceDirection(strengthCutoff?.compositeDirection),
      compositeScore: strengthCutoff?.compositeScore ?? null,
      canonicalDirection: normalizeSourceDirection(canonicalCutoff?.direction),
      canonicalBranch: canonicalCutoff?.fallbackBranch ?? null,
      availableWindows: strengthCutoff?.availableWindows ?? 0,
      latestSnapshotUtc: strengthCutoff?.latestSnapshotUtc ?? canonicalCutoff?.latestSnapshotUtc ?? null,
      windows: (strengthCutoff?.windows ?? []).map((windowRow) => ({
        window: windowRow.window,
        direction: normalizeSourceDirection(windowRow.direction),
        signedSpread: windowRow.signedSpread,
        available: windowRow.available,
      })),
    });

    return {
      symbol,
      base,
      quote,
      weeklyReturnPct,
      loserSide,
      winnerSide,
      hedgedAdr: pair.hedgedAdr,
      longAdr: pair.longAdr,
      shortAdr: pair.shortAdr,
      longWeekCloseAdr: round(longWeekCloseAdr, 6) ?? 0,
      shortWeekCloseAdr: round(shortWeekCloseAdr, 6) ?? 0,
      weekCloseAdr: round(longWeekCloseAdr + shortWeekCloseAdr, 6) ?? 0,
      weekCloseFills: pair.totalWeekClose,
      gridBias: pair.shortAdr < pair.longAdr
        ? "UP_AGAINST_SHORT"
        : pair.longAdr < pair.shortAdr
          ? "DOWN_AGAINST_LONG"
          : "MIXED",
      cotFaces: cotSnapshot,
      cotFacesCommercialDeltaContrarian: cotCommercialSnapshot,
      strengthOpen: openStrengthSnapshot,
      strengthCutoff: cutoffStrengthSnapshot,
      cotFacesRead: sourceRead(cotSnapshot.direction, winnerSide, loserSide),
      cotFacesCommercialDeltaContrarianRead: sourceRead(cotCommercialSnapshot.direction, winnerSide, loserSide),
      strengthOpenRead: sourceRead(openStrengthSnapshot.direction, winnerSide, loserSide),
      strengthCutoffRead: sourceRead(cutoffStrengthSnapshot.direction, winnerSide, loserSide),
    };
  }).sort((left, right) => left.hedgedAdr - right.hedgedAdr);

  const maxActive = maxPathPoint(receipt.path, "activeFills");
  const maxExposure = maxPathPoint(receipt.path, "activeAdrExposure");
  const stressTimesRaw = [
    { label: "combined_max_dd", tsUtc: receipt.summaries.combinedAdr.maxDrawdownTimeUtc },
    { label: "short_side_max_dd", tsUtc: receipt.summaries.listedShortAdr.maxDrawdownTimeUtc },
    { label: "long_side_max_dd", tsUtc: receipt.summaries.listedLongAdr.maxDrawdownTimeUtc },
    { label: "max_active_fills", tsUtc: maxActive?.tsUtc ?? null },
    { label: "max_active_exposure", tsUtc: maxExposure?.tsUtc ?? null },
    { label: "entry_cutoff", tsUtc: receipt.scope.entryCutoffUtc },
  ].filter((item): item is { label: string; tsUtc: string } => Boolean(item.tsUtc));
  const stressTimes = [...stressTimesRaw.reduce((map, item) => {
    const current = map.get(item.tsUtc);
    map.set(item.tsUtc, current ? { ...current, label: `${current.label}+${item.label}` } : item);
    return map;
  }, new Map<string, { label: string; tsUtc: string }>()).values()];
  const inventorySnapshots = stressTimes
    .map((item) => inventorySnapshot({
      label: item.label,
      tsUtc: item.tsUtc,
      trades: receipt.trades,
      pathPoints: receipt.path,
      gridSpacingAdr: receipt.scope.grid?.spacingAdr ?? 0.2,
    }))
    .filter((snapshot) => snapshot.activeFills > 0);

  const sourceSummaries = [
    summarizeSourceSides(rows, "cotFaces"),
    summarizeSourceSides(rows, "cotFacesCommercialDeltaContrarian"),
    summarizeSourceSides(rows, "strengthOpen"),
    summarizeSourceSides(rows, "strengthCutoff"),
  ];
  const currencyFlow = buildCurrencyFlow(rows);
  const risk = riskProxy(currencyFlow);
  const generatedAtUtc = DateTime.utc().toISO() ?? new Date().toISOString();
  const stamp = DateTime.utc().toFormat("yyyyLLdd-HHmmss");
  const fileStem = `fx-28pair-hedged-adr-grid-inventory-autopsy-${receipt.scope.weekLabel}-${stamp}`;
  await mkdir(outDir, { recursive: true });
  const jsonPath = path.join(outDir, `${fileStem}.json`);
  const csvPath = path.join(outDir, `${fileStem}.csv`);
  const mdPath = path.join(outDir, `${fileStem}.md`);
  const autopsy = {
    schemaVersion: 1,
    generatedAtUtc,
    scope: {
      gate: "Gate 36 fx-basket-pressure-probe",
      sourceReceiptPath: receiptPath,
      weekOpenUtc: receipt.scope.weekOpenUtc,
      weekLabel: receipt.scope.weekLabel,
      expectedPairs,
      diagnostic: "hedged_adr_grid_inventory_cot_strength_realised_fx_rotation",
      sentimentExcluded: true,
    },
    basketStress: receipt.summaries,
    sourceSummaries,
    inventorySnapshots,
    currencyFlow,
    riskProxy: risk,
    rows,
  };

  await writeFile(jsonPath, `${JSON.stringify(autopsy, null, 2)}\n`, "utf8");
  await writeFile(csvPath, `${rowsToCsv(rows)}\n`, "utf8");
  await writeFile(mdPath, buildMarkdown({
    generatedAtUtc,
    receiptPath,
    receipt,
    sourceSummaries,
    inventorySnapshots,
    rows,
    currencyFlow,
    riskProxy: risk,
    jsonPath,
    csvPath,
  }), "utf8");

  console.log(`Hedged ADR Grid inventory autopsy: ${receipt.scope.weekLabel}`);
  console.log(`Receipt: ${receiptPath}`);
  for (const summary of sourceSummaries) {
    console.log(`${summary.sourceId}: selected ${signed(summary.selectedAdr, 2)} vs opposite ${signed(summary.oppositeAdr, 2)} | edge ${signed(summary.selectedMinusOppositeAdr, 2)}`);
  }
  console.log(`Risk proxy realised risk-haven: ${signed(risk.realisedRiskMinusHaven, 3)}`);
  console.log(`JSON: ${jsonPath}`);
  console.log(`Markdown: ${mdPath}`);
  await getPool().end();
}

main().catch(async (error) => {
  console.error(error);
  await getPool().end().catch(() => undefined);
  process.exit(1);
});
