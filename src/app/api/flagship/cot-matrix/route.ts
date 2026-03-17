import { NextResponse } from "next/server";
import {
  derivePairDirectionsByBaseWithNeutral,
  derivePairDirectionsWithNeutral,
} from "@/lib/cotCompute";
import { PAIRS_BY_ASSET_CLASS } from "@/lib/cotPairs";
import type { AssetClass } from "@/lib/cotMarkets";
import { readSnapshot } from "@/lib/cotStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SignalDirection = "LONG" | "SHORT" | "NEUTRAL";

type CotMatrixRow = {
  pair: string;
  assetClass: AssetClass;
  reportDate: string | null;
  dealerDirection: SignalDirection;
  commercialDirection: SignalDirection;
  dealerReason: string | null;
  commercialReason: string | null;
};

function mapAssetClassRows(
  assetClass: AssetClass,
  snapshot: Awaited<ReturnType<typeof readSnapshot>>,
): CotMatrixRow[] {
  const pairDefs = PAIRS_BY_ASSET_CLASS[assetClass];
  if (!pairDefs?.length) return [];

  if (!snapshot) {
    return pairDefs.map((pairDef) => ({
      pair: pairDef.pair.toUpperCase(),
      assetClass,
      reportDate: null,
      dealerDirection: "NEUTRAL",
      commercialDirection: "NEUTRAL",
      dealerReason: "COT_SNAPSHOT_MISSING",
      commercialReason: "COT_SNAPSHOT_MISSING",
    }));
  }

  const dealerPairs =
    assetClass === "fx"
      ? derivePairDirectionsWithNeutral(snapshot.currencies, pairDefs, "dealer")
      : derivePairDirectionsByBaseWithNeutral(snapshot.currencies, pairDefs, "dealer");
  const commercialPairs =
    assetClass === "fx"
      ? derivePairDirectionsWithNeutral(snapshot.currencies, pairDefs, "commercial")
      : derivePairDirectionsByBaseWithNeutral(snapshot.currencies, pairDefs, "commercial");

  return pairDefs.map((pairDef) => {
    const pair = pairDef.pair.toUpperCase();
    const dealer = dealerPairs[pair];
    const commercial = commercialPairs[pair];

    return {
      pair,
      assetClass,
      reportDate: snapshot.report_date,
      dealerDirection: dealer?.direction ?? "NEUTRAL",
      commercialDirection: commercial?.direction ?? "NEUTRAL",
      dealerReason: dealer ? null : "COT_DEALER_SIGNAL_MISSING",
      commercialReason: commercial ? null : "COT_COMMERCIAL_SIGNAL_MISSING",
    };
  });
}

export async function GET() {
  try {
    const assetClasses: AssetClass[] = ["fx", "indices", "crypto", "commodities"];
    const snapshots = await Promise.all(
      assetClasses.map((assetClass) => readSnapshot({ assetClass })),
    );

    const rows = assetClasses.flatMap((assetClass, index) =>
      mapAssetClassRows(assetClass, snapshots[index]),
    );

    return NextResponse.json({
      generatedUtc: new Date().toISOString(),
      rows,
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to build flagship COT matrix" },
      { status: 500 },
    );
  }
}

