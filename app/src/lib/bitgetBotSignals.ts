/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: bitgetBotSignals.ts
 *
 * Description:
 * Pure signal utilities for Bitget Bot v2: session range building,
 * sweep/rejection/displacement detection, handshake evaluation, and
 * weekly tier classification logic ported from the validated backtest.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

export type Direction = "LONG" | "SHORT" | "NEUTRAL";
export type ConfidenceTier = "HIGH" | "MEDIUM" | "NEUTRAL";
export type SessionWindow =
  | "ASIA_LONDON_RANGE_NY_ENTRY"
  | "US_RANGE_ASIA_LONDON_ENTRY";

export type BotCandle = {
  ts: number;
  open: number;
  high: number;
  low: number;
  close: number;
  quoteVolume?: number | null;
};

export type SessionRange = {
  high: number;
  low: number;
  locked: boolean;
};

export type SweepSignal = {
  direction: "LONG" | "SHORT";
  sweepTs: number;
  confirmTs: number;
  sweepPct: number;
  sweepPrice: number;
  displacementPct: number;
  sweepToEntryBars: number;
};

export type SignalDiagnostics = {
  sweepEvents: number;
  skippedWrongDirection: number;
  skippedNoRejection: number;
  skippedNoDisplacement: number;
};

export type UnqualifiedSweep = {
  direction: "LONG" | "SHORT";
  sweepTs: number;
  sweepPct: number;
  sweepPrice: number;
  reason: "no_rejection" | "no_displacement" | "wrong_direction";
  displacementPct?: number;
};

export type HandshakeEvaluation = {
  triggered: boolean;
  reason: "ok" | "single_symbol" | "timing_miss" | "no_signal";
  entryTs: number | null;
  delayMinutes: number | null;
};

export type WeeklyBiasClassification = {
  direction: Direction;
  tier: ConfidenceTier;
  votes: { long: number; short: number; neutral: number };
};

const SWEEP_MIN_PCT = 0.1;
const NEUTRAL_SWEEP_MIN_PCT = 0.3;
const DISPLACEMENT_BODY_MIN_PCT = 0.1;

function getUtcHour(ts: number) {
  return new Date(ts).getUTCHours();
}

function getUtcDay(ts: number) {
  return new Date(ts).toISOString().slice(0, 10);
}

function isAsiaSessionCandle(ts: number) {
  const hour = getUtcHour(ts);
  return hour >= 0 && hour < 8;
}

function isLondonSessionCandle(ts: number) {
  const hour = getUtcHour(ts);
  return hour >= 8 && hour < 13;
}

function isNySessionCandle(ts: number) {
  const hour = getUtcHour(ts);
  return hour >= 13 && hour < 21;
}

function normalizeDirection(value: string): Direction {
  const normalized = value.trim().toUpperCase();
  if (normalized === "LONG") return "LONG";
  if (normalized === "SHORT") return "SHORT";
  return "NEUTRAL";
}

function allowedDirectionsForBias(
  biasDirection: Direction,
  tier: ConfidenceTier,
): Array<"LONG" | "SHORT"> {
  if (tier === "NEUTRAL" || biasDirection === "NEUTRAL") {
    return ["LONG", "SHORT"];
  }
  return biasDirection === "LONG" ? ["LONG"] : ["SHORT"];
}

export function buildAsiaLondonRange(candles1m: BotCandle[]): Map<string, SessionRange> {
  const dayMap = new Map<string, { asia: BotCandle[]; london: BotCandle[] }>();

  for (const candle of candles1m) {
    const day = getUtcDay(candle.ts);
    if (!dayMap.has(day)) {
      dayMap.set(day, { asia: [], london: [] });
    }
    const bucket = dayMap.get(day);
    if (!bucket) continue;
    if (isAsiaSessionCandle(candle.ts)) bucket.asia.push(candle);
    if (isLondonSessionCandle(candle.ts)) bucket.london.push(candle);
  }

  const ranges = new Map<string, SessionRange>();
  for (const [day, sessions] of dayMap.entries()) {
    if (!sessions.asia.length || !sessions.london.length) continue;
    const asiaHigh = Math.max(...sessions.asia.map((c) => c.high));
    const asiaLow = Math.min(...sessions.asia.map((c) => c.low));
    const londonHigh = Math.max(...sessions.london.map((c) => c.high));
    const londonLow = Math.min(...sessions.london.map((c) => c.low));
    ranges.set(day, {
      high: Math.max(asiaHigh, londonHigh),
      low: Math.min(asiaLow, londonLow),
      locked: true,
    });
  }

  return ranges;
}

