import { NextResponse } from "next/server";
import { buildBasketSignals } from "@/lib/basketSignals";
import { getAssetClass } from "@/lib/cotMarkets";
import { validateMt5License } from "@/lib/mt5Licensing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const assetParam = url.searchParams.get("asset");
  const accountId =
    url.searchParams.get("account_id") ??
    request.headers.get("x-mt5-account-id") ??
    "";
  const server =
    url.searchParams.get("server") ??
    request.headers.get("x-mt5-server") ??
    "";
  const broker =
    url.searchParams.get("broker") ??
    request.headers.get("x-mt5-broker") ??
    "";
  const licenseKey = request.headers.get("x-mt5-license") ?? "";

  if (accountId.trim()) {
    const licenseCheck = await validateMt5License({
      accountId: accountId.trim(),
      licenseKey: licenseKey.trim(),
      server: server.trim(),
      broker: broker.trim(),
    });
    if (!licenseCheck.ok) {
      return NextResponse.json(
        {
          report_date: "",
          last_refresh_utc: "",
          asset_class: assetParam && assetParam !== "all" ? getAssetClass(assetParam) : "all",
          trading_allowed: false,
          reason: `license_blocked:${licenseCheck.reason}`,
          week_open_utc: "",
          pairs: [],
        },
        { status: 401 },
      );
    }
  }

  const payload = await buildBasketSignals({
    assetClass: assetParam && assetParam !== "all" ? getAssetClass(assetParam) : "all",
  });
  return NextResponse.json(payload, { headers: { "Cache-Control": "no-store" } });
}
