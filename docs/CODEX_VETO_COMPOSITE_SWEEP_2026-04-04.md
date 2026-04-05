# CODEX: Veto + Composite System Sweep

**Date:** 2026-04-04
**Goal:** Exhaustive backtest sweep to find the optimal combination of filters, composites, and portfolio architectures across our 10-week dataset. The north star: **zero losing weeks, highest R/DD, lowest drawdown.**

---

## Context — What We Know So Far

### Data Sources (4 standalone)
All use canonical `getCanonicalBasketWeek()` + `filterByModel()` from `src/lib/performance/basketSource.ts`. All results are ADR-normalized (target 1%).

| Source | Trades | Total | Max DD | R/DD | Win% |
|--------|--------|-------|--------|------|------|
| Dealer | 230 | +73.18% | 2.19% | 33.3x | 56.5% |
| Sentiment | 265 | +92.40% | 19.56% | 4.7x | 60.8% |
| Strength | 335 | +80.89% | 14.98% | 5.4x | 54.6% |
| Commercial | 224 | -38.07% | 42.04% | -0.9x | 45.1% |

### 2/4 Standardized Veto (chosen as baseline filter)
Rule: For each source's trade, if 2+ of the other 3 sources are **non-neutral AND opposite direction**, the trade is vetoed. Same rule for all 4 sources. Neutral = missing vote (not counted as agree or oppose).

| Source | Veto Trades | Veto Total | Veto DD | Veto R/DD | Veto WR |
|--------|-------------|------------|---------|-----------|---------|
| Dealer | 110 | +71.42% | 2.85% | 25.1x | 64.5% |
| Sentiment | 215 | +98.53% | 21.89% | 4.5x | 62.8% |
| Strength | 280 | +100.51% | 13.32% | 7.5x | 57.9% |
| Commercial | 98 | +12.73% | 11.50% | 1.1x | 51.0% |

### Tiebreaker + Veto (enriched veto coverage)
Uses forced-direction tiebreakers so the other sources always have a vote (no neutral gaps). Helps dealer and sentiment, hurts strength and commercial.

| Source | TV Trades | TV Total | TV DD | TV R/DD | TV WR |
|--------|-----------|----------|-------|---------|-------|
| Dealer | 115 | +77.38% | 1.89% | 41.0x | 67.0% |
| Sentiment | 194 | +89.42% | 14.29% | 6.3x | 63.4% |
| Strength | 237 | +62.07% | 24.68% | 2.5x | 57.0% |
| Commercial | 103 | +1.97% | 18.23% | 0.1x | 49.5% |

### Tiebreaker Logic (for forced-direction enrichment)
- **COT (dealer/commercial):** When both currencies same bias, compare `net / (long + short)` — stronger lean wins. When one side neutral, non-neutral side wins.
- **Sentiment:** When in neutral band (35-65%), use `agg_long_pct > 50 → SHORT` (contrarian), else `LONG`.
- **Strength:** When `compositeScore === 0`, use `sum of signedSpread across windows`. **IMPORTANT: the field is `signedSpread` not `spread`.**

### Existing Composite Systems (baselines to beat)
These are from the app's strategy engine. You should verify these numbers match before trusting any new variants.

- **2-of-3 NoComm (antikythera_v3):** 2+ of dealer/sentiment/strength agree → trade
- **Tiered V3:** Tier weighting — 3/3 agree = full size, 2/3 = reduced, dealer disagrees = skip
- **Selector (sentiment_context_override):** ~+126.47%, -16.60% DD. Follow sentiment unless stretched+weakening → COT override
- **Tandem 3 Sleeves (dealer+sentiment+strength):** +230.08%, -10.93% DD, 21.0x R/DD with independent sleeve exits (TP 0.15 / Trail 0.15 / SL 0.10)

