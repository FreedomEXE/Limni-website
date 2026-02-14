export type AdaptiveTrailProfile = {
  trail_profile_source: string;
  trail_profile_generated_at_utc: string;
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

// Research-backed fallback from latest validated universal runs.
const DEFAULT_AVG_PEAK_PCT = 144.505;
const DEFAULT_PEAK_COUNT = 4;

let cachedProfile: AdaptiveTrailProfile | null = null;
let cachedAtMs = 0;

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

export async function getAdaptiveTrailProfile(): Promise<AdaptiveTrailProfile | null> {
  const now = Date.now();
  if (cachedProfile && now - cachedAtMs < CACHE_TTL_MS) {
    return cachedProfile;
  }

  const avgPeak = readEnvNumber("TRAIL_ADAPTIVE_AVG_PEAK_PCT") ?? DEFAULT_AVG_PEAK_PCT;
  const peakCount = Math.max(
    1,
    Math.round(readEnvNumber("TRAIL_ADAPTIVE_PEAK_COUNT") ?? DEFAULT_PEAK_COUNT),
  );
  const peakSum = readEnvNumber("TRAIL_ADAPTIVE_PEAK_SUM_PCT") ?? avgPeak * peakCount;
  const startMultiplier =
    readEnvNumber("TRAIL_ADAPTIVE_START_MULT") ?? DEFAULT_START_MULTIPLIER;
  const offsetFraction =
    readEnvNumber("TRAIL_ADAPTIVE_OFFSET_FRAC") ?? DEFAULT_OFFSET_FRACTION;

  const start = clamp(avgPeak * startMultiplier, DEFAULT_MIN_START, DEFAULT_MAX_START);
  const offset = clamp(start * offsetFraction, DEFAULT_MIN_OFFSET, DEFAULT_MAX_OFFSET);

  cachedProfile = {
    trail_profile_source: "env_or_fallback",
    trail_profile_generated_at_utc: new Date().toISOString(),
    adaptive_avg_peak_pct: avgPeak,
    adaptive_peak_count: peakCount,
    adaptive_peak_sum_pct: peakSum,
    adaptive_start_multiplier: startMultiplier,
    adaptive_offset_fraction: offsetFraction,
    adaptive_trail_start_pct: start,
    adaptive_trail_offset_pct: offset,
  };
  cachedAtMs = now;
  return cachedProfile;
}
