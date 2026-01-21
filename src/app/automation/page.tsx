import DashboardLayout from "@/components/DashboardLayout";

export default function AutomationPage() {
  return (
    <DashboardLayout>
      <div className="space-y-8">
        <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-slate-900">Automation</h1>
            <p className="mt-2 text-sm text-slate-600">
              Bot downloads and quick-reference details for Limni automation.
            </p>
          </div>
          <span className="rounded-full border border-slate-200 bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
            Release roster
          </span>
        </header>

        <section className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border-2 border-emerald-200 bg-emerald-50/70 p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-start justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                MT5 Forex Basket EA
              </h2>
              <span className="rounded-full border border-emerald-200 bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-800">
                Available
              </span>
            </div>
            <p className="mt-2 text-sm text-[color:var(--muted)]">
              Production-ready EA with risk controls and weekly basket logic.
            </p>
            <div className="mt-4 grid gap-2 text-xs text-emerald-800">
              <span>Risk guardrails included</span>
              <span>Weekly basket rebalancing</span>
            </div>
          </div>

          <div className="rounded-2xl border-2 border-sky-200 bg-sky-50/70 p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-start justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                Crypto Perp Bot (Bitget)
              </h2>
              <span className="rounded-full border border-sky-200 bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-800">
                In build
              </span>
            </div>
            <p className="mt-2 text-sm text-[color:var(--muted)]">
              Bias + sentiment-driven perpetual futures automation.
            </p>
            <div className="mt-4 grid gap-2 text-xs text-sky-800">
              <span>Funding + OI aware</span>
              <span>Signal throttling</span>
            </div>
          </div>

          <div className="rounded-2xl border-2 border-amber-200 bg-amber-50/70 p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
            <div className="flex items-start justify-between">
              <h2 className="text-lg font-semibold text-slate-900">
                Solana Meme Bot
              </h2>
              <span className="rounded-full border border-amber-200 bg-amber-100 px-3 py-1 text-xs font-semibold text-amber-800">
                Later
              </span>
            </div>
            <p className="mt-2 text-sm text-[color:var(--muted)]">
              High-volatility meme strategy targeting Solana launches.
            </p>
            <div className="mt-4 grid gap-2 text-xs text-amber-800">
              <span>Launch sniper logic</span>
              <span>Liquidity gate</span>
            </div>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
