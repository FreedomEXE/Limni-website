# CODEX: Path-True Basket Engine — Phase 1 Implementation

**Date:** 2026-04-07
**Spec:** `docs/CODEX_PATH_TRUE_EQUITY_ENGINE_SPEC_2026-04-06.md`
**Goal:** Build the shared `1h` basket path engine. No UI wiring, no cache tables, no research migration. Engine + verification only.

---

## What This Phase Delivers

1. **Canonical path bar loader** — thin wrapper over existing `canonical_price_bars` table, batch-loads H1 bars for a set of symbols and date range
2. **Position ledger builder** — converts a `WeeklyHoldResult` (existing engine output) into a typed position ledger
3. **Basket path engine** — takes a position ledger + H1 bars, produces a timestamped equity curve with mark-to-market at every bar
4. **Path summary calculator** — derives peak, max DD, giveback, recovery, losing weeks from the path curve
5. **Verification script** — runs the path engine on known strategies and compares total return against current weekly-close baselines

---

## File Plan

| File | Action |
|------|--------|
| `src/lib/performance/basketPathEngine.ts` | **CREATE** — core path engine + types + summary calculator |
| `src/lib/performance/pathBarLoader.ts` | **CREATE** — batch H1 bar loader from canonical_price_bars |
| `src/lib/performance/positionLedger.ts` | **CREATE** — ledger builder from WeeklyHoldResult |
| `scripts/verify-path-engine.ts` | **CREATE** — verification script |

**4 files created. 0 files modified.**

---

## File 1: `src/lib/performance/pathBarLoader.ts`

### Purpose

Batch-load H1 canonical bars for multiple symbols over a date range. This wraps the existing `canonical_price_bars` table and `getCanonicalBars()` function from `src/lib/canonicalPriceBars.ts`.

### Why a separate file

The existing `getCanonicalBars()` loads one symbol at a time. The path engine needs bars for many symbols in a single week. A batch loader avoids N sequential DB round-trips.

### Interface

```typescript
import type { CanonicalPriceBar } from "@/lib/canonicalPriceBars";

export type PathBarMap = Map<string, CanonicalPriceBar[]>;

/**
 * Load canonical bars for the given symbols between fromUtc and toUtc.
 * Returns a Map keyed by uppercase symbol, each value sorted by barOpenUtc ASC.
 *
 * @param symbols  — the symbol set to load (caller decides, not hardcoded)
 * @param fromUtc  — inclusive start
 * @param toUtc    — exclusive end
 * @param resolution — timeframe column value, defaults to "1h"
 */
export async function loadPathBars(
  symbols: string[],
  fromUtc: string,
  toUtc: string,
  resolution?: string,
): Promise<PathBarMap>;
```

### Implementation notes

