"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

import { formatCurrencySafe } from "@/lib/formatters";
import type { Mt5AccountSnapshot } from "@/lib/mt5Store";
import { formatDateTimeET } from "@/lib/time";

const percentFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const sortOptions = [
  { value: "equity", label: "Equity" },
  { value: "weekly_pnl_pct", label: "Weekly PnL" },
  { value: "last_sync_utc", label: "Last sync" },
  { value: "open_positions", label: "Open positions" },
] as const;

type SortKey = (typeof sortOptions)[number]["value"];
type StatusFilter = "ALL" | "LIVE" | "DEMO" | "PAUSED";

function formatPercent(value: number) {
  if (!Number.isFinite(value)) {
    return "0.00%";
  }
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

type AccountsDirectoryProps = {
  accounts: Mt5AccountSnapshot[];
  pushUrl: string;
  pushTokenSet: boolean;
};

export default function AccountsDirectory({
  accounts,
  pushUrl,
  pushTokenSet,
}: AccountsDirectoryProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("ALL");
  const [sortKey, setSortKey] = useState<SortKey>("equity");
  const [sortDescending, setSortDescending] = useState(true);
  const [showConnect, setShowConnect] = useState(false);

  const filtered = useMemo(() => {
    const normalized = searchTerm.trim().toLowerCase();
    let list = accounts;

    if (statusFilter !== "ALL") {
      list = list.filter((account) => account.status === statusFilter);
    }

    if (normalized) {
      list = list.filter((account) => {
        const haystack = [
          account.label,
          account.account_id,
          account.broker,
          account.server,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return haystack.includes(normalized);
      });
    }

    const sorted = [...list];
    sorted.sort((a, b) => {
      let aValue = 0;
      let bValue = 0;
      if (sortKey === "last_sync_utc") {
        aValue = new Date(a.last_sync_utc).getTime() || 0;
        bValue = new Date(b.last_sync_utc).getTime() || 0;
      } else {
        aValue = Number(a[sortKey]) || 0;
        bValue = Number(b[sortKey]) || 0;
      }
      return sortDescending ? bValue - aValue : aValue - bValue;
    });

    return sorted;
  }, [accounts, searchTerm, sortKey, sortDescending, statusFilter]);

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-2">
            <p className="text-xs uppercase tracking-[0.25em] text-[color:var(--muted)]">
              Connect an account
            </p>
            <h2 className="text-xl font-semibold text-[var(--foreground)]">
              MT5 push setup
            </h2>
            <p className="text-sm text-[color:var(--muted)]">
              The EA sends account snapshots to your Limni API. Keep this
              endpoint reachable from the terminal or VPS.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowConnect((current) => !current)}
            className="inline-flex items-center justify-center rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
          >
            {showConnect ? "Hide details" : "Connect account"}
          </button>
        </div>

        {showConnect ? (
          <div className="mt-6 grid gap-4 text-sm text-[color:var(--muted)] md:grid-cols-3">
            <div className="rounded-xl border border-dashed border-[var(--panel-border)] bg-[var(--panel)]/70 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                Push URL
              </p>
              <p className="mt-2 break-all font-mono text-sm text-[var(--foreground)]">
                {pushUrl}
              </p>
            </div>
            <div className="rounded-xl border border-dashed border-[var(--panel-border)] bg-[var(--panel)]/70 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                Token status
              </p>
              <p
                className={`mt-2 font-semibold ${
                  pushTokenSet ? "text-emerald-700" : "text-rose-700"
                }`}
              >
                {pushTokenSet ? "Token configured" : "Token missing"}
              </p>
              <p className="mt-2 text-xs text-[color:var(--muted)]">
                Set MT5_PUSH_TOKEN in your environment and paste the same value
                in the EA settings.
              </p>
            </div>
            <div className="rounded-xl border border-dashed border-[var(--panel-border)] bg-[var(--panel)]/70 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                Checklist
              </p>
              <ul className="mt-2 space-y-1 text-xs text-[color:var(--muted)]">
                <li>Allow WebRequest for the push URL.</li>
                <li>Enable PushAccountStats in the EA.</li>
                <li>Keep the dashboard API online.</li>
              </ul>
            </div>
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-4 rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-wrap items-center gap-3">
            {(["ALL", "LIVE", "DEMO", "PAUSED"] as StatusFilter[]).map(
              (status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                    statusFilter === status
                      ? "bg-[var(--accent)] text-white"
                      : "bg-[var(--panel)] text-[color:var(--muted)] hover:bg-[var(--panel)]/80"
                  }`}
                >
                  {status}
                </button>
              ),
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search label, broker, or account..."
              className="w-full rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/70 px-3 py-2 text-sm text-[var(--foreground)] placeholder:text-[color:var(--muted)] focus:border-[var(--accent)] focus:outline-none lg:w-64"
            />
            <div className="flex items-center gap-2">
              <select
                value={sortKey}
                onChange={(event) => setSortKey(event.target.value as SortKey)}
                className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/70 px-3 py-2 text-sm text-[var(--foreground)] focus:border-[var(--accent)] focus:outline-none"
              >
                {sortOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => setSortDescending((value) => !value)}
                className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/70 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)] transition hover:border-[var(--accent)]"
              >
                {sortDescending ? "Desc" : "Asc"}
              </button>
            </div>
          </div>
        </div>

        <p className="text-xs uppercase tracking-[0.25em] text-[color:var(--muted)]">
          Showing {filtered.length} of {accounts.length} accounts
        </p>

        <div className="grid gap-5 md:grid-cols-2">
          {filtered.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--panel-border)] bg-[var(--panel)]/70 p-6 text-sm text-[color:var(--muted)]">
              No MT5 accounts matched your filters.
            </div>
          ) : (
            filtered.map((account) => (
              <Link
                key={account.account_id}
                href={`/accounts/${account.account_id}`}
                className="group rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--accent)]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h3 className="text-lg font-semibold text-[var(--foreground)]">
                      {account.label}
                    </h3>
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

                <div className="mt-4 flex items-center justify-between text-xs uppercase tracking-[0.25em] text-[color:var(--muted)]">
                  <span>Last sync {formatDateTimeET(account.last_sync_utc)}</span>
                  <span className="text-[color:var(--accent-strong)]">
                    View details
                  </span>
                </div>
              </Link>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
