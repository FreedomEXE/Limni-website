import type { StrategyClientPayload } from "@/lib/performance/strategyClientPayload";

const ALL_TIME_WEEK_KEY = "all";

function hasRecordKey<T>(record: Record<string, T> | null | undefined, key: string) {
  return Boolean(record && Object.prototype.hasOwnProperty.call(record, key));
}

function recordHasHistoricalWeek<T>(
  record: Record<string, T> | null | undefined,
  currentWeekOpenUtc: string | undefined,
) {
  if (!record) return false;
  return Object.keys(record).some((key) => (
    key !== ALL_TIME_WEEK_KEY &&
    key !== currentWeekOpenUtc
  ));
}

export function hasHistoricalStrategyPayload(payload: StrategyClientPayload | null | undefined) {
  if (!payload) return false;
  if (hasRecordKey(payload.engineWeekMap, ALL_TIME_WEEK_KEY)) return true;
  if (hasRecordKey(payload.engineSimMap, ALL_TIME_WEEK_KEY)) return true;
  if (hasRecordKey(payload.engineWeekResults, ALL_TIME_WEEK_KEY)) return true;

  const currentWeekOpenUtc = payload.currentWeekOpenUtc;
  return (
    recordHasHistoricalWeek(payload.engineWeekMap, currentWeekOpenUtc) ||
    recordHasHistoricalWeek(payload.engineSimMap, currentWeekOpenUtc) ||
    recordHasHistoricalWeek(payload.engineWeekResults, currentWeekOpenUtc)
  );
}

export function mergeStrategyWeekOptions(
  previous: string[] | undefined,
  next: string[] | undefined,
  currentWeekOpenUtc?: string,
) {
  if (!next) return previous;
  if (!previous) return next;

  const merged: string[] = [];
  const add = (week: string | undefined) => {
    if (!week || merged.includes(week)) return;
    merged.push(week);
  };

  if (previous.includes(ALL_TIME_WEEK_KEY) || next.includes(ALL_TIME_WEEK_KEY)) {
    add(ALL_TIME_WEEK_KEY);
  }
  add(currentWeekOpenUtc);

  for (const week of next) {
    if (week !== ALL_TIME_WEEK_KEY && week !== currentWeekOpenUtc) add(week);
  }
  for (const week of previous) {
    if (week !== ALL_TIME_WEEK_KEY && week !== currentWeekOpenUtc) add(week);
  }

  return merged;
}
