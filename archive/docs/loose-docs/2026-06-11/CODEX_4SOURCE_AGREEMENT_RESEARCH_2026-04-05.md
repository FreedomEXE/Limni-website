# CODEX: 4-Source Agreement Research

**Date:** 2026-04-05
**Goal:** Research and benchmark all meaningful 4-source agreement configurations to find the canonical 4-source agreement system.

**Context:** All 4 base sources (dealer, commercial, sentiment, strength) now produce 36/36 non-neutral directions every week. We need ONE canonical 4-source agreement system. This research will tell us which threshold and tie-handling rule produces the best results.

---

## Architecture

Follow the same architecture as prior research scripts (`research-sentiment-full-resolver.ts`):
- Load all backtestable weeks from `listDataSectionWeeks()`, filter to weeks before current week
- For each week: load weekly pair returns, ADR map
- For each week: load all 4 source directions via `getCanonicalBasketWeek()` from `basketSource.ts`
- ADR-normalize all returns: `returnPct * (targetAdr / pairAdr)` where `targetAdr = getTargetAdrPct()`
- Compute direction for each strategy variant
- Render markdown tables to output file

**CRITICAL:** Load source directions from `getCanonicalBasketWeek()` — the same canonical path the app uses. Do NOT re-derive directions from raw data.

---

## Script: `scripts/research-4source-agreement.ts`

Create a NEW script file. Do NOT modify any existing scripts.

Output file: `docs/4SOURCE_AGREEMENT_RESEARCH_2026-04-05.md`

---

## Imports

```typescript
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { writeFileSync } from "node:fs";
import { DateTime } from "luxon";
import { listDataSectionWeeks } from "../src/lib/dataSectionWeeks";
import { getWeeklyPairReturns } from "../src/lib/pairReturns";
import { getAdrPct, getTargetAdrPct, loadWeeklyAdrMap } from "../src/lib/performance/adrLookup";
import { getCanonicalBasketWeek, filterByModel, nonNeutralSignals } from "../src/lib/performance/basketSource";
import { PAIRS_BY_ASSET_CLASS } from "../src/lib/cotPairs";
import type { AssetClass } from "../src/lib/cotMarkets";
import { getDisplayWeekOpenUtc, normalizeWeekOpenUtc } from "../src/lib/weekAnchor";
```

---

## Data Loading

For each backtestable week:

```typescript
const basket = await getCanonicalBasketWeek(weekOpenUtc);

// Extract non-neutral directions per source
const dealerSignals = nonNeutralSignals(filterByModel(basket, "dealer"));
const commercialSignals = nonNeutralSignals(filterByModel(basket, "commercial"));
const sentimentSignals = nonNeutralSignals(filterByModel(basket, "sentiment"));
const strengthSignals = nonNeutralSignals(filterByModel(basket, "strength"));

// Build direction maps: symbol → "LONG" | "SHORT"
const dealerMap = new Map(dealerSignals.map(s => [s.symbol.toUpperCase(), s.direction]));
const commMap = new Map(commercialSignals.map(s => [s.symbol.toUpperCase(), s.direction]));
const sentMap = new Map(sentimentSignals.map(s => [s.symbol.toUpperCase(), s.direction]));
const strMap = new Map(strengthSignals.map(s => [s.symbol.toUpperCase(), s.direction]));
```

---

## Row Type

```typescript
type Direction = "LONG" | "SHORT";

type Row = {
  weekOpenUtc: string;
  assetClass: AssetClass;
  pair: string;
  rawReturnPct: number;
  adrMultiplier: number;

  // Source directions (null = source has no direction for this pair)
  dealer: Direction | null;
  commercial: Direction | null;
  sentiment: Direction | null;
  strength: Direction | null;

  // Vote counts
  longs: number;
  shorts: number;
  voteCount: number;   // total non-null votes
};
```

For each pair, compute votes:

```typescript
const votes = [dealer, commercial, sentiment, strength].filter(Boolean) as Direction[];
const longs = votes.filter(v => v === "LONG").length;
const shorts = votes.filter(v => v === "SHORT").length;
const voteCount = votes.length;
```

---

## Strategy Variants

### A. 4-Source Agreement Variants (the primary research question)

| ID | Description | Rule |
|----|-------------|------|
| `agree_3of4` | Strict 3-of-4 agreement | Trade if 3+ of 4 sources agree. Skip 2v2 ties. |
| `agree_4of4` | Unanimous agreement | Trade only if all 4 sources agree. |
| `agree_majority_dealer` | Majority with dealer tiebreak | 3+ agree → trade. 2v2 tie → use dealer direction. Always trades. |
| `agree_majority_sentiment` | Majority with sentiment tiebreak | 3+ agree → trade. 2v2 tie → use sentiment direction. Always trades. |

