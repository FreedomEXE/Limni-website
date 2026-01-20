import { NextResponse } from "next/server";
import { getAssetClass, listAssetClasses } from "@/lib/cotMarkets";
import { readSnapshot } from "@/lib/cotStore";
import { getPriceSymbolCandidates } from "@/lib/pricePerformance";

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

async function fetchSymbolDebug(symbol: string, apiKey: string) {
  const intervals = ["1h", "4h", "1day"];
  const results: Array<{
    interval: string;
    ok: boolean;
    response_status: number | null;
    api_status?: string;
    message?: string;
    values_count?: number;
  }> = [];

  for (const interval of intervals) {
    const url = new URL("https://api.twelvedata.com/time_series");
    url.searchParams.set("symbol", symbol);
    url.searchParams.set("interval", interval);
    url.searchParams.set("outputsize", "500");
    url.searchParams.set("timezone", "UTC");
    url.searchParams.set("apikey", apiKey);

    try {
      const response = await fetch(url.toString(), { cache: "no-store" });
      const payload = (await response.json()) as {
        status?: string;
        message?: string;
        values?: Array<unknown>;
      };
      const valuesCount = payload.values?.length ?? 0;
      const ok =
        response.ok &&
        payload.status !== "error" &&
        Array.isArray(payload.values) &&
        valuesCount > 0;
      results.push({
        interval,
        ok,
        response_status: response.status,
        api_status: payload.status,
        message: payload.message,
        values_count: valuesCount,
      });
      if (ok) {
        break;
      }
    } catch (error) {
      results.push({
        interval,
        ok: false,
        response_status: null,
        message: error instanceof Error ? error.message : String(error),
      });
    }
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

  const apiKey = process.env.PRICE_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: "PRICE_API_KEY is not configured." },
      { status: 500 },
    );
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
          results: await fetchSymbolDebug(symbol, apiKey),
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
