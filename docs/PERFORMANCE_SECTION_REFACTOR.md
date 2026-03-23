/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
# Performance Section Refactor Plan
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

Date: 2026-03-22
Status: DESIGN — not started

---

## Problem

The Performance section currently shows 12 strategy combinations across 3 different data pipelines (legacy snapshots, DB-backed backtests, and mixed file+seed+live hybrids). Week counts don't match. Sources aren't aligned. Katarakti is broken. An investor looking at this page would see noise, not signal.

---

## Current State (Audit Summary)

### What's displayed now

| Family | Systems | Source | Status |
|--------|---------|--------|--------|
| Universal V1 | 5 baskets | DB-backed (`strategy_backtest_runs`) | Clean |
| Universal V2 | 3 baskets | Legacy `performance_snapshots` | Stale |
| Universal V3 | 4 baskets | Legacy `performance_snapshots` | Stale |
| Tiered V1 | 3 tiers | Derived on-the-fly from `performance_snapshots` | Stale |
| Tiered V2 | 2 tiers | Derived on-the-fly from `performance_snapshots` | Stale |
| Tiered V3 | 3 tiers | Derived on-the-fly from `performance_snapshots` | Stale |
| Katarakti Core (Crypto) | 1 variant | Mixed: DB + files + seed + live overlay | BROKEN |
| Katarakti Core (CFD) | 1 variant | Mixed: DB + files + seed + live overlay | BROKEN |
| Katarakti Lite (Crypto) | 1 variant | DB-first + file fallback | Failed 8-week reset |
| Katarakti Lite (CFD) | 1 variant | DB-first + file fallback | Failed 8-week reset |
| Katarakti v3 (Crypto) | 1 variant | DB-first + file fallback | Promising but hot |
| Katarakti v3 (CFD) | 1 variant | Unavailable | N/A |

**12 strategies. 3 data pipelines. 0 standardized week window.**

### Key files

- Page: `src/app/performance/page.tsx`
- View manager: `src/components/performance/PerformanceViewSection.tsx`
- Card renderer: `src/components/performance/PerformanceGrid.tsx`
- Strategy registry: `src/lib/performance/strategyRegistry.ts`
- Katarakti loader (1913 lines): `src/lib/performance/kataraktiHistory.ts`
- Tiered derivation (919 lines): `src/lib/performance/tiered.ts`
- Model config: `src/lib/performance/modelConfig.ts`
- DB schema: `migrations/016_strategy_backtest_store.sql`

---

## Target State

### Two flagship strategies, investor-ready

| Slot | Strategy | Description | Source |
|------|----------|-------------|--------|
| **Weekly Hold** | Best Universal or Tiered system | Weekly COT-based directional bias, hold Mon-Fri | `strategy_backtest_runs` (canonical 8-week) |
| **Intraday** | Best Katarakti / sweep system | Session-based entries, intraday or multi-day hold | `strategy_backtest_runs` (canonical 8-week) |

### Everything else

- Definitions stored in backend (registry stays, loaders stay)
- Not displayed on the Performance page
- Available via admin/debug view if needed
- Can be promoted back to flagship if future testing justifies it

### Matrix integration

- Matrix section = forward testing view
- Shows full list of weekly gated trades and week-to-date results
- Weekly Hold and Intraday systems both represented
- Performance section = canonical weekly snapshot store (backward-looking)
- Matrix = live forward-test view (current week)

---

## Phase 0: Accuracy Audit (MUST DO FIRST)

Before any refactor, retest ALL currently displayed systems for accuracy.

### Audit checklist

For each of the 12 strategies:

1. **Rerun on canonical 8-week window** (same 8 weeks used in Katarakti cleanup)
2. **Compare rerun result vs what the page currently shows**
3. **Flag discrepancies** — is the page showing inflated/deflated numbers?
4. **Record canonical result** in a single comparison table

### Audit deliverable

A single JSON or markdown file:

