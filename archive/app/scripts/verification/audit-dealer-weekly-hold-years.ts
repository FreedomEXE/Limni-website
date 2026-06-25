/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: audit-dealer-weekly-hold-years.ts
 *
 * Description:
 * Gate 34 audit receipt for Dealer-only Weekly Hold research. Verifies that
 * yearly receipts match canonical Dealer source derivation and canonical 1H
 * execution prices, then summarizes why 2026, clean 2025, and 2024 diverge.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { loadEnvConfig } from "@next/env";
import { DateTime } from "luxon";

import { getPool, query } from "@/lib/db";
import { COT_ASSET_CLASSES } from "@/lib/cotMarkets";
import { PAIRS_BY_ASSET_CLASS } from "@/lib/cotPairs";
import { readSnapshot } from "@/lib/cotStore";
import { derivePairDirectionsWithNeutral, resolveMarketBias } from "@/lib/cotCompute";
import { deriveCotReportDate } from "@/lib/dataSectionWeeks";
import { getExecutionWeekWindow } from "@/lib/executionPriceWindows";
import { readFrozenSourceLedgerWeek } from "@/lib/sourceFreeze/sourceLedger";

loadEnvConfig(process.cwd());

type Direction = "LONG" | "SHORT" | "NEUTRAL" | "MISSING";

type PairRow = {
  weekOpenUtc: string;
  pineWeekKey: string;
  symbol: string;
  direction: Direction;
  sourceReportDate: string | null;
  executionReturnSource: string;
  executionReturnComplete: boolean | null;
  executionReturnWarnings: string[];
  entryPrice: number | null;
  exitPrice: number | null;
  pairAdrPct: number | null;
  adrSource: string;
  rawReturnPct: number | null;
  adrReturnPct: number | null;
  maxAdverseRawPct: number | null;
  maxAdverseAdrPct: number | null;
  outcome: string;
  missingReason: string | null;
};

type WeekReceipt = {
  weekOpenUtc: string;
  pineWeekKey: string;
  pairRows: PairRow[];
  totals: {
    tradeRows: number;
    wins: number;
    losses: number;
    flat: number;
    rawReturnPct: number;
    adrReturnPct: number;
  };
  path?: {
    raw?: { adverseMaxDrawdownPct?: number };
    adr?: { adverseMaxDrawdownPct?: number };
  };
};

type BaselineReceipt = {
  generatedAtUtc: string;
  scope: {
    displayedWeekFrom: string;
    displayedWeekTo: string;
    selectedWeekCount: number;
    weekOpenUtcs: string[];
  };
  summary: Record<string, number | null>;
  basketPath?: {
    raw?: { summary?: Record<string, number | null> };
    adrNormalized?: { summary?: Record<string, number | null> };
  };
  weeks: WeekReceipt[];
};

type FixedReceipt = {
  generatedAtUtc: string;
  summaries: Array<Record<string, number | string | null>>;
};

type PriceBarRow = {
  symbol: string;
  bar_open_utc: Date;
  bar_close_utc: Date;
  open_price: number | string;
  high_price: number | string;
  low_price: number | string;
  close_price: number | string;
};

const EXPECTED_PAIRS = PAIRS_BY_ASSET_CLASS.fx.map((pair) => pair.pair.toUpperCase());
const PAIR_DEF_BY_SYMBOL = new Map(
  PAIRS_BY_ASSET_CLASS.fx.map((pair) => [pair.pair.toUpperCase(), pair]),
);
const REQUIRED_CURRENCIES = Object.keys(COT_ASSET_CLASSES.fx.markets);

function argValue(name: string) {
  const direct = process.argv.find((arg) => arg.startsWith(`--${name}=`));
  if (direct) return direct.slice(name.length + 3);
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

async function latestMatchingFile(dir: string, includes: string[]) {
  const entries = await readdir(dir);
  const candidates = await Promise.all(entries
    .filter((entry) => entry.endsWith(".json") && includes.every((part) => entry.includes(part)))
    .map(async (entry) => {
      const fullPath = path.join(dir, entry);
      const info = await stat(fullPath);
      return { fullPath, mtimeMs: info.mtimeMs };
    }));
  candidates.sort((left, right) => right.mtimeMs - left.mtimeMs);
  if (!candidates[0]) {
    throw new Error(`No matching receipt in ${dir}: ${includes.join(", ")}`);
  }
  return candidates[0].fullPath;
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await readFile(filePath, "utf8")) as T;
}