### Key Research Findings
1. **Dealer and commercial disagree 91.4% of the time** on forced direction — they're structural mirrors (counterparties). Don't merge them into one signal.
2. **Commercial forced raw** flips from -38% to +23% — the current neutral logic throws away commercial's better trades. Interesting but unshipped.
3. **3/4 forced-direction majority** has 62.1% WR on 161 trades — when 3 of 4 forced sources agree, there's real edge.
4. **Veto coverage averages 2.94/4 votes** with standard neutrals, 3.49/4 with tiebreaker enrichment (19% improvement).
5. **Dealer behaves differently under standard veto** than other sources — slightly worse DD, because dealer already has few bad trades to filter. This is structural, not curve fitting.

### Freedom's Priority Framework (CRITICAL — read this)
When comparing system variants, optimize for:
1. **Fewer trades** — frees margin for DCA scaling
2. **Win rate** — higher WR compounds better with DCA
3. **Unified logic** — same rule everywhere beats source-specific tuning
4. **Longevity** — survive long-term, don't overfit to 10 weeks
5. **Drawdown** — Freedom cares most about DD and losing weeks
6. R/DD ratio is useful but secondary to the above

---

## What To Test

### PHASE 1: Veto on Composite Systems
Apply 2/4 standardized veto to every existing composite system. For each, compare: raw composite vs composite+veto.

Test these composites:
1. **2-of-3 NoComm** — the existing agreement system
2. **Tiered V3** — the tiered weighting system
3. **Tiered 3 NoComm** — tiered without commercial
4. **Selector (sentiment_context_override)** — the weekly flagship
5. **Tandem 3 (dealer+sentiment+strength)** — independent sleeves