```
PERFORMANCE_ACCURACY_AUDIT.md
- For each strategy:
  - Name
  - Current displayed return / WR / DD
  - Rerun 8-week return / WR / DD
  - Delta (how far off is the page?)
  - Verdict: ACCURATE / STALE / BROKEN / INFLATED
```

### Specific audit tasks

- [ ] Rerun Universal V1 on 8-week window → verify vs page
- [ ] Rerun Universal V2 on 8-week window → verify vs page
- [ ] Rerun Universal V3 on 8-week window → verify vs page
- [ ] Rerun Tiered V1/V2/V3 on 8-week window → verify vs page
- [ ] Katarakti Core Crypto: already audited (CLEANUP doc) → +102.75%, 3.64% DD
- [ ] Katarakti Core CFD: already audited → -25.75%, FAILED
- [ ] Katarakti Lite Crypto: already audited → -39.69%, FAILED
- [ ] Katarakti Lite CFD: already audited → -6.96%, FAILED
- [ ] Katarakti v3 Crypto: already audited → +321.12%, 27.42% DD
- [ ] Katarakti v3 CFD: N/A (no data)

**Priority: Universal V1 T1 Gated** — Freedom suspects this is the best weekly hold system. Verify first.

---

## Phase 1: Data Pipeline Consolidation

### Goal

Every strategy displayed on the Performance page reads from ONE source: `strategy_backtest_runs`.

### Tasks

1. **Universal V2/V3**: Migrate from `performance_snapshots` to `strategy_backtest_runs`
   - Write ingestion scripts that read from `performance_snapshots` and persist to `strategy_backtest_runs`
   - Update loaders to read from DB-first (same pattern as V1)

2. **Tiered V1/V2/V3**: Persist computed results instead of deriving on-the-fly
   - After tiering computation, write results to `strategy_backtest_runs`
   - Page reads pre-computed results (faster, auditable)

3. **Katarakti**: Kill the mixed-source loaders
   - Core Crypto: already has DB rows from cleanup → make DB-only
   - Core CFD: already has DB rows from cleanup → make DB-only
   - Remove file fallback chains from `kataraktiHistory.ts`
   - Remove seed data from `kataraktiSeed.ts`
   - Remove live trade overlay logic (live testing moves to Matrix, not Performance)

4. **Retire legacy code**:
   - `kataraktiHistory.ts` (1913 lines) → replace with simple DB reader (~100 lines)
   - `kataraktiSeed.ts` → delete
   - File fallback logic in `readRegistryDbFirstSnapshot()` → remove
   - Live trade overlay in `readCryptoFuturesSnapshot()` and `readMt5ForexSnapshot()` → remove

### Result

All strategies read from `strategy_backtest_runs`. One table. One source. One truth.

---

## Phase 2: Page Simplification

### Goal

Performance page shows 2 flagship strategies with clean investor-facing cards.

### New page layout

```
Performance
├── Header: "Strategy Performance — Last 8 Weeks"
├── Flagship Cards (2)
│   ├── Weekly Hold: [Best Universal/Tiered system]
│   │   ├── Return %
│   │   ├── Win Rate %
│   │   ├── Max Drawdown %
│   │   ├── Trade Count
│   │   └── Weekly breakdown (expandable)
│   └── Intraday: [Best Katarakti/Sweep system]
│       ├── Return %
│       ├── Win Rate %
│       ├── Max Drawdown %
│       ├── Trade Count
│       └── Weekly breakdown (expandable)
├── Comparison Table (optional expand)
│   └── Side-by-side: all systems that passed 8-week audit
└── Historical Archive (optional expand)
    └── All-time equity curves for flagship systems
```

### Tasks

1. **Simplify PerformanceViewSection.tsx** — remove system/variant/style selector complexity
2. **Simplify PerformanceGrid.tsx** — 2 flagship cards, not 12
3. **Remove Universal V1/V2/V3 + Tiered V1/V2/V3 tab switching** — show only the winner
4. **Remove Katarakti variant/market selector** — show only the winner
5. **Add comparison table** — expandable section showing all audited systems for transparency
6. **Keep strategy registry** — definitions stay for backend use, just not all displayed