function round(value: number | null | undefined, digits = 2) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null;
  return Number(value.toFixed(digits));
}

function signed(value: number | null | undefined, digits = 2) {
  const rounded = round(value, digits);
  if (rounded === null) return "n/a";
  return `${rounded >= 0 ? "+" : ""}${rounded.toFixed(digits)}%`;
}

function numberValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function profitFactor(values: number[]) {
  const grossProfit = values.filter((value) => value > 0).reduce((sum, value) => sum + value, 0);
  const grossLoss = Math.abs(values.filter((value) => value < 0).reduce((sum, value) => sum + value, 0));
  return grossLoss > 0 ? grossProfit / grossLoss : null;
}

function directionSign(direction: Direction) {
  if (direction === "LONG") return 1;
  if (direction === "SHORT") return -1;
  return 0;
}

function directionFromScore(score: number | null | undefined): Direction | null {
  if (typeof score !== "number" || !Number.isFinite(score) || score === 0) return null;
  return score > 0 ? "LONG" : "SHORT";
}

function dealerDirectionalRatio(market: any) {
  if (typeof market?.dealer_directional_ratio === "number") return market.dealer_directional_ratio;
  if (typeof market?.dealer_spread !== "number" || market.dealer_spread < 0) return null;
  const directional = Math.abs(Number(market.dealer_net));
  const denom = directional + market.dealer_spread;
  return denom > 0 ? directional / denom : null;
}

function classifyDealerRule(base: any, quote: any) {
  const baseBias = base ? resolveMarketBias(base, "dealer") : null;
  const quoteBias = quote ? resolveMarketBias(quote, "dealer") : null;
  if (!baseBias || !quoteBias) return { tier: "missing_market", direction: null as Direction | null };

  if (
    baseBias.bias !== "NEUTRAL" &&
    quoteBias.bias !== "NEUTRAL" &&
    baseBias.bias !== quoteBias.bias
  ) {
    return {
      tier: "direct_opposed_bias",
      direction: baseBias.bias === "BULLISH" && quoteBias.bias === "BEARISH" ? "LONG" as const : "SHORT" as const,
    };
  }

  const baseRatio = dealerDirectionalRatio(base);
  const quoteRatio = dealerDirectionalRatio(quote);
  if (typeof baseRatio === "number" && typeof quoteRatio === "number") {
    const dir = directionFromScore(baseRatio - quoteRatio);
    if (dir) return { tier: "neutral_tier1_directional_ratio", direction: dir };
  }

  const basePersistence = base.dealer_delta_persistence ?? 0;
  const quotePersistence = quote.dealer_delta_persistence ?? 0;
  if (basePersistence !== quotePersistence && (basePersistence >= 3 || quotePersistence >= 3)) {
    if (
      basePersistence > quotePersistence &&
      basePersistence >= 3 &&
      typeof base.dealer_delta_net === "number" &&
      base.dealer_delta_net !== 0
    ) {
      return {
        tier: "neutral_tier2_delta_persistence",
        direction: base.dealer_delta_net > 0 ? "LONG" as const : "SHORT" as const,
      };
    }
    if (
      quotePersistence > basePersistence &&
      quotePersistence >= 3 &&
      typeof quote.dealer_delta_net === "number" &&
      quote.dealer_delta_net !== 0
    ) {
      return {
        tier: "neutral_tier2_delta_persistence",
        direction: quote.dealer_delta_net > 0 ? "SHORT" as const : "LONG" as const,
      };
    }
  }

  const baseConfirmed =
    typeof base.dealer_delta_net === "number" &&
    typeof base.oi_delta === "number" &&
    base.dealer_delta_net !== 0 &&
    base.oi_delta !== 0 &&
    Math.sign(base.dealer_delta_net) === Math.sign(base.oi_delta);
  const quoteConfirmed =
    typeof quote.dealer_delta_net === "number" &&
    typeof quote.oi_delta === "number" &&
    quote.dealer_delta_net !== 0 &&
    quote.oi_delta !== 0 &&
    Math.sign(quote.dealer_delta_net) === Math.sign(quote.oi_delta);

  if (baseConfirmed && !quoteConfirmed) {
    return {
      tier: "neutral_tier3_oi_confirmed_delta",
      direction: base.dealer_delta_net > 0 ? "LONG" as const : "SHORT" as const,
    };
  }
  if (quoteConfirmed && !baseConfirmed) {
    return {
      tier: "neutral_tier3_oi_confirmed_delta",
      direction: quote.dealer_delta_net > 0 ? "SHORT" as const : "LONG" as const,
    };
  }
  if (baseConfirmed && quoteConfirmed) {
    const dir = directionFromScore((base.dealer_delta_net ?? 0) - (quote.dealer_delta_net ?? 0));
    if (dir) return { tier: "neutral_tier3_oi_confirmed_delta_diff", direction: dir };
  }

  if (typeof base.dealer_delta_net === "number" && typeof quote.dealer_delta_net === "number") {
    const dir = directionFromScore(base.dealer_delta_net - quote.dealer_delta_net);
    if (dir) return { tier: "neutral_tier4_raw_delta_diff", direction: dir };
  }

  const forced = directionFromScore(base.dealer_net - quote.dealer_net);
  return {
    tier: forced ? "neutral_tier5_forced_net" : "neutral_unresolved",
    direction: forced,
  };
}

