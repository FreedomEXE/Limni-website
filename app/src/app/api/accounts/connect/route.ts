import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { DateTime } from "luxon";
import { upsertConnectedAccount } from "@/lib/connectedAccounts";
import { query } from "@/lib/db";

export const runtime = "nodejs";

const BITGET_BASE_URL = "https://api.bitget.com";

type ConnectRequest = {
  provider: "bitget" | "mt5";
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

function buildBitgetAccountId(options: { apiKey: string; env: string; productType: string }) {
  const seed = `${options.apiKey.trim()}|${options.env}|${options.productType}`;
  const hash = crypto.createHash("sha256").update(seed).digest("hex").slice(0, 16);
  return `bitget_${hash}`;
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
  env?: string;
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
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "ACCESS-KEY": options.apiKey,
    "ACCESS-SIGN": signature,
    "ACCESS-TIMESTAMP": timestamp,
    "ACCESS-PASSPHRASE": options.apiPassphrase,
    locale: "en-US",
  };

  // Bitget demo trading: same base URL, distinguished by header
  if (options.env === "demo") {
    headers["paptrading"] = "1";
  }

  const response = await fetch(`${BITGET_BASE_URL}${options.path}${query}`, {
    method: options.method,
    headers,
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
      const account = await bitgetRequest<
        Array<{ marginCoin: string; equity: string; usdtEquity?: string; available?: string }>
      >(
        {
          apiKey,
          apiSecret,
          apiPassphrase,
          method: "GET",
          path: "/api/v2/mix/account/accounts",
          query: { productType },
          env: body.env ?? "live",
        },
      );
      const rows = Array.isArray(account) ? account : [];
      const preferred =
        rows.find((row) => row.marginCoin?.toUpperCase() === "USDT") ?? rows[0];
      const envValue = body.env ?? "live";
      const accountId = buildBitgetAccountId({
        apiKey,
        env: envValue,
        productType,
      });
      const accountKey = buildAccountKey("bitget", accountId);
      const analysisEquity = Number(
        preferred?.usdtEquity ?? preferred?.equity ?? preferred?.available ?? "0",
      );
      const analysis = {
        equity: Number.isFinite(analysisEquity) ? analysisEquity : 0,
        currency: "USDT",
        productType,
        leverage: body.leverage ?? 10,
        fetched_at: DateTime.utc().toISO(),
      };

      await upsertConnectedAccount({
        account_key: accountKey,
        provider: "bitget",
        account_id: accountId,
        label: body.label ?? "Bitget Perp Bot",
        status: body.env === "demo" ? "DEMO" : "LIVE",
        bot_type: body.botType ?? "bitget_perp_v2",
        risk_mode: body.riskMode ?? "1:1",
        trail_mode: body.trailMode ?? "trail",
        trail_start_pct: body.trailStartPct ?? 20,
        trail_offset_pct: body.trailOffsetPct ?? 10,
        config: {
          env: envValue,
          productType,
          leverage: body.leverage ?? 10,
        },
        analysis,
        secrets: {
          apiKey,
          apiSecret,
          apiPassphrase,
          env: envValue,
          productType,
          leverage: body.leverage ?? 10,
        },
      });

      await query(
        `DELETE FROM connected_accounts
         WHERE provider = $1 AND account_id = $2 AND account_key <> $3`,
        ["bitget", accountId, accountKey],
      );

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
