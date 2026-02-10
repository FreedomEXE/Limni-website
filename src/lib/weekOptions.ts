import { DateTime } from "luxon";
import { deduplicateWeeks, type WeekOption } from "@/lib/weekState";

type BuildWeekOptionsInput = {
  historicalWeeks: string[];
  currentWeekOpenUtc: string;
  includeAll?: boolean;
  includeCurrent?: boolean;
  includeFuture?: boolean;
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

  if (includeCurrent) {
    push(currentWeekOpenUtc);
  }

  for (const week of sortDesc(filtered)) {
    push(week);
  }

  const limited =
    typeof limit === "number" && Number.isFinite(limit) && limit > 0
      ? ordered.slice(0, limit)
      : ordered;

  return includeAll ? ["all", ...limited] : limited;
}
