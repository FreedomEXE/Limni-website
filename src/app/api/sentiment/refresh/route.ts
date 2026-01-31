import { NextResponse } from "next/server";
import { refreshSentiment } from "@/lib/sentiment/refresh";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const token = request.headers.get("x-admin-token") ?? "";
  const expectedToken = process.env.ADMIN_TOKEN ?? "";

  if (expectedToken && token !== expectedToken) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await refreshSentiment();
    if (!result.ok) {
      return NextResponse.json({
        ok: false,
        message: "No sentiment data collected from any provider",
      });
    }
    return NextResponse.json({
      ok: true,
      snapshots_collected: result.snapshots,
      aggregates_computed: result.aggregates,
      flips: result.flips.length,
      timestamp: result.timestamp,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: "Sentiment refresh failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
