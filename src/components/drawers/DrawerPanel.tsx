"use client";

import { ReactNode, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

type DrawerPanelProps = {
  title: string;
  subtitle?: string;
  open: boolean;
  onClose?: () => void;
  children: ReactNode;
};

export default function DrawerPanel({ title, subtitle, open, onClose, children }: DrawerPanelProps) {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && open) {
        handleClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [open]);

  function handleClose() {
    if (onClose) {
      onClose();
      return;
    }
    const params = new URLSearchParams(searchParams.toString());
    params.delete("drawer");
    router.replace(`?${params.toString()}`, { scroll: false });
  }

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/30"
        onClick={handleClose}
        aria-hidden="true"
      />
      <aside className="absolute right-0 top-0 h-full w-full max-w-2xl overflow-hidden border-l border-[var(--panel-border)] bg-[var(--background)] shadow-2xl">
        <div className="flex items-start justify-between border-b border-[var(--panel-border)] px-6 py-4">
          <div>
            <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
              {title}
            </p>
            {subtitle ? (
              <p className="mt-1 text-sm text-[color:var(--muted)]">{subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            onClick={handleClose}
            className="rounded-full border border-[var(--panel-border)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
          >
            Close
          </button>
        </div>
        <div className="h-[calc(100%-72px)] overflow-y-auto px-6 py-4">{children}</div>
      </aside>
    </div>
  );
}
