/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: backtest-strength-tiered-agreement-matrix.ts
 *
 * Description:
 * Pure research backtest for testing where strength belongs inside the
 * tiered and agreement systems. Reuses canonical basketSource truth for
 * dealer/commercial/sentiment and canonical weeklyStrength output for
 * strength. No production strategy code changes.
 *
 * Variants:
 *   - tiered_v3_baseline
 *   - tiered_4_all
 *   - tiered_3_nocomm
 *   - agree_2of3_baseline
 *   - agree_3of4
 *   - agree_2of3_nocomm
 *
 * Usage:
 *   npx tsx scripts/backtest-strength-tiered-agreement-matrix.ts
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { loadEnvConfig } from "@next/env";

import { listDataSectionWeeks } from "../src/lib/dataSectionWeeks";
import { getWeeklyPairReturns } from "../src/lib/pairReturns";
import { getCanonicalBasketWeek, filterByModel } from "../src/lib/performance/basketSource";
import { getAdrPct, getTargetAdrPct, loadWeeklyAdrMap } from "../src/lib/performance/adrLookup";
import { computeMultiWeekHold } from "../src/lib/performance/weeklyHoldEngine";
import { getStrategy, getEntryStyle, getStrengthGate } from "../src/lib/performance/strategyConfig";
import { getDisplayWeekOpenUtc } from "../src/lib/weekAnchor";
import { readWeeklyPairStrengths } from "../src/lib/strength/weeklyStrength";
import type { AssetClass } from "../src/lib/cotMarkets";

loadEnvConfig(process.cwd());

type VoteDirection = "LONG" | "SHORT";
type VoteDirectionOrNull = VoteDirection | null;
type BaseSignalId = "dealer" | "commercial" | "sentiment" | "strength";
type VariantId =
  | "tiered_v3_baseline"
  | "tiered_4_all"
  | "tiered_3_nocomm"
  | "agree_2of3_baseline"
  | "agree_3of4"
  | "agree_2of3_nocomm";

type VariantKind = "tiered" | "agreement";

type VariantConfig = {
  id: VariantId;
  label: string;
  kind: VariantKind;
  includedSignals: BaseSignalId[];
  threshold?: number;
  tierByAgreeCount?: Record<number, number>;
};

type PairVoteContext = {
  pair: string;
  assetClass: AssetClass;
  votes: Record<BaseSignalId, VoteDirectionOrNull>;
};

type PairDecision = {
  pair: string;
  assetClass: AssetClass;
  direction: VoteDirection;
  tier: number | null;
  agreementCount: number;
  votes: Record<BaseSignalId, VoteDirectionOrNull>;
  strengthDeciding: boolean;
  commercialDeciding: boolean;
};

type PairReturnRow = {
  symbol: string;
  assetClass: string;
  returnPct: number;
  openPrice: number;
  closePrice: number;
};

type AssetMetrics = {
  returnPct: number;
  trades: number;
  wins: number;
};

type VariantMetrics = {
  returnPct: number;
  maxDrawdownPct: number;
  returnToDrawdown: number | null;
  losingWeeks: number;
  worstWeekPct: number;
  avgPairsPerBasket: number;
  totalTrades: number;
  weeklyWinRate: number;
  byAssetClass: Record<string, AssetMetrics>;
  strengthDecidingPairWeeks: number;
  commercialDecidingPairWeeks: number;
};

type VariantSummary = {
  raw: VariantMetrics;
  adrNormalized: VariantMetrics;
};

type BaselineParityResult = {
  variantId: VariantId;
  rawDelta: number;
  rawDdDelta: number;
  adrDelta: number;
  adrDdDelta: number;
};

const VARIANTS: VariantConfig[] = [
  {
    id: "tiered_v3_baseline",
    label: "Tiered V3",
    kind: "tiered",
    includedSignals: ["dealer", "commercial", "sentiment"],
    tierByAgreeCount: { 3: 1, 2: 2, 1: 3 },
  },
  {
    id: "tiered_4_all",
    label: "Tiered 4-all",
    kind: "tiered",
    includedSignals: ["dealer", "commercial", "sentiment", "strength"],
    tierByAgreeCount: { 4: 1, 3: 2, 2: 3, 1: 4 },
  },
  {
    id: "tiered_3_nocomm",
    label: "Tiered 3-nocomm",
    kind: "tiered",
    includedSignals: ["dealer", "sentiment", "strength"],
    tierByAgreeCount: { 3: 1, 2: 2, 1: 3 },
  },
  {
    id: "agree_2of3_baseline",
    label: "2-of-3",
    kind: "agreement",
    includedSignals: ["dealer", "commercial", "sentiment"],
    threshold: 2,
  },
  {
    id: "agree_3of4",
    label: "3-of-4",
    kind: "agreement",
    includedSignals: ["dealer", "commercial", "sentiment", "strength"],
    threshold: 3,
  },
  {
    id: "agree_2of3_nocomm",
    label: "2-of-3 nocomm",
    kind: "agreement",
    includedSignals: ["dealer", "sentiment", "strength"],
    threshold: 2,
  },
];

