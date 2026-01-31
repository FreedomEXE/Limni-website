"use client";

type ViewToggleProps = {
  value: "heatmap" | "list";
  onChange: (value: "heatmap" | "list") => void;
};

export default function ViewToggle({ value, onChange }: ViewToggleProps) {
  return (
    <div className="inline-flex rounded-full border border-[var(--panel-border)] bg-[var(--panel)]/70 p-1 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
      {(["heatmap", "list"] as const).map((option) => (
        <button
          key={option}
          type="button"
          onClick={() => onChange(option)}
          className={`rounded-full px-3 py-1 transition ${
            value === option
              ? "bg-[var(--foreground)] text-[var(--background)]"
              : "text-[color:var(--muted)] hover:text-[var(--accent-strong)]"
          }`}
        >
          {option}
        </button>
      ))}
    </div>
  );
}
