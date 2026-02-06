import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";
import { readBotState } from "@/lib/botState";
import { readMt5Accounts } from "@/lib/mt5Store";

export const dynamic = "force-dynamic";

type BotStatus = "ON" | "OFF" | "WAITING" | "READY";

type BotBadge = {
  label: BotStatus;
  tone: string;
};

function statusBadge(status: BotStatus): BotBadge {
  switch (status) {
    case "ON":
      return {
        label: "ON",
        tone: "border-emerald-200 bg-emerald-50 text-emerald-800",
      };
    case "READY":
      return {
        label: "READY",
        tone: "border-sky-200 bg-sky-50 text-sky-800",
      };
    case "WAITING":
      return {
        label: "WAITING",
        tone: "border-amber-200 bg-amber-50 text-amber-800",
      };
    default:
      return {
        label: "OFF",
        tone: "border-[var(--panel-border)] bg-[var(--panel)]/70 text-[color:var(--muted)]",
      };
  }
}

function isFresh(iso: string | null | undefined, minutes = 10) {
  if (!iso) return false;
  const ts = Date.parse(iso);
  if (!Number.isFinite(ts)) return false;
  return Date.now() - ts <= minutes * 60 * 1000;
}

export default async function AutomationBotsPage() {
  const [mt5Accounts, bitgetState, oandaState] = await Promise.all([
    readMt5Accounts().catch(() => []),
    readBotState("bitget_perp_bot"),
    readBotState("oanda_universal_bot"),
  ]);

  const mt5Fresh = mt5Accounts.some((account) => isFresh(account.last_sync_utc, 15));
  const mt5Status: BotStatus = mt5Accounts.length === 0 ? "OFF" : mt5Fresh ? "ON" : "OFF";
  const bitgetStatus: BotStatus = !bitgetState
    ? "OFF"
    : bitgetState.state?.entered
      ? "ON"
      : "WAITING";
  const oandaStatus: BotStatus = !oandaState
    ? "OFF"
    : oandaState.state?.entered
      ? "ON"
      : "READY";

  const mt5Badge = statusBadge(mt5Status);
  const bitgetBadge = statusBadge(bitgetStatus);
  const oandaBadge = statusBadge(oandaStatus);

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold text-[var(--foreground)]">
            Bots
          </h1>
        </header>

        <section className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-[var(--accent)]/30 bg-[var(--panel)] p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-start justify-between">
              <h2 className="text-lg font-semibold text-[var(--foreground)]">
                MT5 Forex Basket EA
              </h2>
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${mt5Badge.tone}`}>
                {mt5Badge.label}
              </span>
            </div>
            <p className="mt-2 text-sm text-[color:var(--muted)]">
              Production-ready EA with weekly basket logic.
            </p>
            <div className="mt-4 grid gap-2 text-xs text-[var(--accent-strong)]">
              <span>ATR-weighted sizing</span>
              <span>Global equity trail</span>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--accent)]/30 bg-[var(--panel)] p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-start justify-between">
              <h2 className="text-lg font-semibold text-[var(--foreground)]">
                Crypto Perp Bot (Bitget)
              </h2>
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${bitgetBadge.tone}`}>
                {bitgetBadge.label}
              </span>
            </div>
            <p className="mt-2 text-sm text-[color:var(--muted)]">
              BTC/ETH perp automation with unified signal alignment.
            </p>
            <div className="mt-4 grid gap-2 text-xs text-[var(--accent-strong)]">
              <span>10x leverage, unlevered trail</span>
              <span>All-model alignment filter</span>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--accent)]/30 bg-[var(--panel)] p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-start justify-between">
              <h2 className="text-lg font-semibold text-[var(--foreground)]">
                OANDA Universal Bot
              </h2>
              <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${oandaBadge.tone}`}>
                {oandaBadge.label}
              </span>
            </div>
            <p className="mt-2 text-sm text-[color:var(--muted)]">
              Full 36-pair basket automation with 1:1 sizing.
            </p>
            <div className="mt-4 grid gap-2 text-xs text-[var(--accent-strong)]">
              <span>Global equity trail</span>
              <span>Margin-aware scaling</span>
            </div>
          </div>

          <Link
            href="/automation/solana-meme-bot"
            className="rounded-2xl border border-[var(--accent)]/40 bg-[var(--panel)] p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex items-start justify-between">
              <h2 className="text-lg font-semibold text-[var(--foreground)]">
                Solana Meme Bot
              </h2>
              <span className="rounded-full border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 py-1 text-xs font-semibold text-[var(--accent-strong)]">
                Tracking
              </span>
            </div>
            <p className="mt-2 text-sm text-[color:var(--muted)]">
              High-volatility meme strategy targeting Solana launches.
            </p>
            <div className="mt-4 grid gap-2 text-xs text-[var(--foreground)]/70">
              <span>Recoup + moonbag logic</span>
              <span>Live signal stream</span>
            </div>
          </Link>
        </section>
      </div>
    </DashboardLayout>
  );
}
