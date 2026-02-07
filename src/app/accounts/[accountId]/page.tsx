import { notFound } from "next/navigation";

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
import DebugReadout from "@/components/DebugReadout";
import PageShell from "@/components/shell/PageShell";
import TabbedSection from "@/components/tabs/TabbedSection";
import AccountKpiRow from "@/components/accounts/AccountKpiRow";
import MiniSparkline from "@/components/visuals/MiniSparkline";
import AccountDrawer, { type DrawerConfig, type DrawerMode } from "@/components/accounts/AccountDrawer";
import SummaryCard from "@/components/accounts/SummaryCard";
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
import Link from "next/link";

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

function buildHref(baseHref: string, query: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });
  const qs = params.toString();
  return qs ? `${baseHref}?${qs}` : baseHref;
}

export default async function AccountPage({ params, searchParams }: AccountPageProps) {
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
  const selectedWeek =
    requestedWeek && weekOptions.includes(requestedWeek)
      ? requestedWeek
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

  return (
    <DashboardLayout>
      <PageShell
        header={
          <header className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <Link
                href="/accounts"
                className="rounded-full border border-[var(--panel-border)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
              >
                Back
              </Link>
              <div>
                <p className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Account
                </p>
                <h1 className="text-xl font-semibold text-[var(--foreground)]">
                  {account?.label ?? "Account"}
                </h1>
              </div>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(account?.status ?? "PAUSED")}`}>
                {account?.status ?? "UNKNOWN"}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <form action={baseHref} method="get" className="flex items-center gap-2">
                <label className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">Week</label>
                <select
                  name="week"
                  defaultValue={selectedWeek ?? ""}
                  className="rounded-full border border-[var(--panel-border)] bg-[var(--panel)]/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]"
                >
                  {weekOptions.map((week) => (
                    <option key={week} value={week}>
                      {weekLabelFromOpen(week)}
                    </option>
                  ))}
                </select>
                <input type="hidden" name="tab" value={activeTab} />
                <button
                  type="submit"
                  className="rounded-full border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
                >
                  View
                </button>
              </form>
              <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                Last sync {formatDateTimeET(account?.last_sync_utc ?? "")}
              </span>
            </div>
          </header>
        }
        kpis={
          <AccountKpiRow
            weeklyPnlPct={weeklyPnlToShow}
            maxDrawdownPct={weeklyDrawdown}
            tradesThisWeek={account.trade_count_week}
            equity={account.equity}
            balance={account.balance}
            currency={account.currency}
            scopeLabel="Week • Account"
            detailsHref={buildHref(baseHref, { ...baseQuery, drawer: "kpi" })}
          />
        }
        tabs={
          <TabbedSection
            tabs={[
              { id: "overview", label: "Overview" },
              { id: "equity", label: "Equity" },
              { id: "positions", label: "Positions" },
              { id: "planned", label: "Planned" },
              { id: "history", label: "History" },
              { id: "journal", label: "Journal" },
              { id: "settings", label: "Settings" },
            ]}
            active={activeTab}
            baseHref={baseHref}
            query={baseQuery}
          />
        }
      >
        {activeTab === "overview" ? (
          <div className="space-y-4">
            <MiniSparkline points={equityCurvePoints} />
            <div className="grid gap-4 md:grid-cols-3">
              <SummaryCard
                label="Open Positions"
                value={filteredOpenPositions.length}
                hint="Live positions right now"
                action={
                  <Link
                    href={buildHref(baseHref, { ...baseQuery, drawer: "positions" })}
                    className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)]"
                  >
                    View drawer
                  </Link>
                }
              />
              <SummaryCard
                label="Planned Trades"
                value={plannedPairs.length}
                hint="Upcoming basket signals"
                action={
                  <Link
                    href={buildHref(baseHref, { ...baseQuery, drawer: "planned" })}
                    className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)]"
                  >
                    View drawer
                  </Link>
                }
              />
              <SummaryCard
                label="Journal"
                value={journalRows.length}
                hint="Latest notes and logs"
                action={
                  <Link
                    href={buildHref(baseHref, { ...baseQuery, drawer: "journal" })}
                    className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)]"
                  >
                    View drawer
                  </Link>
                }
              />
            </div>
          </div>
        ) : null}

        {activeTab === "equity" ? (
          <div className="space-y-4">
            <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                Query summary
              </p>
              <p className="mt-1 text-sm text-[color:var(--muted)]">
                Week {selectedWeek ?? getWeekOpenUtc()} · Account MT5
              </p>
            </div>
            <EquityCurveChart
              title="Weekly equity curve (%)"
              points={equityCurvePoints}
              interactive
            />
            <DebugReadout
              title="Chart + KPI Window"
              items={[
                { label: "Scope", value: `mt5:${accountId}` },
                { label: "Window", value: selectedWeek ?? getWeekOpenUtc() },
                { label: "Series", value: "mt5_equity_curve" },
              ]}
            />
          </div>
        ) : null}

        {activeTab === "positions" ? (
          <SummaryCard
            label="Open Positions"
            value={filteredOpenPositions.length}
            hint="Live positions right now"
            action={
              <Link
                href={buildHref(baseHref, { ...baseQuery, drawer: "positions" })}
                className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)]"
              >
                Open drawer
              </Link>
            }
          />
        ) : null}

        {activeTab === "planned" ? (
          <SummaryCard
            label="Planned Trades"
            value={plannedPairs.length}
            hint="Upcoming basket signals"
            action={
              <Link
                href={buildHref(baseHref, { ...baseQuery, drawer: "planned" })}
                className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)]"
              >
                Open drawer
              </Link>
            }
          />
        ) : null}

        {activeTab === "history" ? (
          <SummaryCard
            label="Closed Trades"
            value={closedRows.length}
            hint="Grouped closed positions"
            action={
              <Link
                href={buildHref(baseHref, { ...baseQuery, drawer: "closed" })}
                className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)]"
              >
                Open drawer
              </Link>
            }
          />
        ) : null}

        {activeTab === "journal" ? (
          <SummaryCard
            label="Journal"
            value={journalRows.length}
            hint="Automation logs and notes"
            action={
              <Link
                href={buildHref(baseHref, { ...baseQuery, drawer: "journal" })}
                className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)]"
              >
                Open drawer
              </Link>
            }
          />
        ) : null}

        {activeTab === "settings" ? (
          <SummaryCard
            label="Settings"
            value="—"
            hint="Account tools and mapping"
            action={
              <Link
                href={buildHref(baseHref, { ...baseQuery, drawer: "mapping" })}
                className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)]"
              >
                Open drawer
              </Link>
            }
          />
        ) : null}

        <AccountDrawer mode={drawerMode} configs={drawerConfigs} />
      </PageShell>
    </DashboardLayout>
  );
}
