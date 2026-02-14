import { DateTime } from "luxon";
import { deduplicateWeeks, type WeekOption } from "@/lib/weekState";

type BuildWeekOptionsInput = {
  historicalWeeks: string[];
  currentWeekOpenUtc: string;
  includeAll?: boolean;
  includeCurrent?: boolean;
  includeFuture?: boolean;
  currentPosition?: "first" | "sorted";
  limit?: number;
  filterWeek?: (weekOpenUtc: string) => boolean;
};

function sortDesc(weeks: string[]) {
  return [...weeks].sort((a, b) => {
    const aMs = DateTime.fromISO(a, { zone: "utc" }).toMillis();
    const bMs = DateTime.fromISO(b, { zone: "utc" }).toMillis();
    return bMs - aMs;
  });
}

export function buildNormalizedWeekOptions(input: BuildWeekOptionsInput): WeekOption[] {
  const {
    historicalWeeks,
    currentWeekOpenUtc,
    includeAll = true,
    includeCurrent = true,
    includeFuture = false,
    currentPosition = "first",
    limit,
    filterWeek,
  } = input;

  const currentMs = DateTime.fromISO(currentWeekOpenUtc, { zone: "utc" }).toMillis();
  const deduped = deduplicateWeeks(historicalWeeks);
  const filtered = deduped.filter((week) => {
    const weekMs = DateTime.fromISO(week, { zone: "utc" }).toMillis();
    if (!Number.isFinite(weekMs)) return false;
    if (!includeFuture && Number.isFinite(currentMs) && weekMs > currentMs) return false;
    if (filterWeek && !filterWeek(week)) return false;
    return true;
  });

  const ordered: string[] = [];
  const seen = new Set<string>();
  const push = (week: string | null | undefined) => {
    if (!week) return;
    if (seen.has(week)) return;
    if (filterWeek && !filterWeek(week)) return;
    seen.add(week);
    ordered.push(week);
  };

  if (currentPosition === "first") {
    if (includeCurrent) {
      push(currentWeekOpenUtc);
    }
    for (const week of sortDesc(filtered)) {
      push(week);
    }
  } else {
    const combined = [...filtered];
    if (includeCurrent) {
      combined.push(currentWeekOpenUtc);
    }
    for (const week of sortDesc(combined)) {
      push(week);
    }
  }

  const limited =
    typeof limit === "number" && Number.isFinite(limit) && limit > 0
      ? ordered.slice(0, limit)
      : ordered;

  return includeAll ? ["all", ...limited] : limited;
}

type BuildDataWeekOptionsInput = {
  historicalWeeks: string[];
  currentWeekOpenUtc: string;
  includeAll?: boolean;
  limit?: number;
  maxFutureWeeks?: number;
};

export function buildDataWeekOptions(input: BuildDataWeekOptionsInput): WeekOption[] {
  const {
    historicalWeeks,
    currentWeekOpenUtc,
    includeAll = false,
    limit,
    maxFutureWeeks = 1,
  } = input;
  const currentMs = DateTime.fromISO(currentWeekOpenUtc, { zone: "utc" }).toMillis();
  const futureCapMs =
    Number.isFinite(currentMs) && maxFutureWeeks >= 0
      ? currentMs + maxFutureWeeks * 7 * 24 * 60 * 60 * 1000
      : Number.POSITIVE_INFINITY;

  return buildNormalizedWeekOptions({
    historicalWeeks,
    currentWeekOpenUtc,
    includeAll,
    includeCurrent: true,
    includeFuture: true,
    currentPosition: "sorted",
    limit,
    filterWeek: (weekOpenUtc) => {
      const weekMs = DateTime.fromISO(weekOpenUtc, { zone: "utc" }).toMillis();
      if (!Number.isFinite(weekMs)) {
        return false;
      }
      return weekMs <= futureCapMs;
    },
  });
}

type ResolveWeekSelectionInput = {
  requestedWeek: string | null | undefined;
  weekOptions: WeekOption[];
  currentWeekOpenUtc: string;
  allowAll?: boolean;
};

export function resolveWeekSelection(input: ResolveWeekSelectionInput): WeekOption | null {
  const {
    requestedWeek,
    weekOptions,
    currentWeekOpenUtc,
    allowAll = true,
  } = input;
  if (requestedWeek === "all") {
    return allowAll ? "all" : null;
  }
  if (requestedWeek && weekOptions.includes(requestedWeek)) {
    return requestedWeek;
  }
  const firstDataWeek = weekOptions.find((week) => week !== "all") ?? null;
  if (firstDataWeek) {
    return firstDataWeek;
  }
  if (weekOptions.includes(currentWeekOpenUtc)) {
    return currentWeekOpenUtc;
  }
  return currentWeekOpenUtc ?? null;
}
