import { NextResponse } from "next/server";
import { readSnapshot } from "@/lib/cotStore";
import { refreshMarketSnapshot } from "@/lib/pricePerformance";

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

  const cotSnapshot = await readSnapshot();
  if (!cotSnapshot) {
    return NextResponse.json(
      { error: "COT snapshot missing. Refresh COT data first." },
      { status: 409 },
    );
  }

  try {
    const snapshot = await refreshMarketSnapshot(cotSnapshot.pairs);
    const missingPairs = Object.values(snapshot.pairs).filter(
      (value) => value === null,
    ).length;

    return NextResponse.json(
      {
        ...snapshot,
        missing_pairs: missingPairs,
        total_pairs: Object.keys(cotSnapshot.pairs).length,
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Price refresh failed.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
