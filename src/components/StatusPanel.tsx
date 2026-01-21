import type { StatusIssue } from "@/lib/diagnostics";

type StatusPanelProps = {
  issues: StatusIssue[];
};

const toneStyles = {
  error: "border-rose-200 bg-rose-50/80 text-rose-800",
  warning: "border-amber-200 bg-amber-50/80 text-amber-800",
};

export default function StatusPanel({ issues }: StatusPanelProps) {
  if (!issues.length) {
    return null;
  }

  return (
    <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-5 shadow-sm backdrop-blur-sm">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
            System status
          </p>
          <p className="mt-1 text-lg font-semibold text-[var(--foreground)]">
            Action needed
          </p>
        </div>
        <span className="rounded-full border border-[var(--accent)] bg-emerald-50 px-3 py-1 text-xs font-semibold text-[var(--accent-strong)]">
          {issues.length} alert{issues.length === 1 ? "" : "s"}
        </span>
      </div>

      <div className="mt-4 space-y-3">
        {issues.map((issue, index) => (
          <div
            key={`${issue.title}-${index}`}
            className={`rounded-xl border px-4 py-3 text-sm ${toneStyles[issue.severity]}`}
          >
            <p className="font-semibold">{issue.title}</p>
            {issue.details && <p className="mt-1 text-xs">{issue.details}</p>}
            {issue.hint && (
              <p className="mt-2 text-xs font-semibold text-[var(--foreground)]">
                Fix: {issue.hint}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
