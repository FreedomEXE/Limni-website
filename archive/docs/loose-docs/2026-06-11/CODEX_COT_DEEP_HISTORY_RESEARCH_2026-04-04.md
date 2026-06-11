# CODEX: Deep-History Dealer & Commercial Research — Momentum, Extremes, Spread, Trader Structure

**Date:** 2026-04-04
**Goal:** Using 260 weeks of stored COT history, test dealer-internal and commercial-internal enrichment signals that can (1) resolve dealer neutrals toward 36/36 coverage, and (2) improve commercial quality beyond the forced-raw baseline. No new ingestion needed — all data is already in the DB. This is a pure research pass.

**Success criteria:**
- Near-full dealer coverage (as close to 36/36 per week as possible)
- Robust fallback hierarchy, not one magic rule
- Minimal damage to dealer baseline (+73.17%, 2.20% DD, 56.5% WR over 10 backtestable weeks)
- Measurable improvement to commercial baseline (+21.14%, 29.04% DD, 52.5% WR)
- Same enrichment concepts should apply to BOTH dealer and commercial where possible

**Do NOT change any canonical direction logic. Research only.**

---

## Context

Prior passes tested single-week delta, OI, concentration, and cross-source relationships. Best dealer-internal neutral resolver was OI-confirmed delta (54.4% WR, 90/130 gaps). Nothing improved commercial beyond forced-raw.

We now have 260 weeks of FX snapshot history (2021-04-13 → 2026-03-31). This enables:
- Multi-week momentum (not just one-week delta)
- Historical percentile positioning (is current net extreme relative to history?)
- Spread-book quality analysis
- Trader-count structural signals

The frame is NOT "find one rule that resolves all neutrals." It IS "build a ranked resolver hierarchy where the best method gets tried first, then fallback to the next, only using weaker methods for remaining gaps."

---

## Data Loading

### Backtestable weeks
Use `listDataSectionWeeks()` to get weeks with price returns data (10 weeks: Jan 19 → Mar 22). These are the only weeks where we can compute actual returns. ADR-normalize all returns.

### Historical context window
For each backtestable week, load the **prior N snapshots** from the database to compute momentum, percentiles, etc. Use `listSnapshotDates("fx")` to get all 260 dates, then `readSnapshot({ assetClass: "fx", reportDate })` for each needed date.

**IMPORTANT:** When computing "prior 4-week momentum," use the 4 snapshot dates immediately before the current week's report date. The 260 dates are not all consecutive weeks (some may have gaps around holidays), so find dates by sorting and picking the N most recent before the target date.

### Loading pattern
```typescript
// Load all snapshot dates once
const allDates = await listSnapshotDates("fx");
// For each backtestable week:
//   1. Derive report date from weekOpenUtc
//   2. Load current snapshot
//   3. Load prior N snapshots for momentum/percentile context
//   4. Load returns + ADR data
```

Cache snapshot reads aggressively — many weeks will share prior snapshots in their lookback windows.

---

## Section 1: Multi-Week Dealer Momentum

For each FX currency, compute:
- **2-week net change:** `dealer_net[current] - dealer_net[2 weeks ago]`
- **4-week net change:** `dealer_net[current] - dealer_net[4 weeks ago]`
- **8-week net change:** `dealer_net[current] - dealer_net[8 weeks ago]`
- **Delta persistence:** how many of the last 4 weeks had `dealer_delta_net` in the same direction (0-4 score)
- **2-week %OI change:** `dealer_pct_of_oi[current] - dealer_pct_of_oi[2 weeks ago]`
- **4-week %OI change:** same for 4 weeks

For a **pair**, compute each metric as `base_metric - quote_metric` (same forced-raw pattern).

### Test as neutral resolver
For each neutral dealer pair-week, use each momentum metric as direction signal:
- Positive pair score → LONG, negative → SHORT
- Compute return (ADR-normalized)

```
Method                          | Gaps Filled | Total% | Win% | Avg%
────────────────────────────────┼─────────────┼────────┼──────┼──────
OI-confirmed delta (baseline)   | ???/130     | ???    | ???  | ???
2-week net momentum             | ???/130     | ???    | ???  | ???
4-week net momentum             | ???/130     | ???    | ???  | ???
8-week net momentum             | ???/130     | ???    | ???  | ???
Delta persistence (≥3 of 4)     | ???/130     | ???    | ???  | ???
2-week %OI momentum             | ???/130     | ???    | ???  | ???
4-week %OI momentum             | ???/130     | ???    | ???  | ???
```

