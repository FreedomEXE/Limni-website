"use client";

import { useState } from "react";
import InfoModal from "@/components/InfoModal";

type SentimentSummaryCardsProps = {
  pairsTracked: number;
  crowdedLong: number;
  crowdedShort: number;
  flips: number;
};

export default function SentimentSummaryCards({
  pairsTracked,
  crowdedLong,
  crowdedShort,
  flips,
}: SentimentSummaryCardsProps) {
  const [active, setActive] = useState<{ title: string; value: string } | null>(null);

  return (
    <>
      <section className="grid gap-4 md:grid-cols-4">
        {[
          { title: "Pairs tracked", value: String(pairsTracked) },
          { title: "Crowded long", value: String(crowdedLong) },
          { title: "Crowded short", value: String(crowdedShort) },
          { title: "Recent flips", value: String(flips) },
        ].map((item) => (
          <button
            key={item.title}
            type="button"
            onClick={() => setActive(item)}
            className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4 text-left shadow-sm backdrop-blur-sm"
          >
            <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
              {item.title}
            </p>
            <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">
              View
            </p>
          </button>
        ))}
      </section>

      {active ? (
        <InfoModal title={active.title} onClose={() => setActive(null)}>
          <div className="flex items-center justify-between">
            <span>Value</span>
            <span className="font-semibold text-[var(--foreground)]">
              {active.value}
            </span>
          </div>
        </InfoModal>
      ) : null}
    </>
  );
}
