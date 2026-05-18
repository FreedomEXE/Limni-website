"use client";

import { useEffect } from "react";
import AccountsDirectory from "@/components/AccountsDirectory";
import ConnectAccountButton from "@/components/ConnectAccountButton";
import { formatCurrencySafe } from "@/lib/formatters";
import { formatDateTimeET } from "@/lib/time";
import type { AccountsPayload } from "@/lib/accounts/accountsPayload";
import {
  seedAccountsPayload,
  useAccountsSession,
} from "@/lib/accounts/accountsSessionStore";

type AccountsPageClientProps = {
  initialPayload: AccountsPayload;
};

export default function AccountsPageClient({ initialPayload }: AccountsPageClientProps) {
  const store = useAccountsSession();
  const payload = store.payload ?? initialPayload;
  const errorMessage = payload.loadError || store.error;

  useEffect(() => {
    seedAccountsPayload(initialPayload);
  }, [initialPayload]);

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold text-[var(--foreground)]">
            Account Reporting
          </h1>
          <p className="text-sm text-[color:var(--muted)]">
            Review linked accounts, open trades, history, and sync state
            across prop funds and personal capital.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <ConnectAccountButton />
          <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
            Last refresh {payload.latestSync ? formatDateTimeET(payload.latestSync) : "No refresh yet"}
          </span>
        </div>
      </header>

      {errorMessage ? (
        <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] px-5 py-4 text-sm text-[color:var(--muted)] shadow-sm">
          Some account data is temporarily unavailable. The page will use the account data that loaded successfully.
        </div>
      ) : null}

      <section className="grid gap-4 md:grid-cols-5">
        <Metric label="Accounts tracked" value={String(payload.accounts.length)} />
        <Metric label="Total equity" value={formatCurrencySafe(payload.overview.totalEquity, "USD")} />
        <Metric label="Prop funds" value={String(payload.overview.propAccounts)} />
        <Metric label="Personal accounts" value={String(payload.overview.personalAccounts)} />
        <Metric label="Open positions" value={String(payload.overview.openPositions)} />
      </section>

      <AccountsDirectory accounts={payload.accounts} />
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4 shadow-sm">
      <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
        {label}
      </p>
      <p className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
        {value}
      </p>
    </div>
  );
}
