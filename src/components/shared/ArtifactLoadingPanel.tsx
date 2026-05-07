type ArtifactLoadingPanelProps = {
  title?: string;
  phases: string[];
  compact?: boolean;
};

export default function ArtifactLoadingPanel({
  title = "Loading artifacts",
  phases,
  compact = false,
}: ArtifactLoadingPanelProps) {
  const visiblePhases = phases.length > 0
    ? phases
    : ["Checking cache", "Loading data", "Preparing view"];

  return (
    <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/75 px-4 py-4 text-sm text-[color:var(--muted)] shadow-sm">
      <div className="flex items-start gap-3">
        <div className="relative mt-0.5 h-5 w-5 shrink-0">
          <div
            className="absolute inset-0 rounded-full border-2 border-[var(--panel-border)] border-t-[var(--accent)] animate-spin"
            aria-hidden
          />
          <div className="absolute inset-1.5 rounded-full bg-[var(--accent)]/70" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--foreground)]">
            {title}
          </p>
          <div className={compact ? "mt-2 flex flex-wrap gap-2" : "mt-3 grid gap-2 sm:grid-cols-3"}>
            {visiblePhases.map((phase, index) => (
              <div
                key={`${phase}-${index}`}
                className="rounded-lg border border-[var(--panel-border)] bg-[var(--background)]/35 px-3 py-2 text-xs"
              >
                <span className="mr-2 inline-flex h-1.5 w-1.5 rounded-full bg-[var(--accent)] shadow-[0_0_12px_rgba(16,185,129,0.5)]" />
                {phase}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
