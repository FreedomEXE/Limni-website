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
import { useCanonKernelStatus } from "@/lib/canon/canonKernelStore";
import type { ReleaseManifest } from "@/lib/version/releaseManifest";

export default function AppVersionBadge() {
  const [manifest, setManifest] = useState<ReleaseManifest | null>(null);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const kernel = useCanonKernelStatus();

  useEffect(() => {
    let cancelled = false;
    fetch("/api/version/current", { cache: "no-store" })
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
  const latestPatch = manifest.versionHistory?.find((entry) => entry.appVersion === manifest.appVersion);
  const releaseLine = manifest.versionHistory?.find((entry) => entry.type === "major");
  const releaseLineLabel = manifest.releaseLine ?? manifest.displayVersion ?? "v2";

  return (
    <div
      ref={rootRef}
      className="fixed right-4 top-4 z-[70]"
      onMouseEnter={() => setOpen(true)}
    >
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)] shadow-lg transition hover:border-[var(--accent)] hover:text-[var(--accent-strong)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        aria-expanded={open}
        aria-label={`App version ${manifest.appVersion}`}
        data-testid="app-version-badge"
      >
        {manifest.displayVersion ?? manifest.appVersion}
      </button>

      {open ? (
        <div
          className="absolute right-0 z-[90] mt-2 flex flex-col overflow-hidden rounded-xl border border-[var(--panel-border)] text-sm text-[var(--foreground)] shadow-2xl"
          style={{
            background: "var(--panel, #ffffff)",
            maxHeight: "calc(100vh - 5rem)",
            width: "min(24rem, calc(100vw - 2rem))",
          }}
          data-testid="app-version-popover"
        >
          <div className="shrink-0 border-b border-[var(--panel-border)]/70 p-4">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
                  Limni Labs
                </p>
                <h2 className="mt-1 text-lg font-semibold text-[var(--foreground)]">
                  {manifest.appVersion}
                </h2>
                <div className="mt-2 space-y-1 text-[11px] text-[color:var(--muted)]">
                  <p>Patch: {latestPatch?.date ?? manifest.preparedAt.slice(0, 10)}</p>
                  <p>{releaseLineLabel} line: {releaseLine?.date ?? manifest.releasedAt ?? manifest.preparedAt.slice(0, 10)}</p>
                </div>
              </div>
              <p className="text-right text-[11px] text-[color:var(--muted)]">
                {manifest.releasedAt ?? "Local patch"}
              </p>
            </div>
          </div>
          <div
            className="version-popover-scroll min-h-0 flex-1 overflow-y-auto p-4"
            style={{ scrollbarGutter: "stable" }}
          >
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[color:var(--muted)]">
              Recent changes
            </p>
            <ul className="mt-3 space-y-2 text-xs leading-relaxed text-[color:var(--muted)]">
              {manifest.changes.map((change) => (
                <li key={change} className="flex gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
                  <span>{change}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="shrink-0 border-t border-[var(--panel-border)]/70 p-4">
            <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--background)] px-3 py-2 text-[11px] text-[color:var(--muted)]">
              Canon rows: {manifest.canon.sourceLedgerRowCount.toLocaleString()} · {manifest.canon.variants.length} variants
              <br />
              Kernel: {kernel.status} ({kernel.readyWeeks}/{kernel.totalWeeks} weeks
              {kernel.composedRows > 0 ? `, ${kernel.composedRows.toLocaleString()} rows` : ""})
            </div>
            <a
              href="/documents#version-history"
              className="mt-3 inline-flex text-xs font-semibold text-[var(--accent-strong)] transition hover:text-[var(--accent)]"
            >
              View full version history -&gt;
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}
