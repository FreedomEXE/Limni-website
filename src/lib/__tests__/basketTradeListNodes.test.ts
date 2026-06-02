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

    const fillNodes = nodes[0]?.children?.[0]?.children?.[0]?.children ?? [];

    expect(fillNodes.map((node) => node.label)).toEqual(["Fill 1", "Fill 2", "Fill 3"]);
    expect(fillNodes.map((node) => node.values.sourceFillSeq)).toEqual([6, 8, 12]);
    expect(fillNodes.map((node) => node.values.displayFillSeq)).toEqual([1, 2, 3]);
  });
});
