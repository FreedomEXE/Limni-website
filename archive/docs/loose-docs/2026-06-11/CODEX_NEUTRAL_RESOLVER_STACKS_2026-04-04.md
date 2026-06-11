# CODEX: Neutral Resolver Stacks — Sentiment + Strength

**Date:** 2026-04-04
**Goal:** Build hierarchical neutral-only resolver stacks for sentiment and strength. Same playbook as dealer/commercial: preserve all existing non-neutral logic, only engineer the neutral gap. Target: 36/36 coverage per week with minimal quality degradation. **Research only — no production code changes.**

**Context — What the first pass proved:**

Sentiment S1 baseline: 229/360 trades, +28.49%, 19.56% DD, 56.8% WR, 5 losing weeks.
Strength T1 baseline: 335/360 trades, +80.89%, 14.98% DD, 54.6% WR, 4 losing weeks.

Global threshold changes failed:
- S2 (60/40 everywhere): only +24 trades, nearly same return, slightly better DD
- S3 (>50 fade everywhere): +77 trades but destroyed return (+14.01%, 24.13% DD)
- T5 (raw spread sum): +16 trades with minimal damage (+78.72%, 15.09% DD) — closest to success

The lesson: **targeted neutral-bucket surgery**, not source-wide rewrites. Each tier uses a different data dimension, tries in order, first hit wins. Exactly what the dealer 5-tier resolver did.

**Gap analysis:**
- Sentiment: 229 trades from S1. 316 pair-weeks have data. **87 neutrals with data** to resolve. 44 pair-weeks have no sentiment data at all (data ceiling = 316/360).
- Strength: 335 trades from T1. 357 pair-weeks have data. **22 neutrals with data** to resolve. 3 pair-weeks have no strength data (data ceiling = 357/360).

---

## Phase 1: Research Script

**Script:** `scripts/research-neutral-resolvers.ts`
**Output:** `docs/NEUTRAL_RESOLVER_RESEARCH_2026-04-04.md`

### Data Loading

Same infrastructure as the previous research script. Use `listDataSectionWeeks()` for 10 backtestable weeks (Jan 19 → Mar 22).

For each week, load:

1. **Returns:** `getWeeklyPairReturns(weekOpenUtc)` → all pairs.
2. **ADR:** `loadWeeklyAdrMap(weekOpenUtc)` → multiplier = `getTargetAdrPct() / getAdrPct(adrMap, pair)`. If unavailable, multiplier = 1.
3. **Sentiment current:** `getAggregatesAsOf(weekOpenUtc)` → latest aggregate per symbol as of week open.
4. **Sentiment prior:** `getAggregatesAsOf(priorWeekOpenUtc)` where `priorWeekOpenUtc = DateTime.fromISO(weekOpenUtc, { zone: "utc" }).minus({ weeks: 1 }).toISO()`.
5. **Strength current:** `readWeeklyPairStrengths(weekOpenUtc)` → per-pair window readings.
6. **Strength prior:** `readWeeklyPairStrengths(priorWeekOpenUtc)`.

**Imports:** Same as previous script (`research-sentiment-strength.ts`). Copy the import block and utility functions (round, signedPct, directionalReturn, computeMaxDd, etc.).

### Core Architecture

The script operates in two phases per source:

**Phase A — Individual tier testing:** Apply each tier ONLY to the baseline's neutral pair-weeks. Report how many neutrals it resolves, the average return of resolved trades, and their win rate. This tells us which tiers add positive value.

**Phase B — Stack testing:** Apply tiers in hierarchical order (first hit wins). Report total coverage, return, DD, WR, and losing weeks. Test multiple stack variants (different tier combinations and ordering).

---

### Sentiment Resolver Tiers

**The S1 baseline function (DO NOT MODIFY — use exactly as-is for non-neutrals):**

```typescript
function sentimentS1(agg: SentimentAggregate | undefined): Direction | null {
  if (!agg) return null;
  const flip = String(agg.flip_state ?? "").trim().toUpperCase();
  const crowding = String(agg.crowding_state ?? "").trim().toUpperCase();
  if (flip === "FLIPPED_UP") return "LONG";
  if (flip === "FLIPPED_DOWN") return "SHORT";
  if (flip === "FLIPPED_NEUTRAL") return null;
  if (crowding === "CROWDED_LONG" || crowding === "EXTREME_LONG") return "SHORT";
  if (crowding === "CROWDED_SHORT" || crowding === "EXTREME_SHORT") return "LONG";
  return null;
}
```

