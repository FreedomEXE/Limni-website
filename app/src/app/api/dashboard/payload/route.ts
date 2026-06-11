import { NextResponse } from "next/server";
import { loadCachedMarketIntelligence } from "@/lib/dashboard/loadMarketIntelligence";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const asset = searchParams.get("asset") ?? undefined;
  const report = searchParams.get("report") ?? undefined;
  const includeAllReports = searchParams.get("allReports") === "1";

  try {
    const payload = await loadCachedMarketIntelligence(asset, {
      reportDate: report,
      includeAllReports,
    });
    return NextResponse.json(payload);
  } catch (error) {
    console.error("[dashboard/payload] Failed to load market intelligence:", error);
    return NextResponse.json(
      { error: "Failed to load market intelligence" },
      { status: 500 },
    );
  }
}