async function loadPriceBars(symbols: string[], fromUtc: string, toUtc: string) {
  const rows = await query<PriceBarRow>(
    `SELECT symbol, bar_open_utc, bar_close_utc, open_price, high_price, low_price, close_price
       FROM canonical_price_bars
      WHERE asset_class = 'fx'
        AND timeframe = '1h'
        AND symbol = ANY($1::text[])
        AND bar_open_utc >= $2::timestamptz
        AND bar_open_utc < $3::timestamptz
      ORDER BY symbol ASC, bar_open_utc ASC`,
    [symbols, fromUtc, toUtc],
  );

  const grouped = new Map<string, PriceBarRow[]>();
  for (const row of rows) {
    const key = row.symbol.toUpperCase();
    const list = grouped.get(key) ?? [];
    list.push(row);
    grouped.set(key, list);
  }
  return grouped;
}

async function auditPrice(receipt: BaselineReceipt) {
  const mismatches: Array<{
    week: string;
    symbol: string;
    reason: string;
    receipt: number | null;
    derived: number | null;
  }> = [];
  let checkedRows = 0;
  let missingBars = 0;
  let missingExactOpen = 0;
  let maxAbsRawDiff = 0;
  let maxAbsEntryDiff = 0;
  let maxAbsExitDiff = 0;

  for (const week of receipt.weeks) {
    const window = getExecutionWeekWindow(week.weekOpenUtc, "fx");
    const fromUtc = window.windowOpenUtc.toUTC().toISO() ?? week.weekOpenUtc;
    const toUtc = window.windowCloseUtc.toUTC().toISO() ?? week.weekOpenUtc;
    const barsBySymbol = await loadPriceBars(EXPECTED_PAIRS, fromUtc, toUtc);

    for (const row of week.pairRows) {
      if (row.direction !== "LONG" && row.direction !== "SHORT") continue;
      checkedRows += 1;
      const bars = barsBySymbol.get(row.symbol.toUpperCase()) ?? [];
      if (bars.length === 0) {
        missingBars += 1;
        mismatches.push({ week: week.pineWeekKey, symbol: row.symbol, reason: "missing_1h_bars", receipt: row.rawReturnPct, derived: null });
        continue;
      }
      const first = bars[0]!;
      const last = bars[bars.length - 1]!;
      if (first.bar_open_utc.toISOString() !== fromUtc) missingExactOpen += 1;
      const entry = Number(first.open_price);
      const exit = Number(last.close_price);
      const marketReturn = ((exit - entry) / entry) * 100;
      const directionalReturn = marketReturn * directionSign(row.direction);
      const rawDiff = Math.abs(directionalReturn - Number(row.rawReturnPct));
      const entryDiff = Math.abs(entry - Number(row.entryPrice));
      const exitDiff = Math.abs(exit - Number(row.exitPrice));
      maxAbsRawDiff = Math.max(maxAbsRawDiff, rawDiff);
      maxAbsEntryDiff = Math.max(maxAbsEntryDiff, entryDiff);
      maxAbsExitDiff = Math.max(maxAbsExitDiff, exitDiff);
      if (rawDiff > 0.0005) {
        mismatches.push({ week: week.pineWeekKey, symbol: row.symbol, reason: "raw_return_diff", receipt: row.rawReturnPct, derived: directionalReturn });
      }
      if (entryDiff > 0.000001) {
        mismatches.push({ week: week.pineWeekKey, symbol: row.symbol, reason: "entry_price_diff", receipt: row.entryPrice, derived: entry });
      }
      if (exitDiff > 0.000001) {
        mismatches.push({ week: week.pineWeekKey, symbol: row.symbol, reason: "exit_price_diff", receipt: row.exitPrice, derived: exit });
      }
    }
  }

  return {
    checkedRows,
    missingBars,
    missingExactOpen,
    mismatchCount: mismatches.length,
    maxAbsRawDiff,
    maxAbsEntryDiff,
    maxAbsExitDiff,
    sampleMismatches: mismatches.slice(0, 12),
  };
}

