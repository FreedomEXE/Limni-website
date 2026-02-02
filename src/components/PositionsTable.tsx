"use client";

import { useState } from "react";
import type { Mt5Position } from "@/lib/mt5Store";
import { formatCurrencySafe } from "@/lib/formatters";
import { formatDateTimeET } from "@/lib/time";

type PositionGroup = {
  symbol: string;
  positions: Mt5Position[];
  totalLots: number;
  totalProfit: number;
  avgOpenPrice: number;
  netExposure: number; // positive = net long, negative = net short
  riskAmount: number; // sum of potential loss from SL in dollars
  riskPct: number; // risk as percentage of equity
};

type PositionsTableProps = {
  positions: Mt5Position[];
  currency: string;
  equity: number;
};

function groupPositionsBySymbol(positions: Mt5Position[], equity: number): PositionGroup[] {
  const groups = new Map<string, Mt5Position[]>();

  for (const pos of positions) {
    const existing = groups.get(pos.symbol) || [];
    existing.push(pos);
    groups.set(pos.symbol, existing);
  }

  const result: PositionGroup[] = [];

  for (const [symbol, symbolPositions] of groups) {
    const totalLots = symbolPositions.reduce((sum, p) => sum + p.lots, 0);
    const totalProfit = symbolPositions.reduce((sum, p) => sum + p.profit, 0);

    let weightedPriceSum = 0;
    let netExposure = 0;
    let riskAmount = 0;

    for (const pos of symbolPositions) {
      weightedPriceSum += pos.open_price * pos.lots;

      const lotMultiplier = pos.type === "BUY" ? 1 : -1;
      netExposure += pos.lots * lotMultiplier;

      // Calculate risk based on actual SL
      if (pos.stop_loss > 0) {
        // Calculate what the P&L would be if price hits the stop loss
        // We can derive this from the current profit and price movement

        const currentPrice = pos.current_price;
        const openPrice = pos.open_price;
        const stopLoss = pos.stop_loss;
        const currentProfit = pos.profit;

        // Calculate pip movement from open to current
        const currentMove = currentPrice - openPrice;
        // Calculate pip movement from open to SL
        const slMove = stopLoss - openPrice;

        // If there's current movement, we can calculate dollar per pip
        if (Math.abs(currentMove) > 0.00001) {
          const dollarPerPip = currentProfit / currentMove;
          const slProfit = dollarPerPip * slMove;

          // Risk is the loss if SL hits (negative value becomes positive risk)
          const positionRisk = Math.abs(Math.min(0, slProfit));
          riskAmount += positionRisk;
        } else {
          // Fallback: estimate based on lot size
          // For most pairs, 0.01 lot with 10% SL ~ $130 risk
          const slDistance = Math.abs(openPrice - stopLoss);
          const slPercentage = slDistance / openPrice;
          const estimatedRisk = pos.lots * 100000 * slPercentage * 0.01; // Rough estimate
          riskAmount += estimatedRisk;
        }
      }
    }

    const avgOpenPrice = weightedPriceSum / totalLots;
    const riskPct = equity > 0 ? (riskAmount / equity) * 100 : 0;

    result.push({
      symbol,
      positions: symbolPositions,
      totalLots,
      totalProfit,
      avgOpenPrice,
      netExposure,
      riskAmount,
      riskPct,
    });
  }

  return result.sort((a, b) => b.totalProfit - a.totalProfit);
}

function formatPrice(value: number, symbol: string) {
  const isJPY = symbol.includes("JPY");
  return value.toFixed(isJPY ? 3 : 5);
}

function calculateOnePercentImpact(pos: Mt5Position): number {
  const openPrice = pos.open_price;
  const currentPrice = pos.current_price;
  const currentProfit = pos.profit;

  // Calculate current % move
  const priceMove = currentPrice - openPrice;
  const movePct = (priceMove / openPrice) * 100;

  // If there's meaningful movement, use it to calculate profit per 1%
  if (Math.abs(movePct) > 0.001) {
    const profitPerPercent = currentProfit / movePct;
    return profitPerPercent;
  }

  // Fallback: estimate based on typical contract sizes
  // Standard lot (1.0) = 100,000 units for forex
  // 1% move on 1 standard lot ≈ $1,000 for major pairs
  const isIndex = pos.symbol.includes("SPX") || pos.symbol.includes("NDX") || pos.symbol.includes("JPN");
  const isCrypto = pos.symbol.includes("BTC") || pos.symbol.includes("ETH");

  if (isIndex) {
    // For indices, 1% of contract value = lots × current_price × contract_multiplier × 0.01
    // SPX500/NDX100 typically 1 lot = $1 per point, so 1% ≈ price × 0.01 per lot
    return pos.lots * currentPrice * 0.01;
  } else if (isCrypto) {
    // Crypto: 1 lot = 1 coin typically
    return pos.lots * currentPrice * 0.01;
  } else {
    // FX/Commodities: rough estimate $10 per pip, ~100 pips = 1%
    const estimatedPipsPerPercent = 100;
    const estimatedDollarPerPip = 10 * pos.lots / 0.01; // Scale by lot size
    return estimatedDollarPerPip * estimatedPipsPerPercent * 0.01;
  }
}

