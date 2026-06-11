/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
# Codex Overnight Brief: Performance Section Refactor
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/

Date: 2026-03-22

---

## EXECUTION RULES

1. **Phases are strictly sequential.** Do NOT start Phase N+1 until Phase N is fully complete and its gate condition is met.
2. **Each phase has a gate condition.** The gate is a concrete deliverable that must exist before proceeding.
3. **If any audit number looks suspiciously good (>100% return with <2% DD), flag it and do NOT treat it as the winner without independent recomputation from raw weekly rows.**
4. **Do NOT touch `/flagship` or `/flagship/crypto` pages.** Those are existing matrix pages and must remain unchanged.
5. **Visual polish is scoped to `/performance` and the two new forward-test pages only.** Do not touch other pages.
6. **Use Playwright to verify every visual change.** Take before/after screenshots in both dark and light themes.

---

## Setup (MUST DO FIRST)

```bash
# Install dependencies
npm install

# Install Playwright browsers
npx playwright install chromium

# Enable auth bypass for Playwright
# This sets AUTH_BYPASS=true which skips the login gate in src/middleware.ts
echo "AUTH_BYPASS=true" >> .env.local

# Start the dev server
npm run dev
```

The app runs at `http://localhost:3000`. With `AUTH_BYPASS=true`, all pages are accessible without login.

### Playwright Usage Pattern

After every visual change, verify with Playwright:

```typescript
import { chromium } from 'playwright';

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });

// Dark theme (default)
await page.goto('http://localhost:3000/performance');
await page.waitForLoadState('networkidle');
await page.screenshot({ path: 'screenshots/performance-dark-before.png', fullPage: true });

// Light theme
await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'light'));
await page.screenshot({ path: 'screenshots/performance-light-before.png', fullPage: true });

await browser.close();
```

Save all screenshots to `screenshots/` with naming: `{page}-{theme}-{phase}-{before|after}.png`

---

## Phase 1: Data Accuracy Audit

### HARD BLOCKER — No UI work until this phase is complete.

### Goal

Independently verify every number currently displayed on the Performance page. Determine which strategies are accurate, which are stale, and which are broken.

### Current Data Source Map

Read `src/lib/performance/strategyRegistry.ts` to confirm. The registry defines `dataMode` per strategy:

| Strategy | `entryId` | `dataMode` | Source Table/Logic |
|----------|-----------|------------|-------------------|
| Universal V1 | `universal_v1` | `strategy_backtest_db` | `strategy_backtest_runs` (bot_id: `universal_v1_tp1_friday_carry_aligned`) |
| Universal V2 | `universal_v2` | `performance_snapshots` | `performance_snapshots` table, filtered by model |
| Universal V3 | `universal_v3` | `performance_snapshots` | `performance_snapshots` table, filtered by model |
| Tiered V1 | `tiered_v1` | `tiered_derived` | Derived on-the-fly from `performance_snapshots` via `src/lib/performance/tiered.ts` |
| Tiered V2 | `tiered_v2` | `tiered_derived` | Derived on-the-fly from `performance_snapshots` via `src/lib/performance/tiered.ts` |
| Tiered V3 | `tiered_v3` | `tiered_derived` | Derived on-the-fly from `performance_snapshots` via `src/lib/performance/tiered.ts` |
| Katarakti Core Crypto | `katarakti_core_crypto` | `katarakti_snapshot` | DB-backed via `strategy_backtest_runs` (bot_id: `bitget_perp_v2`) |
| Katarakti Core CFD | `katarakti_core_mt5` | `katarakti_snapshot` | DB-backed via `strategy_backtest_runs` (bot_id: `katarakti_v1`) |
| Katarakti Lite Crypto | `katarakti_lite_crypto` | `katarakti_snapshot` | DB-backed (bot_id: `katarakti_crypto_lite`) |
| Katarakti Lite CFD | `katarakti_lite_mt5` | `katarakti_snapshot` | DB-backed (bot_id: `katarakti_cfd_lite`) |
| Katarakti v3 Crypto | `katarakti_v3_crypto` | `katarakti_snapshot` | DB-backed (bot_id: `katarakti_v3_liq_sweep`) |
| Katarakti v3 CFD | `katarakti_v3_mt5` | `unavailable` | N/A |

### Already Audited (Katarakti) — Use These Values

From `docs/bots/KATARAKTI_8WEEK_NORMALIZATION_RESULTS_2026-03-22.md`:

