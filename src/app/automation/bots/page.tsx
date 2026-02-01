import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";

export default function AutomationBotsPage() {
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
              <span className="rounded-full border border-[var(--accent)]/30 bg-[var(--accent)]/10 px-3 py-1 text-xs font-semibold text-[var(--accent-strong)]">
                Available
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

          <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-start justify-between">
              <h2 className="text-lg font-semibold text-[var(--foreground)]">
                Crypto Perp Bot (Bitget)
              </h2>
              <span className="rounded-full border border-[var(--panel-border)] bg-[var(--panel)]/70 px-3 py-1 text-xs font-semibold text-[color:var(--muted)]">
                In build
              </span>
            </div>
            <p className="mt-2 text-sm text-[color:var(--muted)]">
              Bias + sentiment-driven perpetual futures automation.
            </p>
            <div className="mt-4 grid gap-2 text-xs text-[var(--foreground)]/70">
              <span>Funding + OI aware</span>
              <span>Signal throttling</span>
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
