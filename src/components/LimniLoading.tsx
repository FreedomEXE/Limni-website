import Image from "next/image";

export default function LimniLoading({
  label = "Loading...",
  compact = false,
}: {
  label?: string;
  compact?: boolean;
}) {
  const sizeClass = compact ? "h-20 w-20" : "h-28 w-28";
  const iconSize = compact ? 50 : 68;

  return (
    <div className="flex min-h-[240px] w-full items-center justify-center py-8">
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
              className="select-none"
              style={{ animation: "spin 2.2s linear infinite" }}
              priority
            />
          </div>
        </div>
        <p className="text-xs uppercase tracking-[0.25em] text-[color:var(--muted)]">
          {label}
        </p>
      </div>
    </div>
  );
}