| System | 8-Week Return | Max DD | Trades | Win Rate | Verdict |
|--------|--------------|--------|--------|----------|---------|
| Core Crypto | +102.75% | 3.64% | 24 | — | SURVIVED |
| Core CFD | -25.75% | 25.75% | 8 | 0% | FAILED |
| Lite Crypto | -39.69% | 39.69% | 2 | — | FAILED |
| Lite CFD | -6.96% | 6.96% | 8 | 0% | FAILED |
| V3 Crypto | +321.12% | 27.42% | 50 | 38% | SURVIVED (hot) |
| V3 CFD | N/A | N/A | N/A | N/A | UNAVAILABLE |

Do NOT re-audit Katarakti. Use these values directly.

### Audit Procedure for Universal + Tiered

For each of the 6 remaining systems (Universal V1/V2/V3, Tiered V1/V2/V3):

1. **Identify the exact source path** — which table, which query, which function loads the data
2. **Read the raw weekly rows** for the canonical 8-week window: `2026-01-19` through `2026-03-09`
3. **Compute from raw rows**:
   - 8-week cumulative return (compounding weekly returns)
   - Win rate (weeks with positive return / total weeks)
   - Max drawdown (peak-to-trough on cumulative equity curve)
   - Total trade count (sum of weekly trades)
4. **Read what the page currently displays** — use Playwright to load `/performance` and extract the displayed values, or trace through the code to find what `page.tsx` renders
5. **Compare** and assign a verdict

### Audit Output Format

Create `reports/performance-accuracy-audit.json`:

```json
{
  "audit_date": "2026-03-22",
  "canonical_window": {
    "start": "2026-01-19",
    "end": "2026-03-09",
    "weeks": 8
  },
  "strategies": [
    {
      "name": "Universal V1 T1 Gated",
      "entry_id": "universal_v1",
      "source_table": "strategy_backtest_runs",
      "source_query": "bot_id='universal_v1_tp1_friday_carry_aligned', variant='v1'",
      "run_id": null,
      "week_set": ["2026-01-19", "2026-01-26", "2026-02-02", "2026-02-09", "2026-02-16", "2026-02-23", "2026-03-02", "2026-03-09"],
      "recomputed_from": "weekly_rows",
      "displayed": {
        "return_pct": null,
        "win_rate_pct": null,
        "max_dd_pct": null,
        "trades": null,
        "weeks_shown": null
      },
      "audited": {
        "return_pct": null,
        "win_rate_pct": null,
        "max_dd_pct": null,
        "trades": null
      },
      "delta": {
        "return_diff_pct": null,
        "win_rate_diff_pct": null
      },
      "verdict": "ACCURATE | STALE | BROKEN | INFLATED | SUSPICIOUS",
      "verdict_reason": "Explain why this verdict was assigned"
    }
  ],
  "katarakti_reference": "Values from docs/bots/KATARAKTI_8WEEK_NORMALIZATION_RESULTS_2026-03-22.md — not re-audited",
  "flagship_candidates": {
    "weekly_hold": {
      "winner": null,
      "reason": null
    },
    "intraday": {
      "winner": null,
      "reason": null
    }
  }
}
```

### SUSPICIOUS flag

If any system shows >100% return with <2% drawdown, mark it `SUSPICIOUS` and:
- Recompute from individual weekly rows independently
- Check if the weekly rows themselves look realistic
- Do NOT promote it as flagship without confirming the raw data makes sense

### Priority Order

1. **Universal V1** — most likely weekly hold flagship (has `strategy_backtest_db` source)
2. **Tiered V3** — potential alternative weekly hold
3. **Universal V2, V3** — legacy snapshots, verify staleness
4. **Tiered V1, V2** — legacy derived, verify staleness

### Gate Condition for Phase 1

`reports/performance-accuracy-audit.json` exists with all 12 strategies audited and `flagship_candidates` populated with reasoned picks.

---

## Phase 2: Data Normalization

### HARD BLOCKER — Do NOT proceed until Phase 1 gate is met.

### Goal

Ensure every strategy that will be displayed on the Performance page reads from `strategy_backtest_runs` only. No legacy sources on the display path.

### Current Reality

From the registry, the data modes are mixed:
- `universal_v1`: `strategy_backtest_db` ✓ already DB-first
- `universal_v2`: `performance_snapshots` ✗ needs migration
- `universal_v3`: `performance_snapshots` ✗ needs migration
- `tiered_v1/v2/v3`: `tiered_derived` ✗ needs pre-computation + persistence
- Katarakti: already DB-backed ✓

### Normalization Tasks

**Only normalize systems that will be displayed.** Based on the Phase 1 audit:

1. **If the weekly hold flagship is Universal V1**: No normalization needed — it already reads from `strategy_backtest_runs`.

