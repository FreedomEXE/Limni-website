import { NextResponse } from "next/server";
import { getAccountStatsForWeek, calculateAccountMetrics } from "@/lib/accountStats";
import type { WeekOption } from "@/lib/weekState";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type RouteContext = {
  params: Promise<{ accountKey: string }>;
};

/**
 * GET /api/accounts/connected/[accountKey]/stats
 *
 * Fetch week-specific stats for a connected account
 *
 * Query params:
 * - week: ISO string of week_open_utc, or "all" for all-time stats
 *
 * Example: /api/accounts/connected/oanda_123/stats?week=2025-02-03T00:00:00.000Z
 */
export async function GET(request: Request, context: RouteContext) {
  try {
    const { accountKey } = await context.params;
    const url = new URL(request.url);
    const weekParam = url.searchParams.get("week");

    // Validate week parameter
    const week: WeekOption = weekParam === "all" || !weekParam ? "all" : weekParam;

    // Fetch week-specific stats
    const stats = await getAccountStatsForWeek(accountKey, week);
    const metrics = calculateAccountMetrics(stats);

    return NextResponse.json(
      {
        success: true,
        data: {
          ...stats,
          metrics,
        },
      },
      {
        headers: {
          "Cache-Control": "no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error("Failed to fetch account stats:", error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to fetch account stats",
      },
      {
        status: 500,
        headers: {
          "Cache-Control": "no-store",
        },
      }
    );
  }
}
