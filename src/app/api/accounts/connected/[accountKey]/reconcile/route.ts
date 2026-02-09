import { NextResponse } from "next/server";
import { DateTime } from "luxon";

import { buildBasketSignals } from "@/lib/basketSignals";
import { groupSignals, UNIVERSAL_MODELS } from "@/lib/plannedTrades";
import { buildOandaSizingForAccount } from "@/lib/oandaSizing";
import { loadConnectedAccountSecretsByKey, getConnectedAccount } from "@/lib/connectedAccounts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ accountKey: string }>;
};

const OANDA_PRACTICE_URL = "https://api-fxpractice.oanda.com";
const OANDA_LIVE_URL = "https://api-fxtrade.oanda.com";

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

function parseClientTag(tag: string | undefined | null) {
  const raw = String(tag ?? "").trim();
  const parts = raw.split("-");
  // Expected: uni-{SYMBOL}-{MODEL}-{random}
  const prefix = (parts[0] ?? "").toLowerCase();
  const symbol = (parts[1] ?? "").toUpperCase();
  const model = (parts[2] ?? "").toLowerCase();
  if (prefix !== "uni" || !symbol || !model) {
    return null;
  }
  return { symbol, model };
}

function truncateUnits(units: number, precision: number) {
  const p = Math.max(0, precision);
  const factor = p > 0 ? 10 ** p : 1;
  const truncated = p > 0 ? Math.floor(units * factor) / factor : Math.floor(units);
  return Number.isFinite(truncated) ? truncated : 0;
}

/**
 * GET /api/accounts/connected/[accountKey]/reconcile
 *
 * Compares current live OANDA open trades vs what the universal OANDA bot *should* have open
 * based on latest basket signals + sizing analysis.
 *
 * This is read-only. It does not place or close trades.
 */
