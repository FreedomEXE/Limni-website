import { DateTime } from "luxon";
import { writeFileSync } from "fs";
import { buildBasketSignals } from "@/lib/basketSignals";
import { filterForOanda, groupSignals } from "@/lib/plannedTrades";
import { getOandaInstrument } from "@/lib/oandaPrices";
import {
  loadConnectedAccountSecrets,
  loadConnectedAccountSecretsByKey,
} from "@/lib/connectedAccounts";

const OANDA_PRACTICE_URL = "https://api-fxpractice.oanda.com";
const OANDA_LIVE_URL = "https://api-fxtrade.oanda.com";

type OandaSummary = {
  balance: string;
  NAV: string;
  marginAvailable: string;
  marginUsed: string;
  currency: string;
};

type OandaInstrument = {
  name: string;
  tradeUnitsPrecision: number;
  marginRate: string;
};

type OandaPricing = {
  instrument: string;
  closeoutBid: string;
  closeoutAsk: string;
  bids?: Array<{ price: string }>;
  asks?: Array<{ price: string }>;
};

type AccountSecrets = {
  apiKey: string;
  accountId: string;
  env?: "live" | "practice";
};

function loadEnvFromFile() {
  try {
    const text = require("fs").readFileSync(".env", "utf-8");
    text.split(/\r?\n/).forEach((line: string) => {
      if (!line || line.trim().startsWith("#") || !line.includes("=")) return;
      const idx = line.indexOf("=");
      const key = line.slice(0, idx).trim();
      const value = line.slice(idx + 1).trim();
      if (!process.env[key]) {
        process.env[key] = value;
      }
    });
  } catch {
    // ignore
  }
}

