"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { appSectionLabelForPathname } from "@/components/DashboardLayout";
import { fetchVersionManifest, RUNTIME_CHANNEL, versionForChannel } from "@/components/AppVersionBadge";

const VERSION_SESSION_KEY = "limni-runtime-version";

let cachedRuntimeVersion: string | null = null;

export function LimniSpinner({ compact = false }: { compact?: boolean }) {
  const sizeClass = compact ? "h-20 w-20" : "h-28 w-28";
  const iconSize = compact ? 50 : 68;

  return (
    <div className={`relative ${sizeClass}`}>
      <div
        className="absolute inset-0 animate-spin rounded-full border-2 shadow-[0_0_28px_rgba(16,185,129,0.24)]"
        style={{
          borderColor: "var(--panel-border, #d8d4ca)",
          borderTopColor: "var(--accent, #0f766e)",
        }}
        aria-hidden
      />
      <div
        className="absolute inset-2 rounded-full border"
        style={{
          animation: "spin 1.8s linear infinite reverse",
          borderColor: "var(--panel-border, #d8d4ca)",
          borderBottomColor: "var(--accent, #0f766e)",
        }}
        aria-hidden
      />
      <div
        className="absolute inset-4 flex items-center justify-center rounded-full"
        style={{ background: "color-mix(in srgb, var(--panel, #ffffff) 95%, transparent)" }}
      >
        <Image
          src="/limni-icon.svg"
          alt="Limni loading"
          width={iconSize}
          height={iconSize}
          className="select-none logo-theme-aware"
          style={{ animation: "spin 2.2s linear infinite" }}
          priority
        />
      </div>
    </div>
  );
}

export default function LimniLoading({
  label,
  compact = false,
}: {
  label?: string;
  compact?: boolean;
}) {
  const pathname = usePathname();
  const routeLabel = useMemo(() => appSectionLabelForPathname(pathname), [pathname]);
  const versionAware = !label;
  const [runtimeVersion, setRuntimeVersion] = useState<string | null>(cachedRuntimeVersion);
  const [checkingVersion, setCheckingVersion] = useState(versionAware && !cachedRuntimeVersion);
  const [showStartupVersion, setShowStartupVersion] = useState(false);
  const [progress, setProgress] = useState(versionAware && !cachedRuntimeVersion ? 12 : 24);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setProgress((current) => Math.min(current + (current < 70 ? 7 : 2), 94));
    }, 180);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!versionAware) return;
    if (cachedRuntimeVersion) {
      setRuntimeVersion(cachedRuntimeVersion);
      setCheckingVersion(false);
      setProgress((current) => Math.max(current, 58));
      return;
    }

    try {
      const storedVersion = window.sessionStorage.getItem(VERSION_SESSION_KEY);
      if (storedVersion) {
        cachedRuntimeVersion = storedVersion;
        setRuntimeVersion(storedVersion);
        setCheckingVersion(false);
        setProgress((current) => Math.max(current, 58));
        return;
      }
    } catch {
      // Session storage is optional; the manifest fetch below is the source of truth.
    }

    let cancelled = false;
    fetchVersionManifest()
      .then((manifest) => {
        if (cancelled) return;
        const nextVersion = manifest ? versionForChannel(manifest, RUNTIME_CHANNEL) : null;
        if (nextVersion) {
          cachedRuntimeVersion = nextVersion;
          setRuntimeVersion(nextVersion);
          setShowStartupVersion(true);
          try {
            window.sessionStorage.setItem(VERSION_SESSION_KEY, nextVersion);
          } catch {
            // Ignore private-mode storage failures.
          }
        }
        setCheckingVersion(false);
        setProgress((current) => Math.max(current, 68));
      });
    return () => {
      cancelled = true;
    };
  }, [versionAware]);

  const resolvedLabel = useMemo(() => {
    if (label) return label;
    if (checkingVersion) return "Checking for updates...";
    if (runtimeVersion && showStartupVersion) return `Loading Limni ${runtimeVersion}...`;
    return `Loading ${routeLabel}...`;
  }, [checkingVersion, label, routeLabel, runtimeVersion, showStartupVersion]);

  return (
    <div
      className="flex min-h-screen w-full items-center justify-center px-6 py-10"
      style={{ background: "var(--background, #f8f7f2)" }}
    >
      <div className="flex flex-col items-center gap-4">
        <LimniSpinner compact={compact} />
        <p
          data-testid="limni-loading-label"
          className="text-xs uppercase tracking-[0.25em]"
          style={{ color: "var(--muted, #6b7280)" }}
        >
          {resolvedLabel}
        </p>
        <div className="h-1 w-56 overflow-hidden rounded-full bg-[var(--panel-border)]" aria-hidden>
          <div
            data-testid="limni-loading-progress"
            className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-200 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
}
