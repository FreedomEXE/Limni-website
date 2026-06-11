export type DrawdownSample = {
  equity: number;
  balance?: number | null;
  openPositions?: number | null;
};

export type DrawdownStats = {
  trailingPct: number;
  staticPct: number;
  baselineEquity: number | null;
};

function toFinite(value: number | null | undefined): number | null {
  return Number.isFinite(value) ? Number(value) : null;
}

export function computeTrailingDrawdownPct(values: number[]): number {
  let peak = Number.NEGATIVE_INFINITY;
  let maxDrawdown = 0;
  for (const value of values) {
    if (!Number.isFinite(value)) continue;
    if (value > peak) peak = value;
    if (Number.isFinite(peak)) {
      const dd = peak - value;
      if (dd > maxDrawdown) maxDrawdown = dd;
    }
  }
  return maxDrawdown;
}

export function computeStaticDrawdownPctFromBaseline(
  currentEquity: number,
  baselineEquity: number | null | undefined,
): number {
  const baseline = toFinite(baselineEquity);
  if (!Number.isFinite(currentEquity) || !baseline || baseline <= 0) return 0;
  return Math.max(0, ((baseline - currentEquity) / baseline) * 100);
}

export function deriveStaticBaselineEquity(
  samples: DrawdownSample[],
  initialBaseline: number | null = null,
): Array<number | null> {
  const baselines: Array<number | null> = [];
  let inExposure = false;
  let baseline = toFinite(initialBaseline);

  for (const sample of samples) {
    const openPositions = Number(sample.openPositions ?? 0);
    const balance = toFinite(sample.balance);

    if (!inExposure && openPositions > 0) {
      baseline = balance && balance > 0 ? balance : baseline;
      inExposure = true;
    } else if (inExposure && openPositions <= 0) {
      inExposure = false;
      baseline = null;
    }

    baselines.push(inExposure ? baseline : null);
  }

  return baselines;
}

export function computeDrawdownStatsFromSamples(
  samples: DrawdownSample[],
  initialBaseline: number | null = null,
): DrawdownStats {
  if (samples.length === 0) {
    return { trailingPct: 0, staticPct: 0, baselineEquity: null };
  }

  const baselines = deriveStaticBaselineEquity(samples, initialBaseline);
  const trailingPct = computeTrailingDrawdownPct(samples.map((s) => s.equity));

  let staticPct = 0;
  for (let i = 0; i < samples.length; i += 1) {
    const dd = computeStaticDrawdownPctFromBaseline(samples[i].equity, baselines[i]);
    if (dd > staticPct) staticPct = dd;
  }

  return {
    trailingPct,
    staticPct,
    baselineEquity: baselines[baselines.length - 1] ?? null,
  };
}

export function computeStaticDrawdownPctFromPercentCurve(
  points: Array<{ equity_pct: number }>,
): number {
  if (points.length === 0) return 0;
  let worst = 0;
  for (const point of points) {
    if (!Number.isFinite(point.equity_pct)) continue;
    const dd = Math.max(0, -point.equity_pct);
    if (dd > worst) worst = dd;
  }
  return worst;
}
