import { NextResponse } from "next/server";
import { readNewsWeeklySnapshot } from "@/lib/news/store";
import { refreshNewsSnapshot } from "@/lib/news/refresh";

export const revalidate = 300;

export async function GET() {
  try {
    let snapshot = await readNewsWeeklySnapshot();
    if (!snapshot) {
      await refreshNewsSnapshot();
      snapshot = await readNewsWeeklySnapshot();
    }
    return NextResponse.json(
      snapshot ?? {
        week_open_utc: null,
        source: "forexfactory",
        announcements: [],
        calendar: [],
        fetched_at: null,
      },
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