**The following tiers fire ONLY when S1 returns null (neutral pair-weeks).**

#### Tier 1: Mild Crowding (60/40)

The 60–65% and 35–40% band. S2 proved this is safe (+28.22% vs +28.49% with lower DD).

```typescript
function sentTier1_MildCrowding(agg: SentimentAggregate): Direction | null {
  if (agg.agg_long_pct >= 60) return "SHORT";  // mild crowded long → fade
  if (agg.agg_long_pct <= 40) return "LONG";    // mild crowded short → fade
  return null;
}
```

#### Tier 2: 2-Week Persistent Bias

If the reading has been on the same side of 50 for 2 consecutive weeks AND the 2-week average crosses a meaningful threshold, it's a real lean, not noise.

```typescript
function sentTier2_Persistence(
  current: SentimentAggregate,
  prior: SentimentAggregate | undefined,
): Direction | null {
  if (!prior) return null;
  const currentSide = current.agg_long_pct > 50 ? "long" : current.agg_long_pct < 50 ? "short" : null;
  const priorSide = prior.agg_long_pct > 50 ? "long" : prior.agg_long_pct < 50 ? "short" : null;
  if (!currentSide || !priorSide || currentSide !== priorSide) return null;
  // Same side for 2 weeks. Check if the average crosses threshold.
  const avg = (current.agg_long_pct + prior.agg_long_pct) / 2;
  if (avg >= 55) return "SHORT";  // persistent mild long bias → fade
  if (avg <= 45) return "LONG";   // persistent mild short bias → fade
  return null;
}
```

#### Tier 3: Within-Week Relative Extremity

Among all remaining neutrals in the same week, this pair is more extreme than the median. Adapts to the week's baseline — in a mild week, even a 54% reading is notable.

**Implementation requires a two-pass approach within each week:**

```typescript
// Pass 1: collect all unresolved neutrals for this week with their extremity scores
type NeutralCandidate = {
  pair: string;
  assetClass: AssetClass;
  agg: SentimentAggregate;
  extremity: number;  // abs(agg_long_pct - 50)
};

// Pass 2: compute median extremity across all unresolved neutrals this week
// Resolve only pairs ABOVE the median

function sentTier3_RelativeExtremity(
  agg: SentimentAggregate,
  medianExtremity: number,
): Direction | null {
  const extremity = Math.abs(agg.agg_long_pct - 50);
  if (extremity <= medianExtremity) return null;  // below median = too mild
  if (agg.agg_long_pct > 50) return "SHORT";  // fade
  if (agg.agg_long_pct < 50) return "LONG";   // fade
  return null;
}
```

**IMPORTANT:** The median must be computed AFTER tiers 1-2 have already resolved their fills. Tier 3 only sees the neutrals that tiers 1-2 couldn't resolve. This means the stack must be applied in order: T1 fills → T2 fills → compute remaining neutrals → T3 fills.

#### Tier 4: Meaningful Soft Fade (53/47)

A threshold that's meaningfully away from 50 but softer than 60/40. Freedom's requirement: "not just 50.1".

```typescript
function sentTier4_SoftFade(agg: SentimentAggregate): Direction | null {
  if (agg.agg_long_pct >= 53) return "SHORT";
  if (agg.agg_long_pct <= 47) return "LONG";
  return null;
}
```

#### Tier 5: Forced Lean (51/49)

Last resort. Any meaningful lean. Still excludes dead-center 49-51 range.

```typescript
function sentTier5_ForcedLean(agg: SentimentAggregate): Direction | null {
  if (agg.agg_long_pct >= 51) return "SHORT";
  if (agg.agg_long_pct <= 49) return "LONG";
  return null;
}
```

Note: this intentionally uses 51/49 not 50. A pair at 50.1% long is genuinely uninformative.

---

### Strength Resolver Tiers

**The T1 baseline function (DO NOT MODIFY — use exactly as-is for non-neutrals):**

