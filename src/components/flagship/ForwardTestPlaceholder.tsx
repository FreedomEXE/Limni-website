/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: ForwardTestPlaceholder.tsx
 *
 * Description:
 * Shared placeholder layout for the new forward-test flagship pages.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

type ForwardTestPlaceholderProps = {
  title: string;
  subtitle: string;
  strategyName: string;
  sourceLabel: string;
  summaryMetrics: Array<{ label: string; value: string }>;
  columns: string[];
  emptyTitle: string;
  emptyBody: string;
};

export default function ForwardTestPlaceholder({
  title,
  subtitle,
  strategyName,
  sourceLabel,
  summaryMetrics,
  columns,
  emptyTitle,
  emptyBody,
}: ForwardTestPlaceholderProps) {
  return (
    <div className="space-y-6">
      <header className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/80 p-5">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-[var(--accent-strong)]">
              {subtitle}
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-[var(--foreground)]">
              {title}
            </h1>
            <p className="mt-2 text-sm leading-6 text-[var(--foreground)]/88">
              {strategyName}
            </p>
            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">
              {sourceLabel}
            </p>
          </div>
          <div className="rounded-full border border-amber-400/30 bg-amber-500/10 px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-amber-300">
            Forward test only
          </div>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        {summaryMetrics.map((metric) => (
          <div
            key={metric.label}
            className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/80 p-4"
          >
            <div className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
              {metric.label}
            </div>
            <div className="mt-2 text-2xl font-semibold font-mono text-[var(--foreground)]">
              {metric.value}
            </div>
          </div>
        ))}
      </section>

      <section className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/80 p-5">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-[10px] uppercase tracking-[0.18em] text-[color:var(--muted)]">
              <tr>
                {columns.map((column) => (
                  <th key={column} className="border-b border-[var(--panel-border)]/30 px-3 py-2">
                    {column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr>
                <td
                  colSpan={columns.length}
                  className="px-3 py-10 text-center"
                >
                  <div className="text-sm font-semibold text-[var(--foreground)]">
                    {emptyTitle}
                  </div>
                  <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-[color:var(--muted)]">
                    {emptyBody}
                  </p>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

