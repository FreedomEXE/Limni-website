"use client";

import { useEffect, useMemo, useState } from "react";

type ModePayload = {
  mode: "normal" | "sentiment_only";
  label: string;
  reason: string;
  stale_asset_classes: string[];
  healthy_asset_classes: string[];
};

export default function CotModeBanner() {
  const [payload, setPayload] = useState<ModePayload | null>(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const response = await fetch("/api/system/mode", { cache: "no-store" });
        if (!response.ok) {
          return;
        }
        const next = (await response.json()) as ModePayload;
        if (active) {
          setPayload(next);
        }
      } catch {
        // Silent fallback keeps UI usable.
      }
    };
    load();
    const timer = window.setInterval(load, 120000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    if (!payload) {
      root.removeAttribute("data-cot-mode");
      return;
    }
    root.setAttribute("data-cot-mode", payload.mode);
    return () => {
      root.removeAttribute("data-cot-mode");
    };
  }, [payload]);

  const details = useMemo(() => {
    if (!payload) {
      return "";
    }
    if (payload.mode !== "sentiment_only") {
      return "";
    }
    if (payload.stale_asset_classes.length === 0) {
      return "";
    }
    return `Stale COT: ${payload.stale_asset_classes.join(", ").toUpperCase()}`;
  }, [payload]);

  if (!payload || payload.mode !== "sentiment_only") {
    return null;
  }

  return (
    <div className="mb-4 rounded-2xl border border-amber-300/60 bg-amber-50/80 p-3 text-amber-900 dark:border-amber-400/40 dark:bg-amber-500/10 dark:text-amber-200">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-current/30 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.2em]">
          {payload.label}
        </span>
        <p className="text-sm font-medium">{payload.reason}</p>
      </div>
      {details ? (
        <p className="mt-1 text-xs uppercase tracking-[0.14em] opacity-80">
          {details}
        </p>
      ) : null}
    </div>
  );
}
