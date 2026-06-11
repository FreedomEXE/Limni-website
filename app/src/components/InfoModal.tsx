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
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-[var(--foreground)]/30 p-3 md:items-center md:p-6"
      onClick={onClose}
    >
      <div
        className="flex w-full max-w-3xl flex-col rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4 shadow-2xl sm:p-6 md:max-h-[88vh]"
        onClick={(event) => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="flex shrink-0 items-start justify-between border-b border-[var(--panel-border)]/70 pb-3">
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
        <div className="mt-4 min-h-0 overflow-y-auto pr-1 text-sm text-[color:var(--muted)]">{children}</div>
      </div>
    </div>
  );
}
