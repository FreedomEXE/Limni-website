# CODEX: Veto Base Source Research at 36/36

**Date:** 2026-04-06
**Goal:** Re-run standardized 2/4 veto on all 4 base sources using canonical data at full 36/36 coverage. Verify the structural relationship between veto-filtered sets and agree_3of4. Determine which source slices perform best and whether veto creates a useful new composite system.

**Context:**
- All 4 sources now produce 36/36 weekly coverage (360 pair-weeks per source over 10 weeks)
- Prior veto research used pre-36/36 data (trade counts were 230/265/335/224)
- The 2/4 standardized veto was already chosen as the veto rule: skip when 2+ of the other 3 sources actively disagree
- At 36/36 with all binary signals, 2/4 veto mathematically collapses to: "trade passes veto iff 3+ of 4 sources agree on direction" — which is agree_3of4 filtered to trades where Source X is in the majority
- agree_3of4 baseline: 244 trades, +85.36%, 7.61% DD, 60.7% WR, 3 losing weeks

**Prior 2/4 veto results (pre-36/36, for reference only — expect different numbers now):**
- Dealer + 2/4 veto: 110 trades, +71.42%, 2.85% DD, 64.5% WR
- Sentiment + 2/4 veto: 215 trades, +98.53%, 21.89% DD, 62.8% WR
- Strength + 2/4 veto: 280 trades, +100.51%, 13.32% DD, 57.9% WR
- Commercial + 2/4 veto: 98 trades, +12.73%, 11.50% DD, 51.0% WR

**Current 36/36 standalone baselines:**
- Dealer: 360 trades, +96.51%
- Strength: 360 trades, +91.35%
- Sentiment: 360 trades, +73.16%
- Commercial: 360 trades, +38.78%

---

## Architecture

This script:
1. Loads all 4 source directions via `getCanonicalBasketWeek()` from `basketSource.ts`
2. For each source: identifies which trades pass vs fail the 2/4 veto
3. Computes stats for raw, veto-passed, and veto-failed trades per source
4. Computes agree_3of4 for comparison
5. Analyzes overlap between veto-filtered sets
6. Tests multi-source veto sleeve combinations
7. Outputs full comparison report

**CRITICAL:** Load source directions from `getCanonicalBasketWeek()` — the same canonical path the app uses. Do NOT use selectorEngine's context builder.

---

## Script: `scripts/research-veto-base-source.ts`

Create a NEW script file. Do NOT modify any existing scripts.

Output file: `docs/VETO_BASE_SOURCE_RESEARCH_2026-04-06.md`

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

Same pattern as `research-4source-tiered.ts`:

```typescript
type Direction = "LONG" | "SHORT";

type Row = {
  weekOpenUtc: string;
  assetClass: AssetClass;
  pair: string;
  rawReturnPct: number;
  adrMultiplier: number;
  dealer: Direction | null;
  commercial: Direction | null;
  sentiment: Direction | null;
  strength: Direction | null;
};

async function loadRows(): Promise<{ rows: Row[]; weeks: string[] }> {
  const currentWeek = normalizeWeekOpenUtc(getDisplayWeekOpenUtc());
  const weeks = (await listDataSectionWeeks())
    .filter((week) => normalizeWeekOpenUtc(week) < currentWeek)
    .slice(-10);

  const rows: Row[] = [];
  const TARGET_ADR = getTargetAdrPct();

  for (const weekOpenUtc of weeks) {
    const basket = await getCanonicalBasketWeek(weekOpenUtc);
    const dealerSignals = nonNeutralSignals(filterByModel(basket, "dealer"));
    const commercialSignals = nonNeutralSignals(filterByModel(basket, "commercial"));
    const sentimentSignals = nonNeutralSignals(filterByModel(basket, "sentiment"));
    const strengthSignals = nonNeutralSignals(filterByModel(basket, "strength"));

    const dealerMap = new Map(dealerSignals.map(s => [s.symbol.toUpperCase(), s.direction as Direction]));
    const commMap = new Map(commercialSignals.map(s => [s.symbol.toUpperCase(), s.direction as Direction]));
    const sentMap = new Map(sentimentSignals.map(s => [s.symbol.toUpperCase(), s.direction as Direction]));
    const strMap = new Map(strengthSignals.map(s => [s.symbol.toUpperCase(), s.direction as Direction]));

    const pairReturns = await getWeeklyPairReturns(weekOpenUtc);
    const returnBySymbol = new Map(pairReturns.map(r => [r.symbol.toUpperCase(), r.returnPct]));
    const adrMap = await loadWeeklyAdrMap(weekOpenUtc);

    const allPairs = new Set<string>();
    for (const [ac, pairs] of Object.entries(PAIRS_BY_ASSET_CLASS)) {
      for (const pair of pairs) allPairs.add(pair.toUpperCase());
    }

    for (const pair of allPairs) {
      const rawReturn = returnBySymbol.get(pair);
      if (rawReturn === undefined) continue;

      const assetClass = inferAssetClass(pair);
      const pairAdr = getAdrPct(adrMap, pair, assetClass);
      const adrMult = TARGET_ADR / pairAdr;

      rows.push({
        weekOpenUtc,
        assetClass,
        pair,
        rawReturnPct: rawReturn,
        adrMultiplier: adrMult,
        dealer: dealerMap.get(pair) ?? null,
        commercial: commMap.get(pair) ?? null,
        sentiment: sentMap.get(pair) ?? null,
        strength: strMap.get(pair) ?? null,
      });
    }
  }

  return { rows, weeks };
}
```

