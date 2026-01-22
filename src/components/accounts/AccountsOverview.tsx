"use client";

import Link from "next/link";
import { useState } from "react";
import InfoModal from "@/components/InfoModal";
import type { Mt5AccountSnapshot } from "@/lib/mt5Store";

type AccountsOverviewProps = {
  accounts: Mt5AccountSnapshot[];
};

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
    return "bg-[var(--panel-border)]/50 text-[var(--foreground)]/70";
  }
  return "bg-rose-100 text-rose-700";
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

export default function AccountsOverview({ accounts }: AccountsOverviewProps) {
  const [activeSummary, setActiveSummary] = useState<{
    title: string;
    value: string;
  } | null>(null);
  const [activeAccount, setActiveAccount] = useState<Mt5AccountSnapshot | null>(
    null,
  );

  const totalEquity = accounts.reduce(
    (sum, account) => sum + (Number.isFinite(account.equity) ? account.equity : 0),
    0,
  );
  const activeBaskets = accounts.filter(
    (account) => account.basket_state === "ACTIVE",
  ).length;

  return (
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
        <button
          type="button"
          className="inline-flex items-center justify-center rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
        >
          Connect account
        </button>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <button
          type="button"
          onClick={() =>
            setActiveSummary({
              title: "Accounts connected",
              value: String(accounts.length),
            })
          }
          className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4 text-left shadow-sm"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
            Accounts connected
          </p>
          <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">
            View
          </p>
        </button>
        <button
          type="button"
          onClick={() =>
            setActiveSummary({
              title: "Total equity",
              value: formatCurrency(totalEquity, "USD"),
            })
          }
          className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4 text-left shadow-sm"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
            Total equity
          </p>
          <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">
            View
          </p>
        </button>
        <button
          type="button"
          onClick={() =>
            setActiveSummary({
              title: "Active baskets",
              value: String(activeBaskets),
            })
          }
          className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4 text-left shadow-sm"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
            Active baskets
          </p>
          <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">
            View
          </p>
        </button>
      </section>

      <section className="grid gap-5 md:grid-cols-2">
        {accounts.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--panel-border)] bg-[var(--panel)]/70 p-6 text-sm text-[color:var(--muted)]">
            No MT5 accounts connected yet. Add the push URL and token in your
            EA settings to start streaming account snapshots.
          </div>
        ) : (
          accounts.map((account) => (
            <button
              key={account.account_id}
              type="button"
              onClick={() => setActiveAccount(account)}
              className="group rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--accent)]"
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
              <div className="mt-4 text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                Tap for account details
              </div>
            </button>
          ))
        )}
      </section>

      {activeSummary ? (
        <InfoModal
          title={activeSummary.title}
          onClose={() => setActiveSummary(null)}
        >
          <div className="flex items-center justify-between">
            <span>Value</span>
            <span className="font-semibold text-[var(--foreground)]">
              {activeSummary.value}
            </span>
          </div>
        </InfoModal>
      ) : null}

      {activeAccount ? (
        <InfoModal
          title={activeAccount.label}
          subtitle={`${activeAccount.broker || "Unknown broker"} · ${activeAccount.server || "Unknown server"}`}
          onClose={() => setActiveAccount(null)}
        >
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span>Equity</span>
              <span className="font-semibold text-[var(--foreground)]">
                {formatCurrency(activeAccount.equity, activeAccount.currency)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Weekly PnL</span>
              <span className="font-semibold text-[var(--foreground)]">
                {formatPercent(activeAccount.weekly_pnl_pct)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Basket state</span>
              <span className="font-semibold text-[var(--foreground)]">
                {activeAccount.basket_state}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Open positions</span>
              <span className="font-semibold text-[var(--foreground)]">
                {activeAccount.open_positions}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Win rate</span>
              <span className="font-semibold text-[var(--foreground)]">
                {formatPercent(activeAccount.win_rate_pct)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Max drawdown</span>
              <span className="font-semibold text-[var(--foreground)]">
                {formatPercent(activeAccount.max_drawdown_pct)}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Risk used</span>
              <span className="font-semibold text-[var(--foreground)]">
                {formatPercent(activeAccount.risk_used_pct)}
              </span>
            </div>
            <div className="pt-2 text-xs text-[color:var(--muted)]">
              Last sync {formatTimestamp(activeAccount.last_sync_utc)}
            </div>
            <div className="pt-3">
              <Link
                href={`/accounts/${activeAccount.account_id}`}
                className="inline-flex items-center justify-center rounded-lg bg-[var(--accent)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-white transition hover:bg-[var(--accent-strong)]"
              >
                View account
              </Link>
            </div>
          </div>
        </InfoModal>
      ) : null}
    </div>
  );
}
