import { MyfxbookProvider } from "@/lib/sentiment/providers/myfxbook";
import { writeFileSync, readFileSync, existsSync } from "fs";
import { DateTime } from "luxon";

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
  debug: {
    cot_currency_markets: string[];
    cot_non_fx_markets: string[];
    unmapped_markets: string[];
  };
};

const CFTC_TFF_DATASET = "gpe5-46if";
const CFTC_DISAGG_DATASET = "72hh-3qpy";

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
  { keyword: "SWEDISH KRONA", code: "SEK" },
  { keyword: "NORWEGIAN KRONE", code: "NOK" },
  { keyword: "HONG KONG DOLLAR", code: "HKD" },
  { keyword: "SINGAPORE DOLLAR", code: "SGD" },
  { keyword: "CHINESE YUAN", code: "CNH" },
  { keyword: "KOREAN WON", code: "KRW" },
  { keyword: "CZECH KORUNA", code: "CZK" },
  { keyword: "HUNGARIAN FORINT", code: "HUF" },
  { keyword: "POLISH ZLOTY", code: "PLN" },
  { keyword: "TURKISH LIRA", code: "TRY" },
  { keyword: "USD INDEX", code: "USD" },
];

const NON_FX_MARKET_MAP: Array<{ keyword: string; symbol: string }> = [
  { keyword: "S&P 500", symbol: "SPXUSD" },
  { keyword: "NASDAQ-100", symbol: "NDXUSD" },
  { keyword: "NIKKEI", symbol: "NIKKEIUSD" },
  { keyword: "DOW JONES INDUSTRIAL", symbol: "US30" },
  { keyword: "RUSSELL 2000", symbol: "US2000" },
  // VIX is not tradable in our system; exclude on purpose.
  { keyword: "GOLD", symbol: "XAUUSD" },
  { keyword: "SILVER", symbol: "XAGUSD" },
  { keyword: "CRUDE OIL", symbol: "WTIUSD" },
  { keyword: "BRENT", symbol: "XBRUSD" },
  { keyword: "COPPER", symbol: "COPPER" },
  { keyword: "NATURAL GAS", symbol: "XNGUSD" },
  { keyword: "PLATINUM", symbol: "XPTUSD" },
  { keyword: "PALLADIUM", symbol: "XPDUSD" },
  { keyword: "SOYBEANS", symbol: "SOYBEAN" },
  { keyword: "CORN", symbol: "CORN" },
  { keyword: "WHEAT", symbol: "WHEAT" },
  { keyword: "COFFEE", symbol: "COFFEE" },
  { keyword: "SUGAR", symbol: "SUGAR" },
  { keyword: "COTTON", symbol: "COTTON" },
  { keyword: "COCOA", symbol: "COCOA" },
  { keyword: "BITCOIN", symbol: "BTCUSD" },
  { keyword: "ETHER", symbol: "ETHUSD" },
];

