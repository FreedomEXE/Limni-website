import { ReactNode } from "react";

type SummaryCardProps = {
  label: string;
  value: ReactNode;
  hint?: string;
  action?: ReactNode;
  onClick?: () => void;
  selected?: boolean;
};

export default function SummaryCard({
  label,
  value,
  hint,
  action,
  onClick,
  selected,
}: SummaryCardProps) {
  const interactive = typeof onClick === "function";
  const className = `rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4 text-left ${
    interactive
      ? "cursor-pointer transition hover:border-[var(--accent)] hover:bg-[var(--panel)] focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2"
      : ""
  } ${
    selected ? "border-[var(--accent)]/40 bg-[var(--accent)]/10" : ""
  }`;

  const content = (
    <>
      <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">{label}</p>
      <div className="mt-2 text-lg font-semibold text-[var(--foreground)]">{value}</div>
      {hint ? <p className="mt-1 text-xs text-[color:var(--muted)]">{hint}</p> : null}
      {action ? <div className="mt-3">{action}</div> : null}
    </>
  );

  if (interactive) {
    return (
      <button type="button" className={className} onClick={onClick}>
        {content}
      </button>
    );
  }

  return (
    <div className={className}>
      {content}
    </div>
  );
}