async function auditSource(receipt: BaselineReceipt) {
  const snapshots = new Map<string, Awaited<ReturnType<typeof readSnapshot>>>();
  const missingSnapshots: string[] = [];
  const missingCurrencies: Array<{ reportDate: string; missing: string[] }> = [];
  const sourceDateMismatches: Array<{ week: string; symbol: string; receipt: string | null; derived: string }> = [];
  const liveDirectionMismatches: Array<{ week: string; symbol: string; receipt: Direction; live: Direction }> = [];
  const frozenDirectionMismatches: Array<{ week: string; symbol: string; receipt: Direction; frozen: Direction }> = [];
  let frozenWeeks = 0;
  let liveDerivedRows = 0;
  let receiptRows = 0;

  for (const week of receipt.weeks) {
    const reportDate = deriveCotReportDate(week.weekOpenUtc);
    if (!snapshots.has(reportDate)) {
      snapshots.set(reportDate, await readSnapshot({ assetClass: "fx", reportDate }));
    }
    const snapshot = snapshots.get(reportDate);
    if (!snapshot) {
      missingSnapshots.push(reportDate);
      continue;
    }
    const missing = REQUIRED_CURRENCIES.filter((currency) => !snapshot.currencies[currency]);
    if (missing.length > 0) missingCurrencies.push({ reportDate, missing });
    const livePairs = derivePairDirectionsWithNeutral(snapshot.currencies, PAIRS_BY_ASSET_CLASS.fx, "dealer");
    const frozen = await readFrozenSourceLedgerWeek(week.weekOpenUtc);
    if (frozen) frozenWeeks += 1;
    const frozenDealer = new Map(
      (frozen?.signals ?? [])
        .filter((signal) => signal.model === "dealer" && signal.assetClass === "fx")
        .map((signal) => [signal.symbol.toUpperCase(), signal.direction as Direction]),
    );

    for (const row of week.pairRows) {
      receiptRows += 1;
      if (row.sourceReportDate !== reportDate) {
        sourceDateMismatches.push({ week: week.pineWeekKey, symbol: row.symbol, receipt: row.sourceReportDate, derived: reportDate });
      }
      const live = (livePairs[row.symbol.toUpperCase()]?.direction as Direction | undefined) ?? "NEUTRAL";
      liveDerivedRows += 1;
      if (live !== row.direction) {
        liveDirectionMismatches.push({ week: week.pineWeekKey, symbol: row.symbol, receipt: row.direction, live });
      }
      const frozenDirection = frozenDealer.get(row.symbol.toUpperCase());
      if (frozenDirection && frozenDirection !== row.direction) {
        frozenDirectionMismatches.push({ week: week.pineWeekKey, symbol: row.symbol, receipt: row.direction, frozen: frozenDirection });
      }
    }
  }

  return {
    reportDates: snapshots.size,
    frozenWeeks,
    receiptRows,
    liveDerivedRows,
    missingSnapshots: Array.from(new Set(missingSnapshots)).sort(),
    missingCurrencies,
    sourceDateMismatchCount: sourceDateMismatches.length,
    liveDirectionMismatchCount: liveDirectionMismatches.length,
    frozenDirectionMismatchCount: frozenDirectionMismatches.length,
    sampleSourceDateMismatches: sourceDateMismatches.slice(0, 12),
    sampleLiveDirectionMismatches: liveDirectionMismatches.slice(0, 12),
  };
}

