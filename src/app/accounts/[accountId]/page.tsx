import { notFound } from "next/navigation";
import { unstable_noStore } from "next/cache";

import DashboardLayout from "@/components/DashboardLayout";
import AccountClientView from "@/components/accounts/AccountClientView";
import { computeMaxDrawdown } from "@/lib/accounts/viewUtils";
import {
  resolveCommonAccountSearchParams,
  resolveMt5TradeFilters,
} from "@/lib/accounts/navigation";
import {
  loadMt5PageData,
  resolveMt5WeekContext,
} from "@/lib/accounts/mt5PageData";
import { buildMt5PlannedView } from "@/lib/accounts/mt5Planning";
import {
  buildMt5FilteredPositions,
  deriveMt5PnlDisplay,
  shouldForceFxOnlyPlanned,
} from "@/lib/accounts/mt5PageState";
import { buildMt5AccountClientViewProps } from "@/lib/accounts/mt5PageProps";

export const dynamic = "force-dynamic";

type AccountPageProps = {
  params: Promise<{ accountId: string }>;
  searchParams?:
    | Record<string, string | string[] | undefined>
    | Promise<Record<string, string | string[] | undefined>>;
};

export default async function AccountPage({ params, searchParams }: AccountPageProps) {
  unstable_noStore();
  const { accountId } = await params;
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const { week: requestedWeek, view: activeView } =
    resolveCommonAccountSearchParams(resolvedSearchParams);
  const { basketFilter, symbolFilter } = resolveMt5TradeFilters(resolvedSearchParams);
  const {
    currentWeekOpenUtc,
    nextWeekOpenUtc,
    weekOptions,
    selectedWeek,
    isSelectedMt5Week,
    statsWeekOpenUtc,
  } = await resolveMt5WeekContext({
    accountId,
    requestedWeek,
    desiredWeeks: 4,
  });
  const {
    account,
    closedPositions,
    changeLog,
    currentWeekNet,
    equityCurvePoints,
    basketSignals,
    frozenPlan,
  } = await loadMt5PageData({
    accountId,
    selectedWeek,
    currentWeekOpenUtc,
    statsWeekOpenUtc,
    isSelectedMt5Week,
  });
  if (!account) {
    notFound();
  }

  // Some MT5 accounts (ex: The5ers manual accounts) cannot realistically trade the full non-FX universe.
  // For those accounts, we intentionally show an FX-only plan in the app for manual execution.
  const forceFxOnlyPlanned = shouldForceFxOnlyPlanned(account);
  const { weeklyPnlToShow, basketPnlToShow } = deriveMt5PnlDisplay(account, currentWeekNet);
  const { filteredOpenPositions, filteredClosedPositions } = buildMt5FilteredPositions({
    openPositions: account.positions ?? [],
    closedPositions,
    forceFxOnlyPlanned,
    basketFilter,
    symbolFilter,
  });

  const mt5Planned = await buildMt5PlannedView({
    basketSignals: basketSignals ? { pairs: basketSignals.pairs } : null,
    planningDiagnostics: account.planning_diagnostics,
    selectedWeek,
    currentWeekOpenUtc,
    nextWeekOpenUtc,
    forceFxOnlyPlanned,
    lotMapRows: account.lot_map ?? [],
    frozenLotMapRows: frozenPlan?.lot_map ?? [],
    frozenBaselineEquity: frozenPlan?.baseline_equity ?? null,
    freeMargin: Number(account.free_margin ?? 0),
    equity: Number(account.equity ?? 0),
    currency: String(account.currency ?? "USD"),
  });
  const plannedPairs = mt5Planned.plannedPairs;
  const plannedSummary = mt5Planned.plannedSummary;
  const showStopLoss1pct = mt5Planned.showStopLoss1pct;
  const planningDiagnostics = mt5Planned.planningDiagnostics;
  const planningMode = mt5Planned.planningMode;

  const maxDrawdownPct = computeMaxDrawdown(equityCurvePoints);
  const mt5ViewProps = buildMt5AccountClientViewProps({
    activeView,
    account: {
      ...account,
      baseline_equity:
        Number(frozenPlan?.baseline_equity ?? 0) > 0
          ? Number(frozenPlan?.baseline_equity ?? 0)
          : Number(account.baseline_equity ?? 0),
    },
    weekOptions,
    currentWeekOpenUtc,
    selectedWeek,
    statsWeekOpenUtc,
    showStopLoss1pct,
    weeklyPnlToShow,
    basketPnlToShow,
    maxDrawdownPct,
    filteredOpenPositions,
    filteredClosedPositions,
    plannedPairs,
    plannedSummary,
    planningDiagnostics,
    planningMode,
    equityCurvePoints,
    changeLog,
  });

  return (
    <DashboardLayout>
      <AccountClientView {...mt5ViewProps} />
    </DashboardLayout>
  );
}
