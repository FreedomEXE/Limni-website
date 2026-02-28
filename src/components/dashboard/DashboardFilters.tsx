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
  reportOptions: Array<{ value: string; label: string }>;
  selectedAsset: string;
  selectedReport: string;
  selectedBias: "dealer" | "commercial";
  selectedView: "heatmap" | "list";
  currentWeekOpenUtc?: string;
};

export default function DashboardFilters({
  assetOptions,
  reportOptions,
  selectedAsset,
  selectedReport,
  selectedBias,
  selectedView,
  currentWeekOpenUtc,
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
    bias?: "dealer" | "commercial";
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
      {reportOptions.length > 0 ? (
        <ScrollableWeekStrip
          options={reportOptions.map((option) => option.value)}
          selected={selectedReport || reportOptions[0]?.value || ""}
          label="Trading week"
          paramName="report"
          preserveParams={["asset", "bias", "view"]}
          labelFormatter={(value) => reportLabelByValue.get(String(value)) ?? String(value)}
          isCurrentOption={(value) => isCurrentReportOption(String(value))}
          className="w-full"
        />
      ) : null}

      <div className="flex flex-wrap items-center gap-2">
        <label className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
          Asset class
        </label>
        <select
          value={selectedAsset}
          onChange={(event) => navigate({ asset: event.target.value })}
          className="rounded-full border border-[var(--panel-border)] bg-[var(--panel)]/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          <option value="all">ALL</option>
          {assetOptions.map((asset) => (
            <option key={asset.id} value={asset.id}>
              {asset.label}
            </option>
          ))}
        </select>

        <label className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
          Data type
        </label>
        <select
          value={selectedBias}
          onChange={(event) =>
            navigate({ bias: event.target.value === "commercial" ? "commercial" : "dealer" })
          }
          className="rounded-full border border-[var(--panel-border)] bg-[var(--panel)]/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          <option value="dealer">DEALER</option>
          <option value="commercial">COMMERCIAL</option>
        </select>
      </div>
    </div>
  );
}
