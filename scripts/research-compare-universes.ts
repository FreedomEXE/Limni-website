import { readFileSync, existsSync, writeFileSync } from "fs";
import { DateTime } from "luxon";
import { MyfxbookProvider } from "@/lib/sentiment/providers/myfxbook";
import { aggregateSentiment } from "@/lib/sentiment/aggregate";
import type { SentimentAggregate } from "@/lib/sentiment/types";
import type { Bias, Direction, CotSnapshot, MarketSnapshot, PairSnapshot } from "@/lib/cotTypes";
import type { AssetClass, CotSource } from "@/lib/cotMarkets";
import { PAIRS_BY_ASSET_CLASS } from "@/lib/cotPairs";
import { buildMarketSnapshot, derivePairDirections, derivePairDirectionsByBase } from "@/lib/cotCompute";
import { fetchCotRowsForDate, fetchLatestReportDate, type CotRow } from "@/lib/cotFetch";
import { getPairPerformance } from "@/lib/pricePerformance";

type UniverseReport = {
  generated_at: string;
  sentiment_symbols: string[];
  cot_currency_codes: string[];
  fx_pairs: string[];
  non_fx_symbols: string[];
  universe: string[];
  counts: {
    sentiment_total: number;
    cot_currencies: number;
    fx_pairs: number;
    non_fx: number;
    universe: number;
  };
};

type MarketDef = {
  id: string;
  keywords: string[];
};

type PairDef = {
  pair: string;
  base: string;
  quote: string;
};

type UniverseConfig = {
  name: "og36" | "full56";
  fxPairs: string[];
  nonFxSymbols: string[];
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
  name: UniverseConfig["name"];
  report_date: string;
  report_dates: Record<AssetClass, string>;
  generated_at: string;
  models: ModelResult[];
  missing_prices: Record<AssetClass, string[]>;
};

const CURRENCY_MARKET_MAP: Array<{ keyword: string; code: string }> = [
  { keyword: "AUSTRALIAN DOLLAR", code: "AUD" },
  { keyword: "CANADIAN DOLLAR", code: "CAD" },
  { keyword: "SWISS FRANC", code: "CHF" },
  { keyword: "EURO FX", code: "EUR" },
  { keyword: "BRITISH POUND", code: "GBP" },
  { keyword: "JAPANESE YEN", code: "JPY" },
  { keyword: "NZ DOLLAR", code: "NZD" },
  { keyword: "MEXICAN PESO", code: "MXN" },
  { keyword: "BRAZILIAN REAL", code: "BRL" },
  { keyword: "RUSSIAN RUBLE", code: "RUB" },
  { keyword: "SOUTH AFRICAN RAND", code: "ZAR" },
  { keyword: "USD INDEX", code: "USD" },
];

