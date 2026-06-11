type KpiCardProps = {
  label: string;
  value: string;
  hint?: string;
  tone?: "positive" | "negative" | "neutral" | "accent";
  emphasis?: "primary" | "secondary";
};

export default function KpiCard({
  label,
  value,
  hint,
  tone = "neutral",
  emphasis = "secondary",
}: KpiCardProps) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-700"
      : tone === "negative"
        ? "text-rose-700"
        : tone === "accent"
          ? "text-[var(--accent-strong)]"
          : "text-[var(--foreground)]";
  const valueSize = emphasis === "primary" ? "text-3xl" : "text-2xl";

  return (
    <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4">
      <p className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
        {label}
      </p>
      <p className={`mt-2 font-semibold ${valueSize} ${toneClass}`}>{value}</p>
      {hint ? (
        <p className="mt-1 text-xs text-[color:var(--muted)]">{hint}</p>
      ) : null}
    </div>
  );
}
