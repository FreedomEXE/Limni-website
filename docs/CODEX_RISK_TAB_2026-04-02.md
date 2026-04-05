# Codex Prompt: Risk Management Tab for Matrix Page

## Review Note For Nyx

The simplifications and scope changes in this doc were requested directly by **Freedom** after reviewing the original version with Codex.

Please review the **design quality, implementation safety, and sizing-source logic**. Do not push back on these scope reductions unless there is a concrete architectural issue:

- Freedom wants the Risk tab kept **as simple as possible**
- Freedom does **not** want a week-by-week replay/status simulator in this first pass
- Freedom does **not** want per-pair SL/TP fields in the Risk tab
- Freedom wants the tab optimized around **correct sizing**, not around extra diagnostics
- Freedom does **not** want to manually send broker screenshots for every symbol
- Freedom wants broker sizing to come from the existing **MT4/MT5 sizing/export path** wherever possible, with site defaults only as fallback

## Goal

Add a third tab ("Risk") to the Matrix page that becomes the single source of truth for:

- account selection
- scale factor
- weekly basket execution sizing
- copyable execution instructions

Remove sizing/account UI from the CFD and Crypto tabs.

This first pass should be intentionally simple. The hard part is not UI complexity. The hard part is making sure the sizing is correct for the selected broker/account.

## Context

The Matrix page currently has 2 tabs: CFD and Crypto. Both tabs independently render a `SizingAccountBar` and compute `calculateLotSize()` per pair row. We are consolidating all of that into a dedicated Risk tab.

The live trading system is:

**2-of-3 NoComm + Calendar Additive Layering + TR 1.25/0.5 + S1 safety**

Execution rules:

- Monday: enter full basket at **1/5 scale** (ADR normalized)
- Tuesday: if trailing hasn't activated → add **1/10 more**
- Wednesday: if still no trail → add **1/10 more** (max total 2/5)
- Trail activation: **+1.25% account P&L** → trail by **0.5%**
- Safety rule S1: **skip adding layers if current P&L < -1%**
- Hold to Friday if trail never activates

## Important Product Direction From Freedom

This should **not** become a complex operational dashboard in phase 1.

Freedom wants this to function primarily as:

1. a place to select/edit the account
2. a place to see the current week's pairs and directions
3. a place to see the **correct lot sizes**
4. a place to copy those sizes into the broker

That means:

- no week-by-week historical state reconstruction UI
- no per-pair SL/TP columns
- no heavy live-status simulation
- no extra broker setup burden that requires screenshotting every instrument manually

## Sizing Source Of Truth

This is the most important part of the build.

### Required behavior

The Risk tab must prefer **broker-derived sizing context** over hardcoded generic defaults.

Use this sizing priority:

1. **MT4/MT5 broker lot-map/spec data** if available for the selected account
2. existing site-side `instrumentOverrides`
3. existing generic defaults from `instrumentDefaults.ts`

### Why

Freedom explicitly does **not** want to manually send screenshots for every broker and every asset. If sizing is wrong for even one pair, the whole execution plan becomes dangerous.

The repo already has existing MT5 sizing infrastructure:

- `mt5_accounts.lot_map`
- `mt5_weekly_plans.lot_map`
- MT5 push route support for `lot_map`
- `Mt5LotMapEntry` with broker-spec fields

That means the design should reuse existing broker-side sizing data instead of expanding the manual override workflow.

### Implication for this implementation

The Risk tab should be designed so that:

- it can read broker sizing context from existing `lot_map`-style data when available
- it can fall back safely to current site sizing code when broker data is absent
- it does **not** force full broker integration inside this UI task if that wiring is not ready yet

If a follow-up is needed, the correct follow-up is:

- update the MT4/MT5 sizing/export script to emit broker sizing specs cleanly
- store or ingest that data in the same shape the site already understands

Do **not** redesign the Risk tab around manual broker screenshots.

## Architecture

### Phase 0: Change the default strategy to 2-of-3 NoComm

The site currently defaults to `"dealer"` when no strategy is specified in the URL. Since 2-of-3 NoComm is the live trading system, it should be the default everywhere.

**File: `src/lib/performance/strategyConfig.ts`**

In `resolveStrategyId()`, change the fallback from `"dealer"` to `"agree_2of3_nocomm"`:

```ts
export function resolveStrategyId(value: string | undefined | null): string {
  const normalized = normalizeStrategyLookupId(value);
  if (normalized && STRATEGIES.some((s) => s.id === normalized)) return normalized;
  return "agree_2of3_nocomm";
}
```

This affects both the Matrix page and the Performance page since they both call `resolveStrategyId()` to determine the initial strategy selection. No other changes needed — the sidebar strategy selector still works as before, this just changes what loads by default.

### Phase 1: Add Risk tab to MatrixControls

**File: `src/components/matrix/MatrixControls.tsx`**

Add `"risk"` to the `MatrixTab` type and `TABS` array:

```ts
export type MatrixTab = "cfd" | "crypto" | "risk";

const TABS = [
  { key: "cfd", label: "CFD" },
  { key: "crypto", label: "Crypto" },
  { key: "risk", label: "Risk" },
] as const;
```

