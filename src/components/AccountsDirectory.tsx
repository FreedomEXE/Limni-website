"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { deleteAccount, deleteConnectedAccount } from "@/app/actions/deleteAccount";
import type { AccountCard } from "@/lib/accounts/accountsDirectoryTypes";
import AccountsDirectoryCard from "@/components/accounts/AccountsDirectoryCard";

type AccountsDirectoryProps = {
  accounts: AccountCard[];
};

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
        <AccountsDirectoryCard
          key={account.account_id}
          account={account}
          deleting={deletingId === account.account_id}
          weekParam={weekParam}
          viewParam={viewParam}
          onDelete={(row) => handleDelete(row.account_id, row.label, row.source)}
        />
      ))}
    </div>
  );
}
