# CODEX: Strength Window Extension + Universal Direction Research

**Date:** 2026-04-04
**Goal:** Test adding weekly (1w) and monthly (1m) windows to the strength calculation, paired with a new universal raw-sign direction method. Current non-FX strength is structurally broken (min-max normalization with N=2 for crypto forces anti-correlation). Adding longer windows only helps if we also change the direction math.

**Prior research confirmed:**
- FX strength works well: +77.68%, 55.7% WR (current model)
- Non-FX strength is broken: crypto always opposite directions, indices marginal, commodities hurt by normalization
- Raw absolute methods fix the anti-correlation but the right window set is unknown
- Current windows (1h/4h/24h) don't predict crypto weekly returns under any normalization

**What this script tests:**
- 3 branches (current baseline, hybrid, full raw-sign)
- Multiple window combinations (3w, 4w, 5w)
- All 4 asset classes + combined
- Universal methodology — same logic everywhere, no class-specific routing

---

## Script: `scripts/research-strength-windows.ts`

Create a NEW script file. Do NOT modify any existing scripts or source files.

Output file: `docs/STRENGTH_WINDOW_RESEARCH_2026-04-04.md`

---

## Architecture

Follow the same architecture as `scripts/research-neutral-resolvers.ts` and `scripts/research-strength-nonfx-fix.ts`:
- Load all backtestable weeks from `listDataSectionWeeks()`, filter to weeks before current week
- For each week: load strength data, current week's pair returns (for scoring), prior weeks' pair returns (for 1w/1m windows), ADR map
- Build a flat `Row[]` array with one entry per pair-week across ALL 4 asset classes (FX + indices + crypto + commodities)
- ADR-normalize all returns: `returnPct * (targetAdr / pairAdr)`
- Compute all method directions per row
- Compute per-method stats by asset class and combined
- Render markdown tables to output file

**Imports:**
```typescript
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { writeFileSync } from "node:fs";
import { DateTime } from "luxon";
import { listDataSectionWeeks } from "../src/lib/dataSectionWeeks";
import { getWeeklyPairReturns } from "../src/lib/pairReturns";
import { getAdrPct, getTargetAdrPct, loadWeeklyAdrMap } from "../src/lib/performance/adrLookup";
import { readWeeklyPairStrengths, type WeeklyPairStrength } from "../src/lib/strength/weeklyStrength";
import { PAIRS_BY_ASSET_CLASS } from "../src/lib/cotPairs";
import type { AssetClass } from "../src/lib/cotMarkets";
import { getDisplayWeekOpenUtc, normalizeWeekOpenUtc } from "../src/lib/weekAnchor";
```

---

## Row Type

```typescript
type Direction = "LONG" | "SHORT";

type Row = {
  weekOpenUtc: string;
  assetClass: AssetClass;
  pair: string;
  rawReturnPct: number;    // this week's pair return (for scoring)
  adrMultiplier: number;

  // Current strength data (1h/4h/24h)
  strength: WeeklyPairStrength | null;

  // Per-window raw values from current strength data
  raw1h: number | null;    // rawBase - rawQuote (FX) or rawBase (non-FX) for 1h window
  raw4h: number | null;    // same for 4h
  raw24h: number | null;   // same for 24h

  // New window raw values (from prior weeks' pair returns)
  raw1w: number | null;    // prior week's returnPct for this pair
  raw1m: number | null;    // sum of prior 4 weeks' returnPct for this pair

  // Method directions (computed per row)
  methods: Record<MethodKey, Direction | null>;
};
```

---

## Data Loading

For each week in the backtest, load:

```typescript
for (const rawWeekOpenUtc of weeks) {
  const weekOpenUtc = normalizeWeekOpenUtc(rawWeekOpenUtc) ?? rawWeekOpenUtc;

  // Prior week dates for 1w/1m windows
  const prior1wUtc = DateTime.fromISO(weekOpenUtc, { zone: "utc" })
    .minus({ weeks: 1 }).toUTC().toISO() ?? weekOpenUtc;
  const prior2wUtc = DateTime.fromISO(weekOpenUtc, { zone: "utc" })
    .minus({ weeks: 2 }).toUTC().toISO() ?? weekOpenUtc;
  const prior3wUtc = DateTime.fromISO(weekOpenUtc, { zone: "utc" })
    .minus({ weeks: 3 }).toUTC().toISO() ?? weekOpenUtc;
  const prior4wUtc = DateTime.fromISO(weekOpenUtc, { zone: "utc" })
    .minus({ weeks: 4 }).toUTC().toISO() ?? weekOpenUtc;

  const [
    currentReturns,
    adrMap,
    currentStrength,
    prior1wReturns,
    prior2wReturns,
    prior3wReturns,
    prior4wReturns,
  ] = await Promise.all([
    getWeeklyPairReturns(weekOpenUtc),
    loadWeeklyAdrMap(weekOpenUtc),
    readWeeklyPairStrengths(weekOpenUtc),
    getWeeklyPairReturns(prior1wUtc),
    getWeeklyPairReturns(prior2wUtc),
    getWeeklyPairReturns(prior3wUtc),
    getWeeklyPairReturns(prior4wUtc),
  ]);

  // Build maps for lookups...
}
```

### Computing raw values per window:

**For 1h/4h/24h (from existing strength data):**

```typescript
function getRawWindowValue(
  ps: WeeklyPairStrength,
  assetClass: AssetClass,
  windowName: "1h" | "4h" | "24h",
): number | null {
  const w = ps.windows.find((win) => win.window === windowName);
  if (!w || !w.available) return null;
  if (assetClass === "fx") {
    // Raw currency spread (before normalization)
    if (w.rawBase === null || w.rawQuote === null) return null;
    return w.rawBase - w.rawQuote;
  }
  // Non-FX: rawBase IS the pair's % change
  return w.rawBase;
}
```

