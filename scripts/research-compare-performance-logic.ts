import { readFileSync, writeFileSync } from "fs";
import { DateTime } from "luxon";
import { readSnapshot } from "@/lib/cotStore";
import { getLatestAggregatesLocked } from "@/lib/sentiment/store";
import type { SentimentAggregate } from "@/lib/sentiment/types";
import { getPairPerformance } from "@/lib/pricePerformance";
import type { AssetClass } from "@/lib/cotMarkets";
import type { Bias, Direction, PairSnapshot, CotSnapshot } from "@/lib/cotTypes";
import { derivePairDirections, derivePairDirectionsByBase } from "@/lib/cotCompute";
import { PAIRS_BY_ASSET_CLASS } from "@/lib/cotPairs";

function loadEnvFromFile() {
  try {
    const text = readFileSync(".env", "utf-8");
    text.split(/\r?\n/).forEach((line) => {
      if (!line || line.trim().startsWith("#") || !line.includes("=")) return;
      const idx = line.indexOf("=");
      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    });
  } catch {
    // ignore missing .env
  }
}

type UniverseReport = {
  fx_pairs: string[];
  non_fx_symbols: string[];
  universe: string[];
};

type PairDef = {
  pair: string;
  base: string;
  quote: string;
};

type ModelKey = "antikythera" | "blended" | "dealer" | "commercial" | "sentiment";

type ModelResult = {
  model: ModelKey;
  total_percent: number;
  priced: number;
  total: number;
  missing: number;
  by_asset_class: Record<string, { percent: number; priced: number; total: number; missing: number }>;
};

type UniverseResult = {
  name: string;
  report_dates: Record<AssetClass, string>;
  generated_at: string;
  models: ModelResult[];
};

const NON_FX_MARKET_MAP: Array<{ symbol: string; assetClass: AssetClass }> = [
  { symbol: "SPXUSD", assetClass: "indices" },
  { symbol: "NDXUSD", assetClass: "indices" },
  { symbol: "NIKKEIUSD", assetClass: "indices" },
  { symbol: "US30", assetClass: "indices" },
  { symbol: "US2000", assetClass: "indices" },
  { symbol: "BTCUSD", assetClass: "crypto" },
  { symbol: "ETHUSD", assetClass: "crypto" },
  { symbol: "XAUUSD", assetClass: "commodities" },
  { symbol: "XAGUSD", assetClass: "commodities" },
  { symbol: "WTIUSD", assetClass: "commodities" },
  { symbol: "XBRUSD", assetClass: "commodities" },
  { symbol: "XNGUSD", assetClass: "commodities" },
  { symbol: "XPTUSD", assetClass: "commodities" },
  { symbol: "XPDUSD", assetClass: "commodities" },
  { symbol: "COPPER", assetClass: "commodities" },
  { symbol: "COCOA", assetClass: "commodities" },
  { symbol: "COFFEE", assetClass: "commodities" },
  { symbol: "COTTON", assetClass: "commodities" },
  { symbol: "SUGAR", assetClass: "commodities" },
  { symbol: "WHEAT", assetClass: "commodities" },
];

const SYMBOL_BASE_OVERRIDES: Record<string, string> = {
  SPXUSD: "SPX",
  NDXUSD: "NDX",
  NIKKEIUSD: "NIKKEI",
  BTCUSD: "BTC",
  ETHUSD: "ETH",
  XAUUSD: "XAU",
  XAGUSD: "XAG",
  WTIUSD: "WTI",
  XBRUSD: "XBR",
  XNGUSD: "XNG",
  XPTUSD: "XPT",
  XPDUSD: "XPD",
};

function toFxPair(symbol: string) {
  if (symbol.length !== 6) return null;
  return { base: symbol.slice(0, 3), quote: symbol.slice(3) };
}

function buildFxPairDefs(pairs: string[]): PairDef[] {
  return pairs
    .map((pair) => {
      const fx = toFxPair(pair);
      if (!fx) return null;
      return { pair, base: fx.base, quote: fx.quote };
    })
    .filter((row): row is PairDef => Boolean(row));
}

function buildNonFxPairDefs(symbols: string[]): PairDef[] {
  return symbols.map((symbol) => {
    const base = SYMBOL_BASE_OVERRIDES[symbol] ?? symbol;
    return { pair: symbol, base, quote: "USD" };
  });
}

function getNonFxAssetClass(symbol: string): AssetClass | null {
  const match = NON_FX_MARKET_MAP.find((item) => item.symbol === symbol);
  return match ? match.assetClass : null;
}

function getSymbolAssetClass(symbol: string, nonFxSet: Set<string>): AssetClass {
  const nonFxAsset = getNonFxAssetClass(symbol);
  if (nonFxAsset) return nonFxAsset;
  if (nonFxSet.has(symbol)) return "commodities";
  if (symbol.length === 6 && toFxPair(symbol)) return "fx";
  return "commodities";
}

