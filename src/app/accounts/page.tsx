import DashboardLayout from "@/components/DashboardLayout";
import AccountsDirectory from "@/components/AccountsDirectory";
import ConnectAccountButton from "@/components/ConnectAccountButton";
import { formatCurrencySafe } from "@/lib/formatters";
import { readBotState } from "@/lib/botState";
import { readMt5Accounts } from "@/lib/mt5Store";
import { listConnectedAccounts } from "@/lib/connectedAccounts";
import { formatDateTimeET } from "@/lib/time";
import type { AccountCard } from "@/lib/accounts/accountsDirectoryTypes";
import {
  buildConnectedAccountCards,
  buildMt5AccountCards,
  computeAccountsOverview,
} from "@/lib/accounts/accountsDirectoryData";
import { collectAccountsLatestSyncIso } from "@/lib/accounts/accountsPageData";

export const dynamic = "force-dynamic";

type BitgetBotState = {
  entered?: boolean;
  entry_equity?: number | null;
  current_equity?: number | null;
};

type OandaBotState = {
  entered?: boolean;
  entry_equity?: number | null;
  current_equity?: number | null;
};

export default async function AccountsPage() {
  let mt5Accounts: Awaited<ReturnType<typeof readMt5Accounts>> = [];
  try {
    mt5Accounts = await readMt5Accounts();
  } catch (error) {
    console.error(
      "Accounts load failed:",
      error instanceof Error ? error.message : String(error),
    );
  }

  const [bitgetState, oandaState] = await Promise.all([
    readBotState<BitgetBotState>("bitget_perp_bot"),
    readBotState<OandaBotState>("oanda_universal_bot"),
  ]);

  let connectedAccounts: Awaited<ReturnType<typeof listConnectedAccounts>> = [];
  try {
    connectedAccounts = await listConnectedAccounts();
  } catch (error) {
    console.error(
      "Connected accounts load failed:",
      error instanceof Error ? error.message : String(error),
    );
  }

  const mt5Cards: AccountCard[] = buildMt5AccountCards(mt5Accounts);
  const connectedCards: AccountCard[] = buildConnectedAccountCards(connectedAccounts, {
    bitgetState,
    oandaState,
  });

  const accounts: AccountCard[] = [...mt5Cards, ...connectedCards];
  const { totalEquity, activeBaskets } = computeAccountsOverview(accounts);
  const latestSync = collectAccountsLatestSyncIso({
    mt5Accounts,
    connectedAccounts,
    bitgetUpdatedAt: bitgetState?.updated_at ?? null,
    oandaUpdatedAt: oandaState?.updated_at ?? null,
  });

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
              linked account and automation bot.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <ConnectAccountButton />
            <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              Last refresh {latestSync ? formatDateTimeET(latestSync) : "No refresh yet"}
            </span>
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

        <AccountsDirectory accounts={accounts} />
      </div>
    </DashboardLayout>
  );
}
