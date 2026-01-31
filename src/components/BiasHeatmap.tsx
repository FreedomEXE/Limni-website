"use client";

import { useState } from "react";
import PairModal from "@/components/PairModal";

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
            className="group relative min-h-[96px] overflow-hidden rounded-lg border border-[var(--panel-border)] text-left"
          >
            <div
              className={`flex h-full flex-col items-start justify-center px-4 py-3 text-white transition ${biasTileTone(
                row.bias,
              )}`}
            >
              {showAssetLabel ? (
                <span className="text-[10px] uppercase tracking-[0.2em] text-white/80 leading-none">
                  {row.assetLabel}
                </span>
              ) : null}
              <span className="mt-2 text-sm font-semibold leading-tight">{row.label}</span>
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

      {active ? (
        <PairModal
          title={active.label}
          subtitle={showAssetLabel ? active.assetLabel : undefined}
          onClose={() => setActive(null)}
          details={[
            { label: "Bias", value: active.bias },
            { label: "Long", value: formatNumber(active.long) },
            { label: "Short", value: formatNumber(active.short) },
            { label: "Net", value: formatNumber(active.net) },
          ]}
        />
      ) : null}
    </>
  );
}
