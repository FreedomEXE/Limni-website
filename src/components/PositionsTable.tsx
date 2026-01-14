"use client";

import { useState } from "react";
import type { Mt5Position } from "@/lib/mt5Store";

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
          // For most pairs, 0.01 lot with 10% SL ≈ $130 risk
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

function formatCurrency(value: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPrice(value: number, symbol: string) {
  const isJPY = symbol.includes("JPY");
  return value.toFixed(isJPY ? 3 : 5);
}

export default function PositionsTable({ positions, currency, equity }: PositionsTableProps) {
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [hoveredPosition, setHoveredPosition] = useState<number | null>(null);

  if (!positions || positions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-200 bg-white/60 p-8 text-center text-sm text-slate-500">
        <p className="font-semibold">No open positions</p>
        <p className="mt-2">Positions will appear here when trades are opened.</p>
      </div>
    );
  }

  const groups = groupPositionsBySymbol(positions, equity);
  const totalProfit = positions.reduce((sum, p) => sum + p.profit, 0);
  const totalRisk = groups.reduce((sum, g) => sum + g.riskAmount, 0);
  const totalRiskPct = equity > 0 ? (totalRisk / equity) * 100 : 0;

  return (
    <div className="space-y-4">
      {/* Summary stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-lg border border-slate-200 bg-white/80 p-4">
          <p className="text-xs uppercase tracking-wider text-slate-500">Total P&L</p>
          <p className={`mt-1 text-xl font-semibold ${totalProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
            {formatCurrency(totalProfit, currency)}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white/80 p-4">
          <p className="text-xs uppercase tracking-wider text-slate-500">Pairs traded</p>
          <p className="mt-1 text-xl font-semibold text-slate-900">{groups.length}</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white/80 p-4">
          <p className="text-xs uppercase tracking-wider text-slate-500">Total risk (SL)</p>
          <p className="mt-1 text-xl font-semibold text-amber-700">
            {formatCurrency(totalRisk, currency)}
          </p>
          <p className="mt-0.5 text-sm text-amber-600">
            {totalRiskPct.toFixed(2)}% of equity
          </p>
        </div>
      </div>

      {/* Grouped positions */}
      <div className="space-y-3">
        {groups.map((group) => (
          <div
            key={group.symbol}
            className="rounded-xl border border-slate-200 bg-white/90 shadow-sm transition-all hover:shadow-md"
          >
            {/* Group header */}
            <button
              type="button"
              onClick={() => setSelectedGroup(selectedGroup === group.symbol ? null : group.symbol)}
              className="w-full p-4 text-left transition hover:bg-slate-50/50"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <h3 className="text-lg font-semibold text-slate-900">{group.symbol}</h3>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">
                    {group.positions.length} position{group.positions.length > 1 ? 's' : ''}
                  </span>
                  <span className={`text-sm font-medium ${
                    group.netExposure > 0 ? 'text-emerald-700' : group.netExposure < 0 ? 'text-rose-700' : 'text-slate-500'
                  }`}>
                    {group.netExposure > 0 ? `+${group.netExposure.toFixed(2)}` : group.netExposure.toFixed(2)} lots
                  </span>
                </div>
                <div className="flex items-center gap-6">
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-wider text-slate-500">P&L</p>
                    <p className={`text-lg font-semibold ${group.totalProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {formatCurrency(group.totalProfit, currency)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs uppercase tracking-wider text-slate-500">Risk</p>
                    <p className={`text-lg font-semibold ${group.riskPct > 1.0 ? 'text-rose-700' : 'text-amber-700'}`}>
                      {formatCurrency(group.riskAmount, currency)}
                    </p>
                    <p className={`text-xs ${group.riskPct > 1.0 ? 'text-rose-600 font-semibold' : 'text-amber-600'}`}>
                      {group.riskPct.toFixed(2)}% {group.riskPct > 1.0 ? '⚠️' : ''}
                    </p>
                  </div>
                  <svg
                    className={`h-5 w-5 text-slate-400 transition-transform ${
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
              <div className="border-t border-slate-200 bg-slate-50/50 p-4">
                <div className="space-y-2">
                  {group.positions.map((pos) => (
                    <div
                      key={pos.ticket}
                      onMouseEnter={() => setHoveredPosition(pos.ticket)}
                      onMouseLeave={() => setHoveredPosition(null)}
                      className="relative rounded-lg border border-slate-200 bg-white p-3 transition-all hover:border-teal-300 hover:shadow-sm"
                    >
                      <div className="grid grid-cols-7 gap-3 text-sm">
                        <div>
                          <p className="text-xs uppercase tracking-wider text-slate-500">Ticket</p>
                          <p className="font-mono text-slate-900">#{pos.ticket}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wider text-slate-500">Type</p>
                          <span className={`inline-block rounded px-2 py-0.5 text-xs font-semibold ${
                            pos.type === 'BUY' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                          }`}>
                            {pos.type}
                          </span>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wider text-slate-500">Lots</p>
                          <p className="font-semibold text-slate-900">{pos.lots.toFixed(2)}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wider text-slate-500">Open price</p>
                          <p className="font-mono text-slate-900">{formatPrice(pos.open_price, pos.symbol)}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wider text-slate-500">Current</p>
                          <p className="font-mono text-slate-900">{formatPrice(pos.current_price, pos.symbol)}</p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wider text-slate-500">P&L</p>
                          <p className={`font-semibold ${pos.profit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                            {formatCurrency(pos.profit, currency)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs uppercase tracking-wider text-slate-500">Open time</p>
                          <p className="text-xs text-slate-600">
                            {new Date(pos.open_time).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </p>
                        </div>
                      </div>

                      {/* Hover card with chart placeholder */}
                      {hoveredPosition === pos.ticket && (
                        <div className="absolute left-full top-0 z-10 ml-2 w-64 rounded-lg border border-slate-200 bg-white p-3 shadow-lg">
                          <div className="mb-2 flex items-center justify-between">
                            <p className="text-sm font-semibold text-slate-900">{pos.symbol}</p>
                            <p className="text-xs text-slate-500">#{pos.ticket}</p>
                          </div>
                          <div className="h-32 rounded bg-gradient-to-br from-slate-50 to-slate-100 p-2">
                            <div className="flex h-full items-center justify-center text-xs text-slate-400">
                              Chart visualization
                              <br />
                              (Coming soon)
                            </div>
                          </div>
                          <div className="mt-2 grid grid-cols-2 gap-2 text-xs">
                            <div>
                              <p className="text-slate-500">SL</p>
                              <p className="font-mono text-slate-900">
                                {pos.stop_loss > 0 ? formatPrice(pos.stop_loss, pos.symbol) : 'None'}
                              </p>
                            </div>
                            <div>
                              <p className="text-slate-500">TP</p>
                              <p className="font-mono text-slate-900">
                                {pos.take_profit > 0 ? formatPrice(pos.take_profit, pos.symbol) : 'None'}
                              </p>
                            </div>
                            <div>
                              <p className="text-slate-500">Swap</p>
                              <p className="text-slate-900">{formatCurrency(pos.swap, currency)}</p>
                            </div>
                            <div>
                              <p className="text-slate-500">Commission</p>
                              <p className="text-slate-900">{formatCurrency(pos.commission, currency)}</p>
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
