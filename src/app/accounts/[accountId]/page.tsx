import { notFound } from "next/navigation";
import { unstable_noStore } from "next/cache";

import {
  getMt5AccountById,
  getMt5WeekOpenUtc,
  isMt5WeekOpenUtc,
  readMt5ClosedNetForWeek,
  readMt5ClosedPositionsByWeek,
  readMt5ClosedSummary,
  readMt5DrawdownRange,
  readMt5EquityCurveByRange,
  readMt5ChangeLog,
} from "@/lib/mt5Store";
import DashboardLayout from "@/components/DashboardLayout";
import EquityCurveChart from "@/components/research/EquityCurveChart";
import AccountClientView from "@/components/accounts/AccountClientView";
import { type DrawerConfig, type DrawerMode } from "@/components/accounts/AccountDrawer";
import { DateTime } from "luxon";
import { formatCurrencySafe } from "@/lib/formatters";
import { formatDateTimeET } from "@/lib/time";
import {
  getWeekOpenUtc,
  listPerformanceWeeks,
  readPerformanceSnapshotsByWeek,
  weekLabelFromOpen,
} from "@/lib/performanceSnapshots";
import { buildBasketSignals } from "@/lib/basketSignals";
import { groupSignals, signalsFromSnapshots } from "@/lib/plannedTrades";

export const dynamic = "force-dynamic";

type AccountPageProps = {
  params: Promise<{ accountId: string }>;
  searchParams?:
    | Record<string, string | string[] | undefined>
    | Promise<Record<string, string | string[] | undefined>>;
};

const percentFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatPercent(value: number) {
  if (!Number.isFinite(value)) {
    return "0.00%";
  }
  const sign = value > 0 ? "+" : value < 0 ? "" : "";
  return `${sign}${percentFormatter.format(value)}%`;
}

function formatDuration(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) {
    return "n/a";
  }
  if (seconds <= 1) {
    return "now";
  }
  const total = Math.floor(seconds);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  const parts = [] as string[];
  if (hrs > 0) {
    parts.push(`${hrs}h`);
  }
  if (mins > 0 || hrs > 0) {
    parts.push(`${mins}m`);
  }
  parts.push(`${secs}s`);
  return parts.join(" ");
}

function statusTone(status: string) {
  if (status === "LIVE") {
    return "bg-emerald-100 text-emerald-700";
  }
  if (status === "DEMO") {
    return "bg-[var(--panel-border)]/50 text-[var(--foreground)]/70";
  }
  return "bg-rose-100 text-rose-700";
}

function basketTone(state: string) {
  if (state === "ACTIVE") {
    return "text-emerald-700";
  }
  if (state === "READY") {
    return "text-[var(--foreground)]/70";
  }
  if (state === "PAUSED") {
    return "text-rose-700";
  }
  return "text-[color:var(--muted)]";
}

function parseBasketFromComment(comment: string) {
  if (!comment) {
    return null;
  }
  const match = comment.match(/LimniBasket\s+([A-Za-z0-9_]+)/i);
  return match?.[1]?.toLowerCase() ?? null;
}

function toQueryParam(value: string | string[] | undefined) {
  if (Array.isArray(value)) {
    return value[0] ?? null;
  }
  return value ?? null;
}

function extendToWindow(
  points: { ts_utc: string; equity_pct: number; lock_pct: number | null }[],
  windowEndUtc: string | null
) {
  if (!windowEndUtc || points.length === 0) {
    return points;
  }
  const last = points[points.length - 1];
  if (DateTime.fromISO(last.ts_utc, { zone: "utc" }) >= DateTime.fromISO(windowEndUtc, { zone: "utc" })) {
    return points;
  }
  return [...points, { ...last, ts_utc: windowEndUtc }];
}

function computeMaxDrawdown(points: { equity_pct: number }[]) {
  let peak = Number.NEGATIVE_INFINITY;
  let maxDrawdown = 0;
  for (const point of points) {
    if (point.equity_pct > peak) {
      peak = point.equity_pct;
    }
    const drawdown = peak - point.equity_pct;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }
  return maxDrawdown;
}

