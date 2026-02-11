"use client";

import { useMemo, useState } from "react";
import {
  buildManualExecutionRows,
  renderManualExecutionCsv,
  renderManualExecutionText,
  resolveManualRiskProfile,
  type ManualRiskProfile,
} from "@/lib/accounts/manualExecutionSheet";

type PlannedPair = {
  symbol: string;
  net: number;
  entryPrice?: number | null;
  legs?: Array<{
    model: string;
    direction: string;
  }>;
};

type ManualExecutionSheetCardProps = {
  accountLabel: string;
  weekLabel: string;
  currency: string;
  equity: number;
  defaultRiskMode?: string | null;
  plannedPairs: PlannedPair[];
};

export default function ManualExecutionSheetCard(props: ManualExecutionSheetCardProps) {
  const { accountLabel, weekLabel, currency, equity, defaultRiskMode, plannedPairs } = props;
  const [riskProfile, setRiskProfile] = useState<ManualRiskProfile>(
    resolveManualRiskProfile(defaultRiskMode),
  );
  const [copied, setCopied] = useState(false);

  const rows = useMemo(
    () => buildManualExecutionRows({ plannedPairs, equity, riskProfile }),
    [plannedPairs, equity, riskProfile],
  );
  const textPayload = useMemo(
    () =>
      renderManualExecutionText({
        accountLabel,
        weekLabel,
        currency: currency === "USD" ? "$" : `${currency} `,
        equity,
        riskProfile,
        rows,
      }),
    [accountLabel, weekLabel, currency, equity, riskProfile, rows],
  );
  const csvPayload = useMemo(() => renderManualExecutionCsv(rows), [rows]);

  const totalLots = rows.reduce((sum, row) => sum + row.lots, 0);
  const totalAgreements = rows.reduce((sum, row) => sum + row.agreementCount, 0);

  return (
    <div className="space-y-3 rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/80 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--foreground)]/80">
            Manual Execution Sheet
          </p>
          <p className="mt-1 text-xs text-[color:var(--muted)]">
            Copy lot sizes for manual account execution on Sunday open.
          </p>
        </div>
        <label className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
          Risk
          <select
            value={riskProfile}
            onChange={(event) => setRiskProfile(event.target.value as ManualRiskProfile)}
            className="ml-2 rounded-full border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-1 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--foreground)]"
          >
            <option value="god">God</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-xs text-[color:var(--muted)]">
        <span>
          Trades: <span className="font-semibold text-[var(--foreground)]">{rows.length}</span>
        </span>
        <span>
          Total lots: <span className="font-semibold text-[var(--foreground)]">{totalLots.toFixed(2)}</span>
        </span>
        <span>
          Total model agreements:{" "}
          <span className="font-semibold text-[var(--foreground)]">{totalAgreements}</span>
        </span>
      </div>

      <div className="max-h-56 overflow-y-auto rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/70">
        <div className="grid grid-cols-[1fr_0.6fr_0.7fr_1.6fr] gap-3 border-b border-[var(--panel-border)] px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)]">
          <span>Symbol</span>
          <span>Side</span>
          <span className="text-right">Lots</span>
          <span>Models</span>
        </div>
        {rows.length === 0 ? (
          <div className="px-3 py-4 text-xs text-[color:var(--muted)]">
            No tradable manual rows available for this week yet.
          </div>
        ) : (
          rows.map((row) => (
            <div
              key={`${row.symbol}-${row.side}`}
              className="grid grid-cols-[1fr_0.6fr_0.7fr_1.6fr] gap-3 border-b border-[var(--panel-border)]/60 px-3 py-2 text-xs last:border-b-0"
            >
              <span className="font-semibold">{row.symbol}</span>
              <span className={row.side === "BUY" ? "text-emerald-700" : "text-rose-700"}>{row.side}</span>
              <span className="text-right font-semibold">{row.lots.toFixed(2)}</span>
              <span className="truncate text-[color:var(--muted)]">{row.models.join(", ") || "N/A"}</span>
            </div>
          ))
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={async () => {
            try {
              await navigator.clipboard.writeText(textPayload);
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1200);
            } catch {
              // Ignore clipboard failures in restricted clients.
            }
          }}
          className="rounded-full border border-[var(--panel-border)] bg-[var(--panel)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
        >
          {copied ? "Copied" : "Copy as Text"}
        </button>
        <button
          type="button"
          onClick={() => {
            const blob = new Blob([csvPayload], { type: "text/csv;charset=utf-8;" });
            const url = URL.createObjectURL(blob);
            const anchor = document.createElement("a");
            anchor.href = url;
            anchor.download = `limni-manual-execution-${weekLabel.replaceAll(" ", "-")}.csv`;
            document.body.appendChild(anchor);
            anchor.click();
            document.body.removeChild(anchor);
            URL.revokeObjectURL(url);
          }}
          className="rounded-full border border-[var(--panel-border)] bg-[var(--panel)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
        >
          Download CSV
        </button>
      </div>
    </div>
  );
}

