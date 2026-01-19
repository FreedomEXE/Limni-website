import DashboardLayout from "@/components/DashboardLayout";

export default function AutomationPage() {
  return (
    <DashboardLayout>
      <div className="space-y-8">
        <header>
          <h1 className="text-3xl font-semibold text-slate-900">Automation</h1>
          <p className="mt-2 text-sm text-slate-600">
            Bot downloads and quick-reference details for Limni automation.
          </p>
        </header>

        <section className="grid gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              MT5 Forex Basket EA
            </h2>
            <p className="mt-2 text-sm text-[color:var(--muted)]">
              Production-ready EA with risk controls and weekly basket logic.
            </p>
            <div className="mt-4 text-xs uppercase tracking-[0.2em] text-slate-500">
              Status: Available
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              Crypto Perp Bot (Bitget)
            </h2>
            <p className="mt-2 text-sm text-[color:var(--muted)]">
              Bias + sentiment-driven perpetual futures automation (in build).
            </p>
            <div className="mt-4 text-xs uppercase tracking-[0.2em] text-slate-500">
              Status: Planned
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900">
              Solana Meme Bot
            </h2>
            <p className="mt-2 text-sm text-[color:var(--muted)]">
              High-volatility meme strategy targeting Solana launches.
            </p>
            <div className="mt-4 text-xs uppercase tracking-[0.2em] text-slate-500">
              Status: Later
            </div>
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
