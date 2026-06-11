# CODEX: Composite System Standardization Sweep

**Date:** 2026-04-04
**Goal:** One unified sweep to choose the best agreement system, best tiered system, and best selector variant — then determine whether veto or veto+tiebreaker should be canonical, optional (Filter 2), or dropped.

**This is a decision-making sweep, not exploratory research.** The output must produce clear winners that simplify the app to: 4 base sources + 1 agreement + 1 tiered + 1 selector.

---

## Context: What Changed Since Last Sweep

Two canonical changes were just shipped (engine version v13):

1. **ADR normalization is now always-on.** Every system, every week. No more "None" vs "ADR Normalized" toggle.
2. **Commercial FX direction is now forced-raw** (`base_net - quote_net` instead of bias-label matching). Commercial went from -38% to ~+21% standalone.

**All numbers from prior sweeps are now stale.** This sweep runs against the rebased canonical data.

### Updated Baselines (post-rebase, ADR-normalized)
Verify these FIRST. If they don't match, data loading is broken.

| Source | Trades | Total % | Max DD | WR |
|--------|--------|---------|--------|----|
| Dealer | 230 | +73.18% | 2.19% | 56.5% |
| Sentiment | 265 | +92.40% | 19.56% | 60.8% |
| Strength | 335 | +80.89% | 14.98% | 54.6% |
| Commercial (forced-raw) | ~360 | ~+21.13% | ~29.04% | ~50% |
| 2-of-3 NoComm | 252 | +115.60% | 12.85% | — |

**Commercial baseline will differ from old sweeps** because forced-raw is now canonical.

---

## Systems To Test

### Agreement Family (3 variants)

| ID | Sources | Logic |
|----|---------|-------|
| `agree_2of3` | dealer, commercial, sentiment | 2+ agree → trade. **EXISTS in app** as `agree_2of3` |
| `agree_2of3_nocomm` | dealer, sentiment, strength | 2+ agree → trade. **EXISTS in app** as `agree_2of3_nocomm` |
| `agree_3of4` | dealer, commercial, sentiment, strength | 3+ of 4 agree → trade. **BUILD IN SCRIPT** |

For `agree_3of4`: derive direction maps for all 4 sources. For each pair, count how many non-neutral sources agree on a direction. If 3+ agree on LONG → LONG. If 3+ agree on SHORT → SHORT. Otherwise skip.

### Tiered Family (3 variants)

| ID | Sources | Logic |
|----|---------|-------|
| `tiered_v3` | dealer, commercial, sentiment | 3/3 agree = Tier 1, 2/3 = Tier 2, 1/3 = Tier 3. **EXISTS in app** |
| `tiered_3_nocomm` | dealer, sentiment, strength | Same tier logic but different 3 sources. **EXISTS in app** |
| `tiered_4` | dealer, commercial, sentiment, strength | 4/4 = Tier 1, 3/4 = Tier 2, 2/4 = Tier 3, 1/4 = Tier 4. **BUILD IN SCRIPT** |

For `tiered_4`: count votes from all 4 sources. Most-popular direction wins. Tier = vote count. All tiers trade (we test whether filtering lower tiers helps later, not here). For the purpose of this sweep, treat all tiers equally (we just want direction + trade count).

**Actually, for a fair comparison across all three tiered variants, ignore tiers entirely in this sweep — just use the direction the tiered system would pick and treat all trades equally.** The tier weighting is a separate optimization. What matters here is which source combination picks the best directions.

### Selector Family (1 variant)

| ID | Sources | Logic |
|----|---------|-------|
| `selector` | dealer, commercial, sentiment, strength | Sentiment-primary with strength tiebreak, dealer/comm override. **EXISTS in app** as `selector_sentiment_override` |

Selector already uses commercial internally for caution logic. The commercial rebase may change its behavior — we need to see the updated numbers.

**Do NOT build a "selector without commercial" variant.** The selector's commercial integration is baked into its override logic, not a simple toggle.

### Filter Layer (3 modes, applied to EVERY system above)

| Mode | Logic |
|------|-------|
| `raw` | No filter — composite direction as-is |
| `veto` | 2/4 standardized veto: if 2+ of ALL 4 sources (using standard non-neutral directions) oppose the trade direction → veto |
| `tieveto` | Same veto but voters use tiebreaker-enriched directions (forces neutrals to vote) |

**Veto on composites:** The composite produces a final direction per pair. Then check if 2+ of {dealer, commercial, sentiment, strength} disagree with that direction. For standalone sources in the composite, use their standard (non-neutral) direction maps for `veto` mode, and tiebreaker-enriched maps for `tieveto` mode.

---

## Total Test Matrix

7 systems × 3 filter modes = **21 system configurations**

Plus the 4 standalone sources × 3 filter modes = **12 standalone baselines** (for reference/comparison)

Total: **33 rows** in the output table.

---

## Technical Implementation

