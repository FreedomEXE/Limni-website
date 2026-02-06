import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { DateTime } from "luxon";
import { PAIRS_BY_ASSET_CLASS } from "@/lib/cotPairs";
import { getOandaInstrument } from "@/lib/oandaPrices";
import { upsertConnectedAccount } from "@/lib/connectedAccounts";

export const runtime = "nodejs";

const OANDA_PRACTICE_URL = "https://api-fxpractice.oanda.com";
const OANDA_LIVE_URL = "https://api-fxtrade.oanda.com";
const BITGET_BASE_URL = "https://api.bitget.com";

type ConnectRequest = {
  provider: "oanda" | "bitget" | "mt5";
  label?: string;
  accountId?: string;
  apiKey?: string;
  apiSecret?: string;
  apiPassphrase?: string;
  env?: "live" | "practice" | "demo";
  productType?: string;
  leverage?: number;
  botType?: string;
  riskMode?: string;
  trailMode?: string;
  trailStartPct?: number;
  trailOffsetPct?: number;
};

function buildAccountKey(provider: string, accountId?: string) {
  if (accountId) {
    return `${provider}:${accountId}`;
  }
  return `${provider}:${crypto.randomUUID()}`;
}

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

function buildBitgetSignature(
  apiSecret: string,
  method: string,
  path: string,
  query: string,
  body: string,
  timestamp: string,
) {
  const prehash = `${timestamp}${method}${path}${query}${body}`;
  return crypto.createHmac("sha256", apiSecret).update(prehash).digest("base64");
}

