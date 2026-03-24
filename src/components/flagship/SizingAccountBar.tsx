/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: SizingAccountBar.tsx
 *
 * Description:
 * Compact account switcher and inline settings surface for matrix sizing.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

"use client";

import { useEffect, useState } from "react";

import type { SizingAccount } from "@/lib/flagship/positionSizer";

type SizingAccountBarProps = {
  accounts: SizingAccount[];
  activeAccount: SizingAccount | null;
  onSelectAccount: (id: string) => void;
  onAddAccount: (name: string) => void;
  onUpdateAccount: (id: string, updates: Partial<SizingAccount>) => void;
  onDeleteAccount: (id: string) => void;
};

function formatBalance(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency || "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

function parseNumberInput(value: string, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export default function SizingAccountBar({
  accounts,
  activeAccount,
  onSelectAccount,
  onAddAccount,
  onUpdateAccount,
  onDeleteAccount,
}: SizingAccountBarProps) {
  const [showEditPanel, setShowEditPanel] = useState(false);
  const [showAddPanel, setShowAddPanel] = useState(false);
  const [newAccountName, setNewAccountName] = useState("");

  useEffect(() => {
    if (!activeAccount) {
      setShowEditPanel(false);
    }
  }, [activeAccount]);

  return (
    <div className="overflow-hidden rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/60">
      <div className="flex min-h-10 flex-wrap items-center gap-2 border-b border-[var(--panel-border)]/70 px-3 py-2">
        <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[color:var(--muted)]">
          Sizing Account
        </span>
        <select
          value={activeAccount?.id ?? ""}
          onChange={(event) => onSelectAccount(event.target.value)}
          className="min-w-[10rem] rounded-md border border-[var(--panel-border)] bg-[var(--panel)] px-2 py-1 text-xs text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
        >
          {accounts.length === 0 ? <option value="">No accounts</option> : null}
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>

        {activeAccount ? (
          <>
            <input
              type="text"
              value={activeAccount.name}
              onChange={(event) => onUpdateAccount(activeAccount.id, { name: event.target.value })}
              className="min-w-[8rem] rounded-md border border-[var(--panel-border)] bg-[var(--panel)] px-2 py-1 text-xs text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
              aria-label="Account name"
            />
            <label className="flex items-center gap-2 rounded-md border border-[var(--panel-border)] bg-[var(--panel)] px-2 py-1 text-xs text-[color:var(--muted)]">
              <span>Balance</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={activeAccount.balance}
                onChange={(event) =>
                  onUpdateAccount(activeAccount.id, {
                    balance: parseNumberInput(event.target.value, activeAccount.balance),
                  })
                }
                className="w-24 bg-transparent font-mono text-[var(--foreground)] outline-none"
                aria-label="Account balance"
              />
            </label>
            <span className="text-[11px] text-[color:var(--muted)]">
              {formatBalance(activeAccount.balance, activeAccount.currency)}
            </span>
            <span className="rounded-full border border-[var(--panel-border)] bg-[var(--panel)] px-2 py-1 text-[10px] uppercase tracking-[0.08em] text-[color:var(--muted)]">
              <span className="font-mono text-[var(--foreground)]">{activeAccount.riskPctPerTrade}%</span>/trade
            </span>
            <span className="rounded-full border border-[var(--panel-border)] bg-[var(--panel)] px-2 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-[color:var(--muted)]">
              1:{activeAccount.leverage}
            </span>
          </>
        ) : (
          <span className="text-xs text-[color:var(--muted)]">No active account selected.</span>
        )}

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setShowAddPanel((previous) => !previous);
              setShowEditPanel(false);
            }}
            className="rounded-md border border-[var(--panel-border)] bg-[var(--panel)] px-2 py-1 text-xs font-semibold text-[var(--foreground)] transition hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
          >
            +
          </button>
          {activeAccount ? (
            <button
              type="button"
              onClick={() => {
                setShowEditPanel((previous) => !previous);
                setShowAddPanel(false);
              }}
              className="rounded-md border border-[var(--panel-border)] bg-[var(--panel)] px-2 py-1 text-xs font-semibold text-[color:var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
            >
              Edit
            </button>
          ) : null}
        </div>
      </div>

      {showAddPanel ? (
        <div className="flex flex-wrap items-center gap-2 px-3 py-3 text-xs">
          <input
            type="text"
            value={newAccountName}
            onChange={(event) => setNewAccountName(event.target.value)}
            placeholder={`Account ${accounts.length + 1}`}
            className="min-w-[12rem] rounded-md border border-[var(--panel-border)] bg-[var(--panel)] px-2 py-1.5 text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
          />
          <button
            type="button"
            onClick={() => {
              onAddAccount(newAccountName);
              setNewAccountName("");
              setShowAddPanel(false);
            }}
            className="rounded-md border border-[var(--accent)] bg-[var(--accent)]/10 px-3 py-1.5 font-semibold text-[var(--accent-strong)] transition hover:bg-[var(--accent)]/20"
          >
            Add Account
          </button>
          <button
            type="button"
            onClick={() => {
              setNewAccountName("");
              setShowAddPanel(false);
            }}
            className="rounded-md border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-1.5 text-[color:var(--muted)] transition hover:text-[var(--foreground)]"
          >
            Cancel
          </button>
        </div>
      ) : null}

      {showEditPanel && activeAccount ? (
        <div className="grid gap-3 border-t border-[var(--panel-border)]/70 px-3 py-3 text-xs md:grid-cols-5">
          <label className="space-y-1">
            <span className="text-[10px] uppercase tracking-[0.12em] text-[color:var(--muted)]">Account name</span>
            <input
              type="text"
              value={activeAccount.name}
              onChange={(event) => onUpdateAccount(activeAccount.id, { name: event.target.value })}
              className="w-full rounded-md border border-[var(--panel-border)] bg-[var(--panel)] px-2 py-1.5 text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] uppercase tracking-[0.12em] text-[color:var(--muted)]">Balance</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={activeAccount.balance}
              onChange={(event) =>
                onUpdateAccount(activeAccount.id, {
                  balance: parseNumberInput(event.target.value, activeAccount.balance),
                })
              }
              className="w-full rounded-md border border-[var(--panel-border)] bg-[var(--panel)] px-2 py-1.5 font-mono text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] uppercase tracking-[0.12em] text-[color:var(--muted)]">Risk / trade %</span>
            <input
              type="number"
              min="0"
              step="0.1"
              value={activeAccount.riskPctPerTrade}
              onChange={(event) =>
                onUpdateAccount(activeAccount.id, {
                  riskPctPerTrade: parseNumberInput(event.target.value, activeAccount.riskPctPerTrade),
                })
              }
              className="w-full rounded-md border border-[var(--panel-border)] bg-[var(--panel)] px-2 py-1.5 font-mono text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] uppercase tracking-[0.12em] text-[color:var(--muted)]">Leverage</span>
            <input
              type="number"
              min="1"
              step="1"
              value={activeAccount.leverage}
              onChange={(event) =>
                onUpdateAccount(activeAccount.id, {
                  leverage: parseNumberInput(event.target.value, activeAccount.leverage),
                })
              }
              className="w-full rounded-md border border-[var(--panel-border)] bg-[var(--panel)] px-2 py-1.5 font-mono text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
            />
          </label>
          <label className="space-y-1">
            <span className="text-[10px] uppercase tracking-[0.12em] text-[color:var(--muted)]">Max heat %</span>
            <input
              type="number"
              min="0"
              step="0.1"
              value={activeAccount.maxPortfolioHeatPct}
              onChange={(event) =>
                onUpdateAccount(activeAccount.id, {
                  maxPortfolioHeatPct: parseNumberInput(event.target.value, activeAccount.maxPortfolioHeatPct),
                })
              }
              className="w-full rounded-md border border-[var(--panel-border)] bg-[var(--panel)] px-2 py-1.5 font-mono text-[var(--foreground)] outline-none transition focus:border-[var(--accent)]"
            />
          </label>
          <div className="flex justify-end md:col-span-5">
            <button
              type="button"
              onClick={() => {
                if (window.confirm(`Delete sizing account "${activeAccount.name}"?`)) {
                  onDeleteAccount(activeAccount.id);
                  setShowEditPanel(false);
                }
              }}
              className="rounded-md border border-rose-500/35 bg-rose-500/10 px-3 py-1.5 font-semibold text-rose-700 transition hover:bg-rose-500/20 dark:text-rose-300"
            >
              Delete Account
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