export async function GET(_request: Request, context: RouteContext) {
  try {
    const { accountKey } = await context.params;

    const record = await loadConnectedAccountSecretsByKey(accountKey);
    if (!record) {
      return NextResponse.json({ ok: false, error: "Account not found." }, { status: 404 });
    }
    if (record.account.provider !== "oanda") {
      return NextResponse.json(
        { ok: false, error: "Reconcile is only supported for OANDA accounts." },
        { status: 400 },
      );
    }

    const secrets = record.secrets as Record<string, unknown>;
    const apiKey = typeof secrets.apiKey === "string" ? secrets.apiKey : "";
    const accountId = typeof secrets.accountId === "string" ? secrets.accountId : "";
    const env = (typeof secrets.env === "string" ? secrets.env : "live") as "live" | "practice";
    if (!apiKey || !accountId) {
      return NextResponse.json(
        { ok: false, error: "Missing OANDA credentials for this connected account." },
        { status: 400 },
      );
    }

    const connected = await getConnectedAccount(accountKey);
    const config = (connected?.config ?? {}) as Record<string, unknown>;
    const marginBuffer =
      typeof config.marginBuffer === "number" ? config.marginBuffer : Number(process.env.OANDA_MARGIN_BUFFER ?? "0.1");
    const buffer = Number.isFinite(marginBuffer) ? Math.min(0.5, Math.max(0, marginBuffer)) : 0.1;

    const [basket, sizing, openTradesPayload] = await Promise.all([
      buildBasketSignals(),
      buildOandaSizingForAccount(accountKey),
      oandaRequest<{
        trades?: Array<{
          id: string;
          instrument: string;
          currentUnits: string;
          unrealizedPL: string;
          openTime?: string;
          clientExtensions?: { id?: string; tag?: string; comment?: string };
        }>;
      }>(apiKey, env, `/v3/accounts/${accountId}/trades`),
    ]);

    const allSignals = basket.pairs ?? [];
    const plannedSignals = allSignals.filter(
      (row) =>
        row.asset_class === "fx" &&
        UNIVERSAL_MODELS.includes(row.model) &&
        row.direction !== "NEUTRAL",
    ) as Array<{
      symbol: string;
      model: string;
      direction: "LONG" | "SHORT";
      asset_class: "fx";
    }>;

    const plannedSymbols = Array.from(new Set(plannedSignals.map((s) => s.symbol.toUpperCase())));
    const sizingBySymbol = new Map(
      (sizing.rows ?? []).map((row) => [String(row.symbol ?? "").toUpperCase(), row]),
    );

    // Compute scale using the bot's logic: totalMargin uses *net per symbol* (from grouped signals).
    const grouped = groupSignals(
      plannedSignals.map((s) => ({
        symbol: s.symbol,
        model: s.model as any,
        direction: s.direction as any,
        asset_class: "fx" as const,
      })) as any,
    );
    let totalMargin = 0;
    for (const pair of grouped) {
      const row = sizingBySymbol.get(String(pair.symbol).toUpperCase());
      if (!row || !row.available || !Number.isFinite(row.marginRate ?? NaN)) continue;
      totalMargin += sizing.nav * (row.marginRate ?? 0) * Math.abs(pair.net);
    }
    const available =
      Number.isFinite(sizing.marginAvailable ?? NaN) && (sizing.marginAvailable as number) > 0
        ? (sizing.marginAvailable as number)
        : sizing.nav;
    const scale = totalMargin > 0 ? Math.min(1, (available * (1 - buffer)) / totalMargin) : 1;

    const plannedLegs = plannedSignals
      .map((sig) => {
        const symbol = sig.symbol.toUpperCase();
        const model = String(sig.model ?? "").toLowerCase();
        const direction = sig.direction;
        const row = sizingBySymbol.get(symbol);
        const precision = row?.tradeUnitsPrecision ?? 0;
        const minUnits = row?.minUnits ?? (precision <= 0 ? 1 : Number((1 / 10 ** precision).toFixed(precision)));
        const baseUnits = row && row.available && Number.isFinite(row.units ?? NaN) ? (row.units as number) : 0;
        const scaled = truncateUnits(baseUnits * scale, precision);
        const expectedUnits = scaled >= minUnits ? scaled : 0;
        const key = `${symbol}:${model}:${direction}`;
        return {
          key,
          symbol,
          model,
          direction,
          expectedUnits,
          precision,
          minUnits,
          sizing: row
            ? {
                instrument: row.instrument,
                baseUnits: row.units ?? 0,
                marginRate: row.marginRate ?? null,
                reason: row.reason ?? null,
                available: row.available,
              }
            : null,
        };
      })
      .filter((leg) => plannedSymbols.includes(leg.symbol));

    const openTrades = (openTradesPayload.trades ?? []).map((t) => {
      const units = Number(t.currentUnits ?? "0");
      const parsed = parseClientTag(t.clientExtensions?.tag ?? t.clientExtensions?.id);
      return {
        id: t.id,
        instrument: t.instrument,
        units,
        absUnits: Math.abs(units),
        direction: units > 0 ? ("LONG" as const) : ("SHORT" as const),
        unrealizedPL: Number(t.unrealizedPL ?? "0"),
        openTime: t.openTime ?? null,
        tag: t.clientExtensions?.tag ?? t.clientExtensions?.id ?? null,
        managed: Boolean(parsed),
        symbol: parsed?.symbol ?? null,
        model: parsed?.model ?? null,
        key: parsed ? `${parsed.symbol}:${parsed.model}:${units > 0 ? "LONG" : "SHORT"}` : null,
      };
    });

    const managedOpen = openTrades.filter((t) => t.managed && t.key && t.symbol && t.model) as Array<
      typeof openTrades[number] & { key: string; symbol: string; model: string }
    >;

    const openByKey = new Map<string, { absUnits: number; count: number; sample: any }>();
    for (const t of managedOpen) {
      const existing = openByKey.get(t.key);
      if (!existing) {
        openByKey.set(t.key, { absUnits: t.absUnits, count: 1, sample: t });
      } else {
        openByKey.set(t.key, { absUnits: existing.absUnits + t.absUnits, count: existing.count + 1, sample: existing.sample });
      }
    }

    const plannedByKey = new Map<string, typeof plannedLegs[number]>();
    for (const leg of plannedLegs) {
      plannedByKey.set(leg.key, leg);
    }

    const missing = plannedLegs
      .filter((leg) => leg.expectedUnits > 0 && !openByKey.has(leg.key))
      .map((leg) => ({ key: leg.key, symbol: leg.symbol, model: leg.model, direction: leg.direction, expectedUnits: leg.expectedUnits }));

    const extra = Array.from(openByKey.entries())
      .filter(([key]) => !plannedByKey.has(key))
      .map(([key, val]) => ({
        key,
        symbol: String(val.sample.symbol ?? ""),
        model: String(val.sample.model ?? ""),
        direction: String(val.sample.direction ?? ""),
        openUnits: val.absUnits,
        openTrades: val.count,
      }));

    const mismatched = plannedLegs
      .filter((leg) => leg.expectedUnits > 0 && openByKey.has(leg.key))
      .map((leg) => {
        const open = openByKey.get(leg.key)!;
        const expected = leg.expectedUnits;
        const got = open.absUnits;
        const tolerance = Math.max(1, Math.floor(expected * 0.01)); // 1 unit or 1% (whichever larger)
        const diff = Math.abs(got - expected);
        return diff > tolerance
          ? {
              key: leg.key,
              symbol: leg.symbol,
              model: leg.model,
              direction: leg.direction,
              expectedUnits: expected,
              openUnits: got,
              diff,
            }
          : null;
      })
      .filter(Boolean);

    // Per-symbol gross/net aggregation across legs.
    const symAgg = new Map<
      string,
      { plannedLong: number; plannedShort: number; openLong: number; openShort: number; missingLegs: number }
    >();
    for (const leg of plannedLegs) {
      if (!symAgg.has(leg.symbol)) {
        symAgg.set(leg.symbol, { plannedLong: 0, plannedShort: 0, openLong: 0, openShort: 0, missingLegs: 0 });
      }
      const row = symAgg.get(leg.symbol)!;
      if (leg.direction === "LONG") row.plannedLong += leg.expectedUnits;
      if (leg.direction === "SHORT") row.plannedShort += leg.expectedUnits;
      if (leg.expectedUnits > 0 && !openByKey.has(leg.key)) row.missingLegs += 1;
    }
    for (const [key, open] of openByKey.entries()) {
      const [symbol, , dir] = key.split(":");
      if (!symbol) continue;
      if (!symAgg.has(symbol)) {
        symAgg.set(symbol, { plannedLong: 0, plannedShort: 0, openLong: 0, openShort: 0, missingLegs: 0 });
      }
      const row = symAgg.get(symbol)!;
      if (dir === "LONG") row.openLong += open.absUnits;
      if (dir === "SHORT") row.openShort += open.absUnits;
    }

    const symbolSummary = Array.from(symAgg.entries())
      .map(([symbol, row]) => ({
        symbol,
        gross: {
          planned: row.plannedLong + row.plannedShort,
          open: row.openLong + row.openShort,
        },
        net: {
          planned: row.plannedLong - row.plannedShort,
          open: row.openLong - row.openShort,
        },
        missingLegs: row.missingLegs,
      }))
      .sort((a, b) => a.symbol.localeCompare(b.symbol));

    return NextResponse.json(
      {
        ok: true,
        fetched_at: DateTime.utc().toISO(),
        config: { marginBuffer: buffer },
        sizing: {
          nav: sizing.nav,
          marginAvailable: sizing.marginAvailable ?? null,
          marginUsed: sizing.marginUsed ?? null,
          scale,
          totalMargin,
        },
        planned: {
          legs: plannedLegs.length,
          tradableLegs: plannedLegs.filter((l) => l.expectedUnits > 0).length,
          symbols: plannedSymbols.length,
        },
        open: {
          managedTrades: managedOpen.length,
          uniqueLegKeys: openByKey.size,
        },
        diff: {
          missingCount: missing.length,
          extraCount: extra.length,
          mismatchedCount: mismatched.length,
          missing: missing.slice(0, 200),
          extra: extra.slice(0, 200),
          mismatched: (mismatched as any[]).slice(0, 200),
        },
        symbols: symbolSummary,
      },
      { headers: { "Cache-Control": "no-store, max-age=0" } },
    );
  } catch (error) {
    console.error("OANDA reconcile failed:", error);
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}

