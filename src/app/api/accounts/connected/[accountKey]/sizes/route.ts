import { NextResponse, type NextRequest } from "next/server";
import { DateTime } from "luxon";
import { PAIRS_BY_ASSET_CLASS } from "@/lib/cotPairs";
import { getOandaInstrument } from "@/lib/oandaPrices";
import { loadConnectedAccountSecretsByKey } from "@/lib/connectedAccounts";

export const runtime = "nodejs";

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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ accountKey: string }> },
) {
  try {
    const { accountKey } = await params;
    const record = await loadConnectedAccountSecretsByKey(accountKey);
    if (!record) {
      return NextResponse.json({ error: "Account not found." }, { status: 404 });
    }
    if (record.account.provider !== "oanda") {
      return NextResponse.json(
        { error: "Sizing analysis is only available for OANDA accounts." },
        { status: 400 },
      );
    }

    const secrets = record.secrets as Record<string, unknown>;
    const apiKey = secrets.apiKey as string | undefined;
    const accountId = secrets.accountId as string | undefined;
    const env = (secrets.env as "live" | "practice" | undefined) ?? "live";
    if (!apiKey || !accountId) {
      return NextResponse.json({ error: "Missing OANDA credentials." }, { status: 400 });
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
    if (!Number.isFinite(nav) || nav <= 0) {
      return NextResponse.json({ error: "Invalid NAV for sizing." }, { status: 400 });
    }

    const instrumentMap = new Map(instruments.instruments.map((inst) => [inst.name, inst]));
    const allPairs = [
      ...PAIRS_BY_ASSET_CLASS.fx,
      ...PAIRS_BY_ASSET_CLASS.indices,
      ...PAIRS_BY_ASSET_CLASS.crypto,
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
        };
      }

      const { quote } = parseInstrumentCurrencies(instrument);
      const usdPerQuote = convertToUsd(1, quote, priceMap);
      if (!usdPerQuote) {
        return {
          symbol,
          instrument,
          available: false,
          reason: "Missing USD conversion",
        };
      }

      const notionalUsdPerUnit = price * usdPerQuote;
      const rawUnits = nav / notionalUsdPerUnit;
      const precision = spec.tradeUnitsPrecision ?? 0;
      const units = Math.max(0, Number(rawUnits.toFixed(Math.max(0, precision))));
      const marginRate = Number(spec.marginRate ?? "0");
      const marginUsd = Number.isFinite(marginRate) ? nav * marginRate : null;

      return {
        symbol,
        instrument,
        available: true,
        units,
        price,
        notionalUsdPerUnit,
        marginRate: Number.isFinite(marginRate) ? marginRate : null,
        marginUsd,
      };
    });

    return NextResponse.json({
      ok: true,
      nav,
      fetched_at: DateTime.utc().toISO(),
      rows,
    });
  } catch (error) {
    console.error("Sizing analysis failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
