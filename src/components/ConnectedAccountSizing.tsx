"use client";

import { useState } from "react";
import LimniLoading from "@/components/LimniLoading";
import { PAIRS_BY_ASSET_CLASS } from "@/lib/cotPairs";

type SizingRow = {
  symbol: string;
  instrument: string;
  available: boolean;
  units?: number;
  rawUnits?: number;
  price?: number;
  notionalUsdPerUnit?: number;
  marginRate?: number | null;
  marginUsd?: number | null;
  minUnits?: number;
  minNavUsd?: number;
  reason?: string;
};

type SizingResult = {
  nav: number;
  fetched_at: string;
  rows: SizingRow[];
};

export default function ConnectedAccountSizing({ accountKey }: { accountKey: string }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<SizingResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fxSet = new Set(PAIRS_BY_ASSET_CLASS.fx.map((row) => row.pair.toUpperCase()));

  async function runSizing() {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`/api/accounts/connected/${accountKey}/sizes`, {
        method: "POST",
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Sizing failed");
      }
      const data = (await response.json()) as SizingResult;
      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <section className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">
            1:1 Sizing Analysis (OANDA)
          </h2>
          <p className="text-sm text-[color:var(--muted)]">
            Calculates units per symbol based on current NAV.
          </p>
        </div>
        <button
          type="button"
          onClick={runSizing}
          disabled={loading}
          className="rounded-full border border-[var(--accent)] bg-[var(--accent)]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)] transition hover:bg-[var(--accent)]/20 disabled:opacity-60"
        >
          {loading ? "Analyzing..." : "Analyze sizes"}
        </button>
      </div>

      {loading ? (
        <div className="mt-4">
          <LimniLoading label="Analyzing position sizes" compact />
        </div>
      ) : null}

      {error ? (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50/60 p-3 text-xs uppercase tracking-[0.2em] text-rose-700">
          {error}
        </div>
      ) : null}

      {result ? (
        <div className="mt-4 space-y-3 text-sm">
          <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
            NAV used: {result.nav.toFixed(2)}
          </p>
          <div className="grid gap-2">
            {result.rows
              .filter((row) => fxSet.has(String(row.symbol ?? "").toUpperCase()))
              .map((row) => (
              <div
                key={row.symbol}
                className="grid grid-cols-2 gap-2 rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/70 px-3 py-2 text-xs md:grid-cols-6"
              >
                <span className="font-semibold text-[var(--foreground)]">{row.symbol}</span>
                <span className="text-[color:var(--muted)]">{row.instrument}</span>
                <span className={row.available ? "text-emerald-700" : "text-rose-700"}>
                  {row.available ? "OK" : "Missing"}
                </span>
                <span>{row.units !== undefined ? row.units : "--"} units</span>
                <span>{row.price !== undefined ? row.price.toFixed(5) : "--"}</span>
                <span>
                  {row.marginRate !== undefined && row.marginRate !== null
                    ? `${(row.marginRate * 100).toFixed(2)}%`
                    : "--"}
                </span>
                {row.reason ? (
                  <span
                    className={`col-span-2 md:col-span-6 ${
                      row.available ? "text-amber-600" : "text-rose-600"
                    }`}
                  >
                    {row.reason}
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </section>
  );
}
