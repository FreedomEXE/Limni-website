import { NextResponse } from "next/server";
import { refreshSentiment } from "@/lib/sentiment/refresh";
import { isCronAuthorized } from "@/lib/cronAuth";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = new Date().toISOString();
  try {
    const result = await refreshSentiment();
    try {
      revalidatePath("/sentiment");
      revalidatePath("/dashboard");
    } catch {
      // non-fatal
    }
    return NextResponse.json({
      ok: result.ok,
      task: "sentiment_refresh",
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      snapshots: result.snapshots,
      aggregates: result.aggregates,
      flips: result.flips.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        ok: false,
        task: "sentiment_refresh",
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        error: message,
      },
      { status: 503 },
    );
  }
}

