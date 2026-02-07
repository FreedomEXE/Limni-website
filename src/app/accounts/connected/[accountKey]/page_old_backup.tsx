import DashboardLayout from "@/components/DashboardLayout";
import ConnectedAccountSizing from "@/components/ConnectedAccountSizing";
import PlannedTradesPanel from "@/components/PlannedTradesPanel";
import AccountSection from "@/components/accounts/AccountSection";
import EquityCurveChart from "@/components/research/EquityCurveChart";
import { readBotState } from "@/lib/botState";
import { getConnectedAccount, listConnectedAccounts } from "@/lib/connectedAccounts";
import { formatDateET, formatDateTimeET } from "@/lib/time";
import { buildBasketSignals } from "@/lib/basketSignals";
import { buildBitgetPlannedTrades, filterForBitget, filterForOanda, groupSignals, signalsFromSnapshots } from "@/lib/plannedTrades";
import { buildOandaSizingForAccount } from "@/lib/oandaSizing";
import { DateTime } from "luxon";
import { getWeekOpenUtc, listPerformanceWeeks, readPerformanceSnapshotsByWeek, weekLabelFromOpen } from "@/lib/performanceSnapshots";
import { formatCurrencySafe } from "@/lib/formatters";

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

export default async function ConnectedAccountPage({
  params,
  searchParams,
}: ConnectedAccountPageProps) {
  const resolvedParams = await Promise.resolve(params);
  const rawParam = resolvedParams?.accountKey ?? "";
  const decodeSafe = (value: string) => {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  };
  const normalize = (value: string) => value.trim().toLowerCase();
  const decodedOnce = decodeSafe(rawParam);
  const decodedTwice = decodeSafe(decodedOnce);
  const candidates = Array.from(
    new Set(
      [
        rawParam,
        decodedOnce,
        decodedTwice,
        rawParam ? rawParam.replace(/%3A/gi, ":") : "",
        decodedOnce ? decodedOnce.replace(/%3A/gi, ":") : "",
      ].filter((value) => Boolean(value && value.trim())),
    ),
  );

  let account = null;
  for (const candidate of candidates) {
    account = await getConnectedAccount(candidate);
    if (account) {
      break;
    }
  }
  if (!account) {
    const all = await listConnectedAccounts();
    const normalizedCandidates = new Set(candidates.map(normalize));
    const idCandidates = new Set(
      candidates
        .flatMap((value) => {
          const decoded = decodeSafe(value);
          if (decoded.includes(":")) {
            const [, ...rest] = decoded.split(":");
            return [rest.join(":"), decoded];
          }
          return [decoded];
        })
        .map(normalize),
    );
    account =
      all.find((item) => normalizedCandidates.has(normalize(item.account_key))) ??
      all.find((item) => normalizedCandidates.has(normalize(`${item.provider}:${item.account_id ?? ""}`))) ??
      all.find((item) => idCandidates.has(normalize(item.account_id ?? ""))) ??
      null;
  }
  const botState =
    account?.provider === "oanda"
      ? await readBotState("oanda_universal_bot")
      : account?.provider === "bitget"
        ? await readBotState("bitget_perp_bot")
        : null;
  const readiness =
    (botState as { state?: { entered?: boolean } } | null)?.state?.entered === true
      ? "ON"
      : (botState as { state?: unknown } | null)?.state
        ? "READY"
        : "OFF";

  if (!account) {
    return (
      <DashboardLayout>
        <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6">
          <h1 className="text-2xl font-semibold text-[var(--foreground)]">
            Account not found
          </h1>
          <p className="mt-2 text-sm text-[color:var(--muted)]">
            This connected account is no longer available.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  const analysis = (account.analysis ?? {}) as Record<string, unknown>;
  const mapped = Array.isArray(analysis.mapped) ? (analysis.mapped as Array<{ symbol: string; instrument: string; available: boolean }>) : [];
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
      (row) => row.symbol !== "BTCUSD" && row.symbol !== "ETHUSD",
    );
  }

  const accountBalance =
    typeof analysis.nav === "number"
      ? (analysis.nav as number)
      : typeof analysis.balance === "number"
        ? (analysis.balance as number)
        : typeof analysis.equity === "number"
          ? (analysis.equity as number)
          : 0;

  const resolvedSearchParams = await Promise.resolve(searchParams);
  const weekParam = resolvedSearchParams?.week;
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
    typeof weekParam === "string" && weekOptions.includes(weekParam)
      ? weekParam
      : weekOptions.includes(currentWeekOpenUtc)
        ? currentWeekOpenUtc
        : weekOptions[0] ?? currentWeekOpenUtc;

  let basketSignals = await buildBasketSignals();
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
  let plannedPairs: import("@/lib/plannedTrades").PlannedPair[] = [];
  let plannedNote: string | null = null;
  let sizeBySymbol: Record<string, number> | undefined;
  let sizeLabel: string | undefined;
  let headerMeta: string | undefined;
  let pairMeta: Record<string, string> | undefined;
  let showOnePercent = true;
  let showLegDetails = true;
  let showLegCount = true;
  if (account.provider === "bitget") {
    const filtered = filterForBitget(basketSignals.pairs);
    const planned = buildBitgetPlannedTrades(filtered);
    plannedPairs = planned.pairs;
    plannedNote = planned.note ?? null;
    const leverage =
      typeof analysis.leverage === "number"
        ? (analysis.leverage as number)
        : typeof (account.config as Record<string, unknown> | null)?.leverage === "number"
          ? ((account.config as Record<string, unknown>).leverage as number)
          : 10;
    const equity = accountBalance;
    const allocationPct = plannedPairs.length > 0 ? 100 / plannedPairs.length : 0;
    const allocationUsd = equity * (allocationPct / 100);
    headerMeta = `LEV ${leverage}x · ALLOC ${allocationPct.toFixed(0)}% (${allocationUsd.toFixed(2)})`;
    pairMeta = Object.fromEntries(
      plannedPairs.map((pair) => [
        pair.symbol,
        `LEV ${leverage}x · ${allocationPct.toFixed(0)}%`,
      ]),
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
          .map((row) => [row.symbol, row.units ?? 0]),
      );
      sizeLabel = "units";
    } catch (error) {
      console.error(
        "OANDA sizing load failed:",
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  const accountCurrency =
    typeof analysis.currency === "string" ? (analysis.currency as string) : "USD";
  const equityValue =
    typeof analysis.equity === "number" ? (analysis.equity as number) : accountBalance;
  const balanceValue =
    typeof analysis.balance === "number" ? (analysis.balance as number) : accountBalance;
  const weeklyPnlPct =
    typeof analysis.weekly_pnl_pct === "number" ? (analysis.weekly_pnl_pct as number) : 0;
  const basketPnlPct =
    typeof analysis.basket_pnl_pct === "number" ? (analysis.basket_pnl_pct as number) : weeklyPnlPct;
  const openSymbols: Record<string, boolean> = {};
  const curveStart = DateTime.fromISO(basketSignals.week_open_utc, { zone: "utc" });
  const curveEnd = DateTime.utc();
  const curvePoints =
    curveStart.isValid && curveEnd.isValid
      ? [
          { ts_utc: curveStart.toISO()!, equity_pct: 0, lock_pct: null },
          { ts_utc: curveEnd.toISO()!, equity_pct: 0, lock_pct: null },
        ]
      : [];

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
            Connected Account
          </p>
          <h1 className="text-3xl font-semibold text-[var(--foreground)]">
            {account.label ?? account.account_key}
          </h1>
          <p className="text-sm text-[color:var(--muted)]">
            Provider: {account.provider.toUpperCase()} · Status: {account.status ?? "READY"}
          </p>
          <form action={`/accounts/connected/${encodeURIComponent(account.account_key)}`} method="get" className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
            <label>Week</label>
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
            <button
              type="submit"
              className="rounded-full border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
            >
              View
            </button>
          </form>
        </header>

        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              Equity
            </p>
            <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
              {formatCurrencySafe(equityValue, accountCurrency)}
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              Balance
            </p>
            <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
              {formatCurrencySafe(balanceValue, accountCurrency)}
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              Weekly PnL
            </p>
            <p
              className={`mt-2 text-2xl font-semibold ${
                weeklyPnlPct >= 0 ? "text-emerald-700" : "text-rose-700"
              }`}
            >
              {formatPercent(weeklyPnlPct)}
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              Basket PnL
            </p>
            <p
              className={`mt-2 text-2xl font-semibold ${
                basketPnlPct >= 0 ? "text-emerald-700" : "text-rose-700"
              }`}
            >
              {formatPercent(basketPnlPct)}
            </p>
          </div>
        </section>

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
              Bot Readiness
            </p>
            <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">
              {readiness}
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              Risk Mode
            </p>
            <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">
              {account.risk_mode ?? "1:1"}
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

        <section className="grid gap-6 lg:grid-cols-3">
          <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              Basket status
            </h2>
            <p className="text-sm text-[color:var(--muted)]">
              Live view of the current weekly basket.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  State
                </p>
                <p className="mt-1 font-semibold">
                  {basketSignals.trading_allowed ? "READY" : "PAUSED"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Report date
                </p>
                <p className="mt-1 font-semibold">
                  {basketSignals.report_date ? formatDateET(basketSignals.report_date) : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Open pairs
                </p>
                <p className="mt-1 font-semibold">{plannedPairs.length}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Open positions
                </p>
                <p className="mt-1 font-semibold">0</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Total size
                </p>
                <p className="mt-1 font-semibold">
                  {sizeBySymbol
                    ? Object.values(sizeBySymbol).reduce((sum, value) => sum + (value ?? 0), 0).toFixed(2)
                    : plannedPairs.reduce((sum, pair) => sum + pair.legs.length, 0).toFixed(0)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Locked profit
                </p>
                <p className="mt-1 font-semibold">
                  {typeof analysis.locked_profit_pct === "number"
                    ? formatPercent(analysis.locked_profit_pct as number)
                    : "0.00%"}
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Operations</h2>
            <p className="text-sm text-[color:var(--muted)]">
              API health and scheduling.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  API status
                </p>
                <p className="mt-1 font-semibold">{botState ? "OK" : "Unknown"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Trading allowed
                </p>
                <p className="mt-1 font-semibold">{basketSignals.trading_allowed ? "Yes" : "No"}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Last refresh
                </p>
                <p className="mt-1 font-semibold">
                  {basketSignals.last_refresh_utc
                    ? formatDateTimeET(basketSignals.last_refresh_utc)
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Next poll
                </p>
                <p className="mt-1 font-semibold">n/a</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              Risk & margin
            </h2>
            <p className="text-sm text-[color:var(--muted)]">
              Pair caps and account buffers.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Risk used
                </p>
                <p className="mt-1 font-semibold">0.00%</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Max drawdown (week)
                </p>
                <p className="mt-1 font-semibold">—</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Baseline equity
                </p>
                <p className="mt-1 font-semibold">
                  {formatCurrencySafe(equityValue, accountCurrency)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Trades this week
                </p>
                <p className="mt-1 font-semibold">0</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Margin
                </p>
                <p className="mt-1 font-semibold">—</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Free margin
                </p>
                <p className="mt-1 font-semibold">—</p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              Instrument Mapping
            </h2>
            <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              {mappedRows.length} tracked
            </span>
          </div>
          <div className="mt-4 grid gap-2 text-sm">
            {mappedRows.length === 0 ? (
              <p className="text-[color:var(--muted)]">
                No instrument mapping data available yet.
              </p>
            ) : (
              mappedRows.map((row) => (
                <div
                  key={row.symbol}
                  className="flex items-center justify-between rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/70 px-3 py-2"
                >
                  <span className="font-semibold text-[var(--foreground)]">{row.symbol}</span>
                  <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    {row.instrument}
                  </span>
                  <span className={`text-xs font-semibold ${row.available ? "text-emerald-700" : "text-rose-700"}`}>
                    {row.available ? "Available" : "Missing"}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

        <AccountSection title="Weekly equity curve">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              Weekly equity curve
            </h2>
            <p className="text-sm text-[color:var(--muted)]">
              Snapshot of account-level performance for the selected week.
            </p>
          </div>
          <EquityCurveChart points={curvePoints} title="Account equity % (week-to-date)" />
        </AccountSection>

        <AccountSection title="Open positions">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              Open positions
            </h2>
            <p className="text-sm text-[color:var(--muted)]">
              Planned trades for the upcoming basket (pending until opens).
            </p>
          </div>
          <PlannedTradesPanel
            title="Open positions"
            weekOpenUtc={basketSignals.week_open_utc}
            currency={accountCurrency}
            accountBalance={accountBalance}
            pairs={plannedPairs}
            note={plannedNote}
            sizeBySymbol={sizeBySymbol}
            sizeLabel={sizeLabel}
            showOnePercent={showOnePercent}
            showLegDetails={showLegDetails}
            showLegCount={showLegCount}
            headerMeta={headerMeta}
            pairMeta={pairMeta}
            openSymbols={openSymbols}
          />
          <div className="mt-6 rounded-xl border border-dashed border-[var(--panel-border)] bg-[var(--panel)]/60 p-4 text-sm text-[color:var(--muted)]">
            Open position details will appear once trades are live.
          </div>
        </AccountSection>

        <AccountSection title="Weekly trade history">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              Weekly trade history
            </h2>
            <p className="text-sm text-[color:var(--muted)]">
              Closed trade summaries will appear after the first trading week.
            </p>
          </div>
          <div className="rounded-xl border border-dashed border-[var(--panel-border)] bg-[var(--panel)]/60 p-4 text-sm text-[color:var(--muted)]">
            No closed trades recorded yet.
          </div>
        </AccountSection>

        <AccountSection title="Closed positions">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              Closed positions
            </h2>
            <p className="text-sm text-[color:var(--muted)]">
              Closed position details will populate after sync.
            </p>
          </div>
          <div className="rounded-xl border border-dashed border-[var(--panel-border)] bg-[var(--panel)]/60 p-4 text-sm text-[color:var(--muted)]">
            No closed positions to display yet.
          </div>
        </AccountSection>

        <AccountSection title="Journal">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              Journal
            </h2>
            <p className="text-sm text-[color:var(--muted)]">
              Strategy notes and execution logs.
            </p>
          </div>
          <div className="rounded-xl border border-dashed border-[var(--panel-border)] bg-[var(--panel)]/60 p-4 text-sm text-[color:var(--muted)]">
            No journal entries yet.
          </div>
        </AccountSection>

        {account.provider === "oanda" ? (
          <ConnectedAccountSizing accountKey={account.account_key} />
        ) : null}
      </div>
    </DashboardLayout>
  );
}
