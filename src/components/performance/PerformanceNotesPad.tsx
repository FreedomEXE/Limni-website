"use client";

import { useEffect, useMemo, useState } from "react";

type PerformanceNotesPadProps = {
  selectedWeek: string;
  strategyDescription: string | null;
  notesStorageKey: string;
};

function weekLabel(selectedWeek: string) {
  if (selectedWeek === "all") return "All Time";
  const parsed = new Date(selectedWeek);
  if (Number.isNaN(parsed.getTime())) return selectedWeek;
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function PerformanceNotesPad({
  selectedWeek,
  strategyDescription,
  notesStorageKey,
}: PerformanceNotesPadProps) {
  const isAllTime = selectedWeek === "all";
  const storageKey = useMemo(
    () => `limni-performance-notes:${notesStorageKey}:${selectedWeek}`,
    [notesStorageKey, selectedWeek],
  );
  const [savedNotes, setSavedNotes] = useState("");
  const [draftNotes, setDraftNotes] = useState("");
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");

  useEffect(() => {
    if (typeof window === "undefined" || isAllTime) {
      setSavedNotes("");
      setDraftNotes("");
      return;
    }
    const existing = localStorage.getItem(storageKey) ?? "";
    setSavedNotes(existing);
    setDraftNotes(existing);
  }, [isAllTime, storageKey]);

  useEffect(() => {
    if (copyState !== "copied") return;
    const timeout = window.setTimeout(() => setCopyState("idle"), 1500);
    return () => window.clearTimeout(timeout);
  }, [copyState]);

  const copyValue = async () => {
    const text = isAllTime ? (strategyDescription ?? "") : draftNotes;
    if (!text.trim()) return;
    await navigator.clipboard.writeText(text);
    setCopyState("copied");
  };

  const saveNotes = () => {
    localStorage.setItem(storageKey, draftNotes);
    setSavedNotes(draftNotes);
  };

  const clearNotes = () => {
    localStorage.removeItem(storageKey);
    setSavedNotes("");
    setDraftNotes("");
  };

  const isDirty = draftNotes !== savedNotes;
  const displayValue = isAllTime
    ? (strategyDescription ?? "No strategy description available.")
    : draftNotes;

  return (
    <section className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)] p-6 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-[color:var(--muted)]">
            {isAllTime ? "Strategy Notes" : "Week Notes"}
          </p>
          <h2 className="mt-2 text-xl font-semibold text-[var(--foreground)]">
            {isAllTime ? "Strategy Description" : `Notes for ${weekLabel(selectedWeek)}`}
          </h2>
          <p className="mt-1 text-sm text-[color:var(--muted)]">
            {isAllTime
              ? "Reference note for the selected strategy."
              : "Scratchpad for week-specific observations and execution notes."}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void copyValue()}
            className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
          >
            {copyState === "copied" ? "Copied" : "Copy"}
          </button>
          {!isAllTime ? (
            <>
              <button
                type="button"
                onClick={saveNotes}
                disabled={!isDirty}
                className={`rounded-lg border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] transition ${
                  isDirty
                    ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent-strong)] hover:bg-[var(--accent)]/20"
                    : "cursor-not-allowed border-[var(--panel-border)] bg-[var(--panel)] text-[color:var(--muted)]/60"
                }`}
              >
                Save
              </button>
              <button
                type="button"
                onClick={clearNotes}
                className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.14em] text-[color:var(--muted)] transition hover:border-rose-400 hover:text-rose-700"
              >
                Clear
              </button>
            </>
          ) : null}
        </div>
      </div>

      <div className="mt-5 rounded-2xl border border-[var(--panel-border)] bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01))] p-4">
        <textarea
          value={displayValue}
          onChange={(event) => {
            if (isAllTime) return;
            setDraftNotes(event.target.value);
          }}
          readOnly={isAllTime}
          placeholder={isAllTime ? "" : "Add notes for this week..."}
          spellCheck={false}
          className="min-h-[360px] w-full resize-y border-0 bg-transparent bg-[repeating-linear-gradient(180deg,transparent,transparent_31px,rgba(148,163,184,0.18)_31px,rgba(148,163,184,0.18)_32px)] px-1 py-1 text-sm leading-8 text-[var(--foreground)] outline-none placeholder:text-[color:var(--muted)]"
        />
      </div>
    </section>
  );
}
