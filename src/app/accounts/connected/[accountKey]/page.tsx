import DashboardLayout from "@/components/DashboardLayout";
import ConnectedAccountSizing from "@/components/ConnectedAccountSizing";
import PlannedTradesPanel from "@/components/PlannedTradesPanel";
import { readBotState } from "@/lib/botState";
import { getConnectedAccount, listConnectedAccounts } from "@/lib/connectedAccounts";
import { formatDateTimeET } from "@/lib/time";
import { buildBasketSignals } from "@/lib/basketSignals";
import { buildBitgetPlannedTrades, filterForBitget, filterForOanda, groupSignals } from "@/lib/plannedTrades";

export const dynamic = "force-dynamic";

export default async function ConnectedAccountPage({
  params,
}: {
  params: { accountKey: string } | Promise<{ accountKey: string }>;
}) {
  const resolvedParams = await Promise.resolve(params);
  const rawParam = resolvedParams?.accountKey ?? "";
  const decodeSafe = (value: string) => {
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  };
  const normalize = (value: string) => value.trim().toLowerCase();
  const decodedOnce = decodeSafe(rawParam);
  const decodedTwice = decodeSafe(decodedOnce);
  const candidates = Array.from(
    new Set(
      [
        rawParam,
        decodedOnce,
        decodedTwice,
        rawParam ? rawParam.replace(/%3A/gi, ":") : "",
        decodedOnce ? decodedOnce.replace(/%3A/gi, ":") : "",
      ].filter((value) => Boolean(value && value.trim())),
    ),
  );

  let account = null;
  for (const candidate of candidates) {
    account = await getConnectedAccount(candidate);
    if (account) {
      break;
    }
  }
  if (!account) {
    const all = await listConnectedAccounts();
    const normalizedCandidates = new Set(candidates.map(normalize));
    const idCandidates = new Set(
      candidates
        .flatMap((value) => {
          const decoded = decodeSafe(value);
          if (decoded.includes(":")) {
            const [, ...rest] = decoded.split(":");
            return [rest.join(":"), decoded];
          }
          return [decoded];
        })
        .map(normalize),
    );
    account =
      all.find((item) => normalizedCandidates.has(normalize(item.account_key))) ??
      all.find((item) => normalizedCandidates.has(normalize(`${item.provider}:${item.account_id ?? ""}`))) ??
      all.find((item) => idCandidates.has(normalize(item.account_id ?? ""))) ??
      null;
  }
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
  const fallbackMapped =
    account.provider === "bitget"
      ? [
          { symbol: "BTCUSD", instrument: "BTCUSDT", available: true },
          { symbol: "ETHUSD", instrument: "ETHUSDT", available: true },
        ]
      : [];
  const mappedRows = mapped.length > 0 ? mapped : fallbackMapped;

  const accountBalance =
    typeof analysis.nav === "number"
      ? (analysis.nav as number)
      : typeof analysis.balance === "number"
        ? (analysis.balance as number)
        : typeof analysis.equity === "number"
          ? (analysis.equity as number)
          : 0;

  const basketSignals = await buildBasketSignals();
  let plannedPairs = [];
  let plannedNote: string | null = null;
  if (account.provider === "bitget") {
    const filtered = filterForBitget(basketSignals.pairs);
    const planned = buildBitgetPlannedTrades(filtered);
    plannedPairs = planned.pairs;
    plannedNote = planned.note;
  } else if (account.provider === "oanda") {
    const filtered = filterForOanda(basketSignals.pairs);
    plannedPairs = groupSignals(filtered);
  }

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
              {mappedRows.length} tracked
            </span>
          </div>
          <div className="mt-4 grid gap-2 text-sm">
            {mappedRows.length === 0 ? (
              <p className="text-[color:var(--muted)]">
                No instrument mapping data available yet.
              </p>
            ) : (
              mappedRows.map((row) => (
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

        <PlannedTradesPanel
          title="Planned trades (this week)"
          weekOpenUtc={basketSignals.week_open_utc}
          currency={typeof analysis.currency === "string" ? (analysis.currency as string) : "USD"}
          accountBalance={accountBalance}
          pairs={plannedPairs}
          note={plannedNote}
        />

        {account.provider === "oanda" ? (
          <ConnectedAccountSizing accountKey={account.account_key} />
        ) : null}
      </div>
    </DashboardLayout>
  );
}
