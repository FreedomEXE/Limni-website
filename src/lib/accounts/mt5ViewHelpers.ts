import { PAIRS_BY_ASSET_CLASS } from "@/lib/cotPairs";

const FX_PAIR_SET = new Set(PAIRS_BY_ASSET_CLASS.fx.map((row) => row.pair.toUpperCase()));

export function parseBasketFromComment(comment: string) {
  if (!comment) {
    return null;
  }
  const match = comment.match(/LimniBasket\s+([A-Za-z0-9_]+)/i);
  return match?.[1]?.toLowerCase() ?? null;
}

export function normalizeSymbol(rawSymbol: string) {
  const upper = String(rawSymbol ?? "").trim().toUpperCase();
  if (!upper) return "";
  const cleaned = upper.replace(/[^A-Z0-9]/g, "");
  if (cleaned.length >= 6 && /^[A-Z]{6}/.test(cleaned)) {
    return cleaned.slice(0, 6);
  }
  return cleaned;
}

export function isFxSymbol(rawSymbol: string) {
  const normalized = normalizeSymbol(rawSymbol);
  return Boolean(normalized) && FX_PAIR_SET.has(normalized);
}

type HasSymbol = { symbol?: string | null };
type HasCommentAndSymbol = { comment?: string | null; symbol?: string | null };

export function collectPositionFilterOptions<T extends HasCommentAndSymbol>(positions: T[]) {
  const basketOptions = Array.from(
    new Set(
      positions
        .map((position) => parseBasketFromComment(String(position.comment ?? "")))
        .filter((value): value is string => value !== null),
    ),
  ).sort();

  const symbolOptions = Array.from(
    new Set(positions.map((position) => String(position.symbol ?? "")).filter(Boolean)),
  ).sort();

  return { basketOptions, symbolOptions };
}

export function applyPositionFilters<T extends HasCommentAndSymbol>(options: {
  positions: T[];
  basketFilter: string;
  symbolFilter: string;
}) {
  const { positions, basketFilter, symbolFilter } = options;
  return positions.filter((position) => {
    const basket = parseBasketFromComment(String(position.comment ?? ""));
    if (basketFilter && basket !== basketFilter) {
      return false;
    }
    if (symbolFilter && String(position.symbol ?? "") !== symbolFilter) {
      return false;
    }
    return true;
  });
}

export type LotMapRow = {
  symbol?: string | null;
  lot?: number | null;
  move_1pct_usd?: number | null;
  margin_required?: number | null;
};

export function findLotMapEntry(rows: LotMapRow[], symbol: string) {
  const target = symbol.trim().toUpperCase();
  if (!target) return null;

  const aliasMap: Record<string, string[]> = {
    SPXUSD: ["SPX500", "SPXUSD"],
    NDXUSD: ["NDX100", "NDXUSD"],
    NIKKEIUSD: ["JPN225", "NIKKEIUSD"],
    WTIUSD: ["USOUSD", "WTIUSD"],
  };
  const candidates = Array.from(new Set([target, ...(aliasMap[target] ?? [])]));

  for (const candidate of candidates) {
    const exact = rows.find((row) => row.symbol?.toUpperCase() === candidate);
    if (exact) return exact;
  }

  for (const candidate of candidates) {
    const startsWith = rows.find((row) => row.symbol?.toUpperCase().startsWith(candidate));
    if (startsWith) return startsWith;
  }

  if (target.length === 6) {
    const fx = rows.find((row) => row.symbol?.toUpperCase().startsWith(target));
    if (fx) return fx;
  }

  for (const candidate of candidates) {
    const stripped = candidate.replace(/[^A-Z0-9]/g, "");
    if (!stripped) continue;
    const fuzzy = rows.find((row) =>
      String(row.symbol ?? "")
        .toUpperCase()
        .replace(/[^A-Z0-9]/g, "")
        .includes(stripped),
    );
    if (fuzzy) return fuzzy;
  }

  return null;
}

export function filterFxPositions<T extends HasSymbol>(positions: T[]) {
  return positions.filter((position) => isFxSymbol(String(position.symbol ?? "")));
}
