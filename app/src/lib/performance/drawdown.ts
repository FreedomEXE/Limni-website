/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: src/lib/performance/drawdown.ts
 *
 * Description:
 * Shared max drawdown helpers for percentage return series.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

export function computeMaxDrawdownFromPercentReturns(returns: number[]): number {
  if (returns.length === 0) return 0;

  let equity = 100;
  let peak = equity;
  let maxDrawdown = 0;

  for (const value of returns) {
    if (!Number.isFinite(value)) continue;

    const multiplier = 1 + value / 100;
    equity *= multiplier;
    if (equity > peak) {
      peak = equity;
      continue;
    }
    if (peak <= 0) continue;

    const drawdown = equity <= 0 ? 100 : ((peak - equity) / peak) * 100;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  return maxDrawdown;
}

export function computeMaxDrawdownSimple(returns: number[]): number {
  if (returns.length === 0) return 0;

  let cumulative = 0;
  let peak = 0;
  let maxDrawdown = 0;

  for (const value of returns) {
    if (!Number.isFinite(value)) continue;
    cumulative += value;
    if (cumulative > peak) {
      peak = cumulative;
    }
    const drawdown = peak - cumulative;
    if (drawdown > maxDrawdown) {
      maxDrawdown = drawdown;
    }
  }

  return maxDrawdown;
}
