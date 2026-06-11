/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: route.ts
 *
 * Description:
 * Read API for Flagship currency strength data. Returns latest 1h/4h/24h
 * snapshots or per-currency history on request.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { NextResponse } from "next/server";

import {
  MAJOR_CURRENCIES,
  type CurrencyStrengthWindow,
  readAllLatestStrengths,
  readCurrencyStrengthHistory,
} from "@/lib/currencyStrength";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function isWindow(value: string | null): value is CurrencyStrengthWindow {
  return value === "1h" || value === "4h" || value === "24h";
}

export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const windowRaw = url.searchParams.get("window");
    const currencyRaw = url.searchParams.get("currency")?.toUpperCase() ?? null;
    const hoursBack = Number(url.searchParams.get("hoursBack")) || 0;

    if (currencyRaw && hoursBack > 0 && windowRaw) {
      if (!MAJOR_CURRENCIES.includes(currencyRaw as (typeof MAJOR_CURRENCIES)[number])) {
        return NextResponse.json({ error: "Invalid currency" }, { status: 400 });
      }
      if (!isWindow(windowRaw)) {
        return NextResponse.json({ error: "Invalid window" }, { status: 400 });
      }
      const history = await readCurrencyStrengthHistory(
        currencyRaw as (typeof MAJOR_CURRENCIES)[number],
        windowRaw,
        hoursBack,
      );
      return NextResponse.json({
        currency: currencyRaw,
        window: windowRaw,
        history,
      });
    }

    const latest = await readAllLatestStrengths();
    return NextResponse.json({ strengths: latest });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to read currency strength" },
      { status: 500 },
    );
  }
}

