import Link from "next/link";

import DashboardLayout from "@/components/DashboardLayout";
import { readMt5Accounts } from "@/lib/mt5Store";

export const dynamic = "force-dynamic";

const percentFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "" : "";
  return `${sign}${percentFormatter.format(value)}%`;
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

function formatTimestamp(value: string) {
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

function pillTone(value: number, positive = true) {
  if (positive) {
    return value >= 0 ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800";
  }
  return value <= 0 ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-rose-200 bg-rose-50 text-rose-800";
}

export default async function AccountsPage() {
  let accounts: Awaited<ReturnType<typeof readMt5Accounts>> = [];
  try {
    accounts = await readMt5Accounts();
  } catch (error) {
    console.error(
      "Accounts load failed:",
      error instanceof Error ? error.message : String(error),
    );
  }
  const totalEquity = accounts.reduce(
    (sum, account) => sum + (Number.isFinite(account.equity) ? account.equity : 0),
    0,
  );
  const activeBaskets = accounts.filter(
    (account) => account.basket_state === "ACTIVE",
  ).length;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold text-slate-900">
              Connected Accounts
            </h1>
            <p className="text-sm text-slate-600">
              Monitor live baskets, exposure, and performance across every
              linked MT5 account.
            </p>
          </div>
          <button
            type="button"
            className="inline-flex items-center justify-center rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-teal-700"
          >
            Connect account
          </button>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              Accounts connected
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {accounts.length}
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              Total equity
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {formatCurrency(totalEquity, "USD")}
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              Active baskets
            </p>
            <p className="mt-2 text-2xl font-semibold text-slate-900">
              {activeBaskets}
            </p>
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-2">
          {accounts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--panel-border)] bg-white/70 p-6 text-sm text-[color:var(--muted)]">
              No MT5 accounts connected yet. Add the push URL and token in your
              EA settings to start streaming account snapshots.
            </div>
          ) : (
            accounts.map((account) => (
              <Link
                key={account.account_id}
                href={`/accounts/${account.account_id}`}
                className="group rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--accent)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-semibold text-slate-900">
                      {account.label}
                    </h2>
                    <p className="text-sm text-[color:var(--muted)]">
                      {account.broker || "Unknown broker"} -{" "}
                      {account.server || "Unknown server"}
                    </p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(
                      account.status,
                    )}`}
                  >
                    {account.status}
                  </span>
                </div>

                <div className="mt-4 grid gap-3 text-sm text-slate-900 sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                      Equity
                    </p>
                    <p className="mt-1 font-semibold">
                      {formatCurrency(account.equity, account.currency)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                      Weekly PnL
                    </p>
                    <p
                      className={`mt-1 font-semibold ${
                        account.weekly_pnl_pct >= 0
                          ? "text-emerald-700"
                          : "text-rose-700"
                      }`}
                    >
                      {formatPercent(account.weekly_pnl_pct)}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                      Basket state
                    </p>
                    <p className={`mt-1 font-semibold ${basketTone(account.basket_state)}`}>
                      {account.basket_state}
                    </p>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                      Open positions
                    </p>
                    <p className="mt-1 font-semibold">{account.open_positions}</p>
                  </div>
                </div>

                <div className="mt-4 flex flex-wrap gap-2 text-xs">
                  <span
                    className={`rounded-full border px-3 py-1 ${pillTone(
                      account.win_rate_pct,
                      true,
                    )}`}
                  >
                    Win rate {formatPercent(account.win_rate_pct)}
                  </span>
                  <span
                    className={`rounded-full border px-3 py-1 ${pillTone(
                      account.max_drawdown_pct,
                      false,
                    )}`}
                  >
                    Max DD {formatPercent(account.max_drawdown_pct)}
                  </span>
                  <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-slate-600">
                    Risk used {formatPercent(account.risk_used_pct)}
                  </span>
                </div>

                <div className="mt-4 flex items-center justify-between text-xs uppercase tracking-[0.25em] text-[color:var(--muted)]">
                  <span>Last sync {formatTimestamp(account.last_sync_utc)}</span>
                  <span className="text-[color:var(--accent-strong)]">
                    View details
                  </span>
                </div>
              </Link>
            ))
          )}
        </section>
      </div>
    </DashboardLayout>
  );
}
