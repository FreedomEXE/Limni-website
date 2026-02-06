import DashboardLayout from "@/components/DashboardLayout";
import ConnectedAccountSizing from "@/components/ConnectedAccountSizing";
import { readBotState } from "@/lib/botState";
import { getConnectedAccount } from "@/lib/connectedAccounts";
import { formatDateTimeET } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function ConnectedAccountPage({
  params,
}: {
  params: { accountKey: string };
}) {
  const accountKey = decodeURIComponent(params.accountKey);
  const account = await getConnectedAccount(accountKey);
  const botState =
    account?.provider === "oanda"
      ? await readBotState("oanda_universal_bot")
      : account?.provider === "bitget"
        ? await readBotState("bitget_perp_bot")
        : null;
  const readiness =
    (botState as { state?: { entered?: boolean } } | null)?.state?.entered === true
      ? "ON"
      : (botState as { state?: unknown } | null)?.state
        ? "READY"
        : "OFF";

  if (!account) {
    return (
      <DashboardLayout>
        <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6">
          <h1 className="text-2xl font-semibold text-[var(--foreground)]">
            Account not found
          </h1>
          <p className="mt-2 text-sm text-[color:var(--muted)]">
            This connected account is no longer available.
          </p>
        </div>
      </DashboardLayout>
    );
  }

  const analysis = (account.analysis ?? {}) as Record<string, unknown>;
  const mapped = Array.isArray(analysis.mapped) ? (analysis.mapped as Array<{ symbol: string; instrument: string; available: boolean }>) : [];

  return (
    <DashboardLayout>
      <div className="space-y-6">
        <header className="space-y-2">
          <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
            Connected Account
          </p>
          <h1 className="text-3xl font-semibold text-[var(--foreground)]">
            {account.label ?? account.account_key}
          </h1>
          <p className="text-sm text-[color:var(--muted)]">
            Provider: {account.provider.toUpperCase()} · Status: {account.status ?? "READY"}
          </p>
        </header>

        <section className="grid gap-4 md:grid-cols-4">
          <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              Bot Type
            </p>
            <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">
              {account.bot_type}
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              Bot Readiness
            </p>
            <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">
              {readiness}
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              Risk Mode
            </p>
            <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">
              {account.risk_mode ?? "1:1"}
            </p>
          </div>
          <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4">
            <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              Last Sync
            </p>
            <p className="mt-2 text-lg font-semibold text-[var(--foreground)]">
              {account.last_sync_utc ? formatDateTimeET(account.last_sync_utc) : "—"}
            </p>
          </div>
        </section>

        <section className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-[var(--foreground)]">
              Instrument Mapping
            </h2>
            <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              {mapped.length} tracked
            </span>
          </div>
          <div className="mt-4 grid gap-2 text-sm">
            {mapped.length === 0 ? (
              <p className="text-[color:var(--muted)]">
                No instrument mapping data available yet.
              </p>
            ) : (
              mapped.map((row) => (
                <div
                  key={row.symbol}
                  className="flex items-center justify-between rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/70 px-3 py-2"
                >
                  <span className="font-semibold text-[var(--foreground)]">{row.symbol}</span>
                  <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    {row.instrument}
                  </span>
                  <span className={`text-xs font-semibold ${row.available ? "text-emerald-700" : "text-rose-700"}`}>
                    {row.available ? "Available" : "Missing"}
                  </span>
                </div>
              ))
            )}
          </div>
        </section>

        {account.provider === "oanda" ? (
          <ConnectedAccountSizing accountKey={account.account_key} />
        ) : null}
      </div>
    </DashboardLayout>
  );
}
