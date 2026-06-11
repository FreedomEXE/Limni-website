"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type RiskMode = "god" | "normal" | "low";

function normalizeRiskMode(rawRiskMode: string | null | undefined): RiskMode {
  const mode = String(rawRiskMode ?? "").trim().toLowerCase();
  if (["god", "high", "high_legacy", "1:1", "aggressive"].includes(mode)) return "god";
  if (["low", "0.1:1", "0.10:1", "reduced_low"].includes(mode)) return "low";
  return "normal";
}

export default function ConnectedAccountRiskSettings(options: {
  accountKey: string;
  riskMode: string | null | undefined;
}) {
  const { accountKey, riskMode } = options;
  const router = useRouter();
  const [mode, setMode] = useState<RiskMode>(normalizeRiskMode(riskMode));
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function saveRiskMode() {
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/accounts/connected/${encodeURIComponent(accountKey)}/settings`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ riskMode: mode }),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Failed to update risk mode");
      }
      setMessage("Risk mode saved.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--foreground)]">Account Risk Mode</h2>
          <p className="text-sm text-[color:var(--muted)]">
            Sets the default manual execution profile for this account.
          </p>
        </div>
        <button
          type="button"
          onClick={saveRiskMode}
          disabled={saving}
          className="rounded-full border border-[var(--accent)] bg-[var(--accent)]/10 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-strong)] transition hover:bg-[var(--accent)]/20 disabled:opacity-60"
        >
          {saving ? "Saving..." : "Save"}
        </button>
      </div>

      <div className="mt-4 grid gap-3 md:max-w-xs">
        <label className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
          Risk Mode
          <select
            value={mode}
            onChange={(event) => setMode(event.target.value as RiskMode)}
            className="mt-2 w-full rounded-xl border border-[var(--panel-border)] bg-[var(--panel)] p-2 text-sm font-semibold uppercase tracking-[0.12em] text-[var(--foreground)]"
          >
            <option value="god">God</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>
        </label>
      </div>

      {message ? (
        <p className="mt-3 text-xs uppercase tracking-[0.2em] text-emerald-600">{message}</p>
      ) : null}
      {error ? (
        <p className="mt-3 text-xs uppercase tracking-[0.2em] text-rose-700">{error}</p>
      ) : null}
    </section>
  );
}