Use the same `inferAssetClass` function as the tiered research script (look up pair in `PAIRS_BY_ASSET_CLASS`).

---

## 2/4 Veto Logic

For a given source's direction, count how many of the OTHER 3 sources actively disagree:

```typescript
function vetoFires(
  sourceDirection: Direction,
  otherDirections: (Direction | null)[],
): boolean {
  let disagreeCount = 0;
  for (const other of otherDirections) {
    if (other !== null && other !== sourceDirection) {
      disagreeCount += 1;
    }
  }
  return disagreeCount >= 2;
}
```

For each source, the "other 3" are the remaining sources:
- Dealer veto: check commercial, sentiment, strength
- Commercial veto: check dealer, sentiment, strength
- Sentiment veto: check dealer, commercial, strength
- Strength veto: check dealer, commercial, sentiment

---

## Strategies to Compute

### A. Raw Standalone (4 strategies)
Each source's direction, all 360 trades:
- `dealer_raw`: trade dealer's direction for all pairs
- `commercial_raw`: trade commercial's direction for all pairs
- `sentiment_raw`: trade sentiment's direction for all pairs
- `strength_raw`: trade strength's direction for all pairs

### B. 2/4 Veto Filtered (4 strategies)
Each source's direction, skip when veto fires:
- `dealer_veto`: trade dealer's direction, skip if 2+ of {commercial, sentiment, strength} disagree
- `commercial_veto`: trade commercial's direction, skip if 2+ of {dealer, sentiment, strength} disagree
- `sentiment_veto`: trade sentiment's direction, skip if 2+ of {dealer, commercial, strength} disagree
- `strength_veto`: trade strength's direction, skip if 2+ of {dealer, commercial, sentiment} disagree

### C. agree_3of4 (reference)
Trade when 3+ of 4 agree. Skip 2-2 ties. Direction = majority direction.

### D. Veto Sleeve Combinations

Combine the veto-passed trades from multiple sources into one portfolio. When sources overlap on the same pair-week (both dealer_veto and strength_veto pass), take the trade once (use the direction — it should be the same since both passed veto = both in the 3+ majority).

Test these combinations:
- `dealer_veto + strength_veto`: the two strongest standalone sources
- `dealer_veto + sentiment_veto`: dealer + sentiment
- `dealer_veto + strength_veto + sentiment_veto`: 3-source sleeve (exclude commercial)
- `all_4_veto_union`: union of all 4 veto-filtered sets (should = agree_3of4)

For combinations: when a pair-week appears in multiple sleeves, count it ONCE. Direction should be identical (all veto-passed trades for a pair-week are in the agree_3of4 majority).

---

## Statistics Per Strategy

```typescript
type StrategyStats = {
  id: string;
  label: string;
  trades: number;
  totalReturnPct: number;
  maxDrawdownPct: number;
  winRatePct: number;
  losingWeeks: number;
  tradesPerWeek: number;
  byAssetClass: Record<string, { trades: number; totalReturnPct: number; winRatePct: number }>;
};
```

Weekly drawdown: sum ADR-normalized directed returns per week, compute peak-to-trough.

---

## Overlap Diagnostics

### Veto Trade Counts

For each source, report:
- Raw trades (should be 360 for all since 36/36)
- Veto-passed trades
- Veto-failed trades
- Veto-failed total return (quality of removed trades)
- Veto-failed win rate

### Overlap Matrix

How many pair-weeks appear in BOTH Source A veto and Source B veto:

```
| | dealer_veto | commercial_veto | sentiment_veto | strength_veto |
|---|---:|---:|---:|---:|
| dealer_veto | {N} | ... | ... | ... |
| commercial_veto | ... | {N} | ... | ... |
| sentiment_veto | ... | ... | {N} | ... |
| strength_veto | ... | ... | ... | {N} |
```

### Unique Trades Per Source

For each source, count pair-weeks that ONLY appear in that source's veto-passed set (not in any other source's veto-passed set):

```
| Source | Veto-Passed | Unique to Source | Unique Return | Unique WR |
```

This shows which source's veto identifies trades that no other source's veto captures.

### Structural Verification

Verify that:
1. Union of all 4 veto-passed sets = agree_3of4 (same pair-weeks, same directions)
2. Every veto-passed trade has 3+ of 4 sources agreeing
3. Every veto-failed trade has a 2-2 split or worse