function formatSigned(value: number) {
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function round(value: number, digits = 2) {
  const scale = 10 ** digits;
  return Math.round(value * scale) / scale;
}

function countVotes(votes: Record<BaseSignalId, VoteDirectionOrNull>, signalIds: BaseSignalId[]) {
  let longs = 0;
  let shorts = 0;
  for (const signalId of signalIds) {
    if (votes[signalId] === "LONG") longs += 1;
    if (votes[signalId] === "SHORT") shorts += 1;
  }
  return { longs, shorts };
}

function resolvePairDecision(
  context: PairVoteContext,
  variant: VariantConfig,
): Omit<PairDecision, "strengthDeciding" | "commercialDeciding"> | null {
  const { longs, shorts } = countVotes(context.votes, variant.includedSignals);
  if (longs === 0 && shorts === 0) return null;
  if (longs === shorts) return null;

  if (variant.kind === "tiered") {
    const agreementCount = Math.max(longs, shorts);
    const tier = variant.tierByAgreeCount?.[agreementCount] ?? null;
    if (tier === null) return null;
    return {
      pair: context.pair,
      assetClass: context.assetClass,
      direction: longs > shorts ? "LONG" : "SHORT",
      tier,
      agreementCount,
      votes: context.votes,
    };
  }

  const threshold = variant.threshold ?? 0;
  if (longs >= threshold && longs > shorts) {
    return {
      pair: context.pair,
      assetClass: context.assetClass,
      direction: "LONG",
      tier: null,
      agreementCount: longs,
      votes: context.votes,
    };
  }
  if (shorts >= threshold && shorts > longs) {
    return {
      pair: context.pair,
      assetClass: context.assetClass,
      direction: "SHORT",
      tier: null,
      agreementCount: shorts,
      votes: context.votes,
    };
  }
  return null;
}

function isDecidingVote(
  context: PairVoteContext,
  variant: VariantConfig,
  signalId: BaseSignalId,
): boolean {
  if (!variant.includedSignals.includes(signalId)) return false;
  if (context.votes[signalId] === null) return false;

  const original = resolvePairDecision(context, variant);
  if (!original) return false;

  const modifiedContext: PairVoteContext = {
    ...context,
    votes: {
      ...context.votes,
      [signalId]: null,
    },
  };
  const modified = resolvePairDecision(modifiedContext, variant);
  return original.direction !== modified?.direction || original.tier !== modified?.tier;
}

function buildContextsForVariant(
  baseMaps: Record<BaseSignalId, Map<string, { direction: VoteDirection; assetClass: AssetClass }>>,
  variant: VariantConfig,
): PairVoteContext[] {
  const pairUniverse = new Set<string>();
  for (const signalId of variant.includedSignals) {
    for (const pair of baseMaps[signalId].keys()) {
      pairUniverse.add(pair);
    }
  }

  return Array.from(pairUniverse).sort().map((pair) => {
    const dealer = baseMaps.dealer.get(pair);
    const commercial = baseMaps.commercial.get(pair);
    const sentiment = baseMaps.sentiment.get(pair);
    const strength = baseMaps.strength.get(pair);
    return {
      pair,
      assetClass:
        dealer?.assetClass
        ?? commercial?.assetClass
        ?? sentiment?.assetClass
        ?? strength?.assetClass
        ?? "fx",
      votes: {
        dealer: dealer?.direction ?? null,
        commercial: commercial?.direction ?? null,
        sentiment: sentiment?.direction ?? null,
        strength: strength?.direction ?? null,
      },
    };
  });
}

function computeMaxDrawdown(weeklyReturns: number[]) {
  let cumulative = 0;
  let peak = 0;
  let maxDrawdown = 0;
  for (const weeklyReturn of weeklyReturns) {
    cumulative += weeklyReturn;
    peak = Math.max(peak, cumulative);
    maxDrawdown = Math.min(maxDrawdown, cumulative - peak);
  }
  return maxDrawdown;
}

function ensureAssetBucket(record: Record<string, AssetMetrics>, assetClass: string) {
  if (!record[assetClass]) {
    record[assetClass] = { returnPct: 0, trades: 0, wins: 0 };
  }
  return record[assetClass]!;
}

async function buildBaseSignalMaps(weekOpenUtc: string) {
  const [basketWeek, strengthRows] = await Promise.all([
    getCanonicalBasketWeek(weekOpenUtc),
    readWeeklyPairStrengths(weekOpenUtc),
  ]);

  const maps: Record<BaseSignalId, Map<string, { direction: VoteDirection; assetClass: AssetClass }>> = {
    dealer: new Map(),
    commercial: new Map(),
    sentiment: new Map(),
    strength: new Map(),
  };

  for (const signal of filterByModel(basketWeek, "dealer")) {
    if (signal.direction === "NEUTRAL") continue;
    maps.dealer.set(signal.symbol.toUpperCase(), {
      direction: signal.direction,
      assetClass: signal.assetClass as AssetClass,
    });
  }

  for (const signal of filterByModel(basketWeek, "commercial")) {
    if (signal.direction === "NEUTRAL") continue;
    maps.commercial.set(signal.symbol.toUpperCase(), {
      direction: signal.direction,
      assetClass: signal.assetClass as AssetClass,
    });
  }

  for (const signal of filterByModel(basketWeek, "sentiment")) {
    if (signal.direction === "NEUTRAL") continue;
    maps.sentiment.set(signal.symbol.toUpperCase(), {
      direction: signal.direction,
      assetClass: signal.assetClass as AssetClass,
    });
  }

  for (const row of strengthRows) {
    if (row.compositeDirection === "NEUTRAL") continue;
    maps.strength.set(row.pair.toUpperCase(), {
      direction: row.compositeDirection,
      assetClass: row.assetClass,
    });
  }

  return maps;
}

function evaluateVariantWeek(options: {
  variant: VariantConfig;
  decisions: PairDecision[];
  pairReturns: PairReturnRow[];
  adrMap: Map<string, number>;
}) {
  const byPairReturn = new Map(
    options.pairReturns.map((row) => [row.symbol.toUpperCase(), row]),
  );

  let rawReturn = 0;
  let adrNormalizedReturn = 0;
  let wins = 0;
  let normalizedWins = 0;
  const targetAdrPct = getTargetAdrPct();
  const byAssetRaw: Record<string, AssetMetrics> = {};
  const byAssetAdr: Record<string, AssetMetrics> = {};

  for (const decision of options.decisions) {
    const pairRow = byPairReturn.get(decision.pair.toUpperCase());
    if (!pairRow) continue;

    const directedReturn = decision.direction === "SHORT" ? -pairRow.returnPct : pairRow.returnPct;
    rawReturn += directedReturn;
    if (directedReturn > 0) wins += 1;

    const pairAdrPct = getAdrPct(options.adrMap, decision.pair, decision.assetClass);
    const normalizedReturn = directedReturn * (targetAdrPct / pairAdrPct);
    adrNormalizedReturn += normalizedReturn;
    if (normalizedReturn > 0) normalizedWins += 1;

    const rawAsset = ensureAssetBucket(byAssetRaw, decision.assetClass);
    rawAsset.returnPct += directedReturn;
    rawAsset.trades += 1;
    if (directedReturn > 0) rawAsset.wins += 1;

    const adrAsset = ensureAssetBucket(byAssetAdr, decision.assetClass);
    adrAsset.returnPct += normalizedReturn;
    adrAsset.trades += 1;
    if (normalizedReturn > 0) adrAsset.wins += 1;
  }

  return {
    pairCount: options.decisions.length,
    rawReturn,
    adrNormalizedReturn,
    wins,
    normalizedWins,
    byAssetRaw,
    byAssetAdr,
    strengthDeciding: options.decisions.filter((decision) => decision.strengthDeciding).length,
    commercialDeciding: options.decisions.filter((decision) => decision.commercialDeciding).length,
  };
}

function finalizeMetrics(weeklyRows: Array<{
  returnPct: number;
  pairCount: number;
  wins: number;
  trades: number;
  strengthDeciding: number;
  commercialDeciding: number;
}>, byAssetClass: Record<string, AssetMetrics>): VariantMetrics {
  const weeklyReturns = weeklyRows.map((row) => row.returnPct);
  const totalReturnPct = weeklyReturns.reduce((sum, value) => sum + value, 0);
  const maxDrawdownPct = computeMaxDrawdown(weeklyReturns);
  const totalTrades = weeklyRows.reduce((sum, row) => sum + row.trades, 0);
  const totalWins = weeklyRows.reduce((sum, row) => sum + row.wins, 0);

  return {
    returnPct: round(totalReturnPct),
    maxDrawdownPct: round(maxDrawdownPct),
    returnToDrawdown: maxDrawdownPct < 0 ? round(totalReturnPct / Math.abs(maxDrawdownPct), 2) : null,
    losingWeeks: weeklyRows.filter((row) => row.returnPct < 0).length,
    worstWeekPct: round(Math.min(...weeklyReturns, 0)),
    avgPairsPerBasket: round(
      weeklyRows.length > 0
        ? weeklyRows.reduce((sum, row) => sum + row.pairCount, 0) / weeklyRows.length
        : 0,
    ),
    totalTrades,
    weeklyWinRate: totalTrades > 0 ? round((totalWins / totalTrades) * 100) : 0,
    byAssetClass,
    strengthDecidingPairWeeks: weeklyRows.reduce((sum, row) => sum + row.strengthDeciding, 0),
    commercialDecidingPairWeeks: weeklyRows.reduce((sum, row) => sum + row.commercialDeciding, 0),
  };
}

function printMetricsBlock(label: string, metrics: VariantMetrics) {
  console.log(
    `  ${label.padEnd(16)} ${formatSigned(metrics.returnPct).padStart(9)} | DD ${formatSigned(metrics.maxDrawdownPct).padStart(8)} | R/DD ${(metrics.returnToDrawdown ?? 0).toFixed(2).padStart(5)} | losing ${String(metrics.losingWeeks).padStart(2)} | worst ${formatSigned(metrics.worstWeekPct).padStart(8)} | avg pairs ${metrics.avgPairsPerBasket.toFixed(1).padStart(4)}`,
  );
}

function printAssetBreakdown(summary: VariantSummary) {
  for (const assetClass of ["fx", "crypto", "indices", "commodities"]) {
    const raw = summary.raw.byAssetClass[assetClass] ?? { returnPct: 0, trades: 0, wins: 0 };
    const adr = summary.adrNormalized.byAssetClass[assetClass] ?? { returnPct: 0, trades: 0, wins: 0 };
    console.log(
      `    ${assetClass.padEnd(12)} raw ${formatSigned(raw.returnPct).padStart(8)} (${String(raw.trades).padStart(3)}t) | adr ${formatSigned(adr.returnPct).padStart(8)} (${String(adr.trades).padStart(3)}t)`,
    );
  }
}

async function computeBaselineParity(
  weeks: string[],
  variantSummaries: Record<VariantId, VariantSummary>,
): Promise<BaselineParityResult[]> {
  const weeklyHold = getEntryStyle("weekly_hold");
  const adrNormalized = getStrengthGate("adr_normalized");
  const baselinePairs: Array<[VariantId, string]> = [
    ["tiered_v3_baseline", "tiered_v3"],
    ["agree_2of3_baseline", "agree_2of3"],
  ];

  const results: BaselineParityResult[] = [];

  for (const [variantId, strategyId] of baselinePairs) {
    const strategy = getStrategy(strategyId);
    if (!strategy || !weeklyHold || !adrNormalized) continue;

    const [raw, adr] = await Promise.all([
      computeMultiWeekHold(strategy, weeks, weeklyHold),
      computeMultiWeekHold(strategy, weeks, weeklyHold, adrNormalized),
    ]);

    const ours = variantSummaries[variantId];
    results.push({
      variantId,
      rawDelta: round(ours.raw.returnPct - raw.totalReturnPct, 4),
      rawDdDelta: round(ours.raw.maxDrawdownPct - raw.maxDrawdownPct, 4),
      adrDelta: round(ours.adrNormalized.returnPct - adr.totalReturnPct, 4),
      adrDdDelta: round(ours.adrNormalized.maxDrawdownPct - adr.maxDrawdownPct, 4),
    });
  }

  return results;
}

async function main() {
  const currentWeekOpenUtc = getDisplayWeekOpenUtc();
  const allWeeks = (await listDataSectionWeeks()).sort((left, right) => left.localeCompare(right));
  const closedWeeks = allWeeks.filter((week) => week < currentWeekOpenUtc).slice(-10);

  if (closedWeeks.length === 0) {
    throw new Error("No closed weeks found for the experiment window.");
  }

  console.log("=== Strength Integration Test Matrix ===\n");
  console.log(`Closed weeks analyzed: ${closedWeeks.length}`);
  console.log(`Window: ${closedWeeks[0]?.slice(0, 10)} -> ${closedWeeks[closedWeeks.length - 1]?.slice(0, 10)}\n`);

  const variantWeekRows = new Map<VariantId, Array<{
    returnPct: number;
    pairCount: number;
    wins: number;
    trades: number;
    strengthDeciding: number;
    commercialDeciding: number;
  }>>();
  const variantWeekRowsAdr = new Map<VariantId, Array<{
    returnPct: number;
    pairCount: number;
    wins: number;
    trades: number;
    strengthDeciding: number;
    commercialDeciding: number;
  }>>();
  const byAssetRaw = new Map<VariantId, Record<string, AssetMetrics>>();
  const byAssetAdr = new Map<VariantId, Record<string, AssetMetrics>>();

  for (const variant of VARIANTS) {
    variantWeekRows.set(variant.id, []);
    variantWeekRowsAdr.set(variant.id, []);
    byAssetRaw.set(variant.id, {});
    byAssetAdr.set(variant.id, {});
  }

  for (const weekOpenUtc of closedWeeks) {
    const [baseMaps, pairReturns, adrMap] = await Promise.all([
      buildBaseSignalMaps(weekOpenUtc),
      getWeeklyPairReturns(weekOpenUtc),
      loadWeeklyAdrMap(weekOpenUtc),
    ]);

    for (const variant of VARIANTS) {
      const contexts = buildContextsForVariant(baseMaps, variant);
      const decisions = contexts
        .map((context) => {
          const decision = resolvePairDecision(context, variant);
          if (!decision) return null;
          return {
            ...decision,
            strengthDeciding: isDecidingVote(context, variant, "strength"),
            commercialDeciding: isDecidingVote(context, variant, "commercial"),
          } satisfies PairDecision;
        })
        .filter((decision): decision is PairDecision => decision !== null);

      const evaluated = evaluateVariantWeek({
        variant,
        decisions,
        pairReturns,
        adrMap,
      });

      variantWeekRows.get(variant.id)!.push({
        returnPct: evaluated.rawReturn,
        pairCount: evaluated.pairCount,
        wins: evaluated.wins,
        trades: decisions.length,
        strengthDeciding: evaluated.strengthDeciding,
        commercialDeciding: evaluated.commercialDeciding,
      });
      variantWeekRowsAdr.get(variant.id)!.push({
        returnPct: evaluated.adrNormalizedReturn,
        pairCount: evaluated.pairCount,
        wins: evaluated.normalizedWins,
        trades: decisions.length,
        strengthDeciding: evaluated.strengthDeciding,
        commercialDeciding: evaluated.commercialDeciding,
      });

      const rawAssets = byAssetRaw.get(variant.id)!;
      for (const [assetClass, metrics] of Object.entries(evaluated.byAssetRaw)) {
        const bucket = ensureAssetBucket(rawAssets, assetClass);
        bucket.returnPct += metrics.returnPct;
        bucket.trades += metrics.trades;
        bucket.wins += metrics.wins;
      }

      const adrAssets = byAssetAdr.get(variant.id)!;
      for (const [assetClass, metrics] of Object.entries(evaluated.byAssetAdr)) {
        const bucket = ensureAssetBucket(adrAssets, assetClass);
        bucket.returnPct += metrics.returnPct;
        bucket.trades += metrics.trades;
        bucket.wins += metrics.wins;
      }
    }
  }

  const summaries = Object.fromEntries(
    VARIANTS.map((variant) => [
      variant.id,
      {
        raw: finalizeMetrics(variantWeekRows.get(variant.id)!, byAssetRaw.get(variant.id)!),
        adrNormalized: finalizeMetrics(variantWeekRowsAdr.get(variant.id)!, byAssetAdr.get(variant.id)!),
      } satisfies VariantSummary,
    ]),
  ) as Record<VariantId, VariantSummary>;

  const parity = await computeBaselineParity(closedWeeks, summaries);

  console.log("Parity vs engine baselines:");
  for (const row of parity) {
    console.log(
      `  ${row.variantId}: raw delta ${formatSigned(row.rawDelta)} / DD ${formatSigned(row.rawDdDelta)} | adr delta ${formatSigned(row.adrDelta)} / DD ${formatSigned(row.adrDdDelta)}`,
    );
  }

  console.log("\nHeadline results:");
  for (const variant of VARIANTS) {
    const summary = summaries[variant.id];
    console.log(`\n${variant.label}`);
    printMetricsBlock("raw", summary.raw);
    printMetricsBlock("adr_normalized", summary.adrNormalized);
    console.log(
      `  deciding votes     strength=${String(summary.raw.strengthDecidingPairWeeks).padStart(3)} | commercial=${String(summary.raw.commercialDecidingPairWeeks).padStart(3)}`,
    );
    console.log("  per-asset:");
    printAssetBreakdown(summary);
  }
}

main().catch((error) => {
  console.error("Strength integration matrix failed:", error);
  process.exit(1);
});
