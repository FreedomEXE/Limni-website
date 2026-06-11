/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: route.ts
 *
 * Description:
 * Read-only trade ledger drilldown adapter for audit UI surfaces.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

import { NextResponse, type NextRequest } from "next/server";
import {
  AGREE_3OF4_STRATEGY_ID,
  resolveEntryStyleId,
  resolveRiskOverlayId,
  resolveStrategyId,
} from "@/lib/performance/strategyConfig";
import { getFillsForParentTrade, getTradesForSurface } from "@/lib/trades/tradeReaders";
import type { AnchorType, Trade, TradeDirection, TradeOrigin, TradeStrategyFamily } from "@/lib/trades/tradeTypes";

export const dynamic = "force-dynamic";
export const revalidate = 0;

const MAX_PARENT_ROWS = 100;

const VALID_ANCHORS = new Set<AnchorType>(["canonical", "execution"]);
const VALID_ORIGINS = new Set<TradeOrigin>(["backtest", "simulation", "live", "research"]);
const VALID_DIRECTIONS = new Set<TradeDirection>(["LONG", "SHORT"]);

function requiredParam(params: URLSearchParams, key: string) {
  const value = params.get(key)?.trim();
  return value && value.length > 0 ? value : null;
}

function parseOptionalInteger(value: string | null) {
  if (!value || value === "null") return null;
  const parsed = Number(value);
  return Number.isInteger(parsed) ? parsed : undefined;
}

function normalizeDateIso(value: string) {
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function normalizeStrategyToken(value: string) {
  const lower = value.trim().toLowerCase();
  if (lower === "agreement" || lower === "agree") return AGREE_3OF4_STRATEGY_ID;
  if (lower === "tiered") return "tiered_4w";
  return resolveStrategyId(lower);
}

function normalizeStrategyVariant(raw: string, strategyFamily: TradeStrategyFamily) {
  const parts = raw.split("-").filter(Boolean);
  if (parts.length >= 3) {
    const [strategy, entry, overlay] = parts;
    return [
      normalizeStrategyToken(strategy ?? raw),
      resolveEntryStyleId(entry),
      resolveRiskOverlayId(overlay),
    ].join("-");
  }

  const strategy = normalizeStrategyToken(raw);
  const entry = strategyFamily === "adr_grid" ? "adr_grid" : "weekly_hold";
  const overlay = entry === "adr_grid" ? "pair_fill_cap" : "none";
  return `${strategy}-${entry}-${overlay}`;
}

function matchesOptionalFilters(
  trade: Trade,
  filters: {
    origin: TradeOrigin;
    sourceModel: string | null;
    tier: number | null | undefined;
    direction: TradeDirection | null;
  },
) {
  if (trade.origin !== filters.origin) return false;
  if (filters.sourceModel && trade.sourceModel !== filters.sourceModel) return false;
  if (filters.tier !== undefined && trade.tier !== filters.tier) return false;
  if (filters.direction && trade.direction !== filters.direction) return false;
  return true;
}

function missingExecutionWarning(anchorType: AnchorType, trades: Trade[]) {
  return anchorType === "execution" && trades.length === 0
    ? ["execution_close_bar_missing"]
    : [];
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const symbol = requiredParam(params, "symbol");
    const weekOpenUtcRaw = requiredParam(params, "weekOpenUtc");
    const strategyFamily = requiredParam(params, "strategyFamily") as TradeStrategyFamily | null;
    const strategyVariantRaw = requiredParam(params, "strategyVariant");
    const anchorTypeRaw = requiredParam(params, "anchorType") as AnchorType | null;
    const originRaw = (params.get("origin")?.trim() || "backtest") as TradeOrigin;
    const sourceModel = params.get("sourceModel")?.trim() || null;
    const tier = parseOptionalInteger(params.get("tier"));
    const directionRaw = params.get("direction")?.trim().toUpperCase() as TradeDirection | undefined;
    const direction = directionRaw && VALID_DIRECTIONS.has(directionRaw) ? directionRaw : null;
    const parentTradeId = params.get("parentTradeId")?.trim() || null;

    if (!symbol || !weekOpenUtcRaw || !strategyFamily || !strategyVariantRaw || !anchorTypeRaw) {
      return NextResponse.json(
        { error: "Missing required params: symbol, weekOpenUtc, strategyFamily, strategyVariant, anchorType" },
        { status: 400 },
      );
    }
    if (!VALID_ANCHORS.has(anchorTypeRaw)) {
      return NextResponse.json({ error: "anchorType must be canonical or execution" }, { status: 400 });
    }
    if (!VALID_ORIGINS.has(originRaw)) {
      return NextResponse.json({ error: "origin must be backtest, simulation, live, or research" }, { status: 400 });
    }
    if (tier === undefined) {
      return NextResponse.json({ error: "tier must be an integer or null" }, { status: 400 });
    }
    if (directionRaw && !direction) {
      return NextResponse.json({ error: "direction must be LONG or SHORT" }, { status: 400 });
    }
    const weekOpenUtc = normalizeDateIso(weekOpenUtcRaw);
    if (!weekOpenUtc) {
      return NextResponse.json({ error: "weekOpenUtc must be a valid ISO timestamp" }, { status: 400 });
    }

    const strategyVariant = normalizeStrategyVariant(strategyVariantRaw, strategyFamily);
    const rows = await getTradesForSurface({
      surface: originRaw === "live" ? "live" : "performance",
      strategyFamily,
      strategyVariant,
      anchorType: anchorTypeRaw,
      symbol,
      weekOpenUtc,
    });
    const filteredRows = rows.filter((trade) =>
      matchesOptionalFilters(trade, {
        origin: originRaw,
        sourceModel,
        tier,
        direction,
      }),
    );
    const parentRows = filteredRows
      .filter((trade) => trade.parentTradeId === null)
      .filter((trade) => !parentTradeId || trade.tradeId === parentTradeId);
    const returnedParents = parentRows.slice(0, MAX_PARENT_ROWS);
    const parentIds = new Set(returnedParents.map((trade) => trade.tradeId));

    const fills = strategyFamily === "adr_grid"
      ? (await Promise.all(returnedParents.map((trade) => getFillsForParentTrade(trade.tradeId))))
          .flat()
          .filter((trade) => matchesOptionalFilters(trade, {
            origin: originRaw,
            sourceModel,
            tier,
            direction,
          }))
          .filter((trade) => trade.parentTradeId !== null && parentIds.has(trade.parentTradeId))
          .sort((left, right) => (left.fillSeq ?? 0) - (right.fillSeq ?? 0))
      : [];

    return NextResponse.json({
      trades: returnedParents,
      fills,
      hasMore: parentRows.length > returnedParents.length,
      warnings: missingExecutionWarning(anchorTypeRaw, returnedParents),
      meta: {
        requestedStrategyVariant: strategyVariantRaw,
        resolvedStrategyVariant: strategyVariant,
        parentCount: parentRows.length,
        returnedParentCount: returnedParents.length,
        fillCount: fills.length,
      },
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : String(error) },
      { status: 500 },
    );
  }
}
