import DashboardLayout from "@/components/DashboardLayout";
import ConnectedAccountSizing from "@/components/ConnectedAccountSizing";
import WeekSelector from "@/components/accounts/WeekSelector";
import EquityCurveChart from "@/components/research/EquityCurveChart";
import AccountClientView from "@/components/accounts/AccountClientView";
import { type DrawerConfig, type DrawerMode } from "@/components/accounts/AccountDrawer";
import VirtualizedListTable from "@/components/common/VirtualizedListTable";
import { getConnectedAccount, listConnectedAccounts } from "@/lib/connectedAccounts";
import { formatDateTimeET } from "@/lib/time";
import { buildBasketSignals } from "@/lib/basketSignals";
import {
  buildBitgetPlannedTrades,
  filterForBitget,
  filterForOanda,
  groupSignals,
  signalsFromSnapshots,
} from "@/lib/plannedTrades";
import { DateTime } from "luxon";
import {
  getWeekOpenUtc,
  readPerformanceSnapshotsByWeek,
  listWeekOptionsForAccount,
} from "@/lib/performanceSnapshots";
import { formatCurrencySafe } from "@/lib/formatters";
import { getAccountStatsForWeek } from "@/lib/accountStats";
import { buildAccountEquityCurve } from "@/lib/accountEquityCurve";
import { getDefaultWeek, type WeekOption } from "@/lib/weekState";

export const dynamic = "force-dynamic";

