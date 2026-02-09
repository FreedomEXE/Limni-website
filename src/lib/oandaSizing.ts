import { DateTime } from "luxon";
import { PAIRS_BY_ASSET_CLASS } from "@/lib/cotPairs";
import { getOandaInstrument } from "@/lib/oandaPrices";
import { loadConnectedAccountSecretsByKey } from "@/lib/connectedAccounts";

const OANDA_PRACTICE_URL = "https://api-fxpractice.oanda.com";
const OANDA_LIVE_URL = "https://api-fxtrade.oanda.com";

type OandaPricing = {
  instrument: string;
  closeoutBid: string;
  closeoutAsk: string;
  bids?: Array<{ price: string }>;
  asks?: Array<{ price: string }>;
};

type OandaInstrument = {
  name: string;
  type: string;
  displayPrecision: number;
  pipLocation: number;
  tradeUnitsPrecision: number;
  marginRate: string;
};

async function oandaRequest<T>(
  apiKey: string,
  env: "live" | "practice",
  path: string,
): Promise<T> {
  const base = env === "live" ? OANDA_LIVE_URL : OANDA_PRACTICE_URL;
  const response = await fetch(`${base}${path}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    cache: "no-store",
  });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`OANDA request failed (${response.status}): ${body}`);
  }
  return (await response.json()) as T;
}

function buildPriceMap(prices: OandaPricing[]) {
  const map = new Map<string, number>();
  for (const price of prices) {
    const bid = Number(price.closeoutBid ?? price.bids?.[0]?.price ?? NaN);
    const ask = Number(price.closeoutAsk ?? price.asks?.[0]?.price ?? NaN);
    const mid = Number.isFinite(bid) && Number.isFinite(ask) ? (bid + ask) / 2 : NaN;
    if (Number.isFinite(mid)) {
      map.set(price.instrument, mid);
    }
  }
  return map;
}

function parseInstrumentCurrencies(instrument: string) {
  const [base, quote] = instrument.split("_");
  return { base, quote };
}

function convertToUsd(amount: number, currency: string, priceMap: Map<string, number>) {
  if (currency === "USD") {
    return amount;
  }
  const pairDirect = `${currency}_USD`;
  const pairInverse = `USD_${currency}`;
  const direct = priceMap.get(pairDirect);
  if (direct) {
    return amount * direct;
  }
  const inverse = priceMap.get(pairInverse);
  if (inverse) {
    return amount / inverse;
  }
  return null;
}

export type OandaSizingRow = {
  symbol: string;
  instrument: string;
  available: boolean;
  units?: number;
  rawUnits?: number;
  price?: number;
  notionalUsdPerUnit?: number;
  marginRate?: number | null;
  marginUsd?: number | null;
  tradeUnitsPrecision?: number;
  minUnits?: number;
  minNavUsd?: number;
  reason?: string;
};

export type OandaSizingResult = {
  ok: boolean;
  nav: number;
  marginAvailable?: number;
  marginUsed?: number;
  currency?: string;
  fetched_at: string;
  rows: OandaSizingRow[];
};

export async function buildOandaSizingForAccount(
  accountKey: string,
  options?: { symbols?: string[] },
): Promise<OandaSizingResult> {
  const record = await loadConnectedAccountSecretsByKey(accountKey);
  if (!record) {
    throw new Error("Account not found.");
  }
  if (record.account.provider !== "oanda") {
    throw new Error("Sizing analysis is only available for OANDA accounts.");
  }

  const secrets = record.secrets as Record<string, unknown>;
  const apiKey = secrets.apiKey as string | undefined;
  const accountId = secrets.accountId as string | undefined;
  const env = (secrets.env as "live" | "practice" | undefined) ?? "live";
  if (!apiKey || !accountId) {
    throw new Error("Missing OANDA credentials.");
  }

  const summary = await oandaRequest<{ account: Record<string, string> }>(
    apiKey,
    env,
    `/v3/accounts/${accountId}/summary`,
  );
  const instruments = await oandaRequest<{ instruments: OandaInstrument[] }>(
    apiKey,
    env,
    `/v3/accounts/${accountId}/instruments`,
  );

  const nav = Number(summary.account.NAV ?? summary.account.balance ?? 0);
  const marginAvailable = Number(summary.account.marginAvailable ?? NaN);
  const marginUsed = Number(summary.account.marginUsed ?? NaN);
  if (!Number.isFinite(nav) || nav <= 0) {
    throw new Error("Invalid NAV for sizing.");
  }

  const instrumentMap = new Map(instruments.instruments.map((inst) => [inst.name, inst]));
  const allPairs = options?.symbols?.length
    ? options.symbols
    : [
        ...PAIRS_BY_ASSET_CLASS.fx,
        ...PAIRS_BY_ASSET_CLASS.indices,
        ...PAIRS_BY_ASSET_CLASS.commodities,
      ].map((pair) => pair.pair);

  const instrumentList = allPairs.map((symbol) => getOandaInstrument(symbol));
  const uniqueInstruments = Array.from(new Set(instrumentList));

  const pricing = await oandaRequest<{ prices: OandaPricing[] }>(
    apiKey,
    env,
    `/v3/accounts/${accountId}/pricing?instruments=${uniqueInstruments.join(",")}`,
  );
  const priceMap = buildPriceMap(pricing.prices ?? []);

  const rows = allPairs.map((symbol) => {
    const instrument = getOandaInstrument(symbol);
    const spec = instrumentMap.get(instrument);
    const price = priceMap.get(instrument);
    if (!spec || !price) {
      return {
        symbol,
        instrument,
        available: false,
        reason: "Missing price or instrument spec",
      } as OandaSizingRow;
    }

    const { quote } = parseInstrumentCurrencies(instrument);
    const usdPerQuote = convertToUsd(1, quote, priceMap);
    if (!usdPerQuote) {
      return {
        symbol,
        instrument,
        available: false,
        reason: "Missing USD conversion",
      } as OandaSizingRow;
    }

    const notionalUsdPerUnit = price * usdPerQuote;
    const rawUnits = nav / notionalUsdPerUnit;
    const precision = spec.tradeUnitsPrecision ?? 0;
    // Never round up sizing (rounding up can cause "dust" 1-unit legs and/or over-risk).
    // Truncate to the tradeUnitsPrecision.
    const safePrecision = Math.max(0, precision);
    const factor = safePrecision > 0 ? 10 ** safePrecision : 1;
    const roundedUnits = Math.max(
      0,
      safePrecision > 0 ? Math.floor(rawUnits * factor) / factor : Math.floor(rawUnits),
    );
    const marginRate = Number(spec.marginRate ?? "0");
    const marginUsd = Number.isFinite(marginRate) ? nav * marginRate : null;
    const minUnits = precision <= 0 ? 1 : Number((1 / 10 ** precision).toFixed(precision));
    const minNavUsd = notionalUsdPerUnit * minUnits;

    return {
      symbol,
      instrument,
      available: true,
      units: roundedUnits,
      rawUnits,
      price,
      notionalUsdPerUnit,
      marginRate: Number.isFinite(marginRate) ? marginRate : null,
      marginUsd,
      tradeUnitsPrecision: precision,
      minUnits,
      minNavUsd,
      reason:
        roundedUnits >= minUnits
          ? undefined
          : `Below minimum sizing (${roundedUnits} < ${minUnits}). Will be skipped.`,
    } as OandaSizingRow;
  });

  return {
    ok: true,
    nav,
    marginAvailable: Number.isFinite(marginAvailable) ? marginAvailable : undefined,
    marginUsed: Number.isFinite(marginUsed) ? marginUsed : undefined,
    currency: summary.account.currency ?? "USD",
    fetched_at: DateTime.utc().toISO(),
    rows,
  };
}
