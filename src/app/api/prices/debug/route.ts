import { NextResponse } from "next/server";
import { getAssetClass, listAssetClasses } from "@/lib/cotMarkets";
import { readSnapshot } from "@/lib/cotStore";
import { getPriceSymbolCandidates } from "@/lib/pricePerformance";
import { fetchOandaCandle } from "@/lib/oandaPrices";
import { DateTime } from "luxon";

export const runtime = "nodejs";

function getToken(request: Request) {
  const headerToken = request.headers.get("x-admin-token");
  if (headerToken) {
    return headerToken;
  }

  const auth = request.headers.get("authorization");
  if (auth && auth.toLowerCase().startsWith("bearer ")) {
    return auth.slice(7);
  }

  return null;
}

async function fetchSymbolDebug(symbol: string) {
  const results: Array<{
    ok: boolean;
    message?: string;
  }> = [];
  const now = DateTime.utc();
  const from = now.minus({ days: 2 });

  try {
    const candle = await fetchOandaCandle(symbol, from, now);
    results.push({
      ok: Boolean(candle),
      message: candle ? "OANDA candle resolved" : "No candles returned",
    });
  } catch (error) {
    results.push({
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    });
  }

  return results;
}

export async function GET(request: Request) {
  const adminToken = process.env.ADMIN_TOKEN;

  if (!adminToken) {
    return NextResponse.json(
      { error: "ADMIN_TOKEN is not configured." },
      { status: 500 },
    );
  }

  const token = getToken(request);
  if (!token || token !== adminToken) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const assetParam = searchParams.get("asset") ?? "fx";
  const assetClass = getAssetClass(assetParam);
  const snapshot = await readSnapshot({ assetClass });
  if (!snapshot) {
    return NextResponse.json(
      { error: "COT snapshot missing. Refresh COT data first." },
      { status: 409 },
    );
  }

  const pairs = Object.keys(snapshot.pairs);
  const debug = await Promise.all(
    pairs.map(async (pair) => {
      const symbols = getPriceSymbolCandidates(pair, assetClass);
      const attempts = await Promise.all(
        symbols.map(async (symbol) => ({
          symbol,
          results: await fetchSymbolDebug(symbol),
        })),
      );
      const resolved = attempts.find((attempt) =>
        attempt.results.some((item) => item.ok),
      );

      return {
        pair,
        symbols,
        resolved_symbol: resolved?.symbol ?? null,
        attempts,
      };
    }),
  );

  const byAsset = listAssetClasses().find((asset) => asset.id === assetClass);
  return NextResponse.json(
    {
      asset_class: assetClass,
      asset_label: byAsset?.label ?? assetClass,
      report_date: snapshot.report_date,
      debug,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