export default async function AccountPage({ params, searchParams }: AccountPageProps) {
  unstable_noStore();
  const { accountId } = await params;
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const requestedWeek = toQueryParam(resolvedSearchParams?.week);
  const basketFilter = (toQueryParam(resolvedSearchParams?.basket) ?? "").toLowerCase();
  const symbolFilter = (toQueryParam(resolvedSearchParams?.symbol) ?? "").toUpperCase();
  const desiredWeeks = 4;
  const currentWeekOpenUtc = getWeekOpenUtc();
  const currentWeekStart = DateTime.fromISO(currentWeekOpenUtc, { zone: "utc" });
  const nextWeekOpenUtc = currentWeekStart.isValid
    ? currentWeekStart.plus({ days: 7 }).toUTC().toISO()
    : null;
  let weekOptions: string[] = [];
  try {
    const recentWeeks = await listPerformanceWeeks(desiredWeeks);
    const ordered: string[] = [];
    const seen = new Set<string>();
    if (nextWeekOpenUtc && recentWeeks.length > 0) {
      ordered.push(nextWeekOpenUtc);
      seen.add(nextWeekOpenUtc);
    }
    for (const week of recentWeeks) {
      if (!seen.has(week)) {
        ordered.push(week);
        seen.add(week);
      }
    }
    weekOptions = ordered.slice(0, desiredWeeks);
  } catch (error) {
    console.error(
      "Performance week list failed:",
      error instanceof Error ? error.message : String(error),
    );
  }
  const nowUtc = DateTime.utc();
  const hoursToNext =
    nextWeekOpenUtc
      ? DateTime.fromISO(nextWeekOpenUtc, { zone: "utc" }).diff(nowUtc, "hours").hours
      : null;
  const selectedWeek =
    requestedWeek && weekOptions.includes(requestedWeek)
      ? requestedWeek
      : hoursToNext !== null && hoursToNext <= 48 && nextWeekOpenUtc && weekOptions.includes(nextWeekOpenUtc)
        ? nextWeekOpenUtc
        : weekOptions.includes(currentWeekOpenUtc)
          ? currentWeekOpenUtc
          : weekOptions[0] ?? currentWeekOpenUtc;
  const isSelectedMt5Week = selectedWeek ? isMt5WeekOpenUtc(selectedWeek) : false;
  const statsWeekOpenUtc = isSelectedMt5Week ? selectedWeek : getMt5WeekOpenUtc();
  let account = null;
  let closedPositions: Awaited<ReturnType<typeof readMt5ClosedPositionsByWeek>> = [];
  let closedSummary: Awaited<ReturnType<typeof readMt5ClosedSummary>> = [];
  let changeLog: Awaited<ReturnType<typeof readMt5ChangeLog>> = [];
  let weeklyDrawdown = 0;
  let currentWeekNet = { net: 0, trades: 0 };
  let equityCurvePoints: { ts_utc: string; equity_pct: number; lock_pct: number | null }[] = [];
  let basketSignals: Awaited<ReturnType<typeof buildBasketSignals>> | null = null;
  try {
    account = await getMt5AccountById(accountId);
    closedSummary = await readMt5ClosedSummary(accountId, 12);
    changeLog = await readMt5ChangeLog(accountId, 12);
    closedPositions = isSelectedMt5Week
      ? await readMt5ClosedPositionsByWeek(accountId, selectedWeek, 500)
      : [];
    const weekOpen = statsWeekOpenUtc;
    const weekEnd = DateTime.fromISO(weekOpen, { zone: "utc" }).plus({ days: 7 }).toISO();
    if (weekEnd) {
      weeklyDrawdown = await readMt5DrawdownRange(accountId, weekOpen, weekEnd);
      currentWeekNet = await readMt5ClosedNetForWeek(accountId, weekOpen);
      const snapshots = await readMt5EquityCurveByRange(accountId, weekOpen, weekEnd);
      console.log(
        `[MT5 KPI] account=${accountId} week=${weekOpen} equitySnapshots=${snapshots.length}`
      );
      if (snapshots.length > 0) {
        const startEquity = snapshots[0].equity;
        const lockPct =
          account && Number.isFinite(account.locked_profit_pct) && account.locked_profit_pct > 0
            ? account.locked_profit_pct
            : null;
        equityCurvePoints = snapshots.map((point) => ({
          ts_utc: point.snapshot_at,
          equity_pct:
            startEquity > 0
              ? ((point.equity - startEquity) / startEquity) * 100
              : 0,
          lock_pct: lockPct,
        }));
        equityCurvePoints = extendToWindow(equityCurvePoints, weekEnd);
      }
    }
    basketSignals = await buildBasketSignals();
    if (selectedWeek && selectedWeek !== currentWeekOpenUtc) {
      let usedHistory = false;
      try {
        const history = await readPerformanceSnapshotsByWeek(selectedWeek);
        if (history.length > 0) {
          basketSignals = {
            ...basketSignals,
            week_open_utc: selectedWeek,
            pairs: signalsFromSnapshots(history),
          };
          usedHistory = true;
        }
      } catch (error) {
        console.error(
          "Performance snapshot load failed:",
          error instanceof Error ? error.message : String(error),
        );
      }
      if (!usedHistory) {
        basketSignals = { ...basketSignals, week_open_utc: selectedWeek };
      }
    } else {
      basketSignals = { ...basketSignals, week_open_utc: selectedWeek };
    }
  } catch (error) {
    console.error(
      "Account load failed:",
      error instanceof Error ? error.message : String(error),
    );
  }
  if (!account) {
    notFound();
  }

  const openFloatingPnl = (account.positions ?? []).reduce(
    (acc, position) => acc + position.profit + position.swap + position.commission,
    0,
  );
  const inferredStartBalance =
    account.balance - currentWeekNet.net > 0 ? account.balance - currentWeekNet.net : account.balance;
  const derivedWeeklyPnlPct =
    inferredStartBalance > 0
      ? (currentWeekNet.net / inferredStartBalance) * 100
      : 0;
  const derivedBasketPnlPct =
    account.baseline_equity > 0
      ? ((account.equity - account.baseline_equity) / account.baseline_equity) * 100
      : derivedWeeklyPnlPct + (inferredStartBalance > 0 ? (openFloatingPnl / inferredStartBalance) * 100 : 0);

  const weeklyPnlToShow =
    Math.abs(account.weekly_pnl_pct) > 0.001 || currentWeekNet.trades === 0
      ? account.weekly_pnl_pct
      : derivedWeeklyPnlPct;
  const basketPnlToShow =
    Math.abs(account.basket_pnl_pct) > 0.001 ||
    Math.abs(account.baseline_equity) > 0.001
      ? account.basket_pnl_pct
      : derivedBasketPnlPct;

  const basketOptions = Array.from(
    new Set(
      [
        ...(account.positions ?? []).map((position) => parseBasketFromComment(position.comment)),
        ...closedPositions.map((position) => parseBasketFromComment(position.comment)),
      ].filter((value): value is string => value !== null),
    ),
  ).sort();

  const symbolOptions = Array.from(
    new Set(
      [
        ...(account.positions ?? []).map((position) => position.symbol),
        ...closedPositions.map((position) => position.symbol),
      ],
    ),
  ).sort();

  const effectiveBasketFilter =
    basketFilter && basketOptions.includes(basketFilter) ? basketFilter : "";
  const effectiveSymbolFilter =
    symbolFilter && symbolOptions.includes(symbolFilter) ? symbolFilter : "";

  const filteredOpenPositions = (account.positions ?? []).filter((position) => {
    const basket = parseBasketFromComment(position.comment);
    if (effectiveBasketFilter && basket !== effectiveBasketFilter) {
      return false;
    }
    if (effectiveSymbolFilter && position.symbol !== effectiveSymbolFilter) {
      return false;
    }
    return true;
  });

  const filteredClosedPositions = closedPositions.filter((position) => {
    const basket = parseBasketFromComment(position.comment);
    if (effectiveBasketFilter && basket !== effectiveBasketFilter) {
      return false;
    }
    if (effectiveSymbolFilter && position.symbol !== effectiveSymbolFilter) {
      return false;
    }
    return true;
  });

  const closedGroups = (() => {
    const groups = new Map<
      string,
      {
        key: string;
        symbol: string;
        type: "BUY" | "SELL";
        basket: string;
        openDate: string;
        trades: typeof filteredClosedPositions;
        net: number;
        lots: number;
        closeTimeMin: string;
        closeTimeMax: string;
      }
    >();
    for (const trade of filteredClosedPositions) {
      const basket = parseBasketFromComment(trade.comment) ?? "unknown";
      const openDate = trade.open_time.slice(0, 10);
      const key = `${basket}|${trade.symbol}|${trade.type}|${openDate}`;
      const net = trade.profit + trade.swap + trade.commission;
      const existing = groups.get(key);
      if (existing) {
        existing.trades.push(trade);
        existing.net += net;
        existing.lots += trade.lots;
        existing.closeTimeMin =
          existing.closeTimeMin < trade.close_time ? existing.closeTimeMin : trade.close_time;
        existing.closeTimeMax =
          existing.closeTimeMax > trade.close_time ? existing.closeTimeMax : trade.close_time;
      } else {
        groups.set(key, {
          key,
          symbol: trade.symbol,
          type: trade.type,
          basket,
          openDate,
          trades: [trade],
          net,
          lots: trade.lots,
          closeTimeMin: trade.close_time,
          closeTimeMax: trade.close_time,
        });
      }
    }
    return Array.from(groups.values()).sort((a, b) => b.net - a.net);
  })();


  const baseHref = `/accounts/${accountId}`;
  const activeTab = ["overview", "equity", "positions", "planned", "history", "journal", "settings"].includes(
    toQueryParam(resolvedSearchParams?.tab) ?? ""
  )
    ? (toQueryParam(resolvedSearchParams?.tab) as string)
    : "overview";
  const drawerMode: DrawerMode =
    typeof resolvedSearchParams?.drawer === "string"
      ? (resolvedSearchParams.drawer as DrawerMode)
      : null;
  const baseQuery: Record<string, string | undefined> = {
    week: selectedWeek ?? undefined,
    tab: activeTab,
  };

  const plannedPairs = basketSignals ? groupSignals(basketSignals.pairs) : [];
  const plannedRows = plannedPairs.map((pair, index) => ({
    id: `${pair.symbol}-${index}`,
    status: "pending",
    searchText: `${pair.symbol} ${pair.assetClass}`,
    sortValue: pair.net,
    cells: [
      <span key="symbol" className="font-semibold">
        {pair.symbol}
      </span>,
      <span key="asset" className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
        {pair.assetClass}
      </span>,
      <span key="net" className={pair.net >= 0 ? "text-emerald-700" : "text-rose-700"}>
        Net {pair.net}
      </span>,
      <span key="legs" className="text-xs text-[color:var(--muted)]">
        {pair.legs.length} legs
      </span>,
    ],
  }));

  const openRows = filteredOpenPositions.map((pos, index) => {
    const pnl = pos.profit + pos.swap + pos.commission;
    return {
      id: `${pos.ticket}-${index}`,
      status: "open",
      searchText: `${pos.symbol} ${pos.comment ?? ""}`,
      sortValue: pnl,
      cells: [
        <span key="symbol" className="font-semibold">
          {pos.symbol}
        </span>,
        <span key="type" className={pos.type === "BUY" ? "text-emerald-700" : "text-rose-700"}>
          {pos.type}
        </span>,
        <span key="lots" className="text-xs text-[color:var(--muted)]">
          {pos.lots.toFixed(2)} lots
        </span>,
        <span key="pnl" className={pnl >= 0 ? "text-emerald-700" : "text-rose-700"}>
          {formatCurrencySafe(pnl, account.currency)}
        </span>,
      ],
    };
  });

  const closedRows = closedGroups.map((group) => ({
    id: group.key,
    status: "closed",
    searchText: `${group.symbol} ${group.basket}`,
    sortValue: group.net,
    cells: [
      <span key="symbol" className="font-semibold">
        {group.symbol}
      </span>,
      <span key="type" className={group.type === "BUY" ? "text-emerald-700" : "text-rose-700"}>
        {group.type}
      </span>,
      <span key="net" className={group.net >= 0 ? "text-emerald-700" : "text-rose-700"}>
        {formatCurrencySafe(group.net, account.currency)}
      </span>,
      <span key="lots" className="text-xs text-[color:var(--muted)]">
        {group.lots.toFixed(2)} lots
      </span>,
    ],
  }));

  const journalRows = [
    ...(account.recent_logs ?? []).map((log, index) => ({
      id: `log-${index}`,
      cells: [
        <span key="label" className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
          Runtime
        </span>,
        <span key="value" className="text-xs text-[var(--foreground)]">
          {log}
        </span>,
      ],
    })),
    ...changeLog.map((entry) => ({
      id: `change-${entry.week_open_utc}-${entry.created_at}`,
      cells: [
        <span key="label" className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
          {entry.strategy ?? "Change"}
        </span>,
        <span key="value" className="text-xs text-[var(--foreground)]">
          {entry.title}
        </span>,
      ],
    })),
  ];

  const kpiRows = [
    { id: "equity", label: "Equity", value: formatCurrencySafe(account.equity, account.currency) },
    { id: "balance", label: "Balance", value: formatCurrencySafe(account.balance, account.currency) },
    { id: "basket", label: "Basket PnL", value: formatPercent(basketPnlToShow) },
    { id: "risk", label: "Risk Used", value: formatPercent(account.risk_used_pct) },
    { id: "drawdown", label: "Max DD (all)", value: formatPercent(account.max_drawdown_pct) },
    { id: "margin", label: "Margin", value: formatCurrencySafe(account.margin, account.currency) },
    { id: "free", label: "Free Margin", value: formatCurrencySafe(account.free_margin, account.currency) },
  ];

  const drawerConfigs: Partial<Record<Exclude<DrawerMode, null>, DrawerConfig>> = {
    positions: {
      title: "Open Positions",
      subtitle: "Live positions for this account",
      columns: [
        { key: "symbol", label: "Symbol" },
        { key: "type", label: "Side" },
        { key: "lots", label: "Size" },
        { key: "pnl", label: "P&L" },
      ],
      rows: openRows,
      showFilters: true,
      emptyState: "No open positions in this week.",
    },
    planned: {
      title: "Planned Trades",
      subtitle: "Upcoming basket signals",
      columns: [
        { key: "symbol", label: "Symbol" },
        { key: "asset", label: "Asset" },
        { key: "net", label: "Net" },
        { key: "legs", label: "Legs" },
      ],
      rows: plannedRows,
      showFilters: true,
      emptyState: "No planned trades for this week.",
    },
    closed: {
      title: "Closed Trades",
      subtitle: "Grouped closed positions",
      columns: [
        { key: "symbol", label: "Symbol" },
        { key: "type", label: "Side" },
        { key: "net", label: "Net PnL" },
        { key: "lots", label: "Lots" },
      ],
      rows: closedRows,
      showFilters: true,
      emptyState: "No closed trades recorded for this week.",
    },
    journal: {
      title: "Journal",
      subtitle: "Automation logs and weekly notes",
      columns: [
        { key: "label", label: "Type" },
        { key: "value", label: "Entry" },
      ],
      rows: journalRows,
      showFilters: false,
      emptyState: "No journal entries yet.",
    },
    mapping: {
      title: "Mapping & Settings",
      subtitle: "Account settings and mapping",
      columns: [
        { key: "label", label: "Item" },
        { key: "value", label: "Value" },
      ],
      rows: [],
      showFilters: false,
      emptyState: "No mapping data for MT5 accounts.",
    },
    kpi: {
      title: "KPI Details",
      subtitle: "Expanded performance and risk metrics",
      columns: [
        { key: "label", label: "Metric" },
        { key: "value", label: "Value" },
      ],
      rows: kpiRows.map((row) => ({
        id: row.id,
        cells: [
          <span key="label" className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
            {row.label}
          </span>,
          <span key="value" className="font-semibold">
            {row.value}
          </span>,
        ],
      })),
      showFilters: false,
    },
  };

  const maxDrawdownPct = computeMaxDrawdown(equityCurvePoints);

  return (
    <DashboardLayout>
      <AccountClientView
        header={{
          title: account?.label ?? "Account",
          providerLabel: "MT5",
          statusLabel: account?.status ?? "UNKNOWN",
          statusToneClass: statusTone(account?.status ?? "PAUSED"),
          lastSync: account?.last_sync_utc ? formatDateTimeET(account.last_sync_utc) : "—",
          weekOptions,
          currentWeek: currentWeekOpenUtc,
          selectedWeek,
          onBackHref: "/accounts",
        }}
        kpi={{
          weeklyPnlPct: weeklyPnlToShow,
          maxDrawdownPct,
          tradesThisWeek: account.trade_count_week,
          equity: account.equity,
          balance: account.balance,
          currency: account.currency,
          scopeLabel: "Week • Account",
        }}
        overview={{
          openPositions: filteredOpenPositions.length,
          plannedCount: plannedPairs.length,
          mappingCount: 0,
          plannedNote: null,
          journalCount: journalRows.length,
        }}
        equity={{
          title: "Weekly equity curve (%)",
          points: equityCurvePoints,
        }}
        debug={{
          selectedWeekKey: selectedWeek ?? currentWeekOpenUtc,
          kpiWeekKey: statsWeekOpenUtc,
          equityWeekKey: statsWeekOpenUtc,
        }}
        drawerConfigs={drawerConfigs}
      />
    </DashboardLayout>
  );
}
