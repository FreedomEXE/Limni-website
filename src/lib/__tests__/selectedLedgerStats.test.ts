import { describe, expect, it } from "vitest";
import type { ClosedHistoryBundle, ClosedHistoryRow } from "@/lib/basket/basketSummaryTypes";
import { buildSelectedLedgerStats } from "@/lib/appTruth/selectedLedgerStats";
import type { ViewMode } from "@/lib/viewMode/viewModeTypes";

const executionRaw: ViewMode = {
  anchor: "execution",
  normalization: "raw",
};

function row(overrides: Partial<ClosedHistoryRow>): ClosedHistoryRow {
  return {
    rowKind: "fill",
    origin: "backtest",
    strategyFamily: "adr_grid",
    strategyVariant: "tandem-adr_grid-pair_fill_cap",
    symbol: "EURUSD",
    assetClass: "fx",
    weekOpenUtc: "2026-01-05T00:00:00.000Z",
    sourceModel: "dealer",
    tier: null,
    direction: "LONG",
    fillSeq: null,
    parentNaturalRef: null,
    canonicalTradeId: "canonical",
    executionTradeId: "execution",
    entryUtc: "2026-01-05T01:00:00.000Z",
    exitUtc: "2026-01-05T02:00:00.000Z",
    entryPrice: 1,
    exitPrice: 1.01,
    returnMatrix: {
      canonical: { rawPct: 1 },
      execution: { rawPct: 1 },
      adrPct: 1,
    },
    riskMatrix: {
      canonical: { maeRawPct: 0.25, pathDrawdownRawPct: 0.5 },
      execution: { maeRawPct: 0.25, pathDrawdownRawPct: 0.5 },
      adrPct: 1,
    },
    exitReason: "tp",
    capActiveFillsAtEntry: null,
    capThresholdAtEntry: null,
    capViolated: false,
    warnings: [],
    ...overrides,
  };
}

function bundle(rows: ClosedHistoryRow[]): ClosedHistoryBundle {
  return {
    rows,
    strategyVariant: "tandem-adr_grid-pair_fill_cap",
    scope: ["fx", "indices", "commodities", "crypto"],
    generatedAt: "2026-06-09T00:00:00.000Z",
    ledgerIdentity: {
      executionLedgerId: "execution-ledger:test",
      tradeRowLedgerId: "trade-row-ledger:test",
      rowCount: rows.length,
      generatedFrom: "strategy-runtime",
    },
  };
}

describe("selectedLedgerStats", () => {
  it("uses ADR grid parent rows for P/L and fill rows for trade stats", () => {
    const stats = buildSelectedLedgerStats({
      bundle: bundle([
        row({
          rowKind: "grid",
          executionTradeId: "grid-1",
          returnMatrix: { canonical: { rawPct: 3 }, execution: { rawPct: 3 }, adrPct: 1 },
        }),
        row({
          rowKind: "fill",
          executionTradeId: "fill-1",
          fillSeq: 1,
          returnMatrix: { canonical: { rawPct: 1 }, execution: { rawPct: 1 }, adrPct: 1 },
        }),
        row({
          rowKind: "fill",
          executionTradeId: "fill-2",
          fillSeq: 2,
          returnMatrix: { canonical: { rawPct: 2 }, execution: { rawPct: 2 }, adrPct: 1 },
        }),
      ]),
      selectedWeek: "2026-01-05T00:00:00.000Z",
      scope: ["fx"],
      viewMode: executionRaw,
    });

    expect(stats.status).toBe("available");
    expect(stats.metricRowCount).toBe(1);
    expect(stats.leafRowCount).toBe(2);
    expect(stats.summary?.returnPct).toBe(3);
    expect(stats.summary?.tradeCount).toBe(2);
    expect(stats.summary?.winCount).toBe(2);
    expect(stats.weeklyReturns).toEqual([
      expect.objectContaining({
        weekOpenUtc: "2026-01-05T00:00:00.000Z",
        returnPct: 3,
        trades: 2,
      }),
    ]);
  });

  it("filters by selected scope without replacing missing rows with zero metrics", () => {
    const stats = buildSelectedLedgerStats({
      bundle: bundle([
        row({
          rowKind: "trade",
          assetClass: "crypto",
          symbol: "BTCUSD",
          executionTradeId: "crypto-trade",
          returnMatrix: { canonical: { rawPct: 5 }, execution: { rawPct: 5 }, adrPct: 1 },
        }),
      ]),
      selectedWeek: "2026-01-05T00:00:00.000Z",
      scope: ["fx"],
      viewMode: executionRaw,
    });

    expect(stats.status).toBe("missing");
    expect(stats.reason).toBe("selected-ledger-rows-missing");
    expect(stats.summary).toBeNull();
    expect(stats.weeklyReturns).toEqual([]);
  });

  it("reports unavailable when the selected ledger bundle is absent", () => {
    const stats = buildSelectedLedgerStats({
      bundle: null,
      selectedWeek: "all",
      scope: ["fx"],
      viewMode: executionRaw,
    });

    expect(stats.status).toBe("missing");
    expect(stats.reason).toBe("selected-ledger-missing");
    expect(stats.selectedTradeRowLedgerId).toBeNull();
    expect(stats.summary).toBeNull();
  });
});
