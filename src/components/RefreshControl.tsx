"use client";

type RefreshControlProps = {
  lastRefreshUtc?: string | null;
};

export default function RefreshControl({ lastRefreshUtc }: RefreshControlProps) {
  return (
    <div className="w-full max-w-sm rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4 shadow-sm">
      <div className="flex flex-col gap-2">
        <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
          Auto refresh
        </p>
        <p className="text-sm text-[color:var(--muted)]">
          COT last:{" "}
          {lastRefreshUtc && lastRefreshUtc.length > 0
            ? lastRefreshUtc
            : "No refresh yet"}
        </p>
        <p className="text-xs text-[color:var(--muted)]">
          Data refreshes automatically on page load.
        </p>
      </div>
    </div>
  );
}
