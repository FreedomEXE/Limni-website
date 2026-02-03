"use client";

import { useState } from "react";
import PairModal from "@/components/PairModal";

type SignalRow = {
  pair: string;
  direction: "LONG" | "SHORT" | "NEUTRAL";
  assetLabel: string;
  reasons: string[];
};

type SignalHeatmapProps = {
  signals: SignalRow[];
  view: "heatmap" | "list";
  performanceByPair?: Record<string, number | null>;
  title?: string;
  description?: string;
};

function signalTone(direction: "LONG" | "SHORT" | "NEUTRAL") {
  if (direction === "LONG") {
    return "bg-emerald-500";
  }
  if (direction === "SHORT") {
    return "bg-rose-500";
  }
  return "bg-[var(--panel-border)]/60";
}

export default function SignalHeatmap({
  signals,
  view,
  performanceByPair = {},
  title = "Antikythera Signals",
  description = "Bias and sentiment aligned trading opportunities",
}: SignalHeatmapProps) {
  const [active, setActive] = useState<SignalRow | null>(null);

  if (signals.length === 0) {
    return (
      <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm backdrop-blur-sm">
        <div className="mb-4">
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            {title}
          </h2>
          <p className="text-sm text-[var(--muted)]">
            {description}
          </p>
        </div>
        <div className="flex min-h-[300px] items-center justify-center rounded-lg border border-dashed border-[var(--panel-border)] bg-[var(--panel)]/70">
          <div className="text-center">
            <p className="text-sm font-medium text-[var(--foreground)]">No aligned signals yet</p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Signals appear when bias and sentiment align
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm backdrop-blur-sm">
      <div className="mb-4">
        <h2 className="text-lg font-semibold text-[var(--foreground)]">
          {title}
        </h2>
        <p className="text-sm text-[var(--muted)]">
          {description}
        </p>
      </div>

      {view === "heatmap" ? (
        <div className="grid grid-cols-5 gap-3">
          {signals.map((signal) => (
            <div
              key={`${signal.assetLabel}-${signal.pair}`}
              className="group relative min-h-[96px] overflow-hidden rounded-lg border border-[var(--panel-border)]"
            >
              <div
                className={`flex h-full flex-col items-center justify-center px-4 py-3 transition ${signalTone(
                  signal.direction,
                )}`}
                role="button"
                tabIndex={0}
                onClick={() => setActive(signal)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    setActive(signal);
                  }
                }}
              >
                <div className="text-xs font-bold text-white">{signal.pair}</div>
              </div>

              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[var(--foreground)]/90 opacity-0 transition group-hover:opacity-100">
                <div className="text-center text-xs text-white">
                  <p className="font-semibold">{signal.pair}</p>
                  <p className="mt-1">{signal.direction}</p>
                  <p className="mt-1 text-[10px]">{signal.assetLabel}</p>
                </div>
              </div>
            </div>
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
                    {signal.pair}
                  </p>
                  <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                    {signal.direction} · {signal.assetLabel}
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

      <div className="mt-6 flex items-center justify-between border-t border-[var(--panel-border)] pt-4">
        <div className="flex gap-4 text-xs text-[var(--muted)]">
          <div className="flex items-center gap-2">
            <div className="size-3 rounded bg-emerald-500 opacity-100" />
            <span>Long</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="size-3 rounded bg-rose-500 opacity-100" />
            <span>Short</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="size-3 rounded bg-[var(--panel-border)]/60 opacity-100" />
            <span>Neutral</span>
          </div>
        </div>
      </div>

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
    </div>
  );
}