```typescript
function strengthT1(ps: WeeklyPairStrength | undefined): Direction | null {
  if (!ps || ps.availableWindows === 0) return null;
  if (ps.compositeDirection === "NEUTRAL") return null;
  return ps.compositeDirection as Direction;
}
```

**The following tiers fire ONLY when T1 returns null (neutral composite score = 0).**

#### Tier 1: Raw Spread Sum

The T5 approach from the previous research. Sum all raw signed spreads across windows. Direction = sign of sum. This is the strongest neutral resolver — it uses all available information.

```typescript
function strTier1_RawSpreadSum(ps: WeeklyPairStrength): Direction | null {
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
}
```

#### Tier 2: Weighted Spread Sum (24h × 2)

Same idea but weight the 24h window double. Longer windows = more stable signal.

```typescript
function strTier2_WeightedSpread(ps: WeeklyPairStrength): Direction | null {
  let sum = 0;
  let hasData = false;
  for (const w of ps.windows) {
    if (w.available && w.signedSpread !== null && Number.isFinite(w.signedSpread)) {
      const weight = w.window === "24h" ? 2 : 1;
      sum += weight * w.signedSpread;
      hasData = true;
    }
  }
  if (!hasData || sum === 0) return null;
  return sum > 0 ? "LONG" : "SHORT";
}
```

#### Tier 3: 24h Window Only

If the composite is neutral (windows cancel out), trust the longest window as tiebreaker. It's the most stable of the three.

```typescript
function strTier3_Window24hOnly(ps: WeeklyPairStrength): Direction | null {
  const w24h = ps.windows.find((w) => w.window === "24h");
  if (!w24h || !w24h.available || w24h.signedSpread === null) return null;
  if (w24h.signedSpread > 0) return "LONG";
  if (w24h.signedSpread < 0) return "SHORT";
  return null;
}
```

#### Tier 4: Softer Threshold (4)

Re-classify windows with threshold=4 instead of 5. A window with spread 4.5 that was NEUTRAL under threshold=5 becomes directional.

```typescript
function strTier4_SoftThreshold(ps: WeeklyPairStrength): Direction | null {
  let score = 0;
  for (const w of ps.windows) {
    if (!w.available || w.signedSpread === null) continue;
    if (w.signedSpread > 4) score += 1;
    else if (w.signedSpread < -4) score -= 1;
  }
  if (score === 0) return null;
  return score > 0 ? "LONG" : "SHORT";
}
```

#### Tier 5: Any Single Window Lean

If ANY window has a non-zero raw spread, use the sign of the most extreme window's spread.

```typescript
function strTier5_AnyWindowLean(ps: WeeklyPairStrength): Direction | null {
  let maxAbsSpread = 0;
  let maxDir: Direction | null = null;
  for (const w of ps.windows) {
    if (!w.available || w.signedSpread === null) continue;
    const abs = Math.abs(w.signedSpread);
    if (abs > maxAbsSpread) {
      maxAbsSpread = abs;
      maxDir = w.signedSpread > 0 ? "LONG" : "SHORT";
    }
  }
  return maxDir;
}
```

---

### Stack Variants to Test

#### Sentiment Stacks

All stacks start with S1 non-neutrals locked. The stack only fires for S1 neutrals.

| Stack | Tiers Applied (in order) | Description |
|-------|--------------------------|-------------|
| **SA: Conservative** | Tier 1 (60/40) only | The proven-safe extension |
| **SB: Moderate** | Tier 1 → Tier 2 (persistence) → Tier 4 (53/47) | Adds persistence context, then soft fade |
| **SC: Full** | Tier 1 → Tier 2 → Tier 3 (relative extremity) → Tier 4 → Tier 5 (forced lean 51/49) | Maximum coverage attempt |
| **SD: No Forced Lean** | Tier 1 → Tier 2 → Tier 3 → Tier 4 | Full minus the weakest tier |
| **SE: Quality-First** | Tier 1 → Tier 2 → Tier 3 | Only tiers with contextual intelligence, no raw threshold fallbacks |

#### Strength Stacks

All stacks start with T1 non-neutrals locked. The stack only fires for T1 neutrals.