### Reference Script
Use `scripts/backtest-veto-composite-sweep.ts` as your primary reference. It already has:
- `buildWeekData()` — loads all direction maps, tiebreaker maps, returns
- `computeEngineStrategyWeeks()` — loads composite directions from the app engine
- `buildCompositeMetrics()` — applies raw/veto/tieveto on composite trades
- `countOpposers()` — veto counting
- All ADR normalization and return infrastructure

### Data Loading Pattern (MANDATORY)
```typescript
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { getCanonicalBasketWeek, filterByModel, nonNeutralSignals } from "../src/lib/performance/basketSource";
import { readWeeklyPairStrengths } from "../src/lib/strength/weeklyStrength";
import { loadWeeklyAdrMap, getAdrPct, getTargetAdrPct } from "../src/lib/performance/adrLookup";
import { getWeeklyPairReturns } from "../src/lib/pairReturns";
import { getDisplayWeekOpenUtc } from "../src/lib/weekAnchor";
import { listDataSectionWeeks, deriveCotReportDate } from "../src/lib/dataSectionWeeks";
import { readSnapshot } from "../src/lib/cotStore";
import { PAIRS_BY_ASSET_CLASS } from "../src/lib/cotPairs";
import { getAggregatesForWeekStartWithBackfill } from "../src/lib/sentiment/store";
import { sentimentDirectionFromAggregate } from "../src/lib/sentiment/daily";
import { computeWeeklyHold } from "../src/lib/performance/weeklyHoldEngine";
import { getStrategy, getEntryStyle, SELECTOR_SENTIMENT_OVERRIDE_STRATEGY_ID } from "../src/lib/performance/strategyConfig";
```

### Loading Existing Composites Via Engine
For systems that already exist in the app (`agree_2of3`, `agree_2of3_nocomm`, `tiered_v3`, `tiered_3_nocomm`, `selector`), load their directions through `computeWeeklyHold()`:

```typescript
async function computeEngineStrategyWeeks(strategyId: string, weeks: string[]) {
  const strategy = getStrategy(strategyId);
  const entry = getEntryStyle("weekly_hold");
  if (!strategy || !entry) throw new Error(`Missing strategy: ${strategyId}`);
  const results = [];
  for (const weekOpenUtc of weeks) {
    results.push(await computeWeeklyHold(strategy, weekOpenUtc, entry));
  }
  return results;
}
```

**NOTE:** `computeWeeklyHold` no longer takes a `strengthGate` parameter (it was removed in the canonical rebase). ADR normalization is automatic. Do NOT pass a 4th argument.

### Building New Composites In-Script
For `agree_3of4` and `tiered_4`, derive from the raw direction maps:

```typescript
// agree_3of4: 3 of 4 sources must agree
function deriveAgree3of4(
  dealerMap: Map<string, Direction>,
  commMap: Map<string, Direction>,
  sentMap: Map<string, Direction>,
  strMap: Map<string, Direction>,
): Map<string, Direction> {
  const result = new Map<string, Direction>();
  const allPairs = new Set([...dealerMap.keys(), ...commMap.keys(), ...sentMap.keys(), ...strMap.keys()]);

  for (const pair of allPairs) {
    const votes = [dealerMap.get(pair), commMap.get(pair), sentMap.get(pair), strMap.get(pair)];
    let longCount = 0, shortCount = 0;
    for (const v of votes) {
      if (v === "LONG") longCount++;
      else if (v === "SHORT") shortCount++;
    }
    if (longCount >= 3) result.set(pair, "LONG");
    else if (shortCount >= 3) result.set(pair, "SHORT");
  }
  return result;
}

// tiered_4: majority of 4 sources, all vote counts trade
function deriveTiered4(
  dealerMap: Map<string, Direction>,
  commMap: Map<string, Direction>,
  sentMap: Map<string, Direction>,
  strMap: Map<string, Direction>,
): Map<string, Direction> {
  const result = new Map<string, Direction>();
  const allPairs = new Set([...dealerMap.keys(), ...commMap.keys(), ...sentMap.keys(), ...strMap.keys()]);

  for (const pair of allPairs) {
    const votes = [dealerMap.get(pair), commMap.get(pair), sentMap.get(pair), strMap.get(pair)];
    let longCount = 0, shortCount = 0;
    for (const v of votes) {
      if (v === "LONG") longCount++;
      else if (v === "SHORT") shortCount++;
    }
    // Majority wins. Ties = skip.
    if (longCount > shortCount && longCount >= 2) result.set(pair, "LONG");
    else if (shortCount > longCount && shortCount >= 2) result.set(pair, "SHORT");
  }
  return result;
}
```

For `agree_3of4` and `tiered_4`, compute ADR-normalized returns manually since they don't go through the engine:

```typescript
for (const [pair, dir] of compositeMap) {
  const ret = weekData.getNormRet(pair, dir, inferAssetClass(pair));
  if (ret !== null) { /* accumulate */ }
}
```

### Direction Maps for Veto Voters
The existing `buildWeekData()` in the reference sweep builds both:
- `stdMaps` — standard non-neutral direction maps (for `veto` mode)
- `tieMaps` — tiebreaker-enriched maps (for `tieveto` mode)

Use these directly for counting opposers against composite directions.

