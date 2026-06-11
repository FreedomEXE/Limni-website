import { NextResponse } from "next/server";
import { loadNewsPayload } from "@/lib/news/loadNewsPayload";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const week = searchParams.get("week");

  try {
    const payload = await loadNewsPayload(week);
    return NextResponse.json(payload);
  } catch (error) {
    console.error("[news/payload] Failed to load news payload:", error);
    return NextResponse.json(
      { error: "Failed to load news payload" },
      { status: 500 },
    );
  }
}
