import Link from "next/link";

import DashboardLayout from "@/components/DashboardLayout";
import { formatCurrencySafe } from "@/lib/formatters";
import { readMt5Accounts } from "@/lib/mt5Store";
import { formatDateTimeET, latestIso } from "@/lib/time";

export const dynamic = "force-dynamic";

const percentFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatPercent(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "" : "";
  return `${sign}${percentFormatter.format(value)}%`;
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
  const latestSync = latestIso(
    accounts.map((account) => account.last_sync_utc),
  );

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-semibold text-[var(--foreground)]">
              Connected Accounts
            </h1>
            <p className="text-sm text-[color:var(--muted)]">
              Monitor live baskets, exposure, and performance across every
              linked MT5 account.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              Last refresh {latestSync ? formatDateTimeET(latestSync) : "No refresh yet"}
            </span>
            <button
              type="button"
              className="inline-flex items-center justify-center rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
            >
              Connect account
            </button>
          </div>
        </header>

        <section className="grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              Accounts connected
            </p>
            <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
              {accounts.length}
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              Total equity
            </p>
            <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
              {formatCurrencySafe(totalEquity, "USD")}
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4 shadow-sm">
            <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              Active baskets
            </p>
            <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
              {activeBaskets}
            </p>
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-2">
          {accounts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--panel-border)] bg-[var(--panel)]/70 p-6 text-sm text-[color:var(--muted)]">
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
                    <h2 className="text-lg font-semibold text-[var(--foreground)]">
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

                <div className="mt-4 grid gap-3 text-sm text-[var(--foreground)] sm:grid-cols-2">
                  <div>
                    <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                      Equity
                    </p>
                    <p className="mt-1 font-semibold">
                      {formatCurrencySafe(account.equity, account.currency)}
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
                  <span className="rounded-full border border-[var(--panel-border)] bg-[var(--panel)]/70 px-3 py-1 text-[color:var(--muted)]">
                    Risk used {formatPercent(account.risk_used_pct)}
                  </span>
                </div>

                <div className="mt-4 flex items-center justify-between text-xs uppercase tracking-[0.25em] text-[color:var(--muted)]">
                  <span>Last sync {formatDateTimeET(account.last_sync_utc)}</span>
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
