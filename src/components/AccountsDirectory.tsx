"use client";

import { useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { formatCurrencySafe } from "@/lib/formatters";
import { deleteAccount, deleteConnectedAccount } from "@/app/actions/deleteAccount";

type AccountsDirectoryProps = {
  accounts: AccountCard[];
};

export type AccountCard = {
  account_id: string;
  label: string;
  broker: string;
  server: string;
  status: string;
  currency: string;
  equity: number | null;
  weekly_pnl_pct: number | null;
  basket_state: string;
  open_positions: number | null;
  open_pairs: number | null;
  win_rate_pct: number | null;
  max_drawdown_pct: number | null;
  source: "mt5" | "bitget" | "oanda";
  href?: string;
};

const percentFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

function formatPercent(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "" : "";
  return `${sign}${percentFormatter.format(value)}%`;
}

function formatMaybePercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "--";
  }
  return formatPercent(value);
}

function formatMaybeCurrency(value: number | null, currency: string) {
  if (value === null || !Number.isFinite(value)) {
    return "--";
  }
  return formatCurrencySafe(value, currency);
}

function statusTone(status: string) {
  if (status === "LIVE") {
    return "bg-emerald-100 text-emerald-700";
  }
  if (status === "DEMO") {
    return "bg-[var(--panel-border)]/50 text-[var(--foreground)]/70";
  }
  if (status === "READY") {
    return "bg-sky-100 text-sky-700";
  }
  if (status === "WAITING") {
    return "bg-amber-100 text-amber-700";
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
  if (state === "WAITING") {
    return "text-amber-700";
  }
  return "text-[color:var(--muted)]";
}

function pillTone(value: number, positive = true) {
  if (positive) {
    return value >= 0
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : "border-rose-200 bg-rose-50 text-rose-800";
  }
  return value <= 0
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : "border-rose-200 bg-rose-50 text-rose-800";
}

export default function AccountsDirectory({ accounts }: AccountsDirectoryProps) {
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const weekParam = searchParams.get("week");
  const viewParam = searchParams.get("view");

  async function handleDelete(
    accountId: string,
    accountLabel: string,
    source: AccountCard["source"],
  ) {
    if (!confirm(`Delete account "${accountLabel}"? This cannot be undone.`)) {
      return;
    }

    setDeletingId(accountId);

    try {
      const result =
        source === "mt5"
          ? await deleteAccount(accountId)
          : await deleteConnectedAccount(accountId);

      if (!result.success) {
        throw new Error(result.error || "Failed to delete account");
      }

      window.location.reload();
    } catch (error) {
      console.error("Delete failed:", error);
      alert(
        `Failed to delete account: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
      setDeletingId(null);
    }
  }

  if (accounts.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-[var(--panel-border)] bg-[var(--panel)]/70 p-6 text-sm text-[color:var(--muted)]">
        No accounts connected yet. Add the push URL and token in your EA
        settings to start streaming account snapshots.
      </div>
    );
  }

  return (
    <div className="grid gap-5 md:grid-cols-2">
      {accounts.map((account) => (
        <div
          key={account.account_id}
          id={account.account_id}
          className="group relative rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm transition hover:border-[var(--accent)]"
        >
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              handleDelete(account.account_id, account.label, account.source);
            }}
            disabled={deletingId === account.account_id}
            className="absolute right-4 top-4 rounded-lg p-2 text-rose-600 opacity-0 transition hover:bg-rose-50 group-hover:opacity-100 disabled:opacity-50"
            title="Delete account"
          >
            {deletingId === account.account_id ? (
              <svg className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            ) : (
              <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                />
              </svg>
            )}
          </button>

          {account.href ? (
            <Link
              href={
                weekParam || viewParam
                  ? (() => {
                      const params = new URLSearchParams();
                      if (weekParam) params.set("week", weekParam);
                      if (viewParam) params.set("view", viewParam);
                      return `${account.href}?${params.toString()}`;
                    })()
                  : account.href
              }
              className="block"
            >
              <AccountCardContent account={account} />
            </Link>
          ) : (
            <div className="block">
              <AccountCardContent account={account} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function AccountCardContent({ account }: { account: AccountCard }) {
  return (
    <>
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
            {formatMaybeCurrency(account.equity, account.currency)}
          </p>
        </div>
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
            Weekly PnL
          </p>
          <p
            className={`mt-1 font-semibold ${
              (account.weekly_pnl_pct ?? 0) >= 0
                ? "text-emerald-700"
                : "text-rose-700"
            }`}
          >
            {formatMaybePercent(account.weekly_pnl_pct)}
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
          <p className="mt-1 font-semibold">{account.open_positions ?? 0}</p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-xs">
        <span
          className={`rounded-full border px-3 py-1 ${pillTone(
            account.win_rate_pct ?? 0,
            true
          )}`}
        >
          Win {formatMaybePercent(account.win_rate_pct)}
        </span>
        <span
          className={`rounded-full border px-3 py-1 ${pillTone(
            -(account.max_drawdown_pct ?? 0),
            false
          )}`}
        >
          DD {formatMaybePercent(account.max_drawdown_pct)}
        </span>
        <span className="rounded-full border border-[var(--panel-border)] bg-[var(--panel)]/50 px-3 py-1 text-[color:var(--muted)]">
          {account.open_pairs ?? 0} pairs
        </span>
      </div>
    </>
  );
}
