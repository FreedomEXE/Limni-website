export function buildWeekOptionsWithCurrentAndNext<T extends string>(
  existing: T[],
  currentWeekOpenUtc: T,
  nextWeekOpenUtc: T | null,
  limit?: number,
) {
  const ordered: T[] = [];
  const seen = new Set<string>();

  const push = (value: T | null) => {
    if (!value) return;
    const key = String(value);
    if (seen.has(key)) return;
    ordered.push(value);
    seen.add(key);
  };

  push(currentWeekOpenUtc);
  push(nextWeekOpenUtc);
  for (const week of existing) {
    push(week);
  }

  if (typeof limit === "number" && Number.isFinite(limit) && limit > 0) {
    return ordered.slice(0, limit);
  }
  return ordered;
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