async function bitgetRequest<T>(options: {
  apiKey: string;
  apiSecret: string;
  apiPassphrase: string;
  method: "GET" | "POST";
  path: string;
  query?: Record<string, string | number | boolean | undefined | null>;
  body?: Record<string, unknown> | null;
}): Promise<T> {
  const params = new URLSearchParams();
  if (options.query) {
    for (const [key, value] of Object.entries(options.query)) {
      if (value === undefined || value === null) continue;
      params.set(key, String(value));
    }
  }
  const query = params.toString() ? `?${params.toString()}` : "";
  const body = options.body ? JSON.stringify(options.body) : "";
  const timestamp = Date.now().toString();
  const signature = buildBitgetSignature(
    options.apiSecret,
    options.method,
    options.path,
    query,
    body,
    timestamp,
  );
  const response = await fetch(`${BITGET_BASE_URL}${options.path}${query}`, {
    method: options.method,
    headers: {
      "Content-Type": "application/json",
      "ACCESS-KEY": options.apiKey,
      "ACCESS-SIGN": signature,
      "ACCESS-TIMESTAMP": timestamp,
      "ACCESS-PASSPHRASE": options.apiPassphrase,
      locale: "en-US",
    },
    body: body || undefined,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Bitget request failed (${response.status}): ${text}`);
  }
  const payload = (await response.json()) as { code?: string; msg?: string; data?: T };
  if (payload.code && payload.code !== "00000") {
    throw new Error(`Bitget API error ${payload.code}: ${payload.msg ?? "Unknown error"}`);
  }
  return payload.data as T;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as ConnectRequest;
    if (!body.provider) {
      return NextResponse.json({ error: "Missing provider" }, { status: 400 });
    }

    const clean = (value?: string | null) => (typeof value === "string" ? value.trim() : value);

    if (body.provider === "mt5") {
      return NextResponse.json({
        ok: true,
        message: "MT5 is manual. Download the EA and configure push credentials.",
      });
    }

    if (body.provider === "oanda") {
      const apiKey = clean(body.apiKey);
      const accountId = clean(body.accountId);
      if (!apiKey || !accountId) {
        return NextResponse.json(
          { error: "Missing OANDA credentials" },
          { status: 400 },
        );
      }
      const env = body.env === "practice" ? "practice" : "live";
      let summary: { account: Record<string, string> };
      let instruments: { instruments: Array<{ name: string; type: string }> };
      try {
        summary = await oandaRequest<{ account: Record<string, string> }>(
          apiKey,
          env,
          `/v3/accounts/${accountId}/summary`,
        );
        instruments = await oandaRequest<{ instruments: Array<{ name: string; type: string }> }>(
          apiKey,
          env,
          `/v3/accounts/${accountId}/instruments`,
        );
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        if (env === "live" && message.includes("(401)")) {
          try {
            await oandaRequest<{ account: Record<string, string> }>(
              apiKey,
              "practice",
              `/v3/accounts/${accountId}/summary`,
            );
            return NextResponse.json(
              { error: "OANDA key appears to be PRACTICE-only. Switch Environment to Practice." },
              { status: 400 },
            );
          } catch {
            // fall through with original error
          }
        }
        throw error;
      }

      const instrumentSet = new Set(instruments.instruments.map((inst) => inst.name));
      const allPairs = [
        ...PAIRS_BY_ASSET_CLASS.fx,
        ...PAIRS_BY_ASSET_CLASS.indices,
        ...PAIRS_BY_ASSET_CLASS.crypto,
        ...PAIRS_BY_ASSET_CLASS.commodities,
      ].map((pair) => pair.pair);

      const mapped = allPairs.map((symbol) => {
        const instrument = getOandaInstrument(symbol);
        return {
          symbol,
          instrument,
          available: instrumentSet.has(instrument),
        };
      });

      const missing = mapped.filter((row) => !row.available).map((row) => row.symbol);
      const accountKey = buildAccountKey("oanda", accountId);
      const analysis = {
        nav: Number(summary.account.NAV ?? summary.account.balance ?? 0),
        balance: Number(summary.account.balance ?? 0),
        currency: summary.account.currency ?? "USD",
        mapped_count: mapped.filter((row) => row.available).length,
        missing,
        mapped,
        env,
        fetched_at: DateTime.utc().toISO(),
      };

      await upsertConnectedAccount({
        account_key: accountKey,
        provider: "oanda",
        account_id: accountId,
        label: body.label ?? "OANDA Universal Bot",
        status: env === "live" ? "LIVE" : "DEMO",
        bot_type: body.botType ?? "oanda_universal",
        risk_mode: body.riskMode ?? "1:1",
        trail_mode: body.trailMode ?? "trail",
        trail_start_pct: body.trailStartPct ?? 20,
        trail_offset_pct: body.trailOffsetPct ?? 10,
        config: {
          env,
        },
        analysis,
        secrets: {
          apiKey,
          accountId,
          env,
        },
      });

      return NextResponse.json({ ok: true, accountKey, analysis });
    }

    if (body.provider === "bitget") {
      const apiKey = clean(body.apiKey);
      const apiSecret = clean(body.apiSecret);
      const apiPassphrase = clean(body.apiPassphrase);
      if (!apiKey || !apiSecret || !apiPassphrase) {
        return NextResponse.json(
          { error: "Missing Bitget credentials" },
          { status: 400 },
        );
      }
      const productType = body.productType ?? "USDT-FUTURES";
      const account = await bitgetRequest<{ list?: Array<{ marginCoin: string; equity: string; usdtEquity?: string }> }>(
        {
          apiKey,
          apiSecret,
          apiPassphrase,
          method: "GET",
          path: "/api/v2/mix/account/accounts",
          query: { productType },
        },
      );
      const rows = account.list ?? [];
      const preferred = rows.find((row) => row.marginCoin === "USDT") ?? rows[0];
      const accountKey = buildAccountKey("bitget");
      const analysis = {
        equity: Number(preferred?.usdtEquity ?? preferred?.equity ?? 0),
        currency: "USDT",
        productType,
        leverage: body.leverage ?? 10,
        fetched_at: DateTime.utc().toISO(),
      };

      await upsertConnectedAccount({
        account_key: accountKey,
        provider: "bitget",
        account_id: null,
        label: body.label ?? "Bitget Perp Bot",
        status: body.env === "demo" ? "DEMO" : "LIVE",
        bot_type: body.botType ?? "bitget_perp",
        risk_mode: body.riskMode ?? "1:1",
        trail_mode: body.trailMode ?? "trail",
        trail_start_pct: body.trailStartPct ?? 20,
        trail_offset_pct: body.trailOffsetPct ?? 10,
        config: {
          env: body.env ?? "live",
          productType,
          leverage: body.leverage ?? 10,
        },
        analysis,
        secrets: {
          apiKey,
          apiSecret,
          apiPassphrase,
          env: body.env ?? "live",
          productType,
          leverage: body.leverage ?? 10,
        },
      });

      return NextResponse.json({ ok: true, accountKey, analysis });
    }

    return NextResponse.json({ error: "Unsupported provider" }, { status: 400 });
  } catch (error) {
    console.error("Connect account failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
