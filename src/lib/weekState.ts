import { DateTime } from "luxon";

/**
 * Week state types for UI rendering and data fetching
 */
export type WeekState =
  | "upcoming" // Future week (next week before it starts)
  | "current-live" // Current week with data available
  | "current-wait" // Current week but data not yet available
  | "historical"; // Past completed week

/**
 * Comprehensive week state information
 */
export type WeekStateInfo = {
  state: WeekState;
  weekOpenUtc: string;
  isSelectable: boolean;
  showPlaceholder: boolean;
  canShowPlannedTrades: boolean;
  label: string;
};

/**
 * Week option type - can be a specific week ISO string or "all"
 */
export type WeekOption = string | "all";

/**
 * Determines the state of a given week relative to the current week
 *
 * @param weekOpenUtc - ISO string of the week to check
 * @param currentWeekOpenUtc - ISO string of the current week
 * @param hasData - Whether data exists for this week (snapshots, trades, etc.)
 * @returns Comprehensive week state information
 */
export function getWeekState(
  weekOpenUtc: string,
  currentWeekOpenUtc: string,
  hasData: boolean = true
): WeekStateInfo {
  const weekTime = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
  const currentTime = DateTime.fromISO(currentWeekOpenUtc, { zone: "utc" });

  if (!weekTime.isValid || !currentTime.isValid) {
    return {
      state: "historical",
      weekOpenUtc,
      isSelectable: false,
      showPlaceholder: true,
      canShowPlannedTrades: false,
      label: "Invalid week",
    };
  }

  const weekMillis = weekTime.toMillis();
  const currentMillis = currentTime.toMillis();

  // Future week (upcoming)
  if (weekMillis > currentMillis) {
    return {
      state: "upcoming",
      weekOpenUtc,
      isSelectable: true,
      showPlaceholder: false,
      canShowPlannedTrades: true,
      label: "Upcoming week",
    };
  }

  // Current week
  if (weekMillis === currentMillis) {
    if (hasData) {
      return {
        state: "current-live",
        weekOpenUtc,
        isSelectable: true,
        showPlaceholder: false,
        canShowPlannedTrades: true,
        label: "Current week (live)",
      };
    } else {
      return {
        state: "current-wait",
        weekOpenUtc,
        isSelectable: true,
        showPlaceholder: true,
        canShowPlannedTrades: true,
        label: "Current week (pending data)",
      };
    }
  }

  // Historical week
  return {
    state: "historical",
    weekOpenUtc,
    isSelectable: true,
    showPlaceholder: false,
    canShowPlannedTrades: false,
    label: "Historical week",
  };
}

/**
 * Gets the next week's opening UTC timestamp
 *
 * @param currentWeekOpenUtc - ISO string of the current week
 * @returns ISO string of next week's opening
 */
export function getNextWeekOpen(currentWeekOpenUtc: string): string {
  const currentWeek = DateTime.fromISO(currentWeekOpenUtc, { zone: "utc" });
  if (!currentWeek.isValid) {
    return new Date().toISOString();
  }
  return currentWeek.plus({ days: 7 }).toISO() ?? new Date().toISOString();
}

/**
 * Gets the previous week's opening UTC timestamp
 *
 * @param weekOpenUtc - ISO string of a week
 * @returns ISO string of previous week's opening
 */
export function getPreviousWeekOpen(weekOpenUtc: string): string {
  const week = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
  if (!week.isValid) {
    return new Date().toISOString();
  }
  return week.minus({ days: 7 }).toISO() ?? new Date().toISOString();
}

/**
 * Determines the best default week to display
 * Prefers: upcoming week > current week > most recent historical week
 *
 * @param availableWeeks - Array of available week ISO strings
 * @param currentWeekOpenUtc - ISO string of the current week
 * @returns The best default week to display
 */
export function getDefaultWeek(
  availableWeeks: WeekOption[],
  currentWeekOpenUtc: string
): WeekOption {
  // Filter out "all" option for comparison
  const weekStrings = availableWeeks.filter((w) => w !== "all") as string[];

  if (weekStrings.length === 0) {
    return currentWeekOpenUtc;
  }

  const nextWeek = getNextWeekOpen(currentWeekOpenUtc);

  // Prefer upcoming week if available
  if (weekStrings.includes(nextWeek)) {
    return nextWeek;
  }

  // Fall back to current week if available
  if (weekStrings.includes(currentWeekOpenUtc)) {
    return currentWeekOpenUtc;
  }

  // Otherwise return the most recent week
  return weekStrings[0] ?? currentWeekOpenUtc;
}

/**
 * Deduplicates week strings and sorts them in descending order (newest first)
 *
 * @param weeks - Array of week ISO strings (may contain duplicates)
 * @returns Deduplicated and sorted array
 */
export function deduplicateWeeks(weeks: string[]): string[] {
  const seen = new Set<string>();
  const unique: string[] = [];

  for (const week of weeks) {
    if (!seen.has(week)) {
      seen.add(week);
      unique.push(week);
    }
  }

  // Sort descending (newest first)
  return unique.sort((a, b) => {
    const aTime = DateTime.fromISO(a, { zone: "utc" }).toMillis();
    const bTime = DateTime.fromISO(b, { zone: "utc" }).toMillis();
    return bTime - aTime;
  });
}

/**
 * Checks if a week is in the future
 */
export function isWeekInFuture(weekOpenUtc: string, nowUtc: DateTime = DateTime.utc()): boolean {
  const week = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
  if (!week.isValid) return false;
  return week.toMillis() > nowUtc.toMillis();
}

/**
 * Checks if a week is the current week
 */
export function isCurrentWeek(weekOpenUtc: string, currentWeekOpenUtc: string): boolean {
  return weekOpenUtc === currentWeekOpenUtc;
}

/**
 * Checks if a week is historical (in the past)
 */
export function isWeekHistorical(weekOpenUtc: string, currentWeekOpenUtc: string): boolean {
  const week = DateTime.fromISO(weekOpenUtc, { zone: "utc" });
  const current = DateTime.fromISO(currentWeekOpenUtc, { zone: "utc" });
  if (!week.isValid || !current.isValid) return false;
  return week.toMillis() < current.toMillis();
}