| Stack | Tiers Applied (in order) | Description |
|-------|--------------------------|-------------|
| **TA: Simple** | Tier 1 (raw spread sum) only | The T5 approach from previous research |
| **TB: Moderate** | Tier 1 → Tier 2 (weighted) → Tier 3 (24h only) | Layered spread analysis |
| **TC: Full** | Tier 1 → Tier 2 → Tier 3 → Tier 4 (softer threshold) → Tier 5 (any window lean) | Maximum coverage |
| **TD: Conservative** | Tier 1 → Tier 3 (24h only) | Raw sum + longest-window tiebreaker |

---

### Row Structure

```typescript
type Row = {
  weekOpenUtc: string;
  assetClass: AssetClass;
  pair: string;
  rawReturnPct: number;
  adrMultiplier: number;

  // Baseline directions
  sentS1: Direction | null;
  strT1: Direction | null;

  // Whether this is a neutral (baseline returned null but data exists)
  sentIsNeutral: boolean;  // sentS1 === null && has sentiment data
  strIsNeutral: boolean;   // strT1 === null && has strength data

  // Individual tier signals (only computed for neutrals)
  sentTiers: {
    tier1: Direction | null;
    tier2: Direction | null;
    tier3: Direction | null;  // set in pass 2 after computing median
    tier4: Direction | null;
    tier5: Direction | null;
  } | null;  // null if not a sentiment neutral

  strTiers: {
    tier1: Direction | null;
    tier2: Direction | null;
    tier3: Direction | null;
    tier4: Direction | null;
    tier5: Direction | null;
  } | null;  // null if not a strength neutral

  // Raw data for tier computation
  aggLongPct: number | null;     // for sentiment tiers
  priorAggLongPct: number | null; // for persistence tier
};
```

### Building Rows — Two-Pass Approach

**Pass 1:** For each week, for each pair:
1. Compute S1 direction, T1 direction
2. Flag neutrals (`sentIsNeutral`, `strIsNeutral`)
3. For sentiment neutrals: compute Tier 1 (60/40), Tier 2 (persistence), Tier 4 (53/47), Tier 5 (forced lean)
4. For strength neutrals: compute all 5 strength tiers
5. Leave sentiment Tier 3 as null (needs median from all neutrals in this week)

**Pass 2 (per-week):** Collect all sentiment neutrals that were NOT resolved by Tiers 1-2 for this week. Compute the median extremity across those remaining neutrals. Then apply Tier 3 to each.

**Implementation:**
```typescript
// After Pass 1, group sentiment neutrals by week
for (const weekOpenUtc of uniqueWeeks) {
  // Get all sentiment neutrals for this week where tier1 and tier2 both returned null
  const unresolvedNeutrals = rows.filter(
    (r) => r.weekOpenUtc === weekOpenUtc
      && r.sentIsNeutral
      && r.sentTiers
      && r.sentTiers.tier1 === null
      && r.sentTiers.tier2 === null
  );

  if (unresolvedNeutrals.length === 0) continue;

  const extremities = unresolvedNeutrals.map((r) => Math.abs((r.aggLongPct ?? 50) - 50));
  const medianExtremity = computeMedian(extremities);

  for (const row of unresolvedNeutrals) {
    const ext = Math.abs((row.aggLongPct ?? 50) - 50);
    if (ext > medianExtremity && row.aggLongPct !== null) {
      row.sentTiers!.tier3 = row.aggLongPct > 50 ? "SHORT" : row.aggLongPct < 50 ? "LONG" : null;
    }
  }
}
```

### Stats Computation

For each stack variant, compute:

```typescript
type StackStats = {
  // Baseline stats (S1 or T1 trades, unchanged)
  baselineTrades: number;
  baselineReturnPct: number;

  // Resolver additions
  resolvedTrades: number;
  resolvedReturnPct: number;  // total return from ONLY the resolved trades
  resolvedWinRate: number;    // win rate of ONLY the resolved trades

  // Combined (baseline + resolver)
  totalTrades: number;
  totalReturnPct: number;
  maxDdPct: number;
  winRatePct: number;
  coverage: string;         // "X/360"
  losingWeeks: number;      // weeks where aggregate return < 0

  // Per-tier fill counts (how many neutrals each tier resolved)
  tierFills: Record<string, number>;
};
```

**CRITICAL: Report resolver trades SEPARATELY from baseline.** This lets us see if the resolver adds positive or negative value. The combined result is baseline + resolver.

