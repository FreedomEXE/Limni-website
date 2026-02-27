import { NextResponse } from "next/server";
import { fetchLiquidationHeatmap } from "@/lib/coinank";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const DEFAULT_SYMBOLS = ["BTC", "ETH"];
const DEFAULT_EXCHANGES = ["Binance", "Bybit"];
const MAX_SYMBOLS = 6;

function parseCsv(value: string | null): string[] {
  if (!value) return [];
  return value
    .split(",")
    .map((part) => part.trim())
    .filter(Boolean);
}

function normalizeSymbol(raw: string): string | null {
  const clean = raw.toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!clean) return null;
  return clean.endsWith("USDT") ? clean.slice(0, -4) : clean;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const interval = searchParams.get("interval")?.trim() || "1d";
  const requestedSymbols = parseCsv(searchParams.get("symbols"));
  const requestedExchanges = parseCsv(searchParams.get("exchanges"));

  const symbols = Array.from(
    new Set(
      (requestedSymbols.length ? requestedSymbols : DEFAULT_SYMBOLS)
        .map(normalizeSymbol)
        .filter((symbol): symbol is string => Boolean(symbol)),
    ),
  ).slice(0, MAX_SYMBOLS);

  if (!symbols.length) {
    return NextResponse.json(
      { error: "No valid symbols provided. Use ?symbols=BTC,ETH" },
      { status: 400 },
    );
  }

  const exchanges = requestedExchanges.length
    ? Array.from(new Set(requestedExchanges))
    : DEFAULT_EXCHANGES;

  const settled = await Promise.allSettled(
    symbols.map(async (symbol) => {
      try {
        return await fetchLiquidationHeatmap(symbol, { interval, exchanges });
      } catch (error) {
        return {
          symbol,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }),
  );

  const results: Array<Record<string, unknown>> = [];
  for (const item of settled) {
    if (item.status === "fulfilled") {
      results.push(item.value as Record<string, unknown>);
    } else {
      results.push({
        symbol: "unknown",
        error: item.reason instanceof Error ? item.reason.message : String(item.reason),
      });
    }
  }

  return NextResponse.json(
    {
      asOfUtc: new Date().toISOString(),
      interval,
      exchanges,
      results,
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
