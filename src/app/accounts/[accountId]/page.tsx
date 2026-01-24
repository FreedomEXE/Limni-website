import { notFound } from "next/navigation";

import {
  getMt5AccountById,
  readMt5ClosedPositions,
  readMt5ClosedPositionsByWeek,
  readMt5ClosedSummary,
  readMt5DrawdownRange,
  readMt5ChangeLog,
} from "@/lib/mt5Store";
import PositionsTable from "@/components/PositionsTable";
import DashboardLayout from "@/components/DashboardLayout";
import RefreshButton from "@/components/RefreshButton";
import { DateTime } from "luxon";
import { formatDateET, formatDateTimeET } from "@/lib/time";
import { getWeekOpenUtc, isWeekOpenUtc, weekLabelFromOpen } from "@/lib/performanceSnapshots";

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

function formatCurrency(value: number, currency: string) {
  const safeCurrency = currency || "USD";
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: safeCurrency,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 2,
    }).format(value);
  }
}

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

export default async function AccountPage({ params, searchParams }: AccountPageProps) {
  const { accountId } = await params;
  const resolvedSearchParams = await Promise.resolve(searchParams);
  const weekParam = resolvedSearchParams?.week;
  const requestedWeek = Array.isArray(weekParam) ? weekParam[0] : weekParam;
  const selectedWeek = requestedWeek && isWeekOpenUtc(requestedWeek) ? requestedWeek : null;
  let account = null;
  let closedPositions: Awaited<ReturnType<typeof readMt5ClosedPositions>> = [];
  let closedSummary: Awaited<ReturnType<typeof readMt5ClosedSummary>> = [];
  let changeLog: Awaited<ReturnType<typeof readMt5ChangeLog>> = [];
  let weeklyDrawdown = 0;
  try {
    account = await getMt5AccountById(accountId);
    closedSummary = await readMt5ClosedSummary(accountId, 12);
    changeLog = await readMt5ChangeLog(accountId, 12);
    closedPositions = selectedWeek
      ? await readMt5ClosedPositionsByWeek(accountId, selectedWeek, 500)
      : await readMt5ClosedPositions(accountId, 200);
    const weekOpen = getWeekOpenUtc();
    const weekEnd = DateTime.fromISO(weekOpen, { zone: "utc" }).plus({ days: 7 }).toISO();
    if (weekEnd) {
      weeklyDrawdown = await readMt5DrawdownRange(accountId, weekOpen, weekEnd);
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

  return (
    <DashboardLayout>
      <div className="space-y-8">
        {!account ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50/80 p-6 text-sm text-rose-700">
            Account data could not be loaded. Check database connectivity and MT5
            push status.
          </div>
        ) : null}
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold text-[var(--foreground)]">
                {account?.label ?? "Account"}
              </h1>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(
                  account?.status ?? "PAUSED",
                )}`}
              >
                {account?.status ?? "UNKNOWN"}
              </span>
            </div>
            <p className="text-sm text-[color:var(--muted)]">
              {account?.broker || "Unknown broker"} -{" "}
              {account?.server || "Unknown server"}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] px-4 py-3 text-sm text-[color:var(--muted)] shadow-sm">
              Last sync {formatDateTimeET(account?.last_sync_utc ?? "")}
            </div>
            <a
              href={`/api/mt5/closed-positions/${accountId}?format=csv`}
              download
              className="inline-flex items-center justify-center rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] px-4 py-3 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
            >
              Export closed trades
            </a>
            <RefreshButton />
          </div>
        </header>

        {account ? (
          <>
            <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              Equity
            </p>
            <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
              {formatCurrency(account.equity, account.currency)}
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              Balance
            </p>
            <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
              {formatCurrency(account.balance, account.currency)}
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              Weekly PnL
            </p>
            <p
              className={`mt-2 text-2xl font-semibold ${
                account.weekly_pnl_pct >= 0
                  ? "text-emerald-700"
                  : "text-rose-700"
              }`}
            >
              {formatPercent(account.weekly_pnl_pct)}
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              Basket PnL
            </p>
            <p
              className={`mt-2 text-2xl font-semibold ${
                account.basket_pnl_pct >= 0
                  ? "text-emerald-700"
                  : "text-rose-700"
              }`}
            >
              {formatPercent(account.basket_pnl_pct)}
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
                <p className={`mt-1 font-semibold ${basketTone(account.basket_state)}`}>
                  {account.basket_state}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Report date
                </p>
                <p className="mt-1 font-semibold">
                  {formatDateET(account.report_date)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Open pairs
                </p>
                <p className="mt-1 font-semibold">{account.open_pairs}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Open positions
                </p>
                <p className="mt-1 font-semibold">{account.open_positions}</p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Total lots
                </p>
                <p className="mt-1 font-semibold">
                  {account.total_lots.toFixed(2)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Locked profit
                </p>
                <p className="mt-1 font-semibold">
                  {formatPercent(account.locked_profit_pct)}
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
                <p
                  className={`mt-1 font-semibold ${
                    account.api_ok ? "text-emerald-700" : "text-rose-700"
                  }`}
                >
                  {account.api_ok ? "OK" : "Error"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Trading allowed
                </p>
                <p
                  className={`mt-1 font-semibold ${
                    account.trading_allowed ? "text-emerald-700" : "text-rose-700"
                  }`}
                >
                  {account.trading_allowed ? "Yes" : "No"}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Next add
                </p>
                <p className="mt-1 font-semibold">
                  {formatDuration(account.next_add_seconds)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Next poll
                </p>
                <p className="mt-1 font-semibold">
                  {formatDuration(account.next_poll_seconds)}
                </p>
              </div>
            </div>
            <div className="mt-4 rounded-xl border border-dashed border-[var(--panel-border)] bg-[var(--panel)]/60 p-3 text-xs text-[color:var(--muted)]">
              {account.last_api_error || "No API errors reported."}
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">Risk & margin</h2>
            <p className="text-sm text-[color:var(--muted)]">
              Pair caps and account buffers.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Risk used
                </p>
                <p className="mt-1 font-semibold">
                  {formatPercent(account.risk_used_pct)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Max drawdown (week)
                </p>
                <p className="mt-1 font-semibold">
                  {formatPercent(weeklyDrawdown)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Baseline equity
                </p>
                <p className="mt-1 font-semibold">
                  {formatCurrency(account.baseline_equity, account.currency)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Trades this week
                </p>
                <p className="mt-1 font-semibold">
                  {account.trade_count_week}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Margin
                </p>
                <p className="mt-1 font-semibold">
                  {formatCurrency(account.margin, account.currency)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Free margin
                </p>
                <p className="mt-1 font-semibold">
                  {formatCurrency(account.free_margin, account.currency)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Win rate
                </p>
                <p className="mt-1 font-semibold">
                  {formatPercent(account.win_rate_pct)}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Max drawdown (all)
                </p>
                <p className="mt-1 font-semibold">
                  {formatPercent(account.max_drawdown_pct)}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              Open Positions
            </h2>
            <p className="text-sm text-[color:var(--muted)]">
              {account.open_positions} active position{account.open_positions !== 1 ? 's' : ''} across {account.open_pairs} pair{account.open_pairs !== 1 ? 's' : ''}
            </p>
          </div>

          <PositionsTable
            positions={account.positions || []}
            currency={account.currency}
            equity={account.equity}
          />
        </section>

        <section className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              Weekly trade history
            </h2>
            <p className="text-sm text-[color:var(--muted)]">
              Closed position results grouped by trading week.
            </p>
          </div>
          {requestedWeek && !selectedWeek ? (
            <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50/80 px-4 py-3 text-xs text-rose-700">
              Invalid week value. Select a valid week from the dropdown.
            </div>
          ) : null}
          {closedSummary.length === 0 ? (
            <p className="text-sm text-[color:var(--muted)]">
              No closed trades yet. Enable closed_positions in the MT5 push payload.
            </p>
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {closedSummary.map((week, index) => {
                const winRate =
                  week.trades > 0 ? (week.wins / week.trades) * 100 : 0;
                const prevWeek = closedSummary[index + 1];
                const deltaNet =
                  prevWeek ? week.net_profit - prevWeek.net_profit : null;
                return (
                  <div
                    key={week.week_open_utc}
                    className={`rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/80 p-4 ${
                      selectedWeek === week.week_open_utc ? "border-[var(--accent)]/50" : ""
                    }`}
                  >
                    <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                      {weekLabelFromOpen(week.week_open_utc)}
                    </p>
                    <p
                      className={`mt-2 text-2xl font-semibold ${
                        week.net_profit > 0
                          ? "text-emerald-700"
                          : week.net_profit < 0
                            ? "text-rose-700"
                            : "text-[var(--foreground)]"
                      }`}
                    >
                      {formatCurrency(week.net_profit, account.currency)}
                    </p>
                    <div className="mt-2 space-y-1 text-xs text-[color:var(--muted)]">
                      <p>{week.trades} trades</p>
                      <p>Win rate {winRate.toFixed(0)}%</p>
                      <p>Avg net {formatCurrency(week.avg_net, account.currency)}</p>
                      {deltaNet !== null ? (
                        <p
                          className={
                            deltaNet >= 0 ? "text-emerald-700" : "text-rose-700"
                          }
                        >
                          vs prev {formatCurrency(deltaNet, account.currency)}
                        </p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
          <div className="mb-4">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              EA change log
            </h2>
            <p className="text-sm text-[color:var(--muted)]">
              Notes on weekly strategy tweaks for this account.
            </p>
          </div>
          {changeLog.length === 0 ? (
            <p className="text-sm text-[color:var(--muted)]">
              No change log entries yet. Add rows to mt5_change_log to track weekly improvements.
            </p>
          ) : (
            <div className="space-y-3">
              {changeLog.map((entry) => (
                <div
                  key={`${entry.week_open_utc}-${entry.created_at}-${entry.title}`}
                  className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                      {weekLabelFromOpen(entry.week_open_utc)}
                    </p>
                    {entry.strategy ? (
                      <span className="rounded-full border border-[var(--panel-border)] bg-[var(--panel)] px-2 py-1 text-xs font-semibold text-[color:var(--muted)]">
                        {entry.strategy}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">
                    {entry.title}
                  </p>
                  {entry.notes ? (
                    <p className="mt-1 text-sm text-[color:var(--muted)]">
                      {entry.notes}
                    </p>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold text-[var(--foreground)]">
                Closed positions
              </h2>
              <p className="text-sm text-[color:var(--muted)]">
                Recent closed trades captured from MT5.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              {closedSummary.length > 0 ? (
                <form action={`/accounts/${accountId}`} method="get" className="flex items-center gap-2">
                  <select
                    name="week"
                    defaultValue={selectedWeek ?? ""}
                    className="rounded-full border border-[var(--panel-border)] bg-[var(--panel)]/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]"
                  >
                    <option value="">All weeks</option>
                    {closedSummary.map((week) => (
                      <option key={week.week_open_utc} value={week.week_open_utc}>
                        {weekLabelFromOpen(week.week_open_utc)}
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
              ) : null}
              <span>{closedPositions.length} records</span>
            </div>
          </div>
          {closedPositions.length === 0 ? (
            <p className="text-sm text-[color:var(--muted)]">
              No closed positions stored yet.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="sticky top-0 bg-[var(--panel)] text-xs uppercase text-[var(--muted)]">
                  <tr>
                    <th className="py-2">Close time</th>
                    <th className="py-2">Pair</th>
                    <th className="py-2">Type</th>
                    <th className="py-2">Lots</th>
                    <th className="py-2">Net P&L</th>
                    <th className="py-2">Open</th>
                    <th className="py-2">Close</th>
                  </tr>
                </thead>
                <tbody className="text-[var(--foreground)]">
                  {closedPositions.map((trade) => {
                    const net =
                      trade.profit + trade.swap + trade.commission;
                    return (
                      <tr
                        key={`${trade.ticket}-${trade.close_time}`}
                        className="border-t border-[var(--panel-border)]/40"
                      >
                        <td className="py-2 text-xs text-[color:var(--muted)]">
                          {formatDateTimeET(trade.close_time)}
                        </td>
                        <td className="py-2 font-semibold">{trade.symbol}</td>
                        <td className="py-2">
                          <span
                            className={`rounded-full px-2 py-1 text-xs font-semibold ${
                              trade.type === "BUY"
                                ? "bg-emerald-100 text-emerald-700"
                                : "bg-rose-100 text-rose-700"
                            }`}
                          >
                            {trade.type}
                          </span>
                        </td>
                        <td className="py-2">{trade.lots.toFixed(2)}</td>
                        <td
                          className={`py-2 font-semibold ${
                            net >= 0 ? "text-emerald-700" : "text-rose-700"
                          }`}
                        >
                          {formatCurrency(net, account.currency)}
                        </td>
                        <td className="py-2 text-xs text-[color:var(--muted)]">
                          {trade.open_price.toFixed(5)}
                        </td>
                        <td className="py-2 text-xs text-[color:var(--muted)]">
                          {trade.close_price.toFixed(5)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
          </>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