```typescript
type StrategyId = string;

function resolveDirection(row: Row, strategyId: StrategyId): Direction | null {
  const { longs, shorts, dealer, sentiment } = row;

  switch (strategyId) {
    case "agree_3of4":
      if (longs >= 3) return "LONG";
      if (shorts >= 3) return "SHORT";
      return null; // skip 2v2 ties

    case "agree_4of4":
      if (longs === 4) return "LONG";
      if (shorts === 4) return "SHORT";
      return null;

    case "agree_majority_dealer":
      if (longs >= 3) return "LONG";
      if (shorts >= 3) return "SHORT";
      // 2v2 tie → dealer decides
      return dealer;

    case "agree_majority_sentiment":
      if (longs >= 3) return "LONG";
      if (shorts >= 3) return "SHORT";
      // 2v2 tie → sentiment decides
      return sentiment;

    // ... 3-source baselines below
  }
  return null;
}
```

### B. 3-Source Agreement Baselines (for comparison)

Test all four 3-source subsets to see which combination works best:

| ID | Sources | Rule |
|----|---------|------|
| `agree_2of3_DCS` | Dealer + Commercial + Sentiment | 2+ agree (existing agree_2of3) |
| `agree_2of3_DSt` | Dealer + Sentiment + Strength | 2+ agree (existing agree_2of3_nocomm) |
| `agree_2of3_DCSt` | Dealer + Commercial + Strength | 2+ agree |
| `agree_2of3_CSSt` | Commercial + Sentiment + Strength | 2+ agree |

For each 3-source subset, extract the relevant 3 votes and apply `if (longs >= 2) LONG; if (shorts >= 2) SHORT; else skip`.

### C. Standalone Source Baselines (reference)

| ID | Description |
|----|-------------|
| `dealer` | Dealer standalone |
| `commercial` | Commercial standalone |
| `sentiment` | Sentiment standalone |
| `strength` | Strength standalone |

These are just `if (source !== null) trade source direction`.

---

## Vote Distribution Diagnostic

Before computing strategy results, generate a diagnostic showing HOW OFTEN each vote distribution occurs:

```typescript
type VoteDistribution = {
  pattern: string;  // e.g., "4-0", "3-1", "2-2"
  count: number;
  pctOfTotal: number;
};
```

Count across all pair-weeks:
- `4-0` (unanimous): both 4L/0S and 0L/4S
- `3-1` (strong majority): both 3L/1S and 1L/3S
- `2-2` (tie): 2L/2S

This tells us how many pairs per week are actually ties, which is critical for understanding whether tie-handling matters.

Also compute per-week tie counts:

```
| Week | 4-0 | 3-1 | 2-2 | Total |
```

---

## Tie Diagnostic

For all 2v2 tie rows, report which sources are on which side:

```
| Pair Pattern | Count | Description |
| D+C vs Se+St | {n} | COT sources vs real-time sources |
| D+Se vs C+St | {n} | ... |
| D+St vs C+Se | {n} | ... |
```

This diagnostic answers: "Do ties follow a pattern (e.g., COT always disagrees with real-time sources)?"

Also for each tiebreak variant, report the P&L of ONLY the tie-resolved trades:

```
## Tiebreak-Only Performance

| Tiebreaker | Tie Trades | Total% | Avg% | Win% |
| dealer | {n} | ... | ... | ... |
| sentiment | {n} | ... | ... | ... |
```

---

## Output Format

Write to `docs/4SOURCE_AGREEMENT_RESEARCH_2026-04-05.md`.

### Section 1: Header

```markdown
# 4-Source Agreement Research

Weeks analyzed: {N} ({first week label} -> {last week label}).
Universe: 36 pairs × {N} weeks = {total} possible pair-weeks.
Data loader: getCanonicalBasketWeek (canonical app/engine path).
All returns ADR-normalized.
```

### Section 2: Vote Distribution Diagnostic

```markdown
## Vote Distribution

| Pattern | Count | % of Total |
| --- | ---: | ---: |
| 4-0 (unanimous) | {n} | {pct}% |
| 3-1 (strong majority) | {n} | {pct}% |
| 2-2 (tie) | {n} | {pct}% |

### Per-Week Vote Distribution

| Week | 4-0 | 3-1 | 2-2 | Total |
| --- | ---: | ---: | ---: | ---: |
```

### Section 3: Tie Analysis

```markdown
## Tie Analysis (2v2 Splits)

| Split Pattern | Count | % of Ties |
| --- | ---: | ---: |
| D+C vs Se+St | {n} | {pct}% |
| D+Se vs C+St | {n} | {pct}% |
| D+St vs C+Se | {n} | {pct}% |

### Tiebreak-Only Performance

| Tiebreaker | Tie Trades | Total% | Avg% | Win% |
| --- | ---: | ---: | ---: | ---: |
| Dealer direction | {n} | ... |
| Sentiment direction | {n} | ... |
```

### Section 4: Standalone Source Baselines

```markdown
## Standalone Source Baselines

| Source | Trades | Total% | MaxDD% | Win% | Losing Wks |
| --- | ---: | ---: | ---: | ---: | ---: |
| Dealer | ... |
| Commercial | ... |
| Sentiment | ... |
| Strength | ... |
```