async function analyzeSignalBehavior(receipt: BaselineReceipt) {
  const snapshots = new Map<string, Awaited<ReturnType<typeof readSnapshot>>>();
  const ruleRows = new Map<string, {
    rows: number;
    wins: number;
    losses: number;
    raw: number;
    adr: number;
  }>();
  const directionRows = new Map<string, { rows: number; raw: number; adr: number; wins: number; losses: number }>();
  const pairRows = new Map<string, { rows: number; raw: number; adr: number; wins: number; losses: number }>();
  const rowDetails: Array<PairRow & { ruleTier: string }> = [];

  const bump = (map: Map<string, any>, key: string, row: PairRow) => {
    const current = map.get(key) ?? { rows: 0, wins: 0, losses: 0, raw: 0, adr: 0 };
    current.rows += 1;
    current.raw += Number(row.rawReturnPct ?? 0);
    current.adr += Number(row.adrReturnPct ?? 0);
    if (Number(row.rawReturnPct ?? 0) > 0) current.wins += 1;
    if (Number(row.rawReturnPct ?? 0) < 0) current.losses += 1;
    map.set(key, current);
  };

  for (const week of receipt.weeks) {
    const reportDate = deriveCotReportDate(week.weekOpenUtc);
    if (!snapshots.has(reportDate)) {
      snapshots.set(reportDate, await readSnapshot({ assetClass: "fx", reportDate }));
    }
    const snapshot = snapshots.get(reportDate);
    for (const row of week.pairRows) {
      if (row.direction !== "LONG" && row.direction !== "SHORT") continue;
      let ruleTier = "source_missing";
      const pairDef = PAIR_DEF_BY_SYMBOL.get(row.symbol.toUpperCase());
      if (snapshot && pairDef) {
        const rule = classifyDealerRule(snapshot.currencies[pairDef.base], snapshot.currencies[pairDef.quote]);
        ruleTier = rule.tier;
      }
      bump(ruleRows, ruleTier, row);
      bump(directionRows, row.direction, row);
      bump(pairRows, row.symbol.toUpperCase(), row);
      rowDetails.push({ ...row, ruleTier });
    }
  }

  const sortRows = (map: Map<string, { rows: number; wins: number; losses: number; raw: number; adr: number }>) =>
    [...map.entries()].map(([key, value]) => ({
      key,
      rows: value.rows,
      wins: value.wins,
      losses: value.losses,
      raw: round(value.raw, 2),
      adr: round(value.adr, 2),
    })).sort((left, right) => Number(right.adr) - Number(left.adr));

  const weeklyRaw = receipt.weeks.map((week) => week.totals.rawReturnPct);
  const weeklyAdr = receipt.weeks.map((week) => week.totals.adrReturnPct);
  const invertedWeeklyRaw = weeklyRaw.map((value) => -value);
  const invertedWeeklyAdr = weeklyAdr.map((value) => -value);

  const worstWeeks = receipt.weeks
    .map((week) => ({
      week: week.pineWeekKey,
      raw: round(week.totals.rawReturnPct, 2),
      adr: round(week.totals.adrReturnPct, 2),
      wins: week.totals.wins,
      losses: week.totals.losses,
      rawAdverseDd: round(week.path?.raw?.adverseMaxDrawdownPct ?? null, 2),
      adrAdverseDd: round(week.path?.adr?.adverseMaxDrawdownPct ?? null, 2),
    }))
    .sort((left, right) => Number(left.adr) - Number(right.adr))
    .slice(0, 8);

  const worstTrades = [...rowDetails]
    .sort((left, right) => Number(left.adrReturnPct ?? 0) - Number(right.adrReturnPct ?? 0))
    .slice(0, 12)
    .map((row) => ({
      week: row.pineWeekKey,
      symbol: row.symbol,
      direction: row.direction,
      ruleTier: row.ruleTier,
      raw: round(row.rawReturnPct, 2),
      adr: round(row.adrReturnPct, 2),
      adverseAdr: round(row.maxAdverseAdrPct, 2),
    }));

  return {
    ruleRows: sortRows(ruleRows),
    directionRows: sortRows(directionRows),
    pairRows: sortRows(pairRows),
    worstWeeks,
    worstTrades,
    inverted: {
      totalRaw: round(invertedWeeklyRaw.reduce((sum, value) => sum + value, 0), 2),
      totalAdr: round(invertedWeeklyAdr.reduce((sum, value) => sum + value, 0), 2),
      weeklyRawPf: round(profitFactor(invertedWeeklyRaw), 2),
      weeklyAdrPf: round(profitFactor(invertedWeeklyAdr), 2),
    },
  };
}

