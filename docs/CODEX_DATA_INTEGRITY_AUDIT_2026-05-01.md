# CODEX: Full Data Integrity Audit

**Date:** 2026-05-01
**Problem:** Inconsistencies observed in the live app — Dealer not showing 36 trades on some weeks, potential gaps in other strategies. Need a systematic audit before building anything new.
**Goal:** Write and run a diagnostic script that checks every strategy × every week for data completeness, identifies exactly what's missing and why, and produces a clear report.

---

## Context

All four base sources (dealer, commercial, sentiment, strength) were explicitly engineered to produce 36 directions per week (36 pairs across FX, indices, crypto, commodities). If any week shows fewer than 36 trades, something is broken.

There are two possible failure points per pair per week:
1. **Signal gap** — the source emits NEUTRAL instead of LONG/SHORT → filtered at `signalsToDirectionMap()` line 181 of `weeklyHoldEngine.ts`
2. **Price gap** — the pair has a direction but `pair_period_returns` has no row for that week → silently skipped at line 682 of `weeklyHoldEngine.ts`

---

## Task: Create `scripts/audit-data-integrity.ts`

Write a script that:

### 1. Lists all available weeks

Query `pair_period_returns` for distinct `period_open_utc` values where `period_type = 'weekly'`, ordered descending. Also get the current display week from `getDisplayWeekOpenUtc()`.

### 2. For each week, check signal coverage for all 4 base sources

For each of `["dealer", "commercial", "sentiment", "strength"]`:
- Call the basket source to resolve signals for that week
- Count total signals, LONG count, SHORT count, NEUTRAL count
- List any pairs that are NEUTRAL (these are signal gaps)
- **Expected:** 36 total, 0 NEUTRAL

Use:
```typescript
import { resolveBasketSignals } from "@/lib/performance/basketSource";
// or whatever the exported function is — check basketSource.ts for the correct export
```

If `resolveBasketSignals` is not directly exported, use `resolveCotBasket` for dealer/commercial and `resolveSentimentBasket` for sentiment, `resolveStrengthBasket` for strength. Check the actual exports in `basketSource.ts`.

### 3. For each week, check price return coverage

Query `pair_period_returns` for all rows matching `(period_type='weekly', period_open_utc=weekOpenUtc)`:
```sql
SELECT symbol, asset_class, return_pct, open_price, close_price
  FROM pair_period_returns
 WHERE period_type = 'weekly'
   AND period_open_utc = $1::timestamptz
 ORDER BY asset_class, symbol
```

Count how many of the 36 canonical pairs have price data. List any missing pairs.

The canonical 36-pair universe is defined in `src/lib/cotPairs.ts` → `PAIRS_BY_ASSET_CLASS`. Import it and flatten to get the full list.

### 4. For each week, run the actual engine for key strategies

For each of `["dealer", "selector_frag3", "agree_4of4"]` (or whatever the current strategy IDs are — check `strategyConfig.ts`):
- Run `computeWeeklyHold(biasSource, weekOpenUtc)` 
- Record: `tradeCount`, `totalReturnPct`, `winCount`, `lossCount`
- Flag any week where `tradeCount < expectedTrades` (36 for dealer, may vary for others)

### 5. Cross-reference signals vs prices

For each base source × each week:
- Count pairs that have a direction signal (LONG or SHORT) but NO price data → these are **price-data gaps** (the pair would have traded but was silently dropped)
- Count pairs that have price data but NEUTRAL signal → these are **signal gaps** (the source didn't produce a direction)
- Both counts should be 0 for a healthy week

### 6. Output format

Print a structured report to stdout. Example format:

```
=== DATA INTEGRITY AUDIT ===
Weeks checked: 12
Canonical pairs: 36

--- SIGNAL COVERAGE ---
Source: dealer
  2026-03-30: 36/36 ✓
  2026-03-23: 36/36 ✓
  2026-03-16: 34/36 ✗ [NEUTRAL: NIKKEIUSD, WTIUSD]
  ...

Source: commercial
  2026-03-30: 36/36 ✓
  ...

Source: sentiment
  ...

Source: strength
  ...

--- PRICE RETURN COVERAGE ---
  2026-03-30: 36/36 ✓
  2026-03-23: 36/36 ✓
  2026-03-16: 35/36 ✗ [MISSING: NGUSD]
  ...

--- CROSS-REFERENCE (signal present but price missing) ---
  dealer × 2026-03-16: 1 pair with direction but no price [WTIUSD=LONG, no price row]
  ...

--- ENGINE TRADE COUNTS ---
Strategy: dealer
  2026-03-30: 36 trades, +12.5% ✓
  2026-03-23: 36 trades, +3.2% ✓
  2026-03-16: 33 trades, +1.8% ✗ (expected 36)
  ...

Strategy: selector_frag3
  ...

=== SUMMARY ===
Signal gaps: 4 total across 12 weeks
Price gaps: 2 total across 12 weeks
Engine shortfalls: 3 weeks with fewer trades than expected
```

### 7. Run it

```bash
npx tsx scripts/audit-data-integrity.ts
```

The script should exit with code 0 if all checks pass, code 1 if any gaps found.

---

## Implementation Notes

- **Database access:** Use `import { query } from "@/lib/db"` — the existing DB module
- **Basket source:** Check `src/lib/performance/basketSource.ts` for the correct export names. The functions are `resolveCotBasket`, `resolveSentimentBasket`, `resolveStrengthBasket` — but they may not all be exported. If not exported, add `export` to the ones you need.
- **Canonical pairs:** `import { PAIRS_BY_ASSET_CLASS } from "@/lib/cotPairs"` — flatten all asset classes into one array of pair names
- **Strategy config:** `import { getStrategy } from "@/lib/performance/strategyConfig"` — to get `BiasSourceConfig` for engine calls
- **Week options:** `import { listDataSectionWeeks } from "@/lib/dataSectionWeeks"` and `import { getDisplayWeekOpenUtc } from "@/lib/weekAnchor"`
- **Engine:** `import { computeWeeklyHold } from "@/lib/performance/weeklyHoldEngine"`
- **Do NOT modify any production code.** This is a read-only diagnostic script.
- **File header standard applies.**
- **Handle errors gracefully** — if a week fails to compute, log the error and continue to the next week. Don't let one broken week kill the entire audit.

---

## Files Created

| File | Action |
|------|--------|
| `scripts/audit-data-integrity.ts` | **CREATE** — diagnostic script |

**1 file created. 0 files modified.**

---

## Validation

1. [ ] Script runs without errors: `npx tsx scripts/audit-data-integrity.ts`
2. [ ] Signal coverage checked for all 4 base sources × all weeks
3. [ ] Price return coverage checked for all weeks
4. [ ] Cross-reference identifies exactly which pairs are missing and why
5. [ ] Engine trade counts verified for at least dealer + one composite strategy
6. [ ] Report clearly identifies every gap with the pair name and week
7. [ ] Exit code reflects pass/fail status