---

## Phase 3: Matrix Integration

### Goal

Matrix section becomes the forward-testing view for both Weekly Hold and Intraday systems.

### Weekly Hold in Matrix

- Full list of gated trades for current week
- Per-pair: direction, entry price, current P&L, handshake score
- Week-to-date total return
- Color-coded by conviction tier

### Intraday (Katarakti/Sweep) in Matrix

- Sweep/rejection/displacement signals as they form
- Entry status: armed / triggered / active / closed
- Session P&L tracking
- Handshake confirmation status

### Forward test → Performance promotion

- Matrix runs forward tests for N weeks
- After N weeks, results are promoted to `strategy_backtest_runs`
- Performance page updates automatically
- Clean separation: Matrix = live testing, Performance = verified history

---

## Phase 4: Other Sections (Future)

After Performance is clean:

1. **Automation section** — refactor to show only active automations
2. **Research section** — refactor to show current research state (backtests in progress)
3. **Accounts section** — refactor to show connected accounts and live P&L

These are separate workstreams. Performance is first priority.

---

## Decision Log (To Be Filled During Execution)

### Which Weekly Hold system is the flagship?

- [ ] Rerun Universal V1 T1 Gated on 8 weeks → record result
- [ ] Rerun Tiered V3 T1 on 8 weeks → record result
- [ ] Compare → pick winner
- Winner: ________________

### Which Intraday system is the flagship?

- [ ] Complete sweep exit research → record best result
- [ ] Compare vs Katarakti Core Crypto → pick winner
- [ ] If no clear winner yet, show "Research in Progress" placeholder
- Winner: ________________

---

## Codex Prompt (For Phase 0 Accuracy Audit)

When ready to execute Phase 0, use this prompt:

```
Rerun ALL active strategy systems in the Limni Performance section on the
canonical 8-week window (2026-01-19 through 2026-03-09) and produce an
accuracy comparison report.

For each system, compute:
- 8-week cumulative return %
- Win rate %
- Max drawdown %
- Trade count
- Current displayed value on the Performance page (read from page.tsx loaders)

Systems to audit:
1. Universal V1 (all 5 baskets) — read from strategy_backtest_runs
2. Universal V2 (all 3 baskets) — read from performance_snapshots
3. Universal V3 (all 4 baskets) — read from performance_snapshots
4. Tiered V1/V2/V3 (all tiers) — derive from performance_snapshots
5. Katarakti Core Crypto — already audited, use KATARAKTI_8WEEK results
6. Katarakti Core CFD — already audited, use KATARAKTI_8WEEK results
7. Katarakti Lite/v3 — already audited, use KATARAKTI_8WEEK results

Output: reports/performance-accuracy-audit-{timestamp}.json
with per-system comparison of actual 8-week result vs currently displayed value.

Reference files:
- src/app/performance/page.tsx (how data is loaded)
- src/lib/performance/strategyRegistry.ts (strategy definitions)
- src/lib/performance/kataraktiHistory.ts (Katarakti loaders)
- src/lib/performance/tiered.ts (Tiered derivation)
- docs/bots/KATARAKTI_8WEEK_NORMALIZATION_RESULTS_2026-03-22.md (already audited)
```

---

## Summary

| Phase | Scope | Outcome |
|-------|-------|---------|
| 0 | Accuracy audit | Know which numbers are real |
| 1 | Data pipeline consolidation | One source of truth (strategy_backtest_runs) |
| 2 | Page simplification | 2 flagship cards, investor-ready |
| 3 | Matrix integration | Forward testing separated from historical performance |
| 4 | Other sections | Automation, Research, Accounts cleanup |

Do Phase 0 first. Everything else depends on knowing which systems actually work.
