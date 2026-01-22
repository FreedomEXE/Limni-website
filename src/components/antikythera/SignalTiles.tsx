"use client";

import { useState } from "react";

type Signal = {
  assetLabel: string;
  pair: string;
  direction: "LONG" | "SHORT";
  reasons: string[];
  confidence: number;
};

type SignalGroup = {
  id: string;
  label: string;
  hasHistory: boolean;
  signals: Signal[];
};

type SignalTilesProps = {
  topSignals: Signal[];
  groups: SignalGroup[];
  showTop?: boolean;
  showGroups?: boolean;
  showSignals?: boolean;
};

function signalTileTone(direction: "LONG" | "SHORT") {
  return direction === "LONG" ? "bg-emerald-500" : "bg-rose-500";
}

export default function SignalTiles({
  topSignals,
  groups,
  showTop = true,
  showGroups = true,
  showSignals = true,
}: SignalTilesProps) {
  const [activeSignal, setActiveSignal] = useState<Signal | null>(null);
  const [activeGroup, setActiveGroup] = useState<SignalGroup | null>(null);

  return (
    <>
      {showTop ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          {topSignals.map((signal) => (
            <button
              key={`${signal.assetLabel}-${signal.pair}-${signal.direction}`}
              type="button"
              onClick={() => setActiveSignal(signal)}
              className="group relative overflow-hidden rounded-lg border border-[var(--panel-border)] text-left"
            >
              <div
                className={`flex flex-col items-start justify-center p-4 text-white transition ${signalTileTone(
                  signal.direction,
                )}`}
              >
                <div className="text-[10px] uppercase tracking-[0.2em] text-white/80">
                  {signal.assetLabel}
                </div>
                <div className="mt-2 text-sm font-semibold">{signal.pair}</div>
              </div>
            </button>
          ))}
        </div>
      ) : null}

      {showGroups ? (
        <div className="grid gap-3 md:grid-cols-2">
          {groups.map((group) => {
            const topSignal = group.signals[0];
            const tone = topSignal ? signalTileTone(topSignal.direction) : "bg-[var(--panel-border)]/60";
            return (
              <button
                key={group.id}
                type="button"
                onClick={() => setActiveGroup(group)}
                className="group relative overflow-hidden rounded-lg border border-[var(--panel-border)] text-left"
              >
                <div className={`flex flex-col items-start justify-center p-4 text-white transition ${tone}`}>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-white/80">
                    {group.label}
                  </div>
                  <div className="mt-2 text-sm font-semibold">
                    {topSignal ? topSignal.pair : group.hasHistory ? "No aligned signals" : "Not enough history"}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      ) : null}

      {showSignals ? (
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-4">
          {groups.flatMap((group) =>
            group.signals.map((signal) => (
              <button
                key={`${group.id}-${signal.pair}-${signal.direction}`}
                type="button"
                onClick={() => setActiveSignal(signal)}
                className="group relative overflow-hidden rounded-lg border border-[var(--panel-border)] text-left"
              >
                <div
                  className={`flex flex-col items-start justify-center p-4 text-white transition ${signalTileTone(
                    signal.direction,
                  )}`}
                >
                  <div className="text-sm font-semibold">{signal.pair}</div>
                  <div className="text-[10px] uppercase tracking-[0.2em] text-white/80">
                    {group.label}
                  </div>
                </div>
              </button>
            )),
          )}
        </div>
      ) : null}

      {activeSignal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--foreground)]/30 p-6"
          onClick={() => setActiveSignal(null)}
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
                  Signal detail
                </p>
                <h3 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
                  {activeSignal.pair} {activeSignal.direction}
                </h3>
                <p className="mt-1 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  {activeSignal.assetLabel}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setActiveSignal(null)}
                className="rounded-full border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
              >
                Close
              </button>
            </div>
            <div className="mt-4 space-y-2 text-sm text-[color:var(--muted)]">
              <div className="flex items-center justify-between">
                <span>Confidence</span>
                <span className="font-semibold text-[var(--foreground)]">
                  {activeSignal.confidence.toFixed(0)}%
                </span>
              </div>
              <div className="pt-2 text-xs text-[color:var(--muted)]">
                Reasons:
              </div>
              <ul className="space-y-1 text-xs text-[color:var(--muted)]">
                {activeSignal.reasons.map((reason) => (
                  <li key={reason}>- {reason}</li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {activeGroup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--foreground)]/30 p-6"
          onClick={() => setActiveGroup(null)}
        >
          <div
            className="w-full max-w-lg rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start justify-between">
              <div>
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  Signal cluster
                </p>
                <h3 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
                  {activeGroup.label}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setActiveGroup(null)}
                className="rounded-full border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
              >
                Close
              </button>
            </div>
            <div className="mt-4 max-h-80 space-y-3 overflow-y-auto text-sm text-[color:var(--muted)]">
              {activeGroup.signals.length === 0 ? (
                <p>No aligned signals.</p>
              ) : (
                activeGroup.signals.map((signal) => (
                  <div
                    key={`${activeGroup.id}-${signal.pair}`}
                    className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/70 px-3 py-2"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-[var(--foreground)]">
                        {signal.pair} {signal.direction}
                      </span>
                      <span className="text-xs text-[color:var(--muted)]">
                        {signal.confidence.toFixed(0)}%
                      </span>
                    </div>
                    <ul className="mt-1 space-y-1 text-xs text-[color:var(--muted)]">
                      {signal.reasons.map((reason) => (
                        <li key={`${signal.pair}-${reason}`}>- {reason}</li>
                      ))}
                    </ul>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
