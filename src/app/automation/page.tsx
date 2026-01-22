"use client";

import { useState } from "react";
import DashboardLayout from "@/components/DashboardLayout";
import InfoModal from "@/components/InfoModal";

export default function AutomationPage() {
  const [activeCard, setActiveCard] = useState<{
    title: string;
    status: string;
    description: string;
    bullets: string[];
  } | null>(null);
  const [showRoster, setShowRoster] = useState(false);

  const cards = [
    {
      title: "MT5 Forex Basket EA",
      status: "Available",
      description: "Production-ready EA with risk controls and weekly basket logic.",
      bullets: ["Risk guardrails included", "Weekly basket rebalancing"],
      tone: "border-[var(--accent)]/30 bg-[var(--panel)]",
    },
    {
      title: "Crypto Perp Bot (Bitget)",
      status: "In build",
      description: "Bias + sentiment-driven perpetual futures automation.",
      bullets: ["Funding + OI aware", "Signal throttling"],
      tone: "border-[var(--panel-border)] bg-[var(--panel)]",
    },
    {
      title: "Solana Meme Bot",
      status: "Later",
      description: "High-volatility meme strategy targeting Solana launches.",
      bullets: ["Launch sniper logic", "Liquidity gate"],
      tone: "border-[var(--panel-border)] bg-[var(--panel)]",
    },
  ];

  return (
    <DashboardLayout>
      <div className="space-y-8">
        <header className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-3xl font-semibold text-[var(--foreground)]">
              Automation
            </h1>
            <p className="mt-2 text-sm text-[color:var(--muted)]">
              Bot downloads and quick-reference details for Limni automation.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowRoster(true)}
            className="rounded-full border border-[var(--panel-border)] bg-[var(--panel)]/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]"
          >
            Release roster
          </button>
        </header>

        <section className="grid gap-4 lg:grid-cols-3">
          {cards.map((card) => (
            <button
              key={card.title}
              type="button"
              onClick={() => setActiveCard(card)}
              className={`rounded-2xl border p-6 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${card.tone}`}
            >
              <div className="flex items-start justify-between">
                <h2 className="text-lg font-semibold text-[var(--foreground)]">
                  {card.title}
                </h2>
                <span className="rounded-full border border-[var(--panel-border)] bg-[var(--panel)]/70 px-3 py-1 text-xs font-semibold text-[color:var(--muted)]">
                  {card.status}
                </span>
              </div>
              <p className="mt-3 text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
                View
              </p>
            </button>
          ))}
        </section>
      </div>

      {showRoster ? (
        <InfoModal title="Release roster" onClose={() => setShowRoster(false)}>
          <div className="space-y-2">
            {cards.map((card) => (
              <div key={`roster-${card.title}`} className="flex items-center justify-between">
                <span>{card.title}</span>
                <span className="font-semibold text-[var(--foreground)]">
                  {card.status}
                </span>
              </div>
            ))}
          </div>
        </InfoModal>
      ) : null}

      {activeCard ? (
        <InfoModal title={activeCard.title} onClose={() => setActiveCard(null)}>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span>Status</span>
              <span className="font-semibold text-[var(--foreground)]">
                {activeCard.status}
              </span>
            </div>
            <div className="pt-2 text-xs text-[color:var(--muted)]">
              {activeCard.description}
            </div>
            <ul className="mt-2 space-y-1 text-xs text-[color:var(--muted)]">
              {activeCard.bullets.map((bullet) => (
                <li key={bullet}>- {bullet}</li>
              ))}
            </ul>
          </div>
        </InfoModal>
      ) : null}
    </DashboardLayout>
  );
}
