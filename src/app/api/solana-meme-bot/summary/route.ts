import { NextResponse } from "next/server";
import { getTrenchbotSummary } from "@/lib/trenchbot";

export const runtime = "nodejs";

export async function GET() {
  try {
    const payload = getTrenchbotSummary();
    return NextResponse.json(payload);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
