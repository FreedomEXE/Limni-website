import { readFileSync, writeFileSync } from "fs";
import { DateTime } from "luxon";
import { MyfxbookProvider } from "@/lib/sentiment/providers/myfxbook";
import { aggregateSentiment } from "@/lib/sentiment/aggregate";
import type { SentimentAggregate } from "@/lib/sentiment/types";
import { buildMarketSnapshot, derivePairDirections, derivePairDirectionsByBase } from "@/lib/cotCompute";
import type { AssetClass, CotSource } from "@/lib/cotMarkets";
import type { CotSnapshot, MarketSnapshot } from "@/lib/cotTypes";
import { fetchCotRowsForDate, fetchLatestReportDate, type CotRow } from "@/lib/cotFetch";

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

type MarketDef = {
  id: string;
  marketNames: string[];
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
      if (value) names.add(value.toUpperCase());
    });
    if (data.length < limit) break;
    offset += limit;
  }
  return Array.from(names.values());
}

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

function getCurrencyCodesFromPairs(pairDefs: PairDef[]) {
  const codes = new Set<string>();
  pairDefs.forEach((def) => {
    if (def.pair.length === 6) {
      codes.add(def.base);
      codes.add(def.quote);
    }
  });
  return Array.from(codes.values()).sort();
}

function getNonFxMarketDefs(symbols: string[], contractNames: string[]): MarketDef[] {
  const defs: MarketDef[] = [];
  for (const symbol of symbols) {
    const mapping = NON_FX_MARKET_MAP.find((item) => item.symbol === symbol);
    if (!mapping) continue;
    const matches = contractNames.filter((name) => name.includes(mapping.keyword));
    if (matches.length === 0) {
      defs.push({ id: SYMBOL_BASE_OVERRIDES[symbol] ?? symbol, marketNames: [mapping.keyword] });
    } else {
      defs.push({ id: SYMBOL_BASE_OVERRIDES[symbol] ?? symbol, marketNames: matches });
    }
  }
  return defs;
}

function getCurrencyMarketDefs(codes: string[], contractNames: string[]): MarketDef[] {
  const defs: MarketDef[] = [];
  for (const code of codes) {
    const mapping = CURRENCY_MARKET_MAP.find((entry) => entry.code === code);
    if (!mapping) continue;
    const matches = contractNames.filter((name) => name.includes(mapping.keyword));
    if (matches.length === 0) {
      defs.push({ id: code, marketNames: [mapping.keyword] });
    } else {
      defs.push({ id: code, marketNames: matches });
    }
  }
  return defs;
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

async function buildSnapshot(options: {
  assetClass: AssetClass;
  marketDefs: MarketDef[];
  pairDefs: PairDef[];
}): Promise<CotSnapshot> {
  const dealerSource: CotSource = "tff";
  const commercialSource: CotSource =
    options.assetClass === "commodities" ? "disaggregated" : "legacy";

  const dealerLatest = await fetchLatestReportDate(dealerSource);
  const commercialLatest = await fetchLatestReportDate(commercialSource);
  const reportDate = [dealerLatest, commercialLatest].filter(Boolean).sort().at(-1);
  if (!reportDate) {
    throw new Error("Unable to resolve COT report date.");
  }

  const variant = process.env.COT_VARIANT && process.env.COT_VARIANT.length > 0 ? process.env.COT_VARIANT : "FutOnly";
  const marketNames = options.marketDefs.flatMap((market) => market.marketNames);
  const dealerRows = await fetchCotRowsForDate(reportDate, marketNames, variant, dealerSource);
  const commercialRows = await fetchCotRowsForDate(reportDate, marketNames, variant, commercialSource);

  const dealerByMarket = new Map(dealerRows.map((row) => [row.contract_market_name.toUpperCase(), row]));
  const commercialByMarket = new Map(commercialRows.map((row) => [row.contract_market_name.toUpperCase(), row]));

  const currencies: Record<string, MarketSnapshot> = {};
  for (const market of options.marketDefs) {
    let dealerRow: CotRow | null = null;
    let commercialRow: CotRow | null = null;
    for (const name of market.marketNames) {
      const dealerCandidate = dealerByMarket.get(name.toUpperCase());
      if (dealerCandidate) dealerRow = dealerCandidate;
      const commercialCandidate = commercialByMarket.get(name.toUpperCase());
      if (commercialCandidate) commercialRow = commercialCandidate;
      if (dealerRow && commercialRow) break;
    }
    if (!dealerRow && !commercialRow) continue;

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
    report_date: reportDate,
    last_refresh_utc: new Date().toISOString(),
    asset_class: options.assetClass,
    variant,
    currencies,
    pairs,
  };
}

async function fetchSentiment(symbols: string[]): Promise<SentimentAggregate[]> {
  const provider = new MyfxbookProvider();
  const snapshots = await provider.fetchSentiment(symbols);
  return aggregateSentiment(snapshots);
}

async function main() {
  loadEnvFromFile();
  const universe = JSON.parse(readFileSync("data/research_universe.json", "utf-8")) as UniverseReport;
  const fxDefs = buildFxPairDefs(universe.fx_pairs);
  const nonFxDefs = buildNonFxPairDefs(universe.non_fx_symbols);

  const tffNames = await fetchDistinctContractNames("gpe5-46if");
  const legacyNames = await fetchDistinctContractNames("6dca-aqww");
  const disaggNames = await fetchDistinctContractNames("72hh-3qpy");
  const contractNames = Array.from(new Set([...tffNames, ...legacyNames, ...disaggNames]));

  const currencyDefs = getCurrencyMarketDefs(getCurrencyCodesFromPairs(fxDefs), contractNames);
  const nonFxMarketDefs = getNonFxMarketDefs(universe.non_fx_symbols, contractNames);

  const snapshots: Record<AssetClass, CotSnapshot> = {
    fx: await buildSnapshot({ assetClass: "fx", marketDefs: currencyDefs, pairDefs: fxDefs }),
    indices: await buildSnapshot({ assetClass: "indices", marketDefs: nonFxMarketDefs, pairDefs: nonFxDefs.filter((d) => NON_FX_MARKET_MAP.find((m) => m.symbol === d.pair)?.assetClass === "indices") }),
    crypto: await buildSnapshot({ assetClass: "crypto", marketDefs: nonFxMarketDefs, pairDefs: nonFxDefs.filter((d) => NON_FX_MARKET_MAP.find((m) => m.symbol === d.pair)?.assetClass === "crypto") }),
    commodities: await buildSnapshot({ assetClass: "commodities", marketDefs: nonFxMarketDefs, pairDefs: nonFxDefs.filter((d) => NON_FX_MARKET_MAP.find((m) => m.symbol === d.pair)?.assetClass === "commodities") }),
  };

  const sentimentAggregates = await fetchSentiment(universe.universe);

  const output = {
    generated_at: DateTime.utc().toISO(),
    report_dates: {
      fx: snapshots.fx.report_date,
      indices: snapshots.indices.report_date,
      crypto: snapshots.crypto.report_date,
      commodities: snapshots.commodities.report_date,
    },
    snapshots,
  };

  writeFileSync("data/research_cot_snapshots.json", JSON.stringify(output, null, 2));
  writeFileSync("data/research_sentiment_aggregates.json", JSON.stringify(sentimentAggregates, null, 2));

  console.log("Wrote data/research_cot_snapshots.json");
  console.log("Wrote data/research_sentiment_aggregates.json");
}

main().catch((error) => {
  console.error("Failed to build research snapshots:", error);
  process.exit(1);
});
