import { ReactNode } from "react";

type SummaryCardProps = {
  label: string;
  value: ReactNode;
  hint?: string;
  action?: ReactNode;
};

export default function SummaryCard({ label, value, hint, action }: SummaryCardProps) {
  return (
    <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4">
      <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">{label}</p>
      <div className="mt-2 text-lg font-semibold text-[var(--foreground)]">{value}</div>
      {hint ? <p className="mt-1 text-xs text-[color:var(--muted)]">{hint}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </div>
  );
}
