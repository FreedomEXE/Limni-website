"use client";

import { useState } from "react";
import PairModal from "@/components/PairModal";
import type { Direction } from "@/lib/cotTypes";
import type { PairPerformance } from "@/lib/priceStore";

type PairRow = {
  pair: string;
  direction: Direction;
  performance?: PairPerformance | null;
};

type PairHeatmapProps = {
  rows: PairRow[];
  title?: string;
  description?: string;
};

function tone(direction: Direction) {
  if (direction === "LONG") {
    return "bg-emerald-500";
  }
  if (direction === "SHORT") {
    return "bg-rose-500";
  }
  return "bg-[var(--panel-border)]/60";
}

function cleanPairName(pair: string): string {
  // Remove asset class suffixes like "(FX)", "(Crypto)", etc.
  return pair.replace(/\s*\([^)]+\)\s*$/, '');
}

export default function PairHeatmap({ rows, title = "Bias Heatmap", description = "COT positioning bias across pairs" }: PairHeatmapProps) {
  const [active, setActive] = useState<PairRow | null>(null);

  if (rows.length === 0) {
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
            <p className="text-sm font-medium text-[var(--foreground)]">No tradable pairs yet</p>
            <p className="mt-1 text-xs text-[var(--muted)]">
              Pairs will appear when bias signals are available
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

      <div className="grid grid-cols-5 gap-3">
        {rows.map((row) => {
          const cleanName = cleanPairName(row.pair);
          return (
            <div
              key={row.pair}
              className="group relative min-h-[96px] overflow-hidden rounded-lg border border-[var(--panel-border)]"
            >
              <div
                className={`flex h-full flex-col items-center justify-center px-4 py-3 transition ${tone(
                  row.direction,
                )}`}
                role="button"
                tabIndex={0}
                onClick={() => setActive(row)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    setActive(row);
                  }
                }}
              >
                <div className="text-xs font-bold text-white">{cleanName}</div>
              </div>

              <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[var(--foreground)]/90 opacity-0 transition group-hover:opacity-100">
                <div className="text-center text-xs text-white">
                  <p className="font-semibold">{cleanName}</p>
                  <p className="mt-1">{row.direction}</p>
                  {row.performance ? (
                    <p className="mt-1 text-[10px]">
                      {row.performance.percent > 0 ? "+" : ""}
                      {row.performance.percent.toFixed(2)}%
                    </p>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>

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
          title={`${cleanPairName(active.pair)} ${active.direction}`}
          onClose={() => setActive(null)}
          details={[
            { label: "Direction", value: active.direction },
            {
              label: "Percent",
              value: active.performance
                ? `${active.performance.percent.toFixed(2)}%`
                : "—",
            },
            {
              label: "Pips",
              value: active.performance
                ? active.performance.pips.toFixed(1)
                : "—",
            },
          ]}
          performance={{
            percent: active.performance?.percent ?? null,
          }}
        />
      ) : null}
    </div>
  );
}