**MaxDD:** Computed from the combined equity curve (all baseline + resolver trades, aggregated per week).

**Losing weeks:** Count of weeks where the total aggregated return (baseline + resolver) is negative.

### Individual Tier Quality Report

For each tier independently (applied to all neutrals, not in stack order):

```markdown
| Tier | Fills | Total% | Avg% | Win% | Description |
| --- | ---: | ---: | ---: | ---: | --- |
| Tier 1: 60/40 | X | Y% | Z% | W% | Mild crowding fade |
| Tier 2: Persistence | X | Y% | Z% | W% | 2-week avg >= 55/45 |
| ... | | | | | |
```

This shows the raw quality of each tier's signals before stacking.

---

### Output Format

Write to `docs/NEUTRAL_RESOLVER_RESEARCH_2026-04-04.md`:

```markdown
# Neutral Resolver Stack Research

Weeks analyzed: 10 (Jan 19 → Mar 22).
Universe: 36 pairs × 10 weeks = 360 possible pair-weeks.

## Gap Analysis

### Sentiment
- S1 baseline: 229/360 trades
- Neutrals with data: 87 pair-weeks
- Neutrals without data: 44 pair-weeks
- Data ceiling: 316/360 (87.8%)

### Strength
- T1 baseline: 335/360 trades
- Neutrals with data: 22 pair-weeks
- Neutrals without data: 3 pair-weeks
- Data ceiling: 357/360 (99.2%)

## Sentiment Resolver

### Individual Tier Quality

| Tier | Fills | Total% | Avg% | Win% | Description |
| --- | ---: | ---: | ---: | ---: | --- |
| Tier 1: 60/40 | ??? | ??? | ??? | ??? | Mild crowding fade |
| Tier 2: Persistence (55/45 avg) | ??? | ??? | ??? | ??? | 2-week persistent bias |
| Tier 3: Relative extremity | ??? | ??? | ??? | ??? | Above-median within-week |
| Tier 4: Soft fade (53/47) | ??? | ??? | ??? | ??? | Meaningful threshold |
| Tier 5: Forced lean (51/49) | ??? | ??? | ??? | ??? | Last resort |

### Sentiment Stack Results

For each stack, show per-asset-class + combined:

#### SA: Conservative (60/40 only)

| Asset Class | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| fx | ??? | ??? | ??? | ??? | ??? | ???/280 |
| indices | ??? | ??? | ??? | ??? | ??? | ???/30 |
| crypto | ??? | ??? | ??? | ??? | ??? | ???/20 |
| commodities | ??? | ??? | ??? | ??? | ??? | ???/30 |
| combined | ??? | ??? | ??? | ??? | ??? | ???/360 |
| *of which resolver* | ??? | ??? | — | ??? | — | — |

(repeat for SB, SC, SD, SE)

### Sentiment Stack Comparison

| Stack | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage | Resolver Avg% |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| S1 Baseline (no resolver) | 229 | +28.49% | 19.56% | 56.8% | 5 | 229/360 | — |
| SA: Conservative | ??? | ??? | ??? | ??? | ??? | ???/360 | ??? |
| SB: Moderate | ??? | ??? | ??? | ??? | ??? | ???/360 | ??? |
| SC: Full | ??? | ??? | ??? | ??? | ??? | ???/360 | ??? |
| SD: No Forced Lean | ??? | ??? | ??? | ??? | ??? | ???/360 | ??? |
| SE: Quality-First | ??? | ??? | ??? | ??? | ??? | ???/360 | ??? |

## Strength Resolver

### Individual Tier Quality

| Tier | Fills | Total% | Avg% | Win% | Description |
| --- | ---: | ---: | ---: | ---: | --- |
| Tier 1: Raw spread sum | ??? | ??? | ??? | ??? | Sum all window spreads |
| Tier 2: Weighted (24h×2) | ??? | ??? | ??? | ??? | 24h weighted double |
| Tier 3: 24h only | ??? | ??? | ??? | ??? | Longest window tiebreak |
| Tier 4: Softer threshold (4) | ??? | ??? | ??? | ??? | Re-classify at threshold=4 |
| Tier 5: Any window lean | ??? | ??? | ??? | ??? | Most extreme single window |

### Strength Stack Results

(same per-asset-class table format as sentiment, for TA, TB, TC, TD)

### Strength Stack Comparison

| Stack | Trades | Total% | MaxDD% | Win% | Losing Wks | Coverage | Resolver Avg% |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| T1 Baseline (no resolver) | 335 | +80.89% | 14.98% | 54.6% | 4 | 335/360 | — |
| TA: Simple | ??? | ??? | ??? | ??? | ??? | ???/360 | ??? |
| TB: Moderate | ??? | ??? | ??? | ??? | ??? | ???/360 | ??? |
| TC: Full | ??? | ??? | ??? | ??? | ??? | ???/360 | ??? |
| TD: Conservative | ??? | ??? | ??? | ??? | ??? | ???/360 | ??? |
```