type ConnectedAccountPageProps = {
  params: { accountKey: string } | Promise<{ accountKey: string }>;
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

/**
 * Decode account key with multiple fallback strategies
 */
function decodeAccountKey(rawParam: string) {
  const decodeSafe = (value: string) => {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  };

  const decodedOnce = decodeSafe(rawParam);
  const decodedTwice = decodeSafe(decodedOnce);

  return Array.from(
    new Set(
      [
        rawParam,
        decodedOnce,
        decodedTwice,
        rawParam ? rawParam.replace(/%3A/gi, ":") : "",
        decodedOnce ? decodedOnce.replace(/%3A/gi, ":") : "",
      ].filter((value) => Boolean(value && value.trim()))
    )
  );
}

/**
 * Find account with fuzzy matching fallback
 */
async function findAccount(candidates: string[]) {
  const normalize = (value: string) => value.trim().toLowerCase();

  // Try exact match first
  for (const candidate of candidates) {
    const account = await getConnectedAccount(candidate);
    if (account) {
      return account;
    }
  }

  // Fuzzy match fallback
  const all = await listConnectedAccounts();
  const normalizedCandidates = new Set(candidates.map(normalize));
  const idCandidates = new Set(
    candidates
      .flatMap((value) => {
        const decoded = value;
        if (decoded.includes(":")) {
          const [, ...rest] = decoded.split(":");
          return [rest.join(":"), decoded];
        }
        return [decoded];
      })
      .map(normalize)
  );

  return (
    all.find((item) => normalizedCandidates.has(normalize(item.account_key))) ??
    all.find((item) =>
      normalizedCandidates.has(normalize(`${item.provider}:${item.account_id ?? ""}`))
    ) ??
    all.find((item) => idCandidates.has(normalize(item.account_id ?? ""))) ??
    null
  );
}

export default async function ConnectedAccountPage({
  params,
  searchParams,
}: ConnectedAccountPageProps) {
  const resolvedParams = await Promise.resolve(params);
  const rawParam = resolvedParams?.accountKey ?? "";

  // Decode account key
  const candidates = decodeAccountKey(rawParam);
  const account = await findAccount(candidates);

  if (!account) {
    return (
      <DashboardLayout>
        <div className="space-y-6">
          <h1 className="text-2xl font-semibold">Account Not Found</h1>
          <p className="text-[color:var(--muted)]">
            Could not find account: <code>{rawParam}</code>
          </p>
        </div>
      </DashboardLayout>
    );
  }

  const analysis = account.analysis as Record<string, unknown> | null;

  // Get week options for this account (filtered by creation date)
  const weekOptions = await listWeekOptionsForAccount(account.account_key, true, 4);
  const currentWeekOpenUtc = getWeekOpenUtc();
  const nextWeekOpenUtc = DateTime.fromISO(currentWeekOpenUtc, { zone: "utc" })
    .plus({ days: 7 })
    .toUTC()
    .toISO();
  const weekOptionsWithUpcoming = (() => {
    const ordered: WeekOption[] = [];
    const seen = new Set<string>();
    if (nextWeekOpenUtc) {
      ordered.push(nextWeekOpenUtc);
      seen.add(nextWeekOpenUtc);
    }
    for (const week of weekOptions) {
      if (!seen.has(String(week))) {
        ordered.push(week);
        seen.add(String(week));
      }
    }
    return ordered;
  })();
  const nowUtc = DateTime.utc();
  const hoursToNext =
    nextWeekOpenUtc
      ? DateTime.fromISO(nextWeekOpenUtc, { zone: "utc" }).diff(nowUtc, "hours").hours
      : null;

  // Determine selected week
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const weekParam = resolvedSearchParams?.week;
  const viewParam = resolvedSearchParams?.view;
  const selectedWeek: WeekOption =
    viewParam === "all"
      ? "all"
      : typeof weekParam === "string" && weekOptionsWithUpcoming.includes(weekParam)
        ? weekParam
        : hoursToNext !== null && hoursToNext <= 48 && nextWeekOpenUtc
          ? nextWeekOpenUtc
          : getDefaultWeek(weekOptionsWithUpcoming, currentWeekOpenUtc);

  // Fetch week-specific data
  const stats = await getAccountStatsForWeek(account.account_key, selectedWeek);
  let basketSignals = await buildBasketSignals();

  // Load historical basket signals if not current week
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

  // Build equity curve
  const equityCurveRaw = await buildAccountEquityCurve(account.account_key, selectedWeek);
  const windowEndUtc =
    selectedWeek !== "all"
      ? DateTime.fromISO(String(selectedWeek), { zone: "utc" }).plus({ days: 7 }).toUTC().toISO()
      : null;
  const equityCurve = extendToWindow(equityCurveRaw, windowEndUtc);
  const maxDrawdownPct = computeMaxDrawdown(equityCurve);

  // Build planned trades (only for current/upcoming weeks)
  let plannedPairs: import("@/lib/plannedTrades").PlannedPair[] = [];
  let plannedNote: string | null = null;

  if (selectedWeek !== "all") {
    if (account.provider === "bitget") {
      const filtered = filterForBitget(basketSignals.pairs);
      const planned = buildBitgetPlannedTrades(filtered);
      plannedPairs = planned.pairs;
      plannedNote = planned.note ?? null;

    } else if (account.provider === "oanda") {
      const filtered = filterForOanda(basketSignals.pairs);
      plannedPairs = groupSignals(filtered);
    }
  }

  // Extract mapped instruments
  const mapped = Array.isArray(analysis?.mapped)
    ? (analysis.mapped as Array<{ symbol: string; instrument: string; available: boolean }>)
    : [];
  const fallbackMapped =
    account.provider === "bitget"
      ? [
          { symbol: "BTCUSD", instrument: "BTCUSDT", available: true },
          { symbol: "ETHUSD", instrument: "ETHUSDT", available: true },
        ]
      : [];
  let mappedRows = mapped.length > 0 ? mapped : fallbackMapped;
  if (account.provider === "oanda") {
    mappedRows = mappedRows.filter(
      (row) => row.symbol !== "BTCUSD" && row.symbol !== "ETHUSD"
    );
  }

  const accountCurrency = stats.currency;

  const plannedRows =
    plannedPairs.length === 0
      ? []
      : plannedPairs.map((pair, index) => ({
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

  const mappingRows = mappedRows.map((row, index) => ({
    id: `${row.symbol}-${index}`,
    status: row.available ? "open" : "closed",
    searchText: `${row.symbol} ${row.instrument}`,
    cells: [
      <span key="symbol" className="font-semibold">
        {row.symbol}
      </span>,
      <span key="instrument" className="text-xs text-[color:var(--muted)]">
        {row.instrument}
      </span>,
      <span
        key="status"
        className={`rounded-full px-2 py-1 text-xs font-semibold ${
          row.available
            ? "bg-emerald-500/10 text-emerald-600"
            : "bg-rose-500/10 text-rose-600"
        }`}
      >
        {row.available ? "Available" : "Missing"}
      </span>,
    ],
  }));

  const kpiRows = [
    { id: "equity", label: "Equity", value: formatCurrencySafe(stats.equity, accountCurrency) },
    { id: "balance", label: "Balance", value: formatCurrencySafe(stats.balance, accountCurrency) },
    { id: "basket", label: "Basket PnL", value: formatPercent(stats.basketPnlPct) },
    {
      id: "locked",
      label: "Locked Profit",
      value: stats.lockedProfitPct !== null ? formatPercent(stats.lockedProfitPct) : "—",
    },
    { id: "leverage", label: "Leverage", value: stats.leverage ? `${stats.leverage}x` : "—" },
    { id: "margin", label: "Margin", value: stats.margin ? formatCurrencySafe(stats.margin, accountCurrency) : "—" },
    { id: "free", label: "Free Margin", value: stats.freeMargin ? formatCurrencySafe(stats.freeMargin, accountCurrency) : "—" },
    { id: "risk", label: "Risk Used", value: stats.riskUsedPct ? formatPercent(stats.riskUsedPct) : "—" },
  ];

  const drawerConfigs: Partial<Record<Exclude<DrawerMode, null>, DrawerConfig>> = {
    positions: {
      title: "Open Positions",
      subtitle: "Live positions for this account",
      columns: [
        { key: "symbol", label: "Symbol" },
        { key: "status", label: "Status" },
        { key: "note", label: "Notes" },
      ],
      rows: [],
      showFilters: true,
      emptyState: "No live positions available for this account yet.",
    },
    planned: {
      title: "Planned Trades",
      subtitle: "Upcoming basket positions",
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
      subtitle: "Historical trade groups for this account",
      columns: [
        { key: "symbol", label: "Symbol" },
        { key: "status", label: "Status" },
        { key: "note", label: "Notes" },
      ],
      rows: [],
      showFilters: true,
      emptyState: "No closed trades stored yet.",
    },
    journal: {
      title: "Journal",
      subtitle: "Automation logs and weekly notes",
      columns: [
        { key: "item", label: "Entry" },
        { key: "detail", label: "Detail" },
      ],
      rows: [],
      showFilters: false,
      emptyState: "No journal entries yet.",
    },
    mapping: {
      title: "Mapping & Settings",
      subtitle: "Instrument mapping and account tools",
      columns: [
        { key: "symbol", label: "Symbol" },
        { key: "instrument", label: "Instrument" },
        { key: "status", label: "Status" },
      ],
      rows: mappingRows,
      showFilters: true,
      content: (
        <div className="space-y-6">
          <VirtualizedListTable
            columns={[
              { key: "symbol", label: "Symbol" },
              { key: "instrument", label: "Instrument" },
              { key: "status", label: "Status" },
            ]}
            rows={mappingRows}
            height={320}
            renderRow={(row) => (
              <div className="grid grid-cols-[repeat(auto-fit,minmax(120px,1fr))] gap-3">
                {row.cells.map((cell, index) => (
                  <div key={`${row.id}-${index}`}>{cell}</div>
                ))}
              </div>
            )}
            emptyState="No mapping data available."
          />
          {account.provider === "oanda" ? (
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                OANDA sizing
              </p>
              <div className="mt-3 rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4">
                <ConnectedAccountSizing accountKey={account.account_key} />
              </div>
            </div>
          ) : null}
        </div>
      ),
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
      <AccountClientView
        header={{
          title: account.label ?? account.account_key,
          providerLabel: account.provider.toUpperCase(),
          lastSync: account.last_sync_utc ? formatDateTimeET(account.last_sync_utc) : "—",
          weekOptions: weekOptionsWithUpcoming,
          currentWeek: currentWeekOpenUtc,
          selectedWeek,
          onBackHref: "/accounts",
        }}
        kpi={{
          weeklyPnlPct: stats.weeklyPnlPct,
          maxDrawdownPct,
          tradesThisWeek: stats.tradesThisWeek,
          equity: stats.equity,
          balance: stats.balance,
          currency: accountCurrency,
          scopeLabel: selectedWeek === "all" ? "All • Account" : "Week • Account",
        }}
        overview={{
          openPositions: stats.openPositions,
          plannedCount: plannedPairs.length,
          mappingCount: mappedRows.length,
          plannedNote: plannedNote ?? null,
        }}
        equity={{
          title: selectedWeek === "all" ? "All-time equity curve" : "Weekly equity curve (%)",
          points: equityCurve,
        }}
        debug={{
          selectedWeekKey: selectedWeek === "all" ? "all" : String(selectedWeek),
          kpiWeekKey: stats.weekOpenUtc,
          equityWeekKey: selectedWeek === "all" ? "all" : String(selectedWeek),
        }}
        drawerConfigs={drawerConfigs}
      />
    </DashboardLayout>
  );
}