**File: `src/app/matrix/page.tsx`**

Update `resolveTab` to handle `"risk"`.

**File: `src/components/matrix/MatrixViewSection.tsx`**

Add conditional render for the Risk tab:

```tsx
{selectedTab === "risk" ? (
  <RiskBoard
    weekOpenUtc={selectedWeek}
    currentWeekOpenUtc={currentWeekOpenUtc}
    selection={selectedSelection}
    engineWeekResults={engineWeekResults}
    canonicalSignals={canonicalSignals}
    weeklyReturns={weeklyReturns}
  />
) : null}
```

### Phase 2: Remove sizing from CFD and Crypto boards

**File: `src/components/flagship/FlagshipBoard.tsx`**

Remove:

- `useSizingAccounts()` hook call and all destructured values
- `SizingAccountBar` import and render
- the "Sizing" column header
- the sizing cell per row that shows lot size/risk
- `InstrumentConfigModal` render/state from this board
- `calculateLotSize` import
- `getInstrumentSpec` import if no other usage remains
- any sizing-only helpers

Keep everything else.

**File: `src/components/flagship/CryptoBoard.tsx`**

Same removals:

- `useSizingAccounts()` hook call
- `SizingAccountBar` import and render
- `calculateLotSize` import
- sizing column from the table
- sizing modal state/render

### Phase 3: Build RiskBoard component

**New file: `src/components/matrix/RiskBoard.tsx`**

This is the main component for the Risk tab. It is a client component (`"use client"`).

**Props**

```ts
type RiskBoardProps = {
  weekOpenUtc: string | null;
  currentWeekOpenUtc: string;
  selection: RuntimeStrategySelection;
  engineWeekResults: Record<string, WeeklyHoldResult> | null;
  canonicalSignals: CanonicalSignal[];
  weeklyReturns: WeeklyReturnRow[];
};
```

#### Strategy awareness

The Risk tab is connected to the sidebar strategy selector — the same `selection` prop that drives CFD and Crypto. When the user switches strategy in the sidebar, the Risk tab updates to show that strategy's basket and lot sizes.

The default strategy is now `agree_2of3_nocomm` (changed in Phase 0), so the Risk tab will load with the live system's basket by default. The user can still switch to other strategies to compare, but won't accidentally trade a different system.

The summary panel (Section 3) should display the **strategy label** so it's always clear which strategy's basket is being shown.

#### Section 1: Account Management

Render the existing `SizingAccountBar` at the top. This is now the ONLY place it appears. Use the `useSizingAccounts()` hook here.

Add a new editable field to the account: **Scale Factor**.

This is a number between `0` and `1` that represents what fraction of the calculated lot size to actually trade.

Default: `0.2` (which is `1/5`).

To add scale factor, extend the `SizingAccount` type in `src/lib/flagship/positionSizer.ts`:

```ts
export type SizingAccount = {
  // ... existing fields ...
  scaleFactor: number; // 0-1, default 0.2
};
```

Update `createDefaultAccount()` to include `scaleFactor: 0.2`.

Update `SizingAccountBar` to show an inline editable scale factor field. Label: `Scale`.

Display style:

- `0.2` -> `1/5`
- `0.1` -> `1/10`
- otherwise show decimal

Update `useSizingAccounts.ts` validation in `parseAccounts` to handle the new field and default to `0.2` for backwards compatibility.

#### Section 2: Execution Plan Table

This is the core of the Risk tab. Keep it simple.

A table showing every pair in the current week's basket with just the lot sizes needed for execution.

**Data source**

Use `engineWeekResults` for the selected week. Extract trades from the `WeeklyHoldResult`.

For each trade, compute lot sizes using the sizing priority above:

1. broker lot-map/spec context when available
2. account overrides
3. `calculateLotSize()` + `getInstrumentSpec()` fallback

The point is not to display every possible metric. The point is to show the correct executable size.

**Columns**

| Column | Description |
|--------|-------------|
| **Pair** | Symbol name (e.g., EURUSD) |
| **Dir** | LONG / SHORT with directional color |
| **Base Lots** | Monday base entry size at scale factor `1/5`. **Monospace, bold, click-to-copy.** |
| **Add Lots** | Tuesday/Wednesday add size at scale factor `1/10` (half the base layer). Click-to-copy. |
| **Max Lots** | Total if all 3 layers entered |
| **ADR %** | Optional sanity column if already available cheaply |

Freedom does **not** want per-pair SL/TP fields in this first pass.

**Lot size calculation for Base**

- compute the full-size lot using the current sizing engine
- multiply by `account.scaleFactor`
- round to the broker/spec lot step

**Lot size calculation for Add**

- same underlying sizing basis
- multiply by `account.scaleFactor * 0.5`
- round to the broker/spec lot step

**Important note**

From the tested execution model, Tuesday and Wednesday adds are the same size. So the UI only needs one `Add Lots` column, not separate Tue/Wed columns.

**Click-to-copy behavior**

