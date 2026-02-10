# Research Lab Specification

**Status**: 🟡 Foundation Complete, Building Phase 1A
**Version**: 0.1.0
**Last Updated**: 2026-02-10

---

## Objective
Build a unified, reliable research playground where strategy variants can be configured, backtested, compared, and exported using archived data.

## Product Goals
- Run configurable backtests without code changes.
- Compare strategy variants side-by-side.
- Keep results broker-aware and execution-realistic.
- Reuse existing chart components and account metric UI patterns.

## Non-Goals (v0)
- Tick-perfect fills.
- Full intraday stop/trigger fidelity when only weekly snapshots exist.
- Auto-optimization/grid search.

## Core Principle
Two explicit modes:
- `as_traded_replay`: reproduce actual historical account behavior.
- `hypothetical_sim`: evaluate "what-if" configurations.

Never merge outputs from these modes.

## Strategy Config (canonical)
```ts
type ResearchConfig = {
  mode: "as_traded_replay" | "hypothetical_sim";
  accountKey?: string; // required for replay
  provider: "oanda" | "bitget" | "mt5";
  dateRange: { from: string; to: string };
  universe: {
    assetClasses: Array<"fx" | "indices" | "commodities" | "crypto">;
    symbols?: string[];
  };
  models: Array<"antikythera" | "blended" | "dealer" | "commercial" | "sentiment">;
  execution: {
    legMode: "full_legs" | "net_only";
    includeNeutral: boolean;
    order: "grouped_by_symbol" | "leg_sequence";
  };
  risk: {
    marginBuffer: number;
    leverage?: number;
    sizing: "broker_native" | "fixed_risk";
    stopLoss?: { type: "pct"; value: number };
    trailing?: { startPct: number; offsetPct: number };
  };
  realism: {
    slippageBps?: number;
    commissionBps?: number;
    allowPartialFills: boolean;
  };
};
```

## Result Contract (canonical)
```ts
type ResearchRunResult = {
  runId: string;
  configHash: string;
  generatedAt: string;
  assumptions: {
    dataGranularity: "weekly" | "hourly" | "mixed";
    notes: string[];
  };
  headline: {
    totalReturnPct: number;
    maxDrawdownPct: number;
    winRatePct: number;
    trades: number;
    pricedTrades: number;
  };
  risk: {
    avgMarginUsedPct: number;
    peakMarginUsedPct: number;
    fillRatePct: number;
  };
  equityCurve: Array<{ ts_utc: string; equity_pct: number; lock_pct: number | null }>;
  weekly: Array<{ week_open_utc: string; return_pct: number; drawdown_pct: number }>;
  byModel: Array<{ model: string; return_pct: number; drawdown_pct: number; trades: number }>;
  bySymbol: Array<{ symbol: string; return_pct: number; win_rate_pct: number; trades: number }>;
  byWeekday?: Array<{ weekday: number; return_pct: number; trades: number }>;
};
```

## Reuse Plan
- Keep using `src/components/research/EquityCurveChart.tsx` for Research and Accounts.
- Standardize all run outputs to `equityCurve` contract above.
- Reuse KPI components (`KpiGroup`, `KpiCard`) for run summaries.

## Data Dependencies
- Basket signals archive.
- Performance snapshots archive.
- Broker sizing/margin calculators.
- Account snapshots/trade archives (for replay mode).

## Validation Gates
1. Replay mode reproduces historical account curves within tolerance.
2. Hypothetical baseline approximates replay baseline.
3. Margin/fill constraints produce plausible fill-rate and no impossible exposure.
4. Run is deterministic for same config hash.

## API Plan (v0)
- `POST /api/research/runs` -> start/execute run
- `GET /api/research/runs/:id` -> run result
- `POST /api/research/compare` -> compare run ids
- `GET /api/research/configs` -> saved configs
- `POST /api/research/configs` -> save config

## UI Plan (v0)
- New consolidated page: `/automation/research/lab`
- Panels:
  - Strategy Builder
  - Risk/Execution
  - Scope (date/symbols/asset class)
  - Results (headline + curve + tables)
  - Compare (baseline vs variants)

## Delivery Phases
1. Shared contracts + run persistence + replay baseline endpoint.
2. Hypothetical engine endpoint with model/execution/risk toggles.
3. Lab UI builder + results panels.
4. Compare mode + export.

## Current Status
- Shared research utility foundation added (`src/lib/research/common.ts`).
- Existing research pages now use shared parsing/drawdown/week-option utilities.
- Chart reuse path confirmed and already live across Accounts + Research.
