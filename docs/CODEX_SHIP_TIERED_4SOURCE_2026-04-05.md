# CODEX: Ship 4-Source Weighted Tiered — Replace Both 3-Source Tiered Systems

**Date:** 2026-04-05
**Goal:** Remove both existing 3-source tiered systems (tiered_v3, tiered_3_nocomm) and replace with one canonical 4-source weighted tiered system: tiered_4w.

**Research results:** `docs/4SOURCE_TIERED_RESEARCH_2026-04-05.md`
**Ship candidate:** W1 T2 — weighted scoring with D=2.0, St=1.5, Se=1.25, C=0.75, trade only Tier 1 (score ≥ 4.0) and Tier 2 (score ≥ 2.0). 168 trades, +100.47%, 1.48% DD, 67.3% WR, 1 losing week.

---

## How the Scoring Works

Each source votes LONG (+weight) or SHORT (-weight):
- Dealer: weight 2.0
- Strength: weight 1.5
- Sentiment: weight 1.25
- Commercial: weight 0.75

Score = sum of signed weights. Direction = sign of score. Trade only if `abs(score) >= 2.0`.

Examples:
- All 4 LONG: score = +5.5 → Tier 1, LONG
- D+St+Se LONG, C SHORT: score = +4.75 - 0.75 = +4.0 → Tier 1, LONG
- D+St LONG, Se+C SHORT: score = +3.5 - 2.0 = +1.5 → **skip** (below 2.0)
- D LONG, St+Se+C SHORT: score = +2.0 - 3.5 = -1.5 → **skip**

Tier assignment:
- Tier 1: `abs(score) >= 4.0` (near-unanimous weighted agreement)
- Tier 2: `2.0 <= abs(score) < 4.0` (strong weighted majority)
- Skip: `abs(score) < 2.0` (weak lean or conflict — no trade)

---

## What Changes

Three files modified, no new files created.

| File | Action |
|------|--------|
| `src/lib/performance/strategyConfig.ts` | Remove tiered_v3 + tiered_3_nocomm configs, add tiered_4w, add backward compat mapping |
| `src/lib/performance/weeklyHoldEngine.ts` | Remove both old tiered resolution blocks, add weighted scoring block using all 4 sources |
| `src/lib/performance/strategyPageData.ts` | Bump engine version v16 → v17 |

---

## File 1: MODIFY `src/lib/performance/strategyConfig.ts`

### 1a. Add backward compatibility mapping

In `normalizeStrategyLookupId()`, add mappings so old URLs redirect:

```typescript
function normalizeStrategyLookupId(value: string | undefined | null): string | null {
  if (!value) return null;
  if (value === SELECTOR_SENTIMENT_OVERRIDE_RESEARCH_ID) {
    return SELECTOR_SENTIMENT_OVERRIDE_STRATEGY_ID;
  }
  // Backward compat: old 3-source agreement IDs → new 4-source
  if (value === "agree_2of3" || value === "agree_2of3_nocomm") {
    return "agree_3of4";
  }
  // Backward compat: old 3-source tiered IDs → new 4-source weighted
  if (value === "tiered_v3" || value === "tiered_3_nocomm") {
    return "tiered_4w";
  }
  return value;
}
```

### 1b. Replace strategy entries in STRATEGIES array

Remove BOTH of these entries:

```typescript
// REMOVE this entry:
{
  id: "tiered_v3",
  label: "Tiered V3",
  type: "tiered",
  description: "Three-tier directional voting system: Tier 1 Dealer, Tier 2 Commercial, Tier 3 Sentiment. Each source votes independently and higher tiers override lower tiers when signals conflict. Strength is not part of this stack.",
  cardBreakdown: "tiers",
},
// REMOVE this entry:
{
  id: "tiered_3_nocomm",
  label: "Tiered 3 NoComm",
  type: "tiered",
  description: "Three-source tiered stack using Dealer, Sentiment, and Strength only. All three vote independently: 3-of-3 becomes Tier 1, 2-of-3 becomes Tier 2, and single-source directional pressure becomes Tier 3. Commercial is excluded from the weekly vote.",
  cardBreakdown: "tiers",
},
```

Replace with ONE new entry. Place it before the agreement entry:

```typescript
{
  id: "tiered_4w",
  label: "Tiered 4W",
  type: "tiered",
  description: "Weighted four-source scoring system. Dealer (2.0), Strength (1.5), Sentiment (1.25), and Commercial (0.75) cast weighted directional votes. Tier 1 fires when the weighted score reaches near-unanimous agreement. Tier 2 fires on strong weighted majority. Pairs below the Tier 2 threshold are excluded — only high-conviction setups trade.",
  cardBreakdown: "tiers",
},
```

---

## File 2: MODIFY `src/lib/performance/weeklyHoldEngine.ts`

### 2a. Update needsStrengthVotes check

The `needsStrengthVotes` condition determines whether strength directions are loaded. tiered_4w uses all 4 sources. Update:

Current (after agree_3of4 ship):
```typescript
const needsStrengthVotes =
  biasSource.id === "tiered_3_nocomm"
  || biasSource.id === "agree_3of4"
  || (biasSource.type === "tandem" && biasSource.models?.includes("strength"));
```

New:
```typescript
const needsStrengthVotes =
  biasSource.id === "tiered_4w"
  || biasSource.id === "agree_3of4"
  || (biasSource.type === "tandem" && biasSource.models?.includes("strength"));
```

### 2b. Remove tiered_v3 resolution block

Remove the ENTIRE `if (biasSource.id === "tiered_v3")` block. This includes all the code from the `if` statement through the closing `return map;` and `}`.

### 2c. Remove tiered_3_nocomm resolution block