- when user clicks a lot size cell, copy the number to clipboard
- show a brief copied state
- use `navigator.clipboard.writeText()`

**Sort**

- group by asset class
- then alphabetically by symbol within each group

#### Section 3: Minimal Summary Panel

Keep this section lightweight. Do not build a complex live status simulator in phase 1.

Recommended fields:

- account name
- balance
- scale factor
- strategy label
- base layer = `1/5`
- add layer = `1/10`
- trail plan = `1.25 / 0.5`
- safety rule = `S1`
- optional total lots / total margin summary if cheap to compute

Do **not** spend time on week-by-week layer-state reconstruction UI in this pass unless it falls out naturally from existing data.

#### Section 4: Copy All Button

A prominent button at the bottom: **"Copy Execution Plan"**

When clicked, copy a formatted text block like:

```text
=== WEEK OF APR 06 — 2-of-3 NoComm ===
Account: Prop Account 1 ($25,000) | Scale: 1/5

BASE ENTRY (1/5):
  EURUSD  LONG   0.15 lots
  GBPJPY  SHORT  0.08 lots
  BTCUSD  SHORT  0.02 lots
  ...

ADD ENTRY (1/10) — same size for Tuesday / Wednesday:
  EURUSD  LONG   0.07 lots
  GBPJPY  SHORT  0.04 lots
  ...

TRAIL: activate at +1.25% basket P&L, trail 0.5%
HOLD TO FRIDAY if no trail activation.
```

## File Changes Summary

| File | Action |
|------|--------|
| `src/lib/performance/strategyConfig.ts` | Change default strategy from `"dealer"` to `"agree_2of3_nocomm"` |
| `src/components/matrix/MatrixControls.tsx` | Add `"risk"` to MatrixTab type and TABS array |
| `src/components/matrix/MatrixViewSection.tsx` | Import and render `RiskBoard` for risk tab |
| `src/app/matrix/page.tsx` | Update `resolveTab` to handle `"risk"` |
| `src/components/matrix/RiskBoard.tsx` | **NEW** — Main risk tab component |
| `src/components/flagship/FlagshipBoard.tsx` | Remove SizingAccountBar, sizing column, sizing modal, calculateLotSize usage |
| `src/components/flagship/CryptoBoard.tsx` | Remove SizingAccountBar, sizing column, calculateLotSize usage |
| `src/lib/flagship/positionSizer.ts` | Add `scaleFactor` to `SizingAccount` type + default |
| `src/hooks/useSizingAccounts.ts` | Handle `scaleFactor` in validation (default `0.2` if missing) |
| `src/components/flagship/SizingAccountBar.tsx` | Add scale factor field to edit panel + inline display |

### Optional / Follow-up (Do not block UI build)

If broker sizing still needs to be improved, the correct follow-up file area is the existing MT4/MT5 export path, not the RiskBoard UI itself.

Relevant existing infrastructure:

- `src/app/api/mt5/push/route.ts`
- `src/lib/mt5Store.ts`
- `scripts/analyze-mt5-sizing.ts`

Follow-up goal:

- update MT4/MT5 exporter so broker spec / lot-map data can be pushed or captured in a stable format
- then let RiskBoard consume that data as first-priority sizing input

## Styling

- Use the same Tailwind classes and CSS variable patterns as the existing Matrix boards
- Panel backgrounds: `bg-[var(--panel)]/70`, borders: `border-[var(--panel-border)]`
- Text: `text-[var(--foreground)]`, muted: `text-[color:var(--muted)]`
- Accent: `text-[var(--accent-strong)]`, `border-[var(--accent)]`
- Lot size cells: `font-mono font-semibold text-sm` with subtle hover and `cursor-pointer`
- Cards/panels: same rounded-xl border pattern as existing Matrix stat cards

## Acceptance Criteria

1. Default strategy is `agree_2of3_nocomm` on both Matrix and Performance pages when no URL param is set
2. Risk tab appears as third tab on Matrix page, selectable via `?tab=risk`
3. Risk tab reflects whichever strategy is selected in the sidebar (strategy-aware)
4. `SizingAccountBar` renders ONLY on the Risk tab
5. CFD and Crypto boards no longer show a sizing column or account bar
6. Execution plan table shows correct broker-aware lot sizes for base and add sizing
7. Lot sizes are click-to-copy with visual feedback
8. Scale factor is editable per account and persisted in localStorage
9. Risk tab is simpler than CFD/Crypto and optimized for execution, not diagnostics
10. Strategy label is visible in the summary panel so user always knows which system's basket is shown
11. "Copy Execution Plan" produces clean formatted text
12. All existing tests pass (`npm test`)
13. No lint errors (`npm run lint`)
14. Standard file headers on all new/modified files

## Do Not

- Do not add new npm dependencies
- Do not create new shared/wrapper components
- Do not add API routes
- Do not add broker API integration or trade execution in this task
- Do not modify the strategy engine or weekly hold engine
- Do not turn this into a complex week-state simulator in phase 1
- Do not require Freedom to manually provide broker screenshots for every symbol
