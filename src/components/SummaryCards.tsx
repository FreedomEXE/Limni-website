"use client";

import { useState } from "react";
import InfoModal from "@/components/InfoModal";

type CardDetail = { label: string; value: string };

type SummaryCard = {
  id: string;
  label: string;
  value: string;
  tone?: "positive" | "negative" | "neutral";
  details?: CardDetail[];
};

type SummaryCardsProps = {
  title: string;
  cards: SummaryCard[];
  centered?: boolean;
};

function toneClass(tone?: SummaryCard["tone"]) {
  if (tone === "positive") {
    return "text-emerald-600";
  }
  if (tone === "negative") {
    return "text-rose-600";
  }
  return "text-[var(--foreground)]";
}

export default function SummaryCards({ title, cards, centered = false }: SummaryCardsProps) {
  const [active, setActive] = useState<SummaryCard | null>(null);
  return (
    <>
      <div className={centered ? "flex flex-wrap justify-center gap-4" : "grid gap-4 md:grid-cols-2 xl:grid-cols-5"}>
        {cards.map((card) => (
          <button
            key={card.id}
            type="button"
            onClick={() => setActive(card)}
            className={`rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4 text-left shadow-sm transition hover:border-[var(--accent)] ${centered ? "min-w-[200px]" : ""}`}
          >
            <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              {card.label}
            </p>
            <p className={`mt-2 text-2xl font-semibold ${toneClass(card.tone)}`}>
              {card.value}
            </p>
          </button>
        ))}
      </div>

      {active ? (
        <InfoModal
          title={active.label}
          subtitle={title}
          onClose={() => setActive(null)}
        >
          {active.details && active.details.length > 0 ? (
            <div className="space-y-2">
              {active.details.map((detail) => (
                <div key={detail.label} className="flex items-center justify-between">
                  <span>{detail.label}</span>
                  <span className="font-semibold text-[var(--foreground)]">
                    {detail.value}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p>No additional details.</p>
          )}
        </InfoModal>
      ) : null}
    </>
  );
}