### Test as non-neutral quality filter
For each non-neutral dealer pair-week, test whether momentum confirms or contradicts the existing direction:

```
Filter on non-neutral           | Pairs | Total% | Win% | Avg% | vs Baseline
────────────────────────────────┼───────┼────────┼──────┼──────┼───────────
All non-neutral (baseline)      | 150   | +38.03 | 55.3 | 0.254| —
4-week momentum confirms        | ???   | ???    | ???  | ???  | +/-X%
4-week momentum contradicts     | ???   | ???    | ???  | ???  | +/-X%
Delta persistence ≥3 confirms   | ???   | ???    | ???  | ???  | +/-X%
```

"Confirms" = the pair momentum direction matches the dealer direction for that pair.

---

## Section 2: Historical Extremeness

For each FX currency at each backtestable week, compute the **percentile rank** of the current `dealer_net` against all prior snapshots in the 260-week history.

```typescript
// Percentile: what fraction of historical values is current net greater than
const priorNets = priorSnapshots.map(s => s.currencies[ccy]?.dealer_net).filter(n => typeof n === "number");
const percentile = priorNets.filter(n => n < currentNet).length / priorNets.length;
// percentile near 1.0 = extreme bullish (historically high net)
// percentile near 0.0 = extreme bearish (historically low net)
```

Also compute:
- **%OI percentile:** current `dealer_pct_of_oi` vs history
- **Extreme + rising:** percentile > 0.8 AND 4-week momentum positive (building into extreme)
- **Extreme + fading:** percentile > 0.8 AND 4-week momentum negative (unwinding from extreme)
- Same for bearish extremes (percentile < 0.2)

### Test as neutral resolver
For neutral pairs, use `base_percentile - quote_percentile` as direction signal:

```
Method                          | Gaps Filled | Total% | Win% | Avg%
────────────────────────────────┼─────────────┼────────┼──────┼──────
Net percentile direction        | ???/130     | ???    | ???  | ???
%OI percentile direction        | ???/130     | ???    | ???  | ???
Only when extreme (>80 or <20)  | ???/130     | ???    | ???  | ???
Extreme + rising direction      | ???/130     | ???    | ???  | ???
```

### Test as non-neutral quality filter
```
Filter on non-neutral           | Pairs | Total% | Win% | Avg% | vs Baseline
────────────────────────────────┼───────┼────────┼──────┼──────┼───────────
Current net at extreme pctile   | ???   | ???    | ???  | ???  | +/-X%
Current net in middle (20-80)   | ???   | ???    | ???  | ???  | +/-X%
Extreme + rising confirms dir   | ???   | ???    | ???  | ???  | +/-X%
Extreme + fading (caution)      | ???   | ???    | ???  | ???  | +/-X%
```

---

## Section 3: Spread-Book Quality

Dealer `spread` positions represent hedged/non-directional book. A large spread relative to directional positions suggests the dealer's net is less meaningful.

For each currency, compute:
- **Directional ratio:** `abs(dealer_net) / (abs(dealer_net) + dealer_spread)` — higher = more directional, lower = more hedged
- **Spread intensity:** `dealer_spread / (dealer_long + dealer_short)` — what fraction of total book is spread

### Test as neutral resolver
For neutral pairs: use directional ratio difference (`base_ratio - quote_ratio`) as direction signal — the currency with higher directional ratio is more "committed":

```
Method                          | Gaps Filled | Total% | Win% | Avg%
────────────────────────────────┼─────────────┼────────┼──────┼──────
Directional ratio direction     | ???/130     | ???    | ???  | ???
Only high-ratio pairs (>0.3)    | ???/130     | ???    | ???  | ???
```

### Test as non-neutral quality filter
```
Filter on non-neutral           | Pairs | Total% | Win% | Avg% | vs Baseline
────────────────────────────────┼───────┼────────┼──────┼──────┼───────────
Both currencies high-ratio      | ???   | ???    | ???  | ???  | +/-X%
Either currency low-ratio       | ???   | ???    | ???  | ???  | +/-X%
```

---

## Section 4: Trader-Count Structure

