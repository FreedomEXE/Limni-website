import { DateTime } from "luxon";
import { resolveWeekSelection } from "@/lib/weekOptions";

export type PerformanceView =
  | "summary"
  | "simulation"
  | "basket"
  | "research"
  | "notes";

export function resolvePerformanceView(value: string | null | undefined): PerformanceView {
  return value === "simulation" ||
    value === "basket" ||
    value === "research" ||
    value === "notes"
    ? value
    : "summary";
}

export function resolveSelectedPerformanceWeek(options: {
  weekParamValue: string | null | undefined;
  weekOptions: Array<string | "all">;
  currentWeekOpenUtc: string;
}) {
  const { weekParamValue, weekOptions, currentWeekOpenUtc } = options;
  return resolveWeekSelection({
    requestedWeek: weekParamValue,
    weekOptions,
    currentWeekOpenUtc,
    allowAll: true,
  }) as string | null;
}

export function buildPerformanceWeekFlags(options: {
  selectedWeek: string | null;
  currentWeekOpenUtc: string;
  tradingWeekOpenUtc?: string;
  hasSnapshots: boolean;
}) {
  const { selectedWeek, currentWeekOpenUtc, tradingWeekOpenUtc, hasSnapshots } = options;
  const isAllTimeSelected = selectedWeek === "all";
  const logicalCurrentWeekOpenUtc = tradingWeekOpenUtc ?? currentWeekOpenUtc;
  const currentWeekStart = DateTime.fromISO(logicalCurrentWeekOpenUtc, { zone: "utc" });
  const isCurrentWeekSelected =
    !isAllTimeSelected && selectedWeek != null && selectedWeek === logicalCurrentWeekOpenUtc;

  const isFutureWeekSelected = (() => {
    if (isAllTimeSelected || !selectedWeek) {
      return false;
    }
    const parsed = DateTime.fromISO(selectedWeek, { zone: "utc" });
    if (!parsed.isValid || !currentWeekStart.isValid) {
      return false;
    }
    return parsed.toMillis() > currentWeekStart.toMillis();
  })();

  const isHistoricalWeekSelected = (() => {
    if (isAllTimeSelected || !selectedWeek || !currentWeekStart.isValid) {
      return false;
    }
    const parsed = DateTime.fromISO(selectedWeek, { zone: "utc" });
    if (!parsed.isValid) {
      return false;
    }
    return parsed.toMillis() < currentWeekStart.toMillis();
  })();

  const isWaitingWeek = isFutureWeekSelected || (isCurrentWeekSelected && !hasSnapshots);

  return {
    isAllTimeSelected,
    isCurrentWeekSelected,
    isFutureWeekSelected,
    isHistoricalWeekSelected,
    isWaitingWeek,
  };
}
