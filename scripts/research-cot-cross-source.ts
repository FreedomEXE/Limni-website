/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: research-cot-cross-source.ts
 *
 * Description:
 * Cross-source FX COT research using dealer, commercial, legacy
 * non-commercial, and leveraged money data. Tests agreement/divergence
 * structures across neutral, non-neutral, and full-book segments.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { writeFileSync } from "node:fs";
import { DateTime } from "luxon";
import { deriveCotReportDate, listDataSectionWeeks } from "../src/lib/dataSectionWeeks";
import { derivePairDirectionsWithNeutral } from "../src/lib/cotCompute";
import { PAIRS_BY_ASSET_CLASS } from "../src/lib/cotPairs";
import { readSnapshot } from "../src/lib/cotStore";
import type { MarketSnapshot } from "../src/lib/cotTypes";
import { getAdrPct, getTargetAdrPct, loadWeeklyAdrMap } from "../src/lib/performance/adrLookup";
import { getWeeklyPairReturns } from "../src/lib/pairReturns";
import { getDisplayWeekOpenUtc, normalizeWeekOpenUtc } from "../src/lib/weekAnchor";

const OUTPUT_PATH = "docs/COT_CROSS_SOURCE_RESEARCH_RESULTS_2026-04-04.md";

type Direction = "LONG" | "SHORT";
type SegmentKey = "neutral" | "nonNeutral" | "full";

type CurrencySummaryRow = {
  weekLabel: string;
  currency: string;
  dealerNet: number;
  commNet: number | null;
  noncommNet: number | null;
  assetMgrNet: number | null;
  levMoneyNet: number | null;
  nonreptNet: number | null;
  dealerDeltaNet: number | null;
  commDeltaNet: number | null;
  noncommDeltaNet: number | null;
};

type PairWeekRow = {
  weekOpenUtc: string;
  weekLabel: string;
  pair: string;
  base: string;
  quote: string;
  rawReturnPct: number;
  adrMultiplier: number;
  dealerDirection: Direction | null;
  dealerLeanDirection: Direction | null;
  dealerDeltaDirection: Direction | null;
  dealerOiConfirmedDirection: Direction | null;
  commercialDirection: Direction | null;
  commercialDeltaDirection: Direction | null;
  noncommDirection: Direction | null;
  noncommDeltaDirection: Direction | null;
  assetMgrDirection: Direction | null;
  levMoneyDirection: Direction | null;
  nonreptDirection: Direction | null;
  pairOiDelta: number | null;
  commTraderImbalanceSupportsDirection: boolean;
};

type Stats = {
  label: string;
  pairs: number;
  totalReturnPct: number;
  winRatePct: number;
  avgReturnPct: number;
  notes?: string;
  vsBaselinePct?: number | null;
};

type SectionRow = {
  label: string;
  notes?: string;
  countContextOnly?: boolean;
  predicate: (row: PairWeekRow) => boolean;
  direction: (row: PairWeekRow) => Direction | null;
};

const SEGMENTS: Record<SegmentKey, { label: string; predicate: (row: PairWeekRow) => boolean }> = {
  neutral: {
    label: "Neutral",
    predicate: (row) => row.dealerDirection === null,
  },
  nonNeutral: {
    label: "Non-Neutral",
    predicate: (row) => row.dealerDirection !== null,
  },
  full: {
    label: "Full Book",
    predicate: () => true,
  },
};

function weekLabel(weekOpenUtc: string) {
  return DateTime.fromISO(weekOpenUtc, { zone: "utc" }).toFormat("MMM dd");
}

function round(value: number, digits = 2) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function directionFromScore(score: number | null | undefined): Direction | null {
  if (typeof score !== "number" || !Number.isFinite(score)) {
    return null;
  }
  if (score > 0) {
    return "LONG";
  }
  if (score < 0) {
    return "SHORT";
  }
  return null;
}

function invert(direction: Direction | null): Direction | null {
  if (direction === "LONG") {
    return "SHORT";
  }
  if (direction === "SHORT") {
    return "LONG";
  }
  return null;
}

function pairScore(
  base: MarketSnapshot,
  quote: MarketSnapshot,
  getter: (market: MarketSnapshot) => number | null | undefined,
): number | null {
  const baseValue = getter(base);
  const quoteValue = getter(quote);
  if (typeof baseValue !== "number" || typeof quoteValue !== "number") {
    return null;
  }
  return baseValue - quoteValue;
}

