/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: research-cot-commercial-direction.ts
 *
 * Description:
 * Research whether commercial FX directions can be improved beyond
 * forced-raw pair direction.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { writeFileSync } from "node:fs";
import { DateTime } from "luxon";
import { deriveCotReportDate, listDataSectionWeeks } from "../src/lib/dataSectionWeeks";
import { PAIRS_BY_ASSET_CLASS } from "../src/lib/cotPairs";
import { listSnapshotDates, readSnapshot, readSnapshotHistory } from "../src/lib/cotStore";
import { getAdrPct, getTargetAdrPct, loadWeeklyAdrMap } from "../src/lib/performance/adrLookup";
import { getWeeklyPairReturns } from "../src/lib/pairReturns";
import { getDisplayWeekOpenUtc, normalizeWeekOpenUtc } from "../src/lib/weekAnchor";

const OUTPUT_PATH = "docs/COT_COMMERCIAL_DIRECTION_RESEARCH_2026-04-04.md";
const FX_ASSET = "fx" as const;

type Direction = "LONG" | "SHORT";

type PairRow = {
  weekOpenUtc: string;
  weekLabel: string;
  pair: string;
  rawReturnPct: number;
  adrMultiplier: number;
  forcedRaw: Direction | null;
  deltaBased: Direction | null;
  oiNormalized: Direction | null;
  change4w: Direction | null;
  noncomm: Direction | null;
  deltaPersistenceDir: Direction | null;
  netDiffAbs: number | null;
};

type Stats = {
  label: string;
  pairs: number;
  totalReturnPct: number;
  maxDdPct: number;
  winRatePct: number;
  avgReturnPct: number;
  vsBaselinePct?: number | null;
};

type WeekAgg = {
  ret: number;
  trades: number;
  wins: number;
};

function weekLabel(weekOpenUtc: string) {
  return DateTime.fromISO(weekOpenUtc, { zone: "utc" }).toFormat("MMM dd");
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function signedPercent(value: number, digits = 2) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

function directionFromScore(score: number | null | undefined): Direction | null {
  if (typeof score !== "number" || !Number.isFinite(score) || score === 0) {
    return null;
  }
  return score > 0 ? "LONG" : "SHORT";
}

function computeMaxDd(weeklyReturns: number[]) {
  let cumulative = 0;
  let peak = 0;
  let maxDd = 0;
  for (const ret of weeklyReturns) {
    cumulative += ret;
    if (cumulative > peak) {
      peak = cumulative;
    }
    maxDd = Math.max(maxDd, peak - cumulative);
  }
  return round(maxDd);
}

function buildStats(
  rows: PairRow[],
  predicate: (row: PairRow) => boolean,
  directionGetter: (row: PairRow) => Direction | null,
  label: string,
  baseline?: Stats,
) {
  const byWeek = new Map<string, WeekAgg>();
  for (const row of rows) {
    if (!predicate(row)) {
      continue;
    }
    const direction = directionGetter(row);
    if (!direction) {
      continue;
    }
    const ret = (direction === "SHORT" ? -row.rawReturnPct : row.rawReturnPct) * row.adrMultiplier;
    const week = byWeek.get(row.weekOpenUtc) ?? { ret: 0, trades: 0, wins: 0 };
    week.ret += ret;
    week.trades += 1;
    if (ret > 0) {
      week.wins += 1;
    }
    byWeek.set(row.weekOpenUtc, week);
  }

  const weeklyReturns = [...byWeek.entries()]
    .sort((left, right) => left[0].localeCompare(right[0]))
    .map(([, value]) => value.ret);
  const pairs = [...byWeek.values()].reduce((sum, row) => sum + row.trades, 0);
  const wins = [...byWeek.values()].reduce((sum, row) => sum + row.wins, 0);
  const total = round(weeklyReturns.reduce((sum, value) => sum + value, 0));

  return {
    label,
    pairs,
    totalReturnPct: total,
    maxDdPct: computeMaxDd(weeklyReturns),
    winRatePct: pairs > 0 ? round((wins / pairs) * 100, 1) : 0,
    avgReturnPct: pairs > 0 ? round(total / pairs, 3) : 0,
    vsBaselinePct: baseline ? round(total - baseline.totalReturnPct) : null,
  } satisfies Stats;
}

function assertBaseline(actual: Stats) {
  if (
    actual.pairs !== 280 ||
    Math.abs(actual.totalReturnPct - 23.41) > 0.05 ||
    Math.abs(actual.maxDdPct - 18.52) > 0.1 ||
    Math.abs(actual.winRatePct - 52.9) > 0.2
  ) {
    throw new Error(
      `Commercial baseline mismatch. Expected 280 / 23.41 / 18.52 / 52.9, got ${actual.pairs} / ${actual.totalReturnPct.toFixed(2)} / ${actual.maxDdPct.toFixed(2)} / ${actual.winRatePct.toFixed(1)}`,
    );
  }
}

function percentile(values: number[], pct: number) {
  if (values.length === 0) {
    return null;
  }
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * pct)));
  return sorted[idx]!;
}