export function buildUsSessionRange(candles1m: BotCandle[]): Map<string, SessionRange> {
  const dayMap = new Map<string, BotCandle[]>();
  for (const candle of candles1m) {
    if (!isNySessionCandle(candle.ts)) continue;
    const day = getUtcDay(candle.ts);
    if (!dayMap.has(day)) dayMap.set(day, []);
    dayMap.get(day)?.push(candle);
  }

  const ranges = new Map<string, SessionRange>();
  for (const [day, session] of dayMap.entries()) {
    if (!session.length) continue;
    ranges.set(day, {
      high: Math.max(...session.map((c) => c.high)),
      low: Math.min(...session.map((c) => c.low)),
      locked: true,
    });
  }

  return ranges;
}

export function detectSignalForWindow(
  range: SessionRange,
  candles: BotCandle[],
  biasDirection: Direction,
  tier: ConfidenceTier,
): { signal: SweepSignal | null; diagnostics: SignalDiagnostics; bestUnqualified: UnqualifiedSweep | null } {
  const diagnostics: SignalDiagnostics = {
    sweepEvents: 0,
    skippedWrongDirection: 0,
    skippedNoRejection: 0,
    skippedNoDisplacement: 0,
  };
  let bestUnqualified: UnqualifiedSweep | null = null;

  if (!candles.length || !range.locked) {
    return { signal: null, diagnostics, bestUnqualified };
  }

  const allowedDirections = allowedDirectionsForBias(biasDirection, tier);
  const minSweep = tier === "NEUTRAL" ? NEUTRAL_SWEEP_MIN_PCT : SWEEP_MIN_PCT;

  function trackUnqualified(dir: "LONG" | "SHORT", sweepPct: number, wick: number, ts: number, reason: UnqualifiedSweep["reason"], displacementPct?: number) {
    if (!bestUnqualified || sweepPct > bestUnqualified.sweepPct) {
      bestUnqualified = { direction: dir, sweepTs: ts, sweepPct, sweepPrice: wick, reason, displacementPct };
    }
  }

  for (let i = 0; i < candles.length; i += 1) {
    const sweepCandle = candles[i];
    const nextCandle = i + 1 < candles.length ? candles[i + 1] : null;

    const upSweepPct = ((sweepCandle.high - range.high) / range.high) * 100;
    const downSweepPct = ((range.low - sweepCandle.low) / range.low) * 100;

    const candidates: Array<{ dir: "LONG" | "SHORT"; sweepPct: number; wick: number }> = [];
    if (upSweepPct >= minSweep) {
      candidates.push({ dir: "SHORT", sweepPct: upSweepPct, wick: sweepCandle.high });
    }
    if (downSweepPct >= minSweep) {
      candidates.push({ dir: "LONG", sweepPct: downSweepPct, wick: sweepCandle.low });
    }

    diagnostics.sweepEvents += candidates.length;
    if (!candidates.length) continue;

    for (const candidate of candidates) {
      if (!allowedDirections.includes(candidate.dir)) {
        diagnostics.skippedWrongDirection += 1;
        trackUnqualified(candidate.dir, candidate.sweepPct, candidate.wick, sweepCandle.ts, "wrong_direction");
        continue;
      }

      const confirmChoices: Array<{ candle: BotCandle; barsAhead: number }> = [
        { candle: sweepCandle, barsAhead: 0 },
      ];
      if (nextCandle) {
        confirmChoices.push({ candle: nextCandle, barsAhead: 1 });
      }

      let rejection: { candle: BotCandle; barsAhead: number } | null = null;
      for (const choice of confirmChoices) {
        if (candidate.dir === "SHORT" && choice.candle.close < range.high) {
          rejection = choice;
          break;
        }
        if (candidate.dir === "LONG" && choice.candle.close > range.low) {
          rejection = choice;
          break;
        }
      }

      if (!rejection) {
        diagnostics.skippedNoRejection += 1;
        trackUnqualified(candidate.dir, candidate.sweepPct, candidate.wick, sweepCandle.ts, "no_rejection");
        continue;
      }

      const bodyPct = candidate.dir === "SHORT"
        ? ((rejection.candle.open - rejection.candle.close) / rejection.candle.open) * 100
        : ((rejection.candle.close - rejection.candle.open) / rejection.candle.open) * 100;

      if (!(bodyPct >= DISPLACEMENT_BODY_MIN_PCT)) {
        diagnostics.skippedNoDisplacement += 1;
        trackUnqualified(candidate.dir, candidate.sweepPct, candidate.wick, sweepCandle.ts, "no_displacement", bodyPct);
        continue;
      }

      return {
        signal: {
          direction: candidate.dir,
          sweepTs: sweepCandle.ts,
          confirmTs: rejection.candle.ts,
          sweepPct: candidate.sweepPct,
          sweepPrice: candidate.wick,
          displacementPct: bodyPct,
          sweepToEntryBars: rejection.barsAhead,
        },
        diagnostics,
        bestUnqualified,
      };
    }
  }

  return { signal: null, diagnostics, bestUnqualified };
}