async function fetchAllMarketNames(dataset: string): Promise<string[]> {
  const baseUrl = `https://publicreporting.cftc.gov/resource/${dataset}.json`;
  const names = new Set<string>();
  let offset = 0;
  const limit = 1000;
  while (true) {
    const url = new URL(baseUrl);
    url.searchParams.set("$select", "distinct(market_and_exchange_names)");
    url.searchParams.set("$limit", String(limit));
    url.searchParams.set("$offset", String(offset));
    const response = await fetch(url.toString());
    if (!response.ok) {
      throw new Error(`CFTC dataset fetch failed (${dataset}): ${response.statusText}`);
    }
    const data = (await response.json()) as Array<{
      market_and_exchange_names?: string;
      market_and_exchange_names_1?: string;
    }>;
    if (data.length === 0) {
      break;
    }
    data.forEach((row) => {
      const value = row.market_and_exchange_names ?? row.market_and_exchange_names_1;
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

function normalizeSymbol(raw: string) {
  return raw.replace("/", "").toUpperCase();
}

function toFxPair(symbol: string) {
  if (symbol.length !== 6) return null;
  const base = symbol.slice(0, 3);
  const quote = symbol.slice(3);
  return { base, quote };
}

async function main() {
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

  const provider = new MyfxbookProvider();
  const outlook = await provider.fetchOutlookRaw();
  if (!outlook.parsed?.symbols) {
    throw new Error(`Myfxbook outlook failed: ${outlook.parse_error ?? outlook.body_excerpt}`);
  }
  const rawSymbols = outlook.parsed.symbols.map((symbol) => symbol.name);
  const mappingDebug = provider.getSymbolMappingDebug(rawSymbols);
  const sentimentSymbols = Array.from(
    new Set(mappingDebug.map((item) => item.mapped_symbol))
  ).sort();

  const tffMarkets = await fetchAllMarketNames(CFTC_TFF_DATASET);
  const disaggMarkets = await fetchAllMarketNames(CFTC_DISAGG_DATASET);
  const allMarkets = Array.from(new Set([...tffMarkets, ...disaggMarkets]));

  const currencyCodes = new Set<string>();
  const currencyMarkets: string[] = [];
  for (const market of allMarkets) {
    const match = CURRENCY_MARKET_MAP.find((entry) => market.includes(entry.keyword));
    if (match) {
      currencyCodes.add(match.code);
      currencyMarkets.push(market);
    }
  }

  const nonFxSymbols = new Set<string>();
  const nonFxMarkets: string[] = [];
  const unmappedMarkets: string[] = [];
  for (const market of allMarkets) {
    const match = NON_FX_MARKET_MAP.find((entry) => market.includes(entry.keyword));
    if (match) {
      nonFxMarkets.push(market);
      if (sentimentSymbols.includes(match.symbol)) {
        nonFxSymbols.add(match.symbol);
      }
      continue;
    }
    if (
      market.includes("S&P 500") ||
      market.includes("NASDAQ") ||
      market.includes("NIKKEI") ||
      market.includes("GOLD") ||
      market.includes("SILVER") ||
      market.includes("CRUDE OIL") ||
      market.includes("COPPER") ||
      market.includes("NATURAL GAS")
    ) {
      unmappedMarkets.push(market);
    }
  }

  const fxPairs = sentimentSymbols.filter((symbol) => {
    const fx = toFxPair(symbol);
    if (!fx) return false;
    return currencyCodes.has(fx.base) && currencyCodes.has(fx.quote);
  });

  const universe = Array.from(new Set([...fxPairs, ...nonFxSymbols])).sort();

  const report: UniverseReport = {
    generated_at: DateTime.utc().toISO(),
    sentiment_symbols: sentimentSymbols,
    cot_currency_codes: Array.from(currencyCodes.values()).sort(),
    fx_pairs: fxPairs.sort(),
    non_fx_symbols: Array.from(nonFxSymbols.values()).sort(),
    universe,
    counts: {
      sentiment_total: sentimentSymbols.length,
      cot_currencies: currencyCodes.size,
      fx_pairs: fxPairs.length,
      non_fx: nonFxSymbols.size,
      universe: universe.length,
    },
    debug: {
      cot_currency_markets: Array.from(new Set(currencyMarkets)).sort(),
      cot_non_fx_markets: Array.from(new Set(nonFxMarkets)).sort(),
      unmapped_markets: Array.from(new Set(unmappedMarkets)).sort(),
    },
  };

  writeFileSync("data/research_universe.json", JSON.stringify(report, null, 2));
  console.log("Research universe written to data/research_universe.json");
  console.log(`Universe count: ${report.counts.universe}`);
  console.log(`FX pairs: ${report.counts.fx_pairs}, Non-FX: ${report.counts.non_fx}`);
}

main().catch((error) => {
  console.error("Failed to build research universe:", error);
  process.exit(1);
});