### Tiebreaker Logic (for enriched veto voters)
Same as documented in CODEX_VETO_COMPOSITE_SWEEP_2026-04-04.md:
- **COT (dealer/commercial):** When both currencies same bias, compare `net / (long + short)` — stronger lean wins
- **Sentiment:** When in neutral band (35-65%), use `agg_long_pct > 50 → SHORT` (contrarian), else `LONG`
- **Strength:** When `compositeScore === 0`, use sum of `signedSpread` across windows. **FIELD IS `signedSpread` NOT `spread`.**

### Veto Logic
```typescript
function countOpposers(dir: Direction, voterMaps: Map<string, Direction>[], pair: string): number {
  let count = 0;
  for (const map of voterMaps) {
    const vote = map.get(pair);
    if (vote && vote !== dir) count++;
    // null/undefined = neutral = not counted
  }
  return count;
}
// Veto when countOpposers >= 2
```

---

## Output Format

### Main Table
For each of the 33 systems:
```
Family | System | Filter | Trades | Total% | MaxDD% | R/DD | Win% | Losing Weeks | Worst Week%
```

Sort within each family by: fewest losing weeks → lowest DD → highest R/DD → highest WR.

### Decision Tables

**Agreement Winner:**
```
System + Filter | Trades | Total% | MaxDD% | R/DD | Win% | LW
─────────────────────────────────────────────────────────
agree_2of3 Raw          | ...
agree_2of3 Veto         | ...
agree_2of3 TieVeto      | ...
agree_2of3_nocomm Raw   | ...
agree_2of3_nocomm Veto  | ...
agree_2of3_nocomm TieVeto | ...
agree_3of4 Raw          | ...
agree_3of4 Veto         | ...
agree_3of4 TieVeto      | ...
─────────────────────────────────────────────────────────
WINNER: [best row highlighted]
```

Same format for Tiered Winner and Selector (raw vs veto vs tieveto).

**Veto Universality Analysis:**
After picking winners per family, show:
```
Does veto/tieveto improve EVERY family's winner?
- Agreement winner: raw vs veto vs tieveto → [which is best]
- Tiered winner: raw vs veto vs tieveto → [which is best]
- Selector: raw vs veto vs tieveto → [which is best]
- Standalone dealer: raw vs veto vs tieveto → [which is best]
- Standalone sentiment: raw vs veto vs tieveto → [which is best]
- Standalone strength: raw vs veto vs tieveto → [which is best]
- Standalone commercial: raw vs veto vs tieveto → [which is best]

Conclusion: veto should be [canonical / Filter 2 / dropped]
If canonical: [veto or tieveto]?
```

### Grand Ranking
All 33 rows sorted by:
1. Fewest losing weeks
2. Lowest max DD
3. Highest R/DD
4. Highest win rate

---

## Important Warnings

1. **`computeWeeklyHold` no longer takes `strengthGate`** — the 4th parameter is now `_legacyStrengthGate?: unknown` and is ignored. Pass 2 args (biasSource, weekOpenUtc) or 3 (biasSource, weekOpenUtc, entryStyle). Do NOT pass a strength gate.
2. **Commercial is now forced-raw canonical** — the `stdMaps.commercial` direction map built from `filterByModel(basketWeek, "commercial")` will automatically reflect forced-raw directions. You don't need to build a separate `commForcedRaw` map anymore.
3. **`getWeeklyPairReturns` returns `.symbol` not `.pair`** — common bug source.
4. **Strength uses `signedSpread` not `spread`** — causes silent wrong results in tiebreaker.
5. **Always filter `w < currentWeekOpenUtc`** to exclude the incomplete current week.
6. **Verify baselines FIRST** — if dealer isn't 230 trades / +73.18%, data loading is wrong.
7. **Commercial baseline will be different from old sweeps** (~360 trades, ~+21% instead of 224 trades, -38%). This is correct — forced-raw is now canonical.

---

## Deliverables

1. **Script:** `scripts/backtest-composite-standardization-sweep.ts`
2. **Results:** `docs/COMPOSITE_STANDARDIZATION_SWEEP_RESULTS_2026-04-04.md`
   - Main table (all 33 systems)
   - Agreement decision table with winner
   - Tiered decision table with winner
   - Selector decision table
   - Veto universality analysis
   - Grand ranking
   - Clear recommendation for app simplification

Run with: `npx tsx scripts/backtest-composite-standardization-sweep.ts`

Handle errors gracefully — if one system fails, log and continue.

---

## What This Decides

After this sweep, we will:
1. **Keep one agreement system** in the app, remove the other(s)
2. **Keep one tiered system** in the app, remove the other(s)
3. **Keep selector** as-is or update based on results
4. **Decide on veto:** canonical (always-on like ADR normalization), Filter 2 option, or dropped
5. **If veto is canonical:** choose between standard veto and tiebreaker+veto
6. **Simplify the app** to: 4 base sources + 1 agreement + 1 tiered + 1 selector = 7 total strategies

This is a simplification decision, not an expansion. The goal is fewer strategies, each clearly the best of its family.
