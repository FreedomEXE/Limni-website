import DashboardLayout from "@/components/DashboardLayout";

export default function AutomationPage() {
  return (
    <DashboardLayout>
      <div className="space-y-8">
        <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-[var(--foreground)]">
              Automation
            </h1>
            <p className="mt-2 text-sm text-[color:var(--muted)]">
              Bot downloads and quick-reference details for Limni automation.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              Last refresh: Static content
            </span>
            <span className="rounded-full border border-[var(--panel-border)] bg-[var(--panel)]/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
              Release roster
            </span>
          </div>
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
              Production-ready EA with risk controls and weekly basket logic.
            </p>
            <div className="mt-4 grid gap-2 text-xs text-[var(--accent-strong)]">
              <span>Risk guardrails included</span>
              <span>Weekly basket rebalancing</span>
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

          <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-start justify-between">
              <h2 className="text-lg font-semibold text-[var(--foreground)]">
                Solana Meme Bot
              </h2>
              <span className="rounded-full border border-[var(--panel-border)] bg-[var(--panel)]/70 px-3 py-1 text-xs font-semibold text-[color:var(--muted)]">
                Later
              </span>
            </div>
            <p className="mt-2 text-sm text-[color:var(--muted)]">
              High-volatility meme strategy targeting Solana launches.
            </p>
            <div className="mt-4 grid gap-2 text-xs text-[var(--foreground)]/70">
              <span>Launch sniper logic</span>
              <span>Liquidity gate</span>
            </div>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
