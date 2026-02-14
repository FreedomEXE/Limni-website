import { buildBasketSignals } from "@/lib/basketSignals";
import { signalsFromSnapshots } from "@/lib/plannedTrades";
import { readPerformanceSnapshotsByWeek, listWeekOptionsForAccount, getWeekOpenUtc } from "@/lib/performanceSnapshots";
import { getDefaultWeek, type WeekOption } from "@/lib/weekState";
import { getAccountStatsForWeek } from "@/lib/accountStats";
import { buildAccountEquityCurve } from "@/lib/accountEquityCurve";
import { buildDataWeekOptions, resolveWeekSelection } from "@/lib/weekOptions";
import { DateTime } from "luxon";
import { computeMaxDrawdown, computeStaticDrawdown, extendToWindow } from "@/lib/accounts/viewUtils";

export async function resolveConnectedWeekContext(options: {
  accountKey: string;
  weekParamValue: string | null;
}) {
  const { accountKey, weekParamValue } = options;
  const weekOptions = await listWeekOptionsForAccount(accountKey, true, 4);
  const currentWeekOpenUtc = getWeekOpenUtc();
  const weekOptionsWithUpcoming = buildDataWeekOptions({
    historicalWeeks: weekOptions.filter((week): week is string => week !== "all"),
    currentWeekOpenUtc,
    includeAll: true,
    limit: 4,
  }) as WeekOption[];
  const selectedWeek =
    resolveWeekSelection({
      requestedWeek: weekParamValue,
      weekOptions: weekOptionsWithUpcoming,
      currentWeekOpenUtc,
      allowAll: true,
    }) ?? getDefaultWeek(weekOptionsWithUpcoming, currentWeekOpenUtc);

  return {
    currentWeekOpenUtc,
    nextWeekOpenUtc: null,
    weekOptionsWithUpcoming,
    selectedWeek,
  };
}

export async function loadConnectedWeekData(options: {
  accountKey: string;
  selectedWeek: WeekOption;
  currentWeekOpenUtc: string;
}) {
  const { accountKey, selectedWeek, currentWeekOpenUtc } = options;
  const stats = await getAccountStatsForWeek(accountKey, selectedWeek);
  let basketSignals = await buildBasketSignals();

  if (selectedWeek !== "all" && selectedWeek !== currentWeekOpenUtc) {
    try {
      const history = await readPerformanceSnapshotsByWeek(selectedWeek);
      if (history.length > 0) {
        basketSignals = {
          ...basketSignals,
          week_open_utc: selectedWeek,
          pairs: signalsFromSnapshots(history),
        };
      }
    } catch (error) {
      console.error("Failed to load historical basket signals:", error);
    }
  }

  const equityCurveRaw = await buildAccountEquityCurve(accountKey, selectedWeek);
  const windowEndUtc =
    selectedWeek !== "all"
      ? DateTime.fromISO(String(selectedWeek), { zone: "utc" }).plus({ days: 7 }).toUTC().toISO()
      : null;
  const equityCurve = extendToWindow(equityCurveRaw, windowEndUtc);
  const trailingDrawdownPct = computeMaxDrawdown(equityCurve);
  const staticDrawdownPct = computeStaticDrawdown(equityCurve);

  return {
    stats,
    basketSignals,
    equityCurve,
    staticDrawdownPct,
    trailingDrawdownPct,
  };
}