For each currency, compute:
- **Trader imbalance:** `dealers_long / dealers_short` (or inverse if < 1)
- **Net built by many vs few:** `max(dealers_long, dealers_short)` — high count = broad consensus, low count = concentrated bet

### Test as neutral resolver
For neutral pairs: use trader count difference as direction signal — the side with more traders represents broader conviction:

```
Method                          | Gaps Filled | Total% | Win% | Avg%
────────────────────────────────┼─────────────┼────────┼──────┼──────
Trader imbalance direction      | ???/130     | ???    | ???  | ???
Only when imbalance > 1.5:1     | ???/130     | ???    | ???  | ???
```

### Test as non-neutral quality filter
```
Filter on non-neutral           | Pairs | Total% | Win% | Avg% | vs Baseline
────────────────────────────────┼───────┼────────┼──────┼──────┼───────────
Strong trader imbalance (>1.5)  | ???   | ???    | ???  | ???  | +/-X%
Weak imbalance (<1.2)           | ???   | ???    | ???  | ???  | +/-X%
High total trader count         | ???   | ???    | ???  | ???  | +/-X%
Low total trader count          | ???   | ???    | ???  | ???  | +/-X%
```

---

## Section 5: Stacked Neutral Resolver

This is the key section. Test a **ranked hierarchy** where methods are tried in order of quality, and each neutral pair gets resolved by the first method that applies:

**Proposed stack (test this exact order):**

```
Tier 1: OI-confirmed delta              (prior best: 54.4% WR, ~90/130)
Tier 2: 4-week momentum (if |score| > threshold)  (untested, hopefully fills more)
Tier 3: Historical extreme (pctile >80 or <20)     (untested)
Tier 4: Delta-based (any direction)     (prior: 50.8% WR, fills all remaining)
```

