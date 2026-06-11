import Link from "next/link";

export type TabItem = {
  id: string;
  label: string;
};

type TabbedSectionProps = {
  tabs: TabItem[];
  active: string;
  baseHref: string;
  query: Record<string, string | undefined>;
};

function buildHref(baseHref: string, query: Record<string, string | undefined>) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value) {
      params.set(key, value);
    }
  });
  const qs = params.toString();
  return qs ? `${baseHref}?${qs}` : baseHref;
}

export default function TabbedSection({ tabs, active, baseHref, query }: TabbedSectionProps) {
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map((tab) => {
        const href = buildHref(baseHref, { ...query, tab: tab.id });
        const isActive = active === tab.id;
        return (
          <Link
            key={tab.id}
            href={href}
            className={`rounded-full border px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] transition ${
              isActive
                ? "border-[var(--accent)]/50 bg-[var(--accent)]/10 text-[var(--accent-strong)]"
                : "border-[var(--panel-border)] bg-[var(--panel)]/70 text-[var(--foreground)]/70 hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </div>
  );
}
