import DashboardLayout from "@/components/DashboardLayout";

export default function AgentsPage() {
  return (
    <DashboardLayout>
      <div className="space-y-8">
        <header className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent-strong)]">
            Limni Labs
          </p>
          <h1 className="text-3xl font-semibold text-[var(--foreground)]">
            Agents
          </h1>
          <p className="max-w-3xl text-sm leading-6 text-[color:var(--muted)]">
            Agent architecture, operating rules, and future multi-agent research workflows will live here.
            v2 keeps this surface intentionally minimal while the canon and release-doc foundations land.
          </p>
        </header>

        <section className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
            Planned
          </p>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            {[
              ["Context Architecture", "Stable handoff contracts for Codex, Nyx, and future agents."],
              ["Agent Memory", "Versioned lessons and operating constraints tied to release history."],
              ["Automation Bridge", "Future bot and research-agent workflows after v2 is launched."],
            ].map(([title, body]) => (
              <article
                key={title}
                className="rounded-xl border border-[var(--panel-border)] bg-[var(--background)] p-4"
              >
                <h2 className="text-sm font-semibold text-[var(--foreground)]">{title}</h2>
                <p className="mt-2 text-sm leading-6 text-[color:var(--muted)]">{body}</p>
              </article>
            ))}
          </div>
        </section>
      </div>
    </DashboardLayout>
  );
}
