import { NextResponse } from "next/server";
import { readAggregates } from "@/lib/sentiment/store";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get("symbol");
  const range = searchParams.get("range") || "24h";

  if (!symbol) {
    return NextResponse.json(
      { error: "symbol parameter is required" },
      { status: 400 },
    );
  }

  try {
    const all = await readAggregates();

    const rangeMs = parseRange(range);
    const cutoff = Date.now() - rangeMs;

    const filtered = all.filter((a) => {
      if (a.symbol !== symbol) {
        return false;
      }
      const timestamp = new Date(a.timestamp_utc).getTime();
      return timestamp >= cutoff;
    });

    filtered.sort((a, b) => {
      return (
        new Date(a.timestamp_utc).getTime() - new Date(b.timestamp_utc).getTime()
      );
    });

    return NextResponse.json({
      symbol,
      range,
      data: filtered,
      count: filtered.length,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to fetch history",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

function parseRange(range: string): number {
  const match = range.match(/^(\d+)([hdw])$/);
  if (!match) {
    return 24 * 60 * 60 * 1000;
  }

  const value = Number.parseInt(match[1] || "24", 10);
  const unit = match[2];

  switch (unit) {
    case "h":
      return value * 60 * 60 * 1000;
    case "d":
      return value * 24 * 60 * 60 * 1000;
    case "w":
      return value * 7 * 24 * 60 * 60 * 1000;
    default:
      return 24 * 60 * 60 * 1000;
  }
}
