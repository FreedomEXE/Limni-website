/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: AntikytheraControls.tsx
 *
 * Description:
 * Client component for Antikythera page controls — report date strip
 * (ScrollableWeekStrip) + asset class dropdown + view toggle.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

"use client";

import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { DateTime } from "luxon";
import ScrollableWeekStrip from "@/components/shared/ScrollableWeekStrip";
import ViewToggle from "@/components/ViewToggle";

type ViewOption = "heatmap" | "list";

type AntikytheraControlsProps = {
  availableDates: string[];
  selectedReportDate: string | undefined;
  assetClasses: Array<{ id: string; label: string }>;
  selectedAsset: string | undefined;
  currentWeekOpenUtc?: string;
  view: ViewOption;
  viewItems: Array<{ value: ViewOption; label: string; href: string }>;
};

function reportDateLabel(date: string): string {
  const report = DateTime.fromISO(date, { zone: "America/New_York" });
  if (!report.isValid) return date;
  const daysUntilMonday = (8 - report.weekday) % 7;
  const monday = report
    .plus({ days: daysUntilMonday })
    .set({ hour: 0, minute: 0, second: 0, millisecond: 0 });
  return monday.toFormat("MMM dd");
}

export default function AntikytheraControls({
  availableDates,
  selectedReportDate,
  assetClasses,
  selectedAsset,
  currentWeekOpenUtc,
  view,
  viewItems,
}: AntikytheraControlsProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleAssetChange = (asset: string) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("asset", asset);
    if (selectedReportDate) params.set("report", selectedReportDate);
    params.set("view", view);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const isCurrentReportOption = (value: string) => {
    if (!currentWeekOpenUtc) return false;
    const report = DateTime.fromISO(value, { zone: "America/New_York" });
    if (!report.isValid) return false;
    const daysUntilMonday = (8 - report.weekday) % 7;
    const mondayUtc = report
      .plus({ days: daysUntilMonday })
      .set({ hour: 0, minute: 0, second: 0, millisecond: 0 })
      .toUTC()
      .toISO();
    return mondayUtc === currentWeekOpenUtc;
  };

  return (
    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <ScrollableWeekStrip
          options={availableDates}
          selected={selectedReportDate ?? availableDates[0] ?? ""}
          label="Trading week"
          paramName="report"
          preserveParams={["asset", "view"]}
          labelFormatter={reportDateLabel}
          isCurrentOption={(value) => isCurrentReportOption(String(value))}
          className="w-full"
        />
        <div className="flex items-center gap-2">
          <label className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
            Asset class
          </label>
          <select
            value={selectedAsset ?? "all"}
            onChange={(e) => handleAssetChange(e.target.value)}
            className="rounded-full border border-[var(--panel-border)] bg-[var(--panel)]/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
          >
            <option value="all">ALL</option>
            {assetClasses.map((asset) => (
              <option key={asset.id} value={asset.id}>
                {asset.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="shrink-0">
        <ViewToggle value={view} items={viewItems} />
      </div>
    </div>
  );
}
