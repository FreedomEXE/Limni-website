"use client";

import ScrollableWeekStrip from "@/components/shared/ScrollableWeekStrip";
import { DateTime } from "luxon";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type AssetOption = {
  id: string;
  label: string;
};

type DashboardFiltersProps = {
  assetOptions: AssetOption[];
  reportOptions: Array<{
    value: string;
    label: string;
  }>;
  selectedAsset: string;
  selectedReport: string;
  selectedBias: "dealer" | "commercial" | "sentiment" | "strength";
  selectedView: "heatmap" | "list";
  currentWeekOpenUtc?: string;
  onAssetChange?: (asset: string) => void;
  onReportChange?: (report: string) => void;
  onBiasChange?: (bias: "dealer" | "commercial" | "sentiment" | "strength") => void;
};

export default function DashboardFilters({
  assetOptions,
  reportOptions,
  selectedAsset,
  selectedReport,
  selectedBias,
  selectedView,
  currentWeekOpenUtc,
  onAssetChange,
  onReportChange,
  onBiasChange,
}: DashboardFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const reportLabelByValue = new Map(
    reportOptions.map((option) => [option.value, option.label]),
  );
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

  const navigate = (next: {
    asset?: string;
    bias?: "dealer" | "commercial" | "sentiment" | "strength";
    view?: "heatmap" | "list";
    report?: string;
  }) => {
    const params = new URLSearchParams(searchParams.toString());
    const report = next.report ?? selectedReport;
    if (report && report.length > 0) {
      params.set("report", report);
    } else {
      params.delete("report");
    }
    params.set("asset", next.asset ?? selectedAsset);
    params.set("bias", next.bias ?? selectedBias);
    params.set("view", next.view ?? selectedView);
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="flex min-w-0 flex-1 flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        {([
          { value: "dealer", label: "Dealer" },
          { value: "commercial", label: "Commercial" },
          { value: "sentiment", label: "Sentiment" },
          { value: "strength", label: "Strength" },
        ] as const).map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => {
              if (option.value === selectedBias) {
                return;
              }
              if (onBiasChange) {
                onBiasChange(option.value);
                return;
              }
              navigate({ bias: option.value });
            }}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.15em] transition ${
              selectedBias === option.value
                ? "border-[var(--accent)] bg-[var(--accent)]/10 text-[var(--accent-strong)]"
                : "border-[var(--panel-border)] bg-[var(--panel)]/70 text-[color:var(--muted)] hover:border-[var(--accent)]/50 hover:text-[var(--foreground)]"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {reportOptions.length > 0 ? (
        <div>
          <ScrollableWeekStrip
            options={reportOptions.map((option) => option.value)}
            selected={selectedReport || reportOptions[0]?.value || ""}
            label={null}
            paramName="report"
            preserveParams={["asset", "bias", "view"]}
            labelFormatter={(value) => reportLabelByValue.get(String(value)) ?? String(value)}
            isCurrentOption={(value) => isCurrentReportOption(String(value))}
            onChange={onReportChange ? (value) => onReportChange(String(value)) : undefined}
            className="w-full"
          />
        </div>
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <select
          value={selectedAsset}
          onChange={(event) => {
            if (onAssetChange) {
              onAssetChange(event.target.value);
              return;
            }
            navigate({ asset: event.target.value });
          }}
          className="rounded-full border border-[var(--panel-border)] bg-[var(--panel)]/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          <option value="all">ALL</option>
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
