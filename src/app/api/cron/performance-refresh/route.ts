import { NextResponse } from "next/server";
import { refreshPerformanceSnapshots } from "@/lib/performanceRefresh";
import { isCronAuthorized } from "@/lib/cronAuth";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = new Date().toISOString();
  const url = new URL(request.url);
  const weeksParam = url.searchParams.get("weeks");
  const rollingWeeks = weeksParam ? Number.parseInt(weeksParam, 10) : 6;

  try {
    const result = await refreshPerformanceSnapshots({
      rollingWeeks: Number.isFinite(rollingWeeks) && rollingWeeks > 0 ? rollingWeeks : 6,
    });
    try {
      revalidatePath("/performance");
      revalidatePath("/dashboard");
    } catch {
      // non-fatal
    }
    return NextResponse.json({
      ok: true,
      task: "performance_refresh",
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      week_open_utc: result.week_open_utc,
      refreshed_weeks: result.weeks,
      snapshots_written: result.snapshots_written,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        ok: false,
        task: "performance_refresh",
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        error: message,
      },
      { status: 503 },
    );
  }
}

