/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: TradeIdBadge.tsx
 *
 * Description:
 * Copyable human-readable trade identity badge.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

"use client";

import { useState } from "react";
import { deriveDisplayId } from "@/lib/trades/displayId";
import type { Trade } from "@/lib/trades/tradeTypes";

type TradeIdBadgeProps = {
  trade: Trade;
  className?: string;
};

export default function TradeIdBadge({ trade, className }: TradeIdBadgeProps) {
  const [copied, setCopied] = useState(false);
  const displayId = deriveDisplayId(trade);

  async function copyDisplayId() {
    try {
      await navigator.clipboard.writeText(displayId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1200);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      type="button"
      data-testid="trade-id-badge"
      onClick={copyDisplayId}
      title={`${displayId} | ${trade.tradeId}`}
      className={`inline-flex max-w-full items-center rounded-full border border-(--accent)/35 bg-(--accent)/10 px-2 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-(--accent-strong) transition hover:border-(--accent) ${className ?? ""}`}
    >
      <span className="truncate">{displayId}</span>
      {copied ? <span className="ml-1 text-(--muted)">copied</span> : null}
    </button>
  );
}
