"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { AssetClass } from "@/lib/cotMarkets";

type ActionState = "cot" | "prices" | null;
type MessageState = { type: "success" | "error"; text: string } | null;

type RefreshControlProps = {
  lastRefreshUtc?: string | null;
  assetClass?: AssetClass | "all";
};

export default function RefreshControl({
  lastRefreshUtc,
  assetClass,
}: RefreshControlProps) {
  const router = useRouter();
  const [token, setToken] = useState("");
  const [loadingAction, setLoadingAction] = useState<ActionState>(null);
  const [message, setMessage] = useState<MessageState>(null);

  useEffect(() => {
    const stored = window.localStorage.getItem("limni.adminToken");
    if (stored) {
      setToken(stored);
    }
  }, []);

  useEffect(() => {
    if (token) {
      window.localStorage.setItem("limni.adminToken", token);
    }
  }, [token]);

  const handleRefresh = async (
    endpoint: string,
    label: Exclude<ActionState, null>,
  ) => {
    setLoadingAction(label);
    setMessage(null);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: token ? { "x-admin-token": token } : {},
      });

      const payload = await response.json();

      if (!response.ok) {
        setMessage({
          type: "error",
          text: payload?.error ?? "Refresh failed.",
        });
        return;
      }

      setMessage({ type: "success", text: "Refresh completed." });
      router.refresh();
    } catch (error) {
      setMessage({
        type: "error",
        text:
          error instanceof Error ? error.message : "Unexpected refresh error.",
      });
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="w-full max-w-sm rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-4 shadow-sm">
      <div className="flex flex-col gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
            Manual refresh
          </p>
          <p className="text-sm text-[color:var(--muted)]">
            COT last:{" "}
            {lastRefreshUtc && lastRefreshUtc.length > 0
              ? lastRefreshUtc
              : "No refresh yet"}
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <input
            type="password"
            placeholder="Admin token"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            className="rounded-lg border border-[var(--panel-border)] bg-white/80 px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--accent)]"
          />
          <button
            type="button"
            onClick={() =>
              handleRefresh(
                assetClass
                  ? `/api/cot/refresh?asset=${assetClass}`
                  : "/api/cot/refresh",
                "cot",
              )
            }
            disabled={loadingAction !== null}
            className="inline-flex items-center justify-center rounded-lg bg-[var(--accent)] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {loadingAction === "cot" ? "Refreshing COT..." : "Refresh COT data"}
          </button>
          <button
            type="button"
            onClick={() =>
              handleRefresh(
                assetClass
                  ? `/api/prices/refresh?asset=${assetClass}`
                  : "/api/prices/refresh",
                "prices",
              )
            }
            disabled={loadingAction !== null}
            className="inline-flex items-center justify-center rounded-lg border border-[var(--panel-border)] bg-white/80 px-3 py-2 text-sm font-semibold text-[color:var(--muted)] transition hover:border-[var(--accent)] hover:text-[color:var(--accent-strong)] disabled:cursor-not-allowed disabled:text-slate-400"
          >
            {loadingAction === "prices"
              ? "Refreshing prices..."
              : "Refresh prices"}
          </button>
        </div>
        {message ? (
          <p
            className={`text-sm ${
              message.type === "error" ? "text-rose-600" : "text-emerald-700"
            }`}
          >
            {message.text}
          </p>
        ) : null}
      </div>
    </div>
  );
}
