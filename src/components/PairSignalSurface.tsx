"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import PairModal from "@/components/PairModal";

export type SignalTone = "positive" | "negative" | "neutral";

export type PairSignalSurfaceItem = {
  id: string;
  label: string;
  tone: SignalTone;
  statusLabel: string;
  secondaryLabel?: string;
  modalTitle?: string;
  modalSubtitle?: string;
  modalDetails: Array<{ label: string; value: string }>;
  performancePercent?: number | null;
  performanceNote?: string;
};

type PairSignalSurfaceProps = {
  title: string;
  description: string;
  items: PairSignalSurfaceItem[];
  view: "heatmap" | "list";
  emptyTitle: string;
  emptyDescription: string;
  updatedLabel?: string;
  footerContent?: ReactNode;
};

function toneClass(tone: SignalTone) {
  if (tone === "positive") {
    return "bg-emerald-500";
  }
  if (tone === "negative") {
    return "bg-rose-500";
  }
  return "bg-[var(--panel-border)]/60";
}

function percentTone(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "text-[var(--muted)]";
  }
  if (value > 0) {
    return "text-emerald-600";
  }
  if (value < 0) {
    return "text-rose-600";
  }
  return "text-[var(--foreground)]";
}

function formatPercent(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }
  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export default function PairSignalSurface({
  title,
  description,
  items,
  view,
  emptyTitle,
  emptyDescription,
  updatedLabel,
  footerContent,
}: PairSignalSurfaceProps) {
  const [active, setActive] = useState<PairSignalSurfaceItem | null>(null);
  const [showNeutralPairs, setShowNeutralPairs] = useState(false);
  const visibleItems = showNeutralPairs
    ? items
    : items.filter((item) => item.tone !== "neutral");

  return (
    <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm backdrop-blur-sm">
      <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">{title}</h2>
          <p className="text-sm text-[var(--muted)]">{description}</p>
        </div>
        <label className="inline-flex items-center gap-2 rounded-full border border-[var(--panel-border)] bg-[var(--panel)]/80 px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
          <input
            type="checkbox"
            checked={showNeutralPairs}
            onChange={(event) => setShowNeutralPairs(event.target.checked)}
            className="size-3 accent-[var(--accent)]"
          />
          Show neutral pairs
        </label>
      </div>

      {items.length === 0 ? (
        <div className="flex min-h-[300px] items-center justify-center rounded-lg border border-dashed border-[var(--panel-border)] bg-[var(--panel)]/70">
          <div className="text-center">
            <p className="text-sm font-medium text-[var(--foreground)]">{emptyTitle}</p>
            <p className="mt-1 text-xs text-[var(--muted)]">{emptyDescription}</p>
          </div>
        </div>
      ) : visibleItems.length === 0 ? (
        <div className="flex min-h-[240px] items-center justify-center rounded-lg border border-dashed border-[var(--panel-border)] bg-[var(--panel)]/70">
          <div className="text-center">
            <p className="text-sm font-medium text-[var(--foreground)]">
              No non-neutral pairs
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Enable &quot;Show neutral pairs&quot; to include neutral instruments.
            </p>
          </div>
        </div>
      ) : view === "heatmap" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
          {visibleItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActive(item)}
              className="group relative min-h-[96px] overflow-hidden rounded-lg border border-[var(--panel-border)] text-left"
            >
              <div
                className={`flex h-full flex-col items-center justify-center px-4 py-3 text-white transition ${toneClass(
                  item.tone,
                )}`}
              >
                <div className="text-xs font-bold">{item.label}</div>
              </div>

              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[var(--foreground)]/90 opacity-0 transition group-hover:opacity-100">
                <div className="text-center text-xs text-white">
                  <p className="font-semibold">{item.label}</p>
                  <p className="mt-1">{item.statusLabel}</p>
                  {item.secondaryLabel ? (
                    <p className="mt-1 text-[10px]">{item.secondaryLabel}</p>
                  ) : null}
                  <p className="mt-1 text-[10px]">
                    {formatPercent(item.performancePercent)}
                  </p>
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {visibleItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActive(item)}
              className="flex w-full items-center justify-between rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/70 px-4 py-3 text-left text-sm transition hover:border-[var(--accent)]"
            >
              <div>
                <p className="font-semibold text-[var(--foreground)]">{item.label}</p>
                <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  {item.statusLabel}
                  {item.secondaryLabel ? ` · ${item.secondaryLabel}` : ""}
                </p>
              </div>
              <span className={`text-xs font-semibold ${percentTone(item.performancePercent)}`}>
                {formatPercent(item.performancePercent)}
              </span>
            </button>
          ))}
        </div>
      )}

      {updatedLabel || footerContent ? (
        <div className="mt-6 border-t border-[var(--panel-border)] pt-4">
          {footerContent ? <div>{footerContent}</div> : null}
          {updatedLabel ? (
            <p className="text-right text-xs text-[var(--muted)]">{updatedLabel}</p>
          ) : null}
        </div>
      ) : null}

      {active ? (
        <PairModal
          title={active.modalTitle ?? active.label}
          subtitle={active.modalSubtitle}
          onClose={() => setActive(null)}
          details={active.modalDetails}
          performance={{
            percent: active.performancePercent ?? null,
            note: active.performanceNote,
          }}
        />
      ) : null}
    </div>
  );
}
