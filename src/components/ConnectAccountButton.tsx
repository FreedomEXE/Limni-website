"use client";

import { useState } from "react";
import ConnectAccountModal from "@/components/ConnectAccountModal";

export default function ConnectAccountButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-full border border-[var(--panel-border)] bg-[var(--panel)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--foreground)] transition hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
      >
        Connect Account
      </button>
      {open ? <ConnectAccountModal onClose={() => setOpen(false)} /> : null}
    </>
  );
}
