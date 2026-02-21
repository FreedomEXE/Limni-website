"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

type PairModalProps = {
  title: string;
  subtitle?: string;
  details: Array<{ label: string; value: string }>;
  performance?: {
    percent?: number | null;
    note?: string;
  };
  onClose: () => void;
};

export default function PairModal({
  title,
  subtitle,
  details,
  performance,
  onClose,
}: PairModalProps) {
  const [tab, setTab] = useState<"details" | "performance">("details");
  const isBrowser = typeof document !== "undefined";

  useEffect(() => {
    if (!isBrowser) {
      return;
    }
    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isBrowser, onClose]);

  const percent = performance?.percent ?? null;
  const percentLabel =
    percent === null || !Number.isFinite(percent)
      ? "No data"
      : `${percent > 0 ? "+" : ""}${percent.toFixed(2)}%`;
  const percentTone =
    percent === null || !Number.isFinite(percent)
      ? "text-[var(--muted)]"
      : percent > 0
        ? "text-emerald-600"
        : percent < 0
          ? "text-rose-600"
          : "text-[var(--foreground)]";

  if (!isBrowser) {
    return null;
  }

  return createPortal(
    <div
      className="fixed inset-0 z-[100] overflow-y-auto bg-[var(--foreground)]/35"
      onClick={onClose}
    >
      <div className="flex min-h-full items-center justify-center p-6">
        <div
          className="w-full max-w-md max-h-[calc(100vh-3rem)] overflow-y-auto rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-2xl"
          onClick={(event) => event.stopPropagation()}
          role="dialog"
          aria-modal="true"
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                Detail
              </p>
              <h3 className="mt-2 text-2xl font-semibold text-[var(--foreground)]">
                {title}
              </h3>
              {subtitle ? (
                <p className="mt-1 text-xs uppercase tracking-[0.2em] text-[var(--muted)]">
                  {subtitle}
                </p>
              ) : null}
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
            >
              Close
            </button>
          </div>

          <div className="mt-4 flex gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
            <button
              type="button"
              onClick={() => setTab("details")}
              className={`rounded-full border px-3 py-1 transition ${
                tab === "details"
                  ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]"
                  : "border-[var(--panel-border)] hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
              }`}
            >
              Details
            </button>
            <button
              type="button"
              onClick={() => setTab("performance")}
              className={`rounded-full border px-3 py-1 transition ${
                tab === "performance"
                  ? "border-[var(--foreground)] bg-[var(--foreground)] text-[var(--background)]"
                  : "border-[var(--panel-border)] hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
              }`}
            >
              Performance
            </button>
          </div>

          {tab === "details" ? (
            <div className="mt-4 space-y-2 text-sm text-[color:var(--muted)]">
              {details.map((detail) => (
                <div key={detail.label} className="flex items-center justify-between">
                  <span>{detail.label}</span>
                  <span className="font-semibold text-[var(--foreground)]">
                    {detail.value}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-4 space-y-2 text-sm text-[color:var(--muted)]">
              <div className="flex items-center justify-between">
                <span>Week return</span>
                <span className={`font-semibold ${percentTone}`}>{percentLabel}</span>
              </div>
              {performance?.note ? <p className="text-xs">{performance.note}</p> : null}
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