function getPairsByAssetClass(pairDefs: PairDef[], nonFxSet: Set<string>) {
  const grouped: Record<AssetClass, PairDef[]> = {
    fx: [],
    indices: [],
    crypto: [],
    commodities: [],
  };
  for (const def of pairDefs) {
    grouped[getSymbolAssetClass(def.pair, nonFxSet)].push(def);
  }
  return grouped;
}

function sentimentDirection(agg?: SentimentAggregate): Direction | null {
  if (!agg) return null;
  if (agg.flip_state === "FLIPPED_UP") return "LONG";
  if (agg.flip_state === "FLIPPED_DOWN") return "SHORT";
  if (agg.flip_state === "FLIPPED_NEUTRAL") return null;
  if (agg.crowding_state === "CROWDED_LONG") return "SHORT";
  if (agg.crowding_state === "CROWDED_SHORT") return "LONG";
  if (agg.agg_net > 0) return "LONG";
  if (agg.agg_net < 0) return "SHORT";
  return null;
}

function sentimentAligned(direction: Direction, agg?: SentimentAggregate): boolean {
  if (!agg || direction === "NEUTRAL") return false;
  const aligned = sentimentDirection(agg);
  return aligned !== null && aligned === direction;
}

function biasFromNet(net: number): Bias {
  if (net > 0) return "BULLISH";
  if (net < 0) return "BEARISH";
  return "NEUTRAL";
}

function pairSnapshot(direction: Direction): PairSnapshot {
  return {
    direction,
    base_bias: biasFromNet(0),
    quote_bias: biasFromNet(0),
  };
}

function buildSentimentPairs(pairDefs: PairDef[], sentiment: SentimentAggregate[]) {
  const sentimentMap = new Map(sentiment.map((item) => [item.symbol, item]));
  const pairs: Record<string, PairSnapshot> = {};
  for (const def of pairDefs) {
    const dir = sentimentDirection(sentimentMap.get(def.pair));
    if (!dir) continue;
    pairs[def.pair] = pairSnapshot(dir);
  }
  return pairs;
}

function buildAntikytheraPairs(pairDefs: PairDef[], snapshot: CotSnapshot, sentiment: SentimentAggregate[]) {
  const sentimentMap = new Map(sentiment.map((item) => [item.symbol, item]));
  const derivedPairs =
    snapshot.asset_class === "fx"
      ? derivePairDirections(snapshot.currencies, pairDefs, "blended")
      : derivePairDirectionsByBase(snapshot.currencies, pairDefs, "blended");
  const pairs: Record<string, PairSnapshot> = {};
  for (const def of pairDefs) {
    const info = derivedPairs[def.pair];
    if (!info) continue;
    if (!sentimentAligned(info.direction, sentimentMap.get(def.pair))) continue;
    pairs[def.pair] = {
      direction: info.direction,
      base_bias: info.base_bias,
      quote_bias: info.quote_bias,
    };
  }
  return pairs;
}

