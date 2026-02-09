import { formatCurrencySafe } from "@/lib/formatters";

const percentFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

export function formatPercent(value: number) {
  const sign = value > 0 ? "+" : value < 0 ? "" : "";
  return `${sign}${percentFormatter.format(value)}%`;
}

export function formatMaybePercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) {
    return "--";
  }
  return formatPercent(value);
}

export function formatMaybeCurrency(value: number | null, currency: string) {
  if (value === null || !Number.isFinite(value)) {
    return "--";
  }
  return formatCurrencySafe(value, currency);
}

export function pillTone(value: number, positive = true) {
  if (positive) {
    return value >= 0
      ? "border-emerald-200 bg-emerald-50 text-emerald-800"
      : "border-rose-200 bg-rose-50 text-rose-800";
  }
  return value <= 0
    ? "border-emerald-200 bg-emerald-50 text-emerald-800"
    : "border-rose-200 bg-rose-50 text-rose-800";
}

export function buildAccountCardHref(
  baseHref: string,
  weekParam: string | null,
  viewParam: string | null,
) {
  if (!weekParam && !viewParam) {
    return baseHref;
  }
  const params = new URLSearchParams();
  if (weekParam) params.set("week", weekParam);
  if (viewParam) params.set("view", viewParam);
  return `${baseHref}?${params.toString()}`;
}
