import { NextResponse } from "next/server";
import { evaluateFreshness } from "@/lib/cotFreshness";
import { refreshSnapshot } from "@/lib/cotStore";

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

  try {
    const snapshot = await refreshSnapshot();
    const freshness = evaluateFreshness(
      snapshot.report_date,
      snapshot.last_refresh_utc,
    );

    return NextResponse.json(
      { ...snapshot, ...freshness },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Refresh failed.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
