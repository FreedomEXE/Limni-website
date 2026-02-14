type PlannedPairLike = {
  symbol: string;
  units?: number | null;
  riskDisplay?: string | null;
  legs?: Array<{
    model: string;
    direction: string;
    units?: number | null;
    riskDisplay?: string | null;
  }>;
};

type OpenPositionLike = {
  symbol: string;
  side: string;
  lots: number;
  pnl: number;
  legs?: Array<{
    id: string | number;
    basket: string;
    side: string;
    lots: number;
    pnl: number;
  }>;
};

type ClosedGroupLike = {
  symbol: string;
  side: string;
  net: number;
  lots: number;
  legs?: Array<{
    id: string | number;
    basket: string;
    side: string;
    lots: number;
    pnl: number;
    openTime?: string;
    closeTime?: string;
  }>;
};

export type PlannedLegRow = {
  model: string;
  direction: "LONG" | "SHORT";
  units: number | null;
  riskDisplay?: string | null;
};

export type OpenLegRow = {
  id: string | number;
  basket: string;
  side: "BUY" | "SELL";
  lots: number;
  pnl: number;
  model: string | null;
};

export type SymbolRow = {
  id: string;
  status: "open";
  searchText: string;
  sortValue: number;
  symbol: string;
  canonicalSymbol: string;
  plannedLong: number;
  plannedShort: number;
  plannedLongSignals: number;
  plannedShortSignals: number;
  plannedLegs: PlannedLegRow[];
  openLong: number;
  openShort: number;
  openPnl: number;
  openLegs: OpenLegRow[];
  legsPlannedCount: number;
  legsOpenCount: number;
  hasOpenExposure: boolean;
};

export type ClosedRow = {
  id: string;
  status: "closed";
  searchText: string;
  sortValue: number;
  rowType: "closed";
  direction: string;
  symbol: string;
  side: string;
  net: number;
  lots: number;
  legs?: ClosedGroupLike["legs"];
};

function parseManagedModel(tag: string) {
  const raw = String(tag ?? "").trim();
  const parts = raw.split("-");
  const model = (parts[2] ?? "").toLowerCase();
  return model || null;
}

function canonicalizeSymbol(rawSymbol: string) {
  const upper = String(rawSymbol ?? "").trim().toUpperCase();
  if (!upper) return "";
  const firstPart = upper.split(".")[0] ?? upper;
  return firstPart.replace(/[^A-Z0-9]/g, "");
}

function pickPreferredSymbol(existing: string | undefined, candidate: string) {
  if (!candidate) return existing ?? "";
  if (!existing) return candidate;
  // Prefer broker/live symbol spelling because that's what users see in MT5.
  if (existing.includes(".") && !candidate.includes(".")) return existing;
  if (!existing.includes(".") && candidate.includes(".")) return candidate;
  return existing;
}