**For 1w (from prior week's pair returns):**

```typescript
// Build a map: symbol -> returnPct from prior1wReturns
const prior1wMap = new Map(
  prior1wReturns.map((r) => [r.symbol.toUpperCase(), r.returnPct]),
);
// raw1w = prior1wMap.get(pair) ?? null;
```

**For 1m (sum of prior 4 weeks' pair returns):**

```typescript
function getMonthlyReturn(
  pair: string,
  ...priorWeekReturns: Array<Map<string, number>>
): number | null {
  let sum = 0;
  let hasData = false;
  for (const weekMap of priorWeekReturns) {
    const ret = weekMap.get(pair);
    if (ret !== undefined) {
      sum += ret;
      hasData = true;
    }
  }
  return hasData ? sum : null;
}
// raw1m = getMonthlyReturn(pair, prior1wMap, prior2wMap, prior3wMap, prior4wMap);
```

---

## Method Definitions

### Scoring Convention

For ALL methods:
- Each window contributes a score: LONG = +1, SHORT = -1, NEUTRAL = 0
- Composite = sum of all window scores
- Direction: composite > 0 → LONG, composite < 0 → SHORT, composite = 0 → null (no trade)

**No per-window thresholds for the new approaches.** Raw value > 0 → LONG, < 0 → SHORT, = 0 → NEUTRAL.

### Method Definitions

| Key | Branch | Windows | Direction Logic |
|-----|--------|---------|-----------------|
| `a1_current_t1` | Baseline | 1h+4h+24h | Current: threshold=5 on normalized spread |
| `a2_current_ta` | Baseline | 1h+4h+24h | Current T1 + raw spread sum resolver |
| `b1_hybrid_4w_1w` | Hybrid | 1h+4h+24h + 1w | Current for short windows, raw-sign for 1w |
| `b2_hybrid_4w_1m` | Hybrid | 1h+4h+24h + 1m | Current for short windows, raw-sign for 1m |
| `b3_hybrid_5w` | Hybrid | 1h+4h+24h + 1w + 1m | Current for short, raw-sign for 1w+1m |
| `b4_hybrid_5w_res` | Hybrid | 1h+4h+24h + 1w + 1m | b3 + resolver for composite=0 |
| `c1_raw_3w` | Full raw | 1h+4h+24h | Raw-sign on all 3 windows |
| `c2_raw_4w_1w` | Full raw | 1h+4h+24h + 1w | Raw-sign on all 4 windows |
| `c3_raw_5w` | Full raw | 1h+4h+24h + 1w + 1m | Raw-sign on all 5 windows |
| `c4_raw_3w_long` | Full raw | 24h + 1w + 1m | Raw-sign, long windows only |
| `c5_raw_5w_res` | Full raw | 1h+4h+24h + 1w + 1m | c3 + resolver for composite=0 |

### Direction Computation per Method

**A1 (Current T1):**
```typescript
// Use existing compositeDirection from strength data
if (!ps || ps.availableWindows === 0) return null;
if (ps.compositeDirection === "NEUTRAL") return null;
return ps.compositeDirection; // "LONG" or "SHORT"
```

**A2 (Current TA):**
```typescript
// T1 first, then resolver for neutrals
if (!ps || ps.availableWindows === 0) return null;
if (ps.compositeDirection !== "NEUTRAL") return ps.compositeDirection;
// Resolver: sum signedSpread across all windows
let sum = 0;
let hasData = false;
for (const w of ps.windows) {
  if (w.available && w.signedSpread !== null && Number.isFinite(w.signedSpread)) {
    sum += w.signedSpread;
    hasData = true;
  }
}
if (!hasData || sum === 0) return null;
return sum > 0 ? "LONG" : "SHORT";
```

**B1-B3 (Hybrid):**
```typescript
// Current windows: use existing direction scores (LONG=+1, SHORT=-1, NEUTRAL=0)
// New windows: raw-sign direction
function hybridDirection(row: Row, includeWeekly: boolean, includeMonthly: boolean): Direction | null {
  if (!row.strength || row.strength.availableWindows === 0) return null;

  let score = 0;
  // Current 1h/4h/24h: use existing classified directions
  for (const w of row.strength.windows) {
    if (w.direction === "LONG") score += 1;
    else if (w.direction === "SHORT") score -= 1;
  }

  // 1w window: raw-sign
  if (includeWeekly && row.raw1w !== null) {
    score += row.raw1w > 0 ? 1 : row.raw1w < 0 ? -1 : 0;
  }

  // 1m window: raw-sign
  if (includeMonthly && row.raw1m !== null) {
    score += row.raw1m > 0 ? 1 : row.raw1m < 0 ? -1 : 0;
  }

  if (score > 0) return "LONG";
  if (score < 0) return "SHORT";
  return null;
}
```

**B4 (Hybrid + resolver):**
```typescript
// Same as b3 but if composite = 0, sum all raw values for tiebreaker
function hybridWithResolver(row: Row): Direction | null {
  const base = hybridDirection(row, true, true);
  if (base) return base;

  // Resolver: sum raw values across all windows
  let sum = 0;
  let hasData = false;
  if (row.raw1h !== null) { sum += row.raw1h; hasData = true; }
  if (row.raw4h !== null) { sum += row.raw4h; hasData = true; }
  if (row.raw24h !== null) { sum += row.raw24h; hasData = true; }
  if (row.raw1w !== null) { sum += row.raw1w; hasData = true; }
  if (row.raw1m !== null) { sum += row.raw1m; hasData = true; }
  if (!hasData || sum === 0) return null;
  return sum > 0 ? "LONG" : "SHORT";
}
```

**C1-C4 (Full raw-sign):**
```typescript
function rawSignDirection(
  row: Row,
  use1h: boolean,
  use4h: boolean,
  use24h: boolean,
  use1w: boolean,
  use1m: boolean,
): Direction | null {
  let score = 0;
  let windows = 0;

  function addRaw(value: number | null) {
    if (value === null) return;
    windows++;
    if (value > 0) score += 1;
    else if (value < 0) score -= 1;
  }

  if (use1h) addRaw(row.raw1h);
  if (use4h) addRaw(row.raw4h);
  if (use24h) addRaw(row.raw24h);
  if (use1w) addRaw(row.raw1w);
  if (use1m) addRaw(row.raw1m);

  if (windows === 0) return null;
  if (score > 0) return "LONG";
  if (score < 0) return "SHORT";
  return null;
}
```

**C5 (Full raw-sign + resolver):**
```typescript
// Same as c3 but if composite = 0, sum all raw values
function rawSignWithResolver(row: Row): Direction | null {
  const base = rawSignDirection(row, true, true, true, true, true);
  if (base) return base;

  let sum = 0;
  let hasData = false;
  if (row.raw1h !== null) { sum += row.raw1h; hasData = true; }
  if (row.raw4h !== null) { sum += row.raw4h; hasData = true; }
  if (row.raw24h !== null) { sum += row.raw24h; hasData = true; }
  if (row.raw1w !== null) { sum += row.raw1w; hasData = true; }
  if (row.raw1m !== null) { sum += row.raw1m; hasData = true; }
  if (!hasData || sum === 0) return null;
  return sum > 0 ? "LONG" : "SHORT";
}
```

---

## Stats Computation

Use the same stats framework as the prior research scripts.

For each method, compute per-asset-class and combined:
- Trades (count of non-null directions)
- Total% (sum of ADR-normalized directional returns)
- MaxDD% (peak-to-trough weekly drawdown)
- Win% (trades with positive return / total trades)
- Losing Wks (weeks with negative total return)
- Coverage (trades/possible)

**Copy the utility functions from `research-neutral-resolvers.ts`:**
- `round`, `signedPct`, `directionalReturn`, `computeMaxDd`
- `computeSimpleMethodStats` pattern (by-week grouping for DD and losing weeks)

---

## Output Format

Write to `docs/STRENGTH_WINDOW_RESEARCH_2026-04-04.md`.

### Section 1: Header

```markdown
# Strength Window Extension Research

Weeks analyzed: {N} ({first} -> {last}).
Universe: 36 pairs × {N} weeks = {total} possible pair-weeks.

Windows tested:
- Current: 1h, 4h, 24h (normalized, threshold=5)
- New: 1w (prior week return sign), 1m (prior 4 weeks return sum sign)
- Raw-sign: raw pair % change sign (no normalization, no threshold)
```

### Section 2: Data Availability

Show how many pairs had valid data for each window type:

```markdown
## Window Data Availability

| Window | Pairs with Data | Total Possible | Coverage |
| --- | ---: | ---: | ---: |
| 1h | {n} | {total} | {pct}% |
| 4h | {n} | {total} | {pct}% |
| 24h | {n} | {total} | {pct}% |
| 1w | {n} | {total} | {pct}% |
| 1m | {n} | {total} | {pct}% |
```

### Section 3: Branch A — Current Baseline

```markdown
## Branch A: Current Baseline

### A1: Current T1 (1h+4h+24h normalized)

| Asset Class | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| fx | ... |
| indices | ... |
| crypto | ... |
| commodities | ... |
| combined | ... |
```

Same table format for A2.

### Section 4: Branch B — Hybrid

Same table format for B1, B2, B3, B4.

### Section 5: Branch C — Full Raw-Sign

Same table format for C1, C2, C3, C4, C5.

### Section 6: Summary Comparison

```markdown
## Summary

| Method | Branch | Windows | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage |
| --- | --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| A1: Current T1 | Baseline | 3w norm | ... |
| A2: Current TA | Baseline | 3w norm+res | ... |
| B1: Hybrid +1w | Hybrid | 4w | ... |
| ... |
```

### Section 7: Crypto Anti-Correlation Diagnostic

Same as the non-FX research — for each method, count how many weeks BTC and ETH have:
- Opposite directions
- Same direction
- One or both unresolved

```markdown
## Crypto Anti-Correlation Diagnostic

| Method | Opposite BTC/ETH | Same Direction | Unresolved |
| --- | ---: | ---: | ---: |
```

### Section 8: Per-Asset-Class Winners

For each asset class, list the top 3 methods by Total% (with WR and DD as tiebreakers):

```markdown
## Per-Asset-Class Rankings

### FX (best by Total%)
1. {method}: {trades}, {total%}, {dd%}, {wr%}
2. ...
3. ...

### Crypto (best by Total%)
...
```

---

## Validation

Run:
```bash
npx tsx scripts/research-strength-windows.ts
```

Verify:
1. **A1 must match prior research T1 baseline:** 335/360, +80.89%, 14.98% DD, 54.6% WR
2. **A2 must match prior research TA:** 351/360, +78.72%, 15.09% DD, 54.4% WR
3. If baselines don't match, STOP and investigate. Do NOT proceed with divergent baselines.

---

## Important Warnings

1. **ALL 4 asset classes in EVERY method.** FX + indices + crypto + commodities. Universe = 36 pairs. Do not filter to non-FX only.

2. **ADR normalization is mandatory.** `returnPct * (targetAdr / pairAdr)` where `targetAdr = getTargetAdrPct()`.

3. **The `raw1h`/`raw4h`/`raw24h` values come from the existing strength data**, NOT from new API calls. Use `getRawWindowValue()` as defined above — `rawBase - rawQuote` for FX, `rawBase` for non-FX.

4. **The `raw1w` value is the PRIOR week's pair return** from `getWeeklyPairReturns(prior1wUtc)`. Not the current week. The 1w window looks BACK one week from the lock time.

5. **The `raw1m` value is the SUM of prior 4 weeks' pair returns.** If fewer than 4 prior weeks have data, sum whatever is available. If zero prior weeks have data, `raw1m = null`.

6. **For the first week(s) of the backtest**, prior week data may not exist. Mark `raw1w`/`raw1m` as null. Methods that depend on those windows will have fewer trades for early weeks — this is expected and correct.

7. **No per-window thresholds** for raw-sign methods. `value > 0 → LONG`, `value < 0 → SHORT`, `value === 0 → NEUTRAL`. The composite score provides all gating.

8. **Resolver logic** (methods B4 and C5): when composite score = 0, sum ALL raw values across all active windows. Direction = sign of sum. If sum = 0 or no data, return null.

9. **File header standard applies.** Use the Freedom_EXE header.

10. **Do NOT modify any files in `src/`.** This is a research script only.

11. **`getWeeklyPairReturns(weekOpenUtc)` returns the pair's return FOR that week.** Calling it with `prior1wUtc` gives the return that happened during the week BEFORE the target week. This is the 1w lookback signal.

12. **For FX raw values:** `rawBase` and `rawQuote` from `PairStrengthWindowReading` are the raw currency strength contribution scores (NOT the pair's % change). `rawBase - rawQuote` gives the raw directional signal before normalization. This is the correct raw value for FX.

13. **For non-FX raw values:** `rawBase` from `PairStrengthWindowReading` IS the pair's raw % change vs USD. `rawQuote` is always 0 for non-FX. Use `rawBase` directly.

---

## Files

| File | Action |
|------|--------|
| `scripts/research-strength-windows.ts` | CREATE — new research script |
| `docs/STRENGTH_WINDOW_RESEARCH_2026-04-04.md` | CREATE — output (generated by script) |

**One new file created. No existing files modified.**
