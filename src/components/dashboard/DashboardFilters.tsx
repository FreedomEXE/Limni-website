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
  return (
    <form action="/dashboard" method="get" className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="view" value={selectedView} />
      <label className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
        Trading week
      </label>
      <select
        name="report"
        defaultValue={selectedReport}
        className="rounded-full border border-[var(--panel-border)] bg-[var(--panel)]/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
      >
        {reportOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

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
  );
}
