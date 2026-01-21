"use client";

import { useState } from "react";

export default function RefreshSentimentButton() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleRefresh() {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/sentiment/refresh", {
        method: "POST",
        headers: {
          "x-admin-token": prompt("Enter admin token:") || "",
        },
      });

      const data = await response.json();

      if (response.ok) {
        setMessage(
          `Refreshed. Collected ${data.snapshots_collected} snapshots, computed ${data.aggregates_computed} aggregates.`,
        );
        setTimeout(() => {
          window.location.reload();
        }, 1500);
      } else {
        setMessage(`Error: ${data.error || "Refresh failed"}`);
      }
    } catch (error) {
      setMessage(`Error: ${error instanceof Error ? error.message : "Unknown error"}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={handleRefresh}
        disabled={loading}
        className="w-full rounded-lg bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)] disabled:bg-[var(--panel-border)]"
      >
        {loading ? "Refreshing..." : "Refresh sentiment data"}
      </button>
      {message && (
        <p className="mt-2 text-xs text-[var(--muted)]">{message}</p>
      )}
    </div>
  );
}