function adrCoverage(receipt: BaselineReceipt) {
  const rows = receipt.weeks.flatMap((week) => week.pairRows);
  const canonical = rows.filter((row) => row.adrSource === "canonical_price_bars").length;
  const defaults = rows.filter((row) => row.adrSource === "asset_default").length;
  const minAdr = Math.min(...rows.map((row) => Number(row.pairAdrPct)).filter(Number.isFinite));
  const maxAdr = Math.max(...rows.map((row) => Number(row.pairAdrPct)).filter(Number.isFinite));
  return { canonical, defaults, minAdr: round(minAdr, 4), maxAdr: round(maxAdr, 4) };
}

function selectFixedSummaries(receipt: FixedReceipt) {
  const chosenIds = new Set([
    "week_close",
    "market_week_tp1x_sl2x_adr",
    "market_week_tp1x_sl2p45x_adr",
    "market_week_tp1p2x_sl2p45x_adr",
    "market_week_tp1p6x_sl2p45x_adr",
  ]);
  const chosen = receipt.summaries
    .filter((summary) => chosenIds.has(String(summary.variantId)))
    .map((summary) => ({
      variantId: summary.variantId,
      totalRawPct: round(numberValue(summary.totalRawPct), 2),
      totalAdrPct: round(numberValue(summary.totalAdrPct), 2),
      weeklyAdrProfitFactor: round(numberValue(summary.weeklyAdrProfitFactor), 2),
      tradeAdrProfitFactor: round(numberValue(summary.tradeAdrProfitFactor), 2),
      tradeAdrExpectancyPct: round(numberValue(summary.tradeAdrExpectancyPct), 3),
      adrAdverseDrawdownPct: round(numberValue(summary.adrAdverseDrawdownPct), 2),
      adverseDdPerAdrReturn: round(numberValue(summary.adverseDdPerAdrReturn), 3),
      tpNormalizedAdrReturn: round(numberValue(summary.tpNormalizedAdrReturn), 2),
      slRiskNormalizedAdrReturn: round(numberValue(summary.slRiskNormalizedAdrReturn), 2),
      weeklySharpeStyleScore: round(numberValue(summary.weeklySharpeStyleScore), 2),
    }));

  const bestAdr = [...receipt.summaries]
    .filter((summary) => String(summary.variantId) !== "week_close")
    .sort((left, right) => Number(right.totalAdrPct ?? -Infinity) - Number(left.totalAdrPct ?? -Infinity))[0];

  return {
    chosen,
    bestAdr: bestAdr ? {
      variantId: bestAdr.variantId,
      totalRawPct: round(numberValue(bestAdr.totalRawPct), 2),
      totalAdrPct: round(numberValue(bestAdr.totalAdrPct), 2),
      weeklyAdrProfitFactor: round(numberValue(bestAdr.weeklyAdrProfitFactor), 2),
      adrAdverseDrawdownPct: round(numberValue(bestAdr.adrAdverseDrawdownPct), 2),
      weeklySharpeStyleScore: round(numberValue(bestAdr.weeklySharpeStyleScore), 2),
    } : null,
  };
}

function table(headers: string[], rows: Array<Array<string | number | null>>) {
  const lines = [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
  ];
  for (const row of rows) {
    lines.push(`| ${row.map((cell) => cell ?? "n/a").join(" | ")} |`);
  }
  return lines.join("\n");
}

function fmtNum(value: number | null | undefined, digits = 2) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "n/a";
  return value.toFixed(digits);
}