function oiConfirmedDealerDirection(base: MarketSnapshot, quote: MarketSnapshot): Direction | null {
  const score = pairScore(base, quote, (market) => market.dealer_delta_net);
  const direction = directionFromScore(score);
  if (!direction) {
    return null;
  }

  if (direction === "LONG") {
    const baseConfirmed =
      typeof base.dealer_delta_net === "number" &&
      base.dealer_delta_net > 0 &&
      typeof base.oi_delta === "number" &&
      base.oi_delta > 0;
    const quoteConfirmed =
      typeof quote.dealer_delta_net === "number" &&
      quote.dealer_delta_net < 0 &&
      typeof quote.oi_delta === "number" &&
      quote.oi_delta > 0;
    return baseConfirmed || quoteConfirmed ? direction : null;
  }

  const baseConfirmed =
    typeof base.dealer_delta_net === "number" &&
    base.dealer_delta_net < 0 &&
    typeof base.oi_delta === "number" &&
    base.oi_delta > 0;
  const quoteConfirmed =
    typeof quote.dealer_delta_net === "number" &&
    quote.dealer_delta_net > 0 &&
    typeof quote.oi_delta === "number" &&
    quote.oi_delta > 0;
  return baseConfirmed || quoteConfirmed ? direction : null;
}

function ratio(longValue: number | null | undefined, shortValue: number | null | undefined) {
  if (typeof longValue !== "number" || typeof shortValue !== "number" || shortValue <= 0) {
    return null;
  }
  return longValue / shortValue;
}

function supportsTraderImbalance(
  direction: Direction | null,
  base: MarketSnapshot,
  quote: MarketSnapshot,
): boolean {
  if (!direction) {
    return false;
  }

  const baseRatio = ratio(base.commercial_traders_long, base.commercial_traders_short);
  const quoteRatio = ratio(quote.commercial_traders_long, quote.commercial_traders_short);

  if (direction === "LONG") {
    return (typeof baseRatio === "number" && baseRatio > 2) ||
      (typeof quoteRatio === "number" && quoteRatio < 0.5);
  }

  return (typeof baseRatio === "number" && baseRatio < 0.5) ||
    (typeof quoteRatio === "number" && quoteRatio > 2);
}

function evaluateStats(rows: PairWeekRow[], spec: SectionRow, baselineTotal?: number): Stats {
  let pairs = 0;
  let wins = 0;
  let totalReturnPct = 0;

  for (const row of rows) {
    if (!spec.predicate(row)) {
      continue;
    }
    const direction = spec.direction(row);
    if (!direction && !spec.countContextOnly) {
      continue;
    }
    pairs += 1;
    if (!direction) {
      continue;
    }
    const ret = (direction === "SHORT" ? -row.rawReturnPct : row.rawReturnPct) * row.adrMultiplier;
    totalReturnPct += ret;
    if (ret > 0) {
      wins += 1;
    }
  }

  return {
    label: spec.label,
    pairs,
    totalReturnPct: round(totalReturnPct),
    winRatePct: pairs > 0 ? round((wins / pairs) * 100, 1) : 0,
    avgReturnPct: pairs > 0 ? round(totalReturnPct / pairs, 3) : 0,
    notes: spec.notes,
    vsBaselinePct:
      typeof baselineTotal === "number" ? round(totalReturnPct - baselineTotal) : null,
  };
}

function renderStatsTable(
  title: string,
  rows: Stats[],
  options: { includeNotes?: boolean; includeDelta?: boolean } = {},
) {
  const includeNotes = options.includeNotes ?? false;
  const includeDelta = options.includeDelta ?? false;
  const header = [
    "Signal",
    "Pairs",
    "Total%",
    "Win%",
    "Avg%",
    ...(includeDelta ? ["vs Base"] : []),
    ...(includeNotes ? ["Notes"] : []),
  ];
  const divider = header.map(() => "---");
  const lines = [`### ${title}`, "", `| ${header.join(" | ")} |`, `| ${divider.join(" | ")} |`];

  for (const row of rows) {
    const cells = [
      row.label,
      String(row.pairs),
      `${row.totalReturnPct >= 0 ? "+" : ""}${row.totalReturnPct.toFixed(2)}%`,
      `${row.winRatePct.toFixed(1)}%`,
      `${row.avgReturnPct >= 0 ? "+" : ""}${row.avgReturnPct.toFixed(3)}%`,
      ...(includeDelta
        ? [`${(row.vsBaselinePct ?? 0) >= 0 ? "+" : ""}${(row.vsBaselinePct ?? 0).toFixed(2)}%`]
        : []),
      ...(includeNotes ? [row.notes ?? ""] : []),
    ];
    lines.push(`| ${cells.join(" | ")} |`);
  }

  return lines.join("\n");
}

