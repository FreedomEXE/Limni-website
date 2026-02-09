import { NextResponse, type NextRequest } from "next/server";
import { buildOandaSizingForAccount } from "@/lib/oandaSizing";
import { PAIRS_BY_ASSET_CLASS } from "@/lib/cotPairs";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ accountKey: string }> },
) {
  try {
    const { accountKey } = await params;
    // OANDA sizing UI is for the FX basket; omit indices/commodities to avoid confusion.
    const fxSymbols = PAIRS_BY_ASSET_CLASS.fx.map((row) => row.pair);
    const result = await buildOandaSizingForAccount(accountKey, { symbols: fxSymbols });
    return NextResponse.json(result);
  } catch (error) {
    console.error("Sizing analysis failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