### Section 5: 3-Source Agreement Baselines

```markdown
## 3-Source Agreement Baselines

| Variant | Sources | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| agree_2of3_DCS | D+C+Se | ... |
| agree_2of3_DSt | D+Se+St | ... |
| agree_2of3_DCSt | D+C+St | ... |
| agree_2of3_CSSt | C+Se+St | ... |
```

### Section 6: 4-Source Agreement Results

For EACH 4-source variant, show per-asset-class breakdown:

```markdown
### {Variant Label}

| Asset Class | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| fx | ... |
| indices | ... |
| crypto | ... |
| commodities | ... |
| combined | ... |
```

### Section 7: Master Comparison (sorted by Losing Wks ASC, then Total% DESC)

```markdown
## Master Comparison

| Strategy | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage | Trades/Wk |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
```

Include ALL variants (standalone, 3-source, 4-source) in one table, sorted by Losing Wks ASC then Total% DESC.

**Losing weeks is the primary ranking key.** Total return is secondary.

`Trades/Wk` = average trades per week (total trades / weeks). This shows how selective each variant is.

### Section 8: Per-Week Coverage Verification

```markdown
## Per-Week Coverage

| Week | agree_3of4 | agree_4of4 | agree_majority_dealer | agree_majority_sentiment |
| --- | ---: | ---: | ---: | ---: |
```

---

## Utility Functions

Copy these from prior scripts exactly:
- `weekLabel(weekOpenUtc)` — format as "Mon DD"
- `round(n, decimals)` — round to N decimals
- `signedPct(n)` — format as "+X.XX%" or "-X.XX%"
- `directionalReturn(rawReturnPct, direction)` — return × direction sign
- `computeMaxDd(weeklyReturns)` — max drawdown from cumulative weekly returns

Stats computation for each variant:
```typescript
function computeStats(rows: Row[], strategyId: string) {
  const trades: { weekOpenUtc: string; pair: string; assetClass: AssetClass; returnPct: number }[] = [];
  for (const row of rows) {
    const dir = resolveDirection(row, strategyId);
    if (!dir) continue;
    const normalizedReturn = directionalReturn(row.rawReturnPct, dir) * row.adrMultiplier;
    trades.push({
      weekOpenUtc: row.weekOpenUtc,
      pair: row.pair,
      assetClass: row.assetClass,
      returnPct: normalizedReturn,
    });
  }
  // Compute total%, maxDD%, win%, losing weeks, per-asset-class breakdown
  // Group by week for weekly P&L → losing weeks = weeks where sum < 0
  // Group by asset class for breakdown
}
```

---

## Validation

Run:
```bash
npx tsx scripts/research-4source-agreement.ts
```

Verify:
1. **Standalone baselines must match app values.** Dealer standalone should match the dealer performance page. If numbers diverge, STOP and investigate — the data loading path may be wrong.
2. **agree_2of3_DCS should match existing agree_2of3** in the app. agree_2of3_DSt should match agree_2of3_nocomm. These are parity checks.
3. **agree_majority_dealer and agree_majority_sentiment must produce exactly 360 trades** (36 per week × 10 weeks) since they always resolve ties.
4. **agree_3of4 and agree_4of4 will produce fewer than 360 trades** — that's expected.
5. All returns are ADR-normalized using `getTargetAdrPct()` and `getAdrPct()`.
6. Vote distribution should sum to total pair-weeks (360).

If standalone baselines don't match expected app values, STOP and investigate. Do NOT proceed with divergent baselines.

---

## Important Warnings

1. **Use `getCanonicalBasketWeek()` for ALL source direction loading.** This is the canonical app/engine path. Do NOT re-derive directions from raw COT/sentiment/strength data.

2. **ADR normalization is mandatory.** Use `getTargetAdrPct()` and `getAdrPct()` exactly as in prior scripts.

3. **The 2v2 tie diagnostic is critical.** If ties are rare (< 5% of pair-weeks), the tiebreaker rule barely matters. If ties are common (> 20%), it matters a lot. The diagnostic will tell us.

4. **3-source baselines are parity checks.** If agree_2of3_DCS doesn't match the app's agree_2of3 results, something is wrong with the data loading.

5. **File header standard applies.** Use the Freedom_EXE header format.

6. **The output file is `docs/4SOURCE_AGREEMENT_RESEARCH_2026-04-05.md`.** Overwrite if it exists.

7. **Do NOT modify any files in `src/`.** This is a research script only.

8. **Do NOT modify any existing research scripts.** Create a new file.

---

## Files

| File | Action |
|------|--------|
| `scripts/research-4source-agreement.ts` | CREATE — new research script |
| `docs/4SOURCE_AGREEMENT_RESEARCH_2026-04-05.md` | CREATE — output (generated by script) |

**One new file created. No existing files modified.**
