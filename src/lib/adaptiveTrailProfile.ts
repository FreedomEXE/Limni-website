import { buildUniversalBasketSummary } from "@/lib/universalBasket";

export type AdaptiveTrailProfile = {
  trail_profile_source: string;
  trail_profile_generated_at_utc: string;
  trail_profile_strategy_id?: string;
  adaptive_avg_peak_pct: number;
  adaptive_peak_count: number;
  adaptive_peak_sum_pct: number;
  adaptive_start_multiplier: number;
  adaptive_offset_fraction: number;
  adaptive_trail_start_pct: number;
  adaptive_trail_offset_pct: number;
};

const DEFAULT_START_MULTIPLIER = 0.65;
const DEFAULT_OFFSET_FRACTION = 0.25;
const DEFAULT_MIN_START = 30;
const DEFAULT_MAX_START = 130;
const DEFAULT_MIN_OFFSET = 8;
const DEFAULT_MAX_OFFSET = 45;
const CACHE_TTL_MS = 60_000;
const STRATEGY_CACHE_TTL_MS = 10 * 60_000;

// Research-backed fallback from latest validated universal runs.
const DEFAULT_AVG_PEAK_PCT = 144.505;
const DEFAULT_PEAK_COUNT = 4;
const DEFAULT_FALLBACK_TRAIL_START_PCT = 100;
const DEFAULT_FALLBACK_TRAIL_OFFSET_PCT = 30;

const cachedProfiles = new Map<string, { profile: AdaptiveTrailProfile; atMs: number }>();

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max));
}

