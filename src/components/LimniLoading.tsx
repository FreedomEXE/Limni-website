import Image from "next/image";

export default function LimniLoading({
  label = "Loading...",
  compact = false,
  phases = [],
}: {
  label?: string;
  compact?: boolean;
  phases?: string[];
}) {
  const sizeClass = compact ? "h-20 w-20" : "h-28 w-28";
  const iconSize = compact ? 50 : 68;

  return (
    <div className="flex min-h-screen w-full items-center justify-center bg-[var(--background)] px-6 py-10">
      <div className="flex flex-col items-center gap-4">
        <div className={`relative ${sizeClass}`}>
          <div
            className="absolute inset-0 rounded-full border-2 border-[var(--panel-border)] border-t-[var(--accent)] shadow-[0_0_28px_rgba(16,185,129,0.24)] animate-spin"
            aria-hidden
          />
          <div
            className="absolute inset-2 rounded-full border border-[var(--panel-border)] border-b-[var(--accent)]"
            style={{ animation: "spin 1.8s linear infinite reverse" }}
            aria-hidden
          />
          <div className="absolute inset-4 flex items-center justify-center rounded-full bg-[var(--panel)]/95">
            <Image
              src="/limni-icon.svg"
              alt="Limni loading"
              width={iconSize}
              height={iconSize}
              className="select-none logo-theme-aware"
              style={{ animation: "spin 2.2s linear infinite" }}
              priority
            />
          </div>
        </div>
        <p className="text-xs uppercase tracking-[0.25em] text-[color:var(--muted)]">
          {label}
        </p>
        {phases.length > 0 ? (
          <div className="grid max-w-xl gap-2 text-center sm:grid-cols-3">
            {phases.map((phase, index) => (
              <div
                key={`${phase}-${index}`}
                className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/60 px-3 py-2 text-[11px] uppercase tracking-[0.12em] text-[color:var(--muted)]"
              >
                {phase}
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
