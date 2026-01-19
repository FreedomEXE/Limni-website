import { NextResponse } from "next/server";
import {
  getLatestAggregates,
  readSourceHealth,
  readSnapshots,
} from "@/lib/sentiment/store";
import { ALL_SENTIMENT_SYMBOLS } from "@/lib/sentiment/symbols";

export const runtime = "nodejs";

export async function GET() {
  try {
    const [sources, aggregates, snapshots] = await Promise.all([
      readSourceHealth(),
      getLatestAggregates(),
      readSnapshots(),
    ]);

    const coveredSymbols = new Set(aggregates.map((a) => a.symbol));
    const missingSymbols = ALL_SENTIMENT_SYMBOLS.filter(
      (s) => !coveredSymbols.has(s),
    );

    const recentSnapshots = snapshots.filter((s) => {
      const age = Date.now() - new Date(s.timestamp_utc).getTime();
      return age < 30 * 60 * 1000;
    });

    const snapshotsByProvider = recentSnapshots.reduce(
      (acc, s) => {
        acc[s.provider] = (acc[s.provider] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return NextResponse.json({
      sources,
      coverage: {
        total_pairs: ALL_SENTIMENT_SYMBOLS.length,
        covered_pairs: coveredSymbols.size,
        missing_pairs: missingSymbols,
      },
      recent_data: {
        snapshots_last_30min: recentSnapshots.length,
        by_provider: snapshotsByProvider,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to fetch health data",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
