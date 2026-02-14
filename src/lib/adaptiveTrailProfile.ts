import deepReport from "../../reports/universal-deep-analysis-latest.json";
import triggerReport from "../../reports/universal-v1-trigger-basis-comparison-latest.json";

type DeepAnalysisWeek = {
  peak_pct?: number;
};

type DeepAnalysisReport = {
  generated_at?: string;
  universal_weekly_metrics?: DeepAnalysisWeek[];
};

type TriggerBasisReport = {
  generated_at?: string;
  adaptive_start_mult?: number;
  adaptive_offset_frac?: number;
};

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

let cachedProfile: AdaptiveTrailProfile | null = null;
let cachedAtMs = 0;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max));
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
}

export async function getAdaptiveTrailProfile(): Promise<AdaptiveTrailProfile | null> {
  const now = Date.now();
  if (cachedProfile && now - cachedAtMs < CACHE_TTL_MS) {
    return cachedProfile;
  }

  const deep = deepReport as DeepAnalysisReport;
  const trigger = triggerReport as TriggerBasisReport;

  const peaks = (deep?.universal_weekly_metrics ?? [])
    .map((row) => toFiniteNumber(row.peak_pct))
    .filter((value): value is number => value !== null && value > 0);

  if (peaks.length === 0) {
    cachedProfile = null;
    cachedAtMs = now;
    return null;
  }

  const sum = peaks.reduce((acc, value) => acc + value, 0);
  const avg = sum / peaks.length;
  const startMultiplier = toFiniteNumber(trigger?.adaptive_start_mult) ?? DEFAULT_START_MULTIPLIER;
  const offsetFraction = toFiniteNumber(trigger?.adaptive_offset_frac) ?? DEFAULT_OFFSET_FRACTION;

  const start = clamp(avg * startMultiplier, DEFAULT_MIN_START, DEFAULT_MAX_START);
  const offset = clamp(start * offsetFraction, DEFAULT_MIN_OFFSET, DEFAULT_MAX_OFFSET);

  cachedProfile = {
    trail_profile_source: "reports",
    trail_profile_generated_at_utc:
      deep?.generated_at ?? trigger?.generated_at ?? new Date().toISOString(),
    adaptive_avg_peak_pct: avg,
    adaptive_peak_count: peaks.length,
    adaptive_peak_sum_pct: sum,
    adaptive_start_multiplier: startMultiplier,
    adaptive_offset_fraction: offsetFraction,
    adaptive_trail_start_pct: start,
    adaptive_trail_offset_pct: offset,
  };
  cachedAtMs = now;
  return cachedProfile;
}
