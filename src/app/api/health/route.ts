import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    routes: {
      baskets: "/api/cot/baskets/latest",
      mt5Push: "/api/mt5/push",
    },
  });
}
