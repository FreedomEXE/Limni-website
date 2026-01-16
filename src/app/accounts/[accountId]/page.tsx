import Link from "next/link";
import { notFound } from "next/navigation";

import { getMt5AccountById } from "@/lib/mt5Store";
import PositionsTable from "@/components/PositionsTable";
import DashboardLayout from "@/components/DashboardLayout";
import RefreshButton from "@/components/RefreshButton";

export const dynamic = "force-dynamic";

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

function formatDate(value: string) {
  if (!value) {
    return "Unknown";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
  });
}

function formatDateTime(value: string) {
  if (!value) {
    return "Unknown";
  }
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }
  return parsed.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
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
    return "bg-sky-100 text-sky-700";
  }
  return "bg-rose-100 text-rose-700";
}

function basketTone(state: string) {
  if (state === "ACTIVE") {
    return "text-emerald-700";
  }
  if (state === "READY") {
    return "text-sky-700";
  }
  if (state === "PAUSED") {
    return "text-rose-700";
  }
  return "text-slate-500";
}

type AccountPageProps = {
  params: Promise<{ accountId: string }>;
};

export default async function AccountPage({ params }: AccountPageProps) {
  const { accountId } = await params;
  let account = null;
  try {
    account = await getMt5AccountById(accountId);
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
            <Link
              href="/accounts"
              className="text-xs uppercase tracking-[0.25em] text-[color:var(--muted)] transition hover:text-[color:var(--accent-strong)]"
            >
              Back to accounts
            </Link>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-3xl font-semibold text-slate-900">
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
              Last sync {formatDateTime(account?.last_sync_utc ?? "")}
            </div>
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
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {formatCurrency(account.equity, account.currency)}
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              Balance
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
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
            <h2 className="text-lg font-semibold text-slate-900">
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
                  {formatDate(account.report_date)}
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
            <h2 className="text-lg font-semibold text-slate-900">Operations</h2>
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
            <div className="mt-4 rounded-xl border border-dashed border-[var(--panel-border)] bg-white/60 p-3 text-xs text-[color:var(--muted)]">
              {account.last_api_error || "No API errors reported."}
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">Risk & margin</h2>
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
                  Max drawdown
                </p>
                <p className="mt-1 font-semibold">
                  {formatPercent(account.max_drawdown_pct)}
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
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-slate-900">
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
          </>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