function extractModel(comment: string): string {
  // Format: "LimniBasket {model} {report_date}"
  const match = comment.match(/LimniBasket\s+(\w+)/i);
  return match ? match[1] : "";
}

function getModelColor(model: string): string {
  const normalized = model.toLowerCase();
  switch (normalized) {
    case "antikythera": return "text-purple-600";
    case "blended": return "text-blue-600";
    case "commercial": return "text-emerald-600";
    case "dealer": return "text-amber-600";
    case "sentiment": return "text-rose-600";
    default: return "text-gray-600";
  }
}

function calculateMinAccountSize(positions: Mt5Position[], currentEquity: number): {
  minAccount: number;
  constraintSymbol: string;
  constraintData: { symbol: string; currentLot: number; minLot: number; requiredEquity: number }[];
} {
  const symbolData = new Map<string, { lots: number; minVol: number }>();

  // Aggregate positions by symbol
  for (const pos of positions) {
    if (!pos.min_volume || pos.min_volume <= 0) continue;

    const existing = symbolData.get(pos.symbol);
    if (existing) {
      existing.lots += pos.lots;
    } else {
      symbolData.set(pos.symbol, { lots: pos.lots, minVol: pos.min_volume });
    }
  }

  let maxRequiredEquity = 0;
  let constraintSymbol = "";
  const constraintData: { symbol: string; currentLot: number; minLot: number; requiredEquity: number }[] = [];

  for (const [symbol, data] of symbolData) {
    // Required equity = (minLot / currentLot) × currentEquity
    const requiredEquity = (data.minVol / data.lots) * currentEquity;

    constraintData.push({
      symbol,
      currentLot: data.lots,
      minLot: data.minVol,
      requiredEquity,
    });

    if (requiredEquity > maxRequiredEquity) {
      maxRequiredEquity = requiredEquity;
      constraintSymbol = symbol;
    }
  }

  // Sort by required equity descending
  constraintData.sort((a, b) => b.requiredEquity - a.requiredEquity);

  return {
    minAccount: maxRequiredEquity,
    constraintSymbol,
    constraintData: constraintData.slice(0, 10), // Top 10 constraints
  };
}

