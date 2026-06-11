"use client";

import { useMemo } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

export type QueryBuilderSection = {
  label: string;
  paramKey: string;
  options: Array<{ value: string; label: string }>;
  selected: string[];
  multiple?: boolean;
};

type QueryBuilderProps = {
  title?: string;
  mode?: "isolate" | "compare";
  sections: QueryBuilderSection[];
  weekParam?: string | null;
};

function toggleValue(list: string[], value: string) {
  if (list.includes(value)) {
    return list.filter((item) => item !== value);
  }
  return [...list, value];
}

export default function QueryBuilder({
  title = "Analysis filters",
  mode = "compare",
  sections,
  weekParam,
}: QueryBuilderProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const hasSelections = useMemo(
    () => sections.some((section) => section.selected.length > 0),
    [sections],
  );

  const updateParams = (next: URLSearchParams) => {
    if (weekParam) {
      next.set("week", weekParam);
    }
    router.push(`${pathname}?${next.toString()}`);
  };

  const setMode = (nextMode: "isolate" | "compare") => {
    const next = new URLSearchParams(searchParams.toString());
    next.set("mode", nextMode);
    updateParams(next);
  };

  const toggleOption = (section: QueryBuilderSection, value: string) => {
    const next = new URLSearchParams(searchParams.toString());
    const current = section.selected;
    const updated = section.multiple === false ? [value] : toggleValue(current, value);
    if (updated.length === 0) {
      next.delete(section.paramKey);
    } else {
      next.set(section.paramKey, updated.join(","));
    }
    updateParams(next);
  };

  const clearAll = () => {
    const next = new URLSearchParams(searchParams.toString());
    sections.forEach((section) => next.delete(section.paramKey));
    updateParams(next);
  };

  return (
    <div className="rounded-2xl border border-[var(--panel-border)] bg-[var(--panel)]/70 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
            {title}
          </p>
          <p className="mt-1 text-sm text-[color:var(--muted)]">
            Mix & match filters. Use isolate to view a single segment, compare to overlay.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em]">
          <button
            type="button"
            onClick={() => setMode("compare")}
            className={`rounded-full border px-3 py-1 ${
              mode === "compare"
                ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent-strong)]"
                : "border-[var(--panel-border)] text-[color:var(--muted)]"
            }`}
          >
            Compare
          </button>
          <button
            type="button"
            onClick={() => setMode("isolate")}
            className={`rounded-full border px-3 py-1 ${
              mode === "isolate"
                ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent-strong)]"
                : "border-[var(--panel-border)] text-[color:var(--muted)]"
            }`}
          >
            Isolate
          </button>
          {hasSelections ? (
            <button
              type="button"
              onClick={clearAll}
              className="rounded-full border border-[var(--panel-border)] px-3 py-1 text-[color:var(--muted)]"
            >
              Clear
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        {sections.map((section) => (
          <div key={section.paramKey}>
            <p className="text-[10px] uppercase tracking-[0.2em] text-[color:var(--muted)]">
              {section.label}
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {section.options.map((option) => {
                const active = section.selected.includes(option.value);
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => toggleOption(section, option.value)}
                    className={`rounded-full border px-3 py-1 text-xs font-semibold transition ${
                      active
                        ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent-strong)]"
                        : "border-[var(--panel-border)] text-[color:var(--muted)] hover:text-[var(--foreground)]"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