async function oandaRequest<T>(
  secrets: AccountSecrets,
  path: string,
): Promise<T> {
  const base = secrets.env === "live" ? OANDA_LIVE_URL : OANDA_PRACTICE_URL;
  const response = await fetch(`${base}${path}`, {
    headers: {
      Authorization: `Bearer ${secrets.apiKey}`,
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
  if (currency === "USD") return amount;
  const pairDirect = `${currency}_USD`;
  const pairInverse = `USD_${currency}`;
  const direct = priceMap.get(pairDirect);
  if (direct) return amount * direct;
  const inverse = priceMap.get(pairInverse);
  if (inverse) return amount / inverse;
  return null;
}

async function resolveOandaAccount(accountKey?: string) {
  if (accountKey) {
    const record = await loadConnectedAccountSecretsByKey(accountKey);
    if (!record) {
      throw new Error(`Account not found for key ${accountKey}`);
    }
    const secrets = record.secrets as Record<string, unknown>;
    return {
      accountKey: record.account.account_key,
      marginBuffer: Number((record.account.config as Record<string, unknown> | null)?.marginBuffer ?? 0.1),
      secrets: {
        apiKey: String(secrets.apiKey ?? ""),
        accountId: String(secrets.accountId ?? ""),
        env: (secrets.env as "live" | "practice" | undefined) ?? "live",
      } as AccountSecrets,
    };
  }

  const record = await loadConnectedAccountSecrets({
    provider: "oanda",
    botType: "oanda_universal",
  });
  if (!record) {
    throw new Error("No OANDA connected account found.");
  }
  const secrets = record.secrets as Record<string, unknown>;
  return {
    accountKey: record.account.account_key,
    marginBuffer: Number((record.account.config as Record<string, unknown> | null)?.marginBuffer ?? 0.1),
    secrets: {
      apiKey: String(secrets.apiKey ?? ""),
      accountId: String(secrets.accountId ?? ""),
      env: (secrets.env as "live" | "practice" | undefined) ?? "live",
    } as AccountSecrets,
  };
}

async function main() {
  loadEnvFromFile();
  const rawArgs = process.argv.slice(2);
  const onlyFx = rawArgs.includes("--fx-only");
  const accountKey = rawArgs.find((arg) => !arg.startsWith("-"));
  const { accountKey: resolvedKey, marginBuffer, secrets } = await resolveOandaAccount(accountKey);

  if (!secrets.apiKey || !secrets.accountId) {
    throw new Error("Missing OANDA credentials.");
  }

  const signals = await buildBasketSignals();
  const tradeSignals = filterForOanda(signals.pairs)
    .filter((signal) => signal.direction !== "NEUTRAL")
    .filter((signal) => (onlyFx ? signal.asset_class === "fx" : true));
  const grouped = groupSignals(tradeSignals);

  const summary = await oandaRequest<{ account: OandaSummary }>(
    secrets,
    `/v3/accounts/${secrets.accountId}/summary`,
  );
  const instruments = await oandaRequest<{ instruments: OandaInstrument[] }>(
    secrets,
    `/v3/accounts/${secrets.accountId}/instruments`,
  );

  const nav = Number(summary.account.NAV ?? summary.account.balance ?? 0);
  const marginAvailable = Number(summary.account.marginAvailable ?? "0");
  const marginUsed = Number(summary.account.marginUsed ?? "0");

  const instrumentMap = new Map(instruments.instruments.map((inst) => [inst.name, inst]));
  const instrumentNames = Array.from(
    new Set(grouped.map((pair) => getOandaInstrument(pair.symbol))),
  );

  const pricing = await oandaRequest<{ prices: OandaPricing[] }>(
    secrets,
    `/v3/accounts/${secrets.accountId}/pricing?instruments=${instrumentNames.join(",")}`,
  );
  const priceMap = buildPriceMap(pricing.prices ?? []);

  let totalMargin = 0;
  let skipped = 0;
  let counted = 0;
  const perSymbol: Record<string, { net: number; marginUsd: number; marginRate: number }> = {};

  for (const pair of grouped) {
    const net = Math.abs(pair.net);
    if (net <= 0) {
      continue;
    }
    const instrument = getOandaInstrument(pair.symbol);
    const spec = instrumentMap.get(instrument);
    const price = priceMap.get(instrument);
    if (!spec || !price) {
      skipped += 1;
      continue;
    }

    const { quote } = parseInstrumentCurrencies(instrument);
    const usdPerQuote = convertToUsd(1, quote, priceMap);
    if (!usdPerQuote) {
      skipped += 1;
      continue;
    }

    const notionalUsdPerUnit = price * usdPerQuote;
    const targetNotionalUsd = nav;
    const rawUnits = targetNotionalUsd / notionalUsdPerUnit;
    const precision = spec.tradeUnitsPrecision ?? 0;
    const units = Number(rawUnits.toFixed(Math.max(0, precision)));
    const marginRate = Number(spec.marginRate ?? "0");
    if (Number.isFinite(marginRate)) {
      const marginUsd = targetNotionalUsd * marginRate * net;
      totalMargin += marginUsd;
      perSymbol[pair.symbol] = {
        net,
        marginUsd: (perSymbol[pair.symbol]?.marginUsd ?? 0) + marginUsd,
        marginRate,
      };
      counted += 1;
    }
    void units;
  }

  const buffer = nav * (1 - marginBuffer);
  const scale = totalMargin > 0 ? Math.min(1, buffer / totalMargin) : 1;
  const canCover = marginAvailable >= totalMargin;

  const output = {
    generated_at: DateTime.utc().toISO(),
    account_key: resolvedKey,
    fx_only: onlyFx,
    nav,
    margin_available: marginAvailable,
    margin_used: marginUsed,
    margin_buffer_pct: marginBuffer * 100,
    total_margin_required: totalMargin,
    scale_from_buffer: scale,
    can_cover_full_basket: canCover,
    trades_considered: counted,
    trades_skipped: skipped,
    symbols: Object.fromEntries(
      Object.entries(perSymbol).sort((a, b) => b[1].marginUsd - a[1].marginUsd),
    ),
  };

  const path = `reports/oanda-margin-check-${DateTime.utc().toISODate()}.json`;
  writeFileSync(path, JSON.stringify(output, null, 2));
  console.log(`Wrote ${path}`);
  console.log(output);
}

main().catch((error) => {
  console.error("Margin check failed:", error);
  process.exit(1);
});
