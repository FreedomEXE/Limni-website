"use client";

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
};

function buildUrl(
  pathname: string,
  searchParams: URLSearchParams,
  next: {
    asset?: string;
    report?: string;
    bias?: "dealer" | "commercial";
  },
) {
  const params = new URLSearchParams(searchParams.toString());
  const asset = next.asset ?? params.get("asset") ?? "all";
  const report = next.report ?? params.get("report") ?? "";
  const bias = next.bias ?? (params.get("bias") === "commercial" ? "commercial" : "dealer");

  params.set("asset", asset);
  params.set("bias", bias);
  if (report) {
    params.set("report", report);
  } else {
    params.delete("report");
  }

  return `${pathname}?${params.toString()}`;
}

export default function DashboardFilters({
  assetOptions,
  reportOptions,
  selectedAsset,
  selectedReport,
  selectedBias,
}: DashboardFiltersProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const onAssetChange = (value: string) => {
    const url = buildUrl(pathname, new URLSearchParams(searchParams.toString()), {
      asset: value,
      report: "",
    });
    router.replace(url, { scroll: false });
  };

  const onReportChange = (value: string) => {
    const url = buildUrl(pathname, new URLSearchParams(searchParams.toString()), {
      report: value,
    });
    router.replace(url, { scroll: false });
  };

  const onBiasChange = (value: "dealer" | "commercial") => {
    const url = buildUrl(pathname, new URLSearchParams(searchParams.toString()), {
      bias: value,
    });
    router.replace(url, { scroll: false });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <label className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
        Asset class
      </label>
      <select
        value={selectedAsset}
        onChange={(event) => onAssetChange(event.target.value)}
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
        Trading week
      </label>
      <select
        value={selectedReport}
        onChange={(event) => onReportChange(event.target.value)}
        className="rounded-full border border-[var(--panel-border)] bg-[var(--panel)]/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
      >
        {reportOptions.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      <label className="text-xs uppercase tracking-[0.2em] text-[color:var(--muted)]">
        Data type
      </label>
      <select
        value={selectedBias}
        onChange={(event) => onBiasChange(event.target.value as "dealer" | "commercial")}
        className="rounded-full border border-[var(--panel-border)] bg-[var(--panel)]/80 px-3 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[color:var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent)]"
      >
        <option value="dealer">DEALER</option>
        <option value="commercial">COMMERCIAL</option>
      </select>
    </div>
  );
}
