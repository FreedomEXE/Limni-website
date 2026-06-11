import { NextRequest, NextResponse } from "next/server";

import { getCanonicalWeeklyBasket } from "@/lib/flagship/canonicalWeeklyBasket";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const weekOpenUtc = request.nextUrl.searchParams.get("week") ?? undefined;
    const payload = await getCanonicalWeeklyBasket(weekOpenUtc ? { weekOpenUtc } : undefined);
    return NextResponse.json(payload);
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to resolve canonical weekly basket",
      },
      { status: 500 },
    );
  }
}
