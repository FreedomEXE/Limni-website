# Codex Review — Strategy Engine & App Architecture

## Context

You are reviewing the Limni Labs codebase — a multi-asset trading intelligence platform (Next.js 16, React 19, TypeScript, PostgreSQL, Tailwind CSS 4). Over the last few sessions, a significant amount of work has been done to build a strategy engine, but the implementation has architectural problems that need to be fixed before we continue.

**Read these files first to understand the current state:**
- `.claude/CLAUDE.md` — project identity, code standards, file headers
- `docs/ADR_STRATEGY_BACKTEST_RESULTS_2026-03-27.md` — strategy research results
- `src/lib/performance/strategyConfig.ts` — strategy/filter configuration (3 levels)
- `src/lib/performance/weeklyHoldEngine.ts` — the strategy engine (executor registry)
- `src/lib/performance/engineAdapter.ts` — converts engine output to UI grid props
- `src/components/shared/StrategySidebar.tsx` — shared sidebar (strategy selector + stats)
- `src/components/shared/StrategySelector.tsx` — shared 3-level dropdown (strategy × f1 × f2)
- `src/app/performance/page.tsx` — Performance page (server-side computation, works well)
- `src/app/matrix/page.tsx` — Matrix page (broken, needs redesign)
- `src/components/flagship/FlagshipBoard.tsx` — Matrix board (client-side, 9+ API calls, janky)
- `src/components/performance/PerformanceViewSection.tsx` — Performance view (basket, summary, simulation)

---

## What Was Built (Last 3 Sessions)

### Strategy Configuration (`strategyConfig.ts`)
Three-level selection system:
- **Strategy** (bias source): Dealer, Commercial, Sentiment, Tiered V3, 2-of-3 Agree, Tandem
- **Filter 1** (basket): Weekly Hold (future: COT Gate, etc.)
- **Filter 2** (intraday): None, ADR Pullback (future: Stoch RSI, ADR+Stoch)

Each intraday filter declares a `plModel` ("weekly_hold" or "adr") that determines the P&L calculation.

### Strategy Engine (`weeklyHoldEngine.ts`)
- **Executor registry**: `EXECUTORS` map routes by `plModel`. Adding a new strategy = write 1 function + add 1 line to the map.
- **Weekly hold executor**: reads `pair_period_returns` (open→close P&L)
- **ADR executor** (`executeAdr`): reads `strategy_backtest_trades` (0.25% per TP, actual loss at week close)
- **Direction filtering**: ADR trades are filtered by the selected bias source's direction signals. Different bias source = different trade subset.
- **Direction resolvers**: per bias source — dealer/commercial from COT snapshots, sentiment from aggregates, tiered_v3/agree_2of3/tandem composed from the base 3.

### Engine Adapter (`engineAdapter.ts`)
Converts `WeeklyHoldResult` → `EngineGridProps` for the UI:
- Card breakdown: asset_class (FX/Commodities/Crypto), tiers (1/2/3), per_model (Dealer/Commercial/Sentiment)
- Trade grouping by symbol with expandable children
- Trade detail metadata (entry, exit, TP, MAE, ADR%)
- Multi-week aggregation with equity curves and all-time stats

### Scanner Infrastructure (already working)
- `adrWeekScanner.ts` — scans M5 bars for ADR entries/TPs per week
- `adrTradeScanner.ts` — Fresh Start state machine (anchor tracking, pullback entries)
- Hourly cron at `:25` past each hour keeps current week data fresh
- All trades stored in `strategy_backtest_trades` with run_id=54

### ADR Indicator (PineScript)
- `scripts/pinescript/limni-adr-levels.pine` — 100% parity achieved with scanner on 23 pairs
- Weekly Dynamic with Fresh Start re-entry
- Week selector for historical viewing

---

## What Works

1. **Performance page**: Server-side pre-computes ALL weeks via `computeMultiWeekHold`. Client switches weeks instantly from `engineWeekMap`. No flicker, no re-fetching.
2. **Strategy selector**: Shared 3-level dropdown writes URL params. Both sections read them.
3. **Shared sidebar**: `StrategySidebar` shows strategy selector + engine stats. Used by Performance and Matrix.
4. **Executor registry**: Clean plug-and-play pattern for adding new strategies.
5. **Direction filtering**: Each bias source shows different ADR trade subsets.
6. **Basket view**: Expandable trade groups with entry/exit/TP/MAE detail.

## What's Broken

