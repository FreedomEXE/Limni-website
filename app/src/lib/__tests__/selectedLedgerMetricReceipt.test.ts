import { describe, expect, it } from "vitest";
import { buildSelectedLedgerMetricReceipt } from "@/lib/appTruth/selectedLedgerMetricReceipt";
import { buildSelectedLedgerStats } from "@/lib/appTruth/selectedLedgerStats";
import type { ClosedHistoryBundle, ClosedHistoryRow } from "@/lib/basket/basketSummaryTypes";
import { getStrategy } from "@/lib/performance/strategyConfig";
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

describe("selectedLedgerMetricReceipt", () => {
  it("proves selected-ledger summary, cards, simulation, basket, and weekly totals share one metric source", () => {
    const stats = buildSelectedLedgerStats({
      bundle: bundle([
        row({
          rowKind: "grid",
          executionTradeId: "dealer-grid",
          sourceModel: "dealer",
          returnMatrix: { canonical: { rawPct: 3 }, execution: { rawPct: 3 }, adrPct: 1 },
        }),
        row({
          rowKind: "fill",
          executionTradeId: "dealer-fill-1",
          sourceModel: "dealer",
          fillSeq: 1,
          returnMatrix: { canonical: { rawPct: 1 }, execution: { rawPct: 1 }, adrPct: 1 },
        }),
        row({
          rowKind: "fill",
          executionTradeId: "dealer-fill-2",
          sourceModel: "dealer",
          fillSeq: 2,
          returnMatrix: { canonical: { rawPct: 2 }, execution: { rawPct: 2 }, adrPct: 1 },
        }),
        row({
          rowKind: "grid",
          executionTradeId: "commercial-grid",
          sourceModel: "commercial",
          direction: "SHORT",
          returnMatrix: { canonical: { rawPct: -1 }, execution: { rawPct: -1 }, adrPct: 1 },
        }),
        row({
          rowKind: "fill",
          executionTradeId: "commercial-fill-1",
          sourceModel: "commercial",
          direction: "SHORT",
          fillSeq: 1,
          returnMatrix: { canonical: { rawPct: -1 }, execution: { rawPct: -1 }, adrPct: 1 },
        }),
      ]),
      selectedWeek: "all",
      scope: ["fx"],
      viewMode: executionRaw,
    });
    const strategy = getStrategy("tandem");
    expect(strategy).toBeTruthy();

    const receipt = buildSelectedLedgerMetricReceipt({
      stats,
      strategy: strategy ?? null,
      selection: { strategy: "tandem", f1: "adr_grid", f2: "pair_fill_cap" },
      historyWindow: "seed-window",
      viewMode: executionRaw,
      generatedAtUtc: "2026-06-09T00:00:00.000Z",
    });

    expect(receipt.parity.passed).toBe(true);
    expect(receipt.summary.returnPct).toBe(2);
    expect(receipt.weekly.returnPctSum).toBe(2);
    expect(receipt.summary.tradeCount).toBe(3);
    expect(receipt.simulation.returnPct).toBe(receipt.summary.returnPct);
    expect(receipt.basket.returnPct).toBe(receipt.summary.returnPct);
    expect(receipt.summaryCards).toEqual([
      expect.objectContaining({ model: "dealer", returnPct: 3, leafRowCount: 2 }),
      expect.objectContaining({ model: "commercial", returnPct: -1, leafRowCount: 1 }),
      expect.objectContaining({ model: "sentiment", returnPct: 0, leafRowCount: 0 }),
      expect.objectContaining({ model: "strength", returnPct: 0, leafRowCount: 0 }),
    ]);
    expect(receipt.exportContract).toEqual({
      rowExportsRemainRowOnly: true,
      metricReceiptSource: "selected-ledger-stat-v1",
    });
  });
});
