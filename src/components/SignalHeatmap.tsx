"use client";

import { useState } from "react";
import PairModal from "@/components/PairModal";

type SignalRow = {
  pair: string;
  direction: "LONG" | "SHORT";
  assetLabel: string;
  reasons: string[];
};

type SignalHeatmapProps = {
  signals: SignalRow[];
  view: "heatmap" | "list";
  performanceByPair?: Record<string, number | null>;
};

function signalTone(direction: "LONG" | "SHORT") {
  return direction === "LONG" ? "bg-emerald-500" : "bg-rose-500";
}

export default function SignalHeatmap({
  signals,
  view,
  performanceByPair = {},
}: SignalHeatmapProps) {
  const [active, setActive] = useState<SignalRow | null>(null);

  if (signals.length === 0) {
    return (
      <p className="text-sm text-[color:var(--muted)]">
        No aligned signals yet.
      </p>
    );
  }

  return (
    <>
      {view === "heatmap" ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          {signals.map((signal) => (
            <button
              key={`${signal.assetLabel}-${signal.pair}`}
              type="button"
              onClick={() => setActive(signal)}
              className="group relative min-h-[96px] overflow-hidden rounded-lg border border-[var(--panel-border)] text-left"
            >
              <div
                className={`flex h-full flex-col items-start justify-center px-4 py-3 text-white transition ${signalTone(
                  signal.direction,
                )}`}
              >
                <span className="text-[10px] uppercase tracking-[0.2em] text-white/80 leading-none">
                  {signal.assetLabel}
                </span>
                <span className="mt-2 text-sm font-semibold leading-tight">
                  {signal.pair} {signal.direction}
                </span>
              </div>
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[var(--foreground)]/90 opacity-0 transition group-hover:opacity-100">
                <div className="text-center text-xs text-white">
                  <p className="font-semibold">{signal.pair}</p>
                  <p className="mt-1">{signal.direction}</p>
                </div>
              </div>
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {signals.map((signal) => {
            const key = `${signal.pair} (${signal.assetLabel})`;
            const percent = performanceByPair[key] ?? null;
            const percentLabel =
              percent === null || !Number.isFinite(percent)
                ? "—"
                : `${percent > 0 ? "+" : ""}${percent.toFixed(2)}%`;
            const percentTone =
              percent === null || !Number.isFinite(percent)
                ? "text-[var(--muted)]"
                : percent > 0
                  ? "text-emerald-600"
                  : percent < 0
                    ? "text-rose-600"
                    : "text-[var(--foreground)]";
            return (
              <button
                key={key}
                type="button"
                onClick={() => setActive(signal)}
                className="flex w-full items-center justify-between rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/70 px-4 py-3 text-left text-sm transition hover:border-[var(--accent)]"
              >
                <div>
                  <p className="font-semibold text-[var(--foreground)]">
                    {signal.pair} {signal.direction}
                  </p>
                  <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    {signal.assetLabel}
                  </p>
                </div>
                <span className={`text-xs font-semibold ${percentTone}`}>
                  {percentLabel}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {active ? (
        <PairModal
          title={`${active.pair} ${active.direction}`}
          subtitle={active.assetLabel}
          onClose={() => setActive(null)}
          details={active.reasons.map((reason, index) => ({
            label: `Reason ${index + 1}`,
            value: reason,
          }))}
          performance={{
            percent:
              performanceByPair[`${active.pair} (${active.assetLabel})`] ?? null,
          }}
        />
      ) : null}
    </>
  );
}
