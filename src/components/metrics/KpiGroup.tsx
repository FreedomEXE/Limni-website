import { ReactNode } from "react";

type KpiGroupProps = {
  title: string;
  description?: string;
  children: ReactNode;
};

export default function KpiGroup({ title, description, children }: KpiGroupProps) {
  return (
    <section className="space-y-3">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
          {title}
        </p>
        {description ? (
          <p className="mt-1 text-sm text-[color:var(--muted)]">{description}</p>
        ) : null}
      </div>
      <div className="grid gap-4 md:grid-cols-3">{children}</div>
    </section>
  );
}
