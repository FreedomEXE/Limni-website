import { NextResponse } from "next/server";
import { unstable_cache } from "next/cache";
import { getCotOperatingModeSummary } from "@/lib/cotOperatingMode";

export const revalidate = 300;

const getCachedMode = unstable_cache(
  async () => getCotOperatingModeSummary(),
  ["system-cot-mode"],
  { revalidate: 300 },
);

export async function GET() {
  try {
    const summary = await getCachedMode();
    return NextResponse.json(summary);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      {
        mode: "normal",
        label: "COT + Sentiment mode",
        reason: `Mode check failed: ${message}`,
        updated_at_utc: new Date().toISOString(),
        stale_asset_classes: [],
        healthy_asset_classes: [],
      },
      { status: 200 },
    );
  }
}