Report any exceptions.

---

## Output Format

Write to `docs/VETO_BASE_SOURCE_RESEARCH_2026-04-06.md`.

### Section 1: Header

```markdown
# Veto Base Source Research at 36/36

Weeks analyzed: {N} ({first week label} -> {last week label}).
Universe: 360 pair-weeks.
Data loader: getCanonicalBasketWeek (canonical app/engine path).
All returns ADR-normalized.

Veto rule: 2/4 standardized — skip when 2+ of the other 3 sources actively disagree.
```

### Section 2: Veto Filter Summary

```markdown
## Veto Filter Summary

| Source | Raw Trades | Veto-Passed | Veto-Failed | Failed Return | Failed WR |
| --- | ---: | ---: | ---: | ---: | ---: |
| dealer | ... |
| commercial | ... |
| sentiment | ... |
| strength | ... |
```

### Section 3: Master Comparison

```markdown
## Master Comparison

| Strategy | Trades | Total% | MaxDD% | Win% | Losing Wks | Trades/Wk |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
```

Include ALL strategies: 4 raw, 4 veto-filtered, agree_3of4, 4 sleeve combinations.
Sorted by Losing Wks ASC, then Total% DESC.

### Section 4: Asset Breakdown

For each strategy (all 13):

```markdown
### {Strategy Label}

| Asset Class | Trades | Total% | Win% |
| --- | ---: | ---: | ---: |
| fx | ... |
| crypto | ... |
| indices | ... |
| commodities | ... |
```

### Section 5: Overlap Matrix

```markdown
## Overlap Matrix

| | dealer_veto | commercial_veto | sentiment_veto | strength_veto |
| --- | ---: | ---: | ---: | ---: |
```

### Section 6: Unique Trades Per Source

```markdown
## Unique Trades Per Source

| Source | Veto-Passed | Unique | Shared | Unique Return | Unique WR |
| --- | ---: | ---: | ---: | ---: | ---: |
```

### Section 7: Structural Verification

```markdown
## Structural Verification

- 4-source veto union = agree_3of4: {YES/NO}
- Pair-weeks in union: {N}
- Pair-weeks in agree_3of4: {N}
- Mismatches: {N} (list if any)
```

### Section 8: Per-Week Profile

```markdown
## Per-Week Profile

| Week | dealer_raw | dealer_veto | strength_raw | strength_veto | sentiment_veto | agree_3of4 | D+St sleeve | D+St+Se sleeve |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
```

Show trade counts per week for the most interesting strategies.

---

## Validation

Run:
```bash
npx tsx scripts/research-veto-base-source.ts
```

Verify:
1. **All raw standalone sources should have 360 trades** (36/36 coverage)
2. **Dealer raw should match**: +96.51% (from prior research)
3. **agree_3of4 should match**: 244 trades, +85.36%, 7.61% DD, 60.7% WR, 3 losing weeks
4. **Union of all 4 veto sets MUST equal agree_3of4** — if not, there's a bug
5. **All returns are ADR-normalized**
6. **Veto-failed trade counts should sum**: raw trades - veto-passed = veto-failed per source

If baselines don't match, STOP and investigate.

---

## Important Warnings

1. **Use `getCanonicalBasketWeek()` for ALL source direction loading.** Do NOT use selectorEngine's context builder.

2. **ADR normalization is mandatory.** Use `getTargetAdrPct()` and `loadWeeklyAdrMap()`.

3. **At 36/36, all sources are LONG or SHORT for all 36 pairs every week.** There should be zero nulls. If any source has null for a pair, report it as an anomaly.

4. **Veto-passed direction always matches the source's own direction.** The veto doesn't change direction — it only decides trade vs skip.

5. **For sleeve combinations, deduplicate by pair-week.** When multiple sources pass veto on the same pair-week, the direction should be identical (all are in the agree_3of4 majority). If directions differ, that's a bug — report it.

6. **File header standard applies.** Use the Freedom_EXE header format.

7. **Do NOT modify any files in `src/`.** This is a research script only.

8. **Do NOT modify any existing research scripts.**

---

## What We're Looking For

1. **Confirm veto ≈ agree_3of4 slices** at 36/36 (structural verification)
2. **Which source's veto-passed set performs best** — the standout source gets priority
3. **Which sleeve combination beats agree_3of4** — if dealer_veto + strength_veto outperforms agree_3of4, that's a new composite
4. **Unique trade quality** — if one source contributes unique high-quality trades that no other source captures, that source is essential in the veto composite
5. **Whether veto becomes its own system** — if the best sleeve is structurally different from (and better than) agree_3of4, it deserves its own strategy entry

---

## Files

| File | Action |
|------|--------|
| `scripts/research-veto-base-source.ts` | CREATE — new research script |
| `docs/VETO_BASE_SOURCE_RESEARCH_2026-04-06.md` | CREATE — output (generated by script) |

**One new file created. No existing files modified.**
