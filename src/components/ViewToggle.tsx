type ViewToggleItem = {
  value: "heatmap" | "list";
  label: string;
  href: string;
};

type ViewToggleProps = {
  value: "heatmap" | "list";
  items: ViewToggleItem[];
};

export default function ViewToggle({ value, items }: ViewToggleProps) {
  return (
    <div className="inline-flex rounded-full border border-[var(--panel-border)] bg-[var(--panel)]/70 p-1 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
      {items.map((option) => (
        <a
          key={option.value}
          href={option.href}
          className={`rounded-full px-3 py-1 transition ${
            value === option.value
              ? "bg-[var(--foreground)] text-[var(--background)]"
              : "text-[color:var(--muted)] hover:text-[var(--accent-strong)]"
          }`}
        >
          {option.label}
        </a>
      ))}
    </div>
  );
}