function readEnvNumber(name: string): number | null {
  const raw = process.env[name];
  if (!raw) {
    return null;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function buildFallbackProfile(options?: {
  strategyVariantId?: string | null;
  source?: string;
  avgPeak?: number;
  peakCount?: number;
  startMultiplier?: number;
  offsetFraction?: number;
  fixedStartPct?: number | null;
  fixedOffsetPct?: number | null;
}): AdaptiveTrailProfile {
  const avgPeak = options?.avgPeak ?? DEFAULT_AVG_PEAK_PCT;
  const peakCount = Math.max(1, Math.round(options?.peakCount ?? DEFAULT_PEAK_COUNT));
  const peakSum = avgPeak * peakCount;
  const startMultiplier = options?.startMultiplier ?? (readEnvNumber("TRAIL_ADAPTIVE_START_MULT") ?? DEFAULT_START_MULTIPLIER);
  const offsetFraction = options?.offsetFraction ?? (readEnvNumber("TRAIL_ADAPTIVE_OFFSET_FRAC") ?? DEFAULT_OFFSET_FRACTION);
  const computedStart = clamp(avgPeak * startMultiplier, DEFAULT_MIN_START, DEFAULT_MAX_START);
  const computedOffset = clamp(computedStart * offsetFraction, DEFAULT_MIN_OFFSET, DEFAULT_MAX_OFFSET);
  const start = options?.fixedStartPct ?? computedStart;
  const offset = options?.fixedOffsetPct ?? computedOffset;

  return {
    trail_profile_source: options?.source ?? "env_or_fallback",
    trail_profile_generated_at_utc: new Date().toISOString(),
    trail_profile_strategy_id: options?.strategyVariantId?.trim() || undefined,
    adaptive_avg_peak_pct: avgPeak,
    adaptive_peak_count: peakCount,
    adaptive_peak_sum_pct: peakSum,
    adaptive_start_multiplier: startMultiplier,
    adaptive_offset_fraction: offsetFraction,
    adaptive_trail_start_pct: start,
    adaptive_trail_offset_pct: offset,
  };
}

async function buildUniversalV1AdaptiveTrailProfile(strategyVariantId: string): Promise<AdaptiveTrailProfile> {
  try {
    const limitWeeks = Math.max(
      1,
      Math.round(readEnvNumber("TRAIL_ADAPTIVE_MAX_WEEKS") ?? 260),
    );
    const summary = await buildUniversalBasketSummary({
      timeframe: "M1",
      includeCurrentWeek: false,
      limitWeeks,
    });
    const peaks = summary.by_week
      .map((row) => row.observed_peak_percent)
      .filter((value) => Number.isFinite(value) && value > 0);

    if (peaks.length > 0) {
      const peakSum = peaks.reduce((sum, value) => sum + value, 0);
      const peakCount = peaks.length;
      const avgPeak = peakSum / peakCount;
      const startMultiplier =
        readEnvNumber("TRAIL_ADAPTIVE_START_MULT") ?? DEFAULT_START_MULTIPLIER;
      const offsetFraction =
        readEnvNumber("TRAIL_ADAPTIVE_OFFSET_FRAC") ?? DEFAULT_OFFSET_FRACTION;
      const start = clamp(avgPeak * startMultiplier, DEFAULT_MIN_START, DEFAULT_MAX_START);
      const offset = clamp(start * offsetFraction, DEFAULT_MIN_OFFSET, DEFAULT_MAX_OFFSET);
      return {
        trail_profile_source: "strategy_db_history",
        trail_profile_generated_at_utc: new Date().toISOString(),
        trail_profile_strategy_id: strategyVariantId,
        adaptive_avg_peak_pct: avgPeak,
        adaptive_peak_count: peakCount,
        adaptive_peak_sum_pct: peakSum,
        adaptive_start_multiplier: startMultiplier,
        adaptive_offset_fraction: offsetFraction,
        adaptive_trail_start_pct: start,
        adaptive_trail_offset_pct: offset,
      };
    }
  } catch (error) {
    console.warn(`Adaptive trail profile build failed for ${strategyVariantId}:`, error);
  }

  // Strategy fallback: fixed 100/30 until DB-backed strategy history is available.
  return buildFallbackProfile({
    strategyVariantId,
    source: "strategy_fallback_100_30",
    avgPeak: readEnvNumber("TRAIL_ADAPTIVE_FALLBACK_AVG_PEAK_PCT") ?? 100,
    peakCount: 1,
    fixedStartPct: readEnvNumber("TRAIL_ADAPTIVE_FALLBACK_START_PCT") ?? DEFAULT_FALLBACK_TRAIL_START_PCT,
    fixedOffsetPct: readEnvNumber("TRAIL_ADAPTIVE_FALLBACK_OFFSET_PCT") ?? DEFAULT_FALLBACK_TRAIL_OFFSET_PCT,
  });
}

export async function getAdaptiveTrailProfile(options?: {
  strategyVariantId?: string | null;
}): Promise<AdaptiveTrailProfile | null> {
  const now = Date.now();
  const strategyVariantId = options?.strategyVariantId?.trim() || "";
  const cacheKey = strategyVariantId ? `strategy:${strategyVariantId}` : "default";
  const ttl = strategyVariantId ? STRATEGY_CACHE_TTL_MS : CACHE_TTL_MS;
  const cached = cachedProfiles.get(cacheKey);
  if (cached && now - cached.atMs < ttl) {
    return cached.profile;
  }

  let profile: AdaptiveTrailProfile;
  if (strategyVariantId === "universal_v1") {
    profile = await buildUniversalV1AdaptiveTrailProfile(strategyVariantId);
  } else if (strategyVariantId) {
    profile = buildFallbackProfile({
      strategyVariantId,
      source: "strategy_fallback_100_30",
      avgPeak: readEnvNumber("TRAIL_ADAPTIVE_FALLBACK_AVG_PEAK_PCT") ?? 100,
      peakCount: 1,
      fixedStartPct: readEnvNumber("TRAIL_ADAPTIVE_FALLBACK_START_PCT") ?? DEFAULT_FALLBACK_TRAIL_START_PCT,
      fixedOffsetPct: readEnvNumber("TRAIL_ADAPTIVE_FALLBACK_OFFSET_PCT") ?? DEFAULT_FALLBACK_TRAIL_OFFSET_PCT,
    });
  } else {
    const avgPeak = readEnvNumber("TRAIL_ADAPTIVE_AVG_PEAK_PCT") ?? DEFAULT_AVG_PEAK_PCT;
    const peakCount = Math.max(
      1,
      Math.round(readEnvNumber("TRAIL_ADAPTIVE_PEAK_COUNT") ?? DEFAULT_PEAK_COUNT),
    );
    profile = buildFallbackProfile({
      source: "env_or_fallback",
      avgPeak,
      peakCount,
      startMultiplier: readEnvNumber("TRAIL_ADAPTIVE_START_MULT") ?? DEFAULT_START_MULTIPLIER,
      offsetFraction: readEnvNumber("TRAIL_ADAPTIVE_OFFSET_FRAC") ?? DEFAULT_OFFSET_FRACTION,
    });
  }

  cachedProfiles.set(cacheKey, { profile, atMs: now });
  return profile;
}
