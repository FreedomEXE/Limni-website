import { formatCurrencySafe } from "@/lib/formatters";
import { formatPercent } from "@/lib/accounts/viewUtils";
import { parseBasketFromComment } from "@/lib/accounts/mt5ViewHelpers";
import type { PlannedPair } from "@/lib/plannedTrades";

export type Mt5Position = {
  ticket: string | number;
  symbol: string;
  type: "BUY" | "SELL";
  lots: number;
  profit: number;
  swap: number;
  commission: number;
  comment: string;
  open_time: string;
  close_time: string;
};

export type ChangeLogEntry = {
  strategy?: string | null;
  title: string;
};

export type ClosedGroup = {
  key: string;
  symbol: string;
  type: "BUY" | "SELL";
  basket: string;
  openDate: string;
  trades: Mt5Position[];
  net: number;
  lots: number;
  closeTimeMin: string;
  closeTimeMax: string;
};

export function buildMt5ClosedGroups(filteredClosedPositions: Mt5Position[]): ClosedGroup[] {
  const groups = new Map<string, ClosedGroup>();
  for (const trade of filteredClosedPositions) {
    const basket = parseBasketFromComment(trade.comment) ?? "unknown";
    const openDate = trade.open_time.slice(0, 10);
    const key = `${basket}|${trade.symbol}|${trade.type}|${openDate}`;
    const net = trade.profit + trade.swap + trade.commission;
    const existing = groups.get(key);
    if (existing) {
      existing.trades.push(trade);
      existing.net += net;
      existing.lots += trade.lots;
      existing.closeTimeMin =
        existing.closeTimeMin < trade.close_time ? existing.closeTimeMin : trade.close_time;
      existing.closeTimeMax =
        existing.closeTimeMax > trade.close_time ? existing.closeTimeMax : trade.close_time;
    } else {
      groups.set(key, {
        key,
        symbol: trade.symbol,
        type: trade.type,
        basket,
        openDate,
        trades: [trade],
        net,
        lots: trade.lots,
        closeTimeMin: trade.close_time,
        closeTimeMax: trade.close_time,
      });
    }
  }
  return Array.from(groups.values()).sort((a, b) => b.net - a.net);
}

export function buildMt5JournalRows(
  recentLogs: string[] | null | undefined,
  changeLog: ChangeLogEntry[],
) {
  return [
    ...((recentLogs ?? []).map((log) => ({
      label: "Runtime",
      value: log,
    })) as Array<{ label: string; value: string }>),
    ...changeLog.map((entry) => ({
      label: entry.strategy ?? "Change",
      value: entry.title,
    })),
  ];
}

type PlannedPairWithDisplay = PlannedPair & {
  entryPrice?: number | null;
  stopLoss1pct?: number | null;
  units?: number | null;
  netUnits?: number | null;
  move1pctUsd?: number | null;
};

export function buildMt5DrawerPlannedPairs(plannedPairs: PlannedPair[]) {
  return plannedPairs.map((pair) => {
    const row = pair as PlannedPairWithDisplay;
    return {
      symbol: pair.symbol,
      assetClass: pair.assetClass,
      net: pair.net,
      legsCount: pair.legs.length,
      legs: pair.legs,
      entryPrice: row.entryPrice ?? null,
      stopLoss1pct: row.stopLoss1pct ?? null,
      units: row.units ?? null,
      netUnits: row.netUnits ?? null,
      move1pctUsd: row.move1pctUsd ?? null,
    };
  });
}

export type OpenPositionLike = {
  ticket: string | number;
  symbol: string;
  type: string;
  lots: number;
  profit: number;
  swap: number;
  commission: number;
  comment: string;
};

export function buildMt5DrawerOpenPositions(positions: OpenPositionLike[]) {
  return positions.map((pos) => ({
    symbol: pos.symbol,
    side: pos.type,
    lots: pos.lots,
    pnl: pos.profit + pos.swap + pos.commission,
    legs: [
      {
        id: pos.ticket,
        basket: parseBasketFromComment(pos.comment) ?? "unknown",
        side: pos.type,
        lots: pos.lots,
        pnl: pos.profit + pos.swap + pos.commission,
      },
    ],
  }));
}

export function buildMt5DrawerClosedGroups(closedGroups: ClosedGroup[]) {
  return closedGroups.map((group) => ({
    symbol: group.symbol,
    side: group.type,
    net: group.net,
    lots: group.lots,
    legs: group.trades.map((trade) => ({
      id: trade.ticket,
      basket: parseBasketFromComment(trade.comment) ?? "unknown",
      side: trade.type,
      lots: trade.lots,
      pnl: trade.profit + trade.swap + trade.commission,
      openTime: trade.open_time,
      closeTime: trade.close_time,
    })),
  }));
}

export type Mt5AccountLike = {
  equity: number;
  balance: number;
  currency: string;
  risk_used_pct: number;
  max_drawdown_pct: number;
  margin: number;
  free_margin: number;
};

export function buildMt5DrawerKpiRows(account: Mt5AccountLike, basketPnlToShow: number) {
  return [
    { label: "Equity", value: formatCurrencySafe(account.equity, account.currency) },
    { label: "Balance", value: formatCurrencySafe(account.balance, account.currency) },
    { label: "Basket PnL", value: formatPercent(basketPnlToShow) },
    { label: "Risk Used", value: formatPercent(account.risk_used_pct) },
    { label: "Max DD (all)", value: formatPercent(account.max_drawdown_pct) },
    { label: "Margin", value: formatCurrencySafe(account.margin, account.currency) },
    { label: "Free Margin", value: formatCurrencySafe(account.free_margin, account.currency) },
  ];
}
