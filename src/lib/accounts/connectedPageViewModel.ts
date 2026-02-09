import { formatCurrencySafe } from "@/lib/formatters";
import { formatPercent } from "@/lib/accounts/viewUtils";
import { getDefaultWeek, type WeekOption } from "@/lib/weekState";
import type { PlannedPair } from "@/lib/plannedTrades";
import type { AccountWeekStats } from "@/lib/accountStats";

type PlannedPairDisplay = PlannedPair & {
  units?: number;
  netUnits?: number;
  move1pctUsd?: number;
  sizeDisplay?: string | null;
  riskDisplay?: string | null;
};

export function resolveConnectedSelectedWeek(options: {
  weekParamValue: string | null;
  weekOptionsWithUpcoming: WeekOption[];
  currentWeekOpenUtc: string;
}): WeekOption {
  const { weekParamValue, weekOptionsWithUpcoming, currentWeekOpenUtc } = options;
  return weekParamValue === "all"
    ? "all"
    : typeof weekParamValue === "string" && weekOptionsWithUpcoming.includes(weekParamValue)
      ? weekParamValue
      : getDefaultWeek(weekOptionsWithUpcoming, currentWeekOpenUtc);
}

export function resolveConnectedTradeModeLabel(config: Record<string, unknown> | null): string {
  return typeof config?.trade_mode === "string"
    ? String(config.trade_mode).toUpperCase()
    : "AUTO";
}

export function buildConnectedDrawerPlannedPairs(plannedPairs: PlannedPair[]) {
  return plannedPairs.map((pair) => ({
    symbol: pair.symbol,
    assetClass: pair.assetClass,
    net: pair.net,
    legsCount: pair.legs.length,
    legs: pair.legs,
    units: "units" in pair ? (pair as PlannedPairDisplay).units : null,
    netUnits: "netUnits" in pair ? (pair as PlannedPairDisplay).netUnits : null,
    move1pctUsd: "move1pctUsd" in pair ? (pair as PlannedPairDisplay).move1pctUsd : null,
    sizeDisplay: "sizeDisplay" in pair ? (pair as PlannedPairDisplay).sizeDisplay : null,
    riskDisplay: "riskDisplay" in pair ? (pair as PlannedPairDisplay).riskDisplay : null,
  }));
}

export function buildConnectedDrawerKpiRows(
  stats: AccountWeekStats,
  accountCurrency: string,
) {
  return [
    { label: "Equity", value: formatCurrencySafe(stats.equity, accountCurrency) },
    { label: "Balance", value: formatCurrencySafe(stats.balance, accountCurrency) },
    { label: "Basket PnL", value: formatPercent(stats.basketPnlPct) },
    {
      label: "Locked Profit",
      value: stats.lockedProfitPct !== null ? formatPercent(stats.lockedProfitPct) : "—",
    },
    { label: "Leverage", value: stats.leverage ? `${stats.leverage}x` : "—" },
    {
      label: "Margin",
      value: stats.margin ? formatCurrencySafe(stats.margin, accountCurrency) : "—",
    },
    {
      label: "Free Margin",
      value: stats.freeMargin ? formatCurrencySafe(stats.freeMargin, accountCurrency) : "—",
    },
    {
      label: "Risk Used",
      value: stats.riskUsedPct ? formatPercent(stats.riskUsedPct) : "—",
    },
  ];
}
