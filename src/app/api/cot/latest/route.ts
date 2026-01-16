import { NextResponse } from "next/server";
import { evaluateFreshness } from "@/lib/cotFreshness";
import { readSnapshot } from "@/lib/cotStore";
import type { CotSnapshotResponse } from "@/lib/cotTypes";

export const runtime = "nodejs";

export async function GET() {
  const snapshot = await readSnapshot();

  if (!snapshot) {
    const empty: CotSnapshotResponse = {
      report_date: "",
      last_refresh_utc: "",
      trading_allowed: false,
      reason: "no snapshot available",
      currencies: {},
      pairs: {},
    };
    const body = JSON.stringify(empty);
    return new Response(body, {
      status: 503,
      headers: {
        "Cache-Control": "no-store",
        "Content-Type": "application/json",
        "Content-Length": String(Buffer.byteLength(body)),
      },
    });
  }

  const freshness = evaluateFreshness(
    snapshot.report_date,
    snapshot.last_refresh_utc,
  );

  const payload = { ...snapshot, ...freshness };
  const body = JSON.stringify(payload);
  return new Response(body, {
    headers: {
      "Cache-Control": "no-store",
      "Content-Type": "application/json",
      "Content-Length": String(Buffer.byteLength(body)),
    },
  });
}
