"use client";

import { useState } from "react";

type BiasRow = {
  assetLabel: string;
  currency: string;
  label: string;
  long: number;
  short: number;
  net: number;
  bias: string;
};

type BiasHeatmapProps = {
  rows: BiasRow[];
  showAssetLabel: boolean;
};

function biasTileTone(bias: string) {
  if (bias === "BULLISH") {
    return "bg-emerald-500";
  }
  if (bias === "BEARISH") {
    return "bg-rose-500";
  }
  return "bg-[var(--panel-border)]/60";
}

export default function BiasHeatmap({
  rows,
  showAssetLabel,
}: BiasHeatmapProps) {
  const [active, setActive] = useState<BiasRow | null>(null);
  const numberFormatter = new Intl.NumberFormat("en-US");
  const formatNumber = (value: number) => numberFormatter.format(value);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {rows.map((row) => (
          <button
            key={`${row.assetLabel}-${row.currency}`}
            type="button"
            onClick={() => setActive(row)}
            className="group relative overflow-hidden rounded-lg border border-[var(--panel-border)] text-left"
          >
            <div
              className={`flex flex-col items-start justify-center p-4 text-white transition ${biasTileTone(
                row.bias,
              )}`}
            >
              {showAssetLabel ? (
                <span className="text-[10px] uppercase tracking-[0.2em] text-white/80">
                  {row.assetLabel}
                </span>
              ) : null}
              <span className="mt-1 text-sm font-semibold">{row.label}</span>
            </div>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[var(--foreground)]/90 opacity-0 transition group-hover:opacity-100">
              <div className="text-center text-xs text-white">
                <p className="font-semibold">{row.label}</p>
                <p className="mt-1">Long: {formatNumber(row.long)}</p>
                <p>Short: {formatNumber(row.short)}</p>
                <p className="mt-1 text-[10px]">Net: {formatNumber(row.net)}</p>
              </div>
            </div>
          </button>
        ))}
      </div>

      {active && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--foreground)]/30 p-6"
          onClick={() => setActive(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  Bias detail
                </p>
                <h3 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
                  {active.label}
                </h3>
                {showAssetLabel ? (
                  <p className="mt-1 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                    {active.assetLabel}
                  </p>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => setActive(null)}
                className="rounded-full border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
              >
                Close
              </button>
            </div>
            <div className="mt-4 space-y-2 text-sm text-[color:var(--muted)]">
              <div className="flex items-center justify-between">
                <span>Bias</span>
                <span className="font-semibold text-[var(--foreground)]">
                  {active.bias}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Long</span>
                <span className="font-semibold text-[var(--foreground)]">
                  {formatNumber(active.long)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Short</span>
                <span className="font-semibold text-[var(--foreground)]">
                  {formatNumber(active.short)}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Net</span>
                <span className="font-semibold text-[var(--foreground)]">
                  {formatNumber(active.net)}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
