type DebugReadoutItem = {
  label: string;
  value: string;
};

type DebugReadoutProps = {
  title?: string;
  items: DebugReadoutItem[];
};

export default function DebugReadout({ title = "Debug", items }: DebugReadoutProps) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--panel-border)] bg-[var(--panel)]/60 p-3 text-xs text-[color:var(--muted)]">
      <div className="mb-2 text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
        {title}
      </div>
      <div className="grid gap-2 md:grid-cols-3">
        {items.map((item) => (
          <div key={item.label} className="flex items-center justify-between gap-2">
            <span className="uppercase tracking-[0.18em] text-[10px] text-[color:var(--muted)]">
              {item.label}
            </span>
            <span className="font-mono text-[11px] text-[var(--foreground)]">
              {item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