export function evaluateHandshake(
  btcSignal: SweepSignal | null,
  ethSignal: SweepSignal | null,
  windowMinutes: number,
): HandshakeEvaluation {
  if (!btcSignal && !ethSignal) {
    return { triggered: false, reason: "no_signal", entryTs: null, delayMinutes: null };
  }
  if (!btcSignal || !ethSignal) {
    return { triggered: false, reason: "single_symbol", entryTs: null, delayMinutes: null };
  }

  const delayMs = Math.abs(btcSignal.confirmTs - ethSignal.confirmTs);
  const maxDelayMs = Math.max(0, windowMinutes) * 60_000;
  if (delayMs > maxDelayMs) {
    return {
      triggered: false,
      reason: "timing_miss",
      entryTs: null,
      delayMinutes: delayMs / 60_000,
    };
  }

  return {
    triggered: true,
    reason: "ok",
    entryTs: Math.max(btcSignal.confirmTs, ethSignal.confirmTs),
    delayMinutes: delayMs / 60_000,
  };
}

export function classifyWeeklyBias(
  cotDealer: string,
  cotCommercial: string,
  sentiment: string,
): WeeklyBiasClassification {
  const dealer = normalizeDirection(cotDealer);
  const commercial = normalizeDirection(cotCommercial);
  const sentimentDirection = normalizeDirection(sentiment);

  const directions = [dealer, commercial, sentimentDirection];
  const long = directions.filter((d) => d === "LONG").length;
  const short = directions.filter((d) => d === "SHORT").length;
  const neutral = directions.length - long - short;

  if (long === 3) {
    return { direction: "LONG", tier: "HIGH", votes: { long, short, neutral } };
  }
  if (short === 3) {
    return { direction: "SHORT", tier: "HIGH", votes: { long, short, neutral } };
  }
  if (long >= 2) {
    return { direction: "LONG", tier: "MEDIUM", votes: { long, short, neutral } };
  }
  if (short >= 2) {
    return { direction: "SHORT", tier: "MEDIUM", votes: { long, short, neutral } };
  }
  return { direction: "NEUTRAL", tier: "NEUTRAL", votes: { long, short, neutral } };
}
