/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: page.tsx
 *
 * Description:
 * Documentation-first automation bot library. Replaces the old live
 * status board with a cleaner inventory of what exists, what is paused,
 * and what remains in research.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import Link from "next/link";
import DashboardLayout from "@/components/DashboardLayout";
import AutomationBotsCards from "@/components/automation/AutomationBotsCards";
import { listAutomationBotEntries, type AutomationBotStatus } from "@/lib/automation/botLibrary";

export const dynamic = "force-dynamic";

function statusTone(status: AutomationBotStatus) {
  if (status === "ready") {
    return "border-emerald-300/40 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200";
  }
  if (status === "paused") {
    return "border-amber-300/40 bg-amber-500/10 text-amber-800 dark:text-amber-200";
  }
  return "border-sky-300/40 bg-sky-500/10 text-sky-800 dark:text-sky-200";
}

export default async function AutomationBotsPage() {
  const entries = listAutomationBotEntries();
  const readyCount = entries.filter((entry) => entry.status === "ready").length;
  const researchCount = entries.filter((entry) => entry.status === "research").length;
  const pausedCount = entries.filter((entry) => entry.status === "paused").length;

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <header className="space-y-2">
          <h1 className="text-3xl font-semibold text-[var(--foreground)]">
            Bots
          </h1>
          <p className="max-w-3xl text-sm leading-6 text-[color:var(--muted)]">
            Documentation-first library for the automation stack. This section now answers
            what exists, what is paused, and what is still in research instead of pretending
            every old dashboard is an active production bot.
          </p>
        </header>

        <AutomationBotsCards active="overview" />

        <section className="grid gap-4 md:grid-cols-3">
          <article className="rounded-2xl border border-emerald-300/40 bg-emerald-500/10 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700 dark:text-emerald-200">
              Ready
            </p>
            <p className="mt-3 text-3xl font-semibold text-[var(--foreground)]">{readyCount}</p>
            <p className="mt-2 text-sm text-[color:var(--muted)]">
              Built systems that should be framed as operator references rather than noisy live dashboards.
            </p>
          </article>
          <article className="rounded-2xl border border-sky-300/40 bg-sky-500/10 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-sky-700 dark:text-sky-200">
              Research
            </p>
            <p className="mt-3 text-3xl font-semibold text-[var(--foreground)]">{researchCount}</p>
            <p className="mt-2 text-sm text-[color:var(--muted)]">
              Systems and branches that still matter as research, but are not locked flagship paths.
            </p>
          </article>
          <article className="rounded-2xl border border-amber-300/40 bg-amber-500/10 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-amber-700 dark:text-amber-200">
              Paused
            </p>
            <p className="mt-3 text-3xl font-semibold text-[var(--foreground)]">{pausedCount}</p>
            <p className="mt-2 text-sm text-[color:var(--muted)]">
              Older automation paths that should stay documented without being treated as active production direction.
            </p>
          </article>
        </section>

        <section className="grid gap-4 xl:grid-cols-2">
          {entries.map((entry) => (
            <Link
              key={entry.id}
              href={entry.route}
              className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-semibold text-[var(--foreground)]">
                    {entry.title}
                  </h2>
                  <p className="mt-2 text-sm text-[color:var(--muted)]">
                    {entry.summary}
                  </p>
                </div>
                <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] ${statusTone(entry.status)}`}>
                  {entry.statusLabel}
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {entry.surfaces.map((surface) => (
                  <span
                    key={surface}
                    className="rounded-full border border-[var(--panel-border)] bg-[var(--panel)]/70 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]"
                  >
                    {surface}
                  </span>
                ))}
              </div>
            </Link>
          ))}
        </section>
      </div>
    </DashboardLayout>
  );
}