export function buildSymbolRows(
  plannedPairs: PlannedPairLike[],
  openPositions: OpenPositionLike[],
): SymbolRow[] {
  const plannedMap = new Map<
    string,
    {
      symbol: string;
      plannedLong: number;
      plannedShort: number;
      plannedLongSignals: number;
      plannedShortSignals: number;
      plannedLegs: PlannedLegRow[];
    }
  >();
  for (const pair of plannedPairs) {
    const rawSymbol = String(pair.symbol ?? "").trim().toUpperCase();
    const symbol = canonicalizeSymbol(rawSymbol);
    if (!symbol) continue;
    if (!plannedMap.has(symbol)) {
      plannedMap.set(symbol, {
        symbol: rawSymbol,
        plannedLong: 0,
        plannedShort: 0,
        plannedLongSignals: 0,
        plannedShortSignals: 0,
        plannedLegs: [],
      });
    }
    const entry = plannedMap.get(symbol)!;
    entry.symbol = pickPreferredSymbol(entry.symbol, rawSymbol);
    const legs = Array.isArray(pair.legs) ? pair.legs : [];
    for (const leg of legs) {
      const direction = String(leg.direction ?? "").toUpperCase();
      if (direction !== "LONG" && direction !== "SHORT") continue;
      const unitsRaw =
        typeof leg.units === "number" && Number.isFinite(leg.units)
          ? leg.units
          : typeof pair.units === "number" && Number.isFinite(pair.units)
            ? pair.units
            : null;
      const units =
        typeof unitsRaw === "number" && Number.isFinite(unitsRaw) ? Math.abs(unitsRaw) : null;
      if (direction === "LONG") {
        entry.plannedLong += units ?? 0;
        entry.plannedLongSignals += 1;
      }
      if (direction === "SHORT") {
        entry.plannedShort += units ?? 0;
        entry.plannedShortSignals += 1;
      }
      entry.plannedLegs.push({
        model: String(leg.model ?? "").toLowerCase() || "unknown",
        direction,
        units,
        riskDisplay: leg.riskDisplay ?? pair.riskDisplay ?? null,
      });
    }
  }

  const openMap = new Map<
    string,
    { symbol: string; openLong: number; openShort: number; openPnl: number; openLegs: OpenLegRow[] }
  >();
  for (const pos of openPositions) {
    const rawSymbol = String(pos.symbol ?? "").trim().toUpperCase();
    const symbol = canonicalizeSymbol(rawSymbol);
    if (!symbol) continue;
    if (!openMap.has(symbol)) {
      openMap.set(symbol, {
        symbol: rawSymbol,
        openLong: 0,
        openShort: 0,
        openPnl: 0,
        openLegs: [],
      });
    }
    const entry = openMap.get(symbol)!;
    entry.symbol = pickPreferredSymbol(entry.symbol, rawSymbol);
    const side = String(pos.side ?? "").trim().toUpperCase() === "SELL" ? "SELL" : "BUY";
    const lots = Number(pos.lots ?? 0);
    const pnl = Number(pos.pnl ?? 0);
    if (Number.isFinite(lots) && lots !== 0) {
      if (side === "BUY") entry.openLong += Math.abs(lots);
      if (side === "SELL") entry.openShort += Math.abs(lots);
    }
    entry.openPnl += Number.isFinite(pnl) ? pnl : 0;

    const legs = Array.isArray(pos.legs) ? pos.legs : [];
    for (const leg of legs) {
      const legSide = String(leg.side ?? "").trim().toUpperCase() === "SELL" ? "SELL" : "BUY";
      const legLots = Number(leg.lots ?? 0);
      const legPnl = Number(leg.pnl ?? 0);
      const basket = String(leg.basket ?? "").trim();
      entry.openLegs.push({
        id: leg.id,
        basket,
        side: legSide,
        lots: Number.isFinite(legLots) ? Math.abs(legLots) : 0,
        pnl: Number.isFinite(legPnl) ? legPnl : 0,
        model: parseManagedModel(basket),
      });
    }
  }

  const symbols = Array.from(new Set([...plannedMap.keys(), ...openMap.keys()])).sort((a, b) =>
    a.localeCompare(b),
  );

  return symbols.map((symbol) => {
    const planned = plannedMap.get(symbol) ?? {
      symbol,
      plannedLong: 0,
      plannedShort: 0,
      plannedLongSignals: 0,
      plannedShortSignals: 0,
      plannedLegs: [],
    };
    const open = openMap.get(symbol) ?? {
      symbol,
      openLong: 0,
      openShort: 0,
      openPnl: 0,
      openLegs: [],
    };
    const displaySymbol = open.symbol || planned.symbol || symbol;
    const hasOpenExposure =
      open.openLong > 0 || open.openShort > 0 || (Array.isArray(open.openLegs) && open.openLegs.length > 0);
    return {
      id: `sym-${displaySymbol}`,
      status: "open",
      searchText: `${displaySymbol} ${symbol}`,
      sortValue: open.openPnl,
      symbol: displaySymbol,
      canonicalSymbol: symbol,
      plannedLong: planned.plannedLong,
      plannedShort: planned.plannedShort,
      plannedLongSignals: planned.plannedLongSignals,
      plannedShortSignals: planned.plannedShortSignals,
      plannedLegs: planned.plannedLegs,
      openLong: open.openLong,
      openShort: open.openShort,
      openPnl: open.openPnl,
      openLegs: open.openLegs,
      legsPlannedCount: planned.plannedLegs.length,
      legsOpenCount: open.openLegs.length,
      hasOpenExposure,
    };
  });
}

export function buildClosedRows(closedGroups: ClosedGroupLike[]): ClosedRow[] {
  return closedGroups.map((group) => ({
    id: `closed-${group.symbol}-${group.side}-${group.lots}`,
    status: "closed",
    searchText: `${group.symbol} ${group.side}`,
    sortValue: group.net,
    rowType: "closed",
    direction: group.side,
    ...group,
  }));
}
