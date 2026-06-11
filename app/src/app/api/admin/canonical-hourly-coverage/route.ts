import { NextResponse } from "next/server";
import { getCanonicalHourlyCoverage } from "@/lib/canonicalHourlyBars";
import type { AssetClass } from "@/lib/cotMarkets";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isAuthorized(request: Request) {
  const token = request.headers.get("x-admin-token") ?? "";
  const expectedToken = process.env.ADMIN_API_TOKEN ?? process.env.ADMIN_TOKEN ?? "";
  return Boolean(expectedToken) && token === expectedToken;
}

function parseAsset(value: string | null): AssetClass | "all" {
  if (!value || value === "all") return "all";
  if (value === "fx" || value === "indices" || value === "commodities" || value === "crypto") {
    return value;
  }
  return "all";
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const url = new URL(request.url);
    const symbols = (url.searchParams.get("symbols") ?? "")
      .split(",")
      .map((symbol) => symbol.trim().toUpperCase())
      .filter(Boolean);
    const weeks = (url.searchParams.get("weeks") ?? "")
      .split(",")
      .map((week) => week.trim())
      .filter(Boolean);

    const coverage = await getCanonicalHourlyCoverage({
      assetClass: parseAsset(url.searchParams.get("asset")),
      symbols,
      weeks,
      fromWeek: url.searchParams.get("fromWeek") ?? undefined,
      toWeek: url.searchParams.get("toWeek") ?? undefined,
    });

    return NextResponse.json(coverage);
  } catch (error) {
    console.error("Failed to load canonical hourly coverage:", error);
    return NextResponse.json(
      { error: "Failed to load canonical hourly coverage" },
      { status: 500 },
    );
  }
}
