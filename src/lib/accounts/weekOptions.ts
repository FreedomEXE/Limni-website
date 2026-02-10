import { buildNormalizedWeekOptions } from "@/lib/weekOptions";

export function buildWeekOptionsWithCurrentAndNext<T extends string>(
  existing: T[],
  currentWeekOpenUtc: T,
  nextWeekOpenUtc: T | null,
  limit?: number,
) {
  void nextWeekOpenUtc;
  return buildNormalizedWeekOptions({
    historicalWeeks: existing as string[],
    currentWeekOpenUtc,
    includeAll: false,
    includeCurrent: true,
    includeFuture: false,
    limit,
  }) as T[];
}

export function resolveRequestedWeek<T extends string>(
  requestedWeek: string | null | undefined,
  options: T[],
  fallbackWeek: T,
) {
  if (requestedWeek && options.includes(requestedWeek as T)) {
    return requestedWeek as T;
  }
  if (options.includes(fallbackWeek)) {
    return fallbackWeek;
  }
  return options[0] ?? fallbackWeek;
}
