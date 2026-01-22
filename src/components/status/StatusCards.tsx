"use client";

import { useState } from "react";
import InfoModal from "@/components/InfoModal";

type HealthItem = {
  name: string;
  status: "ok" | "warning" | "error";
  detail: string;
  hint?: string;
};

type StatusCardsProps = {
  health: HealthItem[];
  toneMap: Record<HealthItem["status"], string>;
};

export default function StatusCards({ health, toneMap }: StatusCardsProps) {
  const [active, setActive] = useState<HealthItem | null>(null);

  return (
    <>
      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {health.map((item) => (
          <button
            key={item.name}
            type="button"
            onClick={() => setActive(item)}
            className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-5 text-left shadow-sm"
          >
            <div className="flex items-center justify-between">
              <p className="text-sm font-semibold text-[var(--foreground)]">
                {item.name}
              </p>
              <span
                className={`rounded-full px-3 py-1 text-xs font-semibold ${toneMap[item.status]}`}
              >
                {item.status.toUpperCase()}
              </span>
            </div>
            <p className="mt-3 text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              View
            </p>
          </button>
        ))}
      </section>

      {active ? (
        <InfoModal title={active.name} onClose={() => setActive(null)}>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span>Status</span>
              <span className="font-semibold text-[var(--foreground)]">
                {active.status.toUpperCase()}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span>Detail</span>
              <span className="font-semibold text-[var(--foreground)]">
                {active.detail}
              </span>
            </div>
            {active.hint ? (
              <div className="pt-2 text-xs text-[color:var(--muted)]">
                Fix: {active.hint}
              </div>
            ) : null}
          </div>
        </InfoModal>
      ) : null}
    </>
  );
}
