/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: AppVersionBadge.tsx
 *
 * Description:
 * Global app version badge and release popover.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

"use client";

import { useEffect, useRef, useState } from "react";
import type { ReleaseManifest } from "@/lib/version/releaseManifest";

export default function AppVersionBadge() {
  const [manifest, setManifest] = useState<ReleaseManifest | null>(null);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/version/current", { cache: "force-cache" })
      .then((response) => response.ok ? response.json() as Promise<ReleaseManifest> : null)
      .then((next) => {
        if (!cancelled && next) setManifest(next);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (event: PointerEvent) => {
      if (rootRef.current?.contains(event.target as Node)) return;
      setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  if (!manifest) return null;

  return (
    <div
      ref={rootRef}
      className="fixed right-4 top-4 z-[70]"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="rounded-full border border-(--panel-border) bg-(--panel)/90 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-(--muted) shadow-lg backdrop-blur transition hover:border-(--accent) hover:text-(--accent-strong) focus:outline-none focus-visible:ring-2 focus-visible:ring-(--accent)"
        aria-expanded={open}
        aria-label={`App version ${manifest.appVersion}`}
        data-testid="app-version-badge"
      >
        {manifest.appVersion}
      </button>

      {open ? (
        <div
          className="absolute right-0 mt-2 w-80 rounded-xl border border-(--panel-border) bg-(--panel) p-4 text-sm text-(--foreground) shadow-2xl"
          data-testid="app-version-popover"
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-(--muted)">
                Limni Labs
              </p>
              <h2 className="mt-1 text-lg font-semibold text-(--foreground)">
                {manifest.appVersion}
              </h2>
            </div>
            <p className="text-right text-[11px] text-(--muted)">
              {manifest.releasedAt}
            </p>
          </div>
          <ul className="mt-3 space-y-2 text-xs leading-relaxed text-(--muted)">
            {manifest.changes.slice(0, 5).map((change) => (
              <li key={change} className="flex gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-(--accent)" />
                <span>{change}</span>
              </li>
            ))}
          </ul>
          <div className="mt-4 rounded-lg border border-(--panel-border) bg-(--background)/20 px-3 py-2 text-[11px] text-(--muted)">
            Canon rows: {manifest.canon.sourceLedgerRowCount.toLocaleString()} · {manifest.canon.variants.length} variants
          </div>
        </div>
      ) : null}
    </div>
  );
}
