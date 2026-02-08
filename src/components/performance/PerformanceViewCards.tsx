"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

type View = "summary" | "simulation" | "basket" | "research" | "notes";

const VIEWS: Array<{ id: View; label: string; description: string }> = [
  { id: "summary", label: "Summary", description: "Key metrics and model ranking." },
  { id: "simulation", label: "Simulation", description: "Trailing-stop and sizing perspective." },
  { id: "basket", label: "Basket", description: "See every pair, direction, and return." },
  { id: "research", label: "Research", description: "Diagnostics and pair-level distribution." },
  { id: "notes", label: "Notes", description: "Weekly observations and takeaways." },
];

export default function PerformanceViewCards({ activeView }: { activeView: View }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setView = (next: View) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("view", next);
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="grid gap-3 md:grid-cols-5">
      {VIEWS.map((view) => {
        const selected = view.id === activeView;
        return (
          <button
            key={view.id}
            type="button"
            onClick={() => setView(view.id)}
            className={`rounded-2xl border p-4 text-left transition focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2 ${
              selected
                ? "border-[var(--accent)]/40 bg-[var(--accent)]/10"
                : "border-[var(--panel-border)] bg-[var(--panel)]/70 hover:border-[var(--accent)]/30 hover:bg-[var(--panel)]"
            }`}
          >
            <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--foreground)]/80">
              {view.label}
            </div>
            <div className="mt-2 text-[11px] leading-snug text-[color:var(--muted)]">
              {view.description}
            </div>
          </button>
        );
      })}
    </div>
  );
}

