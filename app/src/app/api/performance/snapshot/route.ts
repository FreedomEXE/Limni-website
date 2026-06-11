import { NextResponse } from "next/server";
import { refreshPerformanceSnapshots } from "@/lib/performanceRefresh";

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

function isCronAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return false;
  }
  const headerSecret = request.headers.get("x-cron-secret");
  const authHeader = request.headers.get("authorization");
  const bearerSecret = authHeader?.startsWith("Bearer ")
    ? authHeader.slice("Bearer ".length)
    : null;
  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret");
  return headerSecret === secret || querySecret === secret || bearerSecret === secret;
}

export async function POST(request: Request) {
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
  const forcedWeekOpenUtc = searchParams.get("week_open_utc");
  const weeksParam = searchParams.get("weeks");
  const rollingWeeks = weeksParam ? Number.parseInt(weeksParam, 10) : 1;
  const result = await refreshPerformanceSnapshots({
    forcedWeekOpenUtc,
    rollingWeeks: Number.isFinite(rollingWeeks) && rollingWeeks > 0 ? rollingWeeks : 1,
  });

  return NextResponse.json({
    ok: true,
    week_open_utc: result.week_open_utc,
    refreshed_weeks: result.weeks,
    snapshots_written: result.snapshots_written,
  });
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
  if (token !== adminToken && !isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const forcedWeekOpenUtc = searchParams.get("week_open_utc");
  const weeksParam = searchParams.get("weeks");
  const rollingWeeks = weeksParam ? Number.parseInt(weeksParam, 10) : 6;
  const result = await refreshPerformanceSnapshots({
    forcedWeekOpenUtc,
    rollingWeeks: Number.isFinite(rollingWeeks) && rollingWeeks > 0 ? rollingWeeks : 6,
  });

  return NextResponse.json({
    ok: true,
    week_open_utc: result.week_open_utc,
    refreshed_weeks: result.weeks,
    snapshots_written: result.snapshots_written,
  });
}