function deltaPersistenceScore(currentDelta: number | null | undefined, priors: Array<number | null | undefined>) {
  if (typeof currentDelta !== "number" || currentDelta === 0) {
    return null;
  }
  const sign = currentDelta > 0 ? 1 : -1;
  let count = 0;
  for (const priorDelta of priors.slice(0, 4)) {
    if (typeof priorDelta !== "number" || priorDelta === 0) {
      continue;
    }
    if ((priorDelta > 0 ? 1 : -1) === sign) {
      count += 1;
    }
  }
  return count;
}

function getPreviousDate(allDatesAsc: string[], reportDate: string, countBack: number) {
  const index = allDatesAsc.indexOf(reportDate);
  if (index <= 0 || index - countBack < 0) {
    return null;
  }
  return allDatesAsc[index - countBack] ?? null;
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════════╗");
  console.log("║   COT Commercial Direction Research                            ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝");

  const currentWeekOpenUtc = getDisplayWeekOpenUtc();
  const weekOpenUtcs = (await listDataSectionWeeks())
    .sort((left, right) => left.localeCompare(right))
    .filter((weekOpenUtc) => weekOpenUtc < currentWeekOpenUtc);

  const allDatesDesc = await listSnapshotDates(FX_ASSET);
  const allDatesAsc = [...allDatesDesc].sort((left, right) => left.localeCompare(right));
  const fxHistory = await readSnapshotHistory(FX_ASSET, allDatesAsc.length);
  const snapshotMap = new Map(fxHistory.map((snapshot) => [snapshot.report_date, snapshot]));
  const targetAdr = getTargetAdrPct();

  const rows: PairRow[] = [];

  for (const rawWeekOpenUtc of weekOpenUtcs) {
    const weekOpenUtc = normalizeWeekOpenUtc(rawWeekOpenUtc) ?? rawWeekOpenUtc;
    const reportDate = deriveCotReportDate(weekOpenUtc);
    const snapshot = snapshotMap.get(reportDate) ?? await readSnapshot({ assetClass: FX_ASSET, reportDate });
    if (!snapshot) {
      throw new Error(`Missing FX snapshot for ${reportDate}`);
    }

    const prior4Date = getPreviousDate(allDatesAsc, reportDate, 4);
    const prior4Snapshot = prior4Date
      ? (snapshotMap.get(prior4Date) ?? await readSnapshot({ assetClass: FX_ASSET, reportDate: prior4Date }))
      : null;

    const weeklyReturns = await getWeeklyPairReturns(weekOpenUtc, FX_ASSET);
    const adrMap = await loadWeeklyAdrMap(weekOpenUtc);
    const returnMap = new Map(
      weeklyReturns.map((row) => {
        const adrPct = getAdrPct(adrMap, row.symbol.toUpperCase(), row.assetClass);
        return [
          row.symbol.toUpperCase(),
          {
            returnPct: row.returnPct,
            adrMultiplier: adrPct > 0 ? targetAdr / adrPct : 1,
          },
        ] as const;
      }),
    );

    for (const pairDef of PAIRS_BY_ASSET_CLASS.fx) {
      const pair = pairDef.pair.toUpperCase();
      const ret = returnMap.get(pair);
      const base = snapshot.currencies[pairDef.base];
      const quote = snapshot.currencies[pairDef.quote];
      if (!ret || !base || !quote) {
        continue;
      }

      const forcedRaw = directionFromScore(
        typeof base.commercial_net === "number" && typeof quote.commercial_net === "number"
          ? base.commercial_net - quote.commercial_net
          : null,
      );
      const deltaBased = directionFromScore(
        typeof base.commercial_delta_net === "number" && typeof quote.commercial_delta_net === "number"
          ? base.commercial_delta_net - quote.commercial_delta_net
          : null,
      );
      const oiNormalized = directionFromScore(
        typeof base.commercial_net === "number" &&
        typeof quote.commercial_net === "number" &&
        typeof base.open_interest === "number" &&
        typeof quote.open_interest === "number" &&
        base.open_interest > 0 &&
        quote.open_interest > 0
          ? base.commercial_net / base.open_interest - quote.commercial_net / quote.open_interest
          : null,
      );
      const change4w = directionFromScore(
        typeof base.commercial_net === "number" &&
        typeof quote.commercial_net === "number" &&
        typeof prior4Snapshot?.currencies[pairDef.base]?.commercial_net === "number" &&
        typeof prior4Snapshot?.currencies[pairDef.quote]?.commercial_net === "number"
          ? (base.commercial_net - prior4Snapshot.currencies[pairDef.base]!.commercial_net!) -
            (quote.commercial_net - prior4Snapshot.currencies[pairDef.quote]!.commercial_net!)
          : null,
      );
      const noncomm = directionFromScore(
        typeof base.noncomm_net === "number" && typeof quote.noncomm_net === "number"
          ? base.noncomm_net - quote.noncomm_net
          : null,
      );

      const basePrevDeltas = [
        snapshotMap.get(getPreviousDate(allDatesAsc, reportDate, 1) ?? "")?.currencies[pairDef.base]?.commercial_delta_net ?? null,
        snapshotMap.get(getPreviousDate(allDatesAsc, reportDate, 2) ?? "")?.currencies[pairDef.base]?.commercial_delta_net ?? null,
        snapshotMap.get(getPreviousDate(allDatesAsc, reportDate, 3) ?? "")?.currencies[pairDef.base]?.commercial_delta_net ?? null,
        snapshotMap.get(getPreviousDate(allDatesAsc, reportDate, 4) ?? "")?.currencies[pairDef.base]?.commercial_delta_net ?? null,
      ];
      const quotePrevDeltas = [
        snapshotMap.get(getPreviousDate(allDatesAsc, reportDate, 1) ?? "")?.currencies[pairDef.quote]?.commercial_delta_net ?? null,
        snapshotMap.get(getPreviousDate(allDatesAsc, reportDate, 2) ?? "")?.currencies[pairDef.quote]?.commercial_delta_net ?? null,
        snapshotMap.get(getPreviousDate(allDatesAsc, reportDate, 3) ?? "")?.currencies[pairDef.quote]?.commercial_delta_net ?? null,
        snapshotMap.get(getPreviousDate(allDatesAsc, reportDate, 4) ?? "")?.currencies[pairDef.quote]?.commercial_delta_net ?? null,
      ];
      const basePersist = deltaPersistenceScore(base.commercial_delta_net ?? null, basePrevDeltas);
      const quotePersist = deltaPersistenceScore(quote.commercial_delta_net ?? null, quotePrevDeltas);
      const deltaPersistenceDir =
        basePersist !== null &&
        quotePersist !== null &&
        basePersist !== quotePersist &&
        (basePersist >= 3 || quotePersist >= 3)
          ? directionFromScore(basePersist - quotePersist)
          : null;

      rows.push({
        weekOpenUtc,
        weekLabel: weekLabel(weekOpenUtc),
        pair,
        rawReturnPct: ret.returnPct,
        adrMultiplier: ret.adrMultiplier,
        forcedRaw,
        deltaBased,
        oiNormalized,
        change4w,
        noncomm,
        deltaPersistenceDir,
        netDiffAbs:
          typeof base.commercial_net === "number" && typeof quote.commercial_net === "number"
            ? Math.abs(base.commercial_net - quote.commercial_net)
            : null,
      });
    }
  }

  const baseline = buildStats(rows, () => true, (row) => row.forcedRaw, "Forced-raw baseline");
  assertBaseline(baseline);

  const alternativeRows = [
    baseline,
    buildStats(rows, () => true, (row) => row.deltaBased, "Delta-based direction", baseline),
    buildStats(rows, () => true, (row) => row.oiNormalized, "OI-normalized direction", baseline),
    buildStats(rows, () => true, (row) => row.change4w, "4-week net change direction", baseline),
    buildStats(rows, () => true, (row) => row.noncomm, "Non-commercial direction", baseline),
  ];

  const blendedRows = [
    baseline,
    buildStats(
      rows,
      (row) => row.forcedRaw !== null && row.deltaBased !== null && row.forcedRaw === row.deltaBased,
      (row) => row.forcedRaw,
      "Net + delta agree",
      baseline,
    ),
    buildStats(
      rows,
      (row) => row.forcedRaw !== null && row.noncomm !== null && row.forcedRaw === row.noncomm,
      (row) => row.forcedRaw,
      "Net + noncomm agree",
      baseline,
    ),
    buildStats(
      rows,
      () => true,
      (row) =>
        row.forcedRaw === null
          ? null
          : row.deltaPersistenceDir !== null && row.deltaPersistenceDir !== row.forcedRaw
            ? (row.forcedRaw === "LONG" ? "SHORT" : "LONG")
            : row.forcedRaw,
      "Forced-raw flipped by delta",
      baseline,
    ),
  ];

  const magnitudeValues = rows
    .map((row) => row.netDiffAbs)
    .filter((value): value is number => typeof value === "number")
    .sort((left, right) => left - right);
  const lowerCut = percentile(magnitudeValues, 1 / 3) ?? 0;
  const upperCut = percentile(magnitudeValues, 2 / 3) ?? 0;
  const median = percentile(magnitudeValues, 0.5) ?? 0;

  const magnitudeRows = [
    baseline,
    buildStats(rows, (row) => (row.netDiffAbs ?? -1) > upperCut, (row) => row.forcedRaw, "Top third (largest difference)", baseline),
    buildStats(rows, (row) => (row.netDiffAbs ?? -1) > lowerCut && (row.netDiffAbs ?? -1) <= upperCut, (row) => row.forcedRaw, "Middle third", baseline),
    buildStats(rows, (row) => (row.netDiffAbs ?? -1) <= lowerCut, (row) => row.forcedRaw, "Bottom third (smallest diff)", baseline),
    buildStats(rows, (row) => (row.netDiffAbs ?? -1) > median, (row) => row.forcedRaw, "Only |net_diff| > median", baseline),
  ];

  const candidates = [...alternativeRows.slice(1), ...blendedRows.slice(1), ...magnitudeRows.slice(1)];
  const best = [...candidates].sort(
    (left, right) =>
      right.totalReturnPct - left.totalReturnPct ||
      left.maxDdPct - right.maxDdPct ||
      right.winRatePct - left.winRatePct,
  )[0]!;

  const lines: string[] = [];
  lines.push("# COT Commercial Direction Research");
  lines.push("");
  lines.push(`Weeks analyzed: ${weekOpenUtcs.length} (${weekLabel(weekOpenUtcs[0]!)} -> ${weekLabel(weekOpenUtcs.at(-1)!)}).`);
  lines.push("");
  lines.push("## Baseline");
  lines.push("");
  lines.push("| Baseline | Pairs | Total% | MaxDD% | Win% |");
  lines.push("| --- | ---: | ---: | ---: | ---: |");
  lines.push(`| ${baseline.label} | ${baseline.pairs} | ${signedPercent(baseline.totalReturnPct)} | ${baseline.maxDdPct.toFixed(2)}% | ${baseline.winRatePct.toFixed(1)}% |`);
  lines.push("");
  lines.push("## Test 1: Alternative Direction Methods");
  lines.push("");
  lines.push("| Method (replaces forced-raw) | Pairs | Total% | MaxDD% | Win% | vs Baseline |");
  lines.push("| --- | ---: | ---: | ---: | ---: | ---: |");
  for (const row of alternativeRows) {
    lines.push(`| ${row.label} | ${row.pairs} | ${signedPercent(row.totalReturnPct)} | ${row.maxDdPct.toFixed(2)}% | ${row.winRatePct.toFixed(1)}% | ${row.vsBaselinePct === null || row.vsBaselinePct === undefined ? "—" : signedPercent(row.vsBaselinePct)} |`);
  }
  lines.push("");
  lines.push("## Test 2: Blended Direction Methods");
  lines.push("");
  lines.push("| Blended method | Pairs | Total% | MaxDD% | Win% | vs Baseline |");
  lines.push("| --- | ---: | ---: | ---: | ---: | ---: |");
  for (const row of blendedRows) {
    lines.push(`| ${row.label} | ${row.pairs} | ${signedPercent(row.totalReturnPct)} | ${row.maxDdPct.toFixed(2)}% | ${row.winRatePct.toFixed(1)}% | ${row.vsBaselinePct === null || row.vsBaselinePct === undefined ? "—" : signedPercent(row.vsBaselinePct)} |`);
  }
  lines.push("");
  lines.push("## Test 3: Magnitude Threshold");
  lines.push("");
  lines.push("| Magnitude bucket | Pairs | Total% | MaxDD% | Win% | Avg% |");
  lines.push("| --- | ---: | ---: | ---: | ---: | ---: |");
  for (const row of magnitudeRows) {
    lines.push(`| ${row.label} | ${row.pairs} | ${signedPercent(row.totalReturnPct)} | ${row.maxDdPct.toFixed(2)}% | ${row.winRatePct.toFixed(1)}% | ${signedPercent(row.avgReturnPct, 3)} |`);
  }
  lines.push("");
  lines.push("## Test 4: Best Method Standalone");
  lines.push("");
  lines.push("| Commercial System | Trades | Total% | MaxDD% | Win% |");
  lines.push("| --- | ---: | ---: | ---: | ---: |");
  lines.push(`| Forced-raw (current) | ${baseline.pairs} | ${signedPercent(baseline.totalReturnPct)} | ${baseline.maxDdPct.toFixed(2)}% | ${baseline.winRatePct.toFixed(1)}% |`);
  lines.push(`| Best alternative: ${best.label} | ${best.pairs} | ${signedPercent(best.totalReturnPct)} | ${best.maxDdPct.toFixed(2)}% | ${best.winRatePct.toFixed(1)}% |`);
  lines.push("");
  lines.push("## Summary");
  lines.push("");
  lines.push(`1. Best candidate from this pass: \`${best.label}\` with ${best.pairs} trades, ${signedPercent(best.totalReturnPct)}, ${best.maxDdPct.toFixed(2)}% DD, ${best.winRatePct.toFixed(1)}% WR.`);
  lines.push(`2. Forced-raw baseline was reproduced exactly enough at ${baseline.pairs} trades, ${signedPercent(baseline.totalReturnPct)}, ${baseline.maxDdPct.toFixed(2)}% DD, ${baseline.winRatePct.toFixed(1)}% WR.`);
  lines.push(`3. Median net-diff threshold used in Test 3: ${median.toFixed(0)} contracts. Lower/upper tercile cuts: ${lowerCut.toFixed(0)} / ${upperCut.toFixed(0)}.`);
  lines.push("");

  writeFileSync(OUTPUT_PATH, `${lines.join("\n")}\n`, "utf8");

  console.log(`Commercial baseline: ${baseline.pairs} / ${baseline.totalReturnPct.toFixed(2)}% / ${baseline.maxDdPct.toFixed(2)} DD / ${baseline.winRatePct.toFixed(1)}% WR`);
  console.log(`Best method: ${best.label} / ${best.pairs} / ${best.totalReturnPct.toFixed(2)}% / ${best.maxDdPct.toFixed(2)} DD / ${best.winRatePct.toFixed(1)}% WR`);
  console.log(`Output written to ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
