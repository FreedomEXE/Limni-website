"use client";

import { useState } from "react";
import InfoModal from "@/components/InfoModal";
import type { Mt5AccountSnapshot } from "@/lib/mt5Store";
import PositionsTable from "@/components/PositionsTable";
import RefreshButton from "@/components/RefreshButton";

type AccountDetailViewProps = {
  account: Mt5AccountSnapshot;
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

export default function AccountDetailView({ account }: AccountDetailViewProps) {
  const [activeSection, setActiveSection] = useState<{
    title: string;
    lines: Array<{ label: string; value: string }>;
  } | null>(null);

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-semibold text-[var(--foreground)]">
              {account.label}
            </h1>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${statusTone(
                account.status ?? "PAUSED",
              )}`}
            >
              {account.status ?? "UNKNOWN"}
            </span>
          </div>
          <p className="text-sm text-[color:var(--muted)]">
            {account.broker || "Unknown broker"} -{" "}
            {account.server || "Unknown server"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] px-4 py-3 text-sm text-[color:var(--muted)] shadow-sm">
            Last sync {formatDateTime(account.last_sync_utc ?? "")}
          </div>
          <RefreshButton />
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-4">
        {[
          { title: "Equity", value: formatCurrency(account.equity, account.currency) },
          { title: "Balance", value: formatCurrency(account.balance, account.currency) },
          { title: "Weekly PnL", value: formatPercent(account.weekly_pnl_pct) },
          { title: "Basket PnL", value: formatPercent(account.basket_pnl_pct) },
        ].map((item) => (
          <button
            key={item.title}
            type="button"
            onClick={() =>
              setActiveSection({ title: item.title, lines: [{ label: item.title, value: item.value }] })
            }
            className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4 text-left shadow-sm"
          >
            <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              {item.title}
            </p>
            <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">
              View
            </p>
          </button>
        ))}
      </section>

      <section className="grid gap-6 lg:grid-cols-3">
        <button
          type="button"
          onClick={() =>
            setActiveSection({
              title: "Basket status",
              lines: [
                { label: "State", value: account.basket_state },
                { label: "Report date", value: formatDate(account.report_date) },
                { label: "Open pairs", value: String(account.open_pairs) },
                { label: "Open positions", value: String(account.open_positions) },
                { label: "Total lots", value: account.total_lots.toFixed(2) },
                { label: "Locked profit", value: formatPercent(account.locked_profit_pct) },
              ],
            })
          }
          className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 text-left shadow-sm"
        >
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            Basket status
          </h2>
          <p className="text-sm text-[color:var(--muted)]">
            Tap to view basket details.
          </p>
        </button>

        <button
          type="button"
          onClick={() =>
            setActiveSection({
              title: "Operations",
              lines: [
                { label: "API status", value: account.api_ok ? "OK" : "Error" },
                { label: "Trading allowed", value: account.trading_allowed ? "Yes" : "No" },
                { label: "Next add", value: formatDuration(account.next_add_seconds) },
                { label: "Next poll", value: formatDuration(account.next_poll_seconds) },
                { label: "Last API error", value: account.last_api_error || "None" },
              ],
            })
          }
          className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 text-left shadow-sm"
        >
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Operations</h2>
          <p className="text-sm text-[color:var(--muted)]">
            Tap to view API and scheduling details.
          </p>
        </button>

        <button
          type="button"
          onClick={() =>
            setActiveSection({
              title: "Risk & margin",
              lines: [
                { label: "Risk used", value: formatPercent(account.risk_used_pct) },
                { label: "Max drawdown", value: formatPercent(account.max_drawdown_pct) },
                { label: "Baseline equity", value: formatCurrency(account.baseline_equity, account.currency) },
                { label: "Trades this week", value: String(account.trade_count_week) },
                { label: "Margin", value: formatCurrency(account.margin, account.currency) },
                { label: "Free margin", value: formatCurrency(account.free_margin, account.currency) },
                { label: "Win rate", value: formatPercent(account.win_rate_pct) },
              ],
            })
          }
          className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 text-left shadow-sm"
        >
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Risk & margin</h2>
          <p className="text-sm text-[color:var(--muted)]">
            Tap to view risk metrics.
          </p>
        </button>
      </section>

      <section className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            Open Positions
          </h2>
          <p className="text-sm text-[color:var(--muted)]">
            {account.open_positions} active position{account.open_positions !== 1 ? "s" : ""} across{" "}
            {account.open_pairs} pair{account.open_pairs !== 1 ? "s" : ""}
          </p>
        </div>
        <PositionsTable
          positions={account.positions || []}
          currency={account.currency}
          equity={account.equity}
        />
      </section>

      {activeSection ? (
        <InfoModal title={activeSection.title} onClose={() => setActiveSection(null)}>
          <div className="space-y-2">
            {activeSection.lines.map((line) => (
              <div key={line.label} className="flex items-center justify-between">
                <span>{line.label}</span>
                <span className="font-semibold text-[var(--foreground)]">
                  {line.value}
                </span>
              </div>
            ))}
          </div>
        </InfoModal>
      ) : null}
    </div>
  );
}
