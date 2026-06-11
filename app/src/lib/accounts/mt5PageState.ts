import {
  applyPositionFilters,
  collectPositionFilterOptions,
  filterFxPositions,
} from "@/lib/accounts/mt5ViewHelpers";
import type { Mt5Position, OpenPositionLike } from "@/lib/accounts/mt5PageViewModel";

type Mt5Net = { net: number; trades: number };

type Mt5AccountState = {
  label?: string;
  broker?: string;
  server?: string;
  trade_mode?: string;
  balance: number;
  equity: number;
  baseline_equity?: number;
  data_source?: string;
  reconstruction_status?: string;
  weekly_pnl_pct?: number;
  basket_pnl_pct?: number;
  positions?: OpenPositionLike[];
};

export function shouldForceFxOnlyPlanned(account: Mt5AccountState): boolean {
  const fxOnlyHint = `${account?.label ?? ""} ${account?.broker ?? ""} ${account?.server ?? ""}`.toLowerCase();
  return (account?.trade_mode ?? "AUTO").toUpperCase() === "MANUAL" && fxOnlyHint.includes("5ers");
}

export function deriveMt5PnlDisplay(account: Mt5AccountState, currentWeekNet: Mt5Net) {
  const openFloatingPnl = (account.positions ?? []).reduce((acc: number, position) => {
    const profit = Number(position?.profit ?? 0);
    const swap = Number(position?.swap ?? 0);
    const commission = Number(position?.commission ?? 0);
    return acc +
      (Number.isFinite(profit) ? profit : 0) +
      (Number.isFinite(swap) ? swap : 0) +
      (Number.isFinite(commission) ? commission : 0);
  }, 0);
  const inferredStartBalance =
    account.balance - currentWeekNet.net > 0 ? account.balance - currentWeekNet.net : account.balance;
  const fixedBaseline =
    Number(account.baseline_equity ?? 0) > 0 ? Number(account.baseline_equity ?? 0) : inferredStartBalance;
  const derivedWeeklyPnlPct =
    fixedBaseline > 0 ? (currentWeekNet.net / fixedBaseline) * 100 : 0;
  const derivedBasketPnlPct =
    Number(account.baseline_equity ?? 0) > 0
      ? ((account.equity - Number(account.baseline_equity ?? 0)) / Number(account.baseline_equity ?? 0)) * 100
      : derivedWeeklyPnlPct + (fixedBaseline > 0 ? (openFloatingPnl / fixedBaseline) * 100 : 0);

  const weeklyPnlToShow =
    currentWeekNet.trades > 0 || Number(account.baseline_equity ?? 0) > 0
      ? derivedWeeklyPnlPct
      : Number(account.weekly_pnl_pct ?? 0);
  const basketPnlToShow =
    Math.abs(Number(account.basket_pnl_pct ?? 0)) > 0.001 ||
    Math.abs(Number(account.baseline_equity ?? 0)) > 0.001
      ? Number(account.basket_pnl_pct ?? 0)
      : derivedBasketPnlPct;

  return {
    weeklyPnlToShow,
    basketPnlToShow,
  };
}

export function buildMt5FilteredPositions(options: {
  openPositions: OpenPositionLike[];
  closedPositions: Mt5Position[];
  forceFxOnlyPlanned: boolean;
  basketFilter: string;
  symbolFilter: string;
}) {
  const { openPositions, closedPositions, forceFxOnlyPlanned, basketFilter, symbolFilter } = options;
  const baseOpenPositions = forceFxOnlyPlanned ? filterFxPositions(openPositions) : openPositions;
  const baseClosedPositions = forceFxOnlyPlanned ? filterFxPositions(closedPositions) : closedPositions;
  const { basketOptions, symbolOptions } = collectPositionFilterOptions([
    ...baseOpenPositions,
    ...baseClosedPositions,
  ]);
  const effectiveBasketFilter =
    basketFilter && basketOptions.includes(basketFilter) ? basketFilter : "";
  const effectiveSymbolFilter =
    symbolFilter && symbolOptions.includes(symbolFilter) ? symbolFilter : "";

  const filteredOpenPositions = applyPositionFilters({
    positions: baseOpenPositions,
    basketFilter: effectiveBasketFilter,
    symbolFilter: effectiveSymbolFilter,
  });
  const filteredClosedPositions = applyPositionFilters({
    positions: baseClosedPositions,
    basketFilter: effectiveBasketFilter,
    symbolFilter: effectiveSymbolFilter,
  });

  return {
    filteredOpenPositions,
    filteredClosedPositions,
    basketOptions,
    symbolOptions,
    effectiveBasketFilter,
    effectiveSymbolFilter,
  };
}
