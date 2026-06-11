type PlannedLeg = {
  model?: string;
  direction?: string;
  units?: number | null;
};

type PlannedPairLike = {
  symbol: string;
  assetClass: string;
  net: number;
  units?: number | null;
  stopLoss1pct?: number | null;
  legs?: PlannedLeg[];
};

function shouldIncludePair(pair: PlannedPairLike, isOanda: boolean) {
  return !isOanda || String(pair.assetClass ?? "").toLowerCase() === "fx";
}

export function computePlannedLegCounts(plannedPairs: PlannedPairLike[], isOanda: boolean) {
  const counts = new Map<string, number>();
  for (const pair of plannedPairs) {
    if (!shouldIncludePair(pair, isOanda)) continue;
    for (const leg of pair.legs ?? []) {
      const model = String(leg.model ?? "").toLowerCase();
      if (!model) continue;
      counts.set(model, (counts.get(model) ?? 0) + 1);
    }
  }
  return counts;
}

export function computePlannedLegTotal(plannedPairs: PlannedPairLike[], isOanda: boolean) {
  return plannedPairs.reduce((sum, pair) => {
    if (!shouldIncludePair(pair, isOanda)) return sum;
    return sum + (Array.isArray(pair.legs) ? pair.legs.length : 0);
  }, 0);
}

export function computePlannedNetLegTotal(plannedPairs: PlannedPairLike[], isOanda: boolean) {
  return plannedPairs.reduce((sum, pair) => {
    if (!shouldIncludePair(pair, isOanda)) return sum;
    const net = Number(pair.net ?? 0);
    if (!Number.isFinite(net)) return sum;
    return sum + Math.abs(net);
  }, 0);
}

export function computeNetExposure(plannedPairs: PlannedPairLike[], isOanda: boolean) {
  let sum = 0;
  for (const pair of plannedPairs) {
    if (!shouldIncludePair(pair, isOanda)) continue;
    const legs = Array.isArray(pair.legs) ? pair.legs : [];
    if (legs.length === 0) {
      sum += Number.isFinite(pair.net) ? pair.net : 0;
      continue;
    }
    for (const leg of legs) {
      const dir = String(leg.direction ?? "").toUpperCase();
      const unitsRaw =
        typeof leg.units === "number" && Number.isFinite(leg.units)
          ? leg.units
          : typeof pair.units === "number" && Number.isFinite(pair.units)
            ? pair.units
            : null;
      if (typeof unitsRaw !== "number" || !Number.isFinite(unitsRaw)) continue;
      sum += dir === "LONG" ? Math.abs(unitsRaw) : dir === "SHORT" ? -Math.abs(unitsRaw) : 0;
    }
  }
  return sum;
}

export function buildStopLossLines(
  plannedPairs: PlannedPairLike[],
  showStopLoss1pct: boolean | undefined,
  formatter: (symbol: string, value: number) => string,
) {
  if (!showStopLoss1pct) {
    return [];
  }
  return plannedPairs
    .filter((row) => Number.isFinite(row.stopLoss1pct as number))
    .map((row) => {
      const dir = row.net > 0 ? "LONG" : row.net < 0 ? "SHORT" : "NEUTRAL";
      if (dir !== "LONG" && dir !== "SHORT") return null;
      return `${row.symbol}\t${dir}\tSL ${formatter(row.symbol, row.stopLoss1pct as number)}`;
    })
    .filter((line): line is string => Boolean(line));
}