---

## Important Warnings

1. **Sentiment Tier 3 (relative extremity) requires two-pass computation.** First resolve Tiers 1-2 for the whole week, then compute the median extremity of remaining neutrals, then apply Tier 3. The median changes per week and per stack variant. For simplicity, compute it once assuming Tiers 1-2 have fired first (the standard stack order).

2. **Individual tier quality testing is INDEPENDENT of stack order.** When testing Tier 3 individually, apply it to ALL S1 neutrals (not just those after Tiers 1-2). For the individual quality table, each tier sees the full neutral pool. For the stack tables, tiers see only what prior tiers didn't resolve.

3. **For individual tier quality testing of Tier 3:** Compute the median extremity across ALL S1 neutrals for that week (not just post-tier-1-2 neutrals). This gives the "standalone" quality of the tier.

4. **Resolver trades should be reported separately** with their own Total%, Avg%, and Win%. This isolates the resolver's value-add from the baseline.

5. **Do NOT modify any production code.** Create only the research script and output markdown.

6. **Sentiment data ceiling is 316/360.** Some stacks may reach ~306-316 depending on how many pair-weeks sit at exactly 50.0%. Report the actual ceiling reached.

7. **Strength data ceiling is 357/360.** The 3 missing pair-weeks are data gaps (no strength snapshots), not algorithm gaps. No resolver can fill them.

8. **ADR normalization always on.** Same as previous research.

9. **`loadEnvConfig(process.cwd())` must be called first** before any DB-dependent imports.

10. **Sentiment flip_state / crowding_state normalization:** Use `.trim().toUpperCase()` and handle EXTREME_LONG / EXTREME_SHORT same as CROWDED (same as previous script).

11. **Losing weeks = weeks where aggregate weekly return (sum of all pairs' ADR-normalized directional returns) is < 0.** Count these per stack variant.

12. **Prior week data:** For Tier 2 (persistence), load prior week aggregates. If the first backtestable week has no prior data, Tier 2 returns null for all pairs in that week. Other tiers still work.

13. **The `computeMedian` helper:** Sort array ascending, return middle value (or average of two middle values for even-length arrays).

14. **Strength window `signedSpread` values:**
    - FX: `normalizedBase - normalizedQuote`
    - Non-FX: `normalizedBase - 50`
    - Already computed in `WeeklyPairStrength.windows[].signedSpread` — just read it.

15. **File header standard applies.** Use the Freedom_EXE copyright header.

---

## Validation

1. `npx eslint scripts/research-neutral-resolvers.ts --max-warnings=0`
2. Script runs without errors: `npx tsx scripts/research-neutral-resolvers.ts`
3. Output file written to `docs/NEUTRAL_RESOLVER_RESEARCH_2026-04-04.md`
4. S1 baseline numbers in the output match the previous research: 229 trades, +28.49%, 19.56% DD
5. T1 baseline numbers match: 335 trades, +80.89%, 14.98% DD
6. All 5 sentiment stacks + 4 strength stacks have results
7. Individual tier quality table has all 5 sentiment + 5 strength tiers
8. No NaN/Infinity in output
9. Resolver trades are reported separately with their own statistics
10. Losing weeks counts are present for all stacks

---

## Files Changed Summary

| File | Change |
|------|--------|
| `scripts/research-neutral-resolvers.ts` | **New** — resolver stack research script |
| `docs/NEUTRAL_RESOLVER_RESEARCH_2026-04-04.md` | **New** — research output (auto-generated) |

**No production code changes. Zero.**