const NON_FX_MARKET_MAP: Array<{ keyword: string; symbol: string; assetClass: AssetClass }> = [
  { keyword: "S&P 500", symbol: "SPXUSD", assetClass: "indices" },
  { keyword: "NASDAQ-100", symbol: "NDXUSD", assetClass: "indices" },
  { keyword: "NIKKEI", symbol: "NIKKEIUSD", assetClass: "indices" },
  { keyword: "DOW JONES INDUSTRIAL", symbol: "US30", assetClass: "indices" },
  { keyword: "RUSSELL 2000", symbol: "US2000", assetClass: "indices" },
  { keyword: "GOLD", symbol: "XAUUSD", assetClass: "commodities" },
  { keyword: "SILVER", symbol: "XAGUSD", assetClass: "commodities" },
  { keyword: "CRUDE OIL", symbol: "WTIUSD", assetClass: "commodities" },
  { keyword: "BRENT", symbol: "XBRUSD", assetClass: "commodities" },
  { keyword: "COPPER", symbol: "COPPER", assetClass: "commodities" },
  { keyword: "NATURAL GAS", symbol: "XNGUSD", assetClass: "commodities" },
  { keyword: "PLATINUM", symbol: "XPTUSD", assetClass: "commodities" },
  { keyword: "PALLADIUM", symbol: "XPDUSD", assetClass: "commodities" },
  { keyword: "WHEAT", symbol: "WHEAT", assetClass: "commodities" },
  { keyword: "COFFEE", symbol: "COFFEE", assetClass: "commodities" },
  { keyword: "SUGAR", symbol: "SUGAR", assetClass: "commodities" },
  { keyword: "COTTON", symbol: "COTTON", assetClass: "commodities" },
  { keyword: "COCOA", symbol: "COCOA", assetClass: "commodities" },
  { keyword: "BITCOIN", symbol: "BTCUSD", assetClass: "crypto" },
  { keyword: "ETHER", symbol: "ETHUSD", assetClass: "crypto" },
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

function ensureEnv() {
  if (!process.env.MYFXBOOK_EMAIL || !process.env.MYFXBOOK_PASSWORD) {
    if (existsSync(".env")) {
      const envText = readFileSync(".env", "utf-8");
      envText.split(/\r?\n/).forEach((line) => {
        if (!line || line.trim().startsWith("#")) return;
        const idx = line.indexOf("=");
        if (idx === -1) return;
        const key = line.slice(0, idx).trim();
        const value = line.slice(idx + 1).trim();
        if (!process.env[key]) {
          process.env[key] = value;
        }
      });
    }
  }
}

async function fetchDistinctContractNames(dataset: string): Promise<string[]> {
  const baseUrl = `https://publicreporting.cftc.gov/resource/${dataset}.json`;
  const names = new Set<string>();
  let offset = 0;
  const limit = 1000;
  while (true) {
    const url = new URL(baseUrl);
    url.searchParams.set("$select", "distinct(contract_market_name)");
    url.searchParams.set("$limit", String(limit));
    url.searchParams.set("$offset", String(offset));
    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`CFTC dataset fetch failed (${dataset}): ${response.statusText}`);
    }
    const data = (await response.json()) as Array<{ contract_market_name?: string }>;
    if (data.length === 0) {
      break;
    }
    data.forEach((row) => {
      const value = row.contract_market_name;
      if (value) {
        names.add(value.toUpperCase());
      }
    });
    if (data.length < limit) {
      break;
    }
    offset += limit;
  }
  return Array.from(names.values());
}

function toFxPair(symbol: string) {
  if (symbol.length !== 6) return null;
  return { base: symbol.slice(0, 3), quote: symbol.slice(3) };
}