function assertBaseline(name: string, actual: Stats, expected: { pairs: number; total: number; win: number }) {
  const totalDiff = Math.abs(actual.totalReturnPct - expected.total);
  const winDiff = Math.abs(actual.winRatePct - expected.win);
  if (actual.pairs !== expected.pairs || totalDiff > 0.05 || winDiff > 0.2) {
    throw new Error(
      `${name} baseline mismatch. Expected ${expected.pairs} / ${expected.total.toFixed(2)} / ${expected.win.toFixed(1)}, got ${actual.pairs} / ${actual.totalReturnPct.toFixed(2)} / ${actual.winRatePct.toFixed(1)}`,
    );
  }
}

async function loadDataset() {
  const currentWeekOpenUtc = getDisplayWeekOpenUtc();
  const weeks = (await listDataSectionWeeks())
    .sort((left, right) => left.localeCompare(right))
    .filter((weekOpenUtc) => weekOpenUtc < currentWeekOpenUtc);

  const targetAdr = getTargetAdrPct();
  const currencyRows: CurrencySummaryRow[] = [];
  const pairRows: PairWeekRow[] = [];

  for (const rawWeekOpenUtc of weeks) {
    const weekOpenUtc = normalizeWeekOpenUtc(rawWeekOpenUtc) ?? rawWeekOpenUtc;
    const reportDate = deriveCotReportDate(weekOpenUtc);
    const snapshot = await readSnapshot({ assetClass: "fx", reportDate });
    if (!snapshot) {
      throw new Error(`Missing FX snapshot for ${reportDate}`);
    }

    const dealerPairs = derivePairDirectionsWithNeutral(
      snapshot.currencies,
      PAIRS_BY_ASSET_CLASS.fx,
      "dealer",
    );

    const returns = await getWeeklyPairReturns(weekOpenUtc, "fx");
    const adrMap = await loadWeeklyAdrMap(weekOpenUtc);
    const returnMap = new Map(
      returns.map((row) => {
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

    for (const currency of Object.keys(snapshot.currencies).sort()) {
      const market = snapshot.currencies[currency]!;
      currencyRows.push({
        weekLabel: weekLabel(weekOpenUtc),
        currency,
        dealerNet: market.dealer_net,
        commNet: market.commercial_net ?? null,
        noncommNet: market.noncomm_net ?? null,
        assetMgrNet: market.asset_mgr_net ?? null,
        levMoneyNet: market.lev_money_net ?? null,
        nonreptNet: market.nonrept_net ?? null,
        dealerDeltaNet: market.dealer_delta_net ?? null,
        commDeltaNet: market.commercial_delta_net ?? null,
        noncommDeltaNet: market.noncomm_delta_net ?? null,
      });
    }

    for (const pairDef of PAIRS_BY_ASSET_CLASS.fx) {
      const pair = pairDef.pair.toUpperCase();
      const base = snapshot.currencies[pairDef.base];
      const quote = snapshot.currencies[pairDef.quote];
      const ret = returnMap.get(pair);
      if (!base || !quote || !ret) {
        continue;
      }

      const dealerDirection =
        dealerPairs[pair]?.direction === "LONG" || dealerPairs[pair]?.direction === "SHORT"
          ? dealerPairs[pair]!.direction
          : null;
      const commercialDirection = directionFromScore(
        pairScore(base, quote, (market) => market.commercial_net),
      );

      pairRows.push({
        weekOpenUtc,
        weekLabel: weekLabel(weekOpenUtc),
        pair,
        base: pairDef.base,
        quote: pairDef.quote,
        rawReturnPct: ret.returnPct,
        adrMultiplier: ret.adrMultiplier,
        dealerDirection,
        dealerLeanDirection: directionFromScore(pairScore(base, quote, (market) => market.dealer_net)),
        dealerDeltaDirection: directionFromScore(
          pairScore(base, quote, (market) => market.dealer_delta_net),
        ),
        dealerOiConfirmedDirection: oiConfirmedDealerDirection(base, quote),
        commercialDirection,
        commercialDeltaDirection: directionFromScore(
          pairScore(base, quote, (market) => market.commercial_delta_net),
        ),
        noncommDirection: directionFromScore(pairScore(base, quote, (market) => market.noncomm_net)),
        noncommDeltaDirection: directionFromScore(
          pairScore(base, quote, (market) => market.noncomm_delta_net),
        ),
        assetMgrDirection: directionFromScore(pairScore(base, quote, (market) => market.asset_mgr_net)),
        levMoneyDirection: directionFromScore(pairScore(base, quote, (market) => market.lev_money_net)),
        nonreptDirection: directionFromScore(pairScore(base, quote, (market) => market.nonrept_net)),
        pairOiDelta:
          typeof base.oi_delta === "number" || typeof quote.oi_delta === "number"
            ? (base.oi_delta ?? 0) + (quote.oi_delta ?? 0)
            : null,
        commTraderImbalanceSupportsDirection: supportsTraderImbalance(commercialDirection, base, quote),
      });
    }
  }

  return { weeks, currencyRows, pairRows };
}

function bestSignal(rows: Stats[], minPairs = 1) {
  const eligible = rows.filter((row) => row.pairs >= minPairs);
  if (eligible.length === 0) {
    return null;
  }
  return [...eligible].sort((left, right) => {
    if (right.avgReturnPct !== left.avgReturnPct) {
      return right.avgReturnPct - left.avgReturnPct;
    }
    return right.pairs - left.pairs;
  })[0];
}

function renderSignalTable(
  lines: string[],
  title: string,
  rows: PairWeekRow[],
  specs: SectionRow[],
  options: { includeNotes?: boolean; includeDelta?: boolean; baselineIndex?: number } = {},
) {
  const baselineIndex = options.baselineIndex ?? 0;
  const baseline = specs[baselineIndex] ? evaluateStats(rows, specs[baselineIndex]!) : undefined;
  const stats = specs.map((spec) =>
    evaluateStats(rows, spec, options.includeDelta && baseline ? baseline.totalReturnPct : undefined),
  );
  lines.push(
    renderStatsTable(title, stats, {
      includeNotes: options.includeNotes,
      includeDelta: options.includeDelta,
    }),
  );
  lines.push("");
}

async function main() {
  console.log("╔══════════════════════════════════════════════════════════════════╗");
  console.log("║   COT Cross-Source Research                                    ║");
  console.log("╚══════════════════════════════════════════════════════════════════╝");

  const { weeks, currencyRows, pairRows } = await loadDataset();

  const dealerNonNeutralBaseline = evaluateStats(
    pairRows.filter(SEGMENTS.nonNeutral.predicate),
    {
      label: "Dealer non-neutral baseline",
      predicate: () => true,
      direction: (row) => row.dealerDirection,
    },
  );
  const dealerNeutralLeanBaseline = evaluateStats(
    pairRows.filter(SEGMENTS.neutral.predicate),
    {
      label: "Dealer neutral lean baseline",
      predicate: () => true,
      direction: (row) => row.dealerLeanDirection,
    },
  );
  const commercialForcedBaseline = evaluateStats(pairRows, {
    label: "Commercial forced-raw baseline",
    predicate: () => true,
    direction: (row) => row.commercialDirection,
  });

  assertBaseline("Dealer non-neutral", dealerNonNeutralBaseline, {
    pairs: 150,
    total: 38.03,
    win: 55.3,
  });
  assertBaseline("Dealer neutral lean", dealerNeutralLeanBaseline, {
    pairs: 130,
    total: -58.66,
    win: 34.6,
  });
  assertBaseline("Commercial forced raw", commercialForcedBaseline, {
    pairs: 280,
    total: 23.41,
    win: 52.9,
  });

  const sectionBRows: SectionRow[] = [
    {
      label: "Both agree (same direction)",
      predicate: (row) =>
        row.dealerDirection !== null &&
        row.commercialDirection !== null &&
        row.dealerDirection === row.commercialDirection,
      direction: (row) => row.dealerDirection,
    },
    {
      label: "Dealer non-neutral, comm opposite",
      predicate: (row) =>
        row.dealerDirection !== null &&
        row.commercialDirection !== null &&
        row.dealerDirection !== row.commercialDirection,
      direction: (row) => row.dealerDirection,
    },
    {
      label: "Dealer neutral, comm has dir",
      predicate: (row) => row.dealerDirection === null && row.commercialDirection !== null,
      direction: (row) => row.commercialDirection,
    },
    {
      label: "Both neutral",
      countContextOnly: true,
      predicate: (row) => row.dealerDirection === null && row.commercialDirection === null,
      direction: () => null,
      notes: "Context only",
    },
  ];

  const sectionCRows: SectionRow[] = [
    {
      label: "Comm + NonComm agree",
      predicate: (row) =>
        row.commercialDirection !== null &&
        row.noncommDirection !== null &&
        row.commercialDirection === row.noncommDirection,
      direction: (row) => row.commercialDirection,
    },
    {
      label: "Comm + NonComm diverge",
      countContextOnly: true,
      predicate: (row) =>
        row.commercialDirection !== null &&
        row.noncommDirection !== null &&
        row.commercialDirection !== row.noncommDirection,
      direction: () => null,
      notes: "Context only",
    },
    {
      label: "Diverge, use comm dir",
      predicate: (row) =>
        row.commercialDirection !== null &&
        row.noncommDirection !== null &&
        row.commercialDirection !== row.noncommDirection,
      direction: (row) => row.commercialDirection,
      notes: "Classic COT follow hedger",
    },
    {
      label: "Diverge, use noncomm dir",
      predicate: (row) =>
        row.commercialDirection !== null &&
        row.noncommDirection !== null &&
        row.commercialDirection !== row.noncommDirection,
      direction: (row) => row.noncommDirection,
      notes: "Follow spec momentum",
    },
  ];

  const sectionDRows: SectionRow[] = [
    {
      label: "Dealer + NonComm agree",
      predicate: (row) =>
        row.dealerDirection !== null &&
        row.noncommDirection !== null &&
        row.dealerDirection === row.noncommDirection,
      direction: (row) => row.dealerDirection,
    },
    {
      label: "Dealer + NonComm diverge",
      predicate: (row) =>
        row.dealerDirection !== null &&
        row.noncommDirection !== null &&
        row.dealerDirection !== row.noncommDirection,
      direction: (row) => row.dealerDirection,
    },
    {
      label: "NonComm direction on dealer neutrals",
      predicate: (row) => row.dealerDirection === null && row.noncommDirection !== null,
      direction: (row) => row.noncommDirection,
    },
    {
      label: "NonComm contrarian on dealer neutrals",
      predicate: (row) => row.dealerDirection === null && row.noncommDirection !== null,
      direction: (row) => invert(row.noncommDirection),
    },
  ];

  const sectionERows: SectionRow[] = [
    {
      label: "Dealer + Comm agree",
      predicate: (row) =>
        row.dealerDirection !== null &&
        row.commercialDirection !== null &&
        row.dealerDirection === row.commercialDirection,
      direction: (row) => row.dealerDirection,
    },
    {
      label: "Dealer + Comm + LM agree",
      predicate: (row) =>
        row.dealerDirection !== null &&
        row.commercialDirection !== null &&
        row.levMoneyDirection !== null &&
        row.dealerDirection === row.commercialDirection &&
        row.dealerDirection === row.levMoneyDirection,
      direction: (row) => row.dealerDirection,
    },
    {
      label: "Dealer + Comm agree + NC diverges",
      predicate: (row) =>
        row.dealerDirection !== null &&
        row.commercialDirection !== null &&
        row.noncommDirection !== null &&
        row.dealerDirection === row.commercialDirection &&
        row.noncommDirection !== row.dealerDirection,
      direction: (row) => row.dealerDirection,
    },
    {
      label: "Dealer + Comm + NC all agree",
      predicate: (row) =>
        row.dealerDirection !== null &&
        row.commercialDirection !== null &&
        row.noncommDirection !== null &&
        row.dealerDirection === row.commercialDirection &&
        row.dealerDirection === row.noncommDirection,
      direction: (row) => row.dealerDirection,
    },
    {
      label: "D + C agree + LM confirms + NC opposes",
      predicate: (row) =>
        row.dealerDirection !== null &&
        row.commercialDirection !== null &&
        row.levMoneyDirection !== null &&
        row.noncommDirection !== null &&
        row.dealerDirection === row.commercialDirection &&
        row.dealerDirection === row.levMoneyDirection &&
        row.noncommDirection !== row.dealerDirection,
      direction: (row) => row.dealerDirection,
    },
  ];

  const sectionFRows: SectionRow[] = [
    {
      label: "Forced raw (baseline)",
      predicate: () => true,
      direction: (row) => row.commercialDirection,
    },
    {
      label: "+ NonComm diverges (classic COT)",
      predicate: (row) =>
        row.commercialDirection !== null &&
        row.noncommDirection !== null &&
        row.commercialDirection !== row.noncommDirection,
      direction: (row) => row.commercialDirection,
    },
    {
      label: "+ NonComm agrees",
      predicate: (row) =>
        row.commercialDirection !== null &&
        row.noncommDirection !== null &&
        row.commercialDirection === row.noncommDirection,
      direction: (row) => row.commercialDirection,
    },
    {
      label: "+ NonComm delta confirms comm dir",
      predicate: (row) =>
        row.commercialDirection !== null &&
        row.noncommDeltaDirection !== null &&
        row.commercialDirection === row.noncommDeltaDirection,
      direction: (row) => row.commercialDirection,
    },
    {
      label: "+ Comm traders imbalance",
      predicate: (row) => row.commercialDirection !== null && row.commTraderImbalanceSupportsDirection,
      direction: (row) => row.commercialDirection,
    },
    {
      label: "+ Dealer agrees with comm dir",
      predicate: (row) =>
        row.commercialDirection !== null &&
        row.dealerDirection !== null &&
        row.dealerDirection === row.commercialDirection,
      direction: (row) => row.commercialDirection,
    },
    {
      label: "+ Dealer agrees + NC diverges",
      predicate: (row) =>
        row.commercialDirection !== null &&
        row.dealerDirection !== null &&
        row.noncommDirection !== null &&
        row.dealerDirection === row.commercialDirection &&
        row.noncommDirection !== row.commercialDirection,
      direction: (row) => row.commercialDirection,
    },
  ];

  const sectionGNonNeutralRows: SectionRow[] = [
    {
      label: "All non-neutral (baseline)",
      predicate: () => true,
      direction: (row) => row.dealerDirection,
    },
    {
      label: "+ Comm agrees with dealer dir",
      predicate: (row) => row.dealerDirection !== null && row.commercialDirection === row.dealerDirection,
      direction: (row) => row.dealerDirection,
    },
    {
      label: "+ Comm disagrees",
      predicate: (row) =>
        row.dealerDirection !== null &&
        row.commercialDirection !== null &&
        row.commercialDirection !== row.dealerDirection,
      direction: (row) => row.dealerDirection,
    },
    {
      label: "+ LM agrees",
      predicate: (row) => row.dealerDirection !== null && row.levMoneyDirection === row.dealerDirection,
      direction: (row) => row.dealerDirection,
    },
    {
      label: "+ LM agrees + Comm agrees",
      predicate: (row) =>
        row.dealerDirection !== null &&
        row.levMoneyDirection === row.dealerDirection &&
        row.commercialDirection === row.dealerDirection,
      direction: (row) => row.dealerDirection,
    },
    {
      label: "+ LM agrees + NC opposes",
      predicate: (row) =>
        row.dealerDirection !== null &&
        row.levMoneyDirection === row.dealerDirection &&
        row.noncommDirection !== null &&
        row.noncommDirection !== row.dealerDirection,
      direction: (row) => row.dealerDirection,
    },
    {
      label: "+ Delta confirms + Comm agrees",
      predicate: (row) =>
        row.dealerDirection !== null &&
        row.dealerDeltaDirection === row.dealerDirection &&
        row.commercialDirection === row.dealerDirection,
      direction: (row) => row.dealerDirection,
    },
  ];

  const sectionGNeutralRows: SectionRow[] = [
    {
      label: "Current lean (baseline)",
      predicate: () => true,
      direction: (row) => row.dealerLeanDirection,
    },
    {
      label: "OI-confirmed delta",
      predicate: () => true,
      direction: (row) => row.dealerOiConfirmedDirection,
    },
    {
      label: "Commercial forced-raw direction",
      predicate: () => true,
      direction: (row) => row.commercialDirection,
    },
    {
      label: "NonComm direction",
      predicate: () => true,
      direction: (row) => row.noncommDirection,
    },
    {
      label: "NonComm contrarian",
      predicate: () => true,
      direction: (row) => invert(row.noncommDirection),
    },
    {
      label: "Comm + NC diverge → use comm dir",
      predicate: (row) =>
        row.commercialDirection !== null &&
        row.noncommDirection !== null &&
        row.commercialDirection !== row.noncommDirection,
      direction: (row) => row.commercialDirection,
    },
    {
      label: "Comm direction + OI confirms",
      predicate: (row) =>
        row.commercialDirection !== null &&
        row.dealerOiConfirmedDirection !== null &&
        row.commercialDirection === row.dealerOiConfirmedDirection,
      direction: (row) => row.commercialDirection,
    },
  ];

  const lines: string[] = [];
  lines.push("# COT Cross-Source Research");
  lines.push("");
  lines.push(`Weeks analyzed: ${weeks.length} (${weekLabel(weeks[0]!)} → ${weekLabel(weeks.at(-1)!)}).`);
  lines.push("");
  lines.push("## Baseline Checks");
  lines.push("");
  lines.push("| Baseline | Pairs | Total% | Win% | Avg% |");
  lines.push("| --- | ---: | ---: | ---: | ---: |");
  for (const baseline of [dealerNonNeutralBaseline, dealerNeutralLeanBaseline, commercialForcedBaseline]) {
    lines.push(
      `| ${baseline.label} | ${baseline.pairs} | ${baseline.totalReturnPct >= 0 ? "+" : ""}${baseline.totalReturnPct.toFixed(2)}% | ${baseline.winRatePct.toFixed(1)}% | ${baseline.avgReturnPct >= 0 ? "+" : ""}${baseline.avgReturnPct.toFixed(3)}% |`,
    );
  }

  lines.push("");
  lines.push("## Section A: Full Participant Summary");
  lines.push("");
  lines.push("| Week | CCY | Dealer_Net | Comm_Net | NonComm_Net | AM_Net | LM_Net | NonR_Net | D_Δ | C_Δ | NC_Δ |");
  lines.push("| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |");
  for (const row of currencyRows) {
    lines.push(
      `| ${row.weekLabel} | ${row.currency} | ${row.dealerNet} | ${row.commNet ?? ""} | ${row.noncommNet ?? ""} | ${row.assetMgrNet ?? ""} | ${row.levMoneyNet ?? ""} | ${row.nonreptNet ?? ""} | ${row.dealerDeltaNet ?? ""} | ${row.commDeltaNet ?? ""} | ${row.noncommDeltaNet ?? ""} |`,
    );
  }

  lines.push("");
  lines.push("## Section B: Dealer vs Commercial Agreement");
  lines.push("");
  for (const segment of Object.values(SEGMENTS)) {
    renderSignalTable(lines, segment.label, pairRows.filter(segment.predicate), sectionBRows, {
      includeNotes: true,
    });
  }

  lines.push("## Section C: Commercial vs Non-Commercial Divergence");
  lines.push("");
  for (const segment of Object.values(SEGMENTS)) {
    renderSignalTable(lines, segment.label, pairRows.filter(segment.predicate), sectionCRows, {
      includeNotes: true,
    });
  }

  lines.push("## Section D: Dealer vs Non-Commercial Cross-Check");
  lines.push("");
  for (const segment of Object.values(SEGMENTS)) {
    renderSignalTable(lines, segment.label, pairRows.filter(segment.predicate), sectionDRows);
  }

  lines.push("## Section E: Smart Money Alignment Structures");
  lines.push("");
  for (const segment of Object.values(SEGMENTS)) {
    renderSignalTable(lines, segment.label, pairRows.filter(segment.predicate), sectionERows);
  }

  lines.push("## Section F: Enriched Commercial Quality");
  lines.push("");
  for (const segment of Object.values(SEGMENTS)) {
    renderSignalTable(lines, segment.label, pairRows.filter(segment.predicate), sectionFRows, {
      includeDelta: true,
    });
  }

  lines.push("## Section G: Enriched Dealer Quality");
  lines.push("");
  for (const segment of Object.values(SEGMENTS)) {
    const segmentRows = pairRows.filter(segment.predicate);
    lines.push(`### ${segment.label} — Non-Neutral Filters`);
    lines.push("");
    renderSignalTable(lines, "Signals", segmentRows, sectionGNonNeutralRows, {
      includeDelta: true,
    });
  }

  lines.push("### Dealer Neutral Resolution");
  lines.push("");
  renderSignalTable(lines, "Signals", pairRows.filter(SEGMENTS.neutral.predicate), sectionGNeutralRows, {
    includeDelta: true,
  });

  const bestCommercial = bestSignal(
    sectionFRows.slice(1).map((spec) =>
      evaluateStats(pairRows, spec, commercialForcedBaseline.totalReturnPct),
    ),
    10,
  );
  const bestDealerNonNeutral = bestSignal(
    sectionGNonNeutralRows.slice(1).map((spec) =>
      evaluateStats(pairRows.filter(SEGMENTS.nonNeutral.predicate), spec, dealerNonNeutralBaseline.totalReturnPct),
    ),
    10,
  );
  const bestDealerNeutral = bestSignal(
    sectionGNeutralRows.slice(1).map((spec) =>
      evaluateStats(pairRows.filter(SEGMENTS.neutral.predicate), spec, dealerNeutralLeanBaseline.totalReturnPct),
    ),
    10,
  );
  const bestStructure = bestSignal(sectionERows.map((spec) => evaluateStats(pairRows, spec)), 5);
  const bestDealerCommRelationship = bestSignal(sectionBRows.map((spec) => evaluateStats(pairRows, spec)), 5);

  lines.push("## Summary");
  lines.push("");
  lines.push(`1. Dealer + commercial agreement research was led by \`${bestDealerCommRelationship?.label ?? "no material agreement slice"}\`, while the best non-neutral dealer quality filter was \`${bestDealerNonNeutral?.label ?? "no qualifying filter"}\`.`);
  lines.push(`2. Commercial vs non-commercial divergence ${bestCommercial && bestCommercial.totalReturnPct > commercialForcedBaseline.totalReturnPct ? "did" : "did not"} beat the forced-raw commercial baseline on the full book. Best meaningful commercial slice: \`${bestCommercial?.label ?? "none"}\`${bestCommercial ? ` at ${bestCommercial.totalReturnPct >= 0 ? "+" : ""}${bestCommercial.totalReturnPct.toFixed(2)}%.` : "."}`);
  lines.push(`3. Dealer neutrals were resolved best by \`${bestDealerNeutral?.label ?? "no qualifying resolver"}\`${bestDealerNeutral ? `, at ${bestDealerNeutral.totalReturnPct >= 0 ? "+" : ""}${bestDealerNeutral.totalReturnPct.toFixed(2)}% and ${bestDealerNeutral.winRatePct.toFixed(1)}% WR.` : "."}`);
  lines.push(`4. The strongest multi-source alignment structure was \`${bestStructure?.label ?? "none with meaningful sample"}\`${bestStructure ? ` with ${bestStructure.pairs} pair-weeks and ${bestStructure.avgReturnPct >= 0 ? "+" : ""}${bestStructure.avgReturnPct.toFixed(3)}% average return.` : "."}`);
  lines.push(`5. The single most promising canonical upgrade candidate from this pass is \`${bestDealerNeutral?.label ?? "none"}\` for dealer gap-filling, and \`${bestDealerNonNeutral?.label ?? "none"}\` for dealer quality filtering.`);
  lines.push(`6. No result here should be treated as a final canonical change yet. This pass isolates the best cross-source candidates and tells us where dealer/commercial might improve together next.`);
  lines.push("");

  writeFileSync(OUTPUT_PATH, `${lines.join("\n")}\n`, "utf8");

  console.log(`Weeks: ${weeks.length}`);
  console.log(`Dealer non-neutral baseline: ${dealerNonNeutralBaseline.pairs} / ${dealerNonNeutralBaseline.totalReturnPct.toFixed(2)}% / ${dealerNonNeutralBaseline.winRatePct.toFixed(1)}%`);
  console.log(`Dealer neutral lean baseline: ${dealerNeutralLeanBaseline.pairs} / ${dealerNeutralLeanBaseline.totalReturnPct.toFixed(2)}% / ${dealerNeutralLeanBaseline.winRatePct.toFixed(1)}%`);
  console.log(`Commercial forced raw baseline: ${commercialForcedBaseline.pairs} / ${commercialForcedBaseline.totalReturnPct.toFixed(2)}% / ${commercialForcedBaseline.winRatePct.toFixed(1)}%`);
  console.log(
    `Best dealer non-neutral filter: ${bestDealerNonNeutral?.label ?? "none"}${bestDealerNonNeutral ? ` (${bestDealerNonNeutral.totalReturnPct.toFixed(2)}%, ${bestDealerNonNeutral.winRatePct.toFixed(1)}%)` : ""}`,
  );
  console.log(
    `Best dealer neutral resolver: ${bestDealerNeutral?.label ?? "none"}${bestDealerNeutral ? ` (${bestDealerNeutral.totalReturnPct.toFixed(2)}%, ${bestDealerNeutral.winRatePct.toFixed(1)}%)` : ""}`,
  );
  console.log(
    `Best commercial slice: ${bestCommercial?.label ?? "none"}${bestCommercial ? ` (${bestCommercial.totalReturnPct.toFixed(2)}%, ${bestCommercial.winRatePct.toFixed(1)}%)` : ""}`,
  );
  console.log(`Output written to ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
