"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";

type PerformancePeriodSelectorProps = {
  mode: "week" | "report";
  options: Array<{ value: string; label: string }>;
  selectedValue: string;
};

export default function PerformancePeriodSelector({
  mode,
  options,
  selectedValue,
}: PerformancePeriodSelectorProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const onChange = (nextValue: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (mode === "week") {
      params.set("week", nextValue);
      params.delete("report");
    } else {
      params.set("report", nextValue);
      params.delete("week");
    }
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="flex flex-wrap items-center gap-3">
      <label className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
        {mode === "week" ? "Week" : "Report week"}
      </label>
      <select
        value={selectedValue}
        onChange={(event) => onChange(event.target.value)}
        className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/80 px-3 py-2 text-sm text-[var(--foreground)]"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

