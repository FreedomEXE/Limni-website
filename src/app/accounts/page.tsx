import DashboardLayout from "@/components/DashboardLayout";
import AccountsDirectory from "@/components/AccountsDirectory";
import { formatCurrencySafe } from "@/lib/formatters";
import { readMt5Accounts } from "@/lib/mt5Store";
import { formatDateTimeET, latestIso } from "@/lib/time";

export const dynamic = "force-dynamic";

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
          <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
            Last refresh {latestSync ? formatDateTimeET(latestSync) : "No refresh yet"}
          </span>
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

        <AccountsDirectory accounts={accounts} />
      </div>
    </DashboardLayout>
  );
}
