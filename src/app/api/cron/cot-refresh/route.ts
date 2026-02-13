import { NextResponse } from "next/server";
import { listAssetClasses } from "@/lib/cotMarkets";
import { refreshAllSnapshots, readSnapshot } from "@/lib/cotStore";
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
    const refreshed = await refreshAllSnapshots();
    const assets = listAssetClasses();
    const byAsset = await Promise.all(
      assets.map(async (asset) => {
        const snapshot = await readSnapshot({ assetClass: asset.id });
        return {
          asset_class: asset.id,
          report_date: snapshot?.report_date ?? refreshed[asset.id]?.report_date ?? null,
          last_refresh_utc:
            snapshot?.last_refresh_utc ?? refreshed[asset.id]?.last_refresh_utc ?? null,
        };
      }),
    );

    try {
      revalidatePath("/dashboard");
      revalidatePath("/performance");
      revalidatePath("/antikythera");
      revalidatePath("/accounts");
    } catch {
      // non-fatal
    }

    return NextResponse.json({
      ok: true,
      task: "cot_refresh",
      started_at: startedAt,
      finished_at: new Date().toISOString(),
      assets: byAsset,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      {
        ok: false,
        task: "cot_refresh",
        started_at: startedAt,
        finished_at: new Date().toISOString(),
        error: message,
      },
      { status: 503 },
    );
  }
}

