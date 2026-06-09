import { NextResponse } from "next/server";

import { certifyActiveBaseline } from "@/lib/appTruth/activeBaselineCertification";
import { isCronAuthorized } from "@/lib/cronAuth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = await certifyActiveBaseline({
      triggerType: "schedule",
      routePath: "/api/cron/active-baseline-certification",
      schedule: "55 * * * *",
    });
    return NextResponse.json(payload, { status: payload.ok ? 200 : 503 });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        ok: false,
        task: "active_baseline_certification",
        error: message,
      },
      { status: 503 },
    );
  }
}
