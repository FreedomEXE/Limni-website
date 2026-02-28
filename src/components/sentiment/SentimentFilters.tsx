"use client";

import ScrollableWeekStrip from "@/components/shared/ScrollableWeekStrip";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type SentimentFiltersProps = {
  weeks: string[];
  selectedWeek: string | null;
  currentWeekOpen: string;
  selectedAsset: string;
  assetOptions: Array<{ id: string; label: string }>;
};

export default function SentimentFilters({
  weeks,
  selectedWeek,
  currentWeekOpen,
  selectedAsset,
  assetOptions,
}: SentimentFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const navigateAsset = (asset: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("asset", asset);
    if (selectedWeek) {
      params.set("week", selectedWeek);
    } else {
      params.delete("week");
    }
    if (!params.has("view")) {
      params.set("view", "heatmap");
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="flex flex-col gap-3">
      {weeks.length > 0 ? (
        <ScrollableWeekStrip
          options={weeks}
          selected={selectedWeek ?? weeks[0]}
          currentWeek={currentWeekOpen}
          label="Week"
          preserveParams={["view", "asset"]}
        />
      ) : (
        <span className="text-xs text-[color:var(--muted)]">No weekly sentiment data yet.</span>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
          Asset class
        </label>
        <select
          value={selectedAsset}
          onChange={(event) => navigateAsset(event.target.value)}
          className="rounded-full border border-[var(--panel-border)] bg-[var(--panel)]/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          {assetOptions.map((asset) => (
            <option key={asset.id} value={asset.id}>
              {asset.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

