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

type RuntimeChannel = "live" | "dev";

export const RUNTIME_CHANNEL: RuntimeChannel = process.env.NODE_ENV === "production" ? "live" : "dev";

let cachedManifest: ReleaseManifest | null = null;
let manifestRequest: Promise<ReleaseManifest | null> | null = null;

export function fetchVersionManifest() {
  if (cachedManifest) return Promise.resolve(cachedManifest);
  if (manifestRequest) return manifestRequest;
  manifestRequest = fetch("/api/version/current", { cache: "no-store" })
    .then((response) => response.ok ? response.json() as Promise<ReleaseManifest> : null)
    .then((next) => {
      cachedManifest = next;
      return next;
    })
    .catch(() => null)
    .finally(() => {
      manifestRequest = null;
    });
  return manifestRequest;
}

export function versionForChannel(manifest: ReleaseManifest, channel: RuntimeChannel) {
  return channel === "live" ? manifest.liveVersion : manifest.devVersion;
}

function channelLabel(channel: RuntimeChannel) {
  return channel === "live" ? "Live" : "Dev";
}

function channelDescription(channel: RuntimeChannel) {
  return channel === "live"
    ? "Public runtime"
    : "Local development runtime";
}

export default function AppVersionBadge() {
  const [manifest, setManifest] = useState<ReleaseManifest | null>(null);
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchVersionManifest()
      .then((next) => {
        if (!cancelled && next) setManifest(next);
      });
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
  const activeVersion = versionForChannel(manifest, RUNTIME_CHANNEL);

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
        aria-label={`${channelLabel(RUNTIME_CHANNEL)} app version ${activeVersion}`}
        data-testid="app-version-badge"
        data-runtime-channel={RUNTIME_CHANNEL}
      >
        {channelLabel(RUNTIME_CHANNEL)} {activeVersion}
      </button>

      {open ? (
        <div
          className="absolute right-0 z-[90] mt-2 flex flex-col overflow-hidden rounded-xl border border-[var(--panel-border)] text-sm text-[var(--foreground)] shadow-2xl"
          style={{
            background: "var(--panel, #ffffff)",
            width: "min(18rem, calc(100vw - 2rem))",
          }}
          data-testid="app-version-popover"
        >
          <div className="space-y-4 p-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
                Limni Labs
              </p>
              <h2 className="mt-1 text-base font-semibold text-[var(--foreground)]">
                Runtime Version
              </h2>
            </div>
            <dl className="space-y-3 text-xs" data-runtime-channel={RUNTIME_CHANNEL}>
              <div className="rounded-lg border border-[var(--accent)]/35 bg-[var(--accent)]/10 px-3 py-2">
                <dt className="font-semibold uppercase tracking-[0.16em] text-[color:var(--muted)]">
                  Active Runtime
                </dt>
                <dd className="mt-1 text-sm font-semibold text-[var(--foreground)]">
                  {channelLabel(RUNTIME_CHANNEL)} · {activeVersion}
                </dd>
                <dd className="mt-1 text-[11px] text-[color:var(--muted)]">
                  {channelDescription(RUNTIME_CHANNEL)}
                </dd>
              </div>
            </dl>
            <p className="text-xs leading-5 text-[color:var(--muted)]">
              Full release notes, evidence, and screenshots live in Documents.
            </p>
            <a
              href="/documents?version=v2&tab=history"
              className="mt-3 inline-flex text-xs font-semibold text-[var(--accent-strong)] transition hover:text-[var(--accent)]"
            >
              Open Documents -&gt;
            </a>
          </div>
        </div>
      ) : null}
    </div>
  );
}
