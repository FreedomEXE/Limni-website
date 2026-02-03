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

export default function PairHeatmap({ rows }: PairHeatmapProps) {
  const [active, setActive] = useState<PairRow | null>(null);

  if (rows.length === 0) {
    return <p className="text-sm text-[color:var(--muted)]">No tradable pairs yet.</p>;
  }

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {rows.map((row) => (
          <button
            key={row.pair}
            type="button"
            onClick={() => setActive(row)}
            className="group relative min-h-[96px] overflow-hidden rounded-lg border border-[var(--panel-border)] text-left"
          >
            <div
              className={`flex h-full flex-col items-start justify-center px-4 py-3 text-white transition ${tone(
                row.direction,
              )}`}
            >
              <span className="text-[10px] uppercase tracking-[0.2em] text-white/80 leading-none">
                {row.direction}
              </span>
              <span className="mt-2 text-sm font-semibold leading-tight">{row.pair}</span>
            </div>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center bg-[var(--foreground)]/90 opacity-0 transition group-hover:opacity-100">
              <div className="text-center text-xs text-white">
                <p className="font-semibold">{row.pair}</p>
                <p className="mt-1">{row.direction}</p>
                {row.performance ? (
                  <p className="mt-1 text-[10px]">
                    {row.performance.percent > 0 ? "+" : ""}
                    {row.performance.percent.toFixed(2)}%
                  </p>
                ) : null}
              </div>
            </div>
          </button>
        ))}
      </div>

      {active ? (
        <PairModal
          title={`${active.pair} ${active.direction}`}
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
    </>
  );
}
