/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: AutomationBotProfile.tsx
 *
 * Description:
 * Shared whitepaper-style bot profile renderer for the Automation
 * section.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import type { AutomationBotEntry, AutomationBotStatus } from "@/lib/automation/botLibrary";

function statusTone(status: AutomationBotStatus) {
  if (status === "ready") {
    return "border-emerald-300/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200";
  }
  if (status === "paused") {
    return "border-amber-300/40 bg-amber-500/10 text-amber-800 dark:text-amber-200";
  }
  return "border-sky-300/40 bg-sky-500/10 text-sky-800 dark:text-sky-200";
}

function categoryLabel(category: AutomationBotEntry["category"]) {
  if (category === "swing") return "Swing";
  if (category === "intraday") return "Intraday";
  return "Experimental";
}

export default function AutomationBotProfile({ entry }: { entry: AutomationBotEntry }) {
  return (
    <div className="space-y-6">
      <header className="rounded-3xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${statusTone(entry.status)}`}>
            {entry.statusLabel}
          </span>
          <span className="rounded-full border border-[var(--panel-border)] bg-[var(--panel)]/70 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
            {categoryLabel(entry.category)}
          </span>
          {entry.surfaces.map((surface) => (
            <span
              key={surface}
              className="rounded-full border border-[var(--panel-border)] bg-[var(--panel)]/60 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]"
            >
              {surface}
            </span>
          ))}
        </div>
        <h1 className="mt-4 text-3xl font-semibold text-[var(--foreground)]">
          {entry.title}
        </h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-[color:var(--muted)]">
          {entry.summary}
        </p>
      </header>

      <section className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        <article className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
            Thesis
          </h2>
          <p className="mt-3 text-sm leading-6 text-[var(--foreground)]/90">
            {entry.thesis}
          </p>
        </article>
        <article className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
            Current Decision
          </h2>
          <p className="mt-3 text-sm leading-6 text-[var(--foreground)]/90">
            {entry.currentDecision}
          </p>
        </article>
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <article className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
            What Exists
          </h2>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--foreground)]/90">
            {entry.whatExists.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </article>
        <article className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
            Next Steps
          </h2>
          <ul className="mt-3 space-y-2 text-sm leading-6 text-[var(--foreground)]/90">
            {entry.nextSteps.map((item) => (
              <li key={item}>• {item}</li>
            ))}
          </ul>
        </article>
      </section>

      <section className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-5 shadow-sm">
        <h2 className="text-sm font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
          Source Material
        </h2>
        <p className="mt-2 text-sm text-[color:var(--muted)]">
          Internal reference files currently anchoring this bot profile.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          {entry.sourceDocs.map((doc) => (
            <span
              key={doc}
              className="rounded-full border border-[var(--panel-border)] bg-[var(--panel)]/60 px-3 py-1 text-xs font-medium text-[var(--foreground)]/80"
            >
              {doc}
            </span>
          ))}
        </div>
      </section>
    </div>
  );
}