async function computeUniverseResult(
  name: string,
  pairDefs: PairDef[],
  sentiment: SentimentAggregate[],
  researchSnapshots: Record<AssetClass, CotSnapshot> | null,
): Promise<UniverseResult> {
  const nonFxSet = new Set(pairDefs.filter((def) => def.pair.length !== 6 || !toFxPair(def.pair)).map((def) => def.pair));
  const pairsByAsset = getPairsByAssetClass(pairDefs, nonFxSet);

  const snapshots: Record<AssetClass, CotSnapshot> = researchSnapshots ?? {
    fx: await readSnapshot({ assetClass: "fx" }) as CotSnapshot,
    indices: await readSnapshot({ assetClass: "indices" }) as CotSnapshot,
    crypto: await readSnapshot({ assetClass: "crypto" }) as CotSnapshot,
    commodities: await readSnapshot({ assetClass: "commodities" }) as CotSnapshot,
  };

  const reportDates: Record<AssetClass, string> = {
    fx: snapshots.fx.report_date,
    indices: snapshots.indices.report_date,
    crypto: snapshots.crypto.report_date,
    commodities: snapshots.commodities.report_date,
  };

  const performanceMaps: Record<AssetClass, Awaited<ReturnType<typeof getPairPerformance>>> = {
    fx: await getPairPerformance(buildPairsForPerformance(pairsByAsset.fx), { assetClass: "fx", reportDate: reportDates.fx, isLatestReport: true }),
    indices: await getPairPerformance(buildPairsForPerformance(pairsByAsset.indices), { assetClass: "indices", reportDate: reportDates.indices, isLatestReport: true }),
    crypto: await getPairPerformance(buildPairsForPerformance(pairsByAsset.crypto), { assetClass: "crypto", reportDate: reportDates.crypto, isLatestReport: true }),
    commodities: await getPairPerformance(buildPairsForPerformance(pairsByAsset.commodities), { assetClass: "commodities", reportDate: reportDates.commodities, isLatestReport: true }),
  };

  const models: ModelKey[] = ["antikythera", "blended", "dealer", "commercial", "sentiment"];
  const results: ModelResult[] = [];

  for (const model of models) {
    let totalPercent = 0;
    let priced = 0;
    let total = 0;
    let missing = 0;
    const byAsset: ModelResult["by_asset_class"] = {};

    for (const assetClass of Object.keys(pairsByAsset) as AssetClass[]) {
      const defs = pairsByAsset[assetClass];
      const snapshot = snapshots[assetClass];
      const perf = performanceMaps[assetClass];
      let modelPairs: Record<string, PairSnapshot> = {};

      if (model === "sentiment") {
        modelPairs = buildSentimentPairs(defs, sentiment);
      } else if (model === "antikythera") {
        modelPairs = buildAntikytheraPairs(defs, snapshot, sentiment);
      } else {
        modelPairs =
          assetClass === "fx"
            ? derivePairDirections(snapshot.currencies, defs, model)
            : derivePairDirectionsByBase(snapshot.currencies, defs, model);
      }

      let modelTotal = 0;
      let modelPriced = 0;
      let modelMissing = 0;
      for (const [pair, info] of Object.entries(modelPairs)) {
        total += 1;
        const perfRow = perf.performance[pair];
        if (!perfRow) {
          modelMissing += 1;
          missing += 1;
          continue;
        }
        const adjusted = perfRow.percent * (info.direction === "LONG" ? 1 : -1);
        modelTotal += adjusted;
        totalPercent += adjusted;
        modelPriced += 1;
        priced += 1;
      }

      byAsset[assetClass] = {
        percent: modelTotal,
        priced: modelPriced,
        total: Object.keys(modelPairs).length,
        missing: modelMissing,
      };
    }

    results.push({
      model,
      total_percent: totalPercent,
      priced,
      total,
      missing,
      by_asset_class: byAsset,
    });
  }

  return {
    name,
    report_dates: reportDates,
    generated_at: new Date().toISOString(),
    models: results,
  };
}

function buildPairsForPerformance(defs: PairDef[]) {
  const pairs: Record<string, PairSnapshot> = {};
  for (const def of defs) {
    pairs[def.pair] = { direction: "LONG", base_bias: "NEUTRAL", quote_bias: "NEUTRAL" };
  }
  return pairs;
}

async function main() {
  loadEnvFromFile();
  const universe = JSON.parse(readFileSync("data/research_universe.json", "utf-8")) as UniverseReport;
  let sentiment = await getLatestAggregatesLocked();
  let researchSnapshots: Record<AssetClass, CotSnapshot> | null = null;
  try {
    const researchSnapRaw = JSON.parse(
      readFileSync("data/research_cot_snapshots.json", "utf-8"),
    ) as { snapshots: Record<AssetClass, CotSnapshot> };
    researchSnapshots = researchSnapRaw.snapshots;
  } catch {
    researchSnapshots = null;
  }
  try {
    const researchSentiment = JSON.parse(
      readFileSync("data/research_sentiment_aggregates.json", "utf-8"),
    ) as SentimentAggregate[];
    if (researchSentiment.length > 0) {
      sentiment = researchSentiment;
    }
  } catch {
    // fall back to DB
  }

  const ogPairDefs: PairDef[] = [
    ...PAIRS_BY_ASSET_CLASS.fx.map((row) => row),
    ...PAIRS_BY_ASSET_CLASS.indices.map((row) => row),
    ...PAIRS_BY_ASSET_CLASS.crypto.map((row) => row),
    ...PAIRS_BY_ASSET_CLASS.commodities.map((row) => row),
  ];

  const fullPairDefs: PairDef[] = [
    ...buildFxPairDefs(universe.fx_pairs),
    ...buildNonFxPairDefs(universe.non_fx_symbols),
  ];

  const ogResult = await computeUniverseResult("og36", ogPairDefs, sentiment, researchSnapshots);
  const fullResult = await computeUniverseResult("full56", fullPairDefs, sentiment, researchSnapshots);

  const output = {
    generated_at: new Date().toISOString(),
    report_dates: fullResult.report_dates,
    universes: [ogResult, fullResult],
  };

  const outPath = `reports/research-compare-performance-${DateTime.utc().toISODate()}.json`;
  writeFileSync(outPath, JSON.stringify(output, null, 2));
  const mdPath = outPath.replace(/\\.json$/, ".md");
  writeFileSync(mdPath, JSON.stringify(output, null, 2));
  console.log(`Wrote ${outPath}`);
}

main().catch((error) => {
  console.error("Failed to compare universes (performance logic):", error);
  process.exit(1);
});
