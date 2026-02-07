import DashboardLayout from "@/components/DashboardLayout";
import ConnectedAccountSizing from "@/components/ConnectedAccountSizing";
import PlannedTradesPanel from "@/components/PlannedTradesPanel";
import CollapsibleSection from "@/components/accounts/CollapsibleSection";
import WeekSelector from "@/components/accounts/WeekSelector";
import AccountStats from "@/components/accounts/AccountStats";
import EquityCurveChart from "@/components/research/EquityCurveChart";
import DebugReadout from "@/components/DebugReadout";
import { readBotState } from "@/lib/botState";
import { getConnectedAccount, listConnectedAccounts } from "@/lib/connectedAccounts";
import { formatDateET, formatDateTimeET } from "@/lib/time";
import { buildBasketSignals } from "@/lib/basketSignals";
import {
  buildBitgetPlannedTrades,
  filterForBitget,
  filterForOanda,
  groupSignals,
  signalsFromSnapshots,
} from "@/lib/plannedTrades";
import { buildOandaSizingForAccount } from "@/lib/oandaSizing";
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

  // Read bot state
  const botState =
    account.provider === "oanda"
      ? await readBotState("oanda_universal_bot")
      : account.provider === "bitget"
        ? await readBotState("bitget_perp_bot")
        : null;

  const analysis = account.analysis as Record<string, unknown> | null;

  // Get week options for this account (filtered by creation date)
  const weekOptions = await listWeekOptionsForAccount(account.account_key, true, 4);
  const currentWeekOpenUtc = getWeekOpenUtc();

  // Determine selected week
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const weekParam = resolvedSearchParams?.week;
  const viewParam = resolvedSearchParams?.view;
  const selectedWeek: WeekOption =
    viewParam === "all"
      ? "all"
      : typeof weekParam === "string" && weekOptions.includes(weekParam)
        ? weekParam
        : getDefaultWeek(weekOptions, currentWeekOpenUtc);

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
  const equityCurve = await buildAccountEquityCurve(account.account_key, selectedWeek);

  // Build planned trades (only for current/upcoming weeks)
  let plannedPairs: import("@/lib/plannedTrades").PlannedPair[] = [];
  let plannedNote: string | null = null;
  let sizeBySymbol: Record<string, number> | undefined;
  let sizeLabel: string | undefined;
  let headerMeta: string | undefined;
  let pairMeta: Record<string, string> | undefined;
  let showOnePercent = true;
  let showLegDetails = true;
  let showLegCount = true;

  if (selectedWeek !== "all") {
    if (account.provider === "bitget") {
      const filtered = filterForBitget(basketSignals.pairs);
      const planned = buildBitgetPlannedTrades(filtered);
      plannedPairs = planned.pairs;
      plannedNote = planned.note ?? null;

      const leverage =
        typeof analysis?.leverage === "number"
          ? analysis.leverage
          : typeof (account.config as Record<string, unknown> | null)?.leverage === "number"
            ? ((account.config as Record<string, unknown>).leverage as number)
            : 10;
      const equity = stats.equity;
      const allocationPct = plannedPairs.length > 0 ? 100 / plannedPairs.length : 0;
      const allocationUsd = equity * (allocationPct / 100);

      headerMeta = `LEV ${leverage}x · ALLOC ${allocationPct.toFixed(0)}% (${allocationUsd.toFixed(2)})`;
      pairMeta = Object.fromEntries(
        plannedPairs.map((pair) => [pair.symbol, `LEV ${leverage}x · ${allocationPct.toFixed(0)}%`])
      );
      showOnePercent = false;
      showLegDetails = false;
      showLegCount = false;
    } else if (account.provider === "oanda") {
      const filtered = filterForOanda(basketSignals.pairs);
      plannedPairs = groupSignals(filtered);

      try {
        const sizing = await buildOandaSizingForAccount(account.account_key);
        sizeBySymbol = Object.fromEntries(
          sizing.rows
            .filter((row) => row.available && typeof row.units === "number")
            .map((row) => [row.symbol, row.units ?? 0])
        );
        sizeLabel = "units";
      } catch (error) {
        console.error("OANDA sizing load failed:", error);
      }
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

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {/* Header with Week Selector */}
        <header className="space-y-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              Connected Account
            </p>
            <h1 className="text-3xl font-semibold text-[var(--foreground)]">
              {account.label ?? account.account_key}
            </h1>
            <p className="text-sm text-[color:var(--muted)]">
              Provider: {account.provider.toUpperCase()} · Status: {account.status ?? "READY"}
            </p>
          </div>

          <WeekSelector
            weekOptions={weekOptions}
            currentWeek={currentWeekOpenUtc}
            selectedWeek={selectedWeek}
          />
        </header>

        {/* Reactive Stats Grid */}
        <AccountStats accountKey={account.account_key} initialStats={stats} />

        <CollapsibleSection
          title="Account Details"
          subtitle="Bot configuration and last sync status"
          defaultOpen={true}
        >
          <section className="grid gap-4 md:grid-cols-4">
            <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                Bot Type
              </p>
              <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">
                {account.bot_type}
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                Risk Mode
              </p>
              <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">
                {account.risk_mode ?? "—"}
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                Trail Mode
              </p>
              <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">
                {account.trail_mode ?? "—"}
              </p>
            </div>
            <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                Last Sync
              </p>
              <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">
                {account.last_sync_utc ? formatDateTimeET(account.last_sync_utc) : "—"}
              </p>
            </div>
          </section>
        </CollapsibleSection>

        {/* Basket Status - Collapsible */}
        <CollapsibleSection
          title="Basket Status"
          subtitle="Live view of the current weekly basket"
          defaultOpen={true}
        >
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">State</p>
              <p className="mt-1 font-semibold">
                {basketSignals.trading_allowed ? "READY" : "PAUSED"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                Report Date
              </p>
              <p className="mt-1 font-semibold">
                {basketSignals.report_date ? formatDateET(basketSignals.report_date) : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                Open Pairs
              </p>
              <p className="mt-1 font-semibold">{plannedPairs.length}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                Open Positions
              </p>
              <p className="mt-1 font-semibold">{stats.openPositions}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                Locked Profit
              </p>
              <p className="mt-1 font-semibold">
                {stats.lockedProfitPct !== null ? formatPercent(stats.lockedProfitPct) : "—"}
              </p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                Last Refresh
              </p>
              <p className="mt-1 font-semibold">
                {basketSignals.last_refresh_utc
                  ? formatDateTimeET(basketSignals.last_refresh_utc)
                  : "—"}
              </p>
            </div>
          </div>
        </CollapsibleSection>

        {/* Instrument Mapping - Collapsible (FIXED: Now collapsible) */}
        <CollapsibleSection
          title="Instrument Mapping"
          subtitle="Symbol to instrument mappings"
          badge={mappedRows.length}
          badgeVariant="default"
          defaultOpen={false}
        >
          <div className="grid gap-2">
            {mappedRows.map((row, index) => (
              <div
                key={`${row.symbol}-${index}`}
                className="flex items-center justify-between rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/60 p-3"
              >
                <div>
                  <p className="font-semibold text-[var(--foreground)]">{row.symbol}</p>
                  <p className="text-xs text-[color:var(--muted)]">{row.instrument}</p>
                </div>
                <span
                  className={`rounded-full px-2 py-1 text-xs font-semibold ${
                    row.available
                      ? "bg-emerald-500/10 text-emerald-600"
                      : "bg-rose-500/10 text-rose-600"
                  }`}
                >
                  {row.available ? "Available" : "Missing"}
                </span>
              </div>
            ))}
          </div>
        </CollapsibleSection>

        {/* Weekly Equity Curve - Collapsible */}
        <CollapsibleSection
          title="Equity Curve"
          subtitle={
            selectedWeek === "all"
              ? "All-time account performance"
              : "Week-to-date equity progression"
          }
          defaultOpen={true}
        >
          <EquityCurveChart
            points={equityCurve}
            title={
              selectedWeek === "all" ? "All-time equity curve" : "Weekly equity curve (%)"
            }
          />
          <div className="mt-4">
            <DebugReadout
              title="Chart + KPI Window"
              items={[
                {
                  label: "Scope",
                  value: `${account.provider}:${account.account_key}`,
                },
                {
                  label: "Window",
                  value: selectedWeek === "all" ? "all-time" : selectedWeek,
                },
                {
                  label: "Series",
                  value: "account_equity_curve",
                },
              ]}
            />
          </div>
        </CollapsibleSection>

        {/* Planned Trades - Collapsible */}
        {selectedWeek !== "all" && plannedPairs.length > 0 && (
          <CollapsibleSection
            title="Planned Trades"
            subtitle="Upcoming basket positions"
            badge={plannedPairs.length}
            badgeVariant="success"
            defaultOpen={true}
          >
            <PlannedTradesPanel
              title="Planned Trades"
              weekOpenUtc={basketSignals.week_open_utc}
              currency={accountCurrency}
              accountBalance={stats.equity}
              pairs={plannedPairs}
              note={plannedNote}
              sizeBySymbol={sizeBySymbol}
              sizeLabel={sizeLabel}
              showOnePercent={showOnePercent}
              showLegDetails={showLegDetails}
              showLegCount={showLegCount}
              headerMeta={headerMeta}
              pairMeta={pairMeta}
              openSymbols={{}}
            />
          </CollapsibleSection>
        )}

        {/* OANDA Sizing - Collapsible */}
        {account.provider === "oanda" && (
          <CollapsibleSection
            title="OANDA Sizing"
            subtitle="Position sizing calculator"
            defaultOpen={false}
          >
            <ConnectedAccountSizing accountKey={account.account_key} />
          </CollapsibleSection>
        )}
      </div>
    </DashboardLayout>
  );
}
