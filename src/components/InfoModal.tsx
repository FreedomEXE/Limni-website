"use client";

import type { ReactNode } from "react";

type InfoModalProps = {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
};

export default function InfoModal({ title, subtitle, onClose, children }: InfoModalProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[var(--foreground)]/30 p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-2xl"
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
        <div className="mt-4 text-sm text-[color:var(--muted)]">{children}</div>
      </div>
    </div>
  );
}