export default function PositionsTable({ positions, currency, equity }: PositionsTableProps) {
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [hoveredPosition, setHoveredPosition] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<"pnl" | "symbol">("pnl");

  if (!positions || positions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--panel-border)] bg-[var(--panel)]/60 p-8 text-center text-sm text-[color:var(--muted)]">
        <p className="font-semibold">No open positions</p>
        <p className="mt-2">Positions will appear here when trades are opened.</p>
      </div>
    );
  }

  const groups = groupPositionsBySymbol(positions, equity);

  // Apply sorting
  const sortedGroups = [...groups].sort((a, b) => {
    if (sortBy === "symbol") {
      return a.symbol.localeCompare(b.symbol);
    }
    return b.totalProfit - a.totalProfit; // P&L descending
  });

  const totalProfit = positions.reduce((sum, p) => sum + p.profit, 0);
  const totalRisk = groups.reduce((sum, g) => sum + g.riskAmount, 0);
  const totalRiskPct = equity > 0 ? (totalRisk / equity) * 100 : 0;

  // Calculate minimum account size
  const minAccountCalc = calculateMinAccountSize(positions, equity);
  const hasMinVolData = positions.some(p => p.min_volume && p.min_volume > 0);

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/80 p-4">
          <p className="text-xs uppercase tracking-wider text-[color:var(--muted)]">Total P&L</p>
          <p className={`mt-1 text-xl font-semibold ${totalProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            {formatCurrencySafe(totalProfit, currency)}
          </p>
        </div>
        <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/80 p-4">
          <p className="text-xs uppercase tracking-wider text-[color:var(--muted)]">Pairs traded</p>
          <p className="mt-1 text-xl font-semibold text-[var(--foreground)]">{groups.length}</p>
        </div>
        <div className="rounded-lg border border-[var(--panel-border)] bg-[var(--panel)]/80 p-4">
          <p className="text-xs uppercase tracking-wider text-[color:var(--muted)]">Total risk (SL)</p>
          <p className="mt-1 text-xl font-semibold text-[var(--accent-strong)]">
            {formatCurrencySafe(totalRisk, currency)}
          </p>
          <p className="mt-0.5 text-sm text-[var(--accent)]">
            {totalRiskPct.toFixed(2)}% of equity
          </p>
        </div>
      </div>

      {/* Sort controls */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-[color:var(--muted)]">Sort by:</span>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setSortBy("pnl")}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              sortBy === "pnl"
                ? "bg-[var(--accent)] text-white"
                : "bg-[var(--panel)] text-[color:var(--muted)] hover:bg-[var(--panel)]/80"
            }`}
          >
            P&L
          </button>
          <button
            type="button"
            onClick={() => setSortBy("symbol")}
            className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
              sortBy === "symbol"
                ? "bg-[var(--accent)] text-white"
                : "bg-[var(--panel)] text-[color:var(--muted)] hover:bg-[var(--panel)]/80"
            }`}
          >
            Symbol
          </button>
        </div>
      </div>

      {/* Minimum Account Size Calculator */}
      {hasMinVolData && minAccountCalc.minAccount > 0 && (
        <div className="rounded-xl border border-[var(--panel-border)] bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 p-4">
          <div className="mb-3">
            <h3 className="text-sm font-semibold text-[var(--foreground)]">
              Minimum Account Size Analysis
            </h3>
            <p className="text-xs text-[color:var(--muted)] mt-1">
              Based on current positions and broker minimum lot sizes
            </p>
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-white/50 dark:bg-black/20 p-3">
              <p className="text-xs uppercase tracking-wider text-[color:var(--muted)]">
                Minimum Account Size
              </p>
              <p className="mt-1 text-2xl font-bold text-blue-600">
                {formatCurrencySafe(minAccountCalc.minAccount, currency)}
              </p>
              <p className="text-xs text-[color:var(--muted)] mt-1">
                Constraint: <span className="font-semibold">{minAccountCalc.constraintSymbol}</span>
              </p>
            </div>
            <div className="rounded-lg border border-blue-200 dark:border-blue-800 bg-white/50 dark:bg-black/20 p-3">
              <p className="text-xs uppercase tracking-wider text-[color:var(--muted)]">
                Current Equity
              </p>
              <p className="mt-1 text-2xl font-bold text-[var(--foreground)]">
                {formatCurrencySafe(equity, currency)}
              </p>
              <p className="text-xs text-[color:var(--muted)] mt-1">
                Scale factor: <span className="font-semibold">{(equity / minAccountCalc.minAccount).toFixed(2)}x</span>
              </p>
            </div>
          </div>
          <details className="mt-3">
            <summary className="cursor-pointer text-xs font-semibold text-blue-600 hover:text-blue-700">
              View top constraints
            </summary>
            <div className="mt-2 space-y-1 text-xs">
              {minAccountCalc.constraintData.map((item, idx) => (
                <div key={item.symbol} className="flex justify-between py-1 border-b border-blue-100 dark:border-blue-900">
                  <span className="font-mono">{item.symbol}</span>
                  <span className="text-[color:var(--muted)]">
                    {item.currentLot.toFixed(2)} lots → min {item.minLot.toFixed(2)} = {formatCurrencySafe(item.requiredEquity, currency)}
                  </span>
                </div>
              ))}
            </div>
          </details>
        </div>
      )}

      {/* Grouped positions */}
      <div className="space-y-3">
        {sortedGroups.map((group) => (
          <div
            key={group.symbol}
            className="rounded-xl border border-[var(--panel-border)] bg-[var(--panel)]/90 shadow-sm transition-all hover:shadow-md"
          >
            {/* Group header */}
            <button
              type="button"
              onClick={() => setSelectedGroup(selectedGroup === group.symbol ? null : group.symbol)}
              className="w-full p-4 text-left transition hover:bg-[var(--panel)]/60"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <h3 className="text-lg font-semibold text-[var(--foreground)]">{group.symbol}</h3>
                  <span className="rounded-full bg-[var(--panel)]/70 px-3 py-1 text-xs font-semibold text-[var(--foreground)]/80">
                    {group.positions.length} position{group.positions.length > 1 ? 's' : ''}
                  </span>
                  <span className={`text-sm font-medium ${
                    group.netExposure > 0 ? 'text-emerald-700' : group.netExposure < 0 ? 'text-rose-700' : 'text-[color:var(--muted)]'
                  }`}>
                    {group.netExposure > 0 ? `+${group.netExposure.toFixed(2)}` : group.netExposure.toFixed(2)} lots
                  </span>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-wider text-[color:var(--muted)]">P&L</p>
                    <p className={`text-lg font-semibold ${group.totalProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {formatCurrencySafe(group.totalProfit, currency)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-wider text-[color:var(--muted)]">Risk</p>
                    <p className={`text-lg font-semibold ${group.riskPct > 1.0 ? 'text-rose-700' : 'text-[var(--accent-strong)]'}`}>
                      {formatCurrencySafe(group.riskAmount, currency)}
                    </p>
                    <p className={`text-xs ${group.riskPct > 1.0 ? 'text-rose-600 font-semibold' : 'text-[var(--accent)]'}`}>
                      {group.riskPct.toFixed(2)}% {group.riskPct > 1.0 ? '!' : ''}
                    </p>
                  </div>
                  <svg
                    className={`h-5 w-5 text-[color:var(--muted)] transition-transform ${
                      selectedGroup === group.symbol ? 'rotate-180' : ''
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </button>

            {/* Individual positions */}
            {selectedGroup === group.symbol && (
              <div className="border-t border-[var(--panel-border)] bg-[var(--panel)]/60 p-4">
                <div className="space-y-2">
                  {group.positions.map((pos) => (
                    <div
                      key={pos.ticket}
                      onMouseEnter={() => setHoveredPosition(pos.ticket)}
                      onMouseLeave={() => setHoveredPosition(null)}
                      className="relative rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] p-3 transition-all hover:border-[var(--accent)] hover:shadow-sm"
                    >
                      <div className="grid grid-cols-9 gap-3 text-sm">
                        <div>
                          <p className="text-xs uppercase tracking-wider text-[color:var(--muted)]">Ticket</p>
                          <p className="font-mono text-[var(--foreground)]">#{pos.ticket}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wider text-[color:var(--muted)]">Model</p>
                          <p className={`text-xs font-semibold ${getModelColor(extractModel(pos.comment))}`}>
                            {extractModel(pos.comment) || "—"}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wider text-[color:var(--muted)]">Type</p>
                          <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${
                            pos.type === 'BUY' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                          }`}>
                            {pos.type}
                          </span>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wider text-[color:var(--muted)]">Lots</p>
                          <p className="font-semibold text-[var(--foreground)]">{pos.lots.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wider text-[color:var(--muted)]">Open price</p>
                          <p className="font-mono text-[var(--foreground)]">{formatPrice(pos.open_price, pos.symbol)}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wider text-[color:var(--muted)]">Current</p>
                          <p className="font-mono text-[var(--foreground)]">{formatPrice(pos.current_price, pos.symbol)}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wider text-[color:var(--muted)]">P&L</p>
                          <p className={`font-semibold ${pos.profit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {formatCurrencySafe(pos.profit, currency)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wider text-[color:var(--muted)]">1% move</p>
                          <p className="font-semibold text-blue-600">
                            {formatCurrencySafe(calculateOnePercentImpact(pos), currency)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wider text-[color:var(--muted)]">Open time</p>
                          <p className="text-xs text-[color:var(--muted)]">
                            {formatDateTimeET(pos.open_time)}
                          </p>
                        </div>
                      </div>

                      {/* Hover card with chart placeholder */}
                      {hoveredPosition === pos.ticket && (
                        <div className="absolute left-full top-0 z-10 ml-2 w-64 rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] p-3 shadow-lg">
                          <div className="mb-2 flex items-center justify-between">
                            <p className="text-sm font-semibold text-[var(--foreground)]">{pos.symbol}</p>
                            <p className="text-xs text-[color:var(--muted)]">#{pos.ticket}</p>
                          </div>
                          <div className="h-32 rounded bg-gradient-to-br from-white to-[var(--panel)] p-2">
                            <div className="flex h-full items-center justify-center text-xs text-[color:var(--muted)]">
                              Chart visualization
                              <br />
                              (Coming soon)
                            </div>
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <p className="text-[color:var(--muted)]">SL</p>
                              <p className="font-mono text-[var(--foreground)]">
                                {pos.stop_loss > 0 ? formatPrice(pos.stop_loss, pos.symbol) : 'None'}
                              </p>
                            </div>
                            <div>
                              <p className="text-[color:var(--muted)]">TP</p>
                              <p className="font-mono text-[var(--foreground)]">
                                {pos.take_profit > 0 ? formatPrice(pos.take_profit, pos.symbol) : 'None'}
                              </p>
                            </div>
                            <div>
                              <p className="text-[color:var(--muted)]">Swap</p>
                              <p className="text-[var(--foreground)]">{formatCurrencySafe(pos.swap, currency)}</p>
                            </div>
                            <div>
                              <p className="text-[color:var(--muted)]">Commission</p>
                              <p className="text-[var(--foreground)]">{formatCurrencySafe(pos.commission, currency)}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
