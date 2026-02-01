import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";

export default function AutomationPage() {
  return (
    <DashboardLayout>
      <div className="space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold text-[var(--foreground)]">
            Automation
          </h1>
        </header>

        <section className="grid gap-4 md:grid-cols-2">
          <Link
            href="/automation/bots"
            className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-[var(--foreground)]">
                Bots
              </h2>
              <span className="rounded-full border border-[var(--panel-border)] bg-[var(--panel)]/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
                View
              </span>
            </div>
            <p className="mt-3 text-sm text-[color:var(--muted)]">
              Live automation projects, deployments, and quick status.
            </p>
          </Link>

          <Link
            href="/automation/research"
            className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-semibold text-[var(--foreground)]">
                Research
              </h2>
              <span className="rounded-full border border-[var(--panel-border)] bg-[var(--panel)]/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
                View
              </span>
            </div>
            <p className="mt-3 text-sm text-[color:var(--muted)]">
              Backtests, calendars, and model diagnostics in one place.
            </p>
          </Link>
        </section>
      </div>
    </DashboardLayout>
  );
}
