import { DateTime } from "luxon";

import { fetchOandaCandleSeries } from "@/lib/oandaPrices";

export type WeeklyForwardSignalDirection = "LONG" | "SHORT" | "NEUTRAL";
export type WeeklyForwardSignalTier = "HIGH" | "MEDIUM" | "LOW" | "NEUTRAL";

export type WeeklyForwardSignalInput = {
  pair: string;
  direction: WeeklyForwardSignalDirection;
  tier: WeeklyForwardSignalTier;
  gateReasons: string[];
};

export type WeeklyForwardSummaryRow = WeeklyForwardSignalInput & {
  liveDriftPct: number | null;
};

export type WeeklyForwardSeriesPoint = {
  ts: number;
  driftPct: number;
};

export type WeeklyForwardSummaryResult = {
  generatedUtc: string;
  currentWeekOpenUtc: string;
  basketPnlPct: number | null;
  basketMaxDrawdownPct: number | null;
  rows: WeeklyForwardSummaryRow[];
  pairSeries: Record<string, WeeklyForwardSeriesPoint[]>;
};

function computeDirectionalPct(
  open: number,
  close: number,
  direction: WeeklyForwardSignalDirection,
) {
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

export async function buildWeeklyForwardSummary(options: {
  currentWeekOpenUtc: string;
  signals: WeeklyForwardSignalInput[];
}) {
  const weekOpenUtc = DateTime.fromISO(options.currentWeekOpenUtc, { zone: "utc" });
  if (!weekOpenUtc.isValid) {
    throw new Error("currentWeekOpenUtc is required");
  }

  const signals = options.signals.filter((signal) => signal.direction !== "NEUTRAL");
  const nowUtc = DateTime.utc();
  const seriesByPair = new Map<string, WeeklyForwardSeriesPoint[]>();

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
        .filter((point): point is WeeklyForwardSeriesPoint => point.driftPct !== null);

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

  return {
    generatedUtc: nowUtc.toISO() ?? new Date().toISOString(),
    currentWeekOpenUtc: options.currentWeekOpenUtc,
    basketPnlPct:
      rows.length > 0
        ? rows.reduce((sum, row) => sum + (row.liveDriftPct ?? 0), 0)
        : null,
    basketMaxDrawdownPct:
      basketCurve.length > 0 ? computeMaxDrawdownFromCurve(basketCurve) : null,
    rows,
    pairSeries: Object.fromEntries(seriesByPair.entries()),
  } satisfies WeeklyForwardSummaryResult;
}