function sentimentDirection(agg?: SentimentAggregate): Direction | null {
  if (!agg) return null;
  if (agg.flip_state === "FLIPPED_UP") return "LONG";
  if (agg.flip_state === "FLIPPED_DOWN") return "SHORT";
  if (agg.flip_state === "FLIPPED_NEUTRAL") return null;
  if (agg.crowding_state === "CROWDED_LONG") return "SHORT";
  if (agg.crowding_state === "CROWDED_SHORT") return "LONG";
  return null;
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

function getNonFxAssetClass(symbol: string): AssetClass | null {
  const match = NON_FX_MARKET_MAP.find((item) => item.symbol === symbol);
  return match ? match.assetClass : null;
}

function getSymbolAssetClass(symbol: string, nonFxSet: Set<string>): AssetClass {
  const nonFxAsset = getNonFxAssetClass(symbol);
  if (nonFxAsset) return nonFxAsset;
  if (nonFxSet.has(symbol)) return "commodities";
  if (symbol.length === 6 && toFxPair(symbol)) {
    return "fx";
  }
  return "commodities";
}

function buildNonFxPairDefs(symbols: string[]): PairDef[] {
  return symbols.map((symbol) => {
    const base = SYMBOL_BASE_OVERRIDES[symbol] ?? symbol;
    return { pair: symbol, base, quote: "USD" };
  });
}

function getPairsByAssetClass(pairDefs: PairDef[], nonFxSet: Set<string>): Record<AssetClass, PairDef[]> {
  const grouped: Record<AssetClass, PairDef[]> = {
    fx: [],
    indices: [],
    crypto: [],
    commodities: [],
  };
  for (const def of pairDefs) {
    const assetClass = getSymbolAssetClass(def.pair, nonFxSet);
    grouped[assetClass].push(def);
  }
  return grouped;
}

function biasFromNet(net: number): Bias {
  if (net > 0) return "BULLISH";
  if (net < 0) return "BEARISH";
  return "NEUTRAL";
}

function sentimentAligned(direction: Direction, agg?: SentimentAggregate): boolean {
  if (!agg || direction === "NEUTRAL") return false;
  const aligned = sentimentDirection(agg);
  return aligned !== null && aligned === direction;
}

function getPositions(row: CotRow, source: CotSource): [number, number] {
  if (source === "tff") {
    return [
      Number(row.dealer_positions_long_all),
      Number(row.dealer_positions_short_all),
    ];
  }
  if (source === "legacy") {
    return [
      Number(row.comm_positions_long_all),
      Number(row.comm_positions_short_all),
    ];
  }
  return [
    Number(row.prod_merc_positions_long),
    Number(row.prod_merc_positions_short),
  ];
}

function buildMarketDefs(
  marketNames: string[],
  currencyCodes: string[],
  nonFxSymbols: string[],
): MarketDef[] {
  const defs: MarketDef[] = [];
  const unique = new Set<string>();

  for (const entry of CURRENCY_MARKET_MAP) {
    if (!currencyCodes.includes(entry.code)) continue;
    if (unique.has(entry.code)) continue;
    unique.add(entry.code);
    defs.push({ id: entry.code, keywords: [entry.keyword] });
  }

  for (const symbol of nonFxSymbols) {
    const mapping = NON_FX_MARKET_MAP.find((item) => item.symbol === symbol);
    if (!mapping) continue;
    const base = SYMBOL_BASE_OVERRIDES[symbol] ?? symbol;
    if (unique.has(base)) continue;
    unique.add(base);
    defs.push({ id: base, keywords: [mapping.keyword] });
  }

  if (!unique.has("USD")) {
    defs.push({ id: "USD", keywords: ["USD INDEX"] });
  }

  // Resolve keywords to concrete contract_market_name values
  return defs.map((def) => {
    const matches = marketNames.filter((name) =>
      def.keywords.some((keyword) => name.includes(keyword)),
    );
    return { ...def, keywords: matches.length > 0 ? matches : def.keywords };
  });
}

async function buildSnapshot(options: {
  assetClass: AssetClass;
  pairDefs: PairDef[];
  marketDefs: MarketDef[];
}): Promise<CotSnapshot> {
  const dealerSource: CotSource = "tff";
  const commercialSource: CotSource =
    options.assetClass === "commodities" ? "disaggregated" : "legacy";

  const dealerLatest = await fetchLatestReportDate(dealerSource);
  const commercialLatest = await fetchLatestReportDate(commercialSource);
  const resolvedReportDate = [dealerLatest, commercialLatest].filter(Boolean).sort().at(-1);
  if (!resolvedReportDate) {
    throw new Error("Unable to resolve COT report date.");
  }

  const marketNames = options.marketDefs.flatMap((market) => market.keywords);
  const dealerRows = await fetchCotRowsForDate(
    resolvedReportDate,
    marketNames,
    process.env.COT_VARIANT && process.env.COT_VARIANT.length > 0 ? process.env.COT_VARIANT : "FutOnly",
    dealerSource,
  );
  const commercialRows = await fetchCotRowsForDate(
    resolvedReportDate,
    marketNames,
    process.env.COT_VARIANT && process.env.COT_VARIANT.length > 0 ? process.env.COT_VARIANT : "FutOnly",
    commercialSource,
  );

  const dealerByMarket = new Map(dealerRows.map((row) => [row.contract_market_name.toUpperCase(), row]));
  const commercialByMarket = new Map(commercialRows.map((row) => [row.contract_market_name.toUpperCase(), row]));

  const currencies: Record<string, MarketSnapshot> = {};

  for (const market of options.marketDefs) {
    let dealerRow: CotRow | null = null;
    let commercialRow: CotRow | null = null;
    for (const name of market.keywords) {
      const dealerCandidate = dealerByMarket.get(name.toUpperCase());
      if (dealerCandidate) dealerRow = dealerCandidate;
      const commercialCandidate = commercialByMarket.get(name.toUpperCase());
      if (commercialCandidate) commercialRow = commercialCandidate;
      if (dealerRow && commercialRow) break;
    }

    if (!dealerRow && !commercialRow) {
      continue;
    }

    let dealerLong: number;
    let dealerShort: number;
    if (dealerRow) {
      [dealerLong, dealerShort] = getPositions(dealerRow, dealerSource);
    } else if (commercialRow) {
      [dealerLong, dealerShort] = getPositions(commercialRow, commercialSource);
    } else {
      continue;
    }

    let commercialLong: number | null = null;
    let commercialShort: number | null = null;
    if (commercialRow) {
      const [commLong, commShort] = getPositions(commercialRow, commercialSource);
      commercialLong = commLong;
      commercialShort = commShort;
    }

    if (!Number.isFinite(dealerLong) || !Number.isFinite(dealerShort)) {
      continue;
    }

    currencies[market.id] = buildMarketSnapshot(
      dealerLong,
      dealerShort,
      commercialLong,
      commercialShort,
    );
  }

  const pairs =
    options.assetClass === "fx"
      ? derivePairDirections(currencies, options.pairDefs, "blended")
      : derivePairDirectionsByBase(currencies, options.pairDefs, "blended");

  return {
    report_date: resolvedReportDate,
    last_refresh_utc: new Date().toISOString(),
    asset_class: options.assetClass,
    variant: process.env.COT_VARIANT && process.env.COT_VARIANT.length > 0 ? process.env.COT_VARIANT : "FutOnly",
    currencies,
    pairs,
  };
}

async function fetchSentiment(symbols: string[]): Promise<SentimentAggregate[]> {
  const provider = new MyfxbookProvider();
  const snapshots = await provider.fetchSentiment(symbols);
  return aggregateSentiment(snapshots);
}

function buildSentimentPairs(
  pairDefs: PairDef[],
  sentiment: SentimentAggregate[],
): Record<string, PairSnapshot> {
  const sentimentMap = new Map(sentiment.map((item) => [item.symbol, item]));
  const pairs: Record<string, PairSnapshot> = {};
  for (const def of pairDefs) {
    const dir = sentimentDirection(sentimentMap.get(def.pair));
    if (!dir) continue;
    pairs[def.pair] = {
      direction: dir,
      base_bias: biasFromNet(0),
      quote_bias: biasFromNet(0),
    };
  }
  return pairs;
}

function buildAntikytheraPairs(
  pairDefs: PairDef[],
  snapshot: CotSnapshot,
  sentiment: SentimentAggregate[],
): Record<string, PairSnapshot> {
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

async function buildPerformanceMap(
  assetClass: AssetClass,
  pairDefs: PairDef[],
  reportDate: string,
) {
  const pairs: Record<string, PairSnapshot> = {};
  for (const def of pairDefs) {
    pairs[def.pair] = { direction: "LONG", base_bias: "NEUTRAL", quote_bias: "NEUTRAL" };
  }
  return getPairPerformance(pairs, {
    assetClass,
    reportDate,
    isLatestReport: true,
  });
}

async function computeUniverse(
  universe: UniverseConfig,
  sentiment: SentimentAggregate[],
  contractNames: string[],
): Promise<UniverseResult> {
  const fxDefs = buildFxPairDefs(universe.fxPairs);
  const nonFxDefs = buildNonFxPairDefs(universe.nonFxSymbols);
  const pairDefs = [...fxDefs, ...nonFxDefs];
  const nonFxSet = new Set(universe.nonFxSymbols);
  const pairsByAsset = getPairsByAssetClass(pairDefs, nonFxSet);

  const currencyCodes = Array.from(
    new Set(
      fxDefs.flatMap((def) => [def.base, def.quote]),
    ),
  ).sort();

  const marketDefs = buildMarketDefs(contractNames, currencyCodes, universe.nonFxSymbols);

  const snapshots: Record<AssetClass, CotSnapshot> = {
    fx: await buildSnapshot({ assetClass: "fx", pairDefs: pairsByAsset.fx, marketDefs }),
    indices: await buildSnapshot({ assetClass: "indices", pairDefs: pairsByAsset.indices, marketDefs }),
    crypto: await buildSnapshot({ assetClass: "crypto", pairDefs: pairsByAsset.crypto, marketDefs }),
    commodities: await buildSnapshot({ assetClass: "commodities", pairDefs: pairsByAsset.commodities, marketDefs }),
  };

  const reportDates: Record<AssetClass, string> = {
    fx: snapshots.fx.report_date,
    indices: snapshots.indices.report_date,
    crypto: snapshots.crypto.report_date,
    commodities: snapshots.commodities.report_date,
  };

  const performanceMaps: Record<AssetClass, Awaited<ReturnType<typeof getPairPerformance>>> = {
    fx: await buildPerformanceMap("fx", pairsByAsset.fx, reportDates.fx),
    indices: await buildPerformanceMap("indices", pairsByAsset.indices, reportDates.indices),
    crypto: await buildPerformanceMap("crypto", pairsByAsset.crypto, reportDates.crypto),
    commodities: await buildPerformanceMap("commodities", pairsByAsset.commodities, reportDates.commodities),
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
      const pairDefsForClass = pairsByAsset[assetClass];
      const snapshot = snapshots[assetClass];
      const perf = performanceMaps[assetClass];
      const sentimentMap = new Map(sentiment.map((item) => [item.symbol, item]));

      let modelPairs: Record<string, PairSnapshot> = {};
      if (model === "sentiment") {
        modelPairs = buildSentimentPairs(pairDefsForClass, sentiment);
      } else if (model === "antikythera") {
        modelPairs = buildAntikytheraPairs(pairDefsForClass, snapshot, sentiment);
      } else {
        modelPairs =
          assetClass === "fx"
            ? derivePairDirections(snapshot.currencies, pairDefsForClass, model)
            : derivePairDirectionsByBase(snapshot.currencies, pairDefsForClass, model);
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
        const direction = info.direction;
        const adjusted = perfRow.percent * (direction === "LONG" ? 1 : -1);
        modelTotal += adjusted;
        totalPercent += adjusted;
        modelPriced += 1;
        priced += 1;
        if (model === "sentiment" && !sentimentMap.get(pair)) {
          // keep note in output if needed later
        }
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
    name: universe.name,
    report_date: reportDates.fx,
    report_dates: reportDates,
    generated_at: new Date().toISOString(),
    models: results,
    missing_prices: {
      fx: performanceMaps.fx.missingPairs ?? [],
      indices: performanceMaps.indices.missingPairs ?? [],
      crypto: performanceMaps.crypto.missingPairs ?? [],
      commodities: performanceMaps.commodities.missingPairs ?? [],
    },
  };
}

async function main() {
  ensureEnv();
  const raw = JSON.parse(readFileSync("data/research_universe.json", "utf-8")) as UniverseReport;
  const og36: UniverseConfig = {
    name: "og36",
    fxPairs: PAIRS_BY_ASSET_CLASS.fx.map((row) => row.pair),
    nonFxSymbols: [
      ...PAIRS_BY_ASSET_CLASS.indices.map((row) => row.pair),
      ...PAIRS_BY_ASSET_CLASS.crypto.map((row) => row.pair),
      ...PAIRS_BY_ASSET_CLASS.commodities.map((row) => row.pair),
    ],
  };

  const full56: UniverseConfig = {
    name: "full56",
    fxPairs: raw.fx_pairs,
    nonFxSymbols: raw.non_fx_symbols,
  };

  const tffNames = await fetchDistinctContractNames("gpe5-46if");
  const disaggNames = await fetchDistinctContractNames("72hh-3qpy");
  const legacyNames = await fetchDistinctContractNames("6dca-aqww");
  const contractNames = Array.from(new Set([...tffNames, ...disaggNames, ...legacyNames]));

  const sentiment = await fetchSentiment(raw.universe);

  const ogResult = await computeUniverse(og36, sentiment, contractNames);
  const fullResult = await computeUniverse(full56, sentiment, contractNames);

  const output = {
    generated_at: new Date().toISOString(),
    report_date: fullResult.report_date,
    universes: [ogResult, fullResult],
  };

  const outPath = `reports/research-universe-compare-${DateTime.utc().toISODate()}.json`;
  writeFileSync(outPath, JSON.stringify(output, null, 2));

  const lines: string[] = [];
  lines.push(`# Research Universe Comparison`);
  lines.push(`Generated: ${output.generated_at}`);
  lines.push(`Report date: ${output.report_date}`);
  for (const universe of output.universes) {
    lines.push(`\n## ${universe.name.toUpperCase()}`);
    for (const model of universe.models) {
      lines.push(
        `- ${model.model}: total=${model.total_percent.toFixed(2)}% | priced=${model.priced}/${model.total} | missing=${model.missing}`,
      );
    }
  }
  const mdPath = outPath.replace(/\.json$/, ".md");
  writeFileSync(mdPath, lines.join("\n"));

  console.log(`Wrote ${outPath}`);
  console.log(`Wrote ${mdPath}`);
}

main().catch((error) => {
  console.error("Failed to compare research universes:", error);
  process.exit(1);
});