For veto on composites: the composite produces a final direction per pair. Then check if 2+ of the non-participating sources oppose. Think carefully about what counts as "other sources" — for a 2-of-3 NoComm trade where dealer+sentiment agreed, the other sources are commercial + strength (and the third NoComm source that didn't participate in this specific agreement).

Actually, simpler approach: just apply the same 2/4 veto on the composite's final per-pair direction. The composite says LONG EURUSD → check if 2+ of {dealer, commercial, sentiment, strength} disagree with LONG. This is cleaner than trying to figure out "which sources participated."

### PHASE 2: Tiebreaker+Veto on Composite Systems
Same as Phase 1 but use tiebreaker-enriched direction maps for the veto voters. This gives full 36-pair coverage for every voter.

### PHASE 3: Portfolio-Level Combinations
Test combinations of vetoed standalone sources as portfolio sleeves:
1. **Dealer(veto) + Sentiment(veto)** — two best standalone sources
2. **Dealer(veto) + Sentiment(veto) + Strength(veto)** — tandem 3 but each sleeve pre-filtered by veto
3. **Dealer(tieveto) + Sentiment(tieveto)** — tiebreaker-enriched pair
4. **Dealer(tieveto) + Sentiment(veto)** — hybrid: tieveto helps dealer, standard veto better for sentiment
5. **Best composite + best standalone sleeve** — e.g., selector + dealer(veto) as separate sleeves

For portfolio combinations: sum the weekly returns of each sleeve. Track combined DD, combined R/DD, combined losing weeks. A combined portfolio can have zero losing weeks even if individual sleeves sometimes lose, because diversification.

### PHASE 4: Commercial Forced Raw + Veto
Codex specifically recommended this. Test:
1. Commercial with forced-raw direction (`base_net - quote_net`) instead of current bias-matching
2. Apply veto on top
3. See if this creates a tradeable commercial signal
4. If so, test as a portfolio sleeve alongside dealer

### PHASE 5: Conviction-Weighted Systems
Instead of binary direction, use magnitude for conviction weighting:
1. **Strong signals full size, weak signals half size** — where "strong" = higher magnitude pair scores
2. **Veto with conviction threshold** — only veto when opposers also have strong magnitude
3. **Graduated veto** — 1 opposer = half size, 2 opposers = veto, 0 = full size

### PHASE 6: Wild Cards
Try creative combinations we haven't thought of:
1. **Dealer-only pairs filter** — only trade pairs where dealer has a non-neutral signal (dealer's neutral filter is proven good). Then apply other sources as overlays.
2. **Asymmetric veto** — dealer gets a stronger veto voice than commercial (because dealer is the best source)
3. **Time-decay weighting** — more recent weeks weighted higher (check if edge is consistent or improving)
4. **Asset-class splits** — test whether veto works differently for FX vs crypto vs indices/commodities
5. **Combined scoring system** — for each pair: score = (dealer_direction * dealer_confidence) + (sentiment * sent_conf) + (strength * str_conf). Trade when score exceeds threshold.

---

## Technical Implementation Guide

### How to load data (MANDATORY — use this pattern)
```typescript
import { loadEnvConfig } from "@next/env";
loadEnvConfig(process.cwd());

import { listDataSectionWeeks } from "../src/lib/dataSectionWeeks";
import { deriveCotReportDate } from "../src/lib/dataSectionWeeks";
import { readSnapshot } from "../src/lib/cotStore";
import { getCanonicalBasketWeek, filterByModel, nonNeutralSignals } from "../src/lib/performance/basketSource";
import { getAggregatesForWeekStartWithBackfill } from "../src/lib/sentiment/store";
import { sentimentDirectionFromAggregate } from "../src/lib/sentiment/daily";
import { readWeeklyPairStrengths } from "../src/lib/strength/weeklyStrength";
import { loadWeeklyAdrMap, getAdrPct, getTargetAdrPct } from "../src/lib/performance/adrLookup";
import { getWeeklyPairReturns } from "../src/lib/pairReturns";
import { getDisplayWeekOpenUtc, normalizeWeekOpenUtc } from "../src/lib/weekAnchor";
import { PAIRS_BY_ASSET_CLASS } from "../src/lib/cotPairs";
```

### Baseline verification (MANDATORY first step)
Before trusting ANY new backtest, verify your data loading matches these baselines:
- **Dealer standalone:** 230 trades, +73.18% total, 2.19% max DD, 56.5% WR
- **Sentiment standalone:** 265 trades, +92.40% total, 19.56% max DD
- **Strength standalone:** 335 trades, +80.89% total, 14.98% max DD

If your numbers don't match, you have a data loading bug. Fix it before proceeding.

### ADR Normalization (always apply)
```typescript
const targetAdr = getTargetAdrPct(); // 1%
const pairAdr = getAdrPct(adrMap, pair, assetClass);
const multiplier = pairAdr > 0 ? targetAdr / pairAdr : 1;
const normalizedReturn = directedReturn * multiplier;
```

### Getting directions per source per week
```typescript
const basketWeek = await getCanonicalBasketWeek(weekOpenUtc);

// Dealer/Commercial/Sentiment from basket
const dealerSignals = filterByModel(basketWeek, "dealer");
const commSignals = filterByModel(basketWeek, "commercial");
const sentSignals = filterByModel(basketWeek, "sentiment");

// Non-neutral only
const dealerNonNeutral = nonNeutralSignals(dealerSignals);

// Strength from separate store
const strengthRows = await readWeeklyPairStrengths(weekOpenUtc);
```

### Getting returns
```typescript
const weeklyReturns = await getWeeklyPairReturns(weekOpenUtc);
// Returns have .symbol (not .pair!) and .returnPct and .assetClass
```

### Week filtering
```typescript
const currentWeekOpenUtc = getDisplayWeekOpenUtc();
const weeks = allWeeks.filter(w => w < currentWeekOpenUtc); // exclude current incomplete week
```

### COT tiebreaker (for forced direction on neutrals)
```typescript
function normalizeLean(net: number, long: number, short: number): number {
  const total = long + short;
  return total > 0 ? net / total : 0;
}
// For FX: pair_score = base_norm - quote_norm
// For non-FX: just base_norm
// Use readSnapshot for raw COT data, getCanonicalBasketWeek for verified baseline
```

### Strength tiebreaker
**CRITICAL: The field is `signedSpread`, not `spread`.**
```typescript
if (row.compositeScore === 0) {
  const spreadSum = row.windows.reduce((sum, w) => sum + (w.signedSpread ?? 0), 0);
  if (spreadSum > 0) dir = "LONG";
  else if (spreadSum < 0) dir = "SHORT";
}
```

### Veto logic
```typescript
function countOpposers(dir: Direction, sources: (Direction | null)[]): number {
  let count = 0;
  for (const s of sources) {
    if (s !== null && s !== dir) count++;
  }
  return count;
}
// Veto when countOpposers >= 2
// null = neutral = missing vote (not counted as agree or oppose)
```

### Composite: 2-of-3 NoComm
From `filterByModel(basketWeek, "antikythera_v3")` — this is the pre-computed 2-of-3 agreement system.

### Composite: Tiered V3
For tiered, the logic is in `src/lib/performance/tiered.ts`. The simplest way to get tiered directions: use the strategy backtest store or re-derive from 3-source agreement with tier weighting. Check existing script `backtest-strength-tiered-agreement-matrix.ts` for reference implementation.

### Composite: Selector
Use `selectorEngine.ts` — but for backtesting it may be easier to use `backtest-weekly-bias-context-selector.ts` as reference. The selector's directions are also available from the strategy backtest DB.

---

## Output Format

For each system tested, report this table row:
```
System Name | Trades | Total% | MaxDD% | R/DD | Win% | Losing Weeks | Worst Week%
```

Group results by phase. At the end, produce a **GRAND RANKING** sorted by:
1. First: fewest losing weeks
2. Then: lowest max DD
3. Then: highest R/DD
4. Then: highest win rate

Highlight any system that achieves **0 losing weeks**.

Also produce a **PORTFOLIO RANKING** for multi-sleeve combinations, showing:
- Individual sleeve performance
- Combined portfolio performance
- Whether diversification eliminated any losing weeks

---

## Deliverables

1. **A single script** (`scripts/backtest-veto-composite-sweep.ts`) that runs all phases and produces the full output.
2. **A summary markdown file** (`docs/VETO_COMPOSITE_SWEEP_RESULTS_2026-04-04.md`) with:
   - The grand ranking table
   - Top 5 systems by each metric (R/DD, DD, win rate, losing weeks)
   - Key insights and recommendations
   - What to test next with more data

Run the script with: `npx tsx scripts/backtest-veto-composite-sweep.ts`

The script should handle errors gracefully — if one phase fails, log the error and continue to the next phase. Don't let one broken test block everything else.

---

## Existing Scripts You Can Reference
These are already working and verified. Read them for patterns, don't reinvent:
- `scripts/backtest-veto-2of4.ts` — 2/4 veto implementation (verified)
- `scripts/backtest-tiebreaker-veto.ts` — tiebreaker + veto combined (verified after signedSpread fix)
- `scripts/backtest-tiebreaker.ts` — standalone tiebreaker (verified)
- `scripts/backtest-cot-combined.ts` — COT combined analysis (verified)
- `scripts/backtest-tandem-sleeve-portfolios.ts` — tandem sleeve architecture
- `scripts/backtest-strength-tiered-agreement-matrix.ts` — tiered variants
- `scripts/backtest-2of3-agreement-breakdown.ts` — agreement breakdown
- `scripts/backtest-weekly-bias-context-selector.ts` — selector engine

---

## Important Warnings
1. **`getWeeklyPairReturns` returns `.symbol` not `.pair`** — common bug source
2. **Strength uses `signedSpread` not `spread`** — causes silent wrong results
3. **Always filter `w < currentWeekOpenUtc`** to exclude the incomplete current week
4. **Commercial data can have null fields** — `commercial_net`, `commercial_long`, `commercial_short` can all be null
5. **Non-FX pairs** (crypto, indices, commodities) use base-only direction, not cross-currency
6. **Verify baselines FIRST** — if dealer isn't 230 trades / +73.18%, your data loading is wrong
