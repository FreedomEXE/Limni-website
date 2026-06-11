/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: TradeDrilldownModal.tsx
 *
 * Description:
 * Reusable ledger-backed trade inspection modal.
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

"use client";

import { useEffect, useMemo, useState } from "react";
import MissingReturnCell from "@/components/common/MissingReturnCell";
import FillsTable from "@/components/common/trades/FillsTable";
import TradeRow from "@/components/common/trades/TradeRow";
import type { AnchorType, Trade, TradeDirection, TradeOrigin, TradeStrategyFamily } from "@/lib/trades/tradeTypes";

export type TradeDrilldownModalProps = {
  symbol: string;
  weekOpenUtc: string;
  strategyFamily: TradeStrategyFamily;
  strategyVariant: string;
  anchorType: AnchorType;
  sourceModel?: string | null;
  tier?: number | null;
  direction?: TradeDirection | null;
  origin?: TradeOrigin;
  parentTradeId?: string | null;
  onClose: () => void;
};

type DrilldownResponse = {
  trades: Trade[];
  fills: Trade[];
  hasMore: boolean;
  warnings?: string[];
  meta?: {
    resolvedStrategyVariant?: string;
    parentCount?: number;
    returnedParentCount?: number;
    fillCount?: number;
  };
  error?: string;
};

function warningCopy(code: string) {
  if (code === "execution_close_bar_missing") {
    return "Execution data unavailable: incomplete close bar";
  }
  return code;
}

function formatWeekLabel(weekOpenUtc: string) {
  const parsed = new Date(weekOpenUtc);
  if (Number.isNaN(parsed.getTime())) return weekOpenUtc;
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    timeZone: "UTC",
  });
}

function groupHeading(trade: Trade) {
  const pieces = [
    trade.sourceModel ? `Source ${trade.sourceModel}` : null,
    trade.tier !== null ? `Tier ${trade.tier}` : null,
    trade.direction ?? null,
  ].filter(Boolean);
  return pieces.length > 0 ? pieces.join(" | ") : "Trade";
}

function buildUrl(props: TradeDrilldownModalProps) {
  const params = new URLSearchParams({
    symbol: props.symbol,
    weekOpenUtc: props.weekOpenUtc,
    strategyFamily: props.strategyFamily,
    strategyVariant: props.strategyVariant,
    anchorType: props.anchorType,
    origin: props.origin ?? "backtest",
  });
  if (props.sourceModel) params.set("sourceModel", props.sourceModel);
  if (props.tier !== undefined && props.tier !== null) params.set("tier", String(props.tier));
  if (props.direction) params.set("direction", props.direction);
  if (props.parentTradeId) params.set("parentTradeId", props.parentTradeId);
  return `/api/trades/drilldown?${params.toString()}`;
}

