import { PAIRS_BY_ASSET_CLASS } from "@/lib/cotPairs";
import type { PerformanceModel } from "@/lib/performanceLab";

const UNIVERSAL_MODEL_SET = new Set([
  "antikythera",
  "blended",
  "dealer",
  "commercial",
  "sentiment",
]);

function isPerformanceModel(value: string): value is PerformanceModel {
  return UNIVERSAL_MODEL_SET.has(value);
}

export function parseSelectedModels(modelsRaw: unknown) {
  const values = (
    Array.isArray(modelsRaw)
      ? modelsRaw.map((v) => String(v).toLowerCase())
      : typeof modelsRaw === "string"
        ? modelsRaw
            .split(",")
            .map((v) => v.trim().toLowerCase())
            .filter(Boolean)
        : []
  ).filter(isPerformanceModel);
  return values;
}

export type ConnectedMappedRow = {
  symbol: string;
  instrument: string;
  available: boolean;
};

export function extractConnectedMappedRows(
  analysis: Record<string, unknown> | null,
): ConnectedMappedRow[] {
  const raw = Array.isArray(analysis?.mapped) ? analysis.mapped : [];
  return raw
    .map((row) => {
      if (!row || typeof row !== "object") {
        return null;
      }
      const value = row as Record<string, unknown>;
      const symbol = String(value.symbol ?? "").trim().toUpperCase();
      const instrument = String(value.instrument ?? "").trim().toUpperCase();
      if (!symbol || !instrument) {
        return null;
      }
      return {
        symbol,
        instrument,
        available: Boolean(value.available),
      };
    })
    .filter((row): row is ConnectedMappedRow => row !== null);
}

export type NormalizedOpenPosition = {
  symbol: string;
  side: string;
  lots: number;
  pnl: number;
  legs: Array<{
    id: string;
    basket: string;
    side: string;
    lots: number;
    pnl: number;
    openTime?: string;
  }>;
};

export function buildConnectedOpenPositions(options: {
  provider: string;
  analysis: Record<string, unknown> | null;
}): NormalizedOpenPosition[] {
  const { provider, analysis } = options;
  const rawPositions = Array.isArray(analysis?.positions)
    ? (analysis.positions as Array<Record<string, unknown>>)
    : [];
  const fxSet =
    provider === "oanda"
      ? new Set(PAIRS_BY_ASSET_CLASS.fx.map((row) => row.pair))
      : null;

  const map = new Map<string, NormalizedOpenPosition>();
  rawPositions.forEach((pos, index) => {
    const symbol = String(pos.symbol ?? "").trim().toUpperCase();
    if (!symbol) return;
    if (fxSet && !fxSet.has(symbol)) return;

    const type = String(pos.type ?? "").trim().toUpperCase();
    const side = type === "SELL" || type === "SHORT" ? "SELL" : "BUY";

    const lots = Number(pos.lots ?? 0);
    if (!Number.isFinite(lots) || lots === 0) return;

    const pnl = Number(pos.profit ?? pos.pnl ?? 0);
    const comment = String(pos.comment ?? pos.tag ?? "").trim();
    const openTime = typeof pos.open_time === "string" ? pos.open_time : undefined;

    const key = `${symbol}:${side}`;
    if (!map.has(key)) {
      map.set(key, { symbol, side, lots: 0, pnl: 0, legs: [] });
    }
    const row = map.get(key)!;
    row.lots += Math.abs(lots);
    row.pnl += Number.isFinite(pnl) ? pnl : 0;
    row.legs.push({
      id: `${key}:${index}`,
      basket: comment || "live",
      side,
      lots: Math.abs(lots),
      pnl: Number.isFinite(pnl) ? pnl : 0,
      openTime,
    });
  });

  return Array.from(map.values()).sort((a, b) => a.symbol.localeCompare(b.symbol));
}
