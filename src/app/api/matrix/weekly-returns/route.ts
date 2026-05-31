import { NextRequest, NextResponse } from "next/server";
import { loadWeeklyReturnDisplayRows } from "@/lib/weeklyReturnDisplay";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const week = request.nextUrl.searchParams.get("week");
  if (!week) {
    return NextResponse.json({ error: "Missing week" }, { status: 400 });
  }

  try {
    const rows = await loadWeeklyReturnDisplayRows(week);
    return NextResponse.json({
      weekOpenUtc: week,
      rows,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load weekly returns";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
