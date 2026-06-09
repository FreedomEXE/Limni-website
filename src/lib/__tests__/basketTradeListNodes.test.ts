import { describe, expect, test } from "vitest";
import { buildBasketTradeListNodes } from "@/lib/basket/buildBasketTradeListNodes";
import type { ClosedHistoryRow } from "@/lib/basket/basketSummaryTypes";
import type { StrategyConfig } from "@/lib/performance/strategyConfig";
import type { ViewMode } from "@/lib/viewMode/viewModeTypes";

const strategy = {
  id: "tiered_4w",
  label: "Tiered",
  type: "tiered",
  description: "Test strategy",
  cardBreakdown: "tiers",
} satisfies StrategyConfig;

const viewMode = {
  anchor: "execution",
  normalization: "raw",
} satisfies ViewMode;

const adrViewMode = {
  anchor: "execution",
  normalization: "adr_normalized",
} satisfies ViewMode;

function row(overrides: Partial<ClosedHistoryRow>): ClosedHistoryRow {
  return {
    rowKind: "fill",
    origin: "backtest",
    strategyFamily: "adr_grid",
    strategyVariant: "tiered_4w-adr_grid-pair_fill_cap",
    symbol: "AUDCAD",
    assetClass: "fx",
    weekOpenUtc: "2026-05-24T23:00:00.000Z",
    sourceModel: "tiered_4w",
    tier: 1,
    direction: "LONG",
    fillSeq: 6,
    parentNaturalRef: "parent|backtest|adr_grid|tiered_4w-adr_grid-pair_fill_cap|AUDCAD|2026-05-24T23:00:00.000Z|tiered_4w|1|LONG",
    canonicalTradeId: "canonical-6",
    executionTradeId: "execution-6",
    entryUtc: "2026-05-25T02:00:00.000Z",
    exitUtc: "2026-05-25T03:00:00.000Z",
    entryPrice: 1,
    exitPrice: 1.01,
    returnMatrix: {
      canonical: { rawPct: 0.1 },
      execution: { rawPct: 0.1 },
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

function risk(maeRawPct: number | null, pathDrawdownRawPct: number | null = null, adrPct = 1): ClosedHistoryRow["riskMatrix"] {
  return {
    canonical: { maeRawPct, pathDrawdownRawPct },
    execution: { maeRawPct, pathDrawdownRawPct },
    adrPct,
  };
}

function findNode(
  nodes: ReturnType<typeof buildBasketTradeListNodes>,
  predicate: (node: ReturnType<typeof buildBasketTradeListNodes>[number]) => boolean,
): ReturnType<typeof buildBasketTradeListNodes>[number] | null {
  for (const node of nodes) {
    if (predicate(node)) return node;
    const child = findNode(node.children ?? [], predicate);
    if (child) return child;
  }
  return null;
}

describe("basket trade-list node builder", () => {
  test("displays per-grid fill ordinals when source fill sequences jump", () => {
    const nodes = buildBasketTradeListNodes({
      rows: [
        row({
          rowKind: "grid",
          fillSeq: null,
          parentNaturalRef: null,
          canonicalTradeId: "canonical-grid",
          executionTradeId: "execution-grid",
          entryUtc: "2026-05-25T02:00:00.000Z",
          exitUtc: "2026-05-29T13:00:00.000Z",
          returnMatrix: {
            canonical: { rawPct: 0.3 },
            execution: { rawPct: 0.3 },
            adrPct: 1,
          },
        }),
        row({
          fillSeq: 12,
          canonicalTradeId: "canonical-12",
          executionTradeId: "execution-12",
          entryUtc: "2026-05-25T14:00:00.000Z",
        }),
        row({
          fillSeq: 6,
          canonicalTradeId: "canonical-6",
          executionTradeId: "execution-6",
          entryUtc: "2026-05-25T02:00:00.000Z",
        }),
        row({
          fillSeq: 8,
          canonicalTradeId: "canonical-8",
          executionTradeId: "execution-8",
          entryUtc: "2026-05-25T12:00:00.000Z",
        }),
      ],
      strategy,
      strategyVariant: "tiered_4w-adr_grid-pair_fill_cap",
      selectedWeek: "2026-05-24T23:00:00.000Z",
      viewMode,
    });

    const levelNodes = nodes[0]?.children?.[0]?.children?.[0]?.children ?? [];
    const fillNodes = levelNodes[0]?.children ?? [];

    expect(levelNodes.map((node) => node.level)).toEqual(["level"]);
    expect(levelNodes[0]?.values.returnPct).toBeCloseTo(0.3, 8);
    expect(fillNodes.map((node) => node.label)).toEqual(["Fill 1", "Fill 2", "Fill 3"]);
    expect(fillNodes.map((node) => node.values.sourceFillSeq)).toEqual([6, 8, 12]);
    expect(fillNodes.map((node) => node.values.displayFillSeq)).toEqual([1, 2, 3]);
  });

  test("rolls risk values from fills and grids through all hierarchy levels", () => {
    const rows = [
      row({
        rowKind: "grid",
        fillSeq: null,
        parentNaturalRef: null,
        canonicalTradeId: "canonical-grid",
        executionTradeId: "execution-grid",
        entryUtc: "2026-05-25T02:00:00.000Z",
        exitUtc: "2026-05-29T13:00:00.000Z",
        returnMatrix: {
          canonical: { rawPct: 0.3 },
          execution: { rawPct: 0.3 },
          adrPct: 0.5,
        },
        riskMatrix: risk(0.2, 0.12, 0.5),
      }),
      row({
        fillSeq: 6,
        canonicalTradeId: "canonical-6",
        executionTradeId: "execution-6",
        entryUtc: "2026-05-25T02:00:00.000Z",
        returnMatrix: {
          canonical: { rawPct: 0.1 },
          execution: { rawPct: 0.1 },
          adrPct: 0.5,
        },
        riskMatrix: risk(0.2, null, 0.5),
      }),
      row({
        fillSeq: 8,
        canonicalTradeId: "canonical-8",
        executionTradeId: "execution-8",
        entryUtc: "2026-05-25T12:00:00.000Z",
        returnMatrix: {
          canonical: { rawPct: 0.1 },
          execution: { rawPct: 0.1 },
          adrPct: 0.5,
        },
        riskMatrix: risk(0.05, null, 0.5),
      }),
    ];
    const rawNodes = buildBasketTradeListNodes({
      rows,
      strategy,
      strategyVariant: "tiered_4w-adr_grid-pair_fill_cap",
      selectedWeek: "all",
      viewMode,
    });
    const adrNodes = buildBasketTradeListNodes({
      rows,
      strategy,
      strategyVariant: "tiered_4w-adr_grid-pair_fill_cap",
      selectedWeek: "all",
      viewMode: adrViewMode,
    });

    const rawWeek = findNode(rawNodes, (node) => node.level === "week");
    const rawGrid = findNode(rawNodes, (node) => node.level === "grid");
    const rawFill = findNode(rawNodes, (node) => node.level === "fill" && node.values.sourceFillSeq === 6);
    const adrWeek = findNode(adrNodes, (node) => node.level === "week");

    expect(rawWeek?.values.maxMaePct).toBe(0.2);
    expect(rawWeek?.values.maxPathDrawdownPct).toBe(0.12);
    expect(rawGrid?.values.maxMaePct).toBe(0.2);
    expect(rawGrid?.values.maxPathDrawdownPct).toBe(0.12);
    expect(rawFill?.values.maxMaePct).toBe(0.2);
    expect(rawFill?.values.maxPathDrawdownPct).toBeNull();
    expect(adrWeek?.values.maxMaePct).toBe(0.4);
    expect(adrWeek?.values.maxPathDrawdownPct).toBe(0.24);
  });

  test("rolls risk values for weekly hold trade rows without grid levels", () => {
    const rows = [
      row({
        rowKind: "trade",
        strategyFamily: "weekly_hold",
        strategyVariant: "tiered_4w-weekly_hold-none",
        fillSeq: null,
        parentNaturalRef: null,
        canonicalTradeId: "canonical-weekly-hold",
        executionTradeId: "execution-weekly-hold",
        entryUtc: "2026-05-25T00:00:00.000Z",
        exitUtc: "2026-05-29T20:00:00.000Z",
        returnMatrix: {
          canonical: { rawPct: -0.4 },
          execution: { rawPct: -0.4 },
          adrPct: 0.8,
        },
        riskMatrix: risk(0.16, 0.1, 0.8),
      }),
    ];
    const nodes = buildBasketTradeListNodes({
      rows,
      strategy,
      strategyVariant: "tiered_4w-weekly_hold-none",
      selectedWeek: "all",
      viewMode: adrViewMode,
    });

    const tradeNode = findNode(nodes, (node) => node.level === "trade");
    const gridNode = findNode(nodes, (node) => node.level === "grid");
    const weekNode = findNode(nodes, (node) => node.level === "week");

    expect(gridNode).toBeNull();
    expect(tradeNode?.values.maxMaePct).toBeCloseTo(0.2);
    expect(tradeNode?.values.maxPathDrawdownPct).toBeCloseTo(0.125);
    expect(weekNode?.values.maxMaePct).toBeCloseTo(0.2);
    expect(weekNode?.values.maxPathDrawdownPct).toBeCloseTo(0.125);
  });

  test("does not display raw returns as ADR-normalized level values when ADR context is missing", () => {
    const rows = [
      row({
        rowKind: "grid",
        fillSeq: null,
        parentNaturalRef: null,
        canonicalTradeId: "canonical-grid",
        executionTradeId: "execution-grid",
        returnMatrix: {
          canonical: { rawPct: 0.04 },
          execution: { rawPct: 0.04 },
          adrPct: null,
        },
      }),
      row({
        canonicalTradeId: "canonical-fill",
        executionTradeId: "execution-fill",
        returnMatrix: {
          canonical: { rawPct: 0.04 },
          execution: { rawPct: 0.04 },
          adrPct: null,
        },
      }),
    ];

    const nodes = buildBasketTradeListNodes({
      rows,
      strategy,
      strategyVariant: "tiered_4w-adr_grid-pair_fill_cap",
      selectedWeek: "2026-05-24T23:00:00.000Z",
      viewMode: adrViewMode,
    });

    const gridNode = findNode(nodes, (node) => node.level === "grid");
    const fillNode = findNode(nodes, (node) => node.level === "fill");

    expect(gridNode?.values.returnPct).toBeNull();
    expect(fillNode?.values.returnPct).toBeNull();
  });
});
