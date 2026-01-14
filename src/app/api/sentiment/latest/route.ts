import { NextResponse } from "next/server";
import { getLatestAggregates } from "@/lib/sentiment/store";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const symbolsParam = searchParams.get("symbols");
  const symbols = symbolsParam ? symbolsParam.split(",") : undefined;

  try {
    const aggregates = await getLatestAggregates();

    const filtered = symbols
      ? aggregates.filter((a) => symbols.includes(a.symbol))
      : aggregates;

    return NextResponse.json({
      data: filtered,
      count: filtered.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to fetch sentiment data",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
