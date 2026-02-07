import { getConnectedAccount, type ConnectedAccount } from "./connectedAccounts";
import { listWeeksForAccount } from "./performanceSnapshots";
import type { WeekOption } from "./weekState";

/**
 * Week-specific account statistics
 */
export type AccountWeekStats = {
  weekOpenUtc: string | "all";
  equity: number;
  balance: number;
  weeklyPnlPct: number;
  basketPnlPct: number;
  currency: string;
  lockedProfitPct: number | null;
  openPositions: number;
  tradesThisWeek: number;
  leverage: number | null;
  margin: number | null;
  freeMargin: number | null;
  riskUsedPct: number | null;
};

/**
 * Extracts stats from account.analysis object
 */
function extractStatsFromAnalysis(
  analysis: ConnectedAccount["analysis"],
  weekOpenUtc: string | "all"
): AccountWeekStats {
  const equity =
    typeof analysis?.equity === "number"
      ? analysis.equity
      : typeof analysis?.nav === "number"
        ? analysis.nav
        : typeof analysis?.balance === "number"
          ? analysis.balance
          : 0;

  const balance = typeof analysis?.balance === "number" ? analysis.balance : equity;

  return {
    weekOpenUtc,
    equity,
    balance,
    weeklyPnlPct: typeof analysis?.weekly_pnl_pct === "number" ? analysis.weekly_pnl_pct : 0,
    basketPnlPct:
      typeof analysis?.basket_pnl_pct === "number"
        ? analysis.basket_pnl_pct
        : typeof analysis?.weekly_pnl_pct === "number"
          ? analysis.weekly_pnl_pct
          : 0,
    currency: typeof analysis?.currency === "string" ? analysis.currency : "USD",
    lockedProfitPct:
      typeof analysis?.locked_profit_pct === "number" ? analysis.locked_profit_pct : null,
    openPositions: typeof analysis?.open_positions === "number" ? analysis.open_positions : 0,
    tradesThisWeek: typeof analysis?.trades_this_week === "number" ? analysis.trades_this_week : 0,
    leverage: typeof analysis?.leverage === "number" ? analysis.leverage : null,
    margin: typeof analysis?.margin === "number" ? analysis.margin : null,
    freeMargin: typeof analysis?.free_margin === "number" ? analysis.free_margin : null,
    riskUsedPct: typeof analysis?.risk_used_pct === "number" ? analysis.risk_used_pct : null,
  };
}

/**
 * Get account stats for a specific week
 *
 * @param accountKey - The connected account key
 * @param weekOpenUtc - Week to fetch stats for, or "all" for all-time
 * @returns Week-specific account statistics
 */
export async function getAccountStatsForWeek(
  accountKey: string,
  weekOpenUtc: WeekOption
): Promise<AccountWeekStats> {
  const account = await getConnectedAccount(accountKey);
  if (!account) {
    console.log(
      `[AccountStats] account=${accountKey} week=${weekOpenUtc} source=missing_account snapshotCount=0`
    );
    return extractStatsFromAnalysis(null, weekOpenUtc === "all" ? "all" : weekOpenUtc);
  }

  if (weekOpenUtc === "all") {
    return getAccountAllTimeStats(accountKey, account);
  }

  // For specific weeks, we'd fetch historical snapshots
  // For now, we'll use the current account.analysis data
  // TODO: Implement week-specific snapshot fetching from database
  // const snapshots = await readAccountSnapshotsByWeek(accountKey, weekOpenUtc);
  console.log(
    `[AccountStats] account=${accountKey} week=${weekOpenUtc} source=analysis snapshotCount=0`
  );

  return extractStatsFromAnalysis(account.analysis, weekOpenUtc);
}

/**
 * Get all-time aggregated stats for an account
 *
 * @param accountKey - The connected account key
 * @param account - Optional pre-fetched account object
 * @returns Aggregated all-time statistics
 */
export async function getAccountAllTimeStats(
  accountKey: string,
  account?: ConnectedAccount | null
): Promise<AccountWeekStats> {
  if (!account) {
    account = await getConnectedAccount(accountKey);
  }
  if (!account) {
    console.log(
      `[AccountStats] account=${accountKey} week=all source=missing_account snapshotCount=0`
    );
    return extractStatsFromAnalysis(null, "all");
  }

  // For all-time stats, we aggregate from current analysis
  // TODO: Implement proper all-time aggregation from historical snapshots
  console.log(
    `[AccountStats] account=${accountKey} week=all source=analysis snapshotCount=0`
  );
  const stats = extractStatsFromAnalysis(account.analysis, "all");

  // For all-time view, calculate cumulative metrics
  // This would ideally come from aggregating all weekly snapshots
  return {
    ...stats,
    weeklyPnlPct: 0, // All-time doesn't have a "weekly" PnL
    basketPnlPct: stats.basketPnlPct, // Use current basket performance
    tradesThisWeek: 0, // Not applicable for all-time
  };
}

/**
 * Get stats for multiple weeks (for charting)
 *
 * @param accountKey - The connected account key
 * @param limit - Number of weeks to fetch
 * @returns Array of weekly stats
 */
export async function getAccountWeeklyHistory(
  accountKey: string,
  limit: number = 12
): Promise<AccountWeekStats[]> {
  const account = await getConnectedAccount(accountKey);
  const weeks = await listWeeksForAccount(accountKey, limit);

  // For now, return current stats for each week
  // TODO: Implement actual historical snapshot fetching
  return weeks.map((week) => extractStatsFromAnalysis(account?.analysis ?? null, week));
}

/**
 * Calculate account metrics for display
 */
export function calculateAccountMetrics(stats: AccountWeekStats) {
  const equityChange = stats.equity - stats.balance;
  const equityChangePct = stats.balance > 0 ? (equityChange / stats.balance) * 100 : 0;

  return {
    equityChange,
    equityChangePct,
    hasOpenPositions: stats.openPositions > 0,
    isInProfit: stats.weeklyPnlPct > 0,
    isInDrawdown: stats.weeklyPnlPct < -2, // More than 2% down
    marginUtilization:
      stats.margin && stats.equity ? (stats.margin / stats.equity) * 100 : null,
    availableMarginPct:
      stats.freeMargin && stats.equity ? (stats.freeMargin / stats.equity) * 100 : null,
  };
}
