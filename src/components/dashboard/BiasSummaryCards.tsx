"use client";

import { useState } from "react";
import InfoModal from "@/components/InfoModal";

type BiasSummaryCardsProps = {
  reportDate: string;
  tradingAllowed: boolean;
  reason: string;
  lastRefresh: string;
};

export default function BiasSummaryCards({
  reportDate,
  tradingAllowed,
  reason,
  lastRefresh,
}: BiasSummaryCardsProps) {
  const [active, setActive] = useState<{ title: string; value: string } | null>(null);

  return (
    <>
      <section className="grid gap-4 md:grid-cols-3">
        <button
          type="button"
          onClick={() => setActive({ title: "Report date", value: reportDate })}
          className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4 text-left shadow-sm"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
            Report date
          </p>
          <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">
            View
          </p>
        </button>
        <button
          type="button"
          onClick={() =>
            setActive({
              title: "Trading allowed",
              value: tradingAllowed ? "Yes" : "No",
            })
          }
          className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4 text-left shadow-sm"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
            Trading allowed
          </p>
          <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">
            View
          </p>
        </button>
        <button
          type="button"
          onClick={() =>
            setActive({
              title: "Last refresh",
              value: lastRefresh,
            })
          }
          className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4 text-left shadow-sm"
        >
          <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
            Last refresh
          </p>
          <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">
            View
          </p>
        </button>
      </section>

      {active ? (
        <InfoModal title={active.title} onClose={() => setActive(null)}>
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span>Value</span>
              <span className="font-semibold text-[var(--foreground)]">
                {active.value}
              </span>
            </div>
            {active.title === "Trading allowed" && reason ? (
              <div className="pt-2 text-xs text-[color:var(--muted)]">
                {reason}
              </div>
            ) : null}
          </div>
        </InfoModal>
      ) : null}
    </>
  );
}
