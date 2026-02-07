import { NextResponse, type NextRequest } from "next/server";
import { buildOandaSizingForAccount } from "@/lib/oandaSizing";

export const runtime = "nodejs";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ accountKey: string }> },
) {
  try {
    const { accountKey } = await params;
    const result = await buildOandaSizingForAccount(accountKey);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Sizing analysis failed:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
