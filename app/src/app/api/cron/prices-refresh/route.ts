import { NextResponse } from "next/server";
import { listAssetClasses } from "@/lib/cotMarkets";
import { readSnapshot } from "@/lib/cotStore";
import { refreshMarketSnapshot } from "@/lib/pricePerformance";
import { isCronAuthorized } from "@/lib/cronAuth";
import { revalidatePath } from "next/cache";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  if (!isCronAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const startedAt = new Date().toISOString();
  const assets = listAssetClasses();
  const results: Array<{
    asset_class: string;
    ok: boolean;
    missing_pairs?: number;
    total_pairs?: number;
    last_refresh_utc?: string;
    error?: string;
  }> = [];

  await Promise.all(
    assets.map(async (asset) => {
      try {
        const snapshot = await readSnapshot({ assetClass: asset.id });
        if (!snapshot) {
          results.push({
            asset_class: asset.id,
            ok: false,
            error: "No COT snapshot",
          });
          return;
        }
        const priced = await refreshMarketSnapshot(snapshot.pairs, {
          assetClass: asset.id,
          force: true,
        });
        const missing = Object.values(priced.pairs).filter((value) => value === null).length;
        results.push({
          asset_class: asset.id,
          ok: true,
          missing_pairs: missing,
          total_pairs: Object.keys(snapshot.pairs).length,
          last_refresh_utc: priced.last_refresh_utc,
        });
      } catch (error) {
        results.push({
          asset_class: asset.id,
          ok: false,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }),
  );

  try {
    revalidatePath("/performance");
    revalidatePath("/dashboard");
  } catch {
    // non-fatal
  }

  return NextResponse.json({
    ok: results.every((row) => row.ok),
    task: "prices_refresh",
    started_at: startedAt,
    finished_at: new Date().toISOString(),
    assets: results,
  });
}

