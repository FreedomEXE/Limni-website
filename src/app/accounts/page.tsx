import DashboardLayout from "@/components/DashboardLayout";
import AccountsDirectory, { type AccountCard } from "@/components/AccountsDirectory";
import ConnectAccountButton from "@/components/ConnectAccountButton";
import { formatCurrencySafe } from "@/lib/formatters";
import { readBotState } from "@/lib/botState";
import { readMt5Accounts } from "@/lib/mt5Store";
import { listConnectedAccounts } from "@/lib/connectedAccounts";
import { formatDateTimeET, latestIso } from "@/lib/time";

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

  const mt5Cards: AccountCard[] = mt5Accounts.map((account) => ({
    account_id: account.account_id,
    label: account.label,
    broker: account.broker,
    server: account.server,
    status: account.status,
    currency: account.currency,
    equity: Number.isFinite(account.equity) ? account.equity : null,
    weekly_pnl_pct: Number.isFinite(account.weekly_pnl_pct) ? account.weekly_pnl_pct : null,
    basket_state: account.basket_state,
    open_positions: account.open_positions,
    open_pairs: account.open_pairs,
    win_rate_pct: Number.isFinite(account.win_rate_pct) ? account.win_rate_pct : null,
    max_drawdown_pct: Number.isFinite(account.max_drawdown_pct) ? account.max_drawdown_pct : null,
    source: "mt5",
    href: `/accounts/${account.account_id}`,
  }));

  const connectedCards: AccountCard[] = connectedAccounts.map((account) => {
    const botState =
      account.provider === "bitget"
        ? bitgetState
        : account.provider === "oanda"
          ? oandaState
          : null;
    const analysis = account.analysis as Record<string, unknown> | null;
    const analysisEquity =
      typeof analysis?.equity === "number"
        ? (analysis.equity as number)
        : typeof analysis?.nav === "number"
          ? (analysis.nav as number)
          : null;
    const openPositions =
      typeof analysis?.open_positions === "number"
        ? (analysis.open_positions as number)
        : Array.isArray(analysis?.positions)
          ? (analysis?.positions as unknown[]).filter(Boolean).length
          : 0;
    return {
      account_id: account.account_key,
      label: account.label ?? `${account.provider.toUpperCase()} account`,
      broker:
        account.provider === "bitget"
          ? "Bitget"
          : account.provider === "oanda"
            ? "OANDA FxTrade"
            : "MT5",
      server:
        (analysis?.productType as string) ??
        (analysis?.env as string) ??
        "Connected",
      status: account.status ?? (account.provider === "oanda" ? "LIVE" : "LIVE"),
      currency: (analysis?.currency as string) ?? "USD",
      equity:
        typeof botState?.state?.current_equity === "number"
          ? botState?.state?.current_equity
          : analysisEquity,
      weekly_pnl_pct: null,
      basket_state: botState?.state?.entered ? "ACTIVE" : "READY",
      open_positions: openPositions,
      open_pairs: typeof analysis?.mapped_count === "number" ? (analysis.mapped_count as number) : null,
      win_rate_pct: null,
      max_drawdown_pct: null,
      source: account.provider as AccountCard["source"],
      href: `/accounts/connected/${encodeURIComponent(account.account_key)}`,
    };
  });

  const accounts: AccountCard[] = [...mt5Cards, ...connectedCards];
  const totalEquity = accounts.reduce(
    (sum, account) => sum + (Number.isFinite(account.equity ?? NaN) ? (account.equity ?? 0) : 0),
    0,
  );
  const activeBaskets = accounts.filter(
    (account) => account.basket_state === "ACTIVE",
  ).length;
  const latestSync = latestIso([
    ...mt5Accounts.map((account) => account.last_sync_utc),
    bitgetState?.updated_at ?? null,
    oandaState?.updated_at ?? null,
    ...connectedAccounts.map((account) => account.last_sync_utc ?? null),
    ...connectedAccounts.map((account) => {
      const analysis = account.analysis as Record<string, unknown> | null;
      return typeof analysis?.fetched_at === "string" ? (analysis.fetched_at as string) : null;
    }),
  ]);

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