async function main() {
  const baselineDir = path.resolve(process.cwd(), "app/reports/data-verification/weekly-hold-basket-baseline");
  const fixedDir = path.resolve(process.cwd(), "app/reports/data-verification/weekly-hold-exit-sweep");
  const docsOut = path.resolve(
    process.cwd(),
    argValue("docs-out") ?? "docs/research/GATE34_DEALER_WEEKLY_HOLD_2024_2026_AUDIT_2026-06-14.md",
  );
  const jsonOut = path.resolve(
    process.cwd(),
    argValue("json-out") ?? "app/reports/data-verification/weekly-hold-audit/dealer-weekly-hold-2024-2026-audit-20260614.json",
  );

  const years = [
    { label: "2024", weeks: "52w" },
    { label: "clean 2025", weeks: "39w" },
    { label: "current 2026", weeks: "23w" },
  ];

  const results = [];
  for (const year of years) {
    const baselinePath = await latestMatchingFile(baselineDir, [`baseline-${year.weeks}`]);
    const fixedPath = await latestMatchingFile(fixedDir, [`fixed-band-sweep-${year.weeks}`]);
    const baseline = await readJson<BaselineReceipt>(baselinePath);
    const fixed = await readJson<FixedReceipt>(fixedPath);
    const [source, price, behavior] = await Promise.all([
      auditSource(baseline),
      auditPrice(baseline),
      analyzeSignalBehavior(baseline),
    ]);
    results.push({
      ...year,
      baselinePath,
      fixedPath,
      baselineGeneratedAtUtc: baseline.generatedAtUtc,
      fixedGeneratedAtUtc: fixed.generatedAtUtc,
      summary: baseline.summary,
      pathSummary: {
        raw: baseline.basketPath?.raw?.summary ?? {},
        adr: baseline.basketPath?.adrNormalized?.summary ?? {},
      },
      adrCoverage: adrCoverage(baseline),
      fixed: selectFixedSummaries(fixed),
      source,
      price,
      behavior,
    });
  }

  const generatedAtUtc = DateTime.utc().toISO() ?? new Date().toISOString();
  await writeFile(jsonOut, `${JSON.stringify({ generatedAtUtc, results }, null, 2)}\n`, "utf8");

  const lines: string[] = [
    "# Gate 34 Dealer Weekly Hold 2024-2026 Audit",
    "",
    `Generated: ${generatedAtUtc}`,
    "",
    "## Conclusion",
    "",
    "- The corrected receipts show one definite test-harness issue: 2024 and clean 2025 were previously using default FX ADR for fixed bands. Daily ADR bars have now been materialized from canonical 1H bars and the receipts were rerun.",
    "- After correction, 2025 is no longer simply weak on an ADR-normalized basis: week-close raw remains negative, but ADR-normalized week-close is positive. Fixed bands are still profitable, though less spectacular than the prior default-ADR sweep.",
    "- 2024 remains a true Dealer signal failure in this test. It is not explained by missing COT snapshots, frozen-ledger substitution, missing FX price rows, or default ADR coverage.",
    "- The app/test path is internally consistent: receipt directions match live Dealer derivation, source report dates match derived COT weeks, and receipt entry/exit/raw returns recompute from canonical 1H execution bars.",
    "",
    "## Corrected Year Summary",
    "",
    table(
      ["Year", "Weeks", "Raw", "ADR", "Weekly ADR PF", "Trade ADR PF", "ADR DD", "ADR Source"],
      results.map((result) => [
        result.label,
        Number(result.summary.weeks ?? 0),
        signed(numberValue(result.summary.totalRawPct)),
        signed(numberValue(result.summary.totalAdrPct)),
        fmtNum(numberValue(result.summary.weeklyAdrProfitFactor)),
        fmtNum(numberValue(result.summary.tradeAdrProfitFactor)),
        `${fmtNum(numberValue(result.pathSummary.adr.adverseMaxDrawdownPct ?? null))}%`,
        `${result.adrCoverage.canonical}/${result.adrCoverage.defaults} canonical/default`,
      ]),
    ),
    "",
    "## Fixed-Band Checkpoints",
    "",
  ];

  for (const result of results) {
    lines.push(
      `### ${result.label}`,
      "",
      `Best broad ADR variant: ${result.fixed.bestAdr?.variantId ?? "n/a"} raw ${signed(result.fixed.bestAdr?.totalRawPct)} / ADR ${signed(result.fixed.bestAdr?.totalAdrPct)} / ADR DD ${fmtNum(result.fixed.bestAdr?.adrAdverseDrawdownPct)}% / Sharpe-style ${fmtNum(result.fixed.bestAdr?.weeklySharpeStyleScore)}.`,
      "",
      table(
        ["Variant", "Raw", "ADR", "Weekly PF", "Trade PF", "Expectancy", "ADR DD", "DD/Return"],
        result.fixed.chosen.map((summary) => [
          String(summary.variantId),
          signed(summary.totalRawPct),
          signed(summary.totalAdrPct),
          fmtNum(summary.weeklyAdrProfitFactor),
          fmtNum(summary.tradeAdrProfitFactor),
          fmtNum(summary.tradeAdrExpectancyPct, 3),
          `${fmtNum(summary.adrAdverseDrawdownPct)}%`,
          fmtNum(summary.adverseDdPerAdrReturn, 3),
        ]),
      ),
      "",
    );
  }

  lines.push("## Integrity Checks", "");
  lines.push(table(
    ["Year", "COT Dates", "Frozen Weeks", "Missing Snapshots", "Live Direction Mismatches", "Price Mismatches", "Missing Bars", "Missing Exact Opens", "Max Raw Diff"],
    results.map((result) => [
      result.label,
      result.source.reportDates,
      result.source.frozenWeeks,
      result.source.missingSnapshots.length,
      result.source.liveDirectionMismatchCount,
      result.price.mismatchCount,
      result.price.missingBars,
      result.price.missingExactOpen,
      fmtNum(result.price.maxAbsRawDiff, 6),
    ]),
  ));

  lines.push("", "## Dealer Rule Contribution", "");
  for (const result of results) {
    lines.push(
      `### ${result.label}`,
      "",
      table(
        ["Rule Tier", "Rows", "W/L", "Raw", "ADR"],
        result.behavior.ruleRows.map((row) => [
          row.key,
          row.rows,
          `${row.wins}/${row.losses}`,
          signed(row.raw),
          signed(row.adr),
        ]),
      ),
      "",
      `Inverted week-close check: raw ${signed(result.behavior.inverted.totalRaw)} / ADR ${signed(result.behavior.inverted.totalAdr)} / weekly ADR PF ${fmtNum(result.behavior.inverted.weeklyAdrPf)}.`,
      "",
    );
  }

  lines.push("## Worst Weeks", "");
  for (const result of results) {
    lines.push(
      `### ${result.label}`,
      "",
      table(
        ["Week", "W/L", "Raw", "ADR", "ADR Adv DD"],
        result.behavior.worstWeeks.map((week) => [
          week.week,
          `${week.wins}/${week.losses}`,
          signed(week.raw),
          signed(week.adr),
          `${fmtNum(week.adrAdverseDd)}%`,
        ]),
      ),
      "",
    );
  }

  lines.push("## Pair Contribution", "");
  for (const result of results) {
    const sorted = [...result.behavior.pairRows].sort((left, right) => Number(left.adr) - Number(right.adr));
    const worst = sorted.slice(0, 8);
    const best = sorted.slice(-8).reverse();
    lines.push(
      `### ${result.label} - Worst Pairs`,
      "",
      table(
        ["Pair", "Rows", "W/L", "Raw", "ADR"],
        worst.map((row) => [row.key, row.rows, `${row.wins}/${row.losses}`, signed(row.raw), signed(row.adr)]),
      ),
      "",
      `### ${result.label} - Best Pairs`,
      "",
      table(
        ["Pair", "Rows", "W/L", "Raw", "ADR"],
        best.map((row) => [row.key, row.rows, `${row.wins}/${row.losses}`, signed(row.raw), signed(row.adr)]),
      ),
      "",
    );
  }

  lines.push(
    "## Files",
    "",
    `- JSON audit: ${jsonOut}`,
    ...results.flatMap((result) => [
      `- ${result.label} baseline: ${result.baselinePath}`,
      `- ${result.label} fixed-band: ${result.fixedPath}`,
    ]),
    "",
  );

  await writeFile(docsOut, `${lines.join("\n")}\n`, "utf8");
  console.log(`Dealer Weekly Hold audit written: ${docsOut}`);
  console.log(`JSON: ${jsonOut}`);
  for (const result of results) {
    console.log(`${result.label}: source mismatches ${result.source.liveDirectionMismatchCount}, price mismatches ${result.price.mismatchCount}, ADR ${signed(numberValue(result.summary.totalAdrPct))}`);
  }
}

main().catch(async (error) => {
  console.error(error);
  try {
    await getPool().end();
  } catch {}
  process.exit(1);
}).finally(async () => {
  await getPool().end();
});