### 1. Matrix Page — Fundamental Architecture Problem
The Matrix page (`FlagshipBoard.tsx`) is a **client component** that makes **9+ separate API calls** on mount and on every week/filter change:
- `/api/flagship/canonical-weekly-basket`
- `/api/flagship/cot-matrix`
- `/api/flagship/sentiment-daily`
- `/api/flagship/currency-strength`
- `/api/flagship/asset-strength`
- `/api/flagship/menthorq-overlay`
- `/api/flagship/live-sizing`
- `/api/flagship/price-moves`
- `/api/flagship/intraday-levels`
- `/api/flagship/adr-trades`

This causes: flicker on week switch, race conditions, empty states, inconsistent data, slow performance. Compare to Performance which pre-computes server-side and passes props.

### 2. No Canonical Data Layer
The same trade data is fetched/computed independently by each section:
- Performance: `computeMultiWeekHold` server-side ✓
- Matrix: client-side `fetch(/api/flagship/adr-trades)` ✗
- Data section: reads `pair_period_returns` directly
- Research/Automation: separate data paths

**The rule**: If multiple sections show the same trades, they MUST share one canonical source. Compute once, show everywhere.

### 3. Matrix UI Has Hardcoded ADR-Specific Elements
The FlagshipBoard has ADR-specific UI (AdrStatsBar, ADR DIP badges, custom trigger columns) that should be driven by the filter selection, not hardcoded. When f2=none, the ADR elements should disappear. When a future filter like stoch is added, it should work without touching the board.

### 4. The Matrix Shows Different Data Than Performance
Even when both sections use the same strategy+filter, the numbers don't always match because they compute from different sources with different code paths.

---

## Architecture Goal

```
Strategy Engine (server-side, computed once per page load)
  ├── computeMultiWeekHold(strategy, allWeeks, intradayFilter)
  ├── Returns: WeeklyHoldResult[] with trades, stats, detail
  └── Canonical source of truth for ALL sections

  Consuming sections (client-side, display only):
  ├── Performance — summary cards, equity curves, basket drill-down
  ├── Matrix — live pair table, trade detail, trigger states
  ├── Data — weekly bias + hold returns (already canonical via pair_period_returns)
  ├── Research — backtest results, strategy comparison
  └── Automation — bot status, forward test results

  Live-only data (client-side fetch, OK to re-fetch):
  ├── Current prices, trigger states, currency strength
  ├── Account sizing, position status
  └── News, calendar events
```

**Key distinction**: Historical trade data (what happened last week) = server-computed canonical. Live market data (what's happening now) = client-fetched real-time.

---

## Immediate Tasks

### Task A: Fix the Canonical Data Architecture
Make the strategy engine the single source of truth for all sections. The Matrix page should receive pre-computed trade data as props (same as Performance), not fetch client-side. Week switching should be instant (pick from pre-computed map). Stats should come from the engine, not from separate API calls.

### Task B: Matrix UI Cleanup
From the session notes (`NYX_SESSION.md` → Phase 3: Matrix Polish):
- Remove "SKIP" from core bias column
- Remove "ADR DIP" / "GATED" colored bubbles next to pair names
- Pair % next to pair name = simple weekly hold P/L (open→close)
- Unify Crypto matrix to share same component code as CFD matrix
- P/L model for intraday strategies: TP hit = +0.25%, Loss = week-close price return

### Task C: Future Strategies (AFTER A and B)
- Add Stoch RSI to Pine indicator as toggle
- Add Stoch RSI executor to the engine
- Add "stoch_rsi" and "adr_stoch" to INTRADAY_FILTERS
- Backfill stoch variant
- Test via Performance section — should just work with the executor registry

---

## Database Tables

**Canonical weekly data:**
- `pair_period_returns` — weekly open/close per pair (used by weekly hold executor)
- `cot_snapshots` — dealer/commercial biases per week
- `sentiment_aggregates` — retail sentiment per week

**Intraday trade data:**
- `strategy_backtest_runs` — run metadata (bot_id="adr-forward", variant="fresh-start")
- `strategy_backtest_trades` — per-trade entry/exit, P&L, metadata (used by ADR executor)
- `strategy_backtest_weekly` — weekly aggregates

---

## Code Standards

- File headers required (see `.claude/CLAUDE.md`)
- Reuse existing components — NEVER create section-specific wrappers for shared functionality
- Production-level code only — no TODOs, no temp solutions
- Prefer simple over clever
- No patches on patches — if approach is wrong, redesign

---

## Questions for Codex Review

1. Is the executor registry pattern in `weeklyHoldEngine.ts` the right abstraction? Are there edge cases it doesn't handle?
2. Does the `engineAdapter.ts` grouping/slotting logic handle all card breakdown types correctly?
3. What's the cleanest way to make FlagshipBoard receive pre-computed data without a full rewrite? Can we incrementally migrate it?
4. Should the canonical data layer be a React context, a server-side cache, or just props from the page?
5. Are there type safety gaps in the current engine → adapter → component pipeline?