Remove the ENTIRE `if (biasSource.id === "tiered_3_nocomm")` block. Same scope.

### 2d. Add tiered_4w resolution block

Add the new block where the old tiered blocks were (before the agreement block):

```typescript
if (biasSource.id === "tiered_4w") {
  const TIERED_4W_WEIGHTS = {
    dealer: 2.0,
    strength: 1.5,
    sentiment: 1.25,
    commercial: 0.75,
  };
  const TIERED_4W_MIN_SCORE = 2.0;
  const TIERED_4W_TIER1_SCORE = 4.0;

  const map: DirectionMap = new Map();
  for (const pair of allPairs) {
    const de = dealerMap.get(pair);
    const ce = commMap.get(pair);
    const se = sentMap.get(pair);
    const st = strengthMap.get(pair);
    const ac = de?.assetClass ?? ce?.assetClass ?? se?.assetClass ?? st?.assetClass ?? inferAssetClass(pair);

    let score = 0;
    if (de?.direction === "LONG") score += TIERED_4W_WEIGHTS.dealer;
    else if (de?.direction === "SHORT") score -= TIERED_4W_WEIGHTS.dealer;
    if (ce?.direction === "LONG") score += TIERED_4W_WEIGHTS.commercial;
    else if (ce?.direction === "SHORT") score -= TIERED_4W_WEIGHTS.commercial;
    if (se?.direction === "LONG") score += TIERED_4W_WEIGHTS.sentiment;
    else if (se?.direction === "SHORT") score -= TIERED_4W_WEIGHTS.sentiment;
    if (st?.direction === "LONG") score += TIERED_4W_WEIGHTS.strength;
    else if (st?.direction === "SHORT") score -= TIERED_4W_WEIGHTS.strength;

    const absScore = Math.abs(score);
    if (absScore < TIERED_4W_MIN_SCORE) continue; // skip weak lean / conflict

    const direction: "LONG" | "SHORT" = score > 0 ? "LONG" : "SHORT";
    const tier = absScore >= TIERED_4W_TIER1_SCORE ? 1 : 2;
    map.set(pair, { direction, source: "tiered_4w", tier, assetClass: ac });
  }
  return map;
}
```

### 2e. Update comment

The comment at line ~150 references tiered_v3. Update it:

```typescript
// Layer B: this function composes derived strategies (tiered_4w, agree_3of4, tandem)
```

---

## File 3: MODIFY `src/lib/performance/strategyPageData.ts`

Bump the engine version:

```typescript
// Change from:
const STRATEGY_ARTIFACT_ENGINE_VERSION =
  process.env.STRATEGY_ARTIFACT_ENGINE_VERSION?.trim() || "strategy-artifact-v16";

// To:
const STRATEGY_ARTIFACT_ENGINE_VERSION =
  process.env.STRATEGY_ARTIFACT_ENGINE_VERSION?.trim() || "strategy-artifact-v17";
```

---

## What NOT to Change

- **basketSource.ts** — Unchanged. Basket provides base signals; the engine composes them.
- **selectorEngine.ts** — Unchanged.
- **performanceLab.ts** — Unchanged.
- **Dashboard, Data section** — Unchanged.
- **No new files needed.**

---

## Verification

### 1. Type check
```bash
npx tsc --noEmit
```

### 2. Build check
```bash
npm run build
```

### 3. Functional verification

After build passes:

- Navigate to Performance page — strategy dropdown should show "Tiered 4W" where old tiered systems were
- Old URLs with `?strategy=tiered_v3` or `?strategy=tiered_3_nocomm` should redirect to tiered_4w
- tiered_4w should show ~168 trades over 10 weeks (~16.8 trades/week)
- Tier 1 should have ~129 trades, Tier 2 should have ~39 trades
- The old tiered strategy names should NOT appear in the dropdown

### 4. Refresh performance data

```bash
npx tsx scripts/refresh-performance-latest.ts
```

Verify output mentions engine version v17.

---

## Important Warnings

1. **The tiered_4w block MUST use all 4 source maps** (dealerMap, commMap, sentMap, strengthMap). Make sure `tiered_4w` is in the `needsStrengthVotes` condition.

2. **Pairs with `abs(score) < 2.0` are SKIPPED.** This is what makes tiered_4w selective (168/360 coverage). Do NOT trade scores below the threshold.

3. **Score of exactly 0 should be impossible** with these asymmetric weights (2.0 + 1.5 + 1.25 + 0.75 = 5.5, no subset sums cancel). But the `< TIERED_4W_MIN_SCORE` check handles it safely anyway.

4. **Backward compatibility is important.** Old bookmarks for tiered_v3 or tiered_3_nocomm must land on tiered_4w.

5. **The weights are constants, not configurable.** They are hardcoded in the resolution block. Do NOT expose them as config or environment variables.

6. **Engine version bump is mandatory.** Without v16 → v17, cached artifacts will show old tiered results.

7. **Do NOT modify any research scripts or docs.**

8. **File header standard applies.**

---

## Expected Production Behavior After Ship

- **Strategy dropdown:** Shows "Tiered 4W" where "Tiered V3" and "Tiered 3 NoComm" used to be
- **Trade count:** ~16.8 trades/week (highly selective)
- **Tier 1:** ~129 trades — near-unanimous weighted agreement (score ≥ 4.0)
- **Tier 2:** ~39 trades — strong weighted majority (score 2.0-3.99)
- **Skipped pairs:** ~192 per 10 weeks — weak lean or weighted conflict
- **Performance:** +100.47%, 1.48% DD, 67.3% WR, 1 losing week (over current 10-week window)
- **Old URLs:** Automatically redirect to tiered_4w
