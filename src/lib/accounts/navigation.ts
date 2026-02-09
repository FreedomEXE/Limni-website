export type AccountPageView = "overview" | "trades" | "analytics";

export function pickQueryParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export function resolveAccountView(value: string | null | undefined): AccountPageView {
  if (value === "equity") return "overview";
  if (value === "positions") return "trades";
  if (value === "settings") return "analytics";
  if (value === "overview" || value === "trades" || value === "analytics") return value;
  return "overview";
}

export type AccountQueryParams =
  | Record<string, string | string[] | undefined>
  | null
  | undefined;

export function resolveCommonAccountSearchParams(searchParams: AccountQueryParams) {
  const week = pickQueryParam(searchParams?.week) ?? null;
  const view = resolveAccountView(pickQueryParam(searchParams?.view));
  return { week, view };
}

export function resolveMt5TradeFilters(searchParams: AccountQueryParams) {
  const basketFilter = (pickQueryParam(searchParams?.basket) ?? "").toLowerCase();
  const symbolFilter = (pickQueryParam(searchParams?.symbol) ?? "").toUpperCase();
  return { basketFilter, symbolFilter };
}
