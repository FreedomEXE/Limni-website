import { DateTime } from "luxon";
import { NextResponse } from "next/server";

import { fetchOandaCandleSeries } from "@/lib/oandaPrices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SignalDirection = "LONG" | "SHORT" | "NEUTRAL";
type SignalTier = "HIGH" | "MEDIUM" | "NEUTRAL";

type WeeklyForwardSignalInput = {
  pair: string;
  direction: SignalDirection;
  tier: SignalTier;
  gateReasons: string[];
};

type WeeklyForwardSummaryRequest = {
  currentWeekOpenUtc: string | null;
  signals: WeeklyForwardSignalInput[];
};

type WeeklyForwardSummaryRow = WeeklyForwardSignalInput & {
  liveDriftPct: number | null;
};

function normalizeDirection(value: unknown): SignalDirection {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (normalized === "LONG" || normalized === "SHORT") return normalized;
  return "NEUTRAL";
}

function normalizeTier(value: unknown): SignalTier {
  const normalized = String(value ?? "").trim().toUpperCase();
  if (normalized === "HIGH" || normalized === "MEDIUM") return normalized;
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

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let cursor = 0;

  async function runWorker() {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= items.length) return;
      results[index] = await worker(items[index]!);
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => runWorker()));
  return results;
}

function computeDirectionalPct(open: number, close: number, direction: SignalDirection) {
  if (!Number.isFinite(open) || !Number.isFinite(close) || open <= 0) return null;
  const rawPct = ((close - open) / open) * 100;
  if (direction === "LONG") return rawPct;
  if (direction === "SHORT") return -rawPct;
  return 0;
}

function computeMaxDrawdownFromCurve(curve: number[]) {
  let peak = 0;
  let maxDrawdown = 0;
  for (const value of curve) {
    if (!Number.isFinite(value)) continue;
    if (value > peak) {
      peak = value;
      continue;
    }
    const drawdown = peak - value;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }
  return maxDrawdown;
}

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as WeeklyForwardSummaryRequest;
    const currentWeekOpenUtc = String(body.currentWeekOpenUtc ?? "").trim();
    const weekOpenUtc = DateTime.fromISO(currentWeekOpenUtc, { zone: "utc" });
    if (!weekOpenUtc.isValid) {
      return NextResponse.json(
        { error: "currentWeekOpenUtc is required" },
        { status: 400 },
      );
    }

    const signals = normalizeSignals(body.signals).filter((signal) => signal.direction !== "NEUTRAL");
    const nowUtc = DateTime.utc();
    const seriesByPair = new Map<string, Array<{ ts: number; driftPct: number }>>();

    const rows = await mapWithConcurrency(signals, 6, async (signal) => {
      try {
        const candles = await fetchOandaCandleSeries(signal.pair, weekOpenUtc, nowUtc);
        const ordered = [...candles].sort((left, right) => left.ts - right.ts);
        if (ordered.length === 0) {
          return {
            ...signal,
            liveDriftPct: null,
          } satisfies WeeklyForwardSummaryRow;
        }

        const open = ordered[0]!.open;
        const curve = ordered
          .map((candle) => ({
            ts: candle.ts,
            driftPct: computeDirectionalPct(open, candle.close, signal.direction),
          }))
          .filter((point): point is { ts: number; driftPct: number } => point.driftPct !== null);

        seriesByPair.set(signal.pair, curve);

        return {
          ...signal,
          liveDriftPct: curve[curve.length - 1]?.driftPct ?? null,
        } satisfies WeeklyForwardSummaryRow;
      } catch {
        return {
          ...signal,
          liveDriftPct: null,
        } satisfies WeeklyForwardSummaryRow;
      }
    });

    const timestamps = Array.from(
      new Set(
        Array.from(seriesByPair.values()).flatMap((series) => series.map((point) => point.ts)),
      ),
    ).sort((left, right) => left - right);

    const seriesCursorByPair = new Map<string, number>();
    const latestDriftByPair = new Map<string, number>();
    const basketCurve: number[] = [];

    for (const timestamp of timestamps) {
      for (const [pair, series] of seriesByPair.entries()) {
        const currentIndex = seriesCursorByPair.get(pair) ?? 0;
        let index = currentIndex;
        while (index < series.length && series[index]!.ts <= timestamp) {
          latestDriftByPair.set(pair, series[index]!.driftPct);
          index += 1;
        }
        seriesCursorByPair.set(pair, index);
      }

      basketCurve.push(
        Array.from(latestDriftByPair.values()).reduce((sum, value) => sum + value, 0),
      );
    }

    const basketPnlPct =
      rows.length > 0
        ? rows.reduce((sum, row) => sum + (row.liveDriftPct ?? 0), 0)
        : null;
    const basketMaxDrawdownPct =
      basketCurve.length > 0 ? computeMaxDrawdownFromCurve(basketCurve) : null;

    return NextResponse.json({
      generatedUtc: nowUtc.toISO(),
      currentWeekOpenUtc,
      basketPnlPct,
      basketMaxDrawdownPct,
      rows,
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
