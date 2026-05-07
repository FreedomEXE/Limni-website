import LoadingStatusText from "@/components/shared/LoadingStatusText";

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
      <div className="flex items-center gap-3">
        <div className="relative mt-0.5 h-5 w-5 shrink-0">
          <div
            className="absolute inset-0 rounded-full border-2 border-[var(--panel-border)] border-t-[var(--accent)] animate-spin"
            aria-hidden
          />
          <div className="absolute inset-1.5 rounded-full bg-[var(--accent)]/70" aria-hidden />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--foreground)]">
            <LoadingStatusText finalLabel={title} phases={visiblePhases} />
          </p>
          {compact ? null : (
            <p className="mt-1 text-xs text-[color:var(--muted)]">
              Cached views stay live while this update finishes.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
