import ScrollableWeekStrip from "@/components/shared/ScrollableWeekStrip";

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
};

export default function DashboardFilters({
  assetOptions,
  reportOptions,
  selectedAsset,
  selectedReport,
  selectedBias,
  selectedView,
}: DashboardFiltersProps) {
  const reportLabelByValue = new Map(
    reportOptions.map((option) => [option.value, option.label]),
  );

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
          className="w-full"
        />
      ) : null}

      <form action="/dashboard" method="get" className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="view" value={selectedView} />
        <input type="hidden" name="report" value={selectedReport} />

        <label className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
          Asset class
        </label>
        <select
          name="asset"
          defaultValue={selectedAsset}
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
          name="bias"
          defaultValue={selectedBias}
          className="rounded-full border border-[var(--panel-border)] bg-[var(--panel)]/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          <option value="dealer">DEALER</option>
          <option value="commercial">COMMERCIAL</option>
        </select>

        <button
          type="submit"
          className="rounded-full border border-[var(--panel-border)] bg-[var(--panel)] px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
        >
          View
        </button>
      </form>
    </div>
  );
}
