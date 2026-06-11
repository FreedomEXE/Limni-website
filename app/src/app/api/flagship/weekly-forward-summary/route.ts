import { NextResponse } from "next/server";

import {
  buildWeeklyForwardSummary,
  type WeeklyForwardSignalDirection,
  type WeeklyForwardSignalInput,
  type WeeklyForwardSignalTier,
} from "@/lib/flagship/weeklyForwardSummary";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type WeeklyForwardSummaryRequest = {
  currentWeekOpenUtc: string | null;
  signals: WeeklyForwardSignalInput[];
};

function normalizeDirection(value: unknown): WeeklyForwardSignalDirection {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (normalized === "LONG" || normalized === "SHORT") return normalized;
  return "NEUTRAL";
}

function normalizeTier(value: unknown): WeeklyForwardSignalTier {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (normalized === "HIGH" || normalized === "MEDIUM" || normalized === "LOW") return normalized;
  return "NEUTRAL";
}

function normalizeSignals(value: unknown): WeeklyForwardSignalInput[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const record = row as Record<string, unknown>;
      const pair = String(record.pair ?? "").trim().toUpperCase();
      if (!pair) return null;
      return {
        pair,
        direction: normalizeDirection(record.direction),
        tier: normalizeTier(record.tier),
        gateReasons: Array.isArray(record.gateReasons)
          ? record.gateReasons.map((reason) => String(reason)).filter(Boolean)
          : [],
      } satisfies WeeklyForwardSignalInput;
    })
    .filter((row): row is WeeklyForwardSignalInput => Boolean(row));
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as WeeklyForwardSummaryRequest;
    const currentWeekOpenUtc = String(body.currentWeekOpenUtc ?? "").trim();
    const summary = await buildWeeklyForwardSummary({
      currentWeekOpenUtc,
      signals: normalizeSignals(body.signals),
    });

    return NextResponse.json({
      generatedUtc: summary.generatedUtc,
      currentWeekOpenUtc: summary.currentWeekOpenUtc,
      basketPnlPct: summary.basketPnlPct,
      basketMaxDrawdownPct: summary.basketMaxDrawdownPct,
      rows: summary.rows,
      pairSeries: summary.pairSeries,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to build weekly forward summary",
      },
      { status: 500 },
    );
  }
}