export default function TradeDrilldownModal(props: TradeDrilldownModalProps) {
  const [state, setState] = useState<{
    url: string;
    payload: DrilldownResponse | null;
    error: string | null;
  }>({ url: "", payload: null, error: null });

  const requestUrl = useMemo(() => buildUrl(props), [props]);
  const loading = state.url !== requestUrl;
  const payload = state.url === requestUrl ? state.payload : null;
  const error = state.url === requestUrl ? state.error : null;

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") props.onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [props]);

  useEffect(() => {
    let cancelled = false;

    fetch(requestUrl, { cache: "no-store" })
      .then(async (response) => {
        const json = (await response.json()) as DrilldownResponse;
        if (!response.ok) throw new Error(json.error ?? `Trade drilldown request failed (${response.status})`);
        return json;
      })
      .then((json) => {
        if (!cancelled) setState({ url: requestUrl, payload: json, error: null });
      })
      .catch((fetchError) => {
        if (!cancelled) {
          setState({
            url: requestUrl,
            payload: null,
            error: fetchError instanceof Error ? fetchError.message : String(fetchError),
          });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [requestUrl]);

  const fillsByParent = useMemo(() => {
    const map = new Map<string, Trade[]>();
    for (const fill of payload?.fills ?? []) {
      if (!fill.parentTradeId) continue;
      const bucket = map.get(fill.parentTradeId) ?? [];
      bucket.push(fill);
      map.set(fill.parentTradeId, bucket);
    }
    return map;
  }, [payload?.fills]);
  const sortedTrades = useMemo(() => {
    return [...(payload?.trades ?? [])].sort((left, right) => {
      const sourceDiff = (left.sourceModel ?? "~").localeCompare(right.sourceModel ?? "~");
      if (sourceDiff !== 0) return sourceDiff;
      const tierDiff = (left.tier ?? Number.MAX_SAFE_INTEGER) - (right.tier ?? Number.MAX_SAFE_INTEGER);
      if (tierDiff !== 0) return tierDiff;
      return left.tradeId.localeCompare(right.tradeId);
    });
  }, [payload?.trades]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-6" role="dialog" aria-modal="true">
      <div
        className="max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-lg border border-[var(--panel-border)] bg-[var(--panel)] shadow-2xl"
        style={{ backgroundColor: "var(--panel, #ffffff)" }}
      >
        <div className="flex items-start justify-between gap-4 border-b border-[var(--panel-border)] px-5 py-4">
          <div>
            <p className="text-[10px] uppercase tracking-[0.2em] text-(--muted)">
              Trade Drilldown
            </p>
            <h2 className="mt-1 text-xl font-semibold text-(--foreground)">
              {props.symbol} | {formatWeekLabel(props.weekOpenUtc)}
            </h2>
            <p className="mt-1 text-xs uppercase tracking-[0.16em] text-(--muted)">
              {props.strategyVariant} | {props.strategyFamily} | {props.anchorType}
            </p>
          </div>
          <button
            type="button"
            onClick={props.onClose}
            className="rounded-full border border-(--panel-border) px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-(--muted) hover:border-(--accent) hover:text-(--accent-strong)"
          >
            Close
          </button>
        </div>

        <div className="max-h-[calc(92vh-96px)] overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="rounded-lg border border-(--panel-border) bg-(--panel)/60 px-3 py-4 text-sm text-(--muted)">
              Loading trade ledger rows...
            </div>
          ) : null}

          {error ? (
            <div className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-3 py-4 text-sm text-rose-300">
              {error}
            </div>
          ) : null}

          {!loading && !error && payload ? (
            <div className="space-y-4">
              {payload.warnings && payload.warnings.length > 0 ? (
                <div className="rounded-lg border border-(--panel-border) bg-(--panel)/60 px-3 py-3 text-sm text-(--muted)">
                  <MissingReturnCell reason={warningCopy(payload.warnings[0] ?? "Data unavailable")} />{" "}
                  {payload.warnings.map(warningCopy).join(" | ")}
                </div>
              ) : null}

              {payload.hasMore ? (
                <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 px-3 py-3 text-xs text-amber-300">
                  Result capped at 100 parent trades. Narrow by source, tier, or direction for a complete audit view.
                </div>
              ) : null}

              {sortedTrades.length === 0 ? (
                <div className="rounded-lg border border-dashed border-(--panel-border) px-3 py-6 text-sm text-(--muted)">
                  No ledger trade rows matched this selection.
                </div>
              ) : (
                sortedTrades.map((trade) => {
                  const fills = fillsByParent.get(trade.tradeId) ?? [];
                  const violations = fills.filter((fill) => fill.capViolated).length;
                  return (
                    <section key={trade.tradeId} className="space-y-3">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <h3 className="text-sm font-semibold uppercase tracking-[0.16em] text-(--foreground)">
                          {groupHeading(trade)}
                        </h3>
                        {trade.strategyFamily === "adr_grid" ? (
                          <span className={`rounded-full border px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${
                            violations > 0
                              ? "border-rose-500/45 bg-rose-500/10 text-rose-300"
                              : "border-emerald-500/35 bg-emerald-500/10 text-emerald-300"
                          }`}>
                            Pair Fill Cap: {fills.length} fills | threshold {trade.capThresholdAtEntry ?? 3} | {violations} violations
                          </span>
                        ) : null}
                      </div>
                      <TradeRow trade={trade} />
                      {trade.strategyFamily === "adr_grid" ? (
                        <div className="space-y-2">
                          <div className="text-xs font-semibold uppercase tracking-[0.16em] text-(--muted)">Fills</div>
                          <FillsTable fills={fills} />
                        </div>
                      ) : null}
                    </section>
                  );
                })
              )}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
