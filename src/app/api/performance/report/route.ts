import { NextResponse } from "next/server";
import { getCanonicalPerformanceApiModel } from "@/lib/performance/canonicalPerformanceReport";
import { resolveCanonicalFlagships } from "@/lib/performance/canonicalFlagships";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export async function GET() {
  try {
    const [report, flagships] = await Promise.all([
      getCanonicalPerformanceApiModel({ normalizePositionSizing: true }),
      resolveCanonicalFlagships(),
    ]);

    if (!report) {
      return NextResponse.json({
        unavailable: true,
        reason: "Canonical report not found in deployment",
        flagships,
      });
    }

    return NextResponse.json({
      ...report,
      flagships,
    });
  } catch (error) {
    console.error(
      "Failed to build canonical performance report payload:",
      error instanceof Error ? error.message : String(error),
    );
    return NextResponse.json(
      { error: "Failed to load canonical performance report" },
      { status: 500 },
    );
  }
}