For each neutral pair-week:
1. Try Tier 1. If it resolves (has a direction) → use it, skip to next pair.
2. If Tier 1 doesn't resolve → try Tier 2. If it resolves → use it.
3. Continue down the stack.
4. If nothing resolves → pair stays NEUTRAL (don't force).

**Output a waterfall table:**

```
Tier                    | Resolved | Cumulative | Tier Win% | Cumulative Win% | Tier Total%
────────────────────────┼──────────┼────────────┼───────────┼─────────────────┼───────────
Tier 1: OI+Delta        | ???      | ???/130    | ???       | ???             | ???
Tier 2: 4wk Momentum    | ???      | ???/130    | ???       | ???             | ???
Tier 3: Extreme Pctile  | ???      | ???/130    | ???       | ???             | ???
Tier 4: Delta Fallback   | ???      | ???/130    | ???       | ???             | ???
Remaining unresolved     | ???      | ???/130    | —         | —               | —
```

**Also test alternative tier orderings** — the optimal stack may not match the proposed order. Test at least 3 orderings:
1. The proposed order above
2. Leading with 4-week momentum
3. Leading with historical extremes

Report which ordering achieves the best cumulative WR while resolving the most gaps.

**Then compute the combined dealer result:**

```
                        | Pairs | Total% | MaxDD% | Win% | vs Current Dealer
────────────────────────┼───────┼────────┼────────┼──────┼──────────────────
Current dealer (no fill)| ~230  | +73.17 | 2.20   | 56.5 | —
Dealer + stacked fill   | ~360  | ???    | ???    | ???  | +/-X%
```

This tells us: if we resolve neutrals with the stacked hierarchy, what happens to the overall dealer standalone performance? The key constraint is that `Total%` should stay reasonably close and `MaxDD%` should not materially increase.

---

## Section 6: Commercial Deep-History Research

Apply the same enrichment concepts to commercial. For commercial, every pair already has a direction (forced-raw), so this is purely about **quality improvement** — distinguishing strong from weak commercial signals.

### Multi-week commercial momentum
For each pair-week:
- 4-week commercial net change (same forced-raw logic: `base_comm_net - quote_comm_net` at current vs 4 weeks ago)
- Commercial delta persistence (how many of last 4 weeks had commercial delta in same direction)

```
Filter on commercial forced-raw | Pairs | Total% | Win% | Avg% | vs Baseline
────────────────────────────────┼───────┼────────┼──────┼──────┼───────────
Baseline (all forced-raw)       | 280   | +23.41 | 52.9 | 0.084| —
4-week momentum confirms        | ???   | ???    | ???  | ???  | +/-X%
4-week momentum contradicts     | ???   | ???    | ???  | ???  | +/-X%
Delta persistence ≥3 confirms   | ???   | ???    | ???  | ???  | +/-X%
```

### Historical extremeness for commercial
- Commercial net percentile vs 260-week history
- Extreme commercial positioning (>80th or <20th percentile) = stronger signal?

```
Filter on commercial forced-raw | Pairs | Total% | Win% | Avg% | vs Baseline
────────────────────────────────┼───────┼────────┼──────┼──────┼───────────
Commercial at extreme pctile    | ???   | ???    | ???  | ???  | +/-X%
Commercial in middle (20-80)    | ???   | ???    | ???  | ???  | +/-X%
Extreme + momentum confirms     | ???   | ???    | ???  | ???  | +/-X%
```

### Mean-reversion context
Commercial positioning often mean-reverts. Test:
- Current net far from 52-week mean → direction toward mean is more likely correct?
- Net moving toward mean vs away from mean

```
Filter on commercial forced-raw | Pairs | Total% | Win% | Avg% | vs Baseline
────────────────────────────────┼───────┼────────┼──────┼──────┼───────────
Moving toward 52w mean          | ???   | ???    | ???  | ???  | +/-X%
Moving away from 52w mean       | ???   | ???    | ???  | ???  | +/-X%
Far from mean + returning       | ???   | ???    | ???  | ???  | +/-X%
```

---

## Output Format

**Script:** `scripts/research-cot-deep-history.ts`
**Output:** `docs/COT_DEEP_HISTORY_RESEARCH_RESULTS_2026-04-04.md`

Include all 6 sections. At the bottom, add a **Summary** answering:

1. Which dealer momentum window (2/4/8 week) is most useful for neutral resolution?
2. Does historical extremeness add signal beyond momentum?
3. Does spread-book quality or trader structure contribute meaningfully?
4. What is the best stacked resolver hierarchy and how many gaps does it fill?
5. What is the combined dealer standalone performance with stacked resolution?
6. Which commercial enrichment (if any) improves forced-raw quality?
7. Do the same enrichment concepts (momentum, extremes) help both dealer and commercial?

---

## Files Changed Summary

| File | Change |
|------|--------|
| `scripts/research-cot-deep-history.ts` | New research script |
| `docs/COT_DEEP_HISTORY_RESEARCH_RESULTS_2026-04-04.md` | Research output |

No library code changes. No ingestion changes. All data already exists in the DB.

---

## Important Warnings

1. **Prior snapshot loading must handle missing dates gracefully.** Not every week may have a snapshot. If "4 weeks ago" doesn't have a snapshot, use the closest prior date. Log when this happens.
2. **Percentile calculation needs sufficient history.** For the earliest backtestable weeks (Jan 2025), there should still be ~200+ prior snapshots. If fewer than 52 prior snapshots exist, skip the percentile calculation for that week/currency.
3. **Cache snapshot reads.** The research script will load many snapshots repeatedly across different weeks' lookback windows. Load all 260 snapshots once at startup and index by date.
4. **Reproduce known baselines** at the start: dealer non-neutral (150 pairs / +38.03% / 55.3% WR), dealer neutral lean (130 pairs / -58.66% / 34.6%), commercial forced-raw (280 pairs / +23.41% / 52.9%). If these don't match, stop and report the discrepancy.
5. **The stacked resolver must resolve pairs in order** — once a tier assigns a direction to a pair, lower tiers don't touch it. Track which tier resolved each pair for the waterfall table.
6. **For Section 5 combined dealer result:** compute the 10-week standalone performance exactly like the engine does — all 36 pairs per week, non-neutral pairs use existing dealer direction, resolved neutral pairs use the stacked direction, unresolved neutrals are skipped. ADR-normalize all returns. Report Total%, MaxDD% (true cumulative), and Win%.
7. **dealer_spread may be null** for some currencies/weeks. Handle gracefully — skip the spread quality analysis for that pair-week.
8. **Thresholds for momentum/extremes:** don't hardcode one threshold. Test a small grid (e.g., for 4-week momentum: minimum absolute score of 0, 5000, 10000, 20000). Report which threshold gives the best WR while still resolving enough gaps.
9. **Do NOT promote inverted lean.** It's a 10-week mirror artifact. Don't include it in the stacked resolver hierarchy.