2. **If the weekly hold flagship is a Tiered or Universal V2/V3 system**: Write an ingestion script that:
   - Reads the canonical 8-week results from whatever source was audited
   - Persists them into `strategy_backtest_runs` using the schema in `migrations/016_strategy_backtest_store.sql`
   - Creates rows in `strategy_backtest_weekly` for each of the 8 weeks
   - Creates rows in `strategy_backtest_trades` if trade-level data is available

3. **For the intraday flagship** (likely Katarakti Core Crypto): Already DB-backed, no normalization needed.

4. **Update the strategy registry** (`src/lib/performance/strategyRegistry.ts`):
   - Set `dataMode: "strategy_backtest_db"` for the flagship entries
   - Add `backtestBotId`, `backtestVariant`, `backtestMarket` if missing

5. **Update the Performance page data loader** (`src/app/performance/page.tsx`):
   - Flagship cards read from `strategy_backtest_runs` ONLY
   - Remove legacy `performance_snapshots` reads for flagship systems
   - Remove on-the-fly tiered derivation for flagship systems
   - Keep legacy code paths intact for non-flagship systems (they just won't be displayed)

### DB Schema Reference

```sql
-- strategy_backtest_runs: one row per strategy config
-- Fields: id, bot_id, variant, market, strategy_name, backtest_weeks, config_json, ...
-- UNIQUE (bot_id, variant, market, config_key)

-- strategy_backtest_weekly: one row per week per run
-- Fields: id, run_id, week_open_utc, return_pct, trades, wins, losses, drawdown_pct, ...

-- strategy_backtest_trades: one row per trade per run
-- Fields: id, run_id, week_open_utc, symbol, direction, pnl_pct, exit_reason, ...
```

### Gate Condition for Phase 2

- Both flagship systems read from `strategy_backtest_runs`
- The Performance page loads and displays correct numbers for both flagships
- Verify with Playwright: load `/performance`, confirm 2 flagship cards show expected values

---

## Phase 3: Performance Page Simplification

### HARD BLOCKER — Do NOT proceed until Phase 2 gate is met.

### Goal

Reduce the Performance page from 12 strategy tabs to 2 flagship cards with an optional comparison expander.

### Target Layout

```
Performance
├── Header: "Strategy Performance — Last 8 Weeks"
├── Flagship Cards (2, side by side on desktop, stacked on mobile)
│   ├── Weekly Hold: [audit winner]
│   │   ├── Return % (large, prominent)
│   │   ├── Win Rate %
│   │   ├── Max Drawdown %
│   │   ├── Trade Count
│   │   ├── Weeks Covered
│   │   └── Weekly breakdown (expandable accordion)
│   └── Intraday: [audit winner]
│       ├── Return % (large, prominent)
│       ├── Win Rate %
│       ├── Max Drawdown %
│       ├── Trade Count
│       ├── Weeks Covered
│       └── Weekly breakdown (expandable accordion)
├── "All Systems" Comparison (collapsed by default)
│   └── Table: all 12 systems with audited 8-week metrics
│       └── Shows: name, return%, WR%, DD%, trades, verdict badge
└── Footer: data source label ("Canonical 8-week backtest, 2026-01-19 to 2026-03-09")
```

### Implementation

1. **Simplify `PerformanceViewSection.tsx`**:
   - Remove the family tab switcher (Universal / Tiered / Katarakti tabs)
   - Remove the system version switcher (V1 / V2 / V3 tabs)
   - Remove the Katarakti variant/market selector
   - Replace with a single view that shows 2 flagship cards
   - Add a collapsible "All Systems" section below

2. **Create a new `FlagshipCard` component** or simplify `PerformanceGrid.tsx`:
   - Clean, investor-facing card with the metrics listed above
   - Weekly breakdown as expandable accordion inside the card
   - Use existing design tokens from `globals.css`

3. **Keep all existing code intact but unused**:
   - Do NOT delete `PerformanceViewCards.tsx`, tiered derivation, Katarakti loaders
   - Just don't render them on the main page anymore
   - They stay available for admin/debug views

4. **The strategy registry stays unchanged** — it's used by other systems

### Verification

Use Playwright to screenshot the simplified page at:
- 1440px desktop (dark + light)
- 1024px tablet (dark + light)
- 375px mobile (dark + light)

### Gate Condition for Phase 3

- Performance page shows exactly 2 flagship cards
- "All Systems" comparison section exists and is collapsed by default
- All displayed numbers match the audit values from Phase 1
- `npm run build` passes with zero errors

---

## Phase 4: Visual Polish (Performance Page Only)

### HARD BLOCKER — Do NOT proceed until Phase 3 gate is met.

### Goal

Make the 2-flagship Performance page look polished, institutional, investor-ready.

### Design System Reference

```css
/* Dark theme (default) */
--background: #0a1a2f;
--foreground: #f5f3ee;
--panel: #0f243d;
--panel-border: #1f3a55;
--accent: #00a488;
--accent-strong: #00c4a0;
--muted: #b8c0cc;
--glow: rgba(0, 196, 160, 0.2);

/* Light theme */
--background: #f5f3ee;
--foreground: #0a1a2f;
--panel: #fffdf8;
--panel-border: #c0c0c0;
--accent: #006b5e;
--accent-strong: #005247;
--muted: #5b6473;
```

Fonts: `font-sans` (Source Sans, body), `font-serif` (Libre Baskerville, headings), `font-mono` (IBM Plex Mono, data/numbers)

### Polish Checklist

- [ ] **Flagship cards**: `bg-[var(--panel)]/80`, `border border-[var(--panel-border)]`, `rounded-2xl`, `p-5`
- [ ] **Return percentage**: Large (`text-3xl font-mono font-bold`), green if positive, red if negative
- [ ] **Secondary metrics**: Smaller (`text-sm font-mono`), muted labels (`text-[color:var(--muted)]`)
- [ ] **Weekly breakdown**: Clean table rows with `border-b border-[var(--panel-border)]/30`, alternating subtle backgrounds
- [ ] **Comparison table**: Consistent column widths, sortable if practical, verdict badges with color coding
- [ ] **Spacing**: `gap-6` between flagship cards, `gap-4` inside cards, `space-y-8` between major sections
- [ ] **Hover states**: Cards get `hover:border-[var(--accent)]/40` with `transition-all duration-200`
- [ ] **Responsive**: Cards stack vertically below 768px, table scrolls horizontally below 1024px
- [ ] **Both themes**: Equal polish in dark and light

### Things NOT To Do

- Do NOT change navigation structure
- Do NOT modify business logic or data fetching beyond what Phase 2/3 required
- Do NOT add new npm dependencies
- Do NOT modify the auth system
- Do NOT create unnecessary wrapper components
- Do NOT add distracting animations

### Gate Condition for Phase 4

- Before/after screenshots saved for Performance page (dark + light, desktop + tablet + mobile)
- Visual quality is institutional-grade
- `npm run build` passes

---

## Phase 5: Forward-Test Matrix Pages (NEW PAGES)

### HARD BLOCKER — Do NOT proceed until Phase 4 gate is met.

### Goal

Add two new forward-testing pages as sibling routes. These show the current week's live forward-test view for each flagship system.

### CRITICAL: Do NOT modify existing pages

- `/flagship` (existing Matrix page) — DO NOT TOUCH
- `/flagship/crypto` (existing crypto matrix) — DO NOT TOUCH

### New routes to create

1. **`/flagship/weekly-hold`** — Forward-test view for the Weekly Hold flagship
2. **`/flagship/intraday`** — Forward-test view for the Intraday flagship

### Weekly Hold Forward-Test Page (`/flagship/weekly-hold`)

```
Weekly Hold Forward Test — Current Week
├── Header: strategy name, week dates, data source
├── Active Trades Table
│   ├── Per pair: symbol, direction, entry price, current P&L, handshake score
│   ├── Color coded by conviction tier
│   └── Sortable by P&L
├── Week Summary
│   ├── Week-to-date return %
│   ├── Trades opened / closed this week
│   └── Win rate this week
└── Footer: "Forward test — not yet promoted to Performance"
```

### Intraday Forward-Test Page (`/flagship/intraday`)

```
Intraday Forward Test — Current Week
├── Header: strategy name, week dates, data source
├── Signal Status Table
│   ├── Per signal: symbol, session, sweep status, entry status
│   ├── Status: armed / triggered / active / closed
│   └── Session P&L tracking
├── Week Summary
│   ├── Week-to-date return %
│   ├── Signals generated / trades taken this week
│   └── Win rate this week
└── Footer: "Forward test — not yet promoted to Performance"
```

### Implementation Notes

- These pages will likely show placeholder/empty state initially (no live forward-test data pipeline exists yet)
- Design them with the correct layout and empty states
- Data integration will come later when the forward-test pipeline is built
- Use the same design system as the Performance page
- Add navigation entries in `DashboardLayout.tsx` under the existing Matrix section (as sub-nav, not top-level)

### Verification

Use Playwright to screenshot both new pages in dark + light themes.

### Gate Condition for Phase 5

- Both new pages exist and render without errors
- They use the same design system as Performance
- Existing `/flagship` and `/flagship/crypto` pages are completely unchanged
- `npm run build` passes

---

## Phase 6: Final Visual Polish on New Pages

### HARD BLOCKER — Do NOT proceed until Phase 5 gate is met.

### Goal

Apply the same visual polish standards from Phase 4 to the two new forward-test pages.

### Same checklist as Phase 4, applied to:
- `/flagship/weekly-hold`
- `/flagship/intraday`

### Gate Condition for Phase 6

- Before/after screenshots saved for both new pages (dark + light, desktop + tablet + mobile)
- `npm run build` passes with zero errors
- All screenshots saved to `screenshots/` directory

---

## Key Reference Files

### Performance Section
- `src/app/performance/page.tsx` — Performance page (1068 lines, server component)
- `src/components/performance/PerformanceViewSection.tsx` — view manager (client component)
- `src/components/performance/PerformanceGrid.tsx` — card renderer (client component)
- `src/components/performance/PerformanceViewCards.tsx` — view card definitions
- `src/components/performance/PerformanceModal.tsx` — detail modal
- `src/components/performance/PerformanceHeaderContext.tsx` — header context display
- `src/components/performance/PerformanceComparisonPanel.tsx` — comparison panel
- `src/components/performance/PerformanceGatedSetups.tsx` — gated setup display
- `src/components/performance/PerformancePeriodSelector.tsx` — period selector
- `src/components/performance/StrategyPerformanceSummary.tsx` — strategy summary

### Matrix (DO NOT MODIFY)
- `src/app/flagship/page.tsx` — existing Matrix page
- `src/app/flagship/crypto/page.tsx` — existing crypto matrix
- `src/components/flagship/FlagshipBoard.tsx` — existing board component

### Data Layer
- `src/lib/performance/strategyRegistry.ts` — strategy definitions + registry (597 lines)
- `src/lib/performance/modelConfig.ts` — model configuration
- `src/lib/performance/kataraktiHistory.ts` — Katarakti loaders (1913 lines)
- `src/lib/performance/tiered.ts` — tiered derivation (919 lines)
- `src/lib/performance/allTime.ts` — all-time performance
- `src/lib/performance/drawdown.ts` — drawdown computation
- `src/lib/performanceSnapshots.ts` — snapshot reader
- `src/lib/performanceLab.ts` — model performance computation

### Layout
- `src/components/DashboardLayout.tsx` — main layout with navigation
- `src/app/layout.tsx` — root layout
- `src/app/globals.css` — design system variables + global styles

### DB Schema
- `migrations/016_strategy_backtest_store.sql` — `strategy_backtest_runs`, `strategy_backtest_weekly`, `strategy_backtest_trades`

### Auth
- `src/middleware.ts` — `AUTH_BYPASS=true` skips all auth checks (already in place)

### Audit Reference Docs
- `docs/PERFORMANCE_SECTION_REFACTOR.md` — full refactor plan
- `docs/bots/KATARAKTI_8WEEK_NORMALIZATION_RESULTS_2026-03-22.md` — Katarakti 8-week audit
- `docs/bots/UNIFIED_KATARAKTI_GATED_SWEEP_RESULTS_2026-03-22.md` — sweep entry results
- `docs/bots/CFD_TRIGGER_PROGRESS_AND_KATARAKTI_RESET_2026-03-21.md` — CFD trigger state

---

## File Header Standard

Every new or significantly modified code file MUST include:

```
/*-----------------------------------------------
  Property of Freedom_EXE  (c) 2026
-----------------------------------------------*/
/**
 * File: <relative-path>
 *
 * Description:
 * <what it does, what it connects to>
 */
/*-----------------------------------------------
  Manifested by Freedom_EXE
-----------------------------------------------*/
```

---

## Summary: Overnight Execution Sequence

| Phase | Gate | Scope |
|-------|------|-------|
| 1. Audit | `reports/performance-accuracy-audit.json` with all 12 strategies + flagship picks | READ ONLY — no code changes |
| 2. Normalize | Flagship systems read from `strategy_backtest_runs` | Data layer only — registry + loader changes |
| 3. Simplify | Performance page shows 2 flagship cards | UI refactor — `page.tsx` + `PerformanceViewSection.tsx` |
| 4. Polish Performance | Before/after screenshots, institutional quality | CSS/layout only on Performance page |
| 5. Forward-Test Pages | 2 new pages exist at `/flagship/weekly-hold` and `/flagship/intraday` | New route + component creation |
| 6. Polish New Pages | Before/after screenshots for new pages | CSS/layout only on new pages |

**Total: 6 phases. Each gated. No skipping.**
