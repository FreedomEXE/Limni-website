import { ReactNode } from "react";

type KpiGroupProps = {
  title: string;
  description?: string;
  children: ReactNode;
  columns?: number;
};

export default function KpiGroup({ title, description, children, columns = 3 }: KpiGroupProps) {
  const gridCols =
    columns === 4 ? "md:grid-cols-4" : columns === 2 ? "md:grid-cols-2" : "md:grid-cols-3";
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
      <div className={`grid gap-4 ${gridCols}`}>{children}</div>
    </section>
  );
}
