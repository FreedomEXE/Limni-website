import { describe, expect, it } from "vitest";
import type { ClosedHistoryBundle, ClosedHistoryRow } from "@/lib/basket/basketSummaryTypes";
import { buildClosedHistoryBundleFromStrategyResults } from "@/lib/basket/strategyRuntimeRows";
import { buildSelectedLedgerStats } from "@/lib/appTruth/selectedLedgerStats";
import type { WeeklyHoldResult } from "@/lib/performance/weeklyHoldEngine";
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

  it("keeps planned ADR grid rows in selected ledgers without counting them as fills", () => {
    const result: WeeklyHoldResult = {
      weekOpenUtc: "2026-01-05T00:00:00.000Z",
      biasSourceId: "dealer",
      trades: [
        {
          symbol: "EURUSD",
          assetClass: "fx",
          direction: "LONG",
          openPrice: 1.1,
          closePrice: 1.12,
          returnPct: 1.5,
          rawReturnPct: 1.5,
          source: "dealer",
          tier: 1,
          detail: {
            tradeNumber: 1,
            entryTimeUtc: "2026-01-05T01:00:00.000Z",
            exitTimeUtc: "2026-01-05T02:00:00.000Z",
            exitReason: "grid_tp",
            anchorPrice: 1.1,
            tpPrice: 1.12,
            adrPct: 2,
            maePct: 0.1,
            gridPathDrawdownRawPct: 0.2,
            capActiveFillsAtEntry: 1,
            capThresholdAtEntry: 3,
            capViolated: false,
          },
        },
      ],
      totalReturnPct: 1.5,
      winCount: 1,
      lossCount: 0,
      winRate: 100,
      tradeCount: 1,
      plannedTrades: [
        {
          symbol: "AUDUSD",
          assetClass: "fx",
          direction: "SHORT",
          openPrice: 0.66,
          closePrice: 0.66,
          returnPct: 0,
          rawReturnPct: 0,
          source: "dealer",
          tier: 1,
          adrPct: 2,
          detail: {
            tradeNumber: 1,
            entryTimeUtc: "2026-01-05T00:00:00.000Z",
            exitTimeUtc: null,
            exitReason: "grid_planned",
            anchorPrice: 0.66,
            tpPrice: null,
            adrPct: 2,
            maePct: null,
            gridPathDrawdownRawPct: null,
            capActiveFillsAtEntry: null,
            capThresholdAtEntry: null,
            capViolated: false,
          },
        },
        {
          symbol: "EURUSD",
          assetClass: "fx",
          direction: "LONG",
          openPrice: 1.1,
          closePrice: 1.1,
          returnPct: 0,
          rawReturnPct: 0,
          source: "dealer",
          tier: 1,
          adrPct: 2,
          detail: {
            tradeNumber: 2,
            entryTimeUtc: "2026-01-05T00:00:00.000Z",
            exitTimeUtc: null,
            exitReason: "grid_planned",
            anchorPrice: 1.1,
            tpPrice: null,
            adrPct: 2,
            maePct: null,
            gridPathDrawdownRawPct: null,
            capActiveFillsAtEntry: null,
            capThresholdAtEntry: null,
            capViolated: false,
          },
        },
      ],
      displayUnit: "grids",
      signals: [],
      isRealized: true,
    };

    const closedBundle = buildClosedHistoryBundleFromStrategyResults({
      strategyVariant: "tandem-adr_grid-pair_fill_cap",
      weekResults: { [result.weekOpenUtc]: result },
      generatedAt: "2026-01-06T00:00:00.000Z",
    });
    const gridRows = closedBundle.rows.filter((closedRow) => closedRow.rowKind === "grid");
    const fillRows = closedBundle.rows.filter((closedRow) => closedRow.rowKind === "fill");

    expect(gridRows.map((closedRow) => closedRow.symbol)).toEqual(["AUDUSD", "EURUSD"]);
    expect(fillRows).toHaveLength(1);
    expect(gridRows.find((closedRow) => closedRow.symbol === "AUDUSD")?.returnMatrix.execution?.rawPct).toBe(0);

    const stats = buildSelectedLedgerStats({
      bundle: closedBundle,
      selectedWeek: result.weekOpenUtc,
      scope: ["fx"],
      viewMode: executionRaw,
    });

    expect(stats.summary?.returnPct).toBe(1.5);
    expect(stats.summary?.tradeCount).toBe(1);
    expect(stats.metricRowCount).toBe(2);
    expect(stats.leafRowCount).toBe(1);
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
