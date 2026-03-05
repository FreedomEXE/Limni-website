/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: SignalLogTab.tsx
 *
 * Description:
 * Read-only signal ledger for Bitget Bot v2 showing sweep/displacement
 * detections, handshake grouping, and status progression.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

"use client";

import {
  toIsoString,
  toNumber,
  type BitgetSignalRow,
} from "@/components/bitget-bot/types";
import { formatDateTimeET } from "@/lib/time";

type SignalLogTabProps = {
  signals: BitgetSignalRow[];
};

function fmtUtc(value: unknown) {
  const iso = toIsoString(value);
  if (!iso) return "—";
  return formatDateTimeET(iso, iso);
}

function fmtUtcExact(value: unknown) {
  const iso = toIsoString(value);
  if (!iso) return "—";
  return formatDateTimeET(iso, iso);
}

const UNQUALIFIED_REASON_LABELS: Record<string, string> = {
  no_rejection: "No rejection",
  no_displacement: "No displacement",
  wrong_direction: "Wrong direction",
};

function unqualifiedReason(metadata: Record<string, unknown> | null | undefined): string {
  if (!metadata) return "—";
  const reason = typeof metadata.reason === "string" ? metadata.reason : null;
  return reason ? (UNQUALIFIED_REASON_LABELS[reason] ?? reason) : "—";
}

function statusTone(status: string) {
  if (status === "ENTRY_CONFIRMED") {
    return "border-emerald-300/40 bg-emerald-500/10 text-emerald-200";
  }
  if (status === "HANDSHAKE_MATCHED" || status === "HANDSHAKE_CONFIRMED") {
    return "border-sky-300/40 bg-sky-500/10 text-sky-200";
  }
  if (status === "ENTRY_FAILED") {
    return "border-rose-300/40 bg-rose-500/10 text-rose-200";
  }
  if (status === "CANDIDATE") {
    return "border-sky-300/40 bg-sky-500/10 text-sky-200";
  }
  if (status === "UNQUALIFIED") {
    return "border-amber-300/40 bg-amber-500/10 text-amber-200";
  }
  if (status === "REJECTED") {
    return "border-rose-300/40 bg-rose-500/10 text-rose-200";
  }
  if (status === "EXPIRED") {
    return "border-[var(--panel-border)] bg-[var(--panel)]/70 text-[color:var(--muted)]";
  }
  return "border-[var(--panel-border)] bg-[var(--panel)]/70 text-[color:var(--muted)]";
}

export default function SignalLogTab({ signals }: SignalLogTabProps) {
  return (
    <section className="space-y-3">
      <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4 text-xs text-[color:var(--muted)] shadow-sm">
        <p className="font-semibold uppercase tracking-[0.16em] text-[var(--foreground)]">
          Signal Rules
        </p>
        <p className="mt-2">
          Sweep requires range breach ({">="}0.1%, or {">="}0.3% when bias tier is neutral), rejection back inside range,
          and displacement body {">="}0.1%.
        </p>
        <p className="mt-1">
          Handshake Group ID appears only after both BTC and ETH confirm inside the handshake window.
          While waiting, status stays CANDIDATE and group ID remains pending.
        </p>
        <p className="mt-1">
          UNQUALIFIED signals are near-miss sweeps that breached the range but failed rejection or displacement.
          The reason column shows why the sweep didn&apos;t qualify.
        </p>
        <p className="mt-1">
          HANDSHAKE_MATCHED means both symbols aligned; ENTRY_CONFIRMED means both entry orders succeeded.
          ENTRY_FAILED captures failed/partial entry attempts.
        </p>
      </div>
      <section className="overflow-hidden rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] shadow-sm">
      <div className="max-h-[760px] overflow-auto">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 z-10 bg-[var(--panel)]/95 text-xs uppercase tracking-[0.2em] text-[color:var(--muted)] backdrop-blur">
            <tr>
              <th className="px-4 py-3">Day</th>
              <th className="px-4 py-3">Symbol</th>
              <th className="px-4 py-3">Session Window</th>
              <th className="px-4 py-3">Direction</th>
              <th className="px-4 py-3">Sweep %</th>
              <th className="px-4 py-3">Displacement %</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Handshake Group ID</th>
              <th className="px-4 py-3">Confirm Time</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[var(--panel-border)]">
            {signals.length === 0 ? (
              <tr>
                <td colSpan={9} className="px-4 py-6 text-center text-sm text-[color:var(--muted)]">
                  No signals logged yet.
                </td>
              </tr>
            ) : (
              signals.map((signal) => {
                const isGrouped = Boolean(signal.handshake_group_id);
                return (
                  <tr
                    key={signal.id}
                    className={`${isGrouped ? "border-l-4 border-l-[var(--accent)]/40 bg-[var(--accent)]/5" : ""}`}
                  >
                    <td className="px-4 py-3 text-[color:var(--muted)]">
                      {toIsoString(signal.day_utc)?.slice(0, 10) ?? "—"}
                    </td>
                    <td className="px-4 py-3 font-semibold text-[var(--foreground)]">{signal.symbol}</td>
                    <td className="px-4 py-3 text-xs text-[color:var(--muted)]">{signal.session_window}</td>
                    <td className="px-4 py-3">{signal.direction}</td>
                    <td className="px-4 py-3">{toNumber(signal.sweep_pct)?.toFixed(3) ?? "—"}</td>
                    <td className="px-4 py-3">{toNumber(signal.displacement_pct)?.toFixed(3) ?? "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`rounded-full border px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${statusTone(signal.status)}`}>
                        {signal.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-[color:var(--muted)]">
                      {signal.handshake_group_id
                        ?? (signal.status === "CANDIDATE"
                          ? "Pending counter-signal"
                          : signal.status === "UNQUALIFIED"
                            ? unqualifiedReason(signal.metadata)
                            : "—")}
                    </td>
                    <td className="px-4 py-3 text-[color:var(--muted)]" title={fmtUtcExact(signal.confirm_time_utc)}>
                      {fmtUtc(signal.confirm_time_utc)}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
      </section>
    </section>
  );
}
