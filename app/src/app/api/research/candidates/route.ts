import { NextResponse } from "next/server";
import researchCandidates from "@/lib/researchCandidates";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const registry = await researchCandidates.readStrategyCandidateRegistry();
    return NextResponse.json(registry, {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : String(error) },
      { status: 500, headers: { "Cache-Control": "no-store" } },
    );
  }
}