- Default resolution is `"1h"` (the `timeframe` column in `canonical_price_bars`)
- Use a **single SQL query** with `WHERE symbol = ANY($1::text[])` to batch all symbols
- Normalize all symbols to uppercase before querying
- Return `Map<string, CanonicalPriceBar[]>` — each symbol's bars sorted by `bar_open_utc ASC`
- Use the existing `getOrSetRuntimeCache` with a short TTL (15s) keyed on the symbol set + date range
- If a symbol has zero bars in the range, include it in the map with an empty array (don't silently omit)

### SQL

```sql
SELECT symbol, asset_class, timeframe, bar_open_utc, bar_close_utc,
       open_price, high_price, low_price, close_price, source_provider, quality_status
  FROM canonical_price_bars
 WHERE symbol = ANY($1::text[])
   AND timeframe = $2
   AND bar_open_utc >= $3::timestamptz
   AND bar_open_utc < $4::timestamptz
 ORDER BY symbol, bar_open_utc ASC
```

### Row mapper

Reuse the same field mapping pattern as `canonicalPriceBars.ts`:

```typescript
{
  symbol: row.symbol,
  assetClass: row.asset_class,
  timeframe: row.timeframe,
  barOpenUtc: row.bar_open_utc.toISOString(),
  barCloseUtc: row.bar_close_utc.toISOString(),
  openPrice: Number(row.open_price),
  highPrice: Number(row.high_price),
  lowPrice: Number(row.low_price),
  closePrice: Number(row.close_price),
  sourceProvider: row.source_provider,
  qualityStatus: row.quality_status,
}
```

---

## File 2: `src/lib/performance/positionLedger.ts`

### Purpose

Convert a `WeeklyHoldResult` (the existing engine's output for one week) into a typed position ledger that the path engine can consume.

### Types

```typescript
export type PositionLeg = {
  symbol: string;
  assetClass: string;
  direction: "LONG" | "SHORT";
  entryTimeUtc: string;
  exitTimeUtc: string;
  weight: number;
  adrMultiplier: number;
  entryPrice: number;
  strategyId: string;
  entryStyleId: string;
};

export type WeekPositionLedger = {
  weekOpenUtc: string;
  weekCloseUtc: string;
  strategyId: string;
  entryStyleId: string;
  legs: PositionLeg[];
};
```

### Builder function

```typescript
import type { WeeklyHoldResult } from "@/lib/performance/weeklyHoldEngine";
import { loadWeeklyAdrMap, getAdrPct, getTargetAdrPct } from "@/lib/performance/adrLookup";
import { DateTime } from "luxon";

export async function buildWeeklyHoldLedger(
  result: WeeklyHoldResult,
  options?: { entryStyleId?: string },
): Promise<WeekPositionLedger>;
```

### Implementation rules

1. **Week window:**
   - `entryTimeUtc` = `result.weekOpenUtc` (all weekly hold positions enter at week open)
   - `exitTimeUtc` = `weekOpenUtc + 7 days` (next week open = this week's close anchor)
   - Compute via Luxon: `DateTime.fromISO(weekOpenUtc, { zone: "utc" }).plus({ weeks: 1 }).toISO()`

2. **Weight:**
   - `weight = 1 / N` where N = number of trades in `result.trades`
   - Each pair gets equal portfolio allocation

3. **ADR multiplier:**
   - Load via `loadWeeklyAdrMap(result.weekOpenUtc)`
   - Per pair: `getTargetAdrPct() / getAdrPct(adrMap, trade.symbol, trade.assetClass)`
   - This is the same math as `applyAdrNormalization()` in `weeklyHoldEngine.ts`
   - The multiplier is frozen for the entire pair-week

4. **Entry price:**
   - `trade.openPrice` from the `WeeklyHoldResult` trade
   - This is the week-open price for each pair

5. **Strategy ID:**
   - `result.biasSourceId`

6. **Entry style ID:**
   - `options?.entryStyleId ?? "weekly_hold"`

7. **Skip trades with zero or invalid openPrice** — if `openPrice <= 0`, omit the leg and log a warning

### Important: this does NOT apply ADR normalization to returnPct

The ledger stores the raw entry price and the ADR multiplier as separate fields. The path engine applies ADR normalization during mark-to-market. This is intentional — the existing `applyAdrNormalization()` in weeklyHoldEngine applies ADR to the final weekly return. The path engine applies it per bar. Same math, different resolution.

---

## File 3: `src/lib/performance/basketPathEngine.ts`

### Purpose

Core path engine. Takes a position ledger and H1 bars, produces a timestamped basket equity curve.

### Types

```typescript
export type BasketPathPoint = {
  tsUtc: string;
  equityPct: number;
  peakPct: number;
  drawdownPct: number;
  activePositions: number;
};

export type BasketPathSummary = {
  totalReturnPct: number;
  peakPct: number;
  troughPct: number;
  maxDrawdownPct: number;
  peakToCloseGivebackPct: number;
  troughToCloseRecoveryPct: number;
  maxActivePositions: number;
};

export type BasketPathResult = {
  weekOpenUtc: string;
  strategyId: string;
  entryStyleId: string;
  resolution: string;
  points: BasketPathPoint[];
  summary: BasketPathSummary;
};
```

### Main function

```typescript
import type { WeekPositionLedger } from "@/lib/performance/positionLedger";
import type { PathBarMap } from "@/lib/performance/pathBarLoader";

export function computeBasketPath(
  ledger: WeekPositionLedger,
  bars: PathBarMap,
): BasketPathResult;
```

This is a **pure function** — no DB calls, no side effects. All data is passed in.

### Algorithm

#### Step 1: Build the canonical hourly grid

Generate a fixed hourly grid from `ledger.weekOpenUtc` to `ledger.weekCloseUtc`. One timestamp per hour, on the hour, in UTC.

```typescript
const gridStart = DateTime.fromISO(ledger.weekOpenUtc, { zone: "utc" });
const gridEnd = DateTime.fromISO(ledger.weekCloseUtc, { zone: "utc" });
const grid: string[] = [];
let cursor = gridStart;
while (cursor < gridEnd) {
  grid.push(cursor.toISO()!);
  cursor = cursor.plus({ hours: 1 });
}
```

This produces a fixed ~168-point grid per week (7 days × 24 hours). The grid is the same regardless of which symbols are active or what bars exist. This is the canonical master calendar — not the union of observed timestamps.

#### Step 2: Build a price lookup with carry-forward

For each symbol, index H1 bars by their `barOpenUtc`. Then for each grid timestamp:
- If a bar exists at that timestamp → use its `closePrice` (status: `real`)
- If no bar exists → carry forward the `closePrice` from the most recent prior bar (status: `carried`)
- If no bar has ever been seen for this symbol (no prior data at all) → use `entryPrice` as the carried value until the first real bar appears

This naturally handles:
- FX having no weekend bars (prices carry flat over Saturday/Sunday)
- Crypto having weekend bars (real prices throughout)
- Market holidays (carry forward)
- Mixed-schedule baskets (each symbol uses its own carry state)

#### Step 3: Mark-to-market loop

For each timestamp in the master grid:

```typescript
let basketEquityPct = 0;
let activeCount = 0;

for (const leg of ledger.legs) {
  // Check if leg is active at this timestamp
  if (tsUtc < leg.entryTimeUtc || tsUtc >= leg.exitTimeUtc) continue;

  activeCount++;

  // Get current price for this symbol (real bar or carry-forward)
  const currentPrice = getPriceAtTimestamp(leg.symbol, tsUtc);
  if (currentPrice === null) continue; // no price data at all for this symbol

  // Directed return from entry
  const rawReturn = (currentPrice - leg.entryPrice) / leg.entryPrice;
  const directedReturn = leg.direction === "SHORT" ? -rawReturn : rawReturn;

  // ADR-normalized, weighted contribution
  const legPnl = leg.weight * leg.adrMultiplier * directedReturn;
  basketEquityPct += legPnl;
}
```

Multiply the result by 100 to express as percentage (matching the existing convention where returns are in percentage points, e.g., `+5.23` means `+5.23%`).

**Wait — check the convention.** The existing engine stores `returnPct` as percentage points (e.g., `5.23` not `0.0523`). So `rawReturn` from price math is a ratio (e.g., `0.0523`). The leg formula should be:

```typescript
const rawReturnPct = ((currentPrice - leg.entryPrice) / leg.entryPrice) * 100;
const directedReturnPct = leg.direction === "SHORT" ? -rawReturnPct : rawReturnPct;
const legPnlPct = leg.weight * leg.adrMultiplier * directedReturnPct;
basketEquityPct += legPnlPct;
```

This keeps `equityPct` in the same units as the rest of the app (percentage points).

#### Step 4: Track peak and drawdown at each point

```typescript
let peakPct = 0;

for each timestamp:
  compute basketEquityPct (as above)
  peakPct = Math.max(peakPct, basketEquityPct)
  drawdownPct = basketEquityPct - peakPct  // negative or zero

  points.push({
    tsUtc: timestamp,
    equityPct: basketEquityPct,
    peakPct,
    drawdownPct,
    activePositions: activeCount,
  })
```

#### Step 5: Compute summary

After all points are computed:

```typescript
const finalEquity = lastPoint.equityPct;
const peakEquity = Math.max(...points.map(p => p.equityPct));
const troughEquity = Math.min(...points.map(p => p.equityPct));
const maxDrawdown = Math.min(...points.map(p => p.drawdownPct)); // most negative

summary = {
  totalReturnPct: finalEquity,
  peakPct: peakEquity,
  troughPct: troughEquity,
  maxDrawdownPct: maxDrawdown,
  peakToCloseGivebackPct: peakEquity - finalEquity,
  troughToCloseRecoveryPct: finalEquity - troughEquity,
  maxActivePositions: Math.max(...points.map(p => p.activePositions)),
};
```

### Multi-week path

```typescript
export function computeMultiWeekBasketPath(
  weekResults: BasketPathResult[],
): {
  points: BasketPathPoint[];
  summary: BasketPathSummary;
};
```

Concatenate weekly paths into one continuous curve. Each week's equity starts where the prior week ended:

```typescript
let carryoverEquityPct = 0;

for (const weekResult of weekResults) {
  for (const point of weekResult.points) {
    const shiftedEquity = carryoverEquityPct + point.equityPct;
    // track peak/drawdown on the shifted curve
    ...
  }
  carryoverEquityPct += weekResult.summary.totalReturnPct;
}
```

This produces a continuous multi-week equity curve with proper peak/DD tracking across week boundaries.

### Edge cases

1. **Zero trades in a week:** Return a single point at week open with `equityPct: 0`, summary all zeros
2. **Symbol with no H1 bars at all:** Log a warning. The carry-forward logic will use `entryPrice` for every grid point, producing zero P/L for that leg. This is correct behavior (no data = no price movement = flat). The weekly-close return from the existing engine may differ for that pair since it uses a different price source. Log which symbols have zero real bars so we can investigate.
3. **Entry price of 0:** Skip the leg (already filtered by the ledger builder)
4. **All bars have `qualityStatus !== "verified"`:** Still use them. Quality status is informational for Phase 1 — do not skip bars based on quality status. Log if any non-"verified" bars are encountered.

---

## File 4: `scripts/verify-path-engine.ts`

### Purpose

Run the path engine on known strategies and compare total return against the current weekly-close baselines. This verifies the mark-to-market math is correct.

### What it tests

For each of these strategies, compute the multi-week path and compare `totalReturnPct` against the **current live app** weekly-close value.

**Important:** Do NOT hardcode expected values. Instead, run `computeMultiWeekHold()` for each strategy first to get the live weekly-close baseline, then compare the path engine result against that. The verification is "path engine ≈ weekly-close engine", not "path engine ≈ a number from a research doc."

Strategies to verify:

| Strategy ID | Label |
|---|---|
| `dealer` | Dealer Raw |
| `selector_frag3` | Selector (Frag3) |
| `agree_3of4` | Agreement (live shipped selective-tie variant) |

### Why total returns should be very close but not necessarily identical

The weekly-close engine computes return as:
```
directedReturn = direction * (weekClosePrice - weekOpenPrice) / weekOpenPrice
```

The path engine computes return at the last H1 bar of the week:
```
directedReturn = direction * (lastH1Close - weekOpenPrice) / weekOpenPrice
```

The week-open price from `pair_period_returns` might differ very slightly from the first H1 bar's open price, and the last H1 close might differ slightly from the weekly close price. These should be very close. If the absolute difference between path-engine total return and weekly-close total return exceeds **0.5%** (i.e., `|pathTotal - weeklyCloseTotal| > 0.5`), flag it as FAIL and investigate — something is wrong in bar alignment or carry logic.

### Implementation

```typescript
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { writeFileSync } from "node:fs";
import { listDataSectionWeeks } from "../src/lib/dataSectionWeeks";
import { normalizeWeekOpenUtc, getDisplayWeekOpenUtc } from "../src/lib/weekAnchor";
import { getStrategy, STRATEGIES } from "../src/lib/performance/strategyConfig";
import { computeWeeklyHold, computeMultiWeekHold } from "../src/lib/performance/weeklyHoldEngine";
import { buildWeeklyHoldLedger } from "../src/lib/performance/positionLedger";
import { loadPathBars } from "../src/lib/performance/pathBarLoader";
import { computeBasketPath, computeMultiWeekBasketPath } from "../src/lib/performance/basketPathEngine";
```

#### Script flow

1. Load last 10 realized weeks (same window as all prior research)
2. For each test strategy:
   a. Run `computeMultiWeekHold()` — this is the existing engine, gives weekly-close baselines
   b. For each week: run `computeWeeklyHold()`, then `buildWeeklyHoldLedger()`, then `loadPathBars()`, then `computeBasketPath()`
   c. Run `computeMultiWeekBasketPath()` on the weekly results
   d. Compare path engine `totalReturnPct` vs weekly-close `totalReturnPct`
   e. Report `peakPct`, `maxDrawdownPct`, `peakToCloseGivebackPct`

#### Output

Write to `docs/PATH_ENGINE_VERIFICATION_2026-04-07.md`:

```markdown
# Path Engine Verification

Resolution: 1h
Weeks analyzed: {N} ({first} -> {last})

## Return Comparison

| Strategy | Weekly-Close Total% | Path-Engine Total% | Abs Difference | Status |
| --- | ---: | ---: | ---: | --- |
| Dealer Raw | {from engine} | ... | ... | PASS/FAIL |
| Selector Frag3 | {from engine} | ... | ... | PASS/FAIL |
| Agreement | {from engine} | ... | ... | PASS/FAIL |

PASS = absolute difference ≤ 0.5 percentage points. FAIL = investigate.

## New Path Metrics

| Strategy | Total% | Peak% | Max DD% | Giveback% | Recovery% | Max Active |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |

## Data Coverage

| Strategy | Weeks | Total Legs | Legs With H1 Bars | Missing Bar Symbols |
| --- | ---: | ---: | ---: | --- |

## Per-Week Path Detail (Dealer Raw)

| Week | Weekly-Close% | Path-Engine% | Peak% | Max DD% | H1 Bars | Active Legs |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
```

The per-week detail for Dealer Raw is the deepest diagnostic — if one week diverges significantly, we can trace which pairs have missing bars or price gaps.

---

## Validation Checklist

After running `npx tsx scripts/verify-path-engine.ts`:

1. **All 3 strategy total returns within ≤0.5 percentage points of weekly-close baselines** — if not, investigate bar alignment, carry logic, or missing price data
2. **Path-engine max DD ≥ weekly-close max DD for every strategy** — path DD should be equal or worse (more honest), never better. If path DD is lower than weekly-close DD, something is wrong with the mark-to-market.
3. **No missing H1 bars for FX pairs** — FX should have near-complete H1 coverage Mon-Fri
4. **Crypto has weekend bars** — BTC/ETH/SOL/XRP should show more H1 bars than FX pairs
5. **Peak% ≥ Total%** — the peak can never be below the final equity
6. **Giveback% ≥ 0** — can't give back negative
7. **Build succeeds**: `npm run build` passes with no type errors

---

## Important Warnings

1. **Do NOT modify any existing files.** This phase creates 4 new files only.

2. **Do NOT wire the path engine into the Performance page.** That is Phase 2. The path engine is verified via the script only.

3. **Do NOT create a database migration or cache table.** That is Phase 2. The path engine reads from the existing `canonical_price_bars` table.

4. **The `computeBasketPath()` function MUST be pure.** No DB calls, no side effects. All data is passed in via `ledger` and `bars`. This makes it testable and cacheable later.

5. **ADR normalization is already canon.** The ledger builder loads the same `targetADR / pairADR` multiplier that `applyAdrNormalization()` uses. The path engine just applies it per bar instead of once at week end. Do not invent new ADR logic.

6. **The existing `applyAdrNormalization()` multiplies `returnPct` (a percentage-point value) by the ADR ratio.** The path engine must do the same: compute raw return as `((price - entry) / entry) * 100` (percentage points), then multiply by `weight * adrMultiplier`. This keeps units consistent.

7. **Week window is Sunday-to-Sunday.** Entry at `weekOpenUtc` (Sunday 19:00 ET converted to UTC), exit at `weekOpenUtc + 7 days`. This matches how `pair_period_returns` defines a week. FX doesn't actually trade on weekends, but the window is the full 7 days — the mark-to-market loop naturally handles this because there are no H1 bars on Saturday/Sunday for FX (prices carry forward flat) while crypto will have weekend bars.

8. **File header standard applies.** Use the Freedom_EXE header format.

---

## What We're Looking For

### Primary

- **Total return parity.** The path engine should reproduce the same total return as the weekly-close engine (within rounding / bar-boundary noise).
- **DD revelation.** We expect path-true DD to be higher (worse) than weekly-close DD for most strategies, because intraweek dips are now visible. This is the whole point.

### Secondary

- **Peak capture.** How far above the final close does the equity curve peak? If peak is significantly above final close, that reveals "the strategy was right but gave back profits" — future exit research territory.
- **Data coverage.** If any pairs have missing H1 bars, we need to know before Phase 2.

### This is NOT

- A production feature. It's a verified engine ready for Phase 2 to wire up.
- A replacement for existing drawdown. The old `drawdown.ts` stays untouched. Phase 2 migrates consumers.

---

## Files

| File | Action |
|------|--------|
| `src/lib/performance/pathBarLoader.ts` | CREATE |
| `src/lib/performance/positionLedger.ts` | CREATE |
| `src/lib/performance/basketPathEngine.ts` | CREATE |
| `scripts/verify-path-engine.ts` | CREATE |
| `docs/PATH_ENGINE_VERIFICATION_2026-04-07.md` | CREATE (generated by script) |

**4 new source files. 0 existing files modified.**
