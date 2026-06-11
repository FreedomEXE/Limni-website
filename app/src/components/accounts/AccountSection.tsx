import { ReactNode } from "react";

type AccountSectionProps = {
  title: string;
  children: ReactNode;
  open?: boolean;
};

export default function AccountSection({ title, children, open = true }: AccountSectionProps) {
  return (
    <details
      className="group rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] shadow-sm"
      open={open}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between px-6 py-4">
        <span className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--foreground)]">
          {title}
        </span>
        <span className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)] group-open:hidden">
          Expand
        </span>
        <span className="hidden text-xs uppercase tracking-[0.2em] text-[color:var(--muted)] group-open:inline">
          Collapse
        </span>
      </summary>
      <section className="border-t border-[var(--panel-border)] px-6 py-6">{children}</section>
    </details>
  );
}
